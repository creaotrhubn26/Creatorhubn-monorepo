/**
 * leadgrid-analytics-service.ts
 *
 * Beregner KPI-er for Leadgrid Analytics Dashboard. Rene funksjoner; ingen
 * Express-avhengighet. Returnerer JSON-serializable typer.
 *
 * Tilpasset faktisk skjema:
 *   - crm_customers har INGEN organization_id-kolonne (PR #837/#848).
 *     Org-filter går via owner_user_id IN (SELECT user_id::text FROM
 *     organization_members WHERE organization_id = $1).
 *   - Faktiske kolonner i bruk: lead_status, ai_opportunity_score,
 *     estimated_value, lead_category, city, lead_source, last_visit_at,
 *     next_follow_up_at, archived_at, created_at, owner_user_id.
 *   - lead_status verdier (CHECK i migrate 271):
 *       unvisited|visited|return|not_present|declined|interested|
 *       meeting_booked|proposal_sent|won|lost|do_not_contact
 *   - crm_lead_activities.activity_type CHECK-verdier (migrate 271):
 *       status_changed|visit_logged|note_added|pitch_generated|
 *       meeting_scheduled|proposal_sent|follow_up_set|lead_created|
 *       lead_imported|assigned
 *   - crm_visits.visit_type: physical|phone|email|online_meeting|research
 *
 * "Hot" / "Ready" / "Conversion" utledes fra ai_opportunity_score og
 * lead_status (det finnes ingen lead_temperature-/pipeline_stage-kolonner).
 */

import type { Pool } from "pg";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OrgAnalyticsOverview {
  totalLeads: number;
  activeLeads: number;
  hotLeads: number;
  readyLeads: number;
  followUpsDueToday: number;
  followUpsOverdue: number;
  meetingsBooked: number;
  proposalsSent: number;
  wonDeals: number;
  lostDeals: number;
  conversionRate: number;
  expectedRevenue: number;
  closedRevenue: number;
  pipelineVelocity: number;
  averageDealValue: number;
  averageCycleDays: number;
  avgTimeToFirstContactHours: number | null;
  avgTimeToCloseDays: number | null;
}

export interface ChannelPerformance {
  channel: string;
  attempts: number;
  responses: number;
  responseRate: number;
}

export interface SourcePerformance {
  source: string;
  totalLeads: number;
  conversions: number;
  conversionRate: number;
  avgDealValue: number;
  sourceQualityScore: number;
}

export interface SegmentPerformance {
  segment: string;
  totalLeads: number;
  hotLeads: number;
  conversions: number;
  conversionRate: number;
  expectedValue: number;
  avgScore: number;
}

export interface TerritoryPerformance {
  city: string;
  totalLeads: number;
  conversions: number;
  conversionRate: number;
  expectedValue: number;
  avgScore: number;
  hotLeadDensity: number;
  meetingsBooked: number;
}

export interface VelocityPoint {
  date: string;
  activeDeals: number;
  winRate: number;
  avgDealValue: number;
  velocity: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  sumExpectedValue: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * CTE som returnerer alle user_id (text) tilhørende org. Brukes som
 * `owner_user_id IN (SELECT user_id::text FROM organization_members ...)`.
 */
const ORG_MEMBERS_SUBQUERY =
  `SELECT user_id::text FROM organization_members WHERE organization_id = $1::uuid`;

function num(v: string | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nullableNum(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function computeOrgAnalyticsOverview(
  pool: Pool,
  orgId: string,
  sinceDays = 90,
): Promise<OrgAnalyticsOverview> {
  // ai_opportunity_score >= 70  → "hot"
  // ai_opportunity_score 50–69  → "ready"
  // lead_status = 'won' / 'lost' / 'meeting_booked' / 'proposal_sent'
  //
  // Vi bruker last_visit_at som "siste touchpoint" (last_contacted_at finnes
  // ikke). Closed revenue = SUM(estimated_value) for won siste $2 dager.
  const r = await pool.query<{
    total_leads: string;
    active_leads: string;
    hot_leads: string;
    ready_leads: string;
    follow_ups_due_today: string;
    follow_ups_overdue: string;
    meetings_booked: string;
    proposals_sent: string;
    won_deals: string;
    lost_deals: string;
    expected_revenue: string;
    closed_revenue: string;
    average_deal_value: string;
  }>(
    `WITH base AS (
       SELECT *
         FROM crm_customers
        WHERE owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
          AND archived_at IS NULL
     ),
     win_period AS (
       SELECT *
         FROM base
        WHERE lead_status = 'won'
          AND COALESCE(last_visit_at, updated_at, created_at) > NOW() - ($2 || ' days')::interval
     )
     SELECT
       (SELECT COUNT(*) FROM base) AS total_leads,
       (SELECT COUNT(*) FROM base
          WHERE lead_status NOT IN ('won','lost','do_not_contact')) AS active_leads,
       (SELECT COUNT(*) FROM base
          WHERE ai_opportunity_score IS NOT NULL AND ai_opportunity_score >= 70) AS hot_leads,
       (SELECT COUNT(*) FROM base
          WHERE ai_opportunity_score IS NOT NULL
            AND ai_opportunity_score >= 50
            AND ai_opportunity_score < 70) AS ready_leads,
       (SELECT COUNT(*) FROM base
          WHERE next_follow_up_at::date = CURRENT_DATE) AS follow_ups_due_today,
       (SELECT COUNT(*) FROM base
          WHERE next_follow_up_at < NOW()
            AND lead_status NOT IN ('won','lost','do_not_contact')) AS follow_ups_overdue,
       (SELECT COUNT(*) FROM base WHERE lead_status = 'meeting_booked') AS meetings_booked,
       (SELECT COUNT(*) FROM base WHERE lead_status = 'proposal_sent') AS proposals_sent,
       (SELECT COUNT(*) FROM base WHERE lead_status = 'won') AS won_deals,
       (SELECT COUNT(*) FROM base WHERE lead_status = 'lost') AS lost_deals,
       (SELECT COALESCE(SUM(estimated_value), 0)
          FROM base
         WHERE lead_status NOT IN ('won','lost','do_not_contact')) AS expected_revenue,
       (SELECT COALESCE(SUM(estimated_value), 0) FROM win_period) AS closed_revenue,
       (SELECT COALESCE(AVG(estimated_value), 0) FROM win_period) AS average_deal_value
    `,
    [orgId, sinceDays.toString()],
  );
  const row = r.rows[0];
  const total = num(row?.total_leads);
  const won = num(row?.won_deals);
  const activeDeals = num(row?.active_leads);
  const avgDealValue = num(row?.average_deal_value);
  const conversionRate = total > 0 ? won / total : 0;
  const winRate = conversionRate;

  // Avg cycle days: created → first won-overgang. Vi mangler eksakt
  // pipeline-stage-overgang, så approximerer med (last_visit_at - created_at)
  // for won-rader siste 180 dager.
  const cycleR = await pool.query<{ avg_days: string | null }>(
    `SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(last_visit_at, updated_at) - created_at)) / 86400) AS avg_days
       FROM crm_customers
      WHERE owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
        AND lead_status = 'won'
        AND COALESCE(last_visit_at, updated_at, created_at) > NOW() - INTERVAL '180 days'`,
    [orgId],
  );
  const rawCycle = nullableNum(cycleR.rows[0]?.avg_days);
  const avgCycleDays = rawCycle && rawCycle > 0 ? rawCycle : 30;

  // Pipeline velocity = active_deals × win_rate × avg_deal / avg_cycle_days
  const velocity = avgCycleDays > 0 ? (activeDeals * winRate * avgDealValue) / avgCycleDays : 0;

  // Time-to-first-contact (lead created → første activity)
  const ttfcR = await pool.query<{ hours: string | null }>(
    `SELECT AVG(EXTRACT(EPOCH FROM (first_act.created_at - c.created_at)) / 3600) AS hours
       FROM crm_customers c
       JOIN LATERAL (
         SELECT created_at FROM crm_lead_activities
          WHERE customer_id = c.id
          ORDER BY created_at ASC LIMIT 1
       ) first_act ON TRUE
      WHERE c.owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
        AND c.created_at > NOW() - INTERVAL '90 days'`,
    [orgId],
  );

  return {
    totalLeads: total,
    activeLeads: activeDeals,
    hotLeads: num(row?.hot_leads),
    readyLeads: num(row?.ready_leads),
    followUpsDueToday: num(row?.follow_ups_due_today),
    followUpsOverdue: num(row?.follow_ups_overdue),
    meetingsBooked: num(row?.meetings_booked),
    proposalsSent: num(row?.proposals_sent),
    wonDeals: won,
    lostDeals: num(row?.lost_deals),
    conversionRate,
    expectedRevenue: num(row?.expected_revenue),
    closedRevenue: num(row?.closed_revenue),
    pipelineVelocity: velocity,
    averageDealValue: avgDealValue,
    averageCycleDays: avgCycleDays,
    avgTimeToFirstContactHours: nullableNum(ttfcR.rows[0]?.hours),
    avgTimeToCloseDays: avgCycleDays,
  };
}

// ---------------------------------------------------------------------------
// Channels — bygges av crm_visits (visit_type) + crm_lead_activities
// ---------------------------------------------------------------------------

export async function computeChannelPerformance(
  pool: Pool,
  orgId: string,
  sinceDays = 90,
): Promise<ChannelPerformance[]> {
  // Attempts = visits per visit_type (physical/phone/email/online_meeting/research)
  // Responses = visits som førte til ny status ('meeting_booked','interested',
  // 'proposal_sent','won') ELLER en lead-activity 'meeting_scheduled' i samme
  // 24t-vindu. Forenklet: vi teller visits hvor new_status er en
  // "positive" status.
  const r = await pool.query<{ channel: string; attempts: string; responses: string }>(
    `WITH org_customers AS (
       SELECT id FROM crm_customers
        WHERE owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
     )
     SELECT
       v.visit_type AS channel,
       COUNT(*)::text AS attempts,
       COUNT(*) FILTER (
         WHERE v.new_status IN ('interested','meeting_booked','proposal_sent','won')
       )::text AS responses
       FROM crm_visits v
      WHERE v.customer_id IN (SELECT id FROM org_customers)
        AND v.visit_datetime > NOW() - ($2 || ' days')::interval
      GROUP BY v.visit_type
      ORDER BY COUNT(*) DESC NULLS LAST`,
    [orgId, sinceDays.toString()],
  );
  return r.rows.map((row) => {
    const attempts = num(row.attempts);
    const responses = num(row.responses);
    return {
      channel: row.channel || "unknown",
      attempts,
      responses,
      responseRate: attempts > 0 ? responses / attempts : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export async function computeSourcePerformance(
  pool: Pool,
  orgId: string,
): Promise<SourcePerformance[]> {
  const r = await pool.query<{
    source: string;
    total_leads: string;
    conversions: string;
    avg_deal_value: string;
  }>(
    `SELECT
       COALESCE(lead_source, 'unknown') AS source,
       COUNT(*)::text AS total_leads,
       COUNT(*) FILTER (WHERE lead_status = 'won')::text AS conversions,
       COALESCE(AVG(estimated_value) FILTER (WHERE lead_status = 'won'), 0)::text AS avg_deal_value
       FROM crm_customers
      WHERE owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
        AND archived_at IS NULL
      GROUP BY source
      ORDER BY COUNT(*) DESC`,
    [orgId],
  );
  return r.rows.map((row) => {
    const total = num(row.total_leads);
    const conv = num(row.conversions);
    const avgVal = num(row.avg_deal_value);
    const convRate = total > 0 ? conv / total : 0;
    // SourceQuality = conversion-rate (vekt 100) + dempet avg-deal-value
    // (klipp ved 50). Gir ca. 0–150 skala.
    const sourceQualityScore = convRate * 100 + Math.min(avgVal / 10000, 50);
    return {
      source: row.source,
      totalLeads: total,
      conversions: conv,
      conversionRate: convRate,
      avgDealValue: avgVal,
      sourceQualityScore,
    };
  });
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

export type SegmentDimension = "category" | "city" | "lead_status";

export async function computeSegmentPerformance(
  pool: Pool,
  orgId: string,
  dimension: SegmentDimension,
): Promise<SegmentPerformance[]> {
  // Whitelist kolonner — aldri interpoler bruker-input direkte i SQL.
  const col =
    dimension === "category" ? "lead_category" :
    dimension === "city" ? "city" :
    "lead_status";
  const r = await pool.query<{
    segment: string;
    total_leads: string;
    hot_leads: string;
    conversions: string;
    expected_value: string;
    avg_score: string;
  }>(
    `SELECT
       COALESCE(${col}, 'unknown') AS segment,
       COUNT(*)::text AS total_leads,
       COUNT(*) FILTER (
         WHERE ai_opportunity_score IS NOT NULL AND ai_opportunity_score >= 70
       )::text AS hot_leads,
       COUNT(*) FILTER (WHERE lead_status = 'won')::text AS conversions,
       COALESCE(SUM(estimated_value) FILTER (
         WHERE lead_status NOT IN ('won','lost','do_not_contact')
       ), 0)::text AS expected_value,
       COALESCE(AVG(ai_opportunity_score), 0)::text AS avg_score
       FROM crm_customers
      WHERE owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
        AND archived_at IS NULL
      GROUP BY segment
      ORDER BY COUNT(*) DESC
      LIMIT 30`,
    [orgId],
  );
  return r.rows.map((row) => {
    const total = num(row.total_leads);
    const conv = num(row.conversions);
    return {
      segment: row.segment,
      totalLeads: total,
      hotLeads: num(row.hot_leads),
      conversions: conv,
      conversionRate: total > 0 ? conv / total : 0,
      expectedValue: num(row.expected_value),
      avgScore: num(row.avg_score),
    };
  });
}

// ---------------------------------------------------------------------------
// Territory (by city, min 3 leads)
// ---------------------------------------------------------------------------

export async function computeTerritoryPerformance(
  pool: Pool,
  orgId: string,
): Promise<TerritoryPerformance[]> {
  const r = await pool.query<{
    city: string;
    total_leads: string;
    conversions: string;
    expected_value: string;
    avg_score: string;
    hot_leads: string;
    meetings_booked: string;
  }>(
    `SELECT
       COALESCE(city, 'ukjent') AS city,
       COUNT(*)::text AS total_leads,
       COUNT(*) FILTER (WHERE lead_status = 'won')::text AS conversions,
       COALESCE(SUM(estimated_value) FILTER (
         WHERE lead_status NOT IN ('won','lost','do_not_contact')
       ), 0)::text AS expected_value,
       COALESCE(AVG(ai_opportunity_score), 0)::text AS avg_score,
       COUNT(*) FILTER (
         WHERE ai_opportunity_score IS NOT NULL AND ai_opportunity_score >= 70
       )::text AS hot_leads,
       COUNT(*) FILTER (WHERE lead_status = 'meeting_booked')::text AS meetings_booked
       FROM crm_customers
      WHERE owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
        AND archived_at IS NULL
        AND city IS NOT NULL
      GROUP BY city
     HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) DESC
      LIMIT 50`,
    [orgId],
  );
  return r.rows.map((row) => {
    const total = num(row.total_leads);
    const conv = num(row.conversions);
    const hot = num(row.hot_leads);
    return {
      city: row.city,
      totalLeads: total,
      conversions: conv,
      conversionRate: total > 0 ? conv / total : 0,
      expectedValue: num(row.expected_value),
      avgScore: num(row.avg_score),
      hotLeadDensity: total > 0 ? hot / total : 0,
      meetingsBooked: num(row.meetings_booked),
    };
  });
}

// ---------------------------------------------------------------------------
// Velocity history — daglige snapshots
// ---------------------------------------------------------------------------

export async function computeVelocityHistory(
  pool: Pool,
  orgId: string,
  days = 90,
): Promise<VelocityPoint[]> {
  // active_deals  = leads med "aktiv" lead_status opprettet før dato
  // wins          = leads med lead_status='won' og last_visit_at::date = dato
  // avg_value     = løpende snitt for won frem til dato
  // velocity      = active × winRate × avg_value / 30
  const r = await pool.query<{
    d: string;
    active_deals: string;
    wins: string;
    avg_value: string;
  }>(
    `WITH days AS (
       SELECT generate_series(NOW() - ($2 || ' days')::interval, NOW(), '1 day'::interval)::date AS d
     )
     SELECT
       days.d::text AS d,
       (SELECT COUNT(*) FROM crm_customers
          WHERE owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
            AND lead_status IN ('unvisited','visited','interested','meeting_booked','proposal_sent','return')
            AND created_at <= (days.d + INTERVAL '1 day')
            AND archived_at IS NULL)::text AS active_deals,
       (SELECT COUNT(*) FROM crm_customers
          WHERE owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
            AND lead_status = 'won'
            AND COALESCE(last_visit_at, updated_at)::date = days.d)::text AS wins,
       (SELECT COALESCE(AVG(estimated_value), 0) FROM crm_customers
          WHERE owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
            AND lead_status = 'won'
            AND COALESCE(last_visit_at, updated_at)::date <= days.d)::text AS avg_value
       FROM days
      ORDER BY days.d ASC`,
    [orgId, days.toString()],
  );
  return r.rows.map((row) => {
    const active = num(row.active_deals);
    const wins = num(row.wins);
    const avgValue = num(row.avg_value);
    // Dagsbasert winRate er sterkt støyete — bruk wins/active som proxy
    const winRate = active > 0 ? wins / active : 0;
    return {
      date: row.d,
      activeDeals: active,
      winRate,
      avgDealValue: avgValue,
      velocity: avgValue > 0 ? (active * winRate * avgValue) / 30 : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Conversion funnel — count per lead_status, normalisert rekkefølge
// ---------------------------------------------------------------------------

export async function computeConversionFunnel(
  pool: Pool,
  orgId: string,
): Promise<FunnelStage[]> {
  const r = await pool.query<{ stage: string; count: string; sum_ev: string }>(
    `SELECT
       lead_status AS stage,
       COUNT(*)::text AS count,
       COALESCE(SUM(estimated_value), 0)::text AS sum_ev
       FROM crm_customers
      WHERE owner_user_id IN (${ORG_MEMBERS_SUBQUERY})
        AND archived_at IS NULL
      GROUP BY lead_status`,
    [orgId],
  );
  // Normalisert pipeline-rekkefølge (matcher lead_status CHECK i migrate 271).
  const order = [
    "unvisited",
    "visited",
    "return",
    "not_present",
    "declined",
    "interested",
    "meeting_booked",
    "proposal_sent",
    "won",
    "lost",
  ];
  const map = new Map(r.rows.map((row) => [row.stage, row]));
  return order.map((stage) => {
    const row = map.get(stage);
    return {
      stage,
      count: row ? num(row.count) : 0,
      sumExpectedValue: row ? num(row.sum_ev) : 0,
    };
  });
}
