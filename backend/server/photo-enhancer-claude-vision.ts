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
import { logAIUsage } from './ai-usage-tracker.js';

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

export type HslBand = { h: number; s: number; l: number };
export type HslRecommendation = {
  red: HslBand;
  orange: HslBand;
  yellow: HslBand;
  green: HslBand;
  aqua: HslBand;
  blue: HslBand;
  purple: HslBand;
  magenta: HslBand;
};

const HSL_IDENTITY_RECIPE: HslRecommendation = {
  red: { h: 0, s: 0, l: 0 },
  orange: { h: 0, s: 0, l: 0 },
  yellow: { h: 0, s: 0, l: 0 },
  green: { h: 0, s: 0, l: 0 },
  aqua: { h: 0, s: 0, l: 0 },
  blue: { h: 0, s: 0, l: 0 },
  purple: { h: 0, s: 0, l: 0 },
  magenta: { h: 0, s: 0, l: 0 },
};

const HSL_BAND_NAMES: ReadonlyArray<keyof HslRecommendation> = [
  'red',
  'orange',
  'yellow',
  'green',
  'aqua',
  'blue',
  'purple',
  'magenta',
];

export type LutTonalMix = "all" | "highlights" | "midtones" | "shadows";

export interface LutRecommendation {
  /** Built-in slug or null when no LUT pass is wanted. */
  name: string | null;
  /** [0, 100] linear blend with identity. */
  strength: number;
  /** Limit the LUT to a tonal range (default "all"). */
  tonalMix: LutTonalMix;
}

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
  hsl: HslRecommendation;
  lut: LutRecommendation;
}

export const LUT_RECIPE_DEFAULT: LutRecommendation = {
  name: null,
  strength: 0,
  tonalMix: "all",
};

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

===== LUT LOOK (OPTIONAL) =====

Applied after face restoration and HSL. Pick at most one built-in look
(name field) and a linear strength in [0, 100].

  * neutral     — identity. Use when no look is needed.
  * warm_soft   — gentle midtone warmth. Fits skin / food / cosy indoor
                  light. Safe default at 40–60 strength for portraits
                  that read a little cool.
  * cool_soft   — mild cooling of shadows. Fits landscapes / outdoor
                  product at midday. Rare on portraits (skin goes grey).

If unsure, emit name=null / strength=0. Never pick both a warm and cool
look. tonalMix lets you limit the effect: "highlights" for sky/
highlights work, "shadows" for shadow grade, "midtones" for skin
warmth without blowing highlights. Default "all".

===== HSL (8-BAND COLOUR GRADING) =====

Applied after face restoration on every subject. Bands are red / orange /
yellow / green / aqua / blue / purple / magenta and each has h, s, l in
[-100, 100] mapping to hue rotation (±30°), saturation multiplier (0×–2×),
and luminance offset (±0.25 on 0–1 V).

Default every band to { h: 0, s: 0, l: 0 }. Only move a band when the
image has a visible colour problem you would fix manually:

  * a yellow-cast white dress under tungsten → reduce yellow saturation
    and/or yellow luminance
  * a bluish skin tone from shade → nudge orange hue +10..+20 (toward
    red) and orange saturation +5..+10
  * an over-punchy blue sky that looks fake → reduce blue saturation by
    -10..-20
  * food shots where the plate greens look grey → green saturation
    +10..+20

Never stylise for style's sake. Emit identity for every band if the image
already looks clean; the photographer will dial in any grade they want.

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
          lut: {
            type: 'object' as const,
            description:
              'Optional LUT look selection. Use null name when the image is fine without a colour look. Valid built-in names: "neutral" (identity), "warm_soft" (mild warmth), "cool_soft" (mild cooling). Pick a look only when it genuinely helps the subject — do not stylise for style\'s sake.',
            properties: {
              name: {
                type: ['string', 'null'] as const,
                enum: ['neutral', 'warm_soft', 'cool_soft', null],
              },
              strength: {
                type: 'number' as const,
                minimum: 0,
                maximum: 100,
              },
              tonalMix: {
                type: 'string' as const,
                enum: ['all', 'highlights', 'midtones', 'shadows'],
                description:
                  'Limit the LUT to a tonal range. Default "all". Use "highlights" for sky/skin highlights work, "shadows" for shadow grade, "midtones" for skin warmth without touching extremes.',
              },
            },
            required: ['name', 'strength', 'tonalMix'],
          },
          hsl: {
            type: 'object' as const,
            description:
              '8-band HSL colour grading applied after face restoration. Emit zeros (identity) unless the image has a visible colour cast you would fix by hand — do NOT stylise images that already look clean. Per band, h is hue rotation in [-100, 100] (roughly ±30°), s is saturation multiplier in [-100, 100] (fully desaturate at -100, double at +100), l is luminance offset in [-100, 100].',
            properties: Object.fromEntries(
              HSL_BAND_NAMES.map((name) => [
                name,
                {
                  type: 'object' as const,
                  properties: {
                    h: { type: 'number' as const, minimum: -100, maximum: 100 },
                    s: { type: 'number' as const, minimum: -100, maximum: 100 },
                    l: { type: 'number' as const, minimum: -100, maximum: 100 },
                  },
                  required: ['h', 's', 'l'],
                },
              ]),
            ),
            required: HSL_BAND_NAMES,
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
          'hsl',
          'lut',
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
  /// Optional free-text style request from the photographer, e.g.
  /// "give me a warm, airy pastel film look" or "moody editorial,
  /// crushed blacks". When present, Claude treats it as the primary
  /// creative brief and translates it into concrete slider/HSL/LUT
  /// values for this specific image. Sanitised (clipped + newline-
  /// stripped) before it reaches the prompt.
  styleInstruction?: string;
  db?: Db; // reserved for future telemetry writes; unused today.
}

function clamp(n: unknown, lo: number, hi: number, fallback = 0): number {
  const raw = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(lo, Math.min(hi, raw));
}

function parseHsl(raw: unknown): HslRecommendation {
  // Accept missing / malformed / partial — default to identity so a
  // prompt-cache miss that truncates the HSL block just produces an
  // un-styled image rather than failing the whole suggest call.
  if (!raw || typeof raw !== 'object') {
    return {
      red: { ...HSL_IDENTITY_RECIPE.red },
      orange: { ...HSL_IDENTITY_RECIPE.orange },
      yellow: { ...HSL_IDENTITY_RECIPE.yellow },
      green: { ...HSL_IDENTITY_RECIPE.green },
      aqua: { ...HSL_IDENTITY_RECIPE.aqua },
      blue: { ...HSL_IDENTITY_RECIPE.blue },
      purple: { ...HSL_IDENTITY_RECIPE.purple },
      magenta: { ...HSL_IDENTITY_RECIPE.magenta },
    };
  }
  const source = raw as Record<string, unknown>;
  const out = {} as HslRecommendation;
  for (const name of HSL_BAND_NAMES) {
    const band = source[name];
    if (!band || typeof band !== 'object') {
      out[name] = { ...HSL_IDENTITY_RECIPE[name] };
      continue;
    }
    const b = band as Record<string, unknown>;
    out[name] = {
      h: Math.round(clamp(b.h, -100, 100)),
      s: Math.round(clamp(b.s, -100, 100)),
      l: Math.round(clamp(b.l, -100, 100)),
    };
  }
  return out;
}

const ALLOWED_LUT_SLUGS: readonly string[] = [
  "neutral",
  "warm_soft",
  "cool_soft",
] as const;

const ALLOWED_TONAL_MIX: readonly LutTonalMix[] = [
  "all",
  "highlights",
  "midtones",
  "shadows",
] as const;

function parseLut(raw: unknown): LutRecommendation {
  if (!raw || typeof raw !== "object") {
    return { ...LUT_RECIPE_DEFAULT };
  }
  const source = raw as Record<string, unknown>;
  const nameRaw = typeof source.name === "string" ? source.name.trim() : "";
  const name = nameRaw && ALLOWED_LUT_SLUGS.includes(nameRaw) ? nameRaw : null;
  const strength = Math.round(clamp(source.strength, 0, 100, 0));
  const tonalRaw = typeof source.tonalMix === "string" ? source.tonalMix.trim() : "";
  const tonalMix: LutTonalMix = ALLOWED_TONAL_MIX.includes(tonalRaw as LutTonalMix)
    ? (tonalRaw as LutTonalMix)
    : "all";
  if (!name) return { ...LUT_RECIPE_DEFAULT };
  return { name, strength, tonalMix };
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
    hsl: parseHsl((recipeIn as Record<string, unknown>).hsl),
    lut: parseLut((recipeIn as Record<string, unknown>).lut),
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
  styleInstruction?: string,
): string {
  const base =
    'Assess this upload and call suggest_portrait_recipe with your full recipe. Every slider value is required.';
  const parts: string[] = [base];

  if (styleInstruction) {
    // The photographer's own free-text brief. It is their input (not an
    // untrusted third party), but we still clip and strip newlines so it
    // can't break out of its sentence and rewrite the surrounding
    // instructions.
    const cleaned = styleInstruction
      .replace(/[\r\n]+/g, ' ')
      .replace(/["`]/g, "'")
      .trim()
      .slice(0, 240);
    if (cleaned) {
      parts.push(
        `The photographer has requested a specific look: "${cleaned}". Treat this as the PRIMARY creative brief — translate it into concrete slider, HSL band and LUT values that reproduce that aesthetic on THIS image (e.g. a "pastel film" or "Jose Villa" brief implies low contrast, warm/creamy highlights, lifted/desaturated shadows and soft skin). Stay photographic and avoid clipping; if part of the request can't be expressed with the available controls, get as close as the sliders allow.`,
      );
    }
  }

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
              text: buildUserMessage(input.presetHint, input.userPreferenceSummary, input.styleInstruction),
            },
          ],
        },
      ],
    });
    logAIUsage(response as any, { feature: 'photo/suggest-recipe' }).catch(() => undefined);

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

// ============================================================================
// Object removal / inpaint planner.
//
// Different from suggestPortraitRecipe: this one runs once per object-removal
// brush stroke, not once per image. The photographer paints a mask over the
// thing they want gone (a flash head poking into frame, a power cable on the
// floor, a stray light stand), and Claude plans HOW the executor should fill
// the hole. Claude does NOT paint pixels — it returns a recipe and the
// deterministic executor (OpenCV Telea/NS + clone-stamp + optional freq-sep
// post-pass) does the actual work.
//
// Why this split:
//   - Single AI vendor (Anthropic) for the whole stack — no Stability /
//     Replicate / Firefly account to manage.
//   - Image-in, JSON-out is cheap. Image-in, image-out (LaMa, SDXL inpaint)
//     would 10× the cost per call.
//   - Recipe is auditable and survives round-trips. The photographer can see
//     what strategy was used and why.
// ============================================================================

export type InpaintStrategy = 'telea' | 'ns' | 'patch_clone' | 'freq_sep';

const INPAINT_STRATEGIES: readonly InpaintStrategy[] = [
  'telea',
  'ns',
  'patch_clone',
  'freq_sep',
] as const;

export interface InpaintRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface InpaintRecipeRecommendation {
  strategy: InpaintStrategy;
  /** Telea/NS radius in pixels. Ignored for patch_clone / freq_sep. */
  radiusPx: number;
  /** Feather blend radius for patch_clone. Ignored for telea/ns/freq_sep. */
  featherPx: number;
  /** Image-space rects safe to sample fill content from. */
  sourceRegions: InpaintRegion[];
  /** Image-space rects the executor must NOT sample from. */
  avoidRegions: InpaintRegion[];
  /** Run a freq-sep skin smooth as a post-pass (skin blemish use only). */
  postFreqSepSkin: boolean;
  warnings: string[];
  rationale: string;
}

export type SuggestInpaintError = SuggestError;

export type SuggestInpaintResult =
  | {
      ok: true;
      recipe: InpaintRecipeRecommendation;
      usage: SuggestUsage;
    }
  | { ok: false; error: SuggestInpaintError; detail?: string };

export interface SuggestInpaintInput {
  imageBase64: string;
  imageMime: 'image/jpeg' | 'image/png' | 'image/webp';
  /** PNG-encoded base64 mask, same dimensions as the image, white = remove. */
  maskPngBase64: string;
  /** Image dimensions so Claude can validate sourceRegions are in-bounds. */
  width: number;
  height: number;
}

// Stable system prompt — sits above the 4,096-token prefix-cache threshold so
// repeated planner calls in the same session pay the cache-write cost once.
// The tone matches the portrait-recipe planner: terse, decisive, no
// pleasantries.
const INPAINT_SYSTEM_PROMPT = `You are the planner for the CreatorHub photo enhancer's object-removal feature. A photographer has painted a mask over something they want removed from the image. Your job is to look at the image AND the mask and call plan_inpaint with the executor instructions.

You do NOT paint pixels. You decide HOW a deterministic executor (OpenCV Telea/NS inpainting, patch-clone with feathered blend, optional frequency-separation skin smooth) should fill the masked region.

===== PRIMARY USE CASE =====

This feature is built for STUDIO SHOOT cleanup: stray lighting equipment that ended up in frame against a controlled backdrop. The masked object is almost always one of:

- A strobe head, beauty dish, softbox, or modifier poking into the frame edge.
- A light stand (vertical pole, often with a tripod base).
- A power cable, sync cable, extension cord on the floor or hanging in shot.
- A boom arm, C-stand arm, sandbag, or gaffer-taped clip on the backdrop.
- Sensor dust, lens spots, or stray hair on a clean studio backdrop.

The backdrop is usually one of: seamless paper (smooth gradient or even tone), a painted wall, a controlled set surface (table, floor cyc, marble, wood). It is RARELY a complex outdoor scene with foliage or crowds.

If the image is clearly NOT a studio shoot — outdoor portrait, landscape, food on a busy table — the same strategies still apply, but be more conservative with patch_clone (fewer good donor patches) and lean on telea/ns for small defects.

===== STRATEGY GUIDE =====

Pick exactly one strategy. The executor runs only that one.

patch_clone — copy from sourceRegions and feather-blend over the mask. THIS IS THE PRIMARY STRATEGY for studio shoots: when the mask sits against a backdrop area that has a clean equivalent nearby (same wall, same paper, same floor), copy from there. Specify 1–4 sourceRegions in image pixels, each large enough to cover the mask with a feather margin. Use this whenever a clean donor patch exists.

telea — OpenCV INPAINT_TELEA (fast marching). Good for SMALL ROUND defects: sensor dust, water spots, lens flecks, small skin pores when freq_sep is overkill. Set radiusPx between 3 and 12. Bad for long thin objects (cables) — it will blur into a smear.

ns — OpenCV INPAINT_NS (Navier-Stokes). Marginally better than telea on textured surfaces with linear structure (wood grain, brick lines). Same radius range. Use only when the surface has clear directional texture that telea would visibly disrupt.

freq_sep — frequency-separated skin heal. ONLY for skin blemishes on visible skin (face, neck, hands). Never use this for non-skin objects. The executor handles skin texture preservation; you just signal that this is a skin region.

===== sourceRegions / avoidRegions =====

sourceRegions are image-pixel rects {x, y, w, h} the executor may sample fill content from. Required for patch_clone, optional for telea/ns (you can hint nearby texture), unused for freq_sep.

avoidRegions are image-pixel rects the executor must NEVER sample from: subject's face/body, signage with readable text, brand logos, anything semantically distinct from the masked region. The executor uses these as hard exclusions.

Both arrays cap at 8 entries. All coordinates must be within image dimensions (you'll be told width/height).

===== featherPx and radiusPx =====

featherPx — gaussian feather radius for patch_clone blend, in pixels. 8–32 typical. Larger for smooth backdrops, smaller for textured surfaces with high-frequency detail at the seam.

radiusPx — OpenCV inpaint radius for telea/ns. 3–12 typical. Match the typical defect size.

===== warnings =====

Surface anything the photographer should know before accepting the result. Up to 4 short strings. Examples that warrant a warning:

- "Masken krysser en hard kant — vurder å re-brushe så masken stopper langs kanten."
- "Ingen ren donor-patch funnet i nærheten — resultatet kan vise gjentakelse."
- "Backdroppen har gradient — feather-blend kan bli synlig hvis du ser nøye."
- "Masken berører hud — vurder freq_sep i stedet for patch_clone."

===== rationale =====

One to three sentences in Norwegian explaining the strategy choice. Max 400 chars. Be concrete: "Kabel mot grå seamless. patch_clone fra venstre-oven hvor papiret er rent, feather 16px for myk overgang." Not: "I will inpaint this for you."

===== OUTPUT =====

You MUST call plan_inpaint exactly once. Never return plain text. Never apologise. Never hedge with "I'll try". Every field is required.`;

const INPAINT_TOOL = {
  name: 'plan_inpaint',
  description:
    'Plan how the deterministic inpaint executor should fill the photographer-painted mask region. Returns strategy + source/avoid rects + blend parameters + warnings.',
  input_schema: {
    type: 'object' as const,
    properties: {
      strategy: {
        type: 'string' as const,
        enum: ['telea', 'ns', 'patch_clone', 'freq_sep'],
        description:
          'Fill strategy. patch_clone is the primary studio-shoot path. telea/ns for small round defects. freq_sep ONLY for skin blemishes.',
      },
      radiusPx: {
        type: 'number' as const,
        minimum: 0,
        maximum: 64,
        description:
          'OpenCV inpaint radius for telea/ns. 3–12 typical. Set to 0 for patch_clone / freq_sep.',
      },
      featherPx: {
        type: 'number' as const,
        minimum: 0,
        maximum: 128,
        description:
          'Feather blend radius for patch_clone. 8–32 typical. Set to 0 for other strategies.',
      },
      sourceRegions: {
        type: 'array' as const,
        maxItems: 8,
        items: {
          type: 'object' as const,
          properties: {
            x: { type: 'number' as const, minimum: 0 },
            y: { type: 'number' as const, minimum: 0 },
            w: { type: 'number' as const, minimum: 1 },
            h: { type: 'number' as const, minimum: 1 },
          },
          required: ['x', 'y', 'w', 'h'],
        },
        description:
          'Image-pixel rects safe to sample fill content from. Required for patch_clone, optional hints for telea/ns, leave empty for freq_sep.',
      },
      avoidRegions: {
        type: 'array' as const,
        maxItems: 8,
        items: {
          type: 'object' as const,
          properties: {
            x: { type: 'number' as const, minimum: 0 },
            y: { type: 'number' as const, minimum: 0 },
            w: { type: 'number' as const, minimum: 1 },
            h: { type: 'number' as const, minimum: 1 },
          },
          required: ['x', 'y', 'w', 'h'],
        },
        description:
          'Image-pixel rects the executor must NOT sample from. Subjects, faces, text, logos, anything semantically distinct.',
      },
      postFreqSepSkin: {
        type: 'boolean' as const,
        description:
          'Run a frequency-separated skin smooth as a post-pass after the fill. true ONLY when the masked region is on visible skin and tone evening would help.',
      },
      warnings: {
        type: 'array' as const,
        maxItems: 4,
        items: { type: 'string' as const, maxLength: 200 },
        description:
          'Short warnings the photographer should see before accepting the result. Empty array if none.',
      },
      rationale: {
        type: 'string' as const,
        description:
          'One to three Norwegian sentences explaining the strategy choice. Max 400 chars.',
      },
    },
    required: [
      'strategy',
      'radiusPx',
      'featherPx',
      'sourceRegions',
      'avoidRegions',
      'postFreqSepSkin',
      'warnings',
      'rationale',
    ],
  },
};

function parseInpaintRegions(
  raw: unknown,
  width: number,
  height: number,
): InpaintRegion[] {
  if (!Array.isArray(raw)) return [];
  const out: InpaintRegion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const x = Math.round(clamp(r.x, 0, Math.max(0, width - 1)));
    const y = Math.round(clamp(r.y, 0, Math.max(0, height - 1)));
    const wMax = Math.max(1, width - x);
    const hMax = Math.max(1, height - y);
    const w = Math.round(clamp(r.w, 1, wMax, wMax));
    const h = Math.round(clamp(r.h, 1, hMax, hMax));
    out.push({ x, y, w, h });
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Defensive validation of the inpaint planner payload. Claude generally
 * stays in range given the schema, but we treat the value as untrusted —
 * clamp coordinates to image bounds, coerce unknown strategies to
 * patch_clone (the safe default for studio shoots), cap warning count and
 * length so a pathological response can't blow the UI.
 */
export function sanitiseInpaintRecipe(
  raw: unknown,
  width: number,
  height: number,
): InpaintRecipeRecommendation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const strategyRaw = typeof r.strategy === 'string' ? r.strategy : 'patch_clone';
  const strategy: InpaintStrategy = INPAINT_STRATEGIES.includes(
    strategyRaw as InpaintStrategy,
  )
    ? (strategyRaw as InpaintStrategy)
    : 'patch_clone';

  const warningsRaw = Array.isArray(r.warnings) ? r.warnings : [];
  const warnings = warningsRaw
    .filter((w): w is string => typeof w === 'string')
    .map((w) => w.slice(0, 200))
    .slice(0, 4);

  return {
    strategy,
    radiusPx: Math.round(clamp(r.radiusPx, 0, 64, 6)),
    featherPx: Math.round(clamp(r.featherPx, 0, 128, 16)),
    sourceRegions: parseInpaintRegions(r.sourceRegions, width, height),
    avoidRegions: parseInpaintRegions(r.avoidRegions, width, height),
    postFreqSepSkin: Boolean(r.postFreqSepSkin),
    warnings,
    rationale:
      typeof r.rationale === 'string' ? r.rationale.slice(0, 400) : '',
  };
}

export async function suggestInpaintRecipe(
  input: SuggestInpaintInput,
): Promise<SuggestInpaintResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'not_configured' };
  }
  if (!input.imageBase64 || input.imageBase64.length > MAX_IMAGE_BASE64_BYTES) {
    return { ok: false, error: 'image_too_large' };
  }
  if (!input.maskPngBase64 || input.maskPngBase64.length > MAX_IMAGE_BASE64_BYTES) {
    return { ok: false, error: 'image_too_large' };
  }
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height)) {
    return { ok: false, error: 'invalid_response', detail: 'bad dimensions' };
  }

  let client: any;
  try {
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 1,
      timeout: 25_000,
    });
  } catch (err) {
    return { ok: false, error: 'not_configured', detail: String(err) };
  }

  try {
    const response = await client.messages.create({
      model: process.env.PHOTO_ENHANCER_INPAINT_MODEL || 'claude-opus-4-7',
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: INPAINT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [INPAINT_TOOL],
      tool_choice: { type: 'tool', name: 'plan_inpaint' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: input.imageMime,
                data: input.imageBase64,
              },
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: input.maskPngBase64,
              },
            },
            {
              type: 'text',
              text: `Image is ${input.width}×${input.height} pixels. The second image is the mask — white pixels are what the photographer wants removed, black pixels stay. Plan the inpaint by calling plan_inpaint exactly once. All sourceRegions / avoidRegions must lie inside the image bounds.`,
            },
          ],
        },
      ],
    });
    logAIUsage(response as any, { feature: 'photo/plan-inpaint' }).catch(() => undefined);

    const toolUse = (response.content ?? []).find(
      (block: any) =>
        block?.type === 'tool_use' && block?.name === 'plan_inpaint',
    );
    if (!toolUse || typeof toolUse.input !== 'object') {
      return { ok: false, error: 'invalid_response', detail: 'no tool_use block' };
    }

    const recipe = sanitiseInpaintRecipe(toolUse.input, input.width, input.height);
    if (!recipe) {
      return { ok: false, error: 'invalid_response', detail: 'schema mismatch' };
    }

    return {
      ok: true,
      recipe,
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

// ============================================================================
// Auto-detect distractions.
//
// Different from suggestInpaintRecipe (which plans how to fill a mask the
// photographer painted) and suggestPortraitRecipe (which proposes slider
// values). This one runs FIRST — Claude looks at a fresh photo, finds
// stray studio equipment, and returns bbox-es. The photographer reviews
// each detection and ticks the ones to actually remove. Selected
// detections then collapse into a single combined mask that goes into
// the existing /inpaint endpoint.
//
// Why this matters: it's the prerequisite for the iPad Capture
// integration. The Capture app has no brush UI — it can only show the
// photographer "we found these distractions, remove them?" and act on
// the answer. Same auto-detect endpoint, different surface.
//
// Conservativism is a feature: false positives erode trust faster than
// missed detections. The system prompt enumerates exactly which object
// classes count, and a strict NEVER-list keeps Claude from suggesting
// to remove subjects, faces, scene architecture, or branded props.
// ============================================================================

export type DistractionType =
  | 'flash_strobe'
  | 'light_stand'
  | 'cable'
  | 'boom_arm'
  | 'tape_clip'
  | 'sensor_dust'
  | 'other_distraction';

const DISTRACTION_TYPES: readonly DistractionType[] = [
  'flash_strobe',
  'light_stand',
  'cable',
  'boom_arm',
  'tape_clip',
  'sensor_dust',
  'other_distraction',
] as const;

export interface DistractionDetection {
  /** Stable id assigned server-side so the UI can reference detections
   *  through the round-trip without relying on array index. */
  id: string;
  type: DistractionType;
  bbox: { x: number; y: number; w: number; h: number };
  /** [0, 1] — anything below MIN_DISTRACTION_CONFIDENCE is dropped before
   *  reaching the UI; what's surfaced is what Claude was reasonably sure
   *  about. */
  confidence: number;
  /** One-line Norwegian description shown to the photographer in the
   *  detection list, e.g. "Lys-kabel langs gulvet, høyre side". */
  description: string;
}

export interface DistractionAnalysis {
  detections: DistractionDetection[];
  rationale: string;
}

export type DetectDistractionsResult =
  | { ok: true; analysis: DistractionAnalysis; usage: SuggestUsage }
  | { ok: false; error: SuggestError; detail?: string };

export interface DetectDistractionsInput {
  imageBase64: string;
  imageMime: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
}

const MIN_DISTRACTION_CONFIDENCE = 0.55;
const MAX_DISTRACTIONS = 8;

const DETECT_SYSTEM_PROMPT = `You are the auto-detect pass for the CreatorHub photo enhancer's "Fjern objekter" feature. A photographer will see your output as a list of suggested removals — they tick the ones they want gone, then a separate inpainter erases them. Your job is to find STRAY STUDIO EQUIPMENT in the frame and return tight bbox-es for it.

Conservatism is a feature. The photographer's trust is destroyed by ONE false positive (a suggestion to remove something they wanted in the shot) far faster than it's eroded by ten missed detections. When in doubt, lower confidence or omit the detection entirely.

===== WHAT TO DETECT =====

Pick from this strict enum. Anything that doesn't fit a category goes in "other_distraction" with extra description detail.

- flash_strobe   — strobe head, beauty dish, softbox, octabox, modifier panel poking into the frame edge.
- light_stand    — vertical pole or tripod base supporting a light. Often dark, often at the bottom or side.
- cable          — power cable, sync cable, extension cord on the floor or hanging in shot. Usually thin and dark.
- boom_arm       — C-stand arm, boom arm, sandbag at the base of a stand.
- tape_clip      — gaffer tape, clips, clamps holding backdrop paper to a frame or wall.
- sensor_dust    — small dark spot from sensor dust or lens flecks. Usually round, < 30 pixels.
- other_distraction — anything else clearly stray that fits the spirit of the above (a stray water bottle, a forgotten hair clip on the floor, a battery on the table).

===== NEVER FLAG =====

These are off-limits regardless of how stray they look:

- People, faces, hands, hair, skin, clothing.
- Anything the subject is wearing, holding, or interacting with (jewelry, bouquet, prop, food, drink).
- Architectural features (windows, doors, columns, walls, ceilings, floor tiles, mouldings, beams). Even if a window looks "in the way", it's part of the scene — the photographer composed for it.
- Furniture in scene (tables, chairs, sofas, lamps as decor).
- Plants, foliage, decor, table settings, food on plates, books, art on walls.
- Logos, signage, text on subject's clothing.
- Shadows, reflections, lens flare. Those are lighting, not objects.

If you're uncertain whether something is a distraction or part of the scene, OMIT IT. The photographer can always paint a manual mask if you missed something — false positives are the unrecoverable error.

===== BBOX RULES =====

Coordinates are image-pixel space (you'll be told width and height). Each bbox must:

- Lie entirely inside image bounds (x ≥ 0, y ≥ 0, x+w ≤ width, y+h ≤ height).
- Be TIGHT to the object — don't pad with surrounding wall. The inpainter handles feather blending; oversized bbox-es eat into the surrounding wall texture and produce visible patches.
- Have w, h ≥ 4 px (anything smaller is sub-pixel noise, not a real object).

===== CONFIDENCE =====

[0.0, 1.0]. The UI hides anything below 0.55, so don't bother surfacing low-confidence guesses. The values you should actually use:

- 0.95+  — unambiguous: a clear strobe head poking into the frame, a thick power cable trailing across the floor.
- 0.80   — confident: a thin cable that could plausibly be something else, a stand mostly out of frame.
- 0.65   — plausible: a small dark patch that might be sensor dust, a tape strip that might be intentional.
- < 0.55 — don't include.

===== DESCRIPTION =====

One short Norwegian sentence per detection, max 80 chars. The photographer sees it next to a thumbnail crop, so be specific about WHERE: "Lys-kabel langs nederste kant", "Stativfot venstre side, 1/3 inn", "Strobe-modifier øverste høyre hjørne".

===== OUTPUT =====

Cap at 8 detections per image. If you genuinely don't see any studio equipment, return an empty array — that's the right answer for an outdoor shot, a cleanly-styled product flat-lay, or a photo where the photographer already cleared the set.

You MUST call detect_distractions exactly once. Never return plain text. Never apologise. Never hedge with "I'll try". Every field is required.`;

const DETECT_DISTRACTIONS_TOOL = {
  name: 'detect_distractions',
  description:
    'Find stray studio equipment in the photo (flash heads, cables, stands, modifiers, tape, sensor dust). Return tight bbox-es with confidence so the photographer can confirm which to remove.',
  input_schema: {
    type: 'object' as const,
    properties: {
      detections: {
        type: 'array' as const,
        maxItems: MAX_DISTRACTIONS,
        items: {
          type: 'object' as const,
          properties: {
            type: {
              type: 'string' as const,
              enum: [...DISTRACTION_TYPES],
            },
            bbox: {
              type: 'object' as const,
              properties: {
                x: { type: 'number' as const, minimum: 0 },
                y: { type: 'number' as const, minimum: 0 },
                w: { type: 'number' as const, minimum: 4 },
                h: { type: 'number' as const, minimum: 4 },
              },
              required: ['x', 'y', 'w', 'h'],
            },
            confidence: { type: 'number' as const, minimum: 0, maximum: 1 },
            description: { type: 'string' as const, maxLength: 120 },
          },
          required: ['type', 'bbox', 'confidence', 'description'],
        },
      },
      rationale: {
        type: 'string' as const,
        description:
          'One sentence in Norwegian summarising the scene and what you flagged (or why you flagged nothing). Max 300 chars.',
      },
    },
    required: ['detections', 'rationale'],
  },
};

export function sanitiseDistractions(
  raw: unknown,
  width: number,
  height: number,
): DistractionAnalysis {
  if (!raw || typeof raw !== 'object') {
    return { detections: [], rationale: '' };
  }
  const r = raw as Record<string, unknown>;
  const detectionsRaw = Array.isArray(r.detections) ? r.detections : [];

  const out: DistractionDetection[] = [];
  for (let i = 0; i < detectionsRaw.length && out.length < MAX_DISTRACTIONS; i++) {
    const d = detectionsRaw[i];
    if (!d || typeof d !== 'object') continue;
    const det = d as Record<string, unknown>;

    const typeRaw = typeof det.type === 'string' ? det.type : 'other_distraction';
    const type: DistractionType = DISTRACTION_TYPES.includes(typeRaw as DistractionType)
      ? (typeRaw as DistractionType)
      : 'other_distraction';

    const confidence = clamp(det.confidence, 0, 1, 0);
    if (confidence < MIN_DISTRACTION_CONFIDENCE) continue;

    const bboxRaw = (det.bbox ?? {}) as Record<string, unknown>;
    const x = Math.round(clamp(bboxRaw.x, 0, Math.max(0, width - 1)));
    const y = Math.round(clamp(bboxRaw.y, 0, Math.max(0, height - 1)));
    const wMax = Math.max(4, width - x);
    const hMax = Math.max(4, height - y);
    const w = Math.round(clamp(bboxRaw.w, 4, wMax, wMax));
    const h = Math.round(clamp(bboxRaw.h, 4, hMax, hMax));

    const description =
      typeof det.description === 'string' ? det.description.slice(0, 120) : '';

    out.push({
      id: `det-${i}-${type}-${x}-${y}`,
      type,
      bbox: { x, y, w, h },
      confidence,
      description,
    });
  }

  const rationale =
    typeof r.rationale === 'string' ? r.rationale.slice(0, 300) : '';

  return { detections: out, rationale };
}

export async function detectDistractions(
  input: DetectDistractionsInput,
): Promise<DetectDistractionsResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: 'not_configured' };
  }
  if (!input.imageBase64 || input.imageBase64.length > MAX_IMAGE_BASE64_BYTES) {
    return { ok: false, error: 'image_too_large' };
  }
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height)) {
    return { ok: false, error: 'invalid_response', detail: 'bad dimensions' };
  }

  let client: any;
  try {
    const mod: any = await import('@anthropic-ai/sdk');
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 1,
      timeout: 25_000,
    });
  } catch (err) {
    return { ok: false, error: 'not_configured', detail: String(err) };
  }

  try {
    const response = await client.messages.create({
      model: process.env.PHOTO_ENHANCER_DETECT_MODEL || 'claude-opus-4-7',
      max_tokens: 2000,
      system: [
        {
          type: 'text',
          text: DETECT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [DETECT_DISTRACTIONS_TOOL],
      tool_choice: { type: 'tool', name: 'detect_distractions' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: input.imageMime,
                data: input.imageBase64,
              },
            },
            {
              type: 'text',
              text: `Image is ${input.width}×${input.height} pixels. Find stray studio equipment in this photo. All bbox coordinates must lie inside the image. Call detect_distractions exactly once.`,
            },
          ],
        },
      ],
    });
    logAIUsage(response as any, { feature: 'photo/detect-distractions' }).catch(() => undefined);

    const toolUse = (response.content ?? []).find(
      (block: any) =>
        block?.type === 'tool_use' && block?.name === 'detect_distractions',
    );
    if (!toolUse || typeof toolUse.input !== 'object') {
      return { ok: false, error: 'invalid_response', detail: 'no tool_use block' };
    }

    const analysis = sanitiseDistractions(toolUse.input, input.width, input.height);

    return {
      ok: true,
      analysis,
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
