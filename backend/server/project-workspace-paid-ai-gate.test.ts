import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateGenSettings } from './generative-media.js';
import { setupProjectWorkspaceRoutes } from './project-workspace-routes.js';

function paidLegacyApp(billingMode: 'credits' | 'metered') {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT 1 WHERE EXISTS')) {
        return { rows: [{ ok: 1 }], rowCount: 1 };
      }
      if (sql.includes('SELECT email, role FROM users')) {
        return {
          rows: [{ email: 'director@example.test', role: 'super_admin' }],
          rowCount: 1,
        };
      }
      if (sql.includes('SELECT * FROM generative_ai_settings')) {
        return {
          rows: [{
            enabled: true,
            billing_mode: billingMode,
            daily_cap_usd: 20,
            whitelist: [],
            included_quota: 0,
            markup_multiplier: 3,
            credit_packs: [],
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
  const app = express();
  app.use(express.json());
  setupProjectWorkspaceRoutes({
    app,
    pool,
    requireUserSession: () => ({
      userId: 'owner-user',
      email: 'director@example.test',
      name: 'Director',
      role: 'super_admin',
    }),
  });
  return { app, queries };
}

describe('legacy paid AI submit gate', () => {
  beforeEach(() => invalidateGenSettings());

  it('blocks concurrent credit-mode submits before provider or job creation', async () => {
    const { app, queries } = paidLegacyApp('credits');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    try {
      const [first, second] = await Promise.all([
        request(app).post('/api/projects/project-1/ai/concept-image')
          .send({ prompt: 'Graphite city at dawn' }),
        request(app).post('/api/projects/project-1/ai/concept-image')
          .send({ prompt: 'Graphite city at dusk' }),
      ]);

      expect([first.status, second.status]).toEqual([409, 409]);
      expect(first.body.error).toBe('legacy_ai_requires_durable_billing');
      expect(second.body.error).toBe('legacy_ai_requires_durable_billing');
      expect(queries.some(({ sql }) =>
        sql.includes('INSERT INTO generative_ai_jobs'))).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it.each([
    ['/api/projects/project-1/ai/image-edit', { assetId: 'asset-1', prompt: 'Edit' }],
    ['/api/projects/project-1/ai/concept-image', { prompt: 'Concept' }],
    ['/api/projects/project-1/ai/suggest', { assetId: 'asset-1', mode: 'motion' }],
    ['/api/projects/project-1/ai/image-to-video', { assetId: 'asset-1', prompt: 'Push in' }],
    ['/api/projects/project-1/ai/video-restyle', { versionId: 'version-1', prompt: 'Dusk' }],
    ['/api/projects/project-1/enhance-picks', { assetIds: ['asset-1'] }],
  ])('blocks metered legacy POST %s before source/provider I/O', async (path, body) => {
    invalidateGenSettings();
    const { app, queries } = paidLegacyApp('metered');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    try {
      const response = await request(app).post(path).send(body);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('legacy_ai_requires_durable_billing');
      expect(queries.some(({ sql }) =>
        sql.includes('FROM capture_assets')
        || sql.includes('FROM capture_sessions')
        || sql.includes('FROM project_video_versions')
        || sql.includes('INSERT INTO generative_ai_jobs'))).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });
});
