/**
 * Hydrate the web photo-enhancer session from an iPad capture session.
 *
 * The iPad pushes per-asset cull state (rating 0-5, pick / reject /
 * flag-for-client) to `capture_assets` via PATCH during tethered shoot.
 * Before this module existed the web enhancer had no way to read that
 * state — every image started at rating 0, flag 'none', throwing away
 * the photographer's iPad work. Here we bridge that: fetch the session's
 * assets, pull each preview blob down as a `File`, and project the cull
 * columns onto the web `SessionImage` shape the enhancer already uses.
 *
 * Pure helpers (mapping, URL resolution) live here so they can be
 * unit-tested without touching `fetch`. The loader entrypoint
 * (`loadCaptureSessionAssets`) takes an injectable fetcher so tests
 * can stub the network.
 */

import type { SessionImageFlag, StarRating } from './types';

/** Shape returned by `GET /api/capture/sessions/:id/assets`. Mirrors
 *  the `capture_assets` table columns plus the signed `previewUrl`
 *  the route attaches per row. */
export interface CaptureAssetRow {
  id: string;
  sessionId: string;
  originalFilename: string;
  captureTime: string;
  previewKey: string | null;
  previewUrl: string | null;
  fullKey: string | null;
  rawKey: string | null;
  mime: string;
  sizeBytes: number | null;
  state: string;
  rating: number;
  colorLabel: string | null;
  flaggedForClient: boolean;
  rejected: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The subset of `SessionImage` fields we can populate from a capture
 *  asset. The caller merges this with the usual session-image defaults
 *  (settings, history, faceStatus, etc.) to produce a full SessionImage. */
export interface HydratedCaptureImage {
  file: File;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  lastModified: number;
  rating: StarRating;
  flag: SessionImageFlag;
  /** Capture ordering preserved as session sequence — enhancer UI uses it
   *  to keep filmstrip order stable across loads. */
  sequence: number;
  /** Keep the iPad's asset id around so later flows (re-sync, delivery
   *  round-trip) can match a web edit back to its capture origin. */
  captureAssetId: string;
}

export function mapRatingToStar(rating: number): StarRating {
  if (!Number.isFinite(rating)) return 0;
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return clamped as StarRating;
}

/**
 * Derive the web's single `flag` field from the iPad's two-boolean
 * pick/reject model. `rejected` wins if both are set — rejecting an
 * image is a stronger signal than flagging it for client.
 */
export function mapCullToFlag(
  flaggedForClient: boolean,
  rejected: boolean,
): SessionImageFlag {
  if (rejected) return 'reject';
  if (flaggedForClient) return 'pick';
  return 'none';
}

export type PreviewFetcher = (url: string) => Promise<Blob>;

/** Default fetcher — plain `fetch` with a readable error message. */
export const defaultPreviewFetcher: PreviewFetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `capture-session preview fetch failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.blob();
};

/**
 * Hydrate a single capture asset into the shape the enhancer expects.
 * Skips assets with no `previewUrl` (not yet uploaded, or preview
 * transcoding still in flight) — they're not actionable on the web
 * yet, and silently dropping them beats failing the whole load.
 */
export async function hydrateCaptureAsset(
  row: CaptureAssetRow,
  index: number,
  fetchPreview: PreviewFetcher = defaultPreviewFetcher,
): Promise<HydratedCaptureImage | null> {
  if (!row.previewUrl) return null;
  const blob = await fetchPreview(row.previewUrl);
  const lastModified = Date.parse(row.captureTime) || Date.now();
  const file = new File([blob], row.originalFilename, {
    type: row.mime || blob.type || 'application/octet-stream',
    lastModified,
  });
  return {
    file,
    fileName: row.originalFilename,
    sizeBytes: row.sizeBytes ?? file.size,
    mimeType: file.type,
    lastModified,
    rating: mapRatingToStar(row.rating),
    flag: mapCullToFlag(row.flaggedForClient, row.rejected),
    sequence: index + 1,
    captureAssetId: row.id,
  };
}

export type AssetListFetcher = (sessionId: string) => Promise<CaptureAssetRow[]>;

export const defaultAssetListFetcher: AssetListFetcher = async (sessionId) => {
  const response = await fetch(
    `/api/capture/sessions/${encodeURIComponent(sessionId)}/assets`,
  );
  if (!response.ok) {
    throw new Error(
      `capture-session list fetch failed: ${response.status} ${response.statusText}`,
    );
  }
  const body = (await response.json()) as { assets?: CaptureAssetRow[] };
  return body.assets ?? [];
};

/**
 * Fetch every asset in a capture session and hydrate each into the
 * enhancer's image model. Failures on individual assets are isolated —
 * a broken preview URL shouldn't kill the whole session load.
 */
export async function loadCaptureSessionAssets(
  sessionId: string,
  options: {
    listAssets?: AssetListFetcher;
    fetchPreview?: PreviewFetcher;
  } = {},
): Promise<HydratedCaptureImage[]> {
  const list = options.listAssets ?? defaultAssetListFetcher;
  const fetchPreview = options.fetchPreview ?? defaultPreviewFetcher;
  const rows = await list(sessionId);
  const results: HydratedCaptureImage[] = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      const hydrated = await hydrateCaptureAsset(rows[i], i, fetchPreview);
      if (hydrated) results.push(hydrated);
    } catch (err) {
      // Log but don't abort — 1 broken preview shouldn't sink 200 others.
      console.warn(
        `[capture-session] skipped asset ${rows[i].id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  return results;
}
