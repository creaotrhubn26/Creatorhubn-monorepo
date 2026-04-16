/**
 * Role Room AI audit helper.
 *
 * Single writer for role_room_ai_audit_log. Every AI call on the backend
 * MUST flow through `logAiCall()` regardless of processor.
 *
 * Rule: never pass prompt content or response content through this module.
 * Only metadata — tokens, field categories, status, error codes.
 */

import type { Pool } from 'pg';

export type RoleRoomAiProcessor = 'cohere' | 'anthropic';

export type RoleRoomAiAuditStatus =
  | 'ok'
  | 'error'
  | 'blocked_by_consent'
  | 'blocked_by_rate_limit';

export interface RoleRoomAiAuditInput {
  projectId: string;
  userId: string;
  consentId?: string | null;
  processor: RoleRoomAiProcessor;
  model: string;
  action: string;
  status: RoleRoomAiAuditStatus;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  latencyMs?: number | null;
  fieldCategories?: string[];
  entityCount?: number;
  emailsScrubbed?: number;
  phonesScrubbed?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export async function logAiCall(pool: Pool, input: RoleRoomAiAuditInput): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO role_room_ai_audit_log (
        project_id, user_id, consent_id,
        processor, model, action, status,
        prompt_tokens, completion_tokens, total_tokens, latency_ms,
        field_categories, entity_count, emails_scrubbed, phones_scrubbed,
        error_code, error_message
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12::jsonb, $13, $14, $15,
        $16, $17
      )`,
      [
        input.projectId,
        input.userId,
        input.consentId ?? null,
        input.processor,
        input.model,
        input.action,
        input.status,
        input.promptTokens ?? null,
        input.completionTokens ?? null,
        input.totalTokens ?? null,
        input.latencyMs ?? null,
        JSON.stringify(input.fieldCategories ?? []),
        input.entityCount ?? 0,
        input.emailsScrubbed ?? 0,
        input.phonesScrubbed ?? 0,
        input.errorCode ?? null,
        input.errorMessage ?? null,
      ],
    );
  } catch (error) {
    // Audit failures must never break the primary request, but are logged so
    // DPO can catch silent drop-offs.
    // eslint-disable-next-line no-console
    console.error('[role-room-ai-audit] Failed to write audit row:', error);
  }
}

/**
 * Retention enforcement. Call from a cron that fires daily; safe to run
 * concurrently with writes because the predicate is on created_at.
 */
export async function pruneAiAuditLog(pool: Pool): Promise<number> {
  const result = await pool.query(
    `DELETE FROM role_room_ai_audit_log
     WHERE created_at < now() - interval '365 days'`,
  );
  return result.rowCount ?? 0;
}

export async function listAiCallsForUser(
  pool: Pool,
  userId: string,
  options?: { limit?: number; projectId?: string },
): Promise<any[]> {
  const params: unknown[] = [userId];
  let whereClause = 'user_id = $1';
  if (options?.projectId) {
    params.push(options.projectId);
    whereClause += ` AND project_id = $${params.length}`;
  }
  const limit = Math.min(options?.limit ?? 100, 500);
  params.push(limit);

  const result = await pool.query(
    `SELECT
       id, project_id, user_id, consent_id,
       processor, model, action, status,
       prompt_tokens, completion_tokens, total_tokens, latency_ms,
       field_categories, entity_count,
       error_code, error_message,
       created_at
     FROM role_room_ai_audit_log
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows;
}
