/**
 * animaticAudioStore — persistens av animatic-audio i IndexedDB.
 * localStorage er ikke et alternativ siden lyd-blobs lett blir 5+ MB
 * (over 5MB-grensen per origin) og dataURL-koding er sløsing av plass.
 *
 * Tre objektlagre:
 *
 *   1. `scratchTracks` (sceneId)
 *      Scene-nivå "scratch track" — én bakgrunns-lyd for hele scenen.
 *      Lagres som Blob.
 *
 *   2. `frameVoiceovers` ([sceneId, frameId])
 *      Per-frame voiceover-blob. Composite key så vi kan range-spørre
 *      "alle voiceovers for sceneId X" via IDBKeyRange.bound.
 *
 *   3. `sfxClips` ([sceneId, eventId])
 *      Per-event SFX-clip. Kan være user-uploaded blob ELLER referanse
 *      til en server-side URL (CLAP-match eller AI-generert). kind-feltet
 *      sier hvilken modus. URL-baserte clips trenger ikke blob — backend
 *      serverer dem fortsatt.
 *
 * API er Promise-basert og defensiv: feiler stille hvis IndexedDB ikke
 * er tilgjengelig (SSR, private modus).
 *
 * Versjonering: bumper vi DB_VERSION trigger vi onupgradeneeded med
 * mulighet for å lage nye stores. Eksisterende data beholdes intakt.
 */

const DB_NAME = 'role-room-animatic-audio';
const DB_VERSION = 2;
const STORE = 'scratchTracks';
const FRAME_VOICEOVER_STORE = 'frameVoiceovers';
const SFX_CLIP_STORE = 'sfxClips';

export interface StoredScratchTrack {
  sceneId: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  addedAt: string;
}

export interface StoredFrameVoiceover {
  sceneId: string;
  frameId: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  addedAt: string;
}

/** SFX-clip kan være user-uploaded blob ELLER en server-URL-referanse
 *  (CLAP-match eller AI-generert). For URL-mode er blob undefined. */
export interface StoredSfxClip {
  sceneId: string;
  eventId: string;
  /** 'blob' = user-uploadet fil, 'url' = server-side referanse. */
  kind: 'blob' | 'url';
  blob?: Blob;
  /** URL — for kind='url' er dette referansen frontend bruker. */
  url?: string;
  fileName?: string;
  /** Friendly label (f.eks. "AI-generated" eller "CLAP: Door slam"). */
  sourceLabel?: string;
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
      // Versjon 1 + 2: opprett stores hvis de mangler. Eksisterende
      // data overleveres uendret.
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'sceneId' });
      }
      if (!db.objectStoreNames.contains(FRAME_VOICEOVER_STORE)) {
        db.createObjectStore(FRAME_VOICEOVER_STORE, { keyPath: ['sceneId', 'frameId'] });
      }
      if (!db.objectStoreNames.contains(SFX_CLIP_STORE)) {
        db.createObjectStore(SFX_CLIP_STORE, { keyPath: ['sceneId', 'eventId'] });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

/** Range som matcher alle records med gitt sceneId-prefix på composite key. */
function sceneIdRange(sceneId: string): IDBKeyRange {
  return IDBKeyRange.bound([sceneId, ''], [sceneId, '￿']);
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

// ============================================================================
// Per-frame voiceover CRUD
// ============================================================================

export async function saveFrameVoiceover(
  sceneId: string,
  frameId: string,
  file: File,
): Promise<boolean> {
  if (!sceneId || !frameId || !file) return false;
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(FRAME_VOICEOVER_STORE, 'readwrite');
      const store = tx.objectStore(FRAME_VOICEOVER_STORE);
      const entry: StoredFrameVoiceover = {
        sceneId,
        frameId,
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

/** Last alle frame-voiceovers for én scene. Returnerer map frameId → record. */
export async function loadFrameVoiceovers(
  sceneId: string,
): Promise<Record<string, StoredFrameVoiceover>> {
  if (!sceneId) return {};
  const db = await openDb();
  if (!db) return {};
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(FRAME_VOICEOVER_STORE, 'readonly');
      const store = tx.objectStore(FRAME_VOICEOVER_STORE);
      const req = store.getAll(sceneIdRange(sceneId));
      req.onsuccess = () => {
        const records = (req.result || []) as StoredFrameVoiceover[];
        const result: Record<string, StoredFrameVoiceover> = {};
        for (const r of records) {
          result[r.frameId] = r;
        }
        resolve(result);
      };
      req.onerror = () => resolve({});
    } catch {
      resolve({});
    }
  });
}

export async function deleteFrameVoiceover(
  sceneId: string,
  frameId: string,
): Promise<boolean> {
  if (!sceneId || !frameId) return false;
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(FRAME_VOICEOVER_STORE, 'readwrite');
      const store = tx.objectStore(FRAME_VOICEOVER_STORE);
      const req = store.delete([sceneId, frameId]);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

// ============================================================================
// SFX-clip CRUD (både blob-uploads og URL-referanser)
// ============================================================================

export async function saveSfxClipBlob(
  sceneId: string,
  eventId: string,
  file: File,
): Promise<boolean> {
  if (!sceneId || !eventId || !file) return false;
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SFX_CLIP_STORE, 'readwrite');
      const store = tx.objectStore(SFX_CLIP_STORE);
      const entry: StoredSfxClip = {
        sceneId,
        eventId,
        kind: 'blob',
        blob: file,
        fileName: file.name,
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

export async function saveSfxClipReference(
  sceneId: string,
  eventId: string,
  url: string,
  sourceLabel?: string,
): Promise<boolean> {
  if (!sceneId || !eventId || !url) return false;
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SFX_CLIP_STORE, 'readwrite');
      const store = tx.objectStore(SFX_CLIP_STORE);
      const entry: StoredSfxClip = {
        sceneId,
        eventId,
        kind: 'url',
        url,
        sourceLabel,
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

export async function loadSfxClips(
  sceneId: string,
): Promise<Record<string, StoredSfxClip>> {
  if (!sceneId) return {};
  const db = await openDb();
  if (!db) return {};
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SFX_CLIP_STORE, 'readonly');
      const store = tx.objectStore(SFX_CLIP_STORE);
      const req = store.getAll(sceneIdRange(sceneId));
      req.onsuccess = () => {
        const records = (req.result || []) as StoredSfxClip[];
        const result: Record<string, StoredSfxClip> = {};
        for (const r of records) {
          result[r.eventId] = r;
        }
        resolve(result);
      };
      req.onerror = () => resolve({});
    } catch {
      resolve({});
    }
  });
}

export async function deleteSfxClip(
  sceneId: string,
  eventId: string,
): Promise<boolean> {
  if (!sceneId || !eventId) return false;
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SFX_CLIP_STORE, 'readwrite');
      const store = tx.objectStore(SFX_CLIP_STORE);
      const req = store.delete([sceneId, eventId]);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
