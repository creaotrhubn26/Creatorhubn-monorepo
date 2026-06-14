/**
 * lead-map-campaign-service.ts
 *
 * Lead Map som kampanje-motor.
 *
 * Hver kampanje:
 *   - filtrerer leads på (kategori, region, by, status)
 *   - har målbart antall: total_leads + won_leads
 *   - aggregerer status-pipeline (40 ikke kontaktet, 25 kontaktet, …)
 *   - viser conversion-rate per kategori/område
 *   - flagger declined > 90d for re-engagement
 *
 * Re-engagement: cron-løkke som finner leads med status='declined' AND
 * last_visit_at < NOW() - re_engagement_days, og setter dem tilbake til
 * 'unvisited' med en notert "Re-aktivert (følger opp etter pause)".
 */

import type { Pool } from "pg";

export type LeadStatus =
  | "unvisited" | "visited" | "return" | "not_present" | "declined"
  | "interested" | "meeting_booked" | "proposal_sent" | "won" | "lost" | "do_not_contact";

export const PIPELINE_STATUSES: LeadStatus[] = [
  "unvisited", "visited", "interested", "meeting_booked",
  "proposal_sent", "won",
];

export interface LeadMapCampaign {
  id: string;
  workspaceOwnerUserId: string;
  agentConfigId?: string | null;
  name: string;
  description?: string | null;
  filterCategory?: string | null;
  filterRegion?: string | null;
  filterCity?: string | null;
  filterLeadStatus: LeadStatus[];
  targetTotalLeads: number;
  targetWonLeads: number;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  marketScanId?: string | null;
  brandKitId?: string | null;
  relatedWorkflowId?: string | null;
  reEngagementDays: number;
  autoReEngagementEnabled: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CampaignRow {
  id: string;
  workspace_owner_user_id: string;
  agent_config_id: string | null;
  name: string;
  description: string | null;
  filter_category: string | null;
  filter_region: string | null;
  filter_city: string | null;
  filter_lead_status: LeadStatus[];
  target_total_leads: number;
  target_won_leads: number;
  status: LeadMapCampaign["status"];
  market_scan_id: string | null;
  brand_kit_id: string | null;
  related_workflow_id: string | null;
  re_engagement_days: number;
  auto_re_engagement_enabled: boolean;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToCampaign(r: CampaignRow): LeadMapCampaign {
  return {
    id: r.id,
    workspaceOwnerUserId: r.workspace_owner_user_id,
    agentConfigId: r.agent_config_id,
    name: r.name,
    description: r.description,
    filterCategory: r.filter_category,
    filterRegion: r.filter_region,
    filterCity: r.filter_city,
    filterLeadStatus: r.filter_lead_status ?? [],
    targetTotalLeads: r.target_total_leads,
    targetWonLeads: r.target_won_leads,
    status: r.status,
    marketScanId: r.market_scan_id,
    brandKitId: r.brand_kit_id,
    relatedWorkflowId: r.related_workflow_id,
    reEngagementDays: r.re_engagement_days,
    autoReEngagementEnabled: r.auto_re_engagement_enabled,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────

export async function createCampaign(
  pool: Pool,
  input: {
    workspaceOwnerUserId: string;
    agentConfigId?: string | null;
    name: string;
    description?: string;
    filterCategory?: string;
    filterRegion?: string;
    filterCity?: string;
    filterLeadStatus?: LeadStatus[];
    targetTotalLeads?: number;
    targetWonLeads?: number;
    marketScanId?: string;
    brandKitId?: string;
    reEngagementDays?: number;
  },
): Promise<LeadMapCampaign> {
  const r = await pool.query<CampaignRow>(
    `INSERT INTO lead_map_campaigns (
       workspace_owner_user_id, agent_config_id, name, description,
       filter_category, filter_region, filter_city, filter_lead_status,
       target_total_leads, target_won_leads,
       market_scan_id, brand_kit_id, re_engagement_days,
       status, started_at
     ) VALUES (
       $1, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb,
       $9, $10, $11::uuid, $12::uuid, $13,
       'active', NOW()
     )
     RETURNING *,
       id::text, agent_config_id::text, market_scan_id::text,
       brand_kit_id::text, related_workflow_id::text,
       started_at::text, completed_at::text, created_at::text, updated_at::text`,
    [
      input.workspaceOwnerUserId,
      input.agentConfigId ?? null,
      input.name,
      input.description ?? null,
      input.filterCategory ?? null,
      input.filterRegion ?? null,
      input.filterCity ?? null,
      JSON.stringify(input.filterLeadStatus ?? PIPELINE_STATUSES),
      input.targetTotalLeads ?? 100,
      input.targetWonLeads ?? 5,
      input.marketScanId ?? null,
      input.brandKitId ?? null,
      input.reEngagementDays ?? 90,
    ],
  );
  return rowToCampaign(r.rows[0]);
}

export async function listCampaigns(
  pool: Pool,
  args: { workspaceOwnerUserId: string; status?: string; limit?: number },
): Promise<LeadMapCampaign[]> {
  const conditions = ["workspace_owner_user_id = $1"];
  const params: unknown[] = [args.workspaceOwnerUserId];
  if (args.status) {
    params.push(args.status);
    conditions.push(`status = $${params.length}`);
  }
  const r = await pool.query<CampaignRow>(
    `SELECT *,
       id::text, agent_config_id::text, market_scan_id::text,
       brand_kit_id::text, related_workflow_id::text,
       started_at::text, completed_at::text, created_at::text, updated_at::text
     FROM lead_map_campaigns
     WHERE ${conditions.join(" AND ")}
     ORDER BY updated_at DESC
     LIMIT $${params.length + 1}`,
    [...params, args.limit ?? 100],
  );
  return r.rows.map(rowToCampaign);
}

export async function getCampaign(
  pool: Pool,
  campaignId: string,
): Promise<LeadMapCampaign | null> {
  const r = await pool.query<CampaignRow>(
    `SELECT *,
       id::text, agent_config_id::text, market_scan_id::text,
       brand_kit_id::text, related_workflow_id::text,
       started_at::text, completed_at::text, created_at::text, updated_at::text
     FROM lead_map_campaigns
     WHERE id = $1::uuid`,
    [campaignId],
  );
  if (r.rows.length === 0) return null;
  return rowToCampaign(r.rows[0]);
}

// ─────────────────────────────────────────────────────────────────────
// Status-aggregat
// ─────────────────────────────────────────────────────────────────────

export interface CampaignStatusAggregate {
  campaign: LeadMapCampaign;
  totalMatchingLeads: number;
  statusCounts: Record<LeadStatus, number>;
  pipelineProgress: {
    unvisited: number;
    contacted: number; // visited + return
    interested: number;
    meetingBooked: number;
    proposalSent: number;
    won: number;
    lost: number;
    declined: number;
  };
  conversionRate: {
    contactToInterested: number; // %
    interestedToMeeting: number;
    meetingToWon: number;
    totalConversion: number; // unvisited → won
  };
  goalProgress: {
    totalLeadsPct: number;
    wonLeadsPct: number;
  };
  reEngagementCandidates: number;
}

/** Bygger SQL-fragment for filter-matching basert på kampanje. */
function buildLeadFilterSql(
  campaign: LeadMapCampaign,
  paramStart: number,
): { sql: string; params: unknown[] } {
  const conditions = ["c.owner_user_id = $1"];
  const params: unknown[] = [campaign.workspaceOwnerUserId];
  let next = paramStart;

  if (campaign.agentConfigId) {
    params.push(campaign.agentConfigId);
    conditions.push(`c.agent_config_id = $${++next}::uuid`);
  } else {
    conditions.push("c.agent_config_id IS NULL");
  }
  if (campaign.filterCategory) {
    params.push(campaign.filterCategory);
    conditions.push(`c.lead_category = $${++next}`);
  }
  if (campaign.filterRegion) {
    params.push(`%${campaign.filterRegion}%`);
    conditions.push(`(c.address ILIKE $${++next} OR c.city ILIKE $${next})`);
  }
  if (campaign.filterCity) {
    params.push(campaign.filterCity);
    conditions.push(`c.city = $${++next}`);
  }
  // forced_out members ekskluderes alltid
  conditions.push(`
    NOT EXISTS (
      SELECT 1 FROM lead_map_campaign_members lmcm
      WHERE lmcm.campaign_id = $${++next}::uuid
        AND lmcm.customer_id = c.id
        AND lmcm.membership_type = 'forced_out'
    )
  `);
  params.push(campaign.id);

  return { sql: conditions.join(" AND "), params };
}

export async function getCampaignAggregate(
  pool: Pool,
  campaignId: string,
): Promise<CampaignStatusAggregate | null> {
  const campaign = await getCampaign(pool, campaignId);
  if (!campaign) return null;

  const { sql: whereSql, params } = buildLeadFilterSql(campaign, 1);

  const r = await pool.query<{ lead_status: LeadStatus; count: number }>(
    `SELECT c.lead_status, COUNT(*)::int as count
       FROM crm_customers c
      WHERE ${whereSql}
      GROUP BY c.lead_status`,
    params,
  );

  const statusCounts: Record<LeadStatus, number> = {
    unvisited: 0, visited: 0, return: 0, not_present: 0, declined: 0,
    interested: 0, meeting_booked: 0, proposal_sent: 0,
    won: 0, lost: 0, do_not_contact: 0,
  };
  for (const row of r.rows) statusCounts[row.lead_status] = row.count;

  const totalMatchingLeads = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const pipelineProgress = {
    unvisited: statusCounts.unvisited,
    contacted: statusCounts.visited + statusCounts.return,
    interested: statusCounts.interested,
    meetingBooked: statusCounts.meeting_booked,
    proposalSent: statusCounts.proposal_sent,
    won: statusCounts.won,
    lost: statusCounts.lost,
    declined: statusCounts.declined,
  };

  const contactedTotal = pipelineProgress.contacted + pipelineProgress.interested +
    pipelineProgress.meetingBooked + pipelineProgress.proposalSent +
    pipelineProgress.won + pipelineProgress.lost + pipelineProgress.declined;

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  const conversionRate = {
    contactToInterested: pct(
      pipelineProgress.interested + pipelineProgress.meetingBooked +
        pipelineProgress.proposalSent + pipelineProgress.won,
      contactedTotal,
    ),
    interestedToMeeting: pct(
      pipelineProgress.meetingBooked + pipelineProgress.proposalSent + pipelineProgress.won,
      pipelineProgress.interested + pipelineProgress.meetingBooked +
        pipelineProgress.proposalSent + pipelineProgress.won + pipelineProgress.declined,
    ),
    meetingToWon: pct(
      pipelineProgress.won,
      pipelineProgress.meetingBooked + pipelineProgress.proposalSent + pipelineProgress.won,
    ),
    totalConversion: pct(pipelineProgress.won, totalMatchingLeads),
  };

  const goalProgress = {
    totalLeadsPct: pct(totalMatchingLeads, campaign.targetTotalLeads),
    wonLeadsPct: pct(pipelineProgress.won, campaign.targetWonLeads),
  };

  // Re-engagement candidates (declined > N dager)
  const reEng = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int as count
       FROM crm_customers c
      WHERE ${whereSql}
        AND c.lead_status = 'declined'
        AND c.last_visit_at < NOW() - ($${params.length + 1}::int * INTERVAL '1 day')`,
    [...params, campaign.reEngagementDays],
  );

  return {
    campaign,
    totalMatchingLeads,
    statusCounts,
    pipelineProgress,
    conversionRate,
    goalProgress,
    reEngagementCandidates: reEng.rows[0]?.count ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Cross-campaign analytics
// ─────────────────────────────────────────────────────────────────────

export interface CategoryConversionStat {
  category: string;
  totalLeads: number;
  wonLeads: number;
  conversionRate: number; // %
  avgEstimatedValue: number;
}

export interface AreaResponseStat {
  area: string; // city
  totalLeads: number;
  contactedLeads: number;
  interestedLeads: number;
  responseRate: number; // %
}

export async function getCategoryConversionStats(
  pool: Pool,
  workspaceOwnerUserId: string,
): Promise<CategoryConversionStat[]> {
  const r = await pool.query<{
    category: string;
    total: number;
    won: number;
    avg_value: number;
  }>(
    `SELECT
       COALESCE(lead_category, '(ukategorisert)') as category,
       COUNT(*)::int as total,
       COUNT(*) FILTER (WHERE lead_status='won')::int as won,
       COALESCE(AVG(estimated_value), 0)::numeric as avg_value
     FROM crm_customers
     WHERE owner_user_id = $1
       AND agent_config_id IS NULL
     GROUP BY lead_category
     HAVING COUNT(*) >= 5
     ORDER BY (COUNT(*) FILTER (WHERE lead_status='won')::float / NULLIF(COUNT(*), 0)::float) DESC NULLS LAST
     LIMIT 20`,
    [workspaceOwnerUserId],
  );
  return r.rows.map((row) => ({
    category: row.category,
    totalLeads: row.total,
    wonLeads: row.won,
    conversionRate: row.total > 0 ? Math.round((row.won / row.total) * 100) : 0,
    avgEstimatedValue: Number(row.avg_value ?? 0),
  }));
}

export async function getAreaResponseStats(
  pool: Pool,
  workspaceOwnerUserId: string,
): Promise<AreaResponseStat[]> {
  const r = await pool.query<{
    area: string;
    total: number;
    contacted: number;
    interested: number;
  }>(
    `SELECT
       COALESCE(city, '(uten by)') as area,
       COUNT(*)::int as total,
       COUNT(*) FILTER (
         WHERE lead_status IN ('visited','return','interested','meeting_booked','proposal_sent','won','lost')
       )::int as contacted,
       COUNT(*) FILTER (
         WHERE lead_status IN ('interested','meeting_booked','proposal_sent','won')
       )::int as interested
     FROM crm_customers
     WHERE owner_user_id = $1
       AND agent_config_id IS NULL
     GROUP BY city
     HAVING COUNT(*) >= 5
     ORDER BY (COUNT(*) FILTER (WHERE lead_status='interested')::float / NULLIF(COUNT(*), 0)::float) DESC NULLS LAST
     LIMIT 20`,
    [workspaceOwnerUserId],
  );
  return r.rows.map((row) => ({
    area: row.area,
    totalLeads: row.total,
    contactedLeads: row.contacted,
    interestedLeads: row.interested,
    responseRate: row.contacted > 0 ? Math.round((row.interested / row.contacted) * 100) : 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────
// Re-engagement cron
// ─────────────────────────────────────────────────────────────────────

export async function runReEngagementCron(
  pool: Pool,
): Promise<{ campaignsProcessed: number; leadsReactivated: number }> {
  const campaigns = await pool.query<CampaignRow>(
    `SELECT *,
       id::text, agent_config_id::text, market_scan_id::text,
       brand_kit_id::text, related_workflow_id::text,
       started_at::text, completed_at::text, created_at::text, updated_at::text
     FROM lead_map_campaigns
     WHERE status='active' AND auto_re_engagement_enabled=true`,
  );

  let leadsReactivated = 0;
  for (const cRow of campaigns.rows) {
    const campaign = rowToCampaign(cRow);
    const { sql: whereSql, params } = buildLeadFilterSql(campaign, 1);

    // Finn declined leads forbi re-engagement window
    const candidates = await pool.query<{ id: string }>(
      `SELECT c.id FROM crm_customers c
        WHERE ${whereSql}
          AND c.lead_status='declined'
          AND c.last_visit_at < NOW() - ($${params.length + 1}::int * INTERVAL '1 day')
        LIMIT 50`,
      [...params, campaign.reEngagementDays],
    );

    for (const lead of candidates.rows) {
      await pool.query(
        `UPDATE crm_customers
            SET lead_status='unvisited',
                next_action='Re-aktivert etter pause — følg opp på nytt'
          WHERE id=$1`,
        [lead.id],
      );
      await pool.query(
        `INSERT INTO lead_map_campaign_lead_history (
           campaign_id, customer_id, from_status, to_status, notes
         ) VALUES ($1::uuid, $2, 'declined', 'unvisited', 'Re-engagement-cron etter pause')`,
        [campaign.id, lead.id],
      );
      leadsReactivated += 1;
    }
  }

  return { campaignsProcessed: campaigns.rows.length, leadsReactivated };
}
