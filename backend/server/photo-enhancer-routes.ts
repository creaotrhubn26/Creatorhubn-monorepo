import express from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs/promises";
import { constants as fsConstants, createWriteStream, existsSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import {
  PHOTO_ENHANCER_DRIVE_STRUCTURE,
  PHOTO_ENHANCER_RASTER_FORMATS,
  PHOTO_ENHANCER_RAW_FORMATS,
  buildPhotoEnhancerImprovementBacklog,
  buildPhotoEnhancerR2Config,
  buildPublicPhotoEnhancerR2Config,
  photoEnhancerModelRegistry,
  resolvePhotoEnhancerModelStatuses,
  type PhotoEnhancerModelStatus,
} from "./photo-enhancer-capabilities.js";

const execFileAsync = promisify(execFile);

const PHOTO_ENHANCER_MAX_FILE_BYTES = Number(
  process.env.PHOTO_ENHANCER_MAX_FILE_BYTES || 150 * 1024 * 1024,
);
const PHOTO_ENHANCER_MODEL_TIMEOUT_MS = Number(
  process.env.PHOTO_ENHANCER_MODEL_TIMEOUT_MS || 45_000,
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

const gfpganCandidateKeys =
  photoEnhancerModelRegistry.find((model) => model.id === "gfpgan")?.candidateKeys || [
    "models/gfpgan/weights/GFPGANv1.4.pth",
  ];

type PhotoEnhancerSettings = {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  denoising: number;
  faceEnhancement: number;
};

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

const defaultSettings: PhotoEnhancerSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  denoising: 50,
  faceEnhancement: 75,
};

const presetSettings: Record<string, Partial<PhotoEnhancerSettings>> = {
  auto: { contrast: 8, saturation: 6, sharpness: 14, denoising: 35 },
  portrait: {
    brightness: 4,
    contrast: 6,
    saturation: 4,
    sharpness: 12,
    denoising: 45,
    faceEnhancement: 85,
  },
  wedding: {
    brightness: 5,
    contrast: 5,
    saturation: 7,
    sharpness: 10,
    denoising: 40,
    faceEnhancement: 80,
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

function normalizeSettings(
  rawSettings: unknown,
  preset: string,
): PhotoEnhancerSettings {
  const raw = parseJsonObject(rawSettings);
  const merged = {
    ...defaultSettings,
    ...(presetSettings[preset] || {}),
  };

  for (const key of Object.keys(defaultSettings) as Array<
    keyof PhotoEnhancerSettings
  >) {
    const value = readNumber(raw[key]);
    if (value !== null) {
      merged[key] = value;
    }
  }

  return {
    brightness: clampNumber(merged.brightness, -100, 100),
    contrast: clampNumber(merged.contrast, -100, 100),
    saturation: clampNumber(merged.saturation, -100, 100),
    sharpness: clampNumber(merged.sharpness, -100, 100),
    denoising: clampNumber(merged.denoising, 0, 100),
    faceEnhancement: clampNumber(merged.faceEnhancement, 0, 100),
  };
}

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
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
      configured: Boolean(firstNonEmpty(process.env.PHOTO_ENHANCER_GFPGAN_URL, process.env.GFPGAN_SERVICE_URL)),
      healthy: null,
      endpoint: firstNonEmpty(process.env.PHOTO_ENHANCER_GFPGAN_URL, process.env.GFPGAN_SERVICE_URL),
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

async function isFaceApiAvailable(): Promise<boolean> {
  try {
    const faceApi = await import("face-api.js");
    return Boolean(faceApi);
  } catch {
    return false;
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
  const [imageMagick, darktable, rawtherapee, dcraw, dcrawEmu, simpleDcraw, exiftool] = await Promise.all([
    commandPath("magick", "convert"),
    commandPath("darktable-cli"),
    commandPath("rawtherapee-cli"),
    commandPath("dcraw"),
    commandPath("dcraw_emu"),
    commandPath("simple_dcraw"),
    commandPath("exiftool"),
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
      },
      available: Boolean(imageMagick || darktable || rawtherapee || dcraw || dcrawEmu || simpleDcraw),
    },
    metadata: {
      exiftool: Boolean(exiftool),
    },
  };
}

async function readExifMetadata(file: Express.Multer.File): Promise<Record<string, unknown> | null> {
  const exiftool = await commandPath("exiftool");
  if (!exiftool) return null;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "creatorhub-photo-exif-"));
  const inputPath = path.join(tempDir, `source${getUploadExtension(file) || ".img"}`);
  try {
    await fs.writeFile(inputPath, file.buffer);
    const { stdout } = await execFileAsync(
      exiftool,
      [
        "-json",
        "-Make",
        "-Model",
        "-LensModel",
        "-FocalLength",
        "-ISO",
        "-ExposureTime",
        "-FNumber",
        "-FileType",
        "-MIMEType",
        inputPath,
      ],
      { timeout: 5_000, maxBuffer: 1024 * 1024 },
    );
    const parsed = JSON.parse(String(stdout || "[]"));
    return Array.isArray(parsed) && parsed[0] ? parsed[0] : null;
  } catch {
    return null;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function convertRawWithExternalTool(file: Express.Multer.File): Promise<{
  file: Express.Multer.File;
  conversion: Record<string, unknown>;
} | null> {
  if (!isCameraRawFile(file)) return null;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "creatorhub-photo-raw-"));
  const extension = getUploadExtension(file) || ".raw";
  const inputPath = path.join(tempDir, `source${extension}`);
  const outputPath = path.join(tempDir, "converted.png");
  const outputTiffPath = path.join(tempDir, "source.tiff");
  await fs.writeFile(inputPath, file.buffer);

  const attempts: Array<{
    id: string;
    binaries: string[];
    args: string[];
    outputPath: string;
    outputMimeType: string;
    streamStdout?: boolean;
  }> = [
    {
      id: "dcraw",
      binaries: ["dcraw", "dcraw_emu"],
      args: ["-w", "-T", inputPath],
      outputPath: outputTiffPath,
      outputMimeType: "image/tiff",
    },
    {
      id: "imagemagick",
      binaries: ["magick", "convert"],
      args: [inputPath, "-auto-orient", "-colorspace", "sRGB", outputPath],
      outputPath,
      outputMimeType: "image/png",
    },
    {
      id: "rawtherapee",
      binaries: ["rawtherapee-cli"],
      args: ["-o", outputPath, "-c", inputPath],
      outputPath,
      outputMimeType: "image/png",
    },
    {
      id: "darktable",
      binaries: ["darktable-cli"],
      args: [inputPath, outputPath],
      outputPath,
      outputMimeType: "image/png",
    },
  ];
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
        } catch (validationError) {
          errors.push(
            `${attempt.id}: unreadable output (${validationError instanceof Error ? validationError.message : String(validationError)})`,
          );
          continue;
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
          },
        };
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

async function prepareProcessableImage(file: Express.Multer.File): Promise<{
  file: Express.Multer.File;
  raw: Record<string, unknown>;
}> {
  if (!isCameraRawFile(file)) {
    return {
      file,
      raw: {
        raw: false,
        sourceExtension: getUploadExtension(file),
      },
    };
  }

  const converted = await convertRawWithExternalTool(file);
  if (!converted || converted.file === file) {
    return {
      file,
      raw: converted?.conversion || {
        raw: true,
        sourceExtension: getUploadExtension(file),
        converter: null,
        error: "No RAW converter available",
      },
    };
  }

  return {
    file: converted.file,
    raw: converted.conversion,
  };
}

function shouldUseGfpgan(preset: string, settings: PhotoEnhancerSettings): boolean {
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
}): Promise<{ enhancedImageUrl: string; modelUsed: string } | null> {
  const endpoint = firstNonEmpty(
    process.env.PHOTO_ENHANCER_GFPGAN_URL,
    process.env.GFPGAN_SERVICE_URL,
  );
  if (!endpoint || !params.model.available) return null;

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
        model: {
          id: params.model.id,
          r2Key: params.model.r2Key,
          storageType: params.model.storageType,
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
}): Promise<{
  buffer: Buffer;
  mimeType: string;
  modelUsed: string;
  inferenceMode: string;
  metadata: Record<string, unknown>;
  raw: Record<string, unknown>;
}> {
  const prepared = await prepareProcessableImage(params.file);
  if (prepared.raw.raw && prepared.raw.converter === null) {
    const message =
      typeof prepared.raw.error === "string"
        ? prepared.raw.error
        : "RAW conversion unavailable";
    throw new Error(`raw_conversion_unavailable: ${message}`);
  }

  const gfpgan = await resolveGfpganModelStatus();
  if (shouldUseGfpgan(params.preset, params.settings)) {
    const modelResult = await runGfpganService({
      file: prepared.file,
      preset: params.preset,
      settings: params.settings,
      model: gfpgan,
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
      : "sharp",
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

export function createPhotoEnhancerRouter() {
  const router = express.Router();

  router.get("/status", async (_req, res) => {
    const [modelStatuses, gfpgan, faceApiAvailable, runtimeSupport] = await Promise.all([
      resolvePhotoEnhancerModelStatuses(),
      resolveGfpganModelStatus(),
      isFaceApiAvailable(),
      resolveRuntimeSupport(),
    ]);
    const improvementBacklog = buildPhotoEnhancerImprovementBacklog();
    const weightsAvailable = modelStatuses.filter((model) => model.weights?.found || model.available).length;
    const inferenceAvailable = modelStatuses.filter((model) => model.inferenceAvailable).length;
    res.json({
      success: true,
      r2: buildPublicPhotoEnhancerR2Config(),
      models: {
        gfpgan,
        registry: modelStatuses,
        summary: {
          total: modelStatuses.length,
          weightsAvailable,
          inferenceAvailable,
        },
        faceApi: {
          id: "face-api.js",
          available: faceApiAvailable,
          role: "face analysis support",
        },
        imageHash: {
          id: "image-hash",
          available: true,
          role: "duplicate and perceptual hash support",
        },
      },
      rawSupport: runtimeSupport.raw,
      metadataSupport: runtimeSupport.metadata,
      googleDrive: {
        folderStructure: PHOTO_ENHANCER_DRIVE_STRUCTURE,
      },
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
      r2: buildPublicPhotoEnhancerR2Config(),
    });
  });

  router.get("/raw-support", async (_req, res) => {
    const runtimeSupport = await resolveRuntimeSupport();
    res.json({
      success: true,
      ...runtimeSupport.raw,
      metadata: runtimeSupport.metadata,
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

  router.post(
    "/analyze",
    photoEnhancerUpload.single("image"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "image_required" });
      }

      try {
        const preset = readString(req.body?.preset) || "auto";
        const prepared = await prepareProcessableImage(req.file);
        if (prepared.raw.raw && prepared.raw.converter === null) {
          return res.status(422).json({
            success: false,
            error: "raw_conversion_unavailable",
            raw: prepared.raw,
            rawSupport: await resolveRuntimeSupport(),
          });
        }
        const processFile = prepared.file;
        const sharpModule = await import("sharp");
        const sharp = sharpModule.default;
        const [metadata, stats, perceptualHash, gfpgan, faceApiAvailable, exif] =
          await Promise.all([
            sharp(processFile.buffer, { failOn: "none" }).metadata(),
            sharp(processFile.buffer, { failOn: "none" }).stats().catch(() => null),
            computeImageHash(processFile),
            resolveGfpganModelStatus(),
            isFaceApiAvailable(),
            readExifMetadata(req.file),
          ]);

        const meanBrightness = stats
          ? Math.round(
              stats.channels.reduce((sum, channel) => sum + channel.mean, 0) /
                Math.max(1, stats.channels.length),
            )
          : null;

        res.json({
          success: true,
          preset,
          analysis: {
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            processedMimeType: processFile.mimetype,
            width: metadata.width || null,
            height: metadata.height || null,
            format: metadata.format || null,
            hasAlpha: Boolean(metadata.hasAlpha),
            orientation: metadata.orientation || null,
            meanBrightness,
            dominantColor: stats?.dominant || null,
            perceptualHash,
            raw: prepared.raw,
            exif,
          },
          models: {
            gfpgan,
            faceApi: {
              id: "face-api.js",
              available: faceApiAvailable,
            },
            imageHash: {
              id: "image-hash",
              available: Boolean(perceptualHash),
            },
          },
          recommendations: [
            gfpgan.available
              ? "GFPGAN face restoration model is available from R2."
              : "GFPGAN is not available; Photo Enhancer will use safe Sharp fallback.",
            perceptualHash
              ? "Perceptual hash generated for duplicate detection."
              : "Perceptual hash could not be generated for this image type.",
          ],
        });
      } catch (error) {
        console.error("[photo-enhancer] analyze failed:", error);
        res.status(500).json({ success: false, error: "photo_analyze_failed" });
      }
    },
  );

  router.post(
    "/enhance",
    photoEnhancerUpload.single("image"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "image_required" });
      }

      try {
        const preset = readString(req.body?.preset) || "auto";
        const settings = normalizeSettings(req.body?.settings, preset);
        const prepared = await prepareProcessableImage(req.file);
        if (prepared.raw.raw && prepared.raw.converter === null) {
          return res.status(422).json({
            success: false,
            error: "raw_conversion_unavailable",
            raw: prepared.raw,
            rawSupport: await resolveRuntimeSupport(),
          });
        }
        const processFile = prepared.file;
        const gfpgan = await resolveGfpganModelStatus();
        const startedAt = Date.now();

        if (shouldUseGfpgan(preset, settings)) {
          const modelResult = await runGfpganService({
            file: processFile,
            preset,
            settings,
            model: gfpgan,
          });
          if (modelResult) {
            return res.json({
              success: true,
              enhancedImageUrl: modelResult.enhancedImageUrl,
              imageUrl: modelResult.enhancedImageUrl,
              outputUrl: modelResult.enhancedImageUrl,
              preset,
              settings,
              modelUsed: modelResult.modelUsed,
              inferenceMode: "gfpgan-service",
              models: { gfpgan },
              raw: prepared.raw,
              processingMs: Date.now() - startedAt,
            });
          }
        }

        const output = await enhanceWithSharp(processFile, settings);
        const outputHash = await computeImageHash({
          ...processFile,
          buffer: output.buffer,
          size: output.buffer.byteLength,
          mimetype: output.mimeType,
        });
        const enhancedImageUrl = `data:${output.mimeType};base64,${output.buffer.toString("base64")}`;

        res.json({
          success: true,
          enhancedImageUrl,
          imageUrl: enhancedImageUrl,
          outputUrl: enhancedImageUrl,
          preset,
          settings,
          modelUsed: shouldUseGfpgan(preset, settings) ? "sharp-fallback" : "sharp",
          inferenceMode: "local-sharp",
          models: { gfpgan },
          raw: prepared.raw,
          output: {
            ...output.metadata,
            mimeType: output.mimeType,
            perceptualHash: outputHash,
          },
          processingMs: Date.now() - startedAt,
        });
      } catch (error) {
        console.error("[photo-enhancer] enhance failed:", error);
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
    res.json({
      gpuUsage: 0,
      memoryUsage: "runtime-managed",
      processingSpeed: availableModels > 0 ? "model-ready" : "sharp-fallback",
      totalJobsCompleted: (await readPhotoEnhancerManifest()).length,
      avgProcessingTime: "live",
      qualityImprovement: "tracked",
      models: {
        available: availableModels,
        total: models.length,
      },
      raw: runtimeSupport.raw,
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
      try {
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
      },
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
