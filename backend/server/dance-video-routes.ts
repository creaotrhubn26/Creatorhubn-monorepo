/**
 * Dance video routes — V1 + V4 SSE.
 *
 *   POST   /api/dance/video-clips                    — multipart upload (file)
 *   GET    /api/dance/video-clips?choreographyId=&projectId=&kind=
 *   GET    /api/dance/video-clips/:id
 *   PATCH  /api/dance/video-clips/:id                — title/kind/segment/captured/duration
 *   DELETE /api/dance/video-clips/:id
 *
 *   GET    /api/dance/video-clips/:id/annotations
 *   POST   /api/dance/video-clips/:id/annotations
 *   POST   /api/dance/video-clips/:id/voice-note     — separat upload av voice (V3)
 *   PATCH  /api/dance/video-annotations/:id
 *   DELETE /api/dance/video-annotations/:id
 *
 *   GET    /api/dance/video-clips/:id/events         — SSE stream (V4)
 *
 * Slice-V4-prep: alle annotation-CRUD-rute publiserer event til en in-
 * process EventEmitter per clip-id. SSE-endpunktet abonnerer og
 * streamer ut. Frontend re-fetcher på event for enkel sync (optimistic
 * for forfatter, push for andre).
 */

import { EventEmitter } from 'node:events';
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from 'express';
import multer from 'multer';
import type { Pool } from 'pg';
import { z } from 'zod';
import { loadPersistedAuthSession } from './auth-session-store.js';
import {
  createAnnotation,
  createClip,
  deleteAnnotation,
  deleteClip,
  getClip,
  listAnnotations,
  listClips,
  patchAnnotation,
  patchClip,
  uploadVideoToR2,
  type AnnotationStatus,
  type CreateAnnotationInput,
  type PatchAnnotationInput,
  type PatchClipInput,
  type VideoClipKind,
} from './dance-video-service.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

type AuthedRequest = Request & { userId: string; userName?: string };

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

function requireAuth(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
      ?? (typeof req.query.token === 'string' ? req.query.token : undefined); // SSE EventSource can't set headers
    const session = await resolveUser(pool, activeSessions, bearer);
    if (!session?.userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    (req as AuthedRequest).userId = session.userId;
    (req as AuthedRequest).userName = session.name;
    next();
  };
}

// ─── Per-clip event bus (V4 wires SSE on top) ───────────────────────────

const clipEvents = new EventEmitter();
clipEvents.setMaxListeners(0);

interface ClipEvent {
  kind: 'annotation:created' | 'annotation:updated' | 'annotation:deleted';
  annotationId: string;
  clipId: string;
  ownerUserId: string;
}

function emitClipEvent(event: ClipEvent): void {
  clipEvents.emit(`clip:${event.clipId}`, event);
}

// ─── Validation schemas ─────────────────────────────────────────────────

const idSchema = z.string().min(1).max(200);
const VIDEO_KINDS = ['rehearsal', 'reference', 'performance'] as const;
const ANNOTATION_STATUSES = ['open', 'resolved'] as const;

const patchClipSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  kind: z.enum(VIDEO_KINDS).optional(),
  segmentId: z.string().min(1).max(200).nullable().optional(),
  capturedAt: z.string().datetime().nullable().optional(),
  durationSec: z.number().nonnegative().nullable().optional(),
});

const drawingSchema = z.unknown(); // accepted as opaque JSON
const keyframesSchema = z.unknown();

const categorySchema = z.enum(['steps', 'arms', 'body', 'jumps', 'turns']).nullable();
const confidenceSchema = z.number().min(0).max(1).nullable();

const createAnnotationBodySchema = z.object({
  parentId: z.string().min(1).max(200).nullable().optional(),
  body: z.string().min(1).max(5000),
  timestampSec: z.number().nonnegative(),
  endSec: z.number().nonnegative().nullable().optional(),
  countNumber: z.number().int().min(0).max(500).nullable().optional(),
  segmentId: z.string().min(1).max(200).nullable().optional(),
  targetDancerIds: z.array(z.string().max(200)).max(50).optional(),
  isDirectorPin: z.boolean().optional(),
  drawing: drawingSchema.optional(),
  drawingKeyframes: keyframesSchema.optional(),
  category: categorySchema.optional(),
  confidence: confidenceSchema.optional(),
});

const patchAnnotationBodySchema = z.object({
  body: z.string().min(1).max(5000).optional(),
  status: z.enum(ANNOTATION_STATUSES).optional(),
  isDirectorPin: z.boolean().optional(),
  targetDancerIds: z.array(z.string().max(200)).max(50).optional(),
  drawing: drawingSchema.optional(),
  drawingKeyframes: keyframesSchema.optional(),
  category: categorySchema.optional(),
});

// ─── Router ─────────────────────────────────────────────────────────────

export interface CreateDanceVideoRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createDanceVideoRouter(
  pool: Pool,
  deps: CreateDanceVideoRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  const clipUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB cap (browser-side transcoding er V1.1)
  });

  const voiceUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 }, // 30MB cap for voice notes
  });

  // ─── Clip CRUD ────────────────────────────────────────────────────────

  router.get('/video-clips', auth, async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const { choreographyId, projectId, kind, limit } = req.query;
    const choreographyIdParsed = typeof choreographyId === 'string' && choreographyId.length > 0
      ? choreographyId : null;
    const projectIdParsed = typeof projectId === 'string' && projectId.length > 0
      ? projectId : null;
    const kindParsed = typeof kind === 'string' && (VIDEO_KINDS as readonly string[]).includes(kind)
      ? (kind as VideoClipKind) : null;
    const limitParsed = limit ? Number(limit) : undefined;
    const rows = await listClips(pool, userId, {
      choreographyId: choreographyIdParsed,
      projectId: projectIdParsed,
      kind: kindParsed,
      limit: limitParsed,
    });
    res.json({ success: true, data: rows });
  });

  router.get('/video-clips/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const { userId } = req as AuthedRequest;
    const clip = await getClip(pool, userId, idParsed.data);
    if (!clip) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true, data: clip });
  });

  router.post(
    '/video-clips',
    auth,
    clipUpload.single('file'),
    async (req: Request, res: Response): Promise<void> => {
      const { userId } = req as AuthedRequest;
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        res.status(400).json({ error: 'missing_file' });
        return;
      }
      const title = typeof req.body.title === 'string' && req.body.title.trim().length > 0
        ? req.body.title.trim()
        : (file.originalname || 'Ny video');
      const kindRaw = typeof req.body.kind === 'string' ? req.body.kind : 'rehearsal';
      const kind: VideoClipKind = (VIDEO_KINDS as readonly string[]).includes(kindRaw)
        ? (kindRaw as VideoClipKind)
        : 'rehearsal';
      const choreographyId = typeof req.body.choreographyId === 'string' && req.body.choreographyId.trim().length > 0
        ? req.body.choreographyId.trim()
        : null;
      const segmentId = typeof req.body.segmentId === 'string' && req.body.segmentId.trim().length > 0
        ? req.body.segmentId.trim()
        : null;
      const projectId = typeof req.body.projectId === 'string' && req.body.projectId.trim().length > 0
        ? req.body.projectId.trim()
        : null;
      const durationRaw = typeof req.body.durationSec === 'string' ? Number(req.body.durationSec) : undefined;
      const durationSec = Number.isFinite(durationRaw as number) ? Math.max(0, durationRaw as number) : null;

      const upload = await uploadVideoToR2({
        ownerUserId: userId,
        pathSegment: 'clips',
        body: file.buffer,
        mime: file.mimetype,
      });
      if (!upload.ok) {
        const status = upload.error === 'storage_not_configured' ? 503
          : upload.error === 'unsupported_mime' ? 415
          : 500;
        res.status(status).json({ error: upload.error, detail: upload.detail });
        return;
      }
      const clip = await createClip(pool, {
        ownerUserId: userId,
        sourceUserId: userId,
        title,
        kind,
        choreographyId,
        segmentId,
        projectId,
        durationSec,
        mime: file.mimetype,
        storageKey: upload.storageKey!,
        signedUrl: upload.signedUrl!,
        capturedAt: new Date().toISOString(),
      });
      res.status(201).json({ success: true, data: clip });
    },
  );

  router.patch('/video-clips/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const parsed = patchClipSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const clip = await patchClip(pool, userId, idParsed.data, parsed.data as PatchClipInput);
    if (!clip) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true, data: clip });
  });

  router.delete('/video-clips/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const { userId } = req as AuthedRequest;
    const ok = await deleteClip(pool, userId, idParsed.data);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true });
  });

  // ─── Annotations ──────────────────────────────────────────────────────

  router.get(
    '/video-clips/:id/annotations',
    auth,
    async (req: Request, res: Response): Promise<void> => {
      const idParsed = idSchema.safeParse(req.params.id);
      if (!idParsed.success) {
        res.status(400).json({ error: 'invalid_id' });
        return;
      }
      const { userId } = req as AuthedRequest;
      // Verify ownership of the clip first.
      const clip = await getClip(pool, userId, idParsed.data);
      if (!clip) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const annotations = await listAnnotations(pool, userId, idParsed.data);
      res.json({ success: true, data: annotations });
    },
  );

  router.post(
    '/video-clips/:id/annotations',
    auth,
    async (req: Request, res: Response): Promise<void> => {
      const idParsed = idSchema.safeParse(req.params.id);
      if (!idParsed.success) {
        res.status(400).json({ error: 'invalid_id' });
        return;
      }
      const parsed = createAnnotationBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
        return;
      }
      const { userId } = req as AuthedRequest;
      const clip = await getClip(pool, userId, idParsed.data);
      if (!clip) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const input: CreateAnnotationInput = {
        ownerUserId: userId,
        authorUserId: userId,
        clipId: idParsed.data,
        ...parsed.data,
      };
      const annotation = await createAnnotation(pool, input);
      emitClipEvent({
        kind: 'annotation:created',
        annotationId: annotation.id,
        clipId: annotation.clipId,
        ownerUserId: userId,
      });
      res.status(201).json({ success: true, data: annotation });
    },
  );

  router.post(
    '/video-clips/:id/voice-note',
    auth,
    voiceUpload.single('file'),
    async (req: Request, res: Response): Promise<void> => {
      const idParsed = idSchema.safeParse(req.params.id);
      if (!idParsed.success) {
        res.status(400).json({ error: 'invalid_id' });
        return;
      }
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        res.status(400).json({ error: 'missing_file' });
        return;
      }
      const { userId } = req as AuthedRequest;
      const clip = await getClip(pool, userId, idParsed.data);
      if (!clip) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const upload = await uploadVideoToR2({
        ownerUserId: userId,
        pathSegment: 'voice-notes',
        body: file.buffer,
        mime: file.mimetype,
      });
      if (!upload.ok) {
        const status = upload.error === 'storage_not_configured' ? 503
          : upload.error === 'unsupported_mime' ? 415
          : 500;
        res.status(status).json({ error: upload.error, detail: upload.detail });
        return;
      }
      res.json({
        success: true,
        data: {
          storageKey: upload.storageKey,
          signedUrl: upload.signedUrl,
        },
      });
    },
  );

  router.patch('/video-annotations/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const parsed = patchAnnotationBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const annotation = await patchAnnotation(pool, userId, idParsed.data, parsed.data as PatchAnnotationInput);
    if (!annotation) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    emitClipEvent({
      kind: 'annotation:updated',
      annotationId: annotation.id,
      clipId: annotation.clipId,
      ownerUserId: userId,
    });
    res.json({ success: true, data: annotation });
  });

  router.delete('/video-annotations/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const { userId } = req as AuthedRequest;
    // Need clipId before deleting so we can emit the event.
    const before = await pool.query(
      `SELECT clip_id FROM dance_video_annotation WHERE owner_user_id = $1 AND id = $2`,
      [userId, idParsed.data],
    );
    if (before.rowCount === 0) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const clipId = String(before.rows[0].clip_id);
    const ok = await deleteAnnotation(pool, userId, idParsed.data);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    emitClipEvent({
      kind: 'annotation:deleted',
      annotationId: idParsed.data,
      clipId,
      ownerUserId: userId,
    });
    res.json({ success: true });
  });

  // ─── SSE event stream (V4) ────────────────────────────────────────────
  router.get(
    '/video-clips/:id/events',
    auth,
    async (req: Request, res: Response): Promise<void> => {
      const idParsed = idSchema.safeParse(req.params.id);
      if (!idParsed.success) {
        res.status(400).json({ error: 'invalid_id' });
        return;
      }
      const { userId } = req as AuthedRequest;
      const clip = await getClip(pool, userId, idParsed.data);
      if (!clip) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      // Initial heartbeat so EventSource onopen fires immediately.
      res.write(': connected\n\n');

      const channel = `clip:${idParsed.data}`;
      const onEvent = (event: ClipEvent): void => {
        // Keep the stream owner-scoped so cross-user events don't leak.
        if (event.ownerUserId !== userId) return;
        try {
          res.write(`event: ${event.kind}\n`);
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch {
          /* connection went away */
        }
      };
      clipEvents.on(channel, onEvent);

      const heartbeat = setInterval(() => {
        try { res.write(': heartbeat\n\n'); } catch { /* ignore */ }
      }, 30_000);

      req.on('close', () => {
        clearInterval(heartbeat);
        clipEvents.off(channel, onEvent);
        try { res.end(); } catch { /* ignore */ }
      });
    },
  );

  return router;
}
