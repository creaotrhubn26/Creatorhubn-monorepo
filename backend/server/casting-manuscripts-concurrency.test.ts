import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { setupCastingManuscriptsRoutes } from './casting-manuscripts-routes.js';

const createApp = (options: {
  ownerId?: string;
  sessionUserId?: string;
  version?: number | string;
  lockedBy?: string;
} = {}) => {
  const ownerId = options.ownerId ?? 'user-1';
  const sessionUserId = options.sessionUserId ?? 'user-1';
  const existing = {
    id: 'manuscript-1',
    projectId: 'project-1',
    project_id: 'project-1',
    title: 'Troll',
    content: 'Cloud text',
    version: options.version ?? 4,
    ...(options.lockedBy
      ? { lockedBy: options.lockedBy, lockedAt: new Date().toISOString() }
      : {}),
  };
  const replaceManuscript = vi.fn(async (_id: string, payload: Record<string, unknown>) => ({
    ...payload,
    version: typeof existing.version === 'number' ? existing.version + 1 : 1,
  }));
  const manuscriptsService = {
    getManuscript: vi.fn(async () => existing),
    getRevisions: vi.fn(async () => []),
    replaceRevisions: vi.fn(async (_id: string, revisions: unknown[]) => revisions),
    replaceManuscript,
  } as any;
  const captureAutomaticSnapshot = vi.fn(async () => null);
  const restoreRevision = vi.fn(async () => ({
    markerRevisionId: 'marker-1',
    manuscript: { ...existing, version: 5 },
  }));
  const diffRevisions = vi.fn(async () => ({
    fromRevisionId: 'revision-1',
    toRevisionId: 'revision-2',
    patch: [],
  }));
  const getRevisionById = vi.fn(async () => null);
  const app = express();
  app.use(express.json());
  setupCastingManuscriptsRoutes({
    app,
    requireUserSession: () => ({ userId: sessionUserId }),
    compatStoreGet: vi.fn(async (key: string) => (
      key === 'casting:project:project-1' ? { created_by: ownerId } : null
    )),
    manuscriptsService,
    revisionsService: {
      captureAutomaticSnapshot,
      restoreRevision,
      diffRevisions,
      getRevisionById,
    } as any,
  });
  return {
    app,
    replaceManuscript,
    captureAutomaticSnapshot,
    restoreRevision,
    diffRevisions,
    getRevisionById,
  };
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
    const { app, replaceManuscript, captureAutomaticSnapshot } = createApp();
    const response = await request(app)
      .put('/api/casting/manuscripts/manuscript-1')
      .set('If-Match', 'W/"4"')
      .send({ projectId: 'project-1', content: 'Local text' });

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBe('W/"5"');
    expect(response.body).toMatchObject({ content: 'Local text', version: 5 });
    expect(replaceManuscript).toHaveBeenCalledTimes(1);
    expect(captureAutomaticSnapshot).toHaveBeenCalledWith(
      'manuscript-1',
      expect.objectContaining({ content: 'Cloud text', version: 4 }),
      { actorUserId: 'user-1' },
    );
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

  it('does not allow cross-project revision creation or restore', async () => {
    const { app, restoreRevision } = createApp({ ownerId: 'user-2', sessionUserId: 'user-1' });

    const createResponse = await request(app)
      .post('/api/casting/revisions')
      .send({ manuscriptId: 'manuscript-1', content: 'Private snapshot' });
    const restoreResponse = await request(app)
      .post('/api/casting/manuscripts/manuscript-1/restore-revision/revision-1')
      .set('If-Match', 'W/"4"');

    expect(createResponse.status).toBe(404);
    expect(restoreResponse.status).toBe(404);
    expect(restoreRevision).not.toHaveBeenCalled();
  });

  it('controls revision ownership, type, and audit timestamp on the server', async () => {
    const { app } = createApp();
    const response = await request(app)
      .post('/api/casting/revisions')
      .send({
        manuscriptId: 'manuscript-1',
        content: 'Snapshot',
        createdBy: 'spoofed-user',
        kind: 'automatic_snapshot',
        createdAt: '2000-01-01T00:00:00.000Z',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      manuscriptId: 'manuscript-1',
      projectId: 'project-1',
      createdBy: 'user-1',
      kind: 'manual',
    });
    expect(response.body.createdAt).not.toBe('2000-01-01T00:00:00.000Z');
  });

  it('protects revision restore with If-Match', async () => {
    const { app, restoreRevision } = createApp();
    const response = await request(app)
      .post('/api/casting/manuscripts/manuscript-1/restore-revision/revision-1')
      .set('If-Match', 'W/"3"');

    expect(response.status).toBe(412);
    expect(response.body.currentVersion).toBe(4);
    expect(restoreRevision).not.toHaveBeenCalled();
  });

  it('does not restore while another user holds the manuscript lock', async () => {
    const { app, restoreRevision } = createApp({ lockedBy: 'user-2' });
    const response = await request(app)
      .post('/api/casting/manuscripts/manuscript-1/restore-revision/revision-1')
      .set('If-Match', 'W/"4"');

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      error: 'locked_by_other',
      lockedBy: 'user-2',
    });
    expect(restoreRevision).not.toHaveBeenCalled();
  });

  it('routes the static revision diff endpoint before the revision id endpoint', async () => {
    const { app, diffRevisions, getRevisionById } = createApp();
    const response = await request(app)
      .get('/api/casting/manuscripts/manuscript-1/revisions/diff')
      .query({ from: 'revision-1', to: 'revision-2' });

    expect(response.status).toBe(200);
    expect(diffRevisions).toHaveBeenCalledWith('manuscript-1', 'revision-1', 'revision-2');
    expect(getRevisionById).not.toHaveBeenCalled();
  });
});
