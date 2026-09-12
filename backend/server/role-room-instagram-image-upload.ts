/**
 * Image hosting for Instagram publishing.
 *
 * Meta's Graph API requires a publicly fetchable URL for images — it
 * cannot read data URLs. We upload the JPEG bytes to R2 (re-using the
 * existing capture R2 bucket with a distinct prefix), then return a
 * pre-signed URL valid for 1 hour. Meta typically fetches the image
 * within seconds of the container-creation call, so 1h is comfortable
 * headroom while still keeping the URL non-permanent.
 */

import { PutObjectCommand, S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import type { Pool } from 'pg';
import { mirrorUploadToUserB2 } from './user-b2-mirror-worker.js';

interface R2Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const v of values) if (v && v.trim().length > 0) return v;
  return undefined;
}

function readR2Config(): R2Config | null {
  const endpoint = firstNonEmpty(
    process.env.CAPTURE_R2_ENDPOINT,
    process.env.CLOUDFLARE_R2_ENDPOINT,
    process.env.R2_ENDPOINT,
  );
  const bucket = firstNonEmpty(
    process.env.INSTAGRAM_R2_BUCKET,
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
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    prefix: process.env.INSTAGRAM_R2_PREFIX ?? 'role-room/instagram-publish/',
  };
}

let cachedClient: S3Client | null = null;
let cachedKey = '';

function getClient(cfg: R2Config): S3Client {
  const key = `${cfg.endpoint}|${cfg.accessKeyId}`;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: cfg.endpoint,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  cachedKey = key;
  return cachedClient;
}

// Accepts both image/* and video/* so reels (mp4/quicktime) can ride
// the same upload path as carousel/single images. Meta's reel flow
// still wants a publicly fetchable URL — same contract, different MIME.
function decodeDataUrl(dataUrl: string): { contentType: string; bytes: Buffer } | null {
  const match = /^data:((?:image|video)\/[a-zA-Z0-9+.-]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return null;
  return {
    contentType: match[1],
    bytes: Buffer.from(match[2], 'base64'),
  };
}

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/jpeg':
    case 'image/jpg': return 'jpg';
    case 'video/mp4': return 'mp4';
    case 'video/quicktime': return 'mov';
    default: {
      // Last-ditch: use the part after the slash — safe for unknown but
      // spec-compliant subtypes (image/gif → gif, video/webm → webm).
      const slash = contentType.indexOf('/');
      return slash >= 0 ? contentType.slice(slash + 1) : 'bin';
    }
  }
}

export interface InstagramHostedImage {
  bucket: string;
  key: string;
  publicUrl: string; // pre-signed, ~1h TTL
  contentType: string;
  bytes: number;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Upload `dataUrl` (image/* or video/*) to R2 and return a pre-signed
 * URL Meta can fetch during container creation. Returns null if R2 is
 * not configured or the data URL is malformed.
 */
export async function uploadImageForInstagram(input: {
  userId: string;
  dataUrl: string;
  // Optional pool — hvis satt, mirror'es bilde også til brukerens egen B2.
  // Fra-call-side: existing callers som ikke sender pool får uendret oppførsel.
  pool?: Pool;
}): Promise<InstagramHostedImage | null> {
  const cfg = readR2Config();
  if (!cfg) {
    console.error('[ig-image-upload] R2 not configured — set R2_ENDPOINT/BUCKET/keys');
    return null;
  }
  const decoded = decodeDataUrl(input.dataUrl);
  if (!decoded) {
    console.error('[ig-image-upload] data URL malformed');
    return null;
  }

  const ext = extensionForContentType(decoded.contentType);
  const random = crypto.randomBytes(8).toString('hex');
  const key = `${cfg.prefix}${input.userId}/${Date.now()}-${random}.${ext}`;

  const client = getClient(cfg);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: decoded.bytes,
      ContentType: decoded.contentType,
      // Cache short — image is one-shot and we don't want stale Meta fetches.
      CacheControl: 'private, max-age=60',
    }),
  );

  const publicUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: cfg.bucket, Key: key }), {
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });

  // Fire-and-forget: mirror til brukerens egen B2 hvis pool er gitt og
  // bruker har konfigurert creds. Vi har bytes i minnet allerede.
  if (input.pool) {
    const fileName = `${Date.now()}-${random}.${ext}`;
    mirrorUploadToUserB2(
      { pool: input.pool },
      {
        userId: input.userId,
        source: 'role-room',
        sourceId: `instagram-publish/${random}`,
        fileName,
        contentType: decoded.contentType,
        buffer: decoded.bytes,
      },
    );
  }

  return {
    bucket: cfg.bucket,
    key,
    publicUrl,
    contentType: decoded.contentType,
    bytes: decoded.bytes.length,
  };
}

/**
 * Re-sign a fresh 1h URL for an already-uploaded image. Used by the
 * scheduled-publish worker when a queued job fires hours or days after
 * queueing — the original upload's URL will have expired by then.
 */
export async function signInstagramHostedImageUrl(bucket: string, key: string): Promise<string | null> {
  const cfg = readR2Config();
  if (!cfg) return null;
  // Allow the bucket on the job row to override the config default so a
  // migration between buckets doesn't break in-flight scheduled jobs.
  const effectiveBucket = bucket || cfg.bucket;
  try {
    const client = getClient(cfg);
    return await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: effectiveBucket, Key: key }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
  } catch (error) {
    console.error('[ig-image-upload] re-sign failed', error);
    return null;
  }
}

/**
 * Delete a previously uploaded image (best-effort cleanup after publish).
 */
export async function deleteInstagramHostedImage(bucket: string, key: string): Promise<void> {
  const cfg = readR2Config();
  if (!cfg) return;
  try {
    const client = getClient(cfg);
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    /* best-effort — Stripe-style nightly cleanup can sweep unreached keys */
  }
}

export function isInstagramImageUploadConfigured(): boolean {
  return readR2Config() !== null;
}
