/**
 * Fase 7e-2: gjeste-review — delingslenke (402 uten guest_reviewers), offentlig
 * flyt GET (requiresIdentity) → sessions → GET med snapshot → comment → decision
 * (stale → 409), og at tilbakekalt/ukjent token gir 404.
 */
import express from 'express';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { createNarrativeReviewPublicRouter } from './role-room-narrative-review-public-routes.js';
import { createRoleRoomNarrativeRouter } from './role-room-narrative-routes.js';
import { hashSceneSnapshot } from './role-room-narrative-service.js';

type Handler = { match: RegExp; rows: unknown[] | ((params: unknown[]) => unknown[]) };
function makePool(handlers: Handler[] = []) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    for (const h of handlers) if (h.match.test(sql)) { const rows = typeof h.rows === 'function' ? h.rows(params) : h.rows; return { rows, rowCount: rows.length }; }
    return { rows: [], rowCount: 0 };
  });
  return { query } as unknown as Pool & { query: typeof query };
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const SESSION = 'sess-owner'; const PROJECT = 'proj-game-2026';
const snapshot = { v: 2, code: 'P01', title: 'Skoleveien', subtitle: '', location: 'Skoleveien', challenge: '', gameplayMechanic: '', environment: '', heroAssetId: null, frames: [], links: [], script: { beforeState: 'Bok', action: 'Nora tar boken', control: '', afterState: '', audio: '', changeNote: '', bridge: '', timeNote: '', knowledge: {} }, era: '1797', sourceRefs: [], lines: [{ cueId: 'W01.01', speakerLabel: 'NORA', textEn: 'Must you read all the way home?', textNb: '', sourceType: 'E', perspective: '' }] };
const HASH = hashSceneSnapshot(snapshot as never);
const linkRow = (over: Record<string, unknown> = {}) => ({
  id: 'nrl_1', project_id: PROJECT, scene_id: 'nsc_1', review_id: 'nsr_1', token_hash: sha('tok'), access_mode: 'approve', require_identity: true, expires_at: null, revoked_at: null, view_count: 0, created_by: 'u1', created_at: new Date(),
  review_snapshot: snapshot, round: 1, review_status: 'in_review', requested_by: 'u1', requested_at: new Date(), request_note: null, decided_by_user_id: null, decided_by_label: null, decided_at: null, decision_note: null, snapshot_hash: HASH,
  scene_status: 'in_review', scene_title: 'Skoleveien', scene_code: 'P01', ...over,
});
const sceneRow = () => ({ id: 'nsc_1', project_id: PROJECT, code: 'P01', title: 'Skoleveien', subtitle: '', location: 'Skoleveien', challenge: '', gameplay_mechanic: '', environment: '', status: 'in_review', assignee_user_id: 'u2', due_at: null, hero_asset_id: null, sort_order: 0, created_by: 'u1', created_at: new Date(), updated_at: new Date(), before_state: 'Bok', action: 'Nora tar boken', control: '', after_state: '', audio: '', change_note: '', bridge: '', time_note: '', knowledge: {}, era: '1797', episode_id: null, start_at: null, source_refs: [], working_id: null });

function publicApp(pool: Pool, notify = vi.fn(async () => undefined)) {
  const app = express(); app.use(express.json());
  app.use('/api/role-room/narrative/review', createNarrativeReviewPublicRouter(pool, { broadcast: () => 0, notify }));
  return app;
}
function authedApp(pool: Pool, plan: 'solo' | 'studio') {
  const app = express(); app.use(express.json());
  app.use('/api/role-room/narrative', createRoleRoomNarrativeRouter(pool, {
    activeSessions: new Map([[SESSION, { userId: 'u1', email: 'u1@x.test', name: 'U1', role: 'user', loginAt: '' }]]),
    canAccessProject: async () => true, broadcast: () => 0,
    resolveProjectPlan: async () => ({ ownerUserId: 'u1', active: plan === 'studio', plan: { slug: plan, name: plan, description: null, monthlyPriceKr: 0, yearlyPriceKr: 0, stripeMonthlyPriceId: null, stripeYearlyPriceId: null, features: plan === 'studio' ? ['scene_review', 'guest_reviewers'] : [], limits: {}, trialDays: 0, isActive: true, isFeatured: false, displayOrder: 0, createdAt: '', updatedAt: '' } }),
  }));
  return app;
}

describe('gjeste-review — delingslenker (autentisert)', () => {
  it('solo → 402 guest_reviewers; studio → 201 med råtoken én gang og /story-review/<token>', async () => {
    const pool = makePool([
      { match: /SELECT id, status FROM narrative_scene_reviews WHERE id = \$1/, rows: [{ id: 'nsr_1', status: 'in_review' }] },
      { match: /INSERT INTO narrative_review_share_links/, rows: (p) => [linkRow({ id: p[0], token_hash: p[4], access_mode: p[5], require_identity: p[6] })] },
    ]);
    const solo = await request(authedApp(pool, 'solo')).post(`/api/role-room/narrative/projects/${PROJECT}/scenes/nsc_1/reviews/nsr_1/share-links`).set('Authorization', `Bearer ${SESSION}`).send({ accessMode: 'approve' });
    expect(solo.status).toBe(402);
    expect(solo.body.feature).toBe('guest_reviewers');
    const ok = await request(authedApp(pool, 'studio')).post(`/api/role-room/narrative/projects/${PROJECT}/scenes/nsc_1/reviews/nsr_1/share-links`).set('Authorization', `Bearer ${SESSION}`).send({ accessMode: 'approve' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(ok.body.data.path).toBe(`/story-review/${ok.body.data.token}`);
    expect(ok.body.data.link).toMatchObject({ accessMode: 'approve', requireIdentity: true });
    const insert = pool.query.mock.calls.find(([s]) => /INSERT INTO narrative_review_share_links/.test(String(s)));
    expect((insert![1] as unknown[])[4]).toBe(sha(ok.body.data.token)); // kun hash lagres
  });
  it('superseded runde → 409 review_closed', async () => {
    const pool = makePool([{ match: /SELECT id, status FROM narrative_scene_reviews WHERE id = \$1/, rows: [{ id: 'nsr_1', status: 'superseded' }] }]);
    const res = await request(authedApp(pool, 'studio')).post(`/api/role-room/narrative/projects/${PROJECT}/scenes/nsc_1/reviews/nsr_1/share-links`).set('Authorization', `Bearer ${SESSION}`).send({});
    expect(res.status).toBe(409);
  });
});

describe('gjeste-review — offentlig flyt', () => {
  const resolve = (over: Record<string, unknown> = {}): Handler => ({ match: /FROM narrative_review_share_links l\s+JOIN narrative_scene_reviews r/, rows: (p) => (p[0] === sha('tok') ? [linkRow(over)] : []) });
  const reviewer = (): Handler => ({ match: /UPDATE narrative_review_sessions SET last_seen_at/, rows: (p) => (p[1] === sha('rt') ? [{ id: 'nrs_1', share_link_id: 'nrl_1', display_name: 'Kari Gjest', email: null }] : []) });

  it('ukjent/tilbakekalt token → 404; uten identitet → requiresIdentity med rundemeta men uten snapshot', async () => {
    const app = publicApp(makePool([resolve()]));
    expect((await request(app).get('/api/role-room/narrative/review/ukjent')).status).toBe(404);
    const res = await request(app).get('/api/role-room/narrative/review/tok');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ requiresIdentity: true, scene: { code: 'P01' }, round: { round: 1, status: 'in_review' }, share: { accessMode: 'approve' } });
    expect(res.body.data.snapshot).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('sessions → reviewerToken; deretter GET gir snapshot med replikker og manusfelt', async () => {
    const pool = makePool([resolve(), reviewer(), { match: /INSERT INTO narrative_review_sessions/, rows: (p) => [{ id: p[0], share_link_id: p[1], display_name: p[3], email: p[4] }] }]);
    const app = publicApp(pool);
    const s = await request(app).post('/api/role-room/narrative/review/tok/sessions').send({ displayName: 'Kari Gjest' });
    expect(s.status).toBe(201);
    expect(s.body.data.reviewer.displayName).toBe('Kari Gjest');
    expect(typeof s.body.data.reviewerToken).toBe('string');
    const insert = pool.query.mock.calls.find(([q]) => /INSERT INTO narrative_review_sessions/.test(String(q)));
    expect((insert![1] as unknown[])[2]).toBe(sha(s.body.data.reviewerToken));
    const res = await request(app).get('/api/role-room/narrative/review/tok').set('x-narrative-reviewer', 'rt');
    expect(res.body.data.requiresIdentity).toBe(false);
    expect(res.body.data.snapshot.lines[0].cueId).toBe('W01.01');
    expect(res.body.data.snapshot.script.action).toBe('Nora tar boken');
    expect(res.body.data.reviewer.displayName).toBe('Kari Gjest');
    const tooShort = await request(app).post('/api/role-room/narrative/review/tok/sessions').send({ displayName: 'K' });
    expect(tooShort.status).toBe(400);
  });

  it('kommentar krever identitet; view-lenke nekter; lagres med author reviewer:<sid>', async () => {
    const pool = makePool([resolve(), reviewer(), { match: /INSERT INTO role_room_editor_comments/, rows: [{ id: 'cmt_1', created_at: new Date() }] }]);
    const app = publicApp(pool);
    const anon = await request(app).post('/api/role-room/narrative/review/tok/editor-comments').send({ commentText: 'Hei' });
    expect(anon.status).toBe(401);
    const ok = await request(app).post('/api/role-room/narrative/review/tok/editor-comments').set('x-narrative-reviewer', 'rt').send({ commentText: 'Bra scene, men lyden mangler.' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ ok: true, id: 'cmt_1' });
    const insert = pool.query.mock.calls.find(([q]) => /INSERT INTO role_room_editor_comments/.test(String(q)));
    expect((insert![1] as unknown[])[5]).toBe('reviewer:nrs_1');
    expect((insert![1] as unknown[])[6]).toBe('Kari Gjest');
    const viewOnly = publicApp(makePool([resolve({ access_mode: 'view' }), reviewer()]));
    expect((await request(viewOnly).post('/api/role-room/narrative/review/tok/editor-comments').set('x-narrative-reviewer', 'rt').send({ commentText: 'x' })).status).toBe(403);
    const list = await request(app).get('/api/role-room/narrative/review/tok/editor-comments').set('x-narrative-reviewer', 'rt');
    expect(list.status).toBe(200);
    expect(list.body).toHaveProperty('serverTime');
  });

  it('beslutning: comment-lenke → 403; approve-lenke → 200 med decided_by reviewer + varsel; endret scene → 409 snapshot_stale', async () => {
    const notify = vi.fn(async () => undefined);
    const decidePool = (sceneOver: Record<string, unknown> = {}) => makePool([
      resolve(), reviewer(),
      { match: /FROM narrative_scene_reviews WHERE id = \$1 AND scene_id = \$2 AND project_id = \$3/, rows: [{ id: 'nsr_1', scene_id: 'nsc_1', project_id: PROJECT, round: 1, status: 'in_review', requested_by: 'u1', requested_at: new Date(), request_note: null, decided_by_user_id: null, decided_by_label: null, decided_at: null, decision_note: null, snapshot: snapshot, snapshot_hash: HASH }] },
      { match: /FROM narrative_scenes WHERE id = \$1 AND project_id = \$2 LIMIT 1/, rows: [{ ...sceneRow(), ...sceneOver }] },
      { match: /FROM narrative_scene_lines WHERE scene_id/, rows: [{ id: 'nsl_1', scene_id: 'nsc_1', project_id: PROJECT, cue_id: 'W01.01', speaker_component_id: null, speaker_label: 'NORA', perspective: '', text_en: 'Must you read all the way home?', text_nb: '', source_type: 'E', recording_status: 'none', note: '', sort_order: 0, created_by: 'u1', created_at: new Date(), updated_at: new Date() }] },
      { match: /UPDATE narrative_scene_reviews SET\s+status = \$4/, rows: (p) => [{ id: 'nsr_1', scene_id: 'nsc_1', project_id: PROJECT, round: 1, status: p[3], requested_by: 'u1', requested_at: new Date(), request_note: null, decided_by_user_id: p[4], decided_by_label: p[5], decided_at: new Date(), decision_note: p[6], snapshot_hash: HASH }] },
    ]);
    const commentOnly = publicApp(makePool([resolve({ access_mode: 'comment' }), reviewer()]));
    expect((await request(commentOnly).post('/api/role-room/narrative/review/tok/decision').set('x-narrative-reviewer', 'rt').send({ decision: 'approved' })).status).toBe(403);
    const ok = await request(publicApp(decidePool(), notify)).post('/api/role-room/narrative/review/tok/decision').set('x-narrative-reviewer', 'rt').send({ decision: 'approved', note: 'Godkjent fra publisher.' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ status: 'approved', decidedByUserId: 'reviewer:nrs_1', decidedByLabel: 'Kari Gjest' });
    await new Promise((r) => setTimeout(r, 5));
    expect(notify).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ event: 'narrative_scene_review_decided', recipientUserIds: expect.arrayContaining(['u2', 'u1']) }));
    const stale = await request(publicApp(decidePool({ action: 'Endret handling' }))).post('/api/role-room/narrative/review/tok/decision').set('x-narrative-reviewer', 'rt').send({ decision: 'approved' });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toBe('snapshot_stale');
  });
});
