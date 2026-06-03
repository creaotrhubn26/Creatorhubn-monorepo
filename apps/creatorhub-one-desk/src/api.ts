import { invoke } from "@tauri-apps/api/core";

export interface StoredConfig {
  api_base: string;
  project_id: string;
  has_token: boolean;
}

export interface ProjectSummary {
  id: string;
  name: string;
}

export interface MemoryCardConfig {
  label?: string;
  type?: string;
  capacity?: string;
  dayNumber?: number;
  dayName?: string;
  count?: number;
  estimatedPhotos?: number;
}

export interface SelectedMemoryCard {
  type?: string;
  capacity?: string;
  brand?: string;
  model?: string;
  count?: number;
  estimatedPhotos?: number;
}

export interface DitDestination {
  id: string;
  project_id: string;
  destination_type: string;
  label: string;
  path?: string;
  storage_type?: string;
  priority?: number;
  status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectInfo {
  project: ProjectSummary;
  memory_card_configs: MemoryCardConfig[];
  selected_memory_cards: SelectedMemoryCard[];
  destinations: DitDestination[];
}

export async function getDefaultApiBase(): Promise<string> {
  return invoke<string>("default_api_base");
}

export async function loadStoredConfig(): Promise<StoredConfig | null> {
  return invoke<StoredConfig | null>("load_stored_config");
}

export async function saveHelperConfig(args: {
  apiBase: string;
  token: string;
  projectId: string;
}): Promise<StoredConfig> {
  return invoke<StoredConfig>("save_helper_config", {
    apiBase: args.apiBase,
    token: args.token,
    projectId: args.projectId,
  });
}

// ── Google OAuth / device-auth ────────────────────────────────────
export interface DeviceTokenStatus {
  user_email: string;
  user_name: string;
  api_base: string;
}

export async function deviceTokenStatus(): Promise<DeviceTokenStatus | null> {
  return invoke<DeviceTokenStatus | null>("device_token_status");
}

export async function startGoogleLogin(apiBase?: string): Promise<string> {
  return invoke<string>("start_google_login", { apiBase: apiBase ?? null });
}

export interface StartLoginResult {
  authorization_url: string;
  state: string;
}

export async function startGoogleLoginV2(apiBase?: string): Promise<StartLoginResult> {
  return invoke<StartLoginResult>("start_google_login_v2", { apiBase: apiBase ?? null });
}

/// Returnerer true når completion er klar (token lagret, prosjekter
/// hentet, desktop-auth-completed-event emittert). False = fortsatt
/// venter. Kaste Error hvis state utløpt eller backend feilet.
export async function pollOauthCompletion(apiBase: string, state: string): Promise<boolean> {
  return invoke<boolean>("poll_oauth_completion", { apiBase, state });
}

export async function refreshProjectsFromApi(): Promise<number> {
  return invoke<number>("refresh_projects_from_api");
}

export async function desktopLogout(): Promise<void> {
  return invoke<void>("desktop_logout");
}

// ── Multi-project ─────────────────────────────────────────────────
export interface ProjectEntry {
  project_id: string;
  label: string;
  api_base: string;
  token: string;
  last_used_ms: number;
}

export async function listProjects(): Promise<ProjectEntry[]> {
  return invoke<ProjectEntry[]>("list_projects");
}

export async function activeProjectId(): Promise<string | null> {
  return invoke<string | null>("active_project_id");
}

export async function setActiveProject(projectId: string): Promise<void> {
  return invoke<void>("set_active_project", { projectId });
}

export async function removeProject(projectId: string): Promise<void> {
  return invoke<void>("remove_project", { projectId });
}

export async function updateProjectLabel(projectId: string, label: string): Promise<void> {
  return invoke<void>("update_project_label", { projectId, label });
}

export async function clearHelperConfig(): Promise<void> {
  return invoke<void>("clear_helper_config");
}

export async function fetchProjectInfo(): Promise<ProjectInfo> {
  return invoke<ProjectInfo>("fetch_project_info");
}

export interface DetectedMount {
  mount_path: string;
  volume_label: string;
  camera_guess: string | null;
  total_bytes_capacity: number | null;
  total_bytes_free: number | null;
  photo_count: number;
  video_count: number;
  photo_bytes: number;
  video_bytes: number;
  layout_signals: string[];
}

export async function listDetectedMounts(): Promise<DetectedMount[]> {
  return invoke<DetectedMount[]>("list_detected_mounts");
}

export async function rescanMounts(): Promise<DetectedMount[]> {
  return invoke<DetectedMount[]>("rescan_mounts");
}

export interface DestinationSpec {
  id: string;
  label: string;
  path: string;
  /** Hvis satt: dit_destinations.id — kopier blir registrert som dit_backup_jobs i backend. */
  backend_id?: string | null;
  /// Cloud-felter — settes når destinasjonen er en B2-bucket
  cloud_provider?: string | null;
  cloud_bucket_id?: string | null;
  cloud_credentials?: {
    key_id: string;
    application_key: string;
  } | null;
}

/// Med-creds-shape returnert av /api/dit/projects/:id/destinations/with-creds.
/// Backend setter cloud_credentials til null for lokale destinasjoner.
export interface DestinationWithCreds {
  id: string;
  label: string;
  path?: string;
  destination_type: string;
  cloud_provider?: string | null;
  cloud_bucket?: string | null;
  cloud_bucket_id?: string | null;
  cloud_prefix?: string | null;
  cloud_credentials: { key_id: string; application_key: string } | null;
  cloud_error?: string | null;
}

export async function fetchDestinationsWithCreds(): Promise<DestinationWithCreds[]> {
  return invoke<DestinationWithCreds[]>("fetch_destinations_with_creds");
}

export interface SessionStatus {
  session_id: string;
  mount_path: string;
  volume_label: string;
  state: "running" | "completed" | "cancelled" | "failed";
  file_count: number;
  total_bytes: number;
  succeeded: number;
  failed: number;
  started_at_ms: number;
}

export async function startCopySession(args: {
  mountPath: string;
  volumeLabel: string;
  destinations: DestinationSpec[];
}): Promise<string> {
  return invoke<string>("start_copy_session", {
    mountPath: args.mountPath,
    volumeLabel: args.volumeLabel,
    destinations: args.destinations,
  });
}

export async function cancelCopySession(sessionId: string): Promise<boolean> {
  return invoke<boolean>("cancel_copy_session", { sessionId });
}

export async function listCopySessions(): Promise<SessionStatus[]> {
  return invoke<SessionStatus[]>("list_copy_sessions");
}

// Copy-event payloads from Rust
export interface CopySessionStartedEvent {
  session_id: string;
  mount_path: string;
  file_count: number;
  total_bytes: number;
}

export interface CopyFileStartedEvent {
  session_id: string;
  source_path: string;
  size: number;
}

export interface CopyFileProgressEvent {
  session_id: string;
  source_path: string;
  dest_id: string;
  bytes_copied: number;
  bytes_total: number;
}

export interface CopyFileCompletedEvent {
  session_id: string;
  source_path: string;
  dest_id: string;
  success: boolean;
  hash: string | null;
  error: string | null;
  skipped: boolean;
}

export interface CopySessionCompletedEvent {
  session_id: string;
  succeeded: number;
  failed: number;
  cancelled: boolean;
}

// ─── iPad-paring (F5) ──────────────────────────────────────────

export interface DiscoveredIpad {
  fullname: string;
  device_id: string | null;
  device_name: string;
  app_version: string | null;
  addresses: string[];
  port: number;
}

export interface PairedIpad {
  device_id: string;
  device_name: string;
  paired_at_iso: string;
}

export interface PendingPin {
  pin: string;
  fullname: string;
  device_name: string;
  expires_at_unix_ms: number;
}

export async function listDiscoveredIpads(): Promise<DiscoveredIpad[]> {
  return invoke<DiscoveredIpad[]>("list_discovered_ipads");
}

export async function listPairedIpads(): Promise<PairedIpad[]> {
  return invoke<PairedIpad[]>("list_paired_ipads");
}

export async function currentPairingPin(): Promise<PendingPin | null> {
  return invoke<PendingPin | null>("current_pairing_pin");
}

export async function generatePairingPin(args: {
  fullname: string;
  deviceName: string;
}): Promise<PendingPin> {
  return invoke<PendingPin>("generate_pairing_pin", {
    fullname: args.fullname,
    deviceName: args.deviceName,
  });
}

export async function cancelPairingPin(): Promise<void> {
  return invoke<void>("cancel_pairing_pin");
}

export async function confirmPairIpad(args: {
  deviceId: string;
  deviceName: string;
}): Promise<PairedIpad[]> {
  return invoke<PairedIpad[]>("confirm_pair_ipad", {
    deviceId: args.deviceId,
    deviceName: args.deviceName,
  });
}

export async function unpairIpad(deviceId: string): Promise<PairedIpad[]> {
  return invoke<PairedIpad[]>("unpair_ipad", { deviceId });
}

// ─── Capture sessions + WebSocket subscriber (F6a) ──────────────

export interface CaptureSessionSummary {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  owner_user_id: string;
  is_active: boolean;
}

export interface CaptureSubscriberStateEvent {
  session_id: string;
  state: "connecting" | "connected" | "disconnected" | "stopped" | "error";
  message: string | null;
}

export interface CaptureEventPayload {
  session_id: string;
  raw: unknown;
}

export async function listCaptureSessions(): Promise<CaptureSessionSummary[]> {
  return invoke<CaptureSessionSummary[]>("list_capture_sessions");
}

export async function startCaptureSubscription(sessionId: string): Promise<void> {
  return invoke<void>("start_capture_subscription", { sessionId });
}

export async function stopCaptureSubscription(sessionId: string): Promise<boolean> {
  return invoke<boolean>("stop_capture_subscription", { sessionId });
}

export async function listActiveCaptureSubscriptions(): Promise<string[]> {
  return invoke<string[]>("list_active_capture_subscriptions");
}

export interface MirrorDestination {
  id: string;
  label: string;
  path: string;
}

export interface CaptureMirrorEvent {
  session_id: string;
  asset_id: string;
  state: "queued" | "downloading" | "copying" | "done" | "failed";
  filename: string | null;
  error: string | null;
}

export async function enableMirrorForSession(args: {
  sessionId: string;
  destinations: MirrorDestination[];
}): Promise<void> {
  return invoke<void>("enable_mirror_for_session", {
    sessionId: args.sessionId,
    destinations: args.destinations,
  });
}

export async function disableMirrorForSession(sessionId: string): Promise<boolean> {
  return invoke<boolean>("disable_mirror_for_session", { sessionId });
}

export async function enabledMirrorSessions(): Promise<string[]> {
  return invoke<string[]>("enabled_mirror_sessions");
}
