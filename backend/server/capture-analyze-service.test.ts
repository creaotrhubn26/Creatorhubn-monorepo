import { describe, expect, it } from 'vitest';
import { sanitiseAnalysis } from './capture-analyze-service.js';

describe('sanitiseAnalysis', () => {
  // Happy path — well-formed Claude tool_use input passes through.
  it('accepts a well-formed analysis unchanged', () => {
    const result = sanitiseAnalysis({
      subject: 'portrait',
      confidence: 0.92,
      tonality: 'soft window light',
      suggested_recipe: {
        warmth: 0.4,
        skinSmooth: 0.55,
        shadowLift: 0.35,
        contrast: 0.1,
        saturation: 0.18,
      },
      quality_notes: ['eyes closed on primary subject'],
      caption_suggestion: 'Golden hour portrait, natural window light',
    });
    expect(result).not.toBeNull();
    expect(result?.subject).toBe('portrait');
    expect(result?.confidence).toBeCloseTo(0.92);
    expect(result?.suggested_recipe.warmth).toBeCloseTo(0.4);
    expect(result?.quality_notes).toEqual(['eyes closed on primary subject']);
  });

  it('clamps recipe values that fall outside the CoreImage-safe range', () => {
    const result = sanitiseAnalysis({
      subject: 'aviation',
      confidence: 1.5,
      tonality: 'x',
      suggested_recipe: {
        warmth: 5,
        skinSmooth: -2,
        shadowLift: 99,
        contrast: -99,
        saturation: 7,
      },
      quality_notes: [],
      caption_suggestion: '',
    });
    expect(result?.confidence).toBe(1);
    expect(result?.suggested_recipe.warmth).toBe(1);
    expect(result?.suggested_recipe.skinSmooth).toBe(0);
    expect(result?.suggested_recipe.shadowLift).toBe(1);
    expect(result?.suggested_recipe.contrast).toBe(-1);
    expect(result?.suggested_recipe.saturation).toBe(1);
  });

  it('coerces unknown subject categories to neutral', () => {
    // Defensive: a model that hallucinates a new category must not break
    // the iPad's enum-driven UI. Falls back to the safe default.
    const result = sanitiseAnalysis({
      subject: 'drone_orbital',
      confidence: 0.9,
      tonality: 'x',
      suggested_recipe: {
        warmth: 0, skinSmooth: 0, shadowLift: 0, contrast: 0, saturation: 0,
      },
      quality_notes: [],
      caption_suggestion: '',
    });
    expect(result?.subject).toBe('neutral');
  });

  it('replaces non-finite numbers with zero rather than NaN', () => {
    const result = sanitiseAnalysis({
      subject: 'food',
      confidence: 'not a number',
      tonality: 'x',
      suggested_recipe: {
        warmth: NaN,
        skinSmooth: Infinity,
        shadowLift: -Infinity,
        contrast: 'oops',
        saturation: null,
      },
      quality_notes: [],
      caption_suggestion: '',
    });
    expect(result?.confidence).toBe(0);
    expect(result?.suggested_recipe.warmth).toBe(0);
    expect(result?.suggested_recipe.skinSmooth).toBe(0); // !isFinite → 0
    expect(result?.suggested_recipe.shadowLift).toBe(0); // !isFinite → 0
    expect(result?.suggested_recipe.contrast).toBe(0);
    expect(result?.suggested_recipe.saturation).toBe(0);
  });

  it('truncates oversized strings and caps the notes array', () => {
    // Cap is 10 notes, 120 chars per note, 200 char caption — nothing
    // arbitrarily long ever ships to the iPad.
    const longNote = 'x'.repeat(500);
    const result = sanitiseAnalysis({
      subject: 'landscape',
      confidence: 0.7,
      tonality: 'y'.repeat(500),
      suggested_recipe: {
        warmth: 0, skinSmooth: 0, shadowLift: 0, contrast: 0, saturation: 0,
      },
      quality_notes: Array(20).fill(longNote),
      caption_suggestion: 'z'.repeat(500),
    });
    expect(result?.tonality.length).toBe(160);
    expect(result?.caption_suggestion.length).toBe(200);
    expect(result?.quality_notes.length).toBe(10);
    expect(result?.quality_notes[0].length).toBe(120);
  });

  it('returns null for non-object input', () => {
    expect(sanitiseAnalysis(null)).toBeNull();
    expect(sanitiseAnalysis(undefined)).toBeNull();
    expect(sanitiseAnalysis('a string')).toBeNull();
    expect(sanitiseAnalysis(42)).toBeNull();
  });

  it('drops empty / non-string entries from quality_notes', () => {
    const result = sanitiseAnalysis({
      subject: 'product',
      confidence: 0.5,
      tonality: 'x',
      suggested_recipe: {
        warmth: 0, skinSmooth: 0, shadowLift: 0, contrast: 0, saturation: 0,
      },
      quality_notes: ['valid', '', null, 42, 'also valid'],
      caption_suggestion: '',
    });
    expect(result?.quality_notes).toEqual(['valid', 'also valid']);
  });
});
