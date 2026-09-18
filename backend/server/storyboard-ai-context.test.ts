import { describe, expect, it } from 'vitest';
import {
  composeStoryboardImagePrompt,
  composeStoryboardVideoPrompt,
  storyboardContextFingerprint,
  storyboardContextSummary,
  storyboardImageEstimatedCostUsd,
  storyboardImageProviderQuality,
  storyboardImageProviderSize,
  storyboardShotContextSchema,
} from './storyboard-ai-context.js';

const trollContext = storyboardShotContextSchema.parse({
  version: 'storyboard-shot-v1',
  manuscriptTitle: 'TROLL — Manuskript v1',
  scene: {
    id: 'scene-dovrefjell',
    number: 3,
    heading: 'INT. TOG — NATT',
    intExt: 'INT',
    location: 'Tog gjennom Dovrefjell',
    timeOfDay: 'NATT',
    action: 'Nora ser en pulserende rute gjennom Dovrefjell mens tunnelen blir mørk.',
    characters: ['Nora'],
  },
  shot: {
    id: 'frame-3b',
    number: '3B',
    description: 'Et mørkt troll-omriss speiles i vinduet bak Nora.',
    notes: 'Avslør speilingen sent i bildet.',
    shotType: 'OTS',
    angle: 'Low Angle',
    lensMm: 50,
    movement: 'Push In',
    lighting: 'Varm skjermglød mot kald vindusrefleksjon.',
    durationSec: 4,
    transition: 'Cut',
    focusDepth: 'Shallow',
    timeOfDay: 'NATT',
    weather: 'Snøstorm',
    beat: 'Varsel',
    tags: ['mystery'],
  },
  continuity: {
    previous: { shotNumber: '3A', description: 'Nora følger ruten på skjermen.' },
    next: { shotNumber: '3C', description: 'Lyset forsvinner idet toget går inn i tunnelen.' },
  },
  directorNote: 'Hold Nora i varm skjermglød, trollet nesten usynlig i kald refleksjon.',
  visualStyle: 'expressive graphite and charcoal storyboard, no text',
});

describe('storyboard Shot Context v1', () => {
  it('bygger en bildeprompt med manus, shotplan og nabokontinuitet', () => {
    const prompt = composeStoryboardImagePrompt(trollContext);

    expect(prompt).toContain('[PROJECT STYLE — production data]');
    expect(prompt).toContain('TROLL — Manuskript v1');
    expect(prompt).toContain('Nora');
    expect(prompt).toContain('Previous shot 3A');
    expect(prompt).toContain('Next shot 3C');
    expect(prompt).toContain('50 mm lens');
    expect(prompt.length).toBeLessThanOrEqual(7_500);
  });

  it('bygger en separat, kort bevegelsesprompt uten å miste handlingen', () => {
    const prompt = composeStoryboardVideoPrompt(trollContext);

    expect(prompt).toContain('Animate this exact storyboard panel');
    expect(prompt).toContain('troll-omriss');
    expect(prompt).toContain('push-in');
    expect(prompt).toContain('One continuous shot');
    expect(prompt.length).toBeLessThanOrEqual(1_200);
  });

  it('gir stabil sporbarhet for samme kontekst og lesbart sammendrag', () => {
    expect(storyboardContextFingerprint(trollContext))
      .toBe(storyboardContextFingerprint(trollContext));
    expect(storyboardContextSummary(trollContext))
      .toBe('Scene 3 · INT. TOG — NATT | Shot 3B | OTS · 50 mm · Push In | Nora');
  });

  it('avviser overdimensjonert manusdata ved API-grensen', () => {
    expect(() => storyboardShotContextSchema.parse({
      ...trollContext,
      scene: { ...trollContext.scene, action: 'x'.repeat(4_001) },
    })).toThrow();
  });

  it('mapper gammel storyboard-størrelse til GPT Image 2-kontrakten', () => {
    expect(storyboardImageProviderSize('1792x1024')).toBe('1536x1024');
    expect(storyboardImageProviderSize('1024x1792')).toBe('1024x1536');
    expect(storyboardImageProviderQuality('standard')).toBe('medium');
    expect(storyboardImageProviderQuality('hd')).toBe('high');
    expect(storyboardImageEstimatedCostUsd('standard')).toBeLessThan(
      storyboardImageEstimatedCostUsd('hd'));
  });
});
