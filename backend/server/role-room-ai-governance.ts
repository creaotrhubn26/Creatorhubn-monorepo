/**
 * DPO governance helper — admin-only read-only views over the AI
 * footprint: consents, audit log summary, usage per project.
 *
 * All queries aggregate via SQL; nothing returns prompt content or
 * personal data in responses so the view is safe to expose to an
 * admin session (not the DPO seat). A typed admin guard at the route
 * level enforces access.
 */

import type { Pool } from 'pg';

export interface AiGovernanceOverview {
  activeConsents: number;
  consentsByScope: Array<{ scope: string; count: number }>;
  calls24h: {
    total: number;
    ok: number;
    blocked_by_consent: number;
    blocked_by_rate_limit: number;
    errored: number;
    cacheHits: number;
    promptTokens: number;
    completionTokens: number;
  };
  callsByProject24h: Array<{
    projectId: string;
    calls: number;
    promptTokens: number;
    completionTokens: number;
    cacheHits: number;
  }>;
  callsByModel24h: Array<{ model: string; calls: number }>;
  topErrors24h: Array<{ errorCode: string | null; count: number }>;
}

export async function getAiGovernanceOverview(pool: Pool): Promise<AiGovernanceOverview> {
  const consentsResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE revoked_at IS NULL) AS active,
       scope, COUNT(*) AS count
     FROM role_room_ai_consent
     WHERE revoked_at IS NULL
     GROUP BY ROLLUP (scope)`,
  );
  const activeConsents = Number(
    consentsResult.rows.find((row: any) => row.scope == null)?.count ?? 0,
  );
  const consentsByScope = consentsResult.rows
    .filter((row: any) => row.scope != null)
    .map((row: any) => ({ scope: String(row.scope), count: Number(row.count) }));

  const callsResult = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'ok') AS ok,
       COUNT(*) FILTER (WHERE status = 'blocked_by_consent') AS blocked_by_consent,
       COUNT(*) FILTER (WHERE status = 'blocked_by_rate_limit') AS blocked_by_rate_limit,
       COUNT(*) FILTER (WHERE status = 'error') AS errored,
       COUNT(*) FILTER (WHERE field_categories ? 'cache_hit') AS cache_hits,
       COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
       COALESCE(SUM(completion_tokens), 0) AS completion_tokens
     FROM role_room_ai_audit_log
     WHERE created_at > now() - interval '24 hours'`,
  );
  const calls = callsResult.rows[0] ?? {};

  const byProjectResult = await pool.query(
    `SELECT
       project_id,
       COUNT(*) AS calls,
       COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
       COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
       COUNT(*) FILTER (WHERE field_categories ? 'cache_hit') AS cache_hits
     FROM role_room_ai_audit_log
     WHERE created_at > now() - interval '24 hours'
     GROUP BY project_id
     ORDER BY calls DESC
     LIMIT 20`,
  );

  const byModelResult = await pool.query(
    `SELECT model, COUNT(*) AS calls
     FROM role_room_ai_audit_log
     WHERE created_at > now() - interval '24 hours'
     GROUP BY model
     ORDER BY calls DESC
     LIMIT 10`,
  );

  const topErrorsResult = await pool.query(
    `SELECT error_code, COUNT(*) AS count
     FROM role_room_ai_audit_log
     WHERE status = 'error' AND created_at > now() - interval '24 hours'
     GROUP BY error_code
     ORDER BY count DESC
     LIMIT 10`,
  );

  return {
    activeConsents,
    consentsByScope,
    calls24h: {
      total: Number(calls.total ?? 0),
      ok: Number(calls.ok ?? 0),
      blocked_by_consent: Number(calls.blocked_by_consent ?? 0),
      blocked_by_rate_limit: Number(calls.blocked_by_rate_limit ?? 0),
      errored: Number(calls.errored ?? 0),
      cacheHits: Number(calls.cache_hits ?? 0),
      promptTokens: Number(calls.prompt_tokens ?? 0),
      completionTokens: Number(calls.completion_tokens ?? 0),
    },
    callsByProject24h: byProjectResult.rows.map((row: any) => ({
      projectId: row.project_id,
      calls: Number(row.calls),
      promptTokens: Number(row.prompt_tokens),
      completionTokens: Number(row.completion_tokens),
      cacheHits: Number(row.cache_hits),
    })),
    callsByModel24h: byModelResult.rows.map((row: any) => ({
      model: row.model,
      calls: Number(row.calls),
    })),
    topErrors24h: topErrorsResult.rows.map((row: any) => ({
      errorCode: row.error_code ?? null,
      count: Number(row.count),
    })),
  };
}

export async function getConsentList(
  pool: Pool,
  options?: { limit?: number; includeRevoked?: boolean },
): Promise<Array<{
  id: string;
  projectId: string;
  userId: string;
  scope: string;
  processor: string;
  grantedAt: Date;
  revokedAt: Date | null;
  note: string | null;
}>> {
  const limit = Math.min(options?.limit ?? 100, 500);
  const where = options?.includeRevoked ? '' : 'WHERE revoked_at IS NULL';
  const result = await pool.query(
    `SELECT id, project_id, user_id, scope, processor, granted_at, revoked_at, note
     FROM role_room_ai_consent
     ${where}
     ORDER BY granted_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    scope: row.scope,
    processor: row.processor,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at ?? null,
    note: row.note ?? null,
  }));
}

export async function getAuditTrail(
  pool: Pool,
  options?: { limit?: number; projectId?: string; status?: string },
): Promise<Array<Record<string, unknown>>> {
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (options?.projectId) {
    params.push(options.projectId);
    clauses.push(`project_id = $${params.length}`);
  }
  if (options?.status) {
    params.push(options.status);
    clauses.push(`status = $${params.length}`);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(options?.limit ?? 100, 1000);
  params.push(limit);
  const result = await pool.query(
    `SELECT id, project_id, user_id, processor, model, action, status,
            prompt_tokens, completion_tokens, total_tokens, latency_ms,
            field_categories, entity_count,
            error_code, error_message, created_at
     FROM role_room_ai_audit_log
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows;
}
