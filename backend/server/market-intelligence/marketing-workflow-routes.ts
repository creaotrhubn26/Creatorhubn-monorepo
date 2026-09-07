/**
 * marketing-workflow-routes.ts
 *
 * HTTP-API for å handle på Opportunity → Marketing Cockpit:
 *
 *   POST /api/market-scans/:id/opportunities/:opportunityId/create-campaign
 *   POST /api/market-scans/:id/opportunities/:opportunityId/create-content-pack
 *   POST /api/market-scans/:id/opportunities/:opportunityId/create-funnel-map
 *   POST /api/market-scans/:id/opportunities/:opportunityId/send-to-agent
 *
 *   GET  /api/marketing-workflows
 *   GET  /api/marketing-workflows/:id
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  createCampaignFromOpportunity,
  createContentPackFromOpportunity,
  createFunnelMapFromOpportunity,
  sendOpportunityToAgent,
  getWorkflow,
  listWorkflowsForOpportunity,
  listWorkflowsForUser,
} from "./marketing-cockpit-sync-service.js";
import { getMarketScan } from "./market-scan-service.js";
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

export function registerMarketingWorkflowRoutes({
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

  async function accessibleProject(
    value: unknown,
    userId: string,
    res: Response,
  ) {
    const projectId = typeof value === "string" ? value.trim() : "";
    if (!projectId) {
      res.status(400).json({ error: "project_id_required" });
      return null;
    }
    const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
    if (!project) {
      res.status(404).json({ error: "project_not_found" });
      return null;
    }
    return project;
  }

  async function accessibleScan(scanId: string, userId: string, res: Response) {
    const scan = await getMarketScan(pool, scanId);
    if (!scan?.projectId || !scan.organizationId) {
      res.status(404).json({ error: "scan_not_found" });
      return null;
    }
    const project = await loadAccessibleLeadgridProject(pool, scan.projectId, userId);
    if (!project || project.organizationId !== scan.organizationId) {
      res.status(404).json({ error: "scan_not_found" });
      return null;
    }
    return { scan, project };
  }

  function scopedActionArgs(
    session: SessionData,
    context: Awaited<ReturnType<typeof accessibleScan>>,
    opportunityId: string,
  ) {
    if (!context) throw new Error("scan_not_found");
    return {
      workspaceOwnerUserId: session.userId,
      organizationId: context.project.organizationId,
      projectId: context.project.id,
      marketScanId: context.scan.id,
      brandKey: `leadgrid:${context.project.id}`,
      opportunityId,
    };
  }

  function opportunityError(
    err: unknown,
    res: Response,
    fallback: string,
  ): Response {
    if (err instanceof Error && err.message === "opportunity_not_found") {
      return res.status(404).json({ error: "opportunity_not_found" });
    }
    return res.status(500).json({ error: fallback, detail: "internal_error" });
  }

  // ── Create Campaign ─────────────────────────────────────────────
  app.post(
    "/api/market-scans/:id/opportunities/:opportunityId/create-campaign",
    async (req, res) => {
      const session = requireAdmin(req, res);
      if (!session) return;
      try {
        const context = await accessibleScan(req.params.id, session.userId, res);
        if (!context) return;
        const result = await createCampaignFromOpportunity(pool, {
          ...scopedActionArgs(session, context, req.params.opportunityId),
        });
        return res.json(result);
      } catch (err) {
        console.error("[mi-workflow] create-campaign failed", err);
        return opportunityError(err, res, "create_campaign_failed");
      }
    },
  );

  // ── Create Content Pack ────────────────────────────────────────
  app.post(
    "/api/market-scans/:id/opportunities/:opportunityId/create-content-pack",
    async (req, res) => {
      const session = requireAdmin(req, res);
      if (!session) return;
      try {
        const context = await accessibleScan(req.params.id, session.userId, res);
        if (!context) return;
        const result = await createContentPackFromOpportunity(pool, {
          ...scopedActionArgs(session, context, req.params.opportunityId),
        });
        return res.json(result);
      } catch (err) {
        console.error("[mi-workflow] create-content-pack failed", err);
        return opportunityError(err, res, "create_content_pack_failed");
      }
    },
  );

  // ── Create Funnel Map ──────────────────────────────────────────
  app.post(
    "/api/market-scans/:id/opportunities/:opportunityId/create-funnel-map",
    async (req, res) => {
      const session = requireAdmin(req, res);
      if (!session) return;
      try {
        const context = await accessibleScan(req.params.id, session.userId, res);
        if (!context) return;
        const workflow = await createFunnelMapFromOpportunity(pool, {
          ...scopedActionArgs(session, context, req.params.opportunityId),
        });
        return res.json({ workflow });
      } catch (err) {
        console.error("[mi-workflow] create-funnel-map failed", err);
        return opportunityError(err, res, "create_funnel_map_failed");
      }
    },
  );

  // ── Send to Agent ──────────────────────────────────────────────
  app.post(
    "/api/market-scans/:id/opportunities/:opportunityId/send-to-agent",
    async (req, res) => {
      const session = requireAdmin(req, res);
      if (!session) return;
      const body = (req.body ?? {}) as { agentThreadId?: string };
      try {
        const context = await accessibleScan(req.params.id, session.userId, res);
        if (!context) return;
        const agentThreadId = body.agentThreadId?.trim();
        if (agentThreadId) {
          const thread = await pool.query(
            `SELECT 1
               FROM role_room_agent_threads
              WHERE id::text = $1
                AND project_id = $2
                AND user_id = $3
                AND archived_at IS NULL
              LIMIT 1`,
            [agentThreadId, context.project.id, session.userId],
          );
          if (!thread.rows.length) {
            return res.status(400).json({ error: "agent_thread_not_in_project" });
          }
        }
        const workflow = await sendOpportunityToAgent(pool, {
          ...scopedActionArgs(session, context, req.params.opportunityId),
          agentThreadId,
        });
        return res.json({ workflow });
      } catch (err) {
        console.error("[mi-workflow] send-to-agent failed", err);
        return opportunityError(err, res, "send_to_agent_failed");
      }
    },
  );

  // ── Read workflows ─────────────────────────────────────────────
  app.get("/api/marketing-workflows", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const project = await accessibleProject(
        req.query.projectId ?? req.query.project_id,
        session.userId,
        res,
      );
      if (!project) return;
      if (req.query.opportunityId) {
        const workflows = await listWorkflowsForOpportunity(
          pool,
          {
            opportunityId: String(req.query.opportunityId),
            workspaceOwnerUserId: session.userId,
            organizationId: project.organizationId,
            projectId: project.id,
          },
        );
        return res.json({ workflows });
      }
      const workflows = await listWorkflowsForUser(pool, {
        workspaceOwnerUserId: session.userId,
        organizationId: project.organizationId,
        projectId: project.id,
        limit: Math.max(1, Math.min(100, Number(req.query.limit) || 100)),
      });
      return res.json({ workflows });
    } catch (err) {
      return res.status(500).json({ error: "list_failed", detail: "internal_error" });
    }
  });

  app.get("/api/marketing-workflows/:id", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const project = await accessibleProject(
        req.query.projectId ?? req.query.project_id,
        session.userId,
        res,
      );
      if (!project) return;
      const workflow = await getWorkflow(pool, req.params.id, {
        workspaceOwnerUserId: session.userId,
        organizationId: project.organizationId,
        projectId: project.id,
      });
      if (!workflow) return res.status(404).json({ error: "not_found" });
      return res.json({ workflow });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: "internal_error" });
    }
  });
}
