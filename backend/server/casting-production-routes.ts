/**
 * casting-production-routes.ts — mountes under /api/role-room.
 *
 * Ekte REST-API for casting_props og casting_production_days. Erstatter den tidligere
 * tilstanden der disse kjerne-OS-funksjonene kun ble lagret i prosjekt-bloben (de
 * dedikerte frontend-API-klientene var dødkode, ingen backend-endepunkter fantes).
 *
 *   • GET    /projects/:projectId/props            → { props: [...] }
 *   • POST   /props                                 → { prop }
 *   • DELETE /props/:propId
 *   • GET    /projects/:projectId/production-days   → { productionDays: [...] }
 *   • POST   /production-days                       → { productionDay }
 *   • PATCH  /projects/:projectId/production-days/:dayId/production-management
 *   • PATCH  /projects/:projectId/production-days/:dayId/production-coordination
 *   • PATCH  /projects/:projectId/production-days/:dayId/continuity
 *   • POST   /projects/:projectId/production-days/:dayId/continuity/comments
 *   • POST   /projects/:projectId/production-days/:dayId/continuity/media
 *   • GET    /projects/:projectId/production-days/:dayId/continuity/media/:fileId/url
 *   • DELETE /production-days/:dayId
 *
 * Schema er smalere enn frontend-modellene, så en `data JSONB`-kolonne lagrer hele
 * modell-objektet tapsfritt; typede kolonner (name, date, status …) holdes i synk for
 * spørrbarhet og for å matche GET /projects-aggregeringen.
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from 'express';
import type { Pool } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { unlink } from 'node:fs/promises';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { loadPersistedAuthSession } from './auth-session-store.js';
import {
  collectProductionDayChangeImpact,
  collectProductionDayLocationImpact,
  collectProductionDayEquipmentImpact,
  collectProductionDayPropImpact,
  collectProductionDaySceneImpact,
  hasBlockingImpact,
} from './production-day-change-impact.js';
import { syncProductionDayEquipmentBookings } from './production-day-equipment-bookings.js';
import {
  resolveCastingProjectAccess,
  userOwnsCastingProject,
  type CastingGrant,
} from './casting-project-ownership.js';
import {
  continuityObject,
  normalizeContinuityComment,
  normalizeProductionContinuityOperations,
  ProductionContinuityValidationError,
  readContinuityActivity,
  readContinuityComments,
  readContinuityRevisions,
  summarizeContinuityChanges,
} from './casting-production-continuity.js';
import {
  CONTINUITY_MEDIA_MAX_VIDEO_BYTES,
  CONTINUITY_MEDIA_MIME_TYPES,
  inspectContinuityMediaFile,
  ProductionContinuityMediaValidationError,
} from './casting-production-continuity-media.js';
import {
  getContinuityMediaS3DownloadUrl,
  uploadContinuityMediaToS3,
} from './casting-production-continuity-s3.js';
import {
  getLocationScoutMediaDownloadUrl,
  listLocationScoutMedia,
  uploadLocationScoutMediaToS3,
  type LocationScoutCaptureMetadata,
} from './casting-production-location-s3.js';
import {
  inspectLocationScoutMediaFile,
  LOCATION_SCOUT_MEDIA_MAX_VIDEO_BYTES,
  LOCATION_SCOUT_MEDIA_MIME_TYPES,
  LocationScoutMediaValidationError,
  type LocationScoutMediaKind,
} from './casting-production-location-media.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}
type AuthedRequest = Request & { userId: string };
type ContinuityMediaRequest = AuthedRequest & { file?: Express.Multer.File };
type LocationScoutMediaRequest = AuthedRequest & { file?: Express.Multer.File };

const continuityMediaUpload = multer({
  storage: multer.diskStorage({
    destination: tmpdir(),
    filename: (_req, _file, callback) => callback(
      null,
      `role-room-continuity-${Date.now()}-${randomBytes(8).toString('hex')}.upload`,
    ),
  }),
  limits: {
    fileSize: CONTINUITY_MEDIA_MAX_VIDEO_BYTES,
    files: 1,
    fields: 8,
    fieldSize: 2_048,
  },
  fileFilter: (_req, file, callback) => {
    if (CONTINUITY_MEDIA_MIME_TYPES.has(file.mimetype)) callback(null, true);
    else callback(new ProductionContinuityMediaValidationError('Filtypen er ikke tillatt.'));
  },
});

function receiveContinuityMedia(req: Request, res: Response, next: NextFunction): void {
  continuityMediaUpload.single('file')(req, res, (error: unknown) => {
    if (!error) { next(); return; }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'file_too_large', message: 'Filen kan ikke være større enn 250 MB.' });
      return;
    }
    res.status(415).json({
      error: 'unsupported_media',
      message: error instanceof Error ? error.message : 'Filtypen er ikke tillatt.',
    });
  });
}

const locationScoutMediaUpload = multer({
  storage: multer.diskStorage({
    destination: tmpdir(),
    filename: (_req, _file, callback) => callback(
      null,
      `role-room-location-scout-${Date.now()}-${randomBytes(8).toString('hex')}.upload`,
    ),
  }),
  limits: { fileSize: LOCATION_SCOUT_MEDIA_MAX_VIDEO_BYTES, files: 1, fields: 8, fieldSize: 8_192 },
  fileFilter: (_req, file, callback) => {
    if (LOCATION_SCOUT_MEDIA_MIME_TYPES.has(file.mimetype)) callback(null, true);
    else callback(new LocationScoutMediaValidationError('Filtypen er ikke tillatt i Scout Capture.'));
  },
});

function receiveLocationScoutMedia(req: Request, res: Response, next: NextFunction): void {
  locationScoutMediaUpload.single('file')(req, res, (error: unknown) => {
    if (!error) { next(); return; }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'file_too_large', message: 'Scout-filer kan ikke være større enn 250 MB.' });
      return;
    }
    res.status(415).json({
      error: 'unsupported_media',
      message: error instanceof Error ? error.message : 'Filtypen er ikke tillatt.',
    });
  });
}

const locationScoutMediaUploadLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).userId || 'unauthenticated',
  handler: (_req, res) => res.status(429).json({
    error: 'rate_limited',
    message: 'For mange scout-opplastinger på kort tid. Vent litt og prøv igjen.',
  }),
});

const locationDecisionActionLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).userId || 'unauthenticated',
  handler: (_req, res) => res.status(429).json({
    error: 'rate_limited',
    message: 'For mange beslutningshandlinger på kort tid. Vent litt og prøv igjen.',
  }),
});

async function resolveUser(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  bearer: string | null | undefined,
): Promise<SessionData | null> {
  const token = typeof bearer === 'string' ? bearer.trim() : '';
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) { activeSessions?.set(token, persisted); return persisted; }
  return null;
}

function requireAuth(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    const session = await resolveUser(pool, activeSessions, bearer);
    if (!session?.userId) { res.status(401).json({ error: 'unauthorized' }); return; }
    (req as AuthedRequest).userId = session.userId;
    next();
  };
}

// ── Schema: legg til data-kolonne (idempotent) ──
let schemaReadyPromise: Promise<void> | null = null;
async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`ALTER TABLE casting_props ADD COLUMN IF NOT EXISTS data JSONB`);
  await pool.query(`ALTER TABLE casting_production_days ADD COLUMN IF NOT EXISTS data JSONB`);
  await pool.query(`ALTER TABLE casting_production_days
    ADD COLUMN IF NOT EXISTS management_version INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS management_updated_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS management_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS coordination_version INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS coordination_updated_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS coordination_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS continuity_version INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS continuity_updated_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS continuity_updated_at TIMESTAMPTZ`);
  await pool.query(`CREATE TABLE IF NOT EXISTS role_room_location_operations (
    id VARCHAR(255) PRIMARY KEY NOT NULL,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    location_id VARCHAR(255) NOT NULL REFERENCES casting_locations(id) ON DELETE CASCADE,
    operations JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 0,
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS role_room_location_operations_project_location_uidx
    ON role_room_location_operations(project_id, location_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS role_room_location_operations_project_updated_idx
    ON role_room_location_operations(project_id, updated_at DESC)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS casting_location_scout_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    location_id VARCHAR(255) NOT NULL REFERENCES casting_locations(id) ON DELETE CASCADE,
    uploaded_by VARCHAR(255),
    client_upload_id UUID,
    media_kind VARCHAR(20) NOT NULL DEFAULT 'photo'
      CONSTRAINT chk_casting_location_scout_media_kind CHECK (media_kind IN ('photo', 'video', 'audio', 'panorama')),
    capture_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    storage_provider VARCHAR(20) NOT NULL DEFAULT 'aws_s3'
      CONSTRAINT chk_casting_location_scout_media_provider CHECK (storage_provider = 'aws_s3'),
    bucket_name TEXT NOT NULL,
    object_key TEXT NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL
      CONSTRAINT chk_casting_location_scout_media_size CHECK (size_bytes > 0 AND size_bytes <= 262144000),
    content_type VARCHAR(120) NOT NULL
      CONSTRAINT chk_casting_location_scout_media_type CHECK (
        content_type IN (
          'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif',
          'video/mp4', 'video/quicktime', 'video/webm',
          'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'
        )
      ),
    checksum_sha256 CHAR(64) NOT NULL
      CONSTRAINT chk_casting_location_scout_media_checksum CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_casting_location_scout_media_s3_contract CHECK (
      bucket_name = 'the-role-room-prod-745600963362-eu-north-1'
      AND object_key LIKE 'organizations/%'
    ),
    UNIQUE (storage_provider, object_key)
  )`);
  await pool.query(`ALTER TABLE casting_location_scout_media
    ADD COLUMN IF NOT EXISTS client_upload_id UUID,
    ADD COLUMN IF NOT EXISTS media_kind VARCHAR(20) NOT NULL DEFAULT 'photo',
    ADD COLUMN IF NOT EXISTS capture_metadata JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_casting_location_scout_media_active
    ON casting_location_scout_media(project_id, location_id, created_at DESC)
    WHERE deleted_at IS NULL`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_casting_location_scout_media_client_upload
    ON casting_location_scout_media(project_id, location_id, client_upload_id)
    WHERE client_upload_id IS NOT NULL`);
}
function schemaReady(pool: Pool): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureSchema(pool).catch((err) => { schemaReadyPromise = null; throw err; });
  }
  return schemaReadyPromise;
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && value) return value.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

// Slår sammen typede kolonner (autoritative) med det rike `data`-objektet (overstyrer rike felt).
function mapPropRow(row: Record<string, any>) {
  const base = {
    id: row.id,
    projectId: row.project_id,
    project_id: row.project_id,
    name: row.name,
    category: row.category ?? undefined,
    description: row.description ?? undefined,
    images: row.images ?? [],
    availability: row.availability ?? undefined,
    quantity: row.quantity ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return {
    ...base,
    ...(row.data && typeof row.data === 'object' ? row.data : {}),
    id: row.id,
    projectId: row.project_id,
    project_id: row.project_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Optimistic-concurrency lanes on the production surface.
 *
 * Every lane already keeps its own monotonic version, actor and timestamp, but
 * each 409 named them differently and wrapped the current state under its own
 * key — so a client had to know which lane it was talking to before it could
 * read the conflict. The lane table below is the one place that mapping lives.
 */
const CONFLICT_LANES = {
  location_operations: {
    payloadKey: 'locationOperation',
    versionField: 'version',
    updatedByField: 'updatedBy',
    updatedAtField: 'updatedAt',
  },
  production_management: {
    payloadKey: 'productionDay',
    versionField: 'managementVersion',
    updatedByField: 'managementUpdatedBy',
    updatedAtField: 'managementUpdatedAt',
  },
  production_coordination: {
    payloadKey: 'productionDay',
    versionField: 'coordinationVersion',
    updatedByField: 'coordinationUpdatedBy',
    updatedAtField: 'coordinationUpdatedAt',
  },
  continuity: {
    payloadKey: 'productionDay',
    versionField: 'continuityVersion',
    updatedByField: 'continuityUpdatedBy',
    updatedAtField: 'continuityUpdatedAt',
  },
} as const satisfies Record<string, {
  payloadKey: string;
  versionField: string;
  updatedByField: string;
  updatedAtField: string;
}>;

type ConflictLane = keyof typeof CONFLICT_LANES;

/**
 * Answer a lost optimistic-concurrency race the same way in every lane.
 *
 * `conflict` is the uniform part a client can read without knowing the lane:
 * which lane lost, the version it must resend, and who moved it last. The
 * lane's own key still carries the full current state, so existing callers
 * keep working.
 */
function sendVersionConflict(
  res: Response,
  lane: ConflictLane,
  message: string,
  current: Record<string, unknown> | undefined,
): void {
  const spec = CONFLICT_LANES[lane];
  const version = current ? Number(current[spec.versionField] ?? 0) : undefined;
  res.status(409).json({
    error: 'version_conflict',
    message,
    conflict: {
      lane,
      currentVersion: Number.isFinite(version) ? version : undefined,
      updatedBy: current?.[spec.updatedByField] ?? undefined,
      updatedAt: current?.[spec.updatedAtField] ?? undefined,
    },
    [spec.payloadKey]: current,
  });
}

function mapDayRow(row: Record<string, any>) {
  const base = {
    id: row.id,
    projectId: row.project_id,
    project_id: row.project_id,
    date: toDateString(row.date),
    scenes: row.scene_ids ?? [],
    crew: row.crew_ids ?? [],
    props: row.prop_ids ?? [],
    locationId: row.location_id ?? undefined,
    status: row.status ?? undefined,
    notes: row.notes ?? undefined,
    weatherForecast: row.weather_forecast ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return {
    ...base,
    ...(row.data && typeof row.data === 'object' ? row.data : {}),
    id: row.id,
    projectId: row.project_id,
    project_id: row.project_id,
    date: toDateString(row.date),
    managementVersion: Number(row.management_version ?? 0),
    managementUpdatedBy: row.management_updated_by ?? undefined,
    managementUpdatedAt: row.management_updated_at ?? undefined,
    coordinationVersion: Number(row.coordination_version ?? 0),
    coordinationUpdatedBy: row.coordination_updated_by ?? undefined,
    coordinationUpdatedAt: row.coordination_updated_at ?? undefined,
    continuityVersion: Number(row.continuity_version ?? 0),
    continuityUpdatedBy: row.continuity_updated_by ?? undefined,
    continuityUpdatedAt: row.continuity_updated_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class ProductionManagementValidationError extends Error {}

const DAY_STATUSES = new Set(['not_started', 'ready', 'at_risk', 'completed']);
const CALL_SHEET_APPROVALS = new Set(['not_ready', 'ready_for_review', 'approved']);
const CREW_STATUSES = new Set(['pending', 'confirmed', 'declined']);
const CHECKPOINT_CATEGORIES = new Set(['location', 'transport', 'catering', 'equipment', 'permit']);
const CHECKPOINT_STATUSES = new Set(['not_started', 'in_progress', 'ready', 'blocked']);
const ISSUE_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const ISSUE_STATUSES = new Set(['open', 'in_progress', 'resolved']);
const COST_STATUSES = new Set(['draft', 'pending', 'approved', 'rejected']);
const COORDINATION_TASK_CATEGORIES = new Set(['crew', 'supplier', 'transport', 'catering', 'equipment', 'permit', 'document', 'other']);
const COORDINATION_TASK_STATUSES = new Set(['todo', 'in_progress', 'blocked', 'done']);
const COORDINATION_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const COORDINATION_CREW_STATUSES = new Set(['pending', 'contacted', 'confirmed', 'problem']);
const COORDINATION_LOGISTICS_CATEGORIES = new Set(['transport', 'catering', 'equipment', 'permit', 'supplier', 'other']);
const COORDINATION_READINESS_STATUSES = new Set(['not_started', 'in_progress', 'ready', 'blocked']);
const COORDINATION_DOCUMENT_CATEGORIES = new Set(['permit', 'agreement', 'insurance', 'safety', 'schedule', 'other']);
const COORDINATION_DOCUMENT_STATUSES = new Set(['missing', 'requested', 'received', 'verified']);
const COORDINATION_ESCALATION_SEVERITIES = new Set(['info', 'warning', 'critical']);
const COORDINATION_ESCALATION_STATUSES = new Set(['open', 'acknowledged', 'resolved']);
const COORDINATION_HANDOVER_STATUSES = new Set(['draft', 'ready_for_review']);
const LOCATION_WORKFLOW_STAGES = new Set(['need', 'scouting', 'recce', 'hold', 'cleared', 'shoot_ready', 'wrapped']);
const LOCATION_DECISION_STATUSES = new Set(['undecided', 'shortlisted', 'primary', 'backup', 'released']);
const LOCATION_CONTACT_STATUSES = new Set(['not_started', 'contacted', 'awaiting_reply', 'negotiating', 'agreed', 'declined']);
const LOCATION_GATE_STATUSES = new Set(['missing', 'requested', 'in_progress', 'verified', 'blocked', 'not_required']);
const LOCATION_GATE_CATEGORIES = new Set(['owner', 'permit', 'insurance', 'technical', 'access', 'safety', 'community', 'restoration']);
const LOCATION_RECCE_STATUSES = new Set(['not_started', 'scheduled', 'in_progress', 'completed', 'changes_required']);
const LOCATION_FINANCE_STATUSES = new Set(['estimate', 'quoted', 'approved', 'settled']);
const LOCATION_RISK_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const LOCATION_RISK_STATUSES = new Set(['open', 'mitigating', 'resolved']);
const LOCATION_SCOUT_CHECK_STATUSES = new Set(['unchecked', 'pass', 'concern', 'not_applicable']);
const LOCATION_SCOUT_NOISE_LEVELS = new Set(['unknown', 'quiet', 'moderate', 'loud', 'unusable']);
const LOCATION_SCOUT_SIGNAL_LEVELS = new Set(['unknown', 'none', 'weak', 'usable', 'strong']);
const LOCATION_SCOUT_POWER_LEVELS = new Set(['unknown', 'unavailable', 'limited', 'production_ready']);
const LOCATION_SCOUT_EVIDENCE_STATUSES = new Set(['unknown', 'observed', 'verified']);
const LOCATION_SCOUT_PIN_STATUSES = new Set(['observed', 'verified']);
const LOCATION_SCOUT_OBSERVATION_CATEGORIES = new Set(['access', 'parking', 'power', 'signal', 'noise', 'light', 'weather', 'safety', 'other']);
const LOCATION_SCOUT_OBSERVATION_SOURCES = new Set(['field_observation', 'measurement', 'document', 'manual']);
const LOCATION_DECISION_CRITERION_STATUSES = new Set(['unknown', 'pass', 'concern', 'blocker', 'not_applicable']);
const LOCATION_DECISION_SIGNOFF_STATUSES = new Set(['pending', 'approved', 'changes_requested']);
const LOCATION_DECISION_ACTIONS = new Set(['approve', 'request_changes', 'lock', 'reopen']);
const LOCATION_ACTIVITY_TYPES = new Set([
  'workspace_saved',
  'decision_approved',
  'decision_changes_requested',
  'decision_locked',
  'decision_reopened',
]);
const LOCATION_DECISION_CRITERIA = [
  { id: 'creative_fit', label: 'Kreativ og dramaturgisk match', required: true },
  { id: 'camera_light', label: 'Kamera og lys', required: true },
  { id: 'sound', label: 'Lydforhold', required: true },
  { id: 'access_logistics', label: 'Adkomst og logistikk', required: true },
  { id: 'owner_permits', label: 'Eier og tillatelser', required: true },
  { id: 'safety', label: 'Sikkerhet', required: true },
  { id: 'schedule', label: 'Dato og opptaksplan', required: true },
  { id: 'budget', label: 'Budsjett', required: true },
] as const;
const LOCATION_DECISION_ROLES = ['director', 'cinematographer', 'producer'] as const;

function asObject(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function requiredString(value: unknown, field: string, maxLength = 200): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) {
    throw new ProductionManagementValidationError(`${field} må være mellom 1 og ${maxLength} tegn.`);
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength = 2_000): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length > maxLength) {
    throw new ProductionManagementValidationError(`${field} kan ikke være lengre enn ${maxLength} tegn.`);
  }
  return normalized || undefined;
}

function isoTimestamp(value: unknown, field: string, required = false): string | undefined {
  const normalized = required ? requiredString(value, field, 40) : optionalString(value, field, 40);
  if (normalized && !Number.isFinite(Date.parse(normalized))) {
    throw new ProductionManagementValidationError(`${field} må være et gyldig tidspunkt.`);
  }
  return normalized;
}

function enumValue(value: unknown, allowed: Set<string>, field: string): string {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new ProductionManagementValidationError(`${field} har en ugyldig verdi.`);
  }
  return value;
}

function limitedArray(value: unknown, field: string, maxLength: number): unknown[] {
  if (!Array.isArray(value)) {
    throw new ProductionManagementValidationError(`${field} må være en liste.`);
  }
  if (value.length > maxLength) {
    throw new ProductionManagementValidationError(`${field} kan maksimalt inneholde ${maxLength} elementer.`);
  }
  return value;
}

function uniqueBy<T>(items: T[], key: (item: T) => string, field: string): T[] {
  const ids = new Set<string>();
  for (const item of items) {
    const id = key(item);
    if (ids.has(id)) throw new ProductionManagementValidationError(`${field} inneholder duplikater.`);
    ids.add(id);
  }
  return items;
}

function normalizeLocationScoutMediaUpload(
  body: Record<string, unknown>,
  detectedKind: 'photo' | 'video' | 'audio',
): { clientUploadId: string; kind: LocationScoutMediaKind; captureMetadata: LocationScoutCaptureMetadata } {
  const rawClientUploadId = typeof body.clientUploadId === 'string' ? body.clientUploadId.trim() : '';
  if (rawClientUploadId && !isUuid(rawClientUploadId)) {
    throw new ProductionManagementValidationError('clientUploadId er ugyldig.');
  }
  const declaredKind = typeof body.kind === 'string' && body.kind.trim() ? body.kind.trim() : detectedKind;
  const allowedKinds = new Set(['photo', 'video', 'audio', 'panorama']);
  if (!allowedKinds.has(declaredKind)) {
    throw new ProductionManagementValidationError('Medietypen er ugyldig.');
  }
  if ((declaredKind === 'panorama' ? 'photo' : declaredKind) !== detectedKind) {
    throw new ProductionManagementValidationError('Medietypen samsvarer ikke med filinnholdet.');
  }

  let parsedMetadata: Record<string, unknown> = {};
  if (typeof body.metadata === 'string' && body.metadata.trim()) {
    try {
      parsedMetadata = asObject(JSON.parse(body.metadata)) ?? {};
    } catch {
      throw new ProductionManagementValidationError('Opptaksmetadata er ugyldig JSON.');
    }
  }
  const source = typeof parsedMetadata.source === 'string' ? parsedMetadata.source : 'import';
  if (!new Set(['camera', 'library', 'recorder', 'import']).has(source)) {
    throw new ProductionManagementValidationError('Opptakskilden er ugyldig.');
  }
  const coordinates = parsedMetadata.coordinates === undefined ? undefined : asObject(parsedMetadata.coordinates);
  if (parsedMetadata.coordinates !== undefined && !coordinates) {
    throw new ProductionManagementValidationError('Opptakskoordinater må være et objekt.');
  }
  const numberInRange = (raw: unknown, field: string, min: number, max: number): number => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new ProductionManagementValidationError(`${field} er ugyldig.`);
    }
    return parsed;
  };
  const sceneIds = limitedArray(parsedMetadata.sceneIds ?? [], 'metadata.sceneIds', 80)
    .map((entry, index) => requiredString(entry, `metadata.sceneIds[${index}]`, 120));

  return {
    clientUploadId: rawClientUploadId || randomUUID(),
    kind: declaredKind as LocationScoutMediaKind,
    captureMetadata: {
      capturedAt: isoTimestamp(parsedMetadata.capturedAt, 'metadata.capturedAt'),
      coordinates: coordinates ? {
        latitude: numberInRange(coordinates.latitude, 'metadata.coordinates.latitude', -90, 90),
        longitude: numberInRange(coordinates.longitude, 'metadata.coordinates.longitude', -180, 180),
        accuracyMeters: coordinates.accuracyMeters === undefined
          ? undefined
          : numberInRange(coordinates.accuracyMeters, 'metadata.coordinates.accuracyMeters', 0, 100_000),
      } : undefined,
      bearingDegrees: parsedMetadata.bearingDegrees === undefined
        ? undefined
        : numberInRange(parsedMetadata.bearingDegrees, 'metadata.bearingDegrees', 0, 360),
      source: source as LocationScoutCaptureMetadata['source'],
      deviceLabel: optionalString(parsedMetadata.deviceLabel, 'metadata.deviceLabel', 120),
      sceneIds,
      checkId: optionalString(parsedMetadata.checkId, 'metadata.checkId', 120),
      note: optionalString(parsedMetadata.note, 'metadata.note', 1_000),
    },
  };
}

function normalizeProductionManagementOperations(value: unknown) {
  const input = asObject(value);
  if (!input) throw new ProductionManagementValidationError('operations må være et objekt.');

  const crewConfirmations = uniqueBy(limitedArray(input.crewConfirmations, 'crewConfirmations', 250).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`crewConfirmations[${index}] er ugyldig.`);
    return {
      crewId: requiredString(item.crewId, `crewConfirmations[${index}].crewId`, 255),
      status: enumValue(item.status, CREW_STATUSES, `crewConfirmations[${index}].status`),
      notes: optionalString(item.notes, `crewConfirmations[${index}].notes`, 500),
      updatedAt: optionalString(item.updatedAt, `crewConfirmations[${index}].updatedAt`, 40),
    };
  }), (item) => item.crewId, 'crewConfirmations');

  const checkpoints = uniqueBy(limitedArray(input.checkpoints, 'checkpoints', 100).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`checkpoints[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `checkpoints[${index}].id`, 120),
      category: enumValue(item.category, CHECKPOINT_CATEGORIES, `checkpoints[${index}].category`),
      title: requiredString(item.title, `checkpoints[${index}].title`, 160),
      status: enumValue(item.status, CHECKPOINT_STATUSES, `checkpoints[${index}].status`),
      owner: optionalString(item.owner, `checkpoints[${index}].owner`, 120),
      notes: optionalString(item.notes, `checkpoints[${index}].notes`, 1_000),
      updatedAt: optionalString(item.updatedAt, `checkpoints[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'checkpoints');

  const issues = uniqueBy(limitedArray(input.issues, 'issues', 200).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`issues[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `issues[${index}].id`, 120),
      title: requiredString(item.title, `issues[${index}].title`, 200),
      severity: enumValue(item.severity, ISSUE_SEVERITIES, `issues[${index}].severity`),
      status: enumValue(item.status, ISSUE_STATUSES, `issues[${index}].status`),
      owner: optionalString(item.owner, `issues[${index}].owner`, 120),
      dueAt: optionalString(item.dueAt, `issues[${index}].dueAt`, 40),
      notes: optionalString(item.notes, `issues[${index}].notes`, 2_000),
      updatedAt: optionalString(item.updatedAt, `issues[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'issues');

  const costItems = uniqueBy(limitedArray(input.costItems, 'costItems', 200).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`costItems[${index}] er ugyldig.`);
    const estimatedCost = Number(item.estimatedCost);
    const actualCost = Number(item.actualCost);
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0 || estimatedCost > 1_000_000_000_000) {
      throw new ProductionManagementValidationError(`costItems[${index}].estimatedCost er ugyldig.`);
    }
    if (!Number.isFinite(actualCost) || actualCost < 0 || actualCost > 1_000_000_000_000) {
      throw new ProductionManagementValidationError(`costItems[${index}].actualCost er ugyldig.`);
    }
    return {
      id: requiredString(item.id, `costItems[${index}].id`, 120),
      category: requiredString(item.category, `costItems[${index}].category`, 100),
      title: requiredString(item.title, `costItems[${index}].title`, 200),
      estimatedCost,
      actualCost,
      status: enumValue(item.status, COST_STATUSES, `costItems[${index}].status`),
      notes: optionalString(item.notes, `costItems[${index}].notes`, 1_000),
      updatedAt: optionalString(item.updatedAt, `costItems[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'costItems');

  return {
    dayStatus: enumValue(input.dayStatus, DAY_STATUSES, 'dayStatus'),
    callSheetApproval: enumValue(input.callSheetApproval, CALL_SHEET_APPROVALS, 'callSheetApproval'),
    crewConfirmations,
    checkpoints,
    issues,
    costItems,
    notes: optionalString(input.notes, 'notes', 5_000),
  };
}

function normalizeLocationManagerOperations(value: unknown) {
  const input = asObject(value);
  if (!input) throw new ProductionManagementValidationError('operations må være et objekt.');
  const ownerCommunication = asObject(input.ownerCommunication);
  const dateAvailability = asObject(input.dateAvailability);
  const recce = asObject(input.recce);
  const logistics = asObject(input.logistics);
  const finance = asObject(input.finance);
  const scoutCapture = input.scoutCapture === undefined
    ? { conditions: { ambientNoise: 'unknown', mobileSignal: 'unknown', power: 'unknown' }, checks: [], observations: [], pins: [] }
    : asObject(input.scoutCapture);
  if (!ownerCommunication || !dateAvailability || !recce || !logistics || !finance || !scoutCapture) {
    throw new ProductionManagementValidationError('Lokasjonsoperasjonen mangler påkrevde deler.');
  }

  const scoutConditions = asObject(scoutCapture.conditions);
  if (!scoutConditions) {
    throw new ProductionManagementValidationError('scoutCapture.conditions må være et objekt.');
  }
  const scoutCoordinates = scoutCapture.coordinates === undefined
    ? undefined
    : asObject(scoutCapture.coordinates);
  if (scoutCapture.coordinates !== undefined && !scoutCoordinates) {
    throw new ProductionManagementValidationError('scoutCapture.coordinates må være et objekt.');
  }
  const coordinate = (raw: unknown, field: string, min: number, max: number): number => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new ProductionManagementValidationError(`${field} er ugyldig.`);
    }
    return parsed;
  };
  const optionalNumber = (raw: unknown, field: string, min: number, max: number): number | undefined => {
    if (raw === undefined || raw === null || raw === '') return undefined;
    return coordinate(raw, field, min, max);
  };
  const scoutChecks = uniqueBy(limitedArray(scoutCapture.checks, 'scoutCapture.checks', 40).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`scoutCapture.checks[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `scoutCapture.checks[${index}].id`, 120),
      title: requiredString(item.title, `scoutCapture.checks[${index}].title`, 180),
      status: enumValue(item.status, LOCATION_SCOUT_CHECK_STATUSES, `scoutCapture.checks[${index}].status`),
      notes: optionalString(item.notes, `scoutCapture.checks[${index}].notes`, 1_000),
      updatedAt: optionalString(item.updatedAt, `scoutCapture.checks[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'scoutCapture.checks');
  const scoutObservations = uniqueBy(limitedArray(scoutCapture.observations ?? [], 'scoutCapture.observations', 300).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`scoutCapture.observations[${index}] er ugyldig.`);
    const coordinates = item.coordinates === undefined ? undefined : asObject(item.coordinates);
    if (item.coordinates !== undefined && !coordinates) {
      throw new ProductionManagementValidationError(`scoutCapture.observations[${index}].coordinates må være et objekt.`);
    }
    return {
      id: requiredString(item.id, `scoutCapture.observations[${index}].id`, 120),
      category: enumValue(item.category, LOCATION_SCOUT_OBSERVATION_CATEGORIES, `scoutCapture.observations[${index}].category`),
      status: enumValue(item.status, LOCATION_SCOUT_EVIDENCE_STATUSES, `scoutCapture.observations[${index}].status`),
      value: requiredString(item.value, `scoutCapture.observations[${index}].value`, 1_000),
      source: enumValue(item.source, LOCATION_SCOUT_OBSERVATION_SOURCES, `scoutCapture.observations[${index}].source`),
      observedAt: isoTimestamp(item.observedAt, `scoutCapture.observations[${index}].observedAt`, true)!,
      coordinates: coordinates ? {
        latitude: coordinate(coordinates.latitude, `scoutCapture.observations[${index}].coordinates.latitude`, -90, 90),
        longitude: coordinate(coordinates.longitude, `scoutCapture.observations[${index}].coordinates.longitude`, -180, 180),
        accuracyMeters: optionalNumber(coordinates.accuracyMeters, `scoutCapture.observations[${index}].coordinates.accuracyMeters`, 0, 100_000),
      } : undefined,
      mediaIds: limitedArray(item.mediaIds ?? [], `scoutCapture.observations[${index}].mediaIds`, 40)
        .map((value, mediaIndex) => requiredString(value, `scoutCapture.observations[${index}].mediaIds[${mediaIndex}]`, 120)),
      sceneIds: limitedArray(item.sceneIds ?? [], `scoutCapture.observations[${index}].sceneIds`, 80)
        .map((value, sceneIndex) => requiredString(value, `scoutCapture.observations[${index}].sceneIds[${sceneIndex}]`, 120)),
      checkId: optionalString(item.checkId, `scoutCapture.observations[${index}].checkId`, 120),
    };
  }), (item) => item.id, 'scoutCapture.observations');
  const scoutPins = uniqueBy(limitedArray(scoutCapture.pins ?? [], 'scoutCapture.pins', 300).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`scoutCapture.pins[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `scoutCapture.pins[${index}].id`, 120),
      mediaId: requiredString(item.mediaId, `scoutCapture.pins[${index}].mediaId`, 120),
      x: coordinate(item.x, `scoutCapture.pins[${index}].x`, 0, 1),
      y: coordinate(item.y, `scoutCapture.pins[${index}].y`, 0, 1),
      label: requiredString(item.label, `scoutCapture.pins[${index}].label`, 160),
      note: optionalString(item.note, `scoutCapture.pins[${index}].note`, 1_000),
      status: enumValue(item.status, LOCATION_SCOUT_PIN_STATUSES, `scoutCapture.pins[${index}].status`),
      sceneIds: limitedArray(item.sceneIds ?? [], `scoutCapture.pins[${index}].sceneIds`, 80)
        .map((value, sceneIndex) => requiredString(value, `scoutCapture.pins[${index}].sceneIds[${sceneIndex}]`, 120)),
      checkId: optionalString(item.checkId, `scoutCapture.pins[${index}].checkId`, 120),
      createdAt: isoTimestamp(item.createdAt, `scoutCapture.pins[${index}].createdAt`, true)!,
    };
  }), (item) => item.id, 'scoutCapture.pins');

  const confirmedDates = limitedArray(dateAvailability.confirmedDates, 'dateAvailability.confirmedDates', 120)
    .map((entry, index) => requiredString(entry, `dateAvailability.confirmedDates[${index}]`, 40));
  const attendees = limitedArray(recce.attendees, 'recce.attendees', 80)
    .map((entry, index) => requiredString(entry, `recce.attendees[${index}]`, 120));
  const clearanceGates = uniqueBy(limitedArray(input.clearanceGates, 'clearanceGates', 40).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`clearanceGates[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `clearanceGates[${index}].id`, 120),
      category: enumValue(item.category, LOCATION_GATE_CATEGORIES, `clearanceGates[${index}].category`),
      title: requiredString(item.title, `clearanceGates[${index}].title`, 180),
      status: enumValue(item.status, LOCATION_GATE_STATUSES, `clearanceGates[${index}].status`),
      mandatory: item.mandatory !== false,
      owner: optionalString(item.owner, `clearanceGates[${index}].owner`, 120),
      dueAt: optionalString(item.dueAt, `clearanceGates[${index}].dueAt`, 40),
      evidence: optionalString(item.evidence, `clearanceGates[${index}].evidence`, 1_000),
      notes: optionalString(item.notes, `clearanceGates[${index}].notes`, 2_000),
      updatedAt: optionalString(item.updatedAt, `clearanceGates[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'clearanceGates');
  const risks = uniqueBy(limitedArray(input.risks, 'risks', 50).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`risks[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `risks[${index}].id`, 120),
      title: requiredString(item.title, `risks[${index}].title`, 200),
      severity: enumValue(item.severity, LOCATION_RISK_SEVERITIES, `risks[${index}].severity`),
      status: enumValue(item.status, LOCATION_RISK_STATUSES, `risks[${index}].status`),
      mitigation: optionalString(item.mitigation, `risks[${index}].mitigation`, 2_000),
      owner: optionalString(item.owner, `risks[${index}].owner`, 120),
      dueAt: optionalString(item.dueAt, `risks[${index}].dueAt`, 40),
      updatedAt: optionalString(item.updatedAt, `risks[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'risks');

  const amount = (raw: unknown, field: string): number => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) {
      throw new ProductionManagementValidationError(`${field} er ugyldig.`);
    }
    return value;
  };

  const decisionReview = input.decisionReview === undefined ? {} : asObject(input.decisionReview);
  if (!decisionReview) {
    throw new ProductionManagementValidationError('decisionReview må være et objekt.');
  }
  const rawCriteria = decisionReview.criteria === undefined
    ? []
    : limitedArray(decisionReview.criteria, 'decisionReview.criteria', LOCATION_DECISION_CRITERIA.length);
  const criteriaById = new Map(rawCriteria.map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`decisionReview.criteria[${index}] er ugyldig.`);
    const id = requiredString(item.id, `decisionReview.criteria[${index}].id`, 80);
    if (!LOCATION_DECISION_CRITERIA.some((criterion) => criterion.id === id)) {
      throw new ProductionManagementValidationError(`decisionReview.criteria[${index}].id er ukjent.`);
    }
    return [id, item] as const;
  }));
  if (criteriaById.size !== rawCriteria.length) {
    throw new ProductionManagementValidationError('decisionReview.criteria inneholder duplikater.');
  }
  const decisionCriteria = LOCATION_DECISION_CRITERIA.map((criterion) => {
    const item = criteriaById.get(criterion.id);
    return {
      ...criterion,
      status: item
        ? enumValue(item.status, LOCATION_DECISION_CRITERION_STATUSES, `decisionReview.criteria.${criterion.id}.status`)
        : 'unknown',
      evidence: item ? optionalString(item.evidence, `decisionReview.criteria.${criterion.id}.evidence`, 2_000) : undefined,
      mediaIds: item
        ? limitedArray(item.mediaIds ?? [], `decisionReview.criteria.${criterion.id}.mediaIds`, 40)
            .map((mediaId, mediaIndex) => requiredString(mediaId, `decisionReview.criteria.${criterion.id}.mediaIds[${mediaIndex}]`, 120))
        : [],
      updatedAt: item ? isoTimestamp(item.updatedAt, `decisionReview.criteria.${criterion.id}.updatedAt`) : undefined,
      updatedBy: item ? optionalString(item.updatedBy, `decisionReview.criteria.${criterion.id}.updatedBy`, 255) : undefined,
    };
  });
  const rawSignoffs = decisionReview.signoffs === undefined
    ? []
    : limitedArray(decisionReview.signoffs, 'decisionReview.signoffs', LOCATION_DECISION_ROLES.length);
  const signoffsByRole = new Map(rawSignoffs.map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`decisionReview.signoffs[${index}] er ugyldig.`);
    const role = requiredString(item.role, `decisionReview.signoffs[${index}].role`, 40);
    if (!LOCATION_DECISION_ROLES.includes(role as typeof LOCATION_DECISION_ROLES[number])) {
      throw new ProductionManagementValidationError(`decisionReview.signoffs[${index}].role er ukjent.`);
    }
    return [role, item] as const;
  }));
  if (signoffsByRole.size !== rawSignoffs.length) {
    throw new ProductionManagementValidationError('decisionReview.signoffs inneholder duplikater.');
  }
  const decisionSignoffs = LOCATION_DECISION_ROLES.map((role) => {
    const item = signoffsByRole.get(role);
    return {
      role,
      status: item
        ? enumValue(item.status, LOCATION_DECISION_SIGNOFF_STATUSES, `decisionReview.signoffs.${role}.status`)
        : 'pending',
      note: item ? optionalString(item.note, `decisionReview.signoffs.${role}.note`, 2_000) : undefined,
      userId: item ? optionalString(item.userId, `decisionReview.signoffs.${role}.userId`, 255) : undefined,
      decidedAt: item ? isoTimestamp(item.decidedAt, `decisionReview.signoffs.${role}.decidedAt`) : undefined,
    };
  });

  return {
    stage: enumValue(input.stage, LOCATION_WORKFLOW_STAGES, 'stage'),
    decisionStatus: enumValue(input.decisionStatus, LOCATION_DECISION_STATUSES, 'decisionStatus'),
    ownerCommunication: {
      status: enumValue(ownerCommunication.status, LOCATION_CONTACT_STATUSES, 'ownerCommunication.status'),
      contactName: optionalString(ownerCommunication.contactName, 'ownerCommunication.contactName', 160),
      lastContactAt: optionalString(ownerCommunication.lastContactAt, 'ownerCommunication.lastContactAt', 40),
      nextFollowUpAt: optionalString(ownerCommunication.nextFollowUpAt, 'ownerCommunication.nextFollowUpAt', 40),
      restrictions: optionalString(ownerCommunication.restrictions, 'ownerCommunication.restrictions', 3_000),
    },
    dateAvailability: {
      status: enumValue(dateAvailability.status, LOCATION_GATE_STATUSES, 'dateAvailability.status'),
      confirmedDates,
      holdExpiresAt: optionalString(dateAvailability.holdExpiresAt, 'dateAvailability.holdExpiresAt', 40),
      notes: optionalString(dateAvailability.notes, 'dateAvailability.notes', 2_000),
    },
    recce: {
      status: enumValue(recce.status, LOCATION_RECCE_STATUSES, 'recce.status'),
      scheduledAt: optionalString(recce.scheduledAt, 'recce.scheduledAt', 40),
      completedAt: optionalString(recce.completedAt, 'recce.completedAt', 40),
      attendees,
      notes: optionalString(recce.notes, 'recce.notes', 5_000),
    },
    clearanceGates,
    logistics: {
      unitBase: optionalString(logistics.unitBase, 'logistics.unitBase', 1_000),
      crewParking: optionalString(logistics.crewParking, 'logistics.crewParking', 1_000),
      loadInRoute: optionalString(logistics.loadInRoute, 'logistics.loadInRoute', 1_000),
      holdingAreas: optionalString(logistics.holdingAreas, 'logistics.holdingAreas', 1_000),
      toiletsCatering: optionalString(logistics.toiletsCatering, 'logistics.toiletsCatering', 1_000),
      nearestHospital: optionalString(logistics.nearestHospital, 'logistics.nearestHospital', 500),
      emergencyAccess: optionalString(logistics.emergencyAccess, 'logistics.emergencyAccess', 1_000),
      technicalNotes: optionalString(logistics.technicalNotes, 'logistics.technicalNotes', 5_000),
    },
    finance: {
      currency: requiredString(finance.currency, 'finance.currency', 10).toUpperCase(),
      locationFee: amount(finance.locationFee, 'finance.locationFee'),
      permitFees: amount(finance.permitFees, 'finance.permitFees'),
      restorationReserve: amount(finance.restorationReserve, 'finance.restorationReserve'),
      status: enumValue(finance.status, LOCATION_FINANCE_STATUSES, 'finance.status'),
    },
    risks,
    scoutCapture: {
      capturedAt: isoTimestamp(scoutCapture.capturedAt, 'scoutCapture.capturedAt'),
      coordinates: scoutCoordinates ? {
        latitude: coordinate(scoutCoordinates.latitude, 'scoutCapture.coordinates.latitude', -90, 90),
        longitude: coordinate(scoutCoordinates.longitude, 'scoutCapture.coordinates.longitude', -180, 180),
        accuracyMeters: optionalNumber(scoutCoordinates.accuracyMeters, 'scoutCapture.coordinates.accuracyMeters', 0, 100_000),
      } : undefined,
      conditions: {
        weather: optionalString(scoutConditions.weather, 'scoutCapture.conditions.weather', 500),
        temperatureC: optionalNumber(scoutConditions.temperatureC, 'scoutCapture.conditions.temperatureC', -100, 100),
        wind: optionalString(scoutConditions.wind, 'scoutCapture.conditions.wind', 300),
        ambientNoise: enumValue(scoutConditions.ambientNoise, LOCATION_SCOUT_NOISE_LEVELS, 'scoutCapture.conditions.ambientNoise'),
        mobileSignal: enumValue(scoutConditions.mobileSignal, LOCATION_SCOUT_SIGNAL_LEVELS, 'scoutCapture.conditions.mobileSignal'),
        power: enumValue(scoutConditions.power, LOCATION_SCOUT_POWER_LEVELS, 'scoutCapture.conditions.power'),
        daylight: optionalString(scoutConditions.daylight, 'scoutCapture.conditions.daylight', 1_000),
      },
      checks: scoutChecks,
      observations: scoutObservations,
      pins: scoutPins,
      notes: optionalString(scoutCapture.notes, 'scoutCapture.notes', 5_000),
    },
    decisionReview: {
      criteria: decisionCriteria,
      signoffs: decisionSignoffs,
      recommendationNote: optionalString(decisionReview.recommendationNote, 'decisionReview.recommendationNote', 5_000),
      lockedAt: isoTimestamp(decisionReview.lockedAt, 'decisionReview.lockedAt'),
      lockedBy: optionalString(decisionReview.lockedBy, 'decisionReview.lockedBy', 255),
      lockedVersion: decisionReview.lockedVersion === undefined
        ? undefined
        : coordinate(decisionReview.lockedVersion, 'decisionReview.lockedVersion', 0, Number.MAX_SAFE_INTEGER),
    },
    backupLocationId: optionalString(input.backupLocationId, 'backupLocationId', 255),
    weatherPlan: optionalString(input.weatherPlan, 'weatherPlan', 3_000),
    nextAction: optionalString(input.nextAction, 'nextAction', 500),
  };
}

function normalizeProductionCoordinationOperations(value: unknown) {
  const input = asObject(value);
  if (!input) throw new ProductionManagementValidationError('operations må være et objekt.');

  const tasks = uniqueBy(limitedArray(input.tasks, 'tasks', 300).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`tasks[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `tasks[${index}].id`, 120),
      title: requiredString(item.title, `tasks[${index}].title`, 200),
      category: enumValue(item.category, COORDINATION_TASK_CATEGORIES, `tasks[${index}].category`),
      status: enumValue(item.status, COORDINATION_TASK_STATUSES, `tasks[${index}].status`),
      priority: enumValue(item.priority, COORDINATION_PRIORITIES, `tasks[${index}].priority`),
      assignee: optionalString(item.assignee, `tasks[${index}].assignee`, 120),
      dueAt: optionalString(item.dueAt, `tasks[${index}].dueAt`, 40),
      notes: optionalString(item.notes, `tasks[${index}].notes`, 2_000),
      updatedAt: optionalString(item.updatedAt, `tasks[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'tasks');

  const crewFollowUps = uniqueBy(limitedArray(input.crewFollowUps, 'crewFollowUps', 250).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`crewFollowUps[${index}] er ugyldig.`);
    return {
      crewId: requiredString(item.crewId, `crewFollowUps[${index}].crewId`, 255),
      status: enumValue(item.status, COORDINATION_CREW_STATUSES, `crewFollowUps[${index}].status`),
      notes: optionalString(item.notes, `crewFollowUps[${index}].notes`, 1_000),
      updatedAt: optionalString(item.updatedAt, `crewFollowUps[${index}].updatedAt`, 40),
    };
  }), (item) => item.crewId, 'crewFollowUps');

  const logistics = uniqueBy(limitedArray(input.logistics, 'logistics', 150).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`logistics[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `logistics[${index}].id`, 120),
      category: enumValue(item.category, COORDINATION_LOGISTICS_CATEGORIES, `logistics[${index}].category`),
      title: requiredString(item.title, `logistics[${index}].title`, 200),
      status: enumValue(item.status, COORDINATION_READINESS_STATUSES, `logistics[${index}].status`),
      supplier: optionalString(item.supplier, `logistics[${index}].supplier`, 160),
      contact: optionalString(item.contact, `logistics[${index}].contact`, 200),
      dueAt: optionalString(item.dueAt, `logistics[${index}].dueAt`, 40),
      notes: optionalString(item.notes, `logistics[${index}].notes`, 2_000),
      updatedAt: optionalString(item.updatedAt, `logistics[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'logistics');

  const documents = uniqueBy(limitedArray(input.documents, 'documents', 150).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`documents[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `documents[${index}].id`, 120),
      title: requiredString(item.title, `documents[${index}].title`, 200),
      category: enumValue(item.category, COORDINATION_DOCUMENT_CATEGORIES, `documents[${index}].category`),
      status: enumValue(item.status, COORDINATION_DOCUMENT_STATUSES, `documents[${index}].status`),
      owner: optionalString(item.owner, `documents[${index}].owner`, 120),
      dueAt: optionalString(item.dueAt, `documents[${index}].dueAt`, 40),
      notes: optionalString(item.notes, `documents[${index}].notes`, 2_000),
      updatedAt: optionalString(item.updatedAt, `documents[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'documents');

  const callSheetChecklist = uniqueBy(limitedArray(input.callSheetChecklist, 'callSheetChecklist', 50).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`callSheetChecklist[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `callSheetChecklist[${index}].id`, 120),
      title: requiredString(item.title, `callSheetChecklist[${index}].title`, 200),
      status: enumValue(item.status, COORDINATION_READINESS_STATUSES, `callSheetChecklist[${index}].status`),
      notes: optionalString(item.notes, `callSheetChecklist[${index}].notes`, 1_000),
      updatedAt: optionalString(item.updatedAt, `callSheetChecklist[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'callSheetChecklist');

  const escalations = uniqueBy(limitedArray(input.escalations, 'escalations', 150).map((entry, index) => {
    const item = asObject(entry);
    if (!item) throw new ProductionManagementValidationError(`escalations[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `escalations[${index}].id`, 120),
      title: requiredString(item.title, `escalations[${index}].title`, 200),
      severity: enumValue(item.severity, COORDINATION_ESCALATION_SEVERITIES, `escalations[${index}].severity`),
      status: enumValue(item.status, COORDINATION_ESCALATION_STATUSES, `escalations[${index}].status`),
      owner: optionalString(item.owner, `escalations[${index}].owner`, 120),
      dueAt: optionalString(item.dueAt, `escalations[${index}].dueAt`, 40),
      notes: optionalString(item.notes, `escalations[${index}].notes`, 2_000),
      updatedAt: optionalString(item.updatedAt, `escalations[${index}].updatedAt`, 40),
    };
  }), (item) => item.id, 'escalations');

  const handoverInput = asObject(input.handover);
  if (!handoverInput) throw new ProductionManagementValidationError('handover må være et objekt.');
  const handover = {
    status: enumValue(handoverInput.status, COORDINATION_HANDOVER_STATUSES, 'handover.status'),
    summary: optionalString(handoverInput.summary, 'handover.summary', 5_000),
    blockers: optionalString(handoverInput.blockers, 'handover.blockers', 5_000),
    nextActions: optionalString(handoverInput.nextActions, 'handover.nextActions', 5_000),
    updatedAt: optionalString(handoverInput.updatedAt, 'handover.updatedAt', 40),
  };

  return { tasks, crewFollowUps, logistics, documents, callSheetChecklist, escalations, handover };
}

function summarizeManagementChanges(previous: Record<string, any> | null, next: Record<string, any>): string {
  const changed: string[] = [];
  if (previous?.dayStatus !== next.dayStatus) changed.push('dagsstatus');
  if (previous?.callSheetApproval !== next.callSheetApproval) changed.push('callsheet-godkjenning');
  if (JSON.stringify(previous?.crewConfirmations ?? []) !== JSON.stringify(next.crewConfirmations)) changed.push('crew');
  if (JSON.stringify(previous?.checkpoints ?? []) !== JSON.stringify(next.checkpoints)) changed.push('logistikk');
  if (JSON.stringify(previous?.issues ?? []) !== JSON.stringify(next.issues)) changed.push('avvik');
  if (JSON.stringify(previous?.costItems ?? []) !== JSON.stringify(next.costItems)) changed.push('kostnader');
  if ((previous?.notes ?? '') !== (next.notes ?? '')) changed.push('dagsnotat');
  return changed.length > 0
    ? `Oppdaterte ${changed.join(', ')}.`
    : 'Lagret dagskontrollen uten innholdsendringer.';
}

function summarizeCoordinationChanges(previous: Record<string, any> | null, next: Record<string, any>): string {
  const changed: string[] = [];
  if (JSON.stringify(previous?.tasks ?? []) !== JSON.stringify(next.tasks)) changed.push('oppgaver');
  if (JSON.stringify(previous?.crewFollowUps ?? []) !== JSON.stringify(next.crewFollowUps)) changed.push('crewoppfølging');
  if (JSON.stringify(previous?.logistics ?? []) !== JSON.stringify(next.logistics)) changed.push('logistikk');
  if (JSON.stringify(previous?.documents ?? []) !== JSON.stringify(next.documents)) changed.push('dokumenter');
  if (JSON.stringify(previous?.callSheetChecklist ?? []) !== JSON.stringify(next.callSheetChecklist)) changed.push('callsheet-sjekk');
  if (JSON.stringify(previous?.escalations ?? []) !== JSON.stringify(next.escalations)) changed.push('eskaleringer');
  if (JSON.stringify(previous?.handover ?? {}) !== JSON.stringify(next.handover)) changed.push('overlevering');
  return changed.length > 0
    ? `Oppdaterte ${changed.join(', ')}.`
    : 'Lagret koordinatorflaten uten innholdsendringer.';
}

function productionDayDataWithoutProtectedOperations(body: Record<string, any>): Record<string, any> {
  const data = { ...body };
  delete data.productionManagement;
  delete data.managementVersion;
  delete data.managementUpdatedAt;
  delete data.managementUpdatedBy;
  delete data.productionCoordination;
  delete data.coordinationVersion;
  delete data.coordinationUpdatedAt;
  delete data.coordinationUpdatedBy;
  delete data.productionContinuity;
  delete data.continuityVersion;
  delete data.continuityUpdatedAt;
  delete data.continuityUpdatedBy;
  return data;
}

type LocationDecisionApprovalRole = typeof LOCATION_DECISION_ROLES[number];
type NormalizedLocationOperations = ReturnType<typeof normalizeLocationManagerOperations>;

function readLocationActivity(value: unknown): Array<Record<string, unknown>> {
  const activity = asObject(value)?.activity;
  if (!Array.isArray(activity)) return [];
  const normalized: Array<Record<string, unknown>> = [];
  for (const entry of activity) {
    const item = asObject(entry);
    const id = typeof item?.id === 'string' ? item.id.trim().slice(0, 120) : '';
    const message = typeof item?.message === 'string' ? item.message.trim().slice(0, 300) : '';
    const createdAt = typeof item?.createdAt === 'string' ? item.createdAt.trim().slice(0, 40) : '';
    const type = typeof item?.type === 'string' && LOCATION_ACTIVITY_TYPES.has(item.type)
      ? item.type
      : 'workspace_saved';
    const actorRole = typeof item?.actorRole === 'string'
      && [...LOCATION_DECISION_ROLES, 'location_manager'].includes(item.actorRole as LocationDecisionApprovalRole | 'location_manager')
      ? item.actorRole
      : undefined;
    if (!id || !message || !createdAt) continue;
    normalized.push({
      id,
      type,
      message,
      actorUserId: item?.actorUserId ? String(item.actorUserId).slice(0, 255) : undefined,
      actorRole,
      createdAt,
    });
  }
  return normalized.slice(-99);
}

function locationDecisionBasisFingerprint(operations: NormalizedLocationOperations): string {
  return JSON.stringify({
    decisionStatus: operations.decisionStatus,
    ownerCommunication: operations.ownerCommunication,
    dateAvailability: operations.dateAvailability,
    recce: operations.recce,
    clearanceGates: operations.clearanceGates,
    logistics: operations.logistics,
    finance: operations.finance,
    risks: operations.risks,
    scoutCapture: operations.scoutCapture,
    backupLocationId: operations.backupLocationId,
    weatherPlan: operations.weatherPlan,
    decisionReview: {
      recommendationNote: operations.decisionReview.recommendationNote,
      criteria: operations.decisionReview.criteria.map((criterion) => ({
        id: criterion.id,
        status: criterion.status,
        evidence: criterion.evidence,
        mediaIds: criterion.mediaIds,
      })),
    },
  });
}

function locationDecisionLockReasons(operations: NormalizedLocationOperations): string[] {
  const reasons: string[] = [];
  operations.decisionReview.criteria.filter((criterion) => criterion.required).forEach((criterion) => {
    if (criterion.status !== 'pass') reasons.push(`${criterion.label} er ikke godkjent`);
    else if (!criterion.evidence?.trim() && criterion.mediaIds.length === 0) reasons.push(`${criterion.label} mangler evidens`);
  });
  operations.clearanceGates
    .filter((gate) => gate.mandatory && gate.status !== 'verified')
    .forEach((gate) => reasons.push(`${gate.title} er ikke verifisert`));
  if (operations.ownerCommunication.status !== 'agreed') reasons.push('Eieravtalen er ikke bekreftet');
  if (operations.dateAvailability.status !== 'verified' || operations.dateAvailability.confirmedDates.length === 0) {
    reasons.push('Opptaksdato er ikke verifisert');
  }
  if (operations.recce.status !== 'completed') reasons.push('Teknisk recce er ikke godkjent');
  if (!['approved', 'settled'].includes(operations.finance.status)) reasons.push('Lokasjonskostnaden er ikke godkjent');
  if (!operations.backupLocationId) reasons.push('Backup-lokasjon er ikke valgt');
  operations.decisionReview.signoffs
    .filter((signoff) => signoff.status !== 'approved')
    .forEach((signoff) => reasons.push(`${signoff.role} har ikke godkjent`));
  operations.risks
    .filter((risk) => risk.status !== 'resolved' && risk.severity === 'critical')
    .forEach((risk) => reasons.push(risk.title));
  return [...new Set(reasons)];
}

export interface CreateCastingProductionRouterDeps {
  activeSessions?: Map<string, SessionData>;
  uploadContinuityMedia?: typeof uploadContinuityMediaToS3;
  getContinuityMediaDownloadUrl?: typeof getContinuityMediaS3DownloadUrl;
  uploadLocationScoutPhoto?: typeof uploadLocationScoutMediaToS3;
  listLocationScoutMedia?: typeof listLocationScoutMedia;
  getLocationScoutMediaDownloadUrl?: typeof getLocationScoutMediaDownloadUrl;
}

export function createCastingProductionRouter(
  pool: Pool,
  deps: CreateCastingProductionRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);
  const uploadContinuityMedia = deps.uploadContinuityMedia ?? uploadContinuityMediaToS3;
  const getContinuityMediaDownloadUrl = deps.getContinuityMediaDownloadUrl ?? getContinuityMediaS3DownloadUrl;
  const uploadLocationScoutMedia = deps.uploadLocationScoutPhoto ?? uploadLocationScoutMediaToS3;
  const listLocationScoutMediaAdapter = deps.listLocationScoutMedia ?? listLocationScoutMedia;
  const getLocationScoutMediaDownloadUrlAdapter = deps.getLocationScoutMediaDownloadUrl ?? getLocationScoutMediaDownloadUrl;

  // Props remain owner-scoped. Production days also support active project
  // members, with an explicit production-write check for mutations. Auth alone
  // only proves *a* logged-in user and cannot prevent cross-tenant IDOR.
  async function ensureProjectOwner(
    req: Request,
    res: Response,
    projectId: unknown,
  ): Promise<boolean> {
    const userId = (req as AuthedRequest).userId;
    const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
    if (!normalizedProjectId || !(await userOwnsCastingProject(pool, normalizedProjectId, userId))) {
      res.status(404).json({ error: 'not_found' });
      return false;
    }
    return true;
  }

  /**
   * Single gate for every production route. `resolveCastingProjectAccess`
   * answers membership and all grants from one query, so a request can no
   * longer see the caller as a coordinator for one check and a stranger for
   * the next. A denial always reads as 404 to keep project existence private
   * across tenants.
   */
  async function ensureProjectGrant(
    req: Request,
    res: Response,
    projectId: unknown,
    grant: CastingGrant | 'access',
  ): Promise<boolean> {
    const userId = (req as AuthedRequest).userId;
    const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
    const access = normalizedProjectId
      ? await resolveCastingProjectAccess(pool, normalizedProjectId, userId)
      : null;
    const allowed = access
      ? (grant === 'access' ? access.canAccess : access.grants[grant])
      : false;
    if (!allowed) {
      res.status(404).json({ error: 'not_found' });
      return false;
    }
    return true;
  }

  const ensureProductionAccess = (
    req: Request,
    res: Response,
    projectId: unknown,
    mode: 'read' | 'write',
  ) => ensureProjectGrant(req, res, projectId, mode === 'write' ? 'canEditProduction' : 'access');

  const ensureProductionManagementAccess = (req: Request, res: Response, projectId: unknown) =>
    ensureProjectGrant(req, res, projectId, 'canManageProduction');

  const ensureProductionCoordinationAccess = (req: Request, res: Response, projectId: unknown) =>
    ensureProjectGrant(req, res, projectId, 'canCoordinateProduction');

  const ensureLocationManagementAccess = (req: Request, res: Response, projectId: unknown) =>
    ensureProjectGrant(req, res, projectId, 'canManageLocations');

  const ensureContinuityAccess = (
    req: Request,
    res: Response,
    projectId: unknown,
    mode: 'manage' | 'comment',
  ) => ensureProjectGrant(
    req,
    res,
    projectId,
    mode === 'manage' ? 'canManageContinuity' : 'canCommentContinuity',
  );

  async function resolveLocationDecisionAuthority(projectId: string, userId: string) {
    const access = await resolveCastingProjectAccess(pool, projectId, userId);
    // A project missing from the canonical table has no decision authority,
    // even when the legacy compat store still names an owner.
    if (!access.projectExists) return null;
    // Historic rows store the role with spaces or hyphens; the canonical
    // resolver only lowercases and trims.
    const projectRole = (access.role ?? '').replace(/[ -]+/g, '_');
    const approvalRole: LocationDecisionApprovalRole | null = projectRole === 'director'
      ? 'director'
      : ['cinematographer', 'director_of_photography', 'dop', 'dp', 'camera_team'].includes(projectRole)
        ? 'cinematographer'
        : projectRole === 'producer'
          ? 'producer'
          : access.isOwner && !projectRole
            ? 'producer'
            : null;
    return {
      approvalRole,
      canLock: access.isOwner || projectRole === 'producer',
      canReopen: access.isOwner || ['producer', 'production_manager', 'location_manager'].includes(projectRole),
    };
  }

  const mapLocationOperationsRow = (row: Record<string, any>) => ({
    locationId: String(row.location_id),
    operations: asObject(row.operations) ?? {},
    version: Number(row.version ?? 0),
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  });

  // ────────────── CHANGE IMPACT ──────────────
  /**
   * Hva som brekker hvis denne dagen flyttes. Ren lesning — den endrer
   * ingenting, og finnes for at brukeren skal se konsekvensen før valget
   * tas i stedet for å få den forklart etterpå.
   */
  router.get('/projects/:projectId/production-days/:dayId/impact', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const projectId = String(req.params.projectId || '').trim();
      const dayId = String(req.params.dayId || '').trim();
      const toDate = String(req.query.date || '').trim();
      const toLocationId = String(req.query.locationId || '').trim();
      // Scenene kommer som kommaseparert liste. Tom streng betyr «ingen
      // scener», som er en ekte endring, mens fravær av parameteren betyr
      // «scenene røres ikke» — derfor skilles de to.
      const sceneParam = req.query.sceneIds;
      const sceneListGiven = sceneParam !== undefined;
      const toSceneIds = sceneListGiven
        ? String(sceneParam).split(',').map((id) => id.trim()).filter(Boolean)
        : [];
      const propParam = req.query.propIds;
      const propListGiven = propParam !== undefined;
      const toPropIds = propListGiven
        ? String(propParam).split(',').map((id) => id.trim()).filter(Boolean)
        : [];
      const equipmentParam = req.query.equipmentIds;
      const equipmentListGiven = equipmentParam !== undefined;
      const toEquipmentIds = equipmentListGiven
        ? String(equipmentParam).split(',').map((id) => id.trim()).filter(Boolean)
        : [];
      // Samme rute svarer for alle tre endringene. En forespørsel uten noen av
      // dem har ingen konsekvens å beregne.
      if (!toDate && !toLocationId && !sceneListGiven && !propListGiven && !equipmentListGiven) {
        res.status(400).json({
          error: 'invalid_payload',
          message: 'Oppgi ny dato, ny lokasjon, nye scener, nye rekvisitter eller nytt utstyr.',
        });
        return;
      }
      if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
        res.status(400).json({ error: 'invalid_payload', message: 'Oppgi ny dato som YYYY-MM-DD.' });
        return;
      }
      // Forhåndsvisningen avslører produksjonsdata, så den krever samme
      // rettighet som selve flyttingen.
      if (!(await ensureProductionAccess(req, res, projectId, 'write'))) return;

      const dayResult = await pool.query(
        `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, location_id, scene_ids, prop_ids, data
           FROM casting_production_days
          WHERE id = $1 AND project_id = $2
          LIMIT 1`,
        [dayId, projectId],
      );
      const day = dayResult.rows[0] as {
        date?: string;
        location_id?: string | null;
        scene_ids?: unknown;
        prop_ids?: unknown;
        data?: Record<string, unknown> | null;
      } | undefined;
      if (!day) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const fromDate = String(day.date ?? '');
      const fromLocationId = day.location_id ? String(day.location_id) : null;
      const fromSceneIds = asArray(day.scene_ids).map((sceneId) => String(sceneId));
      const fromPropIds = asArray(day.prop_ids).map((propId) => String(propId));
      // Utstyret ligger i dagens `data`-blob, ikke i en egen kolonne — samme
      // sted API-et allerede lagrer det når dagen skrives.
      const fromEquipmentIds = asArray(day.data?.equipment).map((itemId) => String(itemId));

      const dateChanged = Boolean(toDate) && toDate !== fromDate;
      const locationChanged = Boolean(toLocationId) && toLocationId !== fromLocationId;
      const scenesChanged = sceneListGiven
        && (fromSceneIds.length !== toSceneIds.length
          || [...new Set(fromSceneIds)].some((id) => !toSceneIds.includes(id)));
      const propsChanged = propListGiven
        && (fromPropIds.length !== toPropIds.length
          || [...new Set(fromPropIds)].some((id) => !toPropIds.includes(id)));
      const equipmentChanged = equipmentListGiven
        && (fromEquipmentIds.length !== toEquipmentIds.length
          || [...new Set(fromEquipmentIds)].some((id) => !toEquipmentIds.includes(id)));
      if (!dateChanged && !locationChanged && !scenesChanged && !propsChanged && !equipmentChanged) {
        res.json({
          from: fromDate,
          to: toDate || fromDate,
          fromLocationId,
          toLocationId: toLocationId || fromLocationId,
          fromSceneIds,
          toSceneIds: sceneListGiven ? toSceneIds : fromSceneIds,
          fromPropIds,
          toPropIds: propListGiven ? toPropIds : fromPropIds,
          fromEquipmentIds,
          toEquipmentIds: equipmentListGiven ? toEquipmentIds : fromEquipmentIds,
          impacts: [],
          blocking: false,
          unchanged: true,
        });
        return;
      }

      const impacts = [
        ...(dateChanged
          ? await collectProductionDayChangeImpact(pool, { projectId, dayId, fromDate, toDate })
          : []),
        ...(locationChanged
          ? await collectProductionDayLocationImpact(pool, {
              projectId, dayId, fromLocationId, toLocationId,
            })
          : []),
        ...(scenesChanged
          ? await collectProductionDaySceneImpact(pool, {
              projectId, dayId, fromSceneIds, toSceneIds,
            })
          : []),
        ...(propsChanged
          ? await collectProductionDayPropImpact(pool, {
              projectId, dayId, fromPropIds, toPropIds,
            })
          : []),
        ...(equipmentChanged
          ? await collectProductionDayEquipmentImpact(pool, {
              projectId, dayId, fromEquipmentIds, toEquipmentIds,
            })
          : []),
      ];
      res.json({
        from: fromDate,
        to: toDate || fromDate,
        fromLocationId,
        toLocationId: toLocationId || fromLocationId,
        fromSceneIds,
        toSceneIds: sceneListGiven ? toSceneIds : fromSceneIds,
        fromPropIds,
        toPropIds: propListGiven ? toPropIds : fromPropIds,
        fromEquipmentIds,
        toEquipmentIds: equipmentListGiven ? toEquipmentIds : fromEquipmentIds,
        impacts,
        blocking: hasBlockingImpact(impacts),
        unchanged: false,
      });
    } catch {
      // En ufullstendig liste er verre enn ingen liste: klienten skal ikke
      // kunne presentere «ingen påvirkning» når spørringen feilet.
      res.status(500).json({ error: 'impact_unavailable', message: 'Kunne ikke beregne konsekvensen.' });
    }
  });

  // ────────────── PROJECT ACCESS ──────────────
  /**
   * The caller's effective role and grants for one project, resolved on the
   * server. The client used to read the whole role roster and match itself by
   * user id, which ignored deactivated and expired memberships; this answers
   * for the authenticated caller only, from the same resolver every guard uses.
   */
  router.get('/projects/:projectId/access', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const userId = (req as AuthedRequest).userId;
      const projectId = typeof req.params.projectId === 'string' ? req.params.projectId.trim() : '';
      const access = projectId
        ? await resolveCastingProjectAccess(pool, projectId, userId)
        : null;
      if (!access?.canAccess) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json({
        access: {
          projectId,
          role: access.role,
          roles: access.roles,
          isOwner: access.isOwner,
          isMember: access.isMember,
          permissions: access.permissions,
          grants: access.grants,
        },
      });
    } catch {
      res.status(500).json({ error: 'Kunne ikke hente prosjekttilgang', detail: 'internal_error' });
    }
  });

  // ────────────── LOCATION OPERATIONS ──────────────
  router.get('/projects/:projectId/location-operations', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      if (!(await ensureProductionAccess(req, res, req.params.projectId, 'read'))) return;
      const result = await pool.query(
        `SELECT location_id, operations, version, updated_by, updated_at
           FROM role_room_location_operations
          WHERE project_id = $1
          ORDER BY updated_at DESC`,
        [req.params.projectId],
      );
      res.json({ locationOperations: result.rows.map(mapLocationOperationsRow) });
    } catch {
      res.status(500).json({ error: 'Kunne ikke hente lokasjonsberedskap', detail: 'internal_error' });
    }
  });

  router.patch('/projects/:projectId/locations/:locationId/operations', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const { projectId } = req.params;
      const locationId = requiredString(req.params.locationId, 'locationId', 255);
      if (!(await ensureLocationManagementAccess(req, res, projectId))) return;

      const body = asObject(req.body);
      if (!body || Buffer.byteLength(JSON.stringify(body), 'utf8') > 256 * 1024) {
        res.status(400).json({ error: 'invalid_payload', message: 'Lokasjonsberedskapen er ugyldig eller for stor.' });
        return;
      }
      const expectedVersion = Number(body.expectedVersion);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
        res.status(400).json({ error: 'invalid_payload', message: 'expectedVersion må være et ikke-negativt heltall.' });
        return;
      }
      const normalized = normalizeLocationManagerOperations(body.operations);
      const locationResult = await pool.query(
        'SELECT 1 FROM casting_locations WHERE project_id = $1 AND id = $2 LIMIT 1',
        [projectId, locationId],
      );
      if (locationResult.rowCount === 0) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      if (normalized.backupLocationId) {
        if (normalized.backupLocationId === locationId) {
          res.status(400).json({ error: 'invalid_payload', message: 'En lokasjon kan ikke være sin egen backup.' });
          return;
        }
        const backupResult = await pool.query(
          'SELECT 1 FROM casting_locations WHERE project_id = $1 AND id = $2 LIMIT 1',
          [projectId, normalized.backupLocationId],
        );
        if (backupResult.rowCount === 0) {
          res.status(400).json({ error: 'invalid_payload', message: 'Backup-lokasjonen tilhører ikke prosjektet.' });
          return;
        }
      }
      const currentResult = await pool.query(
        `SELECT location_id, operations, version, updated_by, updated_at
           FROM role_room_location_operations
          WHERE project_id = $1 AND location_id = $2`,
        [projectId, locationId],
      );
      const currentRow = currentResult.rows[0] as Record<string, any> | undefined;
      const currentVersion = Number(currentRow?.version ?? 0);
      if (currentVersion !== expectedVersion) {
        sendVersionConflict(res, 'location_operations', 'Lokasjonen er endret av en annen bruker.', currentRow ? mapLocationOperationsRow(currentRow) : undefined);
        return;
      }

      const currentNormalized = currentRow ? normalizeLocationManagerOperations(currentRow.operations) : null;
      if (currentNormalized?.decisionReview.lockedAt) {
        res.status(409).json({
          error: 'decision_locked',
          message: 'Beslutningen er låst. Gjenåpne den før lokasjonsgrunnlaget endres.',
          locationOperation: mapLocationOperationsRow(currentRow!),
        });
        return;
      }

      const previousActivity = readLocationActivity(currentRow?.operations);
      const actorUserId = (req as AuthedRequest).userId;
      const savedAt = new Date().toISOString();
      const decisionBasisChanged = currentNormalized
        ? locationDecisionBasisFingerprint(currentNormalized) !== locationDecisionBasisFingerprint(normalized)
        : true;
      const approvalsInvalidated = decisionBasisChanged && Boolean(currentNormalized?.decisionReview.signoffs
        .some((signoff) => signoff.status !== 'pending'));
      const previousCriteria = new Map((currentNormalized?.decisionReview.criteria ?? []).map((criterion) => [criterion.id, criterion]));
      const decisionCriteria = normalized.decisionReview.criteria.map((criterion) => {
        const previous = previousCriteria.get(criterion.id);
        const changed = !previous
          || previous.status !== criterion.status
          || previous.evidence !== criterion.evidence
          || JSON.stringify(previous.mediaIds) !== JSON.stringify(criterion.mediaIds);
        return changed
          ? { ...criterion, updatedAt: savedAt, updatedBy: actorUserId }
          : { ...criterion, updatedAt: previous.updatedAt, updatedBy: previous.updatedBy };
      });
      const nextOperations = {
        ...normalized,
        decisionReview: {
          ...normalized.decisionReview,
          criteria: decisionCriteria,
          signoffs: decisionBasisChanged
            ? LOCATION_DECISION_ROLES.map((role) => ({ role, status: 'pending' }))
            : currentNormalized?.decisionReview.signoffs
              ?? LOCATION_DECISION_ROLES.map((role) => ({ role, status: 'pending' })),
          lockedAt: currentNormalized?.decisionReview.lockedAt,
          lockedBy: currentNormalized?.decisionReview.lockedBy,
          lockedVersion: currentNormalized?.decisionReview.lockedVersion,
        },
        activity: [
          ...previousActivity,
          {
            id: genId('location-activity'),
            type: 'workspace_saved',
            message: approvalsInvalidated
              ? 'Oppdaterte beslutningsgrunnlaget. Tidligere rollegodkjenninger ble nullstilt.'
              : 'Oppdaterte lokasjonens operative feltgrunnlag.',
            actorUserId,
            createdAt: savedAt,
          },
        ].slice(-100),
      };
      const saveResult = await pool.query(
        `INSERT INTO role_room_location_operations
           (id, project_id, location_id, operations, version, updated_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, 1, $6, NOW(), NOW())
         ON CONFLICT (project_id, location_id) DO UPDATE SET
           operations = EXCLUDED.operations,
           version = role_room_location_operations.version + 1,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
         WHERE role_room_location_operations.version = $5
         RETURNING location_id, operations, version, updated_by, updated_at`,
        [genId('location-operations'), projectId, locationId, JSON.stringify(nextOperations), expectedVersion, actorUserId],
      );
      if (saveResult.rowCount === 0) {
        const latest = await pool.query(
          `SELECT location_id, operations, version, updated_by, updated_at
             FROM role_room_location_operations
            WHERE project_id = $1 AND location_id = $2`,
          [projectId, locationId],
        );
        sendVersionConflict(res, 'location_operations', 'Lokasjonen er endret av en annen bruker.', latest.rows[0] ? mapLocationOperationsRow(latest.rows[0]) : undefined);
        return;
      }
      res.json({ locationOperation: mapLocationOperationsRow(saveResult.rows[0]) });
    } catch (error) {
      if (error instanceof ProductionManagementValidationError) {
        res.status(400).json({ error: 'invalid_payload', message: error.message });
        return;
      }
      res.status(500).json({ error: 'Kunne ikke lagre lokasjonsberedskap', detail: 'internal_error' });
    }
  });

  router.post(
    '/projects/:projectId/locations/:locationId/decision',
    auth,
    locationDecisionActionLimiter,
    async (req, res) => {
      try {
        await schemaReady(pool);
        const { projectId } = req.params;
        const locationId = requiredString(req.params.locationId, 'locationId', 255);
        const actorUserId = (req as AuthedRequest).userId;
        const body = asObject(req.body);
        if (!body || Buffer.byteLength(JSON.stringify(body), 'utf8') > 16 * 1024) {
          res.status(400).json({ error: 'invalid_payload', message: 'Beslutningshandlingen er ugyldig eller for stor.' });
          return;
        }
        const expectedVersion = Number(body.expectedVersion);
        if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
          res.status(400).json({ error: 'invalid_payload', message: 'Lagre beslutningsgrunnlaget før godkjenning.' });
          return;
        }
        const action = enumValue(body.action, LOCATION_DECISION_ACTIONS, 'action');
        const note = optionalString(body.note, 'note', 2_000);
        if (action === 'request_changes' && !note) {
          res.status(400).json({ error: 'invalid_payload', message: 'Beskriv hva som må endres.' });
          return;
        }

        const authority = await resolveLocationDecisionAuthority(projectId, actorUserId);
        const canAct = action === 'lock'
          ? authority?.canLock
          : action === 'reopen'
            ? authority?.canReopen
            : Boolean(authority?.approvalRole);
        if (!authority || !canAct) {
          res.status(404).json({ error: 'not_found' });
          return;
        }

        const currentResult = await pool.query(
          `SELECT operations.location_id, operations.operations, operations.version, operations.updated_by, operations.updated_at
             FROM role_room_location_operations operations
             JOIN casting_locations location
               ON location.id = operations.location_id
              AND location.project_id = operations.project_id
            WHERE operations.project_id = $1 AND operations.location_id = $2
            LIMIT 1`,
          [projectId, locationId],
        );
        const currentRow = currentResult.rows[0] as Record<string, any> | undefined;
        if (!currentRow) {
          res.status(409).json({ error: 'decision_not_saved', message: 'Lagre beslutningsgrunnlaget før godkjenning.' });
          return;
        }
        const currentVersion = Number(currentRow.version ?? 0);
        if (currentVersion !== expectedVersion) {
          sendVersionConflict(res, 'location_operations', 'Beslutningen er endret av en annen bruker.', mapLocationOperationsRow(currentRow));
          return;
        }

        const operations = normalizeLocationManagerOperations(currentRow.operations);
        const now = new Date().toISOString();
        const activity = readLocationActivity(currentRow.operations);
        let nextOperations: NormalizedLocationOperations;
        let activityType: string;
        let activityMessage: string;
        let actorRole: LocationDecisionApprovalRole | 'location_manager' | undefined = authority.approvalRole ?? undefined;

        if (action === 'approve' || action === 'request_changes') {
          if (operations.decisionReview.lockedAt) {
            res.status(409).json({ error: 'decision_locked', message: 'Beslutningen er låst og må gjenåpnes før en ny vurdering.' });
            return;
          }
          const role = authority.approvalRole!;
          const status = action === 'approve' ? 'approved' : 'changes_requested';
          nextOperations = {
            ...operations,
            decisionReview: {
              ...operations.decisionReview,
              signoffs: operations.decisionReview.signoffs.map((signoff) => signoff.role === role
                ? { role, status, note, userId: actorUserId, decidedAt: now }
                : signoff),
            },
          };
          activityType = action === 'approve' ? 'decision_approved' : 'decision_changes_requested';
          activityMessage = action === 'approve'
            ? `${role} godkjente lokasjonsvalget.`
            : `${role} ba om endringer i lokasjonsvalget.`;
        } else if (action === 'lock') {
          if (operations.decisionReview.lockedAt) {
            res.status(409).json({ error: 'decision_locked', message: 'Beslutningen er allerede låst.' });
            return;
          }
          const reasons = locationDecisionLockReasons(operations);
          if (operations.backupLocationId) {
            const backup = await pool.query(
              'SELECT 1 FROM casting_locations WHERE project_id = $1 AND id = $2 AND id <> $3 LIMIT 1',
              [projectId, operations.backupLocationId, locationId],
            );
            if (backup.rowCount === 0) reasons.push('Backup-lokasjonen finnes ikke i prosjektet');
          }
          if (reasons.length > 0) {
            res.status(409).json({
              error: 'decision_not_ready',
              message: 'Lokasjonsvalget kan ikke låses ennå.',
              reasons: [...new Set(reasons)],
              locationOperation: mapLocationOperationsRow(currentRow),
            });
            return;
          }
          const stageOrder = ['need', 'scouting', 'recce', 'hold', 'cleared', 'shoot_ready', 'wrapped'];
          nextOperations = {
            ...operations,
            stage: stageOrder.indexOf(operations.stage) < stageOrder.indexOf('cleared') ? 'cleared' : operations.stage,
            decisionStatus: 'primary',
            decisionReview: {
              ...operations.decisionReview,
              lockedAt: now,
              lockedBy: actorUserId,
              lockedVersion: currentVersion + 1,
            },
          };
          actorRole = 'producer';
          activityType = 'decision_locked';
          activityMessage = 'Produsent låste primærlokasjonen for produksjon.';
        } else {
          if (!operations.decisionReview.lockedAt) {
            res.status(409).json({ error: 'decision_not_locked', message: 'Beslutningen er ikke låst.' });
            return;
          }
          nextOperations = {
            ...operations,
            decisionStatus: 'shortlisted',
            decisionReview: {
              ...operations.decisionReview,
              signoffs: LOCATION_DECISION_ROLES.map((role) => ({
                role,
                status: 'pending',
                note: undefined,
                userId: undefined,
                decidedAt: undefined,
              })),
              lockedAt: undefined,
              lockedBy: undefined,
              lockedVersion: undefined,
            },
          };
          actorRole = authority.approvalRole ?? 'location_manager';
          activityType = 'decision_reopened';
          activityMessage = 'Lokasjonsvalget ble gjenåpnet. Alle roller må godkjenne på nytt.';
        }

        const auditedOperations = {
          ...nextOperations,
          activity: [
            ...activity,
            {
              id: genId('location-activity'),
              type: activityType,
              message: activityMessage,
              actorUserId,
              actorRole,
              createdAt: now,
            },
          ].slice(-100),
        };
        const updateResult = await pool.query(
          `UPDATE role_room_location_operations
              SET operations = $4::jsonb,
                  version = version + 1,
                  updated_by = $5,
                  updated_at = NOW()
            WHERE project_id = $1 AND location_id = $2 AND version = $3
          RETURNING location_id, operations, version, updated_by, updated_at`,
          [projectId, locationId, expectedVersion, JSON.stringify(auditedOperations), actorUserId],
        );
        if (updateResult.rowCount === 0) {
          const latest = await pool.query(
            `SELECT location_id, operations, version, updated_by, updated_at
               FROM role_room_location_operations
              WHERE project_id = $1 AND location_id = $2`,
            [projectId, locationId],
          );
          sendVersionConflict(res, 'location_operations', 'Beslutningen er endret av en annen bruker.', latest.rows[0] ? mapLocationOperationsRow(latest.rows[0]) : undefined);
          return;
        }
        res.json({ locationOperation: mapLocationOperationsRow(updateResult.rows[0]) });
      } catch (error) {
        if (error instanceof ProductionManagementValidationError) {
          res.status(400).json({ error: 'invalid_payload', message: error.message });
          return;
        }
        res.status(500).json({ error: 'Kunne ikke oppdatere lokasjonsbeslutningen', detail: 'internal_error' });
      }
    },
  );

  router.get('/projects/:projectId/locations/:locationId/media', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const { projectId, locationId } = req.params;
      if (!(await ensureProductionAccess(req, res, projectId, 'read'))) return;
      const location = await pool.query(
        'SELECT 1 FROM casting_locations WHERE project_id = $1 AND id = $2 LIMIT 1',
        [projectId, locationId],
      );
      if (location.rowCount === 0) { res.status(404).json({ error: 'not_found' }); return; }
      res.json({ media: await listLocationScoutMediaAdapter(pool, { projectId, locationId }) });
    } catch {
      res.status(500).json({ error: 'Kunne ikke hente scout-filer', detail: 'internal_error' });
    }
  });

  router.post(
    '/projects/:projectId/locations/:locationId/media',
    auth,
    locationScoutMediaUploadLimiter,
    async (req, res, next) => {
      try {
        await schemaReady(pool);
        const { projectId, locationId } = req.params;
        if (!(await ensureLocationManagementAccess(req, res, projectId))) return;
        const location = await pool.query(
          'SELECT 1 FROM casting_locations WHERE project_id = $1 AND id = $2 LIMIT 1',
          [projectId, locationId],
        );
        if (location.rowCount === 0) { res.status(404).json({ error: 'not_found' }); return; }
        next();
      } catch {
        res.status(500).json({ error: 'Kunne ikke kontrollere medietilgang', detail: 'internal_error' });
      }
    },
    receiveLocationScoutMedia,
    async (req, res) => {
      const uploadRequest = req as LocationScoutMediaRequest;
      const file = uploadRequest.file;
      if (!file?.path || file.size < 1) {
        res.status(400).json({ error: 'missing_file', message: 'Velg en scout-fil.' });
        return;
      }
      try {
        const inspected = await inspectLocationScoutMediaFile(file.path, file.mimetype, file.size);
        const normalizedUpload = normalizeLocationScoutMediaUpload(uploadRequest.body ?? {}, inspected.kind);
        const result = await uploadLocationScoutMedia(pool, {
          userId: uploadRequest.userId,
          projectId: String(req.params.projectId),
          locationId: String(req.params.locationId),
          clientUploadId: normalizedUpload.clientUploadId,
          kind: normalizedUpload.kind,
          captureMetadata: normalizedUpload.captureMetadata,
          displayName: String(file.originalname || 'scout-fil').slice(0, 255),
          filePath: file.path,
          sizeBytes: file.size,
          contentType: inspected.contentType,
        });
        if (!result.ok) {
          res.status(result.reason === 'storage_not_configured' ? 503 : 502).json({
            error: result.reason,
            message: result.reason === 'storage_not_configured'
              ? 'Role Room S3-lagring er ikke konfigurert.'
              : 'Kunne ikke laste opp scout-filen.',
          });
          return;
        }
        res.status(result.deduplicated ? 200 : 201).json({ media: result.media, deduplicated: result.deduplicated === true });
      } catch (error) {
        if (error instanceof LocationScoutMediaValidationError) {
          res.status(415).json({ error: 'unsupported_media', message: error.message });
          return;
        }
        if (error instanceof ProductionManagementValidationError) {
          res.status(400).json({ error: 'invalid_payload', message: error.message });
          return;
        }
        res.status(500).json({ error: 'upload_failed', message: 'Kunne ikke laste opp scout-filen.' });
      } finally {
        await unlink(file.path).catch(() => {});
      }
    },
  );

  router.get('/projects/:projectId/locations/:locationId/media/:fileId/url', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const { projectId, locationId, fileId } = req.params;
      if (!(await ensureProductionAccess(req, res, projectId, 'read'))) return;
      if (!isUuid(fileId)) { res.status(404).json({ error: 'not_found' }); return; }
      const result = await getLocationScoutMediaDownloadUrlAdapter(pool, {
        projectId,
        locationId,
        fileId,
        expiresInSeconds: 300,
      });
      if (!result.ok) {
        res.status(result.reason === 'not_found' ? 404 : 503).json({
          error: result.reason === 'not_found' ? 'not_found' : 'storage_unavailable',
        });
        return;
      }
      res.json({
        url: result.url,
        displayName: result.displayName,
        contentType: result.contentType,
        sizeBytes: result.sizeBytes,
        expiresInSeconds: 300,
      });
    } catch {
      res.status(500).json({ error: 'Kunne ikke åpne scout-filen', detail: 'internal_error' });
    }
  });

  // ────────────── PROPS ──────────────
  router.get('/projects/:projectId/props', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      if (!(await ensureProjectOwner(req, res, req.params.projectId))) return;
      const result = await pool.query(
        'SELECT * FROM casting_props WHERE project_id = $1 ORDER BY created_at',
        [req.params.projectId],
      );
      res.json({ props: result.rows.map(mapPropRow) });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente props', detail: "internal_error" });
    }
  });

  router.post('/props', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const b = (req.body ?? {}) as Record<string, any>;
      const projectId = b.projectId || b.project_id;
      if (!projectId) { res.status(400).json({ error: 'projectId er påkrevd' }); return; }
      if (!(await ensureProjectOwner(req, res, projectId))) return;
      const id = String(b.id || genId('prop'));
      const images = JSON.stringify(asArray(b.images));
      const availability = typeof b.availability === 'string' ? b.availability : null;
      const quantity = Number.isFinite(Number(b.quantity)) ? Number(b.quantity) : 1;
      const result = await pool.query(
        `INSERT INTO casting_props
           (id, project_id, name, category, description, images, availability, quantity, data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           project_id = EXCLUDED.project_id, name = EXCLUDED.name, category = EXCLUDED.category,
           description = EXCLUDED.description, images = EXCLUDED.images, availability = EXCLUDED.availability,
           quantity = EXCLUDED.quantity, data = EXCLUDED.data, updated_at = NOW()
         RETURNING *`,
        [id, projectId, b.name || 'Uten navn', b.category ?? null, b.description ?? null,
         images, availability, quantity, JSON.stringify(b)],
      );
      res.status(201).json({ prop: mapPropRow(result.rows[0]) });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke lagre prop', detail: "internal_error" });
    }
  });

  router.delete('/props/:propId', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const owns = await pool.query<{ project_id: string }>(
        'SELECT project_id FROM casting_props WHERE id = $1',
        [req.params.propId],
      );
      if (owns.rowCount === 0) { res.status(404).json({ error: 'Prop ikke funnet' }); return; }
      if (!(await ensureProjectOwner(req, res, owns.rows[0].project_id))) return;
      const result = await pool.query('DELETE FROM casting_props WHERE id = $1', [req.params.propId]);
      if (result.rowCount === 0) { res.status(404).json({ error: 'Prop ikke funnet' }); return; }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke slette prop', detail: "internal_error" });
    }
  });

  // ────────────── PRODUCTION DAYS ──────────────
  router.get('/projects/:projectId/production-days', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      if (!(await ensureProductionAccess(req, res, req.params.projectId, 'read'))) return;
      const result = await pool.query(
        'SELECT * FROM casting_production_days WHERE project_id = $1 ORDER BY date',
        [req.params.projectId],
      );
      res.json({ productionDays: result.rows.map(mapDayRow) });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke hente produksjonsdager', detail: "internal_error" });
    }
  });

  router.post('/production-days', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const b = (req.body ?? {}) as Record<string, any>;
      const projectId = b.projectId || b.project_id;
      if (!projectId) { res.status(400).json({ error: 'projectId er påkrevd' }); return; }
      if (!(await ensureProductionAccess(req, res, projectId, 'write'))) return;
      const id = String(b.id || genId('pday'));
      const safeData = productionDayDataWithoutProtectedOperations(b);
      const result = await pool.query(
        `INSERT INTO casting_production_days
           (id, project_id, date, scene_ids, crew_ids, location_id, prop_ids, status, notes, weather_forecast, data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           project_id = EXCLUDED.project_id, date = EXCLUDED.date, scene_ids = EXCLUDED.scene_ids,
           crew_ids = EXCLUDED.crew_ids, location_id = EXCLUDED.location_id, prop_ids = EXCLUDED.prop_ids,
           status = EXCLUDED.status, notes = EXCLUDED.notes, weather_forecast = EXCLUDED.weather_forecast,
           data = EXCLUDED.data || CASE
             WHEN casting_production_days.data ? 'productionManagement'
             THEN jsonb_build_object('productionManagement', casting_production_days.data -> 'productionManagement')
             ELSE '{}'::jsonb
           END || CASE
             WHEN casting_production_days.data ? 'productionCoordination'
             THEN jsonb_build_object('productionCoordination', casting_production_days.data -> 'productionCoordination')
             ELSE '{}'::jsonb
           END || CASE
             WHEN casting_production_days.data ? 'productionContinuity'
             THEN jsonb_build_object('productionContinuity', casting_production_days.data -> 'productionContinuity')
             ELSE '{}'::jsonb
           END,
           updated_at = NOW()
         WHERE casting_production_days.project_id = EXCLUDED.project_id
         RETURNING *`,
        [
          id, projectId, toDateString(b.date),
          JSON.stringify(asArray(b.scenes ?? b.scene_ids)),
          JSON.stringify(asArray(b.crew ?? b.crew_ids)),
          b.locationId || b.location_id || null,
          JSON.stringify(asArray(b.props ?? b.prop_ids)),
          b.status || 'planned',
          b.notes ?? null,
          b.weatherForecast ? JSON.stringify(b.weatherForecast) : null,
          JSON.stringify(safeData),
        ],
      );
      if (result.rowCount === 0) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      // Riggen dagen bærer er en booking. Tabellen og hele maskineriet rundt
      // den — tilgjengelighet, konfliktsjekk — har ligget ubrukt fordi
      // ingenting skrev til den. Dette er skriveren.
      const savedDay = mapDayRow(result.rows[0]) as Record<string, unknown>;
      try {
        await syncProductionDayEquipmentBookings(pool, {
          projectId,
          dayId: id,
          date: toDateString(b.date),
          equipmentIds: asArray(savedDay.equipment).map((itemId) => String(itemId)),
          bookedBy: (req as AuthedRequest).userId,
        });
      } catch {
        // Dagen er lagret. En feilet bookingsynk skal ikke rulle den tilbake,
        // men den skal heller ikke se ut som om riggen er sikret.
        res.status(201).json({ productionDay: savedDay, equipmentBookingsSynced: false });
        return;
      }
      res.status(201).json({ productionDay: savedDay, equipmentBookingsSynced: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke lagre produksjonsdag', detail: "internal_error" });
    }
  });

  router.patch('/projects/:projectId/production-days/:dayId/production-management', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const { projectId, dayId } = req.params;
      if (!(await ensureProductionManagementAccess(req, res, projectId))) return;

      const body = asObject(req.body);
      if (!body || Buffer.byteLength(JSON.stringify(body), 'utf8') > 128 * 1024) {
        res.status(400).json({ error: 'invalid_payload', message: 'Dagskontrollen er ugyldig eller for stor.' });
        return;
      }
      const expectedVersion = Number(body.expectedVersion);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
        res.status(400).json({ error: 'invalid_payload', message: 'expectedVersion må være et ikke-negativt heltall.' });
        return;
      }
      const normalized = normalizeProductionManagementOperations(body.operations);
      const currentResult = await pool.query(
        'SELECT * FROM casting_production_days WHERE project_id = $1 AND id = $2',
        [projectId, dayId],
      );
      if (currentResult.rowCount === 0) {
        res.status(404).json({ error: 'Produksjonsdag ikke funnet' });
        return;
      }

      const currentRow = currentResult.rows[0] as Record<string, any>;
      const currentVersion = Number(currentRow.management_version ?? 0);
      if (currentVersion !== expectedVersion) {
        sendVersionConflict(res, 'production_management', 'Dagskontrollen er endret av en annen bruker.', mapDayRow(currentRow));
        return;
      }

      const assignedCrewIds = new Set(asArray(currentRow.crew_ids).map((crewId) => String(crewId)));
      if (normalized.crewConfirmations.some((entry) => !assignedCrewIds.has(entry.crewId))) {
        res.status(400).json({
          error: 'invalid_payload',
          message: 'Crew-bekreftelser kan bare registreres for crew som er tildelt produksjonsdagen.',
        });
        return;
      }

      const previousOperations = asObject(asObject(currentRow.data)?.productionManagement);
      const previousActivity = Array.isArray(previousOperations?.activity)
        ? previousOperations.activity
            .map((entry: unknown) => {
              const item = asObject(entry);
              const id = typeof item?.id === 'string' ? item.id.trim().slice(0, 120) : '';
              const message = typeof item?.message === 'string' ? item.message.trim().slice(0, 300) : '';
              const createdAt = typeof item?.createdAt === 'string' ? item.createdAt.trim().slice(0, 40) : '';
              if (!id || !message || !createdAt) return null;
              return {
                id,
                type: 'workspace_saved',
                message,
                actorUserId: item?.actorUserId ? String(item.actorUserId).slice(0, 255) : undefined,
                createdAt,
              };
            })
            .filter((entry) => entry !== null)
            .slice(-99)
        : [];
      const actorUserId = (req as AuthedRequest).userId;
      const nextOperations = {
        ...normalized,
        activity: [...previousActivity, {
          id: genId('pm-activity'),
          type: 'workspace_saved',
          message: summarizeManagementChanges(previousOperations, normalized),
          actorUserId,
          createdAt: new Date().toISOString(),
        }],
      };
      const updateResult = await pool.query(
        `UPDATE casting_production_days
         SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{productionManagement}', $4::jsonb, true),
             management_version = management_version + 1,
             management_updated_by = $5,
             management_updated_at = NOW(),
             updated_at = NOW()
         WHERE project_id = $1 AND id = $2 AND management_version = $3
         RETURNING *`,
        [projectId, dayId, expectedVersion, JSON.stringify(nextOperations), actorUserId],
      );
      if (updateResult.rowCount === 0) {
        const latest = await pool.query(
          'SELECT * FROM casting_production_days WHERE project_id = $1 AND id = $2',
          [projectId, dayId],
        );
        if (latest.rowCount === 0) {
          res.status(404).json({ error: 'Produksjonsdag ikke funnet' });
          return;
        }
        sendVersionConflict(res, 'production_management', 'Dagskontrollen er endret av en annen bruker.', mapDayRow(latest.rows[0]));
        return;
      }
      res.json({ productionDay: mapDayRow(updateResult.rows[0]) });
    } catch (err) {
      if (err instanceof ProductionManagementValidationError) {
        res.status(400).json({ error: 'invalid_payload', message: err.message });
        return;
      }
      res.status(500).json({ error: 'Kunne ikke lagre dagskontrollen', detail: 'internal_error' });
    }
  });

  router.patch('/projects/:projectId/production-days/:dayId/production-coordination', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const { projectId, dayId } = req.params;
      if (!(await ensureProductionCoordinationAccess(req, res, projectId))) return;

      const body = asObject(req.body);
      if (!body || Buffer.byteLength(JSON.stringify(body), 'utf8') > 128 * 1024) {
        res.status(400).json({ error: 'invalid_payload', message: 'Koordinatorflaten er ugyldig eller for stor.' });
        return;
      }
      const expectedVersion = Number(body.expectedVersion);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
        res.status(400).json({ error: 'invalid_payload', message: 'expectedVersion må være et ikke-negativt heltall.' });
        return;
      }
      const normalized = normalizeProductionCoordinationOperations(body.operations);
      const currentResult = await pool.query(
        'SELECT * FROM casting_production_days WHERE project_id = $1 AND id = $2',
        [projectId, dayId],
      );
      if (currentResult.rowCount === 0) {
        res.status(404).json({ error: 'Produksjonsdag ikke funnet' });
        return;
      }

      const currentRow = currentResult.rows[0] as Record<string, any>;
      const currentVersion = Number(currentRow.coordination_version ?? 0);
      if (currentVersion !== expectedVersion) {
        sendVersionConflict(res, 'production_coordination', 'Koordinatorflaten er endret av en annen bruker.', mapDayRow(currentRow));
        return;
      }

      const assignedCrewIds = new Set(asArray(currentRow.crew_ids).map((crewId) => String(crewId)));
      if (normalized.crewFollowUps.some((entry) => !assignedCrewIds.has(entry.crewId))) {
        res.status(400).json({
          error: 'invalid_payload',
          message: 'Crewoppfølging kan bare registreres for crew som er tildelt produksjonsdagen.',
        });
        return;
      }

      const previousOperations = asObject(asObject(currentRow.data)?.productionCoordination);
      const previousActivity = Array.isArray(previousOperations?.activity)
        ? previousOperations.activity
            .map((entry: unknown) => {
              const item = asObject(entry);
              const id = typeof item?.id === 'string' ? item.id.trim().slice(0, 120) : '';
              const message = typeof item?.message === 'string' ? item.message.trim().slice(0, 300) : '';
              const createdAt = typeof item?.createdAt === 'string' ? item.createdAt.trim().slice(0, 40) : '';
              if (!id || !message || !createdAt) return null;
              return {
                id,
                type: 'workspace_saved',
                message,
                actorUserId: item?.actorUserId ? String(item.actorUserId).slice(0, 255) : undefined,
                createdAt,
              };
            })
            .filter((entry) => entry !== null)
            .slice(-99)
        : [];
      const actorUserId = (req as AuthedRequest).userId;
      const nextOperations = {
        ...normalized,
        activity: [...previousActivity, {
          id: genId('pc-activity'),
          type: 'workspace_saved',
          message: summarizeCoordinationChanges(previousOperations, normalized),
          actorUserId,
          createdAt: new Date().toISOString(),
        }],
      };
      const updateResult = await pool.query(
        `UPDATE casting_production_days
         SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{productionCoordination}', $4::jsonb, true),
             coordination_version = coordination_version + 1,
             coordination_updated_by = $5,
             coordination_updated_at = NOW(),
             updated_at = NOW()
         WHERE project_id = $1 AND id = $2 AND coordination_version = $3
         RETURNING *`,
        [projectId, dayId, expectedVersion, JSON.stringify(nextOperations), actorUserId],
      );
      if (updateResult.rowCount === 0) {
        const latest = await pool.query(
          'SELECT * FROM casting_production_days WHERE project_id = $1 AND id = $2',
          [projectId, dayId],
        );
        if (latest.rowCount === 0) {
          res.status(404).json({ error: 'Produksjonsdag ikke funnet' });
          return;
        }
        sendVersionConflict(res, 'production_coordination', 'Koordinatorflaten er endret av en annen bruker.', mapDayRow(latest.rows[0]));
        return;
      }
      res.json({ productionDay: mapDayRow(updateResult.rows[0]) });
    } catch (err) {
      if (err instanceof ProductionManagementValidationError) {
        res.status(400).json({ error: 'invalid_payload', message: err.message });
        return;
      }
      res.status(500).json({ error: 'Kunne ikke lagre koordinatorflaten', detail: 'internal_error' });
    }
  });

  router.patch('/projects/:projectId/production-days/:dayId/continuity', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const { projectId, dayId } = req.params;
      if (!(await ensureContinuityAccess(req, res, projectId, 'manage'))) return;

      const body = asObject(req.body);
      if (!body || Buffer.byteLength(JSON.stringify(body), 'utf8') > 256 * 1024) {
        res.status(400).json({ error: 'invalid_payload', message: 'Kontinuitetsloggen er ugyldig eller for stor.' });
        return;
      }
      const expectedVersion = Number(body.expectedVersion);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
        res.status(400).json({ error: 'invalid_payload', message: 'expectedVersion må være et ikke-negativt heltall.' });
        return;
      }
      const normalized = normalizeProductionContinuityOperations(body.operations);
      const currentResult = await pool.query(
        'SELECT * FROM casting_production_days WHERE project_id = $1 AND id = $2',
        [projectId, dayId],
      );
      if (currentResult.rowCount === 0) {
        res.status(404).json({ error: 'Produksjonsdag ikke funnet' });
        return;
      }

      const currentRow = currentResult.rows[0] as Record<string, any>;
      const currentVersion = Number(currentRow.continuity_version ?? 0);
      if (currentVersion !== expectedVersion) {
        sendVersionConflict(res, 'continuity', 'Kontinuitetsloggen er endret av en annen bruker.', mapDayRow(currentRow));
        return;
      }

      const assignedSceneIds = new Set(asArray(currentRow.scene_ids).map((sceneId) => String(sceneId)));
      if (
        normalized.sceneRecords.length !== assignedSceneIds.size
        || normalized.sceneRecords.some((entry) => !assignedSceneIds.has(entry.sceneId))
      ) {
        res.status(400).json({
          error: 'invalid_payload',
          message: 'Kontinuitet kan bare registreres for scener som er tildelt produksjonsdagen.',
        });
        return;
      }

      const storageFileIds = [...new Set(normalized.entries.flatMap((entry) =>
        entry.references.flatMap((reference) => reference.storageFileId ? [reference.storageFileId] : []),
      ))];
      if (storageFileIds.length > 0) {
        const mediaResult = await pool.query<{
          id: string;
          display_name: string;
          content_type: string;
          size_bytes: string;
          scene_id: string;
        }>(
          `SELECT id::text AS id, display_name, content_type, size_bytes, scene_id
             FROM casting_production_continuity_media
            WHERE id = ANY($1::uuid[])
              AND project_id = $2
              AND production_day_id = $3
              AND storage_provider = 'aws_s3'
              AND content_type = ANY($4::text[])
              AND deleted_at IS NULL`,
          [storageFileIds, projectId, dayId, [...CONTINUITY_MEDIA_MIME_TYPES]],
        );
        if (mediaResult.rows.length !== storageFileIds.length) {
          res.status(400).json({
            error: 'invalid_payload',
            message: 'En eller flere mediereferanser tilhører ikke denne produksjonsdagen.',
          });
          return;
        }
        const mediaById = new Map(mediaResult.rows.map((row) => [row.id, row]));
        const hasSceneMismatch = normalized.entries.some((entry) => entry.references.some((reference) =>
          reference.storageFileId && mediaById.get(reference.storageFileId)?.scene_id !== entry.sceneId,
        ));
        if (hasSceneMismatch) {
          res.status(400).json({
            error: 'invalid_payload',
            message: 'En mediereferanse er knyttet til en annen scene.',
          });
          return;
        }
        for (const entry of normalized.entries) {
          for (const reference of entry.references) {
            if (!reference.storageFileId) continue;
            const stored = mediaById.get(reference.storageFileId);
            if (!stored) continue;
            reference.kind = stored.content_type.startsWith('image/') ? 'photo' : 'video';
            reference.storageProvider = 'aws_s3';
            reference.contentType = stored.content_type;
            reference.sizeBytes = Number(stored.size_bytes);
            reference.label = stored.display_name.slice(0, 160);
          }
        }
      }

      const previousOperations = continuityObject(continuityObject(currentRow.data)?.productionContinuity);
      const previousActivity = readContinuityActivity(previousOperations?.activity);
      const previousComments = readContinuityComments(previousOperations?.comments);
      const previousRevisions = readContinuityRevisions(previousOperations?.revisions);
      let previousSnapshot: ReturnType<typeof normalizeProductionContinuityOperations> | null = null;
      if (previousOperations) {
        try {
          previousSnapshot = normalizeProductionContinuityOperations(previousOperations);
        } catch {
          previousSnapshot = null;
        }
      }
      const actorUserId = (req as AuthedRequest).userId;
      const now = new Date().toISOString();
      const changeMessage = summarizeContinuityChanges(previousOperations, normalized);
      const revisions = previousSnapshot
        ? [...previousRevisions, {
            id: genId('continuity-revision'),
            version: currentVersion,
            message: `Versjon ${currentVersion} før ${changeMessage.toLocaleLowerCase('nb-NO')}`,
            actorUserId: currentRow.continuity_updated_by ?? undefined,
            createdAt: currentRow.continuity_updated_at ?? now,
            snapshot: previousSnapshot,
          }].slice(-8)
        : previousRevisions;
      const nextOperations = {
        ...normalized,
        comments: previousComments,
        revisions,
        activity: [...previousActivity, {
          id: genId('continuity-activity'),
          type: 'workspace_saved',
          message: changeMessage,
          actorUserId,
          createdAt: now,
        }].slice(-100),
      };
      const updateResult = await pool.query(
        `UPDATE casting_production_days
         SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{productionContinuity}', $4::jsonb, true),
             continuity_version = continuity_version + 1,
             continuity_updated_by = $5,
             continuity_updated_at = NOW(),
             updated_at = NOW()
         WHERE project_id = $1 AND id = $2 AND continuity_version = $3
         RETURNING *`,
        [projectId, dayId, expectedVersion, JSON.stringify(nextOperations), actorUserId],
      );
      if (updateResult.rowCount === 0) {
        const latest = await pool.query(
          'SELECT * FROM casting_production_days WHERE project_id = $1 AND id = $2',
          [projectId, dayId],
        );
        if (latest.rowCount === 0) {
          res.status(404).json({ error: 'Produksjonsdag ikke funnet' });
          return;
        }
        sendVersionConflict(res, 'continuity', 'Kontinuitetsloggen er endret av en annen bruker.', mapDayRow(latest.rows[0]));
        return;
      }
      res.json({ productionDay: mapDayRow(updateResult.rows[0]) });
    } catch (err) {
      if (err instanceof ProductionContinuityValidationError) {
        res.status(400).json({ error: 'invalid_payload', message: err.message });
        return;
      }
      res.status(500).json({ error: 'Kunne ikke lagre kontinuitetsloggen', detail: 'internal_error' });
    }
  });

  router.post('/projects/:projectId/production-days/:dayId/continuity/comments', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const { projectId, dayId } = req.params;
      if (!(await ensureContinuityAccess(req, res, projectId, 'comment'))) return;
      const body = asObject(req.body);
      if (!body || Buffer.byteLength(JSON.stringify(body), 'utf8') > 8 * 1024) {
        res.status(400).json({ error: 'invalid_payload', message: 'Kommentaren er ugyldig eller for stor.' });
        return;
      }
      const expectedVersion = Number(body.expectedVersion);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
        res.status(400).json({ error: 'invalid_payload', message: 'expectedVersion må være et ikke-negativt heltall.' });
        return;
      }
      const commentInput = normalizeContinuityComment(body.comment);
      const currentResult = await pool.query(
        'SELECT * FROM casting_production_days WHERE project_id = $1 AND id = $2',
        [projectId, dayId],
      );
      if (currentResult.rowCount === 0) {
        res.status(404).json({ error: 'Produksjonsdag ikke funnet' });
        return;
      }
      const currentRow = currentResult.rows[0] as Record<string, any>;
      const currentVersion = Number(currentRow.continuity_version ?? 0);
      if (currentVersion !== expectedVersion) {
        sendVersionConflict(res, 'continuity', 'Kontinuitetsloggen er endret av en annen bruker.', mapDayRow(currentRow));
        return;
      }
      const assignedSceneIds = new Set(asArray(currentRow.scene_ids).map((sceneId) => String(sceneId)));
      if (commentInput.sceneId && !assignedSceneIds.has(commentInput.sceneId)) {
        res.status(400).json({ error: 'invalid_payload', message: 'Kommentaren peker på en scene utenfor produksjonsdagen.' });
        return;
      }

      const previousOperations = continuityObject(continuityObject(currentRow.data)?.productionContinuity);
      let core: ReturnType<typeof normalizeProductionContinuityOperations>;
      try {
        core = normalizeProductionContinuityOperations(previousOperations);
      } catch {
        core = normalizeProductionContinuityOperations({
          sceneRecords: [...assignedSceneIds].map((sceneId) => ({ sceneId, status: 'not_started' })),
          takes: [], entries: [], deviations: [],
        });
      }
      const takeById = new Map(core.takes.map((take) => [take.id, take]));
      if (commentInput.takeId && !takeById.has(commentInput.takeId)) {
        res.status(400).json({ error: 'invalid_payload', message: 'Kommentaren peker på en take som ikke finnes.' });
        return;
      }
      if (commentInput.takeId && commentInput.sceneId && takeById.get(commentInput.takeId)?.sceneId !== commentInput.sceneId) {
        res.status(400).json({ error: 'invalid_payload', message: 'Kommentaren peker på en take i en annen scene.' });
        return;
      }
      const actorUserId = (req as AuthedRequest).userId;
      const now = new Date().toISOString();
      const comment = {
        id: genId('continuity-comment'),
        ...commentInput,
        actorUserId,
        createdAt: now,
      };
      const nextOperations = {
        ...core,
        comments: [...readContinuityComments(previousOperations?.comments), comment].slice(-500),
        revisions: readContinuityRevisions(previousOperations?.revisions),
        activity: [...readContinuityActivity(previousOperations?.activity), {
          id: genId('continuity-activity'),
          type: 'comment_added',
          message: commentInput.sceneId ? `La til kommentar på scene ${commentInput.sceneId}.` : 'La til kommentar på produksjonsdagen.',
          actorUserId,
          createdAt: now,
        }].slice(-100),
      };
      const updateResult = await pool.query(
        `UPDATE casting_production_days
         SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{productionContinuity}', $4::jsonb, true),
             continuity_version = continuity_version + 1,
             continuity_updated_by = $5,
             continuity_updated_at = NOW(),
             updated_at = NOW()
         WHERE project_id = $1 AND id = $2 AND continuity_version = $3
         RETURNING *`,
        [projectId, dayId, expectedVersion, JSON.stringify(nextOperations), actorUserId],
      );
      if (updateResult.rowCount === 0) {
        const latest = await pool.query(
          'SELECT * FROM casting_production_days WHERE project_id = $1 AND id = $2',
          [projectId, dayId],
        );
        if (latest.rowCount === 0) {
          res.status(404).json({ error: 'Produksjonsdag ikke funnet' });
          return;
        }
        sendVersionConflict(res, 'continuity', 'Kontinuitetsloggen er endret av en annen bruker.', mapDayRow(latest.rows[0]));
        return;
      }
      res.status(201).json({ productionDay: mapDayRow(updateResult.rows[0]), comment });
    } catch (err) {
      if (err instanceof ProductionContinuityValidationError) {
        res.status(400).json({ error: 'invalid_payload', message: err.message });
        return;
      }
      res.status(500).json({ error: 'Kunne ikke lagre kommentaren', detail: 'internal_error' });
    }
  });

  router.post(
    '/projects/:projectId/production-days/:dayId/continuity/media',
    auth,
    async (req, res, next) => {
      try {
        await schemaReady(pool);
        if (!(await ensureContinuityAccess(req, res, req.params.projectId, 'manage'))) return;
        next();
      } catch {
        res.status(500).json({ error: 'Kunne ikke kontrollere medietilgang', detail: 'internal_error' });
      }
    },
    receiveContinuityMedia,
    async (req, res) => {
      const uploadRequest = req as ContinuityMediaRequest;
      const file = uploadRequest.file;
      if (!file?.path || file.size < 1) {
        res.status(400).json({ error: 'missing_file', message: 'Velg et bilde eller en video.' });
        return;
      }
      try {
        const projectId = String(req.params.projectId);
        const dayId = String(req.params.dayId);
        const sceneId = typeof req.body?.sceneId === 'string' ? req.body.sceneId.trim().slice(0, 255) : '';
        if (!sceneId) {
          res.status(400).json({ error: 'invalid_payload', message: 'sceneId er påkrevd.' });
          return;
        }
        const dayResult = await pool.query(
          'SELECT scene_ids FROM casting_production_days WHERE project_id = $1 AND id = $2',
          [projectId, dayId],
        );
        if (dayResult.rowCount === 0) {
          res.status(404).json({ error: 'Produksjonsdag ikke funnet' });
          return;
        }
        const assignedScenes = new Set(asArray(dayResult.rows[0].scene_ids).map((id) => String(id)));
        if (!assignedScenes.has(sceneId)) {
          res.status(400).json({ error: 'invalid_payload', message: 'Mediet må knyttes til en scene på produksjonsdagen.' });
          return;
        }

        const inspected = await inspectContinuityMediaFile(file.path, file.mimetype, file.size);
        const result = await uploadContinuityMedia(pool, {
          userId: uploadRequest.userId,
          projectId,
          productionDayId: dayId,
          sceneId,
          displayName: String(file.originalname || 'kontinuitetsreferanse').slice(0, 255),
          filePath: file.path,
          sizeBytes: file.size,
          contentType: inspected.contentType,
          kind: inspected.kind,
        });
        if (!result.ok) {
          if (result.reason === 'storage_not_configured') {
            res.status(503).json({ error: 'storage_not_configured', message: 'Medielagring er ikke konfigurert.' });
            return;
          }
          res.status(502).json({ error: 'upload_failed', message: 'Kunne ikke laste opp mediet.' });
          return;
        }
        res.status(201).json({
          reference: {
            id: result.media.id,
            kind: inspected.kind,
            storageFileId: result.media.id,
            storageProvider: 'aws_s3',
            contentType: inspected.contentType,
            sizeBytes: result.media.sizeBytes,
            label: result.media.displayName.slice(0, 160),
          },
        });
      } catch (error) {
        if (error instanceof ProductionContinuityMediaValidationError) {
          res.status(415).json({ error: 'unsupported_media', message: error.message });
          return;
        }
        res.status(500).json({ error: 'upload_failed', message: 'Kunne ikke laste opp mediet.' });
      } finally {
        await unlink(file.path).catch(() => {});
      }
    },
  );

  router.get('/projects/:projectId/production-days/:dayId/continuity/media/:fileId/url', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const projectId = String(req.params.projectId);
      const dayId = String(req.params.dayId);
      const fileId = String(req.params.fileId);
      if (!(await ensureProductionAccess(req, res, projectId, 'read'))) return;
      if (!isUuid(fileId)) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const result = await getContinuityMediaDownloadUrl(pool, {
        fileId,
        projectId,
        productionDayId: dayId,
        expiresInSeconds: 300,
      });
      if (!result.ok) {
        res.status(result.reason === 'not_found' ? 404 : 503).json({
          error: result.reason === 'not_found' ? 'not_found' : 'storage_unavailable',
        });
        return;
      }
      res.json({
        url: result.url,
        displayName: result.displayName,
        contentType: result.contentType,
        sizeBytes: result.sizeBytes,
        expiresInSeconds: 300,
      });
    } catch {
      res.status(500).json({ error: 'Kunne ikke åpne mediet', detail: 'internal_error' });
    }
  });

  router.delete('/production-days/:dayId', auth, async (req, res) => {
    try {
      await schemaReady(pool);
      const owns = await pool.query<{ project_id: string }>(
        'SELECT project_id FROM casting_production_days WHERE id = $1',
        [req.params.dayId],
      );
      if (owns.rowCount === 0) { res.status(404).json({ error: 'Produksjonsdag ikke funnet' }); return; }
      if (!(await ensureProductionAccess(req, res, owns.rows[0].project_id, 'write'))) return;
      const result = await pool.query('DELETE FROM casting_production_days WHERE id = $1', [req.params.dayId]);
      if (result.rowCount === 0) { res.status(404).json({ error: 'Produksjonsdag ikke funnet' }); return; }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Kunne ikke slette produksjonsdag', detail: "internal_error" });
    }
  });

  return router;
}
