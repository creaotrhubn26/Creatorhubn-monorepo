export type ScreenplayRecoveryReason = 'opened' | 'autosave' | 'manual' | 'before_restore';

export interface ScreenplayRecoveryPoint {
  id: string;
  createdAt: string;
  content: string;
  reason: ScreenplayRecoveryReason;
}

export interface ScreenplayRecoveryStore {
  version: 1;
  manuscriptId: string;
  draft: {
    content: string;
    updatedAt: string;
  };
  points: ScreenplayRecoveryPoint[];
  lastSnapshotAt: string;
}

interface RecoveryOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  now?: Date;
  forceSnapshot?: boolean;
  snapshotReason?: ScreenplayRecoveryReason;
}

const STORAGE_PREFIX = 'role_room_screenplay_recovery_v1';
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
const MAX_POINTS = 12;
const MAX_TOTAL_CONTENT_CHARS = 1_500_000;

const resolveStorage = (
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null => {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

const recoveryKey = (manuscriptId: string, userId: string): string =>
  `${STORAGE_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(manuscriptId)}`;

const createPoint = (
  manuscriptId: string,
  content: string,
  createdAt: string,
  reason: ScreenplayRecoveryReason,
): ScreenplayRecoveryPoint => ({
  id: `${manuscriptId}:${createdAt}:${reason}:${Math.random().toString(36).slice(2, 8)}`,
  createdAt,
  content,
  reason,
});

const prunePoints = (points: ScreenplayRecoveryPoint[]): ScreenplayRecoveryPoint[] => {
  const result: ScreenplayRecoveryPoint[] = [];
  let totalCharacters = 0;

  for (const point of points) {
    if (result.length >= MAX_POINTS) break;
    if (result.some((entry) => entry.content === point.content)) continue;
    if (result.length > 0 && totalCharacters + point.content.length > MAX_TOTAL_CONTENT_CHARS) break;
    result.push(point);
    totalCharacters += point.content.length;
  }

  return result;
};

const isRecoveryReason = (value: unknown): value is ScreenplayRecoveryReason =>
  value === 'opened' || value === 'autosave' || value === 'manual' || value === 'before_restore';

const sanitizeStore = (value: unknown, manuscriptId: string): ScreenplayRecoveryStore | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<ScreenplayRecoveryStore>;
  if (candidate.version !== 1 || candidate.manuscriptId !== manuscriptId) return null;
  if (!candidate.draft || typeof candidate.draft.content !== 'string' || typeof candidate.draft.updatedAt !== 'string') {
    return null;
  }
  if (!Array.isArray(candidate.points) || typeof candidate.lastSnapshotAt !== 'string') return null;

  const points = candidate.points.filter((point): point is ScreenplayRecoveryPoint => Boolean(
    point
    && typeof point === 'object'
    && typeof point.id === 'string'
    && typeof point.createdAt === 'string'
    && typeof point.content === 'string'
    && isRecoveryReason(point.reason),
  ));

  return {
    version: 1,
    manuscriptId,
    draft: candidate.draft,
    points: prunePoints(points),
    lastSnapshotAt: candidate.lastSnapshotAt,
  };
};

const writeStore = (
  store: ScreenplayRecoveryStore,
  userId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): ScreenplayRecoveryStore => {
  const target = resolveStorage(storage);
  if (!target) return store;
  target.setItem(recoveryKey(store.manuscriptId, userId), JSON.stringify(store));
  return store;
};

export function loadScreenplayRecovery(
  manuscriptId: string,
  userId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): ScreenplayRecoveryStore | null {
  const target = resolveStorage(storage);
  if (!target || !manuscriptId) return null;
  try {
    const raw = target.getItem(recoveryKey(manuscriptId, userId));
    return raw ? sanitizeStore(JSON.parse(raw), manuscriptId) : null;
  } catch {
    return null;
  }
}

export function initializeScreenplayRecovery(
  manuscriptId: string,
  userId: string,
  content: string,
  options: RecoveryOptions = {},
): ScreenplayRecoveryStore {
  const existing = loadScreenplayRecovery(manuscriptId, userId, options.storage);
  if (existing) return existing;
  const createdAt = (options.now ?? new Date()).toISOString();
  return writeStore({
    version: 1,
    manuscriptId,
    draft: { content, updatedAt: createdAt },
    points: content ? [createPoint(manuscriptId, content, createdAt, 'opened')] : [],
    lastSnapshotAt: createdAt,
  }, userId, options.storage);
}

export function persistScreenplayRecovery(
  manuscriptId: string,
  userId: string,
  content: string,
  options: RecoveryOptions = {},
): ScreenplayRecoveryStore {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const current = initializeScreenplayRecovery(manuscriptId, userId, content, options);
  if (current.draft.content === content) return current;

  const snapshotAge = now.getTime() - new Date(current.lastSnapshotAt).getTime();
  const shouldSnapshot = Boolean(options.forceSnapshot) || snapshotAge >= SNAPSHOT_INTERVAL_MS;
  const points = shouldSnapshot && current.draft.content
    ? prunePoints([
        createPoint(
          manuscriptId,
          current.draft.content,
          current.draft.updatedAt,
          options.snapshotReason ?? 'autosave',
        ),
        ...current.points,
      ])
    : current.points;

  return writeStore({
    ...current,
    draft: { content, updatedAt: nowIso },
    points,
    lastSnapshotAt: shouldSnapshot ? nowIso : current.lastSnapshotAt,
  }, userId, options.storage);
}

export function addScreenplayRecoveryPoint(
  manuscriptId: string,
  userId: string,
  content: string,
  reason: ScreenplayRecoveryReason = 'manual',
  options: RecoveryOptions = {},
): ScreenplayRecoveryStore {
  const nowIso = (options.now ?? new Date()).toISOString();
  const current = initializeScreenplayRecovery(manuscriptId, userId, content, options);
  const point = createPoint(manuscriptId, content, nowIso, reason);
  return writeStore({
    ...current,
    draft: { content, updatedAt: nowIso },
    points: prunePoints([point, ...current.points]),
    lastSnapshotAt: nowIso,
  }, userId, options.storage);
}

export function clearScreenplayRecovery(
  manuscriptId: string,
  userId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): void {
  resolveStorage(storage)?.removeItem(recoveryKey(manuscriptId, userId));
}
