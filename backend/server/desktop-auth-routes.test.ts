import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createDesktopAuthRouter } from './desktop-auth-routes';

function createApp(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  app.use('/api/desktop', createDesktopAuthRouter({ query } as never));
  return app;
}

describe('CreatorHub One Desk project picker', () => {
  it('returns canonical public projects when the runtime role cannot use legacy schema', async () => {
    const query = vi.fn(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes('FROM desktop_device_tokens')) {
        return {
          rows: [{ id: 'device-1', user_id: 'user-1', user_email: 'owner@example.test' }],
        };
      }
      if (sql.includes('FROM projects') && !sql.includes('legacy.projects')) {
        return {
          rows: [
            {
              id: 'project-1',
              name: 'CreatorHub-opptak',
              created_at: '2026-09-19T10:00:00Z',
            },
          ],
        };
      }
      if (sql.includes('FROM legacy.projects')) {
        throw Object.assign(new Error('permission denied for schema legacy'), {
          code: '42501',
        });
      }
      return { rows: [], rowCount: 1 };
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const response = await request(createApp(query)).get('/api/desktop/me/projects').set('Authorization', 'Bearer trr_desk_test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.projects).toEqual([
      expect.objectContaining({
        id: 'project-1',
        name: 'CreatorHub-opptak',
        helper_token: expect.stringMatching(/^trr_dit_[a-f0-9]{64}$/),
      }),
    ]);
    const publicProjectQuery = query.mock.calls.find(([statement]) => {
      const sql = String(statement);
      return sql.includes('FROM projects') && !sql.includes('legacy.projects');
    });
    expect(publicProjectQuery?.[1]).toEqual(['user-1']);
    expect(String(publicProjectQuery?.[0])).toContain('status NOT IN');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('legacy projects unavailable'), 'permission denied for schema legacy');
    warn.mockRestore();
  });

  it('deduplicates migrated legacy rows in favor of the canonical public row', async () => {
    const query = vi.fn(async (statement: unknown) => {
      const sql = String(statement);
      if (sql.includes('FROM desktop_device_tokens')) {
        return {
          rows: [{ id: 'device-1', user_id: 'user-1', user_email: 'owner@example.test' }],
        };
      }
      if (sql.includes('FROM projects') && !sql.includes('legacy.projects')) {
        return {
          rows: [
            {
              id: 'project-1',
              name: 'Nytt navn',
              created_at: '2026-09-19T10:00:00Z',
            },
          ],
        };
      }
      if (sql.includes('FROM legacy.projects')) {
        return {
          rows: [
            {
              id: 'project-1',
              name: 'Gammelt navn',
              created_at: '2026-01-01T10:00:00Z',
            },
            {
              id: 'project-old',
              name: 'Arkivimport',
              created_at: '2025-01-01T10:00:00Z',
            },
          ],
        };
      }
      return { rows: [], rowCount: 1 };
    });

    const response = await request(createApp(query)).get('/api/desktop/me/projects').set('Authorization', 'Bearer trr_desk_test');

    expect(response.status).toBe(200);
    expect(
      response.body.projects.map((project: { id: string; name: string }) => ({
        id: project.id,
        name: project.name,
      })),
    ).toEqual([
      { id: 'project-1', name: 'Nytt navn' },
      { id: 'project-old', name: 'Arkivimport' },
    ]);
  });

  it('rejects Lightroom package downloads without a verified Desk device token', async () => {
    const query = vi.fn();

    const response = await request(createApp(query)).get('/api/desktop/me/lightroom-plugin');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Bearer-token påkrevd' });
    expect(query).not.toHaveBeenCalled();
  });

  it('streams a user-bound Lightroom package after verified Desk login', async () => {
    const query = vi.fn(async (statement: unknown, params?: unknown[]) => {
      const sql = String(statement);
      if (sql.includes('FROM desktop_device_tokens')) {
        return {
          rows: [{ id: 'device-1', user_id: 'user-1', user_email: 'owner@example.test' }],
        };
      }
      if (sql.includes('FROM lightroom_integration')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO lightroom_integration')) {
        return {
          rows: [{
            id: 'integration-1',
            user_id: 'user-1',
            plugin_token_hash: params?.[2],
            plugin_version: '1.1.0',
            configuration: {},
            sync_status: 'idle',
          }],
        };
      }
      if (sql.includes('FROM role_room_google_connections')) {
        return { rows: [] };
      }
      if (sql.includes('SELECT DISTINCT p.id, p.title, p.name')) {
        return {
          rows: [
            {
              id: 'project-1',
              title: 'Bryllup',
              name: 'Bryllup',
              project_profession: 'photographer',
              project_type: 'photography',
              workspace_category: 'visual',
            },
            {
              id: 'project-2',
              title: 'Sound Room',
              name: 'Sound Room',
              project_profession: 'photographer',
              project_type: 'recording',
              workspace_category: 'music',
            },
            {
              id: 'project-3',
              title: 'CEO-film',
              name: 'CEO-film',
              project_profession: 'ceo',
              project_type: 'film',
              workspace_category: 'service',
            },
          ],
        };
      }
      return { rows: [], rowCount: 1 };
    });

    const response = await request(createApp(query))
      .get('/api/desktop/me/lightroom-plugin')
      .set('Authorization', 'Bearer trr_desk_test')
      .buffer(true)
      .parse((responseStream, callback) => {
        const chunks: Buffer[] = [];
        responseStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        responseStream.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/zip');
    expect(response.headers['content-disposition']).toContain('CreatorHubNorge-Lightroom-Plugin.zip');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(500);
    const projectQuery = query.mock.calls.find(([statement]) =>
      String(statement).includes('SELECT DISTINCT p.id, p.title, p.name'),
    );
    expect(projectQuery?.[1]).toEqual(['user-1']);
  });

  it('issues a short-lived Lightroom SSO session for the authenticated Desk device', async () => {
    vi.stubEnv('LIGHTROOM_DESK_SSO_SECRET', 't'.repeat(64));
    const query = vi.fn(async (statement: unknown, params?: unknown[]) => {
      const sql = String(statement);
      if (sql.includes('FROM desktop_device_tokens')) {
        return {
          rows: [{ id: 'device-1', user_id: 'user-1', user_email: 'owner@example.test' }],
        };
      }
      if (sql.includes('FROM lightroom_integration')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO lightroom_integration')) {
        return {
          rows: [{
            id: 'integration-1',
            user_id: params?.[1],
            plugin_token_hash: null,
            plugin_version: '1.4.0',
            configuration: { authenticationMode: 'creatorhub_desk_sso' },
            sync_status: 'idle',
          }],
        };
      }
      if (sql.includes('SELECT DISTINCT p.id, p.title, p.name')) {
        return {
          rows: [
            {
              id: 'project-1',
              title: 'Bryllup',
              name: 'Bryllup',
              project_profession: 'photographer',
              project_type: 'photography',
              workspace_category: 'visual',
            },
            {
              id: 'project-2',
              title: 'Sound Room',
              name: 'Sound Room',
              project_profession: 'photographer',
              project_type: 'recording',
              workspace_category: 'music',
            },
            {
              id: 'project-3',
              title: 'CEO-film',
              name: 'CEO-film',
              project_profession: 'ceo',
              project_type: 'film',
              workspace_category: 'service',
            },
          ],
        };
      }
      if (sql.includes('FROM role_room_google_connections')) {
        return { rows: [] };
      }
      return { rows: [], rowCount: 1 };
    });

    const response = await request(createApp(query))
      .post('/api/desktop/me/lightroom-session')
      .set('Authorization', 'Bearer trr_desk_test');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(expect.objectContaining({
      success: true,
      token: expect.stringMatching(/^lrs_/),
      accountEmail: 'owner@example.test',
      pluginVersion: '1.4.0.2',
      driveAvailable: false,
      projects: [
        { id: 'project-1', title: 'Bryllup' },
        { id: 'project-3', title: 'CEO-film' },
      ],
      projectOptions: 'project-1=Bryllup&project-3=CEO-film',
    }));
    expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    vi.unstubAllEnvs();
  });
});
