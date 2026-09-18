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

export interface ProfileStrength {
  score: number;
  missing: string[];
  /** Alle stegene, i rekkefølge, med status — brukes av sjekklisten. */
  steps: Array<{ label: string; done: boolean }>;
}

export function calcProfileStrength(
  talent: RoleRoomTalent | null,
  creditCount = 0,
): ProfileStrength {
  if (!talent) {
    return {
      score: 0,
      missing: ['Opprett profil'],
      steps: [{ label: 'Opprett profil', done: false }],
    };
  }

  const steps = [
    { label: 'Headshot', done: Boolean(talent.headshot_url) },
    { label: 'Showreel', done: Boolean(talent.showreel_url) },
    { label: 'Bio (min 40 tegn)', done: Boolean(talent.bio && talent.bio.length >= 40) },
    { label: 'By', done: Boolean(talent.city) },
    {
      label: 'Spille-alder',
      done: Boolean(talent.playing_age_min && talent.playing_age_max),
    },
    {
      label: 'Ferdigheter',
      done: Array.isArray(talent.skills) && talent.skills.length > 0,
    },
    {
      label: 'Språk',
      done: Array.isArray(talent.languages) && talent.languages.length > 0,
    },
    { label: 'Minst én kreditering', done: creditCount > 0 },
  ];

  const done = steps.filter((s) => s.done).length;
  return {
    score: Math.round((done / steps.length) * 100),
    missing: steps.filter((s) => !s.done).map((s) => s.label),
    steps,
  };
}
