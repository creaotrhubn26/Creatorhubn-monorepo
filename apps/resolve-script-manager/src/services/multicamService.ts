/**
 * multicamService — CRUD mot Role Room multicam-grupper.
 */

import { loadSettings } from "../components/SettingsModal";
import type { MulticamGroup, MulticamClip, SyncStatus } from "../lib/multicamTypes";

function getBaseUrl(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}

function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

export const multicamService = {
  async list(projectId: string): Promise<MulticamGroup[]> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const u = new URLSearchParams({ projectId });
    const res = await fetch(`${getBaseUrl()}/api/role-room/multicam?${u}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`multicam list: HTTP ${res.status}`);
    const json = await res.json() as { groups: MulticamGroup[] };
    return json.groups;
  },

  async create(args: {
    projectId: string;
    groupName: string;
    clips: MulticamClip[];
    agentKind?: string;
  }): Promise<{ id: string }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/multicam`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const d = await res.text().catch(() => "");
      throw new Error(`multicam create: HTTP ${res.status} ${d}`.trim());
    }
    return await res.json() as { id: string; ok: true };
  },

  async update(id: string, args: {
    groupName?: string;
    clips?: MulticamClip[];
    syncStatus?: SyncStatus;
    syncError?: string;
    syncMethod?: string;
  }): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/multicam/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const d = await res.text().catch(() => "");
      throw new Error(`multicam update: HTTP ${res.status} ${d}`.trim());
    }
  },

  async delete(id: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/multicam/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`multicam delete: HTTP ${res.status}`);
  },
};
