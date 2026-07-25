/**
 * role-room-education-assignments-routes.ts — mountes under /api/role-room.
 *
 * Utdannings-workspace, opplæringslag 2: OPPGAVELØPET. Faglærer lager oppgaver
 * (brief + læringsmål + frist) knyttet til et kull, og følger per-student
 * innleverings-status (not_started → submitted → reviewed). Alt owner-scopet.
 *
 * Endepunkter:
 *   GET    /api/role-room/education/assignments            (?cohortId= filter)
 *   POST   /api/role-room/education/assignments
 *   PATCH  /api/role-room/education/assignments/:id
 *   DELETE /api/role-room/education/assignments/:id
 *   GET    /api/role-room/education/assignments/:id/submissions   (roster + status)
 *   PUT    /api/role-room/education/assignments/:id/submissions   ({studentId,status,note})
 *
 * Auth: Bearer-token → resolveUser (samme mønster som education-cohorts-routes).
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

export interface AssignmentView {
  id: string;
  cohortId: string | null;
  productionId: string | null;
  productionTitle: string | null;
  productionProjectId: string | null;
  title: string;
  brief: string | null;
  learningGoals: string | null;
  dueAt: string | null;
  status: string;
  submittedCount: number;
  reviewedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionView {
  studentId: string;
  studentName: string;
  status: string;
  note: string | null;
  feedback: string | null;
  grade: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

const SUBMISSION_STATUSES = new Set(["not_started", "submitted", "reviewed"]);
const ASSIGNMENT_STATUSES = new Set(["draft", "published", "archived"]);

function isoOrNull(v: unknown): string | null {
  return v ? new Date(v as string).toISOString() : null;
}

function assignmentRowToView(r: Record<string, unknown>): AssignmentView {
  return {
    id: String(r.id),
    cohortId: r.cohort_id ? String(r.cohort_id) : null,
    productionId: r.production_id ? String(r.production_id) : null,
    productionTitle: (r.production_title as string) ?? null,
    productionProjectId: (r.production_project_id as string) ?? null,
    title: (r.title as string) ?? "",
    brief: (r.brief as string) ?? null,
    learningGoals: (r.learning_goals as string) ?? null,
    dueAt: isoOrNull(r.due_at),
    status: (r.status as string) ?? "draft",
    submittedCount: Number(r.submitted_count ?? 0),
    reviewedCount: Number(r.reviewed_count ?? 0),
    createdAt: isoOrNull(r.created_at) ?? "",
    updatedAt: isoOrNull(r.updated_at) ?? "",
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

export interface CreateEducationAssignmentsRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationAssignmentsRouter(
  pool: Pool,
  deps: CreateEducationAssignmentsRouterDeps = {},
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

  // Verifiser at innlogget bruker eier oppgaven; returnerer raden eller null.
  const ownedAssignment = async (id: string, owner: string): Promise<Record<string, unknown> | null> => {
    const r = await pool.query(
      `SELECT * FROM role_room_education_assignments WHERE id = $1 AND owner_user_id = $2`,
      [id, owner],
    );
    return r.rows[0] ?? null;
  };

  // ── Oppgaver ────────────────────────────────────────────────────────────
  router.get("/education/assignments", requireAuth, async (req, res) => {
    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : null;
    try {
      const r = await pool.query(
        `SELECT a.*,
                prod.title AS production_title,
                prod.project_id AS production_project_id,
                COUNT(sub.id) FILTER (WHERE sub.status = 'submitted')::int AS submitted_count,
                COUNT(sub.id) FILTER (WHERE sub.status = 'reviewed')::int  AS reviewed_count
           FROM role_room_education_assignments a
           LEFT JOIN role_room_education_submissions sub ON sub.assignment_id = a.id
           LEFT JOIN role_room_education_productions prod ON prod.id = a.production_id
          WHERE a.owner_user_id = $1
            AND ($2::text IS NULL OR a.cohort_id = $2)
          GROUP BY a.id, prod.title, prod.project_id
          ORDER BY (a.status = 'archived') ASC, a.created_at DESC`,
        [uid(req), cohortId],
      );
      res.json({ assignments: r.rows.map(assignmentRowToView) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ assignments: [] }); return; }
      console.warn("[education-assignments] list failed:", (err as Error).message);
      res.json({ assignments: [] });
    }
  });

  router.post("/education/assignments", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as {
      title?: string; cohortId?: string | null; productionId?: string | null; brief?: string;
      learningGoals?: string; dueAt?: string | null; status?: string;
    };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) { res.status(400).json({ error: "title_required" }); return; }
    const status = body.status && ASSIGNMENT_STATUSES.has(body.status) ? body.status : "draft";
    try {
      const id = newEntityId("edassign");
      const r = await pool.query(
        `INSERT INTO role_room_education_assignments
           (id, owner_user_id, cohort_id, production_id, title, brief, learning_goals, due_at, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *, 0 AS submitted_count, 0 AS reviewed_count,
           (SELECT title FROM role_room_education_productions WHERE id = $4) AS production_title,
           (SELECT project_id FROM role_room_education_productions WHERE id = $4) AS production_project_id`,
        [
          id, uid(req), body.cohortId || null, body.productionId || null, title,
          body.brief?.trim() || null, body.learningGoals?.trim() || null,
          body.dueAt || null, status,
        ],
      );
      res.status(201).json({ assignment: assignmentRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-assignments] create failed:", (err as Error).message);
      res.status(500).json({ error: "create_failed" });
    }
  });

  router.patch("/education/assignments/:id", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as {
      title?: string; cohortId?: string | null; productionId?: string | null; brief?: string;
      learningGoals?: string; dueAt?: string | null; status?: string;
    };
    const status = typeof body.status === "string" && ASSIGNMENT_STATUSES.has(body.status) ? body.status : null;
    try {
      const r = await pool.query(
        `UPDATE role_room_education_assignments
            SET title = COALESCE($3, title),
                cohort_id = COALESCE($4, cohort_id),
                brief = COALESCE($5, brief),
                learning_goals = COALESCE($6, learning_goals),
                due_at = COALESCE($7, due_at),
                status = COALESCE($8, status),
                production_id = COALESCE($9, production_id),
                updated_at = now()
          WHERE id = $1 AND owner_user_id = $2
          RETURNING *,
            (SELECT COUNT(*)::int FROM role_room_education_submissions s WHERE s.assignment_id = role_room_education_assignments.id AND s.status='submitted') AS submitted_count,
            (SELECT COUNT(*)::int FROM role_room_education_submissions s WHERE s.assignment_id = role_room_education_assignments.id AND s.status='reviewed') AS reviewed_count,
            (SELECT title FROM role_room_education_productions WHERE id = role_room_education_assignments.production_id) AS production_title,
            (SELECT project_id FROM role_room_education_productions WHERE id = role_room_education_assignments.production_id) AS production_project_id`,
        [
          req.params.id, uid(req),
          typeof body.title === "string" ? body.title.trim() : null,
          body.cohortId ?? null,
          typeof body.brief === "string" ? body.brief.trim() : null,
          typeof body.learningGoals === "string" ? body.learningGoals.trim() : null,
          body.dueAt ?? null,
          status,
          body.productionId ?? null,
        ],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ assignment: assignmentRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-assignments] update failed:", (err as Error).message);
      res.status(500).json({ error: "update_failed" });
    }
  });

  router.delete("/education/assignments/:id", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `DELETE FROM role_room_education_assignments WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
        [req.params.id, uid(req)],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-assignments] delete failed:", (err as Error).message);
      res.status(500).json({ error: "delete_failed" });
    }
  });

  // ── Innleveringer (roster + status per student) ──────────────────────────
  router.get("/education/assignments/:id/submissions", requireAuth, async (req, res) => {
    try {
      const assignment = await ownedAssignment(req.params.id, uid(req));
      if (!assignment) { res.status(404).json({ error: "not_found" }); return; }
      if (!assignment.cohort_id) { res.json({ submissions: [] }); return; }
      // Left-join hele det aktive kullet mot innleveringene → syntetisk
      // not_started for studenter uten rad.
      const r = await pool.query(
        `SELECT st.id AS student_id, st.name AS student_name,
                COALESCE(sub.status, 'not_started') AS status,
                sub.note AS note, sub.submitted_at AS submitted_at,
                sub.feedback AS feedback, sub.grade AS grade, sub.reviewed_at AS reviewed_at
           FROM role_room_education_students st
           LEFT JOIN role_room_education_submissions sub
                  ON sub.student_id = st.id AND sub.assignment_id = $1
          WHERE st.cohort_id = $2 AND st.status = 'active'
          ORDER BY st.created_at ASC`,
        [req.params.id, assignment.cohort_id],
      );
      const submissions: SubmissionView[] = r.rows.map((row) => ({
        studentId: String(row.student_id),
        studentName: (row.student_name as string) ?? "",
        status: (row.status as string) ?? "not_started",
        note: (row.note as string) ?? null,
        feedback: (row.feedback as string) ?? null,
        grade: (row.grade as string) ?? null,
        submittedAt: isoOrNull(row.submitted_at),
        reviewedAt: isoOrNull(row.reviewed_at),
      }));
      res.json({ submissions });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ submissions: [] }); return; }
      console.warn("[education-assignments] submissions list failed:", (err as Error).message);
      res.json({ submissions: [] });
    }
  });

  router.put("/education/assignments/:id/submissions", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { studentId?: string; status?: string; note?: string; feedback?: string; grade?: string };
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const status = typeof body.status === "string" ? body.status : "";
    if (!studentId || !SUBMISSION_STATUSES.has(status)) {
      res.status(400).json({ error: "invalid_submission" });
      return;
    }
    const feedback = typeof body.feedback === "string" ? body.feedback.trim() || null : null;
    const grade = typeof body.grade === "string" ? body.grade.trim() || null : null;
    try {
      // Eierskap: oppgaven MÅ tilhøre brukeren, og studenten samme kull.
      const assignment = await ownedAssignment(req.params.id, uid(req));
      if (!assignment) { res.status(404).json({ error: "not_found" }); return; }
      const owns = await pool.query(
        `SELECT 1 FROM role_room_education_students WHERE id = $1 AND owner_user_id = $2`,
        [studentId, uid(req)],
      );
      if (owns.rows.length === 0) { res.status(404).json({ error: "student_not_found" }); return; }
      const submittedAt = status === "not_started" ? null : new Date().toISOString();
      // reviewed_at settes når status blir 'reviewed', nullstilles ved not_started.
      const reviewedAt = status === "reviewed" ? new Date().toISOString() : null;
      const id = newEntityId("edsub");
      const r = await pool.query(
        `INSERT INTO role_room_education_submissions
           (id, assignment_id, student_id, owner_user_id, status, note, feedback, grade, submitted_at, reviewed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (assignment_id, student_id)
         DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note,
                       feedback = EXCLUDED.feedback, grade = EXCLUDED.grade,
                       submitted_at = CASE WHEN EXCLUDED.status = 'not_started' THEN NULL
                                           ELSE COALESCE(role_room_education_submissions.submitted_at, EXCLUDED.submitted_at) END,
                       reviewed_at = CASE WHEN EXCLUDED.status = 'reviewed' THEN COALESCE(role_room_education_submissions.reviewed_at, EXCLUDED.reviewed_at)
                                          WHEN EXCLUDED.status = 'not_started' THEN NULL
                                          ELSE role_room_education_submissions.reviewed_at END,
                       updated_at = now()
         RETURNING *`,
        [id, req.params.id, studentId, uid(req), status, body.note?.trim() || null, feedback, grade, submittedAt, reviewedAt],
      );
      const row = r.rows[0];
      res.json({
        submission: {
          studentId,
          status: (row.status as string) ?? status,
          note: (row.note as string) ?? null,
          feedback: (row.feedback as string) ?? null,
          grade: (row.grade as string) ?? null,
          submittedAt: isoOrNull(row.submitted_at),
          reviewedAt: isoOrNull(row.reviewed_at),
        },
      });
    } catch (err) {
      console.error("[education-assignments] submission upsert failed:", (err as Error).message);
      res.status(500).json({ error: "submission_failed" });
    }
  });

  return router;
}
