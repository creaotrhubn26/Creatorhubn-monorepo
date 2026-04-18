import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bridgeCaptureSessionToGallery,
  type BridgeInput,
  type BridgePickInput,
} from './capture-showcase-bridge.js';

// We don't go near a real Postgres in unit tests — pass a stub with the
// slice of the drizzle/db API we actually call. The bridge uses three
// query shapes: select+from+where(+limit), select+from+where, and
// insert+values(+returning) — each is replaced by a recorded fixture.

interface TableHandle {
  rows: Record<string, unknown>[];
}

function makeDbStub(opts: {
  ownedSessions?: Record<string, unknown>[];
  existingGalleries?: Record<string, unknown>[];
  existingImages?: Record<string, unknown>[];
  insertGalleryReturns?: Record<string, unknown>[];
  failOnImageInsert?: boolean;
} = {}) {
  const inserts: { table: string; values: any }[] = [];

  const db = {
    select: (_cols?: any) => ({
      from: (table: any) => {
        const tableName = (table?.[Symbol.for('drizzle:Name')] ?? table?.name ?? '').toString();
        return {
          where: (_cond: any) => {
            const result: any = {
              limit: (_n: number) => Promise.resolve(opts.ownedSessions ?? []),
            };
            // Make the bare `await` (no .limit) path return existing
            // galleries / images depending on the table.
            if (tableName.includes('photographer_client_galleries')) {
              return Object.assign(
                Promise.resolve(opts.existingGalleries ?? []),
                result,
              );
            }
            if (tableName.includes('client_gallery_images')) {
              return Object.assign(
                Promise.resolve(opts.existingImages ?? []),
                result,
              );
            }
            // captureSessions — used with .limit(1) for ownership gate.
            return result;
          },
        };
      },
    }),
    insert: (table: any) => ({
      values: (values: any) => {
        const tableName = (table?.[Symbol.for('drizzle:Name')] ?? table?.name ?? '').toString();
        if (opts.failOnImageInsert && tableName.includes('client_gallery_images')) {
          return Promise.reject(new Error('image insert blew up'));
        }
        inserts.push({ table: tableName, values });
        const returningChain = {
          returning: (_cols?: any) =>
            Promise.resolve(opts.insertGalleryReturns ?? [{ id: 'gallery-id-stub' }]),
        };
        // The image insert path does NOT chain .returning — make the
        // bare `await` resolve to the same stub.
        return Object.assign(Promise.resolve(opts.insertGalleryReturns ?? [{ id: 'gallery-id-stub' }]), returningChain);
      },
    }),
  } as unknown as BridgeInput['db'];

  return { db, inserts };
}

const samplePicks: BridgePickInput[] = [
  {
    captureAssetId: 'asset-1',
    title: 'IMG_001',
    previewKey: 'caps/owner/sess/asset-1/preview',
    fullKey: 'caps/owner/sess/asset-1/full',
  },
  {
    captureAssetId: 'asset-2',
    title: 'IMG_002',
    previewKey: 'caps/owner/sess/asset-2/preview',
  },
];

describe('bridgeCaptureSessionToGallery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects when picks list is empty', async () => {
    const { db } = makeDbStub({ ownedSessions: [{ id: 'sess', name: 'S' }] });
    const result = await bridgeCaptureSessionToGallery({
      db,
      ownerUserId: 'user-1',
      captureSessionId: 'sess',
      clientName: 'C',
      clientEmail: 'c@x.com',
      picks: [],
      tokenFactory: () => 'tok',
      signKey: async (k) => `signed:${k}`,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('no_picks');
  });

  it('rejects when the photographer does not own the capture session', async () => {
    const { db } = makeDbStub({ ownedSessions: [] });
    const result = await bridgeCaptureSessionToGallery({
      db,
      ownerUserId: 'attacker',
      captureSessionId: 'sess-not-owned',
      clientName: 'C',
      clientEmail: 'c@x.com',
      picks: samplePicks,
      tokenFactory: () => 'tok',
      signKey: async (k) => `signed:${k}`,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('session_not_found');
  });

  it('creates a fresh gallery + signs every preview when none exists yet', async () => {
    const { db, inserts } = makeDbStub({
      ownedSessions: [{ id: 'sess', name: 'Bryllup Daniel' }],
      existingGalleries: [],
      existingImages: [],
    });
    const result = await bridgeCaptureSessionToGallery({
      db,
      ownerUserId: 'user-1',
      captureSessionId: 'sess',
      clientName: 'Brud',
      clientEmail: 'BRUD@example.com',
      picks: samplePicks,
      publicHostOverride: 'https://app.creatorhubn.com',
      tokenFactory: () => 'fixed-access-token',
      signKey: async (key) => `signed:${key}`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.accessToken).toBe('fixed-access-token');
    expect(result.shareUrl).toBe('https://app.creatorhubn.com/client/gallery/fixed-access-token');
    expect(result.uploadedImageCount).toBe(2);
    expect(result.reusedExisting).toBe(false);

    // One gallery insert, two image inserts.
    const galleryInserts = inserts.filter((i) => i.table.includes('photographer_client_galleries'));
    const imageInserts = inserts.filter((i) => i.table.includes('client_gallery_images'));
    expect(galleryInserts).toHaveLength(1);
    expect(imageInserts).toHaveLength(2);
    // Email lowercased + trimmed.
    expect(galleryInserts[0]!.values.clientEmail).toBe('brud@example.com');
    // Settings tag the source so we can find it on re-deliver.
    expect(galleryInserts[0]!.values.gallerySettings).toMatchObject({
      captureSessionId: 'sess',
      source: 'capture',
    });
    // Both images carry their captureAssetId in metadata for dedupe.
    expect(imageInserts[0]!.values.imageMetadata.captureAssetId).toBe('asset-1');
    // First pick has a fullKey → fullSizeUrl differs from thumbnailUrl.
    expect(imageInserts[0]!.values.thumbnailUrl).toBe('signed:caps/owner/sess/asset-1/preview');
    expect(imageInserts[0]!.values.fullSizeUrl).toBe('signed:caps/owner/sess/asset-1/full');
    // Second pick has no fullKey → both URLs point to preview.
    expect(imageInserts[1]!.values.fullSizeUrl).toBe('signed:caps/owner/sess/asset-2/preview');
  });

  it('reuses the existing gallery and only adds new images on re-deliver', async () => {
    // Gallery exists for this session, with asset-1 already in it.
    // Calling deliver again with [asset-1, asset-2] should add asset-2 only.
    const { db, inserts } = makeDbStub({
      ownedSessions: [{ id: 'sess', name: 'Bryllup' }],
      existingGalleries: [{
        id: 'existing-gallery-id',
        accessToken: 'existing-token',
        gallerySettings: { captureSessionId: 'sess' },
      }],
      existingImages: [{
        id: 'img-existing',
        metadata: { captureAssetId: 'asset-1' },
      }],
    });
    const result = await bridgeCaptureSessionToGallery({
      db,
      ownerUserId: 'user-1',
      captureSessionId: 'sess',
      clientName: 'Brud',
      clientEmail: 'brud@example.com',
      picks: samplePicks,
      publicHostOverride: 'https://app.creatorhubn.com',
      tokenFactory: () => 'should-not-be-used',
      signKey: async (key) => `signed:${key}`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.reusedExisting).toBe(true);
    expect(result.accessToken).toBe('existing-token');
    expect(result.uploadedImageCount).toBe(1); // only asset-2 added

    // No gallery insert; one image insert (asset-2).
    expect(inserts.filter((i) => i.table.includes('photographer_client_galleries'))).toHaveLength(0);
    const imageInserts = inserts.filter((i) => i.table.includes('client_gallery_images'));
    expect(imageInserts).toHaveLength(1);
    expect(imageInserts[0]!.values.imageMetadata.captureAssetId).toBe('asset-2');
    // Sort order continues from existing count.
    expect(imageInserts[0]!.values.sortOrder).toBe(1);
  });

  it('surfaces sign_failed when R2 returns no signed URL', async () => {
    const { db } = makeDbStub({
      ownedSessions: [{ id: 'sess', name: 'S' }],
    });
    const result = await bridgeCaptureSessionToGallery({
      db,
      ownerUserId: 'user-1',
      captureSessionId: 'sess',
      clientName: 'C',
      clientEmail: 'c@x.com',
      picks: samplePicks,
      tokenFactory: () => 'tok',
      signKey: async () => null, // R2 misconfigured / unreachable
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('sign_failed');
      expect(result.detail).toContain('asset-1');
    }
  });

  it('falls back to the default public host when no override or env var is set', async () => {
    delete process.env.CREATORHUB_PUBLIC_URL;
    const { db } = makeDbStub({
      ownedSessions: [{ id: 'sess', name: 'S' }],
    });
    const result = await bridgeCaptureSessionToGallery({
      db,
      ownerUserId: 'user-1',
      captureSessionId: 'sess',
      clientName: 'C',
      clientEmail: 'c@x.com',
      picks: [samplePicks[0]!],
      tokenFactory: () => 'tok',
      signKey: async (k) => `signed:${k}`,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.shareUrl).toBe('https://app.creatorhubn.com/client/gallery/tok');
    }
  });
});
