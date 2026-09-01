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
  StoryboardImageGenerationError,
  StoryboardImageProviderOutcomeUnknownError,
  storyboardImageGenerationBodySchema,
} from "./storyboard-ai-image-service.js";
import {
  approveStoryboardAIImageVersion,
  claimStoryboardAIImageOperation,
  failStoryboardAIImageOperation,
  generateStoryboardAIImageStage,
  listStoryboardAIImageVersions,
  requireStoryboardForStage,
  StoryboardAIImageStageError,
  lockAndValidateStoryboardCompatSource,
  markStoryboardAIImageOperationProcessing,
  preflightStoryboardAIImageStage,
  storyboardSourceRevision,
  validateStoryboardCompatMirror,
} from "./storyboard-ai-image-stage-service.js";
import { validateStoryboardAIFramingIntegrity } from "./storyboard-ai-framing-integrity.js";
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
import { storyboardPaintoverCompositeSchema } from "./storyboard-paintover-composite.js";

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
  expectedSourceRevision: z.number().int().nonnegative().optional(),
  expectedCompatFrameUpdatedAt: z.string().trim().min(1).max(80).optional(),
  expectedFramingFingerprint: z.string().trim().min(8).max(512).optional(),
});

const promptCompileBody = z.object({
  kind: z.enum([
    "storyboard-image", "storyboard-color", "storyboard-atmosphere",
    "storyboard-video",
  ]),
  model: z.string().trim().min(1).max(80),
  userAction: z.string().trim().max(1_200).optional(),
  context: storyboardShotContextSchema,
});

const storyboardVideoBaseBody = z.object({
  context: storyboardShotContextSchema,
  sourceStage: z.enum(["color", "atmosphere"]),
  baseVersionId: z.string().uuid(),
  paintoverComposite: storyboardPaintoverCompositeSchema.optional(),
  model: z.enum(["seedance-2-i2v", "higgsfield-dop-i2v"]).default("seedance-2-i2v"),
  duration: z.number().min(4).max(15).default(5),
  userAction: z.string().trim().max(1_200).optional(),
}).strict();

const storyboardVideoBody = storyboardVideoBaseBody.extend({
  confirmedPreflight: z.object({
    compilationFingerprint: z.string().trim().min(8).max(128),
    sourceFingerprint: z.string().trim().min(8).max(128),
    bindingFingerprint: z.string().trim().regex(
      /^sha256:[a-f0-9]{64}$/,
    ),
    duration: z.number().int().min(4).max(15),
    maxEstimatedCostUsd: z.number().nonnegative().max(100),
  }).strict(),
}).strict();

const storyboardVideoPreflightBody = storyboardVideoBaseBody;

const storyboardImageVersionApprovalBody = z.object({
  expectedFramingFingerprint: z.string().trim().min(8).max(512),
}).strict();

export interface CreateStoryboardRouterDeps {
  activeSessions?: Map<string, SessionData>;
  /** Injectable provider transport for contract tests. */
  fetchImpl?: typeof fetch;
  videoPreflightRateMaxRequests?: number;
  videoPreflightRateWindowMs?: number;
  now?: () => number;
}

export function createStoryboardRouter(
  pool: Pool,
  deps: CreateStoryboardRouterDeps = {},
): ExpressRouter {
  const router = Router();
  const auth = requireAuth(pool, deps.activeSessions);
  const canView = requireStoryboardAccess(pool, "view");
  const canManage = requireStoryboardAccess(pool, "manage");
  const videoPreflightBuckets = new Map<
    string,
    { count: number; resetAt: number }
  >();
  const videoPreflightRateMax = Math.min(
    300,
    Math.max(1, Math.floor(deps.videoPreflightRateMaxRequests ?? 30)),
  );
  const videoPreflightRateWindowMs = Math.min(
    60 * 60_000,
    Math.max(1_000, Math.floor(deps.videoPreflightRateWindowMs ?? 60_000)),
  );
  const rateLimitVideoPreflight = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const now = (deps.now ?? Date.now)();
    const key = `${(req as AuthedRequest).userId}:${String(req.params.projectId)}`;
    let bucket = videoPreflightBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (!bucket && videoPreflightBuckets.size >= 2_048) {
        for (const [candidateKey, candidate] of videoPreflightBuckets) {
          if (candidate.resetAt <= now) videoPreflightBuckets.delete(candidateKey);
        }
        if (videoPreflightBuckets.size >= 2_048) {
          const oldest = videoPreflightBuckets.keys().next().value as
            string | undefined;
          if (oldest) videoPreflightBuckets.delete(oldest);
        }
      }
      bucket = { count: 0, resetAt: now + videoPreflightRateWindowMs };
      videoPreflightBuckets.set(key, bucket);
    }
    if (bucket.count >= videoPreflightRateMax) {
      res.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000))),
      );
      res.status(429).json({ error: "animation_preflight_rate_limited" });
      return;
    }
    bucket.count += 1;
    next();
  };

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
      const {
        expectedSourceRevision,
        expectedCompatFrameUpdatedAt,
        expectedFramingFingerprint,
        ...storyboardPatch
      } = parsed.data;
      const projectId = String(req.params.projectId);
      if (storyboardPatch.workflowLevel === "ai-pipeline-pencil-source") {
        if (!storyboardPatch.sceneId || !storyboardPatch.frameId
            || expectedCompatFrameUpdatedAt == null
            || !expectedFramingFingerprint) {
          res.status(409).json({
            error: "source_snapshot_required",
            detail: "Lagre og synk det eksakte Pencil-shotet før AI Color.",
          });
          return;
        }
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `SELECT id FROM casting_storyboards
              WHERE project_id=$1 AND frame_id=$2
              FOR UPDATE`,
            [projectId, storyboardPatch.frameId],
          );
          const existingBeforeSourceLock = await svc.getStoryboardByFrameId(
            client as unknown as Pool,
            projectId,
            storyboardPatch.frameId,
          );
          if (existingBeforeSourceLock && (expectedSourceRevision == null
              || storyboardSourceRevision(existingBeforeSourceLock.metadata)
                !== expectedSourceRevision)) {
            throw new StoryboardAIImageStageError(
              409,
              expectedSourceRevision == null
                ? "source_snapshot_required" : "source_snapshot_stale",
              "Pencil-panelet ble endret før opplastingen. Synk og prøv igjen.",
            );
          }
          const sourceStoryboard: svc.Storyboard = existingBeforeSourceLock ?? {
            id: "pending-storyboard",
            projectId,
            sceneId: storyboardPatch.sceneId,
            frameId: storyboardPatch.frameId,
            title: storyboardPatch.title ?? null,
            strokes: storyboardPatch.strokes ?? [],
            imageData: null,
            width: storyboardPatch.width ?? null,
            height: storyboardPatch.height ?? null,
            workflowLevel: null,
            metadata: {},
            createdBy: userId,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          };
          const source = await lockAndValidateStoryboardCompatSource(client, {
            storyboard: sourceStoryboard,
            expectedSourceUpdatedAt: expectedCompatFrameUpdatedAt,
            expectedFramingFingerprint,
          });
          const existingAfterSourceLock = await svc.getStoryboardByFrameId(
            client as unknown as Pool,
            projectId,
            storyboardPatch.frameId,
          );
          if (!existingBeforeSourceLock && existingAfterSourceLock) {
            throw new StoryboardAIImageStageError(
              409,
              "source_snapshot_stale",
              "Et annet Pencil-snapshot ble lagret først. Synk og prøv igjen.",
            );
          }
          if (existingAfterSourceLock && (expectedSourceRevision == null
              || storyboardSourceRevision(existingAfterSourceLock.metadata)
                !== expectedSourceRevision)) {
            throw new StoryboardAIImageStageError(
              409,
              "source_snapshot_stale",
              "Pencil-panelet ble endret før opplastingen. Synk og prøv igjen.",
            );
          }
          const sb = await svc.upsertStoryboard(
            client as unknown as Pool,
            {
              projectId,
              ...storyboardPatch,
              metadata: {
                ...(storyboardPatch.metadata ?? {}),
                currentFramingFingerprint: expectedFramingFingerprint,
                compatFrameUpdatedAt: source.frameUpdatedAt,
                compatSourceUpdatedAt: source.sourceUpdatedAt,
              },
              createdBy: userId,
            },
          );
          await client.query("COMMIT");
          res.status(201).json({ success: true, data: sb });
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          if (error instanceof StoryboardAIImageStageError) {
            res.status(error.status).json({
              error: error.code,
              detail: error.safeDetail,
            });
          } else {
            res.status(500).json({ error: "upsert_failed", detail: "internal_error" });
          }
        } finally {
          client.release();
        }
        return;
      }
      try {
        const sb = await svc.upsertStoryboard(pool, {
          projectId,
          ...storyboardPatch,
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
    rateLimitVideoPreflight,
    async (req, res) => {
      const parsed = storyboardVideoPreflightBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_request", details: parsed.error.format() });
        return;
      }
      const projectId = String(req.params.projectId);
      let storyboard = await svc.getStoryboard(pool, String(req.params.id));
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
        storyboard = (await validateStoryboardCompatMirror(pool, {
          storyboard,
          shotFraming: parsed.data.context.shot.shotFraming,
        })).storyboard;
      } catch (error) {
        if (error instanceof StoryboardAIImageStageError) {
          res.status(error.status).json({ error: error.code, detail: error.safeDetail });
          return;
        }
        res.status(500).json({ error: "animation_preflight_failed", detail: "internal_error" });
        return;
      }
      const framingIntegrity = validateStoryboardAIFramingIntegrity(
        storyboard,
        parsed.data.context.shot.shotFraming,
      );
      if (!framingIntegrity.valid) {
        res.status(409).json({
          error: framingIntegrity.code,
          detail: framingIntegrity.detail,
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
        const preflightSnapshot = await validateStoryboardCompatMirror(pool, {
          storyboard,
          shotFraming: parsed.data.context.shot.shotFraming,
        });
        storyboard = preflightSnapshot.storyboard;
        const checked = await preflightStoryboardVideo(pool, {
          projectId, storyboard,
          userId: (req as AuthedRequest).userId,
          userEmail: (req as AuthedRequest).userEmail,
          userRole: (req as AuthedRequest).userRole,
          modelId: parsed.data.model, duration: parsed.data.duration,
          compiledPrompt: compilation.compiledPrompt,
          sourceStage: parsed.data.sourceStage,
          baseVersionId: parsed.data.baseVersionId,
          paintoverComposite: parsed.data.paintoverComposite,
          shotFraming: parsed.data.context.shot.shotFraming,
          expectedCompatSourceUpdatedAt:
            preflightSnapshot.compatSource.sourceUpdatedAt,
          expectedFramingFingerprint:
            preflightSnapshot.framingFingerprint,
        });
        res.json({
          success: true,
          data: {
            model: checked.model, provider: checked.provider, duration: checked.duration,
            estimatedCostUsd: checked.estimatedCostUsd,
            providerCredits: checked.providerCredits,
            sourceFingerprint: checked.sourceFingerprint,
            compilationFingerprint: compilation.compilationFingerprint,
            bindingFingerprint: checked.bindingFingerprint,
          },
          compilation,
        });
      } catch (error) {
        if (error instanceof StoryboardVideoError
            || error instanceof StoryboardAIImageStageError) {
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
      let storyboard = await svc.getStoryboard(pool, String(req.params.id));
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
        storyboard = (await validateStoryboardCompatMirror(pool, {
          storyboard,
          shotFraming: parsed.data.context.shot.shotFraming,
        })).storyboard;
      } catch (error) {
        if (error instanceof StoryboardAIImageStageError) {
          res.status(error.status).json({ error: error.code, detail: error.safeDetail });
          return;
        }
        res.status(500).json({ error: "animation_failed", detail: "internal_error" });
        return;
      }
      const framingIntegrity = validateStoryboardAIFramingIntegrity(
        storyboard,
        parsed.data.context.shot.shotFraming,
      );
      if (!framingIntegrity.valid) {
        res.status(409).json({
          error: framingIntegrity.code,
          detail: framingIntegrity.detail,
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
        const submitSnapshot = await validateStoryboardCompatMirror(pool, {
          storyboard,
          shotFraming: parsed.data.context.shot.shotFraming,
        });
        storyboard = submitSnapshot.storyboard;
        const submitted = await submitStoryboardVideo(pool, {
          projectId, storyboard,
          userId: (req as AuthedRequest).userId,
          userEmail: (req as AuthedRequest).userEmail,
          userRole: (req as AuthedRequest).userRole,
          modelId: parsed.data.model, duration: parsed.data.duration,
          compiledPrompt: compilation.compiledPrompt,
          compilationFingerprint: compilation.compilationFingerprint,
          confirmedPreflight: parsed.data.confirmedPreflight,
          expectedCompatSourceUpdatedAt:
            submitSnapshot.compatSource.sourceUpdatedAt,
          expectedFramingFingerprint: submitSnapshot.framingFingerprint,
          sourceStage: parsed.data.sourceStage,
          baseVersionId: parsed.data.baseVersionId,
          paintoverComposite: parsed.data.paintoverComposite,
          shotFraming: parsed.data.context.shot.shotFraming,
        });
        res.status(202).json({ success: true, data: submitted, compilation });
      } catch (error) {
        if (error instanceof StoryboardVideoError
            || error instanceof StoryboardAIImageStageError) {
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
  // Pencil -> AI Color -> AI Atmosphere is an immutable, approval-gated
  // pipeline. Generated candidates never overwrite the hand drawing. Only a
  // version explicitly approved by the artist becomes the animation source.
  router.get(
    "/projects/:projectId/storyboards/:id/image-stages",
    auth,
    canView,
    async (req, res) => {
      try {
        const projectId = String(req.params.projectId);
        const storyboard = await requireStoryboardForStage(
          pool, projectId, String(req.params.id),
        );
        const versionList = await listStoryboardAIImageVersions(pool, {
          projectId, storyboardId: storyboard.id,
        });
        res.json({
          success: true,
          currentSourceRevision: versionList.currentSourceRevision,
          compatFrameUpdatedAt: versionList.compatFrameUpdatedAt,
          sourceUpdatedAt: versionList.sourceUpdatedAt,
          data: versionList.versions,
        });
      } catch (error) {
        if (error instanceof StoryboardAIImageStageError) {
          res.status(error.status).json({ error: error.code, detail: error.safeDetail });
          return;
        }
        res.status(500).json({ error: "image_stage_list_failed", detail: "internal_error" });
      }
    },
  );

  router.post(
    "/projects/:projectId/storyboards/:id/image-stages/:stage/generate",
    auth,
    canManage,
    async (req, res) => {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(503).json({
          error: "image_gen_disabled",
          detail: "OPENAI_API_KEY ikke satt på server. Legg til den i Render env-vars.",
        });
        return;
      }
      const stage = String(req.params.stage);
      if (stage !== "color" && stage !== "atmosphere") {
        res.status(400).json({ error: "invalid_stage" });
        return;
      }
      const parsed = storyboardImageGenerationBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_request", details: parsed.error.format() });
        return;
      }
      const projectId = String(req.params.projectId);
      let costReservation: Awaited<ReturnType<typeof reserveStoryboardImageCost>> | null = null;
      let operationId: string | null = null;
      let providerResultPersisted = false;
      try {
        const headerIdempotencyKey = typeof req.headers["idempotency-key"] === "string"
          ? req.headers["idempotency-key"].trim() : "";
        const idempotencyKey = parsed.data.idempotencyKey?.trim()
          || headerIdempotencyKey;
        if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
          res.status(400).json({
            error: "idempotency_key_required",
            detail: "Send en stabil idempotencyKey for denne genereringshandlingen.",
          });
          return;
        }
        const storyboard = await requireStoryboardForStage(
          pool, projectId, String(req.params.id),
        );
        if (parsed.data.context
            && ((parsed.data.context.scene.id && storyboard.sceneId
                && parsed.data.context.scene.id !== storyboard.sceneId)
              || (parsed.data.context.shot.id && storyboard.frameId
                && parsed.data.context.shot.id !== storyboard.frameId))) {
          res.status(400).json({ error: "context_mismatch" });
          return;
        }
        // Fail before reservation/provider IO unless the client is generating
        // from the exact acknowledged Pencil/camera snapshot.
        const generationPreflight = await preflightStoryboardAIImageStage(pool, {
          storyboard,
          projectId,
          userId: (req as AuthedRequest).userId,
          stage,
          body: parsed.data,
        });
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
        const operation = await claimStoryboardAIImageOperation(pool, {
          projectId,
          storyboardId: storyboard.id,
          stage,
          idempotencyKey,
          operationFingerprint: generationPreflight.operationFingerprint,
        });
        operationId = operation.operationId;
        if (operation.state === "completed") {
          providerResultPersisted = true;
          if (operation.reservationId) {
            await completeStoryboardImageCost(pool, operation.reservationId);
          }
          res.json(operation.response);
          return;
        }
        if (operation.state === "in_flight") {
          res.status(202).json({
            success: true,
            data: {
              operationId,
              status: "processing",
              deduplicated: true,
            },
          });
          return;
        }
        // Repeat every free source/composite check immediately before the
        // credit reservation. The first preflight can race a collaborator
        // while consent and idempotency are resolved.
        const reservationPreflight = await preflightStoryboardAIImageStage(pool, {
          storyboard,
          projectId,
          userId: (req as AuthedRequest).userId,
          stage,
          body: parsed.data,
        });
        if (reservationPreflight.operationFingerprint
            !== generationPreflight.operationFingerprint) {
          throw new StoryboardAIImageStageError(
            409, "source_snapshot_stale",
            "Panelet eller paintover-laget ble endret før kostnaden ble reservert.",
          );
        }
        costReservation = await reserveStoryboardImageCost(pool, {
          projectId, storyboardId: storyboard.id,
          userId: (req as AuthedRequest).userId,
          model: "gpt-image-2", quality: "hd", operationId,
        });
        await markStoryboardAIImageOperationProcessing(
          pool, operationId, costReservation.id,
        );
        const result = await generateStoryboardAIImageStage(pool, {
          storyboard, projectId, userId: (req as AuthedRequest).userId,
          stage, body: parsed.data, apiKey,
          expectedOperationFingerprint: generationPreflight.operationFingerprint,
          operation: {
            id: operationId,
            reservationId: costReservation.id,
            estimatedCostUsd: costReservation.estimatedCostUsd,
          },
          fetchImpl: deps.fetchImpl,
        });
        providerResultPersisted = true;
        await completeStoryboardImageCost(pool, costReservation.id);
        const response = result.operationResponse ?? {
          success: true,
          data: result.version,
          operationId,
        };
        res.json(response);
      } catch (error) {
        const billingReservationPending = error instanceof StoryboardAICostError
          && error.code === "billing_reservation_pending";
        const providerOutcomeUnknown =
          error instanceof StoryboardImageProviderOutcomeUnknownError;
        if (costReservation && !providerResultPersisted
            && !billingReservationPending && !providerOutcomeUnknown) {
          await failStoryboardImageCost(
            pool, costReservation.id,
            error instanceof Error ? error.message : "image_stage_generation_failed",
          );
        }
        if (operationId && !providerResultPersisted
            && !billingReservationPending && !providerOutcomeUnknown) {
          await failStoryboardAIImageOperation(
            pool,
            operationId,
            error instanceof Error ? error.message : "image_stage_generation_failed",
          );
        }
        if (error instanceof StoryboardAICostError
            || error instanceof StoryboardImageGenerationError
            || error instanceof StoryboardAIImageStageError) {
          res.status(error.status).json({ error: error.code, detail: error.safeDetail });
          return;
        }
        res.status(500).json({ error: "image_stage_generation_failed", detail: "internal_error" });
      }
    },
  );

  router.post(
    "/projects/:projectId/storyboards/:id/image-stages/versions/:versionId/approve",
    auth,
    canManage,
    async (req, res) => {
      const parsedApproval = storyboardImageVersionApprovalBody.safeParse(req.body ?? {});
      if (!parsedApproval.success) {
        res.status(400).json({ error: "invalid_request" });
        return;
      }
      try {
        const projectId = String(req.params.projectId);
        const storyboard = await requireStoryboardForStage(
          pool, projectId, String(req.params.id),
        );
        const version = await approveStoryboardAIImageVersion(pool, {
          projectId, storyboardId: storyboard.id,
          versionId: String(req.params.versionId),
          userId: (req as AuthedRequest).userId,
          expectedFramingFingerprint:
            parsedApproval.data.expectedFramingFingerprint,
        });
        res.json({ success: true, data: version });
      } catch (error) {
        if (error instanceof StoryboardAIImageStageError) {
          res.status(error.status).json({ error: error.code, detail: error.safeDetail });
          return;
        }
        res.status(500).json({ error: "image_stage_approval_failed", detail: "internal_error" });
      }
    },
  );

  // Standard = inexpensive GPT Image Mini draft. HD = GPT Image 2.
  // If approved library references apply to the scene, they are physically
  // attached through /v1/images/edits. Draft/rejected references never leave
  // The Role Room and arbitrary URLs are never fetched.
  router.post(
    "/projects/:projectId/storyboards/:id/generate-ai-image",
    auth,
    canManage,
    async (req, res) => {
      // Legacy endpoint adopted provider output directly into the Pencil row
      // without source CAS and replaced source-canvas dimensions. Require the
      // immutable, approval-gated staged pipeline instead.
      res.status(409).json({
        error: "staged_image_pipeline_required",
        detail: "Bruk Pencil → AI Color → AI Atmosphere med eksplisitt godkjenning.",
      });
    },
  );

  return router;
}
