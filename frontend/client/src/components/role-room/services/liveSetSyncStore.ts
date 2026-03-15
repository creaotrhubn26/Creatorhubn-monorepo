import type { LiveSetEvent, LiveSetSyncQueueItem } from '../types/liveSetContracts';

const DB_NAME = 'creatorhub-live-set';
const DB_VERSION = 1;
const OUTBOX_STORE = 'live_set_outbox';
const META_STORE = 'live_set_meta';
const FALLBACK_KEY = 'liveset:sync:outbox:v2';

interface MetaRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

let openRequest: Promise<IDBDatabase> | null = null;

function nowMs(): number {
  return Date.now();
}

function buildQueueItem(event: LiveSetEvent): LiveSetSyncQueueItem {
  const timestamp = nowMs();
  return {
    eventId: event.eventId,
    sessionId: event.sessionId,
    projectId: event.projectId,
    seq: event.seq,
    type: event.type,
    payload: event.payload as Record<string, unknown>,
    capturedAt: event.capturedAt,
    deviceId: event.deviceId,
    operatorId: event.operatorId,
    shootingDayId: event.shootingDayId,
    status: 'pending',
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function isIndexedDbSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function readFallbackItems(): LiveSetSyncQueueItem[] {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LiveSetSyncQueueItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

function writeFallbackItems(items: LiveSetSyncQueueItem[]): void {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(items.slice(-5000)));
  } catch {
    // noop
  }
}

function withStore<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    executor(store, tx).then(resolve).catch(reject);
    tx.onerror = () => reject(tx.error ?? new Error(`IDB tx error for ${storeName}`));
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbSupported()) {
    throw new Error('indexedDB not supported');
  }
  if (openRequest) return openRequest;

  openRequest = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: 'eventId' });
        store.createIndex('by_project_status', ['projectId', 'status'], { unique: false });
        store.createIndex('by_session_seq', ['sessionId', 'seq'], { unique: false });
        store.createIndex('by_next_retry', 'nextRetryAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open indexedDB'));
  });

  return openRequest;
}

async function idbGetAllItems(): Promise<LiveSetSyncQueueItem[]> {
  const db = await openDatabase();
  return withStore<LiveSetSyncQueueItem[]>(db, OUTBOX_STORE, 'readonly', async (store) => {
    return await new Promise<LiveSetSyncQueueItem[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result ?? []) as LiveSetSyncQueueItem[]);
      request.onerror = () => reject(request.error ?? new Error('Failed to read IDB outbox'));
    });
  });
}

async function idbPutItems(items: LiveSetSyncQueueItem[]): Promise<void> {
  if (!items.length) return;
  const db = await openDatabase();
  await withStore<void>(db, OUTBOX_STORE, 'readwrite', async (store) => {
    await Promise.all(items.map((item) => new Promise<void>((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error(`Failed to upsert ${item.eventId}`));
    })));
  });
}

async function idbDeleteItems(eventIds: string[]): Promise<void> {
  if (!eventIds.length) return;
  const db = await openDatabase();
  await withStore<void>(db, OUTBOX_STORE, 'readwrite', async (store) => {
    await Promise.all(eventIds.map((eventId) => new Promise<void>((resolve, reject) => {
      const request = store.delete(eventId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error(`Failed to delete ${eventId}`));
    })));
  });
}

async function idbPutMeta(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  const record: MetaRecord = { key, value, updatedAt: nowMs() };
  await withStore<void>(db, META_STORE, 'readwrite', async (store) => {
    await new Promise<void>((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error(`Failed to write meta ${key}`));
    });
  });
}

async function idbGetMeta<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  return withStore<T | null>(db, META_STORE, 'readonly', async (store) => {
    return await new Promise<T | null>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const value = request.result as MetaRecord | undefined;
        resolve((value?.value as T | undefined) ?? null);
      };
      request.onerror = () => reject(request.error ?? new Error(`Failed to read meta ${key}`));
    });
  });
}

async function readAllItems(): Promise<LiveSetSyncQueueItem[]> {
  if (!isIndexedDbSupported()) return readFallbackItems();
  try {
    return await idbGetAllItems();
  } catch {
    return readFallbackItems();
  }
}

async function writeItems(items: LiveSetSyncQueueItem[]): Promise<void> {
  if (!isIndexedDbSupported()) {
    writeFallbackItems(items);
    return;
  }
  try {
    await idbPutItems(items);
  } catch {
    writeFallbackItems(items);
  }
}

export async function enqueueLiveSetEvent(event: LiveSetEvent): Promise<LiveSetSyncQueueItem> {
  const item = buildQueueItem(event);
  if (!isIndexedDbSupported()) {
    const next = [...readFallbackItems().filter((entry) => entry.eventId !== item.eventId), item];
    writeFallbackItems(next);
    return item;
  }
  try {
    await idbPutItems([item]);
    return item;
  } catch {
    const next = [...readFallbackItems().filter((entry) => entry.eventId !== item.eventId), item];
    writeFallbackItems(next);
    return item;
  }
}

export async function getLiveSetQueueDepth(projectId: string): Promise<number> {
  const items = await readAllItems();
  return items.filter((item) => item.projectId === projectId && item.status !== 'acked').length;
}

export async function getPendingLiveSetQueue(
  projectId: string,
  limit = 100,
  atMs = nowMs(),
): Promise<LiveSetSyncQueueItem[]> {
  const items = await readAllItems();
  return items
    .filter((item) => (
      item.projectId === projectId
      && item.status !== 'acked'
      && (item.nextRetryAt == null || item.nextRetryAt <= atMs)
    ))
    .sort((left, right) => left.seq - right.seq)
    .slice(0, Math.max(1, limit));
}

export async function markLiveSetQueueSyncing(eventIds: string[]): Promise<void> {
  if (!eventIds.length) return;
  const items = await readAllItems();
  const selected = new Set(eventIds);
  const next: LiveSetSyncQueueItem[] = items.map((item) => (
    selected.has(item.eventId)
      ? { ...item, status: 'syncing' as const, updatedAt: nowMs() }
      : item
  ));
  await writeItems(next);
}

export async function markLiveSetQueueAcked(eventIds: string[]): Promise<void> {
  if (!eventIds.length) return;
  if (isIndexedDbSupported()) {
    try {
      await idbDeleteItems(eventIds);
      const fallback = readFallbackItems().filter((item) => !eventIds.includes(item.eventId));
      writeFallbackItems(fallback);
      return;
    } catch {
      // fall through to local fallback update
    }
  }
  const fallback = readFallbackItems().filter((item) => !eventIds.includes(item.eventId));
  writeFallbackItems(fallback);
}

export async function markLiveSetQueueFailed(
  failures: Array<{ eventId: string; error: string; nextRetryAt: number }>,
): Promise<void> {
  if (!failures.length) return;
  const failureMap = new Map(failures.map((entry) => [entry.eventId, entry]));
  const items = await readAllItems();
  const next: LiveSetSyncQueueItem[] = items.map((item) => {
    const failure = failureMap.get(item.eventId);
    if (!failure) return item;
    return {
      ...item,
      status: 'failed' as const,
      attempts: item.attempts + 1,
      lastError: failure.error,
      nextRetryAt: failure.nextRetryAt,
      updatedAt: nowMs(),
    };
  });
  await writeItems(next);
}

export async function upsertLiveSetQueueItems(items: LiveSetSyncQueueItem[]): Promise<void> {
  if (!items.length) return;
  await writeItems(items.map((item) => ({ ...item, updatedAt: nowMs() })));
}

export async function setLiveSetSyncMeta(key: string, value: unknown): Promise<void> {
  if (!isIndexedDbSupported()) {
    const storageKey = `${FALLBACK_KEY}:meta:${key}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // noop
    }
    return;
  }
  try {
    await idbPutMeta(key, value);
  } catch {
    const storageKey = `${FALLBACK_KEY}:meta:${key}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // noop
    }
  }
}

export async function getLiveSetSyncMeta<T>(key: string): Promise<T | null> {
  if (!isIndexedDbSupported()) {
    const storageKey = `${FALLBACK_KEY}:meta:${key}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  try {
    return await idbGetMeta<T>(key);
  } catch {
    const storageKey = `${FALLBACK_KEY}:meta:${key}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}

export async function listLiveSetSessionItems(projectId: string, sessionId: string): Promise<LiveSetSyncQueueItem[]> {
  const items = await readAllItems();
  return items
    .filter((item) => item.projectId === projectId && item.sessionId === sessionId)
    .sort((left, right) => left.seq - right.seq);
}

export async function clearLiveSetProjectQueue(projectId: string): Promise<void> {
  const items = await readAllItems();
  const keep = items.filter((item) => item.projectId !== projectId);
  if (isIndexedDbSupported()) {
    try {
      const removeIds = items.filter((item) => item.projectId === projectId).map((item) => item.eventId);
      await idbDeleteItems(removeIds);
    } catch {
      // noop
    }
  }
  writeFallbackItems(keep.filter((item) => item.status !== 'acked'));
}
