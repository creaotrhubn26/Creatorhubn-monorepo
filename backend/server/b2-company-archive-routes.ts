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
} from "@aws-sdk/client-s3";

const B2_REGION = process.env.B2_REGION || "us-west-001";
const B2_ENDPOINT = `https://s3.${B2_REGION}.backblazeb2.com`;

interface B2RoutesDeps {
  app: express.Application;
  requireAdminSession: (req: any, res: any) => any;
}

function getB2Config(): {
  bucketName: string;
  client: S3Client;
} | null {
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
}
