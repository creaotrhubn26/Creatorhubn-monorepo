import settingsService from './settingsService';
import { authSessionService } from './authSessionService';

const AGENT_SNAPSHOT_NAMESPACE = 'role-room-agent-snapshot';

export interface RoleRoomAgentAccess {
  success: boolean;
  featureId: string;
  enabled: boolean;
  isAdmin: boolean;
  allowed: boolean;
  stage: 'admin_test' | string;
  audience?: string;
  provider?: 'openai' | string;
  providerConfigured?: boolean;
  defaultModel?: string;
  googlePlacesConfigured?: boolean;
  cohereConfigured?: boolean;
  cohereRerankModel?: string;
  brregConfigured?: boolean;
}

export interface RoleRoomAgentBrandColor {
  label: string;
  hex: string;
  usage?: string;
}

export interface RoleRoomAgentReviewQuote {
  author?: string;
  rating?: number | null;
  text: string;
  relativeTime?: string;
  googleMapsUri?: string | null;
}

export interface RoleRoomAgentBusinessSignals {
  source: 'google_places';
  displayName?: string;
  formattedAddress?: string | null;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
  googleMapsUri?: string | null;
  websiteUri?: string | null;
  primaryType?: string | null;
  primaryTypeDisplayName?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  reviewSummary?: string | null;
  topReviews: RoleRoomAgentReviewQuote[];
  serviceSignals: string[];
}

export interface RoleRoomAgentBrregCompany {
  source: 'brreg';
  lookupStatus: 'verified' | 'not_found' | 'invalid' | 'unavailable' | 'skipped';
  lookupInput?: string | null;
  matchedBy?: 'organization_number' | 'company_name' | null;
  organizationNumber?: string | null;
  name?: string | null;
  organizationForm?: {
    code?: string | null;
    description?: string | null;
  } | null;
  industryCode?: {
    code?: string | null;
    description?: string | null;
  } | null;
  registrationDate?: string | null;
  foundationDate?: string | null;
  vatRegistered?: boolean | null;
  businessRegisterRegistered?: boolean | null;
  employeeCount?: number | null;
  businessAddress?: string | null;
  postalAddress?: string | null;
  municipality?: string | null;
  website?: string | null;
  statusFlags: {
    bankrupt?: boolean;
    underLiquidation?: boolean;
    forcedDissolution?: boolean;
    deleted?: boolean;
  };
  statusMessage?: string | null;
}

export interface RoleRoomAgentCompanyAge {
  status: 'unknown' | 'new' | 'young' | 'established' | 'mature';
  label: string;
  registrationDate?: string | null;
  years?: number | null;
  months?: number | null;
  daysSinceRegistration?: number | null;
  isNewCompany: boolean;
}

export interface RoleRoomAgentAgreementSuggestion {
  id: string;
  title: string;
  detail: string;
  priority: 'critical' | 'recommended' | 'standard';
}

export interface RoleRoomAgentSocialProfileEvidence {
  type:
    | 'website_link'
    | 'schema_same_as'
    | 'meta_tag'
    | 'link_rel_me'
    | 'text_mention'
    | 'data_attribute'
    | 'name_match'
    | 'handle_match'
    | 'domain_match'
    | 'company_context'
    | 'manual_review_needed';
  label: string;
  weight: number;
}

export interface RoleRoomAgentSocialProfileCandidate {
  platform: 'instagram' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok' | 'x' | 'threads' | 'vimeo' | 'pinterest';
  url: string;
  canonicalUrl: string;
  handle?: string | null;
  displayName?: string | null;
  confidence: number;
  status: 'verified' | 'likely' | 'needs_review' | 'rejected';
  evidence: RoleRoomAgentSocialProfileEvidence[];
  source: 'company_website' | 'schema_same_as' | 'manual';
  foundOnUrls: string[];
  requiresManualConfirmation: boolean;
}

export interface RoleRoomAgentCompetitorEvidence {
  type:
    | 'google_places_result'
    | 'same_category'
    | 'location_overlap'
    | 'website_available'
    | 'review_signal'
    | 'manual_review_needed';
  label: string;
  weight: number;
}

export interface RoleRoomAgentCompetitorCandidate {
  source: 'google_places';
  placeId?: string | null;
  name: string;
  websiteUrl?: string | null;
  googleMapsUri?: string | null;
  formattedAddress?: string | null;
  primaryType?: string | null;
  primaryTypeDisplayName?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  confidence: number;
  status: 'verified' | 'likely' | 'needs_review' | 'rejected';
  evidence: RoleRoomAgentCompetitorEvidence[];
  relevanceReason: string;
  marketingSignals: {
    positionHint: string;
    contentAngles: string[];
    ctaOpportunities: string[];
    riskNotes: string[];
  };
  requiresManualConfirmation: boolean;
}

export interface RoleRoomAgentCompetitorAnalysis {
  status: 'ready' | 'limited' | 'unavailable';
  source: 'google_places' | 'fallback';
  generatedAt: string;
  marketContext: string;
  competitors: RoleRoomAgentCompetitorCandidate[];
  verifiedCompetitorCount: number;
  averageRating?: number | null;
  averageReviewCount?: number | null;
  marketingOpportunities: string[];
  positioningRecommendations: string[];
  contentGapSuggestions: string[];
  producerQuestions: string[];
  limitations: string[];
}

export interface RoleRoomAgentLocalPresenceOpportunity {
  type: 'school' | 'sports_club' | 'workplace' | 'hotel' | 'culture' | 'retail' | 'fitness' | 'community' | 'venue' | 'tourism';
  source: 'google_places' | 'manual_strategy';
  placeId?: string | null;
  name: string;
  websiteUrl?: string | null;
  googleMapsUri?: string | null;
  formattedAddress?: string | null;
  primaryType?: string | null;
  primaryTypeDisplayName?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  radiusKm: number;
  confidence: number;
  status: 'verified' | 'likely' | 'needs_review';
  evidence: Array<{
    type:
      | 'google_places_result'
      | 'same_area'
      | 'industry_fit'
      | 'audience_fit'
      | 'website_available'
      | 'review_signal'
      | 'manual_review_needed';
    label: string;
    weight: number;
  }>;
  eventIdea: string;
  partnerValue: string;
  customerValue: string;
  contentPlan: string[];
  outreachMessage: string;
  kpis: string[];
  requiresManualConfirmation: boolean;
}

export interface RoleRoomAgentLocalPresencePlan {
  status: 'ready' | 'limited' | 'unavailable';
  source: 'google_places' | 'fallback';
  generatedAt: string;
  industryContext: string;
  marketArea: string;
  radiusStrategy: Array<{
    radiusKm: number;
    label: string;
    reason: string;
  }>;
  nearbyOpportunities: RoleRoomAgentLocalPresenceOpportunity[];
  recommendedEventConcepts: string[];
  contentActivationPlan: string[];
  outreachSequence: string[];
  kpis: string[];
  limitations: string[];
}

export interface RoleRoomAgentProducerBootstrapResult {
  generatedAt: string;
  provider: 'openai' | 'anthropic' | 'fallback';
  model: string;
  businessSignals?: RoleRoomAgentBusinessSignals | null;
  brregCompany?: RoleRoomAgentBrregCompany | null;
  companyAge?: RoleRoomAgentCompanyAge | null;
  agreementSuggestions: RoleRoomAgentAgreementSuggestion[];
  socialProfileCandidates: RoleRoomAgentSocialProfileCandidate[];
  competitorAnalysis: RoleRoomAgentCompetitorAnalysis;
  localPresencePlan: RoleRoomAgentLocalPresencePlan;
  retrievalMeta?: {
    cohereRerankUsed: boolean;
    rerankerModel?: string;
    websitePagesReviewed: number;
    websitePagesSelected: number;
    reviewsReviewed: number;
    reviewsSelected: number;
    competitorsReviewed?: number;
    competitorsSelected?: number;
    localOpportunitiesReviewed?: number;
    localOpportunitiesSelected?: number;
    brregLookupStatus?: RoleRoomAgentBrregCompany['lookupStatus'];
    brregMatchedBy?: RoleRoomAgentBrregCompany['matchedBy'];
  };
  companyProfile: {
    companyName: string;
    websiteUrl?: string | null;
    organizationNumber?: string | null;
    summary: string;
    offerings: string[];
    targetAudience: string[];
    toneAndBrandSignals: string[];
    industry: string;
    subIndustry: string;
    businessModel: string;
    contentCategory: string;
    productionApproach: string;
    probableLocationAddress?: string | null;
    logoUrl?: string | null;
  };
  intakeDraft: {
    projectGoal: string;
    deliverables: string;
    targetAudience: string;
    keyMessage: string;
    timingConstraints: string;
    brandNotes: string;
    materialOverview: string;
    referenceLinks: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    additionalNotes: string;
  };
  planningDraft: {
    activationPlan: {
      direction?: string;
      idea?: string;
      activation?: string;
      targetAudience?: string;
      businessGoal?: string;
      coreMessage?: string;
      successSignals?: string[];
    };
    contentLogic: {
      objective?: string;
      audience?: string;
      hook?: string;
      coreMessage?: string;
      industry?: string;
      subIndustry?: string;
      businessModel?: string;
      contentCategory?: string;
      productionApproach?: string;
      proofPoints?: string[];
      callToAction?: string;
      distributionPlan?: string;
      successSignals?: string[];
    };
    brandGuide: {
      logoUrl?: string | null;
      toneOfVoice?: string;
      visualStyle?: string;
      fonts: string[];
      dos: string[];
      donts: string[];
      colors: RoleRoomAgentBrandColor[];
    };
  };
  storyLogicDraft: Record<string, unknown>;
  projectCreationDraft: {
    projectName: string;
    description: string;
    projectType: string;
    clientCompanyName: string;
    clientOrganizationNumber: string;
    clientCompanyAddress: string;
    location: string;
    websiteUrl: string;
    suggestedAgreementNotes: string;
  };
  nextRecommendedSteps: string[];
}

type RoleRoomAgentGenerateResponse = {
  success: boolean;
  result?: RoleRoomAgentProducerBootstrapResult;
  error?: string;
};

type RoleRoomAgentGenerateInput = {
  projectId: string;
  projectName?: string;
  websiteUrl?: string | null;
  organizationNumber?: string | null;
  companyName?: string | null;
  extraContext?: string | null;
};

const readRoleRoomAgentHeaders = (): Record<string, string> => {
  const headers = authSessionService.getAuthHeadersSync();
  const session = authSessionService.getSessionSync();
  const adminUser = session.adminUser;

  if (Object.keys(headers).length === 0 && typeof window !== 'undefined') {
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocalHost) {
      headers.Authorization = 'Bearer dev-admin-local-session';
    }
  }

  if (typeof session.currentUserId === 'string' && session.currentUserId.trim().length > 0) {
    headers['x-role-room-user-id'] = session.currentUserId.trim();
  }
  if (typeof adminUser?.email === 'string' && adminUser.email.trim().length > 0) {
    headers['x-role-room-email'] = adminUser.email.trim();
  }
  if (typeof adminUser?.role === 'string' && adminUser.role.trim().length > 0) {
    headers['x-role-room-role'] = adminUser.role.trim();
  }
  if (typeof adminUser?.loginAs === 'string' && adminUser.loginAs.trim().length > 0) {
    headers['x-role-room-login-as'] = adminUser.loginAs.trim();
  }
  if (typeof adminUser?.requestedRole === 'string' && adminUser.requestedRole.trim().length > 0) {
    headers['x-role-room-requested-role'] = adminUser.requestedRole.trim();
  }

  return headers;
};

const normalizeStoryLogicDraft = (value: Record<string, unknown>): Record<string, unknown> => ({
  ...value,
  locks:
    value.locks && typeof value.locks === 'object' && !Array.isArray(value.locks)
      ? value.locks
      : { concept: false, logline: false, theme: false },
  versions: Array.isArray(value.versions) ? value.versions : [],
});

export type RoleRoomFeedPlatform = 'instagram' | 'tiktok' | 'linkedin';

export type RoleRoomFeedPostConcept =
  | 'product_highlight'
  | 'behind_the_scenes'
  | 'testimonial'
  | 'promo'
  | 'educational'
  | 'announcement';

export type RoleRoomFeedMediaType = 'image' | 'reel' | 'carousel';

export type RoleRoomFeedLogoPlacement =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

export interface RoleRoomFeedPost {
  id: string;
  concept: RoleRoomFeedPostConcept | string;
  title: string;
  caption: string;
  hashtags: string[];
  callToAction: string;
  imageStyle: string;
  scheduledFor: string | null;
  backgroundColor: string | null;
  accentColor: string | null;
  textColor: string | null;
  logoPlacement: RoleRoomFeedLogoPlacement | null;
  mediaType: RoleRoomFeedMediaType;
  locked: boolean;
  customImageUrl?: string | null;
  customImageName?: string | null;
}

export interface RoleRoomFeedBrandSnapshot {
  companyName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  toneOfVoice?: string | null;
  visualStyle?: string | null;
}

export interface RoleRoomFeedPlan {
  projectId: string;
  platform: RoleRoomFeedPlatform;
  posts: RoleRoomFeedPost[];
  brandSnapshot: RoleRoomFeedBrandSnapshot | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface FeedPlanResponse {
  success?: boolean;
  error?: string;
  plan?: RoleRoomFeedPlan | null;
}

export interface RoleRoomDriveImage {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string | null;
  iconLink?: string | null;
  webViewLink?: string | null;
  modifiedTime?: string | null;
  sizeBytes?: number | null;
}

export interface RoleRoomDriveImportedImage {
  dataUrl: string;
  name: string;
  mimeType: string;
  fileId: string;
  width?: number;
  height?: number;
}

interface DriveListResponse {
  success?: boolean;
  error?: string;
  notConnected?: boolean;
  files?: RoleRoomDriveImage[];
  nextPageToken?: string | null;
}

interface DriveImportResponse {
  success?: boolean;
  error?: string;
  image?: RoleRoomDriveImportedImage;
}

export interface RoleRoomFeedRecommendation {
  caption: string;
  hashtags: string[];
  callToAction: string;
  scheduledFor: string | null;
  strategyNotes: string;
  bestTimeRationale: string;
  strategyFreshness: 'fresh' | 'stale' | 'seed' | 'failed';
  refreshedAt: string | null;
}

export interface RoleRoomFeedRecommendEntitlement {
  source: string;
  status: string;
  trialEndsAt: string | null;
  daysRemaining: number | null;
}

interface RecommendResponse {
  success?: boolean;
  error?: string;
  recommendation?: RoleRoomFeedRecommendation;
  entitlement?: RoleRoomFeedRecommendEntitlement | {
    allowed: boolean;
    source: string;
    status: string;
    reason: string;
    upsell?: {
      canStartTrial: boolean;
      canBuyAddOn: boolean;
      canUpgradeToPro: boolean;
      currentPlanType: string | null;
    };
  };
}

export class RoleRoomFeedEntitlementError extends Error {
  entitlement: RecommendResponse['entitlement'];
  constructor(message: string, entitlement: RecommendResponse['entitlement']) {
    super(message);
    this.name = 'RoleRoomFeedEntitlementError';
    this.entitlement = entitlement;
  }
}

export const roleRoomAgentService = {
  async getAccess(): Promise<RoleRoomAgentAccess> {
    const response = await fetch('/api/role-room/agent/access', {
      headers: readRoleRoomAgentHeaders(),
    });

    if (!response.ok) {
      throw new Error('Kunne ikke hente tilgang for The Role Room Agent.');
    }

    return response.json() as Promise<RoleRoomAgentAccess>;
  },

  async generateProducerBootstrap(
    input: RoleRoomAgentGenerateInput,
  ): Promise<RoleRoomAgentProducerBootstrapResult> {
    const response = await fetch('/api/role-room/agent/producer-bootstrap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...readRoleRoomAgentHeaders(),
      },
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => null) as RoleRoomAgentGenerateResponse | null;

    if (!response.ok || !payload?.success || !payload.result) {
      throw new Error(payload?.error || 'Kunne ikke generere forslag fra The Role Room Agent.');
    }

    const normalizedResult: RoleRoomAgentProducerBootstrapResult = {
      ...payload.result,
      agreementSuggestions: Array.isArray(payload.result.agreementSuggestions)
        ? payload.result.agreementSuggestions
        : [],
      socialProfileCandidates: Array.isArray(payload.result.socialProfileCandidates)
        ? payload.result.socialProfileCandidates
        : [],
      competitorAnalysis: payload.result.competitorAnalysis ?? {
        status: 'limited',
        source: 'fallback',
        generatedAt: new Date().toISOString(),
        marketContext: 'Konkurrentanalyse er ikke tilgjengelig for denne responsen.',
        competitors: [],
        verifiedCompetitorCount: 0,
        averageRating: null,
        averageReviewCount: null,
        marketingOpportunities: [],
        positioningRecommendations: [],
        contentGapSuggestions: [],
        producerQuestions: [],
        limitations: ['Backend returnerte ikke competitorAnalysis.'],
      },
      localPresencePlan: payload.result.localPresencePlan ?? {
        status: 'limited',
        source: 'fallback',
        generatedAt: new Date().toISOString(),
        industryContext: 'Ukjent bransje',
        marketArea: 'Må avklares',
        radiusStrategy: [],
        nearbyOpportunities: [],
        recommendedEventConcepts: [],
        contentActivationPlan: [],
        outreachSequence: [],
        kpis: [],
        limitations: ['Backend returnerte ikke localPresencePlan.'],
      },
      projectCreationDraft: payload.result.projectCreationDraft ?? {
        projectName: `${payload.result.companyProfile?.companyName || input.projectName || 'Kunde'} · Innholdsproduksjon`,
        description: payload.result.companyProfile?.summary || '',
        projectType: 'content_production',
        clientCompanyName: payload.result.companyProfile?.companyName || '',
        clientOrganizationNumber: payload.result.companyProfile?.organizationNumber || '',
        clientCompanyAddress: payload.result.companyProfile?.probableLocationAddress || '',
        location: payload.result.companyProfile?.probableLocationAddress || '',
        websiteUrl: payload.result.companyProfile?.websiteUrl || '',
        suggestedAgreementNotes: '',
      },
      storyLogicDraft: normalizeStoryLogicDraft(payload.result.storyLogicDraft ?? {}),
    };

    await this.saveSnapshot(input.projectId, normalizedResult);
    return normalizedResult;
  },

  async getSnapshot(projectId: string): Promise<RoleRoomAgentProducerBootstrapResult | null> {
    return settingsService.getSetting<RoleRoomAgentProducerBootstrapResult>(AGENT_SNAPSHOT_NAMESPACE, {
      projectId,
    });
  },

  async saveSnapshot(
    projectId: string,
    result: RoleRoomAgentProducerBootstrapResult,
  ): Promise<RoleRoomAgentProducerBootstrapResult> {
    return settingsService.setSetting<RoleRoomAgentProducerBootstrapResult>(
      AGENT_SNAPSHOT_NAMESPACE,
      result,
      { projectId },
    );
  },

  async loadFeedPlan(
    projectId: string,
    platform: RoleRoomFeedPlatform,
  ): Promise<RoleRoomFeedPlan | null> {
    const response = await fetch(
      `/api/role-room/agent/feed-plan/${encodeURIComponent(projectId)}/${encodeURIComponent(platform)}`,
      { headers: readRoleRoomAgentHeaders() },
    );
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json().catch(() => null)) as FeedPlanResponse | null;
    if (!payload?.success) {
      return null;
    }
    return payload.plan ?? null;
  },

  async saveFeedPlan(
    projectId: string,
    platform: RoleRoomFeedPlatform,
    posts: RoleRoomFeedPost[],
    brandSnapshot: RoleRoomFeedBrandSnapshot | null,
  ): Promise<RoleRoomFeedPlan | null> {
    const response = await fetch(
      `/api/role-room/agent/feed-plan/${encodeURIComponent(projectId)}/${encodeURIComponent(platform)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...readRoleRoomAgentHeaders(),
        },
        body: JSON.stringify({ posts, brandSnapshot }),
      },
    );
    const payload = (await response.json().catch(() => null)) as FeedPlanResponse | null;
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Kunne ikke lagre feed-planen.');
    }
    return payload.plan ?? null;
  },

  async listDriveImages(
    query?: string,
  ): Promise<{ files: RoleRoomDriveImage[]; notConnected: boolean; nextPageToken?: string | null }> {
    const url = new URL('/api/role-room/agent/feed-plan/drive/images', window.location.origin);
    if (query && query.trim()) {
      url.searchParams.set('q', query.trim());
    }
    const response = await fetch(url.pathname + url.search, {
      headers: readRoleRoomAgentHeaders(),
    });
    const payload = (await response.json().catch(() => null)) as DriveListResponse | null;
    if (!response.ok) {
      if (payload?.notConnected) {
        return { files: [], notConnected: true };
      }
      throw new Error(payload?.error || 'Kunne ikke hente Drive-bilder.');
    }
    return {
      files: Array.isArray(payload?.files) ? payload!.files! : [],
      notConnected: Boolean(payload?.notConnected),
      nextPageToken: payload?.nextPageToken ?? null,
    };
  },

  async refreshFeedPlanStrategy(platform: RoleRoomFeedPlatform): Promise<{
    success: boolean;
    error?: string;
    strategy?: unknown;
  }> {
    const response = await fetch('/api/role-room/agent/feed-plan/strategy/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
      body: JSON.stringify({ platform }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; error?: string; strategy?: unknown }
      | null;
    if (!response.ok || !payload?.success) {
      return { success: false, error: payload?.error || `HTTP ${response.status}` };
    }
    return { success: true, strategy: payload.strategy };
  },

  async recommendFeedPost(input: {
    projectId: string;
    platform: RoleRoomFeedPlatform;
    post: {
      concept: string;
      title: string;
      caption: string;
      callToAction: string;
      hashtags: string[];
      mediaType: string;
    };
    brand: {
      companyName?: string | null;
      industry?: string | null;
      subIndustry?: string | null;
      businessModel?: string | null;
      targetAudience?: string[];
      offerings?: string[];
      toneOfVoice?: string | null;
      visualStyle?: string | null;
      keyMessage?: string | null;
      dos?: string[];
      donts?: string[];
    };
    scheduleHint?: string | null;
  }): Promise<{ recommendation: RoleRoomFeedRecommendation; entitlement: RoleRoomFeedRecommendEntitlement | null }> {
    const response = await fetch('/api/role-room/agent/feed-plan/recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...readRoleRoomAgentHeaders(),
      },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => null)) as RecommendResponse | null;
    if (response.status === 402) {
      throw new RoleRoomFeedEntitlementError(
        payload?.error || 'Tilgang krever aktiv pakke.',
        payload?.entitlement,
      );
    }
    if (!response.ok || !payload?.success || !payload.recommendation) {
      throw new Error(payload?.error || 'Kunne ikke hente AI-anbefaling.');
    }
    return {
      recommendation: payload.recommendation,
      entitlement: (payload.entitlement as RoleRoomFeedRecommendEntitlement) ?? null,
    };
  },

  async importDriveImage(
    fileId: string,
    aspect: '4:5' | '1:1' | '9:16' = '4:5',
  ): Promise<RoleRoomDriveImportedImage> {
    const response = await fetch('/api/role-room/agent/feed-plan/drive/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...readRoleRoomAgentHeaders(),
      },
      body: JSON.stringify({ fileId, aspect }),
    });
    const payload = (await response.json().catch(() => null)) as DriveImportResponse | null;
    if (!response.ok || !payload?.success || !payload.image) {
      throw new Error(payload?.error || 'Kunne ikke importere bildet fra Google Drive.');
    }
    return payload.image;
  },
};

export default roleRoomAgentService;
