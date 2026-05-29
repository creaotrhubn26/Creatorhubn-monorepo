/**
 * creatorProfileService — fetcher/oppdaterer per-bruker preferanser fra
 * Role Room-backend. Auth via samme RR_BEARER_TOKEN som resten av
 * Post Agent's autentiserte endepunkter.
 */

import { loadSettings } from "../components/SettingsModal";

export interface CreatorProfile {
  // Project-defaults (anvendes på nye prosjekter)
  preferredHighlightMin?: number;       // 4-6 vanligvis
  preferredLookPack?: "norwedfilm" | "warm" | "cinematic" | "documentary" | "none";
  preferredAspectRatio?: "16:9" | "9:16" | "1:1";
  preferredProjectKind?: "wedding" | "corporate" | "music" | "event";

  // Musikk-preferanser
  preferredMusicProviders?: string[];   // rangert: ["Pixabay", "Jamendo", ...]
  preferredBpmRange?: { min: number; max: number };

  // Editing-stil
  preferredAvgCutSec?: number;          // gjennomsnittlig pick-varighet
  preferredTransition?: "fade" | "cut" | "dissolve" | "wipe" | "flash";
  preferLongCeremonyHolds?: boolean;

  // Auto-pilot-preferanser
  autoPilotAutoStart?: boolean;         // auto-trigger på prosjekt-load
  autoPilotConfirmTimeout?: number;     // sekunder før Claude's anbefaling auto-aksepteres

  // Aggregerte counters fra learnings
  counters?: Record<string, number>;

  // Siste 200 lærings-events
  recentLearnings?: Array<{
    ts: number;
    kind: string;
    [key: string]: unknown;
  }>;
}

export interface CreatorProfileState {
  profile: CreatorProfile;
  editCount: number;
  updatedAt: string | null;
}

function getBaseUrl(): string {
  const s = loadSettings();
  return (s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent").replace(/\/$/, "");
}

function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const bearer = getBearer();
  if (!bearer) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${path}: HTTP ${res.status} ${detail}`.trim());
  }
  return (await res.json()) as T;
}

export const creatorProfileService = {
  async get(): Promise<CreatorProfileState> {
    return authedFetch<CreatorProfileState>("/creator-profile", { method: "GET" });
  },

  async update(patch: Partial<CreatorProfile>): Promise<{ ok: boolean; profile: CreatorProfile }> {
    return authedFetch("/creator-profile", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async logLearning(kind: string, data?: Record<string, unknown>): Promise<{ ok: boolean; editCount: number }> {
    return authedFetch("/creator-profile/learning", {
      method: "POST",
      body: JSON.stringify({ kind, data }),
    });
  },
};
