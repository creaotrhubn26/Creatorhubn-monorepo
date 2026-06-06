/**
 * b2-company-archive-routes.ts
 *
 * Admin-gated tilgang til Backblaze B2-buckets. Modulen er parameterisert
 * så vi kan registrere flere bucketer med forskjellige route- og
 * env-var-prefiks. Per 2026-06-05 har vi to:
 *
 *   1. Creatorhub AS selskap-bucket:
 *      - Route prefix: /api/admin/b2-archive
 *      - Env prefix:   B2_              (B2_APPLICATION_KEY_ID, ...)
 *      - Bucket:       creatorhubn-archive-prod
 *
 *   2. The Role Room produkt-bucket:
 *      - Route prefix: /api/role-room/admin/b2-archive
 *      - Env prefix:   B2_ROLE_ROOM_
 *      - Bucket:       the-role-room-prod
 *
 * Begge gates av samme requireAdminSession-middleware (admin-rolle).
 * Frontend gater i tillegg på e-post (kun produkteier ser fanene).
 *
 * B2 har S3-kompatibel API. Endpoint-mønster: https://s3.<region>.backblazeb2.com
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

interface UsageCache {
  bytes: number;
  files: number;
  computedAt: number;
}
const USAGE_CACHE_TTL_MS = 5 * 60 * 1000;

interface B2RoutesDeps {
  app: express.Application;
  requireAdminSession: (req: any, res: any) => any;
  /** URL-prefix uten avsluttende slash, f.eks. "/api/admin/b2-archive" */
  routePrefix: string;
  /** env-var-prefix inkludert underscore, f.eks. "B2_" eller "B2_ROLE_ROOM_" */
  envPrefix: string;
}

interface B2Config {
  bucketName: string;
  client: S3Client;
}

function getB2Config(envPrefix: string): B2Config | null {
  const keyId = process.env[`${envPrefix}APPLICATION_KEY_ID`];
  const appKey = process.env[`${envPrefix}APPLICATION_KEY`];
  const bucketName = process.env[`${envPrefix}BUCKET_NAME`];

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

function isValidKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  if (key.length > 1024) return false;
  if (key.includes("..")) return false;
  if (key.startsWith("/")) return false;
  return true;
}

export function registerB2CompanyArchiveRoutes(deps: B2RoutesDeps): void {
  const { app, requireAdminSession, routePrefix, envPrefix } = deps;

  // Separat usage-cache per bucket (envPrefix er nøkkel)
  let usageCache: UsageCache | null = null;

  app.get(`${routePrefix}/health`, async (req, res) => {
    if (!requireAdminSession(req, res)) return;

    const config = getB2Config(envPrefix);
    if (!config) {
      return res.json({
        connected: false,
        configured: false,
        error: `B2 env-vars mangler (${envPrefix}APPLICATION_KEY_ID, ${envPrefix}APPLICATION_KEY, ${envPrefix}BUCKET_NAME)`,
      });
    }

    try {
      await config.client.send(new HeadBucketCommand({ Bucket: config.bucketName }));
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

  app.get(`${routePrefix}/usage`, async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const config = getB2Config(envPrefix);
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
      return res.status(500).json({ error: err?.message || "Klarte ikke å beregne bucket-bruk" });
    }
  });

  app.get(`${routePrefix}/files`, async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const config = getB2Config(envPrefix);
    if (!config) return res.status(503).json({ error: "B2 ikke konfigurert" });

    const prefix = typeof req.query.prefix === "string" ? req.query.prefix : undefined;
    const continuationToken =
      typeof req.query.continuationToken === "string" ? req.query.continuationToken : undefined;
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
      return res.status(500).json({ error: err?.message || "Klarte ikke å liste B2-filer" });
    }
  });

  app.post(`${routePrefix}/upload-url`, express.json(), async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const config = getB2Config(envPrefix);
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
      usageCache = null;
      return res.json({ uploadUrl: url, key, expiresIn: ttl });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Klarte ikke å lage upload-URL" });
    }
  });

  app.get(`${routePrefix}/download-url`, async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const config = getB2Config(envPrefix);
    if (!config) return res.status(503).json({ error: "B2 ikke konfigurert" });

    const key = typeof req.query.key === "string" ? req.query.key : "";
    if (!isValidKey(key)) {
      return res.status(400).json({ error: "Ugyldig key" });
    }
    const ttl = Math.min(Math.max(Number(req.query.expiresIn) || 600, 60), 3600);

    try {
      const command = new GetObjectCommand({ Bucket: config.bucketName, Key: key });
      const url = await getSignedUrl(config.client, command, { expiresIn: ttl });
      return res.json({ downloadUrl: url, key, expiresIn: ttl });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Klarte ikke å lage download-URL" });
    }
  });

  app.delete(`${routePrefix}/files/:key(*)`, async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const config = getB2Config(envPrefix);
    if (!config) return res.status(503).json({ error: "B2 ikke konfigurert" });

    const key = req.params.key;
    if (!isValidKey(key)) {
      return res.status(400).json({ error: "Ugyldig key" });
    }

    try {
      await config.client.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }));
      usageCache = null;
      return res.json({ deleted: true, key });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Klarte ikke å slette" });
    }
  });
}
