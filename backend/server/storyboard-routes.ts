/**
 * storyboard-routes.ts — mountes under /api/role-room.
 * CRUD for casting_storyboards + upsert by frame_id.
 */

import crypto from 'node:crypto';
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
import { canAccessRoleRoomProject } from './role-room-projects-routes.js';
import { viewerMeetsTabLevel } from './role-room-tab-access.js';
import {
  aiAllowed,
  emitGenAiMeter,
  genModelConfigured,
  getGenSettings,
} from './generative-media.js';
import { creditMove, getUserCredits } from './ai-credits.js';
import { getProjectFileDownloadUrl } from './role-room-user-storage-service.js';
import {
  ensureStoryboardVideoSchema,
  listStoryboardVideoModels,
  normalizeStoryboardVideoDuration,
  pollStoryboardVideoJob,
  resolveStoryboardVideoModel,
  spentOnGenerativeAIToday,
  submitStoryboardVideoJob,
} from './storyboard-video-service.js';
import {
  contextFromLegacyStoryboardInput,
  STORYBOARD_IMAGE_MODEL,
  storyboardContextSummary,
  storyboardImageEstimatedCostUsd,
  storyboardImageProviderQuality,
  storyboardImageProviderSize,
  storyboardShotContextSchema,
} from './storyboard-ai-context.js';
import {
  compileStoryboardPrompt,
  validateGeneratedImageBase64,
} from './storyboard-prompt-engine/index.js';
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

/**
 * Prosjekt-tilgang + Story Arc RBAC for storyboard-fanen. Tidligere krevde disse
 * rutene bare innlogging (`requireAuth`) uten noe prosjekt-eierskap/-medlemskap —
 * en autentisert kryss-tenant IDOR: enhver innlogget bruker kunne liste, lese,
 * skrive, slette (og brenne OpenAI-kreditt på bilde-generering for) et VILKÅRLIG
 * prosjekts storyboards. Nå: må være eier/medlem (canAccessRoleRoomProject) og
 * møte fane-nivået 'storyboard' (Se for lesing, Administrere for skriving).
 * Kjøres ETTER `requireAuth`, så `req.userId` er satt.
 */
function requireStoryboardAccess(pool: Pool, need: 'view' | 'manage') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const projectId = String(req.params.projectId || '').trim();
    if (!userId || !projectId) { res.status(400).json({ error: 'bad_request' }); return; }
    if (!(await canAccessRoleRoomProject(pool, userId, projectId))) {
      res.status(403).json({ error: 'forbidden' }); return;
    }
    if (!(await viewerMeetsTabLevel(pool, projectId, userId, 'storyboard', need))) {
      res.status(403).json({ error: 'forbidden_tab' }); return;
    }
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

const videoGenerateBody = z.object({
  prompt: z.string().trim().min(1).max(1_200),
  sourceFileId: z.string().uuid(),
  model: z.string().trim().max(80).default('auto'),
  duration: z.number().int().min(2).max(15).default(4),
  context: storyboardShotContextSchema.optional(),
});

const imageGenerateBody = z.object({
  prompt: z.string().trim().max(1_200).default(''),
  sceneDescription: z.string().trim().max(6_000).optional().default(''),
  intExt: z.string().trim().max(40).optional().default(''),
  timeOfDay: z.string().trim().max(100).optional().default(''),
  locationName: z.string().trim().max(500).optional().default(''),
  shotType: z.string().trim().max(120).optional().default(''),
  cinematicFormat: z.string().trim().max(300).optional().default(''),
  styleNote: z.string().trim().max(1_000).optional().default(''),
  quality: z.enum(['standard', 'hd']).default('standard'),
  aspectRatio: z.enum(['1792x1024', '1024x1024', '1024x1792']).default('1792x1024'),
  context: storyboardShotContextSchema.optional(),
});

const consentBody = z.object({ consented: z.boolean() });

const promptCompileBody = z.object({
  kind: z.enum(['storyboard-image', 'storyboard-video']),
  model: z.string().trim().min(1).max(80),
  userAction: z.string().trim().max(1_200).optional(),
  context: storyboardShotContextSchema,
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
  const canView = requireStoryboardAccess(pool, 'view');
  const canManage = requireStoryboardAccess(pool, 'manage');

  // List for project, optional ?sceneId filter
  router.get('/projects/:projectId/storyboards', auth, canView, async (req, res) => {
    const sceneId = typeof req.query.sceneId === 'string' ? req.query.sceneId : undefined;
    const items = await svc.listStoryboards(pool, String(req.params.projectId), sceneId);
    res.json({ success: true, data: items });
  });

  // Get one
  router.get('/projects/:projectId/storyboards/:id', auth, canView, async (req, res) => {
    const sb = await svc.getStoryboard(pool, String(req.params.id));
    if (!sb || sb.projectId !== String(req.params.projectId)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ success: true, data: sb });
  });

  // Upsert (POST = create or update by frame_id)
  router.post('/projects/:projectId/storyboards', auth, canManage, async (req, res) => {
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
      res.status(500).json({ error: 'upsert_failed', detail: "internal_error" });
    }
  });

  // Update specific row by id
  router.patch('/projects/:projectId/storyboards/:id', auth, canManage, async (req, res) => {
    const parsed = upsertBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const current = await svc.getStoryboard(pool, String(req.params.id));
    if (!current || current.projectId !== String(req.params.projectId)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const sb = await svc.updateStoryboard(pool, String(req.params.id), parsed.data);
    if (!sb) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true, data: sb });
  });

  // Delete
  router.delete('/projects/:projectId/storyboards/:id', auth, canManage, async (req, res) => {
    const current = await svc.getStoryboard(pool, String(req.params.id));
    if (!current || current.projectId !== String(req.params.projectId)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const ok = await svc.deleteStoryboard(pool, String(req.params.id));
    if (!ok) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ success: true });
  });

  // ── AI shot-video — én gateway, flere modeller ──────────────────────
  router.get('/projects/:projectId/storyboards/ai/video-config', auth, canView, async (req, res) => {
    try {
      await ensureStoryboardVideoSchema(pool);
      const actor = req as AuthedRequest;
      const settings = await getGenSettings(pool);
      const models = listStoryboardVideoModels();
      const consent = await pool.query(
        `SELECT consented, consented_by, consented_at
           FROM project_ai_consent WHERE project_id = $1`,
        [String(req.params.projectId)],
      ).catch(() => ({ rows: [] }));
      const selected = resolveStoryboardVideoModel('auto');
      const billingMultiplier = settings.billingMode === 'free_whitelist'
        ? 0 : (settings.markupMultiplier || 1);
      res.json({
        success: true,
        data: {
          enabled: settings.enabled
            && (Boolean(process.env.OPENAI_API_KEY) || models.some((model) => model.configured)),
          allowed: aiAllowed(settings, actor.userEmail, actor.userRole),
          imageConfigured: Boolean(process.env.OPENAI_API_KEY),
          billingMode: settings.billingMode,
          billingMultiplier,
          imageEstimatedChargeUsd: {
            standard: Number((storyboardImageEstimatedCostUsd('standard') * billingMultiplier).toFixed(2)),
            hd: Number((storyboardImageEstimatedCostUsd('hd') * billingMultiplier).toFixed(2)),
          },
          consent: consent.rows[0] ? {
            consented: Boolean(consent.rows[0].consented),
            by: consent.rows[0].consented_by,
            at: consent.rows[0].consented_at,
          } : { consented: false },
          defaultModel: selected?.key ?? null,
          models,
        },
      });
    } catch (error) {
      console.error('GET storyboard video-config', error);
      res.status(500).json({ error: 'video_config_failed' });
    }
  });

  router.put('/projects/:projectId/storyboards/ai/consent', auth, canManage, async (req, res) => {
    const parsed = consentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    try {
      await ensureStoryboardVideoSchema(pool);
      const actor = req as AuthedRequest;
      await pool.query(
        `INSERT INTO project_ai_consent (project_id, consented, consented_by, consented_at)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (project_id) DO UPDATE
           SET consented = EXCLUDED.consented,
               consented_by = EXCLUDED.consented_by,
               consented_at = NOW()`,
        [String(req.params.projectId), parsed.data.consented, actor.userEmail || actor.userId],
      );
      res.json({ success: true, data: { consented: parsed.data.consented } });
    } catch (error) {
      console.error('PUT storyboard ai consent', error);
      res.status(500).json({ error: 'consent_update_failed' });
    }
  });

  // Provider-free compilation for AI → Prompt Inspector. No screenplay or
  // production reference leaves The Role Room through this endpoint.
  router.post('/projects/:projectId/storyboards/:id/compile-ai-prompt', auth, canView, async (req, res) => {
    const parsed = promptCompileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const projectId = String(req.params.projectId);
    const storyboard = await svc.getStoryboard(pool, String(req.params.id));
    if (!storyboard || storyboard.projectId !== projectId || !storyboard.frameId) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (parsed.data.context.scene.id && storyboard.sceneId
        && parsed.data.context.scene.id !== storyboard.sceneId) {
      res.status(400).json({ error: 'context_mismatch', detail: 'Manuskonteksten tilhører en annen scene.' });
      return;
    }
    if (parsed.data.context.shot.id
        && parsed.data.context.shot.id !== storyboard.frameId) {
      res.status(400).json({ error: 'context_mismatch', detail: 'Manuskonteksten tilhører et annet shot.' });
      return;
    }
    const compilation = compileStoryboardPrompt({
      kind: parsed.data.kind,
      modelId: parsed.data.model,
      userAction: parsed.data.userAction,
      context: parsed.data.context,
    });
    res.json({ success: true, data: compilation });
  });

  router.post('/projects/:projectId/storyboards/:id/generate-ai-video', auth, canManage, async (req, res) => {
    const parsed = videoGenerateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const projectId = String(req.params.projectId);
    const storyboard = await svc.getStoryboard(pool, String(req.params.id));
    if (!storyboard || storyboard.projectId !== projectId || !storyboard.frameId) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (parsed.data.context?.scene.id && storyboard.sceneId
        && parsed.data.context.scene.id !== storyboard.sceneId) {
      res.status(400).json({ error: 'context_mismatch', detail: 'Manuskonteksten tilhører en annen scene.' });
      return;
    }
    if (parsed.data.context?.shot.id
        && parsed.data.context.shot.id !== storyboard.frameId) {
      res.status(400).json({ error: 'context_mismatch', detail: 'Manuskonteksten tilhører et annet shot.' });
      return;
    }
    try {
      await ensureStoryboardVideoSchema(pool);
      const actor = req as AuthedRequest;
      const settings = await getGenSettings(pool);
      if (!settings.enabled || !aiAllowed(settings, actor.userEmail, actor.userRole)) {
        res.status(403).json({ error: 'ai_not_allowed', detail: 'AI-video er ikke aktivert for kontoen.' });
        return;
      }
      const model = resolveStoryboardVideoModel(parsed.data.model);
      if (!model) {
        res.status(400).json({ error: 'unsupported_model', detail: 'Ukjent videomodell.' });
        return;
      }
      if (!genModelConfigured(model)) {
        res.status(503).json({ error: 'provider_not_configured', detail: 'Valgt AI-leverandør er ikke konfigurert.' });
        return;
      }
      const consent = await pool.query(
        `SELECT consented FROM project_ai_consent WHERE project_id = $1`,
        [projectId],
      ).catch(() => ({ rows: [] }));
      if (!consent.rows[0]?.consented) {
        res.status(409).json({
          error: 'consent_required',
          detail: 'Krever samtykke: storyboard-bildet og avgrenset manuskontekst sendes til en ekstern AI-leverandør.',
        });
        return;
      }

      // Filen må tilhøre samme prosjekt OG samme storyboard-frame.
      const source = await getProjectFileDownloadUrl(pool, {
        projectId,
        fileId: parsed.data.sourceFileId,
        attachedToEntityType: 'storyboard_frame',
        attachedToEntityId: storyboard.frameId,
        requireImage: true,
        expiresInSeconds: 3600,
      });
      if (!source.ok) {
        res.status(source.reason === 'not_found' ? 404 : 503).json({
          error: 'source_unavailable',
          detail: source.reason === 'not_found'
            ? 'Kildebildet finnes ikke på dette shotet.'
            : 'Kildebildet kan ikke deles med AI-leverandøren akkurat nå.',
        });
        return;
      }

      const duration = normalizeStoryboardVideoDuration(model.key, parsed.data.duration);
      const estCostUsd = Number((duration * (model.costPerSecondUsd ?? model.estCostUsd)).toFixed(4));
      const spentToday = await spentOnGenerativeAIToday(pool);
      if (spentToday + estCostUsd > settings.dailyCapUsd) {
        res.status(429).json({ error: 'daily_cap', detail: 'Dagens AI-kostnadstak er nådd.' });
        return;
      }
      if (settings.billingMode === 'credits') {
        const wallet = await getUserCredits(pool, actor.userId);
        const required = estCostUsd * (settings.markupMultiplier || 1);
        if (wallet.balanceUsd < required) {
          res.status(402).json({ error: 'insufficient_credits', detail: 'Ikke nok AI-kreditter.' });
          return;
        }
      }

      const baseVideoContext = parsed.data.context ?? contextFromLegacyStoryboardInput({
        storyboardId: storyboard.frameId,
        title: storyboard.title,
        prompt: parsed.data.prompt,
      });
      const videoContext = {
        ...baseVideoContext,
        shot: { ...baseVideoContext.shot, durationSec: duration },
      };
      const promptEngine = compileStoryboardPrompt({
        kind: 'storyboard-video',
        modelId: model.key,
        context: videoContext,
        userAction: parsed.data.prompt,
      });
      if (!promptEngine.validation.valid) {
        res.status(422).json({
          error: 'prompt_validation_failed',
          detail: 'Shotet mangler nødvendig produksjonskontekst.',
          validation: promptEngine.validation,
        });
        return;
      }
      const job = await submitStoryboardVideoJob(pool, {
        projectId,
        userId: actor.userId,
        userEmail: actor.userEmail,
        storyboardId: storyboard.id,
        frameId: storyboard.frameId,
        sourceFileId: parsed.data.sourceFileId,
        sourceUrl: source.url,
        prompt: promptEngine.compiledPrompt,
        requestedModel: model.key,
        requestedDuration: duration,
      });
      res.status(202).json({ success: true, data: job, promptEngine });
    } catch (error) {
      console.error('POST storyboard generate-ai-video', error);
      res.status(502).json({ error: 'video_submit_failed', detail: 'Kunne ikke starte videogenereringen.' });
    }
  });

  router.get('/projects/:projectId/storyboards/ai/video-jobs/:jobId', auth, canView, async (req, res) => {
    try {
      await ensureStoryboardVideoSchema(pool);
      const job = await pollStoryboardVideoJob(
        pool,
        String(req.params.projectId),
        String(req.params.jobId),
      );
      if (!job) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      if (job.newlyCompleted) {
        const settings = await getGenSettings(pool);
        await emitGenAiMeter(pool, {
          userId: job.userId,
          valueUsd: job.estCostUsd,
          settings,
        }).catch(() => undefined);
        if (settings.billingMode === 'credits' && job.userId) {
          await creditMove(
            pool,
            job.userId,
            'spend',
            -(job.estCostUsd * (settings.markupMultiplier || 1)),
            `job:${job.jobId}`,
            job.model,
          ).catch(() => false);
        }
      }
      const { newlyCompleted: _newlyCompleted, userId: _userId, ...publicJob } = job;
      res.json({ success: true, data: publicJob });
    } catch (error) {
      console.error('GET storyboard ai video job', error);
      res.status(502).json({ error: 'video_poll_failed', detail: 'Kunne ikke hente videostatus akkurat nå.' });
    }
  });

  // ── AI image generation (GPT Image 2) ────────────────────────────────
  // Ett rikt, versjonert Shot Context brukes både her og ved animasjon.
  // Ekstern deling, kostnad og tilgang må være eksplisitt godkjent først.
  router.post('/projects/:projectId/storyboards/:id/generate-ai-image', auth, canManage, async (req, res) => {
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
    const parsed = imageGenerateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_request', details: parsed.error.format() });
      return;
    }
    const body = parsed.data;
    if (body.context?.scene.id && sb.sceneId && body.context.scene.id !== sb.sceneId) {
      res.status(400).json({ error: 'context_mismatch', detail: 'Manuskonteksten tilhører en annen scene.' });
      return;
    }
    if (body.context?.shot.id && sb.frameId && body.context.shot.id !== sb.frameId) {
      res.status(400).json({ error: 'context_mismatch', detail: 'Manuskonteksten tilhører et annet shot.' });
      return;
    }
    const context = body.context ?? contextFromLegacyStoryboardInput({
      storyboardId: sb.id,
      title: sb.title,
      sceneDescription: body.sceneDescription,
      intExt: body.intExt,
      timeOfDay: body.timeOfDay,
      locationName: body.locationName,
      shotType: body.shotType,
      prompt: body.prompt,
      styleNote: body.styleNote || 'black-and-white pencil/charcoal storyboard sketch with clear silhouettes, composition and motivated lighting',
    });
    const promptEngine = compileStoryboardPrompt({
      kind: 'storyboard-image',
      modelId: STORYBOARD_IMAGE_MODEL,
      context,
      userAction: body.prompt,
    });
    const animationPromptEngine = compileStoryboardPrompt({
      kind: 'storyboard-video',
      modelId: 'longcat-video-i2v',
      context,
      userAction: body.prompt,
    });
    if (!promptEngine.validation.valid) {
      res.status(422).json({
        error: 'prompt_validation_failed',
        detail: 'Shotet mangler nødvendig produksjonskontekst.',
        validation: promptEngine.validation,
      });
      return;
    }
    const composedPrompt = promptEngine.compiledPrompt;
    const animationPrompt = animationPromptEngine.compiledPrompt;
    const contextFingerprint = promptEngine.contextFingerprint;
    const contextSummary = storyboardContextSummary(context);

    const projectId = String(req.params.projectId);
    const actor = req as AuthedRequest;
    const requestedQuality = body.quality;
    const quality = storyboardImageProviderQuality(requestedQuality);
    const size = storyboardImageProviderSize(body.aspectRatio);
    const estCostUsd = storyboardImageEstimatedCostUsd(requestedQuality);
    const jobId = crypto.randomUUID();

    try {
      await ensureStoryboardVideoSchema(pool);
      const settings = await getGenSettings(pool);
      const billingMultiplier = settings.billingMode === 'free_whitelist'
        ? 0 : (settings.markupMultiplier || 1);
      const estimatedChargeUsd = Number((estCostUsd * billingMultiplier).toFixed(2));
      if (!settings.enabled || !aiAllowed(settings, actor.userEmail, actor.userRole)) {
        res.status(403).json({ error: 'ai_not_allowed', detail: 'AI-bilder er ikke aktivert for kontoen.' });
        return;
      }
      const consent = await pool.query(
        `SELECT consented FROM project_ai_consent WHERE project_id = $1`,
        [projectId],
      );
      if (!consent.rows[0]?.consented) {
        res.status(409).json({
          error: 'consent_required',
          detail: 'Krever samtykke: den avgrensede manuskonteksten sendes til OpenAI for å lage storyboard-bildet.',
        });
        return;
      }
      const recent = await pool.query(
        `SELECT COUNT(*)::int AS count FROM generative_ai_jobs
          WHERE user_id = $1 AND kind = 'text-to-image'
            AND created_at > NOW() - INTERVAL '1 minute'`,
        [actor.userId],
      );
      if (Number(recent.rows[0]?.count || 0) >= 5) {
        res.status(429).json({ error: 'rate_limited', detail: 'Vent litt før du lager flere storyboard-bilder.' });
        return;
      }
      const spentToday = await spentOnGenerativeAIToday(pool);
      if (spentToday + estCostUsd > settings.dailyCapUsd) {
        res.status(429).json({ error: 'daily_cap', detail: 'Dagens AI-kostnadstak er nådd.' });
        return;
      }
      if (settings.billingMode === 'credits') {
        const wallet = await getUserCredits(pool, actor.userId);
        const required = estCostUsd * (settings.markupMultiplier || 1);
        if (wallet.balanceUsd < required) {
          res.status(402).json({ error: 'insufficient_credits', detail: 'Ikke nok AI-kreditter.' });
          return;
        }
      }
      await pool.query(
        `INSERT INTO generative_ai_jobs
          (id, project_id, user_id, user_email, model, kind, status, provider, input, est_cost_usd)
         VALUES ($1,$2,$3,$4,$5,'text-to-image','running','openai',$6::jsonb,$7)`,
        [jobId, projectId, actor.userId, actor.userEmail, STORYBOARD_IMAGE_MODEL,
          JSON.stringify({
            storyboardId: sb.id,
            frameId: sb.frameId,
            contextVersion: context.version,
            contextFingerprint,
            contextSummary,
            size,
            quality,
          }), estCostUsd],
      );

      let openaiResponse: Awaited<ReturnType<typeof fetch>>;
      try {
        openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: STORYBOARD_IMAGE_MODEL,
            prompt: composedPrompt,
            n: 1,
            size,
            quality,
          }),
        });
      } catch {
        await pool.query(
          `UPDATE generative_ai_jobs SET status = 'failed', error = 'provider_network_error', completed_at = NOW()
            WHERE id = $1`, [jobId],
        ).catch(() => undefined);
        res.status(502).json({ error: 'openai_network', detail: 'Bildeleverandøren kunne ikke nås.' });
        return;
      }

      if (!openaiResponse.ok) {
        await openaiResponse.text().catch(() => '');
        await pool.query(
          `UPDATE generative_ai_jobs SET status = 'failed', error = $1, completed_at = NOW()
            WHERE id = $2`, [`provider_http_${openaiResponse.status}`, jobId],
        ).catch(() => undefined);
        res.status(502).json({
          error: 'openai_failed',
          status: openaiResponse.status,
          detail: 'Bildeleverandøren avviste forespørselen. Ingen leverandørdetaljer eller manusdata logges i svaret.',
        });
        return;
      }

      const data = await openaiResponse.json() as {
        data?: Array<{ b64_json?: string; revised_prompt?: string; url?: string }>;
      };
      const item = data.data?.[0];
      const b64 = item?.b64_json;
      if (!b64) {
        await pool.query(
          `UPDATE generative_ai_jobs SET status = 'failed', error = 'provider_no_image', completed_at = NOW()
            WHERE id = $1`, [jobId],
        ).catch(() => undefined);
        res.status(502).json({ error: 'openai_no_image', detail: 'Bildeleverandøren returnerte ikke et bilde.' });
        return;
      }

      const generationValidation = validateGeneratedImageBase64(b64);
      if (!generationValidation.valid) {
        await pool.query(
          `UPDATE generative_ai_jobs SET status = 'failed', error = 'provider_invalid_image', completed_at = NOW()
            WHERE id = $1`, [jobId],
        ).catch(() => undefined);
        res.status(502).json({
          error: 'openai_invalid_image',
          detail: 'Bildeleverandøren returnerte en ugyldig bildepayload.',
          validation: generationValidation,
        });
        return;
      }

      await pool.query(
        `UPDATE generative_ai_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [jobId],
      );
      await emitGenAiMeter(pool, {
        userId: actor.userId,
        valueUsd: estCostUsd,
        settings,
      }).catch(() => undefined);
      if (settings.billingMode === 'credits') {
        await creditMove(
          pool,
          actor.userId,
          'spend',
          -(estCostUsd * (settings.markupMultiplier || 1)),
          `job:${jobId}`,
          STORYBOARD_IMAGE_MODEL,
        ).catch(() => false);
      }

      const imageData = `data:image/png;base64,${b64}`;
      const [w, h] = size.split('x').map((value) => Number.parseInt(value, 10));
      const updated = await svc.updateStoryboard(pool, String(req.params.id), {
        imageData,
        width: w,
        height: h,
        metadata: {
          ...(sb.metadata as Record<string, unknown> ?? {}),
          aiImage: {
            jobId,
            provider: 'openai',
            model: STORYBOARD_IMAGE_MODEL,
            composedPrompt,
            revisedPrompt: item?.revised_prompt ?? null,
            generatedAt: new Date().toISOString(),
            generatedBy: actor.userId,
            requestedQuality,
            quality,
            size,
            estCostUsd,
            estimatedChargeUsd,
            context,
            contextVersion: context.version,
            contextFingerprint,
            contextSummary,
            animationPrompt,
            promptEngine,
            animationPromptEngine,
            generationValidation,
          },
        },
      });
      if (!updated) {
        await pool.query(
          `UPDATE generative_ai_jobs SET error = 'save_failed_after_generation' WHERE id = $1`,
          [jobId],
        ).catch(() => undefined);
        res.status(500).json({ error: 'save_failed' });
        return;
      }
      res.json({
        success: true,
        data: updated,
        jobId,
        model: STORYBOARD_IMAGE_MODEL,
        estCostUsd,
        estimatedChargeUsd,
        composedPrompt,
        revisedPrompt: item?.revised_prompt ?? null,
        contextVersion: context.version,
        contextFingerprint,
        contextSummary,
        animationPrompt,
        promptEngine,
        animationPromptEngine,
        generationValidation,
      });
    } catch (error) {
      console.error('POST storyboard generate-ai-image',
        error instanceof Error ? error.message : 'unknown_error');
      await pool.query(
        `UPDATE generative_ai_jobs SET status = 'failed', error = 'internal_error', completed_at = NOW()
          WHERE id = $1 AND status = 'running'`, [jobId],
      ).catch(() => undefined);
      res.status(500).json({ error: 'image_generation_failed', detail: 'Storyboard-bildet kunne ikke lages akkurat nå.' });
    }
  });

  return router;
}
