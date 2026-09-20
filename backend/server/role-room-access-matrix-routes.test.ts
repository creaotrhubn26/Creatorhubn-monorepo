// Matrisen skal være et speil av reglene, ikke en kopi: legger noen til et
// grant i CASTING_GRANT_RULES, skal det dukke opp her uten flere endringer.
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { CASTING_GRANTS, CASTING_GRANT_RULES } from './casting-project-ownership.js';
import { registerRoleRoomAccessMatrixRoutes } from './role-room-access-matrix-routes.js';

const PATH = '/api/role-room/admin/access-matrix';

function createApp(allow = true) {
  const app = express();
  registerRoleRoomAccessMatrixRoutes({
    app,
    requireAdminSession: (_req, res) => {
      if (allow) return true;
      res.status(403).json({ error: 'forbidden' });
      return false;
    },
  });
  return app;
}

describe('access matrix endpoint', () => {
  it('exposes every grant the resolver enforces', async () => {
    const response = await request(createApp()).get(PATH);

    expect(response.status).toBe(200);
    expect(response.body.grants.map((g: { grant: string }) => g.grant)).toEqual(CASTING_GRANTS);
  });

  it('marks a role exactly where the rules say it has the grant', async () => {
    const response = await request(createApp()).get(PATH);

    for (const row of response.body.matrix as Array<{ role: string; grants: Record<string, boolean> }>) {
      for (const grant of CASTING_GRANTS) {
        const expected = (CASTING_GRANT_RULES[grant].roles as readonly string[]).includes(row.role);
        expect(row.grants[grant]).toBe(expected);
      }
    }
  });

  it('lists producer with management but script supervisor without it', async () => {
    const response = await request(createApp()).get(PATH);
    const byRole = Object.fromEntries(
      (response.body.matrix as Array<{ role: string; grants: Record<string, boolean> }>)
        .map((r) => [r.role, r.grants]),
    );

    expect(byRole.producer.canManageProduction).toBe(true);
    expect(byRole.script_supervisor.canManageProduction).toBe(false);
    expect(byRole.script_supervisor.canManageContinuity).toBe(true);
    expect(byRole.production_designer.canManageArtDepartment).toBe(true);
    expect(byRole.producer.canManageArtDepartment).toBe(false);
  });

  it('carries the explicit permission keys so the UI need not hardcode them', async () => {
    const response = await request(createApp()).get(PATH);
    const keys = response.body.grants.flatMap((g: { permissionKeys: string[] }) => g.permissionKeys);

    expect(keys).toContain('canComment');
    expect(keys).toContain('canManageContinuity');
    expect(keys).toContain('canManageArtDepartment');
  });

  it('refuses without an admin session', async () => {
    const response = await request(createApp(false)).get(PATH);

    expect(response.status).toBe(403);
  });
});
