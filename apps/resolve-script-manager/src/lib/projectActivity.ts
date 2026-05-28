/**
 * Project activity log — persistent record per prosjekt over hva som er
 * utført. Lagres i localStorage under trrpa.projectActivity.<sourceVideo>.
 *
 * Use case: bruker åpner et eksisterende prosjekt i Home → ser hva som er
 * gjort (extract, multicam-scan, backup, timelines, QC). Hver wizard-step
 * og hver Claude-action logger sin egen entry.
 */

export type ActivityKind =
  | "extract"
  | "multicam_scan"
  | "audio_match"
  | "face_cluster"
  | "music_id"
  | "backup"
  | "resolve_bins"
  | "timelines_built"
  | "qc_run"
  | "claude_suggestion"
  | "wizard_step"
  | "manual_edit";

export interface ActivityEntry {
  ts: number;          // unix ms
  kind: ActivityKind;
  label: string;       // kort norsk-tekst som vises i UI
  summary?: string;    // valgfri detalj
  meta?: Record<string, unknown>;
}

const MAX_ENTRIES = 100;

function projectKey(sourceVideo: string): string {
  return `trrpa.projectActivity.${sourceVideo}`;
}

const GLOBAL_KEY = "trrpa.projectActivity.global";

export function logActivity(sourceVideo: string | null, entry: Omit<ActivityEntry, "ts">): void {
  const full: ActivityEntry = { ts: Date.now(), ...entry };
  try {
    if (sourceVideo) {
      const raw = localStorage.getItem(projectKey(sourceVideo));
      const list = (raw ? JSON.parse(raw) : []) as ActivityEntry[];
      list.unshift(full);
      localStorage.setItem(projectKey(sourceVideo), JSON.stringify(list.slice(0, MAX_ENTRIES)));
    }
    // Også global feed (for "Recent activity"-panel)
    const grRaw = localStorage.getItem(GLOBAL_KEY);
    const grList = (grRaw ? JSON.parse(grRaw) : []) as ActivityEntry[];
    grList.unshift({ ...full, meta: { ...full.meta, sourceVideo } });
    localStorage.setItem(GLOBAL_KEY, JSON.stringify(grList.slice(0, MAX_ENTRIES)));
  } catch (err) {
    console.warn("logActivity failed:", err);
  }
}

export function loadProjectActivity(sourceVideo: string): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(projectKey(sourceVideo));
    return raw ? (JSON.parse(raw) as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}

export function loadGlobalActivity(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(GLOBAL_KEY);
    return raw ? (JSON.parse(raw) as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * MUI icon names per activity kind. HomeView maps these to actual icon
 * components via the ActivityIcon helper in HomeView.tsx.
 */
export const ACTIVITY_ICONS: Record<ActivityKind, string> = {
  extract: "Movie",
  multicam_scan: "CameraAlt",
  audio_match: "VolumeUp",
  face_cluster: "Person",
  music_id: "MusicNote",
  backup: "Save",
  resolve_bins: "Folder",
  timelines_built: "VideoLibrary",
  qc_run: "Search",
  claude_suggestion: "AutoAwesome",
  wizard_step: "AutoFixHigh",
  manual_edit: "Edit",
};
