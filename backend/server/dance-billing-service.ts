/**
 * Dance billing service — plan-katalog, abonnement, tester-invites,
 * admin-settings, og Stripe-integrasjon.
 *
 * Plan-config er DB-drevet så admin kan endre priser/features uten
 * deploy. Stripe-prisene oppdateres separat i Stripe-dashbordet og
 * kobles til via stripe_*_price_id-kolonner.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import Stripe from 'stripe';

// ─── Helpers ────────────────────────────────────────────────────────────

function isoTs(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}
function isoTsOrNull(value: unknown): string | null {
  if (value == null) return null;
  return isoTs(value);
}
function asNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return fallback;
}

function generateInviteToken(): string {
  // 32 bytes → base64url ≈ 43 chars. Slug-safe.
  return randomBytes(24).toString('base64url');
}

// ─── Stripe singleton ───────────────────────────────────────────────────

let stripeClient: Stripe | null = null;
export function getStripe(): Stripe | null {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY
    || process.env.CREATORHUB_STRIPE_SECRET_KEY
    || process.env.STRIPE_API_KEY;
  if (!key) return null;
  stripeClient = new Stripe(key);
  return stripeClient;
}

// ═══════════════════════════════════════════════════════════════════════
//  PLANS
// ═══════════════════════════════════════════════════════════════════════

export type PlanPersona = 'dance_freelance' | 'dance_studio' | 'both';

export interface DancePlan {
  slug: string;
  name: string;
  persona: PlanPersona;
  description: string | null;
  monthlyPriceKr: number | null;
  yearlyPriceKr: number | null;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  features: string[];
  limits: Record<string, unknown>;
  trialDays: number;
  isActive: boolean;
  isFeatured: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function mapPlanRow(row: Record<string, unknown>): DancePlan {
  return {
    slug: String(row.slug),
    name: String(row.name),
    persona: String(row.persona) as PlanPersona,
    description: row.description == null ? null : String(row.description),
    monthlyPriceKr: asNumberOrNull(row.monthly_price_kr),
    yearlyPriceKr: asNumberOrNull(row.yearly_price_kr),
    stripeMonthlyPriceId: row.stripe_monthly_price_id == null ? null : String(row.stripe_monthly_price_id),
    stripeYearlyPriceId: row.stripe_yearly_price_id == null ? null : String(row.stripe_yearly_price_id),
    features: asStringArray(asJson(row.features, [])),
    limits: asJson(row.limits, {}),
    trialDays: Number(row.trial_days) || 0,
    isActive: row.is_active === true,
    isFeatured: row.is_featured === true,
    displayOrder: Number(row.display_order) || 0,
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export interface PlanInput {
  slug: string;
  name: string;
  persona?: PlanPersona;
  description?: string | null;
  monthlyPriceKr?: number | null;
  yearlyPriceKr?: number | null;
  stripeMonthlyPriceId?: string | null;
  stripeYearlyPriceId?: string | null;
  features?: string[];
  limits?: Record<string, unknown>;
  trialDays?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  displayOrder?: number;
}
export type PlanPatch = Partial<Omit<PlanInput, 'slug'>>;

export async function listPlans(
  pool: Pool,
  options: { activeOnly?: boolean; persona?: PlanPersona | null } = {},
): Promise<DancePlan[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (options.activeOnly) conditions.push('is_active = TRUE');
  if (options.persona && options.persona !== 'both') {
    params.push(options.persona);
    conditions.push(`(persona = $${params.length} OR persona = 'both')`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM dance_plan ${where} ORDER BY display_order ASC, slug ASC`,
    params,
  );
  return rows.map((r) => mapPlanRow(r));
}

export async function getPlan(pool: Pool, slug: string): Promise<DancePlan | null> {
  const { rows } = await pool.query(`SELECT * FROM dance_plan WHERE slug = $1`, [slug]);
  return rows.length ? mapPlanRow(rows[0]) : null;
}

export async function createPlan(pool: Pool, input: PlanInput): Promise<DancePlan> {
  const { rows } = await pool.query(
    `INSERT INTO dance_plan (
       slug, name, persona, description, monthly_price_kr, yearly_price_kr,
       stripe_monthly_price_id, stripe_yearly_price_id, features, limits,
       trial_days, is_active, is_featured, display_order
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      input.slug, input.name, input.persona ?? 'both',
      input.description ?? null,
      input.monthlyPriceKr ?? null, input.yearlyPriceKr ?? null,
      input.stripeMonthlyPriceId ?? null, input.stripeYearlyPriceId ?? null,
      JSON.stringify(input.features ?? []),
      JSON.stringify(input.limits ?? {}),
      input.trialDays ?? 14,
      input.isActive !== false,
      input.isFeatured === true,
      input.displayOrder ?? 0,
    ],
  );
  return mapPlanRow(rows[0]);
}

export async function patchPlan(pool: Pool, slug: string, patch: PlanPatch): Promise<DancePlan | null> {
  const sets: string[] = [];
  const params: unknown[] = [slug];
  const push = (col: string, v: unknown): void => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.name !== undefined) push('name', patch.name);
  if (patch.persona !== undefined) push('persona', patch.persona);
  if (patch.description !== undefined) push('description', patch.description);
  if (patch.monthlyPriceKr !== undefined) push('monthly_price_kr', patch.monthlyPriceKr);
  if (patch.yearlyPriceKr !== undefined) push('yearly_price_kr', patch.yearlyPriceKr);
  if (patch.stripeMonthlyPriceId !== undefined) push('stripe_monthly_price_id', patch.stripeMonthlyPriceId);
  if (patch.stripeYearlyPriceId !== undefined) push('stripe_yearly_price_id', patch.stripeYearlyPriceId);
  if (patch.features !== undefined) push('features', JSON.stringify(patch.features));
  if (patch.limits !== undefined) push('limits', JSON.stringify(patch.limits));
  if (patch.trialDays !== undefined) push('trial_days', patch.trialDays);
  if (patch.isActive !== undefined) push('is_active', patch.isActive);
  if (patch.isFeatured !== undefined) push('is_featured', patch.isFeatured);
  if (patch.displayOrder !== undefined) push('display_order', patch.displayOrder);
  if (sets.length === 0) {
    return getPlan(pool, slug);
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE dance_plan SET ${sets.join(', ')} WHERE slug = $1 RETURNING *`,
    params,
  );
  return rows.length ? mapPlanRow(rows[0]) : null;
}

export async function deletePlan(pool: Pool, slug: string): Promise<boolean> {
  // Avvis hvis det finnes aktive abonnementer på planen.
  const ref = await pool.query(`SELECT 1 FROM dance_subscription WHERE plan_slug = $1 LIMIT 1`, [slug]);
  if (ref.rowCount && ref.rowCount > 0) {
    throw new Error('Kan ikke slette plan med aktive abonnementer — sett is_active=false istedet.');
  }
  const { rowCount } = await pool.query(`DELETE FROM dance_plan WHERE slug = $1`, [slug]);
  return (rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'comp';
export type BillingPeriod = 'monthly' | 'yearly' | 'tester' | 'comp';

export interface DanceSubscription {
  userId: string;
  planSlug: string;
  billingPeriod: BillingPeriod;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  trialEndAt: string | null;
  cancelAtPeriodEnd: boolean;
  testerInviteToken: string | null;
  compGrantedByUserId: string | null;
  compExpiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapSubscriptionRow(row: Record<string, unknown>): DanceSubscription {
  return {
    userId: String(row.user_id),
    planSlug: String(row.plan_slug),
    billingPeriod: String(row.billing_period) as BillingPeriod,
    status: String(row.status) as SubscriptionStatus,
    stripeCustomerId: row.stripe_customer_id == null ? null : String(row.stripe_customer_id),
    stripeSubscriptionId: row.stripe_subscription_id == null ? null : String(row.stripe_subscription_id),
    currentPeriodEnd: isoTsOrNull(row.current_period_end),
    trialEndAt: isoTsOrNull(row.trial_end_at),
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    testerInviteToken: row.tester_invite_token == null ? null : String(row.tester_invite_token),
    compGrantedByUserId: row.comp_granted_by_user_id == null ? null : String(row.comp_granted_by_user_id),
    compExpiresAt: isoTsOrNull(row.comp_expires_at),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export async function getSubscription(
  pool: Pool,
  userId: string,
): Promise<DanceSubscription | null> {
  const { rows } = await pool.query(
    `SELECT * FROM dance_subscription WHERE user_id = $1`,
    [userId],
  );
  return rows.length ? mapSubscriptionRow(rows[0]) : null;
}

export async function upsertSubscription(
  pool: Pool,
  userId: string,
  patch: Partial<Omit<DanceSubscription, 'userId' | 'createdAt' | 'updatedAt'>> & { planSlug: string },
): Promise<DanceSubscription> {
  const existing = await getSubscription(pool, userId);
  if (existing) {
    const sets: string[] = [];
    const params: unknown[] = [userId];
    const push = (col: string, v: unknown): void => { params.push(v); sets.push(`${col} = $${params.length}`); };
    push('plan_slug', patch.planSlug);
    if (patch.billingPeriod !== undefined) push('billing_period', patch.billingPeriod);
    if (patch.status !== undefined) push('status', patch.status);
    if (patch.stripeCustomerId !== undefined) push('stripe_customer_id', patch.stripeCustomerId);
    if (patch.stripeSubscriptionId !== undefined) push('stripe_subscription_id', patch.stripeSubscriptionId);
    if (patch.currentPeriodEnd !== undefined) push('current_period_end', patch.currentPeriodEnd);
    if (patch.trialEndAt !== undefined) push('trial_end_at', patch.trialEndAt);
    if (patch.cancelAtPeriodEnd !== undefined) push('cancel_at_period_end', patch.cancelAtPeriodEnd);
    if (patch.testerInviteToken !== undefined) push('tester_invite_token', patch.testerInviteToken);
    if (patch.compGrantedByUserId !== undefined) push('comp_granted_by_user_id', patch.compGrantedByUserId);
    if (patch.compExpiresAt !== undefined) push('comp_expires_at', patch.compExpiresAt);
    if (patch.notes !== undefined) push('notes', patch.notes);
    sets.push('updated_at = now()');
    const { rows } = await pool.query(
      `UPDATE dance_subscription SET ${sets.join(', ')} WHERE user_id = $1 RETURNING *`,
      params,
    );
    return mapSubscriptionRow(rows[0]);
  }
  const { rows } = await pool.query(
    `INSERT INTO dance_subscription (
       user_id, plan_slug, billing_period, status,
       stripe_customer_id, stripe_subscription_id,
       current_period_end, trial_end_at, cancel_at_period_end,
       tester_invite_token, comp_granted_by_user_id, comp_expires_at, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      userId, patch.planSlug,
      patch.billingPeriod ?? 'monthly',
      patch.status ?? 'trialing',
      patch.stripeCustomerId ?? null,
      patch.stripeSubscriptionId ?? null,
      patch.currentPeriodEnd ?? null,
      patch.trialEndAt ?? null,
      patch.cancelAtPeriodEnd === true,
      patch.testerInviteToken ?? null,
      patch.compGrantedByUserId ?? null,
      patch.compExpiresAt ?? null,
      patch.notes ?? null,
    ],
  );
  return mapSubscriptionRow(rows[0]);
}

export async function listAllSubscriptions(pool: Pool): Promise<DanceSubscription[]> {
  const { rows } = await pool.query(
    `SELECT * FROM dance_subscription ORDER BY updated_at DESC LIMIT 1000`,
  );
  return rows.map((r) => mapSubscriptionRow(r));
}

// ═══════════════════════════════════════════════════════════════════════
//  TESTER INVITES
// ═══════════════════════════════════════════════════════════════════════

export interface TesterInvite {
  token: string;
  invitedByUserId: string;
  invitedEmail: string | null;
  invitedName: string | null;
  planSlug: string;
  trialDays: number;
  maxUses: number;
  usedCount: number;
  validUntil: string | null;
  acceptedAt: string | null;
  acceptedUserId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapInviteRow(row: Record<string, unknown>): TesterInvite {
  return {
    token: String(row.token),
    invitedByUserId: String(row.invited_by_user_id),
    invitedEmail: row.invited_email == null ? null : String(row.invited_email),
    invitedName: row.invited_name == null ? null : String(row.invited_name),
    planSlug: String(row.plan_slug),
    trialDays: Number(row.trial_days) || 90,
    maxUses: Number(row.max_uses) || 1,
    usedCount: Number(row.used_count) || 0,
    validUntil: isoTsOrNull(row.valid_until),
    acceptedAt: isoTsOrNull(row.accepted_at),
    acceptedUserId: row.accepted_user_id == null ? null : String(row.accepted_user_id),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export interface InviteInput {
  invitedEmail?: string | null;
  invitedName?: string | null;
  planSlug: string;
  trialDays?: number;
  maxUses?: number;
  validUntil?: string | null;
  notes?: string | null;
}

export async function createInvite(
  pool: Pool,
  invitedByUserId: string,
  input: InviteInput,
): Promise<TesterInvite> {
  const token = generateInviteToken();
  const { rows } = await pool.query(
    `INSERT INTO dance_tester_invite (
       token, invited_by_user_id, invited_email, invited_name,
       plan_slug, trial_days, max_uses, valid_until, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      token, invitedByUserId,
      input.invitedEmail ?? null, input.invitedName ?? null,
      input.planSlug,
      input.trialDays ?? 90,
      input.maxUses ?? 1,
      input.validUntil ?? null,
      input.notes ?? null,
    ],
  );
  return mapInviteRow(rows[0]);
}

export async function listInvites(pool: Pool): Promise<TesterInvite[]> {
  const { rows } = await pool.query(
    `SELECT * FROM dance_tester_invite ORDER BY created_at DESC LIMIT 500`,
  );
  return rows.map((r) => mapInviteRow(r));
}

export async function getInvite(pool: Pool, token: string): Promise<TesterInvite | null> {
  const { rows } = await pool.query(
    `SELECT * FROM dance_tester_invite WHERE token = $1`,
    [token],
  );
  return rows.length ? mapInviteRow(rows[0]) : null;
}

export async function patchInvite(
  pool: Pool,
  token: string,
  patch: Partial<InviteInput>,
): Promise<TesterInvite | null> {
  const sets: string[] = [];
  const params: unknown[] = [token];
  const push = (col: string, v: unknown): void => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.invitedEmail !== undefined) push('invited_email', patch.invitedEmail);
  if (patch.invitedName !== undefined) push('invited_name', patch.invitedName);
  if (patch.planSlug !== undefined) push('plan_slug', patch.planSlug);
  if (patch.trialDays !== undefined) push('trial_days', patch.trialDays);
  if (patch.maxUses !== undefined) push('max_uses', patch.maxUses);
  if (patch.validUntil !== undefined) push('valid_until', patch.validUntil);
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (sets.length === 0) return getInvite(pool, token);
  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE dance_tester_invite SET ${sets.join(', ')} WHERE token = $1 RETURNING *`,
    params,
  );
  return rows.length ? mapInviteRow(rows[0]) : null;
}

export async function deleteInvite(pool: Pool, token: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM dance_tester_invite WHERE token = $1`, [token]);
  return (rowCount ?? 0) > 0;
}

/**
 * Accept invite — gjør brukeren til "tester" med comp-tilgang i N dager.
 * Returnerer subscription-recorden eller en error-string.
 */
export async function acceptInvite(
  pool: Pool,
  token: string,
  userId: string,
): Promise<{ ok: true; subscription: DanceSubscription } | { ok: false; error: string }> {
  const invite = await getInvite(pool, token);
  if (!invite) return { ok: false, error: 'invite_not_found' };
  if (invite.validUntil && new Date(invite.validUntil) < new Date()) {
    return { ok: false, error: 'invite_expired' };
  }
  if (invite.usedCount >= invite.maxUses) {
    return { ok: false, error: 'invite_used_up' };
  }
  const expiresAt = new Date(Date.now() + invite.trialDays * 24 * 60 * 60 * 1000).toISOString();
  const sub = await upsertSubscription(pool, userId, {
    planSlug: invite.planSlug,
    billingPeriod: 'tester',
    status: 'comp',
    testerInviteToken: token,
    compExpiresAt: expiresAt,
    currentPeriodEnd: expiresAt,
  });
  await pool.query(
    `UPDATE dance_tester_invite
     SET used_count = used_count + 1,
         accepted_at = COALESCE(accepted_at, now()),
         accepted_user_id = COALESCE(accepted_user_id, $2),
         updated_at = now()
     WHERE token = $1`,
    [token, userId],
  );
  return { ok: true, subscription: sub };
}

// ═══════════════════════════════════════════════════════════════════════
//  ADMIN SETTINGS
// ═══════════════════════════════════════════════════════════════════════

export interface AdminSetting {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updatedByUserId: string | null;
  updatedAt: string;
}

function mapSettingRow(row: Record<string, unknown>): AdminSetting {
  return {
    key: String(row.key),
    value: asJson(row.value, {}),
    description: row.description == null ? null : String(row.description),
    updatedByUserId: row.updated_by_user_id == null ? null : String(row.updated_by_user_id),
    updatedAt: isoTs(row.updated_at),
  };
}

export async function listSettings(pool: Pool): Promise<AdminSetting[]> {
  const { rows } = await pool.query(`SELECT * FROM dance_admin_settings ORDER BY key ASC`);
  return rows.map((r) => mapSettingRow(r));
}

export async function getSetting(pool: Pool, key: string): Promise<AdminSetting | null> {
  const { rows } = await pool.query(`SELECT * FROM dance_admin_settings WHERE key = $1`, [key]);
  return rows.length ? mapSettingRow(rows[0]) : null;
}

export async function upsertSetting(
  pool: Pool,
  key: string,
  value: Record<string, unknown>,
  updatedByUserId: string,
  description?: string | null,
): Promise<AdminSetting> {
  const { rows } = await pool.query(
    `INSERT INTO dance_admin_settings (key, value, description, updated_by_user_id, updated_at)
     VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           description = COALESCE(EXCLUDED.description, dance_admin_settings.description),
           updated_by_user_id = EXCLUDED.updated_by_user_id,
           updated_at = now()
     RETURNING *`,
    [key, JSON.stringify(value), description ?? null, updatedByUserId],
  );
  return mapSettingRow(rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════
//  STRIPE CHECKOUT + WEBHOOK
// ═══════════════════════════════════════════════════════════════════════

export type StripeCheckoutResult =
  | { ok: true; sessionUrl: string }
  | { ok: false; error: 'stripe_not_configured' | 'plan_not_found' | 'plan_inactive' | 'price_not_configured' | 'checkout_failed'; detail?: string };

export async function createCheckoutSession(
  pool: Pool,
  userId: string,
  userEmail: string | null,
  planSlug: string,
  billingPeriod: 'monthly' | 'yearly',
  successUrl: string,
  cancelUrl: string,
): Promise<StripeCheckoutResult> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: 'stripe_not_configured' };
  const plan = await getPlan(pool, planSlug);
  if (!plan) return { ok: false, error: 'plan_not_found' };
  if (!plan.isActive) return { ok: false, error: 'plan_inactive' };
  const priceId = billingPeriod === 'yearly' ? plan.stripeYearlyPriceId : plan.stripeMonthlyPriceId;
  if (!priceId) return { ok: false, error: 'price_not_configured' };

  // Reuse stripe customer if vi har det fra før.
  const existing = await getSubscription(pool, userId);
  let customerId = existing?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail ?? undefined,
      metadata: { creatorhubUserId: userId },
    });
    customerId = customer.id;
    await upsertSubscription(pool, userId, {
      planSlug,
      stripeCustomerId: customerId,
      status: 'incomplete',
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: plan.trialDays > 0 ? plan.trialDays : undefined,
        metadata: {
          creatorhubUserId: userId,
          planSlug,
          billingPeriod,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    });
    return { ok: true, sessionUrl: session.url ?? '' };
  } catch (err) {
    return { ok: false, error: 'checkout_failed', detail: String(err) };
  }
}

export async function createCustomerPortalSession(
  pool: Pool,
  userId: string,
  returnUrl: string,
): Promise<{ ok: true; portalUrl: string } | { ok: false; error: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: 'stripe_not_configured' };
  const sub = await getSubscription(pool, userId);
  if (!sub?.stripeCustomerId) return { ok: false, error: 'no_customer' };
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl,
    });
    return { ok: true, portalUrl: session.url };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Stripe webhook handler. Tar imot rå body + signature header,
 * verifiserer signaturen, og oppdaterer dance_subscription deretter.
 */
export async function handleStripeWebhook(
  pool: Pool,
  rawBody: Buffer,
  signature: string,
): Promise<{ received: true } | { received: false; error: string }> {
  const stripe = getStripe();
  if (!stripe) return { received: false, error: 'stripe_not_configured' };
  const webhookSecret = process.env.DANCE_STRIPE_WEBHOOK_SECRET
    || process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return { received: false, error: 'webhook_secret_not_configured' };

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return { received: false, error: `signature_verification_failed: ${String(err)}` };
  }

  // Stripe v19: current_period_end is on items.data[i] istedenfor toppnivå
  // for å støtte multi-item subs. Vi tar første item-perioden som
  // sub-perioden siden vi har 1-item subs.
  const subPeriodEnd = (sub: Stripe.Subscription): number | null => {
    const item = sub.items?.data?.[0] as { current_period_end?: number } | undefined;
    if (item && typeof item.current_period_end === 'number') return item.current_period_end;
    return null;
  };

  const handle = async (sub: Stripe.Subscription): Promise<void> => {
    const userId = (sub.metadata?.creatorhubUserId as string | undefined) ?? null;
    if (!userId) return;
    const planSlug = (sub.metadata?.planSlug as string | undefined)
      ?? (sub.items?.data?.[0]?.price?.metadata?.planSlug as string | undefined)
      ?? null;
    if (!planSlug) return;
    const billingPeriod = (sub.metadata?.billingPeriod as 'monthly' | 'yearly' | undefined) ?? 'monthly';
    let status: SubscriptionStatus = 'active';
    if (sub.status === 'trialing') status = 'trialing';
    else if (sub.status === 'past_due') status = 'past_due';
    else if (sub.status === 'canceled' || sub.status === 'unpaid') status = 'canceled';
    else if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') status = 'incomplete';
    const periodEnd = subPeriodEnd(sub);
    await upsertSubscription(pool, userId, {
      planSlug,
      billingPeriod,
      status,
      stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      trialEndAt: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    });

    // Auto-attach storage-overage-meter for Pro/Premium/Enterprise.
    // Idempotent: hopper over hvis allerede attachet, eller hvis planen
    // ikke trenger overage. Trygt å kalle på hver subscription-event.
    if (status === 'active' || status === 'trialing' || status === 'past_due') {
      try {
        const { ensureStorageMeterAttached } = await import('./storage-quota-service.js');
        const meterRes = await ensureStorageMeterAttached(
          pool,
          userId,
          planSlug,
          sub.id,
        );
        if (meterRes.attached) {
          console.log(
            `[storage-meter] auto-attached for user ${userId} sub ${sub.id} → item ${meterRes.itemId}`,
          );
        } else if (
          meterRes.reason !== 'plan_does_not_need_overage' &&
          meterRes.reason !== 'overage_price_not_configured'
        ) {
          // Bare logg de "uventede" no-ops
          console.warn(
            `[storage-meter] not attached for user ${userId}: ${meterRes.reason}`,
          );
        }
      } catch (err) {
        console.error('[storage-meter] auto-attach threw:', err);
      }
    }
  };

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await handle(event.data.object as Stripe.Subscription);
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        // Stripe v19: invoice.subscription er flyttet til
        // invoice.parent.subscription_details.subscription. Vi henter sub-id-en
        // forsiktig og slår opp full sub.
        const inv = event.data.object as Stripe.Invoice;
        const parent = (inv as { parent?: { subscription_details?: { subscription?: string | { id: string } } } }).parent;
        const subRef = parent?.subscription_details?.subscription;
        if (subRef) {
          const subId = typeof subRef === 'string' ? subRef : subRef.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await handle(sub);
        }
        break;
      }
      default:
        break;
    }
    return { received: true };
  } catch (err) {
    return { received: false, error: `handler_failed: ${String(err)}` };
  }
}
