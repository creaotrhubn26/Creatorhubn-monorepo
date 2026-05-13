/**
 * cms-media-service.ts
 *
 * CMS-media-opplasting til Cloudflare R2. Brukes av Image-blokken
 * i AdminRoom block-CMS. Konfig leses fra env-vars med fallback-
 * kjede (CMS-prefix → generic R2_*).
 *
 * Public URL-strategi:
 *   - Hvis CMS_R2_PUBLIC_URL_BASE er satt: returner `${base}/${key}`
 *     (krever public bucket + custom domain mapped til R2-bucket)
 *   - Ellers: signed URL med 7-dagers TTL (R2/AWS-tak)
 */

import { randomUUID } from 'crypto';
import { PutObjectCommand, S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface CmsR2Config {
  enabled: boolean;
  endpoint?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  prefix: string;
  publicUrlBase?: string;
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    if (v && v.trim().length > 0) return v;
  }
  return undefined;
}

export function buildCmsR2Config(): CmsR2Config {
  const endpoint = firstNonEmpty(
    process.env.CMS_R2_ENDPOINT,
    process.env.CLOUDFLARE_R2_ENDPOINT,
    process.env.R2_ENDPOINT,
  );
  const bucket = firstNonEmpty(
    process.env.CMS_R2_BUCKET,
    process.env.CLOUDFLARE_R2_BUCKET,
    process.env.R2_BUCKET,
  );
  const accessKeyId = firstNonEmpty(
    process.env.CMS_R2_ACCESS_KEY_ID,
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    process.env.R2_ACCESS_KEY_ID,
  );
  const secretAccessKey = firstNonEmpty(
    process.env.CMS_R2_SECRET_ACCESS_KEY,
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    process.env.R2_SECRET_ACCESS_KEY,
  );
  return {
    enabled: Boolean(endpoint && bucket && accessKeyId && secretAccessKey),
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    prefix: process.env.CMS_R2_PREFIX ?? 'cms/',
    publicUrlBase: process.env.CMS_R2_PUBLIC_URL_BASE,
  };
}

let cachedClient: S3Client | null = null;
let cachedKey = '';

function getClient(cfg: CmsR2Config): S3Client | null {
  if (!cfg.enabled || !cfg.endpoint || !cfg.accessKeyId || !cfg.secretAccessKey) return null;
  const key = `${cfg.endpoint}|${cfg.accessKeyId}`;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  cachedKey = key;
  return cachedClient;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

export type UploadCmsMediaResult =
  | { ok: true; url: string; key: string; mode: 'public' | 'signed' }
  | { ok: false; error: 'storage_not_configured' | 'unsupported_mime' | 'upload_failed'; detail?: string };

export async function uploadCmsMedia(input: {
  buffer: Buffer;
  mime: string;
  originalName?: string;
}): Promise<UploadCmsMediaResult> {
  const cfg = buildCmsR2Config();
  const client = getClient(cfg);
  if (!client || !cfg.bucket) {
    return { ok: false, error: 'storage_not_configured' };
  }

  const ext = EXT_BY_MIME[input.mime];
  if (!ext) {
    return { ok: false, error: 'unsupported_mime', detail: input.mime };
  }

  const safeName = (input.originalName ?? 'image')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .slice(0, 60);
  const key = `${cfg.prefix}${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}.${ext}`;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mime,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  } catch (err) {
    return { ok: false, error: 'upload_failed', detail: String(err) };
  }

  if (cfg.publicUrlBase) {
    const base = cfg.publicUrlBase.replace(/\/+$/, '');
    return { ok: true, url: `${base}/${key}`, key, mode: 'public' };
  }

  try {
    const signedUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
    return { ok: true, url: signedUrl, key, mode: 'signed' };
  } catch (err) {
    return { ok: false, error: 'upload_failed', detail: String(err) };
  }
}

export function isCmsMediaConfigured(): boolean {
  return buildCmsR2Config().enabled;
}
