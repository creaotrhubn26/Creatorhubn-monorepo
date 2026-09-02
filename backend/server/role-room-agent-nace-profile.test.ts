import { describe, expect, it } from 'vitest';
import {
  businessModelForNace,
  classifyByNace,
  classifyWebsiteSpecialization,
} from './role-room-agent-nace-profile.js';

describe('classifyByNace — B2C-koder', () => {
  it('mapper servering (56.x) til B2C restaurant', () => {
    const profile = classifyByNace('56.101');
    expect(profile?.businessModel).toBe('B2C');
    expect(profile?.industry).toBe('Restaurant og servering');
  });

  it('mapper detaljhandel (47.x) til B2C retail', () => {
    expect(classifyByNace('47.111')?.businessModel).toBe('B2C');
    expect(classifyByNace('47.111')?.industry).toBe('Handel og retail');
  });

  it('mapper tannlege/helse (86.x) til B2C klinikk', () => {
    expect(classifyByNace('86.230')?.businessModel).toBe('B2C');
    expect(classifyByNace('86.230')?.industry).toBe('Helse og klinikk');
  });

  it('mapper frisør (96.02) til B2C skjønnhet via mest spesifikke prefiks', () => {
    const profile = classifyByNace('96.021');
    expect(profile?.businessModel).toBe('B2C');
    expect(profile?.industry).toBe('Frisør og skjønnhetspleie');
  });
});

describe('classifyByNace — B2B-koder', () => {
  it('mapper IT (62.x) til B2B', () => {
    expect(classifyByNace('62.010')?.businessModel).toBe('B2B');
    expect(classifyByNace('62.010')?.industry).toBe('IT og programvare');
  });

  it('mapper regnskap/juridisk (69.x) til B2B', () => {
    expect(classifyByNace('69.201')?.businessModel).toBe('B2B');
  });

  it('mapper engros (46.x) til B2B', () => {
    expect(classifyByNace('46.900')?.businessModel).toBe('B2B');
  });
});

describe('classifyByNace — blandet B2B/B2C', () => {
  it('mapper spesialisert bygg/håndverk (43.x) til B2B/B2C', () => {
    expect(classifyByNace('43.210')?.businessModel).toBe('B2B/B2C');
    expect(classifyByNace('43.210')?.industry).toBe('Håndverk og bygg');
  });

  it('mapper foto (74.20) til B2B/B2C', () => {
    expect(classifyByNace('74.201')?.businessModel).toBe('B2B/B2C');
  });
});

describe('classifyByNace — mest spesifikke prefiks vinner', () => {
  it('velger 96.02 (frisør) framfor en hypotetisk bredere 96-regel', () => {
    // 96.021 matcher kun 96.02-entry i tabellen (ingen bar "96"); resultat B2C.
    expect(classifyByNace('96.021')?.industry).toBe('Frisør og skjønnhetspleie');
  });

  it('velger 41.2 (bygg) for oppføring av bygninger', () => {
    expect(classifyByNace('41.200')?.industry).toBe('Bygg og entreprenør');
  });
});

describe('classifyByNace — tvetydige/ukjente koder → null', () => {
  it('returnerer null for holdingselskap (64.20) så nettside avgjør', () => {
    expect(classifyByNace('64.202')).toBeNull();
  });

  it('returnerer null for hovedkontortjenester (70.10)', () => {
    expect(classifyByNace('70.100')).toBeNull();
  });

  it('returnerer null for eiendom (68.x)', () => {
    expect(classifyByNace('68.209')).toBeNull();
  });

  it('returnerer null for tom/manglende/ugyldig kode', () => {
    expect(classifyByNace(null)).toBeNull();
    expect(classifyByNace(undefined)).toBeNull();
    expect(classifyByNace('')).toBeNull();
    expect(classifyByNace('   ')).toBeNull();
    expect(classifyByNace('X')).toBeNull();
  });
});

describe('classifyByNace — robust normalisering', () => {
  it('takler whitespace i koden', () => {
    expect(classifyByNace('56. 101')?.businessModel).toBe('B2C');
  });
});

describe('businessModelForNace', () => {
  it('returnerer bare forretningsmodellen', () => {
    expect(businessModelForNace('56.101')).toBe('B2C');
    expect(businessModelForNace('62.010')).toBe('B2B');
    expect(businessModelForNace('64.202')).toBeNull();
  });
});

describe('classifyWebsiteSpecialization', () => {
  it('recognizes health software only when vertical and product evidence coexist', () => {
    const profile = classifyWebsiteSpecialization([
      'GDPR-sikker AI-plattform for medisinsk transkripsjon og journalnotat',
      'Bygget for norske leger og helsepersonell',
    ]);
    expect(profile).toMatchObject({
      industry: 'Helseteknologi og programvare',
      businessModel: 'B2B',
    });
  });

  it('does not reclassify an ordinary clinic from health words alone', () => {
    expect(classifyWebsiteSpecialization(['Klinikk for leger og pasienter'])).toBeNull();
  });

  it('does not reclassify a generic software vendor from platform words alone', () => {
    expect(classifyWebsiteSpecialization(['AI-plattform og SaaS for prosjektstyring'])).toBeNull();
  });
});
