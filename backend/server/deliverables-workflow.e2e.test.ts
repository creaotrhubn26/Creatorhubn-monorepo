// @ts-nocheck
/**
 * E2E workflow — Leveranse (ekte ruter, mock-pool):
 *   1. Opprett leveranse (+ type)
 *   2. ML type-gjett lærer fra opprettelsen
 *   3. Sjekkliste legges til (og læres pr. type)
 *   4. Forslag til sjekkliste hentes (inneholder lært punkt)
 *   5. Filer fra Media vedlegges
 *   6. Leveransen markeres som levert
 *   7. GET bekrefter hele tilstanden
 *
 * Mock-poolen dispatcher på SQL-fragmenter og holder tilstand i minnet —
 * ingen DB kreves.
 */
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupProjectWorkspaceRoutes } from './project-workspace-routes.js';
import { deleteCaptureObjects } from './capture-upload-service.js';

vi.mock('./capture-upload-service.js', async (importOriginal) => {
  const orig: any = await importOriginal();
  return { ...orig, deleteCaptureObjects: vi.fn(async () => ({ deleted: 0, failed: 0 })) };
});

function createMockPool(store: any) {
  return {
    query: async (sql: string, params?: any[]) => {
      const s = sql;
      // canAccessProject → eier-sjekk gir alltid innpass
      if (s.includes('FROM projects WHERE id = $1 AND user_id = $2')) {
        return { rows: [{ id: 'p1' }], rowCount: 1 };
      }
      // POST leveranse (VALUES $1..$6)
      if (s.includes('INSERT INTO project_workspace_deliverables')) {
        const row = {
          id: `d${store.deliverables.length + 1}`, project_id: params![0], title: params![1],
          type: params![2], status: params![3] || 'not_started', due_date: params![4] || null,
          checklist: [], files: [],
        };
        store.deliverables.push(row);
        return { rows: [row], rowCount: 1 };
      }
      // Asset-sletting: PRUNE vedlegg i leveranser (må komme FØR generell UPDATE-branch)
      if (s.includes('project_workspace_deliverables') && s.includes('jsonb_agg')) {
        const assetId = params![0];
        let n = 0;
        for (const d of store.deliverables) {
          if (Array.isArray(d.files)) {
            const prev = d.files.length;
            d.files = d.files.filter((f: any) => !(f?.refId && String(f.refId) === String(assetId)));
            if (d.files.length !== prev) n += 1;
          }
        }
        return { rows: [], rowCount: n };
      }
      // Asset-rad (for sletting) — scoped via session-join
      if (s.includes('capture_assets') && s.includes('preview_key')) {
        const a = store.assets.find((x: any) => x.id === params![0]);
        return { rows: a ? [a] : [] };
      }
      if (s.includes('SELECT audio_key FROM capture_reviews')) return { rows: [] };
      if (s.includes('DELETE FROM asset_refs')) {
        store.refs = store.refs.filter((r: any) => r.master_id !== params![0]);
        return { rows: [], rowCount: 0 };
      }
      if (s.includes('capture_revision_requests') || s.includes('project_photo_review') || s.includes('project_photo_comments') || s.includes('generative_ai_jobs') || s.includes('shot_lists')) {
        return { rows: [], rowCount: 0 };
      }
      if (s.includes('DELETE FROM capture_assets')) {
        const before = store.assets.length;
        store.assets = store.assets.filter((x: any) => x.id !== params![0]);
        return { rows: [], rowCount: before - store.assets.length };
      }
      // PATCH leveranse (SET ... WHERE id = $5 ...)
      if (s.includes('UPDATE project_workspace_deliverables')) {
        const d = store.deliverables.find((x: any) => x.id === params![4]);
        if (!d) return { rows: [], rowCount: 0 };
        if (params![0] != null) d.title = params![0];
        if (params![1] != null) d.type = params![1];
        if (params![2] != null) d.status = params![2];
        if (params![3] != null) d.due_date = params![3];
        if (Array.isArray(params![6])) d.checklist = params![6];
        if (Array.isArray(params![7])) d.files = params![7];
        return { rows: [d], rowCount: 1 };
      }
      // Gammel rad før PATCH (for læring av nye sjekkliste-punkter).
      // Kopi! `old` og `d` må IKKE dele objektreferanse (slik ekte DB-rader er skilt).
      if (s.includes('SELECT title, type, checklist FROM project_workspace_deliverables')) {
        const d = store.deliverables.find((x: any) => x.id === params![0]);
        return { rows: d ? [{ ...d }] : [] };
      }
      if (s.includes('FROM project_workspace_deliverables')) {
        return { rows: store.deliverables, rowCount: store.deliverables.length };
      }
      // ML: type-gjett — returner lærte ord
      if (s.includes('deliverable_type_learn') && s.includes('SELECT word, type, n FROM')) {
        const words = params![1] || [];
        const out = [];
        for (const w of words) {
          const t = store.typeLearn[w];
          if (t) out.push({ word: w, type: t, n: 1 });
        }
        return { rows: out };
      }
      if (s.includes('INSERT INTO deliverable_type_learn')) {
        store.typeLearn[params![1]] = params![2];
        return { rowCount: 1 };
      }
      if (s.includes('deliverable_check_learn') && s.includes('SELECT label, SUM(n)::int n')) {
        const type = params![1];
        return { rows: (store.checkLearn[type] || []).map((label: string) => ({ label, n: 1 })) };
      }
      if (s.includes('INSERT INTO deliverable_check_learn')) {
        const type = params![1], label = params![2];
        store.checkLearn[type] = store.checkLearn[type] || [];
        if (!store.checkLearn[type].includes(label)) store.checkLearn[type].push(label);
        return { rowCount: 1 };
      }
      // Alt annet (ensureSchema, m.m.) → no-op
      return { rows: [], rowCount: 0 };
    },
  };
}

function buildApp(store: any) {
  const app = express();
  app.use(express.json());
  setupProjectWorkspaceRoutes({
    app,
    pool: createMockPool(store),
    requireUserSession: (req: any, res: any) => {
      if (req.headers['x-ok'] === 'true') return { userId: 'u1' };
      res.status(401).json({ error: 'unauthorized' });
      return null;
    },
  } as any);
  return app;
}

describe('Deliverables E2E workflow', () => {
  const store = { deliverables: [] as any[], typeLearn: {} as any, checkLearn: {} as any, assets: [] as any[], refs: [] as any[] };
  const app = buildApp(store);

  it('avviser uten sesjon (401)', async () => {
    const res = await request(app).post('/api/projects/p1/deliverables').send({ title: 'X', type: 'Video' });
    expect(res.status).toBe(401);
  });

  it('oppretter leveranse med type', async () => {
    const res = await request(app)
      .post('/api/projects/p1/deliverables')
      .set('x-ok', 'true')
      .send({ title: 'Teaser trailer (60s)', type: 'Video' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.title).toContain('Teaser');
    store.id = res.body.id;
  });

  it('ML type-gjett lærer fra tittelen og foreslår Video', async () => {
    const res = await request(app)
      .post('/api/projects/p1/deliverables/guess-type')
      .set('x-ok', 'true')
      .send({ title: 'Teaser trailer 60 sek' });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('Video');
    expect(res.body.confidence).toBeGreaterThan(0);
  });

  it('legger til sjekkliste — og punktet læres for typen', async () => {
    const res = await request(app)
      .patch(`/api/projects/p1/deliverables/${store.id}`)
      .set('x-ok', 'true')
      .send({ checklist: [{ id: 'c1', label: 'Eksport klar', done: false }, { id: 'c2', label: 'Lydnivåer sjekket', done: true }] });
    expect(res.status).toBe(200);
    expect(res.body.checklist).toHaveLength(2);

    // learnDeliverableCheck kjøres fire-and-forget — la den fullføre før suggest.
    await new Promise((r) => setTimeout(r, 0));

    const sug = await request(app)
      .post('/api/projects/p1/deliverables/suggest-checklist')
      .set('x-ok', 'true')
      .send({ type: 'Video' });
    expect(sug.status).toBe(200);
    expect(sug.body.labels).toContain('Eksport klar');
  });

  it('vedlegger filer fra Media', async () => {
    const res = await request(app)
      .patch(`/api/projects/p1/deliverables/${store.id}`)
      .set('x-ok', 'true')
      .send({ files: [{ kind: 'capture', refId: 'asset-123' }, { kind: 'uploaded', refId: 'img-1' }] });
    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(2);
    expect(res.body.files[0]).toMatchObject({ kind: 'capture', refId: 'asset-123' });
  });

  it('sanitiserer files: kun kjente felt, objekter uten kind droppes', async () => {
    const res = await request(app)
      .patch(`/api/projects/p1/deliverables/${store.id}`)
      .set('x-ok', 'true')
      .send({ files: [{ kind: 'media', refId: 'a1', name: 'IMG.jpg', url: 'https://x/y.jpg', at: '2026-01-01', hack: '<script>', nested: { evil: 1 } }, { refId: 'no-kind' }, 'just-a-string', { kind: 'media', refId: 'b2' }] });
    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(2);
    expect(res.body.files[0]).toEqual({ kind: 'media', refId: 'a1', name: 'IMG.jpg', url: 'https://x/y.jpg', at: '2026-01-01' });
    expect(res.body.files[1]).toEqual({ kind: 'media', refId: 'b2', name: null, url: null, at: null });
  });

  it('fysisk sletting av asset: R2-keys, refs og vedlegg i leveranser', async () => {
    store.assets.push({ id: 'a1', preview_key: 'capture/u1/s1/a1/preview/x.jpg', full_key: null, raw_key: 'capture/u1/s1/a1/raw/y.arw', auto_cleaned_key: 'capture-cleaned/s1/a1.jpg', original_filename: 'IMG.jpg', session_id: 's1' });
    store.refs.push({ id: 'r1', master_id: 'a1', collection: 'klient' });
    const mk = await request(app).post('/api/projects/p1/deliverables').set('x-ok', 'true').send({ title: 'Med vedlegg', type: 'Foto' });
    await request(app)
      .patch(`/api/projects/p1/deliverables/${mk.body.id}`)
      .set('x-ok', 'true')
      .send({ files: [{ kind: 'media', refId: 'a1', name: 'IMG.jpg', url: 'u', at: '2026' }, { kind: 'media', refId: 'zz', name: 'annet.jpg', url: 'u', at: '2026' }] });

    const res = await request(app).delete('/api/projects/p1/media/assets/a1').set('x-ok', 'true');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, removed: 1 });
    expect(store.assets).toHaveLength(0);
    expect(store.refs).toHaveLength(0);
    expect(deleteCaptureObjects).toHaveBeenCalledTimes(1);
    const keys = (deleteCaptureObjects as any).mock.calls[0][0] as string[];
    expect(keys).toContain('capture/u1/s1/a1/preview/x.jpg');
    expect(keys).toContain('capture/u1/s1/a1/raw/y.arw');
    expect(keys).toContain('capture-cleaned/s1/a1.jpg');
    const g = await request(app).get('/api/projects/p1/deliverables').set('x-ok', 'true');
    const d2 = g.body.deliverables.find((d: any) => d.id === mk.body.id);
    expect(d2.files).toHaveLength(1);
    expect(d2.files[0].refId).toBe('zz');
  });

  it('markerer leveransen som levert', async () => {
    const res = await request(app)
      .patch(`/api/projects/p1/deliverables/${store.id}`)
      .set('x-ok', 'true')
      .send({ status: 'delivered' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');
  });

  it('GET bekrefter hele tilstanden', async () => {
    const res = await request(app).get('/api/projects/p1/deliverables').set('x-ok', 'true');
    expect(res.status).toBe(200);
    const d = res.body.deliverables.find((x: any) => x.id === store.id);
    expect(d.status).toBe('delivered');
    expect(d.checklist).toHaveLength(2);
    // a1 ble prunet fra leveransen ved fysisk asset-sletting — kun b2 gjenstår.
    expect(d.files).toHaveLength(1);
    expect(d.files[0]).toMatchObject({ kind: 'media', refId: 'b2' });
    expect(d.type).toBe('Video');
  });
});
