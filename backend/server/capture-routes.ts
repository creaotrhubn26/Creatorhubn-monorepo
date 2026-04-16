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
      res.json({ assets: rows });
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
