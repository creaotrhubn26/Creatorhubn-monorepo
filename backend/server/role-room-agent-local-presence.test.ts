import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchGooglePlacesCompetitorAnalysis,
  fetchWebCompetitorAnalysis,
  fetchGooglePlacesLocalPresencePlan,
  fetchMerchSuppliersAnalysis,
  type RoleRoomAgentBrregCompany,
  type RoleRoomAgentProducerBootstrapInput,
  type RoleRoomAgentWebsiteInsights,
} from './role-room-agent.js';

const previousPlacesKey = process.env.GOOGLE_PLACES_API_KEY;
const previousSearchKey = process.env.GOOGLE_SEARCH_API_KEY;
const previousSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
const previousAnthropicKey = process.env.ANTHROPIC_API_KEY;
const previousOpenAiKey = process.env.OPENAI_API_KEY;
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
  if (previousSearchKey === undefined) {
    delete process.env.GOOGLE_SEARCH_API_KEY;
  } else {
    process.env.GOOGLE_SEARCH_API_KEY = previousSearchKey;
  }
  if (previousSearchEngineId === undefined) {
    delete process.env.GOOGLE_SEARCH_ENGINE_ID;
  } else {
    process.env.GOOGLE_SEARCH_ENGINE_ID = previousSearchEngineId;
  }
  if (previousAnthropicKey === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = previousAnthropicKey;
  }
  if (previousOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = previousOpenAiKey;
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
            primaryType: 'coworking_space',
            primaryTypeDisplayName: { text: 'Kontorfellesskap' },
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

  it('finds specialized Norwegian software competitors from web results without duplicates or self matches', async () => {
    process.env.GOOGLE_SEARCH_API_KEY = 'search-key';
    process.env.GOOGLE_SEARCH_ENGINE_ID = 'engine-id';
    let requestUrl = '';
    globalThis.fetch = vi.fn(async (input) => {
      requestUrl = String(input);
      return new Response(JSON.stringify({
        items: [
          {
            title: 'MedSide – AI journalnotat for leger',
            link: 'https://medside.no/',
            snippet: 'AI-plattform for medisinsk transkripsjon og journalnotat.',
          },
          {
            title: 'Notamed – AI-drevet journalskriving',
            link: 'https://notamed.no/produkt',
            snippet: 'Programvare for leger med medisinsk transkripsjon og klinisk journalnotat.',
          },
          {
            title: 'Notamed demo',
            link: 'https://www.notamed.no/demo',
            snippet: 'AI journalnotat og transkripsjon for leger.',
          },
          {
            title: 'Oversikt over AI i helsetjenesten',
            link: 'https://www.dagensmedisin.no/ai-journalnotat',
            snippet: 'Artikkel om programvare for klinisk dokumentasjon og leger.',
          },
          {
            title: 'MedSide Georgia fysioterapi',
            link: 'https://care.example.com/',
            snippet: 'Fysioterapi, ergoterapi og rehabilitering for pasienter.',
          },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const result = await fetchWebCompetitorAnalysis(
      {
        projectId: 'medside-web-competitor-test',
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
      verifiedMedinnova(),
    );

    expect(result.status).toBe('ready');
    expect(result.competitors).toHaveLength(1);
    expect(result.competitors[0]).toMatchObject({
      source: 'web_search',
      name: 'Notamed',
      status: 'likely',
      requiresManualConfirmation: true,
    });
    expect(JSON.stringify(result)).not.toMatch(/MedSide Georgia|dagensmedisin/i);
    const url = new URL(requestUrl);

    expect(url.origin).toBe('https://customsearch.googleapis.com');
    expect(url.searchParams.get('siteSearch')).toBe('medside.no');
    expect(url.searchParams.get('siteSearchFilter')).toBe('e');
    expect(url.searchParams.get('lr')).toBe('lang_no');
    expect(url.searchParams.get('cr')).toBe('countryNO');
  });
  it('uses only Anthropic web-search candidates that match an actual cited result URL', async () => {
    delete process.env.GOOGLE_SEARCH_API_KEY;
    delete process.env.GOOGLE_SEARCH_ENGINE_ID;
    process.env.ANTHROPIC_API_KEY = 'anthropic-test-key';
    let requestBody: Record<string, unknown> | null = null;
    globalThis.fetch = vi.fn(async (input, init) => {
      expect(String(input)).toContain('api.anthropic.com/v1/messages');
      requestBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      return new Response(JSON.stringify({
        id: 'msg_role_room_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-6',
        content: [
          {
            type: 'web_search_tool_result',
            tool_use_id: 'srvtoolu_role_room_test',
            content: [{
              type: 'web_search_result',
              title: 'Journalia – KI-assistent for helsepersonell',
              url: 'https://journalia.no/produkt',
              encrypted_content: 'grounded-result',
            }],
          },
          {
            type: 'text',
            text: JSON.stringify({
              competitors: [
                {
                  name: 'Journalia',
                  url: 'https://journalia.no/produkt',
                  evidence: 'KI-programvare for klinisk journalnotat og medisinsk dokumentasjon for helsepersonell.',
                },
                {
                  name: 'Oppdiktet klinikk',
                  url: 'https://uncited.example/produkt',
                  evidence: 'Medisinsk AI-programvare for leger.',
                },
              ],
            }),
          },
        ],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const result = await fetchWebCompetitorAnalysis(
      {
        projectId: 'medside-anthropic-web-test',
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
      verifiedMedinnova(),
    );

    expect(result.competitors).toHaveLength(1);
    expect(result.competitors[0]).toMatchObject({ name: 'Journalia', source: 'web_search' });
    expect(JSON.stringify(result)).not.toContain('Oppdiktet klinikk');
    expect(requestBody).toMatchObject({
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
    });
  });

  it('falls through an empty Google CSE result to sourced Anthropic competitors', async () => {
    process.env.GOOGLE_SEARCH_API_KEY = 'google-test-key';
    process.env.GOOGLE_SEARCH_ENGINE_ID = 'google-test-engine';
    process.env.ANTHROPIC_API_KEY = 'anthropic-test-key';
    delete process.env.OPENAI_API_KEY;
    const requestedUrls: string[] = [];
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes('customsearch.googleapis.com')) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      expect(url).toContain('api.anthropic.com/v1/messages');
      return new Response(JSON.stringify({
        id: 'msg_role_room_provider_fallback',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-6',
        content: [
          {
            type: 'web_search_tool_result',
            tool_use_id: 'srvtoolu_provider_fallback',
            content: [
              {
                type: 'web_search_result',
                title: 'Talk!t – AI journalføring for helsepersonell',
                url: 'https://talkit.no/',
                encrypted_content: 'grounded-talkit',
              },
              {
                type: 'web_search_result',
                title: 'Journalia – KI-drevet dokumentasjon for helse og omsorg',
                url: 'https://www.journalia.no/no',
                encrypted_content: 'grounded-journalia',
              },
            ],
          },
          {
            type: 'text',
            text: JSON.stringify({
              competitors: [
                {
                  name: 'Talk!t',
                  url: 'https://talkit.no/',
                  evidence: 'AI journalføring og strukturerte journalnotater for helsepersonell.',
                },
                {
                  name: 'Journalia',
                  url: 'https://www.journalia.no/no',
                  evidence: 'KI-programvare for klinisk dokumentasjon og journalnotater for helsepersonell.',
                },
              ],
            }),
          },
        ],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const result = await fetchWebCompetitorAnalysis(
      {
        projectId: 'medside-provider-fallback-test',
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
      verifiedMedinnova(),
    );

    expect(result.status).toBe('ready');
    expect(result.competitors.map((entry) => entry.name)).toEqual(['Talk!t', 'Journalia']);
    expect(result.competitors.every((entry) => entry.source === 'web_search')).toBe(true);
    expect(requestedUrls[0]).toContain('customsearch.googleapis.com');
    expect(requestedUrls[1]).toContain('api.anthropic.com/v1/messages');
  });

  it('verifies first-party clinical product pages when all search providers are unavailable', async () => {
    delete process.env.GOOGLE_SEARCH_API_KEY;
    delete process.env.GOOGLE_SEARCH_ENGINE_ID;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('talkit.no')) {
        return new Response(
          '<html><head><title>Talk!t – AI journalføring for helsepersonell</title><meta name="description" content="Automatisk journalføring med kunstig intelligens og strukturerte journalnotater for helsepersonell."></head><body></body></html>',
          { status: 200, headers: { 'content-type': 'text/html' } },
        );
      }
      if (url.includes('journalia.no')) {
        return new Response(
          '<html><head><title>Journalia - KI-drevet dokumentasjon for helse og omsorg</title><meta name="description" content="Klinisk dokumentasjon som transkriberer pasientkonsultasjoner og genererer journalnotater for helsepersonell."></head><body></body></html>',
          { status: 200, headers: { 'content-type': 'text/html' } },
        );
      }
      return new Response('', { status: 404 });
    }) as typeof fetch;

    const result = await fetchWebCompetitorAnalysis(
      {
        projectId: 'medside-first-party-fallback-test',
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
      verifiedMedinnova(),
    );

    expect(result.status).toBe('ready');
    expect(result.competitors.map((entry) => entry.name)).toEqual(['Talk!t', 'Journalia']);
    expect(result.competitors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        websiteUrl: 'https://talkit.no/',
        evidence: expect.arrayContaining([
          expect.objectContaining({ label: 'Verifisert på leverandørens egen produktside' }),
        ]),
      }),
    ]));
  });

  it('falls back to OpenAI web search and keeps only candidates backed by response citations', async () => {
    delete process.env.GOOGLE_SEARCH_API_KEY;
    delete process.env.GOOGLE_SEARCH_ENGINE_ID;
    process.env.ANTHROPIC_API_KEY = 'anthropic-test-key';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    const requestBodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = vi.fn(async (input, init) => {
      requestBodies.push(JSON.parse(String(init?.body || '{}')) as Record<string, unknown>);
      if (String(input).includes('api.anthropic.com/v1/messages')) {
        return new Response(JSON.stringify({
          type: 'error',
          error: { type: 'invalid_request_error', message: 'Web search is disabled.' },
        }), { status: 400, headers: { 'content-type': 'application/json' } });
      }
      expect(String(input)).toBe('https://api.openai.com/v1/responses');
      return new Response(JSON.stringify({
        output: [
          {
            type: 'web_search_call',
            status: 'completed',
            action: {
              type: 'search',
              sources: [
                { type: 'url', url: 'https://noteless.no/for-leger' },
              ],
            },
          },
          {
            type: 'message',
            content: [{
              type: 'output_text',
              text: JSON.stringify({
                competitors: [
                  {
                    name: 'Noteless',
                    url: 'https://noteless.no/for-leger',
                    evidence: 'Medisinsk AI-programvare for klinisk journalnotat og norske leger.',
                  },
                  {
                    name: 'Uten kilde',
                    url: 'https://uncited.example/produkt',
                    evidence: 'Medisinsk programvare for leger.',
                  },
                ],
              }),
              annotations: [{
                type: 'url_citation',
                title: 'Noteless for leger',
                url: 'https://noteless.no/for-leger',
              }],
            }],
          },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const result = await fetchWebCompetitorAnalysis(
      {
        projectId: 'medside-openai-web-fallback-test',
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
      verifiedMedinnova(),
    );

    expect(result.status).toBe('ready');
    expect(result.competitors).toHaveLength(1);
    expect(result.competitors[0]).toMatchObject({ name: 'Noteless', source: 'web_search' });
    expect(result.competitors[0]?.evidence).toContainEqual(expect.objectContaining({
      label: 'Funnet via OpenAI websøk',
    }));
    expect(JSON.stringify(result)).not.toContain('Uten kilde');
    expect(requestBodies[1]).toMatchObject({
      model: 'gpt-5',
      tools: [{
        type: 'web_search',
        search_context_size: 'medium',
        user_location: {
          type: 'approximate',
          country: 'NO',
          city: 'Oslo',
          region: 'Oslo',
          timezone: 'Europe/Oslo',
        },
      }],
      tool_choice: 'required',
      include: ['web_search_call.action.sources'],
    });
  });

  it('exposes a safe OpenAI web-search status without leaking provider error text', async () => {
    delete process.env.GOOGLE_SEARCH_API_KEY;
    delete process.env.GOOGLE_SEARCH_ENGINE_ID;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'openai-test-key';
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      error: { message: 'sensitive upstream detail' },
    }), { status: 429, headers: { 'content-type': 'application/json' } })) as typeof fetch;

    const result = await fetchWebCompetitorAnalysis(
      {
        projectId: 'medside-openai-web-status-test',
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
      verifiedMedinnova(),
    );

    expect(result.status).toBe('limited');
    expect(result.limitations).toContain(
      'OpenAI websøk traff leverandørens kapasitets- eller kvotegrense (HTTP 429). Ingen webkandidater vises uten kilde.',
    );
    expect(JSON.stringify(result)).not.toContain('sensitive upstream detail');
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
            primaryTypeDisplayName: { text: 'Profilklær og broderi' },
            formattedAddress: 'Storgata 1, 0155 Oslo, Norge',
          },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const startedAt = Date.now();
    const result = await fetchMerchSuppliersAnalysis(
      { projectId: 'medside-merch-test', websiteUrl: 'https://medside.no', companyName: 'MEDINNOVA AS' },
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
    expect(result.suppliers.map((entry) => entry.name)).toEqual(['Oslo Profil']);
    expect(JSON.stringify(result)).not.toMatch(/Atlanta|Glenlake|Sandy Springs/i);
    expect(result.recommendations.map((entry) => entry.productId)).toEqual([
      'polo', 'mug', 'totebag', 'hoodie',
    ]);
    expect(new Set(result.recommendations.map((entry) => entry.productId)).size).toBe(
      result.recommendations.length,
    );
    expect(result.recommendations[0]).toMatchObject({
      productLabel: 'Brodert polo',
      supplierMatch: null,
    });
    expect(result.recommendations[0]?.rationale).toMatch(/MEDINNOVA AS.*helseteknologi/i);
  });

  it('matches only website-documented category and technique and never reuses a supplier', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('data.brreg.no')) {
        return new Response(JSON.stringify({ _embedded: { enheter: [] } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('osloprofil.example')) {
        return new Response(`<!doctype html><html><head><title>Oslo Profil</title><meta name="description" content="Profilklær med broderi"></head><body>Vi leverer polo, skjorter og hoodies med broderi til bedrifter. Kontakt post@osloprofil.no eller 22 33 44 55 for tilbud.</body></html>`, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
      return new Response(JSON.stringify({
        places: [{
          id: 'oslo-merch-documented',
          displayName: { text: 'Oslo Profil' },
          primaryTypeDisplayName: { text: 'Profilklær og broderi' },
          formattedAddress: 'Storgata 1, 0155 Oslo, Norge',
          websiteUri: 'https://osloprofil.example',
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const result = await fetchMerchSuppliersAnalysis(
      { projectId: 'medside-merch-proof-test', websiteUrl: 'https://medside.no', companyName: 'MEDINNOVA AS' },
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

    expect(result.suppliers[0]).toMatchObject({
      websiteSignalsEnriched: true,
      websiteConfirmedTechniques: ['embroidery'],
      websiteConfirmedProductCategories: ['apparel'],
    });
    expect(result.recommendations[0]?.supplierMatch).toMatchObject({ name: 'Oslo Profil' });
    expect(result.recommendations[3]?.supplierMatch).toBeNull();
    const matchedNames = result.recommendations.map((entry) => entry.supplierMatch?.name).filter(Boolean);
    expect(new Set(matchedNames).size).toBe(matchedNames.length);
  });

  it('limits website enrichment and prioritizes merch-specific suppliers', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('data.brreg.no')) {
        return new Response(JSON.stringify({ _embedded: { enheter: [] } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('.example')) {
        return new Response(
          '<!doctype html><html><head><title>Profilprodukter</title></head><body>Vi leverer profilklær, polo, hoodie og tekstiltrykk med broderi og silketrykk til norske bedrifter. Kontakt oss for tilbud og vareprøver.</body></html>',
          { status: 200, headers: { 'content-type': 'text/html' } },
        );
      }
      return new Response(JSON.stringify({
        places: [
          {
            id: 'generic-office',
            displayName: { text: 'Generic Office AS' },
            formattedAddress: 'Storgata 1, 0155 Oslo, Norge',
            websiteUri: 'https://generic-office.example',
          },
          {
            id: 'merchberry',
            displayName: { text: 'Merchberry AS' },
            formattedAddress: 'Storgata 2, 0155 Oslo, Norge',
            websiteUri: 'https://merchberry.example',
          },
          {
            id: 'tekstiltrykk',
            displayName: { text: 'Oslo Tekstiltrykk' },
            formattedAddress: 'Storgata 3, 0155 Oslo, Norge',
            websiteUri: 'https://tekstiltrykk.example',
          },
          {
            id: 'another-company',
            displayName: { text: 'Another Company' },
            formattedAddress: 'Storgata 4, 0155 Oslo, Norge',
            websiteUri: 'https://another-company.example',
          },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const result = await fetchMerchSuppliersAnalysis(
      { projectId: 'bounded-merch-refresh', companyName: 'MEDINNOVA AS' },
      { finalUrl: 'https://medside.no/', selectedPageSnippets: [], socialProfileCandidates: [] },
      null,
      verifiedMedinnova(),
      { websiteEnrichmentLimit: 2, websiteEnrichmentConcurrency: 2 },
    );

    const enriched = result.suppliers.filter((supplier) => supplier.websiteSignalsEnriched);
    expect(enriched).toHaveLength(2);
    expect(enriched.every((supplier) => /merch|tekstiltrykk/i.test(supplier.name))).toBe(true);
    expect(result.suppliers.find((supplier) => supplier.name === 'Generic Office AS')?.websiteSignalsEnriched).not.toBe(true);
  });

  it('retains fast merch results and reports partial provider timeouts', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('data.brreg.no') && url.includes('naeringskode=18.12')) {
        return new Response(JSON.stringify({
          _embedded: {
            enheter: [{
              organisasjonsnummer: '999111222',
              navn: 'Oslo Profil AS',
              hjemmeside: 'https://osloprofil.example',
              forretningsadresse: {
                adresse: ['Storgata 1'],
                postnummer: '0155',
                poststed: 'OSLO',
                kommunenummer: '0301',
              },
            }],
          },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const timeout = new Error('request timed out');
      timeout.name = 'TimeoutError';
      throw timeout;
    }) as typeof fetch;

    const result = await fetchMerchSuppliersAnalysis(
      { projectId: 'medside-merch-partial-test', websiteUrl: 'https://medside.no', companyName: 'MEDINNOVA AS' },
      { finalUrl: 'https://medside.no/', selectedPageSnippets: [], socialProfileCandidates: [] },
      null,
      verifiedMedinnova(),
      { requestTimeoutMs: 300, enrichWebsiteSignals: false },
    );

    expect(result.status).toBe('ready');
    expect(result.suppliers).toHaveLength(1);
    expect(result.suppliers[0]).toMatchObject({
      name: 'Oslo Profil AS',
      organizationNumber: '999111222',
      source: 'brreg_nace',
    });
    expect(result.partial).toBe(true);
    expect(result.timedOutSourceCount).toBeGreaterThan(0);
    expect(result.limitations.join(' ')).toContain('delresultater er beholdt');
  });
});
