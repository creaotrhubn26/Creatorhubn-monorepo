/**
 * brandAssetsService — CRUD mot Role Room asset-bibliotek per prosjekt.
 * Bjarne kan laste opp logoer + icons og gjenbruke dem i Thumbnail
 * Creator + Creative Editor.
 */

import { loadSettings } from "../components/SettingsModal";

export type BrandAssetKind = "logo" | "icon" | "overlay" | "template-bg";

export interface BrandAsset {
  id: string;
  projectId: string;
  kind: BrandAssetKind;
  name: string;
  dataUrl: string;
  sourceFilename: string | null;
  widthPx: number | null;
  heightPx: number | null;
  tags: string[];
  createdBy: string | null;
  createdAt: string;
}

function getBaseUrl(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}

function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

async function getProbeImageDimensions(dataUrl: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export const brandAssetsService = {
  async list(projectId: string, kind?: BrandAssetKind): Promise<BrandAsset[]> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");

    const u = new URLSearchParams({ projectId });
    if (kind) u.set("kind", kind);
    const url = `${getBaseUrl()}/api/role-room/brand-assets?${u.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`brand-assets list: HTTP ${res.status} ${detail}`.trim());
    }
    const json = await res.json() as { assets: BrandAsset[] };
    return json.assets;
  },

  async upload(args: {
    projectId: string; kind: BrandAssetKind; name: string;
    dataUrl: string; sourceFilename?: string; tags?: string[];
  }): Promise<{ id: string; createdAt: string }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");

    const dims = await getProbeImageDimensions(args.dataUrl);

    const res = await fetch(`${getBaseUrl()}/api/role-room/brand-assets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: args.projectId,
        kind: args.kind,
        name: args.name,
        dataUrl: args.dataUrl,
        sourceFilename: args.sourceFilename ?? null,
        widthPx: dims?.w ?? null,
        heightPx: dims?.h ?? null,
        tags: args.tags ?? [],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`brand-assets upload: HTTP ${res.status} ${detail}`.trim());
    }
    return await res.json() as { id: string; createdAt: string; ok: true };
  },

  async delete(id: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");

    const res = await fetch(`${getBaseUrl()}/api/role-room/brand-assets/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`brand-assets delete: HTTP ${res.status} ${detail}`.trim());
    }
  },
};

/** Hjelp-funksjon: konverter File til data:URL via FileReader. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Kunne ikke lese fil"));
    r.readAsDataURL(file);
  });
}
