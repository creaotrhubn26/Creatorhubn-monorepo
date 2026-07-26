/**
 * role-room-education-talent-pipeline-routes.ts — mountes under /api/role-room.
 *
 * «Avgangs-pipeline»: bro fra utdannings-workspace → Role Room Talents (talent
 * registry). Speiler bransje-standarden (Spotlight Graduate Scheme + digital
 * showcase): skolen promoterer en avgangsstudent → en CLAIMABLE talent-profil
 * (owner_user_id NULL) forhåndsfylt med showreel (fra portefølje) + skole-
 * verifisert studie-credential. Studenten CLAIMER profilen (matchende e-post)
 * og styrer den selv + samtykke. Alt owner-scopet på skole-siden.
 *
 * Prinsipper: samtykke først · student eier / skole verifiserer · gjenbruk
 * showreel · én identitet (student.talent_id) · GDPR-trygt (claimable, ikke
 * synlig i agency-search før studenten selv gir consent).
 *
 * Endepunkter:
 *   POST /api/role-room/education/students/:id/promote-to-talent
 *   GET  /api/role-room/education/talent-pipeline?cohortId=
 *   GET  /api/role-room/education/cohorts/:id/showcase
 *   POST /api/role-room/education/talent/claim
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

type AuthedRequest = Request & { userId: string; userEmail: string };

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

export interface PipelineRow {
  studentId: string;
  name: string;
  email: string | null;
  cohortId: string | null;
  talentId: string | null;
  status: "none" | "claimable" | "claimed";
  hasShowreel: boolean;
}

export interface CreateEducationTalentPipelineRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createEducationTalentPipelineRouter(
  pool: Pool,
  deps: CreateEducationTalentPipelineRouterDeps = {},
): ExpressRouter {
  const router = Router();

  const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    const session = await resolveUser(pool, deps.activeSessions, bearer);
    if (!session?.userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    (req as AuthedRequest).userId = session.userId;
    (req as AuthedRequest).userEmail = session.email ?? "";
    next();
  };
  const uid = (req: Request) => (req as AuthedRequest).userId;

  // Hent nyeste showreel-URL for en student (publisert portefølje foretrekkes).
  const resolveShowreel = async (studentId: string, portfolioId?: string): Promise<string | null> => {
    try {
      if (portfolioId) {
        const r = await pool.query(`SELECT url FROM role_room_education_portfolios WHERE id = $1 AND student_id = $2`, [portfolioId, studentId]);
        if (r.rows[0]?.url) return String(r.rows[0].url);
      }
      const r = await pool.query(
        `SELECT url FROM role_room_education_portfolios
          WHERE student_id = $1 AND url IS NOT NULL AND url <> ''
          ORDER BY (status = 'published') DESC, (kind = 'showreel') DESC, updated_at DESC
          LIMIT 1`,
        [studentId],
      );
      return r.rows[0]?.url ? String(r.rows[0].url) : null;
    } catch { return null; }
  };

  // ── Promoter avgangsstudent → claimable talent-profil ────────────────────
  router.post("/education/students/:id/promote-to-talent", requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as { institution?: string; program?: string; year?: number; showreelPortfolioId?: string };
    try {
      const stu = await pool.query(
        `SELECT s.*, c.program AS cohort_program, c.name AS cohort_name
           FROM role_room_education_students s
           LEFT JOIN role_room_education_cohorts c ON c.id = s.cohort_id
          WHERE s.id = $1 AND s.owner_user_id = $2`,
        [req.params.id, uid(req)],
      );
      const student = stu.rows[0];
      if (!student) { res.status(404).json({ error: "not_found" }); return; }
      if (student.talent_id) { res.json({ talentId: String(student.talent_id), alreadyPromoted: true }); return; }

      const showreel = await resolveShowreel(req.params.id, body.showreelPortfolioId);
      const year = Number.isInteger(body.year) ? body.year : new Date().getFullYear();
      const credential = {
        institution: (body.institution ?? "").trim() || null,
        program: (body.program ?? "").trim() || (student.cohort_program as string) || null,
        year,
        cohortId: student.cohort_id ?? null,
        verifiedByOwner: uid(req),
        verifiedAt: new Date().toISOString(),
        source: "education_workspace",
      };

      const ins = await pool.query(
        `INSERT INTO talents
           (owner_user_id, display_name, email, showreel_url, showreel_updated_at,
            profile_status, badges, metadata)
         VALUES (NULL, $1, $2, $3, ${showreel ? "now()" : "NULL"}, 'draft', $4::jsonb, $5::jsonb)
         RETURNING id`,
        [
          String(student.name),
          student.email ?? null,
          showreel,
          JSON.stringify(["education_verified"]),
          JSON.stringify({ education: credential }),
        ],
      );
      const talentId = String(ins.rows[0].id);
      await pool.query(`UPDATE role_room_education_students SET talent_id = $2 WHERE id = $1`, [req.params.id, talentId]);
      res.status(201).json({ talentId, claimable: true, hasShowreel: !!showreel });
    } catch (err) {
      if (isMissingTable(err)) { res.status(503).json({ error: "talents_unavailable" }); return; }
      console.error("[edu-talent-pipeline] promote failed:", (err as Error).message);
      res.status(500).json({ error: "promote_failed" });
    }
  });

  // ── Pipeline-status per student (skole-side oversikt) ─────────────────────
  router.get("/education/talent-pipeline", requireAuth, async (req, res) => {
    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : null;
    try {
      const params: unknown[] = [uid(req)];
      let cohortFilter = "";
      if (cohortId) { params.push(cohortId); cohortFilter = ` AND s.cohort_id = $${params.length}`; }
      const r = await pool.query(
        `SELECT s.id, s.name, s.email, s.cohort_id, s.talent_id,
                t.owner_user_id AS talent_owner, t.showreel_url AS talent_showreel
           FROM role_room_education_students s
           LEFT JOIN talents t ON t.id = s.talent_id
          WHERE s.owner_user_id = $1 AND s.status = 'active'${cohortFilter}
          ORDER BY s.created_at ASC`,
        params,
      );
      const rows: PipelineRow[] = r.rows.map((x) => ({
        studentId: String(x.id),
        name: (x.name as string) ?? "",
        email: (x.email as string) ?? null,
        cohortId: (x.cohort_id as string) ?? null,
        talentId: x.talent_id ? String(x.talent_id) : null,
        status: !x.talent_id ? "none" : (x.talent_owner ? "claimed" : "claimable"),
        hasShowreel: !!x.talent_showreel,
      }));
      res.json({ pipeline: rows });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ pipeline: [] }); return; }
      console.warn("[edu-talent-pipeline] list failed:", (err as Error).message);
      res.json({ pipeline: [] });
    }
  });

  // ── Avgangs-showcase for et kull (promoterte talenter m/ showreel) ────────
  router.get("/education/cohorts/:id/showcase", requireAuth, async (req, res) => {
    try {
      const owns = await pool.query(
        `SELECT 1 FROM role_room_education_cohorts WHERE id = $1 AND owner_user_id = $2`,
        [req.params.id, uid(req)],
      );
      if (owns.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      const r = await pool.query(
        `SELECT s.name AS student_name, t.id AS talent_id, t.display_name, t.showreel_url,
                t.headshot_url, t.profile_status, t.owner_user_id, t.badges, t.metadata
           FROM role_room_education_students s
           JOIN talents t ON t.id = s.talent_id
          WHERE s.cohort_id = $1 AND s.owner_user_id = $2
          ORDER BY t.display_name ASC`,
        [req.params.id, uid(req)],
      );
      const showcase = r.rows.map((x) => ({
        talentId: String(x.talent_id),
        name: (x.display_name as string) ?? (x.student_name as string) ?? "",
        showreelUrl: (x.showreel_url as string) ?? null,
        headshotUrl: (x.headshot_url as string) ?? null,
        profileStatus: (x.profile_status as string) ?? "draft",
        claimed: !!x.owner_user_id,
        credential: (x.metadata as { education?: unknown })?.education ?? null,
      }));
      res.json({ showcase });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ showcase: [] }); return; }
      console.warn("[edu-talent-pipeline] showcase failed:", (err as Error).message);
      res.json({ showcase: [] });
    }
  });

  // ── Student overtar (claimer) sin skole-opprettede talent-profil ─────────
  // Matcher på e-post; setter owner_user_id = innlogget bruker for claimable
  // (owner NULL) profiler opprettet av utdannings-workspacet.
  router.post("/education/talent/claim", requireAuth, async (req, res) => {
    const email = (req as AuthedRequest).userEmail;
    if (!email) { res.status(400).json({ error: "no_email" }); return; }
    try {
      const r = await pool.query(
        `UPDATE talents
            SET owner_user_id = $1, profile_status = CASE WHEN profile_status = 'draft' THEN 'active' ELSE profile_status END, updated_at = now()
          WHERE owner_user_id IS NULL
            AND lower(email) = lower($2)
            AND metadata->'education'->>'source' = 'education_workspace'
          RETURNING id`,
        [uid(req), email],
      );
      res.json({ claimed: r.rows.length, talentIds: r.rows.map((x) => String(x.id)) });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ claimed: 0, talentIds: [] }); return; }
      console.error("[edu-talent-pipeline] claim failed:", (err as Error).message);
      res.status(500).json({ error: "claim_failed" });
    }
  });

  return router;
}
