import { describe, expect, it } from 'vitest';
import {
  buildSearchQueries,
  isGooglePlaceBusinessIdentityMatch,
  isGooglePlaceCompetitorSemanticallyRelevant,
  isGooglePlaceLocalOpportunityInMarket,
  isGooglePlaceOpportunityTypeMatch,
  scoreBrregNameCandidate,
  scoreGooglePlaceCandidate,
} from './role-room-agent-match-scoring.js';

describe('buildSearchQueries (F3)', () => {
  it('puts the locality-pinned query first when a hint is given', () => {
    const queries = buildSearchQueries(
      { companyName: 'Bella Pizza', websiteUrl: 'https://bellapizza.no' },
      {},
      'Tromsø',
    );
    expect(queries[0]).toBe('Bella Pizza Tromsø');
    expect(queries).toContain('Bella Pizza');
  });

  it('omits the locality query when no hint is given', () => {
    const queries = buildSearchQueries({ companyName: 'Bella Pizza' }, {});
    expect(queries.every((q) => !q.includes('Tromsø'))).toBe(true);
    expect(queries[0]).toBe('Bella Pizza');
  });

  it('dedupes and caps at 3 queries', () => {
    const queries = buildSearchQueries(
      { companyName: 'Bella Pizza', websiteUrl: 'https://bella-pizza.no' },
      { siteName: 'Bella Pizza' },
      'Oslo',
    );
    expect(queries.length).toBeLessThanOrEqual(3);
    expect(new Set(queries).size).toBe(queries.length);
  });
});

describe('scoreBrregNameCandidate (F5)', () => {
  const q = 'bella pizza';

  it('scores an exact name match', () => {
    expect(scoreBrregNameCandidate({ navn: 'Bella Pizza' }, q, null)).toBe(100);
  });

  it('website-host match lets the right entity beat a same-name one', () => {
    const withHost = scoreBrregNameCandidate(
      { navn: 'Bella Pizza AS', hjemmeside: 'https://bellapizza.no' },
      q,
      'bellapizza.no',
    );
    const nameOnly = scoreBrregNameCandidate({ navn: 'Bella Pizza AS' }, q, 'bellapizza.no');
    expect(withHost).toBeGreaterThan(nameOnly);
    expect(withHost - nameOnly).toBe(120);
  });

  it('host match rescues a non-name-overlapping entity above zero', () => {
    const score = scoreBrregNameCandidate(
      { navn: 'HC Drift AS', hjemmeside: 'http://www.bellapizza.no/kontakt' },
      q,
      'bellapizza.no',
    );
    expect(score).toBeGreaterThan(0);
  });

  it('penalizes deleted / bankrupt enterprises', () => {
    expect(scoreBrregNameCandidate({ navn: 'Bella Pizza', slettedato: '2020-01-01' }, q, null)).toBe(70);
    expect(scoreBrregNameCandidate({ navn: 'Bella Pizza', konkurs: true }, q, null)).toBe(75);
  });

  it('scores an unrelated hit at zero so the caller can reject it', () => {
    expect(scoreBrregNameCandidate({ navn: 'Rørlegger Nord AS' }, q, null)).toBe(0);
  });
});

describe('scoreGooglePlaceCandidate (F3)', () => {
  const localBusiness = {
    displayName: { text: 'Bella Pizza' },
    formattedAddress: 'Storgata 1, 9008 Tromsø, Norge',
    rating: 4.5,
    userRatingCount: 12,
  };
  const wrongTownChain = {
    displayName: { text: 'Bella Pizza' },
    formattedAddress: 'Torgallmenningen 2, 5014 Bergen, Norge',
    rating: 4.8,
    userRatingCount: 400,
  };

  it('locality hint makes the correct local business beat a bigger same-name chain', () => {
    const local = scoreGooglePlaceCandidate(localBusiness, 'Bella Pizza', null, 'Tromsø');
    const chain = scoreGooglePlaceCandidate(wrongTownChain, 'Bella Pizza', null, 'Tromsø');
    expect(local).toBeGreaterThan(chain);
  });

  it('without the locality hint the review-heavy wrong-town chain wins (the old bug)', () => {
    const local = scoreGooglePlaceCandidate(localBusiness, 'Bella Pizza', null, null);
    const chain = scoreGooglePlaceCandidate(wrongTownChain, 'Bella Pizza', null, null);
    expect(chain).toBeGreaterThan(local);
  });

  it('website-host match dominates regardless of locality', () => {
    const score = scoreGooglePlaceCandidate(
      { displayName: { text: 'Noe Annet' }, websiteUri: 'https://bellapizza.no', formattedAddress: 'X' },
      'Bella Pizza',
      'bellapizza.no',
    );
    expect(score).toBeGreaterThanOrEqual(120);
  });
});

describe('isGooglePlaceBusinessIdentityMatch', () => {
  it('rejects an exact-name business outside the verified Brreg locality', () => {
    expect(isGooglePlaceBusinessIdentityMatch(
      {
        displayName: { text: 'MedInnova' },
        formattedAddress: 'Hope Road, Kingston, Jamaica',
        rating: 4.9,
        userRatingCount: 900,
      },
      'MEDINNOVA AS',
      'medside.no',
      'Oslo',
    )).toBe(false);
  });

  it('accepts a legal-name match in the verified locality after stripping AS', () => {
    expect(isGooglePlaceBusinessIdentityMatch(
      { displayName: { text: 'MedInnova' }, formattedAddress: 'Olasrudveien 23, 1284 Oslo, Norge' },
      'MEDINNOVA AS',
      'medside.no',
      'Oslo',
    )).toBe(true);
  });

  it('accepts an exact customer-domain match even when Places uses the brand name', () => {
    expect(isGooglePlaceBusinessIdentityMatch(
      { displayName: { text: 'MedSide' }, websiteUri: 'https://www.medside.no/' },
      'MEDINNOVA AS',
      'medside.no',
      'Oslo',
    )).toBe(true);
  });
});

describe('isGooglePlaceLocalOpportunityInMarket', () => {
  it('rejects Atlanta and Jamaica results for a Brreg-verified Oslo company', () => {
    expect(isGooglePlaceLocalOpportunityInMarket(
      { formattedAddress: '1120 Hope Rd, Sandy Springs, GA 30350, USA' },
      ['Oslo'],
      null,
      15,
    )).toBe(false);
    expect(isGooglePlaceLocalOpportunityInMarket(
      { formattedAddress: 'Hope Road, Kingston, Jamaica' },
      ['Oslo'],
      null,
      15,
    )).toBe(false);
  });

  it('accepts an address in the verified Brreg locality', () => {
    expect(isGooglePlaceLocalOpportunityInMarket(
      { formattedAddress: 'Oslo Drive, Atlanta, GA 30350, USA' },
      ['Oslo'],
      null,
      8,
    )).toBe(false);

    expect(isGooglePlaceLocalOpportunityInMarket(
      { formattedAddress: 'Karl Johans gate 1, 0154 Oslo, Norge' },
      ['Oslo'],
      null,
      8,
    )).toBe(true);
  });

  it('uses verified coordinates as a hard radius when both points exist', () => {
    const oslo = { latitude: 59.9139, longitude: 10.7522 };
    expect(isGooglePlaceLocalOpportunityInMarket(
      { location: { latitude: 59.92, longitude: 10.76 }, formattedAddress: 'Oslo' },
      ['Oslo'],
      oslo,
      3,
    )).toBe(true);
    expect(isGooglePlaceLocalOpportunityInMarket(
      { location: { latitude: 33.93, longitude: -84.35 }, formattedAddress: 'Oslo Coffee, Atlanta, USA' },
      ['Oslo'],
      oslo,
      15,
    )).toBe(false);
  });

  it('fails closed without a verified coordinate or locality match', () => {
    expect(isGooglePlaceLocalOpportunityInMarket(
      { formattedAddress: 'Unknown address' },
      [],
      null,
      15,
    )).toBe(false);
  });
});

describe('isGooglePlaceCompetitorSemanticallyRelevant', () => {
  const industry = 'Helseteknologi og programvare';
  const subIndustry = 'Klinisk dokumentasjon og digitale verktøy for helsepersonell';

  it('rejects generic services, public bodies and physical care providers for health software', () => {
    expect(isGooglePlaceCompetitorSemanticallyRelevant(
      { displayName: { text: 'Andersen SEO Tjenester' }, primaryTypeDisplayName: { text: 'Tjenester' } },
      industry,
      subIndustry,
    )).toBe(false);
    expect(isGooglePlaceCompetitorSemanticallyRelevant(
      { displayName: { text: 'Næringsetaten' }, primaryTypeDisplayName: { text: 'Offentlig kontor' } },
      industry,
      subIndustry,
    )).toBe(false);
    expect(isGooglePlaceCompetitorSemanticallyRelevant(
      { displayName: { text: 'Legevakta i Oslo' }, primaryTypeDisplayName: { text: 'Sykehus' } },
      industry,
      subIndustry,
    )).toBe(false);
  });

  it('accepts a candidate only when both health and digital-product evidence exist', () => {
    expect(isGooglePlaceCompetitorSemanticallyRelevant(
      { displayName: { text: 'Nordic Clinical AI' }, primaryTypeDisplayName: { text: 'Programvareselskap for helse' } },
      industry,
      subIndustry,
    )).toBe(true);
  });

  it('does not tighten unrelated broad industries', () => {
    expect(isGooglePlaceCompetitorSemanticallyRelevant(
      { displayName: { text: 'Bella Pizza' }, primaryTypeDisplayName: { text: 'Restaurant' } },
      'Restaurant og servering',
      'Restaurant',
    )).toBe(true);
  });
});

describe('isGooglePlaceOpportunityTypeMatch', () => {
  it('rejects search-result category drift for workplace searches', () => {
    expect(isGooglePlaceOpportunityTypeMatch(
      { displayName: { text: 'Skullerud Park' }, primaryType: 'real_estate_agency', primaryTypeDisplayName: { text: 'Eiendomsmegler' } },
      'workplace',
    )).toBe(false);
    expect(isGooglePlaceOpportunityTypeMatch(
      { displayName: { text: 'Xstorage Rosenholm' }, primaryType: 'storage', primaryTypeDisplayName: { text: 'Lagring' } },
      'workplace',
    )).toBe(false);
  });

  it('accepts categories that match the intended partner role', () => {
    expect(isGooglePlaceOpportunityTypeMatch(
      { displayName: { text: 'Spaces Kvadraturen' }, primaryType: 'coworking_space', primaryTypeDisplayName: { text: 'Kontorfellesskap' } },
      'workplace',
    )).toBe(true);
    expect(isGooglePlaceOpportunityTypeMatch(
      { displayName: { text: 'Deichman Bjørvika' }, primaryType: 'library', primaryTypeDisplayName: { text: 'Bibliotek' } },
      'culture',
    )).toBe(true);
  });
});
