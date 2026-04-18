import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { captureAssets, captureSessions } from '../migrations/capture-schema.js';

type Db = NodePgDatabase<Record<string, unknown>>;

// Matches the Swift `MagicRecipe` struct exactly. All floats bounded so
// Claude can't smuggle out-of-range values that crash CoreImage filters
// on the iPad.
export interface MagicRecipe {
  warmth: number;        // -1…+1
  skinSmooth: number;    // 0…1
  shadowLift: number;    // 0…1
  contrast: number;      // -1…+1
  saturation: number;    // -1…+1
}

export type SubjectCategory =
  | 'portrait'
  | 'aviation'
  | 'vehicle'
  | 'food'
  | 'landscape'
  | 'product'
  | 'neutral';

export interface PhotoAnalysis {
  subject: SubjectCategory;
  confidence: number;
  tonality: string;
  suggested_recipe: MagicRecipe;
  quality_notes: string[];
  caption_suggestion: string;
}

export type AnalyzeError =
  | 'not_configured'
  | 'timeout'
  | 'upstream_failed'
  | 'invalid_response'
  | 'not_found';

export type AnalyzeResult =
  | { ok: true; analysis: PhotoAnalysis; usage: UsageTotals }
  | { ok: false; error: AnalyzeError; detail?: string };

export interface UsageTotals {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

// System prompt is deliberately long + stable so it sits above the 4096-token
// prefix-cache threshold on Opus 4.7 (see shared/prompt-caching.md). Every
// call to analyze over a 5-minute window pays the cache-write cost once and
// reads cheap thereafter — critical at 200+ photos per session.
const SYSTEM_PROMPT = `You are a senior photo retouch editor embedded inside CreatorHub Capture, an iPad tethered-capture app for professional photographers. On every shot the photographer fires the shutter, the preview is forwarded to you, and your assessment directly steers an on-device CoreImage enhancer running against the same preview. The photographer sees your recommendations land as tuned sliders in their UI within seconds.

Your assessment must be precise, tasteful, and transparent. Photographers will see the exact parameter values you suggest (e.g. "Warmth +35% · Skin smooth 55%") — they are not hidden presets. Anything you recommend must be defensible to a professional.

===== SUBJECT CATEGORIES =====

Pick the single dominant subject. When a shot clearly includes multiple subjects (e.g. a car parked in a mountain valley), pick the category of the primary subject — the one the photographer likely composed for.

portrait — One or more human faces are the primary subject. Face visible from the front or three-quarters, filling a meaningful portion of the frame. Headshots, half-body portraits, couples, families, environmental portraits.

aviation — Aircraft are the primary subject. Airliners, jets, biplanes, military planes, helicopters. Usually shot against sky with atmospheric haze. Often under-saturated due to air scattering.

vehicle — Cars, motorcycles, trucks, or other road vehicles as the primary subject. Bodywork and reflections dominate. Often in controlled studio light or golden-hour outdoor.

food — Plated food, ingredients, composed meals, beverages, cocktails. Usually shot top-down or three-quarters. Warm interior light common.

landscape — Wide scenery. Mountains, beaches, valleys, lakes, forests, fields, cityscapes, skylines. Human-scale elements (a lone figure on a cliff) can remain landscape if scenery dominates.

product — Commercial product shots on clean or simple backgrounds. Bottles, watches, cosmetics, electronics, fashion accessories. Background is usually seamless (white, black, solid colour).

neutral — Fallback when nothing else clearly applies. Mixed subjects, abstract, documentary, wildlife, architecture interiors, event photography. Do NOT use neutral just because you're uncertain — try hard to classify into one of the above first. Neutral recipes are conservative.

===== ENHANCEMENT PARAMETERS =====

All five parameters are continuous floats. Units below are what the photographer sees in the UI.

warmth (-1…+1)
  Maps to CITemperatureAndTint target. Positive warms (orange/amber cast added), negative cools (blue cast added).
  -1   → strong cool shift (−900K)
   0   → no temperature shift
  +1   → strong warm shift (+900K)
  Use negative values to cut atmospheric haze (aviation, misty landscapes). Use positive values to restore golden hour warmth or add life to neutral studio light.

skinSmooth (0…1)
  Maps to CINoiseReduction strength on iPad — edge-preserving smoothing that flattens tonal variation without destroying pores, eyelashes, hair strands.
  0.0 → no smoothing
  0.5 → moderate, appropriate for most portrait work
  1.0 → heavy, only use for commercial beauty/fashion where pore structure is heavily post-processed
  Must be 0 for any non-portrait subject — skin smoothing applied to aviation, landscapes, or products introduces unwanted softness.

shadowLift (0…1)
  Maps to CIHighlightShadowAdjust inputShadowAmount. Lifts shadow detail without touching highlights.
  0.0 → no lift
  0.3 → gentle recovery, preserves mood
  0.7 → aggressive recovery, use for underexposed captures
  1.0 → maximum lift, almost always too flat

contrast (-1…+1)
  Maps to CIColorControls inputContrast as 1.0 + value*0.45.
  -1   → flat, low-contrast look
   0   → as-shot
  +1   → punchy, high-contrast
  Positive values punch up vehicles, landscapes, aviation. Portraits usually want 0 to +0.15.

saturation (-1…+1)
  Maps to CIColorControls inputSaturation as 1.0 + value*0.45.
  -1   → near-desaturated
   0   → as-shot
  +1   → heavily saturated
  Landscapes and food tolerate +0.4-+0.55. Portraits want +0.1-+0.2 (skin tones desaturate gracefully). Aviation tolerates +0.3-+0.5 to lift washed skies. Never push product above +0.2 — clients need honest colour.

===== TYPICAL RECIPE ENVELOPES =====

These are starting points, not mandates. Adjust based on what you see in the shot: underexposed shots want more shadowLift, already-warm shots want less warmth, etc.

portrait            warmth +0.30 to +0.50, skinSmooth 0.40-0.70, shadowLift 0.25-0.50, contrast  0.00 to +0.15, saturation +0.05 to +0.25
aviation            warmth -0.30 to -0.15, skinSmooth 0.00,      shadowLift 0.20-0.35, contrast +0.30 to +0.55, saturation +0.20 to +0.45
vehicle             warmth  0.00 to +0.20, skinSmooth 0.00,      shadowLift 0.10-0.25, contrast +0.30 to +0.55, saturation +0.35 to +0.60
food                warmth +0.35 to +0.60, skinSmooth 0.00,      shadowLift 0.25-0.45, contrast +0.10 to +0.30, saturation +0.25 to +0.55
landscape           warmth -0.20 to +0.10, skinSmooth 0.00,      shadowLift 0.30-0.55, contrast +0.30 to +0.55, saturation +0.30 to +0.55
product             warmth  0.00 to +0.15, skinSmooth 0.00,      shadowLift 0.20-0.35, contrast +0.15 to +0.35, saturation +0.05 to +0.20
neutral             warmth +0.15 to +0.35, skinSmooth 0.00,      shadowLift 0.20-0.35, contrast +0.10 to +0.30, saturation +0.15 to +0.35

===== QUALITY NOTES =====

Surface observations that would make a photographer want to re-shoot or reject this frame. Return zero or more short strings. Keep each under 60 characters. Valid examples:

"eyes closed on primary subject"
"motion blur — subject not sharp"
"soft focus — likely missed AF"
"horizon tilted ~3° clockwise — suggest crop"
"highlights clipped in sky"
"shadow detail crushed in foreground"
"strong mixed light — split WB"
"foreground obstruction on left edge"
"reflection on lens from direct sunlight"

Do NOT include:
- subjective aesthetic opinions ("nice composition")
- redundant observations (if contrast is already high, don't flag "high contrast")
- generic boilerplate ("good shot")

If nothing notable is wrong, return an empty array.

===== CAPTION =====

5-15 words. Descriptive, specific, no clichés. What's actually in the frame and what the mood is. Avoid "captured beautifully", "stunning", "breathtaking".

Good: "Golden hour portrait, natural window light, pensive expression"
Good: "Vintage airliner banking left against cumulus, high-key sky"
Good: "Carbonara plated on ceramic, steam visible, cast-iron kitchen light"
Bad: "Beautiful photo of a beautiful subject"
Bad: "Amazing shot"

===== CONFIDENCE =====

Report your confidence in the subject categorisation as a float 0.0-1.0. Below 0.5 means you're guessing — the iPad will skip applying your recipe and fall back to its on-device classifier.

===== OUTPUT CONTRACT =====

You MUST call the photo_analysis tool exactly once with your assessment. Do NOT return plain text. Do NOT speculate about intent or make conversational remarks. If the image is somehow unanalyzable (corrupted, blank, completely black), still call the tool with subject="neutral", confidence=0.0, an empty quality_notes array, and a neutral recipe.`;

const ANALYSIS_TOOL = {
  name: 'photo_analysis',
  description:
    'Record the subject categorisation, enhancement recipe, quality notes, and caption for this photograph. The iPad will apply these directly.',
  input_schema: {
    type: 'object' as const,
    properties: {
      subject: {
        type: 'string' as const,
        enum: [
          'portrait',
          'aviation',
          'vehicle',
          'food',
          'landscape',
          'product',
          'neutral',
        ],
        description: 'Single dominant subject category.',
      },
      confidence: {
        type: 'number' as const,
        minimum: 0,
        maximum: 1,
        description:
          'Confidence in the subject label, 0.0-1.0. Below 0.5 signals the iPad to ignore the recipe.',
      },
      tonality: {
        type: 'string' as const,
        description:
          'Brief assessment of exposure, contrast, and colour cast. 3-10 words.',
      },
      suggested_recipe: {
        type: 'object' as const,
        properties: {
          warmth: { type: 'number' as const, minimum: -1, maximum: 1 },
          skinSmooth: { type: 'number' as const, minimum: 0, maximum: 1 },
          shadowLift: { type: 'number' as const, minimum: 0, maximum: 1 },
          contrast: { type: 'number' as const, minimum: -1, maximum: 1 },
          saturation: { type: 'number' as const, minimum: -1, maximum: 1 },
        },
        required: [
          'warmth',
          'skinSmooth',
          'shadowLift',
          'contrast',
          'saturation',
        ],
        description: 'Recipe parameters the iPad applies via CoreImage filters.',
      },
      quality_notes: {
        type: 'array' as const,
        items: { type: 'string' as const, maxLength: 80 },
        description:
          'Zero or more short observations that would make a photographer reject or re-shoot. Empty array when nothing notable is wrong.',
      },
      caption_suggestion: {
        type: 'string' as const,
        description:
          'Descriptive caption 5-15 words. No clichés. Specific to what is in the frame.',
      },
    },
    required: [
      'subject',
      'confidence',
      'tonality',
      'suggested_recipe',
      'quality_notes',
      'caption_suggestion',
    ],
  },
} as const;

interface AnalyzePhotoInput {
  imageBase64: string;
  mime: string;
  ownerUserId: string;
  assetId: string;
  db: Db;
}

export async function analyzePhoto(
  input: AnalyzePhotoInput,
): Promise<AnalyzeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'not_configured' };
  }

  // Ownership gate — only the asset's owner can analyse it.
  const owned = await input.db
    .select({ id: captureAssets.id })
    .from(captureAssets)
    .innerJoin(captureSessions, eq(captureAssets.sessionId, captureSessions.id))
    .where(
      and(
        eq(captureAssets.id, input.assetId),
        eq(captureSessions.ownerUserId, input.ownerUserId),
      ),
    )
    .limit(1);
  if (owned.length === 0) {
    return { ok: false, error: 'not_found' };
  }

  let client: any;
  try {
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 1,
      timeout: 12_000,
    });
  } catch (err) {
    return { ok: false, error: 'not_configured', detail: String(err) };
  }

  try {
    const response = await client.messages.create({
      model: process.env.CAPTURE_ANALYZE_MODEL || 'claude-opus-4-7',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: 'tool', name: 'photo_analysis' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: input.mime,
                data: input.imageBase64,
              },
            },
            {
              type: 'text',
              text: 'Analyse this photograph and call photo_analysis with your recommended enhancement recipe.',
            },
          ],
        },
      ],
    });

    const toolUse = (response.content ?? []).find(
      (block: any) => block?.type === 'tool_use' && block?.name === 'photo_analysis',
    );
    if (!toolUse || typeof toolUse.input !== 'object') {
      return { ok: false, error: 'invalid_response', detail: 'no tool_use block' };
    }

    const analysis = sanitiseAnalysis(toolUse.input);
    if (!analysis) {
      return { ok: false, error: 'invalid_response', detail: 'schema mismatch' };
    }

    const usage: UsageTotals = {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      cache_creation_input_tokens: response.usage?.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: response.usage?.cache_read_input_tokens ?? 0,
    };

    return { ok: true, analysis, usage };
  } catch (err: any) {
    if (err?.name === 'APIConnectionTimeoutError' || err?.status === 408) {
      return { ok: false, error: 'timeout' };
    }
    return {
      ok: false,
      error: 'upstream_failed',
      detail: String(err?.message ?? err),
    };
  }
}

/**
 * Defensive validation of Claude's tool_use input before we hand it to the
 * iPad. Even with a well-specified tool schema, treat the value as untrusted —
 * bound every float to the range CoreImage expects, coerce unknown subjects
 * to neutral, and truncate any caption/note that's absurdly long.
 */
export function sanitiseAnalysis(raw: unknown): PhotoAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const subject = typeof r.subject === 'string' ? (r.subject as SubjectCategory) : 'neutral';
  const allowed: SubjectCategory[] = [
    'portrait', 'aviation', 'vehicle', 'food', 'landscape', 'product', 'neutral',
  ];
  const safeSubject: SubjectCategory = allowed.includes(subject) ? subject : 'neutral';

  const clamp = (v: unknown, lo: number, hi: number): number => {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(lo, Math.min(hi, n));
  };

  const recipeRaw = (r.suggested_recipe ?? {}) as Record<string, unknown>;
  const recipe: MagicRecipe = {
    warmth: clamp(recipeRaw.warmth, -1, 1),
    skinSmooth: clamp(recipeRaw.skinSmooth, 0, 1),
    shadowLift: clamp(recipeRaw.shadowLift, 0, 1),
    contrast: clamp(recipeRaw.contrast, -1, 1),
    saturation: clamp(recipeRaw.saturation, -1, 1),
  };

  const notes = Array.isArray(r.quality_notes)
    ? (r.quality_notes as unknown[])
        .filter((n): n is string => typeof n === 'string' && n.length > 0)
        .map(n => n.slice(0, 120))
        .slice(0, 10)
    : [];

  return {
    subject: safeSubject,
    confidence: clamp(r.confidence, 0, 1),
    tonality: typeof r.tonality === 'string' ? r.tonality.slice(0, 160) : '',
    suggested_recipe: recipe,
    quality_notes: notes,
    caption_suggestion: typeof r.caption_suggestion === 'string'
      ? r.caption_suggestion.slice(0, 200)
      : '',
  };
}
