/**
 * AI consent service for The Role Room (frontend).
 *
 * GDPR Art. 6.1a (consent), Art. 7 (conditions for consent), Art. 13 (info
 * to data subject).
 *
 * Architecture:
 *   - Backend (role_room_ai_consent table) is the source of truth.
 *   - In-memory + localStorage cache lets components render synchronously
 *     without awaiting the network on every keystroke.
 *   - Mutations (grantProjectConsent / revokeProjectConsent /
 *     setEntityOverride) are ASYNC and post to the backend before
 *     updating the cache. Sync read helpers return the cached record.
 *
 * Callers MUST invoke `hydrateProjectConsent(projectId, userId)` once per
 * project load so the cache reflects the server. Until hydrated, sync reads
 * return stale localStorage data (or null) — this is acceptable because the
 * backend also re-validates every AI call server-side, so UI showing the
 * wrong state for a few hundred ms cannot lead to an unauthorised
 * processing of PII.
 */

import {
  deleteConsent,
  fetchActiveConsent,
  patchEntityLists,
  postGrantConsent,
  type RoleRoomAiProcessor,
} from './roleRoomAiConsentApi';

const STORAGE_KEY = 'role-room:ai-consent:v1';

export type AiConsentScope = 'brief_only' | 'brief_and_reviews' | 'full_context';

export interface AiConsentRecord {
  projectId: string;
  scope: AiConsentScope;
  grantedByUserId: string;
  grantedAt: string;
  excludedEntityIds?: string[];
  includedEntityIds?: string[];
  note?: string;
}

type ConsentStore = Record<string, AiConsentRecord>;

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStore(): ConsentStore {
  const s = storage();
  if (!s) return {};
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as ConsentStore;
  } catch {
    return {};
  }
}

function writeStore(store: ConsentStore): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota errors */
  }
}

function putCache(record: AiConsentRecord | null, projectId: string): void {
  const store = readStore();
  if (record) {
    store[projectId] = record;
  } else {
    delete store[projectId];
  }
  writeStore(store);
}

/**
 * Pull the active consent from the backend into the cache. Returns the
 * record (or null) so callers can reflect the state immediately.
 */
export async function hydrateProjectConsent(
  projectId: string,
  userId: string,
  processor: RoleRoomAiProcessor = 'anthropic',
): Promise<AiConsentRecord | null> {
  try {
    const record = await fetchActiveConsent(projectId, processor, userId);
    putCache(record, projectId);
    return record;
  } catch (error) {
    // Network error: preserve existing cache entry if any. Log so the
    // transparency UI can warn the user.
    // eslint-disable-next-line no-console
    console.warn('[aiConsentService] hydrate failed — using cached state', error);
    return readStore()[projectId] ?? null;
  }
}

export function getProjectConsent(projectId: string): AiConsentRecord | null {
  return readStore()[projectId] ?? null;
}

export async function grantProjectConsent(
  input: Omit<AiConsentRecord, 'grantedAt'> & {
    grantedAt?: string;
    processor?: RoleRoomAiProcessor;
  },
): Promise<AiConsentRecord> {
  const processor = input.processor ?? 'anthropic';
  const record = await postGrantConsent({
    projectId: input.projectId,
    userId: input.grantedByUserId,
    scope: input.scope,
    processor,
    note: input.note,
    excludedEntityIds: input.excludedEntityIds,
    includedEntityIds: input.includedEntityIds,
  });
  putCache(record, input.projectId);
  return record;
}

export async function revokeProjectConsent(
  projectId: string,
  processor: RoleRoomAiProcessor = 'anthropic',
): Promise<void> {
  await deleteConsent(projectId, processor);
  putCache(null, projectId);
}

export function isEntityAllowed(projectId: string, entityId: string): boolean {
  const record = readStore()[projectId];
  if (!record) return false;
  if (record.excludedEntityIds?.includes(entityId)) return false;
  return true;
}

export async function setEntityOverride(
  projectId: string,
  entityId: string,
  state: 'include' | 'exclude' | 'clear',
  userId: string,
  processor: RoleRoomAiProcessor = 'anthropic',
): Promise<void> {
  const current = readStore()[projectId];
  if (!current) return;
  const included = new Set(current.includedEntityIds ?? []);
  const excluded = new Set(current.excludedEntityIds ?? []);
  if (state === 'clear') {
    included.delete(entityId);
    excluded.delete(entityId);
  } else if (state === 'include') {
    included.add(entityId);
    excluded.delete(entityId);
  } else {
    excluded.add(entityId);
    included.delete(entityId);
  }
  const nextIncluded = Array.from(included);
  const nextExcluded = Array.from(excluded);
  const record = await patchEntityLists(
    projectId,
    processor,
    { includedEntityIds: nextIncluded, excludedEntityIds: nextExcluded },
    userId,
  );
  putCache(record, projectId);
}

/**
 * Filter a list of entities down to the ones whose PII is allowed to be sent
 * to the Role Room Agent for this project.
 */
export function filterConsentedEntities<T extends { id: string }>(
  projectId: string,
  entities: T[],
): T[] {
  const record = readStore()[projectId];
  if (!record) return [];
  const excluded = new Set(record.excludedEntityIds ?? []);
  return entities.filter((entity) => !excluded.has(entity.id));
}
