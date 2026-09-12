import { createHash, randomBytes } from 'node:crypto';
import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import type { CastingManuscriptsService } from './casting-manuscripts-service.js';
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
}).strict();

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
    createdAt: new Date(row.created_at).toISOString(),
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
  },
): void {
  const base = '/projects/:projectId/manuscripts/:manuscriptId/storyboard-review-rounds';

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
    const row = await withClient(pool, async (client) => {
      await client.query('BEGIN');
      try {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`storyboard-review:${manuscriptId}`]);
        await client.query(
          `UPDATE storyboard_review_rounds SET status = 'superseded'
            WHERE project_id = $1 AND manuscript_id = $2 AND status = 'in_review'`,
          [projectId, manuscriptId],
        );
        const versionResult = await client.query(
          'SELECT COALESCE(MAX(version), 0) + 1 AS version FROM storyboard_review_rounds WHERE manuscript_id = $1',
          [manuscriptId],
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
        await client.query('COMMIT');
        return inserted.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
    res.status(201).json({ success: true, data: mapRound(row, true) });
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
              SET status = $2, approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE NULL END,
                  approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE NULL END
            WHERE id = $1`,
          [share.id, parsed.data.decision, reviewer.display_name],
        );
        await client.query('COMMIT');
        return inserted.rows[0];
      } catch (error) {
        await client.query('ROLLBACK'); throw error;
      }
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
