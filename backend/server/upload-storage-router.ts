// Upload storage router — bestemmer hvor en assemblet upload skal lagres
// permanent: Cloudflare Stream (for video), R2 (for alt annet), eller
// filesystem som siste fallback.
//
// Brukes av chunked-upload-routes.ts etter at chunks er assemblet, men
// kan også brukes av andre upload-paths som vil ha samme routing-logikk.
//
// Env-fallback for R2 følger samme kjede som cms-media-service.ts:
//   GENERIC_UPLOADS_R2_BUCKET → CLOUDFLARE_R2_BUCKET → R2_BUCKET
// Samme mønster for endpoint/accessKey/secretKey.
//
// Stream-konfig leses fra cloudflare-stream-service.ts (samme env vars).

import * as fs from "fs/promises";
import * as fsSync from "fs";
import { PutObjectCommand, S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  buildStreamConfig,
  uploadToStream,
} from "./cloudflare-stream-service.js";

export type UploadStorageBackend = "cloudflare_stream" | "r2" | "filesystem";

export interface UploadStorageResult {
  backend: UploadStorageBackend;
  // Felles
  fileId: string; // intern referanse vi lagrer
  fileName: string;
  size: number;
  mimeType: string | null;
  // Stream-spesifikt
  streamUid?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  ready?: boolean;
  duration?: number;
  // R2-spesifikt
  r2Key?: string;
  r2Bucket?: string;
  // Filesystem fallback
  filesystemPath?: string;
  // Public/signed URL klienter kan bruke direkte (ikke alltid satt)
  downloadUrl?: string;
}

interface GenericR2Config {
  enabled: boolean;
  endpoint?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  prefix: string;
  publicUrlBase?: string;
}

const firstNonEmpty = (
  ...values: (string | undefined)[]
): string | undefined => {
  for (const v of values) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
};

const buildGenericUploadsR2Config = (): GenericR2Config => {
  const endpoint = firstNonEmpty(
    process.env.GENERIC_UPLOADS_R2_ENDPOINT,
    process.env.CLOUDFLARE_R2_ENDPOINT,
    process.env.R2_ENDPOINT,
  );
  const bucket = firstNonEmpty(
    process.env.GENERIC_UPLOADS_R2_BUCKET,
    process.env.CLOUDFLARE_R2_BUCKET,
    process.env.R2_BUCKET,
  );
  const accessKeyId = firstNonEmpty(
    process.env.GENERIC_UPLOADS_R2_ACCESS_KEY_ID,
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    process.env.R2_ACCESS_KEY_ID,
  );
  const secretAccessKey = firstNonEmpty(
    process.env.GENERIC_UPLOADS_R2_SECRET_ACCESS_KEY,
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    process.env.R2_SECRET_ACCESS_KEY,
  );
  return {
    enabled: Boolean(endpoint && bucket && accessKeyId && secretAccessKey),
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    prefix: process.env.GENERIC_UPLOADS_R2_PREFIX ?? "uploads/",
    publicUrlBase: process.env.GENERIC_UPLOADS_R2_PUBLIC_URL_BASE,
  };
};

let cachedR2: S3Client | null = null;
let cachedR2Key = "";

const getR2 = (cfg: GenericR2Config): S3Client | null => {
  if (
    !cfg.enabled ||
    !cfg.endpoint ||
    !cfg.accessKeyId ||
    !cfg.secretAccessKey
  ) {
    return null;
  }
  const key = `${cfg.endpoint}|${cfg.accessKeyId}`;
  if (cachedR2 && cachedR2Key === key) return cachedR2;
  cachedR2 = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  cachedR2Key = key;
  return cachedR2;
};

// Signed-URL TTL: kort (1 time) som default. En lekket lenke har dermed
// et mindre risikovindu enn med 7-dagers TTL.
//
// Klient-flyt forventes å hente fersk URL via /api/chunked-upload/files/:fileId
// hver gang den trenger fila — det endepunktet redirecter (302) til en ny
// signed URL slik at klient-koden ikke trenger å bekymre seg om utløp.
//
// Overstyr via env STORAGE_SIGNED_URL_TTL_SECONDS hvis bruksmønsteret
// krever lengre lenker (f.eks. e-post-baserte klient-galleri-deler som
// skal kunne åpnes flere ganger).
const R2_SIGNED_TTL_DEFAULT_SECONDS = 60 * 60; // 1 time
const R2_SIGNED_TTL_SECONDS = (() => {
  const env = process.env.STORAGE_SIGNED_URL_TTL_SECONDS;
  if (env) {
    const parsed = parseInt(env, 10);
    if (Number.isFinite(parsed) && parsed >= 60 && parsed <= 7 * 24 * 60 * 60) {
      return parsed;
    }
  }
  return R2_SIGNED_TTL_DEFAULT_SECONDS;
})();

export interface AssembledUploadInput {
  fileId: string;
  fileName: string;
  mimeType?: string | null;
  size: number;
  // Filsti på serveren — vi streamer fra denne for R2 og Stream
  sourcePath: string;
  // Metadata vi bruker til tagging (Stream meta, R2 object metadata)
  metadata?: Record<string, unknown>;
  userId: string;
}

export interface RouteToStorageOpts {
  // Hvis true forsøker vi aldri Stream, bare R2/filesystem
  preferFilesystem?: boolean;
}

/**
 * Bestem og utfør lagring av en assemblet upload.
 *
 * Routing-policy:
 *   - video/* → Cloudflare Stream hvis CLOUDFLARE_STREAM_API_TOKEN er satt.
 *   - alt annet → R2 hvis GENERIC_UPLOADS_R2_BUCKET (eller fallback) er satt.
 *   - Hvis ingen av delene: behold på filesystem og returner intern URL.
 *
 * Returnerer alltid en `UploadStorageResult` slik at kalleren har
 * nok info til å lagre i DB og kunne reflektere riktig URL/uid.
 */
export async function routeAssembledUpload(
  input: AssembledUploadInput,
  opts: RouteToStorageOpts = {},
): Promise<UploadStorageResult> {
  const mime = input.mimeType || null;
  const isVideo = !!mime && mime.startsWith("video/");
  const streamCfg = buildStreamConfig();

  // 1) Video → Stream
  if (!opts.preferFilesystem && isVideo && streamCfg.enabled) {
    try {
      const bytes = await fs.readFile(input.sourcePath);
      const streamRes = await uploadToStream(bytes, mime!, {
        projectId:
          (input.metadata?.projectId as string | undefined) || input.userId,
        postId: input.fileId,
        filename: input.fileName,
      });
      // Rydd kildefil — den ligger nå hos Cloudflare
      await fs.rm(input.sourcePath, { force: true }).catch(() => undefined);
      return {
        backend: "cloudflare_stream",
        fileId: input.fileId,
        fileName: input.fileName,
        size: input.size,
        mimeType: mime,
        streamUid: streamRes.uid,
        playbackUrl: streamRes.playbackUrl,
        thumbnailUrl: streamRes.thumbnailUrl,
        ready: streamRes.ready,
        duration: streamRes.duration,
        downloadUrl: streamRes.playbackUrl,
      };
    } catch (err) {
      console.warn(
        "[storage-router] Stream upload feilet, faller tilbake til R2:",
        err,
      );
      // Fortsetter til R2-pathen
    }
  }

  // 2) R2
  const r2Cfg = buildGenericUploadsR2Config();
  const r2Client = !opts.preferFilesystem ? getR2(r2Cfg) : null;
  if (r2Client && r2Cfg.bucket && r2Cfg.endpoint) {
    try {
      const safeName = input.fileName
        .replace(/[\\/:*?"<>|\x00-\x1F]/g, "_")
        .slice(0, 200);
      const key = `${r2Cfg.prefix}${input.userId}/${input.fileId}/${safeName}`;
      const stream = fsSync.createReadStream(input.sourcePath);

      await r2Client.send(
        new PutObjectCommand({
          Bucket: r2Cfg.bucket,
          Key: key,
          Body: stream,
          ContentType: mime ?? "application/octet-stream",
          ContentLength: input.size,
          Metadata: {
            "user-id": input.userId,
            "file-id": input.fileId,
            "original-name": safeName,
          },
        }),
      );

      // Bygg URL: public hvis konfigurert, ellers signed (7d)
      let url: string;
      if (r2Cfg.publicUrlBase) {
        url = `${r2Cfg.publicUrlBase.replace(/\/$/, "")}/${key}`;
      } else {
        url = await getSignedUrl(
          r2Client,
          new GetObjectCommand({ Bucket: r2Cfg.bucket, Key: key }),
          { expiresIn: R2_SIGNED_TTL_SECONDS },
        );
      }

      // Rydd kildefil
      await fs.rm(input.sourcePath, { force: true }).catch(() => undefined);

      return {
        backend: "r2",
        fileId: input.fileId,
        fileName: input.fileName,
        size: input.size,
        mimeType: mime,
        r2Key: key,
        r2Bucket: r2Cfg.bucket,
        downloadUrl: url,
      };
    } catch (err) {
      console.warn(
        "[storage-router] R2 upload feilet, faller tilbake til filesystem:",
        err,
      );
      // Fortsetter til filesystem-fallback
    }
  }

  // 3) Filesystem fallback — behold der den ligger
  return {
    backend: "filesystem",
    fileId: input.fileId,
    fileName: input.fileName,
    size: input.size,
    mimeType: mime,
    filesystemPath: input.sourcePath,
    downloadUrl: `/api/chunked-upload/files/${input.fileId}`,
  };
}

/** Diagnose: hva er koblet til akkurat nå? */
export function getStorageStatus(): {
  cloudflareStream: { enabled: boolean; customerSubdomain: string | null };
  r2: { enabled: boolean; bucket: string | null };
  filesystem: { dir: string };
} {
  const streamCfg = buildStreamConfig();
  const r2Cfg = buildGenericUploadsR2Config();
  return {
    cloudflareStream: {
      enabled: streamCfg.enabled,
      customerSubdomain: streamCfg.customerSubdomain ?? null,
    },
    r2: {
      enabled: r2Cfg.enabled,
      bucket: r2Cfg.bucket ?? null,
    },
    filesystem: {
      dir:
        process.env.CHUNKED_UPLOAD_DIR ||
        require("os").tmpdir() + "/creatorhub-chunked-uploads",
    },
  };
}
