/**
 * Hero's Journey Validator
 *
 * Validerer Story Logic-state mot Joseph Campbell's monomyth-struktur
 * fra "The Hero with a Thousand Faces" (1949), forenklet til Christopher
 * Vogler's 12-trinn fra "The Writer's Journey" (1992).
 *
 * Campbell/Vogler's 12 trinn:
 *   1.  Ordinary World        — Protagonists hverdag før reisen
 *   2.  Call to Adventure     — Hendelse som kaller protagonist til endring
 *   3.  Refusal of the Call   — Initial motvilje/frykt
 *   4.  Meeting the Mentor    — Veileder/visdom som gir verktøy
 *   5.  Crossing the Threshold — Forplikter seg til den nye verden
 *   6.  Tests, Allies, Enemies — Lærer reglene i ny verden
 *   7.  Approach (Inmost Cave) — Forbereder seg til største utfordring
 *   8.  Ordeal                — Møter den ultimate frykten/fienden
 *   9.  Reward (Seizing Sword) — Får det hen kom for
 *   10. The Road Back         — Beslutter å returnere
 *   11. Resurrection          — Endelig, transformativ test
 *   12. Return with the Elixir — Tilbake til hverdagen, men forandret
 *
 * Siden Story Logic-state bare har metadata (ikke script-tekst), kan vi kun
 * validere de stegene som er metadata-utlededbare.
 *
 * Vi klassifiserer også protagonisten i én av Vogler's arketyper basert på
 * flaw + transformationArc:
 *   - Hero            — flaw + full transformation arc
 *   - Anti-Hero       — flaw, men begrenset moralsk transformasjon
 *   - Tragic Hero     — flaw, men feiler transformasjonen
 *   - Reluctant Hero  — sterk refusal-implikasjon
 *   - Unspecified     — for lite metadata til å klassifisere
 */

import type { StoryLogicState } from '../types';

export interface HeroJourneyStep {
  step: number;
  name: string;
}

export type HeroArchetype =
  | 'Hero'
  | 'Anti-Hero'
  | 'Tragic Hero'
  | 'Reluctant Hero'
  | 'Unspecified';

export interface HeroJourneyResult {
  score: number;
  stepsCovered: HeroJourneyStep[];
  stepsMissing: HeroJourneyStep[];
  stepsNotApplicable: HeroJourneyStep[];
  archetype: HeroArchetype;
  suggestions: string[];
}

const ALL_STEPS: HeroJourneyStep[] = [
  { step: 1, name: 'Ordinary World' },
  { step: 2, name: 'Call to Adventure' },
  { step: 3, name: 'Refusal of the Call' },
  { step: 4, name: 'Meeting the Mentor' },
  { step: 5, name: 'Crossing the Threshold' },
  { step: 6, name: 'Tests, Allies, Enemies' },
  { step: 7, name: 'Approach (Inmost Cave)' },
  { step: 8, name: 'Ordeal' },
  { step: 9, name: 'Reward (Seizing the Sword)' },
  { step: 10, name: 'The Road Back' },
  { step: 11, name: 'Resurrection' },
  { step: 12, name: 'Return with the Elixir' },
];

const SCRIPT_ONLY_STEPS = new Set<number>([4, 6, 7, 9, 10]);

const hasText = (value: unknown, minLength = 5): boolean =>
  typeof value === 'string' && value.trim().length >= minLength;

type StepCheck = {
  step: number;
  check: (state: StoryLogicState) => boolean;
  suggestion: string;
};

const METADATA_CHECKS: StepCheck[] = [
  {
    step: 1,
    check: (s) => hasText(s.logline.protagonist) && hasText(s.logline.protagonistTrait),
    suggestion: 'Trinn 1 (Ordinary World): Protagonist + karaktertrekk må være tydelige før vi kan tegne hverdagen hen forlater.',
  },
  {
    step: 2,
    check: (s) => hasText(s.logline.goal, 10) && hasText(s.concept.corePremise, 15),
    suggestion: 'Trinn 2 (Call to Adventure): Premiss + protagonists mål må være konkret nok til at "kallet" er klart.',
  },
  {
    step: 3,
    check: (s) => hasText(s.theme.protagonistFlaw) && hasText(s.logline.stakes),
    suggestion: 'Trinn 3 (Refusal): Indre svakhet + ytre stakes bestemmer hvorfor protagonist nøler.',
  },
  {
    step: 5,
    check: (s) => hasText(s.logline.goal, 10) && hasText(s.logline.antagonisticForce),
    suggestion: 'Trinn 5 (Crossing the Threshold): Mål + antagonisten må være konkrete — det er forpliktelsen til den nye verden.',
  },
  {
    step: 8,
    check: (s) => hasText(s.theme.protagonistFlaw) && hasText(s.logline.antagonisticForce, 8) && hasText(s.logline.stakes, 10),
    suggestion: 'Trinn 8 (Ordeal): Den ultimate testen krever konkret svakhet, antagonist og stakes.',
  },
  {
    step: 11,
    check: (s) => hasText(s.theme.transformationArc, 15) && hasText(s.theme.whatMustChange),
    suggestion: 'Trinn 11 (Resurrection): Transformasjonsbue + whatMustChange må være tydelige — det er reisen kommer til sitt mest avgjørende punkt.',
  },
  {
    step: 12,
    check: (s) => hasText(s.theme.transformationArc, 15) && hasText(s.theme.moralArgument),
    suggestion: 'Trinn 12 (Return with the Elixir): Transformasjonsbue + moralsk argument må være konkrete for at tilbakekomsten skal ha mening.',
  },
];

function classifyArchetype(state: StoryLogicState): HeroArchetype {
  const hasFlaw = hasText(state.theme.protagonistFlaw);
  const hasArc = hasText(state.theme.transformationArc, 15);
  const hasMoralArgument = hasText(state.theme.moralArgument, 10);
  const arcText = (state.theme.transformationArc || '').toLowerCase();
  const flawText = (state.theme.protagonistFlaw || '').toLowerCase();

  const arcSuggestsFailure =
    /(feiler|mislykkes|tragedie|går\s+under|kollaps|ødeleg|fall(er)?|tapt|tape|fails?|tragic|destroy|doom)/.test(
      arcText,
    );
  const arcSuggestsAmbiguous =
    /(uten\s+moral|amoralsk|usympatisk|skurk|antihelt|anti-hero|morally\s+gray|ambiguous|cynic)/.test(
      arcText + ' ' + flawText,
    );
  const flawSuggestsReluctance =
    /(nøler|motvill|frykt|usikker|reluct|hesitan|afraid|fear)/.test(flawText);

  if (!hasFlaw && !hasArc) return 'Unspecified';
  if (arcSuggestsFailure) return 'Tragic Hero';
  if (arcSuggestsAmbiguous) return 'Anti-Hero';
  if (flawSuggestsReluctance && hasArc) return 'Reluctant Hero';
  if (hasFlaw && hasArc && hasMoralArgument) return 'Hero';
  if (hasFlaw && hasArc) return 'Hero';
  return 'Unspecified';
}

export function validateHeroJourney(state: StoryLogicState): HeroJourneyResult {
  const stepsCovered: HeroJourneyStep[] = [];
  const stepsMissing: HeroJourneyStep[] = [];
  const stepsNotApplicable: HeroJourneyStep[] = [];
  const suggestions: string[] = [];

  for (const step of ALL_STEPS) {
    if (SCRIPT_ONLY_STEPS.has(step.step)) {
      stepsNotApplicable.push(step);
      continue;
    }
    const stepCheck = METADATA_CHECKS.find((c) => c.step === step.step);
    if (!stepCheck) {
      stepsNotApplicable.push(step);
      continue;
    }
    if (stepCheck.check(state)) {
      stepsCovered.push(step);
    } else {
      stepsMissing.push(step);
      suggestions.push(stepCheck.suggestion);
    }
  }

  const evaluable = stepsCovered.length + stepsMissing.length;
  const score = evaluable > 0 ? Math.round((stepsCovered.length / evaluable) * 100) : 0;
  const archetype = classifyArchetype(state);

  return {
    score,
    stepsCovered,
    stepsMissing,
    stepsNotApplicable,
    archetype,
    suggestions: suggestions.slice(0, 5),
  };
}
