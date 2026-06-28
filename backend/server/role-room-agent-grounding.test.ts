import { describe, expect, it } from 'vitest';
import {
  groundBootstrapPayload,
  type RoleRoomAgentGroundablePayload,
  type RoleRoomAgentGroundingSources,
} from './role-room-agent-grounding.js';

function baseProfile(overrides: Record<string, unknown> = {}) {
  return {
    companyName: 'Holycrust',
    summary: 'Et lokalt bakeri i Tromsø som lager surdeigsbrød.',
    industry: 'Bakeri',
    ...overrides,
  } as Record<string, unknown>;
}

describe('groundBootstrapPayload — organizationNumber', () => {
  it('keeps an org-number that matches Brreg (digits-only compare)', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      companyProfile: baseProfile({ organizationNumber: '933 469 395' }),
    };
    const sources: RoleRoomAgentGroundingSources = {
      brregCompany: { organizationNumber: '933469395' },
    };
    const { payload: grounded, strippedReasons } = groundBootstrapPayload(payload, sources);
    expect(grounded.companyProfile?.organizationNumber).toBe('933 469 395');
    expect(strippedReasons).not.toContain('grounding_stripped_ungrounded_orgnr');
  });

  it('strips an org-number that does not match Brreg', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      companyProfile: baseProfile({ organizationNumber: '999 888 777' }),
    };
    const sources: RoleRoomAgentGroundingSources = {
      brregCompany: { organizationNumber: '933469395' },
    };
    const { payload: grounded, strippedReasons } = groundBootstrapPayload(payload, sources);
    expect(grounded.companyProfile?.organizationNumber).toBeNull();
    expect(strippedReasons).toContain('grounding_stripped_ungrounded_orgnr');
  });

  it('strips an org-number when Brreg has no number at all', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      companyProfile: baseProfile({ organizationNumber: '123456789' }),
    };
    const { payload: grounded, strippedReasons } = groundBootstrapPayload(payload, {});
    expect(grounded.companyProfile?.organizationNumber).toBeNull();
    expect(strippedReasons).toContain('grounding_stripped_ungrounded_orgnr');
  });

  it('does not mutate the input payload (pure)', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      companyProfile: baseProfile({ organizationNumber: '999 888 777' }),
    };
    const sources: RoleRoomAgentGroundingSources = {
      brregCompany: { organizationNumber: '933469395' },
    };
    groundBootstrapPayload(payload, sources);
    expect(payload.companyProfile?.organizationNumber).toBe('999 888 777');
  });
});

describe('groundBootstrapPayload — competitors', () => {
  const sources: RoleRoomAgentGroundingSources = {
    competitorAnalysis: {
      competitors: [
        { name: 'Bakehuset AS', websiteUrl: 'https://www.bakehuset.no/butikk' },
        { name: 'Surdeig & Co', websiteUrl: 'https://surdeig.no' },
      ],
    },
  };

  it('keeps a grounded competitor that is verified (name match)', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      competitorAnalysis: {
        competitors: [{ name: 'bakehuset as', websiteUrl: null, status: 'verified' }],
      },
    };
    const { payload: grounded, strippedReasons } = groundBootstrapPayload(payload, sources);
    expect(grounded.competitorAnalysis?.competitors?.[0]?.status).toBe('verified');
    expect(strippedReasons).toHaveLength(0);
  });

  it('keeps a grounded competitor that is verified (host match)', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      competitorAnalysis: {
        competitors: [{ name: 'A different brand name', websiteUrl: 'http://bakehuset.no', status: 'verified' }],
      },
    };
    const { payload: grounded, strippedReasons } = groundBootstrapPayload(payload, sources);
    expect(grounded.competitorAnalysis?.competitors?.[0]?.status).toBe('verified');
    expect(strippedReasons).toHaveLength(0);
  });

  it('downgrades an invented verified competitor to likely', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      competitorAnalysis: {
        competitors: [
          { name: 'Bakehuset AS', websiteUrl: 'https://bakehuset.no', status: 'verified' },
          { name: 'Totally Invented Bakery', websiteUrl: 'https://invented.example', status: 'verified' },
        ],
      },
    };
    const { payload: grounded, strippedReasons } = groundBootstrapPayload(payload, sources);
    const [first, second] = grounded.competitorAnalysis?.competitors ?? [];
    expect(first?.status).toBe('verified');
    expect(second?.status).toBe('likely');
    expect(strippedReasons).toContain('grounding_downgraded_unverified_competitor');
    expect(strippedReasons).toHaveLength(1);
  });

  it('leaves non-verified competitors untouched', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      competitorAnalysis: {
        competitors: [{ name: 'Maybe A Competitor', websiteUrl: 'https://maybe.example', status: 'needs_review' }],
      },
    };
    const { payload: grounded, strippedReasons } = groundBootstrapPayload(payload, sources);
    expect(grounded.competitorAnalysis?.competitors?.[0]?.status).toBe('needs_review');
    expect(strippedReasons).toHaveLength(0);
  });
});

describe('groundBootstrapPayload — contact fields', () => {
  const websiteInsights = {
    finalUrl: 'https://holycrust.no',
    pageTitle: 'Holycrust — surdeigsbakeri',
    metaDescription: 'Kontakt oss på post@holycrust.no eller ring 776 12 345.',
    textSnippet: 'Velkommen til bakeriet vårt.',
    selectedPageSnippets: [
      { url: 'https://holycrust.no/kontakt', title: 'Kontakt', snippet: 'Ring oss på 776 12 345.' },
    ],
    socialProfileCandidates: [],
  };

  it('keeps a grounded email and phone that appear on the website', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      companyProfile: baseProfile({ email: 'post@holycrust.no', phone: '776 12 345' }),
    };
    const { payload: grounded, strippedReasons } = groundBootstrapPayload(payload, { websiteInsights });
    expect(grounded.companyProfile?.email).toBe('post@holycrust.no');
    expect(grounded.companyProfile?.phone).toBe('776 12 345');
    expect(strippedReasons).toHaveLength(0);
  });

  it('strips an invented email and phone not found anywhere', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      companyProfile: baseProfile({
        email: 'kontakt@fakebakeri.no',
        phone: '+47 911 22 333',
      }),
    };
    const { payload: grounded, strippedReasons } = groundBootstrapPayload(payload, { websiteInsights });
    expect(grounded.companyProfile?.email).toBeNull();
    expect(grounded.companyProfile?.phone).toBeNull();
    expect(strippedReasons.filter((r) => r === 'grounding_stripped_ungrounded_contact')).toHaveLength(2);
  });

  it('does not touch prose fields that merely mention numbers', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      companyProfile: baseProfile({
        summary: 'Bakeriet ble grunnlagt i 2015 og har 12 ansatte.',
      }),
    };
    const { payload: grounded, strippedReasons } = groundBootstrapPayload(payload, { websiteInsights });
    expect(grounded.companyProfile?.summary).toBe('Bakeriet ble grunnlagt i 2015 og har 12 ansatte.');
    expect(strippedReasons).toHaveLength(0);
  });

  it('grounds a contact found in social profile candidates', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      companyProfile: baseProfile({ email: 'hello@brand.io' }),
      socialProfileCandidates: [
        { url: 'https://instagram.com/brand', handle: '@brand', displayName: 'hello@brand.io' },
      ],
    };
    const { payload: grounded, strippedReasons } = groundBootstrapPayload(payload, {});
    expect(grounded.companyProfile?.email).toBe('hello@brand.io');
    expect(strippedReasons).toHaveLength(0);
  });

  it('grounds a contact found in Google Places business signals (not just the website)', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      companyProfile: baseProfile({ email: 'kontakt@holycrust.no' }),
    };
    const { payload: grounded, strippedReasons } = groundBootstrapPayload(payload, {
      businessSignals: {
        displayName: 'Holy Crust AS',
        formattedAddress: 'Storgata 1, Tromsø',
        reviewSummary: 'Bestill på kontakt@holycrust.no — rask levering.',
      },
    });
    expect(grounded.companyProfile?.email).toBe('kontakt@holycrust.no');
    expect(strippedReasons).toHaveLength(0);
  });
});

describe('groundBootstrapPayload — defensive / no-op behaviour', () => {
  it('no-ops cleanly on an empty payload and empty sources', () => {
    const payload: RoleRoomAgentGroundablePayload = {};
    const { payload: grounded, strippedReasons } = groundBootstrapPayload(payload, {});
    expect(grounded).toBe(payload);
    expect(strippedReasons).toEqual([]);
  });

  it('handles partial inputs (no companyProfile, no competitors) without throwing', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      socialProfileCandidates: [],
    };
    expect(() => groundBootstrapPayload(payload, { websiteInsights: null, brregCompany: null })).not.toThrow();
    const { strippedReasons } = groundBootstrapPayload(payload, {});
    expect(strippedReasons).toEqual([]);
  });

  it('handles a competitor list with malformed entries', () => {
    const payload = {
      competitorAnalysis: {
        competitors: [null, undefined, { status: 'verified' }, 'oops'],
      },
    } as unknown as RoleRoomAgentGroundablePayload;
    expect(() => groundBootstrapPayload(payload, {})).not.toThrow();
    // The malformed verified entry has no name/host → downgraded.
    const { payload: grounded } = groundBootstrapPayload(payload, {});
    const verified = (grounded.competitorAnalysis?.competitors ?? []).find(
      (c) => c && typeof c === 'object' && 'status' in c,
    );
    expect(verified?.status).toBe('likely');
  });

  it('returns the same payload reference when nothing changes', () => {
    const payload: RoleRoomAgentGroundablePayload = {
      companyProfile: baseProfile({ organizationNumber: '933469395' }),
      competitorAnalysis: { competitors: [{ name: 'X', status: 'needs_review' }] },
    };
    const sources: RoleRoomAgentGroundingSources = {
      brregCompany: { organizationNumber: '933469395' },
    };
    const { payload: grounded } = groundBootstrapPayload(payload, sources);
    expect(grounded).toBe(payload);
  });

  it('never throws on null-ish payload', () => {
    expect(() => groundBootstrapPayload(null as unknown as RoleRoomAgentGroundablePayload, {})).not.toThrow();
    expect(() => groundBootstrapPayload(undefined as unknown as RoleRoomAgentGroundablePayload, {})).not.toThrow();
  });
});
