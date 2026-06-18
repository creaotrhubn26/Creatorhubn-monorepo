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
  /** Tillat super_admin å bypasse (default: TRUE — superadmin må kunne fikse paused orgs) */
  bypassForSuperAdmin?: boolean;
}

type SessionData = { userId: string; role?: string; email?: string };

function defaultResolveOrgId(req: Request): string | null {
  return (req.body?.organization_id
       ?? req.params?.orgId
       ?? req.params?.id
       ?? req.query?.orgId
       ?? req.query?.organization_id
       ?? null) as string | null;
}

export function enforceOrgStatus(
  pool: Pool,
  activeSessions: Map<string, SessionData>,
  opts: OrgStatusOptions = {},
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = (opts.resolveOrgId ?? defaultResolveOrgId)(req);
      if (!orgId) return next(); // ingen org-kontekst, la den passere

      // Sjekk super-admin-bypass først (default på)
      const bypassSuper = opts.bypassForSuperAdmin !== false;
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
      return next(); // fail-open så vi ikke blokkerer alt ved feil
    }
  };
}
