/**
 * role-room-carousel-ai-image.ts
 *
 * AI image generation for carousel slides via Replicate (SDXL).
 *
 * - Input: slide imagePrompt + brand colour palette + aspect-ratio hint
 * - Output: ImageRef (strategy='ai') with the generated R2 URL + cost
 *
 * Cost notes:
 *   SDXL on Replicate is ~$0.0035 per 1024×1024 image. We retail at 3 NOK
 *   (Stripe Meter `carousel.ai_image`, deferred to post-beta per Daniel).
 *
 * Slice 5 ships generation only — Stripe meter wiring lands in Slice 6
 * alongside the publish-pipeline.
 */

import { createHash } from "node:crypto";
import type { Pool } from "pg";

export interface ReplicateClient {
  run(model: string, input: Record<string, unknown>): Promise<string[]>;
}

export interface R2Uploader {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
}

export interface AiGenerationContext {
  replicate: ReplicateClient;
  r2: R2Uploader;
  pool: Pool;
  /** Replicate model slug; default SDXL 1.0 */
  model?: string;
}

export interface GenerateAiImageInput {
  userId: string;
  slideId?: string; // when known we cache by slide
  prompt: string;
  brandColors: { primary: string; secondary: string; accent: string };
  aspectRatio: "1:1" | "4:5" | "1.91:1" | "2:3";
  /** When true the prompt is wrapped with brand-aware decorators. */
  enrichWithBrand?: boolean;
}

export interface AiImageResult {
  generatedUrl: string;
  prompt: string;
  finalPrompt: string;
  cost: number;
  model: string;
  cached: boolean;
}

const DEFAULT_MODEL = "stability-ai/sdxl";
const MODEL_COST_USD = 0.0035;

function hashCacheKey(input: GenerateAiImageInput, model: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        prompt: input.prompt,
        colors: input.brandColors,
        aspectRatio: input.aspectRatio,
        enrich: input.enrichWithBrand !== false,
        model,
      }),
    )
    .digest("hex");
}

function aspectToWidthHeight(aspect: GenerateAiImageInput["aspectRatio"]): {
  width: number;
  height: number;
} {
  // SDXL prefers ~1024×1024 — pick the closest square-ish pair.
  switch (aspect) {
    case "1:1":
      return { width: 1024, height: 1024 };
    case "4:5":
      return { width: 832, height: 1024 };
    case "2:3":
      return { width: 768, height: 1152 };
    case "1.91:1":
      return { width: 1280, height: 720 };
  }
}

/**
 * Wraps the strategist's free-form prompt with brand-aware decorators
 * so the resulting image carries the brand's mood.
 */
export function buildFinalPrompt(input: GenerateAiImageInput): string {
  const base = input.prompt.trim();
  if (input.enrichWithBrand === false) return base;
  const palette = `${input.brandColors.primary}, ${input.brandColors.accent}`;
  return [
    base,
    `colour palette: ${palette}`,
    "cinematic lighting",
    "editorial photography",
    "high detail, 35mm",
    "shallow depth of field",
  ].join(", ");
}

/**
 * Look up an existing AI generation in the cache table to avoid
 * paying twice for identical prompts.
 */
async function lookupCached(
  pool: Pool,
  cacheKey: string,
): Promise<{ url: string; model: string; cost: number } | null> {
  try {
    const result = await pool.query<{
      generated_url: string;
      model: string;
      cost: string;
    }>(
      `SELECT generated_url, model, cost
         FROM carousel_ai_image_cache
        WHERE cache_key = $1
          AND generated_at > now() - INTERVAL '30 days'
        LIMIT 1`,
      [cacheKey],
    );
    if (!result.rowCount) return null;
    return {
      url: result.rows[0].generated_url,
      model: result.rows[0].model,
      cost: Number(result.rows[0].cost),
    };
  } catch {
    // Cache table may not be migrated yet — non-fatal.
    return null;
  }
}

async function persistCache(
  pool: Pool,
  cacheKey: string,
  generatedUrl: string,
  model: string,
  cost: number,
  prompt: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO carousel_ai_image_cache
         (cache_key, generated_url, model, cost, prompt)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (cache_key) DO NOTHING`,
      [cacheKey, generatedUrl, model, cost, prompt],
    );
  } catch {
    // Tolerate missing cache table — not critical to the user request.
  }
}

export async function generateAiImage(
  ctx: AiGenerationContext,
  input: GenerateAiImageInput,
): Promise<AiImageResult> {
  const model = ctx.model ?? DEFAULT_MODEL;
  const finalPrompt = buildFinalPrompt(input);
  const cacheKey = hashCacheKey(input, model);

  const cached = await lookupCached(ctx.pool, cacheKey);
  if (cached) {
    return {
      generatedUrl: cached.url,
      prompt: input.prompt,
      finalPrompt,
      cost: 0,
      model: cached.model,
      cached: true,
    };
  }

  const { width, height } = aspectToWidthHeight(input.aspectRatio);

  const outputs = await ctx.replicate.run(model, {
    prompt: finalPrompt,
    width,
    height,
    num_outputs: 1,
    guidance_scale: 7.5,
    num_inference_steps: 30,
    negative_prompt:
      "blurry, low quality, watermark, text, logo, cropped, distorted, ugly",
  });
  if (!outputs || outputs.length === 0) {
    throw new Error("Replicate returned no output");
  }
  const generatedUrl = outputs[0];

  // Mirror to R2 so the URL stays stable even if Replicate's CDN expires
  let mirroredUrl = generatedUrl;
  try {
    const fetchRes = await fetch(generatedUrl);
    if (fetchRes.ok) {
      const buffer = Buffer.from(await fetchRes.arrayBuffer());
      const r2Key = `carousel/ai/${cacheKey}.png`;
      mirroredUrl = await ctx.r2.upload(r2Key, buffer, "image/png");
    }
  } catch {
    // Fall back to the upstream URL — not fatal.
  }

  await persistCache(ctx.pool, cacheKey, mirroredUrl, model, MODEL_COST_USD, finalPrompt);

  return {
    generatedUrl: mirroredUrl,
    prompt: input.prompt,
    finalPrompt,
    cost: MODEL_COST_USD,
    model,
    cached: false,
  };
}

// ─────────────────────────────────────────────────────────
// Default Replicate client (token from env)
// ─────────────────────────────────────────────────────────

export function makeReplicateClient(): ReplicateClient {
  return {
    async run(modelSlug, input) {
      const token = process.env.REPLICATE_API_TOKEN;
      if (!token) {
        throw new Error(
          "REPLICATE_API_TOKEN not set — AI image generation unavailable",
        );
      }
      const versionRes = await fetch(
        `https://api.replicate.com/v1/models/${modelSlug}/versions`,
        { headers: { Authorization: `Token ${token}` } },
      );
      if (!versionRes.ok) {
        throw new Error(`Replicate version lookup failed (${versionRes.status})`);
      }
      const versionJson = (await versionRes.json()) as {
        results: Array<{ id: string }>;
      };
      const version = versionJson.results?.[0]?.id;
      if (!version) throw new Error("No published versions for model");

      const predictionRes = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ version, input }),
      });
      const predictionJson = (await predictionRes.json()) as {
        urls?: { get: string };
        id?: string;
      };
      if (!predictionJson.urls?.get) {
        throw new Error("Replicate did not return a prediction URL");
      }

      // Poll
      const maxPolls = 60; // ~60s
      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const pollRes = await fetch(predictionJson.urls.get, {
          headers: { Authorization: `Token ${token}` },
        });
        const pollJson = (await pollRes.json()) as {
          status: string;
          output?: string[] | string;
          error?: string;
        };
        if (pollJson.status === "succeeded") {
          if (Array.isArray(pollJson.output)) return pollJson.output;
          if (typeof pollJson.output === "string") return [pollJson.output];
          return [];
        }
        if (pollJson.status === "failed" || pollJson.status === "canceled") {
          throw new Error(`Replicate prediction ${pollJson.status}: ${pollJson.error}`);
        }
      }
      throw new Error("Replicate prediction timed out");
    },
  };
}
