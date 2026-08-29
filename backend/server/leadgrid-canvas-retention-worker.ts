import { randomUUID } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 200;
const DESTRUCTIVE_CONFIRMATION = "DELETE_EXPIRED_CANVAS_DATA";
const ADVISORY_LOCK_ID = "843529714054391";

export type CanvasRetentionMode = "dry-run" | "apply";
export type CanvasRetentionTrigger = "cron" | "manual";

export interface CanvasRetentionWorkerConfig {
  enabled: boolean;
  requestedMode: CanvasRetentionMode;
  mode: CanvasRetentionMode;
  destructiveConfirmed: boolean;
  includeOrphans: boolean;
  retentionDays: number;
  batchSize: number;
}
export type CanvasRetentionSweepConfig = Pick<
  CanvasRetentionWorkerConfig,
  | "enabled"
  | "mode"
  | "destructiveConfirmed"
  | "includeOrphans"
  | "retentionDays"
  | "batchSize"
>;

export interface CanvasRetentionSweepSummary {
  runId: string;
  trigger: CanvasRetentionTrigger;
  status: "running" | "completed" | "skipped_locked" | "failed";
  mode: CanvasRetentionMode;
  includeOrphans: boolean;
  retentionDays: number;
  batchSize: number;
  lockAcquired: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  trash: {
    notesScanned: number;
    versionsScanned: number;
    documentsScanned: number;
    notesDeleted: number;
    versionsDeleted: number;
    documentsDeleted: number;
  };
  orphans: {
    versionsScanned: number;
    documentsScanned: number;
    documentsWithMissingParentScanned: number;
    documentScopeMismatchesScanned: number;
    versionsDeleted: number;
    documentsDeleted: number;
  };
  error: string | null;
}

interface TrashCandidate extends QueryResultRow {
  id: string;
  organization_id: string;
  user_id: string;
}

interface OrphanVersionCandidate extends QueryResultRow {
  id: string;
  notat_id: string;
}

interface OrphanDocumentCandidate extends QueryResultRow {
  id: string;
  notat_id: string;
  organization_id: string;
  user_id: string;
  parent_missing: boolean;
}

interface CountRow extends QueryResultRow {
  count: number | string;
}

function isTrue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(parsed)));
}

/**
 * The worker is deliberately off and non-destructive by default. An apply run
 * requires all three independent switches: ENABLED, MODE=apply and the exact
 * destructive confirmation phrase. Orphan reconciliation has its own switch.
 */
export function readCanvasRetentionWorkerConfig(
  env: NodeJS.ProcessEnv = process.env,
): CanvasRetentionWorkerConfig {
  const requestedMode: CanvasRetentionMode =
    env.CANVAS_RETENTION_WORKER_MODE?.trim().toLowerCase() === "apply"
      ? "apply"
      : "dry-run";
  const destructiveConfirmed =
    env.CANVAS_RETENTION_WORKER_DESTRUCTIVE_CONFIRMATION ===
    DESTRUCTIVE_CONFIRMATION;
  const mode: CanvasRetentionMode =
    requestedMode === "apply" && destructiveConfirmed ? "apply" : "dry-run";
  return {
    enabled: isTrue(env.CANVAS_RETENTION_WORKER_ENABLED),
    requestedMode,
    mode,
    destructiveConfirmed,
    includeOrphans: isTrue(env.CANVAS_RETENTION_WORKER_RECONCILE_ORPHANS),
    retentionDays: boundedInteger(
      env.CANVAS_RETENTION_WORKER_RETENTION_DAYS,
      DEFAULT_RETENTION_DAYS,
      DEFAULT_RETENTION_DAYS,
      3650,
    ),
    batchSize: boundedInteger(
      env.CANVAS_RETENTION_WORKER_BATCH_SIZE,
      DEFAULT_BATCH_SIZE,
      1,
      MAX_BATCH_SIZE,
    ),
  };
}

function createSummary(
  trigger: CanvasRetentionTrigger,
  config: Pick<
    CanvasRetentionWorkerConfig,
    "mode" | "includeOrphans" | "retentionDays" | "batchSize"
  >,
): CanvasRetentionSweepSummary {
  const startedAt = new Date().toISOString();
  return {
    runId: randomUUID(),
    trigger,
    status: "running",
    mode: config.mode,
    includeOrphans: config.includeOrphans,
    retentionDays: config.retentionDays,
    batchSize: config.batchSize,
    lockAcquired: false,
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    trash: {
      notesScanned: 0,
      versionsScanned: 0,
      documentsScanned: 0,
      notesDeleted: 0,
      versionsDeleted: 0,
      documentsDeleted: 0,
    },
    orphans: {
      versionsScanned: 0,
      documentsScanned: 0,
      documentsWithMissingParentScanned: 0,
      documentScopeMismatchesScanned: 0,
      versionsDeleted: 0,
      documentsDeleted: 0,
    },
    error: null,
  };
}

function finishSummary(
  summary: CanvasRetentionSweepSummary,
  startedMs: number,
  status: CanvasRetentionSweepSummary["status"],
  error: string | null = null,
): CanvasRetentionSweepSummary {
  summary.status = status;
  summary.finishedAt = new Date().toISOString();
  summary.durationMs = Math.max(0, Date.now() - startedMs);
  summary.error = error;
  return summary;
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 300);
}

function readCount(rows: CountRow[]): number {
  const count = Number(rows[0]?.count ?? 0);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function candidateArrays(
  candidates: TrashCandidate[],
): [string[], string[], string[]] {
  return [
    candidates.map((candidate) => candidate.id),
    candidates.map((candidate) => candidate.organization_id),
    candidates.map((candidate) => candidate.user_id),
  ];
}

async function scanTrash(
  client: PoolClient,
  summary: CanvasRetentionSweepSummary,
): Promise<TrashCandidate[]> {
  const result = await client.query<TrashCandidate>(
    `SELECT id::text, organization_id, user_id
       FROM leadgrid_canvas_notater
      WHERE slettet_at IS NOT NULL
        AND slettet_at < now() - ($1::int * interval '1 day')
      ORDER BY slettet_at ASC, organization_id ASC, user_id ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT $2`,
    [summary.retentionDays, summary.batchSize],
  );
  const candidates = result.rows;
  summary.trash.notesScanned = candidates.length;
  if (candidates.length === 0) return candidates;

  const [ids, organizationIds, userIds] = candidateArrays(candidates);
  const versions = await client.query<CountRow>(
    `SELECT COUNT(*)::int AS count
       FROM leadgrid_canvas_versjoner v
       JOIN leadgrid_canvas_notater n ON n.id = v.notat_id
       JOIN unnest($1::uuid[], $2::text[], $3::text[])
         AS candidate(id, organization_id, user_id)
         ON candidate.id = n.id
        AND candidate.organization_id = n.organization_id
        AND candidate.user_id = n.user_id`,
    [ids, organizationIds, userIds],
  );
  const documents = await client.query<CountRow>(
    `SELECT COUNT(*)::int AS count
       FROM leadgrid_canvas_dokumenter d
       JOIN unnest($1::uuid[], $2::text[], $3::text[])
         AS candidate(id, organization_id, user_id)
         ON candidate.id = d.notat_id
        AND candidate.organization_id = d.organization_id
        AND candidate.user_id = d.user_id`,
    [ids, organizationIds, userIds],
  );
  summary.trash.versionsScanned = readCount(versions.rows);
  summary.trash.documentsScanned = readCount(documents.rows);
  return candidates;
}

async function deleteTrash(
  client: PoolClient,
  summary: CanvasRetentionSweepSummary,
  candidates: TrashCandidate[],
): Promise<void> {
  if (candidates.length === 0) return;
  const [ids, organizationIds, userIds] = candidateArrays(candidates);
  const params = [ids, organizationIds, userIds, summary.retentionDays];
  const versions = await client.query(
    `DELETE FROM leadgrid_canvas_versjoner v
      USING leadgrid_canvas_notater n,
            unnest($1::uuid[], $2::text[], $3::text[])
              AS candidate(id, organization_id, user_id)
      WHERE v.notat_id = n.id
        AND candidate.id = n.id
        AND candidate.organization_id = n.organization_id
        AND candidate.user_id = n.user_id
        AND n.slettet_at IS NOT NULL
        AND n.slettet_at < now() - ($4::int * interval '1 day')`,
    params,
  );
  const documents = await client.query(
    `DELETE FROM leadgrid_canvas_dokumenter d
      USING leadgrid_canvas_notater n,
            unnest($1::uuid[], $2::text[], $3::text[])
              AS candidate(id, organization_id, user_id)
      WHERE d.notat_id = n.id
        AND d.organization_id = n.organization_id
        AND d.user_id = n.user_id
        AND candidate.id = n.id
        AND candidate.organization_id = n.organization_id
        AND candidate.user_id = n.user_id
        AND n.slettet_at IS NOT NULL
        AND n.slettet_at < now() - ($4::int * interval '1 day')`,
    params,
  );
  const notes = await client.query(
    `DELETE FROM leadgrid_canvas_notater n
      USING unnest($1::uuid[], $2::text[], $3::text[])
              AS candidate(id, organization_id, user_id)
      WHERE candidate.id = n.id
        AND candidate.organization_id = n.organization_id
        AND candidate.user_id = n.user_id
        AND n.slettet_at IS NOT NULL
        AND n.slettet_at < now() - ($4::int * interval '1 day')`,
    params,
  );
  summary.trash.versionsDeleted = versions.rowCount ?? 0;
  summary.trash.documentsDeleted = documents.rowCount ?? 0;
  summary.trash.notesDeleted = notes.rowCount ?? 0;
}

async function scanOrphans(
  client: PoolClient,
  summary: CanvasRetentionSweepSummary,
): Promise<{
  versions: OrphanVersionCandidate[];
  documents: OrphanDocumentCandidate[];
}> {
  const versions = await client.query<OrphanVersionCandidate>(
    `SELECT v.id::text, v.notat_id::text
       FROM leadgrid_canvas_versjoner v
      WHERE NOT EXISTS (
        SELECT 1 FROM leadgrid_canvas_notater n WHERE n.id = v.notat_id
      )
      ORDER BY v.created_at ASC, v.id ASC
      FOR UPDATE OF v SKIP LOCKED
      LIMIT $1`,
    [summary.batchSize],
  );
  const documents = await client.query<OrphanDocumentCandidate>(
    `SELECT d.id,
            d.notat_id::text,
            d.organization_id,
            d.user_id,
            NOT EXISTS (
              SELECT 1 FROM leadgrid_canvas_notater parent
               WHERE parent.id = d.notat_id
            ) AS parent_missing
       FROM leadgrid_canvas_dokumenter d
      WHERE NOT EXISTS (
        SELECT 1
          FROM leadgrid_canvas_notater n
         WHERE n.id = d.notat_id
           AND n.organization_id = d.organization_id
           AND n.user_id = d.user_id
      )
      ORDER BY d.created_at ASC, d.id ASC
      FOR UPDATE OF d SKIP LOCKED
      LIMIT $1`,
    [summary.batchSize],
  );

  summary.orphans.versionsScanned = versions.rows.length;
  summary.orphans.documentsScanned = documents.rows.length;
  summary.orphans.documentsWithMissingParentScanned = documents.rows.filter(
    (candidate) => candidate.parent_missing === true,
  ).length;
  summary.orphans.documentScopeMismatchesScanned =
    documents.rows.length - summary.orphans.documentsWithMissingParentScanned;
  return { versions: versions.rows, documents: documents.rows };
}

async function deleteOrphans(
  client: PoolClient,
  summary: CanvasRetentionSweepSummary,
  candidates: {
    versions: OrphanVersionCandidate[];
    documents: OrphanDocumentCandidate[];
  },
): Promise<void> {
  if (candidates.versions.length > 0) {
    const versionIds = candidates.versions.map((candidate) => candidate.id);
    const noteIds = candidates.versions.map((candidate) => candidate.notat_id);
    const deleted = await client.query(
      `DELETE FROM leadgrid_canvas_versjoner v
        USING unnest($1::uuid[], $2::uuid[]) AS candidate(id, notat_id)
        WHERE v.id = candidate.id
          AND v.notat_id = candidate.notat_id
          AND NOT EXISTS (
            SELECT 1 FROM leadgrid_canvas_notater n WHERE n.id = v.notat_id
          )`,
      [versionIds, noteIds],
    );
    summary.orphans.versionsDeleted = deleted.rowCount ?? 0;
  }

  if (candidates.documents.length > 0) {
    const documentIds = candidates.documents.map((candidate) => candidate.id);
    const noteIds = candidates.documents.map((candidate) => candidate.notat_id);
    const organizationIds = candidates.documents.map(
      (candidate) => candidate.organization_id,
    );
    const userIds = candidates.documents.map((candidate) => candidate.user_id);
    const deleted = await client.query(
      `DELETE FROM leadgrid_canvas_dokumenter d
        USING unnest($1::text[], $2::uuid[], $3::text[], $4::text[])
          AS candidate(id, notat_id, organization_id, user_id)
        WHERE d.id = candidate.id
          AND d.notat_id = candidate.notat_id
          AND d.organization_id = candidate.organization_id
          AND d.user_id = candidate.user_id
          AND NOT EXISTS (
            SELECT 1
              FROM leadgrid_canvas_notater n
             WHERE n.id = d.notat_id
               AND n.organization_id = d.organization_id
               AND n.user_id = d.user_id
          )`,
      [documentIds, noteIds, organizationIds, userIds],
    );
    summary.orphans.documentsDeleted = deleted.rowCount ?? 0;
  }
}

/**
 * Runs one bounded sweep. All candidate rows are rechecked in the DELETE and
 * all trash operations are anchored to the selected (note, org, user) tuple.
 * The transaction-scoped advisory lock prevents duplicate work across app
 * instances; SKIP LOCKED keeps the sweep from blocking active note traffic.
 */
export async function runCanvasRetentionSweep(
  pool: Pool,
  config: CanvasRetentionSweepConfig,
  trigger: CanvasRetentionTrigger = "manual",
): Promise<CanvasRetentionSweepSummary> {
  const startedMs = Date.now();
  // Guard applies at the execution boundary too, not only while reading env.
  // This prevents a future caller from bypassing the default-off and exact
  // destructive-confirmation contract by constructing a partial config.
  const mode: CanvasRetentionMode =
    config.enabled && config.mode === "apply" && config.destructiveConfirmed
      ? "apply"
      : "dry-run";
  const summary = createSummary(trigger, { ...config, mode });
  let client: PoolClient | null = null;
  let transactionOpen = false;

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '45s'");

    const lock = await client.query<{ locked: boolean } & QueryResultRow>(
      "SELECT pg_try_advisory_xact_lock($1::bigint) AS locked",
      [ADVISORY_LOCK_ID],
    );
    summary.lockAcquired = lock.rows[0]?.locked === true;
    if (!summary.lockAcquired) {
      await client.query("COMMIT");
      transactionOpen = false;
      return finishSummary(summary, startedMs, "skipped_locked");
    }

    const trash = await scanTrash(client, summary);
    if (mode === "apply") {
      await deleteTrash(client, summary, trash);
    }

    if (config.includeOrphans) {
      const orphans = await scanOrphans(client, summary);
      if (mode === "apply") {
        await deleteOrphans(client, summary, orphans);
      }
    }

    await client.query("COMMIT");
    transactionOpen = false;
    return finishSummary(summary, startedMs, "completed");
  } catch (error) {
    if (client && transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original failure; the pool will discard a broken client.
      }
    }
    return finishSummary(summary, startedMs, "failed", safeErrorMessage(error));
  } finally {
    client?.release();
  }
}
