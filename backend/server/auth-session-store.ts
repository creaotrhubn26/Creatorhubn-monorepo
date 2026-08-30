import type { Pool, PoolClient } from "pg";

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
// Impersonation sessions keep their own, shorter, per-request TTL enforced in
// index.ts — this outer bound is always >= that check, so it never loosens it.
const SESSION_TTL_INTERVAL = "30 days";
const SESSION_RENEW_THRESHOLD_INTERVAL = "29 days";

type AuthSessionQueryClient = Pick<PoolClient, "query">;

export function renewPersistedAuthSession(
  client: AuthSessionQueryClient,
  token: string,
): void {
  void client
    .query(
      `UPDATE ${AUTH_SESSION_TABLE_NAME}
          SET expires_at = NOW() + INTERVAL '${SESSION_TTL_INTERVAL}'
        WHERE token = $1
          AND (expires_at IS NULL OR expires_at > NOW())
          AND (expires_at IS NULL OR expires_at < NOW() + INTERVAL '${SESSION_RENEW_THRESHOLD_INTERVAL}')`,
      [token],
    )
    .catch((error) => {
      console.warn("Failed to renew persisted auth session:", error);
    });
}

export class AuthSessionStoreUnavailableError extends Error {
  readonly cause: unknown;

  constructor(operation: string, cause: unknown) {
    super(`auth_session_store_unavailable:${operation}`);
    this.name = "AuthSessionStoreUnavailableError";
    this.cause = cause;
  }
}

async function initializeAuthSessionTable(
  client: AuthSessionQueryClient,
): Promise<void> {
  await client.query(`
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
  await client.query(
    `ALTER TABLE ${AUTH_SESSION_TABLE_NAME} ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
  );
  await client.query(
    `UPDATE ${AUTH_SESSION_TABLE_NAME} SET expires_at = NOW() + INTERVAL '${SESSION_TTL_INTERVAL}' WHERE expires_at IS NULL`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_creatorhub_auth_sessions_expires_at ON ${AUTH_SESSION_TABLE_NAME} (expires_at)`,
  );
}

async function writeAuthSession(
  client: AuthSessionQueryClient,
  token: string,
  session: PersistableAuthSession,
  expiresAt?: Date,
): Promise<void> {
  const explicitExpiry = expiresAt?.toISOString();
  const expiryExpression = explicitExpiry
    ? "$3::timestamptz"
    : `NOW() + INTERVAL '${SESSION_TTL_INTERVAL}'`;
  await client.query(
    `
      INSERT INTO ${AUTH_SESSION_TABLE_NAME} (token, session_data, updated_at, expires_at)
      VALUES ($1, $2::jsonb, NOW(), ${expiryExpression})
      ON CONFLICT (token)
      DO UPDATE SET
        session_data = EXCLUDED.session_data,
        updated_at = NOW(),
        expires_at = EXCLUDED.expires_at
    `,
    explicitExpiry
      ? [token, JSON.stringify(session), explicitExpiry]
      : [token, JSON.stringify(session)],
  );
}

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
      await initializeAuthSessionTable(pool);
      return true;
    } catch (error) {
      console.warn("Auth session store unavailable:", error);
      authSessionTableReadyPromise = null;
      return false;
    }
  })();
  const readiness = authSessionTableReadyPromise;
  const ready = await readiness;
  if (!ready && authSessionTableReadyPromise === readiness) {
    authSessionTableReadyPromise = null;
  }
  return ready;
}

/**
 * Fail-closed schema readiness for security-critical revocation paths.
 *
 * Unlike `ensureAuthSessionTable`, this helper never converts a database
 * failure into `false`. A supplied transaction client is used directly so a
 * caller can keep readiness and revocation on the same database connection.
 */
export async function ensureAuthSessionTableStrict(
  client: AuthSessionQueryClient,
): Promise<void> {
  try {
    const currentReadiness = authSessionTableReadyPromise;
    if (currentReadiness) {
      const ready = await currentReadiness;
      if (ready) return;
    }

    await initializeAuthSessionTable(client);
    // Pool queries run outside a caller-owned transaction, so their successful
    // schema initialization is safe to reuse. Do not cache readiness established
    // through a PoolClient: its surrounding transaction may still roll back.
    if (typeof (client as Partial<Pool>).connect === "function") {
      authSessionTableReadyPromise = Promise.resolve(true);
    }
  } catch (error) {
    if (error instanceof AuthSessionStoreUnavailableError) throw error;
    throw new AuthSessionStoreUnavailableError("ensure", error);
  }
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

  try {
    // Behold ordinary login-flyters historiske best-effort-semantikk. Den
    // strengere runtime-valideringen brukes kun av transaction-helperen under.
    await writeAuthSession(pool, normalizedToken, session);
  } catch (error) {
    console.warn("Failed to persist auth session:", error);
  }
}

/**
 * Persists a session through the supplied query client and deliberately lets
 * database errors escape. Callers that consume one-time credentials can pass
 * their active PoolClient so credential consumption and session creation live
 * in the same transaction. `persistAuthSession` remains the best-effort helper
 * used by ordinary login flows.
 */
export async function persistAuthSessionInTransaction<
  T extends PersistableAuthSession,
>(
  client: AuthSessionQueryClient,
  token: string,
  session: T,
  options?: { expiresAt?: Date },
): Promise<void> {
  const normalizedToken = token.trim();
  const normalizedSession = normalizePersistedSession<T>(session);
  if (!normalizedToken || !normalizedSession) {
    throw new Error("invalid_auth_session");
  }

  const expiresAt = options?.expiresAt;
  if (
    expiresAt &&
    (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now())
  ) {
    throw new Error("invalid_auth_session_expiry");
  }

  await writeAuthSession(client, normalizedToken, normalizedSession, expiresAt);
}

export async function deletePersistedAuthSessionsByUserIdStrict(
  client: AuthSessionQueryClient,
  userId: string,
): Promise<void> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new TypeError("userId is required for strict auth-session revocation");
  }

  await ensureAuthSessionTableStrict(client);
  try {
    await client.query(
      `WITH revoked_native AS (
         UPDATE ipad_tokens
            SET revoked_at = COALESCE(revoked_at, NOW())
          WHERE user_id = $1
            AND revoked_at IS NULL
          RETURNING token
       )
       DELETE FROM ${AUTH_SESSION_TABLE_NAME}
        WHERE session_data->>'userId' = $1
           OR session_data->>'impersonatorId' = $1`,
      [normalizedUserId],
    );
  } catch (error) {
    throw new AuthSessionStoreUnavailableError("delete_by_user", error);
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

export async function deletePersistedAuthSessionStrict(
  client: AuthSessionQueryClient,
  token: string,
): Promise<void> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new TypeError("token is required for strict auth-session revocation");
  }

  await ensureAuthSessionTableStrict(client);
  try {
    await client.query(
      `WITH revoked_native AS (
         UPDATE ipad_tokens
            SET revoked_at = COALESCE(revoked_at, NOW())
          WHERE token = $1
            AND revoked_at IS NULL
          RETURNING token
       )
       DELETE FROM ${AUTH_SESSION_TABLE_NAME}
        WHERE token = $1`,
      [normalizedToken],
    );
  } catch (error) {
    throw new AuthSessionStoreUnavailableError("delete_token", error);
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
    if (session && session.impersonatedByAdmin !== true) {
      // Sliding renewal, throttled by the WHERE guard so it only writes once the
      // remaining lifetime has dropped below the renew threshold (~once/day per
      // active session). Impersonation tokens have an absolute 30-minute bound
      // and must never inherit the ordinary sliding 30-day lifetime.
      renewPersistedAuthSession(pool, normalizedToken);
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
    for (const row of result.rows) {
      const session = normalizePersistedSession<T>(row.session_data);
      if (!session || !isNonEmptyString(row.token)) {
        continue;
      }

      target.set(row.token.trim(), session);
      hydratedCount += 1;
    }

    return hydratedCount;
  } catch (error) {
    console.warn("Failed to hydrate persisted auth sessions:", error);
    return 0;
  }
}
