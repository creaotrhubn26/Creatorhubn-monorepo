import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createReadStream, readFileSync } from 'fs';
import { createRequire } from 'module';
import { google } from 'googleapis';
import sharp from 'sharp';
import { Upload } from '@aws-sdk/lib-storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import {
  ensureCustomerDriveWorkspace,
  ensureDriveFolder,
} from './customer-drive-sync.js';
import { resolveCreatorHubGoogleConnection } from './contract-google-signing.js';
import {
  deleteCreatorHubObject,
  getCreatorHubObjectStorage,
  headCreatorHubObject,
  putCreatorHubObject,
} from './creatorhub-object-storage.js';
import { buildPhotoRoomCaptureKey } from './photo-room-storage-contract.js';
import { loadPersistedAuthSession } from './auth-session-store.js';

type LightroomSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
};

type AuthedLightroomRequest = Request & {
  lightroomSession: LightroomSession;
};

type LightroomPluginRequest = Request & {
  lightroomIntegration?: LightroomIntegrationRow;
};

type LightroomDeskSsoPayload = {
  v: 1;
  aud: 'creatorhub-lightroom-plugin';
  sub: string;
  did: string;
  iat: number;
  exp: number;
  jti: string;
};

type LightroomIntegrationRow = {
  id: string;
  user_id: string | null;
  plugin_token_hash: string | null;
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

type LightroomUserWorkspaceRecord = {
  googleEmail: string | null;
  storedScopes: string[];
  connectionState: string | null;
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
  fileBuffer: Buffer | null;
  temporaryFilePath: string | null;
  sizeBytes: number;
  keywords: string[];
  rating: number | null;
  captureDate: string | null;
  metadata: Record<string, unknown>;
  mirrorToDrive: boolean;
};

type LightroomExportResult = {
  success: true;
  exportId: string;
  assetId: string;
  objectKey: string;
  checksumSha256: string;
  sizeBytes: number;
  storageProvider: 'creatorhub_s3';
  driveMirrored: boolean;
  driveMirrorError: string | null;
  showcaseItemId: string | null;
  driveFileId: string | null;
  driveFolderId: string | null;
  driveFolderName: string | null;
  driveRootFolderId: string | null;
  driveRootFolderName: string | null;
  driveRootFolderUrl: string | null;
  driveWebViewLink: string | null;
  driveWebContentLink: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  title: string;
  category: string;
};

type LightroomProjectOption = {
  id: string;
  title: string;
};

type LightroomLatestExport = {
  exportId: string;
  projectId: string;
  projectTitle: string;
  assetId: string;
  filename: string;
  status: string;
  verifiedAt: string | null;
  createdAt: string | null;
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

const LIGHTROOM_DESK_SSO_TTL_SECONDS = 10 * 60;
const LIGHTROOM_INTEGRATION_TABLE = 'lightroom_integration';
const LIGHTROOM_SIMULATOR_TABLE = 'lightroom_simulator';
const LIGHTROOM_PLUGIN_DIR = fileURLToPath(
  new URL('./lightroom-plugin-template/CreatorHubNorge.lrplugin', import.meta.url),
);
type LightroomPluginManifest = {
  major: number;
  minor: number;
  revision: number;
  build: number;
  displayVersion: string;
};
const LIGHTROOM_PLUGIN_MANIFEST = JSON.parse(readFileSync(
  path.join(LIGHTROOM_PLUGIN_DIR, 'CreatorHubManifest.json'),
  'utf8',
)) as LightroomPluginManifest;
const LIGHTROOM_PLUGIN_VERSION = LIGHTROOM_PLUGIN_MANIFEST.displayVersion;
const LIGHTROOM_TEMPLATE_FILES = [
  'Info.lua',
  'CreatorHubManifest.json',
  'PluginInit.lua',
  'PluginInfoProvider.lua',
  'ExportServiceProvider.lua',
  'CreatorHubDefaults.lua',
  'README.txt',
  'TranslatedStrings_en.txt',
  'TranslatedStrings_nb.txt',
] as const;
const SMOKE_TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s7R6aQAAAAASUVORK5CYII=';
const lightroomMultipartUpload = multer({
  dest: path.join(os.tmpdir(), 'creatorhub-lightroom-classic'),
  limits: { files: 1, fileSize: 1024 * 1024 * 1024, fields: 64 },
});

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

function lightroomDeskSsoSecret(): string {
  const secret = readString(process.env.LIGHTROOM_DESK_SSO_SECRET)
    || readString(process.env.SESSION_SECRET)
    || readString(process.env.JWT_SECRET)
    || readString(process.env.AUTH_SECRET);
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('LIGHTROOM_DESK_SSO_SECRET eller SESSION_SECRET må være minst 32 byte.');
  }
  return secret;
}

export function issueLightroomDeskSsoToken(
  userId: string,
  deviceId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): { token: string; expiresAt: string } {
  const payload: LightroomDeskSsoPayload = {
    v: 1,
    aud: 'creatorhub-lightroom-plugin',
    sub: userId,
    did: deviceId,
    iat: nowSeconds,
    exp: nowSeconds + LIGHTROOM_DESK_SSO_TTL_SECONDS,
    jti: crypto.randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', lightroomDeskSsoSecret())
    .update(encoded)
    .digest('base64url');
  return {
    token: `lrs_${encoded}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function verifyLightroomDeskSsoToken(
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): LightroomDeskSsoPayload | null {
  if (!token.startsWith('lrs_') || token.length > 2_048) return null;
  const parts = token.slice(4).split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = crypto
    .createHmac('sha256', lightroomDeskSsoSecret())
    .update(parts[0])
    .digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(parts[1], 'base64url');
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Partial<LightroomDeskSsoPayload>;
    if (
      payload.v !== 1
      || payload.aud !== 'creatorhub-lightroom-plugin'
      || typeof payload.sub !== 'string'
      || !payload.sub
      || typeof payload.did !== 'string'
      || !payload.did
      || typeof payload.iat !== 'number'
      || typeof payload.exp !== 'number'
      || typeof payload.jti !== 'string'
      || payload.iat > nowSeconds + 60
      || payload.exp <= nowSeconds
      || payload.exp - payload.iat > LIGHTROOM_DESK_SSO_TTL_SECONDS
    ) {
      return null;
    }
    return payload as LightroomDeskSsoPayload;
  } catch {
    return null;
  }
}

function requireLightroomSession(
  pool: Pool,
  activeSessions?: ReadonlyMap<string, LightroomSession>,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = readString(req.headers.authorization)?.replace(/^Bearer\s+/iu, '').trim();
    if (!bearer || bearer.length > 512) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const session = activeSessions?.get(bearer)
      ?? await loadPersistedAuthSession<LightroomSession>(pool, bearer);
    if (!session?.userId || session.userId === 'guest') {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    (req as AuthedLightroomRequest).lightroomSession = session;
    next();
  };
}

function authenticatedUserId(req: Request): string {
  return (req as AuthedLightroomRequest).lightroomSession.userId;
}

function authenticatedUserEmail(req: Request): string | null {
  return readString((req as AuthedLightroomRequest).lightroomSession.email);
}

function resolvePluginToken(req: Request, body?: Record<string, unknown>): string | null {
  void body;
  const authHeader = readString(req.headers.authorization);
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return readString(authHeader.slice(7));
  }

  return readString(req.headers['x-lightroom-plugin-token']);
}

function requireLightroomPluginToken(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // This guard intentionally runs before multer writes the incoming file.
    // Pre-upload auth accepts headers only; tokens in query/body are retained
    // solely for the small legacy JSON endpoint handled after body parsing.
    const authHeader = readString(req.headers.authorization);
    const token = authHeader?.toLowerCase().startsWith('bearer ')
      ? readString(authHeader.slice(7))
      : readString(req.headers['x-lightroom-plugin-token']);
    if (!token) {
      res.status(401).json({ error: 'Lightroom-plugin-token mangler.' });
      return;
    }
    let integration: LightroomIntegrationRow | null = null;
    if (token.startsWith('lrs_')) {
      const session = verifyLightroomDeskSsoToken(token);
      if (session) {
        const activeDevice = await pool.query(
          `SELECT id FROM desktop_device_tokens
           WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()
           LIMIT 1`,
          [session.did, session.sub],
        );
        if (activeDevice.rows[0]) {
          integration = await getIntegrationByUserId(pool, session.sub);
        }
      }
    } else {
      integration = await getIntegrationByPluginToken(pool, token);
    }
    if (!integration) {
      res.status(401).json({ error: 'Ugyldig Lightroom-plugin-token.' });
      return;
    }
    (req as LightroomPluginRequest).lightroomIntegration = integration;
    next();
  };
}

function resolvePublicBaseUrl(req: Request): string {
  const envBase = readString(
    process.env.LIGHTROOM_PLUGIN_PUBLIC_URL
      ?? process.env.PUBLIC_API_URL
      ?? process.env.APP_URL
      ?? process.env.PUBLIC_APP_URL,
  );
  if (envBase) {
    return canonicalizeLightroomPublicBase(envBase);
  }

  const forwardedProto = readString(req.headers['x-forwarded-proto']);
  const forwardedHost = readString(req.headers['x-forwarded-host']);
  const protocol = forwardedProto || req.protocol || 'http';
  const requestHost = forwardedHost || readString(req.get('host')) || 'localhost:3003';
  const effectiveHost = requestHost.endsWith(':5001')
    ? requestHost.replace(/:5001$/, ':3003')
    : requestHost;

  return canonicalizeLightroomPublicBase(`${protocol}://${effectiveHost}`);
}

export function canonicalizeLightroomPublicBase(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(normalized);
    if (parsed.hostname.toLowerCase() === 'creatorhubn.com') {
      parsed.hostname = 'www.creatorhubn.com';
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return normalized;
  }
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

async function checksumLightroomPayload(payload: LightroomExportPayload): Promise<string> {
  if (payload.fileBuffer) {
    return crypto.createHash('sha256').update(payload.fileBuffer).digest('hex');
  }
  if (!payload.temporaryFilePath) {
    throw new Error('Lightroom-eksporten mangler en lesbar fil.');
  }
  const hash = crypto.createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(payload.temporaryFilePath as string);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', resolve);
  });
  return hash.digest('hex');
}

function lightroomPayloadBody(
  payload: LightroomExportPayload,
): Buffer | ReturnType<typeof createReadStream> {
  if (payload.fileBuffer) return payload.fileBuffer;
  if (payload.temporaryFilePath) return createReadStream(payload.temporaryFilePath);
  throw new Error('Lightroom-eksporten mangler en lesbar fil.');
}

async function verifyCreatorHubLightroomObject(
  key: string,
  expectedSize: number,
  expectedSha256: string,
): Promise<number> {
  const storage = getCreatorHubObjectStorage();
  if (!storage) throw new Error('CreatorHub S3 er ikke konfigurert.');
  const head = await headCreatorHubObject(key);
  if (!head || head.sizeBytes !== expectedSize) {
    throw new Error('CreatorHub S3 kunne ikke verifisere filstørrelsen etter opplasting.');
  }
  const object = await storage.client.send(new GetObjectCommand({
    Bucket: storage.bucket,
    Key: key,
  }));
  if (!object.Body) throw new Error('CreatorHub S3 returnerte ingen fil ved checksum-kontroll.');
  const hash = crypto.createHash('sha256');
  for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
    hash.update(chunk);
  }
  if (hash.digest('hex') !== expectedSha256) {
    throw new Error('CreatorHub S3 checksum samsvarer ikke med Lightroom-filen.');
  }
  return head.sizeBytes;
}

async function createLightroomPreview(
  payload: LightroomExportPayload,
): Promise<Buffer> {
  const input = payload.fileBuffer ?? payload.temporaryFilePath;
  if (!input) throw new Error('Lightroom-preview mangler kildefil.');
  return sharp(input, { failOn: 'error', limitInputPixels: 200_000_000 })
    .rotate()
    .resize({ width: 2_048, height: 2_048, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 84, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer();
}

export function buildLightroomMimeType(value: unknown, filename: string): string {
  const lowerName = filename.toLowerCase();
  const expected = lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')
    ? 'image/jpeg'
    : lowerName.endsWith('.png')
      ? 'image/png'
      : lowerName.endsWith('.webp')
        ? 'image/webp'
        : lowerName.endsWith('.gif')
          ? 'image/gif'
          : lowerName.endsWith('.tif') || lowerName.endsWith('.tiff')
            ? 'image/tiff'
            : null;
  if (!expected) {
    throw new Error('Lightroom-formatet støttes ikke. Eksporter som JPEG, TIFF, PNG, WebP eller GIF.');
  }
  const explicit = readString(value);
  if (explicit && explicit.toLowerCase() !== expected) {
    throw new Error('Filendelse og MIME-type for Lightroom-eksporten samsvarer ikke.');
  }
  return expected;
}

async function ensureLightroomSchema(pool: Pool): Promise<void> {
  // Schema is owned by migration 0664. Keep this awaitable boundary so the
  // query helpers remain stable without mutating production schema at runtime.
  void pool;
}

async function listEditableLightroomProjects(
  pool: Pool,
  userId: string,
): Promise<LightroomProjectOption[]> {
  const result = await pool.query<{ id: string; title: string | null; name: string | null }>(
    `SELECT DISTINCT p.id, p.title, p.name, p.updated_at
       FROM projects p
      WHERE p.user_id::text = $1
         OR EXISTS (
           SELECT 1
             FROM project_team_members member
            WHERE member.project_id::text = p.id::text
              AND member.user_id::text = $1
              AND member.status = 'active'
              AND member.deactivated_at IS NULL
              AND member.role <> 'viewer'
              AND (member.permissions->'canRead' IS NULL OR member.permissions @> '{"canRead":true}'::jsonb)
              AND member.permissions @> '{"canEdit":true}'::jsonb
         )
      ORDER BY p.updated_at DESC NULLS LAST
      LIMIT 250`,
    [userId],
  );
  return result.rows.map((project) => ({
    id: project.id,
    title: project.title || project.name || project.id,
  }));
}

export async function findEditableLightroomProject(
  pool: Pool,
  userId: string,
  projectId: string,
): Promise<LightroomProjectOption | null> {
  const result = await pool.query<{ id: string; title: string | null; name: string | null }>(
    `SELECT p.id, p.title, p.name
       FROM projects p
      WHERE p.id::text = $1
        AND (
          p.user_id::text = $2
          OR EXISTS (
            SELECT 1
              FROM project_team_members member
             WHERE member.project_id::text = p.id::text
               AND member.user_id::text = $2
               AND member.status = 'active'
               AND member.deactivated_at IS NULL
               AND member.role <> 'viewer'
               AND (member.permissions->'canRead' IS NULL OR member.permissions @> '{"canRead":true}'::jsonb)
               AND member.permissions @> '{"canEdit":true}'::jsonb
          )
        )
      LIMIT 1`,
    [projectId, userId],
  );
  const project = result.rows[0];
  return project
    ? { id: project.id, title: project.title || project.name || project.id }
    : null;
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
       $1, $2, $3, $4,
       $5, $6, $7, $8, $9,
       $10, $11, $12, $13,
       $14::timestamptz, $15::timestamptz
     )
     ON CONFLICT (user_id) DO UPDATE SET
       plugin_token_hash = COALESCE(EXCLUDED.plugin_token_hash, ${LIGHTROOM_INTEGRATION_TABLE}.plugin_token_hash),
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

async function getUserScopedWorkspaceRecord(
  pool: Pool,
  userId: string,
): Promise<LightroomUserWorkspaceRecord | null> {
  try {
    const result = await pool.query<{
      google_email: string | null;
      scopes: unknown;
      connection_state: string | null;
    }>(
      `SELECT google_email, scopes, connection_state
       FROM creatorhub_google_connections
       WHERE user_id = $1
       ORDER BY CASE WHEN oauth_app = 'creatorhub' THEN 0 WHEN oauth_app = 'role_room' THEN 1 ELSE 2 END,
                last_used_at DESC NULLS LAST,
                updated_at DESC NULLS LAST,
                created_at DESC NULLS LAST
       LIMIT 1`,
      [userId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      googleEmail: readString(row.google_email),
      storedScopes: Array.isArray(row.scopes)
        ? row.scopes.filter((entry): entry is string => typeof entry === 'string')
        : [],
      connectionState: readString(row.connection_state),
    };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === '42P01') {
      return null;
    }
    throw error;
  }
}

async function resolveWorkspaceStatus(pool: Pool, userId: string): Promise<LightroomWorkspaceStatus> {
  const userScopedRecord = await getUserScopedWorkspaceRecord(pool, userId);
  if (!userScopedRecord) {
    return {
      connected: false,
      googleEmail: null,
      storedScopes: [],
      error: 'Google Workspace er ikke koblet til denne brukeren.',
      source: null,
      warning: 'Koble Google Workspace for denne brukeren før Lightroom publiserer til Google Drive.',
    };
  }

  try {
    const connection = await resolveCreatorHubGoogleConnection(pool, userId);
    return {
      connected: true,
      googleEmail: readString(connection.connection.googleEmail),
      storedScopes: Array.isArray(connection.connection.storedScopes)
        ? connection.connection.storedScopes.filter((entry): entry is string => typeof entry === 'string')
        : [],
      error: null,
      source: 'creatorhub_connection',
      warning: null,
    };
  } catch (error) {
    return {
      connected: false,
      googleEmail: userScopedRecord.googleEmail,
      storedScopes: userScopedRecord.storedScopes,
      error: error instanceof Error ? error.message : 'Google Workspace er ikke koblet til.',
      source: 'creatorhub_connection',
      warning: userScopedRecord.connectionState === 'connected'
        ? 'Google Workspace-koblingen finnes, men må fornyes før Lightroom kan bruke Google Drive.'
        : 'Koble Google Workspace på nytt for å aktivere Lightroom-eksport til Google Drive.',
    };
  }
}

async function ensurePluginToken(
  pool: Pool,
  userId: string,
): Promise<{ integration: LightroomIntegrationRow; token: string }> {
  const existing = await getIntegrationByUserId(pool, userId);
  const token = generatePluginToken();

  const nextConfiguration = {
    ...readRecord(existing?.configuration),
    lastPackageGeneratedAt: new Date().toISOString(),
    tokenPreview: buildTokenPreview(token),
  };

  const integration = await upsertIntegrationRecord(pool, {
    userId,
    pluginTokenHash: hashPluginToken(token),
    driveRootFolderId: existing?.drive_root_folder_id ?? null,
    driveRootFolderName: existing?.drive_root_folder_name ?? null,
    driveRootFolderUrl: existing?.drive_root_folder_url ?? null,
    lastSyncAt: existing?.last_sync_at ?? null,
    lastShowcaseItemId: existing?.last_showcase_item_id ?? null,
    lastDriveFileId: existing?.last_drive_file_id ?? null,
    lastError: null,
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

function escapeLuaString(value: string): string {
  return value
    .replace(/\\/gu, '\\\\')
    .replace(/"/gu, '\\"')
    .replace(/[\r\n]/gu, ' ');
}

async function streamPluginPackage(
  req: Request,
  res: Response,
  token: string,
  driveAvailable: boolean,
  projects: Array<{ id: string; title: string }>,
  userEmail: string | null,
): Promise<void> {
  const templates = await loadPluginTemplateFiles();
  const variables = {
    CREATORHUB_API_BASE_URL: resolveLightroomApiBase(req),
    CREATORHUB_PLUGIN_TOKEN: token,
    CREATORHUB_PLUGIN_VERSION: LIGHTROOM_PLUGIN_VERSION,
    CREATORHUB_VERSION_MAJOR: String(LIGHTROOM_PLUGIN_MANIFEST.major),
    CREATORHUB_VERSION_MINOR: String(LIGHTROOM_PLUGIN_MANIFEST.minor),
    CREATORHUB_VERSION_REVISION: String(LIGHTROOM_PLUGIN_MANIFEST.revision),
    CREATORHUB_VERSION_BUILD: String(LIGHTROOM_PLUGIN_MANIFEST.build),
    CREATORHUB_ACCOUNT_EMAIL: escapeLuaString(userEmail || 'Tilkoblet CreatorHub-konto'),
    CREATORHUB_DESK_BROKER_URL: '',
    CREATORHUB_DESK_BROKER_SECRET: '',
    CREATORHUB_PLUGIN_DOWNLOAD_URL: `${resolveLightroomApiBase(req)}/download-plugin`,
    CREATORHUB_DRIVE_AVAILABLE: driveAvailable ? 'true' : 'false',
    CREATORHUB_PROJECTS_LUA: `{${projects.map((project) => {
      const title = project.title.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"').replace(/[\r\n]/gu, ' ');
      const id = project.id.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"');
      return `{ title = "${title}", value = "${id}" }`;
    }).join(',')}}`,
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

/**
 * Streams a user-bound Lightroom Classic package. Browser sessions and trusted
 * CreatorHub desktop clients share this implementation so token rotation,
 * project ownership and Google Drive availability cannot drift between entry
 * points.
 */
export async function streamLightroomPluginPackageForUser(
  pool: Pool,
  req: Request,
  res: Response,
  userId: string,
  userEmail: string | null,
  options: { deskBrokerOnly?: boolean } = {},
): Promise<void> {
  const token = options.deskBrokerOnly
    ? ''
    : (await ensurePluginToken(pool, userId)).token;
  if (options.deskBrokerOnly && !(await getIntegrationByUserId(pool, userId))) {
    await upsertIntegrationRecord(pool, {
      userId,
      syncStatus: 'idle',
      configuration: { authenticationMode: 'creatorhub_desk_sso' },
    });
  }
  const workspace = await resolveWorkspaceStatus(pool, userId);
  const projects = await listEditableLightroomProjects(pool, userId);
  await streamPluginPackage(
    req,
    res,
    token,
    workspace.connected,
    projects,
    userEmail,
  );
}

export async function createLightroomDesktopSession(
  pool: Pool,
  req: Request,
  params: { userId: string; userEmail: string; deviceId: string },
): Promise<{
  token: string;
  expiresAt: string;
  apiBaseUrl: string;
  accountEmail: string;
  pluginVersion: string;
  driveAvailable: boolean;
  projects: LightroomProjectOption[];
  projectOptions: string;
  latestExport: LightroomLatestExport | null;
}> {
  const existing = await getIntegrationByUserId(pool, params.userId);
  if (!existing) {
    await upsertIntegrationRecord(pool, {
      userId: params.userId,
      syncStatus: 'idle',
      configuration: { authenticationMode: 'creatorhub_desk_sso' },
    });
  }
  const issued = issueLightroomDeskSsoToken(params.userId, params.deviceId);
  const [workspace, projects, latestExportResult] = await Promise.all([
    resolveWorkspaceStatus(pool, params.userId),
    listEditableLightroomProjects(pool, params.userId),
    pool.query<{
      id: string;
      project_id: string;
      project_title: string;
      asset_id: string;
      filename: string;
      status: string;
      verified_at: string | Date | null;
      created_at: string | Date | null;
    }>(
      `SELECT e.id, e.project_id, COALESCE(p.title, p.name, p.id::text) AS project_title,
              e.asset_id, e.filename, e.status, e.verified_at, e.created_at
         FROM lightroom_classic_exports e
         JOIN projects p ON p.id = e.project_id
        WHERE e.user_id = $1
        ORDER BY e.created_at DESC
        LIMIT 1`,
      [params.userId],
    ),
  ]);
  const latest = latestExportResult.rows[0];
  return {
    ...issued,
    apiBaseUrl: resolveLightroomApiBase(req),
    accountEmail: params.userEmail,
    pluginVersion: LIGHTROOM_PLUGIN_VERSION,
    driveAvailable: workspace.connected,
    projects,
    projectOptions: projects
      .map((project) => `${encodeURIComponent(project.id)}=${encodeURIComponent(project.title)}`)
      .join('&'),
    latestExport: latest ? {
      exportId: latest.id,
      projectId: latest.project_id,
      projectTitle: latest.project_title,
      assetId: latest.asset_id,
      filename: latest.filename,
      status: latest.status,
      verifiedAt: readDateTimeValue(latest.verified_at),
      createdAt: readDateTimeValue(latest.created_at),
    } : null,
  };
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

async function performLightroomExport(
  pool: Pool,
  integration: LightroomIntegrationRow,
  payload: LightroomExportPayload,
): Promise<LightroomExportResult> {
  const integrationUserId = readString(integration.user_id);
  if (!integrationUserId) {
    throw new Error('Lightroom-integrasjonen mangler bruker-id.');
  }

  if (!payload.projectId) {
    throw new Error('Velg et CreatorHub-prosjekt i Lightroom før eksport.');
  }

  const writableProject = await findEditableLightroomProject(
    pool,
    integrationUserId,
    payload.projectId,
  );
  if (!writableProject) {
    throw new Error('Prosjektet finnes ikke, eller du mangler skriverett i prosjektets workspace.');
  }
  payload.projectName = writableProject.title;

  const checksumSha256 = await checksumLightroomPayload(payload);
  const duplicate = await pool.query<{
    id: string;
    asset_id: string;
    capture_session_id: string;
    object_key: string;
    size_bytes: string | number;
    drive_file_id: string | null;
    drive_folder_id: string | null;
    drive_folder_name: string | null;
    drive_web_view_link: string | null;
    status: 'uploading' | 'verified' | 'error' | 'unpublished';
    updated_at: string | Date;
  }>(
    `SELECT id, asset_id, capture_session_id, object_key, size_bytes, drive_file_id, drive_folder_id,
            drive_folder_name, drive_web_view_link, status, updated_at
       FROM lightroom_classic_exports
      WHERE user_id = $1 AND project_id = $2 AND checksum_sha256 = $3
        AND filename = $4
      ORDER BY created_at DESC
      LIMIT 1`,
    [integrationUserId, payload.projectId, checksumSha256, payload.filename],
  );

  let exportId = duplicate.rows[0]?.id ?? crypto.randomUUID();
  let assetId = duplicate.rows[0]?.asset_id ?? crypto.randomUUID();
  let sessionId = duplicate.rows[0]?.capture_session_id ?? '';
  let objectKey = duplicate.rows[0]?.object_key ?? '';
  let sizeBytes = Number(duplicate.rows[0]?.size_bytes ?? payload.sizeBytes);
  const duplicateUpdatedAt = duplicate.rows[0]?.updated_at
    ? new Date(duplicate.rows[0].updated_at).getTime()
    : 0;
  const staleUpload = duplicate.rows[0]?.status === 'uploading'
    && (!Number.isFinite(duplicateUpdatedAt) || Date.now() - duplicateUpdatedAt > 30 * 60 * 1000);
  if (duplicate.rows[0]?.status === 'uploading' && !staleUpload) {
    throw new Error('Den samme Lightroom-filen lastes allerede opp. Prøv igjen om et øyeblikk.');
  }
  const shouldUpload = !duplicate.rows[0] || duplicate.rows[0].status === 'error' || staleUpload;

  if (!duplicate.rows[0]) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `lightroom:${integrationUserId}:${payload.projectId}`,
      ]);
      const existingSession = await client.query<{ id: string }>(
        `SELECT id FROM capture_sessions
          WHERE owner_user_id = $1 AND project_id = $2
            AND name = 'Lightroom Classic Imports' AND status = 'active'
          ORDER BY created_at DESC LIMIT 1`,
        [integrationUserId, payload.projectId],
      );
      sessionId = existingSession.rows[0]?.id ?? crypto.randomUUID();
      if (!existingSession.rows[0]) {
        await client.query(
          `INSERT INTO capture_sessions(id, owner_user_id, name, project_id, starts_at, status, created_at, updated_at)
           VALUES ($1, $2, 'Lightroom Classic Imports', $3, NOW(), 'active', NOW(), NOW())`,
          [sessionId, integrationUserId, payload.projectId],
        );
      }

      objectKey = buildPhotoRoomCaptureKey({
        userId: integrationUserId,
        projectId: payload.projectId,
        sessionId,
        assetId,
        kind: 'full',
        fileName: payload.filename,
      });
      await client.query(
        `INSERT INTO capture_assets(
           id, session_id, original_filename, capture_time, mime, size_bytes,
           checksum_sha256, state, rating, signals, created_at, updated_at
         ) VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), $5, $6, $7,
                   'uploading', $8, $9::jsonb, NOW(), NOW())`,
        [
          assetId,
          sessionId,
          payload.filename,
          payload.captureDate,
          payload.mimeType,
          payload.sizeBytes,
          checksumSha256,
          payload.rating ?? 0,
          JSON.stringify({
            lightroom: {
              source: 'lightroom_classic',
              title: payload.title,
              collectionName: payload.collectionName,
              keywords: payload.keywords,
              metadata: payload.metadata,
            },
          }),
        ],
      );
      await client.query(
        `INSERT INTO lightroom_classic_exports(
           id, user_id, project_id, capture_session_id, asset_id, filename,
           mime_type, object_key, size_bytes, checksum_sha256, status,
           mirror_to_drive, metadata, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'uploading',$11,$12::jsonb,NOW(),NOW())`,
        [
          exportId,
          integrationUserId,
          payload.projectId,
          sessionId,
          assetId,
          payload.filename,
          payload.mimeType,
          objectKey,
          payload.sizeBytes,
          checksumSha256,
          payload.mirrorToDrive,
          JSON.stringify(payload.metadata),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  if (duplicate.rows[0]?.status === 'error' || staleUpload) {
    await pool.query(
      `UPDATE lightroom_classic_exports
          SET status='uploading', mirror_to_drive=$2, last_error=NULL,
              drive_last_error=NULL, updated_at=NOW()
        WHERE id=$1`,
      [exportId, payload.mirrorToDrive],
    );
    await pool.query(
      `UPDATE capture_assets SET state='uploading', updated_at=NOW() WHERE id=$1`,
      [assetId],
    );
  }
  if (duplicate.rows[0]?.status === 'unpublished') {
    await pool.query(
      `UPDATE lightroom_classic_exports
          SET status='verified', unpublished_at=NULL, updated_at=NOW()
        WHERE id=$1`,
      [exportId],
    );
  }

  if (shouldUpload) {
    try {
      const objectMetadata = {
        ownerUserId: integrationUserId,
        projectId: payload.projectId,
        assetId,
        source: 'lightroom-classic',
        sha256: checksumSha256,
      };
      let stored = false;
      if (payload.fileBuffer) {
        stored = await putCreatorHubObject(
          objectKey,
          payload.fileBuffer,
          payload.mimeType,
          objectMetadata,
        );
      } else {
        const storage = getCreatorHubObjectStorage();
        if (storage) {
          await new Upload({
            client: storage.client,
            params: {
              Bucket: storage.bucket,
              Key: objectKey,
              Body: lightroomPayloadBody(payload),
              ContentType: payload.mimeType,
              ContentLength: payload.sizeBytes,
              Metadata: objectMetadata,
            },
            queueSize: 2,
            partSize: 8 * 1024 * 1024,
            leavePartsOnError: false,
          }).done();
          stored = true;
        }
      }
      if (!stored) {
        throw new Error('CreatorHub S3 er ikke konfigurert. Ingen fil ble lagret.');
      }
      sizeBytes = await verifyCreatorHubLightroomObject(
        objectKey,
        payload.sizeBytes,
        checksumSha256,
      );
      const previewBuffer = await createLightroomPreview(payload);
      const previewKey = buildPhotoRoomCaptureKey({
        userId: integrationUserId,
        projectId: payload.projectId,
        sessionId,
        assetId,
        kind: 'preview',
        fileName: 'preview.jpg',
      });
      const previewStored = await putCreatorHubObject(
        previewKey,
        previewBuffer,
        'image/jpeg',
        {
          ownerUserId: integrationUserId,
          projectId: payload.projectId,
          assetId,
          source: 'lightroom-classic-preview',
        },
      );
      if (!previewStored) {
        throw new Error('CreatorHub S3 kunne ikke lagre Lightroom-preview.');
      }
      await pool.query(
        `UPDATE capture_assets
            SET full_key=$2, preview_key=$3, size_bytes=$4, checksum_sha256=$5,
                state='uploaded', updated_at=NOW()
          WHERE id=$1`,
        [assetId, objectKey, previewKey, sizeBytes, checksumSha256],
      );
      await pool.query(
        `UPDATE lightroom_classic_exports
            SET status='verified', verified_at=NOW(), size_bytes=$2, updated_at=NOW(), last_error=NULL
          WHERE id=$1`,
        [exportId, sizeBytes],
      );
    } catch (error) {
      await pool.query(
        `UPDATE lightroom_classic_exports SET status='error', last_error=$2, updated_at=NOW() WHERE id=$1`,
        [exportId, error instanceof Error ? error.message : 'CreatorHub S3-opplasting feilet.'],
      ).catch(() => undefined);
      await pool.query(
        `UPDATE capture_assets SET state='upload_failed', updated_at=NOW() WHERE id=$1`,
        [assetId],
      ).catch(() => undefined);
      await deleteCreatorHubObject(objectKey).catch(() => undefined);
      if (sessionId) {
        const failedPreviewKey = buildPhotoRoomCaptureKey({
          userId: integrationUserId,
          projectId: payload.projectId,
          sessionId,
          assetId,
          kind: 'preview',
          fileName: 'preview.jpg',
        });
        await deleteCreatorHubObject(failedPreviewKey).catch(() => undefined);
      }
      throw error;
    }
  }

  let driveFileId = duplicate.rows[0]?.drive_file_id ?? null;
  let driveFolderId = duplicate.rows[0]?.drive_folder_id ?? null;
  let driveFolderName = duplicate.rows[0]?.drive_folder_name ?? null;
  let driveRootFolderId: string | null = null;
  let driveRootFolderName: string | null = null;
  let driveRootFolderUrl: string | null = null;
  let driveWebViewLink = duplicate.rows[0]?.drive_web_view_link ?? null;
  let driveWebContentLink: string | null = null;
  let driveMirrorError: string | null = null;

  if (payload.mirrorToDrive && !driveFileId) {
    try {
      const googleConnection = await resolveCreatorHubGoogleConnection(pool, integrationUserId);
      const driveApi = google.drive({ version: 'v3', auth: googleConnection.oauthClient });
      const destination = await ensureLightroomDriveDestination(pool, driveApi, integrationUserId, payload);
      const created = await driveApi.files.create({
        requestBody: {
          name: sanitizeFolderName(payload.filename) || `Lightroom Export ${Date.now()}.jpg`,
          parents: [destination.destinationFolder.id],
          description: ['CreatorHub Lightroom Classic mirror', payload.projectName, payload.collectionName]
            .filter(Boolean).join(' • '),
          appProperties: {
            creatorhubSource: 'lightroom-classic',
            creatorhubAssetId: assetId,
            creatorhubProjectId: payload.projectId,
            creatorhubChecksumSha256: checksumSha256,
          },
        },
        media: { mimeType: payload.mimeType, body: lightroomPayloadBody(payload) },
        supportsAllDrives: true,
        fields: 'id,name,webViewLink,webContentLink,mimeType',
      });
      driveFileId = readString(created.data.id);
      if (!driveFileId) throw new Error('Google Drive returnerte ikke en fil-ID.');
      driveFolderId = destination.destinationFolder.id;
      driveFolderName = destination.destinationFolder.name;
      driveRootFolderId = destination.rootFolder.id;
      driveRootFolderName = destination.rootFolder.name;
      driveRootFolderUrl = destination.rootFolder.webViewLink;
      driveWebViewLink = readString(created.data.webViewLink);
      driveWebContentLink = readString(created.data.webContentLink);
      await pool.query(
        `UPDATE lightroom_classic_exports
            SET drive_file_id=$2, drive_folder_id=$3, drive_folder_name=$4,
                drive_web_view_link=$5, drive_mirrored_at=NOW(), updated_at=NOW()
          WHERE id=$1`,
        [exportId, driveFileId, driveFolderId, driveFolderName, driveWebViewLink],
      );
    } catch (error) {
      driveMirrorError = error instanceof Error ? error.message : 'Google Drive-speiling feilet.';
      await pool.query(
        `UPDATE lightroom_classic_exports SET drive_last_error=$2, updated_at=NOW() WHERE id=$1`,
        [exportId, driveMirrorError],
      ).catch(() => undefined);
    }
  }

  const lastSyncAt = new Date().toISOString();
  await upsertIntegrationRecord(pool, {
    userId: integrationUserId,
    pluginTokenHash: integration.plugin_token_hash,
    driveRootFolderId,
    driveRootFolderName,
    driveRootFolderUrl,
    lastSyncAt,
    lastShowcaseItemId: null,
    lastDriveFileId: driveFileId,
    lastError: null,
    syncStatus: driveMirrorError ? 'synced_drive_warning' : 'synced',
    configuration: {
      ...readRecord(integration.configuration),
      lastAssetId: assetId,
      lastObjectKey: objectKey,
      lastChecksumSha256: checksumSha256,
      lastProjectId: payload.projectId,
      lastProjectName: payload.projectName,
      lastCollectionName: payload.collectionName,
      storageProvider: 'creatorhub_s3',
      driveMirrorRequested: payload.mirrorToDrive,
    },
  });
  await logLightroomRun(pool, {
    userId: integrationUserId,
    exportId,
    status: 'success',
    driveFileId,
    showcaseItemId: null,
    metadata: {
      title: payload.title,
      category: payload.category,
      collectionName: payload.collectionName,
      projectId: payload.projectId,
      assetId,
      objectKey,
      checksumSha256,
      storageProvider: 'creatorhub_s3',
      driveMirrored: Boolean(driveFileId),
      driveMirrorError,
    },
  });

  return {
    success: true,
    exportId,
    assetId,
    objectKey,
    checksumSha256,
    sizeBytes,
    storageProvider: 'creatorhub_s3',
    driveMirrored: Boolean(driveFileId),
    driveMirrorError,
    showcaseItemId: null,
    driveFileId,
    driveFolderId,
    driveFolderName,
    driveRootFolderId,
    driveRootFolderName,
    driveRootFolderUrl,
    driveWebViewLink,
    driveWebContentLink,
    imageUrl: null,
    thumbnailUrl: null,
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
  const directBuffer = Buffer.isBuffer(body.fileBuffer) ? body.fileBuffer : null;
  const fileBuffer = directBuffer
    ?? decodeBase64FilePayload(body.fileDataBase64 ?? body.fileData ?? body.base64Data);
  const temporaryFilePath = readString(body.temporaryFilePath);
  const sizeBytes = fileBuffer?.length ?? readNumber(body.sizeBytes) ?? 0;
  if ((!fileBuffer && !temporaryFilePath) || sizeBytes <= 0) {
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
    mimeType: buildLightroomMimeType(body.mimeType, filename),
    fileBuffer,
    temporaryFilePath,
    sizeBytes,
    keywords: normalizeKeywords(body.keywords),
    rating: readNumber(body.rating),
    captureDate: readString(body.captureDate) || readString(body.capturedAt),
    metadata: readRecord(body.metadata),
    mirrorToDrive: readBoolean(body.mirrorToDrive ?? body.copyToGoogleDrive, false),
  };
}

async function handlePluginExport(
  pool: Pool,
  req: Request,
  res: Response,
): Promise<void> {
  let payload = req.body && typeof req.body === 'object'
    ? (req.body as Record<string, unknown>)
    : {};
  const temporaryPath = req.file?.path ?? null;
  if (temporaryPath) {
    const metadataRaw = readString(payload.metadataJson ?? payload.metadata);
    const metadataPayload = metadataRaw ? readRecord(metadataRaw) : {};
    payload = {
      ...payload,
      ...metadataPayload,
      filename: readString(payload.filename) || req.file?.originalname,
      mimeType: readString(payload.mimeType) || req.file?.mimetype,
      temporaryFilePath: temporaryPath,
      sizeBytes: req.file?.size,
    };
  }
  const pluginToken = resolvePluginToken(req, payload);
  if (!pluginToken) {
    if (temporaryPath) await fs.unlink(temporaryPath).catch(() => undefined);
    res.status(401).json({ error: 'Lightroom-plugin-token mangler.' });
    return;
  }

  const integration = (req as LightroomPluginRequest).lightroomIntegration
    ?? await getIntegrationByPluginToken(pool, pluginToken);
  if (!integration) {
    if (temporaryPath) await fs.unlink(temporaryPath).catch(() => undefined);
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
  } finally {
    if (temporaryPath) await fs.unlink(temporaryPath).catch(() => undefined);
  }
}

export function createLightroomRouter(
  pool: Pool,
  activeSessions?: ReadonlyMap<string, LightroomSession>,
): Router {
  const router = Router();
  const requireSession = requireLightroomSession(pool, activeSessions);
  const requirePluginToken = requireLightroomPluginToken(pool);

  router.get('/status', requireSession, async (req, res) => {
    try {
      const userId = authenticatedUserId(req);

      const integration = await getIntegrationByUserId(pool, userId);
      const workspace = await resolveWorkspaceStatus(pool, userId);
      const recentRuns = await getRecentRuns(pool, userId);

      res.json({
        connected: Boolean(integration),
        pluginVersion: readString(integration?.plugin_version) || LIGHTROOM_PLUGIN_VERSION,
        tokenPreview: readString(readRecord(integration?.configuration).tokenPreview),
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

  router.post('/token', requireSession, async (req, res) => {
    try {
      const userId = authenticatedUserId(req);
      const { integration, token } = await ensurePluginToken(pool, userId);
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

  router.get('/download-plugin', requireSession, async (req, res) => {
    try {
      const userId = authenticatedUserId(req);
      await streamLightroomPluginPackageForUser(
        pool,
        req,
        res,
        userId,
        authenticatedUserEmail(req),
      );
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Kunne ikke generere Lightroom-pluginpakken.',
      });
    }
  });

  router.post('/smoke-export', requireSession, async (req, res) => {
    const body = req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : {};
    const userId = authenticatedUserId(req);
    const userEmail = authenticatedUserEmail(req);

    try {
      const integration = await getIntegrationByUserId(pool, userId)
        ?? await upsertIntegrationRecord(pool, {
          userId,
          syncStatus: 'idle',
          configuration: { storageProvider: 'creatorhub_s3' },
        });
      const requestedProjectId = readString(body.projectId);
      const smokeProject = requestedProjectId
        ? await pool.query<{ id: string; title: string | null; name: string | null }>(
            `SELECT id, title, name FROM projects WHERE id=$1 AND user_id=$2 LIMIT 1`,
            [requestedProjectId, userId],
          )
        : await pool.query<{ id: string; title: string | null; name: string | null }>(
            `SELECT id, title, name FROM projects WHERE user_id=$1 ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
            [userId],
          );
      if (!smokeProject.rows[0]) {
        res.status(409).json({ error: 'Opprett et CreatorHub-prosjekt før Lightroom smoke-test kjøres.' });
        return;
      }
      const smokePayload = normalizeExportPayload({
        filename: 'creatorhub-lightroom-smoke-test.png',
        title: 'CreatorHub Lightroom Smoke Test',
        caption: 'Ende-til-ende-test av Lightroom, Google Drive og showcase.',
        collectionName: 'CreatorHub Smoke Test',
        category: 'CreatorHub Smoke Test',
        projectName: readString(body.projectName)
          || smokeProject.rows[0].title
          || smokeProject.rows[0].name
          || 'Lightroom Smoke Test',
        projectId: smokeProject.rows[0].id,
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
        mirrorToDrive: readBoolean(body.mirrorToDrive, false),
      });
      const result = await performLightroomExport(pool, integration, smokePayload);
      res.status(201).json(result);
    } catch (error) {
      if (userId) {
        const existing = await getIntegrationByUserId(pool, userId);
        await upsertIntegrationRecord(pool, {
          userId,
          pluginTokenHash: existing?.plugin_token_hash ?? null,
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

  router.post(
    '/plugin/unpublish-photos',
    requirePluginToken,
    lightroomMultipartUpload.none(),
    async (req, res) => {
      const integration = (req as LightroomPluginRequest).lightroomIntegration;
      const userId = readString(integration?.user_id);
      const rawAssetIds = readString((req.body as Record<string, unknown> | undefined)?.assetIds);
      const assetIds = [...new Set((rawAssetIds || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(entry))
        .slice(0, 500))];
      if (!userId || assetIds.length === 0) {
        res.status(400).json({ error: 'Gyldige CreatorHub asset-id-er mangler.' });
        return;
      }
      try {
        const result = await pool.query<{ asset_id: string }>(
          `WITH requested AS (
             SELECT DISTINCT unnest($2::uuid[]) AS asset_id
           ), authorized AS (
             SELECT e.asset_id
               FROM lightroom_classic_exports e
               JOIN requested r ON r.asset_id = e.asset_id
              WHERE e.user_id=$1 AND e.status IN ('verified', 'unpublished')
           ), updated AS (
             UPDATE lightroom_classic_exports e
                SET status='unpublished', unpublished_at=NOW(), updated_at=NOW()
              WHERE e.user_id=$1
                AND e.asset_id IN (SELECT asset_id FROM authorized)
                AND (SELECT COUNT(*) FROM requested) = (SELECT COUNT(*) FROM authorized)
            RETURNING e.asset_id
           )
           SELECT asset_id FROM updated`,
          [userId, assetIds],
        );
        if (result.rows.length !== assetIds.length) {
          res.status(409).json({
            error: 'Ett eller flere bilder tilhører ikke denne CreatorHub-kontoen.',
          });
          return;
        }
        res.json({ success: true, unpublishedAssetIds: result.rows.map((row) => row.asset_id) });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Kunne ikke oppdatere Publish Service.',
        });
      }
    },
  );

  router.post(
    '/plugin/export-photo',
    requirePluginToken,
    lightroomMultipartUpload.single('file'),
    async (req, res) => {
    await handlePluginExport(pool, req, res);
    },
  );

  router.post('/export-photo', requirePluginToken, async (req, res) => {
    await handlePluginExport(pool, req, res);
  });

  return router;
}
