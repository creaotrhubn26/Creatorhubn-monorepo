/**
 * role-room-education-courses-routes.ts — mountes under /api/role-room.
 *
 * Emne-lag: en studiepoenggivende enhet med egen sluttvurdering. Holder emnekode,
 * studiepoeng, semester, vurderingsform og læringsutbytte (NKR: Kunnskap/
 * Ferdigheter/Generell kompetanse). Oppgaver/arbeidskrav henger på et emne via
 * assignments.course_id. Owner-scopet som resten av education_*.
 *
 * Endepunkter:
 *   GET    /api/role-room/education/courses        (?cohortId= filter)
 *   POST   /api/role-room/education/courses
 *   PATCH  /api/role-room/education/courses/:id
 *   DELETE /api/role-room/education/courses/:id
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

export interface LearningOutcomes {
  knowledge: string[];
  skills: string[];
  generalCompetence: string[];
}

export interface CourseView {
  id: string;
  cohortId: string | null;
  code: string | null;
  title: string;
  credits: number | null;
  term: string | null;
  vurderingsform: string | null;
  learningOutcomes: LearningOutcomes;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
}

const VURDERINGSFORMER = new Set(["bestatt", "bokstav", "mappe"]);

function normOutcomes(raw: unknown): LearningOutcomes {
  const o = (raw ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => (x as string).trim()) : [];
  return { knowledge: list(o.knowledge), skills: list(o.skills), generalCompetence: list(o.generalCompetence) };
}

function courseRowToView(r: Record<string, unknown>): CourseView {
  return {
    id: String(r.id),
    cohortId: r.cohort_id ? String(r.cohort_id) : null,
    code: (r.code as string) ?? null,
    title: (r.title as string) ?? "",
    credits: r.credits != null ? Number(r.credits) : null,
    term: (r.term as string) ?? null,
    vurderingsform: (r.vurderingsform as string) ?? null,
    learningOutcomes: normOutcomes(r.learning_outcomes),
    assignmentCount: Number(r.assignment_count ?? 0),
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

function readCredits(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface CreateEducationCoursesRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationCoursesRouter(
  pool: Pool,
  deps: CreateEducationCoursesRouterDeps = {},
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

  router.get("/education/courses", requireAuth, async (req, res) => {
    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : null;
    try {
      const params: unknown[] = [uid(req)];
      let cohortFilter = "";
      if (cohortId) { params.push(cohortId); cohortFilter = ` AND c.cohort_id = $${params.length}`; }
      const r = await pool.query(
        `SELECT c.*, COUNT(a.id)::int AS assignment_count
           FROM role_room_education_courses c
           LEFT JOIN role_room_education_assignments a ON a.course_id = c.id
          WHERE c.owner_user_id = $1${cohortFilter}
          GROUP BY c.id
          ORDER BY c.created_at DESC`,
        params,
      );
      res.json({ courses: r.rows.map(courseRowToView) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ courses: [] }); return; }
      console.warn("[education-courses] list failed:", (err as Error).message);
      res.json({ courses: [] });
    }
  });

  router.post("/education/courses", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { code?: string; title?: string; credits?: unknown; term?: string; cohortId?: string | null; vurderingsform?: string; learningOutcomes?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) { res.status(400).json({ error: "title_required" }); return; }
    const vurderingsform = body.vurderingsform && VURDERINGSFORMER.has(body.vurderingsform) ? body.vurderingsform : null;
    try {
      const id = newEntityId("edcourse");
      const r = await pool.query(
        `INSERT INTO role_room_education_courses (id, owner_user_id, cohort_id, code, title, credits, term, vurderingsform, learning_outcomes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
         RETURNING *, 0 AS assignment_count`,
        [
          id, uid(req), body.cohortId || null, body.code?.trim() || null, title,
          readCredits(body.credits), body.term?.trim() || null, vurderingsform,
          JSON.stringify(normOutcomes(body.learningOutcomes)),
        ],
      );
      res.status(201).json({ course: courseRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-courses] create failed:", (err as Error).message);
      res.status(500).json({ error: "create_failed" });
    }
  });

  router.patch("/education/courses/:id", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { code?: string; title?: string; credits?: unknown; term?: string; cohortId?: string | null; vurderingsform?: string; learningOutcomes?: unknown };
    const vurderingsform = typeof body.vurderingsform === "string" && VURDERINGSFORMER.has(body.vurderingsform) ? body.vurderingsform : null;
    const outcomes = body.learningOutcomes !== undefined ? JSON.stringify(normOutcomes(body.learningOutcomes)) : null;
    try {
      const r = await pool.query(
        `UPDATE role_room_education_courses
            SET code = COALESCE($3, code),
                title = COALESCE($4, title),
                credits = COALESCE($5, credits),
                term = COALESCE($6, term),
                cohort_id = COALESCE($7, cohort_id),
                vurderingsform = COALESCE($8, vurderingsform),
                learning_outcomes = COALESCE($9::jsonb, learning_outcomes),
                updated_at = now()
          WHERE id = $1 AND owner_user_id = $2
          RETURNING *, (SELECT COUNT(*)::int FROM role_room_education_assignments a WHERE a.course_id = role_room_education_courses.id) AS assignment_count`,
        [
          req.params.id, uid(req),
          typeof body.code === "string" ? body.code.trim() : null,
          typeof body.title === "string" ? body.title.trim() : null,
          body.credits !== undefined ? readCredits(body.credits) : null,
          typeof body.term === "string" ? body.term.trim() : null,
          body.cohortId ?? null,
          vurderingsform,
          outcomes,
        ],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ course: courseRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-courses] update failed:", (err as Error).message);
      res.status(500).json({ error: "update_failed" });
    }
  });

  router.delete("/education/courses/:id", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `DELETE FROM role_room_education_courses WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
        [req.params.id, uid(req)],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-courses] delete failed:", (err as Error).message);
      res.status(500).json({ error: "delete_failed" });
    }
  });

  return router;
}
