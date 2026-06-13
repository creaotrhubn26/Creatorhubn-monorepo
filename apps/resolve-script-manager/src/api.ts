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

// ── Fase 4: Playwright-opptak (kjør generert .mjs lokalt + ta opp video) ──
export interface PlaywrightStatus {
  nodePath: string;
  nodeOk: boolean;
  playwrightInstalled: boolean;
  chromeAvailable?: boolean;
  runtimeDir: string;
}
export async function playwrightStatus(): Promise<PlaywrightStatus> {
  return invoke<PlaywrightStatus>("playwright_status");
}
export async function setupPlaywright(): Promise<RunSummary> {
  return invoke<RunSummary>("setup_playwright");
}
export async function runPlaywrightDemo(scriptCode: string): Promise<RunSummary> {
  return invoke<RunSummary>("run_playwright_demo", { scriptCode });
}
/** #2: skarpe preview-screenshots via Playwright (ekte Chrome/Chromium). */
export async function playwrightCaptureShots(url: string): Promise<{ shots: Array<{ scrollPct: number; dataUrl: string }> }> {
  return invoke<{ shots: Array<{ scrollPct: number; dataUrl: string }> }>("playwright_capture_shots", { url });
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

/**
 * MockupConfig speiler frontend/.../mockup-video/mockupConfig.ts. Holdt som
 * en åpen Record her så Tauri-frontenden ikke trenger å duplisere hele typen
 * — UI-en bygger objektet og sender det rått til Rust-broen.
 */
export type MockupConfig = Record<string, unknown>;

/**
 * Render en mockup-video via den native pipelinen (scripts/mockup-polish-pro.mts).
 * Fremdrift kommer som "script-event" (bruk onScriptEvent). Resolver med
 * RunSummary når ferdig; result-eventet inneholder { outputPath, format }.
 */
export async function mockupRenderVideo(
  config: MockupConfig,
  clips: string[],
  outputPath: string,
  musicPath?: string | null,
): Promise<RunSummary> {
  return invoke<RunSummary>("mockup_render_video", {
    config,
    clips,
    outputPath,
    musicPath: musicPath ?? null,
  });
}

/**
 * Lagre et Guided Recorder-scene-opptak til disk. `dataBase64` er rå base64
 * (uten data:-prefiks). Returnerer absolutt sti til .webm — lagres som
 * scene.recordingPath og mates senere til mockupRenderVideo.
 */
export async function saveDemoRecording(
  projectId: string,
  sceneId: string,
  dataBase64: string,
): Promise<string> {
  return invoke<string>("save_demo_recording", { projectId, sceneId, dataBase64 });
}

/** Start native skjermopptak for en scene (Tauri/screencapture). Returnerer en
 *  session-id som sendes til stopScreenRecord. Brukes når getDisplayMedia
 *  mangler i webview-en. */
export async function startScreenRecord(projectId: string, sceneId: string): Promise<string> {
  return invoke<string>("start_screen_record", { projectId, sceneId });
}

/** Stopp et native skjermopptak → returnerer absolutt sti til opptaksfilen. */
export async function stopScreenRecord(sessionId: string): Promise<string> {
  return invoke<string>("stop_screen_record", { sessionId });
}

// ── Autonom demo (URL → ferdig narrert video) ──
/** Syntetiser narration for én scene (macOS say) → m4a + varighet. */
export async function synthesizeTts(projectId: string, sceneId: string, text: string, voice?: string): Promise<{ path: string; durationSec: number }> {
  return invoke<{ path: string; durationSec: number }>("synthesize_tts", { projectId, sceneId, text, voice });
}
/** Legg per-scene narration på sine tids-offset over Playwright-videoen → ferdig mp4 (~/Movies/Post Agent/). */
export async function muxDemoVideo(projectId: string, videoPath: string, segments: Array<{ audioPath: string; offsetMs: number }>, outName?: string): Promise<string> {
  return invoke<string>("mux_demo_video", { projectId, videoPath, segments, outName });
}

/** Product Brain: les en produkt-PDF (one-pager) → ren tekst (on-device). */
export async function extractPdfText(path: string): Promise<string> {
  return invoke<string>("extract_pdf_text", { path });
}

/** Åpne en fil med systemets standard-app (pålitelig for vilkårlige stier). */
export async function systemOpen(path: string): Promise<void> {
  return invoke<void>("system_open", { path });
}

/** Skriv ren tekst (f.eks. .srt) til en bruker-valgt sti. Returnerer stien. */
export async function demoWriteText(path: string, contents: string): Promise<string> {
  return invoke<string>("demo_write_text", { path, contents });
}

/** Skriv binærfil (f.eks. PNG) fra base64/dataURL til en sti. Returnerer stien. */
export async function demoWriteBinary(path: string, base64Data: string): Promise<string> {
  return invoke<string>("demo_write_binary", { path, base64Data });
}

/** Åpne manus-HTML i et print-vindu (→ «Lagre som PDF»). */
export async function demoPrintHtml(html: string): Promise<void> {
  return invoke<void>("demo_print_html", { html });
}

/** Hent ekte side-kontekst via reqwest (ingen CORS) — for AI Director. */
export async function demoFetchSiteContext(url: string): Promise<string> {
  return invoke<string>("demo_fetch_site_context", { url });
}

export interface EmbedCheck { embeddable: boolean; reason: string }

/** Sjekk om en URL kan vises i en <iframe> (X-Frame-Options/CSP). Fail-open. */
export async function checkUrlEmbeddable(url: string): Promise<EmbedCheck> {
  return invoke<EmbedCheck>("check_url_embeddable", { url });
}

export interface CaptureSource {
  kind: "mac_screen" | "ios_device" | "ios_simulator" | "iphone_mirroring";
  id: string;
  label: string;
  available: boolean;
}

/** List tilgjengelige capture-kilder (Mac-skjerm, kablede iOS-enheter, simulatorer, iPhone Mirroring). */
export async function listCaptureSources(): Promise<CaptureSource[]> {
  return invoke<CaptureSource[]>("list_capture_sources");
}

/** Åpne Apples iPhone Mirroring (trådløs speiling, macOS 15+). */
export async function openIphoneMirroring(): Promise<boolean> {
  return invoke<boolean>("open_iphone_mirroring");
}

/** Ta opp fra AVFoundation video-device-indeks (Mac-skjerm / kablet iOS) → mp4. */
export async function recordAvfoundation(
  projectId: string, sceneId: string, deviceIndex: string, durationSec: number,
): Promise<string> {
  return invoke<string>("record_avfoundation", { projectId, sceneId, deviceIndex, durationSec });
}

/** Ta opp en bootet iOS-simulator (krever full Xcode) → normalisert mp4. */
export async function recordSimulator(
  projectId: string, sceneId: string, udid: string, durationSec: number,
): Promise<string> {
  return invoke<string>("record_simulator", { projectId, sceneId, udid, durationSec });
}

/** Ta opp iPhone Mirroring-VINDUET (crop til vindusgeometri) → mp4. */
export async function recordIphoneMirroring(
  projectId: string, sceneId: string, screenIndex: string, durationSec: number,
): Promise<string> {
  return invoke<string>("record_iphone_mirroring", { projectId, sceneId, screenIndex, durationSec });
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
