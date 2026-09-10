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
  workspace_project_id: string | null;
  easeverse_project_id: string | null;
  suggested_project_name: string | null;
  watching: boolean;
  pending_bounces: number;
  pending_session_info: boolean;
  last_queue_error: string | null;
  protools_tier: "intro" | "artist" | "studio" | "flex";
  intro_preflight: IntroPreflight | null;
  ptsl: {
    state: "connected" | "degraded" | "unavailable";
    server_detected: boolean;
    helper_installed: boolean;
    helper_path: string | null;
    message: string;
  };
}

export interface IntroPreflight {
  compatible: boolean;
  counts: { audio: number; instrument: number; midi: number; aux: number; io_paths: number };
  violations: Array<{
    category: string;
    actual: number;
    limit: number;
    excess: number;
    recommendation: string;
  }>;
  checked_against: string;
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
  easeverse_synced: boolean;
  sample_rate: number | null;
  track_count: number;
  intro_preflight: IntroPreflight;
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

export interface FeedbackComment {
  id: string;
  author: string | null;
  author_role: string | null;
  timecode_seconds: number;
  body: string;
  category: string | null;
  status: string;
  is_decision: boolean;
  version_label: string;
  created_at: string;
}

export interface FeedbackApproval {
  id: string;
  approved_by: string | null;
  approval_type: string;
  note: string | null;
  version_label: string;
  created_at: string;
}

export interface FeedbackTask {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  assignee: string | null;
  created_at: string;
}

export interface FeedbackInbox {
  project: { id: string; title: string; status: string } | null;
  version: { id: string; version_label: string; version_number: number; status: string } | null;
  comments: FeedbackComment[];
  approvals: FeedbackApproval[];
  tasks: FeedbackTask[];
  generatedAt: string;
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
  proToolsTier: AppState["protools_tier"];
}) => invoke<SessionInfo>("setup_session", args);
export const syncSessionInfo = () => invoke<SyncResult>("sync_session_info");
export const uploadBounce = (path: string) => invoke<BounceResult>("upload_bounce", { path });
export const startWatching = () => invoke<void>("start_watching");
export const stopWatching = () => invoke<void>("stop_watching");
export const getFeedback = () => invoke<FeedbackInbox>("get_feedback");
export const createRealtimeTicket = () => invoke<{
  ticket: string;
  expiresAt: string;
  websocketPath: string;
  protocolVersion: number;
  workspaceProjectId: string | null;
}>("create_realtime_ticket");
export const processCommands = () => invoke<{ processed: number; succeeded: number; failed: number }>("process_commands");
export const locateFeedback = (seconds: number) => invoke<Record<string, unknown>>("locate_feedback", { seconds });
export const resolveFeedback = (commentId: string) => invoke<Record<string, unknown>>("resolve_feedback", { commentId });
export const replyFeedback = (commentId: string, body: string) => invoke<Record<string, unknown>>("reply_feedback", { commentId, body });
