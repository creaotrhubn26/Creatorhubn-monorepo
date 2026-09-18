import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Pool } from 'pg';

import {
  createPlaytestIngestHandler, createPlaytestToken, getPlaytestSummary, hashPlaytestToken, normalizePlaytestEvents, PLAYTEST_MAX_BATCH,
} from './role-room-narrative-playtest.js';

type Handler = { match: RegExp; rows: Record<string, unknown>[] | ((params: unknown[]) => Record<string, unknown>[]) };
function makePool(handlers: Handler[] = []) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    for (const h of handlers) if (h.match.test(sql)) { const rows = typeof h.rows === 'function' ? h.rows(params) : h.rows; return { rows, rowCount: rows.length }; }
    return { rows: [], rowCount: 0 };
  });
  return { query } as unknown as Pool & { query: typeof query };
}
const RAW = 'sgp_testtoken';
const tokenRow = { id: 'npk_1', project_id: 'proj' };
function ingestApp(pool: Pool, limiter?: { hit(key: string): boolean }) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.post('/playtest/events', createPlaytestIngestHandler(pool, { limiter }));
  return app;
}

describe('playtest-tokens', () => {
  it('createPlaytestToken lagrer sha256-hash, aldri råtokenet; utløp fra ttlDays', async () => {
    const pool = makePool([{ match: /INSERT INTO narrative_playtest_tokens/, rows: (p) => [{ id: p[0], project_id: p[1], label: p[2], token_hash: p[3], created_by: p[4], created_at: new Date(), expires_at: p[5], revoked_at: null, last_used_at: null, event_count: 0 }] }]);
    const { token, rawToken } = await createPlaytestToken(pool, 'proj', 'u1', { label: 'iPad testrunde', ttlDays: 30 });
    expect(rawToken).toMatch(/^sgp_/);
    const insert = pool.query.mock.calls.find(([q]) => /INSERT INTO narrative_playtest_tokens/.test(String(q)))!;
    expect(insert[1][3]).toBe(hashPlaytestToken(rawToken));
    expect(String(insert[1][3])).not.toContain(rawToken);
    expect(token.expiresAt).toBeTruthy();
    expect(token.label).toBe('iPad testrunde');
  });
});

describe('normalizePlaytestEvents', () => {
  it('dropper ugyldige hendelser stille, normaliserer scenekode og kutter stor payload', () => {
    const out = normalizePlaytestEvents([
      { sessionId: 's1', sceneCode: 'p01', event: 'enter', tMs: 0 },
      { sessionId: 's1', sceneCode: 'P01', event: 'levelup' },
      { sessionId: '', sceneCode: 'P01', event: 'exit' },
      { sessionId: 's1', sceneCode: 'P01', event: 'custom', payload: { big: 'x'.repeat(3000) } },
      'garbage',
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].sceneCode).toBe('P01');
    expect(out[1].payload).toEqual({ truncated: true });
  });
});

describe('POST /playtest/events (inntak)', () => {
  it('gyldig token → 204 og batch-INSERT + tellerbump; ukjent token → 204 uten lagring; tomt bearer → 204', async () => {
    const pool = makePool([{ match: /SELECT id, project_id FROM narrative_playtest_tokens/, rows: (p) => (p[0] === hashPlaytestToken(RAW) ? [tokenRow] : []) }]);
    const app = ingestApp(pool);
    const ok = await request(app).post('/playtest/events').set('Authorization', `Bearer ${RAW}`)
      .send({ events: [{ sessionId: 's1', sceneCode: 'P01', event: 'enter' }, { sessionId: 's1', sceneCode: 'P01', event: 'choice', connectionId: 'ncn_1', tMs: 1200 }] });
    expect(ok.status).toBe(204);
    const ins = pool.query.mock.calls.find(([q]) => /INSERT INTO narrative_playtest_events/.test(String(q)))!;
    expect(ins[1]).toHaveLength(20);
    expect(ins[1][5]).toBe('P01');
    expect(pool.query.mock.calls.some(([q]) => /UPDATE narrative_playtest_tokens SET last_used_at/.test(String(q)))).toBe(true);

    pool.query.mockClear();
    const unknown = await request(app).post('/playtest/events').set('Authorization', 'Bearer sgp_nope').send({ events: [{ sessionId: 's1', sceneCode: 'P01', event: 'enter' }] });
    expect(unknown.status).toBe(204);
    expect(pool.query.mock.calls.some(([q]) => /INSERT INTO narrative_playtest_events/.test(String(q)))).toBe(false);

    const none = await request(app).post('/playtest/events').send({ events: [] });
    expect(none.status).toBe(204);
  });

  it('batch > 500 → 413; over rate-limit → 429; enkelt-hendelse uten events-innpakning godtas', async () => {
    const pool = makePool([{ match: /SELECT id, project_id FROM narrative_playtest_tokens/, rows: [tokenRow] }]);
    const big = await request(ingestApp(pool)).post('/playtest/events').set('Authorization', `Bearer ${RAW}`)
      .send({ events: Array.from({ length: PLAYTEST_MAX_BATCH + 1 }, () => ({ sessionId: 's', sceneCode: 'P01', event: 'enter' })) });
    expect(big.status).toBe(413);
    const limited = await request(ingestApp(pool, { hit: () => true })).post('/playtest/events').set('Authorization', `Bearer ${RAW}`).send({ sessionId: 's', sceneCode: 'P01', event: 'enter' });
    expect(limited.status).toBe(429);
    const single = await request(ingestApp(pool)).post('/playtest/events').set('Authorization', `Bearer ${RAW}`).send({ sessionId: 's', sceneCode: 'P02', event: 'death' });
    expect(single.status).toBe(204);
    const ins = pool.query.mock.calls.find(([q]) => /INSERT INTO narrative_playtest_events/.test(String(q)))!;
    expect(ins[1][5]).toBe('P02');
  });
});

describe('getPlaytestSummary', () => {
  it('slår sammen per-scene, drop-off, valg og totaler; build-filter legges i alle spørringer', async () => {
    const pool = makePool([
      { match: /percentile_cont/, rows: [{ scene_code: 'P01', sessions: 4, enters: 5, exits: 3, deaths: 1, completes: 0, median_ms: '42000.5' }, { scene_code: 'P02', sessions: 2, enters: 2, exits: 2, deaths: 0, completes: 2, median_ms: null }] },
      { match: /DISTINCT ON \(session_id\)/, rows: [{ scene_code: 'P01', n: 2 }] },
      { match: /event = 'choice'/, rows: [{ scene_code: 'P01', connection_id: 'ncn_a', n: 3 }, { scene_code: 'P01', connection_id: 'ncn_b', n: 1 }] },
      { match: /array_agg\(DISTINCT build\)/, rows: [{ sessions: 4, events: 15, builds: ['b12', 'b11'] }] },
    ]);
    const s = await getPlaytestSummary(pool, 'proj', { build: 'b12', days: 14 });
    expect(s).toMatchObject({ days: 14, build: 'b12', builds: ['b11', 'b12'], sessions: 4, events: 15, worstDropOff: { sceneCode: 'P01', sessions: 2 } });
    expect(s.scenes[0]).toMatchObject({ sceneCode: 'P01', sessions: 4, medianTimeMs: 42001, dropOff: 2, choices: { ncn_a: 3, ncn_b: 1 } });
    expect(s.scenes[1]).toMatchObject({ sceneCode: 'P02', medianTimeMs: null, dropOff: 0, choices: {} });
    for (const [q, params] of pool.query.mock.calls) { expect(String(q)).toContain('AND build = $3'); expect(params).toEqual(['proj', 14, 'b12']); }
  });
});
