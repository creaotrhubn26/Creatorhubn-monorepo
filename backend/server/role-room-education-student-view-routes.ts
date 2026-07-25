/**
 * role-room-education-student-view-routes.ts — mountes under /api/role-room.
 *
 * Studentens «Min side» (les-only): produksjoner, oppgaver og tilbakemelding for
 * ÉN student. Foreløpig super-admin-preview (+ eier-faglærer) — ekte
 * studentsesjon kommer i egen skive; da resolves studentId fra sesjonen i
 * stedet for query-param.
 *
 * Endepunkt:
 *   GET /api/role-room/education/student/view?studentId=<id>
 *
 * Tilgang: eier av studenten (owner_user_id === session.userId) ELLER super
 * admin (role='super_admin' eller e-post daniel@creatorhubn.com).
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

const SUPER_ADMIN_EMAIL = "daniel@creatorhubn.com";

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

function isSuperAdmin(s: SessionData | null): boolean {
  if (!s) return false;
  return String(s.role).toLowerCase() === "super_admin"
    || String(s.email).toLowerCase() === SUPER_ADMIN_EMAIL;
}

function isoOrNull(v: unknown): string | null {
  return v ? new Date(v as string).toISOString() : null;
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

export interface CreateEducationStudentViewRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationStudentViewRouter(
  pool: Pool,
  deps: CreateEducationStudentViewRouterDeps = {},
): ExpressRouter {
  const router = Router();

  const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    const session = await resolveUser(pool, deps.activeSessions, bearer);
    if (!session?.userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    (req as Request & { session: SessionData }).session = session;
    next();
  };
  const sess = (req: Request) => (req as Request & { session: SessionData }).session;

  router.get("/education/student/view", requireAuth, async (req, res) => {
    const studentId = typeof req.query.studentId === "string" ? req.query.studentId : "";
    if (!studentId) { res.status(400).json({ error: "student_id_required" }); return; }
    const session = sess(req);
    try {
      const sr = await pool.query(
        `SELECT s.id, s.name, s.owner_user_id, s.cohort_id, c.name AS cohort_name
           FROM role_room_education_students s
           LEFT JOIN role_room_education_cohorts c ON c.id = s.cohort_id
          WHERE s.id = $1`,
        [studentId],
      );
      const student = sr.rows[0];
      if (!student) { res.status(404).json({ error: "not_found" }); return; }
      // Tilgang: eier ELLER super admin.
      if (String(student.owner_user_id) !== session.userId && !isSuperAdmin(session)) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const cohortId = student.cohort_id ? String(student.cohort_id) : null;

      // Produksjoner i studentens kull.
      const prodRes = cohortId
        ? await pool.query(
            `SELECT p.id, p.title, p.project_id, cp.status AS project_status
               FROM role_room_education_productions p
               LEFT JOIN casting_projects cp ON cp.id = p.project_id
              WHERE p.cohort_id = $1
              ORDER BY p.created_at DESC`,
            [cohortId],
          )
        : { rows: [] as Record<string, unknown>[] };

      // Oppgaver i kullet + denne studentens innlevering.
      const asgRes = cohortId
        ? await pool.query(
            `SELECT a.id, a.title, a.brief, a.learning_goals, a.due_at, a.status,
                    prod.title AS production_title, prod.project_id AS production_project_id,
                    sub.status AS sub_status, sub.grade AS grade, sub.feedback AS feedback,
                    sub.submitted_at AS submitted_at, sub.reviewed_at AS reviewed_at
               FROM role_room_education_assignments a
               LEFT JOIN role_room_education_productions prod ON prod.id = a.production_id
               LEFT JOIN role_room_education_submissions sub
                      ON sub.assignment_id = a.id AND sub.student_id = $2
              WHERE a.cohort_id = $1 AND a.status = 'published'
              ORDER BY a.due_at ASC NULLS LAST, a.created_at DESC`,
            [cohortId, studentId],
          )
        : { rows: [] as Record<string, unknown>[] };

      res.json({
        student: {
          id: String(student.id),
          name: (student.name as string) ?? "",
          cohortId,
          cohortName: (student.cohort_name as string) ?? null,
        },
        productions: prodRes.rows.map((p) => ({
          id: String(p.id),
          title: (p.title as string) ?? "",
          projectId: String(p.project_id),
          projectStatus: (p.project_status as string) ?? null,
        })),
        assignments: asgRes.rows.map((a) => ({
          id: String(a.id),
          title: (a.title as string) ?? "",
          brief: (a.brief as string) ?? null,
          learningGoals: (a.learning_goals as string) ?? null,
          dueAt: isoOrNull(a.due_at),
          productionTitle: (a.production_title as string) ?? null,
          productionProjectId: (a.production_project_id as string) ?? null,
          submissionStatus: (a.sub_status as string) ?? "not_started",
          grade: (a.grade as string) ?? null,
          feedback: (a.feedback as string) ?? null,
          submittedAt: isoOrNull(a.submitted_at),
          reviewedAt: isoOrNull(a.reviewed_at),
        })),
      });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ student: null, productions: [], assignments: [] }); return; }
      console.error("[education-student-view] failed:", (err as Error).message);
      res.status(500).json({ error: "view_failed" });
    }
  });

  return router;
}
