/**
 * storyboard-routes.ts — mountes under /api/role-room.
 * CRUD for casting_storyboards + upsert by frame_id.
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
import * as svc from './storyboard-service.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}
type AuthedRequest = Request & { userId: string; userRole: string; userEmail: string };

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
  if (persisted) { activeSessions?.set(token, persisted); return persisted; }
  return null;
}

function requireAuth(pool: Pool, activeSessions?: Map<string, SessionData>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    const session = await resolveUser(pool, activeSessions, bearer);
    if (!session?.userId) { res.status(401).json({ error: 'unauthorized' }); return; }
    (req as AuthedRequest).userId = session.userId;
    (req as AuthedRequest).userRole = session.role;
    (req as AuthedRequest).userEmail = session.email;
    next();
  };
}

const upsertBody = z.object({
  sceneId: z.string().nullable().optional(),
  frameId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  strokes: z.array(z.unknown()).optional(),
  imageData: z.string().nullable().optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  workflowLevel: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export interface CreateStoryboardRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createStoryboardRouter(
  pool: Pool,
  deps: CreateStoryboardRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  // List for project, optional ?sceneId filter
  router.get('/projects/:projectId/storyboards', auth, async (req, res) => {
    const sceneId = typeof req.query.sceneId === 'string' ? req.query.sceneId : undefined;
    const items = await svc.listStoryboards(pool, String(req.params.projectId), sceneId);
    res.json({ success: true, data: items });
  });

  // Get one
  router.get('/projects/:projectId/storyboards/:id', auth, async (req, res) => {
    const sb = await svc.getStoryboard(pool, String(req.params.id));
    if (!sb || sb.projectId !== String(req.params.projectId)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true, data: sb });
  });

  // Upsert (POST = create or update by frame_id)
  router.post('/projects/:projectId/storyboards', auth, async (req, res) => {
    const parsed = upsertBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const { userId } = req as AuthedRequest;
    try {
      const sb = await svc.upsertStoryboard(pool, {
        projectId: String(req.params.projectId),
        ...parsed.data,
        createdBy: userId,
      });
      res.status(201).json({ success: true, data: sb });
    } catch (err) {
      res.status(500).json({ error: 'upsert_failed', detail: String(err) });
    }
  });

  // Update specific row by id
  router.patch('/projects/:projectId/storyboards/:id', auth, async (req, res) => {
    const parsed = upsertBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const sb = await svc.updateStoryboard(pool, String(req.params.id), parsed.data);
    if (!sb) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: sb });
  });

  // Delete
  router.delete('/projects/:projectId/storyboards/:id', auth, async (req, res) => {
    const ok = await svc.deleteStoryboard(pool, String(req.params.id));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  });

  return router;
}
