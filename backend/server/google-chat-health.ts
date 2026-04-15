import { existsSync, readFileSync } from 'fs';
import crypto from 'crypto';
import { google } from 'googleapis';
import type { Pool } from 'pg';
import {
  getGoogleWorkspaceOauthConfig,
  normalizeGoogleWorkspaceOauthApp,
} from './google-workspace-oauth.js';

export const GOOGLE_CHAT_REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.spaces.create',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/chat.messages.reactions.create',
] as const;

type GoogleChatCredentialSource =
  | 'role_room_connection'
  | 'env_refresh_token'
  | 'authorized_user_file'
  | 'service_account_file'
  | 'unavailable';

export type GoogleChatLiveHealthCheck = {
  connected: boolean;
  status: 'active' | 'misconfigured' | 'expired' | 'error';
  source: GoogleChatCredentialSource;
  checkedAt: string;
  message: string;
  grantedScopes: string[];
  missingScopes: string[];
  sampleSpace?: {
    name: string | null;
    displayName: string | null;
  } | null;
  connection?: {
    userId: string | null;
    googleEmail: string | null;
    googleSubject: string | null;
  } | null;
};

type ResolvedGoogleCredentialSource =
  | {
      source: 'role_room_connection';
      clientId: string;
      clientSecret: string;
      redirectUri: string | null;
      refreshToken: string | null;
      accessToken: string | null;
      expiryDate: string | null;
      storedScopes: string[];
      userId: string | null;
      googleEmail: string | null;
      googleSubject: string | null;
    }
  | {
      source: 'env_refresh_token' | 'authorized_user_file';
      clientId: string;
      clientSecret: string;
      refreshToken: string;
    }
  | {
      source: 'service_account_file';
      clientEmail: string;
      privateKey: string;
      subject: string | null;
    }
  | {
      source: 'unavailable';
      message: string;
    };

let cachedGoogleChatHealth:
  Map<string, {
    expiresAt: number;
    result: GoogleChatLiveHealthCheck;
  }> = new Map();

function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function uniqueScopes(scopes: readonly string[]): string[] {
  return [...new Set(scopes.filter((scope) => scope.trim().length > 0))];
}

function normalizeGrantedScopes(rawScopes: unknown): string[] {
  if (Array.isArray(rawScopes)) {
    return uniqueScopes(rawScopes.filter((scope): scope is string => typeof scope === 'string'));
  }

  if (typeof rawScopes === 'string') {
    return uniqueScopes(rawScopes.split(/\s+/));
  }

  return [];
}

function shouldForceGoogleAccessTokenRefresh(expiryDate?: number | null): boolean {
  return !Number.isFinite(expiryDate) || Number(expiryDate) <= Date.now() + 60_000;
}

function normalizeGoogleChatAuthError(error: unknown): { status: GoogleChatLiveHealthCheck['status']; message: string } {
  const rawMessage = error instanceof Error ? error.message : String(error ?? 'Google Chat auth failed');
  const responseData = (error as { response?: { data?: unknown } } | undefined)?.response?.data;
  const responsePayload = typeof responseData === 'string' ? responseData : JSON.stringify(responseData ?? {});
  const combined = `${rawMessage} ${responsePayload}`.toLowerCase();

  if (combined.includes('invalid_rapt') || combined.includes('reauth related error')) {
    return {
      status: 'expired',
      message: 'Google krever ny innlogging. Refresh-tokenet må fornyes.',
    };
  }

  if (combined.includes('unauthorized_client')) {
    return {
      status: 'misconfigured',
      message: 'Refresh-tokenet tilhører en annen OAuth-klient enn den som er konfigurert i env.',
    };
  }

  if (combined.includes('invalid_grant')) {
    return {
      status: 'expired',
      message: 'Google refresh-tokenet er ikke lenger gyldig.',
    };
  }

  return {
    status: 'error',
    message: rawMessage,
  };
}

function deriveRoleRoomServiceEncryptionKey(envKeyName: string): Buffer | null {
  const secret = readStringValue(
    process.env[envKeyName]
    ?? process.env.ROLE_ROOM_ENCRYPTION_KEY
    ?? process.env.SESSION_SECRET
    ?? process.env.JWT_SECRET
    ?? process.env.AUTH_SECRET,
  );
  if (!secret) {
    return null;
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function decryptRoleRoomGoogleToken(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const key = deriveRoleRoomServiceEncryptionKey('ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY');
  if (!key) {
    return null;
  }

  const [version, ivPart, tagPart, encryptedPart] = value.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) {
    return null;
  }

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

function isMissingRelationError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '42P01';
}

type RoleRoomGoogleConnectionRow = {
  user_id: string | null;
  google_email: string | null;
  google_subject: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expiry_date: string | null;
  scopes: unknown;
  oauth_app: string | null;
};

async function resolveRoleRoomGoogleCredentialSource(
  pool: Pool,
  preferredUserId?: string | null,
): Promise<ResolvedGoogleCredentialSource | null> {
  const params: string[] = [];
  const filters = [
    `connection_state = 'connected'`,
    `(refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)`,
  ];

  if (preferredUserId) {
    params.push(preferredUserId);
    filters.push(`user_id = $${params.length}`);
  }

  try {
    const result = await pool.query<RoleRoomGoogleConnectionRow>(
      `SELECT user_id, google_email, google_subject, access_token_encrypted, refresh_token_encrypted, expiry_date, scopes, oauth_app
       FROM role_room_google_connections
       WHERE ${filters.join(' AND ')}
       ORDER BY
         CASE WHEN refresh_token_encrypted IS NOT NULL THEN 0 ELSE 1 END,
         last_used_at DESC NULLS LAST,
         updated_at DESC NULLS LAST,
         created_at DESC NULLS LAST
       LIMIT 10`,
      params,
    );

    if (!result.rows.length) {
      return null;
    }

    const row =
      result.rows.find((entry) => normalizeGoogleWorkspaceOauthApp(entry.oauth_app, 'role_room') === 'creatorhub')
      ?? result.rows.find((entry) => normalizeGoogleWorkspaceOauthApp(entry.oauth_app, 'role_room') === 'role_room')
      ?? result.rows[0];
    const oauthApp = normalizeGoogleWorkspaceOauthApp(row.oauth_app, 'role_room');
    const oauthConfig = getGoogleWorkspaceOauthConfig(oauthApp);
    if (!oauthConfig.clientId || !oauthConfig.clientSecret) {
      return null;
    }
    const refreshToken = decryptRoleRoomGoogleToken(row.refresh_token_encrypted);
    const accessToken = decryptRoleRoomGoogleToken(row.access_token_encrypted);
    if (!refreshToken && !accessToken) {
      return null;
    }

    return {
      source: 'role_room_connection',
      clientId: oauthConfig.clientId,
      clientSecret: oauthConfig.clientSecret,
      redirectUri: oauthConfig.redirectUri,
      refreshToken,
      accessToken,
      expiryDate: readStringValue(row.expiry_date),
      storedScopes: normalizeGrantedScopes(row.scopes),
      userId: readStringValue(row.user_id),
      googleEmail: readStringValue(row.google_email),
      googleSubject: readStringValue(row.google_subject),
    };
  } catch (error) {
    if (isMissingRelationError(error)) {
      return null;
    }
    throw error;
  }
}

async function resolveGoogleChatCredentialSource(
  pool?: Pool,
  preferredUserId?: string | null,
): Promise<ResolvedGoogleCredentialSource> {
  if (pool) {
    const roleRoomSource = await resolveRoleRoomGoogleCredentialSource(pool, preferredUserId);
    if (roleRoomSource) {
      return roleRoomSource;
    }
  }

  const fallbackOauthConfig = getGoogleWorkspaceOauthConfig('creatorhub');
  const clientId = fallbackOauthConfig.clientId;
  const clientSecret = fallbackOauthConfig.clientSecret;
  const refreshToken = readStringValue(process.env.GOOGLE_WORKSPACE_REFRESH_TOKEN);

  if (clientId && clientSecret && refreshToken) {
    return {
      source: 'env_refresh_token',
      clientId,
      clientSecret,
      refreshToken,
    };
  }

  const credentialsPath = readStringValue(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!credentialsPath || !existsSync(credentialsPath)) {
    return {
      source: 'unavailable',
      message: 'Fant ingen Google OAuth-credentials i env eller credentials-fil.',
    };
  }

  try {
    const raw = JSON.parse(readFileSync(credentialsPath, 'utf8')) as Record<string, unknown>;
    if (
      raw.type === 'authorized_user'
      && readStringValue(raw.client_id)
      && readStringValue(raw.client_secret)
      && readStringValue(raw.refresh_token)
    ) {
      return {
        source: 'authorized_user_file',
        clientId: readStringValue(raw.client_id)!,
        clientSecret: readStringValue(raw.client_secret)!,
        refreshToken: readStringValue(raw.refresh_token)!,
      };
    }

    if (
      raw.type === 'service_account'
      && readStringValue(raw.client_email)
      && readStringValue(raw.private_key)
    ) {
      return {
        source: 'service_account_file',
        clientEmail: readStringValue(raw.client_email)!,
        privateKey: readStringValue(raw.private_key)!,
        subject: readStringValue(process.env.GOOGLE_IMPERSONATE_USER ?? process.env.GOOGLE_ADMIN_EMAIL),
      };
    }

    return {
      source: 'unavailable',
      message: 'Credentials-filen mangler nødvendig Google OAuth-data.',
    };
  } catch (error) {
    return {
      source: 'unavailable',
      message: error instanceof Error ? error.message : 'Kunne ikke lese Google credentials-filen.',
    };
  }
}

async function fetchGrantedScopes(accessToken: string): Promise<string[]> {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
    const payload = await response.json().catch(() => null) as { scope?: string } | null;
    return normalizeGrantedScopes(payload?.scope);
  } catch {
    return [];
  }
}

async function listGoogleChatSpaces(accessToken: string) {
  const response = await fetch('https://chat.googleapis.com/v1/spaces?pageSize=1', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const bodyText = await response.text();
  let body: Record<string, unknown> | string;
  try {
    body = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    body = bodyText;
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function runUncachedGoogleChatLiveHealthCheck(
  pool?: Pool,
  preferredUserId?: string | null,
): Promise<GoogleChatLiveHealthCheck> {
  const checkedAt = new Date().toISOString();
  const credentialSource = await resolveGoogleChatCredentialSource(pool, preferredUserId);
  const requiredScopes = [...GOOGLE_CHAT_REQUIRED_SCOPES];
  const connection = credentialSource.source === 'role_room_connection'
    ? {
        userId: credentialSource.userId,
        googleEmail: credentialSource.googleEmail,
        googleSubject: credentialSource.googleSubject,
      }
    : null;

  if (credentialSource.source === 'unavailable') {
    return {
      connected: false,
      status: 'misconfigured',
      source: 'unavailable',
      checkedAt,
      message: credentialSource.message,
      grantedScopes: [],
      missingScopes: requiredScopes,
      sampleSpace: null,
      connection: null,
    };
  }

  try {
    if (credentialSource.source === 'service_account_file') {
      const auth = new google.auth.JWT({
        email: credentialSource.clientEmail,
        key: credentialSource.privateKey,
        scopes: ['https://www.googleapis.com/auth/chat.bot'],
        subject: credentialSource.subject ?? undefined,
      });
      const tokenResponse = await auth.authorize();
      const accessToken = readStringValue(tokenResponse.access_token);

      if (!accessToken) {
        throw new Error('Google returnerte ikke access token for service account-auth.');
      }

      const spacesResponse = await listGoogleChatSpaces(accessToken);
      if (!spacesResponse.ok) {
        const details = typeof spacesResponse.body === 'string'
          ? spacesResponse.body
          : JSON.stringify(spacesResponse.body);
        return {
          connected: false,
          status: 'error',
          source: credentialSource.source,
          checkedAt,
          message: `Google Chat API svarte med ${spacesResponse.status}: ${details}`,
          grantedScopes: ['https://www.googleapis.com/auth/chat.bot'],
          missingScopes: requiredScopes,
          sampleSpace: null,
          connection,
        };
      }

      const sampleSpace = Array.isArray((spacesResponse.body as { spaces?: unknown[] }).spaces)
        ? ((spacesResponse.body as { spaces?: Array<Record<string, unknown>> }).spaces?.[0] ?? null)
        : null;

      return {
        connected: true,
        status: 'active',
        source: credentialSource.source,
        checkedAt,
        message: 'Google Chat svarte med gyldig service account-auth.',
        grantedScopes: ['https://www.googleapis.com/auth/chat.bot'],
        missingScopes: requiredScopes,
        sampleSpace: sampleSpace
          ? {
              name: readStringValue(sampleSpace.name),
              displayName: readStringValue(sampleSpace.displayName),
            }
          : null,
        connection,
      };
    }

    const redirectUri =
      'redirectUri' in credentialSource
        ? credentialSource.redirectUri
        : null;
    const oauthClient = new google.auth.OAuth2(
      credentialSource.clientId,
      credentialSource.clientSecret,
      redirectUri ?? 'http://localhost:3000/oauth2callback',
    );
    const tokenSeed: {
      refresh_token?: string;
      access_token?: string;
      expiry_date?: number;
    } = {};

    if ('refreshToken' in credentialSource && credentialSource.refreshToken) {
      tokenSeed.refresh_token = credentialSource.refreshToken;
    }
    if ('accessToken' in credentialSource && credentialSource.accessToken) {
      tokenSeed.access_token = credentialSource.accessToken;
    }
    if ('expiryDate' in credentialSource) {
      const expiryTimestamp = credentialSource.expiryDate ? Date.parse(credentialSource.expiryDate) : NaN;
      if (Number.isFinite(expiryTimestamp)) {
        tokenSeed.expiry_date = expiryTimestamp;
      }
    }
    oauthClient.setCredentials(tokenSeed);

    let accessToken = readStringValue(tokenSeed.access_token);
    if (tokenSeed.refresh_token) {
      if (shouldForceGoogleAccessTokenRefresh(tokenSeed.expiry_date)) {
        oauthClient.setCredentials({ refresh_token: tokenSeed.refresh_token });
        const refreshed = await oauthClient.refreshAccessToken();
        const refreshedCredentials = refreshed.credentials ?? oauthClient.credentials;
        accessToken = readStringValue(refreshedCredentials.access_token ?? oauthClient.credentials.access_token);
      } else {
        const accessTokenResponse = await oauthClient.getAccessToken();
        accessToken = readStringValue(accessTokenResponse.token ?? oauthClient.credentials.access_token) ?? accessToken;
      }
    } else if (!accessToken) {
      throw new Error('Google-tilkoblingen mangler refresh-token og access-token.');
    } else if (typeof tokenSeed.expiry_date === 'number' && tokenSeed.expiry_date <= Date.now()) {
      throw new Error('Google-tilkoblingen mangler refresh-token og access-tokenet er utløpt.');
    }

    if (!accessToken) {
      throw new Error('Google returnerte ikke access token.');
    }

    const grantedScopes = uniqueScopes([
      ...await fetchGrantedScopes(accessToken),
      ...('storedScopes' in credentialSource ? credentialSource.storedScopes : []),
    ]);
    const missingScopes = requiredScopes.filter((scope) => !grantedScopes.includes(scope));
    const spacesResponse = await listGoogleChatSpaces(accessToken);

    if (!spacesResponse.ok) {
      const details = typeof spacesResponse.body === 'string'
        ? spacesResponse.body
        : JSON.stringify(spacesResponse.body);
      return {
        connected: false,
        status: missingScopes.length > 0 ? 'misconfigured' : 'error',
        source: credentialSource.source,
        checkedAt,
        message:
          credentialSource.source === 'role_room_connection' && missingScopes.length > 0
            ? `Role Room Google-tilkoblingen mangler scopes: ${missingScopes.join(', ')}`
            : `Google Chat API svarte med ${spacesResponse.status}: ${details}`,
        grantedScopes,
        missingScopes,
        sampleSpace: null,
        connection,
      };
    }

    const sampleSpace = Array.isArray((spacesResponse.body as { spaces?: unknown[] }).spaces)
      ? ((spacesResponse.body as { spaces?: Array<Record<string, unknown>> }).spaces?.[0] ?? null)
      : null;

    return {
      connected: missingScopes.length === 0,
      status: missingScopes.length === 0 ? 'active' : 'misconfigured',
      source: credentialSource.source,
      checkedAt,
      message: missingScopes.length === 0
        ? credentialSource.source === 'role_room_connection'
          ? 'Google Chat API svarte med gyldig OAuth-token fra Role Room.'
          : 'Google Chat API svarte med gyldig OAuth-token.'
        : credentialSource.source === 'role_room_connection'
          ? `Role Room Google-tilkoblingen mangler scopes: ${missingScopes.join(', ')}`
          : `Google Chat-tokenet mangler scopes: ${missingScopes.join(', ')}`,
      grantedScopes,
      missingScopes,
      sampleSpace: sampleSpace
        ? {
            name: readStringValue(sampleSpace.name),
            displayName: readStringValue(sampleSpace.displayName),
          }
        : null,
      connection,
    };
  } catch (error) {
    const normalized = normalizeGoogleChatAuthError(error);
    return {
      connected: false,
      status: normalized.status,
      source: credentialSource.source,
      checkedAt,
      message: normalized.message,
      grantedScopes: [],
      missingScopes: requiredScopes,
      sampleSpace: null,
      connection,
    };
  }
}

export async function getGoogleChatLiveHealthCheck(options?: {
  forceRefresh?: boolean;
  pool?: Pool;
  userId?: string | null;
}): Promise<GoogleChatLiveHealthCheck> {
  const forceRefresh = options?.forceRefresh ?? false;
  const cacheKey = options?.userId?.trim() ? `user:${options.userId.trim()}` : 'global';
  const now = Date.now();
  const cached = cachedGoogleChatHealth.get(cacheKey);

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.result;
  }

  const result = await runUncachedGoogleChatLiveHealthCheck(options?.pool, options?.userId);
  cachedGoogleChatHealth.set(cacheKey, {
    expiresAt: now + 30_000,
    result,
  });
  return result;
}
