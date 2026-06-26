/**
 * prototype-team-admin-routes.ts
 *
 * Admin-oversikt over prototype-tester-TEAM. Lar admin se hvert team (master +
 * medlemmer + status + ledige plasser) etter godkjenning — masteren ser dette
 * via «mitt team», men admin hadde ingen innsyn. Read-only, admin-only.
 */

import type express from "express";
import type { Pool } from "pg";

interface Deps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId?: string; role?: string } | null | undefined;
  adminRoles: Set<string>;
}

export function setupPrototypeTeamAdminRoutes({ app, pool, getActiveSessionFromRequest, adminRoles }: Deps): void {
  const isAdmin = (req: express.Request): boolean => {
    const s = getActiveSessionFromRequest(req);
    return !!s && adminRoles.has(String((s as any)?.role || "").trim().toLowerCase());
  };

  // GET /api/superadmin/prototype-tester-teams — team-oversikt for admin
  app.get("/api/superadmin/prototype-tester-teams", async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "Admin-tilgang kreves" });
    try {
      const masters = (
        await pool.query(
          `SELECT id, email, name, status, max_team_size, program_ends_at, created_at, accepted_at
             FROM prototype_tester_invites
            WHERE team_role = 'master'
            ORDER BY created_at DESC`,
        )
      ).rows;
      if (masters.length === 0) return res.json({ teams: [] });

      const masterIds = masters.map((m: any) => String(m.id));
      const members = (
        await pool.query(
          `SELECT master_invite_id, id, email, name, status, accepted_at, created_at
             FROM prototype_tester_invites
            WHERE master_invite_id = ANY($1::uuid[])
            ORDER BY created_at ASC`,
          [masterIds],
        )
      ).rows;

      const byMaster = new Map<string, any[]>();
      for (const mem of members) {
        const k = String(mem.master_invite_id);
        if (!byMaster.has(k)) byMaster.set(k, []);
        byMaster.get(k)!.push({
          id: String(mem.id),
          email: mem.email,
          name: mem.name,
          status: mem.status,
          acceptedAt: mem.accepted_at,
          invitedAt: mem.created_at,
        });
      }

      const teams = masters.map((m: any) => {
        const mem = byMaster.get(String(m.id)) || [];
        const usedSlots = mem.length + 1; // +1 = master selv
        const maxSize = Number(m.max_team_size || 1);
        return {
          masterId: String(m.id),
          masterEmail: m.email,
          masterName: m.name,
          masterStatus: m.status,
          maxTeamSize: maxSize,
          usedSlots,
          slotsRemaining: Math.max(0, maxSize - usedSlots),
          programEndsAt: m.program_ends_at,
          members: mem,
        };
      });
      res.json({ teams });
    } catch (err) {
      // Tabell finnes ikke ennå / annet → tom liste (aldri-blokkerende).
      console.error("[prototype-tester-teams]", err);
      res.json({ teams: [] });
    }
  });
}
