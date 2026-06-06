/**
 * Dance formation timeline-item routes — CRUD for time-anchored notes +
 * movements på koreografi-timeline. Workflow-audit G18.
 *
 *   GET    /api/dance/formation-timeline-items?projectId=&kind=
 *   GET    /api/dance/formation-timeline-items/:id
 *   POST   /api/dance/formation-timeline-items
 *   PATCH  /api/dance/formation-timeline-items/:id
 *   DELETE /api/dance/formation-timeline-items/:id
 *
 * Auth: bearer-token via samme requireAuth-mønster som
 * dance-formation-routes.ts.
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
  createTimelineItem,
  deleteTimelineItem,
  getTimelineItem,
  listTimelineItems,
  patchTimelineItem,
  type TimelineItemInput,
  type TimelineItemKind,
} from './dance-formation-timeline-item-service.js';

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

const kindSchema = z.union([z.literal('note'), z.literal('movement')]);
const idSchema = z.string().min(1).max(200);
const projectIdSchema = z.string().min(1).max(200);
const secSchema = z.number().min(0).max(36000);

const createBodySchema = z.object({
  kind: kindSchema,
  label: z.string().min(1).max(500),
  startSec: secSchema,
  endSec: secSchema,
  projectId: z.string().min(1).max(200).nullable().optional(),
  formationId: z.string().min(1).max(200).nullable().optional(),
  targetDancerIds: z.array(z.string().min(1).max(200)).max(100).optional(),
  displayOrder: z.number().int().optional(),
}).refine((d) => d.endSec >= d.startSec, {
  message: 'endSec må være >= startSec',
  path: ['endSec'],
});

const patchBodySchema = z.object({
  kind: kindSchema.optional(),
  label: z.string().min(1).max(500).optional(),
  startSec: secSchema.optional(),
  endSec: secSchema.optional(),
  projectId: z.string().min(1).max(200).nullable().optional(),
  formationId: z.string().min(1).max(200).nullable().optional(),
  targetDancerIds: z.array(z.string().min(1).max(200)).max(100).optional(),
  displayOrder: z.number().int().optional(),
});

// ─── Router factory ─────────────────────────────────────────────────────

export interface CreateDanceFormationTimelineItemRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createDanceFormationTimelineItemRouter(
  pool: Pool,
  deps: CreateDanceFormationTimelineItemRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  router.get('/', auth, async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const limitRaw = req.query.limit ? Number(req.query.limit) : undefined;
    const projectIdRaw = req.query.projectId;
    let projectId: string | undefined;
    if (typeof projectIdRaw === 'string' && projectIdRaw.trim().length > 0) {
      const parsed = projectIdSchema.safeParse(projectIdRaw.trim());
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_project_id' });
        return;
      }
      projectId = parsed.data;
    }
    let kind: TimelineItemKind | undefined;
    if (req.query.kind === 'note' || req.query.kind === 'movement') {
      kind = req.query.kind;
    }
    const rows = await listTimelineItems(pool, userId, { projectId, kind, limit: limitRaw });
    res.json({ success: true, data: rows });
  });

  router.get('/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const { userId } = req as AuthedRequest;
    const row = await getTimelineItem(pool, userId, idParsed.data);
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
    const input: TimelineItemInput = parsed.data;
    const row = await createTimelineItem(pool, userId, input);
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
    const row = await patchTimelineItem(pool, userId, idParsed.data, parsed.data);
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
    const ok = await deleteTimelineItem(pool, userId, idParsed.data);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
