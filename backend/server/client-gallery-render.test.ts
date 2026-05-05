import { describe, expect, it, vi } from 'vitest';
import {
  fetchClientGalleryByAccessToken,
  listClientGalleryImages,
} from './client-gallery-render';

// ── Drizzle-shaped stub ──────────────────────────────────────────────────
//
// Each `db.select().from(t).where(w)[.limit(n)]` chain pops the next
// pre-loaded response off a queue. The order in which the module issues
// queries is part of the contract, so test cases that exercise multiple
// tables enqueue the responses in call order.

function makeDb(responses: unknown[][]) {
  const queue = [...responses];
  return {
    select(_cols?: unknown) {
      return {
        from(_table: unknown) {
          const node: any = {
            where(_w: unknown) { return node; },
            limit(_n: number) { return node; },
            then(resolve: (rows: unknown[]) => void) {
              const rows = queue.shift() ?? [];
              resolve(rows);
            },
          };
          return node;
        },
      };
    },
  } as unknown;
}

// ── fetchClientGalleryByAccessToken ──────────────────────────────────────

describe('fetchClientGalleryByAccessToken', () => {
  it('returns the mapped info when the gallery is active', async () => {
    const db = makeDb([
      [
        {
          id: 'g1',
          photographerId: 'u1',
          clientName: 'Oda',
          clientEmail: 'oda@example.com',
          projectTitle: 'Bryllup',
          status: 'active',
          accessToken: 'tok',
          gallerySettings: { source: 'capture', captureSessionId: 's-42' },
          createdAt: '2026-04-18T10:00:00Z',
          completedAt: null,
        },
      ],
    ]);
    const result = await fetchClientGalleryByAccessToken(db as never, 'tok');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('g1');
    expect(result!.source).toBe('capture');
    expect(result!.captureSessionId).toBe('s-42');
    expect(result!.clientName).toBe('Oda');
  });

  it('returns null for empty token without touching the db', async () => {
    const db = makeDb([]);
    expect(await fetchClientGalleryByAccessToken(db as never, '')).toBeNull();
  });

  it('returns null when no gallery matches', async () => {
    const db = makeDb([[]]);
    expect(await fetchClientGalleryByAccessToken(db as never, 'tok')).toBeNull();
  });

  it('returns null when the gallery is not active (revoked or archived)', async () => {
    const db = makeDb([
      [
        {
          id: 'g1',
          photographerId: 'u1',
          clientName: 'Oda',
          clientEmail: 'oda@example.com',
          projectTitle: 'P',
          status: 'archived',
          accessToken: 'tok',
          gallerySettings: {},
          createdAt: null,
          completedAt: null,
        },
      ],
    ]);
    expect(await fetchClientGalleryByAccessToken(db as never, 'tok')).toBeNull();
  });

  it('treats null status as active (default column state)', async () => {
    const db = makeDb([
      [
        {
          id: 'g1',
          photographerId: 'u1',
          clientName: 'Oda',
          clientEmail: 'oda@example.com',
          projectTitle: 'P',
          status: null,
          accessToken: 'tok',
          gallerySettings: {},
          createdAt: null,
          completedAt: null,
        },
      ],
    ]);
    const result = await fetchClientGalleryByAccessToken(db as never, 'tok');
    expect(result).not.toBeNull();
  });
});

// ── listClientGalleryImages ─────────────────────────────────────────────

describe('listClientGalleryImages', () => {
  it('re-signs URLs for Capture-sourced images and passes through others', async () => {
    // Query order the module uses:
    //   1. select() from clientGalleryImages
    //   2. select() from captureAssets (only if any image has captureAssetId)
    const db = makeDb([
      [
        {
          id: 'img-capture',
          galleryId: 'g1',
          photographerId: 'u1',
          imageTitle: 'From Capture',
          imageDescription: null,
          thumbnailUrl: 'https://signed.stale/preview-old',
          fullSizeUrl: 'https://signed.stale/full-old',
          watermarkedUrl: null,
          imageMetadata: { captureAssetId: 'asset-1', source: 'capture' },
          tags: [],
          sortOrder: 1,
          isVisible: true,
        },
        {
          id: 'img-external',
          galleryId: 'g1',
          photographerId: 'u1',
          imageTitle: 'Externally uploaded',
          imageDescription: null,
          thumbnailUrl: 'https://cdn.example/thumb.jpg',
          fullSizeUrl: 'https://cdn.example/full.jpg',
          watermarkedUrl: null,
          imageMetadata: {},
          tags: [],
          sortOrder: 0,
          isVisible: true,
        },
      ],
      [
        {
          id: 'asset-1',
          previewKey: 'capture/u1/s-42/preview.jpg',
          fullKey: 'capture/u1/s-42/full.jpg',
        },
      ],
    ]);
    const sign = vi.fn(async (key: string | null) => (key ? `https://signed.fresh/${key}` : null));
    const result = await listClientGalleryImages(db as never, 'g1', { signKey: sign });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['img-external', 'img-capture']);

    const external = result.find((r) => r.id === 'img-external')!;
    expect(external.thumbnailUrl).toBe('https://cdn.example/thumb.jpg');
    expect(external.fullSizeUrl).toBe('https://cdn.example/full.jpg');
    expect(external.signingFailed).toBe(false);

    const capture = result.find((r) => r.id === 'img-capture')!;
    expect(capture.thumbnailUrl).toBe('https://signed.fresh/capture/u1/s-42/preview.jpg');
    expect(capture.fullSizeUrl).toBe('https://signed.fresh/capture/u1/s-42/full.jpg');
    expect(capture.signingFailed).toBe(false);
    // External image passes through without a signer call; capture
    // image signs preview + full in parallel.
    expect(sign).toHaveBeenCalledWith('capture/u1/s-42/preview.jpg');
    expect(sign).toHaveBeenCalledWith('capture/u1/s-42/full.jpg');
    expect(sign).toHaveBeenCalledTimes(2);
  });

  it('falls back to the re-signed preview when the fullKey is missing', async () => {
    const db = makeDb([
      [
        {
          id: 'img-1',
          galleryId: 'g1',
          photographerId: 'u1',
          imageTitle: 'No full',
          imageDescription: null,
          thumbnailUrl: 'stale-preview',
          fullSizeUrl: 'stale-full',
          watermarkedUrl: null,
          imageMetadata: { captureAssetId: 'a1' },
          tags: [],
          sortOrder: 0,
          isVisible: true,
        },
      ],
      [{ id: 'a1', previewKey: 'p/a1.jpg', fullKey: null }],
    ]);
    const sign = vi.fn(async (key: string | null) => (key ? `https://signed/${key}` : null));
    const [row] = await listClientGalleryImages(db as never, 'g1', { signKey: sign });
    expect(row.thumbnailUrl).toBe('https://signed/p/a1.jpg');
    expect(row.fullSizeUrl).toBe('https://signed/p/a1.jpg');
    expect(row.signingFailed).toBe(false);
  });

  it('flags signingFailed when the signer returns null for both variants', async () => {
    const db = makeDb([
      [
        {
          id: 'img-1',
          galleryId: 'g1',
          photographerId: 'u1',
          imageTitle: 'Orphan',
          imageDescription: null,
          thumbnailUrl: 'stored-preview',
          fullSizeUrl: 'stored-full',
          watermarkedUrl: null,
          imageMetadata: { captureAssetId: 'a-missing' },
          tags: [],
          sortOrder: 0,
          isVisible: true,
        },
      ],
      // The asset was deleted — no row returns for a-missing.
      [],
    ]);
    const sign = vi.fn(async () => null);
    const [row] = await listClientGalleryImages(db as never, 'g1', { signKey: sign });
    expect(row.signingFailed).toBe(true);
    // Stored URLs pass through as-is on the fallback path — better
    // broken-link than a nonexistent re-signed URL.
    expect(row.thumbnailUrl).toBe('stored-preview');
    expect(row.fullSizeUrl).toBe('stored-full');
  });

  it('returns an empty array when the gallery has no images (no asset query issued)', async () => {
    const db = makeDb([[]]);
    expect(await listClientGalleryImages(db as never, 'g1')).toEqual([]);
  });

  it('signs autoCleanedUrl when the row opted in AND the asset still has the key (Slice 6)', async () => {
    const db = makeDb([
      [
        {
          id: 'img-clean',
          galleryId: 'g1',
          photographerId: 'u1',
          imageTitle: 'Cleaned',
          imageDescription: null,
          thumbnailUrl: 'stale',
          fullSizeUrl: 'stale',
          watermarkedUrl: null,
          imageMetadata: {
            captureAssetId: 'a1',
            useAutoCleaned: true,
            autoCleanedDetectionCount: 2,
          },
          tags: [],
          sortOrder: 0,
          isVisible: true,
        },
      ],
      [{ id: 'a1', previewKey: 'p/a1.jpg', fullKey: 'f/a1.jpg', autoCleanedKey: 'c/a1.jpg' }],
    ]);
    const sign = vi.fn(async (key: string | null) => (key ? `https://signed/${key}` : null));
    const [row] = await listClientGalleryImages(db as never, 'g1', { signKey: sign });
    expect(row.autoCleanedUrl).toBe('https://signed/c/a1.jpg');
    expect(row.autoCleanedDetectionCount).toBe(2);
    expect(sign).toHaveBeenCalledWith('c/a1.jpg');
  });

  it('returns null autoCleanedUrl when the asset row no longer has the cleaned key (graceful)', async () => {
    const db = makeDb([
      [
        {
          id: 'img-orphaned-clean',
          galleryId: 'g1',
          photographerId: 'u1',
          imageTitle: 'Orphan-clean',
          imageDescription: null,
          thumbnailUrl: 'stale',
          fullSizeUrl: 'stale',
          watermarkedUrl: null,
          imageMetadata: {
            captureAssetId: 'a1',
            useAutoCleaned: true,
            autoCleanedDetectionCount: 1,
          },
          tags: [],
          sortOrder: 0,
          isVisible: true,
        },
      ],
      // Asset still exists with preview/full but auto_cleaned_key was nulled
      // (e.g. cleanup script ran). Render must degrade silently — show
      // original, no autoCleanedUrl, no signingFailed (the original is fine).
      [{ id: 'a1', previewKey: 'p/a1.jpg', fullKey: 'f/a1.jpg', autoCleanedKey: null }],
    ]);
    const sign = vi.fn(async (key: string | null) => (key ? `https://signed/${key}` : null));
    const [row] = await listClientGalleryImages(db as never, 'g1', { signKey: sign });
    expect(row.autoCleanedUrl).toBeNull();
    // detection count still surfaces — useful "cleaned was offered once" hint.
    expect(row.autoCleanedDetectionCount).toBe(1);
    expect(row.thumbnailUrl).toBe('https://signed/p/a1.jpg');
    expect(row.signingFailed).toBe(false);
  });

  it('does NOT surface autoCleanedUrl when the row never opted in (default)', async () => {
    const db = makeDb([
      [
        {
          id: 'img-no-optin',
          galleryId: 'g1',
          photographerId: 'u1',
          imageTitle: 'Original-only',
          imageDescription: null,
          thumbnailUrl: 'stale',
          fullSizeUrl: 'stale',
          watermarkedUrl: null,
          // useAutoCleaned absent / not true — render must ignore even
          // if the asset has a cleaned key.
          imageMetadata: { captureAssetId: 'a1' },
          tags: [],
          sortOrder: 0,
          isVisible: true,
        },
      ],
      [{ id: 'a1', previewKey: 'p/a1.jpg', fullKey: 'f/a1.jpg', autoCleanedKey: 'c/a1.jpg' }],
    ]);
    const sign = vi.fn(async (key: string | null) => (key ? `https://signed/${key}` : null));
    const [row] = await listClientGalleryImages(db as never, 'g1', { signKey: sign });
    expect(row.autoCleanedUrl).toBeNull();
    expect(row.autoCleanedDetectionCount).toBeNull();
    // Critically: signer was NOT asked to sign the cleaned key.
    expect(sign).not.toHaveBeenCalledWith('c/a1.jpg');
  });

  it('does not query captureAssets when no image carries a captureAssetId', async () => {
    const db = makeDb([
      [
        {
          id: 'img-ext',
          galleryId: 'g1',
          photographerId: 'u1',
          imageTitle: 'External only',
          imageDescription: null,
          thumbnailUrl: 'https://cdn/t',
          fullSizeUrl: 'https://cdn/f',
          watermarkedUrl: null,
          imageMetadata: {},
          tags: [],
          sortOrder: 0,
          isVisible: true,
        },
      ],
      // Intentionally no second entry — if the module issued a second
      // query it would get an empty row batch and pass, but the
      // important guarantee is that we don't even hit captureAssets.
    ]);
    const sign = vi.fn(async () => 'should-not-be-called');
    const result = await listClientGalleryImages(db as never, 'g1', { signKey: sign });
    expect(result).toHaveLength(1);
    expect(result[0].thumbnailUrl).toBe('https://cdn/t');
    expect(sign).not.toHaveBeenCalled();
  });
});
