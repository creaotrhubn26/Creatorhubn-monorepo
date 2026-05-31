/**
 * captionsService — CRUD mot Role Room captions-collection per prosjekt.
 * Lagrer Whisper-transkript + caption-style.
 */

import { loadSettings } from "../components/SettingsModal";
import type { WhisperTranscript, CaptionStyle, CaptionStylePresetId } from "../lib/captionTypes";

export interface CaptionCollection {
  id: string;
  projectId: string;
  sourceVideoPath: string | null;
  transcript: WhisperTranscript;
  style: CaptionStyle | Record<string, never>;
  stylePresetId: CaptionStylePresetId | null;
  whisperModel: string | null;
  language: string | null;
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

export const captionsService = {
  async get(projectId: string): Promise<CaptionCollection | null> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const u = new URLSearchParams({ projectId });
    const res = await fetch(`${getBaseUrl()}/api/role-room/captions?${u}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`captions get: HTTP ${res.status}`);
    const json = await res.json() as { collection: CaptionCollection | null };
    return json.collection;
  },

  async save(args: {
    projectId: string;
    sourceVideoPath?: string;
    transcript: WhisperTranscript;
    style: CaptionStyle;
    stylePresetId?: CaptionStylePresetId;
    whisperModel?: string;
    language?: string;
  }): Promise<{ id: string; updatedAt: string }> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/captions`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`captions save: HTTP ${res.status} ${detail}`.trim());
    }
    return await res.json() as { id: string; updatedAt: string; ok: true };
  },

  async delete(id: string): Promise<void> {
    const bearer = getBearer();
    if (!bearer) throw new Error("Ikke innlogget");
    const res = await fetch(`${getBaseUrl()}/api/role-room/captions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) throw new Error(`captions delete: HTTP ${res.status}`);
  },
};
