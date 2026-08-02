/**
 * role-room-education-student-invites-routes.ts — mountes under /api/role-room.
 *
 * Faglærer-siden av student-innlogging: klargjør studenttilgang per student
 * (engangs-token) og spor status. Owner-scopet. Selve innloggingen (claim →
 * isolert studentsesjon) + student-flaten kommer i egen skive.
 *
 * Endepunkter:
 *   GET    /api/role-room/education/cohorts/:id/invites   (status per student i kullet)
 *   POST   /api/role-room/education/students/:id/invite   (klargjør/regenerer token)
 *   DELETE /api/role-room/education/students/:id/invite   (trekk tilbake)
 *
 * Auth: Bearer-token → resolveUser (samme mønster som education-cohorts-routes).
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
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

export interface StudentInviteView {
  studentId: string;
  status: string; // pending | accepted | revoked | none
  token: string | null;
  acceptedAt: string | null;
  createdAt: string | null;
}

function isoOrNull(v: unknown): string | null {
  return v ? new Date(v as string).toISOString() : null;
}

function inviteRowToView(r: Record<string, unknown>): StudentInviteView {
  return {
    studentId: String(r.student_id),
    status: (r.status as string) ?? "none",
    token: (r.token as string) ?? null,
    acceptedAt: isoOrNull(r.accepted_at),
    createdAt: isoOrNull(r.created_at),
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

export interface CreateEducationStudentInvitesRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationStudentInvitesRouter(
  pool: Pool,
  deps: CreateEducationStudentInvitesRouterDeps = {},
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

  // Bekreft eierskap av studenten; returner raden (m/ email) eller null.
  const ownedStudent = async (id: string, owner: string): Promise<Record<string, unknown> | null> => {
    const r = await pool.query(
      `SELECT id, email FROM role_room_education_students WHERE id = $1 AND owner_user_id = $2`,
      [id, owner],
    );
    return r.rows[0] ?? null;
  };

  // Status per student i et kull (LEFT JOIN → syntetisk 'none' uten invitasjon).
  router.get("/education/cohorts/:id/invites", requireAuth, async (req, res) => {
    try {
      const owns = await pool.query(
        `SELECT 1 FROM role_room_education_cohorts WHERE id = $1 AND owner_user_id = $2`,
        [req.params.id, uid(req)],
      );
      if (owns.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      const r = await pool.query(
        `SELECT st.id AS student_id,
                COALESCE(inv.status, 'none') AS status,
                inv.token AS token, inv.accepted_at AS accepted_at, inv.created_at AS created_at
           FROM role_room_education_students st
           LEFT JOIN role_room_education_student_invites inv ON inv.student_id = st.id
          WHERE st.cohort_id = $1 AND st.status = 'active'
          ORDER BY st.created_at ASC`,
        [req.params.id],
      );
      res.json({ invites: r.rows.map(inviteRowToView) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ invites: [] }); return; }
      console.warn("[education-student-invites] list failed:", (err as Error).message);
      res.json({ invites: [] });
    }
  });

  router.post("/education/students/:id/invite", requireAuth, async (req, res) => {
    try {
      const student = await ownedStudent(req.params.id, uid(req));
      if (!student) { res.status(404).json({ error: "not_found" }); return; }
      const id = newEntityId("edinv");
      const token = crypto.randomBytes(24).toString("hex");
      // Regenererer token og nullstiller status hvis invitasjon finnes (upsert på student_id).
      const r = await pool.query(
        `INSERT INTO role_room_education_student_invites (id, owner_user_id, student_id, token, status, email)
         VALUES ($1,$2,$3,$4,'pending',$5)
         ON CONFLICT (student_id)
         DO UPDATE SET token = EXCLUDED.token, status = 'pending', accepted_at = NULL,
                       email = EXCLUDED.email, updated_at = now()
         RETURNING *`,
        [id, uid(req), req.params.id, token, (student.email as string) || null],
      );
      res.status(201).json({ invite: inviteRowToView(r.rows[0]) });
    } catch (err) {
      console.error("[education-student-invites] create failed:", (err as Error).message);
      res.status(500).json({ error: "invite_failed" });
    }
  });

  router.delete("/education/students/:id/invite", requireAuth, async (req, res) => {
    try {
      const student = await ownedStudent(req.params.id, uid(req));
      if (!student) { res.status(404).json({ error: "not_found" }); return; }
      const r = await pool.query(
        `DELETE FROM role_room_education_student_invites WHERE student_id = $1 AND owner_user_id = $2 RETURNING id`,
        [req.params.id, uid(req)],
      );
      if (r.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[education-student-invites] delete failed:", (err as Error).message);
      res.status(500).json({ error: "delete_failed" });
    }
  });

  return router;
}
