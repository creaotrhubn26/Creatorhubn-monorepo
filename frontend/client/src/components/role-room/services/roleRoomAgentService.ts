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

// Merch suppliers — Slice 1 (frontend mirror of backend types).
export type RoleRoomAgentMerchTechnique =
  | 'screen_print'
  | 'dtg'
  | 'embroidery'
  | 'sublimation'
  | 'vinyl'
  | 'promo_products'
  | 'unknown';

export type RoleRoomAgentMerchProductCategory =
  | 'apparel'
  | 'headwear'
  | 'bags'
  | 'drinkware'
  | 'stationery'
  | 'sports_kits'
  | 'promotional'
  | 'vehicle_wrap'
  | 'signage'
  | 'unknown';

export interface RoleRoomAgentMerchSupplierEvidence {
  type:
    | 'brreg_nace_match'
    | 'google_places_match'
    | 'same_municipality'
    | 'website_available'
    | 'review_signal'
    | 'manual_review_needed';
  label: string;
  weight: number;
}

export interface RoleRoomAgentMerchSupplier {
  source: 'brreg_nace' | 'google_places';
  naceCode?: string | null;
  organizationNumber?: string | null;
  placeId?: string | null;
  name: string;
  websiteUrl?: string | null;
  googleMapsUri?: string | null;
  formattedAddress?: string | null;
  primaryTypeDisplayName?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  techniques: RoleRoomAgentMerchTechnique[];
  productCategories: RoleRoomAgentMerchProductCategory[];
  /** Specific keywords detected from the supplier's homepage. */
  offerings?: string[];
  /** True when the supplier's website was scraped for richer signals. */
  websiteSignalsEnriched?: boolean;
  /** Contact info scraped from the supplier's homepage and/or
   *  /kontakt subpage. All fields nullable. */
  contact?: {
    email?: string | null;
    phone?: string | null;
    contactPageUrl?: string | null;
  };
  confidence: number;
  status: 'verified' | 'likely' | 'needs_review' | 'rejected';
  evidence: RoleRoomAgentMerchSupplierEvidence[];
  relevanceReason: string;
  outreachHint: string;
  requiresManualConfirmation: boolean;
}

export interface RoleRoomAgentMerchSuppliers {
  status: 'ready' | 'limited' | 'unavailable';
  source: 'brreg+google_places' | 'fallback';
  generatedAt: string;
  marketContext: string;
  suppliers: RoleRoomAgentMerchSupplier[];
  verifiedSupplierCount: number;
  techniqueCounts: Record<RoleRoomAgentMerchTechnique, number>;
  productCounts: Record<RoleRoomAgentMerchProductCategory, number>;
  cooperationAngles: string[];
  outreachChecklist: string[];
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
  merchSuppliers?: RoleRoomAgentMerchSuppliers | null;
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

export type RoleRoomFeedPlatform = 'instagram' | 'tiktok' | 'linkedin' | 'youtube' | 'facebook';

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

/**
 * Approval-flyt for feed-posts:
 *   draft        — agent-generert eller manuelt opprettet, ikke godkjent
 *   approved     — godkjent av producer/reviewer, klar for å scheduleres/publiseres
 *   scheduled    — godkjent OG har en scheduled_for tid satt; publish-worker fyrer
 *   published    — publisert, har externalPostId
 *   rejected     — eksplisitt avvist; ikke i pending-køen
 *   needs_changes— reviewer ber om endringer; tilbake i draft etter edit
 *
 * Default for nye posts er 'draft'. Single-user flows kan velge "auto-approve"
 * via bulk-action; agency-flows kan låse til reviewer-rolle senere.
 */
export interface RoleRoomLinkedInCompany {
  urn: string; // urn:li:organization:12345
  id: string;
  name: string | null;
  vanityName: string | null;
  logoUrl: string | null;
  role: string;
}

export interface RoleRoomTikTokConnection {
  connected: boolean;
  openId: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  scopes: string[];
  expiryDate: string | null;
}

export type RoleRoomAccessRequestPlatform =
  | 'youtube'
  | 'instagram'
  | 'facebook_page'
  | 'linkedin'
  | 'tiktok'
  | 'x'
  | 'threads'
  | 'pinterest';

export interface RoleRoomSocialAccessRequest {
  subject: string;
  greeting: string;
  body: string;
  signoff: string;
  steps: string[];
  adminUrl: string;
  requiredRole: string;
  fullText: string;
  mailtoUrl: string | null;
  source: 'claude' | 'fallback';
}

export interface RoleRoomYouTubeChannel {
  id: string;
  title: string;
  description: string | null;
  customUrl: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  viewCount: number | null;
  videoCount: number | null;
  isBrandAccount: boolean;
}

export interface RoleRoomYouTubeChannelPlan {
  channelName: string;
  alternativeNames: string[];
  handleSuggestion: string;
  tagline: string;
  description: string;
  keywords: string[];
  contentPillars: Array<{
    name: string;
    description: string;
    exampleTopics: string[];
  }>;
  firstVideoIdeas: Array<{
    title: string;
    hook: string;
    description: string;
    durationSeconds: number;
    contentPillar: string;
    callToAction: string;
  }>;
  channelTrailerConcept: {
    hook: string;
    storyBeats: string[];
    durationSeconds: number;
    callToAction: string;
  };
  postingCadence: {
    frequency: string;
    bestDays: string[];
    bestTimeWindows: string[];
    rationale: string;
  };
  visualIdentity: {
    bannerConcept: string;
    avatarConcept: string;
    thumbnailStyle: string;
    colorPaletteHint: string;
  };
  growthAdvice: string[];
  generatedAt: string;
  source: 'claude' | 'fallback';
}

export interface RoleRoomPendingApproval {
  projectId: string;
  platform: string;
  postId: string;
  title: string;
  caption: string;
  scheduledFor: string | null;
  approvalState: 'draft' | 'needs_changes';
  approvalChangedAt: string | null;
}

export type RoleRoomFeedApprovalState =
  | 'draft'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'needs_changes';

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
  /** 2-10 images for carousel posts. Parallel to customImageUrl;
   *  when mediaType='carousel' this is the authoritative source. */
  customImageUrls?: string[] | null;
  customImageNames?: string[] | null;
  /** Single video data URL for reels (video/mp4 or video/quicktime). */
  customVideoDataUrl?: string | null;
  customVideoName?: string | null;
  /** Approval-status. Mangler på legacy-rader → tolkes som 'draft'. */
  approvalState?: RoleRoomFeedApprovalState;
  /** ISO timestamp på siste state-endring (audit). */
  approvalChangedAt?: string | null;
  /** UserId/email på den som approved/rejected (audit). */
  approvalChangedBy?: string | null;
  /** Notat fra reviewer ved needs_changes / rejected. */
  approvalNote?: string | null;
  /** LinkedIn-spesifikk: hvis satt, publiser som bedrift i stedet for
   *  personlig profil. Format: 'urn:li:organization:12345'. Null =
   *  publiser som @bruker. */
  linkedInOrganizationUrn?: string | null;
}

export interface RoleRoomFeedBrandSocialProfile {
  platform: string; // youtube | instagram | linkedin | facebook | tiktok | x | threads | pinterest | vimeo
  url: string;
  handle?: string | null;
  status: 'verified' | 'likely' | 'needs_review' | 'rejected';
  confidence?: number;
}

export interface RoleRoomFeedBrandSnapshot {
  companyName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  toneOfVoice?: string | null;
  visualStyle?: string | null;
  /** Eksisterende sosiale profiler oppdaget under bootstrap (fra
   *  nettside-scrape). Brukes av kanal-plan-generator og andre
   *  plattform-rådgivere for å forstå nåværende tilstedeværelse. */
  existingSocialProfiles?: RoleRoomFeedBrandSocialProfile[];
  /** Bransje + B2B/B2C så plan-generatorer slipper å hoppe gjennom
   *  bootstrap-strukturen. */
  industry?: string | null;
  subIndustry?: string | null;
  businessModel?: string | null;
  targetAudience?: string[];
  offerings?: string[];
  websiteUrl?: string | null;
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

export type RoleRoomIgAccountType = 'BUSINESS' | 'CREATOR' | 'PERSONAL';

export type RoleRoomSocialPlatform =
  | 'instagram'
  | 'facebook_page'
  | 'tiktok'
  | 'linkedin'
  | 'youtube'
  | 'x'
  | 'threads'
  | 'pinterest';

export type RoleRoomSocialEventKind =
  | 'comment'
  | 'reply'
  | 'mention'
  | 'dm'
  | 'reaction'
  | 'review'
  | 'tag'
  | 'share'
  | 'other';

export type RoleRoomSentimentLabel = 'negative' | 'neutral' | 'positive' | 'mixed';

export interface RoleRoomAgentFeedbackInsights {
  totalEvents30d: number;
  netSentiment30d: number;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  topPlatforms: Array<{ platform: string; events: number }>;
  topPosts: Array<{
    platform: string;
    externalPostId: string;
    metric: string;
    value: number;
  }>;
  reachTrend: {
    last30dAvg: number | null;
    prev30dAvg: number | null;
    deltaPct: number | null;
  };
  flags: string[];
  promptSummary: string;
  generatedAt: string;
}

export interface RoleRoomSocialAnalyticsSummary {
  last7d: {
    perPlatform: Array<{ platform: string; total: number; unread: number }>;
    totalEvents: number;
    totalUnread: number;
  };
  last30d: {
    perPlatform: Array<{ platform: string; total: number }>;
    totalEvents: number;
  };
}

export interface RoleRoomSentimentBreakdownEntry {
  platform: string;
  sentiment: RoleRoomSentimentLabel;
  count: number;
}

export interface RoleRoomDailyEventEntry {
  day: string;
  platform: string;
  count: number;
}

export interface RoleRoomDailySentimentEntry {
  day: string;
  sentiment: RoleRoomSentimentLabel;
  count: number;
}

export interface RoleRoomAccountMetric {
  platform: string;
  accountId: string;
  metricName: string;
  metricValue: number | null;
  recordedAt: string;
}

export interface RoleRoomTopPostMetric {
  platform: string;
  externalPostId: string;
  metricName: string;
  metricValue: number;
  recordedAt: string;
}

export interface RoleRoomPublishCountEntry {
  platform: string;
  published: number;
  scheduled: number;
}

export interface RoleRoomSocialEvent {
  id: string;
  platform: RoleRoomSocialPlatform | string;
  accountId: string;
  externalPostId: string | null;
  kind: RoleRoomSocialEventKind | string;
  authorUsername: string | null;
  authorDisplayName: string | null;
  /** URL til avatar fra plattformen (LinkedIn /v2/people, IG profile,
   *  etc). Null hvis vi ikke fikk hentet den. UI faller tilbake til
   *  initial-letter i en farget Avatar-komponent. */
  authorAvatarUrl: string | null;
  body: string | null;
  sentimentScore: number | null;
  sentimentLabel: RoleRoomSentimentLabel | null;
  isRead: boolean;
  occurredAt: string | null;
  receivedAt: string;
}

export interface RoleRoomInstagramConnection {
  id: string;
  igBusinessAccountId: string;
  igUsername: string | null;
  facebookPageName: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  // Profile metadata fra Meta Graph API (instagram_business_basic),
  // hentes ved oppkobling og oppdateres ved token-refresh.
  accountType: RoleRoomIgAccountType | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  mediaCount: number | null;
  profileRefreshedAt: string | null;
}

export type RoleRoomInstagramJobStatus =
  | 'queued'
  | 'uploading'
  | 'container'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'rate_limited';

export interface RoleRoomInstagramPublishJob {
  id: string;
  feedPlanPostId: string;
  status: RoleRoomInstagramJobStatus;
  igMediaId: string | null;
  scheduledFor: string | null;
  attemptedCount: number;
  lastError: string | null;
  publishedAt: string | null;
}

export interface RoleRoomInstagramPublishResult {
  job: RoleRoomInstagramPublishJob;
  immediatelyPublished: boolean;
  rateLimited: boolean;
}

export interface RoleRoomFeedTemplatePayload {
  concept: string;
  title: string;
  caption: string;
  hashtags: string[];
  callToAction: string;
  imageStyle: string;
  backgroundColor: string | null;
  accentColor: string | null;
  textColor: string | null;
  logoPlacement: RoleRoomFeedLogoPlacement | null;
  mediaType: RoleRoomFeedMediaType;
}

export interface RoleRoomFeedTemplate {
  id: string;
  name: string;
  template: RoleRoomFeedTemplatePayload;
  createdAt: string;
  updatedAt: string;
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
      merchSuppliers: payload.result.merchSuppliers ?? null,
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
    kind: 'image' | 'video' | 'media' = 'image',
  ): Promise<{ files: RoleRoomDriveImage[]; notConnected: boolean; nextPageToken?: string | null }> {
    const url = new URL('/api/role-room/agent/feed-plan/drive/images', window.location.origin);
    if (query && query.trim()) {
      url.searchParams.set('q', query.trim());
    }
    if (kind !== 'image') url.searchParams.set('kind', kind);
    const response = await fetch(url.pathname + url.search, {
      headers: readRoleRoomAgentHeaders(),
    });
    const payload = (await response.json().catch(() => null)) as DriveListResponse | null;
    if (!response.ok) {
      if (payload?.notConnected) {
        return { files: [], notConnected: true };
      }
      throw new Error(payload?.error || 'Kunne ikke hente Drive-filer.');
    }
    return {
      files: Array.isArray(payload?.files) ? payload!.files! : [],
      notConnected: Boolean(payload?.notConnected),
      nextPageToken: payload?.nextPageToken ?? null,
    };
  },

  async listInstagramConnections(): Promise<{
    metaConfigured: boolean;
    imageHostingConfigured: boolean;
    rateLimitPer24h: number;
    connections: RoleRoomInstagramConnection[];
  }> {
    const response = await fetch('/api/role-room/instagram/connections', {
      headers: readRoleRoomAgentHeaders(),
    });
    if (!response.ok) {
      return { metaConfigured: false, imageHostingConfigured: false, rateLimitPer24h: 50, connections: [] };
    }
    const payload = await response.json().catch(() => null);
    return {
      metaConfigured: Boolean(payload?.metaConfigured),
      imageHostingConfigured: Boolean(payload?.imageHostingConfigured),
      rateLimitPer24h: Number(payload?.rateLimitPer24h ?? 50),
      connections: Array.isArray(payload?.connections) ? payload.connections : [],
    };
  },

  async startInstagramOauth(projectId: string): Promise<{ url: string } | { error: string }> {
    const response = await fetch(
      `/api/role-room/instagram/oauth/start?projectId=${encodeURIComponent(projectId)}`,
      { headers: readRoleRoomAgentHeaders() },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      return { error: payload?.error || 'Kunne ikke starte Instagram-innlogging.' };
    }
    return { url: payload.url };
  },

  async revokeInstagramConnection(connectionId: string): Promise<boolean> {
    const response = await fetch(`/api/role-room/instagram/connections/${encodeURIComponent(connectionId)}`, {
      method: 'DELETE',
      headers: readRoleRoomAgentHeaders(),
    });
    const payload = await response.json().catch(() => null);
    return Boolean(payload?.success);
  },

  // ── Cross-platform unified social inbox ────────────────────────────────
  async listSocialInbox(filter: {
    platform?: string;
    kind?: string;
    unread?: boolean;
    sentiment?: 'negative' | 'neutral' | 'positive' | 'mixed';
    limit?: number;
  } = {}): Promise<{ events: RoleRoomSocialEvent[]; error?: string }> {
    const qs = new URLSearchParams();
    if (filter.platform) qs.set('platform', filter.platform);
    if (filter.kind) qs.set('kind', filter.kind);
    if (filter.unread) qs.set('unread', 'true');
    if (filter.sentiment) qs.set('sentiment', filter.sentiment);
    if (filter.limit) qs.set('limit', String(filter.limit));
    const url = `/api/role-room/social/inbox${qs.toString() ? `?${qs}` : ''}`;
    try {
      const response = await fetch(url, { headers: readRoleRoomAgentHeaders() });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        return { events: [], error: payload?.error || 'Kunne ikke hente inbox.' };
      }
      return { events: Array.isArray(payload.events) ? payload.events : [] };
    } catch (err) {
      return { events: [], error: (err as Error).message };
    }
  },

  async markSocialEventRead(eventId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `/api/role-room/social/inbox/${encodeURIComponent(eventId)}/read`,
        { method: 'POST', headers: readRoleRoomAgentHeaders() },
      );
      const payload = await response.json().catch(() => null);
      return Boolean(payload?.success);
    } catch {
      return false;
    }
  },

  async listLinkedInCompanies(): Promise<{
    companies: RoleRoomLinkedInCompany[];
    scopeMissing: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch('/api/role-room/linkedin/companies', {
        headers: readRoleRoomAgentHeaders(),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        return {
          companies: [],
          scopeMissing: false,
          error: payload?.error || 'Kunne ikke hente LinkedIn-bedrifter.',
        };
      }
      return {
        companies: Array.isArray(payload.companies) ? payload.companies : [],
        scopeMissing: Boolean(payload.scopeMissing),
      };
    } catch (err) {
      return { companies: [], scopeMissing: false, error: (err as Error).message };
    }
  },

  async fetchLinkedInProfile(): Promise<{
    connected: boolean;
    memberId?: string;
    email?: string | null;
    name?: string | null;
    profilePictureUrl?: string | null;
  }> {
    try {
      const response = await fetch('/api/role-room/linkedin/profile', {
        headers: readRoleRoomAgentHeaders(),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        return { connected: false };
      }
      return {
        connected: Boolean(payload.connected),
        memberId: payload.memberId,
        email: payload.email,
        name: payload.name,
        profilePictureUrl: payload.profilePictureUrl,
      };
    } catch {
      return { connected: false };
    }
  },

  async listYouTubeChannels(): Promise<{
    channels: RoleRoomYouTubeChannel[];
    scopeMissing: boolean;
    noConnection: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch('/api/role-room/youtube/channels', {
        headers: readRoleRoomAgentHeaders(),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        return {
          channels: [],
          scopeMissing: false,
          noConnection: false,
          error: payload?.error || 'Kunne ikke hente YouTube-kanaler.',
        };
      }
      return {
        channels: Array.isArray(payload.channels) ? payload.channels : [],
        scopeMissing: Boolean(payload.scopeMissing),
        noConnection: Boolean(payload.noConnection),
      };
    } catch (err) {
      return {
        channels: [],
        scopeMissing: false,
        noConnection: false,
        error: (err as Error).message,
      };
    }
  },

  async fetchTikTokConnection(): Promise<RoleRoomTikTokConnection> {
    try {
      const response = await fetch('/api/role-room/tiktok/connection', {
        headers: readRoleRoomAgentHeaders(),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        return {
          connected: false,
          openId: null,
          username: null,
          displayName: null,
          avatarUrl: null,
          scopes: [],
          expiryDate: null,
        };
      }
      return {
        connected: Boolean(payload.connected),
        openId: payload.openId ?? null,
        username: payload.username ?? null,
        displayName: payload.displayName ?? null,
        avatarUrl: payload.avatarUrl ?? null,
        scopes: Array.isArray(payload.scopes) ? payload.scopes : [],
        expiryDate: payload.expiryDate ?? null,
      };
    } catch {
      return {
        connected: false,
        openId: null,
        username: null,
        displayName: null,
        avatarUrl: null,
        scopes: [],
        expiryDate: null,
      };
    }
  },

  async startTikTokOauth(input: {
    projectId: string;
  }): Promise<{ authorizationUrl: string | null; error?: string }> {
    try {
      const response = await fetch('/api/role-room/tiktok/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({
          projectId: input.projectId,
          returnPath: window.location.pathname + window.location.search,
          browserOrigin: window.location.origin,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        return {
          authorizationUrl: null,
          error: payload?.error || 'Kunne ikke starte TikTok OAuth.',
        };
      }
      return { authorizationUrl: payload.authorizationUrl };
    } catch (err) {
      return { authorizationUrl: null, error: (err as Error).message };
    }
  },

  async disconnectTikTok(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/role-room/tiktok/disconnect', {
        method: 'POST',
        headers: readRoleRoomAgentHeaders(),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        return { success: false, error: payload?.error };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  async generateSocialAccessRequest(input: {
    projectId: string;
    platform: RoleRoomAccessRequestPlatform;
    recipientName?: string | null;
    recipientEmail?: string | null;
  }): Promise<{ request: RoleRoomSocialAccessRequest | null; error?: string }> {
    try {
      const response = await fetch('/api/role-room/social/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({
          projectId: input.projectId,
          platform: input.platform,
          recipientName: input.recipientName ?? null,
          recipientEmail: input.recipientEmail ?? null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        return { request: null, error: payload?.error || 'Kunne ikke lage e-post-utkast.' };
      }
      return { request: (payload.request as RoleRoomSocialAccessRequest) ?? null };
    } catch (err) {
      return { request: null, error: (err as Error).message };
    }
  },

  async generateYouTubeChannelPlan(input: {
    projectId: string;
  }): Promise<{ plan: RoleRoomYouTubeChannelPlan | null; error?: string }> {
    try {
      const response = await fetch('/api/role-room/youtube/channel-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({ projectId: input.projectId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        return { plan: null, error: payload?.error || 'Kunne ikke generere kanal-plan.' };
      }
      return { plan: (payload.plan as RoleRoomYouTubeChannelPlan) ?? null };
    } catch (err) {
      return { plan: null, error: (err as Error).message };
    }
  },

  async listPendingApprovals(): Promise<{
    pending: RoleRoomPendingApproval[];
    totalPending: number;
    error?: string;
  }> {
    try {
      const response = await fetch('/api/role-room/agent/feed-plan/approvals/pending', {
        headers: readRoleRoomAgentHeaders(),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        return {
          pending: [],
          totalPending: 0,
          error: payload?.error || 'Kunne ikke hente posts som venter på godkjenning.',
        };
      }
      return {
        pending: Array.isArray(payload.pending) ? payload.pending : [],
        totalPending: Number(payload.totalPending ?? 0),
      };
    } catch (err) {
      return { pending: [], totalPending: 0, error: (err as Error).message };
    }
  },

  async setFeedPostApproval(input: {
    projectId: string;
    platform: string;
    postIds: string[];
    approvalState: 'draft' | 'approved' | 'scheduled' | 'published' | 'rejected' | 'needs_changes';
    approvalNote?: string | null;
  }): Promise<{ success: boolean; touched?: number; error?: string }> {
    try {
      const response = await fetch(
        `/api/role-room/agent/feed-plan/${encodeURIComponent(input.projectId)}/${encodeURIComponent(input.platform)}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
          body: JSON.stringify({
            postIds: input.postIds,
            approvalState: input.approvalState,
            approvalNote: input.approvalNote ?? null,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        return { success: false, error: payload?.error || 'Kunne ikke oppdatere approval-status.' };
      }
      return { success: true, touched: Number(payload.touched ?? 0) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  async fetchAgentFeedbackInsights(): Promise<{
    insights: RoleRoomAgentFeedbackInsights | null;
    error?: string;
  }> {
    try {
      const response = await fetch('/api/role-room/social/agent-insights', {
        headers: readRoleRoomAgentHeaders(),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        return { insights: null, error: payload?.error };
      }
      return { insights: payload.insights ?? null };
    } catch (err) {
      return { insights: null, error: (err as Error).message };
    }
  },

  async fetchSocialAnalytics(): Promise<{
    summary?: RoleRoomSocialAnalyticsSummary;
    sentimentBreakdown?: RoleRoomSentimentBreakdownEntry[];
    dailyEvents?: RoleRoomDailyEventEntry[];
    dailySentiment?: RoleRoomDailySentimentEntry[];
    accountMetrics?: RoleRoomAccountMetric[];
    topPosts?: RoleRoomTopPostMetric[];
    publishesPerPlatform?: RoleRoomPublishCountEntry[];
    error?: string;
  }> {
    try {
      const response = await fetch('/api/role-room/social/analytics', {
        headers: readRoleRoomAgentHeaders(),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        return { error: payload?.error || 'Kunne ikke hente analytics.' };
      }
      return {
        summary: payload.summary,
        sentimentBreakdown: payload.sentimentBreakdown,
        dailyEvents: payload.dailyEvents,
        dailySentiment: payload.dailySentiment,
        accountMetrics: payload.accountMetrics,
        topPosts: payload.topPosts,
        publishesPerPlatform: payload.publishesPerPlatform,
      };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  async publishInstagram(input: {
    connectionId: string;
    projectId: string;
    feedPlanPostId: string;
    mediaType: 'image' | 'reel' | 'carousel';
    caption: string;
    /** Single image — used for mediaType='image'. */
    imageDataUrl?: string;
    /** 2-10 images — used for mediaType='carousel'. */
    imageDataUrls?: string[];
    /** Single video/mp4 or video/quicktime data URL — used for mediaType='reel'. */
    videoDataUrl?: string;
    scheduledFor?: string | null;
  }): Promise<RoleRoomInstagramPublishResult> {
    const response = await fetch('/api/role-room/instagram/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: string;
      job?: RoleRoomInstagramPublishJob;
      immediatelyPublished?: boolean;
      rateLimited?: boolean;
      entitlement?: unknown;
    } | null;
    if (response.status === 402) {
      throw new RoleRoomFeedEntitlementError(
        payload?.error || 'IG-publisering krever Showrunner-pakken.',
        payload?.entitlement as never,
      );
    }
    if (!response.ok || !payload?.success || !payload.job) {
      throw new Error(payload?.error || 'Publisering feilet.');
    }
    return {
      job: payload.job,
      immediatelyPublished: Boolean(payload.immediatelyPublished),
      rateLimited: Boolean(payload.rateLimited),
    };
  },

  async listInstagramJobs(projectId: string): Promise<RoleRoomInstagramPublishJob[]> {
    const response = await fetch(`/api/role-room/instagram/jobs/${encodeURIComponent(projectId)}`, {
      headers: readRoleRoomAgentHeaders(),
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => null);
    return Array.isArray(payload?.jobs) ? payload.jobs : [];
  },

  async listFeedTemplates(
    projectId: string,
    platform: RoleRoomFeedPlatform,
  ): Promise<RoleRoomFeedTemplate[]> {
    const response = await fetch(
      `/api/role-room/agent/feed-plan/templates/${encodeURIComponent(projectId)}/${encodeURIComponent(platform)}`,
      { headers: readRoleRoomAgentHeaders() },
    );
    if (!response.ok) return [];
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; templates?: RoleRoomFeedTemplate[] }
      | null;
    return payload?.templates ?? [];
  },

  async createFeedTemplate(input: {
    projectId: string;
    platform: RoleRoomFeedPlatform;
    name: string;
    template: RoleRoomFeedTemplatePayload;
  }): Promise<RoleRoomFeedTemplate | null> {
    const response = await fetch(
      `/api/role-room/agent/feed-plan/templates/${encodeURIComponent(input.projectId)}/${encodeURIComponent(input.platform)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({ name: input.name, template: input.template }),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; error?: string; template?: RoleRoomFeedTemplate }
      | null;
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Kunne ikke lagre malen.');
    }
    return payload.template ?? null;
  },

  async archiveFeedTemplate(templateId: string): Promise<boolean> {
    const response = await fetch(
      `/api/role-room/agent/feed-plan/templates/${encodeURIComponent(templateId)}`,
      { method: 'DELETE', headers: readRoleRoomAgentHeaders() },
    );
    const payload = (await response.json().catch(() => null)) as { success?: boolean } | null;
    return Boolean(payload?.success);
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

  // ── Marketing Plan Engine ─────────────────────────────────────────

  async checkMarketingPlanReadiness(
    bootstrap: unknown,
  ): Promise<MarketingPlanReadiness | null> {
    const response = await fetch('/api/role-room/marketing-plan/readiness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
      body: JSON.stringify({ bootstrap }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; readiness?: MarketingPlanReadiness }
      | null;
    return payload?.readiness ?? null;
  },

  async generateMarketingPlan(input: {
    projectId: string;
    bootstrap: unknown;
    horizonDays?: number;
  }): Promise<MarketingPlan> {
    const response = await fetch('/api/role-room/marketing-plan/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; plan?: MarketingPlan; readiness?: MarketingPlanReadiness; error?: string; entitlement?: unknown }
      | null;
    if (response.status === 402) {
      throw new RoleRoomFeedEntitlementError(
        payload?.error || 'Markedsplan-generering krever aktiv plan eller add-on.',
        payload?.entitlement as never,
      );
    }
    if (response.status === 409 && payload?.readiness) {
      throw new MarketingPlanReadinessError(payload.readiness, payload.error);
    }
    if (!response.ok || !payload?.success || !payload.plan) {
      throw new Error(payload?.error || 'Klarte ikke å generere markedsplan.');
    }
    return payload.plan;
  },

  async getMarketingPlan(projectId: string): Promise<MarketingPlan | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/${encodeURIComponent(projectId)}`,
      { headers: readRoleRoomAgentHeaders() },
    );
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; plan?: MarketingPlan | null }
      | null;
    return payload?.plan ?? null;
  },

  async listMarketingPlanPosts(planId: string): Promise<MarketingPlanPost[]> {
    const response = await fetch(
      `/api/role-room/marketing-plan/${encodeURIComponent(planId)}/posts`,
      { headers: readRoleRoomAgentHeaders() },
    );
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; posts?: MarketingPlanPost[] }
      | null;
    return Array.isArray(payload?.posts) ? payload!.posts! : [];
  },

  async generateMarketingPlanPosts(input: {
    planId: string;
    projectId: string;
  }): Promise<MarketingPlanPost[]> {
    const response = await fetch(
      `/api/role-room/marketing-plan/${encodeURIComponent(input.planId)}/generate-posts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({ projectId: input.projectId }),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; posts?: MarketingPlanPost[]; error?: string; entitlement?: unknown }
      | null;
    if (response.status === 402) {
      throw new RoleRoomFeedEntitlementError(
        payload?.error || 'Post-generering krever aktiv plan eller add-on.',
        payload?.entitlement as never,
      );
    }
    if (!response.ok || !payload?.success || !Array.isArray(payload.posts)) {
      throw new Error(payload?.error || 'Klarte ikke å generere post-planen.');
    }
    return payload.posts;
  },

  async createClientPortalInvite(input: {
    projectId: string;
    clientEmail: string;
    clientName?: string | null;
    expiresInDays?: number;
  }): Promise<{ invite: ClientPortalInvite; magicLinkUrl: string }> {
    const response = await fetch('/api/role-room/client-portal/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
      body: JSON.stringify(input),
    });
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; invite?: ClientPortalInvite; magicLinkUrl?: string; error?: string }
      | null;
    if (!response.ok || !payload?.success || !payload.invite || !payload.magicLinkUrl) {
      throw new Error(payload?.error || 'Kunne ikke opprette klient-invitasjon.');
    }
    return { invite: payload.invite, magicLinkUrl: payload.magicLinkUrl };
  },

  async listClientPortalInvites(projectId: string): Promise<ClientPortalInvite[]> {
    const response = await fetch(
      `/api/role-room/client-portal/invites/${encodeURIComponent(projectId)}`,
      { headers: readRoleRoomAgentHeaders() },
    );
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; invites?: ClientPortalInvite[] }
      | null;
    return Array.isArray(payload?.invites) ? payload!.invites! : [];
  },

  async revokeClientPortalInvite(inviteId: string): Promise<boolean> {
    const response = await fetch(
      `/api/role-room/client-portal/invites/${encodeURIComponent(inviteId)}/revoke`,
      { method: 'POST', headers: readRoleRoomAgentHeaders() },
    );
    return response.ok;
  },

  async acceptMarketingPlanPost(input: {
    postId: string;
    projectId: string;
    scheduledFor?: string | null;
  }): Promise<{ planPost: MarketingPlanPost; feedPlanPostId: string }> {
    const response = await fetch(
      `/api/role-room/marketing-plan/posts/${encodeURIComponent(input.postId)}/accept`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({
          projectId: input.projectId,
          scheduledFor: input.scheduledFor ?? null,
        }),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; planPost?: MarketingPlanPost; feedPlanPostId?: string; error?: string }
      | null;
    if (!response.ok || !payload?.success || !payload.planPost || !payload.feedPlanPostId) {
      throw new Error(payload?.error || 'Kunne ikke akseptere posten inn i feed-planneren.');
    }
    return { planPost: payload.planPost, feedPlanPostId: payload.feedPlanPostId };
  },

  async activateMarketingPlan(
    planId: string,
    projectId: string,
  ): Promise<MarketingPlan | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/${encodeURIComponent(planId)}/activate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({ projectId }),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; plan?: MarketingPlan | null; error?: string }
      | null;
    if (!response.ok) throw new Error(payload?.error || 'Kunne ikke aktivere planen.');
    return payload?.plan ?? null;
  },
};

// ── Marketing plan types ─────────────────────────────────────────────────

export interface MarketingPlanReadiness {
  ready: boolean;
  missingFields: string[];
  hasInstagramConnection: boolean;
}

export class MarketingPlanReadinessError extends Error {
  readonly readiness: MarketingPlanReadiness;
  constructor(readiness: MarketingPlanReadiness, message?: string) {
    super(message || 'Markedsplan-input er ikke komplett.');
    this.name = 'MarketingPlanReadinessError';
    this.readiness = readiness;
  }
}

export interface MarketingPlanStrategy {
  channelStrategy: { primary: string; cadencePerWeek: number; secondary: string[]; reasoning: string };
  toneOfVoice: { voice: string; dos: string[]; donts: string[] };
  positioning: { valueProp: string; differentiator: string };
  kpiTargets: Array<{ metric: string; target: number; per: 'post' | 'week' | 'month' | 'quarter'; rationale: string }>;
}

export interface MarketingPlanPillar {
  id: string;
  planId: string;
  name: string;
  description: string;
  rationale: string;
  targetKpi?: { metric: string; target: number; per: 'post' | 'week' | 'month' | 'quarter' } | null;
  sortOrder: number;
}

export interface MarketingPlan {
  id: string;
  projectId: string;
  ownerUserId: string;
  status: 'draft' | 'active' | 'archived';
  strategy: MarketingPlanStrategy;
  pillars: MarketingPlanPillar[];
  generatedAt: string | null;
  generatedWithModel: string | null;
  startDate: string | null;
  horizonDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPortalInvite {
  id: string;
  clientEmail: string;
  clientName: string | null;
  projectId: string;
  status: 'active' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
  lastSeenAt?: string | null;
}

export interface MarketingPlanPost {
  id: string;
  planId: string;
  pillarId: string | null;
  sortOrder: number;
  dayOffset: number | null;
  hook: string;
  format: 'reel' | 'carousel' | 'image' | 'story' | 'tiktok' | 'linkedin_post' | 'youtube_short';
  script: string | null;
  captionDraft: string | null;
  callToAction: string | null;
  primaryPlatform: 'instagram' | 'tiktok' | 'linkedin' | 'youtube' | 'facebook' | null;
  crossPostPlan: Array<{ platform: string; delayDays: number; adaptationNote?: string }>;
  goalKpi: { metric: string; target: number; per: 'post' | 'week' | 'month' | 'quarter' } | null;
  status: 'proposed' | 'scheduled' | 'published' | 'skipped';
  feedPlanPostId: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default roleRoomAgentService;
