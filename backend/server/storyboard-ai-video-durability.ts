import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { creditMove } from './ai-credits.js';
import { archiveToRoleRoomB2 } from './b2-archive-helper.js';
import { emitGenAiMeter, getGenSettings } from './generative-media.js';

const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
const ARCHIVE_FETCH_TIMEOUT_MS = 45_000;
const MAX_ERROR_LENGTH = 1_000;
const BILLING_RETRY_SECONDS = 30;
const LEGACY_BILLING_RETRY_BASE_SECONDS = 60;
const LEGACY_BILLING_RETRY_MAX_SECONDS = 15 * 60;
const BILLING_STRIPE_TIMEOUT_MS = 20_000;
const BILLING_STRIPE_MAX_NETWORK_RETRIES = 0;
const BILLING_MIN_LEASE_SECONDS = 90;
const BILLING_MAX_LEASE_SECONDS = 300;
const BILLING_MAX_BATCH_SIZE = 8;
const BILLING_ITEM_LEASE_SECONDS = 25;
const BILLING_LEASE_TAIL_SECONDS = 30;
const LEGACY_BILLING_ISO_PATTERN =
  '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$';
const LEGACY_BILLING_NOW_ISO_SQL =
  `to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

type Queryable = Pool | PoolClient;

function boundedWorkerInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const candidate = Math.floor(value ?? fallback);
  return Number.isFinite(candidate)
    ? Math.min(maximum, Math.max(minimum, candidate))
    : fallback;
}

function sequentialBillingLeaseSeconds(
  batchSize: number,
  requestedLeaseSeconds: number | undefined,
): number {
  const requested = boundedWorkerInteger(
    requestedLeaseSeconds,
    BILLING_MIN_LEASE_SECONDS,
    BILLING_MIN_LEASE_SECONDS,
    BILLING_MAX_LEASE_SECONDS,
  );
  const batchFloor = batchSize * BILLING_ITEM_LEASE_SECONDS
    + BILLING_LEASE_TAIL_SECONDS;
  return Math.min(
    BILLING_MAX_LEASE_SECONDS,
    Math.max(BILLING_MIN_LEASE_SECONDS, requested, batchFloor),
  );
}

export type StoryboardVideoBillingSettlementKind =
  | 'credit_debit'
  | 'credit_refund'
  | 'meter';

export interface StoryboardVideoBillingSettlementInput {
  jobId: string;
  kind: StoryboardVideoBillingSettlementKind;
  userId: string;
  model: string;
  amountUsd: number;
  billingMode: string;
}

interface BillingSettlementRow {
  id: string;
  job_id: string;
  kind: StoryboardVideoBillingSettlementKind;
  user_id: string;
  model: string;
  amount_usd: string | number;
  billing_mode: string;
  external_ref: string;
  attempts: number;
  delivery_deadline_at: Date | string | null;
  lease_owner: string | null;
}

export interface StoryboardVideoBillingWorkerStats {
  claimed: number;
  completed: number;
  retrying: number;
  permanentlyFailed: number;
  deliveryUnknown: number;
}

export interface StoryboardVideoArchiveWorkerStats {
  expired: number;
  claimed: number;
  archived: number;
  retrying: number;
  failed: number;
}

interface ArchiveJobRow {
  id: string;
  project_id: string;
  storyboard_id: string;
  output_url_temp: string;
  archive_attempts: number;
}

function settlementRef(kind: StoryboardVideoBillingSettlementKind, jobId: string): string {
  if (kind === 'credit_debit') return `job:${jobId}`;
  if (kind === 'credit_refund') return `job-refund:${jobId}`;
  return `storyboard-video-meter:${jobId}`;
}

function settlementApplies(input: StoryboardVideoBillingSettlementInput): boolean {
  return input.kind === 'meter'
    ? input.billingMode === 'metered'
    : input.billingMode === 'credits';
}

/**
 * Add the financial intent using the caller's transaction. The exact-value
 * conflict predicate makes a reused job/kind with different money or ownership
 * fail closed instead of silently mutating an already-issued settlement.
 */
export async function enqueueStoryboardVideoBillingSettlement(
  db: Queryable,
  input: StoryboardVideoBillingSettlementInput,
): Promise<boolean> {
  if (!settlementApplies(input)) return false;
  if (!input.userId || !input.jobId || !input.model
      || !Number.isFinite(input.amountUsd) || input.amountUsd <= 0
      || input.amountUsd > 100_000) {
    throw new Error('storyboard_video_billing_settlement_invalid');
  }
  const externalRef = settlementRef(input.kind, input.jobId);
  const result = await db.query(
    `INSERT INTO storyboard_ai_video_billing_settlements
       (id,job_id,kind,user_id,model,amount_usd,billing_mode,external_ref,
        status,next_attempt_at,delivery_deadline_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',NOW(),
       CASE WHEN $3='meter' THEN NOW()+INTERVAL '20 hours' ELSE NULL END)
     ON CONFLICT (job_id,kind) DO UPDATE
       SET updated_at=storyboard_ai_video_billing_settlements.updated_at
     WHERE storyboard_ai_video_billing_settlements.user_id=EXCLUDED.user_id
       AND storyboard_ai_video_billing_settlements.model=EXCLUDED.model
       AND storyboard_ai_video_billing_settlements.amount_usd=EXCLUDED.amount_usd
       AND storyboard_ai_video_billing_settlements.billing_mode=EXCLUDED.billing_mode
       AND storyboard_ai_video_billing_settlements.external_ref=EXCLUDED.external_ref
     RETURNING id`,
    [
      randomUUID(), input.jobId, input.kind, input.userId, input.model,
      input.amountUsd, input.billingMode, externalRef,
    ],
  );
  if (!result.rows[0]) {
    throw new Error('storyboard_video_billing_settlement_conflict');
  }
  return true;
}

async function markSettlementCompleted(
  pool: Pool,
  row: BillingSettlementRow,
): Promise<void> {
  const inputPatch = row.kind === 'credit_debit'
    ? { creditsReserved: true }
    : row.kind === 'credit_refund'
      ? { creditsRefunded: true }
      : { meterEmitted: true };
  await pool.query(
    `WITH completed AS (
       UPDATE storyboard_ai_video_billing_settlements
          SET status='completed',completed_at=NOW(),next_attempt_at=NULL,
              lease_owner=NULL,lease_expires_at=NULL,last_error=NULL,
              updated_at=NOW()
        WHERE id=$1 AND status <> 'permanent_failed'
          AND ($3::text IS NULL OR (status='delivering' AND lease_owner=$3))
        RETURNING job_id
     )
     UPDATE storyboard_ai_video_jobs AS jobs
        SET input=COALESCE(jobs.input,'{}'::jsonb) || $2::jsonb,
            updated_at=NOW()
       FROM completed
      WHERE jobs.id=completed.job_id`,
    [row.id, JSON.stringify(inputPatch), row.lease_owner],
  );
}

async function markSettlementRetry(
  pool: Pool,
  row: BillingSettlementRow,
  error: unknown,
): Promise<'retry_wait' | 'delivery_unknown'> {
  const message = (error instanceof Error ? error.message : String(error))
    .slice(0, MAX_ERROR_LENGTH) || 'storyboard_video_billing_retry';
  await pool.query(
    `UPDATE storyboard_ai_video_billing_settlements
        SET status=CASE WHEN kind='meter' AND delivery_deadline_at IS NOT NULL
                                 AND delivery_deadline_at <=
                                   NOW()+make_interval(secs=>$2::int)
                        THEN 'delivery_unknown' ELSE 'retry_wait' END,
            next_attempt_at=CASE
              WHEN kind='meter' AND delivery_deadline_at IS NOT NULL
                AND delivery_deadline_at <= NOW()+make_interval(secs=>$2::int)
              THEN NULL ELSE NOW()+make_interval(secs=>$2::int) END,
            lease_owner=NULL,lease_expires_at=NULL,last_error=$3,updated_at=NOW()
      WHERE id=$1 AND status <> 'completed'
        AND ($4::text IS NULL OR (status='delivering' AND lease_owner=$4))
      RETURNING status`,
    [row.id, BILLING_RETRY_SECONDS, message, row.lease_owner],
  );
  const deadline = row.kind === 'meter' && row.delivery_deadline_at
    ? new Date(row.delivery_deadline_at).getTime() : Number.POSITIVE_INFINITY;
  return deadline <= Date.now() + BILLING_RETRY_SECONDS * 1_000
    ? 'delivery_unknown' : 'retry_wait';
}

async function markSettlementPermanentFailure(
  pool: Pool,
  row: BillingSettlementRow,
  error: string,
): Promise<void> {
  await pool.query(
    `WITH failed AS (
       UPDATE storyboard_ai_video_billing_settlements
          SET status='permanent_failed',next_attempt_at=NULL,
              lease_owner=NULL,lease_expires_at=NULL,last_error=$2,
              updated_at=NOW()
        WHERE id=$1 AND status <> 'completed'
          AND ($3::text IS NULL OR (status='delivering' AND lease_owner=$3))
        RETURNING job_id,kind
     )
     UPDATE storyboard_ai_video_jobs AS jobs
        SET status=CASE WHEN failed.kind='credit_debit'
                         AND jobs.status='prepared' THEN 'failed'
                        ELSE jobs.status END,
            error=CASE WHEN failed.kind='credit_debit'
                        AND jobs.status='prepared' THEN $2 ELSE jobs.error END,
            updated_at=NOW()
       FROM failed
      WHERE jobs.id=failed.job_id`,
    [row.id, error, row.lease_owner],
  );
}

type CreditLedgerMatch = 'matching' | 'conflict' | 'missing';

async function matchingCreditLedgerEntry(
  pool: Pool,
  input: {
    ref: string;
    userId: string;
    type: 'spend' | 'refund';
    amountUsd: number;
  },
): Promise<CreditLedgerMatch> {
  const result = await pool.query(
    `SELECT user_id,type,amount_usd FROM ai_credit_ledger WHERE ref=$1 LIMIT 1`,
    [input.ref],
  );
  const ledger = result.rows[0];
  if (!ledger) return 'missing';
  return String(ledger.user_id) === input.userId
    && String(ledger.type) === input.type
    && Math.abs(Number(ledger.amount_usd) - input.amountUsd) < 0.000_001
    ? 'matching' : 'conflict';
}

async function deliverBillingSettlement(
  pool: Pool,
  row: BillingSettlementRow,
): Promise<'completed' | 'retrying' | 'permanent_failed' | 'delivery_unknown'> {
  try {
    const amountUsd = Number(row.amount_usd);
    if (row.kind === 'credit_refund') {
      const debitMatch = await matchingCreditLedgerEntry(pool, {
        ref: settlementRef('credit_debit', row.job_id),
        userId: row.user_id,
        type: 'spend',
        amountUsd: -amountUsd,
      });
      if (debitMatch === 'conflict') {
        await markSettlementPermanentFailure(
          pool,
          row,
          'credit_debit_reference_conflict',
        );
        return 'permanent_failed';
      }
      if (debitMatch === 'missing') {
        const debit = await pool.query(
          `SELECT status FROM storyboard_ai_video_billing_settlements
            WHERE job_id=$1 AND kind='credit_debit'`,
          [row.job_id],
        );
        const debitStatus = String(debit.rows[0]?.status ?? '');
        // A historical video reservation may predate the outbox, but a real
        // debit still has the stable job:<id> ledger ref checked above. With
        // neither that ledger nor a live debit intent, refunding would mint
        // balance that was never spent.
        if (!debitStatus || debitStatus === 'permanent_failed') {
          await markSettlementCompleted(pool, row);
          return 'completed';
        }
        throw new Error('credit_debit_not_settled');
      }
    }

    if (row.kind === 'credit_debit' || row.kind === 'credit_refund') {
      const amount = amountUsd * (row.kind === 'credit_debit' ? -1 : 1);
      const moved = await creditMove(
        pool,
        row.user_id,
        row.kind === 'credit_debit' ? 'spend' : 'refund',
        amount,
        row.external_ref,
        row.kind === 'credit_debit'
          ? row.model : `${row.model} provider failure`,
      );
      if (!moved) {
        const ledger = await matchingCreditLedgerEntry(pool, {
          ref: row.external_ref,
          userId: row.user_id,
          type: row.kind === 'credit_debit' ? 'spend' : 'refund',
          amountUsd: amount,
        });
        if (ledger === 'conflict') {
          await markSettlementPermanentFailure(
            pool, row, 'billing_ledger_reference_conflict',
          );
          return 'permanent_failed';
        }
        if (ledger === 'missing') {
          if (row.kind === 'credit_debit') {
            await markSettlementPermanentFailure(pool, row, 'insufficient_credits');
            return 'permanent_failed';
          }
          throw new Error('credit_refund_not_recorded');
        }
      }
    } else {
      const settings = await getGenSettings(pool);
      const emitted = await emitGenAiMeter(pool, {
        userId: row.user_id,
        valueUsd: Number(row.amount_usd),
        billedUsdOverride: Number(row.amount_usd),
        meterEventIdentifier: `storyboard-video-${row.job_id}`,
        idempotencyKey: row.external_ref,
        settings: { ...settings, billingMode: 'metered', markupMultiplier: 1 },
        stripeTimeoutMs: BILLING_STRIPE_TIMEOUT_MS,
        stripeMaxNetworkRetries: BILLING_STRIPE_MAX_NETWORK_RETRIES,
      });
      if (!emitted.emitted) {
        throw new Error(emitted.error ?? emitted.skipped ?? 'meter_event_not_emitted');
      }
    }
    await markSettlementCompleted(pool, row);
    return 'completed';
  } catch (error) {
    const retryState = await markSettlementRetry(pool, row, error);
    return retryState === 'delivery_unknown' ? 'delivery_unknown' : 'retrying';
  }
}

export async function deliverStoryboardVideoBillingSettlementNow(
  pool: Pool,
  input: { jobId: string; kind: StoryboardVideoBillingSettlementKind },
): Promise<'not_applicable' | 'completed' | 'retrying' | 'permanent_failed' | 'delivery_unknown'> {
  const owner = `storyboard-video-billing-now:${process.pid}:${randomUUID()}`;
  const selected = await pool.query<BillingSettlementRow>(
    `UPDATE storyboard_ai_video_billing_settlements
        SET status='delivering',lease_owner=$3,
            lease_expires_at=NOW()+INTERVAL '90 seconds',attempts=attempts+1,
            updated_at=NOW()
      WHERE job_id=$1 AND kind=$2
        AND status IN ('pending','retry_wait','delivering')
        AND next_attempt_at <= NOW()
        AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
        AND (kind<>'meter' OR delivery_deadline_at > NOW())
      RETURNING id::text,job_id::text,kind,user_id,model,amount_usd,billing_mode,
        external_ref,attempts,delivery_deadline_at,lease_owner`,
    [input.jobId, input.kind, owner],
  );
  const row = selected.rows[0];
  if (!row) {
    const existing = await pool.query(
      `SELECT status FROM storyboard_ai_video_billing_settlements
        WHERE job_id=$1 AND kind=$2`,
      [input.jobId, input.kind],
    );
    const status = String(existing.rows[0]?.status ?? '');
    if (status === 'completed') return 'completed';
    if (status === 'permanent_failed') return 'permanent_failed';
    if (status === 'delivery_unknown') return 'delivery_unknown';
    return 'not_applicable';
  }
  return deliverBillingSettlement(pool, row);
}

export async function tickStoryboardVideoBillingSettlements(
  pool: Pool,
  options: { workerId?: string; batchSize?: number; leaseSeconds?: number } = {},
): Promise<StoryboardVideoBillingWorkerStats> {
  const workerId = options.workerId
    ?? `storyboard-video-billing:${process.pid}:${randomUUID()}`;
  // Delivery is sequential. Bound the claim and size the shared lease for the
  // full worst-case Stripe batch so later rows cannot be reclaimed mid-flight.
  const batchSize = boundedWorkerInteger(
    options.batchSize, BILLING_MAX_BATCH_SIZE, 1, BILLING_MAX_BATCH_SIZE,
  );
  const leaseSeconds = sequentialBillingLeaseSeconds(
    batchSize, options.leaseSeconds,
  );
  await pool.query(
    `UPDATE storyboard_ai_video_billing_settlements
        SET status='delivery_unknown',next_attempt_at=NULL,
            lease_owner=NULL,lease_expires_at=NULL,
            last_error=COALESCE(last_error,'meter_delivery_window_expired'),
            updated_at=NOW()
      WHERE kind='meter' AND status IN ('pending','retry_wait','delivering')
        AND delivery_deadline_at <= NOW()
        AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())`,
  );
  const claimed = await pool.query<BillingSettlementRow>(
    `WITH due AS (
       SELECT id FROM storyboard_ai_video_billing_settlements
        WHERE status IN ('pending','retry_wait','delivering')
          AND next_attempt_at <= NOW()
          AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
        ORDER BY next_attempt_at,created_at
        LIMIT $2 FOR UPDATE SKIP LOCKED
     )
     UPDATE storyboard_ai_video_billing_settlements AS settlements
        SET status='delivering',lease_owner=$1,
            lease_expires_at=NOW()+make_interval(secs=>$3::int),
            attempts=attempts+1,updated_at=NOW()
       FROM due WHERE settlements.id=due.id
     RETURNING settlements.id::text,settlements.job_id::text,settlements.kind,
       settlements.user_id,settlements.model,settlements.amount_usd,
       settlements.billing_mode,settlements.external_ref,settlements.attempts,
       settlements.delivery_deadline_at,settlements.lease_owner`,
    [workerId, batchSize, leaseSeconds],
  );
  const stats: StoryboardVideoBillingWorkerStats = {
    claimed: claimed.rows.length,
    completed: 0,
    retrying: 0,
    permanentlyFailed: 0,
    deliveryUnknown: 0,
  };
  for (const row of claimed.rows) {
    const outcome = await deliverBillingSettlement(pool, row);
    if (outcome === 'completed') stats.completed += 1;
    else if (outcome === 'retrying') stats.retrying += 1;
    else if (outcome === 'permanent_failed') stats.permanentlyFailed += 1;
    else stats.deliveryUnknown += 1;
  }
  return stats;
}

export interface LegacyGenerativeAiBillingIntent {
  status: 'pending' | 'delivering' | 'retry_wait' | 'completed'
    | 'permanent_failed' | 'delivery_unknown' | 'not_applicable';
  mode: 'metered' | 'credits' | 'free_whitelist';
  amountUsd: number;
  userId?: string;
  model?: string;
  externalRef?: string;
  meterEventIdentifier?: string;
  deadlineAt?: string | null;
  nextAttemptAt?: string | null;
  leaseOwner?: string | null;
  leaseExpiresAt?: string | null;
  attempts?: number;
  lastError?: string | null;
}

interface LegacyGenerativeAiBillingRow {
  id: string;
  project_id: string;
  input: unknown;
}

type LegacyGenerativeAiBillingOutcome =
  | 'completed' | 'retrying' | 'permanent_failed' | 'delivery_unknown';

export interface LegacyGenerativeAiBillingWorkerStats {
  quarantined: number;
  expired: number;
  claimed: number;
  completed: number;
  retrying: number;
  permanentlyFailed: number;
  deliveryUnknown: number;
}

function jsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown> : {};
    } catch { return {}; }
  }
  return {};
}

function legacyGenerativeAiBillingIntent(
  input: unknown,
): LegacyGenerativeAiBillingIntent | null {
  const value = jsonRecord(input).legacyBilling;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LegacyGenerativeAiBillingIntent
    : null;
}

function legacyBillingRetrySeconds(attempts: number | undefined): number {
  const retryNumber = Math.min(4, Math.max(0, Math.floor(Number(attempts) || 0)));
  return Math.min(
    LEGACY_BILLING_RETRY_MAX_SECONDS,
    LEGACY_BILLING_RETRY_BASE_SECONDS * (2 ** retryNumber),
  );
}

/**
 * Quarantine explicit legacy intents with malformed scheduling metadata before
 * the due scans. The worker deliberately compares canonical UTC ISO strings
 * instead of casting JSON text, so even a concurrently-corrupted row cannot
 * abort the entire sweep.
 */
async function quarantineMalformedLegacyGenerativeAiBillingIntents(
  pool: Pool,
  filter: { jobId?: string; projectId?: string } = {},
): Promise<number> {
  const completion = await pool.query(
    `/* legacy-generative-ai-billing:quarantine */
     UPDATE generative_ai_jobs
        SET input=COALESCE(input,'{}'::jsonb)
          || jsonb_build_object(
               'legacyBilling',
               input->'legacyBilling'
               || jsonb_build_object(
                    'status','permanent_failed','nextAttemptAt',NULL,
                    'leaseOwner',NULL,'leaseExpiresAt',NULL,
                    'lastError','legacy_billing_schedule_malformed'
                  )
             )
      WHERE status='completed'
        AND ($1::text IS NULL OR id::text=$1)
        AND ($2::text IS NULL OR project_id::text=$2)
        AND jsonb_typeof(input->'legacyBilling')='object'
        AND input#>>'{legacyBilling,mode}' IN ('metered','credits')
        AND input#>>'{legacyBilling,status}'
          IN ('pending','retry_wait','delivering')
        AND (
          (
            input#>>'{legacyBilling,mode}'='metered'
            AND (
              jsonb_typeof(input->'legacyBilling'->'deadlineAt')
                IS DISTINCT FROM 'string'
              OR input#>>'{legacyBilling,deadlineAt}' !~ $3
            )
          )
          OR NOT (
            input->'legacyBilling'->'nextAttemptAt' IS NULL
            OR jsonb_typeof(input->'legacyBilling'->'nextAttemptAt')='null'
            OR (
              jsonb_typeof(input->'legacyBilling'->'nextAttemptAt')='string'
              AND input#>>'{legacyBilling,nextAttemptAt}' ~ $3
            )
          )
          OR (
            input#>>'{legacyBilling,status}'='delivering'
            AND (
              COALESCE(input#>>'{legacyBilling,leaseOwner}','')=''
              OR jsonb_typeof(input->'legacyBilling'->'leaseExpiresAt')
                IS DISTINCT FROM 'string'
              OR input#>>'{legacyBilling,leaseExpiresAt}' !~ $3
            )
          )
          OR NOT (
            input->'legacyBilling'->'attempts' IS NULL
            OR jsonb_typeof(input->'legacyBilling'->'attempts')='null'
            OR (
              jsonb_typeof(input->'legacyBilling'->'attempts')='number'
              AND input#>>'{legacyBilling,attempts}' ~ '^[0-9]{1,6}$'
            )
          )
        )`,
    [filter.jobId ?? null, filter.projectId ?? null, LEGACY_BILLING_ISO_PATTERN],
  );
  return completion.rowCount ?? 0;
}

async function expireLegacyGenerativeAiMeterIntents(
  pool: Pool,
  filter: { jobId?: string; projectId?: string } = {},
): Promise<number> {
  const expired = await pool.query(
    `/* legacy-generative-ai-billing:expire */
     UPDATE generative_ai_jobs
        SET input=COALESCE(input,'{}'::jsonb)
          || jsonb_build_object(
               'legacyBilling',
               COALESCE(input->'legacyBilling','{}'::jsonb)
               || jsonb_build_object(
                    'status','delivery_unknown','nextAttemptAt',NULL,
                    'leaseOwner',NULL,'leaseExpiresAt',NULL,
                    'lastError','meter_delivery_window_expired'
                  )
             )
      WHERE status='completed'
        AND ($1::text IS NULL OR id::text=$1)
        AND ($2::text IS NULL OR project_id::text=$2)
        AND input#>>'{legacyBilling,mode}'='metered'
        AND input#>>'{legacyBilling,deadlineAt}' <=
          ${LEGACY_BILLING_NOW_ISO_SQL}
        AND input#>>'{legacyBilling,status}'
          IN ('pending','retry_wait','delivering')
        AND (
          input#>>'{legacyBilling,status}'<>'delivering'
          OR input#>>'{legacyBilling,leaseExpiresAt}' <=
            ${LEGACY_BILLING_NOW_ISO_SQL}
        )`,
    [filter.jobId ?? null, filter.projectId ?? null],
  );
  return expired.rowCount ?? 0;
}

async function claimLegacyGenerativeAiBillingIntents(
  pool: Pool,
  input: {
    workerId: string;
    batchSize: number;
    leaseSeconds: number;
    jobId?: string;
    projectId?: string;
  },
): Promise<LegacyGenerativeAiBillingRow[]> {
  const claimed = await pool.query<LegacyGenerativeAiBillingRow>(
    `/* legacy-generative-ai-billing:claim */
     WITH due AS (
       SELECT id
         FROM generative_ai_jobs
        WHERE status='completed'
          AND ($4::text IS NULL OR id::text=$4)
          AND ($5::text IS NULL OR project_id::text=$5)
          AND input#>>'{legacyBilling,mode}' IN ('metered','credits')
          AND (
            (
              input#>>'{legacyBilling,status}' IN ('pending','retry_wait')
              AND (
                input#>>'{legacyBilling,nextAttemptAt}' IS NULL
                OR input#>>'{legacyBilling,nextAttemptAt}' <=
                  ${LEGACY_BILLING_NOW_ISO_SQL}
              )
            )
            OR (
              input#>>'{legacyBilling,status}'='delivering'
              AND input#>>'{legacyBilling,leaseExpiresAt}' <=
                ${LEGACY_BILLING_NOW_ISO_SQL}
            )
          )
          AND (
            input#>>'{legacyBilling,mode}'<>'metered'
            OR input#>>'{legacyBilling,deadlineAt}' >
              ${LEGACY_BILLING_NOW_ISO_SQL}
          )
        ORDER BY COALESCE(
          input#>>'{legacyBilling,nextAttemptAt}',
          to_char(
            completed_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ),
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          )
        ),id
        LIMIT $2 FOR UPDATE SKIP LOCKED
     )
     UPDATE generative_ai_jobs AS jobs
        SET input=COALESCE(jobs.input,'{}'::jsonb)
          || jsonb_build_object(
               'legacyBilling',
               COALESCE(jobs.input->'legacyBilling','{}'::jsonb)
               || jsonb_build_object(
                    'status','delivering','leaseOwner',$1,
                    'leaseExpiresAt',
                      to_char(
                        (
                          NOW()+make_interval(secs=>$3::int)
                        ) AT TIME ZONE 'UTC',
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                      ),
                    'attempts',CASE
                      WHEN jobs.input#>>'{legacyBilling,attempts}'
                        ~ '^[0-9]{1,6}$'
                      THEN (jobs.input#>>'{legacyBilling,attempts}')::int+1
                      ELSE 1
                    END
                  )
             )
       FROM due WHERE jobs.id=due.id
     RETURNING jobs.id::text,jobs.project_id::text,jobs.input`,
    [
      input.workerId, input.batchSize, input.leaseSeconds,
      input.jobId ?? null, input.projectId ?? null,
    ],
  );
  return claimed.rows;
}

async function patchLegacyGenerativeAiBillingIntent(
  pool: Pool,
  row: LegacyGenerativeAiBillingRow,
  leaseOwner: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const updated = await pool.query(
    `/* legacy-generative-ai-billing:patch */
     UPDATE generative_ai_jobs
        SET input=COALESCE(input,'{}'::jsonb)
          || jsonb_build_object(
               'legacyBilling',
               COALESCE(input->'legacyBilling','{}'::jsonb) || $4::jsonb
             )
      WHERE id::text=$1 AND project_id::text=$2
        AND input#>>'{legacyBilling,leaseOwner}'=$3`,
    [row.id, row.project_id, leaseOwner, JSON.stringify(patch)],
  );
  return updated.rowCount === 1;
}

async function deliverLegacyGenerativeAiBillingIntent(
  pool: Pool,
  row: LegacyGenerativeAiBillingRow,
  leaseOwner: string,
): Promise<LegacyGenerativeAiBillingOutcome> {
  const intent = legacyGenerativeAiBillingIntent(row.input);
  const amountUsd = Number(intent?.amountUsd);
  try {
    if (!intent || !(amountUsd > 0) || amountUsd > 100_000
        || !intent.userId || !intent.model) {
      throw new Error('legacy_billing_identity_invalid');
    }
    if (intent.mode === 'credits') {
      const externalRef = intent.externalRef || `job:${row.id}`;
      const moved = await creditMove(
        pool, intent.userId, 'spend', -amountUsd, externalRef, intent.model,
      );
      if (!moved) {
        const ledger = await pool.query(
          `SELECT user_id,type,amount_usd FROM ai_credit_ledger
            WHERE ref=$1 LIMIT 1`,
          [externalRef],
        );
        const existing = ledger.rows[0];
        const matching = existing
          && String(existing.user_id) === intent.userId
          && String(existing.type) === 'spend'
          && Math.abs(Number(existing.amount_usd) + amountUsd) < 0.000_001;
        if (!matching) throw new Error(existing
          ? 'legacy_billing_ledger_reference_conflict'
          : 'insufficient_credits');
      }
    } else if (intent.mode === 'metered') {
      const settings = await getGenSettings(pool);
      const emitted = await emitGenAiMeter(pool, {
        userId: intent.userId,
        valueUsd: amountUsd,
        billedUsdOverride: amountUsd,
        settings: { ...settings, billingMode: 'metered', markupMultiplier: 1 },
        meterEventIdentifier: intent.meterEventIdentifier
          || `legacy-generative-ai-${row.id}`,
        idempotencyKey: intent.externalRef
          || `legacy-generative-ai-meter:${row.id}`,
        stripeTimeoutMs: BILLING_STRIPE_TIMEOUT_MS,
        stripeMaxNetworkRetries: BILLING_STRIPE_MAX_NETWORK_RETRIES,
      });
      if (!emitted.emitted) {
        throw new Error(emitted.error ?? emitted.skipped
          ?? 'meter_event_not_emitted');
      }
    } else {
      throw new Error('legacy_billing_identity_invalid');
    }
    const marked = await patchLegacyGenerativeAiBillingIntent(
      pool, row, leaseOwner,
      {
        status: 'completed', nextAttemptAt: null, leaseOwner: null,
        leaseExpiresAt: null, lastError: null,
      },
    );
    return marked ? 'completed' : 'retrying';
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error))
      .slice(0, MAX_ERROR_LENGTH) || 'legacy_billing_delivery_failed';
    const permanent = [
      'insufficient_credits', 'legacy_billing_ledger_reference_conflict',
      'legacy_billing_identity_invalid',
    ].includes(message);
    const retrySeconds = legacyBillingRetrySeconds(intent?.attempts);
    const deadline = intent?.mode === 'metered' && intent.deadlineAt
      ? new Date(intent.deadlineAt).getTime() : Number.POSITIVE_INFINITY;
    const deliveryUnknown = deadline <= Date.now() + retrySeconds * 1_000;
    await patchLegacyGenerativeAiBillingIntent(pool, row, leaseOwner, {
      status: permanent ? 'permanent_failed'
        : deliveryUnknown ? 'delivery_unknown' : 'retry_wait',
      nextAttemptAt: permanent || deliveryUnknown
        ? null : new Date(Date.now() + retrySeconds * 1_000).toISOString(),
      leaseOwner: null, leaseExpiresAt: null, lastError: message,
    });
    return permanent ? 'permanent_failed'
      : deliveryUnknown ? 'delivery_unknown' : 'retrying';
  }
}

export async function deliverLegacyGenerativeAiBillingSettlementNow(
  pool: Pool,
  input: { jobId: string; projectId: string },
): Promise<'not_applicable' | LegacyGenerativeAiBillingOutcome> {
  await quarantineMalformedLegacyGenerativeAiBillingIntents(pool, input);
  await expireLegacyGenerativeAiMeterIntents(pool, input);
  const owner = `legacy-generative-ai-billing-now:${process.pid}:${randomUUID()}`;
  const rows = await claimLegacyGenerativeAiBillingIntents(pool, {
    workerId: owner,
    batchSize: 1,
    leaseSeconds: BILLING_MIN_LEASE_SECONDS,
    ...input,
  });
  return rows[0]
    ? deliverLegacyGenerativeAiBillingIntent(pool, rows[0], owner)
    : 'not_applicable';
}

export async function tickLegacyGenerativeAiBillingSettlements(
  pool: Pool,
  options: { workerId?: string; batchSize?: number; leaseSeconds?: number } = {},
): Promise<LegacyGenerativeAiBillingWorkerStats> {
  const workerId = options.workerId
    ?? `legacy-generative-ai-billing:${process.pid}:${randomUUID()}`;
  // This compatibility queue is intentionally tiny. New work belongs to the
  // normalized storyboard outbox above; the sweep only drains explicit legacy
  // intents and never backfills historical rows.
  const batchSize = boundedWorkerInteger(options.batchSize, 4, 1, 10);
  const leaseSeconds = sequentialBillingLeaseSeconds(
    batchSize, options.leaseSeconds,
  );
  const quarantined =
    await quarantineMalformedLegacyGenerativeAiBillingIntents(pool);
  const expired = await expireLegacyGenerativeAiMeterIntents(pool);
  const claimed = await claimLegacyGenerativeAiBillingIntents(pool, {
    workerId, batchSize, leaseSeconds,
  });
  const stats: LegacyGenerativeAiBillingWorkerStats = {
    quarantined,
    expired,
    claimed: claimed.length,
    completed: 0,
    retrying: 0,
    permanentlyFailed: 0,
    deliveryUnknown: 0,
  };
  for (const row of claimed) {
    try {
      const outcome = await deliverLegacyGenerativeAiBillingIntent(
        pool, row, workerId,
      );
      if (outcome === 'completed') stats.completed += 1;
      else if (outcome === 'retrying') stats.retrying += 1;
      else if (outcome === 'permanent_failed') stats.permanentlyFailed += 1;
      else stats.deliveryUnknown += 1;
    } catch {
      // The lease remains on the row and becomes reclaimable. Isolate one bad
      // row so the rest of the bounded batch can still settle.
      stats.retrying += 1;
    }
  }
  return stats;
}

const TRUSTED_ARCHIVE_HOSTS = [
  'fal.media', 'fal.ai', 'fal.run', 'higgsfield.ai',
  'cloudfront.net', 'amazonaws.com', 'storage.googleapis.com',
] as const;

export function trustedStoryboardVideoOutputUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password
        || (url.port && url.port !== '443')) return null;
    const hostname = url.hostname.toLowerCase();
    return TRUSTED_ARCHIVE_HOSTS.some((host) => (
      hostname === host || hostname.endsWith(`.${host}`)
    )) ? url : null;
  } catch {
    return null;
  }
}

async function fetchTrustedArchiveResponse(
  initialUrl: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<Response> {
  if (!trustedStoryboardVideoOutputUrl(initialUrl)) {
    throw new Error('untrusted_output_url');
  }
  const response = await fetchImpl(initialUrl, { redirect: 'error', signal });
  if (response.url && !trustedStoryboardVideoOutputUrl(response.url)) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('archive_response_url_untrusted');
  }
  return response;
}

async function boundedMediaBody(
  response: Response,
  expectedKind: 'video' | 'image',
): Promise<Buffer> {
  if (!response.ok) throw new Error(`archive_download_http_${response.status}`);
  const contentType = (response.headers.get('content-type') ?? '')
    .split(';', 1)[0].trim().toLowerCase();
  const accepted = expectedKind === 'video'
    ? contentType.startsWith('video/')
      || contentType === 'application/octet-stream'
      || contentType === 'application/mp4'
    : ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']
      .includes(contentType)
      || contentType === 'application/octet-stream';
  if (!accepted) {
    throw new Error('archive_content_type_rejected');
  }
  const rawLength = response.headers.get('content-length');
  const declaredLength = rawLength == null ? null : Number(rawLength);
  if (declaredLength != null && (!Number.isFinite(declaredLength)
      || declaredLength <= 0 || declaredLength > MAX_ARCHIVE_BYTES)) {
    throw new Error('archive_content_length_rejected');
  }
  if (!response.body) throw new Error('archive_body_missing');
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    if (total > MAX_ARCHIVE_BYTES) {
      await reader.cancel('storyboard_video_archive_too_large')
        .catch(() => undefined);
      throw new Error('archive_body_too_large');
    }
    chunks.push(Buffer.from(part.value));
  }
  if (total === 0) throw new Error('archive_body_empty');
  return Buffer.concat(chunks, total);
}

export async function downloadTrustedStoryboardVideoOutput(
  input: {
    providerUrl: string;
    fetchImpl?: typeof fetch;
    expectedKind?: 'video' | 'image';
  },
): Promise<{ bytes: Buffer; contentType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARCHIVE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchTrustedArchiveResponse(
      input.providerUrl,
      input.fetchImpl ?? fetch,
      controller.signal,
    );
    return {
      bytes: await boundedMediaBody(response, input.expectedKind ?? 'video'),
      contentType: response.headers.get('content-type') ?? 'video/mp4',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function archiveStoryboardVideoOutput(
  input: {
    projectId: string;
    storyboardId: string;
    jobId: string;
    providerUrl: string;
    fetchImpl?: typeof fetch;
    archive?: typeof archiveToRoleRoomB2;
  },
): Promise<string> {
  const downloaded = await downloadTrustedStoryboardVideoOutput({
    providerUrl: input.providerUrl,
    fetchImpl: input.fetchImpl,
  });
  const key = `workspace/${input.projectId}/storyboards/${input.storyboardId}`
    + `/animations/${input.jobId}.mp4`;
  const stored = await (input.archive ?? archiveToRoleRoomB2)(
    key,
    downloaded.bytes,
    downloaded.contentType,
  );
  if (!stored) throw new Error('archive_upload_failed');
  return key;
}

function parseSceneStore(value: unknown): Record<string, unknown>[] {
  const parsed = typeof value === 'string'
    ? (() => { try { return JSON.parse(value); } catch { return []; } })()
    : value;
  return Array.isArray(parsed)
    ? parsed.filter((item): item is Record<string, unknown> => (
      Boolean(item) && typeof item === 'object' && !Array.isArray(item)
    ))
    : [];
}

async function finalizeStoryboardVideoArchive(
  pool: Pool,
  input: {
    workerId: string;
    jobId: string;
    projectId: string;
    storyboardId: string;
    outputKey: string;
  },
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      `SELECT id FROM storyboard_ai_video_jobs
        WHERE id=$1 AND project_id=$2 AND storyboard_id=$3
          AND archive_status='archiving' AND archive_lease_owner=$4
        FOR UPDATE`,
      [input.jobId, input.projectId, input.storyboardId, input.workerId],
    );
    if (!locked.rows[0]) {
      await client.query('ROLLBACK');
      return false;
    }

    const board = await client.query(
      `SELECT scene_id,frame_id,metadata FROM casting_storyboards
        WHERE id=$1 AND project_id=$2 FOR UPDATE`,
      [input.storyboardId, input.projectId],
    );
    const boardRow = board.rows[0];
    const metadata = boardRow?.metadata && typeof boardRow.metadata === 'object'
      ? boardRow.metadata as Record<string, unknown> : {};
    const aiVideo = metadata.aiVideo && typeof metadata.aiVideo === 'object'
      && !Array.isArray(metadata.aiVideo)
      ? metadata.aiVideo as Record<string, unknown> : {};
    const normalizedOwnsJob = String(aiVideo.jobId ?? '') === input.jobId;
    if (normalizedOwnsJob) {
      await client.query(
        `UPDATE casting_storyboards
            SET metadata=COALESCE(metadata,'{}'::jsonb)
              || jsonb_build_object(
                   'aiVideo',COALESCE(metadata->'aiVideo','{}'::jsonb)
                     || jsonb_build_object('outputB2Key',$1::text)
                 )
          WHERE id=$2 AND project_id=$3
            AND metadata->'aiVideo'->>'jobId'=$4`,
        [input.outputKey, input.storyboardId, input.projectId, input.jobId],
      );
    }

    const sceneId = boardRow?.scene_id ? String(boardRow.scene_id) : '';
    const frameId = boardRow?.frame_id ? String(boardRow.frame_id) : '';
    if (normalizedOwnsJob && sceneId && frameId) {
      const sceneRow = await client.query(
        `SELECT manuscript_id FROM casting_scenes
          WHERE id=$1 AND project_id=$2 LIMIT 1`,
        [sceneId, input.projectId],
      );
      const manuscriptId = sceneRow.rows[0]?.manuscript_id
        ? String(sceneRow.rows[0].manuscript_id) : '';
      if (manuscriptId) {
        const storeKey = `casting:scenes:${manuscriptId}`;
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [storeKey],
        );
        const selected = await client.query(
          `SELECT store_value FROM legacy_compat_store
            WHERE store_key=$1 FOR UPDATE`,
          [storeKey],
        );
        const scenes = parseSceneStore(selected.rows[0]?.store_value);
        const sceneIndex = scenes.findIndex((scene) => scene.id === sceneId);
        const scene = sceneIndex >= 0 ? scenes[sceneIndex] : null;
        const frames = Array.isArray(scene?.storyboardFrames)
          ? scene.storyboardFrames as Record<string, unknown>[] : [];
        const frameIndex = frames.findIndex((frame) => frame?.id === frameId);
        const frame = frameIndex >= 0 ? frames[frameIndex] : null;
        if (scene && frame && String(frame.aiVideoJobId ?? '') === input.jobId) {
          const currentTimestamp = Date.parse(String(frame.updatedAt ?? ''));
          const updatedAt = new Date(Math.max(
            Date.now(),
            Number.isFinite(currentTimestamp) ? currentTimestamp + 1 : 0,
          )).toISOString();
          const nextFrames = frames.slice();
          nextFrames[frameIndex] = {
            ...frame,
            aiVideoStatus: 'completed-archived',
            aiVideoURL: null,
            aiVideoArchiveKey: input.outputKey,
            updatedAt,
          };
          const nextScenes = scenes.slice();
          nextScenes[sceneIndex] = {
            ...scene,
            storyboardFrames: nextFrames,
            updatedAt,
          };
          await client.query(
            `UPDATE legacy_compat_store
                SET store_value=$2::jsonb,updated_at=NOW()
              WHERE store_key=$1`,
            [storeKey, JSON.stringify(nextScenes)],
          );
          await client.query(
            `UPDATE legacy_compat_store
                SET store_value=jsonb_set(
                  store_value,'{version}',to_jsonb(
                    CASE WHEN COALESCE(store_value->>'version','') ~ '^[0-9]+$'
                      THEN (store_value->>'version')::bigint+1 ELSE 1 END),true),
                    updated_at=NOW()
              WHERE store_key=$1`,
            [`casting:manuscript:${manuscriptId}`],
          );
        }
      }
    }

    const archived = await client.query(
      `UPDATE storyboard_ai_video_jobs
          SET output_b2_key=$3,archive_status='archived',archived_at=NOW(),
              archive_next_attempt_at=NULL,archive_deadline_at=NULL,
              archive_lease_owner=NULL,archive_lease_expires_at=NULL,
              archive_error=NULL,updated_at=NOW()
        WHERE id=$1 AND archive_status='archiving' AND archive_lease_owner=$2`,
      [input.jobId, input.workerId, input.outputKey],
    );
    if (archived.rowCount !== 1) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function tickStoryboardVideoArchiveWorker(
  pool: Pool,
  options: {
    workerId?: string;
    batchSize?: number;
    leaseSeconds?: number;
    fetchImpl?: typeof fetch;
    archive?: typeof archiveToRoleRoomB2;
  } = {},
): Promise<StoryboardVideoArchiveWorkerStats> {
  const workerId = options.workerId
    ?? `storyboard-video-archive:${process.pid}:${randomUUID()}`;
  const batchSize = Math.min(20, Math.max(1, Math.floor(options.batchSize ?? 4)));
  const leaseSeconds = Math.min(600, Math.max(60, Math.floor(options.leaseSeconds ?? 180)));
  const expired = await pool.query(
    `UPDATE storyboard_ai_video_jobs
        SET archive_status='failed',archive_next_attempt_at=NULL,
            archive_lease_owner=NULL,archive_lease_expires_at=NULL,
            archive_error=COALESCE(archive_error,'archive_deadline_expired'),
            updated_at=NOW()
      WHERE status='completed' AND output_b2_key IS NULL
        AND archive_status IN ('pending','retry_wait','archiving')
        AND archive_deadline_at IS NOT NULL AND archive_deadline_at <= NOW()
        AND (archive_status<>'archiving' OR archive_lease_expires_at IS NULL
          OR archive_lease_expires_at <= NOW())`,
  );
  const claimed = await pool.query<ArchiveJobRow>(
    `WITH due AS (
       SELECT id FROM storyboard_ai_video_jobs
        WHERE status='completed' AND output_b2_key IS NULL
          AND output_url_temp IS NOT NULL
          AND archive_status IN ('pending','retry_wait','archiving')
          AND archive_next_attempt_at <= NOW()
          AND (archive_deadline_at IS NULL OR archive_deadline_at > NOW())
          AND (archive_lease_expires_at IS NULL OR archive_lease_expires_at <= NOW())
        ORDER BY archive_next_attempt_at,completed_at,created_at
        LIMIT $2 FOR UPDATE SKIP LOCKED
     )
     UPDATE storyboard_ai_video_jobs AS jobs
        SET archive_status='archiving',archive_lease_owner=$1,
            archive_lease_expires_at=NOW()+make_interval(secs=>$3::int),
            archive_attempts=COALESCE(archive_attempts,0)+1,updated_at=NOW()
       FROM due WHERE jobs.id=due.id
     RETURNING jobs.id::text,jobs.project_id::text,jobs.storyboard_id::text,
       jobs.output_url_temp,jobs.archive_attempts`,
    [workerId, batchSize, leaseSeconds],
  );
  const stats: StoryboardVideoArchiveWorkerStats = {
    expired: expired.rowCount ?? 0,
    claimed: claimed.rows.length,
    archived: 0,
    retrying: 0,
    failed: 0,
  };
  for (const job of claimed.rows) {
    try {
      const key = await archiveStoryboardVideoOutput({
        projectId: job.project_id,
        storyboardId: job.storyboard_id,
        jobId: job.id,
        providerUrl: job.output_url_temp,
        fetchImpl: options.fetchImpl,
        archive: options.archive,
      });
      const finalized = await finalizeStoryboardVideoArchive(pool, {
        workerId,
        jobId: job.id,
        projectId: job.project_id,
        storyboardId: job.storyboard_id,
        outputKey: key,
      });
      if (!finalized) {
        throw new Error('archive_settlement_lost_lease');
      }
      stats.archived += 1;
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error))
        .slice(0, MAX_ERROR_LENGTH) || 'storyboard_video_archive_failed';
      const delaySeconds = Math.min(
        3_600,
        5 * (2 ** Math.min(Math.max(Number(job.archive_attempts), 1), 10)),
      );
      const failed = await pool.query(
        `UPDATE storyboard_ai_video_jobs
            SET archive_status=CASE WHEN archive_deadline_at IS NOT NULL
                                      AND archive_deadline_at <= NOW()
                                    THEN 'failed' ELSE 'retry_wait' END,
                archive_next_attempt_at=CASE
                  WHEN archive_deadline_at IS NOT NULL AND archive_deadline_at <= NOW()
                  THEN NULL ELSE NOW()+make_interval(secs=>$3::int) END,
                archive_lease_owner=NULL,archive_lease_expires_at=NULL,
                archive_error=$4,updated_at=NOW()
          WHERE id=$1 AND archive_status='archiving'
            AND archive_lease_owner=$2
          RETURNING archive_status`,
        [job.id, workerId, delaySeconds, message],
      );
      if (failed.rows[0]?.archive_status === 'failed') stats.failed += 1;
      else stats.retrying += 1;
    }
  }
  return stats;
}
