import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import { loadPersistedAuthSession } from './auth-session-store.js';
import {
  createSession,
  fetchSession,
  listSessions,
  updateSession,
  softDeleteSession,
} from './capture-sessions-service.js';
import {
  registerAsset,
  fetchAsset,
  listAssets,
  updateAssetLabels,
  updateAssetSignals,
  CaptureAuthzError,
} from './capture-assets-service.js';
import { appendEvents, listEvents } from './capture-events-service.js';
import { addReview, listReviews } from './capture-reviews-service.js';
import {
  abortMultipartUpload,
  completeMultipartUpload,
  signAssetReadUrl,
  signPartUrls,
  startMultipartUpload,
  type UploadError,
} from './capture-upload-service.js';
import { broadcastCaptureEvent } from './capture-websocket.js';
import {
  createClientToken,
  fetchSessionForClient,
  listClientTokens,
  revokeClientToken,
  validateClientToken,
  type ValidatedClientAuth,
} from './capture-client-tokens-service.js';
import {
  fetchAsset as fetchAssetForOwner,
  listAssets as listAssetsForOwner,
} from './capture-assets-service.js';
import { addReview as addReviewRow } from './capture-reviews-service.js';
import { performHandoff, type HandoffFilter } from './capture-handoff-service.js';
import { analyzePhoto, type AnalyzeError } from './capture-analyze-service.js';
import {
  bridgeCaptureSessionToGallery,
  pickAssetsFromCaptureSession,
  type BridgeError,
} from './capture-showcase-bridge.js';
import {
  createMinimalProject,
  fetchProjectDetail,
  linkCaptureSessionToProject,
  setShotCompletion,
  listProjectsForPhotographer,
} from './capture-projects-service.js';
import {
  classifySession,
  type CaptureAssetForCulling,
  type CullingStrictness,
} from './capture-culling-service.js';
import { captureAssets, captureSessions } from '../migrations/capture-schema.js';
import { and, asc, eq } from 'drizzle-orm';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

type AuthedRequest = Request & { userId: string };

const createSessionBody = z.object({
  name: z.string().min(1).max(255),
  clientId: z.string().uuid().optional(),
  startsAt: z.string().datetime(),
});

const updateSessionBody = z.object({
  name: z.string().min(1).max(255).optional(),
  endsAt: z.string().datetime().optional(),
  status: z.enum(['active', 'paused', 'closed']).optional(),
});

const registerAssetBody = z.object({
  originalFilename: z.string().min(1).max(512),
  captureTime: z.string().datetime(),
  mime: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative().optional(),
});

const updateAssetBody = z.object({
  rating: z.number().int().min(0).max(5).optional(),
  colorLabel: z
    .enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray'])
    .nullable()
    .optional(),
  flaggedForClient: z.boolean().optional(),
  rejected: z.boolean().optional(),
});

const createMinimalProjectBody = z.object({
  title: z.string().min(1).max(255),
  clientName: z.string().max(255).optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  location: z.string().max(255).optional(),
  projectType: z.string().max(64).optional(),
});

const linkSessionProjectBody = z.object({
  projectId: z.string().uuid().nullable(),
});

const setShotCompletionBody = z.object({
  isCompleted: z.boolean(),
});

const deliverToShowcaseBody = z.object({
  filter: z.enum(['flagged', 'rating_at_least_4', 'picks_or_4plus', 'all_non_rejected'])
    .default('picks_or_4plus'),
  clientName: z.string().min(1).max(255),
  clientEmail: z.string().email().max(255),
  projectTitle: z.string().min(1).max(255).optional(),
});

// 12 MB cap on the base64 payload — comfortably above any preview JPEG
// Canon emits at ?kind=display, well below Express's default JSON limit.
const analyzeAssetBody = z.object({
  imageBase64: z.string().min(64).max(16 * 1024 * 1024),
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

const assetSignalsBody = z.object({
  sharpness: z.number().min(0).max(100).optional(),
  eyesOpen: z.boolean().optional(),
  faceCount: z.number().int().nonnegative().optional(),
  duplicateGroupId: z.string().uuid().optional(),
});

const postEventsBody = z.object({
  events: z
    .array(
      z.object({
        assetId: z.string().uuid().optional(),
        eventType: z.string().min(1).max(64),
        metadata: z.record(z.string(), z.unknown()).optional(),
        occurredAt: z.string().datetime(),
      }),
    )
    .min(1)
    .max(500),
});

const uploadStartBody = z.object({
  kind: z.enum(['preview', 'full', 'raw']),
  sizeBytes: z.number().int().positive(),
  mime: z.string().min(1).max(128),
  preferredPartSize: z.number().int().positive().optional(),
});

const uploadPartsBody = z.object({
  uploadId: z.string().min(1),
  key: z.string().min(1),
  partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(1000),
});

const uploadCompleteBody = z.object({
  kind: z.enum(['preview', 'full', 'raw']),
  uploadId: z.string().min(1),
  key: z.string().min(1),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10_000),
        etag: z.string().min(1),
      }),
    )
    .min(1),
  checksumSha256: z.string().length(64),
  sizeBytes: z.number().int().positive(),
});

const uploadAbortBody = z.object({
  uploadId: z.string().min(1),
  key: z.string().min(1),
});

const handoffBody = z.object({
  preset: z
    .enum(['auto', 'portrait', 'wedding', 'landscape', 'product', 'studio'])
    .optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  filter: z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('ids'), assetIds: z.array(z.string().uuid()).min(1).max(500) }),
      z.object({ kind: z.literal('flagged') }),
      z.object({
        kind: z.literal('rating_at_least'),
        rating: z.number().int().min(1).max(5),
      }),
    ])
    .default({ kind: 'flagged' }),
  preferredSource: z.enum(['full', 'preview']).optional(),
});

const createClientTokenBody = z.object({
  clientLabel: z.string().min(1).max(255).optional(),
  pin: z.string().min(4).max(16).optional(),
  ttlMinutes: z.number().int().min(5).max(30 * 24 * 60).optional(),
});

const clientReviewBody = z
  .object({
    heart: z.boolean().optional(),
    comment: z.string().max(2000).optional(),
  })
  .refine((d) => d.heart !== undefined || d.comment !== undefined, {
    message: 'At least one of heart or comment must be provided',
  });

function bridgeErrorStatus(error: BridgeError): number {
  switch (error) {
    case 'session_not_found':       return 404;
    case 'no_picks':                return 400;
    case 'sign_failed':             return 502;
    case 'gallery_persist_failed':  return 500;
  }
}

function analyzeErrorStatus(error: AnalyzeError): number {
  switch (error) {
    case 'not_configured':
      return 503;
    case 'timeout':
      return 504;
    case 'upstream_failed':
    case 'invalid_response':
      return 502;
    case 'not_found':
      return 404;
  }
}

function uploadErrorStatus(error: UploadError): number {
  switch (error) {
    case 'not_configured':
      return 503;
    case 'not_found':
      return 404;
    case 'invalid':
      return 400;
  }
}

const createReviewBody = z
  .object({
    heart: z.boolean().optional(),
    rating: z.number().int().min(0).max(5).optional(),
    comment: z.string().max(2000).optional(),
  })
  .refine(
    (data) =>
      data.heart !== undefined || data.rating !== undefined || data.comment !== undefined,
    { message: 'At least one of heart, rating, or comment must be provided' },
  );

async function resolveUser(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  bearer: string | null | undefined,
): Promise<SessionData | null> {
  const token = typeof bearer === 'string' ? bearer.trim() : '';
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) {
    activeSessions?.set(token, persisted);
    return persisted;
  }
  return null;
}

type ClientAuthedRequest = Request & { clientAuth: ValidatedClientAuth };

function requireClientToken(
  db: import('drizzle-orm/node-postgres').NodePgDatabase<Record<string, unknown>>,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawToken = req.headers['x-capture-client-token'];
    if (typeof rawToken !== 'string' || !rawToken) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const pinHeader = req.headers['x-capture-client-pin'];
    const pin = typeof pinHeader === 'string' && pinHeader.length > 0 ? pinHeader : null;
    const result = await validateClientToken(db, rawToken, pin);
    if (!result) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    (req as ClientAuthedRequest).clientAuth = result;
    next();
  };
}

function requireAuth(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    const session = await resolveUser(pool, activeSessions, bearer);
    if (!session?.userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    (req as AuthedRequest).userId = session.userId;
    next();
  };
}

function handleZod<T>(
  res: Response,
  parse: z.SafeParseReturnType<unknown, T>,
): parse is z.SafeParseSuccess<T> {
  if (!parse.success) {
    res.status(400).json({ error: 'invalid_request', details: parse.error.format() });
    return false;
  }
  return true;
}

export function createCaptureRouter(
  pool: Pool,
  activeSessions?: Map<string, SessionData>,
): Router {
  const router = Router();
  const db = drizzle(pool);
  const auth = requireAuth(pool, activeSessions);

  // ── Projects (UniversalDashboard integration) ──────────────

  // List the photographer's projects so the iPad can show a project
  // picker right after sign-in. Returns a slim summary; the
  // /projects/:id detail endpoint carries the full shot list.
  router.get('/projects', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const rows = await listProjectsForPhotographer(db, userId, limit);
    res.json({ projects: rows });
  });

  router.get('/projects/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const detail = await fetchProjectDetail(db, userId, req.params.id);
    if (!detail) {
      res.status(404).json({ error: 'project_not_found' });
      return;
    }
    res.json(detail);
  });

  // Create a minimal project from the iPad — used when the photographer
  // picks "Start simple session" instead of choosing an existing
  // project. Just enough fields for the project to exist in the
  // dashboard; everything else can be filled in from the web later.
  router.post('/projects', auth, async (req, res) => {
    const parsed = createMinimalProjectBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const created = await createMinimalProject(db, {
      ownerUserId: userId,
      title: parsed.data.title,
      clientName: parsed.data.clientName,
      eventDate: parsed.data.eventDate,
      location: parsed.data.location,
      projectType: parsed.data.projectType,
    });
    res.status(201).json(created);
  });

  // Mark a shot complete / incomplete. Body is `{ isCompleted: boolean }`.
  // Lives on /projects so iPad ShotListPanel's local toggle can push
  // back without inventing a new surface — matches the existing link-
  // shot-to-asset pattern a few lines down.
  router.patch('/projects/:projectId/shots/:shotId', auth, async (req, res) => {
    const parsed = setShotCompletionBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const result = await setShotCompletion(
      db,
      userId,
      req.params.projectId,
      req.params.shotId,
      parsed.data.isCompleted,
    );
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.status(200).json(result.data);
  });

  // Link / unlink an existing capture session to a project. Used after
  // a "simple session" auto-creates a project and we need to attach it,
  // or when the photographer changes their mind about which project a
  // session belongs to.
  router.patch('/sessions/:id/project', auth, async (req, res) => {
    const parsed = linkSessionProjectBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const result = await linkCaptureSessionToProject(
      db,
      userId,
      req.params.id,
      parsed.data.projectId,
    );
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.status(204).end();
  });

  // ── Sessions ────────────────────────────────────────────────

  router.post('/sessions', auth, async (req, res) => {
    const parsed = createSessionBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const row = await createSession(db, {
      ownerUserId: userId,
      name: parsed.data.name,
      clientId: parsed.data.clientId,
      startsAt: new Date(parsed.data.startsAt),
    });
    res.status(201).json(row);
  });

  router.get('/sessions', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    const rows = await listSessions(db, userId, limit, offset);
    res.json({ sessions: rows });
  });

  router.get('/sessions/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const row = await fetchSession(db, req.params.id, userId);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(row);
  });

  router.patch('/sessions/:id', auth, async (req, res) => {
    const parsed = updateSessionBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const patch = {
      name: parsed.data.name,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined,
      status: parsed.data.status,
    };
    const row = await updateSession(db, req.params.id, userId, patch);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(row);
  });

  router.delete('/sessions/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await softDeleteSession(db, req.params.id, userId);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  });

  // ── Assets ──────────────────────────────────────────────────

  router.post('/sessions/:sessionId/assets', auth, async (req, res) => {
    const parsed = registerAssetBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    try {
      const row = await registerAsset(db, userId, req.params.sessionId, {
        originalFilename: parsed.data.originalFilename,
        captureTime: new Date(parsed.data.captureTime),
        mime: parsed.data.mime,
        sizeBytes: parsed.data.sizeBytes,
      });
      res.status(201).json(row);
    } catch (err) {
      if (err instanceof CaptureAuthzError) {
        res.status(404).json({ error: 'session_not_found' });
        return;
      }
      throw err;
    }
  });

  router.get('/sessions/:sessionId/assets', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const limit = Math.min(Number(req.query.limit ?? 500), 2000);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    try {
      const rows = await listAssets(db, userId, req.params.sessionId, limit, offset);
      // Attach signed preview URLs so the web enhancer can hydrate each
      // asset into a `SessionImage` without a second round-trip. Matches
      // the shape the `/client/assets` route already returns.
      const withUrls = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          previewUrl: row.previewKey ? await signAssetReadUrl(row.previewKey) : null,
        })),
      );
      res.json({ assets: withUrls });
    } catch (err) {
      if (err instanceof CaptureAuthzError) {
        res.status(404).json({ error: 'session_not_found' });
        return;
      }
      throw err;
    }
  });

  router.get('/assets/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const row = await fetchAsset(db, userId, req.params.id);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(row);
  });

  router.patch('/assets/:id', auth, async (req, res) => {
    const parsed = updateAssetBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const row = await updateAssetLabels(db, userId, req.params.id, parsed.data);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(row);
  });

  router.put('/assets/:id/signals', auth, async (req, res) => {
    const parsed = assetSignalsBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const row = await updateAssetSignals(db, userId, req.params.id, parsed.data);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(row);
  });

  // ── Claude Vision analyse ───────────────────────────────────

  router.post('/assets/:id/analyze', auth, async (req, res) => {
    const parsed = analyzeAssetBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const result = await analyzePhoto({
      db,
      ownerUserId: userId,
      assetId: req.params.id,
      imageBase64: parsed.data.imageBase64,
      mime: parsed.data.mime,
    });
    if (!result.ok) {
      res.status(analyzeErrorStatus(result.error)).json({
        error: result.error,
        detail: result.detail,
      });
      return;
    }
    res.json({ analysis: result.analysis, usage: result.usage });
  });

  // ── Uploads (R2 multipart) ──────────────────────────────────

  router.post('/assets/:id/upload/start', auth, async (req, res) => {
    const parsed = uploadStartBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const r = await startMultipartUpload(
      db,
      userId,
      req.params.id,
      parsed.data.kind,
      parsed.data.sizeBytes,
      parsed.data.mime,
      parsed.data.preferredPartSize,
    );
    if (!r.ok) {
      res.status(uploadErrorStatus(r.error)).json({ error: r.error });
      return;
    }
    res.json(r.result);
  });

  router.post('/assets/:id/upload/parts', auth, async (req, res) => {
    const parsed = uploadPartsBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const r = await signPartUrls(
      db,
      userId,
      req.params.id,
      parsed.data.uploadId,
      parsed.data.key,
      parsed.data.partNumbers,
    );
    if (!r.ok) {
      res.status(uploadErrorStatus(r.error)).json({ error: r.error });
      return;
    }
    res.json(r.result);
  });

  router.post('/assets/:id/upload/complete', auth, async (req, res) => {
    const parsed = uploadCompleteBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const r = await completeMultipartUpload(
      db,
      userId,
      req.params.id,
      parsed.data.kind,
      parsed.data.uploadId,
      parsed.data.key,
      parsed.data.parts,
      parsed.data.checksumSha256,
      parsed.data.sizeBytes,
    );
    if (!r.ok) {
      res.status(uploadErrorStatus(r.error)).json({ error: r.error });
      return;
    }
    res.json(r.result);
  });

  router.post('/assets/:id/upload/abort', auth, async (req, res) => {
    const parsed = uploadAbortBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const r = await abortMultipartUpload(
      db,
      userId,
      req.params.id,
      parsed.data.uploadId,
      parsed.data.key,
    );
    if (!r.ok) {
      res.status(uploadErrorStatus(r.error)).json({ error: r.error });
      return;
    }
    res.status(204).end();
  });

  // ── Events ──────────────────────────────────────────────────

  router.post('/sessions/:sessionId/events', auth, async (req, res) => {
    const parsed = postEventsBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const rows = await appendEvents(
      db,
      userId,
      req.params.sessionId,
      parsed.data.events.map((e) => ({
        assetId: e.assetId,
        eventType: e.eventType,
        metadata: e.metadata,
        occurredAt: new Date(e.occurredAt),
      })),
      userId,
    );
    if (rows.length === 0 && parsed.data.events.length > 0) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }
    for (const row of rows) {
      broadcastCaptureEvent(req.params.sessionId, row);
    }
    res.status(201).json({ events: rows });
  });

  router.get('/sessions/:sessionId/events', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const limit = Math.min(Number(req.query.limit ?? 1000), 5000);
    const rows = await listEvents(db, userId, req.params.sessionId, limit);
    res.json({ events: rows });
  });

  // ── Reviews ─────────────────────────────────────────────────

  router.post('/assets/:id/reviews', auth, async (req, res) => {
    const parsed = createReviewBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const row = await addReview(db, {
      assetId: req.params.id,
      reviewerId: userId,
      reviewerType: 'photographer',
      heart: parsed.data.heart,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });
    if (!row) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    res.status(201).json(row);
  });

  router.get('/assets/:id/reviews', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const rows = await listReviews(db, userId, req.params.id);
    res.json({ reviews: rows });
  });

  // ── Handoff to photo enhancer ───────────────────────────────

  router.post('/sessions/:sessionId/handoff', auth, async (req, res) => {
    const parsed = handoffBody.safeParse(req.body ?? {});
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const result = await performHandoff(db, userId, req.params.sessionId, {
      preset: parsed.data.preset,
      settings: parsed.data.settings,
      filter: parsed.data.filter as HandoffFilter,
      preferredSource: parsed.data.preferredSource,
    });
    if (!result) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }
    broadcastCaptureEvent(req.params.sessionId, {
      type: 'handoff_triggered',
      handoffId: result.handoffId,
      submittedCount: result.submittedCount,
      requestedCount: result.requestedCount,
    });
    res.status(202).json(result);
  });

  // ── Deliver to UniversalShowcase (Phase 2B) ────────────────

  // GET /sessions/:id/cull-suggestions — review-surface helper that
  // groups the session's assets into reject / weak / keep / hero
  // buckets based on on-device signals + Claude AI notes + duplicate
  // clusters. Pure aggregator; doesn't mutate anything, so the
  // photographer can run it as many times as they want while editing.
  router.get('/sessions/:id/cull-suggestions', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const sessionId = req.params.id;
    try {
      // Ownership gate — fetchSession throws if the caller isn't the
      // session owner (or returns null). We verify before touching
      // assets so a stranger can't probe cull output for another
      // photographer's gallery.
      const session = await fetchSession(db, sessionId, userId);
      if (!session) {
        res.status(404).json({ error: 'session_not_found' });
        return;
      }
      const rows = await db
        .select({
          id: captureAssets.id,
          rating: captureAssets.rating,
          rejected: captureAssets.rejected,
          flaggedForClient: captureAssets.flaggedForClient,
          signals: captureAssets.signals,
        })
        .from(captureAssets)
        .where(eq(captureAssets.sessionId, sessionId))
        .orderBy(asc(captureAssets.captureTime));
      const forCulling: CaptureAssetForCulling[] = rows.map((r) => ({
        id: r.id,
        rating: r.rating ?? 0,
        rejected: r.rejected ?? false,
        flaggedForClient: r.flaggedForClient ?? false,
        signals: (r.signals ?? {}) as CaptureAssetForCulling['signals'],
      }));
      const strictnessRaw = typeof req.query.strictness === 'string'
        ? req.query.strictness.trim().toLowerCase()
        : '';
      const strictness: CullingStrictness =
        strictnessRaw === 'conservative' || strictnessRaw === 'aggressive'
          ? (strictnessRaw as CullingStrictness)
          : 'balanced';
      const summary = classifySession(forCulling, { strictness });
      res.json({
        sessionId,
        strictness,
        ...summary,
      });
    } catch (error) {
      console.error('[capture] cull-suggestions failed', error);
      res.status(500).json({ error: 'cull_suggestions_failed' });
    }
  });

  // Bridges a Capture session into a CreatorHub UniversalShowcase
  // gallery so the iPad's "Deliver" surface produces the same kind of
  // share link the photographer's regular gallery manager creates. Lives
  // alongside the legacy /client-tokens path — both can coexist and the
  // iPad picks whichever matches its current product mode.
  router.post('/sessions/:sessionId/deliver-to-showcase', auth, async (req, res) => {
    const parsed = deliverToShowcaseBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;

    const picks = await pickAssetsFromCaptureSession(
      db,
      userId,
      req.params.sessionId,
      parsed.data.filter,
    );
    if (picks.length === 0) {
      // Most-likely cause: session has no flagged / 4★ assets that have
      // a previewKey yet. The iPad surfaces this as "Pick at least one
      // photo before delivering".
      res.status(400).json({ error: 'no_picks' });
      return;
    }

    const result = await bridgeCaptureSessionToGallery({
      db,
      ownerUserId: userId,
      captureSessionId: req.params.sessionId,
      projectTitle: parsed.data.projectTitle,
      clientName: parsed.data.clientName,
      clientEmail: parsed.data.clientEmail,
      picks,
    });
    if (!result.ok) {
      res.status(bridgeErrorStatus(result.error)).json({
        error: result.error,
        detail: result.detail,
      });
      return;
    }
    res.status(result.reusedExisting ? 200 : 201).json({
      galleryId: result.galleryId,
      accessToken: result.accessToken,
      shareUrl: result.shareUrl,
      uploadedImageCount: result.uploadedImageCount,
      reusedExisting: result.reusedExisting,
    });
  });

  // ── Client tokens (photographer-side management) ────────────

  router.post('/sessions/:sessionId/client-tokens', auth, async (req, res) => {
    const parsed = createClientTokenBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { userId } = req as AuthedRequest;
    const created = await createClientToken(db, userId, req.params.sessionId, parsed.data);
    if (!created) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }
    res.status(201).json(created);
  });

  router.get('/sessions/:sessionId/client-tokens', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const rows = await listClientTokens(db, userId, req.params.sessionId);
    res.json({ tokens: rows });
  });

  router.delete('/client-tokens/:id', auth, async (req, res) => {
    const { userId } = req as AuthedRequest;
    const ok = await revokeClientToken(db, userId, req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  });

  // ── Client review endpoints (client-scoped token auth) ──────

  const clientAuth = requireClientToken(db);

  router.get('/client/session', clientAuth, async (req, res) => {
    const { clientAuth: auth } = req as ClientAuthedRequest;
    const session = await fetchSessionForClient(db, auth.sessionId);
    if (!session) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({
      session,
      clientLabel: auth.clientLabel,
    });
  });

  router.get('/client/assets', clientAuth, async (req, res) => {
    const { clientAuth: auth } = req as ClientAuthedRequest;
    const limit = Math.min(Number(req.query.limit ?? 500), 2000);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    const rows = await db
      .select()
      .from(captureAssets)
      .where(eq(captureAssets.sessionId, auth.sessionId))
      .orderBy(asc(captureAssets.captureTime))
      .limit(limit)
      .offset(offset);

    const withUrls = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        previewUrl: await signAssetReadUrl(row.previewKey),
      })),
    );
    res.json({ assets: withUrls });
  });

  router.get('/client/assets/:id', clientAuth, async (req, res) => {
    const { clientAuth: auth } = req as ClientAuthedRequest;
    const rows = await db
      .select()
      .from(captureAssets)
      .where(
        and(eq(captureAssets.id, req.params.id), eq(captureAssets.sessionId, auth.sessionId)),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({
      ...row,
      previewUrl: await signAssetReadUrl(row.previewKey),
      fullUrl: await signAssetReadUrl(row.fullKey),
    });
  });

  router.post('/client/assets/:id/reviews', clientAuth, async (req, res) => {
    const parsed = clientReviewBody.safeParse(req.body);
    if (!handleZod(res, parsed)) return;
    const { clientAuth: auth } = req as ClientAuthedRequest;
    // Verify the asset belongs to the session this client token scopes.
    const rows = await db
      .select({ id: captureAssets.id })
      .from(captureAssets)
      .where(
        and(eq(captureAssets.id, req.params.id), eq(captureAssets.sessionId, auth.sessionId)),
      )
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const row = await addReviewRow(db, {
      assetId: req.params.id,
      reviewerId: auth.reviewerId,
      reviewerType: 'client',
      heart: parsed.data.heart,
      comment: parsed.data.comment,
    });
    if (!row) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    broadcastCaptureEvent(auth.sessionId, {
      type: 'client_review',
      review: row,
    });
    res.status(201).json(row);
  });

  return router;
}
