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

/** Testplaner: `studio` (alt) som standard så eksisterende tester er upåvirket; `solo` for gating-tester. */
const TEST_PLANS = {
  solo: { slug: 'solo', features: ['play', 'export_json', 'export_md'], limits: { maxProjects: 3, maxElements: 200 } },
  studio: { slug: 'studio', features: ['play', 'export_json', 'export_md', 'share_links', 'export_html', 'ai_assist', 'translations', 'import_twine_ink', 'runtime_packages', 'export_pdf', 'scene_review', 'production_plan', 'team_seats', 'guest_reviewers'], limits: { seats: 5 } },
} as const;

function createApp(pool: Pool, opts: { access?: boolean; broadcast?: (room: string, message: unknown) => number; plan?: keyof typeof TEST_PLANS } = {}) {
  const app = express();
  app.use(express.json({ limit: '10mb' })); // prod: 50mb i index.ts — zod-grensen (5 MB) skal gi 400, ikke 413
  app.use(
    '/api/role-room/narrative',
    createRoleRoomNarrativeRouter(pool, {
      activeSessions: new Map([[SESSION_TOKEN, { userId: 'u1', email: 'u1@example.com', name: 'U1', role: 'user', loginAt: '' }]]),
      canAccessProject: async () => opts.access ?? true,
      broadcast: opts.broadcast ?? (() => 0),
      resolveProjectPlan: async () => {
        const tp = TEST_PLANS[opts.plan ?? 'studio'];
        return {
          ownerUserId: 'u1', active: opts.plan !== 'solo',
          plan: {
            slug: tp.slug, name: tp.slug, description: null, monthlyPriceKr: 0, yearlyPriceKr: 0, stripeMonthlyPriceId: null, stripeYearlyPriceId: null,
            features: [...tp.features], limits: { ...tp.limits }, trialDays: 0, isActive: true, isFeatured: false, displayOrder: 0, createdAt: '', updatedAt: '',
          },
        };
      },
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

  it('GET export.csv → BOM + header-rad, «;»-skilletegn, locale i filnavn', async () => {
    const app = createApp(makePool(graphRows));
    const res = await request(app)
      .get(`/api/role-room/narrative/projects/${PROJECT_ID}/export.csv?locale=en`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/\.csv"$/);
    expect(res.headers['content-disposition']).toContain('-en.csv');
    expect(res.text.startsWith('\uFEFFBrett;Mappe;ElementId;')).toBe(true);
    expect(res.text).toContain('\r\n');
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

  it('PUT translations → jsonb-merge per rad; nb avvises', async () => {
    const pool = makePool([
      { match: /UPDATE narrative_elements[\s\S]*SET i18n = jsonb_set/, rows: [{}] },
      { match: /UPDATE narrative_connections[\s\S]*SET i18n = jsonb_set/, rows: [{}] },
    ]);
    const res = await request(createApp(pool))
      .put(`/api/role-room/narrative/projects/${PROJECT_ID}/translations`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ locale: 'en', entries: [
        { ownerKind: 'element', id: 'nel_1', field: 'contentHtml', html: '<p>You wake up.</p>' },
        { ownerKind: 'connection', id: 'ncn_1', field: 'labelHtml', html: '<p>Go</p>' },
      ] });
    expect(res.status).toBe(200);
    expect(res.body.data.saved).toBe(2);
    const upd = (pool.query as any).mock.calls.find((c: unknown[]) => /UPDATE narrative_elements/.test(String(c[0])));
    expect(upd[1]).toEqual(['nel_1', PROJECT_ID, 'en', JSON.stringify({ contentHtml: '<p>You wake up.</p>' })]);
    const nb = await request(createApp(pool))
      .put(`/api/role-room/narrative/projects/${PROJECT_ID}/translations`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ locale: 'nb', entries: [{ ownerKind: 'settings', id: 'settings', field: 'title', html: 'x' }] });
    expect(nb.status).toBe(400);
    const badLocale = await request(createApp(pool))
      .put(`/api/role-room/narrative/projects/${PROJECT_ID}/translations`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ locale: 'English', entries: [{ ownerKind: 'settings', id: 'settings', field: 'title', html: 'x' }] });
    expect(badLocale.status).toBe(400);
  });

  it('PUT settings med locales → normalisert liste med nb først', async () => {
    const pool = makePool([{ match: /INSERT INTO narrative_settings/, rows: (p) => [{ project_id: p[0], title: p[1], starting_element_id: null, cover_asset_id: null, schema_version: 1, updated_at: null, locales: JSON.parse(String(p[7])), i18n: {} }] }]);
    const res = await request(createApp(pool))
      .put(`/api/role-room/narrative/projects/${PROJECT_ID}/settings`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ locales: ['en', 'nb', 'sv', 'en'] });
    expect(res.status).toBe(200);
    expect(res.body.data.locales).toEqual(['nb', 'en', 'sv']);
  });

  it('POST translate → 503 ai_unavailable når Claude-agenten er avslått', async () => {
    const res = await request(createApp(makePool()))
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/translate`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ targetLocale: 'en', segments: [{ key: 'element:nel_1:contentHtml:0', text: 'Hei' }] });
    expect([503, 200]).toContain(res.status);
    if (res.status === 503) expect(res.body.error).toBe('ai_unavailable');
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

describe('narrative routes — Fase 4c: sanntids-push ved mutasjoner', () => {
  it('PATCH element → narrative:graph_changed til prosjektets rom med actorUserId; GET pusher ikke; 4xx pusher ikke', async () => {
    const broadcast = vi.fn(() => 1);
    const pool = makePool([{ match: /UPDATE narrative_elements SET/, rows: [elementRow({ version: 2 })] }]);
    const app = createApp(pool, { broadcast });
    await request(app).get(`/api/role-room/narrative/projects/${PROJECT_ID}/graph`).set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(broadcast).not.toHaveBeenCalled();
    const res = await request(app)
      .patch(`/api/role-room/narrative/projects/${PROJECT_ID}/elements/nel_1`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ titleHtml: '<p>Ny</p>' });
    expect(res.status).toBe(200);
    expect(broadcast).toHaveBeenCalledTimes(1);
    const [room, message] = broadcast.mock.calls[0] as unknown as [string, { type: string; payload: Record<string, unknown> }];
    expect(room).toBe(`narrative:${PROJECT_ID}`);
    expect(message.type).toBe('narrative:graph_changed');
    expect(message.payload).toMatchObject({ kind: 'element', ids: ['nel_1'], actorUserId: 'u1' });
    const bad = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/elements`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ boardId: 'nbd_1', kind: 'ugyldig' });
    expect(bad.status).toBe(400);
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it('share-links og translate pusher ikke; import og translations pusher graph/translation', async () => {
    const broadcast = vi.fn(() => 1);
    const pool = makePool([
      { match: /INSERT INTO narrative_share_links/, rows: (p) => [{ id: p[0], project_id: p[1], token_hash: p[2], mode: p[3], expires_at: null, revoked_at: null, view_count: 0, created_by: p[5], created_at: new Date() }] },
      { match: /UPDATE narrative_elements[\s\S]*SET i18n = jsonb_set/, rows: [{}] },
    ]);
    const app = createApp(pool, { broadcast });
    await request(app).post(`/api/role-room/narrative/projects/${PROJECT_ID}/share-links`).set('Authorization', `Bearer ${SESSION_TOKEN}`).send({});
    expect(broadcast).not.toHaveBeenCalled();
    await request(app).put(`/api/role-room/narrative/projects/${PROJECT_ID}/translations`).set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ locale: 'en', entries: [{ ownerKind: 'element', id: 'nel_1', field: 'titleHtml', html: '<p>x</p>' }] });
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect((broadcast.mock.calls[0] as unknown as [string, { payload: { kind: string } }])[1].payload.kind).toBe('translation');
  });
});

describe('narrative routes — Fase 4d: plan-gating (prosjekteierens game_plan)', () => {
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${SESSION_TOKEN}`);

  it('solo: POST share-links → 402 plan_required share_links; studio → 201', async () => {
    const solo = createApp(makePool(), { plan: 'solo' });
    const res = await auth(request(solo).post(`/api/role-room/narrative/projects/${PROJECT_ID}/share-links`)).send({ mode: 'play_only' });
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ error: 'plan_required', feature: 'share_links', planSlug: 'solo' });

    const pool = makePool([{ match: /INSERT INTO narrative_share_links/, rows: (p) => [{ id: p[0], project_id: PROJECT_ID, mode: 'play_only', expires_at: null, revoked_at: null, view_count: 0, created_by: 'u1', created_at: new Date() }] }]);
    const studio = createApp(pool, { plan: 'studio' });
    const ok = await auth(request(studio).post(`/api/role-room/narrative/projects/${PROJECT_ID}/share-links`)).send({ mode: 'play_only' });
    expect(ok.status).toBe(201);
  });

  it('solo: GET export.pdf → 402 export_pdf; studio → application/pdf med vedleggsnavn', async () => {
    const solo = createApp(makePool(), { plan: 'solo' });
    const res = await auth(request(solo).get(`/api/role-room/narrative/projects/${PROJECT_ID}/export.pdf`));
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ error: 'plan_required', feature: 'export_pdf' });

    const studio = createApp(makePool(), { plan: 'studio' });
    const ok = await auth(request(studio).get(`/api/role-room/narrative/projects/${PROJECT_ID}/export.pdf?locale=en`).buffer(true).parse((r, cb) => { const chunks: Buffer[] = []; r.on('data', (c: Buffer) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); }));
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toMatch(/application\/pdf/);
    expect(ok.headers['content-disposition']).toMatch(/-en\.pdf"$/);
    expect((ok.body as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('solo: POST import format=twee → 402 import_twine_ink; format=arcweave gates ikke', async () => {
    const app = createApp(makePool(), { plan: 'solo' });
    const twee = await auth(request(app).post(`/api/role-room/narrative/projects/${PROJECT_ID}/import`)).send({ format: 'twee', source: ':: Start\nHei' });
    expect(twee.status).toBe(402);
    expect(twee.body.feature).toBe('import_twine_ink');
    const arc = await auth(request(app).post(`/api/role-room/narrative/projects/${PROJECT_ID}/import`)).send({ project: { name: 'x' } });
    expect(arc.status).not.toBe(402);
  });

  it('solo: POST translate → 402 translations (før KI kalles)', async () => {
    const app = createApp(makePool(), { plan: 'solo' });
    const res = await auth(request(app).post(`/api/role-room/narrative/projects/${PROJECT_ID}/translate`))
      .send({ targetLocale: 'en', segments: [{ key: 'element:nel_1:contentHtml:0', text: 'Hei' }] });
    expect(res.status).toBe(402);
    expect(res.body.feature).toBe('translations');
  });

  it('solo: POST elements over maxElements → 402 plan_limit; under grensen → 201', async () => {
    const full = createApp(makePool([{ match: /COUNT\(\*\)::int AS n FROM narrative_elements/, rows: [{ n: 200 }] }]), { plan: 'solo' });
    const res = await auth(request(full).post(`/api/role-room/narrative/projects/${PROJECT_ID}/elements`)).send({ boardId: 'nbd_1', kind: 'element', titleHtml: '<p>X</p>' });
    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ error: 'plan_limit', limit: 'maxElements', max: 200, planSlug: 'solo' });

    const room = createApp(makePool([
      { match: /COUNT\(\*\)::int AS n FROM narrative_elements/, rows: [{ n: 199 }] },
      { match: /INSERT INTO narrative_elements/, rows: [elementRow()] },
    ]), { plan: 'solo' });
    const ok = await auth(request(room).post(`/api/role-room/narrative/projects/${PROJECT_ID}/elements`)).send({ boardId: 'nbd_1', kind: 'element', titleHtml: '<p>X</p>' });
    expect(ok.status).toBe(201);
  });
});

describe('narrative routes — Fase 6: scener, oppgaver, review', () => {
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${SESSION_TOKEN}`);
  const base = `/api/role-room/narrative/projects/${PROJECT_ID}`;
  const sceneRow = (over: Record<string, unknown> = {}) => ({
    id: 'nsc_1', project_id: PROJECT_ID, code: 'S1', title: 'Skogpassasjen', subtitle: '', location: 'Skogen',
    challenge: '', gameplay_mechanic: '', environment: '', status: 'idea', assignee_user_id: 'u2', due_at: null,
    hero_asset_id: null, sort_order: 0, created_by: 'u1', created_at: new Date('2026-09-16T08:00:00Z'), updated_at: new Date('2026-09-16T08:00:00Z'),
    ...over,
  });
  const reviewRow = (over: Record<string, unknown> = {}) => ({
    id: 'nsr_1', scene_id: 'nsc_1', project_id: PROJECT_ID, round: 1, status: 'in_review', requested_by: 'u3',
    requested_at: new Date('2026-09-16T09:00:00Z'), request_note: null, decided_by_user_id: null, decided_by_label: null,
    decided_at: null, decision_note: null, snapshot: {}, snapshot_hash: 'a'.repeat(64), created_at: new Date(), updated_at: new Date(),
    ...over,
  });

  it('GET scenes → liste med siste runde, oppgavetelling og neste ledige kode', async () => {
    const pool = makePool([
      { match: /FROM narrative_scenes WHERE project_id = \$1 ORDER BY/, rows: [sceneRow(), sceneRow({ id: 'nsc_2', code: 'S4', title: 'Torget' })] },
      { match: /DISTINCT ON \(scene_id\)/, rows: [{ id: 'nsr_1', scene_id: 'nsc_1', round: 2, status: 'approved', requested_at: new Date(), decided_at: new Date() }] },
      { match: /FILTER \(WHERE status = 'done'\)/, rows: [{ scene_id: 'nsc_1', total: 3, done: 1 }] },
    ]);
    const res = await auth(request(createApp(pool)).get(`${base}/scenes`));
    expect(res.status).toBe(200);
    expect(res.body.data.nextCode).toBe('S5');
    expect(res.body.data.scenes[0]).toMatchObject({ id: 'nsc_1', code: 'S1', latestReview: { round: 2, status: 'approved' }, taskCounts: { total: 3, done: 1 } });
    expect(res.body.data.scenes[1]).toMatchObject({ latestReview: null, taskCounts: { total: 0, done: 0 } });
  });

  it('POST scenes uten kode → auto «S{n}» + 201; ugyldig kode → 400; duplikat → 409 duplicate_code', async () => {
    const pool = makePool([
      { match: /SELECT code FROM narrative_scenes/, rows: [{ code: 'S1' }, { code: 'S2' }, { code: 'B9' }] },
      { match: /INSERT INTO narrative_scenes/, rows: (p) => [sceneRow({ id: p[0], code: p[2], title: p[3] })] },
    ]);
    const res = await auth(request(createApp(pool)).post(`${base}/scenes`)).send({ title: 'Ny' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ code: 'S3', title: 'Ny', status: 'idea' });

    const bad = await auth(request(createApp(pool)).post(`${base}/scenes`)).send({ code: 'scene 12' });
    expect(bad.status).toBe(400);

    const dupPool = makePool([
      { match: /SELECT code FROM narrative_scenes/, rows: [] },
      { match: /INSERT INTO narrative_scenes/, rows: () => { throw Object.assign(new Error('dup'), { code: '23505' }); } },
    ]);
    const dup = await auth(request(createApp(dupPool)).post(`${base}/scenes`)).send({ code: 's1' });
    expect(dup.status).toBe(409);
    expect(dup.body).toMatchObject({ error: 'duplicate_code', code: 'S1' });
  });

  it('PATCH scenes/:id → 200 og sanntids-push kind=scene med scene-id; ukjent → 404', async () => {
    const broadcast = vi.fn(() => 1);
    const pool = makePool([{ match: /UPDATE narrative_scenes SET\s+code = COALESCE/, rows: [sceneRow({ location: 'Grotten' })] }]);
    const res = await auth(request(createApp(pool, { broadcast })).patch(`${base}/scenes/nsc_1`)).send({ location: 'Grotten', dueAt: '2026-10-01T00:00:00Z' });
    expect(res.status).toBe(200);
    expect(res.body.data.location).toBe('Grotten');
    expect(broadcast).toHaveBeenCalledWith(`narrative:${PROJECT_ID}`, expect.objectContaining({ type: 'narrative:graph_changed', payload: expect.objectContaining({ kind: 'scene', ids: ['nsc_1'] }) }));

    const missing = await auth(request(createApp(makePool())).patch(`${base}/scenes/nsc_x`)).send({ title: 'x' });
    expect(missing.status).toBe(404);
  });

  it('PUT scenes/:id/links → kun eiere som finnes i prosjektet lagres', async () => {
    const pool = makePool([
      { match: /FROM narrative_scenes WHERE id = \$1 AND project_id = \$2 LIMIT 1/, rows: [sceneRow()] },
      { match: /SELECT id FROM narrative_elements WHERE project_id = \$1 AND id = ANY/, rows: [{ id: 'nel_1' }] },
      { match: /SELECT id FROM narrative_boards WHERE project_id = \$1 AND id = ANY/, rows: [] },
    ]);
    const res = await auth(request(createApp(pool)).put(`${base}/scenes/nsc_1/links`))
      .send({ links: [{ ownerKind: 'element', ownerId: 'nel_1' }, { ownerKind: 'element', ownerId: 'nel_fremmed' }, { ownerKind: 'board', ownerId: 'nbd_x' }] });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ sceneId: 'nsc_1', ownerKind: 'element', ownerId: 'nel_1', sortOrder: 0 }]);
    const inserts = pool.query.mock.calls.filter(([sql]) => /INSERT INTO narrative_scene_links/.test(String(sql)));
    expect(inserts).toHaveLength(1);
  });

  it('POST scenes/:id/frames → XOR asset/url (400 ved begge/ingen), 201 med URL', async () => {
    const pool = makePool([
      { match: /FROM narrative_scenes WHERE id = \$1 AND project_id = \$2 LIMIT 1/, rows: [sceneRow()] },
      { match: /MAX\(sort_order\), -1\) \+ 1 AS next FROM narrative_scene_frames/, rows: [{ next: 2 }] },
      { match: /INSERT INTO narrative_scene_frames/, rows: (p) => [{ id: p[0], scene_id: p[1], project_id: p[2], asset_id: p[3], external_url: p[4], caption: p[5], sort_order: p[6], created_at: new Date(), updated_at: new Date() }] },
    ]);
    const both = await auth(request(createApp(pool)).post(`${base}/scenes/nsc_1/frames`)).send({ assetId: 'nas_1', externalUrl: 'https://x.test/a.png' });
    expect(both.status).toBe(400);
    const none = await auth(request(createApp(pool)).post(`${base}/scenes/nsc_1/frames`)).send({ caption: 'x' });
    expect(none.status).toBe(400);
    const ok = await auth(request(createApp(pool)).post(`${base}/scenes/nsc_1/frames`)).send({ externalUrl: 'https://x.test/a.png', caption: 'Åpning' });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ externalUrl: 'https://x.test/a.png', assetId: null, caption: 'Åpning', sortOrder: 2 });
  });

  it('oppgaver: POST → 201 todo; PATCH status=done → completed_at settes i SQL', async () => {
    const pool = makePool([
      { match: /FROM narrative_scenes WHERE id = \$1 AND project_id = \$2 LIMIT 1/, rows: [sceneRow()] },
      { match: /INSERT INTO narrative_scene_tasks/, rows: (p) => [{ id: p[0], scene_id: p[1], project_id: p[2], title: p[3], status: p[4], assignee_user_id: p[5], due_at: p[6], completed_at: null, sort_order: 0, created_by: 'u1', created_at: new Date(), updated_at: new Date() }] },
      { match: /UPDATE narrative_scene_tasks SET/, rows: (p) => [{ id: p[0], scene_id: p[1], project_id: p[2], title: 'Lys-pass', status: p[4], assignee_user_id: null, due_at: null, completed_at: new Date(), sort_order: 0, created_by: 'u1', created_at: new Date(), updated_at: new Date() }] },
    ]);
    const created = await auth(request(createApp(pool)).post(`${base}/scenes/nsc_1/tasks`)).send({ title: 'Lys-pass', assigneeUserId: 'u2' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ title: 'Lys-pass', status: 'todo', assigneeUserId: 'u2' });
    const empty = await auth(request(createApp(pool)).post(`${base}/scenes/nsc_1/tasks`)).send({ title: '   ' });
    expect(empty.status).toBe(400);
    const done = await auth(request(createApp(pool)).patch(`${base}/scenes/nsc_1/tasks/nst_1`)).send({ status: 'done' });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('done');
    expect(done.body.data.completedAt).toBeTruthy();
    const sql = String(pool.query.mock.calls.find(([s]) => /UPDATE narrative_scene_tasks SET/.test(String(s)))?.[0]);
    expect(sql).toMatch(/completed_at = CASE/);
  });

  it('POST reviews: studio → 201 in_review, åpen runde superseders, scene → in_review, varsel til ansvarlig; solo → 402 scene_review', async () => {
    const notify = vi.fn(async () => undefined);
    const pool = makePool([
      { match: /FROM narrative_scenes WHERE id = \$1 AND project_id = \$2 LIMIT 1/, rows: [sceneRow()] },
      { match: /MAX\(round\), 0\)::int AS max_round/, rows: [{ max_round: 1 }] },
      { match: /INSERT INTO narrative_scene_reviews/, rows: (p) => [reviewRow({ id: p[0], round: p[3], requested_by: p[4], request_note: p[5], snapshot_hash: p[7] })] },
    ]);
    const app = express();
    app.use(express.json());
    app.use('/api/role-room/narrative', createRoleRoomNarrativeRouter(pool, {
      activeSessions: new Map([[SESSION_TOKEN, { userId: 'u1', email: 'u1@example.com', name: 'U1', role: 'user', loginAt: '' }]]),
      canAccessProject: async () => true, broadcast: () => 0, notify,
      resolveProjectPlan: async () => ({ ownerUserId: 'u1', active: true, plan: { slug: 'studio', name: 'Studio', description: null, monthlyPriceKr: 0, yearlyPriceKr: 0, stripeMonthlyPriceId: null, stripeYearlyPriceId: null, features: ['scene_review'], limits: {}, trialDays: 0, isActive: true, isFeatured: false, displayOrder: 0, createdAt: '', updatedAt: '' } }),
    }));
    const res = await auth(request(app).post(`${base}/scenes/nsc_1/reviews`)).send({ note: 'Klar for gjennomgang' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ round: 2, status: 'in_review', requestedBy: 'u1', requestNote: 'Klar for gjennomgang' });
    expect(res.body.data.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    const sqls = pool.query.mock.calls.map(([s]) => String(s));
    expect(sqls.some((s) => /SET status = 'superseded'/.test(s))).toBe(true);
    expect(sqls.some((s) => /UPDATE narrative_scenes SET status = 'in_review'/.test(s))).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    expect(notify).toHaveBeenCalledWith(pool, expect.objectContaining({ event: 'narrative_scene_review_requested', recipientUserIds: ['u2'] }));

    const solo = await auth(request(createApp(makePool(), { plan: 'solo' })).post(`${base}/scenes/nsc_1/reviews`)).send({});
    expect(solo.status).toBe(402);
    expect(solo.body.feature).toBe('scene_review');
  });

  it('POST reviews/:id/decision: uendret snapshot → 200 approved + scene approved; endret → 409 snapshot_stale; lukket → 409 review_closed', async () => {
    const { hashSceneSnapshot } = await import('./role-room-narrative-service.js');
    const scene = sceneRow();
    const liveHash = hashSceneSnapshot({
      code: 'S1', title: 'Skogpassasjen', subtitle: '', location: 'Skogen', challenge: '', gameplayMechanic: '', environment: '',
      heroAssetId: null, frames: [], links: [],
    });
    const mk = (reviewOver: Record<string, unknown>) => makePool([
      { match: /FROM narrative_scene_reviews WHERE id = \$1 AND scene_id = \$2/, rows: [reviewRow(reviewOver)] },
      { match: /FROM narrative_scenes WHERE id = \$1 AND project_id = \$2 LIMIT 1/, rows: [scene] },
      { match: /UPDATE narrative_scene_reviews SET\s+status = \$4/, rows: (p) => [reviewRow({ ...reviewOver, status: p[3], decided_by_user_id: p[4], decided_by_label: p[5], decision_note: p[6], decided_at: new Date() })] },
    ]);

    const okPool = mk({ snapshot_hash: liveHash });
    const ok = await auth(request(createApp(okPool)).post(`${base}/scenes/nsc_1/reviews/nsr_1/decision`)).send({ decision: 'approved', note: 'Fint', expectedSnapshotHash: liveHash });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ status: 'approved', decidedByUserId: 'u1', decidedByLabel: 'U1', decisionNote: 'Fint' });
    expect(okPool.query.mock.calls.some(([s, p]) => /UPDATE narrative_scenes SET status = \$3/.test(String(s)) && (p as unknown[])[2] === 'approved')).toBe(true);

    const stale = await auth(request(createApp(mk({ snapshot_hash: 'b'.repeat(64) }))).post(`${base}/scenes/nsc_1/reviews/nsr_1/decision`)).send({ decision: 'approved' });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ error: 'snapshot_stale', currentHash: liveHash });

    const closed = await auth(request(createApp(mk({ snapshot_hash: liveHash, status: 'approved' }))).post(`${base}/scenes/nsc_1/reviews/nsr_1/decision`)).send({ decision: 'changes_requested' });
    expect(closed.status).toBe(409);
    expect(closed.body.error).toBe('review_closed');

    const solo = await auth(request(createApp(makePool(), { plan: 'solo' })).post(`${base}/scenes/nsc_1/reviews/nsr_1/decision`)).send({ decision: 'approved' });
    expect(solo.status).toBe(402);
  });

  it('GET members-lite → eier først, visningsnavn med fallback til e-post', async () => {
    const pool = makePool([{ match: /LEFT JOIN role_room_member_profiles/, rows: [
      { user_id: 'u1', is_owner: true, display_name: 'Daniel', profile_image_url: 'https://x.test/d.png', full_name: null, email: 'd@x.test' },
      { user_id: 'u2', is_owner: false, display_name: null, profile_image_url: null, full_name: null, email: 'kari@x.test' },
    ] }]);
    const res = await auth(request(createApp(pool)).get(`${base}/members-lite`));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { userId: 'u1', displayName: 'Daniel', profileImageUrl: 'https://x.test/d.png', isOwner: true },
      { userId: 'u2', displayName: 'kari@x.test', profileImageUrl: null, isOwner: false },
    ]);
  });
});

describe('narrative routes — Fase 7: produksjons-OS (gater, replikker, episoder, plan, plattform, hjem)', () => {
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${SESSION_TOKEN}`);
  const base = `/api/role-room/narrative/projects/${PROJECT_ID}`;
  const sceneRow = (over: Record<string, unknown> = {}) => ({
    id: 'nsc_1', project_id: PROJECT_ID, code: 'P01', title: 'Skoleveien', subtitle: '', location: 'Skoleveien', challenge: '', gameplay_mechanic: '',
    environment: '', status: 'idea', assignee_user_id: null, due_at: null, hero_asset_id: null, sort_order: 0, created_by: 'u1',
    created_at: new Date('2026-09-17T08:00:00Z'), updated_at: new Date('2026-09-17T08:00:00Z'),
    before_state: 'Fire barn på vei hjem', action: 'Bok og skolisse', control: 'Berøring', after_state: 'Leken starter', audio: 'Foley: papir',
    change_note: '', bridge: '', time_note: '', knowledge: {}, era: '1797', episode_id: 'nep_1', start_at: null, source_refs: [{ tag: 'W', ref: 'W', field: 'action' }], working_id: 'P01',
    ...over,
  });
  const sceneSelect = { match: /FROM narrative_scenes WHERE id = \$1 AND project_id = \$2 LIMIT 1/, rows: [sceneRow()] };

  it('POST scenes med kode «G03A» godtas (bokstav-suffiks) og scenekort v2-felt returneres', async () => {
    const pool = makePool([
      { match: /SELECT code FROM narrative_scenes/, rows: [] },
      { match: /INSERT INTO narrative_scenes/, rows: (p) => [sceneRow({ id: p[0], code: p[2], title: p[3], era: p[24] ?? '1817', before_state: p[15] ?? '' })] },
    ]);
    const res = await auth(request(createApp(pool)).post(`${base}/scenes`)).send({ code: 'g03a', title: 'Første bundne møte', era: '1817', beforeState: 'Skogsvei', sourceRefs: [{ tag: 'K', ref: 'K' }] });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('G03A');
    expect(res.body.data).toHaveProperty('beforeState');
    expect(res.body.data).toHaveProperty('sourceRefs');
    const badEra = await auth(request(createApp(pool)).post(`${base}/scenes`)).send({ title: 'x', era: '1850' });
    expect(badEra.status).toBe(400);
    const badTag = await auth(request(createApp(pool)).post(`${base}/scenes`)).send({ title: 'x', sourceRefs: [{ tag: 'Z', ref: 'W' }] });
    expect(badTag.status).toBe(400);
  });

  it('PUT scenes/:id/links → komponent-lenker valideres mot narrative_components', async () => {
    const pool = makePool([
      sceneSelect,
      { match: /SELECT id FROM narrative_components WHERE project_id = \$1 AND id = ANY/, rows: [{ id: 'ncp_elise' }] },
    ]);
    const res = await auth(request(createApp(pool)).put(`${base}/scenes/nsc_1/links`))
      .send({ links: [{ ownerKind: 'component', ownerId: 'ncp_elise' }, { ownerKind: 'component', ownerId: 'ncp_ukjent' }] });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ sceneId: 'nsc_1', ownerKind: 'component', ownerId: 'ncp_elise', sortOrder: 0 }]);
  });

  it('PUT gates/:gateKey → passed uten bevis = 400 gate_evidence_required; med bevis = 200; ukjent gate = 400', async () => {
    const pool = makePool([
      sceneSelect,
      { match: /INSERT INTO narrative_scene_gates/, rows: (p) => [{ scene_id: p[0], project_id: p[1], gate_key: p[2], status: p[3], evidence: p[4], evidence_refs: JSON.parse(String(p[5])), checked_by: p[6], checked_at: new Date(), updated_at: new Date() }] },
    ]);
    const noEvidence = await auth(request(createApp(pool)).put(`${base}/scenes/nsc_1/gates/greybox`)).send({ status: 'passed', evidence: '   ' });
    expect(noEvidence.status).toBe(400);
    expect(noEvidence.body.error).toBe('gate_evidence_required');
    const ok = await auth(request(createApp(pool)).put(`${base}/scenes/nsc_1/gates/greybox`)).send({ status: 'passed', evidence: 'build/Prologue-P01-Final.xcresult: 68 bestått', evidenceRefs: ['PROLOGUE-IMPLEMENTATION-v1'] });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ gateKey: 'greybox', status: 'passed', evidence: 'build/Prologue-P01-Final.xcresult: 68 bestått', evidenceRefs: ['PROLOGUE-IMPLEMENTATION-v1'], checkedBy: 'u1' });
    const unknown = await auth(request(createApp(pool)).put(`${base}/scenes/nsc_1/gates/vibes`)).send({ status: 'passed', evidence: 'x' });
    expect(unknown.status).toBe(400);
    const inProgress = await auth(request(createApp(pool)).put(`${base}/scenes/nsc_1/gates/audio`)).send({ status: 'in_progress' });
    expect(inProgress.status).toBe(200);
  });

  it('GET scenes/:id → detalj har seks gater (manglende = not_started) og replikker', async () => {
    const pool = makePool([
      sceneSelect,
      { match: /FROM narrative_scene_gates WHERE scene_id/, rows: [{ scene_id: 'nsc_1', project_id: PROJECT_ID, gate_key: 'script_coverage', status: 'passed', evidence: 'Word 01 lest', evidence_refs: [], checked_by: 'u1', checked_at: new Date(), updated_at: new Date() }] },
      { match: /FROM narrative_scene_lines WHERE scene_id/, rows: [{ id: 'nsl_1', scene_id: 'nsc_1', project_id: PROJECT_ID, cue_id: 'W01.01', speaker_component_id: 'ncp_nora', speaker_label: 'NORA', perspective: '', text_en: 'Must you read all the way home?', text_nb: '', source_type: 'E', recording_status: 'none', note: '', sort_order: 0, created_by: 'u1', created_at: new Date(), updated_at: new Date() }] },
    ]);
    const res = await auth(request(createApp(pool)).get(`${base}/scenes/nsc_1`));
    expect(res.status).toBe(200);
    expect(res.body.data.gates).toHaveLength(6);
    expect(res.body.data.gates.map((g: { gateKey: string; status: string }) => `${g.gateKey}:${g.status}`)).toEqual([
      'script_coverage:passed', 'greybox:not_started', 'characters_animation:not_started', 'playthrough:not_started', 'picture:not_started', 'audio:not_started',
    ]);
    expect(res.body.data.lines[0]).toMatchObject({ cueId: 'W01.01', speakerLabel: 'NORA', sourceType: 'E' });
    expect(res.body.data.scene).toMatchObject({ era: '1797', workingId: 'P01', beforeState: 'Fire barn på vei hjem' });
  });

  it('replikker: POST → 201 (cue oppercase), ugyldig cue → 400, duplikat → 409 duplicate_cue', async () => {
    const pool = makePool([
      sceneSelect,
      { match: /MAX\(sort_order\), -1\) \+ 1 AS next FROM narrative_scene_lines/, rows: [{ next: 3 }] },
      { match: /INSERT INTO narrative_scene_lines/, rows: (p) => [{ id: p[0], scene_id: p[1], project_id: p[2], cue_id: p[3], speaker_component_id: p[4], speaker_label: p[5], perspective: p[6], text_en: p[7], text_nb: p[8], source_type: p[9], recording_status: p[10], note: p[11], sort_order: p[12], created_by: p[13], created_at: new Date(), updated_at: new Date() }] },
    ]);
    const ok = await auth(request(createApp(pool)).post(`${base}/scenes/nsc_1/lines`)).send({ cueId: 'w01.02', speakerLabel: 'ELISE', textEn: 'You will not drop my book, will you?', sourceType: 'E' });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ cueId: 'W01.02', speakerLabel: 'ELISE', sourceType: 'E', recordingStatus: 'none', sortOrder: 3 });
    const bad = await auth(request(createApp(pool)).post(`${base}/scenes/nsc_1/lines`)).send({ cueId: 'replikk 1', textEn: 'x' });
    expect(bad.status).toBe(400);
    const dupPool = makePool([sceneSelect, { match: /INSERT INTO narrative_scene_lines/, rows: () => { throw Object.assign(new Error('dup'), { code: '23505' }); } }]);
    const dup = await auth(request(createApp(dupPool)).post(`${base}/scenes/nsc_1/lines`)).send({ cueId: 'W01.01', textEn: 'x' });
    expect(dup.status).toBe(409);
    expect(dup.body).toMatchObject({ error: 'duplicate_cue', cueId: 'W01.01' });
  });

  it('episoder: POST → 201, duplikat kode → 409 duplicate_code; sanntids-push kind=production', async () => {
    const broadcast = vi.fn(() => 1);
    const pool = makePool([
      { match: /INSERT INTO narrative_episodes/, rows: (p) => [{ id: p[0], project_id: p[1], code: p[2], title: p[3], summary: p[4], players_learn: p[5], source_note: p[6], status: p[7], sort_order: p[8], created_by: p[9], created_at: new Date(), updated_at: new Date() }] },
    ]);
    const res = await auth(request(createApp(pool, { broadcast })).post(`${base}/episodes`)).send({ code: 'e01', title: 'Skoleveien og leken', playersLearn: 'Fire barn, én lek, én stemme fra skogen' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ code: 'E01', title: 'Skoleveien og leken', status: 'draft' });
    expect(broadcast).toHaveBeenCalledWith(`narrative:${PROJECT_ID}`, expect.objectContaining({ payload: expect.objectContaining({ kind: 'production' }) }));
    const dupPool = makePool([{ match: /INSERT INTO narrative_episodes/, rows: () => { throw Object.assign(new Error('dup'), { code: '23505' }); } }]);
    const dup = await auth(request(createApp(dupPool)).post(`${base}/episodes`)).send({ code: 'E01' });
    expect(dup.status).toBe(409);
    expect(dup.body).toMatchObject({ error: 'duplicate_code', entity: 'episode', value: 'E01' });
  });

  it('kilder: sha256 valideres (64 hex); åpne spørsmål: kind=check godtas', async () => {
    const pool = makePool([
      { match: /INSERT INTO narrative_sources/, rows: (p) => [{ id: p[0], project_id: p[1], code: p[2], label: p[3], kind: p[4], sha256: p[5], path_hint: p[6], notes: p[7], sort_order: p[8], created_by: p[9], verified_at: null, verified_by: null, created_at: new Date(), updated_at: new Date() }] },
      { match: /INSERT INTO narrative_open_questions/, rows: (p) => [{ id: p[0], project_id: p[1], code: p[2], kind: p[3], question: p[4], context: p[5], status: p[6], decision: p[7], source_refs: [], sort_order: p[9], decided_by: null, decided_at: null, created_by: 'u1', created_at: new Date(), updated_at: new Date() }] },
    ]);
    const badSha = await auth(request(createApp(pool)).post(`${base}/sources`)).send({ code: 'W', label: 'Original Word-manus', kind: 'docx', sha256: 'abc' });
    expect(badSha.status).toBe(400);
    const ok = await auth(request(createApp(pool)).post(`${base}/sources`)).send({ code: 'W', label: 'Original Word-manus', kind: 'docx', sha256: '553a5e2f0ea0a8302e6981f4a219c4ef8329b1226803c7259885aa26e6201633' });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ code: 'W', kind: 'docx', sha256: '553a5e2f0ea0a8302e6981f4a219c4ef8329b1226803c7259885aa26e6201633', verifiedAt: null });
    const check = await auth(request(createApp(pool)).post(`${base}/open-questions`)).send({ code: 'C03', kind: 'check', question: 'Tellerunden 1–50 verifisert mot faktisk tilbakeplassering' });
    expect(check.status).toBe(201);
    expect(check.body.data).toMatchObject({ code: 'C03', kind: 'check', status: 'open' });
  });

  it('milepæler: solo → 402 production_plan på mutasjon, GET er åpen; studio → 201', async () => {
    const pool = makePool([
      { match: /INSERT INTO narrative_milestones/, rows: (p) => [{ id: p[0], project_id: p[1], title: p[2], lane: p[3], start_at: p[4], due_at: p[5], status: p[6], owner_user_id: p[7], description: p[8], acceptance: p[9], evidence: p[10], sort_order: p[11], created_by: p[12], created_at: new Date(), updated_at: new Date() }] },
    ]);
    const soloGet = await auth(request(createApp(pool, { plan: 'solo' })).get(`${base}/milestones`));
    expect(soloGet.status).toBe(200);
    const solo = await auth(request(createApp(pool, { plan: 'solo' })).post(`${base}/milestones`)).send({ title: 'M1-varmtest', lane: 'engineering' });
    expect(solo.status).toBe(402);
    expect(solo.body.feature).toBe('production_plan');
    const ok = await auth(request(createApp(pool)).post(`${base}/milestones`)).send({ title: 'M1-varmtest', lane: 'engineering', dueAt: '2026-10-15T00:00:00Z' });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ title: 'M1-varmtest', lane: 'engineering', status: 'planned', sceneIds: [] });
    const badLane = await auth(request(createApp(pool)).post(`${base}/milestones`)).send({ title: 'x', lane: 'marketing' });
    expect(badLane.status).toBe(400);
  });

  it('plattformmål: POST → 201 med budsjetter/krav; ugyldig plattform → 400', async () => {
    const pool = makePool([
      { match: /INSERT INTO narrative_platform_targets/, rows: (p) => [{ id: p[0], project_id: p[1], name: p[2], platform: p[3], is_primary: p[4], engine: p[5], os_min: p[6], device_min: p[7], input_model: p[8], budgets: JSON.parse(String(p[9])), requirements: JSON.parse(String(p[10])), visual_direction: JSON.parse(String(p[11])), notes: p[12], sort_order: p[13], created_by: p[14], created_at: new Date(), updated_at: new Date() }] },
    ]);
    const res = await auth(request(createApp(pool)).post(`${base}/platform-targets`)).send({
      name: 'iPad Pro M1 12,9″', platform: 'ipad', isPrimary: true, engine: 'SwiftUI/RealityKit', osMin: 'iPadOS 17', deviceMin: 'iPad Pro M1 8 GB',
      budgets: { fps: 30, frameMs: 33.3, gpuMs: '25–28' },
      requirements: [{ code: 'R1', text: 'Varmtest 30–45 min uten throttling', status: 'unverified', source: 'CINEMATIC-M1-QUALITY-v1' }],
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'iPad Pro M1 12,9″', platform: 'ipad', isPrimary: true, budgets: { fps: 30 }, requirements: [{ code: 'R1', status: 'unverified' }] });
    const bad = await auth(request(createApp(pool)).post(`${base}/platform-targets`)).send({ name: 'x', platform: 'gameboy' });
    expect(bad.status).toBe(400);
  });

  it('GET overview → aggregat (scener per status/epoke, gater, oppgaver forfalt, plattformkrav)', async () => {
    const pool = makePool([
      { match: /SELECT status, era, start_at, due_at FROM narrative_scenes/, rows: [{ status: 'idea', era: '1797', start_at: null, due_at: null }, { status: 'approved', era: '1817', start_at: new Date(), due_at: null }] },
      { match: /FROM narrative_scene_gates WHERE project_id = \$1 GROUP BY/, rows: [{ gate_key: 'greybox', status: 'passed', n: 1 }, { gate_key: 'audio', status: 'failed', n: 1 }] },
      { match: /SELECT status, due_at FROM narrative_scene_tasks/, rows: [{ status: 'todo', due_at: '2020-01-01T00:00:00Z' }, { status: 'done', due_at: null }] },
      { match: /FROM narrative_scene_reviews WHERE project_id = \$1 AND status = 'in_review'/, rows: [{ n: 1 }] },
      { match: /SELECT name, requirements FROM narrative_platform_targets/, rows: [{ name: 'iPad Pro M1', requirements: [{ code: 'R1', text: 'x', status: 'verified' }, { code: 'R2', text: 'y', status: 'unverified' }] }] },
    ]);
    const res = await auth(request(createApp(pool)).get(`${base}/overview`));
    expect(res.status).toBe(200);
    expect(res.body.data.scenes).toMatchObject({ total: 2, byStatus: { idea: 1, approved: 1 }, byEra: { '1797': 1, '1817': 1 }, withoutDates: 1 });
    // Kun startede scener (status ≠ idea) teller i gate-totalen: 1 scene × 6 gater.
    expect(res.body.data.gates).toMatchObject({ total: 6, passed: 1, failed: 1 });
    expect(res.body.data.tasks).toEqual({ open: 1, overdue: 1, done: 1 });
    expect(res.body.data.reviews).toEqual({ open: 1 });
    expect(res.body.data.platform).toEqual({ requirements: 2, verified: 1, primaryName: 'iPad Pro M1' });
  });

  it('innboks: GET filtrerer narrative-varsler; POST :id/read → 404 for fremmed varsel, 200 ellers; read-all teller', async () => {
    const pool = makePool([
      { match: /SELECT n\.\*, rd\.read_at FROM role_room_project_notifications/, rows: [{ id: 'n1', event_type: 'narrative_scene_review_requested', title: 'Review: P01', message: null, linked_entity_type: 'narrative_scene', linked_entity_id: 'nsc_1', created_by_user_id: 'u2', created_at: new Date(), updated_at: new Date(), read_at: null }] },
      { match: /SELECT id FROM role_room_project_notifications WHERE id = \$1 AND project_id = \$2/, rows: (p) => (p[0] === 'n1' ? [{ id: 'n1' }] : []) },
      { match: /INSERT INTO role_room_project_notification_reads \(notification_id, user_id, read_at\)\s+SELECT/, rows: [{}, {}] },
    ]);
    const list = await auth(request(createApp(pool)).get(`${base}/inbox`));
    expect(list.status).toBe(200);
    expect(list.body.data[0]).toMatchObject({ id: 'n1', eventType: 'narrative_scene_review_requested', readAt: null });
    const listSql = String(pool.query.mock.calls.find(([s]) => /rd\.read_at FROM role_room_project_notifications/.test(String(s)))?.[0]);
    expect(listSql).toMatch(/event_type LIKE 'narrative_%'/);
    const foreign = await auth(request(createApp(pool)).post(`${base}/inbox/n_fremmed/read`));
    expect(foreign.status).toBe(404);
    const ok = await auth(request(createApp(pool)).post(`${base}/inbox/n1/read`));
    expect(ok.status).toBe(200);
    const all = await auth(request(createApp(pool)).post(`${base}/inbox/read-all`));
    expect(all.status).toBe(200);
    expect(all.body.data.marked).toBe(2);
  });

  it('snapshot v2: manusfelt inngår i hashen; v1-runde avgjøres fortsatt med v1-hash', async () => {
    const { hashSceneSnapshot, buildSceneSnapshot, mapSceneRow } = await import('./role-room-narrative-service.js');
    const scene = mapSceneRow(sceneRow());
    const pool = makePool([{ match: /FROM narrative_scene_lines WHERE scene_id/, rows: [] }]);
    const v1 = await buildSceneSnapshot(pool, PROJECT_ID, scene, [], [], { version: 1 });
    const v2 = await buildSceneSnapshot(pool, PROJECT_ID, scene, [], []);
    expect(v1).not.toHaveProperty('v');
    expect(v2).toMatchObject({ v: 2, era: '1797', script: { beforeState: 'Fire barn på vei hjem' } });
    const v2b = await buildSceneSnapshot(pool, PROJECT_ID, { ...scene, beforeState: 'Endret' }, [], []);
    expect(hashSceneSnapshot(v2b)).not.toBe(hashSceneSnapshot(v2));
    // v1-hash er upåvirket av manusfeltene (åpne runder fra før Fase 7 forblir gyldige).
    const v1b = await buildSceneSnapshot(pool, PROJECT_ID, { ...scene, beforeState: 'Endret' }, [], [], { version: 1 });
    expect(hashSceneSnapshot(v1b)).toBe(hashSceneSnapshot(v1));
  });
});

describe('narrative routes — Fase 7e-1: kapabiliteter i studio-team', () => {
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${SESSION_TOKEN}`);
  const base = `/api/role-room/narrative/projects/${PROJECT_ID}`;
  const plan = (ownerUserId: string) => async () => ({
    ownerUserId, active: true,
    plan: { slug: 'studio', name: 'Studio', description: null, monthlyPriceKr: 0, yearlyPriceKr: 0, stripeMonthlyPriceId: null, stripeYearlyPriceId: null, features: ['scene_review', 'production_plan', 'team_seats'], limits: { seats: 5 }, trialDays: 0, isActive: true, isFeatured: false, displayOrder: 0, createdAt: '', updatedAt: '' },
  });
  const appWith = (pool: Pool, ownerUserId: string, caps: string[]) => {
    const app = express();
    app.use(express.json());
    app.use('/api/role-room/narrative', createRoleRoomNarrativeRouter(pool, {
      activeSessions: new Map([[SESSION_TOKEN, { userId: 'u1', email: 'u1@example.com', name: 'U1', role: 'user', loginAt: '' }]]),
      canAccessProject: async () => true, broadcast: () => 0, resolveProjectPlan: plan(ownerUserId),
      resolveCapabilities: async () => new Set(caps),
    }));
    return app;
  };

  it('eier bypasser; medlem uten scenes.delete → 403 capability_required; med → 200', async () => {
    const pool = makePool([{ match: /DELETE FROM narrative_scenes/, rows: [{ id: 'nsc_1' }] }]);
    const owner = await auth(request(appWith(pool, 'u1', [])).delete(`${base}/scenes/nsc_1`));
    expect(owner.status).toBe(200);
    const member = await auth(request(appWith(pool, 'u-owner', ['scenes.edit'])).delete(`${base}/scenes/nsc_1`));
    expect(member.status).toBe(403);
    expect(member.body).toMatchObject({ error: 'capability_required', capability: 'scenes.delete' });
    const allowed = await auth(request(appWith(pool, 'u-owner', ['scenes.delete'])).delete(`${base}/scenes/nsc_1`));
    expect(allowed.status).toBe(200);
  });

  it('milepæl-mutasjon krever plan.edit (etter plan-gating); GET er åpen', async () => {
    const pool = makePool([{ match: /INSERT INTO narrative_milestones/, rows: (p) => [{ id: p[0], project_id: p[1], title: p[2], lane: p[3], start_at: null, due_at: null, status: 'planned', owner_user_id: null, description: '', acceptance: '', evidence: '', sort_order: 0, created_by: 'u1', created_at: new Date(), updated_at: new Date() }] }]);
    const denied = await auth(request(appWith(pool, 'u-owner', ['story.edit'])).post(`${base}/milestones`)).send({ title: 'M1' });
    expect(denied.status).toBe(403);
    const ok = await auth(request(appWith(pool, 'u-owner', ['plan.edit'])).post(`${base}/milestones`)).send({ title: 'M1' });
    expect(ok.status).toBe(201);
    const list = await auth(request(appWith(pool, 'u-owner', [])).get(`${base}/milestones`));
    expect(list.status).toBe(200);
  });

  it('review-beslutning krever review.decide', async () => {
    const denied = await auth(request(appWith(makePool(), 'u-owner', ['review.request'])).post(`${base}/scenes/nsc_1/reviews/nsr_1/decision`)).send({ decision: 'approved' });
    expect(denied.status).toBe(403);
    expect(denied.body.capability).toBe('review.decide');
  });

  it('members-lite inkluderer aktive game_studio-teammedlemmer hos eieren (UNION i SQL)', async () => {
    const pool = makePool([{ match: /LEFT JOIN role_room_member_profiles/, rows: [{ user_id: 'u1', is_owner: true, display_name: 'Daniel', profile_image_url: null, full_name: null, email: null }] }]);
    const res = await auth(request(createApp(pool)).get(`${base}/members-lite`));
    expect(res.status).toBe(200);
    const sql = String(pool.query.mock.calls.find(([s]) => /LEFT JOIN role_room_member_profiles/.test(String(s)))?.[0]);
    expect(sql).toMatch(/enterprise_team_members m ON m\.organization_id = p\.created_by AND m\.org_kind = 'game_studio' AND m\.status = 'active'/);
  });
});

describe('narrative routes — Fase 8b: manusimport (dry-run + apply)', () => {
  const sceneRow = (over: Record<string, unknown> = {}) => ({
    id: 'nsc_1', project_id: PROJECT_ID, code: 'P01', title: 'Skoleveien', subtitle: 'W01 · 1797, ettermiddag', location: '', challenge: '', gameplay_mechanic: '',
    environment: '', status: 'idea', assignee_user_id: null, due_at: null, hero_asset_id: null, sort_order: 0, created_by: 'u1',
    created_at: new Date('2026-09-17T08:00:00Z'), updated_at: new Date('2026-09-17T08:00:00Z'),
    before_state: 'Bok hos Elise.', action: 'Nora tar boken.', control: '', after_state: '', audio: '',
    change_note: '', bridge: '', time_note: '', knowledge: {}, era: '1797', episode_id: null, start_at: null, source_refs: [], working_id: 'P01',
    ...over,
  });
  const DOC = `# Manus v3

### P01 — Skoleveien · W01 · 1797, ettermiddag

**Før:** Bok hos Elise.
**Handling:** Nora tar boken og knyter skolissen.

### P02 — Ringen · W02 · 1797

**Før:** Oskar kommer frem med ballen.

## W01 — Skoleveien · 1797

| ID | Kildetaler | Type | Engelsk tekst |
| --- | --- | --- | --- |
| W01.01 | NORA | E | Must you read all the way home? |
| W01.02 | ELISE | E | You will not drop my book, will you? |
`;
  const existingHandlers = () => [
    { match: /FROM narrative_scenes WHERE project_id = \$1 ORDER BY sort_order, code$/, rows: [sceneRow()] },
    { match: /FROM narrative_scene_lines WHERE project_id = \$1 ORDER BY scene_id/, rows: [
      { id: 'nsl_1', scene_id: 'nsc_1', cue_id: 'W01.01', speaker_label: 'NORA', text_en: 'Must you read all the way home?', source_type: 'E' },
      { id: 'nsl_3', scene_id: 'nsc_1', cue_id: 'W01.03', speaker_label: 'OSKAR', text_en: 'Ball by the root.', source_type: 'T' },
    ] },
  ];

  it('POST import-document (dry-run) parser dokumentet og returnerer diff + sha256 uten å skrive', async () => {
    const pool = makePool(existingHandlers());
    const app = createApp(pool);
    const res = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/import-document`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .attach('file', Buffer.from(DOC, 'utf8'), { filename: 'MANUS-v3.md', contentType: 'text/markdown' });
    expect(res.status).toBe(200);
    expect(res.body.data.kind).toBe('md');
    expect(res.body.data.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.data.title).toBe('Manus v3');
    const diff = res.body.data.diff;
    expect(diff.stats).toMatchObject({ create: 1, update: 1, unchanged: 0, linesCreate: 1, missingLines: 1 });
    expect(diff.create[0].code).toBe('P02');
    expect(diff.update[0].changes.action).toEqual({ from: 'Nora tar boken.', to: 'Nora tar boken og knyter skolissen.' });
    expect(diff.update[0].lines.create.map((l: { cueId: string }) => l.cueId)).toEqual(['W01.02']);
    expect(diff.missingInDoc.lines[0].cueId).toBe('W01.03');
    // Ingen skriving under dry-run.
    const sqls = pool.query.mock.calls.map(([q]) => String(q));
    expect(sqls.some((q) => /INSERT|UPDATE|DELETE/i.test(q))).toBe(false);
  });

  it('POST import-document avviser ukjent filtype (415) og tomt dokument (422)', async () => {
    const app = createApp(makePool(existingHandlers()));
    const png = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/import-document`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .attach('file', Buffer.from('x'), { filename: 'bilde.png', contentType: 'image/png' });
    expect(png.status).toBe(415);
    const empty = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/import-document`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .attach('file', Buffer.from('Bare prosa. Ingen scener her, bare ord og litt til for å passere lengdekravet.'), { filename: 'notat.txt', contentType: 'text/plain' });
    expect(empty.status).toBe(422);
    expect(empty.body.error).toBe('nothing_recognized');
  });

  it('POST scenes/import-document/apply skriver ny scene, patcher felt/replikker, kobler taler og lager åpne spørsmål', async () => {
    const inserts: Record<string, unknown[][]> = { scenes: [], lines: [], questions: [], sources: [] };
    const pool = makePool([
      { match: /SELECT \* FROM narrative_sources WHERE project_id/, rows: [] },
      { match: /INSERT INTO narrative_sources/, rows: (p) => { inserts.sources.push(p); return [{ id: 'nso_1', project_id: p[1], code: p[2], label: p[3], kind: p[4], sha256: p[5], path_hint: p[6], notes: p[7], sort_order: p[8], created_by: p[9], verified_at: null, verified_by: null, created_at: new Date(), updated_at: new Date() }]; } },
      { match: /UPDATE narrative_sources SET/, rows: [{ id: 'nso_1', project_id: PROJECT_ID, code: 'W', label: 'Manus v3', kind: 'md', sha256: 'a'.repeat(64), path_hint: '', notes: 'x', sort_order: 0, created_by: 'u1', verified_at: new Date(), verified_by: 'u1', created_at: new Date(), updated_at: new Date() }] },
      { match: /FROM narrative_components WHERE project_id = \$1 AND kind = \$2/, rows: [{ id: 'char_nora', project_id: PROJECT_ID, name: 'Nora', custom_id: 'char_nora', folder_path: '', cover_asset_id: null, sort_order: 0, kind: 'character', profile: {}, created_by: 'u1', created_at: new Date(), updated_at: new Date() }] },
      { match: /SELECT code FROM narrative_scenes/, rows: [] },
      { match: /INSERT INTO narrative_scenes/, rows: (p) => { inserts.scenes.push(p); return [sceneRow({ id: p[0], code: p[2], title: p[3], working_id: 'P02' })]; } },
      { match: /FROM narrative_scenes WHERE id = \$1 AND project_id = \$2 LIMIT 1/, rows: (p) => [sceneRow({ id: p[0] })] },
      { match: /UPDATE narrative_scenes SET/, rows: (p) => [sceneRow({ id: p[0] })] },
      { match: /FROM narrative_scene_lines WHERE scene_id = \$1 AND project_id = \$2/, rows: [{ id: 'nsl_1', scene_id: 'nsc_1', project_id: PROJECT_ID, cue_id: 'W01.01', speaker_component_id: null, speaker_label: 'NORA', perspective: '', text_en: 'x', text_nb: '', source_type: 'E', recording_status: 'none', note: '', sort_order: 0, created_at: new Date(), updated_at: new Date() }] },
      { match: /INSERT INTO narrative_scene_lines/, rows: (p) => { inserts.lines.push(p); return [{ id: p[0], scene_id: p[1], project_id: p[2], cue_id: p[3], speaker_component_id: p[4], speaker_label: p[5], perspective: p[6], text_en: p[7], text_nb: p[8], source_type: p[9], recording_status: p[10], note: p[11], sort_order: p[12], created_by: p[13], created_at: new Date(), updated_at: new Date() }]; } },
      { match: /UPDATE narrative_scene_lines SET/, rows: (p) => [{ id: p[0], scene_id: 'nsc_1', project_id: PROJECT_ID, cue_id: 'W01.03', speaker_component_id: null, speaker_label: 'OSKAR', perspective: '', text_en: 'ny', text_nb: '', source_type: 'T', recording_status: 'none', note: '', sort_order: 1, created_at: new Date(), updated_at: new Date() }] },
      { match: /FROM narrative_open_questions WHERE project_id/, rows: [] },
      { match: /INSERT INTO narrative_open_questions/, rows: (p) => { inserts.questions.push(p); return [{ id: p[0], project_id: p[1], code: p[2], kind: p[3], question: p[4], context: p[5], status: p[6], decision: p[7], source_refs: JSON.parse(String(p[8])), sort_order: p[9], created_by: p[10], created_at: new Date(), updated_at: new Date() }]; } },
    ]);
    const app = createApp(pool);
    const body = {
      sourceSha256: 'a'.repeat(64), sourceCode: 'W', sourceLabel: 'Manus v3', sourceKind: 'md', fileName: 'MANUS-v3.md',
      create: [{ workingId: 'P02', code: 'P02', scene: { workingId: 'P02', title: 'Ringen', subtitle: 'W02 · 1797', era: '1797', cueBlocks: ['W02'], fields: { beforeState: 'Oskar kommer frem.', action: '', control: '', afterState: '', audio: '' }, lines: [{ cueId: 'W02.02', speakerLabel: 'OSKAR', sourceType: 'T', textEn: 'The name first.' }, { cueId: 'W02.01', speakerLabel: 'NORA, 12', sourceType: 'E', textEn: 'We wait here.' }] } }],
      update: [{ sceneId: 'nsc_1', code: 'P01', workingId: 'P01', changes: { action: { from: 'Nora tar boken.', to: 'Nora tar boken og knyter skolissen.' } }, lines: { create: [{ cueId: 'W01.02', speakerLabel: 'ELISE', sourceType: 'E', textEn: 'You will not drop my book, will you?' }], update: [{ lineId: 'nsl_3', cueId: 'W01.03', changes: { textEn: { from: 'Ball by the root.', to: 'The kicking game.' } } }], unchanged: 1 } }],
      openQuestions: [{ question: 'Replikk W01.04 finnes ikke i «Manus v3» — stryke?', sceneCode: 'P01' }],
    };
    const res = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/scenes/import-document/apply`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send(body);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ createdSceneIds: [expect.any(String)], updatedSceneIds: ['nsc_1'], linesCreated: 3, linesUpdated: 1, openQuestionsCreated: 1 });
    // Kilderegister: kode W med sha256 fra dokumentet.
    expect(inserts.sources[0][2]).toBe('W');
    expect(inserts.sources[0][5]).toBe('a'.repeat(64));
    // Ny scene har kildemerker per fylt felt (kun beforeState).
    expect(inserts.scenes[0][2]).toBe('P02');
    expect(JSON.parse(String(inserts.scenes[0][27]))).toEqual([{ tag: 'W', ref: 'W', field: 'beforeState', note: 'P02 (manusimport)' }]);
    // Replikker sortert på cue-nummer (W02.01 før W02.02) og taler koblet til karakteren «Nora» selv med «, 12».
    const newSceneLines = inserts.lines.filter((p) => p[1] !== 'nsc_1');
    expect(newSceneLines.map((p) => p[3])).toEqual(['W02.01', 'W02.02']);
    expect(newSceneLines[0][4]).toBe('char_nora');
    expect(newSceneLines[1][4]).toBeNull();
    // Åpent spørsmål av typen check med kildemerke.
    expect(inserts.questions[0][2]).toMatch(/^IMP-AAAAAA-01$/);
    expect(inserts.questions[0][3]).toBe('check');
    // Ingen DELETE noensinne.
    expect(pool.query.mock.calls.some(([q]) => /DELETE/i.test(String(q)))).toBe(false);
  });

  it('apply avviser ugyldig body (400)', async () => {
    const app = createApp(makePool());
    const res = await request(app)
      .post(`/api/role-room/narrative/projects/${PROJECT_ID}/scenes/import-document/apply`)
      .set('Authorization', `Bearer ${SESSION_TOKEN}`)
      .send({ sourceSha256: 'kort', create: [], update: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });
});

describe('narrative routes — Fase 8c: CI-hooks (autentisert) + bevis-nedlasting', () => {
  const hookRow = (over: Record<string, unknown> = {}) => ({ id: 'nch_123e4567-e89b-12d3-a456-426614174000', project_id: PROJECT_ID, label: 'Xcode Cloud', secret: 'sgh_' + 'a'.repeat(43), created_by: 'u1', created_at: new Date(), revoked_at: null, last_delivery_at: null, delivery_count: 0, ...over });

  it('POST ci-hooks oppretter hook og returnerer hemmeligheten én gang (aldri i GET)', async () => {
    let stored: unknown[] = [];
    const pool = makePool([
      { match: /INSERT INTO narrative_ci_hooks/, rows: (p) => { stored = p; return [hookRow({ id: p[0], label: p[2], secret: p[3] })]; } },
      { match: /FROM narrative_ci_hooks WHERE project_id/, rows: [hookRow()] },
    ]);
    const app = createApp(pool);
    const created = await request(app).post(`/api/role-room/narrative/projects/${PROJECT_ID}/ci-hooks`).set('Authorization', `Bearer ${SESSION_TOKEN}`).send({ label: 'Xcode Cloud' });
    expect(created.status).toBe(201);
    expect(created.body.data.secret).toMatch(/^sgh_/);
    expect(created.body.data.secret).toBe(stored[3]);
    expect(created.body.data.webhookPath).toMatch(/^\/api\/role-room\/narrative\/hooks\/ci\/nch_/);
    expect(created.body.data.hook.secret).toBeUndefined();
    const list = await request(app).get(`/api/role-room/narrative/projects/${PROJECT_ID}/ci-hooks`).set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(list.status).toBe(200);
    expect(list.body.data[0].secret).toBeUndefined();
    expect(list.body.data[0].label).toBe('Xcode Cloud');
  });

  it('POST ci-hooks/:id/revoke setter revoked_at; ukjent → 404', async () => {
    const pool = makePool([{ match: /UPDATE narrative_ci_hooks SET revoked_at/, rows: (p) => (p[0] === 'nch_x' ? [hookRow({ id: 'nch_x', revoked_at: new Date() })] : []) }]);
    const app = createApp(pool);
    const ok = await request(app).post(`/api/role-room/narrative/projects/${PROJECT_ID}/ci-hooks/nch_x/revoke`).set('Authorization', `Bearer ${SESSION_TOKEN}`).send({});
    expect(ok.status).toBe(200);
    expect(ok.body.data.revokedAt).toBeTruthy();
    const nf = await request(app).post(`/api/role-room/narrative/projects/${PROJECT_ID}/ci-hooks/nch_y/revoke`).set('Authorization', `Bearer ${SESSION_TOKEN}`).send({});
    expect(nf.status).toBe(404);
  });

  it('GET ci-deliveries lister leveringslogg', async () => {
    const pool = makePool([{ match: /FROM narrative_ci_deliveries WHERE project_id = \$1 ORDER BY/, rows: [{ id: 'ncd_1', hook_id: 'nch_x', project_id: PROJECT_ID, received_at: new Date(), status: 'rejected', scene_code: 'P02', gate_key: 'playthrough', gate_status: 'passed', error: 'gate_evidence_required', commit_sha: 'abc', run_url: null, payload: {} }] }]);
    const res = await request(createApp(pool)).get(`/api/role-room/narrative/projects/${PROJECT_ID}/ci-deliveries`).set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ status: 'rejected', sceneCode: 'P02', error: 'gate_evidence_required' });
  });

  it('GET assets/:id/download gir ekstern URL direkte, 404 uten fil, og ellers presignet URL', async () => {
    const pool = makePool([{ match: /FROM narrative_assets WHERE id = \$1 AND project_id = \$2/, rows: (p) => (
      p[0] === 'nas_ext' ? [{ id: 'nas_ext', name: 'x.png', storage_key: null, external_url: 'https://cdn.example/x.png' }]
      : p[0] === 'nas_none' ? [{ id: 'nas_none', name: 'y', storage_key: null, external_url: null }]
      : []) }]);
    const app = createApp(pool);
    const ext = await request(app).get(`/api/role-room/narrative/projects/${PROJECT_ID}/assets/nas_ext/download`).set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(ext.status).toBe(200);
    expect(ext.body.data.url).toBe('https://cdn.example/x.png');
    const none = await request(app).get(`/api/role-room/narrative/projects/${PROJECT_ID}/assets/nas_none/download`).set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(none.status).toBe(404);
    const missing = await request(app).get(`/api/role-room/narrative/projects/${PROJECT_ID}/assets/nas_zzz/download`).set('Authorization', `Bearer ${SESSION_TOKEN}`);
    expect(missing.status).toBe(404);
  });
});
