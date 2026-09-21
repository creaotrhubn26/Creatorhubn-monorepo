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
          rows: [{ user_id: 'user-1', user_email: 'owner@example.test' }],
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
          rows: [{ user_id: 'user-1', user_email: 'owner@example.test' }],
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
});
