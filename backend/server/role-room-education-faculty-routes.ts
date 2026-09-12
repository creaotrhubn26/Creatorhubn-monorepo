/**
 * role-room-education-faculty-routes.ts — mountes under /api/role-room.
 *
 * FAKULTET & ROLLER: institusjonens ansatte (lærere/veiledere) med rolle + hvem
 * som veileder hvilket kull. Owner-scopet. (Egen staff-innlogging = senere.)
 *
 * Endepunkter:
 *   GET    /education/faculty
 *   POST   /education/faculty                 ({name, email?, role?})
 *   PATCH  /education/faculty/:id             ({name?, email?, role?})
 *   DELETE /education/faculty/:id
 *   PUT    /education/faculty/:id/cohorts     ({cohortIds: string[]})  (erstatt tildelinger)
 *
 * Auth: Bearer → resolveUser (samme mønster som education-cohorts-routes).
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
  userId: string; email: string; name: string; role: string; loginAt: string;
  [key: string]: unknown;
}

const FACULTY_ROLES = new Set(["lead", "teacher", "supervisor", "guest"]);

export interface FacultyView {
  id: string;
  name: string;
  email: string | null;
  role: string;
  cohortIds: string[];
}

async function resolveUser(
  pool: Pool, activeSessions: Map<string, SessionData> | undefined, bearer: string | null | undefined,
): Promise<SessionData | null> {
  const token = typeof bearer === "string" ? bearer.trim() : "";
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) { activeSessions?.set(token, persisted); return persisted; }
  return null;
}

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "42P01";
}

export interface CreateEducationFacultyRouterDeps { activeSessions?: Map<string, SessionData>; }

export function createEducationFacultyRouter(pool: Pool, deps: CreateEducationFacultyRouterDeps = {}): ExpressRouter {
  const router = Router();

  const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    const session = await resolveUser(pool, deps.activeSessions, bearer);
    if (!session?.userId) { res.status(401).json({ error: "unauthorized" }); return; }
    (req as Request & { userId: string }).userId = session.userId;
    next();
  };
  const uid = (req: Request) => (req as Request & { userId: string }).userId;

  const ownsFaculty = async (id: string, owner: string): Promise<boolean> => {
    const r = await pool.query(`SELECT 1 FROM role_room_education_faculty WHERE id = $1 AND owner_user_id = $2`, [id, owner]);
    return r.rows.length > 0;
  };

  router.get("/education/faculty", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT f.id, f.name, f.email, f.role,
                COALESCE(ARRAY_AGG(fc.cohort_id) FILTER (WHERE fc.cohort_id IS NOT NULL), '{}') AS cohort_ids
           FROM role_room_education_faculty f
           LEFT JOIN role_room_education_faculty_cohorts fc ON fc.faculty_id = f.id
          WHERE f.owner_user_id = $1
          GROUP BY f.id
          ORDER BY f.created_at ASC`,
        [uid(req)],
      );
      const faculty: FacultyView[] = r.rows.map((row) => ({
        id: String(row.id),
        name: (row.name as string) ?? "",
        email: (row.email as string) ?? null,
        role: (row.role as string) ?? "teacher",
        cohortIds: ((row.cohort_ids as string[]) ?? []).map(String),
      }));
      res.json({ faculty });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ faculty: [] }); return; }
      console.warn("[education-faculty] list failed:", (err as Error).message);
      res.json({ faculty: [] });
    }
  });

  router.post("/education/faculty", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { name?: string; email?: string; role?: string };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) { res.status(400).json({ error: "name_required" }); return; }
    const role = body.role && FACULTY_ROLES.has(body.role) ? body.role : "teacher";
    try {
      const id = newEntityId("edfac");
      const r = await pool.query(
        `INSERT INTO role_room_education_faculty (id, owner_user_id, name, email, role)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [id, uid(req), name, body.email?.trim() || null, role],
      );
      const row = r.rows[0];
      res.status(201).json({ faculty: { id: String(row.id), name: row.name, email: row.email ?? null, role: row.role, cohortIds: [] } });
    } catch (err) {
      console.error("[education-faculty] create failed:", (err as Error).message);
      res.status(500).json({ error: "create_failed" });
    }
  });

  router.patch("/education/faculty/:id", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { name?: string; email?: string; role?: string };
    const role = typeof body.role === "string" && FACULTY_ROLES.has(body.role) ? body.role : null;
    try {
      const r = await pool.query(
        `UPDATE role_room_education_faculty
            SET name = COALESCE($3, name), email = COALESCE($4, email), role = COALESCE($5, role), updated_at = now()
          WHERE id = $1 AND owner_user_id = $2 RETURNING *`,
        [req.params.id, uid(req), typeof body.name === "string" ? body.name.trim() : null, typeof body.email === "string" ? body.email.trim() : null, role],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      const row = r.rows[0];
      res.json({ faculty: { id: String(row.id), name: row.name, email: row.email ?? null, role: row.role } });
    } catch (err) {
      console.error("[education-faculty] update failed:", (err as Error).message);
      res.status(500).json({ error: "update_failed" });
    }
  });

  router.delete("/education/faculty/:id", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(`DELETE FROM role_room_education_faculty WHERE id = $1 AND owner_user_id = $2 RETURNING id`, [req.params.id, uid(req)]);
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-faculty] delete failed:", (err as Error).message);
      res.status(500).json({ error: "delete_failed" });
    }
  });

  // Erstatt kull-tildelinger for et fakultetsmedlem.
  router.put("/education/faculty/:id/cohorts", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { cohortIds?: string[] };
    const cohortIds = Array.isArray(body.cohortIds) ? body.cohortIds.filter((c) => typeof c === "string") : [];
    try {
      if (!(await ownsFaculty(req.params.id, uid(req)))) { res.status(404).json({ error: "not_found" }); return; }
      await pool.query(`DELETE FROM role_room_education_faculty_cohorts WHERE faculty_id = $1 AND owner_user_id = $2`, [req.params.id, uid(req)]);
      for (const cohortId of cohortIds) {
        // Kun kull som faktisk eies av brukeren.
        const owns = await pool.query(`SELECT 1 FROM role_room_education_cohorts WHERE id = $1 AND owner_user_id = $2`, [cohortId, uid(req)]);
        if (owns.rows.length === 0) continue;
        await pool.query(
          `INSERT INTO role_room_education_faculty_cohorts (id, faculty_id, cohort_id, owner_user_id)
           VALUES ($1,$2,$3,$4) ON CONFLICT (faculty_id, cohort_id) DO NOTHING`,
          [newEntityId("edfc"), req.params.id, cohortId, uid(req)],
        );
      }
      res.json({ success: true, cohortIds });
    } catch (err) {
      console.error("[education-faculty] cohorts failed:", (err as Error).message);
      res.status(500).json({ error: "cohorts_failed" });
    }
  });

  return router;
}
