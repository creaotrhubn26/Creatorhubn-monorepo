import { isWorkspaceParticipantCompensationMetadata } from "@shared/workspace-participant-compensation";

export interface WorkspaceSplitSheetCacheMetadata {
  source?: unknown;
  visibility?: unknown;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Participant compensation sheets contain external-person PII and financial
 * terms. They are API-only and must never enter the legacy local cache.
 */
export function isPrivateWorkspaceParticipantCompensationSheet(
  value: WorkspaceSplitSheetCacheMetadata | null | undefined,
): boolean {
  // Fail closed on the managed source even if a malformed/older API response
  // drops visibility. This does not change caching for any other sheet type.
  return isWorkspaceParticipantCompensationMetadata(value);
}

export function workspaceSplitSheetsSafeForLocalCache<
  T extends WorkspaceSplitSheetCacheMetadata,
>(entries: readonly T[]): T[] {
  return entries.filter(
    (entry) => !isPrivateWorkspaceParticipantCompensationSheet(entry),
  );
}

export function workspaceSplitSheetLegacyCacheKey(projectId: string): string {
  return `split-sheet-entries-${projectId}`;
}

export function workspaceSplitSheetCacheKey(input: {
  projectId: string;
  userId?: string;
}): string | null {
  const projectId = input.projectId.trim();
  const userId = input.userId?.trim() ?? "";
  if (!projectId || !userId) return null;
  return `split-sheet-entries-v2-${encodeURIComponent(userId)}-${encodeURIComponent(projectId)}`;
}

export function initializeWorkspaceSplitSheetCache<
  T extends WorkspaceSplitSheetCacheMetadata,
>(
  storage: StorageLike,
  input: { projectId: string; userId?: string },
): { key: string | null; entries: T[] } {
  // The legacy key was only project-scoped and could cross account boundaries.
  storage.removeItem(workspaceSplitSheetLegacyCacheKey(input.projectId));
  const key = workspaceSplitSheetCacheKey(input);
  if (!key) return { key: null, entries: [] };

  const raw = storage.getItem(key);
  if (!raw) return { key, entries: [] };
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return { key, entries: [] };
  const entries = workspaceSplitSheetsSafeForLocalCache(
    parsed.filter((entry): entry is T => !!entry && typeof entry === "object"),
  );
  if (entries.length !== parsed.length) {
    storage.setItem(key, JSON.stringify(entries));
  }
  return { key, entries };
}

export function persistWorkspaceSplitSheetCache<
  T extends WorkspaceSplitSheetCacheMetadata,
>(storage: StorageLike, key: string | null, entries: readonly T[]): void {
  if (!key) return;
  storage.setItem(
    key,
    JSON.stringify(workspaceSplitSheetsSafeForLocalCache(entries)),
  );
}
