import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enrichCompetitorWithMetaPage,
  fetchPagePublicMetadata,
  getMetaAppAccessTokenConfig,
  searchPublicPages,
} from './role-room-meta-pages';

type FetchHandler = (url: string) => Promise<{ ok: boolean; status: number; body: unknown }>;
let handler: FetchHandler = async () => ({ ok: false, status: 500, body: {} });
const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  handler = async () => ({ ok: false, status: 500, body: {} });
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    const { ok, status, body } = await handler(url);
    return { ok, status, json: async () => body } as unknown as Response;
  });
  process.env.META_APP_ID = 'test-app-id';
  process.env.META_APP_SECRET = 'test-app-secret';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.META_APP_ID;
  delete process.env.META_APP_SECRET;
});

describe('getMetaAppAccessTokenConfig', () => {
  it('returns null when env is unset', () => {
    delete process.env.META_APP_ID;
    expect(getMetaAppAccessTokenConfig()).toBeNull();
  });

  it('returns {appId, appSecret} when env is set', () => {
    expect(getMetaAppAccessTokenConfig()).toEqual({ appId: 'test-app-id', appSecret: 'test-app-secret' });
  });
});

describe('searchPublicPages', () => {
  it('returns [] for short queries without hitting the network', async () => {
    const result = await searchPublicPages('a', { appId: 'a', appSecret: 'b' });
    expect(result).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('sends the app access token in `{app_id}|{app_secret}` form', async () => {
    handler = async () => ({ ok: true, status: 200, body: { data: [{ id: '1', name: 'Northwind Drilling' }] } });
    await searchPublicPages('Northwind', { appId: 'A', appSecret: 'B' });
    expect(calls[0]).toContain('access_token=A%7CB'); // pipe url-encoded
    expect(calls[0]).toContain('q=Northwind');
  });

  it('filters out malformed entries and caps at 5 results', async () => {
    handler = async () => ({
      ok: true,
      status: 200,
      body: {
        data: [
          { id: '1', name: 'A' },
          { id: '2' },                 // missing name → dropped
          { name: 'No id' },           // missing id → dropped
          { id: '3', name: 'B' },
          { id: '4', name: 'C' },
          { id: '5', name: 'D' },
          { id: '6', name: 'E' },
          { id: '7', name: 'F' },
        ],
      },
    });
    const result = await searchPublicPages('Foo', { appId: 'a', appSecret: 'b' });
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.id)).toEqual(['1', '3', '4', '5', '6']);
  });

  it('returns [] on network failure (non-2xx)', async () => {
    handler = async () => ({ ok: false, status: 500, body: { error: 'boom' } });
    expect(await searchPublicPages('Foo', { appId: 'a', appSecret: 'b' })).toEqual([]);
  });
});

describe('fetchPagePublicMetadata', () => {
  it('maps the full public-metadata payload', async () => {
    handler = async () => ({
      ok: true,
      status: 200,
      body: {
        id: '1234',
        name: 'Northwind Drilling',
        fan_count: 1250,
        followers_count: 1300,
        category: 'Construction',
        category_list: [{ name: 'Construction' }, { name: 'Industrial Company' }],
        about: 'Drilling since 1998',
        website: 'https://northwind.no',
        link: 'https://facebook.com/northwind',
        verification_status: 'blue_verified',
      },
    });
    const result = await fetchPagePublicMetadata('1234', { appId: 'a', appSecret: 'b' });
    expect(result).toEqual({
      id: '1234',
      name: 'Northwind Drilling',
      fanCount: 1250,
      followersCount: 1300,
      category: 'Construction',
      categoryList: ['Construction', 'Industrial Company'],
      about: 'Drilling since 1998',
      website: 'https://northwind.no',
      link: 'https://facebook.com/northwind',
      verificationStatus: 'blue_verified',
    });
  });

  it('returns null for empty pageId without hitting the network', async () => {
    expect(await fetchPagePublicMetadata('', { appId: 'a', appSecret: 'b' })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('returns null on Meta 404 (banned/deleted page)', async () => {
    handler = async () => ({ ok: false, status: 404, body: { error: { message: 'not found' } } });
    expect(await fetchPagePublicMetadata('missing', { appId: 'a', appSecret: 'b' })).toBeNull();
  });

  it('gracefully handles missing optional fields', async () => {
    handler = async () => ({ ok: true, status: 200, body: { id: '1', name: 'Minimal' } });
    const result = await fetchPagePublicMetadata('1', { appId: 'a', appSecret: 'b' });
    expect(result).toEqual({
      id: '1',
      name: 'Minimal',
      fanCount: null,
      followersCount: null,
      category: null,
      categoryList: [],
      about: null,
      website: null,
      link: null,
      verificationStatus: null,
    });
  });
});

describe('enrichCompetitorWithMetaPage', () => {
  it('returns null when META env is missing', async () => {
    delete process.env.META_APP_ID;
    expect(await enrichCompetitorWithMetaPage('Northwind Drilling')).toBeNull();
  });

  it('returns null for empty names', async () => {
    expect(await enrichCompetitorWithMetaPage('')).toBeNull();
    expect(await enrichCompetitorWithMetaPage('x')).toBeNull();
  });

  it('picks the exact-name match over partial matches', async () => {
    let step = 0;
    handler = async (url) => {
      step += 1;
      if (url.includes('/pages/search')) {
        return {
          ok: true,
          status: 200,
          body: {
            data: [
              { id: 'partial-1', name: 'Northwind Drilling AS' },
              { id: 'exact-1', name: 'Northwind Drilling' },
              { id: 'other-1', name: 'Northwind Construction' },
            ],
          },
        };
      }
      // Metadata fetch — ensure the exact-match id was used.
      expect(url).toContain('/exact-1');
      return { ok: true, status: 200, body: { id: 'exact-1', name: 'Northwind Drilling', fan_count: 900 } };
    };
    const result = await enrichCompetitorWithMetaPage('Northwind Drilling');
    expect(result?.id).toBe('exact-1');
    expect(result?.fanCount).toBe(900);
    expect(step).toBe(2); // search + metadata
  });

  it('falls back to partial match when no exact match exists', async () => {
    handler = async (url) => {
      if (url.includes('/pages/search')) {
        return {
          ok: true,
          status: 200,
          body: {
            data: [
              { id: 'partial-1', name: 'Northwind Drilling AS' },
              { id: 'other-1', name: 'Northwind Construction' },
            ],
          },
        };
      }
      expect(url).toContain('/partial-1');
      return { ok: true, status: 200, body: { id: 'partial-1', name: 'Northwind Drilling AS' } };
    };
    const result = await enrichCompetitorWithMetaPage('Northwind Drilling');
    expect(result?.id).toBe('partial-1');
  });

  it('returns null when search yields no candidates', async () => {
    handler = async () => ({ ok: true, status: 200, body: { data: [] } });
    expect(await enrichCompetitorWithMetaPage('Unknown Brand')).toBeNull();
  });
});
