import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

import {
  leadPlacementStatus,
  placeUnplacedLeads,
} from "./leadgrid-lead-placement.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import {
  loadAccessibleLeadgridProject,
  type LeadgridAccessibleProject,
} from "./leadgrid-project-access.js";

/**
 * Leads uten koordinater er usynlige på kartet. Disse to endepunktene teller
 * dem og slår opp adressene på nytt, slik at kartet viser det brukeren tror
 * det viser.
 */
export function registerLeadgridLeadPlacementRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null;
}) {
  const { app, pool, requireUserSession } = deps;

  async function selectedProject(
    req: Request,
    res: Response,
    userId: string,
  ): Promise<LeadgridAccessibleProject | null> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const projectId = String(
      body.projectId ?? body.project_id ??
        req.query.projectId ?? req.query.project_id ?? "",
    ).trim();
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

  app.get("/api/leadgrid/lead-placement", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const project = await selectedProject(req, res, session.userId);
    if (!project) return;
    try {
      res.json(await leadPlacementStatus(pool, { project }));
    } catch (error) {
      console.warn("[lead-placement] status feilet:", (error as Error).message);
      res.status(500).json({ error: "placement_status_failed" });
    }
  });

  app.post("/api/leadgrid/lead-placement/resolve", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const project = await selectedProject(req, res, session.userId);
    if (!project) return;
    const { permissions } = await resolveEffectivePermissions(
      pool,
      project.organizationId,
      session.userId,
    );
    if (!permissions.has("leads.update")) {
      res.status(403).json({ error: "mangler_tillatelse", required: "leads.update" });
      return;
    }
    try {
      const limitRaw = Number((req.body ?? {}).limit);
      res.json(
        await placeUnplacedLeads(pool, {
          project,
          limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
        }),
      );
    } catch (error) {
      console.warn("[lead-placement] oppslag feilet:", (error as Error).message);
      res.status(500).json({ error: "placement_resolve_failed" });
    }
  });
}
