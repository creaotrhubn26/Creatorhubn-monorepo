import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { registerRoleRoomEditorCommentsRoutes } from './role-room-editor-comments-routes.js';

function createApp(queryImpl?: (sql: string, params: unknown[]) => Promise<{ rows: any[] }>) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (queryImpl) {
      const custom = await queryImpl(sql, params);
      if (custom) return custom;
    }
    if (sql.includes('AS can_comment')) {
      return { rows: [{ can_comment: true }] };
    }
    if (sql.includes('EXISTS(SELECT 1 FROM casting_projects')) {
      return { rows: [{ owns: true, member: false }] };
    }
    if (sql.includes('SELECT EXISTS(') && sql.includes('casting_manuscripts')) {
      return { rows: [{ found: true }] };
    }
    if (sql.includes('INSERT INTO role_room_editor_comments')) {
      return { rows: [{ id: 'comment-1', created_at: '2026-09-10T00:00:00.000Z' }] };
    }
    return { rows: [] };
  });
  const app = express();
  app.use(express.json());
  registerRoleRoomEditorCommentsRoutes(app, {
    pool: { query } as any,
    activeSessions: new Map([['team-token', { userId: 'user-1', email: 'writer@example.test' }]]),
  });
  return { app, query };
}

describe('Role Room screenplay comments contract', () => {
  it('creates a screenplay annotation only after manuscript/project validation', async () => {
    const { app, query } = createApp();
    const response = await request(app)
      .post('/api/role-room/editor-comments')
      .set('Authorization', 'Bearer team-token')
      .send({
        projectId: 'project-1',
        anchorType: 'screenplay_line',
        anchorRef: 'manuscript-1#r1:scene:4:5:SGVsbG8',
        commentText: 'Kan denne replikken strammes inn?',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, id: 'comment-1' });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('casting_manuscripts'))).toBe(true);
    const insert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO role_room_editor_comments'));
    expect(insert?.[1]).toEqual(expect.arrayContaining([
      'project-1', 'screenplay_line', 'manuscript-1#r1:scene:4:5:SGVsbG8',
    ]));
  });

  it('rejects an annotation whose manuscript is not in the project', async () => {
    const { app, query } = createApp(async (sql) => {
      if (sql.includes('SELECT EXISTS(') && sql.includes('casting_manuscripts')) {
        return { rows: [{ found: false }] };
      }
      return undefined as any;
    });
    const response = await request(app)
      .post('/api/role-room/editor-comments')
      .set('Authorization', 'Bearer team-token')
      .send({
        projectId: 'project-1',
        anchorType: 'screenplay_line',
        anchorRef: 'private-manuscript#L:2',
        commentText: 'Skal ikke lagres',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('manus_anker_ikke_i_prosjekt');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO role_room_editor_comments'))).toBe(false);
  });

  it('requires a screenplay comment role or explicit permission', async () => {
    const { app, query } = createApp(async (sql) => {
      if (sql.includes('AS can_comment')) {
        return { rows: [{ can_comment: false }] };
      }
      return undefined as any;
    });
    const response = await request(app)
      .post('/api/role-room/editor-comments')
      .set('Authorization', 'Bearer team-token')
      .send({
        projectId: 'project-1',
        anchorType: 'screenplay_line',
        anchorRef: 'manuscript-1#L:2',
        commentText: 'Ingen kommentartilgang',
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('mangler_kommentarrettighet');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO role_room_editor_comments'))).toBe(false);
  });

  it('inherits the trusted parent anchor when replying', async () => {
    const { app, query } = createApp(async (sql) => {
      if (sql.includes('SELECT project_id, parent_id, anchor_type, anchor_ref')) {
        return {
          rows: [{
            project_id: 'project-1', parent_id: null,
            anchor_type: 'screenplay_line', anchor_ref: 'manuscript-1#L:7',
          }],
        };
      }
      return undefined as any;
    });
    const response = await request(app)
      .post('/api/role-room/editor-comments')
      .set('Authorization', 'Bearer team-token')
      .send({
        projectId: 'project-1',
        anchorType: 'manuscript',
        anchorRef: 'spoofed-manuscript',
        parentId: 'parent-1',
        commentText: 'Enig.',
      });

    expect(response.status).toBe(200);
    const insert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO role_room_editor_comments'));
    expect(insert?.[1]?.[1]).toBe('screenplay_line');
    expect(insert?.[1]?.[2]).toBe('manuscript-1#L:7');
    expect(insert?.[1]?.[6]).toBe('parent-1');
  });

  it('clears resolution audit fields when a thread is reopened', async () => {
    const { app, query } = createApp(async (sql) => {
      if (sql.includes('SELECT project_id, author_id, anchor_type FROM role_room_editor_comments')) {
        return { rows: [{ project_id: 'project-1', author_id: 'user-2', anchor_type: 'screenplay_line' }] };
      }
      return undefined as any;
    });
    const response = await request(app)
      .patch('/api/role-room/editor-comments/comment-1')
      .set('Authorization', 'Bearer team-token')
      .send({ status: 'open' });

    expect(response.status).toBe(200);
    const update = query.mock.calls.find(([sql]) => String(sql).includes('UPDATE role_room_editor_comments SET'));
    expect(String(update?.[0])).toContain('resolved_by = NULL');
    expect(String(update?.[0])).toContain('resolved_at = NULL');
  });
});
