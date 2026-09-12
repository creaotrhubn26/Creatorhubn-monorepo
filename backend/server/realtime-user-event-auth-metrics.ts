import type { Pool } from "pg";

export const USER_EVENTS_AUTH_METRICS_PATH =
  "/api/admin/realtime/user-events-auth-metrics";

export type UserEventsAuthMethod = "ticket" | "legacy";
export type UserEventsClientKind = "web" | "capture-ios" | "unknown";

export interface UserEventsClientMetadata {
  clientKind: UserEventsClientKind;
  clientVersion: string | null;
}

type MetricsQueryable = Pick<Pool, "query">;

const KNOWN_CLIENT_KINDS = new Set<UserEventsClientKind>([
  "web",
  "capture-ios",
  "unknown",
]);
const CLIENT_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;

export function normalizeUserEventsClientMetadata(
  kind: string | undefined,
  version: string | undefined,
): UserEventsClientMetadata {
  const normalizedKind = (kind ?? "")
    .trim()
    .toLowerCase() as UserEventsClientKind;
  const clientKind = KNOWN_CLIENT_KINDS.has(normalizedKind)
    ? normalizedKind
    : "unknown";
  const normalizedVersion = (version ?? "").trim();
  return {
    clientKind,
    clientVersion: CLIENT_VERSION_PATTERN.test(normalizedVersion)
      ? normalizedVersion
      : null,
  };
}

/**
 * Record only coarse connection metadata. No user id, ticket, bearer token,
 * IP address or user agent is persisted. The fixed (hour, method, client-kind)
 * key also prevents unbounded client-version cardinality.
 */
export async function recordUserEventsAuthConnection(
  database: MetricsQueryable,
  authMethod: UserEventsAuthMethod,
  client: UserEventsClientMetadata,
): Promise<void> {
  await database.query(
    `
      INSERT INTO realtime_user_event_auth_metrics (
        bucket_start,
        auth_method,
        client_kind,
        connection_count,
        last_seen_at,
        last_client_version
      ) VALUES (
        date_trunc('hour', NOW()),
        $1,
        $2,
        1,
        NOW(),
        $3
      )
      ON CONFLICT (bucket_start, auth_method, client_kind)
      DO UPDATE SET
        connection_count = realtime_user_event_auth_metrics.connection_count + 1,
        last_seen_at = EXCLUDED.last_seen_at,
        last_client_version = COALESCE(
          EXCLUDED.last_client_version,
          realtime_user_event_auth_metrics.last_client_version
        )
    `,
    [authMethod, client.clientKind, client.clientVersion],
  );
}

interface StoredMetricRow {
  auth_method: UserEventsAuthMethod;
  client_kind: UserEventsClientKind;
  connection_count: string | number;
  last_seen_at: Date | string;
  last_client_version: string | null;
}

export interface UserEventsAuthMetricsReport {
  windowHours: number;
  observedSince: string;
  generatedAt: string;
  totals: Record<UserEventsAuthMethod, number>;
  clients: Array<{
    authMethod: UserEventsAuthMethod;
    clientKind: UserEventsClientKind;
    connectionCount: number;
    lastSeenAt: string;
    lastClientVersion: string | null;
  }>;
}

export async function readUserEventsAuthMetrics(
  database: MetricsQueryable,
  requestedHours = 168,
  now = Date.now(),
): Promise<UserEventsAuthMetricsReport> {
  const windowHours = Math.min(
    24 * 30,
    Math.max(
      1,
      Math.trunc(Number.isFinite(requestedHours) ? requestedHours : 168),
    ),
  );
  const observedSince = new Date(now - windowHours * 60 * 60 * 1_000);
  const result = await database.query<StoredMetricRow>(
    `
      SELECT
        auth_method,
        client_kind,
        SUM(connection_count)::bigint AS connection_count,
        MAX(last_seen_at) AS last_seen_at,
        (ARRAY_AGG(last_client_version ORDER BY last_seen_at DESC)
          FILTER (WHERE last_client_version IS NOT NULL))[1] AS last_client_version
      FROM realtime_user_event_auth_metrics
      WHERE bucket_start >= date_trunc('hour', $1::timestamptz)
      GROUP BY auth_method, client_kind
      ORDER BY auth_method, client_kind
    `,
    [observedSince],
  );

  const totals: Record<UserEventsAuthMethod, number> = { ticket: 0, legacy: 0 };
  const clients = result.rows.map((row) => {
    const connectionCount = Number(row.connection_count) || 0;
    totals[row.auth_method] += connectionCount;
    return {
      authMethod: row.auth_method,
      clientKind: row.client_kind,
      connectionCount,
      lastSeenAt: new Date(row.last_seen_at).toISOString(),
      lastClientVersion: row.last_client_version,
    };
  });

  return {
    windowHours,
    observedSince: observedSince.toISOString(),
    generatedAt: new Date(now).toISOString(),
    totals,
    clients,
  };
}
