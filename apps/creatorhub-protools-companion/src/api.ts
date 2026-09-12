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
  auto_watch: boolean;
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
  local_ipc: { listening: boolean; port: number; protocol_version: number; last_error: string | null };
  last_feedback_sync_at: string | null;
  last_feedback_sync_error: string | null;
  last_session_fingerprint: string | null;
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
  bounce_id: string | null;
  artifact_id: string | null;
  review_version_id: string | null;
  version_number: number | null;
  sections_synced: number;
  file_url: string | null;
  file_name: string;
  size_bytes: number;
  checksum: string;
  qc_report: AudioQcReport;
}

export interface AudioQcReport {
  analyzable: boolean;
  passed: boolean;
  standard: string;
  sample_rate: number | null;
  bit_depth: number | null;
  channels: number | null;
  duration_seconds: number | null;
  integrated_lufs: number | null;
  sample_peak_dbfs: number | null;
  true_peak_dbtp: number | null;
  clipped_samples: number;
  silence_ratio: number | null;
  leading_silence_seconds: number | null;
  trailing_silence_seconds: number | null;
  issues: Array<{ severity: "error" | "warning"; code: string; message: string }>;
}

export interface SessionSnapshot {
  id: string;
  review_version_id: string | null;
  fingerprint: string;
  reason: string;
  session_name: string | null;
  session_path: string | null;
  sample_rate: number | null;
  bit_depth: number | null;
  track_count: number;
  tracks: Array<Record<string, unknown>>;
  playlists: Array<Record<string, unknown>>;
  routing: Array<Record<string, unknown>>;
  bounce_sources: Array<{ name: string; sourceType: string }>;
  plugin_inventory: Array<Record<string, unknown>>;
  created_at: string;
}

export interface SessionRecallResult {
  dryRun: boolean;
  applied: boolean;
  sessionName: string | null;
  matchedTracks: number;
  missingTracks: string[];
  changes: Array<{ field: string; enabled: boolean; trackCount: number; trackNames: string[] }>;
  unsupportedFields: string[];
  recoverySnapshotId?: string | null;
  postRecallSnapshotError?: string;
}

export interface DeliveryOutput { kind: string; fileName: string; source?: string | null }
export interface DeliveryResult { job_id: string; manifest_id: string | null; outputs: BounceResult[] }
export interface DeliveryJob {
  id: string; preset: string; status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number; manifest_id: string | null; requested_outputs: DeliveryOutput[]; last_error: string | null; created_at: string;
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
  brief: {
    id: string;
    title: string;
    summary: string;
    priorities: Array<{ title: string; detail: string }>;
    conflicts: string[];
    generation_mode: "ai" | "deterministic";
    created_at: string;
  } | null;
  decisions: Array<{ id: string; title: string; status: "open" | "closed"; vote_count: number; winner_version_id: string | null }>;
  signoffs: Array<{ id: string; stage: string; status: string; member_name: string | null; responded_at: string | null }>;
  generatedAt: string;
  offline?: boolean;
  syncError?: string;
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
export const markFeedback = (commentId: string, seconds: number, name: string, category: string | null) =>
  invoke<Record<string, unknown>>("mark_feedback", { commentId, seconds, name, category });
export const resolveFeedback = (commentId: string) => invoke<Record<string, unknown>>("resolve_feedback", { commentId });
export const replyFeedback = (commentId: string, body: string) => invoke<Record<string, unknown>>("reply_feedback", { commentId, body });
export const captureSessionSnapshot = () => invoke<Record<string, unknown>>("capture_session_snapshot");
export const listSessionSnapshots = () => invoke<SessionSnapshot[]>("list_session_snapshots");
export const previewSessionRecall = (snapshot: SessionSnapshot) =>
  invoke<SessionRecallResult>("preview_session_recall", { snapshot });
export const recallSessionSnapshot = (snapshot: SessionSnapshot) =>
  invoke<SessionRecallResult>("recall_session_snapshot", { snapshot });
export const listExportSources = () => invoke<{ execution: string; sources: Array<{ name: string; sourceType: string }> }>("list_export_sources");
export const sendToReview = (fileName: string, source: string | null) => invoke<BounceResult>("send_to_review", { fileName, source });
export const runDelivery = (preset: string, outputDirectory: string, outputs: DeliveryOutput[]) =>
  invoke<DeliveryResult>("run_delivery", { preset, outputDirectory, outputs });
export const listDeliveryJobs = () => invoke<DeliveryJob[]>("list_delivery_jobs");
export const makeIntroCopy = (outputDirectory: string, sessionName: string) =>
  invoke<Record<string, unknown>>("make_intro_copy", { outputDirectory, sessionName });
export const autostartStatus = () => invoke<boolean>("autostart_status");
export const setAutostart = (enabled: boolean) => invoke<boolean>("set_autostart", { enabled });
export const checkForUpdate = () => invoke<{ available: boolean; current_version: string; version: string | null; notes: string | null }>("check_for_update");
export const installUpdate = () => invoke<boolean>("install_update");
export const diagnostics = () => invoke<Record<string, unknown>>("diagnostics");
