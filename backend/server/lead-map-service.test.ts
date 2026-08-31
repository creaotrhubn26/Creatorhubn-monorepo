import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

import {
  getLeadById,
  listLeadsInBounds,
  searchPlaces,
} from './lead-map-service.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('searchPlaces', () => {
  it('preserves a valid location bias when latitude and longitude are zero', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => (
      new Response(JSON.stringify({ places: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ));
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchPlaces(
      { query: vi.fn() } as unknown as Pool,
      {
        ownerUserId: 'user-1',
        query: 'restauranter',
        latitude: 0,
        longitude: 0,
        radiusMeters: 5_000,
      },
    );

    expect(result).toEqual({ ok: true, results: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      textQuery: 'restauranter',
      pageSize: 20,
      locationBias: {
        circle: {
          center: { latitude: 0, longitude: 0 },
          radius: 5_000,
        },
      },
    });
    expect(body).not.toHaveProperty('maxResultCount');
  });
});

describe('normal lead reads', () => {
  it('keeps Discovery drafts out of the map and lead-detail queries', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const pool = { query } as unknown as Pool;

    await listLeadsInBounds(pool, { ownerUserId: 'user-1' });
    await getLeadById(pool, { ownerUserId: 'user-1' }, 'lead-1');

    expect(query).toHaveBeenCalledTimes(2);
    for (const [sql] of query.mock.calls) {
      expect(sql).toContain(
        "(draft_status IS NULL OR draft_status = 'lead')",
      );
    }
  });
});
