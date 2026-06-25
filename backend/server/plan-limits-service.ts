/**
 * plan-limits-service.ts
 *
 * Sentral plan-gating. Brukes av:
 *   - customer-auto-onboard-routes.ts (sjekk grense før auto-onboard)
 *   - lead-portfolio-routes.ts (sjekk antall aktive kunder før create)
 *   - andre Pro-features (automation rules, pitch deck, custom fields)
 *
 * Returnerer en strukturert "gate-result" som callere kan oversette
 * til HTTP 402 m/ upsell-info.
 */

import type { Pool } from "pg";

export interface PlanLimits {
  plan_key: string;
  display_name: string;
  price_monthly_nok: number;
  max_active_customers: number | null;       // null = unlimited
  max_auto_onboards_per_month: number | null;
  max_playbooks_visible: number | null;
  max_team_members: number | null;
  has_automation_rules: boolean;
  has_custom_fields: boolean;
  has_pitch_deck_studio: boolean;
  has_white_label_portal: boolean;
  has_salgshierarki: boolean;
  audit_log_retention_days: number;
}

export interface PlanUsage {
  period_month: string;
  auto_onboards_used: number;
  customers_created: number;
  emails_sent: number;
  claude_calls: number;
}

export interface GateResult {
  allowed: boolean;
  reason?: string;
  current_plan: string;
  current_usage?: number;
  limit?: number | null;
  upgrade_to?: string;        // f.eks. 'solo_pro'
  upgrade_price_nok?: number;
  in_grace_period?: boolean;
  grace_expires_at?: string;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

const _cache = new Map<string, { value: PlanLimits; expires: number }>();
const CACHE_MS = 60_000;

export async function getPlanLimits(pool: Pool, planKey: string): Promise<PlanLimits | null> {
  const cached = _cache.get(planKey);
  if (cached && cached.expires > Date.now()) return cached.value;
  const r = await pool.query<PlanLimits>(
    `SELECT plan_key, display_name, price_monthly_nok,
            max_active_customers, max_auto_onboards_per_month,
            max_playbooks_visible, max_team_members,
            has_automation_rules, has_custom_fields,
            has_pitch_deck_studio, has_white_label_portal,
            has_salgshierarki, audit_log_retention_days
     FROM plan_limits WHERE plan_key = $1 AND is_active = TRUE`,
    [planKey],
  );
  if (r.rows.length === 0) return null;
  _cache.set(planKey, { value: r.rows[0], expires: Date.now() + CACHE_MS });
  return r.rows[0];
}

export async function getOrgPlan(pool: Pool, orgId: string): Promise<{
  plan_key: string;
  in_grace: boolean;
  grace_expires_at?: string;
  effective_plan_key: string;   // grace → tidligere plan; ellers samme
}> {
  const orgR = await pool.query<{ plan: string }>(
    `SELECT plan FROM organizations WHERE id = $1`, [orgId],
  );
  if (orgR.rows.length === 0) {
    return { plan_key: "solo_free", in_grace: false, effective_plan_key: "solo_free" };
  }
  const currentPlan = orgR.rows[0].plan;
  // Sjekk grace
  const graceR = await pool.query<{ former_plan_key: string; expires_at: string }>(
    `SELECT former_plan_key, expires_at FROM plan_grace
     WHERE organization_id = $1 AND expires_at > now()`,
    [orgId],
  );
  if (graceR.rows.length > 0) {
    return {
      plan_key: currentPlan,
      in_grace: true,
      grace_expires_at: graceR.rows[0].expires_at,
      effective_plan_key: graceR.rows[0].former_plan_key,
    };
  }
  return { plan_key: currentPlan, in_grace: false, effective_plan_key: currentPlan };
}

export async function getCurrentMonthUsage(pool: Pool, orgId: string): Promise<PlanUsage> {
  const r = await pool.query<PlanUsage>(
    `SELECT period_month::text, auto_onboards_used, customers_created,
            emails_sent, claude_calls
     FROM plan_usage
     WHERE organization_id = $1
       AND period_month = date_trunc('month', now())::date`,
    [orgId],
  );
  if (r.rows.length === 0) {
    return {
      period_month: new Date().toISOString().slice(0, 7) + "-01",
      auto_onboards_used: 0, customers_created: 0,
      emails_sent: 0, claude_calls: 0,
    };
  }
  return r.rows[0];
}

export async function getCustomerCount(pool: Pool, orgId: string): Promise<number> {
  // crm_customers har INGEN organization_id-kolonne — eierskap er per
  // owner_user_id. Vi teller alle kunder eid av medlemmer av denne org-en.
  // Tidligere query brukte `organization_id = $1` → 500-feil
  // "column \"organization_id\" does not exist" → iPad-pill «Plan
  // utilgjengelig».
  const r = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM crm_customers
       WHERE owner_user_id IN (
         SELECT user_id::text FROM organization_members WHERE organization_id = $1
       )
       AND archived_at IS NULL`,
    [orgId],
  );
  return parseInt(r.rows[0]?.c ?? "0", 10);
}

// ---------------------------------------------------------------------------
// Gating
// ---------------------------------------------------------------------------

/**
 * Sjekk om org kan utføre én auto-onboard akkurat nå.
 * Tar høyde for grace: hvis i grace, bruk former_plan_key som effektiv plan.
 */
export async function canAutoOnboard(pool: Pool, orgId: string): Promise<GateResult> {
  const orgPlan = await getOrgPlan(pool, orgId);
  const limits = await getPlanLimits(pool, orgPlan.effective_plan_key);
  if (!limits) {
    return { allowed: true, current_plan: orgPlan.plan_key, reason: "plan_not_found" };
  }
  if (limits.max_auto_onboards_per_month == null) {
    return { allowed: true, current_plan: orgPlan.plan_key };
  }
  const usage = await getCurrentMonthUsage(pool, orgId);
  if (usage.auto_onboards_used >= limits.max_auto_onboards_per_month) {
    const nextPlan = await getNextPlanUp(pool, orgPlan.effective_plan_key);
    return {
      allowed: false,
      reason: "auto_onboard_limit_reached",
      current_plan: orgPlan.plan_key,
      current_usage: usage.auto_onboards_used,
      limit: limits.max_auto_onboards_per_month,
      upgrade_to: nextPlan?.plan_key,
      upgrade_price_nok: nextPlan?.price_monthly_nok,
      in_grace_period: orgPlan.in_grace,
      grace_expires_at: orgPlan.grace_expires_at,
    };
  }
  return {
    allowed: true,
    current_plan: orgPlan.plan_key,
    current_usage: usage.auto_onboards_used,
    limit: limits.max_auto_onboards_per_month,
  };
}

/** Sjekk om org kan legge til en kunde til. */
export async function canCreateCustomer(pool: Pool, orgId: string): Promise<GateResult> {
  const orgPlan = await getOrgPlan(pool, orgId);
  const limits = await getPlanLimits(pool, orgPlan.effective_plan_key);
  if (!limits || limits.max_active_customers == null) {
    return { allowed: true, current_plan: orgPlan.plan_key };
  }
  const count = await getCustomerCount(pool, orgId);
  if (count >= limits.max_active_customers) {
    const nextPlan = await getNextPlanUp(pool, orgPlan.effective_plan_key);
    return {
      allowed: false,
      reason: "customer_limit_reached",
      current_plan: orgPlan.plan_key,
      current_usage: count,
      limit: limits.max_active_customers,
      upgrade_to: nextPlan?.plan_key,
      upgrade_price_nok: nextPlan?.price_monthly_nok,
      in_grace_period: orgPlan.in_grace,
      grace_expires_at: orgPlan.grace_expires_at,
    };
  }
  return { allowed: true, current_plan: orgPlan.plan_key, current_usage: count, limit: limits.max_active_customers };
}

/** Sjekk om org har en Pro-feature. */
export async function hasFeature(
  pool: Pool, orgId: string,
  feature: "automation_rules" | "custom_fields" | "pitch_deck_studio" | "white_label_portal" | "salgshierarki",
): Promise<GateResult> {
  const orgPlan = await getOrgPlan(pool, orgId);
  const limits = await getPlanLimits(pool, orgPlan.effective_plan_key);
  if (!limits) return { allowed: false, current_plan: orgPlan.plan_key };
  const map = {
    automation_rules:     limits.has_automation_rules,
    custom_fields:        limits.has_custom_fields,
    pitch_deck_studio:    limits.has_pitch_deck_studio,
    white_label_portal:   limits.has_white_label_portal,
    salgshierarki:        limits.has_salgshierarki,
  };
  if (map[feature]) {
    return { allowed: true, current_plan: orgPlan.plan_key };
  }
  const nextPlan = await getNextPlanUp(pool, orgPlan.effective_plan_key);
  return {
    allowed: false,
    reason: `feature_not_in_plan:${feature}`,
    current_plan: orgPlan.plan_key,
    upgrade_to: nextPlan?.plan_key,
    upgrade_price_nok: nextPlan?.price_monthly_nok,
    in_grace_period: orgPlan.in_grace,
    grace_expires_at: orgPlan.grace_expires_at,
  };
}

async function getNextPlanUp(pool: Pool, currentKey: string): Promise<PlanLimits | null> {
  const r = await pool.query<PlanLimits>(
    `SELECT plan_key, display_name, price_monthly_nok,
            max_active_customers, max_auto_onboards_per_month,
            max_playbooks_visible, max_team_members,
            has_automation_rules, has_custom_fields,
            has_pitch_deck_studio, has_white_label_portal,
            has_salgshierarki, audit_log_retention_days
     FROM plan_limits
     WHERE display_order > (
       SELECT display_order FROM plan_limits WHERE plan_key = $1
     )
       AND is_active = TRUE
     ORDER BY display_order ASC
     LIMIT 1`,
    [currentKey],
  );
  return r.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Usage-incrementer (kalles fra route etter vellykket handling)
// ---------------------------------------------------------------------------

export async function incrementUsage(
  pool: Pool, orgId: string,
  counter: "auto_onboards" | "customers_created" | "emails_sent" | "claude_calls",
  by = 1,
): Promise<void> {
  const colMap = {
    auto_onboards:      "auto_onboards_used",
    customers_created:  "customers_created",
    emails_sent:        "emails_sent",
    claude_calls:       "claude_calls",
  };
  const col = colMap[counter];
  // Idempotent UPSERT per (org, måned)
  await pool.query(
    `INSERT INTO plan_usage (organization_id, period_month, ${col})
     VALUES ($1, date_trunc('month', now())::date, $2)
     ON CONFLICT (organization_id, period_month) DO UPDATE
       SET ${col}    = plan_usage.${col} + EXCLUDED.${col},
           updated_at = now()`,
    [orgId, by],
  );
}

// ---------------------------------------------------------------------------
// Plan summary (for in-app PlanUsageBar)
// ---------------------------------------------------------------------------

export async function getPlanSummary(pool: Pool, orgId: string): Promise<{
  plan_key: string;
  display_name: string;
  in_grace: boolean;
  grace_expires_at?: string;
  limits: PlanLimits;
  usage: {
    customers_active: number;
    auto_onboards_this_month: number;
  };
  pct: {
    customers: number;     // 0-100
    auto_onboards: number; // 0-100
  };
}> {
  const orgPlan = await getOrgPlan(pool, orgId);
  const limits = await getPlanLimits(pool, orgPlan.effective_plan_key);
  if (!limits) throw new Error(`Plan not found: ${orgPlan.effective_plan_key}`);
  const monthUsage = await getCurrentMonthUsage(pool, orgId);
  const customerCount = await getCustomerCount(pool, orgId);
  const pctOf = (used: number, max: number | null) =>
    max == null ? 0 : Math.min(100, Math.round((used / max) * 100));
  return {
    plan_key: orgPlan.plan_key,
    display_name: limits.display_name,
    in_grace: orgPlan.in_grace,
    grace_expires_at: orgPlan.grace_expires_at,
    limits,
    usage: {
      customers_active: customerCount,
      auto_onboards_this_month: monthUsage.auto_onboards_used,
    },
    pct: {
      customers: pctOf(customerCount, limits.max_active_customers),
      auto_onboards: pctOf(monthUsage.auto_onboards_used, limits.max_auto_onboards_per_month),
    },
  };
}
