/**
 * Project-medlemmer: leder fjerner / reaktiverer brukere på prosjektet.
 *
 * Modell: soft-delete via deactivated_at + deactivation_reason på
 * casting_user_roles. Deaktiverte brukere teller ikke som seat (frigir
 * billing) og er skjult fra aktiv-lista, men data er bevart.
 *
 * Permanent sletting (cascade-delete av all bruker-bidratt data) er
 * IKKE implementert her — det krever målrettet design pr. tabell. UI
 * tilbyr knappen som "kommer snart" så vi ikke ved et uhell sletter
 * data uten god rollback.
 *
 * Autorisering: kun produksjonsteam-leder (casting_projects.created_by).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { syncRoleRoomSeatQuantity, countActiveSeats } from "./role-room-seat-stripe-sync.js";
import { getSubscriptionHealth } from "./role-room-subscription-health.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

let columnsEnsured = false;

async function ensureColumns(pool: Pool): Promise<boolean> {
  if (columnsEnsured) return true;
  try {
    await pool.query(`
      ALTER TABLE casting_user_roles
        ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS deactivated_by_user_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
      CREATE INDEX IF NOT EXISTS idx_cur_project_active
        ON casting_user_roles(project_id, deactivated_at);
    `);
    columnsEnsured = true;
    return true;
  } catch (err) {
    console.error("[rr-project-members] ensure columns failed:", err);
    return false;
  }
}

function getUserIdFromRequest(
  req: Request,
  activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
  }
  return null;
}

async function isProjectLeader(
  pool: Pool, viewerId: string, projectId: string,
): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM casting_projects WHERE id = $1 AND created_by = $2 LIMIT 1`,
      [projectId, viewerId],
    );
    return rows.length > 0;
  } catch (err) {
    console.error("[rr-project-members] isProjectLeader failed:", err);
    return false;
  }
}

async function getProjectOwner(
  pool: Pool, projectId: string,
): Promise<string | null> {
  try {
    const { rows } = await pool.query(
      `SELECT created_by FROM casting_projects WHERE id = $1 LIMIT 1`,
      [projectId],
    );
    return rows[0]?.created_by ?? null;
  } catch {
    return null;
  }
}

export function registerRoleRoomProjectMembersRoutes(app: Express, deps: Deps): void {
  const { pool, activeSessions } = deps;
  void ensureColumns(pool);

  // ── GET: liste over medlemmer (aktive + deaktiverte) ──────────
  app.get(
    "/api/role-room/projects/:projectId/members",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = String(req.params.projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "projectId_mangler" }); return;
      }
      if (!(await isProjectLeader(pool, viewerId, projectId))) {
        res.status(403).json({ error: "kun_team_leder" }); return;
      }
      if (!(await ensureColumns(pool))) {
        res.status(503).json({ error: "kolonner_ikke_klare" }); return;
      }

      const status = String(req.query.status ?? "all").toLowerCase();

      try {
        let condition = "TRUE";
        if (status === "active") condition = "cur.deactivated_at IS NULL";
        else if (status === "removed") condition = "cur.deactivated_at IS NOT NULL";

        const { rows } = await pool.query(
          `SELECT cur.user_id, cur.role, cur.email, cur.added_by,
                  cur.deactivated_at, cur.deactivated_by_user_id, cur.deactivation_reason,
                  cur.created_at,
                  p.display_name, p.profile_image_url, p.bio, p.professions
             FROM casting_user_roles cur
             LEFT JOIN role_room_member_profiles p ON p.user_id = cur.user_id
            WHERE cur.project_id = $1
              AND ${condition}
            ORDER BY cur.deactivated_at NULLS FIRST, cur.created_at DESC`,
          [projectId],
        );

        const members = rows.map((row: { user_id: string; role: string | null; email: string | null; added_by: string | null; deactivated_at: Date | null; deactivated_by_user_id: string | null; deactivation_reason: string | null; created_at: Date; display_name: string | null; profile_image_url: string | null; bio: string | null; professions: string[] | null }) => ({
          userId: row.user_id,
          role: row.role,
          email: row.email,
          addedBy: row.added_by,
          isActive: row.deactivated_at == null,
          deactivatedAt: row.deactivated_at,
          deactivatedByUserId: row.deactivated_by_user_id,
          deactivationReason: row.deactivation_reason,
          createdAt: row.created_at,
          displayName: row.display_name,
          profileImageUrl: row.profile_image_url,
          bio: row.bio,
          professions: row.professions ?? [],
        }));

        res.json({ projectId, members });
      } catch (err) {
        console.error("[rr-project-members] GET failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    },
  );

  // ── DELETE: soft-delete (deaktiver — beholder data, frigir seat) ─
  app.delete(
    "/api/role-room/projects/:projectId/members/:userId",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = String(req.params.projectId ?? "").trim();
      const targetUserId = String(req.params.userId ?? "").trim();
      if (!projectId || !targetUserId) {
        res.status(400).json({ error: "id_mangler" }); return;
      }
      if (targetUserId === viewerId) {
        res.status(400).json({ error: "kan_ikke_fjerne_seg_selv" }); return;
      }
      if (!(await isProjectLeader(pool, viewerId, projectId))) {
        res.status(403).json({ error: "kun_team_leder" }); return;
      }
      if (!(await ensureColumns(pool))) {
        res.status(503).json({ error: "kolonner_ikke_klare" }); return;
      }

      const reason = String(req.body?.reason ?? "").trim().slice(0, 500);
      const permanent = String(req.query.permanent ?? "").toLowerCase() === "true";

      if (permanent) {
        // For sikkerhet: vi støtter ikke cascade-delete av all bruker-data
        // automatisk ennå. Returnerer 501 så frontend kan vise "kommer".
        res.status(501).json({
          error: "permanent_sletting_ikke_implementert",
          detail: "Cascade-sletting av all bruker-data krever målrettet design pr. tabell og er ikke aktivert ennå.",
        });
        return;
      }

      try {
        const result = await pool.query(
          `UPDATE casting_user_roles
              SET deactivated_at = NOW(),
                  deactivated_by_user_id = $1,
                  deactivation_reason = NULLIF($2, '')
            WHERE project_id = $3 AND user_id = $4
              AND deactivated_at IS NULL`,
          [viewerId, reason, projectId, targetUserId],
        );
        if (result.rowCount === 0) {
          res.status(404).json({ error: "ikke_funnet_eller_allerede_fjernet" }); return;
        }

        // Auto-sync Stripe quantity ned — frigir billing for denne seaten.
        // Hvis sync feiler, beholder vi soft-delete (cleanup kommer via cron
        // eller manuell admin), men returnerer warning så frontend kan vise det.
        const ownerUserId = await getProjectOwner(pool, projectId);
        let stripeWarning: string | null = null;
        if (ownerUserId) {
          const used = await countActiveSeats(pool, ownerUserId, projectId);
          const sync = await syncRoleRoomSeatQuantity({
            pool, ownerUserId, projectId,
            targetActiveUsers: used,
            actorUserId: viewerId,
          });
          if (!sync.ok) stripeWarning = sync.reason ?? "stripe_sync_failed";
        }

        res.json({ ok: true, deactivated: true, stripeWarning });
      } catch (err) {
        console.error("[rr-project-members] DELETE failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    },
  );

  // ── POST: reaktiver (auto-bump Stripe så billing starter på nytt) ──
  app.post(
    "/api/role-room/projects/:projectId/members/:userId/reactivate",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = String(req.params.projectId ?? "").trim();
      const targetUserId = String(req.params.userId ?? "").trim();
      if (!projectId || !targetUserId) {
        res.status(400).json({ error: "id_mangler" }); return;
      }
      if (!(await isProjectLeader(pool, viewerId, projectId))) {
        res.status(403).json({ error: "kun_team_leder" }); return;
      }
      if (!(await ensureColumns(pool))) {
        res.status(503).json({ error: "kolonner_ikke_klare" }); return;
      }

      // Pre-flight: blokker reaktivering hvis abonnementet ikke er sunt
      // (reaktivering = ekstra seat = ekstra fakturering)
      const health = await getSubscriptionHealth(pool, viewerId);
      if (!health.canMutateSeats) {
        res.status(402).json({
          error: "subscription_not_healthy",
          detail: health.message,
          status: health.status,
        });
        return;
      }

      try {
        const result = await pool.query(
          `UPDATE casting_user_roles
              SET deactivated_at = NULL,
                  deactivated_by_user_id = NULL,
                  deactivation_reason = NULL
            WHERE project_id = $1 AND user_id = $2
              AND deactivated_at IS NOT NULL`,
          [projectId, targetUserId],
        );
        if (result.rowCount === 0) {
          res.status(404).json({ error: "ikke_funnet_eller_aktiv" }); return;
        }

        // Auto-bump Stripe quantity — billing starter på nytt for denne seaten
        const ownerUserId = await getProjectOwner(pool, projectId);
        let stripeWarning: string | null = null;
        if (ownerUserId) {
          const used = await countActiveSeats(pool, ownerUserId, projectId);
          const sync = await syncRoleRoomSeatQuantity({
            pool, ownerUserId, projectId,
            targetActiveUsers: used,
            actorUserId: viewerId,
          });
          if (!sync.ok) stripeWarning = sync.reason ?? "stripe_sync_failed";
        }

        res.json({ ok: true, reactivated: true, stripeWarning });
      } catch (err) {
        console.error("[rr-project-members] reactivate failed:", err);
        res.status(500).json({ error: "intern_feil" });
      }
    },
  );
}
