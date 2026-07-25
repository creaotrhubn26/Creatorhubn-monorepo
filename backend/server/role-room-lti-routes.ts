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
  buildLineItem, buildScore, AGS_SCOPES, type PlatformJwk,
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
    res.json({
      title: "The Role Room",
      description: "Studentproduksjoner, oppgaver, rubrikker og vurdering — med karakter tilbake i LMS.",
      oidc_initiation_url: `${TOOL_BASE}/lti/login`,
      target_link_uri: `${TOOL_BASE}/lti/launch`,
      public_jwk_url: `${TOOL_BASE}/lti/jwks`,
      scopes: AGS_SCOPES,
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
      const context = claims["https://purl.imsglobal.org/spec/lti/claim/context"] as { id?: string } | undefined;
      const resourceLink = claims["https://purl.imsglobal.org/spec/lti/claim/resource_link"] as { id?: string } | undefined;
      const launchId = newEntityId("ltilaunch");
      await pool.query(
        `INSERT INTO role_room_lti_launches (id, platform_id, lti_user_sub, context_id, resource_link_id, ags_lineitems, ags_lineitem, ags_scopes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [launchId, platform.id, String(claims.sub ?? ""), context?.id ?? null, resourceLink?.id ?? null,
         ags?.lineitems ?? null, ags?.lineitem ?? null, JSON.stringify(ags?.scope ?? [])],
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
  input: { scoreGiven: number; scoreMaximum: number; comment?: string; label?: string },
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const lr = await pool.query(`SELECT * FROM role_room_lti_launches WHERE id = $1`, [launchId]);
  const launch = lr.rows[0];
  if (!launch) return { ok: false, error: "launch_not_found", status: 404 };
  if (!launch.lti_user_sub) return { ok: false, error: "no_user", status: 400 };
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
    body: JSON.stringify(buildScore({ userId: String(launch.lti_user_sub), scoreGiven: input.scoreGiven, scoreMaximum: input.scoreMaximum, comment: input.comment })),
  });
  if (!scoreRes.ok) return { ok: false, error: "score_post_failed", status: 502 };
  return { ok: true };
}
