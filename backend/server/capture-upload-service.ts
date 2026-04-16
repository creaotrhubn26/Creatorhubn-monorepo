import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  captureAssets,
  captureSessions,
  type InsertCaptureAsset,
} from '../migrations/capture-schema.js';

type Db = NodePgDatabase<Record<string, never>>;

export type UploadKind = 'preview' | 'full' | 'raw';

export interface CaptureR2Config {
  enabled: boolean;
  endpoint?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  prefix: string;
}

const MIN_PART_SIZE = 5 * 1024 * 1024;
const MAX_PART_SIZE = 5 * 1024 * 1024 * 1024;
const MAX_PARTS = 10_000;
const SIGNED_URL_TTL_SECONDS = 15 * 60;
const PART_URL_BATCH_MAX = 100;

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    if (v && v.trim().length > 0) return v;
  }
  return undefined;
}

export function buildCaptureR2Config(): CaptureR2Config {
  const endpoint = firstNonEmpty(
    process.env.CAPTURE_R2_ENDPOINT,
    process.env.CLOUDFLARE_R2_ENDPOINT,
    process.env.R2_ENDPOINT,
  );
  const bucket = firstNonEmpty(
    process.env.CAPTURE_R2_BUCKET,
    process.env.CLOUDFLARE_R2_UPLOAD_BUCKET,
    process.env.CLOUDFLARE_R2_BUCKET,
    process.env.R2_BUCKET,
  );
  const accessKeyId = firstNonEmpty(
    process.env.CAPTURE_R2_ACCESS_KEY_ID,
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    process.env.R2_ACCESS_KEY_ID,
  );
  const secretAccessKey = firstNonEmpty(
    process.env.CAPTURE_R2_SECRET_ACCESS_KEY,
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    process.env.R2_SECRET_ACCESS_KEY,
  );
  return {
    enabled: Boolean(endpoint && bucket && accessKeyId && secretAccessKey),
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    prefix: process.env.CAPTURE_R2_PREFIX ?? 'capture/',
  };
}

let cachedClient: S3Client | null = null;
let cachedClientKey = '';

function getClient(cfg: CaptureR2Config): S3Client | null {
  if (!cfg.enabled || !cfg.endpoint || !cfg.accessKeyId || !cfg.secretAccessKey) return null;
  const key = `${cfg.endpoint}|${cfg.accessKeyId}`;
  if (cachedClient && cachedClientKey === key) return cachedClient;
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  cachedClientKey = key;
  return cachedClient;
}

function computePartSize(totalSize: number, preferredPartSize?: number): number {
  const preferred = Math.max(preferredPartSize ?? MIN_PART_SIZE, MIN_PART_SIZE);
  const needed = Math.ceil(totalSize / MAX_PARTS);
  return Math.min(Math.max(preferred, needed), MAX_PART_SIZE);
}

function sanitizeFilename(input: string, fallback: string): string {
  const cleaned = input
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, 160);
  return cleaned || fallback;
}

function buildObjectKey(params: {
  prefix: string;
  ownerUserId: string;
  sessionId: string;
  assetId: string;
  kind: UploadKind;
  filename: string;
}): string {
  const name = sanitizeFilename(params.filename, 'file.bin');
  return `${params.prefix}${params.ownerUserId}/${params.sessionId}/${params.assetId}/${params.kind}/${name}`;
}

function expectedKeyPrefix(
  cfg: CaptureR2Config,
  ownerUserId: string,
  sessionId: string,
  assetId: string,
): string {
  return `${cfg.prefix}${ownerUserId}/${sessionId}/${assetId}/`;
}

async function fetchOwnedAsset(
  db: Db,
  ownerUserId: string,
  assetId: string,
): Promise<{ sessionId: string; originalFilename: string } | null> {
  const rows = await db
    .select({
      sessionId: captureAssets.sessionId,
      originalFilename: captureAssets.originalFilename,
    })
    .from(captureAssets)
    .innerJoin(captureSessions, eq(captureAssets.sessionId, captureSessions.id))
    .where(and(eq(captureAssets.id, assetId), eq(captureSessions.ownerUserId, ownerUserId)))
    .limit(1);
  return rows[0] ?? null;
}

export type UploadError = 'not_configured' | 'not_found' | 'invalid';
type Result<T> = { ok: true; result: T } | { ok: false; error: UploadError };

export interface StartUploadResult {
  bucket: string;
  key: string;
  uploadId: string;
  partSize: number;
  partCount: number;
  signedUrlTtlSeconds: number;
  partUrlBatchMax: number;
}

export async function startMultipartUpload(
  db: Db,
  ownerUserId: string,
  assetId: string,
  kind: UploadKind,
  sizeBytes: number,
  mime: string,
  preferredPartSize?: number,
): Promise<Result<StartUploadResult>> {
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, error: 'invalid' };
  }
  const cfg = buildCaptureR2Config();
  const client = getClient(cfg);
  if (!client || !cfg.bucket) return { ok: false, error: 'not_configured' };

  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };

  const key = buildObjectKey({
    prefix: cfg.prefix,
    ownerUserId,
    sessionId: asset.sessionId,
    assetId,
    kind,
    filename: asset.originalFilename,
  });
  const partSize = computePartSize(sizeBytes, preferredPartSize);
  const partCount = Math.ceil(sizeBytes / partSize);
  const created = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: mime,
      Metadata: {
        ownerUserId,
        sessionId: asset.sessionId,
        assetId,
        kind,
      },
    }),
  );
  if (!created.UploadId) {
    throw new Error('multipart start returned no uploadId');
  }
  return {
    ok: true,
    result: {
      bucket: cfg.bucket,
      key,
      uploadId: created.UploadId,
      partSize,
      partCount,
      signedUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
      partUrlBatchMax: PART_URL_BATCH_MAX,
    },
  };
}

export interface SignedPart {
  partNumber: number;
  url: string;
}

export async function signPartUrls(
  db: Db,
  ownerUserId: string,
  assetId: string,
  uploadId: string,
  key: string,
  partNumbers: number[],
): Promise<Result<{ parts: SignedPart[]; expiresInSeconds: number }>> {
  if (partNumbers.length === 0) return { ok: false, error: 'invalid' };
  const cfg = buildCaptureR2Config();
  const client = getClient(cfg);
  if (!client || !cfg.bucket) return { ok: false, error: 'not_configured' };
  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };
  if (!key.startsWith(expectedKeyPrefix(cfg, ownerUserId, asset.sessionId, assetId))) {
    return { ok: false, error: 'not_found' };
  }
  const parts: SignedPart[] = await Promise.all(
    partNumbers.slice(0, PART_URL_BATCH_MAX).map(async (partNumber) => ({
      partNumber,
      url: await getSignedUrl(
        client,
        new UploadPartCommand({
          Bucket: cfg.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: SIGNED_URL_TTL_SECONDS },
      ),
    })),
  );
  return {
    ok: true,
    result: { parts, expiresInSeconds: SIGNED_URL_TTL_SECONDS },
  };
}

export interface CompletedUpload {
  bucket: string;
  key: string;
  sizeBytes: number;
  etag: string | null;
}

export async function completeMultipartUpload(
  db: Db,
  ownerUserId: string,
  assetId: string,
  kind: UploadKind,
  uploadId: string,
  key: string,
  parts: Array<{ partNumber: number; etag: string }>,
  checksumSha256: string,
  sizeBytes: number,
): Promise<Result<CompletedUpload>> {
  if (parts.length === 0 || checksumSha256.length !== 64 || sizeBytes <= 0) {
    return { ok: false, error: 'invalid' };
  }
  const cfg = buildCaptureR2Config();
  const client = getClient(cfg);
  if (!client || !cfg.bucket) return { ok: false, error: 'not_configured' };

  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };
  if (!key.startsWith(expectedKeyPrefix(cfg, ownerUserId, asset.sessionId, assetId))) {
    return { ok: false, error: 'not_found' };
  }

  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: cfg.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sorted.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }),
  );
  const head = await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }));
  const verifiedSize = Number(head.ContentLength ?? sizeBytes);

  const patch: Partial<InsertCaptureAsset> = {
    checksumSha256,
    sizeBytes: verifiedSize,
    updatedAt: new Date(),
    ...(kind === 'preview' ? { previewKey: key } : {}),
    ...(kind === 'full' ? { fullKey: key } : {}),
    ...(kind === 'raw' ? { rawKey: key } : {}),
  };
  await db
    .update(captureAssets)
    .set(patch)
    .where(
      and(
        eq(captureAssets.id, assetId),
        sql`EXISTS (SELECT 1 FROM ${captureSessions}
          WHERE ${captureSessions.id} = ${captureAssets.sessionId}
          AND ${captureSessions.ownerUserId} = ${ownerUserId})`,
      ),
    );

  return {
    ok: true,
    result: {
      bucket: cfg.bucket,
      key,
      sizeBytes: verifiedSize,
      etag: head.ETag ?? null,
    },
  };
}

const READ_URL_TTL_SECONDS = 5 * 60;

/**
 * Generate a short-lived signed GET URL for a previously-uploaded asset key.
 * Used by client review mode so browsers can render thumbnails without
 * direct R2 credentials.
 */
export async function signAssetReadUrl(
  key: string | null,
): Promise<string | null> {
  if (!key) return null;
  const cfg = buildCaptureR2Config();
  const client = getClient(cfg);
  if (!client || !cfg.bucket) return null;
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
    { expiresIn: READ_URL_TTL_SECONDS },
  );
}

export async function abortMultipartUpload(
  db: Db,
  ownerUserId: string,
  assetId: string,
  uploadId: string,
  key: string,
): Promise<{ ok: true } | { ok: false; error: UploadError }> {
  const cfg = buildCaptureR2Config();
  const client = getClient(cfg);
  if (!client || !cfg.bucket) return { ok: false, error: 'not_configured' };
  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };
  if (!key.startsWith(expectedKeyPrefix(cfg, ownerUserId, asset.sessionId, assetId))) {
    return { ok: false, error: 'not_found' };
  }
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: cfg.bucket,
      Key: key,
      UploadId: uploadId,
    }),
  );
  return { ok: true };
}
