import type { Pool } from "pg";
import {
  isUsablePersistedAuthSession,
  persistedAuthSessionExpiryBound,
} from "./impersonation-session-policy.js";

type PersistableAuthSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
};

const AUTH_SESSION_TABLE_NAME = "creatorhub_auth_sessions";

// Global TTL for persisted auth sessions. Sessions used to never expire; they
// now carry a sliding 30-day window (renewed on each successful load). The
// renewal write is throttled: it only fires when the remaining lifetime has
// dropped below RENEW_THRESHOLD, i.e. at most ~once/day per active session.
// Impersonation sessions keep their own shorter TTL. Their database expiry is
// capped to the same absolute deadline so a restart cannot revive a target
// identity after the per-request guard would have rejected it.
const SESSION_TTL_INTERVAL = "30 days";
const SESSION_RENEW_THRESHOLD_INTERVAL = "29 days";

let authSessionTableReadyPromise: Promise<boolean> | null = null;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizePersistedSession<T extends PersistableAuthSession>(
  value: unknown,
): T | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    !isNonEmptyString(record.userId) ||
    !isNonEmptyString(record.email) ||
    !isNonEmptyString(record.name) ||
    !isNonEmptyString(record.role) ||
    !isNonEmptyString(record.loginAt)
  ) {
    return null;
  }

  return record as T;
}

export async function ensureAuthSessionTable(pool: Pool): Promise<boolean> {
  if (authSessionTableReadyPromise) {
    return authSessionTableReadyPromise;
  }

  authSessionTableReadyPromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${AUTH_SESSION_TABLE_NAME} (
          token TEXT PRIMARY KEY,
          session_data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ
        )
      `);
      // Self-migrate the TTL column for tables that predate 0374, and backfill
      // existing rows so nobody is logged out at deploy time. Idempotent — safe
      // to run on every cold start. Removes any migration/deploy ordering hazard.
      await pool.query(
        `ALTER TABLE ${AUTH_SESSION_TABLE_NAME} ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
      );
      await pool.query(
        `UPDATE ${AUTH_SESSION_TABLE_NAME} SET expires_at = NOW() + INTERVAL '${SESSION_TTL_INTERVAL}' WHERE expires_at IS NULL`,
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_creatorhub_auth_sessions_expires_at ON ${AUTH_SESSION_TABLE_NAME} (expires_at)`,
      );
      return true;
    } catch (error) {
      console.warn("Auth session store unavailable:", error);
      authSessionTableReadyPromise = null;
      return false;
    }
  })();
  const ready = await authSessionTableReadyPromise;
  if (!ready) {
    authSessionTableReadyPromise = null;
  }
  return ready;
}

export async function persistAuthSession<T extends PersistableAuthSession>(
  pool: Pool,
  token: string,
  session: T,
): Promise<void> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return;
  }

  if (!(await ensureAuthSessionTable(pool))) {
    return;
  }

  const expiryBoundMs = persistedAuthSessionExpiryBound(session);
  const expiryBound = expiryBoundMs === null
    ? null
    : new Date(expiryBoundMs).toISOString();

  try {
    await pool.query(
      `
        INSERT INTO ${AUTH_SESSION_TABLE_NAME} (token, session_data, updated_at, expires_at)
        VALUES (
          $1,
          $2::jsonb,
          NOW(),
          CASE
            WHEN $3::timestamptz IS NULL THEN NOW() + INTERVAL '${SESSION_TTL_INTERVAL}'
            ELSE LEAST(NOW() + INTERVAL '${SESSION_TTL_INTERVAL}', $3::timestamptz)
          END
        )
        ON CONFLICT (token)
        DO UPDATE SET
          session_data = EXCLUDED.session_data,
          updated_at = NOW(),
          expires_at = EXCLUDED.expires_at
      `,
      [normalizedToken, JSON.stringify(session), expiryBound],
    );
  } catch (error) {
    console.warn("Failed to persist auth session:", error);
  }
}

export async function deletePersistedAuthSessionsByUserId(
  pool: Pool,
  userId: string,
): Promise<void> {
  if (!userId) return;
  if (!(await ensureAuthSessionTable(pool))) return;
  try {
    await pool.query(
      `DELETE FROM ${AUTH_SESSION_TABLE_NAME} WHERE session_data->>'userId' = $1`,
      [userId],
    );
  } catch (error) {
    console.warn("Failed to delete persisted auth sessions by userId:", error);
  }
}

export async function deletePersistedAuthSession(
  pool: Pool,
  token: string | null | undefined,
): Promise<void> {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) {
    return;
  }

  if (!(await ensureAuthSessionTable(pool))) {
    return;
  }

  try {
    await pool.query(
      `DELETE FROM ${AUTH_SESSION_TABLE_NAME} WHERE token = $1`,
      [normalizedToken],
    );
  } catch (error) {
    console.warn("Failed to delete persisted auth session:", error);
  }
}

export async function loadPersistedAuthSession<T extends PersistableAuthSession>(
  pool: Pool,
  token: string | null | undefined,
): Promise<T | null> {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) {
    return null;
  }

  if (!(await ensureAuthSessionTable(pool))) {
    return null;
  }

  try {
    const result = await pool.query<{ session_data: unknown }>(
      `
        SELECT session_data
        FROM ${AUTH_SESSION_TABLE_NAME}
        WHERE token = $1
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
      `,
      [normalizedToken],
    );
    const session = normalizePersistedSession<T>(
      result.rows[0]?.session_data,
    );
    if (session && !isUsablePersistedAuthSession(session)) {
      await pool
        .query(`DELETE FROM ${AUTH_SESSION_TABLE_NAME} WHERE token = $1`, [
          normalizedToken,
        ])
        .catch((error) => {
          console.warn("Failed to prune invalid persisted auth session:", error);
        });
      return null;
    }
    if (session) {
      const renewalExpiryBoundMs = persistedAuthSessionExpiryBound(session);
      const renewalExpiryBound = renewalExpiryBoundMs === null
        ? null
        : new Date(renewalExpiryBoundMs).toISOString();
      // Sliding renewal, throttled by the WHERE guard so it only writes once the
      // remaining lifetime has dropped below the renew threshold (~once/day per
      // active ordinary session). Impersonation stays capped to its fixed
      // absolute deadline. Fire-and-forget — never block the auth hot path.
      void pool
        .query(
          `
            UPDATE ${AUTH_SESSION_TABLE_NAME}
            SET expires_at = CASE
              WHEN $2::timestamptz IS NULL THEN NOW() + INTERVAL '${SESSION_TTL_INTERVAL}'
              ELSE LEAST(NOW() + INTERVAL '${SESSION_TTL_INTERVAL}', $2::timestamptz)
            END
            WHERE token = $1
              AND (expires_at IS NULL OR expires_at > NOW())
              AND (expires_at IS NULL OR expires_at < NOW() + INTERVAL '${SESSION_RENEW_THRESHOLD_INTERVAL}')
          `,
          [normalizedToken, renewalExpiryBound],
        )
        .catch((error) => {
          console.warn("Failed to renew persisted auth session:", error);
        });
    }
    return session;
  } catch (error) {
    console.warn("Failed to load persisted auth session:", error);
    return null;
  }
}

export async function hydratePersistedAuthSessions<
  T extends PersistableAuthSession,
>(pool: Pool, target: Map<string, T>): Promise<number> {
  if (!(await ensureAuthSessionTable(pool))) {
    return 0;
  }

  try {
    const result = await pool.query<{ token: string; session_data: unknown }>(
      `
        SELECT token, session_data
        FROM ${AUTH_SESSION_TABLE_NAME}
        WHERE expires_at IS NULL OR expires_at > NOW()
        ORDER BY updated_at DESC
      `,
    );

    let hydratedCount = 0;
    const rejectedTokens: string[] = [];
    for (const row of result.rows) {
      const session = normalizePersistedSession<T>(row.session_data);
      if (!session || !isNonEmptyString(row.token)) {
        continue;
      }

      if (!isUsablePersistedAuthSession(session)) {
        rejectedTokens.push(row.token.trim());
        continue;
      }

      target.set(row.token.trim(), session);
      hydratedCount += 1;
    }

    if (rejectedTokens.length > 0) {
      await pool
        .query(
          `DELETE FROM ${AUTH_SESSION_TABLE_NAME} WHERE token = ANY($1::text[])`,
          [rejectedTokens],
        )
        .catch((error) => {
          console.warn("Failed to prune invalid persisted auth sessions:", error);
        });
    }

    return hydratedCount;
  } catch (error) {
    console.warn("Failed to hydrate persisted auth sessions:", error);
    return 0;
  }
}
