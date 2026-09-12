/**
 * partner-api-rate-limiter.ts
 *
 * Sliding-window rate limiter for /api/v1/partner/*.
 *
 * Algoritme:
 *   - 60-sekunds bøtter i api_rate_limit_buckets (per api_key_id)
 *   - Sliding window: summer siste 60 bøtter = siste time
 *   - Sjekk mot tier-spesifikk calls_per_hour fra api_quota_config
 *   - Burst-sjekk: siste minutt vs burst_per_minute
 *   - Daglig sjekk: siste 24t vs calls_per_day
 *
 * Tier-resolusjon:
 *   - api_key.environment='sandbox' → 'sandbox'-tier
 *   - api_key.partner_id → leadgrid_partners.tier
 *   - api_key.organization_id (uten partner) → 'production'-default
 *
 * Response-headers (alltid):
 *   X-RateLimit-Limit: <calls_per_hour>
 *   X-RateLimit-Remaining: <calls_per_hour - used_this_hour>
 *   X-RateLimit-Reset: <epoch-sec til neste minutt>
 *   X-RateLimit-Burst: <burst_per_minute>
 *
 * 429 Too Many Requests m/ Retry-After header når over.
 */

import type { Pool } from "pg";
import type { Request, Response, NextFunction } from "express";

interface QuotaConfig {
  tier: string;
  calls_per_hour: number;
  calls_per_day: number;
  burst_per_minute: number;
  overage_price_per_call_oere: number;
  is_sandbox: boolean;
}

const _quotaCache = new Map<string, { config: QuotaConfig; expires: number }>();
const CACHE_MS = 5 * 60_000; // 5 min

async function getQuota(pool: Pool, tier: string): Promise<QuotaConfig | null> {
  const cached = _quotaCache.get(tier);
  if (cached && cached.expires > Date.now()) return cached.config;
  const r = await pool.query<QuotaConfig>(
    `SELECT tier, calls_per_hour, calls_per_day, burst_per_minute,
            overage_price_per_call_oere, is_sandbox
       FROM api_quota_config WHERE tier = $1`,
    [tier],
  );
  if (r.rows.length === 0) return null;
  _quotaCache.set(tier, { config: r.rows[0], expires: Date.now() + CACHE_MS });
  return r.rows[0];
}

interface KeyContext {
  api_key_id: string;
  partner_id: string | null;
  organization_id: string | null;
  environment: string | null;
}

async function resolveTier(pool: Pool, ctx: KeyContext): Promise<string> {
  // Sandbox-environment → sandbox-tier
  if (ctx.environment === "sandbox") return "sandbox";
  // Partner-bundet key → bruk leadgrid_partners.tier
  if (ctx.partner_id) {
    const r = await pool.query<{ tier: string }>(
      `SELECT tier FROM leadgrid_partners WHERE id = $1`,
      [ctx.partner_id],
    );
    if (r.rows[0]?.tier) return r.rows[0].tier;
  }
  // Default
  return "production";
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_at: number;        // unix seconds
  retry_after?: number;    // seconds, only when blocked
  reason?: "hour_limit" | "day_limit" | "burst_limit";
  tier: string;
}

export async function checkRateLimit(
  pool: Pool, ctx: KeyContext,
): Promise<RateLimitResult> {
  const tier = await resolveTier(pool, ctx);
  const quota = await getQuota(pool, tier);
  if (!quota) {
    // Ingen quota = ubegrenset (skal ikke skje i praksis)
    return {
      allowed: true, limit: 999999, remaining: 999999,
      reset_at: Math.floor(Date.now() / 1000) + 60, tier,
    };
  }

  // Bestem nåværende minutt-bøtte (truncate til hel minutt)
  const now = new Date();
  const currentMinute = new Date(now);
  currentMinute.setSeconds(0, 0);
  const minuteAgo = new Date(now.getTime() - 60_000);
  const hourAgo = new Date(now.getTime() - 60 * 60_000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);

  // Hent counts fra siste minutt + time + dag
  const r = await pool.query<{
    burst_count: string; hour_count: string; day_count: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN bucket_start >= $2 THEN call_count ELSE 0 END), 0) AS burst_count,
       COALESCE(SUM(CASE WHEN bucket_start >= $3 THEN call_count ELSE 0 END), 0) AS hour_count,
       COALESCE(SUM(CASE WHEN bucket_start >= $4 THEN call_count ELSE 0 END), 0) AS day_count
       FROM api_rate_limit_buckets
      WHERE api_key_id = $1`,
    [ctx.api_key_id, minuteAgo, hourAgo, dayAgo],
  );
  const burst = parseInt(r.rows[0]?.burst_count ?? "0", 10);
  const hour = parseInt(r.rows[0]?.hour_count ?? "0", 10);
  const day = parseInt(r.rows[0]?.day_count ?? "0", 10);

  // Sjekk grenser (burst først — kortest cooldown)
  const resetAtSec = Math.floor(currentMinute.getTime() / 1000) + 60;

  if (burst >= quota.burst_per_minute) {
    return {
      allowed: false, limit: quota.calls_per_hour, remaining: 0,
      reset_at: resetAtSec, retry_after: 60 - Math.floor((now.getTime() - currentMinute.getTime()) / 1000),
      reason: "burst_limit", tier,
    };
  }
  if (hour >= quota.calls_per_hour) {
    return {
      allowed: false, limit: quota.calls_per_hour, remaining: 0,
      reset_at: resetAtSec + 3600, retry_after: 3600,
      reason: "hour_limit", tier,
    };
  }
  if (day >= quota.calls_per_day) {
    return {
      allowed: false, limit: quota.calls_per_day, remaining: 0,
      reset_at: resetAtSec + 24 * 3600, retry_after: 24 * 3600,
      reason: "day_limit", tier,
    };
  }

  return {
    allowed: true, limit: quota.calls_per_hour,
    remaining: quota.calls_per_hour - hour,
    reset_at: resetAtSec, tier,
  };
}

export async function incrementCallCount(
  pool: Pool, apiKeyId: string,
): Promise<void> {
  const currentMinute = new Date();
  currentMinute.setSeconds(0, 0);
  await pool.query(
    `INSERT INTO api_rate_limit_buckets (api_key_id, bucket_start, call_count)
     VALUES ($1, $2, 1)
     ON CONFLICT (api_key_id, bucket_start) DO UPDATE
       SET call_count = api_rate_limit_buckets.call_count + 1`,
    [apiKeyId, currentMinute],
  );
}

/**
 * Express middleware factory. Caller setter req.apiKey (fra requireApiKey).
 * Vi krever at middleware kjører ETTER requireApiKey.
 */
export function rateLimit(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ctx = (req as any).apiKey as KeyContext | undefined;
    if (!ctx) {
      // Ingen api-key = let neste middleware håndtere 401
      return next();
    }
    try {
      const r = await checkRateLimit(pool, ctx);
      // Sett headers alltid
      res.setHeader("X-RateLimit-Limit", String(r.limit));
      res.setHeader("X-RateLimit-Remaining", String(r.remaining));
      res.setHeader("X-RateLimit-Reset", String(r.reset_at));
      res.setHeader("X-RateLimit-Tier", r.tier);
      if (!r.allowed) {
        res.setHeader("Retry-After", String(r.retry_after ?? 60));
        return res.status(429).json({
          error: "rate_limit_exceeded",
          reason: r.reason,
          retry_after_seconds: r.retry_after,
          tier: r.tier,
        });
      }
      // Bump counter etter success-sjekk (fire-and-forget)
      void incrementCallCount(pool, ctx.api_key_id).catch(() => {});
      next();
    } catch (e) {
      console.error("[rate-limit]", e);
      // Fail-open: la requesten passere ved rate-limiter-feil
      next();
    }
  };
}

/**
 * Cleanup gamle buckets (kjør i cron daglig).
 */
export async function cleanupOldBuckets(pool: Pool): Promise<number> {
  const r = await pool.query(
    `DELETE FROM api_rate_limit_buckets
      WHERE bucket_start < now() - interval '7 days'`,
  );
  return r.rowCount ?? 0;
}

/**
 * Beregn daglig overage og lagre i api_overage_log (cron).
 */
export async function computeDailyOverage(pool: Pool, day: Date = new Date(Date.now() - 24 * 60 * 60_000)): Promise<{
  processed: number; total_overage_oere: number;
}> {
  const dayStr = day.toISOString().slice(0, 10);

  // Hent alle keys som har calls denne dagen
  const r = await pool.query<{
    api_key_id: string; total_calls: string;
    partner_id: string | null; environment: string | null;
  }>(
    `SELECT b.api_key_id::text, SUM(b.call_count)::text AS total_calls,
            k.partner_id::text, k.environment
       FROM api_rate_limit_buckets b
       JOIN partner_api_keys k ON k.id = b.api_key_id
      WHERE b.bucket_start >= $1::date
        AND b.bucket_start < ($1::date + interval '1 day')
      GROUP BY b.api_key_id, k.partner_id, k.environment`,
    [dayStr],
  );

  let processed = 0, totalOverage = 0;
  for (const row of r.rows) {
    const tier = await resolveTier(pool, {
      api_key_id: row.api_key_id,
      partner_id: row.partner_id, organization_id: null,
      environment: row.environment,
    });
    const quota = await getQuota(pool, tier);
    if (!quota) continue;
    const calls = parseInt(row.total_calls, 10);
    const overage = Math.max(0, calls - quota.calls_per_day);
    const charge = overage * quota.overage_price_per_call_oere;
    await pool.query(
      `INSERT INTO api_overage_log
        (api_key_id, day, total_calls, quota_calls, overage_calls, overage_charge_oere)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (api_key_id, day) DO UPDATE
         SET total_calls = EXCLUDED.total_calls,
             overage_calls = EXCLUDED.overage_calls,
             overage_charge_oere = EXCLUDED.overage_charge_oere`,
      [row.api_key_id, dayStr, calls, quota.calls_per_day, overage, charge],
    );
    processed++;
    totalOverage += charge;
  }
  return { processed, total_overage_oere: totalOverage };
}
