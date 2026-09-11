import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createRoleRoomRouter } from './role-room-routes.js';

function createApp(role: 'first_ad' | 'producer') {
  const query = vi.fn(async (text: string) => {
    if (text.includes('SELECT role, permissions')) {
      return {
        rows: [{
          role,
          permissions: role === 'first_ad'
            ? { canEditProduction: true, canManageCrew: false }
            : { canEditProduction: true, canManageCrew: true },
        }],
        rowCount: 1,
      };
    }
    if (text.includes('INSERT INTO casting_user_roles')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  const token = `session-${role}`;
  const app = express();
  app.use(express.json());
  app.use('/api/role-room', createRoleRoomRouter(
    { query } as unknown as Pool,
    new Map([[token, {
      userId: `${role}-user`,
      email: `${role}@example.test`,
      name: role,
      role,
      loginAt: new Date().toISOString(),
    }]]),
  ));
  return { app, query, token };
}

describe('1st AD project-role boundary', () => {
  it('cannot promote users even though production editing is allowed', async () => {
    const { app, query, token } = createApp('first_ad');

    const response = await request(app)
      .post('/api/role-room/projects/project-1/roles')
      .set('authorization', `Bearer ${token}`)
      .send({ userId: 'target-user', role: 'director' });

    expect(response.status).toBe(403);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO casting_user_roles'))).toBe(false);
  });

  it('keeps role administration available to the producer', async () => {
    const { app, query, token } = createApp('producer');

    const response = await request(app)
      .post('/api/role-room/projects/project-1/roles')
      .set('authorization', `Bearer ${token}`)
      .send({ userId: 'target-user', role: 'first_ad' });

    expect(response.status).toBe(201);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO casting_user_roles'))).toBe(true);
  });
});
