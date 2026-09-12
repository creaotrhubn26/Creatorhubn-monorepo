/**
 * storyboard-ai-routes.ts — mountes under /api/storyboards.
 *
 * Hjelpe-endepunkter for `storyboardAIGenerationService` (frontend) brukt i
 * CastingShotListPanel sin «Legg til shot»-dialog:
 *   GET  /api/storyboards/templates          — stil-maler (statiske)
 *   GET  /api/storyboards/camera-angles       — kameravinkler (statiske)
 *   GET  /api/storyboards/camera-movements    — kamerabevegelser (statiske)
 *   POST /api/storyboards/generate-frame      — DALL·E-3 referansebilde
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
  wide: "Totalbilde",
  medium: "Halvtotalt",
  "close-up": "Nærbilde",
  "over-shoulder": "Over skulder",
};

export const STORYBOARD_CAMERA_MOVEMENTS: Record<string, string> = {
  static: "Statisk",
  pan: "Panorering",
  tracking: "Tracking",
};

// DALL·E-3 støtter kun disse størrelsene. Frontend defaulter til '1536x1024'
// (en gpt-image-1-størrelse) → map til nærmeste gyldige landskaps-format.
const DALLE_SIZES = new Set(["1024x1024", "1792x1024", "1024x1792"]);
export function normalizeDalleSize(size: string | undefined): "1024x1024" | "1792x1024" | "1024x1792" {
  if (size && DALLE_SIZES.has(size)) return size as "1024x1024" | "1792x1024" | "1024x1792";
  // 1536x1024 (landskap) / ukjent → 1792x1024; portrett-hint → 1024x1792.
  if (size && /^(\d+)x(\d+)$/.test(size)) {
    const [w, h] = size.split("x").map((n) => parseInt(n, 10));
    if (h > w) return "1024x1792";
  }
  return "1792x1024";
}

const TEMPLATE_STYLE: Record<string, string> = {
  cinematic: "cinematic film look, dramatic lighting, shallow depth of field",
  documentary: "natural documentary style, available light, realistic",
  commercial: "polished commercial look, clean, bright, high production value",
  drama: "warm intimate TV-drama tones, soft key light",
};

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

/** Komponer en storyboard-referanse-prompt fra shot-dialogens felt. */
export function composeFramePrompt(body: GenerateFrameBody): string {
  const templateStyle = body.template && TEMPLATE_STYLE[body.template] ? TEMPLATE_STYLE[body.template] : TEMPLATE_STYLE.cinematic;
  const angleLabel = body.camera_angle ? STORYBOARD_CAMERA_ANGLES[body.camera_angle] ?? body.camera_angle : null;
  const moveLabel = body.camera_movement ? STORYBOARD_CAMERA_MOVEMENTS[body.camera_movement] ?? body.camera_movement : null;
  const parts: (string | null)[] = [
    "Cinematic storyboard reference frame",
    body.prompt ? body.prompt.trim() : null,
    angleLabel ? `Camera angle: ${angleLabel}` : null,
    moveLabel ? `Camera movement: ${moveLabel}` : null,
    body.additional_notes ? `Notes: ${body.additional_notes.trim()}` : null,
    `Style: ${templateStyle}`,
    "Black-and-white storyboard sketch, no text, no captions, no logos, focus on composition and lighting.",
  ];
  return parts.filter(Boolean).join(". ");
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

    const composedPrompt = composeFramePrompt(body);
    const size = normalizeDalleSize(body.size);

    let openaiResponse: Awaited<ReturnType<typeof fetch>> | undefined;
    try {
      openaiResponse = await fetchImpl("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "dall-e-3", prompt: composedPrompt, n: 1, size, quality: "standard", response_format: "b64_json" }),
      });
    } catch {
      res.status(502).json({ error: "openai_network", detail: "internal_error" });
      return;
    }
    if (!openaiResponse || !openaiResponse.ok) {
      const status = openaiResponse?.status ?? 0;
      const errText = openaiResponse ? await openaiResponse.text().catch(() => "") : "";
      // Send 402 videre uendret (frontend viser «kredittgrense nådd»).
      res.status(status === 402 ? 402 : 502).json({ error: "openai_failed", status, detail: errText.slice(0, 500) });
      return;
    }
    const data = (await openaiResponse.json()) as { data?: Array<{ b64_json?: string; revised_prompt?: string }> };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      res.status(502).json({ error: "openai_no_image", detail: "No b64_json in response." });
      return;
    }
    res.json({
      success: true,
      imageBase64: b64,
      prompt: composedPrompt,
      template: body.template ?? "cinematic",
      model: "dall-e-3",
    });
  });

  return router;
}
