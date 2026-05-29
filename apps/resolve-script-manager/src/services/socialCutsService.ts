/**
 * socialCutsService — CRUD mot Role Room social-cuts.
 */

import { loadSettings } from "../components/SettingsModal";
import type { SocialCut, CutAspect, CutStatus } from "../lib/socialCutTypes";

function getBaseUrl(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}

function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

export const socialCutsService = {
  async list(projectId: string, status?: CutStatus): Promise<SocialCut[]> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const u = new URLSearchParams({ projectId });
    if (status) u.set("status", status);
    const res = await fetch(`${getBaseUrl()}/api/role-room/social-cuts?${u}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`social-cuts list: HTTP ${res.status}`);
    const json = await res.json() as { cuts: SocialCut[] };
    return json.cuts;
  },

  async create(args: {
    projectId: string;
    sourceVideoPath: string;
    startSec: number;
    endSec: number;
    aspectRatio?: CutAspect;
    captionsBurnt?: boolean;
    outputPath?: string;
    thumbnailPath?: string;
    standoutScore?: number;
    transcriptSnippet?: string;
    headline?: string;
    agentKind?: string;
  }): Promise<{ id: string }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/social-cuts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const d = await res.text().catch(() => "");
      throw new Error(`social-cuts create: HTTP ${res.status} ${d}`.trim());
    }
    return await res.json() as { id: string; ok: true };
  },

  async update(id: string, patch: {
    outputPath?: string;
    thumbnailPath?: string;
    headline?: string;
    status?: CutStatus;
    captionsBurnt?: boolean;
    aspectRatio?: CutAspect;
  }): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/social-cuts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`social-cuts update: HTTP ${res.status}`);
  },

  async delete(id: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/social-cuts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`social-cuts delete: HTTP ${res.status}`);
  },
};
