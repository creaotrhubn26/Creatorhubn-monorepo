import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchGooglePlacesCompetitorAnalysis,
  fetchGooglePlacesLocalPresencePlan,
  fetchMerchSuppliersAnalysis,
  type RoleRoomAgentBrregCompany,
  type RoleRoomAgentProducerBootstrapInput,
  type RoleRoomAgentWebsiteInsights,
} from './role-room-agent.js';

const previousPlacesKey = process.env.GOOGLE_PLACES_API_KEY;
const originalFetch = globalThis.fetch;

function verifiedMedinnova(): RoleRoomAgentBrregCompany {
  return {
    source: 'brreg',
    lookupStatus: 'verified',
    lookupInput: 'MedInnova AS',
    matchedBy: 'company_name',
    organizationNumber: '936564046',
    name: 'MEDINNOVA AS',
    organizationForm: { code: 'AS', description: 'Aksjeselskap' },
    industryCode: { code: '62.100', description: 'Dataprogrammeringstjenester' },
    registrationDate: null,
    foundationDate: null,
    vatRegistered: true,
    businessRegisterRegistered: true,
    employeeCount: null,
    businessAddress: 'Olasrudveien 23, 1284 OSLO',
    postalAddress: null,
    municipality: 'OSLO',
    municipalityNumber: '0301',
    website: null,
    statusFlags: {},
    statusMessage: null,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (previousPlacesKey === undefined) {
    delete process.env.GOOGLE_PLACES_API_KEY;
  } else {
    process.env.GOOGLE_PLACES_API_KEY = previousPlacesKey;
  }
});

describe('Role Room local-presence fail-closed policy', () => {
  it('does not invent event, content or outreach plans without verified Places candidates', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const input: RoleRoomAgentProducerBootstrapInput = {
      projectId: 'medside-policy-test',
      websiteUrl: 'https://medside.no',
      companyName: 'MEDINNOVA AS',
    };
    const websiteInsights: RoleRoomAgentWebsiteInsights = {
      finalUrl: 'https://medside.no/',
      pageTitle: 'MedSide',
      metaDescription: 'GDPR-sikker AI-plattform for medisinsk transkripsjon og journalnotat.',
      textSnippet: 'Bygget for norske leger og helsepersonell.',
      selectedPageSnippets: [],
      socialProfileCandidates: [],
    };
    const brregCompany: RoleRoomAgentBrregCompany = {
      source: 'brreg',
      lookupStatus: 'verified',
      lookupInput: 'MedInnova AS',
      matchedBy: 'company_name',
      organizationNumber: '936564046',
      name: 'MEDINNOVA AS',
      organizationForm: { code: 'AS', description: 'Aksjeselskap' },
      industryCode: { code: '62.100', description: 'Dataprogrammeringstjenester' },
      registrationDate: null,
      foundationDate: null,
      vatRegistered: true,
      businessRegisterRegistered: true,
      employeeCount: null,
      businessAddress: 'Olasrudveien 23, 1284 OSLO',
      postalAddress: null,
      municipality: 'OSLO',
      municipalityNumber: '0301',
      website: null,
      statusFlags: {},
      statusMessage: null,
    };

    const result = await fetchGooglePlacesLocalPresencePlan(
      input,
      websiteInsights,
      null,
      brregCompany,
    );

    expect(result.status).toBe('limited');
    expect(result.marketArea).toBe('OSLO');
    expect(result.industryContext).toContain('Helseteknologi og programvare');
    expect(result.nearbyOpportunities).toEqual([]);
    expect(result.recommendedEventConcepts).toEqual([]);
    expect(result.contentActivationPlan).toEqual([]);
    expect(result.outreachSequence).toEqual([]);
    expect(result.kpis).toEqual([]);
  });

  it('runs the Places searches concurrently and filters wrong-country results before planning', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
    globalThis.fetch = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return new Response(JSON.stringify({
        places: [
          {
            id: 'atlanta',
            displayName: { text: 'Hub 33 ATL' },
            formattedAddress: '1145 Hightower Trail, Atlanta, GA 30350, USA',
          },
          {
            id: 'oslo',
            displayName: { text: 'Oslo Helsehub' },
            formattedAddress: 'Forskningsveien 1, 0373 Oslo, Norge',
          },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const startedAt = Date.now();
    const result = await fetchGooglePlacesLocalPresencePlan(
      {
        projectId: 'medside-parallel-test',
        websiteUrl: 'https://medside.no',
        companyName: 'MEDINNOVA AS',
      },
      {
        finalUrl: 'https://medside.no/',
        metaDescription: 'GDPR-sikker AI-plattform for medisinsk transkripsjon og journalnotat.',
        textSnippet: 'Bygget for norske leger og helsepersonell.',
        selectedPageSnippets: [],
        socialProfileCandidates: [],
      },
      null,
      verifiedMedinnova(),
    );

    expect(Date.now() - startedAt).toBeLessThan(180);
    expect(result.nearbyOpportunities.map((entry) => entry.name)).toEqual(['Oslo Helsehub']);
    expect(JSON.stringify(result)).not.toMatch(/Atlanta|Hightower|Hub 33/i);
    expect(result.recommendedEventConcepts.every((entry) => !/Hub 33/i.test(entry))).toBe(true);
  });

  it('filters wrong-country Places candidates from competitor analysis', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
    globalThis.fetch = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return new Response(JSON.stringify({
        places: [
          {
            id: 'atlanta-competitor',
            displayName: { text: 'MedSide Georgia' },
            formattedAddress: '1120 Hope Rd, Sandy Springs, GA 30350, USA',
            rating: 4.8,
            userRatingCount: 524,
          },
          {
            id: 'oslo-competitor',
            displayName: { text: 'Oslo Klinisk AI' },
            formattedAddress: 'Gaustadalléen 21, 0349 Oslo, Norge',
            primaryTypeDisplayName: { text: 'Programvareselskap' },
          },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const startedAt = Date.now();
    const result = await fetchGooglePlacesCompetitorAnalysis(
      {
        projectId: 'medside-competitor-test',
        websiteUrl: 'https://medside.no',
        companyName: 'MEDINNOVA AS',
      },
      {
        finalUrl: 'https://medside.no/',
        metaDescription: 'GDPR-sikker AI-plattform for medisinsk transkripsjon og journalnotat.',
        textSnippet: 'Bygget for norske leger og helsepersonell.',
        selectedPageSnippets: [],
        socialProfileCandidates: [],
      },
      null,
      verifiedMedinnova(),
    );

    expect(Date.now() - startedAt).toBeLessThan(180);
    expect(result.competitors.map((entry) => entry.name)).toEqual(['Oslo Klinisk AI']);
    expect(JSON.stringify(result)).not.toMatch(/Atlanta|Hope Rd|MedSide Georgia/i);
  });

  it('filters wrong-country Places candidates from merch discovery', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
    globalThis.fetch = vi.fn(async (input) => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      if (String(input).includes('data.brreg.no')) {
        return new Response(JSON.stringify({ _embedded: { enheter: [] } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        places: [
          {
            id: 'atlanta-merch',
            displayName: { text: 'Atlanta Promo' },
            formattedAddress: '1 Glenlake Pkwy, Sandy Springs, GA 30328, USA',
          },
          {
            id: 'oslo-merch',
            displayName: { text: 'Oslo Profil' },
            formattedAddress: 'Storgata 1, 0155 Oslo, Norge',
          },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const startedAt = Date.now();
    const result = await fetchMerchSuppliersAnalysis(
      { projectId: 'medside-merch-test', websiteUrl: 'https://medside.no', companyName: 'MEDINNOVA AS' },
      { finalUrl: 'https://medside.no/', selectedPageSnippets: [], socialProfileCandidates: [] },
      null,
      verifiedMedinnova(),
    );

    expect(Date.now() - startedAt).toBeLessThan(180);
    expect(result.suppliers.map((entry) => entry.name)).toEqual(['Oslo Profil']);
    expect(JSON.stringify(result)).not.toMatch(/Atlanta|Glenlake|Sandy Springs/i);
  });
});
