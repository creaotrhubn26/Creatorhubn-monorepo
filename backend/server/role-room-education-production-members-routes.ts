/**
 * role-room-education-production-members-routes.ts — mountes under /api/role-room.
 *
 * SKOLE-STYRT RBAC: faglærer bestemmer hvilke studenter som er i hver
 * studentproduksjon, og med hvilken rolle (viewer/contributor/lead). Owner-
 * scopet. Dette laget gjør senere prosjekt-tilgang presis — skolen tildeler,
 * ikke en blank «alle medlemmer»-regel.
 *
 * Endepunkter:
 *   GET    /api/role-room/education/productions/:id/members
 *   PUT    /api/role-room/education/productions/:id/members     ({studentId, role})
 *   DELETE /api/role-room/education/productions/:id/members/:studentId
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
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

const MEMBER_ROLES = new Set(["viewer", "contributor", "lead"]);

export interface ProductionMemberView {
  studentId: string;
  studentName: string;
  role: string;
  assigned: boolean;
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

export interface CreateEducationProductionMembersRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationProductionMembersRouter(
  pool: Pool,
  deps: CreateEducationProductionMembersRouterDeps = {},
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

  // Eid produksjon → dens cohort_id, ellers null.
  const ownedProductionCohort = async (id: string, owner: string): Promise<string | null | undefined> => {
    const r = await pool.query(
      `SELECT cohort_id FROM role_room_education_productions WHERE id = $1 AND owner_user_id = $2`,
      [id, owner],
    );
    if (r.rows.length === 0) return undefined; // ikke eid / finnes ikke
    return r.rows[0].cohort_id ? String(r.rows[0].cohort_id) : null;
  };

  // Hele kullets studenter + hvem som er tildelt produksjonen (+ rolle).
  router.get("/education/productions/:id/members", requireAuth, async (req, res) => {
    try {
      const cohortId = await ownedProductionCohort(req.params.id, uid(req));
      if (cohortId === undefined) { res.status(404).json({ error: "not_found" }); return; }
      if (!cohortId) { res.json({ members: [] }); return; }
      const r = await pool.query(
        `SELECT st.id AS student_id, st.name AS student_name,
                m.role AS role, (m.id IS NOT NULL) AS assigned
           FROM role_room_education_students st
           LEFT JOIN role_room_education_production_members m
                  ON m.student_id = st.id AND m.production_id = $1
          WHERE st.cohort_id = $2 AND st.status = 'active'
          ORDER BY st.created_at ASC`,
        [req.params.id, cohortId],
      );
      const members: ProductionMemberView[] = r.rows.map((row) => ({
        studentId: String(row.student_id),
        studentName: (row.student_name as string) ?? "",
        role: (row.role as string) ?? "contributor",
        assigned: Boolean(row.assigned),
      }));
      res.json({ members });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ members: [] }); return; }
      console.warn("[education-production-members] list failed:", (err as Error).message);
      res.json({ members: [] });
    }
  });

  router.put("/education/productions/:id/members", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { studentId?: string; role?: string };
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const role = body.role && MEMBER_ROLES.has(body.role) ? body.role : "contributor";
    if (!studentId) { res.status(400).json({ error: "student_id_required" }); return; }
    try {
      const cohortId = await ownedProductionCohort(req.params.id, uid(req));
      if (cohortId === undefined) { res.status(404).json({ error: "not_found" }); return; }
      // Studenten må eies av samme faglærer (samme institusjon).
      const owns = await pool.query(
        `SELECT 1 FROM role_room_education_students WHERE id = $1 AND owner_user_id = $2`,
        [studentId, uid(req)],
      );
      if (owns.rows.length === 0) { res.status(404).json({ error: "student_not_found" }); return; }
      const id = newEntityId("edpm");
      const r = await pool.query(
        `INSERT INTO role_room_education_production_members (id, production_id, student_id, owner_user_id, role)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (production_id, student_id)
         DO UPDATE SET role = EXCLUDED.role, updated_at = now()
         RETURNING student_id, role`,
        [id, req.params.id, studentId, uid(req), role],
      );
      res.status(201).json({ member: { studentId, role: (r.rows[0]?.role as string) ?? role, assigned: true } });
    } catch (err) {
      console.error("[education-production-members] assign failed:", (err as Error).message);
      res.status(500).json({ error: "assign_failed" });
    }
  });

  router.delete("/education/productions/:id/members/:studentId", requireAuth, async (req, res) => {
    try {
      const cohortId = await ownedProductionCohort(req.params.id, uid(req));
      if (cohortId === undefined) { res.status(404).json({ error: "not_found" }); return; }
      const r = await pool.query(
        `DELETE FROM role_room_education_production_members
          WHERE production_id = $1 AND student_id = $2 AND owner_user_id = $3
          RETURNING id`,
        [req.params.id, req.params.studentId, uid(req)],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-production-members] remove failed:", (err as Error).message);
      res.status(500).json({ error: "remove_failed" });
    }
  });

  return router;
}
