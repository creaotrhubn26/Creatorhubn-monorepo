import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createRoleRoomRouter } from './role-room-routes.js';

type Persona = {
  role: string;
  additionalRoles?: string[];
  permissions?: Record<string, boolean>;
};

function createApp(persona: Persona) {
  const query = vi.fn(async (text: string) => {
    if (text.includes('SELECT role, permissions, additional_roles')) {
      return {
        rows: [{
          role: persona.role,
          permissions: persona.permissions ?? {},
          additional_roles: persona.additionalRoles ?? [],
        }],
        rowCount: 1,
      };
    }
    if (text.includes('INSERT INTO casting_roles')) {
      return { rows: [], rowCount: 1 };
    }
    if (text.includes('INSERT INTO casting_crew')) {
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  const token = `session-${persona.role}`;
  const app = express();
  app.use(express.json());
  app.use('/api/role-room', createRoleRoomRouter(
    { query } as unknown as Pool,
    new Map([[token, {
      userId: `${persona.role}-user`,
      email: `${persona.role}@example.test`,
      name: persona.role,
      role: persona.role,
      loginAt: new Date().toISOString(),
    }]]),
  ));
  return { app, query, token };
}

async function createCastingRole(persona: Persona) {
  const { app, query, token } = createApp(persona);
  const response = await request(app)
    .post('/api/role-room/projects/project-1/casting-roles')
    .set('authorization', `Bearer ${token}`)
    .send({ name: 'NORA' });
  return { response, query };
}

describe('casting lane authorization', () => {
  it.each(['casting_director', 'local_casting_director', 'extras_casting_director'])(
    'allows %s to create casting data',
    async (role) => {
      const { response, query } = await createCastingRole({ role });

      expect(response.status).toBe(201);
      expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO casting_roles'))).toBe(true);
    },
  );

  it('unions an additional casting role with a read-only primary role', async () => {
    const { response } = await createCastingRole({
      role: 'viewer',
      additionalRoles: ['casting_director'],
    });

    expect(response.status).toBe(201);
  });

  it('honors an explicit casting permission', async () => {
    const { response } = await createCastingRole({
      role: 'viewer',
      permissions: { canEditCasting: true },
    });

    expect(response.status).toBe(201);
  });

  it('denies ordinary viewers before any casting insert', async () => {
    const { response, query } = await createCastingRole({ role: 'viewer' });

    expect(response.status).toBe(403);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO casting_roles'))).toBe(false);
  });

  it('does not let a casting director mutate the crew lane or administer project roles', async () => {
    const { app, query, token } = createApp({ role: 'casting_director' });
    const crewResponse = await request(app)
      .post('/api/role-room/projects/project-1/crew')
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'Crew member' });
    const roleResponse = await request(app)
      .post('/api/role-room/projects/project-1/roles')
      .set('authorization', `Bearer ${token}`)
      .send({ userId: 'target-1', role: 'producer' });

    expect(crewResponse.status).toBe(403);
    expect(roleResponse.status).toBe(403);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO casting_crew'))).toBe(false);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO casting_user_roles'))).toBe(false);
  });
});
