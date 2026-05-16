/**
 * animaticAudioStore — persistens av scratch-tracks per scene-id i
 * IndexedDB. localStorage er ikke et alternativ siden lyd-blobs
 * lett blir 5+ MB (over 5MB-grensen per origin) og dataURL-koding
 * er sløsing av plass.
 *
 * Designvalg:
 *   - Én database (`role-room-animatic-audio`), ett objektlager
 *     (`scratchTracks`) med sceneId som nøkkel
 *   - Hver rad: { sceneId, blob, fileName, mimeType, addedAt }
 *   - API er Promise-basert og defensiv: feiler stille hvis
 *     IndexedDB ikke er tilgjengelig (SSR, private modus)
 */

const DB_NAME = 'role-room-animatic-audio';
const DB_VERSION = 1;
const STORE = 'scratchTracks';

export interface StoredScratchTrack {
  sceneId: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  addedAt: string;
}

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isAvailable()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'sceneId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

export async function saveScratchTrack(
  sceneId: string,
  file: File,
): Promise<boolean> {
  if (!sceneId || !file) return false;
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const entry: StoredScratchTrack = {
        sceneId,
        blob: file,
        fileName: file.name,
        mimeType: file.type || 'audio/mpeg',
        addedAt: new Date().toISOString(),
      };
      const req = store.put(entry);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function loadScratchTrack(sceneId: string): Promise<StoredScratchTrack | null> {
  if (!sceneId) return null;
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.get(sceneId);
      req.onsuccess = () => {
        const value = req.result as StoredScratchTrack | undefined;
        resolve(value ?? null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteScratchTrack(sceneId: string): Promise<boolean> {
  if (!sceneId) return false;
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.delete(sceneId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
