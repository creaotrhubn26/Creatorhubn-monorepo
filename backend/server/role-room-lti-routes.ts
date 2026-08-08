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
  signDeepLinkingResponse, groupStudentsBySection, isStudentRole,
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
  // NRPS + Canvas-metadata fra launchen (emne/emnekode/semester/institusjon).
  await pool.query(`ALTER TABLE role_room_lti_launches ADD COLUMN IF NOT EXISTS nrps_url TEXT`);
  await pool.query(`ALTER TABLE role_room_lti_launches ADD COLUMN IF NOT EXISTS context_title TEXT`);
  await pool.query(`ALTER TABLE role_room_lti_launches ADD COLUMN IF NOT EXISTS context_label TEXT`);
  await pool.query(`ALTER TABLE role_room_lti_launches ADD COLUMN IF NOT EXISTS platform_name TEXT`);
  await pool.query(`ALTER TABLE role_room_lti_launches ADD COLUMN IF NOT EXISTS term TEXT`);
  await pool.query(`ALTER TABLE role_room_lti_launches ADD COLUMN IF NOT EXISTS deep_link_return_url TEXT`);
  await pool.query(`ALTER TABLE role_room_lti_launches ADD COLUMN IF NOT EXISTS deep_link_data TEXT`);
  nrpsColumnEnsured = true;
}

// Alle plattform-vendte URLer (jwks/token/nrps/ags-lineitems/scores) kommer fra
// enten admin-registrering ELLER LMS-claims → må valideres før fetch: HTTPS
// (ingen plaintext-exfil / http-internt) + ikke privat/loopback-host (SSRF-lite).
// ponytail: literal privat-IP-blokk uten DNS-oppslag; oppgrader til resolve+sjekk
// hvis intern-nett-eksponering blir en reell trussel.
function assertSafeHttpsUrl(raw: string): string {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("url_invalid"); }
  if (u.protocol !== "https:") throw new Error("url_not_https");
  const h = u.hostname;
  if (/^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.endsWith(".local")) {
    throw new Error("url_private_host");
  }
  return raw;
}

// Plattform-fetch: validér URL + hard timeout (treg/hengende issuer skal ikke
// henge requesten). Alle eksterne LTI-kall MÅ gå via denne.
async function fetchPlatform(url: string, opts: RequestInit = {}, ms = 10000): Promise<Response> {
  assertSafeHttpsUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

// IMS LTI Dynamic Registration: verktøyets selvbeskrivelse (OpenID client
// registration request + lti-tool-configuration-claim). Delt sannhet for
// registrerings-flyten. Gjenbruker samme endepunkter/scopes som launchen.
export function buildToolConfiguration(clientName = "The Role Room"): Record<string, unknown> {
  const loginUri = `${TOOL_BASE}/lti/login`;
  const launchUri = `${TOOL_BASE}/lti/launch`;
  const jwksUri = `${TOOL_BASE}/lti/jwks`;
  return {
    application_type: "web",
    client_name: clientName,
    grant_types: ["client_credentials", "implicit"],
    response_types: ["id_token"],
    token_endpoint_auth_method: "private_key_jwt",
    initiate_login_uri: loginUri,
    redirect_uris: [launchUri],
    jwks_uri: jwksUri,
    scope: [...AGS_SCOPES, NRPS_SCOPE].join(" "),
    "https://purl.imsglobal.org/spec/lti-tool-configuration": {
      domain: new URL(TOOL_BASE).host,
      target_link_uri: launchUri,
      claims: ["sub", "iss", "name", "email", "given_name", "family_name", "roles"],
      messages: [
        { type: "LtiResourceLinkRequest", target_link_uri: launchUri, label: clientName },
        { type: "LtiDeepLinkingRequest", target_link_uri: launchUri, label: `${clientName} — velg produksjon` },
      ],
    },
  };
}

// Uverifisert uttrekk av én string-claim fra en JWT (kun til å scope state-
// oppslaget mot issuer FØR signatur-verifisering — verdien stoles ikke på).
function unverifiedJwtClaim(idToken: string, key: string): string | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
    return typeof payload[key] === "string" ? (payload[key] as string) : null;
  } catch { return null; }
}

async function fetchPlatformJwks(jwksUrl: string): Promise<PlatformJwk[]> {
  const res = await fetchPlatform(jwksUrl);
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
  // Valider e-post-format før den brukes som users.email/username (malformet
  // claim skal ikke lage en ugyldig konto eller kollidere på username).
  // ponytail: pragmatisk regex, ikke full RFC 5322 — oppgrader ved behov.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)) return null;
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
                message_type: "LtiDeepLinkingRequest",
                target_link_uri: targetLinkUri,
                text: "The Role Room — velg produksjon",
              },
              {
                placement: "link_selection",
                message_type: "LtiDeepLinkingRequest",
                target_link_uri: targetLinkUri,
                text: "The Role Room",
              },
              {
                placement: "editor_button",
                message_type: "LtiDeepLinkingRequest",
                target_link_uri: targetLinkUri,
                text: "The Role Room",
                icon_url: `${TOOL_BASE}/favicon.ico`,
              },
            ],
          },
        },
      ],
      // Canvas-substitusjoner → sendes som custom-claim ved launch (semester m.m.).
      // section_* resolves per-medlem i NRPS-`message` (rlid-scopet) → kull→seksjon-mapping.
      custom_fields: {
        term_name: "$Canvas.term.name",
        section_ids: "$Canvas.course.sectionIds",
        section_sourcedids: "$Canvas.course.sectionSourcedIds",
      },
    });
  });

  // ── IMS LTI Dynamic Registration ─────────────────────────────────────────
  // Plattform-initiert selv-registrering: Moodle/Canvas åpner denne med
  // ?openid_configuration=<platform openid-config> [&registration_token=<bearer>].
  // Vi henter plattformens config, POST-er verktøy-registrering tilbake, lagrer
  // en PENDING plattform (super-admin må godkjenne før launch), og returnerer en
  // close-page. All URL-henting via fetchPlatform (SSRF-vakt + timeout).
  router.get("/lti/register", async (req, res) => {
    const q = req.query as Record<string, string>;
    const openidUrl = typeof q.openid_configuration === "string" ? q.openid_configuration : "";
    const regToken = typeof q.registration_token === "string" ? q.registration_token : "";
    const errPage = (msg: string) =>
      `<!doctype html><html><body style="font-family:sans-serif;padding:24px"><h3>Registrering feilet</h3><p>${msg}</p></body></html>`;
    try {
      assertSafeHttpsUrl(openidUrl);
    } catch {
      res.status(400).send(errPage("Ugyldig registrerings-URL (openid_configuration).")); return;
    }
    try {
      const cfgRes = await fetchPlatform(openidUrl);
      if (!cfgRes.ok) { res.status(400).send(errPage("Kunne ikke hente plattformens OpenID-config.")); return; }
      const cfg = (await cfgRes.json()) as Record<string, unknown>;
      const issuer = String(cfg.issuer ?? "");
      const authUrl = String(cfg.authorization_endpoint ?? "");
      const tokenUrl = String(cfg.token_endpoint ?? "");
      const jwksUrl = String(cfg.jwks_uri ?? "");
      const regEndpoint = String(cfg.registration_endpoint ?? "");
      if (!issuer || !authUrl || !tokenUrl || !jwksUrl || !regEndpoint) {
        res.status(400).send(errPage("Plattformen mangler påkrevde LTI-endepunkter.")); return;
      }
      const platformCfg = cfg["https://purl.imsglobal.org/spec/lti-platform-configuration"] as { product_family_code?: string } | undefined;
      const productFamily = platformCfg?.product_family_code ?? null;

      const regRes = await fetchPlatform(regEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(regToken ? { Authorization: `Bearer ${regToken}` } : {}),
        },
        body: JSON.stringify(buildToolConfiguration()),
      });
      if (!regRes.ok) { res.status(400).send(errPage("Plattformen avviste registreringen.")); return; }
      const reg = (await regRes.json()) as Record<string, unknown>;
      const clientId = String(reg.client_id ?? "");
      const toolCfg = reg["https://purl.imsglobal.org/spec/lti-tool-configuration"] as { deployment_id?: string } | undefined;
      const deploymentId = toolCfg?.deployment_id ?? null;
      if (!clientId) { res.status(400).send(errPage("Registrerings-svaret manglet client_id.")); return; }

      await pool.query(
        `INSERT INTO role_room_lti_platforms
           (id, owner_user_id, name, issuer, client_id, deployment_id, auth_login_url, token_url, jwks_url, status, registered_via, product_family)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (issuer, client_id) DO UPDATE SET
           deployment_id=EXCLUDED.deployment_id, auth_login_url=EXCLUDED.auth_login_url,
           token_url=EXCLUDED.token_url, jwks_url=EXCLUDED.jwks_url,
           product_family=EXCLUDED.product_family, registered_via='dynamic',
           status=CASE WHEN role_room_lti_platforms.status='approved' THEN 'approved' ELSE 'pending' END,
           updated_at=now()`,
        [newEntityId("ltiplat"), null, productFamily ? `${productFamily} · ${issuer}` : issuer,
         issuer, clientId, deploymentId, authUrl, tokenUrl, jwksUrl, "pending", "dynamic", productFamily],
      );

      // Close-page: signalér plattformen at registreringen er ferdig.
      res.status(200).send(
        `<!doctype html><html><body style="font-family:sans-serif;padding:24px">` +
        `<h3>The Role Room er registrert</h3>` +
        `<p>Institusjonen venter på godkjenning fra The Role Room før verktøyet kan brukes.</p>` +
        `<script>(function(){var m={subject:"org.imsglobal.lti.close"};` +
        `(window.opener||window.parent).postMessage(m,"*");})();</script>` +
        `</body></html>`,
      );
    } catch (err) {
      console.error("[lti] dynamic registration failed:", (err as Error).message);
      res.status(400).send(errPage("Uventet feil under registrering."));
    }
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
      // Defense-in-depth: bind state-konsumeringen til issuer id_token faktisk
      // hevder, så en feil-plattform-token ikke brenner en legitim state (og
      // ikke kan gjenbruke state på tvers av plattformer). Signaturen verifiseres
      // uansett rett etterpå mot platform.issuer.
      const tokenIss = unverifiedJwtClaim(idToken, "iss");
      if (!tokenIss) { res.status(400).send("invalid_id_token"); return; }
      const st = await pool.query(
        `DELETE FROM role_room_lti_states s
           USING role_room_lti_platforms p
          WHERE s.state = $1 AND s.created_at > now() - INTERVAL '10 minutes'
            AND s.platform_id = p.id AND p.issuer = $2
        RETURNING s.nonce, s.platform_id`,
        [state, tokenIss],
      );
      const stateRow = st.rows[0];
      if (!stateRow) { res.status(400).send("invalid_state"); return; }

      const pr = await pool.query(`SELECT * FROM role_room_lti_platforms WHERE id = $1`, [stateRow.platform_id]);
      const platform = pr.rows[0];
      if (!platform) { res.status(400).send("unknown_platform"); return; }

      if (platform.status && platform.status !== "approved") {
        res.status(403).send("platform_not_approved");
        return;
      }

      const jwks = await fetchPlatformJwks(String(platform.jwks_url));
      const claims = verifyIdToken(idToken, {
        jwks, clientId: String(platform.client_id), issuer: String(platform.issuer), nonce: String(stateRow.nonce),
      });

      // LTI-spec: id_token.deployment_id MÅ matche registrert plattform (mot cross-deployment token-injeksjon).
      const deploymentId = String(claims["https://purl.imsglobal.org/spec/lti/claim/deployment_id"] ?? "");
      if (platform.deployment_id && deploymentId !== String(platform.deployment_id)) {
        res.status(400).send("deployment_id_mismatch"); return;
      }

      const ags = extractAgs(claims);
      const nrps = extractNrps(claims);
      const context = claims["https://purl.imsglobal.org/spec/lti/claim/context"] as { id?: string; title?: string; label?: string } | undefined;
      const resourceLink = claims["https://purl.imsglobal.org/spec/lti/claim/resource_link"] as { id?: string } | undefined;
      const toolPlatform = claims["https://purl.imsglobal.org/spec/lti/claim/tool_platform"] as { name?: string; guid?: string } | undefined;
      const custom = claims["https://purl.imsglobal.org/spec/lti/claim/custom"] as Record<string, unknown> | undefined;
      const termVal = custom ? (String(custom.term_name ?? custom.term ?? "").trim() || null) : null;
      // Deep Linking: message_type + deep_linking_settings (retur-URL + data).
      const messageType = String(claims["https://purl.imsglobal.org/spec/lti/claim/message_type"] ?? "LtiResourceLinkRequest");
      const dlSettings = claims["https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings"] as { deep_link_return_url?: string; data?: string } | undefined;
      const launchId = newEntityId("ltilaunch");
      await ensureNrpsColumn(pool);
      await pool.query(
        `INSERT INTO role_room_lti_launches (id, platform_id, lti_user_sub, context_id, resource_link_id, ags_lineitems, ags_lineitem, ags_scopes, nrps_url, context_title, context_label, platform_name, term, deep_link_return_url, deep_link_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [launchId, platform.id, String(claims.sub ?? ""), context?.id ?? null, resourceLink?.id ?? null,
         ags?.lineitems ?? null, ags?.lineitem ?? null, JSON.stringify(ags?.scope ?? []), nrps?.url ?? null,
         context?.title ?? null, context?.label ?? null, toolPlatform?.name ?? null, termVal,
         dlSettings?.deep_link_return_url ?? null, dlSettings?.data ?? null],
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
      // Deep-linket ressurs: launchen bærer custom.production_id → åpne produksjonen.
      const customProject = custom ? String(custom.production_id ?? "").trim() : "";
      if (messageType !== "LtiDeepLinkingRequest" && customProject) {
        const pParams = new URLSearchParams({ mode: "production", project: customProject });
        if (sessionToken) pParams.set("rr_session", sessionToken);
        res.redirect(`${APP_URL}?${pParams.toString()}`);
        return;
      }
      // Deep Linking: læreren skal VELGE/OPPRETTE innhold (produksjonsoppgave) →
      // send til deep-link-plukkeren i stedet for vanlig workspace-landing.
      if (messageType === "LtiDeepLinkingRequest") {
        const dlParams = new URLSearchParams({ mode: "education", lti_launch: launchId, deeplink: "1" });
        if (sessionToken) dlParams.set("rr_session", sessionToken);
        res.redirect(`${APP_URL}?${dlParams.toString()}`);
        return;
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

  // ── Canvas-kontekst fra launchen (emne/emnekode/semester/institusjon) ─────
  router.get("/lti/launches/:id/context", requireSession, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT context_id, context_title, context_label, platform_name, term, deep_link_return_url
           FROM role_room_lti_launches WHERE id = $1`,
        [req.params.id],
      );
      const row = r.rows[0];
      if (!row) { res.status(404).json({ error: "not_found" }); return; }
      res.json({
        courseId: (row.context_id as string) ?? null,
        courseTitle: (row.context_title as string) ?? null,
        courseCode: (row.context_label as string) ?? null,
        institution: (row.platform_name as string) ?? null,
        term: (row.term as string) ?? null,
        isDeepLink: !!row.deep_link_return_url,
      });
    } catch (err) {
      // Kolonner mangler (launch ikke self-healet ennå) → tom kontekst.
      if ((err as { code?: string })?.code === "42703") { res.json({ courseId: null, courseTitle: null, courseCode: null, institution: null, term: null, isDeepLink: false }); return; }
      console.warn("[lti] context failed:", (err as Error).message);
      res.status(500).json({ error: "context_failed" });
    }
  });

  // ── Deep Linking-respons: lærer valgte/opprettet produksjon → signert JWT ─
  // tilbake til Canvas (ltiResourceLink som launcher produksjonen). Frontend
  // auto-poster {jwt} til deep_link_return_url.
  router.post("/lti/launches/:id/deep-link-response", requireSession, async (req, res) => {
    const body = (req.body ?? {}) as { projectId?: string; title?: string };
    try {
      const lr = await pool.query(
        `SELECT l.deep_link_return_url, l.deep_link_data, p.client_id, p.issuer, p.deployment_id
           FROM role_room_lti_launches l JOIN role_room_lti_platforms p ON p.id = l.platform_id
          WHERE l.id = $1`,
        [req.params.id],
      );
      const launch = lr.rows[0];
      if (!launch) { res.status(404).json({ error: "not_found" }); return; }
      if (!launch.deep_link_return_url) { res.status(400).json({ error: "not_a_deep_link_launch" }); return; }
      const key = await ensureToolKey(pool);
      const title = (typeof body.title === "string" && body.title.trim()) ? body.title.trim() : "The Role Room-produksjon";
      const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
      // ltiResourceLink → neste launch bærer custom.production_id og åpner produksjonen.
      const contentItems: Record<string, unknown>[] = [{
        type: "ltiResourceLink",
        title,
        url: `${TOOL_BASE}/lti/launch`,
        custom: { production_id: projectId },
      }];
      const jwtStr = signDeepLinkingResponse({
        clientId: String(launch.client_id), issuer: String(launch.issuer), deploymentId: launch.deployment_id ?? null,
        privatePem: key.privatePem, kid: key.kid, data: (launch.deep_link_data as string) ?? null, contentItems,
      });
      res.json({ returnUrl: String(launch.deep_link_return_url), jwt: jwtStr });
    } catch (err) {
      console.error("[lti] deep-link-response failed:", (err as Error).message);
      res.status(500).json({ error: "deep_link_failed" });
    }
  });

  // ── Eksamensklar (Canvas-synkronisert): arbeidskrav godkjent FRA Canvas ───
  // Kjernen i «alt styres fra Canvas»: leser hvert arbeidskravs status via AGS
  // Results (Canvas = fasit), matcher mot NRPS-rosteret, og beregner om hver
  // student har fått ALLE arbeidskrav godkjent → eksamensklar. Ingen parallell
  // Role Room-sannhet: godkjennelsen bor i Canvas-karakterboka.
  router.get("/lti/launches/:id/exam-readiness", requireSession, async (req, res) => {
    const cohortId = typeof req.query.cohortId === "string" ? req.query.cohortId : null;
    const uid = (req as Request & { userId: string }).userId;
    try {
      const roster = await fetchRoster(pool, req.params.id);
      if (!roster.ok) { res.status(roster.status ?? 502).json({ error: roster.error }); return; }
      // Arbeidskravene (våre) for kullet — eid av faglæreren.
      let arbeidskrav: { id: string; title: string }[] = [];
      try {
        const params: unknown[] = [uid];
        let cohortFilter = "";
        if (cohortId) { params.push(cohortId); cohortFilter = ` AND cohort_id = $${params.length}`; }
        const ar = await pool.query(
          `SELECT id, title FROM role_room_education_assignments
            WHERE owner_user_id = $1 AND is_arbeidskrav = true AND status = 'published'${cohortFilter}`,
          params,
        );
        arbeidskrav = ar.rows.map((r) => ({ id: String(r.id), title: String(r.title) }));
      } catch { arbeidskrav = []; }

      // Les hvert arbeidskravs Canvas-resultater (godkjent = full score).
      const perTag = new Map<string, Map<string, boolean>>();
      for (const ak of arbeidskrav) {
        // eslint-disable-next-line no-await-in-loop -- få arbeidskrav; sekvensielt er greit
        const rr = await fetchResults(pool, req.params.id, ak.id);
        const passed = new Map<string, boolean>();
        if (rr.ok) {
          for (const [sub, v] of rr.results) passed.set(sub, v.max > 0 && v.score >= v.max);
        }
        perTag.set(ak.id, passed);
      }

      const total = arbeidskrav.length;
      const students = roster.members
        .filter((m) => m.roles.some((r) => /learner|student/i.test(r)) || m.roles.length === 0)
        .map((m) => {
          const godkjent = arbeidskrav.filter((ak) => perTag.get(ak.id)?.get(m.sub)).length;
          return { sub: m.sub, name: m.name, email: m.email, godkjent, total, examReady: total > 0 && godkjent === total };
        });
      res.json({ totalArbeidskrav: total, arbeidskrav, students });
    } catch (err) {
      console.error("[lti] exam-readiness failed:", (err as Error).message);
      res.status(500).json({ error: "readiness_failed" });
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

  // ── Kull → Canvas-seksjon: forhåndsvis seksjonene i rosteret ──────────────
  // FS lager én Canvas-seksjon per kull; NRPS (rlid-scopet) bærer per-student
  // seksjon. Returnerer distinkte seksjoner m/ antall + hvor mange som mangler
  // seksjonsdata (da degraderer vi til vanlig samle-import). Tom liste = plattformen
  // leverer ikke seksjoner (saLTIre / Canvas uten seksjons-config).
  router.get("/lti/launches/:id/sections", requireSession, async (req, res) => {
    try {
      const roster = await fetchRoster(pool, req.params.id);
      if (!roster.ok) { res.status(roster.status ?? 500).json({ error: roster.error }); return; }
      const { sections, unsectioned } = groupStudentsBySection(roster.members);
      res.json({
        sections: sections.map((s) => ({ section: s.section, studentCount: s.members.length })),
        unsectioned: unsectioned.length,
        totalStudents: roster.members.filter((m) => isStudentRole(m.roles)).length,
      });
    } catch (err) {
      console.error("[lti] sections failed:", (err as Error).message);
      res.status(500).json({ error: "sections_failed" });
    }
  });

  // ── Importer roster gruppert per Canvas-seksjon → ett kull PER seksjon ─────
  // Idempotent «synk»: gjenbruker eksisterende kull m/ samme navn (eier), ellers
  // oppretter det. Studenter uten seksjonsdata hoppes over (rapporteres) med
  // mindre `includeUnsectioned` — da havner de i ett «Uten seksjon»-kull.
  // `nameMap` lar klienten gi seksjonene lesbare kull-navn (ellers = seksjons-id).
  router.post("/lti/launches/:id/import-students-by-section", requireSession, async (req, res) => {
    const body = (req.body ?? {}) as { nameMap?: Record<string, string>; includeUnsectioned?: boolean; namePrefix?: string };
    const userId = (req as Request & { userId: string }).userId;
    try {
      const roster = await fetchRoster(pool, req.params.id);
      if (!roster.ok) { res.status(roster.status ?? 500).json({ error: roster.error }); return; }
      const { sections, unsectioned } = groupStudentsBySection(roster.members);
      if (sections.length === 0 && !(body.includeUnsectioned && unsectioned.length)) {
        res.status(422).json({ error: "no_sections", message: "Rosteret har ingen seksjonsdata fra Canvas — bruk vanlig import." });
        return;
      }

      const prefix = (body.namePrefix ?? "").trim();
      const cohortName = (section: string): string => {
        const mapped = body.nameMap?.[section]?.trim();
        if (mapped) return mapped;
        return prefix ? `${prefix} · ${section}` : section;
      };

      const groups = [
        ...sections.map((s) => ({ key: s.section, name: cohortName(s.section), members: s.members })),
        ...(body.includeUnsectioned && unsectioned.length ? [{ key: "__unsectioned__", name: prefix ? `${prefix} · Uten seksjon` : "Uten seksjon", members: unsectioned }] : []),
      ];

      const results: { cohortId: string; section: string; name: string; added: number; skipped: number; total: number }[] = [];
      for (const g of groups) {
        // Find-or-create kull på (eier, navn) → re-import = synk, ikke duplikat.
        // eslint-disable-next-line no-await-in-loop -- sekvensielt per seksjon holder det enkelt
        const found = await pool.query(
          `SELECT id FROM role_room_education_cohorts WHERE owner_user_id = $1 AND name = $2 LIMIT 1`,
          [userId, g.name],
        );
        let cohortId = found.rows[0]?.id as string | undefined;
        if (!cohortId) {
          cohortId = newEntityId("cohort");
          // eslint-disable-next-line no-await-in-loop
          await pool.query(
            `INSERT INTO role_room_education_cohorts (id, owner_user_id, name) VALUES ($1,$2,$3)`,
            [cohortId, userId, g.name],
          );
        }
        // eslint-disable-next-line no-await-in-loop
        const existing = await pool.query(
          `SELECT lower(email) AS email FROM role_room_education_students WHERE cohort_id = $1 AND email IS NOT NULL`,
          [cohortId],
        );
        const seen = new Set<string>(existing.rows.map((r) => String(r.email)));
        let added = 0, skipped = 0;
        for (const m of g.members) {
          const email = (m.email ?? "").trim();
          const emailKey = email.toLowerCase();
          const name = (m.name ?? "").trim() || (email ? email.split("@")[0] : "");
          if (!name || (emailKey && seen.has(emailKey))) { skipped++; continue; }
          if (emailKey) seen.add(emailKey);
          // eslint-disable-next-line no-await-in-loop
          await pool.query(
            `INSERT INTO role_room_education_students (id, cohort_id, owner_user_id, name, email)
             VALUES ($1,$2,$3,$4,$5)`,
            [newEntityId("student"), cohortId, userId, name, email || null],
          );
          added++;
        }
        results.push({ cohortId, section: g.key, name: g.name, added, skipped, total: g.members.length });
      }
      res.status(201).json({ cohorts: results, unsectioned: body.includeUnsectioned ? 0 : unsectioned.length });
    } catch (err) {
      console.error("[lti] import-by-section failed:", (err as Error).message);
      res.status(500).json({ error: "import_failed" });
    }
  });

  router.post("/lti/launches/:id/grade", requireSession, async (req, res) => {
    const b = (req.body ?? {}) as {
      grade?: string; scoreGiven?: number; scoreMaximum?: number; comment?: string; label?: string;
      ltiUserSub?: string; studentEmail?: string; resourceTag?: string;
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
    // AGS-korrekthet: score må være endelig, ikke-negativ, maks > 0, given ≤ maks.
    if (!Number.isFinite(scoreGiven) || !Number.isFinite(scoreMaximum) ||
        scoreGiven < 0 || scoreMaximum <= 0 || scoreGiven > scoreMaximum) {
      res.status(422).json({ error: "score_out_of_bounds", message: "scoreGiven må være mellom 0 og scoreMaximum, og scoreMaximum > 0." });
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
      const resourceTag = typeof b.resourceTag === "string" && b.resourceTag.trim() ? b.resourceTag.trim() : undefined;

      // ── HARD EKSAMENS-GATE (Canvas = fasit) ──────────────────────────────
      // Er oppgaven en eksamen/sluttvurdering? Da MÅ alle kullets arbeidskrav
      // være godkjent i Canvas for studenten før karakteren kan settes.
      if (resourceTag && targetUserSub) {
        const ax = await pool.query(
          `SELECT is_exam, cohort_id, owner_user_id FROM role_room_education_assignments WHERE id = $1`,
          [resourceTag],
        );
        const exam = ax.rows[0];
        if (exam?.is_exam && exam.cohort_id) {
          const akRes = await pool.query(
            `SELECT id, title FROM role_room_education_assignments
              WHERE owner_user_id = $1 AND cohort_id = $2 AND is_arbeidskrav = true AND status = 'published'`,
            [exam.owner_user_id, exam.cohort_id],
          );
          const missing: string[] = [];
          for (const ak of akRes.rows) {
            // eslint-disable-next-line no-await-in-loop -- få arbeidskrav; sekvensielt greit
            const rr = await fetchResults(pool, req.params.id, String(ak.id));
            const v = rr.ok ? rr.results.get(String(targetUserSub)) : undefined;
            const passed = !!v && v.max > 0 && v.score >= v.max;
            if (!passed) missing.push(String(ak.title));
          }
          if (missing.length > 0) {
            res.status(409).json({
              error: "arbeidskrav_not_complete",
              message: `Kan ikke sette eksamenskarakter: ${missing.length} arbeidskrav er ikke godkjent i Canvas (${missing.slice(0, 3).join(", ")}${missing.length > 3 ? " …" : ""}).`,
              missing,
            });
            return;
          }
        }
      }

      const result = await pushScore(pool, req.params.id, { scoreGiven, scoreMaximum, comment: b.comment, label: b.label, targetUserSub, resourceTag });
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
  input: { scoreGiven: number; scoreMaximum: number; comment?: string; label?: string; targetUserSub?: string; resourceTag?: string },
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
  const tokenRes = await fetchPlatform(String(platform.token_url), {
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

  // Line item (Canvas gradebook-kolonne). Med resourceTag (oppgave-id) får HVER
  // oppgave sin EGEN kolonne: finn line item m/ tag=oppgave-id, ellers opprett.
  // Uten resourceTag: eksisterende oppførsel (launchens default line item).
  let lineitem: string | null = null;
  // Registrert scoreMaximum på gjenbrukt lineitem (Canvas' egen kolonne-skala).
  // Score MÅ sendes mot DENNE, ellers skalerer LMS karakteren feil.
  let lineitemMax: number | null = null;
  if (input.resourceTag && launch.ags_lineitems) {
    const base = String(launch.ags_lineitems);
    const sep = base.includes("?") ? "&" : "?";
    try {
      const findRes = await fetchPlatform(`${base}${sep}tag=${encodeURIComponent(input.resourceTag)}`, {
        headers: { Authorization: `Bearer ${access_token}`, Accept: "application/vnd.ims.lis.v2.lineitemcontainer+json" },
      });
      if (findRes.ok) {
        const arr = (await findRes.json()) as Array<{ id?: string; scoreMaximum?: number }>;
        if (Array.isArray(arr) && arr[0]?.id) {
          lineitem = String(arr[0].id);
          if (typeof arr[0].scoreMaximum === "number" && arr[0].scoreMaximum > 0) lineitemMax = arr[0].scoreMaximum;
        }
      }
    } catch { /* faller gjennom til opprettelse */ }
    if (!lineitem) {
      const liRes = await fetchPlatform(base, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/vnd.ims.lis.v2.lineitem+json" },
        body: JSON.stringify(buildLineItem({ label: input.label ?? "Oppgave", scoreMaximum: input.scoreMaximum, tag: input.resourceTag, resourceLinkId: launch.resource_link_id ?? undefined })),
      });
      if (!liRes.ok) return { ok: false, error: "lineitem_failed", status: 502 };
      lineitem = String(((await liRes.json()) as { id?: string }).id ?? "");
    }
  } else {
    lineitem = launch.ags_lineitem ?? null;
    if (!lineitem && launch.ags_lineitems) {
      const liRes = await fetchPlatform(String(launch.ags_lineitems), {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/vnd.ims.lis.v2.lineitem+json" },
        body: JSON.stringify(buildLineItem({ label: input.label ?? "The Role Room", scoreMaximum: input.scoreMaximum, resourceLinkId: launch.resource_link_id ?? undefined })),
      });
      if (!liRes.ok) return { ok: false, error: "lineitem_failed", status: 502 };
      lineitem = String(((await liRes.json()) as { id?: string }).id ?? "");
    }
  }
  if (!lineitem) return { ok: false, error: "no_lineitem", status: 400 };

  // Reskalér mot lineitemens registrerte maks om den avviker fra kallets maks,
  // slik at forholdstallet bevares i LMS-kolonnen (AGS-korrekthet).
  let outGiven = input.scoreGiven;
  let outMax = input.scoreMaximum;
  if (lineitemMax != null && input.scoreMaximum > 0 && lineitemMax !== input.scoreMaximum) {
    outGiven = (input.scoreGiven / input.scoreMaximum) * lineitemMax;
    outMax = lineitemMax;
  }
  const scoreUrl = lineitem.includes("/scores") ? lineitem : `${lineitem.replace(/\?.*$/, "")}/scores`;
  const scoreRes = await fetchPlatform(scoreUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/vnd.ims.lis.v1.score+json" },
    body: JSON.stringify(buildScore({ userId: String(targetUserSub), scoreGiven: outGiven, scoreMaximum: outMax, comment: input.comment })),
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
  const tokenRes = await fetchPlatform(String(platform.token_url), {
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

  const nrpsHeaders = { Authorization: `Bearer ${access_token}`, Accept: "application/vnd.ims.lti-nrps.v2.membershipcontainer+json" };

  // rlid-scopet NRPS får Canvas til å inkludere per-medlem `message` med
  // seksjonsdata (lis.course_section_sourcedid / custom.section_*). Vi prøver
  // dét FØRST (for kull→seksjon-mapping); faller trygt tilbake til den ustopte
  // varianten (E2E-verifisert mot saLTIre) om plattformen ikke svarer OK.
  let container: unknown | null = null;
  if (launch.resource_link_id) {
    try {
      const scopedUrl = new URL(String(launch.nrps_url));
      scopedUrl.searchParams.set("rlid", String(launch.resource_link_id));
      const scopedRes = await fetchPlatform(scopedUrl.toString(), { headers: nrpsHeaders });
      if (scopedRes.ok) container = await scopedRes.json();
    } catch { /* fall through til uscopet under */ }
  }
  if (container === null) {
    const memRes = await fetchPlatform(String(launch.nrps_url), { headers: nrpsHeaders });
    if (!memRes.ok) return { ok: false, error: "roster_fetch_failed", status: 502 };
    container = await memRes.json();
  }
  return { ok: true, members: parseRosterMembers(container) };
}

/**
 * AGS Results: leser tilbake hva Canvas har registrert på en gradebook-kolonne
 * (line item) identifisert ved tag (oppgave-id). Returnerer per LMS-sub:
 * score/maks. Slik leser Role Room arbeidskrav-status FRA Canvas (Canvas = fasit),
 * i stedet for kun egen DB — hele eksamens-gaten er dermed Canvas-synkronisert.
 * Fail-safe: tom map ved manglende kolonne/feil (ingen registrerte resultater).
 */
export async function fetchResults(
  pool: Pool, launchId: string, resourceTag: string,
): Promise<{ ok: true; results: Map<string, { score: number; max: number }> } | { ok: false; error: string; status?: number }> {
  const lr = await pool.query(`SELECT * FROM role_room_lti_launches WHERE id = $1`, [launchId]);
  const launch = lr.rows[0];
  if (!launch) return { ok: false, error: "launch_not_found", status: 404 };
  if (!launch.ags_lineitems) return { ok: true, results: new Map() };
  const pr = await pool.query(`SELECT * FROM role_room_lti_platforms WHERE id = $1`, [launch.platform_id]);
  const platform = pr.rows[0];
  if (!platform) return { ok: false, error: "platform_not_found", status: 404 };

  const key = await ensureToolKey(pool);
  const assertion = signClientAssertion({ clientId: String(platform.client_id), tokenUrl: String(platform.token_url), privatePem: key.privatePem, kid: key.kid });
  const tokenRes = await fetchPlatform(String(platform.token_url), {
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

  const base = String(launch.ags_lineitems);
  const sep = base.includes("?") ? "&" : "?";
  const findRes = await fetchPlatform(`${base}${sep}tag=${encodeURIComponent(resourceTag)}`, {
    headers: { Authorization: `Bearer ${access_token}`, Accept: "application/vnd.ims.lis.v2.lineitemcontainer+json" },
  });
  if (!findRes.ok) return { ok: true, results: new Map() };
  const arr = (await findRes.json()) as Array<{ id?: string }>;
  const lineitem = Array.isArray(arr) && arr[0]?.id ? String(arr[0].id) : null;
  if (!lineitem) return { ok: true, results: new Map() };

  const resultsUrl = lineitem.includes("/results") ? lineitem : `${lineitem.replace(/\?.*$/, "")}/results`;
  const resRes = await fetchPlatform(resultsUrl, {
    headers: { Authorization: `Bearer ${access_token}`, Accept: "application/vnd.ims.lis.v2.resultcontainer+json" },
  });
  if (!resRes.ok) return { ok: true, results: new Map() };
  const rc = (await resRes.json()) as Array<{ userId?: string; resultScore?: number; resultMaximum?: number }>;
  const map = new Map<string, { score: number; max: number }>();
  if (Array.isArray(rc)) {
    for (const r of rc) {
      if (r.userId) map.set(String(r.userId), { score: Number(r.resultScore ?? 0), max: Number(r.resultMaximum ?? 0) });
    }
  }
  return { ok: true, results: map };
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
