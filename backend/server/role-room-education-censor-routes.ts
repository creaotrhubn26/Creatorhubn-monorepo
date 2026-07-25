/**
 * role-room-education-censor-routes.ts — mountes under /api/role-room.
 *
 * EKSTERN SENSOR: faglærer inviterer en sensor til et kull; sensor logger inn
 * via ISOLERT sesjon (som studenter → null blast-radius) og ser kullets arbeid
 * + faglærers vurdering, og gir sin egen uavhengige vurdering.
 *
 * Fagl-endepunkter (Bearer, owner-scopet):
 *   POST   /education/censor/invites            ({cohortId, name?, email?})
 *   GET    /education/cohorts/:id/censor-invites
 *   DELETE /education/censor/invites/:id
 *   GET    /education/cohorts/:id/censor-grades   (faglærer ser sensors karakterer)
 * Sensor-endepunkter (x-censor-token, isolert):
 *   POST   /education/censor/claim              (offentlig; invite-token → sesjon)
 *   GET    /education/censor/view
 *   PUT    /education/censor/grade              ({studentId, assignmentId, grade?, feedback?})
 */

import crypto from "crypto";
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

function isoOrNull(v: unknown): string | null {
  return v ? new Date(v as string).toISOString() : null;
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

/** Isolert sensor-sesjon → {inviteId, ownerUserId, cohortId} eller null. */
async function resolveCensorSession(pool: Pool, token: string | undefined): Promise<{ inviteId: string; ownerUserId: string; cohortId: string } | null> {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t) return null;
  const r = await pool.query(
    `UPDATE role_room_education_censor_sessions SET last_seen_at = now()
      WHERE token = $1 AND expires_at > now()
      RETURNING invite_id, owner_user_id, cohort_id`,
    [t],
  );
  const row = r.rows[0];
  return row ? { inviteId: String(row.invite_id), ownerUserId: String(row.owner_user_id), cohortId: String(row.cohort_id) } : null;
}

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "42P01";
}

export interface CreateEducationCensorRouterDeps { activeSessions?: Map<string, SessionData>; }

export function createEducationCensorRouter(pool: Pool, deps: CreateEducationCensorRouterDeps = {}): ExpressRouter {
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

  // ── Faglærer: invitasjoner ────────────────────────────────────────────────
  router.post("/education/censor/invites", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { cohortId?: string; name?: string; email?: string };
    const cohortId = typeof body.cohortId === "string" ? body.cohortId : "";
    if (!cohortId) { res.status(400).json({ error: "cohort_id_required" }); return; }
    try {
      if (!(await ownsCohort(cohortId, uid(req)))) { res.status(404).json({ error: "not_found" }); return; }
      const id = newEntityId("edcen");
      const token = crypto.randomBytes(24).toString("hex");
      const r = await pool.query(
        `INSERT INTO role_room_education_censor_invites (id, owner_user_id, cohort_id, name, email, token)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, uid(req), cohortId, body.name?.trim() || null, body.email?.trim() || null, token],
      );
      const row = r.rows[0];
      res.status(201).json({ invite: { id: String(row.id), name: (row.name as string) ?? null, email: (row.email as string) ?? null, token: row.token, status: row.status, expiresAt: isoOrNull(row.expires_at) } });
    } catch (err) {
      console.error("[education-censor] invite failed:", (err as Error).message);
      res.status(500).json({ error: "invite_failed" });
    }
  });

  router.get("/education/cohorts/:id/censor-invites", requireAuth, async (req, res) => {
    try {
      if (!(await ownsCohort(req.params.id, uid(req)))) { res.status(404).json({ error: "not_found" }); return; }
      const r = await pool.query(
        `SELECT id, name, email, token, status, accepted_at, expires_at FROM role_room_education_censor_invites
          WHERE cohort_id = $1 AND status <> 'revoked' ORDER BY created_at DESC`,
        [req.params.id],
      );
      res.json({ invites: r.rows.map((row) => ({ id: String(row.id), name: (row.name as string) ?? null, email: (row.email as string) ?? null, token: row.token, status: row.status, acceptedAt: isoOrNull(row.accepted_at), expiresAt: isoOrNull(row.expires_at) })) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ invites: [] }); return; }
      console.warn("[education-censor] list failed:", (err as Error).message);
      res.json({ invites: [] });
    }
  });

  router.delete("/education/censor/invites/:id", requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `UPDATE role_room_education_censor_invites SET status = 'revoked', updated_at = now()
          WHERE id = $1 AND owner_user_id = $2 RETURNING id`,
        [req.params.id, uid(req)],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-censor] revoke failed:", (err as Error).message);
      res.status(500).json({ error: "revoke_failed" });
    }
  });

  router.get("/education/cohorts/:id/censor-grades", requireAuth, async (req, res) => {
    try {
      if (!(await ownsCohort(req.params.id, uid(req)))) { res.status(404).json({ error: "not_found" }); return; }
      const r = await pool.query(
        `SELECT cg.student_id, cg.assignment_id, cg.grade, cg.feedback
           FROM role_room_education_censor_grades cg
           JOIN role_room_education_censor_invites ci ON ci.id = cg.invite_id
          WHERE ci.cohort_id = $1 AND cg.owner_user_id = $2`,
        [req.params.id, uid(req)],
      );
      res.json({ grades: r.rows.map((row) => ({ studentId: String(row.student_id), assignmentId: String(row.assignment_id), grade: (row.grade as string) ?? null, feedback: (row.feedback as string) ?? null })) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ grades: [] }); return; }
      console.warn("[education-censor] grades failed:", (err as Error).message);
      res.json({ grades: [] });
    }
  });

  // ── Sensor: claim + visning + vurdering ──────────────────────────────────
  router.post("/education/censor/claim", async (req, res) => {
    const body = (req.body ?? {}) as { token?: string };
    const inviteToken = typeof body.token === "string" ? body.token.trim() : "";
    if (!inviteToken) { res.status(400).json({ error: "token_required" }); return; }
    try {
      const inv = await pool.query(
        `SELECT ci.id, ci.owner_user_id, ci.cohort_id, ci.status, ci.expires_at, c.name AS cohort_name
           FROM role_room_education_censor_invites ci
           LEFT JOIN role_room_education_cohorts c ON c.id = ci.cohort_id
          WHERE ci.token = $1`,
        [inviteToken],
      );
      const invite = inv.rows[0];
      if (!invite || invite.status === "revoked" || new Date(invite.expires_at as string) <= new Date()) {
        res.status(404).json({ error: "invalid_invite" }); return;
      }
      await pool.query(
        `UPDATE role_room_education_censor_invites SET status = 'accepted', accepted_at = COALESCE(accepted_at, now()), updated_at = now() WHERE id = $1`,
        [invite.id],
      );
      const sessionToken = crypto.randomBytes(24).toString("hex");
      await pool.query(
        `INSERT INTO role_room_education_censor_sessions (token, invite_id, owner_user_id, cohort_id, expires_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [sessionToken, invite.id, invite.owner_user_id, invite.cohort_id, invite.expires_at],
      );
      res.status(201).json({ sessionToken, cohortName: (invite.cohort_name as string) ?? null, expiresAt: isoOrNull(invite.expires_at) });
    } catch (err) {
      if (isMissingTable(err)) { res.status(404).json({ error: "invalid_invite" }); return; }
      console.error("[education-censor] claim failed:", (err as Error).message);
      res.status(500).json({ error: "claim_failed" });
    }
  });

  router.get("/education/censor/view", async (req, res) => {
    try {
      const sess = await resolveCensorSession(pool, req.headers["x-censor-token"] as string | undefined);
      if (!sess) { res.status(401).json({ error: "unauthorized" }); return; }
      const { cohortId, inviteId } = sess;

      const [cohort, students, assignments, submissions, censorGrades] = await Promise.all([
        pool.query(`SELECT name FROM role_room_education_cohorts WHERE id = $1`, [cohortId]),
        pool.query(`SELECT id, name FROM role_room_education_students WHERE cohort_id = $1 AND status = 'active' ORDER BY created_at ASC`, [cohortId]),
        pool.query(`SELECT id, title FROM role_room_education_assignments WHERE cohort_id = $1 AND status = 'published' ORDER BY created_at ASC`, [cohortId]),
        pool.query(
          `SELECT s.student_id, s.assignment_id, s.status, s.grade, s.feedback
             FROM role_room_education_submissions s
             JOIN role_room_education_assignments a ON a.id = s.assignment_id
            WHERE a.cohort_id = $1`,
          [cohortId],
        ),
        pool.query(`SELECT student_id, assignment_id, grade, feedback FROM role_room_education_censor_grades WHERE invite_id = $1`, [inviteId]),
      ]);

      const subMap = new Map<string, Record<string, unknown>>();
      for (const s of submissions.rows) subMap.set(`${s.student_id}:${s.assignment_id}`, s);
      const cenMap = new Map<string, Record<string, unknown>>();
      for (const g of censorGrades.rows) cenMap.set(`${g.student_id}:${g.assignment_id}`, g);

      const assignmentRows = assignments.rows;
      res.json({
        cohortName: (cohort.rows[0]?.name as string) ?? null,
        students: students.rows.map((st) => ({
          studentId: String(st.id),
          name: (st.name as string) ?? "",
          assignments: assignmentRows.map((a) => {
            const sub = subMap.get(`${st.id}:${a.id}`);
            const cen = cenMap.get(`${st.id}:${a.id}`);
            return {
              assignmentId: String(a.id),
              title: (a.title as string) ?? "",
              submissionStatus: (sub?.status as string) ?? "not_started",
              teacherGrade: (sub?.grade as string) ?? null,
              teacherFeedback: (sub?.feedback as string) ?? null,
              censorGrade: (cen?.grade as string) ?? null,
              censorFeedback: (cen?.feedback as string) ?? null,
            };
          }),
        })),
      });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ cohortName: null, students: [] }); return; }
      console.error("[education-censor] view failed:", (err as Error).message);
      res.status(500).json({ error: "view_failed" });
    }
  });

  router.put("/education/censor/grade", async (req, res) => {
    try {
      const sess = await resolveCensorSession(pool, req.headers["x-censor-token"] as string | undefined);
      if (!sess) { res.status(401).json({ error: "unauthorized" }); return; }
      const body = (req.body ?? {}) as { studentId?: string; assignmentId?: string; grade?: string; feedback?: string };
      const studentId = typeof body.studentId === "string" ? body.studentId : "";
      const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : "";
      if (!studentId || !assignmentId) { res.status(400).json({ error: "invalid_grade" }); return; }
      // Sikre at student + oppgave hører til sesjonens kull.
      const ok = await pool.query(
        `SELECT 1 FROM role_room_education_students st, role_room_education_assignments a
          WHERE st.id = $1 AND a.id = $2 AND st.cohort_id = $3 AND a.cohort_id = $3`,
        [studentId, assignmentId, sess.cohortId],
      );
      if (ok.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      const id = newEntityId("edcg");
      await pool.query(
        `INSERT INTO role_room_education_censor_grades (id, invite_id, student_id, assignment_id, owner_user_id, grade, feedback)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (invite_id, student_id, assignment_id)
         DO UPDATE SET grade = EXCLUDED.grade, feedback = EXCLUDED.feedback, updated_at = now()`,
        [id, sess.inviteId, studentId, assignmentId, sess.ownerUserId, body.grade?.trim() || null, body.feedback?.trim() || null],
      );
      res.json({ success: true });
    } catch (err) {
      console.error("[education-censor] grade failed:", (err as Error).message);
      res.status(500).json({ error: "grade_failed" });
    }
  });

  return router;
}
