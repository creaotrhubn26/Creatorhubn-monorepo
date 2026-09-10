import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { setupCastingManuscriptsRoutes } from './casting-manuscripts-routes.js';

const createApp = (options: { ownerId?: string; sessionUserId?: string; version?: number | string } = {}) => {
  const ownerId = options.ownerId ?? 'user-1';
  const sessionUserId = options.sessionUserId ?? 'user-1';
  const existing = {
    id: 'manuscript-1',
    projectId: 'project-1',
    project_id: 'project-1',
    title: 'Troll',
    content: 'Cloud text',
    version: options.version ?? 4,
  };
  const replaceManuscript = vi.fn(async (_id: string, payload: Record<string, unknown>) => ({
    ...payload,
    version: typeof existing.version === 'number' ? existing.version + 1 : 1,
  }));
  const manuscriptsService = {
    getManuscript: vi.fn(async () => existing),
    replaceManuscript,
  } as any;
  const app = express();
  app.use(express.json());
  setupCastingManuscriptsRoutes({
    app,
    requireUserSession: () => ({ userId: sessionUserId }),
    compatStoreGet: vi.fn(async (key: string) => (
      key === 'casting:project:project-1' ? { created_by: ownerId } : null
    )),
    manuscriptsService,
    revisionsService: {} as any,
  });
  return { app, replaceManuscript };
};

describe('casting manuscript optimistic concurrency', () => {
  it('rejects stale If-Match without writing', async () => {
    const { app, replaceManuscript } = createApp();
    const response = await request(app)
      .put('/api/casting/manuscripts/manuscript-1')
      .set('If-Match', 'W/"3"')
      .send({ projectId: 'project-1', content: 'Local text' });

    expect(response.status).toBe(412);
    expect(response.headers.etag).toBe('W/"4"');
    expect(response.body.currentVersion).toBe(4);
    expect(replaceManuscript).not.toHaveBeenCalled();
  });

  it('accepts a matching If-Match and returns the bumped version', async () => {
    const { app, replaceManuscript } = createApp();
    const response = await request(app)
      .put('/api/casting/manuscripts/manuscript-1')
      .set('If-Match', 'W/"4"')
      .send({ projectId: 'project-1', content: 'Local text' });

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBe('W/"5"');
    expect(response.body).toMatchObject({ content: 'Local text', version: 5 });
    expect(replaceManuscript).toHaveBeenCalledTimes(1);
  });

  it('uses revision zero to protect the first write of a legacy string-version manuscript', async () => {
    const { app, replaceManuscript } = createApp({ version: '1.0' });
    const response = await request(app)
      .put('/api/casting/manuscripts/manuscript-1')
      .set('If-Match', 'W/"0"')
      .send({ projectId: 'project-1', content: 'Migrated safely' });

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBe('W/"1"');
    expect(response.body.version).toBe(1);
    expect(replaceManuscript).toHaveBeenCalledTimes(1);
  });

  it('does not reveal or mutate a manuscript across project ownership', async () => {
    const { app, replaceManuscript } = createApp({ ownerId: 'user-2', sessionUserId: 'user-1' });
    const response = await request(app)
      .put('/api/casting/manuscripts/manuscript-1')
      .set('If-Match', 'W/"4"')
      .send({ projectId: 'project-1', content: 'Unauthorized text' });

    expect(response.status).toBe(404);
    expect(replaceManuscript).not.toHaveBeenCalled();
  });
});
