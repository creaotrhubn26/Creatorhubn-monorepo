/**
 * Dance formation routes — CRUD + atomic replace for navngitte
 * scene-formasjoner i dans-vertikalen.
 *
 *   GET    /api/dance/formations?projectId=...  — list owner's formations
 *   GET    /api/dance/formations/:id            — fetch one
 *   POST   /api/dance/formations                — create
 *   PATCH  /api/dance/formations/:id            — partial update
 *   DELETE /api/dance/formations/:id            — hard delete
 *   PUT    /api/dance/formations                — atomic replace-all
 *                                                   (per project scope)
 *
 * Auth: bearer-token via requireAuth (samme mønster som dance-choreography).
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
  createFormation,
  deleteFormation,
  getFormation,
  listFormations,
  patchFormation,
  replaceFormations,
  type FormationInput,
  type FormationPatch,
} from './dance-formation-service.js';

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

const positionSchema = z.object({
  dancerId: z.string().min(1).max(200),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  facing: z.number().optional(),
  isLead: z.boolean().optional(),
});

const idSchema = z.string().min(1).max(200);
const projectIdSchema = z.string().min(1).max(200);

const tagsSchema = z.array(z.string().min(1).max(40)).max(20);
const secSchema = z.number().min(0).max(36000).nullable();
const transitionNoteSchema = z.string().max(500).nullable();
const transitionPathsSchema = z.array(z.object({
  dancerId: z.string().min(1).max(200),
  controlPoints: z.array(z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  })).max(8),
})).max(100);

const createBodySchema = z.object({
  label: z.string().min(1).max(200),
  notes: z.string().max(2000).nullable().optional(),
  stageWidthM: z.number().min(1).max(100).optional(),
  stageDepthM: z.number().min(1).max(100).optional(),
  positions: z.array(positionSchema).max(100).default([]),
  transitionFromId: z.string().min(1).max(200).nullable().optional(),
  displayOrder: z.number().int().optional(),
  projectId: z.string().min(1).max(200).nullable().optional(),
  startSec: secSchema.optional(),
  endSec: secSchema.optional(),
  transitionNote: transitionNoteSchema.optional(),
  tags: tagsSchema.optional(),
  transitionPaths: transitionPathsSchema.optional(),
});

const patchBodySchema = z.object({
  label: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).nullable().optional(),
  stageWidthM: z.number().min(1).max(100).optional(),
  stageDepthM: z.number().min(1).max(100).optional(),
  positions: z.array(positionSchema).max(100).optional(),
  transitionFromId: z.string().min(1).max(200).nullable().optional(),
  displayOrder: z.number().int().optional(),
  projectId: z.string().min(1).max(200).nullable().optional(),
  startSec: secSchema.optional(),
  endSec: secSchema.optional(),
  transitionNote: transitionNoteSchema.optional(),
  tags: tagsSchema.optional(),
  transitionPaths: transitionPathsSchema.optional(),
});

const replaceItemSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  label: z.string().min(1).max(200),
  notes: z.string().max(2000).nullable().optional(),
  stageWidthM: z.number().min(1).max(100).optional(),
  stageDepthM: z.number().min(1).max(100).optional(),
  positions: z.array(positionSchema).max(100).default([]),
  transitionFromId: z.string().min(1).max(200).nullable().optional(),
  displayOrder: z.number().int().optional(),
  startSec: secSchema.optional(),
  endSec: secSchema.optional(),
  transitionNote: transitionNoteSchema.optional(),
  tags: tagsSchema.optional(),
  transitionPaths: transitionPathsSchema.optional(),
});

const replaceBodySchema = z.object({
  projectId: z.string().min(1).max(200).nullable().optional(),
  formations: z.array(replaceItemSchema).max(200),
});

// ─── Router factory ─────────────────────────────────────────────────────

export interface CreateDanceFormationRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createDanceFormationRouter(
  pool: Pool,
  deps: CreateDanceFormationRouterDeps = {},
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
    const rows = await listFormations(pool, userId, { projectId, limit: limitRaw });
    res.json({ success: true, data: rows });
  });

  router.get('/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const { userId } = req as AuthedRequest;
    const row = await getFormation(pool, userId, idParsed.data);
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
    const row = await createFormation(pool, userId, parsed.data as FormationInput);
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
    const row = await patchFormation(pool, userId, idParsed.data, parsed.data as FormationPatch);
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
    const ok = await deleteFormation(pool, userId, idParsed.data);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true });
  });

  router.put('/', auth, async (req: Request, res: Response): Promise<void> => {
    const parsed = replaceBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const written = await replaceFormations(
      pool,
      userId,
      parsed.data.projectId ?? null,
      parsed.data.formations,
    );
    res.json({ success: true, data: written });
  });

  return router;
}
