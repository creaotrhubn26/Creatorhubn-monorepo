/**
 * Profil-styrken.
 *
 * Det som testes er at hvert manglende steg peker på siden som faktisk fikser
 * det. En brikke som bare NEVNER at showreel mangler lar deg lete etter hvor
 * showreel fylles ut — og da blir den stående.
 */

import { describe, expect, it } from 'vitest';

import { calcProfileStrength } from './profileStrength';

const talent = (over: Record<string, unknown> = {}) => ({
  id: 't1', display_name: 'Kari', headshot_url: null, showreel_url: null,
  bio: null, city: null, playing_age_min: null, playing_age_max: null,
  skills: [], languages: [], ...over,
}) as never;

describe('calcProfileStrength', () => {
  it('sender showreel til self-tape-studioet, ikke til profilsiden', () => {
    // Der kan et opptak du alt har gjort bli showreel med ett trykk.
    const s = calcProfileStrength(talent(), 0);
    expect(s.missingSteps.find((m) => m.label === 'Showreel')?.target).toBe('selftapes');
  });

  it('sender krediteringer til CV-en', () => {
    const s = calcProfileStrength(talent(), 0);
    expect(s.missingSteps.find((m) => m.label === 'Minst én kreditering')?.target).toBe('cv');
  });

  it('teller en tom profil til 0 og en full til 100', () => {
    expect(calcProfileStrength(talent(), 0).score).toBe(0);
    const full = calcProfileStrength(talent({
      headshot_url: 'h', showreel_url: 's', bio: 'x'.repeat(40), city: 'Oslo',
      playing_age_min: 20, playing_age_max: 30, skills: ['dans'], languages: ['norsk'],
    }), 3);
    expect(full.score).toBe(100);
    expect(full.missingSteps).toEqual([]);
  });

  it('gir «Opprett profil» en vei videre når profilen ikke finnes', () => {
    const s = calcProfileStrength(null, 0);
    expect(s.missingSteps[0]).toEqual({ label: 'Opprett profil', done: false, target: 'profiles' });
  });
});
