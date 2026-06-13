/**
 * customer-success-service.ts
 *
 * Wave M2 — Customer Success Manager.
 *
 * Beregner health-score per kunde, listere active customers, henter
 * renewal-pipeline + interactions-timeline.
 *
 * Health-score: 0-100 fra 4 subscores:
 *   - login_score (0-25): hvor ofte kunden faktisk bruker produktet
 *   - feature_score (0-25): adopsjons-bredde (antall ulike features brukt)
 *   - billing_score (0-25): Stripe-helse (active vs past_due vs canceled)
 *   - engagement_score (0-25): aktive prosjekter siste 30 dager
 *
 * Tiers: 80-100=green, 50-79=yellow, 0-49=red
 *
 * For en solo-CSM (Daniel) er det ikke ML-modell — det er heuristikk
 * du kan tune. Senere kan vi koble på Claude for prediksjon.
 */

import type { Pool } from "pg";

export interface CustomerHealth {
  userId: string;
  email: string;
  displayName: string | null;
  businessName: string | null;
  computedAt: string;
  overallScore: number;
  tier: 'green' | 'yellow' | 'red';
  loginScore: number;
  featureScore: number;
  billingScore: number;
  engagementScore: number;
  signals: {
    daysSinceLogin: number | null;
    activeProjects30d: number;
    featuresUsed30d: number;
    stripeStatus: string | null;
    daysToRenewal: number | null;
  };
  aiSummary: string | null;
  aiNextAction: string | null;
  previousScore?: number | null;
}

export interface CustomerInteraction {
  id: string;
  userId: string;
  loggedByUserId: string | null;
  interactionType: string;
  subject: string | null;
  body: string | null;
  sentiment: string | null;
  followUpAt: string | null;
  followUpCompleted: boolean;
  attendees: unknown[];
  meetingUrl: string | null;
  expansionValueNok: number | null;
  churnRiskLevel: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface RenewalItem {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  businessName: string | null;
  renewalAt: string;
  daysUntilRenewal: number;
  currentPlanName: string | null;
  currentArpuNok: number | null;
  renewalStatus: string;
  expansionOpportunityNok: number | null;
  lastOutreachAt: string | null;
  notes: string | null;
  healthTier: 'green' | 'yellow' | 'red' | null;
  healthScore: number | null;
}

// ─────────────────────────────────────────────────────────────────────
// Health-score-beregning
// ─────────────────────────────────────────────────────────────────────

interface Signals {
  daysSinceLogin: number | null;
  activeProjects30d: number;
  featuresUsed30d: number;
  stripeStatus: string | null;
  daysToRenewal: number | null;
}

function scoreLogin(daysSinceLogin: number | null): number {
  if (daysSinceLogin === null) return 5;                     // Aldri logget inn = svak signal
  if (daysSinceLogin <= 1) return 25;
  if (daysSinceLogin <= 3) return 22;
  if (daysSinceLogin <= 7) return 18;
  if (daysSinceLogin <= 14) return 12;
  if (daysSinceLogin <= 30) return 6;
  return 0;
}

function scoreFeatures(featuresUsed30d: number): number {
  // Adopsjons-bredde: hvor mange ulike Role Room-features brukt
  if (featuresUsed30d >= 6) return 25;
  if (featuresUsed30d >= 4) return 20;
  if (featuresUsed30d >= 3) return 15;
  if (featuresUsed30d >= 2) return 10;
  if (featuresUsed30d >= 1) return 5;
  return 0;
}

function scoreBilling(stripeStatus: string | null): number {
  switch (stripeStatus) {
    case 'active': return 25;
    case 'trialing': return 22;
    case 'past_due': return 8;
    case 'unpaid': return 4;
    case 'paused': return 12;
    case 'canceled': return 0;
    case null: case undefined: return 15;                     // Ingen Stripe = sannsynligvis enterprise eller free
    default: return 18;
  }
}

function scoreEngagement(activeProjects30d: number): number {
  if (activeProjects30d >= 5) return 25;
  if (activeProjects30d >= 3) return 20;
  if (activeProjects30d >= 2) return 15;
  if (activeProjects30d >= 1) return 10;
  return 0;
}

function tierFor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

/** Hent signaler for én kunde — brukes av snapshot-cron og live-fetch. */
async function fetchSignalsForUser(pool: Pool, userId: string): Promise<Signals> {
  // Login + subscription fra users-tabellen
  const u = await pool.query<{
    last_login_at: Date | null;
    subscription: { status?: string; current_period_end?: string | number } | null;
  }>(
    `SELECT last_login_at, subscription FROM users WHERE id = $1`,
    [userId],
  );
  const row = u.rows[0];
  if (!row) {
    return {
      daysSinceLogin: null, activeProjects30d: 0, featuresUsed30d: 0,
      stripeStatus: null, daysToRenewal: null,
    };
  }

  const daysSinceLogin = row.last_login_at
    ? Math.floor((Date.now() - new Date(row.last_login_at).getTime()) / 86400000)
    : null;

  // Active casting_projects siste 30d (best-effort hvis tabell finnes)
  let activeProjects30d = 0;
  try {
    const p = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM casting_projects
       WHERE created_by = $1
         AND (updated_at >= NOW() - INTERVAL '30 days'
              OR created_at >= NOW() - INTERVAL '30 days')`,
      [userId],
    );
    activeProjects30d = p.rows[0]?.n ?? 0;
  } catch {
    // tabell finnes ikke for noen miljøer — best-effort
  }

  // Features used: count distinct (kind/source) the user has touched recently.
  // Best-effort: count rows in role_room_user_files siste 30d som proxy.
  let featuresUsed30d = 0;
  try {
    const f = await pool.query<{ n: number }>(
      `SELECT COUNT(DISTINCT source_module)::int AS n FROM role_room_user_files
       WHERE user_id = $1 AND deleted_at IS NULL
         AND uploaded_at >= NOW() - INTERVAL '30 days'`,
      [userId],
    );
    featuresUsed30d = f.rows[0]?.n ?? 0;
  } catch {
    // tabellen finnes ikke ennå — la som 0
  }

  const stripeStatus = row.subscription?.status ?? null;
  const renewalEpoch = row.subscription?.current_period_end
    ? typeof row.subscription.current_period_end === 'number'
      ? row.subscription.current_period_end * 1000
      : new Date(row.subscription.current_period_end).getTime()
    : null;
  const daysToRenewal = renewalEpoch
    ? Math.floor((renewalEpoch - Date.now()) / 86400000)
    : null;

  return { daysSinceLogin, activeProjects30d, featuresUsed30d, stripeStatus, daysToRenewal };
}

/** Beregn health for en bruker uten å lagre. */
export async function computeHealthForUser(
  pool: Pool, userId: string,
): Promise<{ overallScore: number; tier: 'green' | 'yellow' | 'red'; subscores: { login: number; feature: number; billing: number; engagement: number }; signals: Signals }> {
  const signals = await fetchSignalsForUser(pool, userId);
  const login = scoreLogin(signals.daysSinceLogin);
  const feature = scoreFeatures(signals.featuresUsed30d);
  const billing = scoreBilling(signals.stripeStatus);
  const engagement = scoreEngagement(signals.activeProjects30d);
  const overallScore = login + feature + billing + engagement;
  return {
    overallScore,
    tier: tierFor(overallScore),
    subscores: { login, feature, billing, engagement },
    signals,
  };
}

/** Lagre snapshot (kalles fra cron-job). */
export async function captureHealthSnapshot(
  pool: Pool, userId: string,
): Promise<{ id: string; overallScore: number; tier: string }> {
  const h = await computeHealthForUser(pool, userId);
  const r = await pool.query<{ id: string }>(
    `INSERT INTO customer_health_snapshots (
       user_id, overall_score, health_tier,
       login_score, feature_score, billing_score, engagement_score,
       days_since_login, active_projects_30d, features_used_30d,
       stripe_status, days_to_renewal
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      userId, h.overallScore, h.tier,
      h.subscores.login, h.subscores.feature, h.subscores.billing, h.subscores.engagement,
      h.signals.daysSinceLogin, h.signals.activeProjects30d, h.signals.featuresUsed30d,
      h.signals.stripeStatus, h.signals.daysToRenewal,
    ],
  );
  return { id: r.rows[0].id, overallScore: h.overallScore, tier: h.tier };
}

/** Bulk-snapshot for alle aktive kunder. Brukes fra cron-endpoint. */
export async function captureSnapshotsForAllActiveCustomers(
  pool: Pool,
): Promise<{ scanned: number; succeeded: number; failed: number; errors: Array<{ userId: string; error: string }> }> {
  const r = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE is_active = TRUE LIMIT 5000`,
  );
  let succeeded = 0, failed = 0;
  const errors: Array<{ userId: string; error: string }> = [];
  for (const row of r.rows) {
    try {
      await captureHealthSnapshot(pool, row.id);
      succeeded += 1;
    } catch (err) {
      failed += 1;
      errors.push({ userId: row.id, error: (err as Error).message?.slice(0, 200) });
    }
  }
  return { scanned: r.rows.length, succeeded, failed, errors: errors.slice(0, 20) };
}

// ─────────────────────────────────────────────────────────────────────
// Dashboard-aggregering
// ─────────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  generatedAt: string;
  totalCustomers: number;
  tierCounts: { green: number; yellow: number; red: number };
  avgScore: number;
  upcomingRenewals30d: number;
  openFollowups: number;
  recentChurnSignals: number;       // Siste 30 dager
  customers: CustomerHealth[];      // Live-computed top 50 (sortert: røde først)
}

export async function buildDashboardSummary(pool: Pool): Promise<DashboardSummary> {
  // Hent de 50 kundene som SANNSYNLIGST trenger oppmerksomhet
  // Default-sortering: nyligste snapshot ASC (rødeste først)
  const customersRes = await pool.query<{
    id: string; email: string; first_name: string | null; last_name: string | null;
    business_name: string | null;
  }>(
    `SELECT id, email, first_name, last_name, business_name
     FROM users WHERE is_active = TRUE
     ORDER BY last_login_at DESC NULLS LAST
     LIMIT 200`,
  );

  const customers: CustomerHealth[] = [];
  for (const c of customersRes.rows) {
    const h = await computeHealthForUser(pool, c.id);
    customers.push({
      userId: c.id,
      email: c.email,
      displayName: c.first_name && c.last_name ? `${c.first_name} ${c.last_name}` : c.first_name,
      businessName: c.business_name,
      computedAt: new Date().toISOString(),
      overallScore: h.overallScore,
      tier: h.tier,
      loginScore: h.subscores.login,
      featureScore: h.subscores.feature,
      billingScore: h.subscores.billing,
      engagementScore: h.subscores.engagement,
      signals: h.signals,
      aiSummary: null,
      aiNextAction: null,
    });
  }

  customers.sort((a, b) => a.overallScore - b.overallScore);
  const top50 = customers.slice(0, 50);

  const tierCounts = {
    green: customers.filter((c) => c.tier === 'green').length,
    yellow: customers.filter((c) => c.tier === 'yellow').length,
    red: customers.filter((c) => c.tier === 'red').length,
  };
  const avgScore = customers.length > 0
    ? Math.round(customers.reduce((s, c) => s + c.overallScore, 0) / customers.length)
    : 0;

  // Upcoming renewals + open follow-ups + churn signals (real data)
  const renewalCount = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM customer_renewal_pipeline
     WHERE renewal_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'
       AND renewal_status NOT IN ('won', 'lost', 'churned')`,
  );
  const followupCount = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM customer_interactions
     WHERE follow_up_at <= NOW() AND follow_up_completed = FALSE`,
  );
  const churnCount = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM customer_interactions
     WHERE interaction_type = 'churn_signal'
       AND occurred_at >= NOW() - INTERVAL '30 days'`,
  );

  return {
    generatedAt: new Date().toISOString(),
    totalCustomers: customers.length,
    tierCounts,
    avgScore,
    upcomingRenewals30d: renewalCount.rows[0]?.n ?? 0,
    openFollowups: followupCount.rows[0]?.n ?? 0,
    recentChurnSignals: churnCount.rows[0]?.n ?? 0,
    customers: top50,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Interactions CRUD
// ─────────────────────────────────────────────────────────────────────

export async function listInteractions(
  pool: Pool, userId: string, limit = 50,
): Promise<CustomerInteraction[]> {
  const r = await pool.query(
    `SELECT id::text, user_id, logged_by_user_id, interaction_type, subject, body,
            sentiment, follow_up_at, follow_up_completed, attendees, meeting_url,
            expansion_value_nok, churn_risk_level, occurred_at, created_at
     FROM customer_interactions WHERE user_id = $1
     ORDER BY occurred_at DESC LIMIT $2`,
    [userId, limit],
  );
  return r.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    loggedByUserId: row.logged_by_user_id,
    interactionType: row.interaction_type,
    subject: row.subject,
    body: row.body,
    sentiment: row.sentiment,
    followUpAt: row.follow_up_at?.toISOString() ?? null,
    followUpCompleted: row.follow_up_completed,
    attendees: row.attendees ?? [],
    meetingUrl: row.meeting_url,
    expansionValueNok: row.expansion_value_nok ? Number(row.expansion_value_nok) : null,
    churnRiskLevel: row.churn_risk_level,
    occurredAt: row.occurred_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  }));
}

export async function createInteraction(
  pool: Pool, opts: {
    userId: string;
    loggedByUserId: string | null;
    interactionType: string;
    subject?: string;
    body?: string;
    sentiment?: string;
    followUpAt?: string;
    attendees?: unknown[];
    meetingUrl?: string;
    expansionValueNok?: number;
    churnRiskLevel?: 'low' | 'medium' | 'high';
    occurredAt?: string;
  },
): Promise<{ id: string }> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO customer_interactions (
       user_id, logged_by_user_id, interaction_type, subject, body, sentiment,
       follow_up_at, attendees, meeting_url, expansion_value_nok, churn_risk_level,
       occurred_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, COALESCE($12::timestamptz, NOW()))
     RETURNING id::text`,
    [
      opts.userId, opts.loggedByUserId, opts.interactionType,
      opts.subject ?? null, opts.body ?? null, opts.sentiment ?? null,
      opts.followUpAt ?? null,
      JSON.stringify(opts.attendees ?? []),
      opts.meetingUrl ?? null,
      opts.expansionValueNok ?? null,
      opts.churnRiskLevel ?? null,
      opts.occurredAt ?? null,
    ],
  );
  return { id: r.rows[0].id };
}

// ─────────────────────────────────────────────────────────────────────
// Renewals
// ─────────────────────────────────────────────────────────────────────

export async function listUpcomingRenewals(
  pool: Pool, opts: { daysAhead?: number; statusFilter?: string[] } = {},
): Promise<RenewalItem[]> {
  const days = opts.daysAhead ?? 90;
  const statusParam = opts.statusFilter && opts.statusFilter.length > 0 ? opts.statusFilter : null;
  const r = await pool.query(
    `SELECT
       rp.id::text, rp.user_id, u.email, u.first_name, u.last_name, u.business_name,
       rp.renewal_at, rp.current_plan_name, rp.current_arpu_nok,
       rp.renewal_status, rp.expansion_opportunity_nok,
       rp.last_outreach_at, rp.notes,
       (SELECT health_tier FROM customer_health_snapshots
        WHERE user_id = rp.user_id ORDER BY computed_at DESC LIMIT 1) AS health_tier,
       (SELECT overall_score FROM customer_health_snapshots
        WHERE user_id = rp.user_id ORDER BY computed_at DESC LIMIT 1) AS health_score
     FROM customer_renewal_pipeline rp
     JOIN users u ON u.id = rp.user_id
     WHERE rp.renewal_at BETWEEN NOW() AND NOW() + ($1::int || ' days')::interval
       AND ($2::text[] IS NULL OR rp.renewal_status = ANY($2::text[]))
     ORDER BY rp.renewal_at ASC
     LIMIT 200`,
    [days, statusParam],
  );
  return r.rows.map((row) => {
    const days = Math.floor(
      (new Date(row.renewal_at).getTime() - Date.now()) / 86400000,
    );
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      displayName: row.first_name && row.last_name
        ? `${row.first_name} ${row.last_name}` : row.first_name,
      businessName: row.business_name,
      renewalAt: row.renewal_at.toISOString(),
      daysUntilRenewal: days,
      currentPlanName: row.current_plan_name,
      currentArpuNok: row.current_arpu_nok ? Number(row.current_arpu_nok) : null,
      renewalStatus: row.renewal_status,
      expansionOpportunityNok: row.expansion_opportunity_nok
        ? Number(row.expansion_opportunity_nok) : null,
      lastOutreachAt: row.last_outreach_at?.toISOString() ?? null,
      notes: row.notes,
      healthTier: row.health_tier,
      healthScore: row.health_score,
    };
  });
}

export async function updateRenewalStatus(
  pool: Pool, opts: { renewalId: string; status: string; notes?: string },
): Promise<{ ok: boolean }> {
  await pool.query(
    `UPDATE customer_renewal_pipeline
       SET renewal_status = $1,
           notes = COALESCE($2, notes),
           last_outreach_at = NOW(),
           updated_at = NOW()
     WHERE id = $3::uuid`,
    [opts.status, opts.notes ?? null, opts.renewalId],
  );
  return { ok: true };
}
