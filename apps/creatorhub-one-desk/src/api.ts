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
