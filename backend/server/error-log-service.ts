/**
 * error-log-service.ts
 *
 * Sentry-erstatning som lagrer alle backend- og frontend-errors i
 * error_log-tabellen. Aggregerer per fingerprint (samme feil = +1 count).
 *
 * Brukes av:
 *   - Express error-middleware (alle uncaught 500)
 *   - Admin-route-wrappere (logger 401 + 403 med email)
 *   - Frontend POST /api/admin-room/errors (JS-crashes)
 *   - Unhandled rejection-handler i index.ts
 */

import crypto from "crypto";
import type { Pool } from "pg";

export type ErrorLevel = "error" | "warning" | "info";
export type ErrorSource = "backend" | "frontend";

export interface LogErrorInput {
  level?: ErrorLevel;
  source: ErrorSource;
  statusCode?: number;
  endpoint?: string;
  message: string;
  errorName?: string;
  stack?: string;
  userId?: string;
  userEmail?: string;
  claritySessionId?: string;
  ip?: string;
  userAgent?: string;
  url?: string;
  meta?: Record<string, unknown>;
}

/**
 * Bygger en deterministisk fingerprint som grupperer "samme" feil.
 * Vi unngår dynamisk innhold (UUID-er, timestamps, query-params).
 */
function computeFingerprint(input: LogErrorInput): string {
  const stackFirstLine = (input.stack ?? "").split("\n")[0] ?? "";
  const cleanedEndpoint = (input.endpoint ?? "")
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "/:uuid") // UUID-r i path
    .replace(/\/\d+/g, "/:n") // numeriske IDer
    .replace(/\?.*$/, "");      // query
  const key = [
    input.source,
    cleanedEndpoint,
    input.statusCode ?? "",
    input.errorName ?? "",
    stackFirstLine.slice(0, 200),
  ].join("|");
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 32);
}

/** Strip Authorization, cookie, password-felter ut av meta. */
function redactMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    const lower = k.toLowerCase();
    if (
      lower.includes("password") ||
      lower.includes("authorization") ||
      lower.includes("cookie") ||
      lower.includes("token") ||
      lower === "secret"
    ) {
      out[k] = "[REDACTED]";
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactMeta(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export interface LoggedError {
  id: string;
  level: ErrorLevel;
  source: ErrorSource;
  statusCode: number | null;
  endpoint: string | null;
  message: string;
  errorName: string | null;
  stack: string | null;
  fingerprint: string;
  userId: string | null;
  userEmail: string | null;
  claritySessionId: string | null;
  ip: string | null;
  userAgent: string | null;
  url: string | null;
  meta: Record<string, unknown>;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolvedNote: string | null;
}

interface ErrorLogRow {
  id: string;
  level: ErrorLevel;
  source: ErrorSource;
  status_code: number | null;
  endpoint: string | null;
  message: string;
  error_name: string | null;
  stack: string | null;
  fingerprint: string;
  user_id: string | null;
  user_email: string | null;
  clarity_session_id: string | null;
  ip: string | null;
  user_agent: string | null;
  url: string | null;
  meta: Record<string, unknown>;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolved_note: string | null;
}

function rowToLogged(r: ErrorLogRow): LoggedError {
  return {
    id: r.id,
    level: r.level,
    source: r.source,
    statusCode: r.status_code,
    endpoint: r.endpoint,
    message: r.message,
    errorName: r.error_name,
    stack: r.stack,
    fingerprint: r.fingerprint,
    userId: r.user_id,
    userEmail: r.user_email,
    claritySessionId: r.clarity_session_id,
    ip: r.ip,
    userAgent: r.user_agent,
    url: r.url,
    meta: r.meta ?? {},
    occurrenceCount: r.occurrence_count,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    resolvedAt: r.resolved_at,
    resolvedByUserId: r.resolved_by_user_id,
    resolvedNote: r.resolved_note,
  };
}

/**
 * Loggør en feil. Idempotent på fingerprint — samme feil incrementer
 * occurrence_count i stedet for å lage ny rad.
 *
 * Aldri kaster en feil tilbake til kaller (vi vil ikke at error-logging
 * skal skape flere errors).
 */
export async function logError(pool: Pool, input: LogErrorInput): Promise<string | null> {
  try {
    const fingerprint = computeFingerprint(input);
    const meta = redactMeta(input.meta);

    const r = await pool.query<{ id: string }>(
      `INSERT INTO error_log (
         level, source, status_code, endpoint, message, error_name, stack,
         fingerprint, user_id, user_email, clarity_session_id,
         ip, user_agent, url, meta
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
       ON CONFLICT (fingerprint) DO UPDATE SET
         occurrence_count = error_log.occurrence_count + 1,
         last_seen_at = NOW(),
         user_id = COALESCE(EXCLUDED.user_id, error_log.user_id),
         user_email = COALESCE(EXCLUDED.user_email, error_log.user_email),
         clarity_session_id = COALESCE(EXCLUDED.clarity_session_id, error_log.clarity_session_id),
         meta = EXCLUDED.meta,
         -- Re-åpne hvis tidligere markert resolved
         resolved_at = NULL,
         resolved_by_user_id = NULL,
         resolved_note = NULL
       RETURNING id::text`,
      [
        input.level ?? "error",
        input.source,
        input.statusCode ?? null,
        input.endpoint ?? null,
        input.message.slice(0, 2000),
        input.errorName ?? null,
        input.stack ? input.stack.slice(0, 10000) : null,
        fingerprint,
        input.userId ?? null,
        input.userEmail ?? null,
        input.claritySessionId ?? null,
        input.ip ?? null,
        input.userAgent ? input.userAgent.slice(0, 500) : null,
        input.url ?? null,
        JSON.stringify(meta),
      ],
    );
    return r.rows[0]?.id ?? null;
  } catch (err) {
    // Aldri kast — vi vil ikke skape feedback-loop
    console.warn("[error-log-service] logError failed:", (err as Error).message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Read API
// ─────────────────────────────────────────────────────────────────────

export interface ListErrorsArgs {
  showResolved?: boolean;
  source?: ErrorSource;
  level?: ErrorLevel;
  endpoint?: string;
  userEmail?: string;
  hoursAgo?: number; // siste N timer
  limit?: number;
}

export async function listErrors(pool: Pool, args: ListErrorsArgs = {}): Promise<LoggedError[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (!args.showResolved) conditions.push("resolved_at IS NULL");
  if (args.source) {
    params.push(args.source);
    conditions.push(`source = $${params.length}`);
  }
  if (args.level) {
    params.push(args.level);
    conditions.push(`level = $${params.length}`);
  }
  if (args.endpoint) {
    params.push(`%${args.endpoint}%`);
    conditions.push(`endpoint ILIKE $${params.length}`);
  }
  if (args.userEmail) {
    params.push(args.userEmail.toLowerCase());
    conditions.push(`LOWER(user_email) = $${params.length}`);
  }
  if (args.hoursAgo && args.hoursAgo > 0) {
    params.push(args.hoursAgo);
    conditions.push(`last_seen_at > NOW() - ($${params.length}::int * INTERVAL '1 hour')`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(args.limit ?? 200);

  const r = await pool.query<ErrorLogRow>(
    `SELECT id::text, level, source, status_code, endpoint, message, error_name, stack,
            fingerprint, user_id, user_email, clarity_session_id,
            ip, user_agent, url, meta, occurrence_count,
            first_seen_at::text, last_seen_at::text,
            resolved_at::text, resolved_by_user_id, resolved_note
       FROM error_log
       ${whereSql}
       ORDER BY last_seen_at DESC
       LIMIT $${params.length}`,
    params,
  );
  return r.rows.map(rowToLogged);
}

export interface ErrorStats {
  total24h: number;
  unresolvedTotal: number;
  bySource: Array<{ source: ErrorSource; count: number }>;
  byStatus: Array<{ statusCode: number; count: number }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}

export async function getErrorStats(pool: Pool): Promise<ErrorStats> {
  const [counts, bySource, byStatus, topEndpoints] = await Promise.all([
    pool.query<{ total_24h: string; unresolved: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '24 hours')::text AS total_24h,
         COUNT(*) FILTER (WHERE resolved_at IS NULL)::text AS unresolved
       FROM error_log`,
    ),
    pool.query<{ source: ErrorSource; count: string }>(
      `SELECT source, COUNT(*)::text AS count
         FROM error_log
        WHERE resolved_at IS NULL AND last_seen_at > NOW() - INTERVAL '24 hours'
        GROUP BY source`,
    ),
    pool.query<{ status_code: number; count: string }>(
      `SELECT status_code, COUNT(*)::text AS count
         FROM error_log
        WHERE resolved_at IS NULL AND status_code IS NOT NULL
          AND last_seen_at > NOW() - INTERVAL '24 hours'
        GROUP BY status_code
        ORDER BY COUNT(*) DESC
        LIMIT 5`,
    ),
    pool.query<{ endpoint: string; count: string }>(
      `SELECT endpoint, COUNT(*)::text AS count
         FROM error_log
        WHERE resolved_at IS NULL AND endpoint IS NOT NULL
          AND last_seen_at > NOW() - INTERVAL '24 hours'
        GROUP BY endpoint
        ORDER BY COUNT(*) DESC
        LIMIT 10`,
    ),
  ]);

  return {
    total24h: Number(counts.rows[0]?.total_24h ?? 0),
    unresolvedTotal: Number(counts.rows[0]?.unresolved ?? 0),
    bySource: bySource.rows.map((r) => ({ source: r.source, count: Number(r.count) })),
    byStatus: byStatus.rows.map((r) => ({ statusCode: r.status_code, count: Number(r.count) })),
    topEndpoints: topEndpoints.rows.map((r) => ({ endpoint: r.endpoint, count: Number(r.count) })),
  };
}

export async function markErrorResolved(
  pool: Pool,
  args: { errorId: string; resolvedByUserId: string; note?: string },
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE error_log
        SET resolved_at = NOW(),
            resolved_by_user_id = $2,
            resolved_note = $3
      WHERE id = $1::uuid AND resolved_at IS NULL`,
    [args.errorId, args.resolvedByUserId, args.note ?? null],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function reopenError(pool: Pool, errorId: string): Promise<boolean> {
  const r = await pool.query(
    `UPDATE error_log SET resolved_at = NULL, resolved_by_user_id = NULL, resolved_note = NULL
      WHERE id = $1::uuid`,
    [errorId],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function deleteError(pool: Pool, errorId: string): Promise<boolean> {
  const r = await pool.query(`DELETE FROM error_log WHERE id = $1::uuid`, [errorId]);
  return (r.rowCount ?? 0) > 0;
}
