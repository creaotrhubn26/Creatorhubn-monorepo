/**
 * admin-room-activity-routes.ts
 *
 * Setup-funksjon for /api/admin-room/activity-log endpoint.
 * 1 endpoint: GET med valgfri filter på entityType / entityId og
 * limit (max 200, default 50). Skriver-siden av aktivitets-loggen
 * (logAdminActivity) er ikke en route — den eksponeres via deps og
 * kalles inline fra andre admin-room-route-moduler.
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupAdminActivityRoutes } from "./admin-room-activity-routes";
 *
 *   setupAdminActivityRoutes({
 *     app, pool, getActiveSessionFromRequest, requireAdminRoomAccess, logAdminActivity,
 *   });
 *
 * Mode-noter: ingen Role Room-modes påvirker dette endpointet.
 * Admin Room-funksjonalitet låst til produkteier.
 */

import type { AdminRoomRoutesDeps } from "./_shared";

export function setupAdminActivityRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess } = deps;

  app.get("/api/admin-room/activity-log", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const limit = Math.min(Number.parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : null;
    const entityId = typeof req.query.entityId === "string" ? req.query.entityId : null;
    try {
      const params: unknown[] = [session.userId];
      let where = "user_id = $1";
      if (entityType) {
        params.push(entityType);
        where += ` AND entity_type = $${params.length}`;
      }
      if (entityId) {
        params.push(entityId);
        where += ` AND entity_id = $${params.length}`;
      }
      params.push(limit);
      const result = await pool.query(
        `SELECT * FROM admin_activity_log
          WHERE ${where}
          ORDER BY created_at DESC
          LIMIT $${params.length}`,
        params,
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error("admin-room activity-log list error", err);
      res.status(500).json({ error: "Kunne ikke hente aktivitets-logg" });
    }
  });
}
