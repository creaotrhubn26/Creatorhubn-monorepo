/**
 * role-room-lti-routes.ts — LTI 1.3 Advantage tool-endepunkter. Montert /api/role-room.
 *
 * jwks/config = offentlig (så Canvas kan registrere oss). login/launch = LMS-
 * initiert OIDC-dans (validert via state/nonce + id_token-signatur). Plattform-
 * registrering + grade-push = super-admin.
 *
 * 🔑 DB-GATED: uten registrert plattform gjør launch ingenting. Krypto i
 * role-room-lti-service.ts (enhetstestet). Full oppkobling krever registrering
 * i en ekte Canvas — uverifiserbart herfra.
 */

import crypto from "crypto";
import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from "express";
import type { Pool } from "pg";
import { loadPersistedAuthSession, persistAuthSession } from "./auth-session-store.js";
import { newEntityId } from "./_shared-ids.js";
import {
  generateToolKeypair, toolJwks, signClientAssertion, verifyIdToken, extractAgs,
  buildLineItem, buildScore, AGS_SCOPES, extractNrps, parseRosterMembers, NRPS_SCOPE,
  type PlatformJwk, type RosterMember,
} from "./role-room-lti-service.js";

const SUPER_ADMIN_EMAIL = "daniel@creatorhubn.com";
const APP_URL = process.env.LTI_APP_URL?.trim() || "https://www.theroleroom.com/";
const TOOL_BASE = process.env.LTI_TOOL_BASE?.trim() || "https://www.theroleroom.com/api/role-room";

interface SessionData { userId: string; email: string; name: string; role: string; loginAt: string; [k: string]: unknown; }
function isSuperAdmin(s: SessionData | null): boolean {
  return !!s && (String(s.role).toLowerCase() === "super_admin" || String(s.email).toLowerCase() === SUPER_ADMIN_EMAIL);
}
async function resolveUser(pool: Pool, active: Map<string, SessionData> | undefined, bearer: string | null | undefined): Promise<SessionData | null> {
  const token = typeof bearer === "string" ? bearer.trim() : "";
  if (!token) return null;
  const inMem = active?.get(token) ?? null;
  if (inMem) return inMem;
  const p = await loadPersistedAuthSession<SessionData>(pool, token);
  if (p) { active?.set(token, p); return p; }
  return null;
}

/** Hent eller generér-og-lagre tool-nøkkelen (lat). */
async function ensureToolKey(pool: Pool): Promise<{ privatePem: string; publicJwk: Record<string, unknown>; kid: string }> {
  const r = await pool.query(`SELECT kid, private_pem, public_jwk FROM role_room_lti_tool_keys ORDER BY created_at ASC LIMIT 1`);
  if (r.rows[0]) {
    const row = r.rows[0];
    return { privatePem: String(row.private_pem), publicJwk: row.public_jwk as Record<string, unknown>, kid: String(row.kid) };
  }
  const kp = generateToolKeypair();
  await pool.query(
    `INSERT INTO role_room_lti_tool_keys (id, kid, private_pem, public_jwk) VALUES ($1,$2,$3,$4)`,
    [newEntityId("ltikey"), kp.kid, kp.privatePem, JSON.stringify(kp.publicJwk)],
  );
  return kp;
}

// Lat, idempotent schema-selvheler for NRPS-kolonnen (unngår avhengighet av
// den dvale-lagte auto-migrate-workflowen — speiler pricing-config-mønsteret).
let nrpsColumnEnsured = false;
async function ensureNrpsColumn(pool: Pool): Promise<void> {
  if (nrpsColumnEnsured) return;
  await pool.query(`ALTER TABLE role_room_lti_launches ADD COLUMN IF NOT EXISTS nrps_url TEXT`);
  nrpsColumnEnsured = true;
}

async function fetchPlatformJwks(jwksUrl: string): Promise<PlatformJwk[]> {
  const res = await fetch(jwksUrl);
  if (!res.ok) throw new Error("jwks_fetch_failed");
  const data = (await res.json()) as { keys?: PlatformJwk[] };
  return data.keys ?? [];
}

/**
 * Trekker ut identitet fra et validert LTI id_token. Navn/e-post er standard
 * OIDC-claims (Canvas/saLTIre sender dem når konfigurert). LTI `roles`-claim →
 * faglærer vs student. Instruktør-lignende roller vinner (den som launcher for
 * å sette karakter er som regel faglæreren).
 */
export function extractLtiIdentity(claims: Record<string, unknown>): {
  email: string | null; name: string | null; educationRole: "faglærer" | "student";
} {
  const email =
    typeof claims.email === "string" && claims.email.trim() ? claims.email.trim().toLowerCase() : null;
  const name =
    typeof claims.name === "string" && claims.name.trim()
      ? claims.name.trim()
      : [claims.given_name, claims.family_name]
          .filter((p): p is string => typeof p === "string" && !!p.trim())
          .join(" ")
          .trim() || null;
  const rolesRaw = claims["https://purl.imsglobal.org/spec/lti/claim/roles"];
  const roles = Array.isArray(rolesRaw) ? rolesRaw.filter((r): r is string => typeof r === "string") : [];
  const isInstructor = roles.some((r) =>
    /#(Instructor|TeachingAssistant|ContentDeveloper|Mentor|Administrator|Manager|Officer)\b/i.test(r),
  );
  const isLearner = roles.some((r) => /#(Learner|Student)\b/i.test(r));
  const educationRole: "faglærer" | "student" = isLearner && !isInstructor ? "student" : "faglærer";
  return { email, name, educationRole };
}

/**
 * Provisjonerer/finner bruker fra LTI-claims og minter en utdannings-sesjon.
 * Speiler resolveFeideSession (upsert users.email, placeholder-passord,
 * profession=education) — LTI-launch vouch-er for brukeren (LMS-en har alt
 * autentisert), så ingen ekstra pålogging trengs. Returnerer sesjons-token
 * (plukkes opp av frontendens ?rr_session=-håndtering) eller null.
 */
async function mintLtiEducationSession(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  identity: { email: string; name: string | null; educationRole: "faglærer" | "student" },
): Promise<string | null> {
  const bcrypt = await import("bcrypt");
  const placeholderPassword = await bcrypt.default.hash(`${crypto.randomUUID()}${crypto.randomUUID()}`, 10);
  const upsert = await pool.query<{ id: string; role: string | null }>(
    `INSERT INTO users (email, username, password, role, profession, last_login_at, created_at, updated_at)
     VALUES ($1, $2, $3, 'user', 'education', NOW(), NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET
       username = COALESCE(NULLIF(users.username, ''), EXCLUDED.username),
       password = COALESCE(NULLIF(users.password, ''), EXCLUDED.password),
       profession = COALESCE(NULLIF(users.profession, ''), 'education'),
       last_login_at = NOW(), updated_at = NOW()
     RETURNING id, role`,
    [identity.email, identity.email, placeholderPassword],
  );
  const row = upsert.rows[0];
  if (!row) return null;
  const token = crypto.randomUUID();
  const sessionData: SessionData = {
    userId: String(row.id),
    email: identity.email,
    name: identity.name ?? identity.email,
    role: (row.role ?? "user").toString(),
    loginAt: new Date().toISOString(),
    profession: "education",
    selectedProfession: "education",
    educationRole: identity.educationRole,
    loginSource: "lti",
  };
  activeSessions?.set(token, sessionData);
  await persistAuthSession(pool, token, sessionData);
  return token;
}

export interface CreateLtiRouterDeps { activeSessions?: Map<string, SessionData>; }

export function createLtiRouter(pool: Pool, deps: CreateLtiRouterDeps = {}): ExpressRouter {
  const router = Router();

  const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    const s = await resolveUser(pool, deps.activeSessions, bearer);
    if (!isSuperAdmin(s)) { res.status(403).json({ error: "forbidden" }); return; }
    (req as Request & { userId: string }).userId = s!.userId;
    next();
  };

  // ── Offentlig: JWKS + tool-config ────────────────────────────────────────
  router.get("/lti/jwks", async (_req, res) => {
    try {
      const key = await ensureToolKey(pool);
      res.json(toolJwks(key.publicJwk));
    } catch (err) {
      console.error("[lti] jwks failed:", (err as Error).message);
      res.status(500).json({ error: "jwks_failed" });
    }
  });

  router.get("/lti/config", (_req, res) => {
    const targetLinkUri = `${TOOL_BASE}/lti/launch`;
    // Alle scopes vi trenger: AGS (grade-passback) + NRPS (klasse-roster). Uten
    // NRPS-scopet ville Canvas ikke gi tilgang til roster → per-student-karakter
    // feiler. Domene utledes fra TOOL_BASE for Canvas-extensions-blokken.
    let domain = "www.theroleroom.com";
    try { domain = new URL(TOOL_BASE).host; } catch { /* behold default */ }
    res.json({
      title: "The Role Room",
      description: "Studentproduksjoner, oppgaver, rubrikker og vurdering — med karakter tilbake i LMS.",
      oidc_initiation_url: `${TOOL_BASE}/lti/login`,
      target_link_uri: targetLinkUri,
      public_jwk_url: `${TOOL_BASE}/lti/jwks`,
      scopes: [...AGS_SCOPES, NRPS_SCOPE],
      // Canvas-spesifikk registrering (Developer Key = LTI). privacy_level=public
      // gir navn/e-post i id_token (kreves for sesjon + roster-matching). Andre
      // plattformer (saLTIre m.fl.) ignorerer extensions.
      extensions: [
        {
          domain,
          platform: "canvas.instructure.com",
          privacy_level: "public",
          settings: {
            text: "The Role Room",
            placements: [
              {
                placement: "course_navigation",
                message_type: "LtiResourceLinkRequest",
                target_link_uri: targetLinkUri,
                text: "The Role Room",
                enabled: true,
                default: "enabled",
                visibility: "members",
              },
              {
                placement: "assignment_selection",
                message_type: "LtiResourceLinkRequest",
                target_link_uri: targetLinkUri,
                text: "The Role Room",
              },
              {
                placement: "link_selection",
                message_type: "LtiResourceLinkRequest",
                target_link_uri: targetLinkUri,
                text: "The Role Room",
              },
            ],
          },
        },
      ],
      custom_fields: {},
    });
  });

  // ── LMS-initiert OIDC: login-initiering ──────────────────────────────────
  const handleLogin = async (req: Request, res: Response): Promise<void> => {
    const q = { ...(req.query as Record<string, string>), ...(req.body as Record<string, string> | undefined ?? {}) };
    const iss = q.iss; const clientId = q.client_id;
    if (!iss) { res.status(400).json({ error: "missing_iss" }); return; }
    try {
      const pr = await pool.query(
        `SELECT * FROM role_room_lti_platforms WHERE issuer = $1 AND ($2::text IS NULL OR client_id = $2) LIMIT 1`,
        [iss, clientId ?? null],
      );
      const platform = pr.rows[0];
      if (!platform) { res.status(404).json({ error: "unknown_platform" }); return; }
      const nonce = crypto.randomBytes(16).toString("hex");
      const state = crypto.randomBytes(24).toString("hex");
      await pool.query(`INSERT INTO role_room_lti_states (state, nonce, platform_id) VALUES ($1,$2,$3)`, [state, nonce, platform.id]);
      const url = new URL(String(platform.auth_login_url));
      url.searchParams.set("scope", "openid");
      url.searchParams.set("response_type", "id_token");
      url.searchParams.set("response_mode", "form_post");
      url.searchParams.set("prompt", "none");
      url.searchParams.set("client_id", String(platform.client_id));
      url.searchParams.set("redirect_uri", `${TOOL_BASE}/lti/launch`);
      url.searchParams.set("state", state);
      url.searchParams.set("nonce", nonce);
      if (q.login_hint) url.searchParams.set("login_hint", q.login_hint);
      if (q.lti_message_hint) url.searchParams.set("lti_message_hint", q.lti_message_hint);
      res.redirect(url.toString());
    } catch (err) {
      console.error("[lti] login failed:", (err as Error).message);
      res.status(500).json({ error: "login_failed" });
    }
  };
  router.get("/lti/login", handleLogin);
  router.post("/lti/login", handleLogin);

  // ── LMS-initiert launch: validér id_token + lagre kontekst ───────────────
  router.post("/lti/launch", async (req, res) => {
    const idToken = (req.body as Record<string, string> | undefined)?.id_token;
    const state = (req.body as Record<string, string> | undefined)?.state;
    if (!idToken || !state) { res.status(400).send("missing_id_token_or_state"); return; }
    try {
      const st = await pool.query(`DELETE FROM role_room_lti_states WHERE state = $1 AND created_at > now() - INTERVAL '10 minutes' RETURNING nonce, platform_id`, [state]);
      const stateRow = st.rows[0];
      if (!stateRow) { res.status(400).send("invalid_state"); return; }

      const pr = await pool.query(`SELECT * FROM role_room_lti_platforms WHERE id = $1`, [stateRow.platform_id]);
      const platform = pr.rows[0];
      if (!platform) { res.status(400).send("unknown_platform"); return; }

      const jwks = await fetchPlatformJwks(String(platform.jwks_url));
      const claims = verifyIdToken(idToken, {
        jwks, clientId: String(platform.client_id), issuer: String(platform.issuer), nonce: String(stateRow.nonce),
      });

      const ags = extractAgs(claims);
      const nrps = extractNrps(claims);
      const context = claims["https://purl.imsglobal.org/spec/lti/claim/context"] as { id?: string } | undefined;
      const resourceLink = claims["https://purl.imsglobal.org/spec/lti/claim/resource_link"] as { id?: string } | undefined;
      const launchId = newEntityId("ltilaunch");
      await ensureNrpsColumn(pool);
      await pool.query(
        `INSERT INTO role_room_lti_launches (id, platform_id, lti_user_sub, context_id, resource_link_id, ags_lineitems, ags_lineitem, ags_scopes, nrps_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [launchId, platform.id, String(claims.sub ?? ""), context?.id ?? null, resourceLink?.id ?? null,
         ags?.lineitems ?? null, ags?.lineitem ?? null, JSON.stringify(ags?.scope ?? []), nrps?.url ?? null],
      );
      // Auto-provisjon fra LTI-claims: LMS-en har alt autentisert brukeren, så
      // vi minter en utdannings-sesjon og sender den via ?rr_session= (samme
      // pickup som Feide). Uten e-post-claim (f.eks. saLTIre uten User-claims)
      // faller vi tilbake til uautentisert landing — launch-kontekst er uansett
      // lagret for grade-push.
      const identity = extractLtiIdentity(claims);
      let sessionToken: string | null = null;
      if (identity.email) {
        try {
          sessionToken = await mintLtiEducationSession(pool, deps.activeSessions, {
            email: identity.email, name: identity.name, educationRole: identity.educationRole,
          });
        } catch (e) {
          console.warn("[lti] sesjon-mint feilet (fortsetter uautentisert):", (e as Error).message);
        }
      }
      // Landing: inn i utdannings-workspacet (launch-kontekst lagret for grade-push).
      const redirectParams = new URLSearchParams({ mode: "education", lti_launch: launchId });
      if (sessionToken) redirectParams.set("rr_session", sessionToken);
      res.redirect(`${APP_URL}?${redirectParams.toString()}`);
    } catch (err) {
      console.error("[lti] launch failed:", (err as Error).message);
      res.status(400).send("launch_validation_failed");
    }
  });

  // ── Super-admin: registrer plattform ─────────────────────────────────────
  router.post("/lti/platforms", requireAdmin, async (req, res) => {
    const b = (req.body ?? {}) as Record<string, string>;
    for (const f of ["issuer", "client_id", "auth_login_url", "token_url", "jwks_url"]) {
      if (!b[f]?.trim()) { res.status(400).json({ error: `${f}_required` }); return; }
    }
    try {
      const id = newEntityId("ltiplat");
      const r = await pool.query(
        `INSERT INTO role_room_lti_platforms (id, owner_user_id, name, issuer, client_id, deployment_id, auth_login_url, token_url, jwks_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (issuer, client_id) DO UPDATE SET
           name=EXCLUDED.name, deployment_id=EXCLUDED.deployment_id, auth_login_url=EXCLUDED.auth_login_url,
           token_url=EXCLUDED.token_url, jwks_url=EXCLUDED.jwks_url, updated_at=now()
         RETURNING id`,
        [id, (req as Request & { userId: string }).userId, b.name ?? null, b.issuer.trim(), b.client_id.trim(),
         b.deployment_id ?? null, b.auth_login_url.trim(), b.token_url.trim(), b.jwks_url.trim()],
      );
      res.status(201).json({ platformId: String(r.rows[0].id) });
    } catch (err) {
      console.error("[lti] register platform failed:", (err as Error).message);
      res.status(500).json({ error: "register_failed" });
    }
  });

  router.get("/lti/platforms", requireAdmin, async (_req, res) => {
    try {
      const r = await pool.query(`SELECT id, name, issuer, client_id, created_at FROM role_room_lti_platforms ORDER BY created_at DESC`);
      res.json({ platforms: r.rows });
    } catch (err) {
      if ((err as { code?: string })?.code === "42P01") { res.json({ platforms: [] }); return; }
      res.json({ platforms: [] });
    }
  });

  // Auth = enhver innlogget sesjon (launchId er en ugjettbar UUID-kapabilitet).
  // Brukes av faglærer i en LTI-launchet vurderings-økt.
  const requireSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    const s = await resolveUser(pool, deps.activeSessions, bearer);
    if (!s) { res.status(401).json({ error: "unauthorized" }); return; }
    (req as Request & { userId: string }).userId = s.userId;
    next();
  };

  // ── Faglærer: hent LMS-klasse-roster (NRPS) ──────────────────────────────
  // Gir hver students LMS-sub + navn/e-post/rolle, slik at faglærer kan pushe
  // karakter til hver students egen rad i karakterboka.
  router.get("/lti/launches/:id/roster", requireSession, async (req, res) => {
    try {
      const result = await fetchRoster(pool, req.params.id);
      if (!result.ok) { res.status(result.status ?? 500).json({ error: result.error }); return; }
      res.json({ members: result.members });
    } catch (err) {
      console.error("[lti] roster failed:", (err as Error).message);
      res.status(500).json({ error: "roster_failed" });
    }
  });

  // ── Faglærer: send karakter til LMS-karakterboka (AGS grade-passback) ─────
  // Tar en fri-tekst-karakter (mappes til tallscore) ELLER eksplisitt
  // scoreGiven/scoreMaximum. Målbruker: `ltiUserSub` (fra roster) ELLER
  // `studentEmail` (slås opp mot roster) — ellers launch-brukeren (student-
  // launchet oppgave). Poster til launchens AGS line item.

  // ── Faglærer: importer LMS-klasse-roster (NRPS) → utdannings-kull ─────────
  // Henter rosteret via NRPS og upserter studentene (roller = Learner/Student)
  // inn i et utdannings-kull. `cohortId` importerer inn i et eksisterende kull
  // (eier-sjekket); uten den opprettes et nytt kull (`cohortName`). Duplikater
  // hoppes over på e-post (case-insensitivt). Trygg å kjøre på nytt = «synk».
  router.post("/lti/launches/:id/import-students", requireSession, async (req, res) => {
    const body = (req.body ?? {}) as { cohortId?: string; cohortName?: string };
    const userId = (req as Request & { userId: string }).userId;
    try {
      const roster = await fetchRoster(pool, req.params.id);
      if (!roster.ok) { res.status(roster.status ?? 500).json({ error: roster.error }); return; }
      const students = roster.members.filter((m) =>
        m.roles.some((r) => /learner|student/i.test(r)) || m.roles.length === 0);

      // Mål-kull: eksisterende (eier-sjekk) eller nytt.
      let cohortId = typeof body.cohortId === "string" ? body.cohortId.trim() : "";
      if (cohortId) {
        const owns = await pool.query(
          `SELECT 1 FROM role_room_education_cohorts WHERE id = $1 AND owner_user_id = $2`,
          [cohortId, userId],
        );
        if (owns.rows.length === 0) { res.status(404).json({ error: "cohort_not_found" }); return; }
      } else {
        cohortId = newEntityId("cohort");
        await pool.query(
          `INSERT INTO role_room_education_cohorts (id, owner_user_id, name) VALUES ($1,$2,$3)`,
          [cohortId, userId, (body.cohortName?.trim() || "Importert fra Canvas")],
        );
      }

      const existing = await pool.query(
        `SELECT lower(email) AS email FROM role_room_education_students WHERE cohort_id = $1 AND email IS NOT NULL`,
        [cohortId],
      );
      const seen = new Set<string>(existing.rows.map((r) => String(r.email)));
      let added = 0;
      let skipped = 0;
      for (const m of students) {
        const email = (m.email ?? "").trim();
        const emailKey = email.toLowerCase();
        const name = (m.name ?? "").trim() || (email ? email.split("@")[0] : "");
        if (!name || (emailKey && seen.has(emailKey))) { skipped++; continue; }
        if (emailKey) seen.add(emailKey);
        // eslint-disable-next-line no-await-in-loop -- sekvensiell insert holder det enkelt
        await pool.query(
          `INSERT INTO role_room_education_students (id, cohort_id, owner_user_id, name, email)
           VALUES ($1,$2,$3,$4,$5)`,
          [newEntityId("student"), cohortId, userId, name, email || null],
        );
        added++;
      }
      res.status(201).json({ cohortId, added, skipped, total: students.length });
    } catch (err) {
      console.error("[lti] import-students failed:", (err as Error).message);
      res.status(500).json({ error: "import_failed" });
    }
  });

  router.post("/lti/launches/:id/grade", requireSession, async (req, res) => {
    const b = (req.body ?? {}) as {
      grade?: string; scoreGiven?: number; scoreMaximum?: number; comment?: string; label?: string;
      ltiUserSub?: string; studentEmail?: string;
    };
    let scoreGiven = b.scoreGiven;
    let scoreMaximum = b.scoreMaximum;
    if (typeof scoreGiven !== "number" || typeof scoreMaximum !== "number") {
      if (typeof b.grade === "string" && b.grade.trim()) {
        const mapped = gradeToScore(b.grade);
        if (!mapped) {
          res.status(422).json({ error: "ungradeable", message: "Karakteren kunne ikke tolkes som en tallverdi for LMS-karakterboka." });
          return;
        }
        scoreGiven = mapped.scoreGiven;
        // Eksplisitt maks (f.eks. rubrikk-maks) vinner om oppgitt.
        scoreMaximum = typeof b.scoreMaximum === "number" ? b.scoreMaximum : mapped.scoreMaximum;
      }
    }
    if (typeof scoreGiven !== "number" || typeof scoreMaximum !== "number") {
      res.status(400).json({ error: "grade_or_score_required" });
      return;
    }
    try {
      // Målbruker: eksplisitt sub, ellers slå opp e-post i rosteret (NRPS).
      let targetUserSub = typeof b.ltiUserSub === "string" && b.ltiUserSub.trim() ? b.ltiUserSub.trim() : undefined;
      if (!targetUserSub && typeof b.studentEmail === "string" && b.studentEmail.trim()) {
        const roster = await fetchRoster(pool, req.params.id);
        if (!roster.ok) { res.status(roster.status ?? 502).json({ error: roster.error }); return; }
        const email = b.studentEmail.trim().toLowerCase();
        const member = roster.members.find((m) => m.email === email);
        if (!member) { res.status(404).json({ error: "student_not_in_roster" }); return; }
        targetUserSub = member.sub;
      }
      const result = await pushScore(pool, req.params.id, { scoreGiven, scoreMaximum, comment: b.comment, label: b.label, targetUserSub });
      if (!result.ok) { res.status(result.status ?? 500).json({ error: result.error }); return; }
      res.json({ success: true, scoreGiven, scoreMaximum });
    } catch (err) {
      console.error("[lti] grade push failed:", (err as Error).message);
      res.status(500).json({ error: "grade_failed" });
    }
  });

  // ── Super-admin: push karakter til LMS (AGS grade-passback) ───────────────
  router.post("/lti/launches/:id/score", requireAdmin, async (req, res) => {
    const b = (req.body ?? {}) as { scoreGiven?: number; scoreMaximum?: number; comment?: string; label?: string };
    const scoreGiven = b.scoreGiven; const scoreMaximum = b.scoreMaximum;
    if (typeof scoreGiven !== "number" || typeof scoreMaximum !== "number") { res.status(400).json({ error: "score_required" }); return; }
    try {
      const result = await pushScore(pool, req.params.id, { scoreGiven, scoreMaximum, comment: b.comment, label: b.label });
      if (!result.ok) { res.status(result.status ?? 500).json({ error: result.error }); return; }
      res.json({ success: true });
    } catch (err) {
      console.error("[lti] score push failed:", (err as Error).message);
      res.status(500).json({ error: "score_failed" });
    }
  });

  return router;
}

/**
 * AGS grade-passback: mint client_credentials-token (signert client_assertion),
 * (opprett line item om nødvendig), og POST en Score til karakterboka.
 * Eksportert for gjenbruk fra vurderings-flyten + testing.
 */
export async function pushScore(
  pool: Pool, launchId: string,
  input: { scoreGiven: number; scoreMaximum: number; comment?: string; label?: string; targetUserSub?: string },
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const lr = await pool.query(`SELECT * FROM role_room_lti_launches WHERE id = $1`, [launchId]);
  const launch = lr.rows[0];
  if (!launch) return { ok: false, error: "launch_not_found", status: 404 };
  // Målbruker: eksplisitt (per-student via roster) ellers launch-brukeren.
  const targetUserSub = input.targetUserSub ?? launch.lti_user_sub;
  if (!targetUserSub) return { ok: false, error: "no_user", status: 400 };
  const pr = await pool.query(`SELECT * FROM role_room_lti_platforms WHERE id = $1`, [launch.platform_id]);
  const platform = pr.rows[0];
  if (!platform) return { ok: false, error: "platform_not_found", status: 404 };

  const key = await ensureToolKey(pool);
  const assertion = signClientAssertion({ clientId: String(platform.client_id), tokenUrl: String(platform.token_url), privatePem: key.privatePem, kid: key.kid });
  const tokenRes = await fetch(String(platform.token_url), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
      scope: AGS_SCOPES.join(" "),
    }).toString(),
  });
  if (!tokenRes.ok) return { ok: false, error: "token_failed", status: 502 };
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return { ok: false, error: "no_access_token", status: 502 };

  // Line item: bruk eksisterende, ellers opprett ett.
  let lineitem: string | null = launch.ags_lineitem ?? null;
  if (!lineitem && launch.ags_lineitems) {
    const liRes = await fetch(String(launch.ags_lineitems), {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/vnd.ims.lis.v2.lineitem+json" },
      body: JSON.stringify(buildLineItem({ label: input.label ?? "The Role Room", scoreMaximum: input.scoreMaximum, resourceLinkId: launch.resource_link_id ?? undefined })),
    });
    if (!liRes.ok) return { ok: false, error: "lineitem_failed", status: 502 };
    lineitem = String(((await liRes.json()) as { id?: string }).id ?? "");
  }
  if (!lineitem) return { ok: false, error: "no_lineitem", status: 400 };

  const scoreUrl = lineitem.includes("/scores") ? lineitem : `${lineitem.replace(/\?.*$/, "")}/scores`;
  const scoreRes = await fetch(scoreUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/vnd.ims.lis.v1.score+json" },
    body: JSON.stringify(buildScore({ userId: String(targetUserSub), scoreGiven: input.scoreGiven, scoreMaximum: input.scoreMaximum, comment: input.comment })),
  });
  if (!scoreRes.ok) return { ok: false, error: "score_post_failed", status: 502 };
  return { ok: true };
}

/**
 * NRPS: henter LMS-klasse-rosteret for en launch. Minter client_credentials-
 * token (NRPS-scope), GET-er context-memberships-endepunktet, og parser
 * medlemmene (LMS-sub + navn/e-post/roller). Eksportert for gjenbruk + testing.
 */
export async function fetchRoster(
  pool: Pool, launchId: string,
): Promise<{ ok: true; members: RosterMember[] } | { ok: false; error: string; status?: number }> {
  const lr = await pool.query(`SELECT * FROM role_room_lti_launches WHERE id = $1`, [launchId]);
  const launch = lr.rows[0];
  if (!launch) return { ok: false, error: "launch_not_found", status: 404 };
  if (!launch.nrps_url) return { ok: false, error: "no_nrps", status: 400 };
  const pr = await pool.query(`SELECT * FROM role_room_lti_platforms WHERE id = $1`, [launch.platform_id]);
  const platform = pr.rows[0];
  if (!platform) return { ok: false, error: "platform_not_found", status: 404 };

  const key = await ensureToolKey(pool);
  const assertion = signClientAssertion({ clientId: String(platform.client_id), tokenUrl: String(platform.token_url), privatePem: key.privatePem, kid: key.kid });
  const tokenRes = await fetch(String(platform.token_url), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
      scope: NRPS_SCOPE,
    }).toString(),
  });
  if (!tokenRes.ok) return { ok: false, error: "token_failed", status: 502 };
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return { ok: false, error: "no_access_token", status: 502 };

  const memRes = await fetch(String(launch.nrps_url), {
    headers: { Authorization: `Bearer ${access_token}`, Accept: "application/vnd.ims.lti-nrps.v2.membershipcontainer+json" },
  });
  if (!memRes.ok) return { ok: false, error: "roster_fetch_failed", status: 502 };
  const container = await memRes.json();
  return { ok: true, members: parseRosterMembers(container) };
}

/**
 * Mapper en fri-tekst-karakter fra Role Rooms formative vurdering til en
 * AGS-tallscore (LMS-karakterboka trenger scoreGiven/scoreMaximum). Dekker de
 * vanlige norske formene: bestått/godkjent (pass/fail), bokstav A–F (UH/ECTS,
 * A=5…E=1/F=0 av 5), prosent («85 %», av 100) og tallkarakter (1–6 av 6, ellers
 * poeng av 100). Returnerer null når karakteren ikke lar seg tolke numerisk
 * (kalleren svarer da 422 i stedet for å pushe noe misvisende).
 */
export function gradeToScore(grade: string): { scoreGiven: number; scoreMaximum: number } | null {
  const g = grade.trim();
  if (!g) return null;
  if (/^(best[åa]tt|godkjent|pass(ed)?)$/i.test(g)) return { scoreGiven: 1, scoreMaximum: 1 };
  if (/^(ikke[\s-]?best[åa]tt|ikke[\s-]?godkjent|underkjent|fail(ed)?)$/i.test(g)) return { scoreGiven: 0, scoreMaximum: 1 };
  const pct = g.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (pct) return { scoreGiven: parseFloat(pct[1].replace(",", ".")), scoreMaximum: 100 };
  const letterMap: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
  const letter = g.toUpperCase();
  if (letter.length === 1 && letter in letterMap) return { scoreGiven: letterMap[letter], scoreMaximum: 5 };
  const num = g.replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(num)) {
    const n = parseFloat(num);
    return { scoreGiven: n, scoreMaximum: n <= 6 ? 6 : 100 };
  }
  return null;
}
