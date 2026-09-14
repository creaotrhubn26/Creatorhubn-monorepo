import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { createRoleRoomNarrativeRouter } from './role-room-narrative-routes.js';

const SESSION_TOKEN = 'sess-narrative-test';
const PROJECT_ID = 'proj-game-2026';

type Handler = { match: RegExp; rows: unknown[] | ((params: unknown[]) => unknown[]) };

function makePool(handlers: Handler[] = []) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    for (const h of handlers) {
      if (h.match.test(sql)) {
        const rows = typeof h.rows === 'function' ? h.rows(params) : h.rows;
        return { rows, rowCount: rows.length };
      }
    }
    return { rows: [], rowCount: 0 };
  });
  return { query } as unknown as Pool & { query: typeof query };
}

function createApp(pool: Pool, opts: { access?: boolean } = {}) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/role-room/narrative',
    createRoleRoomNarrativeRouter(pool, {
      activeSessions: new Map([[SESSION_TOKEN, { userId: 'u1', email: 'u1@example.com', name: 'U1', role: 'user', loginAt: '' }]]),
      canAccessProject: async () => opts.access ?? true,
    }),
  );
  return app;
}

const elementRow = (over: Record<string, unknown> = {}) => ({
  id: 'nel_1', project_id: PROJECT_ID, board_id: 'nbd_1', kind: 'element',
  title_html: '<p>Start</p>', content_html: '', x: 10, y: 20, width: 260, height: 120,
  theme: 'default', cover_asset_id: null, custom_id: null, jumper_target_id: null,
  branch_conditions: [], version: 1, sort_order: 0,
  created_at: new Date('2026-09-14T10:00:00Z'), updated_at: new Date('2026-09-14T10:00:00Z'),
  ...over,
});

describe('narrative routes — auth og prosjekt-tilgang', () => {
  it('uten token → 401', async () => {
    const app = createApp(makePool());
    const res = await request(app).get(`/api/role-room/narrative/projects/${PROJECT_ID}/graph`);
    expect(res.status).toBe(401);
  });

  it('med token men uten prosjekt-tilgang → 403 (fail closed)', async () => {
    const pool = makePool();
    const app = createApp(pool, { access: false });
    const res = await request(app)
      .get(`/api/role-room/narrative/projects/${PROJECT_ID}/graph`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(res.status).toBe(403);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('GET graph → tom graf med default-innstillinger', async () => {
    const app = createApp(makePool());
    const res = await request(app)
      .get(`/api/role-room/narrative/projects/${PROJECT_ID}/graph`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.settings).toMatchObject({ projectId: PROJECT_ID, startingElementId: null, schemaVersion: 1 });
    expect(res.body.data.boards).toEqual([]);
    expect(res.body.data.elements).toEqual([]);
  });
});

describe('narrative routes — elementer', () => {
  it('POST elements med ugyldig kind → 400', async () => {
    const app = createApp(makePool());
    const res = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/elements`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ boardId: 'nbd_1', kind: 'dialogue' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('POST elements → 201 med camelCase-mapping og prosjekt-id i INSERT', async () => {
    const pool = makePool([{ match: /INSERT INTO narrative_elements/, rows: (p) => [elementRow({ id: p[0], board_id: p[2], kind: p[3], title_html: p[4] })] }]);
    const app = createApp(pool);
    const res = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/elements`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ boardId: 'nbd_1', kind: 'branch', titleHtml: '<p>Valg</p>', branchConditions: [{ script: 'gold >= 10' }, {}] });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ boardId: 'nbd_1', kind: 'branch', titleHtml: '<p>Valg</p>', version: 1 });
    expect(res.body.data.id).toMatch(/^nel_/);
    const insertCall = pool.query.mock.calls.find(([sql]) => /INSERT INTO narrative_elements/.test(String(sql)));
    expect(insertCall?.[1]?.[1]).toBe(PROJECT_ID);
    // Branch-betingelser normaliseres: id genereres, tomt script = else-gren.
    const conditions = JSON.parse(String(insertCall?.[1]?.[14])) as Array<{ id: string; script: string | null }>;
    expect(conditions).toHaveLength(2);
    expect(conditions[0].script).toBe('gold >= 10');
    expect(conditions[1].script).toBeNull();
    expect(conditions[0].id).toMatch(/^cond_/);
  });

  it('PATCH elements med If-Match som ikke matcher → 409 med gjeldende rad', async () => {
    const pool = makePool([
      { match: /UPDATE narrative_elements SET/, rows: [] },
      { match: /SELECT \* FROM narrative_elements WHERE id = \$1 AND project_id = \$2/, rows: [elementRow({ version: 3, title_html: '<p>Endret av andre</p>' })] },
    ]);
    const app = createApp(pool);
    const res = await request(app)
      .patch(`/api/role-room/narrative/projects/${PROJECT_ID}/elements/nel_1`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .set('If-Match', '1')
      .send({ titleHtml: '<p>Min endring</p>' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('conflict');
    expect(res.body.data.version).toBe(3);
    const updateCall = pool.query.mock.calls.find(([sql]) => /UPDATE narrative_elements SET/.test(String(sql)));
    expect(updateCall?.[1]?.[2]).toBe(1); // expectedVersion sendt som $3
  });

  it('PATCH elements uten If-Match → 200 (siste vinner)', async () => {
    const pool = makePool([{ match: /UPDATE narrative_elements SET/, rows: [elementRow({ version: 2, title_html: '<p>Ny</p>' })] }]);
    const app = createApp(pool);
    const res = await request(app)
      .patch(`/api/role-room/narrative/projects/${PROJECT_ID}/elements/nel_1`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ titleHtml: '<p>Ny</p>' });
    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(2);
    const updateCall = pool.query.mock.calls.find(([sql]) => /UPDATE narrative_elements SET/.test(String(sql)));
    expect(updateCall?.[1]?.[2]).toBeNull();
  });

  it('PATCH ukjent element → 404', async () => {
    const app = createApp(makePool());
    const res = await request(app)
      .patch(`/api/role-room/narrative/projects/${PROJECT_ID}/elements/nel_missing`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ x: 1 });
    expect(res.status).toBe(404);
  });

  it('POST elements/moves → batch-oppdaterer posisjoner', async () => {
    const pool = makePool([{ match: /UPDATE narrative_elements SET x = \$3/, rows: (p) => [elementRow({ id: p[0], x: p[2], y: p[3] })] }]);
    const app = createApp(pool);
    const res = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/elements/moves`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ moves: [{ id: 'nel_1', x: 100, y: 200 }, { id: 'nel_2', x: 300, y: 400 }] });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[1]).toMatchObject({ id: 'nel_2', x: 300, y: 400 });
  });
});

describe('narrative routes — koblinger og variabler', () => {
  it('POST connections der målet ikke finnes i prosjektet → 400', async () => {
    const pool = makePool([{ match: /SELECT id FROM narrative_elements WHERE project_id = \$1 AND id = ANY/, rows: [{ id: 'nel_1' }] }]);
    const app = createApp(pool);
    const res = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/connections`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ boardId: 'nbd_1', sourceId: 'nel_1', targetId: 'nel_other_project' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unknown_endpoint');
  });

  it('POST connections → 201', async () => {
    const pool = makePool([
      { match: /SELECT id FROM narrative_elements WHERE project_id = \$1 AND id = ANY/, rows: [{ id: 'nel_1' }, { id: 'nel_2' }] },
      { match: /INSERT INTO narrative_connections/, rows: (p) => [{
        id: p[0], project_id: p[1], board_id: p[2], source_id: p[3], target_id: p[4], source_output_key: p[5],
        label_html: p[6], sort_order: p[7], created_at: new Date(), updated_at: new Date(),
      }] },
    ]);
    const app = createApp(pool);
    const res = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/connections`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ boardId: 'nbd_1', sourceId: 'nel_1', targetId: 'nel_2', labelHtml: '<p>Gå inn</p>' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ sourceId: 'nel_1', targetId: 'nel_2', sourceOutputKey: 'default', labelHtml: '<p>Gå inn</p>' });
  });

  it('POST variables med ugyldig navn → 400', async () => {
    const app = createApp(makePool());
    const res = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/variables`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ name: '1gold', type: 'int' });
    expect(res.status).toBe(400);
  });

  it('POST variables som allerede finnes → 409 duplicate_name', async () => {
    const app = createApp(makePool([{ match: /INSERT INTO narrative_variables/, rows: [] }]));
    const res = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/variables`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ name: 'gold', type: 'int' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('duplicate_name');
  });

  it('POST variables → 201 med typet default', async () => {
    const pool = makePool([{ match: /INSERT INTO narrative_variables/, rows: (p) => [{
      id: p[0], project_id: p[1], name: p[2], type: p[3], default_value: JSON.parse(String(p[4])), sort_order: 0,
      created_at: new Date(), updated_at: new Date(),
    }] }]);
    const app = createApp(pool);
    const res = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/variables`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ name: 'gold', type: 'int' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'gold', type: 'int', defaultValue: 0 });
  });
});
