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
 * other path: upload the edited blobs to CreatorHub S3 + register them.
 */

import crypto from 'crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  clientGalleryImages,
  photographerClientGalleries,
} from '../migrations/schema.js';
import { signAssetReadUrlForDelivery } from './capture-upload-service.js';
import { putCreatorHubObject } from './creatorhub-object-storage.js';
import { buildPhotoRoomDeliveryKey } from './photo-room-storage-contract.js';

type Db = NodePgDatabase<Record<string, unknown>>;

export interface DeliveryImageInput {
  /// Display title on the gallery card. Typically the source filename
  /// minus extension — caller's responsibility to make this sensible.
  title: string;
  /// File name used in the private CreatorHub S3 key. Sanitised server-side.
  filename: string;
  /// Mime type for the S3 PutObject + the gallery row.
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
  projectId?: string | null;
  clientName: string;
  clientEmail: string;
  projectTitle: string;
  /// Optional pre-existing gallery id — when present we add images to
  /// it instead of creating a new one. `accessToken` is preserved so
  /// previously-shared links keep working.
  existingGalleryId?: string;
  /// Slice 9X.14 — Photo Enhancer job-id. Genereres på frontend ved
  /// hver export-batch og lagres i image_metadata.enhancerJobId per
  /// rad. Lar UI senere gruppere "alle bilder fra dagens batch" og
  /// gir cross-system sporbarhet i analytics_events.
  enhancerJobId?: string;
  images: DeliveryImageInput[];
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
        | 'creatorhub_storage_not_configured'
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

async function defaultUpload(key: string, body: Buffer, mime: string): Promise<void> {
  if (!await putCreatorHubObject(key, body, mime, { product: 'photo-room' })) {
    throw new Error('creatorhub_storage_not_configured');
  }
}

export async function createClientGalleryFromBlobs(
  input: DeliveryInput,
): Promise<DeliveryResult> {
  if (input.images.length === 0) {
    return { ok: false, error: 'no_images' };
  }

  const upload = input.upload ?? defaultUpload;
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
    if (!row || row.photographerId !== input.photographerId
      || (input.projectId && row.projectId !== input.projectId)) {
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
          projectId: input.projectId || null,
          clientName: input.clientName,
          clientEmail: input.clientEmail.toLowerCase().trim(),
          projectTitle: input.projectTitle,
          accessToken,
          gallerySettings: {
            source: 'enhancer_delivery',
            createdVia: 'web_export',
            ...(input.projectId ? { projectId: input.projectId } : {}),
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
    const key = buildPhotoRoomDeliveryKey({
      userId: input.photographerId,
      projectId: input.projectId,
      galleryId,
      objectId: crypto.randomBytes(4).toString('hex'),
      fileName: img.filename,
    });
    try {
      await upload(key, img.bytes, img.mimeType);
    } catch (err) {
      if (String((err as Error)?.message ?? err).includes('creatorhub_storage_not_configured')) {
        return { ok: false, error: 'creatorhub_storage_not_configured' };
      }
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
          // Slice 9X.14 — Photo Enhancer job-tracking. Stempler hver
          // bilde-rad med den batch-id'en som ble generert på frontend.
          // Tillater senere gruppering "alle bilder fra job X" og lar
          // BI-grafen joine photo_enhancer.batch_pushed-events mot
          // konkrete gallery-rader.
          ...(input.enhancerJobId ? { enhancerJobId: input.enhancerJobId } : {}),
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
