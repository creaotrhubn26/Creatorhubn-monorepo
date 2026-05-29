/**
 * brollService — CRUD + suggest + feedback mot Role Room B-roll Library.
 */

import { loadSettings } from "../components/SettingsModal";
import type {
  BrollClip, BrollSuggestion, BrollVisionAnalysis, AnalysisStatus,
} from "../lib/brollTypes";

function getBaseUrl(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}

function getPostAgentBase(): string {
  const s = loadSettings();
  return s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent";
}

function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

export const brollService = {
  async list(projectId: string): Promise<BrollClip[]> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const u = new URLSearchParams({ projectId });
    const res = await fetch(`${getBaseUrl()}/api/role-room/broll?${u}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`broll list: HTTP ${res.status}`);
    const json = await res.json() as { clips: BrollClip[] };
    return json.clips;
  },

  async register(args: {
    projectId: string; filePath: string;
    durationSec?: number; width?: number; height?: number; fps?: number;
    tags?: string[]; userDescription?: string;
  }): Promise<{ id: string }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/broll`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const d = await res.text().catch(() => "");
      throw new Error(`broll register: HTTP ${res.status} ${d}`.trim());
    }
    return await res.json() as { id: string; ok: true };
  },

  async update(id: string, patch: {
    tags?: string[]; userDescription?: string;
  }): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/broll/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`broll update: HTTP ${res.status}`);
  },

  async setAnalysis(id: string, args: {
    visionAnalysis?: BrollVisionAnalysis;
    tags?: string[];
    previewVideoPath?: string;
    previewThumbnailPath?: string;
    analysisStatus?: AnalysisStatus;
    analysisError?: string;
  }): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/broll/${encodeURIComponent(id)}/analysis`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`broll setAnalysis: HTTP ${res.status}`);
  },

  async delete(id: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/broll/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`broll delete: HTTP ${res.status}`);
  },

  async suggest(args: {
    projectId: string;
    agentKind: string;
    chapterId?: string;
    contextTags: string[];
    limit?: number;
  }): Promise<{
    suggestions: BrollSuggestion[];
    contextSignature: string;
    totalClips: number;
  }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/broll/suggest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`broll suggest: HTTP ${res.status}`);
    return await res.json();
  },

  async feedback(args: {
    clipId: string;
    approved: boolean;
    agentKind: string;
    chapterId?: string;
    contextTags: string[];
  }): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/broll/feedback`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`broll feedback: HTTP ${res.status}`);
  },
};

/** Helper: hent post-agent-base-URL eksponert til Python-script-kall
 *  så analyze_broll_clip.py kan finne anthropic-proxy. */
export function getPostAgentBaseUrlForScripts(): string {
  return getPostAgentBase();
}

/** Helper: hent bearer-token eksponert til Python-script-kall. */
export function getBearerForScripts(): string | null {
  return getBearer();
}
