/**
 * casting-video-routes.ts — mountes under /api/role-room/casting-videos.
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
import * as svc from './casting-video-service.js';
import { userOwnsCastingProject } from './casting-project-ownership.js';

interface SessionData { userId: string; email: string; name: string; role: string; loginAt: string; [key: string]: unknown; }
type AuthedRequest = Request & { userId: string; userEmail: string; userName: string };

async function resolveUser(pool: Pool, activeSessions: Map<string, SessionData> | undefined, bearer: string | null | undefined) {
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
    (req as AuthedRequest).userEmail = session.email;
    (req as AuthedRequest).userName = session.name;
    next();
  };
}

const uploadUrlBody = z.object({
  candidateId: z.string().min(1),
  projectId: z.string().min(1),
  filename: z.string().min(1).max(200),
  mimeType: z.string().regex(/^video\/(mp4|quicktime|webm|x-msvideo|x-matroska)$/i),
  fileSizeBytes: z.number().int().positive().max(2_000_000_000),
});

const confirmBody = z.object({
  durationSeconds: z.number().nonnegative().nullable().optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
});

const updateBody = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
});

const annotationBody = z.object({
  timestampSeconds: z.number().nonnegative(),
  comment: z.string().min(1).max(1000),
});

export interface CreateCastingVideoRouterDeps {
  activeSessions?: Map<string, SessionData>;
}

export function createCastingVideoRouter(
  pool: Pool,
  deps: CreateCastingVideoRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);

  // Audition videos are sensitive personal media. Auth proves a logged-in
  // user; these guards prove the caller owns the project the video belongs to,
  // closing the cross-tenant IDOR (download via presigned URLs / delete).
  async function ensureProjectOwner(
    req: Request,
    res: Response,
    projectId: string | null | undefined,
  ): Promise<boolean> {
    const userId = (req as AuthedRequest).userId;
    if (!projectId || !(await userOwnsCastingProject(pool, String(projectId), userId))) {
      res.status(404).json({ error: 'not_found' });
      return false;
    }
    return true;
  }

  async function ensureOwnerByVideo(
    req: Request,
    res: Response,
    videoId: string,
  ): Promise<boolean> {
    const r = await pool.query<{ project_id: string }>(
      'SELECT project_id FROM casting_candidate_videos WHERE id = $1',
      [videoId],
    );
    if (r.rowCount === 0) { res.status(404).json({ error: 'not_found' }); return false; }
    return ensureProjectOwner(req, res, r.rows[0].project_id);
  }

  // Liste videoer per kandidat — filtreres til prosjekter kalleren eier
  // (en kandidat kan ha videoer på tvers av prosjekter).
  router.get('/candidates/:candidateId/videos', auth, async (req, res) => {
    const videos = await svc.listVideosForCandidate(pool, String(req.params.candidateId));
    const userId = (req as AuthedRequest).userId;
    const ownsByProject = new Map<string, boolean>();
    const owned = [];
    for (const v of videos) {
      let ok = ownsByProject.get(v.projectId);
      if (ok === undefined) {
        ok = await userOwnsCastingProject(pool, v.projectId, userId);
        ownsByProject.set(v.projectId, ok);
      }
      if (ok) owned.push(v);
    }
    res.json({ success: true, data: owned });
  });

  // Liste videoer per prosjekt (for compare-mode)
  router.get('/projects/:projectId/videos', auth, async (req, res) => {
    if (!(await ensureProjectOwner(req, res, req.params.projectId))) return;
    const videos = await svc.listVideosForProject(pool, String(req.params.projectId));
    res.json({ success: true, data: videos });
  });

  // Forespør upload-URL — returnerer presigned PUT-URL + video-id
  router.post('/upload-url', auth, async (req, res) => {
    const parsed = uploadUrlBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request', details: parsed.error.format() }); return; }
    if (!(await ensureProjectOwner(req, res, parsed.data.projectId))) return;
    try {
      const { userId } = req as AuthedRequest;
      const result = await svc.createVideoUploadUrl(pool, { ...parsed.data, uploadedBy: userId });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ error: 'upload_url_failed', detail: String(err) });
    }
  });

  // Bekreft upload — settes til 'ready' + duration + thumbnail
  router.post('/videos/:videoId/confirm', auth, async (req, res) => {
    const parsed = confirmBody.safeParse(req.body ?? {});
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    if (!(await ensureOwnerByVideo(req, res, String(req.params.videoId)))) return;
    const updated = await svc.confirmVideoUpload(pool, String(req.params.videoId), parsed.data);
    if (!updated) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: updated });
  });

  // PATCH video-rad (rating, notes, title)
  router.patch('/videos/:videoId', auth, async (req, res) => {
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    if (!(await ensureOwnerByVideo(req, res, String(req.params.videoId)))) return;
    const updated = await svc.updateVideo(pool, String(req.params.videoId), parsed.data);
    if (!updated) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: updated });
  });

  // Slett video
  router.delete('/videos/:videoId', auth, async (req, res) => {
    if (!(await ensureOwnerByVideo(req, res, String(req.params.videoId)))) return;
    const ok = await svc.deleteVideo(pool, String(req.params.videoId));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  });

  // Annotations CRUD
  router.get('/videos/:videoId/annotations', auth, async (req, res) => {
    if (!(await ensureOwnerByVideo(req, res, String(req.params.videoId)))) return;
    const items = await svc.listAnnotations(pool, String(req.params.videoId));
    res.json({ success: true, data: items });
  });

  router.post('/videos/:videoId/annotations', auth, async (req, res) => {
    const parsed = annotationBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'invalid_request' }); return; }
    if (!(await ensureOwnerByVideo(req, res, String(req.params.videoId)))) return;
    const { userId, userName } = req as AuthedRequest;
    const created = await svc.createAnnotation(pool, String(req.params.videoId), {
      ...parsed.data,
      authorUserId: userId,
      authorName: userName,
    });
    res.status(201).json({ success: true, data: created });
  });

  router.delete('/annotations/:annotationId', auth, async (req, res) => {
    const owns = await pool.query<{ project_id: string }>(
      `SELECT v.project_id
         FROM casting_video_annotations a
         JOIN casting_candidate_videos v ON v.id = a.video_id
        WHERE a.id = $1`,
      [String(req.params.annotationId)],
    );
    if (owns.rowCount === 0) { res.status(404).json({ error: 'not_found' }); return; }
    if (!(await ensureProjectOwner(req, res, owns.rows[0].project_id))) return;
    const ok = await svc.deleteAnnotation(pool, String(req.params.annotationId));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  });

  return router;
}
