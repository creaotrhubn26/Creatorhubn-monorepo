/**
 * admin-leads-growth-routes.ts
 *
 * Månedlig vekst-aggregat for både Leadgrid-kunder (agency_leads,
 * Daniels B2B-pipeline) og org-bruker-leads (crm_customers per org).
 * Brukes for å vise "LeadsGrowthTab" på iPad — graf over måneder.
 *
 * Endpoints:
 *   GET /api/admin-room/leads-growth
 *     ?period=12m (default) | 6m | 3m
 *     ?scope=b2b (default) | org:<id>
 *
 * Response:
 *   {
 *     period: "12m",
 *     scope: "b2b",
 *     buckets: [{ month: "2026-01", new: 5, converted: 2, churned: 1 }, ...],
 *     totalNew: 60, totalConverted: 18, totalChurned: 3,
 *   }
 */

import type { AdminRoomRoutesDeps } from "./_shared";

export function setupAdminLeadsGrowthRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess } = deps;

  app.get("/api/admin-room/leads-growth", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const period = typeof req.query.period === "string" ? req.query.period : "12m";
    const scope = typeof req.query.scope === "string" ? req.query.scope : "b2b";

    const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;

    try {
      // To kilder:
      //   - 'b2b': agency_leads = Daniels Leadgrid-pipeline
      //   - 'org:<uuid>': crm_customers for én org-er kunder
      if (scope === "b2b") {
        const r = await pool.query<{
          month: string;
          new_count: string;
          converted_count: string;
          churned_count: string;
        }>(
          `WITH months AS (
             SELECT to_char(date_trunc('month', generate_series(
               (now() - ($1::int - 1) * INTERVAL '1 month'),
               now(),
               INTERVAL '1 month'
             )), 'YYYY-MM') AS m
           )
           SELECT
             months.m AS month,
             COUNT(*) FILTER (
               WHERE to_char(date_trunc('month', l.created_at), 'YYYY-MM') = months.m
             ) AS new_count,
             COUNT(*) FILTER (
               WHERE l.customer_at IS NOT NULL
                 AND to_char(date_trunc('month', l.customer_at), 'YYYY-MM') = months.m
             ) AS converted_count,
             COUNT(*) FILTER (
               WHERE l.status = 'disqualified'
                 AND to_char(date_trunc('month', l.updated_at), 'YYYY-MM') = months.m
             ) AS churned_count
           FROM months
           LEFT JOIN agency_leads l ON TRUE
           GROUP BY months.m
           ORDER BY months.m`,
          [months],
        );

        const buckets = r.rows.map((row) => ({
          month: row.month,
          new: Number(row.new_count) || 0,
          converted: Number(row.converted_count) || 0,
          churned: Number(row.churned_count) || 0,
        }));

        return res.json({
          period,
          scope,
          buckets,
          totalNew: buckets.reduce((s, b) => s + b.new, 0),
          totalConverted: buckets.reduce((s, b) => s + b.converted, 0),
          totalChurned: buckets.reduce((s, b) => s + b.churned, 0),
        });
      }

      // org:<uuid>-scope
      const orgIdMatch = scope.match(/^org:(.+)$/);
      if (!orgIdMatch) {
        return res.status(400).json({ error: "Ugyldig scope. Bruk 'b2b' eller 'org:<uuid>'." });
      }
      const orgId = orgIdMatch[1];

      const r = await pool.query<{
        month: string;
        new_count: string;
        won_count: string;
        lost_count: string;
      }>(
        `WITH months AS (
           SELECT to_char(date_trunc('month', generate_series(
             (now() - ($1::int - 1) * INTERVAL '1 month'),
             now(),
             INTERVAL '1 month'
           )), 'YYYY-MM') AS m
         )
         SELECT
           months.m AS month,
           COUNT(c.id) FILTER (
             WHERE to_char(date_trunc('month', c.created_at), 'YYYY-MM') = months.m
           ) AS new_count,
           COUNT(c.id) FILTER (
             WHERE c.status = 'won'
               AND c.won_at IS NOT NULL
               AND to_char(date_trunc('month', c.won_at), 'YYYY-MM') = months.m
           ) AS won_count,
           COUNT(c.id) FILTER (
             WHERE c.status = 'lost'
               AND c.lost_at IS NOT NULL
               AND to_char(date_trunc('month', c.lost_at), 'YYYY-MM') = months.m
           ) AS lost_count
         FROM months
         LEFT JOIN crm_customers c
           ON c.project_id IN (
             SELECT id FROM casting_projects WHERE organization_id::text = $2
           )
         GROUP BY months.m
         ORDER BY months.m`,
        [months, orgId],
      );

      const buckets = r.rows.map((row) => ({
        month: row.month,
        new: Number(row.new_count) || 0,
        converted: Number(row.won_count) || 0,
        churned: Number(row.lost_count) || 0,
      }));

      return res.json({
        period,
        scope,
        buckets,
        totalNew: buckets.reduce((s, b) => s + b.new, 0),
        totalConverted: buckets.reduce((s, b) => s + b.converted, 0),
        totalChurned: buckets.reduce((s, b) => s + b.churned, 0),
      });
    } catch (err) {
      console.error("[leads-growth] error", err);
      return res.status(500).json({ error: "Kunne ikke beregne leads-growth" });
    }
  });
}
