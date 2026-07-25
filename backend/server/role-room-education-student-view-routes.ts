/**
 * role-room-education-student-view-routes.ts — mountes under /api/role-room.
 *
 * Studentens «Min side» (les-only): produksjoner, oppgaver og tilbakemelding for
 * ÉN student — pluss student-innlogging (claim → isolert studentsesjon).
 *
 * Endepunkter:
 *   POST /api/role-room/education/student/claim   (offentlig; invite-token → studentsesjon)
 *   GET  /api/role-room/education/student/view     (2 auth-veier, se under)
 *
 * Auth for GET view:
 *   - x-student-token: isolert studentsesjon → studentens EGEN visning (ignorerer studentId)
 *   - Authorization: Bearer: eier-faglærer ELLER super admin, m/ ?studentId= (preview)
 *
 * 🔑 Studentsesjonen er bevisst SEPARAT fra creatorhub_auth_sessions
 * (role_room_education_student_sessions) → null blast-radius mot hoved-auth.
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

/** Slår opp en isolert studentsesjon (gyldig + ikke utløpt) → studentId. */
async function resolveStudentSession(pool: Pool, token: string | undefined): Promise<string | null> {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t) return null;
  const r = await pool.query(
    `UPDATE role_room_education_student_sessions
        SET last_seen_at = now()
      WHERE token = $1 AND expires_at > now()
      RETURNING student_id`,
    [t],
  );
  return r.rows[0] ? String(r.rows[0].student_id) : null;
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

  // Setter sammen hele «Min side»-payloaden for en gitt student-rad.
  const assembleView = async (student: Record<string, unknown>) => {
    const studentId = String(student.id);
    const cohortId = student.cohort_id ? String(student.cohort_id) : null;

    // Studenten ser KUN produksjonene faglærer har tildelt dem (skole-styrt
    // RBAC), med sin egen rolle.
    const prodRes = await pool.query(
      `SELECT p.id, p.title, p.project_id, cp.status AS project_status, m.role AS member_role
         FROM role_room_education_production_members m
         JOIN role_room_education_productions p ON p.id = m.production_id
         LEFT JOIN casting_projects cp ON cp.id = p.project_id
        WHERE m.student_id = $1
        ORDER BY p.created_at DESC`,
      [studentId],
    );

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

    return {
      student: {
        id: studentId,
        name: (student.name as string) ?? "",
        cohortId,
        cohortName: (student.cohort_name as string) ?? null,
      },
      productions: prodRes.rows.map((p) => ({
        id: String(p.id),
        title: (p.title as string) ?? "",
        projectId: String(p.project_id),
        projectStatus: (p.project_status as string) ?? null,
        role: (p.member_role as string) ?? "contributor",
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
    };
  };

  const loadStudent = async (studentId: string): Promise<Record<string, unknown> | null> => {
    const sr = await pool.query(
      `SELECT s.id, s.name, s.owner_user_id, s.cohort_id, c.name AS cohort_name
         FROM role_room_education_students s
         LEFT JOIN role_room_education_cohorts c ON c.id = s.cohort_id
        WHERE s.id = $1`,
      [studentId],
    );
    return sr.rows[0] ?? null;
  };

  // ── Claim: invite-token → isolert studentsesjon (OFFENTLIG) ──────────────
  router.post("/education/student/claim", async (req, res) => {
    const body = (req.body ?? {}) as { token?: string };
    const inviteToken = typeof body.token === "string" ? body.token.trim() : "";
    if (!inviteToken) { res.status(400).json({ error: "token_required" }); return; }
    try {
      const inv = await pool.query(
        `SELECT id, student_id, owner_user_id, status
           FROM role_room_education_student_invites
          WHERE token = $1`,
        [inviteToken],
      );
      const invite = inv.rows[0];
      if (!invite || invite.status === "revoked") { res.status(404).json({ error: "invalid_invite" }); return; }

      // Marker akseptert (idempotent — tillater re-claim).
      await pool.query(
        `UPDATE role_room_education_student_invites
            SET status = 'accepted', accepted_at = COALESCE(accepted_at, now()), updated_at = now()
          WHERE id = $1`,
        [invite.id],
      );

      const sessionToken = crypto.randomBytes(24).toString("hex");
      await pool.query(
        `INSERT INTO role_room_education_student_sessions (token, student_id, owner_user_id)
         VALUES ($1,$2,$3)`,
        [sessionToken, invite.student_id, invite.owner_user_id],
      );

      const student = await loadStudent(String(invite.student_id));
      res.status(201).json({
        sessionToken,
        student: student
          ? { id: String(student.id), name: (student.name as string) ?? "", cohortName: (student.cohort_name as string) ?? null }
          : null,
      });
    } catch (err) {
      if (isMissingTable(err)) { res.status(404).json({ error: "invalid_invite" }); return; }
      console.error("[education-student-claim] failed:", (err as Error).message);
      res.status(500).json({ error: "claim_failed" });
    }
  });

  // ── «Min side» ────────────────────────────────────────────────────────────
  router.get("/education/student/view", async (req, res) => {
    try {
      // Vei 1: isolert studentsesjon → studentens EGEN visning.
      const studentToken = req.headers["x-student-token"];
      if (typeof studentToken === "string" && studentToken.trim()) {
        const studentId = await resolveStudentSession(pool, studentToken);
        if (!studentId) { res.status(401).json({ error: "unauthorized" }); return; }
        const student = await loadStudent(studentId);
        if (!student) { res.status(404).json({ error: "not_found" }); return; }
        res.json(await assembleView(student));
        return;
      }

      // Vei 2: Bearer (eier-faglærer / super admin preview) + ?studentId=.
      const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
      const session = await resolveUser(pool, deps.activeSessions, bearer);
      if (!session?.userId) { res.status(401).json({ error: "unauthorized" }); return; }
      const studentId = typeof req.query.studentId === "string" ? req.query.studentId : "";
      if (!studentId) { res.status(400).json({ error: "student_id_required" }); return; }
      const student = await loadStudent(studentId);
      if (!student) { res.status(404).json({ error: "not_found" }); return; }
      if (String(student.owner_user_id) !== session.userId && !isSuperAdmin(session)) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json(await assembleView(student));
    } catch (err) {
      if (isMissingTable(err)) { res.json({ student: null, productions: [], assignments: [] }); return; }
      console.error("[education-student-view] failed:", (err as Error).message);
      res.status(500).json({ error: "view_failed" });
    }
  });

  // ── Produksjons-hub (student-token; RBAC-scopet, les-only) ────────────────
  // Studenten åpner en produksjon de er TILDELT (steg 3a-membership). Viser
  // prosjektinfo + rolle + medstudenter + oppgaver — uten å slippe student-
  // token inn i selve casting-planner-API-et (trygt, isolert).
  router.get("/education/student/production/:productionId", async (req, res) => {
    try {
      const studentId = await resolveStudentSession(pool, req.headers["x-student-token"] as string | undefined);
      if (!studentId) { res.status(401).json({ error: "unauthorized" }); return; }
      const productionId = req.params.productionId;

      // RBAC: studenten MÅ være tildelt denne produksjonen.
      const mem = await pool.query(
        `SELECT role FROM role_room_education_production_members
          WHERE production_id = $1 AND student_id = $2`,
        [productionId, studentId],
      );
      if (mem.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      const myRole = (mem.rows[0].role as string) ?? "contributor";

      const pr = await pool.query(
        `SELECT p.id, p.title, p.project_id, cp.name AS project_name, cp.status AS project_status, cp.description AS project_description
           FROM role_room_education_productions p
           LEFT JOIN casting_projects cp ON cp.id = p.project_id
          WHERE p.id = $1`,
        [productionId],
      );
      const prod = pr.rows[0];
      if (!prod) { res.status(404).json({ error: "not_found" }); return; }

      const teammates = await pool.query(
        `SELECT st.name AS name, m.role AS role, (st.id = $2) AS is_me
           FROM role_room_education_production_members m
           JOIN role_room_education_students st ON st.id = m.student_id
          WHERE m.production_id = $1
          ORDER BY st.created_at ASC`,
        [productionId, studentId],
      );

      const asg = await pool.query(
        `SELECT a.id, a.title, a.due_at,
                sub.status AS sub_status, sub.grade AS grade, sub.feedback AS feedback
           FROM role_room_education_assignments a
           LEFT JOIN role_room_education_submissions sub
                  ON sub.assignment_id = a.id AND sub.student_id = $2
          WHERE a.production_id = $1 AND a.status = 'published'
          ORDER BY a.due_at ASC NULLS LAST, a.created_at DESC`,
        [productionId, studentId],
      );

      res.json({
        production: {
          id: String(prod.id),
          title: (prod.title as string) ?? "",
          projectId: String(prod.project_id),
          projectName: (prod.project_name as string) ?? null,
          projectStatus: (prod.project_status as string) ?? null,
          projectDescription: (prod.project_description as string) ?? null,
          myRole,
        },
        teammates: teammates.rows.map((t) => ({
          name: (t.name as string) ?? "",
          role: (t.role as string) ?? "contributor",
          isMe: Boolean(t.is_me),
        })),
        assignments: asg.rows.map((a) => ({
          id: String(a.id),
          title: (a.title as string) ?? "",
          dueAt: isoOrNull(a.due_at),
          submissionStatus: (a.sub_status as string) ?? "not_started",
          grade: (a.grade as string) ?? null,
          feedback: (a.feedback as string) ?? null,
        })),
      });
    } catch (err) {
      if (isMissingTable(err)) { res.status(404).json({ error: "not_found" }); return; }
      console.error("[education-student-production] failed:", (err as Error).message);
      res.status(500).json({ error: "production_failed" });
    }
  });

  return router;
}
