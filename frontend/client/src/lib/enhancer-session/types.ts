/**
 * Gallery-session domain types.
 *
 * A "session" is an in-memory, unsaved set of images the photographer is
 * culling and editing in the enhancer. It is deliberately not persisted to
 * disk or localStorage at this layer — persistence is Save-to-Project's
 * job and happens over HTTP. The session-level state here is purely what
 * the enhancer UI needs to drive filmstrip + per-image edits + batch ops.
 *
 * Keep this module dependency-free (no React, no MUI, no apiRequest). It
 * has to be unit-testable from Node.
 */

import type {
  EditModuleKey,
  EnhancementSettings,
  PerFaceEnhancementPatch,
  SessionImageFlag,
} from './module-contract';
import type { EditHistory } from './edit-history';

export type { EditModuleKey, EnhancementSettings, PerFaceEnhancementPatch, SessionImageFlag };
export type { EditHistory };

/** 0 = no rating. 1–5 stars match Lightroom / Evoto semantics. */
export type StarRating = 0 | 1 | 2 | 3 | 4 | 5;

/** Normalised [0, 1] rectangle returned by the face-detection endpoint. */
export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedFace {
  index: number;
  score: number | null;
  box: NormalizedBox;
}

export type FaceDetectionStatus = 'idle' | 'pending' | 'ready' | 'unavailable' | 'none';

export interface AiSuggestionSummary {
  subject: string;
  confidence: number;
  rationale: string;
  observations: string[];
}

export interface SessionImage {
  id: string;
  file: File;
  previewUrl: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  lastModified: number;
  settings: EnhancementSettings;
  /** Populated after a successful enhance. */
  enhancedUrl?: string;
  /** Claude Vision recipe snapshot; used for the feedback diff on enhance. */
  aiSuggestedRecipe?: Partial<EnhancementSettings>;
  aiSuggestion?: AiSuggestionSummary;
  analysisResult?: Record<string, unknown>;
  rating: StarRating;
  flag: SessionImageFlag;
  /** Monotonic sequence index within the session (for filenames, 1-based). */
  sequence: number;
  /** Set by detectBursts() after ADD_IMAGES. null = not part of a burst. */
  burstId: string | null;
  /** Per-image bounded undo/redo stack. Never persisted. */
  history: EditHistory;
  /** Detected faces in normalised [0,1] coords. Populated lazily by the
   *  face-detection hook when the image enters the foreground. */
  faces?: DetectedFace[];
  faceStatus: FaceDetectionStatus;
  /** Per-face override map keyed by face index. When non-empty, those
   *  indices receive the override patch instead of the global sliders
   *  for portrait-region effects. */
  perFaceOverrides: Record<number, PerFaceEnhancementPatch>;
}

/** Filmstrip filter states — matches Evoto / Lightroom "Attributes". */
export type CullFilter =
  | 'all'
  | 'picks'
  | 'rejects'
  | 'unrated'
  | 'five_star'
  | 'in_burst';

export interface EditClipboard {
  sourceId: string;
  sourceName: string;
  settings: EnhancementSettings;
  /** Captured when the clipboard was filled so paste-time module filtering
   *  doesn't need to re-query the source. */
  snapshotAt: number;
}

/**
 * Export preset — drives filename template, format, resize, colorspace,
 * and optional watermark. Client-side today; the server export route will
 * later accept the same shape verbatim so presets stay portable.
 */
export interface ExportPreset {
  id: string;
  name: string;
  /**
   * Output encoding. `png-16bit` routes through the backend PNG encoder
   * (see backend/gfpgan-runner/freq_sep_save.py) so archival exports
   * preserve the editor's Float32 precision through to disk — browser
   * canvas only supports 8-bit per channel.
   */
  format: 'jpeg' | 'png' | 'png-16bit' | 'webp';
  /** 0–100 quality; ignored for PNG and PNG-16bit (both lossless). */
  quality: number;
  resize: ExportResize;
  /**
   * Centre-crop the source to this aspect before resize. Either a
   * well-known preset string (`'4:5'`, `'9:16'` etc.) or a custom
   * `{ w, h }` ratio object for arbitrary aspects. `'none'` or missing
   * keeps the original source aspect. The preset list covers the ratios
   * that drive 95% of real flows (IG feed, IG reels, print) — custom
   * handles the rest without needing another enum entry per platform.
   */
  crop?: ExportCrop;
  /**
   * Output sharpening applied AFTER resize, BEFORE watermark + encode.
   * Compensates for the resolution loss from downsampling plus the
   * aggressive re-encode IG/FB/TikTok apply on upload — a light pre-
   * sharpen on the photographer side keeps the delivered image crisp
   * on the viewer's feed. Archive-grade exports (PNG 16-bit) should
   * keep this at `'none'` so they stay pristine for later re-use.
   */
  sharpen?: 'none' | 'light' | 'standard' | 'strong';
  /**
   * Metadata stamped onto the exported blob via server-side exiftool.
   * `canvas.toBlob` strips everything, so the export pipeline pipes
   * the rendered bytes through `/api/photo-enhancer/export/stamp-metadata`
   * when any of these fields are set. Leave empty for anonymous exports.
   */
  metadata?: {
    copyright?: string;
    artist?: string;
    creator?: string;
    keywords?: string[];
  };
  colorSpace: 'srgb' | 'display-p3';
  filenameTemplate: string;
  watermark?: ExportWatermark;
}

/** Named aspect ratios the export dialog lists as quick-picks. */
export type ExportCropAspect =
  | 'none'
  | '1:1'
  | '4:5'
  | '5:4'
  | '3:2'
  | '2:3'
  | '4:3'
  | '3:4'
  | '16:9'
  | '9:16';

/** Either a named preset or an arbitrary `w:h` ratio. Internally the
 *  engine reduces both to a `{ w, h }` pair via `parseCrop()`. */
export type ExportCrop = ExportCropAspect | { w: number; h: number };

export type ExportResize =
  | { mode: 'none' }
  | { mode: 'long_edge' | 'short_edge' | 'width' | 'height'; pixels: number }
  | { mode: 'percent'; percent: number };

export interface ExportWatermark {
  text: string;
  /** 0–1 opacity; default 0.5. */
  opacity: number;
  /** 9-point anchor. */
  position:
    | 'top-left' | 'top-center' | 'top-right'
    | 'middle-left' | 'middle-center' | 'middle-right'
    | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

export interface FilenameContext {
  originalName: string;
  sequence: number;
  projectName?: string;
  clientName?: string;
  camera?: string;
  customText?: string;
  /** Epoch ms; defaults to now() at render time if not provided. */
  shotAt?: number;
}

export interface SessionState {
  images: SessionImage[];
  /** Stable order key for new images. */
  nextSequence: number;
  selectedId: string | null;
  multiSelectIds: string[];
  clipboard: EditClipboard | null;
  exportPresets: ExportPreset[];
  activeExportPresetId: string | null;
  cullFilter: CullFilter;
  /** When non-null, portrait sliders write to the active face's override
   *  patch instead of the image's global settings. Clearing the value
   *  routes sliders back to the whole image. */
  activeFaceIndex: number | null;
}

export const SESSION_INITIAL: SessionState = {
  images: [],
  nextSequence: 1,
  selectedId: null,
  multiSelectIds: [],
  clipboard: null,
  exportPresets: [],
  activeExportPresetId: null,
  cullFilter: 'all',
  activeFaceIndex: null,
};
