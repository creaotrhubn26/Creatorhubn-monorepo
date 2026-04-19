/**
 * Tests for the batch recipe consolidator.
 *
 * All tests operate on synthetic SampleRecipe arrays so the suite does
 * not depend on Claude. The goal is to verify:
 *   - Median aggregation: a single outlier sample can't skew the gallery.
 *   - MAD outlier rejection: when >30% of samples strongly disagree on
 *     a slider, we fall back to safe default and flag the slider as
 *     low-confidence so the UI can surface the caveat.
 *   - Subject mode wins, agreement fraction reported honestly.
 *   - Min confidence is propagated (cautious reading).
 *   - Non-portrait subjects have portrait-only sliders zeroed server-side.
 *   - Profile mode with tiebreaker to "normal".
 *   - Stratified sampling indices spread evenly.
 */
import { describe, expect, it } from 'vitest';
import {
  consolidateRecipes,
  pickSampleIndices,
  type SampleRecipe,
} from './photo-enhancer-batch-service.js';
import type {
  PortraitRecipeRecommendation,
  SubjectKind,
} from './photo-enhancer-claude-vision.js';

function makeSample(
  overrides: Partial<PortraitRecipeRecommendation> = {},
  subject: SubjectKind = 'portrait',
  confidence = 0.8,
): SampleRecipe {
  const recipe: PortraitRecipeRecommendation = {
    brightness: 0,
    contrast: 6,
    saturation: 4,
    sharpness: 12,
    denoising: 40,
    faceEnhancement: 50,
    skinTextureGuard: 70,
    blemishRemoval: 30,
    teethWhiteness: 25,
    eyeBrightness: 15,
    eyeWhiteness: 10,
    blemishProfile: 'normal',
    teethProfile: 'normal',
    eyeBrightnessProfile: 'normal',
    eyeWhitenessProfile: 'normal',
    ...overrides,
  };
  return {
    recipe,
    analysis: {
      subject,
      confidence,
      rationale: 'test',
      observations: [],
    },
  };
}


describe('pickSampleIndices', () => {
  it('returns all when sampleSize >= n', () => {
    expect(pickSampleIndices(5, 20)).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns empty for n=0', () => {
    expect(pickSampleIndices(0, 5)).toEqual([]);
  });

  it('spreads evenly across the range', () => {
    const idx = pickSampleIndices(100, 5);
    // First and last indices always present so the sample covers the
    // edges of the gallery (important for stratification across
    // lighting changes over time).
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(99);
    // Should include at least 3 distinct interior positions.
    expect(idx.length).toBe(5);
  });

  it('deduplicates when rounding collides', () => {
    // 2 samples from 3 items → indices 0 and 2, no dupes.
    expect(pickSampleIndices(3, 2)).toEqual([0, 2]);
  });
});


describe('consolidateRecipes', () => {
  it('throws on empty samples (caller bug, not user error)', () => {
    expect(() => consolidateRecipes([])).toThrow();
  });

  it('takes median of numeric sliders', () => {
    const samples = [
      makeSample({ teethWhiteness: 20 }),
      makeSample({ teethWhiteness: 30 }),
      makeSample({ teethWhiteness: 40 }),
    ];
    const { recipe } = consolidateRecipes(samples);
    expect(recipe.teethWhiteness).toBe(30);
  });

  it('resists a single outlier via median (unlike mean)', () => {
    // 4 samples agree at ~25, one is 95 (a misclassified glamour
    // shot). Median gives us 25, mean would have given 39.
    const samples = [
      makeSample({ teethWhiteness: 22 }),
      makeSample({ teethWhiteness: 25 }),
      makeSample({ teethWhiteness: 27 }),
      makeSample({ teethWhiteness: 24 }),
      makeSample({ teethWhiteness: 95 }),
    ];
    const { recipe } = consolidateRecipes(samples);
    // MAD outlier rejection should flag 95, consolidated value stays
    // safe. With MAD-outlier-detection, one outlier out of five is
    // 20% — under the 30% fallback threshold — so the median wins.
    expect(recipe.teethWhiteness).toBe(25);
  });

  it('falls back to safe default when >30% disagree strongly', () => {
    // Half the cohort says "heavy retouch" and half says "no retouch".
    // MAD will flag half the samples as outliers → fall back.
    const samples = [
      makeSample({ blemishRemoval: 0 }),
      makeSample({ blemishRemoval: 0 }),
      makeSample({ blemishRemoval: 0 }),
      makeSample({ blemishRemoval: 80 }),
      makeSample({ blemishRemoval: 85 }),
      makeSample({ blemishRemoval: 90 }),
    ];
    const { recipe, lowConfidenceSliders } = consolidateRecipes(samples);
    expect(lowConfidenceSliders).toContain('blemishRemoval');
    // Safe default for blemishRemoval is 0.
    expect(recipe.blemishRemoval).toBe(0);
  });

  it('picks profile by mode, ties go to normal', () => {
    const samples = [
      makeSample({ blemishProfile: 'strong' }),
      makeSample({ blemishProfile: 'strong' }),
      makeSample({ blemishProfile: 'subtle' }),
      makeSample({ blemishProfile: 'normal' }),
    ];
    const { recipe } = consolidateRecipes(samples);
    expect(recipe.blemishProfile).toBe('strong');
  });

  it('defaults profile to normal when tied', () => {
    const samples = [
      makeSample({ teethProfile: 'strong' }),
      makeSample({ teethProfile: 'subtle' }),
    ];
    const { recipe } = consolidateRecipes(samples);
    // 1-1 tie — the tiebreaker is "normal" so neither side wins.
    expect(recipe.teethProfile).toBe('normal');
  });

  it('reports subject by mode + agreement fraction', () => {
    const samples = [
      makeSample({}, 'portrait'),
      makeSample({}, 'portrait'),
      makeSample({}, 'portrait'),
      makeSample({}, 'food'),
    ];
    const { subject, subjectAgreement } = consolidateRecipes(samples);
    expect(subject).toBe('portrait');
    expect(subjectAgreement).toBeCloseTo(0.75);
  });

  it('reports min confidence (not mean or max)', () => {
    const samples = [
      makeSample({}, 'portrait', 0.95),
      makeSample({}, 'portrait', 0.30),    // low-confidence sample
      makeSample({}, 'portrait', 0.80),
    ];
    const { minConfidence } = consolidateRecipes(samples);
    expect(minConfidence).toBeCloseTo(0.30);
  });

  it('zeroes portrait sliders when consolidated subject is non-portrait', () => {
    // Even if individual samples had portrait recipes, a food-dominant
    // cohort must produce a recipe with zero teeth-whitening. The
    // consolidator enforces this the same way sanitiseSuggestion does.
    const samples = [
      makeSample({ teethWhiteness: 50, blemishRemoval: 60 }, 'food'),
      makeSample({ teethWhiteness: 50, blemishRemoval: 60 }, 'food'),
      makeSample({ teethWhiteness: 50, blemishRemoval: 60 }, 'food'),
      makeSample({ teethWhiteness: 50, blemishRemoval: 60 }, 'portrait'),
    ];
    const { recipe, subject } = consolidateRecipes(samples);
    expect(subject).toBe('food');
    expect(recipe.teethWhiteness).toBe(0);
    expect(recipe.blemishRemoval).toBe(0);
    expect(recipe.faceEnhancement).toBe(0);
  });

  it('preserves portrait sliders for group_portrait majority', () => {
    const samples = [
      makeSample({ blemishRemoval: 40 }, 'group_portrait'),
      makeSample({ blemishRemoval: 42 }, 'group_portrait'),
      makeSample({ blemishRemoval: 38 }, 'group_portrait'),
    ];
    const { recipe, subject } = consolidateRecipes(samples);
    expect(subject).toBe('group_portrait');
    expect(recipe.blemishRemoval).toBe(40);   // median of 38/40/42
  });

  it('flags every slider when sample is a single broken recipe', () => {
    // All fields present but every numeric is NaN/non-finite — the
    // consolidator should fall back gracefully.
    const broken: SampleRecipe = {
      recipe: {
        brightness: Number.NaN as unknown as number,
        contrast: Number.NaN as unknown as number,
        saturation: Number.NaN as unknown as number,
        sharpness: Number.NaN as unknown as number,
        denoising: Number.NaN as unknown as number,
        faceEnhancement: Number.NaN as unknown as number,
        skinTextureGuard: Number.NaN as unknown as number,
        blemishRemoval: Number.NaN as unknown as number,
        teethWhiteness: Number.NaN as unknown as number,
        eyeBrightness: Number.NaN as unknown as number,
        eyeWhiteness: Number.NaN as unknown as number,
        blemishProfile: 'normal',
        teethProfile: 'normal',
        eyeBrightnessProfile: 'normal',
        eyeWhitenessProfile: 'normal',
      },
      analysis: {
        subject: 'portrait',
        confidence: 0.1,
        rationale: '',
        observations: [],
      },
    };
    const { recipe, lowConfidenceSliders } = consolidateRecipes([broken]);
    // Every numeric slider falls back to safe default.
    expect(lowConfidenceSliders.length).toBeGreaterThan(5);
    expect(recipe.brightness).toBe(0);
    expect(recipe.denoising).toBe(50);
  });
});
