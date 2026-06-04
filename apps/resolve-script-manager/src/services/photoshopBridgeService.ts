/**
 * photoshopBridgeService — typed klient mot Tauri-app'ens WebSocket-bro
 * til Adobe Photoshop UXP-pluginen ("Post Agent Bridge").
 *
 * Tauri-siden eier WS-serveren (port 1733). Denne service-en wrapper
 * `photoshop_send_command` / `photoshop_status` og `photoshop://*`
 * events slik at UI-laget kan jobbe mot et typestrengt vokabular i
 * stedet for løse invoke-strenger.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ---------------------------------------------------------------------------
// Status + events
// ---------------------------------------------------------------------------

export interface PhotoshopBridgeStatus {
  connected: boolean;
  plugin_version: string | null;
  photoshop_version: string | null;
  port: number;
}

export interface PhotoshopBridgeEvent {
  event: string;
  data: unknown;
}

export async function getStatus(): Promise<PhotoshopBridgeStatus> {
  return invoke<PhotoshopBridgeStatus>("photoshop_status");
}

export function onStatus(
  handler: (status: PhotoshopBridgeStatus) => void,
): Promise<UnlistenFn> {
  return listen<PhotoshopBridgeStatus>("photoshop://status", (e) =>
    handler(e.payload),
  );
}

export function onEvent(
  handler: (event: PhotoshopBridgeEvent) => void,
): Promise<UnlistenFn> {
  return listen<PhotoshopBridgeEvent>("photoshop://event", (e) =>
    handler(e.payload),
  );
}

// ---------------------------------------------------------------------------
// Command vocabulary
// ---------------------------------------------------------------------------

export interface DocumentSummary {
  id: number;
  name: string;
  width: number;
  height: number;
  resolution: number;
  path: string | null;
}

export interface AppInfo {
  photoshop_version: string | null;
  locale: string | null;
  active_document: DocumentSummary | null;
  documents: DocumentSummary[];
}

export interface LayerSummary {
  /** Layer-navn, prefikset med gruppe-stier hvis nested ("Background/Logo"). */
  name: string;
  /** Photoshop layer-kind ("text", "smartObject", "pixel", "group", etc.). */
  kind: string;
  visible: boolean;
  has_text: boolean;
  is_smart_object: boolean;
}

export interface LayerListResult {
  layers: LayerSummary[];
  count: number;
}

export interface ResolveStillMetadata {
  source: "davinci-resolve";
  clip: string;
  frame: string;
  fps: string;
  project: string;
  epoch: number;
}

export interface ResolveInboxItem {
  path: string;
  name: string;
  metadata: ResolveStillMetadata | null;
}

export interface ResolveInboxResult {
  items: ResolveInboxItem[];
  inbox_dir: string | null;
  count: number;
}

export type ResolveLanguage =
  | "AUTO"
  | "DANISH"
  | "DUTCH"
  | "ENGLISH"
  | "FRENCH"
  | "GERMAN"
  | "ITALIAN"
  | "JAPANESE"
  | "KOREAN"
  | "MANDARIN_SIMPLIFIED"
  | "MANDARIN_TRADITIONAL"
  | "NORWEGIAN"
  | "PORTUGUESE"
  | "RUSSIAN"
  | "SPANISH"
  | "SWEDISH";

export type ResolveTrackType = "video" | "audio" | "subtitle";

export interface ResolveExportBackResult {
  exported_to: string;
  outbox_dir: string;
  next_step: string;
}

export interface ResolveIntellisearchItem {
  media_pool_item_id: string;
  clip_name: string;
  file_path: string;
  duration_frames: number;
  fps: number;
  analyzed: boolean;
}

export type ResolveIntellisearchResult =
  | { found: false; hint?: string }
  | {
      found: true;
      file: string;
      schema_version: number;
      project: string;
      folder: string;
      epoch: number;
      mode: string;
      items: ResolveIntellisearchItem[];
      total: number;
    };

export interface ThumbnailResult {
  /** Base64-encoded PNG bytes (uten "data:image/png;base64,"-prefix). */
  base64: string;
  /** Thumbnail-størrelse i piksler. */
  width: number;
  height: number;
  /** Original dokument-dimensjoner (for å beregne nedskalering). */
  doc_width: number;
  doc_height: number;
  mime_type: "image/png";
}

export type SelectionInfoResult =
  | { exists: false }
  | {
      exists: true;
      bounds: { top: number; left: number; bottom: number; right: number };
      width: number;
      height: number;
      doc_width: number;
      doc_height: number;
      coverage_pct: number;
    };

export type ExportFormat = "jpg" | "jpeg" | "png" | "psd" | "tiff" | "tif";

export type TemplateFieldType = "text" | "image" | "unsupported";

export interface TemplateField {
  key: string;
  type: TemplateFieldType;
  layer_name: string;
  kind: string;
}

export interface TemplateScanResult {
  template_path: string;
  template: DocumentSummary | null;
  fields: TemplateField[];
  /**
   * Alle text- og smart-object-layers — uavhengig av om de matcher
   * `{{key}}`-mønsteret. Bruk for å tilby auto-rename når Irlin har
   * et template uten konvensjon.
   */
  all_candidates?: Array<{
    layer_name: string;
    type: "text" | "image";
    has_field_pattern: boolean;
    suggested_key: string;
  }>;
}

export interface TemplateAutoRenameResult {
  template_path: string;
  output_path: string;
  renamed: Array<{ old_name: string; new_key: string }>;
  skipped: Array<{ layer_name: string; new_key: string; reason: string }>;
}

export interface TemplateRenderResult {
  template_path: string;
  output_path: string;
  format: ExportFormat;
  applied: Array<{ key: string; type: "text" | "image" }>;
  skipped: Array<{ key: string; reason: string }>;
}

export interface BatchRenderItem {
  data: Record<string, string>;
  output_path: string;
  format?: ExportFormat;
  quality?: number;
}

export interface BatchRenderResult {
  template_path: string;
  total: number;
  succeeded: number;
  failed_count: number;
  items: Array<{
    index: number;
    output_path: string;
    format: ExportFormat;
    applied: Array<{ key: string; type: "text" | "image" }>;
    skipped: Array<{ key: string; reason: string }>;
  }>;
  failed: Array<{ index: number; output_path: string | null; error: string }>;
}

export interface MultiAspectExportResult {
  master_path: string;
  output_dir: string;
  base_name: string;
  total: number;
  succeeded: number;
  failed_count: number;
  items: Array<{
    aspect: string;
    output_path: string;
    width: number;
    height: number;
  }>;
  failed: Array<{ aspect: string; error: string }>;
}

export type AdjustmentType =
  | "brightness_contrast"
  | "hue_saturation"
  | "color_balance"
  | "curves";

export interface RGB {
  r?: number;
  g?: number;
  b?: number;
  red?: number;
  green?: number;
  blue?: number;
}

export type AdjustmentParams =
  | { brightness?: number; contrast?: number } // brightness_contrast
  | { hue?: number; saturation?: number; lightness?: number } // hue_saturation
  | {
      midtones?: [number, number, number];
      shadows?: [number, number, number];
      highlights?: [number, number, number];
      preserveLuminosity?: boolean;
    } // color_balance
  | { points: Array<[number, number]> }; // curves

export interface DropShadowParams {
  opacity?: number;
  angle?: number;
  distance?: number;
  size?: number;
  spread?: number;
  color?: RGB;
}

export interface OuterGlowParams {
  opacity?: number;
  size?: number;
  color?: RGB;
}

export interface ColorOverlayParams {
  opacity?: number;
  color: RGB;
  blend_mode?: string;
}

export interface StyleEffects {
  drop_shadow?: DropShadowParams;
  outer_glow?: OuterGlowParams;
  color_overlay?: ColorOverlayParams;
}

async function send<T>(command: string, params?: unknown): Promise<T> {
  return invoke<T>("photoshop_send_command", { command, params: params ?? null });
}

export const photoshop = {
  ping: () => send<{ pong: true; time: number }>("ping"),

  appInfo: () => send<AppInfo>("app.info"),

  openDocument: (path: string) =>
    send<DocumentSummary>("doc.open", { path }),

  saveDocument: () => send<{ saved: true }>("doc.save"),

  exportDocument: (params: {
    path: string;
    format: ExportFormat;
    quality?: number;
  }) => send<{ path: string; format: ExportFormat }>("doc.export", params),

  replaceSmartObject: (params: { layer_name: string; file_path: string }) =>
    send<{ layer_name: string; file_path: string }>(
      "smartObject.replace",
      params,
    ),

  setTextContents: (params: { layer_name: string; contents: string }) =>
    send<{ layer_name: string; contents: string }>("text.setContents", params),

  toggleLayer: (params: { layer_name: string; visible: boolean }) =>
    send<{ layer_name: string; visible: boolean }>("layer.toggle", params),

  listLayers: () => send<LayerListResult>("doc.listLayers"),

  selectionInfo: () => send<SelectionInfoResult>("selection.info"),

  captureThumbnail: (max_size?: number) =>
    send<ThumbnailResult>("doc.thumbnail", { max_size: max_size ?? 1024 }),

  historySnapshot: (name?: string) =>
    send<{ snapshot_name: string; doc_name: string }>("history.snapshot", { name }),

  historyRevert: (name: string) =>
    send<{ reverted_to: string; doc_name: string }>("history.revert", { name }),

  selectionFromMask: (params: { mask_path: string; threshold?: number }) =>
    send<{ mask_path: string; pixels_selected: number; doc_width: number; doc_height: number }>(
      "selection.fromMask",
      params,
    ),

  resolveListInbox: () => send<ResolveInboxResult>("resolve.listInbox"),

  resolveReadIntellisearch: (clip_name_filter?: string) =>
    send<ResolveIntellisearchResult>("resolve.readIntellisearch", { clip_name_filter }),

  resolveQuickExportList: () =>
    send<{ presets: string[]; count: number }>("resolve.quickExportList"),

  resolveQuickExportRun: (params: {
    preset_name: string;
    target_dir?: string;
    custom_name?: string;
    video_quality?: string;
  }) => send<{ preset: string; status: string; job_id: string }>("resolve.quickExportRun", params),

  resolveProjectInfo: () =>
    send<{
      project_name: string;
      timeline_name: string;
      timeline_fps: string;
      timeline_timecode: string;
      current_folder: string;
    }>("resolve.projectInfo"),

  resolveMediaPoolListItems: () =>
    send<{
      folder: string;
      items: Array<{ id: string; clip_name: string; file_path: string; frames: number; fps: number }>;
      count: number;
    }>("resolve.mediaPoolListItems"),

  resolvePowerGradeList: () =>
    send<{
      albums: Array<{ name: string; still_count: number }>;
      count: number;
    }>("resolve.powerGradeList"),

  resolvePowerGradeCreate: (name?: string) =>
    send<{ created: boolean; name: string }>("resolve.powerGradeCreate", { name }),

  resolvePowerGradeExport: (params: {
    album_name: string;
    folder_path: string;
    prefix?: string;
    format?: "drx" | "dpx" | "tif" | "jpg" | "png";
  }) =>
    send<{
      exported: boolean;
      album: string;
      folder: string;
      prefix: string;
      format: string;
      count: number;
    }>("resolve.powerGradeExport", params),

  resolveAudioTranscribe: (params?: { clip_id?: string; use_speaker_detection?: boolean }) =>
    send<{ scope: "item" | "folder"; success: boolean; use_speaker_detection: boolean }>(
      "resolve.audioTranscribe",
      params ?? {},
    ),

  resolveAudioClassify: (params?: { clip_id?: string }) =>
    send<{ scope: "item" | "folder"; success: boolean }>(
      "resolve.audioClassify",
      params ?? {},
    ),

  resolveSpeechGenerate: (params: {
    text: string;
    voice?: string;
    timecode?: string;
    model?: string;
    add_to_timeline?: boolean;
  }) =>
    send<{
      clip_name: string;
      clip_id: string;
      timecode: string;
      added_to_timeline: boolean;
    }>("resolve.speechGenerate", params),

  resolveSlateAnalyze: (params?: { clip_id?: string; marker_color?: string }) =>
    send<{ scope: "item" | "folder"; success: boolean; marker_color: string }>(
      "resolve.slateAnalyze",
      params ?? {},
    ),

  resolveTimelineSmartReframe: () =>
    send<{ timeline: string; success: boolean }>("resolve.timelineSmartReframe"),

  resolveTimelineGetCurrentItem: () =>
    send<
      | { found: false }
      | {
          found: true;
          name: string;
          start_frame: number;
          end_frame: number;
          duration_frames: number;
          media_pool_item_id: string;
          clip_name: string;
        }
    >("resolve.timelineGetCurrentItem"),

  resolveMagicMaskCreate: (mode?: "F" | "B" | "BI") =>
    send<{ item_name: string; mode: string; success: boolean }>(
      "resolve.magicMaskCreate",
      { mode: mode ?? "BI" },
    ),

  resolveMagicMaskRegenerate: () =>
    send<{ item_name: string; success: boolean }>("resolve.magicMaskRegenerate"),

  resolveDolbyVisionAnalyze: () =>
    send<{ timeline: string; success: boolean; scope: string }>(
      "resolve.dolbyVisionAnalyze",
    ),

  resolveRenderAddJob: (params?: { preset_name?: string; target_dir?: string; custom_name?: string }) =>
    send<{ job_id: string; preset: string }>("resolve.renderAddJob", params ?? {}),

  resolveRenderList: () =>
    send<{
      jobs: Array<{ job_id: string; timeline_name: string; output_filename: string; status: string }>;
      count: number;
    }>("resolve.renderList"),

  resolveRenderStart: (params?: { job_id?: string; interactive_mode?: boolean }) =>
    send<{ started: boolean; job_id: string; interactive_mode: boolean }>(
      "resolve.renderStart",
      params ?? {},
    ),

  resolveRenderStop: () => send<{ stopped: boolean }>("resolve.renderStop"),

  resolveRenderStatus: () => send<{ in_progress: boolean }>("resolve.renderStatus"),

  resolveRenderDeleteJob: (job_id: string) =>
    send<{ deleted: boolean; job_id: string }>("resolve.renderDeleteJob", { job_id }),

  resolveMarkersList: () =>
    send<{
      timeline: string;
      markers: Array<{
        frame: number;
        color: string;
        name: string;
        note: string;
        duration: number;
        custom_data: string;
      }>;
      count: number;
    }>("resolve.markersList"),

  resolveMarkersAdd: (params: {
    frame: number;
    color?: string;
    name?: string;
    note?: string;
    duration?: number;
    custom_data?: string;
  }) =>
    send<{ added: boolean; frame: number; color: string; name: string }>(
      "resolve.markersAdd",
      params,
    ),

  resolveMarkersDeleteByColor: (color?: string) =>
    send<{ deleted: boolean; color: string }>("resolve.markersDeleteByColor", { color }),

  resolveGradesCopyToTimeline: () =>
    send<{ copied: boolean; target_count: number; source_item: string }>(
      "resolve.gradesCopyToTimeline",
    ),

  resolveGradesExportLUT: (params: { path: string; export_type?: "17Point" | "33Point" | "65Point" }) =>
    send<{ exported: boolean; path: string; export_type: string; item: string }>(
      "resolve.gradesExportLUT",
      params,
    ),

  resolveSubtitlesCreateFromAudio: (params?: {
    language?: ResolveLanguage;
    preset?: "DEFAULT" | "NETFLIX";
    chars_per_line?: number;
    line_break?: "SINGLE" | "DOUBLE";
    gap?: number;
  }) =>
    send<{
      created: boolean;
      timeline: string;
      language: string;
      preset: string;
      chars_per_line: string;
      line_break: string;
      gap: number;
    }>("resolve.subtitlesCreateFromAudio", params ?? {}),

  resolveTrackAdd: (params: { track_type: ResolveTrackType; sub_track_type?: string }) =>
    send<{ added: boolean; track_type: string; sub_track_type: string; new_count: number }>(
      "resolve.trackAdd",
      params,
    ),

  resolveTrackDelete: (params: { track_type: ResolveTrackType; index: number }) =>
    send<{ deleted: boolean; track_type: string; index: number }>(
      "resolve.trackDelete",
      params,
    ),

  resolveTrackGetName: (params: { track_type: ResolveTrackType; index: number }) =>
    send<{ track_type: string; index: number; name: string }>(
      "resolve.trackGetName",
      params,
    ),

  resolveTrackSetName: (params: { track_type: ResolveTrackType; index: number; name: string }) =>
    send<{ set: boolean; track_type: string; index: number; name: string }>(
      "resolve.trackSetName",
      params,
    ),

  resolveLutRefresh: () => send<{ refreshed: boolean }>("resolve.lutRefresh"),

  resolveGraphGetNodes: () =>
    send<{
      item: string;
      num_nodes: number;
      nodes: Array<{ index: number; label: string; lut: string; tools: string[] }>;
    }>("resolve.graphGetNodes"),

  resolveGraphApplyLUT: (params: { node_index: number; lut_path: string }) =>
    send<{ applied: boolean; item: string; node_index: number; lut_path: string }>(
      "resolve.graphApplyLUT",
      params,
    ),

  resolveGraphApplyGradeFromDRX: (params: { path: string; grade_mode?: 0 | 1 | 2 }) =>
    send<{ applied: boolean; item: string; path: string; grade_mode: number }>(
      "resolve.graphApplyGradeFromDRX",
      params,
    ),

  resolveGraphResetAllGrades: () =>
    send<{ reset: boolean; item: string }>("resolve.graphResetAllGrades"),

  resolveGraphSetNodeEnabled: (params: { node_index: number; enabled: boolean }) =>
    send<{ set: boolean; item: string; node_index: number; enabled: boolean }>(
      "resolve.graphSetNodeEnabled",
      params,
    ),

  resolveVoiceGetIsolationState: (params?: { track_index?: number }) =>
    send<{
      scope: "track" | "item";
      ref: string;
      is_enabled: boolean;
      amount: number;
    }>("resolve.voiceGetIsolationState", params ?? {}),

  resolveVoiceSetIsolationState: (params: {
    track_index?: number;
    is_enabled: boolean;
    amount: number;
  }) =>
    send<{
      set: boolean;
      scope: "track" | "item";
      ref: string;
      is_enabled: boolean;
      amount: number;
    }>("resolve.voiceSetIsolationState", params),

  resolveGalleryImportStills: (params: { file_paths: string[]; album_name?: string }) =>
    send<{ imported: boolean; album: string; count: number }>(
      "resolve.galleryImportStills",
      params,
    ),

  resolveOpenLatest: () =>
    send<{ opened: string; metadata: ResolveStillMetadata | null }>("resolve.openLatest"),

  resolveExportBack: (params?: { format?: ExportFormat; quality?: number }) =>
    send<ResolveExportBackResult>("resolve.exportBack", params ?? {}),

  scanTemplate: (template_path: string) =>
    send<TemplateScanResult>("template.scan", { template_path }),

  renderTemplate: (params: {
    template_path: string;
    data: Record<string, string>;
    output_path: string;
    format: ExportFormat;
    quality?: number;
  }) => send<TemplateRenderResult>("template.render", params),

  batchRender: (params: {
    template_path: string;
    items: BatchRenderItem[];
    default_format?: ExportFormat;
    default_quality?: number;
  }) => send<BatchRenderResult>("batch.run", params),

  multiAspectExport: (params: {
    master_path: string;
    output_dir: string;
    base_name: string;
    aspects: string[];
    target_long_edge: number;
    format: ExportFormat;
    quality?: number;
  }) => send<MultiAspectExportResult>("multiAspect.export", params),

  addAdjustment: (params: {
    type: AdjustmentType;
    params: AdjustmentParams;
    name?: string;
    target_layer_name?: string;
  }) => send<{ type: string; name: string | null; target_layer_name: string | null }>(
    "adjustment.add",
    params,
  ),

  applyStyle: (params: { layer_name: string; effects: StyleEffects }) =>
    send<{ layer_name: string; applied: string[] }>("style.apply", params),

  selectionSelect: (mode: "all" | "none" | "invert") =>
    send<{ mode: string }>("selection.select", { mode }),

  generativeFill: (prompt: string) =>
    send<{ prompt: string; mode: "generate" | "auto" }>("gen.fill", { prompt }),

  generativeExpand: (params: {
    target_width: number;
    target_height: number;
    anchor?:
      | "topLeft" | "topCenter" | "topRight"
      | "middleLeft" | "middleCenter" | "middleRight"
      | "bottomLeft" | "bottomCenter" | "bottomRight";
    prompt?: string;
  }) => send<{
    before: { width: number; height: number };
    after: { width: number; height: number };
    anchor: string;
    prompt: string;
  }>("gen.expand", params),

  autoRenameTemplate: (params: {
    template_path: string;
    output_path: string;
    mappings: Array<{ layer_name: string; new_key: string }>;
  }) => send<TemplateAutoRenameResult>("template.autoRename", params),

  scaffoldTemplate: (params: {
    output_path: string;
    spec: {
      name?: string;
      width: number;
      height: number;
      background_color?: { red: number; green: number; blue: number };
      fields: Array<{
        key: string;
        type: "text" | "image_placeholder";
        hint?: string;
        x?: number;
        y?: number;
        font_size?: number;
        /** For image_placeholder: absolutt fil-sti til bildet som skal embedes som smart-object. */
        file_path?: string;
      }>;
    };
  }) =>
    send<{
      output_path: string;
      created_layers: Array<{ key: string; type: string; layer_name: string }>;
      notes: string;
    }>("template.scaffold", params),
};
