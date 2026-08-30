import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { pollStoryboardVideo } from './storyboard-ai-video-service.js';
import { tickStoryboardImageBillingSettlements } from './storyboard-ai-image-billing-worker.js';
import {
  tickLegacyGenerativeAiBillingSettlements,
  tickStoryboardVideoArchiveWorker,
  tickStoryboardVideoBillingSettlements,
} from './storyboard-ai-video-durability.js';

const DEFAULT_INTERVAL_MS = 2_000;
const DEFAULT_BATCH_SIZE = 8;
const DEFAULT_LEASE_SECONDS = 60;
const RETRY_DELAY_SECONDS = 10;
const MAX_ERROR_LENGTH = 1_000;
export const LEGACY_AI_BILLING_SWEEP_INTERVAL_MS = 60_000;
export const IMAGE_AI_BILLING_SWEEP_INTERVAL_MS = 30_000;
// Higgsfield submit is asynchronous and should return a request handle quickly.
// Two minutes gives transient network latency room while still recovering a
// process that died immediately after crossing the non-idempotent POST boundary.
export const STORYBOARD_AI_VIDEO_SUBMIT_GRACE_SECONDS = 2 * 60;
const HIGGSFIELD_UUID_SQL =
  '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
const HIGGSFIELD_STATUS_URL_SQL =
  '^https://api[.]higgsfield[.]ai/requests/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/status$';

interface ClaimedStoryboardVideoJob {
  id: string;
  project_id: string;
  storyboard_id: string;
}

type StoryboardVideoPoller = (
  pool: Pool,
  input: { projectId: string; storyboardId: string; jobId: string },
) => Promise<unknown>;

export interface StoryboardAiVideoReconcilerTickOptions {
  workerId?: string;
  batchSize?: number;
  leaseSeconds?: number;
  poll?: StoryboardVideoPoller;
}

export interface StoryboardAiVideoReconcilerStats {
  claimed: number;
  polled: number;
  failed: number;
  leaseReleaseFailed: number;
}

export interface StoryboardAiVideoReconcilerHandle {
  stop: () => void;
}

export interface StoryboardAiVideoReconcilerStartOptions
  extends StoryboardAiVideoReconcilerTickOptions {
  intervalMs?: number;
  initialDelayMs?: number;
  billingTick?: typeof tickStoryboardVideoBillingSettlements;
  archiveTick?: typeof tickStoryboardVideoArchiveWorker;
  legacyBillingTick?: typeof tickLegacyGenerativeAiBillingSettlements;
  imageBillingTick?: typeof tickStoryboardImageBillingSettlements;
}

export interface StoryboardAiVideoLifecycleNormalizationStats {
  providerIdsBound: number;
  statusUrlsNormalized: number;
  activeRowsNormalized: number;
  completedRowsNormalized: number;
}

export type StoryboardAiVideoSubmittingNormalizationDecision =
  | 'defer'
  | 'normalize_accepted'
  | 'park_orphan';

/** Pure mirror of the SQL CAS policy, exported so its race boundary is pinned. */
export function storyboardAiVideoSubmittingNormalizationDecision(input: {
  hasVerifiedProviderHandle: boolean;
  submitStartedAt: Date | null;
  updatedAt: Date | null;
  createdAt: Date;
  now?: Date;
}): StoryboardAiVideoSubmittingNormalizationDecision {
  if (input.hasVerifiedProviderHandle) return 'normalize_accepted';
  const startedAt = input.submitStartedAt ?? input.updatedAt ?? input.createdAt;
  const now = input.now ?? new Date();
  if (!Number.isFinite(startedAt.getTime()) || !Number.isFinite(now.getTime())) {
    return 'defer';
  }
  return now.getTime() - startedAt.getTime()
    >= STORYBOARD_AI_VIDEO_SUBMIT_GRACE_SECONDS * 1_000
    ? 'park_orphan'
    : 'defer';
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value as number)));
}

function pollErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ERROR_LENGTH) || 'storyboard_video_poll_failed';
}

/**
 * Close the rolling-deploy gap where an older server instance writes only the
 * legacy fal_request_id/response_url columns after migration 0474 has run.
 *
 * Every update is idempotent. Prepared rows are deliberately excluded: that
 * state means no generation POST has been claimed yet and the normal submit
 * path must remain able to continue it.
 */
export async function normalizeStoryboardAiVideoLifecycle(
  pool: Pool,
): Promise<StoryboardAiVideoLifecycleNormalizationStats> {
  const ids = await pool.query(
    `/* storyboard-ai-video-normalize:provider-id */
     UPDATE storyboard_ai_video_jobs AS jobs
        SET provider_request_id = LOWER(jobs.fal_request_id),
            updated_at = NOW()
      WHERE jobs.provider = 'higgsfield'
        AND jobs.status <> 'prepared'
        AND jobs.provider_request_id IS NULL
        AND jobs.fal_request_id ~* $1
        AND NOT EXISTS (
          SELECT 1
            FROM storyboard_ai_video_jobs AS duplicate
           WHERE duplicate.id <> jobs.id
             AND duplicate.provider = 'higgsfield'
             AND (
               LOWER(duplicate.provider_request_id) = LOWER(jobs.fal_request_id)
               OR (
                 duplicate.provider_request_id IS NULL
                 AND duplicate.fal_request_id ~* $1
                 AND LOWER(duplicate.fal_request_id) = LOWER(jobs.fal_request_id)
               )
             )
        )`,
    [HIGGSFIELD_UUID_SQL],
  );

  const urls = await pool.query(
    `/* storyboard-ai-video-normalize:status-url */
     WITH normalized_urls AS (
       SELECT jobs.id,
              CASE
                WHEN jobs.provider_request_id ~ $1
                 AND jobs.provider_status_url ~ $2
                 AND LOWER(jobs.provider_status_url) =
                     'https://api.higgsfield.ai/requests/'
                     || jobs.provider_request_id || '/status'
                THEN jobs.provider_status_url
                WHEN jobs.provider_request_id ~ $1
                 AND jobs.response_url ~ $2
                 AND LOWER(jobs.response_url) =
                     'https://api.higgsfield.ai/requests/'
                     || jobs.provider_request_id || '/status'
                THEN jobs.response_url
                ELSE NULL
              END AS normalized_url
         FROM storyboard_ai_video_jobs AS jobs
        WHERE jobs.provider = 'higgsfield'
          AND jobs.status <> 'prepared'
     )
     UPDATE storyboard_ai_video_jobs AS jobs
        SET provider_status_url = normalized.normalized_url,
            next_poll_at = CASE
              WHEN normalized.normalized_url IS NULL THEN NULL
              ELSE jobs.next_poll_at
            END,
            updated_at = NOW()
       FROM normalized_urls AS normalized
      WHERE jobs.id = normalized.id
        AND jobs.provider_status_url IS DISTINCT FROM normalized.normalized_url`,
    [HIGGSFIELD_UUID_SQL, HIGGSFIELD_STATUS_URL_SQL],
  );

  const active = await pool.query(
    `/* storyboard-ai-video-normalize:active */
     UPDATE storyboard_ai_video_jobs AS jobs
        SET provider_status = CASE
              WHEN jobs.provider_request_id IS NULL THEN NULL
              WHEN jobs.provider_status IS NOT NULL THEN jobs.provider_status
              WHEN jobs.status IN ('running', 'processing') THEN 'in_progress'
              ELSE 'queued'
            END,
            provider_status_updated_at = CASE
              WHEN jobs.provider_request_id IS NULL
              THEN jobs.provider_status_updated_at
              ELSE COALESCE(jobs.provider_status_updated_at, NOW())
            END,
            status = CASE
              WHEN jobs.provider_request_id IS NULL
                THEN 'submission_unknown'
              WHEN jobs.provider_status_url IS NULL
                THEN 'accepted_contract_unknown'
              WHEN COALESCE(
                jobs.provider_status,
                CASE WHEN jobs.status IN ('running', 'processing')
                  THEN 'in_progress' ELSE 'queued' END
              ) NOT IN ('queued', 'in_progress')
                THEN 'accepted_contract_unknown'
              WHEN jobs.status = 'submitting'
                AND COALESCE(jobs.provider_status, 'queued') = 'in_progress'
                THEN 'running'
              WHEN jobs.status = 'submitting' THEN 'queued'
              ELSE jobs.status
            END,
            next_poll_at = CASE
              WHEN jobs.provider_request_id IS NOT NULL
               AND jobs.provider_status_url IS NOT NULL
               AND COALESCE(
                 jobs.provider_status,
                 CASE WHEN jobs.status IN ('running', 'processing')
                   THEN 'in_progress' ELSE 'queued' END
               ) IN ('queued', 'in_progress')
              THEN COALESCE(jobs.next_poll_at, NOW())
              ELSE NULL
            END,
            error = CASE
              WHEN jobs.provider_request_id IS NULL
                THEN COALESCE(jobs.error, 'higgsfield_provider_request_unknown')
              WHEN jobs.provider_status_url IS NULL
                THEN COALESCE(
                  jobs.error,
                  'higgsfield_status_url_missing_or_invalid'
                )
              WHEN jobs.provider_status NOT IN ('queued', 'in_progress')
                THEN COALESCE(
                  jobs.error,
                  'higgsfield_provider_status_not_pollable'
                )
              ELSE jobs.error
            END,
            updated_at = NOW()
      WHERE jobs.provider = 'higgsfield'
        AND jobs.status IN ('submitting', 'queued', 'running', 'processing')
        AND (
          jobs.status <> 'submitting'
          OR (
            jobs.provider_request_id IS NOT NULL
            AND jobs.provider_status_url IS NOT NULL
          )
          OR COALESCE(
            jobs.submit_started_at,
            jobs.updated_at,
            jobs.created_at
          ) <= NOW() - make_interval(secs => $1::int)
        )
        AND (
          jobs.provider_request_id IS NULL
          OR jobs.provider_status_url IS NULL
          OR jobs.provider_status IS NULL
          OR jobs.next_poll_at IS NULL
          OR jobs.status = 'submitting'
          OR jobs.provider_status NOT IN ('queued', 'in_progress')
    )`,
    [STORYBOARD_AI_VIDEO_SUBMIT_GRACE_SECONDS],
  );

  const completed = await pool.query(
    `/* storyboard-ai-video-normalize:completed */
     UPDATE storyboard_ai_video_jobs AS jobs
        SET provider_status = 'completed',
            provider_status_updated_at = COALESCE(
              jobs.provider_status_updated_at,
              jobs.completed_at,
              NOW()
            ),
            provider_terminal_at = COALESCE(
              jobs.provider_terminal_at,
              jobs.completed_at,
              NOW()
            ),
            next_poll_at = NULL,
            archive_status = CASE
              WHEN jobs.output_b2_key IS NOT NULL THEN 'archived'
              WHEN jobs.archive_status = 'not_ready' THEN 'pending'
              ELSE jobs.archive_status
            END,
            archive_next_attempt_at = CASE
              WHEN jobs.output_b2_key IS NOT NULL THEN NULL
              ELSE COALESCE(jobs.archive_next_attempt_at, NOW())
            END,
            archive_deadline_at = CASE
              WHEN jobs.output_b2_key IS NOT NULL THEN NULL
              ELSE COALESCE(
                jobs.archive_deadline_at,
                COALESCE(
                  jobs.completed_at,
                  jobs.updated_at,
                  jobs.created_at,
                  NOW()
                ) + INTERVAL '6 days'
              )
            END,
            archive_error = CASE
              WHEN jobs.output_b2_key IS NOT NULL THEN NULL
              ELSE jobs.archive_error
            END,
            archived_at = CASE
              WHEN jobs.output_b2_key IS NOT NULL
              THEN COALESCE(
                jobs.archived_at,
                jobs.completed_at,
                jobs.updated_at,
                jobs.created_at,
                NOW()
              )
              ELSE jobs.archived_at
            END,
            updated_at = NOW()
      WHERE jobs.provider = 'higgsfield'
        AND jobs.status = 'completed'
        AND (
          jobs.provider_status IS DISTINCT FROM 'completed'
          OR jobs.provider_terminal_at IS NULL
          OR jobs.next_poll_at IS NOT NULL
          OR (
            jobs.output_b2_key IS NOT NULL
            AND (
              jobs.archive_status IS DISTINCT FROM 'archived'
              OR jobs.archived_at IS NULL
              OR jobs.archive_next_attempt_at IS NOT NULL
              OR jobs.archive_deadline_at IS NOT NULL
              OR jobs.archive_error IS NOT NULL
            )
          )
          OR (
            jobs.output_b2_key IS NULL
            AND (
              jobs.archive_status = 'not_ready'
              OR jobs.archive_next_attempt_at IS NULL
              OR jobs.archive_deadline_at IS NULL
            )
          )
        )`,
  );

  return {
    providerIdsBound: ids.rowCount ?? 0,
    statusUrlsNormalized: urls.rowCount ?? 0,
    activeRowsNormalized: active.rowCount ?? 0,
    completedRowsNormalized: completed.rowCount ?? 0,
  };
}

/**
 * Claim due Higgsfield status checks in one database statement. The row locks
 * and lease update happen atomically, so concurrent Render instances skip work
 * already owned by another reconciler.
 */
async function claimDueJobs(
  pool: Pool,
  input: { workerId: string; batchSize: number; leaseSeconds: number },
): Promise<ClaimedStoryboardVideoJob[]> {
  const result = await pool.query<ClaimedStoryboardVideoJob>(
    `WITH due_jobs AS (
       SELECT id
         FROM storyboard_ai_video_jobs
        WHERE provider = 'higgsfield'
          AND provider_request_id ~ $4
          AND provider_status_url ~ $5
          AND LOWER(provider_status_url) =
              'https://api.higgsfield.ai/requests/'
              || provider_request_id || '/status'
          AND provider_status IN ('queued', 'in_progress')
          AND status IN ('queued', 'running', 'processing')
          AND next_poll_at IS NOT NULL
          AND next_poll_at <= NOW()
          AND (
            reconcile_lease_expires_at IS NULL
            OR reconcile_lease_expires_at <= NOW()
          )
        ORDER BY next_poll_at ASC, created_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
     )
     UPDATE storyboard_ai_video_jobs AS jobs
        SET reconcile_lease_owner = $1,
            reconcile_lease_expires_at = NOW() + make_interval(secs => $3::int),
            updated_at = NOW()
       FROM due_jobs
      WHERE jobs.id = due_jobs.id
      RETURNING jobs.id::text, jobs.project_id::text, jobs.storyboard_id::text`,
    [
      input.workerId,
      input.batchSize,
      input.leaseSeconds,
      HIGGSFIELD_UUID_SQL,
      HIGGSFIELD_STATUS_URL_SQL,
    ],
  );
  return result.rows;
}

/**
 * Run one bounded reconciliation sweep. This path only calls the existing
 * status poller; it cannot submit or repeat a paid generation request.
 */
export async function tickStoryboardAiVideoReconciler(
  pool: Pool,
  options: StoryboardAiVideoReconcilerTickOptions = {},
): Promise<StoryboardAiVideoReconcilerStats> {
  const workerId = options.workerId
    ?? `storyboard-video-reconciler:${process.pid}:${randomUUID()}`;
  const batchSize = boundedInteger(options.batchSize, DEFAULT_BATCH_SIZE, 1, 50);
  const leaseSeconds = boundedInteger(
    options.leaseSeconds,
    DEFAULT_LEASE_SECONDS,
    10,
    300,
  );
  const poll = options.poll ?? pollStoryboardVideo;
  await normalizeStoryboardAiVideoLifecycle(pool);
  const jobs = await claimDueJobs(pool, { workerId, batchSize, leaseSeconds });
  const stats: StoryboardAiVideoReconcilerStats = {
    claimed: jobs.length,
    polled: 0,
    failed: 0,
    leaseReleaseFailed: 0,
  };

  for (const job of jobs) {
    let errorMessage: string | null = null;
    try {
      stats.polled += 1;
      await poll(pool, {
        projectId: job.project_id,
        storyboardId: job.storyboard_id,
        jobId: job.id,
      });
    } catch (error) {
      errorMessage = pollErrorMessage(error);
      stats.failed += 1;
    } finally {
      try {
        await pool.query(
          `UPDATE storyboard_ai_video_jobs
              SET reconcile_lease_owner = NULL,
                  reconcile_lease_expires_at = NULL,
                  last_poll_error = $3,
                  last_polled_at = NOW(),
                  next_poll_at = CASE
                    WHEN $3::text IS NOT NULL
                    THEN NOW() + make_interval(secs => $4::int)
                    ELSE next_poll_at
                  END,
                  updated_at = NOW()
            WHERE id = $1
              AND reconcile_lease_owner = $2`,
          [job.id, workerId, errorMessage, RETRY_DELAY_SECONDS],
        );
      } catch (releaseError) {
        stats.leaseReleaseFailed += 1;
        console.warn(
          `[storyboard-video-reconciler] failed to release lease for ${job.id}:`,
          pollErrorMessage(releaseError),
        );
      }
    }
  }

  return stats;
}

/** Start provider polling, financial settlement, and archive recovery loops. */
export function startStoryboardAiVideoReconciler(
  pool: Pool,
  options: StoryboardAiVideoReconcilerStartOptions = {},
): StoryboardAiVideoReconcilerHandle {
  const intervalMs = boundedInteger(options.intervalMs, DEFAULT_INTERVAL_MS, 250, 60_000);
  const initialDelayMs = boundedInteger(options.initialDelayMs, 1_000, 0, 60_000);
  const workerId = options.workerId
    ?? `storyboard-video-reconciler:${process.pid}:${randomUUID()}`;
  let stopped = false;
  let providerPollingRunning = false;
  let billingRunning = false;
  let archiveRunning = false;
  let legacyBillingRunning = false;
  let imageBillingRunning = false;

  const runProviderPolling = async (): Promise<void> => {
    if (stopped || providerPollingRunning) return;
    providerPollingRunning = true;
    try {
      const pollStats = await tickStoryboardAiVideoReconciler(pool, {
        ...options, workerId,
      }).catch((error) => {
        console.warn('[storyboard-video-reconciler] poll tick failed:',
          pollErrorMessage(error));
        return null;
      });
      if ((pollStats?.claimed ?? 0) > 0
          || (pollStats?.leaseReleaseFailed ?? 0) > 0) {
        console.info(
          `[storyboard-video-reconciler] poll_claimed=${pollStats?.claimed ?? 0}`,
        );
      }
    } catch (error) {
      console.warn('[storyboard-video-reconciler] tick failed:', pollErrorMessage(error));
    } finally {
      providerPollingRunning = false;
    }
  };

  const runBilling = async (): Promise<void> => {
    if (stopped || billingRunning) return;
    billingRunning = true;
    try {
      const billingTick = options.billingTick
        ?? tickStoryboardVideoBillingSettlements;
      const stats = await billingTick(pool, {
        workerId: `${workerId}:billing`,
        batchSize: options.batchSize,
        leaseSeconds: Math.max(options.leaseSeconds ?? 0, 90),
      });
      if (stats.claimed > 0) {
        console.info(
          `[storyboard-video-billing] claimed=${stats.claimed}`
          + ` delivery_unknown=${stats.deliveryUnknown}`,
        );
      }
    } catch (error) {
      console.warn('[storyboard-video-reconciler] billing tick failed:',
        pollErrorMessage(error));
    } finally {
      billingRunning = false;
    }
  };

  const runArchive = async (): Promise<void> => {
    if (stopped || archiveRunning) return;
    archiveRunning = true;
    try {
      const archiveTick = options.archiveTick ?? tickStoryboardVideoArchiveWorker;
      const stats = await archiveTick(pool, {
        workerId: `${workerId}:archive`,
        batchSize: options.batchSize,
        leaseSeconds: Math.max(options.leaseSeconds ?? 0, 180),
      });
      if (stats.claimed > 0 || stats.expired > 0) {
        console.info(
          `[storyboard-video-archive] claimed=${stats.claimed}`
          + ` expired=${stats.expired}`,
        );
      }
    } catch (error) {
      console.warn('[storyboard-video-reconciler] archive tick failed:',
        pollErrorMessage(error));
    } finally {
      archiveRunning = false;
    }
  };

  // Legacy JSON billing is intentionally isolated from provider polling,
  // normalized settlements and archive recovery. A slow/ambiguous Stripe call
  // can therefore never hold the shared two-second lifecycle loop.
  const runLegacyBilling = async (): Promise<void> => {
    if (stopped || legacyBillingRunning) return;
    legacyBillingRunning = true;
    try {
      const legacyBillingTick = options.legacyBillingTick
        ?? tickLegacyGenerativeAiBillingSettlements;
      const stats = await legacyBillingTick(pool, {
        workerId: `${workerId}:legacy-billing`,
        batchSize: Math.min(options.batchSize ?? 4, 4),
        leaseSeconds: Math.max(options.leaseSeconds ?? 0, 90),
      });
      if (stats.claimed > 0 || stats.expired > 0 || stats.quarantined > 0) {
        console.info(
          `[storyboard-video-legacy-billing] claimed=${stats.claimed}`
          + ` expired=${stats.expired}`
          + ` quarantined=${stats.quarantined}`,
        );
      }
    } catch (error) {
      console.warn('[storyboard-video-reconciler] legacy billing tick failed:',
        pollErrorMessage(error));
    } finally {
      legacyBillingRunning = false;
    }
  };

  // Image settlement is isolated from provider polling. Stripe/wallet retries
  // therefore cannot delay Higgsfield status reconciliation.
  const runImageBilling = async (): Promise<void> => {
    if (stopped || imageBillingRunning) return;
    imageBillingRunning = true;
    try {
      const imageBillingTick = options.imageBillingTick
        ?? tickStoryboardImageBillingSettlements;
      const stats = await imageBillingTick(pool, {
        workerId: `${workerId}:image-billing`,
        batchSize: Math.min(options.batchSize ?? 4, 4),
        leaseSeconds: Math.max(options.leaseSeconds ?? 0, 90),
      });
      if (stats.claimed > 0 || stats.expired > 0
          || stats.recoveredCompletions > 0
          || stats.abandonedReservations > 0) {
        console.info(
          `[storyboard-image-billing] claimed=${stats.claimed}`
          + ` expired=${stats.expired}`
          + ` recovered=${stats.recoveredCompletions}`
          + ` abandoned=${stats.abandonedReservations}`,
        );
      }
    } catch (error) {
      console.warn('[storyboard-video-reconciler] image billing tick failed:',
        pollErrorMessage(error));
    } finally {
      imageBillingRunning = false;
    }
  };

  const kickoff = setTimeout(() => { void runProviderPolling(); }, initialDelayMs);
  const timer = setInterval(() => { void runProviderPolling(); }, intervalMs);
  const billingKickoff = setTimeout(() => { void runBilling(); }, initialDelayMs);
  const billingTimer = setInterval(() => { void runBilling(); }, intervalMs);
  const archiveKickoff = setTimeout(() => { void runArchive(); }, initialDelayMs);
  const archiveTimer = setInterval(() => { void runArchive(); }, intervalMs);
  const legacyBillingKickoff = setTimeout(
    () => { void runLegacyBilling(); },
    initialDelayMs,
  );
  const legacyBillingTimer = setInterval(
    () => { void runLegacyBilling(); },
    LEGACY_AI_BILLING_SWEEP_INTERVAL_MS,
  );
  const imageBillingKickoff = setTimeout(
    () => { void runImageBilling(); },
    initialDelayMs,
  );
  const imageBillingTimer = setInterval(
    () => { void runImageBilling(); },
    IMAGE_AI_BILLING_SWEEP_INTERVAL_MS,
  );
  kickoff.unref?.();
  timer.unref?.();
  billingKickoff.unref?.();
  billingTimer.unref?.();
  archiveKickoff.unref?.();
  archiveTimer.unref?.();
  legacyBillingKickoff.unref?.();
  legacyBillingTimer.unref?.();
  imageBillingKickoff.unref?.();
  imageBillingTimer.unref?.();

  return {
    stop: () => {
      stopped = true;
      clearTimeout(kickoff);
      clearInterval(timer);
      clearTimeout(billingKickoff);
      clearInterval(billingTimer);
      clearTimeout(archiveKickoff);
      clearInterval(archiveTimer);
      clearTimeout(legacyBillingKickoff);
      clearInterval(legacyBillingTimer);
      clearTimeout(imageBillingKickoff);
      clearInterval(imageBillingTimer);
    },
  };
}
