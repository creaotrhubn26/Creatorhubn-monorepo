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

  app.post("/api/market-scans", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!body.name || !body.marketQuery) {
      return res.status(400).json({ error: "mangler_name_eller_marketQuery" });
    }
    try {
      const scan = await createMarketScan(pool, {
        workspaceOwnerUserId: session.userId,
        projectId: (body.projectId as string | undefined) ?? null,
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
      return res.status(500).json({ error: "create_failed", detail: String(err) });
    }
  });

  app.get("/api/market-scans", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const scans = await listMarketScans(pool, {
        workspaceOwnerUserId: session.userId,
        projectId: req.query.projectId
          ? String(req.query.projectId)
          : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 50,
      });
      return res.json({ scans });
    } catch (err) {
      return res.status(500).json({ error: "list_failed", detail: String(err) });
    }
  });

  app.get("/api/market-scans/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const scan = await getMarketScan(pool, req.params.id);
      if (!scan) return res.status(404).json({ error: "not_found" });
      return res.json({ scan });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: String(err) });
    }
  });

  app.post("/api/market-scans/:id/run", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      // Sync — runner kan ta ~60 sek (Claude × N + HTTP-fetches)
      const result = await runMarketScan(pool, req.params.id);
      return res.json(result);
    } catch (err) {
      console.error("[market-scan] run failed", err);
      return res.status(500).json({ error: "run_failed", detail: String(err) });
    }
  });

  app.get("/api/market-scans/:id/competitors", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const competitors = await getScanCompetitors(pool, req.params.id);
      return res.json({ competitors });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: String(err) });
    }
  });

  app.get("/api/market-scans/:id/funnels", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const stages = await getScanFunnelStages(pool, req.params.id);
      return res.json({ funnelStages: stages });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: String(err) });
    }
  });

  app.get("/api/market-scans/:id/techniques", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const techniques = await getScanTechniques(pool, req.params.id);
      return res.json({ techniques });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: String(err) });
    }
  });

  app.get("/api/market-scans/:id/tech-stack", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const techStack = await getScanTechStack(pool, req.params.id);
      return res.json({ techStack });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: String(err) });
    }
  });

  app.get("/api/market-scans/:id/opportunities", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const opportunities = await getScanOpportunities(pool, req.params.id);
      return res.json({ opportunities });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: String(err) });
    }
  });
}
