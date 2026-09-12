import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import {
  buildDiscoverySearchPlan,
  decodeDiscoveryCursor,
  discoveryBriefSchema,
  discoveryDecisionSchema,
  discoveryFeedbackSchema,
  discoveryHash,
  encodeDiscoveryCursor,
  parseIdempotencyKey,
  type DiscoveryBrief,
  type DiscoveryDecision,
  type DiscoveryFeedback,
  type DiscoverySearchPlan,
} from "./leadgrid-discovery-contract.js";
import {
  createDiscoveryRegistryProvider,
  DISCOVERY_BRREG_PAGE_SIZE,
  DISCOVERY_PUBLIC_DATA_SOURCES,
  distanceBetweenRegistryPoints,
  DiscoveryRegistryError,
  type DiscoveryRegistryCandidate,
  type DiscoveryRegistrySearchInput,
  type DiscoveryRegistrySearchResult,
  type DiscoveryWebsiteQualityAssessment,
} from "./leadgrid-discovery-brreg-provider.js";
import {
  scoreDiscoveryCandidate,
  type DiscoveryCandidateScore,
} from "./leadgrid-discovery-scoring.js";
import { normalizeWebsiteDomain } from "./lead-map-create-contract.js";
import type { LeadgridAccessibleProject } from "./leadgrid-project-access.js";
import type { BackgroundJob, JobHandler } from "./job-queue.js";
import { broadcastLeadCreated, leadgridRealtime } from "./leadgrid-realtime.js";
import {
  bindDiscoveryCapacityReservation,
  reserveDiscoveryMonthlyCapacityInTransaction,
} from "./leadgrid-discovery-governance.js";
import {
  buildDiscoveryClinicGroups,
  classifyDiscoveryEntity,
  type DiscoveryClassificationConfidence,
  type DiscoveryClinicGroup,
  type DiscoveryClinicGroupCandidate,
  type DiscoveryEntityKind,
} from "./leadgrid-discovery-clinic-grouping.js";

export const LEADGRID_DISCOVERY_JOB_TYPE = "leadgrid_discovery_run";

export type DiscoveryTriggerKind =
  | "manual"
  | "scheduled"
  | "workflow"
  | "api"
  | "retry";

export type DiscoveryRunStatus =
  | "planning"
  | "awaiting_confirmation"
  | "queued"
  | "searching"
  | "researching"
  | "review_ready"
  | "completed"
  | "partial"
  | "cancel_requested"
  | "cancelled"
  | "failed";

export type DiscoveryOccurrenceDisposition =
  | "found"
  | "existing_candidate"
  | "existing_lead"
  | "excluded"
  | "research_pending"
  | "researching"
  | "review_ready"
  | "approved"
  | "rejected"
  | "imported"
  | "duplicate"
  | "failed";

export type DiscoveryServiceErrorCode =
  | "validation_error"
  | "not_found"
  | "idempotency_conflict"
  | "plan_changed"
  | "profile_version_conflict"
  | "place_confirmation_required"
  | "clinic_approval_required"
  | "invalid_state"
  | "invalid_cursor"
  | "provider_not_configured"
  | "provider_unavailable"
  | "classification_resolution_failed"
  | "municipality_resolution_failed"
  | "discovery_not_enabled"
  | "monthly_candidate_budget_exhausted"
  | "run_already_executing"
  | "execution_lease_lost"
  | "cancelled"
  | "internal_error";

const SERVICE_ERROR_DEFAULTS: Record<
  DiscoveryServiceErrorCode,
  { message: string; status: number; retryable: boolean }
> = {
  validation_error: {
    message: "Discovery request is invalid.",
    status: 400,
    retryable: false,
  },
  not_found: {
    message: "Discovery resource was not found.",
    status: 404,
    retryable: false,
  },
  idempotency_conflict: {
    message: "The idempotency key was already used for another request.",
    status: 409,
    retryable: false,
  },
  plan_changed: {
    message: "The Discovery plan changed and must be previewed again.",
    status: 409,
    retryable: false,
  },
  profile_version_conflict: {
    message: "The Discovery profile changed.",
    status: 409,
    retryable: false,
  },
  place_confirmation_required: {
    message:
      "Google Place ID must come from a recent explicit detail lookup by the approving user.",
    status: 409,
    retryable: false,
  },
  clinic_approval_required: {
    message:
      "Denne tannlegen er gruppert under en klinikk. Godkjenn klinikkgruppen for å opprette én lead og tilknyttede kontakter.",
    status: 409,
    retryable: false,
  },
  invalid_state: {
    message: "The Discovery resource is not in a valid state for this action.",
    status: 409,
    retryable: false,
  },
  invalid_cursor: {
    message: "The candidate cursor is invalid.",
    status: 400,
    retryable: false,
  },
  provider_not_configured: {
    message: "Discovery search is not configured.",
    status: 503,
    retryable: false,
  },
  provider_unavailable: {
    message: "Discovery search is temporarily unavailable.",
    status: 503,
    retryable: true,
  },
  classification_resolution_failed: {
    message:
      "Discovery could not map the customer segment to an official industry code.",
    status: 422,
    retryable: false,
  },
  municipality_resolution_failed: {
    message:
      "Discovery could not map one or more municipality names to official municipality numbers.",
    status: 422,
    retryable: false,
  },
  discovery_not_enabled: {
    message: "Discovery is not enabled for this deployment yet.",
    status: 503,
    retryable: false,
  },
  monthly_candidate_budget_exhausted: {
    message: "Organizationens månedlige Discovery-kapasitet er brukt opp.",
    status: 429,
    retryable: false,
  },
  run_already_executing: {
    message: "Discovery run is already executing on another worker.",
    status: 409,
    retryable: true,
  },
  execution_lease_lost: {
    message: "Discovery worker lost its execution lease.",
    status: 409,
    retryable: true,
  },
  cancelled: {
    message: "The Discovery run was cancelled.",
    status: 409,
    retryable: false,
  },
  internal_error: {
    message: "Discovery could not complete the operation.",
    status: 500,
    retryable: false,
  },
};

export class DiscoveryServiceError extends Error {
  readonly code: DiscoveryServiceErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly field?: string;

  constructor(
    code: DiscoveryServiceErrorCode,
    options: {
      status?: number;
      retryable?: boolean;
      field?: string;
    } = {},
  ) {
    const defaults = SERVICE_ERROR_DEFAULTS[code];
    super(defaults.message);
    this.name = "DiscoveryServiceError";
    this.code = code;
    this.status = options.status ?? defaults.status;
    this.retryable = options.retryable ?? defaults.retryable;
    this.field = options.field;
  }

  toJSON(): {
    code: DiscoveryServiceErrorCode;
    message: string;
    status: number;
    retryable: boolean;
    field?: string;
  } {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      retryable: this.retryable,
      ...(this.field ? { field: this.field } : {}),
    };
  }
}

export function isLeadgridDiscoveryEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const configured = env.LEADGRID_DISCOVERY_ENABLED?.trim().toLowerCase();
  if (configured) {
    return ["1", "true", "yes", "on"].includes(configured);
  }
  // Production rollout is deliberately two-phase: deploy queue compatibility
  // everywhere first, then enable producers in a separate deployment.
  return env.NODE_ENV !== "production";
}

function assertLeadgridDiscoveryEnabled(): void {
  if (!isLeadgridDiscoveryEnabled()) {
    throw new DiscoveryServiceError("discovery_not_enabled");
  }
}

export interface DiscoveryPreviewDto {
  brief: DiscoveryBrief;
  plan: DiscoverySearchPlan;
  plan_hash: string;
  sources: DiscoveryDataSourceDto[];
}

export interface DiscoveryRunDto {
  id: string;
  organization_id: string;
  project_id: string;
  profile_id: string | null;
  profile_version: number | null;
  trigger_kind: DiscoveryTriggerKind;
  status: DiscoveryRunStatus;
  requested_by: string | null;
  requested_count: number;
  enrichment_count: number;
  scheduled_for: string | null;
  brief_snapshot: DiscoveryBrief;
  search_plan: Record<string, unknown>;
  checkpoint: Record<string, unknown>;
  source_summary: Record<string, unknown>;
  provider_usage: Record<string, unknown>;
  raw_result_count: number;
  duplicate_count: number;
  excluded_count: number;
  candidate_count: number;
  researched_count: number;
  review_ready_count: number;
  approved_count: number;
  rejected_count: number;
  imported_count: number;
  failed_count: number;
  error_code: string | null;
  error_message: string | null;
  cancellation_requested_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryRunMutationDto {
  run: DiscoveryRunDto;
  replayed: boolean;
}

export interface DiscoveryProfileObservationDto {
  profile_id: string | null;
  profile_name: string | null;
  profile_version: number | null;
  territory_code: string | null;
  run_count: number;
  last_seen_at: string;
}

export type DiscoveryObservationOrigin =
  | "provider_observation"
  | "rolling_deploy_canonical_fallback"
  | "legacy_backfill_current_canonical"
  | "unknown";

export interface DiscoveryObservationMetadataDto {
  origin: DiscoveryObservationOrigin;
  observed_at: string | null;
  captured_at: string | null;
  is_approximate: boolean;
}

export interface DiscoveryWebsiteQualityDto {
  status: "assessed" | "unknown";
  score: number | null;
  reason: DiscoveryWebsiteQualityAssessment["reason"];
  fetched_at: string;
  source_uri: string;
  final_url: string | null;
  http_status: number | null;
  redirect_count: number;
  signals: DiscoveryWebsiteQualityAssessment["signals"];
  qualification: {
    requested_terms: string[];
    matched_terms: string[];
  };
}

export interface DiscoveryCandidateDto {
  id: string;
  run_id: string;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  website_url: string | null;
  phone: string | null;
  email: string | null;
  source: "brreg_open_data";
  source_uri: string | null;
  organization_number: string | null;
  organization_form: string | null;
  organization_form_code: string | null;
  organization_structure: "independent" | "chain" | "unknown";
  subject_kind: "organization" | "person";
  entity_kind: DiscoveryEntityKind;
  entity_kind_confidence: DiscoveryClassificationConfidence;
  entity_kind_evidence: string[];
  clinic_group: DiscoveryClinicGroup;
  nace_code: string | null;
  nace_description: string | null;
  employee_count: number | null;
  registered_in_vat_register: boolean | null;
  registered_in_business_register: boolean | null;
  website_quality: DiscoveryWebsiteQualityDto | null;
  observation: DiscoveryObservationMetadataDto;
  discovery_profile: {
    id: string | null;
    name: string | null;
    version: number | null;
    territory_code: string | null;
  };
  observed_run_count: number;
  observed_in_profiles: DiscoveryProfileObservationDto[];
  sources: DiscoveryDataSourceDto[];
  status: string;
  research_status: string;
  disposition: DiscoveryOccurrenceDisposition;
  fit_score: number | null;
  fit_coverage: number;
  data_quality_score: number | null;
  data_quality_coverage: number;
  excluded: boolean;
  exclusion_matches: unknown[];
  score_explanation: Record<string, unknown>;
  reasons: string[];
  evidence: unknown[];
  existing_lead_id: string | null;
  imported_lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryDataSourceDto {
  id: "brreg" | "ssb_klass" | "kartverket_geonorge";
  provider: string;
  provider_uri: string;
  license: string;
  license_uri: string;
  notice: string;
}

export const DISCOVERY_DATA_SOURCES: DiscoveryDataSourceDto[] =
  DISCOVERY_PUBLIC_DATA_SOURCES.map((source) => ({
    id: source.id,
    provider: source.provider,
    provider_uri: source.providerUri,
    license: source.license,
    license_uri: source.licenseUri,
    notice: source.notice,
  }));

export interface DiscoveryDecisionResultDto {
  candidate_id: string;
  run_id: string;
  decision: DiscoveryDecision["decision"];
  candidate_status: string;
  lead_id: string | null;
  feedback_id: string;
  contact_count: number;
  replayed: boolean;
}

export interface DiscoveryFeedbackResultDto {
  feedback_id: string;
  candidate_id: string;
  run_id: string | null;
  replayed: boolean;
}

export interface DiscoveryExecutionResult {
  run_id: string;
  status: DiscoveryRunStatus;
  candidate_count: number;
  researched_count: number;
}

interface RunRow {
  id: string;
  organization_id: string;
  project_id: string;
  profile_id: string | null;
  profile_version: number | null;
  trigger_kind: DiscoveryTriggerKind;
  status: DiscoveryRunStatus;
  requested_by: string | null;
  requested_count: number;
  enrichment_count: number;
  scheduled_for: string | Date | null;
  idempotency_key: string;
  request_hash: string;
  brief_snapshot: unknown;
  search_plan: Record<string, unknown> | null;
  checkpoint: Record<string, unknown> | null;
  source_summary: Record<string, unknown> | null;
  provider_usage: Record<string, unknown> | null;
  raw_result_count: number;
  duplicate_count: number;
  excluded_count: number;
  candidate_count: number;
  researched_count: number;
  review_ready_count: number;
  approved_count: number;
  rejected_count: number;
  imported_count: number;
  failed_count: number;
  background_job_id: string | null;
  execution_lease_token: string | null;
  error_code: string | null;
  error_message: string | null;
  cancellation_requested_at: string | Date | null;
  started_at: string | Date | null;
  finished_at: string | Date | null;
  version: number;
  created_at: string | Date;
  updated_at: string | Date;
}

type Queryable = Pick<PoolClient, "query">;

const RUN_COLUMNS = `
  r.id::text,
  r.organization_id::text,
  r.project_id,
  r.profile_id::text,
  r.profile_version,
  r.trigger_kind,
  r.status,
  r.requested_by,
  r.requested_count,
  r.enrichment_count,
  r.scheduled_for,
  r.idempotency_key,
  r.request_hash,
  r.brief_snapshot,
  r.search_plan,
  r.checkpoint,
  r.source_summary,
  r.provider_usage,
  r.raw_result_count,
  r.duplicate_count,
  r.excluded_count,
  r.candidate_count,
  r.researched_count,
  r.review_ready_count,
  r.approved_count,
  r.rejected_count,
  r.imported_count,
  r.failed_count,
  r.background_job_id::text,
  r.execution_lease_token::text,
  r.error_code,
  r.error_message,
  r.cancellation_requested_at,
  r.started_at,
  r.finished_at,
  r.version,
  r.created_at,
  r.updated_at
`;

function dateText(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

type DiscoverySourceCursorMap = Record<string, number>;

function sourceOffsetCursor(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 2_147_483_647
    ? parsed
    : fallback;
}

/**
 * Ties a cursor to one stable source universe. Reordering queries preserves the
 * cursor, while any filter or scoring-context change safely starts at zero.
 */
export function discoverySourceQueryFingerprint(
  brief: DiscoveryBrief,
  queryText: string,
  queryMode: DiscoverySearchPlan["queries"][number]["query_mode"] = "industry",
): string {
  return discoveryHash({
    version: 1,
    source: "brreg_open_data",
    query_mode: queryMode,
    query: queryText,
    area: {
      country_code: brief.country_code ?? null,
      city: brief.city ?? null,
      geo: brief.geo ?? null,
      municipality_numbers: brief.municipality_numbers,
      municipality_names: brief.municipality_names,
    },
    organization_forms: brief.organization_forms,
    employee_count: brief.employee_count,
    organization_structure: brief.organization_structure,
    website_requirement: brief.website_requirement,
    website_quality: brief.website_quality,
    qualification_terms: brief.qualification_terms,
    qualification_requirement: brief.qualification_requirement,
    commercial_signals: brief.commercial_signals,
    exclusion_terms: brief.exclusion_terms,
    minimum_fit_score: brief.minimum_fit_score,
    ideal_customer: brief.ideal_customer ?? null,
    goal: brief.goal ?? null,
  });
}

function sourceCursorMapForPlan(
  value: unknown,
  brief: DiscoveryBrief,
  plan: DiscoverySearchPlan,
): DiscoverySourceCursorMap {
  const stored = objectValue(value);
  return Object.fromEntries(
    plan.queries.map((query) => {
      const fingerprint = discoverySourceQueryFingerprint(
        brief,
        query.text_query,
        query.query_mode,
      );
      return [fingerprint, sourceOffsetCursor(stored[fingerprint])];
    }),
  );
}

function parsedSourceCursorMap(value: unknown): DiscoverySourceCursorMap {
  const record = objectValue(value);
  return Object.fromEntries(
    Object.entries(record).flatMap(([fingerprint, cursor]) =>
      /^[a-f0-9]{64}$/.test(fingerprint)
        ? [[fingerprint, sourceOffsetCursor(cursor)]]
        : [],
    ),
  );
}

function parseBrief(value: unknown): DiscoveryBrief {
  const parsed = discoveryBriefSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DiscoveryServiceError("validation_error", {
      field: issue?.path.map(String).join(".") || undefined,
    });
  }
  return parsed.data;
}

function requiredText(value: unknown, field: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new DiscoveryServiceError("validation_error", { field });
  }
  return normalized;
}

function requiredIdempotencyKey(value: unknown): string {
  const key = parseIdempotencyKey(value);
  if (!key) {
    throw new DiscoveryServiceError("validation_error", {
      field: "idempotency_key",
    });
  }
  return key;
}

function assertProject(project: LeadgridAccessibleProject): void {
  requiredText(project.id, "project_id");
  requiredText(project.organizationId, "organization_id");
}

function toRunDto(row: RunRow): DiscoveryRunDto {
  return {
    id: row.id,
    organization_id: row.organization_id,
    project_id: row.project_id,
    profile_id: row.profile_id,
    profile_version:
      row.profile_version == null ? null : numberValue(row.profile_version),
    trigger_kind: row.trigger_kind,
    status: row.status,
    requested_by: row.requested_by,
    requested_count: numberValue(row.requested_count),
    enrichment_count: numberValue(row.enrichment_count),
    scheduled_for: dateText(row.scheduled_for),
    brief_snapshot: parseBrief(row.brief_snapshot),
    search_plan: objectValue(row.search_plan),
    checkpoint: objectValue(row.checkpoint),
    source_summary: objectValue(row.source_summary),
    provider_usage: objectValue(row.provider_usage),
    raw_result_count: numberValue(row.raw_result_count),
    duplicate_count: numberValue(row.duplicate_count),
    excluded_count: numberValue(row.excluded_count),
    candidate_count: numberValue(row.candidate_count),
    researched_count: numberValue(row.researched_count),
    review_ready_count: numberValue(row.review_ready_count),
    approved_count: numberValue(row.approved_count),
    rejected_count: numberValue(row.rejected_count),
    imported_count: numberValue(row.imported_count),
    failed_count: numberValue(row.failed_count),
    error_code: row.error_code,
    error_message: row.error_message,
    cancellation_requested_at: dateText(row.cancellation_requested_at),
    started_at: dateText(row.started_at),
    finished_at: dateText(row.finished_at),
    version: numberValue(row.version, 1),
    created_at: dateText(row.created_at) as string,
    updated_at: dateText(row.updated_at) as string,
  };
}

async function withTransaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function loadRun(
  queryable: Queryable,
  project: LeadgridAccessibleProject,
  runId: string,
  forUpdate = false,
): Promise<RunRow | null> {
  const result = await queryable.query<RunRow>(
    `SELECT ${RUN_COLUMNS}
       FROM leadgrid_discovery_runs r
      WHERE r.id = $3::uuid
        AND r.organization_id = $1::uuid
        AND r.project_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}
      LIMIT 1`,
    [project.organizationId, project.id, requiredText(runId, "run_id")],
  );
  return result.rows[0] ?? null;
}

async function loadRunById(
  queryable: Queryable,
  runId: string,
  forUpdate = false,
): Promise<RunRow | null> {
  const result = await queryable.query<RunRow>(
    `SELECT ${RUN_COLUMNS}
       FROM leadgrid_discovery_runs r
      WHERE r.id = $1::uuid
      ${forUpdate ? "FOR UPDATE" : ""}
      LIMIT 1`,
    [requiredText(runId, "run_id")],
  );
  return result.rows[0] ?? null;
}

async function ensureRunJob(
  client: Queryable,
  input: { runId: string; userId: string; runAfter?: string | Date | null },
): Promise<string> {
  assertLeadgridDiscoveryEnabled();
  const jobId = randomUUID();
  const dedupeKey = `${LEADGRID_DISCOVERY_JOB_TYPE}|${input.runId}`;
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO background_jobs (
        id, job_type, payload, status, priority, max_attempts,
        run_after, dedupe_key, created_by
      ) VALUES (
        $1::uuid, $2, $3::jsonb, 'queued', 90, 3,
        COALESCE($6::timestamptz, NOW()), $4, $5
      )
      ON CONFLICT (dedupe_key)
        WHERE dedupe_key IS NOT NULL AND status IN ('queued', 'running')
      DO NOTHING
      RETURNING id::text`,
    [
      jobId,
      LEADGRID_DISCOVERY_JOB_TYPE,
      JSON.stringify({ runId: input.runId }),
      dedupeKey,
      input.userId,
      dateText(input.runAfter),
    ],
  );
  if (inserted.rows[0]?.id) return inserted.rows[0].id;

  const existing = await client.query<{ id: string }>(
    `SELECT id::text
       FROM background_jobs
      WHERE dedupe_key = $1
        AND status IN ('queued', 'running')
      LIMIT 1`,
    [dedupeKey],
  );
  if (!existing.rows[0]?.id) {
    throw new DiscoveryServiceError("internal_error");
  }
  return existing.rows[0].id;
}

function capacityReservationKey(
  projectId: string,
  idempotencyKey: string,
): string {
  return discoveryHash({
    version: 1,
    project_id: projectId,
    idempotency_key: idempotencyKey,
  });
}

export function previewDiscovery(briefValue: unknown): DiscoveryPreviewDto {
  const brief = parseBrief(briefValue);
  const plan = buildDiscoverySearchPlan(brief);
  return {
    brief,
    plan,
    plan_hash: discoveryHash(plan),
    sources: DISCOVERY_DATA_SOURCES,
  };
}

export async function createDiscoveryRun(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    userId: string;
    brief: unknown;
    profileId?: string | null;
    expectedProfileVersion?: number | null;
    idempotencyKey: string;
    startImmediately: boolean;
    planHash?: string | null;
    triggerKind?: DiscoveryTriggerKind;
    scheduledFor?: string | Date | null;
    /**
     * Internal-only campaign snapshot. HTTP routes use a strict schema and
     * explicit field mapping, so this capability cannot be supplied by a
     * client. It preserves the profile attribution captured when a campaign
     * was confirmed without letting later profile edits alter that campaign.
     */
    trustedProfileSnapshot?: {
      profileId: string;
      profileVersion: number;
      sourceCursorMap: unknown;
    };
  },
): Promise<DiscoveryRunMutationDto> {
  assertProject(input.project);
  // Creating even an awaiting-confirmation run is a write-side producer path.
  // Keep the phase-one rollout fail-closed; preview remains read-only.
  assertLeadgridDiscoveryEnabled();
  const userId = requiredText(input.userId, "user_id");
  const idempotencyKey = requiredIdempotencyKey(input.idempotencyKey);
  const preview = previewDiscovery(input.brief);
  if (input.planHash && input.planHash !== preview.plan_hash) {
    throw new DiscoveryServiceError("plan_changed", { field: "plan_hash" });
  }
  const triggerKind = input.triggerKind ?? "manual";
  if (
    !["manual", "scheduled", "workflow", "api", "retry"].includes(triggerKind)
  ) {
    throw new DiscoveryServiceError("validation_error", {
      field: "trigger_kind",
    });
  }
  const trustedProfileSnapshot = input.trustedProfileSnapshot;
  if (
    trustedProfileSnapshot &&
    triggerKind !== "workflow" &&
    triggerKind !== "retry"
  ) {
    throw new DiscoveryServiceError("validation_error", {
      field: "trusted_profile_snapshot",
    });
  }
  const trustedProfileId = trustedProfileSnapshot
    ? requiredText(trustedProfileSnapshot.profileId, "profile_id")
    : null;
  const trustedProfileVersion = trustedProfileSnapshot
    ? numberValue(trustedProfileSnapshot.profileVersion)
    : null;
  if (
    trustedProfileSnapshot &&
    (trustedProfileVersion == null ||
      !Number.isInteger(trustedProfileVersion) ||
      trustedProfileVersion < 1)
  ) {
    throw new DiscoveryServiceError("validation_error", {
      field: "expected_profile_version",
    });
  }
  const suppliedProfileId = input.profileId
    ? requiredText(input.profileId, "profile_id")
    : null;
  if (
    trustedProfileSnapshot &&
    ((suppliedProfileId && suppliedProfileId !== trustedProfileId) ||
      (input.expectedProfileVersion != null &&
        input.expectedProfileVersion !== trustedProfileVersion))
  ) {
    throw new DiscoveryServiceError("validation_error", {
      field: "trusted_profile_snapshot",
    });
  }
  const profileId = trustedProfileId ?? suppliedProfileId;
  const expectedProfileVersion =
    trustedProfileVersion ?? input.expectedProfileVersion ?? null;
  const trustedSourceCursorMap = trustedProfileSnapshot
    ? parsedSourceCursorMap(trustedProfileSnapshot.sourceCursorMap)
    : {};
  if (profileId && expectedProfileVersion == null) {
    throw new DiscoveryServiceError("validation_error", {
      field: "expected_profile_version",
    });
  }
  if (!profileId && expectedProfileVersion != null) {
    throw new DiscoveryServiceError("validation_error", {
      field: "profile_id",
    });
  }
  const requestHash = discoveryHash({
    project_id: input.project.id,
    profile_id: profileId,
    expected_profile_version: expectedProfileVersion,
    trusted_profile_snapshot: trustedProfileSnapshot
      ? {
          profile_id: profileId,
          profile_version: expectedProfileVersion,
          source_cursor_map: trustedSourceCursorMap,
        }
      : null,
    brief: preview.brief,
    start_immediately: input.startImmediately,
    plan_hash: input.planHash ?? null,
    trigger_kind: triggerKind,
    scheduled_for: dateText(input.scheduledFor),
  });

  return withTransaction(pool, async (client) => {
    await client.query(
      `SELECT pg_advisory_xact_lock(
         hashtextextended($1, 0)
       )`,
      [
        [input.project.organizationId, input.project.id, idempotencyKey].join(
          "|",
        ),
      ],
    );

    const replay = await client.query<RunRow>(
      `SELECT ${RUN_COLUMNS}
         FROM leadgrid_discovery_runs r
        WHERE r.organization_id = $1::uuid
          AND r.project_id = $2
          AND r.idempotency_key = $3
        LIMIT 1`,
      [input.project.organizationId, input.project.id, idempotencyKey],
    );
    if (replay.rows[0]) {
      if (replay.rows[0].request_hash !== requestHash) {
        throw new DiscoveryServiceError("idempotency_conflict");
      }
      return { run: toRunDto(replay.rows[0]), replayed: true };
    }

    let profileVersion: number | null = null;
    let persistedSourceCursorMap: unknown = {};
    let effectivePreview = preview;
    if (profileId && trustedProfileSnapshot) {
      profileVersion = expectedProfileVersion;
      persistedSourceCursorMap = trustedSourceCursorMap;
      // Campaign items hold a canonical, immutable brief. Do not re-read the
      // mutable live profile here: patch/archive applies to the next campaign.
      effectivePreview = preview;
    } else if (profileId) {
      const profile = await client.query<{
        version: number;
        status: string;
        brief: unknown;
        source_cursor_map: unknown;
      }>(
        `SELECT version, status, brief, source_cursor_map
           FROM leadgrid_discovery_profiles
          WHERE id = $3::uuid
            AND organization_id = $1::uuid
            AND project_id = $2
          FOR SHARE
          LIMIT 1`,
        [input.project.organizationId, input.project.id, profileId],
      );
      const row = profile.rows[0];
      if (!row || row.status === "archived") {
        throw new DiscoveryServiceError("not_found", { field: "profile_id" });
      }
      if (triggerKind === "scheduled" && row.status !== "active") {
        throw new DiscoveryServiceError("invalid_state", {
          field: "profile_id",
        });
      }
      profileVersion = numberValue(row.version);
      persistedSourceCursorMap = row.source_cursor_map;
      if (profileVersion !== expectedProfileVersion) {
        throw new DiscoveryServiceError("profile_version_conflict", {
          field: "expected_profile_version",
        });
      }
      const storedProfilePreview = previewDiscovery(row.brief);
      if (
        discoveryHash(storedProfilePreview.brief) !==
        discoveryHash(preview.brief)
      ) {
        throw new DiscoveryServiceError("profile_version_conflict", {
          field: "brief",
        });
      }
      effectivePreview = storedProfilePreview;
    }

    const sourceCursorStart = sourceCursorMapForPlan(
      persistedSourceCursorMap,
      effectivePreview.brief,
      effectivePreview.plan,
    );

    const reservationKey = capacityReservationKey(
      input.project.id,
      idempotencyKey,
    );
    if (input.startImmediately) {
      const reservation = await reserveDiscoveryMonthlyCapacityInTransaction(
        client,
        {
          organizationId: input.project.organizationId,
          idempotencyKey: reservationKey,
          requestedCandidates: effectivePreview.brief.target_count,
        },
      );
      if (!reservation.allowed) {
        throw new DiscoveryServiceError("monthly_candidate_budget_exhausted");
      }
    }

    const runId = randomUUID();
    const initialStatus: DiscoveryRunStatus = input.startImmediately
      ? "queued"
      : "awaiting_confirmation";
    await client.query(
      `INSERT INTO leadgrid_discovery_runs (
          id, organization_id, project_id, profile_id, profile_version,
          trigger_kind, status, requested_by, requested_count,
          enrichment_count, scheduled_for, idempotency_key, request_hash,
          brief_snapshot, search_plan, checkpoint, source_summary
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4::uuid, $5,
          $6, $7, $8, $9, $10, $11,
          $12, $13, $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb
        )`,
      [
        runId,
        input.project.organizationId,
        input.project.id,
        profileId,
        profileVersion,
        triggerKind,
        initialStatus,
        userId,
        effectivePreview.brief.target_count,
        effectivePreview.brief.enrichment_count,
        dateText(input.scheduledFor),
        idempotencyKey,
        requestHash,
        JSON.stringify(effectivePreview.brief),
        JSON.stringify({
          ...effectivePreview.plan,
          plan_hash: effectivePreview.plan_hash,
        }),
        JSON.stringify({
          version: 3,
          source_cursor_start: sourceCursorStart,
          source_cursor_next: sourceCursorStart,
          source_page_start: 0,
          source_page_next: 0,
          completed_queries: [],
          query_errors: [],
          query_results: {},
        }),
        JSON.stringify({
          source: "brreg_open_data",
          sources: DISCOVERY_DATA_SOURCES,
          derived_by_leadgrid: ["industry_fit", "distance", "fit_score"],
        }),
      ],
    );

    if (input.startImmediately) {
      const jobId = await ensureRunJob(client, {
        runId,
        userId,
        runAfter: input.scheduledFor,
      });
      await client.query(
        `UPDATE leadgrid_discovery_runs
            SET background_job_id = $2::uuid,
                version = version + 1
          WHERE id = $1::uuid`,
        [runId, jobId],
      );
      await bindDiscoveryCapacityReservation(client, {
        organizationId: input.project.organizationId,
        idempotencyKey: reservationKey,
        runId,
      });
    }

    const created = await loadRun(client, input.project, runId);
    if (!created) throw new DiscoveryServiceError("internal_error");
    return { run: toRunDto(created), replayed: false };
  });
}

export async function confirmDiscoveryRun(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    userId: string;
    runId: string;
  },
): Promise<DiscoveryRunMutationDto> {
  assertProject(input.project);
  assertLeadgridDiscoveryEnabled();
  const userId = requiredText(input.userId, "user_id");
  return withTransaction(pool, async (client) => {
    const run = await loadRun(client, input.project, input.runId, true);
    if (!run) throw new DiscoveryServiceError("not_found");

    if (run.status !== "awaiting_confirmation" && run.status !== "planning") {
      if (
        run.background_job_id &&
        ["queued", "searching", "researching", "review_ready"].includes(
          run.status,
        )
      ) {
        return { run: toRunDto(run), replayed: true };
      }
      throw new DiscoveryServiceError("invalid_state");
    }

    const reservationKey = capacityReservationKey(
      input.project.id,
      run.idempotency_key,
    );
    const reservation = await reserveDiscoveryMonthlyCapacityInTransaction(
      client,
      {
        organizationId: input.project.organizationId,
        idempotencyKey: reservationKey,
        requestedCandidates: numberValue(run.requested_count),
      },
    );
    if (!reservation.allowed) {
      throw new DiscoveryServiceError("monthly_candidate_budget_exhausted");
    }
    const jobId = await ensureRunJob(client, { runId: run.id, userId });
    await client.query(
      `UPDATE leadgrid_discovery_runs
          SET status = 'queued',
              background_job_id = $2::uuid,
              error_code = NULL,
              error_message = NULL,
              version = version + 1
        WHERE id = $1::uuid`,
      [run.id, jobId],
    );
    await bindDiscoveryCapacityReservation(client, {
      organizationId: input.project.organizationId,
      idempotencyKey: reservationKey,
      runId: run.id,
    });
    const updated = await loadRun(client, input.project, run.id);
    if (!updated) throw new DiscoveryServiceError("internal_error");
    return { run: toRunDto(updated), replayed: false };
  });
}

export async function cancelDiscoveryRun(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    userId: string;
    runId: string;
  },
): Promise<DiscoveryRunMutationDto> {
  assertProject(input.project);
  requiredText(input.userId, "user_id");
  return cancelDiscoveryRunInProject(pool, {
    project: input.project,
    runId: input.runId,
  });
}

/**
 * Internal-only cancellation for a child owned by an already-authorized,
 * durable workflow. HTTP routes always use cancelDiscoveryRun and require a
 * current user; the campaign worker uses this only after reading a scoped
 * parent in cancel_requested state.
 */
export async function cancelDiscoveryRunFromTrustedWorkflow(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    campaignId: string;
    runId: string;
  },
): Promise<DiscoveryRunMutationDto> {
  assertProject(input.project);
  return cancelDiscoveryRunInProject(pool, input);
}

async function cancelDiscoveryRunInProject(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    runId: string;
    campaignId?: string;
  },
): Promise<DiscoveryRunMutationDto> {
  return withTransaction(pool, async (client) => {
    const run = input.campaignId
      ? (
          await client.query<RunRow>(
            `SELECT ${RUN_COLUMNS}
               FROM leadgrid_discovery_runs r
               JOIN leadgrid_discovery_campaign_runs c
                 ON c.organization_id = r.organization_id
                AND c.project_id = r.project_id
                AND c.active_run_id = r.id
              WHERE r.organization_id = $1::uuid
                AND r.project_id = $2
                AND r.id = $3::uuid
                AND c.id = $4::uuid
                AND c.status = 'cancel_requested'
              FOR UPDATE OF r, c
              LIMIT 1`,
            [
              input.project.organizationId,
              input.project.id,
              input.runId,
              input.campaignId,
            ],
          )
        ).rows[0] ?? null
      : await loadRun(client, input.project, input.runId, true);
    if (!run) throw new DiscoveryServiceError("not_found");
    if (run.status === "cancelled") {
      return { run: toRunDto(run), replayed: true };
    }
    if (
      ["review_ready", "partial", "completed", "failed"].includes(run.status)
    ) {
      throw new DiscoveryServiceError("invalid_state");
    }

    let status: DiscoveryRunStatus = "cancel_requested";
    if (["planning", "awaiting_confirmation"].includes(run.status)) {
      status = "cancelled";
    } else if (run.status === "queued" && run.background_job_id) {
      const cancelledJob = await client.query(
        `UPDATE background_jobs
            SET status = 'completed',
                completed_at = NOW(),
                updated_at = NOW(),
                result = '{"cancelled":true}'::jsonb,
                last_error = NULL
          WHERE id = $1::uuid
            AND status = 'queued'`,
        [run.background_job_id],
      );
      if ((cancelledJob.rowCount ?? 0) > 0) status = "cancelled";
    }

    // status is reused in the CASE below; the explicit cast prevents
    // PostgreSQL 42P08 when the parameter is inferred as varchar and text.
    await client.query(
      `UPDATE leadgrid_discovery_runs
          SET status = $2::text,
              cancellation_requested_at =
                COALESCE(cancellation_requested_at, NOW()),
              finished_at = CASE
                WHEN $2::text = 'cancelled' THEN COALESCE(finished_at, NOW())
                ELSE finished_at
              END,
              version = version + 1
        WHERE id = $1::uuid`,
      [run.id, status],
    );
    const updated = await loadRun(client, input.project, run.id);
    if (!updated) throw new DiscoveryServiceError("internal_error");
    return { run: toRunDto(updated), replayed: false };
  });
}

export async function getDiscoveryRun(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    runId: string;
  },
): Promise<DiscoveryRunDto> {
  assertProject(input.project);
  const run = await loadRun(pool, input.project, input.runId);
  if (!run) throw new DiscoveryServiceError("not_found");
  return toRunDto(run);
}

export type DiscoveryRunListStatus = DiscoveryRunStatus | "active";

const DISCOVERY_RUN_STATUSES = new Set<DiscoveryRunStatus>([
  "planning",
  "awaiting_confirmation",
  "queued",
  "searching",
  "researching",
  "review_ready",
  "completed",
  "partial",
  "cancel_requested",
  "cancelled",
  "failed",
]);

const ACTIVE_RUN_STATUSES: DiscoveryRunStatus[] = [
  "planning",
  "awaiting_confirmation",
  "queued",
  "searching",
  "researching",
  "cancel_requested",
];

export async function listDiscoveryRuns(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    statuses?: DiscoveryRunListStatus[];
    limit?: number;
  },
): Promise<{ runs: DiscoveryRunDto[] }> {
  assertProject(input.project);
  const limit =
    Number.isInteger(input.limit) && (input.limit as number) > 0
      ? Math.min(input.limit as number, 100)
      : 30;
  const requested = input.statuses ?? [];
  const expanded = new Set<DiscoveryRunStatus>();
  for (const status of requested) {
    if (status === "active") {
      for (const active of ACTIVE_RUN_STATUSES) expanded.add(active);
    } else if (DISCOVERY_RUN_STATUSES.has(status)) {
      expanded.add(status);
    } else {
      throw new DiscoveryServiceError("validation_error", { field: "status" });
    }
  }
  const statuses = [...expanded];
  const result = await pool.query<RunRow>(
    `SELECT ${RUN_COLUMNS}
       FROM leadgrid_discovery_runs r
      WHERE r.organization_id = $1::uuid
        AND r.project_id = $2
        AND (
          COALESCE(array_length($3::text[], 1), 0) = 0
          OR r.status = ANY($3::text[])
        )
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT $4`,
    [input.project.organizationId, input.project.id, statuses, limit],
  );
  return { runs: result.rows.map(toRunDto) };
}

interface CandidateListRow {
  id: string;
  run_id: string;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  website_url: string | null;
  phone: string | null;
  email: string | null;
  source_uri: string | null;
  organization_number: string | null;
  organization_form: string | null;
  organization_form_code: string | null;
  organization_structure: string | null;
  subject_kind: string | null;
  entity_kind: string | null;
  entity_kind_confidence: string | null;
  entity_kind_evidence: unknown[] | null;
  normalized_location_key: string | null;
  nace_code: string | null;
  nace_description: string | null;
  employee_count: number | null;
  registered_in_vat_register: boolean | null;
  registered_in_business_register: boolean | null;
  website_quality: Record<string, unknown> | null;
  observation_origin: string | null;
  observation_observed_at: string | Date | null;
  observation_captured_at: string | Date | null;
  profile_id: string | null;
  profile_name: string | null;
  profile_version: number | null;
  territory_code: string | null;
  observed_run_count: number | string;
  observed_in_profiles: unknown[] | null;
  status: string;
  research_status: string;
  disposition: DiscoveryOccurrenceDisposition;
  fit_score: number | null;
  fit_coverage: number | string;
  data_quality_score: number | null;
  data_quality_coverage: number | string;
  excluded: boolean;
  exclusion_matches: unknown[] | null;
  score_explanation: Record<string, unknown> | null;
  reasons: unknown[] | null;
  evidence: unknown[] | null;
  existing_lead_id: string | null;
  imported_lead_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  cursor_sort_value: number | string | null;
}

interface ClinicGroupContextRow {
  id: string;
  name: string;
  organization_number: string | null;
  entity_kind: string;
  entity_kind_confidence: string;
  normalized_location_key: string;
  address: string | null;
  website_url: string | null;
  status: string;
  imported_lead_id: string | null;
}

function candidateEntityKind(value: unknown): DiscoveryEntityKind {
  return value === "clinic" || value === "practitioner" ? value : "unknown";
}

function candidateEntityConfidence(
  value: unknown,
): DiscoveryClassificationConfidence {
  return value === "high" || value === "medium" ? value : "low";
}

function clinicGroupCandidate(
  row: ClinicGroupContextRow,
): DiscoveryClinicGroupCandidate {
  return {
    id: row.id,
    name: row.name,
    organizationNumber: row.organization_number,
    entityKind: candidateEntityKind(row.entity_kind),
    entityConfidence: candidateEntityConfidence(row.entity_kind_confidence),
    normalizedLocationKey: row.normalized_location_key,
    address: row.address,
    websiteUrl: row.website_url,
    status: row.status,
    importedLeadId: row.imported_lead_id,
  };
}

async function loadClinicGroupCandidates(
  queryable: Queryable,
  project: LeadgridAccessibleProject,
  locationKeys: string[],
  forUpdate = false,
): Promise<DiscoveryClinicGroupCandidate[]> {
  if (locationKeys.length === 0) return [];
  const result = await queryable.query<ClinicGroupContextRow>(
    `SELECT id::text, name, organization_number, entity_kind,
            entity_kind_confidence, normalized_location_key, address,
            website_url, status, imported_lead_id::text
       FROM leadgrid_discovery_candidates
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND normalized_location_key = ANY($3::text[])
        AND entity_kind IN ('clinic', 'practitioner')
      ORDER BY normalized_location_key, id
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [project.organizationId, project.id, locationKeys],
  );
  return result.rows.map(clinicGroupCandidate);
}

function observationMetadata(input: {
  origin: unknown;
  observedAt: string | Date | null | undefined;
  capturedAt: string | Date | null | undefined;
}): DiscoveryObservationMetadataDto {
  const origin: DiscoveryObservationOrigin =
    input.origin === "provider_observation" ||
    input.origin === "rolling_deploy_canonical_fallback" ||
    input.origin === "legacy_backfill_current_canonical"
      ? input.origin
      : "unknown";
  return {
    origin,
    observed_at: dateText(input.observedAt),
    captured_at: dateText(input.capturedAt),
    is_approximate: origin !== "provider_observation",
  };
}

function defaultClinicGroup(
  row: Pick<CandidateListRow, "id" | "name" | "entity_kind" | "imported_lead_id">,
): DiscoveryClinicGroup {
  const kind = candidateEntityKind(row.entity_kind);
  return {
    role:
      kind === "clinic"
        ? "clinic_account"
        : kind === "practitioner"
          ? "independent_practice"
          : "ambiguous",
    clinic_candidate_id: kind === "clinic" ? row.id : null,
    clinic_name: kind === "clinic" ? row.name : null,
    clinic_lead_id: kind === "clinic" ? row.imported_lead_id : null,
    relationship_confidence: null,
    evidence: ["insufficient_group_context"],
    practitioners: [],
  };
}

function toCandidateDto(
  row: CandidateListRow,
  clinicGroup?: DiscoveryClinicGroup,
): DiscoveryCandidateDto {
  const observedInProfiles: DiscoveryProfileObservationDto[] = Array.isArray(
    row.observed_in_profiles,
  )
    ? row.observed_in_profiles.flatMap((value) => {
        const observation = objectValue(value);
        const lastSeenAt = dateText(
          observation.last_seen_at as string | Date | null,
        );
        if (!lastSeenAt) return [];
        return [
          {
            profile_id: nullableText(observation.profile_id),
            profile_name: nullableText(observation.profile_name),
            profile_version:
              observation.profile_version == null
                ? null
                : numberValue(observation.profile_version),
            territory_code: nullableText(observation.territory_code),
            run_count: numberValue(observation.run_count),
            last_seen_at: lastSeenAt,
          },
        ];
      })
    : [];
  const organizationStructure =
    row.organization_structure === "independent" ||
    row.organization_structure === "chain"
      ? row.organization_structure
      : "unknown";
  return {
    id: row.id,
    run_id: row.run_id,
    name: row.name,
    address: row.address,
    city: row.city,
    postal_code: row.postal_code,
    country_code: row.country_code,
    latitude: row.latitude == null ? null : numberValue(row.latitude),
    longitude: row.longitude == null ? null : numberValue(row.longitude),
    website_url: row.website_url,
    phone: row.phone,
    email: row.email,
    source: "brreg_open_data",
    source_uri: row.source_uri,
    organization_number: row.organization_number,
    organization_form: row.organization_form,
    organization_form_code: row.organization_form_code,
    organization_structure: organizationStructure,
    subject_kind: row.subject_kind === "person" ? "person" : "organization",
    entity_kind: candidateEntityKind(row.entity_kind),
    entity_kind_confidence: candidateEntityConfidence(
      row.entity_kind_confidence,
    ),
    entity_kind_evidence: Array.isArray(row.entity_kind_evidence)
      ? row.entity_kind_evidence.filter(
          (evidence): evidence is string => typeof evidence === "string",
        )
      : [],
    clinic_group: clinicGroup ?? defaultClinicGroup(row),
    nace_code: row.nace_code,
    nace_description: row.nace_description,
    employee_count: row.employee_count,
    registered_in_vat_register: row.registered_in_vat_register,
    registered_in_business_register: row.registered_in_business_register,
    website_quality: websiteQualityDto(row.website_quality),
    observation: observationMetadata({
      origin: row.observation_origin,
      observedAt: row.observation_observed_at,
      capturedAt: row.observation_captured_at,
    }),
    discovery_profile: {
      id: row.profile_id,
      name: row.profile_name,
      version:
        row.profile_version == null ? null : numberValue(row.profile_version),
      territory_code: row.territory_code,
    },
    observed_run_count: numberValue(row.observed_run_count),
    observed_in_profiles: observedInProfiles,
    sources: DISCOVERY_DATA_SOURCES,
    status: row.status,
    research_status: row.research_status,
    disposition: row.disposition,
    fit_score: row.fit_score == null ? null : numberValue(row.fit_score),
    fit_coverage: numberValue(row.fit_coverage),
    data_quality_score:
      row.data_quality_score == null
        ? null
        : numberValue(row.data_quality_score),
    data_quality_coverage: numberValue(row.data_quality_coverage),
    excluded: row.excluded,
    exclusion_matches: Array.isArray(row.exclusion_matches)
      ? row.exclusion_matches
      : [],
    score_explanation: objectValue(row.score_explanation),
    reasons: Array.isArray(row.reasons)
      ? row.reasons.filter(
          (reason): reason is string => typeof reason === "string",
        )
      : [],
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    existing_lead_id: row.existing_lead_id,
    imported_lead_id: row.imported_lead_id,
    created_at: dateText(row.created_at) as string,
    updated_at: dateText(row.updated_at) as string,
  };
}

export async function listDiscoveryCandidates(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    runId: string;
    cursor?: string;
    disposition: "pending" | "approved" | "rejected" | "duplicate" | "all";
    sort: "score_desc" | "newest";
    limit: number;
  },
): Promise<{ items: DiscoveryCandidateDto[]; next_cursor: string | null }> {
  assertProject(input.project);
  const runId = requiredText(input.runId, "run_id");
  const limit =
    Number.isInteger(input.limit) && input.limit > 0
      ? Math.min(input.limit, 100)
      : 50;
  if (
    !["pending", "approved", "rejected", "duplicate", "all"].includes(
      input.disposition,
    )
  ) {
    throw new DiscoveryServiceError("validation_error", {
      field: "disposition",
    });
  }
  if (!["score_desc", "newest"].includes(input.sort)) {
    throw new DiscoveryServiceError("validation_error", { field: "sort" });
  }

  const cursor = input.cursor ? decodeDiscoveryCursor(input.cursor) : null;
  if (input.cursor && !cursor) {
    throw new DiscoveryServiceError("invalid_cursor", { field: "cursor" });
  }

  const params: unknown[] = [
    input.project.organizationId,
    input.project.id,
    runId,
  ];
  const conditions = [
    "r.organization_id = $1::uuid",
    "r.project_id = $2",
    "r.id = $3::uuid",
  ];
  if (input.disposition === "pending") {
    conditions.push(
      "rc.disposition IN ('found','existing_candidate','research_pending','researching','review_ready','failed')",
    );
  } else if (input.disposition === "approved") {
    conditions.push("rc.disposition IN ('approved','imported')");
  } else if (input.disposition !== "all") {
    params.push(input.disposition);
    conditions.push(`rc.disposition = $${params.length}`);
  }

  const sortExpression =
    input.sort === "score_desc"
      ? "rc.fit_score::double precision"
      : "EXTRACT(EPOCH FROM rc.created_at)::double precision";
  if (cursor) {
    params.push(cursor.score);
    const scoreParam = params.length;
    params.push(cursor.id);
    const idParam = params.length;
    if (cursor.score === null) {
      conditions.push(
        `(${sortExpression} IS NULL AND rc.candidate_id > $${idParam}::uuid)`,
      );
    } else {
      conditions.push(
        `(${sortExpression} < $${scoreParam}::double precision
          OR (${sortExpression} = $${scoreParam}::double precision
              AND rc.candidate_id > $${idParam}::uuid)
          OR ${sortExpression} IS NULL)`,
      );
    }
  }
  params.push(limit + 1);
  const limitParam = params.length;

  const result = await pool.query<CandidateListRow>(
    `SELECT c.id::text,
            rc.run_id::text,
            observation.name,
            observation.address,
            observation.city,
            observation.postal_code,
            observation.country_code,
            observation.latitude,
            observation.longitude,
            observation.website_url,
            observation.phone,
            observation.email,
            observation.raw_data->>'source_uri' AS source_uri,
            observation.organization_number,
            observation.raw_data->>'organization_form' AS organization_form,
            observation.raw_data->>'organization_form_code' AS organization_form_code,
            observation.raw_data->>'organization_structure' AS organization_structure,
            COALESCE(r.brief_snapshot->>'subject_kind', 'organization')
              AS subject_kind,
            c.entity_kind,
            c.entity_kind_confidence,
            c.entity_kind_evidence,
            c.normalized_location_key,
            observation.raw_data->>'nace_code' AS nace_code,
            observation.raw_data->>'nace_description' AS nace_description,
            CASE WHEN jsonb_typeof(observation.raw_data->'employee_count') = 'number'
              THEN (observation.raw_data->>'employee_count')::int ELSE NULL END
              AS employee_count,
            CASE WHEN jsonb_typeof(observation.raw_data->'registered_in_vat_register') = 'boolean'
              THEN (observation.raw_data->>'registered_in_vat_register')::boolean
              ELSE NULL END AS registered_in_vat_register,
            CASE WHEN jsonb_typeof(observation.raw_data->'registered_in_business_register') = 'boolean'
              THEN (observation.raw_data->>'registered_in_business_register')::boolean
              ELSE NULL END AS registered_in_business_register,
            observation.raw_data->'website_quality' AS website_quality,
            rc.observation_snapshot->>'snapshot_origin'
              AS observation_origin,
            rc.observation_snapshot->>'observed_at'
              AS observation_observed_at,
            rc.observation_snapshot->>'captured_at'
              AS observation_captured_at,
            r.profile_id::text AS profile_id,
            p.name AS profile_name,
            r.profile_version,
            r.brief_snapshot->>'territory_code' AS territory_code,
            COALESCE(observations.observed_run_count, 0)
              AS observed_run_count,
            COALESCE(
              observations.observed_in_profiles,
              '[]'::jsonb
            ) AS observed_in_profiles,
            c.status,
            c.research_status,
            rc.disposition,
            rc.fit_score,
            rc.fit_coverage,
            rc.data_quality_score,
            rc.data_quality_coverage,
            rc.excluded,
            rc.exclusion_matches,
            rc.score_explanation,
            COALESCE(
              rc.score_components->'reasons',
              '[]'::jsonb
            ) AS reasons,
            rc.evidence,
            c.existing_lead_id::text,
            c.imported_lead_id::text,
            rc.created_at,
            rc.updated_at,
            ${sortExpression} AS cursor_sort_value
       FROM leadgrid_discovery_runs r
       JOIN leadgrid_discovery_run_candidates rc
         ON rc.run_id = r.id
        AND rc.organization_id = r.organization_id
        AND rc.project_id = r.project_id
       JOIN leadgrid_discovery_candidates c
         ON c.id = rc.candidate_id
        AND c.organization_id = rc.organization_id
        AND c.project_id = rc.project_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(
                  NULLIF(rc.observation_snapshot->>'name', ''),
                  'Ukjent virksomhet'
                ) AS name,
                NULLIF(rc.observation_snapshot->>'address', '') AS address,
                NULLIF(rc.observation_snapshot->>'city', '') AS city,
                NULLIF(
                  rc.observation_snapshot->>'postal_code',
                  ''
                ) AS postal_code,
                NULLIF(
                  rc.observation_snapshot->>'country_code',
                  ''
                ) AS country_code,
                CASE
                  WHEN jsonb_typeof(rc.observation_snapshot->'latitude') = 'number'
                    THEN (rc.observation_snapshot->>'latitude')::double precision
                  ELSE NULL
                END AS latitude,
                CASE
                  WHEN jsonb_typeof(rc.observation_snapshot->'longitude') = 'number'
                    THEN (rc.observation_snapshot->>'longitude')::double precision
                  ELSE NULL
                END AS longitude,
                NULLIF(
                  rc.observation_snapshot->>'website_url',
                  ''
                ) AS website_url,
                NULLIF(rc.observation_snapshot->>'phone', '') AS phone,
                NULLIF(rc.observation_snapshot->>'email', '') AS email,
                NULLIF(
                  rc.observation_snapshot->>'organization_number',
                  ''
                ) AS organization_number,
                CASE
                  WHEN jsonb_typeof(rc.observation_snapshot->'raw_data') = 'object'
                    THEN rc.observation_snapshot->'raw_data'
                  ELSE '{}'::jsonb
                END AS raw_data
       ) observation ON TRUE
       LEFT JOIN leadgrid_discovery_profiles p
         ON p.id = r.profile_id
        AND p.organization_id = r.organization_id
        AND p.project_id = r.project_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(history.run_count), 0)::int
                  AS observed_run_count,
                COALESCE(
                  jsonb_agg(
                    jsonb_build_object(
                      'profile_id', history.profile_id,
                      'profile_name', history.profile_name,
                      'profile_version', history.profile_version,
                      'territory_code', history.territory_code,
                      'run_count', history.run_count,
                      'last_seen_at', history.last_seen_at
                    )
                    ORDER BY history.last_seen_at DESC,
                             history.profile_id NULLS LAST
                  ),
                  '[]'::jsonb
                ) AS observed_in_profiles
           FROM (
             SELECT history_run.profile_id::text AS profile_id,
                    history_profile.name AS profile_name,
                    MAX(history_run.profile_version)::int AS profile_version,
                    history_run.brief_snapshot->>'territory_code'
                      AS territory_code,
                    COUNT(DISTINCT history_rc.run_id)::int AS run_count,
                    MAX(history_rc.created_at) AS last_seen_at
               FROM leadgrid_discovery_run_candidates history_rc
               JOIN leadgrid_discovery_runs history_run
                 ON history_run.id = history_rc.run_id
                AND history_run.organization_id = history_rc.organization_id
                AND history_run.project_id = history_rc.project_id
               LEFT JOIN leadgrid_discovery_profiles history_profile
                 ON history_profile.id = history_run.profile_id
                AND history_profile.organization_id = history_run.organization_id
                AND history_profile.project_id = history_run.project_id
              WHERE history_rc.organization_id = $1::uuid
                AND history_rc.project_id = $2
                AND history_rc.candidate_id = c.id
              GROUP BY history_run.profile_id, history_profile.name,
                       history_run.brief_snapshot->>'territory_code'
           ) history
       ) observations ON TRUE
      WHERE ${conditions.join("\n        AND ")}
      ORDER BY ${sortExpression} DESC NULLS LAST, rc.candidate_id ASC
      LIMIT $${limitParam}`,
    params,
  );
  const hasMore = result.rows.length > limit;
  const pageRows = result.rows.slice(0, limit);
  const locationKeys = [
    ...new Set(
      pageRows.flatMap((row) =>
        row.normalized_location_key ? [row.normalized_location_key] : [],
      ),
    ),
  ];
  let groupCandidates: DiscoveryClinicGroupCandidate[] = pageRows.map((row) => ({
    id: row.id,
    name: row.name,
    organizationNumber: row.organization_number,
    entityKind: candidateEntityKind(row.entity_kind),
    entityConfidence: candidateEntityConfidence(row.entity_kind_confidence),
    normalizedLocationKey: row.normalized_location_key,
    address: row.address,
    websiteUrl: row.website_url,
    status: row.status,
    importedLeadId: row.imported_lead_id,
  }));
  if (locationKeys.length > 0) {
    const context = await loadClinicGroupCandidates(
      pool,
      input.project,
      locationKeys,
    );
    const byId = new Map(groupCandidates.map((candidate) => [candidate.id, candidate]));
    for (const candidate of context) byId.set(candidate.id, candidate);
    groupCandidates = [...byId.values()];
  }
  const clinicGroups = buildDiscoveryClinicGroups(groupCandidates);
  const last = pageRows.at(-1);
  return {
    items: pageRows.map((row) => toCandidateDto(row, clinicGroups.get(row.id))),
    next_cursor:
      hasMore && last
        ? encodeDiscoveryCursor(
            last.cursor_sort_value == null
              ? null
              : numberValue(last.cursor_sort_value),
            last.id,
          )
        : null,
  };
}

async function refreshRunCounts(
  queryable: Queryable,
  runId: string,
): Promise<void> {
  await queryable.query(
    `UPDATE leadgrid_discovery_runs r
        SET candidate_count = counts.candidate_count,
            excluded_count = counts.excluded_count,
            researched_count = counts.researched_count,
            review_ready_count = counts.review_ready_count,
            approved_count = counts.approved_count,
            rejected_count = counts.rejected_count,
            imported_count = counts.imported_count,
            failed_count = counts.failed_count,
            version = r.version + 1
       FROM (
         SELECT COUNT(*)::int AS candidate_count,
                COUNT(*) FILTER (WHERE excluded)::int AS excluded_count,
                COUNT(*) FILTER (
                  WHERE disposition IN ('review_ready','approved','rejected','imported')
                )::int AS researched_count,
                COUNT(*) FILTER (WHERE disposition = 'review_ready')::int
                  AS review_ready_count,
                COUNT(*) FILTER (WHERE disposition IN ('approved','imported'))::int
                  AS approved_count,
                COUNT(*) FILTER (WHERE disposition = 'rejected')::int
                  AS rejected_count,
                COUNT(*) FILTER (WHERE disposition = 'imported')::int
                  AS imported_count,
                COUNT(*) FILTER (WHERE disposition = 'failed')::int
                  AS failed_count
           FROM leadgrid_discovery_run_candidates
          WHERE run_id = $1::uuid
       ) counts
      WHERE r.id = $1::uuid`,
    [runId],
  );
}

interface DecisionCandidateRow {
  candidate_id: string;
  run_id: string;
  run_status: DiscoveryRunStatus;
  candidate_status: string;
  disposition: DiscoveryOccurrenceDisposition;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  website_url: string | null;
  organization_number: string | null;
  entity_kind: string | null;
  entity_kind_confidence: string | null;
  entity_kind_evidence: unknown[] | null;
  normalized_location_key: string | null;
  observation_origin: string | null;
  observation_observed_at: string | Date | null;
  observation_captured_at: string | Date | null;
  profile_id: string | null;
  profile_version: number | null;
  brief_snapshot: Record<string, unknown> | null;
  source_hits: unknown[] | null;
  provenance: unknown[] | null;
  enrichment_data: Record<string, unknown> | null;
  imported_lead_id: string | null;
  existing_lead_id: string | null;
}

async function loadDecisionCandidate(
  queryable: Queryable,
  input: {
    project: LeadgridAccessibleProject;
    runId: string;
    candidateId: string;
  },
): Promise<DecisionCandidateRow | null> {
  const result = await queryable.query<DecisionCandidateRow>(
    `SELECT c.id::text AS candidate_id,
            rc.run_id::text,
            r.status AS run_status,
            c.status AS candidate_status,
            rc.disposition,
            observation.name,
            observation.phone,
            observation.email,
            observation.address,
            observation.city,
            observation.postal_code,
            observation.latitude,
            observation.longitude,
            observation.website_url,
            observation.organization_number,
            c.entity_kind,
            c.entity_kind_confidence,
            c.entity_kind_evidence,
            c.normalized_location_key,
            rc.observation_snapshot->>'snapshot_origin'
              AS observation_origin,
            rc.observation_snapshot->>'observed_at'
              AS observation_observed_at,
            rc.observation_snapshot->>'captured_at'
              AS observation_captured_at,
            r.profile_id::text,
            r.profile_version,
            r.brief_snapshot,
            rc.source_hits,
            observation.provenance,
            observation.enrichment_data,
            c.imported_lead_id::text,
            c.existing_lead_id::text
       FROM leadgrid_discovery_runs r
       JOIN leadgrid_discovery_run_candidates rc
         ON rc.run_id = r.id
        AND rc.organization_id = r.organization_id
        AND rc.project_id = r.project_id
       JOIN leadgrid_discovery_candidates c
         ON c.id = rc.candidate_id
        AND c.organization_id = rc.organization_id
        AND c.project_id = rc.project_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(
                  NULLIF(rc.observation_snapshot->>'name', ''),
                  'Ukjent virksomhet'
                ) AS name,
                NULLIF(rc.observation_snapshot->>'phone', '') AS phone,
                NULLIF(rc.observation_snapshot->>'email', '') AS email,
                NULLIF(rc.observation_snapshot->>'address', '') AS address,
                NULLIF(rc.observation_snapshot->>'city', '') AS city,
                NULLIF(
                  rc.observation_snapshot->>'postal_code',
                  ''
                ) AS postal_code,
                CASE
                  WHEN jsonb_typeof(rc.observation_snapshot->'latitude') = 'number'
                    THEN (rc.observation_snapshot->>'latitude')::double precision
                  ELSE NULL
                END AS latitude,
                CASE
                  WHEN jsonb_typeof(rc.observation_snapshot->'longitude') = 'number'
                    THEN (rc.observation_snapshot->>'longitude')::double precision
                  ELSE NULL
                END AS longitude,
                NULLIF(
                  rc.observation_snapshot->>'website_url',
                  ''
                ) AS website_url,
                NULLIF(
                  rc.observation_snapshot->>'organization_number',
                  ''
                ) AS organization_number,
                CASE
                  WHEN jsonb_typeof(
                    rc.observation_snapshot->'provenance'
                  ) = 'array'
                    THEN rc.observation_snapshot->'provenance'
                  ELSE '[]'::jsonb
                END AS provenance,
                CASE
                  WHEN jsonb_typeof(
                    rc.observation_snapshot->'enrichment_data'
                  ) = 'object'
                    THEN rc.observation_snapshot->'enrichment_data'
                  ELSE '{}'::jsonb
                END AS enrichment_data
       ) observation ON TRUE
      WHERE r.organization_id = $1::uuid
        AND r.project_id = $2
        AND r.id = $3::uuid
        AND c.id = $4::uuid
      FOR UPDATE OF r, c, rc
      LIMIT 1`,
    [
      input.project.organizationId,
      input.project.id,
      input.runId,
      input.candidateId,
    ],
  );
  return result.rows[0] ?? null;
}

function parseDecision(value: unknown): DiscoveryDecision {
  const parsed = discoveryDecisionSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DiscoveryServiceError("validation_error", {
      field: issue?.path.map(String).join(".") || "decision",
    });
  }
  return parsed.data;
}

function parseFeedback(value: unknown): DiscoveryFeedback {
  const parsed = discoveryFeedbackSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DiscoveryServiceError("validation_error", {
      field: issue?.path.map(String).join(".") || "feedback",
    });
  }
  return parsed.data;
}

interface SafePromotionEnrichment {
  organizationNumber: string | null;
  data: Record<string, unknown> | null;
  enrichedAt: string | null;
}

function norwegianOrganizationNumber(value: unknown): string | null {
  const compact =
    typeof value === "string" ? value.replace(/[\s-]/g, "").trim() : "";
  return /^\d{9}$/.test(compact) ? compact : null;
}

function safePromotionEnrichment(
  candidate: Pick<
    DecisionCandidateRow,
    "organization_number" | "enrichment_data"
  >,
): SafePromotionEnrichment {
  const organizationNumber = norwegianOrganizationNumber(
    candidate.organization_number,
  );
  const data = objectValue(candidate.enrichment_data);
  const company = objectValue(data.company);
  if (
    !organizationNumber ||
    data.found !== true ||
    data.source !== "brreg" ||
    data.autoLinked !== true ||
    norwegianOrganizationNumber(company.orgNr) !== organizationNumber ||
    typeof company.name !== "string" ||
    !company.name.trim()
  ) {
    return { organizationNumber: null, data: null, enrichedAt: null };
  }

  const fetchedAt =
    typeof data.fetchedAt === "string" ? Date.parse(data.fetchedAt) : NaN;
  return {
    organizationNumber,
    data,
    enrichedAt: Number.isFinite(fetchedAt)
      ? new Date(fetchedAt).toISOString()
      : null,
  };
}

async function attachClinicPractitioners(
  client: PoolClient,
  input: {
    project: LeadgridAccessibleProject;
    userId: string;
    runId: string;
    clinicCandidateId: string;
    leadId: string;
    normalizedLocationKey: string;
    group: DiscoveryClinicGroup;
  },
): Promise<{ contactCount: number; affectedRunIds: string[] }> {
  const practitioners = input.group.practitioners;
  if (practitioners.length === 0) {
    return { contactCount: 0, affectedRunIds: [] };
  }

  const practitionerIds = practitioners.map(
    (practitioner) => practitioner.candidate_id,
  );
  const eligible = await client.query<{
    id: string;
    name: string;
    organization_number: string | null;
  }>(
    `UPDATE leadgrid_discovery_candidates
        SET status = 'imported',
            imported_lead_id = $2::uuid,
            existing_lead_id = COALESCE(existing_lead_id, $2::uuid),
            decided_by = $3,
            decided_at = NOW(),
            imported_at = COALESCE(imported_at, NOW()),
            updated_by = $3,
            version = version + 1
      WHERE id = ANY($1::uuid[])
        AND organization_id = $4::uuid
        AND project_id = $5
        AND entity_kind = 'practitioner'
        AND normalized_location_key = $6
        AND status NOT IN ('rejected', 'archived', 'failed', 'imported')
      RETURNING id::text, name, organization_number`,
    [
      practitionerIds,
      input.leadId,
      input.userId,
      input.project.organizationId,
      input.project.id,
      input.normalizedLocationKey,
    ],
  );
  const eligibleIds = new Set(eligible.rows.map((row) => row.id));
  const relationshipById = new Map(
    practitioners.map((practitioner) => [
      practitioner.candidate_id,
      practitioner,
    ]),
  );
  for (const practitioner of eligible.rows) {
    const relationship = relationshipById.get(practitioner.id);
    if (!relationship) continue;
    await client.query(
      `INSERT INTO leadgrid_customer_contacts (
          organization_id, project_id, customer_id, name, role,
          organization_number, source, source_candidate_id,
          relationship_confidence, relationship_evidence, confirmed_by
        ) VALUES (
          $1::uuid, $2, $3::uuid, $4, 'Tannlege',
          $5, 'discovery', $6::uuid, $7, $8::jsonb, $9
        )
        ON CONFLICT (
          organization_id, project_id, customer_id, source_candidate_id
        ) WHERE source_candidate_id IS NOT NULL
        DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          organization_number = EXCLUDED.organization_number,
          relationship_confidence = EXCLUDED.relationship_confidence,
          relationship_evidence = EXCLUDED.relationship_evidence,
          confirmed_by = EXCLUDED.confirmed_by,
          updated_at = NOW()`,
      [
        input.project.organizationId,
        input.project.id,
        input.leadId,
        practitioner.name,
        practitioner.organization_number,
        practitioner.id,
        relationship.relationship_confidence,
        JSON.stringify(relationship.evidence),
        input.userId,
      ],
    );
    await client.query(
      `INSERT INTO leadgrid_discovery_feedback (
          id, organization_id, project_id, candidate_id, run_id, lead_id,
          event_type, value, reason_code, note, source, actor_user_id,
          idempotency_key
        ) VALUES (
          gen_random_uuid(), $1::uuid, $2, $3::uuid, $4::uuid, $5::uuid,
          'decision', 'grouped_contact', 'good_fit',
          'Godkjent som tannlegekontakt i klinikkgruppen.',
          'user', $6, $7
        )
        ON CONFLICT DO NOTHING`,
      [
        input.project.organizationId,
        input.project.id,
        practitioner.id,
        input.runId,
        input.leadId,
        input.userId,
        `clinic-group:${input.clinicCandidateId}`,
      ],
    );
  }

  const propagated = await client.query<{ run_id: string }>(
    `UPDATE leadgrid_discovery_run_candidates
        SET disposition = 'imported',
            updated_at = NOW()
      WHERE candidate_id = ANY($1::uuid[])
        AND organization_id = $2::uuid
        AND project_id = $3
        AND disposition IN (
          'found', 'existing_candidate', 'research_pending',
          'researching', 'review_ready', 'failed'
        )
      RETURNING run_id::text`,
    [[...eligibleIds], input.project.organizationId, input.project.id],
  );

  const primary = eligible.rows[0];
  if (primary) {
    await client.query(
      `UPDATE crm_customers
          SET contact_name = COALESCE(contact_name, $4),
              contact_role = COALESCE(contact_role, 'Tannlege'),
              updated_at = NOW()
        WHERE id = $1::uuid
          AND organization_id = $2::uuid
          AND project_id IS NOT DISTINCT FROM $3`,
      [
        input.leadId,
        input.project.organizationId,
        input.project.id,
        primary.name,
      ],
    );
  }
  return {
    contactCount: eligible.rows.length,
    affectedRunIds: propagated.rows.map((row) => row.run_id),
  };
}

async function attachTalentProspect(
  client: PoolClient,
  input: {
    project: LeadgridAccessibleProject;
    userId: string;
    candidateId: string;
    leadId: string;
    name: string;
    organizationNumber: string;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO leadgrid_customer_contacts (
       organization_id, project_id, customer_id, name, role,
       organization_number, source, source_candidate_id,
       relationship_confidence, relationship_evidence, confirmed_by,
       subject_kind, privacy_status, consent_status, privacy_review_due_at
     ) VALUES (
       $1::uuid, $2, $3::uuid, $4, 'Skuespiller / talent',
       $5, 'discovery', $6::uuid,
       'high', '["explicit_person_profile_approval","brreg_public_business_identity"]'::jsonb,
       $7, 'talent', 'notice_required', 'not_requested',
       NOW() + INTERVAL '90 days'
     )
     ON CONFLICT (
       organization_id, project_id, customer_id, source_candidate_id
     ) WHERE source_candidate_id IS NOT NULL
     DO UPDATE SET
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       organization_number = EXCLUDED.organization_number,
       subject_kind = 'talent',
       privacy_status = CASE
         WHEN leadgrid_customer_contacts.privacy_status IN ('opted_out', 'expired')
           THEN leadgrid_customer_contacts.privacy_status
         ELSE 'notice_required'
       END,
       consent_status = CASE
         WHEN leadgrid_customer_contacts.consent_status IN ('received', 'withdrawn')
           THEN leadgrid_customer_contacts.consent_status
         ELSE 'not_requested'
       END,
       privacy_review_due_at = COALESCE(
         leadgrid_customer_contacts.privacy_review_due_at,
         EXCLUDED.privacy_review_due_at
       ),
       confirmed_by = EXCLUDED.confirmed_by,
       updated_at = NOW()`,
    [
      input.project.organizationId,
      input.project.id,
      input.leadId,
      input.name,
      input.organizationNumber,
      input.candidateId,
      input.userId,
    ],
  );
}

export async function decideDiscoveryCandidate(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    userId: string;
    runId: string;
    candidateId: string;
    idempotencyKey: string;
    decision: unknown;
  },
): Promise<DiscoveryDecisionResultDto> {
  assertProject(input.project);
  const userId = requiredText(input.userId, "user_id");
  const runId = requiredText(input.runId, "run_id");
  const candidateId = requiredText(input.candidateId, "candidate_id");
  const idempotencyKey = requiredIdempotencyKey(input.idempotencyKey);
  const decision = parseDecision(input.decision);
  const requestHash = discoveryHash({
    run_id: runId,
    candidate_id: candidateId,
    decision,
  });

  const outcome = await withTransaction(pool, async (client) => {
    const decisionLockTarget = await client.query<{
      normalized_location_key: string | null;
    }>(
      `SELECT normalized_location_key
         FROM leadgrid_discovery_candidates
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND id = $3::uuid
        LIMIT 1`,
      [input.project.organizationId, input.project.id, candidateId],
    );
    const locationOrCandidate =
      decisionLockTarget.rows[0]?.normalized_location_key ?? candidateId;
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [
        [
          input.project.organizationId,
          input.project.id,
          "discovery-decision",
          locationOrCandidate,
        ].join("|"),
      ],
    );
    const candidate = await loadDecisionCandidate(client, {
      project: input.project,
      runId,
      candidateId,
    });
    if (!candidate) throw new DiscoveryServiceError("not_found");

    const replay = await client.query<{
      id: string;
      request_hash: string | null;
      lead_id: string | null;
      value: string;
      contact_count: number | string | null;
    }>(
      `SELECT feedback.id::text,
              feedback.request_hash,
              feedback.lead_id::text,
              feedback.value,
              CASE WHEN feedback.lead_id IS NULL THEN 0 ELSE (
                SELECT COUNT(*)::int
                  FROM leadgrid_customer_contacts contact
                 WHERE contact.organization_id = feedback.organization_id
                   AND contact.project_id = feedback.project_id
                   AND contact.customer_id = feedback.lead_id
                   AND contact.source = 'discovery'
              ) END AS contact_count
         FROM leadgrid_discovery_feedback feedback
        WHERE feedback.organization_id = $1::uuid
          AND feedback.project_id = $2
          AND feedback.candidate_id = $3::uuid
          AND feedback.idempotency_key = $4
        LIMIT 1`,
      [
        input.project.organizationId,
        input.project.id,
        candidateId,
        idempotencyKey,
      ],
    );
    if (replay.rows[0]) {
      if (replay.rows[0].request_hash !== requestHash) {
        throw new DiscoveryServiceError("idempotency_conflict");
      }
      return {
        result: {
          candidate_id: candidateId,
          run_id: runId,
          decision: decision.decision,
          candidate_status: candidate.candidate_status,
          lead_id:
            replay.rows[0].lead_id ??
            candidate.imported_lead_id ??
            candidate.existing_lead_id,
          feedback_id: replay.rows[0].id,
          contact_count: numberValue(replay.rows[0].contact_count),
          replayed: true,
        } satisfies DiscoveryDecisionResultDto,
        createdLead: false,
        affectedRunIds: [] as string[],
        completedRunIds: [] as string[],
      };
    }

    if (!["review_ready", "partial"].includes(candidate.run_status)) {
      throw new DiscoveryServiceError("invalid_state");
    }
    if (
      ["approved", "rejected", "imported", "archived"].includes(
        candidate.candidate_status,
      ) ||
      ["approved", "rejected", "imported", "duplicate"].includes(
        candidate.disposition,
      )
    ) {
      throw new DiscoveryServiceError("invalid_state");
    }

    const clinicContext = candidate.normalized_location_key
      ? await loadClinicGroupCandidates(
          client,
          input.project,
          [candidate.normalized_location_key],
          true,
        )
      : [];
    const clinicGroup =
      buildDiscoveryClinicGroups(clinicContext).get(candidateId) ?? {
        role:
          candidateEntityKind(candidate.entity_kind) === "clinic"
            ? "clinic_account"
            : candidateEntityKind(candidate.entity_kind) === "practitioner"
              ? "independent_practice"
              : "ambiguous",
        clinic_candidate_id:
          candidateEntityKind(candidate.entity_kind) === "clinic"
            ? candidateId
            : null,
        clinic_name:
          candidateEntityKind(candidate.entity_kind) === "clinic"
            ? candidate.name
            : null,
        clinic_lead_id: candidate.imported_lead_id,
        relationship_confidence: null,
        evidence: ["insufficient_group_context"],
        practitioners: [],
      } satisfies DiscoveryClinicGroup;
    if (
      decision.decision === "approve" &&
      clinicGroup.role === "practitioner_contact" &&
      !clinicGroup.clinic_lead_id
    ) {
      throw new DiscoveryServiceError("clinic_approval_required");
    }

    let leadId: string | null = null;
    let createdLead = false;
    let groupedContactCount = 0;
    let groupedAffectedRunIds: string[] = [];
    let candidateStateAlreadyUpdated = false;
    let candidateStatus = candidate.candidate_status;
    let disposition: DiscoveryOccurrenceDisposition = "rejected";
    if (decision.decision === "approve") {
      if (clinicGroup.role === "practitioner_contact") {
        const clinicLeadId = clinicGroup.clinic_lead_id;
        const relationshipConfidence = clinicGroup.relationship_confidence;
        if (
          !clinicLeadId ||
          !candidate.normalized_location_key ||
          !relationshipConfidence
        ) {
          throw new DiscoveryServiceError("clinic_approval_required");
        }
        const scopedClinicLead = await client.query<{ id: string }>(
          `SELECT id::text
             FROM crm_customers
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id IS NOT DISTINCT FROM $3
              AND archived_at IS NULL
            FOR UPDATE`,
          [
            clinicLeadId,
            input.project.organizationId,
            input.project.id,
          ],
        );
        if (!scopedClinicLead.rows[0]) {
          throw new DiscoveryServiceError("invalid_state");
        }
        leadId = clinicLeadId;
        const attached = await attachClinicPractitioners(client, {
          project: input.project,
          userId,
          runId,
          clinicCandidateId: clinicGroup.clinic_candidate_id ?? candidateId,
          leadId,
          normalizedLocationKey: candidate.normalized_location_key,
          group: {
            role: "clinic_account",
            clinic_candidate_id: clinicGroup.clinic_candidate_id,
            clinic_name: clinicGroup.clinic_name,
            clinic_lead_id: clinicLeadId,
            relationship_confidence: null,
            evidence: clinicGroup.evidence,
            practitioners: [
              {
                candidate_id: candidateId,
                name: candidate.name,
                organization_number: candidate.organization_number,
                relationship_confidence: relationshipConfidence,
                evidence: clinicGroup.evidence,
              },
            ],
          },
        });
        if (attached.contactCount !== 1) {
          throw new DiscoveryServiceError("invalid_state");
        }
        groupedContactCount = attached.contactCount;
        groupedAffectedRunIds = attached.affectedRunIds;
        candidateStateAlreadyUpdated = true;
      } else {
      const promotionEnrichment = safePromotionEnrichment(candidate);
      if (!promotionEnrichment.organizationNumber) {
        throw new DiscoveryServiceError("invalid_state");
      }
      const websiteDomain = normalizeWebsiteDomain(candidate.website_url);
      const confirmedGooglePlaceId = decision.confirmed_google_place_id ?? null;
      const googlePlaceConfirmedAt = confirmedGooglePlaceId
        ? new Date().toISOString()
        : null;
      const briefSnapshot = objectValue(candidate.brief_snapshot);
      const subjectKind =
        briefSnapshot.subject_kind === "person" ? "person" : "organization";
      const territoryCode = nullableText(briefSnapshot.territory_code);
      const municipalityNumbers = Array.isArray(
        briefSnapshot.municipality_numbers,
      )
        ? briefSnapshot.municipality_numbers.filter(
            (value): value is string =>
              typeof value === "string" && /^\d{4}$/.test(value),
          )
        : [];
      const municipalityNames = Array.isArray(briefSnapshot.municipality_names)
        ? briefSnapshot.municipality_names.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const observation = observationMetadata({
        origin: candidate.observation_origin,
        observedAt: candidate.observation_observed_at,
        capturedAt: candidate.observation_captured_at,
      });
      const promotionMetadata = {
        discovery: {
          run_id: runId,
          candidate_id: candidateId,
          profile_id: candidate.profile_id,
          profile_version: candidate.profile_version,
          territory_code: territoryCode,
          municipality_numbers: municipalityNumbers,
          municipality_names: municipalityNames,
          source: "brreg_open_data",
          subject_kind: subjectKind,
          privacy:
            subjectKind === "person"
              ? {
                  source: "brreg_open_data",
                  purpose: "b2b_prospecting",
                  role_room_talent_profile_created: false,
                  consent_status: "not_requested",
                  notice_status: "required_before_outreach",
                  review_after_days: 90,
                }
              : null,
          observation,
          source_hits: Array.isArray(candidate.source_hits)
            ? candidate.source_hits
            : [],
          candidate_provenance: Array.isArray(candidate.provenance)
            ? candidate.provenance
            : [],
          dedupe_checks: {
            organization_number: "checked",
            normalized_domain: websiteDomain ? "checked" : "not_available",
            google_place_id: confirmedGooglePlaceId
              ? "confirmed_match_checked"
              : "not_performed_no_confirmed_place_id",
          },
          google_places: confirmedGooglePlaceId
            ? {
                place_id: confirmedGooglePlaceId,
                confirmed_at: googlePlaceConfirmedAt,
                persisted_fields: ["place_id"],
              }
            : {
                status: "not_performed_no_confirmed_place_id",
                persisted_fields: [],
              },
          clinic_group: {
            role: clinicGroup.role,
            clinic_candidate_id: clinicGroup.clinic_candidate_id,
            included_contact_candidate_ids: clinicGroup.practitioners.map(
              (practitioner) => practitioner.candidate_id,
            ),
          },
        },
      };
      if (confirmedGooglePlaceId) {
        const confirmation = await client.query<{ place_id: string }>(
          `SELECT place_id
             FROM leadgrid_discovery_place_confirmations
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND run_id = $3::uuid
              AND candidate_id = $4::uuid
              AND place_id = $5
              AND requested_by = $6
              AND consumed_at IS NULL
              AND expires_at > NOW()
            FOR UPDATE`,
          [
            input.project.organizationId,
            input.project.id,
            runId,
            candidateId,
            confirmedGooglePlaceId,
            userId,
          ],
        );
        if (!confirmation.rows[0]) {
          throw new DiscoveryServiceError("place_confirmation_required");
        }
      }
      const identityLocks = [
        `organization_number:${promotionEnrichment.organizationNumber}`,
        websiteDomain ? `website_domain:${websiteDomain}` : null,
        confirmedGooglePlaceId
          ? `google_place_id:${confirmedGooglePlaceId}`
          : null,
      ]
        .filter((value): value is string => value !== null)
        .map((identity) =>
          ["leadgrid", input.project.organizationId, identity].join(":"),
        )
        .sort();
      for (const identity of identityLocks) {
        await client.query(
          `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
          [identity],
        );
      }
      const existingLead = await client.query<{
        id: string;
        google_place_id: string | null;
      }>(
        `SELECT id::text, google_place_id
               FROM crm_customers
              WHERE organization_id = $1::uuid
                AND project_id IS NOT DISTINCT FROM $2
                AND archived_at IS NULL
                AND (
                  enrichment_org_nr = $3
                  OR ($4::text IS NOT NULL AND website_domain_normalized = $4)
                  OR ($5::text IS NOT NULL AND google_place_id = $5)
              )
              ORDER BY created_at ASC, id ASC
              LIMIT 2
              FOR UPDATE`,
        [
          input.project.organizationId,
          input.project.id,
          promotionEnrichment.organizationNumber,
          websiteDomain,
          confirmedGooglePlaceId,
        ],
      );
      const existingIds = new Set([
        ...existingLead.rows.map((row) => row.id),
        ...(candidate.imported_lead_id ? [candidate.imported_lead_id] : []),
        ...(candidate.existing_lead_id ? [candidate.existing_lead_id] : []),
      ]);
      if (existingIds.size > 1) {
        throw new DiscoveryServiceError("invalid_state");
      }
      const existingRow = existingLead.rows[0] ?? null;
      if (
        confirmedGooglePlaceId &&
        existingRow?.google_place_id &&
        existingRow.google_place_id !== confirmedGooglePlaceId
      ) {
        throw new DiscoveryServiceError("invalid_state");
      }
      leadId =
        candidate.imported_lead_id ??
        candidate.existing_lead_id ??
        existingRow?.id ??
        null;

      if (!leadId) {
        const promoted = await client.query<{ id: string }>(
          `INSERT INTO crm_customers (
              id, name, company, phone, email, address, city, postal_code,
              latitude, longitude, website_url, website_domain_normalized,
              enrichment_org_nr, enrichment_data, enriched_at,
              google_place_id, google_place_id_confirmed_at,
              discovery_territory_code,
              status, source, owner_user_id, organization_id, project_id,
              lead_status, lead_source, draft_status,
              import_source, import_raw_data, created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1, $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10,
              $11, $12::jsonb,
              COALESCE($13::timestamptz, NOW()),
              $14, $15::timestamptz, $16,
              'lead', 'leadgrid_discovery', $17, $18::uuid, $19,
              'unvisited', 'leadgrid_discovery', 'lead',
              'leadgrid_discovery', $20::jsonb, NOW(), NOW()
            )
            RETURNING id::text`,
          [
            candidate.name,
            candidate.phone,
            candidate.email,
            candidate.address,
            candidate.city,
            candidate.postal_code,
            candidate.latitude,
            candidate.longitude,
            candidate.website_url,
            websiteDomain,
            promotionEnrichment.organizationNumber,
            promotionEnrichment.data
              ? JSON.stringify(promotionEnrichment.data)
              : null,
            promotionEnrichment.enrichedAt,
            confirmedGooglePlaceId,
            googlePlaceConfirmedAt,
            territoryCode,
            userId,
            input.project.organizationId,
            input.project.id,
            JSON.stringify(promotionMetadata),
          ],
        );
        leadId = promoted.rows[0]?.id ?? null;
        if (!leadId) throw new DiscoveryServiceError("internal_error");
        createdLead = true;
      } else {
        await client.query(
          `UPDATE crm_customers
              SET website_domain_normalized = COALESCE(
                    website_domain_normalized,
                    $4
                  ),
                  google_place_id = COALESCE(google_place_id, $5),
                  google_place_id_confirmed_at = COALESCE(
                    google_place_id_confirmed_at,
                    $6::timestamptz
                  ),
                  discovery_territory_code = COALESCE(
                    discovery_territory_code,
                    $7
                  ),
                  import_raw_data = (
                    CASE WHEN jsonb_typeof(import_raw_data) = 'object'
                      THEN import_raw_data ELSE '{}'::jsonb END
                  ) || jsonb_build_object(
                    'discovery_last_approval',
                    $8::jsonb->'discovery'
                  ),
                  updated_at = NOW()
            WHERE id = $1::uuid
              AND organization_id = $2::uuid
              AND project_id IS NOT DISTINCT FROM $3`,
          [
            leadId,
            input.project.organizationId,
            input.project.id,
            websiteDomain,
            confirmedGooglePlaceId,
            googlePlaceConfirmedAt,
            territoryCode,
            JSON.stringify(promotionMetadata),
          ],
        );
      }

      if (subjectKind === "person" && leadId) {
        await attachTalentProspect(client, {
          project: input.project,
          userId,
          candidateId,
          leadId,
          name: candidate.name,
          organizationNumber: promotionEnrichment.organizationNumber,
        });
        groupedContactCount = Math.max(groupedContactCount, 1);
      }

      if (confirmedGooglePlaceId) {
        const consumed = await client.query(
          `UPDATE leadgrid_discovery_place_confirmations
              SET consumed_at = NOW()
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND run_id = $3::uuid
              AND candidate_id = $4::uuid
              AND place_id = $5
              AND requested_by = $6
              AND consumed_at IS NULL
              AND expires_at > NOW()`,
          [
            input.project.organizationId,
            input.project.id,
            runId,
            candidateId,
            confirmedGooglePlaceId,
            userId,
          ],
        );
        if ((consumed.rowCount ?? 0) !== 1) {
          throw new DiscoveryServiceError("place_confirmation_required");
        }
      }

      if (
        clinicGroup.role === "clinic_account" &&
        leadId &&
        candidate.normalized_location_key
      ) {
        const attached = await attachClinicPractitioners(client, {
          project: input.project,
          userId,
          runId,
          clinicCandidateId: candidateId,
          leadId,
          normalizedLocationKey: candidate.normalized_location_key,
          group: clinicGroup,
        });
        groupedContactCount = attached.contactCount;
        groupedAffectedRunIds = attached.affectedRunIds;
      }
      }

      candidateStatus = "imported";
      disposition = "imported";
      if (!candidateStateAlreadyUpdated) {
        await client.query(
          `UPDATE leadgrid_discovery_candidates
            SET status = 'imported',
                imported_lead_id = $2::uuid,
                existing_lead_id = COALESCE(existing_lead_id, $2::uuid),
                decided_by = $3,
                decided_at = NOW(),
                imported_at = COALESCE(imported_at, NOW()),
                updated_by = $3,
                version = version + 1
          WHERE id = $1::uuid
            AND organization_id = $4::uuid
            AND project_id = $5`,
          [
            candidateId,
            leadId,
            userId,
            input.project.organizationId,
            input.project.id,
          ],
        );
      }
    }

    // Import is a project-wide terminal identity decision because every
    // occurrence points to the same CRM lead. Rejection is an ICP decision:
    // propagate it only to the same saved profile snapshot. An ad-hoc run has
    // no reusable profile identity and therefore only rejects its own row.
    const propagated =
      decision.decision === "approve"
        ? await client.query<{ run_id: string }>(
            `UPDATE leadgrid_discovery_run_candidates
                SET disposition = $2,
                    updated_at = NOW()
              WHERE candidate_id = $1::uuid
                AND organization_id = $3::uuid
                AND project_id = $4
                AND disposition IN (
                  'found', 'existing_candidate', 'research_pending',
                  'researching', 'review_ready', 'failed'
                )
              RETURNING run_id::text`,
            [
              candidateId,
              disposition,
              input.project.organizationId,
              input.project.id,
            ],
          )
        : candidate.profile_id
          ? await client.query<{ run_id: string }>(
              `UPDATE leadgrid_discovery_run_candidates rc
                  SET disposition = 'rejected',
                      updated_at = NOW()
                 FROM leadgrid_discovery_runs occurrence_run
                WHERE rc.candidate_id = $1::uuid
                  AND rc.organization_id = $2::uuid
                  AND rc.project_id = $3
                  AND occurrence_run.id = rc.run_id
                  AND occurrence_run.organization_id = rc.organization_id
                  AND occurrence_run.project_id = rc.project_id
                  AND (
                    rc.run_id = $4::uuid
                    OR (
                      occurrence_run.profile_id = $5::uuid
                      AND occurrence_run.brief_snapshot = $6::jsonb
                    )
                  )
                  AND rc.disposition IN (
                    'found', 'existing_candidate', 'research_pending',
                    'researching', 'review_ready', 'failed'
                  )
                RETURNING rc.run_id::text AS run_id`,
              [
                candidateId,
                input.project.organizationId,
                input.project.id,
                runId,
                candidate.profile_id,
                JSON.stringify(objectValue(candidate.brief_snapshot)),
              ],
            )
          : await client.query<{ run_id: string }>(
              `UPDATE leadgrid_discovery_run_candidates
                  SET disposition = 'rejected',
                      updated_at = NOW()
                WHERE candidate_id = $1::uuid
                  AND organization_id = $2::uuid
                  AND project_id = $3
                  AND run_id = $4::uuid
                  AND disposition IN (
                    'found', 'existing_candidate', 'research_pending',
                    'researching', 'review_ready', 'failed'
                  )
                RETURNING run_id::text`,
              [
                candidateId,
                input.project.organizationId,
                input.project.id,
                runId,
              ],
            );
    const affectedRunIds = Array.from(
      new Set([
        runId,
        ...propagated.rows.map((row) => row.run_id),
        ...groupedAffectedRunIds,
      ]),
    );
    const feedbackId = randomUUID();
    await client.query(
      `INSERT INTO leadgrid_discovery_feedback (
          id, organization_id, project_id, candidate_id, run_id, lead_id,
          event_type, value, reason_code, note, source, actor_user_id,
          idempotency_key, request_hash
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4::uuid, $5::uuid, $6::uuid,
          'decision', $7, $8, $9, 'user', $10, $11, $12
        )`,
      [
        feedbackId,
        input.project.organizationId,
        input.project.id,
        candidateId,
        runId,
        leadId,
        decision.decision,
        decision.reason_code ?? null,
        decision.note ?? null,
        userId,
        idempotencyKey,
        requestHash,
      ],
    );
    for (const affectedRunId of affectedRunIds) {
      await refreshRunCounts(client, affectedRunId);
    }
    const completedRuns = await client.query<{ id: string }>(
      `UPDATE leadgrid_discovery_runs r
          SET status = 'completed',
              finished_at = COALESCE(finished_at, NOW()),
              version = version + 1
        WHERE r.id = ANY($1::uuid[])
          AND r.organization_id = $2::uuid
          AND r.project_id = $3
          AND r.status IN ('review_ready', 'partial')
          AND NOT EXISTS (
            SELECT 1
              FROM leadgrid_discovery_run_candidates rc
             WHERE rc.run_id = r.id
               AND rc.organization_id = r.organization_id
               AND rc.project_id = r.project_id
               AND rc.disposition IN (
                 'found', 'existing_candidate', 'research_pending',
                 'researching', 'review_ready', 'failed'
               )
          )
        RETURNING r.id::text`,
      [affectedRunIds, input.project.organizationId, input.project.id],
    );

    return {
      result: {
        candidate_id: candidateId,
        run_id: runId,
        decision: decision.decision,
        candidate_status: candidateStatus,
        lead_id: leadId,
        feedback_id: feedbackId,
        contact_count: groupedContactCount,
        replayed: false,
      } satisfies DiscoveryDecisionResultDto,
      createdLead,
      affectedRunIds,
      completedRunIds: completedRuns.rows.map((row) => row.id),
    };
  });

  // External effects deliberately happen after COMMIT. Replays remain silent,
  // and lead.created is emitted only when this decision inserted a new CRM lead.
  if (!outcome.result.replayed) {
    const completedRunIds = new Set(outcome.completedRunIds);
    for (const affectedRunId of outcome.affectedRunIds) {
      const progressData = {
        run_id: affectedRunId,
        organization_id: input.project.organizationId,
        project_id: input.project.id,
        candidate_id: candidateId,
        candidate_status: outcome.result.candidate_status,
        decision: outcome.result.decision,
        lead_id: outcome.result.lead_id,
        ...(completedRunIds.has(affectedRunId) ? { status: "completed" } : {}),
      };
      leadgridRealtime.emit({
        type: "discovery.run.updated",
        channel: `org:${input.project.organizationId}`,
        data: progressData,
      });
      leadgridRealtime.emit({
        type: "discovery.run.updated",
        channel: `user:${userId}`,
        data: progressData,
      });
    }
    if (outcome.createdLead && outcome.result.lead_id) {
      broadcastLeadCreated(input.project.organizationId, userId, {
        lead_id: outcome.result.lead_id,
        organization_id: input.project.organizationId,
        project_id: input.project.id,
        source: "discovery",
      });
    }
  }
  return outcome.result;
}

export async function appendDiscoveryFeedback(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    userId: string;
    candidateId: string;
    runId?: string | null;
    idempotencyKey: string;
    feedback: unknown;
  },
): Promise<DiscoveryFeedbackResultDto> {
  assertProject(input.project);
  const userId = requiredText(input.userId, "user_id");
  const candidateId = requiredText(input.candidateId, "candidate_id");
  const runId = input.runId ? requiredText(input.runId, "run_id") : null;
  const idempotencyKey = requiredIdempotencyKey(input.idempotencyKey);
  const feedback = parseFeedback(input.feedback);
  const requestHash = discoveryHash({
    candidate_id: candidateId,
    run_id: runId,
    feedback,
  });

  return withTransaction(pool, async (client) => {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [
        [
          input.project.organizationId,
          input.project.id,
          candidateId,
          idempotencyKey,
        ].join("|"),
      ],
    );
    const candidate = await client.query<{ id: string }>(
      `SELECT c.id::text
         FROM leadgrid_discovery_candidates c
        WHERE c.id = $3::uuid
          AND c.organization_id = $1::uuid
          AND c.project_id = $2
          AND (
            $4::uuid IS NULL
            OR EXISTS (
              SELECT 1
                FROM leadgrid_discovery_run_candidates rc
               WHERE rc.run_id = $4::uuid
                 AND rc.candidate_id = c.id
                 AND rc.organization_id = c.organization_id
                 AND rc.project_id = c.project_id
            )
          )
        FOR SHARE
        LIMIT 1`,
      [input.project.organizationId, input.project.id, candidateId, runId],
    );
    if (!candidate.rows[0]) throw new DiscoveryServiceError("not_found");

    const replay = await client.query<{
      id: string;
      request_hash: string | null;
    }>(
      `SELECT id::text, request_hash
         FROM leadgrid_discovery_feedback
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND candidate_id = $3::uuid
          AND idempotency_key = $4
        LIMIT 1`,
      [
        input.project.organizationId,
        input.project.id,
        candidateId,
        idempotencyKey,
      ],
    );
    if (replay.rows[0]) {
      if (replay.rows[0].request_hash !== requestHash) {
        throw new DiscoveryServiceError("idempotency_conflict");
      }
      return {
        feedback_id: replay.rows[0].id,
        candidate_id: candidateId,
        run_id: runId,
        replayed: true,
      };
    }

    const feedbackId = randomUUID();
    await client.query(
      `INSERT INTO leadgrid_discovery_feedback (
          id, organization_id, project_id, candidate_id, run_id,
          event_type, value, reason_code, note, correction, payload,
          source, actor_user_id, idempotency_key, request_hash
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4::uuid, $5::uuid,
          $6, $7, $7, $8, $9::jsonb, $10::jsonb,
          'user', $11, $12, $13
        )`,
      [
        feedbackId,
        input.project.organizationId,
        input.project.id,
        candidateId,
        runId,
        feedback.kind,
        feedback.reason_code,
        feedback.note ?? null,
        JSON.stringify(feedback.correction ?? {}),
        JSON.stringify(feedback.outcome ?? {}),
        userId,
        idempotencyKey,
        requestHash,
      ],
    );
    return {
      feedback_id: feedbackId,
      candidate_id: candidateId,
      run_id: runId,
      replayed: false,
    };
  });
}

export interface DiscoveryExecutionDependencies {
  signal?: AbortSignal;
  executionLease?: { jobId: string; leaseToken: string };
  searchRegistry?: (
    input: DiscoveryRegistrySearchInput,
  ) => Promise<DiscoveryRegistrySearchResult>;
  emitProgress?: (event: {
    type: "discovery.run.updated";
    channel: string;
    data: Record<string, unknown>;
  }) => void;
}

interface PersistedCandidateRow {
  id: string;
  status: string;
  research_status: string;
  name: string;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  website_url: string | null;
  phone: string | null;
  organization_number: string | null;
  enrichment_data: Record<string, unknown> | null;
  raw_data: Record<string, unknown> | null;
  existing_lead_id: string | null;
  imported_lead_id: string | null;
  seen_count: number;
}

interface ExecutionCheckpoint {
  version: 3;
  source_cursor_start: DiscoverySourceCursorMap;
  source_cursor_next: DiscoverySourceCursorMap;
  /** Deprecated aggregate diagnostics retained in the run DTO. */
  source_page_start: number;
  source_page_next: number;
  completed_queries: number[];
  query_errors: Array<{ query_index: number; code: string }>;
  query_results: Record<
    string,
    {
      query_fingerprint: string;
      raw: number;
      source_offset_start: number;
      source_offset_next: number;
      source_page_start: number;
      source_page_next: number;
      source_page_count: number;
      duplicates: number;
      invalid: number;
      geo_filtered: number;
      company_filtered: number;
      website_assessment_candidates: number;
      website_assessment_requests: number;
      pages: number;
      external_requests: number;
      geocodes: number;
      geocode_misses: number;
      source_limit_reached: boolean;
      limit_reason: string | null;
      resolved_nace_codes: string[];
      resolved_municipalities: Array<{
        number: string;
        name: string | null;
        source_uri: string;
      }>;
    }
  >;
}

function executionCheckpoint(
  value: unknown,
  brief: DiscoveryBrief,
  plan: DiscoverySearchPlan,
): ExecutionCheckpoint {
  const checkpoint = objectValue(value);
  const isCursorMapCheckpoint = checkpoint.version === 3;
  // Version-2 stored only a page scalar shared across queries. It cannot be
  // converted without risking skipped rows, so legacy runs resume from zero.
  const sourceCursorStart = sourceCursorMapForPlan(
    isCursorMapCheckpoint ? checkpoint.source_cursor_start : {},
    brief,
    plan,
  );
  const persistedNext = parsedSourceCursorMap(
    isCursorMapCheckpoint ? checkpoint.source_cursor_next : {},
  );
  const sourceCursorNext = Object.fromEntries(
    Object.entries(sourceCursorStart).map(([fingerprint, start]) => [
      fingerprint,
      sourceOffsetCursor(persistedNext[fingerprint], start),
    ]),
  );
  const completed =
    isCursorMapCheckpoint && Array.isArray(checkpoint.completed_queries)
      ? checkpoint.completed_queries.filter(
          (entry): entry is number =>
            typeof entry === "number" &&
            Number.isInteger(entry) &&
            entry >= 0 &&
            entry < plan.queries.length,
        )
      : [];
  const errors =
    isCursorMapCheckpoint && Array.isArray(checkpoint.query_errors)
      ? checkpoint.query_errors.flatMap((entry) => {
          const record = objectValue(entry);
          return typeof record.query_index === "number" &&
            Number.isInteger(record.query_index) &&
            record.query_index >= 0 &&
            record.query_index < plan.queries.length &&
            typeof record.code === "string"
            ? [
                {
                  query_index: record.query_index,
                  code: record.code.slice(0, 80),
                },
              ]
            : [];
        })
      : [];
  const results = isCursorMapCheckpoint
    ? objectValue(checkpoint.query_results)
    : {};
  return {
    version: 3,
    source_cursor_start: sourceCursorStart,
    source_cursor_next: sourceCursorNext,
    source_page_start: sourceOffsetCursor(checkpoint.source_page_start),
    source_page_next: sourceOffsetCursor(checkpoint.source_page_next),
    completed_queries: [...new Set(completed)].sort((a, b) => a - b),
    query_errors: errors,
    query_results: Object.fromEntries(
      Object.entries(results).flatMap(([key, value]) => {
        const queryIndex = Number(key);
        const query = Number.isInteger(queryIndex)
          ? plan.queries[queryIndex]
          : undefined;
        if (!query) return [];
        const fingerprint = discoverySourceQueryFingerprint(
          brief,
          query.text_query,
          query.query_mode,
        );
        const record = objectValue(value);
        return [
          [
            key,
            {
              query_fingerprint: fingerprint,
              raw: numberValue(record.raw),
              source_offset_start: sourceOffsetCursor(
                record.source_offset_start,
                sourceCursorStart[fingerprint],
              ),
              source_offset_next: sourceOffsetCursor(
                record.source_offset_next,
                sourceCursorNext[fingerprint],
              ),
              source_page_start: sourceOffsetCursor(record.source_page_start),
              source_page_next: sourceOffsetCursor(record.source_page_next),
              source_page_count: sourceOffsetCursor(record.source_page_count),
              duplicates: numberValue(record.duplicates),
              invalid: numberValue(record.invalid),
              geo_filtered: numberValue(record.geo_filtered),
              company_filtered: numberValue(record.company_filtered),
              website_assessment_candidates: numberValue(
                record.website_assessment_candidates,
              ),
              website_assessment_requests: numberValue(
                record.website_assessment_requests,
              ),
              pages: numberValue(record.pages),
              external_requests: numberValue(record.external_requests),
              geocodes: numberValue(record.geocodes),
              geocode_misses: numberValue(record.geocode_misses),
              source_limit_reached: record.source_limit_reached === true,
              limit_reason: nullableText(record.limit_reason),
              resolved_nace_codes: Array.isArray(record.resolved_nace_codes)
                ? record.resolved_nace_codes.filter(
                    (code): code is string => typeof code === "string",
                  )
                : [],
              resolved_municipalities: Array.isArray(
                record.resolved_municipalities,
              )
                ? record.resolved_municipalities.flatMap((value) => {
                    const municipality = objectValue(value);
                    const municipalityNumber = nullableText(
                      municipality.number,
                    );
                    const sourceUri = nullableText(municipality.source_uri);
                    return municipalityNumber && sourceUri
                      ? [
                          {
                            number: municipalityNumber,
                            name: nullableText(municipality.name),
                            source_uri: sourceUri,
                          },
                        ]
                      : [];
                  })
                : [],
            },
          ],
        ];
      }),
    ),
  };
}

function scoreEvidence(score: DiscoveryCandidateScore): unknown[] {
  return [...score.factors.fit, ...score.factors.dataQuality].flatMap(
    (factor) => factor.evidence ?? [],
  );
}

function rawCandidateData(
  candidate: DiscoveryRegistryCandidate,
  classification = classifyDiscoveryEntity({
    name: candidate.name,
    address: candidate.address,
    postalCode: candidate.postalCode,
    city: candidate.city,
    organizationFormCode: candidate.organizationFormCode,
    naceCode: candidate.naceCode,
    naceDescription: candidate.naceDescription,
    employeeCount: candidate.employeeCount,
    website: candidate.website,
  }),
): Record<string, unknown> {
  return {
    source: "brreg_open_data",
    source_uri: candidate.sourceUri,
    organization_number: candidate.organizationNumber,
    organization_form: candidate.organizationForm,
    organization_form_code: candidate.organizationFormCode ?? null,
    organization_form_description:
      candidate.organizationFormDescription ?? null,
    display_name: candidate.name,
    address: candidate.address,
    postal_code: candidate.postalCode,
    city: candidate.city,
    municipality: candidate.municipality,
    municipality_number: candidate.municipalityNumber,
    location: candidate.location,
    distance_meters: candidate.distanceFromSearchCenterMeters,
    website: candidate.website,
    employee_count: candidate.employeeCount,
    employee_count_known: candidate.hasRegisteredEmployeeCount ?? null,
    nace_code: candidate.naceCode,
    nace_description: candidate.naceDescription,

    registered_at: candidate.registeredAt,
    registered_in_vat_register: candidate.registeredInVatRegister,
    registered_in_vat_register_known:
      candidate.registeredInVatRegisterKnown ?? null,
    registered_in_business_register_known:
      candidate.registeredInBusinessRegisterKnown ?? null,
    organization_structure: candidate.organizationStructure ?? "unknown",
    organization_structure_evidence:
      candidate.organizationStructureEvidence ?? null,
    website_quality: candidate.websiteQuality ?? null,
    registered_in_business_register: candidate.registeredInBusinessRegister,
    company_status: candidate.status,
    entity_kind: classification.kind,
    entity_kind_confidence: classification.confidence,
    entity_kind_evidence: classification.evidence,
    normalized_location_key: classification.normalizedLocationKey,
  };
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function websiteQualityAssessment(
  value: unknown,
): DiscoveryWebsiteQualityAssessment | null {
  const assessment = objectValue(value);
  const status = assessment.status;
  const reason = nullableText(assessment.reason);
  const sourceUri =
    typeof assessment.sourceUri === "string" ? assessment.sourceUri : null;
  const fetchedAt = nullableText(assessment.fetchedAt);
  const allowedReasons = new Set<DiscoveryWebsiteQualityAssessment["reason"]>([
    "assessed",
    "no_registered_url",
    "invalid_url",
    "unsafe_host",
    "request_failed",
    "response_too_large",
    "unsupported_content_type",
    "external_request_limit",
    "not_selected_for_assessment",
  ]);
  if (
    (status !== "assessed" && status !== "unknown") ||
    !reason ||
    !allowedReasons.has(
      reason as DiscoveryWebsiteQualityAssessment["reason"],
    ) ||
    sourceUri === null ||
    !fetchedAt
  ) {
    return null;
  }
  const rawScore = assessment.score;
  const score =
    typeof rawScore === "number" && rawScore >= 0 && rawScore <= 100
      ? rawScore
      : null;
  if (status === "assessed" && score === null) return null;
  const signals = objectValue(assessment.signals);
  const qualification = objectValue(assessment.qualification);
  const stringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  const signal = (key: string): boolean | null =>
    typeof signals[key] === "boolean" ? (signals[key] as boolean) : null;
  return {
    status,
    score: status === "assessed" ? score : null,
    fetchedAt,
    sourceUri,
    finalUrl: nullableText(assessment.finalUrl),
    httpStatus:
      typeof assessment.httpStatus === "number" ? assessment.httpStatus : null,
    redirectCount: Math.max(0, numberValue(assessment.redirectCount)),
    reason: reason as DiscoveryWebsiteQualityAssessment["reason"],
    signals: {
      https: signal("https"),
      reachable: signal("reachable"),
      title: signal("title"),
      meta_description: signal("meta_description"),
      viewport: signal("viewport"),
      contact_path: signal("contact_path"),
      call_to_action: signal("call_to_action"),
    },
    qualification: {
      requestedTerms: stringArray(qualification.requestedTerms),
      matchedTerms: stringArray(qualification.matchedTerms),
    },
  };
}

function websiteQualityDto(value: unknown): DiscoveryWebsiteQualityDto | null {
  const assessment = websiteQualityAssessment(value);
  return assessment
    ? {
        status: assessment.status,
        score: assessment.score,
        reason: assessment.reason,
        fetched_at: assessment.fetchedAt,
        source_uri: assessment.sourceUri,
        final_url: assessment.finalUrl,
        http_status: assessment.httpStatus,
        redirect_count: assessment.redirectCount,
        signals: assessment.signals,
        qualification: {
          requested_terms: assessment.qualification?.requestedTerms ?? [],
          matched_terms: assessment.qualification?.matchedTerms ?? [],
        },
      }
    : null;
}

function scorePersistedCandidate(
  candidate: PersistedCandidateRow,
  brief: DiscoveryBrief,
  distanceMeters: number | null,
  resolvedMunicipalityNumbers: string[] = [],
): DiscoveryCandidateScore {
  const raw = objectValue(candidate.raw_data);
  const enrichment = objectValue(candidate.enrichment_data);
  const company = objectValue(enrichment.company);
  const companyStatus =
    nullableText(raw.company_status) ?? nullableText(company.status);
  const safelyLinkedToBrreg =
    enrichment.autoLinked === true && nullableText(company.name) !== null;
  const structureText = nullableText(raw.organization_structure);
  const organizationStructure =
    structureText === "independent" ||
    structureText === "chain" ||
    structureText === "unknown"
      ? structureText
      : "unknown";
  const structureEvidenceRecord = objectValue(
    raw.organization_structure_evidence,
  );
  const organizationStructureEvidence =
    nullableText(structureEvidenceRecord.sourceUri) &&
    nullableText(structureEvidenceRecord.basis)
      ? {
          sourceUri: nullableText(structureEvidenceRecord.sourceUri) as string,
          basis: nullableText(structureEvidenceRecord.basis) as string,
          relatedOrganizationCount:
            structureEvidenceRecord.relatedOrganizationCount == null
              ? null
              : numberValue(structureEvidenceRecord.relatedOrganizationCount),
        }
      : null;
  const latitude =
    candidate.latitude == null ? null : numberValue(candidate.latitude);
  const longitude =
    candidate.longitude == null ? null : numberValue(candidate.longitude);
  const effectiveDistanceMeters =
    distanceMeters ??
    (brief.geo && latitude != null && longitude != null
      ? distanceBetweenRegistryPoints(
          {
            latitude: brief.geo.latitude,
            longitude: brief.geo.longitude,
          },
          { latitude, longitude },
        )
      : null);
  return scoreDiscoveryCandidate({
    candidateName: candidate.name,
    address: candidate.address,
    latitude,
    longitude,
    distanceMeters: effectiveDistanceMeters,
    radiusMeters: brief.geo ? brief.geo.radius_km * 1_000 : null,
    naceCode: nullableText(raw.nace_code),
    naceDescription: nullableText(raw.nace_description),
    website: candidate.website_url,
    phone: candidate.phone,
    organizationNumber: candidate.organization_number,
    companyStatus:
      companyStatus === "active" ||
      companyStatus === "in_liquidation" ||
      companyStatus === "bankrupt"
        ? companyStatus
        : null,
    industryQueries: [
      ...brief.industry_queries,
      ...brief.organization_name_queries,
    ],
    idealCustomer: brief.ideal_customer ?? null,
    exclusionTerms: brief.exclusion_terms,
    minimumFitScore: brief.minimum_fit_score,
    municipalityNumber: nullableText(raw.municipality_number),
    requiredMunicipalityNumbers: [
      ...new Set([
        ...brief.municipality_numbers,
        ...resolvedMunicipalityNumbers,
      ]),
    ],
    organizationFormCode: nullableText(raw.organization_form_code),
    requiredOrganizationForms: brief.organization_forms,
    employeeCount:
      typeof raw.employee_count === "number" ? raw.employee_count : null,
    employeeCountKnown:
      raw.employee_count_known === true ||
      (safelyLinkedToBrreg && typeof raw.employee_count === "number"),
    minimumEmployees: brief.employee_count?.minimum ?? null,
    maximumEmployees: brief.employee_count?.maximum ?? null,
    organizationStructure,
    requiredOrganizationStructure: brief.organization_structure,
    organizationStructureEvidence,
    websiteRequirement: brief.website_requirement,
    minimumWebsiteQualityScore: brief.website_quality.minimum_score,
    websiteQuality: websiteQualityAssessment(raw.website_quality),
    qualificationTerms: brief.qualification_terms,
    qualificationRequirement: brief.qualification_requirement,
    registeredInVatRegister:
      typeof raw.registered_in_vat_register === "boolean"
        ? raw.registered_in_vat_register
        : undefined,
    registeredInVatRegisterKnown:
      raw.registered_in_vat_register_known === true ||
      (safelyLinkedToBrreg &&
        typeof raw.registered_in_vat_register === "boolean"),
    requiredVatRegistration:
      brief.commercial_signals.registered_in_vat_register,
    registeredInBusinessRegister:
      typeof raw.registered_in_business_register === "boolean"
        ? raw.registered_in_business_register
        : undefined,
    registeredInBusinessRegisterKnown:
      raw.registered_in_business_register_known === true ||
      (safelyLinkedToBrreg &&
        typeof raw.registered_in_business_register === "boolean"),
    requiredBusinessRegistration:
      brief.commercial_signals.registered_in_business_register,
    websiteKnown: Boolean(candidate.website_url) || safelyLinkedToBrreg,
    phoneKnown: Boolean(candidate.phone),
    organizationNumberKnown: Boolean(candidate.organization_number),
  });
}

function assertExecutionActive(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DiscoveryServiceError("execution_lease_lost");
  }
}

function runExecutionFenceSql(
  runAlias: string,
  tokenParameter: string,
): string {
  return `(
    ${tokenParameter}::uuid IS NULL
    OR (
      ${runAlias}.execution_lease_token = ${tokenParameter}::uuid
      AND EXISTS (
        SELECT 1
          FROM background_jobs j
         WHERE j.id = ${runAlias}.background_job_id
           AND j.status = 'running'
           AND j.lease_token = ${tokenParameter}::uuid
         FOR SHARE
      )
    )
  )`;
}

/**
 * Locks both durable ownership rows for a transaction that writes outside the
 * run table. Reclaim, cancellation and a new worker must wait for that atomic
 * candidate/review write, and a stale worker fails before it can mutate data.
 */
async function lockRunExecutionLease(
  queryable: Queryable,
  runId: string,
  leaseToken?: string,
): Promise<void> {
  if (!leaseToken) return;
  const result = await queryable.query(
    `SELECT 1
       FROM leadgrid_discovery_runs r
       JOIN background_jobs j
         ON j.id = r.background_job_id
      WHERE r.id = $1::uuid
        AND r.status IN ('queued', 'searching', 'researching')
        AND r.execution_lease_token = $2::uuid
        AND j.status = 'running'
        AND j.lease_token = $2::uuid
      FOR SHARE OF r, j
      LIMIT 1`,
    [runId, leaseToken],
  );
  if (!result.rows[0]) {
    throw new DiscoveryServiceError("execution_lease_lost");
  }
}

async function acquireRunExecutionLease(
  pool: Pool,
  run: RunRow,
  lease: NonNullable<DiscoveryExecutionDependencies["executionLease"]>,
): Promise<void> {
  const claimed = await pool.query<{ execution_lease_token: string }>(
    `UPDATE leadgrid_discovery_runs r
        SET execution_lease_token = $3::uuid,
            version = version + 1
      WHERE r.id = $1::uuid
        AND r.background_job_id = $2::uuid
        AND r.status IN ('queued', 'searching', 'researching')
        AND EXISTS (
          SELECT 1
            FROM background_jobs j
           WHERE j.id = $2::uuid
             AND j.status = 'running'
             AND j.lease_token = $3::uuid
           FOR SHARE
        )
      RETURNING r.execution_lease_token::text`,
    [run.id, lease.jobId, lease.leaseToken],
  );
  if ((claimed.rowCount ?? 0) !== 1) {
    throw new DiscoveryServiceError("run_already_executing");
  }
  run.execution_lease_token = lease.leaseToken;
}

async function assertRunExecutionLease(
  pool: Pool,
  runId: string,
  leaseToken?: string,
): Promise<void> {
  await lockRunExecutionLease(pool, runId, leaseToken);
}

async function withExecutionSignal<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  assertExecutionActive(signal);
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () =>
      reject(new DiscoveryServiceError("execution_lease_lost"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort);
    });
  });
}

function progressEmitter(
  overrides: DiscoveryExecutionDependencies,
): NonNullable<DiscoveryExecutionDependencies["emitProgress"]> {
  return (
    overrides.emitProgress ??
    ((event) => {
      leadgridRealtime.emit(event);
    })
  );
}

function emitRunProgress(
  emit: NonNullable<DiscoveryExecutionDependencies["emitProgress"]>,
  run: Pick<RunRow, "id" | "organization_id" | "project_id" | "requested_by">,
  data: Record<string, unknown>,
): void {
  const payload = {
    run_id: run.id,
    organization_id: run.organization_id,
    project_id: run.project_id,
    ...data,
  };
  emit({
    type: "discovery.run.updated",
    channel: `org:${run.organization_id}`,
    data: payload,
  });
  if (run.requested_by) {
    emit({
      type: "discovery.run.updated",
      channel: `user:${run.requested_by}`,
      data: payload,
    });
  }
}

async function updateCheckpoint(
  pool: Pool,
  runId: string,
  checkpoint: ExecutionCheckpoint,
  executionLeaseToken?: string,
): Promise<void> {
  const summaries = Object.values(checkpoint.query_results);
  const raw = summaries.reduce((sum, item) => sum + item.raw, 0);
  const duplicates = summaries.reduce((sum, item) => sum + item.duplicates, 0);
  const externalRequests = summaries.reduce(
    (sum, item) => sum + item.external_requests,
    0,
  );
  const geocodes = summaries.reduce((sum, item) => sum + item.geocodes, 0);
  const websiteAssessmentCandidates = summaries.reduce(
    (sum, item) => sum + item.website_assessment_candidates,
    0,
  );
  const websiteAssessmentRequests = summaries.reduce(
    (sum, item) => sum + item.website_assessment_requests,
    0,
  );
  const updated = await pool.query(
    `UPDATE leadgrid_discovery_runs r
        SET checkpoint = $2::jsonb,
            raw_result_count = $3,
            duplicate_count = $4,
            provider_usage = $5::jsonb,
            version = r.version + 1
      WHERE r.id = $1::uuid
        AND ${runExecutionFenceSql("r", "$6")}`,
    [
      runId,
      JSON.stringify(checkpoint),
      raw,
      duplicates,
      JSON.stringify({
        source: "brreg_open_data",
        query_count: checkpoint.completed_queries.length,
        source_cursor_start: checkpoint.source_cursor_start,
        source_cursor_next: checkpoint.source_cursor_next,
        source_page_start: checkpoint.source_page_start,
        source_page_next: checkpoint.source_page_next,
        pages: summaries.reduce((sum, item) => sum + item.pages, 0),
        external_requests: externalRequests,
        website_assessment_candidates: websiteAssessmentCandidates,
        website_assessment_requests: websiteAssessmentRequests,
        geocodes,
        geocode_misses: summaries.reduce(
          (sum, item) => sum + item.geocode_misses,
          0,
        ),
        source_limit_reached: summaries.some(
          (item) => item.source_limit_reached,
        ),
        sources: DISCOVERY_DATA_SOURCES,
      }),
      executionLeaseToken ?? null,
    ],
  );
  if (executionLeaseToken && (updated.rowCount ?? 0) !== 1) {
    throw new DiscoveryServiceError("execution_lease_lost");
  }
}

async function isCancellationRequested(
  pool: Pool,
  runId: string,
): Promise<boolean> {
  const result = await pool.query<{ status: DiscoveryRunStatus }>(
    `SELECT status
       FROM leadgrid_discovery_runs
      WHERE id = $1::uuid
      LIMIT 1`,
    [runId],
  );
  return ["cancel_requested", "cancelled"].includes(
    result.rows[0]?.status ?? "cancelled",
  );
}

function executionResultFromRun(run: RunRow): DiscoveryExecutionResult {
  return {
    run_id: run.id,
    status: run.status,
    candidate_count: numberValue(run.candidate_count),
    researched_count: numberValue(run.researched_count),
  };
}

async function finishCancellation(
  pool: Pool,
  run: RunRow,
  emit: NonNullable<DiscoveryExecutionDependencies["emitProgress"]>,
): Promise<DiscoveryExecutionResult> {
  await pool.query(
    `UPDATE leadgrid_discovery_runs
        SET status = 'cancelled',
            cancellation_requested_at =
              COALESCE(cancellation_requested_at, NOW()),
            finished_at = COALESCE(finished_at, NOW()),
            error_code = NULL,
            error_message = NULL,
            version = version + 1
      WHERE id = $1::uuid
        AND status = 'cancel_requested'`,
    [run.id],
  );
  const current = await loadRunById(pool, run.id);
  if (!current) throw new DiscoveryServiceError("not_found");
  const result = executionResultFromRun(current);
  if (current.status === "cancelled") {
    emitRunProgress(emit, current, {
      status: "cancelled",
      candidate_count: result.candidate_count,
      researched_count: result.researched_count,
    });
  }
  return result;
}

async function resolveExecutionFenceMiss(
  pool: Pool,
  run: RunRow,
  emit: NonNullable<DiscoveryExecutionDependencies["emitProgress"]>,
  expectedLeaseToken?: string,
): Promise<DiscoveryExecutionResult> {
  const current = await loadRunById(pool, run.id);
  if (!current) throw new DiscoveryServiceError("not_found");
  if (["cancel_requested", "cancelled"].includes(current.status)) {
    return finishCancellation(pool, current, emit);
  }
  if (
    ["review_ready", "completed", "partial", "failed"].includes(current.status)
  ) {
    return executionResultFromRun(current);
  }
  if (
    expectedLeaseToken &&
    current.execution_lease_token !== expectedLeaseToken
  ) {
    throw new DiscoveryServiceError("execution_lease_lost");
  }
  await assertRunExecutionLease(pool, run.id, expectedLeaseToken);
  throw new DiscoveryServiceError("run_already_executing");
}

async function persistProviderCandidate(
  pool: Pool,
  input: {
    run: RunRow;
    brief: DiscoveryBrief;
    candidate: DiscoveryRegistryCandidate;
    resolvedMunicipalities: DiscoveryRegistrySearchResult["resolvedMunicipalities"];
    queryIndex: number;
    queryText: string;
    sourceRank: number;
    executionLeaseToken?: string;
  },
): Promise<void> {
  const observedAt = new Date().toISOString();
  const resolvedMunicipalities = input.resolvedMunicipalities.map(
    (municipality) => ({
      number: municipality.number,
      name: municipality.name,
      source_uri: municipality.sourceUri,
    }),
  );
  const provenance = [
    {
      source: "brreg_open_data",
      organization_number: input.candidate.organizationNumber,
      source_uri: input.candidate.sourceUri,
      license: "NLOD 2.0",
      run_id: input.run.id,
      profile_id: input.run.profile_id,
      profile_version: input.run.profile_version,
      territory_code: input.brief.territory_code ?? null,
      resolved_municipalities: resolvedMunicipalities,
      query_index: input.queryIndex,
      query: input.queryText,
    },
  ];
  const entityClassification = classifyDiscoveryEntity({
    name: input.candidate.name,
    address: input.candidate.address,
    postalCode: input.candidate.postalCode,
    city: input.candidate.city,
    organizationFormCode: input.candidate.organizationFormCode,
    naceCode: input.candidate.naceCode,
    naceDescription: input.candidate.naceDescription,
    employeeCount: input.candidate.employeeCount,
    website: input.candidate.website,
  });
  const rawData = rawCandidateData(input.candidate, entityClassification);
  const enrichmentData = {
    found: true,
    source: "brreg",
    fetchedAt: observedAt,
    autoLinked: true,
    matchedName: input.candidate.name,
    company: {
      orgNr: input.candidate.organizationNumber,
      name: input.candidate.name,
      status: input.candidate.status,
      website: input.candidate.website,
      address: input.candidate.address,
      postalCode: input.candidate.postalCode,
      city: input.candidate.city,
      latitude: input.candidate.location?.latitude ?? null,
      longitude: input.candidate.location?.longitude ?? null,
      organizationForm: input.candidate.organizationForm,
      naceCode: input.candidate.naceCode,
      naceDescription: input.candidate.naceDescription,
    },
  };
  const observationSnapshot = {
    schema_version: 1,
    snapshot_origin: "provider_observation",
    observed_at: observedAt,
    captured_at: observedAt,
    name: input.candidate.name,
    address: input.candidate.address,
    city: input.candidate.city,
    postal_code: input.candidate.postalCode,
    country_code: "NO",
    latitude: input.candidate.location?.latitude ?? null,
    longitude: input.candidate.location?.longitude ?? null,
    website_url: input.candidate.website,
    phone: null,
    email: null,
    organization_number: input.candidate.organizationNumber,
    raw_data: rawData,
    enrichment_data: enrichmentData,
    provenance,
  };
  await withTransaction(pool, async (client) => {
    await lockRunExecutionLease(
      client,
      input.run.id,
      input.executionLeaseToken,
    );
    const canonical = await client.query<PersistedCandidateRow>(
      `INSERT INTO leadgrid_discovery_candidates (
          organization_id, project_id, identity_key, name, website_url,
          address, postal_code, city, country_code, latitude, longitude,
          organization_number, entity_kind, entity_kind_confidence,
          entity_kind_evidence, normalized_location_key,
          research_status, enrichment_data, raw_data, provenance,
          created_by, updated_by
        ) VALUES (
          $1::uuid, $2, $3, $4, $5,
          $6, $7, $8, 'NO', $9, $10,
          $11, $12, $13, $14::jsonb, $15,
          'completed', $16::jsonb, $17::jsonb, $18::jsonb,
          $19, $19
        )
        ON CONFLICT (organization_id, project_id, identity_key)
        DO UPDATE SET
          status = CASE
            WHEN leadgrid_discovery_candidates.status = 'rejected'
              THEN 'review_ready'
            ELSE leadgrid_discovery_candidates.status
          END,
          name = EXCLUDED.name,
          website_url = COALESCE(EXCLUDED.website_url, leadgrid_discovery_candidates.website_url),
          address = COALESCE(EXCLUDED.address, leadgrid_discovery_candidates.address),
          postal_code = COALESCE(EXCLUDED.postal_code, leadgrid_discovery_candidates.postal_code),
          city = COALESCE(EXCLUDED.city, leadgrid_discovery_candidates.city),
          latitude = COALESCE(EXCLUDED.latitude, leadgrid_discovery_candidates.latitude),
          longitude = COALESCE(EXCLUDED.longitude, leadgrid_discovery_candidates.longitude),
          organization_number = EXCLUDED.organization_number,
          entity_kind = EXCLUDED.entity_kind,
          entity_kind_confidence = EXCLUDED.entity_kind_confidence,
          entity_kind_evidence = EXCLUDED.entity_kind_evidence,
          normalized_location_key = EXCLUDED.normalized_location_key,
          research_status = 'completed',
          enrichment_data = EXCLUDED.enrichment_data,
          raw_data = EXCLUDED.raw_data,
          provenance = CASE
            WHEN leadgrid_discovery_candidates.provenance @> EXCLUDED.provenance
              THEN leadgrid_discovery_candidates.provenance
            ELSE leadgrid_discovery_candidates.provenance || EXCLUDED.provenance
          END,
          seen_count = leadgrid_discovery_candidates.seen_count + CASE
            WHEN leadgrid_discovery_candidates.provenance @> EXCLUDED.provenance
              THEN 0
            ELSE 1
          END,
          last_seen_at = NOW(),
          updated_by = EXCLUDED.updated_by,
          version = leadgrid_discovery_candidates.version + 1
        RETURNING id::text, status, research_status, name, address,
                  latitude, longitude, website_url, phone,
                  organization_number, enrichment_data, raw_data,
                  existing_lead_id::text, imported_lead_id::text,
                  seen_count`,
      [
        input.run.organization_id,
        input.run.project_id,
        `brreg_org:${input.candidate.organizationNumber}`,
        input.candidate.name,
        input.candidate.website,
        input.candidate.address,
        input.candidate.postalCode,
        input.candidate.city,
        input.candidate.location?.latitude ?? null,
        input.candidate.location?.longitude ?? null,
        input.candidate.organizationNumber,
        entityClassification.kind,
        entityClassification.confidence,
        JSON.stringify(entityClassification.evidence),
        entityClassification.normalizedLocationKey,
        JSON.stringify(enrichmentData),
        JSON.stringify(rawData),
        JSON.stringify(provenance),
        input.run.requested_by,
      ],
    );
    const row = canonical.rows[0];
    if (!row) throw new DiscoveryServiceError("internal_error");

    const existingLead = await client.query<{ id: string }>(
      `SELECT id::text
         FROM crm_customers
        WHERE organization_id = $1::uuid
          AND project_id IS NOT DISTINCT FROM $2
          AND enrichment_org_nr = $3
        ORDER BY created_at ASC, id ASC
        LIMIT 1`,
      [
        input.run.organization_id,
        input.run.project_id,
        input.candidate.organizationNumber,
      ],
    );
    const existingLeadId =
      row.imported_lead_id ??
      row.existing_lead_id ??
      existingLead.rows[0]?.id ??
      null;
    if (existingLeadId && !row.existing_lead_id) {
      await client.query(
        `UPDATE leadgrid_discovery_candidates
            SET existing_lead_id = $2::uuid,
                version = version + 1
          WHERE id = $1::uuid`,
        [row.id, existingLeadId],
      );
    }

    const score = scorePersistedCandidate(
      {
        ...row,
        name: input.candidate.name,
        address: input.candidate.address,
        latitude: input.candidate.location?.latitude ?? null,
        longitude: input.candidate.location?.longitude ?? null,
        website_url: input.candidate.website,
        phone: null,
        organization_number: input.candidate.organizationNumber,
        enrichment_data: enrichmentData,
        raw_data: rawData,
      },
      input.brief,
      input.candidate.distanceFromSearchCenterMeters,
      input.resolvedMunicipalities.map((municipality) => municipality.number),
    );
    let rejectedForProfileSnapshot = false;
    if (input.run.profile_id) {
      const priorRejection = await client.query<{ rejected: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM leadgrid_discovery_feedback feedback
             JOIN leadgrid_discovery_runs rejection_run
               ON rejection_run.id = feedback.run_id
              AND rejection_run.organization_id = feedback.organization_id
              AND rejection_run.project_id = feedback.project_id
            WHERE feedback.organization_id = $1::uuid
              AND feedback.project_id = $2
              AND feedback.candidate_id = $3::uuid
              AND feedback.event_type = 'decision'
              AND feedback.value = 'reject'
              AND rejection_run.profile_id = $4::uuid
              AND rejection_run.brief_snapshot = $5::jsonb
         ) AS rejected`,
        [
          input.run.organization_id,
          input.run.project_id,
          row.id,
          input.run.profile_id,
          JSON.stringify(input.brief),
        ],
      );
      rejectedForProfileSnapshot = priorRejection.rows[0]?.rejected === true;
    }
    let disposition: DiscoveryOccurrenceDisposition;
    if (score.excluded) disposition = "excluded";
    else if (row.status === "archived") disposition = "duplicate";
    else if (row.status === "approved") disposition = "approved";
    else if (existingLeadId || row.status === "imported") {
      disposition = "duplicate";
    } else if (rejectedForProfileSnapshot) disposition = "rejected";
    else disposition = "review_ready";

    const sourceHits = [
      {
        source: "brreg_open_data",
        query_index: input.queryIndex,
        organization_number: input.candidate.organizationNumber,
        nace_code: input.candidate.naceCode,
        source_uri: input.candidate.sourceUri,
        profile_id: input.run.profile_id,
        profile_version: input.run.profile_version,
        territory_code: input.brief.territory_code ?? null,
        resolved_municipalities: resolvedMunicipalities,
      },
    ];
    await client.query(
      `INSERT INTO leadgrid_discovery_run_candidates (
          organization_id, project_id, run_id, candidate_id,
          disposition, source_hits, matched_on, source_rank,
          fit_score, fit_coverage, data_quality_score,
          data_quality_coverage, excluded, exclusion_matches,
          score_model_version, score_components, score_explanation, evidence,
          observation_snapshot
        ) VALUES (
          $1::uuid, $2, $3::uuid, $4::uuid,
          $5, $6::jsonb, ARRAY['organization_number']::text[], $7,
          $8, $9, $10, $11, $12, $13::jsonb,
          $14, $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb
        )
        ON CONFLICT (run_id, candidate_id)
        DO UPDATE SET
          disposition = CASE
            WHEN leadgrid_discovery_run_candidates.disposition IN (
              'approved','rejected','imported','duplicate'
            ) THEN leadgrid_discovery_run_candidates.disposition
            ELSE EXCLUDED.disposition
          END,
          source_hits = CASE
            WHEN leadgrid_discovery_run_candidates.source_hits @> EXCLUDED.source_hits
              THEN leadgrid_discovery_run_candidates.source_hits
            ELSE leadgrid_discovery_run_candidates.source_hits || EXCLUDED.source_hits
          END,
          source_rank = LEAST(
            leadgrid_discovery_run_candidates.source_rank,
            EXCLUDED.source_rank
          ),
          fit_score = EXCLUDED.fit_score,
          fit_coverage = EXCLUDED.fit_coverage,
          data_quality_score = EXCLUDED.data_quality_score,
          data_quality_coverage = EXCLUDED.data_quality_coverage,
          excluded = EXCLUDED.excluded,
          exclusion_matches = EXCLUDED.exclusion_matches,
          score_model_version = EXCLUDED.score_model_version,
          score_components = EXCLUDED.score_components,
          score_explanation = EXCLUDED.score_explanation,
          evidence = EXCLUDED.evidence,
          -- observation_snapshot is immutable for this run occurrence.
          updated_at = NOW()`,
      [
        input.run.organization_id,
        input.run.project_id,
        input.run.id,
        row.id,
        disposition,
        JSON.stringify(sourceHits),
        input.sourceRank,
        score.fitScore,
        score.fitCoverage,
        score.dataQualityScore,
        score.dataQualityCoverage,
        score.excluded,
        JSON.stringify(score.exclusionMatches),
        score.modelVersion,
        JSON.stringify({
          factors: score.factors,
          reasons: score.reasons,
        }),
        JSON.stringify(score.explanation),
        JSON.stringify(scoreEvidence(score)),
        JSON.stringify(observationSnapshot),
      ],
    );
  });
}

function mapProviderError(error: unknown): DiscoveryServiceError {
  if (error instanceof DiscoveryServiceError) return error;
  if (error instanceof DiscoveryRegistryError) {
    if (error.code === "cancelled") {
      return new DiscoveryServiceError("cancelled");
    }
    if (error.code === "classification_resolution_failed") {
      return new DiscoveryServiceError("classification_resolution_failed");
    }
    if (error.code === "municipality_resolution_failed") {
      return new DiscoveryServiceError("municipality_resolution_failed", {
        field: "municipality_names",
      });
    }
    return new DiscoveryServiceError("provider_unavailable", {
      retryable: error.retryable,
    });
  }
  return new DiscoveryServiceError("provider_unavailable", {
    retryable: true,
  });
}

export async function executeDiscoveryRun(
  pool: Pool,
  runIdValue: string,
  overrides: DiscoveryExecutionDependencies = {},
): Promise<DiscoveryExecutionResult> {
  const runId = requiredText(runIdValue, "run_id");
  const emit = progressEmitter(overrides);
  assertExecutionActive(overrides.signal);
  let run = await loadRunById(pool, runId);
  if (!run) throw new DiscoveryServiceError("not_found");
  if (
    ["review_ready", "completed", "partial", "cancelled", "failed"].includes(
      run.status,
    )
  ) {
    return executionResultFromRun(run);
  }
  if (["planning", "awaiting_confirmation"].includes(run.status)) {
    throw new DiscoveryServiceError("invalid_state");
  }
  if (run.status === "cancel_requested") {
    return finishCancellation(pool, run, emit);
  }
  if (overrides.executionLease) {
    await acquireRunExecutionLease(pool, run, overrides.executionLease);
  }

  const brief = parseBrief(run.brief_snapshot);
  const plan = buildDiscoverySearchPlan(brief);
  const checkpoint = executionCheckpoint(run.checkpoint, brief, plan);
  const searchRegistry =
    overrides.searchRegistry ?? createDiscoveryRegistryProvider().search;

  if (["queued", "searching"].includes(run.status)) {
    assertExecutionActive(overrides.signal);
    const started = await pool.query(
      `UPDATE leadgrid_discovery_runs r
          SET status = 'searching',
              started_at = COALESCE(started_at, NOW()),
              finished_at = NULL,
              error_code = NULL,
              error_message = NULL,
              version = r.version + 1
        WHERE r.id = $1::uuid
          AND r.status IN ('queued', 'searching')
          AND ${runExecutionFenceSql("r", "$2")}`,
      [run.id, overrides.executionLease?.leaseToken ?? null],
    );
    if ((started.rowCount ?? 0) !== 1) {
      return resolveExecutionFenceMiss(
        pool,
        run,
        emit,
        overrides.executionLease?.leaseToken,
      );
    }
    run.status = "searching";
  } else if (run.status !== "researching") {
    return resolveExecutionFenceMiss(
      pool,
      run,
      emit,
      overrides.executionLease?.leaseToken,
    );
  }
  emitRunProgress(emit, run, {
    status: run.status,
    completed_queries: checkpoint.completed_queries.length,
    total_queries: plan.queries.length,
  });

  let sourceRank = numberValue(run.candidate_count);
  let websiteAssessmentCandidatesUsed = Object.values(
    checkpoint.query_results,
  ).reduce((sum, item) => sum + item.website_assessment_candidates, 0);
  try {
    for (let index = 0; index < plan.queries.length; index += 1) {
      assertExecutionActive(overrides.signal);
      if (checkpoint.completed_queries.includes(index)) continue;
      if (await isCancellationRequested(pool, run.id)) {
        return finishCancellation(pool, run, emit);
      }

      const currentCount = await pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
           FROM leadgrid_discovery_run_candidates
          WHERE run_id = $1::uuid`,
        [run.id],
      );
      const remaining =
        brief.target_count - numberValue(currentCount.rows[0]?.count);
      if (remaining <= 0) break;
      const remainingQueries = Math.max(
        1,
        plan.queries
          .slice(index)
          .filter(
            (_query, offset) =>
              !checkpoint.completed_queries.includes(index + offset),
          ).length,
      );
      const queryBudget = Math.ceil(remaining / remainingQueries);

      const query = plan.queries[index];
      const queryFingerprint = discoverySourceQueryFingerprint(
        brief,
        query.text_query,
        query.query_mode,
      );
      // The immutable run checkpoint owns the start offset. Retries always use
      // this same value until the query is durably marked completed.
      const queryStartOffset = sourceOffsetCursor(
        checkpoint.source_cursor_start[queryFingerprint],
      );
      let result: DiscoveryRegistrySearchResult;
      try {
        result = await withExecutionSignal(
          searchRegistry({
            query: query.text_query,
            queryMode: query.query_mode,
            countryCode: brief.country_code ?? null,
            maxResults: Math.min(queryBudget, 60),
            sourceOffset: queryStartOffset,
            city: brief.city ?? null,
            geo: brief.geo
              ? {
                  center: {
                    latitude: brief.geo.latitude,
                    longitude: brief.geo.longitude,
                  },
                  radiusMeters: brief.geo.radius_km * 1_000,
                }
              : null,
            municipalityNumbers: brief.municipality_numbers,
            municipalityNames: brief.municipality_names,
            organizationForms: brief.organization_forms,
            minimumEmployees: brief.employee_count?.minimum ?? null,
            maximumEmployees: brief.employee_count?.maximum ?? null,
            organizationStructure: brief.organization_structure,
            websiteRequirement: brief.website_requirement,
            minimumWebsiteQualityScore: brief.website_quality.minimum_score,
            qualificationTerms: brief.qualification_terms,
            websiteAssessmentLimit: Math.max(
              0,
              brief.enrichment_count - websiteAssessmentCandidatesUsed,
            ),
            registeredInVatRegister:
              brief.commercial_signals.registered_in_vat_register,
            registeredInBusinessRegister:
              brief.commercial_signals.registered_in_business_register,
            signal: overrides.signal,
          }),
          overrides.signal,
        );
      } catch (error) {
        const safeError = mapProviderError(error);
        if (
          safeError.code === "execution_lease_lost" ||
          safeError.code === "classification_resolution_failed" ||
          safeError.code === "municipality_resolution_failed"
        ) {
          throw safeError;
        }
        checkpoint.query_errors = checkpoint.query_errors.filter(
          (entry) => entry.query_index !== index,
        );
        checkpoint.query_errors.push({
          query_index: index,
          code: safeError.code,
        });
        await updateCheckpoint(
          pool,
          run.id,
          checkpoint,
          overrides.executionLease?.leaseToken,
        );
        emitRunProgress(emit, run, {
          status: "searching",
          query_index: index,
          query_error: safeError.code,
        });
        continue;
      }

      for (const candidate of result.candidates) {
        assertExecutionActive(overrides.signal);
        if (await isCancellationRequested(pool, run.id)) {
          return finishCancellation(pool, run, emit);
        }
        sourceRank += 1;
        await persistProviderCandidate(pool, {
          run,
          brief,
          candidate,
          queryIndex: index,
          queryText: query.text_query,
          resolvedMunicipalities: result.resolvedMunicipalities,
          sourceRank,
          executionLeaseToken: overrides.executionLease?.leaseToken,
        });
        assertExecutionActive(overrides.signal);
      }

      assertExecutionActive(overrides.signal);
      checkpoint.query_errors = checkpoint.query_errors.filter(
        (entry) => entry.query_index !== index,
      );
      const fallbackNextOffset =
        sourceOffsetCursor(result.sourcePageNext) * DISCOVERY_BRREG_PAGE_SIZE;
      const queryNextOffset = sourceOffsetCursor(
        result.sourceOffsetNext,
        fallbackNextOffset,
      );
      checkpoint.source_cursor_next[queryFingerprint] = queryNextOffset;
      // Deprecated aggregate page diagnostics are not used for resumption.
      checkpoint.source_page_start = Math.floor(
        queryStartOffset / DISCOVERY_BRREG_PAGE_SIZE,
      );
      checkpoint.source_page_next = Math.floor(
        queryNextOffset / DISCOVERY_BRREG_PAGE_SIZE,
      );
      checkpoint.completed_queries.push(index);
      checkpoint.completed_queries.sort((a, b) => a - b);
      const websiteAssessmentCandidates = Math.max(
        0,
        Math.min(
          brief.enrichment_count - websiteAssessmentCandidatesUsed,
          numberValue(result.websiteAssessmentCandidates),
        ),
      );
      websiteAssessmentCandidatesUsed += websiteAssessmentCandidates;
      checkpoint.query_results[String(index)] = {
        query_fingerprint: queryFingerprint,
        raw: result.sourceResultsSeen,
        source_offset_start: sourceOffsetCursor(
          result.sourceOffsetStart,
          queryStartOffset,
        ),
        source_offset_next: queryNextOffset,
        source_page_start: sourceOffsetCursor(
          result.sourcePageStart,
          Math.floor(queryStartOffset / DISCOVERY_BRREG_PAGE_SIZE),
        ),
        source_page_next: sourceOffsetCursor(
          result.sourcePageNext,
          Math.floor(queryNextOffset / DISCOVERY_BRREG_PAGE_SIZE),
        ),
        source_page_count: sourceOffsetCursor(result.sourcePageCount),
        duplicates: result.duplicateResultsSkipped,
        invalid: result.invalidResultsSkipped,
        geo_filtered: result.geoFilteredResults,
        pages: result.pagesFetched,
        external_requests: result.externalRequests,
        company_filtered: result.companyFilteredResults,
        website_assessment_candidates: websiteAssessmentCandidates,
        website_assessment_requests: result.websiteAssessmentRequests,
        geocodes: result.geocodeRequests,
        geocode_misses: result.geocodeMisses,
        source_limit_reached: result.sourceLimitReached,
        limit_reason: result.limitReason,
        resolved_nace_codes: result.resolvedNaceCodes,
        resolved_municipalities: result.resolvedMunicipalities.map(
          (municipality) => ({
            number: municipality.number,
            name: municipality.name,
            source_uri: municipality.sourceUri,
          }),
        ),
      };
      await updateCheckpoint(
        pool,
        run.id,
        checkpoint,
        overrides.executionLease?.leaseToken,
      );
      await refreshRunCounts(pool, run.id);
      const afterQuery = await loadRunById(pool, run.id);
      emitRunProgress(emit, run, {
        status: "searching",
        query_index: index,
        completed_queries: checkpoint.completed_queries.length,
        total_queries: plan.queries.length,
        candidate_count: numberValue(afterQuery?.candidate_count),
        source_limit_reached: result.sourceLimitReached,
      });
      if (
        result.limitReason === "external_request_limit" ||
        result.limitReason === "geocode_limit"
      ) {
        break;
      }
    }

    assertExecutionActive(overrides.signal);
    await refreshRunCounts(pool, run.id);
    run = (await loadRunById(pool, run.id)) ?? run;
    if (checkpoint.query_errors.length > 0 && run.candidate_count === 0) {
      throw new DiscoveryServiceError("provider_unavailable", {
        retryable: true,
      });
    }
    if (await isCancellationRequested(pool, run.id)) {
      return finishCancellation(pool, run, emit);
    }

    const researching = await pool.query(
      `UPDATE leadgrid_discovery_runs r
          SET status = 'researching',
              version = r.version + 1
        WHERE r.id = $1::uuid
          AND r.status = 'searching'
          AND ${runExecutionFenceSql("r", "$2")}`,
      [run.id, overrides.executionLease?.leaseToken ?? null],
    );
    if ((researching.rowCount ?? 0) !== 1 && run.status !== "researching") {
      return resolveExecutionFenceMiss(
        pool,
        run,
        emit,
        overrides.executionLease?.leaseToken,
      );
    }
    run.status = "researching";
    emitRunProgress(emit, run, {
      status: "researching",
      candidate_count: numberValue(run.candidate_count),
    });

    const activeRunId = run.id;
    await withTransaction(pool, async (client) => {
      await lockRunExecutionLease(
        client,
        activeRunId,
        overrides.executionLease?.leaseToken,
      );
      await client.query(
        `UPDATE leadgrid_discovery_run_candidates rc
            SET disposition = 'review_ready', updated_at = NOW()
           FROM leadgrid_discovery_candidates c
          WHERE rc.run_id = $1::uuid
            AND c.id = rc.candidate_id
            AND rc.excluded = FALSE
            AND rc.disposition IN (
              'found','existing_candidate','research_pending','researching','failed'
            )`,
        [activeRunId],
      );
      await client.query(
        `UPDATE leadgrid_discovery_candidates c
            SET status = 'review_ready',
                research_status = CASE
                  WHEN research_status = 'pending' THEN 'not_applicable'
                  ELSE research_status
                END,
                version = version + 1
           FROM leadgrid_discovery_run_candidates rc
          WHERE rc.run_id = $1::uuid
            AND rc.candidate_id = c.id
            AND c.status = 'new'
            AND rc.excluded = FALSE
            AND rc.disposition = 'review_ready'`,
        [activeRunId],
      );
    });
    await refreshRunCounts(pool, run.id);
    run = (await loadRunById(pool, run.id)) ?? run;
    if (["cancel_requested", "cancelled"].includes(run.status)) {
      return finishCancellation(pool, run, emit);
    }
    const querySummaries = Object.values(checkpoint.query_results);
    const hasPartialSources =
      checkpoint.query_errors.length > 0 ||
      querySummaries.some(
        (summary) => summary.source_limit_reached || summary.geocode_misses > 0,
      );
    const finalStatus: DiscoveryRunStatus =
      numberValue(run.review_ready_count) > 0
        ? hasPartialSources
          ? "partial"
          : "review_ready"
        : hasPartialSources
          ? "partial"
          : "completed";
    const finishingRun = run;
    const finished = await withTransaction(pool, async (client) => {
      // Keep the status parameter type-stable across assignment and CASE.
      const statusUpdate = await client.query(
        `UPDATE leadgrid_discovery_runs r
            SET status = $2::text,
                finished_at = NOW(),
                error_code = CASE WHEN $2::text = 'partial'
                  THEN 'partial_results' ELSE NULL END,
                error_message = CASE WHEN $2::text = 'partial'
                  THEN 'Discovery fullførte med enkelte utilgjengelige kilder.'
                  ELSE NULL END,
                version = r.version + 1
          WHERE r.id = $1::uuid
            AND r.status = 'researching'
            AND ${runExecutionFenceSql("r", "$3")}`,
        [
          finishingRun.id,
          finalStatus,
          overrides.executionLease?.leaseToken ?? null,
        ],
      );
      if ((statusUpdate.rowCount ?? 0) !== 1) return false;
      if (finishingRun.profile_id && finishingRun.profile_version !== null) {
        const cursorUpdate = await client.query(
          `UPDATE leadgrid_discovery_profiles AS profile
              SET source_cursor_map =
                COALESCE(profile.source_cursor_map, '{}'::jsonb) || $5::jsonb
            WHERE profile.organization_id = $1::uuid
              AND profile.project_id = $2
              AND profile.id = $3::uuid
              AND profile.version = $4
              AND NOT EXISTS (
                SELECT 1
                  FROM jsonb_each_text($6::jsonb) AS expected(key, value)
                 WHERE expected.value !~ '^[0-9]+$'
                    OR COALESCE(
                         profile.source_cursor_map -> expected.key,
                         '0'::jsonb
                       ) <> to_jsonb(expected.value::bigint)
              )`,
          [
            finishingRun.organization_id,
            finishingRun.project_id,
            finishingRun.profile_id,
            finishingRun.profile_version,
            JSON.stringify(checkpoint.source_cursor_next),
            JSON.stringify(checkpoint.source_cursor_start),
          ],
        );
        if ((cursorUpdate.rowCount ?? 0) === 0) {
          // Another successful run advanced one of the same query universes.
          // Keep that newer cursor and accept duplicate discovery on a later
          // run rather than overwriting progress and risking skipped rows.
        }
      }
      return true;
    });
    if (!finished) {
      return resolveExecutionFenceMiss(
        pool,
        run,
        emit,
        overrides.executionLease?.leaseToken,
      );
    }
    run = (await loadRunById(pool, run.id)) ?? run;
    emitRunProgress(emit, run, {
      status: finalStatus,
      candidate_count: numberValue(run.candidate_count),
      researched_count: numberValue(run.researched_count),
      review_ready_count: numberValue(run.review_ready_count),
    });
    return {
      run_id: run.id,
      status: finalStatus,
      candidate_count: numberValue(run.candidate_count),
      researched_count: numberValue(run.researched_count),
    };
  } catch (error) {
    const safeError = mapProviderError(error);
    if (safeError.code === "execution_lease_lost") throw safeError;
    const current = await loadRunById(pool, run.id);
    if (!current) throw new DiscoveryServiceError("not_found");
    if (["cancel_requested", "cancelled"].includes(current.status)) {
      return finishCancellation(pool, current, emit);
    }
    if (
      ["review_ready", "completed", "partial", "failed"].includes(
        current.status,
      )
    ) {
      return executionResultFromRun(current);
    }
    const counts = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM leadgrid_discovery_run_candidates
        WHERE run_id = $1::uuid`,
      [run.id],
    );
    const failedStatus: DiscoveryRunStatus =
      numberValue(counts.rows[0]?.count) > 0 ? "partial" : "failed";
    const failed = await pool.query(
      `UPDATE leadgrid_discovery_runs r
          SET status = $2::text,
              finished_at = NOW(),
              error_code = $3,
              error_message = $4,
              version = r.version + 1
        WHERE r.id = $1::uuid
          AND r.status IN ('queued', 'searching', 'researching')
          AND ${runExecutionFenceSql("r", "$5")}`,
      [
        run.id,
        failedStatus,
        safeError.code,
        safeError.message,
        overrides.executionLease?.leaseToken ?? null,
      ],
    );
    if ((failed.rowCount ?? 0) !== 1) {
      return resolveExecutionFenceMiss(
        pool,
        run,
        emit,
        overrides.executionLease?.leaseToken,
      );
    }
    emitRunProgress(emit, run, {
      status: failedStatus,
      error_code: safeError.code,
    });
    throw safeError;
  }
}

export const discoveryRunJobHandler: JobHandler = async (
  pool: Pool,
  payload: Record<string, unknown>,
  job: BackgroundJob,
  context,
): Promise<Record<string, unknown>> => {
  const runId = typeof payload.runId === "string" ? payload.runId.trim() : "";
  if (!runId) {
    throw new DiscoveryServiceError("validation_error", { field: "runId" });
  }
  const result = await executeDiscoveryRun(pool, runId, {
    signal: context.signal,
    executionLease: { jobId: job.id, leaseToken: job.lease_token },
  });
  return { ...result };
};
