/**
 * Tests for StoryLogic canonical validators (concept/logline/theme + contradictions).
 *
 * Disse låser oppførselen som tidligere bare lå inline i StoryLogicPanel.tsx.
 * Sjekker score-distribusjon, warning-vekt, nextBestAction-melding og at
 * affirmations/coaching kick-er inn ved riktige terskler.
 */

import { describe, expect, it } from 'vitest';
import {
  detectContradictions,
  validateConcept,
  validateLogline,
  validateTheme,
} from './storyValidation';
import type { ConceptData, LoglineData, ThemeData } from './types';

const emptyConcept = (): ConceptData => ({
  corePremise: '',
  genre: '',
  subGenre: '',
  tone: [],
  targetAudience: '',
  audienceAge: '',
  whyNow: '',
  uniqueAngle: '',
  marketComparables: '',
});

const emptyLogline = (): LoglineData => ({
  protagonist: '',
  protagonistTrait: '',
  goal: '',
  antagonisticForce: '',
  stakes: '',
  fullLogline: '',
  loglineScore: 0,
});

const emptyTheme = (): ThemeData => ({
  centralTheme: '',
  themeStatement: '',
  protagonistFlaw: '',
  flawOrigin: '',
  whatMustChange: '',
  transformationArc: '',
  emotionalJourney: [],
  moralArgument: '',
});

describe('validateConcept', () => {
  it('returnerer score 0 og isValid=false for tom concept', () => {
    const result = validateConcept(emptyConcept());
    expect(result.score).toBe(0);
    expect(result.isValid).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('flagger alle 7 kritiske felter ved tom state', () => {
    const result = validateConcept(emptyConcept());
    const flaggedIds = result.warnings.map((w) => w.fieldId);
    expect(flaggedIds).toContain('corePremise');
    expect(flaggedIds).toContain('genre');
    expect(flaggedIds).toContain('tone');
    expect(flaggedIds).toContain('whyNow');
    expect(flaggedIds).toContain('uniqueAngle');
  });

  it('gir nextBestAction basert på warning med høyest pointsLost', () => {
    const concept = emptyConcept();
    const result = validateConcept(concept);
    expect(result.nextBestAction).toMatch(/^Forsterk:/);
    // whyNow har pointsLost=2 (sammen med uniqueAngle) — en av disse vinner
    expect(result.nextBestAction).toMatch(/Hvorfor nå|Unik vinkel/);
  });

  it('gir høy score for komplett konsept (>=80)', () => {
    const concept: ConceptData = {
      corePremise:
        'En ung paleontolog må beskytte det siste levende trollet før militæret tilintetgjør Norges siste myte.',
      genre: 'Fantasy',
      subGenre: 'Mythological',
      tone: ['Intense', 'Suspenseful'],
      targetAudience: 'Familier og fantasy-entusiaster',
      audienceAge: 'Teen (13-17)',
      whyNow:
        'Klimaangst i 2024 vekker dormante trusler — generasjonens dilemma mellom tradisjon og teknologi.',
      uniqueAngle:
        'I motsetning til typiske monsterfilmer er trollet et sympatisk vesen som søker hjemme.',
      marketComparables: 'Godzilla (2014) møter The Water Horse, med tematiske likheter til Princess Mononoke.',
    };
    const result = validateConcept(concept);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.isValid).toBe(true);
    expect(result.affirmations.length).toBeGreaterThan(0);
  });

  it('gir suggestion ved generic uniqueAngle som starter med "unique"', () => {
    const concept = emptyConcept();
    concept.uniqueAngle = 'Unique perspective on classic story trope';
    const result = validateConcept(concept);
    expect(result.suggestions.some((s) => /generisk/i.test(s))).toBe(true);
  });
});

describe('validateLogline', () => {
  it('returnerer score 0 for tom logline', () => {
    const result = validateLogline(emptyLogline());
    expect(result.score).toBe(0);
    expect(result.isValid).toBe(false);
  });

  it('flagger fullLogline med høyest impact', () => {
    const result = validateLogline(emptyLogline());
    expect(result.warnings.some((w) => w.fieldId === 'fullLogline')).toBe(true);
    expect(result.nextBestAction).toMatch(/^Legg til:/);
  });

  it('gir affirmation når alle 3 logline-beats er til stede', () => {
    const logline: LoglineData = {
      protagonist: 'Nora Tidemann',
      protagonistTrait: 'briljant, men skeptisk',
      goal: 'must protect and guide the troll back to Dovre',
      antagonisticForce: 'a military set on destroying it',
      stakes: 'lose the last living connection to Norse mythology forever',
      fullLogline:
        'When a brilliant paleontologist must protect the ancient troll, she faces the military or else the last myth dies.',
      loglineScore: 0,
    };
    const result = validateLogline(logline);
    expect(result.isValid).toBe(true);
    expect(result.affirmations.some((a) => /alle strukturelle beats/.test(a))).toBe(true);
  });

  it('gir suggestion om manglende action-verb i goal', () => {
    const logline = emptyLogline();
    logline.goal = 'forsto situasjonen sin på en ny måte';
    const result = validateLogline(logline);
    expect(result.suggestions.some((s) => /handlingsverb/i.test(s))).toBe(true);
  });
});

describe('validateTheme', () => {
  it('returnerer score 0 for tom theme', () => {
    const result = validateTheme(emptyTheme());
    expect(result.score).toBe(0);
    expect(result.isValid).toBe(false);
  });

  it('flagger transformationArc + themeStatement + flaw + whatMustChange', () => {
    const result = validateTheme(emptyTheme());
    const flaggedIds = result.warnings.map((w) => w.fieldId);
    expect(flaggedIds).toContain('themeStatement');
    expect(flaggedIds).toContain('protagonistFlaw');
    expect(flaggedIds).toContain('whatMustChange');
    expect(flaggedIds).toContain('transformationArc');
  });

  it('gir affirmation ved detaljert transformationArc + emotionalJourney', () => {
    const theme: ThemeData = {
      centralTheme: 'Mot vs. frykt',
      themeStatement:
        'Denne historien argumenterer for at sann styrke er sårbarhet, ikke fasade.',
      protagonistFlaw: 'Hun klamrer seg til skepsis for å unngå smerten ved å tro.',
      flawOrigin: 'Tidligere svik fra autoritetsfigurer',
      whatMustChange: 'Hun må forene rasjonalitet og folkelig visdom.',
      transformationArc:
        'Fra avvisende skeptiker → til nølende troende → til aktiv beskytter som bygger bro.',
      emotionalJourney: ['Skepsis', 'Frykt', 'Undring', 'Aksept', 'Triumf'],
      moralArgument: 'Tro på det usynlige er sterkere enn rasjonell beregning.',
    };
    const result = validateTheme(theme);
    expect(result.isValid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.affirmations.length).toBeGreaterThan(0);
  });
});

describe('detectContradictions', () => {
  it('returnerer tom liste ved kompatibel konfig', () => {
    const concept = emptyConcept();
    concept.genre = 'Drama';
    concept.tone = ['Hopeful'];
    concept.targetAudience = 'Adult audiences';
    concept.audienceAge = 'Adult (26-45)';
    const theme = emptyTheme();
    const result = detectContradictions(concept, theme);
    expect(result).toEqual([]);
  });

  it('flagger barn + horror som kontradiksjon', () => {
    const concept = emptyConcept();
    concept.genre = 'Horror';
    concept.targetAudience = 'children';
    concept.audienceAge = 'Children (Under 12)';
    const result = detectContradictions(concept, emptyTheme());
    expect(result.some((m) => /Barn/.test(m))).toBe(true);
  });

  it('flagger barn + cynical tone separat', () => {
    const concept = emptyConcept();
    concept.tone = ['Cynical'];
    concept.targetAudience = 'children audience';
    concept.audienceAge = 'Children (Under 12)';
    const result = detectContradictions(concept, emptyTheme());
    expect(result.some((m) => /Kynisk/.test(m))).toBe(true);
  });

  it('flagger generic whyNow + generic uniqueAngle samtidig', () => {
    const concept = emptyConcept();
    concept.whyNow = 'This story is timely and relevant for audiences today';
    concept.uniqueAngle = 'A unique take';
    const result = detectContradictions(concept, emptyTheme());
    expect(result.some((m) => /generiske/.test(m))).toBe(true);
  });
});
