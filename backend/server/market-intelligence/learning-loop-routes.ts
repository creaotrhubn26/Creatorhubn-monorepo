/**
 * learning-loop-routes.ts
 *
 *   POST /api/marketing-workflows/:id/recompute-analytics
 *        → trigger en re-compute for én workflow (admin-bare)
 *
 *   POST /api/marketing-workflows/cron/process-due
 *        → admin/cron-token: prosesser alle workflows som trenger update
 *
 *   GET  /api/marketing-workflows/:id/analytics
 *        → hent siste analytics-resultat for én workflow
 *
 *   GET  /api/marketing-workflows/top-performers?limit=10
 *        → liste av top-perfomers (på tvers av alle workflows)
 *        til Marketing Cockpit-dashboard
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  processWorkflowAnalytics,
  processAllDueWorkflows,
} from "./learning-loop-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    return activeSessions.get(token) ?? null;
  }
  return null;
}

export function registerLearningLoopRoutes({
  app,
  pool,
  activeSessions,
  isAdminEmail,
}: Deps): void {
  function requireAdmin(req: Request, res: Response): SessionData | null {
    const session = getSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "ikke_innlogget" });
      return null;
    }
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      res.status(403).json({ error: "krever_admin" });
      return null;
    }
    return session;
  }

  app.post("/api/marketing-workflows/:id/recompute-analytics", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const result = await processWorkflowAnalytics(pool, req.params.id);
      if (!result) return res.status(404).json({ error: "no_drafts_linked" });
      return res.json({ analytics: result });
    } catch (err) {
      console.error("[learning-loop] recompute failed", err);
      return res.status(500).json({ error: "recompute_failed", detail: String(err) });
    }
  });

  // Cron-trigger (dual-auth: admin OR x-cron-trigger-token, jf. memory)
  app.post("/api/marketing-workflows/cron/process-due", async (req, res) => {
    const cronToken = process.env.MI_LEARNING_LOOP_CRON_TOKEN;
    const headerToken = req.headers["x-cron-trigger-token"];
    const sessionOk = !!getSession(req, activeSessions) &&
      isAdminEmail(getSession(req, activeSessions)?.email);
    const tokenOk = cronToken && headerToken === cronToken;

    if (!sessionOk && !tokenOk) {
      return res.status(403).json({ error: "krever_admin_eller_cron_token" });
    }

    try {
      const processed = await processAllDueWorkflows(pool);
      return res.json({ processed });
    } catch (err) {
      console.error("[learning-loop] cron failed", err);
      return res.status(500).json({ error: "cron_failed", detail: String(err) });
    }
  });

  app.get("/api/marketing-workflows/:id/analytics", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const r = await pool.query(
        `SELECT id::text, workflow_id::text, opportunity_id::text, market_scan_id::text,
                total_drafts_published, total_impressions, total_engagements,
                total_clicks, total_conversions, total_revenue_nok,
                performance_score, performance_tier,
                insight_summary, what_worked, what_didnt_work, recommendation_adjustment,
                computed_at::text
           FROM marketing_workflow_analytics
          WHERE workflow_id = $1::uuid
          ORDER BY computed_at DESC
          LIMIT 1`,
        [req.params.id],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "no_analytics" });
      return res.json({ analytics: r.rows[0] });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: String(err) });
    }
  });

  app.get("/api/marketing-workflows/top-performers", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    try {
      const r = await pool.query(
        `SELECT mwa.id::text, mwa.workflow_id::text, mwa.opportunity_id::text,
                mwa.performance_score, mwa.performance_tier,
                mwa.total_impressions, mwa.total_engagements, mwa.total_conversions,
                mwa.insight_summary, mwa.what_worked, mwa.recommendation_adjustment,
                mso.title AS opportunity_title,
                mso.simple_summary AS opportunity_summary
           FROM marketing_workflow_analytics mwa
           LEFT JOIN market_scan_opportunities mso ON mso.id = mwa.opportunity_id
           JOIN marketing_workflows mw ON mw.id = mwa.workflow_id
          WHERE mw.workspace_owner_user_id = $1
            AND mwa.performance_tier IN ('high', 'top')
          ORDER BY mwa.performance_score DESC
          LIMIT $2`,
        [session.userId, limit],
      );
      return res.json({ topPerformers: r.rows });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: String(err) });
    }
  });
}
