/**
 * role-room-mcp-oauth.ts — OAuth 2.1 Authorization Server for The Role Room MCP.
 *
 * «Sign in with The Role Room» for MCP-klienter (Claude Desktop/Cursor): brukeren
 * logger inn med sin ekte Role Room-sesjon og samtykker, klienten får et opakt
 * access-token som MCP-serveren godtar (i tillegg til rri_-nøkler).
 *
 * Ren + testbar: alle DB-operasjoner er funksjoner (tar pool). Sikkerhet:
 * PKCE (S256) PÅKREVD, engangs-koder m/ kort levetid, eksakt redirect_uri-match,
 * tokens hashet i ro (SHA256), scopes bundet til v1-scope-vokabularet.
 */

import crypto from "crypto";
import type { Pool } from "pg";

const sha256hex = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const b64url = (buf: Buffer) => buf.toString("base64url");

export const OAUTH_TOKEN_PREFIX = "rmt_"; // role-room mcp token
const CODE_TTL_SEC = 600;                 // 10 min
const TOKEN_TTL_SEC = 60 * 60 * 8;        // 8 t

/** Støttede OAuth-scopes → v1-scopes (samme vokabular som resten av MCP). */
export const OAUTH_SUPPORTED_SCOPES = ["mcp:read", "mcp:write"] as const;
export function oauthScopesToV1(requestedScope: string | undefined): string[] {
  const req = (requestedScope ?? "").split(/\s+/).filter(Boolean);
  const v1 = new Set<string>();
  if (req.length === 0 || req.includes("mcp:read") || req.includes("mcp")) v1.add("projects.read");
  if (req.includes("mcp:write")) { v1.add("projects.read"); v1.add("projects.write"); }
  return [...v1];
}

/** PKCE S256-verifisering: base64url(sha256(verifier)) === challenge. */
export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier || !codeChallenge) return false;
  const computed = b64url(crypto.createHash("sha256").update(codeVerifier).digest());
  // konstant-tid-sammenligning
  const a = Buffer.from(computed), b = Buffer.from(codeChallenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function ensureOAuthTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_mcp_oauth_clients (
      client_id TEXT PRIMARY KEY,
      client_name TEXT,
      redirect_uris TEXT[] NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS role_room_mcp_oauth_codes (
      code_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      scope TEXT[] NOT NULL,
      code_challenge TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS role_room_mcp_oauth_tokens (
      token_hash TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      scope TEXT[] NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export interface OAuthClient { clientId: string; redirectUris: string[]; clientName: string | null }

/** Dynamic Client Registration (RFC 7591). Offentlige klienter (PKCE) — ingen hemmelighet. */
export async function registerOAuthClient(pool: Pool, input: { clientName?: string; redirectUris: string[] }): Promise<OAuthClient> {
  const redirectUris = (input.redirectUris ?? []).filter((u) => typeof u === "string" && /^https?:\/\//.test(u));
  if (redirectUris.length === 0) throw new Error("at_least_one_https_redirect_uri_required");
  const clientId = `rmc_${crypto.randomBytes(16).toString("hex")}`;
  await pool.query(
    `INSERT INTO role_room_mcp_oauth_clients (client_id, client_name, redirect_uris) VALUES ($1,$2,$3)`,
    [clientId, input.clientName ?? null, redirectUris],
  );
  return { clientId, redirectUris, clientName: input.clientName ?? null };
}

export async function getOAuthClient(pool: Pool, clientId: string): Promise<OAuthClient | null> {
  const r = await pool.query(`SELECT client_id, client_name, redirect_uris FROM role_room_mcp_oauth_clients WHERE client_id = $1`, [clientId]);
  const row = r.rows[0];
  return row ? { clientId: row.client_id, clientName: row.client_name, redirectUris: row.redirect_uris } : null;
}

/** Utsteder en engangs-autorisasjonskode bundet til (klient, bruker, scope, PKCE-challenge). */
export async function createAuthCode(pool: Pool, input: {
  clientId: string; userId: string; redirectUri: string; scope: string[]; codeChallenge: string; now?: number;
}): Promise<string> {
  const rawCode = `rma_${crypto.randomBytes(32).toString("hex")}`;
  const expiresAt = new Date((input.now ?? Date.now()) + CODE_TTL_SEC * 1000).toISOString();
  await pool.query(
    `INSERT INTO role_room_mcp_oauth_codes (code_hash, client_id, user_id, redirect_uri, scope, code_challenge, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [sha256hex(rawCode), input.clientId, input.userId, input.redirectUri, input.scope, input.codeChallenge, expiresAt],
  );
  return rawCode;
}

export type CodeExchange = { ok: true; userId: string; scope: string[] } | { ok: false; error: string };

/** Løser inn en kode (RFC 6749 + PKCE): verifiserer klient, redirect_uri, utløp, PKCE — og SLETTER (engangs). */
export async function consumeAuthCode(pool: Pool, input: {
  rawCode: string; clientId: string; redirectUri: string; codeVerifier: string;
}): Promise<CodeExchange> {
  // Engangs: DELETE ... RETURNING gjør innløsningen atomisk.
  const r = await pool.query(
    `DELETE FROM role_room_mcp_oauth_codes WHERE code_hash = $1 RETURNING client_id, user_id, redirect_uri, scope, code_challenge, expires_at`,
    [sha256hex(input.rawCode)],
  );
  const row = r.rows[0];
  if (!row) return { ok: false, error: "invalid_grant" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, error: "invalid_grant" };
  if (row.client_id !== input.clientId) return { ok: false, error: "invalid_grant" };
  if (row.redirect_uri !== input.redirectUri) return { ok: false, error: "invalid_grant" };
  if (!verifyPkceS256(input.codeVerifier, row.code_challenge)) return { ok: false, error: "invalid_grant" };
  return { ok: true, userId: row.user_id, scope: row.scope };
}

/** Utsteder et opakt access-token (lagres hashet). */
export async function issueAccessToken(pool: Pool, input: { clientId: string; userId: string; scope: string[]; now?: number }): Promise<{ accessToken: string; expiresIn: number; scope: string[] }> {
  const accessToken = `${OAUTH_TOKEN_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
  const expiresAt = new Date((input.now ?? Date.now()) + TOKEN_TTL_SEC * 1000).toISOString();
  await pool.query(
    `INSERT INTO role_room_mcp_oauth_tokens (token_hash, client_id, user_id, scope, expires_at) VALUES ($1,$2,$3,$4,$5)`,
    [sha256hex(accessToken), input.clientId, input.userId, input.scope, expiresAt],
  );
  return { accessToken, expiresIn: TOKEN_TTL_SEC, scope: input.scope };
}

/** Validerer et access-token → bruker + scopes, eller null (ukjent/utløpt). */
export async function validateAccessToken(pool: Pool, rawToken: string): Promise<{ userId: string; scope: string[]; clientId: string } | null> {
  if (!rawToken.startsWith(OAUTH_TOKEN_PREFIX)) return null;
  const r = await pool.query(
    `SELECT client_id, user_id, scope, expires_at FROM role_room_mcp_oauth_tokens WHERE token_hash = $1 LIMIT 1`,
    [sha256hex(rawToken)],
  );
  const row = r.rows[0];
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return null;
  return { userId: row.user_id, scope: row.scope, clientId: row.client_id };
}
