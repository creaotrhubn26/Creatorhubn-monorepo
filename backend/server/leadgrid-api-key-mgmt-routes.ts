/**
 * leadgrid-api-key-mgmt-routes.ts
 *
 * Admin-routes (session-auth) for å lage/liste/revokere Leadgrid API-keys.
 *
 *   POST   /api/leadgrid/api-keys              (api_keys.create)
 *   GET    /api/leadgrid/api-keys              (api_keys.view)
 *   POST   /api/leadgrid/api-keys/:id/revoke   (api_keys.revoke)
 *
 * Key-format: lgk_live_<24 bytes base64url>  (eller lgk_test_...)
 * Vi lagrer kun SHA-256-hash + prefix. Token vises KUN ved opprettelse.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { randomBytes, createHash } from "crypto";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  getLeadgridSession,
  hasLeadgridProjectsViewAllAccess,
  loadAccessibleLeadgridProject,
} from "./leadgrid-project-access.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

interface ManageableApiKeyRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  access_scope: "project" | "organization";
}

async function canManageOrganizationScopeKeys(
  pool: Pick<Pool, "query">,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const membership = await pool.query<{ role: string }>(
    `SELECT role
       FROM organization_members
      WHERE organization_id = $1::uuid
        AND user_id = $2
      LIMIT 1`,
    [organizationId, userId],
  );
  if (membership.rows[0]?.role !== "admin") return false;
  return hasLeadgridProjectsViewAllAccess(pool, { organizationId, userId });
}

async function canManageApiKey(
  pool: Pick<Pool, "query">,
  key: ManageableApiKeyRow,
  userId: string,
): Promise<boolean> {
  if (key.access_scope === "organization") {
    return key.project_id === null && canManageOrganizationScopeKeys(
      pool,
      key.organization_id,
      userId,
    );
  }
  if (!key.project_id) return false;
  const project = await loadAccessibleLeadgridProject(
    pool,
    key.project_id,
    userId,
  );
  return Boolean(
    project &&
      project.id === key.project_id &&
      project.organizationId === key.organization_id,
  );
}

/**
 * Smart org-id resolve for API-key mgmt:
 *  1. body.organization_id eller query.organization_id eksplisitt
 *  2. prosjektets organisasjon når project_id er oppgitt
 *  3. brukerens første organization_members-rad (admin > salgssjef > annet)
 */
async function resolveOrgIdSmart(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const explicit =
    (req.body && (req.body as Record<string, unknown>).organization_id) ??
    (req.query && (req.query as Record<string, unknown>).organization_id);
  if (typeof explicit === "string" && explicit.length > 0) return explicit;

  const requestedProject =
    (req.body && ((req.body as Record<string, unknown>).project_id ??
      (req.body as Record<string, unknown>).projectId)) ??
    (req.query && ((req.query as Record<string, unknown>).project_id ??
      (req.query as Record<string, unknown>).projectId));
  if (typeof requestedProject === "string" && requestedProject.trim()) {
    try {
      const project = await loadAccessibleLeadgridProject(
        pool,
        requestedProject.trim(),
        userId,
      );
      if (project) return project.organizationId;
    } catch {
      return null;
    }
  }

  try {
    const r = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text
         FROM organization_members
        WHERE user_id = $1
        ORDER BY CASE role
                   WHEN 'admin' THEN 1
                   WHEN 'salgssjef' THEN 2
                   ELSE 3
                 END,
                 joined_at ASC
        LIMIT 1`,
      [userId],
    );
    return r.rows[0]?.organization_id ?? null;
  } catch {
    return null;
  }
}

function generateApiKey(env: "live" | "test"): { token: string; prefix: string } {
  // Prefix er 9 tegn ("lgk_live_" / "lgk_test_") — matcher slice(0,9)
  // i leadgrid-api-key-auth.ts.
  const prefix = `lgk_${env}_`;
  const token = prefix + randomBytes(24).toString("base64url");
  return { token, prefix };
}

const VALID_SCOPES = new Set([
  "leads.read",
  "leads.write",
  "outcomes.write",
  "recommendations.read",
  "recommendations.write",
  "*",
]);

function sanitizeScopes(input: unknown): string[] {
  if (!Array.isArray(input)) return ["leads.read"];
  const cleaned = input
    .filter((s): s is string => typeof s === "string")
    .filter((s) => VALID_SCOPES.has(s));
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : ["leads.read"];
}

export function registerLeadgridApiKeyMgmtRoutes(deps: Deps): void {
  const { app, pool, activeSessions } = deps;
  const common = { pool, activeSessions, resolveOrgId: resolveOrgIdSmart };
  const permCreate = requireLeadMapPermission("api_keys.create", common);
  const permView = requireLeadMapPermission("api_keys.view", common);
  const permRevoke = requireLeadMapPermission("api_keys.revoke", common);

  // ───────────────────────────────────────────────────────────────────
  // POST /api/leadgrid/api-keys — opprett ny key
  // Body: { name, project_id, scopes?, env?, rate_limit_rpm?, expires_at? }
  // access_scope="organization" er et eksplisitt admin-only unntak.
  // Returnerer { id, token, warning } — token vises KUN her, kan ikke
  // hentes senere (vi lagrer kun hash).
  // ───────────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/api-keys", permCreate, async (req: Request, res: Response) => {
    const session = getLeadgridSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) {
      res.status(400).json({ error: "mangler_organization_id" });
      return;
    }
    const b = (req.body ?? {}) as {
      name?: string;
      scopes?: string[];
      env?: "live" | "test";
      rate_limit_rpm?: number;
      expires_at?: string;
      project_id?: string;
      projectId?: string;
      access_scope?: string;
      accessScope?: string;
    };
    const normalizedName = typeof b.name === "string" ? b.name.trim() : "";
    if (!normalizedName || normalizedName.length > 120) {
      res.status(400).json({ error: "invalid_name" });
      return;
    }

    const rawAccessScope = b.access_scope ?? b.accessScope ?? "project";
    if (rawAccessScope !== "project" && rawAccessScope !== "organization") {
      res.status(400).json({ error: "invalid_access_scope" });
      return;
    }
    const accessScope: "project" | "organization" = rawAccessScope;
    const rawProjectId = b.project_id ?? b.projectId;
    let projectId: string | null = null;

    if (accessScope === "project") {
      if (typeof rawProjectId !== "string" || !rawProjectId.trim() || rawProjectId.trim().length > 255) {
        res.status(400).json({ error: "project_id_required" });
        return;
      }
      try {
        const project = await loadAccessibleLeadgridProject(
          pool,
          rawProjectId.trim(),
          session.userId,
        );
        if (!project || project.organizationId !== orgId) {
          res.status(404).json({ error: "project_not_found" });
          return;
        }
        projectId = project.id;
      } catch (error) {
        console.warn("[api-key-mgmt] project lookup feilet:", error);
        res.status(500).json({ error: "project_lookup_failed" });
        return;
      }
    } else {
      if (rawProjectId !== undefined && rawProjectId !== null && rawProjectId !== "") {
        res.status(400).json({ error: "organization_scope_cannot_bind_project" });
        return;
      }
      try {
        if (!(await canManageOrganizationScopeKeys(pool, orgId, session.userId))) {
          res.status(403).json({ error: "organization_scope_requires_admin" });
          return;
        }
      } catch (error) {
        console.warn("[api-key-mgmt] admin lookup feilet:", error);
        res.status(500).json({ error: "admin_lookup_failed" });
        return;
      }
    }

    const env: "live" | "test" = b.env === "test" ? "test" : "live";
    const scopes = sanitizeScopes(b.scopes);
    const rateLimit =
      typeof b.rate_limit_rpm === "number" &&
      b.rate_limit_rpm > 0 &&
      b.rate_limit_rpm <= 10_000
        ? Math.floor(b.rate_limit_rpm)
        : 60;
    const { token, prefix } = generateApiKey(env);
    const keyHash = createHash("sha256").update(token).digest("hex");

    try {
      const r = await pool.query<{ id: string }>(
        `INSERT INTO leadgrid_api_keys
           (organization_id, project_id, access_scope, name, key_prefix, key_hash,
            scopes, rate_limit_rpm, expires_at, created_by)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
         RETURNING id::text`,
        [
          orgId,
          projectId,
          accessScope,
          normalizedName,
          prefix,
          keyHash,
          JSON.stringify(scopes),
          rateLimit,
          b.expires_at ?? null,
          session.userId,
        ],
      );
      // Token vises KUN nå — kan ikke hentes igjen.
      res.status(201).json({
        id: r.rows[0].id,
        token,
        prefix,
        project_id: projectId,
        access_scope: accessScope,
        scopes,
        rate_limit_rpm: rateLimit,
        env,
        warning:
          "Token vises KUN nå. Lagre den trygt. Vi lagrer kun SHA-256-hash.",
      });
    } catch (err) {
      console.warn("[api-key-mgmt] create feilet:", err);
      res.status(500).json({ error: "create_failed", detail: "internal_error" });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // GET /api/leadgrid/api-keys — list org-ens keys (uten klartekst-token)
  // ───────────────────────────────────────────────────────────────────
  app.get("/api/leadgrid/api-keys", permView, async (req: Request, res: Response) => {
    const session = getLeadgridSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) {
      res.status(400).json({ error: "mangler_organization_id" });
      return;
    }
    try {
      const r = await pool.query<ManageableApiKeyRow & Record<string, unknown>>(
        `SELECT k.id::text, k.organization_id::text, k.name, k.key_prefix,
                k.project_id, k.access_scope,
                p.name AS project_name, k.scopes, k.rate_limit_rpm,
                k.last_used_at::text, k.total_requests, k.expires_at::text,
                k.revoked_at::text, k.revoked_reason, k.created_at::text
           FROM leadgrid_api_keys k
           LEFT JOIN leadgrid_projects p
             ON p.organization_id = k.organization_id
            AND p.id = k.project_id
          WHERE k.organization_id = $1::uuid
          ORDER BY k.created_at DESC`,
        [orgId],
      );
      const visibility = new Map<string, Promise<boolean>>();
      const visibleRows = await Promise.all(
        r.rows.map(async (key) => {
          const boundary = key.access_scope === "organization"
            ? `organization:${key.organization_id}`
            : `project:${key.organization_id}:${key.project_id ?? ""}`;
          let allowed = visibility.get(boundary);
          if (!allowed) {
            allowed = canManageApiKey(pool, key, session.userId);
            visibility.set(boundary, allowed);
          }
          return (await allowed) ? key : null;
        }),
      );
      res.json({ data: visibleRows.filter((key) => key !== null) });
    } catch (err) {
      console.warn("[api-key-mgmt] list feilet:", err);
      res.status(500).json({ error: "list_failed" });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // POST /api/leadgrid/api-keys/:id/revoke — revoker en key
  // Body: { reason? }
  // ───────────────────────────────────────────────────────────────────
  app.post("/api/leadgrid/api-keys/:id/revoke", permRevoke, async (req: Request, res: Response) => {
    const session = getLeadgridSession(req, activeSessions);
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return;
    }
    const orgId = await resolveOrgIdSmart(req, pool, session.userId);
    if (!orgId) {
      res.status(400).json({ error: "mangler_organization_id" });
      return;
    }
    const reason = String(
      ((req.body as Record<string, unknown>)?.reason as string | undefined) ?? "manual",
    ).trim().slice(0, 500) || "manual";
    try {
      const lookup = await pool.query<ManageableApiKeyRow>(
        `SELECT id::text, organization_id::text, project_id, access_scope
           FROM leadgrid_api_keys
          WHERE id::text = $1
            AND organization_id = $2::uuid
            AND revoked_at IS NULL
          LIMIT 1`,
        [req.params.id, orgId],
      );
      const key = lookup.rows[0];
      if (!key || !(await canManageApiKey(pool, key, session.userId))) {
        res.status(404).json({ error: "ikke_funnet_eller_revokert" });
        return;
      }
      const r = await pool.query(
        `UPDATE leadgrid_api_keys
            SET revoked_at = NOW(), revoked_reason = $1
          WHERE id = $2::uuid
            AND organization_id = $3::uuid
            AND access_scope = $4
            AND project_id IS NOT DISTINCT FROM $5
            AND revoked_at IS NULL
          RETURNING id::text`,
        [
          reason,
          key.id,
          key.organization_id,
          key.access_scope,
          key.project_id,
        ],
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "ikke_funnet_eller_revokert" });
        return;
      }
      res.json({ ok: true, id: r.rows[0].id });
    } catch (err) {
      console.warn("[api-key-mgmt] revoke feilet:", err);
      res.status(500).json({ error: "revoke_failed" });
    }
  });
}
