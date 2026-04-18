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

function decodeDataUrl(dataUrl: string): { contentType: string; bytes: Buffer } | null {
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return null;
  return {
    contentType: match[1],
    bytes: Buffer.from(match[2], 'base64'),
  };
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
 * Upload `dataUrl` (JPEG/PNG/WebP) to R2 and return a pre-signed URL Meta
 * can fetch during container creation. Returns null if R2 is not
 * configured or the data URL is malformed.
 */
export async function uploadImageForInstagram(input: {
  userId: string;
  dataUrl: string;
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

  const ext = decoded.contentType === 'image/png' ? 'png'
    : decoded.contentType === 'image/webp' ? 'webp'
    : 'jpg';
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

  return {
    bucket: cfg.bucket,
    key,
    publicUrl,
    contentType: decoded.contentType,
    bytes: decoded.bytes.length,
  };
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
