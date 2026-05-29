/**
 * musicService — CRUD + suggest + feedback mot Role Room Music Library.
 */

import { loadSettings } from "../components/SettingsModal";
import type {
  MusicTrack, MusicSuggestion, MusicAudioAnalysis,
} from "../lib/musicTypes";
import type { AnalysisStatus } from "../lib/brollTypes";

function getBaseUrl(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}

function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

export const musicService = {
  async list(projectId: string): Promise<MusicTrack[]> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const u = new URLSearchParams({ projectId });
    const res = await fetch(`${getBaseUrl()}/api/role-room/music?${u}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`music list: HTTP ${res.status}`);
    const json = await res.json() as { tracks: MusicTrack[] };
    return json.tracks;
  },

  async register(args: {
    projectId: string; filePath: string;
    durationSec?: number; tags?: string[];
    userDescription?: string;
    licenseType?: string; licenseInfo?: string;
  }): Promise<{ id: string }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/music`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const d = await res.text().catch(() => "");
      throw new Error(`music register: HTTP ${res.status} ${d}`.trim());
    }
    return await res.json() as { id: string; ok: true };
  },

  async update(id: string, patch: {
    tags?: string[]; userDescription?: string;
    licenseType?: string; licenseInfo?: string;
  }): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/music/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`music update: HTTP ${res.status}`);
  },

  async setAnalysis(id: string, args: {
    audioAnalysis?: MusicAudioAnalysis;
    tags?: string[];
    previewAudioPath?: string;
    waveformImagePath?: string;
    durationSec?: number;
    analysisStatus?: AnalysisStatus;
    analysisError?: string;
  }): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/music/${encodeURIComponent(id)}/analysis`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`music setAnalysis: HTTP ${res.status}`);
  },

  async delete(id: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/music/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`music delete: HTTP ${res.status}`);
  },

  async suggest(args: {
    projectId: string;
    agentKind: string;
    chapterId?: string;
    contextTags: string[];
    targetBpmRange?: [number, number];
    limit?: number;
  }): Promise<{
    suggestions: MusicSuggestion[];
    contextSignature: string;
    totalTracks: number;
  }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/music/suggest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`music suggest: HTTP ${res.status}`);
    return await res.json();
  },

  async feedback(args: {
    trackId: string;
    approved: boolean;
    agentKind: string;
    chapterId?: string;
    contextTags: string[];
  }): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/music/feedback`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`music feedback: HTTP ${res.status}`);
  },
};
