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
} from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  captureAssets,
  captureSessions,
  type InsertCaptureAsset,
} from '../migrations/capture-schema.js';
import { getCreatorHubObjectStorage } from './creatorhub-object-storage.js';
import type { PrivateObjectStorage } from './private-object-storage.js';
import {
  buildPhotoRoomCaptureAssetPrefix,
  buildPhotoRoomCaptureKey,
  isCreatorHubPhotoRoomKey,
} from './photo-room-storage-contract.js';

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

function getLegacyStorage(): PrivateObjectStorage | null {
  const cfg = buildCaptureR2Config();
  const client = getClient(cfg);
  if (!client || !cfg.bucket) return null;
  return {
    client,
    bucket: cfg.bucket,
    region: 'auto',
    provider: 'backblaze_b2',
    authentication: 'legacy_capture_r2_access_key',
  };
}

/** New Photo Room keys always use CreatorHub S3; only legacy keys use R2. */
function storageForKey(key: string): PrivateObjectStorage | null {
  return isCreatorHubPhotoRoomKey(key)
    ? getCreatorHubObjectStorage()
    : getLegacyStorage();
}

/** Provider descriptor for internal consumers such as Capture → Photo Enhancer. */
export function describeCaptureStorageKey(key: string): {
  bucket: string;
  storage: 'creatorhub_s3' | 'r2';
} | null {
  const storage = storageForKey(key);
  if (!storage) return null;
  return {
    bucket: storage.bucket,
    storage: isCreatorHubPhotoRoomKey(key) ? 'creatorhub_s3' : 'r2',
  };
}

function computePartSize(totalSize: number, preferredPartSize?: number): number {
  const preferred = Math.max(preferredPartSize ?? MIN_PART_SIZE, MIN_PART_SIZE);
  const needed = Math.ceil(totalSize / MAX_PARTS);
  return Math.min(Math.max(preferred, needed), MAX_PART_SIZE);
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
): Promise<{ sessionId: string; originalFilename: string; projectId: string | null } | null> {
  const rows = await db
    .select({
      sessionId: captureAssets.sessionId,
      originalFilename: captureAssets.originalFilename,
      projectId: captureSessions.projectId,
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
  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };

  const storage = getCreatorHubObjectStorage();
  if (!storage) return { ok: false, error: 'not_configured' };

  const key = buildPhotoRoomCaptureKey({
    userId: ownerUserId,
    projectId: asset.projectId,
    sessionId: asset.sessionId,
    assetId,
    kind,
    fileName: asset.originalFilename,
  });
  const partSize = computePartSize(sizeBytes, preferredPartSize);
  const partCount = Math.ceil(sizeBytes / partSize);
  const created = await storage.client.send(
    new CreateMultipartUploadCommand({
      Bucket: storage.bucket,
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
      bucket: storage.bucket,
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
  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };
  const storage = storageForKey(key);
  if (!storage) return { ok: false, error: 'not_configured' };
  const allowedPrefix = isCreatorHubPhotoRoomKey(key)
    ? buildPhotoRoomCaptureAssetPrefix({ userId: ownerUserId, projectId: asset.projectId, sessionId: asset.sessionId, assetId })
    : expectedKeyPrefix(buildCaptureR2Config(), ownerUserId, asset.sessionId, assetId);
  if (!key.startsWith(allowedPrefix)) {
    return { ok: false, error: 'not_found' };
  }
  const parts: SignedPart[] = await Promise.all(
    partNumbers.slice(0, PART_URL_BATCH_MAX).map(async (partNumber) => ({
      partNumber,
      url: await getSignedUrl(
        storage.client,
        new UploadPartCommand({
          Bucket: storage.bucket,
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
  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };
  const storage = storageForKey(key);
  if (!storage) return { ok: false, error: 'not_configured' };
  const allowedPrefix = isCreatorHubPhotoRoomKey(key)
    ? buildPhotoRoomCaptureAssetPrefix({ userId: ownerUserId, projectId: asset.projectId, sessionId: asset.sessionId, assetId })
    : expectedKeyPrefix(buildCaptureR2Config(), ownerUserId, asset.sessionId, assetId);
  if (!key.startsWith(allowedPrefix)) {
    return { ok: false, error: 'not_found' };
  }

  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  await storage.client.send(
    new CompleteMultipartUploadCommand({
      Bucket: storage.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sorted.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }),
  );
  const head = await storage.client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: key }));
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
      bucket: storage.bucket,
      key,
      sizeBytes: verifiedSize,
      etag: head.ETag ?? null,
    },
  };
}

const READ_URL_TTL_SECONDS = 5 * 60;
/// Seven days is the AWS SigV4 ceiling used for persisted delivery URLs.
/// Used when the URL needs to live in a database row for delivery
/// galleries — the client gallery viewer should re-sign on render once
/// the longer-term signing strategy lands, but this gets us through the
/// typical photographer-to-client delivery window.
const DELIVERY_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Generate a short-lived signed GET URL for a previously-uploaded asset key.
 * Used by client review mode so browsers can render thumbnails without
 * direct private-storage credentials.
 */
/// Phase 5.1 — direct put for non-multipart objects (voice-memo
/// reply audio uploads bypass the deliver/multipart pipeline because
/// they're small ~50-200KB blobs uploaded once from the iPad on
/// each reply). The key follows a reviews-scoped prefix so audio
/// blobs live alongside review rows logically:
///   reviews/<reviewId>/audio.m4a
/// Returns the private object key on success, or null when its provider is
/// unavailable. New calls use CreatorHub S3 keys.
export async function uploadCaptureObject(params: {
  key: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string | null> {
  const storage = storageForKey(params.key);
  if (!storage) {
    return null;
  }
  try {
    await storage.client.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
      }),
    );
    return params.key;
  } catch {
    return null;
  }
}

export async function signAssetReadUrl(
  key: string | null,
): Promise<string | null> {
  return signAssetReadUrlWithTtl(key, READ_URL_TTL_SECONDS);
}

/// Maximum-TTL signed URL for persisted contexts (e.g. gallery image rows
/// that live longer than the 5-minute review-mode default).
export async function signAssetReadUrlForDelivery(
  key: string | null,
): Promise<string | null> {
  return signAssetReadUrlWithTtl(key, DELIVERY_URL_TTL_SECONDS);
}

async function signAssetReadUrlWithTtl(
  key: string | null,
  ttlSeconds: number,
): Promise<string | null> {
  if (!key) return null;
  const storage = storageForKey(key);
  if (!storage) return null;
  return getSignedUrl(
    storage.client,
    new GetObjectCommand({ Bucket: storage.bucket, Key: key }),
    { expiresIn: ttlSeconds },
  );
}

export async function abortMultipartUpload(
  db: Db,
  ownerUserId: string,
  assetId: string,
  uploadId: string,
  key: string,
): Promise<{ ok: true } | { ok: false; error: UploadError }> {
  const asset = await fetchOwnedAsset(db, ownerUserId, assetId);
  if (!asset) return { ok: false, error: 'not_found' };
  const storage = storageForKey(key);
  if (!storage) return { ok: false, error: 'not_configured' };
  const allowedPrefix = isCreatorHubPhotoRoomKey(key)
    ? buildPhotoRoomCaptureAssetPrefix({ userId: ownerUserId, projectId: asset.projectId, sessionId: asset.sessionId, assetId })
    : expectedKeyPrefix(buildCaptureR2Config(), ownerUserId, asset.sessionId, assetId);
  if (!key.startsWith(allowedPrefix)) {
    return { ok: false, error: 'not_found' };
  }
  await storage.client.send(
    new AbortMultipartUploadCommand({
      Bucket: storage.bucket,
      Key: key,
      UploadId: uploadId,
    }),
  );
  return { ok: true };
}

/// Best-effort fysisk sletting av lagringsobjekter for en asset (inkl. ev. orphende
/// parts under asset-prefix). Feil er tolerert per nøkkel — DB-raden er
/// autoritativ; objektopprydding er sekundær. Alltid trygg å kalle med tom liste.
export async function deleteCaptureObjects(
  keys: string[],
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;
  for (const key of keys) {
    if (!key) continue;
    const storage = storageForKey(key);
    if (!storage) {
      failed += 1;
      continue;
    }
    try {
      await storage.client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }));
      deleted += 1;
    } catch (e: any) {
      failed += 1;
      console.error('[capture] object delete feilet', key, e?.message || e);
    }
  }
  return { deleted, failed };
}

/** Read either a canonical CreatorHub object or a legacy R2 object during migration. */
export async function getCaptureObject(key: string | null): Promise<{
  body: Buffer;
  contentType: string | null;
  sizeBytes: number;
  etag: string | null;
} | null> {
  if (!key) return null;
  const storage = storageForKey(key);
  if (!storage) return null;
  try {
    const object = await storage.client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }));
    if (!object.Body) return null;
    const bytes = await object.Body.transformToByteArray();
    return {
      body: Buffer.from(bytes),
      contentType: object.ContentType || null,
      sizeBytes: Number(object.ContentLength ?? bytes.byteLength),
      etag: object.ETag || null,
    };
  } catch {
    return null;
  }
}

/**
 * Non-destructive legacy migration primitive. It verifies source bytes and the
 * uploaded CreatorHub copy. Deleting the old R2 object is deliberately not
 * part of this API.
 */
export async function migrateLegacyCaptureObject(input: {
  legacyKey: string;
  creatorHubKey: string;
  expectedSha256?: string | null;
}): Promise<{ sizeBytes: number; sha256: string }> {
  if (isCreatorHubPhotoRoomKey(input.legacyKey) || !isCreatorHubPhotoRoomKey(input.creatorHubKey)) {
    throw new Error('invalid_migration_keys');
  }
  const source = await getCaptureObject(input.legacyKey);
  if (!source) throw new Error('legacy_source_unavailable');
  const sourceSha256 = crypto.createHash('sha256').update(source.body).digest('hex');
  if (input.expectedSha256 && sourceSha256 !== input.expectedSha256.toLowerCase()) {
    throw new Error('legacy_checksum_mismatch');
  }
  const targetStorage = getCreatorHubObjectStorage();
  if (!targetStorage) throw new Error('creatorhub_storage_not_configured');
  await targetStorage.client.send(new PutObjectCommand({
    Bucket: targetStorage.bucket,
    Key: input.creatorHubKey,
    Body: source.body,
    ContentType: source.contentType || 'application/octet-stream',
    Metadata: { migratedFrom: 'legacy-capture-r2', sha256: sourceSha256 },
  }));
  const target = await getCaptureObject(input.creatorHubKey);
  if (!target || target.sizeBytes !== source.sizeBytes) throw new Error('creatorhub_size_verification_failed');
  const targetSha256 = crypto.createHash('sha256').update(target.body).digest('hex');
  if (targetSha256 !== sourceSha256) throw new Error('creatorhub_checksum_verification_failed');
  return { sizeBytes: target.sizeBytes, sha256: targetSha256 };
}
