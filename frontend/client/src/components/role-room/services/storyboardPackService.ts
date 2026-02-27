import { STORYBOARD_PACK_DEFAULTS } from '../components/storyboardPackDefaults';
import type { StoryboardPackAdminState, StoryboardPackManifest } from '../components/storyboardPackTypes';

const DRAFT_KEY = 'roleroom:storyboard-packs:draft';
const PUBLISHED_KEY = 'roleroom:storyboard-packs:published';

const cloneManifest = (manifest: StoryboardPackManifest): StoryboardPackManifest => JSON.parse(JSON.stringify(manifest)) as StoryboardPackManifest;

const loadLocal = (key: string): StoryboardPackManifest | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoryboardPackManifest) : null;
  } catch {
    return null;
  }
};

const saveLocal = (key: string, manifest: StoryboardPackManifest) => {
  localStorage.setItem(key, JSON.stringify(manifest));
};

const getLocalPublished = () => loadLocal(PUBLISHED_KEY) ?? cloneManifest(STORYBOARD_PACK_DEFAULTS);
const getLocalDraft = () => loadLocal(DRAFT_KEY) ?? getLocalPublished();

// ── Frame Asset Package persistence (dedicated endpoints) ──

export interface AssetPackageSaveResult {
  version: number;
  frameId: string;
}

export interface AssetPackageLoadResult {
  frameId: string;
  assetPackage: NonNullable<unknown>;
  version: number;
  updatedAt: string;
}

export async function saveFrameAssetPackage(
  frameId: string,
  assetPackage: Record<string, unknown>,
  expectedVersion?: number,
): Promise<AssetPackageSaveResult | null> {
  try {
    const response = await fetch(`/api/frames/${encodeURIComponent(frameId)}/asset-package`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetPackage,
        ...(expectedVersion !== undefined ? { expectedVersion } : {}),
      }),
    });
    if (response.status === 409) {
      console.warn('[assetPackage] Version conflict on save — server has a newer version');
      return null;
    }
    if (!response.ok) throw new Error(`Save failed: ${response.status}`);
    return (await response.json()) as AssetPackageSaveResult;
  } catch (error) {
    console.warn('[assetPackage] Server save failed, asset package only stored locally:', error);
    return null;
  }
}

export async function loadFrameAssetPackage(
  frameId: string,
): Promise<AssetPackageLoadResult | null> {
  try {
    const response = await fetch(`/api/frames/${encodeURIComponent(frameId)}/asset-package`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Load failed: ${response.status}`);
    return (await response.json()) as AssetPackageLoadResult;
  } catch {
    return null;
  }
}

export const storyboardPackService = {
  async getPublished(): Promise<StoryboardPackManifest> {
    try {
      const response = await fetch('/api/storyboard-packs');
      if (!response.ok) throw new Error('Failed to load storyboard packs');
      const manifest = (await response.json()) as StoryboardPackManifest;
      return manifest.packs?.length ? manifest : getLocalPublished();
    } catch {
      return getLocalPublished();
    }
  },

  async getAdminState(): Promise<StoryboardPackAdminState> {
    try {
      const response = await fetch('/api/storyboard-packs/admin');
      if (!response.ok) throw new Error('Failed to load admin storyboard packs');
      const state = (await response.json()) as StoryboardPackAdminState;
      if (!state?.draft?.packs?.length || !state?.published?.packs?.length) {
        const published = getLocalPublished();
        return {
          draft: getLocalDraft(),
          published,
          version: published.version,
          publishedAt: published.publishedAt ?? null,
          updatedAt: published.updatedAt,
        };
      }
      return state;
    } catch {
      const published = getLocalPublished();
      const draft = getLocalDraft();
      return {
        draft,
        published,
        version: published.version,
        publishedAt: published.publishedAt ?? null,
        updatedAt: draft.updatedAt,
      };
    }
  },

  async saveDraft(manifest: StoryboardPackManifest): Promise<StoryboardPackAdminState> {
    try {
      const response = await fetch('/api/storyboard-packs/admin/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest }),
      });
      if (!response.ok) throw new Error('Failed to save draft');
      return (await response.json()) as StoryboardPackAdminState;
    } catch {
      const draft = { ...manifest, updatedAt: new Date().toISOString() };
      saveLocal(DRAFT_KEY, draft);
      const published = getLocalPublished();
      return {
        draft,
        published,
        version: published.version,
        publishedAt: published.publishedAt ?? null,
        updatedAt: draft.updatedAt,
      };
    }
  },

  async publishDraft(): Promise<StoryboardPackAdminState> {
    try {
      const response = await fetch('/api/storyboard-packs/admin/publish', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to publish draft');
      return (await response.json()) as StoryboardPackAdminState;
    } catch {
      const draft = getLocalDraft();
      const published = {
        ...draft,
        version: (draft.version ?? 0) + 1,
        publishedAt: new Date().toISOString(),
      };
      saveLocal(PUBLISHED_KEY, published);
      saveLocal(DRAFT_KEY, published);
      return {
        draft: published,
        published,
        version: published.version,
        publishedAt: published.publishedAt ?? null,
        updatedAt: published.updatedAt,
      };
    }
  },

  async uploadSlotImage(payload: { packId: string; slotId: string; fileName: string; imageBase64: string }): Promise<{ imageUrl: string }> {
    try {
      const response = await fetch('/api/storyboard-packs/admin/upload-slot-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to upload image');
      return (await response.json()) as { imageUrl: string };
    } catch (error) {
      const allowDataUrlFallback =
        typeof window !== 'undefined' &&
        localStorage.getItem('roleroom:storyboard-packs:allow-data-url-fallback') === '1';

      if (allowDataUrlFallback) {
        return { imageUrl: payload.imageBase64.startsWith('data:') ? payload.imageBase64 : `data:image/png;base64,${payload.imageBase64}` };
      }

      throw error;
    }
  },
};

export default storyboardPackService;
