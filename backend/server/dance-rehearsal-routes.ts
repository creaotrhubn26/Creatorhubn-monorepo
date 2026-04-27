/**
 * Dance rehearsal routes — CRUD-API for prøvelogg-oppføringer.
 *
 *   GET    /api/dance/rehearsals?choreographyId=&projectId=&status=
 *   GET    /api/dance/rehearsals/:id
 *   POST   /api/dance/rehearsals
 *   PATCH  /api/dance/rehearsals/:id
 *   DELETE /api/dance/rehearsals/:id
 *
 * Slice 7-spesifikt: PATCH som inkluderer segmentReviews med outcome=approved
 * vil OGSÅ bumpe dance_choreography_segment.approval = 'approved' for de
 * berørte segmentene (atomisk i samme request — se patchRehearsal-servicen).
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
  createRehearsal,
  deleteRehearsal,
  getRehearsal,
  listRehearsals,
  patchRehearsal,
  type RehearsalInput,
  type RehearsalPatch,
  type RehearsalStatus,
} from './dance-rehearsal-service.js';

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

// ─── Validation ─────────────────────────────────────────────────────────

const STATUS_VALUES = ['planned', 'in_progress', 'completed', 'cancelled'] as const;
const OUTCOME_VALUES = ['approved', 'needs_repeat', 'pending'] as const;
const idSchema = z.string().min(1).max(200);

const focusAreaSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  segmentId: z.string().min(1).max(200).optional(),
  startSec: z.number().min(0).optional(),
  endSec: z.number().min(0).optional(),
  formationFromId: z.string().min(1).max(200).optional(),
  formationToId: z.string().min(1).max(200).optional(),
  goal: z.string().max(2000).optional(),
  estimatedMinutes: z.number().int().min(0).max(720).optional(),
});

const segmentReviewSchema = z.object({
  segmentId: z.string().min(1).max(200),
  outcome: z.enum(OUTCOME_VALUES),
  note: z.string().max(2000).optional(),
});

const followUpSchema = z.object({
  dancerId: z.string().min(1).max(200),
  followUp: z.string().max(2000),
  dueBy: z.string().max(40).optional(),
});

const baseRehearsalShape = {
  title: z.string().min(1).max(300),
  scheduledAt: z.string().datetime(),
  estimatedMinutes: z.number().int().min(0).max(1440).optional(),
  location: z.string().max(300).nullable().optional(),
  invitedDancerIds: z.array(z.string().max(200)).max(200).optional(),
  status: z.enum(STATUS_VALUES).optional(),
  focusAreas: z.array(focusAreaSchema).max(50).optional(),
  videoReviewPlanned: z.boolean().optional(),
  preNotes: z.string().max(5000).nullable().optional(),
  segmentReviews: z.array(segmentReviewSchema).max(200).optional(),
  dancerFollowUps: z.array(followUpSchema).max(200).optional(),
  postNotes: z.string().max(5000).nullable().optional(),
  recordingUrl: z.string().url().nullable().optional(),
  choreographyChangelog: z.string().max(5000).nullable().optional(),
  projectId: z.string().min(1).max(200).nullable().optional(),
};

const createBodySchema = z.object({
  choreographyId: z.string().min(1).max(200),
  ...baseRehearsalShape,
});

const patchBodySchema = z.object({
  ...baseRehearsalShape,
});

// ─── Router factory ─────────────────────────────────────────────────────

export interface CreateDanceRehearsalRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createDanceRehearsalRouter(
  pool: Pool,
  deps: CreateDanceRehearsalRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  router.get('/', auth, async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const choreoRaw = req.query.choreographyId;
    const projectRaw = req.query.projectId;
    const statusRaw = req.query.status;
    const limitRaw = req.query.limit ? Number(req.query.limit) : undefined;

    let choreographyId: string | undefined;
    if (typeof choreoRaw === 'string' && choreoRaw.trim().length > 0) {
      choreographyId = choreoRaw.trim();
    }
    let projectId: string | undefined;
    if (typeof projectRaw === 'string' && projectRaw.trim().length > 0) {
      projectId = projectRaw.trim();
    }
    let status: RehearsalStatus | undefined;
    if (typeof statusRaw === 'string' && (STATUS_VALUES as readonly string[]).includes(statusRaw)) {
      status = statusRaw as RehearsalStatus;
    }
    const rows = await listRehearsals(pool, userId, {
      choreographyId, projectId, status, limit: limitRaw,
    });
    res.json({ success: true, data: rows });
  });

  router.get('/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const { userId } = req as AuthedRequest;
    const row = await getRehearsal(pool, userId, idParsed.data);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true, data: row });
  });

  router.post('/', auth, async (req: Request, res: Response): Promise<void> => {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const row = await createRehearsal(pool, userId, parsed.data as RehearsalInput);
    res.status(201).json({ success: true, data: row });
  });

  router.patch('/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const parsed = patchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const row = await patchRehearsal(pool, userId, idParsed.data, parsed.data as RehearsalPatch);
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true, data: row });
  });

  router.delete('/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const { userId } = req as AuthedRequest;
    const ok = await deleteRehearsal(pool, userId, idParsed.data);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
