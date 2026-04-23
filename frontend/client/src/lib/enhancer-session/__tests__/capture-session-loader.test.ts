import { describe, expect, it, vi } from 'vitest';
import {
  hydrateCaptureAsset,
  loadCaptureSessionAssets,
  mapCullToFlag,
  mapRatingToStar,
  type CaptureAssetRow,
} from '../capture-session-loader';

function makeRow(overrides: Partial<CaptureAssetRow> = {}): CaptureAssetRow {
  return {
    id: 'asset-1',
    sessionId: 'session-1',
    originalFilename: 'IMG_1234.CR3',
    captureTime: '2026-04-22T10:00:00Z',
    previewKey: 'preview/1.jpg',
    previewUrl: 'https://cdn.example/preview/1.jpg',
    fullKey: 'full/1.jpg',
    rawKey: 'raw/1.cr3',
    mime: 'image/jpeg',
    sizeBytes: 2_000_000,
    state: 'uploaded',
    rating: 3,
    colorLabel: null,
    flaggedForClient: false,
    rejected: false,
    createdAt: '2026-04-22T10:00:05Z',
    updatedAt: '2026-04-22T10:00:05Z',
    ...overrides,
  };
}

describe('mapRatingToStar', () => {
  it('clamps to [0, 5] and rounds', () => {
    expect(mapRatingToStar(0)).toBe(0);
    expect(mapRatingToStar(3)).toBe(3);
    expect(mapRatingToStar(5)).toBe(5);
    expect(mapRatingToStar(-2)).toBe(0);
    expect(mapRatingToStar(99)).toBe(5);
    expect(mapRatingToStar(2.6)).toBe(3);
  });

  it('treats NaN / Infinity as 0', () => {
    expect(mapRatingToStar(NaN)).toBe(0);
    expect(mapRatingToStar(Infinity)).toBe(0);
  });
});

describe('mapCullToFlag', () => {
  it('reject wins over pick', () => {
    expect(mapCullToFlag(true, true)).toBe('reject');
  });

  it('pick when only flagged-for-client', () => {
    expect(mapCullToFlag(true, false)).toBe('pick');
  });

  it('reject when only rejected', () => {
    expect(mapCullToFlag(false, true)).toBe('reject');
  });

  it('none when neither', () => {
    expect(mapCullToFlag(false, false)).toBe('none');
  });
});

describe('hydrateCaptureAsset', () => {
  it('builds a File with capture metadata baked in', async () => {
    const row = makeRow({ rating: 4, flaggedForClient: true });
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
    const fetchPreview = vi.fn(async () => blob);
    const hydrated = await hydrateCaptureAsset(row, 0, fetchPreview);
    expect(hydrated).not.toBeNull();
    if (!hydrated) return;
    expect(hydrated.fileName).toBe('IMG_1234.CR3');
    expect(hydrated.mimeType).toBe('image/jpeg');
    expect(hydrated.rating).toBe(4);
    expect(hydrated.flag).toBe('pick');
    expect(hydrated.sequence).toBe(1);
    expect(hydrated.captureAssetId).toBe('asset-1');
    expect(hydrated.file).toBeInstanceOf(File);
    expect(hydrated.file.size).toBe(4);
    // captureTime → lastModified round-trip should match.
    expect(hydrated.lastModified).toBe(Date.parse('2026-04-22T10:00:00Z'));
  });

  it('returns null when previewUrl is missing (preview not yet generated)', async () => {
    const row = makeRow({ previewUrl: null });
    const fetchPreview = vi.fn(async () => new Blob());
    expect(await hydrateCaptureAsset(row, 0, fetchPreview)).toBeNull();
    expect(fetchPreview).not.toHaveBeenCalled();
  });

  it('falls back to blob.type when row.mime is empty', async () => {
    const row = makeRow({ mime: '' });
    const blob = new Blob([new Uint8Array([0])], { type: 'image/png' });
    const hydrated = await hydrateCaptureAsset(row, 0, async () => blob);
    expect(hydrated?.mimeType).toBe('image/png');
  });

  it('uses row.sizeBytes when provided even if blob.size differs', async () => {
    // sizeBytes comes from the original RAW — preview is a smaller JPEG,
    // but we keep sizeBytes so filtering/UI shows the original.
    const row = makeRow({ sizeBytes: 25_000_000 });
    const blob = new Blob([new Uint8Array([1])], { type: 'image/jpeg' });
    const hydrated = await hydrateCaptureAsset(row, 0, async () => blob);
    expect(hydrated?.sizeBytes).toBe(25_000_000);
  });

  it('increments sequence from the index', async () => {
    const row = makeRow();
    const blob = new Blob([new Uint8Array([1])]);
    const a = await hydrateCaptureAsset(row, 0, async () => blob);
    const b = await hydrateCaptureAsset(row, 7, async () => blob);
    expect(a?.sequence).toBe(1);
    expect(b?.sequence).toBe(8);
  });
});

describe('loadCaptureSessionAssets', () => {
  it('hydrates every asset and preserves order', async () => {
    const rows = [
      makeRow({ id: 'a', originalFilename: 'a.jpg', rating: 5 }),
      makeRow({ id: 'b', originalFilename: 'b.jpg', rejected: true }),
      makeRow({ id: 'c', originalFilename: 'c.jpg', flaggedForClient: true }),
    ];
    const listAssets = vi.fn(async () => rows);
    const fetchPreview = vi.fn(async () => new Blob([new Uint8Array([0])]));
    const result = await loadCaptureSessionAssets('sess-1', {
      listAssets,
      fetchPreview,
    });
    expect(result).toHaveLength(3);
    expect(result[0].fileName).toBe('a.jpg');
    expect(result[0].rating).toBe(5);
    expect(result[1].flag).toBe('reject');
    expect(result[2].flag).toBe('pick');
    expect(listAssets).toHaveBeenCalledWith('sess-1');
  });

  it('isolates a broken preview fetch — others still load', async () => {
    const rows = [
      makeRow({ id: 'good-1' }),
      makeRow({ id: 'broken' }),
      makeRow({ id: 'good-2' }),
    ];
    const fetchPreview = vi.fn(async (url: string) => {
      if (url.includes('broken')) throw new Error('404');
      return new Blob([new Uint8Array([1])]);
    });
    // Slight adjustment: map previewUrl so the broken row is detectable.
    rows[1].previewUrl = 'https://cdn.example/broken/preview.jpg';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadCaptureSessionAssets('sess-1', {
      listAssets: async () => rows,
      fetchPreview,
    });
    expect(result.map((h) => h.captureAssetId)).toEqual(['good-1', 'good-2']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns an empty array when the session has no assets', async () => {
    const result = await loadCaptureSessionAssets('sess-empty', {
      listAssets: async () => [],
      fetchPreview: vi.fn(),
    });
    expect(result).toEqual([]);
  });

  it('propagates list-fetch failure (not per-asset failure)', async () => {
    await expect(
      loadCaptureSessionAssets('sess-1', {
        listAssets: async () => {
          throw new Error('500 Server Error');
        },
        fetchPreview: vi.fn(),
      }),
    ).rejects.toThrow('500');
  });
});
