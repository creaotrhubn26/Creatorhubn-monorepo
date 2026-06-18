/**
 * lead-portfolio-routes.ts
 *
 * Portefølje-view: alle kundeprosjekter for én organisasjon, m/
 * aggregert lead-data (Leadgrid-score, needs-count, signals-count,
 * sist trålet). Mater iPad-en sin ProjectsPortfolioView.
 *
 *   GET  /api/admin-room/lead-map/organizations/:id/portfolio
 *        Gated på leads.view-permission.
 *
 * Sortering: highest score først (default), kan overstyres m/ ?sort=
 * recent | score | name.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

interface PortfolioProjectRow {
  project_id: string;
  project_name: string;
  project_status: string;
  project_type: string | null;
  project_description: string | null;
  created_at: string;

  // Kunde-data (én kunde pr prosjekt i Helsetech-modellen; UI viser
  // første hvis flere)
  customer_id: string | null;
  customer_name: string | null;
  website_url: string | null;
  logo_url: string | null;
  lead_status: string | null;
  lead_category: string | null;
  ai_opportunity_score: number | null;
  claude_ranked_at: string | null;
  tags: string[] | null;

  // Aggregert scout-data
  needs_count: number;
  signals_positive_count: number;
  signals_negative_count: number;
  last_scout_at: string | null;
}

export function registerLeadPortfolioRoutes({ app, pool, activeSessions }: Deps): void {
  const ROOT = "/api/admin-room/lead-map";

  app.get(
    `${ROOT}/organizations/:id/portfolio`,
    requireLeadMapPermission("leads.view", { pool, activeSessions }),
    async (req: Request, res: Response) => {
      const orgId = req.params.id;
      const sort = typeof req.query.sort === "string" ? req.query.sort : "score";
      const statusFilter = typeof req.query.status === "string"
        ? req.query.status : null;

      const orderBy = sort === "recent"
        ? "cp.created_at DESC NULLS LAST"
        : sort === "name"
          ? "cp.name ASC"
          : "cc.ai_opportunity_score DESC NULLS LAST";

      const conditions: string[] = [
        "cp.organization_id = $1",
        "cp.project_type = 'kundeprosjekt'",
      ];
      const params: unknown[] = [orgId];
      if (statusFilter) {
        params.push(statusFilter);
        conditions.push(`cp.status = $${params.length}`);
      }

      try {
        const r = await pool.query<PortfolioProjectRow>(
          `SELECT
              cp.id::text AS project_id,
              cp.name AS project_name,
              cp.status AS project_status,
              cp.project_type,
              cp.description AS project_description,
              cp.created_at::text,
              cc.id::text AS customer_id,
              cc.name AS customer_name,
              cc.website_url,
              cc.logo_url,
              cc.lead_status,
              cc.lead_category,
              cc.ai_opportunity_score,
              cc.claude_ranked_at::text,
              cc.tags,
              COALESCE(needs.count, 0)::int AS needs_count,
              COALESCE(sig_pos.count, 0)::int AS signals_positive_count,
              COALESCE(sig_neg.count, 0)::int AS signals_negative_count,
              last_run.started_at::text AS last_scout_at
           FROM casting_projects cp
           LEFT JOIN LATERAL (
             SELECT id::text, name, website_url, logo_url, lead_status,
                    lead_category, ai_opportunity_score, claude_ranked_at,
                    tags
               FROM crm_customers
              WHERE project_id = cp.id
              ORDER BY ai_opportunity_score DESC NULLS LAST
              LIMIT 1
           ) cc ON true
           LEFT JOIN LATERAL (
             SELECT count(*) AS count FROM crm_customer_needs
              WHERE customer_id = cc.id::text
                AND status IN ('detected', 'accepted')
           ) needs ON true
           LEFT JOIN LATERAL (
             SELECT count(*) AS count FROM crm_customer_signals
              WHERE customer_id = cc.id::text AND polarity = 'positive'
           ) sig_pos ON true
           LEFT JOIN LATERAL (
             SELECT count(*) AS count FROM crm_customer_signals
              WHERE customer_id = cc.id::text AND polarity = 'negative'
           ) sig_neg ON true
           LEFT JOIN LATERAL (
             SELECT started_at FROM crm_customer_scout_runs
              WHERE customer_id = cc.id::text AND status = 'completed'
              ORDER BY started_at DESC LIMIT 1
           ) last_run ON true
           WHERE ${conditions.join(" AND ")}
           ORDER BY ${orderBy}
           LIMIT 100`,
          params,
        );

        // Aggregat-statistikk for tab-header
        const stats = await pool.query<{
          total: string;
          avg_score: string;
          total_needs: string;
        }>(
          `SELECT count(DISTINCT cp.id)::text AS total,
                  COALESCE(ROUND(AVG(cc.ai_opportunity_score)), 0)::text AS avg_score,
                  COALESCE(SUM(needs.count), 0)::text AS total_needs
             FROM casting_projects cp
             LEFT JOIN LATERAL (
               SELECT ai_opportunity_score FROM crm_customers
                WHERE project_id = cp.id
                ORDER BY ai_opportunity_score DESC NULLS LAST LIMIT 1
             ) cc ON true
             LEFT JOIN LATERAL (
               SELECT count(*) AS count FROM crm_customer_needs
                WHERE customer_id::text IN (
                  SELECT id::text FROM crm_customers WHERE project_id = cp.id
                )
                  AND status IN ('detected', 'accepted')
             ) needs ON true
            WHERE cp.organization_id = $1 AND cp.project_type = 'kundeprosjekt'`,
          [orgId],
        );

        return res.json({
          projects: r.rows,
          summary: {
            total_projects: Number(stats.rows[0]?.total ?? 0),
            avg_score: Number(stats.rows[0]?.avg_score ?? 0),
            total_needs: Number(stats.rows[0]?.total_needs ?? 0),
          },
        });
      } catch (err) {
        return res.status(500).json({
          error: "portfolio_failed",
          detail: String(err).slice(0, 500),
        });
      }
    },
  );
}
