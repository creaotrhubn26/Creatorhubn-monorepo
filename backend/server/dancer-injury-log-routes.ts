/**
 * Dancer injury log routes — CRUD-API for skadelogg-oppføringer i
 * dans-vertikalen.
 *
 *   GET    /api/dance/injuries?projectId=&dancerId=&status= — list
 *   POST   /api/dance/injuries                              — create
 *   GET    /api/dance/injuries/:id                          — fetch one
 *   PATCH  /api/dance/injuries/:id                          — update
 *   DELETE /api/dance/injuries/:id                          — hard delete
 *
 * Auth: bearer-token via requireAuth (samme mønster som dancer-profile-routes).
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
  createInjury,
  deleteInjury,
  getInjury,
  listInjuries,
  patchInjury,
  INJURY_BODY_PARTS,
  type InjuryEntryStatus,
  type InjuryLogEntryInput,
  type InjuryLogEntryPatch,
} from './dancer-injury-log-service.js';

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

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date_format');
const optionalIsoDateSchema = isoDateSchema.nullable().optional();

const SIDE_VALUES = ['left', 'right', 'both'] as const;
const STATUS_VALUES = ['active', 'healing', 'resolved'] as const;
const TRIGGER_VALUES = ['rehearsal', 'performance', 'audition', 'training', 'other'] as const;

const createBodySchema = z.object({
  dancerId: z.string().min(1).max(200),
  entryDate: isoDateSchema,
  bodyPart: z.enum(INJURY_BODY_PARTS),
  side: z.enum(SIDE_VALUES).nullable().optional(),
  severity: z.number().int().min(1).max(5),
  note: z.string().max(2000).nullable().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  expectedReturnDate: optionalIsoDateSchema,
  resolvedDate: optionalIsoDateSchema,
  triggeredBy: z.enum(TRIGGER_VALUES).nullable().optional(),
  projectId: z.string().min(1).max(200).nullable().optional(),
});

const patchBodySchema = z.object({
  entryDate: isoDateSchema.optional(),
  bodyPart: z.enum(INJURY_BODY_PARTS).optional(),
  side: z.enum(SIDE_VALUES).nullable().optional(),
  severity: z.number().int().min(1).max(5).optional(),
  note: z.string().max(2000).nullable().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  expectedReturnDate: optionalIsoDateSchema,
  resolvedDate: optionalIsoDateSchema,
  triggeredBy: z.enum(TRIGGER_VALUES).nullable().optional(),
  projectId: z.string().min(1).max(200).nullable().optional(),
});

const idSchema = z.string().min(1).max(200);

// ─── Router factory ─────────────────────────────────────────────────────

export interface CreateDancerInjuryLogRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createDancerInjuryLogRouter(
  pool: Pool,
  deps: CreateDancerInjuryLogRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  router.get('/', auth, async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const projectIdRaw = req.query.projectId;
    const dancerIdRaw = req.query.dancerId;
    const statusRaw = req.query.status;
    const limitRaw = req.query.limit ? Number(req.query.limit) : undefined;

    let projectId: string | undefined;
    if (typeof projectIdRaw === 'string' && projectIdRaw.trim().length > 0) {
      projectId = projectIdRaw.trim();
    }
    let dancerId: string | undefined;
    if (typeof dancerIdRaw === 'string' && dancerIdRaw.trim().length > 0) {
      dancerId = dancerIdRaw.trim();
    }
    let status: InjuryEntryStatus | undefined;
    if (typeof statusRaw === 'string' && (STATUS_VALUES as readonly string[]).includes(statusRaw)) {
      status = statusRaw as InjuryEntryStatus;
    }

    const rows = await listInjuries(pool, userId, { projectId, dancerId, status, limit: limitRaw });
    res.json({ success: true, data: rows });
  });

  router.get('/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const { userId } = req as AuthedRequest;
    const entry = await getInjury(pool, userId, idParsed.data);
    if (!entry) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true, data: entry });
  });

  router.post('/', auth, async (req: Request, res: Response): Promise<void> => {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const { dancerId, ...rest } = parsed.data;
    const input: InjuryLogEntryInput = {
      entryDate: rest.entryDate,
      bodyPart: rest.bodyPart,
      severity: rest.severity,
      side: rest.side ?? null,
      note: rest.note ?? null,
      status: rest.status,
      expectedReturnDate: rest.expectedReturnDate ?? null,
      resolvedDate: rest.resolvedDate ?? null,
      triggeredBy: rest.triggeredBy ?? null,
      projectId: rest.projectId ?? null,
    };
    const entry = await createInjury(pool, userId, dancerId, input);
    res.status(201).json({ success: true, data: entry });
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
    const patch = parsed.data as InjuryLogEntryPatch;
    const entry = await patchInjury(pool, userId, idParsed.data, patch);
    if (!entry) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true, data: entry });
  });

  router.delete('/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const { userId } = req as AuthedRequest;
    const ok = await deleteInjury(pool, userId, idParsed.data);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
