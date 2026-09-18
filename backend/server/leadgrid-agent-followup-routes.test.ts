import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { setupLeadMapRoutes } from './lead-map-routes.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ORG_ID = '33333333-3333-4333-8333-333333333333';
const LEAD_ID = '44444444-4444-4444-8444-444444444444';

function makeApp(options: { leadOrganizationId?: string; isMember?: boolean } = {}) {
  let updateParams: unknown[] | null = null;
  const leadOrganizationId = options.leadOrganizationId ?? ORG_ID;
  const isMember = options.isMember ?? true;
  const query = vi.fn(async (sqlValue: unknown, params?: unknown[]) => {
    const sql = String(sqlValue);
    if (sql.includes('SELECT COALESCE(c.organization_id::text')) {
      return { rows: [{ organization_id: leadOrganizationId }], rowCount: 1 };
    }
    if (sql.includes('SELECT role FROM organization_members')) {
      return { rows: isMember ? [{ role: 'admin' }] : [], rowCount: isMember ? 1 : 0 };
    }
    if (sql.includes('SELECT key FROM permissions')) {
      return { rows: [{ key: 'leads.update' }], rowCount: 1 };
    }
    if (sql.includes('UPDATE crm_customers') && sql.includes('next_follow_up_at')) {
      updateParams = params ?? [];
      return {
        rows: [{
          id: LEAD_ID,
          next_follow_up_at: new Date('2026-09-04T10:30:00.000Z'),
          next_action: 'Ring daglig leder',
        }],
        rowCount: 1,
      };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const pool = { query } as unknown as Pool;
  const app = express();
  app.use(express.json());
  setupLeadMapRoutes({
    app,
    pool,
    activeSessions: new Map([['session-token', { userId: USER_ID }]]),
  });
  return { app, query, updateParams: () => updateParams };
}

describe('PATCH /api/admin-room/lead-map/leads/:id/follow-up', () => {
  it('updates only the organization resolved from the lead resource', async () => {
    const { app, updateParams } = makeApp();
    const response = await request(app)
      .patch(`/api/admin-room/lead-map/leads/${LEAD_ID}/follow-up`)
      .set('Authorization', 'Bearer session-token')
      .send({
        organization_id: OTHER_ORG_ID,
        next_follow_up_at: '2026-09-04T12:30:00+02:00',
        next_action: ' Ring daglig leder ',
      })
      .expect(200);

    expect(response.body).toEqual({
      ok: true,
      lead_id: LEAD_ID,
      next_follow_up_at: '2026-09-04T10:30:00.000Z',
      next_action: 'Ring daglig leder',
    });
    expect(updateParams()).toEqual([
      LEAD_ID,
      ORG_ID,
      '2026-09-04T10:30:00.000Z',
      'Ring daglig leder',
    ]);
  });

  it('rejects a past timestamp before running the update', async () => {
    const { app, query } = makeApp();
    const response = await request(app)
      .patch(`/api/admin-room/lead-map/leads/${LEAD_ID}/follow-up`)
      .set('Authorization', 'Bearer session-token')
      .send({
        next_follow_up_at: '2020-01-01T12:00:00Z',
        next_action: 'Ring',
      })
      .expect(400);

    expect(response.body.error).toBe('validation_failed');
    expect(response.body.issues[0].path).toBe('next_follow_up_at');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE crm_customers'))).toBe(false);
  });

  it('rejects users outside the lead organization', async () => {
    const { app, query } = makeApp({ leadOrganizationId: OTHER_ORG_ID, isMember: false });
    const response = await request(app)
      .patch(`/api/admin-room/lead-map/leads/${LEAD_ID}/follow-up`)
      .set('Authorization', 'Bearer session-token')
      .send({
        next_follow_up_at: '2030-01-01T12:00:00Z',
        next_action: 'Ring',
      })
      .expect(403);

    expect(response.body).toMatchObject({
      error: 'ikke_medlem_av_org',
      organization_id: OTHER_ORG_ID,
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE crm_customers'))).toBe(false);
  });
});
