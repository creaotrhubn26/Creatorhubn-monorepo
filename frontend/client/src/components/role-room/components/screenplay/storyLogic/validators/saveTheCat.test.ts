/**
 * Tests for Save the Cat! Beat Sheet Validator.
 */

import { describe, expect, it } from 'vitest';
import { validateSaveTheCatBeats } from './saveTheCat';
import type { StoryLogicState } from '../types';

const emptyState = (): StoryLogicState => ({
  concept: {
    corePremise: '',
    genre: '',
    subGenre: '',
    tone: [],
    targetAudience: '',
    audienceAge: '',
    whyNow: '',
    uniqueAngle: '',
    marketComparables: '',
  },
  logline: {
    protagonist: '',
    protagonistTrait: '',
    goal: '',
    antagonisticForce: '',
    stakes: '',
    fullLogline: '',
    loglineScore: 0,
  },
  theme: {
    centralTheme: '',
    themeStatement: '',
    protagonistFlaw: '',
    flawOrigin: '',
    whatMustChange: '',
    transformationArc: '',
    emotionalJourney: [],
    moralArgument: '',
  },
  currentPhase: 0,
  phaseStatus: { concept: 'incomplete', logline: 'incomplete', theme: 'incomplete' },
  lastSaved: null,
  locks: { concept: false, logline: false, theme: false },
  versions: [],
});

const parasiteState = (): StoryLogicState => ({
  ...emptyState(),
  concept: {
    corePremise: 'En fattig familie infiltrerer en rik families husholdning gjennom bedrag — men deres bedrag avdekker en mørkere hemmelighet i kjelleren.',
    genre: 'Thriller',
    subGenre: 'Sosial satire',
    tone: ['mørk', 'satirisk', 'spennende'],
    targetAudience: 'voksen',
    audienceAge: '18+',
    whyNow: 'Klasseskiller eskalerer globalt',
    uniqueAngle: 'Vertikalitet som metafor for klasse',
    marketComparables: 'Snowpiercer, Sorry to Bother You',
  },
  logline: {
    protagonist: 'Kim-familien (kollektiv protagonist)',
    protagonistTrait: 'Ressurssterke, samhørige, men moralsk fleksible',
    goal: 'Sikre seg en stabil inntekt ved å erobre Park-familiens jobber',
    antagonisticForce: 'Park-familiens uforstyrrelige privilegium + den eks-husholdersken som bor i hemmelig kjeller',
    stakes: 'Hvis de blir avslørt, mister de alt — og hvis kjeller-mannen avsløres, betyr det vold',
    fullLogline: 'En fattig familie tar over en rik families liv, til en mørk hemmelighet truer dem alle.',
    loglineScore: 88,
  },
  theme: {
    centralTheme: 'Klasse og bedrag',
    themeStatement: 'Du kan ikke lure deg ut av strukturell ulikhet — den slår alltid tilbake',
    protagonistFlaw: 'Kim-familiens tro på at intelligens og list kan kompensere for fattigdom',
    flawOrigin: 'Generasjoner av fortrengning og uoppfylte muligheter',
    whatMustChange: 'Familien må innse at systemet aldri vil tillate ekte oppstigning',
    transformationArc: 'Fra optimistisk svindel til tragisk innsikt — sønnens fantasi om å kjøpe huset er en illusjon, og faren ender selv i kjelleren',
    emotionalJourney: ['håp', 'eufori', 'paranoia', 'sjokk', 'sorg', 'resignasjon'],
    moralArgument: 'Klassesystemet reproduserer seg selv — bedrag bare flytter offeret nedover',
  },
  currentPhase: 2,
  phaseStatus: { concept: 'ready', logline: 'ready', theme: 'ready' },
  lastSaved: null,
  locks: { concept: true, logline: true, theme: true },
  versions: [],
});

describe('validateSaveTheCatBeats', () => {
  it('returnerer score 0 for tom state', () => {
    const result = validateSaveTheCatBeats(emptyState());
    expect(result.score).toBe(0);
    expect(result.beatsCovered).toEqual([]);
    expect(result.beatsMissing.length).toBeGreaterThan(0);
  });

  it('flagger script-only beats som notApplicable', () => {
    const result = validateSaveTheCatBeats(emptyState());
    const notApplicableNames = result.beatsNotApplicable.map((b) => b.name);
    expect(notApplicableNames).toContain('Opening Image');
    expect(notApplicableNames).toContain('Set-Up');
    expect(notApplicableNames).toContain('Fun and Games');
    expect(notApplicableNames).toContain('Final Image');
  });

  it('gir høy score (>=70) for komplett Parasite-state', () => {
    const result = validateSaveTheCatBeats(parasiteState());
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.beatsCovered.some((b) => b.name === 'Theme Stated')).toBe(true);
    expect(result.beatsCovered.some((b) => b.name === 'All Is Lost')).toBe(true);
    expect(result.beatsCovered.some((b) => b.name === 'Finale')).toBe(true);
  });

  it('flagger Theme Stated som missing når themeStatement er tom', () => {
    const state = parasiteState();
    state.theme.themeStatement = '';
    state.theme.centralTheme = '';
    const result = validateSaveTheCatBeats(state);
    expect(result.beatsMissing.some((b) => b.name === 'Theme Stated')).toBe(true);
    expect(result.suggestions.some((s) => /Theme Stated/.test(s))).toBe(true);
  });

  it('flagger Finale som missing når transformationArc mangler', () => {
    const state = parasiteState();
    state.theme.transformationArc = '';
    state.theme.moralArgument = '';
    const result = validateSaveTheCatBeats(state);
    expect(result.beatsMissing.some((b) => b.name === 'Finale')).toBe(true);
  });

  it('returnerer maks 5 suggestions', () => {
    const result = validateSaveTheCatBeats(emptyState());
    expect(result.suggestions.length).toBeLessThanOrEqual(5);
  });

  it('totalt 15 beats fordelt over covered+missing+notApplicable', () => {
    const result = validateSaveTheCatBeats(emptyState());
    const total =
      result.beatsCovered.length + result.beatsMissing.length + result.beatsNotApplicable.length;
    expect(total).toBe(15);
  });
});
