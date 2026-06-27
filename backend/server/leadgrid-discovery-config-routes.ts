/**
 * leadgrid-discovery-config-routes.ts
 *
 * Mig 0353 — CRUD for leadgrid_project_discovery_config.
 *
 * Brukeren går inn på et prosjekt → "Auto-discover daglig"-toggle →
 * setter bransje + by + radius → backend lagrer config → cron-poller
 * (leadgrid-continuous-discovery.ts) plukker den opp og kjører
 * discovery automatisk.
 *
 * Endpoints:
 *   GET    /api/leadgrid/projects/:projectId/discovery-config
 *   PUT    /api/leadgrid/projects/:projectId/discovery-config
 *   DELETE /api/leadgrid/projects/:projectId/discovery-config
 *
 * Auth: requireLeadMapPermission('lead_research.run') — samme key som
 * /discover-leads-endpointet.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

interface ConfigBody {
  industry_query?: string | null;
  city_filter?: string[] | null;
  geography_lat?: number | null;
  geography_lng?: number | null;
  geography_radius_km?: number | null;
  count_per_run?: number | null;
  auto_discover_enabled?: boolean | null;
}

function getSession(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  const cookieSid = (
    req as Request & {
      session?: { userId?: string; email?: string; role?: string };
    }
  ).session;
  if (cookieSid?.userId) {
    return {
      userId: cookieSid.userId,
      email: cookieSid.email,
      role: cookieSid.role,
    };
  }
  return null;
}

async function resolveOrgId(
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text FROM organization_members
      WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

export function registerLeadgridDiscoveryConfigRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;

  const permRun = requireLeadMapPermission("lead_research.run", {
    pool,
    activeSessions,
  });

  // -------------------------------------------------------------------
  // GET /api/leadgrid/projects/:projectId/discovery-config
  // -------------------------------------------------------------------
  app.get(
    "/api/leadgrid/projects/:projectId/discovery-config",
    permRun,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const projectId = req.params.projectId;
      try {
        const r = await pool.query<{
          project_id: string;
          industry_query: string | null;
          city_filter: string[] | null;
          geography_lat: string | null;
          geography_lng: string | null;
          geography_radius_km: number | null;
          count_per_run: number;
          auto_discover_enabled: boolean;
          last_run_at: Date | null;
          next_run_at: Date | null;
          total_discoveries: number;
          total_pinned: number;
        }>(
          `SELECT project_id, industry_query, city_filter,
                  geography_lat::text, geography_lng::text,
                  geography_radius_km, count_per_run,
                  auto_discover_enabled, last_run_at, next_run_at,
                  total_discoveries, total_pinned
             FROM leadgrid_project_discovery_config
            WHERE project_id = $1
            LIMIT 1`,
          [projectId],
        );
        const row = r.rows[0];
        if (!row) {
          return res.json({
            config: null,
            project_id: projectId,
          });
        }
        return res.json({
          config: {
            project_id: row.project_id,
            industry_query: row.industry_query,
            city_filter: row.city_filter,
            geography_lat: row.geography_lat ? Number(row.geography_lat) : null,
            geography_lng: row.geography_lng ? Number(row.geography_lng) : null,
            geography_radius_km: row.geography_radius_km,
            count_per_run: row.count_per_run,
            auto_discover_enabled: row.auto_discover_enabled,
            last_run_at: row.last_run_at?.toISOString() ?? null,
            next_run_at: row.next_run_at?.toISOString() ?? null,
            total_discoveries: row.total_discoveries,
            total_pinned: row.total_pinned,
          },
        });
      } catch (err) {
        return res.status(500).json({
          error: "fetch_config_failed",
          detail: (err as Error).message,
        });
      }
    },
  );

  // -------------------------------------------------------------------
  // PUT /api/leadgrid/projects/:projectId/discovery-config
  // body: ConfigBody — upsert
  // -------------------------------------------------------------------
  app.put(
    "/api/leadgrid/projects/:projectId/discovery-config",
    permRun,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const projectId = req.params.projectId;
      const body = (req.body ?? {}) as ConfigBody;
      const orgId = await resolveOrgId(pool, session.userId);

      // Validér count_per_run [1, 50]
      const count =
        typeof body.count_per_run === "number"
          ? Math.max(1, Math.min(50, Math.floor(body.count_per_run)))
          : 10;
      // Validér radius [1, 100]
      const radius =
        typeof body.geography_radius_km === "number"
          ? Math.max(1, Math.min(100, Math.floor(body.geography_radius_km)))
          : 10;
      const enabled = body.auto_discover_enabled === true;

      try {
        await pool.query(
          `INSERT INTO leadgrid_project_discovery_config (
              project_id, industry_query, city_filter,
              geography_lat, geography_lng, geography_radius_km,
              count_per_run, auto_discover_enabled,
              organization_id, created_by_user_id,
              next_run_at, created_at, updated_at
            ) VALUES (
              $1, $2, $3,
              $4, $5, $6,
              $7, $8,
              $9::uuid, $10::uuid,
              CASE WHEN $8 THEN NOW() ELSE NULL END,
              NOW(), NOW()
            )
            ON CONFLICT (project_id) DO UPDATE
              SET industry_query = EXCLUDED.industry_query,
                  city_filter = EXCLUDED.city_filter,
                  geography_lat = EXCLUDED.geography_lat,
                  geography_lng = EXCLUDED.geography_lng,
                  geography_radius_km = EXCLUDED.geography_radius_km,
                  count_per_run = EXCLUDED.count_per_run,
                  auto_discover_enabled = EXCLUDED.auto_discover_enabled,
                  organization_id = COALESCE(EXCLUDED.organization_id,
                                            leadgrid_project_discovery_config.organization_id),
                  created_by_user_id = COALESCE(EXCLUDED.created_by_user_id,
                                                leadgrid_project_discovery_config.created_by_user_id),
                  next_run_at = CASE
                                  WHEN EXCLUDED.auto_discover_enabled
                                       AND leadgrid_project_discovery_config.auto_discover_enabled = FALSE
                                  THEN NOW()
                                  WHEN NOT EXCLUDED.auto_discover_enabled
                                  THEN NULL
                                  ELSE leadgrid_project_discovery_config.next_run_at
                                END,
                  updated_at = NOW()`,
          [
            projectId,
            body.industry_query ?? null,
            body.city_filter ?? null,
            body.geography_lat ?? null,
            body.geography_lng ?? null,
            radius,
            count,
            enabled,
            orgId,
            session.userId,
          ],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({
          error: "save_config_failed",
          detail: (err as Error).message,
        });
      }
    },
  );

  // -------------------------------------------------------------------
  // DELETE /api/leadgrid/projects/:projectId/discovery-config
  // -------------------------------------------------------------------
  app.delete(
    "/api/leadgrid/projects/:projectId/discovery-config",
    permRun,
    async (req: Request, res: Response) => {
      const session = getSession(req, activeSessions);
      if (!session?.userId) {
        return res.status(401).json({ error: "Innlogging kreves" });
      }
      const projectId = req.params.projectId;
      try {
        await pool.query(
          `DELETE FROM leadgrid_project_discovery_config WHERE project_id = $1`,
          [projectId],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({
          error: "delete_config_failed",
          detail: (err as Error).message,
        });
      }
    },
  );
}
