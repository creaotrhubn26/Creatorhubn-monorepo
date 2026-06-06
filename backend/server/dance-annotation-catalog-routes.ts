/**
 * Dance annotation catalog routes — categories + labels for DanceAnnotate.
 *
 *   GET    /api/dance/annotation-categories?projectId=
 *   POST   /api/dance/annotation-categories
 *   PATCH  /api/dance/annotation-categories/:id
 *   DELETE /api/dance/annotation-categories/:id
 *
 *   GET    /api/dance/annotation-labels?projectId=&categoryId=
 *   POST   /api/dance/annotation-labels
 *   PATCH  /api/dance/annotation-labels/:id
 *   DELETE /api/dance/annotation-labels/:id
 *
 * Auth: bearer-token via samme requireAuth-mønster som dance-formation-routes.
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
  listAnnotationCategories,
  createAnnotationCategory,
  patchAnnotationCategory,
  deleteAnnotationCategory,
  listAnnotationLabels,
  createAnnotationLabel,
  patchAnnotationLabel,
  deleteAnnotationLabel,
} from './dance-annotation-catalog-service.js';

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

const idSchema = z.string().min(1).max(200);
const projectIdSchema = z.string().min(1).max(200);
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);

const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
  color: hexColorSchema,
  shortcut: z.string().min(1).max(8).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  projectId: z.string().min(1).max(200).nullable().optional(),
});

const patchCategorySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: hexColorSchema.optional(),
  shortcut: z.string().max(8).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  projectId: z.string().min(1).max(200).nullable().optional(),
});

const createLabelSchema = z.object({
  name: z.string().min(1).max(120),
  categoryId: z.string().min(1).max(200).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  projectId: z.string().min(1).max(200).nullable().optional(),
});

const patchLabelSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  categoryId: z.string().min(1).max(200).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  projectId: z.string().min(1).max(200).nullable().optional(),
});

// ─── Router factory ─────────────────────────────────────────────────────

export interface CreateDanceAnnotationCatalogRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createDanceAnnotationCategoriesRouter(
  pool: Pool,
  deps: CreateDanceAnnotationCatalogRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  router.get('/', auth, async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
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
    const rows = await listAnnotationCategories(pool, userId, { projectId });
    res.json({ success: true, data: rows });
  });

  router.post('/', auth, async (req: Request, res: Response): Promise<void> => {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const row = await createAnnotationCategory(pool, userId, parsed.data);
    res.status(201).json({ success: true, data: row });
  });

  router.patch('/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const parsed = patchCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const row = await patchAnnotationCategory(pool, userId, idParsed.data, parsed.data);
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
    const result = await deleteAnnotationCategory(pool, userId, idParsed.data);
    if (result === 'not_found') {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (result === 'default_protected') {
      res.status(409).json({
        error: 'default_protected',
        message: 'Standard-kategorier kan ikke slettes — endre navn/farge i stedet.',
      });
      return;
    }
    res.json({ success: true });
  });

  return router;
}

export function createDanceAnnotationLabelsRouter(
  pool: Pool,
  deps: CreateDanceAnnotationCatalogRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  router.get('/', auth, async (req: Request, res: Response): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const projectIdRaw = req.query.projectId;
    const categoryIdRaw = req.query.categoryId;
    let projectId: string | undefined;
    if (typeof projectIdRaw === 'string' && projectIdRaw.trim().length > 0) {
      const parsed = projectIdSchema.safeParse(projectIdRaw.trim());
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_project_id' });
        return;
      }
      projectId = parsed.data;
    }
    let categoryId: string | undefined;
    if (typeof categoryIdRaw === 'string' && categoryIdRaw.trim().length > 0) {
      const parsed = idSchema.safeParse(categoryIdRaw.trim());
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_category_id' });
        return;
      }
      categoryId = parsed.data;
    }
    const rows = await listAnnotationLabels(pool, userId, { projectId, categoryId });
    res.json({ success: true, data: rows });
  });

  router.post('/', auth, async (req: Request, res: Response): Promise<void> => {
    const parsed = createLabelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const row = await createAnnotationLabel(pool, userId, parsed.data);
    res.status(201).json({ success: true, data: row });
  });

  router.patch('/:id', auth, async (req: Request, res: Response): Promise<void> => {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const parsed = patchLabelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    const row = await patchAnnotationLabel(pool, userId, idParsed.data, parsed.data);
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
    const ok = await deleteAnnotationLabel(pool, userId, idParsed.data);
    if (!ok) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
