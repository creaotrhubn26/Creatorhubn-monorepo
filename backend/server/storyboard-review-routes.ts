import { createHash, randomBytes } from 'node:crypto';
import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { CastingManuscriptsService } from './casting-manuscripts-service.js';
import {
  upsertProducerProjectNotification,
  type UpsertProducerNotificationInput,
} from './role-room-producer-notifications.js';
import { requireStoryboardAccess, requireStoryboardAuth } from './storyboard-routes.js';
import type {
  StoryboardReviewDiff,
  StoryboardReviewRound,
  StoryboardReviewSnapshot,
} from '../../frontend/shared/storyboard-review.js';

type Middleware = (req: Request, res: Response, next: NextFunction) => unknown;
type AuthedRequest = Request & { userId?: string; userEmail?: string };
type JsonRecord = Record<string, any>;

const MAX_SNAPSHOT_BYTES = 12 * 1024 * 1024;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const createRoundBody = z.object({
  label: z.string().trim().min(1).max(180),
  summary: z.string().trim().max(5_000).optional(),
}).strict();
const shareBody = z.object({
  accessMode: z.enum(['view', 'comment', 'approve']).default('comment'),
  requireIdentity: z.boolean().default(true),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();
const restoreBody = z.object({
  confirmSnapshotHash: z.string().regex(HASH_PATTERN),
  expectedCurrentHash: z.string().regex(HASH_PATTERN),
}).strict();
const sessionBody = z.object({
  displayName: z.string().trim().min(1).max(180),
  email: z.string().trim().email().max(320).optional(),
}).strict();
const commentBody = z.object({
  frameId: z.string().trim().min(1).max(255).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  body: z.string().trim().min(1).max(5_000),
  anchorX: z.number().min(0).max(1).nullable().optional(),
  anchorY: z.number().min(0).max(1).nullable().optional(),
}).strict();
const decisionBody = z.object({
  decision: z.enum(['approved', 'changes_requested']),
  expectedSnapshotHash: z.string().regex(HASH_PATTERN),
  note: z.string().trim().max(5_000).nullable().optional(),
  confirmOpenComments: z.boolean().default(false),
}).strict();
const commentResolutionBody = z.object({
  status: z.enum(['open', 'resolved']).optional(),
  assignedTo: z.string().trim().min(1).max(180).nullable().optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  resolutionNote: z.string().trim().max(5_000).nullable().optional(),
  resolvedInRoundId: z.string().uuid().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function storyboardReviewHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function projectIdOf(source: JsonRecord | null): string {
  return String(source?.projectId ?? source?.project_id ?? '').trim();
}

function sceneHeading(scene: JsonRecord): string {
  return String(
    scene.heading ?? scene.sceneHeading ?? scene.sceneName ?? scene.title
      ?? `Scene ${scene.sceneNumber ?? scene.id}`,
  );
}

export function buildStoryboardReviewSnapshot(input: {
  manuscriptId: string;
  manuscript: JsonRecord;
  scenes: JsonRecord[];
  dialogue: JsonRecord[];
}): StoryboardReviewSnapshot {
  return {
    schemaVersion: 'storyboard-review-snapshot-v1',
    manuscript: {
      id: input.manuscriptId,
      title: String(input.manuscript.title ?? 'Untitled manuscript'),
      ...(Number.isFinite(Number(input.manuscript.version))
        ? { version: Number(input.manuscript.version) }
        : {}),
    },
    scenes: input.scenes.map((scene) => ({
      id: String(scene.id),
      heading: sceneHeading(scene),
      ...(scene.sceneNumber != null ? { sceneNumber: scene.sceneNumber } : {}),
      ...(typeof scene.description === 'string' ? { description: scene.description } : {}),
      storyboardFrames: Array.isArray(scene.storyboardFrames)
        ? structuredClone(scene.storyboardFrames)
        : [],
      ...(Array.isArray(scene.storyboardVersionLog)
        ? { storyboardVersionLog: structuredClone(scene.storyboardVersionLog) }
        : {}),
      ...(scene.storyboardSettings != null
        ? { storyboardSettings: structuredClone(scene.storyboardSettings) }
        : {}),
      ...(scene.storyboardNotes != null
        ? { storyboardNotes: structuredClone(scene.storyboardNotes) }
        : {}),
    })),
    dialogue: input.dialogue.map((line) => ({
      ...(line.id != null ? { id: String(line.id) } : {}),
      ...(line.sceneId != null ? { sceneId: String(line.sceneId) } : {}),
      ...(Number.isFinite(Number(line.lineNumber)) ? { lineNumber: Number(line.lineNumber) } : {}),
      ...(line.characterName != null ? { characterName: String(line.characterName) } : {}),
      text: String(line.dialogueText ?? line.text ?? ''),
    })),
  };
}

function scriptView(snapshot: StoryboardReviewSnapshot) {
  return {
    manuscriptId: snapshot.manuscript.id,
    scenes: snapshot.scenes.map(({ id, heading, sceneNumber, description }) => ({
      id, heading, sceneNumber, description,
    })),
    dialogue: snapshot.dialogue,
  };
}

function framesById(snapshot: StoryboardReviewSnapshot) {
  const map = new Map<string, { sceneId: string; index: number; frame: JsonRecord }>();
  for (const scene of snapshot.scenes) {
    scene.storyboardFrames.forEach((frame, index) => {
      if (frame?.id) map.set(String(frame.id), { sceneId: scene.id, index, frame });
    });
  }
  return map;
}

function lineRange(frame?: JsonRecord): [number, number] | null {
  const range = frame?.scriptLineRange;
  return Array.isArray(range) && range.length === 2
    && Number.isFinite(Number(range[0])) && Number.isFinite(Number(range[1]))
    ? [Number(range[0]), Number(range[1])]
    : null;
}

export function diffStoryboardReviewSnapshots(
  baseline: StoryboardReviewSnapshot,
  current: StoryboardReviewSnapshot,
): StoryboardReviewDiff {
  const before = framesById(baseline);
  const after = framesById(current);
  const addedFrameIds: string[] = [];
  const removedFrameIds: string[] = [];
  const changedFrameIds: string[] = [];
  const movedFrameIds: string[] = [];
  const ranges = new Map<string, [number, number]>();
  let unchangedFrameCount = 0;

  for (const [id, entry] of after) {
    const previous = before.get(id);
    if (!previous) {
      addedFrameIds.push(id);
      const range = lineRange(entry.frame);
      if (range) ranges.set(range.join(':'), range);
      continue;
    }
    if (previous.sceneId !== entry.sceneId || previous.index !== entry.index) movedFrameIds.push(id);
    if (storyboardReviewHash(previous.frame) !== storyboardReviewHash(entry.frame)) {
      changedFrameIds.push(id);
      for (const range of [lineRange(previous.frame), lineRange(entry.frame)]) {
        if (range) ranges.set(range.join(':'), range);
      }
    } else if (previous.sceneId === entry.sceneId && previous.index === entry.index) {
      unchangedFrameCount += 1;
    }
  }
  for (const [id, entry] of before) {
    if (after.has(id)) continue;
    removedFrameIds.push(id);
    const range = lineRange(entry.frame);
    if (range) ranges.set(range.join(':'), range);
  }

  return {
    currentHash: storyboardReviewHash(current),
    baselineHash: storyboardReviewHash(baseline),
    scriptChanged: storyboardReviewHash(scriptView(baseline)) !== storyboardReviewHash(scriptView(current)),
    addedFrameIds,
    removedFrameIds,
    changedFrameIds,
    movedFrameIds,
    impactedScriptLineRanges: [...ranges.values()],
    unchangedFrameCount,
  };
}

const STORYBOARD_OWNED_SCENE_FIELDS = [
  'storyboardFrames',
  'storyboardVersionLog',
  'storyboardSettings',
  'storyboardNotes',
] as const;

export function mergeStoryboardSnapshotIntoCurrentScenes(
  currentScenes: JsonRecord[],
  snapshot: StoryboardReviewSnapshot,
): { scenes: JsonRecord[]; restoredSceneIds: string[]; skippedSceneIds: string[] } {
  const currentById = new Map(currentScenes.map((scene) => [String(scene.id), scene]));
  const snapshotById = new Map(snapshot.scenes.map((scene) => [String(scene.id), scene as JsonRecord]));
  const restoredSceneIds: string[] = [];
  const scenes = currentScenes.map((current) => {
    const saved = snapshotById.get(String(current.id));
    if (!saved) return current;
    const next = { ...current };
    for (const field of STORYBOARD_OWNED_SCENE_FIELDS) {
      if (field in saved) next[field] = structuredClone(saved[field]);
      else if (field === 'storyboardFrames') next[field] = [];
    }
    restoredSceneIds.push(String(current.id));
    return next;
  });
  return {
    scenes,
    restoredSceneIds,
    skippedSceneIds: snapshot.scenes
      .map((scene) => String(scene.id))
      .filter((sceneId) => !currentById.has(sceneId)),
  };
}

function mapRound(row: JsonRecord, includeSnapshot = false): StoryboardReviewRound {
  return {
    id: String(row.id), projectId: String(row.project_id), manuscriptId: String(row.manuscript_id),
    version: Number(row.version), label: String(row.label), summary: row.summary ?? null,
    snapshotHash: String(row.snapshot_hash), scriptFingerprint: String(row.script_fingerprint),
    status: row.status, frameCount: Number(row.frame_count),
    totalDurationSeconds: Number(row.total_duration_seconds), createdBy: String(row.created_by),
    approvedBy: row.approved_by ?? null, submittedAt: new Date(row.submitted_at).toISOString(),
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    ...(includeSnapshot ? { snapshot: row.snapshot as StoryboardReviewSnapshot } : {}),
  };
}

function mapComment(row: JsonRecord) {
  return {
    id: String(row.id), reviewRoundId: String(row.review_round_id), frameId: row.frame_id ?? null,
    parentId: row.parent_id ?? null, authorDisplayName: String(row.author_display_name),
    body: String(row.body), visibility: row.visibility, anchorX: row.anchor_x ?? null,
    anchorY: row.anchor_y ?? null, status: row.status,
    assignedTo: row.assigned_to ?? null,
    dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
    resolutionNote: row.resolution_note ?? null,
    resolvedBy: row.resolved_by ?? null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    resolvedInRoundId: row.resolved_in_round_id ?? null,
    carriedFromCommentId: row.carried_from_comment_id ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function mapDecision(row: JsonRecord) {
  return {
    id: String(row.id), reviewRoundId: String(row.review_round_id), decision: row.decision,
    expectedSnapshotHash: String(row.expected_snapshot_hash),
    actorDisplayName: String(row.actor_display_name), note: row.note ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapInboxItem(row: JsonRecord) {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    id: String(row.id),
    eventType: String(row.event_type),
    title: String(row.title),
    message: row.message == null ? null : String(row.message),
    reviewRoundId: String(metadata.reviewRoundId ?? ''),
    roundVersion: Number(metadata.roundVersion ?? 0),
    frameId: metadata.frameId == null ? null : String(metadata.frameId),
    actorDisplayName: metadata.actorDisplayName == null ? null : String(metadata.actorDisplayName),
    decision: metadata.decision == null ? null : String(metadata.decision),
    createdAt: new Date(row.created_at).toISOString(),
    read: Boolean(row.read),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function rawToken(): string {
  return randomBytes(32).toString('base64url');
}

const publicAttempts = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

function rejectIfRateLimited(
  req: Request,
  res: Response,
  bucket: string,
  limit: number,
  windowMs = 10 * 60_000,
): boolean {
  const now = Date.now();
  if (publicAttempts.size > 5_000) {
    for (const [key, value] of publicAttempts) {
      if (value.resetAt <= now) publicAttempts.delete(key);
    }
  }
  const key = `${bucket}:${clientIp(req)}`;
  const current = publicAttempts.get(key);
  if (!current || current.resetAt <= now) {
    publicAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  if (current.count <= limit) return false;
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1_000))));
  res.status(429).json({ error: 'rate_limited' });
  return true;
}

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    return handler(req, res).catch(next);
  };
}

async function loadCurrentBundle(
  manuscriptsService: CastingManuscriptsService,
  projectId: string,
  manuscriptId: string,
) {
  const [manuscript, scenes, dialogue] = await Promise.all([
    manuscriptsService.getManuscript(manuscriptId),
    manuscriptsService.getScenes(manuscriptId),
    manuscriptsService.getDialogue(manuscriptId),
  ]);
  if (!manuscript || projectIdOf(manuscript) !== projectId) return null;
  const snapshot = buildStoryboardReviewSnapshot({ manuscriptId, manuscript, scenes, dialogue });
  const bytes = Buffer.byteLength(JSON.stringify(snapshot));
  if (bytes > MAX_SNAPSHOT_BYTES) {
    const error = new Error('snapshot_too_large') as Error & { status?: number };
    error.status = 413;
    throw error;
  }
  return { snapshot, scenes };
}

async function loadCurrentSnapshot(
  manuscriptsService: CastingManuscriptsService,
  projectId: string,
  manuscriptId: string,
) {
  const bundle = await loadCurrentBundle(manuscriptsService, projectId, manuscriptId);
  return bundle?.snapshot ?? null;
}

async function withClient<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { return await work(client); } finally { client.release(); }
}

async function resolveShare(pool: Pool, token: string) {
  if (!token || token.length > 200) return null;
  const result = await pool.query(
    `SELECT l.*, r.*,
            l.id AS share_link_id, l.access_mode AS share_access_mode,
            l.require_identity AS share_require_identity,
            l.expires_at AS share_expires_at,
            l.created_at AS share_created_at
       FROM storyboard_review_share_links l
       JOIN storyboard_review_rounds r ON r.id = l.review_round_id
      WHERE l.token_hash = $1 AND l.revoked_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > now())`,
    [hashToken(token)],
  );
  return result.rows[0] ?? null;
}

async function resolveReviewer(pool: Pool, shareLinkId: string, token: string | undefined) {
  if (!token || token.length > 200) return null;
  const result = await pool.query(
    `UPDATE storyboard_review_sessions
        SET last_seen_at = now()
      WHERE share_link_id = $1 AND reviewer_token_hash = $2
      RETURNING id, display_name, email`,
    [shareLinkId, hashToken(token)],
  );
  return result.rows[0] ?? null;
}

export function registerStoryboardReviewRoutes(
  router: Router,
  pool: Pool,
  deps: {
    auth: Middleware;
    canView: Middleware;
    canManage: Middleware;
    manuscriptsService: CastingManuscriptsService;
    upsertNotification?: (input: UpsertProducerNotificationInput) => Promise<void>;
  },
): void {
  const base = '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-rounds';
  const inboxBase = '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-inbox';
  const upsertNotification = deps.upsertNotification
    ?? ((input: UpsertProducerNotificationInput) => upsertProducerProjectNotification(pool, input));

  router.get(inboxBase, deps.auth, deps.canView, asyncHandler(async (req, res) => {
    const userId = String((req as AuthedRequest).userId ?? '');
    const result = await pool.query(
      `SELECT notification.*,
              reads.read_at,
              CASE WHEN reads.read_at IS NULL THEN FALSE ELSE TRUE END AS read
         FROM role_room_project_notifications notification
         JOIN storyboard_review_rounds review_round
           ON review_round.id::text = notification.metadata->>'reviewRoundId'
          AND review_round.project_id = notification.project_id
          AND review_round.manuscript_id = $2
         LEFT JOIN role_room_project_notification_reads reads
           ON reads.notification_id = notification.id
          AND reads.user_id = $3
        WHERE notification.project_id = $1
          AND notification.audience IN ('producer_team', 'all')
          AND notification.inbox_type = 'storyboard_review'
          AND notification.archived_at IS NULL
        ORDER BY notification.updated_at DESC, notification.created_at DESC
        LIMIT 100`,
      [req.params.projectId, req.params.manuscriptId, userId],
    );
    const items = result.rows.map(mapInboxItem);
    res.json({ success: true, data: {
      items,
      unreadCount: items.filter((item) => !item.read).length,
    } });
  }));

  router.post(`${inboxBase}/read-all`, deps.auth, deps.canView, asyncHandler(async (req, res) => {
    const userId = String((req as AuthedRequest).userId ?? '');
    await pool.query(
      `INSERT INTO role_room_project_notification_reads (notification_id, user_id, read_at)
       SELECT notification.id, $3, NOW()
         FROM role_room_project_notifications notification
         JOIN storyboard_review_rounds review_round
           ON review_round.id::text = notification.metadata->>'reviewRoundId'
          AND review_round.project_id = notification.project_id
          AND review_round.manuscript_id = $2
        WHERE notification.project_id = $1
          AND notification.audience IN ('producer_team', 'all')
          AND notification.inbox_type = 'storyboard_review'
          AND notification.archived_at IS NULL
       ON CONFLICT (notification_id, user_id)
       DO UPDATE SET read_at = EXCLUDED.read_at`,
      [req.params.projectId, req.params.manuscriptId, userId],
    );
    res.json({ success: true });
  }));

  router.post(`${inboxBase}/:notificationId/read`, deps.auth, deps.canView, asyncHandler(async (req, res) => {
    const userId = String((req as AuthedRequest).userId ?? '');
    const notification = await pool.query(
      `SELECT notification.id
         FROM role_room_project_notifications notification
         JOIN storyboard_review_rounds review_round
           ON review_round.id::text = notification.metadata->>'reviewRoundId'
          AND review_round.project_id = notification.project_id
          AND review_round.manuscript_id = $3
        WHERE notification.id = $1
          AND notification.project_id = $2
          AND notification.audience IN ('producer_team', 'all')
          AND notification.inbox_type = 'storyboard_review'
          AND notification.archived_at IS NULL
        LIMIT 1`,
      [req.params.notificationId, req.params.projectId, req.params.manuscriptId],
    );
    if (!notification.rows[0]) {
      res.status(404).json({ error: 'storyboard_review_notification_not_found' }); return;
    }
    await pool.query(
      `INSERT INTO role_room_project_notification_reads (notification_id, user_id, read_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (notification_id, user_id)
       DO UPDATE SET read_at = EXCLUDED.read_at`,
      [req.params.notificationId, userId],
    );
    res.json({ success: true });
  }));

  router.get(base, deps.auth, deps.canView, asyncHandler(async (req, res) => {
    const snapshot = await loadCurrentSnapshot(
      deps.manuscriptsService, String(req.params.projectId), String(req.params.manuscriptId),
    );
    if (!snapshot) { res.status(404).json({ error: 'manuscript_not_found' }); return; }
    const result = await pool.query(
      `SELECT id, project_id, manuscript_id, version, label, summary, snapshot_hash,
              script_fingerprint, status, frame_count, total_duration_seconds,
              created_by, approved_by, submitted_at, approved_at, created_at
         FROM storyboard_review_rounds
        WHERE project_id = $1 AND manuscript_id = $2
        ORDER BY version DESC`,
      [req.params.projectId, req.params.manuscriptId],
    );
    res.json({ success: true, data: result.rows.map((row) => mapRound(row)) });
  }));

  router.post(base, deps.auth, deps.canManage, asyncHandler(async (req, res) => {
    const parsed = createRoundBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const projectId = String(req.params.projectId);
    const manuscriptId = String(req.params.manuscriptId);
    const snapshot = await loadCurrentSnapshot(deps.manuscriptsService, projectId, manuscriptId);
    if (!snapshot) { res.status(404).json({ error: 'manuscript_not_found' }); return; }
    const snapshotHash = storyboardReviewHash(snapshot);
    const scriptFingerprint = storyboardReviewHash(scriptView(snapshot));
    const frames = snapshot.scenes.flatMap((scene) => scene.storyboardFrames);
    const duration = frames.reduce((sum, frame) => sum + Math.max(0, Number(frame.duration) || 0), 0);
    const created = await withClient(pool, async (client) => {
      await client.query('BEGIN');
      try {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`storyboard-review:${manuscriptId}`]);
        const previousResult = await client.query(
          `SELECT id FROM storyboard_review_rounds
            WHERE project_id = $1 AND manuscript_id = $2
            ORDER BY version DESC LIMIT 1`,
          [projectId, manuscriptId],
        );
        await client.query(
          `UPDATE storyboard_review_rounds SET status = 'superseded'
            WHERE project_id = $1 AND manuscript_id = $2 AND status = 'in_review'`,
          [projectId, manuscriptId],
        );
        const versionResult = await client.query(
          `SELECT COALESCE(MAX(version), 0) + 1 AS version
             FROM storyboard_review_rounds WHERE project_id = $1 AND manuscript_id = $2`,
          [projectId, manuscriptId],
        );
        const inserted = await client.query(
          `INSERT INTO storyboard_review_rounds
             (project_id, manuscript_id, version, label, summary, snapshot, snapshot_hash,
              script_fingerprint, frame_count, total_duration_seconds, created_by)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)
           RETURNING *`,
          [projectId, manuscriptId, Number(versionResult.rows[0].version), parsed.data.label,
            parsed.data.summary ?? null, JSON.stringify(snapshot), snapshotHash, scriptFingerprint,
            frames.length, duration, (req as AuthedRequest).userId],
        );
        let carriedCommentCount = 0;
        const previousRoundId = previousResult.rows[0]?.id;
        if (previousRoundId) {
          const carried = await client.query(
            `INSERT INTO storyboard_review_comments
               (review_round_id, frame_id, author_kind, author_user_id, reviewer_session_id,
                author_display_name, body, visibility, anchor_x, anchor_y, status,
                assigned_to, due_at, carried_from_comment_id)
             SELECT $1, frame_id, author_kind, author_user_id, reviewer_session_id,
                    author_display_name, body, visibility, anchor_x, anchor_y, 'open',
                    assigned_to, due_at, id
               FROM storyboard_review_comments
              WHERE review_round_id = $2 AND status = 'open'
              ORDER BY created_at
             RETURNING id`,
            [inserted.rows[0].id, previousRoundId],
          );
          carriedCommentCount = carried.rowCount ?? carried.rows.length;
        }
        await client.query('COMMIT');
        return { row: inserted.rows[0], carriedCommentCount };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
    const { row, carriedCommentCount } = created;
    const actorUserId = String((req as AuthedRequest).userId ?? '');
    await upsertNotification({
      projectId,
      audience: 'producer_team',
      eventType: 'storyboard_review_round_created',
      title: `Storyboard v${Number(row.version)} er sendt til review`,
      message: row.summary || `${Number(row.frame_count)} shots er låst for tilbakemelding.`,
      linkedEntityType: 'storyboard_review_round',
      linkedEntityId: String(row.id),
      createdByUserId: actorUserId,
      createdByRole: 'storyboard_manager',
      initiallyReadByUserId: actorUserId,
      metadata: {
        inboxType: 'storyboard_review', manuscriptId, reviewRoundId: String(row.id),
        roundVersion: Number(row.version), snapshotHash: String(row.snapshot_hash),
      },
    });
    res.status(201).json({ success: true, data: {
      ...mapRound(row, true), carriedCommentCount,
    } });
  }));

  router.get(`${base}/:roundId`, deps.auth, deps.canView, asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT * FROM storyboard_review_rounds WHERE id = $1 AND project_id = $2 AND manuscript_id = $3',
      [req.params.roundId, req.params.projectId, req.params.manuscriptId],
    );
    const row = result.rows[0];
    if (!row) { res.status(404).json({ error: 'review_round_not_found' }); return; }
    const [comments, decisions, links] = await Promise.all([
      pool.query('SELECT * FROM storyboard_review_comments WHERE review_round_id = $1 ORDER BY created_at', [row.id]),
      pool.query('SELECT * FROM storyboard_review_decisions WHERE review_round_id = $1 ORDER BY created_at DESC', [row.id]),
      pool.query(`SELECT id, review_round_id, access_mode, require_identity, expires_at, revoked_at, created_at
                    FROM storyboard_review_share_links WHERE review_round_id = $1 ORDER BY created_at DESC`, [row.id]),
    ]);
    res.json({ success: true, data: {
      ...mapRound(row, true), comments: comments.rows.map(mapComment), decisions: decisions.rows.map(mapDecision),
      shareLinks: links.rows.map((link) => ({
        id: String(link.id), reviewRoundId: String(link.review_round_id), accessMode: link.access_mode,
        requireIdentity: link.require_identity, expiresAt: link.expires_at?.toISOString?.() ?? link.expires_at ?? null,
        revokedAt: link.revoked_at?.toISOString?.() ?? link.revoked_at ?? null,
        createdAt: new Date(link.created_at).toISOString(),
      })),
    } });
  }));

  router.patch(`${base}/:roundId/comments/:commentId`, deps.auth, deps.canManage, asyncHandler(async (req, res) => {
    const parsed = commentResolutionBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const { projectId, manuscriptId, roundId, commentId } = req.params;
    const sourceRound = await pool.query(
      `SELECT id, version FROM storyboard_review_rounds
        WHERE id = $1 AND project_id = $2 AND manuscript_id = $3`,
      [roundId, projectId, manuscriptId],
    );
    if (!sourceRound.rows[0]) { res.status(404).json({ error: 'review_round_not_found' }); return; }
    if (parsed.data.resolvedInRoundId) {
      const targetRound = await pool.query(
        `SELECT id FROM storyboard_review_rounds
          WHERE id = $1 AND project_id = $2 AND manuscript_id = $3`,
        [parsed.data.resolvedInRoundId, projectId, manuscriptId],
      );
      if (!targetRound.rows[0]) {
        res.status(400).json({ error: 'resolved_revision_not_in_manuscript' }); return;
      }
    }
    const hasAssignedTo = Object.prototype.hasOwnProperty.call(parsed.data, 'assignedTo');
    const hasDueAt = Object.prototype.hasOwnProperty.call(parsed.data, 'dueAt');
    const hasResolutionNote = Object.prototype.hasOwnProperty.call(parsed.data, 'resolutionNote');
    const hasResolvedInRoundId = Object.prototype.hasOwnProperty.call(parsed.data, 'resolvedInRoundId');
    const actorUserId = String((req as AuthedRequest).userId ?? '');
    const updated = await pool.query(
      `UPDATE storyboard_review_comments AS comment
          SET status = COALESCE($5::varchar, comment.status),
              assigned_to = CASE WHEN $6 THEN $7 ELSE comment.assigned_to END,
              due_at = CASE WHEN $8 THEN $9::timestamptz ELSE comment.due_at END,
              resolution_note = CASE
                WHEN $5::text = 'open' THEN NULL
                WHEN $10 THEN $11 ELSE comment.resolution_note END,
              resolved_in_round_id = CASE
                WHEN $5::text = 'open' THEN NULL
                WHEN $12 THEN $13::uuid ELSE comment.resolved_in_round_id END,
              resolved_by = CASE
                WHEN $5::text = 'resolved' THEN $14
                WHEN $5::text = 'open' THEN NULL ELSE comment.resolved_by END,
              resolved_at = CASE
                WHEN $5::text = 'resolved' THEN now()
                WHEN $5::text = 'open' THEN NULL ELSE comment.resolved_at END,
              updated_at = now()
         FROM storyboard_review_rounds AS review_round
        WHERE comment.id = $1
          AND comment.review_round_id = $2
          AND review_round.id = comment.review_round_id
          AND review_round.project_id = $3
          AND review_round.manuscript_id = $4
      RETURNING comment.*`,
      [commentId, roundId, projectId, manuscriptId, parsed.data.status ?? null,
        hasAssignedTo, parsed.data.assignedTo ?? null,
        hasDueAt, parsed.data.dueAt ?? null,
        hasResolutionNote, parsed.data.resolutionNote ?? null,
        hasResolvedInRoundId, parsed.data.resolvedInRoundId ?? null,
        actorUserId],
    );
    const comment = updated.rows[0];
    if (!comment) { res.status(404).json({ error: 'review_comment_not_found' }); return; }
    if (parsed.data.status) {
      const resolved = parsed.data.status === 'resolved';
      await upsertNotification({
        projectId: String(projectId),
        audience: 'producer_team',
        eventType: resolved ? 'storyboard_review_comment_resolved' : 'storyboard_review_comment_reopened',
        title: `${resolved ? 'Løst' : 'Gjenåpnet'} review-punkt i storyboard v${Number(sourceRound.rows[0].version)}`,
        message: parsed.data.resolutionNote || String(comment.body).slice(0, 500),
        linkedEntityType: 'storyboard_review_comment',
        linkedEntityId: String(comment.id),
        createdByUserId: actorUserId,
        createdByRole: 'storyboard_manager',
        initiallyReadByUserId: actorUserId,
        metadata: {
          inboxType: 'storyboard_review', manuscriptId, reviewRoundId: roundId,
          roundVersion: Number(sourceRound.rows[0].version), frameId: comment.frame_id ?? null,
          resolvedInRoundId: comment.resolved_in_round_id ?? null,
        },
      });
    }
    res.json({ success: true, data: mapComment(comment) });
  }));

  router.get(`${base}/:roundId/diff`, deps.auth, deps.canView, asyncHandler(async (req, res) => {
    const result = await pool.query(
      'SELECT snapshot FROM storyboard_review_rounds WHERE id = $1 AND project_id = $2 AND manuscript_id = $3',
      [req.params.roundId, req.params.projectId, req.params.manuscriptId],
    );
    if (!result.rows[0]) { res.status(404).json({ error: 'review_round_not_found' }); return; }
    const current = await loadCurrentSnapshot(
      deps.manuscriptsService, String(req.params.projectId), String(req.params.manuscriptId),
    );
    if (!current) { res.status(404).json({ error: 'manuscript_not_found' }); return; }
    res.json({ success: true, data: diffStoryboardReviewSnapshots(result.rows[0].snapshot, current) });
  }));

  router.post(`${base}/:roundId/restore`, deps.auth, deps.canManage, asyncHandler(async (req, res) => {
    const parsed = restoreBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const result = await pool.query(
      'SELECT * FROM storyboard_review_rounds WHERE id = $1 AND project_id = $2 AND manuscript_id = $3',
      [req.params.roundId, req.params.projectId, req.params.manuscriptId],
    );
    const round = result.rows[0];
    if (!round) { res.status(404).json({ error: 'review_round_not_found' }); return; }
    if (round.snapshot_hash !== parsed.data.confirmSnapshotHash) {
      res.status(409).json({ error: 'snapshot_confirmation_mismatch' }); return;
    }
    const manuscriptId = String(req.params.manuscriptId);
    const current = await loadCurrentBundle(deps.manuscriptsService, String(req.params.projectId), manuscriptId);
    if (!current) { res.status(404).json({ error: 'manuscript_not_found' }); return; }
    const currentHash = storyboardReviewHash(current.snapshot);
    if (currentHash !== parsed.data.expectedCurrentHash) {
      res.status(409).json({ error: 'current_storyboard_changed', currentHash }); return;
    }
    const merged = mergeStoryboardSnapshotIntoCurrentScenes(current.scenes, round.snapshot);
    await deps.manuscriptsService.replaceScenes(manuscriptId, merged.scenes);
    res.json({ success: true, data: {
      restoredSceneIds: merged.restoredSceneIds, skippedSceneIds: merged.skippedSceneIds,
      restoredFromVersion: Number(round.version), snapshotHash: String(round.snapshot_hash),
    } });
  }));

  router.post(`${base}/:roundId/share-links`, deps.auth, deps.canManage, asyncHandler(async (req, res) => {
    const parsed = shareBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const round = await pool.query(
      'SELECT id, status FROM storyboard_review_rounds WHERE id = $1 AND project_id = $2 AND manuscript_id = $3',
      [req.params.roundId, req.params.projectId, req.params.manuscriptId],
    );
    if (!round.rows[0]) { res.status(404).json({ error: 'review_round_not_found' }); return; }
    if (round.rows[0].status === 'superseded') {
      res.status(409).json({ error: 'review_round_superseded' }); return;
    }
    const token = rawToken();
    const inserted = await pool.query(
      `INSERT INTO storyboard_review_share_links
         (review_round_id, project_id, manuscript_id, token_hash, access_mode,
          require_identity, expires_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, review_round_id, access_mode, require_identity, expires_at, created_at`,
      [req.params.roundId, req.params.projectId, req.params.manuscriptId, hashToken(token),
        parsed.data.accessMode, parsed.data.requireIdentity, parsed.data.expiresAt ?? null,
        (req as AuthedRequest).userId],
    );
    const link = inserted.rows[0];
    res.status(201).json({ success: true, data: {
      id: String(link.id), reviewRoundId: String(link.review_round_id), accessMode: link.access_mode,
      requireIdentity: link.require_identity, expiresAt: link.expires_at?.toISOString?.() ?? link.expires_at ?? null,
      createdAt: new Date(link.created_at).toISOString(), token,
    } });
  }));

  router.delete(`${base}/:roundId/share-links/:shareId`, deps.auth, deps.canManage, asyncHandler(async (req, res) => {
    const result = await pool.query(
      `UPDATE storyboard_review_share_links SET revoked_at = now()
        WHERE id = $1 AND review_round_id = $2 AND project_id = $3 AND manuscript_id = $4
          AND revoked_at IS NULL RETURNING id`,
      [req.params.shareId, req.params.roundId, req.params.projectId, req.params.manuscriptId],
    );
    if (!result.rowCount) { res.status(404).json({ error: 'share_link_not_found' }); return; }
    res.json({ success: true });
  }));

  router.use('/storyboard-review/:token', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  router.get('/storyboard-review/:token', asyncHandler(async (req, res) => {
    if (rejectIfRateLimited(req, res, 'storyboard-review:view', 240)) return;
    const share = await resolveShare(pool, String(req.params.token));
    if (!share) { res.status(404).json({ error: 'review_link_not_found' }); return; }
    const reviewer = await resolveReviewer(
      pool, String(share.share_link_id), req.header('x-storyboard-reviewer') || undefined,
    );
    const round = mapRound(share, Boolean(reviewer) || !share.share_require_identity);
    if (share.share_require_identity && !reviewer) {
      res.json({ success: true, data: {
        requiresIdentity: true,
        round: { id: round.id, version: round.version, label: round.label, status: round.status,
          snapshotHash: round.snapshotHash, frameCount: round.frameCount },
        share: { accessMode: share.share_access_mode, requireIdentity: true, expiresAt: share.share_expires_at },
      } });
      return;
    }
    const [comments, decisions] = await Promise.all([
      pool.query(`SELECT * FROM storyboard_review_comments
                   WHERE review_round_id = $1 AND visibility = 'client' ORDER BY created_at`, [share.id]),
      pool.query('SELECT * FROM storyboard_review_decisions WHERE review_round_id = $1 ORDER BY created_at DESC', [share.id]),
    ]);
    res.json({ success: true, data: {
      requiresIdentity: false,
      round: { ...round, comments: comments.rows.map(mapComment), decisions: decisions.rows.map(mapDecision) },
      share: { accessMode: share.share_access_mode, requireIdentity: share.share_require_identity,
        expiresAt: share.share_expires_at },
      reviewer: reviewer ? { id: reviewer.id, displayName: reviewer.display_name, email: reviewer.email } : null,
    } });
  }));

  router.post('/storyboard-review/:token/sessions', asyncHandler(async (req, res) => {
    if (rejectIfRateLimited(req, res, 'storyboard-review:session', 20)) return;
    const parsed = sessionBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const share = await resolveShare(pool, String(req.params.token));
    if (!share) { res.status(404).json({ error: 'review_link_not_found' }); return; }
    const token = rawToken();
    const result = await pool.query(
      `INSERT INTO storyboard_review_sessions
         (share_link_id, reviewer_token_hash, display_name, email)
       VALUES ($1,$2,$3,$4) RETURNING id, display_name, email`,
      [share.share_link_id, hashToken(token), parsed.data.displayName, parsed.data.email ?? null],
    );
    res.status(201).json({ success: true, data: {
      reviewerToken: token, reviewer: { id: result.rows[0].id,
        displayName: result.rows[0].display_name, email: result.rows[0].email },
    } });
  }));

  router.post('/storyboard-review/:token/comments', asyncHandler(async (req, res) => {
    if (rejectIfRateLimited(req, res, 'storyboard-review:comment', 45)) return;
    const parsed = commentBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const share = await resolveShare(pool, String(req.params.token));
    if (!share) { res.status(404).json({ error: 'review_link_not_found' }); return; }
    if (!['comment', 'approve'].includes(share.share_access_mode)) {
      res.status(403).json({ error: 'comments_not_allowed' }); return;
    }
    const reviewer = await resolveReviewer(
      pool, String(share.share_link_id), req.header('x-storyboard-reviewer') || undefined,
    );
    if (!reviewer) { res.status(401).json({ error: 'reviewer_identity_required' }); return; }
    if (parsed.data.frameId) {
      const frameExists = framesById(share.snapshot).has(parsed.data.frameId);
      if (!frameExists) { res.status(400).json({ error: 'frame_not_in_revision' }); return; }
    }
    const inserted = await withClient(pool, async (client) => {
      await client.query('BEGIN');
      try {
        const locked = await client.query(
          'SELECT status FROM storyboard_review_rounds WHERE id = $1 FOR UPDATE', [share.id],
        );
        if (!locked.rows[0] || ['approved', 'superseded'].includes(locked.rows[0].status)) {
          const error = new Error('review_round_locked') as Error & { status?: number };
          error.status = 409; throw error;
        }
        if (parsed.data.parentId) {
          const parent = await client.query(
            'SELECT id FROM storyboard_review_comments WHERE id = $1 AND review_round_id = $2',
            [parsed.data.parentId, share.id],
          );
          if (!parent.rows[0]) {
            const error = new Error('parent_comment_not_found') as Error & { status?: number };
            error.status = 400; throw error;
          }
        }
        const result = await client.query(
          `INSERT INTO storyboard_review_comments
             (review_round_id, frame_id, parent_id, author_kind, reviewer_session_id,
              author_display_name, body, visibility, anchor_x, anchor_y)
           VALUES ($1,$2,$3,'reviewer',$4,$5,$6,'client',$7,$8) RETURNING *`,
          [share.id, parsed.data.frameId ?? null, parsed.data.parentId ?? null, reviewer.id,
            reviewer.display_name, parsed.data.body, parsed.data.anchorX ?? null, parsed.data.anchorY ?? null],
        );
        await client.query('COMMIT');
        return result.rows[0];
      } catch (error) {
        await client.query('ROLLBACK'); throw error;
      }
    });
    await upsertNotification({
      projectId: String(share.project_id),
      audience: 'producer_team',
      eventType: 'storyboard_review_comment_added',
      title: `${reviewer.display_name} kommenterte storyboard v${Number(share.version)}`,
      message: String(inserted.body).slice(0, 500),
      linkedEntityType: 'storyboard_review_comment',
      linkedEntityId: String(inserted.id),
      createdByRole: 'client_reviewer',
      metadata: {
        inboxType: 'storyboard_review', manuscriptId: String(share.manuscript_id),
        reviewRoundId: String(share.id), roundVersion: Number(share.version),
        frameId: inserted.frame_id ?? null, actorDisplayName: String(reviewer.display_name),
      },
    });
    res.status(201).json({ success: true, data: mapComment(inserted) });
  }));

  router.post('/storyboard-review/:token/decisions', asyncHandler(async (req, res) => {
    if (rejectIfRateLimited(req, res, 'storyboard-review:decision', 15)) return;
    const parsed = decisionBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    const share = await resolveShare(pool, String(req.params.token));
    if (!share) { res.status(404).json({ error: 'review_link_not_found' }); return; }
    if (share.share_access_mode !== 'approve') {
      res.status(403).json({ error: 'approval_not_allowed' }); return;
    }
    const reviewer = await resolveReviewer(
      pool, String(share.share_link_id), req.header('x-storyboard-reviewer') || undefined,
    );
    if (!reviewer) { res.status(401).json({ error: 'reviewer_identity_required' }); return; }
    const decision = await withClient(pool, async (client) => {
      await client.query('BEGIN');
      try {
        const locked = await client.query(
          'SELECT id, status, snapshot_hash FROM storyboard_review_rounds WHERE id = $1 FOR UPDATE', [share.id],
        );
        const round = locked.rows[0];
        if (!round || round.status === 'approved' || round.status === 'superseded') {
          const error = new Error('review_round_locked') as Error & { status?: number };
          error.status = 409; throw error;
        }
        if (round.snapshot_hash !== parsed.data.expectedSnapshotHash) {
          const error = new Error('snapshot_confirmation_mismatch') as Error & { status?: number };
          error.status = 409; throw error;
        }
        if (parsed.data.decision === 'approved' && !parsed.data.confirmOpenComments) {
          const openComments = await client.query(
            `SELECT COUNT(*)::int AS count FROM storyboard_review_comments
              WHERE review_round_id = $1 AND status = 'open'`,
            [share.id],
          );
          if (Number(openComments.rows[0]?.count ?? 0) > 0) {
            const error = new Error('open_comments_require_confirmation') as Error & { status?: number };
            error.status = 409; throw error;
          }
        }
        const inserted = await client.query(
          `INSERT INTO storyboard_review_decisions
             (review_round_id, decision, expected_snapshot_hash, actor_kind,
              reviewer_session_id, actor_display_name, note)
           VALUES ($1,$2,$3,'reviewer',$4,$5,$6) RETURNING *`,
          [share.id, parsed.data.decision, parsed.data.expectedSnapshotHash, reviewer.id,
            reviewer.display_name, parsed.data.note ?? null],
        );
        await client.query(
          `UPDATE storyboard_review_rounds
              SET status = $2, approved_by = $3,
                  approved_at = CASE WHEN $4 THEN now() ELSE NULL END
            WHERE id = $1`,
          [share.id, parsed.data.decision,
            parsed.data.decision === 'approved' ? reviewer.display_name : null,
            parsed.data.decision === 'approved'],
        );
        await client.query('COMMIT');
        return inserted.rows[0];
      } catch (error) {
        await client.query('ROLLBACK'); throw error;
      }
    });
    const approved = decision.decision === 'approved';
    await upsertNotification({
      projectId: String(share.project_id),
      audience: 'producer_team',
      eventType: approved ? 'storyboard_review_approved' : 'storyboard_review_changes_requested',
      title: `${reviewer.display_name} ${approved ? 'godkjente' : 'ba om endringer på'} storyboard v${Number(share.version)}`,
      message: decision.note || (approved ? 'Den låste revisjonen er godkjent.' : 'Revisjonen trenger en ny gjennomgang.'),
      linkedEntityType: 'storyboard_review_decision',
      linkedEntityId: String(decision.id),
      createdByRole: 'client_reviewer',
      metadata: {
        inboxType: 'storyboard_review', manuscriptId: String(share.manuscript_id),
        reviewRoundId: String(share.id), roundVersion: Number(share.version),
        actorDisplayName: String(reviewer.display_name), decision: String(decision.decision),
        snapshotHash: String(decision.expected_snapshot_hash),
      },
    });
    res.status(201).json({ success: true, data: mapDecision(decision) });
  }));
}

export function createStoryboardReviewRouter(
  pool: Pool,
  deps: {
    activeSessions?: Map<string, any>;
    manuscriptsService: CastingManuscriptsService;
  },
): Router {
  const router = express.Router();
  registerStoryboardReviewRoutes(router, pool, {
    auth: requireStoryboardAuth(pool, deps.activeSessions),
    canView: requireStoryboardAccess(pool, 'view'),
    canManage: requireStoryboardAccess(pool, 'manage'),
    manuscriptsService: deps.manuscriptsService,
  });
  router.use(storyboardReviewErrorHandler);
  return router;
}

export function storyboardReviewErrorHandler(
  error: unknown, _req: Request, res: Response, next: NextFunction,
): void {
  if (res.headersSent) { next(error); return; }
  const status = typeof error === 'object' && error && 'status' in error
    ? Number((error as { status?: number }).status) : 500;
  const message = error instanceof Error ? error.message : 'internal_error';
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: status >= 400 && status < 500 ? message : 'storyboard_review_failed',
  });
}
