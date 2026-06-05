/**
 * b2-company-archive-routes.ts
 *
 * Admin-gated tilgang til Creatorhub AS sitt eierskap-eide B2-bucket
 * (creatorhubn-archive-prod). Brukes for selskap-eide arkiv-data
 * (DB-backup, intern-medier) — separat fra per-fotograf B2-koblingen
 * i storage-providers-routes.ts der hver fotograf har sin egen konto.
 *
 * Credentials kommer fra Render env-vars:
 *   B2_APPLICATION_KEY_ID   — backend-key scoped til bucket
 *   B2_APPLICATION_KEY      — secret (shown once av B2)
 *   B2_BUCKET_ID            — kun ID, brukes ikke for S3-API
 *   B2_BUCKET_NAME          — `creatorhubn-archive-prod`
 *
 * B2 har S3-kompatibel API som AWS SDK forstår direkte. Endpoint-mønster:
 *   https://s3.<region>.backblazeb2.com
 * Default region for nye kontoer er us-west-001.
 */

import express from "express";
import {
  S3Client,
  ListObjectsV2Command,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const B2_REGION = process.env.B2_REGION || "us-west-001";
const B2_ENDPOINT = `https://s3.${B2_REGION}.backblazeb2.com`;

// Usage-stats cache: B2 har ingen direkte "total bytes" API; vi må
// iterere ListObjectsV2 og summere. Cache 5 min for å unngå å hamre
// API'en hver gang admin laster siden.
interface UsageCache {
  bytes: number;
  files: number;
  computedAt: number;
}
let usageCache: UsageCache | null = null;
const USAGE_CACHE_TTL_MS = 5 * 60 * 1000;

interface B2RoutesDeps {
  app: express.Application;
  requireAdminSession: (req: any, res: any) => any;
}

interface B2Config {
  bucketName: string;
  client: S3Client;
}

function getB2Config(): B2Config | null {
  const keyId = process.env.B2_APPLICATION_KEY_ID;
  const appKey = process.env.B2_APPLICATION_KEY;
  const bucketName = process.env.B2_BUCKET_NAME;

  if (!keyId || !appKey || !bucketName) {
    return null;
  }

  const client = new S3Client({
    region: B2_REGION,
    endpoint: B2_ENDPOINT,
    credentials: {
      accessKeyId: keyId,
      secretAccessKey: appKey,
    },
    forcePathStyle: true,
  });

  return { bucketName, client };
}

async function computeBucketUsage(config: B2Config): Promise<{ bytes: number; files: number }> {
  let totalBytes = 0;
  let totalFiles = 0;
  let continuationToken: string | undefined;

  // Cap iterasjoner som safety mot uendelig loop — 1000 sider × 1000 keys = 1M files
  for (let i = 0; i < 1000; i++) {
    const result = await config.client.send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );
    for (const obj of result.Contents || []) {
      totalBytes += obj.Size || 0;
      totalFiles += 1;
    }
    if (!result.IsTruncated) break;
    continuationToken = result.NextContinuationToken;
  }

  return { bytes: totalBytes, files: totalFiles };
}

// Validér object-key — B2 tillater nesten alt, men vi avviser ../ for path-traversal-paranoia
function isValidKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  if (key.length > 1024) return false;
  if (key.includes("..")) return false;
  if (key.startsWith("/")) return false;
  return true;
}

export function registerB2CompanyArchiveRoutes(deps: B2RoutesDeps): void {
  const { app, requireAdminSession } = deps;

  app.get("/api/admin/b2-archive/health", async (req, res) => {
    if (!requireAdminSession(req, res)) return;

    const config = getB2Config();
    if (!config) {
      return res.json({
        connected: false,
        configured: false,
        error: "B2 env-vars mangler (B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME)",
      });
    }

    try {
      await config.client.send(
        new HeadBucketCommand({ Bucket: config.bucketName }),
      );
      return res.json({
        connected: true,
        configured: true,
        bucketName: config.bucketName,
        region: B2_REGION,
        endpoint: B2_ENDPOINT,
      });
    } catch (err: any) {
      return res.json({
        connected: false,
        configured: true,
        bucketName: config.bucketName,
        region: B2_REGION,
        error: err?.message || "Ukjent feil ved B2-tilkobling",
      });
    }
  });

  app.get("/api/admin/b2-archive/usage", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const config = getB2Config();
    if (!config) return res.status(503).json({ error: "B2 ikke konfigurert" });

    const force = req.query.force === "1";
    const now = Date.now();
    if (!force && usageCache && now - usageCache.computedAt < USAGE_CACHE_TTL_MS) {
      return res.json({
        bytes: usageCache.bytes,
        files: usageCache.files,
        computedAt: new Date(usageCache.computedAt).toISOString(),
        cached: true,
      });
    }

    try {
      const stats = await computeBucketUsage(config);
      usageCache = { ...stats, computedAt: now };
      return res.json({
        bytes: stats.bytes,
        files: stats.files,
        computedAt: new Date(now).toISOString(),
        cached: false,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || "Klarte ikke å beregne bucket-bruk",
      });
    }
  });

  app.get("/api/admin/b2-archive/files", async (req, res) => {
    if (!requireAdminSession(req, res)) return;

    const config = getB2Config();
    if (!config) {
      return res.status(503).json({ error: "B2 ikke konfigurert" });
    }

    const prefix = typeof req.query.prefix === "string" ? req.query.prefix : undefined;
    const continuationToken =
      typeof req.query.continuationToken === "string"
        ? req.query.continuationToken
        : undefined;
    const maxKeys = Math.min(Number(req.query.maxKeys) || 100, 1000);

    try {
      const result = await config.client.send(
        new ListObjectsV2Command({
          Bucket: config.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: maxKeys,
        }),
      );

      return res.json({
        files: (result.Contents || []).map((obj: { Key?: string; Size?: number; LastModified?: Date; ETag?: string }) => ({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified?.toISOString(),
          etag: obj.ETag,
        })),
        truncated: Boolean(result.IsTruncated),
        nextContinuationToken: result.NextContinuationToken,
        keyCount: result.KeyCount,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || "Klarte ikke å liste B2-filer",
      });
    }
  });

  app.post("/api/admin/b2-archive/upload-url", express.json(), async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const config = getB2Config();
    if (!config) return res.status(503).json({ error: "B2 ikke konfigurert" });

    const { key, contentType, expiresIn } = req.body || {};
    if (!isValidKey(key)) {
      return res.status(400).json({ error: "Ugyldig key (1-1024 tegn, ingen ../)" });
    }
    const ttl = Math.min(Math.max(Number(expiresIn) || 600, 60), 3600);

    try {
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        ContentType: typeof contentType === "string" ? contentType : undefined,
      });
      const url = await getSignedUrl(config.client, command, { expiresIn: ttl });

      // Invalider usage-cache så neste GET ser oppdatert tall etter upload
      usageCache = null;

      return res.json({ uploadUrl: url, key, expiresIn: ttl });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Klarte ikke å lage upload-URL" });
    }
  });

  app.get("/api/admin/b2-archive/download-url", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const config = getB2Config();
    if (!config) return res.status(503).json({ error: "B2 ikke konfigurert" });

    const key = typeof req.query.key === "string" ? req.query.key : "";
    if (!isValidKey(key)) {
      return res.status(400).json({ error: "Ugyldig key" });
    }
    const ttl = Math.min(Math.max(Number(req.query.expiresIn) || 600, 60), 3600);

    try {
      const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });
      const url = await getSignedUrl(config.client, command, { expiresIn: ttl });
      return res.json({ downloadUrl: url, key, expiresIn: ttl });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Klarte ikke å lage download-URL" });
    }
  });

  app.delete("/api/admin/b2-archive/files/:key(*)", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const config = getB2Config();
    if (!config) return res.status(503).json({ error: "B2 ikke konfigurert" });

    const key = req.params.key;
    if (!isValidKey(key)) {
      return res.status(400).json({ error: "Ugyldig key" });
    }

    try {
      await config.client.send(
        new DeleteObjectCommand({
          Bucket: config.bucketName,
          Key: key,
        }),
      );
      usageCache = null;
      return res.json({ deleted: true, key });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Klarte ikke å slette" });
    }
  });
}
