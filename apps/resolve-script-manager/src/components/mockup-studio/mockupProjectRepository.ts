import { readImageB64 } from "../../api";
import {
  deleteCloudMockupProject,
  downloadMockupAsset,
  listCloudMockupProjects,
  mockupCloudBearer,
  pullCloudMockupProject,
  pushCloudMockupProject,
  uploadMockupAsset,
} from "../../services/cloudMockupProjectsService";
import type { MockupDoc } from "./mockupStudioModel";
import { sanitizeRemoteMockupProjectAssets } from "./mockupPreflightRules";

const DB_NAME = "mockup-studio-projects";
const DB_VERSION = 1;
const STORE = "projects";
const LEGACY_KEY = "trrpa.mockup.projects";
const ASSET_MAP_KEY = "trrpa.mockup.cloud-assets";
export const MOCKUP_SYNC_EVENT = "trrpa:mockup-sync";
export const MOCKUP_PROJECTS_CHANGED_EVENT = "trrpa:mockup-projects-changed";

export type MockupSyncState = "saving" | "saved" | "local" | "offline" | "error";
export interface MockupSyncDetail {
  projectId: string;
  state: MockupSyncState;
  message?: string;
  updatedAt?: number;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, MockupDoc>();

function emit(detail: MockupSyncDetail): void {
  window.dispatchEvent(new CustomEvent<MockupSyncDetail>(MOCKUP_SYNC_EVENT, { detail }));
}
function emitProjectsChanged(): void {
  window.dispatchEvent(new Event(MOCKUP_PROJECTS_CHANGED_EVENT));
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB kunne ikke åpnes"));
  });
}
async function idbPut(doc: MockupDoc): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB-lagring feilet"));
  });
  db.close();
}
async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB-sletting feilet"));
  });
  db.close();
}
export async function loadCachedMockupProjects(): Promise<MockupDoc[]> {
  const db = await openDb();
  const docs = await new Promise<MockupDoc[]>((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as MockupDoc[]) || []);
    req.onerror = () => reject(req.error || new Error("IndexedDB-lesing feilet"));
  });
  db.close();
  return docs.sort((a, b) => b.updatedAt - a.updatedAt);
}
function mergeLegacyCache(doc: MockupDoc): void {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]") as MockupDoc[];
    const list = Array.isArray(parsed) ? parsed : [];
    const i = list.findIndex((item) => item.id === doc.id);
    if (i >= 0) list[i] = doc; else list.unshift(doc);
    localStorage.setItem(LEGACY_KEY, JSON.stringify(list));
  } catch {
    // IndexedDB is the durable source; localStorage is only a synchronous compatibility cache.
  }
}
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Kunne ikke lese bildefilen"));
    reader.readAsDataURL(blob);
  });
}
export function decodeDataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) {
    throw new Error("Ugyldig data-URL for mockup-bilde");
  }
  const metadata = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  const mime = metadata.split(";", 1)[0] || "application/octet-stream";
  const binary = /(?:^|;)base64(?:;|$)/i.test(metadata)
    ? atob(payload.replace(/\s/g, ""))
    : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}
async function sourceToBlob(source: string): Promise<Blob> {
  if (source.startsWith("data:")) return decodeDataUrlToBlob(source);
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Kunne ikke lese mockup-bildet (HTTP ${response.status})`);
  return response.blob();
}
function isLocalAsset(src: string): boolean {
  return Boolean(src) && !/^(?:data:|https?:|blob:|mockup-cloud-file:)/i.test(src) && !src.startsWith("/assets/");
}
function fileNameFor(path: string): string {
  const leaf = path.split(/[\\/]/).pop() || "mockup-asset";
  return /\.[a-z0-9]{2,6}$/i.test(leaf) ? leaf : `${leaf}.png`;
}
function readAssetMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(ASSET_MAP_KEY) || "{}") as Record<string, string>; }
  catch { return {}; }
}
function saveAssetMap(map: Record<string, string>): void {
  try { localStorage.setItem(ASSET_MAP_KEY, JSON.stringify(map)); } catch { /* cache only */ }
}
async function portableSource(src: string, projectId: string, map: Record<string, string>): Promise<string> {
  if (src.startsWith("mockup-cloud-file:") || /^(?:data:|https?:)/i.test(src) || src.startsWith("/assets/")) return src;
  const cached = map[src];
  if (cached) return `mockup-cloud-file:${cached}`;
  const dataUrl = isLocalAsset(src) ? await readImageB64(src) : src;
  const id = await uploadMockupAsset(await sourceToBlob(dataUrl), fileNameFor(src), projectId);
  map[src] = id;
  saveAssetMap(map);
  return `mockup-cloud-file:${id}`;
}
export async function makeMockupProjectPortable(doc: MockupDoc): Promise<MockupDoc> {
  const out = structuredClone(doc);
  const map = readAssetMap();
  const sources = new Map<string, Promise<string>>();
  const convert = (src?: string): Promise<string | undefined> => {
    if (!src) return Promise.resolve(undefined);
    let value = sources.get(src);
    if (!value) { value = portableSource(src, doc.id, map); sources.set(src, value); }
    return value;
  };
  for (const device of out.devices) device.image = await convert(device.image);
  for (const image of out.images ?? []) image.image = (await convert(image.image)) || image.image;
  if (out.canvas.logo?.image) out.canvas.logo.image = (await convert(out.canvas.logo.image)) || out.canvas.logo.image;
  return out;
}
async function hydrateSource(src: string | undefined, projectId: string): Promise<string | undefined> {
  if (!src?.startsWith("mockup-cloud-file:")) return src;
  return blobToDataUrl(await downloadMockupAsset(src.slice("mockup-cloud-file:".length), projectId));
}
export async function hydrateMockupProject(doc: MockupDoc): Promise<MockupDoc> {
  const out = sanitizeRemoteMockupProjectAssets(doc);
  for (const device of out.devices) device.image = await hydrateSource(device.image, out.id);
  for (const image of out.images ?? []) {
    image.image = (await hydrateSource(image.image, out.id)) || image.image;
    image.video = await hydrateSource(image.video, out.id);
    if (image.sprite) {
      image.sprite.frames = (await Promise.all(image.sprite.frames.map((frame) => hydrateSource(frame, out.id))))
        .filter((frame): frame is string => Boolean(frame));
    }
  }
  if (out.canvas.logo?.image) out.canvas.logo.image = (await hydrateSource(out.canvas.logo.image, out.id)) || out.canvas.logo.image;
  out.canvas.bgImage = await hydrateSource(out.canvas.bgImage, out.id);
  if (out.canvas.audio) {
    const audio = await hydrateSource(out.canvas.audio.src, out.id);
    out.canvas.audio = audio ? { ...out.canvas.audio, src: audio } : undefined;
  }
  out.reviewPreview = await hydrateSource(out.reviewPreview, out.id);
  return out;
}

async function persistNow(doc: MockupDoc): Promise<void> {
  try {
    await idbPut(doc);
    emitProjectsChanged();
  } catch (error) {
    emit({ projectId: doc.id, state: "error", message: error instanceof Error ? error.message : String(error) });
    return;
  }
  if (!mockupCloudBearer()) {
    emit({ projectId: doc.id, state: "local", updatedAt: Date.now() });
    return;
  }
  try {
    const portable = await makeMockupProjectPortable(doc);
    await pushCloudMockupProject(portable);
    emit({ projectId: doc.id, state: "saved", updatedAt: Date.now() });
  } catch (error) {
    emit({ projectId: doc.id, state: "offline", message: error instanceof Error ? error.message : String(error), updatedAt: Date.now() });
  }
}

export function queueMockupProjectSave(doc: MockupDoc): void {
  const snapshot = structuredClone(doc);
  pending.set(doc.id, snapshot);
  emit({ projectId: doc.id, state: "saving" });
  void idbPut(snapshot).then(emitProjectsChanged).catch((error) => {
    emit({ projectId: doc.id, state: "error", message: error instanceof Error ? error.message : String(error) });
  });
  const old = timers.get(doc.id);
  if (old) clearTimeout(old);
  timers.set(doc.id, setTimeout(() => {
    timers.delete(doc.id);
    const latest = pending.get(doc.id);
    pending.delete(doc.id);
    if (latest) void persistNow(latest);
  }, 900));
}

export async function syncMockupProjectNow(doc: MockupDoc): Promise<MockupDoc> {
  if (!mockupCloudBearer()) throw new Error('Logg inn for å synkronisere prosjektet.');
  emit({ projectId: doc.id, state: 'saving' });
  await idbPut(doc);
  const portable = await makeMockupProjectPortable(doc);
  await pushCloudMockupProject(portable);
  emit({ projectId: doc.id, state: 'saved', updatedAt: Date.now() });
  return portable;
}

export async function syncMockupProjectsFromCloud(): Promise<MockupDoc[]> {
  const local = await loadCachedMockupProjects().catch(() => []);
  if (!mockupCloudBearer()) return local;
  try {
    const remote = await listCloudMockupProjects();
    const byId = new Map(local.map((doc) => [doc.id, doc]));
    for (const meta of remote) {
      const cached = byId.get(meta.id);
      const remoteTime = new Date(meta.updatedAt).getTime();
      if (cached && cached.updatedAt >= remoteTime) continue;
      const pulled = await pullCloudMockupProject(meta.id);
      const hydrated = await hydrateMockupProject(pulled.project);
      hydrated.updatedAt = remoteTime || hydrated.updatedAt;
      await idbPut(hydrated);
      mergeLegacyCache(hydrated);
      byId.set(hydrated.id, hydrated);
    }
    const merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    emitProjectsChanged();
    return merged;
  } catch {
    return local;
  }
}

export async function deleteMockupProjectEverywhere(id: string): Promise<void> {
  await idbDelete(id).catch(() => {});
  await deleteCloudMockupProject(id).catch(() => {});
  emitProjectsChanged();
}
