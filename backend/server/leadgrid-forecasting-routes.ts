/**
 * leadgrid-forecasting-routes.ts
 *
 * Pakke 3B — endpoints for forecasting + attribution. Alle gated på
 * `forecasting.view` (admin/salgssjef/teamleder, jf. mig 323).
 *
 * Endepunkter:
 *   GET  /api/leadgrid/forecasting/pipeline?projectId=...&horizon=90
 *   POST /api/leadgrid/forecasting/pipeline/refresh   (sletter cache + recompute)
 *   GET  /api/leadgrid/forecasting/attribution?projectId=...&windowDays=90
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { getOrComputeForecast, computeAttribution } from "./leadgrid-forecasting-service.js";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
  type LeadgridSession,
} from "./leadgrid-project-access.js";

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, LeadgridSession>;
}

function requestedProjectId(req: Request): string | null {
  const raw =
    (req.query as Record<string, unknown> | undefined)?.projectId
    ?? (req.query as Record<string, unknown> | undefined)?.project_id
    ?? (req.body as Record<string, unknown> | undefined)?.projectId
    ?? (req.body as Record<string, unknown> | undefined)?.project_id;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") throw new Error("invalid_project_id");
  const projectId = raw.trim();
  if (!projectId || projectId.length > 255) {
    throw new Error("invalid_project_id");
  }
  return projectId;
}

async function resolveProjectOrgId(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  try {
    const projectId = requestedProjectId(req);
    if (!projectId) return null;
    const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
    return project?.organizationId ?? null;
  } catch {
    return null;
  }
}

function boundedInteger(
  raw: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

export function registerLeadgridForecastingRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const perm = requireLeadMapPermission("forecasting.view", {
    pool,
    activeSessions,
    resolveOrgId: resolveProjectOrgId,
  });

  // GET /api/leadgrid/forecasting/pipeline?horizon=90
  app.get(
    "/api/leadgrid/forecasting/pipeline",
    perm,
    async (req: Request, res: Response): Promise<void> => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      let projectId: string | null;
      try {
        projectId = requestedProjectId(req);
      } catch {
        res.status(400).json({ error: "invalid_project_id" });
        return;
      }
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      try {
        const project = await loadAccessibleLeadgridProject(
          pool,
          projectId,
          session.userId,
        );
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const horizon = boundedInteger(req.query.horizon, 90, 7, 365);
        const forecast = await getOrComputeForecast(
          pool,
          project.organizationId,
          project.id,
          horizon,
        );
        res.json({ project_id: project.id, forecast });
      } catch (err) {
        console.error("[forecasting] pipeline failed", err);
        res.status(500).json({ error: "forecast_failed" });
      }
    },
  );

  // POST /api/leadgrid/forecasting/pipeline/refresh
  app.post(
    "/api/leadgrid/forecasting/pipeline/refresh",
    perm,
    async (req: Request, res: Response): Promise<void> => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      let projectId: string | null;
      try {
        projectId = requestedProjectId(req);
      } catch {
        res.status(400).json({ error: "invalid_project_id" });
        return;
      }
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      try {
        const project = await loadAccessibleLeadgridProject(
          pool,
          projectId,
          session.userId,
        );
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const horizon = boundedInteger(
          (req.body as { horizon?: unknown } | undefined)?.horizon,
          90,
          7,
          365,
        );
        await pool.query(
          `DELETE FROM leadgrid_forecast_cache
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND horizon_days = $3`,
          [project.organizationId, project.id, horizon],
        );
        const forecast = await getOrComputeForecast(
          pool,
          project.organizationId,
          project.id,
          horizon,
        );
        res.json({ project_id: project.id, forecast });
      } catch (err) {
        console.error("[forecasting] refresh failed", err);
        res.status(500).json({ error: "refresh_failed" });
      }
    },
  );

  // GET /api/leadgrid/forecasting/attribution?windowDays=90
  app.get(
    "/api/leadgrid/forecasting/attribution",
    perm,
    async (req: Request, res: Response): Promise<void> => {
      const session = getLeadgridSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      let projectId: string | null;
      try {
        projectId = requestedProjectId(req);
      } catch {
        res.status(400).json({ error: "invalid_project_id" });
        return;
      }
      if (!projectId) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      try {
        const project = await loadAccessibleLeadgridProject(
          pool,
          projectId,
          session.userId,
        );
        if (!project) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        const windowDays = boundedInteger(req.query.windowDays, 90, 7, 365);
        const attribution = await computeAttribution(
          pool,
          project.organizationId,
          project.id,
          windowDays,
        );
        res.json({ project_id: project.id, attribution });
      } catch (err) {
        console.error("[forecasting] attribution failed", err);
        res.status(500).json({ error: "attribution_failed" });
      }
    },
  );
}
