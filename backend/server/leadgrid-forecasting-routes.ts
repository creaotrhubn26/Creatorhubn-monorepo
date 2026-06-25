/**
 * leadgrid-forecasting-routes.ts
 *
 * Pakke 3B — endpoints for forecasting + attribution. Alle gated på
 * `forecasting.view` (admin/salgssjef/teamleder, jf. mig 323).
 *
 * Endepunkter:
 *   GET  /api/leadgrid/forecasting/pipeline?horizon=90
 *   POST /api/leadgrid/forecasting/pipeline/refresh   (sletter cache + recompute)
 *   GET  /api/leadgrid/forecasting/attribution?windowDays=90
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import { getOrComputeForecast, computeAttribution } from "./leadgrid-forecasting-service.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(req: Request, activeSessions: Map<string, SessionData>) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

async function resolveOrgIdSmart(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit =
    (req.query?.organization_id ?? (req.body as { organization_id?: string } | undefined)?.organization_id) as
      | string
      | undefined;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text FROM organization_members
      WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

export function registerLeadgridForecastingRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const perm = requireLeadMapPermission("forecasting.view", {
    pool,
    activeSessions,
    resolveOrgId: resolveOrgIdSmart,
  });

  // GET /api/leadgrid/forecasting/pipeline?horizon=90
  app.get(
    "/api/leadgrid/forecasting/pipeline",
    perm,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(400).json({ error: "mangler_organization_id" });
        return;
      }
      const horizon = Math.min(
        365,
        Math.max(7, parseInt(String(req.query.horizon ?? "90"), 10)),
      );
      try {
        const forecast = await getOrComputeForecast(pool, orgId, horizon);
        res.json({ forecast });
      } catch (err) {
        console.error("[forecasting] pipeline failed", err);
        res.status(500).json({ error: "forecast_failed", detail: String(err) });
      }
    },
  );

  // POST /api/leadgrid/forecasting/pipeline/refresh
  app.post(
    "/api/leadgrid/forecasting/pipeline/refresh",
    perm,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(400).json({ error: "mangler_organization_id" });
        return;
      }
      const horizon = Math.min(
        365,
        Math.max(7, parseInt(String((req.body as { horizon?: number | string } | undefined)?.horizon ?? "90"), 10)),
      );
      try {
        await pool.query(
          `DELETE FROM leadgrid_forecast_cache WHERE organization_id = $1::uuid AND horizon_days = $2`,
          [orgId, horizon],
        );
        const forecast = await getOrComputeForecast(pool, orgId, horizon);
        res.json({ forecast });
      } catch (err) {
        console.error("[forecasting] refresh failed", err);
        res.status(500).json({ error: "refresh_failed", detail: String(err) });
      }
    },
  );

  // GET /api/leadgrid/forecasting/attribution?windowDays=90
  app.get(
    "/api/leadgrid/forecasting/attribution",
    perm,
    async (req: Request, res: Response): Promise<void> => {
      const session = getSession(req, activeSessions);
      if (!session) {
        res.status(401).json({ error: "Innlogging kreves" });
        return;
      }
      const orgId = await resolveOrgIdSmart(req, pool, session.userId);
      if (!orgId) {
        res.status(400).json({ error: "mangler_organization_id" });
        return;
      }
      const windowDays = Math.min(
        365,
        Math.max(7, parseInt(String(req.query.windowDays ?? "90"), 10)),
      );
      try {
        const attribution = await computeAttribution(pool, orgId, windowDays);
        res.json({ attribution });
      } catch (err) {
        console.error("[forecasting] attribution failed", err);
        res.status(500).json({ error: "attribution_failed", detail: String(err) });
      }
    },
  );
}
