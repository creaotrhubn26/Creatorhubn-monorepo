/**
 * moodBoardStore — per-scene mood-board med pinned reference-bilder.
 *
 * Storyboard-artister samler refs (foto, malerier, screenshots) for å
 * holde en stemning/palett gjennom en scene. Denne modulen lagrer dem
 * i localStorage som dataURL (offline-first, ingen backend-avhengighet).
 *
 * Begrensninger:
 *   - dataURL er tunge i localStorage (5-10MB-limit). Vi advarer ved
 *     >2MB per bilde og avviser >5MB hardt.
 *   - Storage er per-scene (sceneId nøkkel) — artisten må re-pinne for
 *     en annen scene. Det er bevisst: refs kobles til konteksten.
 *
 * Modulen er pure-logic; UI-laget (MoodBoardPanel) konsumerer den.
 */

const STORAGE_PREFIX = 'role-room:moodboard';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const SOFT_LIMIT_BYTES = 2 * 1024 * 1024; // 2 MB

export interface MoodBoardImage {
  id: string;
  /** Base64 dataURL (image/jpeg|png|webp;base64,…). */
  dataUrl: string;
  /** Filnavn fra opprinnelig opplasting — for visning og søk. */
  fileName?: string;
  /** Artist-skrevet caption ("mørkt regn", "kompletteringsskyer", "kostumeref"). */
  caption?: string;
  /** Tags artisten setter — fritekst, brukt for filter senere. */
  tags?: string[];
  /** Posisjon i pin-rekkefølgen (lavest = først). */
  order: number;
  /** Når den ble pinnet. */
  addedAt: string;
  /** Bytes — hjelper UI vise advarsel når storage nær full. */
  sizeBytes: number;
}

export interface AddImageResult {
  ok: boolean;
  image?: MoodBoardImage;
  error?: 'too-large' | 'invalid-data-url' | 'storage-full';
  warning?: 'over-soft-limit';
}

function storageKey(sceneId: string): string {
  return `${STORAGE_PREFIX}:${sceneId}`;
}

function safeParse(json: string | null): MoodBoardImage[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter(isMoodBoardImage) : [];
  } catch {
    return [];
  }
}

function isMoodBoardImage(value: unknown): value is MoodBoardImage {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.dataUrl === 'string' && typeof v.order === 'number';
}

function isValidDataUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  if (!url.startsWith('data:image/')) return false;
  const idx = url.indexOf(';base64,');
  if (idx < 11) return false;
  const payload = url.slice(idx + ';base64,'.length);
  if (payload.length === 0) return false;
  // eslint-disable-next-line no-useless-escape
  return /^[A-Za-z0-9+\/=]+$/.test(payload);
}

function dataUrlByteSize(url: string): number {
  // base64-payload-størrelse → ca. 3/4 av strenglengden.
  const base64Index = url.indexOf(',');
  if (base64Index === -1) return url.length;
  return Math.floor((url.length - base64Index - 1) * 0.75);
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

// ============================================================================
// CRUD-operasjoner
// ============================================================================

export function listMoodBoardImages(sceneId: string): MoodBoardImage[] {
  const storage = getStorage();
  if (!storage || !sceneId) return [];
  const raw = storage.getItem(storageKey(sceneId));
  return safeParse(raw).sort((a, b) => a.order - b.order);
}

export function addMoodBoardImage(
  sceneId: string,
  input: { dataUrl: string; fileName?: string; caption?: string; tags?: string[] },
): AddImageResult {
  if (!sceneId) return { ok: false, error: 'invalid-data-url' };
  if (!isValidDataUrl(input.dataUrl)) {
    return { ok: false, error: 'invalid-data-url' };
  }
  const size = dataUrlByteSize(input.dataUrl);
  if (size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'too-large' };
  }
  const storage = getStorage();
  if (!storage) return { ok: false, error: 'storage-full' };

  const existing = listMoodBoardImages(sceneId);
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((i) => i.order)) + 1 : 0;
  const image: MoodBoardImage = {
    id: generateId(),
    dataUrl: input.dataUrl,
    fileName: input.fileName,
    caption: input.caption,
    tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
    order: nextOrder,
    addedAt: new Date().toISOString(),
    sizeBytes: size,
  };

  try {
    storage.setItem(storageKey(sceneId), JSON.stringify([...existing, image]));
  } catch {
    return { ok: false, error: 'storage-full' };
  }

  return {
    ok: true,
    image,
    warning: size > SOFT_LIMIT_BYTES ? 'over-soft-limit' : undefined,
  };
}

export function removeMoodBoardImage(sceneId: string, imageId: string): boolean {
  const storage = getStorage();
  if (!storage || !sceneId) return false;
  const existing = listMoodBoardImages(sceneId);
  const next = existing.filter((image) => image.id !== imageId);
  if (next.length === existing.length) return false;
  // Re-pakk order så det forblir 0..N-1.
  const reindexed = next.map((image, idx) => ({ ...image, order: idx }));
  storage.setItem(storageKey(sceneId), JSON.stringify(reindexed));
  return true;
}

export function reorderMoodBoardImages(sceneId: string, orderedIds: string[]): boolean {
  const storage = getStorage();
  if (!storage || !sceneId) return false;
  const existing = listMoodBoardImages(sceneId);
  if (existing.length === 0) return false;
  const byId = new Map(existing.map((image) => [image.id, image]));
  const reordered: MoodBoardImage[] = [];
  for (let i = 0; i < orderedIds.length; i += 1) {
    const image = byId.get(orderedIds[i]);
    if (image) {
      reordered.push({ ...image, order: i });
      byId.delete(orderedIds[i]);
    }
  }
  // Resten av bildene (som ikke var med i orderedIds) tilbake bak.
  let nextIndex = reordered.length;
  for (const image of byId.values()) {
    reordered.push({ ...image, order: nextIndex });
    nextIndex += 1;
  }
  storage.setItem(storageKey(sceneId), JSON.stringify(reordered));
  return true;
}

export function updateMoodBoardImageMeta(
  sceneId: string,
  imageId: string,
  patch: Partial<Pick<MoodBoardImage, 'caption' | 'tags'>>,
): boolean {
  const storage = getStorage();
  if (!storage || !sceneId) return false;
  const existing = listMoodBoardImages(sceneId);
  let found = false;
  const next = existing.map((image) => {
    if (image.id !== imageId) return image;
    found = true;
    return {
      ...image,
      caption: patch.caption !== undefined ? patch.caption : image.caption,
      tags: patch.tags !== undefined ? (patch.tags.length > 0 ? patch.tags : undefined) : image.tags,
    };
  });
  if (!found) return false;
  storage.setItem(storageKey(sceneId), JSON.stringify(next));
  return true;
}

export function clearMoodBoard(sceneId: string): boolean {
  const storage = getStorage();
  if (!storage || !sceneId) return false;
  storage.removeItem(storageKey(sceneId));
  return true;
}

// ============================================================================
// Hjelpere som UI kan bruke
// ============================================================================

export interface StorageUsageReport {
  totalImages: number;
  totalBytes: number;
  isNearLimit: boolean;
}

export function getStorageUsage(sceneId: string): StorageUsageReport {
  const images = listMoodBoardImages(sceneId);
  const totalBytes = images.reduce((sum, image) => sum + image.sizeBytes, 0);
  return {
    totalImages: images.length,
    totalBytes,
    // localStorage er typisk 5-10 MB totalt, så vi advarer ved 4 MB
    // brukt per scene.
    isNearLimit: totalBytes > 4 * 1024 * 1024,
  };
}

function generateId(): string {
  // Crypto.randomUUID i moderne browsers, fallback for jsdom-tester.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `mb-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
