/**
 * Meta / Instagram Graph API OAuth flow for the Role Room feed-planner.
 *
 * Flow (high level):
 *   1. Frontend calls /api/role-room/instagram/oauth/start → we generate a
 *      signed `state` and return the Meta authorization URL.
 *   2. User logs in on Meta, grants `instagram_basic` +
 *      `instagram_content_publish` + `pages_*` scopes, redirected back to
 *      /api/role-room/instagram/oauth/callback?code=...&state=...
 *   3. Callback exchanges code → short-lived user token → long-lived user
 *      token (60 days) → fetches user's FB Pages → for each page asks for
 *      its connected IG Business Account → stores a connection row
 *      per (user, ig_business_account_id).
 *
 * Token refresh: the long-lived user token can be exchanged for a new
 * long-lived token before it expires. ensureFreshConnection() does this
 * lazily before each publish call when the token is within 24h of expiry.
 *
 * All token storage uses the same AES-256-GCM scheme as
 * role_room_google_connections (AUTH_SECRET-derived key, IV+tag+ciphertext
 * encoded as `v1.iv.tag.ciphertext`).
 */

import crypto from 'crypto';
import type { Pool } from 'pg';

const META_GRAPH_VERSION = 'v21.0';
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const META_OAUTH_DIALOG = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

const REQUIRED_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
];

export interface MetaAppConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

export function getMetaAppConfig(): MetaAppConfig | null {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) return null;
  return { appId, appSecret, redirectUri };
}

// ── Encryption (matches role_room_google_connections scheme) ──────────────

function deriveEncryptionKey(): Buffer | null {
  const secret =
    process.env.ROLE_ROOM_TOKEN_ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptInstagramToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = deriveEncryptionKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptInstagramToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = deriveEncryptionKey();
  if (!key) return null;
  const [version, ivPart, tagPart, encryptedPart] = value.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
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

// ── State signing ─────────────────────────────────────────────────────────

interface StateClaims {
  userId: string;
  projectId?: string | null;
  nonce: string;
  iat: number;
}

export function signOauthState(claims: Omit<StateClaims, 'nonce' | 'iat'>): string {
  const secret = process.env.AUTH_SECRET || 'dev-secret-not-for-prod';
  const payload: StateClaims = {
    ...claims,
    nonce: crypto.randomBytes(16).toString('base64url'),
    iat: Math.floor(Date.now() / 1000),
  };
  const json = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret).update(json).digest('base64url');
  return `${Buffer.from(json, 'utf8').toString('base64url')}.${sig}`;
}

export function verifyOauthState(state: string | undefined | null): StateClaims | null {
  if (!state) return null;
  const secret = process.env.AUTH_SECRET || 'dev-secret-not-for-prod';
  const [payloadPart, sig] = state.split('.');
  if (!payloadPart || !sig) return null;
  try {
    const json = Buffer.from(payloadPart, 'base64url').toString('utf8');
    const expectedSig = crypto.createHmac('sha256', secret).update(json).digest('base64url');
    if (expectedSig !== sig) return null;
    const claims = JSON.parse(json) as StateClaims;
    // Reject states older than 10 minutes — prevents replay attacks.
    if (Math.floor(Date.now() / 1000) - claims.iat > 600) return null;
    return claims;
  } catch {
    return null;
  }
}

// ── OAuth URL builders ───────────────────────────────────────────────────

export function buildAuthorizationUrl(state: string): string | null {
  const config = getMetaAppConfig();
  if (!config) return null;
  const loginConfigId = process.env.META_LOGIN_CONFIG_ID?.trim() || null;
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    state,
    response_type: 'code',
  });
  if (loginConfigId) {
    // Facebook Login for Business: scopes come from the saved configuration,
    // so we pass config_id and OMIT the scope parameter (Meta rejects both).
    params.set('config_id', loginConfigId);
  } else {
    // Classic Facebook Login: ask for the scopes inline.
    params.set('scope', REQUIRED_SCOPES.join(','));
    params.set('auth_type', 'rerequest');
  }
  return `${META_OAUTH_DIALOG}?${params.toString()}`;
}

// ── OAuth code exchange ──────────────────────────────────────────────────

interface MetaOauthError {
  message?: string;
  type?: string;
  code?: number;
}

async function metaGet(url: string): Promise<unknown> {
  const response = await fetch(url, { method: 'GET' });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const err = (body as { error?: MetaOauthError } | null)?.error;
    throw new Error(err?.message || `Meta API ${response.status}`);
  }
  return body;
}

export async function exchangeCodeForShortLivedToken(code: string): Promise<{
  accessToken: string;
  expiresIn: number | null;
}> {
  const config = getMetaAppConfig();
  if (!config) throw new Error('META_APP_ID / META_APP_SECRET / META_OAUTH_REDIRECT_URI mangler');
  const url =
    `${META_GRAPH_BASE}/oauth/access_token?` +
    new URLSearchParams({
      client_id: config.appId,
      client_secret: config.appSecret,
      redirect_uri: config.redirectUri,
      code,
    }).toString();
  const data = (await metaGet(url)) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Meta returnerte ingen access_token');
  return {
    accessToken: data.access_token,
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : null,
  };
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const config = getMetaAppConfig();
  if (!config) throw new Error('META_APP_ID / META_APP_SECRET mangler');
  const url =
    `${META_GRAPH_BASE}/oauth/access_token?` +
    new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: config.appId,
      client_secret: config.appSecret,
      fb_exchange_token: shortLivedToken,
    }).toString();
  const data = (await metaGet(url)) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Meta returnerte ingen long-lived token');
  return {
    accessToken: data.access_token,
    // 60-day default if Meta omits expires_in.
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 5_184_000,
  };
}

// ── Page → IG Business Account discovery ─────────────────────────────────

export interface MetaPageWithIgAccount {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  igBusinessAccountId: string;
  igUsername: string | null;
}

export async function discoverIgBusinessAccounts(
  userAccessToken: string,
): Promise<MetaPageWithIgAccount[]> {
  // Step 1: list user's Pages with their per-page access tokens.
  const pagesUrl =
    `${META_GRAPH_BASE}/me/accounts?` +
    new URLSearchParams({
      fields: 'id,name,access_token',
      access_token: userAccessToken,
      limit: '50',
    }).toString();
  const pagesResp = (await metaGet(pagesUrl)) as {
    data?: Array<{ id: string; name: string; access_token: string }>;
  };
  const pages = pagesResp.data ?? [];

  const accounts: MetaPageWithIgAccount[] = [];
  for (const page of pages) {
    // Step 2: ask Meta which IG Business Account is connected to this Page.
    try {
      const igUrl =
        `${META_GRAPH_BASE}/${page.id}?` +
        new URLSearchParams({
          fields: 'instagram_business_account',
          access_token: page.access_token,
        }).toString();
      const igResp = (await metaGet(igUrl)) as {
        instagram_business_account?: { id: string };
      };
      const igId = igResp.instagram_business_account?.id;
      if (!igId) continue;

      // Step 3: fetch IG account username for display.
      let username: string | null = null;
      try {
        const userUrl =
          `${META_GRAPH_BASE}/${igId}?` +
          new URLSearchParams({
            fields: 'username',
            access_token: page.access_token,
          }).toString();
        const userResp = (await metaGet(userUrl)) as { username?: string };
        username = userResp.username ?? null;
      } catch {
        // username is best-effort
      }

      accounts.push({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        igBusinessAccountId: igId,
        igUsername: username,
      });
    } catch {
      // Skip pages without IG accounts attached.
      continue;
    }
  }

  return accounts;
}

// ── Connection persistence ───────────────────────────────────────────────

export interface InstagramConnectionRow {
  id: string;
  userId: string;
  projectId: string | null;
  igBusinessAccountId: string;
  igUsername: string | null;
  facebookPageId: string;
  facebookPageName: string | null;
  accessToken: string; // decrypted
  tokenExpiresAt: Date | null;
  scopes: string[];
  connectionState: 'connected' | 'expired' | 'revoked' | 'error';
  lastError: string | null;
}

function mapRow(row: Record<string, unknown>): InstagramConnectionRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: (row.project_id as string | null) ?? null,
    igBusinessAccountId: String(row.ig_business_account_id),
    igUsername: (row.ig_username as string | null) ?? null,
    facebookPageId: String(row.facebook_page_id),
    facebookPageName: (row.facebook_page_name as string | null) ?? null,
    accessToken: decryptInstagramToken(row.access_token_encrypted as string) ?? '',
    tokenExpiresAt: (row.token_expires_at as Date | null) ?? null,
    scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
    connectionState: (row.connection_state as InstagramConnectionRow['connectionState']) ?? 'connected',
    lastError: (row.last_error as string | null) ?? null,
  };
}

export async function upsertInstagramConnection(
  pool: Pool,
  input: {
    userId: string;
    projectId: string | null;
    page: MetaPageWithIgAccount;
    longLivedToken: string;
    expiresInSeconds: number;
    scopes: string[];
  },
): Promise<InstagramConnectionRow | null> {
  const encrypted = encryptInstagramToken(input.longLivedToken);
  if (!encrypted) {
    throw new Error('Klarer ikke kryptere token — sett ROLE_ROOM_TOKEN_ENCRYPTION_KEY eller AUTH_SECRET.');
  }
  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
  try {
    const result = await pool.query(
      `INSERT INTO role_room_instagram_connections (
         user_id, project_id, ig_business_account_id, ig_username,
         facebook_page_id, facebook_page_name,
         access_token_encrypted, token_expires_at, scopes, connection_state,
         last_refreshed_at, last_error
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], 'connected', now(), NULL)
       ON CONFLICT (user_id, ig_business_account_id)
         WHERE connection_state = 'connected'
       DO UPDATE SET
         ig_username = EXCLUDED.ig_username,
         facebook_page_id = EXCLUDED.facebook_page_id,
         facebook_page_name = EXCLUDED.facebook_page_name,
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         token_expires_at = EXCLUDED.token_expires_at,
         scopes = EXCLUDED.scopes,
         connection_state = 'connected',
         last_refreshed_at = now(),
         last_error = NULL,
         updated_at = now()
       RETURNING *`,
      [
        input.userId,
        input.projectId,
        input.page.igBusinessAccountId,
        input.page.igUsername,
        input.page.pageId,
        input.page.pageName,
        encrypted,
        expiresAt,
        input.scopes,
      ],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  } catch (error) {
    console.error('[ig-oauth] upsert connection failed', error);
    return null;
  }
}

export async function listInstagramConnections(
  pool: Pool,
  userId: string,
): Promise<InstagramConnectionRow[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM role_room_instagram_connections
        WHERE user_id = $1 AND connection_state = 'connected'
        ORDER BY last_refreshed_at DESC NULLS LAST, created_at DESC`,
      [userId],
    );
    return result.rows.map(mapRow);
  } catch (error) {
    console.error('[ig-oauth] list connections failed', error);
    return [];
  }
}

export async function getConnection(
  pool: Pool,
  connectionId: string,
  userId: string,
): Promise<InstagramConnectionRow | null> {
  try {
    const result = await pool.query(
      `SELECT * FROM role_room_instagram_connections WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [connectionId, userId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  } catch (error) {
    console.error('[ig-oauth] get connection failed', error);
    return null;
  }
}

/**
 * Refresh the long-lived user access token if it's within 24h of expiry.
 * Returns the (potentially refreshed) connection.
 */
export async function ensureFreshConnection(
  pool: Pool,
  connection: InstagramConnectionRow,
): Promise<InstagramConnectionRow> {
  if (!connection.tokenExpiresAt) return connection;
  const msUntilExpiry = connection.tokenExpiresAt.getTime() - Date.now();
  if (msUntilExpiry > 24 * 60 * 60 * 1000) return connection;

  try {
    const refreshed = await exchangeForLongLivedToken(connection.accessToken);
    const encrypted = encryptInstagramToken(refreshed.accessToken);
    const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
    await pool.query(
      `UPDATE role_room_instagram_connections
          SET access_token_encrypted = $2,
              token_expires_at = $3,
              last_refreshed_at = now(),
              last_error = NULL,
              updated_at = now()
        WHERE id = $1`,
      [connection.id, encrypted, expiresAt],
    );
    return { ...connection, accessToken: refreshed.accessToken, tokenExpiresAt: expiresAt };
  } catch (error) {
    await pool
      .query(
        `UPDATE role_room_instagram_connections
            SET connection_state = 'expired',
                last_error = $2,
                updated_at = now()
          WHERE id = $1`,
        [connection.id, (error as Error).message.slice(0, 500)],
      )
      .catch(() => {});
    throw error;
  }
}

export async function revokeConnection(
  pool: Pool,
  connectionId: string,
  userId: string,
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE role_room_instagram_connections
          SET connection_state = 'revoked', updated_at = now()
        WHERE id = $1 AND user_id = $2 AND connection_state = 'connected'`,
      [connectionId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[ig-oauth] revoke connection failed', error);
    return false;
  }
}

export const META_REQUIRED_SCOPES = REQUIRED_SCOPES;
export const META_GRAPH_API_VERSION = META_GRAPH_VERSION;
