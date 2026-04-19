/**
 * Tests for the Claude Vision portrait recipe sanitiser.
 *
 * These hit the pure-function surface only (no Anthropic SDK calls, no
 * network). The goal is to verify that whatever Claude hands us — even
 * garbage — we come out with a safe, bounded recipe object.
 */
import { describe, expect, it } from 'vitest';
import { sanitiseSuggestion } from './photo-enhancer-claude-vision.js';

describe('sanitiseSuggestion', () => {
  it('returns null for non-objects', () => {
    expect(sanitiseSuggestion(null)).toBeNull();
    expect(sanitiseSuggestion('hello')).toBeNull();
    expect(sanitiseSuggestion(42)).toBeNull();
  });

  it('clamps every slider into its documented range', () => {
    const parsed = sanitiseSuggestion({
      subject: 'portrait',
      confidence: 0.8,
      rationale: 'x',
      observations: [],
      recipe: {
        brightness: 500,     // way above max
        contrast: -500,      // way below min
        saturation: 'abc',   // not a number
        sharpness: NaN,
        denoising: 150,
        faceEnhancement: -25,
        skinTextureGuard: 999,
        blemishRemoval: 70,
        teethWhiteness: 45,
        eyeBrightness: 33,
        eyeWhiteness: 20,
        blemishProfile: 'strong',
        teethProfile: 'subtle',
        eyeBrightnessProfile: 'normal',
        eyeWhitenessProfile: 'normal',
      },
    });
    expect(parsed).not.toBeNull();
    const { recipe } = parsed!;
    expect(recipe.brightness).toBe(100);
    expect(recipe.contrast).toBe(-100);
    expect(recipe.saturation).toBe(0);
    expect(recipe.sharpness).toBe(0);          // NaN → 0
    expect(recipe.denoising).toBe(100);
    expect(recipe.faceEnhancement).toBe(0);
    expect(recipe.skinTextureGuard).toBe(100);
  });

  it('normalises unknown / missing profiles to "normal"', () => {
    const parsed = sanitiseSuggestion({
      subject: 'portrait',
      confidence: 0.5,
      rationale: '',
      observations: [],
      recipe: {
        brightness: 0, contrast: 0, saturation: 0, sharpness: 0, denoising: 40,
        faceEnhancement: 50, skinTextureGuard: 70, blemishRemoval: 30,
        teethWhiteness: 20, eyeBrightness: 15, eyeWhiteness: 10,
        blemishProfile: 'EXTREME',     // unknown → normal
        teethProfile: 123,             // not a string → normal
        eyeBrightnessProfile: null,    // missing → normal
        // eyeWhitenessProfile absent entirely → normal
      },
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.recipe.blemishProfile).toBe('normal');
    expect(parsed!.recipe.teethProfile).toBe('normal');
    expect(parsed!.recipe.eyeBrightnessProfile).toBe('normal');
    expect(parsed!.recipe.eyeWhitenessProfile).toBe('normal');
  });

  it('accepts valid profile values case-insensitively and trimmed', () => {
    const parsed = sanitiseSuggestion({
      subject: 'portrait',
      confidence: 0.7,
      rationale: '',
      observations: [],
      recipe: {
        brightness: 0, contrast: 0, saturation: 0, sharpness: 0, denoising: 40,
        faceEnhancement: 0, skinTextureGuard: 70, blemishRemoval: 0,
        teethWhiteness: 0, eyeBrightness: 0, eyeWhiteness: 0,
        blemishProfile: '  SUBTLE ',
        teethProfile: 'Strong',
        eyeBrightnessProfile: 'normal',
        eyeWhitenessProfile: 'subtle',
      },
    });
    expect(parsed!.recipe.blemishProfile).toBe('subtle');
    expect(parsed!.recipe.teethProfile).toBe('strong');
  });

  it.each(['food', 'landscape', 'product', 'vehicle', 'aviation', 'other'] as const)(
    'zeroes portrait sliders when subject is %s',
    (kind) => {
      // Safety net: every non-portrait category must strip the
      // portrait-only sliders regardless of what Claude returned. Even
      // if Claude classifies correctly and the schema is followed, a
      // pathological response must not paint teeth-whitening onto a
      // landscape.
      const parsed = sanitiseSuggestion({
        subject: kind,
        confidence: 0.9,
        rationale: 'test',
        observations: [],
        recipe: {
          brightness: 0, contrast: 10, saturation: 12, sharpness: 8, denoising: 30,
          faceEnhancement: 80,
          skinTextureGuard: 60,
          blemishRemoval: 50,
          teethWhiteness: 40,
          eyeBrightness: 50,
          eyeWhiteness: 30,
          blemishProfile: 'strong',
          teethProfile: 'strong',
          eyeBrightnessProfile: 'strong',
          eyeWhitenessProfile: 'strong',
        },
      });
      expect(parsed!.analysis.subject).toBe(kind);
      expect(parsed!.recipe.faceEnhancement).toBe(0);
      expect(parsed!.recipe.skinTextureGuard).toBe(70);
      expect(parsed!.recipe.blemishRemoval).toBe(0);
      expect(parsed!.recipe.teethWhiteness).toBe(0);
      expect(parsed!.recipe.eyeBrightness).toBe(0);
      expect(parsed!.recipe.eyeWhiteness).toBe(0);
      // Every profile resets to normal too, so nothing stale leaks to
      // the runner.
      expect(parsed!.recipe.blemishProfile).toBe('normal');
      expect(parsed!.recipe.teethProfile).toBe('normal');
      // Tone sliders stay — they're category-agnostic.
      expect(parsed!.recipe.contrast).toBe(10);
      expect(parsed!.recipe.saturation).toBe(12);
    },
  );

  it('does NOT zero portrait sliders for group_portrait', () => {
    // Group portraits (wedding party, family) absolutely benefit from
    // portrait work — the safety net must not trigger on them.
    const parsed = sanitiseSuggestion({
      subject: 'group_portrait',
      confidence: 0.85,
      rationale: 'Wedding party shot',
      observations: [],
      recipe: {
        brightness: 3, contrast: 8, saturation: 6, sharpness: 12, denoising: 35,
        faceEnhancement: 55,
        skinTextureGuard: 75,
        blemishRemoval: 30,
        teethWhiteness: 25,
        eyeBrightness: 18,
        eyeWhiteness: 20,
        blemishProfile: 'normal',
        teethProfile: 'normal',
        eyeBrightnessProfile: 'subtle',
        eyeWhitenessProfile: 'normal',
      },
    });
    expect(parsed!.analysis.subject).toBe('group_portrait');
    expect(parsed!.recipe.faceEnhancement).toBe(55);
    expect(parsed!.recipe.blemishRemoval).toBe(30);
    expect(parsed!.recipe.teethWhiteness).toBe(25);
  });

  it('falls back to "other" when subject is unknown', () => {
    const parsed = sanitiseSuggestion({
      subject: 'spaceship',           // not in the enum
      confidence: 0.8,
      rationale: '',
      observations: [],
      recipe: {
        brightness: 0, contrast: 0, saturation: 0, sharpness: 0, denoising: 40,
        faceEnhancement: 0, skinTextureGuard: 70, blemishRemoval: 0,
        teethWhiteness: 0, eyeBrightness: 0, eyeWhiteness: 0,
        blemishProfile: 'normal',
        teethProfile: 'normal',
        eyeBrightnessProfile: 'normal',
        eyeWhitenessProfile: 'normal',
      },
    });
    expect(parsed!.analysis.subject).toBe('other');
  });

  it('caps rationale length and observation count', () => {
    const parsed = sanitiseSuggestion({
      subject: 'portrait',
      confidence: 0.7,
      rationale: 'x'.repeat(5000),
      observations: Array(50).fill('obs'),
      recipe: {
        brightness: 0, contrast: 0, saturation: 0, sharpness: 0, denoising: 40,
        faceEnhancement: 0, skinTextureGuard: 70, blemishRemoval: 0,
        teethWhiteness: 0, eyeBrightness: 0, eyeWhiteness: 0,
        blemishProfile: 'normal',
        teethProfile: 'normal',
        eyeBrightnessProfile: 'normal',
        eyeWhitenessProfile: 'normal',
      },
    });
    expect(parsed!.analysis.rationale.length).toBeLessThanOrEqual(600);
    expect(parsed!.analysis.observations.length).toBeLessThanOrEqual(8);
  });

  it('drops non-string observations', () => {
    const parsed = sanitiseSuggestion({
      subject: 'portrait',
      confidence: 0.7,
      rationale: '',
      observations: ['eye closed', 42, null, 'motion blur'],
      recipe: {
        brightness: 0, contrast: 0, saturation: 0, sharpness: 0, denoising: 40,
        faceEnhancement: 0, skinTextureGuard: 70, blemishRemoval: 0,
        teethWhiteness: 0, eyeBrightness: 0, eyeWhiteness: 0,
        blemishProfile: 'normal',
        teethProfile: 'normal',
        eyeBrightnessProfile: 'normal',
        eyeWhitenessProfile: 'normal',
      },
    });
    expect(parsed!.analysis.observations).toEqual(['eye closed', 'motion blur']);
  });

  it('rounds float slider values to integers', () => {
    const parsed = sanitiseSuggestion({
      subject: 'portrait',
      confidence: 0.7,
      rationale: '',
      observations: [],
      recipe: {
        brightness: 3.7, contrast: -2.4, saturation: 5.5, sharpness: 12.49, denoising: 37.51,
        faceEnhancement: 66.49, skinTextureGuard: 78.6, blemishRemoval: 33.2,
        teethWhiteness: 28.9, eyeBrightness: 14.5, eyeWhiteness: 9.49,
        blemishProfile: 'normal',
        teethProfile: 'normal',
        eyeBrightnessProfile: 'normal',
        eyeWhitenessProfile: 'normal',
      },
    });
    expect(Number.isInteger(parsed!.recipe.brightness)).toBe(true);
    expect(Number.isInteger(parsed!.recipe.faceEnhancement)).toBe(true);
    expect(parsed!.recipe.brightness).toBe(4);
    expect(parsed!.recipe.sharpness).toBe(12);
    expect(parsed!.recipe.faceEnhancement).toBe(66);
  });
});
