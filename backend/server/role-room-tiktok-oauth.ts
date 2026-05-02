/**
 * TikTok OAuth + token-håndtering for The Role Room Agent.
 *
 * Speiler mønsteret fra LinkedIn-integrasjonen:
 *   - AES-256-GCM-kryptering av access + refresh-tokens (samme key-derivasjon)
 *   - upsertConnection() lagrer refresh state etter callback
 *   - ensureFreshConnection() refresher proaktivt før utgang
 *   - resolveTikTokConnection() returnerer dekryptert access_token klar
 *     for bruk i TikTok Content Posting API-kall
 *
 * Scopes:
 *   - user.info.basic   — få display_name + avatar
 *   - video.upload      — upload til kreators inbox (kreator publiserer selv)
 *   - video.publish     — direkte publisering (krever ekstra App Review)
 *
 * For første versjon støtter vi video.upload-flyten (inbox), som er den
 * TikTok-godkjenningen er enklest å få. Direct publish kan slås på når
 * Content Posting API er godkjent — koden er allerede skrevet for å
 * håndtere begge endepunktene.
 */

import crypto from 'crypto';
import type { Pool } from 'pg';

const TIKTOK_AUTH_BASE = 'https://www.tiktok.com/v2/auth/authorize';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';

export const ROLE_ROOM_TIKTOK_SCOPES = [
  'user.info.basic',
  'video.upload',
  // 'video.publish', // Slå på når Content Posting API er godkjent
] as const;

const TOKEN_REFRESH_LEAD_MS = 7 * 24 * 60 * 60 * 1000; // 7 dager før utløp

export interface TikTokConnection {
  id: string;
  userId: string;
  openId: string | null;
  unionId: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  expiryDate: Date | null;
  refreshExpiryDate: Date | null;
  scopes: string[];
  connectionState: string;
  profile: Record<string, unknown>;
}

export interface AuthorizedTikTokConnection {
  connection: TikTokConnection;
  accessToken: string;
}

// ── Crypto ──────────────────────────────────────────────────────────────

function deriveTikTokEncryptionKey(): Buffer | null {
  const raw =
    process.env.ROLE_ROOM_TIKTOK_TOKEN_ENCRYPTION_KEY ||
    process.env.ROLE_ROOM_LINKEDIN_TOKEN_ENCRYPTION_KEY ||
    process.env.ROLE_ROOM_TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  // Samme key-derivasjon som LinkedIn — SHA-256 av input gir 32 byte AES-256-key
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptToken(value: string): string {
  const key = deriveTikTokEncryptionKey();
  if (!key) throw new Error('ROLE_ROOM_TIKTOK_TOKEN_ENCRYPTION_KEY mangler');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = deriveTikTokEncryptionKey();
  if (!key) return null;
  const [version, ivPart, tagPart, encryptedPart] = value.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) return null;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

// ── Config ──────────────────────────────────────────────────────────────

interface TikTokConfig {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  configured: boolean;
  missing: string[];
}

export function getTikTokConfig(): TikTokConfig {
  const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';
  const redirectUri =
    process.env.TIKTOK_REDIRECT_URI ||
    process.env.PUBLIC_APP_URL
      ? `${(process.env.PUBLIC_APP_URL ?? '').replace(/\/$/, '')}/api/role-room/tiktok/oauth/callback`
      : '';
  const missing: string[] = [];
  if (!clientKey) missing.push('TIKTOK_CLIENT_KEY');
  if (!clientSecret) missing.push('TIKTOK_CLIENT_SECRET');
  if (!redirectUri) missing.push('TIKTOK_REDIRECT_URI eller PUBLIC_APP_URL');
  return {
    clientKey,
    clientSecret,
    redirectUri,
    configured: missing.length === 0,
    missing,
  };
}

// ── DB helpers ──────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): TikTokConnection {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    openId: (row.tiktok_open_id as string | null) ?? null,
    unionId: (row.tiktok_union_id as string | null) ?? null,
    username: (row.tiktok_username as string | null) ?? null,
    displayName: (row.tiktok_display_name as string | null) ?? null,
    avatarUrl:
      typeof (row.profile as Record<string, unknown>)?.avatarUrl === 'string'
        ? ((row.profile as Record<string, unknown>).avatarUrl as string)
        : null,
    accessTokenEncrypted: (row.access_token_encrypted as string | null) ?? null,
    refreshTokenEncrypted: (row.refresh_token_encrypted as string | null) ?? null,
    expiryDate: row.expiry_date ? new Date(row.expiry_date as string) : null,
    refreshExpiryDate: row.refresh_expiry_date
      ? new Date(row.refresh_expiry_date as string)
      : null,
    scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
    connectionState: (row.connection_state as string) || 'disconnected',
    profile: (row.profile as Record<string, unknown>) || {},
  };
}

export async function getTikTokConnection(
  pool: Pool,
  userId: string,
): Promise<TikTokConnection | null> {
  const result = await pool.query(
    `SELECT * FROM role_room_tiktok_connections WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

interface UpsertInput {
  userId: string;
  openId: string;
  unionId?: string | null;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresInSec: number;
  refreshExpiresInSec?: number | null;
  scopes: string[];
}

export async function upsertTikTokConnection(
  pool: Pool,
  input: UpsertInput,
): Promise<TikTokConnection> {
  const id = crypto.randomUUID();
  const accessTokenEncrypted = encryptToken(input.accessToken);
  const refreshTokenEncrypted = input.refreshToken ? encryptToken(input.refreshToken) : null;
  const expiry = new Date(Date.now() + input.expiresInSec * 1000);
  const refreshExpiry = input.refreshExpiresInSec
    ? new Date(Date.now() + input.refreshExpiresInSec * 1000)
    : null;
  const profile: Record<string, unknown> = {
    avatarUrl: input.avatarUrl ?? null,
  };

  const result = await pool.query(
    `INSERT INTO role_room_tiktok_connections (
       id, user_id, tiktok_open_id, tiktok_union_id, tiktok_username, tiktok_display_name,
       access_token_encrypted, refresh_token_encrypted, expiry_date, refresh_expiry_date,
       scopes, connection_state, profile, created_at, updated_at, last_used_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, 'connected', $12::jsonb, NOW(), NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       tiktok_open_id = EXCLUDED.tiktok_open_id,
       tiktok_union_id = EXCLUDED.tiktok_union_id,
       tiktok_username = EXCLUDED.tiktok_username,
       tiktok_display_name = EXCLUDED.tiktok_display_name,
       access_token_encrypted = EXCLUDED.access_token_encrypted,
       refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
       expiry_date = EXCLUDED.expiry_date,
       refresh_expiry_date = EXCLUDED.refresh_expiry_date,
       scopes = EXCLUDED.scopes,
       connection_state = 'connected',
       last_error = NULL,
       profile = EXCLUDED.profile,
       updated_at = NOW(),
       last_used_at = NOW()
     RETURNING *`,
    [
      id,
      input.userId,
      input.openId,
      input.unionId ?? null,
      input.username ?? null,
      input.displayName ?? null,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      expiry,
      refreshExpiry,
      JSON.stringify(input.scopes),
      JSON.stringify(profile),
    ],
  );
  return mapRow(result.rows[0]);
}

export async function disconnectTikTok(pool: Pool, userId: string): Promise<void> {
  await pool.query(
    `UPDATE role_room_tiktok_connections
        SET connection_state = 'disconnected',
            access_token_encrypted = NULL,
            refresh_token_encrypted = NULL,
            updated_at = NOW()
      WHERE user_id = $1`,
    [userId],
  );
}

// ── OAuth start + callback ───────────────────────────────────────────────

export interface OauthStartInput {
  userId: string;
  projectId?: string | null;
  returnPath?: string | null;
  browserOrigin?: string | null;
}

export interface OauthStartResult {
  authorizationUrl: string;
  stateId: string;
}

interface PendingState {
  userId: string;
  projectId: string | null;
  returnPath: string | null;
  browserOrigin: string | null;
  createdAt: number;
}

const oauthStateStore = new Map<string, PendingState>();
const STATE_TTL_MS = 15 * 60 * 1000;

function pruneExpiredStates() {
  const cutoff = Date.now() - STATE_TTL_MS;
  for (const [id, state] of oauthStateStore.entries()) {
    if (state.createdAt < cutoff) oauthStateStore.delete(id);
  }
}

export function startTikTokOauth(input: OauthStartInput): OauthStartResult {
  pruneExpiredStates();
  const config = getTikTokConfig();
  if (!config.configured) {
    throw new Error(`TikTok ikke konfigurert: mangler ${config.missing.join(', ')}`);
  }
  const stateId = crypto.randomUUID();
  oauthStateStore.set(stateId, {
    userId: input.userId,
    projectId: input.projectId ?? null,
    returnPath: input.returnPath ?? null,
    browserOrigin: input.browserOrigin ?? null,
    createdAt: Date.now(),
  });
  const params = new URLSearchParams({
    client_key: config.clientKey,
    response_type: 'code',
    scope: ROLE_ROOM_TIKTOK_SCOPES.join(','),
    redirect_uri: config.redirectUri,
    state: stateId,
  });
  return {
    authorizationUrl: `${TIKTOK_AUTH_BASE}/?${params.toString()}`,
    stateId,
  };
}

export function consumeTikTokOauthState(stateId: string): PendingState | null {
  pruneExpiredStates();
  const state = oauthStateStore.get(stateId);
  if (state) oauthStateStore.delete(stateId);
  return state ?? null;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_expires_in?: number;
  open_id?: string;
  scope?: string;
}

async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const config = getTikTokConfig();
  if (!config.configured) {
    throw new Error(`TikTok ikke konfigurert: mangler ${config.missing.join(', ')}`);
  }
  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
  });
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.access_token) {
    const message =
      typeof (data as Record<string, unknown>)?.error_description === 'string'
        ? (data as Record<string, unknown>).error_description
        : (data as Record<string, unknown>)?.error || `HTTP ${response.status}`;
    throw new Error(`TikTok token-utveksling feilet: ${message}`);
  }
  return data as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const config = getTikTokConfig();
  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.access_token) {
    const message =
      typeof (data as Record<string, unknown>)?.error_description === 'string'
        ? (data as Record<string, unknown>).error_description
        : `HTTP ${response.status}`;
    throw new Error(`TikTok token-refresh feilet: ${message}`);
  }
  return data as TokenResponse;
}

interface UserInfo {
  open_id?: string;
  union_id?: string;
  display_name?: string;
  avatar_url?: string;
  username?: string;
}

async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const fields = 'open_id,union_id,display_name,avatar_url,username';
  const response = await fetch(`${TIKTOK_USER_INFO_URL}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`TikTok user.info feilet: HTTP ${response.status}`);
  }
  const user = (data as { data?: { user?: UserInfo } }).data?.user;
  return user ?? {};
}

export async function completeTikTokOauthCallback(
  pool: Pool,
  code: string,
  stateId: string,
): Promise<{ connection: TikTokConnection; pendingState: PendingState | null }> {
  const pendingState = consumeTikTokOauthState(stateId);
  if (!pendingState) {
    throw new Error('TikTok OAuth state expired or invalid');
  }
  const tokenData = await exchangeCodeForToken(code);
  const userInfo = await fetchUserInfo(tokenData.access_token);
  const openId = tokenData.open_id || userInfo.open_id;
  if (!openId) {
    throw new Error('TikTok callback returnerte ikke open_id');
  }
  const scopeArr = (tokenData.scope || '').split(',').map((s) => s.trim()).filter(Boolean);
  const connection = await upsertTikTokConnection(pool, {
    userId: pendingState.userId,
    openId,
    unionId: userInfo.union_id ?? null,
    username: userInfo.username ?? null,
    displayName: userInfo.display_name ?? null,
    avatarUrl: userInfo.avatar_url ?? null,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? null,
    expiresInSec: tokenData.expires_in,
    refreshExpiresInSec: tokenData.refresh_expires_in ?? null,
    scopes: scopeArr.length > 0 ? scopeArr : [...ROLE_ROOM_TIKTOK_SCOPES],
  });
  return { connection, pendingState };
}

// ── Resolve fresh connection for API calls ──────────────────────────────

export async function ensureFreshTikTokConnection(
  pool: Pool,
  userId: string,
): Promise<AuthorizedTikTokConnection | null> {
  const connection = await getTikTokConnection(pool, userId);
  if (!connection || connection.connectionState !== 'connected') return null;
  const accessToken = decryptToken(connection.accessTokenEncrypted);
  if (!accessToken) return null;

  const expiry = connection.expiryDate;
  const needsRefresh =
    !expiry || expiry.getTime() - Date.now() < TOKEN_REFRESH_LEAD_MS;
  if (!needsRefresh) {
    return { connection, accessToken };
  }

  const refreshToken = decryptToken(connection.refreshTokenEncrypted);
  if (!refreshToken) {
    return { connection, accessToken };
  }
  try {
    const fresh = await refreshAccessToken(refreshToken);
    const scopeArr = (fresh.scope || '').split(',').map((s) => s.trim()).filter(Boolean);
    const updated = await upsertTikTokConnection(pool, {
      userId,
      openId: connection.openId ?? '',
      unionId: connection.unionId,
      username: connection.username,
      displayName: connection.displayName,
      avatarUrl: connection.avatarUrl,
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token ?? refreshToken,
      expiresInSec: fresh.expires_in,
      refreshExpiresInSec: fresh.refresh_expires_in ?? null,
      scopes: scopeArr.length > 0 ? scopeArr : connection.scopes,
    });
    return { connection: updated, accessToken: fresh.access_token };
  } catch (error) {
    console.warn('[tiktok-oauth] refresh failed', error);
    return { connection, accessToken };
  }
}
