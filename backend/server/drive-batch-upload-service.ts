import type { Pool } from "pg";
import crypto from "node:crypto";
import {
  aggregateBatchProgress,
  backoffSeconds,
  classifyUploadOutcome,
  dedupeByFolderAndChecksum,
  pickNextItems,
} from "./drive-batch-planning.js";
import type {
  BatchProgress,
  DriveBatchItem,
  DriveBatchItemState,
  UploadOutcome,
} from "./drive-batch-planning.js";

/**
 * Orchestration + persistence for Drive batch uploads. Composes the
 * pure helpers in ``drive-batch-planning.ts`` with two DB tables:
 *
 *   * ``drive_upload_batch``  — one row per user-initiated batch.
 *   * ``drive_upload_item``   — one row per file inside a batch.
 *
 * The orchestrator is intentionally small + stateless. Each
 * ``advanceBatch`` call reads the current roster, picks up to
 * ``globalConcurrency`` items, asks the injected ``DriveUploader``
 * to upload them, classifies the outcome, and writes the new state
 * back. Callers run it in a loop (or on a cron, or from a
 * request handler) until the batch reaches ``isComplete``.
 *
 * Resumability: because every state transition goes through the DB,
 * a crash/restart mid-batch picks up where it left off. Items in
 * ``uploading`` on boot are treated as ``pending`` via a startup
 * reconciliation pass.
 *
 * Tests inject a fake ``DriveUploader`` so the orchestrator can be
 * exercised without hitting Google's API. Production wiring sits
 * in ``drive-batch-upload-wiring.ts`` (follow-up, not landed yet)
 * and builds a real uploader backed by ``googleapis``.
 */

export interface DriveBatchCreateInput {
  userId: string;
  projectId: string | null;
  items: readonly Omit<DriveBatchItem, never>[];
}

export interface BatchSnapshot {
  batchId: string;
  userId: string;
  projectId: string | null;
  status: BatchStatus;
  items: DriveBatchItemRow[];
  progress: BatchProgress;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface DriveBatchItemRow extends DriveBatchItem {
  state: DriveBatchItemState;
  attemptCount: number;
  lastError: string | null;
  driveFileId: string | null;
  nextAttemptAt: Date | null;
}

export type BatchStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

/// Abstraction over the real Drive upload. Tests inject a fake;
/// production wires ``googleapis.drive.files.create`` under the hood.
export interface DriveUploader {
  upload(item: DriveBatchItem): Promise<{
    response?: { statusCode?: number; data?: { id?: string } };
    error?: { code?: number; message?: string };
  }>;
}

export const DRIVE_BATCH_DEFAULT_CONCURRENCY = {
  global: 4,
  perFolder: 2,
  maxAttempts: 5,
} as const;

export async function ensureDriveBatchSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drive_upload_batch (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      project_id VARCHAR(255),
      status VARCHAR(32) NOT NULL DEFAULT 'queued',
      total_items INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS drive_upload_batch_user_idx
      ON drive_upload_batch (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS drive_upload_item (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID NOT NULL REFERENCES drive_upload_batch(id) ON DELETE CASCADE,
      local_id VARCHAR(255) NOT NULL,
      local_path VARCHAR(1024) NOT NULL,
      drive_name VARCHAR(512) NOT NULL,
      target_folder_id VARCHAR(255) NOT NULL,
      mime_type VARCHAR(128) NOT NULL,
      size_bytes BIGINT NOT NULL,
      checksum_sha256 VARCHAR(128) NOT NULL,
      state VARCHAR(32) NOT NULL DEFAULT 'pending',
      drive_file_id VARCHAR(255),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      next_attempt_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS drive_upload_item_batch_state_idx
      ON drive_upload_item (batch_id, state);
  `);
}

/**
 * Create a batch + seed its items. Dedupes up front so the batch's
 * ``totalItems`` is the honest post-dedup count the UI should show
 * ("upload 147 new files" rather than "upload 200 files, 53 of
 * which Drive already has").
 */
export async function createBatch(
  pool: Pool,
  input: DriveBatchCreateInput,
): Promise<{ batchId: string; dedupedCount: number; duplicateLocalIds: string[] }> {
  await ensureDriveBatchSchema(pool);
  const { unique, duplicateLocalIds } = dedupeByFolderAndChecksum(
    input.items as DriveBatchItem[],
  );
  const batchId = crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO drive_upload_batch (id, user_id, project_id, status, total_items)
       VALUES ($1, $2, $3, 'queued', $4)`,
      [batchId, input.userId, input.projectId, unique.length],
    );
    for (const item of unique) {
      await client.query(
        `INSERT INTO drive_upload_item
           (batch_id, local_id, local_path, drive_name, target_folder_id,
            mime_type, size_bytes, checksum_sha256, state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
        [
          batchId,
          item.localId,
          item.localPath,
          item.driveName,
          item.targetFolderId,
          item.mimeType,
          item.sizeBytes,
          item.checksumSha256,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return {
    batchId,
    dedupedCount: unique.length,
    duplicateLocalIds,
  };
}

/**
 * Load batch + items + derived progress.
 */
export async function fetchBatch(
  pool: Pool,
  userId: string,
  batchId: string,
): Promise<BatchSnapshot | null> {
  await ensureDriveBatchSchema(pool);
  const batchRow = await pool.query(
    `SELECT id, user_id, project_id, status, created_at, updated_at, completed_at
     FROM drive_upload_batch WHERE id = $1 AND user_id = $2`,
    [batchId, userId],
  );
  if (batchRow.rowCount === 0) return null;
  const itemRows = await pool.query(
    `SELECT id, batch_id, local_id, local_path, drive_name, target_folder_id,
            mime_type, size_bytes, checksum_sha256, state, drive_file_id,
            attempt_count, last_error, next_attempt_at
     FROM drive_upload_item
     WHERE batch_id = $1
     ORDER BY created_at ASC, id ASC`,
    [batchId],
  );
  const items: DriveBatchItemRow[] = itemRows.rows.map(mapItemRow);
  const b = batchRow.rows[0];
  return {
    batchId: b.id,
    userId: b.user_id,
    projectId: b.project_id,
    status: b.status,
    items,
    progress: aggregateBatchProgress(
      items.map((item) => ({ state: item.state, sizeBytes: item.sizeBytes })),
    ),
    createdAt: toIso(b.created_at),
    updatedAt: toIso(b.updated_at),
    completedAt: b.completed_at ? toIso(b.completed_at) : null,
  };
}

/**
 * Drive one step of the batch: read the current roster, pick the
 * next slice of pending items, attempt each via the injected
 * ``DriveUploader``, and persist the new state. Returns how many
 * items transitioned — callers loop while this is > 0 (or until
 * the batch is complete).
 *
 * ``now`` is injectable so tests don't wait real wall-clock seconds
 * for the backoff delay to elapse.
 */
export async function advanceBatch(params: {
  pool: Pool;
  uploader: DriveUploader;
  batchId: string;
  now?: () => Date;
  globalConcurrency?: number;
  perFolderConcurrency?: number;
  maxAttempts?: number;
}): Promise<{ transitions: number; isComplete: boolean }> {
  const {
    pool,
    uploader,
    batchId,
    now = () => new Date(),
    globalConcurrency = DRIVE_BATCH_DEFAULT_CONCURRENCY.global,
    perFolderConcurrency = DRIVE_BATCH_DEFAULT_CONCURRENCY.perFolder,
    maxAttempts = DRIVE_BATCH_DEFAULT_CONCURRENCY.maxAttempts,
  } = params;
  await ensureDriveBatchSchema(pool);

  const itemRows = await pool.query(
    `SELECT id, batch_id, local_id, local_path, drive_name, target_folder_id,
            mime_type, size_bytes, checksum_sha256, state, drive_file_id,
            attempt_count, last_error, next_attempt_at
     FROM drive_upload_item
     WHERE batch_id = $1
     ORDER BY created_at ASC, id ASC`,
    [batchId],
  );
  const allItems = itemRows.rows.map(mapItemRow);
  const currentTime = now();

  const pendingReady = allItems.filter(
    (item) =>
      item.state === "pending" &&
      (item.nextAttemptAt === null || item.nextAttemptAt <= currentTime),
  );
  const uploading = allItems.filter((item) => item.state === "uploading");
  const toStart = pickNextItems({
    pending: pendingReady,
    inFlight: uploading,
    globalConcurrency,
    perFolderConcurrency,
  });

  if (toStart.length === 0) {
    // Nothing to do this tick — either the batch is finished or it's
    // waiting on backoff.
    const progress = aggregateBatchProgress(
      allItems.map((item) => ({ state: item.state, sizeBytes: item.sizeBytes })),
    );
    if (progress.isComplete) {
      await markBatchTerminalFromProgress(
        pool,
        batchId,
        allItems.map((item) => ({ state: item.state })),
      );
    }
    return { transitions: 0, isComplete: progress.isComplete };
  }

  // Transition picked rows to ``uploading`` so a concurrent call
  // doesn't double-pick them. The filter by current state guards
  // against the (rare) race where another advance started first.
  for (const item of toStart) {
    await pool.query(
      `UPDATE drive_upload_item
       SET state = 'uploading', updated_at = $1
       WHERE batch_id = $2 AND local_id = $3 AND state = 'pending'`,
      [currentTime, batchId, item.localId],
    );
  }
  await pool.query(
    `UPDATE drive_upload_batch
     SET status = 'running', updated_at = $1
     WHERE id = $2 AND status = 'queued'`,
    [currentTime, batchId],
  );

  // Perform uploads in parallel. Each call classifies its own
  // outcome + writes back to the DB, so a failure in one doesn't
  // disturb the others.
  let transitions = 0;
  await Promise.all(
    toStart.map(async (item) => {
      try {
        const raw = await uploader.upload(item);
        const outcome = classifyUploadOutcome(raw);
        await applyOutcome({
          pool,
          batchId,
          item,
          outcome,
          now: currentTime,
          maxAttempts,
        });
        transitions += 1;
      } catch (err) {
        // Threw synchronously (network error the uploader didn't
        // convert). Treat as retryable so the orchestrator
        // backoff path drives the next attempt.
        const message = err instanceof Error ? err.message : String(err);
        await applyOutcome({
          pool,
          batchId,
          item,
          outcome: { kind: "retryable", reason: message },
          now: currentTime,
          maxAttempts,
        });
        transitions += 1;
      }
    }),
  );

  const refreshed = await pool.query(
    `SELECT state, size_bytes FROM drive_upload_item WHERE batch_id = $1`,
    [batchId],
  );
  const refreshedRows: { state: DriveBatchItemState; sizeBytes: number }[] =
    refreshed.rows.map((row: { state: string; size_bytes: string | number }) => ({
      state: row.state as DriveBatchItemState,
      sizeBytes: Number(row.size_bytes) || 0,
    }));
  const progress = aggregateBatchProgress(refreshedRows);
  if (progress.isComplete) {
    // Pass the fresh post-update rows — if we used ``allItems``
    // (captured pre-update), we'd read stale "pending" states and
    // incorrectly mark a batch with every row now "failed" as
    // "completed".
    await markBatchTerminalFromProgress(pool, batchId, refreshedRows);
  } else {
    await pool.query(
      `UPDATE drive_upload_batch SET updated_at = $1 WHERE id = $2`,
      [currentTime, batchId],
    );
  }
  return { transitions, isComplete: progress.isComplete };
}

// MARK: - Internals

async function applyOutcome(params: {
  pool: Pool;
  batchId: string;
  item: DriveBatchItemRow;
  outcome: UploadOutcome;
  now: Date;
  maxAttempts: number;
}): Promise<void> {
  const { pool, batchId, item, outcome, now, maxAttempts } = params;
  const nextAttempt = item.attemptCount + 1;
  switch (outcome.kind) {
    case "succeeded":
      await pool.query(
        `UPDATE drive_upload_item
         SET state = 'uploaded', drive_file_id = $1,
             attempt_count = $2, last_error = NULL, updated_at = $3
         WHERE batch_id = $4 AND local_id = $5`,
        [outcome.driveFileId, nextAttempt, now, batchId, item.localId],
      );
      return;
    case "duplicate":
      await pool.query(
        `UPDATE drive_upload_item
         SET state = 'skipped-duplicate', drive_file_id = $1,
             attempt_count = $2, last_error = NULL, updated_at = $3
         WHERE batch_id = $4 AND local_id = $5`,
        [outcome.driveFileId || null, nextAttempt, now, batchId, item.localId],
      );
      return;
    case "permanent":
      await pool.query(
        `UPDATE drive_upload_item
         SET state = 'failed', attempt_count = $1,
             last_error = $2, updated_at = $3
         WHERE batch_id = $4 AND local_id = $5`,
        [nextAttempt, outcome.reason, now, batchId, item.localId],
      );
      return;
    case "retryable":
      if (nextAttempt >= maxAttempts) {
        await pool.query(
          `UPDATE drive_upload_item
           SET state = 'failed', attempt_count = $1,
               last_error = $2, updated_at = $3
           WHERE batch_id = $4 AND local_id = $5`,
          [nextAttempt, `max-attempts: ${outcome.reason}`, now, batchId, item.localId],
        );
        return;
      }
      {
        const delaySec = backoffSeconds(nextAttempt);
        const nextAt = new Date(now.getTime() + delaySec * 1000);
        await pool.query(
          `UPDATE drive_upload_item
           SET state = 'pending', attempt_count = $1,
               last_error = $2, next_attempt_at = $3, updated_at = $4
           WHERE batch_id = $5 AND local_id = $6`,
          [nextAttempt, outcome.reason, nextAt, now, batchId, item.localId],
        );
      }
      return;
  }
}

async function markBatchTerminalFromProgress(
  pool: Pool,
  batchId: string,
  items: readonly { state: DriveBatchItemState }[],
): Promise<void> {
  const hasFailures = items.some((item) => item.state === "failed");
  const status: BatchStatus = hasFailures ? "failed" : "completed";
  await pool.query(
    `UPDATE drive_upload_batch
     SET status = $1, updated_at = NOW(), completed_at = NOW()
     WHERE id = $2 AND completed_at IS NULL`,
    [status, batchId],
  );
}

/// Reconcile ``uploading`` rows left behind by a crash/restart.
/// Flips them back to ``pending`` so the next ``advanceBatch`` tick
/// picks them up. Safe to call repeatedly.
export async function reconcileOrphanedUploads(pool: Pool): Promise<number> {
  await ensureDriveBatchSchema(pool);
  const result = await pool.query(
    `UPDATE drive_upload_item
     SET state = 'pending', updated_at = NOW()
     WHERE state = 'uploading'
     RETURNING 1`,
  );
  return result.rowCount ?? 0;
}

function mapItemRow(row: {
  id: string;
  batch_id: string;
  local_id: string;
  local_path: string;
  drive_name: string;
  target_folder_id: string;
  mime_type: string;
  size_bytes: string | number;
  checksum_sha256: string;
  state: string;
  drive_file_id: string | null;
  attempt_count: number;
  last_error: string | null;
  next_attempt_at: Date | null;
}): DriveBatchItemRow {
  return {
    localId: row.local_id,
    localPath: row.local_path,
    driveName: row.drive_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes) || 0,
    checksumSha256: row.checksum_sha256,
    targetFolderId: row.target_folder_id,
    state: row.state as DriveBatchItemState,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    driveFileId: row.drive_file_id,
    nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at) : null,
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
