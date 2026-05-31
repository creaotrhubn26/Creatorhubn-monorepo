/**
 * Subscription health-check: avgjør om abonnement-staten er sunn nok til
 * å gjøre seat-endringer (legge til, fjerne, bumpe quantity).
 *
 * Defensive default: hvis status er "past_due", "incomplete" eller "canceled"
 * skal vi IKKE bumpe quantity (det kan resultere i feilet faktura eller
 * uventet kostnad).
 */

import type { Pool } from "pg";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "canceled"
  | "paused"
  | "unpaid"
  | "none";

export interface SubscriptionHealth {
  status: SubscriptionStatus;
  stripeSubscriptionId: string | null;
  /** Trygt å bumpe quantity? Krever active eller trialing. */
  canMutateSeats: boolean;
  /** Bør vi blokkere ny innlogging fra team-medlemmer? */
  shouldRevokeAccess: boolean;
  /** Tekst som kan vises til leder. */
  message: string;
}

const HEALTHY_FOR_MUTATION: Set<SubscriptionStatus> = new Set(["active", "trialing"]);
const SHOULD_REVOKE: Set<SubscriptionStatus> = new Set(["canceled", "unpaid", "incomplete_expired"]);

const STATUS_MESSAGES: Record<SubscriptionStatus, string> = {
  active: "Abonnementet er aktivt.",
  trialing: "Du er i prøveperioden — endringer er trygge.",
  past_due: "Forrige faktura ble ikke betalt. Oppdater betalingsmåten i Stripe Portal før du gjør endringer.",
  incomplete: "Stripe-utsjekken ble ikke fullført. Sett opp betaling på nytt.",
  incomplete_expired: "Stripe-utsjekken utløp uten betaling. Start abonnement på nytt.",
  canceled: "Abonnementet er kansellert. Aktiver det igjen for å kunne legge til medlemmer.",
  paused: "Abonnementet er pauset. Aktiver det igjen for å gjøre endringer.",
  unpaid: "Faktura forblev ubetalt. Oppdater betalingsmåten og bekreft i Stripe Portal.",
  none: "Du har ikke et aktivt Role Room-abonnement.",
};

export async function getSubscriptionHealth(
  pool: Pool, ownerUserId: string,
): Promise<SubscriptionHealth> {
  let stripeSubscriptionId: string | null = null;
  let dbStatus = "";

  try {
    const { rows } = await pool.query(
      `SELECT stripe_subscription_id, status FROM subscriptions
        WHERE user_id = $1
        ORDER BY start_date DESC LIMIT 1`,
      [ownerUserId],
    );
    stripeSubscriptionId = rows[0]?.stripe_subscription_id ?? null;
    dbStatus = String(rows[0]?.status ?? "").toLowerCase();
  } catch (err) {
    console.error("[rr-sub-health] subscription lookup failed:", err);
    return {
      status: "none", stripeSubscriptionId: null,
      canMutateSeats: false, shouldRevokeAccess: false,
      message: STATUS_MESSAGES.none,
    };
  }

  if (!stripeSubscriptionId) {
    return {
      status: "none", stripeSubscriptionId: null,
      canMutateSeats: false, shouldRevokeAccess: false,
      message: STATUS_MESSAGES.none,
    };
  }

  // For å være sikker på siste status henter vi fra Stripe direkte
  // — DB-en kan ligge bak hvis webhook ikke har kjørt ennå
  const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
  if (stripeKey) {
    try {
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(stripeKey);
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const liveStatus = String(sub.status).toLowerCase() as SubscriptionStatus;
      return {
        status: liveStatus,
        stripeSubscriptionId,
        canMutateSeats: HEALTHY_FOR_MUTATION.has(liveStatus),
        shouldRevokeAccess: SHOULD_REVOKE.has(liveStatus),
        message: STATUS_MESSAGES[liveStatus] ?? `Status: ${liveStatus}`,
      };
    } catch (err) {
      console.warn("[rr-sub-health] Stripe live-check failed, faller tilbake til DB:", (err as Error).message);
    }
  }

  // Fallback til DB-status hvis Stripe-call feiler eller key mangler
  const dbStatusTyped = (dbStatus as SubscriptionStatus) ?? "none";
  return {
    status: dbStatusTyped,
    stripeSubscriptionId,
    canMutateSeats: HEALTHY_FOR_MUTATION.has(dbStatusTyped),
    shouldRevokeAccess: SHOULD_REVOKE.has(dbStatusTyped),
    message: STATUS_MESSAGES[dbStatusTyped] ?? `Status: ${dbStatus}`,
  };
}
