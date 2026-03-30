import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import crypto from 'crypto';
import { existsSync, readFileSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { createRequire } from 'module';
import { google } from 'googleapis';
import {
  ensureCustomerDriveWorkspace,
  ensureDriveFolder,
} from './customer-drive-sync.js';
import { resolveRoleRoomGoogleConnection } from './contract-google-signing.js';

type LightroomIntegrationRow = {
  id: string;
  user_id: string | null;
  plugin_token_hash: string | null;
  plugin_token_plain: string | null;
  plugin_version: string | null;
  drive_root_folder_id: string | null;
  drive_root_folder_name: string | null;
  drive_root_folder_url: string | null;
  last_sync_at: string | null;
  last_showcase_item_id: string | null;
  last_drive_file_id: string | null;
  last_error: string | null;
  sync_status: string | null;
  configuration: unknown;
  created_at: string | null;
  updated_at: string | null;
};

type LightroomSimulationRow = {
  id: string;
  user_id: string | null;
  export_id: string | null;
  status: string | null;
  drive_file_id: string | null;
  showcase_item_id: string | null;
  metadata: unknown;
  created_at: string | null;
  updated_at: string | null;
};

type LightroomWorkspaceStatus = {
  connected: boolean;
  googleEmail: string | null;
  storedScopes: string[];
  error: string | null;
  source: string | null;
  warning: string | null;
};

type LightroomAuthSource =
  | 'role_room_connection'
  | 'env_refresh_token'
  | 'authorized_user_file'
  | 'service_account_file';

type LightroomGoogleAuthClient =
  | InstanceType<typeof google.auth.OAuth2>
  | InstanceType<typeof google.auth.JWT>;

type AuthorizedLightroomGoogleClient = {
  authClient: LightroomGoogleAuthClient;
  source: LightroomAuthSource;
  googleEmail: string | null;
  storedScopes: string[];
  warning: string | null;
};

type LightroomExportPayload = {
  filename: string;
  title: string;
  description: string;
  collectionName: string | null;
  category: string;
  customerId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  companyName: string | null;
  projectId: string | null;
  projectName: string | null;
  profession: string;
  mimeType: string;
  fileBuffer: Buffer;
  keywords: string[];
  rating: number | null;
  captureDate: string | null;
  metadata: Record<string, unknown>;
};

type LightroomExportResult = {
  success: true;
  exportId: string;
  showcaseItemId: string;
  driveFileId: string;
  driveFolderId: string;
  driveFolderName: string;
  driveRootFolderId: string;
  driveRootFolderName: string;
  driveRootFolderUrl: string | null;
  driveWebViewLink: string | null;
  driveWebContentLink: string | null;
  imageUrl: string;
  thumbnailUrl: string;
  title: string;
  category: string;
};

type ArchiverLike = {
  append(source: string | Buffer, data: { name: string }): void;
  on(event: 'warning' | 'error', listener: (error: Error) => void): void;
  pipe(destination: NodeJS.WritableStream): void;
  finalize(): Promise<void>;
};

const _require = createRequire(import.meta.url);
const archiverFactory = _require('archiver') as (
  format: string,
  options?: Record<string, unknown>,
) => ArchiverLike;

const LIGHTROOM_PLUGIN_VERSION = '1.0.0';
const LIGHTROOM_INTEGRATION_TABLE = 'lightroom_integration';
const LIGHTROOM_SIMULATOR_TABLE = 'lightroom_simulator';
const LIGHTROOM_PLUGIN_DIR = fileURLToPath(
  new URL('./lightroom-plugin-template/CreatorHubNorge.lrplugin', import.meta.url),
);
const LIGHTROOM_TEMPLATE_FILES = [
  'Info.lua',
  'PluginInfoProvider.lua',
  'ExportServiceProvider.lua',
  'CreatorHubDefaults.lua',
  'README.txt',
] as const;
const LIGHTROOM_DRIVE_REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
] as const;
const SMOKE_TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s7R6aQAAAAASUVORK5CYII=';

let ensureLightroomSchemaPromise: Promise<void> | null = null;

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
  }

  return fallback;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readDateTimeValue(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return readString(value);
}

function readRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string') {
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

function sanitizeFolderName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function buildFallbackFolderName(payload: {
  customerName?: string | null;
  companyName?: string | null;
  customerEmail?: string | null;
}) {
  const customerName = readString(payload.customerName);
  const companyName = readString(payload.companyName);
  const customerEmail = readString(payload.customerEmail);

  const preferred = customerName || companyName || customerEmail || 'CreatorHub Lightroom';
  return sanitizeFolderName(preferred);
}

function normalizeKeywords(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(/[,;|]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return readStringArray(value);
}

function normalizeGrantedScopes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0))];
  }

  if (typeof value === 'string') {
    return [...new Set(value.split(/\s+/).map((entry) => entry.trim()).filter(Boolean))];
  }

  return [];
}

function buildTokenPreview(token: string | null | undefined): string | null {
  const parsed = readString(token);
  if (!parsed) {
    return null;
  }

  if (parsed.length <= 12) {
    return parsed;
  }

  return `${parsed.slice(0, 8)}…${parsed.slice(-4)}`;
}

function hashPluginToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generatePluginToken(): string {
  return `lrp_${crypto.randomBytes(24).toString('hex')}`;
}

function resolveRequesterUserId(req: Request, body?: Record<string, unknown>): string | null {
  return (
    readString(req.headers['x-user-id']) ||
    readString(body?.userId) ||
    readString(body?.user_id) ||
    readString(req.query.userId) ||
    readString(req.query.user_id)
  );
}

function resolveRequesterEmail(req: Request, body?: Record<string, unknown>): string | null {
  return (
    readString(req.headers['x-user-email']) ||
    readString(body?.userEmail) ||
    readString(body?.user_email) ||
    readString(req.query.userEmail) ||
    readString(req.query.user_email)
  );
}

function resolvePluginToken(req: Request, body?: Record<string, unknown>): string | null {
  const authHeader = readString(req.headers.authorization);
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return readString(authHeader.slice(7));
  }

  return (
    readString(req.headers['x-lightroom-plugin-token']) ||
    readString(body?.pluginToken) ||
    readString(body?.token) ||
    readString(req.query.pluginToken) ||
    readString(req.query.token)
  );
}

function resolvePublicBaseUrl(req: Request): string {
  const envBase = readString(
    process.env.LIGHTROOM_PLUGIN_PUBLIC_URL
      ?? process.env.PUBLIC_API_URL
      ?? process.env.APP_URL
      ?? process.env.PUBLIC_APP_URL,
  );
  if (envBase) {
    return envBase.replace(/\/+$/, '');
  }

  const forwardedProto = readString(req.headers['x-forwarded-proto']);
  const forwardedHost = readString(req.headers['x-forwarded-host']);
  const protocol = forwardedProto || req.protocol || 'http';
  const requestHost = forwardedHost || readString(req.get('host')) || 'localhost:3003';
  const effectiveHost = requestHost.endsWith(':5001')
    ? requestHost.replace(/:5001$/, ':3003')
    : requestHost;

  return `${protocol}://${effectiveHost}`;
}

function resolveLightroomApiBase(req: Request): string {
  return `${resolvePublicBaseUrl(req)}/api/lightroom`;
}

function decodeBase64FilePayload(rawValue: unknown): Buffer | null {
  const parsed = readString(rawValue);
  if (!parsed) {
    return null;
  }

  const normalized = parsed.includes(',')
    ? parsed.slice(parsed.indexOf(',') + 1)
    : parsed;

  try {
    return Buffer.from(normalized, 'base64');
  } catch {
    return null;
  }
}

function buildMimeType(value: unknown, filename: string): string {
  const explicit = readString(value);
  if (explicit) {
    return explicit;
  }

  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.gif')) return 'image/gif';
  if (lowerName.endsWith('.tif') || lowerName.endsWith('.tiff')) return 'image/tiff';
  return 'image/jpeg';
}

function buildDriveImageUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

function readGoogleCredentialsFile():
  | {
      source: 'authorized_user_file';
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
  | null {
  const credentialsPath = readString(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
  if (!credentialsPath || !existsSync(credentialsPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(credentialsPath, 'utf8')) as Record<string, unknown>;

    if (
      parsed.type === 'authorized_user'
      && readString(parsed.client_id)
      && readString(parsed.client_secret)
      && readString(parsed.refresh_token)
    ) {
      return {
        source: 'authorized_user_file',
        clientId: readString(parsed.client_id) as string,
        clientSecret: readString(parsed.client_secret) as string,
        refreshToken: readString(parsed.refresh_token) as string,
      };
    }

    if (
      parsed.type === 'service_account'
      && readString(parsed.client_email)
      && readString(parsed.private_key)
    ) {
      return {
        source: 'service_account_file',
        clientEmail: readString(parsed.client_email) as string,
        privateKey: readString(parsed.private_key) as string,
        subject: readString(process.env.GOOGLE_IMPERSONATE_USER ?? process.env.GOOGLE_ADMIN_EMAIL),
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function fetchGrantedScopes(accessToken: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    );
    const payload = await response.json().catch(() => null) as { scope?: string } | null;
    return normalizeGrantedScopes(payload?.scope);
  } catch {
    return [];
  }
}

async function fetchGoogleAccountEmail(
  authClient: LightroomGoogleAuthClient,
): Promise<string | null> {
  try {
    const oauth2Api = google.oauth2({ version: 'v2', auth: authClient });
    const response = await oauth2Api.userinfo.get();
    return readString(response.data.email);
  } catch {
    return null;
  }
}

async function resolveFallbackLightroomGoogleConnection(
  roleRoomError?: Error | null,
): Promise<AuthorizedLightroomGoogleClient> {
  const clientId = readString(process.env.ROLE_ROOM_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID);
  const clientSecret = readString(process.env.ROLE_ROOM_GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET);
  const redirectUri = readString(
    process.env.ROLE_ROOM_GOOGLE_REDIRECT_URI
      ?? process.env.GOOGLE_REDIRECT_URI
      ?? 'http://localhost:5050/api/auth/google/callback',
  );
  const envRefreshToken = readString(process.env.GOOGLE_WORKSPACE_REFRESH_TOKEN);
  const fallbackWarning = roleRoomError
    ? 'Den brukerspesifikke Google Workspace-koblingen er utilgjengelig. CreatorHub bruker systemets Google Drive-kobling som fallback.'
    : null;
  const attemptedErrors: string[] = [];

  const tryOAuthRefreshToken = async (
    source: Extract<LightroomAuthSource, 'env_refresh_token' | 'authorized_user_file'>,
    refreshToken: string,
    candidateClientId: string,
    candidateClientSecret: string,
  ): Promise<AuthorizedLightroomGoogleClient> => {
    const oauthClient = new google.auth.OAuth2(
      candidateClientId,
      candidateClientSecret,
      redirectUri ?? undefined,
    );

    oauthClient.setCredentials({
      refresh_token: refreshToken,
    });

    await oauthClient.getAccessToken();
    const accessToken = readString(oauthClient.credentials.access_token);

    return {
      authClient: oauthClient,
      source,
      googleEmail: await fetchGoogleAccountEmail(oauthClient),
      storedScopes: accessToken ? await fetchGrantedScopes(accessToken) : [],
      warning: fallbackWarning,
    };
  };

  if (clientId && clientSecret && envRefreshToken) {
    try {
      return await tryOAuthRefreshToken('env_refresh_token', envRefreshToken, clientId, clientSecret);
    } catch (error) {
      attemptedErrors.push(error instanceof Error ? error.message : 'Env refresh token feilet.');
    }
  }

  const credentialsFile = readGoogleCredentialsFile();
  if (credentialsFile?.source === 'authorized_user_file') {
    try {
      return await tryOAuthRefreshToken(
        'authorized_user_file',
        credentialsFile.refreshToken,
        credentialsFile.clientId,
        credentialsFile.clientSecret,
      );
    } catch (error) {
      attemptedErrors.push(error instanceof Error ? error.message : 'Authorized user credentials feilet.');
    }
  }

  if (credentialsFile?.source === 'service_account_file') {
    try {
      const authClient = new google.auth.JWT({
        email: credentialsFile.clientEmail,
        key: credentialsFile.privateKey,
        scopes: [...LIGHTROOM_DRIVE_REQUIRED_SCOPES],
        subject: credentialsFile.subject ?? undefined,
      });
      await authClient.authorize();
      const accessToken = readString(authClient.credentials.access_token);

      return {
        authClient,
        source: 'service_account_file',
        googleEmail: credentialsFile.subject,
        storedScopes: accessToken ? await fetchGrantedScopes(accessToken) : [...LIGHTROOM_DRIVE_REQUIRED_SCOPES],
        warning: fallbackWarning,
      };
    } catch (error) {
      attemptedErrors.push(error instanceof Error ? error.message : 'Service account credentials feilet.');
    }
  }

  if (roleRoomError) {
    throw new Error(
      attemptedErrors.length > 0
        ? `${roleRoomError.message} Fallback til systemets Drive-kobling feilet også: ${attemptedErrors.join(' | ')}`
        : roleRoomError.message,
    );
  }

  throw new Error(
    attemptedErrors.length > 0
      ? attemptedErrors.join(' | ')
      : 'Fant ingen Google Drive-kobling for Lightroom.',
  );
}

async function resolveLightroomGoogleConnection(
  pool: Pool,
  userId: string,
): Promise<AuthorizedLightroomGoogleClient> {
  try {
    const connection = await resolveRoleRoomGoogleConnection(pool, userId);
    return {
      authClient: connection.oauthClient,
      source: 'role_room_connection',
      googleEmail: readString(connection.connection.googleEmail),
      storedScopes: Array.isArray(connection.connection.storedScopes)
        ? connection.connection.storedScopes.filter((entry): entry is string => typeof entry === 'string')
        : [],
      warning: null,
    };
  } catch (error) {
    return resolveFallbackLightroomGoogleConnection(error instanceof Error ? error : new Error(String(error)));
  }
}

function buildDriveThumbnailUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`;
}

async function ensureLightroomSchema(pool: Pool): Promise<void> {
  if (!ensureLightroomSchemaPromise) {
    ensureLightroomSchemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${LIGHTROOM_INTEGRATION_TABLE} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        ALTER TABLE ${LIGHTROOM_INTEGRATION_TABLE}
          ADD COLUMN IF NOT EXISTS user_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS plugin_token_hash TEXT,
          ADD COLUMN IF NOT EXISTS plugin_token_plain TEXT,
          ADD COLUMN IF NOT EXISTS plugin_version VARCHAR(32) DEFAULT '${LIGHTROOM_PLUGIN_VERSION}',
          ADD COLUMN IF NOT EXISTS drive_root_folder_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS drive_root_folder_name VARCHAR(255),
          ADD COLUMN IF NOT EXISTS drive_root_folder_url TEXT,
          ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS last_showcase_item_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS last_drive_file_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS last_error TEXT,
          ADD COLUMN IF NOT EXISTS sync_status VARCHAR(64) DEFAULT 'idle',
          ADD COLUMN IF NOT EXISTS configuration JSONB NOT NULL DEFAULT '{}'::jsonb
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_lightroom_integration_user_id
          ON ${LIGHTROOM_INTEGRATION_TABLE}(user_id)
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${LIGHTROOM_SIMULATOR_TABLE} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        ALTER TABLE ${LIGHTROOM_SIMULATOR_TABLE}
          ADD COLUMN IF NOT EXISTS user_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS export_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS status VARCHAR(64),
          ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS showcase_item_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_lightroom_simulator_user_created
          ON ${LIGHTROOM_SIMULATOR_TABLE}(user_id, created_at DESC)
      `);
    })().catch((error) => {
      ensureLightroomSchemaPromise = null;
      throw error;
    });
  }

  return ensureLightroomSchemaPromise;
}

async function getIntegrationByUserId(pool: Pool, userId: string): Promise<LightroomIntegrationRow | null> {
  await ensureLightroomSchema(pool);
  const result = await pool.query<LightroomIntegrationRow>(
    `SELECT *
     FROM ${LIGHTROOM_INTEGRATION_TABLE}
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

async function getIntegrationByPluginToken(pool: Pool, token: string): Promise<LightroomIntegrationRow | null> {
  await ensureLightroomSchema(pool);
  const result = await pool.query<LightroomIntegrationRow>(
    `SELECT *
     FROM ${LIGHTROOM_INTEGRATION_TABLE}
     WHERE plugin_token_hash = $1
     LIMIT 1`,
    [hashPluginToken(token)],
  );

  return result.rows[0] ?? null;
}

async function upsertIntegrationRecord(
  pool: Pool,
  params: {
    userId: string;
    pluginTokenHash?: string | null;
    pluginTokenPlain?: string | null;
    driveRootFolderId?: string | null;
    driveRootFolderName?: string | null;
    driveRootFolderUrl?: string | null;
    lastSyncAt?: string | null;
    lastShowcaseItemId?: string | null;
    lastDriveFileId?: string | null;
    lastError?: string | null;
    syncStatus?: string | null;
    configuration?: Record<string, unknown>;
  },
): Promise<LightroomIntegrationRow> {
  await ensureLightroomSchema(pool);
  const nowIso = new Date().toISOString();
  const result = await pool.query<LightroomIntegrationRow>(
    `INSERT INTO ${LIGHTROOM_INTEGRATION_TABLE} (
       id,
       user_id,
       plugin_token_hash,
       plugin_token_plain,
       plugin_version,
       drive_root_folder_id,
       drive_root_folder_name,
       drive_root_folder_url,
       last_sync_at,
       last_showcase_item_id,
       last_drive_file_id,
       last_error,
       sync_status,
       configuration,
       created_at,
       updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10,
       $11, $12, $13, $14,
       $15::timestamptz, $16::timestamptz
     )
     ON CONFLICT (user_id) DO UPDATE SET
       plugin_token_hash = COALESCE(EXCLUDED.plugin_token_hash, ${LIGHTROOM_INTEGRATION_TABLE}.plugin_token_hash),
       plugin_token_plain = COALESCE(EXCLUDED.plugin_token_plain, ${LIGHTROOM_INTEGRATION_TABLE}.plugin_token_plain),
       plugin_version = EXCLUDED.plugin_version,
       drive_root_folder_id = COALESCE(EXCLUDED.drive_root_folder_id, ${LIGHTROOM_INTEGRATION_TABLE}.drive_root_folder_id),
       drive_root_folder_name = COALESCE(EXCLUDED.drive_root_folder_name, ${LIGHTROOM_INTEGRATION_TABLE}.drive_root_folder_name),
       drive_root_folder_url = COALESCE(EXCLUDED.drive_root_folder_url, ${LIGHTROOM_INTEGRATION_TABLE}.drive_root_folder_url),
       last_sync_at = COALESCE(EXCLUDED.last_sync_at, ${LIGHTROOM_INTEGRATION_TABLE}.last_sync_at),
       last_showcase_item_id = COALESCE(EXCLUDED.last_showcase_item_id, ${LIGHTROOM_INTEGRATION_TABLE}.last_showcase_item_id),
       last_drive_file_id = COALESCE(EXCLUDED.last_drive_file_id, ${LIGHTROOM_INTEGRATION_TABLE}.last_drive_file_id),
       last_error = EXCLUDED.last_error,
       sync_status = COALESCE(EXCLUDED.sync_status, ${LIGHTROOM_INTEGRATION_TABLE}.sync_status),
       configuration = COALESCE(EXCLUDED.configuration, ${LIGHTROOM_INTEGRATION_TABLE}.configuration),
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [
      crypto.randomUUID(),
      params.userId,
      params.pluginTokenHash ?? null,
      params.pluginTokenPlain ?? null,
      LIGHTROOM_PLUGIN_VERSION,
      params.driveRootFolderId ?? null,
      params.driveRootFolderName ?? null,
      params.driveRootFolderUrl ?? null,
      params.lastSyncAt ?? null,
      params.lastShowcaseItemId ?? null,
      params.lastDriveFileId ?? null,
      params.lastError ?? null,
      params.syncStatus ?? 'idle',
      JSON.stringify(params.configuration ?? {}),
      nowIso,
      nowIso,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Kunne ikke lagre Lightroom-integrasjonen.');
  }

  return row;
}

async function logLightroomRun(
  pool: Pool,
  params: {
    userId: string;
    exportId: string;
    status: 'success' | 'error';
    driveFileId?: string | null;
    showcaseItemId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await ensureLightroomSchema(pool);
  const nowIso = new Date().toISOString();
  await pool.query(
    `INSERT INTO ${LIGHTROOM_SIMULATOR_TABLE} (
       id, user_id, export_id, status, drive_file_id, showcase_item_id, metadata, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz)`,
    [
      crypto.randomUUID(),
      params.userId,
      params.exportId,
      params.status,
      params.driveFileId ?? null,
      params.showcaseItemId ?? null,
      JSON.stringify(params.metadata ?? {}),
      nowIso,
      nowIso,
    ],
  );
}

async function getRecentRuns(pool: Pool, userId: string): Promise<LightroomSimulationRow[]> {
  await ensureLightroomSchema(pool);
  const result = await pool.query<LightroomSimulationRow>(
    `SELECT *
     FROM ${LIGHTROOM_SIMULATOR_TABLE}
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId],
  );

  return result.rows;
}

async function resolveWorkspaceStatus(pool: Pool, userId: string): Promise<LightroomWorkspaceStatus> {
  try {
    const connection = await resolveLightroomGoogleConnection(pool, userId);
    return {
      connected: true,
      googleEmail: readString(connection.googleEmail),
      storedScopes: Array.isArray(connection.storedScopes)
        ? connection.storedScopes.filter((entry): entry is string => typeof entry === 'string')
        : [],
      error: null,
      source: connection.source,
      warning: connection.warning,
    };
  } catch (error) {
    return {
      connected: false,
      googleEmail: null,
      storedScopes: [],
      error: error instanceof Error ? error.message : 'Google Workspace er ikke koblet til.',
      source: null,
      warning: null,
    };
  }
}

async function ensurePluginToken(
  pool: Pool,
  userId: string,
  rotate = false,
): Promise<{ integration: LightroomIntegrationRow; token: string }> {
  const existing = await getIntegrationByUserId(pool, userId);
  const shouldRotate = rotate || !readString(existing?.plugin_token_plain);
  const token = shouldRotate
    ? generatePluginToken()
    : (readString(existing?.plugin_token_plain) as string);

  const nextConfiguration = {
    ...readRecord(existing?.configuration),
    lastPackageGeneratedAt: new Date().toISOString(),
  };

  const integration = await upsertIntegrationRecord(pool, {
    userId,
    pluginTokenHash: shouldRotate ? hashPluginToken(token) : existing?.plugin_token_hash ?? null,
    pluginTokenPlain: token,
    driveRootFolderId: existing?.drive_root_folder_id ?? null,
    driveRootFolderName: existing?.drive_root_folder_name ?? null,
    driveRootFolderUrl: existing?.drive_root_folder_url ?? null,
    lastSyncAt: existing?.last_sync_at ?? null,
    lastShowcaseItemId: existing?.last_showcase_item_id ?? null,
    lastDriveFileId: existing?.last_drive_file_id ?? null,
    lastError: shouldRotate ? null : existing?.last_error ?? null,
    syncStatus: existing?.sync_status ?? 'idle',
    configuration: nextConfiguration,
  });

  return { integration, token };
}

async function loadPluginTemplateFiles(): Promise<Record<string, string>> {
  const entries = await Promise.all(
    LIGHTROOM_TEMPLATE_FILES.map(async (fileName) => {
      const content = await fs.readFile(path.join(LIGHTROOM_PLUGIN_DIR, fileName), 'utf8');
      return [fileName, content] as const;
    }),
  );

  return Object.fromEntries(entries);
}

function injectTemplateVariables(
  template: string,
  variables: Record<string, string>,
): string {
  return Object.entries(variables).reduce(
    (content, [key, value]) => content.replaceAll(`__${key}__`, value),
    template,
  );
}

async function streamPluginPackage(
  req: Request,
  res: Response,
  token: string,
): Promise<void> {
  const templates = await loadPluginTemplateFiles();
  const variables = {
    CREATORHUB_API_BASE_URL: resolveLightroomApiBase(req),
    CREATORHUB_PLUGIN_TOKEN: token,
    CREATORHUB_PLUGIN_VERSION: LIGHTROOM_PLUGIN_VERSION,
    CREATORHUB_PLUGIN_DOWNLOAD_URL: `${resolveLightroomApiBase(req)}/download-plugin`,
  };

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="CreatorHubNorge-Lightroom-Plugin.zip"',
  );

  const archive = archiverFactory('zip', { zlib: { level: 9 } });
  archive.on('warning', (error) => {
    if (error.name !== 'ENOENT') {
      throw error;
    }
  });
  archive.on('error', (error) => {
    throw error;
  });
  archive.pipe(res);

  Object.entries(templates).forEach(([fileName, content]) => {
    archive.append(injectTemplateVariables(content, variables), {
      name: `CreatorHubNorge.lrplugin/${fileName}`,
    });
  });

  await archive.finalize();
}

async function ensureLightroomDriveDestination(
  pool: Pool,
  driveApi: ReturnType<typeof google.drive>,
  userId: string,
  payload: LightroomExportPayload,
) {
  const workspace = await ensureCustomerDriveWorkspace(pool, driveApi, {
    userId,
    customerId: payload.customerId,
    customerEmail: payload.customerEmail,
    projectId: payload.projectId,
    customerName: payload.customerName,
    companyName: payload.companyName,
    profession: payload.profession,
  });

  let rootFolder = workspace.rootFolder;
  if (!rootFolder) {
    const lightroomRoot = await ensureDriveFolder(driveApi, 'CreatorHub Lightroom Uploads');
    const fallbackCustomerFolderName = buildFallbackFolderName({
      customerName: payload.customerName,
      companyName: payload.companyName,
      customerEmail: payload.customerEmail,
    });
    rootFolder = await ensureDriveFolder(driveApi, fallbackCustomerFolderName, lightroomRoot.id);
  }

  const exportsFolder = await ensureDriveFolder(driveApi, 'Lightroom Exports', rootFolder.id);

  let destinationFolder = exportsFolder;
  const projectFolderName = sanitizeFolderName(
    readString(payload.projectName) || readString(payload.projectId) || '',
  );
  if (projectFolderName) {
    destinationFolder = await ensureDriveFolder(driveApi, projectFolderName, destinationFolder.id);
  }

  const collectionFolderName = sanitizeFolderName(payload.collectionName || '');
  if (collectionFolderName) {
    destinationFolder = await ensureDriveFolder(driveApi, collectionFolderName, destinationFolder.id);
  }

  return {
    rootFolder,
    destinationFolder,
  };
}

async function ensureDriveLinkAccess(
  driveApi: ReturnType<typeof google.drive>,
  fileId: string,
): Promise<void> {
  const permissions = await driveApi.permissions.list({
    fileId,
    supportsAllDrives: true,
    fields: 'permissions(id,type,role,allowFileDiscovery)',
  });
  const existingPermissions = Array.isArray(permissions.data.permissions)
    ? permissions.data.permissions
    : [];
  const hasPublicAccess = existingPermissions.some(
    (permission) => readString(permission.type) === 'anyone',
  );
  if (hasPublicAccess) {
    return;
  }

  await driveApi.permissions.create({
    fileId,
    supportsAllDrives: true,
    requestBody: {
      type: 'anyone',
      role: 'reader',
      allowFileDiscovery: false,
    },
  });
}

async function createShowcaseItem(
  pool: Pool,
  userId: string,
  payload: LightroomExportPayload,
  result: {
    driveFileId: string;
    driveWebViewLink: string | null;
    driveWebContentLink: string | null;
    driveRootFolderId: string;
    driveRootFolderName: string;
    driveRootFolderUrl: string | null;
    driveFolderId: string;
    driveFolderName: string;
  },
): Promise<string> {
  const showcaseItemId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const imageUrl = buildDriveImageUrl(result.driveFileId);
  const thumbnailUrl = buildDriveThumbnailUrl(result.driveFileId);

  await pool.query(
    `INSERT INTO showcase_items (
       id,
       user_id,
       profession,
       category,
       title,
       description,
       image_url,
       thumbnail_url,
       crop_data,
       is_public,
       is_active,
       created_at,
       updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, true, true, $10::timestamptz, $11::timestamptz
     )`,
    [
      showcaseItemId,
      userId,
      payload.profession,
      payload.category,
      payload.title,
      payload.description,
      imageUrl,
      thumbnailUrl,
      JSON.stringify({
        source: 'lightroom-plugin',
        clientName: payload.customerName,
        projectId: payload.projectId,
        projectName: payload.projectName,
        customerId: payload.customerId,
        customerEmail: payload.customerEmail,
        companyName: payload.companyName,
        collectionName: payload.collectionName,
        driveFileId: result.driveFileId,
        driveFolderId: result.driveFolderId,
        driveFolderName: result.driveFolderName,
        driveRootFolderId: result.driveRootFolderId,
        driveRootFolderName: result.driveRootFolderName,
        driveRootFolderUrl: result.driveRootFolderUrl,
        driveWebViewLink: result.driveWebViewLink,
        driveWebContentLink: result.driveWebContentLink,
        keywords: payload.keywords,
        rating: payload.rating,
        captureDate: payload.captureDate,
        metadata: payload.metadata,
      }),
      nowIso,
      nowIso,
    ],
  );

  return showcaseItemId;
}

async function performLightroomExport(
  pool: Pool,
  integration: LightroomIntegrationRow,
  payload: LightroomExportPayload,
): Promise<LightroomExportResult> {
  const integrationUserId = readString(integration.user_id);
  if (!integrationUserId) {
    throw new Error('Lightroom-integrasjonen mangler bruker-id.');
  }

  const googleConnection = await resolveLightroomGoogleConnection(pool, integrationUserId);
  const driveApi = google.drive({ version: 'v3', auth: googleConnection.authClient });
  const destination = await ensureLightroomDriveDestination(pool, driveApi, integrationUserId, payload);
  const fileName = sanitizeFolderName(payload.filename) || `Lightroom Export ${Date.now()}.jpg`;

  const created = await driveApi.files.create({
    requestBody: {
      name: fileName,
      parents: [destination.destinationFolder.id],
      description: [
        'Uploaded from CreatorHub Lightroom plugin',
        payload.collectionName,
        payload.projectName,
        payload.customerName,
      ].filter(Boolean).join(' • '),
      appProperties: Object.fromEntries(
        Object.entries({
          creatorhubSource: 'lightroom-plugin',
          creatorhubUserId: integrationUserId,
          creatorhubProjectId: payload.projectId,
          creatorhubCustomerId: payload.customerId,
          creatorhubCollectionName: payload.collectionName,
        }).filter((entry): entry is [string, string] => Boolean(entry[1])),
      ),
    },
    media: {
      mimeType: payload.mimeType,
      body: Readable.from(payload.fileBuffer),
    },
    supportsAllDrives: true,
    fields: 'id,name,webViewLink,webContentLink,mimeType',
  });

  const driveFileId = readString(created.data.id);
  if (!driveFileId) {
    throw new Error('Google Drive returnerte ikke en fil-ID for Lightroom-eksporten.');
  }

  await ensureDriveLinkAccess(driveApi, driveFileId);

  const driveWebViewLink = readString(created.data.webViewLink);
  const driveWebContentLink = readString(created.data.webContentLink);
  const showcaseItemId = await createShowcaseItem(pool, integrationUserId, payload, {
    driveFileId,
    driveWebViewLink,
    driveWebContentLink,
    driveRootFolderId: destination.rootFolder.id,
    driveRootFolderName: destination.rootFolder.name,
    driveRootFolderUrl: destination.rootFolder.webViewLink,
    driveFolderId: destination.destinationFolder.id,
    driveFolderName: destination.destinationFolder.name,
  });
  const exportId = crypto.randomUUID();
  const lastSyncAt = new Date().toISOString();

  await upsertIntegrationRecord(pool, {
    userId: integrationUserId,
    pluginTokenHash: integration.plugin_token_hash,
    pluginTokenPlain: integration.plugin_token_plain,
    driveRootFolderId: destination.rootFolder.id,
    driveRootFolderName: destination.rootFolder.name,
    driveRootFolderUrl: destination.rootFolder.webViewLink,
    lastSyncAt,
    lastShowcaseItemId: showcaseItemId,
    lastDriveFileId: driveFileId,
    lastError: null,
    syncStatus: 'synced',
    configuration: {
      ...readRecord(integration.configuration),
      lastCollectionName: payload.collectionName,
      lastProjectId: payload.projectId,
      lastProjectName: payload.projectName,
      lastCustomerId: payload.customerId,
      lastDriveFolderId: destination.destinationFolder.id,
      lastDriveFolderName: destination.destinationFolder.name,
    },
  });

  await logLightroomRun(pool, {
    userId: integrationUserId,
    exportId,
    status: 'success',
    driveFileId,
    showcaseItemId,
    metadata: {
      authSource: googleConnection.source,
      authWarning: googleConnection.warning,
      title: payload.title,
      category: payload.category,
      collectionName: payload.collectionName,
      driveFolderName: destination.destinationFolder.name,
    },
  });

  return {
    success: true,
    exportId,
    showcaseItemId,
    driveFileId,
    driveFolderId: destination.destinationFolder.id,
    driveFolderName: destination.destinationFolder.name,
    driveRootFolderId: destination.rootFolder.id,
    driveRootFolderName: destination.rootFolder.name,
    driveRootFolderUrl: destination.rootFolder.webViewLink,
    driveWebViewLink,
    driveWebContentLink,
    imageUrl: buildDriveImageUrl(driveFileId),
    thumbnailUrl: buildDriveThumbnailUrl(driveFileId),
    title: payload.title,
    category: payload.category,
  };
}

function normalizeExportPayload(body: Record<string, unknown>): LightroomExportPayload {
  const filename = readString(body.filename) || `lightroom-export-${Date.now()}.jpg`;
  const title = readString(body.title) || path.parse(filename).name;
  const description = readString(body.caption)
    || readString(body.description)
    || 'Eksportert fra CreatorHub Lightroom plugin';
  const collectionName = readString(body.collectionName) || readString(body.collection);
  const category = readString(body.category) || collectionName || 'Lightroom Uploads';
  const profession = readString(body.profession) || 'photographer';
  const fileBuffer = decodeBase64FilePayload(body.fileDataBase64 ?? body.fileData ?? body.base64Data);
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Lightroom-eksporten mangler gyldig bildebuffer.');
  }

  return {
    filename,
    title,
    description,
    collectionName,
    category,
    customerId: readString(body.customerId),
    customerEmail: readString(body.customerEmail),
    customerName: readString(body.customerName),
    companyName: readString(body.companyName),
    projectId: readString(body.projectId),
    projectName: readString(body.projectName),
    profession,
    mimeType: buildMimeType(body.mimeType, filename),
    fileBuffer,
    keywords: normalizeKeywords(body.keywords),
    rating: readNumber(body.rating),
    captureDate: readString(body.captureDate) || readString(body.capturedAt),
    metadata: readRecord(body.metadata),
  };
}

async function handlePluginExport(
  pool: Pool,
  req: Request,
  res: Response,
): Promise<void> {
  const payload = req.body && typeof req.body === 'object'
    ? (req.body as Record<string, unknown>)
    : {};
  const pluginToken = resolvePluginToken(req, payload);
  if (!pluginToken) {
    res.status(401).json({ error: 'Lightroom-plugin-token mangler.' });
    return;
  }

  const integration = await getIntegrationByPluginToken(pool, pluginToken);
  if (!integration) {
    res.status(401).json({ error: 'Ugyldig Lightroom-plugin-token.' });
    return;
  }

  try {
    const exportPayload = normalizeExportPayload(payload);
    const result = await performLightroomExport(pool, integration, exportPayload);
    res.status(201).json(result);
  } catch (error) {
    const userId = readString(integration.user_id);
    const exportId = crypto.randomUUID();
    if (userId) {
      await upsertIntegrationRecord(pool, {
        userId,
        pluginTokenHash: integration.plugin_token_hash,
        pluginTokenPlain: integration.plugin_token_plain,
        driveRootFolderId: integration.drive_root_folder_id,
        driveRootFolderName: integration.drive_root_folder_name,
        driveRootFolderUrl: integration.drive_root_folder_url,
        lastSyncAt: integration.last_sync_at,
        lastShowcaseItemId: integration.last_showcase_item_id,
        lastDriveFileId: integration.last_drive_file_id,
        lastError: error instanceof Error ? error.message : 'Lightroom-export feilet.',
        syncStatus: 'error',
        configuration: readRecord(integration.configuration),
      });
      await logLightroomRun(pool, {
        userId,
        exportId,
        status: 'error',
        metadata: {
          source: 'lightroom-plugin',
          filename: readString(payload.filename),
          title: readString(payload.title),
          error: error instanceof Error ? error.message : 'Lightroom-export feilet.',
        },
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Lightroom-eksporten feilet.',
    });
  }
}

export function createLightroomRouter(pool: Pool): Router {
  const router = Router();

  router.get('/status', async (req, res) => {
    try {
      const userId = resolveRequesterUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Brukeridentitet mangler.' });
        return;
      }

      const integration = await getIntegrationByUserId(pool, userId);
      const workspace = await resolveWorkspaceStatus(pool, userId);
      const recentRuns = await getRecentRuns(pool, userId);

      res.json({
        connected: Boolean(integration),
        pluginVersion: readString(integration?.plugin_version) || LIGHTROOM_PLUGIN_VERSION,
        tokenPreview: buildTokenPreview(integration?.plugin_token_plain),
        workspaceConnected: workspace.connected,
        googleEmail: workspace.googleEmail,
        storedScopes: workspace.storedScopes,
        workspaceError: workspace.error,
        workspaceSource: workspace.source,
        workspaceWarning: workspace.warning,
        driveRootFolderId: readString(integration?.drive_root_folder_id),
        driveRootFolderName: readString(integration?.drive_root_folder_name),
        driveRootFolderUrl: readString(integration?.drive_root_folder_url),
        lastSyncAt: readDateTimeValue(integration?.last_sync_at),
        lastShowcaseItemId: readString(integration?.last_showcase_item_id),
        lastDriveFileId: readString(integration?.last_drive_file_id),
        lastError: readString(integration?.last_error),
        syncStatus: readString(integration?.sync_status) || 'idle',
        configuration: readRecord(integration?.configuration),
        packageDownloadUrl: '/api/lightroom/download-plugin',
        apiBaseUrl: resolveLightroomApiBase(req),
        recentRuns: recentRuns.map((row) => ({
          id: row.id,
          status: readString(row.status) || 'unknown',
          exportId: readString(row.export_id),
          driveFileId: readString(row.drive_file_id),
          showcaseItemId: readString(row.showcase_item_id),
          metadata: readRecord(row.metadata),
          createdAt: readDateTimeValue(row.created_at),
        })),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Kunne ikke hente Lightroom-status.',
      });
    }
  });

  router.post('/token', async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object'
        ? (req.body as Record<string, unknown>)
        : {};
      const userId = resolveRequesterUserId(req, body);
      if (!userId) {
        res.status(401).json({ error: 'Brukeridentitet mangler.' });
        return;
      }

      const rotate = readBoolean(body.rotate, true);
      const { integration, token } = await ensurePluginToken(pool, userId, rotate);
      const workspace = await resolveWorkspaceStatus(pool, userId);

      res.status(201).json({
        token,
        tokenPreview: buildTokenPreview(token),
        pluginVersion: readString(integration.plugin_version) || LIGHTROOM_PLUGIN_VERSION,
        workspaceConnected: workspace.connected,
        googleEmail: workspace.googleEmail,
        workspaceSource: workspace.source,
        workspaceWarning: workspace.warning,
        apiBaseUrl: resolveLightroomApiBase(req),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Kunne ikke opprette Lightroom-token.',
      });
    }
  });

  router.get('/download-plugin', async (req, res) => {
    try {
      const userId = resolveRequesterUserId(req);
      if (!userId) {
        res.status(401).json({ error: 'Brukeridentitet mangler.' });
        return;
      }

      const rotate = readBoolean(req.query.rotate, false);
      const { token } = await ensurePluginToken(pool, userId, rotate);
      await streamPluginPackage(req, res, token);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Kunne ikke generere Lightroom-pluginpakken.',
      });
    }
  });

  router.post('/smoke-export', async (req, res) => {
    const body = req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : {};
    const userId = resolveRequesterUserId(req, body);
    const userEmail = resolveRequesterEmail(req, body);

    try {
      if (!userId) {
        res.status(401).json({ error: 'Brukeridentitet mangler.' });
        return;
      }

      const { integration } = await ensurePluginToken(pool, userId, false);
      const smokePayload = normalizeExportPayload({
        filename: 'creatorhub-lightroom-smoke-test.png',
        title: 'CreatorHub Lightroom Smoke Test',
        caption: 'Ende-til-ende-test av Lightroom, Google Drive og showcase.',
        collectionName: 'CreatorHub Smoke Test',
        category: 'CreatorHub Smoke Test',
        projectName: readString(body.projectName) || 'Lightroom Smoke Test',
        projectId: readString(body.projectId),
        customerEmail: readString(body.customerEmail) || userEmail,
        customerName: readString(body.customerName) || 'CreatorHub Smoke Test',
        companyName: readString(body.companyName) || 'CreatorHub',
        profession: readString(body.profession) || 'photographer',
        mimeType: 'image/png',
        fileDataBase64: SMOKE_TEST_PNG_BASE64,
        metadata: {
          source: 'lightroom-smoke-export',
          requestedFrom: 'browser',
        },
      });
      const result = await performLightroomExport(pool, integration, smokePayload);
      res.status(201).json(result);
    } catch (error) {
      if (userId) {
        const existing = await getIntegrationByUserId(pool, userId);
        await upsertIntegrationRecord(pool, {
          userId,
          pluginTokenHash: existing?.plugin_token_hash ?? null,
          pluginTokenPlain: existing?.plugin_token_plain ?? null,
          driveRootFolderId: existing?.drive_root_folder_id ?? null,
          driveRootFolderName: existing?.drive_root_folder_name ?? null,
          driveRootFolderUrl: existing?.drive_root_folder_url ?? null,
          lastSyncAt: existing?.last_sync_at ?? null,
          lastShowcaseItemId: existing?.last_showcase_item_id ?? null,
          lastDriveFileId: existing?.last_drive_file_id ?? null,
          lastError: error instanceof Error ? error.message : 'Kunne ikke kjøre Lightroom smoke-test.',
          syncStatus: 'error',
          configuration: {
            ...readRecord(existing?.configuration),
            lastSmokeTestAt: new Date().toISOString(),
          },
        });
        await logLightroomRun(pool, {
          userId,
          exportId: crypto.randomUUID(),
          status: 'error',
          metadata: {
            source: 'lightroom-smoke-export',
            requestedFrom: 'browser',
            userEmail,
            error: error instanceof Error ? error.message : 'Kunne ikke kjøre Lightroom smoke-test.',
          },
        });
      }

      res.status(500).json({
        error: error instanceof Error ? error.message : 'Kunne ikke kjøre Lightroom smoke-test.',
      });
    }
  });

  router.post('/plugin/export-photo', async (req, res) => {
    await handlePluginExport(pool, req, res);
  });

  router.post('/export-photo', async (req, res) => {
    await handlePluginExport(pool, req, res);
  });

  return router;
}
