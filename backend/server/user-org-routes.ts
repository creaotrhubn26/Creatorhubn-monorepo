/**
 * user-org-routes.ts
 *
 * Endepunkter brukt av OrgSwitcher (frontend):
 *   GET  /api/users/me/organizations — alle mine medlemskaper
 *   POST /api/users/me/active-org    — sett aktiv org (lagres i users.meta)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const token = (req as any).cookies?.sessionToken;
  return token ? sessions.get(token) ?? null : null;
}

export function registerUserOrgRoutes({ app, pool, activeSessions }: Deps): void {

  // ---------- List medlemskap ----------
  app.get("/api/users/me/organizations", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    try {
      const r = await pool.query(
        `SELECT o.id, o.name, o.org_type, o.plan, o.logo_url,
                om.role, om.organization_id IS NOT NULL AS is_active_member
           FROM organization_members om
           JOIN organizations o ON o.id = om.organization_id
          WHERE om.user_id = $1
          ORDER BY o.name ASC`,
        [s.userId],
      );
      res.json({ organizations: r.rows });
    } catch (e: any) {
      console.error("[users/me/orgs]", e);
      res.status(500).json({ error: "Kunne ikke hente orgs" });
    }
  });

  // ---------- Sett aktiv org ----------
  app.post("/api/users/me/active-org", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const { orgId } = req.body ?? {};
    if (!orgId) return res.status(400).json({ error: "orgId påkrevd" });

    // Verifiser at brukeren er medlem (eller super_admin)
    const memberR = await pool.query(
      `SELECT 1 FROM organization_members
        WHERE user_id = $1 AND organization_id = $2
       UNION SELECT 1 FROM users WHERE id = $1 AND role = 'super_admin'`,
      [s.userId, orgId],
    );
    if (memberR.rows.length === 0) {
      return res.status(403).json({ error: "Ikke medlem av org'en" });
    }

    await pool.query(
      `UPDATE users
          SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('active_org_id', $1::text)
        WHERE id = $2`,
      [orgId, s.userId],
    );
    res.json({ ok: true, active_org_id: orgId });
  });
}
