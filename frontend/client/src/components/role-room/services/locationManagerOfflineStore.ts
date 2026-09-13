import type { LocationManagerOperations } from '../models/casting';

export interface PendingLocationOperation {
  id: string;
  projectId: string;
  locationId: string;
  expectedVersion: number;
  operations: LocationManagerOperations;
  createdAt: string;
  attempts: number;
}

const DB_NAME = 'role-room-location-manager';
const DB_VERSION = 1;
const STORE_NAME = 'pending-operations';
const FALLBACK_KEY = 'role-room:location-manager:pending:v1';

const operationId = (projectId: string, locationId: string) => `${projectId}:${locationId}`;

function readFallback(): PendingLocationOperation[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFallback(items: PendingLocationOperation[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(items));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB er ikke tilgjengelig.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Kunne ikke åpne lokal feltlagring.'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function runStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Lokal feltlagring feilet.'));
    };
    operation(transaction.objectStore(STORE_NAME), resolve, reject);
  });
}

async function listFromDatabase(): Promise<PendingLocationOperation[]> {
  return runStore<PendingLocationOperation[]>('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as PendingLocationOperation[]);
    request.onerror = () => reject(request.error);
  });
}

export const locationManagerOfflineStore = {
  async list(projectId?: string): Promise<PendingLocationOperation[]> {
    let items: PendingLocationOperation[];
    try {
      items = await listFromDatabase();
    } catch {
      items = readFallback();
    }
    return items
      .filter((item) => !projectId || item.projectId === projectId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  },

  async put(input: Omit<PendingLocationOperation, 'id' | 'createdAt' | 'attempts'>): Promise<PendingLocationOperation> {
    const id = operationId(input.projectId, input.locationId);
    const existing = (await this.list()).find((item) => item.id === id);
    const item: PendingLocationOperation = {
      ...input,
      id,
      expectedVersion: existing?.expectedVersion ?? input.expectedVersion,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      attempts: existing?.attempts ?? 0,
    };
    try {
      await runStore<void>('readwrite', (store, resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      const items = readFallback().filter((entry) => entry.id !== id);
      writeFallback([...items, item]);
    }
    return item;
  },

  async remove(id: string): Promise<void> {
    try {
      await runStore<void>('readwrite', (store, resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      writeFallback(readFallback().filter((entry) => entry.id !== id));
    }
  },

  async incrementAttempts(item: PendingLocationOperation): Promise<void> {
    const updated = { ...item, attempts: item.attempts + 1 };
    try {
      await runStore<void>('readwrite', (store, resolve, reject) => {
        const request = store.put(updated);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      const items = readFallback().filter((entry) => entry.id !== item.id);
      writeFallback([...items, updated]);
    }
  },
};
