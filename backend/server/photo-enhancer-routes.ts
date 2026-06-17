import express from "express";
import multer from "multer";
import type { Pool } from "pg";
import {
  detectDistractions,
  suggestInpaintRecipe,
  suggestPortraitRecipe,
  type InpaintRecipeRecommendation,
} from "./photo-enhancer-claude-vision.js";
import { executeInpaint } from "./photo-enhancer-inpaint-executor.js";
import {
  aggregateUserRecipePreferences,
  logRecipeFeedback,
  type PhotoEnhancerRecipe,
} from "./photo-enhancer-feedback-service.js";
import crypto from "crypto";
import fs from "fs/promises";
import { constants as fsConstants, createWriteStream, existsSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { Readable, Transform } from "stream";
import { ReadableStream as NodeReadableStream } from "stream/web";
import { pipeline } from "stream/promises";
import { createHash, randomUUID } from "node:crypto";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  computeSwatchPreview,
  CubeParseError,
  parseCubeMetadata,
} from "./photo-enhancer-cube-parser.js";
import {
  PHOTO_ENHANCER_DRIVE_STRUCTURE,
  PHOTO_ENHANCER_MODEL_REGISTRY_POLICY,
  PHOTO_ENHANCER_RASTER_FORMATS,
  PHOTO_ENHANCER_RAW_FORMAT_MATRIX,
  PHOTO_ENHANCER_RAW_FORMATS,
  buildPhotoEnhancerImprovementBacklog,
  buildPhotoEnhancerR2Config,
  buildPublicPhotoEnhancerR2Config,
  getPhotoEnhancerDriveFolderNames,
  photoEnhancerModelRegistry,
  resolvePhotoEnhancerModelStatuses,
  resolvePhotoEnhancerRunnerEndpoint,
  type PhotoEnhancerRawFormatMatrixEntry,
  type PhotoEnhancerModelStatus,
} from "./photo-enhancer-capabilities.js";
import {
  buildPhotoEnhancerProfileRegistrySummary,
  matchPhotoEnhancerCameraProfile,
  matchPhotoEnhancerLensProfile,
  normalizePhotoEnhancerExif,
  parsePhotoEnhancerXmpSidecar,
} from "./photo-enhancer-profiles.js";

const execFileAsync = promisify(execFile);

const PHOTO_ENHANCER_MAX_FILE_BYTES = Number(
  process.env.PHOTO_ENHANCER_MAX_FILE_BYTES || 150 * 1024 * 1024,
);
const PHOTO_ENHANCER_DIRECT_UPLOAD_MAX_BYTES = Number(
  process.env.PHOTO_ENHANCER_DIRECT_UPLOAD_MAX_BYTES || 20 * 1024 * 1024 * 1024,
);
const PHOTO_ENHANCER_R2_ANALYZE_BUFFER_MAX_BYTES = Number(
  process.env.PHOTO_ENHANCER_R2_ANALYZE_BUFFER_MAX_BYTES || PHOTO_ENHANCER_MAX_FILE_BYTES,
);
const PHOTO_ENHANCER_R2_ANALYZE_DOWNLOAD_MAX_BYTES = Number(
  process.env.PHOTO_ENHANCER_R2_ANALYZE_DOWNLOAD_MAX_BYTES || 2 * 1024 * 1024 * 1024,
);
const PHOTO_ENHANCER_R2_PART_SIZE_BYTES = Math.max(
  5 * 1024 * 1024,
  Number(process.env.PHOTO_ENHANCER_R2_PART_SIZE_BYTES || 32 * 1024 * 1024),
);
const PHOTO_ENHANCER_R2_PROXY_PART_SIZE_BYTES = Math.max(
  5 * 1024 * 1024,
  Number(process.env.PHOTO_ENHANCER_R2_PROXY_PART_SIZE_BYTES || 8 * 1024 * 1024),
);
const PHOTO_ENHANCER_R2_PROXY_PART_MAX_BYTES = Math.max(
  PHOTO_ENHANCER_R2_PROXY_PART_SIZE_BYTES,
  Number(process.env.PHOTO_ENHANCER_R2_PROXY_PART_MAX_BYTES || 16 * 1024 * 1024),
);
const PHOTO_ENHANCER_R2_PART_BATCH_MAX = Math.max(
  1,
  Number(process.env.PHOTO_ENHANCER_R2_PART_BATCH_MAX || 64),
);
const PHOTO_ENHANCER_R2_SIGNED_URL_TTL_SECONDS = Number(
  process.env.PHOTO_ENHANCER_R2_SIGNED_URL_TTL_SECONDS || 60 * 60,
);
const PHOTO_ENHANCER_R2_UPLOAD_PREFIX = (
  process.env.PHOTO_ENHANCER_R2_UPLOAD_PREFIX || "photo-enhancer/uploads"
).replace(/^\/+|\/+$/gu, "");
const PHOTO_ENHANCER_MODEL_TIMEOUT_MS = Number(
  process.env.PHOTO_ENHANCER_MODEL_TIMEOUT_MS || 45_000,
);
const PHOTO_ENHANCER_FACE_API_TIMEOUT_MS = Number(
  process.env.PHOTO_ENHANCER_FACE_API_TIMEOUT_MS || 25_000,
);
const PHOTO_ENHANCER_FACE_API_MAX_DIMENSION = Number(
  process.env.PHOTO_ENHANCER_FACE_API_MAX_DIMENSION || 1280,
);
const PHOTO_ENHANCER_FACE_API_INPUT_SIZE = Number(
  process.env.PHOTO_ENHANCER_FACE_API_INPUT_SIZE || 416,
);
const PHOTO_ENHANCER_FACE_API_SCORE_THRESHOLD = Number(
  process.env.PHOTO_ENHANCER_FACE_API_SCORE_THRESHOLD || 0.35,
);
const PHOTO_ENHANCER_QUEUE_CONCURRENCY = Math.max(
  1,
  Number(process.env.PHOTO_ENHANCER_QUEUE_CONCURRENCY || 1),
);
const PHOTO_ENHANCER_QUEUE_PER_USER_CONCURRENCY = Math.max(
  1,
  Number(process.env.PHOTO_ENHANCER_QUEUE_PER_USER_CONCURRENCY || 1),
);
const PHOTO_ENHANCER_QUEUE_PER_PROJECT_CONCURRENCY = Math.max(
  1,
  Number(process.env.PHOTO_ENHANCER_QUEUE_PER_PROJECT_CONCURRENCY || 1),
);
const PHOTO_ENHANCER_QUEUE_JOB_TTL_MS = Math.max(
  60_000,
  Number(process.env.PHOTO_ENHANCER_QUEUE_JOB_TTL_MS || 24 * 60 * 60 * 1000),
);
const PHOTO_ENHANCER_QUEUE_MAX_JOBS = Math.max(
  50,
  Number(process.env.PHOTO_ENHANCER_QUEUE_MAX_JOBS || 500),
);
const PHOTO_ENHANCER_QUEUE_MEMORY_FREE_MIN_MB = Math.max(
  0,
  Number(process.env.PHOTO_ENHANCER_QUEUE_MEMORY_FREE_MIN_MB || 128),
);
const PHOTO_ENHANCER_QUEUE_LARGE_FILE_BYTES = Math.max(
  PHOTO_ENHANCER_R2_ANALYZE_BUFFER_MAX_BYTES,
  Number(process.env.PHOTO_ENHANCER_QUEUE_LARGE_FILE_BYTES || 250 * 1024 * 1024),
);

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const photoEnhancerBinarySearchDirs = [
  process.env.PHOTO_ENHANCER_BIN_DIR,
  path.join(repoRoot, "backend", ".render-bin"),
  path.join(repoRoot, ".render-bin"),
].filter((value): value is string => Boolean(value));
const projectFileStorageRoot = path.join(repoRoot, "uploads", "project-files");
const photoEnhancerStorageRoot = path.join(repoRoot, "uploads", "photo-enhancer");
const photoEnhancerManifestPath = path.join(
  photoEnhancerStorageRoot,
  "manifest.json",
);
const photoEnhancerFaceApiModelsDir = path.resolve(
  process.env.PHOTO_ENHANCER_FACE_API_MODELS_DIR || path.join(repoRoot, "backend", "models", "face-api"),
);

const gfpganCandidateKeys =
  photoEnhancerModelRegistry.find((model) => model.id === "gfpgan")?.candidateKeys || [
    "models/gfpgan/weights/GFPGANv1.4.pth",
  ];

type PhotoEnhancerR2UploadConfig = {
  enabled: boolean;
  endpoint: string | null;
  bucket: string | null;
  accessKeyId: string | null;
  secretAccessKey: string | null;
  prefix: string;
};

type PhotoEnhancerR2Source = {
  bucket: string;
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadId?: string | null;
  originalHash?: string | null;
};

type LensCorrection = {
  enabled: boolean;
  // When true, derive the correction amounts from the matched lens profile
  // (or the RAW's embedded correction / Lensfun). When false, the manual
  // 0-100 strengths below are used.
  auto: boolean;
  distortion: number;
  vignette: number;
  chromaticAberration: number;
};

type PhotoEnhancerSettings = {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  denoising: number;
  faceEnhancement: number;
  modelPreference: string;
  gfpganQuality: number;
  codeformerFidelity: number;
  realesrganScale: number;
  swinir: boolean;
  bsrgan: boolean;
  diffbir: boolean;
  faceOnlyCrop: boolean;
  preserveBackground: boolean;
  skinTextureGuard: number;
  // Evoto-parity portrait controls. Each is a 0–100 intensity that the
  // GFPGAN runner picks up post-face-restoration:
  //   teethWhiteness  — masked brightness + desaturation on mouth region.
  //   eyeBrightness   — iris luminance boost + catchlight lift.
  //   eyeWhiteness    — sclera desaturation/brightening (no ring recolor).
  //   blemishRemoval  — frequency-separated healing pass on skin region.
  teethWhiteness: number;
  eyeBrightness: number;
  eyeWhiteness: number;
  blemishRemoval: number;
  // Per-effect tuning profile. Scales the LAB multipliers and feather
  // radius inside the Python runner so the photographer can push the
  // look from conservative (subtle) to aggressive (strong) without the
  // strength slider having to span the entire taste range.
  teethProfile: IntensityProfile;
  eyeBrightnessProfile: IntensityProfile;
  eyeWhitenessProfile: IntensityProfile;
  blemishProfile: IntensityProfile;
  // Subject-aware look. ``subject`` is one of the Claude Vision
  // categories (food / landscape / product / vehicle / aviation /
  // other / portrait / group_portrait — the last two are handled by
  // the portrait retouch pass so the subject_retouch dispatcher is
  // deliberately a no-op on them). ``subjectLookStrength`` (0-100)
  // controls how hard the category-specific pass pushes.
  subject: SubjectKind;
  subjectLookStrength: number;
  // 8-band HSL colour grading. Matches Evoto / Lightroom conventions:
  // red / orange / yellow / green / aqua / blue / purple / magenta.
  // Each band's h / s / l slider is a signed intensity in [-100, 100]
  // mapped by the Python runner to hue-rotate / sat-multiply / luminance-
  // lift deltas. All zeros ⇒ identity.
  hsl: HslAdjustments;
  // Built-in LUT name + intensity. ``null`` name means no LUT pass runs.
  // Contract mirrors backend/gfpgan-runner/lut_library.py — the slug set
  // is authoritative on the runner side; this layer is just a pass-through.
  lut: LutSelection;
  // Per-face scoping: when non-empty, the runner detects every face in
  // the image and applies the override controls on that face's masks
  // only. Faces whose index is NOT listed inherit the global sliders.
  // ``faceIndex`` matches the index returned by POST /faces.
  perFaceOverrides: PerFaceOverride[];
  // Optical lens correction. Honoured by the runner / RAW converter when a
  // matched lens profile (or Lensfun/LCP) is available.
  lensCorrection: LensCorrection;
};

type PerFaceOverride = {
  faceIndex: number;
  controls: Partial<
    Pick<
      PhotoEnhancerSettings,
      | "teethWhiteness"
      | "eyeBrightness"
      | "eyeWhiteness"
      | "blemishRemoval"
      | "teethProfile"
      | "eyeBrightnessProfile"
      | "eyeWhitenessProfile"
      | "blemishProfile"
      | "skinTextureGuard"
      | "faceEnhancement"
    >
  >;
};

type LutSelection = {
  name: string | null;
  strength: number;
};

type HslBand = {
  h: number;
  s: number;
  l: number;
};

type HslAdjustments = {
  red: HslBand;
  orange: HslBand;
  yellow: HslBand;
  green: HslBand;
  aqua: HslBand;
  blue: HslBand;
  purple: HslBand;
  magenta: HslBand;
};

const HSL_BAND_NAMES = [
  "red",
  "orange",
  "yellow",
  "green",
  "aqua",
  "blue",
  "purple",
  "magenta",
] as const satisfies ReadonlyArray<keyof HslAdjustments>;

/**
 * Fallback LUT metadata used when the Python runner is unreachable.
 * Must stay in sync with backend/gfpgan-runner/lut_library.py — unit
 * tests on both sides lock the slug set.
 */
const PHOTO_ENHANCER_BUILTIN_LUTS = [
  {
    id: "neutral",
    displayName: "Nøytral",
    description: "Identitet — ingen fargejustering.",
    swatch: { r: 128, g: 128, b: 128 },
    size: 17,
  },
  {
    id: "warm_soft",
    displayName: "Varm (mild)",
    description: "Lett varmere hudtoner, dempede blå.",
    swatch: { r: 208, g: 172, b: 144 },
    size: 17,
  },
  {
    id: "cool_soft",
    displayName: "Kjølig (mild)",
    description: "Kjølere skygger, bevarte hudtoner.",
    swatch: { r: 144, g: 172, b: 210 },
    size: 17,
  },
] as const;

const PHOTO_ENHANCER_BUILTIN_LUT_SIZE = 17;
const PHOTO_ENHANCER_BUILTIN_LUT_IDS = new Set(
  PHOTO_ENHANCER_BUILTIN_LUTS.map((l) => l.id),
);

// Parabolic bump peaking at x=0.5, zero at the endpoints — keeps black at
// black and white at white so the look never clips/lifts endpoints.
function photoEnhancerMidtoneBump(x: number, amount: number): number {
  return amount * 4.0 * x * (1.0 - x);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// Built-in LUT table fallback. Exact TypeScript mirror of
// backend/gfpgan-runner/lut_library.py (_identity/_warm_soft/_cool_soft):
// r-fastest flat order, size**3 * 3 entries, domain [0,1]. Used when the
// runner is absent or stale so the /luts catalog's fallback slugs always
// have a matching /luts/:id/table — keeping the two endpoints consistent.
function buildBuiltinLutTable(
  lutId: string,
  size = PHOTO_ENHANCER_BUILTIN_LUT_SIZE,
): { size: number; table: number[] } | null {
  if (!PHOTO_ENHANCER_BUILTIN_LUT_IDS.has(lutId as never)) return null;
  const denom = size - 1;
  const table: number[] = [];
  for (let bi = 0; bi < size; bi++) {
    for (let gi = 0; gi < size; gi++) {
      for (let ri = 0; ri < size; ri++) {
        let r = ri / denom;
        let g = gi / denom;
        let b = bi / denom;
        if (lutId === "warm_soft") {
          r = clamp01(r + photoEnhancerMidtoneBump(r, 0.06));
          g = clamp01(g + photoEnhancerMidtoneBump(g, 0.01));
          b = clamp01(b - photoEnhancerMidtoneBump(b, 0.05));
        } else if (lutId === "cool_soft") {
          r = clamp01(r - photoEnhancerMidtoneBump(r, 0.05));
          g = clamp01(g + photoEnhancerMidtoneBump(g, 0.01));
          b = clamp01(b + photoEnhancerMidtoneBump(b, 0.07));
        }
        // "neutral" is the identity LUT — no per-channel adjustment.
        table.push(r, g, b);
      }
    }
  }
  return { size, table };
}

const HSL_IDENTITY: HslAdjustments = {
  red: { h: 0, s: 0, l: 0 },
  orange: { h: 0, s: 0, l: 0 },
  yellow: { h: 0, s: 0, l: 0 },
  green: { h: 0, s: 0, l: 0 },
  aqua: { h: 0, s: 0, l: 0 },
  blue: { h: 0, s: 0, l: 0 },
  purple: { h: 0, s: 0, l: 0 },
  magenta: { h: 0, s: 0, l: 0 },
};

function normalizeHsl(raw: unknown): HslAdjustments {
  const source = parseJsonObject(raw);
  const out: HslAdjustments = {
    red: { ...HSL_IDENTITY.red },
    orange: { ...HSL_IDENTITY.orange },
    yellow: { ...HSL_IDENTITY.yellow },
    green: { ...HSL_IDENTITY.green },
    aqua: { ...HSL_IDENTITY.aqua },
    blue: { ...HSL_IDENTITY.blue },
    purple: { ...HSL_IDENTITY.purple },
    magenta: { ...HSL_IDENTITY.magenta },
  };
  for (const band of HSL_BAND_NAMES) {
    const bandRaw = parseJsonObject(source[band]);
    const h = readNumber(bandRaw.h);
    const s = readNumber(bandRaw.s);
    const l = readNumber(bandRaw.l);
    if (h !== null) out[band].h = clampNumber(h, -100, 100);
    if (s !== null) out[band].s = clampNumber(s, -100, 100);
    if (l !== null) out[band].l = clampNumber(l, -100, 100);
  }
  return out;
}

type SubjectKind =
  | ""
  | "portrait"
  | "group_portrait"
  | "food"
  | "landscape"
  | "product"
  | "vehicle"
  | "aviation"
  | "other";

const SUBJECT_KINDS: readonly SubjectKind[] = [
  "",
  "portrait",
  "group_portrait",
  "food",
  "landscape",
  "product",
  "vehicle",
  "aviation",
  "other",
] as const;

function normalizeSubjectKind(value: unknown): SubjectKind {
  if (typeof value === "string") {
    const lowered = value.toLowerCase().trim() as SubjectKind;
    if (SUBJECT_KINDS.includes(lowered)) return lowered;
  }
  return "";
}

type IntensityProfile = "subtle" | "normal" | "strong";

const INTENSITY_PROFILES: readonly IntensityProfile[] = [
  "subtle",
  "normal",
  "strong",
] as const;

function normalizeIntensityProfile(value: unknown): IntensityProfile {
  if (typeof value === "string") {
    const lowered = value.toLowerCase().trim() as IntensityProfile;
    if (INTENSITY_PROFILES.includes(lowered)) return lowered;
  }
  return "normal";
}

type PhotoEnhancerSavedFile = {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
  downloadUrl: string;
  preset: string;
  settings: PhotoEnhancerSettings;
  createdAt: string;
};

type PhotoEnhancerTelemetryEvent = {
  id: string;
  timestamp: string;
  route: "analyze" | "enhance" | "batch";
  success: boolean;
  fileName?: string | null;
  sourceExtension?: string | null;
  sourceMimeType?: string | null;
  raw: boolean;
  heic?: boolean;
  rawConverter?: string | null;
  preset?: string | null;
  modelUsed?: string | null;
  inferenceMode?: string | null;
  processingMs: number;
  outputMimeType?: string | null;
  error?: string | null;
};

type PhotoEnhancerJobStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

type PhotoEnhancerJobTimelineEvent = {
  id: string;
  timestamp: string;
  type:
    | "created"
    | "queued"
    | "started"
    | "progress"
    | "completed"
    | "failed"
    | "retry"
    | "paused"
    | "resumed"
    | "cancelled";
  message: string;
  details?: Record<string, unknown>;
};

type PhotoEnhancerQueuedJob = {
  id: string;
  status: PhotoEnhancerJobStatus;
  priority: number;
  owner: string;
  userId: string;
  projectId: string;
  folderId: string | null;
  source: PhotoEnhancerR2Source;
  preset: string;
  settings: PhotoEnhancerSettings;
  progress: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
  attempts: number;
  maxAttempts: number;
  retryHistory: Array<{ attempt: number; timestamp: string; reason: string }>;
  failureReason: string | null;
  timeline: PhotoEnhancerJobTimelineEvent[];
  auditLog: PhotoEnhancerJobTimelineEvent[];
  artifacts: Array<{
    id: string;
    type: "enhanced-image" | "manifest" | "source";
    mimeType: string | null;
    size: number | null;
    url: string | null;
    checksum: string | null;
  }>;
  outputManifest: Record<string, unknown> | null;
  checksum: string | null;
  cancelled: boolean;
  result: Record<string, unknown> | null;
};

type PhotoEnhancerDuplicateIndexEntry = {
  hash: string;
  perceptualHash: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  firstSeenAt: string;
  lastSeenAt: string;
  count: number;
};

type PhotoEnhancerStatsChannel = {
  min?: number;
  max?: number;
  mean?: number;
  stdev?: number;
};

type PhotoEnhancerSharpStats = {
  channels?: PhotoEnhancerStatsChannel[];
  dominant?: Record<string, number>;
};

type PhotoEnhancerFaceApiRuntime = {
  faceApi: Record<string, any>;
  canvas: Record<string, any>;
  loadedAt: string;
  backend: string | null;
};

type PhotoEnhancerFaceApiStatus = {
  available: boolean;
  packageAvailable: boolean;
  modelsLoaded: boolean;
  modelsDirectory: string;
  requiredFiles: Array<{ name: string; found: boolean }>;
  detectionModel: string;
  landmarkModel: string;
  backend: string | null;
  loadedAt: string | null;
  reason: string | null;
};

const photoEnhancerOriginalHashIndex = new Map<string, PhotoEnhancerDuplicateIndexEntry>();
const photoEnhancerPerceptualHashIndex = new Map<string, PhotoEnhancerDuplicateIndexEntry>();
const PHOTO_ENHANCER_DUPLICATE_INDEX_LIMIT = Number(
  process.env.PHOTO_ENHANCER_DUPLICATE_INDEX_LIMIT || 5_000,
);
const photoEnhancerFaceApiRequiredFiles = [
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model-shard1",
  "face_landmark_68_tiny_model-weights_manifest.json",
  "face_landmark_68_tiny_model-shard1",
];
let photoEnhancerFaceApiRuntimePromise: Promise<PhotoEnhancerFaceApiRuntime> | null = null;
let photoEnhancerFaceApiLastStatus: PhotoEnhancerFaceApiStatus | null = null;
let photoEnhancerFaceApiQueue: Promise<unknown> = Promise.resolve();
let photoEnhancerR2UploadClient: S3Client | null = null;
let photoEnhancerR2UploadClientCacheKey = "";

type PhotoEnhancerRawFormatRuntimeStatus =
  | "verified"
  | "supported-untested"
  | "unsupported-external"
  | "failed"
  | "unavailable";

type PhotoEnhancerRawFormatVerification = {
  extension: string;
  status: "verified" | "failed";
  converter: string | null;
  verifiedAt: string;
  source: "upload" | "self-test" | "analyze" | "enhance";
  outputMimeType?: string | null;
  width?: number | null;
  height?: number | null;
  resolutionMode?: string | null;
  error?: string | null;
};

type PhotoEnhancerRawFormatRuntimeEntry = PhotoEnhancerRawFormatMatrixEntry & {
  status: PhotoEnhancerRawFormatRuntimeStatus;
  statusLabel: string;
  converter: string | null;
  verifiedAt: string | null;
  width: number | null;
  height: number | null;
  outputMimeType: string | null;
  resolutionMode: string | null;
  error: string | null;
};

const photoEnhancerTelemetry = {
  serviceStartedAt: new Date().toISOString(),
  requestsTotal: 0,
  successTotal: 0,
  errorTotal: 0,
  fallbackTotal: 0,
  rawConversionTotal: 0,
  heicConversionTotal: 0,
  runnerFallbackTotal: 0,
  modelUsage: new Map<string, number>(),
  inferenceModes: new Map<string, number>(),
  rawConverters: new Map<string, number>(),
  recentEvents: [] as PhotoEnhancerTelemetryEvent[],
  lastErrors: [] as PhotoEnhancerTelemetryEvent[],
};

const photoEnhancerRawFormatVerifications = new Map<string, PhotoEnhancerRawFormatVerification>();
const photoEnhancerJobs = new Map<string, PhotoEnhancerQueuedJob>();
let photoEnhancerQueuePaused = false;
let photoEnhancerQueueWakeupScheduled = false;

function incrementCounter(map: Map<string, number>, key: string | null | undefined) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function rollingPercentile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function trackPhotoEnhancerEvent(event: Omit<PhotoEnhancerTelemetryEvent, "id" | "timestamp">) {
  const record: PhotoEnhancerTelemetryEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  };

  photoEnhancerTelemetry.requestsTotal += 1;
  if (record.success) {
    photoEnhancerTelemetry.successTotal += 1;
  } else {
    photoEnhancerTelemetry.errorTotal += 1;
    photoEnhancerTelemetry.lastErrors.unshift(record);
    photoEnhancerTelemetry.lastErrors = photoEnhancerTelemetry.lastErrors.slice(0, 25);
  }

  if (record.raw) photoEnhancerTelemetry.rawConversionTotal += 1;
  if (record.heic) photoEnhancerTelemetry.heicConversionTotal += 1;
  if (record.modelUsed?.includes("fallback") || record.inferenceMode === "local-sharp") {
    photoEnhancerTelemetry.fallbackTotal += 1;
  }
  if (record.modelUsed === "sharp-fallback") {
    photoEnhancerTelemetry.runnerFallbackTotal += 1;
  }
  incrementCounter(photoEnhancerTelemetry.modelUsage, record.modelUsed);
  incrementCounter(photoEnhancerTelemetry.inferenceModes, record.inferenceMode);
  incrementCounter(photoEnhancerTelemetry.rawConverters, record.rawConverter);

  photoEnhancerTelemetry.recentEvents.unshift(record);
  photoEnhancerTelemetry.recentEvents = photoEnhancerTelemetry.recentEvents.slice(0, 200);
}

function summarizePhotoEnhancerTelemetry() {
  const durations = photoEnhancerTelemetry.recentEvents
    .filter((event) => event.success)
    .map((event) => event.processingMs)
    .filter((value) => Number.isFinite(value));
  const averageProcessingMs =
    durations.length > 0
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : null;
  const errorRate =
    photoEnhancerTelemetry.requestsTotal > 0
      ? Number((photoEnhancerTelemetry.errorTotal / photoEnhancerTelemetry.requestsTotal).toFixed(4))
      : 0;
  const fallbackRate =
    photoEnhancerTelemetry.requestsTotal > 0
      ? Number((photoEnhancerTelemetry.fallbackTotal / photoEnhancerTelemetry.requestsTotal).toFixed(4))
      : 0;

  return {
    serviceStartedAt: photoEnhancerTelemetry.serviceStartedAt,
    requestsTotal: photoEnhancerTelemetry.requestsTotal,
    successTotal: photoEnhancerTelemetry.successTotal,
    errorTotal: photoEnhancerTelemetry.errorTotal,
    errorRate,
    fallbackTotal: photoEnhancerTelemetry.fallbackTotal,
    fallbackRate,
    runnerFallbackTotal: photoEnhancerTelemetry.runnerFallbackTotal,
    rawConversionTotal: photoEnhancerTelemetry.rawConversionTotal,
    heicConversionTotal: photoEnhancerTelemetry.heicConversionTotal,
    processingTimeMs: {
      average: averageProcessingMs,
      p50: rollingPercentile(durations, 50),
      p95: rollingPercentile(durations, 95),
      sampleSize: durations.length,
    },
    modelUsage: Object.fromEntries(photoEnhancerTelemetry.modelUsage),
    inferenceModes: Object.fromEntries(photoEnhancerTelemetry.inferenceModes),
    rawConverters: Object.fromEntries(photoEnhancerTelemetry.rawConverters),
    lastErrors: photoEnhancerTelemetry.lastErrors.slice(0, 10),
    recentEvents: photoEnhancerTelemetry.recentEvents.slice(0, 25),
  };
}

function addPhotoEnhancerJobEvent(
  job: PhotoEnhancerQueuedJob,
  type: PhotoEnhancerJobTimelineEvent["type"],
  message: string,
  details?: Record<string, unknown>,
) {
  const event: PhotoEnhancerJobTimelineEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    message,
    ...(details ? { details } : {}),
  };
  job.timeline.unshift(event);
  job.auditLog.unshift(event);
  job.timeline = job.timeline.slice(0, 100);
  job.auditLog = job.auditLog.slice(0, 200);
  job.updatedAt = event.timestamp;
}

function publicPhotoEnhancerJob(job: PhotoEnhancerQueuedJob) {
  return {
    id: job.id,
    status: job.status,
    priority: job.priority,
    owner: job.owner,
    userId: job.userId,
    projectId: job.projectId,
    folderId: job.folderId,
    source: {
      bucket: job.source.bucket,
      key: job.source.key,
      fileName: job.source.fileName,
      mimeType: job.source.mimeType,
      size: job.source.size,
      originalHash: job.source.originalHash || null,
    },
    preset: job.preset,
    settings: job.settings,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    expiresAt: job.expiresAt,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    retryHistory: job.retryHistory,
    failureReason: job.failureReason,
    timeline: job.timeline,
    auditLog: job.auditLog,
    artifacts: job.artifacts,
    outputManifest: job.outputManifest,
    checksum: job.checksum,
    result: job.result,
  };
}

function prunePhotoEnhancerJobs() {
  const now = Date.now();
  for (const [id, job] of photoEnhancerJobs) {
    if (["running", "queued", "paused"].includes(job.status)) continue;
    if (Date.parse(job.expiresAt) <= now) {
      photoEnhancerJobs.delete(id);
    }
  }

  const overflow = photoEnhancerJobs.size - PHOTO_ENHANCER_QUEUE_MAX_JOBS;
  if (overflow <= 0) return;
  const deletable = [...photoEnhancerJobs.values()]
    .filter((job) => !["running", "queued", "paused"].includes(job.status))
    .sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt))
    .slice(0, overflow);
  for (const job of deletable) photoEnhancerJobs.delete(job.id);
}

function getPhotoEnhancerQueueRuntime() {
  const jobs = [...photoEnhancerJobs.values()];
  const running = jobs.filter((job) => job.status === "running");
  const queued = jobs.filter((job) => job.status === "queued");
  const paused = jobs.filter((job) => job.status === "paused");
  const completed = jobs.filter((job) => job.status === "completed");
  const failed = jobs.filter((job) => job.status === "failed");
  const cancelled = jobs.filter((job) => job.status === "cancelled");
  const freeMemoryMb = Math.round(os.freemem() / 1024 / 1024);
  return {
    paused: photoEnhancerQueuePaused,
    counts: {
      total: jobs.length,
      queued: queued.length,
      running: running.length,
      paused: paused.length,
      completed: completed.length,
      failed: failed.length,
      cancelled: cancelled.length,
    },
    concurrency: {
      global: PHOTO_ENHANCER_QUEUE_CONCURRENCY,
      perUser: PHOTO_ENHANCER_QUEUE_PER_USER_CONCURRENCY,
      perProject: PHOTO_ENHANCER_QUEUE_PER_PROJECT_CONCURRENCY,
    },
    memory: {
      freeMb: freeMemoryMb,
      minFreeMb: PHOTO_ENHANCER_QUEUE_MEMORY_FREE_MIN_MB,
      canStart: freeMemoryMb >= PHOTO_ENHANCER_QUEUE_MEMORY_FREE_MIN_MB,
      policy: "memory-aware queue gate",
    },
    fileSizePolicy: {
      largeFileBytes: PHOTO_ENHANCER_QUEUE_LARGE_FILE_BYTES,
      ordering: "priority desc, smaller files first within same priority",
    },
    expiryPolicy: {
      ttlMs: PHOTO_ENHANCER_QUEUE_JOB_TTL_MS,
      retention: "process-memory until ttl or max job cap",
    },
  };
}

function canStartPhotoEnhancerJob(job: PhotoEnhancerQueuedJob) {
  if (photoEnhancerQueuePaused || job.cancelled || job.status !== "queued") return false;
  if (os.freemem() / 1024 / 1024 < PHOTO_ENHANCER_QUEUE_MEMORY_FREE_MIN_MB) return false;
  const running = [...photoEnhancerJobs.values()].filter((item) => item.status === "running");
  if (running.length >= PHOTO_ENHANCER_QUEUE_CONCURRENCY) return false;
  if (running.filter((item) => item.userId === job.userId).length >= PHOTO_ENHANCER_QUEUE_PER_USER_CONCURRENCY) {
    return false;
  }
  if (
    running.filter((item) => item.projectId === job.projectId).length >= PHOTO_ENHANCER_QUEUE_PER_PROJECT_CONCURRENCY
  ) {
    return false;
  }
  return true;
}

function schedulePhotoEnhancerQueue() {
  if (photoEnhancerQueueWakeupScheduled) return;
  photoEnhancerQueueWakeupScheduled = true;
  setImmediate(() => {
    photoEnhancerQueueWakeupScheduled = false;
    prunePhotoEnhancerJobs();
    if (photoEnhancerQueuePaused) return;
    const runnable = [...photoEnhancerJobs.values()]
      .filter((job) => job.status === "queued" && !job.cancelled)
      .sort((left, right) => {
        if (right.priority !== left.priority) return right.priority - left.priority;
        const leftLargePenalty = left.source.size >= PHOTO_ENHANCER_QUEUE_LARGE_FILE_BYTES ? 1 : 0;
        const rightLargePenalty = right.source.size >= PHOTO_ENHANCER_QUEUE_LARGE_FILE_BYTES ? 1 : 0;
        if (leftLargePenalty !== rightLargePenalty) return leftLargePenalty - rightLargePenalty;
        if (left.source.size !== right.source.size) return left.source.size - right.source.size;
        return Date.parse(left.createdAt) - Date.parse(right.createdAt);
      });
    for (const job of runnable) {
      if (!canStartPhotoEnhancerJob(job)) continue;
      void runPhotoEnhancerQueuedJob(job);
    }
  });
}

async function buildPhotoEnhancerQueuedJobFile(params: {
  job: PhotoEnhancerQueuedJob;
  downloaded: Awaited<ReturnType<typeof downloadPhotoEnhancerR2ObjectToTemp>>;
}): Promise<Express.Multer.File> {
  const sourceMetaFile = {
    originalname: params.job.source.fileName,
    mimetype: params.downloaded.mimeType || params.job.source.mimeType,
    size: params.downloaded.size,
  };

  if (params.downloaded.size <= PHOTO_ENHANCER_R2_ANALYZE_BUFFER_MAX_BYTES) {
    return makeMulterMemoryFile({
      originalname: params.job.source.fileName,
      mimetype: sourceMetaFile.mimetype,
      size: params.downloaded.size,
      buffer: await fs.readFile(params.downloaded.inputPath),
    });
  }

  if (isCameraRawFile(sourceMetaFile)) {
    const preview = await extractEmbeddedPreviewImageFromPath(sourceMetaFile, params.downloaded.inputPath);
    if (preview) {
      addPhotoEnhancerJobEvent(params.job, "progress", "Large RAW source processed from embedded preview.", {
        previewSize: preview.size,
      });
      return preview;
    }
  }

  throw new Error("photo_enhancer_large_raster_requires_external_worker");
}

async function runPhotoEnhancerQueuedJob(job: PhotoEnhancerQueuedJob) {
  if (!canStartPhotoEnhancerJob(job)) return;
  job.status = "running";
  job.startedAt = new Date().toISOString();
  job.attempts += 1;
  job.progress = Math.max(job.progress, 5);
  addPhotoEnhancerJobEvent(job, "started", `Started attempt ${job.attempts}.`, {
    sourceBytes: job.source.size,
    modelPreference: job.settings.modelPreference,
  });

  let downloaded: Awaited<ReturnType<typeof downloadPhotoEnhancerR2ObjectToTemp>> | null = null;
  const startedAt = Date.now();
  try {
    if (job.cancelled) throw new Error("job_cancelled");
    downloaded = await downloadPhotoEnhancerR2ObjectToTemp({
      bucket: job.source.bucket,
      key: job.source.key,
      fileName: job.source.fileName,
      expectedMimeType: job.source.mimeType,
      expectedSize: job.source.size,
    });
    job.source.originalHash = downloaded.originalHash;
    job.progress = 25;
    addPhotoEnhancerJobEvent(job, "progress", "Source downloaded from R2.", {
      bytes: downloaded.size,
      originalHash: downloaded.originalHash,
    });

    if (job.cancelled) throw new Error("job_cancelled");
    const processFile = await buildPhotoEnhancerQueuedJobFile({ job, downloaded });
    job.progress = 45;
    addPhotoEnhancerJobEvent(job, "progress", "Source prepared for enhancement.", {
      mimeType: processFile.mimetype,
      bytes: processFile.size,
    });

    const enhancementResult = await buildPhotoEnhancerEnhancementPayload({
      file: processFile,
      preset: job.preset,
      settings: job.settings,
    });
    if (!enhancementResult.ok) {
      throw new Error(enhancementResult.error || conversionErrorMessage(enhancementResult.raw));
    }
    if (job.cancelled) throw new Error("job_cancelled");

    const enhancedImageUrl = readString(enhancementResult.payload.enhancedImageUrl) || "";
    const decoded = enhancedImageUrl ? dataUrlToBuffer(enhancedImageUrl) : null;
    let savedFile: PhotoEnhancerSavedFile | null = null;
    let checksum: string | null = null;
    if (decoded) {
      checksum = crypto.createHash("sha256").update(decoded.buffer).digest("hex");
      savedFile = await persistEnhancedBuffer({
        projectId: job.projectId,
        folderId: job.folderId,
        buffer: decoded.buffer,
        mimeType: decoded.mimeType,
        preset: job.preset,
        settings: job.settings,
        namePrefix: "photo-enhancer-job",
      });
    }

    const processingMs = Date.now() - startedAt;
    job.status = "completed";
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    job.failureReason = null;
    job.checksum = checksum;
    job.artifacts = [
      {
        id: `${job.id}:source`,
        type: "source",
        mimeType: job.source.mimeType,
        size: job.source.size,
        url: null,
        checksum: downloaded.originalHash,
      },
      ...(savedFile
        ? [
            {
              id: savedFile.id,
              type: "enhanced-image" as const,
              mimeType: savedFile.mimeType,
              size: savedFile.size,
              url: savedFile.downloadUrl,
              checksum,
            },
          ]
        : []),
    ];
    job.outputManifest = {
      jobId: job.id,
      source: job.source,
      preset: job.preset,
      settings: job.settings,
      modelUsed: enhancementResult.modelUsed,
      inferenceMode: enhancementResult.inferenceMode,
      outputMimeType: enhancementResult.outputMimeType,
      processingMs,
      checksum,
      artifacts: job.artifacts,
    };
    job.result = {
      ...enhancementResult.payload,
      ...(savedFile ? { savedFile: toPublicSavedFile(savedFile), enhancedImageUrl: savedFile.downloadUrl } : {}),
      source: job.source,
      processingMs,
      jobId: job.id,
      checksum,
      rawConverter: readString(enhancementResult.prepared.raw.converter),
      lensCorrectionApplied: Boolean(enhancementResult.prepared.raw.lensCorrectionApplied),
      conversionErrors: enhancementResult.prepared.raw.attemptErrors ?? null,
    };
    addPhotoEnhancerJobEvent(job, "completed", "Enhancement completed.", {
      modelUsed: enhancementResult.modelUsed,
      inferenceMode: enhancementResult.inferenceMode,
      processingMs,
      checksum,
    });
    trackPhotoEnhancerEvent({
      route: "batch",
      success: true,
      fileName: job.source.fileName,
      sourceExtension: getUploadExtension({ originalname: job.source.fileName }),
      sourceMimeType: job.source.mimeType,
      raw: Boolean(enhancementResult.prepared.raw.raw),
      heic: Boolean(enhancementResult.prepared.raw.heic),
      rawConverter: readString(enhancementResult.prepared.raw.converter),
      preset: job.preset,
      modelUsed: enhancementResult.modelUsed,
      inferenceMode: `queue:${enhancementResult.inferenceMode}`,
      processingMs,
      outputMimeType: enhancementResult.outputMimeType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const processingMs = Date.now() - startedAt;
    if (job.cancelled || message === "job_cancelled") {
      job.status = "cancelled";
      job.progress = Math.min(job.progress, 99);
      job.completedAt = new Date().toISOString();
      job.failureReason = "Cancelled by user.";
      addPhotoEnhancerJobEvent(job, "cancelled", "Job was cancelled.", { processingMs });
    } else if (job.attempts < job.maxAttempts) {
      job.status = "queued";
      job.progress = 0;
      job.failureReason = message;
      job.retryHistory.push({
        attempt: job.attempts,
        timestamp: new Date().toISOString(),
        reason: message,
      });
      addPhotoEnhancerJobEvent(job, "retry", "Job failed and was queued for retry.", {
        attempt: job.attempts,
        reason: message,
      });
    } else {
      job.status = "failed";
      job.progress = 0;
      job.completedAt = new Date().toISOString();
      job.failureReason = message;
      addPhotoEnhancerJobEvent(job, "failed", "Job failed.", {
        attempt: job.attempts,
        reason: message,
        processingMs,
      });
    }
    trackPhotoEnhancerEvent({
      route: "batch",
      success: false,
      fileName: job.source.fileName,
      sourceExtension: getUploadExtension({ originalname: job.source.fileName }),
      sourceMimeType: job.source.mimeType,
      raw: isCameraRawFile({ originalname: job.source.fileName, mimetype: job.source.mimeType }),
      heic: isHeicFile({ originalname: job.source.fileName, mimetype: job.source.mimeType }),
      preset: job.preset,
      processingMs,
      error: message,
    });
  } finally {
    if (downloaded?.tempDir) {
      await fs.rm(downloaded.tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
    schedulePhotoEnhancerQueue();
  }
}

function normalizeRawExtension(value: string | null | undefined): string {
  if (!value) return "";
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  return normalized.startsWith(".") ? normalized : `.${normalized}`;
}

function rawFormatStatusLabel(status: PhotoEnhancerRawFormatRuntimeStatus): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "supported-untested":
      return "Supported but untested";
    case "unsupported-external":
      return "Unsupported / external converter";
    case "failed":
      return "Failed latest verification";
    case "unavailable":
      return "Converter runtime unavailable";
    default:
      return "Supported but untested";
  }
}

function recordRawFormatVerification(verification: PhotoEnhancerRawFormatVerification) {
  const extension = normalizeRawExtension(verification.extension);
  if (!extension) return;
  photoEnhancerRawFormatVerifications.set(extension, {
    ...verification,
    extension,
    verifiedAt: verification.verifiedAt || new Date().toISOString(),
  });
}

function buildPhotoEnhancerRawFormatMatrix(
  runtimeSupport: Awaited<ReturnType<typeof resolveRuntimeSupport>>,
) {
  const entries: PhotoEnhancerRawFormatRuntimeEntry[] = PHOTO_ENHANCER_RAW_FORMAT_MATRIX.map((entry) => {
    const verification = photoEnhancerRawFormatVerifications.get(entry.extension);
    const supportedByConfiguredList = PHOTO_ENHANCER_RAW_FORMATS.includes(entry.extension);
    const converterRuntimeAvailable = runtimeSupport.raw.available && supportedByConfiguredList;
    let status: PhotoEnhancerRawFormatRuntimeStatus = entry.defaultStatus;

    if (entry.requiresExternalConverter) {
      status = "unsupported-external";
    } else if (verification?.status === "verified") {
      status = "verified";
    } else if (verification?.status === "failed") {
      status = "failed";
    } else if (!converterRuntimeAvailable) {
      status = "unavailable";
    }

    return {
      ...entry,
      status,
      statusLabel: rawFormatStatusLabel(status),
      converter: verification?.converter ?? null,
      verifiedAt: verification?.status === "verified" ? verification.verifiedAt : null,
      width: verification?.width ?? null,
      height: verification?.height ?? null,
      outputMimeType: verification?.outputMimeType ?? null,
      resolutionMode: verification?.resolutionMode ?? null,
      error: verification?.status === "failed" ? verification.error ?? null : null,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    entries,
    summary: {
      total: entries.length,
      verified: entries.filter((entry) => entry.status === "verified").length,
      supportedUntested: entries.filter((entry) => entry.status === "supported-untested").length,
      unsupportedExternal: entries.filter((entry) => entry.status === "unsupported-external").length,
      failed: entries.filter((entry) => entry.status === "failed").length,
      unavailable: entries.filter((entry) => entry.status === "unavailable").length,
    },
  };
}

const defaultSettings: PhotoEnhancerSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  denoising: 50,
  faceEnhancement: 75,
  modelPreference: "auto",
  gfpganQuality: 75,
  codeformerFidelity: 65,
  realesrganScale: 2,
  swinir: false,
  bsrgan: false,
  diffbir: false,
  faceOnlyCrop: false,
  preserveBackground: true,
  skinTextureGuard: 70,
  teethWhiteness: 0,
  eyeBrightness: 0,
  eyeWhiteness: 0,
  blemishRemoval: 0,
  teethProfile: "normal",
  eyeBrightnessProfile: "normal",
  eyeWhitenessProfile: "normal",
  blemishProfile: "normal",
  subject: "",
  subjectLookStrength: 0,
  hsl: {
    red: { h: 0, s: 0, l: 0 },
    orange: { h: 0, s: 0, l: 0 },
    yellow: { h: 0, s: 0, l: 0 },
    green: { h: 0, s: 0, l: 0 },
    aqua: { h: 0, s: 0, l: 0 },
    blue: { h: 0, s: 0, l: 0 },
    purple: { h: 0, s: 0, l: 0 },
    magenta: { h: 0, s: 0, l: 0 },
  },
  lut: { name: null, strength: 0 },
  perFaceOverrides: [],
  lensCorrection: {
    enabled: false,
    auto: true,
    distortion: 0,
    vignette: 0,
    chromaticAberration: 0,
  },
};

const PER_FACE_OVERRIDE_KEYS: ReadonlyArray<keyof PerFaceOverride["controls"]> = [
  "teethWhiteness",
  "eyeBrightness",
  "eyeWhiteness",
  "blemishRemoval",
  "teethProfile",
  "eyeBrightnessProfile",
  "eyeWhitenessProfile",
  "blemishProfile",
  "skinTextureGuard",
  "faceEnhancement",
];

function normalizePerFaceOverrides(raw: unknown): PerFaceOverride[] {
  if (!Array.isArray(raw)) return [];
  const out: PerFaceOverride[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const source = entry as Record<string, unknown>;
    const idxRaw = source.faceIndex;
    const idx = typeof idxRaw === "number" ? idxRaw : Number(idxRaw);
    if (!Number.isFinite(idx) || idx < 0 || idx > 32) continue;
    const controlsRaw = source.controls;
    if (!controlsRaw || typeof controlsRaw !== "object") continue;
    const rawControls = controlsRaw as Record<string, unknown>;
    const normalized: PerFaceOverride["controls"] = {};
    for (const key of PER_FACE_OVERRIDE_KEYS) {
      const v = rawControls[key];
      if (v === undefined) continue;
      if (key === "teethProfile" || key === "eyeBrightnessProfile" || key === "eyeWhitenessProfile" || key === "blemishProfile") {
        normalized[key] = normalizeIntensityProfile(v);
      } else {
        const n = readNumber(v);
        if (n !== null) {
          const clamped = key === "skinTextureGuard" || key === "faceEnhancement"
            ? clampNumber(n, 0, 100)
            : clampNumber(n, 0, 100);
          (normalized as Record<string, number | IntensityProfile>)[key] = clamped;
        }
      }
    }
    if (Object.keys(normalized).length === 0) continue;
    out.push({ faceIndex: Math.round(idx), controls: normalized });
  }
  return out;
}

/** Sanitise a LUT selection. Unknown name shape → no-LUT. Strength is
 *  clamped to [0, 100]. Doesn't validate the slug against the runner
 *  registry here — an unknown slug is logged + skipped on the runner
 *  side rather than rejecting the whole enhance request. */
function normalizeLut(raw: unknown): LutSelection {
  if (!raw || typeof raw !== "object") return { name: null, strength: 0 };
  const source = raw as Record<string, unknown>;
  const rawName = source.name;
  const name =
    typeof rawName === "string" && rawName.trim().length > 0
      ? rawName.trim().slice(0, 80)
      : null;
  const strength = clampNumber(readNumber(source.strength) ?? 0, 0, 100);
  if (!name) return { name: null, strength: 0 };
  return { name, strength };
}

const presetSettings: Record<string, Partial<PhotoEnhancerSettings>> = {
  auto: { contrast: 8, saturation: 6, sharpness: 14, denoising: 35 },
  portrait: {
    brightness: 4,
    contrast: 6,
    saturation: 4,
    sharpness: 12,
    denoising: 45,
    faceEnhancement: 85,
    gfpganQuality: 82,
    codeformerFidelity: 70,
    skinTextureGuard: 82,
    teethWhiteness: 25,
    eyeBrightness: 20,
    eyeWhiteness: 15,
    blemishRemoval: 35,
  },
  wedding: {
    brightness: 5,
    contrast: 5,
    saturation: 7,
    sharpness: 10,
    denoising: 40,
    faceEnhancement: 80,
    gfpganQuality: 78,
    codeformerFidelity: 68,
    preserveBackground: true,
    teethWhiteness: 30,
    eyeBrightness: 22,
    eyeWhiteness: 18,
    blemishRemoval: 40,
  },
  landscape: { contrast: 12, saturation: 16, sharpness: 18, denoising: 25 },
  product: { brightness: 8, contrast: 10, saturation: 6, sharpness: 20 },
  studio: { brightness: 3, contrast: 9, saturation: 4, sharpness: 16 },
};

function getUploadExtension(file: Pick<Express.Multer.File, "originalname">): string {
  return path.extname(String(file.originalname || "")).toLowerCase();
}

function isCameraRawFile(file: Pick<Express.Multer.File, "originalname" | "mimetype">): boolean {
  const extension = getUploadExtension(file);
  const mimetype = String(file.mimetype || "").toLowerCase();
  return (
    PHOTO_ENHANCER_RAW_FORMATS.includes(extension) ||
    mimetype.includes("x-canon-cr") ||
    mimetype.includes("x-nikon-nef") ||
    mimetype.includes("x-sony-arw") ||
    mimetype.includes("x-adobe-dng")
  );
}

function isHeicFile(file: Pick<Express.Multer.File, "originalname" | "mimetype">): boolean {
  const extension = getUploadExtension(file);
  const mimetype = String(file.mimetype || "").toLowerCase();
  return extension === ".heic" || extension === ".heif" || mimetype.includes("heic") || mimetype.includes("heif");
}

function hasUnavailableSourceConversion(conversion: Record<string, unknown>): boolean {
  return Boolean((conversion.raw || conversion.heic) && conversion.converter === null && conversion.error);
}

function conversionErrorCode(conversion: Record<string, unknown>): string {
  return conversion.heic ? "heic_conversion_unavailable" : "raw_conversion_unavailable";
}

function conversionErrorMessage(conversion: Record<string, unknown>): string {
  if (typeof conversion.error === "string" && conversion.error) return conversion.error;
  return conversion.heic ? "HEIC conversion unavailable" : "RAW conversion unavailable";
}

function isSupportedPhotoUpload(file: Pick<Express.Multer.File, "originalname" | "mimetype">): boolean {
  const mimetype = String(file.mimetype || "").toLowerCase();
  const extension = getUploadExtension(file);
  return (
    mimetype.startsWith("image/") ||
    PHOTO_ENHANCER_RASTER_FORMATS.includes(extension) ||
    PHOTO_ENHANCER_RAW_FORMATS.includes(extension)
  );
}

const photoEnhancerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PHOTO_ENHANCER_MAX_FILE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (isSupportedPhotoUpload(file)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only raster or camera RAW image uploads are supported by Photo Enhancer."));
  },
});

const photoEnhancerR2PartUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PHOTO_ENHANCER_R2_PROXY_PART_MAX_BYTES,
  },
});

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function sanitizeR2KeySegment(value: string, fallback = "file"): string {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[^\w.\-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 160);
  return sanitized || fallback;
}

function buildPhotoEnhancerUploadR2Config(): PhotoEnhancerR2UploadConfig {
  const base = buildPhotoEnhancerR2Config();
  const bucket = firstNonEmpty(
    process.env.PHOTO_ENHANCER_R2_UPLOAD_BUCKET,
    process.env.CLOUDFLARE_R2_UPLOAD_BUCKET,
    process.env.R2_UPLOAD_BUCKET,
    process.env.CLOUDFLARE_R2_BUCKET,
    process.env.R2_BUCKET,
    base.bucket,
  );
  return {
    enabled: Boolean(base.endpoint && bucket && base.accessKeyId && base.secretAccessKey),
    endpoint: base.endpoint,
    bucket,
    accessKeyId: base.accessKeyId,
    secretAccessKey: base.secretAccessKey,
    prefix: PHOTO_ENHANCER_R2_UPLOAD_PREFIX,
  };
}

function getPhotoEnhancerUploadR2Client(config: PhotoEnhancerR2UploadConfig): S3Client | null {
  if (!config.enabled || !config.endpoint || !config.accessKeyId || !config.secretAccessKey) return null;
  const cacheKey = [config.endpoint, config.accessKeyId].join("|");
  if (photoEnhancerR2UploadClient && photoEnhancerR2UploadClientCacheKey === cacheKey) {
    return photoEnhancerR2UploadClient;
  }

  photoEnhancerR2UploadClient = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  photoEnhancerR2UploadClientCacheKey = cacheKey;
  return photoEnhancerR2UploadClient;
}

function calculatePhotoEnhancerR2PartSize(size: number, preferredPartSize?: number | null): number {
  const minPartSize = 5 * 1024 * 1024;
  const requested = Math.max(minPartSize, preferredPartSize || PHOTO_ENHANCER_R2_PART_SIZE_BYTES);
  if (!Number.isFinite(size) || size <= 0) return requested;
  const partSizeForMaxParts = Math.ceil(size / 10_000 / minPartSize) * minPartSize;
  return Math.max(requested, partSizeForMaxParts);
}

function buildPhotoEnhancerUploadKey(params: {
  fileName: string;
  projectId?: string | null;
  contentHash?: string | null;
}) {
  const now = new Date();
  const datePrefix = now.toISOString().slice(0, 10);
  const projectSegment = sanitizeR2KeySegment(params.projectId || "unassigned", "unassigned");
  const id = crypto.randomUUID();
  const baseName = sanitizeR2KeySegment(path.basename(params.fileName || "upload.raw"), "upload.raw");
  const hashSegment = params.contentHash ? sanitizeR2KeySegment(params.contentHash.slice(0, 24), "hash") : null;
  return [
    PHOTO_ENHANCER_R2_UPLOAD_PREFIX,
    projectSegment,
    datePrefix,
    hashSegment ? `${id}-${hashSegment}` : id,
    baseName,
  ]
    .filter(Boolean)
    .join("/");
}

function isAllowedPhotoEnhancerR2Object(bucket: string | null | undefined, key: string | null | undefined) {
  const config = buildPhotoEnhancerUploadR2Config();
  return Boolean(
    config.enabled &&
      config.bucket &&
      bucket === config.bucket &&
      typeof key === "string" &&
      key.startsWith(`${PHOTO_ENHANCER_R2_UPLOAD_PREFIX}/`) &&
      !key.includes(".."),
  );
}

function readPhotoEnhancerR2Source(value: unknown, fallback: Record<string, unknown> = {}): PhotoEnhancerR2Source | null {
  const sourceRecord = parseJsonObject(value);
  const bucket = readString(sourceRecord.bucket) || readString(fallback.bucket);
  const key = readString(sourceRecord.key) || readString(fallback.key);
  const fileName = readString(sourceRecord.fileName) || readString(fallback.fileName) || "upload.raw";
  const mimeType =
    readString(sourceRecord.mimeType) ||
    readString(sourceRecord.contentType) ||
    readString(fallback.mimeType) ||
    readString(fallback.contentType) ||
    "application/octet-stream";
  const size = readNumber(sourceRecord.size) || readNumber(fallback.size) || 0;
  if (!bucket || !key || !size) return null;
  return {
    bucket,
    key,
    fileName,
    mimeType,
    size,
    uploadId: readString(sourceRecord.uploadId) || null,
    originalHash: readString(sourceRecord.originalHash) || null,
  };
}

function makeMulterMemoryFile(params: {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size?: number;
}): Express.Multer.File {
  return {
    fieldname: "image",
    originalname: params.originalname,
    encoding: "7bit",
    mimetype: params.mimetype || "application/octet-stream",
    size: params.size ?? params.buffer.byteLength,
    buffer: params.buffer,
  } as Express.Multer.File;
}

function r2BodyToReadable(body: unknown): Readable {
  if (body instanceof Readable) return body;
  if (body && typeof (body as { transformToWebStream?: unknown }).transformToWebStream === "function") {
    return Readable.fromWeb((body as { transformToWebStream: () => NodeReadableStream<Uint8Array> }).transformToWebStream());
  }
  if (body && typeof (body as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function") {
    return Readable.from(body as AsyncIterable<unknown>);
  }
  throw new Error("r2_body_stream_unavailable");
}

async function downloadPhotoEnhancerR2ObjectToTemp(params: {
  bucket: string;
  key: string;
  fileName: string;
  expectedSize?: number | null;
  expectedMimeType?: string | null;
}) {
  const config = buildPhotoEnhancerUploadR2Config();
  const client = getPhotoEnhancerUploadR2Client(config);
  if (!client || !config.bucket) throw new Error("photo_enhancer_r2_upload_not_configured");
  if (!isAllowedPhotoEnhancerR2Object(params.bucket, params.key)) {
    throw new Error("photo_enhancer_r2_object_not_allowed");
  }

  const head = await client.send(
    new HeadObjectCommand({
      Bucket: params.bucket,
      Key: params.key,
    }),
  );
  const contentLength = Number(head.ContentLength ?? params.expectedSize ?? 0);
  if (Number.isFinite(contentLength) && contentLength > PHOTO_ENHANCER_R2_ANALYZE_DOWNLOAD_MAX_BYTES) {
    throw new Error("photo_enhancer_r2_object_too_large_for_sync_analysis");
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "creatorhub-photo-r2-"));
  const inputPath = path.join(tempDir, sanitizeR2KeySegment(path.basename(params.fileName), "source.img"));
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  const response = await client.send(
    new GetObjectCommand({
      Bucket: params.bucket,
      Key: params.key,
    }),
  );
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.byteLength;
      if (bytes > PHOTO_ENHANCER_R2_ANALYZE_DOWNLOAD_MAX_BYTES) {
        callback(new Error("photo_enhancer_r2_object_too_large_for_sync_analysis"));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(r2BodyToReadable(response.Body), meter, createWriteStream(inputPath));
    return {
      tempDir,
      inputPath,
      size: bytes,
      originalHash: hash.digest("hex"),
      mimeType: response.ContentType || head.ContentType || params.expectedMimeType || "application/octet-stream",
      lastModified: response.LastModified || head.LastModified || null,
    };
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

function normalizeLensCorrection(raw: unknown): LensCorrection {
  const obj = parseJsonObject(raw);
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : false,
    auto: typeof obj.auto === "boolean" ? obj.auto : true,
    distortion: clampNumber(readNumber(obj.distortion) ?? 0, 0, 100),
    vignette: clampNumber(readNumber(obj.vignette) ?? 0, 0, 100),
    chromaticAberration: clampNumber(readNumber(obj.chromaticAberration) ?? 0, 0, 100),
  };
}

function normalizeSettings(
  rawSettings: unknown,
  preset: string,
): PhotoEnhancerSettings {
  const raw = parseJsonObject(rawSettings);
  const merged = {
    ...defaultSettings,
    ...(presetSettings[preset] || {}),
  };

  const STRING_SETTING_KEYS: ReadonlySet<keyof PhotoEnhancerSettings> = new Set([
    "modelPreference",
    "teethProfile",
    "eyeBrightnessProfile",
    "eyeWhitenessProfile",
    "blemishProfile",
    "subject",
  ]);

  for (const key of Object.keys(defaultSettings) as Array<
    keyof PhotoEnhancerSettings
  >) {
    if (typeof merged[key] === "boolean" || STRING_SETTING_KEYS.has(key)) continue;
    const value = readNumber(raw[key]);
    if (value !== null) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  const modelPreference = readString(raw.modelPreference) || readString(raw.model) || merged.modelPreference;
  const normalizedModelPreference = [
    "auto",
    "sharp",
    "gfpgan",
    "codeformer",
    "realesrgan",
    "swinir",
    "bsrgan",
    "diffbir",
  ].includes(modelPreference)
    ? modelPreference
    : "auto";

  const readBooleanOption = (key: string, fallback: boolean) =>
    typeof raw[key] === "boolean" ? Boolean(raw[key]) : fallback;

  return {
    brightness: clampNumber(merged.brightness, -100, 100),
    contrast: clampNumber(merged.contrast, -100, 100),
    saturation: clampNumber(merged.saturation, -100, 100),
    sharpness: clampNumber(merged.sharpness, -100, 100),
    denoising: clampNumber(merged.denoising, 0, 100),
    faceEnhancement: clampNumber(merged.faceEnhancement, 0, 100),
    modelPreference: normalizedModelPreference,
    gfpganQuality: clampNumber(merged.gfpganQuality, 0, 100),
    codeformerFidelity: clampNumber(merged.codeformerFidelity, 0, 100),
    realesrganScale: [2, 3, 4].includes(Math.round(merged.realesrganScale))
      ? Math.round(merged.realesrganScale)
      : 2,
    swinir: readBooleanOption("swinir", Boolean(merged.swinir)),
    bsrgan: readBooleanOption("bsrgan", Boolean(merged.bsrgan)),
    diffbir: readBooleanOption("diffbir", Boolean(merged.diffbir)),
    faceOnlyCrop: readBooleanOption("faceOnlyCrop", Boolean(merged.faceOnlyCrop)),
    preserveBackground: readBooleanOption("preserveBackground", Boolean(merged.preserveBackground)),
    skinTextureGuard: clampNumber(merged.skinTextureGuard, 0, 100),
    teethWhiteness: clampNumber(merged.teethWhiteness, 0, 100),
    eyeBrightness: clampNumber(merged.eyeBrightness, 0, 100),
    eyeWhiteness: clampNumber(merged.eyeWhiteness, 0, 100),
    blemishRemoval: clampNumber(merged.blemishRemoval, 0, 100),
    teethProfile: normalizeIntensityProfile(raw.teethProfile ?? merged.teethProfile),
    eyeBrightnessProfile: normalizeIntensityProfile(
      raw.eyeBrightnessProfile ?? merged.eyeBrightnessProfile,
    ),
    eyeWhitenessProfile: normalizeIntensityProfile(
      raw.eyeWhitenessProfile ?? merged.eyeWhitenessProfile,
    ),
    blemishProfile: normalizeIntensityProfile(
      raw.blemishProfile ?? merged.blemishProfile,
    ),
    subject: normalizeSubjectKind(raw.subject ?? merged.subject),
    subjectLookStrength: clampNumber(merged.subjectLookStrength, 0, 100),
    hsl: normalizeHsl(raw.hsl ?? merged.hsl),
    lut: normalizeLut(raw.lut ?? merged.lut),
    perFaceOverrides: normalizePerFaceOverrides(raw.perFaceOverrides ?? merged.perFaceOverrides),
    lensCorrection: normalizeLensCorrection(raw.lensCorrection ?? merged.lensCorrection),
  };
}

async function resolveGfpganModelStatus(): Promise<PhotoEnhancerModelStatus> {
  const statuses = await resolvePhotoEnhancerModelStatuses();
  const gfpgan = statuses.find((model) => model.id === "gfpgan");
  if (gfpgan) return gfpgan;

  const r2 = buildPhotoEnhancerR2Config();
  return {
    id: "gfpgan",
    displayName: "GFPGAN",
    modelType: "face-restoration",
    description: "GFPGAN face restoration model",
    recommendedFor: ["portrait"],
    candidateKeys: gfpganCandidateKeys,
    runnerEnvKeys: ["PHOTO_ENHANCER_GFPGAN_URL", "GFPGAN_SERVICE_URL"],
    storageType: "r2",
    r2Key: gfpganCandidateKeys[0],
    available: false,
    reason: r2.enabled
      ? "GFPGAN weights were not found in configured R2 bucket"
      : "R2 model credentials are not configured",
    weights: {
      configured: r2.enabled,
      found: false,
      bucket: null,
      key: null,
      checkedBuckets: r2.buckets,
      checkedKeys: gfpganCandidateKeys,
      reason: r2.enabled
        ? "GFPGAN weights were not found in configured R2 bucket"
        : "R2 model credentials are not configured",
    },
    runner: {
      configured: Boolean(
        resolvePhotoEnhancerRunnerEndpoint({
          runnerEnvKeys: ["PHOTO_ENHANCER_GFPGAN_URL", "GFPGAN_SERVICE_URL"],
          defaultRunnerUrl:
            process.env.RENDER === "true"
              ? "https://creatorhub-gfpgan-runner.onrender.com/enhance"
              : null,
        }),
      ),
      healthy: null,
      endpoint: resolvePhotoEnhancerRunnerEndpoint({
        runnerEnvKeys: ["PHOTO_ENHANCER_GFPGAN_URL", "GFPGAN_SERVICE_URL"],
        defaultRunnerUrl:
          process.env.RENDER === "true"
            ? "https://creatorhub-gfpgan-runner.onrender.com/enhance"
            : null,
      }),
      envKeys: ["PHOTO_ENHANCER_GFPGAN_URL", "GFPGAN_SERVICE_URL"],
      reason: "Runner health is not checked in fallback status",
    },
    inferenceAvailable: false,
    readinessReason: r2.enabled
      ? "GFPGAN weights were not found in configured R2 bucket"
      : "R2 model credentials are not configured",
    r2: {
      enabled: r2.enabled,
      endpoint: r2.endpoint,
      bucket: r2.bucket,
      buckets: r2.buckets,
    },
  };
}

async function computeImageHash(file: Express.Multer.File): Promise<string | null> {
  try {
    const imageHashModule = await import("image-hash");
    const imageHash = (imageHashModule as { imageHash?: unknown }).imageHash;
    if (typeof imageHash !== "function") return null;

    return await new Promise((resolve) => {
      imageHash(
        {
          data: file.buffer,
          ext: file.mimetype,
          name: file.originalname,
        },
        16,
        true,
        (error: Error | null, data: string | null) => {
          resolve(error ? null : data || null);
        },
      );
    });
  } catch {
    return null;
  }
}

function computeOriginalFileHash(file: Express.Multer.File): string {
  return crypto.createHash("sha256").update(file.buffer).digest("hex");
}

function capDuplicateIndex(index: Map<string, PhotoEnhancerDuplicateIndexEntry>) {
  while (index.size > PHOTO_ENHANCER_DUPLICATE_INDEX_LIMIT) {
    const oldestKey = index.keys().next().value as string | undefined;
    if (!oldestKey) break;
    index.delete(oldestKey);
  }
}

function bitDistance(left: string | null, right: string | null): number | null {
  if (!left || !right || left.length !== right.length) return null;
  if (/^[01]+$/.test(left) && /^[01]+$/.test(right)) {
    let distance = 0;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) distance += 1;
    }
    return distance;
  }
  if (/^[a-f0-9]+$/i.test(left) && /^[a-f0-9]+$/i.test(right)) {
    let distance = 0;
    for (let index = 0; index < left.length; index += 1) {
      const xor = Number.parseInt(left[index], 16) ^ Number.parseInt(right[index], 16);
      distance += xor.toString(2).replace(/0/g, "").length;
    }
    return distance;
  }
  return null;
}

function detectAndRecordDuplicate(
  file: Express.Multer.File,
  originalHash: string,
  perceptualHash: string | null,
) {
  const now = new Date().toISOString();
  const exact = photoEnhancerOriginalHashIndex.get(originalHash) || null;
  let perceptual: (PhotoEnhancerDuplicateIndexEntry & { distance: number }) | null = null;

  if (perceptualHash) {
    for (const entry of photoEnhancerPerceptualHashIndex.values()) {
      const distance = bitDistance(perceptualHash, entry.perceptualHash);
      if (distance !== null && distance <= 8) {
        perceptual = { ...entry, distance };
        break;
      }
    }
  }

  const entry: PhotoEnhancerDuplicateIndexEntry = exact
    ? {
        ...exact,
        lastSeenAt: now,
        count: exact.count + 1,
      }
    : {
        hash: originalHash,
        perceptualHash,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        firstSeenAt: now,
        lastSeenAt: now,
        count: 1,
      };

  photoEnhancerOriginalHashIndex.set(originalHash, entry);
  if (perceptualHash) photoEnhancerPerceptualHashIndex.set(perceptualHash, entry);
  capDuplicateIndex(photoEnhancerOriginalHashIndex);
  capDuplicateIndex(photoEnhancerPerceptualHashIndex);

  return {
    exactDuplicate: Boolean(exact),
    perceptualDuplicate: Boolean(perceptual && (!exact || perceptual.hash !== originalHash)),
    originalHashSeenCount: entry.count,
    exactMatch: exact
      ? {
          fileName: exact.fileName,
          firstSeenAt: exact.firstSeenAt,
          lastSeenAt: exact.lastSeenAt,
          count: exact.count,
        }
      : null,
    perceptualMatch: perceptual
      ? {
          fileName: perceptual.fileName,
          hash: perceptual.hash,
          distance: perceptual.distance,
          firstSeenAt: perceptual.firstSeenAt,
        }
      : null,
    index: {
      originalHashes: photoEnhancerOriginalHashIndex.size,
      perceptualHashes: photoEnhancerPerceptualHashIndex.size,
      retention: "process-memory",
    },
  };
}

function qualityStatus(score: number, warningThreshold: number, failThreshold: number) {
  if (score < failThreshold) return "fail";
  if (score < warningThreshold) return "warning";
  return "pass";
}

async function analyzeLumaQuality(file: Express.Multer.File) {
  try {
    const sharpModule = await import("sharp");
    const previewBuffer = await sharpModule
      .default(file.buffer, { failOn: "none" })
      .rotate()
      .resize({ width: 384, height: 384, fit: "inside", withoutEnlargement: true })
      .normalise()
      .gamma()
      .grayscale()
      .png()
      .toBuffer();
    const { data, info } = await sharpModule
      .default(previewBuffer, { failOn: "none" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const width = info.width;
    const height = info.height;
    const channels = Math.max(1, info.channels || 1);
    const total = Math.max(1, width * height);
    let lumaSum = 0;
    let blackClipped = 0;
    let whiteClipped = 0;
    let residualSum = 0;
    let residualCount = 0;
    const laplacianValues: number[] = [];

    for (let index = 0; index < data.length; index += channels) {
      const value = data[index] || 0;
      lumaSum += value;
      if (value <= 3) blackClipped += 1;
      if (value >= 252) whiteClipped += 1;
    }

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = (y * width + x) * channels;
        const center = data[index] || 0;
        const top = data[index - width * channels] || 0;
        const bottom = data[index + width * channels] || 0;
        const left = data[index - channels] || 0;
        const right = data[index + channels] || 0;
        const laplacian = top + bottom + left + right - 4 * center;
        laplacianValues.push(laplacian);
        const neighborMean = (top + bottom + left + right) / 4;
        residualSum += Math.abs(center - neighborMean);
        residualCount += 1;
      }
    }

    const laplacianMean =
      laplacianValues.reduce((sum, value) => sum + value, 0) / Math.max(1, laplacianValues.length);
    const blurVariance =
      laplacianValues.reduce((sum, value) => sum + (value - laplacianMean) ** 2, 0) /
      Math.max(1, laplacianValues.length);
    const blurScore = clampNumber((blurVariance / 900) * 100, 0, 100);
    const noiseResidual = residualSum / Math.max(1, residualCount);
    const noiseScore = clampNumber((noiseResidual / 18) * 100, 0, 100);
    const meanLuma = lumaSum / total;
    const whiteClippingPct = (whiteClipped / total) * 100;
    const blackClippingPct = (blackClipped / total) * 100;

    return {
      sample: { width, height, pixels: total },
      blur: {
        variance: Number(blurVariance.toFixed(2)),
        score: Math.round(blurScore),
        status: qualityStatus(blurScore, 35, 15),
      },
      noise: {
        residual: Number(noiseResidual.toFixed(2)),
        score: Math.round(noiseScore),
        status: noiseScore > 65 ? "warning" : "pass",
        method: "local-luma-residual",
      },
      exposure: {
        meanLuma: Math.round(meanLuma),
        status: meanLuma < 45 ? "underexposed" : meanLuma > 210 ? "overexposed" : "balanced",
      },
      clipping: {
        blackPct: Number(blackClippingPct.toFixed(3)),
        whitePct: Number(whiteClippingPct.toFixed(3)),
        status: blackClippingPct > 1 || whiteClippingPct > 1 ? "warning" : "pass",
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "quality_analysis_failed",
      blur: null,
      noise: null,
      exposure: null,
      clipping: null,
    };
  }
}

function analyzeCompressionQuality(file: Express.Multer.File, metadata: Record<string, unknown>) {
  const width = typeof metadata.width === "number" ? metadata.width : null;
  const height = typeof metadata.height === "number" ? metadata.height : null;
  const format = readString(metadata.format)?.toLowerCase() || "";
  const megapixels = width && height ? (width * height) / 1_000_000 : null;
  const bytesPerMegapixel = megapixels ? file.size / Math.max(0.01, megapixels) : null;

  if (!bytesPerMegapixel) {
    return {
      status: "unknown",
      bytesPerMegapixel: null,
      note: "Image dimensions unavailable.",
    };
  }

  const isLossy = format === "jpeg" || file.mimetype.toLowerCase().includes("jpeg");
  if (!isLossy) {
    return {
      status: "not-applicable",
      bytesPerMegapixel: Math.round(bytesPerMegapixel),
      note: "Compression score is only warning-based for lossy JPEG inputs.",
    };
  }

  const score = clampNumber((bytesPerMegapixel / 1_200_000) * 100, 0, 100);
  return {
    status: score < 25 ? "warning" : "pass",
    score: Math.round(score),
    bytesPerMegapixel: Math.round(bytesPerMegapixel),
    note: "Low bytes-per-megapixel can indicate aggressive JPEG compression.",
  };
}

async function faceApiRequiredFileStatus() {
  return Promise.all(
    photoEnhancerFaceApiRequiredFiles.map(async (name) => {
      try {
        await fs.access(path.join(photoEnhancerFaceApiModelsDir, name), fsConstants.R_OK);
        return { name, found: true };
      } catch {
        return { name, found: false };
      }
    }),
  );
}

function unavailableFaceApiStatus(reason: string, packageAvailable = false): PhotoEnhancerFaceApiStatus {
  return {
    available: false,
    packageAvailable,
    modelsLoaded: false,
    modelsDirectory: photoEnhancerFaceApiModelsDir,
    requiredFiles: photoEnhancerFaceApiRequiredFiles.map((name) => ({ name, found: false })),
    detectionModel: "tiny_face_detector",
    landmarkModel: "face_landmark_68_tiny",
    backend: null,
    loadedAt: null,
    reason,
  };
}

async function loadFaceApiRuntime(): Promise<PhotoEnhancerFaceApiRuntime> {
  if (photoEnhancerFaceApiRuntimePromise) return photoEnhancerFaceApiRuntimePromise;

  photoEnhancerFaceApiRuntimePromise = (async () => {
    const requiredFiles = await faceApiRequiredFileStatus();
    const missing = requiredFiles.filter((file) => !file.found).map((file) => file.name);
    if (missing.length > 0) {
      throw new Error(`Missing face-api.js model files: ${missing.join(", ")}`);
    }

    const [faceApi, canvas] = await Promise.all([
      import("face-api.js") as Promise<Record<string, any>>,
      import("canvas") as Promise<Record<string, any>>,
    ]);
    faceApi.env.monkeyPatch({
      Canvas: canvas.Canvas,
      Image: canvas.Image,
      ImageData: canvas.ImageData,
    });

    await Promise.all([
      faceApi.nets.tinyFaceDetector.loadFromDisk(photoEnhancerFaceApiModelsDir),
      faceApi.nets.faceLandmark68TinyNet.loadFromDisk(photoEnhancerFaceApiModelsDir),
    ]);

    if (process.env.PHOTO_ENHANCER_FACE_API_WARMUP !== "false") {
      const warmupCanvas = canvas.createCanvas(160, 160);
      const warmupOptions = new faceApi.TinyFaceDetectorOptions({
        inputSize: 160,
        scoreThreshold: 0.9,
      });
      try {
        await faceApi.detectAllFaces(warmupCanvas, warmupOptions);
      } catch {
        // Warmup only initializes tfjs/canvas kernels; detection failures should not disable runtime.
      }
    }

    const backend =
      typeof faceApi.tf?.getBackend === "function"
        ? String(faceApi.tf.getBackend())
        : null;

    return {
      faceApi,
      canvas,
      loadedAt: new Date().toISOString(),
      backend,
    };
  })();

  return photoEnhancerFaceApiRuntimePromise;
}

async function resolveFaceApiStatus(): Promise<PhotoEnhancerFaceApiStatus> {
  const requiredFiles = await faceApiRequiredFileStatus();
  try {
    const runtime = await loadFaceApiRuntime();
    const status: PhotoEnhancerFaceApiStatus = {
      available: true,
      packageAvailable: true,
      modelsLoaded: true,
      modelsDirectory: photoEnhancerFaceApiModelsDir,
      requiredFiles,
      detectionModel: "tiny_face_detector",
      landmarkModel: "face_landmark_68_tiny",
      backend: runtime.backend,
      loadedAt: runtime.loadedAt,
      reason: null,
    };
    photoEnhancerFaceApiLastStatus = status;
    return status;
  } catch (error) {
    const packageAvailable = await import("face-api.js")
      .then(() => true)
      .catch(() => false);
    const status: PhotoEnhancerFaceApiStatus = {
      ...unavailableFaceApiStatus(error instanceof Error ? error.message : "face_api_runtime_unavailable", packageAvailable),
      requiredFiles,
    };
    photoEnhancerFaceApiLastStatus = status;
    photoEnhancerFaceApiRuntimePromise = null;
    return status;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function runFaceApiExclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = photoEnhancerFaceApiQueue.then(task, task);
  photoEnhancerFaceApiQueue = run.catch(() => undefined);
  return run;
}

function computeLaplacianVariance(values: Buffer | Uint8Array, width: number, height: number): number | null {
  if (width < 3 || height < 3 || values.length < width * height) return null;
  let count = 0;
  let sum = 0;
  let sumSquares = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const laplacian =
        values[idx - width] +
        values[idx - 1] -
        values[idx] * 4 +
        values[idx + 1] +
        values[idx + width];
      sum += laplacian;
      sumSquares += laplacian * laplacian;
      count += 1;
    }
  }

  if (count === 0) return null;
  const mean = sum / count;
  return sumSquares / count - mean * mean;
}

function cropAroundPoints(
  points: Array<{ x: number; y: number }>,
  imageWidth: number,
  imageHeight: number,
) {
  if (points.length === 0 || imageWidth < 8 || imageHeight < 8) return null;
  const xs = points.map((point) => point.x).filter(Number.isFinite);
  const ys = points.map((point) => point.y).filter(Number.isFinite);
  if (xs.length === 0 || ys.length === 0) return null;

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const eyeWidth = Math.max(8, maxX - minX);
  const eyeHeight = Math.max(8, maxY - minY);
  const padding = Math.max(6, Math.round(Math.max(eyeWidth, eyeHeight) * 0.75));
  const left = Math.max(0, Math.floor(minX - padding));
  const top = Math.max(0, Math.floor(minY - padding));
  const right = Math.min(imageWidth, Math.ceil(maxX + padding));
  const bottom = Math.min(imageHeight, Math.ceil(maxY + padding));
  const width = right - left;
  const height = bottom - top;
  if (width < 8 || height < 8) return null;
  return { left, top, width, height };
}

async function computeEyeSharpness(faceInput: {
  buffer: Buffer;
  width: number;
  height: number;
}, detections: Array<Record<string, any>>) {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;
  const perEye: Array<{
    faceIndex: number;
    eye: "left" | "right";
    variance: number;
    score: number;
    status: string;
  }> = [];

  for (const [faceIndex, detection] of detections.entries()) {
    const landmarks = detection.landmarks;
    const eyes = [
      { eye: "left" as const, points: landmarks?.getLeftEye?.() || [] },
      { eye: "right" as const, points: landmarks?.getRightEye?.() || [] },
    ];

    for (const item of eyes) {
      const crop = cropAroundPoints(item.points, faceInput.width, faceInput.height);
      if (!crop) continue;
      try {
        const result = await sharp(faceInput.buffer, { failOn: "none" })
          .extract(crop)
          .greyscale()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const variance = computeLaplacianVariance(result.data, result.info.width, result.info.height);
        if (variance === null) continue;
        const score = clampNumber((variance / 500) * 100, 0, 100);
        perEye.push({
          faceIndex,
          eye: item.eye,
          variance: Number(variance.toFixed(2)),
          score: Math.round(score),
          status: qualityStatus(score, 35, 15),
        });
      } catch {
        // Eye sharpness is best-effort; face detection remains useful if a single crop fails.
      }
    }
  }

  if (perEye.length === 0) {
    return {
      status: detections.length > 0 ? "unknown" : "not-applicable",
      score: null,
      averageVariance: null,
      eyesAnalyzed: 0,
      facesWithEyes: 0,
      reason: detections.length > 0 ? "Face landmarks were detected, but eye crops could not be analyzed." : "No faces detected.",
      perEye: [],
    };
  }

  const averageScore = perEye.reduce((sum, eye) => sum + eye.score, 0) / perEye.length;
  const averageVariance = perEye.reduce((sum, eye) => sum + eye.variance, 0) / perEye.length;
  const facesWithEyes = new Set(perEye.map((eye) => eye.faceIndex)).size;

  return {
    status: qualityStatus(averageScore, 35, 15),
    score: Math.round(averageScore),
    averageVariance: Number(averageVariance.toFixed(2)),
    eyesAnalyzed: perEye.length,
    facesWithEyes,
    reason: null,
    perEye,
  };
}

async function prepareFaceApiInput(file: Express.Multer.File) {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;
  const result = await sharp(file.buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: PHOTO_ENHANCER_FACE_API_MAX_DIMENSION,
      height: PHOTO_ENHANCER_FACE_API_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

async function analyzeFaceQuality(
  file: Express.Multer.File,
  faceApiStatus: PhotoEnhancerFaceApiStatus,
) {
  const startedAt = Date.now();
  if (!faceApiStatus.available) {
    return {
      available: false,
      packageAvailable: faceApiStatus.packageAvailable,
      modelsLoaded: faceApiStatus.modelsLoaded,
      faceCount: null,
      eyeSharpness: null,
      reason: faceApiStatus.reason || "face-api.js runtime is unavailable.",
      runtime: faceApiStatus,
    };
  }

  try {
    return await withTimeout(
      runFaceApiExclusive(async () => {
        const runtime = await loadFaceApiRuntime();
        const faceInput = await prepareFaceApiInput(file);
        const image = await runtime.canvas.loadImage(faceInput.buffer);
        const options = new runtime.faceApi.TinyFaceDetectorOptions({
          inputSize: PHOTO_ENHANCER_FACE_API_INPUT_SIZE,
          scoreThreshold: PHOTO_ENHANCER_FACE_API_SCORE_THRESHOLD,
        });
        const detections = await runtime.faceApi
          .detectAllFaces(image, options)
          .withFaceLandmarks(true);
        const eyeSharpness = await computeEyeSharpness(faceInput, detections);
        const faces = detections.map((detection: Record<string, any>, index: number) => {
          const box = detection.detection?.box;
          return {
            index,
            score:
              typeof detection.detection?.score === "number"
                ? Number(detection.detection.score.toFixed(4))
                : null,
            box: box
              ? {
                  x: Math.round(box.x),
                  y: Math.round(box.y),
                  width: Math.round(box.width),
                  height: Math.round(box.height),
                }
              : null,
          };
        });

        return {
          available: true,
          packageAvailable: true,
          modelsLoaded: true,
          faceCount: detections.length,
          eyeSharpness,
          reason: null,
          detectionModel: faceApiStatus.detectionModel,
          landmarkModel: faceApiStatus.landmarkModel,
          image: {
            width: faceInput.width,
            height: faceInput.height,
            maxDimension: PHOTO_ENHANCER_FACE_API_MAX_DIMENSION,
          },
          faces,
          processingMs: Date.now() - startedAt,
          runtime: faceApiStatus,
        };
      }),
      PHOTO_ENHANCER_FACE_API_TIMEOUT_MS,
      "face-api.js analysis",
    );
  } catch (error) {
    return {
      available: false,
      packageAvailable: faceApiStatus.packageAvailable,
      modelsLoaded: faceApiStatus.modelsLoaded,
      faceCount: null,
      eyeSharpness: null,
      reason: error instanceof Error ? error.message : "face_api_analysis_failed",
      detectionModel: faceApiStatus.detectionModel,
      landmarkModel: faceApiStatus.landmarkModel,
      processingMs: Date.now() - startedAt,
      runtime: faceApiStatus,
    };
  }
}

async function canExecute(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function commandPath(...binaries: string[]): Promise<string | null> {
  for (const binary of binaries) {
    if (binary.includes("/")) {
      if (await canExecute(binary)) return binary;
      continue;
    }

    for (const directory of photoEnhancerBinarySearchDirs) {
      const candidate = path.join(directory, binary);
      if (await canExecute(candidate)) return candidate;
    }

    try {
      const { stdout } = await execFileAsync("which", [binary], { timeout: 2_000 });
      const resolved = String(stdout || "").trim().split("\n")[0];
      if (resolved) return resolved;
    } catch {
      // Try next binary alias.
    }
  }
  return null;
}

async function execFileToFile(
  binary: string,
  args: string[],
  outputPath: string,
  options: { cwd: string; timeout: number },
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = createWriteStream(outputPath);
    let stderr = "";
    let settled = false;
    let childClosed = false;
    let childExitCode: number | null = null;
    let outputFinished = false;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      settle(new Error(`Command timed out after ${options.timeout}ms`));
    }, options.timeout);

    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) output.destroy();
      if (error) reject(error);
      else resolve();
    };

    const maybeFinish = () => {
      if (!childClosed || !outputFinished) return;
      if (childExitCode === 0) settle();
      else settle(new Error(stderr || `Command exited with code ${childExitCode}`));
    };

    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk).slice(0, 4096);
    });
    child.stdout?.pipe(output);
    child.on("error", settle);
    output.on("error", settle);
    output.on("finish", () => {
      outputFinished = true;
      maybeFinish();
    });
    child.on("close", (code) => {
      childClosed = true;
      childExitCode = code;
      maybeFinish();
    });
  });
}

async function execRawConverter(
  binary: string,
  args: string[],
  options: { cwd: string; timeout: number; maxBuffer?: number },
) {
  const memoryMb = Number(process.env.PHOTO_ENHANCER_RAW_CHILD_MAX_MEMORY_MB || 0);
  if (memoryMb > 0 && process.platform !== "win32") {
    const memoryKb = Math.max(64, Math.floor(memoryMb)) * 1024;
    return execFileAsync(
      "bash",
      ["-lc", `ulimit -v ${memoryKb}; exec "$0" "$@"`, binary, ...args],
      options,
    );
  }

  return execFileAsync(binary, args, options);
}

async function resolveRuntimeSupport() {
  const [imageMagick, darktable, rawtherapee, dcraw, dcrawEmu, simpleDcraw, heifConvert, exiftool, lensfunUpdate] = await Promise.all([
    commandPath("magick", "convert"),
    commandPath("darktable-cli"),
    commandPath("rawtherapee-cli"),
    commandPath("dcraw"),
    commandPath("dcraw_emu"),
    commandPath("simple_dcraw"),
    commandPath("heif-convert"),
    commandPath("exiftool"),
    commandPath("lensfun-update-data"),
  ]);

  return {
    raw: {
      supportedExtensions: PHOTO_ENHANCER_RAW_FORMATS,
      rasterExtensions: PHOTO_ENHANCER_RASTER_FORMATS,
      converters: {
        imageMagick: Boolean(imageMagick),
        darktable: Boolean(darktable),
        rawtherapee: Boolean(rawtherapee),
        dcraw: Boolean(dcraw),
        dcrawEmu: Boolean(dcrawEmu),
        simpleDcraw: Boolean(simpleDcraw),
        heifConvert: Boolean(heifConvert),
      },
      // Optical lens correction readiness. RawTherapee has Lensfun compiled
      // in, so its presence is enough to run LcMode=lfauto; the system
      // Lensfun database (lensfun-update-data from liblensfun-bin) just
      // widens lens coverage beyond RawTherapee's bundled data.
      lensCorrection: {
        // Only "available" when the heavy RawTherapee+Lensfun pass is
        // opted in (PHOTO_ENHANCER_LENSFUN_ENABLED=true) AND rawtherapee is
        // installed — otherwise enabling it in the UI is a safe no-op.
        available: Boolean(rawtherapee) && process.env.PHOTO_ENHANCER_LENSFUN_ENABLED === "true",
        enabledByConfig: process.env.PHOTO_ENHANCER_LENSFUN_ENABLED === "true",
        converter: rawtherapee ? "rawtherapee" : null,
        systemLensfunDatabase: Boolean(lensfunUpdate),
      },
      available: Boolean(imageMagick || darktable || rawtherapee || dcraw || dcrawEmu || simpleDcraw),
      heic: {
        available: Boolean(heifConvert || imageMagick),
        converters: {
          heifConvert: Boolean(heifConvert),
          imageMagick: Boolean(imageMagick),
        },
      },
    },
    metadata: {
      exiftool: Boolean(exiftool),
    },
  };
}

async function readExifMetadataFromPath(inputPath: string): Promise<Record<string, unknown> | null> {
  const exiftool = await commandPath("exiftool");
  if (!exiftool) return null;

  try {
    const { stdout } = await execFileAsync(
      exiftool,
      [
        "-json",
        "-Make",
        "-Model",
        "-CameraModelName",
        "-Lens",
        "-LensModel",
        "-LensID",
        "-LensInfo",
        "-LensSerialNumber",
        "-SerialNumber",
        "-BodySerialNumber",
        "-FocalLength",
        "-FocalLengthIn35mmFormat",
        "-ISO",
        "-ExposureTime",
        "-FNumber",
        "-ApertureValue",
        "-ShutterSpeedValue",
        "-ExposureCompensation",
        "-ExposureProgram",
        "-MeteringMode",
        "-Flash",
        "-WhiteBalance",
        "-ColorSpace",
        "-ProfileDescription",
        "-BitsPerSample",
        "-ColorComponents",
        "-Orientation",
        "-ImageWidth",
        "-ImageHeight",
        "-Copyright",
        "-Artist",
        "-Creator",
        "-Credit",
        "-By-line",
        "-OwnerName",
        "-Title",
        "-Description",
        "-Caption-Abstract",
        "-UsageTerms",
        "-FileType",
        "-MIMEType",
        inputPath,
      ],
      {
        timeout: 15_000,
        maxBuffer: 2 * 1024 * 1024,
        env: {
          ...process.env,
          LC_ALL: "C",
          LC_CTYPE: "C",
          LANG: "C",
        },
      },
    );
    const parsed = JSON.parse(String(stdout || "[]"));
    return Array.isArray(parsed) && parsed[0] ? parsed[0] : null;
  } catch {
    return null;
  }
}

async function readExifMetadata(file: Express.Multer.File): Promise<Record<string, unknown> | null> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "creatorhub-photo-exif-"));
  const inputPath = path.join(tempDir, `source${getUploadExtension(file) || ".img"}`);
  try {
    await fs.writeFile(inputPath, file.buffer);
    return await readExifMetadataFromPath(inputPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function extractEmbeddedPreviewImageFromPath(
  file: Pick<Express.Multer.File, "originalname" | "mimetype" | "size">,
  inputPath: string,
): Promise<Express.Multer.File | null> {
  if (!isCameraRawFile(file)) return null;
  const exiftool = await commandPath("exiftool");
  if (!exiftool) return null;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "creatorhub-photo-preview-"));
  const outputPath = path.join(tempDir, "preview.jpg");
  try {
    for (const tag of ["-PreviewImage", "-JpgFromRaw", "-ThumbnailImage"]) {
      await execFileAsync(exiftool, ["-b", tag, inputPath], {
        timeout: 15_000,
        maxBuffer: 20 * 1024 * 1024,
        encoding: "buffer",
        env: {
          ...process.env,
          LC_ALL: "C",
          LC_CTYPE: "C",
          LANG: "C",
        },
      })
        .then(async ({ stdout }) => {
          const buffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
          if (buffer.byteLength > 1024) await fs.writeFile(outputPath, buffer);
        })
        .catch(() => undefined);
      const buffer = await fs.readFile(outputPath).catch(() => null);
      if (buffer && buffer.byteLength > 1024) {
        return makeMulterMemoryFile({
          ...file,
          buffer,
          size: buffer.byteLength,
          originalname: `${path.basename(file.originalname, path.extname(file.originalname))}-preview.jpg`,
          mimetype: "image/jpeg",
        });
      }
    }
    return null;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function extractEmbeddedPreviewImage(file: Express.Multer.File): Promise<Express.Multer.File | null> {
  if (!isCameraRawFile(file)) return null;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "creatorhub-photo-preview-source-"));
  const inputPath = path.join(tempDir, `source${getUploadExtension(file) || ".raw"}`);
  try {
    await fs.writeFile(inputPath, file.buffer);
    return await extractEmbeddedPreviewImageFromPath(file, inputPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

// RawTherapee processing profile (.pp3) that enables Lensfun automatic lens
// correction from the file's EXIF. Lensfun corrections are per-type on/off
// (no partial strength), so we map the photographer's request to which
// correction types to enable. Requires rawtherapee-cli + a Lensfun database
// on the runner box; if absent we simply fall through to a plain conversion.
function buildRawTherapeeLensfunPp3(lens: LensCorrection): string {
  const useDistortion = lens.auto || lens.distortion > 0;
  const useVignette = lens.auto || lens.vignette > 0;
  const useCA = lens.chromaticAberration > 0;
  return [
    "[Version]",
    "AppVersion=5.9",
    "Version=346",
    "",
    "[Lens Profile]",
    "LcMode=lfauto",
    "LCPFile=",
    `UseDistortion=${useDistortion ? "true" : "false"}`,
    `UseVignette=${useVignette ? "true" : "false"}`,
    `UseCA=${useCA ? "true" : "false"}`,
    "",
  ].join("\n");
}

async function convertRawWithExternalTool(
  file: Express.Multer.File,
  options?: { lensCorrection?: LensCorrection },
): Promise<{
  file: Express.Multer.File;
  conversion: Record<string, unknown>;
} | null> {
  if (!isCameraRawFile(file)) return null;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "creatorhub-photo-raw-"));
  const extension = getUploadExtension(file) || ".raw";
  const inputPath = path.join(tempDir, `source${extension}`);
  const outputPath = path.join(tempDir, "converted.png");
  const outputTiffPath = path.join(tempDir, "source.tiff");
  const lensfunPp3Path = path.join(tempDir, "lensfun.pp3");
  await fs.writeFile(inputPath, file.buffer);

  // When the photographer enabled lens correction, write a Lensfun PP3 so we
  // can prefer a RawTherapee pass that applies optical correction. dcraw /
  // ImageMagick can't do Lensfun, so this only fires when correction is on.
  // Full-resolution RawTherapee + Lensfun needs ~1-2 GB RAM. On a small
  // instance that OOM-kills the process and 502s the whole request, so the
  // heavy pass is gated behind an explicit opt-in env (default off) — only
  // turn it on where the box can afford it (≥ ~2 GB). Without it, enhance
  // proceeds through the normal converters (no correction) instead of
  // crashing.
  const lensfunRuntimeEnabled = process.env.PHOTO_ENHANCER_LENSFUN_ENABLED === "true";
  const lens = options?.lensCorrection;
  const lensfunEnabled = Boolean(lens?.enabled) && lensfunRuntimeEnabled;
  if (lensfunEnabled && lens) {
    await fs.writeFile(lensfunPp3Path, buildRawTherapeeLensfunPp3(lens));
  }

  const attempts: Array<{
    id: string;
    binaries: string[];
    args: string[];
    outputPath: string;
    outputMimeType: string;
    streamStdout?: boolean;
    resolutionMode: "full" | "half" | "converter-default";
  }> = [
    {
      id: "dcraw",
      binaries: ["dcraw", "dcraw_emu"],
      args: ["-w", "-T", inputPath],
      outputPath: outputTiffPath,
      outputMimeType: "image/tiff",
      resolutionMode: "full",
    },
    {
      id: "dcraw-half",
      binaries: ["dcraw", "dcraw_emu"],
      args: ["-w", "-h", "-T", inputPath],
      outputPath: outputTiffPath,
      outputMimeType: "image/tiff",
      resolutionMode: "half",
    },
    {
      id: "imagemagick",
      binaries: ["magick", "convert"],
      args: [inputPath, "-auto-orient", "-colorspace", "sRGB", outputPath],
      outputPath,
      outputMimeType: "image/png",
      resolutionMode: "converter-default",
    },
    {
      id: "rawtherapee",
      binaries: ["rawtherapee-cli"],
      // -n (PNG output) + -Y (overwrite) are required, else rawtherapee-cli
      // writes a differently-named/format file and our outputPath stays
      // empty ("no output"). -c must remain last.
      args: ["-o", outputPath, "-n", "-Y", "-c", inputPath],
      outputPath,
      outputMimeType: "image/png",
      resolutionMode: "converter-default",
    },
    {
      id: "darktable",
      binaries: ["darktable-cli"],
      args: [inputPath, outputPath],
      outputPath,
      outputMimeType: "image/png",
      resolutionMode: "converter-default",
    },
  ];

  // Prefer a RawTherapee pass with Lensfun lens correction when requested.
  // If rawtherapee-cli is missing, commandPath() returns null below and we
  // fall through to the normal converters (without correction).
  if (lensfunEnabled) {
    attempts.unshift({
      id: "rawtherapee-lensfun",
      binaries: ["rawtherapee-cli"],
      // -n (PNG) + -Y (overwrite); -c last. Without -n, rawtherapee-cli
      // produced no file at outputPath ("no output") and lens correction
      // silently fell back to dcraw.
      args: ["-o", outputPath, "-p", lensfunPp3Path, "-n", "-Y", "-c", inputPath],
      outputPath,
      outputMimeType: "image/png",
      resolutionMode: "converter-default",
    });
  }

  const configuredOrder = (process.env.PHOTO_ENHANCER_RAW_CONVERTER_ORDER || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const orderedAttempts =
    configuredOrder.length > 0
      ? [
          ...configuredOrder
            .map((id) => attempts.find((attempt) => attempt.id === id))
            .filter((attempt): attempt is (typeof attempts)[number] => Boolean(attempt)),
          ...attempts.filter((attempt) => !configuredOrder.includes(attempt.id)),
        ]
      : attempts;

  const errors: string[] = [];
  try {
    for (const attempt of orderedAttempts) {
      const resolved = await commandPath(...attempt.binaries);
      if (!resolved) continue;
      try {
        await fs.rm(attempt.outputPath, { force: true }).catch(() => undefined);
        const timeout = Number(process.env.PHOTO_ENHANCER_RAW_TIMEOUT_MS || 60_000);
        if (attempt.streamStdout) {
          await execFileToFile(resolved, attempt.args, attempt.outputPath, {
            cwd: tempDir,
            timeout,
          });
        } else {
          await execRawConverter(resolved, attempt.args, {
            cwd: tempDir,
            timeout,
            maxBuffer: 10 * 1024 * 1024,
          });
        }
        if (!existsSync(attempt.outputPath)) {
          errors.push(`${attempt.id}: no output`);
          continue;
        }
        const buffer = await fs.readFile(attempt.outputPath);
        try {
          const sharpModule = await import("sharp");
          const metadata = await sharpModule.default(buffer, { failOn: "none" }).metadata();
          if (!metadata.width || !metadata.height) {
            throw new Error("converted image has no dimensions");
          }
          // Surface (and log) the failures of any converter attempts that were
          // tried and fell through before this one succeeded — otherwise a
          // failing rawtherapee-lensfun pass is invisible because dcraw then
          // succeeds and swallows it.
          if (errors.length) {
            console.warn(
              `[photo-enhancer] raw-convert: "${attempt.id}" succeeded after earlier failures → ${errors.join(" | ")}`,
            );
          }
          return {
            file: {
              ...file,
              buffer,
              size: buffer.byteLength,
              mimetype: attempt.outputMimeType,
              originalname: file.originalname.replace(
                /\.[^.]+$/u,
                attempt.outputMimeType === "image/png" ? ".png" : ".tiff",
              ),
            },
            conversion: {
              raw: true,
              sourceExtension: extension,
              converter: attempt.id,
              outputMimeType: attempt.outputMimeType,
              width: metadata.width ?? null,
              height: metadata.height ?? null,
              format: metadata.format ?? null,
              resolutionMode: attempt.resolutionMode,
              lensCorrectionApplied: attempt.id === "rawtherapee-lensfun",
              attemptErrors: errors.length ? [...errors] : undefined,
            },
          };
        } catch (validationError) {
          errors.push(
            `${attempt.id}: unreadable output (${validationError instanceof Error ? validationError.message : String(validationError)})`,
          );
          continue;
        }
      } catch (error) {
        errors.push(`${attempt.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      file,
      conversion: {
        raw: true,
        sourceExtension: extension,
        converter: null,
        error: errors.join(" | ") || "No RAW converter available",
      },
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function convertHeicWithExternalTool(file: Express.Multer.File): Promise<{
  file: Express.Multer.File;
  conversion: Record<string, unknown>;
} | null> {
  if (!isHeicFile(file)) return null;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "creatorhub-photo-heic-"));
  const extension = getUploadExtension(file) || ".heic";
  const inputPath = path.join(tempDir, `source${extension}`);
  const outputPath = path.join(tempDir, "converted.jpg");
  await fs.writeFile(inputPath, file.buffer);

  const attempts: Array<{
    id: string;
    binaries: string[];
    args: string[];
  }> = [
    {
      id: "heif-convert",
      binaries: ["heif-convert"],
      args: [inputPath, outputPath],
    },
    {
      id: "imagemagick",
      binaries: ["magick", "convert"],
      args: [inputPath, "-auto-orient", "-colorspace", "sRGB", outputPath],
    },
  ];

  const errors: string[] = [];
  try {
    for (const attempt of attempts) {
      const resolved = await commandPath(...attempt.binaries);
      if (!resolved) continue;
      try {
        await execRawConverter(resolved, attempt.args, {
          cwd: tempDir,
          timeout: Number(process.env.PHOTO_ENHANCER_HEIC_TIMEOUT_MS || 30_000),
          maxBuffer: 10 * 1024 * 1024,
        });
        if (!existsSync(outputPath)) {
          errors.push(`${attempt.id}: no output`);
          continue;
        }
        const buffer = await fs.readFile(outputPath);
        const sharpModule = await import("sharp");
        const metadata = await sharpModule.default(buffer, { failOn: "none" }).metadata();
        if (!metadata.width || !metadata.height) {
          errors.push(`${attempt.id}: converted image has no dimensions`);
          continue;
        }
        return {
          file: {
            ...file,
            buffer,
            size: buffer.byteLength,
            mimetype: "image/jpeg",
            originalname: file.originalname.replace(/\.[^.]+$/u, ".jpg"),
          },
          conversion: {
            raw: false,
            heic: true,
            sourceExtension: extension,
            converter: attempt.id,
            outputMimeType: "image/jpeg",
          },
        };
      } catch (error) {
        errors.push(`${attempt.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      file,
      conversion: {
        raw: false,
        heic: true,
        sourceExtension: extension,
        converter: null,
        error: errors.join(" | ") || "No HEIC converter available",
      },
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function prepareProcessableImage(
  file: Express.Multer.File,
  options?: { lensCorrection?: LensCorrection },
): Promise<{
  file: Express.Multer.File;
  raw: Record<string, unknown>;
}> {
  if (isHeicFile(file)) {
    const converted = await convertHeicWithExternalTool(file);
    if (!converted || converted.file === file) {
      return {
        file,
        raw: converted?.conversion || {
          raw: false,
          heic: true,
          sourceExtension: getUploadExtension(file),
          converter: null,
          error: "No HEIC converter available",
        },
      };
    }

    return {
      file: converted.file,
      raw: converted.conversion,
    };
  }

  if (!isCameraRawFile(file)) {
    return {
      file,
      raw: {
        raw: false,
        sourceExtension: getUploadExtension(file),
      },
    };
  }

  const converted = await convertRawWithExternalTool(file, options);
  if (!converted || converted.file === file) {
    const conversion = converted?.conversion || {
      raw: true,
      sourceExtension: getUploadExtension(file),
      converter: null,
      error: "No RAW converter available",
    };
    recordRawFormatVerification({
      extension: String(conversion.sourceExtension || getUploadExtension(file) || ""),
      status: "failed",
      converter: null,
      verifiedAt: new Date().toISOString(),
      source: "upload",
      outputMimeType: null,
      width: null,
      height: null,
      resolutionMode: null,
      error: typeof conversion.error === "string" ? conversion.error : "No RAW converter available",
    });
    return {
      file,
      raw: conversion,
    };
  }

  recordRawFormatVerification({
    extension: String(converted.conversion.sourceExtension || getUploadExtension(file) || ""),
    status: "verified",
    converter: typeof converted.conversion.converter === "string" ? converted.conversion.converter : null,
    verifiedAt: new Date().toISOString(),
    source: "upload",
    outputMimeType:
      typeof converted.conversion.outputMimeType === "string" ? converted.conversion.outputMimeType : converted.file.mimetype,
    width: typeof converted.conversion.width === "number" ? converted.conversion.width : null,
    height: typeof converted.conversion.height === "number" ? converted.conversion.height : null,
    resolutionMode:
      typeof converted.conversion.resolutionMode === "string" ? converted.conversion.resolutionMode : null,
    error: null,
  });

  return {
    file: converted.file,
    raw: converted.conversion,
  };
}

async function buildPhotoEnhancerAnalysisPayload(params: {
  file: Express.Multer.File;
  preset: string;
  body?: Record<string, unknown>;
  source?: Record<string, unknown> | null;
}) {
  const prepared = await prepareProcessableImage(params.file);
  if (hasUnavailableSourceConversion(prepared.raw)) {
    return {
      ok: false as const,
      status: 422,
      error: conversionErrorCode(prepared.raw),
      raw: prepared.raw,
      rawSupport: await resolveRuntimeSupport(),
      prepared,
    };
  }

  const processFile = prepared.file;
  const embeddedPreviewFile = await extractEmbeddedPreviewImage(params.file);
  const analysisFile = embeddedPreviewFile || processFile;
  const analysisSource = embeddedPreviewFile ? "embedded-preview" : "processed-image";
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;
  const originalHash = computeOriginalFileHash(params.file);
  const [metadata, analysisMetadata, stats, perceptualHash, gfpgan, faceApiStatus, exif, lumaQuality] =
    await Promise.all([
      sharp(processFile.buffer, { failOn: "none" }).metadata(),
      sharp(analysisFile.buffer, { failOn: "none" }).metadata(),
      sharp(analysisFile.buffer, { failOn: "none" }).stats().catch(() => null),
      computeImageHash(analysisFile),
      resolveGfpganModelStatus(),
      resolveFaceApiStatus(),
      readExifMetadata(params.file),
      analyzeLumaQuality(analysisFile),
    ]);
  const faceQuality = await analyzeFaceQuality(analysisFile, faceApiStatus);
  const normalizedExif = normalizePhotoEnhancerExif(exif);
  const sidecar = parsePhotoEnhancerXmpSidecar(
    readString(params.body?.xmpSidecar) || readString(params.body?.sidecarXmp) || readString(params.body?.xmp),
  );
  const clientName = readString(params.body?.clientName) || sidecar.clientName || normalizedExif.credit;
  const cameraProfile = matchPhotoEnhancerCameraProfile(normalizedExif.make, normalizedExif.model);
  const lensProfile = matchPhotoEnhancerLensProfile(normalizedExif.lensModel, cameraProfile?.mount);
  const duplicateDetection = detectAndRecordDuplicate(params.file, originalHash, perceptualHash);
  const compression = analyzeCompressionQuality(analysisFile, analysisMetadata as unknown as Record<string, unknown>);
  const hasEmbeddedProfile = Boolean((metadata as { hasProfile?: boolean }).hasProfile || normalizedExif.iccProfile);

  const meanBrightness = stats
    ? (() => {
        const channels = (stats as PhotoEnhancerSharpStats).channels || [];
        const totalMean = channels.reduce((sum, channel) => sum + (channel.mean || 0), 0);
        return Math.round(totalMean / Math.max(1, channels.length));
      })()
    : null;

  return {
    ok: true as const,
    prepared,
    processFile,
    payload: {
      success: true,
      preset: params.preset,
      analysis: {
        fileName: params.file.originalname,
        mimeType: params.file.mimetype,
        size: params.file.size,
        processedMimeType: processFile.mimetype,
        analysisSource,
        analysisMimeType: analysisFile.mimetype,
        source: params.source || undefined,
        width: metadata.width || null,
        height: metadata.height || null,
        analysisWidth: analysisMetadata.width || null,
        analysisHeight: analysisMetadata.height || null,
        format: metadata.format || null,
        hasAlpha: Boolean(metadata.hasAlpha),
        orientation: metadata.orientation || null,
        meanBrightness,
        dominantColor: stats?.dominant || null,
        fileHash: {
          algorithm: "sha256",
          value: originalHash,
        },
        perceptualHash,
        duplicateDetection,
        quality: {
          blur: lumaQuality.blur,
          face: faceQuality,
          eyeSharpness: faceQuality.eyeSharpness,
          exposure: lumaQuality.exposure,
          clipping: lumaQuality.clipping,
          noise: lumaQuality.noise,
          compression,
        },
        raw: prepared.raw,
        metadata: {
          exifNormalized: normalizedExif,
          iptc: {
            copyright: normalizedExif.copyright,
            creator: normalizedExif.creator || normalizedExif.artist,
            credit: normalizedExif.credit,
            title: normalizedExif.title,
            description: normalizedExif.description,
          },
          sidecar,
          copyright: {
            value: sidecar.rights || normalizedExif.copyright,
            creator: sidecar.creators[0] || normalizedExif.creator || normalizedExif.artist,
            usageTerms: sidecar.usageTerms || normalizedExif.usageTerms,
          },
          clientName,
          lensProfile,
          cameraProfile,
          whiteBalancePolicy: {
            source: normalizedExif.whiteBalance ? "exif" : "missing",
            value: normalizedExif.whiteBalance,
            action: normalizedExif.whiteBalance ? "preserve-camera-white-balance-as-baseline" : "require-manual-or-auto-neutral-baseline",
          },
          colorProfilePolicy: {
            embeddedProfile: hasEmbeddedProfile,
            inputColorSpace: normalizedExif.colorSpace || readString((metadata as { space?: string }).space),
            iccProfile: normalizedExif.iccProfile,
            action: hasEmbeddedProfile ? "preserve-embedded-icc-through-export" : "convert-export-to-srgb-and-mark-missing-input-profile",
          },
          iccPreserved: hasEmbeddedProfile,
        },
        exif,
      },
      models: {
        gfpgan,
        faceApi: {
          id: "face-api.js",
          available: faceApiStatus.available,
          modelsLoaded: faceApiStatus.modelsLoaded,
          reason: faceApiStatus.reason,
        },
        imageHash: {
          id: "image-hash",
          available: Boolean(perceptualHash),
        },
        profiles: {
          lensMatched: Boolean(lensProfile),
          cameraMatched: Boolean(cameraProfile),
        },
      },
      recommendations: [
        gfpgan.available
          ? "GFPGAN face restoration model is available from R2."
          : "GFPGAN is not available; Photo Enhancer will use safe Sharp fallback.",
        perceptualHash
          ? "Perceptual hash generated for duplicate detection."
          : "Perceptual hash could not be generated for this image type.",
        lensProfile
          ? `Lens profile matched: ${lensProfile.name}.`
          : "No lens profile matched; preserve original EXIF and warn before applying lens correction.",
        hasEmbeddedProfile
          ? "Embedded color profile detected and marked for preservation."
          : "No embedded ICC profile detected; export should normalize to sRGB.",
      ],
    },
  };
}

async function buildPhotoEnhancerPreviewOnlyAnalysisPayload(params: {
  sourceFile: Pick<Express.Multer.File, "originalname" | "mimetype" | "size">;
  inputPath: string;
  originalHash: string;
  preset: string;
  body?: Record<string, unknown>;
  source?: Record<string, unknown> | null;
}) {
  const previewFile = await extractEmbeddedPreviewImageFromPath(params.sourceFile, params.inputPath);
  if (!previewFile) {
    return {
      ok: false as const,
      status: 413,
      error: "photo_enhancer_large_sync_analysis_requires_embedded_preview",
      reason: "The source file is too large for in-memory synchronous analysis and no embedded RAW preview was available.",
    };
  }

  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;
  const [previewMetadata, stats, perceptualHash, gfpgan, faceApiStatus, exif, lumaQuality] = await Promise.all([
    sharp(previewFile.buffer, { failOn: "none" }).metadata(),
    sharp(previewFile.buffer, { failOn: "none" }).stats().catch(() => null),
    computeImageHash(previewFile),
    resolveGfpganModelStatus(),
    resolveFaceApiStatus(),
    readExifMetadataFromPath(params.inputPath),
    analyzeLumaQuality(previewFile),
  ]);
  const faceQuality = await analyzeFaceQuality(previewFile, faceApiStatus);
  const normalizedExif = normalizePhotoEnhancerExif(exif);
  const sidecar = parsePhotoEnhancerXmpSidecar(
    readString(params.body?.xmpSidecar) || readString(params.body?.sidecarXmp) || readString(params.body?.xmp),
  );
  const clientName = readString(params.body?.clientName) || sidecar.clientName || normalizedExif.credit;
  const cameraProfile = matchPhotoEnhancerCameraProfile(normalizedExif.make, normalizedExif.model);
  const lensProfile = matchPhotoEnhancerLensProfile(normalizedExif.lensModel, cameraProfile?.mount);
  const originalFileForDuplicate = makeMulterMemoryFile({
    originalname: params.sourceFile.originalname,
    mimetype: params.sourceFile.mimetype,
    size: params.sourceFile.size,
    buffer: Buffer.alloc(0),
  });
  const duplicateDetection = detectAndRecordDuplicate(originalFileForDuplicate, params.originalHash, perceptualHash);
  const compression = analyzeCompressionQuality(previewFile, previewMetadata as unknown as Record<string, unknown>);
  const hasEmbeddedProfile = Boolean(normalizedExif.iccProfile);
  const originalWidth =
    readNumber((exif as Record<string, unknown> | null)?.ImageWidth) ||
    readNumber((exif as Record<string, unknown> | null)?.ExifImageWidth) ||
    previewMetadata.width ||
    null;
  const originalHeight =
    readNumber((exif as Record<string, unknown> | null)?.ImageHeight) ||
    readNumber((exif as Record<string, unknown> | null)?.ExifImageHeight) ||
    previewMetadata.height ||
    null;
  const meanBrightness = stats
    ? (() => {
        const channels = (stats as PhotoEnhancerSharpStats).channels || [];
        const totalMean = channels.reduce((sum, channel) => sum + (channel.mean || 0), 0);
        return Math.round(totalMean / Math.max(1, channels.length));
      })()
    : null;

  return {
    ok: true as const,
    prepared: {
      file: previewFile,
      raw: {
        raw: true,
        sourceExtension: getUploadExtension(params.sourceFile),
        converter: "embedded-preview",
        outputMimeType: "image/jpeg",
        width: previewMetadata.width || null,
        height: previewMetadata.height || null,
        format: previewMetadata.format || null,
        resolutionMode: "preview-only",
        originalTooLargeForSyncConversion: true,
      },
    },
    processFile: previewFile,
    payload: {
      success: true,
      preset: params.preset,
      analysis: {
        fileName: params.sourceFile.originalname,
        mimeType: params.sourceFile.mimetype,
        size: params.sourceFile.size,
        processedMimeType: previewFile.mimetype,
        analysisSource: "embedded-preview",
        analysisMimeType: previewFile.mimetype,
        source: {
          ...(params.source || {}),
          analysisMode: "r2-preview-only",
          originalTooLargeForBufferAnalysis: true,
        },
        width: originalWidth,
        height: originalHeight,
        analysisWidth: previewMetadata.width || null,
        analysisHeight: previewMetadata.height || null,
        format: readString((exif as Record<string, unknown> | null)?.FileType) || "raw",
        hasAlpha: false,
        orientation: previewMetadata.orientation || null,
        meanBrightness,
        dominantColor: stats?.dominant || null,
        fileHash: {
          algorithm: "sha256",
          value: params.originalHash,
        },
        perceptualHash,
        duplicateDetection,
        quality: {
          blur: lumaQuality.blur,
          face: faceQuality,
          eyeSharpness: faceQuality.eyeSharpness,
          exposure: lumaQuality.exposure,
          clipping: lumaQuality.clipping,
          noise: lumaQuality.noise,
          compression,
        },
        raw: {
          raw: true,
          sourceExtension: getUploadExtension(params.sourceFile),
          converter: "embedded-preview",
          outputMimeType: "image/jpeg",
          width: previewMetadata.width || null,
          height: previewMetadata.height || null,
          format: previewMetadata.format || null,
          resolutionMode: "preview-only",
          originalTooLargeForSyncConversion: true,
        },
        metadata: {
          exifNormalized: normalizedExif,
          iptc: {
            copyright: normalizedExif.copyright,
            creator: normalizedExif.creator || normalizedExif.artist,
            credit: normalizedExif.credit,
            title: normalizedExif.title,
            description: normalizedExif.description,
          },
          sidecar,
          copyright: {
            value: sidecar.rights || normalizedExif.copyright,
            creator: sidecar.creators[0] || normalizedExif.creator || normalizedExif.artist,
            usageTerms: sidecar.usageTerms || normalizedExif.usageTerms,
          },
          clientName,
          lensProfile,
          cameraProfile,
          whiteBalancePolicy: {
            source: normalizedExif.whiteBalance ? "exif" : "missing",
            value: normalizedExif.whiteBalance,
            action: normalizedExif.whiteBalance ? "preserve-camera-white-balance-as-baseline" : "require-manual-or-auto-neutral-baseline",
          },
          colorProfilePolicy: {
            embeddedProfile: hasEmbeddedProfile,
            inputColorSpace: normalizedExif.colorSpace,
            iccProfile: normalizedExif.iccProfile,
            action: hasEmbeddedProfile ? "preserve-embedded-icc-through-export" : "convert-export-to-srgb-and-mark-missing-input-profile",
          },
          iccPreserved: hasEmbeddedProfile,
        },
        exif,
      },
      models: {
        gfpgan,
        faceApi: {
          id: "face-api.js",
          available: faceApiStatus.available,
          modelsLoaded: faceApiStatus.modelsLoaded,
          reason: faceApiStatus.reason,
        },
        imageHash: {
          id: "image-hash",
          available: Boolean(perceptualHash),
        },
        profiles: {
          lensMatched: Boolean(lensProfile),
          cameraMatched: Boolean(cameraProfile),
        },
      },
      recommendations: [
        "Large source file was uploaded directly to R2 and analyzed from its embedded RAW preview.",
        gfpgan.available
          ? "GFPGAN face restoration model is available from R2."
          : "GFPGAN is not available; Photo Enhancer will use safe Sharp fallback.",
        perceptualHash
          ? "Perceptual hash generated from embedded preview for duplicate detection."
          : "Perceptual hash could not be generated for the embedded preview.",
      ],
    },
  };
}

async function buildPhotoEnhancerEnhancementPayload(params: {
  file: Express.Multer.File;
  preset: string;
  settings: PhotoEnhancerSettings;
  pool?: Pool;
  ownerUserId?: string | null;
}) {
  const prepared = await prepareProcessableImage(params.file, {
    lensCorrection: params.settings?.lensCorrection,
  });
  if (hasUnavailableSourceConversion(prepared.raw)) {
    return {
      ok: false as const,
      status: 422,
      error: conversionErrorCode(prepared.raw),
      raw: prepared.raw,
      rawSupport: await resolveRuntimeSupport(),
      prepared,
    };
  }

  const processFile = prepared.file;
  const gfpgan = await resolveGfpganModelStatus();
  const shouldAttemptGfpgan = shouldUseGfpgan(params.preset, params.settings);

  if (shouldAttemptGfpgan) {
    const modelResult = await runGfpganService({
      file: processFile,
      preset: params.preset,
      settings: params.settings,
      model: gfpgan,
      pool: params.pool,
      ownerUserId: params.ownerUserId,
    });
    if (modelResult) {
      return {
        ok: true as const,
        prepared,
        processFile,
        modelUsed: modelResult.modelUsed,
        inferenceMode: "gfpgan-service",
        outputMimeType: processFile.mimetype,
        payload: {
          success: true,
          enhancedImageUrl: modelResult.enhancedImageUrl,
          imageUrl: modelResult.enhancedImageUrl,
          outputUrl: modelResult.enhancedImageUrl,
          preset: params.preset,
          settings: params.settings,
          modelUsed: modelResult.modelUsed,
          inferenceMode: "gfpgan-service",
          models: { gfpgan },
          raw: prepared.raw,
        },
      };
    }
  }

  const output = await enhanceWithSharp(processFile, params.settings);
  const outputHash = await computeImageHash({
    ...processFile,
    buffer: output.buffer,
    size: output.buffer.byteLength,
    mimetype: output.mimeType,
  });
  const enhancedImageUrl = `data:${output.mimeType};base64,${output.buffer.toString("base64")}`;

  return {
    ok: true as const,
    prepared,
    processFile,
    modelUsed: shouldAttemptGfpgan
      ? "sharp-fallback"
      : params.settings.modelPreference === "auto" || params.settings.modelPreference === "sharp"
        ? "sharp"
        : `${params.settings.modelPreference}-sharp-fallback`,
    inferenceMode: "local-sharp",
    outputMimeType: output.mimeType,
    payload: {
      success: true,
      enhancedImageUrl,
      imageUrl: enhancedImageUrl,
      outputUrl: enhancedImageUrl,
      preset: params.preset,
      settings: params.settings,
      modelUsed: shouldAttemptGfpgan
        ? "sharp-fallback"
        : params.settings.modelPreference === "auto" || params.settings.modelPreference === "sharp"
          ? "sharp"
          : `${params.settings.modelPreference}-sharp-fallback`,
      inferenceMode: "local-sharp",
      models: { gfpgan },
      raw: prepared.raw,
      output: {
        ...output.metadata,
        mimeType: output.mimeType,
        perceptualHash: outputHash,
      },
    },
  };
}

function shouldUseGfpgan(preset: string, settings: PhotoEnhancerSettings): boolean {
  if (settings.modelPreference === "sharp") return false;
  if (settings.modelPreference === "gfpgan") return true;
  return (
    settings.faceEnhancement > 0 ||
    ["portrait", "wedding", "studio"].includes(preset)
  );
}

async function runGfpganService(params: {
  file: Express.Multer.File;
  preset: string;
  settings: PhotoEnhancerSettings;
  model: Awaited<ReturnType<typeof resolveGfpganModelStatus>>;
  pool?: Pool;
  ownerUserId?: string | null;
}): Promise<{ enhancedImageUrl: string; modelUsed: string } | null> {
  const endpoint = resolvePhotoEnhancerRunnerEndpoint(params.model);
  if (!endpoint || !params.model.available || !params.model.inferenceAvailable) return null;

  // When the photographer picked a user-uploaded LUT, resolve it to an
  // inline float table here and hand it to the runner as `lut.inlineTable`
  // — keeps the runner oblivious to R2 and our DB schema.
  let resolvedLut = params.settings.lut as (
    | (PhotoEnhancerSettings["lut"] & {
        inlineTable?: number[];
        inlineSize?: number;
        inlineDomainMin?: number[];
        inlineDomainMax?: number[];
      })
    | null
  );
  if (
    resolvedLut?.name?.startsWith("user_") &&
    params.pool &&
    params.ownerUserId &&
    resolvedLut.strength > 0
  ) {
    try {
      const table = await fetchUserLutTable(params.pool, params.ownerUserId, resolvedLut.name);
      if (table) {
        resolvedLut = {
          ...resolvedLut,
          inlineTable: table.table,
          inlineSize: table.size,
          inlineDomainMin: table.domainMin,
          inlineDomainMax: table.domainMax,
        };
      }
    } catch {
      // fall through — runner will hit its own registry (miss) and log
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PHOTO_ENHANCER_MODEL_TIMEOUT_MS,
  );

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        filename: params.file.originalname,
        mimeType: params.file.mimetype,
        preset: params.preset,
        settings: params.settings,
        controls: {
          quality: params.settings.gfpganQuality,
          codeformerFidelity: params.settings.codeformerFidelity,
          realesrganScale: params.settings.realesrganScale,
          faceOnlyCrop: params.settings.faceOnlyCrop,
          preserveBackground: params.settings.preserveBackground,
          skinTextureGuard: params.settings.skinTextureGuard,
          // Evoto-parity portrait sliders. Runner applies the effect
          // post-GFPGAN using the accompanying intensity profile, which
          // scales the LAB-shift tuning and feather radius per effect.
          // Forwarded even when the feature is 0 so the runner can log
          // uniform telemetry.
          teethWhiteness: params.settings.teethWhiteness,
          eyeBrightness: params.settings.eyeBrightness,
          eyeWhiteness: params.settings.eyeWhiteness,
          blemishRemoval: params.settings.blemishRemoval,
          teethProfile: params.settings.teethProfile,
          eyeBrightnessProfile: params.settings.eyeBrightnessProfile,
          eyeWhitenessProfile: params.settings.eyeWhitenessProfile,
          blemishProfile: params.settings.blemishProfile,
          // Subject-aware pass hint. When the photographer pressed
          // AI-forslag the frontend seeds these from the Claude
          // classification + a default strength; manual workflows
          // leave subject="" and the runner skips the look.
          subject: params.settings.subject,
          subjectLookStrength: params.settings.subjectLookStrength,
          // 8-band HSL colour grading applied post-restore, pre-subject-look.
          // Passed under ``controls`` so the runner accepts it even when the
          // top-level ``settings`` shape skews older (dual-path also used by
          // the portrait sliders above).
          hsl: params.settings.hsl,
          // Built-in LUT look, applied post-HSL. Runner resolves the
          // name against its own registry; passes through identity when
          // name is null or strength is 0. For user-uploaded LUTs the
          // backend inlines the float table so the runner doesn't need
          // R2 credentials.
          lut: resolvedLut,
          // Per-face sliders — the runner detects every face once and
          // applies these override controls on the matching face mask
          // only. Faces without an override inherit the global sliders.
          perFaceOverrides: params.settings.perFaceOverrides,
          requestedModel: params.settings.modelPreference,
        },
        model: {
          id: params.model.id,
          r2Key: params.model.r2Key,
          storageType: params.model.storageType,
          r2Bucket: params.model.weights?.bucket || params.model.r2.bucket,
          weightsKey: params.model.weights?.key || params.model.r2Key,
        },
        imageBase64: params.file.buffer.toString("base64"),
      }),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as Record<string, unknown>;
    const directUrl =
      readString(payload.enhancedImageUrl) ||
      readString(payload.imageUrl) ||
      readString(payload.outputUrl) ||
      readString(payload.resultUrl);
    if (directUrl) {
      return { enhancedImageUrl: directUrl, modelUsed: "gfpgan" };
    }

    const outputBase64 = readString(payload.imageBase64);
    const outputMime = readString(payload.mimeType) || params.file.mimetype;
    if (outputBase64) {
      return {
        enhancedImageUrl: `data:${outputMime};base64,${outputBase64}`,
        modelUsed: "gfpgan",
      };
    }
  } catch (error) {
    console.warn("[photo-enhancer] GFPGAN service unavailable:", error);
  } finally {
    clearTimeout(timeout);
  }

  return null;
}

async function enhanceWithSharp(
  file: Express.Multer.File,
  settings: PhotoEnhancerSettings,
): Promise<{ buffer: Buffer; mimeType: string; metadata: Record<string, unknown> }> {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;
  const brightness = clampNumber(1 + settings.brightness / 180, 0.35, 1.75);
  const saturation = clampNumber(1 + settings.saturation / 140, 0.25, 2.2);
  const contrast = clampNumber(1 + settings.contrast / 130, 0.35, 2.2);

  let pipeline = sharp(file.buffer, { failOn: "none" })
    .rotate()
    .modulate({ brightness, saturation })
    .linear(contrast, 128 - 128 * contrast);

  if (settings.denoising >= 65) {
    pipeline = pipeline.median(2);
  } else if (settings.denoising >= 35) {
    pipeline = pipeline.median(1);
  }

  if (settings.sharpness > 0) {
    pipeline = pipeline.sharpen(clampNumber(settings.sharpness / 35, 0.3, 2.4));
  } else if (settings.sharpness < -15) {
    pipeline = pipeline.blur(clampNumber(Math.abs(settings.sharpness) / 80, 0.3, 1.5));
  }

  const normalizedMime = String(file.mimetype || "").toLowerCase();
  let outputMime = "image/jpeg";
  if (normalizedMime.includes("png")) {
    outputMime = "image/png";
    pipeline = pipeline.png({ compressionLevel: 8 });
  } else if (normalizedMime.includes("webp")) {
    outputMime = "image/webp";
    pipeline = pipeline.webp({ quality: 92 });
  } else {
    pipeline = pipeline.jpeg({ quality: 92, mozjpeg: true });
  }

  const output = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    buffer: output.data,
    mimeType: outputMime,
    metadata: {
      width: output.info.width,
      height: output.info.height,
      format: output.info.format,
      size: output.data.byteLength,
    },
  };
}

function dataUrlToBuffer(dataUrl: string): {
  buffer: Buffer;
  mimeType: string;
} | null {
  const match = /^data:([^;]+);base64,(.+)$/u.exec(dataUrl);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("gif")) return ".gif";
  return ".jpg";
}

async function readPhotoEnhancerManifest(): Promise<PhotoEnhancerSavedFile[]> {
  try {
    const raw = await fs.readFile(photoEnhancerManifestPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PhotoEnhancerSavedFile[]) : [];
  } catch {
    return [];
  }
}

async function writePhotoEnhancerManifest(records: PhotoEnhancerSavedFile[]) {
  await fs.mkdir(photoEnhancerStorageRoot, { recursive: true });
  await fs.writeFile(
    photoEnhancerManifestPath,
    JSON.stringify(records, null, 2),
    "utf8",
  );
}

function toPublicSavedFile(record: PhotoEnhancerSavedFile) {
  const { storagePath: _storagePath, ...publicRecord } = record;
  return publicRecord;
}

async function persistEnhancedBuffer(params: {
  projectId: string;
  folderId?: string | null;
  buffer: Buffer;
  mimeType: string;
  preset: string;
  settings: PhotoEnhancerSettings;
  namePrefix?: string;
}): Promise<PhotoEnhancerSavedFile> {
  const projectDirectory = path.join(projectFileStorageRoot, params.projectId);
  await fs.mkdir(projectDirectory, { recursive: true });
  const id = crypto.randomUUID();
  const extension = extensionForMime(params.mimeType);
  const storedName = `${id}${extension}`;
  const storagePath = path.join(projectDirectory, storedName);
  await fs.writeFile(storagePath, params.buffer);

  const fileRecord: PhotoEnhancerSavedFile = {
    id,
    projectId: params.projectId,
    folderId: params.folderId || null,
    name: `${params.namePrefix || "photo-enhancer"}-${id}${extension}`,
    mimeType: params.mimeType,
    size: params.buffer.byteLength,
    storagePath,
    downloadUrl: `/api/photo-enhancer/files/${id}/download`,
    preset: params.preset,
    settings: params.settings,
    createdAt: new Date().toISOString(),
  };
  const manifest = await readPhotoEnhancerManifest();
  await writePhotoEnhancerManifest([...manifest, fileRecord]);
  return fileRecord;
}

async function enhanceUploadedFile(params: {
  file: Express.Multer.File;
  preset: string;
  settings: PhotoEnhancerSettings;
  pool?: Pool;
  ownerUserId?: string | null;
}): Promise<{
  buffer: Buffer;
  mimeType: string;
  modelUsed: string;
  inferenceMode: string;
  metadata: Record<string, unknown>;
  raw: Record<string, unknown>;
}> {
  const prepared = await prepareProcessableImage(params.file, {
    lensCorrection: params.settings?.lensCorrection,
  });
  if (hasUnavailableSourceConversion(prepared.raw)) {
    throw new Error(`${conversionErrorCode(prepared.raw)}: ${conversionErrorMessage(prepared.raw)}`);
  }

  const gfpgan = await resolveGfpganModelStatus();
  if (shouldUseGfpgan(params.preset, params.settings)) {
    const modelResult = await runGfpganService({
      file: prepared.file,
      preset: params.preset,
      settings: params.settings,
      model: gfpgan,
      pool: params.pool,
      ownerUserId: params.ownerUserId,
    });
    if (modelResult?.enhancedImageUrl?.startsWith("data:")) {
      const decoded = dataUrlToBuffer(modelResult.enhancedImageUrl);
      if (decoded) {
        return {
          buffer: decoded.buffer,
          mimeType: decoded.mimeType,
          modelUsed: modelResult.modelUsed,
          inferenceMode: "gfpgan-service",
          metadata: {},
          raw: prepared.raw,
        };
      }
    }
  }

  const output = await enhanceWithSharp(prepared.file, params.settings);
  return {
    buffer: output.buffer,
    mimeType: output.mimeType,
    modelUsed: shouldUseGfpgan(params.preset, params.settings)
      ? "sharp-fallback"
      : params.settings.modelPreference === "auto" || params.settings.modelPreference === "sharp"
        ? "sharp"
        : `${params.settings.modelPreference}-sharp-fallback`,
    inferenceMode: "local-sharp",
    metadata: output.metadata,
    raw: prepared.raw,
  };
}

type PhotoEnhancerSelfTestCheck = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail" | "skip";
  durationMs: number;
  details?: Record<string, unknown>;
  error?: string;
};

const defaultRawSelfTestUrl =
  "https://raw.pixls.us/getfile.php/129/nice/Canon%20-%20EOS%207D%20-%20sRAW2%20%28sRAW%29%20%283%3A2%29.CR2";

function makeMemoryUploadFile(params: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}): Express.Multer.File {
  return {
    fieldname: "image",
    originalname: params.originalname,
    encoding: "7bit",
    mimetype: params.mimetype,
    size: params.buffer.byteLength,
    buffer: params.buffer,
    destination: "",
    filename: params.originalname,
    path: "",
    stream: undefined as never,
  };
}

async function runSelfTestCheck(
  id: string,
  label: string,
  fn: () => Promise<Omit<PhotoEnhancerSelfTestCheck, "id" | "label" | "durationMs">>,
): Promise<PhotoEnhancerSelfTestCheck> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    return {
      id,
      label,
      durationMs: Date.now() - startedAt,
      ...result,
    };
  } catch (error) {
    return {
      id,
      label,
      status: "fail",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function summarizeSelfTest(checks: PhotoEnhancerSelfTestCheck[]): "pass" | "warn" | "fail" {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn" || check.status === "skip")) return "warn";
  return "pass";
}

async function buildPhotoEnhancerSelfTest(options: {
  includeRaw: boolean;
}): Promise<{
  success: boolean;
  overallStatus: "pass" | "warn" | "fail";
  checks: PhotoEnhancerSelfTestCheck[];
  rawSupport: Awaited<ReturnType<typeof resolveRuntimeSupport>>["raw"];
  metadataSupport: Awaited<ReturnType<typeof resolveRuntimeSupport>>["metadata"];
  models: {
    total: number;
    weightsAvailable: number;
    inferenceAvailable: number;
    gfpgan: PhotoEnhancerModelStatus | null;
  };
}> {
  const [runtimeSupport, modelStatuses] = await Promise.all([
    resolveRuntimeSupport(),
    resolvePhotoEnhancerModelStatuses(),
  ]);
  const gfpgan = modelStatuses.find((model) => model.id === "gfpgan") ?? null;
  const checks: PhotoEnhancerSelfTestCheck[] = [];

  checks.push(
    await runSelfTestCheck("r2-model-registry", "R2 model registry", async () => {
      const weightsAvailable = modelStatuses.filter((model) => model.weights?.found || model.available).length;
      return {
        status: weightsAvailable > 0 ? "pass" : "fail",
        details: {
          total: modelStatuses.length,
          weightsAvailable,
          inferenceAvailable: modelStatuses.filter((model) => model.inferenceAvailable).length,
        },
      };
    }),
  );

  checks.push(
    await runSelfTestCheck("gfpgan-readiness", "GFPGAN weights and runner readiness", async () => ({
      status: gfpgan?.weights?.found
        ? gfpgan.inferenceAvailable
          ? "pass"
          : "warn"
        : "fail",
      details: {
        weightsFound: Boolean(gfpgan?.weights?.found || gfpgan?.available),
        runnerConfigured: Boolean(gfpgan?.runner?.configured),
        runnerHealthy: gfpgan?.runner?.healthy ?? null,
        inferenceAvailable: Boolean(gfpgan?.inferenceAvailable),
        readinessReason: gfpgan?.readinessReason ?? null,
      },
    })),
  );

  checks.push(
    await runSelfTestCheck("sharp-raster-pipeline", "Raster enhancement pipeline", async () => {
      const sharpModule = await import("sharp");
      const buffer = await sharpModule.default({
        create: {
          width: 128,
          height: 96,
          channels: 3,
          background: { r: 126, g: 92, b: 58 },
        },
      })
        .jpeg({ quality: 90 })
        .toBuffer();
      const output = await enhanceWithSharp(
        makeMemoryUploadFile({
          buffer,
          originalname: "self-test.jpg",
          mimetype: "image/jpeg",
        }),
        defaultSettings,
      );
      return {
        status: output.metadata.width && output.metadata.height ? "pass" : "fail",
        details: {
          outputMimeType: output.mimeType,
          output: output.metadata,
        },
      };
    }),
  );

  checks.push(
    await runSelfTestCheck("raw-runtime", "RAW converter runtime", async () => {
      const converters = runtimeSupport.raw.converters;
      const activeConverters = Object.entries(converters)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name);
      return {
        status: runtimeSupport.raw.available ? "pass" : "fail",
        details: {
          activeConverters,
          converters,
          metadata: runtimeSupport.metadata,
        },
      };
    }),
  );

  checks.push(
    await runSelfTestCheck("heic-runtime", "HEIC converter runtime", async () => {
      const heic = runtimeSupport.raw.heic;
      const activeConverters = Object.entries(heic.converters)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name);
      return {
        status: heic.available ? "pass" : "warn",
        details: {
          activeConverters,
          converters: heic.converters,
        },
      };
    }),
  );

  if (options.includeRaw) {
    checks.push(
      await runSelfTestCheck("raw-cr2-conversion", "Live CR2 conversion sample", async () => {
        const rawUrl = readString(process.env.PHOTO_ENHANCER_SELF_TEST_RAW_URL) || defaultRawSelfTestUrl;
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          Number(process.env.PHOTO_ENHANCER_SELF_TEST_RAW_TIMEOUT_MS || 90_000),
        );
        try {
          const response = await fetch(rawUrl, { signal: controller.signal });
          if (!response.ok) {
            throw new Error(`RAW sample download returned HTTP ${response.status}`);
          }
          const buffer = Buffer.from(await response.arrayBuffer());
          const prepared = await prepareProcessableImage(
            makeMemoryUploadFile({
              buffer,
              originalname: "self-test.CR2",
              mimetype: "image/x-canon-cr2",
            }),
          );
          if (prepared.raw.raw && prepared.raw.converter === null) {
            throw new Error(
              typeof prepared.raw.error === "string" ? prepared.raw.error : "RAW conversion unavailable",
            );
          }
          const sharpModule = await import("sharp");
          const metadata = await sharpModule.default(prepared.file.buffer, { failOn: "none" }).metadata();
          return {
            status: metadata.width && metadata.height ? "pass" : "fail",
            details: {
              bytes: buffer.byteLength,
              raw: prepared.raw,
              processedMimeType: prepared.file.mimetype,
              width: metadata.width ?? null,
              height: metadata.height ?? null,
              format: metadata.format ?? null,
            },
          };
        } finally {
          clearTimeout(timer);
        }
      }),
    );
  } else {
    checks.push({
      id: "raw-cr2-conversion",
      label: "Live CR2 conversion sample",
      status: "skip",
      durationMs: 0,
      details: {
        reason: "Pass ?raw=1 to run the external RAW sample conversion test",
      },
    });
  }

  const overallStatus = summarizeSelfTest(checks);
  return {
    success: overallStatus !== "fail",
    overallStatus,
    checks,
    rawSupport: runtimeSupport.raw,
    metadataSupport: runtimeSupport.metadata,
    models: {
      total: modelStatuses.length,
      weightsAvailable: modelStatuses.filter((model) => model.weights?.found || model.available).length,
      inferenceAvailable: modelStatuses.filter((model) => model.inferenceAvailable).length,
      gfpgan,
    },
  };
}

// ─────────────────── User-LUT database helpers ───────────────────────
//
// Thin pg queries — we intentionally avoid pulling in an ORM dependency
// here because the photo-enhancer routes already use plain SQL via the
// shared pool. The ``pool`` parameter is provided by createPhotoEnhancerRouter
// and may be undefined in dev/test; every helper tolerates that by
// throwing so the route returns the `db_unavailable` error rather than
// silently producing an empty result.

interface UserLutRow {
  id: string;
  ownerUserId: string;
  displayName: string;
  description: string;
  category: string | null;
  r2Key: string;
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  swatch: { r: number; g: number; b: number };
  bytes: number;
  sha256: string;
  userUploaded: true;
}

async function insertUserLut(
  pool: Pool,
  row: Omit<UserLutRow, "userUploaded">,
): Promise<void> {
  await pool.query(
    `INSERT INTO photo_enhancer_user_luts
       (id, owner_user_id, display_name, description, category, r2_key,
        size, domain_min, domain_max,
        swatch_r, swatch_g, swatch_b, bytes, sha256)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      row.id,
      row.ownerUserId,
      row.displayName,
      row.description,
      row.category,
      row.r2Key,
      row.size,
      row.domainMin,
      row.domainMax,
      row.swatch.r,
      row.swatch.g,
      row.swatch.b,
      row.bytes,
      row.sha256,
    ],
  );
}

async function listUserLuts(pool: Pool, ownerUserId: string): Promise<Array<{
  id: string;
  displayName: string;
  description: string;
  category: string | null;
  size: number;
  swatch: { r: number; g: number; b: number };
  userUploaded: true;
}>> {
  const result = await pool.query(
    `SELECT id, display_name, description, category, size,
            swatch_r, swatch_g, swatch_b
       FROM photo_enhancer_user_luts
      WHERE owner_user_id = $1
      ORDER BY created_at DESC`,
    [ownerUserId],
  );
  return result.rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    displayName: String(r.display_name),
    description: String(r.description ?? ""),
    category: r.category ? String(r.category) : null,
    size: Number(r.size),
    swatch: {
      r: Number(r.swatch_r),
      g: Number(r.swatch_g),
      b: Number(r.swatch_b),
    },
    userUploaded: true,
  }));
}

async function getUserLut(
  pool: Pool,
  ownerUserId: string,
  lutId: string,
): Promise<UserLutRow | null> {
  const result = await pool.query(
    `SELECT * FROM photo_enhancer_user_luts
      WHERE owner_user_id = $1 AND id = $2
      LIMIT 1`,
    [ownerUserId, lutId],
  );
  const r = result.rows[0];
  if (!r) return null;
  return {
    id: String(r.id),
    ownerUserId: String(r.owner_user_id),
    displayName: String(r.display_name),
    description: String(r.description ?? ""),
    category: r.category ? String(r.category) : null,
    r2Key: String(r.r2_key),
    size: Number(r.size),
    domainMin: Array.isArray(r.domain_min)
      ? [Number(r.domain_min[0]), Number(r.domain_min[1]), Number(r.domain_min[2])]
      : [0, 0, 0],
    domainMax: Array.isArray(r.domain_max)
      ? [Number(r.domain_max[0]), Number(r.domain_max[1]), Number(r.domain_max[2])]
      : [1, 1, 1],
    swatch: {
      r: Number(r.swatch_r),
      g: Number(r.swatch_g),
      b: Number(r.swatch_b),
    },
    bytes: Number(r.bytes),
    sha256: String(r.sha256),
    userUploaded: true,
  };
}

async function deleteUserLut(
  pool: Pool,
  ownerUserId: string,
  lutId: string,
): Promise<void> {
  await pool.query(
    `DELETE FROM photo_enhancer_user_luts WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, lutId],
  );
}

/** Fetch a user LUT's .cube bytes from R2 and parse. Returned table is
 *  a flat float32 array ready to ship to the runner. */
async function fetchUserLutTable(
  pool: Pool,
  ownerUserId: string,
  lutId: string,
): Promise<{ size: number; domainMin: number[]; domainMax: number[]; table: number[] } | null> {
  const row = await getUserLut(pool, ownerUserId, lutId);
  if (!row) return null;
  const config = buildPhotoEnhancerUploadR2Config();
  const client = getPhotoEnhancerUploadR2Client(config);
  if (!client || !config.bucket) return null;
  const response = await client.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: row.r2Key }),
  );
  const body = response.Body as { transformToString?: () => Promise<string> } | undefined;
  if (!body?.transformToString) return null;
  const text = await body.transformToString();
  const meta = parseCubeMetadata(text);
  if (meta.kind !== "3D") return null;
  // Re-parse the full table — parseCubeMetadata only extracts samples.
  // The runner needs the full ``size³ * 3`` float list, so we walk the
  // data rows again here rather than bloating the metadata struct.
  const entries: number[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const upper = line.toUpperCase();
    if (
      upper.startsWith("LUT_") ||
      upper.startsWith("DOMAIN_") ||
      upper.startsWith("TITLE")
    ) {
      continue;
    }
    const parts = line.split(/\s+/);
    if (parts.length !== 3) continue;
    for (const p of parts) entries.push(Number(p));
  }
  if (entries.length !== meta.size * meta.size * meta.size * 3) return null;
  return {
    size: meta.size,
    domainMin: meta.domainMin,
    domainMax: meta.domainMax,
    table: entries,
  };
}

/// Phase 5.4 — capture-side bridge. The iPad's deliver flow uploads
/// picks to capture R2; this enqueues a photo-enhancer job from
/// already-fetched bytes (rather than from an existing PE-R2 source).
/// The capture route fetches via `signAssetReadUrl` and hands the
/// buffer here. We re-upload to PE R2 (so the runner reads from its
/// expected bucket prefix) and construct a job in the same shape
/// `POST /jobs` produces, then schedule the queue.
///
/// Returns the job id on success or null when the PE R2 upload
/// client isn't configured (caller should treat as 503).
export async function enqueuePhotoEnhancerJobFromBuffer(opts: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  projectId?: string;
  owner: string;
  userId: string;
  preset?: string;
}): Promise<string | null> {
  if (!isSupportedPhotoUpload({ originalname: opts.fileName, mimetype: opts.mimeType })) {
    return null;
  }
  const config = buildPhotoEnhancerUploadR2Config();
  const client = getPhotoEnhancerUploadR2Client(config);
  if (!config.enabled || !config.bucket || !client) {
    return null;
  }
  const sha = createHash("sha256").update(opts.buffer).digest("hex");
  const key = buildPhotoEnhancerUploadKey({
    fileName: opts.fileName,
    projectId: opts.projectId || "capture-deliver",
    contentHash: sha,
  });
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: opts.buffer,
        ContentType: opts.mimeType,
        Metadata: { sha256: sha, size: String(opts.buffer.length) },
      }),
    );
  } catch {
    return null;
  }

  const preset = opts.preset || "auto";
  const projectId = opts.projectId || "capture-deliver";
  const now = new Date();
  const job: PhotoEnhancerQueuedJob = {
    id: crypto.randomUUID(),
    status: "queued",
    priority: 0,
    owner: opts.owner,
    userId: opts.userId,
    projectId,
    folderId: null,
    source: {
      bucket: config.bucket,
      key,
      fileName: opts.fileName,
      mimeType: opts.mimeType,
      size: opts.buffer.length,
      uploadId: null,
      originalHash: sha,
    },
    preset,
    settings: normalizeSettings(undefined, preset),
    progress: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    startedAt: null,
    completedAt: null,
    expiresAt: new Date(now.getTime() + PHOTO_ENHANCER_QUEUE_JOB_TTL_MS).toISOString(),
    attempts: 0,
    maxAttempts: 2,
    retryHistory: [],
    failureReason: null,
    timeline: [],
    auditLog: [],
    artifacts: [
      {
        id: "source",
        type: "source",
        mimeType: opts.mimeType,
        size: opts.buffer.length,
        url: null,
        checksum: sha,
      },
    ],
    outputManifest: null,
    checksum: null,
    cancelled: false,
    result: null,
  };
  addPhotoEnhancerJobEvent(job, "created", "Capture-deliver job created.", {
    projectId: job.projectId,
    owner: job.owner,
    bytes: opts.buffer.length,
  });
  addPhotoEnhancerJobEvent(job, "queued", "Job queued for server-side enhancement.", {
    priority: job.priority,
    queuePaused: photoEnhancerQueuePaused,
  });
  photoEnhancerJobs.set(job.id, job);
  prunePhotoEnhancerJobs();
  schedulePhotoEnhancerQueue();
  return job.id;
}

/// Phase 5.4 — collapse a `PhotoEnhancerQueuedJob` into the small
/// shape the iPad poll endpoint cares about: a coarse state name and
/// the enhanced-image URL when ready. Returns `null` for unknown
/// jobIds (e.g. job aged out of the in-memory map).
export function getPhotoEnhancerJobStatusSnapshot(jobId: string): {
  state: "queued" | "running" | "done" | "failed" | "cancelled" | "unknown";
  enhancedUrl: string | null;
} | null {
  const job = photoEnhancerJobs.get(jobId);
  if (!job) return null;
  // Map the internal status taxonomy onto the iPad's simpler enum.
  // Internal statuses include `paused` (queue-wide pause flag) which
  // is not a terminal state — surface it as `queued` to the iPad
  // since it'll resume eventually.
  const state: "queued" | "running" | "done" | "failed" | "cancelled" | "unknown" = (() => {
    switch (job.status) {
      case "queued":
      case "paused":
        return "queued";
      case "running":
        return "running";
      case "completed":
        return "done";
      case "failed":
        return "failed";
      case "cancelled":
        return "cancelled";
      default:
        return "unknown";
    }
  })();
  const enhancedUrl = job.artifacts
    .find((artifact) => artifact.type === "enhanced-image")?.url ?? null;
  return { state, enhancedUrl };
}

export function createPhotoEnhancerRouter(pool?: Pool) {
  const router = express.Router();

  router.get("/status", async (_req, res) => {
    const [modelStatuses, gfpgan, faceApiStatus, runtimeSupport] = await Promise.all([
      resolvePhotoEnhancerModelStatuses(),
      resolveGfpganModelStatus(),
      resolveFaceApiStatus(),
      resolveRuntimeSupport(),
    ]);
    const rawFormatMatrix = buildPhotoEnhancerRawFormatMatrix(runtimeSupport);
    const improvementBacklog = buildPhotoEnhancerImprovementBacklog();
    const weightsAvailable = modelStatuses.filter((model) => model.weights?.found || model.available).length;
    const inferenceAvailable = modelStatuses.filter((model) => model.inferenceAvailable).length;
    const directUpload = buildPhotoEnhancerUploadR2Config();
    res.json({
      success: true,
      r2: buildPublicPhotoEnhancerR2Config(),
      directUpload: {
        enabled: directUpload.enabled,
        strategy: "r2-multipart",
        bucket: directUpload.bucket,
        prefix: directUpload.prefix,
        maxBytes: PHOTO_ENHANCER_DIRECT_UPLOAD_MAX_BYTES,
        partSizeBytes: PHOTO_ENHANCER_R2_PART_SIZE_BYTES,
        maxPartUrlsPerRequest: PHOTO_ENHANCER_R2_PART_BATCH_MAX,
        signedUrlTtlSeconds: PHOTO_ENHANCER_R2_SIGNED_URL_TTL_SECONDS,
        analyzeBufferMaxBytes: PHOTO_ENHANCER_R2_ANALYZE_BUFFER_MAX_BYTES,
        analyzeDownloadMaxBytes: PHOTO_ENHANCER_R2_ANALYZE_DOWNLOAD_MAX_BYTES,
        proxyUpload: {
          enabled: true,
          partSizeBytes: PHOTO_ENHANCER_R2_PROXY_PART_SIZE_BYTES,
          maxPartBytes: PHOTO_ENHANCER_R2_PROXY_PART_MAX_BYTES,
          strategy: "server-assisted-r2-multipart",
          reason: "Use this fallback when the browser cannot PUT directly to R2 because bucket CORS is unavailable.",
        },
        cors: {
          requiresBrowserPut: true,
          exposeHeaders: ["ETag"],
          allowedMethods: ["PUT"],
        },
        reason: directUpload.enabled ? null : "R2 upload bucket or credentials are not configured",
      },
      models: {
        gfpgan,
        registry: modelStatuses,
        registryPolicy: PHOTO_ENHANCER_MODEL_REGISTRY_POLICY,
        summary: {
          total: modelStatuses.length,
          weightsAvailable,
          inferenceAvailable,
        },
        faceApi: {
          id: "face-api.js",
          available: faceApiStatus.available,
          packageAvailable: faceApiStatus.packageAvailable,
          modelsLoaded: faceApiStatus.modelsLoaded,
          modelsDirectory: faceApiStatus.modelsDirectory,
          requiredFiles: faceApiStatus.requiredFiles,
          detectionModel: faceApiStatus.detectionModel,
          landmarkModel: faceApiStatus.landmarkModel,
          backend: faceApiStatus.backend,
          loadedAt: faceApiStatus.loadedAt,
          reason: faceApiStatus.reason,
          role: "face analysis support",
        },
        imageHash: {
          id: "image-hash",
          available: true,
          role: "duplicate and perceptual hash support",
        },
      },
      rawSupport: {
        ...runtimeSupport.raw,
        formatMatrix: rawFormatMatrix.entries,
        formatMatrixSummary: rawFormatMatrix.summary,
      },
      rawFormatMatrix,
      metadataSupport: {
        ...runtimeSupport.metadata,
        exifNormalization: true,
        xmpSidecarIngest: true,
        iptcIngest: true,
        copyrightFields: true,
        clientNameMetadata: true,
        profileRegistry: buildPhotoEnhancerProfileRegistrySummary(),
      },
      googleDrive: {
        folderStructure: PHOTO_ENHANCER_DRIVE_STRUCTURE,
        folderNames: getPhotoEnhancerDriveFolderNames(),
        requiredFolders: PHOTO_ENHANCER_DRIVE_STRUCTURE.filter((folder) => folder.required).map((folder) => folder.name),
      },
      queue: {
        ...getPhotoEnhancerQueueRuntime(),
        capabilities: [
          "server-side batch queue",
          "retry queue",
          "pause batch",
          "resume batch",
          "cancel batch",
          "priority queue",
          "per-user concurrency",
          "per-project concurrency",
          "memory-aware queue",
          "file-size-aware queue",
          "job audit log",
          "job timeline",
          "job failure reason",
          "job retry history",
          "job artifacts",
          "job output manifest",
          "job checksum",
          "job owner",
          "job project binding",
          "job expiry policy",
        ],
      },
      processingOptions: {
        modelPreference: ["auto", "sharp", "gfpgan", "codeformer", "realesrgan", "swinir", "bsrgan", "diffbir"],
        gfpganQuality: { min: 0, max: 100, default: defaultSettings.gfpganQuality },
        codeformerFidelity: { min: 0, max: 100, default: defaultSettings.codeformerFidelity },
        realesrganScale: { values: [2, 3, 4], default: defaultSettings.realesrganScale },
        modes: {
          swinir: true,
          bsrgan: true,
          diffbir: true,
          faceOnlyCrop: true,
          preserveBackground: true,
          skinTextureGuard: { min: 0, max: 100, default: defaultSettings.skinTextureGuard },
          teethWhiteness: { min: 0, max: 100, default: defaultSettings.teethWhiteness },
          eyeBrightness: { min: 0, max: 100, default: defaultSettings.eyeBrightness },
          eyeWhiteness: { min: 0, max: 100, default: defaultSettings.eyeWhiteness },
          blemishRemoval: { min: 0, max: 100, default: defaultSettings.blemishRemoval },
          teethProfile: { values: INTENSITY_PROFILES, default: defaultSettings.teethProfile },
          eyeBrightnessProfile: { values: INTENSITY_PROFILES, default: defaultSettings.eyeBrightnessProfile },
          eyeWhitenessProfile: { values: INTENSITY_PROFILES, default: defaultSettings.eyeWhitenessProfile },
          blemishProfile: { values: INTENSITY_PROFILES, default: defaultSettings.blemishProfile },
          subject: { values: SUBJECT_KINDS, default: defaultSettings.subject },
          subjectLookStrength: { min: 0, max: 100, default: defaultSettings.subjectLookStrength },
        },
        executionNote:
          "GFPGAN uses the configured runner when available. Other advanced models are exposed as controlled preferences and fall back safely until their runners are connected.",
      },
      observability: summarizePhotoEnhancerTelemetry(),
      improvements: {
        total: improvementBacklog.length,
        tracked: improvementBacklog.slice(0, 25),
      },
    });
  });

  router.get("/self-test", async (req, res) => {
    const includeRaw =
      req.query.raw === "1" ||
      req.query.raw === "true" ||
      req.query.includeRaw === "1" ||
      req.query.includeRaw === "true";
    const result = await buildPhotoEnhancerSelfTest({ includeRaw });
    res.status(result.overallStatus === "fail" ? 503 : 200).json({
      ...result,
      generatedAt: new Date().toISOString(),
    });
  });

  router.get("/models", async (_req, res) => {
    const statuses = await resolvePhotoEnhancerModelStatuses();
    res.json({
      success: true,
      models: statuses,
      registry: photoEnhancerModelRegistry,
      registryPolicy: PHOTO_ENHANCER_MODEL_REGISTRY_POLICY,
      r2: buildPublicPhotoEnhancerR2Config(),
    });
  });

  router.get("/observability", async (_req, res) => {
    const [modelStatuses, gfpgan, runtimeSupport] = await Promise.all([
      resolvePhotoEnhancerModelStatuses(),
      resolveGfpganModelStatus(),
      resolveRuntimeSupport(),
    ]);
    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      telemetry: summarizePhotoEnhancerTelemetry(),
      readiness: {
        gfpgan: {
          available: gfpgan.available,
          inferenceAvailable: gfpgan.inferenceAvailable,
          runnerHealthy: gfpgan.runner.healthy,
          readinessReason: gfpgan.readinessReason,
          weightsBucket: gfpgan.weights.bucket,
          weightsKey: gfpgan.weights.key,
        },
        models: {
          total: modelStatuses.length,
          weightsAvailable: modelStatuses.filter((model) => model.weights?.found || model.available).length,
          inferenceAvailable: modelStatuses.filter((model) => model.inferenceAvailable).length,
        },
        raw: runtimeSupport.raw,
        metadata: runtimeSupport.metadata,
      },
      queue: getPhotoEnhancerQueueRuntime(),
    });
  });

  router.get("/raw-support", async (_req, res) => {
    const runtimeSupport = await resolveRuntimeSupport();
    const rawFormatMatrix = buildPhotoEnhancerRawFormatMatrix(runtimeSupport);
    res.json({
      success: true,
      ...runtimeSupport.raw,
      formatMatrix: rawFormatMatrix.entries,
      formatMatrixSummary: rawFormatMatrix.summary,
      rawFormatMatrix,
      metadata: runtimeSupport.metadata,
    });
  });

  router.get("/raw-format-matrix", async (_req, res) => {
    const runtimeSupport = await resolveRuntimeSupport();
    const rawFormatMatrix = buildPhotoEnhancerRawFormatMatrix(runtimeSupport);
    res.json({
      success: true,
      rawSupport: runtimeSupport.raw,
      metadata: runtimeSupport.metadata,
      ...rawFormatMatrix,
    });
  });

  router.post(
    "/raw-format-matrix/test",
    photoEnhancerUpload.single("image"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "image_required",
        });
      }
      if (!isCameraRawFile(req.file)) {
        return res.status(400).json({
          success: false,
          error: "raw_image_required",
          extension: getUploadExtension(req.file),
          mimetype: req.file.mimetype,
        });
      }

      const startedAt = Date.now();
      const prepared = await prepareProcessableImage(req.file);
      const raw = prepared.raw;
      const success = !(raw.raw && raw.converter === null);
      const runtimeSupport = await resolveRuntimeSupport();
      const rawFormatMatrix = buildPhotoEnhancerRawFormatMatrix(runtimeSupport);
      res.status(success ? 200 : 422).json({
        success,
        durationMs: Date.now() - startedAt,
        input: {
          filename: req.file.originalname,
          bytes: req.file.size,
          mimetype: req.file.mimetype,
          extension: getUploadExtension(req.file),
        },
        raw,
        matrix: rawFormatMatrix,
      });
    },
  );

  // Dedicated face-detection endpoint for the enhancer UI's chip picker.
  // Skips the /analyze pipeline (eye sharpness, pHash, format probe) so
  // auto-firing on every image upload stays cheap. Returns bounding
  // boxes in normalised [0, 1] coordinates so the frontend can map them
  // onto any canvas size without reading the detection-time resize scale.
  router.post(
    "/faces",
    photoEnhancerUpload.single("image"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "image_required" });
      }
      const startedAt = Date.now();
      const faceApiStatus = await resolveFaceApiStatus();
      if (!faceApiStatus.available) {
        return res.status(503).json({
          success: false,
          available: false,
          reason: faceApiStatus.reason || "face_api_unavailable",
          runtime: faceApiStatus,
        });
      }
      try {
        // Camera RAW / HEIC can't be decoded by Sharp directly — rasterise
        // first (same path as /analyze) so face detection works on RAW too,
        // not just JPEG/PNG.
        const preparedForFaces = await prepareProcessableImage(req.file as Express.Multer.File);
        if (hasUnavailableSourceConversion(preparedForFaces.raw)) {
          return res
            .status(422)
            .json({ success: false, available: false, error: "raw_conversion_unavailable" });
        }
        const result = await withTimeout(
          runFaceApiExclusive(async () => {
            const runtime = await loadFaceApiRuntime();
            const faceInput = await prepareFaceApiInput(preparedForFaces.file);
            const image = await runtime.canvas.loadImage(faceInput.buffer);
            const options = new runtime.faceApi.TinyFaceDetectorOptions({
              inputSize: PHOTO_ENHANCER_FACE_API_INPUT_SIZE,
              scoreThreshold: PHOTO_ENHANCER_FACE_API_SCORE_THRESHOLD,
            });
            const detections = await runtime.faceApi.detectAllFaces(image, options);
            const width = faceInput.width || 1;
            const height = faceInput.height || 1;
            const faces = detections.map((detection: Record<string, any>, index: number) => {
              const box = detection.box;
              const score = typeof detection.score === "number" ? Number(detection.score.toFixed(4)) : null;
              if (!box) {
                return { index, score, box: null };
              }
              return {
                index,
                score,
                // Absolute pixel box in the detector's downscaled frame.
                boxPixels: {
                  x: Math.round(box.x),
                  y: Math.round(box.y),
                  width: Math.round(box.width),
                  height: Math.round(box.height),
                },
                // Normalised [0, 1] box — stable across canvas sizes.
                box: {
                  x: Math.max(0, Math.min(1, box.x / width)),
                  y: Math.max(0, Math.min(1, box.y / height)),
                  width: Math.max(0, Math.min(1, box.width / width)),
                  height: Math.max(0, Math.min(1, box.height / height)),
                },
              };
            });
            return { faces, width, height };
          }),
          PHOTO_ENHANCER_FACE_API_TIMEOUT_MS,
          "face_detection",
        );
        return res.json({
          success: true,
          available: true,
          faceCount: result.faces.length,
          faces: result.faces,
          image: {
            width: result.width,
            height: result.height,
            maxDimension: PHOTO_ENHANCER_FACE_API_MAX_DIMENSION,
          },
          detectionModel: faceApiStatus.detectionModel,
          processingMs: Date.now() - startedAt,
        });
      } catch (error) {
        return res.status(504).json({
          success: false,
          available: false,
          reason: error instanceof Error ? error.message : "face_detection_failed",
          processingMs: Date.now() - startedAt,
        });
      }
    },
  );

  // LUT library proxy. Forwards to the Python runner's /luts if one is
  // configured; otherwise returns the built-in fallback slugs so the
  // frontend dropdown always has something to show even in dev without
  // the runner running. The fallback must stay in sync with
  // backend/gfpgan-runner/lut_library.py — there is a test asserting
  // the slug set on the runner side.
  router.get("/luts", async (req, res) => {
    const ownerUserId = readString(req.query.owner) || null;

    let builtIn: unknown[] = PHOTO_ENHANCER_BUILTIN_LUTS as unknown as unknown[];
    let source: "runner" | "fallback" = "fallback";
    const runnerEndpoint = resolvePhotoEnhancerRunnerEndpoint({
      runnerEnvKeys: ["PHOTO_ENHANCER_GFPGAN_URL", "GFPGAN_SERVICE_URL"],
      defaultRunnerUrl:
        process.env.RENDER === "true"
          ? "https://creatorhub-gfpgan-runner.onrender.com/enhance"
          : null,
    });
    if (runnerEndpoint) {
      const url = new URL(runnerEndpoint);
      url.pathname = url.pathname.replace(/\/(enhance|)$/, "/luts") || "/luts";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(url.toString(), { method: "GET", signal: controller.signal });
        if (response.ok) {
          const payload = (await response.json()) as Record<string, unknown>;
          if (payload && Array.isArray(payload.luts)) {
            builtIn = payload.luts;
            source = "runner";
          }
        }
      } catch {
        // keep fallback
      } finally {
        clearTimeout(timer);
      }
    }

    let userLuts: unknown[] = [];
    if (ownerUserId && pool) {
      try {
        userLuts = await listUserLuts(pool, ownerUserId);
      } catch (err) {
        // Non-fatal — built-ins still render so the photographer can
        // work with the default library even if the user-LUT table
        // isn't migrated yet in their env.
      }
    }
    return res.json({ success: true, luts: [...builtIn, ...userLuts], source });
  });

  // Frequency-sep 16-bit save proxy. Frontend POSTs raw little-endian
  // Uint16 bytes for its (width × height × channels) edited buffer; the
  // runner returns a binary PNG which we pipe straight back. Bypasses
  // the global 50MB json limit via per-route `express.raw` — typical
  // retouch crops (3–24MP × 3–4 channels × 2 bytes) land between 20
  // and 200MB raw. A 512MB ceiling covers even 60MP RGBA.
  router.post(
    "/frequency-sep/save-16bit",
    express.raw({ type: "application/octet-stream", limit: "512mb" }),
    async (req, res) => {
      const width = Number.parseInt(readString(req.query.width) || "", 10);
      const height = Number.parseInt(readString(req.query.height) || "", 10);
      const channels = Number.parseInt(readString(req.query.channels) || "", 10);
      if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(channels)) {
        return res
          .status(400)
          .json({ success: false, error: "width_height_channels_required" });
      }
      if (channels !== 3 && channels !== 4) {
        return res
          .status(400)
          .json({ success: false, error: "channels_must_be_3_or_4" });
      }
      const bytes = req.body as Buffer;
      const expected = width * height * channels * 2;
      if (!Buffer.isBuffer(bytes) || bytes.length !== expected) {
        return res.status(400).json({
          success: false,
          error: "pixel_length_mismatch",
          got: Buffer.isBuffer(bytes) ? bytes.length : 0,
          expected,
        });
      }

      const runnerEndpoint = resolvePhotoEnhancerRunnerEndpoint({
        runnerEnvKeys: ["PHOTO_ENHANCER_GFPGAN_URL", "GFPGAN_SERVICE_URL"],
        defaultRunnerUrl:
          process.env.RENDER === "true"
            ? "https://creatorhub-gfpgan-runner.onrender.com/enhance"
            : null,
      });
      if (!runnerEndpoint) {
        return res
          .status(503)
          .json({ success: false, error: "runner_not_configured" });
      }

      // Rewrite /enhance (or empty) → /frequency-sep/save-16bit on the runner.
      const url = new URL(runnerEndpoint);
      url.pathname =
        url.pathname.replace(/\/(enhance|)$/, "/frequency-sep/save-16bit") ||
        "/frequency-sep/save-16bit";

      const controller = new AbortController();
      // 30s upper bound — 60MP save through the runner is ~5–8s real; the
      // rest is margin for cold starts on the Render box.
      const timer = setTimeout(() => controller.abort(), 30_000);
      try {
        const runnerResponse = await fetch(url.toString(), {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            width,
            height,
            channels,
            pixelsBase64: bytes.toString("base64"),
          }),
        });
        if (!runnerResponse.ok) {
          const errorText = await runnerResponse.text();
          return res.status(runnerResponse.status).json({
            success: false,
            error: "runner_error",
            detail: errorText.slice(0, 500),
          });
        }
        const pngBuffer = Buffer.from(await runnerResponse.arrayBuffer());
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Length", pngBuffer.length.toString());
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).end(pngBuffer);
      } catch (err) {
        const aborted = (err as { name?: string })?.name === "AbortError";
        return res.status(aborted ? 504 : 502).json({
          success: false,
          error: aborted ? "runner_timeout" : "runner_unreachable",
        });
      } finally {
        clearTimeout(timer);
      }
    },
  );

  // Stamp EXIF/IPTC/XMP metadata onto an exported image blob. Frontend
  // pipes its canvas.toBlob output through this when the preset carries
  // copyright / artist / keywords — canvas strips all metadata and
  // there's no way to re-embed client-side without shipping a JPEG
  // APP1 encoder. exiftool on the Render box is already available
  // (installed by install-photo-raw-tools.mjs).
  router.post(
    "/export/stamp-metadata",
    photoEnhancerUpload.single("image"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "image_required" });
      }
      const copyright = readString(req.body?.copyright);
      const artist = readString(req.body?.artist);
      const creator = readString(req.body?.creator);
      const keywordsRaw = req.body?.keywords;
      const keywords = Array.isArray(keywordsRaw)
        ? keywordsRaw.map(String)
        : typeof keywordsRaw === "string" && keywordsRaw.trim()
        ? keywordsRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      if (!copyright && !artist && !creator && keywords.length === 0) {
        // Nothing to stamp — send the input back unchanged so the
        // frontend can use the same code path whether or not the user
        // configured metadata.
        res.setHeader("Content-Type", req.file.mimetype || "application/octet-stream");
        return res.status(200).end(req.file.buffer);
      }

      const { stampExif } = await import("./photo-enhancer-exif-stamp.js");
      const ext = (req.file.originalname.match(/\.[^.]+$/) || [".bin"])[0];
      const result = await stampExif(
        req.file.buffer,
        {
          copyright: copyright ?? undefined,
          artist: artist ?? undefined,
          creator: creator ?? undefined,
          keywords,
        },
        ext,
      );
      if (!result.ok) {
        // Don't fail the export just because exiftool isn't on the
        // dev box — fall back to passing through untouched.
        if (result.error === "exiftool_unavailable") {
          res.setHeader(
            "Content-Type",
            req.file.mimetype || "application/octet-stream",
          );
          res.setHeader("X-Exif-Stamp", "skipped_exiftool_unavailable");
          return res.status(200).end(req.file.buffer);
        }
        return res.status(500).json({
          success: false,
          error: result.error,
          detail: result.detail,
        });
      }
      res.setHeader("Content-Type", req.file.mimetype || "application/octet-stream");
      res.setHeader("Content-Length", result.bytes.length.toString());
      res.setHeader("X-Exif-Stamp", "applied");
      return res.status(200).end(result.bytes);
    },
  );

  // Photographer → client-gallery delivery for already-enhanced blobs.
  // Pairs with photo-delivery-service.ts's `createClientGalleryFromBlobs`;
  // see that module's header for why this path is separate from the
  // iPad capture-showcase bridge.
  router.post(
    "/deliveries/client-gallery",
    photoEnhancerUpload.array("images", 500),
    async (req, res) => {
      if (!pool) {
        return res.status(503).json({ success: false, error: "db_unavailable" });
      }
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) {
        return res.status(400).json({ success: false, error: "images_required" });
      }

      const ownerUserId = readString(req.body?.ownerUserId);
      const clientName = readString(req.body?.clientName);
      const clientEmail = readString(req.body?.clientEmail);
      const projectTitle = readString(req.body?.projectTitle);
      const existingGalleryId = readString(req.body?.existingGalleryId);
      // Slice 9X.14 — frontend genererer enhancerJobId per export-batch.
      // Optional; om mangler genererer vi server-side så vi alltid har
      // en unik markør per delivery (kommer i analytics_events.metadata
      // og i hver gallery-rads image_metadata).
      const enhancerJobId =
        readString(req.body?.enhancerJobId) ||
        `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

      if (!ownerUserId || !clientName || !clientEmail || !projectTitle) {
        return res.status(400).json({
          success: false,
          error: "metadata_required",
          need: ["ownerUserId", "clientName", "clientEmail", "projectTitle"],
        });
      }

      // Titles arrive parallel-indexed to `images` as repeated form fields;
      // multer flattens them into an array on req.body. Fall back to the
      // filename minus extension when a caller omits them.
      const rawTitles = req.body?.titles;
      const titles: string[] = Array.isArray(rawTitles)
        ? rawTitles.map(String)
        : typeof rawTitles === "string"
        ? [rawTitles]
        : [];

      const { drizzle } = await import("drizzle-orm/node-postgres");
      const { createClientGalleryFromBlobs } = await import(
        "./photo-delivery-service.js"
      );
      const db = drizzle(pool);
      const result = await createClientGalleryFromBlobs({
        db,
        photographerId: ownerUserId,
        clientName,
        clientEmail,
        projectTitle,
        existingGalleryId: existingGalleryId ?? undefined,
        enhancerJobId,
        images: files.map((file, i) => ({
          title: titles[i] || file.originalname.replace(/\.[^.]+$/, ""),
          filename: file.originalname,
          mimeType: file.mimetype || "application/octet-stream",
          bytes: file.buffer,
          metadata: {
            originalSize: file.size,
          },
        })),
      });

      if (!result.ok) {
        const status =
          result.error === "r2_not_configured"
            ? 503
            : result.error === "existing_gallery_not_found"
            ? 404
            : result.error === "no_images"
            ? 400
            : 500;
        return res.status(status).json({
          success: false,
          error: result.error,
          detail: result.detail,
        });
      }
      // Analytics — registrer enhanced batch i ecosystem-loggen.
      // Skriver direkte mot analytics_events siden dette route-modulen
      // ikke importerer recordAnalyticsEvent-helperen fra index.ts.
      // Fire-and-forget (void Promise) så response aldri blokkeres.
      if (pool && result.galleryId) {
        void pool.query(
          `INSERT INTO analytics_events (event_type, entity_type, entity_id, actor_user_id, metadata)
           VALUES ('photo_enhancer.batch_pushed', 'gallery', $1, $2, $3)`,
          [
            String(result.galleryId),
            ownerUserId,
            JSON.stringify({
              uploadedImageCount: result.uploadedImageCount,
              reusedExisting: result.reusedExisting ?? false,
              clientEmail,
              projectTitle,
              enhancerJobId,
            }),
          ],
        ).catch((err) => {
          console.warn('[photo-enhancer-deliveries] analytics record failed:', err);
        });
      }

      return res.status(200).json({
        success: true,
        galleryId: result.galleryId,
        accessToken: result.accessToken,
        enhancerJobId,
        shareUrl: result.shareUrl,
        uploadedImageCount: result.uploadedImageCount,
        reusedExisting: result.reusedExisting,
      });
    },
  );

  router.post(
    "/luts",
    photoEnhancerUpload.single("file"),
    async (req, res) => {
      if (!pool) {
        return res.status(503).json({ success: false, error: "db_unavailable" });
      }
      const ownerUserId = readString(req.body?.ownerUserId);
      if (!ownerUserId) {
        return res.status(400).json({ success: false, error: "owner_user_id_required" });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: "file_required" });
      }
      if (req.file.size > 2 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: "file_too_large" });
      }

      const text = req.file.buffer.toString("utf-8");
      let meta;
      try {
        meta = parseCubeMetadata(text);
      } catch (err) {
        if (err instanceof CubeParseError) {
          return res.status(400).json({ success: false, error: err.code, detail: err.message });
        }
        return res.status(400).json({ success: false, error: "parse_failed" });
      }
      if (meta.kind !== "3D") {
        return res.status(400).json({ success: false, error: "1d_lut_not_supported_yet" });
      }

      const config = buildPhotoEnhancerUploadR2Config();
      const client = getPhotoEnhancerUploadR2Client(config);
      if (!client || !config.enabled || !config.bucket) {
        return res.status(503).json({ success: false, error: "r2_not_configured" });
      }

      const id = `user_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
      const r2Key = `users/${encodeURIComponent(ownerUserId)}/luts/${id}.cube`;
      const sha = createHash("sha256").update(req.file.buffer).digest("hex");
      const swatch = computeSwatchPreview(meta);
      const displayName = readString(req.body?.displayName) || req.file.originalname.replace(/\.cube$/i, "");
      const description = readString(req.body?.description) || meta.title || "";
      const category = readString(req.body?.category) || null;

      try {
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: r2Key,
            Body: req.file.buffer,
            ContentType: "application/octet-stream",
            Metadata: { sha256: sha, size: String(meta.size) },
          }),
        );
      } catch {
        return res.status(502).json({ success: false, error: "r2_upload_failed" });
      }

      try {
        await insertUserLut(pool, {
          id,
          ownerUserId,
          displayName: displayName.slice(0, 200),
          description: description.slice(0, 500),
          category: category?.slice(0, 40) || null,
          r2Key,
          size: meta.size,
          domainMin: meta.domainMin,
          domainMax: meta.domainMax,
          swatch,
          bytes: req.file.size,
          sha256: sha,
        });
      } catch (err) {
        // Best-effort cleanup so we don't leak an orphan R2 object.
        try {
          await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: r2Key }));
        } catch {
          // ignore — operator will reconcile via R2 lifecycle
        }
        return res.status(500).json({ success: false, error: "db_insert_failed" });
      }

      return res.json({
        success: true,
        lut: {
          id,
          displayName,
          description,
          category,
          size: meta.size,
          swatch,
          userUploaded: true,
        },
      });
    },
  );

  router.delete("/luts/:lutId", async (req, res) => {
    if (!pool) {
      return res.status(503).json({ success: false, error: "db_unavailable" });
    }
    const lutId = String(req.params.lutId || "").trim();
    const ownerUserId = readString(req.query.ownerUserId) || readString(req.body?.ownerUserId);
    if (!ownerUserId || !/^user_[a-zA-Z0-9]{8,32}$/.test(lutId)) {
      return res.status(400).json({ success: false, error: "bad_request" });
    }
    const row = await getUserLut(pool, ownerUserId, lutId);
    if (!row) return res.status(404).json({ success: false, error: "not_found" });

    const config = buildPhotoEnhancerUploadR2Config();
    const client = getPhotoEnhancerUploadR2Client(config);
    if (client && config.bucket) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: row.r2Key }));
      } catch {
        // fall through — DB row removal is the authoritative gate
      }
    }
    await deleteUserLut(pool, ownerUserId, lutId);
    return res.json({ success: true });
  });

  // LUT table fetch — proxies the runner's /luts/:id/table so the browser
  // can build a 2D atlas texture for live preview. Falls back to 404 if
  // the runner is unreachable rather than fabricating a table; the UI
  // gracefully disables preview in that case.
  router.get("/luts/:lutId/table", async (req, res) => {
    const lutId = String(req.params.lutId || "").trim();
    if (!/^[a-zA-Z0-9_\-]{1,80}$/.test(lutId)) {
      return res.status(400).json({ success: false, error: "invalid_lut_id" });
    }

    // User-uploaded LUTs live in R2 + the photo_enhancer_user_luts
    // table. They're resolved here without touching the runner.
    if (lutId.startsWith("user_") && pool) {
      const ownerUserId = readString(req.query.ownerUserId);
      if (!ownerUserId) {
        return res.status(400).json({ success: false, error: "owner_user_id_required" });
      }
      try {
        const table = await fetchUserLutTable(pool, ownerUserId, lutId);
        if (!table) return res.status(404).json({ success: false, error: "lut_not_found" });
        return res.json({ success: true, id: lutId, ...table });
      } catch {
        return res.status(502).json({ success: false, error: "r2_fetch_failed" });
      }
    }

    // Try the runner first when configured — it is the source of truth.
    // A non-OK response or an unreachable/stale runner falls through to the
    // built-in table below for known slugs rather than failing the request.
    const runnerEndpoint = resolvePhotoEnhancerRunnerEndpoint({
      runnerEnvKeys: ["PHOTO_ENHANCER_GFPGAN_URL", "GFPGAN_SERVICE_URL"],
      defaultRunnerUrl:
        process.env.RENDER === "true"
          ? "https://creatorhub-gfpgan-runner.onrender.com/enhance"
          : null,
    });
    if (runnerEndpoint) {
      const url = new URL(runnerEndpoint);
      url.pathname = url.pathname.replace(/\/(enhance|)$/, `/luts/${lutId}/table`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const response = await fetch(url.toString(), {
          method: "GET",
          signal: controller.signal,
        });
        if (response.ok) {
          const payload = (await response.json()) as Record<string, unknown>;
          return res.json(payload);
        }
        // Non-OK (e.g. a stale runner deploy lacking the LUT library, or a
        // genuine 404 for a non-built-in slug) — fall through to fallback.
      } catch {
        // Runner unreachable/timeout — fall through to built-in fallback.
      } finally {
        clearTimeout(timer);
      }
    }

    // Built-in fallback keeps /luts/:id/table consistent with the /luts
    // catalog's fallback slugs even when the runner is absent or stale.
    const builtin = buildBuiltinLutTable(lutId);
    if (builtin) {
      return res.json({
        success: true,
        id: lutId,
        size: builtin.size,
        domainMin: [0, 0, 0],
        domainMax: [1, 1, 1],
        table: builtin.table,
      });
    }

    return res.status(runnerEndpoint ? 404 : 503).json({
      success: false,
      error: runnerEndpoint ? "lut_not_found" : "runner_not_configured",
    });
  });

  router.get("/improvements", (_req, res) => {
    const improvements = buildPhotoEnhancerImprovementBacklog();
    res.json({
      success: true,
      total: improvements.length,
      improvements,
    });
  });

  router.get("/jobs", (req, res) => {
    prunePhotoEnhancerJobs();
    const projectId = readString(req.query.projectId);
    const status = readString(req.query.status);
    const owner = readString(req.query.owner);
    const limit = clampNumber(readNumber(req.query.limit) || 50, 1, 200);
    const jobs = [...photoEnhancerJobs.values()]
      .filter((job) => !projectId || job.projectId === projectId)
      .filter((job) => !status || job.status === status)
      .filter((job) => !owner || job.owner === owner || job.userId === owner)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit)
      .map(publicPhotoEnhancerJob);
    res.json({
      success: true,
      queue: getPhotoEnhancerQueueRuntime(),
      jobs,
    });
  });

  router.post("/jobs", async (req, res) => {
    const body = parseJsonObject(req.body);
    const source = readPhotoEnhancerR2Source(body.source || body, body);
    if (!source) {
      return res.status(400).json({ success: false, error: "r2_source_required" });
    }
    if (!isAllowedPhotoEnhancerR2Object(source.bucket, source.key)) {
      return res.status(403).json({ success: false, error: "photo_enhancer_r2_object_not_allowed" });
    }
    if (!isSupportedPhotoUpload({ originalname: source.fileName, mimetype: source.mimeType })) {
      return res.status(415).json({ success: false, error: "unsupported_photo_upload_type" });
    }

    const preset = readString(body.preset) || "auto";
    const projectId = readString(body.projectId) || "photo-enhancer";
    const now = new Date();
    const job: PhotoEnhancerQueuedJob = {
      id: crypto.randomUUID(),
      status: "queued",
      priority: clampNumber(readNumber(body.priority) || 0, 0, 100),
      owner:
        readString(body.owner) ||
        readString(req.headers["x-user-email"]) ||
        readString(req.headers["x-user-id"]) ||
        "unknown",
      userId:
        readString(body.userId) ||
        readString(req.headers["x-user-id"]) ||
        readString(req.headers["x-user-email"]) ||
        "anonymous",
      projectId,
      folderId: readString(body.folderId),
      source,
      preset,
      settings: normalizeSettings(body.settings, preset),
      progress: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      startedAt: null,
      completedAt: null,
      expiresAt: new Date(now.getTime() + PHOTO_ENHANCER_QUEUE_JOB_TTL_MS).toISOString(),
      attempts: 0,
      maxAttempts: clampNumber(readNumber(body.maxAttempts) || 2, 1, 5),
      retryHistory: [],
      failureReason: null,
      timeline: [],
      auditLog: [],
      artifacts: [
        {
          id: "source",
          type: "source",
          mimeType: source.mimeType,
          size: source.size,
          url: null,
          checksum: source.originalHash || null,
        },
      ],
      outputManifest: null,
      checksum: null,
      cancelled: false,
      result: null,
    };
    addPhotoEnhancerJobEvent(job, "created", "Job created.", {
      projectId: job.projectId,
      owner: job.owner,
      bytes: source.size,
    });
    addPhotoEnhancerJobEvent(job, "queued", "Job queued for server-side enhancement.", {
      priority: job.priority,
      queuePaused: photoEnhancerQueuePaused,
    });
    photoEnhancerJobs.set(job.id, job);
    prunePhotoEnhancerJobs();
    schedulePhotoEnhancerQueue();
    res.status(202).json({
      success: true,
      queue: getPhotoEnhancerQueueRuntime(),
      job: publicPhotoEnhancerJob(job),
    });
  });

  router.get("/jobs/:jobId", (req, res) => {
    const job = photoEnhancerJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: "photo_enhancer_job_not_found" });
    }
    res.json({
      success: true,
      queue: getPhotoEnhancerQueueRuntime(),
      job: publicPhotoEnhancerJob(job),
    });
  });

  router.post("/jobs/:jobId/cancel", (req, res) => {
    const job = photoEnhancerJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: "photo_enhancer_job_not_found" });
    }
    const previousStatus = job.status;
    job.cancelled = true;
    if (job.status === "queued" || job.status === "paused") {
      job.status = "cancelled";
      job.completedAt = new Date().toISOString();
      job.progress = 0;
    }
    addPhotoEnhancerJobEvent(job, "cancelled", "Cancel requested.", {
      previousStatus,
    });
    res.json({
      success: true,
      queue: getPhotoEnhancerQueueRuntime(),
      job: publicPhotoEnhancerJob(job),
    });
  });

  router.post("/jobs/:jobId/pause", (req, res) => {
    const job = photoEnhancerJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: "photo_enhancer_job_not_found" });
    }
    if (job.status === "queued") {
      job.status = "paused";
      addPhotoEnhancerJobEvent(job, "paused", "Job paused before processing.");
    }
    res.json({
      success: true,
      queue: getPhotoEnhancerQueueRuntime(),
      job: publicPhotoEnhancerJob(job),
    });
  });

  router.post("/jobs/:jobId/resume", (req, res) => {
    const job = photoEnhancerJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: "photo_enhancer_job_not_found" });
    }
    if (job.status === "paused") {
      job.status = "queued";
      addPhotoEnhancerJobEvent(job, "resumed", "Job resumed.");
      schedulePhotoEnhancerQueue();
    }
    res.json({
      success: true,
      queue: getPhotoEnhancerQueueRuntime(),
      job: publicPhotoEnhancerJob(job),
    });
  });

  router.post("/jobs/:jobId/retry", (req, res) => {
    const job = photoEnhancerJobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: "photo_enhancer_job_not_found" });
    }
    if (job.status !== "failed" && job.status !== "cancelled") {
      return res.status(409).json({ success: false, error: "photo_enhancer_job_not_retryable" });
    }
    job.status = "queued";
    job.cancelled = false;
    job.progress = 0;
    job.completedAt = null;
    job.failureReason = null;
    job.maxAttempts = Math.max(job.maxAttempts, job.attempts + 1);
    addPhotoEnhancerJobEvent(job, "retry", "Manual retry queued.", {
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    });
    schedulePhotoEnhancerQueue();
    res.json({
      success: true,
      queue: getPhotoEnhancerQueueRuntime(),
      job: publicPhotoEnhancerJob(job),
    });
  });

  router.post("/queue/pause", (_req, res) => {
    photoEnhancerQueuePaused = true;
    for (const job of photoEnhancerJobs.values()) {
      if (job.status === "queued") {
        addPhotoEnhancerJobEvent(job, "paused", "Queue paused.");
      }
    }
    res.json({ success: true, queue: getPhotoEnhancerQueueRuntime() });
  });

  router.post("/queue/resume", (_req, res) => {
    photoEnhancerQueuePaused = false;
    for (const job of photoEnhancerJobs.values()) {
      if (job.status === "queued") {
        addPhotoEnhancerJobEvent(job, "resumed", "Queue resumed.");
      }
    }
    schedulePhotoEnhancerQueue();
    res.json({ success: true, queue: getPhotoEnhancerQueueRuntime() });
  });

  router.post("/uploads/multipart", async (req, res) => {
    try {
      const body = parseJsonObject(req.body);
      const fileName = readString(body.fileName) || "upload.raw";
      const contentType = readString(body.contentType) || "application/octet-stream";
      const size = readNumber(body.size);
      const projectId = readString(body.projectId);
      const contentHash = readString(body.contentHash);
      const preferredPartSizeBytes = readNumber(body.preferredPartSizeBytes);
      if (!size || size <= 0) {
        return res.status(400).json({ success: false, error: "file_size_required" });
      }
      if (size > PHOTO_ENHANCER_DIRECT_UPLOAD_MAX_BYTES) {
        return res.status(413).json({
          success: false,
          error: "photo_enhancer_direct_upload_too_large",
          maxBytes: PHOTO_ENHANCER_DIRECT_UPLOAD_MAX_BYTES,
        });
      }
      if (!isSupportedPhotoUpload({ originalname: fileName, mimetype: contentType })) {
        return res.status(415).json({ success: false, error: "unsupported_photo_upload_type" });
      }

      const config = buildPhotoEnhancerUploadR2Config();
      const client = getPhotoEnhancerUploadR2Client(config);
      if (!client || !config.bucket) {
        return res.status(503).json({
          success: false,
          error: "photo_enhancer_r2_upload_not_configured",
          directUpload: {
            enabled: false,
            reason: "R2 upload bucket or credentials are not configured",
          },
        });
      }

      const key = buildPhotoEnhancerUploadKey({ fileName, projectId, contentHash });
      const partSize = calculatePhotoEnhancerR2PartSize(size, preferredPartSizeBytes);
      const partCount = Math.ceil(size / partSize);
      const created = await client.send(
        new CreateMultipartUploadCommand({
          Bucket: config.bucket,
          Key: key,
          ContentType: contentType,
          Metadata: {
            originalName: fileName.slice(0, 1024),
            projectId: projectId || "unassigned",
            source: "creatorhub-photo-enhancer",
          },
        }),
      );

      res.json({
        success: true,
        upload: {
          strategy: "r2-multipart",
          bucket: config.bucket,
          key,
          uploadId: created.UploadId,
          fileName,
          contentType,
          size,
          partSize,
          partCount,
          expiresInSeconds: PHOTO_ENHANCER_R2_SIGNED_URL_TTL_SECONDS,
          maxPartUrlsPerRequest: PHOTO_ENHANCER_R2_PART_BATCH_MAX,
          cors: {
            exposeHeaders: ["ETag"],
            allowedMethods: ["PUT"],
          },
        },
      });
    } catch (error) {
      console.error("[photo-enhancer] multipart create failed:", error);
      res.status(500).json({ success: false, error: "photo_enhancer_multipart_create_failed" });
    }
  });

  router.post("/uploads/multipart/parts", async (req, res) => {
    try {
      const body = parseJsonObject(req.body);
      const bucket = readString(body.bucket);
      const key = readString(body.key);
      const uploadId = readString(body.uploadId);
      const rawPartNumbers = Array.isArray(body.partNumbers) ? body.partNumbers : [];
      const partNumbers = rawPartNumbers
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0 && value <= 10_000)
        .slice(0, PHOTO_ENHANCER_R2_PART_BATCH_MAX);

      if (!bucket || !key || !uploadId || partNumbers.length === 0) {
        return res.status(400).json({ success: false, error: "multipart_part_request_invalid" });
      }
      if (!isAllowedPhotoEnhancerR2Object(bucket, key)) {
        return res.status(403).json({ success: false, error: "photo_enhancer_r2_object_not_allowed" });
      }

      const config = buildPhotoEnhancerUploadR2Config();
      const client = getPhotoEnhancerUploadR2Client(config);
      if (!client) {
        return res.status(503).json({ success: false, error: "photo_enhancer_r2_upload_not_configured" });
      }

      const parts = await Promise.all(
        partNumbers.map(async (partNumber) => ({
          partNumber,
          url: await getSignedUrl(
            client,
            new UploadPartCommand({
              Bucket: bucket,
              Key: key,
              UploadId: uploadId,
              PartNumber: partNumber,
            }),
            { expiresIn: PHOTO_ENHANCER_R2_SIGNED_URL_TTL_SECONDS },
          ),
        })),
      );

      res.json({
        success: true,
        parts,
        expiresInSeconds: PHOTO_ENHANCER_R2_SIGNED_URL_TTL_SECONDS,
      });
    } catch (error) {
      console.error("[photo-enhancer] multipart part signing failed:", error);
      res.status(500).json({ success: false, error: "photo_enhancer_multipart_part_signing_failed" });
    }
  });

  router.post(
    "/uploads/multipart/proxy-part",
    photoEnhancerR2PartUpload.single("part"),
    async (req, res) => {
      try {
        const bucket = readString(req.body?.bucket);
        const key = readString(req.body?.key);
        const uploadId = readString(req.body?.uploadId);
        const partNumber = readNumber(req.body?.partNumber);

        if (!req.file) {
          return res.status(400).json({ success: false, error: "multipart_proxy_part_file_required" });
        }
        if (!bucket || !key || !uploadId || !partNumber || partNumber <= 0 || partNumber > 10_000) {
          return res.status(400).json({ success: false, error: "multipart_proxy_part_request_invalid" });
        }
        if (req.file.size > PHOTO_ENHANCER_R2_PROXY_PART_MAX_BYTES) {
          return res.status(413).json({
            success: false,
            error: "multipart_proxy_part_too_large",
            maxBytes: PHOTO_ENHANCER_R2_PROXY_PART_MAX_BYTES,
          });
        }
        if (!isAllowedPhotoEnhancerR2Object(bucket, key)) {
          return res.status(403).json({ success: false, error: "photo_enhancer_r2_object_not_allowed" });
        }

        const config = buildPhotoEnhancerUploadR2Config();
        const client = getPhotoEnhancerUploadR2Client(config);
        if (!client) {
          return res.status(503).json({ success: false, error: "photo_enhancer_r2_upload_not_configured" });
        }

        const uploaded = await client.send(
          new UploadPartCommand({
            Bucket: bucket,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
            Body: req.file.buffer,
            ContentLength: req.file.size,
          }),
        );

        if (!uploaded.ETag) {
          return res.status(502).json({ success: false, error: "photo_enhancer_r2_part_etag_missing" });
        }

        res.json({
          success: true,
          part: {
            partNumber,
            etag: uploaded.ETag,
            size: req.file.size,
          },
        });
      } catch (error) {
        console.error("[photo-enhancer] multipart proxy part upload failed:", error);
        res.status(500).json({ success: false, error: "photo_enhancer_multipart_proxy_part_failed" });
      }
    },
  );

  router.post("/uploads/multipart/complete", async (req, res) => {
    try {
      const body = parseJsonObject(req.body);
      const bucket = readString(body.bucket);
      const key = readString(body.key);
      const uploadId = readString(body.uploadId);
      const fileName = readString(body.fileName) || "upload.raw";
      const contentType = readString(body.contentType) || "application/octet-stream";
      const size = readNumber(body.size) || 0;
      const parts = Array.isArray(body.parts)
        ? body.parts
            .map((part) => {
              const record = parseJsonObject(part);
              const partNumber = readNumber(record.partNumber);
              const etag = readString(record.etag) || readString(record.ETag);
              return partNumber && etag ? { PartNumber: partNumber, ETag: etag } : null;
            })
            .filter((part): part is { PartNumber: number; ETag: string } => Boolean(part))
            .sort((left, right) => left.PartNumber - right.PartNumber)
        : [];

      if (!bucket || !key || !uploadId || parts.length === 0) {
        return res.status(400).json({ success: false, error: "multipart_complete_request_invalid" });
      }
      if (!isAllowedPhotoEnhancerR2Object(bucket, key)) {
        return res.status(403).json({ success: false, error: "photo_enhancer_r2_object_not_allowed" });
      }

      const config = buildPhotoEnhancerUploadR2Config();
      const client = getPhotoEnhancerUploadR2Client(config);
      if (!client) {
        return res.status(503).json({ success: false, error: "photo_enhancer_r2_upload_not_configured" });
      }

      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts,
          },
        }),
      );
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

      res.json({
        success: true,
        source: {
          storageType: "r2",
          bucket,
          key,
          uploadId,
          fileName,
          mimeType: head.ContentType || contentType,
          size: Number(head.ContentLength ?? size),
          etag: head.ETag || null,
          lastModified: head.LastModified || null,
        },
      });
    } catch (error) {
      console.error("[photo-enhancer] multipart complete failed:", error);
      res.status(500).json({ success: false, error: "photo_enhancer_multipart_complete_failed" });
    }
  });

  router.post("/uploads/multipart/abort", async (req, res) => {
    try {
      const body = parseJsonObject(req.body);
      const bucket = readString(body.bucket);
      const key = readString(body.key);
      const uploadId = readString(body.uploadId);
      if (!bucket || !key || !uploadId) {
        return res.status(400).json({ success: false, error: "multipart_abort_request_invalid" });
      }
      if (!isAllowedPhotoEnhancerR2Object(bucket, key)) {
        return res.status(403).json({ success: false, error: "photo_enhancer_r2_object_not_allowed" });
      }

      const config = buildPhotoEnhancerUploadR2Config();
      const client = getPhotoEnhancerUploadR2Client(config);
      if (!client) {
        return res.status(503).json({ success: false, error: "photo_enhancer_r2_upload_not_configured" });
      }

      await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
      res.json({ success: true });
    } catch (error) {
      console.error("[photo-enhancer] multipart abort failed:", error);
      res.status(500).json({ success: false, error: "photo_enhancer_multipart_abort_failed" });
    }
  });

  router.post("/analyze-r2", async (req, res) => {
    const body = parseJsonObject(req.body);
    const sourceRecord = parseJsonObject(body.source || body);
    const bucket = readString(sourceRecord.bucket);
    const key = readString(sourceRecord.key);
    const fileName = readString(sourceRecord.fileName) || readString(body.fileName) || "upload.raw";
    const mimeType =
      readString(sourceRecord.mimeType) ||
      readString(sourceRecord.contentType) ||
      readString(body.contentType) ||
      "application/octet-stream";
    const size = readNumber(sourceRecord.size) || readNumber(body.size) || 0;
    const preset = readString(body.preset) || "auto";
    const startedAt = Date.now();

    if (!bucket || !key) {
      return res.status(400).json({ success: false, error: "r2_source_required" });
    }
    if (!isAllowedPhotoEnhancerR2Object(bucket, key)) {
      return res.status(403).json({ success: false, error: "photo_enhancer_r2_object_not_allowed" });
    }

    let downloaded: Awaited<ReturnType<typeof downloadPhotoEnhancerR2ObjectToTemp>> | null = null;
    try {
      downloaded = await downloadPhotoEnhancerR2ObjectToTemp({
        bucket,
        key,
        fileName,
        expectedMimeType: mimeType,
        expectedSize: size,
      });
      const source: PhotoEnhancerR2Source = {
        bucket,
        key,
        fileName,
        mimeType: downloaded.mimeType || mimeType,
        size: downloaded.size,
        uploadId: readString(sourceRecord.uploadId),
        originalHash: downloaded.originalHash,
      };
      const sourceMetaFile = {
        originalname: fileName,
        mimetype: source.mimeType,
        size: source.size,
      };
      const sourcePayload = {
        storageType: "r2",
        bucket,
        key,
        fileName,
        mimeType: source.mimeType,
        size: source.size,
        uploadId: source.uploadId || null,
        originalHash: source.originalHash,
        uploadMode: "direct-r2-multipart",
      };

      const analysisResult =
        downloaded.size <= PHOTO_ENHANCER_R2_ANALYZE_BUFFER_MAX_BYTES
          ? await buildPhotoEnhancerAnalysisPayload({
              file: makeMulterMemoryFile({
                originalname: fileName,
                mimetype: source.mimeType,
                size: source.size,
                buffer: await fs.readFile(downloaded.inputPath),
              }),
              preset,
              body,
              source: sourcePayload,
            })
          : isCameraRawFile(sourceMetaFile)
            ? await buildPhotoEnhancerPreviewOnlyAnalysisPayload({
                sourceFile: sourceMetaFile,
                inputPath: downloaded.inputPath,
                originalHash: downloaded.originalHash,
                preset,
                body,
                source: sourcePayload,
              })
            : {
                ok: false as const,
                status: 413,
                error: "photo_enhancer_large_sync_analysis_requires_smaller_raster",
                reason: "The uploaded raster file is too large for synchronous buffer analysis.",
              };

      if (!analysisResult.ok) {
        const analysisReason =
          "reason" in analysisResult && typeof analysisResult.reason === "string"
            ? analysisResult.reason
            : null;
        trackPhotoEnhancerEvent({
          route: "analyze",
          success: false,
          fileName,
          sourceExtension: getUploadExtension({ originalname: fileName }),
          sourceMimeType: source.mimeType,
          raw: isCameraRawFile(sourceMetaFile),
          heic: isHeicFile(sourceMetaFile),
          rawConverter: null,
          preset,
          processingMs: Date.now() - startedAt,
          error: analysisReason || analysisResult.error,
        });
        return res.status(analysisResult.status).json({
          success: false,
          error: analysisResult.error,
          reason: analysisReason,
          source: sourcePayload,
        });
      }

      res.json(analysisResult.payload);
      trackPhotoEnhancerEvent({
        route: "analyze",
        success: true,
        fileName,
        sourceExtension: getUploadExtension({ originalname: fileName }),
        sourceMimeType: source.mimeType,
        raw: Boolean(analysisResult.prepared.raw.raw),
        heic:
          analysisResult.prepared.raw &&
          typeof analysisResult.prepared.raw === "object" &&
          "heic" in analysisResult.prepared.raw
            ? Boolean(analysisResult.prepared.raw.heic)
            : false,
        rawConverter: readString(analysisResult.prepared.raw.converter),
        preset,
        modelUsed: null,
        inferenceMode: downloaded.size <= PHOTO_ENHANCER_R2_ANALYZE_BUFFER_MAX_BYTES ? "r2-buffer-analysis" : "r2-preview-analysis",
        processingMs: Date.now() - startedAt,
        outputMimeType: analysisResult.processFile.mimetype,
      });
    } catch (error) {
      console.error("[photo-enhancer] r2 analyze failed:", error);
      const message = error instanceof Error ? error.message : String(error);
      const status = message.includes("too_large") ? 413 : message.includes("not_configured") ? 503 : 500;
      trackPhotoEnhancerEvent({
        route: "analyze",
        success: false,
        fileName,
        sourceExtension: getUploadExtension({ originalname: fileName }),
        sourceMimeType: mimeType,
        raw: isCameraRawFile({ originalname: fileName, mimetype: mimeType }),
        heic: isHeicFile({ originalname: fileName, mimetype: mimeType }),
        preset,
        processingMs: Date.now() - startedAt,
        error: message,
      });
      res.status(status).json({
        success: false,
        error: status === 413 ? "photo_enhancer_r2_object_too_large_for_sync_analysis" : "photo_enhancer_r2_analyze_failed",
        reason: message,
      });
    } finally {
      if (downloaded?.tempDir) {
        await fs.rm(downloaded.tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  });

  router.post("/enhance-r2", async (req, res) => {
    const body = parseJsonObject(req.body);
    const sourceRecord = parseJsonObject(body.source || body);
    const bucket = readString(sourceRecord.bucket);
    const key = readString(sourceRecord.key);
    const fileName = readString(sourceRecord.fileName) || readString(body.fileName) || "upload.raw";
    const mimeType =
      readString(sourceRecord.mimeType) ||
      readString(sourceRecord.contentType) ||
      readString(body.contentType) ||
      "application/octet-stream";
    const size = readNumber(sourceRecord.size) || readNumber(body.size) || 0;
    const preset = readString(body.preset) || "auto";
    const settings = normalizeSettings(body.settings, preset);
    const startedAt = Date.now();

    if (!bucket || !key) {
      return res.status(400).json({ success: false, error: "r2_source_required" });
    }
    if (!isAllowedPhotoEnhancerR2Object(bucket, key)) {
      return res.status(403).json({ success: false, error: "photo_enhancer_r2_object_not_allowed" });
    }

    let downloaded: Awaited<ReturnType<typeof downloadPhotoEnhancerR2ObjectToTemp>> | null = null;
    try {
      downloaded = await downloadPhotoEnhancerR2ObjectToTemp({
        bucket,
        key,
        fileName,
        expectedMimeType: mimeType,
        expectedSize: size,
      });
      const sourceMetaFile = {
        originalname: fileName,
        mimetype: downloaded.mimeType || mimeType,
        size: downloaded.size,
      };
      const sourcePayload = {
        storageType: "r2",
        bucket,
        key,
        fileName,
        mimeType: downloaded.mimeType || mimeType,
        size: downloaded.size,
        uploadId: readString(sourceRecord.uploadId) || null,
        originalHash: downloaded.originalHash,
        uploadMode: "direct-r2-multipart",
      };

      if (downloaded.size > PHOTO_ENHANCER_R2_ANALYZE_BUFFER_MAX_BYTES) {
        trackPhotoEnhancerEvent({
          route: "enhance",
          success: false,
          fileName,
          sourceExtension: getUploadExtension({ originalname: fileName }),
          sourceMimeType: sourcePayload.mimeType,
          raw: isCameraRawFile(sourceMetaFile),
          heic: isHeicFile(sourceMetaFile),
          preset,
          processingMs: Date.now() - startedAt,
          error: "photo_enhancer_large_r2_enhance_requires_async_queue",
        });
        return res.status(413).json({
          success: false,
          error: "photo_enhancer_large_r2_enhance_requires_async_queue",
          reason: "The file is safely stored in R2, but synchronous enhancement is limited to the configured in-memory processing size. Use the async Photo Enhancer queue for this source.",
          source: sourcePayload,
          maxSyncBytes: PHOTO_ENHANCER_R2_ANALYZE_BUFFER_MAX_BYTES,
        });
      }

      const enhancementResult = await buildPhotoEnhancerEnhancementPayload({
        file: makeMulterMemoryFile({
          originalname: fileName,
          mimetype: sourcePayload.mimeType,
          size: sourcePayload.size,
          buffer: await fs.readFile(downloaded.inputPath),
        }),
        preset,
        settings,
      });

      if (!enhancementResult.ok) {
        trackPhotoEnhancerEvent({
          route: "enhance",
          success: false,
          fileName,
          sourceExtension: getUploadExtension({ originalname: fileName }),
          sourceMimeType: sourcePayload.mimeType,
          raw: Boolean(enhancementResult.prepared.raw.raw),
          heic: Boolean(enhancementResult.prepared.raw.heic),
          rawConverter: null,
          preset,
          processingMs: Date.now() - startedAt,
          error: conversionErrorMessage(enhancementResult.raw),
        });
        return res.status(enhancementResult.status).json({
          success: false,
          error: enhancementResult.error,
          raw: enhancementResult.raw,
          rawSupport: enhancementResult.rawSupport,
          source: sourcePayload,
        });
      }

      const processingMs = Date.now() - startedAt;
      res.json({
        ...enhancementResult.payload,
        source: sourcePayload,
        processingMs,
      });
      trackPhotoEnhancerEvent({
        route: "enhance",
        success: true,
        fileName,
        sourceExtension: getUploadExtension({ originalname: fileName }),
        sourceMimeType: sourcePayload.mimeType,
        raw: Boolean(enhancementResult.prepared.raw.raw),
        heic: Boolean(enhancementResult.prepared.raw.heic),
        rawConverter: readString(enhancementResult.prepared.raw.converter),
        preset,
        modelUsed: enhancementResult.modelUsed,
        inferenceMode: "r2-buffer-enhance",
        processingMs,
        outputMimeType: enhancementResult.outputMimeType,
      });
    } catch (error) {
      console.error("[photo-enhancer] r2 enhance failed:", error);
      const message = error instanceof Error ? error.message : String(error);
      const status = message.includes("too_large") ? 413 : message.includes("not_configured") ? 503 : 500;
      trackPhotoEnhancerEvent({
        route: "enhance",
        success: false,
        fileName,
        sourceExtension: getUploadExtension({ originalname: fileName }),
        sourceMimeType: mimeType,
        raw: isCameraRawFile({ originalname: fileName, mimetype: mimeType }),
        heic: isHeicFile({ originalname: fileName, mimetype: mimeType }),
        preset,
        processingMs: Date.now() - startedAt,
        error: message,
      });
      res.status(status).json({
        success: false,
        error: status === 413 ? "photo_enhancer_r2_object_too_large_for_sync_enhance" : "photo_enhancer_r2_enhance_failed",
        reason: message,
      });
    } finally {
      if (downloaded?.tempDir) {
        await fs.rm(downloaded.tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  });

  router.post(
    "/analyze",
    photoEnhancerUpload.single("image"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "image_required" });
      }

      try {
        const startedAt = Date.now();
        const preset = readString(req.body?.preset) || "auto";
        const analysisResult = await buildPhotoEnhancerAnalysisPayload({
          file: req.file,
          preset,
          body: req.body as Record<string, unknown>,
        });
        if (!analysisResult.ok) {
          trackPhotoEnhancerEvent({
            route: "analyze",
            success: false,
            fileName: req.file.originalname,
            sourceExtension: getUploadExtension(req.file),
            sourceMimeType: req.file.mimetype,
            raw: Boolean(analysisResult.prepared.raw.raw),
            heic: Boolean(analysisResult.prepared.raw.heic),
            rawConverter: null,
            preset,
            processingMs: Date.now() - startedAt,
            error: conversionErrorMessage(analysisResult.prepared.raw),
          });
          return res.status(analysisResult.status).json({
            success: false,
            error: analysisResult.error,
            raw: analysisResult.raw,
            rawSupport: analysisResult.rawSupport,
          });
        }
        res.json(analysisResult.payload);
        trackPhotoEnhancerEvent({
          route: "analyze",
          success: true,
          fileName: req.file.originalname,
          sourceExtension: getUploadExtension(req.file),
          sourceMimeType: req.file.mimetype,
          raw: Boolean(analysisResult.prepared.raw.raw),
          heic: Boolean(analysisResult.prepared.raw.heic),
          rawConverter: readString(analysisResult.prepared.raw.converter),
          preset,
          modelUsed: null,
          inferenceMode: "analysis",
          processingMs: Date.now() - startedAt,
          outputMimeType: analysisResult.processFile.mimetype,
        });
      } catch (error) {
        console.error("[photo-enhancer] analyze failed:", error);
        trackPhotoEnhancerEvent({
          route: "analyze",
          success: false,
          fileName: req.file.originalname,
          sourceExtension: getUploadExtension(req.file),
          sourceMimeType: req.file.mimetype,
          raw: isCameraRawFile(req.file),
          heic: isHeicFile(req.file),
          preset: readString(req.body?.preset) || "auto",
          processingMs: 0,
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ success: false, error: "photo_analyze_failed" });
      }
    },
  );

  // POST /preview — a browser-renderable raster of any upload, including
  // every camera RAW format (Nikon NEF, Sony ARW, Fujifilm RAF, Canon
  // CR2/CR3, Panasonic RW2, Olympus ORF, Pentax, DNG, …) and HEIC. The
  // browser can't decode RAW, so the UI calls this to get a JPEG it can
  // display in the preview and feed to the AI / face-detection endpoints.
  // The original RAW is still sent to /enhance, where it is converted at
  // full quality server-side — this is only the lightweight preview.
  router.post("/preview", photoEnhancerUpload.single("image"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "image_required" });
    }
    try {
      // Fast path: most RAWs embed a full-size JPEG preview we can pull
      // with exiftool — far cheaper than a full dcraw/darktable decode.
      let rasterBuffer: Buffer | null = null;
      const embedded = await extractEmbeddedPreviewImage(req.file).catch(() => null);
      if (embedded && embedded.buffer && embedded.buffer.byteLength > 1024) {
        rasterBuffer = embedded.buffer;
      } else {
        // Full RAW/HEIC decode (or passthrough for already-raster uploads).
        const prepared = await prepareProcessableImage(req.file);
        if (hasUnavailableSourceConversion(prepared.raw)) {
          return res
            .status(422)
            .json({ success: false, error: "raw_conversion_unavailable" });
        }
        rasterBuffer = prepared.file.buffer;
      }

      const sharpModule = await import("sharp");
      const sharp = sharpModule.default;
      const jpeg = await sharp(rasterBuffer, { failOn: "none" })
        .rotate()
        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();

      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "no-store");
      return res.send(jpeg);
    } catch (error) {
      console.error("[photo-enhancer] preview failed:", error);
      return res.status(500).json({ success: false, error: "preview_failed" });
    }
  });

  // POST /suggest-recipe — Claude Vision-driven first-draft recipe.
  // Takes a JPEG/PNG/WebP upload, asks Claude Opus 4.7 to read the
  // image and propose values for every slider the enhancer exposes
  // (including Evoto-parity teeth/eye/skin + per-effect profile). The
  // web UI merges the response into the current settings so the
  // photographer starts from a defensible baseline instead of zero.
  router.post(
    "/suggest-recipe",
    photoEnhancerUpload.single("image"),
    async (req, res) => {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "image_required" });
      }
      const mime = String(req.file.mimetype || "").toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
        return res
          .status(415)
          .json({ success: false, error: "unsupported_mime" });
      }
      try {
        const imageBase64 = req.file.buffer.toString("base64");
        const presetHint =
          readString(req.body?.preset) ||
          readString(req.body?.profession) ||
          undefined;
        // Per-user learned drift. Wrapped in a try so a DB hiccup
        // here can never break the AI suggestion call itself — the
        // suggestion still fires, just without personalisation.
        const userId =
          readString((req.body as Record<string, unknown> | undefined)?.userId) ||
          readString(req.headers["x-user-id"]) ||
          null;
        let userPreferenceSummary: string | undefined;
        if (pool && userId) {
          try {
            const agg = await aggregateUserRecipePreferences(pool, userId);
            if (agg) userPreferenceSummary = agg;
          } catch (prefErr) {
            console.warn(
              "[photo-enhancer] preference aggregation failed:",
              prefErr,
            );
          }
        }
        const styleInstruction =
          readString((req.body as Record<string, unknown> | undefined)?.instruction) ||
          undefined;
        const result = await suggestPortraitRecipe({
          imageBase64,
          mime: mime as "image/jpeg" | "image/png" | "image/webp",
          presetHint,
          userPreferenceSummary,
          styleInstruction,
        });
        if (!result.ok) {
          const status =
            result.error === "not_configured"
              ? 503
              : result.error === "timeout"
                ? 504
                : result.error === "image_too_large"
                  ? 413
                  : 502;
          return res
            .status(status)
            .json({ success: false, error: result.error, detail: result.detail });
        }
        res.json({
          success: true,
          analysis: result.analysis,
          recipe: result.recipe,
          usage: result.usage,
          personalised: Boolean(userPreferenceSummary),
        });
      } catch (error) {
        console.error("[photo-enhancer] suggest-recipe failed:", error);
        res
          .status(500)
          .json({ success: false, error: "suggest_recipe_failed" });
      }
    },
  );

  // POST /detect-distractions — Auto-detect stray studio equipment.
  // Hands a JPEG/PNG/WebP to Claude Vision; gets back a list of bbox
  // detections (flash heads, cables, stands, modifiers, tape, sensor
  // dust). The web UI shows these as toggleable thumbnails; the iPad
  // Capture surface auto-applies high-confidence ones. Selected
  // detections then collapse into a combined mask that goes into
  // /inpaint.
  router.post(
    "/detect-distractions",
    photoEnhancerUpload.single("image"),
    async (req, res) => {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "image_required" });
      }
      const mime = String(req.file.mimetype || "").toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
        return res
          .status(415)
          .json({ success: false, error: "unsupported_mime" });
      }
      try {
        const meta = await (await import("sharp")).default(req.file.buffer).metadata();
        const width = meta.width ?? 0;
        const height = meta.height ?? 0;
        if (!width || !height) {
          return res
            .status(400)
            .json({ success: false, error: "image_dimensions_unreadable" });
        }
        const result = await detectDistractions({
          imageBase64: req.file.buffer.toString("base64"),
          imageMime: mime as "image/jpeg" | "image/png" | "image/webp",
          width,
          height,
        });
        if (!result.ok) {
          const status =
            result.error === "not_configured"
              ? 503
              : result.error === "timeout"
                ? 504
                : result.error === "image_too_large"
                  ? 413
                  : 502;
          return res.status(status).json({
            success: false,
            error: result.error,
            detail: result.detail,
          });
        }
        res.json({
          success: true,
          detections: result.analysis.detections,
          rationale: result.analysis.rationale,
          usage: result.usage,
        });
      } catch (error) {
        console.error("[photo-enhancer] detect-distractions failed:", error);
        res.status(500).json({
          success: false,
          error: "detect_failed",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // POST /inpaint — Object-removal endpoint. Accepts an image + a mask
  // (white = remove). Calls Claude Vision to plan the fill, then runs
  // the deterministic executor (patch_clone via sharp / Telea-NS via
  // OpenCV.js). Returns the inpainted image base64-encoded plus the
  // recipe Claude returned so the UI can show warnings + strategy.
  //
  // Body (multipart):
  //   image       — JPEG/PNG/WebP source.
  //   mask        — PNG mask, same dimensions, white = remove.
  //   intensity   — optional [0,1] blend (default 1.0).
  //   skipPlanner — optional "1" to bypass Claude (executor uses a
  //                 default patch_clone recipe). Useful for tests and
  //                 when ANTHROPIC_API_KEY is unset.
  router.post(
    "/inpaint",
    photoEnhancerUpload.fields([
      { name: "image", maxCount: 1 },
      { name: "mask", maxCount: 1 },
    ]),
    async (req, res) => {
      const files = req.files as
        | { image?: Express.Multer.File[]; mask?: Express.Multer.File[] }
        | undefined;
      const imageFile = files?.image?.[0];
      const maskFile = files?.mask?.[0];

      if (!imageFile) {
        return res.status(400).json({ success: false, error: "image_required" });
      }
      if (!maskFile) {
        return res.status(400).json({ success: false, error: "mask_required" });
      }
      const imageMime = String(imageFile.mimetype || "").toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp"].includes(imageMime)) {
        return res.status(415).json({ success: false, error: "unsupported_image_mime" });
      }
      const maskMime = String(maskFile.mimetype || "").toLowerCase();
      if (maskMime !== "image/png") {
        return res.status(415).json({ success: false, error: "mask_must_be_png" });
      }

      const intensityRaw = readNumber((req.body as Record<string, unknown> | undefined)?.intensity);
      const intensity = intensityRaw === null ? 1 : Math.max(0, Math.min(1, intensityRaw));
      const skipPlanner =
        readString((req.body as Record<string, unknown> | undefined)?.skipPlanner) === "1";

      try {
        // Read image dimensions for the planner + executor sanity check.
        const meta = await (await import("sharp")).default(imageFile.buffer).metadata();
        const width = meta.width ?? 0;
        const height = meta.height ?? 0;
        if (!width || !height) {
          return res.status(400).json({ success: false, error: "image_dimensions_unreadable" });
        }

        // Plan the fill. Either ask Claude or fall back to a vanilla
        // patch_clone recipe so the executor still has something to do.
        let recipe: InpaintRecipeRecommendation;
        let plannerUsage:
          | {
              input_tokens: number;
              output_tokens: number;
              cache_creation_input_tokens: number;
              cache_read_input_tokens: number;
            }
          | null = null;

        if (skipPlanner) {
          recipe = {
            strategy: "patch_clone",
            radiusPx: 0,
            featherPx: 16,
            sourceRegions: [],
            avoidRegions: [],
            postFreqSepSkin: false,
            warnings: [],
            rationale: "skipPlanner=1 — vanilla patch_clone fra synthesised donor.",
          };
        } else {
          const plannerResult = await suggestInpaintRecipe({
            imageBase64: imageFile.buffer.toString("base64"),
            imageMime: imageMime as "image/jpeg" | "image/png" | "image/webp",
            maskPngBase64: maskFile.buffer.toString("base64"),
            width,
            height,
          });
          if (!plannerResult.ok) {
            const status =
              plannerResult.error === "not_configured"
                ? 503
                : plannerResult.error === "timeout"
                  ? 504
                  : plannerResult.error === "image_too_large"
                    ? 413
                    : 502;
            return res.status(status).json({
              success: false,
              error: plannerResult.error,
              detail: plannerResult.detail,
            });
          }
          recipe = plannerResult.recipe;
          plannerUsage = plannerResult.usage;
        }

        const result = await executeInpaint({
          imageBuffer: imageFile.buffer,
          maskBuffer: maskFile.buffer,
          recipe,
          intensity,
          outputMime: "image/jpeg",
        });

        res.json({
          success: true,
          imageBase64: result.buffer.toString("base64"),
          imageMime: "image/jpeg",
          recipe,
          strategyUsed: result.strategyUsed,
          maskBounds: result.maskBounds,
          executorWarnings: result.warnings,
          plannerUsage,
        });
      } catch (error) {
        console.error("[photo-enhancer] inpaint failed:", error);
        res.status(500).json({
          success: false,
          error: "inpaint_failed",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // POST /feedback — Records the diff between the AI-suggested recipe
  // and the recipe the photographer actually enhanced with. Aggregated
  // by photo-enhancer-feedback-service into per-user drift summaries
  // that feed back into Claude's next suggestion call.
  //
  // Body: { suggested: Recipe, final: Recipe, userId? }
  // Response: { success: true, id }
  //
  // Both recipes are trusted enough to log (they're bounded by the
  // sanitiser in the suggest route and clampNumber on enhance); diff
  // is computed server-side to avoid letting the client poison the
  // log with arbitrary key/value pairs.
  router.post("/feedback", async (req, res) => {
    if (!pool) {
      return res
        .status(503)
        .json({ success: false, error: "feedback_not_configured" });
    }
    const body = req.body as Record<string, unknown> | undefined;
    const userId =
      readString(body?.userId) ||
      readString(req.headers["x-user-id"]) ||
      null;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: "userId_required" });
    }
    const suggested = body?.suggested;
    const final = body?.final;
    if (!suggested || typeof suggested !== "object" || !final || typeof final !== "object") {
      return res
        .status(400)
        .json({ success: false, error: "suggested_and_final_required" });
    }
    try {
      const { id } = await logRecipeFeedback(
        pool,
        userId,
        suggested as PhotoEnhancerRecipe,
        final as PhotoEnhancerRecipe,
      );
      res.json({ success: true, id });
    } catch (error) {
      console.error("[photo-enhancer] feedback log failed:", error);
      res
        .status(500)
        .json({ success: false, error: "feedback_log_failed" });
    }
  });

  router.post(
    "/enhance",
    photoEnhancerUpload.single("image"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "image_required" });
      }

      try {
        const startedAt = Date.now();
        const preset = readString(req.body?.preset) || "auto";
        const settings = normalizeSettings(req.body?.settings, preset);
        const enhancementResult = await buildPhotoEnhancerEnhancementPayload({
          file: req.file,
          preset,
          settings,
        });

        if (!enhancementResult.ok) {
          trackPhotoEnhancerEvent({
            route: "enhance",
            success: false,
            fileName: req.file.originalname,
            sourceExtension: getUploadExtension(req.file),
            sourceMimeType: req.file.mimetype,
            raw: Boolean(enhancementResult.prepared.raw.raw),
            heic: Boolean(enhancementResult.prepared.raw.heic),
            rawConverter: null,
            preset,
            processingMs: Date.now() - startedAt,
            error: conversionErrorMessage(enhancementResult.raw),
          });
          return res.status(enhancementResult.status).json({
            success: false,
            error: enhancementResult.error,
            raw: enhancementResult.raw,
            rawSupport: enhancementResult.rawSupport,
          });
        }

        const processingMs = Date.now() - startedAt;
        res.json({
          ...enhancementResult.payload,
          processingMs,
          rawConverter: readString(enhancementResult.prepared.raw.converter),
          lensCorrectionApplied: Boolean(enhancementResult.prepared.raw.lensCorrectionApplied),
          conversionErrors: enhancementResult.prepared.raw.attemptErrors ?? null,
        });
        trackPhotoEnhancerEvent({
          route: "enhance",
          success: true,
          fileName: req.file.originalname,
          sourceExtension: getUploadExtension(req.file),
          sourceMimeType: req.file.mimetype,
          raw: Boolean(enhancementResult.prepared.raw.raw),
          heic: Boolean(enhancementResult.prepared.raw.heic),
          rawConverter: readString(enhancementResult.prepared.raw.converter),
          preset,
          modelUsed: enhancementResult.modelUsed,
          inferenceMode: enhancementResult.inferenceMode,
          processingMs,
          outputMimeType: enhancementResult.outputMimeType,
        });
      } catch (error) {
        console.error("[photo-enhancer] enhance failed:", error);
        trackPhotoEnhancerEvent({
          route: "enhance",
          success: false,
          fileName: req.file.originalname,
          sourceExtension: getUploadExtension(req.file),
          sourceMimeType: req.file.mimetype,
          raw: isCameraRawFile(req.file),
          heic: isHeicFile(req.file),
          preset: readString(req.body?.preset) || "auto",
          processingMs: 0,
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ success: false, error: "photo_enhance_failed" });
      }
    },
  );

  router.post("/save", async (req, res) => {
    try {
      const body = parseJsonObject(req.body);
      const projectId = readString(body.projectId);
      const folderId = readString(body.folderId);
      const enhancedImageUrl = readString(body.enhancedImageUrl);
      const preset = readString(body.preset) || "auto";
      const settings = normalizeSettings(body.settings, preset);
      if (!projectId || !enhancedImageUrl) {
        return res.status(400).json({
          success: false,
          error: "project_id_and_enhanced_image_required",
        });
      }

      const decoded = dataUrlToBuffer(enhancedImageUrl);
      if (!decoded) {
        return res.status(201).json({
          success: true,
          saved: true,
          file: {
            id: crypto.randomUUID(),
            projectId,
            folderId,
            preset,
            settings,
            externalUrl: enhancedImageUrl,
            createdAt: new Date().toISOString(),
          },
        });
      }

      const fileRecord = await persistEnhancedBuffer({
        projectId,
        folderId,
        buffer: decoded.buffer,
        mimeType: decoded.mimeType,
        preset,
        settings,
      });

      res.status(201).json({
        success: true,
        saved: true,
        file: toPublicSavedFile(fileRecord),
      });
    } catch (error) {
      console.error("[photo-enhancer] save failed:", error);
      res.status(500).json({ success: false, error: "photo_save_failed" });
    }
  });

  router.get("/files/:fileId/download", async (req, res) => {
    const manifest = await readPhotoEnhancerManifest();
    const record = manifest.find((item) => item.id === req.params.fileId);
    if (!record || !existsSync(record.storagePath)) {
      return res.status(404).json({ success: false, error: "file_not_found" });
    }

    res.setHeader("Content-Type", record.mimeType);
    res.download(record.storagePath, record.name);
  });

  return router;
}

function normalizeCompatEnhancementType(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized === "face_restore") return "face_restore";
  if (normalized === "denoise") return "denoise";
  if (normalized === "colorize") return "colorize";
  if (normalized === "batch") return "batch";
  return "upscale,";
}

function toCompatJob(record: PhotoEnhancerSavedFile) {
  return {
    id: record.id,
    filename: record.name,
    originalSize: record.size,
    originalUrl: record.downloadUrl,
    enhancedUrl: record.downloadUrl,
    enhancementType: "batch",
    status: "completed",
    progress: 10,
    startedAt: record.createdAt,
    completedAt: record.createdAt,
    processingTime: 0,
    qualityMetrics: {
      psnr: 0,
      ssim: 0,
      lpips: 0,
      originalResolution: "unknown",
      enhancedResolution: "unknown",
    },
  };
}

export function createPhotoEnhancementCompatRouter() {
  const router = express.Router();

  router.get("/presets", (_req, res) => {
    res.json({
      presets: Object.entries(presetSettings).map(([id, settings]) => ({
        id,
        name: id.replace(/-/gu, " "),
        settings: {
          ...defaultSettings,
          ...settings,
        },
      })),
    });
  });

  router.get("/jobs", async (req, res) => {
    const projectId = readString(req.query.projectId);
    const manifest = await readPhotoEnhancerManifest();
    res.json(
      manifest
        .filter((record) => !projectId || record.projectId === projectId)
        .slice(-100)
        .reverse()
        .map(toCompatJob),
    );
  });

  router.get("/telemetry", async (_req, res) => {
    const [models, runtimeSupport] = await Promise.all([
      resolvePhotoEnhancerModelStatuses(),
      resolveRuntimeSupport(),
    ]);
    const availableModels = models.filter((model) => model.available).length;
    const observability = summarizePhotoEnhancerTelemetry();
    res.json({
      gpuUsage: 0,
      memoryUsage: "runtime-managed",
      processingSpeed:
        models.some((model) => model.id === "gfpgan" && model.inferenceAvailable)
          ? "gfpgan-service"
          : availableModels > 0
            ? "model-ready"
            : "sharp-fallback",
      totalJobsCompleted: (await readPhotoEnhancerManifest()).length,
      avgProcessingTime:
        observability.processingTimeMs.average === null
          ? "Ingen jobber ennå"
          : `${observability.processingTimeMs.average} ms`,
      qualityImprovement: "tracked",
      models: {
        available: availableModels,
        total: models.length,
        inferenceAvailable: models.filter((model) => model.inferenceAvailable).length,
        registry: models,
      },
      raw: runtimeSupport.raw,
      metadata: runtimeSupport.metadata,
      observability,
    });
  });

  router.get("/quality-comparison/:jobId", async (req, res) => {
    const manifest = await readPhotoEnhancerManifest();
    const record = manifest.find((item) => item.id === req.params.jobId);
    if (!record) {
      return res.status(404).json({ error: "job_not_found" });
    }
    res.json({
      originalMetrics: {
        resolution: "unknown",
        fileSize: record.size,
        sharpness: record.settings.sharpness,
        noise: 100 - record.settings.denoising,
        colorBalance: record.settings.saturation,
      },
      enhancedMetrics: {
        resolution: "stored",
        fileSize: record.size,
        sharpness: record.settings.sharpness,
        noise: record.settings.denoising,
        colorBalance: record.settings.saturation,
        improvementScore: Math.min(
          100,
          Math.max(1, record.settings.sharpness + record.settings.denoising),
        ),
      },
    });
  });

  router.post("/start", photoEnhancerUpload.array("files", 30), async (req, res) => {
    const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
    if (files.length === 0) {
      return res.status(400).json({ error: "files_required" });
    }

    const options = parseJsonObject(req.body?.options);
    const enhancementType = normalizeCompatEnhancementType(req.body?.enhancementType);
    const preset =
      enhancementType === "face_restore"
        ? "portrait"
        : readString(options.presetId) || readString(options.preset) || "auto";
    const settings = normalizeSettings(
      {
        brightness: options.brightness,
        contrast: options.contrast,
        saturation: options.saturation,
        sharpness: options.sharpness,
        denoising:
          readNumber(options.denoiseStrength) !== null
            ? Math.round((readNumber(options.denoiseStrength) || 0) * 100)
            : options.denoising,
        faceEnhancement:
          enhancementType === "face_restore" || options.faceEnhance === true
            ? 85
            : options.faceEnhancement,
      },
      preset,
    );
    const projectId = readString(req.body?.projectId) || "photo-enhancer";
    const folderId = readString(options.googleDriveFolderId);
    const startedAt = Date.now();

    const jobs = [];
    for (const file of files) {
      const jobStartedAt = new Date().toISOString();
      const jobStartedMs = Date.now();
      try {
        // The compat router doesn't have a shared pool in scope, so user-
        // LUT inline resolution is only available through the primary
        // router path. Built-in LUTs work fine here.
        const output = await enhanceUploadedFile({ file, preset, settings });
        const record = await persistEnhancedBuffer({
          projectId,
          folderId,
          buffer: output.buffer,
          mimeType: output.mimeType,
          preset,
          settings,
          namePrefix: "photo-enhancement",
        });
        jobs.push({
          ...toCompatJob(record),
          filename: file.originalname,
          enhancementType,
          startedAt: jobStartedAt,
          completedAt: new Date().toISOString(),
          processingTime: Math.round((Date.now() - startedAt) / 1000),
          modelUsed: output.modelUsed,
          inferenceMode: output.inferenceMode,
          raw: output.raw,
          metadata: output.metadata,
        });
        trackPhotoEnhancerEvent({
          route: "batch",
          success: true,
          fileName: file.originalname,
          sourceExtension: getUploadExtension(file),
          sourceMimeType: file.mimetype,
          raw: Boolean(output.raw.raw),
          heic: Boolean(output.raw.heic),
          rawConverter: readString(output.raw.converter),
          preset,
          modelUsed: output.modelUsed,
          inferenceMode: output.inferenceMode,
          processingMs: Date.now() - jobStartedMs,
          outputMimeType: output.mimeType,
        });
      } catch (error) {
        jobs.push({
          id: crypto.randomUUID(),
          filename: file.originalname,
          originalSize: file.size,
          originalUrl: "",
          enhancedUrl: undefined,
          enhancementType,
          status: "error",
          progress: 0,
          startedAt: jobStartedAt,
          completedAt: new Date().toISOString(),
          processingTime: Math.round((Date.now() - startedAt) / 1000),
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        trackPhotoEnhancerEvent({
          route: "batch",
          success: false,
          fileName: file.originalname,
          sourceExtension: getUploadExtension(file),
          sourceMimeType: file.mimetype,
          raw: isCameraRawFile(file),
          heic: isHeicFile(file),
          preset,
          processingMs: Date.now() - jobStartedMs,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    res.status(201).json({
      success: true,
      jobs,
      count: jobs.length,
      googleDrive: {
        requested: Boolean(options.googleDriveUpload),
        folderId,
        folderStructure: PHOTO_ENHANCER_DRIVE_STRUCTURE,
        folderNames: getPhotoEnhancerDriveFolderNames(),
      },
      observability: summarizePhotoEnhancerTelemetry(),
    });
  });

  router.post("/cancel/:jobId", (req, res) => {
    res.json({ success: true, cancelled: true, jobId: req.params.jobId });
  });

  router.get("/download/:jobId", (req, res) => {
    res.redirect(302, `/api/photo-enhancer/files/${encodeURIComponent(req.params.jobId)}/download`);
  });

  return router;
}
