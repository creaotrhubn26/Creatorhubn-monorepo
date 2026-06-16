/**
 * lead-map-rbac-helper.ts
 *
 * Felles auth-helper som plumber RBAC-systemet (lead-map-permission-
 * routes.ts) inn på de eksisterende lead-map-route-ene.
 *
 * Bruk:
 *   app.post("/api/.../leads", requireLeadMapPermission("leads.create", {
 *     pool, activeSessions,
 *     // Hvor org-id resolves fra:
 *     resolveOrgId: async (req, pool) => req.body.organization_id ??
 *       await orgFromProjectId(pool, req.body.projectId),
 *   }), async (req, res) => { ... });
 *
 * Den ene store kompleksiteten: legacy-leads har ikke organization_id
 * på rad-nivå; vi resolver via casting_projects.organization_id eller
 * lead.owner_user_id → bruker → eier-org. Hvis ingen finnes, faller
 * vi tilbake til Daniels default-org (Creatorhub AS).
 */

import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";

type SessionData = { userId: string; role?: string; email?: string };

interface PermissionOptions {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  /** Egendefinert resolve hvis org-id ikke ligger i body/query/params */
  resolveOrgId?: (req: Request, pool: Pool, userId: string) => Promise<string | null>;
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

/** Default org-resolve: body > query > params > prosjekt-FK > brukerens default-org */
async function defaultResolveOrgId(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  // 1. Eksplisitt i request
  const candidates = [
    req.body?.organization_id,
    req.body?.organizationId,
    req.query?.organization_id,
    req.query?.organizationId,
    req.params?.organizationId,
    req.params?.id, // for /organizations/:id-rutene
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  // 2. Avled fra projectId i body/params
  const projectId = req.body?.projectId ?? req.body?.project_id
    ?? req.query?.projectId ?? req.query?.project_id
    ?? req.params?.projectId;
  if (typeof projectId === "string" && projectId.length > 0) {
    const r = await pool.query<{ organization_id: string | null }>(
      `SELECT organization_id::text FROM casting_projects WHERE id = $1 LIMIT 1`,
      [projectId],
    );
    if (r.rows[0]?.organization_id) return r.rows[0].organization_id;
  }
  // 3. Avled fra lead-id i params (for /leads/:id)
  const leadId = req.params?.leadId ?? req.params?.id;
  if (typeof leadId === "string" && leadId.length > 0) {
    const r = await pool.query<{ organization_id: string | null }>(
      `SELECT cp.organization_id::text
         FROM crm_customers c
         LEFT JOIN casting_projects cp ON cp.id = c.project_id
        WHERE c.id = $1 LIMIT 1`,
      [leadId],
    );
    if (r.rows[0]?.organization_id) return r.rows[0].organization_id;
  }
  // 4. Brukerens default-org (første admin/owner-medlemskap)
  const r = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text
       FROM organization_members
      WHERE user_id = $1
      ORDER BY
        CASE role
          WHEN 'admin' THEN 1
          WHEN 'salgssjef' THEN 2
          ELSE 3
        END,
        joined_at ASC
      LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

/**
 * Express-middleware. Returnerer 401/403 hvis bruker ikke har permission,
 * ellers next().
 */
export function requireLeadMapPermission(
  permissionKey: string,
  opts: PermissionOptions,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const resolver = opts.resolveOrgId ?? defaultResolveOrgId;
  return async (req, res, next) => {
    const session = getUser(req, opts.activeSessions);
    if (!session?.userId) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    const orgId = await resolver(req, opts.pool, session.userId);
    if (!orgId) {
      // Ingen org-kobling enda — slipp gjennom for å beholde
      // bakoverkompatibilitet på legacy data (rad-nivå owner_user_id
      // gjelder fortsatt på underliggende rute).
      next();
      return;
    }
    const { role, permissions } = await resolveEffectivePermissions(
      opts.pool, orgId, session.userId,
    );
    if (!role) {
      res.status(403).json({ error: "ikke_medlem_av_org", organization_id: orgId });
      return;
    }
    if (!permissions.has(permissionKey)) {
      res.status(403).json({
        error: "mangler_tillatelse",
        required: permissionKey,
        organization_id: orgId,
      });
      return;
    }
    next();
  };
}

/**
 * GET /api/admin-room/lead-map/me/permissions?organization_id=...
 *
 * Returnerer effektive permissions for innlogget bruker i én org.
 * Frontend bruker dette til å gate knapper/menyer.
 */
export function registerMePermissionsRoute(
  app: import("express").Express,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): void {
  app.get(
    "/api/admin-room/lead-map/me/permissions",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const orgId =
        (typeof req.query.organization_id === "string" && req.query.organization_id)
        || (await defaultResolveOrgId(req, pool, session.userId));
      if (!orgId) {
        return res.json({ role: null, permissions: [], organization_id: null });
      }
      const { role, permissions } = await resolveEffectivePermissions(
        pool, orgId, session.userId,
      );
      return res.json({
        role,
        permissions: Array.from(permissions).sort(),
        organization_id: orgId,
      });
    },
  );
}
