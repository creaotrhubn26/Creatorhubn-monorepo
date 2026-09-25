import { createHash } from "node:crypto";
import type { Pool } from "pg";

export type CanvasRateLimitMode = "read" | "write" | "handshake";

export type CanvasRateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  source: "postgres" | "local-read-fallback";
};

type LocalBucket = { count: number; resetAt: number };
const localReadBuckets = new Map<string, LocalBucket>();
const MAX_LOCAL_READ_BUCKETS = 10_000;

export class CanvasRateLimitUnavailableError extends Error {
  constructor() {
    super("canvas_rate_limit_unavailable");
    this.name = "CanvasRateLimitUnavailableError";
  }
}
function isMissingSharedRateLimitTable(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "42P01",
  );
}

function pruneLocalBuckets(now: number): void {
  for (const [key, bucket] of localReadBuckets) {
    if (bucket.resetAt <= now) localReadBuckets.delete(key);
  }
  if (localReadBuckets.size < MAX_LOCAL_READ_BUCKETS) return;
  let oldestKey: string | null = null;
  let oldestReset = Number.POSITIVE_INFINITY;
  for (const [key, bucket] of localReadBuckets) {
    if (bucket.resetAt < oldestReset) {
      oldestKey = key;
      oldestReset = bucket.resetAt;
    }
  }
  if (oldestKey) localReadBuckets.delete(oldestKey);
}

/**
 * Bounded process-local fallback used only for authenticated Canvas reads when
 * migration 0461 has not reached an instance's database yet. Writes and
 * realtime handshakes never use this fallback.
 */
export function consumeLocalCanvasReadRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Omit<CanvasRateLimitDecision, "source"> {
  if (!localReadBuckets.has(key) && localReadBuckets.size >= MAX_LOCAL_READ_BUCKETS) {
    pruneLocalBuckets(now);
  }
  const current = localReadBuckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;
  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
    };
  }
  bucket.count += 1;
  localReadBuckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: 0,
  };
}

type SharedRateRow = {
  allowed: boolean | string;
  remaining: number | string;
  retry_after_seconds: number | string;
};

function rateIdentityHash(identity: string): string {
  return createHash("sha256")
    .update("leadgrid-canvas-rate-v1\0")
    .update(identity)
    .digest("hex");
}

/**
 * Atomic fixed-window limiter shared by every backend instance. It reuses the
 * generic, hashed bucket table introduced by migration 0461; raw user IDs and
 * bearer tokens are never persisted. A missing 0461 table may fall back only
 * for reads so rolling deployments do not strand existing clients.
 */
export async function consumeSharedCanvasRateLimit(
  pool: Pool,
  input: {
    operation: string;
    identity: string;
    limit: number;
    windowMs: number;
    mode: CanvasRateLimitMode;
  },
): Promise<CanvasRateLimitDecision> {
  if (!/^[a-z0-9-]{1,40}$/u.test(input.operation)) {
    throw new CanvasRateLimitUnavailableError();
  }
  if (
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 100_000 ||
    !Number.isSafeInteger(input.windowMs) ||
    input.windowMs < 1_000 ||
    input.windowMs > 24 * 60 * 60_000
  ) {
    throw new CanvasRateLimitUnavailableError();
  }

  const scope = `leadgrid_canvas_${input.operation}`;
  const keyHash = rateIdentityHash(input.identity);
  const windowSeconds = Math.ceil(input.windowMs / 1_000);
  try {
    const result = await pool.query<SharedRateRow>(
      `WITH current_window AS (
         SELECT to_timestamp(
           floor(EXTRACT(epoch FROM NOW()) / $4::integer) * $4::integer
         ) AS window_start
       ), stale AS (
         SELECT scope, key_hash, window_start
           FROM leadgrid_public_rate_limit_buckets
          WHERE window_start < NOW() - interval '2 days'
          ORDER BY window_start ASC, scope ASC, key_hash ASC
          LIMIT 500
       ), prune AS (
         DELETE FROM leadgrid_public_rate_limit_buckets AS bucket
          USING stale
          WHERE bucket.scope = stale.scope
            AND bucket.key_hash = stale.key_hash
            AND bucket.window_start = stale.window_start
       ), attempt AS (
         INSERT INTO leadgrid_public_rate_limit_buckets
           (scope, key_hash, window_start, request_count, request_limit, updated_at)
         SELECT $1, $2, current_window.window_start, 1, $3, NOW()
           FROM current_window
         ON CONFLICT (scope, key_hash, window_start) DO UPDATE
           SET request_count = leadgrid_public_rate_limit_buckets.request_count + 1,
               request_limit = EXCLUDED.request_limit,
               updated_at = NOW()
         WHERE leadgrid_public_rate_limit_buckets.request_count
               < EXCLUDED.request_limit
         RETURNING request_count, request_limit
       )
       SELECT EXISTS(SELECT 1 FROM attempt) AS allowed,
              COALESCE(
                (SELECT request_limit - request_count FROM attempt),
                0
              )::integer AS remaining,
              GREATEST(
                1,
                CEIL(EXTRACT(epoch FROM (
                  (SELECT window_start FROM current_window)
                  + make_interval(secs => $4::integer) - NOW()
                )))::integer
              ) AS retry_after_seconds`,
      [scope, keyHash, input.limit, windowSeconds],
    );
    const row = result.rows[0];
    if (!row) throw new CanvasRateLimitUnavailableError();
    const remaining = Number(row.remaining);
    const retryAfterSeconds = Number(row.retry_after_seconds);
    if (
      !Number.isSafeInteger(remaining) ||
      remaining < 0 ||
      !Number.isSafeInteger(retryAfterSeconds) ||
      retryAfterSeconds < 1
    ) {
      throw new CanvasRateLimitUnavailableError();
    }
    return {
      allowed: row.allowed === true || row.allowed === "true",
      remaining,
      retryAfterSeconds,
      source: "postgres",
    };
  } catch (error) {
    if (input.mode === "read" && isMissingSharedRateLimitTable(error)) {
      return {
        ...consumeLocalCanvasReadRateLimit(
          `${scope}:${keyHash}`,
          input.limit,
          input.windowMs,
        ),
        source: "local-read-fallback",
      };
    }
    if (error instanceof CanvasRateLimitUnavailableError) throw error;
    throw new CanvasRateLimitUnavailableError();
  }
}
