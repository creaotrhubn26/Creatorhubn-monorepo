/**
 * profileStrength.ts — én definisjon av «hvor klar er profilen».
 *
 * Lå tidligere som en lokal funksjon i DashboardPage. Nå leser både Hjem,
 * profil-hero-en og CV-siden samme tall, så de ikke kan si 71 % og 85 % om
 * samme profil.
 *
 * Krediteringer teller med: en skuespillerprofil uten en eneste rolle er
 * ikke ferdig, uansett hvor fin bio-en er.
 */

import type { RoleRoomTalent } from '../services/roleRoomTalentsService';

/** Hvor i appen steget fylles ut. Uten dette blir manglene en liste å lete etter. */
export type ProfileStrengthTarget = 'profiles' | 'cv' | 'selftapes';

export interface ProfileStrengthStep {
  label: string;
  done: boolean;
  /** Siden som faktisk lar deg fikse akkurat dette. */
  target: ProfileStrengthTarget;
}

export interface ProfileStrength {
  score: number;
  missing: string[];
  /** Alle stegene, i rekkefølge, med status — brukes av sjekklisten. */
  steps: ProfileStrengthStep[];
  /** De som mangler, med veien videre. */
  missingSteps: ProfileStrengthStep[];
}

export function calcProfileStrength(
  talent: RoleRoomTalent | null,
  creditCount = 0,
): ProfileStrength {
  if (!talent) {
    return {
      score: 0,
      missing: ['Opprett profil'],
      steps: [{ label: 'Opprett profil', done: false, target: 'profiles' }],
      missingSteps: [{ label: 'Opprett profil', done: false, target: 'profiles' }],
    };
  }

  // target peker på siden som faktisk fikser steget. Showreel hører til
  // self-tape-studioet, der du kan gjøre et opptak til showreel med ett trykk;
  // krediteringer hører til CV-en. Uten dette ble manglene en liste å lete i.
  const steps: ProfileStrengthStep[] = [
    { label: 'Headshot', done: Boolean(talent.headshot_url), target: 'profiles' },
    { label: 'Showreel', done: Boolean(talent.showreel_url), target: 'selftapes' },
    { label: 'Bio (min 40 tegn)', done: Boolean(talent.bio && talent.bio.length >= 40), target: 'profiles' },
    { label: 'By', done: Boolean(talent.city), target: 'profiles' },
    {
      label: 'Spille-alder',
      done: Boolean(talent.playing_age_min && talent.playing_age_max),
      target: 'profiles',
    },
    {
      label: 'Ferdigheter',
      done: Array.isArray(talent.skills) && talent.skills.length > 0,
      target: 'profiles',
    },
    {
      label: 'Språk',
      done: Array.isArray(talent.languages) && talent.languages.length > 0,
      target: 'profiles',
    },
    { label: 'Minst én kreditering', done: creditCount > 0, target: 'cv' },
  ];

  const done = steps.filter((s) => s.done).length;
  const missingSteps = steps.filter((s) => !s.done);
  return {
    score: Math.round((done / steps.length) * 100),
    missing: missingSteps.map((s) => s.label),
    steps,
    missingSteps,
  };
}
