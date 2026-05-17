/**
 * offlineQueue.ts (Slice 9X.29)
 *
 * IndexedDB-basert kø for mutations som feiler grunnet offline-tilstand.
 * Wedding-day live-mode bruker dette for å la Stine fortsette å markere
 * events som ferdige og VIPs som fanget selv uten signal. Replays når
 * `navigator.onLine` blir true igjen ELLER ved 'online'-event.
 *
 * Bruk:
 *   await enqueueOrFetch('/api/wedding/abc/timeline-events/xyz', { method: 'PATCH', body: ... })
 *   // Hvis online: fetch'er som vanlig
 *   // Hvis offline: lagrer i IDB, returnerer { queued: true }
 *   onQueueChange((count) => updateBadge(count))
 *   triggerReplay()  // manual, eller automatisk på 'online'-event
 */

const DB_NAME = 'creatorhubn-offline-queue';
const DB_VERSION = 1;
const STORE = 'mutations';

interface QueuedMutation {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    let result: T;
    Promise.resolve(fn(store))
      .then((r) => { result = r; })
      .catch(reject);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function enqueue(mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'retryCount'>): Promise<number> {
  const item: QueuedMutation = {
    ...mutation,
    createdAt: Date.now(),
    retryCount: 0,
  };
  const id = await tx<number>('readwrite', (store) => new Promise((resolve, reject) => {
    const req = store.add(item);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  }));
  notifyListeners();
  return id;
}

async function listQueued(): Promise<QueuedMutation[]> {
  return tx<QueuedMutation[]>('readonly', (store) => new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as QueuedMutation[]);
    req.onerror = () => reject(req.error);
  }));
}

async function removeQueued(id: number): Promise<void> {
  await tx<void>('readwrite', (store) => new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}

async function updateRetry(id: number, error: string): Promise<void> {
  await tx<void>('readwrite', (store) => new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as QueuedMutation | undefined;
      if (!item) { resolve(); return; }
      item.retryCount = (item.retryCount ?? 0) + 1;
      item.lastError = error;
      const putReq = store.put(item);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  }));
}

export async function queueCount(): Promise<number> {
  const items = await listQueued().catch(() => []);
  return items.length;
}

const listeners = new Set<(count: number) => void>();

export function onQueueChange(cb: (count: number) => void): () => void {
  listeners.add(cb);
  // Send initial count async
  queueCount().then((n) => cb(n)).catch(() => undefined);
  return () => { listeners.delete(cb); };
}

function notifyListeners(): void {
  queueCount().then((n) => listeners.forEach((cb) => cb(n))).catch(() => undefined);
}

/**
 * Wrap rundt `fetch` for mutations som skal queue ved offline-failure.
 * Returnerer { queued: true } hvis offline (caller bør oppdatere optimistisk UI),
 * eller responsen hvis online + success.
 */
export async function enqueueOrFetch(
  url: string,
  init: RequestInit,
): Promise<{ queued: true; id: number } | { queued: false; response: Response }> {
  const headers: Record<string, string> = {};
  if (init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => { headers[k] = v; });
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) headers[k] = String(v);
    } else {
      Object.assign(headers, init.headers as Record<string, string>);
    }
  }
  const bodyText = typeof init.body === 'string' ? init.body : null;

  const shouldTryNetwork = navigator.onLine !== false;
  if (shouldTryNetwork) {
    try {
      const res = await fetch(url, init);
      // Hvis 5xx (server error), prøv å queue så vi ikke mister mutation
      if (res.status >= 500) {
        const id = await enqueue({ url, method: init.method ?? 'GET', headers, body: bodyText });
        return { queued: true, id };
      }
      return { queued: false, response: res };
    } catch (err) {
      // Network-error — queue
      const id = await enqueue({ url, method: init.method ?? 'GET', headers, body: bodyText });
      return { queued: true, id };
    }
  }
  // Offline — queue direkte
  const id = await enqueue({ url, method: init.method ?? 'GET', headers, body: bodyText });
  return { queued: true, id };
}

export interface ReplayResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

/**
 * Forsøk å sende alle queued mutations. Sletter rader som lykkes,
 * inkrementerer retryCount på de som feiler. Stop-on-first-503/404 så
 * vi ikke spammer en nede server.
 */
export async function replayQueue(): Promise<ReplayResult> {
  const result: ReplayResult = { attempted: 0, succeeded: 0, failed: 0 };
  if (navigator.onLine === false) return result;
  const items = await listQueued().catch(() => []);
  for (const item of items) {
    result.attempted++;
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
        credentials: 'include',
      });
      if (res.ok) {
        if (item.id !== undefined) await removeQueued(item.id);
        result.succeeded++;
      } else if (res.status === 404 || res.status === 410) {
        // Resource is gone — drop the mutation
        if (item.id !== undefined) await removeQueued(item.id);
        result.failed++;
      } else {
        if (item.id !== undefined) {
          await updateRetry(item.id, `HTTP ${res.status}`);
        }
        result.failed++;
      }
    } catch (err: any) {
      if (item.id !== undefined) {
        await updateRetry(item.id, String(err?.message ?? err).slice(0, 200));
      }
      result.failed++;
      // Avbryt loop — sannsynlig connection-issue, ikke spam
      break;
    }
  }
  notifyListeners();
  return result;
}

let onlineListenerInstalled = false;

/**
 * Aktiver auto-replay ved 'online'-event. Trygt å kalle flere ganger.
 */
export function installAutoReplay(): void {
  if (onlineListenerInstalled) return;
  onlineListenerInstalled = true;
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => {
    // Lite forsinkelse så DNS/connection er stabilt
    setTimeout(() => { void replayQueue(); }, 1000);
  });
  // Også replay ved oppstart hvis vi har queued items
  if (navigator.onLine !== false) {
    setTimeout(() => { void replayQueue(); }, 2000);
  }
}
