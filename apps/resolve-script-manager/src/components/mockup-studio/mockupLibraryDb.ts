/**
 * mockupLibraryDb.ts — IndexedDB for Mockup Studio prosjekt-bibliotek (media pool).
 *
 * Hvorfor IDB og ikke localStorage: et ekte medie-bibliotek holder mange store bilder
 * (44 pizza-foto ≈ 90MB base64) — langt over localStorage-taket (~5MB). IDB håndterer
 * hundrevis av MB og persisterer på tvers av økter.
 *
 * To object-stores: `meta` (liten: navn/mappe/tags/dim + thumbnail-dataURL for rask grid)
 * og `blobs` (full-oppløst dataURL, lastes KUN on-demand når et bilde plasseres). Slik
 * kan grid-en rendre 100+ thumbnails uten å dra full-res inn i minnet.
 */

const DB_NAME = 'mockup-studio';
const VER = 1;
const META = 'library_meta';
const BLOBS = 'library_blobs';

export interface LibraryMeta {
  id: string;
  name: string;
  folder: string;        // «/» = rot; f.eks. «meny/pizza» (auto fra pipeline eller import-mappe)
  tags: string[];
  w: number;
  h: number;
  size: number;          // bytes (estimat)
  addedAt: number;
  thumb: string;         // liten dataURL (~240px) for grid
  source?: string;       // opprinnelse: 'import' | 'capture:<url>' | 'ai'
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, run: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | void> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let out: T | undefined;
    const r = run(t);
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/** Legg til ett asset (meta + full blob) i én transaksjon. */
export async function idbAddAsset(meta: LibraryMeta, full: string): Promise<void> {
  const db = await open();
  await tx(db, [META, BLOBS], 'readwrite', (t) => {
    t.objectStore(META).put(meta);
    t.objectStore(BLOBS).put({ id: meta.id, full });
  });
  db.close();
}

/** Hele meta-listen (uten full-res) — for rask grid ved oppstart. */
export async function idbAllMeta(): Promise<LibraryMeta[]> {
  const db = await open();
  const all = (await tx<LibraryMeta[]>(db, [META], 'readonly', (t) => t.objectStore(META).getAll())) as LibraryMeta[] | undefined;
  db.close();
  return (all ?? []).sort((a, b) => b.addedAt - a.addedAt);
}

/** Full-oppløst dataURL for ETT asset (lastes når det plasseres på lerretet). */
export async function idbGetFull(id: string): Promise<string | null> {
  const db = await open();
  const rec = (await tx<{ id: string; full: string }>(db, [BLOBS], 'readonly', (t) => t.objectStore(BLOBS).get(id))) as { full: string } | undefined;
  db.close();
  return rec?.full ?? null;
}

/** Oppdater meta (mappe/tags/navn) for ett asset. */
export async function idbPatchMeta(id: string, patch: Partial<LibraryMeta>): Promise<void> {
  const db = await open();
  await tx(db, [META], 'readwrite', (t) => {
    const store = t.objectStore(META);
    const g = store.get(id);
    g.onsuccess = () => { const cur = g.result as LibraryMeta | undefined; if (cur) store.put({ ...cur, ...patch }); };
  });
  db.close();
}

/** Slett assets (meta + blob). */
export async function idbDelete(ids: string[]): Promise<void> {
  const db = await open();
  await tx(db, [META, BLOBS], 'readwrite', (t) => {
    for (const id of ids) { t.objectStore(META).delete(id); t.objectStore(BLOBS).delete(id); }
  });
  db.close();
}
