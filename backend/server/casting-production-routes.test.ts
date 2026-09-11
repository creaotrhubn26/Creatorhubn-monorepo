import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createCastingProductionRouter } from './casting-production-routes.js';

const SESSION_TOKEN = 'test-session';
const PROJECT_ID = 'project-1';

function createApp(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  app.use('/api/role-room', createCastingProductionRouter(
    { query } as unknown as Pool,
    {
      activeSessions: new Map([[SESSION_TOKEN, {
        userId: 'first-ad-1',
        email: 'first-ad@example.test',
        name: 'First AD',
        role: 'first_ad',
        loginAt: new Date().toISOString(),
      }]]),
    },
  ));
  return app;
}

describe('casting production-day access', () => {
  it('allows an active project member to read production days', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE')) return { rows: [], rowCount: 0 };
      if (text.includes('AS can_access')) {
        return { rows: [{ project_exists: true, can_access: true }], rowCount: 1 };
      }
      if (text.includes('SELECT * FROM casting_production_days')) {
        return {
          rows: [{
            id: 'day-1',
            project_id: PROJECT_ID,
            date: '2026-09-11',
            scene_ids: ['scene-1'],
            crew_ids: ['first-ad-1'],
            prop_ids: [],
            status: 'planned',
          }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .get(`/api/role-room/projects/${PROJECT_ID}/production-days`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.productionDays).toEqual([
      expect.objectContaining({ id: 'day-1', projectId: PROJECT_ID }),
    ]);
  });

  it('allows a production editor to save a production day', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE')) return { rows: [], rowCount: 0 };
      if (text.includes('AS can_edit_production')) {
        return { rows: [{ project_exists: true, can_edit_production: true }], rowCount: 1 };
      }
      if (text.includes('INSERT INTO casting_production_days')) {
        return {
          rows: [{
            id: 'day-1',
            project_id: PROJECT_ID,
            date: '2026-09-11',
            scene_ids: ['scene-1'],
            crew_ids: ['first-ad-1'],
            prop_ids: [],
            status: 'planned',
          }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .post('/api/role-room/production-days')
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        id: 'day-1',
        projectId: PROJECT_ID,
        date: '2026-09-11',
        scenes: ['scene-1'],
        crew: ['first-ad-1'],
        props: [],
      });

    expect(response.status).toBe(201);
    expect(response.body.productionDay).toEqual(expect.objectContaining({
      id: 'day-1',
      projectId: PROJECT_ID,
    }));
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO casting_production_days'))).toBe(true);
  });

  it('hides the project and refuses writes without production permission', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE')) return { rows: [], rowCount: 0 };
      if (text.includes('AS can_edit_production')) {
        return { rows: [{ project_exists: true, can_edit_production: false }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .post('/api/role-room/production-days')
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ projectId: PROJECT_ID, date: '2026-09-11', scenes: [], crew: [], props: [] });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO casting_production_days'))).toBe(false);
  });
});
