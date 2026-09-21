import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { setupRoleRoomPartnershipsRoutes } from './role-room-partnerships-routes.js';

function createApp(role: string, permissions: Record<string, boolean> = {}) {
  const query = vi.fn(async (text: string) => {
    if (text.includes('AS project_exists')) {
      return {
        rows: [{
          project_exists: true,
          is_owner: false,
          member_role: role,
          member_permissions: permissions,
          member_additional_roles: [],
        }],
        rowCount: 1,
      };
    }
    if (text.includes('AS visible_talent_count')) {
      return {
        rows: [{
          invitation_id: 'invitation-1',
          agency_id: 'agency-1',
          agency_name: 'Nordic Talent',
          agency_logo_url: null,
          agency_verified: true,
          role_ids: null,
          expires_at: null,
          visible_talent_count: 1,
          pending_proposal_count: 0,
        }],
        rowCount: 1,
      };
    }
    if (text.includes('WITH scoped AS')) {
      return {
        rows: [{
          id: '11111111-1111-4111-8111-111111111111',
          display_name: 'Ada Skuespiller',
          city: 'Oslo',
          country: 'NO',
          headshot_url: null,
          playing_age_min: null,
          playing_age_max: null,
          gender: null,
          availability_status: 'open',
          agency_id: 'agency-1',
          agency_name: 'Nordic Talent',
          agency_logo_url: null,
          agency_verified: true,
          invitation_id: 'invitation-1',
          granted_scopes: ['basic_profile', 'availability'],
          already_proposed: false,
          already_candidate: false,
        }],
        rowCount: 1,
      };
    }
    if (text.includes('INSERT INTO talent_access_audit')) {
      return { rows: [], rowCount: 1 };
    }
    if (text.includes('SELECT ptp.*, p.production_user_id')) {
      return {
        rows: [{
          id: 'proposal-1',
          invitation_id: 'invitation-1',
          status: 'pending',
          production_user_id: 'owner-1',
          casting_project_id: 'project-1',
        }],
        rowCount: 1,
      };
    }
    if (text.includes('UPDATE partnership_talent_proposals')) {
      return { rows: [{ id: 'proposal-1', status: 'accepted' }], rowCount: 1 };
    }
    if (text.includes('WITH talent_info AS')) {
      return { rows: [{ id: 'candidate-1' }], rowCount: 1 };
    }
    if (text.includes('INSERT INTO partnership_audit')) {
      return { rows: [], rowCount: 1 };
    }
    if (text.includes('FROM partnership_talent_proposals ptp') && text.includes('ORDER BY ptp.created_at DESC')) {
      return { rows: [{ id: 'proposal-1', display_name: 'Ada Skuespiller', status: 'pending' }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });

  const app = express();
  app.use(express.json());
  setupRoleRoomPartnershipsRoutes({
    app,
    pool: { query } as unknown as Pool,
    getActiveSession: () => ({ userId: 'casting-user', email: 'casting@example.test' }),
  });
  return { app, query };
}

describe('project-scoped talent sourcing authorization', () => {
  it('lets a casting director search only through the project endpoint', async () => {
    const { app, query } = createApp('casting_director');
    const response = await request(app)
      .get('/api/role-room/partnerships/casting-projects/project-1/talent-search?q=Ada');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      project_id: 'project-1',
      can_manage_partnerships: false,
      talents: [{ display_name: 'Ada Skuespiller', headshot_url: null }],
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("CASE WHEN d.granted_scopes && ARRAY['media_portfolio','full_profile']"),
      ['project-1', '%Ada%', null, 40],
    );
  });

  it('denies a project viewer without the casting grant before talent data is queried', async () => {
    const { app, query } = createApp('reader');
    const response = await request(app)
      .get('/api/role-room/partnerships/casting-projects/project-1/talent-search');

    expect(response.status).toBe(403);
    expect(query.mock.calls.some(([text]) => String(text).includes('WITH scoped AS'))).toBe(false);
  });

  it('allows casting directors to receive and accept agency proposals', async () => {
    const { app } = createApp('casting_director');

    const listResponse = await request(app)
      .get('/api/role-room/partnerships/casting-projects/project-1/incoming-talent-proposals');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.proposals).toHaveLength(1);

    const response = await request(app)
      .post('/api/role-room/partnerships/talent-proposals/proposal-1/respond')
      .send({ accept: true, production_notes: 'Inviter til self-tape' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ candidate_id: 'candidate-1' });
  });
});
