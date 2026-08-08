/**
 * role-room-education-rubric-routes.ts — mountes under /api/role-room.
 *
 * RUBRIKKER: strukturerte vurderingskriterier per oppgave (knyttet til
 * læringsmål) + score per student (0=Ikke nådd, 1=Delvis, 2=Nådd). Poengsummen
 * informerer karakteren (som settes fritt i Vurdering). Owner-scopet.
 *
 * Endepunkter:
 *   GET    /api/role-room/education/assignments/:id/rubric              (kriterier)
 *   POST   /api/role-room/education/assignments/:id/rubric/criteria     ({title, learningGoal?})
 *   DELETE /api/role-room/education/rubric/criteria/:criterionId
 *   GET    /api/role-room/education/assignments/:id/rubric/scores?studentId=  (kriterier + scores)
 *   PUT    /api/role-room/education/rubric/scores                       ({criterionId, studentId, level})
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

export interface RubricCriterionView {
  id: string;
  title: string;
  learningGoal: string | null;
  learningGoalId: string | null;
  learningGoalTitle: string | null;
  sortOrder: number;
}

function criterionRowToView(r: Record<string, unknown>): RubricCriterionView {
  return {
    id: String(r.id),
    title: (r.title as string) ?? "",
    learningGoal: (r.learning_goal as string) ?? null,
    learningGoalId: r.learning_goal_id ? String(r.learning_goal_id) : null,
    learningGoalTitle: (r.learning_goal_title as string) ?? null,
    sortOrder: Number(r.sort_order ?? 0),
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

export interface CreateEducationRubricRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationRubricRouter(
  pool: Pool,
  deps: CreateEducationRubricRouterDeps = {},
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

  const ownsAssignment = async (id: string, owner: string): Promise<boolean> => {
    const r = await pool.query(
      `SELECT 1 FROM role_room_education_assignments WHERE id = $1 AND owner_user_id = $2`,
      [id, owner],
    );
    return r.rows.length > 0;
  };

  const listCriteria = async (assignmentId: string): Promise<RubricCriterionView[]> => {
    const r = await pool.query(
      `SELECT c.*, g.title AS learning_goal_title
         FROM role_room_education_rubric_criteria c
         LEFT JOIN role_room_education_learning_goals g ON g.id = c.learning_goal_id
        WHERE c.assignment_id = $1 ORDER BY c.sort_order ASC, c.created_at ASC`,
      [assignmentId],
    );
    return r.rows.map(criterionRowToView);
  };

  // ── Kriterier ─────────────────────────────────────────────────────────────
  router.get("/education/assignments/:id/rubric", requireAuth, async (req, res) => {
    try {
      if (!(await ownsAssignment(req.params.id, uid(req)))) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ criteria: await listCriteria(req.params.id) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ criteria: [] }); return; }
      console.warn("[education-rubric] list failed:", (err as Error).message);
      res.json({ criteria: [] });
    }
  });

  router.post("/education/assignments/:id/rubric/criteria", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { title?: string; learningGoal?: string; learningGoalId?: string; sortOrder?: number };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) { res.status(400).json({ error: "title_required" }); return; }
    try {
      if (!(await ownsAssignment(req.params.id, uid(req)))) { res.status(404).json({ error: "not_found" }); return; }
      const id = newEntityId("edrub");
      const r = await pool.query(
        `INSERT INTO role_room_education_rubric_criteria (id, assignment_id, owner_user_id, title, learning_goal, learning_goal_id, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *, (SELECT title FROM role_room_education_learning_goals WHERE id = $6) AS learning_goal_title`,
        [id, req.params.id, uid(req), title, body.learningGoal?.trim() || null, body.learningGoalId || null, Number.isFinite(body.sortOrder) ? body.sortOrder : 0],
      );
      res.status(201).json({ criterion: criterionRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-rubric] create failed:", (err as Error).message);
      res.status(500).json({ error: "create_failed" });
    }
  });

  router.delete("/education/rubric/criteria/:criterionId", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `DELETE FROM role_room_education_rubric_criteria WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
        [req.params.criterionId, uid(req)],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-rubric] delete failed:", (err as Error).message);
      res.status(500).json({ error: "delete_failed" });
    }
  });

  // ── Scoring per student ──────────────────────────────────────────────────
  router.get("/education/assignments/:id/rubric/scores", requireAuth, async (req, res) => {
    const studentId = typeof req.query.studentId === "string" ? req.query.studentId : "";
    if (!studentId) { res.status(400).json({ error: "student_id_required" }); return; }
    try {
      if (!(await ownsAssignment(req.params.id, uid(req)))) { res.status(404).json({ error: "not_found" }); return; }
      const criteria = await listCriteria(req.params.id);
      const sc = await pool.query(
        `SELECT rs.criterion_id, rs.level
           FROM role_room_education_rubric_scores rs
           JOIN role_room_education_rubric_criteria c ON c.id = rs.criterion_id
          WHERE c.assignment_id = $1 AND rs.student_id = $2`,
        [req.params.id, studentId],
      );
      const scores: Record<string, number> = {};
      for (const row of sc.rows) scores[String(row.criterion_id)] = Number(row.level ?? 0);
      res.json({ criteria, scores });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ criteria: [], scores: {} }); return; }
      console.warn("[education-rubric] scores failed:", (err as Error).message);
      res.json({ criteria: [], scores: {} });
    }
  });

  router.put("/education/rubric/scores", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { criterionId?: string; studentId?: string; level?: number };
    const criterionId = typeof body.criterionId === "string" ? body.criterionId : "";
    const studentId = typeof body.studentId === "string" ? body.studentId : "";
    const level = Number(body.level);
    if (!criterionId || !studentId || ![0, 1, 2].includes(level)) {
      res.status(400).json({ error: "invalid_score" });
      return;
    }
    try {
      // Eierskap + integritet: kriteriet MÅ tilhøre brukeren, studenten MÅ
      // tilhøre brukeren OG samme kull som kriteriets oppgave (ellers kan man
      // score fantom- eller kryss-kull-studenter).
      const owns = await pool.query(
        `SELECT 1
           FROM role_room_education_rubric_criteria c
           JOIN role_room_education_assignments a ON a.id = c.assignment_id
           JOIN role_room_education_students s ON s.id = $2 AND s.owner_user_id = $3
          WHERE c.id = $1 AND c.owner_user_id = $3
            AND (a.cohort_id IS NULL OR s.cohort_id = a.cohort_id)`,
        [criterionId, studentId, uid(req)],
      );
      if (owns.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      const id = newEntityId("edrsc");
      await pool.query(
        `INSERT INTO role_room_education_rubric_scores (id, criterion_id, student_id, owner_user_id, level)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (criterion_id, student_id)
         DO UPDATE SET level = EXCLUDED.level, updated_at = now()`,
        [id, criterionId, studentId, uid(req), level],
      );
      res.json({ success: true, criterionId, level });
    } catch (err) {
      console.error("[education-rubric] score failed:", (err as Error).message);
      res.status(500).json({ error: "score_failed" });
    }
  });

  return router;
}
