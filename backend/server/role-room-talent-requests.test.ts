import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { setupRoleRoomPartnershipsRoutes } from './role-room-partnerships-routes.js';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const INVITATION_ID = '22222222-2222-4222-8222-222222222222';
const TALENT_ID = '33333333-3333-4333-8333-333333333333';
const FUTURE_DEADLINE = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

function createApp(options?: { role?: string; agency?: boolean }) {
  const role = options?.role ?? 'casting_director';
  const query = vi.fn(async (text: string) => {
    if (text.includes('AS project_exists')) {
      return {
        rows: [{
          project_exists: true,
          is_owner: false,
          member_role: role,
          member_permissions: {},
          member_additional_roles: [],
        }],
        rowCount: 1,
      };
    }
    if (text.includes('u.agency_org_id::text AS agency_org_id')) {
      return {
        rows: [{
          user_id: 'agency-user',
          agency_org_id: options?.agency ? '44444444-4444-4444-8444-444444444444' : null,
          agency_name: options?.agency ? 'Nordic Talent' : null,
          agency_logo_url: null,
          agency_type: options?.agency ? 'casting_agency' : null,
        }],
        rowCount: 1,
      };
    }
    if (text.includes('AS already_proposed')) {
      return {
        rows: [{
          invitation_id: INVITATION_ID,
          casting_project_id: 'project-1',
          partnership_id: '55555555-5555-4555-8555-555555555555',
          agency_id: '44444444-4444-4444-8444-444444444444',
          agency_type: 'casting_agency',
          agency_name: 'Nordic Talent',
          agency_email: null,
          project_name: 'Troll',
          role_name: 'NORA',
          talent_display_name: 'Ada Skuespiller',
          already_proposed: false,
        }],
        rowCount: 1,
      };
    }
    if (text.includes('INSERT INTO partnership_talent_requests')) {
      return {
        rows: [{
          id: REQUEST_ID,
          invitation_id: INVITATION_ID,
          talent_id: TALENT_ID,
          casting_role_id: 'role-1',
          brief: 'Vurder profilen for fjellscenene.',
          status: 'pending',
        }],
        rowCount: 1,
      };
    }
    if (text.includes('AS has_active_consent')) {
      return {
        rows: [{
          id: REQUEST_ID,
          invitation_id: INVITATION_ID,
          talent_id: TALENT_ID,
          casting_role_id: 'role-1',
          status: 'acknowledged',
          response_deadline: FUTURE_DEADLINE,
          casting_project_id: 'project-1',
          invitation_status: 'accepted',
          invitation_expires_at: null,
          partnership_id: '55555555-5555-4555-8555-555555555555',
          partnership_status: 'accepted',
          partnership_paused_at: null,
          production_user_id: 'owner-1',
          agency_id: '44444444-4444-4444-8444-444444444444',
          agency_type: 'casting_agency',
          agency_name: 'Nordic Talent',
          project_name: 'Troll',
          role_name: 'NORA',
          talent_display_name: 'Ada Skuespiller',
          production_email: null,
          production_name: 'Troll Produsent',
          has_active_consent: true,
        }],
        rowCount: 1,
      };
    }
    if (text.includes('requester.first_name')) {
      return {
        rows: [{
          id: REQUEST_ID,
          status: 'pending',
          talent_display_name: 'Ada Skuespiller',
          role_name: 'NORA',
          agency_name: 'Nordic Talent',
        }],
        rowCount: 1,
      };
    }
    if (text.includes("THEN t.display_name ELSE 'Samtykke trukket'")) {
      return {
        rows: [{
          id: REQUEST_ID,
          status: 'pending',
          response_deadline: FUTURE_DEADLINE,
          created_at: new Date().toISOString(),
          talent_display_name: 'Ada Skuespiller',
          role_name: 'NORA',
          project_name: 'Troll',
          agency_name: 'Nordic Talent',
        }],
        rowCount: 1,
      };
    }
    if (text.includes('AS oldest_unacknowledged_hours')) {
      return {
        rows: [{
          open: 1,
          unacknowledged: 1,
          due_within_48h: 0,
          overdue: 0,
          oldest_unacknowledged_hours: 2,
        }],
        rowCount: 1,
      };
    }
    if (text.includes('SELECT ptr.*, i.casting_project_id, i.partnership_id')) {
      return {
        rows: [{
          id: REQUEST_ID,
          invitation_id: INVITATION_ID,
          status: 'pending',
          casting_project_id: 'project-1',
          partnership_id: '55555555-5555-4555-8555-555555555555',
        }],
        rowCount: 1,
      };
    }
    if (text.includes("SET status = 'cancelled'")) {
      return { rows: [{ id: REQUEST_ID, status: 'cancelled' }], rowCount: 1 };
    }
    if (text.includes('WITH active_request AS')) {
      return {
        rows: [{ id: REQUEST_ID, status: 'fulfilled', proposal_id: 'proposal-1' }],
        rowCount: 1,
      };
    }
    if (text.includes('INSERT INTO partnership_audit')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });

  const app = express();
  app.use(express.json());
  setupRoleRoomPartnershipsRoutes({
    app,
    pool: { query } as unknown as Pool,
    getActiveSession: () => ({ userId: options?.agency ? 'agency-user' : 'casting-user' }),
  });
  return { app, query };
}

describe('partnership talent request workflow', () => {
  it('lets a casting director create a scoped request without creating a candidate', async () => {
    const { app, query } = createApp();
    const response = await request(app)
      .post('/api/role-room/partnerships/casting-projects/project-1/talent-requests')
      .send({
        invitation_id: INVITATION_ID,
        talent_id: TALENT_ID,
        casting_role_id: 'role-1',
        brief: 'Vurder profilen for fjellscenene.',
        response_deadline: FUTURE_DEADLINE,
      });

    expect(response.status).toBe(201);
    expect(response.body.request).toMatchObject({
      id: REQUEST_ID,
      status: 'pending',
      agency_name: 'Nordic Talent',
      role_name: 'NORA',
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO casting_candidates'))).toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("c.scope IN ('basic_profile', 'full_profile')"),
      ['project-1', INVITATION_ID, TALENT_ID, 'role-1'],
    );
  });

  it('rejects a viewer before invitation or talent data is loaded', async () => {
    const { app, query } = createApp({ role: 'reader' });
    const response = await request(app)
      .post('/api/role-room/partnerships/casting-projects/project-1/talent-requests')
      .send({
        invitation_id: INVITATION_ID,
        talent_id: TALENT_ID,
        casting_role_id: 'role-1',
        brief: 'Vurder profilen.',
        response_deadline: FUTURE_DEADLINE,
      });

    expect(response.status).toBe(403);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('AS already_proposed'))).toBe(false);
  });

  it('lists and cancels requests through the same casting grant', async () => {
    const { app } = createApp();
    const list = await request(app)
      .get('/api/role-room/partnerships/casting-projects/project-1/talent-requests');
    expect(list.status).toBe(200);
    expect(list.body.requests).toEqual([
      expect.objectContaining({ id: REQUEST_ID, status: 'pending', talent_display_name: 'Ada Skuespiller' }),
    ]);

    const cancelled = await request(app)
      .post(`/api/role-room/partnerships/talent-requests/${REQUEST_ID}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.request).toMatchObject({ id: REQUEST_ID, status: 'cancelled' });
  });

  it('lets only the owning agency fulfil a request into a proposal', async () => {
    const { app, query } = createApp({ agency: true });
    const response = await request(app)
      .post(`/api/role-room/partnerships/talent-requests/${REQUEST_ID}/respond`)
      .send({ action: 'fulfill', response_note: 'Talentet ønsker å bli foreslått.' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      request: { status: 'fulfilled' },
      proposal_id: 'proposal-1',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM active_request'),
      [REQUEST_ID, 'agency-user', 'Talentet ønsker å bli foreslått.'],
    );
  });

  it('returns a project-scoped agency work queue with SLA summary', async () => {
    const { app } = createApp({ agency: true });
    const response = await request(app)
      .get('/api/role-room/partnerships/talent-requests/incoming');

    expect(response.status).toBe(200);
    expect(response.body.requests).toEqual([
      expect.objectContaining({ id: REQUEST_ID, talent_display_name: 'Ada Skuespiller' }),
    ]);
    expect(response.body.summary).toEqual({
      open: 1,
      unacknowledged: 1,
      due_within_48h: 0,
      overdue: 0,
      oldest_unacknowledged_hours: 2,
    });
  });

  it('requires a reason when the agency declines', async () => {
    const { app } = createApp({ agency: true });
    const response = await request(app)
      .post(`/api/role-room/partnerships/talent-requests/${REQUEST_ID}/respond`)
      .send({ action: 'decline' });

    expect(response.status).toBe(400);
  });

  it('keeps migration and Drizzle contracts aligned', () => {
    const migration = readFileSync(
      fileURLToPath(new URL('../migrations/0655_partnership_talent_requests.sql', import.meta.url)),
      'utf8',
    );
    const drizzleSchema = readFileSync(
      fileURLToPath(new URL('../migrations/role-room-schema.ts', import.meta.url)),
      'utf8',
    );

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS partnership_talent_requests');
    expect(migration).toContain("WHERE status IN ('pending', 'acknowledged')");
    expect(migration).toContain('REFERENCES partnership_talent_proposals(id) ON DELETE SET NULL');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS partnership_talent_request_deliveries');
    expect(migration).toContain('UNIQUE (talent_request_id, notification_kind)');
    expect(drizzleSchema).toContain("export const partnershipTalentRequests = pgTable('partnership_talent_requests'");
    expect(drizzleSchema).toContain("export const partnershipTalentRequestDeliveries = pgTable('partnership_talent_request_deliveries'");
    expect(drizzleSchema).toContain("uniqueIndex('ptr_unique_active_request')");
  });
});
