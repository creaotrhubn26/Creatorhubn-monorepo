/**
 * In-memory per-user rate limiter for AI routes.
 *
 * A true multi-pod rate limit needs Redis, but for the current Render
 * single-pod deployment this keeps per-user Claude cost from running
 * away if a client loops on /analyze. Swap for `express-rate-limit` +
 * Redis store the moment traffic justifies it.
 *
 * Keying is on `(req as AuthedRequest).userId` set by requireAuth. If
 * the upstream auth middleware hasn't run, the limiter falls back to
 * the bearer token so unauthed calls still get bounded.
 */

import type { NextFunction, Request, Response } from 'express';

export interface RateLimitOptions {
  /** Window size in ms. */
  windowMs: number;
  /** Max calls per window per key. */
  max: number;
  /** Readable label surfaced in error body. */
  label?: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function keyFor(req: Request): string {
  const userId = (req as Request & { userId?: string }).userId;
  if (userId) return `user:${userId}`;
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  if (bearer) return `token:${bearer}`;
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return `ip:${ip}`;
}

export function aiRateLimit(opts: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    // Opportunistic prune — O(n) occasionally, but n stays tiny because
    // expired entries drop out on every call that hits them anyway.
    if (buckets.size > 512) pruneExpired(now);

    const key = keyFor(req);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > opts.max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'rate_limited',
        message: `${opts.label ?? 'AI endpoint'} limit of ${opts.max} req/${opts.windowMs / 1000}s reached`,
        retryAfterSec,
      });
      return;
    }
    next();
  };
}

/** Exposed for tests — do not call in application code. */
export function __resetRateLimitBucketsForTests(): void {
  buckets.clear();
}
