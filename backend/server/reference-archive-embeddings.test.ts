import { describe, expect, it } from 'vitest';
import {
  buildFrameText,
  buildSceneQueryText,
  vectorToPg,
} from './reference-archive-embeddings.js';

const emptyTags = {
  shotType: 'unknown' as const,
  cameraAngle: '',
  lensRange: '',
  lightingMood: '',
  colorPalette: [] as string[],
  composition: '',
  timeOfDay: '',
  suggestedCinematographerStyle: '',
  keywords: [] as string[],
};

describe('buildFrameText', () => {
  it('includes only non-empty fields', () => {
    const text = buildFrameText({
      filmTitle: 'Sicario',
      cinematographer: 'Deakins',
      year: 2015,
      notes: null,
      claudeTags: {
        ...emptyTags,
        shotType: 'wide',
        lightingMood: 'golden-hour',
        keywords: ['desert', 'convoy'],
      },
      userTags: ['reference'],
    });
    expect(text).toContain('Film: Sicario');
    expect(text).toContain('Year: 2015');
    expect(text).toContain('Cinematographer: Deakins');
    expect(text).toContain('Shot: wide');
    expect(text).toContain('Light: golden-hour');
    expect(text).toContain('Keywords: desert, convoy');
    expect(text).toContain('Tags: reference');
    expect(text).not.toContain('Notes:');
    expect(text).not.toContain('Angle:');
  });

  it('omits shotType when unknown', () => {
    const text = buildFrameText({
      filmTitle: null,
      cinematographer: null,
      year: null,
      notes: null,
      claudeTags: emptyTags,
      userTags: [],
    });
    expect(text).toBe('');
  });
});

describe('buildSceneQueryText', () => {
  it('emits a multi-line query', () => {
    const text = buildSceneQueryText({
      heading: 'INT. DINER — NIGHT',
      intExt: 'INT',
      timeOfDay: 'NIGHT',
      locationName: 'Diner',
      description: 'Anna confronts Lukas about the missing ledger.',
      characters: ['ANNA', 'LUKAS'],
      beats: ['entry', 'confrontation', 'walkaway'],
    });
    expect(text).toContain('Scene: INT. DINER — NIGHT');
    expect(text).toContain('INT — NIGHT');
    expect(text).toContain('Characters: ANNA, LUKAS');
    expect(text).toContain('Beats: entry · confrontation · walkaway');
    expect(text).toContain('Anna confronts Lukas');
  });
});

describe('vectorToPg', () => {
  it('formats a number array as pgvector literal', () => {
    expect(vectorToPg([0.1, -0.2, 0.3])).toBe('[0.1,-0.2,0.3]');
  });

  it('handles empty array', () => {
    expect(vectorToPg([])).toBe('[]');
  });
});
