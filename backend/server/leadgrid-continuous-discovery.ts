import { createHash, randomUUID } from "node:crypto";
import { parseExpression } from "cron-parser";
import type { Pool, PoolClient } from "pg";

import {
  discoveryBriefSchema,
  type DiscoveryBrief,
} from "./leadgrid-discovery-contract.js";
import {
  createDiscoveryRun,
  isLeadgridDiscoveryEnabled,
  type DiscoveryRunStatus,
  type DiscoveryTriggerKind,
} from "./leadgrid-discovery-service.js";
import type { LeadgridAccessibleProject } from "./leadgrid-project-access.js";

export interface RunDiscoveryOpts {
  projectId: string;
  ownerUserId: string;
  organizationId: string;
  count?: number;
  industryQueryOverride?: string | null;
  cityOverride?: string | null;
  idempotencyKey?: string;
  scheduledFor?: Date | string | null;
  triggerKind?: DiscoveryTriggerKind;
  profileId?: string | null;
}

export type RunDiscoveryResult =
  | {
      ok: true;
      /** Compatibility alias while workflow consumers migrate to runId. */
      batchId: string;
      runId: string;
      foundCount: 0;
      discoveryQuery: string;
      pinnedLeads: 0;
      status: DiscoveryRunStatus;
      queued: true;
      replayed: boolean;
    }
  | { ok: false; reason: string };

interface DiscoverySourceRow {
  project_id: string;
  organization_id: string;
  project_name: string;
  project_description: string | null;
  project_industry: string | null;
  project_status: string | null;
  project_created_by: string | null;
  actor_user_id: string | null;
  profile_id: string | null;
  profile_version: number | null;
  target_customer_types: string[] | null;
  city_filters: string[] | null;
  geography_lat: string | number | null;
  geography_lng: string | number | null;
  geography_radius_km: number | null;
  profile_brief: Record<string, unknown> | null;
  max_candidates_per_run: number | null;
  enrichment_count: number | null;
}

interface LegacyConfigRow {
  industry_query: string | null;
  industry_queries: string[] | null;
  city_filter: string[] | null;
  geography_lat: string | number | null;
  geography_lng: string | number | null;
  geography_radius_km: number | null;
  count_per_run: number;
  created_by_user_id: string | null;
}

interface DueSourceRow {
  source_kind: "profile" | "legacy";
  source_id: string;
  profile_id: string | null;
  profile_version: number | null;
  project_id: string;
  organization_id: string;
  actor_user_id: string | null;
  schedule_cron: string;
  schedule_timezone: string;
  next_run_at: Date | string | null;
}

interface ExistingRunRow {
  id: string;
  status: DiscoveryRunStatus;
  brief_snapshot: unknown;
}

const POLLER_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_CRON = "0 6 * * *";
const DEFAULT_TIMEZONE = "Europe/Oslo";
const MAX_DUE_PER_TICK = 5;
export const MIN_DISCOVERY_SCHEDULE_INTERVAL_MS = 20 * 60 * 60 * 1_000;
const PERMANENT_SOURCE_FAILURES = new Set([
  "project_or_profile_not_found",
  "discovery_brief_invalid",
  "discovery_actor_required",
]);

let pollerHandle: NodeJS.Timeout | null = null;
let pollerRunning = false;

function cleanStrings(values: unknown, maximum = 8): string[] {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].slice(0, maximum);
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const number = finiteNumber(value);
  if (number === null) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function projectFrom(row: DiscoverySourceRow): LeadgridAccessibleProject {
  return {
    id: row.project_id,
    organizationId: row.organization_id,
    name: row.project_name,
    description: row.project_description,
    industry: row.project_industry,
    status: row.project_status,
    createdBy: row.project_created_by,
    memberRole: "system",
  };
}

function buildBrief(
  source: DiscoverySourceRow,
  legacy: LegacyConfigRow | null,
  opts: RunDiscoveryOpts,
): DiscoveryBrief | null {
  const stored = source.profile_brief ?? {};
  const profileQueries = cleanStrings(source.target_customer_types);
  const legacyQueries = cleanStrings(legacy?.industry_queries);
  const fallbackLegacyQuery = legacy?.industry_query?.trim();
  const industryQueries = opts.industryQueryOverride?.trim()
    ? [opts.industryQueryOverride.trim()]
    : profileQueries.length > 0
      ? profileQueries
      : legacyQueries.length > 0
        ? legacyQueries
        : fallbackLegacyQuery
          ? [fallbackLegacyQuery]
          : [];
  if (industryQueries.length === 0) return null;

  const cities =
    cleanStrings(source.city_filters).length > 0
      ? cleanStrings(source.city_filters)
      : cleanStrings(legacy?.city_filter);
  const latitude = finiteNumber(
    source.geography_lat ?? legacy?.geography_lat ?? null,
  );
  const longitude = finiteNumber(
    source.geography_lng ?? legacy?.geography_lng ?? null,
  );
  const radiusKm = clampInteger(
    source.geography_radius_km ?? legacy?.geography_radius_km,
    25,
    1,
    50,
  );
  const geo =
    latitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude !== null &&
    longitude >= -180 &&
    longitude <= 180
      ? { latitude, longitude, radius_km: radiusKm }
      : null;
  const targetCount = clampInteger(
    opts.count ??
      source.max_candidates_per_run ??
      legacy?.count_per_run ??
      stored.target_count,
    20,
    1,
    60,
  );
  const enrichmentCount = Math.min(
    targetCount,
    clampInteger(source.enrichment_count ?? stored.enrichment_count, 10, 1, 60),
  );
  const city = opts.cityOverride?.trim() || cities[0] || (geo ? null : "Norge");
  const parsed = discoveryBriefSchema.safeParse({
    ...stored,
    industry_queries: industryQueries,
    exclusion_terms: cleanStrings(stored.exclusion_terms, 30),
    city,
    geo,
    target_count: targetCount,
    enrichment_count: enrichmentCount,
    minimum_fit_score: clampInteger(stored.minimum_fit_score, 50, 0, 100),
    ideal_customer:
      typeof stored.ideal_customer === "string" ? stored.ideal_customer : null,
    goal: typeof stored.goal === "string" ? stored.goal : null,
  });
  return parsed.success ? parsed.data : null;
}

async function loadDiscoverySource(
  pool: Pool,
  opts: RunDiscoveryOpts,
): Promise<{
  source: DiscoverySourceRow;
  legacy: LegacyConfigRow | null;
} | null> {
  const requestedProfileId = opts.profileId?.trim() || null;
  const sourceResult = await pool.query<DiscoverySourceRow>(
    `SELECT p.id::text AS project_id,
            p.organization_id::text,
            p.name AS project_name,
            p.description AS project_description,
            p.industry AS project_industry,
            p.status AS project_status,
            p.created_by AS project_created_by,
            COALESCE(dp.updated_by, dp.created_by, p.created_by, member.user_id)
              AS actor_user_id,
            dp.id::text AS profile_id,
            dp.version AS profile_version,
            dp.target_customer_types,
            dp.city_filters,
            dp.geography_lat::text,
            dp.geography_lng::text,
            dp.geography_radius_km,
            dp.brief AS profile_brief,
            dp.max_candidates_per_run,
            dp.enrichment_count
       FROM leadgrid_projects p
       LEFT JOIN LATERAL (
         SELECT profile.*
           FROM leadgrid_discovery_profiles profile
          WHERE profile.organization_id = p.organization_id
            AND profile.project_id = p.id
            AND profile.status <> 'archived'
            AND (
              ($3::uuid IS NOT NULL AND profile.id = $3::uuid)
              OR ($3::uuid IS NULL AND profile.is_default = TRUE)
            )
          ORDER BY profile.is_default DESC, profile.updated_at DESC
          LIMIT 1
       ) dp ON TRUE
       LEFT JOIN LATERAL (
         SELECT om.user_id
           FROM organization_members om
          WHERE om.organization_id = p.organization_id
          ORDER BY CASE WHEN om.role IN ('owner', 'admin') THEN 0 ELSE 1 END,
                   om.joined_at ASC,
                   om.user_id ASC
          LIMIT 1
       ) member ON TRUE
      WHERE p.organization_id = $1::uuid
        AND p.id = $2
        AND (p.status IS NULL OR p.status NOT IN ('archived', 'deleted'))
        AND (p.project_type IS NULL OR p.project_type NOT IN (
          'feature_film', 'documentary', 'film', 'short_film',
          'tv_series', 'commercial', 'music_video', 'casting'
        ))
      LIMIT 1`,
    [opts.organizationId, opts.projectId, requestedProfileId],
  );
  const source = sourceResult.rows[0];
  if (!source) return null;
  if (requestedProfileId && source.profile_id !== requestedProfileId)
    return null;

  if (source.profile_id) return { source, legacy: null };
  const legacyResult = await pool.query<LegacyConfigRow>(
    `SELECT industry_query, industry_queries, city_filter,
            geography_lat::text, geography_lng::text,
            geography_radius_km, count_per_run,
            created_by_user_id::text
       FROM leadgrid_project_discovery_config
      WHERE project_id = $1
        AND (organization_id = $2::uuid OR organization_id IS NULL)
      ORDER BY (organization_id = $2::uuid) DESC
      LIMIT 1`,
    [opts.projectId, opts.organizationId],
  );
  return { source, legacy: legacyResult.rows[0] ?? null };
}

function defaultIdempotencyKey(): string {
  return `discovery-workflow:${randomUUID()}`;
}

function scheduledIdempotencyKey(sourceId: string, scheduledFor: Date): string {
  const digest = createHash("sha256")
    .update(`${sourceId}|${scheduledFor.toISOString()}`)
    .digest("hex");
  return `discovery-scheduled:${digest}`;
}

async function loadExistingRun(
  pool: Pool,
  opts: RunDiscoveryOpts,
): Promise<RunDiscoveryResult | null> {
  if (!opts.idempotencyKey) return null;
  const existing = await pool.query<ExistingRunRow>(
    `SELECT id::text, status, brief_snapshot
       FROM leadgrid_discovery_runs
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND idempotency_key = $3
      LIMIT 1`,
    [opts.organizationId, opts.projectId, opts.idempotencyKey],
  );
  const row = existing.rows[0];
  if (!row) return null;
  const brief = discoveryBriefSchema.safeParse(row.brief_snapshot);
  const discoveryQuery = brief.success
    ? `${brief.data.industry_queries.join(" + ")} i ${brief.data.city ?? "valgt kartområde"}`
    : "Discovery";
  return {
    ok: true,
    batchId: row.id,
    runId: row.id,
    foundCount: 0,
    discoveryQuery,
    pinnedLeads: 0,
    status: row.status,
    queued: true,
    replayed: true,
  };
}

export async function runDiscoveryForProject(
  pool: Pool,
  opts: RunDiscoveryOpts,
): Promise<RunDiscoveryResult> {
  if (!isLeadgridDiscoveryEnabled()) {
    return { ok: false, reason: "discovery_not_enabled" };
  }
  const replay = await loadExistingRun(pool, opts);
  if (replay) return replay;
  const loaded = await loadDiscoverySource(pool, opts);
  if (!loaded) return { ok: false, reason: "project_or_profile_not_found" };
  const brief = buildBrief(loaded.source, loaded.legacy, opts);
  if (!brief) return { ok: false, reason: "discovery_brief_invalid" };
  const userId =
    opts.ownerUserId.trim() ||
    loaded.source.actor_user_id?.trim() ||
    loaded.legacy?.created_by_user_id?.trim() ||
    "";
  if (!userId) return { ok: false, reason: "discovery_actor_required" };

  const result = await createDiscoveryRun(pool, {
    project: projectFrom(loaded.source),
    userId,
    brief,
    profileId: loaded.source.profile_id,
    expectedProfileVersion: loaded.source.profile_version,
    idempotencyKey: opts.idempotencyKey ?? defaultIdempotencyKey(),
    startImmediately: true,
    triggerKind: opts.triggerKind ?? "workflow",
    scheduledFor: opts.scheduledFor ?? null,
  });
  const runId = result.run.id;
  const area = brief.city ?? "valgt kartområde";
  return {
    ok: true,
    batchId: runId,
    runId,
    foundCount: 0,
    discoveryQuery: `${brief.industry_queries.join(" + ")} i ${area}`,
    pinnedLeads: 0,
    status: result.run.status,
    queued: true,
    replayed: result.replayed,
  };
}

export function nextDiscoveryScheduledAt(
  scheduleCron: string,
  scheduleTimezone: string,
  after: Date,
): Date {
  const cron = scheduleCron.trim();
  const timezone = scheduleTimezone.trim();
  if (!cron || !timezone || !Number.isFinite(after.getTime())) {
    throw new Error("invalid_discovery_schedule");
  }
  return parseExpression(cron, {
    currentDate: after,
    tz: timezone,
  })
    .next()
    .toDate();
}

/** Backwards-compatible name used by existing scheduler tests and callers. */
export const nextScheduledAt = nextDiscoveryScheduledAt;

export function isValidDiscoverySchedule(
  scheduleCron: string,
  scheduleTimezone: string,
): boolean {
  try {
    const first = nextDiscoveryScheduledAt(
      scheduleCron,
      scheduleTimezone,
      new Date("2026-01-01T00:00:00.000Z"),
    );
    const second = nextDiscoveryScheduledAt(
      scheduleCron,
      scheduleTimezone,
      first,
    );
    return second.valueOf() - first.valueOf() >= MIN_DISCOVERY_SCHEDULE_INTERVAL_MS;
  } catch {
    return false;
  }
}

async function actorIsCurrentMember(
  client: PoolClient,
  row: DueSourceRow,
): Promise<boolean> {
  if (!row.actor_user_id) return false;
  const result = await client.query(
    `SELECT 1
       FROM organization_members
      WHERE organization_id = $1::uuid
        AND user_id = $2
      LIMIT 1`,
    [row.organization_id, row.actor_user_id],
  );
  return Boolean(result.rows[0]);
}

async function loadDueSources(
  pool: Pool,
  now: Date,
  limit = MAX_DUE_PER_TICK,
): Promise<DueSourceRow[]> {
  const profiles = await pool.query<DueSourceRow>(
    `SELECT 'profile'::text AS source_kind,
            dp.id::text AS source_id,
            dp.id::text AS profile_id,
            dp.version AS profile_version,
            dp.project_id,
            dp.organization_id::text,
            COALESCE(dp.updated_by, dp.created_by, p.created_by, member.user_id)
              AS actor_user_id,
            dp.schedule_cron,
            dp.schedule_timezone,
            dp.next_run_at
       FROM leadgrid_discovery_profiles dp
       JOIN leadgrid_projects p
         ON p.organization_id = dp.organization_id
        AND p.id = dp.project_id
       LEFT JOIN LATERAL (
         SELECT om.user_id
           FROM organization_members om
          WHERE om.organization_id = dp.organization_id
          ORDER BY CASE WHEN om.role IN ('owner', 'admin') THEN 0 ELSE 1 END,
                   om.joined_at ASC,
                   om.user_id ASC
          LIMIT 1
       ) member ON TRUE
      WHERE dp.auto_discover_enabled = TRUE
        AND dp.status = 'active'
        AND (dp.next_run_at IS NULL OR dp.next_run_at <= $1::timestamptz)
        AND (p.status IS NULL OR p.status NOT IN ('archived', 'deleted'))
        AND (p.project_type IS NULL OR p.project_type NOT IN (
          'feature_film', 'documentary', 'film', 'short_film',
          'tv_series', 'commercial', 'music_video', 'casting'
        ))
      ORDER BY
        ROW_NUMBER() OVER (
          PARTITION BY dp.organization_id
          ORDER BY dp.next_run_at NULLS FIRST, dp.id
        ),
        dp.next_run_at NULLS FIRST,
        dp.organization_id,
        dp.id
      LIMIT $2`,
    [now.toISOString(), limit],
  );
  if (profiles.rows.length >= limit) return profiles.rows;

  const legacy = await pool.query<DueSourceRow>(
    `SELECT 'legacy'::text AS source_kind,
            ('legacy:' || p.id)::text AS source_id,
            NULL::text AS profile_id,
            NULL::integer AS profile_version,
            p.id::text AS project_id,
            p.organization_id::text,
            COALESCE(legacy_actor.id, p.created_by, member.user_id)
              AS actor_user_id,
            $3::text AS schedule_cron,
            $4::text AS schedule_timezone,
            c.next_run_at
       FROM leadgrid_project_discovery_config c
       JOIN leadgrid_projects p
         ON p.id = c.project_id
        AND p.organization_id IS NOT NULL
        AND (c.organization_id = p.organization_id OR c.organization_id IS NULL)
       LEFT JOIN users legacy_actor
         ON legacy_actor.id = c.created_by_user_id::text
       LEFT JOIN LATERAL (
         SELECT om.user_id
           FROM organization_members om
          WHERE om.organization_id = p.organization_id
          ORDER BY CASE WHEN om.role IN ('owner', 'admin') THEN 0 ELSE 1 END,
                   om.joined_at ASC,
                   om.user_id ASC
          LIMIT 1
       ) member ON TRUE
      WHERE c.auto_discover_enabled = TRUE
        AND (c.next_run_at IS NULL OR c.next_run_at <= $1::timestamptz)
        AND NOT EXISTS (
          SELECT 1
            FROM leadgrid_discovery_profiles dp
           WHERE dp.organization_id = p.organization_id
             AND dp.project_id = p.id
             AND dp.is_default = TRUE
             AND dp.status <> 'archived'
        )
        AND (p.status IS NULL OR p.status NOT IN ('archived', 'deleted'))
        AND (p.project_type IS NULL OR p.project_type NOT IN (
          'feature_film', 'documentary', 'film', 'short_film',
          'tv_series', 'commercial', 'music_video', 'casting'
        ))
      ORDER BY
        ROW_NUMBER() OVER (
          PARTITION BY p.organization_id
          ORDER BY c.next_run_at NULLS FIRST, p.id
        ),
        c.next_run_at NULLS FIRST,
        p.organization_id,
        p.id
      LIMIT $2`,
    [
      now.toISOString(),
      limit - profiles.rows.length,
      DEFAULT_CRON,
      DEFAULT_TIMEZONE,
    ],
  );
  return [...profiles.rows, ...legacy.rows];
}

async function sourceStillDue(
  client: PoolClient,
  row: DueSourceRow,
  now: Date,
): Promise<boolean> {
  const table =
    row.source_kind === "profile"
      ? "leadgrid_discovery_profiles"
      : "leadgrid_project_discovery_config";
  const idColumn = row.source_kind === "profile" ? "id" : "project_id";
  const idCast = row.source_kind === "profile" ? "::uuid" : "";
  const organizationCondition =
    row.source_kind === "profile"
      ? "organization_id = $1::uuid"
      : "(organization_id = $1::uuid OR organization_id IS NULL)";
  const result = await client.query(
    `SELECT 1
       FROM ${table}
      WHERE ${idColumn} = $3${idCast}
        AND ${organizationCondition}
        AND project_id = $2
        AND auto_discover_enabled = TRUE
        AND (next_run_at IS NULL OR next_run_at <= $4::timestamptz)
      LIMIT 1`,
    [
      row.organization_id,
      row.project_id,
      row.source_kind === "profile" ? row.source_id : row.project_id,
      now.toISOString(),
    ],
  );
  return Boolean(result.rows[0]);
}

async function advanceDueSource(
  pool: Pool,
  row: DueSourceRow,
  expectedSlot: Date | null,
  nextRunAt: Date,
  queued: boolean,
): Promise<void> {
  if (row.source_kind === "profile") {
    await pool.query(
      `UPDATE leadgrid_discovery_profiles
          SET next_run_at = $5::timestamptz,
              last_run_at = CASE WHEN $6 THEN NOW() ELSE last_run_at END
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND id = $3::uuid
          AND next_run_at IS NOT DISTINCT FROM $4::timestamptz`,
      [
        row.organization_id,
        row.project_id,
        row.source_id,
        expectedSlot?.toISOString() ?? null,
        nextRunAt.toISOString(),
        queued,
      ],
    );
    return;
  }
  await pool.query(
    `UPDATE leadgrid_project_discovery_config
        SET organization_id = $1::uuid,
            next_run_at = $4::timestamptz,
            last_run_at = CASE WHEN $5 THEN NOW() ELSE last_run_at END,
            total_discoveries = total_discoveries + CASE WHEN $5 THEN 1 ELSE 0 END,
            updated_at = NOW()
      WHERE project_id = $2
        AND (organization_id = $1::uuid OR organization_id IS NULL)
        AND next_run_at IS NOT DISTINCT FROM $3::timestamptz`,
    [
      row.organization_id,
      row.project_id,
      expectedSlot?.toISOString() ?? null,
      nextRunAt.toISOString(),
      queued,
    ],
  );
}

async function pauseDueSource(
  pool: Pool,
  row: DueSourceRow,
  expectedSlot: Date | null,
): Promise<void> {
  if (row.source_kind === "profile") {
    await pool.query(
      `UPDATE leadgrid_discovery_profiles
          SET auto_discover_enabled = FALSE,
              status = 'paused',
              next_run_at = NULL
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND id = $3::uuid
          AND next_run_at IS NOT DISTINCT FROM $4::timestamptz`,
      [
        row.organization_id,
        row.project_id,
        row.source_id,
        expectedSlot?.toISOString() ?? null,
      ],
    );
    return;
  }
  await pool.query(
    `UPDATE leadgrid_project_discovery_config
        SET auto_discover_enabled = FALSE,
            next_run_at = NULL,
            updated_at = NOW()
      WHERE project_id = $2
        AND (organization_id = $1::uuid OR organization_id IS NULL)
        AND next_run_at IS NOT DISTINCT FROM $3::timestamptz`,
    [row.organization_id, row.project_id, expectedSlot?.toISOString() ?? null],
  );
}

async function processDueSource(
  pool: Pool,
  row: DueSourceRow,
  now: Date,
): Promise<RunDiscoveryResult | null> {
  const lockClient = await pool.connect();
  const lockKey = `${row.organization_id}|${row.project_id}|${row.source_id}`;
  let acquired = false;
  try {
    const lock = await lockClient.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired`,
      [lockKey],
    );
    acquired = lock.rows[0]?.acquired === true;
    if (!acquired || !(await sourceStillDue(lockClient, row, now))) return null;

    const slot = row.next_run_at ? new Date(row.next_run_at) : null;
    if (!(await actorIsCurrentMember(lockClient, row))) {
      await pauseDueSource(pool, row, slot);
      console.warn(
        `[continuous-discovery] source=${row.source_id} paused=actor_not_member`,
      );
      return { ok: false, reason: "discovery_actor_not_member" };
    }
    const nextBase = slot && slot > now ? slot : now;
    let nextRunAt: Date;
    try {
      if (!isValidDiscoverySchedule(row.schedule_cron, row.schedule_timezone)) {
        throw new Error("invalid_discovery_schedule");
      }
      nextRunAt = nextDiscoveryScheduledAt(
        row.schedule_cron || DEFAULT_CRON,
        row.schedule_timezone || DEFAULT_TIMEZONE,
        nextBase,
      );
    } catch {
      await pauseDueSource(pool, row, slot);
      console.warn(
        `[continuous-discovery] source=${row.source_id} paused=invalid_schedule`,
      );
      return { ok: false, reason: "discovery_schedule_invalid" };
    }
    if (!slot) {
      await advanceDueSource(pool, row, null, nextRunAt, false);
      return null;
    }
    const result = await runDiscoveryForProject(pool, {
      projectId: row.project_id,
      organizationId: row.organization_id,
      ownerUserId: row.actor_user_id ?? "",
      profileId: row.profile_id,
      idempotencyKey: scheduledIdempotencyKey(row.source_id, slot),
      scheduledFor: slot,
      triggerKind: "scheduled",
    });
    if (result.ok) {
      await advanceDueSource(pool, row, slot, nextRunAt, true);
    } else if (PERMANENT_SOURCE_FAILURES.has(result.reason)) {
      await pauseDueSource(pool, row, slot);
      console.warn(
        `[continuous-discovery] source=${row.source_id} paused=${result.reason}`,
      );
    }
    return result;
  } finally {
    if (acquired) {
      let releaseError: Error | undefined;
      try {
        await lockClient.query(
          `SELECT pg_advisory_unlock(hashtextextended($1, 0))`,
          [lockKey],
        );
      } catch (error) {
        releaseError =
          error instanceof Error ? error : new Error("advisory_unlock_failed");
      }
      lockClient.release(releaseError);
    } else {
      lockClient.release();
    }
  }
}

async function runPollerTick(pool: Pool, now = new Date()): Promise<void> {
  if (!isLeadgridDiscoveryEnabled()) return;
  if (pollerRunning) return;
  pollerRunning = true;
  try {
    const rows = await loadDueSources(pool, now).catch((error) => {
      console.warn("[continuous-discovery] due-profile query failed", error);
      return [] as DueSourceRow[];
    });
    for (const row of rows) {
      try {
        const result = await processDueSource(pool, row, now);
        if (result?.ok) {
          console.log(
            `[continuous-discovery] project=${row.project_id} run=${result.runId} status=${result.status}`,
          );
        } else if (result && !result.ok) {
          console.warn(
            `[continuous-discovery] project=${row.project_id} skipped=${result.reason}`,
          );
        }
      } catch (error) {
        console.error(
          `[continuous-discovery] project=${row.project_id} failed`,
          error,
        );
      }
    }
  } finally {
    pollerRunning = false;
  }
}

export function registerLeadgridContinuousDiscoveryCron(pool: Pool): void {
  if (pollerHandle) return;
  pollerHandle = setInterval(
    () => void runPollerTick(pool),
    POLLER_INTERVAL_MS,
  );
  setTimeout(() => void runPollerTick(pool), 30_000);
  console.log("[continuous-discovery] v2 poller registered (interval 5 min)");
}

export function _stopContinuousDiscoveryCron(): void {
  if (pollerHandle) {
    clearInterval(pollerHandle);
    pollerHandle = null;
  }
  pollerRunning = false;
}

export const __test = {
  buildBrief,
  loadDiscoverySource,
  loadExistingRun,
  loadDueSources,
  isValidDiscoverySchedule,
  nextDiscoveryScheduledAt,
  nextScheduledAt,
  pauseDueSource,
  processDueSource,
  runPollerTick,
  scheduledIdempotencyKey,
};
