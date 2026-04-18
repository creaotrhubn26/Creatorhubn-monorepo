import crypto from 'crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import { captureAssets, captureSessions } from '../migrations/capture-schema.js';
import {
  clientGalleryImages,
  photographerClientGalleries,
} from '../migrations/schema.js';
import { signAssetReadUrlForDelivery } from './capture-upload-service.js';

type Db = NodePgDatabase<Record<string, unknown>>;

/// Bridges a Capture session into a UniversalShowcase gallery so the
/// photographer's iPad delivery surfaces in the same place as the rest
/// of their CreatorHub work — same URL pattern, same client-side viewer,
/// same dashboard.
///
/// The bridge is **lazy and idempotent**: each call upserts a single
/// `photographer_client_galleries` row keyed by sessionId (we tag it via
/// `gallery_settings.captureSessionId` so we can find it again), then
/// inserts only the images that aren't already there. Calling Deliver
/// twice with the same picks doesn't create a duplicate gallery — it
/// returns the existing accessToken plus any newly-included images.

export interface BridgePickInput {
  /// Capture-side asset id. Used to dedupe across re-deliveries — we
  /// stash this in `image_metadata.captureAssetId` for later lookup.
  captureAssetId: string;
  /// Display title for the gallery image (typically the original
  /// filename without extension).
  title: string;
  /// R2 storage key, NOT a URL. The bridge resigns it for delivery TTL.
  previewKey: string;
  /// Optional full-size key — used when available so the gallery viewer
  /// can show full-resolution. Falls back to preview when absent.
  fullKey?: string | null;
  /// Optional EXIF + capture metadata to surface in the gallery.
  metadata?: Record<string, unknown>;
}

export interface BridgeInput {
  db: Db;
  ownerUserId: string;
  captureSessionId: string;
  /// Project title shown to the client. Defaults to the capture
  /// session's name when omitted.
  projectTitle?: string;
  /// Required by `photographer_client_galleries.client_email`. The iPad
  /// can pass the photographer's own email as a placeholder when no
  /// specific client email is yet on file — the gallery is still
  /// gated by the access token, not the email.
  clientName: string;
  clientEmail: string;
  picks: BridgePickInput[];
  /// Override the public host used to construct the share URL. Defaults
  /// to `process.env.CREATORHUB_PUBLIC_URL` then to a hard fallback.
  publicHostOverride?: string;
  /// Test/dev seam — replace the access-token generator and the URL
  /// signer to make outputs deterministic.
  tokenFactory?: () => string;
  signKey?: (key: string) => Promise<string | null>;
}

export type BridgeError =
  | 'session_not_found'
  | 'no_picks'
  | 'sign_failed'
  | 'gallery_persist_failed';

export type BridgeResult =
  | {
      ok: true;
      galleryId: string;
      accessToken: string;
      shareUrl: string;
      uploadedImageCount: number;
      reusedExisting: boolean;
    }
  | { ok: false; error: BridgeError; detail?: string };

const PUBLIC_URL_FALLBACK = 'https://app.creatorhubn.com';

export async function bridgeCaptureSessionToGallery(
  input: BridgeInput,
): Promise<BridgeResult> {
  if (input.picks.length === 0) {
    return { ok: false, error: 'no_picks' };
  }

  // Ownership gate: confirm the photographer owns the Capture session
  // being bridged. Without this someone with a session id could trick
  // us into making a gallery against their account.
  const owned = await input.db
    .select({ id: captureSessions.id, name: captureSessions.name })
    .from(captureSessions)
    .where(
      and(
        eq(captureSessions.id, input.captureSessionId),
        eq(captureSessions.ownerUserId, input.ownerUserId),
      ),
    )
    .limit(1);
  if (owned.length === 0) {
    return { ok: false, error: 'session_not_found' };
  }
  const session = owned[0]!;

  // Look for an existing bridge for this session. We tag it inside
  // gallery_settings rather than adding a column so we don't need a
  // migration for the MVP — readable enough via JSONB.
  const existing = await input.db
    .select()
    .from(photographerClientGalleries)
    .where(eq(photographerClientGalleries.photographerId, input.ownerUserId));
  const existingForSession = existing.find((row) => {
    const settings = (row.gallerySettings ?? {}) as Record<string, unknown>;
    return settings.captureSessionId === input.captureSessionId;
  });

  let galleryId: string;
  let accessToken: string;
  const reusedExisting = Boolean(existingForSession);

  if (existingForSession) {
    galleryId = existingForSession.id;
    accessToken = existingForSession.accessToken;
  } else {
    const tokenFactory = input.tokenFactory ?? (() => generateAccessToken());
    accessToken = tokenFactory();
    const projectTitle = input.projectTitle ?? session.name ?? 'Capture session';
    try {
      const inserted = await input.db
        .insert(photographerClientGalleries)
        .values({
          photographerId: input.ownerUserId,
          clientName: input.clientName,
          clientEmail: input.clientEmail.toLowerCase().trim(),
          projectTitle,
          accessToken,
          gallerySettings: {
            captureSessionId: input.captureSessionId,
            source: 'capture',
            createdVia: 'ipad_deliver',
          },
          status: 'active',
        })
        .returning({ id: photographerClientGalleries.id });
      const row = inserted[0];
      if (!row) {
        return { ok: false, error: 'gallery_persist_failed', detail: 'no row returned' };
      }
      galleryId = row.id;
    } catch (err) {
      return {
        ok: false,
        error: 'gallery_persist_failed',
        detail: String((err as Error)?.message ?? err),
      };
    }
  }

  // Walk the picks and add any image that isn't already in the gallery.
  // Dedupe key: image_metadata.captureAssetId.
  const alreadyInGallery = await input.db
    .select({
      id: clientGalleryImages.id,
      metadata: clientGalleryImages.imageMetadata,
    })
    .from(clientGalleryImages)
    .where(eq(clientGalleryImages.galleryId, galleryId));
  const seenAssetIds = new Set<string>();
  for (const img of alreadyInGallery) {
    const md = (img.metadata ?? {}) as Record<string, unknown>;
    if (typeof md.captureAssetId === 'string') seenAssetIds.add(md.captureAssetId);
  }

  const signer = input.signKey ?? signAssetReadUrlForDelivery;
  let inserted = 0;
  let sortOrder = alreadyInGallery.length;
  for (const pick of input.picks) {
    if (seenAssetIds.has(pick.captureAssetId)) continue;
    const previewSigned = await signer(pick.previewKey);
    if (!previewSigned) {
      return {
        ok: false,
        error: 'sign_failed',
        detail: `could not sign preview for asset ${pick.captureAssetId}`,
      };
    }
    const fullSigned = pick.fullKey ? (await signer(pick.fullKey)) ?? previewSigned : previewSigned;
    try {
      await input.db.insert(clientGalleryImages).values({
        galleryId,
        photographerId: input.ownerUserId,
        imageTitle: pick.title,
        thumbnailUrl: previewSigned,
        fullSizeUrl: fullSigned,
        imageMetadata: {
          ...(pick.metadata ?? {}),
          captureAssetId: pick.captureAssetId,
          source: 'capture',
        },
        sortOrder,
        isVisible: true,
      });
      inserted += 1;
      sortOrder += 1;
    } catch (err) {
      return {
        ok: false,
        error: 'gallery_persist_failed',
        detail: `failed to add image ${pick.captureAssetId}: ${String((err as Error)?.message ?? err)}`,
      };
    }
  }

  const publicHost = (input.publicHostOverride ?? process.env.CREATORHUB_PUBLIC_URL ?? PUBLIC_URL_FALLBACK)
    .replace(/\/$/, '');
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

/// 32-character URL-safe access token. Matches the existing pattern other
/// gallery flows in CreatorHub use — base64url with padding stripped.
function generateAccessToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/// Convenience helper: pull all assets from a Capture session that
/// match a filter and convert them to BridgePickInputs. Used by the
/// `/deliver-to-showcase` route so the iPad can pass simple criteria
/// instead of a full pick list.
export async function pickAssetsFromCaptureSession(
  db: Db,
  ownerUserId: string,
  sessionId: string,
  filter: 'flagged' | 'rating_at_least_4' | 'picks_or_4plus' | 'all_non_rejected',
): Promise<BridgePickInput[]> {
  const owned = await db
    .select({ id: captureSessions.id })
    .from(captureSessions)
    .where(and(eq(captureSessions.id, sessionId), eq(captureSessions.ownerUserId, ownerUserId)))
    .limit(1);
  if (owned.length === 0) return [];

  const all = await db
    .select()
    .from(captureAssets)
    .where(eq(captureAssets.sessionId, sessionId));

  const filtered = all.filter((a) => {
    if (a.rejected) return false;
    switch (filter) {
      case 'flagged':            return Boolean(a.flaggedForClient);
      case 'rating_at_least_4':  return (a.rating ?? 0) >= 4;
      case 'picks_or_4plus':     return Boolean(a.flaggedForClient) || (a.rating ?? 0) >= 4;
      case 'all_non_rejected':   return true;
    }
  });

  return filtered
    .filter((a) => Boolean(a.previewKey))
    .map<BridgePickInput>((a) => ({
      captureAssetId: a.id,
      title: stripExtension(a.originalFilename),
      previewKey: a.previewKey!,
      fullKey: a.fullKey ?? null,
      metadata: {
        rating: a.rating ?? 0,
        flaggedForClient: Boolean(a.flaggedForClient),
        captureTime: a.captureTime?.toISOString?.() ?? null,
        originalFilename: a.originalFilename,
      },
    }));
}

function stripExtension(name: string): string {
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.slice(0, lastDot) : name;
}

/// Re-exported so route handlers can compose bridge + asset listing
/// without two separate imports.
export { inArray };
