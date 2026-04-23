/**
 * Photographer → client gallery delivery for already-enhanced blobs.
 *
 * Sibling to `capture-showcase-bridge.ts`, but the input is raw
 * already-edited image blobs (from the web photo-enhancer's export
 * pipeline), not `capture_assets` rows. The output is the same: a
 * `photographer_client_galleries` + `client_gallery_images` pair the
 * client opens via `/client/gallery/:accessToken`.
 *
 * Why split from the capture bridge: the capture bridge is tightly
 * coupled to `capture_assets.previewKey/fullKey`, which always point
 * at the **original** tethered-upload bytes — never the edited
 * version. Running the bridge after retouch would deliver originals,
 * silently wasting the photographer's edit work. This service is the
 * other path: upload the edited blobs fresh to R2 + register them.
 */

import crypto from 'crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  clientGalleryImages,
  photographerClientGalleries,
} from '../migrations/schema.js';
import {
  buildCaptureR2Config,
  signAssetReadUrlForDelivery,
  type CaptureR2Config,
} from './capture-upload-service.js';

type Db = NodePgDatabase<Record<string, unknown>>;

export interface DeliveryImageInput {
  /// Display title on the gallery card. Typically the source filename
  /// minus extension — caller's responsibility to make this sensible.
  title: string;
  /// File name used in the R2 key. Sanitised server-side.
  filename: string;
  /// Mime type for the R2 PutObject + the gallery row.
  mimeType: string;
  /// Image bytes. We upload these directly; size is bounded by the
  /// multer ceiling in the route handler, not here.
  bytes: Buffer;
  /// Free-form per-image metadata (e.g. crop ratio used, sharpen level).
  /// Stored in `image_metadata` JSONB so future flows can read it back.
  metadata?: Record<string, unknown>;
}

export interface DeliveryInput {
  db: Db;
  photographerId: string;
  clientName: string;
  clientEmail: string;
  projectTitle: string;
  /// Optional pre-existing gallery id — when present we add images to
  /// it instead of creating a new one. `accessToken` is preserved so
  /// previously-shared links keep working.
  existingGalleryId?: string;
  images: DeliveryImageInput[];
  /// Dependency seams for tests. Default to real R2 + real crypto.
  r2Config?: CaptureR2Config;
  tokenFactory?: () => string;
  upload?: (key: string, body: Buffer, mime: string) => Promise<void>;
  sign?: (key: string) => Promise<string | null>;
  publicHostOverride?: string;
}

export type DeliveryResult =
  | {
      ok: true;
      galleryId: string;
      accessToken: string;
      shareUrl: string;
      uploadedImageCount: number;
      reusedExisting: boolean;
    }
  | {
      ok: false;
      error:
        | 'no_images'
        | 'r2_not_configured'
        | 'upload_failed'
        | 'persist_failed'
        | 'sign_failed'
        | 'existing_gallery_not_found';
      detail?: string;
    };

const PUBLIC_URL_FALLBACK = 'https://app.creatorhubn.com';

function generateAccessToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function sanitiseFilename(input: string, fallback: string): string {
  const cleaned = input
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, 160);
  return cleaned || fallback;
}

function buildDeliveryKey(params: {
  prefix: string;
  photographerId: string;
  galleryId: string;
  filename: string;
}): string {
  const name = sanitiseFilename(params.filename, 'image.bin');
  // Collision guard — two images in one batch can share a source name
  // (e.g. fixture.png variants), so every key carries a short random
  // suffix. Cheap, bounded, and preserves the original filename for
  // debuggability in the bucket.
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${params.prefix}deliveries/${params.photographerId}/${params.galleryId}/${suffix}-${name}`;
}

/**
 * Default uploader — straight S3 PutObject. Tests override via
 * `input.upload` so they don't need real R2 credentials.
 */
async function defaultUpload(
  cfg: CaptureR2Config,
  key: string,
  body: Buffer,
  mime: string,
): Promise<void> {
  if (!cfg.enabled || !cfg.endpoint || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
    throw new Error('r2_not_configured');
  }
  const client = new S3Client({
    region: 'auto',
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: mime,
    }),
  );
}

export async function createClientGalleryFromBlobs(
  input: DeliveryInput,
): Promise<DeliveryResult> {
  if (input.images.length === 0) {
    return { ok: false, error: 'no_images' };
  }

  const cfg = input.r2Config ?? buildCaptureR2Config();
  const upload = input.upload ?? ((key, body, mime) => defaultUpload(cfg, key, body, mime));
  const sign = input.sign ?? signAssetReadUrlForDelivery;
  const tokenFactory = input.tokenFactory ?? generateAccessToken;

  // Resolve target gallery — either reuse the caller's existing one
  // (Daniel adding more picks after a first delivery) or mint a new
  // one. Reusing preserves `accessToken` so previously-shared links
  // keep working.
  let galleryId: string;
  let accessToken: string;
  let reusedExisting = false;

  if (input.existingGalleryId) {
    const { eq } = await import('drizzle-orm');
    const rows = await input.db
      .select()
      .from(photographerClientGalleries)
      .where(eq(photographerClientGalleries.id, input.existingGalleryId))
      .limit(1);
    const row = rows[0];
    if (!row || row.photographerId !== input.photographerId) {
      return { ok: false, error: 'existing_gallery_not_found' };
    }
    galleryId = row.id;
    accessToken = row.accessToken;
    reusedExisting = true;
  } else {
    accessToken = tokenFactory();
    try {
      const inserted = await input.db
        .insert(photographerClientGalleries)
        .values({
          photographerId: input.photographerId,
          clientName: input.clientName,
          clientEmail: input.clientEmail.toLowerCase().trim(),
          projectTitle: input.projectTitle,
          accessToken,
          gallerySettings: {
            source: 'enhancer_delivery',
            createdVia: 'web_export',
          },
          status: 'active',
        })
        .returning({ id: photographerClientGalleries.id });
      const row = inserted[0];
      if (!row) {
        return { ok: false, error: 'persist_failed', detail: 'no row returned' };
      }
      galleryId = row.id;
    } catch (err) {
      return {
        ok: false,
        error: 'persist_failed',
        detail: String((err as Error)?.message ?? err),
      };
    }
  }

  // Upload each blob + row-insert gallery images. Any single failure
  // aborts the whole delivery — but the gallery row stays (useful for
  // resuming a partially-failed batch by calling again with the
  // existingGalleryId).
  let inserted = 0;
  let sortOrder = 0;
  for (const img of input.images) {
    const key = buildDeliveryKey({
      prefix: cfg.prefix,
      photographerId: input.photographerId,
      galleryId,
      filename: img.filename,
    });
    try {
      await upload(key, img.bytes, img.mimeType);
    } catch (err) {
      return {
        ok: false,
        error: 'upload_failed',
        detail: `${img.filename}: ${String((err as Error)?.message ?? err)}`,
      };
    }
    const signed = await sign(key);
    if (!signed) {
      return { ok: false, error: 'sign_failed', detail: `could not sign ${key}` };
    }
    try {
      await input.db.insert(clientGalleryImages).values({
        galleryId,
        photographerId: input.photographerId,
        imageTitle: img.title,
        thumbnailUrl: signed,
        fullSizeUrl: signed,
        imageMetadata: {
          ...(img.metadata ?? {}),
          source: 'enhancer_delivery',
          mimeType: img.mimeType,
        },
        sortOrder,
        isVisible: true,
      });
      inserted += 1;
      sortOrder += 1;
    } catch (err) {
      return {
        ok: false,
        error: 'persist_failed',
        detail: `${img.filename}: ${String((err as Error)?.message ?? err)}`,
      };
    }
  }

  const publicHost = (
    input.publicHostOverride ??
    process.env.CREATORHUB_PUBLIC_URL ??
    PUBLIC_URL_FALLBACK
  ).replace(/\/$/, '');
  const shareUrl = `${publicHost}/client/gallery/${accessToken}`;

  return {
    ok: true,
    galleryId,
    accessToken,
    shareUrl,
    uploadedImageCount: inserted,
    reusedExisting,
  };
}
