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
  app.use(express.json({ limit: '10mb' })); // prod: 50mb i index.ts — zod-grensen (5 MB) skal gi 400, ikke 413
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

describe('narrative routes — validering', () => {
  it('GET validate → struktur- og skriptmerknader fra den delte validatoren', async () => {
    const pool = makePool([
      { match: /FROM narrative_settings WHERE project_id/, rows: [{ project_id: PROJECT_ID, title: null, starting_element_id: 'nel_1', cover_asset_id: null, schema_version: 1, updated_at: null }] },
      { match: /FROM narrative_boards WHERE project_id/, rows: [{ id: 'nbd_1', project_id: PROJECT_ID, name: 'Akt 1', custom_id: null, folder_path: '', sort_order: 0, viewport: {}, created_at: new Date(), updated_at: new Date() }] },
      { match: /FROM narrative_elements WHERE project_id/, rows: [
        elementRow({ id: 'nel_1', content_html: '<p>Hei</p><pre><code>gold += 1</code></pre>' }),
        elementRow({ id: 'nel_2', content_html: '<pre><code>if gold ></code></pre>' }),
        elementRow({ id: 'nel_3', content_html: '<pre><code>mana = 3</code></pre>' }),
      ] },
      { match: /FROM narrative_variables WHERE project_id/, rows: [{ id: 'nvr_1', project_id: PROJECT_ID, name: 'gold', type: 'int', default_value: 0, sort_order: 0, created_at: new Date(), updated_at: new Date() }] },
    ]);
    const app = createApp(pool);
    const res = await request(app)
      .get(`/api/role-room/narrative/projects/${PROJECT_ID}/validate`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(res.status).toBe(200);
    const messages = (res.body.data.issues as Array<{ elementId: string | null; level: string; message: string }>);
    expect(messages.some((i) => i.elementId === 'nel_2' && i.level === 'error' && /skriptfeil/.test(i.message))).toBe(true);
    expect(messages.some((i) => i.elementId === 'nel_3' && /ukjent variabel «mana»/.test(i.message))).toBe(true);
    expect(messages.some((i) => i.elementId === 'nel_1' && /skript/.test(i.message))).toBe(false);
    // nel_2 og nel_3 har ingen innganger → strukturmerknad
    expect(messages.some((i) => i.elementId === 'nel_2' && /kan ikke nås/.test(i.message))).toBe(true);
    expect(res.body.data.summary.errors).toBeGreaterThanOrEqual(2);
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

describe('narrative routes — Fase 3: eksport, import, deling', () => {
  const graphRows = [
    { match: /FROM narrative_settings WHERE project_id/, rows: [{ project_id: PROJECT_ID, title: 'Demo-spill', starting_element_id: 'nel_1', cover_asset_id: null, schema_version: 1, updated_at: null }] },
    { match: /FROM narrative_boards WHERE project_id/, rows: [{ id: 'nbd_1', project_id: PROJECT_ID, name: 'Akt 1', custom_id: null, folder_path: '', sort_order: 0, viewport: {}, created_at: new Date(), updated_at: new Date() }] },
    { match: /FROM narrative_elements WHERE project_id/, rows: [
      elementRow({ id: 'nel_1', content_html: '<p>Hei</p>' }),
      elementRow({ id: 'nel_note', kind: 'note', content_html: '<p>Designer-notat</p>' }),
    ] },
    { match: /FROM narrative_attributes WHERE project_id/, rows: [
      { id: 'nat_1', project_id: PROJECT_ID, owner_kind: 'element', owner_id: 'nel_1', name: 'notat', type: 'rich_text', value: '<p>hemmelig</p>', custom_id: null, sort_order: 0, created_at: new Date(), updated_at: new Date() },
    ] },
  ];

  it('GET export.json → Arcweave-format med vedleggs-header', async () => {
    const res = await request(createApp(makePool(graphRows)))
      .get(`/api/role-room/narrative/projects/${PROJECT_ID}/export.json`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="demo-spill.json"');
    expect(res.body.name).toBe('Demo-spill');
    const elementIds = Object.keys(res.body.elements);
    expect(elementIds).toHaveLength(1);
    expect(res.body.startingElement).toBe(elementIds[0]);
    expect(res.body.elements[elementIds[0]].title).toBe('<p>Start</p>');
    expect(Object.keys(res.body.notes)).toEqual(['note']);
  });

  it('GET export.md → Markdown', async () => {
    const res = await request(createApp(makePool(graphRows)))
      .get(`/api/role-room/narrative/projects/${PROJECT_ID}/export.md`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/markdown/);
    expect(res.text).toContain('# Demo-spill');
  });

  it('POST import med ugyldig dokument → 400 invalid_project', async () => {
    const res = await request(createApp(makePool(graphRows)))
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/import`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ project: { hello: 'world' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_project');
  });

  it('POST import → lagrer revisjon først, erstatter grafen og returnerer advarsler', async () => {
    const pool = makePool([
      ...graphRows,
      { match: /INSERT INTO narrative_revisions/, rows: (p) => [{ id: p[0], project_id: p[1], label: p[2], snapshot: p[3], created_by: p[4], created_at: new Date() }] },
    ]);
    const project = {
      name: 'Fra Arcweave', startingElement: 'e1',
      boards: { root: { name: 'Root', root: true, children: ['b1'] }, b1: { name: 'Start', notes: [], jumpers: ['j1'], branches: [], elements: ['e1'], connections: [] } },
      elements: { e1: { x: 0, y: 0, theme: 'default', title: '<p>A</p>', content: '', outputs: [], components: [], attributes: [], assets: {} } },
      jumpers: { j1: { x: 0, y: 0, elementId: 'mangler' } },
      notes: {}, connections: {}, branches: {}, components: {}, attributes: {}, assets: {}, variables: {}, conditions: {},
    };
    const res = await request(createApp(pool))
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/import`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ project });
    expect(res.status).toBe(200);
    expect(res.body.data.backup.label).toMatch(/^Før import/);
    expect(res.body.data.warnings.some((w: { message: string }) => /Jumperen peker/.test(w.message))).toBe(true);
    const sql = (pool.query as any).mock.calls.map((c: unknown[]) => String(c[0]));
    const revisionIdx = sql.findIndex((q: string) => /INSERT INTO narrative_revisions/.test(q));
    const deleteIdx = sql.findIndex((q: string) => /DELETE FROM narrative_elements/.test(q));
    expect(revisionIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeGreaterThan(revisionIdx);
    const elementInserts = (pool.query as any).mock.calls.filter((c: unknown[]) => /INSERT INTO narrative_elements/.test(String(c[0])));
    expect(elementInserts).toHaveLength(2); // element + jumper, med prosjekt-id fra ruten
    expect(elementInserts[0][1][1]).toBe(PROJECT_ID);
  });

  it('POST import format=twee → parser Twee 3, lagrer revisjon og returnerer stats', async () => {
    const pool = makePool([
      ...graphRows,
      { match: /INSERT INTO narrative_revisions/, rows: (p) => [{ id: p[0], project_id: p[1], label: p[2], snapshot: p[3], created_by: p[4], created_at: new Date() }] },
    ]);
    const source = ':: StoryTitle\nTwee-test\n\n:: Start\nHei [[Videre->Slutt]]\n\n:: Slutt\nFerdig.\n';
    const res = await request(createApp(pool))
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/import`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ format: 'twee', source });
    expect(res.status).toBe(200);
    expect(res.body.data.format).toBe('twee');
    expect(res.body.data.stats).toMatchObject({ elements: 2, connections: 1 });
    const elementInserts = (pool.query as any).mock.calls.filter((c: unknown[]) => /INSERT INTO narrative_elements/.test(String(c[0])));
    expect(elementInserts).toHaveLength(2);
    expect(elementInserts[0][1][4]).toBe('<p>Start</p>');
  });

  it('POST import format=ink med ugyldig innhold → 400; for stor kilde → 400', async () => {
    const bad = await request(createApp(makePool(graphRows)))
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/import`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ format: 'ink', source: 'bare prosa uten ink' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('invalid_project');
    const big = await request(createApp(makePool(graphRows)))
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/import`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ format: 'twee', source: ':: Start\n' + 'x'.repeat(5 * 1024 * 1024 + 1) });
    expect(big.status).toBe(400);
    expect(big.body.error).toBe('invalid_request');
  });

  it('POST share-links → 201 med råtoken én gang; kun sha256-hash i INSERT', async () => {
    const pool = makePool([{ match: /INSERT INTO narrative_share_links/, rows: (p) => [{
      id: p[0], project_id: p[1], token_hash: p[2], mode: p[3], expires_at: p[4], revoked_at: null, view_count: 0, created_by: p[5], created_at: new Date(),
    }] }]);
    const res = await request(createApp(pool))
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/share-links`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ mode: 'view_play', expiresInDays: 7 });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toMatch(/^sgs_[0-9a-f]{48}$/);
    expect(res.body.data.path).toBe(`/story/${res.body.data.token}`);
    expect(res.body.data.link).toMatchObject({ mode: 'view_play', viewCount: 0 });
    expect(res.body.data.link.expiresAt).toBeTruthy();
    const insert = (pool.query as any).mock.calls.find((c: unknown[]) => /INSERT INTO narrative_share_links/.test(String(c[0])));
    expect(insert[1][2]).toMatch(/^[0-9a-f]{64}$/);
    expect(insert[1][2]).not.toContain(res.body.data.token);
  });

  it('POST share-links med ugyldig modus → 400', async () => {
    const res = await request(createApp(makePool()))
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/share-links`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ mode: 'edit' });
    expect(res.status).toBe(400);
  });

  it('POST share-links/:id/revoke → 404 når lenka ikke finnes i prosjektet', async () => {
    const res = await request(createApp(makePool()))
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/share-links/nsl_x/revoke`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(res.status).toBe(404);
  });

  it('GET public/:token uten innlogging → renset graf (uten notater/element-attributter/prosjekt-id)', async () => {
    const pool = makePool([
      { match: /FROM narrative_share_links[\s\S]*token_hash = \$1 AND revoked_at IS NULL/, rows: [{ id: 'nsl_1', project_id: PROJECT_ID, token_hash: 'x', mode: 'play_only', expires_at: null, revoked_at: null, view_count: 3, created_by: 'u1', created_at: new Date() }] },
      ...graphRows,
    ]);
    const res = await request(createApp(pool)).get('/api/role-room/narrative/public/sgs_abc');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.title).toBe('Demo-spill');
    expect(res.body.data.mode).toBe('play_only');
    expect(res.body.data.graph.elements.map((e: { id: string }) => e.id)).toEqual(['nel_1']);
    expect(res.body.data.graph.attributes).toEqual([]);
    expect(res.body.data.graph.settings.projectId).toBe('');
    // view_count telles opp (fire-and-forget)
    await new Promise((r) => setTimeout(r, 0));
    expect((pool.query as any).mock.calls.some((c: unknown[]) => /view_count = view_count \+ 1/.test(String(c[0])))).toBe(true);
  });

  it('GET public/:token ukjent/tilbakekalt → 404', async () => {
    const res = await request(createApp(makePool())).get('/api/role-room/narrative/public/sgs_nope');
    expect(res.status).toBe(404);
  });
});
