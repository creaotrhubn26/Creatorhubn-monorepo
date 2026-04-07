import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';
import { google } from 'googleapis';
import type { Pool } from 'pg';
import {
  loadPersistedAuthSession,
  persistAuthSession,
} from './auth-session-store.js';
import {
  getGoogleWorkspaceOauthConfig,
  type GoogleWorkspaceOauthApp,
} from './google-workspace-oauth.js';

type ActiveSessionData = {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  roleLabel?: string;
  permissions?: string[];
  profession?: string;
  userType?: string;
  displayName?: string;
  picture?: string;
  verified_email?: boolean;
  impersonatedByAdmin?: boolean;
  isAdmin?: boolean;
  vendorId?: string;
  businessName?: string;
  coupleProfileId?: string;
  requestedRole?: string | null;
  loginAs?: string;
};

type CreatorHubGoogleOauthMode = 'login' | 'link';

type CreatorHubGoogleConnectionRow = {
  id: string;
  user_id: string;
  role_room_email: string | null;
  google_email: string | null;
  google_subject: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  expiry_date: string | null;
  scopes: unknown;
  connection_state: string | null;
  last_error: string | null;
  profile: Record<string, unknown> | null;
  oauth_app: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

type CreatorHubGoogleOauthState = {
  mode: CreatorHubGoogleOauthMode;
  returnPath: string;
  browserOrigin?: string | null;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
  targetConnectionUserId?: string | null;
  targetConnectionEmail?: string | null;
  createdAt: number;
};

type CreatorHubGoogleTransferPayload = {
  mode: CreatorHubGoogleOauthMode;
  createdAt: number;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
  targetConnectionUserId?: string | null;
  targetConnectionEmail?: string | null;
  sessionToken?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    display_name: string;
    picture?: string;
    verified_email?: boolean;
  };
  googleEmail: string;
  googleSubject: string;
  profile: Record<string, unknown>;
  tokenBundle?: {
    accessToken?: string | null;
    refreshToken?: string | null;
    expiryDate?: number | null;
    scopes: string[];
  };
};

type CreatorHubResolvedUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
  profession?: string;
  roleLabel?: string;
  displayName?: string;
  vendorId?: string;
  businessName?: string;
  coupleProfileId?: string;
  isAdmin?: boolean;
};

const CREATORHUB_GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.spaces.create',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/chat.messages.reactions.create',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.upload',
] as const;

const CREATORHUB_GOOGLE_STATE_TTL_MS = 15 * 60 * 1000;
const CREATORHUB_GOOGLE_OAUTH_APP: GoogleWorkspaceOauthApp = 'creatorhub';

const creatorHubGoogleOauthStateStore = new Map<string, CreatorHubGoogleOauthState>();
const creatorHubGoogleTransferStore = new Map<string, CreatorHubGoogleTransferPayload>();

function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => readStringValue(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  if (typeof value === 'string') {
    return value
      .split(/\s+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function readJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function readOptionalHeaderValue(req: Request, headerName: string): string | undefined {
  const raw = req.headers[headerName.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function deriveEncryptionKey(): Buffer | null {
  const secret = readStringValue(
    process.env.CREATORHUB_GOOGLE_TOKEN_ENCRYPTION_KEY
    ?? process.env.ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY
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

function encryptGoogleToken(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const key = deriveEncryptionKey();
  if (!key) {
    return null;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function sanitizeReturnPath(value: unknown): string {
  const candidate = readStringValue(value);
  if (!candidate) {
    return '/dashboard';
  }

  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/dashboard';
  } catch {
    return '/dashboard';
  }
}

function sanitizeBrowserOrigin(value: unknown): string | null {
  const candidate = readStringValue(value);
  if (!candidate) {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    return null;
  }

  return null;
}

function resolveRequestOrigin(req: Request, explicitOrigin?: string | null): string | null {
  const directOrigin = sanitizeBrowserOrigin(explicitOrigin)
    ?? sanitizeBrowserOrigin(req.headers.origin)
    ?? sanitizeBrowserOrigin(req.headers.referer);

  if (directOrigin) {
    return directOrigin;
  }

  const host = readStringValue(req.get('host'));
  if (!host) {
    return null;
  }

  const forwardedProto = readStringValue(req.headers['x-forwarded-proto']);
  const protocol = forwardedProto ?? req.protocol ?? 'http';
  return `${protocol}://${host}`;
}

function buildCreatorHubGoogleReturnUrl(
  returnPath: string,
  params: Record<string, string | null | undefined>,
  browserOrigin?: string | null,
): string {
  const baseOrigin = browserOrigin && /^https?:\/\//.test(browserOrigin)
    ? browserOrigin
    : 'http://localhost:5000';
  const url = new URL(returnPath.startsWith('/') ? returnPath : `/${returnPath}`, baseOrigin);

  Object.entries(params).forEach(([key, value]) => {
    if (!value) {
      return;
    }
    url.searchParams.set(key, value);
  });

  return url.toString();
}

function pruneExpiredCreatorHubGoogleState(): void {
  const expiresBefore = Date.now() - CREATORHUB_GOOGLE_STATE_TTL_MS;
  for (const [key, value] of creatorHubGoogleOauthStateStore.entries()) {
    if (value.createdAt < expiresBefore) {
      creatorHubGoogleOauthStateStore.delete(key);
    }
  }

  for (const [key, value] of creatorHubGoogleTransferStore.entries()) {
    if (value.createdAt < expiresBefore) {
      creatorHubGoogleTransferStore.delete(key);
    }
  }
}

async function resolveSessionFromBearer(
  pool: Pool,
  activeSessions: Map<string, ActiveSessionData> | undefined,
  bearer: string | null | undefined,
): Promise<ActiveSessionData | null> {
  const sessionToken = typeof bearer === 'string' ? bearer.trim() : '';
  if (!sessionToken) {
    return null;
  }

  const inMemorySession = activeSessions?.get(sessionToken) ?? null;
  if (inMemorySession) {
    return inMemorySession;
  }

  const persistedSession = await loadPersistedAuthSession<ActiveSessionData>(pool, sessionToken);
  if (persistedSession) {
    activeSessions?.set(sessionToken, persistedSession);
    return persistedSession;
  }

  return null;
}

async function resolveOptionalRequestUser(
  req: Request,
  pool: Pool,
  activeSessions?: Map<string, ActiveSessionData>,
): Promise<{ userId: string; email: string; role: string } | null> {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  const session = await resolveSessionFromBearer(pool, activeSessions, bearer);
  if (session) {
    return {
      userId: session.userId,
      email: session.email,
      role: session.role,
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    const devUserId =
      readOptionalHeaderValue(req, 'x-user-id')
      ?? readOptionalHeaderValue(req, 'x-role-room-user-id')
      ?? null;
    const devEmail =
      readOptionalHeaderValue(req, 'x-user-email')
      ?? readOptionalHeaderValue(req, 'x-role-room-email')
      ?? null;
    const devRole =
      readOptionalHeaderValue(req, 'x-user-role')
      ?? readOptionalHeaderValue(req, 'x-role-room-role')
      ?? 'admin';

    if (devUserId && devEmail) {
      return {
        userId: devUserId,
        email: devEmail,
        role: devRole,
      };
    }
  }

  return null;
}

function roleLabelForRole(role: string): string {
  return role
    .split('_')
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(' ');
}

async function resolveCreatorHubGoogleLoginUser(
  pool: Pool,
  googleEmail: string,
): Promise<CreatorHubResolvedUser | null> {
  const normalizedEmail = googleEmail.trim().toLowerCase();
  const result = await pool.query(
    `SELECT id, email, username, first_name, last_name, role, profession, company_name
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [normalizedEmail],
  );

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  const vendorCheck = await pool
    .query(
      'SELECT id, business_name FROM vendors WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [normalizedEmail],
    )
    .catch(() => ({ rows: [], rowCount: 0 }));
  const coupleCheck = await pool
    .query(
      'SELECT id, display_name FROM couple_profiles WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [normalizedEmail],
    )
    .catch(() => ({ rows: [], rowCount: 0 }));

  let role = readStringValue(row.role)?.toLowerCase() ?? 'user';
  if (role === 'super_admin') {
    role = 'admin';
  }
  if (coupleCheck.rows.length > 0) {
    role = 'couple';
  } else if (vendorCheck.rows.length > 0) {
    role = 'vendor';
  }

  const baseName =
    [
      readStringValue(row.first_name),
      readStringValue(row.last_name),
    ].filter((value): value is string => Boolean(value)).join(' ')
    || readStringValue(row.username)
    || normalizedEmail.split('@')[0]
    || 'CreatorHub';

  return {
    userId: String(row.id),
    email: readStringValue(row.email) ?? normalizedEmail,
    name: baseName,
    displayName: coupleCheck.rows[0]?.display_name || baseName,
    role,
    roleLabel: roleLabelForRole(role),
    profession: readStringValue(row.profession) ?? undefined,
    vendorId: vendorCheck.rows[0]?.id ? String(vendorCheck.rows[0].id) : undefined,
    businessName: vendorCheck.rows[0]?.business_name
      ? String(vendorCheck.rows[0].business_name)
      : (readStringValue(row.company_name) ?? undefined),
    coupleProfileId: coupleCheck.rows[0]?.id ? String(coupleCheck.rows[0].id) : undefined,
    isAdmin: role === 'admin' || role === 'super_admin' || role === 'academy_admin',
  };
}

async function ensureGoogleWorkspaceConnectionsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_google_connections (
      id UUID PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      role_room_email VARCHAR(255),
      google_email VARCHAR(255),
      google_subject VARCHAR(255),
      access_token_encrypted TEXT,
      refresh_token_encrypted TEXT,
      expiry_date TIMESTAMPTZ,
      scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
      connection_state VARCHAR(32) NOT NULL DEFAULT 'disconnected',
      last_error TEXT,
      profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      oauth_app VARCHAR(32) NOT NULL DEFAULT 'role_room',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    );
    ALTER TABLE role_room_google_connections
      ADD COLUMN IF NOT EXISTS oauth_app VARCHAR(32) NOT NULL DEFAULT 'role_room';
    UPDATE role_room_google_connections
       SET oauth_app = 'role_room'
     WHERE oauth_app IS NULL OR TRIM(oauth_app) = '';
    DROP INDEX IF EXISTS idx_rr_google_connections_user_id_unique;
    DROP INDEX IF EXISTS idx_rr_google_connections_subject_unique;
    CREATE INDEX IF NOT EXISTS idx_rr_google_connections_email ON role_room_google_connections(google_email);
    CREATE INDEX IF NOT EXISTS idx_rr_google_connections_user_id ON role_room_google_connections(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_connections_user_app_unique
      ON role_room_google_connections(user_id, oauth_app);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_connections_subject_app_unique
      ON role_room_google_connections(google_subject, oauth_app)
      WHERE google_subject IS NOT NULL;
  `);
}

async function getGoogleConnectionBySubject(
  pool: Pool,
  subject: string,
  oauthApp: GoogleWorkspaceOauthApp,
): Promise<CreatorHubGoogleConnectionRow | null> {
  await ensureGoogleWorkspaceConnectionsTable(pool);
  const result = await pool.query<CreatorHubGoogleConnectionRow>(
    `SELECT *
     FROM role_room_google_connections
     WHERE google_subject = $1
       AND oauth_app = $2
     LIMIT 1`,
    [subject, oauthApp],
  );
  return result.rows[0] ?? null;
}

async function getGoogleConnectionByUserId(
  pool: Pool,
  userId: string,
  oauthApp: GoogleWorkspaceOauthApp,
): Promise<CreatorHubGoogleConnectionRow | null> {
  await ensureGoogleWorkspaceConnectionsTable(pool);
  const result = await pool.query<CreatorHubGoogleConnectionRow>(
    `SELECT *
     FROM role_room_google_connections
     WHERE user_id = $1
       AND oauth_app = $2
     ORDER BY last_used_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1`,
    [userId, oauthApp],
  );
  return result.rows[0] ?? null;
}

async function upsertGoogleWorkspaceConnection(
  pool: Pool,
  input: {
    userId: string;
    userEmail: string | null;
    googleEmail: string;
    googleSubject: string;
    googleProfile: Record<string, unknown>;
    tokenBundle: NonNullable<CreatorHubGoogleTransferPayload['tokenBundle']>;
    oauthApp: GoogleWorkspaceOauthApp;
  },
): Promise<CreatorHubGoogleConnectionRow> {
  await ensureGoogleWorkspaceConnectionsTable(pool);

  const accessTokenEncrypted = input.tokenBundle.accessToken
    ? encryptGoogleToken(input.tokenBundle.accessToken)
    : null;
  const refreshTokenEncrypted = input.tokenBundle.refreshToken
    ? encryptGoogleToken(input.tokenBundle.refreshToken)
    : null;
  const expiryDate = typeof input.tokenBundle.expiryDate === 'number' && Number.isFinite(input.tokenBundle.expiryDate)
    ? new Date(input.tokenBundle.expiryDate).toISOString()
    : null;

  const result = await pool.query<CreatorHubGoogleConnectionRow>(
    `INSERT INTO role_room_google_connections (
      id, user_id, role_room_email, google_email, google_subject,
      access_token_encrypted, refresh_token_encrypted, expiry_date, scopes,
      connection_state, last_error, profile, oauth_app, created_at, updated_at, last_used_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9::jsonb,
      'connected', NULL, $10::jsonb, $11, NOW(), NOW(), NOW()
    )
    ON CONFLICT (user_id, oauth_app) DO UPDATE SET
      role_room_email = EXCLUDED.role_room_email,
      google_email = EXCLUDED.google_email,
      google_subject = EXCLUDED.google_subject,
      access_token_encrypted = COALESCE(EXCLUDED.access_token_encrypted, role_room_google_connections.access_token_encrypted),
      refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, role_room_google_connections.refresh_token_encrypted),
      expiry_date = COALESCE(EXCLUDED.expiry_date, role_room_google_connections.expiry_date),
      scopes = EXCLUDED.scopes,
      connection_state = 'connected',
      last_error = NULL,
      profile = EXCLUDED.profile,
      updated_at = NOW(),
      last_used_at = NOW()
    RETURNING *`,
    [
      crypto.randomUUID(),
      input.userId,
      input.userEmail,
      input.googleEmail,
      input.googleSubject,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      expiryDate,
      JSON.stringify(input.tokenBundle.scopes ?? []),
      JSON.stringify(input.googleProfile),
      input.oauthApp,
    ],
  );

  return result.rows[0];
}

function buildCreatorHubSessionData(
  user: CreatorHubResolvedUser,
  googleProfile: Record<string, unknown>,
): ActiveSessionData {
  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    role: user.role,
    roleLabel: user.roleLabel,
    profession: user.profession,
    userType: user.profession,
    displayName: user.displayName ?? user.name,
    picture: readStringValue(googleProfile.picture) ?? undefined,
    verified_email: googleProfile.verified_email === true,
    isAdmin: user.isAdmin === true,
    vendorId: user.vendorId,
    businessName: user.businessName,
    coupleProfileId: user.coupleProfileId,
    loginAt: new Date().toISOString(),
  };
}

export function createCreatorHubGoogleRouter(
  pool: Pool,
  activeSessions?: Map<string, ActiveSessionData>,
): Router {
  const router = Router();

  router.get('/status', async (req: Request, res: Response) => {
    try {
      pruneExpiredCreatorHubGoogleState();
      const config = getGoogleWorkspaceOauthConfig(CREATORHUB_GOOGLE_OAUTH_APP, req);
      const requestUser = await resolveOptionalRequestUser(req, pool, activeSessions);
      const connection = requestUser?.userId
        ? await getGoogleConnectionByUserId(pool, requestUser.userId, CREATORHUB_GOOGLE_OAUTH_APP)
        : null;

      res.json({
        configured: config.configured,
        missing: config.missing,
        state: connection?.connection_state ?? 'disconnected',
        connection: connection
          ? {
              id: connection.id,
              userId: connection.user_id,
              roleRoomEmail: connection.role_room_email,
              googleEmail: connection.google_email,
              googleSubject: connection.google_subject,
              scopes: readStringArray(connection.scopes),
              state: connection.connection_state ?? 'disconnected',
              lastError: connection.last_error,
              profile: readJsonObject(connection.profile),
              expiryDate: connection.expiry_date,
              createdAt: connection.created_at,
              updatedAt: connection.updated_at,
              lastUsedAt: connection.last_used_at,
              oauthApp: connection.oauth_app,
            }
          : null,
      });
    } catch (error) {
      console.error('CreatorHub Google status error:', error);
      res.status(500).json({ error: 'Kunne ikke hente CreatorHub Google-status' });
    }
  });

  router.post('/oauth/start', async (req: Request, res: Response) => {
    try {
      pruneExpiredCreatorHubGoogleState();
      const config = getGoogleWorkspaceOauthConfig(CREATORHUB_GOOGLE_OAUTH_APP, req);
      if (!config.configured) {
        res.status(503).json({
          error: 'CreatorHub Google Workspace er ikke konfigurert',
          missing: config.missing,
        });
        return;
      }

      const mode = readStringValue(req.body?.mode) === 'link' ? 'link' : 'login';
      const requestUser = await resolveOptionalRequestUser(req, pool, activeSessions);
      const targetConnectionUserId = readStringValue(req.body?.targetConnectionUserId)
        ?? requestUser?.userId
        ?? null;
      const targetConnectionEmail = readStringValue(req.body?.targetConnectionEmail)
        ?? requestUser?.email
        ?? null;

      if (mode === 'link' && !targetConnectionUserId) {
        res.status(401).json({ error: 'Du må være logget inn for å koble Google Workspace.' });
        return;
      }

      const stateId = `chg_${crypto.randomUUID()}`;
      creatorHubGoogleOauthStateStore.set(stateId, {
        mode,
        returnPath: sanitizeReturnPath(req.body?.returnPath),
        browserOrigin: sanitizeBrowserOrigin(req.body?.browserOrigin) ?? resolveRequestOrigin(req),
        createdByUserId: requestUser?.userId ?? null,
        createdByEmail: requestUser?.email ?? null,
        targetConnectionUserId,
        targetConnectionEmail,
        createdAt: Date.now(),
      });

      const oauthClient = new google.auth.OAuth2(
        config.clientId!,
        config.clientSecret!,
        config.redirectUri!,
      );
      const loginHint = targetConnectionEmail ?? requestUser?.email ?? readStringValue(req.body?.email);
      const authorizationUrl = oauthClient.generateAuthUrl({
        access_type: 'offline',
        scope: [...CREATORHUB_GOOGLE_SCOPES],
        include_granted_scopes: true,
        prompt: 'consent',
        state: stateId,
        ...(loginHint ? { login_hint: loginHint } : {}),
      });

      res.json({
        success: true,
        mode,
        authorizationUrl,
        stateId,
      });
    } catch (error) {
      console.error('CreatorHub Google oauth start error:', error);
      res.status(500).json({ error: 'Kunne ikke starte CreatorHub Google OAuth' });
    }
  });

  router.get('/oauth/callback', async (req: Request, res: Response) => {
    pruneExpiredCreatorHubGoogleState();
    const config = getGoogleWorkspaceOauthConfig(CREATORHUB_GOOGLE_OAUTH_APP, req);
    const fallbackReturnPath = sanitizeReturnPath(req.query.returnPath);
    const requestOrigin = resolveRequestOrigin(req);

    const redirectWithError = (returnPath: string, message: string, browserOrigin?: string | null) => {
      res.redirect(
        buildCreatorHubGoogleReturnUrl(
          returnPath,
          {
            chGoogleStatus: 'error',
            chGoogleMessage: message,
          },
          browserOrigin ?? requestOrigin,
        ),
      );
    };

    if (!config.configured) {
      redirectWithError(fallbackReturnPath, 'CreatorHub Google Workspace er ikke konfigurert');
      return;
    }

    const stateId = readStringValue(req.query.state);
    const code = readStringValue(req.query.code);
    const oauthState = stateId ? creatorHubGoogleOauthStateStore.get(stateId) : null;
    if (!oauthState || !code) {
      redirectWithError(oauthState?.returnPath ?? fallbackReturnPath, 'Ugyldig CreatorHub Google-forespørsel', oauthState?.browserOrigin);
      return;
    }

    creatorHubGoogleOauthStateStore.delete(stateId!);

    try {
      const oauthClient = new google.auth.OAuth2(
        config.clientId!,
        config.clientSecret!,
        config.redirectUri!,
      );
      const tokenResult = await oauthClient.getToken(code);
      oauthClient.setCredentials(tokenResult.tokens);

      const oauth2Api = google.oauth2({ version: 'v2', auth: oauthClient });
      const profileResponse = await oauth2Api.userinfo.get();
      const googleEmail = readStringValue(profileResponse.data.email);
      const googleSubject = readStringValue(profileResponse.data.id);
      const googleProfile = readJsonObject({
        id: profileResponse.data.id ?? null,
        email: profileResponse.data.email ?? null,
        verified_email: profileResponse.data.verified_email ?? null,
        name: profileResponse.data.name ?? null,
        given_name: profileResponse.data.given_name ?? null,
        family_name: profileResponse.data.family_name ?? null,
        picture: profileResponse.data.picture ?? null,
      });

      if (!googleEmail || !googleSubject) {
        redirectWithError(oauthState.returnPath, 'Google-kontoen mangler e-post eller identitet', oauthState.browserOrigin);
        return;
      }

      const tokenBundle: NonNullable<CreatorHubGoogleTransferPayload['tokenBundle']> = {
        accessToken: readStringValue(tokenResult.tokens.access_token),
        refreshToken: readStringValue(tokenResult.tokens.refresh_token),
        expiryDate: typeof tokenResult.tokens.expiry_date === 'number' ? tokenResult.tokens.expiry_date : null,
        scopes: readStringArray(tokenResult.tokens.scope?.split(' ') ?? tokenResult.tokens.scope ?? CREATORHUB_GOOGLE_SCOPES),
      };

      if (oauthState.mode === 'login') {
        const resolvedUser = await resolveCreatorHubGoogleLoginUser(pool, googleEmail);
        if (!resolvedUser) {
          redirectWithError(
            oauthState.returnPath,
            'Google-kontoen er ikke knyttet til en aktiv CreatorHub-konto.',
            oauthState.browserOrigin,
          );
          return;
        }

        await upsertGoogleWorkspaceConnection(pool, {
          userId: resolvedUser.userId,
          userEmail: resolvedUser.email,
          googleEmail,
          googleSubject,
          googleProfile,
          tokenBundle,
          oauthApp: CREATORHUB_GOOGLE_OAUTH_APP,
        });

        const sessionToken = crypto.randomUUID();
        const sessionData = buildCreatorHubSessionData(resolvedUser, googleProfile);
        activeSessions?.set(sessionToken, sessionData);
        await persistAuthSession(pool, sessionToken, sessionData);

        const transferId = crypto.randomUUID();
        creatorHubGoogleTransferStore.set(transferId, {
          mode: 'login',
          createdAt: Date.now(),
          createdByUserId: resolvedUser.userId,
          createdByEmail: resolvedUser.email,
          sessionToken,
          user: {
            id: resolvedUser.userId,
            email: resolvedUser.email,
            role: resolvedUser.role,
            name: resolvedUser.name,
            display_name: resolvedUser.displayName ?? resolvedUser.name,
            picture: readStringValue(googleProfile.picture) ?? undefined,
            verified_email: googleProfile.verified_email === true,
          },
          googleEmail,
          googleSubject,
          profile: googleProfile,
        });

        res.redirect(
          buildCreatorHubGoogleReturnUrl(
            oauthState.returnPath,
            {
              chGoogleStatus: 'success',
              chGoogleMode: 'login',
              chGoogleTransfer: transferId,
            },
            oauthState.browserOrigin ?? requestOrigin,
          ),
        );
        return;
      }

      const linkTargetUserId = oauthState.targetConnectionUserId ?? oauthState.createdByUserId ?? null;
      const linkTargetEmail = oauthState.targetConnectionEmail ?? oauthState.createdByEmail ?? null;
      if (!linkTargetUserId) {
        redirectWithError(oauthState.returnPath, 'Fant ikke brukeren som skal kobles til Google Workspace', oauthState.browserOrigin);
        return;
      }

      const existingSubjectConnection = await getGoogleConnectionBySubject(
        pool,
        googleSubject,
        CREATORHUB_GOOGLE_OAUTH_APP,
      );
      if (existingSubjectConnection && existingSubjectConnection.user_id !== linkTargetUserId) {
        redirectWithError(
          oauthState.returnPath,
          'Denne Google-kontoen er allerede koblet til en annen CreatorHub-bruker.',
          oauthState.browserOrigin,
        );
        return;
      }

      const transferId = crypto.randomUUID();
      creatorHubGoogleTransferStore.set(transferId, {
        mode: 'link',
        createdAt: Date.now(),
        createdByUserId: oauthState.createdByUserId ?? null,
        createdByEmail: oauthState.createdByEmail ?? null,
        targetConnectionUserId: linkTargetUserId,
        targetConnectionEmail: linkTargetEmail,
        googleEmail,
        googleSubject,
        profile: googleProfile,
        tokenBundle,
      });

      res.redirect(
        buildCreatorHubGoogleReturnUrl(
          oauthState.returnPath,
          {
            chGoogleStatus: 'success',
            chGoogleMode: 'link',
            chGoogleTransfer: transferId,
          },
          oauthState.browserOrigin ?? requestOrigin,
        ),
      );
    } catch (error) {
      console.error('CreatorHub Google callback error:', error);
      redirectWithError(
        oauthState.returnPath,
        error instanceof Error ? error.message : 'CreatorHub Google-innlogging feilet',
        oauthState.browserOrigin,
      );
    }
  });

  router.get('/oauth/session-result/:transferId', async (req: Request, res: Response) => {
    try {
      pruneExpiredCreatorHubGoogleState();
      const transferId = readStringValue(req.params.transferId);
      if (!transferId) {
        res.status(400).json({ error: 'transferId mangler' });
        return;
      }

      const payload = creatorHubGoogleTransferStore.get(transferId);
      if (!payload) {
        res.status(404).json({ error: 'Google-overføringen er utløpt eller brukt' });
        return;
      }

      if (payload.mode === 'login') {
        creatorHubGoogleTransferStore.delete(transferId);
      }

      res.json({
        success: true,
        transferId,
        mode: payload.mode,
        sessionToken: payload.sessionToken ?? null,
        user: payload.user ?? null,
        google: {
          email: payload.googleEmail,
          subject: payload.googleSubject,
          profile: payload.profile,
        },
      });
    } catch (error) {
      console.error('CreatorHub Google session result error:', error);
      res.status(500).json({ error: 'Kunne ikke hente CreatorHub Google-overføringen' });
    }
  });

  router.post('/link', async (req: Request, res: Response) => {
    try {
      const requestUser = await resolveOptionalRequestUser(req, pool, activeSessions);
      const transferId = readStringValue(req.body?.transferId);
      if (!transferId) {
        res.status(400).json({ error: 'transferId er påkrevd' });
        return;
      }

      const payload = creatorHubGoogleTransferStore.get(transferId);
      if (!payload || payload.mode !== 'link' || !payload.tokenBundle) {
        res.status(404).json({ error: 'Fant ikke en gyldig CreatorHub Google-kobling å fullføre' });
        return;
      }

      const userId = payload.targetConnectionUserId ?? requestUser?.userId ?? null;
      const roleRoomEmail = payload.targetConnectionEmail ?? requestUser?.email ?? null;
      if (!userId) {
        res.status(401).json({ error: 'Fant ikke brukeren som skal kobles til Google Workspace' });
        return;
      }

      const connection = await upsertGoogleWorkspaceConnection(pool, {
        userId,
        userEmail: roleRoomEmail,
        googleEmail: payload.googleEmail,
        googleSubject: payload.googleSubject,
        googleProfile: payload.profile,
        tokenBundle: payload.tokenBundle,
        oauthApp: CREATORHUB_GOOGLE_OAUTH_APP,
      });

      creatorHubGoogleTransferStore.delete(transferId);

      res.json({
        success: true,
        connection: {
          userId: connection.user_id,
          googleEmail: connection.google_email,
          roleRoomEmail: connection.role_room_email,
          scopes: readStringArray(connection.scopes),
          oauthApp: connection.oauth_app,
          state: connection.connection_state,
        },
      });
    } catch (error) {
      console.error('CreatorHub Google link completion error:', error);
      res.status(500).json({ error: 'Kunne ikke fullføre CreatorHub Google-koblingen' });
    }
  });

  return router;
}
