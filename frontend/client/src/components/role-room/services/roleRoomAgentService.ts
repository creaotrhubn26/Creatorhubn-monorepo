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

export interface RoleRoomAgentServiceLatencies {
  brreg?: number;
  website?: number;
  googlePlacesBusiness?: number;
  googlePlacesCompetitors?: number;
  googlePlacesLocal?: number;
  competitorAnalysis?: number;
  localPresence?: number;
  merchSuppliers?: number;
  metaPagesEnrichment?: number;
  colorExtraction?: number;
  claudeSynthesis?: number;
  openaiSynthesis?: number;
  totalMs?: number;
}

export interface RoleRoomAgentProducerBootstrapResult {
  generatedAt: string;
  provider: 'openai' | 'anthropic' | 'fallback';
  model: string;
  /** Stable UUID for this research run — used for share-links, debug
   *  refs, and version comparison. Present on all new results; older
   *  cached snapshots may lack it. */
  researchId?: string;
  /** Wall-clock ISO timestamps bracketing the bootstrap pipeline. */
  bootstrapStartedAt?: string;
  bootstrapFinishedAt?: string;
  /** Per-source latency in milliseconds. UI renders this as a timeline
   *  on the "Research Complete" overlay so the user can see what took
   *  what — a 12s total split into 3s Brreg + 5s website + 2s places +
   *  2s synthesis is way more informative than a blank spinner. */
  serviceLatencies?: RoleRoomAgentServiceLatencies;
  /** Human-readable fallback labels that fired during this run. UI
   *  surfaces these as warnings ("Cohere skipped — no API key",
   *  "Brreg timeout — using cached data"). Empty = clean happy path. */
  fallbacksUsed?: string[];
  /** Per-field provenance from the synthesis model itself (item #6
   *  proper-fix). When present, the provenance panel reads confidence
   *  and rationale from here instead of computing them heuristically.
   *  Keys are dot-paths into the result (e.g. "companyProfile.industry"). */
  fieldMetadata?: Record<string, {
    confidence?: number;
    rationale?: string;
    sourceChain?: Array<
      | 'brreg'
      | 'website'
      | 'google_places'
      | 'claude_synthesis'
      | 'openai_synthesis'
      | 'fallback_rules'
      | 'user_input'
      | 'logo_palette'
      | 'kartverket'
    >;
  }>;
  /** 2-3 sentence pitch-ready summary generated by Claude Haiku (item #42).
   *  Falls back to companyProfile.summary in UI when null. */
  executiveSummary?: string | null;
  /** Quality-assurance flags (items #51-#75). Sorted critical → warning
   *  → info. UI groups them per category in a collapsible overlay-section. */
  validationFlags?: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    category: string;
    title: string;
    detail: string;
    fixTargetId?: string;
    fixHint?: string;
  }>;
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

export const roleRoomAgentDefaultHeaders = (): Record<string, string> => readRoleRoomAgentHeaders();

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

export type RoleRoomFeedPlatform = 'instagram' | 'tiktok' | 'linkedin' | 'youtube';

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

// ── Ads spend report (§5.3): faktisk annonsekostnad + 20 % påslag per periode ──

export interface RoleRoomAdsSpendSummary {
  period: string; // YYYY-MM
  spendNok: number;
  managementFeeNok: number;
  managementFeeInclVatNok: number;
  effectiveFeeRate: number | null;
  totalClientCostExVatNok: number;
  perPlatform: Record<string, number>;
}

export interface RoleRoomApprovalPolicy {
  requireClientApproval: boolean;
  canEdit: boolean;
}

export interface RoleRoomBudgetStatus {
  hasBudget: boolean;
  maxSpendNok: number;
  approvedOverageNok: number;
  effectiveCapNok: number;
  actualSpendNok: number;
  remainingNok: number;
  utilizationPct: number;
  isOverBudget: boolean;
  isNearBudget: boolean;
  overageRequestedNok: number | null;
}

export type RoleRoomBudgetPace = 'no_budget' | 'on_track' | 'at_risk' | 'over_pace' | 'exhausted';

export interface RoleRoomBudgetPacing {
  daysInPeriod: number;
  daysElapsed: number;
  daysRemaining: number;
  dailyRunRateNok: number;
  projectedPeriodSpendNok: number;
  projectedOverspendNok: number;
  recommendedDailyBudgetNok: number;
  projectedExhaustionDate: string | null;
  pace: RoleRoomBudgetPace;
}

export interface RoleRoomBudgetResult {
  period: string;
  status: RoleRoomBudgetStatus;
  pacing?: RoleRoomBudgetPacing;
  /** Lag 3b: kunden har slått på automatisk pause når taket nås. */
  autoPauseOnCap?: boolean;
  canEdit: boolean;
}

export interface RoleRoomChannelResult {
  platform: string;
  spendNok: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValueNok: number;
  ctr: number | null;
  cpc: number | null;
  roas: number | null;
  costPerConversionNok: number | null;
}

export interface RoleRoomChannelResults {
  period: string;
  perChannel: RoleRoomChannelResult[];
  totals: RoleRoomChannelResult;
}

export type RoleRoomAdsCampaignStatus = 'draft' | 'active' | 'paused' | 'ended' | 'failed';

export interface RoleRoomAdsCampaign {
  id: string;
  projectId: string;
  platform: string;
  externalCampaignId: string | null;
  status: RoleRoomAdsCampaignStatus;
  goal: string | null;
  dailyBudgetNok: number | null;
  totalBudgetNok: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoleRoomMetaAdAccount {
  id: string;
  account_id: string;
  name: string;
  currency: string;
  business_name?: string;
}

export interface RoleRoomLinkedInAccount {
  id: string; // urn:li:sponsoredAccount:{id}
  name: string | null;
  role: string;
  isAdmin: boolean;
}

export interface RoleRoomLinkedInCampaignGroup {
  id: string; // urn:li:sponsoredCampaignGroup:{id}
  name: string;
  status: string | null;
}

// ── Lag 2: AI-anbefalinger ─────────────────────────────────────────────
export type RoleRoomAdRecommendationType =
  | 'reallocate_budget'
  | 'pause_underperformer'
  | 'scale_winner'
  | 'refresh_creative'
  | 'fix_tracking'
  | 'investigate';
export type RoleRoomAdRecommendationSeverity = 'info' | 'warning' | 'critical';

export interface RoleRoomAdRecommendation {
  id: string;
  type: RoleRoomAdRecommendationType;
  severity: RoleRoomAdRecommendationSeverity;
  title: string;
  body: string;
  evidence: string[];
  affectsChannels?: string[];
  suggestedAction: { kind: 'manual'; detail?: string };
  confidence: 'low' | 'medium' | 'high';
}

export interface RoleRoomAdRecommendationsResult {
  period: string;
  recommendations: RoleRoomAdRecommendation[];
  overallNote: string | null;
  generatedAt: string | null;
  generatedWithModel: string | null;
}

// ── AI-genererte annonser (Lag 1) ──────────────────────────────────────
export interface RoleRoomAdVariant {
  headline: string;
  headlines?: string[];
  primaryText?: string | null;
  description?: string | null;
  descriptions?: string[];
  callToAction?: string | null;
  imageBrief?: string | null;
  imagePrompt?: string | null;
  rationale?: string | null;
}

export interface RoleRoomGeneratedAdCreative {
  platform: 'meta' | 'google' | 'linkedin' | 'tiktok';
  goal: string;
  variants: RoleRoomAdVariant[];
  landingUrl?: string | null;
  complianceChecklist?: string[];
  generatedWithModel: string;
  usage?: { inputTokens: number; outputTokens: number; costNok: number | null };
}

// ── Granted ad-asset overview (which Pages/accounts the client gave admin to) ──

export interface RoleRoomGrantedMetaPage {
  id: string;
  name: string;
  category: string | null;
  /** The client's brand logo — the Page profile picture. */
  pictureUrl: string | null;
  tasks: string[];
  isAdmin: boolean;
  accessLevel: 'admin' | 'limited';
  accessLabels: string[];
  instagramBusinessAccount: { id: string; username: string | null; profilePictureUrl: string | null } | null;
}

export interface RoleRoomGrantedLinkedInAsset {
  assetType: 'ad_account' | 'organization';
  id: string;
  name: string | null;
  logoUrl: string | null;
  role: string;
  roleLabel: string;
  isAdmin: boolean;
}

export interface RoleRoomGrantedAdminAsset {
  platform: 'meta' | 'linkedin';
  assetType: string;
  id: string;
  name: string | null;
  /** Client brand logo (Meta Page/IG picture) when available. */
  logoUrl: string | null;
  accessSummary: string;
}

export interface RoleRoomGrantedAssets {
  hasAdminAccess: boolean;
  adminAssets: RoleRoomGrantedAdminAsset[];
  platforms: {
    meta: { connected: boolean; pages?: RoleRoomGrantedMetaPage[]; adminCount?: number };
    linkedin: { connected: boolean; assets?: RoleRoomGrantedLinkedInAsset[]; adminCount?: number };
  };
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

  async fetchAdsSpendSummary(period?: string): Promise<RoleRoomAdsSpendSummary> {
    const empty: RoleRoomAdsSpendSummary = {
      period: period ?? new Date().toISOString().slice(0, 7),
      spendNok: 0,
      managementFeeNok: 0,
      managementFeeInclVatNok: 0,
      effectiveFeeRate: null,
      totalClientCostExVatNok: 0,
      perPlatform: {},
    };
    const qs = period ? `?period=${encodeURIComponent(period)}` : '';
    const response = await fetch(`/api/role-room/ads/spend/summary${qs}`, {
      headers: readRoleRoomAgentHeaders(),
    });
    if (!response.ok) return empty;
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object') return empty;
    return {
      period: typeof payload.period === 'string' ? payload.period : empty.period,
      spendNok: Number(payload.spendNok ?? 0),
      managementFeeNok: Number(payload.managementFeeNok ?? 0),
      managementFeeInclVatNok: Number(payload.managementFeeInclVatNok ?? 0),
      effectiveFeeRate: payload.effectiveFeeRate == null ? null : Number(payload.effectiveFeeRate),
      totalClientCostExVatNok: Number(payload.totalClientCostExVatNok ?? 0),
      perPlatform: payload.perPlatform && typeof payload.perPlatform === 'object' ? payload.perPlatform : {},
    };
  },

  async fetchApprovalPolicy(projectId: string): Promise<RoleRoomApprovalPolicy> {
    const response = await fetch(
      `/api/role-room/agent/feed-plan/${encodeURIComponent(projectId)}/approval-policy`,
      { headers: readRoleRoomAgentHeaders() },
    );
    if (!response.ok) return { requireClientApproval: true, canEdit: false };
    const payload = await response.json().catch(() => null);
    return {
      requireClientApproval: payload?.requireClientApproval !== false,
      canEdit: Boolean(payload?.canEdit),
    };
  },

  async setApprovalPolicy(projectId: string, requireClientApproval: boolean): Promise<boolean> {
    const response = await fetch(
      `/api/role-room/agent/feed-plan/${encodeURIComponent(projectId)}/approval-policy`,
      {
        method: 'PUT',
        headers: { ...readRoleRoomAgentHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ requireClientApproval }),
      },
    );
    return response.ok;
  },

  async fetchAdsBudget(projectId: string, period?: string): Promise<RoleRoomBudgetResult | null> {
    const qs = new URLSearchParams({ projectId, ...(period ? { period } : {}) });
    const response = await fetch(`/api/role-room/ads/budget?${qs.toString()}`, {
      headers: readRoleRoomAgentHeaders(),
    });
    if (!response.ok) return null;
    return (await response.json().catch(() => null)) as RoleRoomBudgetResult | null;
  },

  async fetchAdsResults(projectId: string, period?: string): Promise<RoleRoomChannelResults | null> {
    const qs = new URLSearchParams({ projectId, ...(period ? { period } : {}) });
    const response = await fetch(`/api/role-room/ads/results/summary?${qs.toString()}`, {
      headers: readRoleRoomAgentHeaders(),
    });
    if (!response.ok) return null;
    return (await response.json().catch(() => null)) as RoleRoomChannelResults | null;
  },

  /** Lag 2: hent siste persisterte anbefalinger for prosjektet + perioden. */
  async fetchAdsRecommendations(projectId: string, period?: string): Promise<RoleRoomAdRecommendationsResult | null> {
    const qs = new URLSearchParams({ projectId, ...(period ? { period } : {}) });
    const response = await fetch(`/api/role-room/ads/recommendations?${qs.toString()}`, {
      headers: readRoleRoomAgentHeaders(),
    });
    if (!response.ok) return null;
    return (await response.json().catch(() => null)) as RoleRoomAdRecommendationsResult | null;
  },

  /** Lag 2: manuell trigger — bygger og lagrer anbefalinger uten å vente på cron. */
  async generateAdsRecommendations(projectId: string, period?: string): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch('/api/role-room/ads/recommendations/generate', {
      method: 'POST',
      headers: { ...readRoleRoomAgentHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, ...(period ? { period } : {}) }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      return { ok: false, error: payload?.detail || payload?.error || 'Kunne ikke generere anbefalinger' };
    }
    return { ok: true };
  },

  // ── Kampanje-styring (se/opprett/pause/gjenoppta/avslutt) ──
  async listAdsCampaigns(opts?: { projectId?: string; platform?: string; status?: string }): Promise<RoleRoomAdsCampaign[]> {
    const qs = new URLSearchParams();
    if (opts?.projectId) qs.set('projectId', opts.projectId);
    if (opts?.platform) qs.set('platform', opts.platform);
    if (opts?.status) qs.set('status', opts.status);
    const response = await fetch(`/api/role-room/ads/campaigns?${qs.toString()}`, {
      headers: readRoleRoomAgentHeaders(),
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => null);
    return Array.isArray(payload?.campaigns) ? payload.campaigns : [];
  },

  async listMetaAdAccounts(): Promise<{ accounts: RoleRoomMetaAdAccount[] } | { error: string }> {
    const response = await fetch('/api/role-room/ads/meta/ad-accounts', {
      headers: readRoleRoomAgentHeaders(),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { error: payload?.error || 'Kunne ikke hente annonsekontoer' };
    return { accounts: Array.isArray(payload?.accounts) ? payload.accounts : [] };
  },

  async createMetaCampaign(input: {
    projectId: string;
    adAccountId: string;
    name: string;
    objective: string;
    dailyBudgetNok?: number;
    goal?: string;
    creativeConfig?: Record<string, unknown> | null;
  }): Promise<{ campaign: RoleRoomAdsCampaign } | { error: string }> {
    const response = await fetch('/api/role-room/ads/meta/campaigns', {
      method: 'POST',
      headers: { ...readRoleRoomAgentHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { error: payload?.detail || payload?.error || 'Kunne ikke opprette kampanje' };
    return { campaign: payload.campaign };
  },

  async listGoogleCustomers(): Promise<{ customers: string[] } | { error: string }> {
    const response = await fetch('/api/role-room/ads/google/customers', {
      headers: readRoleRoomAgentHeaders(),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { error: payload?.detail || payload?.error || 'Kunne ikke hente Google-kontoer' };
    return { customers: Array.isArray(payload?.customers) ? payload.customers : [] };
  },

  async createGoogleAdsCampaign(input: {
    projectId: string;
    customerId: string;
    name: string;
    dailyBudgetNok: number;
    channelType?: string;
    creativeConfig?: Record<string, unknown> | null;
  }): Promise<{ campaign: RoleRoomAdsCampaign } | { error: string }> {
    const response = await fetch('/api/role-room/ads/google/campaigns', {
      method: 'POST',
      headers: { ...readRoleRoomAgentHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { error: payload?.detail || payload?.error || 'Kunne ikke opprette Google-kampanje' };
    return { campaign: payload.campaign };
  },

  async listLinkedInAccounts(): Promise<{ accounts: RoleRoomLinkedInAccount[] } | { error: string }> {
    const response = await fetch('/api/role-room/ads/linkedin/accounts', { headers: readRoleRoomAgentHeaders() });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { error: payload?.detail || payload?.error || 'Kunne ikke hente LinkedIn-kontoer' };
    return { accounts: Array.isArray(payload?.accounts) ? payload.accounts : [] };
  },

  async listLinkedInCampaignGroups(accountUrn: string): Promise<{ groups: RoleRoomLinkedInCampaignGroup[] } | { error: string }> {
    const response = await fetch(
      `/api/role-room/ads/linkedin/campaign-groups?accountUrn=${encodeURIComponent(accountUrn)}`,
      { headers: readRoleRoomAgentHeaders() },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { error: payload?.detail || payload?.error || 'Kunne ikke hente kampanjegrupper' };
    return { groups: Array.isArray(payload?.groups) ? payload.groups : [] };
  },

  async createLinkedInAdsCampaign(input: {
    projectId: string;
    accountUrn: string;
    campaignGroupUrn: string;
    name: string;
    dailyBudgetNok: number;
    objectiveType?: string;
    creativeConfig?: Record<string, unknown> | null;
  }): Promise<{ campaign: RoleRoomAdsCampaign } | { error: string }> {
    const response = await fetch('/api/role-room/ads/linkedin/campaigns', {
      method: 'POST',
      headers: { ...readRoleRoomAgentHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { error: payload?.detail || payload?.error || 'Kunne ikke opprette LinkedIn-kampanje' };
    return { campaign: payload.campaign };
  },

  /** Lag 1 — AI lager plattform-tilpasset annonsetekst fra bedriftskonteksten. */
  async generateAdCreatives(input: {
    projectId: string;
    platform: 'meta' | 'google' | 'linkedin' | 'tiktok';
    goal: string;
    businessName?: string;
    productOrService?: string;
    industry?: string;
    targetAudience?: string;
    keyMessage?: string;
    landingUrl?: string;
    offer?: string;
    complianceNotes?: string;
    language?: 'no' | 'en';
  }): Promise<{ creative: RoleRoomGeneratedAdCreative } | { error: string; missingFields?: string[] }> {
    const response = await fetch('/api/role-room/ads/creatives/generate', {
      method: 'POST',
      headers: { ...readRoleRoomAgentHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        error: payload?.detail || payload?.error || 'Kunne ikke generere annonsetekst',
        missingFields: Array.isArray(payload?.missingFields) ? payload.missingFields : undefined,
      };
    }
    return { creative: payload.creative };
  },

  async pauseAdsCampaign(campaignId: string): Promise<{ ok: boolean; error?: string }> {
    const r = await fetch(`/api/role-room/ads/meta/campaigns/${encodeURIComponent(campaignId)}/pause`, {
      method: 'POST', headers: readRoleRoomAgentHeaders(),
    });
    if (r.ok) return { ok: true };
    const p = await r.json().catch(() => null);
    return { ok: false, error: p?.detail || p?.error };
  },

  async resumeAdsCampaign(campaignId: string): Promise<{ ok: boolean; error?: string }> {
    const r = await fetch(`/api/role-room/ads/meta/campaigns/${encodeURIComponent(campaignId)}/resume`, {
      method: 'POST', headers: readRoleRoomAgentHeaders(),
    });
    if (r.ok) return { ok: true };
    const p = await r.json().catch(() => null);
    return { ok: false, error: p?.detail || p?.error };
  },

  async endAdsCampaign(campaignId: string): Promise<{ ok: boolean; error?: string }> {
    const r = await fetch(`/api/role-room/ads/meta/campaigns/${encodeURIComponent(campaignId)}`, {
      method: 'DELETE', headers: readRoleRoomAgentHeaders(),
    });
    if (r.ok) return { ok: true };
    const p = await r.json().catch(() => null);
    return { ok: false, error: p?.detail || p?.error };
  },

  // Google Ads lifecycle (full kontroll). Mirrors the Meta endpoints.
  async pauseGoogleCampaign(campaignId: string): Promise<{ ok: boolean; error?: string }> {
    const r = await fetch(`/api/role-room/ads/google/campaigns/${encodeURIComponent(campaignId)}/pause`, {
      method: 'POST', headers: readRoleRoomAgentHeaders(),
    });
    if (r.ok) return { ok: true };
    const p = await r.json().catch(() => null);
    return { ok: false, error: p?.detail || p?.error };
  },

  async resumeGoogleCampaign(campaignId: string): Promise<{ ok: boolean; error?: string }> {
    const r = await fetch(`/api/role-room/ads/google/campaigns/${encodeURIComponent(campaignId)}/resume`, {
      method: 'POST', headers: readRoleRoomAgentHeaders(),
    });
    if (r.ok) return { ok: true };
    const p = await r.json().catch(() => null);
    return { ok: false, error: p?.detail || p?.error };
  },

  async endGoogleCampaign(campaignId: string): Promise<{ ok: boolean; error?: string }> {
    const r = await fetch(`/api/role-room/ads/google/campaigns/${encodeURIComponent(campaignId)}`, {
      method: 'DELETE', headers: readRoleRoomAgentHeaders(),
    });
    if (r.ok) return { ok: true };
    const p = await r.json().catch(() => null);
    return { ok: false, error: p?.detail || p?.error };
  },

  // LinkedIn Ads lifecycle (full kontroll).
  async pauseLinkedInCampaign(campaignId: string): Promise<{ ok: boolean; error?: string }> {
    const r = await fetch(`/api/role-room/ads/linkedin/campaigns/${encodeURIComponent(campaignId)}/pause`, {
      method: 'POST', headers: readRoleRoomAgentHeaders(),
    });
    if (r.ok) return { ok: true };
    const p = await r.json().catch(() => null);
    return { ok: false, error: p?.detail || p?.error };
  },

  async resumeLinkedInCampaign(campaignId: string): Promise<{ ok: boolean; error?: string }> {
    const r = await fetch(`/api/role-room/ads/linkedin/campaigns/${encodeURIComponent(campaignId)}/resume`, {
      method: 'POST', headers: readRoleRoomAgentHeaders(),
    });
    if (r.ok) return { ok: true };
    const p = await r.json().catch(() => null);
    return { ok: false, error: p?.detail || p?.error };
  },

  async endLinkedInCampaign(campaignId: string): Promise<{ ok: boolean; error?: string }> {
    const r = await fetch(`/api/role-room/ads/linkedin/campaigns/${encodeURIComponent(campaignId)}`, {
      method: 'DELETE', headers: readRoleRoomAgentHeaders(),
    });
    if (r.ok) return { ok: true };
    const p = await r.json().catch(() => null);
    return { ok: false, error: p?.detail || p?.error };
  },

  async setAdsBudget(projectId: string, maxSpendNok: number, period?: string): Promise<boolean> {
    const response = await fetch('/api/role-room/ads/budget', {
      method: 'PUT',
      headers: { ...readRoleRoomAgentHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, maxSpendNok, ...(period ? { period } : {}) }),
    });
    return response.ok;
  },

  /** Lag 3b: kunden slår automatisk pause av kampanjer ved tak på/av. */
  async setAdsBudgetAutoPause(projectId: string, enabled: boolean, period?: string): Promise<boolean> {
    const response = await fetch('/api/role-room/ads/budget/auto-pause', {
      method: 'PUT',
      headers: { ...readRoleRoomAgentHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, enabled, ...(period ? { period } : {}) }),
    });
    return response.ok;
  },

  async requestAdsOverage(projectId: string, requestedNok: number, note?: string, period?: string): Promise<boolean> {
    const response = await fetch('/api/role-room/ads/budget/request-overage', {
      method: 'POST',
      headers: { ...readRoleRoomAgentHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, requestedNok, note, ...(period ? { period } : {}) }),
    });
    return response.ok;
  },

  async approveAdsOverage(projectId: string, approvedOverageNok: number, period?: string): Promise<boolean> {
    const response = await fetch('/api/role-room/ads/budget/approve-overage', {
      method: 'POST',
      headers: { ...readRoleRoomAgentHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, approvedOverageNok, ...(period ? { period } : {}) }),
    });
    return response.ok;
  },

  async fetchGrantedAdsAssets(): Promise<RoleRoomGrantedAssets> {
    const empty: RoleRoomGrantedAssets = {
      hasAdminAccess: false,
      adminAssets: [],
      platforms: { meta: { connected: false }, linkedin: { connected: false } },
    };
    const response = await fetch('/api/role-room/ads/assets', {
      headers: readRoleRoomAgentHeaders(),
    });
    if (!response.ok) return empty;
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object') return empty;
    return {
      hasAdminAccess: Boolean(payload.hasAdminAccess),
      adminAssets: Array.isArray(payload.adminAssets) ? payload.adminAssets : [],
      platforms: {
        meta: payload.platforms?.meta ?? { connected: false },
        linkedin: payload.platforms?.linkedin ?? { connected: false },
      },
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
      logoUrl?: string | null;
      brandColors?: Array<{ label: string; hex: string; usage?: string | null }>;
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

  /** Item #165 ekte fiks — hent creator-anbefalinger (kuratert + IG live). */
  async fetchCreatorRecommendations(input: {
    postId: string;
    industry?: string | null;
  }): Promise<{
    creators: Array<{ handle: string; displayName: string; platforms: string[]; categories: string[]; followerTier: string; primaryLanguage: string; matchedCategories: string[]; score: number; notes?: string }>;
    igEnriched: Array<{ handle: string; followersCount: number; biography: string | null; profilePictureUrl: string | null }>;
    dataSource: string;
  } | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/posts/${encodeURIComponent(input.postId)}/creators`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({ industry: input.industry ?? null }),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      creators?: unknown[];
      igEnriched?: unknown[];
      dataSource?: string;
    } | null;
    if (!payload?.success) return null;
    return {
      creators: (payload.creators ?? []) as Array<{ handle: string; displayName: string; platforms: string[]; categories: string[]; followerTier: string; primaryLanguage: string; matchedCategories: string[]; score: number; notes?: string }>,
      igEnriched: (payload.igEnriched ?? []) as Array<{ handle: string; followersCount: number; biography: string | null; profilePictureUrl: string | null }>,
      dataSource: payload.dataSource ?? 'curated_only',
    };
  },

  /** Item #168 ekte fiks — generer DALL-E 3 thumbnail. */
  async generatePostThumbnail(input: {
    postId: string;
    brandPrimaryHex?: string | null;
    brandAccentHex?: string | null;
  }): Promise<{
    imageUrl: string;
    revisedPrompt: string | null;
    validForMinutes: number;
    aspectRatio: string;
  } | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/posts/${encodeURIComponent(input.postId)}/thumbnail`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({
          brandPrimaryHex: input.brandPrimaryHex,
          brandAccentHex: input.brandAccentHex,
        }),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      imageUrl?: string;
      revisedPrompt?: string | null;
      validForMinutes?: number;
      aspectRatio?: string;
    } | null;
    if (!payload?.success || !payload.imageUrl) return null;
    return {
      imageUrl: payload.imageUrl,
      revisedPrompt: payload.revisedPrompt ?? null,
      validForMinutes: payload.validForMinutes ?? 60,
      aspectRatio: payload.aspectRatio ?? '1024x1024',
    };
  },

  /** Item #169 ekte fiks — bransje-benchmark reach-estimat. */
  async estimatePostReach(input: {
    postId: string;
    followers?: number | null;
  }): Promise<{
    available: boolean;
    dataSource: string;
    followerCount?: number;
    minReach?: number;
    midReach?: number;
    maxReach?: number;
    per1000FollowersMin?: number;
    per1000FollowersMax?: number;
    confidence: string;
    message?: string;
    note?: string;
  } | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/posts/${encodeURIComponent(input.postId)}/reach-estimate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({ followers: input.followers ?? null }),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || payload.success !== true) return null;
    return {
      available: Boolean(payload.available),
      dataSource: String(payload.dataSource ?? 'benchmark_only'),
      followerCount: typeof payload.followerCount === 'number' ? payload.followerCount : undefined,
      minReach: typeof payload.minReach === 'number' ? payload.minReach : undefined,
      midReach: typeof payload.midReach === 'number' ? payload.midReach : undefined,
      maxReach: typeof payload.maxReach === 'number' ? payload.maxReach : undefined,
      per1000FollowersMin: typeof payload.per1000FollowersMin === 'number' ? payload.per1000FollowersMin : undefined,
      per1000FollowersMax: typeof payload.per1000FollowersMax === 'number' ? payload.per1000FollowersMax : undefined,
      confidence: String(payload.confidence ?? 'low'),
      message: typeof payload.message === 'string' ? payload.message : undefined,
      note: typeof payload.note === 'string' ? payload.note : undefined,
    };
  },

  /** Datakilder — hent unified status for alle koblinger + configs. */
  async fetchDataSources(projectId: string): Promise<{
    sources: Array<{
      key: string;
      label: string;
      group: 'social' | 'analytics' | 'local' | 'video' | 'professional';
      state: 'not_connected' | 'connected' | 'expired' | 'needs_config' | 'needs_test' | 'test_failed' | 'verified';
      connection: { hasToken: boolean; scopes: string[]; expiresAt: string | null; lastRefreshedAt: string | null; profile: { name?: string; email?: string; username?: string } | null } | null;
      configs: Array<{ id: string; configKey: string; configValue: string; displayLabel: string | null; validatedAt: string | null; lastTestResult: { success: boolean; timestamp: string; error?: string } | null }>;
      nextAction:
        | { type: 'connect_oauth'; url: string; label: string }
        | { type: 'refresh_token'; reason: string }
        | { type: 'configure'; missingKeys: string[]; label: string }
        | { type: 'test_connection'; label: string }
        | { type: 'none'; label: string };
      lastSyncedAt: string | null;
      errorMessage: string | null;
    }>;
    verifiedCount: number;
    sourceCount: number;
  } | null> {
    const response = await fetch(
      `/api/role-room/data-sources/${encodeURIComponent(projectId)}`,
      { headers: readRoleRoomAgentHeaders() },
    );
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload || payload.success !== true) return null;
    return {
      sources: (payload.sources as any) ?? [],
      verifiedCount: (payload.verifiedCount as number) ?? 0,
      sourceCount: (payload.sourceCount as number) ?? 0,
    };
  },

  /** Upsert config-entry (GA4 property, GBP location, etc.) */
  async configureDataSource(input: {
    projectId: string;
    platform: string;
    configKey: string;
    configValue: string;
    displayLabel?: string;
  }): Promise<boolean> {
    const response = await fetch(
      `/api/role-room/data-sources/${encodeURIComponent(input.projectId)}/configure`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({
          platform: input.platform,
          configKey: input.configKey,
          configValue: input.configValue,
          displayLabel: input.displayLabel,
        }),
      },
    );
    return response.ok;
  },

  /** Hent Google-properties/locations/channels for dropdown-picker. */
  async discoverGoogleProperties(platform: 'google_analytics' | 'google_business' | 'google_search_console' | 'youtube' | 'all'): Promise<{
    items?: Array<{ id: string; label: string; meta?: Record<string, string> }>;
    analytics?: { items: Array<{ id: string; label: string; meta?: Record<string, string> }>; error: string | null; missingScope?: string };
    business?: { items: Array<{ id: string; label: string; meta?: Record<string, string> }>; error: string | null; missingScope?: string };
    searchConsole?: { items: Array<{ id: string; label: string; meta?: Record<string, string> }>; error: string | null; missingScope?: string };
    youtube?: { items: Array<{ id: string; label: string; meta?: Record<string, string> }>; error: string | null; missingScope?: string };
    error?: string;
  } | null> {
    const url = platform === 'all'
      ? '/api/role-room/data-sources/google/discover'
      : `/api/role-room/data-sources/google/discover?platform=${encodeURIComponent(platform)}`;
    const response = await fetch(url, { headers: readRoleRoomAgentHeaders() });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload || payload.success !== true) return null;
    return payload as ReturnType<typeof Object.assign> as any;
  },

  /** Test connection — pinger faktisk API. */
  async testDataSource(projectId: string, platform: string): Promise<{
    success: boolean;
    timestamp: string;
    error?: string;
    sample?: unknown;
    durationMs?: number;
  } | null> {
    const response = await fetch(
      `/api/role-room/data-sources/${encodeURIComponent(projectId)}/${encodeURIComponent(platform)}/test`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: '{}',
      },
    );
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as { success?: boolean; result?: unknown } | null;
    if (!payload?.success || !payload.result) return null;
    return payload.result as { success: boolean; timestamp: string; error?: string; sample?: unknown; durationMs?: number };
  },

  // ───────── Klient-forespørsler (generisk for hele CSW) ─────────

  async listClientRequests(projectId: string, filters?: {
    status?: 'pending' | 'in_progress' | 'answered' | 'closed';
    contextArea?: string;
  }): Promise<{
    requests: Array<{
      id: string;
      projectId: string;
      kind: string;
      title: string;
      bodyMarkdown: string;
      contextArea: string;
      contextKey: string | null;
      status: 'pending' | 'in_progress' | 'answered' | 'closed';
      clientEmail: string;
      clientName: string | null;
      marketerEmail: string | null;
      bookingUrl: string | null;
      publicAccessToken: string;
      createdAt: string;
      updatedAt: string;
      answeredAt: string | null;
    }>;
    pendingCount: number;
    answeredCount: number;
  } | null> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.contextArea) params.set('contextArea', filters.contextArea);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(
      `/api/role-room/client-requests/${encodeURIComponent(projectId)}${qs}`,
      { headers: readRoleRoomAgentHeaders() },
    );
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload || payload.success !== true) return null;
    return {
      requests: (payload.requests as any) ?? [],
      pendingCount: Number(payload.pendingCount ?? 0),
      answeredCount: Number(payload.answeredCount ?? 0),
    };
  },

  async createClientRequest(input: {
    projectId: string;
    kind: 'data_source_access' | 'brand_assets' | 'kpi_baseline' | 'approval' | 'general_info';
    title: string;
    bodyMarkdown: string;
    contextArea: string;
    contextKey?: string | null;
    clientEmail: string;
    clientName?: string | null;
    marketerEmail?: string | null;
    marketerName?: string | null;
    bookingUrl?: string | null;
    skipEmail?: boolean;
  }): Promise<{ request: any; emailSent: boolean; emailReason: string | null } | null> {
    const response = await fetch(
      `/api/role-room/client-requests/${encodeURIComponent(input.projectId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify(input),
      },
    );
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload || payload.success !== true) return null;
    return {
      request: payload.request,
      emailSent: Boolean(payload.emailSent),
      emailReason: (payload.emailReason as string | null) ?? null,
    };
  },

  async fetchClientRequestThread(id: string): Promise<{
    request: any;
    messages: Array<{ id: string; sender: 'marketer' | 'client' | 'system'; senderLabel: string | null; bodyMarkdown: string; createdAt: string }>;
  } | null> {
    const response = await fetch(
      `/api/role-room/client-requests/by-id/${encodeURIComponent(id)}/messages`,
      { headers: readRoleRoomAgentHeaders() },
    );
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload || payload.success !== true) return null;
    return { request: payload.request, messages: (payload.messages as any) ?? [] };
  },

  async postClientRequestReply(id: string, bodyMarkdown: string): Promise<boolean> {
    const response = await fetch(
      `/api/role-room/client-requests/by-id/${encodeURIComponent(id)}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({ bodyMarkdown }),
      },
    );
    return response.ok;
  },

  async closeClientRequest(id: string): Promise<boolean> {
    const response = await fetch(
      `/api/role-room/client-requests/by-id/${encodeURIComponent(id)}/close`,
      { method: 'PATCH', headers: readRoleRoomAgentHeaders() },
    );
    return response.ok;
  },

  /** Item #176 — skriv én KPI-snapshot manuelt. */
  async writeKpiSnapshot(input: {
    postId: string;
    platform: string;
    metric: string;
    value: number;
  }): Promise<boolean> {
    const response = await fetch(
      `/api/role-room/marketing-plan/posts/${encodeURIComponent(input.postId)}/kpi-snapshot`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({
          platform: input.platform,
          metric: input.metric,
          value: input.value,
        }),
      },
    );
    return response.ok;
  },

  /** Items #177 + #178 + #179 — trigger sync av alle connectors. */
  async syncKpis(planId: string): Promise<{
    snapshotsWritten: number;
    snapshotsFailed?: number;
    perConnectorCount: Record<string, number>;
    eligiblePosts: number;
  } | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/${encodeURIComponent(planId)}/kpi-sync`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: '{}',
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; snapshotsWritten?: number; snapshotsFailed?: number; perConnectorCount?: Record<string, number>; eligiblePosts?: number }
      | null;
    if (!payload?.success) return null;
    return {
      snapshotsWritten: payload.snapshotsWritten ?? 0,
      snapshotsFailed: payload.snapshotsFailed,
      perConnectorCount: payload.perConnectorCount ?? {},
      eligiblePosts: payload.eligiblePosts ?? 0,
    };
  },

  /** Items #181 + #184-#187 + #189 + #183 — hent KPI-sammendrag for plan. */
  async fetchKpiSummary(planId: string, sinceDays = 30): Promise<{
    summary: Array<{ platform: string; metric: string; latestValue: number; latestCapturedAt: string; previousValue: number | null; deltaPct: number | null; samplePoints: number }>;
    snapshots: Array<{ id: string; postId: string; planId: string; platform: string; metric: string; value: number; capturedAt: string; source: string }>;
    snapshotCount: number;
    aggregates: {
      byPillar: Array<{ key: string; label: string; postCount: number; snapshotCount: number; sumByMetric: Record<string, number>; avgByMetric: Record<string, number> }>;
      byPlatform: Array<{ key: string; label: string; postCount: number; snapshotCount: number; sumByMetric: Record<string, number>; avgByMetric: Record<string, number> }>;
      byFormat: Array<{ key: string; label: string; postCount: number; snapshotCount: number; sumByMetric: Record<string, number>; avgByMetric: Record<string, number> }>;
      byTimeWindow: Array<{ key: string; label: string; postCount: number; snapshotCount: number; sumByMetric: Record<string, number>; avgByMetric: Record<string, number> }>;
    };
    outliers: Array<{ postId: string; pillarId: string | null; metric: string; postValue: number; pillarMean: number; pillarStdDev: number; zScore: number; kind: 'winner' | 'concern'; recommendation: string }>;
    corrections: Array<{ id: string; severity: 'info' | 'warning' | 'critical'; title: string; detail: string; actionHint: string }>;
    targets: Array<{ metric: string; target: number; per: 'post' | 'week' | 'month' | 'quarter' }>;
  } | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/${encodeURIComponent(planId)}/kpi-summary?sinceDays=${sinceDays}`,
      { headers: readRoleRoomAgentHeaders() },
    );
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload || payload.success !== true) return null;
    return {
      summary: (payload.summary as any) ?? [],
      snapshots: (payload.snapshots as any) ?? [],
      snapshotCount: (payload.snapshotCount as number) ?? 0,
      aggregates: (payload.aggregates as any) ?? { byPillar: [], byPlatform: [], byFormat: [], byTimeWindow: [] },
      outliers: (payload.outliers as any) ?? [],
      corrections: (payload.corrections as any) ?? [],
      targets: (payload.targets as any) ?? [],
    };
  },

  /** Item #170 — generér 3 svar-maler for forventede kommentarer. */
  async generateReplyTemplates(postId: string): Promise<{
    positive: string | null;
    question: string | null;
    negative: string | null;
  } | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/posts/${encodeURIComponent(postId)}/reply-templates`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: '{}',
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; templates?: { positive: string | null; question: string | null; negative: string | null } }
      | null;
    return payload?.success ? payload.templates ?? null : null;
  },

  /** Item #158 — lag A/B-variant av en post. */
  async generateMarketingPlanPostVariant(input: {
    postId: string;
  }): Promise<MarketingPlanPost | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/posts/${encodeURIComponent(input.postId)}/variant`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: '{}',
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as { success?: boolean; variant?: unknown } | null;
    if (!payload?.success || !payload.variant) return null;
    const r = payload.variant as Record<string, unknown>;
    return {
      id: String(r.id),
      planId: String(r.plan_id),
      pillarId: (r.pillar_id as string | null) ?? null,
      sortOrder: Number(r.sort_order ?? 0),
      dayOffset: (r.day_offset as number | null) ?? null,
      hook: String(r.hook ?? ''),
      format: r.format as MarketingPlanPost['format'],
      script: (r.script as string | null) ?? null,
      captionDraft: (r.caption_draft as string | null) ?? null,
      callToAction: (r.call_to_action as string | null) ?? null,
      primaryPlatform: (r.primary_platform as MarketingPlanPost['primaryPlatform']) ?? null,
      crossPostPlan: Array.isArray(r.cross_post_plan) ? (r.cross_post_plan as MarketingPlanPost['crossPostPlan']) : [],
      goalKpi: (r.goal_kpi as MarketingPlanPost['goalKpi']) ?? null,
      status: (r.status as MarketingPlanPost['status']) ?? 'proposed',
      feedPlanPostId: (r.feed_plan_post_id as string | null) ?? null,
      scheduledFor: (r.scheduled_for as string | null) ?? null,
      publishedAt: (r.published_at as string | null) ?? null,
      createdAt: String(r.created_at ?? new Date().toISOString()),
      updatedAt: String(r.updated_at ?? new Date().toISOString()),
    };
  },

  /** Item #152 — sjekk progresjon for post-generering (bakgrunns-jobb). */
  async checkMarketingPlanPostsProgress(planId: string): Promise<{
    generated: number;
    expected: number;
    complete: boolean;
  } | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/${encodeURIComponent(planId)}/posts/progress`,
      { headers: readRoleRoomAgentHeaders() },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; generated?: number; expected?: number; complete?: boolean }
      | null;
    if (!payload?.success) return null;
    return {
      generated: payload.generated ?? 0,
      expected: payload.expected ?? 0,
      complete: payload.complete ?? false,
    };
  },

  /** Item #157 — regenerér én post med valgfri tone-hint. */
  async regenerateMarketingPlanPost(input: {
    postId: string;
    hint?: string;
  }): Promise<MarketingPlanPost | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/posts/${encodeURIComponent(input.postId)}/regenerate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({ hint: input.hint ?? '' }),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as { success?: boolean; post?: unknown } | null;
    if (!payload?.success || !payload.post) return null;
    // Backend returnerer snake_case-rader fra Postgres; mapper til camelCase.
    const r = payload.post as Record<string, unknown>;
    return {
      id: String(r.id),
      planId: String(r.plan_id),
      pillarId: (r.pillar_id as string | null) ?? null,
      sortOrder: Number(r.sort_order ?? 0),
      dayOffset: (r.day_offset as number | null) ?? null,
      hook: String(r.hook ?? ''),
      format: r.format as MarketingPlanPost['format'],
      script: (r.script as string | null) ?? null,
      captionDraft: (r.caption_draft as string | null) ?? null,
      callToAction: (r.call_to_action as string | null) ?? null,
      primaryPlatform: (r.primary_platform as MarketingPlanPost['primaryPlatform']) ?? null,
      crossPostPlan: Array.isArray(r.cross_post_plan) ? (r.cross_post_plan as MarketingPlanPost['crossPostPlan']) : [],
      goalKpi: (r.goal_kpi as MarketingPlanPost['goalKpi']) ?? null,
      status: (r.status as MarketingPlanPost['status']) ?? 'proposed',
      feedPlanPostId: (r.feed_plan_post_id as string | null) ?? null,
      scheduledFor: (r.scheduled_for as string | null) ?? null,
      publishedAt: (r.published_at as string | null) ?? null,
      createdAt: String(r.created_at ?? new Date().toISOString()),
      updatedAt: String(r.updated_at ?? new Date().toISOString()),
    };
  },

  /** Items #142 / #145 — patch pillar (rename, edit description, toggle). */
  async updatePillar(input: {
    pillarId: string;
    name?: string;
    description?: string;
    rationale?: string;
    isActive?: boolean;
  }): Promise<MarketingPlanPillar | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/pillars/${encodeURIComponent(input.pillarId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          rationale: input.rationale,
          isActive: input.isActive,
        }),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as { success?: boolean; pillar?: MarketingPlanPillar } | null;
    return payload?.success ? payload.pillar ?? null : null;
  },

  /** Item #144 — opprett egendefinert pillar. */
  async addCustomPillar(input: {
    planId: string;
    name: string;
    description?: string;
    rationale?: string;
  }): Promise<MarketingPlanPillar | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/${encodeURIComponent(input.planId)}/pillars`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          rationale: input.rationale,
        }),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as { success?: boolean; pillar?: MarketingPlanPillar } | null;
    return payload?.success ? payload.pillar ?? null : null;
  },

  /** Item #144 — slett kun custom-pillars. AI-genererte må toggles. */
  async deleteCustomPillar(pillarId: string): Promise<boolean> {
    const response = await fetch(
      `/api/role-room/marketing-plan/pillars/${encodeURIComponent(pillarId)}`,
      {
        method: 'DELETE',
        headers: readRoleRoomAgentHeaders(),
      },
    );
    return response.ok;
  },

  async sharePlanPreview(input: {
    planId: string;
    projectId: string;
  }): Promise<{ shareUrl: string; token: string; expiresAt: string; expiresInHours: number } | null> {
    const response = await fetch(
      `/api/role-room/marketing-plan/${encodeURIComponent(input.planId)}/share`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...readRoleRoomAgentHeaders() },
        body: JSON.stringify({ projectId: input.projectId }),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; shareUrl?: string; token?: string; expiresAt?: string; expiresInHours?: number }
      | null;
    if (!payload?.success || !payload.shareUrl || !payload.token || !payload.expiresAt) return null;
    return {
      shareUrl: payload.shareUrl,
      token: payload.token,
      expiresAt: payload.expiresAt,
      expiresInHours: payload.expiresInHours ?? 24,
    };
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

  // ── Post-redigering (inline edit i dashboard) ────────────────────
  async updateMarketingPlanPost(postId: string, patch: {
    hook?: string;
    script?: string;
    captionDraft?: string;
    callToAction?: string;
    format?: MarketingPlanPost['format'];
    primaryPlatform?: MarketingPlanPost['primaryPlatform'];
    dayOffset?: number | null;
    status?: MarketingPlanPost['status'];
  }): Promise<MarketingPlanPost> {
    const response = await fetch(
      `/api/role-room/marketing-plan/posts/${encodeURIComponent(postId)}`,
      {
        method: 'PATCH',
        headers: { ...readRoleRoomAgentHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; post?: MarketingPlanPost; error?: string } | null;
    if (!response.ok || !payload?.post) {
      throw new Error(payload?.error || `Kunne ikke oppdatere posten (HTTP ${response.status})`);
    }
    return payload.post;
  },

  // ── Versjonering: research/intake ────────────────────────────────
  async listIntakeVersions(projectId: string): Promise<IntakeVersion[]> {
    const response = await fetch(
      `/api/role-room/research/${encodeURIComponent(projectId)}/versions`,
      { headers: readRoleRoomAgentHeaders() },
    );
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; versions?: IntakeVersion[] } | null;
    return payload?.versions ?? [];
  },

  async activateIntakeVersion(projectId: string, versionId: string): Promise<void> {
    const response = await fetch(
      `/api/role-room/research/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/activate`,
      { method: 'POST', headers: readRoleRoomAgentHeaders() },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error || `Aktivering feilet (HTTP ${response.status})`);
    }
  },

  async labelIntakeVersion(projectId: string, versionId: string, label: string): Promise<void> {
    const response = await fetch(
      `/api/role-room/research/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/label`,
      {
        method: 'POST',
        headers: { ...readRoleRoomAgentHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      },
    );
    if (!response.ok) throw new Error(`Label-oppdatering feilet (HTTP ${response.status})`);
  },

  // ── Versjonering: markedsplan ───────────────────────────────────
  async listPlanVersions(projectId: string): Promise<PlanVersion[]> {
    const response = await fetch(
      `/api/role-room/marketing-plan/${encodeURIComponent(projectId)}/versions`,
      { headers: readRoleRoomAgentHeaders() },
    );
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; versions?: PlanVersion[] } | null;
    return payload?.versions ?? [];
  },

  async activatePlanVersion(projectId: string, versionId: string): Promise<void> {
    const response = await fetch(
      `/api/role-room/marketing-plan/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/activate`,
      { method: 'POST', headers: readRoleRoomAgentHeaders() },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(payload.error || `Aktivering feilet (HTTP ${response.status})`);
    }
  },

  async labelPlanVersion(projectId: string, versionId: string, label: string): Promise<void> {
    const response = await fetch(
      `/api/role-room/marketing-plan/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/label`,
      {
        method: 'POST',
        headers: { ...readRoleRoomAgentHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      },
    );
    if (!response.ok) throw new Error(`Label-oppdatering feilet (HTTP ${response.status})`);
  },
};

export interface IntakeVersion {
  id: string;
  versionNumber: number;
  label: string | null;
  generatedByKind: 'user' | 'agent';
  generatedByUserId: string | null;
  generatedByName: string | null;
  isActive: boolean;
  createdAt: string;
  goalPreview: string | null;
}

export interface PlanVersion {
  id: string;
  versionNumber: number;
  label: string | null;
  generatedByKind: 'user' | 'agent';
  generatedByUserId: string | null;
  generatedByName: string | null;
  isActive: boolean;
  createdAt: string;
  valueProp: string | null;
  pillarCount: number;
  postCount: number;
}

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
  /** Token-bruk + kostnad fra Claude-respons (items #146 + #147). Optional —
   *  eldre lagrede planer mangler dette feltet. */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens?: number;
    cacheCreationInputTokens?: number;
    costNok: number | null;
  };
}

export interface MarketingPlanPillar {
  id: string;
  planId: string;
  name: string;
  description: string;
  rationale: string;
  targetKpi?: { metric: string; target: number; per: 'post' | 'week' | 'month' | 'quarter' } | null;
  sortOrder: number;
  /** Item #145. False = ekskludert fra post-generering, men bevart i DB. */
  isActive?: boolean;
  /** Item #144. True = lagt til manuelt av brukeren, kan slettes. */
  isCustom?: boolean;
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
  /** Audit — settes ved hver inline-edit (PATCH /posts/:postId). */
  lastEditedAt?: string | null;
  lastEditedByUserId?: string | null;
  lastEditedByName?: string | null;
}

export default roleRoomAgentService;
