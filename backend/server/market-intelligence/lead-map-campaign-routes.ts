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

  async function accessibleProject(value: unknown, userId: string, res: Response) {
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

  function campaignScope(session: SessionData, project: {
    id: string;
    organizationId: string;
  }) {
    return {
      workspaceOwnerUserId: session.userId,
      organizationId: project.organizationId,
      projectId: project.id,
    };
  }

  async function validateLinkedResources(
    body: Record<string, unknown>,
    project: { id: string; organizationId: string },
    res: Response,
  ): Promise<boolean> {
    if (typeof body.marketScanId === "string" && body.marketScanId.trim()) {
      const scan = await pool.query(
        `SELECT 1 FROM market_scans
          WHERE id = $1::uuid AND organization_id = $2::uuid AND project_id = $3
          LIMIT 1`,
        [body.marketScanId.trim(), project.organizationId, project.id],
      );
      if (!scan.rows.length) {
        res.status(400).json({ error: "market_scan_not_in_project" });
        return false;
      }
    }
    if (typeof body.brandKitId === "string" && body.brandKitId.trim()) {
      const kit = await pool.query(
        `SELECT 1 FROM brand_kits WHERE id = $1::uuid AND project_id = $2 LIMIT 1`,
        [body.brandKitId.trim(), project.id],
      );
      if (!kit.rows.length) {
        res.status(400).json({ error: "brand_kit_not_in_project" });
        return false;
      }
    }
    return true;
  }

  app.post("/api/lead-map/campaigns", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!body.name) return res.status(400).json({ error: "mangler_name" });
    try {
      const project = await accessibleProject(
        body.projectId ?? body.project_id,
        session.userId,
        res,
      );
      if (!project || !(await validateLinkedResources(body, project, res))) return;
      const campaign = await createCampaign(pool, {
        workspaceOwnerUserId: session.userId,
        organizationId: project.organizationId,
        projectId: project.id,
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
      return res.status(500).json({ error: "create_failed", detail: "internal_error" });
    }
  });

  app.get("/api/lead-map/campaigns", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const project = await accessibleProject(
        req.query.projectId ?? req.query.project_id,
        session.userId,
        res,
      );
      if (!project) return;
      const campaigns = await listCampaigns(pool, {
        workspaceOwnerUserId: session.userId,
        organizationId: project.organizationId,
        projectId: project.id,
        status: req.query.status ? String(req.query.status) : undefined,
        limit: Math.max(1, Math.min(100, Number(req.query.limit) || 100)),
      });
      return res.json({ campaigns });
    } catch (err) {
      return res.status(500).json({ error: "list_failed", detail: "internal_error" });
    }
  });

  app.get("/api/lead-map/campaigns/:id", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const project = await accessibleProject(
        req.query.projectId ?? req.query.project_id,
        session.userId,
        res,
      );
      if (!project) return;
      const campaign = await getCampaign(
        pool,
        req.params.id,
        campaignScope(session, project),
      );
      if (!campaign) return res.status(404).json({ error: "not_found" });
      return res.json({ campaign });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: "internal_error" });
    }
  });

  app.get("/api/lead-map/campaigns/:id/aggregate", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const project = await accessibleProject(
        req.query.projectId ?? req.query.project_id,
        session.userId,
        res,
      );
      if (!project) return;
      const agg = await getCampaignAggregate(
        pool,
        req.params.id,
        campaignScope(session, project),
      );
      if (!agg) return res.status(404).json({ error: "not_found" });
      return res.json(agg);
    } catch (err) {
      console.error("[lead-map-campaign] aggregate failed", err);
      return res.status(500).json({ error: "aggregate_failed", detail: "internal_error" });
    }
  });

  app.get("/api/lead-map/analytics/category-conversion", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const project = await accessibleProject(
        req.query.projectId ?? req.query.project_id,
        session.userId,
        res,
      );
      if (!project) return;
      const stats = await getCategoryConversionStats(pool, {
        organizationId: project.organizationId,
        projectId: project.id,
      });
      return res.json({ stats });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: "internal_error" });
    }
  });

  app.get("/api/lead-map/analytics/area-response", async (req, res) => {
    const session = requireAdmin(req, res);
    if (!session) return;
    try {
      const project = await accessibleProject(
        req.query.projectId ?? req.query.project_id,
        session.userId,
        res,
      );
      if (!project) return;
      const stats = await getAreaResponseStats(pool, {
        organizationId: project.organizationId,
        projectId: project.id,
      });
      return res.json({ stats });
    } catch (err) {
      return res.status(500).json({ error: "fetch_failed", detail: "internal_error" });
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
      let projectScope: { organizationId: string; projectId: string } | undefined;
      if (!tokenOk) {
        const session = getSession(req, activeSessions)!;
        const project = await accessibleProject(
          req.body?.projectId ?? req.body?.project_id,
          session.userId,
          res,
        );
        if (!project) return;
        projectScope = {
          organizationId: project.organizationId,
          projectId: project.id,
        };
      }
      const result = await runReEngagementCron(pool, projectScope);
      return res.json(result);
    } catch (err) {
      console.error("[lead-map-campaign] cron failed", err);
      return res.status(500).json({ error: "cron_failed", detail: "internal_error" });
    }
  });
}
