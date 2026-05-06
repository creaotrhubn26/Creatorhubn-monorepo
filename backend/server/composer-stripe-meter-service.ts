/**
 * Composer Stripe Meter-service.
 *
 * Stripe API 2025-03-31.basil krever at metered prices kobles til en Meter
 * (POST /v1/billing/meter_events). Når bruker bruker over inkludert kvote,
 * fyrer vi et meter_event mot Stripe — som da automatisk aggregerer +
 * inkluderer overage på neste subscription-faktura.
 *
 * Tax-håndtering:
 *   - Priser opprettet av bootstrap-composer-stripe.ts har tax_behavior="exclusive"
 *     (eks. mva.) og tax_code="txcd_10000000" (digital service).
 *   - Subscription må opprettes med automatic_tax: { enabled: true } så
 *     Stripe Tax legger på 25% norsk MVA automatisk basert på customer-adresse.
 *   - Meter events bærer ingen tax — Stripe applies tax på faktura-tidspunkt
 *     basert på subscription-policy + customer-location.
 *
 * Identifier-felt på meter_event er idempotency-key — re-sending med samme
 * identifier blir no-op. Vi bruker composer_usage.id (UUID) → trygt å re-fyre.
 */

import type { Pool } from "pg";

interface MeterEventInput {
  /** Stripe meter event_name (composer_claude_call, composer_render, composer_r2_gb_month) */
  eventName: string;
  /** Stripe customer id (cus_...) — fra composer_subscription.stripe_customer_id */
  customerId: string;
  /** Antall units (1 for events, decimal for storage GB) */
  value: number;
  /** Idempotency-key (vi bruker composer_usage.id som UUID) */
  identifier: string;
  /** Unix-timestamp når eventet faktisk skjedde */
  timestamp?: number;
}

interface MeterServiceConfig {
  stripeApiKey: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedClient: any = null;

async function getStripeClient(cfg: MeterServiceConfig) {
  if (cachedClient) return cachedClient;
  // @ts-ignore — optional SDK
  const mod: { default?: unknown; Stripe?: unknown } = await import("stripe");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = (mod.default ?? mod.Stripe) as any;
  cachedClient = new Ctor(cfg.stripeApiKey, { apiVersion: "2025-08-27.basil" });
  return cachedClient;
}

/**
 * Fyr et meter_event mot Stripe. Idempotent via identifier — re-sending
 * av samme (eventName, identifier) er no-op på Stripe-siden.
 */
export async function sendMeterEvent(
  cfg: MeterServiceConfig,
  input: MeterEventInput,
): Promise<string | null> {
  if (!cfg.stripeApiKey) {
    console.warn("[composer-meter] STRIPE_SECRET_KEY missing — skipping meter event");
    return null;
  }
  try {
    const client = await getStripeClient(cfg);
    const result = await client.billing.meterEvents.create({
      event_name: input.eventName,
      payload: {
        stripe_customer_id: input.customerId,
        value: String(input.value),
      },
      identifier: input.identifier,
      timestamp: input.timestamp ?? Math.floor(Date.now() / 1000),
    });
    return result.identifier as string;
  } catch (err) {
    console.error("[composer-meter] sendMeterEvent failed:", err);
    return null;
  }
}

export const METER_EVENT_NAMES: Record<string, string> = {
  claude_campaign: "composer_claude_call",
  render_poster: "composer_render",
  render_menu_pdf: "composer_render",
  r2_storage: "composer_r2_gb_month",
};

export async function resolveStripeCustomerId(
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const { rows } = await pool.query<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM composer_subscription WHERE user_id = $1`,
    [userId],
  );
  return rows[0]?.stripe_customer_id ?? null;
}

/**
 * Bestem om denne usage-event'en er OVER inkludert kvote.
 * Aggregerer månedens forbruk t.o.m. denne raden, sammenligner med kvote.
 */
export async function isOverageEvent(
  pool: Pool,
  userId: string,
  eventType: string,
  billingPeriod: string,
): Promise<boolean> {
  const sub = await pool.query<{
    included_claude_calls: number;
    included_renders: number;
    included_r2_gb: string;
  }>(
    `SELECT included_claude_calls, included_renders, included_r2_gb
     FROM composer_subscription WHERE user_id = $1`,
    [userId],
  );
  if (sub.rows.length === 0) return false;

  const usage = await pool.query<{ event_type: string; total_qty: string }>(
    `SELECT event_type, SUM(quantity)::text AS total_qty
     FROM composer_usage
     WHERE user_id = $1 AND billing_period = $2
     GROUP BY event_type`,
    [userId, billingPeriod],
  );

  let claudeQty = 0;
  let renderQty = 0;
  let r2Gb = 0;
  for (const r of usage.rows) {
    const q = Number(r.total_qty);
    if (r.event_type === "claude_campaign") claudeQty = q;
    else if (r.event_type === "render_poster" || r.event_type === "render_menu_pdf") renderQty += q;
    else if (r.event_type === "r2_storage") r2Gb = Math.max(r2Gb, q);
  }

  const includedClaude = sub.rows[0].included_claude_calls;
  const includedRenders = sub.rows[0].included_renders;
  const includedR2Gb = Number(sub.rows[0].included_r2_gb);

  if (eventType === "claude_campaign") return claudeQty > includedClaude;
  if (eventType === "render_poster" || eventType === "render_menu_pdf") return renderQty > includedRenders;
  if (eventType === "r2_storage") return r2Gb > includedR2Gb;
  return false;
}
