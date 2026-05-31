/**
 * lowerThirdsService — CRUD mot Role Room lower-thirds-collections per
 * prosjekt. Brukes av LowerThirdsStudio for å persistere taler-
 * introduksjoner og navn-overlays.
 */

import { loadSettings } from "../components/SettingsModal";
import type { LowerThirdItem, StylePresetId } from "../lib/lowerThirdTypes";

export interface LowerThirdsCollection {
  id: string;
  projectId: string;
  collectionName: string;
  items: LowerThirdItem[];
  agentKind: string | null;
  defaultStylePreset: StylePresetId | null;
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

export const lowerThirdsService = {
  async list(projectId: string): Promise<LowerThirdsCollection[]> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const u = new URLSearchParams({ projectId });
    const res = await fetch(`${getBaseUrl()}/api/role-room/lower-thirds?${u}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`lower-thirds list: HTTP ${res.status}`);
    const json = await res.json() as { collections: LowerThirdsCollection[] };
    return json.collections;
  },

  async save(args: {
    projectId: string;
    collectionName?: string;
    items: LowerThirdItem[];
    agentKind?: string;
    defaultStylePreset?: StylePresetId;
  }): Promise<{ id: string; updatedAt: string }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/lower-thirds`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`lower-thirds save: HTTP ${res.status} ${detail}`.trim());
    }
    return await res.json() as { id: string; updatedAt: string; ok: true };
  },

  async delete(id: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/lower-thirds/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`lower-thirds delete: HTTP ${res.status}`);
  },
};
