/**
 * Tests for 3-Act Structure Validator.
 *
 * Bruker kjente filmer som fixtures: Inception (komplett 3-akts),
 * La La Land (kjent strukturert film), og tom state (worst-case).
 */

import { describe, expect, it } from 'vitest';
import { validateThreeActStructure } from './threeActs';
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

const inceptionState = (): StoryLogicState => ({
  ...emptyState(),
  concept: {
    corePremise: 'En tyv som stjeler hemmeligheter fra drømmer får sjansen til å gjenforenes med sine barn ved å plante en idé i en arvings underbevissthet.',
    genre: 'Sci-fi',
    subGenre: 'Heist',
    tone: ['mørk', 'ettertenksom'],
    targetAudience: 'voksen',
    audienceAge: '18+',
    whyNow: 'AI-eraen utforsker drømmer/virkelighet',
    uniqueAngle: 'Inception (plante idé) vs. extraction (stjele)',
    marketComparables: 'Tenet, The Matrix',
  },
  logline: {
    protagonist: 'Cobb',
    protagonistTrait: 'Brilliant men tynget av skyld',
    goal: 'Plante en idé så han kan vende hjem til barna',
    antagonisticForce: 'Cobbs avdøde kone Mal som projiseres inn i drømmene',
    stakes: 'Han mister sjansen til å se barna sine igjen, og kan bli fanget i limbo',
    fullLogline: 'En tyv av drømmer må plante en idé for å vinne tilbake livet sitt.',
    loglineScore: 85,
  },
  theme: {
    centralTheme: 'Skyld og tilgivelse',
    themeStatement: 'Du kan ikke flykte fra det du ikke har tilgitt deg selv',
    protagonistFlaw: 'Cobb klamrer seg til skyldfølelsen for konas død',
    flawOrigin: 'Han plantet ideen som drev henne til selvmord',
    whatMustChange: 'Han må slippe Mals skygge for å våkne i virkeligheten',
    transformationArc: 'Fra skyldbundet flykt til selvtilgivelse — han slipper Mal og velger sine egne barn fremfor erindringen',
    emotionalJourney: ['skyld', 'fortvilelse', 'aksept', 'frihet'],
    moralArgument: 'Tilgivelse er det eneste som lar oss leve i virkeligheten',
  },
  currentPhase: 2,
  phaseStatus: { concept: 'ready', logline: 'ready', theme: 'ready' },
  lastSaved: null,
  locks: { concept: true, logline: true, theme: true },
  versions: [],
});

describe('validateThreeActStructure', () => {
  it('returnerer score 0 og acts 0 for tom state', () => {
    const result = validateThreeActStructure(emptyState());
    expect(result.score).toBe(0);
    expect(result.actsCovered).toBe(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('flagger manglende plot points i tom state', () => {
    const result = validateThreeActStructure(emptyState());
    expect(result.missingPlotPoints.some((p) => /Catalyst/.test(p))).toBe(true);
    expect(result.missingPlotPoints.some((p) => /All Is Lost/.test(p))).toBe(true);
  });

  it('gir høy score (>=80) for komplett Inception-state', () => {
    const result = validateThreeActStructure(inceptionState());
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.actsCovered).toBe(3);
    expect(result.missingPlotPoints).toEqual([]);
  });

  it('flagger pacing-warning hvis Act 2 mangler men Act 1 og 3 er fylt', () => {
    const state = inceptionState();
    state.logline.antagonisticForce = '';
    state.logline.stakes = '';
    state.theme.protagonistFlaw = '';
    const result = validateThreeActStructure(state);
    expect(result.actsCovered).toBeLessThan(3);
    expect(result.pacingWarning).toBeDefined();
  });

  it('returnerer "Kun Act 1 etablert"-warning når kun Act 1 er fylt', () => {
    const state = emptyState();
    state.concept.corePremise = 'En ung tryllekunstner oppdager at han er trollet';
    state.concept.genre = 'Fantasy';
    state.concept.tone = ['eventyrlig'];
    state.logline.protagonist = 'Harry';
    state.logline.protagonistTrait = 'Modig men usikker';
    state.logline.goal = 'Beseire Voldemort';
    state.logline.antagonisticForce = 'Voldemort';
    const result = validateThreeActStructure(state);
    expect(result.actsCovered).toBe(1);
    expect(result.pacingWarning).toBeDefined();
  });

  it('produserer maks 5 forslag', () => {
    const result = validateThreeActStructure(emptyState());
    expect(result.suggestions.length).toBeLessThanOrEqual(5);
  });
});
