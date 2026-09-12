/**
 * role-room-education-overview-routes.ts — mountes under /api/role-room.
 *
 * Faglærer-forsiden: aggregerer på tvers av alle kull — frister, til-vurdering-
 * kø, manglende innleveringer og aktive produksjoner. Ren lesing av data som
 * allerede finnes (kull/oppgaver/innleveringer/produksjoner). Owner-scopet.
 *
 * Endepunkt:
 *   GET /api/role-room/education/overview
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

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
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

const EMPTY = {
  stats: { dueThisWeek: 0, toReview: 0, missingSubmissions: 0, productions: 0 },
  dueSoon: [] as unknown[],
  reviewQueue: [] as unknown[],
};

export interface CreateEducationOverviewRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationOverviewRouter(
  pool: Pool,
  deps: CreateEducationOverviewRouterDeps = {},
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

  const num = (r: { rows: Array<Record<string, unknown>> }) => Number(r.rows[0]?.n ?? 0);

  router.get("/education/overview", requireAuth, async (req, res) => {
    const owner = uid(req);
    try {
      const [dueWeek, toReview, missing, productions, dueSoon, reviewQueue] = await Promise.all([
        // Frister neste 7 dager (publiserte oppgaver).
        pool.query(
          `SELECT COUNT(*)::int AS n FROM role_room_education_assignments
            WHERE owner_user_id = $1 AND status = 'published'
              AND due_at IS NOT NULL AND due_at >= now() AND due_at < now() + INTERVAL '7 days'`,
          [owner],
        ),
        // Leveranser som venter på vurdering.
        pool.query(
          `SELECT COUNT(*)::int AS n FROM role_room_education_submissions
            WHERE owner_user_id = $1 AND status = 'submitted'`,
          [owner],
        ),
        // Manglende innleveringer på forfalte oppgaver (student × oppgave uten levering).
        pool.query(
          `SELECT COUNT(*)::int AS n
             FROM role_room_education_students st
             JOIN role_room_education_assignments a
                  ON a.cohort_id = st.cohort_id AND a.owner_user_id = $1
                 AND a.status = 'published' AND a.due_at IS NOT NULL AND a.due_at < now()
             LEFT JOIN role_room_education_submissions sub
                  ON sub.assignment_id = a.id AND sub.student_id = st.id
                 AND sub.status IN ('submitted','reviewed')
            WHERE st.owner_user_id = $1 AND st.status = 'active' AND sub.id IS NULL`,
          [owner],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM role_room_education_productions WHERE owner_user_id = $1`,
          [owner],
        ),
        // Kommende frister (liste).
        pool.query(
          `SELECT a.id, a.title, a.due_at, c.name AS cohort_name
             FROM role_room_education_assignments a
             LEFT JOIN role_room_education_cohorts c ON c.id = a.cohort_id
            WHERE a.owner_user_id = $1 AND a.status = 'published'
              AND a.due_at IS NOT NULL AND a.due_at >= now()
            ORDER BY a.due_at ASC LIMIT 6`,
          [owner],
        ),
        // Vurderingskø (liste).
        pool.query(
          `SELECT s.id, st.name AS student_name, a.title AS assignment_title,
                  c.name AS cohort_name, s.submitted_at
             FROM role_room_education_submissions s
             JOIN role_room_education_assignments a ON a.id = s.assignment_id
             JOIN role_room_education_students st ON st.id = s.student_id
             LEFT JOIN role_room_education_cohorts c ON c.id = a.cohort_id
            WHERE s.owner_user_id = $1 AND s.status = 'submitted'
            ORDER BY s.submitted_at DESC NULLS LAST LIMIT 8`,
          [owner],
        ),
      ]);

      res.json({
        stats: {
          dueThisWeek: num(dueWeek),
          toReview: num(toReview),
          missingSubmissions: num(missing),
          productions: num(productions),
        },
        dueSoon: dueSoon.rows.map((r) => ({
          assignmentId: String(r.id),
          title: (r.title as string) ?? "",
          cohortName: (r.cohort_name as string) ?? null,
          dueAt: isoOrNull(r.due_at),
        })),
        reviewQueue: reviewQueue.rows.map((r) => ({
          submissionId: String(r.id),
          studentName: (r.student_name as string) ?? "",
          assignmentTitle: (r.assignment_title as string) ?? "",
          cohortName: (r.cohort_name as string) ?? null,
          submittedAt: isoOrNull(r.submitted_at),
        })),
      });
    } catch (err) {
      if (isMissingTable(err)) { res.json(EMPTY); return; }
      console.warn("[education-overview] failed:", (err as Error).message);
      res.json(EMPTY);
    }
  });

  return router;
}
