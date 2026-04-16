/**
 * Role Room AI consent helper.
 *
 * Backend source of truth for GDPR Art. 6.1a consent. The frontend
 * aiConsentService mirrors this into localStorage for quick UI gating,
 * but every AI call server-side re-checks via `requireActiveConsent()`.
 */

import type { Pool } from 'pg';

export type RoleRoomAiConsentScope = 'brief_only' | 'brief_and_reviews' | 'full_context';
export type RoleRoomAiProcessor = 'cohere' | 'anthropic';

export interface RoleRoomAiConsentRecord {
  id: string;
  projectId: string;
  userId: string;
  scope: RoleRoomAiConsentScope;
  processor: RoleRoomAiProcessor;
  note: string | null;
  grantedAt: Date;
  revokedAt: Date | null;
  excludedEntityIds: string[];
  includedEntityIds: string[];
}

function mapRow(row: any): RoleRoomAiConsentRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    scope: row.scope,
    processor: row.processor,
    note: row.note ?? null,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at ?? null,
    excludedEntityIds: Array.isArray(row.excluded_entity_ids)
      ? row.excluded_entity_ids
      : JSON.parse(row.excluded_entity_ids ?? '[]'),
    includedEntityIds: Array.isArray(row.included_entity_ids)
      ? row.included_entity_ids
      : JSON.parse(row.included_entity_ids ?? '[]'),
  };
}

export async function getActiveConsent(
  pool: Pool,
  projectId: string,
  processor: RoleRoomAiProcessor,
): Promise<RoleRoomAiConsentRecord | null> {
  const result = await pool.query(
    `SELECT * FROM role_room_ai_consent
     WHERE project_id = $1 AND processor = $2 AND revoked_at IS NULL
     ORDER BY granted_at DESC
     LIMIT 1`,
    [projectId, processor],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function grantConsent(
  pool: Pool,
  input: {
    projectId: string;
    userId: string;
    scope: RoleRoomAiConsentScope;
    processor: RoleRoomAiProcessor;
    note?: string;
    excludedEntityIds?: string[];
    includedEntityIds?: string[];
  },
): Promise<RoleRoomAiConsentRecord> {
  // Revoke any existing active consent for the same (project, processor) pair.
  await pool.query(
    `UPDATE role_room_ai_consent
     SET revoked_at = now(), updated_at = now()
     WHERE project_id = $1 AND processor = $2 AND revoked_at IS NULL`,
    [input.projectId, input.processor],
  );

  const result = await pool.query(
    `INSERT INTO role_room_ai_consent (
       project_id, user_id, scope, processor, note,
       excluded_entity_ids, included_entity_ids
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     RETURNING *`,
    [
      input.projectId,
      input.userId,
      input.scope,
      input.processor,
      input.note ?? null,
      JSON.stringify(input.excludedEntityIds ?? []),
      JSON.stringify(input.includedEntityIds ?? []),
    ],
  );
  return mapRow(result.rows[0]);
}

export async function revokeConsent(
  pool: Pool,
  projectId: string,
  processor: RoleRoomAiProcessor,
): Promise<void> {
  await pool.query(
    `UPDATE role_room_ai_consent
     SET revoked_at = now(), updated_at = now()
     WHERE project_id = $1 AND processor = $2 AND revoked_at IS NULL`,
    [projectId, processor],
  );
}

export async function updateEntityLists(
  pool: Pool,
  projectId: string,
  processor: RoleRoomAiProcessor,
  patch: { excludedEntityIds?: string[]; includedEntityIds?: string[] },
): Promise<RoleRoomAiConsentRecord | null> {
  const active = await getActiveConsent(pool, projectId, processor);
  if (!active) return null;
  const result = await pool.query(
    `UPDATE role_room_ai_consent
     SET excluded_entity_ids = $2::jsonb,
         included_entity_ids = $3::jsonb,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      active.id,
      JSON.stringify(patch.excludedEntityIds ?? active.excludedEntityIds),
      JSON.stringify(patch.includedEntityIds ?? active.includedEntityIds),
    ],
  );
  return mapRow(result.rows[0]);
}

/**
 * Middleware-style guard. Throws a typed error if no active consent exists.
 * Callers use this before invoking any Anthropic/Cohere client.
 */
export class RoleRoomAiConsentError extends Error {
  constructor(
    message: string,
    readonly code: 'missing_consent' | 'wrong_scope' | 'entity_excluded',
  ) {
    super(message);
    this.name = 'RoleRoomAiConsentError';
  }
}

const SCOPE_PRIORITY: Record<RoleRoomAiConsentScope, number> = {
  brief_only: 1,
  brief_and_reviews: 2,
  full_context: 3,
};

export async function requireActiveConsent(
  pool: Pool,
  projectId: string,
  processor: RoleRoomAiProcessor,
  requiredScope: RoleRoomAiConsentScope,
): Promise<RoleRoomAiConsentRecord> {
  const active = await getActiveConsent(pool, projectId, processor);
  if (!active) {
    throw new RoleRoomAiConsentError(
      `AI consent missing for project ${projectId} / ${processor}`,
      'missing_consent',
    );
  }
  if (SCOPE_PRIORITY[active.scope] < SCOPE_PRIORITY[requiredScope]) {
    throw new RoleRoomAiConsentError(
      `Active scope '${active.scope}' does not cover required '${requiredScope}'`,
      'wrong_scope',
    );
  }
  return active;
}
