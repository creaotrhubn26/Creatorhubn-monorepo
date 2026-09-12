import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { creditMove, getUserCredits } from './ai-credits.js';
import { emitGenAiMeter, getGenSettings } from './generative-media.js';
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
}

export interface StoryboardImageCostReservation {
  id: string;
  estimatedCostUsd: number;
}

export async function reserveStoryboardImageCost(
  pool: Pool,
  input: {
    projectId: string;
    storyboardId: string;
    userId: string;
    model: string;
    quality: 'standard' | 'hd';
  },
): Promise<StoryboardImageCostReservation> {
  await ensureImageUsageSchema(pool);
  const settings = await getGenSettings(pool);
  const estimatedCostUsd = storyboardImageEstimatedCostUsd(input.quality);
  const billedUsd = settings.billingMode === 'credits'
    ? estimatedCostUsd * settings.markupMultiplier : 0;

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
          est_cost_usd, billed_usd, billing_mode)
       VALUES ($1,$2,$3,$4,$5,$6,'reserved',$7,$8,$9)`,
      [reservationId, input.projectId, input.storyboardId, input.userId,
        input.model, input.quality, estimatedCostUsd, billedUsd, settings.billingMode],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (settings.billingMode === 'credits') {
    const charged = await creditMove(
      pool, input.userId, 'spend', -billedUsd,
      `storyboard-image:${reservationId}`, input.model,
    );
    if (!charged) {
      await pool.query(
        `UPDATE storyboard_ai_image_usage SET status='failed', error='insufficient_credits'
          WHERE id=$1 AND status='reserved'`, [reservationId],
      ).catch(() => undefined);
      throw new StoryboardAICostError(402, 'insufficient_credits', 'Ikke nok AI-kreditter.');
    }
  }
  return { id: reservationId, estimatedCostUsd };
}

export async function completeStoryboardImageCost(pool: Pool, reservationId: string): Promise<void> {
  const result = await pool.query(
    `UPDATE storyboard_ai_image_usage SET status='completed', completed_at=NOW()
      WHERE id=$1 AND status='reserved'
      RETURNING user_id, est_cost_usd`, [reservationId],
  );
  const usage = result.rows[0];
  if (!usage) return;
  const settings = await getGenSettings(pool);
  await emitGenAiMeter(pool, {
    userId: usage.user_id, valueUsd: Number(usage.est_cost_usd || 0), settings,
  }).catch(() => undefined);
}

export async function failStoryboardImageCost(
  pool: Pool,
  reservationId: string,
  reason: string,
): Promise<void> {
  const result = await pool.query(
    `UPDATE storyboard_ai_image_usage SET status='failed', error=$2
      WHERE id=$1 AND status='reserved'
      RETURNING user_id, billed_usd, billing_mode, model`,
    [reservationId, reason.slice(0, 200)],
  ).catch(() => ({ rows: [] }));
  const usage = result.rows[0];
  if (!usage || usage.billing_mode !== 'credits' || Number(usage.billed_usd) <= 0) return;
  await creditMove(
    pool, usage.user_id, 'refund', Number(usage.billed_usd),
    `storyboard-image-refund:${reservationId}`, `${usage.model} provider failure`,
  ).catch(() => false);
}
