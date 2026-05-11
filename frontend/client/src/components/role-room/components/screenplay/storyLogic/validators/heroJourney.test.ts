/**
 * Tests for Hero's Journey Validator.
 *
 * Bruker Star Wars (klassisk Campbell/Vogler) som hovedeksempel.
 */

import { describe, expect, it } from 'vitest';
import { validateHeroJourney } from './heroJourney';
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

const starWarsState = (): StoryLogicState => ({
  ...emptyState(),
  locks: { concept: true, logline: true, theme: true },
  concept: {
    corePremise: 'En ung bondegutt på en avsidesliggende planet oppdager at han har en arv som Jedi, og må slutte seg til opprørerne for å redde galaksen fra et tyrannisk imperium.',
    genre: 'Sci-fi',
    subGenre: 'Space opera',
    tone: ['eventyrlig', 'episk'],
    targetAudience: 'familie',
    audienceAge: '12+',
    whyNow: 'Generasjonshistorier om mot og familie',
    uniqueAngle: 'Mytologisk struktur i romopera',
    marketComparables: 'Dune, Flash Gordon',
  },
  logline: {
    protagonist: 'Luke Skywalker',
    protagonistTrait: 'Drømmer, naiv, lengter etter eventyr men nøler',
    goal: 'Redde prinsesse Leia og levere planene for Dødsstjernen til opprørerne',
    antagonisticForce: 'Darth Vader og Imperiet',
    stakes: 'Hele galaksens frihet, og oppdagelsen av hans egen Jedi-arv',
    fullLogline: 'En bondegutt blir kalt til å redde galaksen som Jedi-ridder.',
    loglineScore: 92,
  },
  theme: {
    centralTheme: 'Mot vs. frykt, tro vs. teknologi',
    themeStatement: 'Sann styrke kommer fra å stole på Kraften, ikke på maskiner',
    protagonistFlaw: 'Luke nøler — han er redd for å forlate tante og onkel, redd for ansvar',
    flawOrigin: 'Et beskyttet, isolert liv på Tatooine',
    whatMustChange: 'Han må slippe frykten og forplikte seg til Kraften',
    transformationArc: 'Fra naiv bondegutt til Jedi-trainee som stoler på sin egen intuisjon — han stenger av målsøkeren og bruker Kraften til å treffe Dødsstjernens ventil',
    emotionalJourney: ['lengsel', 'sorg', 'frykt', 'tro', 'mestring'],
    moralArgument: 'Tro på det usynlige er sterkere enn rasjonell beregning',
  },
  currentPhase: 2,
  phaseStatus: { concept: 'ready', logline: 'ready', theme: 'ready' },
  lastSaved: null,
  versions: [],
});

const tragicState = (): StoryLogicState => {
  const state = starWarsState();
  state.theme.transformationArc =
    'Han prøver men feiler — han gir etter for frykten og blir til slutt en tragisk figur som mister alt han elsket';
  return state;
};

const antiHeroState = (): StoryLogicState => {
  const state = starWarsState();
  state.theme.transformationArc =
    'Han forblir morally gray og amoralsk gjennom historien — vi ser en antihelt som vinner uten å transformere seg';
  return state;
};

describe('validateHeroJourney', () => {
  it('returnerer score 0 og Unspecified arketype for tom state', () => {
    const result = validateHeroJourney(emptyState());
    expect(result.score).toBe(0);
    expect(result.archetype).toBe('Unspecified');
  });

  it('flagger script-only steps som notApplicable', () => {
    const result = validateHeroJourney(emptyState());
    const naNames = result.stepsNotApplicable.map((s) => s.name);
    expect(naNames).toContain('Meeting the Mentor');
    expect(naNames).toContain('Tests, Allies, Enemies');
    expect(naNames).toContain('Reward (Seizing the Sword)');
  });

  it('gir høy score (>=70) for komplett Star Wars-state', () => {
    const result = validateHeroJourney(starWarsState());
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.stepsCovered.some((s) => s.name === 'Ordinary World')).toBe(true);
    expect(result.stepsCovered.some((s) => s.name === 'Call to Adventure')).toBe(true);
    expect(result.stepsCovered.some((s) => s.name === 'Ordeal')).toBe(true);
    expect(result.stepsCovered.some((s) => s.name === 'Resurrection')).toBe(true);
  });

  it('klassifiserer Star Wars som Hero eller Reluctant Hero', () => {
    const result = validateHeroJourney(starWarsState());
    expect(['Hero', 'Reluctant Hero']).toContain(result.archetype);
  });

  it('klassifiserer som Tragic Hero når transformationArc inneholder "feiler"', () => {
    const result = validateHeroJourney(tragicState());
    expect(result.archetype).toBe('Tragic Hero');
  });

  it('klassifiserer som Anti-Hero ved morally gray transformationArc', () => {
    const result = validateHeroJourney(antiHeroState());
    expect(result.archetype).toBe('Anti-Hero');
  });

  it('totalt 12 steps fordelt over covered+missing+notApplicable', () => {
    const result = validateHeroJourney(emptyState());
    const total =
      result.stepsCovered.length + result.stepsMissing.length + result.stepsNotApplicable.length;
    expect(total).toBe(12);
  });

  it('returnerer maks 5 suggestions', () => {
    const result = validateHeroJourney(emptyState());
    expect(result.suggestions.length).toBeLessThanOrEqual(5);
  });
});
