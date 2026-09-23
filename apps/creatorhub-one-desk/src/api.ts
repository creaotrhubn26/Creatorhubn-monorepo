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

// ── CreatorHub Bridge: local video + camera/production control ─────

export type BridgeAvailability =
  | "ready"
  | "runtime_required"
  | "tool_required"
  | "sdk_required"
  | "device_required";

export interface BridgeCapability {
  id: string;
  label: string;
  role: "video_transport" | "camera_control" | "production_control";
  availability: BridgeAvailability;
  local_only: boolean;
  detail: string;
}

export interface BridgeStatus {
  product_name: string;
  local_monitoring_requires_cloud: boolean;
  video_sources: BridgeCapability[];
  camera_controls: BridgeCapability[];
  production_controls: BridgeCapability[];
}

export interface BridgePreviewSource {
  id: string;
  label: string;
  role: "multiview" | "camera";
  playback_url: string;
  quality_label: string;
}

export interface BridgePreviewStatus {
  running: boolean;
  port: number | null;
  service_type: string;
  manifest_path: string;
  source_count: number;
  sources: BridgePreviewSource[];
  last_error: string | null;
}

export interface NdiDiscoveryResult {
  runtime_path: string;
  runtime_version: string;
  sources: Array<{ name: string; url_address: string | null }>;
}

export type NdiPreviewPhase = "idle" | "starting" | "running" | "stopped" | "failed";

export interface NdiPreviewStatus {
  phase: NdiPreviewPhase;
  source_name: string | null;
  frames_received: number;
  width: number | null;
  height: number | null;
  frames_per_second: number | null;
  playback_url: string | null;
  ffmpeg_path: string | null;
  last_error: string | null;
}

export interface BlackmagicProbe {
  api_base: string;
  product: {
    device_name?: string | null;
    product_name?: string | null;
    software_version?: string | null;
  };
  recording: boolean;
  clip_count: number;
  system: unknown;
}

export interface ObsProbe {
  obs_studio_version: string | null;
  obs_websocket_version: string | null;
  recording: boolean | null;
  current_program_scene: string | null;
  scenes: string[];
  available_requests: string[];
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  return invoke<BridgeStatus>("bridge_status");
}

export async function getBridgePreviewStatus(): Promise<BridgePreviewStatus> {
  return invoke<BridgePreviewStatus>("bridge_preview_status");
}

export async function saveBridgePreviewSources(
  sources: BridgePreviewSource[],
): Promise<BridgePreviewStatus> {
  return invoke<BridgePreviewStatus>("save_bridge_preview_sources", { sources });
}

export async function discoverNdiSources(timeoutMs = 1500): Promise<NdiDiscoveryResult> {
  return invoke<NdiDiscoveryResult>("discover_ndi_sources", { timeoutMs });
}

export async function getNdiPreviewStatus(): Promise<NdiPreviewStatus> {
  return invoke<NdiPreviewStatus>("ndi_preview_status");
}

export async function startNdiPreview(source: {
  name: string;
  url_address: string | null;
}): Promise<NdiPreviewStatus> {
  return invoke<NdiPreviewStatus>("start_ndi_preview", {
    sourceName: source.name,
    urlAddress: source.url_address,
  });
}

export async function stopNdiPreview(): Promise<NdiPreviewStatus> {
  return invoke<NdiPreviewStatus>("stop_ndi_preview");
}

export async function probeBlackmagicCamera(baseUrl: string): Promise<BlackmagicProbe> {
  return invoke<BlackmagicProbe>("probe_blackmagic_camera", { baseUrl });
}

export async function setBlackmagicRecording(args: {
  baseUrl: string;
  recording: boolean;
  clipName?: string | null;
}): Promise<{ recording: boolean }> {
  return invoke<{ recording: boolean }>("set_blackmagic_recording", {
    baseUrl: args.baseUrl,
    recording: args.recording,
    clipName: args.clipName ?? null,
  });
}

export async function probeObs(args: {
  endpoint: string;
  password?: string | null;
}): Promise<ObsProbe> {
  return invoke<ObsProbe>("probe_obs", {
    endpoint: args.endpoint,
    password: args.password || null,
  });
}

export async function runObsAction(args: {
  endpoint: string;
  password?: string | null;
  action: "start_record" | "stop_record" | "set_current_program_scene";
  sceneName?: string | null;
}): Promise<unknown> {
  return invoke("run_obs_action", {
    endpoint: args.endpoint,
    password: args.password || null,
    action: args.action,
    sceneName: args.sceneName ?? null,
  });
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

// ── Lightroom Classic integration ─────────────────────────────────
export interface LightroomIntegrationStatus {
  classic_installed: boolean;
  classic_path: string | null;
  plugin_installed: boolean;
  plugin_path: string;
  plugin_version: string | null;
  plugin_account_email: string | null;
  plugin_update_required: boolean;
  connected_user_email: string | null;
  restart_required: boolean;
}

export async function getLightroomIntegrationStatus(): Promise<LightroomIntegrationStatus> {
  return invoke<LightroomIntegrationStatus>("lightroom_integration_status");
}

export async function installLightroomPlugin(): Promise<LightroomIntegrationStatus> {
  return invoke<LightroomIntegrationStatus>("install_lightroom_plugin");
}

export async function uninstallLightroomPlugin(): Promise<LightroomIntegrationStatus> {
  return invoke<LightroomIntegrationStatus>("uninstall_lightroom_plugin");
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

// ── Auto-eject + manuell eject ───────────────────────────────────────
export async function ejectVolume(mountPath: string): Promise<void> {
  return invoke<void>("eject_volume", { mountPath });
}

export async function getAutoEjectPref(): Promise<boolean> {
  return invoke<boolean>("get_auto_eject_pref");
}

export async function setAutoEjectPref(autoEject: boolean): Promise<void> {
  return invoke<void>("set_auto_eject_pref", { autoEject });
}

/// Manuell iPad-input når Bonjour er blokkert (bedrifts-VLAN, WiFi-
/// isolasjon). Tar IP + port + visningsnavn fra iPad-appens "Vis
/// pairing-info"-skjerm.
export async function addManualIpad(args: {
  deviceName: string;
  ip: string;
  port: number;
  deviceId?: string | null;
}): Promise<unknown> {
  return invoke("add_manual_ipad", {
    deviceName: args.deviceName,
    ip: args.ip,
    port: args.port,
    deviceId: args.deviceId ?? null,
  });
}

/// Oppdater Mac-tray-tooltip dynamisk.
export async function setTrayStatus(tooltip: string): Promise<void> {
  return invoke<void>("set_tray_status", { tooltip });
}

export interface DestCapacity {
  path: string;
  total_bytes: number | null;
  free_bytes: number | null;
  needed_bytes: number;
  sufficient: boolean;
  safe_margin: boolean;
}

export async function checkDestinationsCapacity(
  destPaths: string[],
  bytesNeeded: number,
): Promise<DestCapacity[]> {
  return invoke<DestCapacity[]>("check_destinations_capacity", {
    destPaths,
    bytesNeeded,
  });
}

export async function macosNotification(title: string, body: string): Promise<void> {
  return invoke<void>("macos_notification", { title, body });
}

export interface Prefs {
  auto_eject: boolean;
  default_dest_ids: string[];
}

export async function getPrefs(): Promise<Prefs> {
  return invoke<Prefs>("get_prefs");
}

export async function saveDefaultDestIds(destIds: string[]): Promise<void> {
  return invoke<void>("save_default_dest_ids", { destIds });
}

export interface BonjourStatusEvent {
  discovered_count: number;
  elapsed_secs: number;
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

/// Verifiser B2-creds + bucket-eksistens FØR cloud-destinasjon committes.
/// Returnerer bucket-navn på suksess, error-melding ved feil.
export async function testB2Connection(
  keyId: string,
  applicationKey: string,
  bucketId: string,
): Promise<string> {
  return invoke<string>("test_b2_connection", {
    keyId,
    applicationKey,
    bucketId,
  });
}

export interface SessionStatus {
  session_id: string;
  mount_path: string;
  volume_label: string;
  state:
    | "running"
    | "completed"
    | "cancelled"
    | "failed"
    | "mount_disappeared";
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

// ── Crash-recovery (session_log) ─────────────────────────────────────
export interface InterruptedSession {
  session_id: string;
  started_at_ms: number;
  mount_path: string;
  volume_label: string;
  total_files: number;
  files_completed_per_dest: [string, number][];
  last_event_ms: number;
}

export async function listInterruptedSessions(): Promise<InterruptedSession[]> {
  return invoke<InterruptedSession[]>("list_interrupted_sessions");
}

export async function resumeInterruptedSession(sessionId: string): Promise<string> {
  return invoke<string>("resume_interrupted_session", { sessionId });
}

export async function discardInterruptedSession(sessionId: string): Promise<void> {
  return invoke<void>("discard_interrupted_session", { sessionId });
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
  mount_path: string;
  succeeded: number;
  failed: number;
  cancelled: boolean;
}

/// Emit'es én gang per destinasjon når den blir deaktivert for resten
/// av sesjonen pga vedvarende feil. Etterfølgende filer i samme session
/// skipper denne destinasjonen — andre destinasjoner fortsetter.
export interface CopyDestDisabledEvent {
  session_id: string;
  dest_id: string;
  dest_label: string;
  reason_code: "DEST_NO_SPACE" | "DEST_PERM_DENIED" | string;
  reason_message: string;
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

// ─── Desk identity + auto-pair result (F5c) ────────────────────────

export interface DeskIdentity {
  desk_id: string;
  desk_name: string;
}

export interface PairResultEvent {
  fullname: string;
  success: boolean;
  ipad_device_id: string | null;
  error: string | null;
}

export async function currentDeskIdentity(): Promise<DeskIdentity> {
  return invoke<DeskIdentity>("current_desk_identity");
}
