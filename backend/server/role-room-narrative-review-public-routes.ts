/**
 * Offentlig gjeste-review for Story Graph-scener (Fase 7e-2).
 *
 * Montert på /api/role-room/narrative/review (uten innlogging):
 *   GET  /:token                       runde-snapshot (felter, replikker, rammer), reviewer, tilgang
 *   POST /:token/sessions              navngitt reviewer-sesjon → reviewerToken (header x-narrative-reviewer)
 *   GET  /:token/editor-comments       kommentartråd (samme URL-form som PostCommentLayer forventer)
 *   POST /:token/editor-comments       ny kommentar (comment/approve-lenker)
 *   PATCH /:token/editor-comments/:id  status-endring på egen kommentar
 *   POST /:token/decision              godkjenn / be om endringer (kun approve-lenker; 409 ved stale)
 *
 * Token lagres bare som sha256; ugyldig/utløpt/tilbakekalt gir samme 404.
 * Beslutning fra gjest lagres med decided_by_user_id = 'reviewer:<sesjon>' og
 * decided_by_label = visningsnavn, og varsler forespørreren.
 */
import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import * as svc from './role-room-narrative-service.js';
import { broadcastEventToRoom, narrativeRoomKey } from './websocket-chat.js';
import { defaultSceneNotifier, type SceneNotifier } from './role-room-narrative-routes.js';

export interface CreateNarrativeReviewPublicRouterDeps {
  broadcast?: (room: string, message: unknown) => number;
  notify?: SceneNotifier;
}

const sessionBody = z.object({ displayName: z.string().trim().min(2).max(180), email: z.string().trim().email().max(320).nullable().optional() });
const commentBody = z.object({
  commentText: z.string().trim().min(1).max(5000),
  parentId: z.string().max(200).nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  authorDisplayName: z.string().max(180).optional(),
});
const commentPatch = z.object({ status: z.enum(['open', 'in_progress', 'resolved', 'wontfix']).optional() });
const decisionBody = z.object({
  decision: z.enum(['approved', 'changes_requested']),
  note: z.string().max(5000).nullable().optional(),
  expectedSnapshotHash: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(),
});

const attempts = new Map<string, { count: number; resetAt: number }>();
function rateLimited(req: Request, res: Response, bucket: string, max: number): boolean {
  const key = `${bucket}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
  const now = Date.now();
  const cur = attempts.get(key);
  if (!cur || cur.resetAt < now) { attempts.set(key, { count: 1, resetAt: now + 60_000 }); return false; }
  cur.count += 1;
  if (cur.count > max) { res.status(429).json({ error: 'rate_limited' }); return true; }
  return false;
}

function mapCommentRow(r: Record<string, unknown>, replyCounts: Map<string, number>, reviewerId: string | null) {
  return {
    id: String(r.id), projectId: String(r.project_id), anchorType: String(r.anchor_type), anchorRef: r.anchor_ref == null ? null : String(r.anchor_ref),
    timestampSec: r.timestamp_sec == null ? null : Number(r.timestamp_sec), agentKind: r.agent_kind == null ? null : String(r.agent_kind),
    commentText: String(r.comment_text ?? ''), parentId: r.parent_id == null ? null : String(r.parent_id), status: String(r.status ?? 'open'),
    assignedTo: r.assigned_to == null ? null : String(r.assigned_to), priority: String(r.priority ?? 'normal'),
    authorId: r.author_id == null ? null : String(r.author_id), authorDisplayName: String(r.author_display_name ?? 'Gjest'),
    resolvedBy: r.resolved_by == null ? null : String(r.resolved_by), resolvedAt: r.resolved_at ? new Date(r.resolved_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(), updatedAt: new Date(r.updated_at as string).toISOString(),
    replyCount: replyCounts.get(String(r.id)) ?? 0,
    canEdit: reviewerId != null && String(r.author_id) === `reviewer:${reviewerId}`,
  };
}

export function createNarrativeReviewPublicRouter(pool: Pool, deps: CreateNarrativeReviewPublicRouterDeps = {}): ExpressRouter {
  const router = Router();
  const broadcast = deps.broadcast ?? broadcastEventToRoom;
  const notify = deps.notify ?? defaultSceneNotifier;
  const reviewerToken = (req: Request) => { const h = req.headers['x-narrative-reviewer']; return typeof h === 'string' ? h.trim() : undefined; };

  router.use('/:token', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  const wrap = (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response) => {
    try { await fn(req, res); }
    catch (err) {
      if (err instanceof svc.SceneReviewStaleError) { res.status(409).json({ error: 'snapshot_stale', message: err.message, currentHash: err.currentHash, reviewHash: err.reviewHash }); return; }
      if (err instanceof svc.SceneReviewClosedError) { res.status(409).json({ error: 'review_closed', message: err.message, status: err.status }); return; }
      console.error('[narrative-review] public route error', err);
      if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
    }
  };

  router.get('/:token', wrap(async (req, res) => {
    if (rateLimited(req, res, 'view', 240)) return;
    const share = await svc.resolveReviewShare(pool, String(req.params.token));
    if (!share) { res.status(404).json({ error: 'not_found' }); return; }
    const reviewer = await svc.resolveReviewer(pool, share.link.id, reviewerToken(req));
    const access = { accessMode: share.link.accessMode, requireIdentity: share.link.requireIdentity, expiresAt: share.link.expiresAt };
    const roundMeta = { id: share.review.id, round: share.review.round, status: share.review.status, requestedAt: share.review.requestedAt, requestNote: share.review.requestNote, decidedAt: share.review.decidedAt, decidedByLabel: share.review.decidedByLabel, decisionNote: share.review.decisionNote, snapshotHash: share.review.snapshotHash };
    if (share.link.requireIdentity && !reviewer) {
      res.json({ success: true, data: { requiresIdentity: true, scene: { code: share.sceneCode, title: share.sceneTitle }, round: roundMeta, share: access, reviewer: null } });
      return;
    }
    void svc.bumpReviewShareViews(pool, share.link.id);
    res.json({ success: true, data: {
      requiresIdentity: false,
      scene: { id: share.review.sceneId, code: share.sceneCode, title: share.sceneTitle, status: share.sceneStatus },
      round: roundMeta,
      snapshot: share.snapshot,
      share: access,
      reviewer: reviewer ? { id: reviewer.id, displayName: reviewer.displayName, email: reviewer.email } : null,
    } });
  }));

  router.post('/:token/sessions', wrap(async (req, res) => {
    if (rateLimited(req, res, 'session', 20)) return;
    const parsed = sessionBody.safeParse(req.body ?? {});
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const share = await svc.resolveReviewShare(pool, String(req.params.token));
    if (!share) { res.status(404).json({ error: 'not_found' }); return; }
    const { session, reviewerToken: rt } = await svc.createReviewerSession(pool, share.link.id, parsed.data.displayName, parsed.data.email ?? null);
    res.status(201).json({ success: true, data: { reviewerToken: rt, reviewer: { id: session.id, displayName: session.displayName, email: session.email } } });
  }));

  router.get('/:token/editor-comments', wrap(async (req, res) => {
    if (rateLimited(req, res, 'comments', 240)) return;
    const share = await svc.resolveReviewShare(pool, String(req.params.token));
    if (!share) { res.status(404).json({ error: 'not_found' }); return; }
    const reviewer = await svc.resolveReviewer(pool, share.link.id, reviewerToken(req));
    if (share.link.requireIdentity && !reviewer) { res.status(401).json({ error: 'reviewer_identity_required' }); return; }
    const since = typeof req.query.since === 'string' ? req.query.since : null;
    const { rows } = await pool.query(
      `SELECT * FROM role_room_editor_comments WHERE project_id = $1 AND anchor_type = 'narrative_scene' AND anchor_ref = $2 ${since ? 'AND updated_at > $3' : ''} ORDER BY parent_id NULLS FIRST, created_at ASC`,
      since ? [share.link.projectId, share.link.sceneId, since] : [share.link.projectId, share.link.sceneId],
    );
    const { rows: counts } = await pool.query(
      `SELECT parent_id, COUNT(*) AS count FROM role_room_editor_comments WHERE project_id = $1 AND anchor_type = 'narrative_scene' AND anchor_ref = $2 AND parent_id IS NOT NULL GROUP BY parent_id`,
      [share.link.projectId, share.link.sceneId],
    );
    const replyCounts = new Map<string, number>((counts as Array<Record<string, unknown>>).map((r) => [String(r.parent_id), Number(r.count)]));
    res.json({ comments: (rows as Array<Record<string, unknown>>).map((r) => mapCommentRow(r, replyCounts, reviewer?.id ?? null)), serverTime: new Date().toISOString() });
  }));

  router.post('/:token/editor-comments', wrap(async (req, res) => {
    if (rateLimited(req, res, 'comment', 45)) return;
    const parsed = commentBody.safeParse(req.body ?? {});
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const share = await svc.resolveReviewShare(pool, String(req.params.token));
    if (!share) { res.status(404).json({ error: 'not_found' }); return; }
    if (share.link.accessMode === 'view') { res.status(403).json({ error: 'comments_not_allowed' }); return; }
    const reviewer = await svc.resolveReviewer(pool, share.link.id, reviewerToken(req));
    if (!reviewer) { res.status(401).json({ error: 'reviewer_identity_required' }); return; }
    const { rows } = await pool.query(
      `INSERT INTO role_room_editor_comments (project_id, anchor_type, anchor_ref, timestamp_sec, agent_kind, comment_text, parent_id, priority, assigned_to, author_id, author_display_name)
         VALUES ($1, 'narrative_scene', $2, NULL, NULL, $3, $4, $5, NULL, $6, $7) RETURNING id, created_at`,
      [share.link.projectId, share.link.sceneId, parsed.data.commentText, parsed.data.parentId ?? null, parsed.data.priority ?? 'normal', `reviewer:${reviewer.id}`, reviewer.displayName],
    );
    try { broadcast(narrativeRoomKey(share.link.projectId), { type: 'narrative:graph_changed', payload: { kind: 'scene', ids: [share.link.sceneId], actorUserId: `reviewer:${reviewer.id}`, at: new Date().toISOString() }, timestamp: new Date().toISOString() }); } catch { /* best effort */ }
    res.json({ ok: true, id: String(rows[0].id), createdAt: new Date(rows[0].created_at as string).toISOString() });
  }));

  router.patch('/:token/editor-comments/:id', wrap(async (req, res) => {
    const parsed = commentPatch.safeParse(req.body ?? {});
    if (!parsed.success || !parsed.data.status) { res.status(400).json({ error: 'invalid_request' }); return; }
    const share = await svc.resolveReviewShare(pool, String(req.params.token));
    if (!share) { res.status(404).json({ error: 'not_found' }); return; }
    const reviewer = await svc.resolveReviewer(pool, share.link.id, reviewerToken(req));
    if (!reviewer) { res.status(401).json({ error: 'reviewer_identity_required' }); return; }
    const r = await pool.query(
      `UPDATE role_room_editor_comments SET status = $3, updated_at = now() WHERE id = $1 AND project_id = $2 AND author_id = $4 AND anchor_ref = $5 RETURNING id`,
      [String(req.params.id), share.link.projectId, parsed.data.status, `reviewer:${reviewer.id}`, share.link.sceneId],
    );
    if (!r.rowCount) { res.status(403).json({ error: 'not_your_comment' }); return; }
    res.json({ ok: true });
  }));

  router.post('/:token/decision', wrap(async (req, res) => {
    if (rateLimited(req, res, 'decision', 20)) return;
    const parsed = decisionBody.safeParse(req.body ?? {});
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    const share = await svc.resolveReviewShare(pool, String(req.params.token));
    if (!share) { res.status(404).json({ error: 'not_found' }); return; }
    if (share.link.accessMode !== 'approve') { res.status(403).json({ error: 'decision_not_allowed' }); return; }
    const reviewer = await svc.resolveReviewer(pool, share.link.id, reviewerToken(req));
    if (!reviewer) { res.status(401).json({ error: 'reviewer_identity_required' }); return; }
    const review = await svc.decideSceneReview(pool, share.link.projectId, share.link.sceneId, share.link.reviewId, {
      decision: parsed.data.decision, note: parsed.data.note ?? null, expectedSnapshotHash: parsed.data.expectedSnapshotHash ?? null,
      userId: `reviewer:${reviewer.id}`, userLabel: reviewer.displayName,
    });
    if (!review) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: review });
    try { broadcast(narrativeRoomKey(share.link.projectId), { type: 'narrative:graph_changed', payload: { kind: 'scene', ids: [share.link.sceneId], actorUserId: `reviewer:${reviewer.id}`, at: new Date().toISOString() }, timestamp: new Date().toISOString() }); } catch { /* best effort */ }
    const scene = await svc.getScene(pool, share.link.projectId, share.link.sceneId);
    if (scene) {
      const recipients = Array.from(new Set([scene.assigneeUserId, review.requestedBy].filter((id): id is string => !!id)));
      notify(pool, { event: 'narrative_scene_review_decided', projectId: share.link.projectId, actorUserId: `reviewer:${reviewer.id}`, scene, review, recipientUserIds: recipients })
        .catch((err) => console.warn('[narrative-review] notify failed', err));
    }
  }));

  return router;
}
