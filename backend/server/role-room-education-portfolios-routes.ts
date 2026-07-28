/**
 * role-room-education-portfolios-routes.ts — mountes under /api/role-room.
 *
 * Studentporteføljer (showreels + eksamensmapper). Owner-scopet; hvert element
 * knyttet til en student brukeren eier. Speiler mønsteret fra cohorts/groups.
 *
 * Endepunkter:
 *   GET    /api/role-room/education/portfolios
 *   POST   /api/role-room/education/portfolios          { studentId, kind?, title?, url? }
 *   PATCH  /api/role-room/education/portfolios/:id       { status?, kind?, title?, url? }
 *   DELETE /api/role-room/education/portfolios/:id
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

export interface PortfolioView {
  id: string;
  studentId: string;
  studentName: string;
  cohortId: string | null;
  cohortName: string | null;
  kind: string;
  status: string;
  title: string | null;
  url: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

function portfolioRowToView(r: Record<string, unknown>): PortfolioView {
  return {
    id: String(r.id),
    studentId: String(r.student_id),
    studentName: (r.student_name as string) ?? "",
    cohortId: (r.cohort_id as string) ?? null,
    cohortName: (r.cohort_name as string) ?? null,
    kind: (r.kind as string) ?? "showreel",
    status: (r.status as string) ?? "draft",
    title: (r.title as string) ?? null,
    url: (r.url as string) ?? null,
    publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : null,
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

const KINDS = new Set(["showreel", "exam"]);
const STATUSES = new Set(["draft", "published"]);

export interface CreateEducationPortfoliosRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationPortfoliosRouter(
  pool: Pool,
  deps: CreateEducationPortfoliosRouterDeps = {},
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

  router.get("/education/portfolios", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT p.*, s.name AS student_name, s.cohort_id, c.name AS cohort_name
           FROM role_room_education_portfolios p
           JOIN role_room_education_students s ON s.id = p.student_id
           LEFT JOIN role_room_education_cohorts c ON c.id = s.cohort_id
          WHERE p.owner_user_id = $1
          ORDER BY p.updated_at DESC`,
        [uid(req)],
      );
      res.json({ portfolios: r.rows.map(portfolioRowToView) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ portfolios: [] }); return; }
      console.warn("[education-portfolios] list failed:", (err as Error).message);
      res.json({ portfolios: [] });
    }
  });

  router.post("/education/portfolios", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { studentId?: string; kind?: string; title?: string; url?: string };
    const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
    if (!studentId) { res.status(400).json({ error: "student_required" }); return; }
    const kind = body.kind && KINDS.has(body.kind) ? body.kind : "showreel";
    try {
      const owns = await pool.query(
        `SELECT 1 FROM role_room_education_students WHERE id = $1 AND owner_user_id = $2`,
        [studentId, uid(req)],
      );
      if (owns.rows.length === 0) { res.status(404).json({ error: "student_not_found" }); return; }
      const id = newEntityId("portfolio");
      await pool.query(
        `INSERT INTO role_room_education_portfolios (id, student_id, owner_user_id, kind, title, url)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, studentId, uid(req), kind, body.title?.trim() || null, body.url?.trim() || null],
      );
      const r = await pool.query(
        `SELECT p.*, s.name AS student_name, s.cohort_id, c.name AS cohort_name
           FROM role_room_education_portfolios p
           JOIN role_room_education_students s ON s.id = p.student_id
           LEFT JOIN role_room_education_cohorts c ON c.id = s.cohort_id
          WHERE p.id = $1`,
        [id],
      );
      res.status(201).json({ portfolio: portfolioRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-portfolios] create failed:", (err as Error).message);
      res.status(500).json({ error: "create_failed" });
    }
  });

  router.patch("/education/portfolios/:id", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { status?: string; kind?: string; title?: string; url?: string };
    const status = body.status && STATUSES.has(body.status) ? body.status : null;
    const kind = body.kind && KINDS.has(body.kind) ? body.kind : null;
    try {
      const r = await pool.query(
        `UPDATE role_room_education_portfolios p
            SET status = COALESCE($3, status),
                kind = COALESCE($4, kind),
                title = COALESCE($5, title),
                url = COALESCE($6, url),
                published_at = CASE
                  WHEN $3 = 'published' AND status <> 'published' THEN now()
                  WHEN $3 = 'draft' THEN NULL
                  ELSE published_at END,
                updated_at = now()
          WHERE p.id = $1 AND p.owner_user_id = $2
          RETURNING p.id`,
        [
          req.params.id, uid(req), status, kind,
          typeof body.title === "string" ? body.title.trim() : null,
          typeof body.url === "string" ? body.url.trim() : null,
        ],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      const full = await pool.query(
        `SELECT p.*, s.name AS student_name, s.cohort_id, c.name AS cohort_name
           FROM role_room_education_portfolios p
           JOIN role_room_education_students s ON s.id = p.student_id
           LEFT JOIN role_room_education_cohorts c ON c.id = s.cohort_id
          WHERE p.id = $1`,
        [req.params.id],
      );
      res.json({ portfolio: portfolioRowToView(full.rows[0]) });
    } catch (err) {
      console.error("[education-portfolios] update failed:", (err as Error).message);
      res.status(500).json({ error: "update_failed" });
    }
  });

  router.delete("/education/portfolios/:id", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `DELETE FROM role_room_education_portfolios WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
        [req.params.id, uid(req)],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-portfolios] delete failed:", (err as Error).message);
      res.status(500).json({ error: "delete_failed" });
    }
  });

  return router;
}
