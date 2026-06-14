/**
 * lead-map-campaign-routes.ts
 *
 *   POST /api/lead-map/campaigns                       — opprett kampanje
 *   GET  /api/lead-map/campaigns                       — list
 *   GET  /api/lead-map/campaigns/:id                   — detail
 *   GET  /api/lead-map/campaigns/:id/aggregate         — status-aggregat
 *
 *   GET  /api/lead-map/analytics/category-conversion
 *   GET  /api/lead-map/analytics/area-response
 *
 *   POST /api/lead-map/cron/re-engagement
 *        (dual-auth: admin OR x-cron-trigger-token)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  createCampaign,
  listCampaigns,
  getCampaign,
  getCampaignAggregate,
  getCategoryConversionStats,
  getAreaResponseStats,
  runReEngagementCron,
} from "./lead-map-campaign-service.js";

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

export function registerLeadMapCampaignRoutes({
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

  app.post("/api/lead-map/campaigns", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!body.name) return res.status(400).json({ error: "mangler_name" });
    try {
      const campaign = await createCampaign(pool, {
        workspaceOwnerUserId: session.userId,
        agentConfigId: (body.agentConfigId as string | undefined) ?? null,
        name: String(body.name),
        description: body.description as string | undefined,
        filterCategory: body.filterCategory as string | undefined,
        filterRegion: body.filterRegion as string | undefined,
        filterCity: body.filterCity as string | undefined,
        filterLeadStatus: body.filterLeadStatus as Parameters<typeof createCampaign>[1]["filterLeadStatus"],
        targetTotalLeads: body.targetTotalLeads ? Number(body.targetTotalLeads) : undefined,
        targetWonLeads: body.targetWonLeads ? Number(body.targetWonLeads) : undefined,
        marketScanId: body.marketScanId as string | undefined,
        brandKitId: body.brandKitId as string | undefined,
        reEngagementDays: body.reEngagementDays ? Number(body.reEngagementDays) : undefined,
      });
      return res.status(201).json({ campaign });
    } catch (err) {
      console.error("[lead-map-campaign] create failed", err);
      return res.status(500).json({ error: "create_failed", detail: String(err) });
    }
  });

  app.get("/api/lead-map/campaigns", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const campaigns = await listCampaigns(pool, {
        workspaceOwnerUserId: session.userId,
        status: req.query.status ? String(req.query.status) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      });
      return res.json({ campaigns });
    } catch (err) {
      return res.status(500).json({ error: "list_failed", detail: String(err) });
    }
  });

  app.get("/api/lead-map/campaigns/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const campaign = await getCampaign(pool, req.params.id);
      if (!campaign) return res.status(404).json({ error: "not_found" });
      return res.json({ campaign });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: String(err) });
    }
  });

  app.get("/api/lead-map/campaigns/:id/aggregate", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const agg = await getCampaignAggregate(pool, req.params.id);
      if (!agg) return res.status(404).json({ error: "not_found" });
      return res.json(agg);
    } catch (err) {
      console.error("[lead-map-campaign] aggregate failed", err);
      return res.status(500).json({ error: "aggregate_failed", detail: String(err) });
    }
  });

  app.get("/api/lead-map/analytics/category-conversion", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const stats = await getCategoryConversionStats(pool, session.userId);
      return res.json({ stats });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: String(err) });
    }
  });

  app.get("/api/lead-map/analytics/area-response", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const stats = await getAreaResponseStats(pool, session.userId);
      return res.json({ stats });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: String(err) });
    }
  });

  app.post("/api/lead-map/cron/re-engagement", async (req, res) => {
    const cronToken = process.env.LEAD_MAP_REENGAGEMENT_CRON_TOKEN;
    const headerToken = req.headers["x-cron-trigger-token"];
    const sessionOk = (() => {
      const s = getSession(req, activeSessions);
      return !!s && (s.role === "admin" || isAdminEmail(s.email));
    })();
    const tokenOk = cronToken && headerToken === cronToken;
    if (!sessionOk && !tokenOk) {
      return res.status(403).json({ error: "krever_admin_eller_cron_token" });
    }
    try {
      const result = await runReEngagementCron(pool);
      return res.json(result);
    } catch (err) {
      console.error("[lead-map-campaign] cron failed", err);
      return res.status(500).json({ error: "cron_failed", detail: String(err) });
    }
  });
}
