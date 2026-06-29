import { invoke } from "@tauri-apps/api/core";

export interface AppState {
  api_base: string;
  paired: boolean;
  user_email: string | null;
  session_id: string | null;
  session_name: string | null;
  session_info_path: string | null;
  bounce_dir: string | null;
  easeverse_track_id: string | null;
  audio_room_id: string | null;
  watching: boolean;
}

export interface TrackInfo {
  id: string;
  title: string;
  artist: string | null;
  status: string | null;
  bpm: number | null;
  musical_key: string | null;
  review_id: string | null;
}

export interface PairResult {
  user_email: string;
}

export interface SessionInfo {
  id: string;
  name: string;
  linked_review: string | null;
}

export interface SyncResult {
  markers_stored: number;
  sections_synced: number;
  sample_rate: number | null;
  track_count: number;
}

export interface BounceResult {
  review_version_id: string | null;
  version_number: number | null;
  sections_synced: number;
}

export interface ActivityEntry {
  ts: string;
  kind: "info" | "marker" | "bounce" | "error";
  message: string;
}

export const getDefaultApiBase = () => invoke<string>("default_api_base");
export const getState = () => invoke<AppState>("get_state");
export const pair = (code: string, apiBase: string) => invoke<PairResult>("pair", { code, apiBase });
export const unpair = () => invoke<void>("unpair");
export const listTracks = () => invoke<TrackInfo[]>("list_tracks");
export const setupSession = (args: {
  name: string;
  sessionType: string;
  easeverseTrackId: string | null;
  audioRoomId: string | null;
  sessionInfoPath: string | null;
  bounceDir: string | null;
}) => invoke<SessionInfo>("setup_session", args);
export const syncSessionInfo = () => invoke<SyncResult>("sync_session_info");
export const uploadBounce = (path: string) => invoke<BounceResult>("upload_bounce", { path });
export const startWatching = () => invoke<void>("start_watching");
export const stopWatching = () => invoke<void>("stop_watching");
