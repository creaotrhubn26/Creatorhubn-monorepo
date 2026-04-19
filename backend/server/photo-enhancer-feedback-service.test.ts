/**
 * Tests for the photo-enhancer recipe-feedback service.
 *
 * All tests hit the pure-function surface (diffRecipes, summariseDiffs)
 * — the DB-backed helpers (logRecipeFeedback, aggregateUserRecipePreferences)
 * are verified indirectly by constructing the same inputs summariseDiffs
 * would see after a DB round-trip.
 *
 * The goal of these tests is to verify:
 *   - Diff ignores noise (<2 unit changes) so the AI learns from real
 *     overrides, not photographer slider fidgeting.
 *   - Aggregation requires at least 3 samples before emitting a signal
 *     — single outliers don't colour the prompt.
 *   - Mean numeric drift under 5 slider units is suppressed (inside
 *     photographer noise, not a systematic preference).
 *   - Profile mode is picked, with a minimum-occurrence gate.
 */
import { describe, expect, it } from 'vitest';
import {
  diffRecipes,
  summariseDiffs,
  type PhotoEnhancerRecipe,
} from './photo-enhancer-feedback-service.js';

const BASELINE: PhotoEnhancerRecipe = {
  brightness: 0,
  contrast: 5,
  saturation: 3,
  sharpness: 10,
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
  subject: 'portrait',
  subjectLookStrength: 0,
};

describe('diffRecipes', () => {
  it('returns empty diff for identical recipes', () => {
    const diff = diffRecipes(BASELINE, BASELINE);
    expect(Object.keys(diff.numeric)).toHaveLength(0);
    expect(Object.keys(diff.profile)).toHaveLength(0);
  });

  it('captures meaningful numeric deltas only', () => {
    const final: PhotoEnhancerRecipe = { ...BASELINE, teethWhiteness: 40 };
    const { numeric } = diffRecipes(BASELINE, final);
    expect(numeric.teethWhiteness).toBe(15);
  });

  it('ignores fine-tuning below 2 slider units', () => {
    // A 1-unit nudge is the photographer micro-adjusting and shouldn't
    // corrupt the learned drift.
    const final: PhotoEnhancerRecipe = { ...BASELINE, contrast: 6, saturation: 4 };
    const { numeric } = diffRecipes(BASELINE, final);
    expect(numeric.contrast).toBeUndefined();
    expect(numeric.saturation).toBeUndefined();
  });

  it('captures profile changes', () => {
    const final: PhotoEnhancerRecipe = {
      ...BASELINE,
      blemishProfile: 'strong',
      teethProfile: 'subtle',
    };
    const { profile } = diffRecipes(BASELINE, final);
    expect(profile.blemishProfile).toBe('strong');
    expect(profile.teethProfile).toBe('subtle');
  });

  it('skips keys absent from either side', () => {
    // AI didn't suggest a subject; user kept it undefined. No diff.
    const suggested: PhotoEnhancerRecipe = { brightness: 5 };
    const final: PhotoEnhancerRecipe = { brightness: 15 };
    const { numeric } = diffRecipes(suggested, final);
    expect(numeric.brightness).toBe(10);
    expect(numeric.contrast).toBeUndefined();
  });

  it('ignores type-mismatched entries safely', () => {
    // Guards against a malformed recipe entering the pipeline — we
    // never want a string-vs-number crash to corrupt the feedback log.
    const suggested = { brightness: 'oops' as unknown as number };
    const final = { brightness: 10 };
    const { numeric } = diffRecipes(suggested as PhotoEnhancerRecipe, final);
    expect(numeric.brightness).toBeUndefined();
  });
});

describe('summariseDiffs', () => {
  it('returns empty string for no diffs', () => {
    expect(summariseDiffs([])).toBe('');
  });

  it('suppresses drift seen fewer than minOccurrences times', () => {
    // Only 2 samples of teethWhiteness drift — below the default 3.
    const diffs = [
      { numeric: { teethWhiteness: 12 }, profile: {} },
      { numeric: { teethWhiteness: 10 }, profile: {} },
    ];
    expect(summariseDiffs(diffs)).toBe('');
  });

  it('emits drift when seen ≥ 3 times with mean >= 5', () => {
    const diffs = [
      { numeric: { teethWhiteness: 12 }, profile: {} },
      { numeric: { teethWhiteness: 10 }, profile: {} },
      { numeric: { teethWhiteness: 8 }, profile: {} },
    ];
    const summary = summariseDiffs(diffs);
    expect(summary).toContain('teethWhiteness');
    expect(summary).toContain('+10');   // mean = 10
    expect(summary).toContain('3 samples');
  });

  it('suppresses drift below 5 units even when sample count met', () => {
    // 3 samples but mean is only 3 units — inside noise.
    const diffs = [
      { numeric: { saturation: 3 }, profile: {} },
      { numeric: { saturation: 4 }, profile: {} },
      { numeric: { saturation: 2 }, profile: {} },
    ];
    expect(summariseDiffs(diffs)).toBe('');
  });

  it('reports negative drift direction', () => {
    const diffs = [
      { numeric: { saturation: -8 }, profile: {} },
      { numeric: { saturation: -7 }, profile: {} },
      { numeric: { saturation: -9 }, profile: {} },
    ];
    const summary = summariseDiffs(diffs);
    expect(summary).toContain('saturation -8');
  });

  it('reports profile mode when observed ≥ minOccurrences', () => {
    const diffs = [
      { numeric: {}, profile: { blemishProfile: 'strong' } },
      { numeric: {}, profile: { blemishProfile: 'strong' } },
      { numeric: {}, profile: { blemishProfile: 'normal' } },
      { numeric: {}, profile: { blemishProfile: 'strong' } },
    ];
    const summary = summariseDiffs(diffs);
    expect(summary).toContain('blemishProfile=strong');
    expect(summary).toContain('3/4');
  });

  it('does NOT report profile mode when observed once', () => {
    const diffs = [
      { numeric: {}, profile: { blemishProfile: 'strong' } },
    ];
    const summary = summariseDiffs(diffs);
    expect(summary).not.toContain('blemishProfile');
  });

  it('combines numeric + profile findings', () => {
    const diffs = Array.from({ length: 5 }, () => ({
      numeric: { teethWhiteness: 15 },
      profile: { blemishProfile: 'strong' as const },
    }));
    const summary = summariseDiffs(diffs);
    expect(summary).toContain('teethWhiteness');
    expect(summary).toContain('blemishProfile=strong');
    // Semicolon-separated so it reads as a list in the Claude prompt.
    expect(summary).toContain(';');
  });

  it('accepts custom minOccurrences when caller wants stricter gate', () => {
    const diffs = Array.from({ length: 4 }, () => ({
      numeric: { teethWhiteness: 10 },
      profile: {},
    }));
    // At default 3: emitted. At 5: suppressed.
    expect(summariseDiffs(diffs)).toContain('teethWhiteness');
    expect(summariseDiffs(diffs, { minOccurrences: 5 })).toBe('');
  });

  it('clamps minOccurrences to a minimum of 3', () => {
    const diffs = [
      { numeric: { teethWhiteness: 10 }, profile: {} },
    ];
    // Caller asks for 1, but we never honour below 3 — a single
    // observation is not a preference, it's a coin flip.
    expect(summariseDiffs(diffs, { minOccurrences: 1 })).toBe('');
  });
});
