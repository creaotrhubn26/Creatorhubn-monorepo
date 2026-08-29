/**
 * Org-status policy for Leadgrid and Lead Map.
 *
 * Core matrix:
 *   active              -> read + write
 *   paused / read_only  -> read only
 *   suspended / closed  -> blocked
 *
 * The middleware is deliberately mounted before the first protected route in
 * index.ts. Writes fail closed when tenant context or status cannot be proven;
 * legacy reads remain backwards compatible when context is unavailable, while
 * Canvas reads fail closed because they return drawings, OCR and PDF metadata.
 */

import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const READ_METHODS = new Set(["GET", "HEAD"]);
const CANVAS_PATH = /^\/api\/leadgrid\/canvas(?:\/|$)/i;

type SessionData = { userId: string; role?: string; email?: string };
type MaybePromise<T> = T | Promise<T>;

export interface OrgStatusOptions {
  /** Additional restriction. It can never loosen the core matrix above. */
  allowedStatuses?: string[];
  resolveOrgId?: (req: Request) => MaybePromise<string | null | undefined>;
  resolveSession?: (req: Request) => MaybePromise<SessionData | null | undefined>;
  isExempt?: (req: Request) => boolean;
  /** Defaults to true. Only the database role is trusted for bypass. */
  bypassForSuperAdmin?: boolean;
}

type UserContext = {
  role: string | null;
  activeOrgId: string | null;
};

type OrgStatusRow = {
  status: string;
  pause_reason: string | null;
  pause_resume_at: string | null;
};

export type CanonicalOrgAccess = {
  organizationId: string;
  status: string;
  canRead: boolean;
  canWrite: boolean;
  superAdminBypass: boolean;
};

type CanonicalResourceOrg = {
  matched: boolean;
  organizationId: string | null;
};

function scalar(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string" && typeof candidate !== "number") return null;
  const normalized = String(candidate).trim();
  return normalized.length > 0 ? normalized : null;
}

function requestPath(req: Request): string {
  const raw = req.originalUrl || req.url || req.path;
  return raw.split("?", 1)[0].replace(/\/+$/, "") || "/";
}

function isRead(req: Request): boolean {
  return READ_METHODS.has(req.method.toUpperCase());
}

function methodIs(req: Request, ...methods: string[]): boolean {
  return methods.includes(req.method.toUpperCase());
}

/**
 * Routes that must be reachable before an organization exists, or are secured
 * by a separate provider/token contract. Keep this list method-specific: an
 * exempt public read must not accidentally open a management write endpoint.
 */
export function isLeadgridOrgStatusExempt(req: Request): boolean {
  const path = requestPath(req);
  if (req.method.toUpperCase() === "OPTIONS") return true;

  const publicAuthGets = new Set([
    "/api/leadgrid/auth/google/start",
    "/api/leadgrid/auth/google/web-callback",
  ]);
  const publicAuthPosts = new Set([
    "/api/leadgrid/auth/google/callback",
    "/api/leadgrid/auth/google/exchange",
  ]);
  if (publicAuthGets.has(path) && methodIs(req, "GET", "HEAD")) return true;
  if (publicAuthPosts.has(path) && methodIs(req, "POST")) return true;

  // Provider-/service-auth håndheves i workflow-trigger-ruten. Hold listen
  // eksakt slik at en fremtidig management-rute under /events ikke arver et
  // pre-org-unntak ved et uhell.
  const workflowEventPosts = new Set([
    "/api/leadgrid/events/email/opened",
    "/api/leadgrid/events/email/link-clicked",
    "/api/leadgrid/events/meetings/booked",
    "/api/leadgrid/events/meetings/no-show",
    "/api/leadgrid/events/proposals/opened",
    "/api/leadgrid/events/contracts/signed",
  ]);
  if (workflowEventPosts.has(path) && methodIs(req, "POST")) return true;

  if (
    (path === "/api/leadgrid/ai-queue/health" ||
      path === "/api/leadgrid/realtime/health") &&
    methodIs(req, "GET", "HEAD")
  ) return true;

  if (
    (/^\/api\/leadgrid\/cron(?:\/|$)/.test(path) ||
      /^\/api\/admin-room\/lead-map\/cron(?:\/|$)/.test(path)) &&
    methodIs(req, "POST")
  ) return true;

  const servicePosts = new Set([
    "/api/leadgrid/scheduled-reports/run",
    "/api/leadgrid/trips/report/cron",
    "/api/leadgrid/drips/run",
    "/api/leadgrid/drips/converted",
    "/api/leadgrid/plan-grace/expire",
    "/api/leadgrid/api-overage/process",
    "/api/leadgrid/cpv/backfill",
    "/api/leadgrid/leadbook/ai-usage/bill",
    "/api/leadgrid/reverifications/check",
    "/api/leadgrid/doffin/cron/ukesdigest",
    "/api/leadgrid/doffin/cron/check-watches",
    "/api/leadgrid/intelligence/cron/daily-rescore",
  ]);
  if (servicePosts.has(path) && methodIs(req, "POST")) return true;

  const publicReads = new Set([
    "/api/leadgrid/pricing-config",
    "/api/leadgrid/experience-config",
    "/api/leadgrid/testimonials",
    "/api/leadgrid/partners",
    "/api/leadgrid/partner-terms",
    "/api/leadgrid/marketplace",
    "/api/leadgrid/self-onboard-templates",
    "/api/leadgrid/plan/limits",
    "/api/leadgrid/assets/logo.png",
  ]);
  if (publicReads.has(path) && isRead(req)) return true;

  const publicPosts = new Set([
    "/api/leadgrid/testimonials",
    "/api/leadgrid/self-onboard",
    "/api/leadgrid/self-onboard/consume-magic",
    "/api/leadgrid/developer-application",
    "/api/leadgrid/signup-interest",
    "/api/leadgrid/demo-request",
    "/api/leadgrid/app-waitlist",
  ]);
  if (publicPosts.has(path) && methodIs(req, "POST")) return true;

  if (/^\/api\/leadgrid\/p\/[^/]+$/.test(path) && isRead(req)) return true;
  if (
    /^\/api\/leadgrid\/intent\/[^/]+(?:\/(?:sign|reject))?$/.test(path) &&
    methodIs(req, "GET", "HEAD", "POST")
  ) return true;
  if (/^\/api\/leadgrid\/dorsalg\/confirm\/[^/]+$/.test(path) && isRead(req)) return true;
  if (
    /^\/api\/leadgrid\/partner-invitation\/[^/]+\/accept$/.test(path) &&
    methodIs(req, "POST")
  ) return true;
  if (
    /^\/api\/leadgrid\/portal\/[^/]+\/notification-prefs(?:\/unsubscribe)?$/.test(path) &&
    methodIs(req, "GET", "HEAD", "PUT", "POST")
  ) return true;
  if (
    /^\/api\/admin-room\/lead-map\/pitch-deck\/p\/[^/]+(?:\.pix)?$/.test(path) &&
    isRead(req)
  ) return true;

  // List/switch and first organization creation must work before a target org
  // has been selected. Detail/member routes remain protected.
  if (
    path === "/api/admin-room/lead-map/organizations" &&
    methodIs(req, "GET", "HEAD", "POST")
  ) return true;

  return false;
}

function readSessionToken(req: Request): string | null {
  const auth = scalar(req.headers.authorization);
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  return bearer ||
    scalar(req.headers["x-session-token"]) ||
    scalar(req.headers["x-auth-token"]) ||
    scalar((req as Request & { cookies?: Record<string, unknown> }).cookies?.sessionToken);
}

function sessionFromMap(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const token = readSessionToken(req);
  return token ? activeSessions.get(token) ?? null : null;
}

function explicitOrgId(req: Request): string | null {
  const body = req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)
    ? req.body as Record<string, unknown>
    : {};
  const query = req.query as Record<string, unknown>;
  const params = req.params as Record<string, unknown>;
  const direct = [
    body.organization_id,
    body.organizationId,
    body.orgId,
    query.organization_id,
    query.organizationId,
    query.orgId,
    params.organizationId,
    params.orgId,
    req.headers["x-organization-id"],
  ].map(scalar).find(Boolean);
  if (direct) return direct;

  // Downstream route params are not populated yet when app.use runs, so the
  // known organization-detail route is parsed from originalUrl. We never use
  // a generic :id because that commonly represents a lead/resource id.
  const match = requestPath(req).match(
    /^\/api\/admin-room\/lead-map\/organizations\/([^/]+)(?:\/|$)/,
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Resolve tenant ownership from the resource being mutated. This must run
 * before request-supplied organization fields: otherwise a caller can put an
 * active org in the body while mutating a lead that belongs to a paused org.
 *
 * Keep the resolver deliberately narrow and fail closed for recognized lead
 * routes. Other route families continue through their route-local RBAC.
 */
async function canonicalResourceOrg(
  pool: Pool,
  req: Request,
): Promise<CanonicalResourceOrg> {
  const path = requestPath(req);
  const match = path.match(
    /^\/api\/(?:admin-room\/lead-map|leadgrid)\/leads\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/|$)/i,
  );
  if (!match) return { matched: false, organizationId: null };

  const result = await pool.query<{ organization_id: string | null }>(
    `SELECT COALESCE(c.organization_id::text, cp.organization_id::text)
              AS organization_id
       FROM crm_customers c
       LEFT JOIN casting_projects cp ON cp.id = c.project_id
      WHERE c.id::text = $1
      LIMIT 1`,
    [match[1]],
  );
  return {
    matched: true,
    organizationId: scalar(result.rows[0]?.organization_id),
  };
}

async function sessionCanAccessOrg(
  pool: Pool,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const membership = await pool.query(
    `SELECT 1
       FROM organization_members
      WHERE organization_id::text = $1
        AND user_id::text = $2
      LIMIT 1`,
    [organizationId, userId],
  );
  if ((membership.rowCount ?? membership.rows.length) > 0) return true;

  const ownership = await pool.query(
    `SELECT 1
       FROM organizations
      WHERE id::text = $1
        AND owner_user_id::text = $2
      LIMIT 1`,
    [organizationId, userId],
  );
  if ((ownership.rowCount ?? ownership.rows.length) > 0) return true;

  try {
    const enterprise = await pool.query(
      `SELECT 1
         FROM enterprise_team_members
        WHERE organization_id::text = $1
          AND user_id::text = $2
          AND status = 'active'
        LIMIT 1`,
      [organizationId, userId],
    );
    return (enterprise.rowCount ?? enterprise.rows.length) > 0;
  } catch (error) {
    if (isOptionalSchemaError(error)) return false;
    throw error;
  }
}

/**
 * Canonical tenant decision for transports that do not pass through Express
 * middleware (notably WebSocket upgrades). It deliberately mirrors the HTTP
 * policy's current-user, membership/ownership and organization-status checks.
 */
export async function resolveCanonicalOrgAccess(
  pool: Pool,
  userId: string,
  organizationId: string,
): Promise<CanonicalOrgAccess | null> {
  const user = await pool.query<{ role: string | null; is_active: boolean | null }>(
    `SELECT role, COALESCE(is_active, TRUE) AS is_active
       FROM users
      WHERE id::text = $1
      LIMIT 1`,
    [userId],
  );
  const row = user.rows[0];
  if (!row || row.is_active !== true) return null;

  const role = String(row.role ?? "").trim().toLowerCase();
  if (role === "super_admin") {
    return {
      organizationId,
      status: "super_admin",
      canRead: true,
      canWrite: true,
      superAdminBypass: true,
    };
  }

  if (!(await sessionCanAccessOrg(pool, userId, organizationId))) return null;
  const organization = await pool.query<{ status: string }>(
    `SELECT status
       FROM organizations
      WHERE id::text = $1
      LIMIT 1`,
    [organizationId],
  );
  const status = String(organization.rows[0]?.status ?? "").trim().toLowerCase();
  if (!status) return null;
  return {
    organizationId,
    status,
    canRead: status === "active" || status === "paused" || status === "read_only",
    canWrite: status === "active",
    superAdminBypass: false,
  };
}

function isOptionalSchemaError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "42703";
}

async function readUserContext(pool: Pool, userId: string): Promise<UserContext> {
  const result = await pool.query<{ role: string | null; active_org_id: string | null }>(
    `SELECT role, NULLIF(meta->>'active_org_id', '') AS active_org_id
       FROM users
      WHERE id::text = $1
      LIMIT 1`,
    [userId],
  );
  return {
    role: result.rows[0]?.role ?? null,
    activeOrgId: result.rows[0]?.active_org_id ?? null,
  };
}

async function resolveOrgForSession(
  pool: Pool,
  session: SessionData,
  user: UserContext,
): Promise<string | null> {
  try {
    const override = await pool.query<{ override_org_id: string | null }>(
      `SELECT override_org_id
         FROM leadgrid_org_overrides
        WHERE user_id::text = $1
        LIMIT 1`,
      [session.userId],
    );
    const value = scalar(override.rows[0]?.override_org_id);
    if (value) return value === "self" ? session.userId : value;
  } catch (error) {
    if (!isOptionalSchemaError(error)) throw error;
  }

  if (user.activeOrgId) return user.activeOrgId;

  const candidates = new Set<string>();
  const memberships = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text AS organization_id
       FROM organization_members
      WHERE user_id::text = $1`,
    [session.userId],
  );
  for (const row of memberships.rows) {
    const id = scalar(row.organization_id);
    if (id) candidates.add(id);
  }

  try {
    const enterprise = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text AS organization_id
         FROM enterprise_team_members
        WHERE user_id::text = $1 AND status = 'active'`,
      [session.userId],
    );
    for (const row of enterprise.rows) {
      const id = scalar(row.organization_id);
      if (id) candidates.add(id);
    }
  } catch (error) {
    if (!isOptionalSchemaError(error)) throw error;
  }

  if (candidates.size === 1) return [...candidates][0];
  if (candidates.size > 1) return null;
  return session.userId; // legacy solo organization
}

function blockedForMissingContext(res: Response) {
  return res.status(403).json({
    error: "org_context_required",
    message: "Velg en organisasjon før denne handlingen kan utføres.",
  });
}

export function enforceOrgStatus(
  pool: Pool,
  activeSessions: Map<string, SessionData>,
  opts: OrgStatusOptions = {},
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if ((opts.isExempt ?? isLeadgridOrgStatusExempt)(req)) return next();

    const write = WRITE_METHODS.has(req.method.toUpperCase());
    const requiresProvenOrgContext = write || CANVAS_PATH.test(requestPath(req));
    try {
      const session = opts.resolveSession
        ? await opts.resolveSession(req) ?? null
        : sessionFromMap(req, activeSessions);

      // Public and service-auth routes have already been handled by the exact
      // exemption matrix. Never disclose organization status/reason for a
      // protected route until a session has been proven.
      if (!session) {
        return requiresProvenOrgContext
          ? res.status(401).json({ error: "authentication_required" })
          : next();
      }
      const user = session
        ? await readUserContext(pool, session.userId)
        : { role: null, activeOrgId: null };

      if (
        session &&
        opts.bypassForSuperAdmin !== false &&
        user.role === "super_admin"
      ) return next();

      const resource = await canonicalResourceOrg(pool, req);
      if (resource.matched && !resource.organizationId) {
        return requiresProvenOrgContext
          ? res.status(404).json({ error: "resource_not_found" })
          : next();
      }

      const suppliedOrg = explicitOrgId(req);
      if (
        resource.organizationId && suppliedOrg &&
        resource.organizationId !== suppliedOrg
      ) {
        return res.status(403).json({ error: "org_context_mismatch" });
      }

      const customOrg = opts.resolveOrgId ? await opts.resolveOrgId(req) : null;
      const orgId = resource.organizationId || scalar(customOrg) || suppliedOrg ||
        await resolveOrgForSession(pool, session, user);

      if (!orgId) {
        return requiresProvenOrgContext ? blockedForMissingContext(res) : next();
      }

      if (!(await sessionCanAccessOrg(pool, session.userId, orgId))) {
        return res.status(403).json({ error: "org_access_denied" });
      }

      let orgRow: OrgStatusRow | undefined;
      try {
        const result = await pool.query<OrgStatusRow>(
          `SELECT status, pause_reason, pause_resume_at
             FROM organizations
            WHERE id::text = $1
            LIMIT 1`,
          [orgId],
        );
        orgRow = result.rows[0];
      } catch (error) {
        console.error("[enforceOrgStatus] status lookup failed", error);
        return requiresProvenOrgContext
          ? res.status(503).json({ error: "org_status_unavailable" })
          : next();
      }

      if (!orgRow) {
        return requiresProvenOrgContext
          ? res.status(403).json({ error: "org_context_invalid" })
          : next();
      }

      const { status } = orgRow;
      if (status === "suspended" || status === "closed") {
        return res.status(403).json({
          error: "org_suspended",
          status,
          reason: orgRow.pause_reason,
          message: status === "suspended"
            ? "Organisasjonen er suspendert. Kontakt support."
            : "Organisasjonen er lukket.",
        });
      }

      if ((status === "paused" || status === "read_only") && write) {
        return res.status(423).json({
          error: "org_paused",
          status,
          reason: orgRow.pause_reason,
          resume_at: orgRow.pause_resume_at,
          message: status === "paused"
            ? "Organisasjonen er på pause. Kun lese-tilgang."
            : "Organisasjonen er i read-only-modus.",
        });
      }

      if (
        !["active", "paused", "read_only"].includes(status) &&
        requiresProvenOrgContext
      ) {
        return res.status(423).json({ error: "org_status_not_allowed", status });
      }

      if (opts.allowedStatuses && !opts.allowedStatuses.includes(status)) {
        return res.status(423).json({
          error: "org_status_not_allowed",
          status,
          allowed: opts.allowedStatuses,
        });
      }

      return next();
    } catch (error) {
      console.error("[enforceOrgStatus] context resolution failed", error);
      return requiresProvenOrgContext
        ? res.status(503).json({ error: "org_status_unavailable" })
        : next();
    }
  };
}
