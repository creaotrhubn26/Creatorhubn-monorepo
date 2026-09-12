/**
 * role-room-education-learning-goals-routes.ts — mountes under /api/role-room.
 *
 * LÆRINGSMÅL-katalog per kull + MÅLOPPNÅELSE. Rubrikk-kriterier lenker til
 * læringsmål (jf. rubric-routes), og attainment-endepunktet aggregerer rubrikk-
 * score per læringsmål. Owner-scopet.
 *
 * Endepunkter:
 *   GET    /education/cohorts/:id/learning-goals
 *   POST   /education/cohorts/:id/learning-goals   ({code?, title, description?})
 *   DELETE /education/learning-goals/:id
 *   GET    /education/cohorts/:id/attainment        (måloppnåelse per læringsmål)
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

export interface LearningGoalView {
  id: string; code: string | null; title: string; description: string | null; sortOrder: number;
}

function goalRowToView(r: Record<string, unknown>): LearningGoalView {
  return {
    id: String(r.id),
    code: (r.code as string) ?? null,
    title: (r.title as string) ?? "",
    description: (r.description as string) ?? null,
    sortOrder: Number(r.sort_order ?? 0),
  };
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

export interface CreateEducationLearningGoalsRouterDeps { activeSessions?: Map<string, SessionData>; }

export function createEducationLearningGoalsRouter(pool: Pool, deps: CreateEducationLearningGoalsRouterDeps = {}): ExpressRouter {
  const router = Router();

  const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    const session = await resolveUser(pool, deps.activeSessions, bearer);
    if (!session?.userId) { res.status(401).json({ error: "unauthorized" }); return; }
    (req as Request & { userId: string }).userId = session.userId;
    next();
  };
  const uid = (req: Request) => (req as Request & { userId: string }).userId;

  const ownsCohort = async (id: string, owner: string): Promise<boolean> => {
    const r = await pool.query(`SELECT 1 FROM role_room_education_cohorts WHERE id = $1 AND owner_user_id = $2`, [id, owner]);
    return r.rows.length > 0;
  };

  router.get("/education/cohorts/:id/learning-goals", requireAuth, async (req, res) => {
    try {
      if (!(await ownsCohort(req.params.id, uid(req)))) { res.status(404).json({ error: "not_found" }); return; }
      const r = await pool.query(
        `SELECT * FROM role_room_education_learning_goals WHERE cohort_id = $1 ORDER BY sort_order ASC, created_at ASC`,
        [req.params.id],
      );
      res.json({ goals: r.rows.map(goalRowToView) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ goals: [] }); return; }
      console.warn("[education-learning-goals] list failed:", (err as Error).message);
      res.json({ goals: [] });
    }
  });

  router.post("/education/cohorts/:id/learning-goals", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { code?: string; title?: string; description?: string; sortOrder?: number };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) { res.status(400).json({ error: "title_required" }); return; }
    try {
      if (!(await ownsCohort(req.params.id, uid(req)))) { res.status(404).json({ error: "not_found" }); return; }
      const id = newEntityId("edlg");
      const r = await pool.query(
        `INSERT INTO role_room_education_learning_goals (id, owner_user_id, cohort_id, code, title, description, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [id, uid(req), req.params.id, body.code?.trim() || null, title, body.description?.trim() || null, Number.isFinite(body.sortOrder) ? body.sortOrder : 0],
      );
      res.status(201).json({ goal: goalRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-learning-goals] create failed:", (err as Error).message);
      res.status(500).json({ error: "create_failed" });
    }
  });

  router.delete("/education/learning-goals/:id", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(`DELETE FROM role_room_education_learning_goals WHERE id = $1 AND owner_user_id = $2 RETURNING id`, [req.params.id, uid(req)]);
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-learning-goals] delete failed:", (err as Error).message);
      res.status(500).json({ error: "delete_failed" });
    }
  });

  // Måloppnåelse per læringsmål: aggregert rubrikk-score på tvers av lenkede
  // kriterier og studenter (avg-nivå 0..2 → prosent).
  router.get("/education/cohorts/:id/attainment", requireAuth, async (req, res) => {
    try {
      if (!(await ownsCohort(req.params.id, uid(req)))) { res.status(404).json({ error: "not_found" }); return; }
      const r = await pool.query(
        `SELECT g.id, g.code, g.title,
                COUNT(DISTINCT c.id)::int AS criteria_count,
                COUNT(rs.id)::int AS score_count,
                COALESCE(AVG(rs.level), 0)::float AS avg_level
           FROM role_room_education_learning_goals g
           LEFT JOIN role_room_education_rubric_criteria c ON c.learning_goal_id = g.id
           LEFT JOIN role_room_education_rubric_scores rs ON rs.criterion_id = c.id
          WHERE g.cohort_id = $1 AND g.owner_user_id = $2
          GROUP BY g.id
          ORDER BY g.sort_order ASC, g.created_at ASC`,
        [req.params.id, uid(req)],
      );
      res.json({
        attainment: r.rows.map((row) => {
          const avg = Number(row.avg_level ?? 0);
          return {
            goalId: String(row.id),
            code: (row.code as string) ?? null,
            title: (row.title as string) ?? "",
            criteriaCount: Number(row.criteria_count ?? 0),
            scoreCount: Number(row.score_count ?? 0),
            avgLevel: avg,
            pct: Math.round((avg / 2) * 100),
          };
        }),
      });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ attainment: [] }); return; }
      console.warn("[education-learning-goals] attainment failed:", (err as Error).message);
      res.json({ attainment: [] });
    }
  });

  return router;
}
