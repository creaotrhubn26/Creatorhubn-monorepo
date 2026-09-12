/**
 * market-scan-routes.ts
 *
 * HTTP-API for Market Intelligence Scanner.
 *
 *   POST   /api/market-scans
 *          body: { name, marketQuery, projectId?, region?, industry?,
 *                  targetAudience?, goal? }
 *          → oppretter scan i 'draft'-status, returnerer scan-id
 *
 *   GET    /api/market-scans?projectId=
 *          → list scans (workspace-isolert)
 *
 *   GET    /api/market-scans/:id
 *          → enkelt scan med metadata
 *
 *   POST   /api/market-scans/:id/run
 *          → kjør pipelinen (sync — kan ta opptil 60 sek)
 *
 *   GET    /api/market-scans/:id/competitors
 *   GET    /api/market-scans/:id/funnels
 *   GET    /api/market-scans/:id/techniques
 *   GET    /api/market-scans/:id/tech-stack
 *   GET    /api/market-scans/:id/opportunities
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  createMarketScan,
  listMarketScans,
  getMarketScan,
  runMarketScan,
  getScanCompetitors,
  getScanFunnelStages,
  getScanTechniques,
  getScanTechStack,
  getScanOpportunities,
} from "./market-scan-service.js";
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

export function registerMarketScanRoutes({
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
    projectId: unknown,
    userId: string,
    res: Response,
  ) {
    const normalized = typeof projectId === "string" ? projectId.trim() : "";
    if (!normalized) {
      res.status(400).json({ error: "project_id_required" });
      return null;
    }
    const project = await loadAccessibleLeadgridProject(pool, normalized, userId);
    if (!project) {
      res.status(404).json({ error: "project_not_found" });
      return null;
    }
    return project;
  }

  async function accessibleScan(scanId: string, userId: string, res: Response) {
    const scan = await getMarketScan(pool, scanId);
    if (!scan) {
      res.status(404).json({ error: "not_found" });
      return null;
    }
    if (!scan.projectId) {
      if (scan.workspaceOwnerUserId !== userId) {
        res.status(404).json({ error: "not_found" });
        return null;
      }
      return scan;
    }
    const project = await loadAccessibleLeadgridProject(pool, scan.projectId, userId);
    if (!project || (scan.organizationId && scan.organizationId !== project.organizationId)) {
      res.status(404).json({ error: "not_found" });
      return null;
    }
    return scan;
  }

  app.post("/api/market-scans", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!body.name || !body.marketQuery) {
      return res.status(400).json({ error: "mangler_name_eller_marketQuery" });
    }
    try {
      const rawProjectId = body.projectId ?? body.project_id;
      const project = rawProjectId == null
        ? null
        : await accessibleProject(rawProjectId, session.userId, res);
      if (rawProjectId != null && !project) return;
      const scan = await createMarketScan(pool, {
        workspaceOwnerUserId: session.userId,
        organizationId: project?.organizationId ?? null,
        projectId: project?.id ?? null,
        brandKitId: (body.brandKitId as string | undefined) ?? null,
        name: String(body.name),
        marketQuery: String(body.marketQuery),
        region: (body.region as string | undefined) ?? null,
        industry: (body.industry as string | undefined) ?? null,
        targetAudience: (body.targetAudience as string | undefined) ?? null,
        goal: (body.goal as string | undefined) ?? null,
      });
      return res.status(201).json({ scan });
    } catch (err) {
      console.error("[market-scan] create failed", err);
      return res.status(500).json({ error: "create_failed", detail: "internal_error" });
    }
  });

  app.get("/api/market-scans", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const rawProjectId = req.query.projectId ?? req.query.project_id;
      const project = rawProjectId == null
        ? null
        : await accessibleProject(rawProjectId, session.userId, res);
      if (rawProjectId != null && !project) return;
      const requestedLimit = Number(req.query.limit ?? 50);
      const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(100, Math.trunc(requestedLimit)))
        : 50;
      const scans = await listMarketScans(pool, {
        workspaceOwnerUserId: session.userId,
        organizationId: project?.organizationId,
        projectId: project?.id,
        limit,
      });
      return res.json({ scans });
    } catch (err) {
      return res.status(500).json({ error: "list_failed", detail: "internal_error" });
    }
  });

  app.get("/api/market-scans/:id", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const scan = await accessibleScan(req.params.id, session.userId, res);
      if (!scan) return;
      return res.json({ scan });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: "internal_error" });
    }
  });

  app.post("/api/market-scans/:id/run", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const scan = await accessibleScan(req.params.id, session.userId, res);
      if (!scan) return;
      // Sync — runner kan ta ~60 sek (Claude × N + HTTP-fetches)
      const result = await runMarketScan(pool, scan.id);
      return res.json(result);
    } catch (err) {
      console.error("[market-scan] run failed", err);
      return res.status(500).json({ error: "run_failed", detail: "internal_error" });
    }
  });

  app.get("/api/market-scans/:id/competitors", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const scan = await accessibleScan(req.params.id, session.userId, res);
      if (!scan) return;
      const competitors = await getScanCompetitors(pool, scan.id);
      return res.json({ competitors });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: "internal_error" });
    }
  });

  app.get("/api/market-scans/:id/funnels", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const scan = await accessibleScan(req.params.id, session.userId, res);
      if (!scan) return;
      const stages = await getScanFunnelStages(pool, scan.id);
      return res.json({ funnelStages: stages });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: "internal_error" });
    }
  });

  app.get("/api/market-scans/:id/techniques", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const scan = await accessibleScan(req.params.id, session.userId, res);
      if (!scan) return;
      const techniques = await getScanTechniques(pool, scan.id);
      return res.json({ techniques });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: "internal_error" });
    }
  });

  app.get("/api/market-scans/:id/tech-stack", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const scan = await accessibleScan(req.params.id, session.userId, res);
      if (!scan) return;
      const techStack = await getScanTechStack(pool, scan.id);
      return res.json({ techStack });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: "internal_error" });
    }
  });

  app.get("/api/market-scans/:id/opportunities", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const scan = await accessibleScan(req.params.id, session.userId, res);
      if (!scan) return;
      const opportunities = await getScanOpportunities(pool, scan.id);
      return res.json({ opportunities });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: "internal_error" });
    }
  });
}
