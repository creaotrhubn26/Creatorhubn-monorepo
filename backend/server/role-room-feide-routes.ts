/**
 * role-room-feide-routes.ts — Feide (norsk institusjons-innlogging) via OIDC.
 * Mountes under /api/role-room.
 *
 * Institusjonsbrukere (faglærere) logger inn med Feide-identiteten sin i stedet
 * for passord. Standard authorization-code-flyt; identiteten hentes fra Feides
 * userinfo-endepunkt (unngår hånd-validering av id_token-JWT). Provisjonerer/
 * finner brukeren (samme mønster som Google-innlogging) og minter en Role Room-
 * sesjon, deretter redirect til appen med token.
 *
 * 🔑 ENV-GATED: uten FEIDE_CLIENT_ID/SECRET er endepunktene inaktive (503) —
 * null prod-risiko før Daniel registrerer tjenesten i Feide-kundeportalen og
 * setter secrets. State-store er in-memory (single-instance; DB ved skalering).
 *
 * Endepunkter:
 *   GET /api/role-room/feide/login     → redirect til Feide authorize
 *   GET /api/role-room/feide/callback  → code→token→userinfo→sesjon→app
 *   GET /api/role-room/feide/status    → { configured: boolean }
 */

import crypto from "crypto";
import { Router, type Request, type Response, type Router as ExpressRouter } from "express";
import type { Pool } from "pg";
import { persistAuthSession } from "./auth-session-store.js";

interface SessionData {
  userId: string; email: string; name: string; role: string; loginAt: string;
  [key: string]: unknown;
}

export interface FeideConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scope: string;
  appUrl: string;
}

export function readFeideConfig(env: NodeJS.ProcessEnv = process.env): FeideConfig | null {
  const clientId = env.FEIDE_CLIENT_ID?.trim();
  const clientSecret = env.FEIDE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: env.FEIDE_REDIRECT_URI?.trim() || "https://www.theroleroom.com/api/role-room/feide/callback",
    authUrl: env.FEIDE_AUTH_URL?.trim() || "https://auth.dataporten.no/oauth/authorization",
    tokenUrl: env.FEIDE_TOKEN_URL?.trim() || "https://auth.dataporten.no/oauth/token",
    userinfoUrl: env.FEIDE_USERINFO_URL?.trim() || "https://auth.dataporten.no/openid/userinfo",
    scope: env.FEIDE_SCOPE?.trim() || "openid profile email userid",
    appUrl: env.FEIDE_APP_URL?.trim() || "https://www.theroleroom.com/",
  };
}

/** In-memory state-store med TTL (CSRF-vern for OIDC-flyten). */
interface StateStore {
  create(nonce: string): string;
  consume(state: string): { nonce: string } | null;
}
export function makeStateStore(now: () => number = () => Date.now(), ttlMs = 10 * 60 * 1000): StateStore {
  const map = new Map<string, { nonce: string; exp: number }>();
  return {
    create(nonce: string): string {
      const state = crypto.randomBytes(24).toString("hex");
      map.set(state, { nonce, exp: now() + ttlMs });
      return state;
    },
    consume(state: string): { nonce: string } | null {
      const e = map.get(state);
      if (!e) return null;
      map.delete(state);
      if (e.exp < now()) return null;
      return { nonce: e.nonce };
    },
  };
}

export interface FeideUserinfo {
  email?: string;
  name?: string;
  sub?: string;
  [key: string]: unknown;
}

/**
 * Provisjonerer/finner brukeren fra Feide-userinfo og minter en sesjon (speiler
 * Google-innlogging: upsert på users.email, placeholder-passord, profession=
 * education). Eksportert for enhetstesting uten HTTP.
 */
export async function resolveFeideSession(
  pool: Pool,
  info: FeideUserinfo,
  deps: { activeSessions: Map<string, SessionData>; tokenFactory?: () => string; now?: () => Date },
): Promise<{ ok: true; token: string; userId: string } | { ok: false; error: string }> {
  const email = info.email?.toLowerCase().trim();
  if (!email) return { ok: false, error: "email_missing" };
  const fullName = info.name?.trim() || email;

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
    [email, email, placeholderPassword],
  );
  const row = upsert.rows[0];
  if (!row) return { ok: false, error: "user_upsert_failed" };

  const token = (deps.tokenFactory ?? (() => crypto.randomUUID()))();
  const now = (deps.now ?? (() => new Date()))();
  const sessionData: SessionData = {
    userId: String(row.id), email, name: fullName,
    role: (row.role ?? "user").toString(), loginAt: now.toISOString(),
    profession: "education", selectedProfession: "education",
  };
  deps.activeSessions.set(token, sessionData);
  await persistAuthSession(pool, token, sessionData);
  return { ok: true, token, userId: String(row.id) };
}

export interface CreateFeideRouterDeps { activeSessions: Map<string, SessionData>; }

export function createFeideRouter(pool: Pool, deps: CreateFeideRouterDeps): ExpressRouter {
  const router = Router();
  const store = makeStateStore();

  router.get("/feide/status", (_req: Request, res: Response) => {
    res.json({ configured: readFeideConfig() !== null });
  });

  router.get("/feide/login", (_req: Request, res: Response) => {
    const cfg = readFeideConfig();
    if (!cfg) { res.status(503).json({ error: "feide_not_configured" }); return; }
    const nonce = crypto.randomBytes(16).toString("hex");
    const state = store.create(nonce);
    const url = new URL(cfg.authUrl);
    url.searchParams.set("client_id", cfg.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", cfg.redirectUri);
    url.searchParams.set("scope", cfg.scope);
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    res.redirect(url.toString());
  });

  router.get("/feide/callback", async (req: Request, res: Response) => {
    const cfg = readFeideConfig();
    if (!cfg) { res.status(503).json({ error: "feide_not_configured" }); return; }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const fail = (reason: string) => res.redirect(`${cfg.appUrl}?feide_error=${encodeURIComponent(reason)}`);
    if (!code || !state || !store.consume(state)) { fail("invalid_state"); return; }
    try {
      // 1) code → tokens (server-til-server over TLS).
      const tokenRes = await fetch(cfg.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64") },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri }).toString(),
      });
      if (!tokenRes.ok) { fail("token_exchange_failed"); return; }
      const tokens = (await tokenRes.json()) as { access_token?: string };
      if (!tokens.access_token) { fail("no_access_token"); return; }

      // 2) access_token → userinfo (verifisert identitet fra Feide selv).
      const uiRes = await fetch(cfg.userinfoUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      if (!uiRes.ok) { fail("userinfo_failed"); return; }
      const info = (await uiRes.json()) as FeideUserinfo;

      // 3) provisjonér + mint sesjon.
      const result = await resolveFeideSession(pool, info, { activeSessions: deps.activeSessions });
      if (!result.ok) { fail(result.error); return; }

      // 4) redirect til appen med sesjonstoken (frontend plukker den opp).
      res.redirect(`${cfg.appUrl}?rr_session=${encodeURIComponent(result.token)}&mode=education`);
    } catch (err) {
      console.error("[feide] callback failed:", (err as Error).message);
      fail("callback_error");
    }
  });

  return router;
}
