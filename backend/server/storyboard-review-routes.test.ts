import { createHash } from 'node:crypto';
import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  buildStoryboardReviewSnapshot,
  diffStoryboardReviewSnapshots,
  mergeStoryboardSnapshotIntoCurrentScenes,
  storyboardReviewHash,
  registerStoryboardReviewRoutes,
} from './storyboard-review-routes.js';

function routeHandler(router: Router, method: string, path: string) {
  const layer = (router as any).stack.find((candidate: any) =>
    candidate.route?.path === path && candidate.route.methods[method]);
  return layer.route.stack.at(-1).handle as (request: any, response: any, next: any) => Promise<void>;
}

function response() {
  const result: any = { statusCode: 200, body: undefined, headers: {} };
  result.status = (code: number) => { result.statusCode = code; return result; };
  result.json = (body: unknown) => { result.body = body; return result; };
  result.setHeader = (name: string, value: string) => { result.headers[name] = value; return result; };
  return result;
}

const pass = (_request: unknown, _response: unknown, next: () => void) => next();
const unusedManuscripts = {} as any;

function source() {
  return {
    manuscriptId: 'manuscript-1',
    manuscript: { id: 'manuscript-1', projectId: 'project-1', title: 'TROLL', version: 7 },
    scenes: [{
      id: 'scene-1',
      heading: 'INT. TOG — NATT',
      description: 'Nora ser et troll.',
      locationName: 'Togsett A',
      castIds: ['nora'],
      storyboardFrames: [{
        id: 'frame-a', shotNumber: '1A', description: 'Nora i vinduet', duration: 2,
        scriptLineRange: [10, 12], drawingData: { strokes: '[{"x":1}]' },
      }],
      storyboardVersionLog: [{ v: 1, summary: 'thumbnail pass' }],
    }],
    dialogue: [{ id: 'line-1', sceneId: 'scene-1', lineNumber: 10, characterName: 'Nora', dialogueText: 'Se!' }],
  };
}

describe('storyboard review snapshots', () => {
  it('ships tenant-scoped immutable SQL with hashed tokens and append-only decisions', () => {
    const sql = readFileSync(new URL('../migrations/0590_storyboard_review_rounds.sql', import.meta.url), 'utf8');
    expect(sql).toContain('FOREIGN KEY (manuscript_id, project_id)');
    expect(sql).toContain('token_hash CHAR(64) NOT NULL UNIQUE');
    expect(sql).toContain('storyboard review snapshots are immutable');
    expect(sql).toContain('storyboard review decisions are append-only');
    expect(sql).not.toMatch(/\btoken\s+(?:TEXT|VARCHAR)/i);
    expect(registerStoryboardReviewRoutes.toString()).toContain('rejectIfRateLimited');
    expect(registerStoryboardReviewRoutes.toString()).toContain('Cache-Control');
    expect(registerStoryboardReviewRoutes.toString()).toContain('no-store');
  });

  it('is canonical and detached from mutable manuscript state', () => {
    const input = source();
    const snapshot = buildStoryboardReviewSnapshot(input);
    const hash = storyboardReviewHash(snapshot);
    input.scenes[0].storyboardFrames[0].description = 'mutated later';

    expect(snapshot.scenes[0].storyboardFrames[0].description).toBe('Nora i vinduet');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(storyboardReviewHash({ b: 2, a: 1 })).toBe(storyboardReviewHash({ a: 1, b: 2 }));
  });

  it('reports added, removed, moved and changed frames with script impact', () => {
    const before = buildStoryboardReviewSnapshot(source());
    const changed = source();
    changed.scenes[0].description = 'Nora ser to troll.';
    changed.scenes[0].storyboardFrames = [
      { id: 'frame-b', shotNumber: '1B', description: 'Reaksjon', duration: 1, scriptLineRange: [13, 13], drawingData: { strokes: '[]' } },
      { ...changed.scenes[0].storyboardFrames[0], description: 'Nora i et knust vindu' },
    ];
    const current = buildStoryboardReviewSnapshot(changed);
    const diff = diffStoryboardReviewSnapshots(before, current);

    expect(diff.scriptChanged).toBe(true);
    expect(diff.addedFrameIds).toEqual(['frame-b']);
    expect(diff.removedFrameIds).toEqual([]);
    expect(diff.changedFrameIds).toEqual(['frame-a']);
    expect(diff.movedFrameIds).toEqual(['frame-a']);
    expect(diff.impactedScriptLineRanges).toContainEqual([10, 12]);
    expect(diff.impactedScriptLineRanges).toContainEqual([13, 13]);
  });

  it('restores only storyboard-owned fields and skips scenes deleted after review', () => {
    const baselineSource = source();
    baselineSource.scenes.push({
      id: 'scene-deleted', heading: 'EXT. SKOG — NATT', description: 'Gammel scene',
      locationName: 'Skog', castIds: [], storyboardFrames: [{
        id: 'frame-old', shotNumber: '2A', description: 'Skog', duration: 3,
        scriptLineRange: [20, 21], drawingData: { strokes: '[]' },
      }], storyboardVersionLog: [],
    });
    const snapshot = buildStoryboardReviewSnapshot(baselineSource);
    const currentScenes = [{
      ...source().scenes[0],
      description: 'NYTT MANUS SOM IKKE MÅ OVERSKRIVES',
      locationName: 'Togsett B',
      castIds: ['nora', 'erik'],
      productionBreakdown: { stunt: true },
      storyboardFrames: [{ id: 'frame-new', description: 'working copy' }],
    }];

    const restored = mergeStoryboardSnapshotIntoCurrentScenes(currentScenes, snapshot);
    expect(restored.scenes[0]).toMatchObject({
      description: 'NYTT MANUS SOM IKKE MÅ OVERSKRIVES',
      locationName: 'Togsett B',
      castIds: ['nora', 'erik'],
      productionBreakdown: { stunt: true },
    });
    expect(restored.scenes[0].storyboardFrames[0].id).toBe('frame-a');
    expect(restored.restoredSceneIds).toEqual(['scene-1']);
    expect(restored.skippedSceneIds).toEqual(['scene-deleted']);
  });
});

describe('storyboard review share security', () => {
  it('rate-limits unauthenticated review traffic before repeated database lookups', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const router = Router();
    registerStoryboardReviewRoutes(router, { query } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
    });
    const handler = routeHandler(router, 'get', '/storyboard-review/:token');
    let last = response();
    for (let attempt = 0; attempt < 241; attempt += 1) {
      last = response();
      await handler({ params: { token: 'missing' }, ip: '203.0.113.42', header: () => undefined }, last,
        (error: unknown) => { throw error; });
    }
    expect(query).toHaveBeenCalledTimes(240);
    expect(last.statusCode).toBe(429);
    expect(last.body).toEqual({ error: 'rate_limited' });
    expect(Number(last.headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('returns a raw share token once but sends only its hash to PostgreSQL', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'round-1', status: 'in_review' }] })
      .mockImplementationOnce(async (_sql: string, values: unknown[]) => ({ rows: [{
        id: 'share-1', review_round_id: 'round-1', access_mode: 'approve',
        require_identity: true, expires_at: null, created_at: new Date('2026-09-12T12:00:00Z'),
        storedHash: values[3],
      }] }));
    const router = Router();
    registerStoryboardReviewRoutes(router, { query } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
    });
    const handler = routeHandler(router, 'post',
      '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-rounds/:roundId/share-links');
    const res = response();
    await handler({
      params: { projectId: 'project-1', manuscriptId: 'manuscript-1', roundId: 'round-1' },
      body: { accessMode: 'approve', requireIdentity: true }, userId: 'owner-1',
    }, res, (error: unknown) => { throw error; });

    const raw = res.body.data.token;
    const insertedValues = query.mock.calls[1][1];
    expect(res.statusCode).toBe(201);
    expect(raw).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(insertedValues[3]).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(insertedValues).not.toContain(raw);
    expect(JSON.stringify(res.body)).not.toContain(insertedValues[3]);
  });

  it('binds sign-off to the exact hash and locks all later decisions', async () => {
    let status = 'in_review';
    let inserts = 0;
    let firstLookupHash = '';
    const roundRow = () => ({
      id: 'round-1', project_id: 'project-1', manuscript_id: 'manuscript-1', version: 2,
      label: 'Client approval', summary: null, snapshot: buildStoryboardReviewSnapshot(source()),
      snapshot_hash: 'a'.repeat(64), script_fingerprint: 'b'.repeat(64), status,
      frame_count: 1, total_duration_seconds: 2, created_by: 'owner-1', approved_by: null,
      submitted_at: new Date('2026-09-12T12:00:00Z'), approved_at: null,
      created_at: new Date('2026-09-12T12:00:00Z'), share_link_id: 'share-1',
      share_access_mode: 'approve', share_require_identity: true,
      share_expires_at: null, share_created_at: new Date('2026-09-12T12:00:00Z'),
    });
    const query = vi.fn(async (sql: string, values: unknown[]) => {
      if (sql.includes('JOIN storyboard_review_rounds')) {
        firstLookupHash ||= String(values[0]);
        return { rows: [roundRow()] };
      }
      if (sql.includes('UPDATE storyboard_review_sessions')) {
        return { rows: [{ id: 'reviewer-1', display_name: 'Kari Klient', email: 'kari@example.com' }] };
      }
      throw new Error(`unexpected pool query: ${sql}`);
    });
    const client = {
      release: vi.fn(),
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') return { rows: [] };
        if (sql.includes('FOR UPDATE')) return { rows: [{ id: 'round-1', status, snapshot_hash: 'a'.repeat(64) }] };
        if (sql.includes('INSERT INTO storyboard_review_decisions')) {
          inserts += 1;
          return { rows: [{ id: `decision-${inserts}`, review_round_id: 'round-1',
            decision: values?.[1], expected_snapshot_hash: values?.[2],
            actor_display_name: 'Kari Klient', note: null,
            created_at: new Date('2026-09-12T12:01:00Z') }] };
        }
        if (sql.includes('UPDATE storyboard_review_rounds')) { status = String(values?.[1]); return { rows: [] }; }
        throw new Error(`unexpected client query: ${sql}`);
      }),
    };
    const router = Router();
    registerStoryboardReviewRoutes(router, { query, connect: async () => client } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
    });
    const handler = routeHandler(router, 'post', '/storyboard-review/:token/decisions');

    const wrong = response();
    await handler({ params: { token: 'raw-share-token' }, body: {
      decision: 'approved', expectedSnapshotHash: 'c'.repeat(64),
    }, header: () => 'raw-reviewer-token' }, wrong, (error: any) => {
      wrong.status(error.status || 500).json({ error: error.message });
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrong.statusCode).toBe(409);
    expect(inserts).toBe(0);

    const approved = response();
    await handler({ params: { token: 'raw-share-token' }, body: {
      decision: 'approved', expectedSnapshotHash: 'a'.repeat(64),
    }, header: () => 'raw-reviewer-token' }, approved, (error: any) => {
      approved.status(error.status || 500).json({ error: error.message });
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(approved.statusCode).toBe(201);
    expect(inserts).toBe(1);
    expect(status).toBe('approved');

    const retry = response();
    await handler({ params: { token: 'raw-share-token' }, body: {
      decision: 'changes_requested', expectedSnapshotHash: 'a'.repeat(64),
    }, header: () => 'raw-reviewer-token' }, retry, (error: any) => {
      retry.status(error.status || 500).json({ error: error.message });
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(retry.statusCode).toBe(409);
    expect(inserts).toBe(1);
    expect(firstLookupHash).toBe(createHash('sha256').update('raw-share-token').digest('hex'));
    expect(firstLookupHash).not.toBe('raw-share-token');
  });
});
