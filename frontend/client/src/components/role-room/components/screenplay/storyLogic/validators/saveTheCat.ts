/**
 * Save the Cat! Beat Sheet Validator
 *
 * Validerer Story Logic-state mot Blake Snyder's 15-beat-struktur
 * fra "Save the Cat! The Last Book on Screenwriting You'll Ever Need" (2005).
 *
 * Snyder's 15 beats med standard timing (basert på 110-siders manuskript):
 *   1.  Opening Image       (1)        — visuell etablering av tone/verden
 *   2.  Theme Stated        (5)        — noen sier historiens tematiske argument
 *   3.  Set-Up              (1-10)     — etablering av protagonists "før"-verden
 *   4.  Catalyst            (12)       — hendelsen som forstyrrer status quo
 *   5.  Debate              (12-25)    — protagonist nøler/vurderer
 *   6.  Break Into Two      (25)       — protagonist forplikter seg til reisen
 *   7.  B Story             (30)       — relasjon som vil bære tematisk arc
 *   8.  Fun and Games       (30-55)    — "promise of the premise"
 *   9.  Midpoint            (55)       — falsk seier/nederlag, hever innsatsen
 *   10. Bad Guys Close In   (55-75)    — antagonister samles, indre svakhet eksponeres
 *   11. All Is Lost         (75)       — laveste punkt, "doften av død"
 *   12. Dark Night of Soul  (75-85)    — protagonist sørger, finner ny innsikt
 *   13. Break Into Three    (85)       — protagonist handler ut fra ny innsikt
 *   14. Finale              (85-110)   — protagonist eksekverer ny plan, transformerer
 *   15. Final Image         (110)      — visuelt motstykke til Opening Image
 *
 * Siden Story Logic-state bare har metadata (ikke script-tekst), kan vi kun
 * validere de beats som er metadata-utlededbare. De andre flagges som
 * "ikke vurderbare på dette nivået".
 */

import type { StoryLogicState } from '../types';

export interface SaveTheCatBeat {
  beat: number;
  name: string;
  approxPage: number;
}

export interface SaveTheCatResult {
  score: number;
  beatsCovered: SaveTheCatBeat[];
  beatsMissing: SaveTheCatBeat[];
  beatsNotApplicable: SaveTheCatBeat[];
  suggestions: string[];
}

const ALL_BEATS: SaveTheCatBeat[] = [
  { beat: 1, name: 'Opening Image', approxPage: 1 },
  { beat: 2, name: 'Theme Stated', approxPage: 5 },
  { beat: 3, name: 'Set-Up', approxPage: 10 },
  { beat: 4, name: 'Catalyst', approxPage: 12 },
  { beat: 5, name: 'Debate', approxPage: 20 },
  { beat: 6, name: 'Break Into Two', approxPage: 25 },
  { beat: 7, name: 'B Story', approxPage: 30 },
  { beat: 8, name: 'Fun and Games', approxPage: 45 },
  { beat: 9, name: 'Midpoint', approxPage: 55 },
  { beat: 10, name: 'Bad Guys Close In', approxPage: 65 },
  { beat: 11, name: 'All Is Lost', approxPage: 75 },
  { beat: 12, name: 'Dark Night of the Soul', approxPage: 80 },
  { beat: 13, name: 'Break Into Three', approxPage: 85 },
  { beat: 14, name: 'Finale', approxPage: 100 },
  { beat: 15, name: 'Final Image', approxPage: 110 },
];

const SCRIPT_ONLY_BEATS = new Set<number>([1, 3, 5, 6, 7, 8, 13, 15]);

const hasText = (value: unknown, minLength = 5): boolean =>
  typeof value === 'string' && value.trim().length >= minLength;

type BeatCheck = {
  beat: number;
  check: (state: StoryLogicState) => boolean;
  suggestion: string;
};

const METADATA_CHECKS: BeatCheck[] = [
  {
    beat: 2,
    check: (s) => hasText(s.theme.themeStatement, 10) && hasText(s.theme.centralTheme),
    suggestion: 'Beat 2 (Theme Stated): Definer både centralTheme og en konkret themeStatement — en setning som dramatiserer det moralske argumentet.',
  },
  {
    beat: 4,
    check: (s) => hasText(s.concept.corePremise, 20) && hasText(s.logline.goal, 8),
    suggestion: 'Beat 4 (Catalyst): Premiss + protagonists mål må være tydelig nok til at vi kan se den utløsende hendelsen.',
  },
  {
    beat: 9,
    check: (s) => hasText(s.logline.stakes, 10) && hasText(s.logline.antagonisticForce),
    suggestion: 'Beat 9 (Midpoint): For at vendepunktet skal lande, må stakes og antagonisten være konkrete.',
  },
  {
    beat: 10,
    check: (s) => hasText(s.logline.antagonisticForce, 8) && hasText(s.theme.protagonistFlaw),
    suggestion: 'Beat 10 (Bad Guys Close In): Antagonistisk kraft + protagonists indre svakhet må spille mot hverandre her.',
  },
  {
    beat: 11,
    check: (s) => hasText(s.theme.protagonistFlaw) && hasText(s.logline.stakes, 10),
    suggestion: 'Beat 11 (All Is Lost): "Doften av død" krever konkret stakes + konkret indre svakhet å falle for.',
  },
  {
    beat: 12,
    check: (s) => hasText(s.theme.protagonistFlaw) && hasText(s.theme.whatMustChange),
    suggestion: 'Beat 12 (Dark Night of the Soul): Protagonist må konfrontere svakheten — definer whatMustChange tydelig.',
  },
  {
    beat: 14,
    check: (s) => hasText(s.theme.transformationArc, 15) && hasText(s.theme.moralArgument),
    suggestion: 'Beat 14 (Finale): Klimaks dramatiserer transformasjonen + moralsk argument. Begge må være konkrete.',
  },
];

export function validateSaveTheCatBeats(state: StoryLogicState): SaveTheCatResult {
  const beatsCovered: SaveTheCatBeat[] = [];
  const beatsMissing: SaveTheCatBeat[] = [];
  const beatsNotApplicable: SaveTheCatBeat[] = [];
  const suggestions: string[] = [];

  for (const beat of ALL_BEATS) {
    if (SCRIPT_ONLY_BEATS.has(beat.beat)) {
      beatsNotApplicable.push(beat);
      continue;
    }
    const beatCheck = METADATA_CHECKS.find((c) => c.beat === beat.beat);
    if (!beatCheck) {
      beatsNotApplicable.push(beat);
      continue;
    }
    if (beatCheck.check(state)) {
      beatsCovered.push(beat);
    } else {
      beatsMissing.push(beat);
      suggestions.push(beatCheck.suggestion);
    }
  }

  const evaluable = beatsCovered.length + beatsMissing.length;
  const score = evaluable > 0 ? Math.round((beatsCovered.length / evaluable) * 100) : 0;

  return {
    score,
    beatsCovered,
    beatsMissing,
    beatsNotApplicable,
    suggestions: suggestions.slice(0, 5),
  };
}
