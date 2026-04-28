/**
 * Dance addon service — Frilansdanser-utvidelse via à la carte moduler.
 *
 * Add-on er additivt over grunnplanen: feature-flags fra aktive add-ons
 * unioniseres med plan.features. useDancePlanGate sjekker både.
 *
 * Status-modell:
 *   • 'trialing' → tilgang under trial_days (uten Stripe)
 *   • 'active'   → betalende abonnement (fra Stripe-webhook)
 *   • 'past_due' → mislykket betaling — gradvis tilgangs-tap
 *   • 'canceled' → avslutter ved current_period_end
 *   • 'comp'     → admin-tildelt fri tilgang
 */

import type { Pool } from 'pg';

function isoTs(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}
function isoTsOrNull(value: unknown): string | null {
  if (value == null) return null;
  return isoTs(value);
}
function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return fallback;
}

// ─── Types ──────────────────────────────────────────────────────────────

export type AddonPersona = 'dance_freelance' | 'dance_studio';

export interface DanceAddon {
  slug: string;
  name: string;
  description: string | null;
  monthlyPriceKr: number | null;
  yearlyPriceKr: number | null;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  featureFlags: string[];
  availableForPersonas: AddonPersona[];
  requiresAddonEligiblePlan: boolean;
  trialDays: number;
  isActive: boolean;
  isFeatured: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DanceAddonSubscription {
  id: string;
  userId: string;
  addonSlug: string;
  billingPeriod: 'monthly' | 'yearly' | 'comp';
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'comp';
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  trialEndAt: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

function mapAddonRow(row: Record<string, unknown>): DanceAddon {
  return {
    slug: String(row.slug),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    monthlyPriceKr: row.monthly_price_kr == null ? null : Number(row.monthly_price_kr),
    yearlyPriceKr: row.yearly_price_kr == null ? null : Number(row.yearly_price_kr),
    stripeMonthlyPriceId: row.stripe_monthly_price_id ? String(row.stripe_monthly_price_id) : null,
    stripeYearlyPriceId: row.stripe_yearly_price_id ? String(row.stripe_yearly_price_id) : null,
    featureFlags: asJson<string[]>(row.feature_flags, []),
    availableForPersonas: asJson<AddonPersona[]>(row.available_for_personas, ['dance_freelance']),
    requiresAddonEligiblePlan: row.requires_addon_eligible_plan === true || row.requires_addon_eligible_plan === 't',
    trialDays: Number(row.trial_days ?? 0),
    isActive: row.is_active === true || row.is_active === 't',
    isFeatured: row.is_featured === true || row.is_featured === 't',
    displayOrder: Number(row.display_order ?? 0),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

function mapSubRow(row: Record<string, unknown>): DanceAddonSubscription {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    addonSlug: String(row.addon_slug),
    billingPeriod: String(row.billing_period) as DanceAddonSubscription['billingPeriod'],
    status: String(row.status) as DanceAddonSubscription['status'],
    stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
    stripeSubscriptionId: row.stripe_subscription_id ? String(row.stripe_subscription_id) : null,
    currentPeriodEnd: isoTsOrNull(row.current_period_end),
    trialEndAt: isoTsOrNull(row.trial_end_at),
    cancelAtPeriodEnd: row.cancel_at_period_end === true || row.cancel_at_period_end === 't',
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

// ─── Catalog ────────────────────────────────────────────────────────────

export async function listAddons(
  pool: Pool,
  options: { activeOnly?: boolean; persona?: AddonPersona } = {},
): Promise<DanceAddon[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (options.activeOnly !== false) conditions.push(`is_active = TRUE`);
  if (options.persona) {
    params.push(JSON.stringify([options.persona]));
    conditions.push(`available_for_personas @> $${params.length}::jsonb`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const r = await pool.query(
    `SELECT * FROM dance_addon ${where} ORDER BY display_order, name`,
    params,
  );
  return r.rows.map(mapAddonRow);
}

export async function getAddonBySlug(pool: Pool, slug: string): Promise<DanceAddon | null> {
  const r = await pool.query(`SELECT * FROM dance_addon WHERE slug = $1`, [slug]);
  return r.rowCount ? mapAddonRow(r.rows[0]) : null;
}

// ─── User subscriptions ─────────────────────────────────────────────────

export async function listUserActiveAddons(
  pool: Pool,
  userId: string,
): Promise<DanceAddonSubscription[]> {
  const r = await pool.query(
    `SELECT * FROM dance_addon_subscription
      WHERE user_id = $1 AND status IN ('trialing','active','comp')`,
    [userId],
  );
  return r.rows.map(mapSubRow);
}

/**
 * Resolver alle ekstra feature-flags fra aktive add-ons. Brukes av
 * useDancePlanGate til å unionere med plan.features.
 */
export async function resolveAddonFeatureFlags(
  pool: Pool,
  userId: string,
): Promise<string[]> {
  const r = await pool.query(
    `SELECT a.feature_flags
       FROM dance_addon_subscription s
       JOIN dance_addon a ON a.slug = s.addon_slug
      WHERE s.user_id = $1
        AND s.status IN ('trialing','active','comp')
        AND a.is_active = TRUE`,
    [userId],
  );
  const flags = new Set<string>();
  for (const row of r.rows) {
    const arr = asJson<string[]>(row.feature_flags, []);
    for (const f of arr) flags.add(f);
  }
  return Array.from(flags);
}

// ─── Trial-start (uten Stripe — gir tilgang i trial_days) ──────────────

export async function startTrialAddon(
  pool: Pool,
  userId: string,
  addonSlug: string,
): Promise<{ started: boolean; reason?: string; subscription?: DanceAddonSubscription }> {
  const addon = await getAddonBySlug(pool, addonSlug);
  if (!addon) return { started: false, reason: 'addon_not_found' };
  if (!addon.isActive) return { started: false, reason: 'addon_inactive' };
  if (addon.trialDays <= 0) return { started: false, reason: 'no_trial_available' };

  // Sjekk at brukeren ikke allerede har aktiv sub
  const existing = await pool.query(
    `SELECT 1 FROM dance_addon_subscription
      WHERE user_id = $1 AND addon_slug = $2 AND status IN ('trialing','active','comp')
      LIMIT 1`,
    [userId, addonSlug],
  );
  if (existing.rowCount) return { started: false, reason: 'already_active' };

  const trialEnd = new Date(Date.now() + addon.trialDays * 24 * 60 * 60 * 1000).toISOString();

  const r = await pool.query(
    `INSERT INTO dance_addon_subscription
       (user_id, addon_slug, billing_period, status, trial_end_at, current_period_end)
     VALUES ($1, $2, 'monthly', 'trialing', $3, $3)
     RETURNING *`,
    [userId, addonSlug, trialEnd],
  );
  return { started: true, subscription: mapSubRow(r.rows[0]) };
}

// ─── Comp-tilgang (admin-grant) ────────────────────────────────────────

export async function grantCompAddon(
  pool: Pool,
  input: { userId: string; addonSlug: string; expiresAt?: string; grantedByUserId: string; notes?: string },
): Promise<{ granted: boolean; reason?: string; subscription?: DanceAddonSubscription }> {
  const addon = await getAddonBySlug(pool, input.addonSlug);
  if (!addon) return { granted: false, reason: 'addon_not_found' };

  const r = await pool.query(
    `INSERT INTO dance_addon_subscription
       (user_id, addon_slug, billing_period, status, comp_granted_by_user_id,
        comp_expires_at, current_period_end, notes)
     VALUES ($1, $2, 'comp', 'comp', $3, $4, $4, $5)
     ON CONFLICT (user_id, addon_slug) WHERE status IN ('trialing','active','comp')
       DO UPDATE SET
         status = 'comp',
         billing_period = 'comp',
         comp_granted_by_user_id = EXCLUDED.comp_granted_by_user_id,
         comp_expires_at = EXCLUDED.comp_expires_at,
         current_period_end = EXCLUDED.current_period_end,
         notes = EXCLUDED.notes,
         updated_at = now()
     RETURNING *`,
    [input.userId, input.addonSlug, input.grantedByUserId, input.expiresAt ?? null, input.notes ?? null],
  );
  return { granted: true, subscription: mapSubRow(r.rows[0]) };
}

// ─── Cancel ─────────────────────────────────────────────────────────────

export async function cancelAddon(
  pool: Pool,
  userId: string,
  addonSlug: string,
): Promise<{ canceled: boolean; reason?: string }> {
  const r = await pool.query(
    `UPDATE dance_addon_subscription
        SET status = 'canceled',
            cancel_at_period_end = TRUE,
            updated_at = now()
      WHERE user_id = $1 AND addon_slug = $2 AND status IN ('trialing','active','comp')
      RETURNING id`,
    [userId, addonSlug],
  );
  if (!r.rowCount) return { canceled: false, reason: 'no_active_subscription' };
  return { canceled: true };
}
