import { beforeEach, describe, expect, it, vi } from 'vitest';
// userOwnsSocialConnection is defined locally in role-room-social-routes, but
// that module statically imports the platform publishers / services, which in
// turn pull in heavy third-party SDKs (googleapis, nodemailer, …). None of
// that is exercised by these pure unit tests, so stub the first-party imports
// to empty modules — this bounds the graph to the routes file + the two
// lightweight modules under test and keeps the suite hermetic.
vi.mock('./role-room-feed-plan.js', () => ({ isSupportedPlatform: vi.fn() }));
vi.mock('./social-publisher-linkedin.js', () => ({}));
vi.mock('./social-publisher-youtube.js', () => ({}));
vi.mock('./social-publisher-youtube-channel-plan.js', () => ({}));
vi.mock('./social-publisher-tiktok.js', () => ({}));
vi.mock('./role-room-producer-notifications.js', () => ({}));
vi.mock('./role-room-client-portal.js', () => ({}));
vi.mock('./client-portal-connected-platforms.js', () => ({}));
vi.mock('./role-room-tiktok-oauth.js', () => ({}));
vi.mock('./social-access-request.js', () => ({}));
vi.mock('./social-publisher.js', () => ({}));
vi.mock('./role-room-agent-feedback-insights.js', () => ({}));
vi.mock('./role-room-instagram-publish.js', () => ({}));
import { userOwnsSocialConnection } from './role-room-social-routes';
import { claimIdempotencyKey } from './role-room-social-idempotency';

interface QueryRow { sql: string; args: unknown[]; }
function makePool(impl: (sql: string, args: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>) {
  const queries: QueryRow[] = [];
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    queries.push({ sql, args });
    return impl(sql, args);
  });
  const release = vi.fn();
  const client = { query, release };
  const connect = vi.fn(async () => client);
  return { pool: { query, connect } as never, queries };
}

// ── Cross-tenant ownership gate ─────────────────────────────────────────────
// userOwnsSocialConnection is the single helper every IDOR-sensitive social
// handler (mark-read, snapshot, publish) routes through. It must return true
// ONLY when the connection id + the *caller's* user id match a stored row.
describe('userOwnsSocialConnection', () => {
  beforeEach(() => vi.clearAllMocks());

  // Fixture: connection 'conn-A' belongs to user 'user-A'. The ownership SQL
  // binds [connectionId, userId]; a row only comes back when BOTH match.
  function ownershipPool() {
    return makePool(async (_sql, args) => {
      const [connectionId, userId] = args as [string, string];
      const owns = connectionId === 'conn-A' && userId === 'user-A';
      return owns ? { rows: [{ '?column?': 1 }], rowCount: 1 } : { rows: [], rowCount: 0 };
    });
  }

  it('returns true when the connection belongs to the caller', async () => {
    const { pool, queries } = ownershipPool();
    expect(await userOwnsSocialConnection(pool, 'conn-A', 'user-A')).toBe(true);
    // The query must be scoped by BOTH id and user_id (cross-tenant safety).
    expect(queries[0].args).toEqual(['conn-A', 'user-A']);
    expect(queries[0].sql).toContain('user_id = $2');
  });

  it('denies cross-tenant access: user B cannot use user A connection', async () => {
    // This is the IDOR the gate exists to stop — user B passes user A's
    // connectionId. No row matches (user_id = $2 = user-B), so → false → 404.
    const { pool } = ownershipPool();
    expect(await userOwnsSocialConnection(pool, 'conn-A', 'user-B')).toBe(false);
  });

  it('denies an unknown connection id', async () => {
    const { pool } = ownershipPool();
    expect(await userOwnsSocialConnection(pool, 'conn-unknown', 'user-A')).toBe(false);
  });

  it('fails closed (returns false) when the query throws', async () => {
    const { pool } = makePool(async () => { throw new Error('db offline'); });
    expect(await userOwnsSocialConnection(pool, 'conn-A', 'user-A')).toBe(false);
  });
});

// ── Idempotency claim ───────────────────────────────────────────────────────
// First claim of a (scope, user, key) tuple is fresh; a duplicate is not, so
// the route can short-circuit without repeating the side effect. Scoped per
// user so one tenant's keys never collide with another's.
describe('claimIdempotencyKey', () => {
  beforeEach(() => vi.clearAllMocks());

  // Simulate the UNIQUE(scope,user_id,key) constraint with a Set. INSERT …
  // ON CONFLICT DO NOTHING RETURNING id ⇒ rowCount 1 first time, 0 after.
  function idempotencyPool() {
    const claimed = new Set<string>();
    return makePool(async (sql, args) => {
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.includes('INSERT INTO role_room_social_idempotency')) {
        const [scope, userId, key] = args as [string, string, string];
        const tuple = `${scope}|${userId}|${key}`;
        if (claimed.has(tuple)) return { rows: [], rowCount: 0 };
        claimed.add(tuple);
        return { rows: [{ id: 'idem-1' }], rowCount: 1 };
      }
      return { rows: [] };
    });
  }

  it('is fresh on first claim and deduped on the second', async () => {
    const { pool } = idempotencyPool();
    expect(await claimIdempotencyKey(pool, 'social_publish', 'user-A', 'k1')).toEqual({ fresh: true });
    expect(await claimIdempotencyKey(pool, 'social_publish', 'user-A', 'k1')).toEqual({ fresh: false });
  });

  it('scopes keys per user — same key under a different user is fresh', async () => {
    const { pool } = idempotencyPool();
    expect(await claimIdempotencyKey(pool, 'social_publish', 'user-A', 'k1')).toEqual({ fresh: true });
    expect(await claimIdempotencyKey(pool, 'social_publish', 'user-B', 'k1')).toEqual({ fresh: true });
  });

  it('scopes keys per scope — same key under a different scope is fresh', async () => {
    const { pool } = idempotencyPool();
    expect(await claimIdempotencyKey(pool, 'social_publish', 'user-A', 'k1')).toEqual({ fresh: true });
    expect(await claimIdempotencyKey(pool, 'social_snapshot', 'user-A', 'k1')).toEqual({ fresh: true });
  });

  it('binds [scope, user_id, key] to the INSERT', async () => {
    const { pool, queries } = idempotencyPool();
    await claimIdempotencyKey(pool, 'leads_followup', 'user-A', 'lead-7');
    const insert = queries.find((q) => q.sql.includes('INSERT INTO role_room_social_idempotency'));
    expect(insert).toBeDefined();
    expect(insert!.args).toEqual(['leads_followup', 'user-A', 'lead-7']);
  });
});
