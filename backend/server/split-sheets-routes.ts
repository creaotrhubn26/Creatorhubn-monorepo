/**
 * split-sheets-routes.ts
 *
 * Standalone modul for /api/split-sheets/* inline-handlere (23 routes).
 * Ekstraktert fra backend/server/index.ts (linje 70469-71282).
 *
 * NB: EaseVerse-link-routes (4 stk) + SongFlow-aliases (4 stk) er IKKE
 * inkludert her — de bevarer dep-injected handlers og er trivielle
 * wirings som blir igjen i index.ts.
 *
 * 23 routes (alle inline-handlers):
 *   - GET  /api/split-sheets               — list user's sheets
 *   - GET  /api/split-sheets/invoices      — invoices stub
 *   - GET  /api/split-sheets/stats         — dashboard stats
 *   - GET  /api/split-sheets/revenue-analytics
 *   - GET  /api/split-sheets/payment-analytics
 *   - GET  /api/split-sheets/market-insights
 *   - GET  /api/split-sheets/:id           — sheet detail
 *   - POST /api/split-sheets                — create
 *   - PUT  /api/split-sheets/:id           — update
 *   - DELETE /api/split-sheets/:id         — delete
 *   - POST /api/split-sheets/:id/sign      — sign
 *   - POST /api/split-sheets/:id/share     — share via email
 *   - GET  /api/split-sheets/:id/pdf       — generate PDF
 *   - GET  /api/split-sheets/:id/versions  — version history
 *   - POST /api/split-sheets/:id/duplicate — duplicate sheet
 *   - POST /api/split-sheets/:id/revenue   — record revenue entry
 *   - GET  /api/split-sheets/:id/revenue   — list revenue entries
 *   - GET  /api/split-sheets/:id/payments  — list payment plan
 *   - PUT  /api/split-sheets/payments/:paymentId — update payment
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupSplitSheetsRoutes } from "./split-sheets-routes";
 *
 *   setupSplitSheetsRoutes({ app, pool, getSplitSheetUserId });
 */

import type express from "express";
import type { Pool } from "pg";
import { randomUUID } from "crypto";

export interface SplitSheetsRoutesDeps {
  app: express.Application;
  pool: Pool;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSplitSheetUserId: (req: any) => string;
}

export function setupSplitSheetsRoutes(deps: SplitSheetsRoutesDeps): void {
  const { app, pool, getSplitSheetUserId } = deps;

  // GET /api/split-sheets — List all split sheets for user
  app.get("/api/split-sheets", async (req, res) => {
    try {
      const userId = getSplitSheetUserId(req);
      const { status, project_id, track_id, limit = 50 } = req.query;

      let query = `
        SELECT ss.*,
          COUNT(DISTINCT ssc.id) as contributor_count,
          COUNT(DISTINCT CASE WHEN ssc.signed_at IS NOT NULL THEN ssc.id END) as signed_count
        FROM split_sheets ss
        LEFT JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
        WHERE ss.user_id = $1
      `;
      const params: any[] = [userId];
      let idx = 2;

      if (status) {
        query += ` AND ss.status = $${idx++}`;
        params.push(status);
      }
      if (project_id) {
        query += ` AND ss.project_id = $${idx++}`;
        params.push(project_id);
      }
      if (track_id) {
        query += ` AND ss.track_id = $${idx++}`;
        params.push(track_id);
      }

      query += ` GROUP BY ss.id ORDER BY ss.updated_at DESC LIMIT $${idx}`;
      params.push(Number(limit));

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error("Error fetching split sheets:", error);
      res.json({ success: true, data: [] });
    }
  });

  // GET /api/split-sheets/stats — Dashboard stats
  // Triage-fix: /api/split-sheets/invoices ble fanget av :id-route under
  // (linje ~98720) som tolket "invoices" som UUID og kastet 500. Tomt
  // stub-svar her registrerer en konkret rute før catch-all så Express
  // matcher denne først.
  app.get("/api/split-sheets/invoices", async (_req, res) => {
    res.json([]);
  });

  app.get("/api/split-sheets/stats", async (req, res) => {
    try {
      const userId = (req.headers["x-user-id"] as string) || "anonymous";

      const totalResult = await pool.query(
        "SELECT COUNT(*) as count FROM split_sheets WHERE user_id = $1",
        [userId],
      );
      const pendingResult = await pool.query(
        `SELECT COUNT(*) as count FROM split_sheets ss
         JOIN split_sheet_contributors ssc ON ssc.split_sheet_id = ss.id
         WHERE ss.user_id = $1 AND ssc.signed_at IS NULL`,
        [userId],
      );
      const completedResult = await pool.query(
        `SELECT COUNT(*) as count FROM split_sheets ss
         WHERE ss.user_id = $1 AND ss.status = 'completed'`,
        [userId],
      );
      const revenueResult = await pool.query(
        `SELECT COALESCE(SUM(ssc.percentage), 0) as total FROM split_sheet_contributors ssc
         JOIN split_sheets ss ON ss.id = ssc.split_sheet_id
         WHERE ss.user_id = $1`,
        [userId],
      );

      return res.json({
        data: {
          total: parseInt(totalResult.rows[0]?.count || "0"),
          pendingSignatures: parseInt(pendingResult.rows[0]?.count || "0"),
          totalRevenue: parseFloat(revenueResult.rows[0]?.total || "0"),
          completed: parseInt(completedResult.rows[0]?.count || "0"),
        },
      });
    } catch (error) {
      console.error("Split sheets stats error:", error);
      return res.json({
        data: { total: 0, pendingSignatures: 0, totalRevenue: 0, completed: 0 },
      });
    }
  });

  // GET /api/split-sheets/revenue-analytics — Revenue trends from split sheets (BI Dashboard)
  app.get("/api/split-sheets/revenue-analytics", async (req, res) => {
    try {
      const profession = req.query.profession as string;

      // Monthly revenue trends from split sheets
      const trendsResult = await pool.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', ss.created_at), 'YYYY-MM') AS month,
           COUNT(ss.id) AS sheet_count,
           SUM(ss.total_percentage) AS total_percentage
         FROM split_sheets ss
         GROUP BY DATE_TRUNC('month', ss.created_at)
         ORDER BY month ASC`,
      );

      const trends = trendsResult.rows.map(
        (row: {
          month: string;
          sheet_count: string;
          total_percentage: string;
        }) => ({
          month: `${row.month}-01`,
          totalRevenue: parseInt(row.sheet_count) * 5000,
          sheetCount: parseInt(row.sheet_count),
        }),
      );

      // Revenue by project
      const byProjectResult = await pool.query(
        `SELECT ss.title AS project_name, ss.total_percentage, ss.status,
                COUNT(ssc.id) AS contributor_count
         FROM split_sheets ss
         LEFT JOIN split_sheet_contributors ssc ON ssc.split_sheet_id = ss.id
         GROUP BY ss.id, ss.title, ss.total_percentage, ss.status
         ORDER BY ss.created_at DESC
         LIMIT 10`,
      );

      const byProject = byProjectResult.rows.map(
        (row: {
          project_name: string;
          total_percentage: string;
          contributor_count: string;
          status: string;
        }) => ({
          projectName: row.project_name || "Ukjent prosjekt",
          totalRevenue: parseFloat(row.total_percentage) * 100,
          contributorCount: parseInt(row.contributor_count),
          status: row.status,
        }),
      );

      res.json({ data: { trends, byProject } });
    } catch (error) {
      console.error("Revenue analytics error:", error);
      res.status(500).json({ error: "Failed to load revenue analytics" });
    }
  });

  // GET /api/split-sheets/payment-analytics — Payment status distribution (BI Dashboard)
  app.get("/api/split-sheets/payment-analytics", async (req, res) => {
    try {
      const statusResult = await pool.query(
        `SELECT status, COUNT(*) AS count
         FROM split_sheets
         GROUP BY status
         ORDER BY count DESC`,
      );

      const statusDistribution = statusResult.rows.map(
        (row: { status: string; count: string }) => ({
          status: row.status || "unknown",
          count: parseInt(row.count),
        }),
      );

      const processingResult = await pool.query(
        `SELECT
           AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400) AS avg_days,
           MIN(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400) AS min_days,
           MAX(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400) AS max_days
         FROM split_sheets
         WHERE completed_at IS NOT NULL`,
      );

      const proc = processingResult.rows[0];
      const averageProcessing = {
        avgDays: parseFloat(proc?.avg_days) || 14.0,
        minDays: parseFloat(proc?.min_days) || 3.0,
        maxDays: parseFloat(proc?.max_days) || 30.0,
      };

      res.json({ data: { statusDistribution, averageProcessing } });
    } catch (error) {
      console.error("Payment analytics error:", error);
      res.status(500).json({ error: "Failed to load payment analytics" });
    }
  });

  // GET /api/split-sheets/market-insights — Industry benchmarks for split sheets (BI Dashboard)
  app.get("/api/split-sheets/market-insights", async (_req, res) => {
    try {
      const roleResult = await pool.query(
        `SELECT
           ssc.role,
           AVG(ssc.percentage) AS avg_percentage,
           MIN(ssc.percentage) AS min_percentage,
           MAX(ssc.percentage) AS max_percentage,
           COUNT(ssc.id) AS count
         FROM split_sheet_contributors ssc
         WHERE ssc.role IS NOT NULL AND ssc.role != ''
         GROUP BY ssc.role
         ORDER BY avg_percentage DESC`,
      );

      const averageSplitsByRole = roleResult.rows.map(
        (row: {
          role: string;
          avg_percentage: string;
          min_percentage: string;
          max_percentage: string;
          count: string;
        }) => ({
          role: row.role,
          avgPercentage: parseFloat(parseFloat(row.avg_percentage).toFixed(2)),
          minPercentage: parseFloat(parseFloat(row.min_percentage).toFixed(2)),
          maxPercentage: parseFloat(parseFloat(row.max_percentage).toFixed(2)),
          count: parseInt(row.count),
        }),
      );

      const recommendations: string[] = [];
      for (const role of averageSplitsByRole) {
        if (role.role === "producer" && role.avgPercentage > 60) {
          recommendations.push(
            `Produsenter får i snitt ${role.avgPercentage.toFixed(0)}% – vurder om dette reflekterer arbeidsinnsatsen`,
          );
        }
        if (role.role === "collaborator" && role.avgPercentage < 25) {
          recommendations.push(
            `Samarbeidspartnere får i snitt ${role.avgPercentage.toFixed(0)}% – sørg for rettferdig fordeling`,
          );
        }
      }
      if (averageSplitsByRole.length === 0) {
        recommendations.push(
          "Legg til split sheets for å se industri-benchmarks",
        );
      }
      recommendations.push(
        "Dokumenter alle avtaler skriftlig med signerte split sheets",
      );
      recommendations.push(
        "Gjennomgå split-fordelingen regelmessig for alle pågående prosjekter",
      );

      res.json({ data: { averageSplitsByRole, recommendations } });
    } catch (error) {
      console.error("Market insights error:", error);
      res.status(500).json({ error: "Failed to load market insights" });
    }
  });

  // GET /api/split-sheets/:id — Get split sheet details with contributors
  app.get("/api/split-sheets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const ssResult = await pool.query(
        "SELECT * FROM split_sheets WHERE id = $1",
        [id],
      );
      if (ssResult.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Split sheet not found" });
      }
      const contribs = await pool.query(
        "SELECT * FROM split_sheet_contributors WHERE split_sheet_id = $1 ORDER BY order_index ASC, created_at ASC",
        [id],
      );
      res.json({
        success: true,
        data: { ...ssResult.rows[0], contributors: contribs.rows },
      });
    } catch (error) {
      console.error("Error fetching split sheet:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch split sheet" });
    }
  });

  // POST /api/split-sheets — Create new split sheet
  app.post("/api/split-sheets", async (req, res) => {
    try {
      const userId = getSplitSheetUserId(req);
      const {
        project_id,
        track_id,
        title,
        description,
        contributors = [],
      } = req.body;
      const id = crypto.randomUUID();

      await pool.query(
        `INSERT INTO split_sheets (id, user_id, project_id, track_id, title, description, status, total_percentage, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft', 0, '{}')`,
        [
          id,
          userId,
          project_id || null,
          track_id || null,
          title || "Untitled Split Sheet",
          description || null,
        ],
      );

      for (let i = 0; i < contributors.length; i++) {
        const c = contributors[i];
        await pool.query(
          `INSERT INTO split_sheet_contributors (id, split_sheet_id, name, email, role, percentage, order_index, user_id, custom_fields)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            crypto.randomUUID(),
            id,
            c.name,
            c.email || null,
            c.role || "collaborator",
            c.percentage || 0,
            i,
            c.user_id || null,
            JSON.stringify(c.custom_fields || {}),
          ],
        );
      }

      // Update total_percentage
      await pool.query(
        "UPDATE split_sheets SET total_percentage = (SELECT COALESCE(SUM(percentage), 0) FROM split_sheet_contributors WHERE split_sheet_id = $1) WHERE id = $1",
        [id],
      );

      const result = await pool.query(
        "SELECT * FROM split_sheets WHERE id = $1",
        [id],
      );
      const contribs = await pool.query(
        "SELECT * FROM split_sheet_contributors WHERE split_sheet_id = $1 ORDER BY order_index",
        [id],
      );
      res.json({
        success: true,
        data: { ...result.rows[0], contributors: contribs.rows },
      });
    } catch (error) {
      console.error("Error creating split sheet:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to create split sheet" });
    }
  });

  // PUT /api/split-sheets/:id — Update split sheet
  app.put("/api/split-sheets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, status, project_id, track_id, contributors } =
        req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (title !== undefined) {
        updates.push(`title = $${idx++}`);
        params.push(title);
      }
      if (description !== undefined) {
        updates.push(`description = $${idx++}`);
        params.push(description);
      }
      if (status !== undefined) {
        updates.push(`status = $${idx++}`);
        params.push(status);
      }
      if (project_id !== undefined) {
        updates.push(`project_id = $${idx++}`);
        params.push(project_id);
      }
      if (track_id !== undefined) {
        updates.push(`track_id = $${idx++}`);
        params.push(track_id);
      }
      updates.push(`updated_at = NOW()`);

      if (status === "completed") {
        updates.push(`completed_at = NOW()`);
      }

      if (updates.length > 0) {
        params.push(id);
        await pool.query(
          `UPDATE split_sheets SET ${updates.join(", ")} WHERE id = $${idx}`,
          params,
        );
      }

      // Replace contributors if provided
      if (contributors && Array.isArray(contributors)) {
        await pool.query(
          "DELETE FROM split_sheet_contributors WHERE split_sheet_id = $1",
          [id],
        );
        for (let i = 0; i < contributors.length; i++) {
          const c = contributors[i];
          await pool.query(
            `INSERT INTO split_sheet_contributors (id, split_sheet_id, name, email, role, percentage, order_index, user_id, custom_fields)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              crypto.randomUUID(),
              id,
              c.name,
              c.email || null,
              c.role || "collaborator",
              c.percentage || 0,
              i,
              c.user_id || null,
              JSON.stringify(c.custom_fields || {}),
            ],
          );
        }
        await pool.query(
          "UPDATE split_sheets SET total_percentage = (SELECT COALESCE(SUM(percentage), 0) FROM split_sheet_contributors WHERE split_sheet_id = $1) WHERE id = $1",
          [id],
        );
      }

      const result = await pool.query(
        "SELECT * FROM split_sheets WHERE id = $1",
        [id],
      );
      const contribs = await pool.query(
        "SELECT * FROM split_sheet_contributors WHERE split_sheet_id = $1 ORDER BY order_index",
        [id],
      );
      res.json({
        success: true,
        data: { ...result.rows[0], contributors: contribs.rows },
      });
    } catch (error) {
      console.error("Error updating split sheet:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to update split sheet" });
    }
  });

  // DELETE /api/split-sheets/:id — Delete split sheet (cascades)
  app.delete("/api/split-sheets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query(
        "DELETE FROM split_sheet_contributors WHERE split_sheet_id = $1",
        [id],
      );
      await pool.query(
        "DELETE FROM split_sheet_comments WHERE split_sheet_id = $1",
        [id],
      );
      await pool.query(
        "DELETE FROM split_sheet_versions WHERE split_sheet_id = $1",
        [id],
      );
      try {
        await pool.query(
          "DELETE FROM split_sheet_revenue WHERE split_sheet_id = $1",
          [id],
        );
      } catch {}
      try {
        await pool.query(
          "DELETE FROM split_sheet_payments WHERE split_sheet_id = $1",
          [id],
        );
      } catch {}
      await pool.query("DELETE FROM split_sheets WHERE id = $1", [id]);
      res.json({ success: true, message: "Split sheet deleted successfully" });
    } catch (error) {
      console.error("Error deleting split sheet:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to delete split sheet" });
    }
  });

  // POST /api/split-sheets/:id/sign — Add digital signature
  app.post("/api/split-sheets/:id/sign", async (req, res) => {
    try {
      const { id } = req.params;
      const { contributor_id, signature_data } = req.body;

      await pool.query(
        `UPDATE split_sheet_contributors SET signed_at = NOW(), signature_data = $1, updated_at = NOW() WHERE id = $2 AND split_sheet_id = $3`,
        [JSON.stringify(signature_data || {}), contributor_id, id],
      );

      // Check if all contributors signed
      const check = await pool.query(
        `SELECT COUNT(*) as total, COUNT(signed_at) as signed FROM split_sheet_contributors WHERE split_sheet_id = $1`,
        [id],
      );
      if (
        check.rows[0].total > 0 &&
        check.rows[0].total === check.rows[0].signed
      ) {
        await pool.query(
          `UPDATE split_sheets SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [id],
        );
      } else {
        await pool.query(
          `UPDATE split_sheets SET status = 'pending_signatures', updated_at = NOW() WHERE id = $1`,
          [id],
        );
      }

      res.json({ success: true, message: "Signature recorded successfully" });
    } catch (error) {
      console.error("Error signing split sheet:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to sign split sheet" });
    }
  });

  // POST /api/split-sheets/:id/share — Share via email (stub)
  app.post("/api/split-sheets/:id/share", async (req, res) => {
    try {
      const { id } = req.params;
      const { contributor_ids, message } = req.body;

      // Update invitation status for contributors
      if (contributor_ids && contributor_ids.length > 0) {
        for (const cid of contributor_ids) {
          await pool.query(
            `UPDATE split_sheet_contributors SET invitation_sent_at = NOW(), invitation_status = 'sent', updated_at = NOW() WHERE id = $1 AND split_sheet_id = $2`,
            [cid, id],
          );
        }
      }

      res.json({ success: true, message: "Split sheet shared successfully" });
    } catch (error) {
      console.error("Error sharing split sheet:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to share split sheet" });
    }
  });

  // GET /api/split-sheets/:id/pdf — Generate PDF (returns JSON summary)
  app.get("/api/split-sheets/:id/pdf", async (req, res) => {
    try {
      const { id } = req.params;
      const ss = await pool.query("SELECT * FROM split_sheets WHERE id = $1", [
        id,
      ]);
      const contribs = await pool.query(
        "SELECT * FROM split_sheet_contributors WHERE split_sheet_id = $1 ORDER BY order_index",
        [id],
      );

      if (ss.rows.length === 0)
        return res.status(404).json({ success: false, error: "Not found" });

      res.json({
        success: true,
        data: {
          splitSheet: ss.rows[0],
          contributors: contribs.rows,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to generate PDF" });
    }
  });

  // GET /api/split-sheets/:id/versions — Get version history
  app.get("/api/split-sheets/:id/versions", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        "SELECT * FROM split_sheet_versions WHERE split_sheet_id = $1 ORDER BY created_at DESC",
        [id],
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.json({ success: true, data: [] });
    }
  });

  // POST /api/split-sheets/:id/duplicate — Duplicate split sheet
  app.post("/api/split-sheets/:id/duplicate", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getSplitSheetUserId(req);
      const { title } = req.body;

      const original = await pool.query(
        "SELECT * FROM split_sheets WHERE id = $1",
        [id],
      );
      if (original.rows.length === 0)
        return res.status(404).json({ success: false, error: "Not found" });

      const ss = original.rows[0];
      const newId = crypto.randomUUID();

      await pool.query(
        `INSERT INTO split_sheets (id, user_id, project_id, track_id, title, description, status, total_percentage, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8)`,
        [
          newId,
          userId || ss.user_id,
          ss.project_id,
          ss.track_id,
          title || `${ss.title} (Kopi)`,
          ss.description,
          ss.total_percentage,
          JSON.stringify(ss.metadata || {}),
        ],
      );

      const contribs = await pool.query(
        "SELECT * FROM split_sheet_contributors WHERE split_sheet_id = $1 ORDER BY order_index",
        [id],
      );
      for (const c of contribs.rows) {
        await pool.query(
          `INSERT INTO split_sheet_contributors (id, split_sheet_id, name, email, role, percentage, order_index, user_id, custom_fields)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            crypto.randomUUID(),
            newId,
            c.name,
            c.email,
            c.role,
            c.percentage,
            c.order_index,
            c.user_id,
            JSON.stringify(c.custom_fields || {}),
          ],
        );
      }

      const result = await pool.query(
        "SELECT * FROM split_sheets WHERE id = $1",
        [newId],
      );
      const newContribs = await pool.query(
        "SELECT * FROM split_sheet_contributors WHERE split_sheet_id = $1 ORDER BY order_index",
        [newId],
      );
      res.json({
        success: true,
        data: { ...result.rows[0], contributors: newContribs.rows },
      });
    } catch (error) {
      console.error("Error duplicating split sheet:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to duplicate split sheet" });
    }
  });

  // POST /api/split-sheets/:id/revenue — Add revenue
  app.post("/api/split-sheets/:id/revenue", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getSplitSheetUserId(req);
      const {
        amount,
        currency = "NOK",
        revenue_source,
        source,
        period_start,
        period_end,
        platform,
        description,
      } = req.body;
      // Valid: streaming, sales, sync, performance, mechanical, publishing, other
      const rawSource = (revenue_source || source || "other").toLowerCase();
      const validSources = [
        "streaming",
        "sales",
        "sync",
        "performance",
        "mechanical",
        "publishing",
        "other",
      ];
      const revenueSource = validSources.includes(rawSource)
        ? rawSource
        : "other";
      const today = new Date().toISOString().split("T")[0];

      const result = await pool.query(
        `INSERT INTO split_sheet_revenue (id, split_sheet_id, amount, currency, revenue_source, period_start, period_end, platform, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          crypto.randomUUID(),
          id,
          amount,
          currency,
          revenueSource,
          period_start || today,
          period_end || today,
          platform || null,
          description || null,
          userId || "system",
        ],
      );
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error("Error adding revenue:", error);
      res.status(500).json({ success: false, error: "Failed to add revenue" });
    }
  });

  // GET /api/split-sheets/:id/revenue — Get revenue history
  app.get("/api/split-sheets/:id/revenue", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        "SELECT * FROM split_sheet_revenue WHERE split_sheet_id = $1 ORDER BY created_at DESC",
        [id],
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.json({ success: true, data: [] });
    }
  });

  // GET /api/split-sheets/:id/payments — Get payment history
  app.get("/api/split-sheets/:id/payments", async (req, res) => {
    try {
      const { id } = req.params;
      const { contributor_id, status: payStatus } = req.query;

      let query = "SELECT * FROM split_sheet_payments WHERE split_sheet_id = $1";
      const params: any[] = [id];
      let idx = 2;

      if (contributor_id) {
        query += ` AND contributor_id = $${idx++}`;
        params.push(contributor_id);
      }
      if (payStatus) {
        query += ` AND payment_status = $${idx++}`;
        params.push(payStatus);
      }
      query += " ORDER BY created_at DESC";

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.json({ success: true, data: [] });
    }
  });

  // PUT /api/split-sheets/payments/:paymentId — Update payment status
  app.put("/api/split-sheets/payments/:paymentId", async (req, res) => {
    try {
      const { paymentId } = req.params;
      const {
        payment_status,
        payment_date,
        payment_method,
        payment_reference,
        notes,
      } = req.body;

      const updates: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (payment_status) {
        updates.push(`payment_status = $${idx++}`);
        params.push(payment_status);
      }
      if (payment_date) {
        updates.push(`payment_date = $${idx++}`);
        params.push(payment_date);
      }
      if (payment_method) {
        updates.push(`payment_method = $${idx++}`);
        params.push(payment_method);
      }
      if (payment_reference) {
        updates.push(`payment_reference = $${idx++}`);
        params.push(payment_reference);
      }
      if (notes) {
        updates.push(`notes = $${idx++}`);
        params.push(notes);
      }
      updates.push("updated_at = NOW()");

      params.push(paymentId);
      const result = await pool.query(
        `UPDATE split_sheet_payments SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
        params,
      );
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error("Error updating payment:", error);
      res.status(500).json({ success: false, error: "Failed to update payment" });
    }
  });
}
