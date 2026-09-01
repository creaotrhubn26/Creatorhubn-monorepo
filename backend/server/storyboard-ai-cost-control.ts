import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { getUserCredits } from './ai-credits.js';
import {
  getGenSettings,
  verifyGenAiMeterEligibility,
} from './generative-media.js';
import {
  deliverStoryboardImageBillingSettlementNow,
  enqueueStoryboardImageBillingSettlement,
} from './storyboard-ai-image-billing-worker.js';
import { storyboardImageEstimatedCostUsd } from './storyboard-ai-context.js';

export class StoryboardAICostError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly safeDetail: string,
  ) { super(code); }
}

async function ensureImageUsageSchema(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS storyboard_ai_image_usage (
    id uuid PRIMARY KEY, project_id varchar NOT NULL, storyboard_id uuid NOT NULL,
    user_id varchar NOT NULL, model varchar NOT NULL, quality varchar NOT NULL,
    status varchar NOT NULL DEFAULT 'reserved', est_cost_usd numeric NOT NULL DEFAULT 0,
    billed_usd numeric NOT NULL DEFAULT 0, billing_mode varchar NOT NULL,
    error varchar, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS storyboard_ai_image_usage_daily_idx
    ON storyboard_ai_image_usage (created_at, status)`);
  await pool.query(`ALTER TABLE storyboard_ai_image_usage
    ADD COLUMN IF NOT EXISTS operation_id uuid`);
  await pool.query(`ALTER TABLE storyboard_ai_image_usage
    ADD COLUMN IF NOT EXISTS billing_intent_version smallint`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_image_usage_operation_idx
    ON storyboard_ai_image_usage (operation_id) WHERE operation_id IS NOT NULL`);
  await pool.query(`CREATE TABLE IF NOT EXISTS storyboard_ai_image_billing_settlements (
    id uuid PRIMARY KEY, usage_id uuid NOT NULL REFERENCES storyboard_ai_image_usage(id) ON DELETE RESTRICT,
    kind varchar(24) NOT NULL, user_id varchar NOT NULL, model varchar NOT NULL,
    amount_usd numeric NOT NULL, billing_mode varchar(24) NOT NULL,
    external_ref varchar(255) NOT NULL, status varchar(24) NOT NULL DEFAULT 'pending',
    attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz,
    delivery_deadline_at timestamptz, lease_owner varchar(255),
    lease_expires_at timestamptz, last_error text, completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_image_billing_usage_kind_uq
    ON storyboard_ai_image_billing_settlements (usage_id,kind)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_image_billing_external_ref_uq
    ON storyboard_ai_image_billing_settlements (external_ref)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_image_billing_charge_intent_uq
    ON storyboard_ai_image_billing_settlements (usage_id)
    WHERE kind IN ('credit_debit','meter')`);
  await pool.query(`CREATE INDEX IF NOT EXISTS storyboard_ai_image_billing_due_idx
    ON storyboard_ai_image_billing_settlements (next_attempt_at,created_at,id)
    WHERE status IN ('pending','retry_wait','delivering')`);
}

export interface StoryboardImageCostReservation {
  id: string;
  estimatedCostUsd: number;
}

async function ensureStoryboardImageCreditDebit(
  pool: Pool,
  input: {
    usageId: string;
    operationId?: string;
    billingMode: string;
    billingIntentVersion: number | null;
  },
): Promise<void> {
  if (input.billingMode !== 'credits' || input.billingIntentVersion !== 1) return;
  const outcome = await deliverStoryboardImageBillingSettlementNow(pool, {
    usageId: input.usageId,
    kind: 'credit_debit',
  }).catch(() => 'retrying' as const);
  if (outcome === 'completed') return;
  if (outcome === 'permanent_failed') {
    throw new StoryboardAICostError(
      402, 'insufficient_credits', 'Ikke nok AI-kreditter.',
    );
  }
  if (input.operationId) {
    await pool.query(
      `UPDATE storyboard_ai_image_operations
          SET lease_expires_at=NOW()+INTERVAL '30 seconds',updated_at=NOW()
        WHERE id=$1 AND status='claimed'`,
      [input.operationId],
    ).catch(() => undefined);
  }
  throw new StoryboardAICostError(
    503,
    'billing_reservation_pending',
    'Kredittreservasjonen behandles. Prøv samme generering igjen om kort tid.',
  );
}

export async function reserveStoryboardImageCost(
  pool: Pool,
  input: {
    projectId: string;
    storyboardId: string;
    userId: string;
    model: string;
    quality: 'standard' | 'hd';
    operationId?: string;
  },
): Promise<StoryboardImageCostReservation> {
  await ensureImageUsageSchema(pool);
  const settings = await getGenSettings(pool);
  if (settings.billingMode !== 'free_whitelist' && !input.operationId) {
    throw new StoryboardAICostError(
      400,
      'billing_operation_id_required',
      'Betalt AI-generering krever en stabil operasjons-ID.',
    );
  }
  if (input.operationId) {
    const existing = await pool.query(
      `SELECT id,project_id,storyboard_id,user_id,model,quality,operation_id,
              est_cost_usd,status,billed_usd,billing_mode,billing_intent_version
         FROM storyboard_ai_image_usage
        WHERE operation_id=$1 LIMIT 1`,
      [input.operationId],
    );
    if (existing.rows[0]) {
      const stored = existing.rows[0];
      if (String(stored.operation_id) !== input.operationId
          || String(stored.project_id) !== input.projectId
          || String(stored.storyboard_id) !== input.storyboardId
          || String(stored.user_id) !== input.userId
          || String(stored.model) !== input.model
          || String(stored.quality) !== input.quality) {
        throw new StoryboardAICostError(
          409,
          'billing_operation_identity_mismatch',
          'Genereringsnøkkelen tilhører en annen kostnadsreservasjon.',
        );
      }
      if (String(stored.status) === 'failed') {
        throw new StoryboardAICostError(
          409, 'generation_attempt_failed',
          'Kostnadsreservasjonen for denne genereringen er avsluttet.',
        );
      }
      if (String(stored.billing_mode) !== 'free_whitelist'
          && Number(stored.billing_intent_version) !== 1) {
        throw new StoryboardAICostError(
          409,
          'billing_intent_unknown',
          'Den historiske kostnadsreservasjonen kan ikke gjenopptas automatisk.',
        );
      }
      if (String(stored.billing_mode) === 'metered'
          && Number(stored.billing_intent_version) === 1) {
        const eligibility = await verifyGenAiMeterEligibility(pool, {
          userId: String(stored.user_id),
          settings: { ...settings, billingMode: 'metered' },
        });
        if (!eligibility.eligible) {
          throw new StoryboardAICostError(
            402,
            'metered_billing_required',
            'Koble til et aktivt, fakturerbart abonnement før AI-generering.',
          );
        }
      }
      await ensureStoryboardImageCreditDebit(pool, {
        usageId: String(stored.id),
        operationId: input.operationId,
        billingMode: String(stored.billing_mode),
        billingIntentVersion: stored.billing_intent_version == null
          ? null : Number(stored.billing_intent_version),
      });
      return {
        id: String(stored.id),
        estimatedCostUsd: Number(stored.est_cost_usd ?? 0),
      };
    }
  }
  if (settings.billingMode === 'metered') {
    const eligibility = await verifyGenAiMeterEligibility(pool, {
      userId: input.userId,
      settings,
    });
    if (!eligibility.eligible) {
      throw new StoryboardAICostError(
        402,
        'metered_billing_required',
        'Koble til et aktivt, fakturerbart abonnement før AI-generering.',
      );
    }
  }
  const estimatedCostUsd = storyboardImageEstimatedCostUsd(input.quality);
  const billedUsd = settings.billingMode === 'free_whitelist'
    ? 0 : estimatedCostUsd * settings.markupMultiplier;

  if (settings.billingMode === 'credits') {
    const credits = await getUserCredits(pool, input.userId);
    if (credits.balanceUsd < billedUsd) {
      throw new StoryboardAICostError(402, 'insufficient_credits', 'Ikke nok AI-kreditter.');
    }
  }

  const workspaceSpent = await pool.query(
    `SELECT COALESCE(SUM(est_cost_usd),0)::float AS spent
       FROM generative_ai_jobs WHERE created_at::date = NOW()::date`,
  ).catch(() => ({ rows: [{ spent: 0 }] }));
  const reservationId = crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('storyboard-ai-daily-cap'))`);
    const storyboardSpent = await client.query(
      `SELECT
         COALESCE((SELECT SUM(est_cost_usd) FROM storyboard_ai_video_jobs
                    WHERE created_at::date = NOW()::date),0)::float
         + COALESCE((SELECT SUM(est_cost_usd) FROM storyboard_ai_image_usage
                    WHERE created_at::date = NOW()::date
                      AND status IN ('reserved','completed')),0)::float AS spent`,
    );
    const spentToday = Number(workspaceSpent.rows[0]?.spent ?? 0)
      + Number(storyboardSpent.rows[0]?.spent ?? 0);
    if (spentToday + estimatedCostUsd > settings.dailyCapUsd) {
      await client.query('ROLLBACK');
      throw new StoryboardAICostError(429, 'daily_cap', 'Det globale dagstaket for AI er nådd.');
    }
    await client.query(
      `INSERT INTO storyboard_ai_image_usage
         (id, project_id, storyboard_id, user_id, model, quality, status,
          est_cost_usd, billed_usd, billing_mode, operation_id,
          billing_intent_version)
       VALUES ($1,$2,$3,$4,$5,$6,'reserved',$7,$8,$9,$10,1)`,
      [reservationId, input.projectId, input.storyboardId, input.userId,
        input.model, input.quality, estimatedCostUsd, billedUsd,
        settings.billingMode, input.operationId ?? null],
    );
    if (settings.billingMode === 'credits') {
      await enqueueStoryboardImageBillingSettlement(client, {
        usageId: reservationId,
        kind: 'credit_debit',
        userId: input.userId,
        model: input.model,
        amountUsd: billedUsd,
        billingMode: 'credits',
      });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  await ensureStoryboardImageCreditDebit(pool, {
    usageId: reservationId,
    operationId: input.operationId,
    billingMode: settings.billingMode,
    billingIntentVersion: 1,
  });
  return { id: reservationId, estimatedCostUsd };
}

export async function completeStoryboardImageCost(pool: Pool, reservationId: string): Promise<void> {
  await ensureImageUsageSchema(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE storyboard_ai_image_usage
          SET status='completed',completed_at=COALESCE(completed_at,NOW())
        WHERE id=$1 AND status='reserved'
        RETURNING id,user_id,model,billed_usd,billing_mode,
                  billing_intent_version`,
      [reservationId],
    );
    const usage = result.rows[0];
    if (usage?.billing_mode === 'metered'
        && Number(usage.billing_intent_version) === 1) {
      await enqueueStoryboardImageBillingSettlement(client, {
        usageId: String(usage.id),
        kind: 'meter',
        userId: String(usage.user_id),
        model: String(usage.model),
        amountUsd: Number(usage.billed_usd),
        billingMode: 'metered',
      });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function failStoryboardImageCost(
  pool: Pool,
  reservationId: string,
  reason: string,
): Promise<void> {
  await ensureImageUsageSchema(pool);
  const client = await pool.connect();
  let shouldDeliverRefund = false;
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE storyboard_ai_image_usage AS usage
          SET status='failed', error=$2
        WHERE usage.id=$1 AND usage.status='reserved'
          AND NOT EXISTS (
            SELECT 1 FROM storyboard_ai_image_operations AS operation
             WHERE operation.id=usage.operation_id
               AND operation.status='completed'
          )
        RETURNING usage.id,usage.user_id,usage.billed_usd,
                  usage.billing_mode,usage.model,usage.billing_intent_version`,
      [reservationId, reason.slice(0, 200)],
    );
    const usage = result.rows[0];
    if (usage?.billing_mode === 'credits'
        && Number(usage.billing_intent_version) === 1
        && Number(usage.billed_usd) > 0) {
      await enqueueStoryboardImageBillingSettlement(client, {
        usageId: String(usage.id),
        kind: 'credit_refund',
        userId: String(usage.user_id),
        model: String(usage.model),
        amountUsd: Number(usage.billed_usd),
        billingMode: 'credits',
      });
      shouldDeliverRefund = true;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  if (shouldDeliverRefund) {
    await deliverStoryboardImageBillingSettlementNow(pool, {
      usageId: reservationId,
      kind: 'credit_refund',
    }).catch(() => 'retrying');
  }
}
