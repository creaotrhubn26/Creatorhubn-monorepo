/**
 * HTTP client for /api/role-room/projects/:projectId/ai-consent.
 *
 * The backend is the source of truth for GDPR consent — localStorage in
 * aiConsentService is only a cache so the UI can render synchronously.
 * This module owns all network calls.
 */

import authSessionService from './authSessionService';
import type { AiConsentRecord, AiConsentScope } from './aiConsentService';

const API_BASE = '/api/role-room';

export type RoleRoomAiProcessor = 'cohere' | 'anthropic';

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const sessionHeaders = authSessionService.getAuthHeadersSync?.() ?? {};
  Object.assign(headers, sessionHeaders);
  const session = authSessionService.getSessionSync?.();
  const userId = session?.currentUserId;
  if (typeof userId === 'string' && userId.trim().length > 0) {
    headers['x-role-room-user-id'] = userId.trim();
  }
  return headers;
}

interface BackendConsentRow {
  id: string;
  projectId: string;
  userId: string;
  scope: AiConsentScope;
  processor: RoleRoomAiProcessor;
  note: string | null;
  grantedAt: string;
  revokedAt: string | null;
  excludedEntityIds: string[];
  includedEntityIds: string[];
}

function toCache(row: BackendConsentRow | null, fallbackUserId: string): AiConsentRecord | null {
  if (!row) return null;
  return {
    projectId: row.projectId,
    scope: row.scope,
    grantedByUserId: row.userId || fallbackUserId,
    grantedAt: typeof row.grantedAt === 'string' ? row.grantedAt : new Date().toISOString(),
    excludedEntityIds: row.excludedEntityIds,
    includedEntityIds: row.includedEntityIds,
    note: row.note ?? undefined,
  };
}

export async function fetchActiveConsent(
  projectId: string,
  processor: RoleRoomAiProcessor,
  fallbackUserId: string,
): Promise<AiConsentRecord | null> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/ai-consent?processor=${processor}`,
    { headers: buildHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Failed to load AI consent (${response.status})`);
  }
  const body = await response.json();
  return toCache(body.consent as BackendConsentRow | null, fallbackUserId);
}

export async function postGrantConsent(input: {
  projectId: string;
  userId: string;
  scope: AiConsentScope;
  processor: RoleRoomAiProcessor;
  note?: string;
  excludedEntityIds?: string[];
  includedEntityIds?: string[];
}): Promise<AiConsentRecord> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/ai-consent`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        scope: input.scope,
        processor: input.processor,
        note: input.note,
        excludedEntityIds: input.excludedEntityIds,
        includedEntityIds: input.includedEntityIds,
      }),
    },
  );
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`Failed to grant AI consent (${response.status}): ${raw}`);
  }
  const body = await response.json();
  const record = toCache(body.consent as BackendConsentRow, input.userId);
  if (!record) throw new Error('Consent grant returned no record');
  return record;
}

export async function deleteConsent(
  projectId: string,
  processor: RoleRoomAiProcessor,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/ai-consent?processor=${processor}`,
    { method: 'DELETE', headers: buildHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Failed to revoke AI consent (${response.status})`);
  }
}

export async function patchEntityLists(
  projectId: string,
  processor: RoleRoomAiProcessor,
  patch: { excludedEntityIds?: string[]; includedEntityIds?: string[] },
  fallbackUserId: string,
): Promise<AiConsentRecord | null> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/ai-consent/entities?processor=${processor}`,
    {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(patch),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to update entity lists (${response.status})`);
  }
  const body = await response.json();
  return toCache(body.consent as BackendConsentRow, fallbackUserId);
}

export async function fetchMyAiInteractions(options?: {
  projectId?: string;
  limit?: number;
}): Promise<Array<Record<string, unknown>>> {
  const params = new URLSearchParams();
  if (options?.projectId) params.set('projectId', options.projectId);
  if (options?.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  const response = await fetch(
    `${API_BASE}/me/ai-interactions${qs ? `?${qs}` : ''}`,
    { headers: buildHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Failed to load AI interactions (${response.status})`);
  }
  const body = await response.json();
  return Array.isArray(body.interactions) ? body.interactions : [];
}
