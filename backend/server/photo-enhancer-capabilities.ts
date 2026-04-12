import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type PhotoEnhancerModelDefinition = {
  id: string;
  displayName: string;
  modelType:
    | "face-restoration"
    | "super-resolution"
    | "denoise"
    | "blind-restoration"
    | "inpaint"
    | "analysis";
  description: string;
  recommendedFor: string[];
  candidateKeys: string[];
  runnerEnvKeys: string[];
  defaultRunnerUrl?: string | null;
};

export type PhotoEnhancerModelStatus = PhotoEnhancerModelDefinition & {
  storageType: "r2";
  r2Key: string;
  available: boolean;
  reason: string | null;
  weights: {
    configured: boolean;
    found: boolean;
    bucket: string | null;
    key: string | null;
    checkedBuckets: string[];
    checkedKeys: string[];
    reason: string | null;
  };
  runner: {
    configured: boolean;
    healthy: boolean | null;
    endpoint: string | null;
    envKeys: string[];
    reason: string | null;
  };
  inferenceAvailable: boolean;
  readinessReason: string | null;
  r2: {
    enabled: boolean;
    endpoint: string | null;
    bucket: string | null;
    buckets?: string[];
  };
};

export type PhotoEnhancerR2Config = {
  enabled: boolean;
  endpoint: string | null;
  bucket: string | null;
  buckets: string[];
  accessKeyId: string | null;
  secretAccessKey: string | null;
};

export type PublicPhotoEnhancerR2Config = Omit<
  PhotoEnhancerR2Config,
  "accessKeyId" | "secretAccessKey"
> & {
  credentialsConfigured: boolean;
};

function resolveDefaultGfpganRunnerUrl(): string | null {
  const disabled = process.env.PHOTO_ENHANCER_DISABLE_DEFAULT_GFPGAN_RUNNER === "true";
  if (disabled) return null;

  return firstNonEmpty(
    process.env.PHOTO_ENHANCER_DEFAULT_GFPGAN_URL,
    process.env.RENDER === "true"
      ? "https://creatorhub-gfpgan-runner.onrender.com/enhance"
      : undefined,
  );
}

export const photoEnhancerModelRegistry: PhotoEnhancerModelDefinition[] = [
  {
    id: "gfpgan",
    displayName: "GFPGAN",
    modelType: "face-restoration",
    description: "Face restoration for portraits, event photos, and old low-quality faces.",
    recommendedFor: ["portrait", "wedding", "studio", "client-review"],
    candidateKeys: [
      "models/gfpgan/weights/GFPGANv1.4.pth",
      "models/gfpgan/weights/GFPGANv1.3.pth",
      "models/gfpgan/weights/GFPGANv1.2.pth",
    ],
    runnerEnvKeys: ["PHOTO_ENHANCER_GFPGAN_URL", "GFPGAN_SERVICE_URL"],
    defaultRunnerUrl: resolveDefaultGfpganRunnerUrl(),
  },
  {
    id: "codeformer",
    displayName: "CodeFormer",
    modelType: "face-restoration",
    description: "Fidelity-controlled face restoration when GFPGAN is too aggressive.",
    recommendedFor: ["portrait", "documentary", "low-light", "archive"],
    candidateKeys: [
      "models/codeformer/weights/codeformer.pth",
      "models/codeformer/CodeFormer/weights/codeformer.pth",
      "models/CodeFormer/weights/codeformer.pth",
    ],
    runnerEnvKeys: ["PHOTO_ENHANCER_CODEFORMER_URL", "CODEFORMER_SERVICE_URL"],
  },
  {
    id: "restoreformer",
    displayName: "RestoreFormer",
    modelType: "face-restoration",
    description: "Alternative face restoration model for old compressed or damaged portraits.",
    recommendedFor: ["archive", "event", "client-review"],
    candidateKeys: [
      "models/restoreformer/weights/RestoreFormer.pth",
      "models/restoreformer/RestoreFormer.pth",
    ],
    runnerEnvKeys: ["PHOTO_ENHANCER_RESTOREFORMER_URL", "RESTOREFORMER_SERVICE_URL"],
  },
  {
    id: "realesrgan-x4plus",
    displayName: "Real-ESRGAN x4plus",
    modelType: "super-resolution",
    description: "General 4x image upscaling for delivery, print, and low-resolution sources.",
    recommendedFor: ["upscale", "delivery", "print", "product"],
    candidateKeys: [
      "models/realesrgan/weights/RealESRGAN_x4plus.pth",
      "models/realesrgan/RealESRGAN_x4plus.pth",
      "models/Real-ESRGAN/weights/RealESRGAN_x4plus.pth",
    ],
    runnerEnvKeys: ["PHOTO_ENHANCER_REALESRGAN_URL", "REALESRGAN_SERVICE_URL"],
  },
  {
    id: "realesrgan-x2plus",
    displayName: "Real-ESRGAN x2plus",
    modelType: "super-resolution",
    description: "Safer 2x upscaling when file size and natural texture matter more than scale.",
    recommendedFor: ["wedding", "event", "web", "client-review"],
    candidateKeys: [
      "models/realesrgan/weights/RealESRGAN_x2plus.pth",
      "models/realesrgan/RealESRGAN_x2plus.pth",
    ],
    runnerEnvKeys: ["PHOTO_ENHANCER_REALESRGAN_URL", "REALESRGAN_SERVICE_URL"],
  },
  {
    id: "realesrgan-anime",
    displayName: "Real-ESRGAN anime",
    modelType: "super-resolution",
    description: "Illustration and line-art upscaling for covers, thumbnails, and graphics.",
    recommendedFor: ["cover-art", "graphics", "illustration"],
    candidateKeys: [
      "models/realesrgan/weights/RealESRGAN_x4plus_anime_6B.pth",
      "models/realesrgan/RealESRGAN_x4plus_anime_6B.pth",
    ],
    runnerEnvKeys: ["PHOTO_ENHANCER_REALESRGAN_URL", "REALESRGAN_SERVICE_URL"],
  },
  {
    id: "swinir-real-sr",
    displayName: "SwinIR real SR",
    modelType: "super-resolution",
    description: "Real-world super-resolution model for compressed, noisy, or web-sourced images.",
    recommendedFor: ["web", "compression", "upscale", "social"],
    candidateKeys: [
      "models/swinir/weights/003_realSR_BSRGAN_DFO_s64w8_SwinIR-M_x4_GAN.pth",
      "models/swinir/003_realSR_BSRGAN_DFO_s64w8_SwinIR-M_x4_GAN.pth",
    ],
    runnerEnvKeys: ["PHOTO_ENHANCER_SWINIR_URL", "SWINIR_SERVICE_URL"],
  },
  {
    id: "bsrgan",
    displayName: "BSRGAN",
    modelType: "blind-restoration",
    description: "Blind restoration for unknown degradations before final color and delivery export.",
    recommendedFor: ["unknown-degradation", "archive", "social"],
    candidateKeys: [
      "models/bsrgan/weights/BSRGAN.pth",
      "models/bsrgan/BSRGAN.pth",
    ],
    runnerEnvKeys: ["PHOTO_ENHANCER_BSRGAN_URL", "BSRGAN_SERVICE_URL"],
  },
  {
    id: "diffbir",
    displayName: "DiffBIR",
    modelType: "blind-restoration",
    description: "Diffusion-based blind image restoration for difficult low-quality sources.",
    recommendedFor: ["archive", "heavy-noise", "compressed", "repair"],
    candidateKeys: [
      "models/diffbir/weights/diffbir.pth",
      "models/diffbir/weights/general_full_v1.ckpt",
      "models/diffbir/general_full_v1.ckpt",
    ],
    runnerEnvKeys: ["PHOTO_ENHANCER_DIFFBIR_URL", "DIFFBIR_SERVICE_URL"],
  },
  {
    id: "lama",
    displayName: "LaMa",
    modelType: "inpaint",
    description: "Inpainting model for object removal, background repair, and crop extension.",
    recommendedFor: ["retouch", "object-removal", "background-cleanup"],
    candidateKeys: [
      "models/lama/weights/big-lama.pt",
      "models/lama/big-lama.pt",
      "models/lama/big-lama.zip",
    ],
    runnerEnvKeys: ["PHOTO_ENHANCER_LAMA_URL", "LAMA_SERVICE_URL"],
  },
  {
    id: "face-api-models",
    displayName: "face-api.js weights",
    modelType: "analysis",
    description: "Face detection and landmark support for preflight analysis before restoration.",
    recommendedFor: ["analysis", "face-detection", "quality-control"],
    candidateKeys: [
      "models/face-api/tiny_face_detector_model-weights_manifest.json",
      "models/face-api/ssd_mobilenetv1_model-weights_manifest.json",
      "models/face-api/face_landmark_68_model-weights_manifest.json",
    ],
    runnerEnvKeys: [],
  },
];

export const PHOTO_ENHANCER_RASTER_FORMATS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".gif",
  ".bmp",
];

export const PHOTO_ENHANCER_RAW_FORMATS = [
  ".3fr",
  ".ari",
  ".arw",
  ".bay",
  ".braw",
  ".cap",
  ".cr2",
  ".cr3",
  ".crw",
  ".dcr",
  ".dcs",
  ".dng",
  ".drf",
  ".eip",
  ".erf",
  ".fff",
  ".gpr",
  ".iiq",
  ".k25",
  ".kdc",
  ".mdc",
  ".mef",
  ".mos",
  ".mrw",
  ".nef",
  ".nrw",
  ".obm",
  ".orf",
  ".pef",
  ".ptx",
  ".pxn",
  ".r3d",
  ".raf",
  ".raw",
  ".rwl",
  ".rw2",
  ".rwz",
  ".sr2",
  ".srf",
  ".srw",
  ".x3f",
];

export const PHOTO_ENHANCER_DRIVE_STRUCTURE = [
  {
    id: "01-raw-ingest",
    name: "01_RAW_Ingest",
    description: "Original camera files and untouched source images.",
  },
  {
    id: "02-selects",
    name: "02_Selects",
    description: "Chosen images ready for enhancement or client review.",
  },
  {
    id: "03-enhancer-working",
    name: "03_Photo_Enhancer_Working",
    description: "Intermediate TIFF/PNG outputs, model outputs, and comparison frames.",
  },
  {
    id: "04-ai-restoration",
    name: "04_AI_Restoration",
    description: "GFPGAN, CodeFormer, Real-ESRGAN, DiffBIR, and retouch outputs.",
  },
  {
    id: "05-client-review",
    name: "05_Client_Review",
    description: "Images prepared for client approval and comments.",
  },
  {
    id: "06-final-delivery",
    name: "06_Final_Delivery",
    description: "Approved JPEG, PNG, WebP, TIFF, and social export packages.",
  },
  {
    id: "07-archive",
    name: "07_Archive",
    description: "Final manifests, hashes, and locked project archive.",
  },
];

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function splitBucketList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((bucket) => bucket.trim())
    .filter(Boolean);
}

function uniqueBuckets(...values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.flatMap((value) => splitBucketList(value || undefined))),
  );
}

export function resolvePhotoEnhancerRunnerEndpoint(
  model: Pick<PhotoEnhancerModelDefinition, "runnerEnvKeys" | "defaultRunnerUrl">,
): string | null {
  return firstNonEmpty(
    ...model.runnerEnvKeys.map((key) => process.env[key]),
    model.defaultRunnerUrl || undefined,
  );
}

async function probeModelRunner(endpoint: string | null): Promise<{
  healthy: boolean | null;
  reason: string | null;
}> {
  if (!endpoint) {
    return {
      healthy: null,
      reason: "Runner endpoint is not configured",
    };
  }

  const timeoutMs = Number(process.env.PHOTO_ENHANCER_RUNNER_HEALTH_TIMEOUT_MS || 1_500);
  const normalizedEndpoint = endpoint.replace(/\/+$/u, "");
  const candidateUrls = new Set<string>([`${normalizedEndpoint}/health`]);
  try {
    const parsed = new URL(normalizedEndpoint);
    candidateUrls.add(`${parsed.origin}/health`);
  } catch {
    // Keep the endpoint-local health URL for non-URL values.
  }
  candidateUrls.add(normalizedEndpoint);

  for (const url of candidateUrls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });
      if (response.ok) {
        const text = await response.text().catch(() => "");
        if (text) {
          try {
            const payload = JSON.parse(text) as Record<string, unknown>;
            const status =
              typeof payload.status === "string" ? payload.status.toLowerCase() : null;
            if (status && ["error", "failed", "unavailable", "unhealthy"].includes(status)) {
              return {
                healthy: false,
                reason: `Runner health reported ${status}`,
              };
            }
          } catch {
            // Non-JSON 2xx health responses are accepted.
          }
        }
        return {
          healthy: true,
          reason: null,
        };
      }
      if (response.status !== 404) {
        return {
          healthy: false,
          reason: `Runner health check returned HTTP ${response.status}`,
        };
      }
    } catch (error) {
      return {
        healthy: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    healthy: false,
    reason: "Runner did not expose a healthy /health or root endpoint",
  };
}

async function resolveRunnerStatus(model: PhotoEnhancerModelDefinition): Promise<PhotoEnhancerModelStatus["runner"]> {
  const endpoint = resolvePhotoEnhancerRunnerEndpoint(model);
  if (model.runnerEnvKeys.length === 0) {
    return {
      configured: true,
      healthy: true,
      endpoint: null,
      envKeys: [],
      reason: null,
    };
  }

  const probe = await probeModelRunner(endpoint);
  return {
    configured: Boolean(endpoint),
    healthy: endpoint ? probe.healthy : null,
    endpoint,
    envKeys: model.runnerEnvKeys,
    reason: probe.reason,
  };
}

function buildReadinessReason(options: {
  weightsFound: boolean;
  weightsReason: string | null;
  runner: PhotoEnhancerModelStatus["runner"];
}): string | null {
  if (!options.weightsFound) return options.weightsReason;
  if (!options.runner.configured) return "Model weights found; runner endpoint is not configured";
  if (options.runner.healthy === false) return `Model weights found; runner is unhealthy: ${options.runner.reason || "unknown error"}`;
  if (options.runner.healthy === null) return "Model weights found; runner health is unknown";
  return null;
}

export function buildPhotoEnhancerR2Config(): PhotoEnhancerR2Config {
  const accountId = firstNonEmpty(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    process.env.R2_ACCOUNT_ID,
  );
  const endpoint = firstNonEmpty(
    process.env.CLOUDFLARE_R2_ENDPOINT,
    accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
  );
  const buckets = uniqueBuckets(
    process.env.CLOUDFLARE_R2_MODELS_BUCKETS,
    process.env.CLOUDFLARE_R2_MODELS_BUCKET,
    process.env.PHOTO_ENHANCER_R2_MODELS_BUCKET,
    process.env.CLOUDFLARE_R2_BUCKET,
    process.env.R2_BUCKET,
  );
  const bucket = buckets[0] || null;
  const accessKeyId = firstNonEmpty(
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    process.env.R2_ACCESS_KEY_ID,
  );
  const secretAccessKey = firstNonEmpty(
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    process.env.R2_SECRET_ACCESS_KEY,
  );

  return {
    enabled: Boolean(endpoint && buckets.length > 0 && accessKeyId && secretAccessKey),
    endpoint,
    bucket,
    buckets,
    accessKeyId,
    secretAccessKey,
  };
}

export function buildPublicPhotoEnhancerR2Config(): PublicPhotoEnhancerR2Config {
  const { accessKeyId, secretAccessKey, ...safeConfig } = buildPhotoEnhancerR2Config();
  return {
    ...safeConfig,
    credentialsConfigured: Boolean(accessKeyId && secretAccessKey),
  };
}

export async function resolvePhotoEnhancerModelStatuses(): Promise<PhotoEnhancerModelStatus[]> {
  const r2 = buildPhotoEnhancerR2Config();
  const baseR2 = {
    enabled: r2.enabled,
    endpoint: r2.endpoint,
    bucket: r2.bucket,
    buckets: r2.buckets,
  };

  if (!r2.enabled) {
    return Promise.all(
      photoEnhancerModelRegistry.map(async (model) => {
        const runner = await resolveRunnerStatus(model);
        const weightsReason = "R2 model credentials are not configured";
        const readinessReason = buildReadinessReason({
          weightsFound: false,
          weightsReason,
          runner,
        });
        return {
          ...model,
          storageType: "r2" as const,
          r2Key: model.candidateKeys[0],
          available: false,
          reason: weightsReason,
          weights: {
            configured: false,
            found: false,
            bucket: null,
            key: null,
            checkedBuckets: baseR2.buckets,
            checkedKeys: model.candidateKeys,
            reason: weightsReason,
          },
          runner,
          inferenceAvailable: false,
          readinessReason,
          r2: baseR2,
        };
      }),
    );
  }

  const client = new S3Client({
    region: "auto",
    endpoint: r2.endpoint || undefined,
    credentials: {
      accessKeyId: r2.accessKeyId || "",
      secretAccessKey: r2.secretAccessKey || "",
    },
  });

  return Promise.all(
    photoEnhancerModelRegistry.map(async (model) => {
      const runner = await resolveRunnerStatus(model);
      for (const bucketName of r2.buckets) {
        for (const key of model.candidateKeys) {
          try {
            await client.send(
              new HeadObjectCommand({
                Bucket: bucketName,
                Key: key,
              }),
            );
            const readinessReason = buildReadinessReason({
              weightsFound: true,
              weightsReason: null,
              runner,
            });
            return {
              ...model,
              storageType: "r2" as const,
              r2Key: key,
              available: true,
              reason: null,
              weights: {
                configured: true,
                found: true,
                bucket: bucketName,
                key,
                checkedBuckets: r2.buckets,
                checkedKeys: model.candidateKeys,
                reason: null,
              },
              runner,
              inferenceAvailable: readinessReason === null,
              readinessReason,
              r2: {
                ...baseR2,
                bucket: bucketName,
              },
            };
          } catch {
            // Continue checking fallback keys and buckets before reporting unavailable.
          }
        }
      }

      const weightsReason = "Model weights were not found in configured R2 buckets";
      const readinessReason = buildReadinessReason({
        weightsFound: false,
        weightsReason,
        runner,
      });
      return {
        ...model,
        storageType: "r2" as const,
        r2Key: model.candidateKeys[0],
        available: false,
        reason: weightsReason,
        weights: {
          configured: true,
          found: false,
          bucket: null,
          key: null,
          checkedBuckets: r2.buckets,
          checkedKeys: model.candidateKeys,
          reason: weightsReason,
        },
        runner,
        inferenceAvailable: false,
        readinessReason,
        r2: baseR2,
      };
    }),
  );
}

export function buildPhotoEnhancerImprovementBacklog() {
  const categories = [
    "ingest",
    "raw",
    "metadata",
    "model-routing",
    "face-restoration",
    "upscaling",
    "denoise",
    "color",
    "retouch",
    "batch",
    "google-drive",
    "client-review",
    "delivery",
    "quality-control",
    "duplicates",
    "camera-profiles",
    "lens-profiles",
    "mobile",
    "accessibility",
    "privacy",
    "audit",
    "performance",
    "observability",
    "fallbacks",
    "e2e",
  ];
  const actions = [
    "add server validation",
    "add UI state",
    "add retry path",
    "add audit signal",
    "add test coverage",
    "add empty-state copy",
    "add progress state",
    "add failure message",
    "add folder mapping",
    "add export metadata",
  ];

  return categories.flatMap((category, categoryIndex) =>
    actions.map((action, actionIndex) => ({
      id: `pe-${String(categoryIndex * actions.length + actionIndex + 1).padStart(3, "0")}`,
      category,
      title: `${action} for ${category}`,
      status: "tracked",
    })),
  );
}
