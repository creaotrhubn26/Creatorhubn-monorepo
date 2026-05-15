/**
 * coverage-job-queue.ts
 *
 * pg-backed job queue for analyse-pipelinen. Worker poller med
 * FOR UPDATE SKIP LOCKED som gir parallell-safe claiming uten
 * Redis/SQS-avhengighet.
 *
 * Designvalg:
 *   - Worker er en singleton i prosessen som poller hver N sekunder
 *   - Visibility timeout: hvis en claim er eldre enn 600s, kan annen
 *     worker re-claime (anses som hung)
 *   - max_attempts: 3 — etter det går jobben til 'failed'
 *   - Exponential backoff på retry: not_before = NOW() + 2^attempt minutter
 *
 * Idempotens:
 *   - Hver job har én take_id. UPSERT er ikke nødvendig fordi analyse-
 *     pipelinen selv er idempotent (overskriver casting_take_analysis-rad)
 *   - Dobbel-enqueue: hvis to confirm-kall skjer parallelt, kan vi få 2
 *     pending jobs for samme take. Worker plukker første, andre kan
 *     re-prosessere (idempotent). Marginalt sløsing, ingen feil.
 */

import os from "os";
import type { Pool } from "pg";
import { runAnalysisForTake } from "./coverage-analysis-pipeline.js";

// ─────────────────────────────────────────────────────────────────────
// Worker-config
// ─────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = parseInt(process.env.COVERAGE_JOB_POLL_MS || "5000", 10);
const VISIBILITY_TIMEOUT_SEC = parseInt(process.env.COVERAGE_JOB_VISIBILITY_TIMEOUT_SEC || "600", 10);
const MAX_CONCURRENT = parseInt(process.env.COVERAGE_JOB_CONCURRENCY || "2", 10);
const WORKER_ID = `${os.hostname()}-${process.pid}`;

// ─────────────────────────────────────────────────────────────────────
// Claim + complete
// ─────────────────────────────────────────────────────────────────────

interface ClaimedJob {
  jobId: string;
  takeId: string;
  projectId: string;
  attempts: number;
}

/**
 * Claim én ledig job atomisk. Returnerer null hvis ingen er klare.
 *
 * SQL-strategi:
 *   FOR UPDATE SKIP LOCKED → parallell-workers tar ikke samme rad
 *   Krav: status='pending' OG not_before <= NOW()
 *   ELLER status='claimed' OG claimed_at < NOW() - visibility_timeout
 *     (gjenoppta hung claim)
 */
export async function claimNextJob(pool: Pool): Promise<ClaimedJob | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string;
      take_id: string;
      project_id: string;
      attempts: number;
    }>(
      `SELECT id, take_id, project_id, attempts
       FROM casting_analysis_jobs
       WHERE (
         (status = 'pending' AND not_before <= NOW())
         OR (status = 'claimed' AND claimed_at < NOW() - make_interval(secs => visibility_timeout_sec))
       )
       ORDER BY priority DESC, created_at
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
    );
    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    const row = result.rows[0];
    await client.query(
      `UPDATE casting_analysis_jobs
       SET status = 'claimed',
           claimed_by = $1,
           claimed_at = NOW(),
           attempts = attempts + 1,
           updated_at = NOW()
       WHERE id = $2`,
      [WORKER_ID, row.id],
    );
    // Speil til casting_takes så listings ser status
    await client.query(
      `UPDATE casting_takes
       SET processing_status = 'processing', updated_at = NOW()
       WHERE id = $1`,
      [row.take_id],
    );
    await client.query("COMMIT");
    return {
      jobId: row.id,
      takeId: row.take_id,
      projectId: row.project_id,
      attempts: row.attempts + 1,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function markJobDone(pool: Pool, jobId: string): Promise<void> {
  await pool.query(
    `UPDATE casting_analysis_jobs
     SET status = 'done', completed_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [jobId],
  );
}

async function markJobFailed(
  pool: Pool,
  jobId: string,
  errorMessage: string,
  errorStage: string | undefined,
): Promise<void> {
  // Sjekk om vi har attempts igjen
  const r = await pool.query<{ attempts: number; max_attempts: number }>(
    `SELECT attempts, max_attempts FROM casting_analysis_jobs WHERE id = $1`,
    [jobId],
  );
  if (r.rows.length === 0) return;
  const { attempts, max_attempts } = r.rows[0];
  const hasMoreAttempts = attempts < max_attempts;

  if (hasMoreAttempts) {
    // Retry med exponential backoff
    const backoffMinutes = Math.pow(2, attempts);
    await pool.query(
      `UPDATE casting_analysis_jobs
       SET status = 'pending',
           not_before = NOW() + make_interval(mins => $2),
           error_message = $3,
           error_stage = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [jobId, backoffMinutes, errorMessage.slice(0, 1000), errorStage ?? null],
    );
  } else {
    // Endelig fail
    await pool.query(
      `UPDATE casting_analysis_jobs
       SET status = 'failed',
           completed_at = NOW(),
           error_message = $2,
           error_stage = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [jobId, errorMessage.slice(0, 1000), errorStage ?? null],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────────────

export interface CoverageJobWorker {
  start(): void;
  stop(): Promise<void>;
  /** Trigger en immediate poll-tick — for testing eller priority-bypass */
  triggerPoll(): Promise<void>;
}

export function createCoverageJobWorker(pool: Pool): CoverageJobWorker {
  let running = false;
  let pollTimer: NodeJS.Timeout | null = null;
  const inFlight = new Set<string>();

  async function processOneJob(): Promise<void> {
    if (inFlight.size >= MAX_CONCURRENT) return;

    const job = await claimNextJob(pool);
    if (!job) return;

    inFlight.add(job.jobId);
    void (async () => {
      try {
        const result = await runAnalysisForTake(pool, job.takeId);
        if (result.ok) {
          await markJobDone(pool, job.jobId);
          console.log(
            `[coverage-worker] ✓ job=${job.jobId} take=${job.takeId} ` +
            `attempt=${job.attempts} score=${result.compositeScore?.overall?.toFixed(2) ?? "n/a"}`,
          );
        } else {
          await markJobFailed(
            pool,
            job.jobId,
            result.errorMessage ?? "ukjent feil",
            result.errorStage,
          );
          console.warn(
            `[coverage-worker] ✗ job=${job.jobId} take=${job.takeId} ` +
            `attempt=${job.attempts} stage=${result.errorStage} err=${result.errorMessage}`,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await markJobFailed(pool, job.jobId, message, "worker").catch(() => {});
        console.error(`[coverage-worker] unhandled exception job=${job.jobId}:`, err);
      } finally {
        inFlight.delete(job.jobId);
      }
    })();
  }

  async function poll(): Promise<void> {
    if (!running) return;
    try {
      // Plukk så mange jobs som mulig opp til concurrency-grense
      while (inFlight.size < MAX_CONCURRENT) {
        const before = inFlight.size;
        await processOneJob();
        if (inFlight.size === before) break; // ingen mer å plukke
      }
    } catch (err) {
      console.error("[coverage-worker] poll error:", err);
    } finally {
      if (running) {
        pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      console.log(`[coverage-worker] starting (concurrency=${MAX_CONCURRENT}, poll=${POLL_INTERVAL_MS}ms)`);
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    },

    async stop() {
      running = false;
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      // Vent på in-flight jobs (best effort, opp til 30s)
      const deadline = Date.now() + 30_000;
      while (inFlight.size > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 200));
      }
      console.log(`[coverage-worker] stopped (${inFlight.size} jobs still in-flight)`);
    },

    async triggerPoll() {
      if (running) await poll();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Enqueue-helper for andre tjenester
// ─────────────────────────────────────────────────────────────────────

export async function enqueueAnalysisJob(
  pool: Pool,
  takeId: string,
  projectId: string,
  priority = 0,
): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO casting_analysis_jobs
       (take_id, project_id, priority, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'pending', NOW(), NOW())
     RETURNING id`,
    [takeId, projectId, priority],
  );
  return r.rows[0].id;
}
