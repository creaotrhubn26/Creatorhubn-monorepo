/**
 * role-room-education-cohorts-routes.ts — mountes under /api/role-room.
 *
 * Utdannings-workspace kjerneverdi (fase 2): KULL + STUDENTER. Eies av
 * institusjons-brukeren (owner_user_id = innlogget bruker). Alt owner-scopet —
 * en institusjon ser kun sine egne kull/studenter.
 *
 * Endepunkter:
 *   GET    /api/role-room/education/cohorts
 *   POST   /api/role-room/education/cohorts
 *   PATCH  /api/role-room/education/cohorts/:id
 *   DELETE /api/role-room/education/cohorts/:id
 *   GET    /api/role-room/education/cohorts/:id/students
 *   POST   /api/role-room/education/cohorts/:id/students
 *   DELETE /api/role-room/education/students/:id
 *
 * Auth: Bearer-token (readActiveSessionToken-mønsteret) → resolveUser. Samme
 * som storyboard-ai-routes / crew-notifications.
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

export interface CohortView {
  id: string;
  name: string;
  program: string | null;
  term: string | null;
  archived: boolean;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudentView {
  id: string;
  cohortId: string;
  name: string;
  email: string | null;
  studentNumber: string | null;
  status: string;
  groupId: string | null;
  groupName: string | null;
  createdAt: string;
}

function cohortRowToView(r: Record<string, unknown>): CohortView {
  return {
    id: String(r.id),
    name: (r.name as string) ?? "",
    program: (r.program as string) ?? null,
    term: (r.term as string) ?? null,
    archived: Boolean(r.archived),
    studentCount: Number(r.student_count ?? 0),
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : "",
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : "",
  };
}

function studentRowToView(r: Record<string, unknown>): StudentView {
  return {
    id: String(r.id),
    cohortId: String(r.cohort_id),
    name: (r.name as string) ?? "",
    email: (r.email as string) ?? null,
    studentNumber: (r.student_number as string) ?? null,
    status: (r.status as string) ?? "active",
    groupId: (r.group_id as string) ?? null,
    groupName: (r.group_name as string) ?? null,
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : "",
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

export interface CreateEducationCohortsRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationCohortsRouter(
  pool: Pool,
  deps: CreateEducationCohortsRouterDeps = {},
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

  // ── Kull ──────────────────────────────────────────────────────────────────
  router.get("/education/cohorts", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT c.*, COUNT(s.id)::int AS student_count
           FROM role_room_education_cohorts c
           LEFT JOIN role_room_education_students s ON s.cohort_id = c.id AND s.status = 'active'
          WHERE c.owner_user_id = $1
          GROUP BY c.id
          ORDER BY c.archived ASC, c.created_at DESC`,
        [uid(req)],
      );
      res.json({ cohorts: r.rows.map(cohortRowToView) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ cohorts: [] }); return; }
      console.warn("[education-cohorts] list failed:", (err as Error).message);
      res.json({ cohorts: [] });
    }
  });

  router.post("/education/cohorts", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { name?: string; program?: string; term?: string };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) { res.status(400).json({ error: "name_required" }); return; }
    try {
      const id = newEntityId("cohort");
      const r = await pool.query(
        `INSERT INTO role_room_education_cohorts (id, owner_user_id, name, program, term)
         VALUES ($1,$2,$3,$4,$5) RETURNING *, 0 AS student_count`,
        [id, uid(req), name, body.program?.trim() || null, body.term?.trim() || null],
      );
      res.status(201).json({ cohort: cohortRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-cohorts] create failed:", (err as Error).message);
      res.status(500).json({ error: "create_failed" });
    }
  });

  router.patch("/education/cohorts/:id", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { name?: string; program?: string; term?: string; archived?: boolean };
    try {
      const r = await pool.query(
        `UPDATE role_room_education_cohorts
            SET name = COALESCE($3, name),
                program = COALESCE($4, program),
                term = COALESCE($5, term),
                archived = COALESCE($6, archived),
                updated_at = now()
          WHERE id = $1 AND owner_user_id = $2
          RETURNING *, (SELECT COUNT(*)::int FROM role_room_education_students s WHERE s.cohort_id = role_room_education_cohorts.id AND s.status='active') AS student_count`,
        [
          req.params.id, uid(req),
          typeof body.name === "string" ? body.name.trim() : null,
          typeof body.program === "string" ? body.program.trim() : null,
          typeof body.term === "string" ? body.term.trim() : null,
          typeof body.archived === "boolean" ? body.archived : null,
        ],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ cohort: cohortRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-cohorts] update failed:", (err as Error).message);
      res.status(500).json({ error: "update_failed" });
    }
  });

  router.delete("/education/cohorts/:id", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `DELETE FROM role_room_education_cohorts WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
        [req.params.id, uid(req)],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-cohorts] delete failed:", (err as Error).message);
      res.status(500).json({ error: "delete_failed" });
    }
  });

  // ── Studenter ───────────────────────────────────────────────────────────
  router.get("/education/cohorts/:id/students", requireAuth, async (req, res) => {
    try {
      const owns = await pool.query(
        `SELECT 1 FROM role_room_education_cohorts WHERE id = $1 AND owner_user_id = $2`,
        [req.params.id, uid(req)],
      );
      if (owns.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      let r;
      try {
        r = await pool.query(
          `SELECT s.*, g.name AS group_name
             FROM role_room_education_students s
             LEFT JOIN role_room_education_groups g ON g.id = s.group_id
            WHERE s.cohort_id = $1
            ORDER BY s.created_at ASC`,
          [req.params.id],
        );
      } catch (joinErr) {
        // Grupper-migrasjonen (0426) ikke kjørt ennå → fall tilbake uten gruppe.
        if ((joinErr as { code?: string })?.code !== "42P01" && (joinErr as { code?: string })?.code !== "42703") throw joinErr;
        r = await pool.query(
          `SELECT * FROM role_room_education_students WHERE cohort_id = $1 ORDER BY created_at ASC`,
          [req.params.id],
        );
      }
      res.json({ students: r.rows.map(studentRowToView) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ students: [] }); return; }
      console.warn("[education-cohorts] students list failed:", (err as Error).message);
      res.json({ students: [] });
    }
  });

  router.post("/education/cohorts/:id/students", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { name?: string; email?: string; studentNumber?: string };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) { res.status(400).json({ error: "name_required" }); return; }
    try {
      const owns = await pool.query(
        `SELECT 1 FROM role_room_education_cohorts WHERE id = $1 AND owner_user_id = $2`,
        [req.params.id, uid(req)],
      );
      if (owns.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      const id = newEntityId("student");
      const r = await pool.query(
        `INSERT INTO role_room_education_students (id, cohort_id, owner_user_id, name, email, student_number)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, req.params.id, uid(req), name, body.email?.trim() || null, body.studentNumber?.trim() || null],
      );
      res.status(201).json({ student: studentRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-cohorts] add student failed:", (err as Error).message);
      res.status(500).json({ error: "add_student_failed" });
    }
  });

  // Bulk-innlegging (CSV-import). Hopper over rader uten navn + duplikat-e-post
  // (case-insensitivt) mot studenter som allerede finnes i kullet.
  router.post("/education/cohorts/:id/students/bulk", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { students?: { name?: string; email?: string; studentNumber?: string }[] };
    const rows = Array.isArray(body.students) ? body.students : [];
    if (rows.length === 0) { res.status(400).json({ error: "students_required" }); return; }
    if (rows.length > 1000) { res.status(400).json({ error: "too_many" }); return; }
    try {
      const owns = await pool.query(
        `SELECT 1 FROM role_room_education_cohorts WHERE id = $1 AND owner_user_id = $2`,
        [req.params.id, uid(req)],
      );
      if (owns.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      const existing = await pool.query(
        `SELECT lower(email) AS email, lower(name) AS name FROM role_room_education_students WHERE cohort_id = $1`,
        [req.params.id],
      );
      const seen = new Set<string>(existing.rows.filter((r) => r.email).map((r) => String(r.email)));
      // Navn-dedup som fallback når e-post mangler (ellers dubletter uten unik constraint).
      const seenNames = new Set<string>(existing.rows.map((r) => String(r.name ?? "")));
      let added = 0;
      let skipped = 0;
      for (const row of rows) {
        const name = typeof row.name === "string" ? row.name.trim() : "";
        const email = typeof row.email === "string" ? row.email.trim() : "";
        const emailKey = email.toLowerCase();
        const nameKey = name.toLowerCase();
        if (!name) { skipped++; continue; }
        const dup = emailKey ? seen.has(emailKey) : seenNames.has(nameKey);
        if (dup) { skipped++; continue; }
        if (emailKey) seen.add(emailKey); else seenNames.add(nameKey);
        // eslint-disable-next-line no-await-in-loop -- sekvensiell insert holder skjemaet enkelt
        await pool.query(
          `INSERT INTO role_room_education_students (id, cohort_id, owner_user_id, name, email, student_number)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [newEntityId("student"), req.params.id, uid(req), name, email || null, row.studentNumber?.trim() || null],
        );
        added++;
      }
      res.status(201).json({ added, skipped });
    } catch (err) {
      console.error("[education-cohorts] bulk add failed:", (err as Error).message);
      res.status(500).json({ error: "bulk_add_failed" });
    }
  });

  router.delete("/education/students/:id", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `DELETE FROM role_room_education_students WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
        [req.params.id, uid(req)],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-cohorts] delete student failed:", (err as Error).message);
      res.status(500).json({ error: "delete_student_failed" });
    }
  });

  return router;
}
