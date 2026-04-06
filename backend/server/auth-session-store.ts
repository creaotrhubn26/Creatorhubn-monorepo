import type { Pool } from "pg";

type PersistableAuthSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
};

const AUTH_SESSION_TABLE_NAME = "creatorhub_auth_sessions";

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
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
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

  try {
    await pool.query(
      `
        INSERT INTO ${AUTH_SESSION_TABLE_NAME} (token, session_data, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (token)
        DO UPDATE SET
          session_data = EXCLUDED.session_data,
          updated_at = NOW()
      `,
      [normalizedToken, JSON.stringify(session)],
    );
  } catch (error) {
    console.warn("Failed to persist auth session:", error);
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
        LIMIT 1
      `,
      [normalizedToken],
    );
    return normalizePersistedSession<T>(result.rows[0]?.session_data);
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
