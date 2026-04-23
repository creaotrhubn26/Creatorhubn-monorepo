/**
 * Reference archive routes.
 *
 *   POST   /api/reference-archive/analyze  → Claude Vision auto-tag (stateless)
 *   POST   /api/reference-archive/frames   → persist a new frame (caller provides storage URL)
 *   GET    /api/reference-archive/frames   → search + list owner's archive
 *   PATCH  /api/reference-archive/frames/:id
 *   DELETE /api/reference-archive/frames/:id
 *
 * The /analyze route is intentionally stateless so the UI can call it
 * during the upload dialog to preview tags before the user commits to
 * saving. /frames (POST) then stores the already-tagged frame alongside
 * a storage URL the UI has independently produced (S3/Cloudinary/etc).
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { loadPersistedAuthSession } from './auth-session-store.js';
import {
  analyseFrame,
  createReferenceFrame,
  deleteReferenceFrame,
  searchReferenceFrames,
  updateReferenceFrame,
  sanitiseTags,
  type ReferenceFrameTagsShotType,
} from './reference-archive-service.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

type AuthedRequest = Request & { userId: string };

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

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;

const analyzeBody = z.object({
  imageBase64: z.string().min(100),
  mime: z.enum(ALLOWED_MIME),
  hintFilmTitle: z.string().max(200).optional(),
  hintCinematographer: z.string().max(120).optional(),
});

const claudeTagsShape = z.object({
  shotType: z.string(),
  cameraAngle: z.string(),
  lensRange: z.string(),
  lightingMood: z.string(),
  colorPalette: z.array(z.string()),
  composition: z.string(),
  timeOfDay: z.string(),
  suggestedCinematographerStyle: z.string(),
  keywords: z.array(z.string()),
});

const createBody = z.object({
  sourceUrl: z.string().url(),
  thumbnailUrl: z.string().url().nullable().optional(),
  filmTitle: z.string().max(300).nullable().optional(),
  cinematographer: z.string().max(200).nullable().optional(),
  year: z.number().int().min(1890).max(2100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  claudeTags: claudeTagsShape,
  userTags: z.array(z.string().max(60)).max(30).default([]),
  usedOnProjectIds: z.array(z.string().max(120)).max(50).default([]),
});

const patchBody = z.object({
  sourceUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  filmTitle: z.string().max(300).nullable().optional(),
  cinematographer: z.string().max(200).nullable().optional(),
  year: z.number().int().min(1890).max(2100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  userTags: z.array(z.string().max(60)).max(30).optional(),
  usedOnProjectIds: z.array(z.string().max(120)).max(50).optional(),
});

const searchQuery = z.object({
  q: z.string().max(200).optional(),
  shotType: z.string().optional(),
  cinematographer: z.string().max(200).optional(),
  timeOfDay: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export interface CreateReferenceArchiveRouterDeps {
  activeSessions?: Map<string, SessionData>;
  /** Seam for tests — default uses real analyseFrame. */
  analyze?: typeof analyseFrame;
}

export function createReferenceArchiveRouter(
  pool: Pool,
  deps: CreateReferenceArchiveRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);
  const analyze = deps.analyze ?? analyseFrame;

  router.post('/analyze', auth, async (req: Request, res: Response): Promise<void> => {
    const parsed = analyzeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const result = await analyze(parsed.data);
    if (!result.ok) {
      const status = result.error === 'image_too_large' ? 413 : 502;
      res.status(status).json({ error: result.error, message: result.detail });
      return;
    }
    res.json({ success: true, data: { claudeTags: result.tags } });
  });

  router.post('/frames', auth, async (req: Request, res: Response): Promise<void> => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const frame = await createReferenceFrame(pool, {
      ownerUserId: userId,
      uploadedByUserId: userId,
      sourceUrl: parsed.data.sourceUrl,
      thumbnailUrl: parsed.data.thumbnailUrl ?? null,
      filmTitle: parsed.data.filmTitle ?? null,
      cinematographer: parsed.data.cinematographer ?? null,
      year: parsed.data.year ?? null,
      notes: parsed.data.notes ?? null,
      claudeTags: sanitiseTags(parsed.data.claudeTags),
      userTags: parsed.data.userTags,
      usedOnProjectIds: parsed.data.usedOnProjectIds,
    });
    res.status(201).json({ success: true, data: frame });
  });

  router.get('/frames', auth, async (req: Request, res: Response): Promise<void> => {
    const parsed = searchQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const rows = await searchReferenceFrames(pool, {
      ownerUserId: userId,
      query: parsed.data.q,
      shotType: parsed.data.shotType as ReferenceFrameTagsShotType | undefined,
      cinematographer: parsed.data.cinematographer,
      timeOfDay: parsed.data.timeOfDay,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    res.json({ success: true, data: rows });
  });

  router.patch('/frames/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const parsed = patchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const updated = await updateReferenceFrame(pool, userId, req.params.id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true, data: updated });
  });

  router.delete('/frames/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const ok = await deleteReferenceFrame(pool, userId, req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
