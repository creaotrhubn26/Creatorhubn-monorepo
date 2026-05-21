// @ts-nocheck
/**
 * google-oauth-shared.ts — Slice 9X.80
 *
 * Sentralisert Google OAuth-token-håndtering for hele monorepoet.
 *
 * Konsoliderer tre tidligere duplikater:
 *   - decryptToken (base64 packed: iv+tag+ciphertext)        — google-calendar-project, chat-gmail-poller
 *   - decryptRoleRoomGoogleToken (v1.iv.tag.encrypted)       — google-chat-health, google-meet, communication-routes, contract-google-signing, role-room-routes
 *   - encryptGoogleToken (iv.tag.encrypted, no version)      — creatorhub-google-routes
 *
 * Disse var inkompatible: et token kryptert i én modul kunne ikke
 * dekrypteres i en annen. Resultat: brukere måtte logge inn på nytt
 * når et annet feature trengte token enn det som skrev det.
 *
 * Den nye decryptGoogleToken() auto-detekterer format og støtter alle
 * tre. encryptGoogleToken() skriver i v1-format slik at både gamle og
 * nye dekrypterere fungerer.
 *
 * Auto-refresh: getRefreshedAccessToken() sjekker expiry og bytter
 * tokenet før det går ut. Persisterer den nye eksplisitt slik at neste
 * kall ikke trenger refresh igjen.
 */

import crypto from 'crypto';
import type { Pool } from 'pg';
import { google } from 'googleapis';
import {
  getGoogleWorkspaceOauthConfig,
  normalizeGoogleWorkspaceOauthApp,
  type GoogleWorkspaceOauthApp,
} from './google-workspace-oauth.js';

// ─── Krypteringsnøkkel ──────────────────────────────────────────────
// Samme nøkkel-prioritetsliste som tidligere duplikater hadde, slik at
// existing tokens i prod fortsatt kan dekrypteres uten re-migrering.
function readStringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function deriveGoogleEncryptionKey(envHint?: string): Buffer | null {
  const secret = readStringValue(
    (envHint ? process.env[envHint] : undefined)
    ?? process.env.CREATORHUB_GOOGLE_TOKEN_ENCRYPTION_KEY
    ?? process.env.ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY
    ?? process.env.ROLE_ROOM_ENCRYPTION_KEY
    ?? process.env.SESSION_SECRET
    ?? process.env.JWT_SECRET
    ?? process.env.AUTH_SECRET,
  );
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
}

// ─── Decrypt ────────────────────────────────────────────────────────
/**
 * Decrypter et Google-token uavhengig av format. Returnerer null hvis
 * verdien er tom, nøkkelen mangler, eller payloadet er korrupt.
 *
 * Støtter:
 *   1. v1.iv.tag.encrypted              (4 deler, base64url)  — kanonisk
 *   2. iv.tag.encrypted                 (3 deler, base64url)  — creatorhub-format
 *   3. <base64 av iv(12)+tag(16)+ct>    (én del, standard base64) — calendar/gmail-format
 */
export function decryptGoogleToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = deriveGoogleEncryptionKey();
  if (!key) return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // Format 1 + 2: dot-separert
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    let iv64: string, tag64: string, ct64: string;
    if (parts.length === 4 && parts[0] === 'v1') {
      [, iv64, tag64, ct64] = parts;
    } else if (parts.length === 3) {
      [iv64, tag64, ct64] = parts;
    } else {
      return null;
    }
    try {
      const iv = Buffer.from(iv64, 'base64url');
      const tag = Buffer.from(tag64, 'base64url');
      const ct = Buffer.from(ct64, 'base64url');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
      return plain.toString('utf8');
    } catch {
      return null;
    }
  }

  // Format 3: packed base64
  try {
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length < 28) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}

// ─── Encrypt ────────────────────────────────────────────────────────
/**
 * Encrypter et Google-token i kanonisk v1-format slik at alle eksisterende
 * dekrypterere (inkludert duplikatene) kan lese det.
 */
export function encryptGoogleToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = deriveGoogleEncryptionKey();
  if (!key) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

// ─── Auto-refresh ───────────────────────────────────────────────────
/**
 * Sjekk om et access-token er i ferd med å utløpe. Buffer = 5 minutter
 * for å unngå at langsomme API-kall får 401 midt i flyten.
 */
export function isAccessTokenExpiring(expiryDate?: number | string | null, bufferMs: number = 5 * 60_000): boolean {
  if (expiryDate == null) return true;
  const ts = typeof expiryDate === 'string' ? Date.parse(expiryDate) : Number(expiryDate);
  if (!Number.isFinite(ts)) return true;
  return ts <= Date.now() + bufferMs;
}

export interface GoogleConnectionRow {
  user_id: string | null;
  google_email: string | null;
  oauth_app?: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expiry_date: string | null;
  scopes?: unknown;
  connection_state?: string | null;
}

export interface RefreshedToken {
  accessToken: string;
  refreshToken: string | null;
  expiryDateMs: number;
  scope: string | null;
  tokenType: string | null;
}

/**
 * Hent en gyldig access-token for en bruker — refresh hvis nødvendig.
 * Persisterer det nye tokenet (kryptert) tilbake i role_room_google_connections
 * slik at neste kaller får cache-treff.
 *
 * Oppdaterer også connection_state til 'needs_reauth' hvis Google
 * returnerer invalid_grant / unauthorized_client / invalid_rapt, slik
 * at frontend kan vise "Re-koble til Google".
 */
export async function ensureFreshGoogleAccessToken(
  pool: Pool,
  row: GoogleConnectionRow,
  options: { tableName?: string; bufferMs?: number } = {},
): Promise<{ accessToken: string; refreshToken: string | null; expiryDateMs: number | null; refreshed: boolean }> {
  const tableName = options.tableName || 'role_room_google_connections';
  const accessToken = decryptGoogleToken(row.access_token_encrypted);
  const refreshToken = decryptGoogleToken(row.refresh_token_encrypted);
  const expiryMs = row.expiry_date ? Date.parse(row.expiry_date) : NaN;

  // Hvis vi ikke trenger refresh, returner det vi har
  if (accessToken && !isAccessTokenExpiring(Number.isFinite(expiryMs) ? expiryMs : null, options.bufferMs)) {
    return {
      accessToken,
      refreshToken,
      expiryDateMs: Number.isFinite(expiryMs) ? expiryMs : null,
      refreshed: false,
    };
  }

  if (!refreshToken) {
    // Ingen refresh-token og access-token er ute eller mangler
    await markConnectionNeedsReauth(pool, row.user_id, tableName, 'missing_refresh_token').catch(() => null);
    throw new Error('Google-tilkoblingen mangler refresh-token og access-tokenet er utløpt.');
  }

  // Refresh via OAuth-klient
  const oauthApp = normalizeGoogleWorkspaceOauthApp(row.oauth_app, 'role_room') as GoogleWorkspaceOauthApp;
  const oauthConfig = getGoogleWorkspaceOauthConfig(oauthApp);
  if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
    throw new Error(`Google OAuth-config mangler for app '${oauthApp}'`);
  }

  const oauthClient = new google.auth.OAuth2(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    oauthConfig.redirectUri ?? undefined,
  );
  oauthClient.setCredentials({ refresh_token: refreshToken });

  try {
    const refreshed = await oauthClient.refreshAccessToken();
    const creds = refreshed.credentials ?? oauthClient.credentials;
    const newAccess = readStringValue(creds.access_token);
    if (!newAccess) {
      throw new Error('Google returnerte ingen access-token ved refresh.');
    }
    const newRefresh = readStringValue(creds.refresh_token) || refreshToken;
    const newExpiryMs = typeof creds.expiry_date === 'number'
      ? creds.expiry_date
      : Date.now() + 50 * 60_000;

    // Persistér tilbake til DB — best-effort
    await persistRefreshedTokens(pool, row.user_id, tableName, {
      accessToken: newAccess,
      refreshToken: newRefresh,
      expiryDateMs: newExpiryMs,
      scope: readStringValue(creds.scope),
      tokenType: readStringValue(creds.token_type),
    }).catch((e) => {
      console.warn('[google-oauth-shared] persist failed for', row.user_id, e.message);
    });

    return { accessToken: newAccess, refreshToken: newRefresh, expiryDateMs: newExpiryMs, refreshed: true };
  } catch (err: any) {
    // Klassifiser og markere connection state hvis Google revoker
    const msg = (err?.message || '').toLowerCase();
    const responseData = (err as { response?: { data?: unknown } } | undefined)?.response?.data;
    const combined = `${msg} ${typeof responseData === 'string' ? responseData : JSON.stringify(responseData ?? {})}`.toLowerCase();

    if (combined.includes('invalid_grant') || combined.includes('invalid_rapt')
        || combined.includes('reauth') || combined.includes('unauthorized_client')) {
      await markConnectionNeedsReauth(pool, row.user_id, tableName, 'refresh_token_invalid').catch(() => null);
    }
    throw err;
  }
}

/**
 * Persistér refresh-result kryptert tilbake til DB.
 */
export async function persistRefreshedTokens(
  pool: Pool,
  userId: string | null,
  tableName: string,
  tokens: RefreshedToken,
): Promise<void> {
  if (!userId) return;
  const accessEnc = encryptGoogleToken(tokens.accessToken);
  const refreshEnc = tokens.refreshToken ? encryptGoogleToken(tokens.refreshToken) : null;
  const expiryIso = new Date(tokens.expiryDateMs).toISOString();
  await pool.query(
    `UPDATE ${tableName}
        SET access_token_encrypted = COALESCE($1, access_token_encrypted),
            refresh_token_encrypted = COALESCE($2, refresh_token_encrypted),
            expiry_date = $3,
            connection_state = 'connected',
            last_error = NULL,
            last_used_at = NOW(),
            updated_at = NOW()
      WHERE user_id = $4`,
    [accessEnc, refreshEnc, expiryIso, userId],
  );
}

/**
 * Marker en tilkobling som "needs_reauth" + lagre feilårsak. Brukes
 * når refresh feiler med invalid_grant / reauth required osv.
 * Defensiv mot manglende kolonner.
 */
export async function markConnectionNeedsReauth(
  pool: Pool,
  userId: string | null,
  tableName: string,
  reason: string,
): Promise<void> {
  if (!userId) return;
  try {
    await pool.query(
      `UPDATE ${tableName}
          SET connection_state = 'needs_reauth',
              last_error = $1,
              updated_at = NOW()
        WHERE user_id = $2`,
      [reason.slice(0, 200), userId],
    );
  } catch (e: any) {
    // Hvis last_error-kolonnen mangler, prøv uten den
    if (e?.code === '42703') {
      await pool.query(
        `UPDATE ${tableName}
            SET connection_state = 'needs_reauth', updated_at = NOW()
          WHERE user_id = $1`,
        [userId],
      ).catch(() => null);
    }
  }
}

/**
 * Bekvem-funksjon: hent OAuth2-klient for en bruker med ferskt access-token.
 * Brukes av nye call sites; eksisterende code kan fortsette å bruke
 * sine egne loader-helpers, som internt vil delegere hit i Phase 2.
 */
export async function getGoogleOAuthClient(
  pool: Pool,
  userId: string,
  preferredOauthApp: GoogleWorkspaceOauthApp = 'role_room',
): Promise<InstanceType<typeof google.auth.OAuth2> | null> {
  const result = await pool.query<GoogleConnectionRow>(
    `SELECT user_id, google_email, oauth_app, access_token_encrypted,
            refresh_token_encrypted, expiry_date, scopes, connection_state
       FROM role_room_google_connections
      WHERE user_id = $1
        AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)
      ORDER BY
        CASE WHEN oauth_app = $2 THEN 0 ELSE 1 END,
        CASE WHEN refresh_token_encrypted IS NOT NULL THEN 0 ELSE 1 END,
        last_used_at DESC NULLS LAST,
        updated_at DESC NULLS LAST
      LIMIT 1`,
    [userId, preferredOauthApp],
  ).catch(() => ({ rows: [] as GoogleConnectionRow[] }));

  const row = result.rows[0];
  if (!row) return null;

  const fresh = await ensureFreshGoogleAccessToken(pool, row);
  const oauthApp = normalizeGoogleWorkspaceOauthApp(row.oauth_app, preferredOauthApp) as GoogleWorkspaceOauthApp;
  const oauthConfig = getGoogleWorkspaceOauthConfig(oauthApp);
  if (!oauthConfig.clientId || !oauthConfig.clientSecret) return null;

  const oauthClient = new google.auth.OAuth2(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    oauthConfig.redirectUri ?? undefined,
  );
  oauthClient.setCredentials({
    access_token: fresh.accessToken,
    refresh_token: fresh.refreshToken ?? undefined,
    expiry_date: fresh.expiryDateMs ?? undefined,
  });
  return oauthClient;
}
