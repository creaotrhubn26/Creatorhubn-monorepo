/**
 * role-room-social-idempotency.ts
 *
 * Tiny idempotency store for cost-incurring / side-effecting social endpoints
 * (publish, metrics-snapshot, lead follow-up). The client passes a stable
 * `idempotencyKey` string; the first claim for a given (scope, user, key)
 * tuple wins (fresh:true) and the side effect runs, while any later claim of
 * the same tuple is a no-op (fresh:false) so a double-submit / retry doesn't
 * re-publish or re-send.
 *
 * Backed by a single table with a UNIQUE(scope, user_id, key) constraint —
 * the INSERT … ON CONFLICT DO NOTHING does the dedup atomically at the DB so
 * two concurrent requests can't both observe fresh:true.
 *
 * Scoped per user_id so one tenant's keys can never collide with another's.
 * Callers treat this as best-effort: if the store errors, fall through to
 * normal processing rather than blocking the request.
 */

import type { Pool } from "pg";

let idempotencySchemaReady = false;
async function ensureIdempotencySchema(pool: Pool): Promise<void> {
  if (idempotencySchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_social_idempotency (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      scope TEXT NOT NULL,
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (scope, user_id, key)
    );
  `);
  idempotencySchemaReady = true;
}

/**
 * Atomically claim an idempotency key for a (scope, user) pair.
 * Returns { fresh: true } if this is the first time the key is seen (the
 * caller should perform the side effect), or { fresh: false } if the key was
 * already claimed (the caller should short-circuit without repeating it).
 */
export async function claimIdempotencyKey(
  pool: Pool,
  scope: string,
  userId: string,
  key: string,
): Promise<{ fresh: boolean }> {
  await ensureIdempotencySchema(pool);
  const result = await pool.query(
    `INSERT INTO role_room_social_idempotency (scope, user_id, key)
     VALUES ($1, $2, $3)
     ON CONFLICT (scope, user_id, key) DO NOTHING
     RETURNING id`,
    [scope, userId, key],
  );
  return { fresh: (result.rowCount ?? 0) > 0 };
}

/**
 * Delete idempotency rows older than `olderThanDays`. Keys only need to live
 * long enough to absorb client retries of the same logical operation (seconds
 * to minutes), so a daily prune keeps the table bounded. Call from a cron/
 * scheduler, not per-request. Best-effort: returns 0 on any error.
 */
export async function pruneSocialIdempotency(
  pool: Pool,
  olderThanDays = 7,
): Promise<number> {
  try {
    await ensureIdempotencySchema(pool);
    const result = await pool.query(
      `DELETE FROM role_room_social_idempotency
        WHERE created_at < now() - make_interval(days => $1)`,
      [olderThanDays],
    );
    return result.rowCount ?? 0;
  } catch (error) {
    console.warn("[social-idempotency] prune failed", error);
    return 0;
  }
}
