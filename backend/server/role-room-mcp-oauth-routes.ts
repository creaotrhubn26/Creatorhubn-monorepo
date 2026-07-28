/**
 * role-room-mcp-oauth-routes.ts — OAuth 2.1-endepunkter for «Sign in with The Role Room».
 *
 * Discovery-metadata (RFC 8414/9728) + Dynamic Client Registration (RFC 7591)
 * + authorize (samtykke, PKCE) + token. Monteres på ROT ("/") for at
 * .well-known-stiene skal ligge riktig. Autentisering av brukeren i authorize
 * skjer med brukerens EKTE Role Room-sesjon (loadPersistedAuthSession).
 */

import { Router, type Request, type Router as ExpressRouter } from "express";
import type { Pool } from "pg";
import { loadPersistedAuthSession } from "./auth-session-store.js";
import {
  ensureOAuthTables, registerOAuthClient, getOAuthClient, createAuthCode,
  consumeAuthCode, issueAccessToken, oauthScopesToV1, OAUTH_SUPPORTED_SCOPES,
} from "./role-room-mcp-oauth.js";

function publicBase(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "www.theroleroom.com";
  return `${proto}://${host}`;
}
const OAUTH_BASE = "/api/role-room/mcp/oauth";
// Frontend-samtykke-side (leser innlogget Role Room-sesjon fra localStorage og
// poster til POST .../authorize). Overstyrbar via env.
const CONSENT_URL = process.env.MCP_CONSENT_URL?.trim() || "https://www.theroleroom.com/mcp-connect.html";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export function createRoleRoomMcpOAuthRouter(pool: Pool): ExpressRouter {
  // Body-parsing (JSON/urlencoded) kommer fra app-nivå (samme som MCP-ruteren) —
  // vi monterer IKKE parsere her, siden ruteren ligger på "/" (ville kjørt på
  // hver request og dobbelt-parset globalt).
  const router = Router();

  // ── Discovery: Protected Resource Metadata (RFC 9728) ────────────────────
  router.get("/.well-known/oauth-protected-resource", (req, res) => {
    const base = publicBase(req);
    res.json({
      resource: `${base}/api/role-room/mcp`,
      authorization_servers: [base],
      scopes_supported: OAUTH_SUPPORTED_SCOPES,
      bearer_methods_supported: ["header"],
    });
  });

  // ── Discovery: Authorization Server Metadata (RFC 8414) ──────────────────
  router.get("/.well-known/oauth-authorization-server", (req, res) => {
    const base = publicBase(req);
    res.json({
      issuer: base,
      authorization_endpoint: CONSENT_URL,
      token_endpoint: `${base}${OAUTH_BASE}/token`,
      registration_endpoint: `${base}${OAUTH_BASE}/register`,
      scopes_supported: OAUTH_SUPPORTED_SCOPES,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    });
  });

  // ── Dynamic Client Registration (RFC 7591) ───────────────────────────────
  router.post(`${OAUTH_BASE}/register`, async (req, res) => {
    try {
      await ensureOAuthTables(pool);
      const b = (req.body ?? {}) as { client_name?: string; redirect_uris?: string[] };
      const client = await registerOAuthClient(pool, { clientName: b.client_name, redirectUris: b.redirect_uris ?? [] });
      res.status(201).json({
        client_id: client.clientId,
        client_name: client.clientName ?? undefined,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
      });
    } catch (e) {
      res.status(400).json({ error: "invalid_client_metadata", error_description: (e as Error).message });
    }
  });

  // ── Authorization endpoint (samtykke) ────────────────────────────────────
  // Validerer OAuth-params, autentiserer brukeren via Role Room-sesjon, viser
  // en samtykke-side, og utsteder en engangs-kode ved godkjenning.
  const validateAuthParams = async (q: Record<string, string>) => {
    if (q.response_type !== "code") return { error: "unsupported_response_type" };
    if (!q.client_id || !q.redirect_uri) return { error: "invalid_request" };
    if (!q.code_challenge || q.code_challenge_method !== "S256") return { error: "invalid_request", desc: "PKCE S256 kreves" };
    const client = await getOAuthClient(pool, q.client_id);
    if (!client) return { error: "invalid_client" };
    if (!client.redirectUris.includes(q.redirect_uri)) return { error: "invalid_request", desc: "ukjent redirect_uri" };
    return { ok: true as const };
  };

  router.get(`${OAUTH_BASE}/authorize`, async (req, res) => {
    await ensureOAuthTables(pool);
    const q = req.query as Record<string, string>;
    const v = await validateAuthParams(q);
    if (!("ok" in v)) { res.status(400).send(`Ugyldig forespørsel: ${v.error}${v.desc ? " — " + v.desc : ""}`); return; }
    const scope = esc(q.scope || "mcp:read");
    // Samtykke-side: brukeren limer inn / bekrefter sin Role Room-sesjon.
    res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Koble til The Role Room</title>
<body style="font-family:system-ui;max-width:520px;margin:6vh auto;padding:0 20px;color:#111">
<h2>Koble en app til The Role Room</h2>
<p>En ekstern app ber om tilgang til dine Role Room-data (scope: <b>${scope}</b>).</p>
<p style="color:#555;font-size:14px">Lim inn din Role Room-økt-token (fra kontoinnstillinger) for å godkjenne. Ingenting deles uten din bekreftelse.</p>
<form method="post" action="${OAUTH_BASE}/authorize">
  ${["client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope"].map((k) => `<input type="hidden" name="${k}" value="${esc(q[k] || "")}">`).join("")}
  <input name="rr_session" type="password" placeholder="Role Room økt-token" required style="width:100%;padding:10px;margin:8px 0;border:1px solid #ccc;border-radius:8px">
  <button name="decision" value="approve" style="background:#8B5CF6;color:#fff;border:0;padding:12px 18px;border-radius:8px;font-weight:700;cursor:pointer">Godkjenn</button>
  <button name="decision" value="deny" style="background:#eee;border:0;padding:12px 18px;border-radius:8px;margin-left:8px;cursor:pointer">Avslå</button>
</form></body>`);
  });

  router.post(`${OAUTH_BASE}/authorize`, async (req, res) => {
    await ensureOAuthTables(pool);
    const q = (req.body ?? {}) as Record<string, string>;
    const redirectUri = q.redirect_uri || "";
    const state = q.state || "";
    const deny = () => res.redirect(`${redirectUri}?error=access_denied${state ? `&state=${encodeURIComponent(state)}` : ""}`);
    const v = await validateAuthParams(q);
    if (!("ok" in v)) { res.status(400).send(`Ugyldig forespørsel: ${v.error}`); return; }
    if (q.decision !== "approve") { deny(); return; }
    // Autentiser brukeren via Role Room-sesjon.
    const session = await loadPersistedAuthSession<{ userId?: string }>(pool, q.rr_session);
    if (!session?.userId) { res.status(401).send("Ugyldig Role Room-økt. Prøv igjen."); return; }
    const scope = oauthScopesToV1(q.scope);
    const code = await createAuthCode(pool, {
      clientId: q.client_id, userId: session.userId, redirectUri, scope, codeChallenge: q.code_challenge,
    });
    res.redirect(`${redirectUri}?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ""}`);
  });

  // ── Token endpoint (authorization_code + PKCE) ───────────────────────────
  router.post(`${OAUTH_BASE}/token`, async (req, res) => {
    await ensureOAuthTables(pool);
    const b = (req.body ?? {}) as Record<string, string>;
    if (b.grant_type !== "authorization_code") { res.status(400).json({ error: "unsupported_grant_type" }); return; }
    if (!b.code || !b.client_id || !b.redirect_uri || !b.code_verifier) { res.status(400).json({ error: "invalid_request" }); return; }
    const ex = await consumeAuthCode(pool, { rawCode: b.code, clientId: b.client_id, redirectUri: b.redirect_uri, codeVerifier: b.code_verifier });
    if (!ex.ok) { res.status(400).json({ error: ex.error }); return; }
    const tok = await issueAccessToken(pool, { clientId: b.client_id, userId: ex.userId, scope: ex.scope });
    res.json({ access_token: tok.accessToken, token_type: "Bearer", expires_in: tok.expiresIn, scope: tok.scope.join(" ") });
  });

  return router;
}
