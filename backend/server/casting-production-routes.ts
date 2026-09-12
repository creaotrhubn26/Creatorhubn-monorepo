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
import { loadPersistedAuthSession } from './auth-session-store.js';
import {
  userCanAccessCastingProject,
  userCanCoordinateCastingProduction,
  userCanEditCastingProduction,
  userCanManageCastingProduction,
  userOwnsCastingProject,
} from './casting-project-ownership.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}
type AuthedRequest = Request & { userId: string };

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
    ADD COLUMN IF NOT EXISTS coordination_updated_at TIMESTAMPTZ`);
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
  return data;
}

export interface CreateCastingProductionRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createCastingProductionRouter(
  pool: Pool,
  deps: CreateCastingProductionRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

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
