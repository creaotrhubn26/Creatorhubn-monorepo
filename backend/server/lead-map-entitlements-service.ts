/**
 * lead-map-entitlements-service.ts
 *
 * Wave LM-Agent Fase 2 — Stripe-modul-gating for Lead Map.
 *
 * 3 tier:
 *   discover: 299 kr/mnd, 50 leads, 0 AI-pitcher, manuell status
 *   pro:      599 kr/mnd, 250 leads, 50 AI-pitcher, full visit-log
 *   agency:  1490 kr/mnd, ubegrenset, ubegrenset, multi-bruker
 *
 * Quota håndheves via lead_map_module_usage (måneds-bucket).
 * Trial: 14 dager free pro-tier ved første aktivering.
 */

import type { Pool } from "pg";

export type LeadMapTier = 'discover' | 'pro' | 'agency';
export type EntitlementStatus = 'trial' | 'active' | 'expired' | 'revoked';

export interface TierLimits {
  leadsPerMonth: number | null;       // null = unlimited
  aiPitchesPerMonth: number | null;
  multiUser: boolean;
  visitLogging: boolean;
}

export const TIER_LIMITS: Record<LeadMapTier, TierLimits> = {
  discover: { leadsPerMonth: 50,   aiPitchesPerMonth: 0,    multiUser: false, visitLogging: false },
  pro:      { leadsPerMonth: 250,  aiPitchesPerMonth: 50,   multiUser: false, visitLogging: true  },
  agency:   { leadsPerMonth: null, aiPitchesPerMonth: null, multiUser: true,  visitLogging: true  },
};

export const TIER_PRICING_NOK: Record<LeadMapTier, number> = {
  discover: 299,
  pro: 599,
  agency: 1490,
};

export interface Entitlement {
  id: string;
  configId: string;
  producerUserId: string;
  tier: LeadMapTier;
  status: EntitlementStatus;
  source: string;
  trialEndsAt: string | null;
  expiresAt: string | null;
  limits: TierLimits;
  usage: {
    billingPeriod: string;
    leadsImported: number;
    aiPitchesGenerated: number;
    visitsLogged: number;
  };
  remaining: {
    leads: number | null;
    aiPitches: number | null;
  };
}

function billingPeriodNow(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Hent aktiv entitlement + denne-måneds usage. */
export async function getEntitlement(
  pool: Pool, configId: string,
): Promise<Entitlement | null> {
  const r = await pool.query<{
    id: string;
    config_id: string;
    producer_user_id: string;
    tier: LeadMapTier;
    status: EntitlementStatus;
    source: string;
    trial_ends_at: Date | null;
    expires_at: Date | null;
    leads_per_month_limit: number | null;
    ai_pitches_per_month_limit: number | null;
  }>(
    `SELECT id::text, config_id::text, producer_user_id, tier, status, source,
            trial_ends_at, expires_at, leads_per_month_limit, ai_pitches_per_month_limit
     FROM lead_map_module_entitlements
     WHERE config_id = $1::uuid AND revoked_at IS NULL
     LIMIT 1`,
    [configId],
  );
  const row = r.rows[0];
  if (!row) return null;

  // Sjekk om utgått (subscription cancel_at_period_end)
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return null;
  }
  // Sjekk om trial-utgått
  if (row.status === 'trial' && row.trial_ends_at && new Date(row.trial_ends_at) < new Date()) {
    // Auto-expire
    await pool.query(
      `UPDATE lead_map_module_entitlements
         SET status = 'expired', updated_at = NOW()
       WHERE id = $1::uuid`,
      [row.id],
    );
    return null;
  }

  const billingPeriod = billingPeriodNow();
  const u = await pool.query<{
    leads_imported: number;
    ai_pitches_generated: number;
    visits_logged: number;
  }>(
    `SELECT leads_imported, ai_pitches_generated, visits_logged
     FROM lead_map_module_usage
     WHERE entitlement_id = $1::uuid AND billing_period = $2`,
    [row.id, billingPeriod],
  );
  const usage = u.rows[0] ?? { leads_imported: 0, ai_pitches_generated: 0, visits_logged: 0 };

  const limits = TIER_LIMITS[row.tier];
  return {
    id: row.id,
    configId: row.config_id,
    producerUserId: row.producer_user_id,
    tier: row.tier,
    status: row.status,
    source: row.source,
    trialEndsAt: row.trial_ends_at?.toISOString() ?? null,
    expiresAt: row.expires_at?.toISOString() ?? null,
    limits,
    usage: {
      billingPeriod,
      leadsImported: usage.leads_imported,
      aiPitchesGenerated: usage.ai_pitches_generated,
      visitsLogged: usage.visits_logged,
    },
    remaining: {
      leads: limits.leadsPerMonth !== null
        ? Math.max(0, limits.leadsPerMonth - usage.leads_imported) : null,
      aiPitches: limits.aiPitchesPerMonth !== null
        ? Math.max(0, limits.aiPitchesPerMonth - usage.ai_pitches_generated) : null,
    },
  };
}

/** Sjekk og bump usage. Returnerer false hvis quota-overskredet. */
export async function consumeQuota(
  pool: Pool, opts: { configId: string; kind: 'leads' | 'ai_pitches' | 'visits'; amount?: number },
): Promise<{ ok: boolean; remaining?: number | null; reason?: string }> {
  const e = await getEntitlement(pool, opts.configId);
  if (!e) return { ok: false, reason: 'no_entitlement' };

  const amount = opts.amount ?? 1;
  let limit: number | null = null;
  let used = 0;
  if (opts.kind === 'leads') { limit = e.limits.leadsPerMonth; used = e.usage.leadsImported; }
  if (opts.kind === 'ai_pitches') { limit = e.limits.aiPitchesPerMonth; used = e.usage.aiPitchesGenerated; }
  if (opts.kind === 'visits') {
    if (!e.limits.visitLogging) return { ok: false, reason: 'visit_logging_not_in_tier' };
    used = e.usage.visitsLogged;
  }

  if (limit !== null && used + amount > limit) {
    return { ok: false, reason: 'quota_exceeded', remaining: Math.max(0, limit - used) };
  }

  // Bump counter (upsert måneds-bucket)
  const column = opts.kind === 'leads' ? 'leads_imported'
    : opts.kind === 'ai_pitches' ? 'ai_pitches_generated'
    : 'visits_logged';
  const billingPeriod = billingPeriodNow();

  await pool.query(
    `INSERT INTO lead_map_module_usage (
       entitlement_id, config_id, billing_period, ${column}
     ) VALUES ($1::uuid, $2::uuid, $3, $4)
     ON CONFLICT (entitlement_id, billing_period) DO UPDATE SET
       ${column} = lead_map_module_usage.${column} + EXCLUDED.${column},
       updated_at = NOW()`,
    [e.id, opts.configId, billingPeriod, amount],
  );

  const newRemaining = limit !== null ? Math.max(0, limit - used - amount) : null;
  return { ok: true, remaining: newRemaining };
}

/** Start 14-dagers gratis pro-trial. Kun lov én gang per config. */
export async function startTrial(
  pool: Pool, opts: { configId: string; producerUserId: string },
): Promise<{ ok: boolean; entitlementId?: string; reason?: string }> {
  // Sjekk om har hatt entitlement før
  const prior = await pool.query(
    `SELECT id FROM lead_map_module_entitlements
     WHERE config_id = $1::uuid LIMIT 1`,
    [opts.configId],
  );
  if (prior.rowCount && prior.rowCount > 0) {
    return { ok: false, reason: 'trial_already_used' };
  }

  const trialEnds = new Date(Date.now() + 14 * 86400_000);
  const r = await pool.query<{ id: string }>(
    `INSERT INTO lead_map_module_entitlements (
       config_id, producer_user_id, tier, status, source,
       trial_ends_at, leads_per_month_limit, ai_pitches_per_month_limit
     ) VALUES ($1::uuid, $2, 'pro', 'trial', 'trial', $3, $4, $5)
     RETURNING id::text`,
    [
      opts.configId, opts.producerUserId, trialEnds,
      TIER_LIMITS.pro.leadsPerMonth, TIER_LIMITS.pro.aiPitchesPerMonth,
    ],
  );
  return { ok: true, entitlementId: r.rows[0].id };
}

/** Upsert entitlement fra Stripe-subscription. */
export async function upsertEntitlementFromStripeSubscription(
  pool: Pool, opts: {
    configId: string;
    producerUserId: string;
    tier: LeadMapTier;
    stripeSubscriptionId: string;
    stripePriceId: string | null;
    stripeCustomerId: string | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date | null;
  },
): Promise<{ ok: true; entitlementId: string }> {
  const limits = TIER_LIMITS[opts.tier];
  const status: EntitlementStatus = opts.cancelAtPeriodEnd ? 'active' : 'active';
  const expiresAt = opts.cancelAtPeriodEnd ? opts.currentPeriodEnd : null;

  // Revoke eksisterende aktiv hvis byte av tier
  await pool.query(
    `UPDATE lead_map_module_entitlements
       SET revoked_at = NOW(), updated_at = NOW()
     WHERE config_id = $1::uuid AND revoked_at IS NULL AND tier != $2`,
    [opts.configId, opts.tier],
  );

  // Upsert nåværende tier
  const r = await pool.query<{ id: string }>(
    `INSERT INTO lead_map_module_entitlements (
       config_id, producer_user_id, tier, status, source,
       stripe_subscription_id, stripe_price_id, stripe_customer_id,
       expires_at, leads_per_month_limit, ai_pitches_per_month_limit
     ) VALUES ($1::uuid, $2, $3, $4, 'stripe_subscription',
       $5, $6, $7, $8, $9, $10)
     ON CONFLICT (config_id) WHERE revoked_at IS NULL DO UPDATE SET
       status = EXCLUDED.status,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       stripe_price_id = EXCLUDED.stripe_price_id,
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()
     RETURNING id::text`,
    [
      opts.configId, opts.producerUserId, opts.tier, status,
      opts.stripeSubscriptionId, opts.stripePriceId, opts.stripeCustomerId,
      expiresAt, limits.leadsPerMonth, limits.aiPitchesPerMonth,
    ],
  );
  return { ok: true, entitlementId: r.rows[0].id };
}

/** Marker entitlement som expired (subscription deleted). */
export async function expireEntitlementForSubscription(
  pool: Pool, subscriptionId: string,
): Promise<void> {
  await pool.query(
    `UPDATE lead_map_module_entitlements
       SET status = 'expired', revoked_at = NOW(), updated_at = NOW()
     WHERE stripe_subscription_id = $1 AND revoked_at IS NULL`,
    [subscriptionId],
  );
}

/** Map Stripe price_id til tier. */
export function tierFromPriceId(priceId: string): LeadMapTier | null {
  if (priceId === process.env.STRIPE_PRICE_LEAD_MAP_DISCOVER) return 'discover';
  if (priceId === process.env.STRIPE_PRICE_LEAD_MAP_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_LEAD_MAP_AGENCY) return 'agency';
  return null;
}
