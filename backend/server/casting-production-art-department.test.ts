import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createCastingProductionRouter } from './casting-production-routes.js';

const SESSION_TOKEN = 'art-session';
const PROJECT_ID = 'troll';
const PATH = `/api/role-room/projects/${PROJECT_ID}/art-department`;

const operations = () => ({
  phase: 'design',
  visualDirection: 'Monumental natur mot menneskelig sårbarhet.',
  palette: ['skifer', 'tåke'],
  scenePlans: [{
    sceneId: 'scene-12', status: 'designing', setStrategy: 'hybrid', departments: ['art', 'props'],
  }],
  decisions: [{
    id: 'decision-1', title: 'Bygg portal i studio', status: 'draft', impact: 'budget', sceneIds: ['scene-12'],
  }],
  handoffs: [{
    id: 'handoff-props', department: 'props', title: 'Rekvisitt', status: 'in_progress',
  }],
});

function appFor(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  app.use('/api/role-room', createCastingProductionRouter(
    { query } as unknown as Pool,
    {
      activeSessions: new Map([[SESSION_TOKEN, {
        userId: 'designer-1', email: 'designer@example.test', name: 'Designer',
        role: 'production_designer', loginAt: new Date().toISOString(),
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

function accessResult(role: string | null, isOwner = false) {
  return {
    rows: [{
      project_exists: true, is_owner: isOwner, member_role: role,
      member_permissions: null, member_additional_roles: null,
    }],
    rowCount: 1,
  };
}

describe('Production Design / Art Department API', () => {
  it('returns a version-zero project lane to an authorized reader', async () => {
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('viewer');
      if (text.includes('FROM role_room_art_department_operations')) return { rows: [], rowCount: 0 };
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(appFor(query)).get(PATH).set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(response.status).toBe(200);
    expect(response.body.artDepartment).toEqual(expect.objectContaining({
      projectId: PROJECT_ID, version: 0,
      operations: expect.objectContaining({ phase: 'concept', activity: [] }),
    }));
  });

  it('lets the production designer save and creates the audit event on the server', async () => {
    let written: Record<string, unknown> | null = null;
    const query = vi.fn(async (text: string, params?: unknown[]) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('production_designer');
      if (text.includes('SELECT operations, version') && text.includes('FROM role_room_art_department_operations')) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('INSERT INTO role_room_art_department_operations')) {
        written = JSON.parse(String(params?.[1]));
        return {
          rows: [{ operations: written, version: 1, updated_by: 'designer-1', updated_at: '2026-09-20T10:00:00Z' }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const forged = { ...operations(), activity: [{ id: 'forged', actorUserId: 'owner', message: 'Godkjent', type: 'workspace_saved', createdAt: '2020-01-01T00:00:00Z' }] };

    const response = await request(appFor(query)).patch(PATH)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 0, operations: forged });

    expect(response.status).toBe(200);
    expect(response.body.artDepartment.version).toBe(1);
    expect(response.body.artDepartment.operations.activity).toEqual([
      expect.objectContaining({ actorUserId: 'designer-1', type: 'workspace_saved' }),
    ]);
    expect(response.body.artDepartment.operations.activity[0].id).not.toBe('forged');
  });

  it('keeps the latest state visible on an optimistic concurrency conflict', async () => {
    const latest = { ...operations(), phase: 'build' };
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('production_designer');
      if (text.includes('FROM role_room_art_department_operations')) {
        return { rows: [{ operations: latest, version: 3, updated_by: 'designer-2', updated_at: '2026-09-20T11:00:00Z' }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    });

    const response = await request(appFor(query)).patch(PATH)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 2, operations: operations() });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(expect.objectContaining({
      error: 'version_conflict',
      conflict: expect.objectContaining({ lane: 'art_department', currentVersion: 3, updatedBy: 'designer-2' }),
      artDepartment: expect.objectContaining({ version: 3 }),
    }));
  });

  it('rejects invalid state before any write', async () => {
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('production_designer');
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const response = await request(appFor(query)).patch(PATH)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ expectedVersion: 0, operations: { ...operations(), phase: 'approved-by-ai' } });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_payload');
  });

  it('allows project members to read but hides writes without the department grant', async () => {
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult('viewer');
      if (text.includes('FROM role_room_art_department_operations')) return { rows: [], rowCount: 0 };
      throw new Error(`Unexpected SQL: ${text}`);
    });
    const app = appFor(query);
    const read = await request(app).get(PATH).set('Authorization', `Bearer ${SESSION_TOKEN}`);
    const write = await request(app).patch(PATH).set('Authorization', `Bearer ${SESSION_TOKEN}`).send({ expectedVersion: 0, operations: operations() });
    expect(read.status).toBe(200);
    expect(write.status).toBe(404);
  });

  it('does not reveal another tenant project', async () => {
    const query = vi.fn(async (text: string) => {
      const schema = schemaResult(text);
      if (schema) return schema;
      if (text.includes('AS member_role')) return accessResult(null);
      return { rows: [], rowCount: 0 };
    });
    const response = await request(appFor(query)).get(PATH).set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(response.status).toBe(404);
  });
});
