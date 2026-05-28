/**
 * Role Room seat-management — leder kan kjøpe ekstra seats utover de
 * inkluderte (3 for production_team, 1 for content_producer).
 *
 * Bumper Stripe subscription_item quantity → faktiske kostnader oppstår
 * proporsjonalt på neste faktura.
 *
 * Autorisering: kun produksjonsteam-leder (casting_projects.created_by).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { getSubscriptionHealth } from "./role-room-subscription-health.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUserIdFromRequest(
  req: Request,
  activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
  }
  return null;
}

async function isProjectLeader(
  pool: Pool, viewerId: string, projectId: string,
): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `SELECT created_by FROM casting_projects WHERE id = $1 AND created_by = $2 LIMIT 1`,
      [projectId, viewerId],
    );
    return rows[0]?.created_by ?? null;
  } catch (err) {
    console.error("[rr-seat-mgmt] isProjectLeader failed:", err);
    return null;
  }
}

export function registerRoleRoomSeatManagementRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;

  // ── POST seats/upgrade: bumper Stripe quantity til target ──────
  //
  // Body: { targetQuantity?: number }
  //  - hvis ikke satt: nåværende quantity + 1
  //  - må alltid være > current quantity (vi reduserer aldri her,
  //    det skjer via member-removal endpoint)
  app.post(
    "/api/role-room/projects/:projectId/seats/upgrade",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = String(req.params.projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "projectId_mangler" }); return;
      }
      const ownerUserId = await isProjectLeader(pool, viewerId, projectId);
      if (!ownerUserId) {
        res.status(403).json({ error: "kun_team_leder" }); return;
      }

      // Pre-flight: sjekk subscription-helse fra Stripe (ikke bare DB).
      // Hindrer at vi bumper på past_due/canceled/unpaid-abonnementer.
      const health = await getSubscriptionHealth(pool, ownerUserId);
      if (!health.canMutateSeats) {
        res.status(402).json({
          error: "subscription_not_healthy",
          detail: health.message,
          status: health.status,
          actionUrl: "/billing",
          actionLabel: "Åpne Stripe Portal",
        });
        return;
      }
      const stripeSubscriptionId = health.stripeSubscriptionId;
      if (!stripeSubscriptionId) {
        res.status(402).json({
          error: "ingen_aktiv_subscription",
          detail: "Du må ha et aktivt Role Room-abonnement før du kan kjøpe ekstra seats.",
        });
        return;
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
      if (!stripeKey) {
        res.status(503).json({ error: "stripe_ikke_konfigurert" }); return;
      }

      try {
        // ESM-kompatibel import (backend er "type": "module")
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(stripeKey);
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
          expand: ["items.data.price"],
        });

        // Finn riktig seat-item: matcher mot kjent Role Room-seat-price.
        // Vi har 2 personas (production_team/content_producer) med distinkte
        // priser. Hvis vi ikke finner match, faller vi tilbake til første item
        // som siste utvei — bedre å feile tydelig enn å bumpe feil add-on.
        const items = subscription.items?.data ?? [];
        if (items.length === 0) {
          res.status(500).json({ error: "ingen_subscription_items" }); return;
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
          // Hvis ingen Role Room-price-IDer er konfigurert eller match feiler,
          // bruk første item men logg det tydelig for senere debugging
          item = items[0];
          console.warn(
            "[rr-seat-mgmt] no Role Room price-id match on subscription",
            stripeSubscriptionId,
            "— falling back to first item",
            item.id,
          );
        }
        const currentQuantity: number = item.quantity ?? 1;

        const requestedTarget = Number(req.body?.targetQuantity);
        const target = Number.isFinite(requestedTarget) && requestedTarget > 0
          ? Math.floor(requestedTarget)
          : currentQuantity + 1;

        if (target <= currentQuantity) {
          res.status(400).json({
            error: "ingen_oppgradering",
            detail: `Target quantity (${target}) er ikke høyere enn nåværende (${currentQuantity}).`,
            currentQuantity,
            targetQuantity: target,
          });
          return;
        }
        const seatsAdded = target - currentQuantity;

        // Beregn estimert pris pr seat (i øre) for å returnere preview
        const unitAmount = item.price?.unit_amount ?? 0;
        const estimatedExtraCostPerMonth = (target - currentQuantity) * unitAmount;

        // Faktisk Stripe quantity-update — prorations skapes automatisk
        await stripe.subscriptionItems.update(item.id, {
          quantity: target,
          proration_behavior: "create_prorations",
        });

        // Audit-log: hvem oppgraderte hva til hva, når
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
          await pool.query(
            `INSERT INTO role_room_seat_changes
              (project_id, owner_user_id, actor_user_id, from_quantity, to_quantity,
               seats_added, estimated_extra_cost_minor, stripe_subscription_id, stripe_subscription_item_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              projectId, ownerUserId, viewerId,
              currentQuantity, target, seatsAdded,
              estimatedExtraCostPerMonth,
              stripeSubscriptionId, item.id,
            ],
          );
        } catch (err) {
          // Audit-log er nice-to-have — feiler vi her, har bump allerede skjedd
          console.warn("[rr-seat-mgmt] audit-log insert failed:", err);
        }

        res.json({
          ok: true,
          previousQuantity: currentQuantity,
          newQuantity: target,
          seatsAdded,
          estimatedExtraCostPerMonthMinor: estimatedExtraCostPerMonth,
          estimatedExtraCostPerMonthMajor: estimatedExtraCostPerMonth / 100,
          currency: item.price?.currency ?? "nok",
        });
      } catch (err) {
        console.error("[rr-seat-mgmt] upgrade failed:", err);
        res.status(500).json({
          error: "stripe_feil",
          detail: (err as Error).message,
        });
      }
    },
  );
}
