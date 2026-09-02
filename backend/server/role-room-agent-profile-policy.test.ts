import { describe, expect, it } from 'vitest';
import {
  normalizeBootstrapPayload,
  type RoleRoomAgentNormalizedPayload,
  type RoleRoomAgentWebsiteInsights,
} from './role-room-agent.js';

function authoritativeFallback(): RoleRoomAgentNormalizedPayload {
  const targetAudience = [
    'Leger og helsepersonell',
    'Legekontor og klinikker',
    'Helsefaglige beslutningstakere',
  ];
  const classification = {
    industry: 'Helseteknologi og programvare',
    subIndustry: 'Klinisk dokumentasjon og digitale verktøy for helsepersonell',
    businessModel: 'B2B',
    contentCategory: 'Produktdemo og faglig tillitsinnhold',
    productionApproach: 'Problem-løsning med kliniske arbeidsflyter',
  };
  return {
    generatedAt: new Date(0).toISOString(),
    provider: 'fallback',
    model: 'fallback-rule-engine',
    businessSignals: null,
    retrievalMeta: null,
    brregCompany: null,
    companyAge: null,
    agreementSuggestions: [],
    socialProfileCandidates: [],
    competitorAnalysis: {
      status: 'limited',
      source: 'fallback',
      generatedAt: new Date(0).toISOString(),
      marketContext: '',
      competitors: [],
      verifiedCompetitorCount: 0,
      averageRating: null,
      averageReviewCount: null,
      marketingOpportunities: [],
      positioningRecommendations: [],
      contentGapSuggestions: [],
      producerQuestions: [],
      limitations: [],
    },
    localPresencePlan: {
      status: 'limited',
      source: 'fallback',
      generatedAt: new Date(0).toISOString(),
      industryContext: '',
      marketArea: 'OSLO',
      radiusStrategy: [],
      nearbyOpportunities: [],
      recommendedEventConcepts: [],
      contentActivationPlan: [],
      outreachSequence: [],
      kpis: [],
      limitations: [],
    },
    marketingSetup: null,
    siteSetupAudit: null,
    merchSuppliers: null,
    companyProfile: {
      companyName: 'MEDINNOVA AS',
      websiteUrl: 'https://medside.no/',
      organizationNumber: '936564046',
      summary: 'MedSide er et digitalt verktøy for norske leger.',
      offerings: ['Medisinsk transkripsjon'],
      targetAudience,
      toneAndBrandSignals: ['Trygg'],
      ...classification,
      probableLocationAddress: 'Olasrudveien 23, 1284 OSLO',
      logoUrl: null,
    },
    intakeDraft: {
      projectGoal: '',
      deliverables: '',
      targetAudience: targetAudience.join(', '),
      keyMessage: '',
      timingConstraints: '',
      brandNotes: '',
      materialOverview: '',
      referenceLinks: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      additionalNotes: '',
    },
    planningDraft: {
      activationPlan: {
        direction: '',
        idea: '',
        activation: '',
        targetAudience: targetAudience.join(', '),
        businessGoal: '',
        coreMessage: '',
        successSignals: [],
      },
      contentLogic: {
        objective: '',
        audience: targetAudience.join(', '),
        hook: '',
        coreMessage: '',
        ...classification,
        proofPoints: [],
        callToAction: '',
        distributionPlan: '',
        successSignals: [],
      },
      brandGuide: {
        logoUrl: null,
        toneOfVoice: '',
        visualStyle: '',
        fonts: [],
        dos: [],
        donts: [],
        colors: [],
      },
    },
    storyLogicDraft: {
      concept: {
        subGenre: classification.contentCategory,
        targetAudience: targetAudience.join(', '),
      },
      contentStoryLogic: { ...classification },
      classification: { ...classification, customerJourneyFocus: 'Tillitsbygging' },
    },
    nextRecommendedSteps: [],
    projectCreationDraft: {
      projectName: '',
      description: '',
      projectType: 'content_production',
      clientCompanyName: 'MEDINNOVA AS',
      clientOrganizationNumber: '936564046',
      clientCompanyAddress: 'Olasrudveien 23, 1284 OSLO',
      location: 'Olasrudveien 23, 1284 OSLO',
      websiteUrl: 'https://medside.no/',
      suggestedAgreementNotes: '',
    },
    fieldMetadata: {},
  } as RoleRoomAgentNormalizedPayload;
}

describe('Role Room deterministic profile policy', () => {
  it('prevents synthesis from replacing verified identity, classification, audience or location', () => {
    const fallback = authoritativeFallback();
    const websiteInsights: RoleRoomAgentWebsiteInsights = {
      finalUrl: 'https://medside.no/',
      selectedPageSnippets: [],
      socialProfileCandidates: [],
    };
    const wrongSynthesis = {
      companyProfile: {
        companyName: 'MedSide Georgia',
        websiteUrl: 'https://wrong.example',
        organizationNumber: '999999999',
        targetAudience: ['Jobbsøkere'],
        industry: 'Rekruttering og employer branding',
        subIndustry: 'Talentattraksjon og kulturinnhold',
        businessModel: 'B2B/B2C',
        contentCategory: 'Employer branding og rekrutteringsinnhold',
        productionApproach: 'Kultur- og tillitsdrevet merkevareinnhold',
        probableLocationAddress: '1120 Hope Rd, Sandy Springs, GA, USA',
      },
      intakeDraft: { targetAudience: 'Jobbsøkere' },
      planningDraft: {
        activationPlan: { targetAudience: 'Jobbsøkere' },
        contentLogic: {
          audience: 'Jobbsøkere',
          industry: 'Rekruttering og employer branding',
          subIndustry: 'Talentattraksjon og kulturinnhold',
          businessModel: 'B2B/B2C',
          contentCategory: 'Employer branding og rekrutteringsinnhold',
          productionApproach: 'Kultur- og tillitsdrevet merkevareinnhold',
        },
      },
      storyLogicDraft: {
        concept: {
          subGenre: 'Employer branding og rekrutteringsinnhold',
          targetAudience: 'Jobbsøkere',
        },
        contentStoryLogic: {
          industry: 'Rekruttering og employer branding',
          subIndustry: 'Talentattraksjon og kulturinnhold',
          businessModel: 'B2B/B2C',
          contentCategory: 'Employer branding og rekrutteringsinnhold',
          productionApproach: 'Kultur- og tillitsdrevet merkevareinnhold',
        },
        classification: {
          industry: 'Rekruttering og employer branding',
          subIndustry: 'Talentattraksjon og kulturinnhold',
          businessModel: 'B2B/B2C',
          contentCategory: 'Employer branding og rekrutteringsinnhold',
          productionApproach: 'Kultur- og tillitsdrevet merkevareinnhold',
        },
      },
    };

    const result = normalizeBootstrapPayload(
      wrongSynthesis,
      { projectId: 'policy-test', websiteUrl: 'https://medside.no' },
      websiteInsights,
      fallback,
      null,
    );

    expect(result.companyProfile).toMatchObject({
      companyName: 'MEDINNOVA AS',
      websiteUrl: 'https://medside.no/',
      organizationNumber: '936564046',
      industry: 'Helseteknologi og programvare',
      businessModel: 'B2B',
      probableLocationAddress: 'Olasrudveien 23, 1284 OSLO',
    });
    expect(result.companyProfile.targetAudience).toEqual(fallback.companyProfile.targetAudience);
    expect(result.intakeDraft.targetAudience).toBe(fallback.intakeDraft.targetAudience);
    expect(result.planningDraft.contentLogic.industry).toBe('Helseteknologi og programvare');
    expect((result.storyLogicDraft.classification as Record<string, unknown>).industry)
      .toBe('Helseteknologi og programvare');
    expect((result.storyLogicDraft.contentStoryLogic as Record<string, unknown>).contentCategory)
      .toBe('Produktdemo og faglig tillitsinnhold');
    expect((result.storyLogicDraft.concept as Record<string, unknown>).targetAudience)
      .toBe(fallback.intakeDraft.targetAudience);
  });
});
