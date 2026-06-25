/**
 * lead-map-leaderboard-routes.ts
 *
 * Team-leaderboard for Salgssjef/Teamleder/Admin:
 *
 *   GET /organizations/:id/leaderboard
 *     ?period=this_month|last_30d|ytd
 *     ?team_id=optional
 *     ?sort=achieved|progress|won|meetings
 *
 *   GET /teams/:teamId/leaderboard
 *     Forenklet wrapper som scoper til ett team.
 *
 *   GET /organizations/:id/leaderboard-summary
 *     Top-line: total achieved, total target, top performer,
 *     avg progress, total meetings, total won.
 *
 * Tilgang:
 *   - Krever permissions.manage ELLER admin/salgssjef/teamleder-rolle
 *     for å se andres performance.
 *   - Salgskonsulent kan se sin egen + teamets totaler (begrenset).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUser(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return activeSessions.get(auth.slice(7)) ?? null;
  }
  return null;
}

type Period = "this_month" | "last_30d" | "ytd";

function yearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Gir SQL WHERE-clause + params (start_index) for periode-filter
 *  på `crm_customers.updated_at` (won-leads) eller `crm_visits.visit_datetime`. */
function periodFilter(
  period: Period,
  column: string,
  startParamIdx: number,
): { sql: string; params: unknown[] } {
  switch (period) {
    case "this_month":
      return {
        sql: `to_char(${column}, 'YYYY-MM') = $${startParamIdx}`,
        params: [yearMonth()],
      };
    case "last_30d":
      return {
        sql: `${column} > NOW() - INTERVAL '30 days'`,
        params: [],
      };
    case "ytd":
      return {
        sql: `to_char(${column}, 'YYYY') = $${startParamIdx}`,
        params: [String(new Date().getUTCFullYear())],
      };
  }
}

/** Sjekk om bruker kan se andres performance i org-en */
async function canViewOthers(
  pool: Pool, userId: string, organizationId: string,
): Promise<{ canViewAll: boolean; canViewTeam: boolean; salesTeamId: string | null }> {
  const r = await pool.query<{ role: string; sales_team_id: string | null }>(
    `SELECT role, sales_team_id::text FROM organization_members
      WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
    [organizationId, userId],
  );
  const row = r.rows[0];
  if (!row) return { canViewAll: false, canViewTeam: false, salesTeamId: null };
  return {
    canViewAll: ["admin", "salgssjef"].includes(row.role),
    canViewTeam: row.role === "teamleder",
    salesTeamId: row.sales_team_id,
  };
}

interface LeaderboardRow {
  user_id: string;
  display_name: string | null;
  user_name: string | null;
  user_email: string | null;
  avatar_url: string | null;
  title: string | null;
  role: string;
  sales_team_id: string | null;
  team_name: string | null;
  territory: string | null;
  target_nok: string;
  achieved_nok: string;
  won_count: number;
  lost_count: number;
  meetings_count: number;
  leads_assigned: number;
  leads_active: number;
}

export function registerLeadMapLeaderboardRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── GET /organizations/:id/leaderboard ─────────────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/leaderboard",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const orgId = req.params.id;
      const period = (req.query.period as Period | undefined) ?? "this_month";
      if (!["this_month", "last_30d", "ytd"].includes(period)) {
        return res.status(400).json({ error: "ugyldig_periode" });
      }
      const teamFilter = (req.query.team_id as string | undefined) ?? null;
      const sortBy = (req.query.sort as string | undefined) ?? "progress";

      const { canViewAll, canViewTeam, salesTeamId } =
        await canViewOthers(pool, session.userId, orgId);
      if (!canViewAll && !canViewTeam) {
        return res.status(403).json({ error: "mangler_tilgang_leaderboard" });
      }

      // Hvis teamleder uten team_id: scope til eget team automatisk
      const effectiveTeam = canViewAll ? teamFilter : (teamFilter ?? salesTeamId);

      try {
        // Bygg parametere
        const wonFilter = periodFilter(period, "c.updated_at", 1);
        const visitFilter = periodFilter(period, "v.visit_datetime", 1);
        const ym = yearMonth();

        const params: unknown[] = [orgId];
        let idx = 2;

        // Periode-filter param
        let wonPeriodClause = wonFilter.sql.replace(/\$1/g, `$${idx}`);
        for (const p of wonFilter.params) {
          params.push(p);
          idx += 1;
        }
        let visitPeriodClause = visitFilter.sql.replace(/\$1/g, `$${idx}`);
        for (const p of visitFilter.params) {
          params.push(p);
          idx += 1;
        }

        // Team-filter
        let teamClause = "";
        if (effectiveTeam) {
          teamClause = `AND om.sales_team_id = $${idx}`;
          params.push(effectiveTeam);
          idx += 1;
        }

        // year_month for quota-lookup
        params.push(ym);
        const ymParamIdx = idx;

        const r = await pool.query<LeaderboardRow>(
          `WITH member_base AS (
             SELECT om.user_id, om.role, om.sales_team_id::text AS sales_team_id,
                    st.name AS team_name,
                    u.email AS user_email, NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS user_name,
                    up.display_name, up.avatar_url, up.title, up.territory,
                    COALESCE(
                      (SELECT lqt.target_nok::text FROM lead_quota_targets lqt
                        WHERE lqt.organization_id = om.organization_id
                          AND lqt.user_id = om.user_id
                          AND lqt.year_month = $${ymParamIdx}),
                      up.quota_monthly_nok::text,
                      '0'
                    ) AS target_nok
               FROM organization_members om
               LEFT JOIN users u ON u.id = om.user_id
               LEFT JOIN user_profiles up
                 ON up.user_id = om.user_id
                AND up.organization_id = om.organization_id
               LEFT JOIN sales_teams st ON st.id = om.sales_team_id
              WHERE om.organization_id = $1
                AND om.role IN ('salgskonsulent','teamleder','salgssjef','promotor')
                ${teamClause}
           ),
           won_stats AS (
             SELECT c.assigned_user_id AS user_id,
                    COALESCE(SUM(c.estimated_value), 0)::text AS achieved_nok,
                    COUNT(*) FILTER (WHERE c.lead_status = 'won')::int AS won_count,
                    COUNT(*) FILTER (WHERE c.lead_status = 'lost')::int AS lost_count
               FROM crm_customers c
              WHERE c.assigned_user_id IS NOT NULL
                AND c.lead_status IN ('won', 'lost')
                AND ${wonPeriodClause}
              GROUP BY c.assigned_user_id
           ),
           visit_stats AS (
             SELECT c.assigned_user_id AS user_id,
                    COUNT(*)::int AS meetings_count
               FROM crm_visits v
               JOIN crm_customers c ON c.id = v.customer_id
              WHERE v.visit_type IN ('online_meeting','physical')
                AND ${visitPeriodClause}
              GROUP BY c.assigned_user_id
           ),
           assigned_stats AS (
             SELECT assigned_user_id AS user_id,
                    COUNT(*)::int AS leads_assigned,
                    COUNT(*) FILTER (
                      WHERE lead_status NOT IN ('won','lost','do_not_contact')
                    )::int AS leads_active
               FROM crm_customers
              WHERE assigned_user_id IS NOT NULL
              GROUP BY assigned_user_id
           )
           SELECT mb.user_id, mb.display_name, mb.user_name, mb.user_email,
                  mb.avatar_url, mb.title, mb.role,
                  mb.sales_team_id, mb.team_name, mb.territory,
                  mb.target_nok,
                  COALESCE(ws.achieved_nok, '0') AS achieved_nok,
                  COALESCE(ws.won_count, 0) AS won_count,
                  COALESCE(ws.lost_count, 0) AS lost_count,
                  COALESCE(vs.meetings_count, 0) AS meetings_count,
                  COALESCE(asg.leads_assigned, 0) AS leads_assigned,
                  COALESCE(asg.leads_active, 0) AS leads_active
             FROM member_base mb
             LEFT JOIN won_stats ws ON ws.user_id = mb.user_id
             LEFT JOIN visit_stats vs ON vs.user_id = mb.user_id
             LEFT JOIN assigned_stats asg ON asg.user_id = mb.user_id`,
          params,
        );

        // Beriket med rank + progresjon i JS (lettere enn i SQL)
        const enriched = r.rows.map((row) => {
          const target = Number(row.target_nok);
          const achieved = Number(row.achieved_nok);
          const progressPct = target > 0 ? Math.round((achieved / target) * 100) : null;
          const closeRate = (row.won_count + row.lost_count) > 0
            ? Math.round((row.won_count / (row.won_count + row.lost_count)) * 100)
            : null;
          return {
            userId: row.user_id,
            displayName: row.display_name ?? row.user_name ?? row.user_email,
            email: row.user_email,
            avatarUrl: row.avatar_url,
            title: row.title,
            role: row.role,
            salesTeamId: row.sales_team_id,
            teamName: row.team_name,
            territory: row.territory,
            targetNok: target,
            achievedNok: achieved,
            wonCount: row.won_count,
            lostCount: row.lost_count,
            meetingsCount: row.meetings_count,
            leadsAssigned: row.leads_assigned,
            leadsActive: row.leads_active,
            progressPct,
            closeRate,
          };
        });

        // Sortér basert på sortBy
        enriched.sort((a, b) => {
          switch (sortBy) {
            case "achieved":
              return b.achievedNok - a.achievedNok;
            case "won":
              return b.wonCount - a.wonCount;
            case "meetings":
              return b.meetingsCount - a.meetingsCount;
            case "progress":
            default: {
              const ap = a.progressPct ?? -1;
              const bp = b.progressPct ?? -1;
              return bp - ap;
            }
          }
        });

        // Legg til rank
        const ranked = enriched.map((row, i) => ({ rank: i + 1, ...row }));

        return res.json({
          leaderboard: ranked,
          period,
          teamFilter: effectiveTeam,
          sortBy,
        });
      } catch (err) {
        return res.status(500).json({ error: "leaderboard_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /organizations/:id/leaderboard-summary ─────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/leaderboard-summary",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const orgId = req.params.id;
      const period = (req.query.period as Period | undefined) ?? "this_month";

      const { canViewAll, canViewTeam } =
        await canViewOthers(pool, session.userId, orgId);
      if (!canViewAll && !canViewTeam) {
        return res.status(403).json({ error: "mangler_tilgang_leaderboard" });
      }

      try {
        const wonFilter = periodFilter(period, "c.updated_at", 1);
        const visitFilter = periodFilter(period, "v.visit_datetime", 1);
        const ym = yearMonth();

        const params: unknown[] = [orgId];
        let idx = 2;
        let wonPeriodClause = wonFilter.sql.replace(/\$1/g, `$${idx}`);
        for (const p of wonFilter.params) {
          params.push(p);
          idx += 1;
        }
        let visitPeriodClause = visitFilter.sql.replace(/\$1/g, `$${idx}`);
        for (const p of visitFilter.params) {
          params.push(p);
          idx += 1;
        }
        params.push(ym);
        const ymParamIdx = idx;

        const r = await pool.query<{
          total_achieved: string;
          total_target: string;
          total_won: number;
          total_lost: number;
          total_meetings: number;
          active_sellers: number;
        }>(
          `WITH org_users AS (
             SELECT user_id FROM organization_members
              WHERE organization_id = $1
                AND role IN ('salgskonsulent','teamleder','salgssjef','promotor')
           ),
           targets AS (
             SELECT COALESCE(SUM(
               COALESCE(
                 (SELECT lqt.target_nok FROM lead_quota_targets lqt
                   WHERE lqt.organization_id = $1
                     AND lqt.user_id = ou.user_id
                     AND lqt.year_month = $${ymParamIdx}),
                 up.quota_monthly_nok,
                 0
               )
             ), 0)::text AS total_target,
             COUNT(*)::int AS active_sellers
             FROM org_users ou
             LEFT JOIN user_profiles up
               ON up.user_id = ou.user_id
              AND up.organization_id = $1
           ),
           won_agg AS (
             SELECT COALESCE(SUM(c.estimated_value), 0)::text AS total_achieved,
                    COUNT(*) FILTER (WHERE c.lead_status = 'won')::int AS total_won,
                    COUNT(*) FILTER (WHERE c.lead_status = 'lost')::int AS total_lost
               FROM crm_customers c
              WHERE c.assigned_user_id IN (SELECT user_id FROM org_users)
                AND c.lead_status IN ('won','lost')
                AND ${wonPeriodClause}
           ),
           visit_agg AS (
             SELECT COUNT(*)::int AS total_meetings
               FROM crm_visits v
               JOIN crm_customers c ON c.id = v.customer_id
              WHERE c.assigned_user_id IN (SELECT user_id FROM org_users)
                AND v.visit_type IN ('online_meeting','physical')
                AND ${visitPeriodClause}
           )
           SELECT
             (SELECT total_achieved FROM won_agg) AS total_achieved,
             (SELECT total_target FROM targets) AS total_target,
             (SELECT total_won FROM won_agg) AS total_won,
             (SELECT total_lost FROM won_agg) AS total_lost,
             (SELECT total_meetings FROM visit_agg) AS total_meetings,
             (SELECT active_sellers FROM targets) AS active_sellers`,
          params,
        );

        const row = r.rows[0];
        const target = Number(row?.total_target ?? 0);
        const achieved = Number(row?.total_achieved ?? 0);
        const won = row?.total_won ?? 0;
        const lost = row?.total_lost ?? 0;
        return res.json({
          period,
          totalTargetNok: target,
          totalAchievedNok: achieved,
          progressPct: target > 0 ? Math.round((achieved / target) * 100) : null,
          totalWon: won,
          totalLost: lost,
          totalMeetings: row?.total_meetings ?? 0,
          activeSellers: row?.active_sellers ?? 0,
          closeRate: (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : null,
        });
      } catch (err) {
        return res.status(500).json({ error: "summary_failed", detail: String(err) });
      }
    },
  );
}
