import express from "express";
import type { Pool } from "pg";
import { readNumber, readString } from "./_shared";

export interface SalesRoutesDeps {
  app: express.Application;
  pool: Pool;
  resolveSalesLeadsStorageShape: () => Promise<"legacy" | "modern">;
  buildSalesLeadSelectQuery: (shape: "legacy" | "modern") => string;
  buildSalesLeadSelectColumns: (shape: "legacy" | "modern") => string;
  mapSalesLeadRow: (row: Record<string, unknown>) => any;
  ensureCompatSalesLeads: (userId: string) => any[];
  compatResolveUserId: (req: express.Request) => string;
  isMissingRelationError: (error: unknown) => boolean;
  isMissingColumnError: (error: unknown) => boolean;
}

export function setupSalesRoutes(deps: SalesRoutesDeps): void {
  const {
    app,
    pool,
    resolveSalesLeadsStorageShape,
    buildSalesLeadSelectQuery,
    buildSalesLeadSelectColumns,
    mapSalesLeadRow,
    ensureCompatSalesLeads,
    compatResolveUserId,
    isMissingRelationError,
    isMissingColumnError,
  } = deps;

  app.get("/api/sales/analytics/:userId", async (req, res) => {
    try {
      const paramUserId = readString(req.params.userId);
      const queryUserId = readString(req.query.userId);
      const headerUserId = readString(req.headers["x-user-id"]);
      const userId = paramUserId || queryUserId || headerUserId;

      if (!userId || userId === "guest") {
        return res.json({
          totalLeads: 0,
          activeDeals: 0,
          conversionRate: 0,
          totalValue: 0,
          averageDealSize: 0,
          salesCycle: 0,
          closedDeals: 0,
          monthlyTarget: 0,
          topSources: [],
        });
      }

      const latestAnalytics = await pool
        .query(
          `SELECT total_leads, active_deals, conversion_rate, total_value, average_deal_size, sales_cycle, closed_deals, top_sources
           FROM sales_analytics
           WHERE user_id = $1
           ORDER BY period_end DESC NULLS LAST, created_at DESC
           LIMIT 1`,
          [userId],
        )
        .catch(() => ({ rows: [] }));

      if (latestAnalytics.rows.length > 0) {
        const row = latestAnalytics.rows[0] as Record<string, unknown>;
        return res.json({
          totalLeads: Number(row.total_leads || 0),
          activeDeals: Number(row.active_deals || 0),
          conversionRate: Number(row.conversion_rate || 0),
          totalValue: Number(row.total_value || 0),
          averageDealSize: Number(row.average_deal_size || 0),
          salesCycle: Number(row.sales_cycle || 0),
          closedDeals: Number(row.closed_deals || 0),
          monthlyTarget: Number(row.total_value || 0),
          topSources: Array.isArray(row.top_sources) ? row.top_sources : [],
        });
      }

      const aggregate = await pool
        .query(
          `SELECT
             COUNT(*)::int AS total_leads,
             COUNT(*) FILTER (WHERE status NOT IN ('closed','lost'))::int AS active_deals,
             COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_deals,
             COALESCE(SUM(value), 0)::numeric AS total_value,
             COALESCE(AVG(value), 0)::numeric AS average_deal_size,
             COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(next_follow, NOW()) - COALESCE(created_at, NOW()))) / 86400), 0)::numeric AS sales_cycle_days
           FROM sales_leads
           WHERE user_id = $1`,
          [userId],
        )
        .catch(() => ({
          rows: [
            {
              total_leads: 0,
              active_deals: 0,
              closed_deals: 0,
              total_value: 0,
              average_deal_size: 0,
              sales_cycle_days: 0,
            },
          ],
        }));

      const sources = await pool
        .query(
          `SELECT source,
                  COUNT(*)::int AS leads,
                  COUNT(*) FILTER (WHERE status = 'closed')::int AS converted
           FROM sales_leads
           WHERE user_id = $1
           GROUP BY source
           ORDER BY leads DESC
           LIMIT 10`,
          [userId],
        )
        .catch(() => ({ rows: [] }));

      const row = aggregate.rows[0] as Record<string, unknown>;
      const totalLeads = Number(row.total_leads || 0);
      const closedDeals = Number(row.closed_deals || 0);
      const conversionRate =
        totalLeads > 0
          ? Number(((closedDeals / totalLeads) * 100).toFixed(2))
          : 0;

      const topSources = sources.rows.map(
        (sourceRow: Record<string, unknown>) => {
          const leads = Number(sourceRow.leads || 0);
          const converted = Number(sourceRow.converted || 0);
          return {
            source: String(sourceRow.source || "unknown"),
            leads,
            conversion:
              leads > 0
                ? Number(((converted / leads) * 100).toFixed(2))
                : 0,
          };
        },
      );

      res.json({
        totalLeads,
        activeDeals: Number(row.active_deals || 0),
        conversionRate,
        totalValue: Number(row.total_value || 0),
        averageDealSize: Number(row.average_deal_size || 0),
        salesCycle: Number(row.sales_cycle_days || 0),
        closedDeals,
        monthlyTarget: Number(row.total_value || 0),
        topSources,
      });
    } catch (error) {
      console.error("Error fetching sales analytics:", error);
      if (isMissingRelationError(error)) {
        return res.json({
          totalLeads: 0,
          activeDeals: 0,
          conversionRate: 0,
          totalValue: 0,
          averageDealSize: 0,
          salesCycle: 0,
          closedDeals: 0,
          monthlyTarget: 0,
          topSources: [],
        });
      }
      res.status(500).json({ error: "Could not fetch sales analytics" });
    }
  });

  app.get("/api/sales/leads/:status", async (req, res) => {
    try {
      const status = readString(req.params.status) || "all";
      const queryUserId = readString(req.query.userId);
      const headerUserId = readString(req.headers["x-user-id"]);
      const userId = queryUserId || headerUserId;

      if (!userId || userId === "guest") {
        return res.json([]);
      }

      const storageShape = await resolveSalesLeadsStorageShape();
      const params: string[] = [userId];
      let query = `${buildSalesLeadSelectQuery(storageShape)} WHERE user_id = $1`;

      if (status !== "all") {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }

      query += " ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 300";

      const result = await pool.query(query, params);
      res.json(
        result.rows.map((row: Record<string, unknown>) =>
          mapSalesLeadRow(row),
        ),
      );
    } catch (error) {
      console.error("Error fetching sales leads:", error);
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        return res.json([]);
      }
      res.status(500).json({ error: "Could not fetch sales leads" });
    }
  });

  app.put("/api/sales/leads/:leadId", async (req, res) => {
    try {
      const leadId = readString(req.params.leadId);
      if (!leadId) {
        return res.status(400).json({ error: "Lead ID is required" });
      }

      const storageShape = await resolveSalesLeadsStorageShape();
      const payload = req.body as Record<string, unknown>;
      const updates: string[] = [];
      const params: unknown[] = [];

      const assign = (column: string, value: unknown) => {
        params.push(value);
        updates.push(`${column} = $${params.length}`);
      };

      if (readString(payload.status))
        assign("status", readString(payload.status));
      if (readNumber(payload.probability) !== null)
        assign("probability", readNumber(payload.probability));
      if (readString(payload.nextFollow)) {
        assign(
          storageShape === "legacy" ? "expected_close_date" : "next_follow",
          readString(payload.nextFollow),
        );
      }
      if (readString(payload.lastContact) && storageShape === "modern") {
        assign("last_contact", readString(payload.lastContact));
      }
      if (readNumber(payload.value) !== null) {
        assign(
          storageShape === "legacy" ? "estimated_value" : "value",
          readNumber(payload.value),
        );
      }
      if (readString(payload.projectId) && storageShape === "modern")
        assign("project_id", readString(payload.projectId));
      if (readString(payload.notes)) {
        assign(
          storageShape === "legacy" ? "notes" : "special_requests",
          readString(payload.notes),
        );
      }
      if (readString(payload.timeline) && storageShape === "modern")
        assign("timeline", readString(payload.timeline));
      if (readString(payload.location) && storageShape === "modern")
        assign("location", readString(payload.location));

      updates.push("updated_at = NOW()");

      params.push(leadId);
      const result = await pool.query(
        `UPDATE sales_leads
         SET ${updates.join(", ")}
         WHERE id = $${params.length}
         RETURNING ${buildSalesLeadSelectColumns(storageShape)}`,
        params,
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "Lead not found" });
      }

      res.json(mapSalesLeadRow(result.rows[0] as Record<string, unknown>));
    } catch (error) {
      console.error("Error updating sales lead:", error);
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        return res
          .status(503)
          .json({ error: "Sales leads table is not available" });
      }
      res.status(500).json({ error: "Could not update sales lead" });
    }
  });

  // Compat-store fallback for /api/sales/leads (no status filter) — kommer
  // før noen DB-versjon, så den serverer fortsatt traffic.
  app.get("/api/sales/leads", (req, res) => {
    const userId = compatResolveUserId(req);
    const leads = ensureCompatSalesLeads(userId);
    res.json(leads);
  });
}
