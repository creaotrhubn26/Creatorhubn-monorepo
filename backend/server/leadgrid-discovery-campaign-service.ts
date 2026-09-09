import type { Pool, PoolClient } from "pg";

import {
  discoveryBriefSchema,
  discoveryHash,
  type DiscoveryBrief,
} from "./leadgrid-discovery-contract.js";
import { canonicalDiscoveryProfileBrief } from "./leadgrid-discovery-profile-brief.js";
import {
  cancelDiscoveryRun,
  cancelDiscoveryRunFromTrustedWorkflow,
  createDiscoveryRun,
  DiscoveryServiceError,
  type DiscoveryRunStatus,
} from "./leadgrid-discovery-service.js";
import {
  loadAccessibleLeadgridProject,
  type LeadgridAccessibleProject,
} from "./leadgrid-project-access.js";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import { type JobHandler } from "./job-queue.js";

export const LEADGRID_DISCOVERY_CAMPAIGN_JOB_TYPE =
  "leadgrid_discovery_campaign_tick";

export type DiscoveryCampaignStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancel_requested"
  | "cancelled";

export type DiscoveryCampaignItemStatus =
  | "pending"
  | "launching"
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

type CampaignCommand = "advance" | "retry" | "cancel";

const ACTIVE_RUN_STATUSES = new Set<DiscoveryRunStatus>([
  "planning",
  "awaiting_confirmation",
  "queued",
  "searching",
  "researching",
  "cancel_requested",
]);
const SUCCESS_RUN_STATUSES = new Set<DiscoveryRunStatus>([
  "review_ready",
  "completed",
  "partial",
]);

const ERROR_MESSAGES = {
  invalid_request: "Kampanjekjøringen har ugyldige felter.",
  not_found: "Kampanjekjøringen finnes ikke i dette kundeprosjektet.",
  idempotency_conflict:
    "Idempotency-Key er allerede brukt med et annet kampanjeoppsett.",
  campaign_already_active:
    "Prosjektet har allerede en aktiv Discovery-kampanje.",
  profiles_unavailable:
    "Alle profilene må være aktive og tilhøre samme kundeprosjekt.",
  profile_version_conflict:
    "En Discovery-profil ble endret etter bekreftelsen. Se gjennom kampanjen på nytt.",
  child_run_still_stopping:
    "Den forrige profilkjøringen stopper fortsatt. Prøv igjen når den er avsluttet.",
  invalid_state:
    "Kampanjekjøringen kan ikke utføre handlingen i denne tilstanden.",
  internal_error: "Kampanjekjøringen kunne ikke fullføre forespørselen.",
} as const;

type DiscoveryCampaignErrorCode = keyof typeof ERROR_MESSAGES;

export class DiscoveryCampaignError extends Error {
  readonly code: DiscoveryCampaignErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly field?: string;

  constructor(
    code: DiscoveryCampaignErrorCode,
    options: { status?: number; retryable?: boolean; field?: string } = {},
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = "DiscoveryCampaignError";
    this.code = code;
    this.status =
      options.status ??
      (code === "not_found"
        ? 404
        : code === "idempotency_conflict" ||
            code === "campaign_already_active" ||
            code === "profile_version_conflict" ||
            code === "child_run_still_stopping" ||
            code === "invalid_state"
          ? 409
          : code === "internal_error"
            ? 500
            : 400);
    this.retryable =
      options.retryable ??
      (code === "internal_error" || code === "child_run_still_stopping");
    this.field = options.field;
  }
}

interface CampaignRow {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  status: DiscoveryCampaignStatus;
  profile_ids: string[];
  current_position: number;
  active_run_id: string | null;
  idempotency_key: string;
  request_hash: string;
  requested_by: string | null;
  cancellation_requested_at: string | Date | null;
  cancellation_requested_by: string | null;
  started_at: string | Date | null;
  finished_at: string | Date | null;
  error_code: string | null;
  error_message: string | null;
  poll_generation: number;
  version: number;
  created_at: string | Date;
  updated_at: string | Date;
}

interface CampaignItemRow {
  campaign_id: string;
  position: number;
  profile_id: string;
  profile_version: number;
  profile_name: string;
  territory_code: string | null;
  brief_snapshot: unknown;
  source_cursor_map_snapshot: unknown;
  status: DiscoveryCampaignItemStatus;
  attempt_count: number;
  current_run_id: string | null;
  started_at: string | Date | null;
  finished_at: string | Date | null;
  error_code: string | null;
  error_message: string | null;
  run_status: DiscoveryRunStatus | null;
  candidate_count: number | null;
  researched_count: number | null;
  review_ready_count: number | null;
  run_error_code: string | null;
  run_error_message: string | null;
}

interface CampaignAttemptRow {
  campaign_id: string;
  position: number;
  attempt_no: number;
  run_id: string;
  created_at: string | Date;
  status: DiscoveryRunStatus;
  candidate_count: number;
  review_ready_count: number;
  error_code: string | null;
  error_message: string | null;
  started_at: string | Date | null;
  finished_at: string | Date | null;
}

interface ProfileSnapshotRow {
  id: string;
  version: number;
  status: string;
  name: string;
  brief: Record<string, unknown> | null;
  target_customer_types: string[];
  organization_name_queries: string[];
  country_code: string | null;
  subject_kind: string;
  qualification_terms: string[];
  qualification_requirement: string;
  city_filters: string[];
  geography_lat: string | number | null;
  geography_lng: string | number | null;
  geography_radius_km: number;
  company_size_min: number | null;
  company_size_max: number | null;
  max_candidates_per_run: number;
  enrichment_count: number;
  source_cursor_map: unknown;
}

export interface DiscoveryCampaignAttemptDto {
  attempt_no: number;
  run_id: string;
  status: DiscoveryRunStatus;
  candidate_count: number;
  review_ready_count: number;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface DiscoveryCampaignItemDto {
  position: number;
  profile_id: string;
  profile_version: number;
  profile_name: string;
  territory_code: string | null;
  brief_snapshot: DiscoveryBrief;
  status: DiscoveryCampaignItemStatus;
  attempt_count: number;
  current_run_id: string | null;
  run_status: DiscoveryRunStatus | null;
  candidate_count: number;
  researched_count: number;
  review_ready_count: number;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  attempts: DiscoveryCampaignAttemptDto[];
}

export interface DiscoveryCampaignDto {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  status: DiscoveryCampaignStatus;
  profile_ids: string[];
  current_position: number;
  total_profiles: number;
  completed_profiles: number;
  partial_profiles: number;
  failed_profiles: number;
  active_run_id: string | null;
  requested_by: string | null;
  cancellation_requested_at: string | null;
  cancellation_requested_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_code: string | null;
  error_message: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  items: DiscoveryCampaignItemDto[];
}

type Queryable = Pick<PoolClient, "query">;

const CAMPAIGN_COLUMNS = `
  c.id::text, c.organization_id::text, c.project_id, c.name, c.status,
  c.profile_ids::text[], c.current_position, c.active_run_id::text,
  c.idempotency_key, c.request_hash, c.requested_by,
  c.cancellation_requested_at, c.cancellation_requested_by, c.started_at, c.finished_at,
  c.error_code, c.error_message, c.poll_generation, c.version,
  c.created_at, c.updated_at
`;

function dateText(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function integer(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function nonEmpty(value: unknown, field: string, max: number): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > max) {
    throw new DiscoveryCampaignError("invalid_request", { field });
  }
  return normalized;
}

function assertProject(project: LeadgridAccessibleProject): void {
  nonEmpty(project.id, "project_id", 255);
  nonEmpty(project.organizationId, "organization_id", 64);
}

async function transaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await operation(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function loadCampaignRow(
  queryable: Queryable,
  project: LeadgridAccessibleProject,
  campaignId: string,
  forUpdate = false,
): Promise<CampaignRow | null> {
  const result = await queryable.query<CampaignRow>(
    `SELECT ${CAMPAIGN_COLUMNS}
       FROM leadgrid_discovery_campaign_runs c
      WHERE c.organization_id = $1::uuid
        AND c.project_id = $2
        AND c.id = $3::uuid
      ${forUpdate ? "FOR UPDATE" : ""}
      LIMIT 1`,
    [project.organizationId, project.id, campaignId],
  );
  return result.rows[0] ?? null;
}

async function loadCampaignItems(
  queryable: Queryable,
  project: LeadgridAccessibleProject,
  campaignId: string,
): Promise<CampaignItemRow[]> {
  const result = await queryable.query<CampaignItemRow>(
    `SELECT
       i.campaign_id::text, i.position, i.profile_id::text, i.profile_version,
       i.profile_name, i.territory_code, i.brief_snapshot, i.status,
       i.attempt_count, i.current_run_id::text, i.started_at, i.finished_at,
       i.error_code, i.error_message,
       r.status AS run_status, r.candidate_count, r.researched_count,
       r.review_ready_count, r.error_code AS run_error_code,
       r.error_message AS run_error_message
     FROM leadgrid_discovery_campaign_items i
     LEFT JOIN leadgrid_discovery_runs r
       ON r.organization_id = i.organization_id
      AND r.project_id = i.project_id
      AND r.id = i.current_run_id
    WHERE i.organization_id = $1::uuid
      AND i.project_id = $2
      AND i.campaign_id = $3::uuid
    ORDER BY i.position`,
    [project.organizationId, project.id, campaignId],
  );
  return result.rows;
}

async function loadCampaignAttempts(
  queryable: Queryable,
  project: LeadgridAccessibleProject,
  campaignId: string,
): Promise<CampaignAttemptRow[]> {
  const result = await queryable.query<CampaignAttemptRow>(
    `SELECT
       a.campaign_id::text, a.position, a.attempt_no, a.run_id::text,
       a.created_at, r.status, r.candidate_count, r.review_ready_count,
       r.error_code, r.error_message, r.started_at, r.finished_at
     FROM leadgrid_discovery_campaign_attempts a
     JOIN leadgrid_discovery_runs r
       ON r.organization_id = a.organization_id
      AND r.project_id = a.project_id
      AND r.id = a.run_id
    WHERE a.organization_id = $1::uuid
      AND a.project_id = $2
      AND a.campaign_id = $3::uuid
    ORDER BY a.position, a.attempt_no DESC`,
    [project.organizationId, project.id, campaignId],
  );
  return result.rows;
}

function campaignDto(
  row: CampaignRow,
  itemRows: CampaignItemRow[],
  attemptRows: CampaignAttemptRow[],
): DiscoveryCampaignDto {
  const attemptsByPosition = new Map<number, DiscoveryCampaignAttemptDto[]>();
  for (const attempt of attemptRows) {
    const values = attemptsByPosition.get(integer(attempt.position)) ?? [];
    values.push({
      attempt_no: integer(attempt.attempt_no),
      run_id: attempt.run_id,
      status: attempt.status,
      candidate_count: integer(attempt.candidate_count),
      review_ready_count: integer(attempt.review_ready_count),
      error_code: attempt.error_code,
      error_message: attempt.error_message,
      started_at: dateText(attempt.started_at),
      finished_at: dateText(attempt.finished_at),
      created_at: dateText(attempt.created_at) as string,
    });
    attemptsByPosition.set(integer(attempt.position), values);
  }
  const items: DiscoveryCampaignItemDto[] = itemRows.map((item) => ({
    position: integer(item.position),
    profile_id: item.profile_id,
    profile_version: integer(item.profile_version, 1),
    profile_name: item.profile_name,
    territory_code: item.territory_code,
    brief_snapshot: discoveryBriefSchema.parse(item.brief_snapshot),
    status: item.status,
    attempt_count: integer(item.attempt_count),
    current_run_id: item.current_run_id,
    run_status: item.run_status,
    candidate_count: integer(item.candidate_count),
    researched_count: integer(item.researched_count),
    review_ready_count: integer(item.review_ready_count),
    error_code: item.run_error_code ?? item.error_code,
    error_message: item.run_error_message ?? item.error_message,
    started_at: dateText(item.started_at),
    finished_at: dateText(item.finished_at),
    attempts: attemptsByPosition.get(integer(item.position)) ?? [],
  }));
  return {
    id: row.id,
    organization_id: row.organization_id,
    project_id: row.project_id,
    name: row.name,
    status: row.status,
    profile_ids: row.profile_ids,
    current_position: integer(row.current_position),
    total_profiles: row.profile_ids.length,
    completed_profiles: items.filter((item) => item.status === "completed")
      .length,
    partial_profiles: items.filter((item) => item.status === "partial").length,
    failed_profiles: items.filter((item) => item.status === "failed").length,
    active_run_id: row.active_run_id,
    requested_by: row.requested_by,
    cancellation_requested_at: dateText(row.cancellation_requested_at),
    cancellation_requested_by: row.cancellation_requested_by,
    started_at: dateText(row.started_at),
    finished_at: dateText(row.finished_at),
    error_code: row.error_code,
    error_message: row.error_message,
    version: integer(row.version, 1),
    created_at: dateText(row.created_at) as string,
    updated_at: dateText(row.updated_at) as string,
    items,
  };
}

export async function getDiscoveryCampaign(
  pool: Pool,
  input: { project: LeadgridAccessibleProject; campaignId: string },
): Promise<DiscoveryCampaignDto> {
  assertProject(input.project);
  const row = await loadCampaignRow(pool, input.project, input.campaignId);
  if (!row) throw new DiscoveryCampaignError("not_found");
  const [items, attempts] = await Promise.all([
    loadCampaignItems(pool, input.project, row.id),
    loadCampaignAttempts(pool, input.project, row.id),
  ]);
  return campaignDto(row, items, attempts);
}

export async function listDiscoveryCampaigns(
  pool: Pool,
  input: { project: LeadgridAccessibleProject; limit?: number },
): Promise<{ campaigns: DiscoveryCampaignDto[] }> {
  assertProject(input.project);
  const limit = Math.min(20, Math.max(1, integer(input.limit, 5)));
  const result = await pool.query<CampaignRow>(
    `SELECT ${CAMPAIGN_COLUMNS}
       FROM leadgrid_discovery_campaign_runs c
      WHERE c.organization_id = $1::uuid
        AND c.project_id = $2
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT $3`,
    [input.project.organizationId, input.project.id, limit],
  );
  const campaigns: DiscoveryCampaignDto[] = [];
  for (const row of result.rows) {
    const [items, attempts] = await Promise.all([
      loadCampaignItems(pool, input.project, row.id),
      loadCampaignAttempts(pool, input.project, row.id),
    ]);
    campaigns.push(campaignDto(row, items, attempts));
  }
  return { campaigns };
}

export async function loadDiscoveryCampaignJobContext(
  pool: Pool,
  campaignId: string,
  payload: Record<string, unknown>,
): Promise<{
  campaignId: string;
  organizationId: string;
  projectId: string;
  requestedBy: string | null;
  cancellationRequestedBy: string | null;
  pollGeneration: number;
}> {
  const result = await pool.query<{
    id: string;
    organization_id: string;
    project_id: string;
    requested_by: string | null;
    cancellation_requested_by: string | null;
    poll_generation: number;
  }>(
    `SELECT id::text, organization_id::text, project_id, requested_by,
              cancellation_requested_by, poll_generation
       FROM leadgrid_discovery_campaign_runs
      WHERE id = $1::uuid
      LIMIT 1`,
    [campaignId],
  );
  const row = result.rows[0];
  if (!row) throw new DiscoveryCampaignError("not_found");

  const supplied = {
    organizationId:
      typeof payload.organizationId === "string"
        ? payload.organizationId.trim()
        : null,
    projectId:
      typeof payload.projectId === "string" ? payload.projectId.trim() : null,
    userId: typeof payload.userId === "string" ? payload.userId.trim() : null,
  };
  if (
    (supplied.organizationId &&
      supplied.organizationId !== row.organization_id) ||
    (supplied.projectId && supplied.projectId !== row.project_id) ||
    (supplied.userId && supplied.userId !== row.requested_by)
  ) {
    throw new DiscoveryCampaignError("invalid_request", {
      field: "job_payload",
    });
  }
  return {
    campaignId: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    requestedBy: row.requested_by,
    cancellationRequestedBy: row.cancellation_requested_by,
    pollGeneration: integer(row.poll_generation),
  };
}

export async function revalidateDiscoveryCampaignActor(
  pool: Pool,
  project: LeadgridAccessibleProject,
  userId: string,
): Promise<LeadgridAccessibleProject | null> {
  const authorized = await loadAccessibleLeadgridProject(
    pool,
    project.id,
    userId,
  );
  if (!authorized || authorized.organizationId !== project.organizationId) {
    return null;
  }
  const { role, permissions } = await resolveEffectivePermissions(
    pool,
    project.organizationId,
    userId,
  );
  return role && permissions.has("lead_research.run") ? authorized : null;
}

async function enqueueCampaignTick(
  queryable: Queryable,
  input: {
    campaignId: string;
    userId: string | null;
    pollGeneration: number;
    delayMs?: number;
  },
): Promise<void> {
  const dedupeKey = [
    LEADGRID_DISCOVERY_CAMPAIGN_JOB_TYPE,
    input.campaignId,
    `generation:${input.pollGeneration}`,
  ].join("|");
  await queryable.query(
    `INSERT INTO background_jobs
       (job_type, payload, priority, max_attempts, run_after, dedupe_key, created_by)
     VALUES ($1, $2::jsonb, $3, $4, now() + ($5 || ' milliseconds')::interval, $6, $7)
     ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('queued', 'running')
     DO NOTHING`,
    [
      LEADGRID_DISCOVERY_CAMPAIGN_JOB_TYPE,
      JSON.stringify({
        campaignId: input.campaignId,
        pollGeneration: input.pollGeneration,
      }),
      95,
      8,
      String(input.delayMs ?? 0),
      dedupeKey,
      input.userId,
    ],
  );
}

async function ensureCampaignTick(
  queryable: Queryable,
  input: {
    campaign: CampaignRow;
    userId: string | null;
    delayMs?: number;
  },
): Promise<void> {
  if (
    ["completed", "partial", "failed", "cancelled"].includes(
      input.campaign.status,
    )
  ) {
    return;
  }
  await enqueueCampaignTick(queryable, {
    campaignId: input.campaign.id,
    userId: input.userId,
    pollGeneration: integer(input.campaign.poll_generation),
    delayMs: input.delayMs,
  });
}

async function wakeCampaignTick(
  client: PoolClient,
  input: {
    project: LeadgridAccessibleProject;
    campaignId: string;
    userId: string | null;
  },
): Promise<number | null> {
  const updated = await client.query<{ poll_generation: number }>(
    `UPDATE leadgrid_discovery_campaign_runs
        SET poll_generation = poll_generation + 1, updated_at = NOW()
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND id = $3::uuid
        AND status IN ('queued', 'running', 'cancel_requested')
      RETURNING poll_generation`,
    [input.project.organizationId, input.project.id, input.campaignId],
  );
  const row = updated.rows[0];
  if (!row) return null;
  const pollGeneration = integer(row.poll_generation);
  await enqueueCampaignTick(client, {
    campaignId: input.campaignId,
    userId: input.userId,
    pollGeneration,
  });
  return pollGeneration;
}

export async function scheduleNextCampaignTick(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    campaignId: string;
    expectedGeneration: number;
    userId: string | null;
    delayMs: number;
  },
): Promise<boolean> {
  return transaction(pool, async (client) => {
    const updated = await client.query<{ poll_generation: number }>(
      `UPDATE leadgrid_discovery_campaign_runs
          SET poll_generation = poll_generation + 1, updated_at = NOW()
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND id = $3::uuid
          AND poll_generation = $4
          AND status IN ('queued', 'running', 'cancel_requested')
        RETURNING poll_generation`,
      [
        input.project.organizationId,
        input.project.id,
        input.campaignId,
        input.expectedGeneration,
      ],
    );
    const row = updated.rows[0];
    if (!row) return false;
    await enqueueCampaignTick(client, {
      campaignId: input.campaignId,
      userId: input.userId,
      pollGeneration: integer(row.poll_generation),
      delayMs: input.delayMs,
    });
    return true;
  });
}

export function mapDiscoveryCampaignCreateError(error: unknown): unknown {
  const postgres = error as { code?: string; constraint?: string };
  if (
    postgres?.code === "23505" &&
    postgres.constraint === "ux_leadgrid_discovery_campaign_runs_one_active"
  ) {
    return new DiscoveryCampaignError("campaign_already_active");
  }
  return error;
}

export function discoveryCampaignProfileVersionsMatch(
  profiles: Array<{ id: string; version: number }>,
  expected: Array<{ profileId: string; expectedVersion: number }>,
): boolean {
  return (
    profiles.length === expected.length &&
    profiles.every(
      (profile, index) =>
        profile.id === expected[index]?.profileId &&
        profile.version === expected[index]?.expectedVersion,
    )
  );
}

export async function createDiscoveryCampaign(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    userId: string;
    name: string;
    profiles: Array<{ profileId: string; expectedVersion: number }>;
    idempotencyKey: string;
  },
): Promise<{ campaign: DiscoveryCampaignDto; replayed: boolean }> {
  assertProject(input.project);
  const name = nonEmpty(input.name, "name", 120);
  const userId = nonEmpty(input.userId, "user_id", 255);
  const idempotencyKey = nonEmpty(input.idempotencyKey, "idempotency_key", 255);
  const profileRefs = input.profiles.map((profile) => ({
    profileId: nonEmpty(profile.profileId, "profiles.profile_id", 64),
    expectedVersion: integer(profile.expectedVersion, 1),
  }));
  const profileIds = profileRefs.map((profile) => profile.profileId);
  if (
    profileIds.length < 1 ||
    profileIds.length > 10 ||
    new Set(profileIds).size !== profileIds.length
  ) {
    throw new DiscoveryCampaignError("invalid_request", {
      field: "profile_ids",
    });
  }
  const requestHash = discoveryHash({
    project_id: input.project.id,
    name,
    profiles: profileRefs.map((profile) => ({
      profile_id: profile.profileId,
      expected_version: profile.expectedVersion,
    })),
  });

  let stored: { id: string; replayed: boolean };
  try {
    stored = await transaction(pool, async (client) => {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [
          [
            input.project.organizationId,
            input.project.id,
            "discovery_campaign",
            idempotencyKey,
          ].join("|"),
        ],
      );
      const replay = await client.query<CampaignRow>(
        `SELECT ${CAMPAIGN_COLUMNS}
         FROM leadgrid_discovery_campaign_runs c
        WHERE c.organization_id = $1::uuid
          AND c.project_id = $2
          AND c.idempotency_key = $3
        FOR UPDATE`,
        [input.project.organizationId, input.project.id, idempotencyKey],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].request_hash !== requestHash) {
          throw new DiscoveryCampaignError("idempotency_conflict");
        }
        await ensureCampaignTick(client, {
          campaign: replay.rows[0],
          userId: replay.rows[0].requested_by,
        });
        return { id: replay.rows[0].id, replayed: true };
      }

      // Defensive invariant for campaigns created before cleanup-pending was
      // introduced: a terminal-looking parent may still own a non-terminal
      // child. Never admit another project campaign until that child is done.
      const linkedActiveChild = await client.query<{ id: string }>(
        `SELECT c.id::text
           FROM leadgrid_discovery_campaign_runs c
           JOIN leadgrid_discovery_runs r
             ON r.organization_id = c.organization_id
            AND r.project_id = c.project_id
            AND r.id = c.active_run_id
          WHERE c.organization_id = $1::uuid
            AND c.project_id = $2
            AND r.status IN (
              'planning', 'awaiting_confirmation', 'queued',
              'searching', 'researching', 'cancel_requested'
            )
          FOR UPDATE OF c, r
          LIMIT 1`,
        [input.project.organizationId, input.project.id],
      );
      if (linkedActiveChild.rows[0]) {
        throw new DiscoveryCampaignError("campaign_already_active");
      }

      const active = await client.query<{ id: string }>(
        `SELECT id::text
         FROM leadgrid_discovery_campaign_runs
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND status IN ('queued', 'running', 'cancel_requested')
        FOR UPDATE
        LIMIT 1`,
        [input.project.organizationId, input.project.id],
      );
      if (active.rows[0]) {
        throw new DiscoveryCampaignError("campaign_already_active");
      }

      const profiles = await client.query<ProfileSnapshotRow>(
         `SELECT id::text, version, status, name, brief,
              target_customer_types, organization_name_queries, country_code,
              subject_kind, qualification_terms, qualification_requirement,
              city_filters, geography_lat::text,
              geography_lng::text, geography_radius_km,
              company_size_min, company_size_max,
              max_candidates_per_run, enrichment_count, source_cursor_map
         FROM leadgrid_discovery_profiles
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND id = ANY($3::uuid[])
          AND status = 'active'
        ORDER BY array_position($3::uuid[], id)`,
        [input.project.organizationId, input.project.id, profileIds],
      );
      if (
        profiles.rows.length !== profileIds.length ||
        profiles.rows.some((profile, index) => profile.id !== profileIds[index])
      ) {
        throw new DiscoveryCampaignError("profiles_unavailable", {
          field: "profile_ids",
        });
      }
      if (!discoveryCampaignProfileVersionsMatch(profiles.rows, profileRefs)) {
        throw new DiscoveryCampaignError("profile_version_conflict", {
          field: "profiles",
        });
      }

      const campaign = await client.query<{
        id: string;
        poll_generation: number;
      }>(
        `INSERT INTO leadgrid_discovery_campaign_runs (
         organization_id, project_id, name, profile_ids,
         idempotency_key, request_hash, requested_by
       ) VALUES ($1::uuid, $2, $3, $4::uuid[], $5, $6, $7)
       RETURNING id::text, poll_generation`,
        [
          input.project.organizationId,
          input.project.id,
          name,
          profileIds,
          idempotencyKey,
          requestHash,
          userId,
        ],
      );
      const campaignId = campaign.rows[0]?.id;
      if (!campaignId) throw new DiscoveryCampaignError("internal_error");

      for (const [position, profile] of profiles.rows.entries()) {
        const canonicalBrief = canonicalDiscoveryProfileBrief(profile);
        await client.query(
          `INSERT INTO leadgrid_discovery_campaign_items (
           campaign_id, organization_id, project_id, position,
           profile_id, profile_version, profile_name, territory_code,
           brief_snapshot, source_cursor_map_snapshot
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4, $5::uuid, $6, $7, $8, $9::jsonb,
           $10::jsonb
         )`,
          [
            campaignId,
            input.project.organizationId,
            input.project.id,
            position,
            profile.id,
            profile.version,
            profile.name,
            canonicalBrief.territory_code ?? null,
            JSON.stringify(canonicalBrief),
            JSON.stringify(profile.source_cursor_map ?? {}),
          ],
        );
      }
      await enqueueCampaignTick(client, {
        campaignId,
        userId,
        pollGeneration: integer(campaign.rows[0]?.poll_generation),
      });
      return { id: campaignId, replayed: false };
    });
  } catch (error) {
    throw mapDiscoveryCampaignCreateError(error);
  }

  await reconcileDiscoveryCampaign(pool, {
    project: input.project,
    campaignId: stored.id,
    commandUserId: userId,
  });
  return {
    campaign: await getDiscoveryCampaign(pool, {
      project: input.project,
      campaignId: stored.id,
    }),
    replayed: stored.replayed,
  };
}

type ReconcilePlan =
  | { kind: "done" }
  | { kind: "continue" }
  | { kind: "wait"; runStatus: DiscoveryRunStatus }
  | { kind: "cancel"; runId: string }
  | {
      kind: "launch";
      position: number;
      attemptNo: number;
      profileId: string;
      profileVersion: number;
      brief: DiscoveryBrief;
      sourceCursorMap: unknown;
    };

export function discoveryCampaignRunAction(
  status: DiscoveryRunStatus,
): "wait" | "advance" | "fail" | "cancel" {
  if (ACTIVE_RUN_STATUSES.has(status)) return "wait";
  if (SUCCESS_RUN_STATUSES.has(status)) return "advance";
  return status === "cancelled" ? "cancel" : "fail";
}

export function discoveryCampaignCanDetachRun(
  status: DiscoveryRunStatus,
): boolean {
  return !ACTIVE_RUN_STATUSES.has(status);
}

export function discoveryCampaignAttemptKey(
  campaignId: string,
  position: number,
  attemptNo: number,
): string {
  return [
    "campaign",
    campaignId,
    "position",
    position,
    "attempt",
    attemptNo,
  ].join(":");
}

function itemStatusForRun(
  status: DiscoveryRunStatus,
): DiscoveryCampaignItemStatus {
  if (status === "queued") return "queued";
  if (status === "planning" || status === "awaiting_confirmation") {
    return "launching";
  }
  if (
    status === "searching" ||
    status === "researching" ||
    status === "cancel_requested"
  ) {
    return "running";
  }
  if (status === "partial") return "partial";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  return "completed";
}

async function planCampaignStep(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    campaignId: string;
  },
): Promise<ReconcilePlan> {
  return transaction(pool, async (client) => {
    const campaign = await loadCampaignRow(
      client,
      input.project,
      input.campaignId,
      true,
    );
    if (!campaign) throw new DiscoveryCampaignError("not_found");
    if (
      ["completed", "partial", "failed", "cancelled"].includes(campaign.status)
    ) {
      return { kind: "done" };
    }

    if (campaign.status === "cancel_requested") {
      const workerCleanup =
        campaign.error_code === "campaign_worker_exhausted";
      if (campaign.active_run_id) {
        const childResult = await client.query<{
          status: DiscoveryRunStatus;
          error_code: string | null;
          error_message: string | null;
        }>(
          `SELECT status, error_code, error_message
             FROM leadgrid_discovery_runs
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND id = $3::uuid
            FOR UPDATE`,
          [
            input.project.organizationId,
            input.project.id,
            campaign.active_run_id,
          ],
        );
        const childRun = childResult.rows[0];
        if (!childRun) throw new DiscoveryCampaignError("internal_error");
        if (ACTIVE_RUN_STATUSES.has(childRun.status)) {
          return { kind: "cancel", runId: campaign.active_run_id };
        }
        const itemStatus = workerCleanup
          ? "failed"
          : itemStatusForRun(childRun.status);
        const itemErrorCode = workerCleanup
          ? campaign.error_code
          : childRun.error_code;
        const itemErrorMessage = workerCleanup
          ? campaign.error_message
          : childRun.error_message;
        await client.query(
          `UPDATE leadgrid_discovery_campaign_items
              SET status = $4, finished_at = COALESCE(finished_at, NOW()),
                  error_code = $5, error_message = $6, updated_at = NOW()
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND campaign_id = $3::uuid
              AND position = $7`,
          [
            input.project.organizationId,
            input.project.id,
            campaign.id,
            itemStatus,
            itemErrorCode,
            itemErrorMessage,
            campaign.current_position,
          ],
        );
        await client.query(
          `UPDATE leadgrid_discovery_campaign_runs
              SET active_run_id = NULL, version = version + 1,
                  updated_at = NOW()
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND id = $3::uuid`,
          [input.project.organizationId, input.project.id, campaign.id],
        );
      }
      const launchingResult = await client.query<{
        position: number;
        profile_id: string;
        profile_version: number;
        brief_snapshot: unknown;
        status: DiscoveryCampaignItemStatus;
        attempt_count: number;
      }>(
        `SELECT position, profile_id::text, profile_version, brief_snapshot,
                status, attempt_count
           FROM leadgrid_discovery_campaign_items
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND campaign_id = $3::uuid
            AND position = $4
          FOR UPDATE`,
        [
          input.project.organizationId,
          input.project.id,
          campaign.id,
          campaign.current_position,
        ],
      );
      const launching = launchingResult.rows[0];
      if (launching?.status === "launching" && launching.attempt_count > 0) {
        const runKey = discoveryCampaignAttemptKey(
          campaign.id,
          integer(launching.position),
          integer(launching.attempt_count),
        );
        const orphanResult = await client.query<{
          id: string;
          status: DiscoveryRunStatus;
        }>(
          `SELECT id::text, status
             FROM leadgrid_discovery_runs
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND idempotency_key = $3
            FOR UPDATE`,
          [input.project.organizationId, input.project.id, runKey],
        );
        const orphan = orphanResult.rows[0];
        if (orphan) {
          await client.query(
            `INSERT INTO leadgrid_discovery_campaign_attempts (
               campaign_id, organization_id, project_id, position, attempt_no, run_id
             ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)
             ON CONFLICT (campaign_id, position, attempt_no) DO NOTHING`,
            [
              campaign.id,
              input.project.organizationId,
              input.project.id,
              launching.position,
              launching.attempt_count,
              orphan.id,
            ],
          );
          await client.query(
            `UPDATE leadgrid_discovery_campaign_items
                SET current_run_id = $5::uuid, status = $6, updated_at = NOW()
              WHERE organization_id = $1::uuid
                AND project_id = $2
                AND campaign_id = $3::uuid
                AND position = $4
                AND current_run_id IS NULL`,
            [
              input.project.organizationId,
              input.project.id,
              campaign.id,
              launching.position,
              orphan.id,
              itemStatusForRun(orphan.status),
            ],
          );
          await client.query(
            `UPDATE leadgrid_discovery_campaign_runs
                SET active_run_id = $4::uuid, version = version + 1,
                    updated_at = NOW()
              WHERE organization_id = $1::uuid
                AND project_id = $2
                AND id = $3::uuid
                AND status = 'cancel_requested'
                AND active_run_id IS NULL`,
            [
              input.project.organizationId,
              input.project.id,
              campaign.id,
              orphan.id,
            ],
          );
          return { kind: "cancel", runId: orphan.id };
        }
      }

      await client.query(
        `UPDATE leadgrid_discovery_campaign_items
            SET status = CASE
                  WHEN $4::boolean AND position = $5 THEN 'failed'
                  ELSE 'cancelled'
                END,
                finished_at = COALESCE(finished_at, NOW()),
                error_code = CASE
                  WHEN $4::boolean AND position = $5 THEN $6
                  ELSE NULL
                END,
                error_message = CASE
                  WHEN $4::boolean AND position = $5 THEN $7
                  ELSE NULL
                END,
                updated_at = NOW()
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND campaign_id = $3::uuid
            AND status IN ('pending', 'launching', 'queued', 'running')`,
        [
          input.project.organizationId,
          input.project.id,
          campaign.id,
          workerCleanup,
          campaign.current_position,
          campaign.error_code,
          campaign.error_message,
        ],
      );
      // status is reused in CASE expressions; cast it to one PostgreSQL type.
      await client.query(
        `UPDATE leadgrid_discovery_campaign_runs
            SET status = $4::text, active_run_id = NULL,
                finished_at = COALESCE(finished_at, NOW()),
                error_code = CASE WHEN $4::text = 'failed' THEN error_code ELSE NULL END,
                error_message = CASE WHEN $4::text = 'failed' THEN error_message ELSE NULL END,
                version = version + 1, updated_at = NOW()
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND id = $3::uuid`,
        [
          input.project.organizationId,
          input.project.id,
          campaign.id,
          workerCleanup ? "failed" : "cancelled",
        ],
      );
      return { kind: "done" };
    }

    if (campaign.active_run_id) {
      const runResult = await client.query<{
        status: DiscoveryRunStatus;
        error_code: string | null;
        error_message: string | null;
      }>(
        `SELECT status, error_code, error_message
           FROM leadgrid_discovery_runs
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND id = $3::uuid
          FOR UPDATE`,
        [
          input.project.organizationId,
          input.project.id,
          campaign.active_run_id,
        ],
      );
      const run = runResult.rows[0];
      if (!run) throw new DiscoveryCampaignError("internal_error");
      const runAction = discoveryCampaignRunAction(run.status);
      if (runAction === "wait") {
        await client.query(
          `UPDATE leadgrid_discovery_campaign_items
              SET status = $4, updated_at = NOW()
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND campaign_id = $3::uuid
              AND position = $5
              AND status IS DISTINCT FROM $4`,
          [
            input.project.organizationId,
            input.project.id,
            campaign.id,
            itemStatusForRun(run.status),
            campaign.current_position,
          ],
        );
        return { kind: "wait", runStatus: run.status };
      }

      if (runAction === "advance") {
        const itemStatus = itemStatusForRun(run.status);
        const nextPosition = integer(campaign.current_position) + 1;
        await client.query(
          `UPDATE leadgrid_discovery_campaign_items
              SET status = $4::text, finished_at = COALESCE(finished_at, NOW()),
                  error_code = CASE WHEN $4::text = 'partial' THEN $5 ELSE NULL END,
                  error_message = CASE WHEN $4::text = 'partial' THEN $6 ELSE NULL END,
                  updated_at = NOW()
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND campaign_id = $3::uuid
              AND position = $7`,
          [
            input.project.organizationId,
            input.project.id,
            campaign.id,
            itemStatus,
            run.error_code,
            run.error_message,
            campaign.current_position,
          ],
        );
        if (nextPosition >= campaign.profile_ids.length) {
          const partial = await client.query<{ present: boolean }>(
            `SELECT EXISTS (
               SELECT 1 FROM leadgrid_discovery_campaign_items
                WHERE organization_id = $1::uuid
                  AND project_id = $2
                  AND campaign_id = $3::uuid
                  AND status = 'partial'
             ) AS present`,
            [input.project.organizationId, input.project.id, campaign.id],
          );
          await client.query(
            `UPDATE leadgrid_discovery_campaign_runs
                SET status = $4, current_position = $5, active_run_id = NULL,
                    finished_at = NOW(), error_code = NULL, error_message = NULL,
                    version = version + 1, updated_at = NOW()
              WHERE organization_id = $1::uuid
                AND project_id = $2
                AND id = $3::uuid`,
            [
              input.project.organizationId,
              input.project.id,
              campaign.id,
              partial.rows[0]?.present ? "partial" : "completed",
              nextPosition,
            ],
          );
          return { kind: "done" };
        }
        await client.query(
          `UPDATE leadgrid_discovery_campaign_runs
              SET status = 'running', current_position = $4,
                  active_run_id = NULL, version = version + 1,
                  updated_at = NOW()
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND id = $3::uuid`,
          [
            input.project.organizationId,
            input.project.id,
            campaign.id,
            nextPosition,
          ],
        );
        return { kind: "continue" };
      }

      const cancelled = runAction === "cancel";
      await client.query(
        `UPDATE leadgrid_discovery_campaign_items
            SET status = $4, finished_at = COALESCE(finished_at, NOW()),
                error_code = COALESCE($5, $4),
                error_message = COALESCE($6, 'Discovery-kjøringen stoppet.'),
                updated_at = NOW()
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND campaign_id = $3::uuid
            AND position = $7`,
        [
          input.project.organizationId,
          input.project.id,
          campaign.id,
          cancelled ? "cancelled" : "failed",
          run.error_code,
          run.error_message,
          campaign.current_position,
        ],
      );
      await client.query(
        `UPDATE leadgrid_discovery_campaign_runs
            SET status = $4, active_run_id = NULL, finished_at = NOW(),
                error_code = COALESCE($5, $4),
                error_message = COALESCE($6, 'Discovery-kjøringen stoppet.'),
                version = version + 1, updated_at = NOW()
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND id = $3::uuid`,
        [
          input.project.organizationId,
          input.project.id,
          campaign.id,
          cancelled ? "cancelled" : "failed",
          run.error_code,
          run.error_message,
        ],
      );
      return { kind: "done" };
    }

    if (campaign.current_position >= campaign.profile_ids.length) {
      const partial = await client.query<{ present: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM leadgrid_discovery_campaign_items
            WHERE organization_id = $1::uuid
              AND project_id = $2
              AND campaign_id = $3::uuid
              AND status = 'partial'
         ) AS present`,
        [input.project.organizationId, input.project.id, campaign.id],
      );
      await client.query(
        `UPDATE leadgrid_discovery_campaign_runs
            SET status = $4, finished_at = COALESCE(finished_at, NOW()),
                version = version + 1, updated_at = NOW()
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND id = $3::uuid`,
        [
          input.project.organizationId,
          input.project.id,
          campaign.id,
          partial.rows[0]?.present ? "partial" : "completed",
        ],
      );
      return { kind: "done" };
    }

    const itemResult = await client.query<CampaignItemRow>(
      `SELECT campaign_id::text, position, profile_id::text, profile_version,
              profile_name, territory_code, brief_snapshot,
              source_cursor_map_snapshot, status,
              attempt_count, current_run_id::text, started_at, finished_at,
              error_code, error_message, NULL::text AS run_status,
              NULL::int AS candidate_count, NULL::int AS researched_count,
              NULL::int AS review_ready_count, NULL::text AS run_error_code,
              NULL::text AS run_error_message
         FROM leadgrid_discovery_campaign_items
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND campaign_id = $3::uuid
          AND position = $4
        FOR UPDATE`,
      [
        input.project.organizationId,
        input.project.id,
        campaign.id,
        campaign.current_position,
      ],
    );
    const item = itemResult.rows[0];
    if (!item || !["pending", "launching"].includes(item.status)) {
      throw new DiscoveryCampaignError("internal_error");
    }
    // The user confirmed this immutable profile snapshot when the campaign
    // started. Later profile patch/pause/archive applies to the next campaign.

    let attemptNo = integer(item.attempt_count);
    if (item.status === "pending") {
      attemptNo += 1;
      await client.query(
        `UPDATE leadgrid_discovery_campaign_items
            SET status = 'launching', attempt_count = $5,
                started_at = COALESCE(started_at, NOW()),
                finished_at = NULL, error_code = NULL, error_message = NULL,
                updated_at = NOW()
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND campaign_id = $3::uuid
            AND position = $4`,
        [
          input.project.organizationId,
          input.project.id,
          campaign.id,
          campaign.current_position,
          attemptNo,
        ],
      );
      await client.query(
        `UPDATE leadgrid_discovery_campaign_runs
            SET status = 'running', started_at = COALESCE(started_at, NOW()),
                finished_at = NULL, error_code = NULL, error_message = NULL,
                version = version + 1, updated_at = NOW()
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND id = $3::uuid`,
        [input.project.organizationId, input.project.id, campaign.id],
      );
    }
    const parsedBrief = discoveryBriefSchema.safeParse(item.brief_snapshot);
    if (!parsedBrief.success)
      throw new DiscoveryCampaignError("internal_error");
    return {
      kind: "launch",
      position: integer(item.position),
      attemptNo,
      profileId: item.profile_id,
      profileVersion: integer(item.profile_version),
      brief: parsedBrief.data,
      sourceCursorMap: item.source_cursor_map_snapshot,
    };
  });
}

export async function attachLaunchedRun(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    campaignId: string;
    position: number;
    attemptNo: number;
    runId: string;
    runStatus: DiscoveryRunStatus;
  },
): Promise<boolean> {
  return transaction(pool, async (client) => {
    const campaign = await loadCampaignRow(
      client,
      input.project,
      input.campaignId,
      true,
    );
    if (!campaign) throw new DiscoveryCampaignError("not_found");
    if (
      !["running", "cancel_requested"].includes(campaign.status) ||
      campaign.current_position !== input.position ||
      (campaign.active_run_id && campaign.active_run_id !== input.runId)
    ) {
      return false;
    }

    const item = await client.query<{
      status: DiscoveryCampaignItemStatus;
      attempt_count: number;
      current_run_id: string | null;
    }>(
      `SELECT status, attempt_count, current_run_id::text
         FROM leadgrid_discovery_campaign_items
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND campaign_id = $3::uuid
          AND position = $4
        FOR UPDATE`,
      [
        input.project.organizationId,
        input.project.id,
        campaign.id,
        input.position,
      ],
    );
    const currentItem = item.rows[0];
    if (
      !currentItem ||
      integer(currentItem.attempt_count) !== input.attemptNo ||
      (currentItem.current_run_id &&
        currentItem.current_run_id !== input.runId) ||
      !["launching", "queued", "running"].includes(currentItem.status)
    ) {
      return false;
    }
    if (
      campaign.active_run_id === input.runId &&
      currentItem.current_run_id === input.runId
    ) {
      return true;
    }

    await client.query(
      `INSERT INTO leadgrid_discovery_campaign_attempts (
         campaign_id, organization_id, project_id, position, attempt_no, run_id
       ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)
       ON CONFLICT (campaign_id, position, attempt_no) DO NOTHING`,
      [
        campaign.id,
        input.project.organizationId,
        input.project.id,
        input.position,
        input.attemptNo,
        input.runId,
      ],
    );
    const itemUpdate = await client.query(
      `UPDATE leadgrid_discovery_campaign_items
          SET current_run_id = $5::uuid, status = $6, updated_at = NOW()
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND campaign_id = $3::uuid
          AND position = $4
          AND attempt_count = $7
          AND current_run_id IS NULL
          AND status = 'launching'`,
      [
        input.project.organizationId,
        input.project.id,
        campaign.id,
        input.position,
        input.runId,
        itemStatusForRun(input.runStatus),
        input.attemptNo,
      ],
    );
    if ((itemUpdate.rowCount ?? 0) !== 1) {
      throw new DiscoveryCampaignError("internal_error");
    }
    const campaignUpdate = await client.query(
      `UPDATE leadgrid_discovery_campaign_runs
          SET active_run_id = $4::uuid, status = CASE
                WHEN status = 'cancel_requested' THEN status ELSE 'running' END,
              version = version + 1, updated_at = NOW()
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND id = $3::uuid
          AND active_run_id IS NULL
          AND status IN ('running', 'cancel_requested')`,
      [
        input.project.organizationId,
        input.project.id,
        campaign.id,
        input.runId,
      ],
    );
    if ((campaignUpdate.rowCount ?? 0) !== 1) {
      throw new DiscoveryCampaignError("internal_error");
    }
    return true;
  });
}

async function failCampaignLaunch(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    campaignId: string;
    position: number;
    code: string;
    message: string;
  },
): Promise<void> {
  await transaction(pool, async (client) => {
    const campaign = await loadCampaignRow(
      client,
      input.project,
      input.campaignId,
      true,
    );
    if (!campaign || campaign.current_position !== input.position) return;
    const cancellationWon = campaign.status === "cancel_requested";
    const finalStatus = cancellationWon ? "cancelled" : "failed";
    await client.query(
      `UPDATE leadgrid_discovery_campaign_items
          SET status = $7::text, finished_at = NOW(),
              error_code = CASE WHEN $7::text = 'cancelled' THEN NULL ELSE $5 END,
              error_message = CASE WHEN $7::text = 'cancelled' THEN NULL ELSE $6 END,
              updated_at = NOW()
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND campaign_id = $3::uuid
          AND position = $4`,
      [
        input.project.organizationId,
        input.project.id,
        campaign.id,
        input.position,
        input.code,
        input.message,
        finalStatus,
      ],
    );
    await client.query(
      `UPDATE leadgrid_discovery_campaign_runs
          SET status = $6::text, active_run_id = NULL, finished_at = NOW(),
              error_code = CASE WHEN $6::text = 'cancelled' THEN NULL ELSE $4 END,
              error_message = CASE WHEN $6::text = 'cancelled' THEN NULL ELSE $5 END,
              version = version + 1, updated_at = NOW()
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND id = $3::uuid`,
      [
        input.project.organizationId,
        input.project.id,
        campaign.id,
        input.code,
        input.message,
        finalStatus,
      ],
    );
  });
}

export async function reconcileDiscoveryCampaign(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    campaignId: string;
    commandUserId?: string | null;
    tickGeneration?: number;
  },
): Promise<DiscoveryCampaignDto> {
  assertProject(input.project);
  const authoritative = await loadDiscoveryCampaignJobContext(
    pool,
    input.campaignId,
    {
      organizationId: input.project.organizationId,
      projectId: input.project.id,
    },
  );
  const campaignUserId = authoritative.requestedBy;
  const cancellationUserId = authoritative.cancellationRequestedBy;
  const commandUserId = input.commandUserId
    ? nonEmpty(input.commandUserId, "user_id", 255)
    : null;
  for (let step = 0; step < 12; step += 1) {
    const plan = await planCampaignStep(pool, input);
    if (plan.kind === "done") break;
    if (plan.kind === "continue") continue;
    if (plan.kind === "wait") {
      const delayMs =
        plan.runStatus === "queued" ||
        plan.runStatus === "planning" ||
        plan.runStatus === "awaiting_confirmation"
          ? 5_000
          : plan.runStatus === "cancel_requested"
            ? 3_000
            : 10_000;
      if (input.tickGeneration != null) {
        await scheduleNextCampaignTick(pool, {
          project: input.project,
          campaignId: input.campaignId,
          expectedGeneration: input.tickGeneration,
          userId: campaignUserId ?? commandUserId,
          delayMs,
        });
      }
      break;
    }
    if (plan.kind === "cancel") {
      const cancelUserId =
        commandUserId ?? cancellationUserId ?? campaignUserId;
      try {
        const cancelled = cancelUserId
          ? await cancelDiscoveryRun(pool, {
              project: input.project,
              userId: cancelUserId,
              runId: plan.runId,
            })
          : await cancelDiscoveryRunFromTrustedWorkflow(pool, {
              project: input.project,
              campaignId: input.campaignId,
              runId: plan.runId,
            });
        if (cancelled.run.status === "cancel_requested") {
          if (input.tickGeneration != null) {
            await scheduleNextCampaignTick(pool, {
              project: input.project,
              campaignId: input.campaignId,
              expectedGeneration: input.tickGeneration,
              userId: cancelUserId,
              delayMs: 3_000,
            });
          }
          break;
        }
      } catch (error) {
        if (
          !(error instanceof DiscoveryServiceError) ||
          !["invalid_state", "not_found"].includes(error.code)
        ) {
          throw error;
        }
      }
      continue;
    }

    if (!campaignUserId) {
      await failDiscoveryCampaignMissingActor(pool, {
        organizationId: input.project.organizationId,
        projectId: input.project.id,
        campaignId: input.campaignId,
      });
      break;
    }
    const authorizedProject = await revalidateDiscoveryCampaignActor(
      pool,
      input.project,
      campaignUserId,
    );
    if (
      !authorizedProject ||
      authorizedProject.organizationId !== input.project.organizationId
    ) {
      await failCampaignLaunch(pool, {
        project: input.project,
        campaignId: input.campaignId,
        position: plan.position,
        code: "actor_access_revoked",
        message:
          "Brukeren som startet kampanjen har ikke lenger tilgang til kundeprosjektet.",
      });
      break;
    }

    const runKey = discoveryCampaignAttemptKey(
      input.campaignId,
      plan.position,
      plan.attemptNo,
    );
    try {
      const created = await createDiscoveryRun(pool, {
        project: authorizedProject,
        userId: campaignUserId,
        brief: plan.brief,
        profileId: plan.profileId,
        expectedProfileVersion: plan.profileVersion,
        trustedProfileSnapshot: {
          profileId: plan.profileId,
          profileVersion: plan.profileVersion,
          sourceCursorMap: plan.sourceCursorMap,
        },
        idempotencyKey: runKey,
        startImmediately: true,
        triggerKind: plan.attemptNo > 1 ? "retry" : "workflow",
      });
      const attached = await attachLaunchedRun(pool, {
        project: input.project,
        campaignId: input.campaignId,
        position: plan.position,
        attemptNo: plan.attemptNo,
        runId: created.run.id,
        runStatus: created.run.status,
      });
      if (!attached) {
        try {
          await cancelDiscoveryRun(pool, {
            project: authorizedProject,
            userId: campaignUserId,
            runId: created.run.id,
          });
        } catch (cancelError) {
          if (
            !(cancelError instanceof DiscoveryServiceError) ||
            !["invalid_state", "not_found"].includes(cancelError.code)
          ) {
            throw cancelError;
          }
        }
        break;
      }
      continue;
    } catch (error) {
      if (error instanceof DiscoveryServiceError && !error.retryable) {
        await failCampaignLaunch(pool, {
          project: input.project,
          campaignId: input.campaignId,
          position: plan.position,
          code: error.code,
          message: error.message,
        });
        break;
      }
      throw error;
    }
  }
  return getDiscoveryCampaign(pool, {
    project: input.project,
    campaignId: input.campaignId,
  });
}

async function recordCommand(
  client: PoolClient,
  input: {
    project: LeadgridAccessibleProject;
    campaignId: string;
    userId: string;
    command: CampaignCommand;
    idempotencyKey: string;
  },
): Promise<boolean> {
  const requestHash = discoveryHash({
    project_id: input.project.id,
    campaign_id: input.campaignId,
    command: input.command,
  });
  const existing = await client.query<{ request_hash: string }>(
    `SELECT request_hash
       FROM leadgrid_discovery_campaign_commands
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND campaign_id = $3::uuid
        AND command = $4
        AND idempotency_key = $5
      FOR UPDATE`,
    [
      input.project.organizationId,
      input.project.id,
      input.campaignId,
      input.command,
      input.idempotencyKey,
    ],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].request_hash !== requestHash) {
      throw new DiscoveryCampaignError("idempotency_conflict");
    }
    return true;
  }
  await client.query(
    `INSERT INTO leadgrid_discovery_campaign_commands (
       organization_id, project_id, campaign_id, command,
       idempotency_key, request_hash, requested_by
     ) VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7)`,
    [
      input.project.organizationId,
      input.project.id,
      input.campaignId,
      input.command,
      input.idempotencyKey,
      requestHash,
      input.userId,
    ],
  );
  return false;
}

export async function advanceDiscoveryCampaign(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    campaignId: string;
    userId: string;
    idempotencyKey: string;
  },
): Promise<{ campaign: DiscoveryCampaignDto; replayed: boolean }> {
  const replayed = await transaction(pool, async (client) => {
    const campaign = await loadCampaignRow(
      client,
      input.project,
      input.campaignId,
      true,
    );
    if (!campaign) throw new DiscoveryCampaignError("not_found");
    const commandReplayed = await recordCommand(client, {
      ...input,
      command: "advance",
    });
    if (commandReplayed) {
      await ensureCampaignTick(client, {
        campaign,
        userId: campaign.requested_by,
      });
    } else {
      await wakeCampaignTick(client, {
        project: input.project,
        campaignId: campaign.id,
        userId: campaign.requested_by,
      });
    }
    return commandReplayed;
  });
  const campaign = await reconcileDiscoveryCampaign(pool, {
    project: input.project,
    campaignId: input.campaignId,
    commandUserId: input.userId,
  });
  return { campaign, replayed };
}

export async function cancelDiscoveryCampaign(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    campaignId: string;
    userId: string;
    idempotencyKey: string;
  },
): Promise<{ campaign: DiscoveryCampaignDto; replayed: boolean }> {
  const replayed = await transaction(pool, async (client) => {
    const campaign = await loadCampaignRow(
      client,
      input.project,
      input.campaignId,
      true,
    );
    if (!campaign) throw new DiscoveryCampaignError("not_found");
    const commandReplayed = await recordCommand(client, {
      ...input,
      command: "cancel",
    });
    if (
      !["completed", "partial", "failed", "cancelled"].includes(campaign.status)
    ) {
      await client.query(
        `UPDATE leadgrid_discovery_campaign_runs
            SET status = 'cancel_requested',
                cancellation_requested_at =
                  COALESCE(cancellation_requested_at, NOW()),
                cancellation_requested_by =
                  COALESCE(cancellation_requested_by, $4),
                error_code = NULL, error_message = NULL,
                version = version + 1, updated_at = NOW()
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND id = $3::uuid`,
        [
          input.project.organizationId,
          input.project.id,
          campaign.id,
          input.userId,
        ],
      );
    }
    if (commandReplayed) {
      await ensureCampaignTick(client, {
        campaign: {
          ...campaign,
          status: ["completed", "partial", "failed", "cancelled"].includes(
            campaign.status,
          )
            ? campaign.status
            : "cancel_requested",
        },
        userId: input.userId,
      });
    } else {
      await wakeCampaignTick(client, {
        project: input.project,
        campaignId: campaign.id,
        userId: input.userId,
      });
    }
    return commandReplayed;
  });
  const campaign = await reconcileDiscoveryCampaign(pool, {
    project: input.project,
    campaignId: input.campaignId,
    commandUserId: input.userId,
  });
  return { campaign, replayed };
}

export async function retryDiscoveryCampaign(
  pool: Pool,
  input: {
    project: LeadgridAccessibleProject;
    campaignId: string;
    userId: string;
    idempotencyKey: string;
  },
): Promise<{ campaign: DiscoveryCampaignDto; replayed: boolean }> {
  const replayed = await transaction(pool, async (client) => {
    const campaign = await loadCampaignRow(
      client,
      input.project,
      input.campaignId,
      true,
    );
    if (!campaign) throw new DiscoveryCampaignError("not_found");
    const commandReplayed = await recordCommand(client, {
      ...input,
      command: "retry",
    });
    if (commandReplayed) {
      await ensureCampaignTick(client, {
        campaign,
        userId: campaign.requested_by,
      });
      return true;
    }
    if (campaign.status !== "failed") {
      throw new DiscoveryCampaignError("invalid_state");
    }
    if (campaign.active_run_id) {
      const linkedRun = await client.query<{ status: DiscoveryRunStatus }>(
        `SELECT status
           FROM leadgrid_discovery_runs
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND id = $3::uuid
          FOR UPDATE`,
        [
          input.project.organizationId,
          input.project.id,
          campaign.active_run_id,
        ],
      );
      const linkedStatus = linkedRun.rows[0]?.status;
      if (!linkedStatus) throw new DiscoveryCampaignError("internal_error");
      if (!discoveryCampaignCanDetachRun(linkedStatus)) {
        throw new DiscoveryCampaignError("child_run_still_stopping");
      }
    }
    await client.query(
      `UPDATE leadgrid_discovery_campaign_items
          SET status = 'pending', current_run_id = NULL,
              finished_at = NULL, error_code = NULL, error_message = NULL,
              updated_at = NOW()
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND campaign_id = $3::uuid
          AND position = $4`,
      [
        input.project.organizationId,
        input.project.id,
        campaign.id,
        campaign.current_position,
      ],
    );
    await client.query(
      `UPDATE leadgrid_discovery_campaign_runs
          SET status = 'queued', active_run_id = NULL, finished_at = NULL,
              error_code = NULL, error_message = NULL,
              version = version + 1, updated_at = NOW()
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND id = $3::uuid`,
      [input.project.organizationId, input.project.id, campaign.id],
    );
    await wakeCampaignTick(client, {
      project: input.project,
      campaignId: campaign.id,
      userId: campaign.requested_by,
    });
    return false;
  });
  const campaign = await reconcileDiscoveryCampaign(pool, {
    project: input.project,
    campaignId: input.campaignId,
    commandUserId: input.userId,
  });
  return { campaign, replayed };
}

export async function failDiscoveryCampaignMissingActor(
  pool: Pool,
  input: {
    organizationId: string;
    projectId: string;
    campaignId: string;
  },
): Promise<DiscoveryCampaignDto> {
  const project: LeadgridAccessibleProject = {
    id: input.projectId,
    organizationId: input.organizationId,
    name: "",
    description: null,
    industry: null,
    status: "active",
    createdBy: "",
    memberRole: "system",
  };
  await transaction(pool, async (client) => {
    const campaign = await loadCampaignRow(
      client,
      project,
      input.campaignId,
      true,
    );
    if (
      !campaign ||
      ["completed", "partial", "failed", "cancelled"].includes(campaign.status)
    ) {
      return;
    }
    const cancellationWon = campaign.status === "cancel_requested";
    const finalStatus = cancellationWon ? "cancelled" : "failed";
    const message =
      "Brukeren som startet kampanjen finnes ikke lenger. Ingen nye profilkjøringer startes.";
    await client.query(
      `UPDATE leadgrid_discovery_campaign_items
          SET status = $5, finished_at = NOW(),
              error_code = $6, error_message = $7, updated_at = NOW()
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND campaign_id = $3::uuid
          AND position = $4
          AND status IN ('pending', 'launching', 'queued', 'running')`,
      [
        input.organizationId,
        input.projectId,
        campaign.id,
        campaign.current_position,
        finalStatus,
        cancellationWon ? null : "actor_missing",
        cancellationWon ? null : message,
      ],
    );
    await client.query(
      `UPDATE leadgrid_discovery_campaign_runs
          SET status = $4, active_run_id = NULL, finished_at = NOW(),
              error_code = $5, error_message = $6,
              version = version + 1, updated_at = NOW()
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND id = $3::uuid
          AND status IN ('queued', 'running', 'cancel_requested')`,
      [
        input.organizationId,
        input.projectId,
        campaign.id,
        finalStatus,
        cancellationWon ? null : "actor_missing",
        cancellationWon ? null : message,
      ],
    );
  });
  return getDiscoveryCampaign(pool, {
    project,
    campaignId: input.campaignId,
  });
}

/**
 * Last-resort transition used only when the durable campaign tick exhausts
 * its queue attempts. The generation check prevents a stale/dead worker from
 * terminating a campaign that a newer command has already woken. A failed
 * worker enters a durable cleanup-pending state, keeps the partial-index lock
 * and its child pointer, and seeds a fresh generation that observes/cancels
 * the child before exposing the campaign as retryable.
 */
export async function failDiscoveryCampaignWorkerExhausted(
  pool: Pool,
  input: {
    organizationId: string;
    projectId: string;
    campaignId: string;
    pollGeneration: number;
  },
): Promise<boolean> {
  const project: LeadgridAccessibleProject = {
    id: input.projectId,
    organizationId: input.organizationId,
    name: "",
    description: null,
    industry: null,
    status: "active",
    createdBy: "",
    memberRole: "system",
  };
  return transaction(pool, async (client) => {
    const campaign = await loadCampaignRow(
      client,
      project,
      input.campaignId,
      true,
    );
    if (
      !campaign ||
      integer(campaign.poll_generation) !== input.pollGeneration ||
      !["queued", "running", "cancel_requested"].includes(campaign.status)
    ) {
      return false;
    }

    if (campaign.active_run_id) {
      await client.query(
        `UPDATE leadgrid_discovery_runs
            SET status = CASE
                  WHEN status IN ('planning', 'awaiting_confirmation')
                    THEN 'cancelled'
                  ELSE 'cancel_requested'
                END,
                cancellation_requested_at =
                  COALESCE(cancellation_requested_at, NOW()),
                finished_at = CASE
                  WHEN status IN ('planning', 'awaiting_confirmation')
                    THEN COALESCE(finished_at, NOW())
                  ELSE finished_at
                END,
                version = version + 1,
                updated_at = NOW()
          WHERE organization_id = $1::uuid
            AND project_id = $2
            AND id = $3::uuid
            AND status IN (
              'planning', 'awaiting_confirmation', 'queued',
              'searching', 'researching', 'cancel_requested'
            )`,
        [input.organizationId, input.projectId, campaign.active_run_id],
      );
    }

    const cancellationWon =
      campaign.status === "cancel_requested" &&
      campaign.error_code !== "campaign_worker_exhausted";
    const code = cancellationWon ? null : "campaign_worker_exhausted";
    const message = cancellationWon
      ? null
      : "Kampanjearbeideren brukte opp alle sikre forsøk. Prøv den feilede profilen igjen.";
    await client.query(
      `UPDATE leadgrid_discovery_campaign_items
          SET error_code = $5, error_message = $6, updated_at = NOW()
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND campaign_id = $3::uuid
          AND position = $4
          AND status IN ('pending', 'launching', 'queued', 'running')`,
      [
        input.organizationId,
        input.projectId,
        campaign.id,
        campaign.current_position,
        code,
        message,
      ],
    );
    const updated = await client.query<{ poll_generation: number }>(
      `UPDATE leadgrid_discovery_campaign_runs
          SET status = 'cancel_requested', finished_at = NULL,
              cancellation_requested_at =
                COALESCE(cancellation_requested_at, NOW()),
              error_code = $5, error_message = $6,
              version = version + 1, updated_at = NOW()
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND id = $3::uuid
          AND poll_generation = $4
          AND status IN ('queued', 'running', 'cancel_requested')
        RETURNING poll_generation`,
      [
        input.organizationId,
        input.projectId,
        campaign.id,
        input.pollGeneration,
        code,
        message,
      ],
    );
    if ((updated.rowCount ?? 0) !== 1) return false;
    await wakeCampaignTick(client, {
      project,
      campaignId: campaign.id,
      userId: campaign.requested_by,
    });
    return true;
  });
}

export const discoveryCampaignJobHandler: JobHandler = async (
  pool,
  payload,
  job,
  context,
) => {
  if (context.signal.aborted) throw context.signal.reason;
  const campaignId = nonEmpty(payload.campaignId, "campaignId", 64);
  const authoritative = await loadDiscoveryCampaignJobContext(
    pool,
    campaignId,
    payload,
  );
  const suppliedGeneration = payload.pollGeneration;
  if (
    typeof suppliedGeneration !== "number" ||
    !Number.isSafeInteger(suppliedGeneration) ||
    suppliedGeneration < 0
  ) {
    throw new DiscoveryCampaignError("invalid_request", {
      field: "job_payload.pollGeneration",
    });
  }
  if (suppliedGeneration !== authoritative.pollGeneration) {
    return {
      campaign_id: authoritative.campaignId,
      stale: true,
      poll_generation: authoritative.pollGeneration,
    };
  }
  const project: LeadgridAccessibleProject = {
    id: authoritative.projectId,
    organizationId: authoritative.organizationId,
    name: "",
    description: null,
    industry: null,
    status: "active",
    createdBy: authoritative.requestedBy ?? "",
    memberRole: "system",
  };
  try {
    const campaign = await reconcileDiscoveryCampaign(pool, {
      project,
      campaignId: authoritative.campaignId,
      commandUserId: null,
      tickGeneration: suppliedGeneration,
    });
    return {
      campaign_id: campaign.id,
      status: campaign.status,
      current_position: campaign.current_position,
      total_profiles: campaign.total_profiles,
    };
  } catch (error) {
    if (
      !context.signal.aborted &&
      integer(job.attempts) >= integer(job.max_attempts, 1)
    ) {
      await failDiscoveryCampaignWorkerExhausted(pool, {
        organizationId: authoritative.organizationId,
        projectId: authoritative.projectId,
        campaignId: authoritative.campaignId,
        pollGeneration: suppliedGeneration,
      });
    }
    throw error;
  }
};
