/**
 * lead-map-permission-routes.ts
 *
 * Granulær tillatelses-styring per bruker per org.
 *
 * Endepunkter:
 *   GET   /permissions/catalog                       — alle permission-keys
 *   GET   /organizations/:id/role-defaults           — defaults per rolle
 *   GET   /organizations/:id/permissions/:userId     — effektive permissions
 *   POST  /organizations/:id/permissions/:userId/grant
 *   POST  /organizations/:id/permissions/:userId/revoke
 *   POST  /organizations/:id/permissions/:userId/reset
 *   GET   /organizations/:id/permissions/audit       — endringslogg
 *
 * Sikkerhets-regler:
 *   - Admin er ALLTID tillatt alt (sikkerhets-floor)
 *   - Kun brukere med 'permissions.manage' (= admin/salgssjef) kan
 *     endre andres permissions
 *   - Du kan ikke fjerne 'permissions.manage' fra siste admin
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUser(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const s = activeSessions.get(auth.slice(7));
    if (s) return s;
  }
  return null;
}

/** Hent effektive permissions = rolle-defaults + overstyringer */
export async function resolveEffectivePermissions(
  pool: Pool,
  organizationId: string,
  userId: string,
): Promise<{ role: string | null; permissions: Set<string> }> {
  const memRes = await pool.query<{ role: string }>(
    `SELECT role FROM organization_members
      WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
    [organizationId, userId],
  );
  if (memRes.rows.length === 0) {
    return { role: null, permissions: new Set() };
  }
  const role = memRes.rows[0].role;

  // Admin → alle (sikkerhets-floor)
  if (role === "admin") {
    const allRes = await pool.query<{ key: string }>(`SELECT key FROM permissions`);
    return { role, permissions: new Set(allRes.rows.map((r) => r.key)) };
  }

  // Default-permissions for rollen
  const defRes = await pool.query<{ permission_key: string }>(
    `SELECT permission_key FROM role_permissions WHERE role = $1`,
    [role],
  );
  const eff = new Set(defRes.rows.map((r) => r.permission_key));

  // Overstyringer
  const ovrRes = await pool.query<{ permission_key: string; effect: string }>(
    `SELECT permission_key, effect
       FROM user_permission_overrides
      WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId],
  );
  for (const row of ovrRes.rows) {
    if (row.effect === "grant") eff.add(row.permission_key);
    else if (row.effect === "revoke") eff.delete(row.permission_key);
  }

  return { role, permissions: eff };
}

/** Express-middleware helper: krever spesifikk permission */
export function requirePermission(
  pool: Pool,
  activeSessions: Map<string, SessionData>,
  permissionKey: string,
) {
  return async (req: Request, res: Response, next: () => void) => {
    const session = getUser(req, activeSessions);
    if (!session?.userId) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    const orgId = req.params.organizationId ?? req.params.id ?? req.body?.organization_id;
    if (!orgId) {
      res.status(400).json({ error: "mangler_organization_id" });
      return;
    }
    const { permissions } = await resolveEffectivePermissions(pool, orgId, session.userId);
    if (!permissions.has(permissionKey)) {
      res.status(403).json({
        error: "mangler_tillatelse",
        required: permissionKey,
      });
      return;
    }
    next();
  };
}

export function registerLeadMapPermissionRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── GET /permissions/catalog ────────────────────────────────────
  app.get(
    "/api/admin-room/lead-map/permissions/catalog",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query(
          `SELECT key, category, description FROM permissions
            ORDER BY category, key`,
        );
        return res.json({ permissions: r.rows });
      } catch (err) {
        return res.status(500).json({ error: "catalog_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /organizations/:id/role-defaults ────────────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/role-defaults",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query<{ role: string; permission_key: string }>(
          `SELECT role, permission_key FROM role_permissions ORDER BY role`,
        );
        const byRole: Record<string, string[]> = {};
        for (const row of r.rows) {
          if (!byRole[row.role]) byRole[row.role] = [];
          byRole[row.role].push(row.permission_key);
        }
        return res.json({ defaults: byRole });
      } catch (err) {
        return res.status(500).json({ error: "defaults_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /organizations/:id/permissions/:userId ──────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/permissions/:userId",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        // The caller must belong to this org; viewing ANOTHER user's
        // permissions additionally requires permissions.manage. Without this,
        // any logged-in user could enumerate any org's role assignments and
        // effective permission set for any userId (cross-tenant disclosure).
        const caller = await resolveEffectivePermissions(pool, req.params.id, session.userId);
        if (!caller.role) return res.status(403).json({ error: "ikke_medlem_av_org" });
        if (
          req.params.userId !== session.userId &&
          !caller.permissions.has("permissions.manage")
        ) {
          return res.status(403).json({ error: "mangler_permissions_manage" });
        }
        const { role, permissions } = await resolveEffectivePermissions(
          pool, req.params.id, req.params.userId,
        );
        if (!role) return res.status(404).json({ error: "ikke_medlem_av_org" });

        const ovrRes = await pool.query<{
          permission_key: string; effect: string; reason: string | null;
          granted_at: string;
        }>(
          `SELECT permission_key, effect, reason, granted_at::text
             FROM user_permission_overrides
            WHERE organization_id = $1 AND user_id = $2`,
          [req.params.id, req.params.userId],
        );
        return res.json({
          role,
          effective: Array.from(permissions).sort(),
          overrides: ovrRes.rows,
        });
      } catch (err) {
        return res.status(500).json({ error: "permissions_failed", detail: String(err) });
      }
    },
  );

  // ─── Felles helper for grant/revoke ──────────────────────────────
  async function applyOverride(
    req: Request, res: Response,
    effect: "grant" | "revoke",
  ): Promise<void> {
    const session = getUser(req, activeSessions);
    if (!session?.userId) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    // Caller må ha permissions.manage
    const callerPerm = await resolveEffectivePermissions(pool, req.params.id, session.userId);
    if (!callerPerm.permissions.has("permissions.manage")) {
      res.status(403).json({ error: "mangler_permissions_manage" });
      return;
    }
    const body = req.body as { permission_key?: string; reason?: string };
    if (!body.permission_key) {
      res.status(400).json({ error: "mangler_permission_key" });
      return;
    }
    // Verifiser at permission-key eksisterer
    const exists = await pool.query(
      `SELECT 1 FROM permissions WHERE key = $1`,
      [body.permission_key],
    );
    if (exists.rowCount === 0) {
      res.status(400).json({ error: "ukjent_permission_key" });
      return;
    }
    // Vern: ikke fjern permissions.manage fra siste admin
    if (effect === "revoke" && body.permission_key === "permissions.manage") {
      const adminCount = await pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM organization_members
          WHERE organization_id = $1 AND role = 'admin'`,
        [req.params.id],
      );
      const targetMem = await pool.query<{ role: string }>(
        `SELECT role FROM organization_members
          WHERE organization_id = $1 AND user_id = $2`,
        [req.params.id, req.params.userId],
      );
      if (targetMem.rows[0]?.role === "admin" && (adminCount.rows[0]?.n ?? 0) <= 1) {
        res.status(409).json({ error: "siste_admin_kan_ikke_miste_permissions_manage" });
        return;
      }
    }

    try {
      await pool.query(
        `INSERT INTO user_permission_overrides (
           organization_id, user_id, permission_key, effect,
           granted_by, reason
         ) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (organization_id, user_id, permission_key)
         DO UPDATE SET effect = EXCLUDED.effect,
                       granted_by = EXCLUDED.granted_by,
                       granted_at = NOW(),
                       reason = EXCLUDED.reason`,
        [
          req.params.id, req.params.userId, body.permission_key,
          effect, session.userId, body.reason ?? null,
        ],
      );
      await pool.query(
        `INSERT INTO permission_audit_log (
           organization_id, target_user_id, permission_key,
           action, performed_by, reason
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.params.id, req.params.userId, body.permission_key,
          effect, session.userId, body.reason ?? null,
        ],
      );
      res.json({ ok: true, effect });
    } catch (err) {
      res.status(500).json({ error: "override_failed", detail: String(err) });
    }
  }

  // ─── POST /organizations/:id/permissions/:userId/grant ───────────
  app.post(
    "/api/admin-room/lead-map/organizations/:id/permissions/:userId/grant",
    (req: Request, res: Response) => { void applyOverride(req, res, "grant"); },
  );

  // ─── POST /organizations/:id/permissions/:userId/revoke ──────────
  app.post(
    "/api/admin-room/lead-map/organizations/:id/permissions/:userId/revoke",
    (req: Request, res: Response) => { void applyOverride(req, res, "revoke"); },
  );

  // ─── POST /organizations/:id/permissions/:userId/reset ───────────
  // Fjern alle overstyringer for brukeren — tilbake til rolle-default
  app.post(
    "/api/admin-room/lead-map/organizations/:id/permissions/:userId/reset",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const callerPerm = await resolveEffectivePermissions(pool, req.params.id, session.userId);
      if (!callerPerm.permissions.has("permissions.manage")) {
        return res.status(403).json({ error: "mangler_permissions_manage" });
      }
      try {
        await pool.query(
          `DELETE FROM user_permission_overrides
            WHERE organization_id = $1 AND user_id = $2`,
          [req.params.id, req.params.userId],
        );
        await pool.query(
          `INSERT INTO permission_audit_log (
             organization_id, target_user_id, action, performed_by
           ) VALUES ($1, $2, 'reset_to_default', $3)`,
          [req.params.id, req.params.userId, session.userId],
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: "reset_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /organizations/:id/permissions/audit ────────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/permissions/audit",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const callerPerm = await resolveEffectivePermissions(pool, req.params.id, session.userId);
      if (!callerPerm.permissions.has("permissions.manage")) {
        return res.status(403).json({ error: "mangler_permissions_manage" });
      }
      const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);
      try {
        const r = await pool.query(
          `SELECT pal.*, u_target.email AS target_email, u_target.name AS target_name,
                  u_actor.email AS actor_email, u_actor.name AS actor_name
             FROM permission_audit_log pal
             LEFT JOIN users u_target ON u_target.id = pal.target_user_id
             LEFT JOIN users u_actor ON u_actor.id = pal.performed_by
            WHERE pal.organization_id = $1
            ORDER BY pal.performed_at DESC
            LIMIT $2`,
          [req.params.id, limit],
        );
        return res.json({ entries: r.rows });
      } catch (err) {
        return res.status(500).json({ error: "audit_failed", detail: String(err) });
      }
    },
  );
}
