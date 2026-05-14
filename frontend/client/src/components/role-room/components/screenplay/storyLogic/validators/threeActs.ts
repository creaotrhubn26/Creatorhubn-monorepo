/**
 * 3-Act Structure Validator
 *
 * Validerer Story Logic-state mot klassisk 3-akts-struktur (Aristoteles,
 * Syd Field's "Screenplay: The Foundations of Screenwriting", 1979):
 *
 *   - Act 1 — Setup (0-25%): Etablerer protagonist, verden, premiss.
 *     Plot Point 1 (~25%) = Catalyst som tvinger protagonist inn i Act 2.
 *   - Act 2 — Confrontation (25-75%): Protagonist møter motstand, eskalerer.
 *     Midpoint (~50%) = Hendelse som vender historien.
 *     Plot Point 2 (~75%) = "All Is Lost"-moment før klimaks.
 *   - Act 3 — Resolution (75-100%): Klimaks + transformasjon + ny likevekt.
 *
 * Siden Story Logic-state bare har metadata (konsept/logline/tema) — ikke
 * faktisk script-tekst — kan vi kun validere de strukturelle kravene som
 * må eksistere i metadataen, ikke pacing/timing.
 */

import type { StoryLogicState } from '../types';

export interface ThreeActResult {
  /** Score 0-100 basert på hvor mange aktive ackcheckpoints som er dekket */
  score: number;
  /** Hvor mange akter har tilstrekkelig metadata for å bli skrevet */
  actsCovered: 0 | 1 | 2 | 3;
  /** Hvilke plot points mangler nødvendig metadata */
  missingPlotPoints: string[];
  /** Konkrete forbedringsforslag */
  suggestions: string[];
  /** Advarsel om pacing/balansering */
  pacingWarning?: string;
}

interface ActCheckpoint {
  id: string;
  act: 1 | 2 | 3;
  label: string;
  /** Returnerer true hvis state har tilstrekkelig metadata for denne beaten */
  check: (state: StoryLogicState) => boolean;
  suggestion: string;
}

const hasText = (value: unknown, minLength = 5): boolean =>
  typeof value === 'string' && value.trim().length >= minLength;

const CHECKPOINTS: ActCheckpoint[] = [
  {
    id: 'act1-premise',
    act: 1,
    label: 'Act 1: Premiss etablert',
    check: (s) => hasText(s.concept.corePremise, 20),
    suggestion: 'Skriv et tydelig core premise (minst 20 tegn) som etablerer hva historien handler om.',
  },
  {
    id: 'act1-protagonist',
    act: 1,
    label: 'Act 1: Protagonist introdusert',
    // Protagonist-navn er ofte korte (Cobb, Eve, Max) — bruk min 2 tegn for
    // navnet, men behold default 5 tegn for karaktertrekk.
    check: (s) => hasText(s.logline.protagonist, 2) && hasText(s.logline.protagonistTrait),
    suggestion: 'Definer protagonist + en distinkt karaktertrekk. Publikum må forstå hvem hovedpersonen er før Act 2 starter.',
  },
  {
    id: 'act1-genre',
    act: 1,
    label: 'Act 1: Sjanger/tone forventning',
    check: (s) => hasText(s.concept.genre) && Array.isArray(s.concept.tone) && s.concept.tone.length > 0,
    suggestion: 'Velg sjanger + tone. Publikum etablerer forventninger i de første 10 minuttene basert på dette.',
  },
  {
    id: 'pp1-catalyst',
    act: 1,
    label: 'Plot Point 1: Catalyst (~25%)',
    // PP1 = inciting incident. Krever et tydelig mål protagonisten skal jakte.
    // Antagonistisk kraft hører til Act 2 og valideres separat der.
    check: (s) => hasText(s.logline.goal, 10),
    suggestion: 'Tydeliggjør hva som tvinger protagonist ut av sin vanlige verden — beskriv målet (goal) konkret. Uten dette har historien ingen drivkraft.',
  },
  {
    id: 'act2-antagonist',
    act: 2,
    label: 'Act 2: Antagonistisk kraft',
    check: (s) => hasText(s.logline.antagonisticForce, 8),
    suggestion: 'Antagonistisk kraft (person, system, indre konflikt) må være konkret — den definerer det meste av Act 2.',
  },
  {
    id: 'act2-stakes',
    act: 2,
    label: 'Act 2: Stakes (hva står på spill)',
    check: (s) => hasText(s.logline.stakes, 10),
    suggestion: 'Hva mister protagonist hvis hen feiler? Uten stakes har publikum ingen grunn til å bry seg.',
  },
  {
    id: 'act2-conflict',
    act: 2,
    label: 'Act 2: Indre konflikt (flaw)',
    check: (s) => hasText(s.theme.protagonistFlaw),
    suggestion: 'Protagonist trenger en indre svakhet som forsterker den ytre konflikten — dette er motoren i Act 2.',
  },
  {
    id: 'pp2-all-is-lost',
    act: 2,
    label: 'Plot Point 2: All Is Lost (~75%)',
    check: (s) => hasText(s.theme.protagonistFlaw) && hasText(s.theme.whatMustChange),
    suggestion: 'Det laveste punktet før klimaks krever at vi vet hva protagonist må endre (whatMustChange). Uten det blir Act 3-resolusjonen tom.',
  },
  {
    id: 'act3-transformation',
    act: 3,
    label: 'Act 3: Transformasjonsbue',
    check: (s) => hasText(s.theme.transformationArc, 15),
    suggestion: 'Beskriv protagonists transformasjonsbue konkret — hvem er hen før vs. etter klimaks?',
  },
  {
    id: 'act3-theme',
    act: 3,
    label: 'Act 3: Tematisk argument',
    check: (s) => hasText(s.theme.moralArgument, 10) && hasText(s.theme.themeStatement),
    suggestion: 'Klimaks dramatiserer historiens moralske argument. Definer theme statement + moral argument.',
  },
  {
    id: 'act3-resolution',
    act: 3,
    label: 'Act 3: Ny likevekt',
    check: (s) => hasText(s.theme.whatMustChange) && hasText(s.theme.transformationArc),
    suggestion: 'Resolusjonen krever at vi vet hva som måtte endres og hva som faktisk endret seg.',
  },
];

export function validateThreeActStructure(state: StoryLogicState): ThreeActResult {
  const results = CHECKPOINTS.map((cp) => ({
    ...cp,
    passed: cp.check(state),
  }));

  const passedCount = results.filter((r) => r.passed).length;
  const score = Math.round((passedCount / CHECKPOINTS.length) * 100);

  const actsPassed = new Set<1 | 2 | 3>();
  for (const act of [1, 2, 3] as const) {
    const actResults = results.filter((r) => r.act === act);
    const actPassed = actResults.every((r) => r.passed);
    if (actPassed) actsPassed.add(act);
  }
  const actsCovered = actsPassed.size as 0 | 1 | 2 | 3;

  const missingPlotPoints = results
    .filter((r) => !r.passed && (r.id.startsWith('pp') || r.id.includes('catalyst') || r.id.includes('all-is-lost')))
    .map((r) => r.label);

  const suggestions = results
    .filter((r) => !r.passed)
    .slice(0, 5)
    .map((r) => r.suggestion);

  let pacingWarning: string | undefined;
  if (actsPassed.has(1) && actsPassed.has(3) && !actsPassed.has(2)) {
    pacingWarning = 'Act 2 mangler — dette er den vanligste fellen. Konflikt + stakes + flaw må alle være konkrete.';
  } else if (actsPassed.has(1) && !actsPassed.has(2) && !actsPassed.has(3)) {
    pacingWarning = 'Kun Act 1 er etablert. Du har en god setup, men historien har ingen retning ennå.';
  }

  return {
    score,
    actsCovered,
    missingPlotPoints,
    suggestions,
    pacingWarning,
  };
}
