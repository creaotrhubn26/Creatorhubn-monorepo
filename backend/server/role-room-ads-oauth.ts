/**
 * role-room-ads-oauth.ts
 *
 * Ads-scoped OAuth connections for Google Ads + LinkedIn Ads, stored in
 * role_room_ads_oauth_connections (Migration 130) — intentionally separate from
 * the Workspace/login OAuth flows so we don't force ads-consent on login users.
 *
 *   • upsert/get/list connections (tokens AES-256-GCM encrypted, reusing the
 *     role_room_instagram_connections scheme)
 *   • refreshGoogleAdsAccessToken / refreshLinkedInAccessToken (refresh_token grant)
 *   • ensureFreshAdsToken (auto-refresh near expiry, env client creds)
 *   • resolveAdsAccessToken (platform, userId) → bearer token or null
 *
 * resolveAdsAccessToken is what buildPlatformTokenResolver('google'|'linkedin')
 * calls, so the connectors go live the moment a connection exists + client creds
 * are configured.
 */

import type { Pool } from "pg";
import {
  encryptInstagramToken as encryptToken,
  decryptInstagramToken as decryptToken,
} from "./role-room-instagram-oauth.js";
import type { AdsPlatform } from "./role-room-ads-shared.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
/** Refresh when the token expires within this window. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export interface AdsOauthConnectionRow {
  id: string;
  userId: string;
  platform: AdsPlatform;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  scopes: string[];
  accountRef: string | null;
  connectionState: "connected" | "revoked" | "error";
}

interface FetchLike {
  (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
    text: () => Promise<string>;
  }>;
}

let fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike;
export function __setAdsOauthFetch(impl: FetchLike): void {
  fetchImpl = impl;
}
export function __resetAdsOauthFetch(): void {
  fetchImpl = globalThis.fetch as unknown as FetchLike;
}

function mapRow(row: Record<string, unknown>): AdsOauthConnectionRow {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    platform: row.platform as AdsPlatform,
    accessToken: decryptToken(row.access_token_encrypted as string) ?? "",
    refreshToken: decryptToken(row.refresh_token_encrypted as string | null),
    tokenExpiresAt: (row.token_expires_at as Date | null) ?? null,
    scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
    accountRef: (row.account_ref as string | null) ?? null,
    connectionState:
      (row.connection_state as AdsOauthConnectionRow["connectionState"]) ?? "connected",
  };
}

export interface UpsertAdsOauthInput {
  userId: string;
  platform: AdsPlatform;
  accessToken: string;
  refreshToken?: string | null;
  expiresInSec?: number | null;
  tokenExpiresAt?: Date | null;
  scopes?: string[];
  accountRef?: string | null;
}

export async function upsertAdsOauthConnection(
  pool: Pool,
  input: UpsertAdsOauthInput,
): Promise<AdsOauthConnectionRow | null> {
  const expiresAt =
    input.tokenExpiresAt ??
    (input.expiresInSec ? new Date(Date.now() + input.expiresInSec * 1000) : null);

  const result = await pool.query(
    `INSERT INTO role_room_ads_oauth_connections
       (user_id, platform, access_token_encrypted, refresh_token_encrypted,
        token_expires_at, scopes, account_ref, connection_state, last_refreshed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'connected', now())
     ON CONFLICT (user_id, platform) DO UPDATE SET
       access_token_encrypted = EXCLUDED.access_token_encrypted,
       refresh_token_encrypted =
         COALESCE(EXCLUDED.refresh_token_encrypted, role_room_ads_oauth_connections.refresh_token_encrypted),
       token_expires_at = EXCLUDED.token_expires_at,
       scopes = EXCLUDED.scopes,
       account_ref = COALESCE(EXCLUDED.account_ref, role_room_ads_oauth_connections.account_ref),
       connection_state = 'connected',
       last_error = NULL,
       last_refreshed_at = now(),
       updated_at = now()
     RETURNING *`,
    [
      input.userId,
      input.platform,
      encryptToken(input.accessToken),
      encryptToken(input.refreshToken ?? null),
      expiresAt,
      input.scopes ?? [],
      input.accountRef ?? null,
    ],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function getAdsOauthConnection(
  pool: Pool,
  userId: string,
  platform: AdsPlatform,
): Promise<AdsOauthConnectionRow | null> {
  const result = await pool.query(
    `SELECT * FROM role_room_ads_oauth_connections
      WHERE user_id = $1 AND platform = $2 AND connection_state = 'connected'
      LIMIT 1`,
    [userId, platform],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function listAdsOauthConnections(
  pool: Pool,
  userId: string,
): Promise<AdsOauthConnectionRow[]> {
  const result = await pool.query(
    `SELECT * FROM role_room_ads_oauth_connections WHERE user_id = $1 ORDER BY platform`,
    [userId],
  );
  return result.rows.map(mapRow);
}

// ─────────────────────────────────────────────────────────
// Token refresh (refresh_token grant)
// ─────────────────────────────────────────────────────────

export interface RefreshResult {
  accessToken: string;
  expiresInSec: number | null;
  refreshToken?: string | null;
}

export async function refreshGoogleAdsAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<RefreshResult> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const raw = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !raw.access_token) {
    throw new Error(`google_token_refresh_failed: ${raw.error_description || raw.error || res.status}`);
  }
  return { accessToken: raw.access_token, expiresInSec: raw.expires_in ?? null };
}

export async function refreshLinkedInAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<RefreshResult> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetchImpl(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const raw = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !raw.access_token) {
    throw new Error(`linkedin_token_refresh_failed: ${raw.error_description || raw.error || res.status}`);
  }
  return {
    accessToken: raw.access_token,
    expiresInSec: raw.expires_in ?? null,
    refreshToken: raw.refresh_token ?? null,
  };
}

// ─────────────────────────────────────────────────────────
// Authorization-code flow (consent → tokens)
// ─────────────────────────────────────────────────────────

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";

/** Ads-only scopes — deliberately narrow, separate from login/workspace consent. */
export const ADS_OAUTH_SCOPES: Partial<Record<AdsPlatform, string[]>> = {
  google: ["https://www.googleapis.com/auth/adwords"],
  // r_organization_admin powers the "which Company Pages am I admin of" view.
  linkedin: ["r_ads", "r_ads_reporting", "r_organization_admin"],
};

export function buildAdsAuthUrl(
  platform: AdsPlatform,
  opts: { clientId: string; redirectUri: string; state: string },
): string | null {
  const scopes = ADS_OAUTH_SCOPES[platform];
  if (!scopes) return null;
  if (platform === "google") {
    const p = new URLSearchParams({
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "false",
      state: opts.state,
    });
    return `${GOOGLE_AUTH_URL}?${p.toString()}`;
  }
  if (platform === "linkedin") {
    const p = new URLSearchParams({
      response_type: "code",
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri,
      scope: scopes.join(" "),
      state: opts.state,
    });
    return `${LINKEDIN_AUTH_URL}?${p.toString()}`;
  }
  return null;
}

export async function exchangeAdsCodeForToken(
  platform: AdsPlatform,
  opts: { code: string; clientId: string; clientSecret: string; redirectUri: string },
): Promise<RefreshResult> {
  const tokenUrl =
    platform === "google" ? GOOGLE_TOKEN_URL : platform === "linkedin" ? LINKEDIN_TOKEN_URL : null;
  if (!tokenUrl) throw new Error(`unsupported_platform:${platform}`);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
  });
  const res = await fetchImpl(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const raw = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !raw.access_token) {
    throw new Error(
      `${platform}_code_exchange_failed: ${raw.error_description || raw.error || res.status}`,
    );
  }
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token ?? null,
    expiresInSec: raw.expires_in ?? null,
  };
}

export function adsOauthClientCreds(
  platform: AdsPlatform,
): { clientId: string; clientSecret: string } | null {
  return clientCredsFor(platform);
}

function clientCredsFor(platform: AdsPlatform): { clientId: string; clientSecret: string } | null {
  if (platform === "google") {
    const clientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET;
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  }
  if (platform === "linkedin") {
    const clientId = process.env.LINKEDIN_ADS_OAUTH_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_ADS_OAUTH_CLIENT_SECRET;
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  }
  return null;
}

/**
 * Refresh the token if it's within REFRESH_SKEW_MS of expiry (and a refresh
 * token + client creds exist). Persists the new token. Returns the connection,
 * refreshed or as-is.
 */
export async function ensureFreshAdsToken(
  pool: Pool,
  connection: AdsOauthConnectionRow,
): Promise<AdsOauthConnectionRow> {
  if (!connection.tokenExpiresAt) return connection;
  const msUntilExpiry = connection.tokenExpiresAt.getTime() - Date.now();
  if (msUntilExpiry > REFRESH_SKEW_MS) return connection;
  if (!connection.refreshToken) return connection;

  const creds = clientCredsFor(connection.platform);
  if (!creds) return connection;

  try {
    const refreshed =
      connection.platform === "google"
        ? await refreshGoogleAdsAccessToken(connection.refreshToken, creds.clientId, creds.clientSecret)
        : connection.platform === "linkedin"
          ? await refreshLinkedInAccessToken(connection.refreshToken, creds.clientId, creds.clientSecret)
          : null;
    if (!refreshed) return connection;

    const updated = await upsertAdsOauthConnection(pool, {
      userId: connection.userId,
      platform: connection.platform,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? connection.refreshToken,
      expiresInSec: refreshed.expiresInSec,
      scopes: connection.scopes,
      accountRef: connection.accountRef,
    });
    return updated ?? { ...connection, accessToken: refreshed.accessToken };
  } catch (error) {
    await pool
      .query(
        `UPDATE role_room_ads_oauth_connections SET last_error = $3, updated_at = now()
          WHERE user_id = $1 AND platform = $2`,
        [connection.userId, connection.platform, String(error)],
      )
      .catch(() => {});
    return connection;
  }
}

/** Resolve a usable bearer token for a platform+user, refreshing if needed. */
export async function resolveAdsAccessToken(
  pool: Pool,
  platform: AdsPlatform,
  userId: string,
): Promise<string | null> {
  const connection = await getAdsOauthConnection(pool, userId, platform);
  if (!connection || connection.connectionState !== "connected") return null;
  const fresh = await ensureFreshAdsToken(pool, connection);
  return fresh.accessToken || null;
}
