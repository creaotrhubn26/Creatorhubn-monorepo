/**
 * role-room-education-assessment-routes.ts — mountes under /api/role-room.
 *
 * Opplæringslag 4 (del 1): FORMATIV VURDERING. Les-only aggregering + eksport.
 * Selve skrivingen (feedback/grade/status) går via den eksisterende
 * PUT /education/assignments/:id/submissions (én skriver). Her:
 *   - GET  /education/assessment/queue     — alle innleveringer til vurdering
 *   - GET  /education/assessment/export    — CSV til skolens LMS/karaktersystem
 *
 * 🔑 Role Room er IKKE en gradebook — dette er formativ, produksjonsnær
 * vurdering; karakteren eksporteres til skolens eksisterende system.
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

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

export interface AssessmentItemView {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  learningGoals: string | null;
  cohortId: string | null;
  cohortName: string | null;
  studentId: string;
  studentName: string;
  productionProjectId: string | null;
  status: string;
  grade: string | null;
  feedback: string | null;
  link: string | null;
  isArbeidskrav: boolean;
  vurderingsform: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

function isoOrNull(v: unknown): string | null {
  return v ? new Date(v as string).toISOString() : null;
}

function rowToItem(r: Record<string, unknown>): AssessmentItemView {
  return {
    submissionId: String(r.submission_id),
    assignmentId: String(r.assignment_id),
    assignmentTitle: (r.assignment_title as string) ?? "",
    learningGoals: (r.learning_goals as string) ?? null,
    cohortId: r.cohort_id ? String(r.cohort_id) : null,
    cohortName: (r.cohort_name as string) ?? null,
    studentId: String(r.student_id),
    studentName: (r.student_name as string) ?? "",
    productionProjectId: (r.production_project_id as string) ?? null,
    status: (r.status as string) ?? "submitted",
    grade: (r.grade as string) ?? null,
    feedback: (r.feedback as string) ?? null,
    link: (r.link as string) ?? null,
    isArbeidskrav: Boolean(r.is_arbeidskrav),
    vurderingsform: (r.vurderingsform as string) ?? null,
    submittedAt: isoOrNull(r.submitted_at),
    reviewedAt: isoOrNull(r.reviewed_at),
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

/** RFC4180-sikker CSV-celle. */
function csvCell(v: string | null): string {
  const s = (v ?? "").replace(/\r?\n/g, " ").trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CreateEducationAssessmentRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationAssessmentRouter(
  pool: Pool,
  deps: CreateEducationAssessmentRouterDeps = {},
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

  // Alle innleveringer som er levert eller vurdert, på tvers av oppgaver.
  const queryItems = async (owner: string, cohortId: string | null): Promise<AssessmentItemView[]> => {
    const r = await pool.query(
      `SELECT s.id AS submission_id, s.assignment_id, s.student_id, s.status,
              s.grade, s.feedback, s.link, s.submitted_at, s.reviewed_at,
              st.name AS student_name,
              a.title AS assignment_title, a.learning_goals, a.cohort_id,
              a.is_arbeidskrav, a.vurderingsform,
              c.name AS cohort_name,
              prod.project_id AS production_project_id
         FROM role_room_education_submissions s
         JOIN role_room_education_assignments a ON a.id = s.assignment_id AND a.owner_user_id = $1
         JOIN role_room_education_students st ON st.id = s.student_id
         LEFT JOIN role_room_education_cohorts c ON c.id = a.cohort_id
         LEFT JOIN role_room_education_productions prod ON prod.id = a.production_id
        WHERE s.owner_user_id = $1
          AND s.status IN ('submitted','reviewed')
          AND ($2::text IS NULL OR a.cohort_id = $2)
        ORDER BY (s.status = 'submitted') DESC, s.submitted_at DESC NULLS LAST`,
      [owner, cohortId],
    );
    return r.rows.map(rowToItem);
  };

  router.get("/education/assessment/queue", requireAuth, async (req, res) => {
    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : null;
    try {
      res.json({ items: await queryItems(uid(req), cohortId) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ items: [] }); return; }
      console.warn("[education-assessment] queue failed:", (err as Error).message);
      res.json({ items: [] });
    }
  });

  router.get("/education/assessment/export", requireAuth, async (req, res) => {
    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : null;
    try {
      const items = await queryItems(uid(req), cohortId);
      const header = ["Kull", "Oppgave", "Student", "Status", "Karakter", "Tilbakemelding", "Levert", "Vurdert"];
      const lines = [header.join(",")];
      for (const it of items) {
        lines.push([
          csvCell(it.cohortName),
          csvCell(it.assignmentTitle),
          csvCell(it.studentName),
          csvCell(it.status === "reviewed" ? "Vurdert" : "Levert"),
          csvCell(it.grade),
          csvCell(it.feedback),
          csvCell(it.submittedAt ? it.submittedAt.slice(0, 10) : null),
          csvCell(it.reviewedAt ? it.reviewedAt.slice(0, 10) : null),
        ].join(","));
      }
      const csv = "﻿" + lines.join("\r\n"); // BOM så Excel leser æøå riktig
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="vurdering.csv"');
      res.send(csv);
    } catch (err) {
      console.error("[education-assessment] export failed:", (err as Error).message);
      res.status(500).json({ error: "export_failed" });
    }
  });

  return router;
}
