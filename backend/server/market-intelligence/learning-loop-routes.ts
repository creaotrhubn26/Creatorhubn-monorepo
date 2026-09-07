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
import { getWorkflow } from "./marketing-cockpit-sync-service.js";
import { loadAccessibleLeadgridProject } from "../leadgrid-project-access.js";

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

  async function workflowScope(
    req: Request,
    session: SessionData,
    res: Response,
  ) {
    const rawProjectId = req.query.projectId
      ?? req.query.project_id
      ?? req.body?.projectId
      ?? req.body?.project_id;
    const projectId = typeof rawProjectId === "string" ? rawProjectId.trim() : "";
    if (!projectId) {
      res.status(400).json({ error: "project_id_required" });
      return null;
    }
    const project = await loadAccessibleLeadgridProject(
      pool,
      projectId,
      session.userId,
    );
    if (!project) {
      res.status(404).json({ error: "project_not_found" });
      return null;
    }
    return {
      workspaceOwnerUserId: session.userId,
      organizationId: project.organizationId,
      projectId: project.id,
    };
  }

  async function accessibleWorkflow(
    req: Request,
    session: SessionData,
    res: Response,
  ) {
    const scope = await workflowScope(req, session, res);
    if (!scope) return null;
    const workflow = await getWorkflow(pool, req.params.id, scope);
    if (!workflow) {
      res.status(404).json({ error: "not_found" });
      return null;
    }
    return { scope, workflow };
  }

  app.post("/api/marketing-workflows/:id/recompute-analytics", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const context = await accessibleWorkflow(req, session, res);
      if (!context) return;
      const result = await processWorkflowAnalytics(
        pool,
        req.params.id,
        context.scope,
      );
      if (!result) return res.status(404).json({ error: "no_drafts_linked" });
      return res.json({ analytics: result });
    } catch (err) {
      console.error("[learning-loop] recompute failed", err);
      return res.status(500).json({ error: "recompute_failed", detail: "internal_error" });
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
      return res.status(500).json({ error: "cron_failed", detail: "internal_error" });
    }
  });

  app.get("/api/marketing-workflows/:id/analytics", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const context = await accessibleWorkflow(req, session, res);
      if (!context) return;
      const r = await pool.query(
        `SELECT analytics.id::text, analytics.workflow_id::text,
                analytics.opportunity_id::text, analytics.market_scan_id::text,
                analytics.total_drafts_published, analytics.total_impressions,
                analytics.total_engagements, analytics.total_clicks,
                analytics.total_conversions, analytics.total_revenue_nok,
                analytics.performance_score, analytics.performance_tier,
                analytics.insight_summary, analytics.what_worked,
                analytics.what_didnt_work, analytics.recommendation_adjustment,
                analytics.computed_at::text
           FROM marketing_workflow_analytics analytics
           JOIN marketing_workflows workflow ON workflow.id = analytics.workflow_id
          WHERE analytics.workflow_id = $1::uuid
            AND workflow.organization_id = $2::uuid
            AND workflow.project_id = $3
          ORDER BY analytics.computed_at DESC
          LIMIT 1`,
        [req.params.id, context.scope.organizationId, context.scope.projectId],
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "no_analytics" });
      return res.json({ analytics: r.rows[0] });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: "internal_error" });
    }
  });

  app.get("/api/marketing-workflow-analytics/top-performers", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const scope = await workflowScope(req, session, res);
      if (!scope) return;
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
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
          WHERE mw.organization_id = $1::uuid
            AND mw.project_id = $2
            AND mwa.performance_tier IN ('high', 'top')
          ORDER BY mwa.performance_score DESC
          LIMIT $3`,
        [scope.organizationId, scope.projectId, limit],
      );
      return res.json({ topPerformers: r.rows });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: "internal_error" });
    }
  });
}
