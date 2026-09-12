/**
 * role-room-education-groups-routes.ts — mountes under /api/role-room.
 *
 * Grupper i et kull (utdannings-workspace). En gruppe tilhører ett kull; en
 * student kan være i én gruppe. Alt owner-scopet (owner_user_id = innlogget
 * bruker) — speiler mønsteret fra role-room-education-cohorts-routes.
 *
 * Endepunkter:
 *   GET    /api/role-room/education/cohorts/:cohortId/groups
 *   POST   /api/role-room/education/cohorts/:cohortId/groups
 *   PATCH  /api/role-room/education/groups/:id
 *   DELETE /api/role-room/education/groups/:id
 *   PUT    /api/role-room/education/students/:id/group   { groupId: string | null }
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from "express";
import type { Pool } from "pg";
import { loadPersistedAuthSession } from "./auth-session-store.js";
import { newEntityId } from "./_shared-ids.js";

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

export interface GroupView {
  id: string;
  cohortId: string;
  name: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

function groupRowToView(r: Record<string, unknown>): GroupView {
  return {
    id: String(r.id),
    cohortId: String(r.cohort_id),
    name: (r.name as string) ?? "",
    memberCount: Number(r.member_count ?? 0),
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : "",
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : "",
  };
}

async function resolveUser(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  bearer: string | null | undefined,
): Promise<SessionData | null> {
  const token = typeof bearer === "string" ? bearer.trim() : "";
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) {
    activeSessions?.set(token, persisted);
    return persisted;
  }
  return null;
}

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "42P01";
}

export interface CreateEducationGroupsRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationGroupsRouter(
  pool: Pool,
  deps: CreateEducationGroupsRouterDeps = {},
): ExpressRouter {
  const router = Router();

  const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    const session = await resolveUser(pool, deps.activeSessions, bearer);
    if (!session?.userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    (req as Request & { userId: string }).userId = session.userId;
    next();
  };
  const uid = (req: Request) => (req as Request & { userId: string }).userId;

  const ownsCohort = async (cohortId: string, userId: string): Promise<boolean> => {
    const r = await pool.query(
      `SELECT 1 FROM role_room_education_cohorts WHERE id = $1 AND owner_user_id = $2`,
      [cohortId, userId],
    );
    return r.rows.length > 0;
  };

  // ── Grupper ────────────────────────────────────────────────────────────────
  router.get("/education/cohorts/:cohortId/groups", requireAuth, async (req, res) => {
    try {
      if (!(await ownsCohort(req.params.cohortId, uid(req)))) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const r = await pool.query(
        `SELECT g.*, COUNT(s.id)::int AS member_count
           FROM role_room_education_groups g
           LEFT JOIN role_room_education_students s ON s.group_id = g.id AND s.status = 'active'
          WHERE g.cohort_id = $1
          GROUP BY g.id
          ORDER BY g.created_at ASC`,
        [req.params.cohortId],
      );
      res.json({ groups: r.rows.map(groupRowToView) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ groups: [] }); return; }
      console.warn("[education-groups] list failed:", (err as Error).message);
      res.json({ groups: [] });
    }
  });

  router.post("/education/cohorts/:cohortId/groups", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { name?: string };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) { res.status(400).json({ error: "name_required" }); return; }
    try {
      if (!(await ownsCohort(req.params.cohortId, uid(req)))) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const id = newEntityId("edugroup");
      const r = await pool.query(
        `INSERT INTO role_room_education_groups (id, cohort_id, owner_user_id, name)
         VALUES ($1,$2,$3,$4) RETURNING *, 0 AS member_count`,
        [id, req.params.cohortId, uid(req), name],
      );
      res.status(201).json({ group: groupRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-groups] create failed:", (err as Error).message);
      res.status(500).json({ error: "create_failed" });
    }
  });

  router.patch("/education/groups/:id", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { name?: string };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) { res.status(400).json({ error: "name_required" }); return; }
    try {
      const r = await pool.query(
        `UPDATE role_room_education_groups
            SET name = $3, updated_at = now()
          WHERE id = $1 AND owner_user_id = $2
          RETURNING *, (SELECT COUNT(*)::int FROM role_room_education_students s
                          WHERE s.group_id = role_room_education_groups.id AND s.status='active') AS member_count`,
        [req.params.id, uid(req), name],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ group: groupRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-groups] update failed:", (err as Error).message);
      res.status(500).json({ error: "update_failed" });
    }
  });

  router.delete("/education/groups/:id", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `DELETE FROM role_room_education_groups WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
        [req.params.id, uid(req)],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-groups] delete failed:", (err as Error).message);
      res.status(500).json({ error: "delete_failed" });
    }
  });

  // Tildel/fjern student → gruppe. groupId=null fjerner fra gruppe.
  router.put("/education/students/:id/group", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { groupId?: string | null };
    const groupId = typeof body.groupId === "string" && body.groupId.trim() ? body.groupId.trim() : null;
    try {
      // Studenten må eies av brukeren.
      const stu = await pool.query(
        `SELECT cohort_id FROM role_room_education_students WHERE id = $1 AND owner_user_id = $2`,
        [req.params.id, uid(req)],
      );
      if (stu.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      // Gruppen (hvis satt) må eies og tilhøre samme kull.
      if (groupId) {
        const grp = await pool.query(
          `SELECT 1 FROM role_room_education_groups
            WHERE id = $1 AND owner_user_id = $2 AND cohort_id = $3`,
          [groupId, uid(req), String(stu.rows[0].cohort_id)],
        );
        if (grp.rows.length === 0) { res.status(400).json({ error: "invalid_group" }); return; }
      }
      await pool.query(
        `UPDATE role_room_education_students SET group_id = $3 WHERE id = $1 AND owner_user_id = $2`,
        [req.params.id, uid(req), groupId],
      );
      res.json({ success: true, groupId });
    } catch (err) {
      console.error("[education-groups] assign failed:", (err as Error).message);
      res.status(500).json({ error: "assign_failed" });
    }
  });

  return router;
}
