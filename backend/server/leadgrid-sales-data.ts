// leadgrid-sales-data.ts — gjenbrukbare data-uttrekk for Leadgrid salgs-KPI.
//
// Speiler spørringene i sales-leadership-routes (team-members + commission-earnings)
// så infografikk-konnektoren kan hente SAMME tall uten å duplisere HTTP-laget. Samme
// org-scope (via resolveOrgIdForUser hos kalleren) → ingen ny data-eksponering.

import type { Pool } from 'pg';

export interface LeaderboardMember {
  userId: string; name: string; title: string;
  won: number; leads: number; trend: number; totalValueNok: number;
}

async function teamUserIds(pool: Pool, orgId: string, currentUserId: string): Promise<string[]> {
  let ids: string[] = [];
  if (orgId !== currentUserId) {
    const r = await pool.query<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM enterprise_team_members
        WHERE organization_id = $1 AND status = 'active' AND user_id IS NOT NULL`,
      [orgId],
    ).catch(() => ({ rows: [] as Array<{ user_id: string }> }));
    ids = r.rows.map((x) => String(x.user_id));
  }
  if (!ids.includes(currentUserId)) ids.push(currentUserId);
  return ids;
}

/** Team-leaderboard: per selger — vunne premier, leads, 7d-trend, samlet premie-verdi. */
export async function getTeamLeaderboard(pool: Pool, orgId: string, currentUserId: string): Promise<LeaderboardMember[]> {
  const userIds = await teamUserIds(pool, orgId, currentUserId);
  if (!userIds.length) return [];
  const r = await pool.query(
    `SELECT
        u.id AS user_id,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS name,
        COALESCE(u.role, 'Selger') AS title,
        COALESCE((SELECT COUNT(*)::int FROM sales_prize_awards a
                   WHERE a.winner_user_id = u.id AND a.status <> 'cancelled'), 0) AS won,
        COALESCE((SELECT COUNT(*)::int FROM crm_customers c
                   WHERE c.assigned_user_id = u.id AND c.archived_at IS NULL), 0) AS leads,
        COALESCE((
          SELECT LEAST(999, GREATEST(-999, CASE
                   WHEN prev.cnt = 0 AND cur.cnt = 0 THEN 0
                   WHEN prev.cnt = 0 THEN 100
                   ELSE ROUND(((cur.cnt - prev.cnt)::numeric / prev.cnt) * 100)::int END))
            FROM (SELECT COUNT(*)::int AS cnt FROM crm_lead_activities la
                   WHERE la.user_id = u.id AND la.created_at >= NOW() - INTERVAL '7 days') cur,
                 (SELECT COUNT(*)::int AS cnt FROM crm_lead_activities la
                   WHERE la.user_id = u.id AND la.created_at >= NOW() - INTERVAL '14 days'
                     AND la.created_at < NOW() - INTERVAL '7 days') prev), 0) AS trend,
        COALESCE((SELECT SUM(p.estimated_value_nok)::bigint FROM sales_prize_awards a
                   JOIN sales_contest_prizes p ON p.id = a.prize_id
                  WHERE a.winner_user_id = u.id AND a.status <> 'cancelled'), 0) AS total_value_nok
       FROM users u WHERE u.id = ANY($1::varchar[])
      ORDER BY total_value_nok DESC, won DESC, name ASC`,
    [userIds],
  );
  return r.rows.map((row: Record<string, unknown>) => ({
    userId: String(row.user_id), name: String(row.name ?? ''), title: String(row.title ?? 'Selger'),
    won: Number(row.won ?? 0), leads: Number(row.leads ?? 0), trend: Number(row.trend ?? 0),
    totalValueNok: Number(row.total_value_nok ?? 0),
  }));
}

export interface CommissionMember {
  userId: string; name: string; wonDeals: number; revenueNok: number; commissionNok: number;
}
export interface CommissionResult { period: string; rate: number; members: CommissionMember[]; totalCommissionNok: number; }

const VALID_PERIODS = ['month', 'quarter', 'year'];

/** Provisjons-inntjening i perioden: vunne deals + omsetning + provisjon per selger. */
export async function getCommissionEarnings(pool: Pool, orgId: string, currentUserId: string, periodParam: string): Promise<CommissionResult> {
  const period = VALID_PERIODS.includes(periodParam) ? periodParam : 'month';
  let rate = 0.10;
  try {
    const cfg = await pool.query<{ config: Record<string, unknown> }>(
      `SELECT config FROM sales_commission_configs WHERE organization_id = $1::uuid LIMIT 1`, [orgId],
    );
    const base = (cfg.rows[0]?.config as { base_percentage?: { rate?: unknown } })?.base_percentage;
    const r = Number(base?.rate);
    if (Number.isFinite(r) && r > 0 && r <= 1) rate = r;
  } catch { /* orgId ikke uuid → default-sats */ }

  const userIds = await teamUserIds(pool, orgId, currentUserId);
  // date_trunc-argumentet er whitelistet (VALID_PERIODS) → trygt å interpolere.
  const r = await pool.query(
    `SELECT u.id AS user_id,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS name,
            COALESCE(w.won_deals, 0) AS won_deals,
            COALESCE(w.revenue, 0) AS revenue_nok
       FROM users u
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS won_deals, SUM(COALESCE(h.amount_after, c.deal_amount, 0))::numeric AS revenue
           FROM crm_deal_stage_history h JOIN crm_customers c ON c.id = h.customer_id
          WHERE h.to_stage = 'won' AND h.changed_at >= date_trunc('${period}', NOW())
            AND COALESCE(c.assigned_user_id, h.changed_by) = u.id) w ON TRUE
      WHERE u.id = ANY($1::varchar[]) ORDER BY revenue_nok DESC, name ASC`,
    [userIds],
  );
  const members: CommissionMember[] = r.rows.map((row: Record<string, unknown>) => {
    const revenue = Number(row.revenue_nok ?? 0);
    return {
      userId: String(row.user_id), name: String(row.name ?? ''),
      wonDeals: Number(row.won_deals ?? 0), revenueNok: revenue, commissionNok: Math.round(revenue * rate),
    };
  });
  return { period, rate, members, totalCommissionNok: members.reduce((s, m) => s + m.commissionNok, 0) };
}
