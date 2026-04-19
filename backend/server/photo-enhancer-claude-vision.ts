/**
 * Claude Vision portrait recipe suggester for the web photo enhancer.
 *
 * Different from `capture-analyze-service.ts`: that module runs during
 * live tethered capture and returns a 5-parameter CoreImage recipe for
 * the iPad. This one runs from the web enhancer and returns the full
 * slider set the web UI exposes — including the four Evoto-parity
 * portrait controls with per-effect intensity profile.
 *
 * The goal is "tasteful first draft". A photographer uploads a
 * portrait, hits "AI-forslag", and every slider is pre-populated with
 * a defensible value so they only need to dial the result in — not
 * start from zero. The caller merges the returned values into the
 * current settings; keys that are deliberately left out (e.g. face-
 * only crop is a workflow choice, not a visual one) are not touched.
 *
 * Cost + latency notes:
 *   - Prompt is cached via Anthropic's ephemeral cache_control so the
 *     5-minute TTL covers typical editing sessions (upload → tweak →
 *     re-analyse).
 *   - Timeout is 20s because an embedded JPEG preview up to ~2 MB is
 *     being uploaded.
 *   - `confidence < 0.35` means the caller should NOT auto-apply the
 *     recipe — surface it as a soft suggestion instead.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type IntensityProfile = 'subtle' | 'normal' | 'strong';

/// Subject categories Claude is allowed to assign. Mirrors the Capture
/// analyze service's vocabulary so the photographer sees the same
/// subject labels whether they're on the iPad or in the web enhancer.
/// "other" is the catch-all for architecture, documentary, abstract,
/// wildlife, anything that doesn't cleanly fit the above.
export type SubjectKind =
  | 'portrait'
  | 'group_portrait'
  | 'food'
  | 'landscape'
  | 'product'
  | 'vehicle'
  | 'aviation'
  | 'other';

/// Non-portrait kinds where the portrait-only sliders (teeth, eyes,
/// blemish, faceEnhancement) must always be zero regardless of what
/// Claude emitted. ``group_portrait`` stays OUT of this set — those
/// photos absolutely benefit from portrait work.
const NON_PORTRAIT_KINDS: ReadonlySet<SubjectKind> = new Set<SubjectKind>([
  'food',
  'landscape',
  'product',
  'vehicle',
  'aviation',
  'other',
]);

export interface PortraitRecipeRecommendation {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  denoising: number;
  faceEnhancement: number;
  skinTextureGuard: number;
  blemishRemoval: number;
  teethWhiteness: number;
  eyeBrightness: number;
  eyeWhiteness: number;
  teethProfile: IntensityProfile;
  eyeBrightnessProfile: IntensityProfile;
  eyeWhitenessProfile: IntensityProfile;
  blemishProfile: IntensityProfile;
}

export interface PortraitAnalysisSummary {
  subject: SubjectKind;
  confidence: number;
  rationale: string;
  observations: string[];
}

export type SuggestError =
  | 'not_configured'
  | 'timeout'
  | 'upstream_failed'
  | 'invalid_response'
  | 'image_too_large';

export interface SuggestUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export type SuggestResult =
  | {
      ok: true;
      recipe: PortraitRecipeRecommendation;
      analysis: PortraitAnalysisSummary;
      usage: SuggestUsage;
    }
  | { ok: false; error: SuggestError; detail?: string };

const MAX_IMAGE_BASE64_BYTES = 10 * 1024 * 1024; // 10 MB of base64

const PROFILES: IntensityProfile[] = ['subtle', 'normal', 'strong'];

// Long, stable system prompt — sits above the 4,096-token prefix-cache
// threshold so repeated analyse calls in the same session pay the
// cache-write cost once.
const SYSTEM_PROMPT = `You are a senior retouch editor embedded inside the CreatorHub photo enhancer. A photographer has uploaded a single image and wants you to propose a complete set of slider values that produce a polished, natural-looking result without over-processing. The photographer will see the exact values you propose — they are not hidden — and must be able to defend every setting to a client.

===== SUBJECT CATEGORIES =====

Pick exactly one. When a shot has multiple elements (a steak on a plate on a wood table), pick the category that describes what the photographer composed for.

portrait         — one primary face that fills a meaningful portion of the frame. Headshots, half-body portraits, environmental portraits with one subject.
group_portrait   — two or more faces of roughly equal importance. Couples, families, wedding parties, sports teams, corporate group shots.
food             — plated food, beverages, ingredients, cocktails. Usually top-down or three-quarters. Warm interior light is common.
landscape        — wide scenery. Mountains, beaches, forests, cityscapes, skylines. Small human-scale elements (a lone figure on a cliff) still count as landscape if scenery dominates.
product          — isolated product shot. E-commerce, catalogue, lookbook flat lay. Usually clean/white background or controlled studio light.
vehicle          — cars, motorcycles, trucks, bikes as the primary subject. Bodywork and reflections dominate. Often studio or golden hour.
aviation         — aircraft as the primary subject. Airliners, jets, biplanes, helicopters. Usually shot against sky with atmospheric haze.
other            — anything that doesn't cleanly fit above: architecture interiors, documentary, abstract, wildlife, detail shots, event photography.

===== PORTRAIT-ONLY SLIDERS =====

These run ONLY when subject is "portrait" or "group_portrait". For every other subject, set them to 0 and the matching profiles to "normal" — the safety net will enforce this anyway, but emitting them zero keeps the payload honest.

faceEnhancement, skinTextureGuard, blemishRemoval, teethWhiteness, eyeBrightness, eyeWhiteness
blemishProfile, teethProfile, eyeBrightnessProfile, eyeWhitenessProfile

See PORTRAIT TUNING section below for exact values.

===== TONE & GENERAL SLIDERS =====

These run via Sharp.js on the web layer, before any subject-specific pass. Every subject tunes them differently — read the per-subject guide that matches your classification.

brightness (-100..100)        — exposure push. 0 = unchanged.
contrast   (-100..100)        — global contrast.
saturation (-100..100)        — global saturation.
sharpness  (-100..100)        — unsharp mask amount.
denoising  (0..100)            — noise reduction strength.

Default on all of these is 0 (or 50 for denoising). Only move a slider if the image needs it.

===== PER-SUBJECT TUNING =====

portrait / group_portrait:
  brightness   0 (nudge +2..+6 if underexposed)
  contrast     +4..+10 on flat light; never above +15 on skin — "HDR face"
  saturation   0 (bump +3..+6 if muted)
  sharpness    +8..+14 (mirrorless default); reduce for already crisp files
  denoising    25-40 base ISO, 50-65 at ISO 1600-3200, 70-85 above
  → continue to PORTRAIT TUNING below for the portrait-only sliders

food:
  brightness   +2..+6 to lift dim restaurant interior (beware blowing highlights)
  contrast     +6..+12 — food wants punch, juices, crust definition
  saturation   +8..+18 — warm reds/oranges read as "appetising"; never neon
  sharpness    +10..+18 on crisp plating; +4..+8 on soft/dreamy shots
  denoising    30-45 — preserve texture of crust, fabric, herbs
  All portrait-only sliders: 0 / normal

landscape:
  brightness   0 (lift +3..+6 only if base exposure is dull)
  contrast     +10..+18 — big range, atmospheric haze benefits from contrast
  saturation   +10..+22 — landscapes can handle saturation that would ruin skin
  sharpness    +14..+24 — foliage, rock, distant detail
  denoising    15-35 — over-denoising smears foliage into plastic
  All portrait-only sliders: 0 / normal

product:
  brightness   +2..+6 — e-commerce likes clean brightness
  contrast     +6..+12
  saturation   0..+6 — keep colour accurate, client may match to spec
  sharpness    +14..+22 — product edges crisp
  denoising    45-70 — studio light is clean, kill sensor noise aggressively
  All portrait-only sliders: 0 / normal

vehicle:
  brightness   0
  contrast     +8..+16 — makes paint reflections pop
  saturation   +6..+14 — especially reds, yellows, deep blues
  sharpness    +16..+24 — panel edges, badge detail, trim
  denoising    30-50
  All portrait-only sliders: 0 / normal

aviation:
  brightness   0 (lift +3..+5 if haze flattens sky)
  contrast     +12..+20 — cuts through atmospheric haze
  saturation   +8..+16 — restores sky saturation lost to distance
  sharpness    +12..+20 — rivets, livery, propeller blur preservation
  denoising    25-40
  All portrait-only sliders: 0 / normal

other:
  Stay conservative — small contrast/saturation bumps, denoising at 40. Without strong subject context, don't push the image. All portrait-only sliders: 0 / normal.

faceEnhancement (0..100):
  * 0 if no face is visible.
  * 45-55 on studio + window portraits — adds pop without plasticising.
  * 65-80 on low-res / motion-blurred faces where GFPGAN is rescuing.

skinTextureGuard (0..100):
  * High values keep skin texture through GFPGAN.
  * 70 default. 80+ for closely-cropped headshots where pores matter.
  * 50-65 when the image has visible noise you want partly smoothed.

===== EVOTO-PARITY PORTRAIT SLIDERS =====

Each has a 0..100 strength AND a per-effect profile (subtle / normal / strong). The profile scales the LAB multipliers and feather. Guidance:

blemishRemoval + blemishProfile:
  * 0 / normal  when skin is clean. Default on most adult clients.
  * 25-45 / normal  for mild blemishes, everyday work.
  * 55-75 / strong  for visible acne, scars, stubborn spots.
  * Keep profile=subtle on children (they don't have blemishes to begin
    with — the strong profile flattens freckles and character).

teethWhiteness + teethProfile:
  * 0   when teeth are not visible or already clean.
  * 20-35 / normal  for the everyday yellow cast of interior lighting.
  * 45-60 / normal  for smokers / coffee drinkers.
  * Profile=strong sparingly — over-whitening reads as fake.
  * Profile=subtle for skin tones where a strong cool shift would clash
    (warm brown skin tones can look ashy if teeth get pushed too blue).

eyeBrightness + eyeBrightnessProfile:
  * 0   when the subject already has good catch light.
  * 15-30 / normal  when the iris reads flat.
  * 40-55 / strong  on very dark-eyed subjects to bring life to the iris.
  * Never touch eyes if sunglasses are present (you can tell).

eyeWhiteness + eyeWhitenessProfile:
  * 0   on fresh, well-rested subjects.
  * 25-40 / normal  for typical end-of-day tired eyes.
  * 50-70 / strong  for heavily reddened sclera, but warn the photographer
    in your rationale that the look borders on clinical-white.
  * Profile=subtle for children and elderly subjects — strong sclera
    bleaching reads very uncanny on them.

===== CONFIDENCE =====

confidence (0..1):
  * < 0.35  means you're guessing. The caller will show the suggestion
            as "low confidence — review manually" rather than auto-apply.
  * 0.5-0.8 is the normal healthy range.
  * > 0.9   only when the shot is unambiguously the described subject.

===== RATIONALE =====

rationale is 1-3 sentences in Norwegian or English (match whatever
language you infer from the filename/metadata, default English) that
justifies the non-zero sliders. Example:
  "Skin has mild shine on forehead and two small blemishes near jawline;
   blemishRemoval=35 normal handles those while keeping pore texture.
   Teeth show warm interior cast, teethWhiteness=30 normal neutralises
   without going clinical."

observations is 0..5 short strings flagging what the photographer
should look at before publishing (closed eye, motion blur, mismatched
white balance between subjects). Empty array when nothing is notable.

===== OUTPUT CONTRACT =====

You MUST call the suggest_portrait_recipe tool exactly once. Never
return plain text. Never speculate about the photographer's intent or
add conversational pleasantries. Every slider field is required, even
if its value is 0.`;

const SUGGEST_TOOL = {
  name: 'suggest_portrait_recipe',
  description:
    'Propose a full portrait retouch recipe — every slider value plus per-effect intensity profile — for the uploaded image. The caller merges these values into the enhancer UI directly.',
  input_schema: {
    type: 'object' as const,
    properties: {
      subject: {
        type: 'string' as const,
        enum: [
          'portrait',
          'group_portrait',
          'food',
          'landscape',
          'product',
          'vehicle',
          'aviation',
          'other',
        ],
        description:
          'Broad categorisation of the uploaded image. Drives per-subject slider tuning on the caller side, so picking the right category matters more than tweaking slider values within a category.',
      },
      confidence: {
        type: 'number' as const,
        minimum: 0,
        maximum: 1,
        description:
          'Confidence in the overall assessment, 0.0-1.0. Below 0.35 signals low confidence; the UI will show the suggestion as advisory only.',
      },
      rationale: {
        type: 'string' as const,
        description:
          'One to three sentences justifying the non-zero sliders. Max 400 chars.',
      },
      observations: {
        type: 'array' as const,
        items: { type: 'string' as const, maxLength: 120 },
        description:
          'Zero to five short observations the photographer should verify before publishing.',
      },
      recipe: {
        type: 'object' as const,
        properties: {
          brightness: { type: 'number' as const, minimum: -100, maximum: 100 },
          contrast: { type: 'number' as const, minimum: -100, maximum: 100 },
          saturation: { type: 'number' as const, minimum: -100, maximum: 100 },
          sharpness: { type: 'number' as const, minimum: -100, maximum: 100 },
          denoising: { type: 'number' as const, minimum: 0, maximum: 100 },
          faceEnhancement: { type: 'number' as const, minimum: 0, maximum: 100 },
          skinTextureGuard: { type: 'number' as const, minimum: 0, maximum: 100 },
          blemishRemoval: { type: 'number' as const, minimum: 0, maximum: 100 },
          teethWhiteness: { type: 'number' as const, minimum: 0, maximum: 100 },
          eyeBrightness: { type: 'number' as const, minimum: 0, maximum: 100 },
          eyeWhiteness: { type: 'number' as const, minimum: 0, maximum: 100 },
          blemishProfile: {
            type: 'string' as const,
            enum: ['subtle', 'normal', 'strong'],
          },
          teethProfile: {
            type: 'string' as const,
            enum: ['subtle', 'normal', 'strong'],
          },
          eyeBrightnessProfile: {
            type: 'string' as const,
            enum: ['subtle', 'normal', 'strong'],
          },
          eyeWhitenessProfile: {
            type: 'string' as const,
            enum: ['subtle', 'normal', 'strong'],
          },
        },
        required: [
          'brightness',
          'contrast',
          'saturation',
          'sharpness',
          'denoising',
          'faceEnhancement',
          'skinTextureGuard',
          'blemishRemoval',
          'teethWhiteness',
          'eyeBrightness',
          'eyeWhiteness',
          'blemishProfile',
          'teethProfile',
          'eyeBrightnessProfile',
          'eyeWhitenessProfile',
        ],
      },
    },
    required: ['subject', 'confidence', 'rationale', 'observations', 'recipe'],
  },
};


type Db = NodePgDatabase<Record<string, unknown>>;


export interface SuggestPortraitRecipeInput {
  imageBase64: string;
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  /// Optional hint about what the photographer is shooting — the active
  /// preset in the enhancer UI (``portrait``, ``wedding``, ``studio``,
  /// ``landscape``, ``product``) or the profession name. Passed to
  /// Claude in the user message so its suggestions are tuned to the
  /// intended use. Claude will still classify the image independently;
  /// the hint just breaks ties (a wedding-party shot read as "food" if
  /// the frame is dominated by the cake would be obvious nonsense
  /// given the hint).
  presetHint?: string;
  /// Optional summary of how this photographer systematically drifts
  /// from the AI's prior suggestions — produced by
  /// aggregateUserRecipePreferences() in photo-enhancer-feedback-service.
  /// Format is a semicolon-separated phrase list such as
  /// "typically moves teethWhiteness +15 beyond suggested; prefers
  /// blemishProfile=strong (8/10 times)". Claude bakes these into the
  /// next suggestion so the photographer sees values closer to what
  /// they'd have dialled in themselves.
  userPreferenceSummary?: string;
  db?: Db; // reserved for future telemetry writes; unused today.
}

function clamp(n: unknown, lo: number, hi: number, fallback = 0): number {
  const raw = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(lo, Math.min(hi, raw));
}

function asProfile(value: unknown): IntensityProfile {
  if (typeof value === 'string') {
    const lowered = value.toLowerCase().trim();
    if (PROFILES.includes(lowered as IntensityProfile)) {
      return lowered as IntensityProfile;
    }
  }
  return 'normal';
}

/**
 * Defensive validation of the tool payload. Claude generally stays in
 * range given the schema, but we treat the value as untrusted and
 * clamp every slider, coerce unknown profiles to "normal", and cap
 * string lengths so a pathological response can't blow the UI.
 */
export function sanitiseSuggestion(raw: unknown):
  | { recipe: PortraitRecipeRecommendation; analysis: PortraitAnalysisSummary }
  | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const recipeIn = (r.recipe ?? {}) as Record<string, unknown>;

  const VALID_SUBJECTS: readonly SubjectKind[] = [
    'portrait',
    'group_portrait',
    'food',
    'landscape',
    'product',
    'vehicle',
    'aviation',
    'other',
  ];
  const subjectRaw = typeof r.subject === 'string' ? r.subject : 'other';
  const subject: SubjectKind = VALID_SUBJECTS.includes(subjectRaw as SubjectKind)
    ? (subjectRaw as SubjectKind)
    : 'other';

  const observationsRaw = Array.isArray(r.observations) ? r.observations : [];
  const observations = observationsRaw
    .filter((o): o is string => typeof o === 'string')
    .map((o) => o.slice(0, 160))
    .slice(0, 8);

  const analysis: PortraitAnalysisSummary = {
    subject,
    confidence: clamp(r.confidence, 0, 1, 0),
    rationale:
      typeof r.rationale === 'string'
        ? r.rationale.slice(0, 600)
        : '',
    observations,
  };

  const recipe: PortraitRecipeRecommendation = {
    brightness: Math.round(clamp(recipeIn.brightness, -100, 100)),
    contrast: Math.round(clamp(recipeIn.contrast, -100, 100)),
    saturation: Math.round(clamp(recipeIn.saturation, -100, 100)),
    sharpness: Math.round(clamp(recipeIn.sharpness, -100, 100)),
    denoising: Math.round(clamp(recipeIn.denoising, 0, 100, 50)),
    faceEnhancement: Math.round(clamp(recipeIn.faceEnhancement, 0, 100)),
    skinTextureGuard: Math.round(clamp(recipeIn.skinTextureGuard, 0, 100, 70)),
    blemishRemoval: Math.round(clamp(recipeIn.blemishRemoval, 0, 100)),
    teethWhiteness: Math.round(clamp(recipeIn.teethWhiteness, 0, 100)),
    eyeBrightness: Math.round(clamp(recipeIn.eyeBrightness, 0, 100)),
    eyeWhiteness: Math.round(clamp(recipeIn.eyeWhiteness, 0, 100)),
    blemishProfile: asProfile(recipeIn.blemishProfile),
    teethProfile: asProfile(recipeIn.teethProfile),
    eyeBrightnessProfile: asProfile(recipeIn.eyeBrightnessProfile),
    eyeWhitenessProfile: asProfile(recipeIn.eyeWhitenessProfile),
  };

  // Sanity guard: every non-portrait category zeroes the portrait-only
  // sliders regardless of what Claude emitted. Even if the tool schema
  // is followed, a mistaken classification must not quietly plasticise
  // a landscape or smooth the texture on a food plate.
  if (NON_PORTRAIT_KINDS.has(subject)) {
    recipe.faceEnhancement = 0;
    recipe.skinTextureGuard = 70;
    recipe.blemishRemoval = 0;
    recipe.teethWhiteness = 0;
    recipe.eyeBrightness = 0;
    recipe.eyeWhiteness = 0;
    recipe.teethProfile = 'normal';
    recipe.eyeBrightnessProfile = 'normal';
    recipe.eyeWhitenessProfile = 'normal';
    recipe.blemishProfile = 'normal';
  }

  return { recipe, analysis };
}

function buildUserMessage(
  presetHint?: string,
  userPreferenceSummary?: string,
): string {
  const base =
    'Assess this upload and call suggest_portrait_recipe with your full recipe. Every slider value is required.';
  const parts: string[] = [base];

  if (presetHint) {
    // Whitelist known preset names to avoid prompt-injecting with the
    // value. Anything outside the list is formatted as a plain string
    // (clipped to 40 chars) so a future unknown preset still works but
    // can't smuggle instructions.
    const known = new Set([
      'auto', 'portrait', 'wedding', 'studio', 'landscape', 'product',
      'food', 'vehicle', 'aviation', 'photographer', 'wedding-photographer',
      'commercial-photographer', 'videographer',
    ]);
    const hint = presetHint.toLowerCase().trim().slice(0, 40);
    const safeHint = known.has(hint) ? hint : hint.replace(/[^a-z0-9\- _]/g, '');
    if (safeHint) {
      parts.push(
        `The photographer's active preset / profession is "${safeHint}" — factor this context in when classifying the subject and tuning the sliders, but do not blindly follow it if the image clearly belongs to a different category.`,
      );
    }
  }

  if (userPreferenceSummary) {
    // Photographer-specific drift learned from their past overrides.
    // We sanitise by clipping to 600 chars and stripping anything that
    // could be mistaken for a new instruction block — just in case
    // something upstream wrote free-form text into the summary.
    const cleanedSummary = userPreferenceSummary
      .replace(/[\r\n]+/g, ' ')
      .replace(/[^\w\s+\-=.,:;()/%]/g, '')
      .slice(0, 600);
    if (cleanedSummary) {
      parts.push(
        `Photographer-specific preferences learned from previous sessions: ${cleanedSummary}. Bias your suggestion toward these drifts when they are consistent with what the image actually needs. Do not apply them blindly — if this shot is fundamentally different from their usual work, ignore the drift and propose what the image asks for.`,
      );
    }
  }

  return parts.join(' ');
}


export async function suggestPortraitRecipe(
  input: SuggestPortraitRecipeInput,
): Promise<SuggestResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'not_configured' };
  }
  if (!input.imageBase64 || input.imageBase64.length > MAX_IMAGE_BASE64_BYTES) {
    return { ok: false, error: 'image_too_large' };
  }

  let client: any;
  try {
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 1,
      timeout: 20_000,
    });
  } catch (err) {
    return { ok: false, error: 'not_configured', detail: String(err) };
  }

  try {
    const response = await client.messages.create({
      model: process.env.PHOTO_ENHANCER_SUGGEST_MODEL || 'claude-opus-4-7',
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [SUGGEST_TOOL],
      tool_choice: { type: 'tool', name: 'suggest_portrait_recipe' },
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
              text: buildUserMessage(input.presetHint, input.userPreferenceSummary),
            },
          ],
        },
      ],
    });

    const toolUse = (response.content ?? []).find(
      (block: any) =>
        block?.type === 'tool_use' && block?.name === 'suggest_portrait_recipe',
    );
    if (!toolUse || typeof toolUse.input !== 'object') {
      return { ok: false, error: 'invalid_response', detail: 'no tool_use block' };
    }

    const parsed = sanitiseSuggestion(toolUse.input);
    if (!parsed) {
      return { ok: false, error: 'invalid_response', detail: 'schema mismatch' };
    }

    return {
      ok: true,
      recipe: parsed.recipe,
      analysis: parsed.analysis,
      usage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
        cache_creation_input_tokens:
          response.usage?.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: response.usage?.cache_read_input_tokens ?? 0,
      },
    };
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
