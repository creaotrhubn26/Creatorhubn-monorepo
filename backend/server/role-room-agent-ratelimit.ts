/**
 * In-memory rate limiter for the Role Room Agent.
 *
 * Two independent buckets:
 *   - per user: 20 calls / minute, 200 / hour (env-tunable)
 *   - per project: 40 calls / minute (guards against a single project
 *     looping in automation)
 *
 * In-memory is fine for our scale — Render single-instance backend.
 * When we move to multi-instance, swap the backing store for Redis.
 * Counters are swept on every check so memory stays bounded.
 *
 * On limit hit, callers get a typed RateLimitExceededError that the
 * route translates to HTTP 429 with Retry-After.
 */

export class RateLimitExceededError extends Error {
  readonly retryAfterSeconds: number;
  readonly scope: 'user_minute' | 'user_hour' | 'project_minute';
  constructor(scope: RateLimitExceededError['scope'], retryAfterSeconds: number) {
    super(`Agent rate limit exceeded (${scope})`);
    this.name = 'RateLimitExceededError';
    this.scope = scope;
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}

interface BucketWindow {
  windowStart: number;
  count: number;
}

const USER_MINUTE_BUCKETS = new Map<string, BucketWindow>();
const USER_HOUR_BUCKETS = new Map<string, BucketWindow>();
const PROJECT_MINUTE_BUCKETS = new Map<string, BucketWindow>();

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function limits() {
  return {
    userPerMinute: envInt('ROLE_ROOM_AGENT_RL_USER_MIN', 20),
    userPerHour: envInt('ROLE_ROOM_AGENT_RL_USER_HOUR', 200),
    projectPerMinute: envInt('ROLE_ROOM_AGENT_RL_PROJECT_MIN', 40),
  };
}

function hit(
  map: Map<string, BucketWindow>,
  key: string,
  nowMs: number,
  windowMs: number,
  capacity: number,
): { exceeded: boolean; retryAfterSeconds: number } {
  let entry = map.get(key);
  if (!entry || nowMs - entry.windowStart >= windowMs) {
    entry = { windowStart: nowMs, count: 0 };
    map.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > capacity) {
    const elapsed = nowMs - entry.windowStart;
    const retryAfterMs = Math.max(0, windowMs - elapsed);
    return { exceeded: true, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }
  return { exceeded: false, retryAfterSeconds: 0 };
}

function sweep(map: Map<string, BucketWindow>, nowMs: number, windowMs: number): void {
  // Best-effort cleanup so long-tail keys don't leak memory.
  if (map.size < 1000) return;
  for (const [key, entry] of map) {
    if (nowMs - entry.windowStart >= windowMs * 2) map.delete(key);
  }
}

export function checkAgentRateLimit(userId: string, projectId: string): void {
  if (process.env.ROLE_ROOM_AGENT_RATE_LIMIT === 'off') return;
  const { userPerMinute, userPerHour, projectPerMinute } = limits();
  const now = Date.now();

  const perUserMinute = hit(USER_MINUTE_BUCKETS, userId, now, 60_000, userPerMinute);
  if (perUserMinute.exceeded) {
    throw new RateLimitExceededError('user_minute', perUserMinute.retryAfterSeconds);
  }
  const perUserHour = hit(USER_HOUR_BUCKETS, userId, now, 60 * 60_000, userPerHour);
  if (perUserHour.exceeded) {
    throw new RateLimitExceededError('user_hour', perUserHour.retryAfterSeconds);
  }
  const perProjectMinute = hit(
    PROJECT_MINUTE_BUCKETS,
    projectId,
    now,
    60_000,
    projectPerMinute,
  );
  if (perProjectMinute.exceeded) {
    throw new RateLimitExceededError('project_minute', perProjectMinute.retryAfterSeconds);
  }

  sweep(USER_MINUTE_BUCKETS, now, 60_000);
  sweep(USER_HOUR_BUCKETS, now, 60 * 60_000);
  sweep(PROJECT_MINUTE_BUCKETS, now, 60_000);
}
