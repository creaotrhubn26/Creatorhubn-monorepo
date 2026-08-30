import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { creditMove } from './ai-credits.js';
import { emitGenAiMeter, getGenSettings } from './generative-media.js';

const MAX_ERROR_LENGTH = 1_000;
const RETRY_SECONDS = 30;
const MAX_BATCH_SIZE = 8;
const MIN_LEASE_SECONDS = 90;
const MAX_LEASE_SECONDS = 300;
const ITEM_LEASE_SECONDS = 25;
const LEASE_TAIL_SECONDS = 30;
const STRIPE_TIMEOUT_MS = 20_000;
const STRIPE_MAX_NETWORK_RETRIES = 0;

type Queryable = Pool | PoolClient;

export type StoryboardImageBillingSettlementKind =
  | 'credit_debit'
  | 'credit_refund'
  | 'meter';

export interface StoryboardImageBillingSettlementInput {
  usageId: string;
  kind: StoryboardImageBillingSettlementKind;
  userId: string;
  model: string;
  amountUsd: number;
  billingMode: string;
}

interface StoryboardImageBillingSettlementRow {
  id: string;
  usage_id: string;
  kind: StoryboardImageBillingSettlementKind;
  user_id: string;
  model: string;
  amount_usd: string | number;
  billing_mode: string;
  external_ref: string;
  delivery_deadline_at: Date | string | null;
  lease_owner: string | null;
}

export interface StoryboardImageBillingWorkerStats {
  recoveredCompletions: number;
  abandonedReservations: number;
  expired: number;
  claimed: number;
  completed: number;
  retrying: number;
  permanentlyFailed: number;
  deliveryUnknown: number;
}

export type StoryboardImageBillingDeliveryOutcome =
  | 'not_applicable'
  | 'completed'
  | 'retrying'
  | 'permanent_failed'
  | 'delivery_unknown';

function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(value as number)));
}

function sequentialLeaseSeconds(
  batchSize: number,
  requested: number | undefined,
): number {
  const requestedLease = boundedInteger(
    requested, MIN_LEASE_SECONDS, MIN_LEASE_SECONDS, MAX_LEASE_SECONDS,
  );
  return Math.min(
    MAX_LEASE_SECONDS,
    Math.max(
      requestedLease,
      batchSize * ITEM_LEASE_SECONDS + LEASE_TAIL_SECONDS,
    ),
  );
}

function settlementApplies(
  input: StoryboardImageBillingSettlementInput,
): boolean {
  return input.kind === 'meter'
    ? input.billingMode === 'metered'
    : input.billingMode === 'credits';
}

function settlementRef(
  kind: StoryboardImageBillingSettlementKind,
  usageId: string,
): string {
  if (kind === 'credit_debit') return `storyboard-image:${usageId}`;
  if (kind === 'credit_refund') return `storyboard-image-refund:${usageId}`;
  return `storyboard-image-meter:${usageId}`;
}

export async function enqueueStoryboardImageBillingSettlement(
  db: Queryable,
  input: StoryboardImageBillingSettlementInput,
): Promise<boolean> {
  if (!settlementApplies(input)) return false;
  if (!input.usageId || !input.userId || !input.model
      || !Number.isFinite(input.amountUsd) || input.amountUsd <= 0
      || input.amountUsd > 100_000) {
    throw new Error('storyboard_image_billing_settlement_invalid');
  }
  const externalRef = settlementRef(input.kind, input.usageId);
  const inserted = await db.query(
    `INSERT INTO storyboard_ai_image_billing_settlements
       (id,usage_id,kind,user_id,model,amount_usd,billing_mode,external_ref,
        status,next_attempt_at,delivery_deadline_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',NOW(),
       CASE WHEN $3='meter' THEN NOW()+INTERVAL '20 hours' ELSE NULL END)
     ON CONFLICT (usage_id,kind) DO UPDATE
       SET updated_at=storyboard_ai_image_billing_settlements.updated_at
     WHERE storyboard_ai_image_billing_settlements.user_id=EXCLUDED.user_id
       AND storyboard_ai_image_billing_settlements.model=EXCLUDED.model
       AND storyboard_ai_image_billing_settlements.amount_usd=EXCLUDED.amount_usd
       AND storyboard_ai_image_billing_settlements.billing_mode=EXCLUDED.billing_mode
       AND storyboard_ai_image_billing_settlements.external_ref=EXCLUDED.external_ref
     RETURNING id`,
    [
      randomUUID(), input.usageId, input.kind, input.userId, input.model,
      input.amountUsd, input.billingMode, externalRef,
    ],
  );
  if (!inserted.rows[0]) {
    throw new Error('storyboard_image_billing_settlement_conflict');
  }
  return true;
}

async function markCompleted(
  pool: Pool,
  row: StoryboardImageBillingSettlementRow,
): Promise<void> {
  const updated = await pool.query(
    `UPDATE storyboard_ai_image_billing_settlements
        SET status='completed',completed_at=NOW(),next_attempt_at=NULL,
            lease_owner=NULL,lease_expires_at=NULL,last_error=NULL,
            updated_at=NOW()
      WHERE id=$1 AND status='delivering' AND lease_owner=$2`,
    [row.id, row.lease_owner],
  );
  if (updated.rowCount !== 1) {
    throw new Error('storyboard_image_billing_lease_lost');
  }
}

async function markPermanentFailure(
  pool: Pool,
  row: StoryboardImageBillingSettlementRow,
  error: string,
): Promise<void> {
  await pool.query(
    `WITH failed_settlement AS (
       UPDATE storyboard_ai_image_billing_settlements
          SET status='permanent_failed',next_attempt_at=NULL,
              lease_owner=NULL,lease_expires_at=NULL,last_error=$3,
              updated_at=NOW()
        WHERE id=$1 AND status='delivering' AND lease_owner=$2
        RETURNING usage_id,kind
     ), failed_usage AS (
       UPDATE storyboard_ai_image_usage AS usage
          SET status='failed',error=$3
         FROM failed_settlement
        WHERE usage.id=failed_settlement.usage_id
          AND failed_settlement.kind='credit_debit'
          AND usage.status='reserved'
        RETURNING usage.operation_id
     )
     UPDATE storyboard_ai_image_operations AS operation
        SET status='failed',error=$3,lease_expires_at=NULL,updated_at=NOW()
       FROM failed_usage
      WHERE operation.id=failed_usage.operation_id
        AND operation.status IN ('claimed','processing')`,
    [row.id, row.lease_owner, error.slice(0, MAX_ERROR_LENGTH)],
  );
}

async function markRetry(
  pool: Pool,
  row: StoryboardImageBillingSettlementRow,
  error: unknown,
): Promise<'retrying' | 'delivery_unknown'> {
  const message = (error instanceof Error ? error.message : String(error))
    .slice(0, MAX_ERROR_LENGTH) || 'storyboard_image_billing_retry';
  const deadline = row.kind === 'meter' && row.delivery_deadline_at
    ? new Date(row.delivery_deadline_at).getTime()
    : Number.POSITIVE_INFINITY;
  const deliveryUnknown = deadline <= Date.now() + RETRY_SECONDS * 1_000;
  await pool.query(
    `UPDATE storyboard_ai_image_billing_settlements
        SET status=CASE WHEN kind='meter' AND delivery_deadline_at IS NOT NULL
                                  AND delivery_deadline_at <=
                                    NOW()+make_interval(secs=>$3::int)
                        THEN 'delivery_unknown' ELSE 'retry_wait' END,
            next_attempt_at=CASE
              WHEN kind='meter' AND delivery_deadline_at IS NOT NULL
                AND delivery_deadline_at <= NOW()+make_interval(secs=>$3::int)
              THEN NULL ELSE NOW()+make_interval(secs=>$3::int) END,
            lease_owner=NULL,lease_expires_at=NULL,last_error=$4,updated_at=NOW()
      WHERE id=$1 AND status='delivering' AND lease_owner=$2`,
    [row.id, row.lease_owner, RETRY_SECONDS, message],
  );
  return deliveryUnknown ? 'delivery_unknown' : 'retrying';
}

type CreditLedgerMatch = 'matching' | 'missing' | 'conflict';

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

async function deliverSettlement(
  pool: Pool,
  row: StoryboardImageBillingSettlementRow,
): Promise<Exclude<StoryboardImageBillingDeliveryOutcome, 'not_applicable'>> {
  try {
    const amountUsd = Number(row.amount_usd);
    if (row.kind === 'credit_refund') {
      const debitMatch = await matchingCreditLedgerEntry(pool, {
        ref: settlementRef('credit_debit', row.usage_id),
        userId: row.user_id,
        type: 'spend',
        amountUsd: -amountUsd,
      });
      if (debitMatch === 'conflict') {
        await markPermanentFailure(pool, row, 'credit_debit_reference_conflict');
        return 'permanent_failed';
      }
      if (debitMatch === 'missing') {
        const debit = await pool.query(
          `SELECT status FROM storyboard_ai_image_billing_settlements
            WHERE usage_id=$1 AND kind='credit_debit'`,
          [row.usage_id],
        );
        const debitStatus = String(debit.rows[0]?.status ?? '');
        // Historical reservations may have been debited directly before the
        // outbox existed. If neither a debit ledger nor debit intent exists,
        // there is nothing to refund and crediting would mint free balance.
        if (!debitStatus || debitStatus === 'permanent_failed') {
          await markCompleted(pool, row);
          return 'completed';
        }
        throw new Error('credit_debit_not_settled');
      }
    }

    if (row.kind === 'credit_debit' || row.kind === 'credit_refund') {
      const signedAmount = row.kind === 'credit_debit' ? -amountUsd : amountUsd;
      const ledgerType = row.kind === 'credit_debit' ? 'spend' : 'refund';
      const moved = await creditMove(
        pool,
        row.user_id,
        ledgerType,
        signedAmount,
        row.external_ref,
        row.kind === 'credit_debit'
          ? row.model : `${row.model} provider failure`,
      );
      if (!moved) {
        const ledger = await matchingCreditLedgerEntry(pool, {
          ref: row.external_ref,
          userId: row.user_id,
          type: ledgerType,
          amountUsd: signedAmount,
        });
        if (ledger === 'conflict') {
          await markPermanentFailure(pool, row, 'billing_ledger_reference_conflict');
          return 'permanent_failed';
        }
        if (ledger === 'missing') {
          if (row.kind === 'credit_debit') {
            await markPermanentFailure(pool, row, 'insufficient_credits');
            return 'permanent_failed';
          }
          throw new Error('credit_refund_not_recorded');
        }
      }
    } else {
      const settings = await getGenSettings(pool);
      const emitted = await emitGenAiMeter(pool, {
        userId: row.user_id,
        valueUsd: amountUsd,
        billedUsdOverride: amountUsd,
        meterEventIdentifier: `storyboard-image-${row.usage_id}`,
        idempotencyKey: row.external_ref,
        settings: { ...settings, billingMode: 'metered', markupMultiplier: 1 },
        stripeTimeoutMs: STRIPE_TIMEOUT_MS,
        stripeMaxNetworkRetries: STRIPE_MAX_NETWORK_RETRIES,
      });
      if (!emitted.emitted) {
        throw new Error(emitted.error ?? emitted.skipped ?? 'meter_event_not_emitted');
      }
    }
    await markCompleted(pool, row);
    return 'completed';
  } catch (error) {
    return markRetry(pool, row, error);
  }
}

export async function deliverStoryboardImageBillingSettlementNow(
  pool: Pool,
  input: { usageId: string; kind: StoryboardImageBillingSettlementKind },
): Promise<StoryboardImageBillingDeliveryOutcome> {
  const owner = `storyboard-image-billing-now:${process.pid}:${randomUUID()}`;
  const claimed = await pool.query<StoryboardImageBillingSettlementRow>(
    `UPDATE storyboard_ai_image_billing_settlements
        SET status='delivering',lease_owner=$3,
            lease_expires_at=NOW()+INTERVAL '90 seconds',attempts=attempts+1,
            updated_at=NOW()
      WHERE usage_id=$1 AND kind=$2
        AND status IN ('pending','retry_wait','delivering')
        AND next_attempt_at <= NOW()
        AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
        AND (kind<>'meter'
          OR delivery_deadline_at > NOW()+INTERVAL '90 seconds')
      RETURNING id::text,usage_id::text,kind,user_id,model,amount_usd,
        billing_mode,external_ref,delivery_deadline_at,lease_owner`,
    [input.usageId, input.kind, owner],
  );
  const row = claimed.rows[0];
  if (row) return deliverSettlement(pool, row);
  const existing = await pool.query(
    `SELECT status FROM storyboard_ai_image_billing_settlements
      WHERE usage_id=$1 AND kind=$2`,
    [input.usageId, input.kind],
  );
  const status = String(existing.rows[0]?.status ?? '');
  if (status === 'completed') return 'completed';
  if (status === 'permanent_failed') return 'permanent_failed';
  if (status === 'delivery_unknown') return 'delivery_unknown';
  if (status === 'pending' || status === 'retry_wait' || status === 'delivering') {
    return 'retrying';
  }
  return 'not_applicable';
}

async function recoverCompletedImageUsages(
  pool: Pool,
  batchSize: number,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const due = await client.query(
      `SELECT usage.id::text,usage.user_id,usage.model,usage.billed_usd,
              usage.billing_mode
         FROM storyboard_ai_image_usage AS usage
         JOIN storyboard_ai_image_operations AS operation
           ON operation.id=usage.operation_id
        WHERE usage.status='reserved'
          AND usage.billing_intent_version=1
          AND operation.status='completed'
          AND operation.reservation_id=usage.id
        ORDER BY usage.created_at,usage.id
        LIMIT $1 FOR UPDATE OF usage SKIP LOCKED`,
      [batchSize],
    );
    for (const row of due.rows) {
      await client.query(
        `UPDATE storyboard_ai_image_usage
            SET status='completed',completed_at=COALESCE(completed_at,NOW())
          WHERE id=$1 AND status='reserved'`,
        [row.id],
      );
      if (row.billing_mode === 'metered') {
        await enqueueStoryboardImageBillingSettlement(client, {
          usageId: String(row.id),
          kind: 'meter',
          userId: String(row.user_id),
          model: String(row.model),
          amountUsd: Number(row.billed_usd),
          billingMode: 'metered',
        });
      }
    }
    await client.query('COMMIT');
    return due.rows.length;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function abandonStaleImageReservations(
  pool: Pool,
  batchSize: number,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const due = await client.query(
      `SELECT usage.id::text,usage.operation_id,usage.user_id,usage.model,
              usage.billed_usd,usage.billing_mode
         FROM storyboard_ai_image_usage AS usage
         JOIN storyboard_ai_image_operations AS operation
           ON operation.id=usage.operation_id
        WHERE usage.status='reserved'
          AND usage.billing_intent_version=1
          -- processing has crossed the provider boundary and is deliberately
          -- excluded: absence of a local result is ambiguous.
          AND operation.status IN ('claimed','failed')
          AND COALESCE(operation.lease_expires_at,operation.updated_at)<=NOW()
        ORDER BY usage.created_at,usage.id
        LIMIT $1 FOR UPDATE OF usage,operation SKIP LOCKED`,
      [batchSize],
    );
    for (const row of due.rows) {
      await client.query(
        `UPDATE storyboard_ai_image_usage
            SET status='failed',error='billing_reservation_abandoned'
          WHERE id=$1 AND status='reserved'`,
        [row.id],
      );
      if (row.operation_id) {
        await client.query(
          `UPDATE storyboard_ai_image_operations
              SET status='failed',error='billing_reservation_abandoned',
                  lease_expires_at=NULL,updated_at=NOW()
            WHERE id=$1 AND status='claimed'`,
          [row.operation_id],
        );
      }
      if (row.billing_mode === 'credits' && Number(row.billed_usd) > 0) {
        await enqueueStoryboardImageBillingSettlement(client, {
          usageId: String(row.id),
          kind: 'credit_refund',
          userId: String(row.user_id),
          model: String(row.model),
          amountUsd: Number(row.billed_usd),
          billingMode: 'credits',
        });
      }
    }
    await client.query('COMMIT');
    return due.rows.length;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function tickStoryboardImageBillingSettlements(
  pool: Pool,
  options: { workerId?: string; batchSize?: number; leaseSeconds?: number } = {},
): Promise<StoryboardImageBillingWorkerStats> {
  const workerId = options.workerId
    ?? `storyboard-image-billing:${process.pid}:${randomUUID()}`;
  const batchSize = boundedInteger(
    options.batchSize, 4, 1, MAX_BATCH_SIZE,
  );
  const leaseSeconds = sequentialLeaseSeconds(batchSize, options.leaseSeconds);
  const recoveredCompletions = await recoverCompletedImageUsages(pool, batchSize);
  const abandonedReservations = await abandonStaleImageReservations(
    pool, batchSize,
  );
  const expired = await pool.query(
    `UPDATE storyboard_ai_image_billing_settlements
        SET status='delivery_unknown',next_attempt_at=NULL,
            lease_owner=NULL,lease_expires_at=NULL,
            last_error=COALESCE(last_error,'meter_delivery_window_expired'),
            updated_at=NOW()
      WHERE kind='meter' AND status IN ('pending','retry_wait','delivering')
        AND delivery_deadline_at <= NOW()
        AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
      RETURNING id`,
  );
  const claimed = await pool.query<StoryboardImageBillingSettlementRow>(
    `WITH due AS (
       SELECT id FROM storyboard_ai_image_billing_settlements
        WHERE status IN ('pending','retry_wait','delivering')
          AND next_attempt_at <= NOW()
          AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
          AND (kind<>'meter'
            OR delivery_deadline_at > NOW()+make_interval(secs=>$3::int))
        ORDER BY next_attempt_at,created_at,id
        LIMIT $2 FOR UPDATE SKIP LOCKED
     )
     UPDATE storyboard_ai_image_billing_settlements AS settlement
        SET status='delivering',lease_owner=$1,
            lease_expires_at=NOW()+make_interval(secs=>$3::int),
            attempts=attempts+1,updated_at=NOW()
       FROM due WHERE settlement.id=due.id
     RETURNING settlement.id::text,settlement.usage_id::text,settlement.kind,
       settlement.user_id,settlement.model,settlement.amount_usd,
       settlement.billing_mode,settlement.external_ref,
       settlement.delivery_deadline_at,settlement.lease_owner`,
    [workerId, batchSize, leaseSeconds],
  );
  const stats: StoryboardImageBillingWorkerStats = {
    recoveredCompletions,
    abandonedReservations,
    expired: expired.rowCount ?? expired.rows.length,
    claimed: claimed.rows.length,
    completed: 0,
    retrying: 0,
    permanentlyFailed: 0,
    deliveryUnknown: expired.rowCount ?? expired.rows.length,
  };
  for (const row of claimed.rows) {
    try {
      const outcome = await deliverSettlement(pool, row);
      if (outcome === 'completed') stats.completed += 1;
      else if (outcome === 'retrying') stats.retrying += 1;
      else if (outcome === 'permanent_failed') stats.permanentlyFailed += 1;
      else stats.deliveryUnknown += 1;
    } catch (error) {
      // The lease is deliberately left in place. A later sweep can reclaim it
      // after expiry without allowing one broken row to stop the whole batch.
      stats.retrying += 1;
      console.warn(
        `[storyboard-image-billing] settlement ${row.id} failed:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return stats;
}
