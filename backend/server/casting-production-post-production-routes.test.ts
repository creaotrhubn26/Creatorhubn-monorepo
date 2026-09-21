import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createCastingProductionRouter } from './casting-production-routes.js';

const SESSION_TOKEN = 'post-session';
const PROJECT_ID = 'troll';
const PATH = `/api/role-room/projects/${PROJECT_ID}/post-production`;
const MEDIA_ID = '11111111-1111-4111-8111-111111111111';
const STORAGE_ID = '22222222-2222-4222-8222-222222222222';

function appFor(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  app.use('/api/role-room', createCastingProductionRouter(
    { query } as unknown as Pool,
    {
      activeSessions: new Map([[SESSION_TOKEN, {
        userId: 'sound-1', email: 'sound@example.test', name: 'Sound',
        role: 'production_sound_mixer', loginAt: new Date().toISOString(),
      }]]),
    },
  ));
  return app;
}

function schemaResult(text: string) {
  return /ALTER TABLE|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX/.test(text)
    ? { rows: [], rowCount: 0 }
    : null;
}

function accessResult(role: string | null) {
  return {
    rows: [{
      project_exists: true,
      is_owner: false,
      member_role: role,
      member_permissions: null,
      member_additional_roles: null,
    }],
    rowCount: 1,
  };
}

const mediaRow = {
  id: MEDIA_ID,
  production_day_id: 'day-1',
  storage_object_id: STORAGE_ID,
  display_name: 'TROLL_012_003.wav',
  checksum_sha256: 'a'.repeat(64),
  size_bytes: 2048,
  reconciliation_status: 'matched',
  continuity_take_id: 'take-3',
  created_at: '2026-09-21T09:00:00.000Z',
};

describe('Post-production turnover API', () => {
  it('returns an empty version-zero ledger to a project member', async () => {
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('viewer');
      if (text.includes('FROM role_room_post_production_operations')) return { rows: [], rowCount: 0 };
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(appFor(query)).get(PATH).set('Authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.postProduction).toEqual(expect.objectContaining({
      projectId: PROJECT_ID,
      version: 0,
      operations: { turnovers: [] },
    }));
  });

  it('lets Production Sound create a manifest that references canonical media', async () => {
    let written: Record<string, any> | null = null;
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('production_sound_mixer');
      if (text.includes('FROM role_room_post_production_operations') && text.includes('SELECT operations')) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('FROM casting_production_days') && text.includes('sound_version')) {
        return { rows: [{ id: 'day-1', sound_version: 4 }], rowCount: 1 };
      }
      if (text.includes('FROM casting_production_sound_media')) {
        return { rows: [mediaRow], rowCount: 1 };
      }
      if (text.includes('INSERT INTO role_room_post_production_operations')) {
        written = JSON.parse(String(params?.[1]));
        return {
          rows: [{ operations: written, version: 1, updated_by: 'sound-1', updated_at: '2026-09-21T10:00:00.000Z' }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(appFor(query))
      .post(`${PATH}/commands`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        command: {
          type: 'create_turnover',
          label: 'Dag 1 · Production Sound',
          productionDayId: 'day-1',
          mediaIds: [MEDIA_ID],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.postProduction.version).toBe(1);
    expect(response.body.postProduction.operations.turnovers[0]).toEqual(expect.objectContaining({
      status: 'draft',
      createdBy: 'sound-1',
      source: expect.objectContaining({
        productionDayId: 'day-1',
        media: [expect.objectContaining({ mediaId: MEDIA_ID, storageObjectId: STORAGE_ID })],
      }),
    }));
    expect(JSON.stringify(written)).not.toContain('bucket_name');
    expect(JSON.stringify(written)).not.toContain('object_key');
  });

  it('hides command routes from members without a post grant', async () => {
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('viewer');
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(appFor(query))
      .post(`${PATH}/commands`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        command: {
          type: 'create_turnover',
          label: 'Dag 1',
          productionDayId: 'day-1',
          mediaIds: [MEDIA_ID],
        },
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('not_found');
  });

  it('returns the current ledger on optimistic version conflict', async () => {
    const current = {
      turnovers: [{
        id: 'turnover-1',
        label: 'Dag 1',
        status: 'draft',
        source: {
          productionDayId: 'day-1', soundVersion: 4, capturedAt: '2026-09-21T10:00:00.000Z',
          availableMediaIds: [MEDIA_ID],
          media: [{
            mediaId: MEDIA_ID, storageObjectId: STORAGE_ID, displayName: mediaRow.display_name,
            checksumSha256: mediaRow.checksum_sha256, sizeBytes: 2048,
            reconciliationStatus: 'matched', continuityTakeId: 'take-3', createdAt: mediaRow.created_at,
          }],
        },
        issues: [],
        events: [{ id: 'event-1', type: 'created', message: 'Opprettet.', actorUserId: 'sound-1', createdAt: '2026-09-21T10:00:00.000Z' }],
        createdBy: 'sound-1', createdAt: '2026-09-21T10:00:00.000Z',
        updatedBy: 'sound-1', updatedAt: '2026-09-21T10:00:00.000Z',
      }],
    };
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('production_sound_mixer');
      if (text.includes('FROM role_room_post_production_operations')) {
        return { rows: [{ operations: current, version: 3, updated_by: 'post-2', updated_at: '2026-09-21T11:00:00.000Z' }], rowCount: 1 };
      }
      if (text.includes('FROM casting_production_days') && text.includes('sound_version')) {
        return { rows: [{ id: 'day-1', sound_version: 4 }], rowCount: 1 };
      }
      if (text.includes('FROM casting_production_sound_media')) return { rows: [mediaRow], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(appFor(query))
      .post(`${PATH}/commands`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 2, command: { type: 'refresh_turnover', turnoverId: 'turnover-1' } });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(expect.objectContaining({
      error: 'version_conflict',
      conflict: expect.objectContaining({ lane: 'post_production', currentVersion: 3 }),
      postProduction: expect.objectContaining({ version: 3 }),
    }));
  });
});
