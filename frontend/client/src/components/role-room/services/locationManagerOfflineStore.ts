import type { LocationManagerOperations } from '../models/casting';
import type { LocationScoutMediaUpload } from './locationManagerService';

export interface PendingLocationOperation {
  id: string;
  projectId: string;
  locationId: string;
  expectedVersion: number;
  operations: LocationManagerOperations;
  createdAt: string;
  attempts: number;
}

export interface PendingLocationMedia {
  id: string;
  projectId: string;
  locationId: string;
  displayName: string;
  contentType: string;
  sizeBytes: number;
  /**
   * New queue entries use ArrayBuffer because WebKit may reject Blob/File values
   * in IndexedDB. Blob remains accepted so existing version-2 queues still sync.
   */
  blob: Blob | ArrayBuffer;
  upload: LocationScoutMediaUpload;
  createdAt: string;
  attempts: number;
}

const DB_NAME = 'role-room-location-manager';
const DB_VERSION = 2;
const OPERATIONS_STORE_NAME = 'pending-operations';
const MEDIA_STORE_NAME = 'pending-media';
const FALLBACK_KEY = 'role-room:location-manager:pending:v1';

let databasePromise: Promise<IDBDatabase> | null = null;

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
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      databasePromise = null;
      reject(new Error('IndexedDB er ikke tilgjengelig.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error('Kunne ikke åpne lokal feltlagring.'));
    };
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OPERATIONS_STORE_NAME)) {
        const store = database.createObjectStore(OPERATIONS_STORE_NAME, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
      if (!database.objectStoreNames.contains(MEDIA_STORE_NAME)) {
        const store = database.createObjectStore(MEDIA_STORE_NAME, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
  });
  return databasePromise;
}

async function runStore<T>(
  storeName: typeof OPERATIONS_STORE_NAME | typeof MEDIA_STORE_NAME,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let operationCompleted = false;
    let operationValue: T;
    let settled = false;
    const fail = (reason?: unknown) => {
      if (settled) return;
      settled = true;
      reject(reason ?? new Error('Lokal feltlagring feilet.'));
    };
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(storeName, mode);
    } catch (error) {
      databasePromise = null;
      database.close();
      fail(error);
      return;
    }
    transaction.oncomplete = () => {
      if (settled) return;
      if (!operationCompleted) {
        fail(new Error('Lokal feltlagring ble avsluttet uten et resultat.'));
        return;
      }
      settled = true;
      resolve(operationValue);
    };
    transaction.onerror = () => fail(transaction.error ?? new Error('Lokal feltlagring feilet.'));
    transaction.onabort = () => fail(transaction.error ?? new Error('Lokal feltlagring ble avbrutt.'));
    try {
      operation(
        transaction.objectStore(storeName),
        (value) => {
          operationValue = value;
          operationCompleted = true;
        },
        (reason) => {
          try {
            transaction.abort();
          } catch {
            // The transaction may already have been aborted by the browser.
          }
          fail(reason);
        },
      );
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have been aborted by the browser.
      }
      fail(error);
    }
  });
}

async function listFromDatabase(): Promise<PendingLocationOperation[]> {
  return runStore<PendingLocationOperation[]>(OPERATIONS_STORE_NAME, 'readonly', (store, resolve, reject) => {
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
      await runStore<void>(OPERATIONS_STORE_NAME, 'readwrite', (store, resolve, reject) => {
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
      await runStore<void>(OPERATIONS_STORE_NAME, 'readwrite', (store, resolve, reject) => {
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
      await runStore<void>(OPERATIONS_STORE_NAME, 'readwrite', (store, resolve, reject) => {
        const request = store.put(updated);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      const items = readFallback().filter((entry) => entry.id !== item.id);
      writeFallback([...items, updated]);
    }
  },

  async listMedia(projectId?: string): Promise<PendingLocationMedia[]> {
    const items = await runStore<PendingLocationMedia[]>(MEDIA_STORE_NAME, 'readonly', (store, resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as PendingLocationMedia[]);
      request.onerror = () => reject(request.error);
    });
    return items
      .filter((item) => !projectId || item.projectId === projectId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  },

  async putMedia(input: Omit<PendingLocationMedia, 'id' | 'createdAt' | 'attempts'>): Promise<PendingLocationMedia> {
    const item: PendingLocationMedia = {
      ...input,
      id: input.upload.clientUploadId,
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    await runStore<void>(MEDIA_STORE_NAME, 'readwrite', (store, resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return item;
  },

  async removeMedia(id: string): Promise<void> {
    await runStore<void>(MEDIA_STORE_NAME, 'readwrite', (store, resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async incrementMediaAttempts(item: PendingLocationMedia): Promise<void> {
    await runStore<void>(MEDIA_STORE_NAME, 'readwrite', (store, resolve, reject) => {
      const request = store.put({ ...item, attempts: item.attempts + 1 });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
};
