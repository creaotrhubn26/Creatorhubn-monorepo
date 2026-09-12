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
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { unlink } from 'node:fs/promises';
import multer from 'multer';
import { loadPersistedAuthSession } from './auth-session-store.js';
import {
  userCanAccessCastingProject,
  userCanCommentCastingContinuity,
  userCanCoordinateCastingProduction,
  userCanEditCastingProduction,
  userCanManageCastingContinuity,
  userCanManageCastingProduction,
  userOwnsCastingProject,
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

export interface CreateCastingProductionRouterDeps {
  activeSessions?: Map<string, SessionData>;
  uploadContinuityMedia?: typeof uploadContinuityMediaToS3;
  getContinuityMediaDownloadUrl?: typeof getContinuityMediaS3DownloadUrl;
}

export function createCastingProductionRouter(
  pool: Pool,
  deps: CreateCastingProductionRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);
  const uploadContinuityMedia = deps.uploadContinuityMedia ?? uploadContinuityMediaToS3;
  const getContinuityMediaDownloadUrl = deps.getContinuityMediaDownloadUrl ?? getContinuityMediaS3DownloadUrl;

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

  async function ensureProductionAccess(
    req: Request,
    res: Response,
    projectId: unknown,
    mode: 'read' | 'write',
  ): Promise<boolean> {
    const userId = (req as AuthedRequest).userId;
    const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
    const allowed = normalizedProjectId
      ? mode === 'write'
        ? await userCanEditCastingProduction(pool, normalizedProjectId, userId)
        : await userCanAccessCastingProject(pool, normalizedProjectId, userId)
      : false;
    if (!allowed) {
      // Keep project existence private across tenants.
      res.status(404).json({ error: 'not_found' });
      return false;
    }
    return true;
  }

  async function ensureProductionManagementAccess(
    req: Request,
    res: Response,
    projectId: unknown,
  ): Promise<boolean> {
    const userId = (req as AuthedRequest).userId;
    const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
    const allowed = normalizedProjectId
      ? await userCanManageCastingProduction(pool, normalizedProjectId, userId)
      : false;
    if (!allowed) {
      res.status(404).json({ error: 'not_found' });
      return false;
    }
    return true;
  }

  async function ensureProductionCoordinationAccess(
    req: Request,
    res: Response,
    projectId: unknown,
  ): Promise<boolean> {
    const userId = (req as AuthedRequest).userId;
    const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
    const allowed = normalizedProjectId
      ? await userCanCoordinateCastingProduction(pool, normalizedProjectId, userId)
      : false;
    if (!allowed) {
      res.status(404).json({ error: 'not_found' });
      return false;
    }
    return true;
  }

  async function ensureContinuityAccess(
    req: Request,
    res: Response,
    projectId: unknown,
    mode: 'manage' | 'comment',
  ): Promise<boolean> {
    const userId = (req as AuthedRequest).userId;
    const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : '';
    const allowed = normalizedProjectId
      ? mode === 'manage'
        ? await userCanManageCastingContinuity(pool, normalizedProjectId, userId)
        : await userCanCommentCastingContinuity(pool, normalizedProjectId, userId)
      : false;
    if (!allowed) {
      res.status(404).json({ error: 'not_found' });
      return false;
    }
    return true;
  }

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
      res.status(201).json({ productionDay: mapDayRow(result.rows[0]) });
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
        res.status(409).json({
          error: 'version_conflict',
          message: 'Dagskontrollen er endret av en annen bruker.',
          productionDay: mapDayRow(currentRow),
        });
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
        res.status(409).json({
          error: 'version_conflict',
          message: 'Dagskontrollen er endret av en annen bruker.',
          productionDay: mapDayRow(latest.rows[0]),
        });
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
        res.status(409).json({
          error: 'version_conflict',
          message: 'Koordinatorflaten er endret av en annen bruker.',
          productionDay: mapDayRow(currentRow),
        });
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
        res.status(409).json({
          error: 'version_conflict',
          message: 'Koordinatorflaten er endret av en annen bruker.',
          productionDay: mapDayRow(latest.rows[0]),
        });
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
        res.status(409).json({
          error: 'version_conflict',
          message: 'Kontinuitetsloggen er endret av en annen bruker.',
          productionDay: mapDayRow(currentRow),
        });
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
        res.status(409).json({
          error: 'version_conflict',
          message: 'Kontinuitetsloggen er endret av en annen bruker.',
          productionDay: mapDayRow(latest.rows[0]),
        });
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
        res.status(409).json({
          error: 'version_conflict',
          message: 'Kontinuitetsloggen er endret av en annen bruker.',
          productionDay: mapDayRow(currentRow),
        });
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
        res.status(409).json({ error: 'version_conflict', message: 'Kontinuitetsloggen er endret av en annen bruker.', productionDay: mapDayRow(latest.rows[0]) });
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
