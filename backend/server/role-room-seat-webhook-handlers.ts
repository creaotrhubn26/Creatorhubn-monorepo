/**
 * Stripe webhook-handlere for Role Room seat-management.
 *
 * Disse reagerer på Stripe-side endringer (manuelle quantity-justeringer,
 * mislykkede betalinger, kansellering) for å holde Role Room-tilgang og
 * audit-tilstand i sync.
 *
 * Brukes som tillegg til eksisterende handlers — de gjør ikke om på
 * andre Stripe-flows (Post Agent, NextRole etc.).
 */

import type { Pool } from "pg";
import type Stripe from "stripe";
import { logBillingAlert, countActiveSeats } from "./role-room-seat-stripe-sync.js";

/**
 * customer.subscription.updated — fanger drift:
 *   - Eksterne quantity-endringer (admin justerer i Stripe Dashboard)
 *   - Status-overgang til past_due
 *
 * Logger alert hvis Stripe-quantity ikke matcher antall aktive medlemmer
 * på prosjekter eieren har.
 */
export async function handleRoleRoomSubscriptionUpdated(
  pool: Pool,
  subscription: Stripe.Subscription,
): Promise<{ matched: boolean }> {
  const subId = subscription.id;
  const stripeCustomerId = typeof subscription.customer === "string"
    ? subscription.customer : subscription.customer?.id;
  if (!stripeCustomerId) return { matched: false };

  // Finn user_id basert på stripe_subscription_id (sikrere enn customer_id
  // siden samme kunde kan ha flere subs)
  let ownerUserId: string | null = null;
  try {
    const { rows } = await pool.query(
      `SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1 LIMIT 1`,
      [subId],
    );
    ownerUserId = rows[0]?.user_id ?? null;
  } catch (err) {
    console.error("[rr-webhook] user lookup failed:", err);
    return { matched: false };
  }
  if (!ownerUserId) return { matched: false };

  // Persist Stripe-side status så future health-checks ser samme bilde
  try {
    await pool.query(
      `UPDATE subscriptions SET status = $1, updated_at = NOW()
        WHERE stripe_subscription_id = $2`,
      [String(subscription.status), subId],
    );
  } catch (err) {
    console.warn("[rr-webhook] status update failed:", (err as Error).message);
  }

  // Hvis betalingen feilet (past_due/unpaid), logg alert så admin reagerer
  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    await logBillingAlert(pool, {
      projectId: "(all)",
      ownerUserId,
      actorUserId: "stripe-webhook",
      kind: "payment_failed",
      detail: `Subscription ${subId} er nå ${subscription.status}. Kunden må oppdatere betalingsmåten i Stripe Portal.`,
      stripeSubscriptionId: subId,
    });
  }

  // Detect drift: hvis Stripe-quantity ikke matcher aktive medlemmer på
  // noe prosjekt eieren har, logg alert. Vi normaliserer ikke automatisk
  // her (det kan endre kundens kostnad utilsiktet); admin må retry-sync.
  try {
    const { rows: projects } = await pool.query(
      `SELECT id FROM casting_projects WHERE created_by = $1`,
      [ownerUserId],
    );
    const stripeQuantity = subscription.items?.data?.[0]?.quantity ?? 0;
    for (const p of projects) {
      const used = await countActiveSeats(pool, ownerUserId, String(p.id));
      if (used !== stripeQuantity) {
        await logBillingAlert(pool, {
          projectId: String(p.id),
          ownerUserId,
          actorUserId: "stripe-webhook",
          kind: "stripe_quantity_drift",
          detail: `Drift: Stripe-quantity=${stripeQuantity}, aktive medlemmer=${used}. Manuell justering i Stripe-dashboard? Admin må kjøre 'Prøv sync på nytt'.`,
          stripeSubscriptionId: subId,
        });
        break; // logg én per webhook, ikke spamme
      }
    }
  } catch (err) {
    console.warn("[rr-webhook] drift check failed:", (err as Error).message);
  }

  return { matched: true };
}

/**
 * customer.subscription.deleted / canceled — revoker tilgangen til alle
 * team-medlemmer på alle prosjekter eieren har. Eieren beholder eier-
 * rolle, men kan ikke fortsette uten ny subscription.
 */
export async function handleRoleRoomSubscriptionDeleted(
  pool: Pool,
  subscription: Stripe.Subscription,
): Promise<{ matched: boolean; revokedCount: number }> {
  const subId = subscription.id;

  let ownerUserId: string | null = null;
  try {
    const { rows } = await pool.query(
      `SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1 LIMIT 1`,
      [subId],
    );
    ownerUserId = rows[0]?.user_id ?? null;
  } catch {
    return { matched: false, revokedCount: 0 };
  }
  if (!ownerUserId) return { matched: false, revokedCount: 0 };

  // Marker subscription som canceled i DB
  try {
    await pool.query(
      `UPDATE subscriptions SET status = 'canceled', updated_at = NOW()
        WHERE stripe_subscription_id = $1`,
      [subId],
    );
  } catch (err) {
    console.warn("[rr-webhook] sub status update failed:", (err as Error).message);
  }

  // Soft-deaktiver alle team-medlemmer på eierens prosjekter
  let revokedCount = 0;
  try {
    const result = await pool.query(
      `UPDATE casting_user_roles cur
          SET deactivated_at = NOW(),
              deactivated_by_user_id = 'stripe-webhook',
              deactivation_reason = 'Abonnement kansellert — tilgang automatisk inndratt'
         WHERE deactivated_at IS NULL
           AND project_id IN (SELECT id FROM casting_projects WHERE created_by = $1)`,
      [ownerUserId],
    );
    revokedCount = result.rowCount ?? 0;
  } catch (err) {
    console.error("[rr-webhook] mass-revoke failed:", err);
  }

  await logBillingAlert(pool, {
    projectId: "(all)",
    ownerUserId,
    actorUserId: "stripe-webhook",
    kind: "subscription_canceled",
    detail: `Subscription kansellert. ${revokedCount} team-medlemmer auto-deaktivert. Eier må re-aktivere abonnement for å gjenoppta drift.`,
    stripeSubscriptionId: subId,
  });

  return { matched: true, revokedCount };
}

/**
 * invoice.payment_failed — logger billing-alert så admin kan kontakte
 * kunden. Vi revoker IKKE tilgang her (det skjer ved
 * customer.subscription.deleted), men gir admin tidlig varsel.
 */
export async function handleRoleRoomPaymentFailed(
  pool: Pool,
  invoice: Stripe.Invoice,
): Promise<{ matched: boolean }> {
  // Stripe v19+ flyttet invoice.subscription til en utvidet path.
  // Bruker cast for å unngå å pin-poste den eksakte typen i hver API-bump.
  const invoiceWithSub = invoice as Stripe.Invoice & { subscription?: string | { id: string } | null };
  const subId = typeof invoiceWithSub.subscription === "string"
    ? invoiceWithSub.subscription : invoiceWithSub.subscription?.id;
  if (!subId) return { matched: false };

  let ownerUserId: string | null = null;
  try {
    const { rows } = await pool.query(
      `SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1 LIMIT 1`,
      [subId],
    );
    ownerUserId = rows[0]?.user_id ?? null;
  } catch {
    return { matched: false };
  }
  if (!ownerUserId) return { matched: false };

  const amountDue = (invoice.amount_due ?? 0) / 100;
  const currency = String(invoice.currency ?? "nok").toUpperCase();
  await logBillingAlert(pool, {
    projectId: "(all)",
    ownerUserId,
    actorUserId: "stripe-webhook",
    kind: "payment_failed",
    detail: `Faktura ${invoice.id} feilet (${amountDue.toFixed(2)} ${currency}). Stripe retrier automatisk; hvis det ikke lykkes blir abonnementet past_due → unpaid → canceled.`,
    stripeSubscriptionId: subId,
  });

  return { matched: true };
}
