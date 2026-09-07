/**
 * market-intel-agent-routes.ts
 *
 * Routes som Role Room Agent bruker for å hente Market Intelligence-
 * kontekst og handle på den.
 *
 *   GET  /api/role-room/agent/market-intel-context?projectId=
 *        → returnerer kompakt MI-kontekst klar for injection i agent-prompt
 *
 *   POST /api/role-room/agent/market-intel/summarize
 *        → manuelt trigger summary av et scan via Claude
 *
 *   POST /api/role-room/agent/market-intel/compare-landing-pages
 *        → sammenligning av brand vs konkurrenter
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { getMarketIntelAgentContext } from "./market-intel-agent-context-service.js";
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

export function registerMarketIntelAgentRoutes({
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

  app.get("/api/role-room/agent/market-intel-context", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const projectId = typeof req.query.projectId === "string"
        ? req.query.projectId.trim()
        : "";
      if (!projectId) {
        return res.status(400).json({ error: "project_id_required" });
      }
      const project = await loadAccessibleLeadgridProject(
        pool,
        projectId,
        session.userId,
      );
      if (!project) {
        return res.status(404).json({ error: "project_not_found" });
      }
      const context = await getMarketIntelAgentContext(pool, {
        projectId: project.id,
        organizationId: project.organizationId,
        workspaceOwnerUserId: session.userId,
        maxScans: Math.max(1, Math.min(10, Number(req.query.maxScans) || 3)),
        maxOpportunities: Math.max(1, Math.min(20, Number(req.query.maxOpportunities) || 4)),
        maxWorkflows: Math.max(1, Math.min(20, Number(req.query.maxWorkflows) || 5)),
      });
      return res.json({ context });
    } catch (err) {
      console.error("[mi-agent-context] fetch failed", err);
      return res
        .status(500)
        .json({ error: "context_fetch_failed", detail: "internal_error" });
    }
  });
}
