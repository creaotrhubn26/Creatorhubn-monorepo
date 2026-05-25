import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  CullSession,
  CullSessionSummary,
  HistoryRecord,
  LookPack,
  LookPackIndex,
  MountedCard,
  ProjectTemplate,
  ProjectTemplateIndex,
  Registry,
  RunSummary,
  ScriptEvent,
  WorkflowMap,
} from "./types";

export { convertFileSrc };

export async function listScripts(): Promise<Registry> {
  return invoke<Registry>("list_scripts");
}

export async function listWorkflows(): Promise<WorkflowMap> {
  return invoke<WorkflowMap>("list_workflows");
}

export async function readWeddingTemplate(): Promise<unknown> {
  return invoke<unknown>("read_wedding_template");
}

export async function readLookPack(packId?: string): Promise<LookPack> {
  return invoke<LookPack>("read_look_pack", { packId });
}

export async function listProjectTemplates(): Promise<ProjectTemplateIndex> {
  return invoke<ProjectTemplateIndex>("list_project_templates");
}

export async function readProjectTemplate(templateId: string): Promise<ProjectTemplate> {
  return invoke<ProjectTemplate>("read_project_template", { templateId });
}

export async function listLookPacks(): Promise<LookPackIndex> {
  return invoke<LookPackIndex>("list_look_packs");
}

export async function runHealthCheck(): Promise<RunSummary> {
  return invoke<RunSummary>("run_health_check");
}

export async function executeScript(
  scriptId: string,
  params: Record<string, unknown> = {},
  dryRun = false,
): Promise<RunSummary> {
  return invoke<RunSummary>("execute_script", { scriptId, params, dryRun });
}

export async function openScriptFolder(): Promise<string> {
  return invoke<string>("open_script_folder");
}

export async function getPythonRoot(): Promise<string> {
  return invoke<string>("get_python_root");
}

export async function getRunHistory(): Promise<HistoryRecord[]> {
  return invoke<HistoryRecord[]>("get_run_history");
}

export async function launchResolve(): Promise<string> {
  return invoke<string>("launch_resolve");
}

export async function openResolvePreferences(): Promise<string> {
  return invoke<string>("open_resolve_preferences");
}

export async function revealResolveConfigs(): Promise<string> {
  return invoke<string>("reveal_resolve_configs");
}

export async function clearRunHistory(): Promise<void> {
  return invoke<void>("clear_run_history");
}

export async function getAppDataDir(): Promise<string> {
  return invoke<string>("get_app_data_dir");
}

export async function listMountedCards(): Promise<MountedCard[]> {
  return invoke<MountedCard[]>("list_mounted_cards");
}

export async function rescanCards(): Promise<MountedCard[]> {
  return invoke<MountedCard[]>("rescan_cards");
}

export async function cancelScript(runId: string): Promise<boolean> {
  return invoke<boolean>("cancel_script", { runId });
}

export async function updateAppSettings(settings: Record<string, string>): Promise<void> {
  return invoke<void>("update_app_settings", { settings });
}

export async function getAppSettings(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("get_app_settings");
}

export interface WatchedFolder {
  path: string;
  started_at: string;
  seen_count: number;
}

export interface FolderClipsAddedEvent {
  folder: string;
  newClips: string[];
  totalSeen: number;
}

export async function startWatchingFolder(folderPath: string): Promise<void> {
  return invoke<void>("start_watching_folder", { folderPath });
}

export async function stopWatchingFolder(folderPath: string): Promise<void> {
  return invoke<void>("stop_watching_folder", { folderPath });
}

export async function listWatchedFolders(): Promise<WatchedFolder[]> {
  return invoke<WatchedFolder[]>("list_watched_folders");
}

export async function onFolderClipsAdded(
  handler: (event: FolderClipsAddedEvent) => void,
): Promise<UnlistenFn> {
  return listen<FolderClipsAddedEvent>("folder-clips-added", (e) => handler(e.payload));
}

export async function listRunningScripts(): Promise<Array<[string, number]>> {
  return invoke<Array<[string, number]>>("list_running_scripts");
}

export async function scanFolder(path: string): Promise<MountedCard> {
  return invoke<MountedCard>("scan_folder", { path });
}

export async function saveCullSession(session: CullSession): Promise<string> {
  return invoke<string>("save_cull_session", { session });
}

export async function loadCullSession(sessionId: string): Promise<CullSession | null> {
  return invoke<CullSession | null>("load_cull_session", { sessionId });
}

export async function listCullSessions(): Promise<CullSessionSummary[]> {
  return invoke<CullSessionSummary[]>("list_cull_sessions");
}

export async function onCardsChanged(
  handler: (cards: MountedCard[]) => void,
): Promise<UnlistenFn> {
  return listen<MountedCard[]>("cards-changed", (e) => handler(e.payload));
}

export async function onScriptEvent(
  handler: (event: ScriptEvent) => void,
): Promise<UnlistenFn> {
  return listen<ScriptEvent>("script-event", (e) => handler(e.payload));
}

// ─── Role Room API consumers ─────────────────────────────────────────────

export interface RoleRoomScene {
  id: string;
  sceneNumber?: number;
  title?: string;
  description?: string;
  setting?: string;
  timeOfDay?: string;
  intExt?: string;
  characters?: unknown[];
}

export interface RoleRoomEquipment {
  id: string;
  name?: string;
  brand?: string;
  model?: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface RoleRoomProjectSettings {
  resolution?: string | null;
  frameRate?: number | null;
  colorScience?: string | null;
  primaryCamera?: { brand?: string; model?: string; name?: string } | null;
}

export interface RoleRoomClip {
  id: string;
  sceneId?: string;
  sceneNumber?: number;
  sceneTitle?: string;
  shotIndex?: number;
  takeNumber?: number;
  mediaKey?: string;
  capturedAt?: string;
  circled?: boolean;
  processingStatus?: string;
}

export interface RoleRoomProduction {
  id: string;
  name: string;
  projectType?: string;
  eventDate?: string;
  activeSeats?: number;
}

export async function fetchRoleRoomScenes(projectId: string): Promise<{ scenes: RoleRoomScene[] }> {
  return invoke("role_room_fetch_scenes", { projectId });
}

export async function fetchRoleRoomEquipment(
  projectId: string,
): Promise<{ equipment: RoleRoomEquipment[]; projectSettings: RoleRoomProjectSettings | null }> {
  return invoke("role_room_fetch_equipment", { projectId });
}

export async function fetchRoleRoomLiveSetState(
  projectId: string,
): Promise<{ clips: RoleRoomClip[]; sceneMarkers: Array<{ sceneId: string; sceneNumber?: number; title?: string }> }> {
  return invoke("role_room_fetch_live_set_state", { projectId });
}

export async function fetchMyProductions(): Promise<{ productions: RoleRoomProduction[] }> {
  return invoke("role_room_my_productions");
}

export async function fetchMySeats(): Promise<{
  seats: Array<{ projectId: string; projectName: string; projectType?: string; grantedAt?: string }>;
}> {
  return invoke("role_room_my_seats");
}

// ─── Media probing (ffprobe) ─────────────────────────────────────────────

export interface LogCurveGuess {
  label: string; // e.g. "Canon C-Log 2 (guessed)", "S-Log 3", "HLG"
  confidence: number; // 0..1
  source: string; // "ffprobe_transfer" | "filename" | "codec_container"
  suggestedCstInputGamma?: string;
  suggestedCstInputGamut?: string;
}

export interface MediaInfo {
  path: string;
  fileName: string;
  width?: number;
  height?: number;
  frameRate?: number;
  durationSeconds?: number;
  codec?: string;
  colorSpace?: string;
  colorTransfer?: string;
  colorPrimaries?: string;
  videoStandard: string; // "PAL" | "NTSC" | "Cinema" | "Other"
  logCurve?: LogCurveGuess;
  error?: string;
}

export interface ProbeSummary {
  files: MediaInfo[];
  totalFiles: number;
  probedCount: number;
  errorCount: number;
  dominantFrameRate?: number;
  dominantResolution?: string;
  dominantStandard?: string; // "PAL" | "NTSC" | "Cinema" | "Other"
  dominantLogCurve?: LogCurveGuess;
  mixedStandards: boolean;
  mixedLogCurves: boolean;
  ffprobeAvailable: boolean;
}

export async function probeMediaFiles(paths: string[]): Promise<ProbeSummary> {
  return invoke("probe_media_files", { paths });
}

export interface ClipDownloadEntry {
  clipId: string;
  mediaKey: string | null;
  downloadUrl: string | null;
  sceneId?: string;
  sceneTitle?: string;
  sceneNumber?: number;
  takeNumber?: number;
  fileName: string;
  error?: string | null;
}

export async function fetchClipDownloadUrls(
  projectId: string,
  clipIds: string[],
): Promise<{ urls: ClipDownloadEntry[] }> {
  return invoke("role_room_fetch_clip_download_urls", { projectId, clipIds });
}

export async function downloadClip(downloadUrl: string, destPath: string): Promise<number> {
  return invoke("role_room_download_clip", { downloadUrl, destPath });
}
