import type { Pool } from "pg";
import {
  advanceBatch,
  reconcileOrphanedUploads,
} from "./drive-batch-upload-service.js";
import {
  DriveNotConnectedError,
  driveUploaderCanRun,
  makePerBatchDriveUploader,
  type DriveClientResolver,
} from "./drive-batch-upload-wiring.js";

/**
 * Periodic worker that drains in-progress Drive batches. Runs
 * continuously from server boot. One tick:
 *
 *   1. Read every batch in ``queued`` or ``running`` state.
 *   2. For each, resolve the owner's Drive client + wrap it in a
 *      per-batch ``DriveUploader`` (one client refresh per batch,
 *      not per file).
 *   3. Call ``advanceBatch`` once. The orchestrator already caps
 *      per-tick work via ``globalConcurrency`` so a single tick
 *      can't lock up the worker.
 *
 * Batches with a dangling connection (user revoked Google access,
 * env vars missing, …) get their status flipped to ``failed`` so
 * the UI can surface a reconnection prompt. The items stay
 * recoverable — requeue them once the connection is restored.
 *
 * Pure-ish policy helpers live here too so tests can pin the
 * scheduling behaviour without spinning a worker loop.
 */

export interface DriveBatchWorkerHandle {
  stop: () => void;
}

export interface DriveBatchWorkerOptions {
  intervalMs?: number;
  /// Caller-injectable clock; defaults to real ``Date.now``. Used
  /// only by unit tests.
  now?: () => Date;
  /// Ceiling on how many batches to touch per tick; prevents the
  /// worker from starving other Node timers when 200 batches go
  /// live at once.
  maxBatchesPerTick?: number;
}

export const DRIVE_BATCH_WORKER_DEFAULTS = {
  intervalMs: 5_000,
  maxBatchesPerTick: 8,
} as const;

/**
 * Start the worker loop. Returns a handle so callers can stop it
 * during graceful shutdown.
 */
export function startDriveBatchWorker(
  pool: Pool,
  resolver: DriveClientResolver,
  options: DriveBatchWorkerOptions = {},
): DriveBatchWorkerHandle {
  const { intervalMs, maxBatchesPerTick } = {
    ...DRIVE_BATCH_WORKER_DEFAULTS,
    ...options,
  };
  const guard = driveUploaderCanRun();
  if (!guard.ok) {
    console.warn(
      "[drive-batch] worker disabled — missing env:",
      guard.missing.join(", "),
    );
    return { stop: () => {} };
  }

  let running = true;
  let draining = false;
  // Kick off a startup reconciliation so crashed-mid-upload rows
  // recover before the first real tick. Swallows errors — a flaky
  // DB at boot shouldn't stop the worker from ever ticking.
  void reconcileOrphanedUploads(pool).catch((err) => {
    console.warn("[drive-batch] reconcile on boot failed", err);
  });

  const timer: NodeJS.Timeout = setInterval(async () => {
    if (!running || draining) return;
    draining = true;
    try {
      await drainOnce({ pool, resolver, maxBatchesPerTick });
    } catch (err) {
      console.warn("[drive-batch] tick failed", err);
    } finally {
      draining = false;
    }
  }, intervalMs);
  // Don't hold the Node process open just for this worker —
  // ``.unref`` so shutdown is clean even if ``stop()`` is missed.
  if (typeof timer.unref === "function") timer.unref();

  return {
    stop: () => {
      running = false;
      clearInterval(timer);
    },
  };
}

/**
 * One sweep of in-progress batches. Exposed for tests and for
 * manual triggering via an admin route.
 */
export async function drainOnce(params: {
  pool: Pool;
  resolver: DriveClientResolver;
  maxBatchesPerTick: number;
}): Promise<{ batchesVisited: number; itemsTransitioned: number }> {
  const { pool, resolver, maxBatchesPerTick } = params;
  const activeBatches = await pool.query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM drive_upload_batch
     WHERE status IN ('queued', 'running')
     ORDER BY created_at ASC
     LIMIT $1`,
    [maxBatchesPerTick],
  );
  let itemsTransitioned = 0;
  for (const batch of activeBatches.rows) {
    try {
      const uploader = await makePerBatchDriveUploader(resolver, batch.user_id);
      const result = await advanceBatch({
        pool,
        uploader,
        batchId: batch.id,
      });
      itemsTransitioned += result.transitions;
    } catch (err) {
      if (err instanceof DriveNotConnectedError) {
        // Photographer disconnected Google. Mark the batch as
        // failed with a diagnostic so the UI can prompt reconnect.
        await pool.query(
          `UPDATE drive_upload_batch
           SET status = 'failed', updated_at = NOW(), completed_at = NOW()
           WHERE id = $1 AND completed_at IS NULL`,
          [batch.id],
        );
        await pool.query(
          `UPDATE drive_upload_item
           SET state = 'failed', last_error = 'Google-tilkobling frakoblet', updated_at = NOW()
           WHERE batch_id = $1 AND state IN ('pending', 'uploading')`,
          [batch.id],
        );
        continue;
      }
      console.warn(
        `[drive-batch] batch ${batch.id} failed to advance`,
        err,
      );
    }
  }
  return {
    batchesVisited: activeBatches.rowCount ?? 0,
    itemsTransitioned,
  };
}
