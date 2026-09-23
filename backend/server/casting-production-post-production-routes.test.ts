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
const WORKSPACE_PROJECT_ID = '6cae5551-4d32-4b22-8c26-79fa61f8c7b1';
const PICTURE_VERSION_ID = 'b70ea5f0-06a4-4a1b-b357-83d7872bdf9f';
const PICTURE_STORAGE_ID = 'f48ba060-ebf0-4509-b77a-e889716495ab';
const STORYBOARD_ROUND_ID = '0f4813b2-ed6c-47c4-a982-7d8e9093c0a1';

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

const pictureRow = {
  id: PICTURE_VERSION_ID,
  project_id: WORKSPACE_PROJECT_ID,
  version_label: 'Director cut',
  version_number: 2,
  version_status: 'under_review',
  storage_object_id: PICTURE_STORAGE_ID,
  duration: 92,
  created_at: '2026-09-21T09:30:00.000Z',
  display_name: 'troll-v2.mp4',
  size_bytes: 4096,
  content_type: 'video/mp4',
  checksum_sha256: 'b'.repeat(64),
  latest_version_number: 2,
};

const storyboardRow = {
  id: STORYBOARD_ROUND_ID,
  project_id: PROJECT_ID,
  manuscript_id: 'troll-manus',
  manuscript_title: 'Troll',
  version: 3,
  label: 'Regigodkjent',
  summary: 'Låst visuelt grunnlag.',
  snapshot_hash: 'c'.repeat(64),
  script_fingerprint: 'd'.repeat(64),
  status: 'approved',
  frame_count: 1,
  total_duration_seconds: 4,
  latest_approved_version: 3,
  submitted_at: '2026-09-21T08:00:00.000Z',
  approved_at: '2026-09-21T09:00:00.000Z',
  snapshot: {
    schemaVersion: 'storyboard-review-snapshot-v1',
    manuscript: { id: 'troll-manus', title: 'Troll' },
    scenes: [{
      id: 'scene-1', heading: 'EXT. FJELL – NATT', sceneNumber: 1,
      storyboardFrames: [{
        id: 'frame-1', shotNumber: '1A', description: 'Trollet reiser seg.', duration: 4,
        thumbnailUrl: 'https://images.example.test/frame-1.jpg',
      }],
    }],
    dialogue: [],
  },
};

function storyboardTabAccessResult(text: string) {
  if (text.includes('SELECT 1 FROM casting_projects')) return { rows: [], rowCount: 0 };
  if (text.includes('FROM role_room_project_tab_overrides')) return { rows: [], rowCount: 0 };
  if (text.includes('SELECT role FROM casting_user_roles')) {
    return { rows: [{ role: 'post_supervisor' }], rowCount: 1 };
  }
  return null;
}

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

  it('lists eligible picture versions without exposing storage internals', async () => {
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('post_supervisor');
      if (text.includes('FROM casting_projects casting')) {
        return { rows: [{ creatorhub_project_id: WORKSPACE_PROJECT_ID, workspace_project_id: WORKSPACE_PROJECT_ID }], rowCount: 1 };
      }
      if (text.includes('WITH eligible AS')) return { rows: [pictureRow], rowCount: 1 };
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(appFor(query))
      .get(`${PATH}/picture-sources`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.pictureSources).toEqual(expect.objectContaining({
      binding: { status: 'linked', workspaceProjectId: WORKSPACE_PROJECT_ID },
      versions: [expect.objectContaining({ id: PICTURE_VERSION_ID, displayName: 'troll-v2.mp4', isLatest: true })],
    }));
    expect(JSON.stringify(response.body)).not.toContain(PICTURE_STORAGE_ID);
    expect(JSON.stringify(response.body)).not.toContain(pictureRow.checksum_sha256);
    expect(JSON.stringify(response.body)).not.toContain('object_key');
  });

  it('lists locked storyboard revisions for post without exposing the full snapshot', async () => {
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('post_supervisor');
      const tabAccess = storyboardTabAccessResult(text);
      if (tabAccess) return tabAccess;
      if (text.includes('FROM storyboard_review_rounds review_round') && text.includes('ORDER BY manuscript.title')) {
        return { rows: [storyboardRow], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(appFor(query))
      .get(`${PATH}/storyboard-sources`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.storyboardSources.rounds).toEqual([
      expect.objectContaining({ id: STORYBOARD_ROUND_ID, status: 'approved', frameCount: 1 }),
    ]);
    expect(JSON.stringify(response.body)).not.toContain('storyboardFrames');
    expect(JSON.stringify(response.body)).not.toContain('thumbnailUrl');
  });

  it('returns a selected storyboard revision as a read-only post preview', async () => {
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('post_supervisor');
      const tabAccess = storyboardTabAccessResult(text);
      if (tabAccess) return tabAccess;
      if (text.includes('FROM storyboard_review_rounds review_round') && text.includes('review_round.id = $2::uuid')) {
        return { rows: [storyboardRow], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(appFor(query))
      .get(`${PATH}/storyboard-sources/${STORYBOARD_ROUND_ID}`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.storyboardSource).toEqual(expect.objectContaining({
      id: STORYBOARD_ROUND_ID,
      scenes: [expect.objectContaining({
        id: 'scene-1',
        frames: [expect.objectContaining({ id: 'frame-1', shotNumber: '1A' })],
      })],
    }));
  });

  it('fails closed when the linked CreatorHub project is not owned by the Role Room owner', async () => {
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('post_supervisor');
      if (text.includes('FROM casting_projects casting')) {
        return { rows: [{ creatorhub_project_id: WORKSPACE_PROJECT_ID, workspace_project_id: null }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(appFor(query))
      .get(`${PATH}/picture-sources`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body.pictureSources).toEqual({ binding: { status: 'unavailable' }, versions: [] });
    expect(query.mock.calls.some(([text]) => String(text).includes('WITH eligible AS'))).toBe(false);
  });

  it('builds a picture manifest from the owner-bound Video Room version', async () => {
    let written: Record<string, any> | null = null;
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('post_supervisor');
      if (text.includes('FROM role_room_post_production_operations') && text.includes('SELECT operations')) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('FROM casting_projects casting')) {
        return { rows: [{ creatorhub_project_id: WORKSPACE_PROJECT_ID, workspace_project_id: WORKSPACE_PROJECT_ID }], rowCount: 1 };
      }
      if (text.includes('WITH eligible AS')) return { rows: [pictureRow], rowCount: 1 };
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
          type: 'create_picture_turnover',
          label: 'Picture V2 · Editorial',
          recipient: 'Editorial',
          pictureVersionId: PICTURE_VERSION_ID,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.postProduction.operations.turnovers[0].source).toEqual(expect.objectContaining({
      sourceType: 'picture',
      workspaceProjectId: WORKSPACE_PROJECT_ID,
      versionId: PICTURE_VERSION_ID,
      storageObjectId: PICTURE_STORAGE_ID,
      checksumSha256: pictureRow.checksum_sha256,
    }));
    expect(JSON.stringify(written)).not.toContain('object_key');
  });

  it('binds only selected panels from an approved storyboard revision', async () => {
    let written: Record<string, any> | null = null;
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('post_supervisor');
      const tabAccess = storyboardTabAccessResult(text);
      if (tabAccess) return tabAccess;
      if (text.includes('FROM role_room_post_production_operations') && text.includes('SELECT operations')) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('FROM casting_projects casting')) {
        return { rows: [{ creatorhub_project_id: WORKSPACE_PROJECT_ID, workspace_project_id: WORKSPACE_PROJECT_ID }], rowCount: 1 };
      }
      if (text.includes('WITH eligible AS')) return { rows: [pictureRow], rowCount: 1 };
      if (text.includes('FROM storyboard_review_rounds review_round')) {
        return { rows: [storyboardRow], rowCount: 1 };
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
          type: 'create_picture_turnover',
          label: 'Picture V2 · Editorial',
          pictureVersionId: PICTURE_VERSION_ID,
          storyboardReviewRoundId: STORYBOARD_ROUND_ID,
          storyboardFrameIds: ['frame-1'],
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.postProduction.operations.turnovers[0].storyboardReference).toEqual(expect.objectContaining({
      reviewRoundId: STORYBOARD_ROUND_ID,
      snapshotHash: storyboardRow.snapshot_hash,
      frames: [expect.objectContaining({ frameId: 'frame-1', sceneId: 'scene-1' })],
    }));
    expect(JSON.stringify(written)).not.toContain('thumbnailUrl');
  });

  it('refuses to bind a storyboard revision that is not approved', async () => {
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('post_supervisor');
      const tabAccess = storyboardTabAccessResult(text);
      if (tabAccess) return tabAccess;
      if (text.includes('FROM role_room_post_production_operations') && text.includes('SELECT operations')) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('FROM casting_projects casting')) {
        return { rows: [{ creatorhub_project_id: WORKSPACE_PROJECT_ID, workspace_project_id: WORKSPACE_PROJECT_ID }], rowCount: 1 };
      }
      if (text.includes('WITH eligible AS')) return { rows: [pictureRow], rowCount: 1 };
      if (text.includes('FROM storyboard_review_rounds review_round')) {
        return { rows: [{ ...storyboardRow, status: 'changes_requested' }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(appFor(query))
      .post(`${PATH}/commands`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({
        expectedVersion: 0,
        command: {
          type: 'create_picture_turnover',
          label: 'Ikke godkjent',
          pictureVersionId: PICTURE_VERSION_ID,
          storyboardReviewRoundId: STORYBOARD_ROUND_ID,
          storyboardFrameIds: ['frame-1'],
        },
      });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('storyboard_source_not_approved');
    expect(query.mock.calls.some(([text]) => String(text).includes('INSERT INTO role_room_post_production_operations'))).toBe(false);
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
