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

  it('keeps management and coordination state outside generic production-day writes', async () => {
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes('ALTER TABLE')) return { rows: [], rowCount: 0 };
      if (text.includes('AS can_edit_production')) {
        return { rows: [{ project_exists: true, can_edit_production: true }], rowCount: 1 };
      }
      if (text.includes('INSERT INTO casting_production_days')) {
        const savedData = JSON.parse(String(values?.[10] ?? '{}'));
        expect(savedData.productionManagement).toBeUndefined();
        expect(savedData.managementVersion).toBeUndefined();
        expect(savedData.productionCoordination).toBeUndefined();
        expect(savedData.coordinationVersion).toBeUndefined();
        expect(text).toContain("casting_production_days.data -> 'productionManagement'");
        expect(text).toContain("casting_production_days.data -> 'productionCoordination'");
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
      });

    expect(response.status).toBe(201);
  });

  it('atomically saves validated production-management operations and creates server audit data', async () => {
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes('ALTER TABLE')) return { rows: [], rowCount: 0 };
      if (text.includes('AS can_manage_production')) {
        return { rows: [{ project_exists: true, can_manage_production: true }], rowCount: 1 };
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
      if (text.includes('ALTER TABLE')) return { rows: [], rowCount: 0 };
      if (text.includes('AS can_manage_production')) {
        return { rows: [{ project_exists: true, can_manage_production: true }], rowCount: 1 };
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
      if (text.includes('ALTER TABLE')) return { rows: [], rowCount: 0 };
      if (text.includes('AS can_manage_production')) {
        return { rows: [{ project_exists: true, can_manage_production: true }], rowCount: 1 };
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
      if (text.includes('ALTER TABLE')) return { rows: [], rowCount: 0 };
      if (text.includes('AS can_manage_production')) {
        return { rows: [{ project_exists: true, can_manage_production: false }], rowCount: 1 };
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
      if (text.includes('ALTER TABLE')) return { rows: [], rowCount: 0 };
      if (text.includes('AS can_coordinate_production')) {
        return { rows: [{ project_exists: true, can_coordinate_production: true }], rowCount: 1 };
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
      if (text.includes('ALTER TABLE')) return { rows: [], rowCount: 0 };
      if (text.includes('AS can_coordinate_production')) {
        return { rows: [{ project_exists: true, can_coordinate_production: true }], rowCount: 1 };
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
