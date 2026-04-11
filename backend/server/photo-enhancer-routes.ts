import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import express from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const PHOTO_ENHANCER_MAX_FILE_BYTES = 40 * 1024 * 1024;
const PHOTO_ENHANCER_MODEL_TIMEOUT_MS = Number(
  process.env.PHOTO_ENHANCER_MODEL_TIMEOUT_MS || 45_000,
);

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const projectFileStorageRoot = path.join(repoRoot, "uploads", "project-files");
const photoEnhancerStorageRoot = path.join(repoRoot, "uploads", "photo-enhancer");
const photoEnhancerManifestPath = path.join(
  photoEnhancerStorageRoot,
  "manifest.json",
);

const gfpganCandidateKeys = [
  "models/gfpgan/weights/GFPGANv1.4.pth",
  "models/gfpgan/weights/GFPGANv1.3.pth",
  "models/gfpgan/weights/GFPGANv1.2.pth",
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

const photoEnhancerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PHOTO_ENHANCER_MAX_FILE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    const mimetype = String(file.mimetype || "").toLowerCase();
    if (mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image uploads are supported by Photo Enhancer."));
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

function buildR2Config() {
  const accountId = firstNonEmpty(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    process.env.R2_ACCOUNT_ID,
  );
  const endpoint = firstNonEmpty(
    process.env.CLOUDFLARE_R2_ENDPOINT,
    accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
  );
  const bucket = firstNonEmpty(
    process.env.CLOUDFLARE_R2_MODELS_BUCKET,
    process.env.CLOUDFLARE_R2_BUCKET,
    process.env.R2_BUCKET,
  );
  const accessKeyId = firstNonEmpty(
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    process.env.R2_ACCESS_KEY_ID,
  );
  const secretAccessKey = firstNonEmpty(
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    process.env.R2_SECRET_ACCESS_KEY,
  );

  return {
    enabled: Boolean(endpoint && bucket && accessKeyId && secretAccessKey),
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}

async function resolveGfpganModelStatus() {
  const r2 = buildR2Config();
  const baseModel = {
    id: "gfpgan",
    modelType: "gfpgan",
    storageType: "r2",
    r2Key: gfpganCandidateKeys[0],
    candidateKeys: gfpganCandidateKeys,
    description: "GFPGAN face restoration model",
  };

  if (!r2.enabled) {
    return {
      ...baseModel,
      available: false,
      reason: "R2 model credentials are not configured",
      r2: {
        enabled: false,
        endpoint: r2.endpoint,
        bucket: r2.bucket,
      },
    };
  }

  const client = new S3Client({
    region: "auto",
    endpoint: r2.endpoint || undefined,
    credentials: {
      accessKeyId: r2.accessKeyId || "",
      secretAccessKey: r2.secretAccessKey || "",
    },
  });

  for (const key of gfpganCandidateKeys) {
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: r2.bucket || "",
          Key: key,
        }),
      );
      return {
        ...baseModel,
        r2Key: key,
        available: true,
        reason: null,
        r2: {
          enabled: true,
          endpoint: r2.endpoint,
          bucket: r2.bucket,
        },
      };
    } catch {
      // Continue checking older GFPGAN weights before reporting unavailable.
    }
  }

  return {
    ...baseModel,
    available: false,
    reason: "GFPGAN weights were not found in configured R2 bucket",
    r2: {
      enabled: true,
      endpoint: r2.endpoint,
      bucket: r2.bucket,
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
    process.env.PHOTO_ENHANCER_GFPAGAN_URL,
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

export function createPhotoEnhancerRouter() {
  const router = express.Router();

  router.get("/status", async (_req, res) => {
    const [gfpgan, faceApiAvailable] = await Promise.all([
      resolveGfpganModelStatus(),
      isFaceApiAvailable(),
    ]);
    res.json({
      success: true,
      models: {
        gfpgan,
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
        const sharpModule = await import("sharp");
        const sharp = sharpModule.default;
        const [metadata, stats, perceptualHash, gfpgan, faceApiAvailable] =
          await Promise.all([
            sharp(req.file.buffer, { failOn: "none" }).metadata(),
            sharp(req.file.buffer, { failOn: "none" }).stats().catch(() => null),
            computeImageHash(req.file),
            resolveGfpganModelStatus(),
            isFaceApiAvailable(),
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
            width: metadata.width || null,
            height: metadata.height || null,
            format: metadata.format || null,
            hasAlpha: Boolean(metadata.hasAlpha),
            orientation: metadata.orientation || null,
            meanBrightness,
            dominantColor: stats?.dominant || null,
            perceptualHash,
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
        const gfpgan = await resolveGfpganModelStatus();
        const startedAt = Date.now();

        if (shouldUseGfpgan(preset, settings)) {
          const modelResult = await runGfpganService({
            file: req.file,
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
              processingMs: Date.now() - startedAt,
            });
          }
        }

        const output = await enhanceWithSharp(req.file, settings);
        const outputHash = await computeImageHash({
          ...req.file,
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

      const projectDirectory = path.join(projectFileStorageRoot, projectId);
      await fs.mkdir(projectDirectory, { recursive: true });
      const id = crypto.randomUUID();
      const storedName = `${id}${extensionForMime(decoded.mimeType)}`;
      const storagePath = path.join(projectDirectory, storedName);
      await fs.writeFile(storagePath, decoded.buffer);

      const fileRecord: PhotoEnhancerSavedFile = {
        id,
        projectId,
        folderId,
        name: `photo-enhancer-${id}${extensionForMime(decoded.mimeType)}`,
        mimeType: decoded.mimeType,
        size: decoded.buffer.byteLength,
        storagePath,
        downloadUrl: `/api/photo-enhancer/files/${id}/download`,
        preset,
        settings,
        createdAt: new Date().toISOString(),
      };
      const manifest = await readPhotoEnhancerManifest();
      await writePhotoEnhancerManifest([...manifest, fileRecord]);

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
