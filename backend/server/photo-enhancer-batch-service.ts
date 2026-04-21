/**
 * Batch recipe consolidation for gallery-level AI enhance.
 *
 * Why this exists:
 *   When a photographer points the enhancer at a 500-image wedding
 *   gallery, calling Claude Vision per image is expensive and, more
 *   importantly, produces *inconsistent* results across the gallery.
 *   Two frames 30 seconds apart should not receive wildly different
 *   slider values; a consistent gallery is how the client sees a
 *   coherent edit, not a collection of one-offs.
 *
 *   The plan (implemented here):
 *     1. Sample ~15–20 representative images from the gallery.
 *     2. Call Claude on each sample (the existing suggester).
 *     3. Consolidate the sample recipes into a single gallery recipe
 *        that everyone-file is enhanced with.
 *
 *   This module owns step 3. Step 1 (sampling) is a pure helper; step
 *   2 is orchestration code in the route that calls ``suggestPortraitRecipe``
 *   per sample and then feeds the array of recipes here.
 *
 * Aggregation strategy:
 *   - Numeric sliders: median across samples (robust to outliers
 *     compared to mean; a single misclassified frame can't skew the
 *     gallery recipe).
 *   - Profile strings: mode (most common); ties go to ``normal`` as
 *     the safe default.
 *   - Subject: mode across samples. The consolidated subject is the
 *     gallery's dominant category.
 *   - Confidence: minimum across samples. If any sample was a low-
 *     confidence guess, the gallery recipe inherits that caution.
 *
 * Outlier rejection:
 *   After taking the median we compute the sample MAD (median absolute
 *   deviation). Samples whose per-slider value is > 3 × MAD from the
 *   median are considered outliers. If > 30% of samples are outliers
 *   on a given slider we consider the cohort too diverse for that
 *   slider and fall back to the preset default on the *consolidated*
 *   recipe (tells the caller "don't trust this one").
 */
import type {
  HslRecommendation,
  IntensityProfile,
  PortraitAnalysisSummary,
  PortraitRecipeRecommendation,
  SubjectKind,
} from "./photo-enhancer-claude-vision.js";

const HSL_BANDS = [
  "red",
  "orange",
  "yellow",
  "green",
  "aqua",
  "blue",
  "purple",
  "magenta",
] as const satisfies ReadonlyArray<keyof HslRecommendation>;

const HSL_IDENTITY_AGG: HslRecommendation = {
  red: { h: 0, s: 0, l: 0 },
  orange: { h: 0, s: 0, l: 0 },
  yellow: { h: 0, s: 0, l: 0 },
  green: { h: 0, s: 0, l: 0 },
  aqua: { h: 0, s: 0, l: 0 },
  blue: { h: 0, s: 0, l: 0 },
  purple: { h: 0, s: 0, l: 0 },
  magenta: { h: 0, s: 0, l: 0 },
};

type LutSample = NonNullable<PortraitRecipeRecommendation["lut"]>;

const LUT_AGG_IDENTITY: LutSample = {
  name: null,
  strength: 0,
  tonalMix: "all",
};

const LUT_TONAL_MIX_OPTIONS = [
  "all",
  "highlights",
  "midtones",
  "shadows",
] as const;

function consolidateLut(samples: ReadonlyArray<SampleRecipe>): {
  lut: LutSample;
  lowConfidence: boolean;
} {
  const named = samples
    .map((s) => s.recipe.lut)
    .filter((l): l is LutSample => Boolean(l && l.name));
  if (named.length === 0) {
    return { lut: { ...LUT_AGG_IDENTITY }, lowConfidence: false };
  }
  const counts = new Map<string, number>();
  for (const l of named) {
    if (l.name) counts.set(l.name, (counts.get(l.name) ?? 0) + 1);
  }
  let topName: string | null = null;
  let topCount = 0;
  for (const [name, count] of counts) {
    if (count > topCount) {
      topName = name;
      topCount = count;
    }
  }
  const agreement = topCount / samples.length;
  if (!topName || agreement < 0.5) {
    return { lut: { ...LUT_AGG_IDENTITY }, lowConfidence: true };
  }
  const matchingStrengths = named
    .filter((l) => l.name === topName)
    .map((l) => Number(l.strength))
    .filter((v) => Number.isFinite(v));
  const matchingTonal = named
    .filter((l) => l.name === topName)
    .map((l) => (LUT_TONAL_MIX_OPTIONS as readonly string[]).includes(String(l.tonalMix))
      ? (l.tonalMix as LutSample["tonalMix"])
      : "all");
  const tonalCounts = new Map<string, number>();
  for (const t of matchingTonal) tonalCounts.set(t, (tonalCounts.get(t) ?? 0) + 1);
  let topTonal: LutSample["tonalMix"] = "all";
  let topTonalCount = 0;
  for (const [t, c] of tonalCounts) {
    if (c > topTonalCount) {
      topTonal = t as LutSample["tonalMix"];
      topTonalCount = c;
    }
  }
  return {
    lut: {
      name: topName,
      strength: Math.round(median(matchingStrengths)),
      tonalMix: topTonal,
    },
    lowConfidence: false,
  };
}

/** Per-band/per-channel median of HSL across samples. Divergence guard
 *  falls back to identity for a band when the cohort disagrees — a
 *  visible colour cast on only half a gallery usually indicates mixed
 *  lighting, and the safer move is to leave that band alone. */
function consolidateHsl(samples: ReadonlyArray<SampleRecipe>): {
  hsl: HslRecommendation;
  lowConfidenceBands: string[];
} {
  const low: string[] = [];
  const out: HslRecommendation = {
    red: { h: 0, s: 0, l: 0 },
    orange: { h: 0, s: 0, l: 0 },
    yellow: { h: 0, s: 0, l: 0 },
    green: { h: 0, s: 0, l: 0 },
    aqua: { h: 0, s: 0, l: 0 },
    blue: { h: 0, s: 0, l: 0 },
    purple: { h: 0, s: 0, l: 0 },
    magenta: { h: 0, s: 0, l: 0 },
  };
  for (const band of HSL_BANDS) {
    for (const channel of ["h", "s", "l"] as const) {
      const values = samples
        .map((s) => Number(s.recipe.hsl?.[band]?.[channel]))
        .filter((v) => Number.isFinite(v));
      if (values.length === 0) continue;
      const med = median(values);
      const deviation = mad(values, med);
      const outliers = deviation > 0
        ? values.filter((v) => Math.abs(v - med) > 3 * deviation).length
        : 0;
      const farFromMedian = values.filter((v) => Math.abs(v - med) > 20).length;
      const divergent =
        outliers / values.length > 0.3 || farFromMedian / values.length > 0.3;
      if (divergent) {
        low.push(`hsl.${band}.${channel}`);
        continue;
      }
      out[band][channel] = Math.round(med);
    }
  }
  return { hsl: out, lowConfidenceBands: low };
}

const NUMERIC_KEYS = [
  "brightness",
  "contrast",
  "saturation",
  "sharpness",
  "denoising",
  "faceEnhancement",
  "skinTextureGuard",
  "blemishRemoval",
  "teethWhiteness",
  "eyeBrightness",
  "eyeWhiteness",
] as const satisfies ReadonlyArray<keyof PortraitRecipeRecommendation>;

const PROFILE_KEYS = [
  "blemishProfile",
  "teethProfile",
  "eyeBrightnessProfile",
  "eyeWhitenessProfile",
] as const satisfies ReadonlyArray<keyof PortraitRecipeRecommendation>;

const PROFILE_DEFAULT: IntensityProfile = "normal";

// Conservative defaults used when the cohort is too divergent for a
// slider — matches the web-side `defaultSettings` table reasonably.
const SAFE_DEFAULTS: Pick<PortraitRecipeRecommendation, (typeof NUMERIC_KEYS)[number]> = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  denoising: 50,
  faceEnhancement: 0,
  skinTextureGuard: 70,
  blemishRemoval: 0,
  teethWhiteness: 0,
  eyeBrightness: 0,
  eyeWhiteness: 0,
};

export interface SampleRecipe {
  recipe: PortraitRecipeRecommendation;
  analysis: PortraitAnalysisSummary;
}

export interface ConsolidatedGalleryRecipe {
  recipe: PortraitRecipeRecommendation;
  /// Which sliders we fell back to the safe default on because the
  /// cohort was too divergent — surfaced so the UI can warn the
  /// photographer "this gallery's look varies a lot, dial these in
  /// manually" rather than silently deliver a mediocre edit.
  lowConfidenceSliders: string[];
  /// Subject that won the mode vote across samples.
  subject: SubjectKind;
  /// Minimum per-sample confidence — the worst guess in the cohort.
  /// The UI should treat this as the gallery's trust level.
  minConfidence: number;
  /// Fraction of samples classified with the winning subject. Low
  /// agreement means the gallery is actually mixed (e.g. wedding
  /// ceremony + candid food shots in the same folder).
  subjectAgreement: number;
}


function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function mad(values: number[], med: number): number {
  if (values.length === 0) return 0;
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations);
}

function mode<T extends string>(values: T[], tiebreaker: T): T {
  if (values.length === 0) return tiebreaker;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  // Find the top count, then collect every value at that count. If
  // more than one value is tied at the top we fall back to the
  // ``tiebreaker`` (safe default) so a 50/50 split between subtle and
  // strong produces ``normal`` — we don't pick a winner by Map
  // insertion order.
  let maxCount = 0;
  for (const count of counts.values()) {
    if (count > maxCount) maxCount = count;
  }
  const modes: T[] = [];
  for (const [v, count] of counts) {
    if (count === maxCount) modes.push(v);
  }
  if (modes.length === 1) return modes[0]!;
  return tiebreaker;
}

function modeCount<T extends string>(values: T[]): { mode: T | null; count: number } {
  if (values.length === 0) return { mode: null, count: 0 };
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let bestMode: T | null = null;
  let bestCount = 0;
  for (const [v, count] of counts) {
    if (count > bestCount) {
      bestMode = v;
      bestCount = count;
    }
  }
  return { mode: bestMode, count: bestCount };
}

/**
 * Stratified sample picker. Given ``n`` items, return up to
 * ``sampleSize`` indices spread evenly through the list so the sample
 * covers early / middle / late frames rather than clustering. When
 * ``sampleSize >= n`` we return everything.
 */
export function pickSampleIndices(n: number, sampleSize: number): number[] {
  if (n <= 0) return [];
  const target = Math.max(1, Math.min(sampleSize, n));
  if (target >= n) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (target - 1);
  const indices: number[] = [];
  for (let i = 0; i < target; i++) {
    indices.push(Math.round(i * step));
  }
  // Deduplicate (possible at small n with rounding) while preserving
  // order.
  return Array.from(new Set(indices));
}


export function consolidateRecipes(
  samples: ReadonlyArray<SampleRecipe>,
): ConsolidatedGalleryRecipe {
  if (samples.length === 0) {
    throw new Error("consolidateRecipes: at least one sample required");
  }
  const lowConfidenceSliders: string[] = [];

  // Numeric aggregation: median, plus two independent divergence
  // checks that together flag cohorts where the cross-gallery recipe
  // can't be trusted. We emit a fallback whenever *either* check
  // fires so a bimodal distribution (e.g. half "no retouch", half
  // "heavy retouch") is always caught:
  //
  //   1. MAD-based outlier count — single-outlier style distributions
  //      where one frame is wildly off. Gate: >30% of samples more
  //      than 3×MAD from the median.
  //   2. Fraction-beyond-threshold — bimodal distributions where MAD
  //      itself is large (big gap between clusters), making the 3×MAD
  //      threshold meaningless. Gate: >30% of samples more than 20
  //      slider units from the median.
  const numericOut: Partial<Record<(typeof NUMERIC_KEYS)[number], number>> = {};
  for (const key of NUMERIC_KEYS) {
    const values = samples.map((s) => Number(s.recipe[key])).filter((v) => Number.isFinite(v));
    if (values.length === 0) {
      numericOut[key] = SAFE_DEFAULTS[key];
      lowConfidenceSliders.push(key);
      continue;
    }
    const med = median(values);
    const deviation = mad(values, med);

    const madOutliers = deviation > 0
      ? values.filter((v) => Math.abs(v - med) > 3 * deviation).length
      : 0;
    const farFromMedian = values.filter((v) => Math.abs(v - med) > 20).length;
    const divergent =
      madOutliers / values.length > 0.3 || farFromMedian / values.length > 0.3;

    if (divergent) {
      numericOut[key] = SAFE_DEFAULTS[key];
      lowConfidenceSliders.push(key);
      continue;
    }
    numericOut[key] = Math.round(med);
  }

  // Profile aggregation: mode, defaulting to "normal" on ties.
  const profileOut: Partial<Record<(typeof PROFILE_KEYS)[number], IntensityProfile>> = {};
  for (const key of PROFILE_KEYS) {
    const values = samples
      .map((s) => s.recipe[key])
      .filter((v): v is IntensityProfile =>
        v === "subtle" || v === "normal" || v === "strong",
      );
    profileOut[key] = mode(values, PROFILE_DEFAULT);
  }

  // Subject: mode across the sample classifications.
  const subjectValues = samples.map((s) => s.analysis.subject);
  const subjectModeRaw = modeCount(subjectValues);
  const subject: SubjectKind = (subjectModeRaw.mode ?? "other") as SubjectKind;
  const subjectAgreement = subjectModeRaw.count / samples.length;

  // Min confidence — don't let a high-confidence majority mask a
  // low-confidence minority.
  const minConfidence = samples.reduce(
    (min, s) => Math.min(min, s.analysis.confidence),
    1,
  );

  // Build the final recipe. Non-portrait subjects still get the
  // portrait-only sliders zeroed (mirrors the sanitiseSuggestion
  // safety net in photo-enhancer-claude-vision).
  const recipe: PortraitRecipeRecommendation = {
    brightness: numericOut.brightness ?? 0,
    contrast: numericOut.contrast ?? 0,
    saturation: numericOut.saturation ?? 0,
    sharpness: numericOut.sharpness ?? 0,
    denoising: numericOut.denoising ?? 50,
    faceEnhancement: numericOut.faceEnhancement ?? 0,
    skinTextureGuard: numericOut.skinTextureGuard ?? 70,
    blemishRemoval: numericOut.blemishRemoval ?? 0,
    teethWhiteness: numericOut.teethWhiteness ?? 0,
    eyeBrightness: numericOut.eyeBrightness ?? 0,
    eyeWhiteness: numericOut.eyeWhiteness ?? 0,
    blemishProfile: profileOut.blemishProfile ?? PROFILE_DEFAULT,
    teethProfile: profileOut.teethProfile ?? PROFILE_DEFAULT,
    eyeBrightnessProfile: profileOut.eyeBrightnessProfile ?? PROFILE_DEFAULT,
    eyeWhitenessProfile: profileOut.eyeWhitenessProfile ?? PROFILE_DEFAULT,
    hsl: { ...HSL_IDENTITY_AGG },
    lut: { ...LUT_AGG_IDENTITY },
  };

  const hslAgg = consolidateHsl(samples);
  recipe.hsl = hslAgg.hsl;
  for (const key of hslAgg.lowConfidenceBands) lowConfidenceSliders.push(key);

  // LUT consolidation: mode on the slug, median on strength, mode on
  // tonalMix. If <50% of samples agree on the slug, we abandon the LUT
  // selection — a mixed-look gallery is usually better off without a
  // forced LUT than with the wrong one half the time.
  const lutAgg = consolidateLut(samples);
  recipe.lut = lutAgg.lut;
  if (lutAgg.lowConfidence) lowConfidenceSliders.push("lut");

  const isPortraitLike = subject === "portrait" || subject === "group_portrait";
  if (!isPortraitLike) {
    recipe.faceEnhancement = 0;
    recipe.skinTextureGuard = 70;
    recipe.blemishRemoval = 0;
    recipe.teethWhiteness = 0;
    recipe.eyeBrightness = 0;
    recipe.eyeWhiteness = 0;
    recipe.blemishProfile = "normal";
    recipe.teethProfile = "normal";
    recipe.eyeBrightnessProfile = "normal";
    recipe.eyeWhitenessProfile = "normal";
  }

  return {
    recipe,
    lowConfidenceSliders,
    subject,
    minConfidence,
    subjectAgreement,
  };
}
