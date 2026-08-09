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
import { newEntityId } from "./_shared-ids.js";
import { createDeliverable } from "./role-room-deliverables.js";
import { resolveEducationProductionRole } from "./role-room-education-production-access.js";

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

/**
 * En ekte-konto-education-student: matcher innlogget brukers users.email mot
 * education-studentens e-post. Returnerer student-id, ellers null (ingen kobling
 * / feil). Fail-closed. Gjør at en LTI-student (ekte Bearer-sesjon, ingen
 * x-student-token) kan se SIN EGEN «Min side».
 */
export async function resolveEducationStudentByUser(pool: Pool, userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const r = await pool.query(
      `SELECT s.id
         FROM role_room_education_students s
         JOIN users u ON lower(u.email) = lower(s.email)
        WHERE u.id = $1
        ORDER BY s.created_at DESC
        LIMIT 1`,
      [userId],
    );
    return r.rows[0] ? String(r.rows[0].id) : null;
  } catch (err) {
    if (isMissingTable(err)) return null;
    console.error("[education-student-view] resolveByUser failed (fail-closed):", (err as Error).message);
    return null;
  }
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
                  sub.link AS link, sub.submitted_at AS submitted_at, sub.reviewed_at AS reviewed_at
             FROM role_room_education_assignments a
             LEFT JOIN role_room_education_productions prod ON prod.id = a.production_id
             LEFT JOIN role_room_education_submissions sub
                    ON sub.assignment_id = a.id AND sub.student_id = $2
            WHERE a.cohort_id = $1 AND a.status = 'published'
            ORDER BY a.due_at ASC NULLS LAST, a.created_at DESC`,
          [cohortId, studentId],
        )
      : { rows: [] as Record<string, unknown>[] };

    // Rubrikk-nedbrytning per oppgave (transparens): kriterier + studentens nivå
    // + koblet læringsmål. Vises kun der faglærer har scoret (jf. frontend).
    const rubricRes = cohortId
      ? await pool.query(
          `SELECT c.assignment_id, c.title AS criterion_title, c.sort_order,
                  g.title AS goal_title,
                  rs.level AS level, (rs.id IS NOT NULL) AS scored
             FROM role_room_education_rubric_criteria c
             JOIN role_room_education_assignments a ON a.id = c.assignment_id
             LEFT JOIN role_room_education_learning_goals g ON g.id = c.learning_goal_id
             LEFT JOIN role_room_education_rubric_scores rs
                    ON rs.criterion_id = c.id AND rs.student_id = $2
            WHERE a.cohort_id = $1
            ORDER BY c.sort_order ASC, c.created_at ASC`,
          [cohortId, studentId],
        )
      : { rows: [] as Record<string, unknown>[] };

    const rubricByAssignment = new Map<string, { criteria: { title: string; goalTitle: string | null; level: number }[]; scoredCount: number }>();
    for (const row of rubricRes.rows) {
      const aid = String(row.assignment_id);
      if (!rubricByAssignment.has(aid)) rubricByAssignment.set(aid, { criteria: [], scoredCount: 0 });
      const entry = rubricByAssignment.get(aid)!;
      const scored = Boolean(row.scored);
      entry.criteria.push({ title: (row.criterion_title as string) ?? "", goalTitle: (row.goal_title as string) ?? null, level: Number(row.level ?? 0) });
      if (scored) entry.scoredCount += 1;
    }
    const rubricFor = (assignmentId: string) => {
      const e = rubricByAssignment.get(assignmentId);
      if (!e || e.scoredCount === 0) return null; // vis kun når vurdert
      const total = e.criteria.reduce((s, c) => s + c.level, 0);
      const max = e.criteria.length * 2;
      return { criteria: e.criteria, pct: max ? Math.round((total / max) * 100) : 0 };
    };

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
        link: (a.link as string) ?? null,
        submittedAt: isoOrNull(a.submitted_at),
        reviewedAt: isoOrNull(a.reviewed_at),
        rubric: rubricFor(String(a.id)),
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
    const body = (req.body ?? {}) as { token?: string; email?: string };
    const inviteToken = typeof body.token === "string" ? body.token.trim() : "";
    const claimEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!inviteToken) { res.status(400).json({ error: "token_required" }); return; }
    try {
      const inv = await pool.query(
        `SELECT id, student_id, owner_user_id, status, email, expires_at
           FROM role_room_education_student_invites
          WHERE token = $1`,
        [inviteToken],
      );
      const invite = inv.rows[0];
      if (!invite || invite.status === "revoked") { res.status(404).json({ error: "invalid_invite" }); return; }
      // Utløp håndheves kun for ikke-aksepterte invitasjoner (aksepterte = varig re-claim).
      if (invite.status !== "accepted" && invite.expires_at && new Date(invite.expires_at as string) < new Date()) {
        res.status(404).json({ error: "invalid_invite" }); return;
      }
      // E-post-verifisering: invitasjon utstedt til en bestemt e-post kan bare
      // løses inn av eier av den e-posten (mot lekket/videresendt lenke).
      const inviteEmail = typeof invite.email === "string" ? invite.email.trim().toLowerCase() : "";
      if (inviteEmail) {
        if (!claimEmail) { res.status(400).json({ error: "email_required" }); return; }
        if (claimEmail !== inviteEmail) { res.status(403).json({ error: "email_mismatch" }); return; }
      }

      // Marker akseptert (idempotent — tillater re-claim).
      await pool.query(
        `UPDATE role_room_education_student_invites
            SET status = 'accepted', accepted_at = COALESCE(accepted_at, now()), updated_at = now()
          WHERE id = $1`,
        [invite.id],
      );

      const sessionToken = crypto.randomBytes(24).toString("hex");
      await pool.query(
        `INSERT INTO role_room_education_student_sessions (token, student_id, owner_user_id, expires_at)
         VALUES ($1,$2,$3, now() + INTERVAL '30 days')`,
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
        res.json({ ...(await assembleView(student)), canOpenProduction: false });
        return;
      }

      // Vei 2: Bearer.
      const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
      const session = await resolveUser(pool, deps.activeSessions, bearer);
      if (!session?.userId) { res.status(401).json({ error: "unauthorized" }); return; }
      const queryStudentId = typeof req.query.studentId === "string" ? req.query.studentId : "";
      if (!queryStudentId) {
        // Vei 2a: brukeren ER en education-student (ekte konto) → egen visning.
        const ownId = await resolveEducationStudentByUser(pool, session.userId);
        if (!ownId) { res.status(404).json({ error: "no_student_profile" }); return; }
        const ownStudent = await loadStudent(ownId);
        if (!ownStudent) { res.status(404).json({ error: "not_found" }); return; }
        res.json({ ...(await assembleView(ownStudent)), canOpenProduction: true });
        return;
      }
      // Vei 2b: faglærer/super-admin preview (?studentId=) — uendret.
      const student = await loadStudent(queryStudentId);
      if (!student) { res.status(404).json({ error: "not_found" }); return; }
      if (String(student.owner_user_id) !== session.userId && !isSuperAdmin(session)) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ ...(await assembleView(student)), canOpenProduction: false });
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
      let studentId = await resolveStudentSession(pool, req.headers["x-student-token"] as string | undefined);
      if (!studentId) {
        const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
        const session = await resolveUser(pool, deps.activeSessions, bearer);
        if (session?.userId) studentId = await resolveEducationStudentByUser(pool, session.userId);
      }
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

  // ── Student leverer (isolert sesjon) ─────────────────────────────────────
  router.put("/education/student/assignment/:assignmentId/submit", async (req, res) => {
    try {
      // Resolve student (x-student-token ELLER Bearer-ekte-konto).
      let studentId = await resolveStudentSession(pool, req.headers["x-student-token"] as string | undefined);
      let usersId: string | null = null;
      if (!studentId) {
        const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
        const session = await resolveUser(pool, deps.activeSessions, bearer);
        if (session?.userId) { usersId = session.userId; studentId = await resolveEducationStudentByUser(pool, session.userId); }
      }
      if (!studentId) { res.status(401).json({ error: "unauthorized" }); return; }
      const student = await loadStudent(studentId);
      if (!student) { res.status(404).json({ error: "not_found" }); return; }
      const body = (req.body ?? {}) as { link?: string; note?: string };
      const link = typeof body.link === "string" ? body.link.trim() || null : null;
      const note = typeof body.note === "string" ? body.note.trim() || null : null;
      // Oppgave MÅ tilhøre kullet + være publisert; hent koblet produksjon + tittel.
      const asg = await pool.query(
        `SELECT a.title,
                (SELECT project_id FROM role_room_education_productions WHERE id = a.production_id) AS production_project_id
           FROM role_room_education_assignments a
          WHERE a.id = $1 AND a.cohort_id = $2 AND a.status = 'published'`,
        [req.params.assignmentId, student.cohort_id],
      );
      if (asg.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      const productionProjectId = asg.rows[0].production_project_id ? String(asg.rows[0].production_project_id) : null;
      const assignmentTitle = String(asg.rows[0].title ?? "Oppgave");

      // Gjenbruk ev. leveranse fra en tidligere innsending (re-submit MÅ IKKE
      // duplisere leveransen og foreldreløs-gjøre lærerens vurdering, spec §59).
      const prevSub = await pool.query(
        `SELECT deliverable_id FROM role_room_education_submissions WHERE assignment_id = $1 AND student_id = $2`,
        [req.params.assignmentId, studentId],
      );
      let deliverableId: string | null = prevSub.rows[0]?.deliverable_id ? String(prevSub.rows[0].deliverable_id) : null;

      // Opprett ekte leveranse KUN for ekte-konto-student m/ bro-rolle, og KUN
      // når det ikke alt finnes en leveranse fra en tidligere innsending.
      if (!deliverableId && usersId && productionProjectId) {
        const role = await resolveEducationProductionRole(pool, usersId, productionProjectId);
        if (role) {
          const d = await createDeliverable(pool, {
            projectId: productionProjectId,
            title: assignmentTitle,
            assigneeUserId: usersId,
            assigneeLabel: String(student.name ?? ""),
            status: "internal_review",
            phase: "postproduction",
            createdByUserId: usersId,
          });
          deliverableId = d?.id ?? null;
        }
      }

      const id = newEntityId("edsub");
      const r = await pool.query(
        `INSERT INTO role_room_education_submissions
           (id, assignment_id, student_id, owner_user_id, status, link, note, deliverable_id, submitted_at)
         VALUES ($1,$2,$3,$4,'submitted',$5,$6,$7, now())
         ON CONFLICT (assignment_id, student_id)
         DO UPDATE SET status = CASE WHEN role_room_education_submissions.status = 'reviewed' THEN 'reviewed' ELSE 'submitted' END,
                       link = EXCLUDED.link,
                       note = COALESCE(EXCLUDED.note, role_room_education_submissions.note),
                       deliverable_id = COALESCE(EXCLUDED.deliverable_id, role_room_education_submissions.deliverable_id),
                       submitted_at = COALESCE(role_room_education_submissions.submitted_at, EXCLUDED.submitted_at),
                       updated_at = now()
         RETURNING status, link`,
        [id, req.params.assignmentId, studentId, student.owner_user_id, link, note, deliverableId],
      );
      res.json({ status: (r.rows[0]?.status as string) ?? "submitted", link: (r.rows[0]?.link as string) ?? null });
    } catch (err) {
      console.error("[education-student-submit] failed:", (err as Error).message);
      res.status(500).json({ error: "submit_failed" });
    }
  });

  return router;
}
