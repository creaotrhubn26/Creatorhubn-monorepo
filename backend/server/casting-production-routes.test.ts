import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import {
  createCastingProductionRouter,
  type CreateCastingProductionRouterDeps,
} from './casting-production-routes.js';

const SESSION_TOKEN = 'test-session';
const PROJECT_ID = 'project-1';

const locationOperationsPayload = () => ({
  stage: 'recce',
  decisionStatus: 'shortlisted',
  ownerCommunication: { status: 'awaiting_reply', contactName: 'Kari Grunneier' },
  dateAvailability: { status: 'requested', confirmedDates: [] },
  recce: { status: 'scheduled', scheduledAt: '2026-09-20T08:00', attendees: ['DoP', '1st AD'] },
  clearanceGates: [{ id: 'owner', category: 'owner', title: 'Eieravtale', status: 'requested', mandatory: true }],
  logistics: { unitBase: 'P1', emergencyAccess: 'Nordport' },
  finance: { currency: 'NOK', locationFee: 10000, permitFees: 1200, restorationReserve: 3000, status: 'quoted' },
  risks: [{ id: 'weather', title: 'Vind', severity: 'high', status: 'mitigating', mitigation: 'Vindmåling' }],
  weatherPlan: 'Flytt eksteriør til dag 2.',
  nextAction: 'Følg opp kommunen.',
});

const readyLocationDecisionPayload = () => ({
  ...locationOperationsPayload(),
  stage: 'hold',
  ownerCommunication: { status: 'agreed', contactName: 'Kari Grunneier' },
  dateAvailability: { status: 'verified', confirmedDates: ['2026-09-20'] },
  recce: { status: 'completed', completedAt: '2026-09-14T12:00:00Z', attendees: ['DoP', '1st AD'] },
  clearanceGates: [{ id: 'owner', category: 'owner', title: 'Eieravtale', status: 'verified', mandatory: true }],
  finance: { currency: 'NOK', locationFee: 10000, permitFees: 1200, restorationReserve: 3000, status: 'approved' },
  risks: [],
  backupLocationId: 'location-backup',
  decisionReview: {
    criteria: [
      ['creative_fit', 'Kreativ og dramaturgisk match'],
      ['camera_light', 'Kamera og lys'],
      ['sound', 'Lydforhold'],
      ['access_logistics', 'Adkomst og logistikk'],
      ['owner_permits', 'Eier og tillatelser'],
      ['safety', 'Sikkerhet'],
      ['schedule', 'Dato og opptaksplan'],
      ['budget', 'Budsjett'],
    ].map(([id, label]) => ({ id, label, required: true, status: 'pass', evidence: `Dokumentert: ${label}`, mediaIds: [] })),
    signoffs: [
      { role: 'director', status: 'approved', userId: 'director-1', decidedAt: '2026-09-14T10:00:00Z' },
      { role: 'cinematographer', status: 'approved', userId: 'dop-1', decidedAt: '2026-09-14T10:05:00Z' },
      { role: 'producer', status: 'approved', userId: 'producer-1', decidedAt: '2026-09-14T10:10:00Z' },
    ],
  },
  activity: [],
});

function createApp(
  query: ReturnType<typeof vi.fn>,
  overrides: Omit<CreateCastingProductionRouterDeps, 'activeSessions'> = {},
) {
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
      ...overrides,
    },
  ));
  return app;
}

describe('production day change impact', () => {
  const PATH = `/api/role-room/projects/${PROJECT_ID}/production-days/day-6/impact`;

  const impactQuery = (counts: Record<string, number>, dayDate: string | null = '2026-09-20') =>
    vi.fn(async (text: string) => {
      if (/ALTER TABLE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX/.test(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('AS member_role')) {
        return {
          rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }],
          rowCount: 1,
        };
      }
      if (text.includes('FROM casting_production_days') && text.includes('YYYY-MM-DD')) {
        return { rows: dayDate ? [{ id: 'day-6', date: dayDate }] : [], rowCount: dayDate ? 1 : 0 };
      }
      const table = Object.keys(counts).find((name) => text.includes(name));
      return { rows: [{ count: table ? counts[table] : 0 }], rowCount: 1 };
    });

  it('lists what breaks and flags the blocking one', async () => {
    const app = createApp(impactQuery({ role_room_call_sheet_deliveries: 1, equipment_bookings: 2 }));

    const response = await request(app)
      .get(`${PATH}?date=2026-09-24`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.from).toBe('2026-09-20');
    expect(response.body.to).toBe('2026-09-24');
    expect(response.body.blocking).toBe(true);
    expect(response.body.impacts.map((i: { area: string }) => i.area)).toContain('call_sheet');
  });

  it('says nothing changes when the date is the same', async () => {
    const app = createApp(impactQuery({ role_room_call_sheet_deliveries: 1 }));

    const response = await request(app)
      .get(`${PATH}?date=2026-09-20`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ unchanged: true, impacts: [], blocking: false });
  });

  it('rejects a date it cannot parse instead of guessing', async () => {
    const app = createApp(impactQuery({}));

    const response = await request(app)
      .get(`${PATH}?date=torsdag`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(400);
  });

  it('hides a day that does not belong to the project', async () => {
    const app = createApp(impactQuery({}, null));

    const response = await request(app)
      .get(`${PATH}?date=2026-09-24`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(404);
  });

  it('fails loudly rather than reporting an empty impact list', async () => {
    const query = vi.fn(async (text: string) => {
      if (/ALTER TABLE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX/.test(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('AS member_role')) {
        return {
          rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }],
          rowCount: 1,
        };
      }
      if (text.includes('FROM casting_production_days') && text.includes('YYYY-MM-DD')) {
        return { rows: [{ id: 'day-6', date: '2026-09-20' }], rowCount: 1 };
      }
      throw new Error('database unavailable');
    });

    const response = await request(createApp(query))
      .get(`${PATH}?date=2026-09-24`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('impact_unavailable');
  });

  it('requires the same grant as moving the day', async () => {
    const query = vi.fn(async (text: string) => {
      if (/ALTER TABLE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX/.test(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('AS member_role')) {
        return {
          rows: [{ project_exists: true, is_owner: false, member_role: 'viewer', member_permissions: null }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const response = await request(createApp(query))
      .get(`${PATH}?date=2026-09-24`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(404);
  });
});

describe('project access endpoint', () => {
  const accessQuery = (row: Record<string, unknown> | null) => vi.fn(async (text: string) => {
    if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) {
      return { rows: [], rowCount: 0 };
    }
    if (text.includes('AS member_role')) {
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  });

  it('answers with the effective role and grants for the caller', async () => {
    const app = createApp(accessQuery({
      project_exists: true,
      is_owner: false,
      member_role: 'location_manager',
      member_permissions: {},
    }));

    const response = await request(app)
      .get(`/api/role-room/projects/${PROJECT_ID}/access`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.access).toEqual(expect.objectContaining({
      projectId: PROJECT_ID,
      role: 'location_manager',
      isOwner: false,
      isMember: true,
    }));
    expect(response.body.access.grants).toEqual(expect.objectContaining({
      canManageLocations: true,
      canManageProduction: false,
      canManageContinuity: false,
    }));
  });

  it('hides the project from a user with no active membership', async () => {
    const app = createApp(accessQuery({
      project_exists: true,
      is_owner: false,
      member_role: null,
      member_permissions: null,
    }));

    const response = await request(app)
      .get(`/api/role-room/projects/${PROJECT_ID}/access`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(404);
  });

  it('requires authentication', async () => {
    const app = createApp(accessQuery(null));

    const response = await request(app).get(`/api/role-room/projects/${PROJECT_ID}/access`);

    expect(response.status).toBe(401);
  });
});

describe('casting production-day access', () => {
  it('uploads a validated scout photo through the project-scoped AWS S3 adapter', async () => {
    const uploadLocationScoutPhoto = vi.fn().mockResolvedValue({
      ok: true,
      media: {
        id: '3d1357e0-7fe8-4c11-b5f1-0b1fe4c586d2',
        projectId: PROJECT_ID,
        locationId: 'location-1',
        uploadedBy: 'first-ad-1',
        clientUploadId: '11111111-1111-4111-8111-111111111111',
        kind: 'photo',
        captureMetadata: { source: 'camera', sceneIds: ['12A'] },
        displayName: 'scout.png',
        contentType: 'image/png',
        sizeBytes: 33,
        checksumSha256: 'a'.repeat(64),
        createdAt: '2026-09-13T12:00:00.000Z',
      },
    });
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      if (text.includes('FROM casting_locations')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(25),
    ]);

    const response = await request(createApp(query, { uploadLocationScoutPhoto }))
      .post(`/api/role-room/projects/${PROJECT_ID}/locations/location-1/media`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .field('clientUploadId', '11111111-1111-4111-8111-111111111111')
      .field('kind', 'photo')
      .field('metadata', JSON.stringify({ source: 'camera', sceneIds: ['12A'] }))
      .attach('file', png, { filename: 'scout.png', contentType: 'image/png' });

    expect(response.status).toBe(201);
    expect(response.body.media).toEqual(expect.objectContaining({ displayName: 'scout.png', contentType: 'image/png' }));
    expect(uploadLocationScoutPhoto).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'first-ad-1', projectId: PROJECT_ID, locationId: 'location-1', contentType: 'image/png',
      clientUploadId: '11111111-1111-4111-8111-111111111111', kind: 'photo',
      captureMetadata: expect.objectContaining({ source: 'camera', sceneIds: ['12A'] }),
    }));
  });

  it('rejects a declared panorama when the uploaded bytes are audio', async () => {
    const uploadLocationScoutPhoto = vi.fn();
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      if (text.includes('FROM casting_locations')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(20)]);

    const response = await request(createApp(query, { uploadLocationScoutPhoto }))
      .post(`/api/role-room/projects/${PROJECT_ID}/locations/location-1/media`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .field('kind', 'panorama')
      .attach('file', wav, { filename: 'room.wav', contentType: 'audio/wav' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/samsvarer ikke/i);
    expect(uploadLocationScoutPhoto).not.toHaveBeenCalled();
  });

  it('hides scout media from users without project access', async () => {
    const listLocationScoutMedia = vi.fn();
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) return { rows: [{ project_exists: true, is_owner: false, member_role: null, member_permissions: null }], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query, { listLocationScoutMedia }))
      .get(`/api/role-room/projects/${PROJECT_ID}/locations/location-1/media`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
    expect(listLocationScoutMedia).not.toHaveBeenCalled();
  });

  it('atomically creates a validated location readiness version and server audit entry', async () => {
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.includes('FROM casting_locations')) {
        expect(values).toEqual([PROJECT_ID, 'location-1']);
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      if (text.includes('FROM role_room_location_operations') && text.includes('location_id = $2')) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('INSERT INTO role_room_location_operations')) {
        const saved = JSON.parse(String(values?.[3] ?? '{}'));
        expect(saved).toEqual(expect.objectContaining({
          stage: 'recce',
          decisionStatus: 'shortlisted',
          nextAction: 'Følg opp kommunen.',
        }));
        expect(saved.decisionReview.signoffs).toEqual([
          { role: 'director', status: 'pending' },
          { role: 'cinematographer', status: 'pending' },
          { role: 'producer', status: 'pending' },
        ]);
        expect(saved.decisionReview.lockedAt).toBeUndefined();
        expect(saved.activity).toEqual([
          expect.objectContaining({ type: 'workspace_saved', actorUserId: 'first-ad-1' }),
        ]);
        return {
          rows: [{
            location_id: 'location-1', operations: saved, version: 1,
            updated_by: 'first-ad-1', updated_at: '2026-09-13T12:00:00Z',
          }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/locations/location-1/operations`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        operations: {
          ...locationOperationsPayload(),
          decisionReview: {
            criteria: [],
            signoffs: [{ role: 'director', status: 'approved', userId: 'spoofed-user', decidedAt: '2026-09-13T10:00:00Z' }],
            lockedAt: '2026-09-13T10:00:00Z',
            lockedBy: 'spoofed-user',
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.locationOperation).toEqual(expect.objectContaining({
      locationId: 'location-1', version: 1, updatedBy: 'first-ad-1',
    }));
  });

  it('returns the latest location readiness state instead of silently overwriting a newer version', async () => {
    const current = { ...locationOperationsPayload(), stage: 'cleared' };
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.includes('FROM casting_locations')) {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      if (text.includes('FROM role_room_location_operations') && text.includes('location_id = $2')) {
        return {
          rows: [{ location_id: 'location-1', operations: current, version: 3, updated_by: 'location-manager-2' }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/locations/location-1/operations`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 2, operations: locationOperationsPayload() });

    expect(response.status).toBe(409);
    expect(response.body.locationOperation).toEqual(expect.objectContaining({
      locationId: 'location-1', version: 3,
      operations: expect.objectContaining({ stage: 'cleared' }),
    }));
    // Uniform envelope: readable without knowing which lane lost the race.
    expect(response.body.conflict).toEqual({
      lane: 'location_operations',
      currentVersion: 3,
      updatedBy: 'location-manager-2',
      updatedAt: undefined,
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO role_room_location_operations'))).toBe(false);
  });

  it('invalidates all role approvals when the signed decision basis changes', async () => {
    const current = readyLocationDecisionPayload();
    const incoming = {
      ...current,
      decisionReview: {
        ...current.decisionReview,
        recommendationNote: 'Ny produksjonskonsekvens etter siste recce.',
      },
    };
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.includes('FROM casting_locations')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
      if (text.includes('FROM role_room_location_operations') && text.includes('location_id = $2')) {
        return { rows: [{ location_id: 'location-1', operations: current, version: 4, updated_by: 'producer-1' }], rowCount: 1 };
      }
      if (text.includes('INSERT INTO role_room_location_operations')) {
        const saved = JSON.parse(String(values?.[3] ?? '{}'));
        expect(saved.decisionReview.signoffs).toEqual([
          { role: 'director', status: 'pending' },
          { role: 'cinematographer', status: 'pending' },
          { role: 'producer', status: 'pending' },
        ]);
        expect(saved.activity).toContainEqual(expect.objectContaining({
          type: 'workspace_saved',
          message: 'Oppdaterte beslutningsgrunnlaget. Tidligere rollegodkjenninger ble nullstilt.',
        }));
        return { rows: [{ location_id: 'location-1', operations: saved, version: 5, updated_by: 'first-ad-1' }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/locations/location-1/operations`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 4, operations: incoming });

    expect(response.status).toBe(200);
    expect(response.body.locationOperation.operations.decisionReview.signoffs).toEqual([
      { role: 'director', status: 'pending' },
      { role: 'cinematographer', status: 'pending' },
      { role: 'producer', status: 'pending' },
    ]);
  });

  it('rejects incomplete location readiness payloads before writing', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/locations/location-1/operations`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 0, operations: { stage: 'recce' } });

    expect(response.status).toBe(400);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO role_room_location_operations'))).toBe(false);
  });

  it('hides location readiness writes from project members without location authority', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: false, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/locations/location-1/operations`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 0, operations: locationOperationsPayload() });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('role_room_location_operations'))).toBe(false);
  });

  it('refuses to attach readiness data to a location outside the requested project', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.includes('FROM casting_locations')) return { rows: [], rowCount: 0 };
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/locations/foreign-location/operations`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 0, operations: locationOperationsPayload() });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO role_room_location_operations'))).toBe(false);
  });

  it('derives the signer role on the server and records immutable approval provenance', async () => {
    const current = {
      ...locationOperationsPayload(),
      decisionReview: {
        criteria: [],
        signoffs: [
          { role: 'director', status: 'pending' },
          { role: 'cinematographer', status: 'pending' },
          { role: 'producer', status: 'pending' },
        ],
      },
      activity: [],
    };
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: false, member_role: 'director', member_permissions: {} }], rowCount: 1 };
      }
      if (text.includes('FROM role_room_location_operations operations')) {
        return { rows: [{ location_id: 'location-1', operations: current, version: 1, updated_by: 'location-manager-1' }], rowCount: 1 };
      }
      if (text.includes('UPDATE role_room_location_operations')) {
        const saved = JSON.parse(String(values?.[3] ?? '{}'));
        expect(saved.decisionReview.signoffs).toContainEqual(expect.objectContaining({
          role: 'director', status: 'approved', userId: 'first-ad-1', decidedAt: expect.any(String),
        }));
        expect(saved.activity).toContainEqual(expect.objectContaining({
          type: 'decision_approved', actorRole: 'director', actorUserId: 'first-ad-1',
        }));
        return { rows: [{ location_id: 'location-1', operations: saved, version: 2, updated_by: 'first-ad-1' }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .post(`/api/role-room/projects/${PROJECT_ID}/locations/location-1/decision`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 1, action: 'approve', role: 'producer', userId: 'spoofed-user' });

    expect(response.status).toBe(200);
    expect(response.body.locationOperation).toEqual(expect.objectContaining({ locationId: 'location-1', version: 2 }));
  });

  it('hides decision actions from project roles without review authority', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: false, member_role: 'first_ad', member_permissions: {} }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .post(`/api/role-room/projects/${PROJECT_ID}/locations/location-1/decision`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 1, action: 'approve' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('role_room_location_operations operations'))).toBe(false);
  });

  it('returns exact unmet requirements instead of locking an incomplete decision', async () => {
    const current = {
      ...locationOperationsPayload(),
      decisionReview: { criteria: [], signoffs: [] },
      activity: [],
    };
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: false, member_role: 'producer', member_permissions: {} }], rowCount: 1 };
      }
      if (text.includes('FROM role_room_location_operations operations')) {
        return { rows: [{ location_id: 'location-1', operations: current, version: 1, updated_by: 'location-manager-1' }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .post(`/api/role-room/projects/${PROJECT_ID}/locations/location-1/decision`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 1, action: 'lock' });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('decision_not_ready');
    expect(response.body.reasons).toEqual(expect.arrayContaining([
      'Kreativ og dramaturgisk match er ikke godkjent',
      'Eieravtalen er ikke bekreftet',
      'Backup-lokasjon er ikke valgt',
      'director har ikke godkjent',
    ]));
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE role_room_location_operations'))).toBe(false);
  });

  it('locks a fully evidenced and approved primary location with optimistic concurrency', async () => {
    const current = readyLocationDecisionPayload();
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: false, member_role: 'producer', member_permissions: {} }], rowCount: 1 };
      }
      if (text.includes('FROM role_room_location_operations operations')) {
        return { rows: [{ location_id: 'location-1', operations: current, version: 4, updated_by: 'location-manager-1' }], rowCount: 1 };
      }
      if (text.includes('FROM casting_locations') && text.includes('id <> $3')) {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      if (text.includes('UPDATE role_room_location_operations')) {
        const saved = JSON.parse(String(values?.[3] ?? '{}'));
        expect(saved).toEqual(expect.objectContaining({ stage: 'cleared', decisionStatus: 'primary' }));
        expect(saved.decisionReview).toEqual(expect.objectContaining({
          lockedAt: expect.any(String), lockedBy: 'first-ad-1', lockedVersion: 5,
        }));
        return { rows: [{ location_id: 'location-1', operations: saved, version: 5, updated_by: 'first-ad-1' }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .post(`/api/role-room/projects/${PROJECT_ID}/locations/location-1/decision`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 4, action: 'lock' });

    expect(response.status).toBe(200);
    expect(response.body.locationOperation).toEqual(expect.objectContaining({ version: 5 }));
    expect(response.body.locationOperation.operations.activity).toContainEqual(expect.objectContaining({ type: 'decision_locked' }));
  });

  it('allows an active project member to read production days', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
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
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
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

  it('keeps management, coordination and continuity state outside generic production-day writes', async () => {
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.includes('INSERT INTO casting_production_days')) {
        const savedData = JSON.parse(String(values?.[10] ?? '{}'));
        expect(savedData.productionManagement).toBeUndefined();
        expect(savedData.managementVersion).toBeUndefined();
        expect(savedData.productionCoordination).toBeUndefined();
        expect(savedData.coordinationVersion).toBeUndefined();
        expect(savedData.productionContinuity).toBeUndefined();
        expect(savedData.continuityVersion).toBeUndefined();
        expect(text).toContain("casting_production_days.data -> 'productionManagement'");
        expect(text).toContain("casting_production_days.data -> 'productionCoordination'");
        expect(text).toContain("casting_production_days.data -> 'productionContinuity'");
        return {
          rows: [{ id: 'day-1', project_id: PROJECT_ID, date: '2026-09-11', scene_ids: [], crew_ids: [], prop_ids: [], data: savedData }],
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
        scenes: [],
        crew: [],
        props: [],
        productionManagement: { dayStatus: 'completed' },
        managementVersion: 99,
        productionCoordination: { tasks: [{ id: 'forged' }] },
        coordinationVersion: 99,
        productionContinuity: { takes: [{ id: 'forged' }] },
        continuityVersion: 99,
      });

    expect(response.status).toBe(201);
  });

  it('atomically saves validated production-management operations and creates server audit data', async () => {
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.startsWith('SELECT * FROM casting_production_days')) {
        return {
          rows: [{ id: 'day-1', project_id: PROJECT_ID, date: '2026-09-11', management_version: 0, data: {} }],
          rowCount: 1,
        };
      }
      if (text.includes('UPDATE casting_production_days')) {
        expect(values?.slice(0, 3)).toEqual([PROJECT_ID, 'day-1', 0]);
        const operations = JSON.parse(String(values?.[3]));
        expect(operations).toEqual(expect.objectContaining({
          dayStatus: 'ready',
          callSheetApproval: 'ready_for_review',
          crewConfirmations: [],
          checkpoints: [],
          issues: [],
          costItems: [],
        }));
        expect(operations.activity).toEqual([
          expect.objectContaining({ type: 'workspace_saved', actorUserId: 'first-ad-1' }),
        ]);
        return {
          rows: [{
            id: 'day-1',
            project_id: PROJECT_ID,
            date: '2026-09-11',
            management_version: 1,
            management_updated_by: 'first-ad-1',
            data: { productionManagement: operations },
          }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/production-management`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        operations: {
          dayStatus: 'ready',
          callSheetApproval: 'ready_for_review',
          crewConfirmations: [],
          checkpoints: [],
          issues: [],
          costItems: [],
          notes: 'Alle leveranser kontrollert',
          activity: [{ id: 'forged', type: 'workspace_saved', message: 'Falsk audit', createdAt: '2020-01-01' }],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.productionDay).toEqual(expect.objectContaining({
      id: 'day-1',
      managementVersion: 1,
      managementUpdatedBy: 'first-ad-1',
    }));
    expect(response.body.productionDay.productionManagement.activity).toHaveLength(1);
    expect(response.body.productionDay.productionManagement.activity[0].id).not.toBe('forged');
  });

  it('returns the latest production day on an optimistic concurrency conflict', async () => {
    const latestRow = {
      id: 'day-1',
      project_id: PROJECT_ID,
      date: '2026-09-11',
      management_version: 3,
      data: { productionManagement: { dayStatus: 'at_risk' } },
    };
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.startsWith('SELECT * FROM casting_production_days')) {
        return { rows: [latestRow], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/production-management`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 2,
        operations: {
          dayStatus: 'ready', callSheetApproval: 'not_ready', crewConfirmations: [], checkpoints: [], issues: [], costItems: [],
        },
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(expect.objectContaining({
      error: 'version_conflict',
      productionDay: expect.objectContaining({ managementVersion: 3 }),
    }));
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE casting_production_days'))).toBe(false);
  });

  it('rejects malformed production-management payloads before writing', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/production-management`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 0, operations: { dayStatus: 'invented' } });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_payload');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE casting_production_days'))).toBe(false);
  });

  it('does not let an unrelated production editor mutate the management lane', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: false, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/production-management`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        operations: {
          dayStatus: 'ready', callSheetApproval: 'not_ready', crewConfirmations: [], checkpoints: [], issues: [], costItems: [],
        },
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('casting_production_days'))).toBe(false);
  });

  it('atomically saves coordination without exposing management decisions', async () => {
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.startsWith('SELECT * FROM casting_production_days')) {
        return {
          rows: [{
            id: 'day-1', project_id: PROJECT_ID, date: '2026-09-11', crew_ids: ['crew-1'],
            coordination_version: 0,
            management_version: 4,
            data: { productionManagement: { callSheetApproval: 'approved', costItems: [{ id: 'cost-1' }] } },
          }],
          rowCount: 1,
        };
      }
      if (text.includes('UPDATE casting_production_days')) {
        expect(text).toContain("'{productionCoordination}'");
        expect(text).not.toContain("'{productionManagement}'");
        expect(values?.slice(0, 3)).toEqual([PROJECT_ID, 'day-1', 0]);
        const operations = JSON.parse(String(values?.[3]));
        expect(operations.callSheetApproval).toBeUndefined();
        expect(operations.costItems).toBeUndefined();
        expect(operations.activity).toEqual([
          expect.objectContaining({ type: 'workspace_saved', actorUserId: 'first-ad-1' }),
        ]);
        return {
          rows: [{
            id: 'day-1', project_id: PROJECT_ID, date: '2026-09-11', crew_ids: ['crew-1'],
            coordination_version: 1, coordination_updated_by: 'first-ad-1', management_version: 4,
            data: {
              productionManagement: { callSheetApproval: 'approved', costItems: [{ id: 'cost-1' }] },
              productionCoordination: operations,
            },
          }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/production-coordination`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        operations: {
          tasks: [{ id: 'task-1', title: 'Bekreft minibuss', category: 'transport', status: 'in_progress', priority: 'high' }],
          crewFollowUps: [{ crewId: 'crew-1', status: 'contacted' }],
          logistics: [],
          documents: [],
          callSheetChecklist: [],
          escalations: [],
          handover: { status: 'draft', summary: 'Transport følges opp' },
          callSheetApproval: 'approved',
          costItems: [{ id: 'forged' }],
          activity: [{ id: 'forged', message: 'Falsk logg' }],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.productionDay).toEqual(expect.objectContaining({
      coordinationVersion: 1,
      coordinationUpdatedBy: 'first-ad-1',
      managementVersion: 4,
      productionManagement: expect.objectContaining({ callSheetApproval: 'approved' }),
    }));
    expect(response.body.productionDay.productionCoordination.activity[0].id).not.toBe('forged');
  });

  it('rejects coordination crew follow-up for people outside the selected day', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.startsWith('SELECT * FROM casting_production_days')) {
        return { rows: [{ id: 'day-1', project_id: PROJECT_ID, date: '2026-09-11', crew_ids: [], coordination_version: 0, data: {} }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/production-coordination`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        operations: {
          tasks: [], crewFollowUps: [{ crewId: 'outsider', status: 'confirmed' }], logistics: [], documents: [],
          callSheetChecklist: [], escalations: [], handover: { status: 'draft' },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_payload');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE casting_production_days'))).toBe(false);
  });

  it('hides the project and refuses writes without production permission', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: false, member_role: null, member_permissions: null }], rowCount: 1 };
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

  it('atomically saves validated continuity without accepting forged comments or audit history', async () => {
    const mediaFileId = 'c8bdfe62-84ab-4b2c-885e-bfba9bbd2d12';
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.startsWith('SELECT * FROM casting_production_days')) {
        return {
          rows: [{ id: 'day-1', project_id: PROJECT_ID, date: '2026-09-11', scene_ids: ['scene-1'], continuity_version: 0, data: {} }],
          rowCount: 1,
        };
      }
      if (text.includes('FROM casting_production_continuity_media')) {
        return {
          rows: [{ id: mediaFileId, display_name: 'lykt-original.jpg', content_type: 'image/jpeg', size_bytes: '2048', scene_id: 'scene-1' }],
          rowCount: 1,
        };
      }
      if (text.includes('UPDATE casting_production_days')) {
        expect(text).toContain("'{productionContinuity}'");
        expect(values?.slice(0, 3)).toEqual([PROJECT_ID, 'day-1', 0]);
        const operations = JSON.parse(String(values?.[3]));
        expect(operations.takes).toEqual([expect.objectContaining({ id: 'take-1', takeNumber: 1 })]);
        expect(operations.entries[0].references).toEqual([expect.objectContaining({
          storageFileId: mediaFileId,
          kind: 'photo',
          contentType: 'image/jpeg',
          sizeBytes: 2048,
          label: 'lykt-original.jpg',
        })]);
        expect(operations.comments).toEqual([]);
        expect(operations.revisions).toEqual([]);
        expect(operations.activity).toEqual([expect.objectContaining({ type: 'workspace_saved', actorUserId: 'first-ad-1' })]);
        return {
          rows: [{
            id: 'day-1', project_id: PROJECT_ID, date: '2026-09-11', scene_ids: ['scene-1'],
            continuity_version: 1, continuity_updated_by: 'first-ad-1', data: { productionContinuity: operations },
          }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/continuity`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        operations: {
          sceneRecords: [{ sceneId: 'scene-1', status: 'in_progress' }],
          takes: [{ id: 'take-1', sceneId: 'scene-1', takeNumber: 1, status: 'good', circled: true }],
          entries: [{
            id: 'entry-1', sceneId: 'scene-1', category: 'props', description: 'Lykten i venstre hånd', severity: 'warning',
            references: [{ id: mediaFileId, storageFileId: mediaFileId, kind: 'video', contentType: 'video/mp4', sizeBytes: 1, label: 'forged.mp4' }],
          }],
          deviations: [],
          comments: [{ id: 'forged', message: 'Falsk kommentar' }],
          revisions: [{ id: 'forged' }],
          activity: [{ id: 'forged', message: 'Falsk audit' }],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.productionDay).toEqual(expect.objectContaining({ continuityVersion: 1, continuityUpdatedBy: 'first-ad-1' }));
    expect(response.body.productionDay.productionContinuity.comments).toEqual([]);
  });

  it('allows a comment without granting access to rewrite the continuity log', async () => {
    const existing = {
      sceneRecords: [{ sceneId: 'scene-1', status: 'in_progress' }],
      takes: [{ id: 'take-1', sceneId: 'scene-1', takeNumber: 1, status: 'good', circled: true }],
      entries: [], deviations: [], comments: [], revisions: [], activity: [],
    };
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.startsWith('SELECT * FROM casting_production_days')) {
        return { rows: [{ id: 'day-1', project_id: PROJECT_ID, date: '2026-09-11', scene_ids: ['scene-1'], continuity_version: 1, data: { productionContinuity: existing } }], rowCount: 1 };
      }
      if (text.includes('UPDATE casting_production_days')) {
        const operations = JSON.parse(String(values?.[3]));
        expect(operations.takes).toEqual(existing.takes);
        expect(operations.comments).toEqual([expect.objectContaining({ message: 'Sjekk håndplassering', actorUserId: 'first-ad-1' })]);
        return { rows: [{ id: 'day-1', project_id: PROJECT_ID, date: '2026-09-11', scene_ids: ['scene-1'], continuity_version: 2, data: { productionContinuity: operations } }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .post(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/continuity/comments`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 1, comment: { sceneId: 'scene-1', takeId: 'take-1', message: 'Sjekk håndplassering' } });

    expect(response.status).toBe(201);
    expect(response.body.productionDay.continuityVersion).toBe(2);
  });

  it('returns the latest continuity version on an optimistic concurrency conflict', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.startsWith('SELECT * FROM casting_production_days')) {
        return {
          rows: [{
            id: 'day-1', project_id: PROJECT_ID, date: '2026-09-11', scene_ids: ['scene-1'],
            continuity_version: 2,
            data: { productionContinuity: { sceneRecords: [{ sceneId: 'scene-1', status: 'complete' }], takes: [], entries: [], deviations: [] } },
          }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/continuity`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 1,
        operations: { sceneRecords: [{ sceneId: 'scene-1', status: 'in_progress' }], takes: [], entries: [], deviations: [] },
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(expect.objectContaining({
      error: 'version_conflict',
      productionDay: expect.objectContaining({ continuityVersion: 2 }),
    }));
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE casting_production_days'))).toBe(false);
  });

  it('hides continuity from project members without continuity permission', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: false, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/continuity`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        operations: { sceneRecords: [{ sceneId: 'scene-1', status: 'in_progress' }], takes: [], entries: [], deviations: [] },
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('SELECT * FROM casting_production_days'))).toBe(false);
  });

  it('rejects continuity records for scenes outside the production day', async () => {
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.startsWith('SELECT * FROM casting_production_days')) {
        return {
          rows: [{ id: 'day-1', project_id: PROJECT_ID, date: '2026-09-11', scene_ids: ['scene-1'], continuity_version: 0, data: {} }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/continuity`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        operations: { sceneRecords: [{ sceneId: 'scene-2', status: 'in_progress' }], takes: [], entries: [], deviations: [] },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({ error: 'invalid_payload' }));
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE casting_production_days'))).toBe(false);
  });

  it('rejects a stored media id that is not bound to the same project and production day', async () => {
    const foreignFileId = 'ec78f0f0-c324-4aed-9e21-0ab6276e0bbb';
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.startsWith('SELECT * FROM casting_production_days')) {
        return {
          rows: [{ id: 'day-1', project_id: PROJECT_ID, date: '2026-09-11', scene_ids: ['scene-1'], continuity_version: 0, data: {} }],
          rowCount: 1,
        };
      }
      if (text.includes('FROM casting_production_continuity_media')) {
        expect(text).toContain("storage_provider = 'aws_s3'");
        expect(text).toContain('production_day_id = $3');
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(createApp(query))
      .patch(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/continuity`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        operations: {
          sceneRecords: [{ sceneId: 'scene-1', status: 'in_progress' }],
          takes: [],
          entries: [{
            id: 'entry-1', sceneId: 'scene-1', category: 'props', severity: 'info',
            description: 'Fremmed fil',
            references: [{ id: foreignFileId, storageFileId: foreignFileId, kind: 'photo', label: 'annet-prosjekt.jpg' }],
          }],
          deviations: [],
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({ error: 'invalid_payload' }));
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE casting_production_days'))).toBe(false);
  });

  it('uploads inspected continuity media only after continuity authorization', async () => {
    const fileId = '8b49da36-ff43-4d8f-98dc-20ce0e39218d';
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      if (text.startsWith('SELECT scene_ids FROM casting_production_days')) {
        return { rows: [{ scene_ids: ['scene-1'] }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const uploadContinuityMedia = vi.fn(async (_pool, input) => ({
      ok: true as const,
      media: {
        id: fileId,
        projectId: PROJECT_ID,
        productionDayId: 'day-1',
        sceneId: 'scene-1',
        uploadedBy: input.userId,
        displayName: input.displayName,
        sizeBytes: input.sizeBytes,
        contentType: input.contentType,
        kind: input.kind,
        checksumSha256: 'a'.repeat(64),
        createdAt: new Date().toISOString(),
      },
    }));

    const response = await request(createApp(query, { uploadContinuityMedia }))
      .post(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/continuity/media`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`)
      .field('sceneId', 'scene-1')
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(28).fill(0)]), {
        filename: 'lykt-referanse.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(201);
    expect(response.body.reference).toEqual(expect.objectContaining({
      storageFileId: fileId,
      storageProvider: 'aws_s3',
      kind: 'photo',
      contentType: 'image/jpeg',
    }));
    expect(uploadContinuityMedia).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'first-ad-1',
      projectId: PROJECT_ID,
      productionDayId: 'day-1',
      sceneId: 'scene-1',
      kind: 'photo',
    }));
  });

  it('rejects an unauthenticated media body before multer accepts the upload', async () => {
    const query = vi.fn();
    const uploadContinuityMedia = vi.fn();
    const response = await request(createApp(query, { uploadContinuityMedia }))
      .post(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/continuity/media`)
      .field('sceneId', 'scene-1')
      .attach('file', Buffer.from([0xff, 0xd8, 0xff]), {
        filename: 'uautorisert.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(401);
    expect(uploadContinuityMedia).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('returns a short-lived S3 URL only after current project access is confirmed', async () => {
    const fileId = '8b49da36-ff43-4d8f-98dc-20ce0e39218d';
    const query = vi.fn(async (text: string) => {
      if (text.includes('ALTER TABLE') || text.includes('CREATE TABLE') || text.includes('CREATE UNIQUE INDEX') || text.includes('CREATE INDEX')) return { rows: [], rowCount: 0 };
      if (text.includes('AS member_role')) {
        return { rows: [{ project_exists: true, is_owner: true, member_role: null, member_permissions: null }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const getContinuityMediaDownloadUrl = vi.fn(async () => ({
      ok: true as const,
      url: 'https://s3.eu-north-1.amazonaws.com/signed-reference',
      displayName: 'lykt.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 2048,
    }));

    const response = await request(createApp(query, { getContinuityMediaDownloadUrl }))
      .get(`/api/role-room/projects/${PROJECT_ID}/production-days/day-1/continuity/media/${fileId}/url`)
      .set('authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      url: 'https://s3.eu-north-1.amazonaws.com/signed-reference',
      expiresInSeconds: 300,
    }));
    expect(getContinuityMediaDownloadUrl).toHaveBeenCalledWith(expect.anything(), {
      fileId,
      projectId: PROJECT_ID,
      productionDayId: 'day-1',
      expiresInSeconds: 300,
    });
  });
});
