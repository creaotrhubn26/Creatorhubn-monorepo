/**
 * Felles Stripe quantity-sync for Role Room seat-management.
 *
 * Brukes av:
 *   - members-routes når et medlem deaktiveres → senker quantity
 *   - members-routes når et medlem reaktiveres → øker quantity
 *   - seat-management-routes når leder bumper manuelt
 *
 * Sikker mht. minimum: bumper ALDRI under plan-minimum (3 for production_team,
 * 1 for content_producer). Hvis nåværende quantity allerede er på minimum og
 * vi prøver å senke, returnerer { ok: true, noop: true }.
 */

import type { Pool } from "pg";

interface SyncOptions {
  pool: Pool;
  ownerUserId: string;
  projectId: string;
  /**
   * Target seat-count basert på aktivt medlemskap (eier + ikke-deaktiverte
   * casting_user_roles). Vi clamper opp til plan-minimum.
   */
  targetActiveUsers: number;
  /** Hvem som utløste endringen (audit). */
  actorUserId: string;
}

interface SyncResult {
  ok: boolean;
  noop?: boolean;
  previousQuantity?: number;
  newQuantity?: number;
  reason?: string;
}

const PLAN_MINIMUMS: Record<string, number> = {
  production_team: 3,
  content_producer: 1,
};

export async function syncRoleRoomSeatQuantity(opts: SyncOptions): Promise<SyncResult> {
  const { pool, ownerUserId, projectId, targetActiveUsers, actorUserId } = opts;

  // Finn eier-subscription
  let stripeSubscriptionId: string | null = null;
  let planName = "";
  try {
    const { rows } = await pool.query(
      `SELECT stripe_subscription_id, plan_name FROM subscriptions
        WHERE user_id = $1 AND status IN ('active','trialing')
        ORDER BY start_date DESC LIMIT 1`,
      [ownerUserId],
    );
    stripeSubscriptionId = rows[0]?.stripe_subscription_id ?? null;
    planName = String(rows[0]?.plan_name ?? "").toLowerCase();
  } catch (err) {
    console.error("[rr-seat-sync] subscription lookup failed:", err);
    return { ok: false, reason: "subscription_lookup_failed" };
  }

  if (!stripeSubscriptionId) {
    // Ingen aktiv subscription — ingenting å sync'e
    return { ok: true, noop: true, reason: "no_active_subscription" };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
  if (!stripeKey) {
    await logBillingAlert(pool, {
      projectId, ownerUserId, actorUserId,
      kind: "stripe_sync_failed",
      detail: "STRIPE_SECRET_KEY mangler i miljøet — kan ikke synce seat-quantity",
      stripeSubscriptionId,
    });
    return { ok: false, reason: "stripe_not_configured" };
  }

  const persona = planName.includes("content") || planName.includes("produsent")
    ? "content_producer" : "production_team";
  const minQuantity = PLAN_MINIMUMS[persona] ?? 1;
  const desiredQuantity = Math.max(minQuantity, targetActiveUsers);

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ["items.data.price"],
    });

    const items = subscription.items?.data ?? [];
    if (items.length === 0) {
      await logBillingAlert(pool, {
        projectId, ownerUserId, actorUserId,
        kind: "missing_subscription_item",
        detail: `Subscription ${stripeSubscriptionId} har ingen items — kan ikke sette seat-quantity`,
        stripeSubscriptionId,
      });
      return { ok: false, reason: "no_subscription_items" };
    }

    const roleRoomPriceIds = new Set<string>(
      [
        process.env.ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM,
        process.env.ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER,
      ].filter((v): v is string => !!v && v.trim().length > 0),
    );
    let item = roleRoomPriceIds.size > 0
      ? items.find((i: { price?: { id?: string } }) => i.price?.id && roleRoomPriceIds.has(i.price.id))
      : undefined;
    if (!item) {
      item = items[0];
      console.warn(
        "[rr-seat-sync] no Role Room price-id match on subscription",
        stripeSubscriptionId,
        "— falling back to first item",
        item.id,
      );
    }
    const currentQuantity: number = item.quantity ?? 1;
    if (currentQuantity === desiredQuantity) {
      return { ok: true, noop: true, previousQuantity: currentQuantity, newQuantity: desiredQuantity };
    }

    await stripe.subscriptionItems.update(item.id, {
      quantity: desiredQuantity,
      proration_behavior: "create_prorations",
    });

    // Audit-log via samme tabell som seat-management-routes lager.
    try {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS role_room_seat_changes (
           id BIGSERIAL PRIMARY KEY,
           project_id VARCHAR(255) NOT NULL,
           owner_user_id VARCHAR(255) NOT NULL,
           actor_user_id VARCHAR(255) NOT NULL,
           from_quantity INT NOT NULL,
           to_quantity INT NOT NULL,
           seats_added INT NOT NULL,
           estimated_extra_cost_minor INT NOT NULL,
           stripe_subscription_id VARCHAR(255),
           stripe_subscription_item_id VARCHAR(255),
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         );`,
      );
      const unitAmount = item.price?.unit_amount ?? 0;
      const seatsDelta = desiredQuantity - currentQuantity;
      await pool.query(
        `INSERT INTO role_room_seat_changes
          (project_id, owner_user_id, actor_user_id, from_quantity, to_quantity,
           seats_added, estimated_extra_cost_minor, stripe_subscription_id, stripe_subscription_item_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          projectId, ownerUserId, actorUserId,
          currentQuantity, desiredQuantity, seatsDelta,
          seatsDelta * unitAmount,
          stripeSubscriptionId, item.id,
        ],
      );
    } catch (err) {
      console.warn("[rr-seat-sync] audit-log insert failed:", err);
    }

    return { ok: true, previousQuantity: currentQuantity, newQuantity: desiredQuantity };
  } catch (err) {
    console.error("[rr-seat-sync] stripe update failed:", err);
    await logBillingAlert(pool, {
      projectId, ownerUserId, actorUserId,
      kind: "stripe_sync_failed",
      detail: (err as Error).message,
      stripeSubscriptionId,
    });
    return { ok: false, reason: (err as Error).message };
  }
}

/**
 * Logger billing-incident i en admin-synlig tabell. Brukes når Stripe-sync
 * feiler så support kan reagere uten å lese server-logger.
 */
export async function logBillingAlert(
  pool: Pool,
  alert: {
    projectId: string;
    ownerUserId: string;
    actorUserId: string;
    kind: "stripe_sync_failed" | "no_active_subscription" | "missing_subscription_item" | string;
    detail: string;
    stripeSubscriptionId?: string | null;
  },
): Promise<void> {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS role_room_billing_alerts (
         id BIGSERIAL PRIMARY KEY,
         project_id VARCHAR(255) NOT NULL,
         owner_user_id VARCHAR(255) NOT NULL,
         actor_user_id VARCHAR(255) NOT NULL,
         kind VARCHAR(64) NOT NULL,
         detail TEXT NOT NULL,
         stripe_subscription_id VARCHAR(255),
         resolved_at TIMESTAMPTZ,
         resolved_by_user_id VARCHAR(255),
         resolution_note TEXT,
         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       );
       CREATE INDEX IF NOT EXISTS idx_rr_billing_alerts_unresolved
         ON role_room_billing_alerts(created_at DESC) WHERE resolved_at IS NULL;`,
    );
    await pool.query(
      `INSERT INTO role_room_billing_alerts
        (project_id, owner_user_id, actor_user_id, kind, detail, stripe_subscription_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        alert.projectId, alert.ownerUserId, alert.actorUserId,
        alert.kind, alert.detail.slice(0, 2000),
        alert.stripeSubscriptionId ?? null,
      ],
    );
  } catch (err) {
    console.error("[rr-seat-sync] logBillingAlert failed:", err);
  }
}

/**
 * Teller aktive seats (eier + ikke-deaktiverte casting_user_roles).
 * Fallback til alle hvis deactivated_at-kolonnen ikke finnes.
 */
export async function countActiveSeats(
  pool: Pool, ownerUserId: string, projectId: string,
): Promise<number> {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS used FROM (
          SELECT $1::text AS uid
          UNION
          SELECT DISTINCT user_id FROM casting_user_roles
            WHERE project_id = $2 AND deactivated_at IS NULL
       ) s`,
      [ownerUserId, projectId],
    );
    return rows[0]?.used ?? 1;
  } catch {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS used FROM (
          SELECT $1::text AS uid
          UNION
          SELECT DISTINCT user_id FROM casting_user_roles WHERE project_id = $2
       ) s`,
      [ownerUserId, projectId],
    );
    return rows[0]?.used ?? 1;
  }
}
