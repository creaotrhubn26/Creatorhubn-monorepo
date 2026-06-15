/**
 * persistent-session-store.ts
 *
 * In-memory activeSessions-Map er flyktig — backend-restart sletter alt.
 * Denne servicen persisterer sessions til Postgres så de overlever
 * redeploy.
 *
 * Bruksmønster:
 *   1. Ved oppstart: hydrateSessionsFromDb(pool, activeSessions) — laster
 *      alle gyldige sessions inn i Map så de gjenkjennes med en gang.
 *   2. Når ny session opprettes (emergency-login, OAuth-callback etc):
 *      kall persistSession() ETTER activeSessions.set(token, data).
 *   3. Sweep utløpte sessions periodisk via pruneExpiredSessions().
 *
 * Sikkerhet:
 *   - Token er allerede en kryptografisk random verdi (32 bytes) — vi
 *     lagrer den i klartekst akkurat som activeSessions-Map gjør.
 *   - Default TTL: 30 dager. Kan overstyres per session.
 */

import type { Pool } from "pg";

export type SessionData = { userId: string; role?: string; email?: string };

const DEFAULT_TTL_DAYS = 30;

export async function persistSession(
  pool: Pool,
  args: {
    token: string;
    session: SessionData;
    source?: string;
    ttlDays?: number;
    ip?: string;
    userAgent?: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  const ttl = args.ttlDays ?? DEFAULT_TTL_DAYS;
  try {
    await pool.query(
      `INSERT INTO persistent_auth_sessions (
         token, user_id, email, role, source,
         expires_at, ip, user_agent, meta
       ) VALUES (
         $1, $2, $3, $4, $5,
         NOW() + ($6::int * INTERVAL '1 day'),
         $7, $8, $9::jsonb
       )
       ON CONFLICT (token) DO UPDATE SET
         last_used_at = NOW(),
         expires_at = NOW() + ($6::int * INTERVAL '1 day')`,
      [
        args.token,
        args.session.userId,
        args.session.email ?? null,
        args.session.role ?? null,
        args.source ?? "unknown",
        ttl,
        args.ip ?? null,
        args.userAgent ?? null,
        JSON.stringify(args.meta ?? {}),
      ],
    );
  } catch (err) {
    // Aldri kast — vi vil ikke at session-persist skal blokkere login
    console.warn("[persistent-session-store] persistSession failed:", (err as Error).message);
  }
}

export async function invalidateSession(pool: Pool, token: string): Promise<void> {
  try {
    await pool.query(`DELETE FROM persistent_auth_sessions WHERE token = $1`, [token]);
  } catch (err) {
    console.warn("[persistent-session-store] invalidate failed:", (err as Error).message);
  }
}

export async function touchSession(pool: Pool, token: string): Promise<void> {
  // Throttled — best effort
  try {
    await pool.query(
      `UPDATE persistent_auth_sessions SET last_used_at = NOW() WHERE token = $1 AND expires_at > NOW()`,
      [token],
    );
  } catch {
    /* ignore */
  }
}

/**
 * Lader alle ikke-utløpte sessions inn i in-memory Map.
 * Kjøres én gang ved oppstart.
 */
export async function hydrateSessionsFromDb(
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<number> {
  try {
    const r = await pool.query<{
      token: string;
      user_id: string;
      email: string | null;
      role: string | null;
    }>(
      `SELECT token, user_id, email, role
         FROM persistent_auth_sessions
        WHERE expires_at > NOW()`,
    );
    let count = 0;
    for (const row of r.rows) {
      if (!activeSessions.has(row.token)) {
        activeSessions.set(row.token, {
          userId: row.user_id,
          email: row.email ?? undefined,
          role: row.role ?? undefined,
        });
        count += 1;
      }
    }
    console.log(`[persistent-session-store] Hydrated ${count} sessions from DB`);
    return count;
  } catch (err) {
    const msg = (err as Error).message ?? "";
    if (msg.includes("relation") && msg.includes("does not exist")) {
      console.warn(
        "[persistent-session-store] persistent_auth_sessions ikke kjørt ennå — hopp over hydration",
      );
      return 0;
    }
    console.error("[persistent-session-store] hydrate failed:", err);
    return 0;
  }
}

/**
 * Rydd utløpte sessions. Kan kjøres som cron eller idle-job.
 * Returner antall slettet.
 */
export async function pruneExpiredSessions(pool: Pool): Promise<number> {
  try {
    const r = await pool.query(
      `DELETE FROM persistent_auth_sessions WHERE expires_at < NOW()`,
    );
    return r.rowCount ?? 0;
  } catch {
    return 0;
  }
}
