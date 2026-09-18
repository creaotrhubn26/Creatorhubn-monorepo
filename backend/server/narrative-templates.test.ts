import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

import { applyProjectTemplate, buildWfuSampleFixture, templateFixture } from './narrative-templates.js';

const seedCalls: Array<{ at: number; scenes: number }> = [];
vi.mock('./narrative-fixture-seed.js', async (orig) => {
  const mod = await orig<typeof import('./narrative-fixture-seed.js')>();
  return { ...mod, seedStoryGraphFixture: vi.fn(async (_db: unknown, _pid: string, _uid: string, fx: { scenes: unknown[] }) => { seedCalls.push({ at: Date.now(), scenes: fx.scenes.length }); return { scenes: { inserted: fx.scenes.length, updated: 0, skipped: 0 } }; }) };
});

describe('narrative-templates (Fase 8g)', () => {
  it('wfu-sample = P01–P03 uten replikker/gater/oppgaver, uten forfatterfasit; kun refererte komponenter/episoder/kilder', () => {
    const fx = buildWfuSampleFixture();
    expect(fx.scenes.map((s) => s.code)).toEqual(['P01', 'P02', 'P03']);
    for (const s of fx.scenes) { expect(s.lines).toBeUndefined(); expect(s.gates).toBeUndefined(); expect(s.tasks).toBeUndefined(); expect(s.status).toBe('idea'); }
    expect(fx.openQuestions).toEqual([]); expect(fx.milestones).toEqual([]);
    expect(fx.components.length).toBeGreaterThan(0);
    for (const c of fx.components) { expect((c.profile as Record<string, unknown>).authorTruth).toBeUndefined(); expect((c.profile as Record<string, unknown>).memoryTrack).toBeUndefined(); }
    const referenced = new Set(fx.scenes.flatMap((s) => s.components ?? []));
    for (const c of fx.components) expect(referenced.has(c.customId)).toBe(true);
    expect(fx.platformTargets).toHaveLength(1);
  });

  it('demo-adventure har 1 episode, 6 scener, 4 karakterer, 2 lokasjoner; blank = null', () => {
    const fx = templateFixture('demo-adventure')!;
    expect(fx.episodes).toHaveLength(1);
    expect(fx.scenes).toHaveLength(6);
    expect(fx.components.filter((c) => c.kind === 'character')).toHaveLength(4);
    expect(fx.components.filter((c) => c.kind === 'location')).toHaveLength(2);
    expect(templateFixture('blank')).toBeNull();
  });

  it('applyProjectTemplate: blank rører ikke DB; ellers revisjon «Før mal» før seed', async () => {
    const query = vi.fn(async (sql: string, params: unknown[] = []) => {
      if (/INSERT INTO narrative_revisions/.test(sql)) return { rows: [{ id: params[0], project_id: params[1], label: params[2], created_by: params[4], created_at: new Date(), snapshot: {} }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const pool = { query } as unknown as Pool;
    expect(await applyProjectTemplate(pool, 'proj', 'u1', 'blank')).toEqual({ template: 'blank', revisionId: null, report: null });
    expect(query).not.toHaveBeenCalled();
    const r = await applyProjectTemplate(pool, 'proj', 'u1', 'demo-adventure');
    expect(r.revisionId).toMatch(/^nrv_/);
    expect(query.mock.calls.some(([q]) => /INSERT INTO narrative_revisions/.test(String(q)))).toBe(true);
    expect(seedCalls).toHaveLength(1);
    expect(seedCalls[0].scenes).toBe(6);
    expect(r.report?.scenes.inserted).toBe(6);
  });
});
