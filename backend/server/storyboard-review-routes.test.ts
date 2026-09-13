import { createHash } from 'node:crypto';
import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  buildStoryboardReviewSnapshot,
  buildStoryboardReviewChangePreview,
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
    const sql = readFileSync(new URL('../migrations/0592_storyboard_review_rounds.sql', import.meta.url), 'utf8');
    const queueSql = readFileSync(new URL('../migrations/0595_storyboard_review_resolution_queue.sql', import.meta.url), 'utf8');
    const annotationSql = readFileSync(new URL('../migrations/0596_storyboard_review_annotations.sql', import.meta.url), 'utf8');
    const changeSql = readFileSync(new URL('../migrations/0601_storyboard_review_comment_changes.sql', import.meta.url), 'utf8');
    expect(sql).toContain('FOREIGN KEY (manuscript_id, project_id)');
    expect(sql).toContain('token_hash CHAR(64) NOT NULL UNIQUE');
    expect(sql).toContain('storyboard review snapshots are immutable');
    expect(sql).toContain('storyboard review decisions are append-only');
    expect(sql).toContain("TG_OP = 'DELETE' AND pg_trigger_depth() > 1");
    expect(sql).not.toMatch(/\btoken\s+(?:TEXT|VARCHAR)/i);
    expect(registerStoryboardReviewRoutes.toString()).toContain('rejectIfRateLimited');
    expect(registerStoryboardReviewRoutes.toString()).toContain('Cache-Control');
    expect(registerStoryboardReviewRoutes.toString()).toContain('no-store');
    expect(queueSql).toContain('assigned_to VARCHAR(180)');
    expect(queueSql).toContain('resolved_in_round_id');
    expect(queueSql).toContain('carried_from_comment_id');
    expect(queueSql).toContain("WHERE status = 'open'");
    expect(annotationSql).toContain("ADD COLUMN IF NOT EXISTS annotations JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(annotationSql).toContain('jsonb_array_length(annotations) <= 12');
    expect(annotationSql).toContain('pg_column_size(annotations) <= 65536');
    expect(changeSql).toContain('FOREIGN KEY (review_round_id, project_id, manuscript_id)');
    expect(changeSql).toContain('FOREIGN KEY (comment_id, review_round_id)');
    expect(changeSql).toContain('storyboard review comment changes are append-only');
    expect(changeSql).toContain('storyboard_review_comment_changes_single_undo_idx');
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

  it('builds a scoped preview without mutating the working frame', () => {
    const frame = source().scenes[0].storyboardFrames[0];
    const preview = buildStoryboardReviewChangePreview({
      projectId: 'project-1', manuscriptId: 'manuscript-1', roundId: 'round-1',
      commentId: 'comment-1', frameId: 'frame-a', sceneId: 'scene-1', frame,
      field: 'duration', value: 3.5,
    });
    expect(preview).toMatchObject({
      fieldLabel: 'Varighet', beforeDisplayValue: '2.0 sek',
      afterDisplayValue: '3.5 sek', forwardPatch: { duration: 3.5 },
      inversePatch: { duration: 2 },
    });
    expect(preview.previewHash).toMatch(/^[0-9a-f]{64}$/);
    expect(frame.duration).toBe(2);
  });
});

describe('storyboard review share security', () => {
  it('publishes a new review round to teammates while keeping it read for the creator', async () => {
    const current = source();
    const manuscriptsService = {
      getManuscript: vi.fn().mockResolvedValue(current.manuscript),
      getScenes: vi.fn().mockResolvedValue(current.scenes),
      getDialogue: vi.fn().mockResolvedValue(current.dialogue),
    };
    const createdAt = new Date('2026-09-12T12:00:00Z');
    const client = {
      release: vi.fn(),
      query: vi.fn(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
        if (sql.includes('ORDER BY version DESC LIMIT 1')) return { rows: [{ id: 'round-2' }] };
        if (sql.includes("SET status = 'superseded'")) return { rows: [] };
        if (sql.includes('COALESCE(MAX(version)')) return { rows: [{ version: 3 }] };
        if (sql.includes('INSERT INTO storyboard_review_rounds')) return { rows: [{
          id: 'round-3', project_id: 'project-1', manuscript_id: 'manuscript-1', version: 3,
          label: 'Kundegjennomgang', summary: 'Ny kameradekning',
          snapshot: buildStoryboardReviewSnapshot(current), snapshot_hash: 'a'.repeat(64),
          script_fingerprint: 'b'.repeat(64), status: 'in_review', frame_count: 1,
          total_duration_seconds: 2, created_by: 'owner-1', approved_by: null,
          submitted_at: createdAt, approved_at: null, created_at: createdAt,
        }] };
        if (sql.includes('INSERT INTO storyboard_review_comments')) {
          expect(sql).toContain("WHERE review_round_id = $2 AND status = 'open'");
          expect(sql).toContain('anchor_x, anchor_y, annotations');
          return { rows: [{ id: 'carried-1' }, { id: 'carried-2' }], rowCount: 2 };
        }
        throw new Error(`unexpected client query: ${sql}`);
      }),
    };
    const upsertNotification = vi.fn().mockResolvedValue(undefined);
    const router = Router();
    registerStoryboardReviewRoutes(router, { connect: async () => client } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: manuscriptsService as any,
      upsertNotification,
    });
    const handler = routeHandler(router, 'post',
      '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-rounds');
    const res = response();
    await handler({
      params: { projectId: 'project-1', manuscriptId: 'manuscript-1' },
      body: { label: 'Kundegjennomgang', summary: 'Ny kameradekning' }, userId: 'owner-1',
    }, res, (error: unknown) => { throw error; });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.carriedCommentCount).toBe(2);
    expect(upsertNotification).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1', eventType: 'storyboard_review_round_created',
      linkedEntityId: 'round-3', initiallyReadByUserId: 'owner-1',
      metadata: expect.objectContaining({
        inboxType: 'storyboard_review', manuscriptId: 'manuscript-1',
        reviewRoundId: 'round-3', roundVersion: 3,
      }),
    }));
  });

  it('returns a manuscript-scoped inbox with per-user unread state', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      id: 'notification-1', event_type: 'storyboard_review_comment_added',
      title: 'Kari kommenterte storyboard v2', message: 'Hold bildet.',
      metadata: { reviewRoundId: 'round-1', roundVersion: 2, manuscriptId: 'manuscript-1',
        frameId: 'frame-a', actorDisplayName: 'Kari' },
      created_at: new Date('2026-09-12T12:01:00Z'), read: false, read_at: null,
    }] });
    const router = Router();
    registerStoryboardReviewRoutes(router, { query } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
    });
    const handler = routeHandler(router, 'get',
      '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-inbox');
    const res = response();
    await handler({
      params: { projectId: 'project-1', manuscriptId: 'manuscript-1' }, userId: 'user-1',
    }, res, (error: unknown) => { throw error; });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("notification.inbox_type = 'storyboard_review'"),
      ['project-1', 'manuscript-1', 'user-1']);
    expect(res.body.data.unreadCount).toBe(1);
    expect(res.body.data.items[0]).toMatchObject({
      reviewRoundId: 'round-1', roundVersion: 2, frameId: 'frame-a', read: false,
    });
  });

  it('does not mark a notification read outside the requested manuscript scope', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const router = Router();
    registerStoryboardReviewRoutes(router, { query } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
    });
    const handler = routeHandler(router, 'post',
      '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-inbox/:notificationId/read');
    const res = response();
    await handler({ params: {
      projectId: 'project-1', manuscriptId: 'manuscript-1', notificationId: 'notification-other',
    }, userId: 'user-1' }, res, (error: unknown) => { throw error; });

    expect(res.statusCode).toBe(404);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(['notification-other', 'project-1', 'manuscript-1']);
  });

  it('updates resolution metadata only through the scoped round and validates the fixed revision', async () => {
    const now = new Date('2026-09-12T12:05:00Z');
    const fixedRoundId = '00000000-0000-4000-8000-000000000002';
    const query = vi.fn(async (sql: string, values: unknown[]) => {
      if (sql.includes('SELECT id, version, status FROM storyboard_review_rounds')) {
        return { rows: [{ id: 'round-1', version: 2 }] };
      }
      if (sql.includes('SELECT id FROM storyboard_review_rounds')) {
        expect(values).toEqual([fixedRoundId, 'project-1', 'manuscript-1']);
        return { rows: [{ id: fixedRoundId }] };
      }
      if (sql.includes('UPDATE storyboard_review_comments AS comment')) {
        expect(sql).toContain('review_round.project_id = $3');
        expect(sql).toContain('review_round.manuscript_id = $4');
        expect(values.slice(0, 5)).toEqual([
          'comment-1', 'round-1', 'project-1', 'manuscript-1', 'resolved',
        ]);
        return { rows: [{
          id: 'comment-1', review_round_id: 'round-1', frame_id: 'frame-a',
          parent_id: null, author_display_name: 'Kari', body: 'Hold bildet.',
          visibility: 'client', anchor_x: null, anchor_y: null, status: 'resolved',
          assigned_to: 'Mina', due_at: new Date('2026-09-14T10:00:00Z'),
          resolution_note: 'Forlenget to frames', resolved_by: 'owner-1', resolved_at: now,
          resolved_in_round_id: fixedRoundId, carried_from_comment_id: null,
          created_at: new Date('2026-09-12T12:01:00Z'), updated_at: now,
        }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const upsertNotification = vi.fn().mockResolvedValue(undefined);
    const router = Router();
    registerStoryboardReviewRoutes(router, { query } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
      upsertNotification,
    });
    const handler = routeHandler(router, 'patch',
      '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-rounds/:roundId/comments/:commentId');
    const res = response();
    await handler({ params: {
      projectId: 'project-1', manuscriptId: 'manuscript-1', roundId: 'round-1', commentId: 'comment-1',
    }, body: {
      status: 'resolved', assignedTo: 'Mina', dueAt: '2026-09-14T10:00:00Z',
      resolutionNote: 'Forlenget to frames', resolvedInRoundId: fixedRoundId,
    }, userId: 'owner-1' }, res, (error: unknown) => { throw error; });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 'comment-1', status: 'resolved', assignedTo: 'Mina',
      resolutionNote: 'Forlenget to frames', resolvedInRoundId: fixedRoundId,
    });
    expect(upsertNotification).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'storyboard_review_comment_resolved', initiallyReadByUserId: 'owner-1',
    }));
  });

  it('rejects a fixed-in revision outside the scoped manuscript before touching the comment', async () => {
    const fixedRoundId = '00000000-0000-4000-8000-000000000099';
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'round-1', version: 2 }] })
      .mockResolvedValueOnce({ rows: [] });
    const router = Router();
    registerStoryboardReviewRoutes(router, { query } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
    });
    const handler = routeHandler(router, 'patch',
      '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-rounds/:roundId/comments/:commentId');
    const res = response();
    await handler({ params: {
      projectId: 'project-1', manuscriptId: 'manuscript-1', roundId: 'round-1', commentId: 'comment-1',
    }, body: { status: 'resolved', resolvedInRoundId: fixedRoundId }, userId: 'owner-1' }, res,
    (error: unknown) => { throw error; });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'resolved_revision_not_in_manuscript' });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE storyboard_review_comments'))).toBe(false);
  });

  it('moves or removes a scoped comment pin without changing the comment body', async () => {
    const now = new Date('2026-09-12T12:05:00Z');
    const query = vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes('SELECT id, version, status FROM storyboard_review_rounds')) {
        return { rows: [{ id: 'round-1', version: 2 }] };
      }
      if (sql.includes('SELECT comment.frame_id')) {
        expect(values).toEqual(['comment-1', 'round-1', 'project-1', 'manuscript-1']);
        return { rows: [{ frame_id: 'frame-a' }] };
      }
      if (sql.includes('UPDATE storyboard_review_comments AS comment')) {
        expect(sql).toContain('anchor_x = CASE WHEN $15 THEN $16::real');
        expect(values?.slice(14, 17)).toEqual([true, 0.82, 0.24]);
        return { rows: [{
          id: 'comment-1', review_round_id: 'round-1', frame_id: 'frame-a',
          parent_id: null, author_display_name: 'Kari', body: 'Hold bildet.',
          visibility: 'client', anchor_x: values?.[15], anchor_y: values?.[16],
          annotations: [], status: 'open', assigned_to: null, due_at: null,
          resolution_note: null, resolved_by: null, resolved_at: null,
          resolved_in_round_id: null, carried_from_comment_id: null,
          created_at: now, updated_at: now,
        }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const router = Router();
    registerStoryboardReviewRoutes(router, { query } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
    });
    const handler = routeHandler(router, 'patch',
      '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-rounds/:roundId/comments/:commentId');
    const res = response();
    await handler({ params: {
      projectId: 'project-1', manuscriptId: 'manuscript-1', roundId: 'round-1', commentId: 'comment-1',
    }, body: { anchorX: 0.82, anchorY: 0.24 }, userId: 'owner-1' }, res,
    (error: unknown) => { throw error; });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 'comment-1', body: 'Hold bildet.', anchorX: 0.82, anchorY: 0.24,
    });
  });

  it('does not let a manager move pins after a revision is approved', async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ id: 'round-1', version: 2, status: 'approved' }],
    });
    const router = Router();
    registerStoryboardReviewRoutes(router, { query } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
    });
    const handler = routeHandler(router, 'patch',
      '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-rounds/:roundId/comments/:commentId');
    const res = response();
    await handler({ params: {
      projectId: 'project-1', manuscriptId: 'manuscript-1', roundId: 'round-1', commentId: 'comment-1',
    }, body: { anchorX: 0.25, anchorY: 0.75 }, userId: 'owner-1' }, res,
    (error: unknown) => { throw error; });

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'review_round_locked' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('requires an applied review change to be undone instead of silently reopening its comment', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'round-1', version: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'change-1' }] });
    const router = Router();
    registerStoryboardReviewRoutes(router, { query } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
    });
    const handler = routeHandler(router, 'patch',
      '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-rounds/:roundId/comments/:commentId');
    const res = response();
    await handler({ params: {
      projectId: 'project-1', manuscriptId: 'manuscript-1', roundId: 'round-1', commentId: 'comment-1',
    }, body: { status: 'open' }, userId: 'owner-1' }, res,
    (error: unknown) => { throw error; });

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'review_change_must_be_undone' });
    expect(query.mock.calls[1][0]).toContain("undone.reverts_change_id = applied.id");
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE storyboard_review_comments'))).toBe(false);
  });

  it('previews a whitelisted comment change against the live working frame', async () => {
    const current = source();
    const comment = {
      id: 'comment-1', review_round_id: 'round-1', frame_id: 'frame-a',
      status: 'open', review_round_status: 'in_review', review_round_version: 2,
    };
    const query = vi.fn().mockResolvedValue({ rows: [comment] });
    const manuscriptsService = {
      getManuscript: vi.fn().mockResolvedValue(current.manuscript),
      getScenes: vi.fn().mockResolvedValue(current.scenes),
      getDialogue: vi.fn().mockResolvedValue(current.dialogue),
    };
    const router = Router();
    registerStoryboardReviewRoutes(router, { query } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: manuscriptsService as any,
    });
    const handler = routeHandler(router, 'post',
      '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-rounds/:roundId/comments/:commentId/change-preview');
    const res = response();
    await handler({ params: {
      projectId: 'project-1', manuscriptId: 'manuscript-1', roundId: 'round-1', commentId: 'comment-1',
    }, body: { field: 'duration', value: 3.5 }, userId: 'owner-1' }, res,
    (error: unknown) => { throw error; });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toMatchObject({
      sceneId: 'scene-1', frameId: 'frame-a', field: 'duration',
      beforeDisplayValue: '2.0 sek', afterDisplayValue: '3.5 sek',
    });
    expect(manuscriptsService.getScenes).toHaveBeenCalledOnce();
    expect(current.scenes[0].storyboardFrames[0].duration).toBe(2);
  });

  it('applies an exact preview once, journals the inverse and resolves the comment', async () => {
    const current = source();
    const preview = buildStoryboardReviewChangePreview({
      projectId: 'project-1', manuscriptId: 'manuscript-1', roundId: 'round-1',
      commentId: 'comment-1', frameId: 'frame-a', sceneId: 'scene-1',
      frame: current.scenes[0].storyboardFrames[0], field: 'duration', value: 3.5,
    });
    const now = new Date('2026-09-12T12:10:00Z');
    const comment = {
      id: 'comment-1', review_round_id: 'round-1', frame_id: 'frame-a', parent_id: null,
      author_display_name: 'Kari', body: 'Hold bildet lenger.', visibility: 'client',
      anchor_x: null, anchor_y: null, annotations: [], status: 'open', assigned_to: null,
      due_at: null, resolution_note: null, resolved_by: null, resolved_at: null,
      resolved_in_round_id: null, carried_from_comment_id: null, created_at: now,
      updated_at: now, review_round_status: 'in_review', review_round_version: 2,
    };
    const appliedComment = { ...comment, status: 'resolved', resolved_by: 'owner-1',
      resolved_at: now, resolution_note: 'Godkjent endring: Varighet – 2.0 sek → 3.5 sek' };
    const change = {
      id: 'change-1', review_round_id: 'round-1', comment_id: 'comment-1',
      project_id: 'project-1', manuscript_id: 'manuscript-1', scene_id: 'scene-1',
      frame_id: 'frame-a', operation: 'apply', forward_patch: { duration: 3.5 },
      inverse_patch: { duration: 2 }, before_hash: preview.beforeHash,
      after_hash: preview.afterHash, reverts_change_id: null, created_by: 'owner-1', created_at: now,
    };
    const client = {
      release: vi.fn(),
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
        if (sql.includes('FROM storyboard_review_comments AS comment')) return { rows: [comment] };
        if (sql.includes('INSERT INTO storyboard_review_comment_changes')) {
          expect(JSON.parse(String(values?.[6]))).toEqual({ duration: 3.5 });
          expect(JSON.parse(String(values?.[7]))).toEqual({ duration: 2 });
          return { rows: [change] };
        }
        if (sql.includes('UPDATE storyboard_review_comments')) return { rows: [appliedComment] };
        throw new Error(`unexpected client query: ${sql}`);
      }),
    };
    const manuscriptsService = {
      getManuscript: vi.fn().mockResolvedValue(current.manuscript),
      getScenes: vi.fn().mockResolvedValue(current.scenes),
      getDialogue: vi.fn().mockResolvedValue(current.dialogue),
      patchFrame: vi.fn().mockResolvedValue({ updatedAt: now.toISOString() }),
    };
    const upsertNotification = vi.fn().mockResolvedValue(undefined);
    const router = Router();
    registerStoryboardReviewRoutes(router, { connect: async () => client } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: manuscriptsService as any,
      upsertNotification,
    });
    const handler = routeHandler(router, 'post',
      '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-rounds/:roundId/comments/:commentId/change-applications');
    const res = response();
    await handler({ params: {
      projectId: 'project-1', manuscriptId: 'manuscript-1', roundId: 'round-1', commentId: 'comment-1',
    }, body: { field: 'duration', value: 3.5, expectedPreviewHash: preview.previewHash },
    userId: 'owner-1', userEmail: 'owner@example.com' }, res,
    (error: unknown) => { throw error; });

    expect(res.statusCode).toBe(201);
    expect(manuscriptsService.patchFrame).toHaveBeenCalledWith(
      'manuscript-1', 'scene-1', 'frame-a', { duration: 3.5 });
    expect(res.body.data).toMatchObject({
      comment: { id: 'comment-1', status: 'resolved' },
      change: { id: 'change-1', operation: 'apply', beforeDisplayValue: '2.0 sek', afterDisplayValue: '3.5 sek' },
    });
    expect(upsertNotification).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1', linkedEntityId: 'change-1',
      eventType: 'storyboard_review_comment_resolved',
    }));
  });

  it('refuses undo when the reviewed field changed after the approved patch', async () => {
    const current = source();
    current.scenes[0].storyboardFrames[0].duration = 4;
    const expectedBeforeHash = storyboardReviewHash({ duration: 2 });
    const expectedAfterHash = storyboardReviewHash({ duration: 3.5 });
    const now = new Date('2026-09-12T12:10:00Z');
    const client = {
      release: vi.fn(),
      query: vi.fn(async (sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
        if (sql.includes('FROM storyboard_review_comments AS comment')) return { rows: [{
          id: 'comment-1', review_round_id: 'round-1', frame_id: 'frame-a', status: 'resolved',
          review_round_status: 'changes_requested', review_round_version: 2,
        }] };
        if (sql.includes('FROM storyboard_review_comment_changes AS change')) return { rows: [{
          id: 'change-1', review_round_id: 'round-1', comment_id: 'comment-1',
          project_id: 'project-1', manuscript_id: 'manuscript-1', scene_id: 'scene-1',
          frame_id: 'frame-a', operation: 'apply', forward_patch: { duration: 3.5 },
          inverse_patch: { duration: 2 }, before_hash: expectedBeforeHash,
          after_hash: expectedAfterHash, created_by: 'owner-1', created_at: now,
        }] };
        if (sql.includes('WHERE reverts_change_id')) return { rows: [] };
        throw new Error(`unexpected client query: ${sql}`);
      }),
    };
    const manuscriptsService = {
      getManuscript: vi.fn().mockResolvedValue(current.manuscript),
      getScenes: vi.fn().mockResolvedValue(current.scenes),
      getDialogue: vi.fn().mockResolvedValue(current.dialogue),
      patchFrame: vi.fn(),
    };
    const router = Router();
    registerStoryboardReviewRoutes(router, { connect: async () => client } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: manuscriptsService as any,
    });
    const handler = routeHandler(router, 'post',
      '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-rounds/:roundId/comments/:commentId/change-applications/:changeId/undo');
    const res = response();
    await handler({ params: {
      projectId: 'project-1', manuscriptId: 'manuscript-1', roundId: 'round-1',
      commentId: 'comment-1', changeId: 'change-1',
    }, body: { expectedAfterHash }, userId: 'owner-1' }, res,
    (error: any) => { res.status(error.status || 500).json({ error: error.message }); });

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'review_change_cannot_undo_after_new_edit' });
    expect(manuscriptsService.patchFrame).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('undoes the exact applied field, appends a journal entry and reopens the comment', async () => {
    const current = source();
    current.scenes[0].storyboardFrames[0].duration = 3.5;
    const beforeHash = storyboardReviewHash({ duration: 2 });
    const afterHash = storyboardReviewHash({ duration: 3.5 });
    const now = new Date('2026-09-12T12:10:00Z');
    const baseComment = {
      id: 'comment-1', review_round_id: 'round-1', frame_id: 'frame-a', parent_id: null,
      author_display_name: 'Kari', body: 'Hold bildet lenger.', visibility: 'client',
      anchor_x: null, anchor_y: null, annotations: [], status: 'resolved', assigned_to: null,
      due_at: null, resolution_note: 'Godkjent endring', resolved_by: 'owner-1',
      resolved_at: now, resolved_in_round_id: null, carried_from_comment_id: null,
      created_at: now, updated_at: now, review_round_status: 'changes_requested',
      review_round_version: 2,
    };
    const applyChange = {
      id: 'change-1', review_round_id: 'round-1', comment_id: 'comment-1',
      project_id: 'project-1', manuscript_id: 'manuscript-1', scene_id: 'scene-1',
      frame_id: 'frame-a', operation: 'apply', forward_patch: { duration: 3.5 },
      inverse_patch: { duration: 2 }, before_hash: beforeHash, after_hash: afterHash,
      reverts_change_id: null, created_by: 'owner-1', created_at: now,
    };
    const undoChange = {
      ...applyChange, id: 'undo-1', operation: 'undo', forward_patch: { duration: 2 },
      inverse_patch: { duration: 3.5 }, before_hash: afterHash, after_hash: beforeHash,
      reverts_change_id: 'change-1', created_by: 'owner-2',
    };
    const client = {
      release: vi.fn(),
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
        if (sql.includes('FROM storyboard_review_comments AS comment')) return { rows: [baseComment] };
        if (sql.includes('WHERE reverts_change_id')) return { rows: [] };
        if (sql.includes('FROM storyboard_review_comment_changes AS change')) return { rows: [applyChange] };
        if (sql.includes('INSERT INTO storyboard_review_comment_changes')) {
          expect(JSON.parse(String(values?.[6]))).toEqual({ duration: 2 });
          expect(values?.[10]).toBe('change-1');
          return { rows: [undoChange] };
        }
        if (sql.includes('UPDATE storyboard_review_comments')) {
          return { rows: [{ ...baseComment, status: 'open', resolution_note: null,
            resolved_by: null, resolved_at: null }] };
        }
        throw new Error(`unexpected client query: ${sql}`);
      }),
    };
    const manuscriptsService = {
      getManuscript: vi.fn().mockResolvedValue(current.manuscript),
      getScenes: vi.fn().mockResolvedValue(current.scenes),
      getDialogue: vi.fn().mockResolvedValue(current.dialogue),
      patchFrame: vi.fn().mockResolvedValue({ updatedAt: now.toISOString() }),
    };
    const upsertNotification = vi.fn().mockResolvedValue(undefined);
    const router = Router();
    registerStoryboardReviewRoutes(router, { connect: async () => client } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: manuscriptsService as any,
      upsertNotification,
    });
    const handler = routeHandler(router, 'post',
      '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-rounds/:roundId/comments/:commentId/change-applications/:changeId/undo');
    const res = response();
    await handler({ params: {
      projectId: 'project-1', manuscriptId: 'manuscript-1', roundId: 'round-1',
      commentId: 'comment-1', changeId: 'change-1',
    }, body: { expectedAfterHash: afterHash }, userId: 'owner-2' }, res,
    (error: unknown) => { throw error; });

    expect(res.statusCode).toBe(201);
    expect(manuscriptsService.patchFrame).toHaveBeenCalledWith(
      'manuscript-1', 'scene-1', 'frame-a', { duration: 2 });
    expect(res.body.data).toMatchObject({
      comment: { id: 'comment-1', status: 'open' },
      change: { id: 'undo-1', operation: 'undo', revertsChangeId: 'change-1',
        beforeDisplayValue: '3.5 sek', afterDisplayValue: '2.0 sek' },
    });
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(upsertNotification).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'storyboard_review_comment_reopened', linkedEntityId: 'undo-1',
    }));
  });

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

  it('publishes guest comments to the shared producer and storyboard inbox', async () => {
    const share = {
      ...source(), id: 'round-1', project_id: 'project-1', manuscript_id: 'manuscript-1',
      version: 2, snapshot: buildStoryboardReviewSnapshot(source()), share_link_id: 'share-1',
      share_access_mode: 'comment', share_require_identity: true,
    };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('JOIN storyboard_review_rounds')) return { rows: [share] };
      if (sql.includes('UPDATE storyboard_review_sessions')) {
        return { rows: [{ id: 'reviewer-1', display_name: 'Kari Klient', email: null }] };
      }
      throw new Error(`unexpected pool query: ${sql}`);
    });
    const client = {
      release: vi.fn(),
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') return { rows: [] };
        if (sql.includes('FOR UPDATE')) return { rows: [{ status: 'in_review' }] };
        if (sql.includes('INSERT INTO storyboard_review_comments')) return { rows: [{
          id: 'comment-1', review_round_id: 'round-1', frame_id: 'frame-a', parent_id: null,
          author_display_name: 'Kari Klient', body: values?.[5], visibility: 'client',
          anchor_x: values?.[6], anchor_y: values?.[7],
          annotations: JSON.parse(String(values?.[8] ?? '[]')),
          status: 'open', created_at: new Date('2026-09-12T12:01:00Z'),
        }] };
        throw new Error(`unexpected client query: ${sql}`);
      }),
    };
    const upsertNotification = vi.fn().mockResolvedValue(undefined);
    const router = Router();
    registerStoryboardReviewRoutes(router, { query, connect: async () => client } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
      upsertNotification,
    });
    const handler = routeHandler(router, 'post', '/storyboard-review/:token/comments');
    const res = response();
    const annotations = [{
      id: 'mark-1', tool: 'arrow', color: '#fbbf24', strokeWidth: 3,
      points: [{ x: 0.2, y: 0.3 }, { x: 0.7, y: 0.6 }],
    }];
    await handler({
      params: { token: 'raw-share-token' }, body: {
        frameId: 'frame-a', body: 'Hold bildet lenger.',
        anchorX: 0.7, anchorY: 0.6, annotations,
      },
      header: () => 'raw-reviewer-token',
    }, res, (error: any) => { res.status(error.status || 500).json({ error: error.message }); });

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toMatchObject({ anchorX: 0.7, anchorY: 0.6, annotations });
    const insert = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO storyboard_review_comments'));
    expect(insert?.[1]?.slice(6, 8)).toEqual([0.7, 0.6]);
    expect(JSON.parse(String(insert?.[1]?.[8]))).toEqual(annotations);
    expect(upsertNotification).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1', eventType: 'storyboard_review_comment_added',
      message: 'Hold bildet lenger.', linkedEntityId: 'comment-1',
      metadata: expect.objectContaining({ manuscriptId: 'manuscript-1', frameId: 'frame-a' }),
    }));
  });

  it('rejects malformed or unscoped visual markup before database access', async () => {
    const query = vi.fn();
    const router = Router();
    registerStoryboardReviewRoutes(router, { query } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
    });
    const handler = routeHandler(router, 'post', '/storyboard-review/:token/comments');
    const incompleteAnchor = response();
    await handler({
      params: { token: 'raw-share-token' },
      body: { frameId: 'frame-a', body: 'Pek her.', anchorX: 0.5 },
      header: () => 'raw-reviewer-token',
    }, incompleteAnchor, (error: unknown) => { throw error; });
    expect(incompleteAnchor.statusCode).toBe(400);

    const missingFrame = response();
    await handler({
      params: { token: 'raw-share-token' },
      body: {
        body: 'Pek her.', annotations: [{
          id: 'mark-1', tool: 'rectangle', color: '#f87171', strokeWidth: 3,
          points: [{ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.5 }],
        }],
      },
      header: () => 'raw-reviewer-token',
    }, missingFrame, (error: unknown) => { throw error; });
    expect(missingFrame.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('lets a reviewer move only their own pin and preserves the comment text', async () => {
    const now = new Date('2026-09-12T12:01:00Z');
    const share = {
      id: 'round-1', project_id: 'project-1', manuscript_id: 'manuscript-1',
      version: 2, status: 'in_review', snapshot: buildStoryboardReviewSnapshot(source()),
      share_link_id: 'share-1', share_access_mode: 'comment', share_require_identity: true,
    };
    const query = vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes('JOIN storyboard_review_rounds')) return { rows: [share] };
      if (sql.includes('UPDATE storyboard_review_sessions')) {
        return { rows: [{ id: 'reviewer-1', display_name: 'Kari Klient', email: null }] };
      }
      if (sql.includes('UPDATE storyboard_review_comments')) {
        expect(sql).toContain('reviewer_session_id = $3');
        if (values?.[0] === 'comment-other') return { rows: [] };
        expect(values).toEqual(['comment-own', 'round-1', 'reviewer-1', 0.78, 0.31]);
        return { rows: [{
          id: 'comment-own', review_round_id: 'round-1', frame_id: 'frame-a', parent_id: null,
          author_display_name: 'Kari Klient', body: 'Flytt markeringen hit.', visibility: 'client',
          anchor_x: 0.78, anchor_y: 0.31, annotations: [], status: 'open',
          assigned_to: null, due_at: null, resolution_note: null, resolved_by: null,
          resolved_at: null, resolved_in_round_id: null, carried_from_comment_id: null,
          created_at: now, updated_at: now,
        }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const router = Router();
    registerStoryboardReviewRoutes(router, { query } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
    });
    const handler = routeHandler(router, 'patch',
      '/storyboard-review/:token/comments/:commentId/markup');
    const res = response();
    await handler({
      params: { token: 'raw-share-token', commentId: 'comment-own' },
      body: { anchorX: 0.78, anchorY: 0.31 },
      header: () => 'raw-reviewer-token',
    }, res, (error: unknown) => { throw error; });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 'comment-own', body: 'Flytt markeringen hit.', anchorX: 0.78, anchorY: 0.31,
      canEdit: true,
    });

    const other = response();
    await handler({
      params: { token: 'raw-share-token', commentId: 'comment-other' },
      body: { anchorX: 0.1, anchorY: 0.9 },
      header: () => 'raw-reviewer-token',
    }, other, (error: unknown) => { throw error; });
    expect(other.statusCode).toBe(404);
    expect(other.body).toEqual({ error: 'review_comment_not_found' });
  });

  it('rejects incomplete pin movement and keeps approved revisions immutable', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      id: 'round-1', status: 'approved', share_link_id: 'share-1',
      share_access_mode: 'comment',
    }] });
    const router = Router();
    registerStoryboardReviewRoutes(router, { query } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
    });
    const handler = routeHandler(router, 'patch',
      '/storyboard-review/:token/comments/:commentId/markup');

    const incomplete = response();
    await handler({
      params: { token: 'raw-share-token', commentId: 'comment-own' },
      body: { anchorX: 0.5 }, header: () => 'raw-reviewer-token',
    }, incomplete, (error: unknown) => { throw error; });
    expect(incomplete.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();

    const locked = response();
    await handler({
      params: { token: 'raw-share-token', commentId: 'comment-own' },
      body: { anchorX: 0.5, anchorY: 0.5 }, header: () => 'raw-reviewer-token',
    }, locked, (error: unknown) => { throw error; });
    expect(locked.statusCode).toBe(409);
    expect(locked.body).toEqual({ error: 'review_round_locked' });
    expect(query).toHaveBeenCalledTimes(1);
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
        if (sql.includes('COUNT(*)::int')) return { rows: [{ count: 1 }] };
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
    const upsertNotification = vi.fn().mockResolvedValue(undefined);
    registerStoryboardReviewRoutes(router, { query, connect: async () => client } as any, {
      auth: pass, canView: pass, canManage: pass, manuscriptsService: unusedManuscripts,
      upsertNotification,
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

    const unconfirmed = response();
    await handler({ params: { token: 'raw-share-token' }, body: {
      decision: 'approved', expectedSnapshotHash: 'a'.repeat(64),
    }, header: () => 'raw-reviewer-token' }, unconfirmed, (error: any) => {
      unconfirmed.status(error.status || 500).json({ error: error.message });
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unconfirmed.statusCode).toBe(409);
    expect(unconfirmed.body).toEqual({ error: 'open_comments_require_confirmation' });
    expect(inserts).toBe(0);

    const approved = response();
    await handler({ params: { token: 'raw-share-token' }, body: {
      decision: 'approved', expectedSnapshotHash: 'a'.repeat(64), confirmOpenComments: true,
    }, header: () => 'raw-reviewer-token' }, approved, (error: any) => {
      approved.status(error.status || 500).json({ error: error.message });
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(approved.statusCode).toBe(201);
    expect(inserts).toBe(1);
    expect(status).toBe('approved');
    expect(upsertNotification).toHaveBeenCalledTimes(1);
    expect(upsertNotification).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1', eventType: 'storyboard_review_approved',
      linkedEntityType: 'storyboard_review_decision',
      metadata: expect.objectContaining({ manuscriptId: 'manuscript-1', reviewRoundId: 'round-1' }),
    }));
    const statusUpdate = client.query.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE storyboard_review_rounds'));
    expect(statusUpdate?.[1]).toEqual(['round-1', 'approved', 'Kari Klient', true]);
    expect(String(statusUpdate?.[0])).not.toContain("$2 = 'approved'");

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
