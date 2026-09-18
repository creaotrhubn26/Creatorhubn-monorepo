import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dispatchPublishMock } = vi.hoisted(() => ({
  dispatchPublishMock: vi.fn(),
}));

vi.mock('./social-publisher.js', () => ({
  dispatchPublish: dispatchPublishMock,
}));

import { setupPostDraftsRoutes } from './role-room-post-drafts-routes.js';

function linkedInDraft(status = 'draft') {
  return {
    id: '42',
    platform: 'linkedin',
    status,
    caption: 'En testpost',
    hashtags: ['#role'],
    cta_link: null,
  };
}

describe('Marketing Draft LinkedIn publish claim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ROLE_ROOM_MARKETING_USER_ID = 'marketing-user';
  });

  it('lar bare én samtidig request nå den eksterne LinkedIn-publisheren', async () => {
    let claimed = false;
    let releasePublish!: () => void;
    const publishBarrier = new Promise<void>((resolve) => {
      releasePublish = resolve;
    });
    dispatchPublishMock.mockImplementation(async () => {
      await publishBarrier;
      return {
        ok: true,
        status: 'published',
        externalPostId: 'urn:li:share:123',
        permalink: 'https://www.linkedin.com/feed/update/urn:li:share:123/',
      };
    });

    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith('SELECT * FROM marketing_post_drafts')) {
          return { rowCount: 1, rows: [linkedInDraft()] };
        }
        if (sql.includes("SET status = 'publishing'")) {
          if (claimed) return { rowCount: 0, rows: [] };
          claimed = true;
          return { rowCount: 1, rows: [linkedInDraft('publishing')] };
        }
        return { rowCount: 1, rows: [] };
      }),
    };
    const app = express();
    app.use(express.json());
    setupPostDraftsRoutes({
      app,
      pool: pool as never,
      requireAdminOrDemoBypass: () => true,
    });

    const firstRequest = request(app)
      .post('/api/role-room/agent/post-drafts/42/publish')
      .send({})
      .then((response) => response);
    while (dispatchPublishMock.mock.calls.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const duplicate = await request(app)
      .post('/api/role-room/agent/post-drafts/42/publish')
      .send({});
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe('publish_in_progress');
    expect(dispatchPublishMock).toHaveBeenCalledTimes(1);

    releasePublish();
    const published = await firstRequest;
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({
      ok: true,
      status: 'published',
      externalPostId: 'urn:li:share:123',
    });
    expect(dispatchPublishMock).toHaveBeenCalledTimes(1);
  });

  it('avviser en allerede publisert draft uten et nytt sideeffektkall', async () => {
    const pool = {
      query: vi.fn(async () => ({
        rowCount: 1,
        rows: [{ ...linkedInDraft('published'), external_post_id: 'urn:li:share:old' }],
      })),
    };
    const app = express();
    app.use(express.json());
    setupPostDraftsRoutes({
      app,
      pool: pool as never,
      requireAdminOrDemoBypass: () => true,
    });

    const response = await request(app)
      .post('/api/role-room/agent/post-drafts/42/publish')
      .send({});

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      error: 'already_published',
      externalPostId: 'urn:li:share:old',
    });
    expect(dispatchPublishMock).not.toHaveBeenCalled();
  });

  it('låser et uavklart nettverksutfall og tillater ikke automatisk retry', async () => {
    let status = 'draft';
    dispatchPublishMock.mockResolvedValue({
      ok: false,
      status: 'failed',
      reason: 'network_error',
      error: 'fetch failed',
    });
    const pool = {
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        if (sql.startsWith('SELECT * FROM marketing_post_drafts')) {
          return { rowCount: 1, rows: [linkedInDraft(status)] };
        }
        if (sql.includes("SET status = 'publishing'")) {
          status = 'publishing';
          return { rowCount: 1, rows: [linkedInDraft(status)] };
        }
        if (sql.includes('SET status = $2')) {
          status = String(values?.[1]);
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 1, rows: [] };
      }),
    };
    const app = express();
    app.use(express.json());
    setupPostDraftsRoutes({
      app,
      pool: pool as never,
      requireAdminOrDemoBypass: () => true,
    });

    const first = await request(app)
      .post('/api/role-room/agent/post-drafts/42/publish')
      .send({});
    expect(first.status).toBe(202);
    expect(first.body).toMatchObject({
      ok: false,
      status: 'uncertain',
      reason: 'network_error',
    });
    expect(status).toBe('uncertain');

    const retry = await request(app)
      .post('/api/role-room/agent/post-drafts/42/publish')
      .send({});
    expect(retry.status).toBe(409);
    expect(retry.body).toMatchObject({
      status: 'uncertain',
      error: 'publish_outcome_uncertain',
    });
    expect(dispatchPublishMock).toHaveBeenCalledTimes(1);
  });
});
