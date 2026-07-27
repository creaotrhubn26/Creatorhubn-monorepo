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

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

interface TalentAttrs {
  playingAgeMin: number | null;
  playingAgeMax: number | null;
  gender: string | null;
  city: string | null;
  heightCm: number | null;
  skills: string[];
  languages: string[];
  dialects: string[];
  nsfMember: boolean;
}

function normAttrs(raw: unknown): TalentAttrs {
  const a = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null; };
  const strList = (v: unknown) => Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => (x as string).trim()) : [];
  const str = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : null;
  return {
    playingAgeMin: num(a.playingAgeMin),
    playingAgeMax: num(a.playingAgeMax),
    gender: str(a.gender),
    city: str(a.city),
    heightCm: num(a.heightCm),
    skills: strList(a.skills),
    languages: strList(a.languages),
    dialects: strList(a.dialects),
    nsfMember: !!a.nsfMember,
  };
}

/** Prosjekterer attributter til talents' søkbare kolonner (+ badges). */
function attrsToTalentCols(n: TalentAttrs): { cols: Record<string, unknown>; badges: string[] } {
  const badges = ["education_verified"];
  if (n.nsfMember) badges.push("nsf_member");
  return {
    cols: {
      playing_age_min: n.playingAgeMin,
      playing_age_max: n.playingAgeMax,
      gender: n.gender,
      city: n.city,
      height_cm: n.heightCm,
      skills: JSON.stringify(n.skills.map((l) => ({ id: slug(l), label: l }))),
      languages: JSON.stringify(n.languages.map((l) => ({ label: l }))),
      dialects: JSON.stringify(n.dialects),
    },
    badges,
  };
}

/** «Søkbar» = har minst ett felt casting-søket filtrerer på. */
function isSearchable(n: TalentAttrs): boolean {
  return n.playingAgeMin != null || n.playingAgeMax != null || n.skills.length > 0 || n.languages.length > 0 || n.dialects.length > 0;
}

/**
 * Transparens (GDPR art. 13/14): forklaringen studenten leser FØR de bekrefter.
 * Informert samtykke krever at den registrerte forstår hva de sier ja til.
 */
export const ROLE_ROOM_TALENTS_INFO = {
  title: "Hva er Role Room Talents?",
  summary:
    "Role Room Talents er et talent-register der skuespillere kan bli funnet av byråer og casting-ansvarlige. Skolen din har opprettet et utkast til profil for deg med showreel og en verifisert bekreftelse på utdanningen din. Du bestemmer selv om du vil overta profilen — og ingen ser den før du aktivt gir samtykke.",
  dataShared: [
    "Navn og (valgfritt) kontaktinfo",
    "Showreel/portefølje fra studiet",
    "Skole-verifisert utdanning (institusjon, program, år)",
    "Casting-attributter du selv kan redigere (spillealder, ferdigheter, språk, dialekt)",
  ],
  visibility:
    "Profilen er USYNLIG for byråer/casting til du selv har overtatt den og gitt eksplisitt samtykke — per byrå. Du kan trekke samtykket når som helst.",
  yourRights: [
    "Overta (claim) profilen og styre den selv",
    "Avslå — da slettes utkastet",
    "Når du eier profilen: redigere, skjule eller slette den, og styre nøyaktig hvem som ser hva",
  ],
  controller: "Behandlingsansvarlig for selve registeret er The Role Room; skolen er ansvarlig for den verifiserte utdannings-bekreftelsen.",
};

export interface PipelineRow {
  studentId: string;
  name: string;
  email: string | null;
  cohortId: string | null;
  talentId: string | null;
  status: "none" | "claimable" | "claimed";
  hasShowreel: boolean;
  searchable: boolean;
  nsfMember: boolean;
  attributes: TalentAttrs;
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
    const body = (req.body ?? {}) as { institution?: string; program?: string; year?: number; showreelPortfolioId?: string; attributes?: unknown; consentAttested?: boolean };
    // Samtykke-først: faglærer MÅ attestere at studenten har samtykket før vi
    // oppretter en profil m/ studentens persondata (behandlingsgrunnlag + spor).
    if (body.consentAttested !== true) { res.status(400).json({ error: "consent_attestation_required" }); return; }
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
      // Studenten må ha e-post — det er slik de identifiseres for å bekrefte/avslå.
      if (!student.email) { res.status(400).json({ error: "student_email_required" }); return; }

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
      // Attributter: body overstyrer lagrede student-attributter.
      const attrs = normAttrs({ ...(student.talent_attributes as object ?? {}), ...((body.attributes as object) ?? {}) });
      const { cols, badges } = attrsToTalentCols(attrs);

      const ins = await pool.query(
        `INSERT INTO talents
           (owner_user_id, display_name, email, showreel_url, showreel_updated_at,
            profile_status, badges, metadata,
            playing_age_min, playing_age_max, gender, city, height_cm, skills, languages, dialects)
         VALUES (NULL, $1, $2, $3, ${showreel ? "now()" : "NULL"}, 'draft', $4::jsonb, $5::jsonb,
                 $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb)
         RETURNING id`,
        [
          String(student.name), student.email ?? null, showreel,
          JSON.stringify(badges), JSON.stringify({
            education: credential,
            consent: { status: "invited", attestedByOwner: uid(req), attestedAt: new Date().toISOString() },
          }),
          cols.playing_age_min, cols.playing_age_max, cols.gender, cols.city, cols.height_cm,
          cols.skills, cols.languages, cols.dialects,
        ],
      );
      const talentId = String(ins.rows[0].id);
      await pool.query(
        `UPDATE role_room_education_students SET talent_id = $2, talent_attributes = $3::jsonb WHERE id = $1`,
        [req.params.id, talentId, JSON.stringify(attrs)],
      );
      res.status(201).json({ talentId, claimable: true, hasShowreel: !!showreel, searchable: isSearchable(attrs) });
    } catch (err) {
      if (isMissingTable(err)) { res.status(503).json({ error: "talents_unavailable" }); return; }
      console.error("[edu-talent-pipeline] promote failed:", (err as Error).message);
      res.status(500).json({ error: "promote_failed" });
    }
  });

  // ── Sett/oppdater casting-attributter for en student (+ synk til talent) ──
  router.put("/education/students/:id/talent-attributes", requireAuth, async (req, res) => {
    const attrs = normAttrs((req.body ?? {}) as unknown);
    try {
      const stu = await pool.query(
        `SELECT talent_id FROM role_room_education_students WHERE id = $1 AND owner_user_id = $2`,
        [req.params.id, uid(req)],
      );
      if (stu.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      await pool.query(
        `UPDATE role_room_education_students SET talent_attributes = $2::jsonb WHERE id = $1`,
        [req.params.id, JSON.stringify(attrs)],
      );
      // Synk til talent-profilen hvis promotert (behold andre badges enn våre to).
      const talentId = stu.rows[0].talent_id ? String(stu.rows[0].talent_id) : null;
      if (talentId) {
        const { cols, badges } = attrsToTalentCols(attrs);
        await pool.query(
          `UPDATE talents SET
             playing_age_min = $2, playing_age_max = $3, gender = $4, city = $5, height_cm = $6,
             skills = $7::jsonb, languages = $8::jsonb, dialects = $9::jsonb,
             badges = (
               SELECT COALESCE(jsonb_agg(DISTINCT b), '[]'::jsonb)
               FROM jsonb_array_elements_text(
                 COALESCE((SELECT badges FROM talents WHERE id = $1), '[]'::jsonb)
                   - 'education_verified' - 'nsf_member' || $10::jsonb
               ) b
             ),
             updated_at = now()
           WHERE id = $1`,
          [talentId, cols.playing_age_min, cols.playing_age_max, cols.gender, cols.city, cols.height_cm,
           cols.skills, cols.languages, cols.dialects, JSON.stringify(badges)],
        );
      }
      res.json({ success: true, searchable: isSearchable(attrs), attributes: attrs });
    } catch (err) {
      if (isMissingTable(err)) { res.status(503).json({ error: "unavailable" }); return; }
      console.error("[edu-talent-pipeline] set attributes failed:", (err as Error).message);
      res.status(500).json({ error: "attributes_failed" });
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
        `SELECT s.id, s.name, s.email, s.cohort_id, s.talent_id, s.talent_attributes,
                t.owner_user_id AS talent_owner, t.showreel_url AS talent_showreel
           FROM role_room_education_students s
           LEFT JOIN talents t ON t.id = s.talent_id
          WHERE s.owner_user_id = $1 AND s.status = 'active'${cohortFilter}
          ORDER BY s.created_at ASC`,
        params,
      );
      const rows: PipelineRow[] = r.rows.map((x) => {
        const attrs = normAttrs(x.talent_attributes);
        return {
          studentId: String(x.id),
          name: (x.name as string) ?? "",
          email: (x.email as string) ?? null,
          cohortId: (x.cohort_id as string) ?? null,
          talentId: x.talent_id ? String(x.talent_id) : null,
          status: !x.talent_id ? "none" : (x.talent_owner ? "claimed" : "claimable"),
          hasShowreel: !!x.talent_showreel,
          searchable: isSearchable(attrs),
          nsfMember: attrs.nsfMember,
          attributes: attrs,
        };
      });
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
            SET owner_user_id = $1,
                profile_status = CASE WHEN profile_status = 'draft' THEN 'active' ELSE profile_status END,
                metadata = COALESCE(metadata, '{}'::jsonb)
                  || jsonb_build_object('consent',
                       COALESCE(metadata->'consent', '{}'::jsonb)
                       || jsonb_build_object('status', 'accepted', 'confirmedAt', now()::text)),
                updated_at = now()
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

  // ── Student: hva venter på meg + hva ER Role Room Talents (transparens) ───
  router.get("/education/talent/pending", requireAuth, async (req, res) => {
    const email = (req as AuthedRequest).userEmail;
    if (!email) { res.json({ pending: [], info: ROLE_ROOM_TALENTS_INFO }); return; }
    try {
      const r = await pool.query(
        `SELECT id, display_name, showreel_url, metadata
           FROM talents
          WHERE owner_user_id IS NULL
            AND lower(email) = lower($1)
            AND metadata->'education'->>'source' = 'education_workspace'`,
        [email],
      );
      const pending = r.rows.map((x) => ({
        talentId: String(x.id),
        name: (x.display_name as string) ?? "",
        showreelUrl: (x.showreel_url as string) ?? null,
        credential: (x.metadata as { education?: unknown })?.education ?? null,
      }));
      res.json({ pending, info: ROLE_ROOM_TALENTS_INFO });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ pending: [], info: ROLE_ROOM_TALENTS_INFO }); return; }
      console.warn("[edu-talent-pipeline] pending failed:", (err as Error).message);
      res.json({ pending: [], info: ROLE_ROOM_TALENTS_INFO });
    }
  });

  // ── Student avslår → utkastet slettes (rett til å motsette seg / slette) ──
  router.post("/education/talent/decline", requireAuth, async (req, res) => {
    const email = (req as AuthedRequest).userEmail;
    if (!email) { res.status(400).json({ error: "no_email" }); return; }
    try {
      const del = await pool.query(
        `DELETE FROM talents
          WHERE owner_user_id IS NULL
            AND lower(email) = lower($1)
            AND metadata->'education'->>'source' = 'education_workspace'
          RETURNING id`,
        [email],
      );
      const ids = del.rows.map((x) => String(x.id));
      if (ids.length > 0) {
        await pool.query(`UPDATE role_room_education_students SET talent_id = NULL WHERE talent_id = ANY($1::uuid[])`, [ids]);
      }
      res.json({ declined: ids.length });
    } catch (err) {
      if (isMissingTable(err)) { res.json({ declined: 0 }); return; }
      console.error("[edu-talent-pipeline] decline failed:", (err as Error).message);
      res.status(500).json({ error: "decline_failed" });
    }
  });

  // ── Faglærer trekker tilbake en UCLAIMET invitasjon (rett til sletting) ──
  router.delete("/education/students/:id/talent", requireAuth, async (req, res) => {
    try {
      const stu = await pool.query(
        `SELECT talent_id FROM role_room_education_students WHERE id = $1 AND owner_user_id = $2`,
        [req.params.id, uid(req)],
      );
      if (stu.rows.length === 0) { res.status(404).json({ error: "not_found" }); return; }
      const talentId = stu.rows[0].talent_id ? String(stu.rows[0].talent_id) : null;
      if (!talentId) { res.json({ withdrawn: false }); return; }
      // Kun uclaimet (owner NULL) kan trekkes tilbake av skolen — en claimet
      // profil eies av studenten og kan bare slettes av studenten selv.
      const del = await pool.query(`DELETE FROM talents WHERE id = $1 AND owner_user_id IS NULL RETURNING id`, [talentId]);
      await pool.query(`UPDATE role_room_education_students SET talent_id = NULL WHERE id = $1`, [req.params.id]);
      res.json({ withdrawn: del.rows.length > 0, wasClaimed: del.rows.length === 0 });
    } catch (err) {
      console.error("[edu-talent-pipeline] withdraw failed:", (err as Error).message);
      res.status(500).json({ error: "withdraw_failed" });
    }
  });

  return router;
}
