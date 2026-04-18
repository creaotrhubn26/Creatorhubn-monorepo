import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Dependency mocks ──────────────────────────────────────────────────────

vi.mock('./role-room-instagram-oauth.js', () => ({
  META_GRAPH_API_VERSION: 'v21.0',
  getConnection: vi.fn(),
  ensureFreshConnection: vi.fn(),
}));

vi.mock('./role-room-instagram-image-upload.js', () => ({
  uploadImageForInstagram: vi.fn(),
  signInstagramHostedImageUrl: vi.fn(),
  deleteInstagramHostedImage: vi.fn(),
}));

import * as oauthMock from './role-room-instagram-oauth.js';
import * as uploadMock from './role-room-instagram-image-upload.js';
import {
  IG_RATE_LIMIT_PER_24H,
  processDuePublishJobs,
  queueAndPublish,
  startInstagramPublishWorker,
} from './role-room-instagram-publish';

const getConnection = oauthMock.getConnection as unknown as ReturnType<typeof vi.fn>;
const ensureFreshConnection = oauthMock.ensureFreshConnection as unknown as ReturnType<typeof vi.fn>;
const uploadImageForInstagram = uploadMock.uploadImageForInstagram as unknown as ReturnType<typeof vi.fn>;
const signInstagramHostedImageUrl = uploadMock.signInstagramHostedImageUrl as unknown as ReturnType<typeof vi.fn>;

// ── Fetch mocking for Meta Graph API ─────────────────────────────────────

type FetchRouter = (url: string, init?: RequestInit) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }>;
let fetchRouter: FetchRouter = () => ({ status: 500, body: { error: 'unmocked' } });
const fetchCalls: { url: string; init?: RequestInit }[] = [];

beforeEach(() => {
  fetchCalls.length = 0;
  getConnection.mockReset();
  ensureFreshConnection.mockReset();
  uploadImageForInstagram.mockReset();
  signInstagramHostedImageUrl.mockReset();
  fetchRouter = () => ({ status: 500, body: { error: 'unmocked' } });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });
    const result = await fetchRouter(url, init);
    const status = result.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => result.body,
    } as unknown as Response;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Pool helpers ────────────────────────────────────────────────────────

type QueryImpl = (sql: string, args: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }> | { rows: unknown[]; rowCount?: number };

function makePool(impl: QueryImpl) {
  const queries: { sql: string; args: unknown[] }[] = [];
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    queries.push({ sql, args });
    return impl(sql, args);
  });
  return { pool: { query } as never, queries };
}

// Pool with a connect() method too, used by processDuePublishJobs.
function makePoolWithConnect(impl: QueryImpl) {
  const queries: { sql: string; args: unknown[] }[] = [];
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    queries.push({ sql, args });
    return impl(sql, args);
  });
  const release = vi.fn();
  const client = { query, release };
  const connect = vi.fn(async () => client);
  return { pool: { query, connect } as never, queries, release };
}

function baseConnection(override: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    userId: 'u1',
    projectId: null,
    igBusinessAccountId: 'ig-biz-1',
    igUsername: 'u',
    facebookPageId: 'p',
    facebookPageName: 'P',
    fbUserId: null,
    accessToken: 'long-token',
    tokenExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    scopes: [],
    connectionState: 'connected',
    lastError: null,
    ...override,
  };
}

function hostedImage(override: Record<string, unknown> = {}) {
  return {
    bucket: 'role-room-bucket',
    key: 'role-room/instagram-publish/u1/image-1.jpg',
    publicUrl: 'https://signed.example/1',
    contentType: 'image/jpeg',
    bytes: 3,
    ...override,
  };
}

function jobRow(override: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    user_id: 'u1',
    project_id: 'proj-1',
    connection_id: 'conn-1',
    feed_plan_post_id: 'post-1',
    media_type: 'image',
    caption: 'hello',
    image_bucket: 'role-room-bucket',
    image_key: 'role-room/instagram-publish/u1/image-1.jpg',
    image_parts: [
      { bucket: 'role-room-bucket', key: 'role-room/instagram-publish/u1/image-1.jpg' },
    ],
    image_public_url: 'https://signed.example/1',
    ig_container_id: null,
    ig_media_id: null,
    status: 'queued',
    scheduled_for: null,
    attempted_count: 0,
    last_attempt_at: null,
    last_error: null,
    published_at: null,
    ...override,
  };
}

// ── queueAndPublish — validation + rate-limit paths ─────────────────────

describe('queueAndPublish — validation', () => {
  it('throws when the connection is missing', async () => {
    getConnection.mockResolvedValue(null);
    const { pool } = makePool(async () => ({ rows: [] }));
    await expect(
      queueAndPublish(pool, {
        connectionId: 'c', userId: 'u1', projectId: 'p', feedPlanPostId: 'f',
        mediaType: 'image', caption: '', imageDataUrl: 'data:image/jpeg;base64,AA',
      }),
    ).rejects.toThrow(/finnes ikke/);
  });

  it('throws when the connection is not in the "connected" state', async () => {
    getConnection.mockResolvedValue(baseConnection({ connectionState: 'expired' }));
    const { pool } = makePool(async () => ({ rows: [] }));
    await expect(
      queueAndPublish(pool, {
        connectionId: 'c', userId: 'u1', projectId: 'p', feedPlanPostId: 'f',
        mediaType: 'image', caption: '', imageDataUrl: 'data:image/jpeg;base64,AA',
      }),
    ).rejects.toThrow(/utløpt/);
  });

  it('throws when no image data is provided', async () => {
    getConnection.mockResolvedValue(baseConnection());
    const { pool } = makePool(async () => ({ rows: [] }));
    await expect(
      queueAndPublish(pool, {
        connectionId: 'c', userId: 'u1', projectId: 'p', feedPlanPostId: 'f',
        mediaType: 'image', caption: '',
      }),
    ).rejects.toThrow(/Mangler bildedata/);
  });

  it('rejects carousel with fewer than 2 images', async () => {
    getConnection.mockResolvedValue(baseConnection());
    const { pool } = makePool(async () => ({ rows: [] }));
    await expect(
      queueAndPublish(pool, {
        connectionId: 'c', userId: 'u1', projectId: 'p', feedPlanPostId: 'f',
        mediaType: 'carousel', caption: '',
        imageDataUrls: ['data:image/jpeg;base64,AA'],
      }),
    ).rejects.toThrow(/Carousel krever 2-10 bilder, fikk 1/);
  });

  it('rejects carousel with more than 10 images', async () => {
    getConnection.mockResolvedValue(baseConnection());
    const { pool } = makePool(async () => ({ rows: [] }));
    const eleven = Array.from({ length: 11 }, () => 'data:image/jpeg;base64,AA');
    await expect(
      queueAndPublish(pool, {
        connectionId: 'c', userId: 'u1', projectId: 'p', feedPlanPostId: 'f',
        mediaType: 'carousel', caption: '',
        imageDataUrls: eleven,
      }),
    ).rejects.toThrow(/Carousel krever 2-10 bilder, fikk 11/);
  });

  it('rejects image/reel with more than one image', async () => {
    getConnection.mockResolvedValue(baseConnection());
    const { pool } = makePool(async () => ({ rows: [] }));
    await expect(
      queueAndPublish(pool, {
        connectionId: 'c', userId: 'u1', projectId: 'p', feedPlanPostId: 'f',
        mediaType: 'reel', caption: '',
        imageDataUrls: ['data:image/jpeg;base64,AA', 'data:image/jpeg;base64,BB'],
      }),
    ).rejects.toThrow(/reel krever nøyaktig ett bilde/);
  });
});

describe('queueAndPublish — rate-limit + scheduling', () => {
  it('marks the job as rate_limited when the 24h window is full and we wanted an immediate publish', async () => {
    getConnection.mockResolvedValue(baseConnection());
    uploadImageForInstagram.mockResolvedValue(hostedImage());
    const { pool, queries } = makePool(async (sql) => {
      if (sql.includes('role_room_instagram_publishes_last_24h')) {
        return { rows: [{ published_count: IG_RATE_LIMIT_PER_24H }] };
      }
      if (sql.startsWith('INSERT INTO role_room_instagram_publish_jobs')) {
        return { rows: [jobRow({ status: 'queued' })] };
      }
      if (sql.startsWith('UPDATE role_room_instagram_publish_jobs')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    });
    const result = await queueAndPublish(pool, {
      connectionId: 'c', userId: 'u1', projectId: 'p', feedPlanPostId: 'f',
      mediaType: 'image', caption: '', imageDataUrl: 'data:image/jpeg;base64,AA',
    });
    expect(result.rateLimited).toBe(true);
    expect(result.immediatelyPublished).toBe(false);
    // Must have set status='rate_limited' on the row.
    const rateLimitUpdate = queries.find(
      (q) => q.sql.startsWith('UPDATE role_room_instagram_publish_jobs') && JSON.stringify(q.args).includes('rate_limited'),
    );
    expect(rateLimitUpdate).toBeDefined();
  });

  it('queues a future-dated job without calling Meta', async () => {
    getConnection.mockResolvedValue(baseConnection());
    uploadImageForInstagram.mockResolvedValue(hostedImage());
    ensureFreshConnection.mockResolvedValue(baseConnection());
    const scheduledFor = new Date(Date.now() + 60_000).toISOString();
    const { pool } = makePool(async (sql) => {
      if (sql.includes('role_room_instagram_publishes_last_24h')) return { rows: [{ published_count: 0 }] };
      if (sql.startsWith('INSERT INTO role_room_instagram_publish_jobs')) return { rows: [jobRow()] };
      return { rows: [] };
    });
    const result = await queueAndPublish(pool, {
      connectionId: 'c', userId: 'u1', projectId: 'p', feedPlanPostId: 'f',
      mediaType: 'image', caption: '', imageDataUrl: 'data:image/jpeg;base64,AA',
      scheduledFor,
    });
    expect(result.immediatelyPublished).toBe(false);
    expect(result.rateLimited).toBe(false);
    expect(result.job.status).toBe('queued');
    // No fetch to Meta and ensureFreshConnection not called for future jobs.
    expect(fetchCalls).toHaveLength(0);
    expect(ensureFreshConnection).not.toHaveBeenCalled();
  });
});

// ── End-to-end immediate publish ─────────────────────────────────────────

describe('queueAndPublish — immediate image publish', () => {
  it('runs container → media_publish and reports published=true', async () => {
    getConnection.mockResolvedValue(baseConnection());
    ensureFreshConnection.mockResolvedValue(baseConnection());
    uploadImageForInstagram.mockResolvedValue(hostedImage());
    signInstagramHostedImageUrl.mockResolvedValue('https://signed.example/fresh');
    const { pool } = makePool(async (sql, args) => {
      if (sql.includes('role_room_instagram_publishes_last_24h')) return { rows: [{ published_count: 0 }] };
      if (sql.startsWith('INSERT INTO role_room_instagram_publish_jobs')) return { rows: [jobRow()] };
      if (sql.startsWith('UPDATE role_room_instagram_publish_jobs')) return { rows: [], rowCount: 1 };
      return { rows: [] };
    });
    fetchRouter = (url, init) => {
      if (url.includes('/ig-biz-1/media_publish')) {
        return { body: { id: 'media-out-1' } };
      }
      if (url.includes('/ig-biz-1/media')) {
        return { body: { id: 'container-1' } };
      }
      return { status: 404, body: {} };
    };
    const result = await queueAndPublish(pool, {
      connectionId: 'c', userId: 'u1', projectId: 'p', feedPlanPostId: 'f',
      mediaType: 'image', caption: 'caption', imageDataUrl: 'data:image/jpeg;base64,AA',
    });
    expect(result.immediatelyPublished).toBe(true);
    expect(result.job.status).toBe('published');
    expect(result.job.igMediaId).toBe('media-out-1');
    // First call creates the container with the re-signed URL.
    const containerCall = fetchCalls.find((c) => c.url.includes('/ig-biz-1/media') && !c.url.includes('media_publish'));
    expect(containerCall).toBeDefined();
    const containerBody = (containerCall!.init!.body as URLSearchParams).toString();
    expect(containerBody).toContain('image_url=' + encodeURIComponent('https://signed.example/fresh'));
    // Caption comes from the persisted row (jobRow default 'hello'),
    // not the current queueAndPublish input — the worker path reads
    // from the row too, so this shape is what matters end-to-end.
    expect(containerBody).toContain('caption=hello');
    // Publish call uses the returned container id.
    const publishCall = fetchCalls.find((c) => c.url.includes('media_publish'));
    expect(publishCall).toBeDefined();
    expect((publishCall!.init!.body as URLSearchParams).toString()).toContain('creation_id=container-1');
  });
});

// ── End-to-end immediate carousel ────────────────────────────────────────

describe('queueAndPublish — immediate carousel publish', () => {
  it('creates one child container per image, polls readiness, creates parent, publishes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getConnection.mockResolvedValue(baseConnection());
    ensureFreshConnection.mockResolvedValue(baseConnection());
    uploadImageForInstagram
      .mockResolvedValueOnce(hostedImage({ key: 'r/u/1.jpg' }))
      .mockResolvedValueOnce(hostedImage({ key: 'r/u/2.jpg' }));
    signInstagramHostedImageUrl
      .mockResolvedValueOnce('https://signed.example/child-1')
      .mockResolvedValueOnce('https://signed.example/child-2');
    const { pool } = makePool(async (sql) => {
      if (sql.includes('role_room_instagram_publishes_last_24h')) return { rows: [{ published_count: 0 }] };
      if (sql.startsWith('INSERT INTO role_room_instagram_publish_jobs')) {
        return {
          rows: [
            jobRow({
              media_type: 'carousel',
              image_parts: [
                { bucket: 'role-room-bucket', key: 'r/u/1.jpg' },
                { bucket: 'role-room-bucket', key: 'r/u/2.jpg' },
              ],
            }),
          ],
        };
      }
      return { rows: [], rowCount: 1 };
    });

    let childCounter = 0;
    fetchRouter = (url, init) => {
      if (url.includes('/ig-biz-1/media_publish')) {
        return { body: { id: 'pub-id' } };
      }
      if (url.includes('/ig-biz-1/media')) {
        const body = (init?.body as URLSearchParams | undefined)?.toString() ?? '';
        if (body.includes('media_type=CAROUSEL')) {
          return { body: { id: 'parent-container' } };
        }
        // Child container (is_carousel_item=true).
        childCounter += 1;
        return { body: { id: `child-${childCounter}` } };
      }
      if (url.includes('?fields=status_code')) {
        // Ready instantly.
        return { body: { status_code: 'FINISHED' } };
      }
      return { status: 404, body: {} };
    };

    const resultP = queueAndPublish(pool, {
      connectionId: 'c', userId: 'u1', projectId: 'p', feedPlanPostId: 'f',
      mediaType: 'carousel', caption: 'c',
      imageDataUrls: ['data:image/jpeg;base64,AA', 'data:image/jpeg;base64,BB'],
    });
    // Advance timers to let the 5s poll intervals flush.
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await resultP;
    vi.useRealTimers();
    expect(result.immediatelyPublished).toBe(true);
    // 2 children + 1 parent container + 3 FINISHED polls (2 children + 1 parent) + 1 publish
    const containerCalls = fetchCalls.filter(
      (c) => c.url.includes('/ig-biz-1/media') && !c.url.includes('media_publish') && !c.url.includes('?fields=status_code'),
    );
    expect(containerCalls).toHaveLength(3);
    // The parent container call carries the children list and CAROUSEL type.
    const parentCall = containerCalls.find((c) =>
      (c.init!.body as URLSearchParams).toString().includes('media_type=CAROUSEL'),
    );
    expect(parentCall).toBeDefined();
    const parentBody = (parentCall!.init!.body as URLSearchParams).toString();
    expect(parentBody).toContain('children=child-1%2Cchild-2');
    // Publish used the parent container id.
    const publishCall = fetchCalls.find((c) => c.url.includes('media_publish'));
    expect((publishCall!.init!.body as URLSearchParams).toString()).toContain('creation_id=parent-container');
  }, 15_000);
});

// ── processDuePublishJobs (worker) ───────────────────────────────────────

describe('processDuePublishJobs', () => {
  it('returns zero counts when nothing is due', async () => {
    const { pool } = makePoolWithConnect(async () => ({ rows: [] }));
    const stats = await processDuePublishJobs(pool, 5);
    expect(stats).toEqual({ picked: 0, published: 0, failed: 0, rateLimited: 0 });
  });

  it('marks a failed job when the connection is gone', async () => {
    const { pool, queries } = makePoolWithConnect(async (sql) => {
      if (sql.includes('FOR UPDATE SKIP LOCKED')) return { rows: [jobRow()] };
      return { rows: [], rowCount: 1 };
    });
    getConnection.mockResolvedValue(null);
    const stats = await processDuePublishJobs(pool, 5);
    expect(stats.picked).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.published).toBe(0);
    // Job flipped to failed with a human-readable reason.
    const failUpdate = queries.find((q) => JSON.stringify(q.args).includes('er ikke lenger koblet til'));
    expect(failUpdate).toBeDefined();
  });

  it('keeps a job queued (not failed) when rate-limited so the next tick retries', async () => {
    const { pool, queries } = makePoolWithConnect(async (sql) => {
      if (sql.includes('FOR UPDATE SKIP LOCKED')) return { rows: [jobRow()] };
      if (sql.includes('role_room_instagram_publishes_last_24h')) {
        return { rows: [{ published_count: IG_RATE_LIMIT_PER_24H }] };
      }
      return { rows: [], rowCount: 1 };
    });
    getConnection.mockResolvedValue(baseConnection());
    const stats = await processDuePublishJobs(pool, 5);
    expect(stats.picked).toBe(1);
    expect(stats.rateLimited).toBe(1);
    expect(stats.failed).toBe(0);
    expect(stats.published).toBe(0);
    // The job remains 'queued' on the next update (not 'rate_limited').
    const lastStatusUpdate = [...queries]
      .reverse()
      .find((q) => q.sql.startsWith('UPDATE role_room_instagram_publish_jobs SET status'));
    expect(lastStatusUpdate).toBeDefined();
    expect(JSON.stringify(lastStatusUpdate!.args)).toContain('queued');
  });

  it('fails the job if ensureFreshConnection rejects', async () => {
    const { pool, queries } = makePoolWithConnect(async (sql) => {
      if (sql.includes('FOR UPDATE SKIP LOCKED')) return { rows: [jobRow()] };
      if (sql.includes('role_room_instagram_publishes_last_24h')) return { rows: [{ published_count: 0 }] };
      return { rows: [], rowCount: 1 };
    });
    getConnection.mockResolvedValue(baseConnection());
    ensureFreshConnection.mockRejectedValue(new Error('token revoked'));
    const stats = await processDuePublishJobs(pool, 5);
    expect(stats.failed).toBe(1);
    const failUpdate = queries.find((q) => JSON.stringify(q.args).includes('Token refresh feilet'));
    expect(failUpdate).toBeDefined();
  });
});

// ── Worker lifecycle ─────────────────────────────────────────────────────

describe('startInstagramPublishWorker', () => {
  it('returns a handle with .stop() and does not throw on an empty pool', () => {
    const { pool } = makePoolWithConnect(async () => ({ rows: [] }));
    const handle = startInstagramPublishWorker(pool, { intervalSeconds: 60 });
    expect(typeof handle.stop).toBe('function');
    handle.stop();
  });
});
