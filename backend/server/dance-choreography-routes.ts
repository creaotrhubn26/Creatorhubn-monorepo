/**
 * Dance choreography routes — CRUD-API for Choreography Builder.
 *
 *   GET    /api/dance/choreography           — list owner's choreographies
 *   POST   /api/dance/choreography           — create new
 *   GET    /api/dance/choreography/:id       — get with all segments
 *   PATCH  /api/dance/choreography/:id       — update header fields
 *   PUT    /api/dance/choreography/:id/segments — replace all segments
 *   DELETE /api/dance/choreography/:id
 *
 * Auth: bearer token via requireAuth (samme mønster som capture/reference-archive).
 * Rate-limit: ai-rate-limiter er ikke nødvendig her — ingen AI-kall.
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
  createChoreography,
  deleteChoreography,
  getChoreography,
  listChoreographies,
  replaceSegments,
  updateChoreographyHeader,
} from './dance-choreography-service.js';

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

// ─── Validation schemas ─────────────────────────────────────────────────

const SEGMENT_KINDS = [
  'intro', 'verse', 'chorus', 'bridge', 'break',
  'outro', 'freestyle', 'lift', 'formation_change',
] as const;

const ENERGY_LEVELS = ['low', 'controlled', 'medium', 'high', 'sharp', 'explosive'] as const;
const APPROVAL_STATUSES = ['draft', 'review', 'approved', 'locked'] as const;

const createBody = z.object({
  title: z.string().min(1).max(300),
  choreographer: z.string().max(200).nullable().optional(),
  musicTitle: z.string().max(300).nullable().optional(),
  bpm: z.number().int().min(40).max(300).nullable().optional(),
  musicalKey: z.string().max(40).nullable().optional(),
  totalDurationSec: z.number().int().min(0).max(7200).optional(),
});

const patchHeaderBody = z.object({
  title: z.string().min(1).max(300).optional(),
  choreographer: z.string().max(200).nullable().optional(),
  musicTitle: z.string().max(300).nullable().optional(),
  bpm: z.number().int().min(40).max(300).nullable().optional(),
  musicalKey: z.string().max(40).nullable().optional(),
  totalDurationSec: z.number().int().min(0).max(7200).optional(),
  musicUrl: z.string().url().nullable().optional(),
  musicStorageKey: z.string().max(500).nullable().optional(),
});

const segmentInputSchema = z.object({
  kind: z.enum(SEGMENT_KINDS),
  label: z.string().max(120).nullable().optional(),
  startSec: z.number().int().min(0),
  endSec: z.number().int().min(1),
  musicCue: z.string().max(500).nullable().optional(),
  formation: z.string().max(500).nullable().optional(),
  camera: z.string().max(500).nullable().optional(),
  lighting: z.string().max(500).nullable().optional(),
  costume: z.string().max(500).nullable().optional(),
  movementNotes: z.string().max(2000).nullable().optional(),
  energy: z.enum(ENERGY_LEVELS).default('medium'),
  dancers: z.array(z.string().max(120)).max(50).default([]),
  videoRefUrl: z.string().url().nullable().optional(),
  approval: z.enum(APPROVAL_STATUSES).default('draft'),
}).refine((s) => s.endSec > s.startSec, {
  message: 'endSec must be greater than startSec',
  path: ['endSec'],
});

const replaceSegmentsBody = z.object({
  segments: z.array(segmentInputSchema).max(200),
});

// ─── Router factory ─────────────────────────────────────────────────────

export interface CreateDanceChoreographyRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createDanceChoreographyRouter(
  pool: Pool,
  deps: CreateDanceChoreographyRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  router.get('/', auth, async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const limitRaw = req.query.limit ? Number(req.query.limit) : undefined;
    const rows = await listChoreographies(pool, userId, limitRaw);
    res.json({ success: true, data: rows });
  });

  router.post('/', auth, async (req: Request, res: Response): Promise<void> => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const created = await createChoreography(pool, { ownerUserId: userId, ...parsed.data });
    res.status(201).json({ success: true, data: created });
  });

  router.get('/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const c = await getChoreography(pool, userId, req.params.id);
    if (!c) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true, data: c });
  });

  router.patch('/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const parsed = patchHeaderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const updated = await updateChoreographyHeader(pool, userId, req.params.id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true, data: updated });
  });

  router.put('/:id/segments', auth, async (req: Request, res: Response): Promise<void> => {
    const parsed = replaceSegmentsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const updated = await replaceSegments(pool, userId, req.params.id, parsed.data.segments);
    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true, data: updated });
  });

  router.delete('/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const ok = await deleteChoreography(pool, userId, req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
