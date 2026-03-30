import crypto from 'crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { QueryResultRow } from 'pg';
import { type Pool } from 'pg';
import { z } from 'zod';

type IntegrationAction = 'read' | 'write';

interface IntegrationApiKeyRow extends QueryResultRow {
  id: string;
  key_hash: string;
  name: string;
  user_id: string;
  scopes: unknown;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface IntegrationUserContext {
  apiKeyId: string;
  apiKeyName: string;
  userId: string;
  scopes: string[];
  accountId?: string | null;
  accountSlug?: string | null;
  accountName?: string | null;
  rateLimitPerMinute: number;
  isLegacyKey?: boolean;
}

interface IntegrationRequest extends Request {
  integrationUser?: IntegrationUserContext;
  requestId?: string;
}

interface ProjectRow extends QueryResultRow {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  created_by: string | null;
  genre: string | null;
  project_type: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: string | null;
  currency: string | null;
  settings: unknown;
  metadata: unknown;
  creatorhub_project_id: string | null;
  created_at: string;
  updated_at: string;
}

interface RoleRow extends QueryResultRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  age_range: string | null;
  gender: string | null;
  ethnicity: string | null;
  role_type: string | null;
  scene_ids: unknown;
  requirements: unknown;
  status: string | null;
  assigned_candidate_id: string | null;
  candidate_ids: unknown;
  created_at: string;
  updated_at: string;
}

interface CandidateRow extends QueryResultRow {
  id: string;
  project_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  agency: string | null;
  photos: unknown;
  videos: unknown;
  notes: string | null;
  status: string | null;
  assigned_roles: unknown;
  rating: number | null;
  metadata: unknown;
  emergency_contact: unknown;
  consent_status: string | null;
  created_at: string;
  updated_at: string;
}

interface CrewRow extends QueryResultRow {
  id: string;
  project_id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  rate: string | null;
  availability: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ScheduleRow extends QueryResultRow {
  id: string;
  project_id: string;
  candidate_id: string | null;
  role_id: string | null;
  scene_id: string | null;
  location_id: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  type: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientIntakeRow extends QueryResultRow {
  project_id: string;
  project_goal: string | null;
  deliverables: string | null;
  target_audience: string | null;
  key_message: string | null;
  timing_constraints: string | null;
  brand_notes: string | null;
  material_overview: string | null;
  reference_links: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  additional_notes: string | null;
  metadata: unknown;
  updated_by_user_id: string | null;
  updated_by_role: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientMaterialRow extends QueryResultRow {
  id: string;
  project_id: string;
  entry_type: string;
  title: string;
  description: string | null;
  external_url: string | null;
  phase: string | null;
  linked_shot_list_id: string | null;
  status: string | null;
  metadata: unknown;
  created_by_user_id: string | null;
  created_by_role: string | null;
  created_at: string;
  updated_at: string;
}

interface IntegrationAccountRow extends QueryResultRow {
  id: string;
  slug: string;
  name: string;
  owner_user_id: string;
  status: string;
  allowed_scopes: unknown;
  rate_limit_per_minute: number | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

interface IntegrationAccountApiKeyRow extends QueryResultRow {
  id: string;
  integration_account_id: string;
  label: string;
  key_hash: string;
  created_for_user_id: string;
  scopes: unknown;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  account_slug?: string | null;
  account_name?: string | null;
  account_status?: string | null;
  allowed_scopes?: unknown;
  rate_limit_per_minute?: number | null;
}

interface IntegrationObjectMappingRow extends QueryResultRow {
  id: string;
  integration_account_id: string;
  project_id: string;
  local_object_type: string;
  local_object_id: string;
  external_object_type: string;
  external_object_id: string;
  direction: string;
  metadata: unknown;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface IntegrationWebhookRow extends QueryResultRow {
  id: string;
  integration_account_id: string;
  label: string | null;
  endpoint_url: string;
  signing_secret_encrypted: string;
  event_types: unknown;
  status: string;
  last_delivered_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  metadata: unknown;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface IntegrationOutboxRow extends QueryResultRow {
  id: string;
  integration_account_id: string;
  webhook_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  project_id: string | null;
  payload: unknown;
  status: string;
  attempt_count: number;
  next_attempt_at: string;
  last_attempt_at: string | null;
  delivered_at: string | null;
  last_error: string | null;
  last_response_status: number | null;
  created_at: string;
  updated_at: string;
  webhook_label?: string | null;
  endpoint_url?: string | null;
  signing_secret_encrypted?: string | null;
  event_types?: unknown;
  webhook_status?: string | null;
}

interface IntegrationIdempotencyRow extends QueryResultRow {
  id: string;
  scope_key: string;
  integration_account_id: string | null;
  request_method: string;
  request_path: string;
  idempotency_key: string;
  request_hash: string;
  status: string;
  response_status: number | null;
  response_body: unknown;
  resource_type: string | null;
  resource_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MutationEventDraft {
  accountId?: string | null;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  projectId?: string | null;
  payload: Record<string, unknown>;
}

interface MutationResult {
  status?: number;
  data: unknown;
  meta?: Record<string, unknown>;
  resourceType?: string;
  resourceId?: string;
  events?: MutationEventDraft[];
}

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const projectListQuerySchema = paginationSchema.extend({
  status: z.string().trim().min(1).max(50).optional(),
  updatedAfter: z.string().trim().min(1).optional(),
});

const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10000).nullable().optional(),
  status: z.string().trim().max(50).optional(),
  genre: z.string().trim().max(100).nullable().optional(),
  projectType: z.string().trim().max(100).nullable().optional(),
  startDate: z.string().trim().max(50).nullable().optional(),
  endDate: z.string().trim().max(50).nullable().optional(),
  budget: z.union([z.number(), z.string().trim().min(1)]).nullable().optional(),
  currency: z.string().trim().max(10).nullable().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  creatorhubProjectId: z.string().trim().max(255).nullable().optional(),
});

const projectPatchSchema = projectCreateSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  'At least one field must be provided.',
);

const clientIntakeUpsertSchema = z.object({
  projectGoal: z.string().trim().max(10000).nullable().optional(),
  deliverables: z.string().trim().max(10000).nullable().optional(),
  targetAudience: z.string().trim().max(10000).nullable().optional(),
  keyMessage: z.string().trim().max(10000).nullable().optional(),
  timingConstraints: z.string().trim().max(10000).nullable().optional(),
  brandNotes: z.string().trim().max(10000).nullable().optional(),
  materialOverview: z.string().trim().max(10000).nullable().optional(),
  referenceLinks: z.string().trim().max(10000).nullable().optional(),
  contactName: z.string().trim().max(255).nullable().optional(),
  contactEmail: z.string().trim().max(255).nullable().optional(),
  contactPhone: z.string().trim().max(50).nullable().optional(),
  additionalNotes: z.string().trim().max(10000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  updatedByRole: z.string().trim().max(80).nullable().optional(),
});

const clientMaterialCreateSchema = z.object({
  entryType: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10000).nullable().optional(),
  externalUrl: z.string().trim().url().nullable().optional(),
  phase: z.string().trim().max(32).nullable().optional(),
  linkedShotListId: z.string().trim().max(255).nullable().optional(),
  status: z.string().trim().max(50).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdByRole: z.string().trim().max(80).nullable().optional(),
});

const accountCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/).optional(),
  ownerUserId: z.string().trim().min(1).max(255),
  allowedScopes: z.array(z.string().trim().min(1).max(120)).optional(),
  rateLimitPerMinute: z.coerce.number().int().min(10).max(5000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const accountApiKeyCreateSchema = z.object({
  label: z.string().trim().min(1).max(255),
  createdForUserId: z.string().trim().min(1).max(255),
  scopes: z.array(z.string().trim().min(1).max(120)).optional(),
  expiresInDays: z.coerce.number().int().min(1).max(3650).optional(),
});

const mappingQuerySchema = paginationSchema.extend({
  localObjectType: z.string().trim().min(1).max(100).optional(),
  localObjectId: z.string().trim().min(1).max(255).optional(),
  externalObjectType: z.string().trim().min(1).max(100).optional(),
  externalObjectId: z.string().trim().min(1).max(255).optional(),
});

const mappingUpsertSchema = z.object({
  localObjectType: z.string().trim().min(1).max(100),
  localObjectId: z.string().trim().min(1).max(255),
  externalObjectType: z.string().trim().min(1).max(100),
  externalObjectId: z.string().trim().min(1).max(255),
  direction: z.enum(['import', 'export', 'bidirectional']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  lastSyncedAt: z.string().trim().min(1).optional(),
});

const webhookCreateSchema = z.object({
  label: z.string().trim().max(255).nullable().optional(),
  endpointUrl: z.string().trim().url(),
  eventTypes: z.array(z.string().trim().min(1).max(120)).min(1).optional(),
  signingSecret: z.string().trim().min(8).max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const webhookPatchSchema = z.object({
  label: z.string().trim().max(255).nullable().optional(),
  endpointUrl: z.string().trim().url().optional(),
  eventTypes: z.array(z.string().trim().min(1).max(120)).min(1).optional(),
  status: z.enum(['active', 'paused', 'disabled']).optional(),
  rotateSigningSecret: z.boolean().optional(),
  signingSecret: z.string().trim().min(8).max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine((payload) => Object.keys(payload).length > 0, 'At least one field must be provided.');

const webhookDispatchSchema = z.object({
  accountId: z.string().trim().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function makeRequestId(): string {
  return crypto.randomUUID();
}

function makeId(): string {
  return crypto.randomUUID();
}

function makeIntegrationApiKey(): string {
  return `rri_${crypto.randomBytes(32).toString('hex')}`;
}

function makeWebhookSecret(): string {
  return `rrwhsec_${crypto.randomBytes(24).toString('hex')}`;
}

function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function toJsonString(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function deriveIntegrationEncryptionKey(): Buffer | null {
  const secret = readStringValue(
    process.env.ROLE_ROOM_INTEGRATIONS_ENCRYPTION_KEY
      ?? process.env.ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY
      ?? process.env.SESSION_SECRET
      ?? process.env.JWT_SECRET
      ?? process.env.AUTH_SECRET,
  );
  if (!secret) {
    return null;
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptIntegrationSecret(value: string): string {
  const key = deriveIntegrationEncryptionKey();
  if (!key) {
    throw new Error('ROLE_ROOM_INTEGRATIONS_ENCRYPTION_KEY is missing.');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptIntegrationSecret(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const key = deriveIntegrationEncryptionKey();
  if (!key) {
    return null;
  }
  const [version, ivPart, tagPart, encryptedPart] = value.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) {
    return null;
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function parseScopes(value: unknown): string[] {
  return parseStringArray(value);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateIsoLikeDate(value: string | undefined): boolean {
  if (!value) return true;
  return !Number.isNaN(Date.parse(value));
}

function normalizeEventTypes(value: unknown): string[] {
  const eventTypes = parseStringArray(value).map((entry) => entry.trim());
  return eventTypes.length > 0 ? Array.from(new Set(eventTypes)) : ['*'];
}

function sanitizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function buildScopeKey(user: IntegrationUserContext): string {
  return user.accountId ? `account:${user.accountId}` : `legacy:${user.apiKeyId}`;
}

function hasScope(scopes: string[], requiredScope: string): boolean {
  if (scopes.includes('admin')) return true;
  const [resource, action] = requiredScope.split('.');
  if (!resource || !action) return scopes.includes(requiredScope);

  if (action === 'read') {
    return (
      scopes.includes('read') ||
      scopes.includes('write') ||
      scopes.includes(`${resource}.read`) ||
      scopes.includes(`${resource}.write`)
    );
  }

  if (action === 'write') {
    return scopes.includes('write') || scopes.includes(`${resource}.write`);
  }

  return scopes.includes(requiredScope);
}

function getRequestId(req: Request): string {
  const integrationReq = req as IntegrationRequest;
  if (!integrationReq.requestId) {
    integrationReq.requestId = makeRequestId();
  }
  return integrationReq.requestId;
}

function buildErrorEnvelope(
  req: Request,
  code: string,
  message: string,
  details?: unknown,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    code,
    message,
    requestId: getRequestId(req),
  };
  if (details !== undefined) {
    payload.details = details;
  }
  return { error: payload };
}

function buildSuccessEnvelope(
  req: Request,
  data: unknown,
  meta?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    data,
    meta: {
      requestId: getRequestId(req),
      ...(meta ?? {}),
    },
  };
}

function sendError(
  res: Response,
  req: Request,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  res.status(status).json(buildErrorEnvelope(req, code, message, details));
}

function sendData(
  res: Response,
  req: Request,
  data: unknown,
  meta?: Record<string, unknown>,
  status = 200,
): void {
  res.status(status).json(buildSuccessEnvelope(req, data, meta));
}

function mapProjectRow(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status ?? 'active',
    genre: row.genre,
    projectType: row.project_type,
    startDate: row.start_date,
    endDate: row.end_date,
    budget: row.budget,
    currency: row.currency ?? 'NOK',
    settings: asObject(row.settings),
    metadata: asObject(row.metadata),
    creatorhubProjectId: row.creatorhub_project_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoleRow(row: RoleRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    ageRange: row.age_range,
    gender: row.gender,
    ethnicity: row.ethnicity,
    roleType: row.role_type,
    sceneIds: asArray(row.scene_ids),
    requirements: asObject(row.requirements),
    status: row.status ?? 'open',
    assignedCandidateId: row.assigned_candidate_id,
    candidateIds: asArray(row.candidate_ids),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCandidateRow(row: CandidateRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    agency: row.agency,
    photos: asArray(row.photos),
    videos: asArray(row.videos),
    notes: row.notes,
    status: row.status ?? 'pending',
    assignedRoles: asArray(row.assigned_roles),
    rating: row.rating,
    metadata: asObject(row.metadata),
    emergencyContact: asObject(row.emergency_contact),
    consentStatus: row.consent_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCrewRow(row: CrewRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    department: row.department,
    rate: row.rate,
    availability: asObject(row.availability),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapScheduleRow(row: ScheduleRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    candidateId: row.candidate_id,
    roleId: row.role_id,
    sceneId: row.scene_id,
    locationId: row.location_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    type: row.type,
    status: row.status ?? 'scheduled',
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClientIntakeRow(row: ClientIntakeRow) {
  return {
    projectId: row.project_id,
    projectGoal: row.project_goal,
    deliverables: row.deliverables,
    targetAudience: row.target_audience,
    keyMessage: row.key_message,
    timingConstraints: row.timing_constraints,
    brandNotes: row.brand_notes,
    materialOverview: row.material_overview,
    referenceLinks: row.reference_links,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    additionalNotes: row.additional_notes,
    metadata: asObject(row.metadata),
    updatedByUserId: row.updated_by_user_id,
    updatedByRole: row.updated_by_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClientMaterialRow(row: ClientMaterialRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    entryType: row.entry_type,
    title: row.title,
    description: row.description,
    externalUrl: row.external_url,
    phase: row.phase,
    linkedShotListId: row.linked_shot_list_id,
    status: row.status ?? 'provided',
    metadata: asObject(row.metadata),
    createdByUserId: row.created_by_user_id,
    createdByRole: row.created_by_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIntegrationAccountRow(row: IntegrationAccountRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    ownerUserId: row.owner_user_id,
    status: row.status,
    allowedScopes: parseScopes(row.allowed_scopes),
    rateLimitPerMinute: row.rate_limit_per_minute ?? 120,
    metadata: asObject(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIntegrationWebhookRow(row: IntegrationWebhookRow) {
  return {
    id: row.id,
    accountId: row.integration_account_id,
    label: row.label,
    endpointUrl: row.endpoint_url,
    eventTypes: normalizeEventTypes(row.event_types),
    status: row.status,
    lastDeliveredAt: row.last_delivered_at,
    lastFailureAt: row.last_failure_at,
    lastError: row.last_error,
    metadata: asObject(row.metadata),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIntegrationMappingRow(row: IntegrationObjectMappingRow) {
  return {
    id: row.id,
    accountId: row.integration_account_id,
    projectId: row.project_id,
    localObjectType: row.local_object_type,
    localObjectId: row.local_object_id,
    externalObjectType: row.external_object_type,
    externalObjectId: row.external_object_id,
    direction: row.direction,
    metadata: asObject(row.metadata),
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireProjectAccess(pool: Pool, projectId: string, userId: string): Promise<boolean> {
  const result = await pool.query<{ id: string }>(
    `SELECT cp.id
       FROM casting_projects cp
       LEFT JOIN casting_user_roles cur
         ON cp.id = cur.project_id
        AND cur.user_id = $2
      WHERE cp.id = $1
        AND (cp.created_by = $2 OR cur.user_id IS NOT NULL)
      LIMIT 1`,
    [projectId, userId],
  );

  return Number(result.rowCount ?? 0) > 0;
}

const integrationPhase2TableReady = new WeakMap<Pool, Promise<void>>();
const integrationRateLimitState = new Map<string, { windowStartedAt: number; count: number }>();

async function ensureIntegrationPhase2Tables(pool: Pool): Promise<void> {
  const existing = integrationPhase2TableReady.get(pool);
  if (existing) {
    await existing;
    return;
  }

  const initPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_room_integration_accounts (
        id UUID PRIMARY KEY,
        slug VARCHAR(120) NOT NULL,
        name VARCHAR(255) NOT NULL,
        owner_user_id VARCHAR(255) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        allowed_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
        rate_limit_per_minute INTEGER NOT NULL DEFAULT 120,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_integration_accounts_slug_unique
        ON role_room_integration_accounts(slug);
      CREATE INDEX IF NOT EXISTS idx_rr_integration_accounts_owner
        ON role_room_integration_accounts(owner_user_id);

      CREATE TABLE IF NOT EXISTS role_room_integration_api_keys (
        id UUID PRIMARY KEY,
        integration_account_id UUID NOT NULL REFERENCES role_room_integration_accounts(id) ON DELETE CASCADE,
        label VARCHAR(255) NOT NULL,
        key_hash VARCHAR(128) NOT NULL,
        created_for_user_id VARCHAR(255) NOT NULL,
        scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_used_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_integration_api_keys_hash_unique
        ON role_room_integration_api_keys(key_hash);
      CREATE INDEX IF NOT EXISTS idx_rr_integration_api_keys_account
        ON role_room_integration_api_keys(integration_account_id);

      CREATE TABLE IF NOT EXISTS role_room_integration_object_mappings (
        id UUID PRIMARY KEY,
        integration_account_id UUID NOT NULL REFERENCES role_room_integration_accounts(id) ON DELETE CASCADE,
        project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
        local_object_type VARCHAR(100) NOT NULL,
        local_object_id VARCHAR(255) NOT NULL,
        external_object_type VARCHAR(100) NOT NULL,
        external_object_id VARCHAR(255) NOT NULL,
        direction VARCHAR(20) NOT NULL DEFAULT 'bidirectional',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        last_synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_integration_mappings_local_unique
        ON role_room_integration_object_mappings(
          integration_account_id,
          project_id,
          local_object_type,
          local_object_id,
          external_object_type
        );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_integration_mappings_external_unique
        ON role_room_integration_object_mappings(
          integration_account_id,
          project_id,
          external_object_type,
          external_object_id,
          local_object_type
        );
      CREATE INDEX IF NOT EXISTS idx_rr_integration_mappings_project
        ON role_room_integration_object_mappings(project_id);

      CREATE TABLE IF NOT EXISTS role_room_integration_webhooks (
        id UUID PRIMARY KEY,
        integration_account_id UUID NOT NULL REFERENCES role_room_integration_accounts(id) ON DELETE CASCADE,
        label VARCHAR(255),
        endpoint_url TEXT NOT NULL,
        signing_secret_encrypted TEXT NOT NULL,
        event_types JSONB NOT NULL DEFAULT '["*"]'::jsonb,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        last_delivered_at TIMESTAMPTZ,
        last_failure_at TIMESTAMPTZ,
        last_error TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by_user_id VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rr_integration_webhooks_account
        ON role_room_integration_webhooks(integration_account_id);

      CREATE TABLE IF NOT EXISTS role_room_integration_event_outbox (
        id UUID PRIMARY KEY,
        integration_account_id UUID NOT NULL REFERENCES role_room_integration_accounts(id) ON DELETE CASCADE,
        webhook_id UUID NOT NULL REFERENCES role_room_integration_webhooks(id) ON DELETE CASCADE,
        event_type VARCHAR(120) NOT NULL,
        aggregate_type VARCHAR(120) NOT NULL,
        aggregate_id VARCHAR(255) NOT NULL,
        project_id VARCHAR(255) REFERENCES casting_projects(id) ON DELETE SET NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        attempt_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_attempt_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        last_error TEXT,
        last_response_status INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rr_integration_outbox_pending
        ON role_room_integration_event_outbox(status, next_attempt_at);
      CREATE INDEX IF NOT EXISTS idx_rr_integration_outbox_account
        ON role_room_integration_event_outbox(integration_account_id);

      CREATE TABLE IF NOT EXISTS role_room_integration_idempotency_keys (
        id UUID PRIMARY KEY,
        scope_key VARCHAR(255) NOT NULL,
        integration_account_id UUID REFERENCES role_room_integration_accounts(id) ON DELETE CASCADE,
        request_method VARCHAR(10) NOT NULL,
        request_path TEXT NOT NULL,
        idempotency_key VARCHAR(255) NOT NULL,
        request_hash VARCHAR(128) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'processing',
        response_status INTEGER,
        response_body JSONB,
        resource_type VARCHAR(120),
        resource_id VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_integration_idempotency_unique
        ON role_room_integration_idempotency_keys(scope_key, request_method, request_path, idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_rr_integration_idempotency_account
        ON role_room_integration_idempotency_keys(integration_account_id);
    `);
  })();

  integrationPhase2TableReady.set(pool, initPromise);

  try {
    await initPromise;
  } catch (error) {
    integrationPhase2TableReady.delete(pool);
    throw error;
  }
}

function resolveEffectiveScopes(rawScopes: string[], allowedScopes: string[]): string[] {
  if (allowedScopes.length === 0) {
    return rawScopes;
  }
  return rawScopes.filter((scope) => allowedScopes.includes(scope));
}

function enforceRateLimit(req: Request, res: Response, user: IntegrationUserContext): boolean {
  const now = Date.now();
  const bucketKey = user.accountId ?? `legacy:${user.apiKeyId}`;
  const windowMs = 60_000;
  const limit = Math.max(1, user.rateLimitPerMinute || 120);
  const current = integrationRateLimitState.get(bucketKey);

  if (!current || now - current.windowStartedAt >= windowMs) {
    integrationRateLimitState.set(bucketKey, { windowStartedAt: now, count: 1 });
    res.setHeader('x-rate-limit-limit', String(limit));
    res.setHeader('x-rate-limit-remaining', String(Math.max(limit - 1, 0)));
    return true;
  }

  if (current.count >= limit) {
    res.setHeader('retry-after', '60');
    sendError(res, req, 429, 'rate_limit_exceeded', 'Rate limit exceeded for this integration account.', {
      limit,
      windowSeconds: 60,
    });
    return false;
  }

  current.count += 1;
  integrationRateLimitState.set(bucketKey, current);
  res.setHeader('x-rate-limit-limit', String(limit));
  res.setHeader('x-rate-limit-remaining', String(Math.max(limit - current.count, 0)));

  if (integrationRateLimitState.size > 5000) {
    for (const [key, value] of integrationRateLimitState.entries()) {
      if (now - value.windowStartedAt >= windowMs) {
        integrationRateLimitState.delete(key);
      }
    }
  }

  return true;
}

function requireIntegrationAuth(pool: Pool, requiredScope: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawKey = req.headers['x-api-key'];
    if (typeof rawKey !== 'string' || rawKey.trim().length === 0) {
      sendError(res, req, 401, 'missing_api_key', 'x-api-key header is required.');
      return;
    }

    const keyHash = hashApiKey(rawKey.trim());

    try {
      await ensureIntegrationPhase2Tables(pool);

      const accountKeyResult = await pool.query<IntegrationAccountApiKeyRow>(
        `SELECT
           k.id,
           k.integration_account_id,
           k.label,
           k.key_hash,
           k.created_for_user_id,
           k.scopes,
           k.is_active,
           k.last_used_at,
           k.expires_at,
           k.created_at,
           a.slug AS account_slug,
           a.name AS account_name,
           a.status AS account_status,
           a.allowed_scopes,
           a.rate_limit_per_minute
         FROM role_room_integration_api_keys k
         JOIN role_room_integration_accounts a
           ON a.id = k.integration_account_id
         WHERE k.key_hash = $1
           AND k.is_active = TRUE
           AND (k.expires_at IS NULL OR k.expires_at > NOW())
         LIMIT 1`,
        [keyHash],
      );

      if (Number(accountKeyResult.rowCount ?? 0) > 0) {
        const accountKey = accountKeyResult.rows[0];
        if (accountKey.account_status !== 'active') {
          sendError(res, req, 403, 'integration_account_inactive', 'Integration account is not active.');
          return;
        }

        const allowedScopes = parseScopes(accountKey.allowed_scopes);
        const scopes = resolveEffectiveScopes(parseScopes(accountKey.scopes), allowedScopes);
        if (!hasScope(scopes, requiredScope)) {
          sendError(res, req, 403, 'insufficient_scope', `Scope ${requiredScope} is required.`, {
            requiredScope,
            grantedScopes: scopes,
          });
          return;
        }

        await pool.query(
          'UPDATE role_room_integration_api_keys SET last_used_at = NOW() WHERE id = $1',
          [accountKey.id],
        );

        const integrationUser: IntegrationUserContext = {
          apiKeyId: accountKey.id,
          apiKeyName: accountKey.label,
          userId: accountKey.created_for_user_id,
          scopes,
          accountId: accountKey.integration_account_id,
          accountSlug: accountKey.account_slug ?? null,
          accountName: accountKey.account_name ?? null,
          rateLimitPerMinute: accountKey.rate_limit_per_minute ?? 120,
          isLegacyKey: false,
        };

        if (!enforceRateLimit(req, res, integrationUser)) {
          return;
        }

        (req as IntegrationRequest).integrationUser = integrationUser;
        next();
        return;
      }

      const legacyResult = await pool.query<IntegrationApiKeyRow>(
        `SELECT *
           FROM role_room_api_keys
          WHERE key_hash = $1
            AND is_active = TRUE
            AND (expires_at IS NULL OR expires_at > NOW())
          LIMIT 1`,
        [keyHash],
      );

      if (Number(legacyResult.rowCount ?? 0) === 0) {
        sendError(res, req, 403, 'invalid_api_key', 'API key is invalid or expired.');
        return;
      }

      const apiKey = legacyResult.rows[0];
      const scopes = parseScopes(apiKey.scopes);
      if (!hasScope(scopes, requiredScope)) {
        sendError(res, req, 403, 'insufficient_scope', `Scope ${requiredScope} is required.`, {
          requiredScope,
          grantedScopes: scopes,
        });
        return;
      }

      await pool.query(
        'UPDATE role_room_api_keys SET last_used_at = NOW() WHERE id = $1',
        [apiKey.id],
      );

      (req as IntegrationRequest).integrationUser = {
        apiKeyId: apiKey.id,
        apiKeyName: apiKey.name,
        userId: apiKey.user_id,
        scopes,
        rateLimitPerMinute: 120,
        isLegacyKey: true,
      };

      if (!enforceRateLimit(req, res, getIntegrationUser(req))) {
        return;
      }

      next();
    } catch (error) {
      console.error('Role Room integrations auth error:', error);
      sendError(res, req, 500, 'auth_failed', 'Could not authenticate request.');
    }
  };
}

function getIntegrationUser(req: Request): IntegrationUserContext {
  const integrationReq = req as IntegrationRequest;
  if (!integrationReq.integrationUser) {
    throw new Error('Integration user context is missing.');
  }
  return integrationReq.integrationUser;
}

function requireAccountBackedKey(req: Request, res: Response): IntegrationUserContext | null {
  const user = getIntegrationUser(req);
  if (!user.accountId) {
    sendError(res, req, 403, 'integration_account_required', 'This endpoint requires an account-backed integration key.');
    return null;
  }
  return user;
}

function readIdempotencyKey(req: Request): string | null {
  const direct = req.headers['idempotency-key'];
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }
  const alternate = req.headers['x-idempotency-key'];
  if (typeof alternate === 'string' && alternate.trim().length > 0) {
    return alternate.trim();
  }
  return null;
}

function buildRequestPath(req: Request): string {
  return `${req.baseUrl}${req.path}`;
}

function buildIdempotencyHash(req: Request): string {
  return hashValue(toJsonString({
    params: req.params,
    query: req.query,
    body: req.body ?? null,
  }));
}

async function enqueueWebhookEvents(pool: Pool, events: MutationEventDraft[] | undefined): Promise<void> {
  if (!events || events.length === 0) {
    return;
  }

  await ensureIntegrationPhase2Tables(pool);

  for (const event of events) {
    if (!event.accountId) {
      continue;
    }

    const webhookResult = await pool.query<IntegrationWebhookRow>(
      `SELECT *
         FROM role_room_integration_webhooks
        WHERE integration_account_id = $1
          AND status = 'active'
          AND (
            event_types @> '["*"]'::jsonb
            OR event_types @> $2::jsonb
          )`,
      [event.accountId, JSON.stringify([event.eventType])],
    );

    for (const webhook of webhookResult.rows) {
      await pool.query(
        `INSERT INTO role_room_integration_event_outbox (
           id, integration_account_id, webhook_id, event_type, aggregate_type,
           aggregate_id, project_id, payload, status, next_attempt_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8::jsonb, 'pending', NOW()
         )`,
        [
          makeId(),
          event.accountId,
          webhook.id,
          event.eventType,
          event.aggregateType,
          event.aggregateId,
          event.projectId ?? null,
          JSON.stringify(event.payload),
        ],
      );
    }
  }
}

function signWebhookPayload(secret: string, timestamp: string, body: string): string {
  const digest = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

async function dispatchWebhookOutbox(
  pool: Pool,
  options: { accountId?: string; limit?: number },
): Promise<Record<string, number>> {
  await ensureIntegrationPhase2Tables(pool);
  const limit = options.limit ?? 25;

  const result = await pool.query<IntegrationOutboxRow>(
    `SELECT
       o.*,
       w.label AS webhook_label,
       w.endpoint_url,
       w.signing_secret_encrypted,
       w.event_types,
       w.status AS webhook_status
     FROM role_room_integration_event_outbox o
     JOIN role_room_integration_webhooks w
       ON w.id = o.webhook_id
    WHERE o.status IN ('pending', 'retry')
      AND o.next_attempt_at <= NOW()
      AND ($1::uuid IS NULL OR o.integration_account_id = $1)
    ORDER BY o.created_at ASC
    LIMIT $2`,
    [options.accountId ?? null, limit],
  );

  const summary = {
    processed: 0,
    delivered: 0,
    retried: 0,
    deadLettered: 0,
  };

  for (const row of result.rows) {
    summary.processed += 1;

    if (row.webhook_status !== 'active' || !row.endpoint_url) {
      await pool.query(
        `UPDATE role_room_integration_event_outbox
            SET status = 'dead_letter',
                last_error = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [row.id, 'Webhook is not active or is missing endpoint_url.'],
      );
      summary.deadLettered += 1;
      continue;
    }

    const secret = decryptIntegrationSecret(row.signing_secret_encrypted);
    if (!secret) {
      await pool.query(
        `UPDATE role_room_integration_event_outbox
            SET status = 'dead_letter',
                last_error = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [row.id, 'Webhook signing secret could not be decrypted.'],
      );
      summary.deadLettered += 1;
      continue;
    }

    const payload = {
      id: row.id,
      type: row.event_type,
      accountId: row.integration_account_id,
      webhookId: row.webhook_id,
      projectId: row.project_id,
      aggregate: {
        type: row.aggregate_type,
        id: row.aggregate_id,
      },
      createdAt: row.created_at,
      data: asObject(row.payload),
    };
    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signWebhookPayload(secret, timestamp, body);

    let nextStatus: 'delivered' | 'retry' | 'dead_letter' = 'delivered';
    let lastError: string | null = null;
    let responseStatus: number | null = null;
    const nextAttemptCount = row.attempt_count + 1;

    try {
      const response = await fetch(row.endpoint_url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-role-room-event': row.event_type,
          'x-role-room-delivery-id': row.id,
          'x-role-room-account-id': row.integration_account_id,
          'x-role-room-signature': signature,
          'user-agent': 'TheRoleRoom-Integrations/1.0',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      responseStatus = response.status;
      if (!response.ok) {
        const responseText = (await response.text()).slice(0, 2000);
        lastError = `Webhook returned ${response.status}: ${responseText}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown webhook dispatch error';
    }

    if (lastError) {
      nextStatus = nextAttemptCount >= 5 ? 'dead_letter' : 'retry';
      const retryDelayMinutes = Math.min(60, 2 ** Math.min(nextAttemptCount, 5));
      const nextAttemptAt = new Date(Date.now() + retryDelayMinutes * 60_000).toISOString();

      await pool.query(
        `UPDATE role_room_integration_event_outbox
            SET status = $2,
                attempt_count = $3,
                last_attempt_at = NOW(),
                next_attempt_at = $4,
                last_error = $5,
                last_response_status = $6,
                updated_at = NOW()
          WHERE id = $1`,
        [row.id, nextStatus, nextAttemptCount, nextAttemptAt, lastError, responseStatus],
      );

      await pool.query(
        `UPDATE role_room_integration_webhooks
            SET last_failure_at = NOW(),
                last_error = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [row.webhook_id, lastError],
      );

      if (nextStatus === 'dead_letter') {
        summary.deadLettered += 1;
      } else {
        summary.retried += 1;
      }
      continue;
    }

    await pool.query(
      `UPDATE role_room_integration_event_outbox
          SET status = 'delivered',
              attempt_count = $2,
              last_attempt_at = NOW(),
              delivered_at = NOW(),
              last_error = NULL,
              last_response_status = $3,
              updated_at = NOW()
        WHERE id = $1`,
      [row.id, nextAttemptCount, responseStatus],
    );

    await pool.query(
      `UPDATE role_room_integration_webhooks
          SET last_delivered_at = NOW(),
              last_error = NULL,
              updated_at = NOW()
        WHERE id = $1`,
      [row.webhook_id],
    );

    summary.delivered += 1;
  }

  return summary;
}

async function runIdempotentMutation(
  pool: Pool,
  req: Request,
  res: Response,
  handler: () => Promise<MutationResult>,
): Promise<void> {
  const user = getIntegrationUser(req);
  const idempotencyKey = readIdempotencyKey(req);
  if (!idempotencyKey) {
    sendError(res, req, 400, 'missing_idempotency_key', 'Idempotency-Key header is required for write operations.');
    return;
  }

  await ensureIntegrationPhase2Tables(pool);

  const requestMethod = req.method.toUpperCase();
  const requestPath = buildRequestPath(req);
  const requestHash = buildIdempotencyHash(req);
  const scopeKey = buildScopeKey(user);

  const replayExistingResponse = (record: IntegrationIdempotencyRow): boolean => {
    if (record.request_hash !== requestHash) {
      sendError(res, req, 409, 'idempotency_key_conflict', 'The same idempotency key was used with a different request payload.');
      return true;
    }

    if (record.status === 'processing') {
      sendError(res, req, 409, 'idempotency_in_progress', 'A request with this idempotency key is already processing.');
      return true;
    }

    if (record.response_body) {
      res.setHeader('x-idempotency-replayed', 'true');
      res.status(record.response_status ?? 200).json(record.response_body);
      return true;
    }

    return false;
  };

  const existingResult = await pool.query<IntegrationIdempotencyRow>(
    `SELECT *
       FROM role_room_integration_idempotency_keys
      WHERE scope_key = $1
        AND request_method = $2
        AND request_path = $3
        AND idempotency_key = $4
      LIMIT 1`,
    [scopeKey, requestMethod, requestPath, idempotencyKey],
  );

  if (Number(existingResult.rowCount ?? 0) > 0 && replayExistingResponse(existingResult.rows[0])) {
    return;
  }

  await pool.query(
    `INSERT INTO role_room_integration_idempotency_keys (
       id, scope_key, integration_account_id, request_method,
       request_path, idempotency_key, request_hash, status
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, 'processing'
     )
     ON CONFLICT (scope_key, request_method, request_path, idempotency_key)
     DO NOTHING`,
    [
      makeId(),
      scopeKey,
      user.accountId ?? null,
      requestMethod,
      requestPath,
      idempotencyKey,
      requestHash,
    ],
  );

  const lockedResult = await pool.query<IntegrationIdempotencyRow>(
    `SELECT *
       FROM role_room_integration_idempotency_keys
      WHERE scope_key = $1
        AND request_method = $2
        AND request_path = $3
        AND idempotency_key = $4
      LIMIT 1`,
    [scopeKey, requestMethod, requestPath, idempotencyKey],
  );

  const record = lockedResult.rows[0];
  if (record && record.status !== 'processing' && replayExistingResponse(record)) {
    return;
  }

  try {
    const outcome = await handler();
    const status = outcome.status ?? 200;
    const envelope = buildSuccessEnvelope(req, outcome.data, outcome.meta);

    await pool.query(
      `UPDATE role_room_integration_idempotency_keys
          SET status = 'completed',
              response_status = $2,
              response_body = $3::jsonb,
              resource_type = $4,
              resource_id = $5,
              updated_at = NOW()
        WHERE scope_key = $1
          AND request_method = $6
          AND request_path = $7
          AND idempotency_key = $8`,
      [
        scopeKey,
        status,
        JSON.stringify(envelope),
        outcome.resourceType ?? null,
        outcome.resourceId ?? null,
        requestMethod,
        requestPath,
        idempotencyKey,
      ],
    );

    await enqueueWebhookEvents(pool, outcome.events);
    res.status(status).json(envelope);
  } catch (error) {
    console.error('Role Room idempotent mutation failed:', error);
    const failureEnvelope = buildErrorEnvelope(req, 'mutation_failed', 'Could not complete request.');

    await pool.query(
      `UPDATE role_room_integration_idempotency_keys
          SET status = 'failed',
              response_status = 500,
              response_body = $2::jsonb,
              updated_at = NOW()
        WHERE scope_key = $1
          AND request_method = $3
          AND request_path = $4
          AND idempotency_key = $5`,
      [
        scopeKey,
        JSON.stringify(failureEnvelope),
        requestMethod,
        requestPath,
        idempotencyKey,
      ],
    );

    res.status(500).json(failureEnvelope);
  }
}

export function createRoleRoomIntegrationsV1Router(pool: Pool): Router {
  const router = Router();

  router.use((req, res, next) => {
    const incomingRequestId = req.headers['x-request-id'];
    const requestId = typeof incomingRequestId === 'string' && incomingRequestId.trim().length > 0
      ? incomingRequestId.trim()
      : makeRequestId();
    (req as IntegrationRequest).requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'role-room-integrations-v1',
      version: 'v1',
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/admin/accounts', requireIntegrationAuth(pool, 'admin'), async (req, res) => {
    try {
      await ensureIntegrationPhase2Tables(pool);
      const result = await pool.query<IntegrationAccountRow>(
        'SELECT * FROM role_room_integration_accounts ORDER BY created_at DESC',
      );
      sendData(res, req, result.rows.map(mapIntegrationAccountRow), {
        count: result.rows.length,
      });
    } catch (error) {
      console.error('Role Room integrations list accounts error:', error);
      sendError(res, req, 500, 'integration_accounts_list_failed', 'Could not list integration accounts.');
    }
  });

  router.post('/admin/accounts', requireIntegrationAuth(pool, 'admin'), async (req, res) => {
    const parsedBody = accountCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      sendError(res, req, 400, 'invalid_body', 'Request body is invalid.', parsedBody.error.flatten());
      return;
    }

    const payload = parsedBody.data;
    const slug = sanitizeSlug(payload.slug ?? payload.name);
    if (!slug) {
      sendError(res, req, 400, 'invalid_slug', 'Could not derive a valid slug for the integration account.');
      return;
    }

    try {
      await ensureIntegrationPhase2Tables(pool);
      const existing = await pool.query<{ id: string }>(
        'SELECT id FROM role_room_integration_accounts WHERE slug = $1 LIMIT 1',
        [slug],
      );
      if (Number(existing.rowCount ?? 0) > 0) {
        sendError(res, req, 409, 'integration_account_exists', 'An integration account with this slug already exists.');
        return;
      }

      await runIdempotentMutation(pool, req, res, async () => {
        const accountId = makeId();
        const result = await pool.query<IntegrationAccountRow>(
          `INSERT INTO role_room_integration_accounts (
             id, slug, name, owner_user_id, status, allowed_scopes, rate_limit_per_minute, metadata
           ) VALUES (
             $1, $2, $3, $4, 'active', $5::jsonb, $6, $7::jsonb
           )
           RETURNING *`,
          [
            accountId,
            slug,
            payload.name,
            payload.ownerUserId,
            JSON.stringify(payload.allowedScopes ?? ['projects.read', 'projects.write']),
            payload.rateLimitPerMinute ?? 120,
            JSON.stringify(payload.metadata ?? {}),
          ],
        );

        return {
          status: 201,
          data: mapIntegrationAccountRow(result.rows[0]),
          resourceType: 'integration_account',
          resourceId: accountId,
        };
      });
    } catch (error) {
      console.error('Role Room integrations create account error:', error);
      sendError(res, req, 500, 'integration_account_create_failed', 'Could not create integration account.');
    }
  });

  router.get('/admin/accounts/:accountId/api-keys', requireIntegrationAuth(pool, 'admin'), async (req, res) => {
    try {
      await ensureIntegrationPhase2Tables(pool);
      const result = await pool.query<IntegrationAccountApiKeyRow>(
        `SELECT *
           FROM role_room_integration_api_keys
          WHERE integration_account_id = $1
          ORDER BY created_at DESC`,
        [req.params.accountId],
      );

      sendData(res, req, result.rows.map((row) => ({
        id: row.id,
        accountId: row.integration_account_id,
        label: row.label,
        createdForUserId: row.created_for_user_id,
        scopes: parseScopes(row.scopes),
        isActive: row.is_active,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      })), {
        count: result.rows.length,
      });
    } catch (error) {
      console.error('Role Room integrations list api keys error:', error);
      sendError(res, req, 500, 'integration_api_keys_list_failed', 'Could not list integration API keys.');
    }
  });

  router.post('/admin/accounts/:accountId/api-keys', requireIntegrationAuth(pool, 'admin'), async (req, res) => {
    const parsedBody = accountApiKeyCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      sendError(res, req, 400, 'invalid_body', 'Request body is invalid.', parsedBody.error.flatten());
      return;
    }

    try {
      await ensureIntegrationPhase2Tables(pool);
      const accountResult = await pool.query<IntegrationAccountRow>(
        'SELECT * FROM role_room_integration_accounts WHERE id = $1 LIMIT 1',
        [req.params.accountId],
      );
      if (Number(accountResult.rowCount ?? 0) === 0) {
        sendError(res, req, 404, 'integration_account_not_found', 'Integration account was not found.');
        return;
      }

      const account = accountResult.rows[0];
      const requestedScopes = parsedBody.data.scopes ?? parseScopes(account.allowed_scopes);
      const allowedScopes = parseScopes(account.allowed_scopes);
      if (allowedScopes.length > 0 && requestedScopes.some((scope) => !allowedScopes.includes(scope))) {
        sendError(res, req, 400, 'invalid_scope_assignment', 'Requested scopes exceed the account allowed scopes.', {
          allowedScopes,
          requestedScopes,
        });
        return;
      }

      await runIdempotentMutation(pool, req, res, async () => {
        const rawKey = makeIntegrationApiKey();
        const keyId = makeId();
        const expiresAt = parsedBody.data.expiresInDays
          ? new Date(Date.now() + parsedBody.data.expiresInDays * 86_400_000).toISOString()
          : null;

        await pool.query(
          `INSERT INTO role_room_integration_api_keys (
             id, integration_account_id, label, key_hash, created_for_user_id, scopes, expires_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6::jsonb, $7
           )`,
          [
            keyId,
            req.params.accountId,
            parsedBody.data.label,
            hashApiKey(rawKey),
            parsedBody.data.createdForUserId,
            JSON.stringify(requestedScopes),
            expiresAt,
          ],
        );

        return {
          status: 201,
          data: {
            id: keyId,
            accountId: req.params.accountId,
            label: parsedBody.data.label,
            createdForUserId: parsedBody.data.createdForUserId,
            scopes: requestedScopes,
            expiresAt,
            apiKey: rawKey,
          },
          resourceType: 'integration_api_key',
          resourceId: keyId,
        };
      });
    } catch (error) {
      console.error('Role Room integrations create api key error:', error);
      sendError(res, req, 500, 'integration_api_key_create_failed', 'Could not create integration API key.');
    }
  });

  router.get('/admin/accounts/:accountId/webhooks', requireIntegrationAuth(pool, 'admin'), async (req, res) => {
    try {
      await ensureIntegrationPhase2Tables(pool);
      const result = await pool.query<IntegrationWebhookRow>(
        `SELECT *
           FROM role_room_integration_webhooks
          WHERE integration_account_id = $1
          ORDER BY created_at DESC`,
        [req.params.accountId],
      );

      sendData(res, req, result.rows.map(mapIntegrationWebhookRow), {
        count: result.rows.length,
      });
    } catch (error) {
      console.error('Role Room integrations list webhooks error:', error);
      sendError(res, req, 500, 'integration_webhooks_list_failed', 'Could not list integration webhooks.');
    }
  });

  router.post('/admin/accounts/:accountId/webhooks', requireIntegrationAuth(pool, 'admin'), async (req, res) => {
    const parsedBody = webhookCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      sendError(res, req, 400, 'invalid_body', 'Request body is invalid.', parsedBody.error.flatten());
      return;
    }

    try {
      await ensureIntegrationPhase2Tables(pool);
      const accountResult = await pool.query<IntegrationAccountRow>(
        'SELECT * FROM role_room_integration_accounts WHERE id = $1 LIMIT 1',
        [req.params.accountId],
      );
      if (Number(accountResult.rowCount ?? 0) === 0) {
        sendError(res, req, 404, 'integration_account_not_found', 'Integration account was not found.');
        return;
      }

      await runIdempotentMutation(pool, req, res, async () => {
        const webhookId = makeId();
        const rawSecret = parsedBody.data.signingSecret ?? makeWebhookSecret();
        const encryptedSecret = encryptIntegrationSecret(rawSecret);
        const eventTypes = normalizeEventTypes(parsedBody.data.eventTypes);
        const actor = getIntegrationUser(req);

        const result = await pool.query<IntegrationWebhookRow>(
          `INSERT INTO role_room_integration_webhooks (
             id, integration_account_id, label, endpoint_url, signing_secret_encrypted,
             event_types, status, metadata, created_by_user_id
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6::jsonb, 'active', $7::jsonb, $8
           )
           RETURNING *`,
          [
            webhookId,
            req.params.accountId,
            normalizeOptionalText(parsedBody.data.label),
            parsedBody.data.endpointUrl,
            encryptedSecret,
            JSON.stringify(eventTypes),
            JSON.stringify(parsedBody.data.metadata ?? {}),
            actor.userId,
          ],
        );

        return {
          status: 201,
          data: {
            ...mapIntegrationWebhookRow(result.rows[0]),
            signingSecret: rawSecret,
          },
          resourceType: 'integration_webhook',
          resourceId: webhookId,
        };
      });
    } catch (error) {
      console.error('Role Room integrations create webhook error:', error);
      sendError(res, req, 500, 'integration_webhook_create_failed', 'Could not create integration webhook.');
    }
  });

  router.patch('/admin/accounts/:accountId/webhooks/:webhookId', requireIntegrationAuth(pool, 'admin'), async (req, res) => {
    const parsedBody = webhookPatchSchema.safeParse(req.body);
    if (!parsedBody.success) {
      sendError(res, req, 400, 'invalid_body', 'Request body is invalid.', parsedBody.error.flatten());
      return;
    }

    try {
      await ensureIntegrationPhase2Tables(pool);
      const webhookResult = await pool.query<IntegrationWebhookRow>(
        `SELECT *
           FROM role_room_integration_webhooks
          WHERE id = $1
            AND integration_account_id = $2
          LIMIT 1`,
        [req.params.webhookId, req.params.accountId],
      );
      if (Number(webhookResult.rowCount ?? 0) === 0) {
        sendError(res, req, 404, 'integration_webhook_not_found', 'Integration webhook was not found.');
        return;
      }

      const current = webhookResult.rows[0];
      await runIdempotentMutation(pool, req, res, async () => {
        const shouldRotate = parsedBody.data.rotateSigningSecret === true || !!parsedBody.data.signingSecret;
        const nextSecret = shouldRotate
          ? parsedBody.data.signingSecret ?? makeWebhookSecret()
          : null;
        const result = await pool.query<IntegrationWebhookRow>(
          `UPDATE role_room_integration_webhooks
              SET label = $3,
                  endpoint_url = $4,
                  signing_secret_encrypted = $5,
                  event_types = $6::jsonb,
                  status = $7,
                  metadata = $8::jsonb,
                  updated_at = NOW()
            WHERE id = $1
              AND integration_account_id = $2
            RETURNING *`,
          [
            req.params.webhookId,
            req.params.accountId,
            parsedBody.data.label === undefined ? current.label : normalizeOptionalText(parsedBody.data.label),
            parsedBody.data.endpointUrl ?? current.endpoint_url,
            nextSecret ? encryptIntegrationSecret(nextSecret) : current.signing_secret_encrypted,
            JSON.stringify(parsedBody.data.eventTypes ? normalizeEventTypes(parsedBody.data.eventTypes) : normalizeEventTypes(current.event_types)),
            parsedBody.data.status ?? current.status,
            JSON.stringify(parsedBody.data.metadata ?? asObject(current.metadata)),
          ],
        );

        return {
          data: {
            ...mapIntegrationWebhookRow(result.rows[0]),
            ...(nextSecret ? { signingSecret: nextSecret } : {}),
          },
          resourceType: 'integration_webhook',
          resourceId: req.params.webhookId,
        };
      });
    } catch (error) {
      console.error('Role Room integrations patch webhook error:', error);
      sendError(res, req, 500, 'integration_webhook_update_failed', 'Could not update integration webhook.');
    }
  });

  router.post('/admin/webhooks/dispatch', requireIntegrationAuth(pool, 'admin'), async (req, res) => {
    const parsedBody = webhookDispatchSchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      sendError(res, req, 400, 'invalid_body', 'Request body is invalid.', parsedBody.error.flatten());
      return;
    }

    try {
      const summary = await dispatchWebhookOutbox(pool, {
        accountId: parsedBody.data.accountId,
        limit: parsedBody.data.limit ?? 25,
      });

      sendData(res, req, summary);
    } catch (error) {
      console.error('Role Room integrations dispatch webhooks error:', error);
      sendError(res, req, 500, 'integration_webhook_dispatch_failed', 'Could not dispatch webhooks.');
    }
  });

  router.get('/projects', requireIntegrationAuth(pool, 'projects.read'), async (req, res) => {
    const parsedQuery = projectListQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      sendError(res, req, 400, 'invalid_query', 'Query parameters are invalid.', parsedQuery.error.flatten());
      return;
    }

    const { limit, offset, status, updatedAfter } = parsedQuery.data;
    if (!validateIsoLikeDate(updatedAfter)) {
      sendError(res, req, 400, 'invalid_query', 'updatedAfter must be a valid ISO date-time string.');
      return;
    }

    const user = getIntegrationUser(req);
    const params: Array<string | number> = [user.userId];
    const whereParts = ['(cp.created_by = $1 OR cur.user_id IS NOT NULL)'];

    if (status) {
      params.push(status);
      whereParts.push(`cp.status = $${params.length}`);
    }

    if (updatedAfter) {
      params.push(updatedAfter);
      whereParts.push(`cp.updated_at >= $${params.length}::timestamptz`);
    }

    params.push(limit + 1);
    const limitIndex = params.length;
    params.push(offset);
    const offsetIndex = params.length;

    try {
      const result = await pool.query<ProjectRow>(
        `SELECT DISTINCT cp.*
           FROM casting_projects cp
           LEFT JOIN casting_user_roles cur
             ON cp.id = cur.project_id
            AND cur.user_id = $1
          WHERE ${whereParts.join(' AND ')}
          ORDER BY cp.updated_at DESC
          LIMIT $${limitIndex}
         OFFSET $${offsetIndex}`,
        params,
      );

      const rows = result.rows.slice(0, limit);
      sendData(
        res,
        req,
        rows.map(mapProjectRow),
        {
          limit,
          offset,
          count: rows.length,
          hasMore: result.rows.length > limit,
        },
      );
    } catch (error) {
      console.error('Role Room integrations list projects error:', error);
      sendError(res, req, 500, 'projects_list_failed', 'Could not list projects.');
    }
  });

  router.get('/projects/:projectId', requireIntegrationAuth(pool, 'projects.read'), async (req, res) => {
    const user = getIntegrationUser(req);
    const { projectId } = req.params;

    try {
      if (!(await requireProjectAccess(pool, projectId, user.userId))) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found for this integration key.');
        return;
      }

      const [projectResult, roleCountResult, candidateCountResult, crewCountResult, scheduleCountResult] = await Promise.all([
        pool.query<ProjectRow>('SELECT * FROM casting_projects WHERE id = $1 LIMIT 1', [projectId]),
        pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM casting_roles WHERE project_id = $1', [projectId]),
        pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM casting_candidates WHERE project_id = $1', [projectId]),
        pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM casting_crew WHERE project_id = $1', [projectId]),
        pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM casting_schedules WHERE project_id = $1', [projectId]),
      ]);

      if (projectResult.rowCount === 0) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found.');
        return;
      }

      sendData(res, req, {
        ...mapProjectRow(projectResult.rows[0]),
        counts: {
          roles: Number(roleCountResult.rows[0]?.count ?? 0),
          candidates: Number(candidateCountResult.rows[0]?.count ?? 0),
          crew: Number(crewCountResult.rows[0]?.count ?? 0),
          schedules: Number(scheduleCountResult.rows[0]?.count ?? 0),
        },
      });
    } catch (error) {
      console.error('Role Room integrations get project error:', error);
      sendError(res, req, 500, 'project_fetch_failed', 'Could not fetch project.');
    }
  });

  router.post('/projects', requireIntegrationAuth(pool, 'projects.write'), async (req, res) => {
    const parsedBody = projectCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      sendError(res, req, 400, 'invalid_body', 'Request body is invalid.', parsedBody.error.flatten());
      return;
    }

    const payload = parsedBody.data;
    const user = getIntegrationUser(req);

    try {
      await runIdempotentMutation(pool, req, res, async () => {
        const projectId = makeId();
        const result = await pool.query<ProjectRow>(
          `INSERT INTO casting_projects (
             id, name, description, status, created_by, genre, project_type,
             start_date, end_date, budget, currency, settings, metadata, creatorhub_project_id
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7,
             $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14
           )
           RETURNING *`,
          [
            projectId,
            payload.name,
            normalizeOptionalText(payload.description),
            normalizeOptionalText(payload.status) ?? 'active',
            user.userId,
            normalizeOptionalText(payload.genre),
            normalizeOptionalText(payload.projectType),
            normalizeOptionalText(payload.startDate),
            normalizeOptionalText(payload.endDate),
            payload.budget == null ? null : String(payload.budget),
            normalizeOptionalText(payload.currency) ?? 'NOK',
            JSON.stringify(payload.settings ?? {}),
            JSON.stringify(payload.metadata ?? {}),
            normalizeOptionalText(payload.creatorhubProjectId),
          ],
        );

        await pool.query(
          `INSERT INTO casting_user_roles (id, project_id, user_id, role, permissions)
           VALUES ($1, $2, $3, 'director', $4::jsonb)
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [
            makeId(),
            projectId,
            user.userId,
            JSON.stringify({
              project: { read: true, write: true, admin: true },
              candidates: { read: true, write: true },
              schedules: { read: true, write: true },
              clientIntake: { read: true, write: true },
            }),
          ],
        );

        const mappedProject = mapProjectRow(result.rows[0]);
        return {
          status: 201,
          data: mappedProject,
          resourceType: 'project',
          resourceId: projectId,
          events: [{
            accountId: user.accountId,
            eventType: 'project.created',
            aggregateType: 'project',
            aggregateId: projectId,
            projectId,
            payload: mappedProject as Record<string, unknown>,
          }],
        };
      });
    } catch (error) {
      console.error('Role Room integrations create project error:', error);
      sendError(res, req, 500, 'project_create_failed', 'Could not create project.');
    }
  });

  router.patch('/projects/:projectId', requireIntegrationAuth(pool, 'projects.write'), async (req, res) => {
    const parsedBody = projectPatchSchema.safeParse(req.body);
    if (!parsedBody.success) {
      sendError(res, req, 400, 'invalid_body', 'Request body is invalid.', parsedBody.error.flatten());
      return;
    }

    const user = getIntegrationUser(req);
    const { projectId } = req.params;
    const payload = parsedBody.data;

    try {
      if (!(await requireProjectAccess(pool, projectId, user.userId))) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found for this integration key.');
        return;
      }

      const currentResult = await pool.query<ProjectRow>(
        'SELECT * FROM casting_projects WHERE id = $1 LIMIT 1',
        [projectId],
      );

      if (currentResult.rowCount === 0) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found.');
        return;
      }

      const current = currentResult.rows[0];
      await runIdempotentMutation(pool, req, res, async () => {
        const nextSettings = payload.settings ?? asObject(current.settings);
        const nextMetadata = payload.metadata ?? asObject(current.metadata);

        const result = await pool.query<ProjectRow>(
          `UPDATE casting_projects
              SET name = $2,
                  description = $3,
                  status = $4,
                  genre = $5,
                  project_type = $6,
                  start_date = $7,
                  end_date = $8,
                  budget = $9,
                  currency = $10,
                  settings = $11::jsonb,
                  metadata = $12::jsonb,
                  creatorhub_project_id = $13,
                  updated_at = NOW()
            WHERE id = $1
            RETURNING *`,
          [
            projectId,
            payload.name ?? current.name,
            payload.description === undefined ? current.description : normalizeOptionalText(payload.description),
            payload.status === undefined ? current.status : normalizeOptionalText(payload.status),
            payload.genre === undefined ? current.genre : normalizeOptionalText(payload.genre),
            payload.projectType === undefined ? current.project_type : normalizeOptionalText(payload.projectType),
            payload.startDate === undefined ? current.start_date : normalizeOptionalText(payload.startDate),
            payload.endDate === undefined ? current.end_date : normalizeOptionalText(payload.endDate),
            payload.budget === undefined ? current.budget : payload.budget == null ? null : String(payload.budget),
            payload.currency === undefined ? current.currency : normalizeOptionalText(payload.currency),
            JSON.stringify(nextSettings),
            JSON.stringify(nextMetadata),
            payload.creatorhubProjectId === undefined ? current.creatorhub_project_id : normalizeOptionalText(payload.creatorhubProjectId),
          ],
        );

        const mappedProject = mapProjectRow(result.rows[0]);
        return {
          data: mappedProject,
          resourceType: 'project',
          resourceId: projectId,
          events: [{
            accountId: user.accountId,
            eventType: 'project.updated',
            aggregateType: 'project',
            aggregateId: projectId,
            projectId,
            payload: mappedProject as Record<string, unknown>,
          }],
        };
      });
    } catch (error) {
      console.error('Role Room integrations patch project error:', error);
      sendError(res, req, 500, 'project_update_failed', 'Could not update project.');
    }
  });

  router.get('/projects/:projectId/roles', requireIntegrationAuth(pool, 'projects.read'), async (req, res) => {
    const parsedQuery = paginationSchema.safeParse(req.query);
    if (!parsedQuery.success) {
      sendError(res, req, 400, 'invalid_query', 'Query parameters are invalid.', parsedQuery.error.flatten());
      return;
    }

    const user = getIntegrationUser(req);
    const { projectId } = req.params;
    const { limit, offset } = parsedQuery.data;

    try {
      if (!(await requireProjectAccess(pool, projectId, user.userId))) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found for this integration key.');
        return;
      }

      const result = await pool.query<RoleRow>(
        `SELECT *
           FROM casting_roles
          WHERE project_id = $1
          ORDER BY updated_at DESC
          LIMIT $2
         OFFSET $3`,
        [projectId, limit, offset],
      );

      sendData(res, req, result.rows.map(mapRoleRow), {
        limit,
        offset,
        count: result.rows.length,
      });
    } catch (error) {
      console.error('Role Room integrations list roles error:', error);
      sendError(res, req, 500, 'roles_list_failed', 'Could not list roles.');
    }
  });

  router.get('/projects/:projectId/candidates', requireIntegrationAuth(pool, 'projects.read'), async (req, res) => {
    const parsedQuery = paginationSchema.safeParse(req.query);
    if (!parsedQuery.success) {
      sendError(res, req, 400, 'invalid_query', 'Query parameters are invalid.', parsedQuery.error.flatten());
      return;
    }

    const user = getIntegrationUser(req);
    const { projectId } = req.params;
    const { limit, offset } = parsedQuery.data;

    try {
      if (!(await requireProjectAccess(pool, projectId, user.userId))) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found for this integration key.');
        return;
      }

      const result = await pool.query<CandidateRow>(
        `SELECT *
           FROM casting_candidates
          WHERE project_id = $1
          ORDER BY updated_at DESC
          LIMIT $2
         OFFSET $3`,
        [projectId, limit, offset],
      );

      sendData(res, req, result.rows.map(mapCandidateRow), {
        limit,
        offset,
        count: result.rows.length,
      });
    } catch (error) {
      console.error('Role Room integrations list candidates error:', error);
      sendError(res, req, 500, 'candidates_list_failed', 'Could not list candidates.');
    }
  });

  router.get('/projects/:projectId/crew', requireIntegrationAuth(pool, 'projects.read'), async (req, res) => {
    const parsedQuery = paginationSchema.safeParse(req.query);
    if (!parsedQuery.success) {
      sendError(res, req, 400, 'invalid_query', 'Query parameters are invalid.', parsedQuery.error.flatten());
      return;
    }

    const user = getIntegrationUser(req);
    const { projectId } = req.params;
    const { limit, offset } = parsedQuery.data;

    try {
      if (!(await requireProjectAccess(pool, projectId, user.userId))) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found for this integration key.');
        return;
      }

      const result = await pool.query<CrewRow>(
        `SELECT *
           FROM casting_crew
          WHERE project_id = $1
          ORDER BY updated_at DESC
          LIMIT $2
         OFFSET $3`,
        [projectId, limit, offset],
      );

      sendData(res, req, result.rows.map(mapCrewRow), {
        limit,
        offset,
        count: result.rows.length,
      });
    } catch (error) {
      console.error('Role Room integrations list crew error:', error);
      sendError(res, req, 500, 'crew_list_failed', 'Could not list crew.');
    }
  });

  router.get('/projects/:projectId/schedules', requireIntegrationAuth(pool, 'projects.read'), async (req, res) => {
    const parsedQuery = paginationSchema.safeParse(req.query);
    if (!parsedQuery.success) {
      sendError(res, req, 400, 'invalid_query', 'Query parameters are invalid.', parsedQuery.error.flatten());
      return;
    }

    const user = getIntegrationUser(req);
    const { projectId } = req.params;
    const { limit, offset } = parsedQuery.data;

    try {
      if (!(await requireProjectAccess(pool, projectId, user.userId))) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found for this integration key.');
        return;
      }

      const result = await pool.query<ScheduleRow>(
        `SELECT *
           FROM casting_schedules
          WHERE project_id = $1
          ORDER BY COALESCE(date::text, updated_at::text) DESC
          LIMIT $2
         OFFSET $3`,
        [projectId, limit, offset],
      );

      sendData(res, req, result.rows.map(mapScheduleRow), {
        limit,
        offset,
        count: result.rows.length,
      });
    } catch (error) {
      console.error('Role Room integrations list schedules error:', error);
      sendError(res, req, 500, 'schedules_list_failed', 'Could not list schedules.');
    }
  });

  router.get('/projects/:projectId/client-intake', requireIntegrationAuth(pool, 'projects.read'), async (req, res) => {
    const user = getIntegrationUser(req);
    const { projectId } = req.params;

    try {
      if (!(await requireProjectAccess(pool, projectId, user.userId))) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found for this integration key.');
        return;
      }

      const result = await pool.query<ClientIntakeRow>(
        'SELECT * FROM role_room_client_intake WHERE project_id = $1 LIMIT 1',
        [projectId],
      );

      sendData(res, req, Number(result.rowCount ?? 0) > 0 ? mapClientIntakeRow(result.rows[0]) : null);
    } catch (error) {
      console.error('Role Room integrations get client intake error:', error);
      sendError(res, req, 500, 'client_intake_fetch_failed', 'Could not fetch client intake.');
    }
  });

  router.put('/projects/:projectId/client-intake', requireIntegrationAuth(pool, 'projects.write'), async (req, res) => {
    const parsedBody = clientIntakeUpsertSchema.safeParse(req.body);
    if (!parsedBody.success) {
      sendError(res, req, 400, 'invalid_body', 'Request body is invalid.', parsedBody.error.flatten());
      return;
    }

    const user = getIntegrationUser(req);
    const { projectId } = req.params;
    const payload = parsedBody.data;

    try {
      if (!(await requireProjectAccess(pool, projectId, user.userId))) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found for this integration key.');
        return;
      }

      await runIdempotentMutation(pool, req, res, async () => {
        const result = await pool.query<ClientIntakeRow>(
          `INSERT INTO role_room_client_intake (
             project_id, project_goal, deliverables, target_audience, key_message,
             timing_constraints, brand_notes, material_overview, reference_links,
             contact_name, contact_email, contact_phone, additional_notes, metadata,
             updated_by_user_id, updated_by_role
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11, $12, $13, $14::jsonb,
             $15, $16
           )
           ON CONFLICT (project_id) DO UPDATE SET
             project_goal = EXCLUDED.project_goal,
             deliverables = EXCLUDED.deliverables,
             target_audience = EXCLUDED.target_audience,
             key_message = EXCLUDED.key_message,
             timing_constraints = EXCLUDED.timing_constraints,
             brand_notes = EXCLUDED.brand_notes,
             material_overview = EXCLUDED.material_overview,
             reference_links = EXCLUDED.reference_links,
             contact_name = EXCLUDED.contact_name,
             contact_email = EXCLUDED.contact_email,
             contact_phone = EXCLUDED.contact_phone,
             additional_notes = EXCLUDED.additional_notes,
             metadata = EXCLUDED.metadata,
             updated_by_user_id = EXCLUDED.updated_by_user_id,
             updated_by_role = EXCLUDED.updated_by_role,
             updated_at = NOW()
           RETURNING *`,
          [
            projectId,
            normalizeOptionalText(payload.projectGoal),
            normalizeOptionalText(payload.deliverables),
            normalizeOptionalText(payload.targetAudience),
            normalizeOptionalText(payload.keyMessage),
            normalizeOptionalText(payload.timingConstraints),
            normalizeOptionalText(payload.brandNotes),
            normalizeOptionalText(payload.materialOverview),
            normalizeOptionalText(payload.referenceLinks),
            normalizeOptionalText(payload.contactName),
            normalizeOptionalText(payload.contactEmail),
            normalizeOptionalText(payload.contactPhone),
            normalizeOptionalText(payload.additionalNotes),
            JSON.stringify(payload.metadata ?? {}),
            user.userId,
            normalizeOptionalText(payload.updatedByRole) ?? 'integration',
          ],
        );

        const mappedIntake = mapClientIntakeRow(result.rows[0]);
        return {
          data: mappedIntake,
          resourceType: 'client_intake',
          resourceId: projectId,
          events: [{
            accountId: user.accountId,
            eventType: 'client-intake.upserted',
            aggregateType: 'client_intake',
            aggregateId: projectId,
            projectId,
            payload: mappedIntake as Record<string, unknown>,
          }],
        };
      });
    } catch (error) {
      console.error('Role Room integrations upsert client intake error:', error);
      sendError(res, req, 500, 'client_intake_update_failed', 'Could not upsert client intake.');
    }
  });

  router.get('/projects/:projectId/client-materials', requireIntegrationAuth(pool, 'projects.read'), async (req, res) => {
    const parsedQuery = paginationSchema.safeParse(req.query);
    if (!parsedQuery.success) {
      sendError(res, req, 400, 'invalid_query', 'Query parameters are invalid.', parsedQuery.error.flatten());
      return;
    }

    const user = getIntegrationUser(req);
    const { projectId } = req.params;
    const { limit, offset } = parsedQuery.data;

    try {
      if (!(await requireProjectAccess(pool, projectId, user.userId))) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found for this integration key.');
        return;
      }

      const result = await pool.query<ClientMaterialRow>(
        `SELECT *
           FROM role_room_client_materials
          WHERE project_id = $1
          ORDER BY updated_at DESC
          LIMIT $2
         OFFSET $3`,
        [projectId, limit, offset],
      );

      sendData(res, req, result.rows.map(mapClientMaterialRow), {
        limit,
        offset,
        count: result.rows.length,
      });
    } catch (error) {
      console.error('Role Room integrations list client materials error:', error);
      sendError(res, req, 500, 'client_materials_list_failed', 'Could not list client materials.');
    }
  });

  router.post('/projects/:projectId/client-materials', requireIntegrationAuth(pool, 'projects.write'), async (req, res) => {
    const parsedBody = clientMaterialCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      sendError(res, req, 400, 'invalid_body', 'Request body is invalid.', parsedBody.error.flatten());
      return;
    }

    const user = getIntegrationUser(req);
    const { projectId } = req.params;
    const payload = parsedBody.data;

    try {
      if (!(await requireProjectAccess(pool, projectId, user.userId))) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found for this integration key.');
        return;
      }

      await runIdempotentMutation(pool, req, res, async () => {
        const materialId = makeId();
        const result = await pool.query<ClientMaterialRow>(
          `INSERT INTO role_room_client_materials (
             id, project_id, entry_type, title, description, external_url,
             phase, linked_shot_list_id, status, metadata, created_by_user_id, created_by_role
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10::jsonb, $11, $12
           )
           RETURNING *`,
          [
            materialId,
            projectId,
            payload.entryType,
            payload.title,
            normalizeOptionalText(payload.description),
            normalizeOptionalText(payload.externalUrl),
            normalizeOptionalText(payload.phase),
            normalizeOptionalText(payload.linkedShotListId),
            normalizeOptionalText(payload.status) ?? 'provided',
            JSON.stringify(payload.metadata ?? {}),
            user.userId,
            normalizeOptionalText(payload.createdByRole) ?? 'integration',
          ],
        );

        const mappedMaterial = mapClientMaterialRow(result.rows[0]);
        return {
          status: 201,
          data: mappedMaterial,
          resourceType: 'client_material',
          resourceId: materialId,
          events: [{
            accountId: user.accountId,
            eventType: 'client-material.created',
            aggregateType: 'client_material',
            aggregateId: materialId,
            projectId,
            payload: mappedMaterial as Record<string, unknown>,
          }],
        };
      });
    } catch (error) {
      console.error('Role Room integrations create client material error:', error);
      sendError(res, req, 500, 'client_material_create_failed', 'Could not create client material.');
    }
  });

  router.get('/projects/:projectId/mappings', requireIntegrationAuth(pool, 'projects.read'), async (req, res) => {
    const accountUser = requireAccountBackedKey(req, res);
    if (!accountUser) {
      return;
    }

    const parsedQuery = mappingQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      sendError(res, req, 400, 'invalid_query', 'Query parameters are invalid.', parsedQuery.error.flatten());
      return;
    }

    const { projectId } = req.params;
    const { limit, offset, localObjectType, localObjectId, externalObjectType, externalObjectId } = parsedQuery.data;

    try {
      if (!(await requireProjectAccess(pool, projectId, accountUser.userId))) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found for this integration key.');
        return;
      }

      await ensureIntegrationPhase2Tables(pool);
      const params: Array<string | number> = [accountUser.accountId!, projectId];
      const filters = ['integration_account_id = $1', 'project_id = $2'];

      if (localObjectType) {
        params.push(localObjectType);
        filters.push(`local_object_type = $${params.length}`);
      }
      if (localObjectId) {
        params.push(localObjectId);
        filters.push(`local_object_id = $${params.length}`);
      }
      if (externalObjectType) {
        params.push(externalObjectType);
        filters.push(`external_object_type = $${params.length}`);
      }
      if (externalObjectId) {
        params.push(externalObjectId);
        filters.push(`external_object_id = $${params.length}`);
      }

      params.push(limit);
      const limitIndex = params.length;
      params.push(offset);
      const offsetIndex = params.length;

      const result = await pool.query<IntegrationObjectMappingRow>(
        `SELECT *
           FROM role_room_integration_object_mappings
          WHERE ${filters.join(' AND ')}
          ORDER BY updated_at DESC
          LIMIT $${limitIndex}
         OFFSET $${offsetIndex}`,
        params,
      );

      sendData(res, req, result.rows.map(mapIntegrationMappingRow), {
        limit,
        offset,
        count: result.rows.length,
      });
    } catch (error) {
      console.error('Role Room integrations list mappings error:', error);
      sendError(res, req, 500, 'integration_mappings_list_failed', 'Could not list integration mappings.');
    }
  });

  router.put('/projects/:projectId/mappings', requireIntegrationAuth(pool, 'projects.write'), async (req, res) => {
    const accountUser = requireAccountBackedKey(req, res);
    if (!accountUser) {
      return;
    }

    const parsedBody = mappingUpsertSchema.safeParse(req.body);
    if (!parsedBody.success) {
      sendError(res, req, 400, 'invalid_body', 'Request body is invalid.', parsedBody.error.flatten());
      return;
    }

    if (parsedBody.data.lastSyncedAt && !validateIsoLikeDate(parsedBody.data.lastSyncedAt)) {
      sendError(res, req, 400, 'invalid_body', 'lastSyncedAt must be a valid ISO date-time string.');
      return;
    }

    const { projectId } = req.params;

    try {
      if (!(await requireProjectAccess(pool, projectId, accountUser.userId))) {
        sendError(res, req, 404, 'project_not_found', 'Project was not found for this integration key.');
        return;
      }

      await ensureIntegrationPhase2Tables(pool);
      const payload = parsedBody.data;

      await runIdempotentMutation(pool, req, res, async () => {
        const existingResult = await pool.query<IntegrationObjectMappingRow>(
          `SELECT *
             FROM role_room_integration_object_mappings
            WHERE integration_account_id = $1
              AND project_id = $2
              AND (
                (local_object_type = $3 AND local_object_id = $4 AND external_object_type = $5)
                OR
                (external_object_type = $5 AND external_object_id = $6 AND local_object_type = $3)
              )
            LIMIT 1`,
          [
            accountUser.accountId!,
            projectId,
            payload.localObjectType,
            payload.localObjectId,
            payload.externalObjectType,
            payload.externalObjectId,
          ],
        );

        const existing = existingResult.rows[0];
        let result: IntegrationObjectMappingRow;

        if (existing) {
          const updateResult = await pool.query<IntegrationObjectMappingRow>(
            `UPDATE role_room_integration_object_mappings
                SET local_object_id = $3,
                    external_object_id = $4,
                    direction = $5,
                    metadata = $6::jsonb,
                    last_synced_at = $7,
                    updated_at = NOW()
              WHERE id = $1
                AND integration_account_id = $2
              RETURNING *`,
            [
              existing.id,
              accountUser.accountId!,
              payload.localObjectId,
              payload.externalObjectId,
              payload.direction ?? existing.direction,
              JSON.stringify(payload.metadata ?? asObject(existing.metadata)),
              payload.lastSyncedAt ?? existing.last_synced_at,
            ],
          );
          result = updateResult.rows[0];
        } else {
          const mappingId = makeId();
          const insertResult = await pool.query<IntegrationObjectMappingRow>(
            `INSERT INTO role_room_integration_object_mappings (
               id, integration_account_id, project_id, local_object_type, local_object_id,
               external_object_type, external_object_id, direction, metadata, last_synced_at
             ) VALUES (
               $1, $2, $3, $4, $5,
               $6, $7, $8, $9::jsonb, $10
             )
             RETURNING *`,
            [
              mappingId,
              accountUser.accountId!,
              projectId,
              payload.localObjectType,
              payload.localObjectId,
              payload.externalObjectType,
              payload.externalObjectId,
              payload.direction ?? 'bidirectional',
              JSON.stringify(payload.metadata ?? {}),
              payload.lastSyncedAt ?? null,
            ],
          );
          result = insertResult.rows[0];
        }

        const mappedMapping = mapIntegrationMappingRow(result);
        return {
          data: mappedMapping,
          resourceType: 'integration_mapping',
          resourceId: result.id,
          events: [{
            accountId: accountUser.accountId,
            eventType: 'mapping.upserted',
            aggregateType: 'integration_mapping',
            aggregateId: result.id,
            projectId,
            payload: mappedMapping as Record<string, unknown>,
          }],
        };
      });
    } catch (error) {
      console.error('Role Room integrations upsert mapping error:', error);
      sendError(res, req, 500, 'integration_mapping_upsert_failed', 'Could not upsert integration mapping.');
    }
  });

  return router;
}
