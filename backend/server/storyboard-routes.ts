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
  metadata: z.record(z.string(), z.unknown()).optional(),
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

  // ── AI image generation (DALL-E 3) ─────────────────────────────────
  // Genererer et konseptbilde for et storyboard-frame basert på scene-
  // context + optional brukerprompt. Bildet lagres som image_data
  // (base64 data-URL) på framet så tegneren kan tegne over.
  router.post('/projects/:projectId/storyboards/:id/generate-ai-image', auth, async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'image_gen_disabled',
        detail: 'OPENAI_API_KEY ikke satt på server. Legg til den i Render env-vars.',
      });
      return;
    }

    const sb = await svc.getStoryboard(pool, String(req.params.id));
    if (!sb || sb.projectId !== String(req.params.projectId)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const body = (req.body ?? {}) as {
      prompt?: string;
      sceneDescription?: string;
      intExt?: string;
      timeOfDay?: string;
      locationName?: string;
      shotType?: string;
      cinematicFormat?: string;
      styleNote?: string;
      quality?: 'standard' | 'hd';
      aspectRatio?: '1792x1024' | '1024x1024' | '1024x1792';
    };

    // Komponer en cinematic-storyboard-prompt fra scene-context + user-prompt.
    // styleNote kommer fra valgt stil-preset i frontend (noir / watercolor /
    // live action / anime / sci-fi). Når brukeren har valgt en eksplisitt
    // stil skal DEN være siste-ords-instruks til DALL·E — ikke den default
    // pencil/charcoal-fallbacken, som tidligere overstyrte Noir-prompten
    // ("Sin City graphic novel") med motsigende "pencil sketch"-instruks.
    const defaultStyleSuffix = 'Render as black-and-white pencil/charcoal storyboard sketch with loose strokes, clear silhouettes, no text, no captions, no logos, focus on composition and lighting.';
    const parts: (string | null)[] = [
      'Cinematic storyboard concept frame',
      sb.title ? `Shot: ${sb.title}` : null,
      body.shotType ? `Shot type: ${body.shotType}` : null,
      body.intExt && body.timeOfDay ? `${body.intExt}. ${body.timeOfDay}` : null,
      body.locationName ? `Location: ${body.locationName}` : null,
      body.sceneDescription ? `Scene action: ${body.sceneDescription}` : null,
      body.prompt ? `Director note: ${body.prompt}` : null,
      // Stil-instruks SIST så DALL·E gir den størst vekt. Bruker preset
      // hvis satt, ellers default pencil/charcoal-fallback.
      body.styleNote ? `Style: ${body.styleNote}. No text, no captions, no logos.` : defaultStyleSuffix,
    ];
    const composedPrompt = parts.filter(Boolean).join('. ');

    const quality = body.quality === 'hd' ? 'hd' : 'standard';
    const size = body.aspectRatio ?? '1792x1024';

    // Express' Response shadower fetch's Response her. Bruker
    // Awaited<ReturnType<typeof fetch>> så typen er korrekt fetch-Response.
    let openaiResponse: Awaited<ReturnType<typeof fetch>> | undefined;
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: composedPrompt,
          n: 1,
          size,
          quality,
          response_format: 'b64_json',
        }),
      });
    } catch (err) {
      res.status(502).json({ error: 'openai_network', detail: String(err) });
      return;
    }

    if (!openaiResponse || !openaiResponse.ok) {
      const errText = openaiResponse ? await openaiResponse.text().catch(() => '') : '';
      res.status(502).json({
        error: 'openai_failed',
        status: openaiResponse?.status ?? 0,
        detail: errText.slice(0, 500),
      });
      return;
    }

    const data = await openaiResponse.json() as {
      data?: Array<{ b64_json?: string; revised_prompt?: string; url?: string }>;
    };
    const item = data.data?.[0];
    const b64 = item?.b64_json;
    if (!b64) {
      res.status(502).json({ error: 'openai_no_image', detail: 'No b64_json in response.' });
      return;
    }

    const imageData = `data:image/png;base64,${b64}`;
    // Lagre image_data + workflow_level som "ai-reference" + dimensjoner.
    const [w, h] = size.split('x').map((s) => parseInt(s, 10));
    const updated = await svc.updateStoryboard(pool, String(req.params.id), {
      imageData,
      width: w,
      height: h,
      metadata: {
        ...(sb.metadata as Record<string, unknown> ?? {}),
        aiImage: {
          provider: 'openai',
          model: 'dall-e-3',
          composedPrompt,
          revisedPrompt: item?.revised_prompt ?? null,
          generatedAt: new Date().toISOString(),
          generatedBy: (req as AuthedRequest).userId,
          quality, size,
        },
      },
    });
    if (!updated) {
      res.status(500).json({ error: 'save_failed' });
      return;
    }
    res.json({
      success: true,
      data: updated,
      composedPrompt,
      revisedPrompt: item?.revised_prompt ?? null,
    });
  });

  return router;
}
