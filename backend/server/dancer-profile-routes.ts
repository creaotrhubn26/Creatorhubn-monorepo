/**
 * Dancer profile routes — CRUD-API for dans-spesifikke ekstrafelt på
 * danser-objekter (dans-vertikalen i The Role Room).
 *
 *   GET    /api/dance/profiles?projectId=...  — list owner's dancer profiles
 *   GET    /api/dance/profiles/:dancerId      — get one
 *   PUT    /api/dance/profiles/:dancerId      — upsert (full eller partial)
 *   DELETE /api/dance/profiles/:dancerId
 *
 * Auth: bearer-token via requireAuth (samme mønster som
 * dance-choreography-routes / capture / reference-archive).
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
  deleteDancerProfile,
  getDancerProfile,
  listDancerProfiles,
  upsertDancerProfile,
  type DancerProfileExtras,
} from './dancer-profile-service.js';

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

const DANCE_STYLES = [
  'contemporary', 'ballet', 'jazz', 'commercial', 'hip-hop', 'folk', 'other',
] as const;

const INJURY_STATUSES = ['healthy', 'rehab', 'cleared-with-restriction'] as const;
const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'pro'] as const;

const projectIdSchema = z.string().min(1).max(200);
const dancerIdSchema = z.string().min(1).max(200);

const availabilityWindowSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  note: z.string().max(200).optional(),
});

const bodyMeasurementsSchema = z.object({
  inseamCm: z.number().int().min(50).max(150).optional(),
  reachCm: z.number().int().min(100).max(250).optional(),
  weightKg: z.number().int().min(30).max(200).optional(),
  shoeSize: z.number().min(20).max(60).optional(),
});

const upsertBodySchema = z.object({
  displayName: z.string().max(200).nullable().optional(),
  heightCm: z.number().int().min(50).max(250).nullable().optional(),
  primaryStyle: z.enum(DANCE_STYLES).nullable().optional(),
  strengths: z.array(z.string().max(80)).max(20).optional(),
  availabilityWindows: z.array(availabilityWindowSchema).max(50).optional(),
  injuryStatus: z.enum(INJURY_STATUSES).optional(),
  injuryNote: z.string().max(500).nullable().optional(),
  reelUrls: z.array(z.string().url()).max(10).optional(),
  bodyMeasurements: bodyMeasurementsSchema.optional(),
  skillLevels: z.record(z.string(), z.enum(SKILL_LEVELS)).optional(),
  notes: z.string().max(2000).nullable().optional(),
  projectId: z.string().min(1).max(200).nullable().optional(),
});

// ─── Router factory ─────────────────────────────────────────────────────

export interface CreateDancerProfileRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createDancerProfileRouter(
  pool: Pool,
  deps: CreateDancerProfileRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  router.get('/', auth, async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const limitRaw = req.query.limit ? Number(req.query.limit) : undefined;
    const rawProjectId = req.query.projectId;
    let projectId: string | undefined;
    if (typeof rawProjectId === 'string' && rawProjectId.trim().length > 0) {
      const parsed = projectIdSchema.safeParse(rawProjectId.trim());
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_project_id' });
        return;
      }
      projectId = parsed.data;
    }
    const rows = await listDancerProfiles(pool, userId, { projectId, limit: limitRaw });
    res.json({ success: true, data: rows });
  });

  router.get('/:dancerId', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = dancerIdSchema.safeParse(req.params.dancerId);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_dancer_id' });
      return;
    }
    const { userId } = req as AuthedRequest;
    const profile = await getDancerProfile(pool, userId, idParsed.data);
    if (!profile) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true, data: profile });
  });

  router.put('/:dancerId', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = dancerIdSchema.safeParse(req.params.dancerId);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_dancer_id' });
      return;
    }
    const parsed = upsertBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    // Cast er trygt: zod-skjemaet matcher nøyaktig DancerProfileExtras.
    const extras = parsed.data as Partial<DancerProfileExtras>;
    const result = await upsertDancerProfile(pool, userId, idParsed.data, extras);
    res.json({ success: true, data: result });
  });

  router.delete('/:dancerId', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = dancerIdSchema.safeParse(req.params.dancerId);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_dancer_id' });
      return;
    }
    const { userId } = req as AuthedRequest;
    const ok = await deleteDancerProfile(pool, userId, idParsed.data);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
