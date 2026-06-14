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

  // ── Create Campaign ─────────────────────────────────────────────
  app.post(
    "/api/market-scans/:id/opportunities/:opportunityId/create-campaign",
    async (req, res) => {
      const session = requireAdmin(req, res);
      if (!session) return;
      const body = (req.body ?? {}) as { projectId?: string; brandKey?: string };
      try {
        const result = await createCampaignFromOpportunity(pool, {
          workspaceOwnerUserId: session.userId,
          projectId: body.projectId ?? null,
          brandKey: body.brandKey ?? "theroleroom",
          opportunityId: req.params.opportunityId,
        });
        return res.json(result);
      } catch (err) {
        console.error("[mi-workflow] create-campaign failed", err);
        return res
          .status(500)
          .json({ error: "create_campaign_failed", detail: String(err) });
      }
    },
  );

  // ── Create Content Pack ────────────────────────────────────────
  app.post(
    "/api/market-scans/:id/opportunities/:opportunityId/create-content-pack",
    async (req, res) => {
      const session = requireAdmin(req, res);
      if (!session) return;
      const body = (req.body ?? {}) as { projectId?: string; brandKey?: string };
      try {
        const result = await createContentPackFromOpportunity(pool, {
          workspaceOwnerUserId: session.userId,
          projectId: body.projectId ?? null,
          brandKey: body.brandKey ?? "theroleroom",
          opportunityId: req.params.opportunityId,
        });
        return res.json(result);
      } catch (err) {
        console.error("[mi-workflow] create-content-pack failed", err);
        return res
          .status(500)
          .json({ error: "create_content_pack_failed", detail: String(err) });
      }
    },
  );

  // ── Create Funnel Map ──────────────────────────────────────────
  app.post(
    "/api/market-scans/:id/opportunities/:opportunityId/create-funnel-map",
    async (req, res) => {
      const session = requireAdmin(req, res);
      if (!session) return;
      const body = (req.body ?? {}) as { projectId?: string };
      try {
        const workflow = await createFunnelMapFromOpportunity(pool, {
          workspaceOwnerUserId: session.userId,
          projectId: body.projectId ?? null,
          opportunityId: req.params.opportunityId,
        });
        return res.json({ workflow });
      } catch (err) {
        console.error("[mi-workflow] create-funnel-map failed", err);
        return res
          .status(500)
          .json({ error: "create_funnel_map_failed", detail: String(err) });
      }
    },
  );

  // ── Send to Agent ──────────────────────────────────────────────
  app.post(
    "/api/market-scans/:id/opportunities/:opportunityId/send-to-agent",
    async (req, res) => {
      const session = requireAdmin(req, res);
      if (!session) return;
      const body = (req.body ?? {}) as { projectId?: string; agentThreadId?: string };
      try {
        const workflow = await sendOpportunityToAgent(pool, {
          workspaceOwnerUserId: session.userId,
          projectId: body.projectId ?? null,
          opportunityId: req.params.opportunityId,
          agentThreadId: body.agentThreadId,
        });
        return res.json({ workflow });
      } catch (err) {
        console.error("[mi-workflow] send-to-agent failed", err);
        return res
          .status(500)
          .json({ error: "send_to_agent_failed", detail: String(err) });
      }
    },
  );

  // ── Read workflows ─────────────────────────────────────────────
  app.get("/api/marketing-workflows", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      if (req.query.opportunityId) {
        const workflows = await listWorkflowsForOpportunity(
          pool,
          String(req.query.opportunityId),
        );
        return res.json({ workflows });
      }
      const workflows = await listWorkflowsForUser(pool, {
        workspaceOwnerUserId: session.userId,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      });
      return res.json({ workflows });
    } catch (err) {
      return res.status(500).json({ error: "list_failed", detail: String(err) });
    }
  });

  app.get("/api/marketing-workflows/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const workflow = await getWorkflow(pool, req.params.id);
      if (!workflow) return res.status(404).json({ error: "not_found" });
      return res.json({ workflow });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: String(err) });
    }
  });
}
