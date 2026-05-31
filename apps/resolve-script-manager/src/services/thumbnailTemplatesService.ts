/**
 * thumbnailTemplatesService — CRUD mot thumbnail-templates per prosjekt.
 * Brukes av Thumbnail Creator for "Lagre design som template" og
 * "Velg fra mine templates".
 */

import { loadSettings } from "../components/SettingsModal";

export interface ThumbnailDesign {
  // UI eier formatet — backend lagrer det rått. Vi serialiserer alt
  // relevant for å gjenoppbygge en design: layout, brand, free elements,
  // logo, platform, aspect, etc.
  layout: string;
  platform: string;
  device: string;
  title: string;
  cta: string;
  companyName: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  logoUrl: string;
  logoPlacement: string;
  logoSizePct: number;
  backgroundSource: string;
  backgroundImageUrl: string;
  freeElements: unknown[];
}

export interface ThumbnailTemplate {
  id: string;
  projectId: string;
  name: string;
  design: ThumbnailDesign;
  previewDataUrl: string | null;
  useCount: number;
  lastUsedAt: string | null;
  tags: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
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

export const thumbnailTemplatesService = {
  async list(projectId: string): Promise<ThumbnailTemplate[]> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");
    const u = new URLSearchParams({ projectId });
    const res = await fetch(`${getBaseUrl()}/api/role-room/thumbnail-templates?${u}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`templates list: HTTP ${res.status}`);
    const json = await res.json() as { templates: ThumbnailTemplate[] };
    return json.templates;
  },

  async save(args: {
    projectId: string;
    name: string;
    design: ThumbnailDesign;
    previewDataUrl?: string;
    tags?: string[];
  }): Promise<{ id: string; createdAt: string }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/thumbnail-templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`templates save: HTTP ${res.status} ${detail}`.trim());
    }
    return await res.json() as { id: string; createdAt: string; ok: true };
  },

  async delete(id: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/thumbnail-templates/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`templates delete: HTTP ${res.status}`);
  },

  async markUsed(id: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    await fetch(`${getBaseUrl()}/api/role-room/thumbnail-templates/${encodeURIComponent(id)}/use`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}` },
    });
  },
};
