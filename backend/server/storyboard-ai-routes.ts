/**
 * storyboard-ai-routes.ts — mountes under /api/storyboards.
 *
 * Hjelpe-endepunkter for `storyboardAIGenerationService` (frontend) brukt i
 * CastingShotListPanel sin «Legg til shot»-dialog:
 *   GET  /api/storyboards/templates          — stil-maler (statiske)
 *   GET  /api/storyboards/camera-angles       — kameravinkler (statiske)
 *   GET  /api/storyboards/camera-movements    — kamerabevegelser (statiske)
 *   POST /api/storyboards/generate-frame      — Prompt Engine + GPT Image 2
 *
 * NB: dette er SEPARAT fra `storyboard-routes.ts` (som eier den prosjekt-scopede
 * storyboard-CRUD-en under /api/role-room/projects/:id/storyboards). Her lager vi
 * kun et frittstående referansebilde til en shot — ingen storyboard-rad røres.
 *
 * De 3 GET-ene er offentlig statisk referansedata (samme som frontendens
 * fallback). `generate-frame` KREVER innlogging + koster OpenAI-kreditt, så den
 * er auth-gated (og prosjekt-tilgangssjekket når project_id følger med) for å
 * hindre at hvem som helst brenner kreditt.
 */

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from "express";
import type { Pool } from "pg";
import { loadPersistedAuthSession } from "./auth-session-store.js";
import { canAccessRoleRoomProject } from "./role-room-projects-routes.js";
import {
  contextFromLegacyStoryboardInput,
  STORYBOARD_IMAGE_MODEL,
} from './storyboard-ai-context.js';
import {
  compileStoryboardPrompt,
  validateGeneratedImageBase64,
  type CompiledStoryboardPrompt,
} from './storyboard-prompt-engine/index.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

// Statisk referansedata — speiler frontendens fallback i
// storyboardAIGenerationService slik at UI + server er samstemte.
export const STORYBOARD_TEMPLATES: Record<string, { id: string; name: string; description: string }> = {
  cinematic: { id: "cinematic", name: "Filmisk", description: "Dramatisk kinolook" },
  documentary: { id: "documentary", name: "Dokumentar", description: "Naturlig stil" },
  commercial: { id: "commercial", name: "Reklame", description: "Profesjonelt reklameutseende" },
  drama: { id: "drama", name: "Drama/TV-serie", description: "Varme toner, intimt" },
};

export const STORYBOARD_CAMERA_ANGLES: Record<string, string> = {
  "extreme-wide": "Ekstrem total",
  wide: "Totalbilde",
  medium: "Halvtotalt",
  "medium-close": "Halvnært",
  "close-up": "Nærbilde",
  "extreme-close-up": "Ekstremt nærbilde",
  "over-shoulder": "Over skulder",
  pov: "Point of view",
};

export const STORYBOARD_CAMERA_MOVEMENTS: Record<string, string> = {
  static: "Statisk",
  dolly: "Dolly",
  push: "Push",
  pull: "Pull",
  pan: "Panorering",
  tilt: "Tilt",
  truck: "Truck",
  crane: "Crane",
  handheld: "Håndholdt",
  steadicam: "Steadicam",
  orbit: "Orbit",
  tracking: "Tracking",
};

const STORYBOARD_IMAGE_SIZES = new Set(["1024x1024", "1536x1024", "1024x1536"]);
export function normalizeDalleSize(size: string | undefined): "1024x1024" | "1536x1024" | "1024x1536" {
  if (size && STORYBOARD_IMAGE_SIZES.has(size)) {
    return size as "1024x1024" | "1536x1024" | "1024x1536";
  }
  if (size && /^(\d+)x(\d+)$/.test(size)) {
    const [w, h] = size.split("x").map((n) => parseInt(n, 10));
    if (h > w) return "1024x1536";
  }
  return "1536x1024";
}

export interface GenerateFrameBody {
  prompt?: string;
  template?: string;
  camera_angle?: string;
  camera_movement?: string;
  additional_notes?: string;
  size?: string;
  frame_id?: string;
  storyboard_id?: string;
  project_id?: string;
}

/** Komponer via samme production-aware motor som den native iPad-flyten. */
export function compileFramePrompt(body: GenerateFrameBody): CompiledStoryboardPrompt {
  const styleProfileId = body.template && STORYBOARD_TEMPLATES[body.template]
    ? body.template : 'cinematic';
  const base = contextFromLegacyStoryboardInput({
    storyboardId: body.frame_id || body.storyboard_id,
    title: body.prompt,
    shotType: body.camera_angle,
    prompt: body.additional_notes || body.prompt,
    styleNote: styleProfileId,
  });
  const context = {
    ...base,
    project: {
      styleProfileId,
      creativeDirection: body.additional_notes || '',
    },
    shot: {
      ...base.shot,
      notes: body.additional_notes || '',
      shotType: body.camera_angle || '',
      movement: body.camera_movement || '',
    },
  };
  return compileStoryboardPrompt({
    kind: 'storyboard-image',
    modelId: STORYBOARD_IMAGE_MODEL,
    context,
    userAction: body.prompt,
  });
}

export function composeFramePrompt(body: GenerateFrameBody): string {
  return compileFramePrompt(body).compiledPrompt;
}

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

export interface CreateStoryboardAiRouterDeps {
  activeSessions?: Map<string, SessionData>;
  /** Injiserbar for test; default global fetch. */
  fetchImpl?: typeof fetch;
}

export function createStoryboardAiRouter(pool: Pool, deps: CreateStoryboardAiRouterDeps = {}): ExpressRouter {
  const router = Router();
  const fetchImpl = deps.fetchImpl ?? fetch;

  const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    const session = await resolveUser(pool, deps.activeSessions, bearer);
    if (!session?.userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    (req as Request & { userId: string }).userId = session.userId;
    next();
  };

  router.get("/templates", (_req, res) => res.json(STORYBOARD_TEMPLATES));
  router.get("/camera-angles", (_req, res) => res.json(STORYBOARD_CAMERA_ANGLES));
  router.get("/camera-movements", (_req, res) => res.json(STORYBOARD_CAMERA_MOVEMENTS));

  router.post("/generate-frame", requireAuth, async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "image_gen_disabled", detail: "OPENAI_API_KEY ikke satt på server." });
      return;
    }
    const body = (req.body ?? {}) as GenerateFrameBody;
    if (!body.prompt || !String(body.prompt).trim()) {
      res.status(400).json({ error: "prompt_required", detail: "prompt er påkrevd." });
      return;
    }
    // Prosjekt-tilgangssjekk når project_id følger med (hindrer kreditt-misbruk
    // på andres prosjekter). Uten project_id: kun innlogging kreves.
    const projectId = typeof body.project_id === "string" ? body.project_id.trim() : "";
    if (projectId) {
      const userId = (req as Request & { userId: string }).userId;
      if (!(await canAccessRoleRoomProject(pool, userId, projectId))) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
    }

    const promptEngine = compileFramePrompt(body);
    if (!promptEngine.validation.valid) {
      res.status(422).json({
        error: 'prompt_validation_failed',
        detail: 'Shotet mangler nødvendig produksjonskontekst.',
        validation: promptEngine.validation,
      });
      return;
    }
    const composedPrompt = promptEngine.compiledPrompt;
    const size = normalizeDalleSize(body.size);

    let openaiResponse: Awaited<ReturnType<typeof fetch>> | undefined;
    try {
      openaiResponse = await fetchImpl("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: STORYBOARD_IMAGE_MODEL, prompt: composedPrompt, n: 1, size, quality: "medium" }),
      });
    } catch {
      res.status(502).json({ error: "openai_network", detail: "internal_error" });
      return;
    }
    if (!openaiResponse || !openaiResponse.ok) {
      const status = openaiResponse?.status ?? 0;
      if (openaiResponse) await openaiResponse.text().catch(() => "");
      // Send 402 videre uendret (frontend viser «kredittgrense nådd»).
      res.status(status === 402 ? 402 : 502).json({
        error: "openai_failed", status, detail: 'Bildeleverandøren avviste forespørselen.',
      });
      return;
    }
    const data = (await openaiResponse.json()) as { data?: Array<{ b64_json?: string; revised_prompt?: string }> };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      res.status(502).json({ error: "openai_no_image", detail: "No b64_json in response." });
      return;
    }
    const generationValidation = validateGeneratedImageBase64(b64);
    if (!generationValidation.valid) {
      res.status(502).json({
        error: 'openai_invalid_image',
        detail: 'Bildeleverandøren returnerte en ugyldig bildepayload.',
        validation: generationValidation,
      });
      return;
    }
    res.json({
      success: true,
      imageBase64: b64,
      prompt: composedPrompt,
      template: body.template ?? "cinematic",
      model: STORYBOARD_IMAGE_MODEL,
      promptEngine,
      generationValidation,
    });
  });

  return router;
}
