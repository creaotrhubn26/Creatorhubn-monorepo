/**
 * Legacy text-migrasjon — oversetter eldre engelske TROLL-demo-tekster til
 * norsk bokmål, og normaliserer concept-selections som er lagret med
 * utdaterte sub-genre eller audience-age-verdier.
 *
 * Eksisterer fordi tidligere demo-states (lagret i compatStore før i18n-
 * arbeidet) bruker engelske strenger. Ved load oversetter vi dem til norsk
 * for å gi konsistent UX uten å miste eldre lagrede prosjekter.
 *
 * Pure functions — ingen React/MUI deps. Trygt å gjenbruke fra fase-
 * komponenter (ConceptPhase, LoglinePhase, ThemePhase) når split-arbeidet
 * kommer dit.
 */

import type { ConceptData, StoryLogicState } from './types';
import {
  GENRES,
  SUB_GENRES,
  AUDIENCE_AGES,
  LEGACY_SUBGENRE_MAP,
  LEGACY_AUDIENCE_AGE_MAP,
} from './constants';

/**
 * Lower-case + erstatt smarte sitater/dashes + behold kun a-z0-9æøå-' + space,
 * og kollapse whitespace. Brukes som lookup-nøkkel ved fuzzy-matching.
 */
export function normalizeLegacyLookup(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’`]/g, '\'')
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9æøå\-'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Eksakte EN → NB-mappinger for TROLL-demoens originalstrenger.
 * Ved load oversetter vi disse hvis de matcher trimmet input nøyaktig.
 */
const LEGACY_TROLL_TEXT_NB_MAP: Record<string, string> = {
  'An ancient troll awakens in modern Norway, forcing a paleontologist to bridge the gap between myth and reality before the military destroys the last remnant of Norse legend.':
    'Et urgammelt troll våkner i moderne Norge og tvinger en paleontolog til å bygge bro mellom myte og virkelighet før militæret utsletter den siste resten av norrøn legende.',
  'Families and fantasy enthusiasts who love Nordic mythology':
    'Familier og fantasy-entusiaster som elsker nordisk mytologi',
  'Rising interest in Scandinavian mythology (Vikings, God of War), climate anxiety awakening dormant threats, and the universal theme of humanity\'s relationship with nature and forgotten traditions.':
    'Økt interesse for skandinavisk mytologi (Vikings, God of War), klimaangst som vekker sovende trusler, og et universelt tema om menneskets forhold til naturen og glemte tradisjoner.',
  'Unlike typical monster movies where creatures are purely antagonistic, the troll is a sympathetic being seeking home - making the real conflict about preservation vs. destruction of cultural heritage.':
    'I motsetning til typiske monsterfilmer der skapningen bare er fienden, er trollet et sympatisk vesen som søker hjemmet sitt. Konflikten handler derfor om bevaring kontra ødeleggelse av kulturarv.',
  'Godzilla (2014) meets The Water Horse, with themes similar to Princess Mononoke. Norwegian kaiju with heart.':
    'Godzilla (2014) møter The Water Horse, med tematiske likheter til Princess Mononoke. Norsk kaiju med hjerte.',
  'brilliant but skeptical':
    'briljant, men skeptisk',
  'must protect and guide the ancient troll back to Dovre':
    'må beskytte og lede det urgamle trollet tilbake til Dovre',
  'a military determined to destroy it and her own disbelief in folklore':
    'et militær som er fast bestemt på å ødelegge det, samt hennes egen vantro til folketro',
  'lose the last living connection to Norway\'s mythological past forever':
    'miste den siste levende forbindelsen til Norges mytologiske fortid for alltid',
  'When a brilliant but skeptical paleontologist Nora Tidemann must protect and guide the ancient troll back to Dovre, she faces a military determined to destroy it and her own disbelief in folklore—or else lose the last living connection to Norway\'s mythological past forever.':
    'Når den briljante, men skeptiske paleontologen Nora Tidemann må beskytte og lede det urgamle trollet tilbake til Dovre, møter hun et militær som vil ødelegge det og sin egen vantro til folketro — ellers mister hun den siste levende forbindelsen til Norges mytologiske fortid for alltid.',
  'Reconnecting with cultural heritage and the power of belief':
    'Gjenforbindelse med kulturarv og troens kraft',
  'Only by embracing the wisdom of our ancestors can we find our way home.':
    'Først når vi omfavner visdommen fra våre forfedre, kan vi finne veien hjem.',
  'Rational skepticism that blinds her to wonder and her estranged relationship with her father who believed in folklore':
    'Rasjonell skepsis som gjør henne blind for undring, og et brutt forhold til faren som trodde på folketro',
  'Nora rejected her father\'s stories about trolls as a child, choosing science over tradition, leading to years of distance between them.':
    'Nora avviste farens historier om troll som barn og valgte vitenskap over tradisjon, noe som skapte år med avstand mellom dem.',
  'She must reconcile scientific rationalism with folkloric wisdom, and heal her relationship with her father before it\'s too late.':
    'Hun må forene vitenskapelig rasjonalitet med folkelig visdom, og reparere forholdet til faren før det er for sent.',
  'From dismissive skeptic who mocks tradition → to reluctant believer who witnesses the impossible → to active protector who bridges past and present':
    'Fra avvisende skeptiker som håner tradisjon → til nølende troende som er vitne til det umulige → til aktiv beskytter som bygger bro mellom fortid og nåtid',
  'The film argues that progress without respect for the past leads to destruction, while embracing our heritage gives us the wisdom to face the future.':
    'Filmen argumenterer for at fremskritt uten respekt for fortiden fører til ødeleggelse, mens omfavnelse av kulturarven gir oss visdommen til å møte fremtiden.',
  'Cinephiles and festival audiences':
    'Cinefile og festivalpublikum',
};

/**
 * Normalisert lookup-versjon (genereres ved module-load) for fuzzy-matching
 * når eksakt-treff feiler (f.eks. tekst med litt annen whitespace eller dashes).
 */
const LEGACY_TROLL_TEXT_NB_NORMALIZED_MAP: Record<string, string> = Object.entries(LEGACY_TROLL_TEXT_NB_MAP)
  .reduce<Record<string, string>>((acc, [english, norwegian]) => {
    acc[normalizeLegacyLookup(english)] = norwegian;
    return acc;
  }, {});

/**
 * Fragment-baserte fallbacks — hvis hverken eksakt-treff eller normalisert-treff
 * fungerer, sjekk om input *inneholder* en av disse fragmentene (substring-match
 * på normalisert input) og returner dens NB-oversettelse.
 */
const LEGACY_TROLL_TEXT_NB_FALLBACK_FRAGMENTS: Array<{ fragment: string; translation: string }> = [
  {
    fragment: 'ancient troll awakens in modern norway',
    translation: LEGACY_TROLL_TEXT_NB_MAP['An ancient troll awakens in modern Norway, forcing a paleontologist to bridge the gap between myth and reality before the military destroys the last remnant of Norse legend.'],
  },
  {
    fragment: 'families and fantasy enthusiasts who love nordic mythology',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Families and fantasy enthusiasts who love Nordic mythology'],
  },
  {
    fragment: 'rising interest in scandinavian mythology',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Rising interest in Scandinavian mythology (Vikings, God of War), climate anxiety awakening dormant threats, and the universal theme of humanity\'s relationship with nature and forgotten traditions.'],
  },
  {
    fragment: 'unlike typical monster movies where creatures are purely antagonistic',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Unlike typical monster movies where creatures are purely antagonistic, the troll is a sympathetic being seeking home - making the real conflict about preservation vs. destruction of cultural heritage.'],
  },
  {
    fragment: 'godzilla (2014) meets the water horse',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Godzilla (2014) meets The Water Horse, with themes similar to Princess Mononoke. Norwegian kaiju with heart.'],
  },
  {
    fragment: 'brilliant but skeptical',
    translation: LEGACY_TROLL_TEXT_NB_MAP['brilliant but skeptical'],
  },
  {
    fragment: 'must protect and guide the ancient troll back to dovre',
    translation: LEGACY_TROLL_TEXT_NB_MAP['must protect and guide the ancient troll back to Dovre'],
  },
  {
    fragment: 'a military determined to destroy it and her own disbelief in folklore',
    translation: LEGACY_TROLL_TEXT_NB_MAP['a military determined to destroy it and her own disbelief in folklore'],
  },
  {
    fragment: 'lose the last living connection to norway',
    translation: LEGACY_TROLL_TEXT_NB_MAP['lose the last living connection to Norway\'s mythological past forever'],
  },
  {
    fragment: 'when a brilliant but skeptical paleontologist nora tidemann must protect and guide the ancient troll back to dovre',
    translation: LEGACY_TROLL_TEXT_NB_MAP['When a brilliant but skeptical paleontologist Nora Tidemann must protect and guide the ancient troll back to Dovre, she faces a military determined to destroy it and her own disbelief in folklore—or else lose the last living connection to Norway\'s mythological past forever.'],
  },
  {
    fragment: 'reconnecting with cultural heritage and the power of belief',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Reconnecting with cultural heritage and the power of belief'],
  },
  {
    fragment: 'only by embracing the wisdom of our ancestors can we find our way home',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Only by embracing the wisdom of our ancestors can we find our way home.'],
  },
  {
    fragment: 'rational skepticism that blinds her to wonder',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Rational skepticism that blinds her to wonder and her estranged relationship with her father who believed in folklore'],
  },
  {
    fragment: 'nora rejected her father\'s stories about trolls as a child',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Nora rejected her father\'s stories about trolls as a child, choosing science over tradition, leading to years of distance between them.'],
  },
  {
    fragment: 'she must reconcile scientific rationalism with folkloric wisdom',
    translation: LEGACY_TROLL_TEXT_NB_MAP['She must reconcile scientific rationalism with folkloric wisdom, and heal her relationship with her father before it\'s too late.'],
  },
  {
    fragment: 'from dismissive skeptic who mocks tradition',
    translation: LEGACY_TROLL_TEXT_NB_MAP['From dismissive skeptic who mocks tradition → to reluctant believer who witnesses the impossible → to active protector who bridges past and present'],
  },
  {
    fragment: 'the film argues that progress without respect for the past leads to destruction',
    translation: LEGACY_TROLL_TEXT_NB_MAP['The film argues that progress without respect for the past leads to destruction, while embracing our heritage gives us the wisdom to face the future.'],
  },
  {
    fragment: 'cinephiles and festival audiences',
    translation: LEGACY_TROLL_TEXT_NB_MAP['Cinephiles and festival audiences'],
  },
];

/**
 * Oversetter en legacy engelsk streng til norsk hvis den matcher en av tre
 * strategier: eksakt → normalisert → fragment-substring. Returnerer
 * input uendret hvis ingen match.
 */
export function translateLegacyTextToNb(value: string): string {
  if (!value) return value;

  const trimmed = value.trim();
  const exact = LEGACY_TROLL_TEXT_NB_MAP[trimmed];
  if (exact) return exact;

  const normalized = normalizeLegacyLookup(trimmed);
  const normalizedHit = LEGACY_TROLL_TEXT_NB_NORMALIZED_MAP[normalized];
  if (normalizedHit) return normalizedHit;

  for (const item of LEGACY_TROLL_TEXT_NB_FALLBACK_FRAGMENTS) {
    if (normalized.includes(item.fragment)) {
      return item.translation;
    }
  }

  return value;
}

/**
 * Validerer at concept-feltene `genre`, `subGenre` og `audienceAge` har
 * verdier som finnes i de gjeldende konstant-listene. Eldre lagrede states
 * kan ha utdaterte verdier (f.eks. "Monster/Creature Feature" eller "12+");
 * disse mappes via LEGACY_*_MAP eller renses til tom streng.
 */
export function normalizeConceptSelections(concept: ConceptData): ConceptData {
  const normalizedGenre = GENRES.includes(concept.genre) ? concept.genre : '';
  const validSubGenres = normalizedGenre ? (SUB_GENRES[normalizedGenre] || []) : [];
  const mappedSubGenre = LEGACY_SUBGENRE_MAP[concept.subGenre] ?? concept.subGenre;
  const normalizedSubGenre = mappedSubGenre && validSubGenres.includes(mappedSubGenre) ? mappedSubGenre : '';
  const mappedAudienceAge = LEGACY_AUDIENCE_AGE_MAP[concept.audienceAge] ?? concept.audienceAge;
  const normalizedAudienceAge = AUDIENCE_AGES.includes(mappedAudienceAge) ? mappedAudienceAge : '';

  return {
    ...concept,
    genre: normalizedGenre,
    subGenre: normalizedSubGenre,
    audienceAge: normalizedAudienceAge,
  };
}

/**
 * Full state-normalisering ved load: rens concept-selections + oversett alle
 * fritekst-felter (corePremise, targetAudience, whyNow, uniqueAngle,
 * marketComparables, protagonistTrait, goal, antagonisticForce, stakes,
 * fullLogline, centralTheme, themeStatement, protagonistFlaw, flawOrigin,
 * whatMustChange, transformationArc, moralArgument).
 */
export function normalizeStoryLogicState(input: StoryLogicState): StoryLogicState {
  const concept = normalizeConceptSelections(input.concept);

  return {
    ...input,
    concept: {
      ...concept,
      corePremise: translateLegacyTextToNb(concept.corePremise),
      targetAudience: translateLegacyTextToNb(concept.targetAudience),
      whyNow: translateLegacyTextToNb(concept.whyNow),
      uniqueAngle: translateLegacyTextToNb(concept.uniqueAngle),
      marketComparables: translateLegacyTextToNb(concept.marketComparables),
    },
    logline: {
      ...input.logline,
      protagonistTrait: translateLegacyTextToNb(input.logline.protagonistTrait),
      goal: translateLegacyTextToNb(input.logline.goal),
      antagonisticForce: translateLegacyTextToNb(input.logline.antagonisticForce),
      stakes: translateLegacyTextToNb(input.logline.stakes),
      fullLogline: translateLegacyTextToNb(input.logline.fullLogline),
    },
    theme: {
      ...input.theme,
      centralTheme: translateLegacyTextToNb(input.theme.centralTheme),
      themeStatement: translateLegacyTextToNb(input.theme.themeStatement),
      protagonistFlaw: translateLegacyTextToNb(input.theme.protagonistFlaw),
      flawOrigin: translateLegacyTextToNb(input.theme.flawOrigin),
      whatMustChange: translateLegacyTextToNb(input.theme.whatMustChange),
      transformationArc: translateLegacyTextToNb(input.theme.transformationArc),
      moralArgument: translateLegacyTextToNb(input.theme.moralArgument),
    },
  };
}
