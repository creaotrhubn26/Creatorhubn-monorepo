import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setupWeddingProductionMapRoutes } from './wedding-production-map-routes';

function buildApp(userId = 'owner-user') {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes('FROM wedding_timelines WHERE id::text')) {
        return { rows: [{ project_id: 'project-1', user_id: 'owner-user', photographer_id: null }], rowCount: 1 };
      }
      if (sql.includes('FROM wedding_timelines w')) {
        return { rows: [{ name: 'Owner User', crew_role: 'fotograf' }], rowCount: 1 };
      }
      if (sql.includes('FROM wedding_locations WHERE id::text')) return { rows: [{ ok: 1 }], rowCount: 1 };
      if (sql.includes('INSERT INTO wedding_location_checkins')) {
        return { rows: [{ location_id: '11111111-1111-4111-8111-111111111111', member_name: 'Crew', member_role: 'fotograf', checked_in_at: '2026-08-26T10:00:00Z' }], rowCount: 1 };
      }
      if (sql.includes('FROM wedding_crew_positions') && sql.includes('SELECT member_name')) {
        return { rows: [{ member_name: 'Owner User', member_role: 'fotograf', latitude: '59.91', longitude: '10.75', accuracy_m: '4.5', updated_at: '2026-08-26T10:00:00Z' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
  const app = express();
  app.use(express.json());
  setupWeddingProductionMapRoutes({
    app,
    pool,
    requireUserSession: () => ({ userId, email: `${userId}@example.test`, name: userId, role: 'user' }),
  });
  return { app, calls };
}

describe('wedding production map routes', () => {
  it('rejects invalid coordinates before persisting a position', async () => {
    const { app, calls } = buildApp();
    const response = await request(app)
      .post('/api/wedding/wedding-1/positions')
      .send({ memberName: 'Owner User', lat: 95, lng: 10.75 });
    expect(response.status).toBe(400);
    expect(calls.some((call) => call.sql.includes('INSERT INTO wedding_crew_positions'))).toBe(false);
  });

  it('binds live position identity to the authenticated user profile', async () => {
    const { app, calls } = buildApp();
    const response = await request(app)
      .post('/api/wedding/wedding-1/positions')
      .send({ memberName: 'Spoofed Name', memberRole: 'admin', lat: 59.91, lng: 10.75, accuracyM: 4.5 });
    expect(response.status).toBe(200);
    const insert = calls.find((call) => call.sql.includes('INSERT INTO wedding_crew_positions'));
    expect(insert?.params).toEqual(expect.arrayContaining(['Owner User', 'fotograf', 'owner-user']));
    expect(insert?.params).not.toContain('Spoofed Name');
  });

  it('scopes check-ins to locations belonging to the same wedding', async () => {
    const { app, calls } = buildApp();
    const response = await request(app)
      .post('/api/wedding/wedding-1/checkins')
      .send({ locationId: '11111111-1111-4111-8111-111111111111', memberName: 'Crew', memberRole: 'fotograf' });
    expect(response.status).toBe(201);
    const locationLookup = calls.find((call) => call.sql.includes('FROM wedding_locations WHERE id::text'));
    expect(locationLookup?.params).toEqual(['11111111-1111-4111-8111-111111111111', 'wedding-1']);
  });

  it('hides the wedding from an unrelated user', async () => {
    const { app } = buildApp('intruder');
    const response = await request(app).get('/api/wedding/wedding-1/positions');
    expect(response.status).toBe(404);
  });
});
