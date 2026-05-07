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
  'pages_manage_posts',
  'publish_video',
  'business_management',
  'ads_read',
  'ads_management',
  'attribution_read',
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

export async function fetchMetaUserId(userAccessToken: string): Promise<string | null> {
  try {
    const url = `${META_GRAPH_BASE}/me?` + new URLSearchParams({
      fields: 'id',
      access_token: userAccessToken,
    }).toString();
    const resp = (await metaGet(url)) as { id?: string };
    return resp.id ?? null;
  } catch {
    return null;
  }
}

export type IgAccountType = 'BUSINESS' | 'CREATOR' | 'PERSONAL';

export interface IgProfileMetadata {
  username: string | null;
  accountType: IgAccountType | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  mediaCount: number | null;
}

export interface MetaPageWithIgAccount {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  igBusinessAccountId: string;
  igUsername: string | null;
  profile: IgProfileMetadata;
}

/**
 * Hent IG profile metadata. Returnerer null hvis kontoen ikke er
 * BUSINESS eller CREATOR (Personal IG kan ikke bruke Graph API publish
 * og er derfor ekskludert per Meta-policy).
 */
export async function fetchIgProfileMetadata(
  igBusinessAccountId: string,
  pageAccessToken: string,
): Promise<IgProfileMetadata | null> {
  try {
    const url =
      `${META_GRAPH_BASE}/${igBusinessAccountId}?` +
      new URLSearchParams({
        fields: 'username,account_type,profile_picture_url,followers_count,media_count',
        access_token: pageAccessToken,
      }).toString();
    const resp = (await metaGet(url)) as {
      username?: string;
      account_type?: string;
      profile_picture_url?: string;
      followers_count?: number;
      media_count?: number;
    };
    const accountType = ((): IgAccountType | null => {
      const t = (resp.account_type ?? '').toUpperCase();
      if (t === 'BUSINESS' || t === 'CREATOR' || t === 'PERSONAL') return t;
      return null;
    })();
    return {
      username: resp.username ?? null,
      accountType,
      profilePictureUrl: resp.profile_picture_url ?? null,
      followersCount:
        typeof resp.followers_count === 'number' ? resp.followers_count : null,
      mediaCount: typeof resp.media_count === 'number' ? resp.media_count : null,
    };
  } catch (error) {
    console.warn('[ig-oauth] fetchIgProfileMetadata failed', error);
    return null;
  }
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

      // Step 3: fetch full profile metadata.
      const profile = await fetchIgProfileMetadata(igId, page.access_token);
      if (!profile) continue;

      // Step 4: gate on account_type — Meta-policy krever BUSINESS eller
      // CREATOR for Graph API content publish. Personal IG avvises.
      if (profile.accountType !== 'BUSINESS' && profile.accountType !== 'CREATOR') {
        console.warn(
          `[ig-oauth] rejecting IG ${igId} on Page ${page.id}: account_type=${profile.accountType ?? 'unknown'} (only BUSINESS/CREATOR supported)`,
        );
        continue;
      }

      accounts.push({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        igBusinessAccountId: igId,
        igUsername: profile.username,
        profile,
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
  fbUserId: string | null;
  accessToken: string; // decrypted
  tokenExpiresAt: Date | null;
  scopes: string[];
  connectionState: 'connected' | 'expired' | 'revoked' | 'error';
  lastError: string | null;
  // Profil-metadata for App Review + UI-rendering. Hentes ved oppkobling
  // og oppdateres hver gang token blir refreshet.
  accountType: IgAccountType | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  mediaCount: number | null;
  profileRefreshedAt: Date | null;
}

function mapRow(row: Record<string, unknown>): InstagramConnectionRow {
  const accountTypeRaw = (row.account_type as string | null) ?? null;
  const accountType: IgAccountType | null =
    accountTypeRaw === 'BUSINESS' || accountTypeRaw === 'CREATOR' || accountTypeRaw === 'PERSONAL'
      ? accountTypeRaw
      : null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: (row.project_id as string | null) ?? null,
    igBusinessAccountId: String(row.ig_business_account_id),
    igUsername: (row.ig_username as string | null) ?? null,
    facebookPageId: String(row.facebook_page_id),
    facebookPageName: (row.facebook_page_name as string | null) ?? null,
    fbUserId: (row.fb_user_id as string | null) ?? null,
    accessToken: decryptInstagramToken(row.access_token_encrypted as string) ?? '',
    tokenExpiresAt: (row.token_expires_at as Date | null) ?? null,
    scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
    connectionState: (row.connection_state as InstagramConnectionRow['connectionState']) ?? 'connected',
    lastError: (row.last_error as string | null) ?? null,
    accountType,
    profilePictureUrl: (row.profile_picture_url as string | null) ?? null,
    followersCount:
      typeof row.followers_count === 'number'
        ? (row.followers_count as number)
        : row.followers_count != null
          ? Number(row.followers_count) || null
          : null,
    mediaCount:
      typeof row.media_count === 'number'
        ? (row.media_count as number)
        : row.media_count != null
          ? Number(row.media_count) || null
          : null,
    profileRefreshedAt: (row.profile_refreshed_at as Date | null) ?? null,
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
    fbUserId: string | null;
  },
): Promise<InstagramConnectionRow | null> {
  const encrypted = encryptInstagramToken(input.longLivedToken);
  if (!encrypted) {
    throw new Error('Klarer ikke kryptere token — sett ROLE_ROOM_TOKEN_ENCRYPTION_KEY eller AUTH_SECRET.');
  }
  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
  const profile = input.page.profile;
  try {
    const result = await pool.query(
      `INSERT INTO role_room_instagram_connections (
         user_id, project_id, ig_business_account_id, ig_username,
         facebook_page_id, facebook_page_name, fb_user_id,
         access_token_encrypted, token_expires_at, scopes, connection_state,
         last_refreshed_at, last_error,
         account_type, profile_picture_url, followers_count, media_count,
         profile_refreshed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], 'connected', now(), NULL,
                 $11, $12, $13, $14, now())
       ON CONFLICT (user_id, ig_business_account_id)
         WHERE connection_state = 'connected'
       DO UPDATE SET
         ig_username = EXCLUDED.ig_username,
         facebook_page_id = EXCLUDED.facebook_page_id,
         facebook_page_name = EXCLUDED.facebook_page_name,
         fb_user_id = COALESCE(EXCLUDED.fb_user_id, role_room_instagram_connections.fb_user_id),
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         token_expires_at = EXCLUDED.token_expires_at,
         scopes = EXCLUDED.scopes,
         connection_state = 'connected',
         last_refreshed_at = now(),
         last_error = NULL,
         account_type = EXCLUDED.account_type,
         profile_picture_url = EXCLUDED.profile_picture_url,
         followers_count = EXCLUDED.followers_count,
         media_count = EXCLUDED.media_count,
         profile_refreshed_at = now(),
         updated_at = now()
       RETURNING *`,
      [
        input.userId,
        input.projectId,
        input.page.igBusinessAccountId,
        input.page.igUsername,
        input.page.pageId,
        input.page.pageName,
        input.fbUserId,
        encrypted,
        expiresAt,
        input.scopes,
        profile.accountType,
        profile.profilePictureUrl,
        profile.followersCount,
        profile.mediaCount,
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

/**
 * Kall Meta sin /me/permissions DELETE for å revokere appens permission
 * fra brukerens Meta-konto. Best-effort — vi marker connection som revoked
 * uansett, men logger feil for å hjelpe debugging hvis Meta-revoke feiler.
 */
async function revokeMetaPermission(accessToken: string): Promise<boolean> {
  try {
    const url = `${META_GRAPH_BASE}/me/permissions?access_token=${encodeURIComponent(accessToken)}`;
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn(`[ig-oauth] Meta /me/permissions revoke returned ${response.status}: ${text.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[ig-oauth] Meta /me/permissions revoke failed', error);
    return false;
  }
}

export async function revokeConnection(
  pool: Pool,
  connectionId: string,
  userId: string,
): Promise<boolean> {
  // Hent connection først så vi har access_token til Meta-revoke.
  const connection = await getConnection(pool, connectionId, userId);
  if (!connection || connection.connectionState !== 'connected') return false;

  // Best-effort revoke på Meta-siden FØR vi merker rad-en som revoked,
  // for at tokenet skal være ugyldiggjort umiddelbart hos Meta også.
  if (connection.accessToken) {
    await revokeMetaPermission(connection.accessToken);
  }

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

/**
 * Generic helper: abonner appen vår på Meta webhook-felter for et
 * gitt asset (IG Business Account ELLER FB Page) via /{asset_id}/subscribed_apps.
 * Brukes av både subscribeIgWebhookFields og subscribeFbPageWebhookFields.
 */
async function subscribeAssetWebhookFields(
  assetId: string,
  pageAccessToken: string,
  fields: string[],
  logTag: string,
): Promise<boolean> {
  try {
    const url = `${META_GRAPH_BASE}/${assetId}/subscribed_apps`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        subscribed_fields: fields.join(','),
        access_token: pageAccessToken,
      }).toString(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn(
        `[${logTag}] subscribe to webhook fields failed for ${assetId}: ${response.status} ${text.slice(0, 200)}`,
      );
      return false;
    }
    const body = (await response.json().catch(() => ({}))) as { success?: boolean };
    return body.success === true;
  } catch (error) {
    console.warn(`[${logTag}] subscribeAssetWebhookFields threw`, error);
    return false;
  }
}

/**
 * Abonner appen vår på webhook-felter for IG Business Account.
 * Krever at Meta-app-konfigen har webhook callback URL satt + at
 * appen har 'instagram_manage_comments' scope (for comments-feltet).
 *
 * Default-felter: 'comments' + 'mentions' + 'live_comments'.
 *
 * Best-effort — feiler ikke connect-flyt om Meta avviser. Returnerer
 * true hvis subscription gikk gjennom.
 */
export async function subscribeIgWebhookFields(
  igBusinessAccountId: string,
  pageAccessToken: string,
  fields: string[] = ['comments', 'mentions', 'live_comments'],
): Promise<boolean> {
  return subscribeAssetWebhookFields(igBusinessAccountId, pageAccessToken, fields, 'ig-oauth');
}

/**
 * Abonner appen vår på webhook-felter for FB Page (feed, mention, messages).
 * Default-felter dekker comments + reactions (via 'feed'), tags ('mention'),
 * og DMs ('messages'). Best-effort.
 */
export async function subscribeFbPageWebhookFields(
  pageId: string,
  pageAccessToken: string,
  fields: string[] = ['feed', 'mention', 'messages'],
): Promise<boolean> {
  return subscribeAssetWebhookFields(pageId, pageAccessToken, fields, 'fb-oauth');
}

export const META_REQUIRED_SCOPES = REQUIRED_SCOPES;
export const META_GRAPH_API_VERSION = META_GRAPH_VERSION;
