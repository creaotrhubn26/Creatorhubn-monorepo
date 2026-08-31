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
  DISCOVERY_PUBLIC_DATA_SOURCES,
  distanceBetweenRegistryPoints,
  DiscoveryRegistryError,
  type DiscoveryRegistryCandidate,
  type DiscoveryRegistrySearchInput,
  type DiscoveryRegistrySearchResult,
} from "./leadgrid-discovery-brreg-provider.js";
import {
  scoreDiscoveryCandidate,
  type DiscoveryCandidateScore,
} from "./leadgrid-discovery-scoring.js";
import type { LeadgridAccessibleProject } from "./leadgrid-project-access.js";
import type { BackgroundJob, JobHandler } from "./job-queue.js";
import { broadcastLeadCreated, leadgridRealtime } from "./leadgrid-realtime.js";
import {
  bindDiscoveryCapacityReservation,
  reserveDiscoveryMonthlyCapacityInTransaction,
} from "./leadgrid-discovery-governance.js";

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
  | "invalid_state"
  | "invalid_cursor"
  | "provider_not_configured"
  | "provider_unavailable"
  | "classification_resolution_failed"
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
  nace_code: string | null;
  nace_description: string | null;
  employee_count: number | null;
  registered_in_vat_register: boolean | null;
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
  const profileId = input.profileId
    ? requiredText(input.profileId, "profile_id")
    : null;
  if (input.expectedProfileVersion != null && !profileId) {
    throw new DiscoveryServiceError("validation_error", {
      field: "expected_profile_version",
    });
  }
  const requestHash = discoveryHash({
    project_id: input.project.id,
    profile_id: profileId,
    expected_profile_version: input.expectedProfileVersion ?? null,
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
    if (profileId) {
      const profile = await client.query<{
        version: number;
        status: string;
      }>(
        `SELECT version, status
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
      profileVersion = numberValue(row.version);
      if (
        input.expectedProfileVersion != null &&
        profileVersion !== input.expectedProfileVersion
      ) {
        throw new DiscoveryServiceError("profile_version_conflict", {
          field: "expected_profile_version",
        });
      }
    }

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
          requestedCandidates: preview.brief.target_count,
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
        preview.brief.target_count,
        preview.brief.enrichment_count,
        dateText(input.scheduledFor),
        idempotencyKey,
        requestHash,
        JSON.stringify(preview.brief),
        JSON.stringify({ ...preview.plan, plan_hash: preview.plan_hash }),
        JSON.stringify({
          version: 2,
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
  return withTransaction(pool, async (client) => {
    const run = await loadRun(client, input.project, input.runId, true);
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

    await client.query(
      `UPDATE leadgrid_discovery_runs
          SET status = $2,
              cancellation_requested_at =
                COALESCE(cancellation_requested_at, NOW()),
              finished_at = CASE
                WHEN $2 = 'cancelled' THEN COALESCE(finished_at, NOW())
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
  nace_code: string | null;
  nace_description: string | null;
  employee_count: number | null;
  registered_in_vat_register: boolean | null;
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

function toCandidateDto(row: CandidateListRow): DiscoveryCandidateDto {
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
    nace_code: row.nace_code,
    nace_description: row.nace_description,
    employee_count: row.employee_count,
    registered_in_vat_register: row.registered_in_vat_register,
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
            c.name,
            c.address,
            c.city,
            c.postal_code,
            c.country_code,
            c.latitude,
            c.longitude,
            c.website_url,
            c.phone,
            c.email,
            c.raw_data->>'source_uri' AS source_uri,
            c.organization_number,
            c.raw_data->>'organization_form' AS organization_form,
            c.raw_data->>'nace_code' AS nace_code,
            c.raw_data->>'nace_description' AS nace_description,
            CASE WHEN jsonb_typeof(c.raw_data->'employee_count') = 'number'
              THEN (c.raw_data->>'employee_count')::int ELSE NULL END
              AS employee_count,
            CASE WHEN jsonb_typeof(c.raw_data->'registered_in_vat_register') = 'boolean'
              THEN (c.raw_data->>'registered_in_vat_register')::boolean
              ELSE NULL END AS registered_in_vat_register,
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
      WHERE ${conditions.join("\n        AND ")}
      ORDER BY ${sortExpression} DESC NULLS LAST, rc.candidate_id ASC
      LIMIT $${limitParam}`,
    params,
  );
  const hasMore = result.rows.length > limit;
  const pageRows = result.rows.slice(0, limit);
  const last = pageRows.at(-1);
  return {
    items: pageRows.map(toCandidateDto),
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
            c.name,
            c.phone,
            c.email,
            c.address,
            c.city,
            c.postal_code,
            c.latitude,
            c.longitude,
            c.website_url,
            c.organization_number,
            c.enrichment_data,
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
    }>(
      `SELECT id::text, request_hash, lead_id::text, value
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

    let leadId: string | null = null;
    let createdLead = false;
    let candidateStatus = "rejected";
    let disposition: DiscoveryOccurrenceDisposition = "rejected";
    if (decision.decision === "approve") {
      const promotionEnrichment = safePromotionEnrichment(candidate);
      if (!promotionEnrichment.organizationNumber) {
        throw new DiscoveryServiceError("invalid_state");
      }
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [
          [
            input.project.organizationId,
            input.project.id,
            "crm_promotion",
            `orgnr:${promotionEnrichment.organizationNumber}`,
          ].join("|"),
        ],
      );
      const existingLead = await client.query<{ id: string }>(
        `SELECT id::text
               FROM crm_customers
              WHERE organization_id = $1::uuid
                AND project_id IS NOT DISTINCT FROM $2
                AND enrichment_org_nr = $3
              ORDER BY created_at ASC, id ASC
              FOR UPDATE
              LIMIT 1`,
        [
          input.project.organizationId,
          input.project.id,
          promotionEnrichment.organizationNumber,
        ],
      );
      leadId =
        candidate.imported_lead_id ??
        candidate.existing_lead_id ??
        existingLead.rows[0]?.id ??
        null;

      if (!leadId) {
        const promoted = await client.query<{ id: string }>(
          `INSERT INTO crm_customers (
              id, name, company, phone, email, address, city, postal_code,
              latitude, longitude, website_url,
              enrichment_org_nr, enrichment_data, enriched_at,
              status, source, owner_user_id, organization_id, project_id,
              lead_status, lead_source, draft_status,
              import_source, import_raw_data, created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1, $1, $2, $3, $4, $5, $6,
              $7, $8, $9,
              $10, $11::jsonb,
              COALESCE($12::timestamptz, NOW()),
              'lead', 'leadgrid_discovery', $13, $14::uuid, $15,
              'unvisited', 'leadgrid_discovery', 'lead',
              'leadgrid_discovery', $16::jsonb, NOW(), NOW()
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
            promotionEnrichment.organizationNumber,
            promotionEnrichment.data
              ? JSON.stringify(promotionEnrichment.data)
              : null,
            promotionEnrichment.enrichedAt,
            userId,
            input.project.organizationId,
            input.project.id,
            JSON.stringify({
              discovery_run_id: runId,
              discovery_candidate_id: candidateId,
              source: "brreg_open_data",
            }),
          ],
        );
        leadId = promoted.rows[0]?.id ?? null;
        if (!leadId) throw new DiscoveryServiceError("internal_error");
        createdLead = true;
      }

      candidateStatus = "imported";
      disposition = "imported";
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
    } else {
      await client.query(
        `UPDATE leadgrid_discovery_candidates
            SET status = 'rejected',
                decided_by = $2,
                decided_at = NOW(),
                updated_by = $2,
                version = version + 1
          WHERE id = $1::uuid
            AND organization_id = $3::uuid
            AND project_id = $4`,
        [candidateId, userId, input.project.organizationId, input.project.id],
      );
    }

    // A candidate is canonical per organization/project and may be present in
    // several overlapping runs. Propagate the terminal decision to every open
    // occurrence atomically; feedback and idempotency remain scoped to the run
    // where the human made the decision.
    const propagated = await client.query<{ run_id: string }>(
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
    );
    const affectedRunIds = Array.from(
      new Set([runId, ...propagated.rows.map((row) => row.run_id)]),
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
  version: 2;
  completed_queries: number[];
  query_errors: Array<{ query_index: number; code: string }>;
  query_results: Record<
    string,
    {
      raw: number;
      duplicates: number;
      invalid: number;
      geo_filtered: number;
      pages: number;
      external_requests: number;
      geocodes: number;
      geocode_misses: number;
      source_limit_reached: boolean;
      limit_reason: string | null;
      resolved_nace_codes: string[];
    }
  >;
}

function executionCheckpoint(value: unknown): ExecutionCheckpoint {
  const checkpoint = objectValue(value);
  const completed = Array.isArray(checkpoint.completed_queries)
    ? checkpoint.completed_queries.filter(
        (entry): entry is number =>
          typeof entry === "number" &&
          Number.isInteger(entry) &&
          entry >= 0 &&
          entry < 100,
      )
    : [];
  const errors = Array.isArray(checkpoint.query_errors)
    ? checkpoint.query_errors.flatMap((entry) => {
        const record = objectValue(entry);
        return typeof record.query_index === "number" &&
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
  const results = objectValue(checkpoint.query_results);
  return {
    version: 2,
    completed_queries: [...new Set(completed)].sort((a, b) => a - b),
    query_errors: errors,
    query_results: Object.fromEntries(
      Object.entries(results).flatMap(([key, value]) => {
        const record = objectValue(value);
        return [
          [
            key,
            {
              raw: numberValue(record.raw),
              duplicates: numberValue(record.duplicates),
              invalid: numberValue(record.invalid),
              geo_filtered: numberValue(record.geo_filtered),
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
): Record<string, unknown> {
  return {
    source: "brreg_open_data",
    source_uri: candidate.sourceUri,
    organization_number: candidate.organizationNumber,
    organization_form: candidate.organizationForm,
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
    nace_code: candidate.naceCode,
    nace_description: candidate.naceDescription,
    registered_at: candidate.registeredAt,
    registered_in_vat_register: candidate.registeredInVatRegister,
    registered_in_business_register: candidate.registeredInBusinessRegister,
    company_status: candidate.status,
  };
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function scorePersistedCandidate(
  candidate: PersistedCandidateRow,
  brief: DiscoveryBrief,
  distanceMeters: number | null,
): DiscoveryCandidateScore {
  const raw = objectValue(candidate.raw_data);
  const enrichment = objectValue(candidate.enrichment_data);
  const company = objectValue(enrichment.company);
  const companyStatus =
    nullableText(raw.company_status) ?? nullableText(company.status);
  const safelyLinkedToBrreg =
    enrichment.autoLinked === true && nullableText(company.name) !== null;
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
    industryQueries: brief.industry_queries,
    idealCustomer: brief.ideal_customer ?? null,
    exclusionTerms: brief.exclusion_terms,
    minimumFitScore: brief.minimum_fit_score,
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
        pages: summaries.reduce((sum, item) => sum + item.pages, 0),
        external_requests: externalRequests,
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
    queryIndex: number;
    queryText: string;
    sourceRank: number;
    executionLeaseToken?: string;
  },
): Promise<void> {
  const provenance = [
    {
      source: "brreg_open_data",
      organization_number: input.candidate.organizationNumber,
      source_uri: input.candidate.sourceUri,
      license: "NLOD 2.0",
      run_id: input.run.id,
      query_index: input.queryIndex,
      query: input.queryText,
    },
  ];
  const rawData = rawCandidateData(input.candidate);
  const enrichmentData = {
    found: true,
    source: "brreg",
    fetchedAt: new Date().toISOString(),
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
          organization_number, research_status, enrichment_data, raw_data,
          provenance, created_by, updated_by
        ) VALUES (
          $1::uuid, $2, $3, $4, $5,
          $6, $7, $8, 'NO', $9, $10,
          $11, 'completed', $12::jsonb, $13::jsonb,
          $14::jsonb, $15, $15
        )
        ON CONFLICT (organization_id, project_id, identity_key)
        DO UPDATE SET
          name = EXCLUDED.name,
          website_url = COALESCE(EXCLUDED.website_url, leadgrid_discovery_candidates.website_url),
          address = COALESCE(EXCLUDED.address, leadgrid_discovery_candidates.address),
          postal_code = COALESCE(EXCLUDED.postal_code, leadgrid_discovery_candidates.postal_code),
          city = COALESCE(EXCLUDED.city, leadgrid_discovery_candidates.city),
          latitude = COALESCE(EXCLUDED.latitude, leadgrid_discovery_candidates.latitude),
          longitude = COALESCE(EXCLUDED.longitude, leadgrid_discovery_candidates.longitude),
          organization_number = EXCLUDED.organization_number,
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
      row,
      input.brief,
      input.candidate.distanceFromSearchCenterMeters,
    );
    let disposition: DiscoveryOccurrenceDisposition;
    if (score.excluded) disposition = "excluded";
    else if (row.status === "rejected") disposition = "rejected";
    else if (row.status === "archived") disposition = "duplicate";
    else if (row.status === "approved") disposition = "approved";
    else if (existingLeadId || row.status === "imported") {
      disposition = "duplicate";
    } else disposition = "review_ready";

    const sourceHits = [
      {
        source: "brreg_open_data",
        query_index: input.queryIndex,
        organization_number: input.candidate.organizationNumber,
        nace_code: input.candidate.naceCode,
        source_uri: input.candidate.sourceUri,
      },
    ];
    await client.query(
      `INSERT INTO leadgrid_discovery_run_candidates (
          organization_id, project_id, run_id, candidate_id,
          disposition, source_hits, matched_on, source_rank,
          fit_score, fit_coverage, data_quality_score,
          data_quality_coverage, excluded, exclusion_matches,
          score_model_version, score_components, score_explanation, evidence
        ) VALUES (
          $1::uuid, $2, $3::uuid, $4::uuid,
          $5, $6::jsonb, ARRAY['organization_number']::text[], $7,
          $8, $9, $10, $11, $12, $13::jsonb,
          $14, $15::jsonb, $16::jsonb, $17::jsonb
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
  const checkpoint = executionCheckpoint(run.checkpoint);
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
      let result: DiscoveryRegistrySearchResult;
      try {
        result = await withExecutionSignal(
          searchRegistry({
            query: query.text_query,
            queryMode: "industry",
            maxResults: Math.min(queryBudget, 60),
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
            signal: overrides.signal,
          }),
          overrides.signal,
        );
      } catch (error) {
        const safeError = mapProviderError(error);
        if (
          safeError.code === "execution_lease_lost" ||
          safeError.code === "classification_resolution_failed"
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
          sourceRank,
          executionLeaseToken: overrides.executionLease?.leaseToken,
        });
        assertExecutionActive(overrides.signal);
      }

      assertExecutionActive(overrides.signal);
      checkpoint.query_errors = checkpoint.query_errors.filter(
        (entry) => entry.query_index !== index,
      );
      checkpoint.completed_queries.push(index);
      checkpoint.completed_queries.sort((a, b) => a - b);
      checkpoint.query_results[String(index)] = {
        raw: result.sourceResultsSeen,
        duplicates: result.duplicateResultsSkipped,
        invalid: result.invalidResultsSkipped,
        geo_filtered: result.geoFilteredResults,
        pages: result.pagesFetched,
        external_requests: result.externalRequests,
        geocodes: result.geocodeRequests,
        geocode_misses: result.geocodeMisses,
        source_limit_reached: result.sourceLimitReached,
        limit_reason: result.limitReason,
        resolved_nace_codes: result.resolvedNaceCodes,
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
    const finished = await pool.query(
      `UPDATE leadgrid_discovery_runs r
          SET status = $2,
              finished_at = NOW(),
              error_code = CASE WHEN $2 = 'partial'
                THEN 'partial_results' ELSE NULL END,
              error_message = CASE WHEN $2 = 'partial'
                THEN 'Discovery fullførte med enkelte utilgjengelige kilder.'
                ELSE NULL END,
              version = r.version + 1
        WHERE r.id = $1::uuid
          AND r.status = 'researching'
          AND ${runExecutionFenceSql("r", "$3")}`,
      [run.id, finalStatus, overrides.executionLease?.leaseToken ?? null],
    );
    if ((finished.rowCount ?? 0) !== 1) {
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
          SET status = $2,
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
