import { afterEach, describe, expect, it } from 'vitest';
import {
  __resetTikTokInsightsFetch,
  __setTikTokInsightsFetch,
  fetchTikTokVideoMetrics,
  mapTikTokVideoToMetrics,
} from './role-room-tiktok-insights.js';

afterEach(() => __resetTikTokInsightsFetch());

describe('mapTikTokVideoToMetrics', () => {
  it('maps the four organic counts', () => {
    const rows = mapTikTokVideoToMetrics({ id: 'v1', view_count: 1200, like_count: 80, comment_count: 5, share_count: 3 });
    expect(rows).toEqual([
      { videoId: 'v1', metric: 'view_count', value: 1200 },
      { videoId: 'v1', metric: 'like_count', value: 80 },
      { videoId: 'v1', metric: 'comment_count', value: 5 },
      { videoId: 'v1', metric: 'share_count', value: 3 },
    ]);
  });

  it('skips missing/invalid counts and coerces numeric string ids', () => {
    const rows = mapTikTokVideoToMetrics({ id: 42, view_count: 10, like_count: null, share_count: 'x' });
    expect(rows).toEqual([
      { videoId: '42', metric: 'view_count', value: 10 },
    ]);
  });

  it('returns [] for id-less or malformed input', () => {
    expect(mapTikTokVideoToMetrics({ view_count: 10 })).toEqual([]);
    expect(mapTikTokVideoToMetrics(null)).toEqual([]);
    expect(mapTikTokVideoToMetrics([])).toEqual([]);
  });
});

describe('fetchTikTokVideoMetrics', () => {
  it('POSTs video_ids and flattens metrics across videos', async () => {
    let captured: { url: string; body: unknown } | null = null;
    __setTikTokInsightsFetch(async (url, init) => {
      captured = { url, body: JSON.parse(init?.body ?? '{}') };
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { videos: [
          { id: 'a', view_count: 100, like_count: 4 },
          { id: 'b', view_count: 50 },
        ] } }),
        text: async () => '',
      };
    });
    const rows = await fetchTikTokVideoMetrics('tok', ['a', 'b']);
    expect(captured!.url).toContain('/v2/video/query/');
    expect((captured!.body as { filters: { video_ids: string[] } }).filters.video_ids).toEqual(['a', 'b']);
    expect(rows).toEqual([
      { videoId: 'a', metric: 'view_count', value: 100 },
      { videoId: 'a', metric: 'like_count', value: 4 },
      { videoId: 'b', metric: 'view_count', value: 50 },
    ]);
  });

  it('returns [] for empty ids without calling fetch', async () => {
    let called = false;
    __setTikTokInsightsFetch(async () => { called = true; return { ok: true, status: 200, json: async () => ({}), text: async () => '' }; });
    expect(await fetchTikTokVideoMetrics('tok', [])).toEqual([]);
    expect(called).toBe(false);
  });

  it('throws on a non-ok HTTP response', async () => {
    __setTikTokInsightsFetch(async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'bad token' } }), text: async () => '' }));
    await expect(fetchTikTokVideoMetrics('tok', ['a'])).rejects.toThrow('bad token');
  });

  it('throws on an in-band TikTok error code (HTTP 200 + error)', async () => {
    __setTikTokInsightsFetch(async () => ({ ok: true, status: 200, json: async () => ({ error: { code: 'scope_not_authorized', message: 'missing video.list' } }), text: async () => '' }));
    await expect(fetchTikTokVideoMetrics('tok', ['a'])).rejects.toThrow('missing video.list');
  });

  it('dedupes ids', async () => {
    let bodyIds: string[] = [];
    __setTikTokInsightsFetch(async (_url, init) => {
      bodyIds = JSON.parse(init?.body ?? '{}').filters.video_ids;
      return { ok: true, status: 200, json: async () => ({ data: { videos: [] } }), text: async () => '' };
    });
    await fetchTikTokVideoMetrics('tok', ['a', 'a', 'b']);
    expect(bodyIds).toEqual(['a', 'b']);
  });
});
