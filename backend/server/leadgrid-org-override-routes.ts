/**
 * leadgrid-org-override-routes.ts
 *
 * Org-modus-velger for super_admins (mig 0365): Daniel kan se Leadgrid
 * i valgfri modus — solo ('self'), Creatorhub AS eller en hvilken som
 * helst org. Alle Leadgrid-org-oppslag (leadgrid-org-resolver.ts) leser
 * overriden først.
 *
 * Endepunkter (2):
 *   GET  /api/leadgrid/org-override
 *        → { current_mode, available_modes: [{id, label, is_current}] }
 *   POST /api/leadgrid/org-override   (super_admin only)
 *        body: { org_id: "self" | "<org-id>" | null }  (null = fjern)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser, invalidateOrgCache } from "./leadgrid-org-resolver.js";

type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export interface OrgOverrideRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export function registerLeadgridOrgOverrideRoutes(deps: OrgOverrideRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  app.get("/api/leadgrid/org-override", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const current = await resolveOrgIdForUser(pool, session.userId);
      const isAdmin = ADMIN_ROLES.has(String(session.role ?? "").toLowerCase());

      const modes: Array<{ id: string; label: string; is_current: boolean }> = [
        {
          id: "self",
          label: "Solo-modus (mine egne data)",
          is_current: current === session.userId,
        },
      ];
      if (isAdmin) {
        const orgs = await pool.query<{ id: string; name: string }>(
          `SELECT id::text, name FROM organizations ORDER BY name ASC`,
        );
        for (const org of orgs.rows) {
          modes.push({ id: org.id, label: org.name, is_current: current === org.id });
        }
      }
      return res.json({
        current_org_id: current,
        can_switch: isAdmin,
        modes,
      });
    } catch (err) {
      console.error("[org-override] GET failed:", err);
      return res.status(500).json({ error: "org_override_failed", detail: String("internal_error") });
    }
  });

  app.post("/api/leadgrid/org-override", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    if (!ADMIN_ROLES.has(String(session.role ?? "").toLowerCase())) {
      return res.status(403).json({ error: "forbidden_superadmin_only" });
    }
    const raw = (req.body ?? {}).org_id;
    try {
      if (raw === null || raw === undefined || raw === "") {
        await pool.query(
          `DELETE FROM leadgrid_org_overrides WHERE user_id = $1`,
          [session.userId],
        );
      } else {
        const value = String(raw);
        if (value !== "self") {
          const org = await pool.query(
            `SELECT 1 FROM organizations WHERE id::text = $1`,
            [value],
          );
          if (org.rowCount === 0) {
            return res.status(400).json({ error: "ukjent_org" });
          }
        }
        await pool.query(
          `INSERT INTO leadgrid_org_overrides (user_id, override_org_id, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             override_org_id = EXCLUDED.override_org_id, updated_at = NOW()`,
          [session.userId, value],
        );
      }
      invalidateOrgCache(session.userId);
      const current = await resolveOrgIdForUser(pool, session.userId);
      return res.json({ ok: true, current_org_id: current });
    } catch (err) {
      console.error("[org-override] POST failed:", err);
      return res.status(500).json({ error: "org_override_set_failed", detail: String("internal_error") });
    }
  });
}
