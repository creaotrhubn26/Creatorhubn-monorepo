import type { Pool } from "pg";
import { calculateCommission } from "./sales-leadership-engine.js";

export interface LeaderboardMember {
  userId: string;
  name: string;
  email: string | null;
  title: string;
  won: number;
  leads: number;
  trend: number;
  totalValueNok: number;
}

export interface CommissionMember {
  userId: string;
  name: string;
  wonDeals: number;
  revenueNok: number;
  commissionNok: number;
}

export interface CommissionResult {
  period: string;
  preset: string;
  isDefaultConfig: boolean;
  rate: number;
  modelsApplied: string[];
  modelsIgnored: string[];
  members: CommissionMember[];
  totalCommissionNok: number;
}

const VALID_PERIODS = new Set(["month", "quarter", "year"]);

/** Authoritative CRM leaderboard. `won` is won deals, never prize awards. */
export async function getTeamLeaderboard(
  pool: Pool,
  orgId: string,
  _currentUserId: string,
): Promise<LeaderboardMember[]> {
  const result = await pool.query<Record<string, unknown>>(
    `SELECT om.user_id,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email, om.user_id) AS name,
            u.email,
            om.role AS title,
            COUNT(c.id) FILTER (WHERE c.pipeline_stage='won' OR c.status='won' OR c.lead_status='won')::int AS won,
            COUNT(c.id)::int AS leads,
            COALESCE(SUM(COALESCE(c.won_amount_oere::numeric/100.0,c.deal_amount,0))
              FILTER (WHERE c.pipeline_stage='won' OR c.status='won' OR c.lead_status='won'),0)::float8 AS total_value_nok,
            COALESCE((
              SELECT LEAST(999,GREATEST(-999,CASE WHEN previous_count=0 THEN CASE WHEN current_count>0 THEN 100 ELSE 0 END
                ELSE ROUND(((current_count-previous_count)::numeric/previous_count)*100)::int END))
              FROM (
                SELECT COUNT(*) FILTER (WHERE la.created_at>=NOW()-INTERVAL '7 days')::int AS current_count,
                       COUNT(*) FILTER (WHERE la.created_at>=NOW()-INTERVAL '14 days' AND la.created_at<NOW()-INTERVAL '7 days')::int AS previous_count
                  FROM crm_lead_activities la
                  JOIN crm_customers activity_customer ON activity_customer.id=la.customer_id
                 WHERE la.user_id=om.user_id AND activity_customer.organization_id=$1::uuid
              ) activity_counts
            ),0) AS trend
       FROM organization_members om
       LEFT JOIN users u ON u.id=om.user_id
       LEFT JOIN crm_customers c ON c.assigned_user_id=om.user_id
          AND c.organization_id=om.organization_id AND c.archived_at IS NULL
      WHERE om.organization_id=$1::uuid
      GROUP BY om.user_id,om.role,u.first_name,u.last_name,u.email
      ORDER BY total_value_nok DESC,won DESC,name`,
    [orgId],
  );
  return result.rows.map((row) => ({
    userId: String(row.user_id),
    name: String(row.name ?? ""),
    email: row.email ? String(row.email) : null,
    title: String(row.title ?? "Selger"),
    won: Number(row.won ?? 0),
    leads: Number(row.leads ?? 0),
    trend: Number(row.trend ?? 0),
    totalValueNok: Number(row.total_value_nok ?? 0),
  }));
}

/** Commission uses persisted org config and tenant-scoped won CRM deals. */
export async function getCommissionEarnings(
  pool: Pool,
  orgId: string,
  _currentUserId: string,
  periodParam: string,
): Promise<CommissionResult> {
  const period = VALID_PERIODS.has(periodParam) ? periodParam : "month";
  const configResult = await pool.query<{
    preset: string;
    active_models: string[];
    config: Record<string, unknown>;
  }>(
    `SELECT preset,active_models,config FROM sales_commission_configs WHERE organization_id=$1::uuid LIMIT 1`,
    [orgId],
  );
  const persistedConfig = configResult.rows[0];
  const activeModels = persistedConfig?.active_models ?? ["base_percentage"];
  const config = persistedConfig?.config ?? { base_percentage: { rate: 0.10 } };
  const result = await pool.query<Record<string, unknown>>(
    `SELECT om.user_id,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ',u.first_name,u.last_name)),''),u.email,om.user_id) AS name,
            COUNT(c.id)::int AS won_deals,
            COALESCE(SUM(COALESCE(c.won_amount_oere::numeric/100.0,c.deal_amount,0)),0)::float8 AS revenue_nok,
            COALESCE(SUM(COALESCE(c.won_recurring_oere::numeric/100.0,0)),0)::float8 AS recurring_revenue,
            COALESCE((SELECT COUNT(*) FROM crm_lead_activities la
                       JOIN crm_customers ac ON ac.id=la.customer_id
                      WHERE la.user_id=om.user_id AND ac.organization_id=$1::uuid
                        AND la.created_at>=date_trunc('${period}',NOW())),0)::int AS activities
       FROM organization_members om
       LEFT JOIN users u ON u.id=om.user_id
       LEFT JOIN crm_customers c ON c.assigned_user_id=om.user_id
          AND c.organization_id=om.organization_id AND c.archived_at IS NULL
          AND (c.pipeline_stage='won' OR c.status='won' OR c.lead_status='won')
          AND COALESCE(c.won_at,c.deal_stage_changed_at,c.updated_at)>=date_trunc('${period}',NOW())
      WHERE om.organization_id=$1::uuid
      GROUP BY om.user_id,u.first_name,u.last_name,u.email
      ORDER BY revenue_nok DESC,name`,
    [orgId],
  );
  const applied = new Set<string>();
  const ignored = new Set<string>();
  const members = result.rows.map((row): CommissionMember => {
    const revenueNok = Number(row.revenue_nok ?? 0);
    const calculation = calculateCommission({
      revenueNok,
      recurringRevenueNok: Number(row.recurring_revenue ?? 0),
      qualifiedActivities: Number(row.activities ?? 0),
      activeModels,
      config,
    });
    calculation.modelsApplied.forEach((model) => applied.add(model));
    calculation.modelsIgnored.forEach((model) => ignored.add(model));
    return {
      userId: String(row.user_id), name: String(row.name ?? ""),
      wonDeals: Number(row.won_deals ?? 0), revenueNok,
      commissionNok: calculation.commissionNok,
    };
  });
  const baseRate = Number((config.base_percentage as { rate?: unknown } | undefined)?.rate ?? 0.10);
  return {
    period,
    preset: persistedConfig?.preset ?? "standard",
    isDefaultConfig: !persistedConfig,
    rate: Number.isFinite(baseRate) ? baseRate : 0.10,
    modelsApplied: [...applied],
    modelsIgnored: [...ignored],
    members,
    totalCommissionNok: members.reduce((sum, member) => sum + member.commissionNok, 0),
  };
}
