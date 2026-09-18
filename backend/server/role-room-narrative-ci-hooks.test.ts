import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

import {
  CI_HOOK_AUTH_HEADER,
  CI_SIGNATURE_HEADER,
  createNarrativeCiHookHandlers,
  signStoryGraphPayload,
  verifyStoryGraphSignature,
} from './role-room-narrative-ci-hooks.js';

vi.mock('./creatorhub-object-storage.js', () => ({
  putCreatorHubObject: vi.fn(async () => true),
}));

type Handler = { match: RegExp; rows: unknown[] | ((params: unknown[]) => unknown[]) };
function makePool(handlers: Handler[] = []) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    for (const h of handlers) if (h.match.test(sql)) { const rows = typeof h.rows === 'function' ? h.rows(params) : h.rows; return { rows, rowCount: rows.length }; }
    return { rows: [], rowCount: 0 };
  });
  return { query } as unknown as Pool & { query: typeof query };
}

const HOOK_ID = 'nch_123e4567-e89b-12d3-a456-426614174000';
const SECRET = 'sgh_' + 'a'.repeat(43);
const PROJECT = 'proj-game-2026';
const hookRow = { match: /FROM narrative_ci_hooks WHERE id = \$1 AND revoked_at IS NULL/, rows: [{ id: HOOK_ID, project_id: PROJECT, secret: SECRET }] };
const sceneRow = { match: /SELECT id, code FROM narrative_scenes WHERE project_id = \$1/, rows: (p: unknown[]) => (p[1] === 'P01' ? [{ id: 'nsc_p01', code: 'P01' }] : []) };
const gateUpsert = { match: /INSERT INTO narrative_scene_gates/, rows: (p: unknown[]) => [{ scene_id: p[0], project_id: p[1], gate_key: p[2], status: p[3], evidence: p[4], evidence_refs: JSON.parse(String(p[5])), checked_by: p[6], checked_at: new Date(), updated_at: new Date() }] };
const sceneSelect = { match: /FROM narrative_scenes WHERE id = \$1 AND project_id = \$2 LIMIT 1/, rows: [{ id: 'nsc_p01', project_id: PROJECT, code: 'P01', title: 'Skoleveien', status: 'in_progress', source_refs: [], knowledge: {}, created_at: new Date(), updated_at: new Date() }] };

function app(pool: Pool, broadcast = vi.fn(() => 0)) {
  const a = express();
  const h = createNarrativeCiHookHandlers(pool, { broadcast });
  a.post('/api/role-room/narrative/hooks/ci/:hookId', ...h.webhook);
  a.post('/api/role-room/narrative/hooks/ci/:hookId/evidence', ...h.evidenceUpload);
  a.use(express.json());
  return a;
}

describe('verifyStoryGraphSignature', () => {
  it('godtar riktig HMAC og avviser feil/format', () => {
    const body = Buffer.from('{"a":1}');
    expect(verifyStoryGraphSignature(body, signStoryGraphPayload(body, SECRET), SECRET)).toBe(true);
    expect(verifyStoryGraphSignature(body, signStoryGraphPayload(body, 'annen'), SECRET)).toBe(false);
    expect(verifyStoryGraphSignature(body, 'sha256=abc', SECRET)).toBe(false);
    expect(verifyStoryGraphSignature(body, undefined, SECRET)).toBe(false);
  });
});

describe('CI-webhook', () => {
  const payload = { scene: 'p01', gate: 'greybox', status: 'passed', evidence: '68 bestått, 0 feil', evidenceRefs: ['build/Prologue-P01-Final.xcresult'], commitSha: 'abcdef1', runUrl: 'https://ci.example/run/1' };

  it('setter gaten med checked_by ci:<hookId>, logger levering og broadcaster', async () => {
    const inserts: unknown[][] = [];
    const pool = makePool([hookRow, sceneRow, sceneSelect, gateUpsert, { match: /INSERT INTO narrative_ci_deliveries/, rows: (p) => { inserts.push(p); return []; } }]);
    const broadcast = vi.fn(() => 0);
    const raw = Buffer.from(JSON.stringify(payload));
    const res = await request(app(pool, broadcast))
      .post(`/api/role-room/narrative/hooks/ci/${HOOK_ID}`)
      .set('Content-Type', 'application/json').set(CI_SIGNATURE_HEADER, signStoryGraphPayload(raw, SECRET))
      .send(raw.toString('utf8'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, status: 'applied', scene: 'P01' });
    expect(res.body.gate.checkedBy).toBe(`ci:${HOOK_ID}`);
    expect(res.body.gate.evidenceRefs).toEqual(['build/Prologue-P01-Final.xcresult', 'commit:abcdef1', 'run:https://ci.example/run/1']);
    expect(inserts[0][3]).toBe('applied');
    expect(broadcast).toHaveBeenCalledWith(`narrative:${PROJECT}`, expect.objectContaining({ type: 'narrative:graph_changed', payload: expect.objectContaining({ kind: 'scene', ids: ['nsc_p01'], actorUserId: `ci:${HOOK_ID}` }) }));
  });

  it('avviser feil signatur og ukjent hook med 401 uten å skrive', async () => {
    const pool = makePool([hookRow]);
    const raw = Buffer.from(JSON.stringify(payload));
    const bad = await request(app(pool)).post(`/api/role-room/narrative/hooks/ci/${HOOK_ID}`).set('Content-Type', 'application/json').set(CI_SIGNATURE_HEADER, signStoryGraphPayload(raw, 'feil')).send(raw.toString('utf8'));
    expect(bad.status).toBe(401);
    const unknown = await request(app(makePool([]))).post(`/api/role-room/narrative/hooks/ci/nch_00000000-0000-0000-0000-000000000000`).set('Content-Type', 'application/json').set(CI_SIGNATURE_HEADER, signStoryGraphPayload(raw, SECRET)).send(raw.toString('utf8'));
    expect(unknown.status).toBe(401);
    expect(pool.query.mock.calls.some(([q]) => /INSERT/.test(String(q)))).toBe(false);
  });

  it('«bestått» uten bevis og ukjent scene logges som rejected (422)', async () => {
    const inserts: unknown[][] = [];
    const pool = makePool([hookRow, sceneRow, sceneSelect, gateUpsert, { match: /INSERT INTO narrative_ci_deliveries/, rows: (p) => { inserts.push(p); return []; } }]);
    const noEvidence = Buffer.from(JSON.stringify({ scene: 'P01', gate: 'greybox', status: 'passed' }));
    const r1 = await request(app(pool)).post(`/api/role-room/narrative/hooks/ci/${HOOK_ID}`).set('Content-Type', 'application/json').set(CI_SIGNATURE_HEADER, signStoryGraphPayload(noEvidence, SECRET)).send(noEvidence.toString('utf8'));
    expect(r1.status).toBe(422);
    expect(r1.body.error).toBe('gate_evidence_required');
    const unknownScene = Buffer.from(JSON.stringify({ scene: 'Z99', gate: 'greybox', status: 'failed' }));
    const r2 = await request(app(pool)).post(`/api/role-room/narrative/hooks/ci/${HOOK_ID}`).set('Content-Type', 'application/json').set(CI_SIGNATURE_HEADER, signStoryGraphPayload(unknownScene, SECRET)).send(unknownScene.toString('utf8'));
    expect(r2.status).toBe(422);
    expect(r2.body.error).toBe('unknown_scene');
    expect(inserts.map((p) => p[3])).toEqual(['rejected', 'rejected']);
    expect(inserts.map((p) => p[7])).toEqual(['gate_evidence_required', 'unknown_scene']);
  });

  it('ugyldig payload → 400 invalid_payload (og logget)', async () => {
    const inserts: unknown[][] = [];
    const pool = makePool([hookRow, { match: /INSERT INTO narrative_ci_deliveries/, rows: (p) => { inserts.push(p); return []; } }]);
    const raw = Buffer.from(JSON.stringify({ scene: 'P01', gate: 'ukjent', status: 'passed' }));
    const res = await request(app(pool)).post(`/api/role-room/narrative/hooks/ci/${HOOK_ID}`).set('Content-Type', 'application/json').set(CI_SIGNATURE_HEADER, signStoryGraphPayload(raw, SECRET)).send(raw.toString('utf8'));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_payload');
    expect(inserts[0][7]).toBe('invalid_payload');
  });
});

describe('CI bevis-opplasting', () => {
  it('lagrer artefakt i objektlager + narrative_assets(storage_key, kind=file) og gir asset-ref', async () => {
    const assetInserts: unknown[][] = [];
    const pool = makePool([hookRow, { match: /SELECT id, code FROM narrative_scenes WHERE project_id = \$1/, rows: [{ id: 'nsc_p01', code: 'P01' }] }, { match: /INSERT INTO narrative_assets/, rows: (p) => { assetInserts.push(p); return []; } }]);
    const res = await request(app(pool))
      .post(`/api/role-room/narrative/hooks/ci/${HOOK_ID}/evidence`)
      .set(CI_HOOK_AUTH_HEADER, `${HOOK_ID}:${SECRET}`)
      .field('scene', 'P01').field('gate', 'greybox')
      .attach('file', Buffer.from('PKxcresult'), { filename: 'Prologue P01 Final.xcresult.zip', contentType: 'application/zip' });
    expect(res.status).toBe(201);
    expect(res.body.ref).toMatch(/^asset:nas_/);
    expect(res.body.storageKey).toMatch(new RegExp(`^narrative/${PROJECT}/evidence/nsc_p01/greybox/`));
    expect(assetInserts[0][2]).toBe('Prologue_P01_Final.xcresult.zip');
    expect(String(assetInserts[0][6])).toBe(`bevis/greybox`);
  });

  it('feil hemmelighet → 401', async () => {
    const pool = makePool([hookRow]);
    const res = await request(app(pool))
      .post(`/api/role-room/narrative/hooks/ci/${HOOK_ID}/evidence`)
      .set(CI_HOOK_AUTH_HEADER, `${HOOK_ID}:feil`)
      .field('scene', 'P01').field('gate', 'greybox')
      .attach('file', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(401);
  });
});
