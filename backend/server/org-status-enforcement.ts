/**
 * org-status-enforcement.ts
 *
 * Middleware som håndhever organisasjons-status:
 *   - active     → alt funker
 *   - paused     → kan lese, ikke skrive. Banner i UI.
 *   - read_only  → kan lese, ikke skrive. Banner i UI ("vedlikehold").
 *   - suspended  → totalt blokkert. 403 på ALLE Leadgrid-rutene.
 *   - closed     → som suspended, men permanent.
 *
 * Brukes som:
 *   app.use(requireActiveOrg(pool, activeSessions, { allowReadInPaused: true }));
 *
 * Eller per rute hvor vi vet orgId kommer fra body/query/params:
 *   app.post('/api/...', enforceOrgStatus(pool, { allowedStatuses: ['active'] }), handler);
 */

import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface OrgStatusOptions {
  /** Hvilke statuser tillates? Default: kun 'active' for mutasjoner, alle untatt suspended/closed for GET */
  allowedStatuses?: string[];
  /** Hvor finner vi orgId? Default: req.body.organization_id eller req.params.orgId eller req.query.orgId */
  resolveOrgId?: (req: Request) => string | null | undefined;
  /** Tillat super_admin å bypasse (default: FALSE — support bruker egne flater) */
  bypassForSuperAdmin?: boolean;
}

type SessionData = { userId: string; role?: string; email?: string };

function defaultResolveOrgId(req: Request): string | null {
  return (req.body?.organization_id
       ?? req.body?.orgId
       ?? req.params?.orgId
       ?? req.query?.orgId
       ?? req.query?.organization_id
       ?? req.get("X-Leadgrid-Organization-Id")
       ?? null) as string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Resolve the tenant from authoritative route resources, not a caller header. */
async function resolveResourceOrganizationId(
  pool: Pool,
  req: Request,
): Promise<string | null> {
  const projectMatch = req.path.match(/\/projects\/([^/]+)/);
  if (projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]);
    const result = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text FROM leadgrid_projects
        WHERE id = $1 AND organization_id IS NOT NULL LIMIT 1`,
      [projectId],
    );
    if (result.rows[0]?.organization_id) return result.rows[0].organization_id;
  }

  const leadMatch = req.path.match(/\/leads\/([0-9a-f-]{36})(?:\/|$)/i);
  if (leadMatch && UUID_PATTERN.test(leadMatch[1])) {
    const result = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text FROM crm_customers
        WHERE id = $1::uuid AND organization_id IS NOT NULL LIMIT 1`,
      [leadMatch[1]],
    );
    if (result.rows[0]?.organization_id) return result.rows[0].organization_id;
  }

  const slideMatch = req.path.match(/\/pitch-deck\/slides\/([0-9a-f-]{36})(?:\/|$)/i);
  if (slideMatch && UUID_PATTERN.test(slideMatch[1])) {
    const result = await pool.query<{ organization_id: string }>(
      `SELECT deck.organization_id::text
         FROM pitch_slides slide
         JOIN pitch_decks deck ON deck.id = slide.deck_id
        WHERE slide.id = $1::uuid AND deck.organization_id IS NOT NULL
        LIMIT 1`,
      [slideMatch[1]],
    );
    if (result.rows[0]?.organization_id) return result.rows[0].organization_id;
  }

  const applicationId = typeof req.body?.applicationId === "string"
    ? req.body.applicationId.trim()
    : "";
  if (UUID_PATTERN.test(applicationId)) {
    const result = await pool.query<{ organization_id: string }>(
      `SELECT organization_id::text FROM partner_applications
        WHERE id = $1::uuid AND organization_id IS NOT NULL LIMIT 1`,
      [applicationId],
    );
    if (result.rows[0]?.organization_id) return result.rows[0].organization_id;
  }
  return null;
}

export function enforceOrgStatus(
  pool: Pool,
  activeSessions: Map<string, SessionData>,
  opts: OrgStatusOptions = {},
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Payment recovery must remain available while billing has placed an
      // organization in read-only. Provisioning is a separate audited support
      // surface and never grants a platform admin a Customer Portal session.
      if (
        req.path.endsWith("/billing/portal-session") ||
        req.path.endsWith("/billing/provision")
      ) return next();
      const requestedOrgId = (opts.resolveOrgId ?? defaultResolveOrgId)(req);
      const resourceOrgId = opts.resolveOrgId
        ? null
        : await resolveResourceOrganizationId(pool, req);
      if (requestedOrgId && resourceOrgId && requestedOrgId !== resourceOrgId) {
        return res.status(409).json({
          error: "leadgrid_organization_context_mismatch",
          message: "Valgt organisasjon samsvarer ikke med ressursen.",
        });
      }
      const orgId = resourceOrgId ?? requestedOrgId;
      if (!orgId) return next(); // ingen org-kontekst, la den passere

      // Plattformrollen alene er ikke en tenant- eller billing-rettighet.
      const bypassSuper = opts.bypassForSuperAdmin === true;
      if (bypassSuper) {
        const auth = req.headers.authorization;
        const token = auth?.startsWith("Bearer ") ? auth.substring(7)
                    : (req as any).cookies?.sessionToken;
        if (token) {
          const sess = activeSessions.get(token);
          if (sess) {
            const r = await pool.query<{ role: string }>(
              `SELECT role FROM users WHERE id = $1`, [sess.userId],
            );
            if (r.rows[0]?.role === "super_admin") return next();
          }
        }
      }

      const orgR = await pool.query<{
        status: string; pause_reason: string | null; pause_resume_at: string | null;
      }>(
        `SELECT status, pause_reason, pause_resume_at
         FROM organizations WHERE id = $1`,
        [orgId],
      );
      if (orgR.rows.length === 0) return next(); // ukjent org, la den ramme andre validators

      const status = orgR.rows[0].status;
      const isWrite = WRITE_METHODS.has(req.method);

      // Suspended/Closed → totalt blokkert
      if (status === "suspended" || status === "closed") {
        return res.status(403).json({
          error: "org_suspended",
          status,
          reason: orgR.rows[0].pause_reason,
          message: status === "suspended"
            ? "Organisasjonen er suspendert. Kontakt support."
            : "Organisasjonen er lukket.",
        });
      }

      // Paused/read_only → blokker mutasjoner, tillat GET
      if ((status === "paused" || status === "read_only") && isWrite) {
        return res.status(423).json({  // 423 Locked
          error: "org_paused",
          status,
          reason: orgR.rows[0].pause_reason,
          resume_at: orgR.rows[0].pause_resume_at,
          message: status === "paused"
            ? "Organisasjonen er på pause. Kun lese-tilgang."
            : "Organisasjonen er i read-only-modus.",
        });
      }

      // allowedStatuses kan overstyre default
      if (opts.allowedStatuses && !opts.allowedStatuses.includes(status)) {
        return res.status(423).json({
          error: "org_status_not_allowed",
          status, allowed: opts.allowedStatuses,
        });
      }

      return next();
    } catch (e) {
      console.error("[enforceOrgStatus]", e);
      return res.status(503).json({
        error: "org_status_unavailable",
        message: "Organisasjonsstatus kunne ikke verifiseres.",
      });
    }
  };
}
