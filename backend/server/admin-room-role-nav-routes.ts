/**
 * admin-room-role-nav-routes.ts
 *
 * Setup-funksjon for /api/admin-room/role-nav-config endpoints.
 * Skilt ut fra index.ts fordi MCP-write-API-en ikke kunne pushe hele 3.9MB-
 * indeks-filen i én operasjon. Funksjonelt identisk med original 156-linjers
 * blokk i commit 4132405 (lokal-only, aldri pushet).
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleNavConfigRoutes } from './admin-room-role-nav-routes';
 *
 *   // Et sted etter pool, app, helpers er definert (f.eks. rett etter
 *   // app.patch("/api/admin-room/business-plan"...)):
 *   setupRoleNavConfigRoutes({
 *     app,
 *     pool,
 *     getActiveSessionFromRequest,
 *     requireAdminRoomAccess,
 *     logAdminActivity,
 *   });
 *
 * Se 139_role_nav_config.sql for tabell-skjema.
 */

import type { AdminRoomRoutesDeps } from "./_shared";

const VALID_ROLE_NAV_TAB_VALUES = new Set([
  "roles",
  "candidates",
  "crew",
  "schedule",
  "publishing",
  "carousel",
  "approval",
  "brief",
  "planner",
  "shooting",
  "shotlist",
  "mannskap",
  "agent",
  "admin-room",
]);

const VALID_USER_ROLE_TYPES = new Set([
  "director",
  "producer",
  "casting_director",
  "production_manager",
  "camera_team",
  "content_producer",
  "client_reviewer",
  "agency",
  "writer",
  "script_editor",
  "reader",
]);

export function setupRoleNavConfigRoutes(deps: AdminRoomRoutesDeps): void {
  const {
    app,
    pool,
    getActiveSessionFromRequest,
    requireAdminRoomAccess,
    logAdminActivity,
  } = deps;

  // ── Lesing åpen for innloggede ────────────────────────────
  // Hver bruker trenger å hente sin egen rolle-konfig ved oppstart.
  app.get("/api/admin-room/role-nav-config", async (req, res) => {
    const session = getActiveSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    try {
      const result = await pool.query(
        `SELECT role, tab_values, updated_at, updated_by
           FROM role_nav_config
           ORDER BY role ASC`,
      );
      res.json({
        configs: result.rows.map((row: { role: string; tab_values: string[]; updated_at: Date; updated_by: string | null }) => ({
          role: row.role,
          tabValues: row.tab_values,
          updatedAt: row.updated_at,
          updatedBy: row.updated_by,
        })),
      });
    } catch (err) {
      console.error("admin-room role-nav-config list error", err);
      res.status(500).json({ error: "Kunne ikke hente rolle-nav-konfig" });
    }
  });

  // ── Skriving kun for produkteier ──────────────────────────
  app.put("/api/admin-room/role-nav-config/:role", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const role = String(req.params.role || "").trim();
    if (!VALID_USER_ROLE_TYPES.has(role)) {
      res.status(400).json({ error: `Ukjent rolle: ${role}` });
      return;
    }

    const body = (req.body ?? {}) as { tabValues?: unknown };
    if (!Array.isArray(body.tabValues)) {
      res.status(400).json({ error: "tabValues må være en array" });
      return;
    }

    // Filter, dedupe, validate
    const sanitized: string[] = [];
    const seen = new Set<string>();
    for (const raw of body.tabValues) {
      if (typeof raw !== "string") continue;
      const trimmed = raw.trim();
      if (!VALID_ROLE_NAV_TAB_VALUES.has(trimmed)) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      sanitized.push(trimmed);
    }
    if (sanitized.length === 0) {
      res.status(400).json({ error: "Minst én gyldig fane må være valgt" });
      return;
    }

    try {
      const result = await pool.query(
        `INSERT INTO role_nav_config (role, tab_values, updated_at, updated_by)
           VALUES ($1, $2, now(), $3)
         ON CONFLICT (role) DO UPDATE
           SET tab_values = EXCLUDED.tab_values,
               updated_at = EXCLUDED.updated_at,
               updated_by = EXCLUDED.updated_by
         RETURNING role, tab_values, updated_at, updated_by`,
        [role, sanitized, session.email],
      );
      const row = result.rows[0] as { role: string; tab_values: string[]; updated_at: Date; updated_by: string | null };
      await logAdminActivity({
        userId: session.userId,
        entityType: "role_nav_config",
        entityId: role,
        action: "updated",
        summary: `Oppdaterte navigasjon for rolle "${role}"`,
        details: { tabValues: sanitized },
      });
      res.json({
        config: {
          role: row.role,
          tabValues: row.tab_values,
          updatedAt: row.updated_at,
          updatedBy: row.updated_by,
        },
      });
    } catch (err) {
      console.error("admin-room role-nav-config update error", err);
      res.status(500).json({ error: "Kunne ikke lagre rolle-nav-konfig" });
    }
  });

  app.delete("/api/admin-room/role-nav-config/:role", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const role = String(req.params.role || "").trim();
    if (!VALID_USER_ROLE_TYPES.has(role)) {
      res.status(400).json({ error: `Ukjent rolle: ${role}` });
      return;
    }

    try {
      await pool.query(`DELETE FROM role_nav_config WHERE role = $1`, [role]);
      await logAdminActivity({
        userId: session.userId,
        entityType: "role_nav_config",
        entityId: role,
        action: "deleted",
        summary: `Tilbakestilte navigasjon for rolle "${role}" til defaults`,
      });
      res.json({ ok: true, role });
    } catch (err) {
      console.error("admin-room role-nav-config delete error", err);
      res.status(500).json({ error: "Kunne ikke tilbakestille rolle-nav-konfig" });
    }
  });
}
