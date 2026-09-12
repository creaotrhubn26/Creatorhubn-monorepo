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
} from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { loadPersistedAuthSession } from "./auth-session-store.js";
import { canAccessRoleRoomProject } from "./role-room-projects-routes.js";
import { viewerMeetsTabLevel } from "./role-room-tab-access.js";
import {
  enrichStoryboardContextWithStrokes,
  storyboardShotContextSchema,
} from "./storyboard-ai-context.js";
import {
  compileStoryboardPrompt,
  storyboardScenarioCatalogView,
} from "./storyboard-prompt-engine/index.js";
import { storyboardAIModelCatalogView } from "./storyboard-ai-routing.js";
import { hydrateStoryboardProductionContext } from "./storyboard-production-context.js";
import * as svc from "./storyboard-service.js";
import { registerStoryboardReferenceRoutes } from "./storyboard-reference-routes.js";
import {
  generateStoryboardImage,
  StoryboardImageGenerationError,
  storyboardImageGenerationBodySchema,
} from "./storyboard-ai-image-service.js";
import {
  completeStoryboardImageCost,
  failStoryboardImageCost,
  reserveStoryboardImageCost,
  StoryboardAICostError,
} from "./storyboard-ai-cost-control.js";
import {
  getStoryboardVideoConfig,
  pollStoryboardVideo,
  preflightStoryboardVideo,
  setStoryboardVideoConsent,
  StoryboardVideoError,
  submitStoryboardVideo,
} from "./storyboard-ai-video-service.js";

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}
type AuthedRequest = Request & {
  userId: string;
  userRole: string;
  userEmail: string;
};

async function resolveUser(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  bearer: string | null | undefined,
): Promise<SessionData | null> {
  const token = typeof bearer === "string" ? bearer.trim() : "";
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
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    const session = await resolveUser(pool, activeSessions, bearer);
    if (!session?.userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
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
function requireStoryboardAccess(pool: Pool, need: "view" | "manage") {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { userId } = req as AuthedRequest;
    const projectId = String(req.params.projectId || "").trim();
    if (!userId || !projectId) {
      res.status(400).json({ error: "bad_request" });
      return;
    }
    if (!(await canAccessRoleRoomProject(pool, userId, projectId))) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (
      !(await viewerMeetsTabLevel(pool, projectId, userId, "storyboard", need))
    ) {
      res.status(403).json({ error: "forbidden_tab" });
      return;
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

const promptCompileBody = z.object({
  kind: z.enum(["storyboard-image", "storyboard-video"]),
  model: z.string().trim().min(1).max(80),
  userAction: z.string().trim().max(1_200).optional(),
  context: storyboardShotContextSchema,
});

const storyboardVideoBody = z.object({
  context: storyboardShotContextSchema,
  model: z.enum(["seedance-2-i2v", "higgsfield-dop-i2v"]).default("seedance-2-i2v"),
  duration: z.number().min(4).max(15).default(5),
  userAction: z.string().trim().max(1_200).optional(),
  confirmedPreflight: z.object({
    compilationFingerprint: z.string().trim().min(8).max(128),
    sourceFingerprint: z.string().trim().min(8).max(128),
    maxEstimatedCostUsd: z.number().nonnegative().max(100),
  }).strict().optional(),
}).strict();

const storyboardVideoPreflightBody = storyboardVideoBody.omit({ confirmedPreflight: true });

export interface CreateStoryboardRouterDeps {
  activeSessions?: Map<string, SessionData>;
  /** Injectable provider transport for contract tests. */
  fetchImpl?: typeof fetch;
}

export function createStoryboardRouter(
  pool: Pool,
  deps: CreateStoryboardRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);
  const canView = requireStoryboardAccess(pool, "view");
  const canManage = requireStoryboardAccess(pool, "manage");

  registerStoryboardReferenceRoutes(router, pool, { auth, canView, canManage });

  // Public production vocabulary, available to every authenticated Storyboard
  // Room user. It contains labels and stable IDs only; project data remains
  // protected by the project-level routes below.
  router.get("/storyboard-scenario-packs", auth, (_req, res) => {
    res.json({ success: true, data: storyboardScenarioCatalogView() });
  });

  router.get("/storyboard-ai-models", auth, (_req, res) => {
    res.json({ success: true, data: storyboardAIModelCatalogView() });
  });

  router.get(
    "/projects/:projectId/storyboard-ai-config",
    auth,
    canView,
    async (req, res) => {
      const config = await getStoryboardVideoConfig(pool, {
        projectId: String(req.params.projectId),
        userEmail: (req as AuthedRequest).userEmail,
        userRole: (req as AuthedRequest).userRole,
      });
      res.json({ success: true, data: config });
    },
  );

  router.put(
    "/projects/:projectId/storyboard-ai-consent",
    auth,
    canManage,
    async (req, res) => {
      const parsed = z.object({ consented: z.boolean() }).strict().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_request" });
        return;
      }
      await setStoryboardVideoConsent(pool, {
        projectId: String(req.params.projectId), consented: parsed.data.consented,
        consentedBy: (req as AuthedRequest).userEmail || (req as AuthedRequest).userId,
      });
      res.json({ success: true, data: { consented: parsed.data.consented } });
    },
  );

  // List for project, optional ?sceneId filter
  router.get(
    "/projects/:projectId/storyboards",
    auth,
    canView,
    async (req, res) => {
      const sceneId =
        typeof req.query.sceneId === "string" ? req.query.sceneId : undefined;
      const items = await svc.listStoryboards(
        pool,
        String(req.params.projectId),
        sceneId,
      );
      res.json({ success: true, data: items });
    },
  );

  // Get one
  router.get(
    "/projects/:projectId/storyboards/:id",
    auth,
    canView,
    async (req, res) => {
      const sb = await svc.getStoryboard(pool, String(req.params.id));
      if (!sb || sb.projectId !== String(req.params.projectId)) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ success: true, data: sb });
    },
  );

  // Upsert (POST = create or update by frame_id)
  router.post(
    "/projects/:projectId/storyboards",
    auth,
    canManage,
    async (req, res) => {
      const parsed = upsertBody.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "invalid_request", details: parsed.error.format() });
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
        res
          .status(500)
          .json({ error: "upsert_failed", detail: "internal_error" });
      }
    },
  );

  router.post(
    "/projects/:projectId/storyboards/:id/animation-preflight",
    auth,
    canManage,
    async (req, res) => {
      const parsed = storyboardVideoPreflightBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_request", details: parsed.error.format() });
        return;
      }
      const projectId = String(req.params.projectId);
      const storyboard = await svc.getStoryboard(pool, String(req.params.id));
      if (!storyboard || storyboard.projectId !== projectId || !storyboard.frameId) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if ((parsed.data.context.scene.id && storyboard.sceneId
          && parsed.data.context.scene.id !== storyboard.sceneId)
          || (parsed.data.context.shot.id
            && parsed.data.context.shot.id !== storyboard.frameId)) {
        res.status(400).json({
          error: "context_mismatch",
          detail: "Manus- eller shotkonteksten tilhører et annet storyboard.",
        });
        return;
      }
      try {
        const hydrated = await hydrateStoryboardProductionContext(pool, {
          projectId, sceneId: storyboard.sceneId || parsed.data.context.scene.id,
          context: parsed.data.context,
        });
        const context = enrichStoryboardContextWithStrokes(
          hydrated, storyboard.strokes ?? [], storyboard.width, storyboard.height,
        );
        const compilation = compileStoryboardPrompt({
          kind: "storyboard-video", modelId: parsed.data.model,
          userAction: parsed.data.userAction, context,
        });
        if (!compilation.validation.valid) {
          res.status(422).json({ error: "prompt_preflight_failed", data: compilation });
          return;
        }
        const checked = await preflightStoryboardVideo(pool, {
          projectId, storyboard,
          userId: (req as AuthedRequest).userId,
          userEmail: (req as AuthedRequest).userEmail,
          userRole: (req as AuthedRequest).userRole,
          modelId: parsed.data.model, duration: parsed.data.duration,
          compiledPrompt: compilation.compiledPrompt,
        });
        res.json({
          success: true,
          data: {
            model: checked.model, provider: checked.provider, duration: checked.duration,
            estimatedCostUsd: checked.estimatedCostUsd,
            providerCredits: checked.providerCredits,
            sourceFingerprint: checked.sourceFingerprint,
            compilationFingerprint: compilation.compilationFingerprint,
          },
          compilation,
        });
      } catch (error) {
        if (error instanceof StoryboardVideoError) {
          res.status(error.status).json({ error: error.code, detail: error.safeDetail });
          return;
        }
        res.status(500).json({ error: "animation_preflight_failed", detail: "internal_error" });
      }
    },
  );

  router.post(
    "/projects/:projectId/storyboards/:id/animate",
    auth,
    canManage,
    async (req, res) => {
      const parsed = storyboardVideoBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_request", details: parsed.error.format() });
        return;
      }
      const projectId = String(req.params.projectId);
      const storyboard = await svc.getStoryboard(pool, String(req.params.id));
      if (!storyboard || storyboard.projectId !== projectId || !storyboard.frameId) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if ((parsed.data.context.scene.id && storyboard.sceneId
          && parsed.data.context.scene.id !== storyboard.sceneId)
          || (parsed.data.context.shot.id
            && parsed.data.context.shot.id !== storyboard.frameId)) {
        res.status(400).json({
          error: "context_mismatch",
          detail: "Manus- eller shotkonteksten tilhører et annet storyboard.",
        });
        return;
      }
      try {
        const hydrated = await hydrateStoryboardProductionContext(pool, {
          projectId, sceneId: storyboard.sceneId || parsed.data.context.scene.id,
          context: parsed.data.context,
        });
        const context = enrichStoryboardContextWithStrokes(
          hydrated, storyboard.strokes ?? [], storyboard.width, storyboard.height,
        );
        const compilation = compileStoryboardPrompt({
          kind: "storyboard-video", modelId: parsed.data.model,
          userAction: parsed.data.userAction, context,
        });
        if (!compilation.validation.valid) {
          res.status(422).json({ error: "prompt_preflight_failed", data: compilation });
          return;
        }
        const submitted = await submitStoryboardVideo(pool, {
          projectId, storyboard,
          userId: (req as AuthedRequest).userId,
          userEmail: (req as AuthedRequest).userEmail,
          userRole: (req as AuthedRequest).userRole,
          modelId: parsed.data.model, duration: parsed.data.duration,
          compiledPrompt: compilation.compiledPrompt,
          compilationFingerprint: compilation.compilationFingerprint,
          confirmedPreflight: parsed.data.confirmedPreflight,
        });
        res.status(202).json({ success: true, data: submitted, compilation });
      } catch (error) {
        if (error instanceof StoryboardVideoError) {
          res.status(error.status).json({ error: error.code, detail: error.safeDetail });
          return;
        }
        res.status(500).json({ error: "animation_failed", detail: "internal_error" });
      }
    },
  );

  router.get(
    "/projects/:projectId/storyboards/:id/animations/:jobId",
    auth,
    canView,
    async (req, res) => {
      const projectId = String(req.params.projectId);
      const storyboard = await svc.getStoryboard(pool, String(req.params.id));
      if (!storyboard || storyboard.projectId !== projectId) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      try {
        const status = await pollStoryboardVideo(pool, {
          projectId, storyboardId: storyboard.id, jobId: String(req.params.jobId),
          fetchImpl: deps.fetchImpl,
        });
        res.json({ success: true, data: status });
      } catch (error) {
        if (error instanceof StoryboardVideoError) {
          res.status(error.status).json({ error: error.code, detail: error.safeDetail });
          return;
        }
        res.status(500).json({ error: "animation_poll_failed", detail: "internal_error" });
      }
    },
  );

  // Update specific row by id
  router.patch(
    "/projects/:projectId/storyboards/:id",
    auth,
    canManage,
    async (req, res) => {
      const parsed = upsertBody.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "invalid_request", details: parsed.error.format() });
        return;
      }
      const current = await svc.getStoryboard(pool, String(req.params.id));
      if (!current || current.projectId !== String(req.params.projectId)) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const sb = await svc.updateStoryboard(
        pool,
        String(req.params.id),
        parsed.data,
      );
      if (!sb) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ success: true, data: sb });
    },
  );

  // Delete
  router.delete(
    "/projects/:projectId/storyboards/:id",
    auth,
    canManage,
    async (req, res) => {
      const current = await svc.getStoryboard(pool, String(req.params.id));
      if (!current || current.projectId !== String(req.params.projectId)) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const ok = await svc.deleteStoryboard(pool, String(req.params.id));
      if (!ok) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ success: true });
    },
  );

  // Provider-free compilation for AI → Prompt Inspector. No screenplay or
  // production reference leaves The Role Room through this endpoint.
  router.post(
    "/projects/:projectId/storyboards/:id/compile-ai-prompt",
    auth,
    canView,
    async (req, res) => {
      const parsed = promptCompileBody.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "invalid_request", details: parsed.error.format() });
        return;
      }
      const projectId = String(req.params.projectId);
      const storyboard = await svc.getStoryboard(pool, String(req.params.id));
      if (
        !storyboard ||
        storyboard.projectId !== projectId ||
        !storyboard.frameId
      ) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (
        parsed.data.context.scene.id &&
        storyboard.sceneId &&
        parsed.data.context.scene.id !== storyboard.sceneId
      ) {
        res
          .status(400)
          .json({
            error: "context_mismatch",
            detail: "Manuskonteksten tilhører en annen scene.",
          });
        return;
      }
      if (
        parsed.data.context.shot.id &&
        parsed.data.context.shot.id !== storyboard.frameId
      ) {
        res
          .status(400)
          .json({
            error: "context_mismatch",
            detail: "Manuskonteksten tilhører et annet shot.",
          });
        return;
      }
      const hydratedContext = await hydrateStoryboardProductionContext(pool, {
        projectId,
        sceneId: storyboard.sceneId || parsed.data.context.scene.id,
        context: parsed.data.context,
      });
      const context = enrichStoryboardContextWithStrokes(
        hydratedContext,
        storyboard.strokes ?? [],
        storyboard.width,
        storyboard.height,
      );
      const compilation = compileStoryboardPrompt({
        kind: parsed.data.kind,
        modelId: parsed.data.model,
        userAction: parsed.data.userAction,
        context,
      });
      res.json({ success: true, data: compilation });
    },
  );

  // ── Production-aware AI image generation ────────────────────────
  // Standard = inexpensive GPT Image Mini draft. HD = GPT Image 2.
  // If approved library references apply to the scene, they are physically
  // attached through /v1/images/edits. Draft/rejected references never leave
  // The Role Room and arbitrary URLs are never fetched.
  router.post(
    "/projects/:projectId/storyboards/:id/generate-ai-image",
    auth,
    canManage,
    async (req, res) => {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(503).json({
          error: "image_gen_disabled",
          detail:
            "OPENAI_API_KEY ikke satt på server. Legg til den i Render env-vars.",
        });
        return;
      }

      const projectId = String(req.params.projectId);
      const storyboard = await svc.getStoryboard(pool, String(req.params.id));
      if (!storyboard || storyboard.projectId !== projectId) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const parsed = storyboardImageGenerationBodySchema.safeParse(
        req.body ?? {},
      );
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "invalid_request", details: parsed.error.format() });
        return;
      }
      if (parsed.data.context
          && ((parsed.data.context.scene.id && storyboard.sceneId
              && parsed.data.context.scene.id !== storyboard.sceneId)
            || (parsed.data.context.shot.id && storyboard.frameId
              && parsed.data.context.shot.id !== storyboard.frameId))) {
        res.status(400).json({ error: "context_mismatch" });
        return;
      }

      const providerAccess = await getStoryboardVideoConfig(pool, {
        projectId,
        userEmail: (req as AuthedRequest).userEmail,
        userRole: (req as AuthedRequest).userRole,
      });
      if (!providerAccess.allowed) {
        res.status(403).json({ error: "ai_not_allowed", detail: "AI er ikke aktivert for kontoen." });
        return;
      }
      if (!providerAccess.consent.consented) {
        res.status(409).json({
          error: "consent_required",
          detail: "Prosjektet må samtykke før produksjonskontekst sendes til en AI-leverandør.",
        });
        return;
      }

      let costReservation: Awaited<ReturnType<typeof reserveStoryboardImageCost>> | null = null;
      try {
        const selectedModel = parsed.data.model
          ?? (parsed.data.quality === "hd" ? "gpt-image-2" : "gpt-image-1-mini");
        costReservation = await reserveStoryboardImageCost(pool, {
          projectId,
          storyboardId: storyboard.id,
          userId: (req as AuthedRequest).userId,
          model: selectedModel,
          quality: parsed.data.quality,
        });
        const generated = await generateStoryboardImage({
          pool,
          storyboard,
          projectId,
          userId: (req as AuthedRequest).userId,
          body: parsed.data,
          apiKey,
          fetchImpl: deps.fetchImpl,
        });
        await completeStoryboardImageCost(pool, costReservation.id);
        const updated = await svc.updateStoryboard(pool, storyboard.id, {
          imageData: generated.imageData,
          width: generated.width,
          height: generated.height,
          workflowLevel: "ai-reference",
          metadata: {
            ...(storyboard.metadata ?? {}),
            aiImage: generated.metadata,
          },
        });
        if (!updated) {
          res.status(500).json({ error: "save_failed" });
          return;
        }
        res.json({
          success: true,
          data: updated,
          composedPrompt: generated.compiledPrompt,
          revisedPrompt: generated.revisedPrompt,
          model: generated.model,
          referenceCount: generated.referenceCount,
          referenceAssetIds: generated.referenceAssetIds,
          estimatedCostUsd: costReservation.estimatedCostUsd,
        });
      } catch (error) {
        if (costReservation) {
          await failStoryboardImageCost(
            pool,
            costReservation.id,
            error instanceof Error ? error.message : "image_generation_failed",
          );
        }
        if (error instanceof StoryboardAICostError) {
          res.status(error.status).json({ error: error.code, detail: error.safeDetail });
          return;
        }
        if (error instanceof StoryboardImageGenerationError) {
          res.status(error.status).json({
            error: error.code,
            detail: error.safeDetail,
          });
          return;
        }
        res
          .status(500)
          .json({ error: "image_generation_failed", detail: "internal_error" });
      }
    },
  );

  return router;
}
