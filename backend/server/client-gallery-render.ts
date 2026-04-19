/**
 * Read-side for photographer_client_galleries: look up a gallery by its
 * public accessToken and return metadata + a list of images with URLs
 * that are guaranteed to be fresh right now.
 *
 * Why re-sign on render: the Capture → Showcase bridge stores 7-day
 * signed R2 URLs in client_gallery_images.thumbnailUrl/fullSizeUrl at
 * delivery time. Once the 7 days lapse the gallery is dead — images
 * 404 for the client even though the rows still exist. Every call to
 * /api/client/gallery/:accessToken/images walks each image's
 * captureAssetId back to the current R2 key and re-signs with a fresh
 * 5-minute TTL. Images that aren't Capture-sourced (no captureAssetId
 * in the metadata) fall through to the stored URL — we can't re-sign
 * something whose key we don't know.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import { captureAssets } from '../migrations/capture-schema.js';
import {
  clientGalleryImages,
  photographerClientGalleries,
} from '../migrations/schema.js';
import { signAssetReadUrl } from './capture-upload-service.js';

type Db = NodePgDatabase<Record<string, unknown>>;

export interface ClientGalleryInfo {
  id: string;
  photographerId: string;
  clientName: string;
  clientEmail: string;
  projectTitle: string;
  status: string | null;
  createdAt: string | null;
  completedAt: string | null;
  // Passed through to the viewer so it knows where the gallery came from.
  source: string | null;
  captureSessionId: string | null;
  /// Project the gallery belongs to. Null for galleries not bound
  /// to a ProjectCreationWithMemoryCards project (e.g. ad-hoc
  /// uploads). Used as the key for the project change log.
  projectId: string | null;
}

export interface ClientGalleryImageRendered {
  id: string;
  imageTitle: string;
  imageDescription: string | null;
  thumbnailUrl: string;
  fullSizeUrl: string;
  watermarkedUrl: string | null;
  tags: unknown;
  sortOrder: number;
  isVisible: boolean;
  metadata: Record<string, unknown> | null;
  // Marks images whose URLs we couldn't re-sign so the UI can surface
  // a "image may have expired" state instead of silently 404ing.
  signingFailed: boolean;
}

/**
 * Look up a gallery by its public accessToken. Returns null when the
 * token doesn't match any gallery, or when the gallery exists but is
 * not active — in both cases the caller should treat this as a 404 so
 * token enumeration can't distinguish "wrong token" from "revoked".
 */
export async function fetchClientGalleryByAccessToken(
  db: Db,
  accessToken: string,
): Promise<ClientGalleryInfo | null> {
  if (!accessToken) return null;
  const rows = await db
    .select()
    .from(photographerClientGalleries)
    .where(eq(photographerClientGalleries.accessToken, accessToken))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.status && row.status !== 'active') return null;
  const settings = (row.gallerySettings ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    photographerId: row.photographerId,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    projectTitle: row.projectTitle,
    status: row.status ?? null,
    createdAt: row.createdAt ?? null,
    completedAt: row.completedAt ?? null,
    source: typeof settings.source === 'string' ? settings.source : null,
    captureSessionId:
      typeof settings.captureSessionId === 'string' ? settings.captureSessionId : null,
    projectId:
      typeof settings.projectId === 'string' ? settings.projectId : null,
  };
}

/**
 * List every visible image on the gallery with URLs that are fresh
 * right now. Capture-sourced images (identified by image_metadata
 * .captureAssetId) are re-signed from the current captureAssets row's
 * R2 keys; other images pass through their stored URLs unchanged.
 *
 * The signer is injectable so tests can stub it without touching the
 * real R2 client.
 */
export async function listClientGalleryImages(
  db: Db,
  galleryId: string,
  options: { signKey?: (key: string | null) => Promise<string | null> } = {},
): Promise<ClientGalleryImageRendered[]> {
  const signer = options.signKey ?? signAssetReadUrl;
  const images = await db
    .select()
    .from(clientGalleryImages)
    .where(
      and(
        eq(clientGalleryImages.galleryId, galleryId),
        eq(clientGalleryImages.isVisible, true),
      ),
    );
  if (images.length === 0) return [];

  // Collect every captureAssetId in the gallery so we can look up the
  // current R2 key in a single query instead of one per image.
  const assetIds: string[] = [];
  for (const row of images) {
    const md = (row.imageMetadata ?? {}) as Record<string, unknown>;
    if (typeof md.captureAssetId === 'string') assetIds.push(md.captureAssetId);
  }
  let keysByAssetId = new Map<string, { previewKey: string | null; fullKey: string | null }>();
  if (assetIds.length > 0) {
    const assets = await db
      .select({ id: captureAssets.id, previewKey: captureAssets.previewKey, fullKey: captureAssets.fullKey })
      .from(captureAssets)
      .where(inArray(captureAssets.id, assetIds));
    keysByAssetId = new Map(
      assets.map((a) => [a.id, { previewKey: a.previewKey ?? null, fullKey: a.fullKey ?? null }]),
    );
  }

  const rendered: ClientGalleryImageRendered[] = [];
  for (const row of images) {
    const md = (row.imageMetadata ?? {}) as Record<string, unknown>;
    const captureAssetId =
      typeof md.captureAssetId === 'string' ? md.captureAssetId : null;

    let thumbnailUrl = row.thumbnailUrl;
    let fullSizeUrl = row.fullSizeUrl;
    let signingFailed = false;

    if (captureAssetId) {
      const keys = keysByAssetId.get(captureAssetId) ?? null;
      const previewKey = keys?.previewKey ?? null;
      const fullKey = keys?.fullKey ?? previewKey;
      const [previewSigned, fullSigned] = await Promise.all([
        signer(previewKey),
        signer(fullKey),
      ]);
      if (previewSigned) {
        thumbnailUrl = previewSigned;
      } else {
        signingFailed = true;
      }
      if (fullSigned) {
        fullSizeUrl = fullSigned;
      } else if (previewSigned) {
        // Fall back to the (now-fresh) preview rather than the stale
        // stored URL when re-signing the full-size variant fails.
        fullSizeUrl = previewSigned;
      } else {
        signingFailed = true;
      }
    }

    rendered.push({
      id: row.id,
      imageTitle: row.imageTitle,
      imageDescription: row.imageDescription ?? null,
      thumbnailUrl,
      fullSizeUrl,
      watermarkedUrl: row.watermarkedUrl ?? null,
      tags: row.tags ?? [],
      sortOrder: row.sortOrder ?? 0,
      isVisible: row.isVisible ?? true,
      metadata: (row.imageMetadata as Record<string, unknown> | null) ?? null,
      signingFailed,
    });
  }
  // Sort by sortOrder — Drizzle would need an orderBy() but that
  // requires importing asc(); doing it client-side is cheap at N<1000.
  rendered.sort((a, b) => a.sortOrder - b.sortOrder);
  return rendered;
}
