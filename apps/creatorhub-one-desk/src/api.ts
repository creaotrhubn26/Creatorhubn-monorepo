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
