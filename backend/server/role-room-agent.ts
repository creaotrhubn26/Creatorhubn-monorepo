import { load } from "cheerio";
import { CohereClientV2 } from "cohere-ai";

type RoleRoomAgentProducerBootstrapInput = {
  projectId: string;
  projectName?: string;
  websiteUrl?: string | null;
  organizationNumber?: string | null;
  companyName?: string | null;
  extraContext?: string | null;
};

type RoleRoomAgentSocialPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "x"
  | "threads"
  | "vimeo"
  | "pinterest";

type RoleRoomAgentSocialProfileEvidence = {
  type:
    | "website_link"
    | "schema_same_as"
    | "name_match"
    | "handle_match"
    | "domain_match"
    | "company_context"
    | "manual_review_needed";
  label: string;
  weight: number;
};

type RoleRoomAgentSocialProfileCandidate = {
  platform: RoleRoomAgentSocialPlatform;
  url: string;
  canonicalUrl: string;
  handle?: string | null;
  displayName?: string | null;
  confidence: number;
  status: "verified" | "likely" | "needs_review" | "rejected";
  evidence: RoleRoomAgentSocialProfileEvidence[];
  source: "company_website" | "schema_same_as" | "manual";
  foundOnUrls: string[];
  requiresManualConfirmation: boolean;
};

type RoleRoomAgentCompetitorEvidence = {
  type:
    | "google_places_result"
    | "same_category"
    | "location_overlap"
    | "website_available"
    | "review_signal"
    | "manual_review_needed";
  label: string;
  weight: number;
};

type RoleRoomAgentCompetitorCandidate = {
  source: "google_places";
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
  status: "verified" | "likely" | "needs_review" | "rejected";
  evidence: RoleRoomAgentCompetitorEvidence[];
  relevanceReason: string;
  marketingSignals: {
    positionHint: string;
    contentAngles: string[];
    ctaOpportunities: string[];
    riskNotes: string[];
  };
  requiresManualConfirmation: boolean;
};

type RoleRoomAgentCompetitorAnalysis = {
  status: "ready" | "limited" | "unavailable";
  source: "google_places" | "fallback";
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
};

type RoleRoomAgentWebsiteInsights = {
  finalUrl?: string | null;
  pageTitle?: string | null;
  siteName?: string | null;
  metaDescription?: string | null;
  textSnippet?: string | null;
  probableLogoUrl?: string | null;
  socialProfileCandidates?: RoleRoomAgentSocialProfileCandidate[];
  selectedPageSnippets: RoleRoomAgentWebsitePageSnippet[];
};

type RoleRoomAgentWebsitePageSnippet = {
  url: string;
  title?: string | null;
  snippet: string;
  sourceLabel?: string | null;
  relevanceScore?: number | null;
};

type RoleRoomAgentBrandColor = {
  label: string;
  hex: string;
  usage?: string;
};

type RoleRoomAgentBusinessClassification = {
  industry: string;
  subIndustry: string;
  businessModel: string;
  contentCategory: string;
  productionApproach: string;
  customerJourneyFocus: string;
};

type RoleRoomAgentReviewQuote = {
  author?: string;
  rating?: number | null;
  text: string;
  relativeTime?: string;
  googleMapsUri?: string | null;
};

type RoleRoomAgentBusinessSignals = {
  source: "google_places";
  displayName?: string;
  formattedAddress?: string | null;
  googleMapsUri?: string | null;
  websiteUri?: string | null;
  primaryType?: string | null;
  primaryTypeDisplayName?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  reviewSummary?: string | null;
  topReviews: RoleRoomAgentReviewQuote[];
  serviceSignals: string[];
};

type RoleRoomAgentBrregLookupStatus =
  | "verified"
  | "not_found"
  | "invalid"
  | "unavailable"
  | "skipped";

type RoleRoomAgentBrregCompany = {
  source: "brreg";
  lookupStatus: RoleRoomAgentBrregLookupStatus;
  lookupInput?: string | null;
  matchedBy?: "organization_number" | "company_name" | null;
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
};

type RoleRoomAgentCompanyAge = {
  status: "unknown" | "new" | "young" | "established" | "mature";
  label: string;
  registrationDate?: string | null;
  years?: number | null;
  months?: number | null;
  daysSinceRegistration?: number | null;
  isNewCompany: boolean;
};

type RoleRoomAgentAgreementSuggestion = {
  id: string;
  title: string;
  detail: string;
  priority: "critical" | "recommended" | "standard";
};

type RoleRoomAgentRetrievalMeta = {
  cohereRerankUsed: boolean;
  rerankerModel?: string;
  websitePagesReviewed: number;
  websitePagesSelected: number;
  reviewsReviewed: number;
  reviewsSelected: number;
  competitorsReviewed: number;
  competitorsSelected: number;
  brregLookupStatus?: RoleRoomAgentBrregLookupStatus;
  brregMatchedBy?: RoleRoomAgentBrregCompany["matchedBy"];
};

type RoleRoomAgentRerankResult<T> = {
  items: Array<T & { relevanceScore?: number | null }>;
  used: boolean;
  model?: string;
};

type RoleRoomAgentNormalizedPayload = {
  generatedAt: string;
  provider: "openai" | "fallback";
  model: string;
  businessSignals?: RoleRoomAgentBusinessSignals | null;
  brregCompany?: RoleRoomAgentBrregCompany | null;
  companyAge?: RoleRoomAgentCompanyAge | null;
  agreementSuggestions: RoleRoomAgentAgreementSuggestion[];
  socialProfileCandidates: RoleRoomAgentSocialProfileCandidate[];
  competitorAnalysis: RoleRoomAgentCompetitorAnalysis;
  retrievalMeta?: RoleRoomAgentRetrievalMeta;
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
  intakeDraft: Record<string, string>;
  planningDraft: {
    activationPlan: Record<string, unknown>;
    contentLogic: Record<string, unknown>;
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
};

export const DEFAULT_ROLE_ROOM_AGENT_MODEL =
  process.env.ROLE_ROOM_AGENT_MODEL || "gpt-5.4-mini";
export const DEFAULT_ROLE_ROOM_AGENT_COHERE_RERANK_MODEL =
  process.env.ROLE_ROOM_AGENT_COHERE_RERANK_MODEL || "rerank-v3.5";

let cachedCohereClient: CohereClientV2 | null | undefined;

export function getRoleRoomAgentRuntimeConfig() {
  return {
    provider: "openai" as const,
    providerConfigured: hasText(process.env.OPENAI_API_KEY),
    defaultModel: DEFAULT_ROLE_ROOM_AGENT_MODEL,
    googlePlacesConfigured: hasText(process.env.GOOGLE_PLACES_API_KEY),
    cohereConfigured: hasText(process.env.COHERE_API_KEY),
    cohereRerankModel: DEFAULT_ROLE_ROOM_AGENT_COHERE_RERANK_MODEL,
    brregConfigured: true,
  };
}

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

function getCohereClient(): CohereClientV2 | null {
  const token = process.env.COHERE_API_KEY;
  if (!hasText(token)) {
    return null;
  }

  if (cachedCohereClient === undefined) {
    cachedCohereClient = new CohereClientV2({
      token,
      clientName: "creatorhub-role-room-agent",
    });
  }

  return cachedCohereClient;
}

const toSentenceCase = (value: string): string => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return "";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const normalizeStringArray = (value: unknown, fallback: string[] = []): string[] => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return Array.from(
    new Set(
      value
        .map((entry) => (hasText(entry) ? normalizeWhitespace(entry) : ""))
        .filter((entry) => entry.length > 0),
    ),
  ).slice(0, 10);
};

const normalizeBrandColors = (value: unknown): RoleRoomAgentBrandColor[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry): RoleRoomAgentBrandColor | null => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const label = hasText(record.label) ? normalizeWhitespace(record.label) : "";
      const hex = hasText(record.hex) ? normalizeWhitespace(record.hex) : "";
      if (!label || !/^#?[0-9a-f]{3,8}$/i.test(hex)) {
        return null;
      }
      return {
        label,
        hex: hex.startsWith("#") ? hex : `#${hex}`,
        usage: hasText(record.usage) ? normalizeWhitespace(record.usage) : undefined,
      };
    })
    .filter((entry): entry is RoleRoomAgentBrandColor => entry !== null)
    .slice(0, 8);
};

function normalizeWebsiteUrl(rawUrl: string | null | undefined): string | null {
  if (!hasText(rawUrl)) {
    return null;
  }

  const candidate = rawUrl.trim().startsWith("http") ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  try {
    const parsed = new URL(candidate);
    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveUrl(baseUrl: string, maybeRelative: string | null | undefined): string | null {
  if (!hasText(maybeRelative)) {
    return null;
  }

  try {
    return new URL(maybeRelative.trim(), baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeIdentity(value: string | null | undefined): string {
  return normalizeWhitespace(value || "")
    .toLowerCase()
    .replace(/&/g, "og")
    .replace(/[^a-z0-9æøå]+/gi, "");
}

function normalizeHost(value: string | null | undefined): string | null {
  if (!hasText(value)) {
    return null;
  }

  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? normalizeWhitespace(decodeHtmlEntities(match[1])) : null;
}

function extractMetaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return normalizeWhitespace(decodeHtmlEntities(match[1]));
    }
  }

  return null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const BRREG_API_BASE_URL = "https://data.brreg.no/enhetsregisteret/api";

function normalizeOrganizationNumber(value: unknown): string | null {
  if (!hasText(value)) {
    return null;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length === 9 ? digits : null;
}

function formatBrregAddress(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const addressLines = Array.isArray(record.adresse)
    ? record.adresse
        .map((entry) => (hasText(entry) ? normalizeWhitespace(entry) : ""))
        .filter(Boolean)
    : [];
  const postalCode = hasText(record.postnummer) ? normalizeWhitespace(record.postnummer) : "";
  const city = hasText(record.poststed) ? normalizeWhitespace(record.poststed) : "";
  const country = hasText(record.land) ? normalizeWhitespace(record.land) : "";
  const parts = [
    addressLines.join(", "),
    [postalCode, city].filter(Boolean).join(" "),
    country && country.toLowerCase() !== "norge" ? country : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function readBrregNestedText(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  return hasText(record[key]) ? normalizeWhitespace(record[key]) : null;
}

function mapBrregUnit(
  unit: Record<string, unknown>,
  lookupStatus: RoleRoomAgentBrregLookupStatus,
  input: string | null,
  matchedBy: RoleRoomAgentBrregCompany["matchedBy"],
): RoleRoomAgentBrregCompany {
  const organizationForm = unit.organisasjonsform && typeof unit.organisasjonsform === "object" && !Array.isArray(unit.organisasjonsform)
    ? (unit.organisasjonsform as Record<string, unknown>)
    : {};
  const industryCode = unit.naeringskode1 && typeof unit.naeringskode1 === "object" && !Array.isArray(unit.naeringskode1)
    ? (unit.naeringskode1 as Record<string, unknown>)
    : {};
  const businessAddress = unit.forretningsadresse && typeof unit.forretningsadresse === "object" && !Array.isArray(unit.forretningsadresse)
    ? (unit.forretningsadresse as Record<string, unknown>)
    : {};

  return {
    source: "brreg",
    lookupStatus,
    lookupInput: input,
    matchedBy,
    organizationNumber: hasText(unit.organisasjonsnummer) ? normalizeWhitespace(unit.organisasjonsnummer) : null,
    name: hasText(unit.navn) ? normalizeWhitespace(unit.navn) : null,
    organizationForm: {
      code: readBrregNestedText(organizationForm, "kode"),
      description: readBrregNestedText(organizationForm, "beskrivelse"),
    },
    industryCode: {
      code: readBrregNestedText(industryCode, "kode"),
      description: readBrregNestedText(industryCode, "beskrivelse"),
    },
    registrationDate: hasText(unit.registreringsdatoEnhetsregisteret)
      ? normalizeWhitespace(unit.registreringsdatoEnhetsregisteret)
      : null,
    foundationDate: hasText(unit.stiftelsesdato) ? normalizeWhitespace(unit.stiftelsesdato) : null,
    vatRegistered: typeof unit.registrertIMvaregisteret === "boolean" ? unit.registrertIMvaregisteret : null,
    businessRegisterRegistered: typeof unit.registrertIForetaksregisteret === "boolean"
      ? unit.registrertIForetaksregisteret
      : null,
    employeeCount: asNumber(unit.antallAnsatte),
    businessAddress: formatBrregAddress(unit.forretningsadresse),
    postalAddress: formatBrregAddress(unit.postadresse),
    municipality: readBrregNestedText(businessAddress, "kommune"),
    website: hasText(unit.hjemmeside) ? normalizeWebsiteUrl(unit.hjemmeside) : null,
    statusFlags: {
      bankrupt: unit.konkurs === true,
      underLiquidation: unit.underAvvikling === true,
      forcedDissolution: unit.underTvangsavviklingEllerTvangsopplosning === true,
      deleted: hasText(unit.slettedato),
    },
    statusMessage: null,
  };
}

function buildBrregUnavailable(status: RoleRoomAgentBrregLookupStatus, input: string | null, statusMessage: string): RoleRoomAgentBrregCompany {
  return {
    source: "brreg",
    lookupStatus: status,
    lookupInput: input,
    matchedBy: null,
    organizationNumber: null,
    name: null,
    organizationForm: null,
    industryCode: null,
    registrationDate: null,
    foundationDate: null,
    vatRegistered: null,
    businessRegisterRegistered: null,
    employeeCount: null,
    businessAddress: null,
    postalAddress: null,
    municipality: null,
    website: null,
    statusFlags: {},
    statusMessage,
  };
}

async function fetchBrregCompany(input: RoleRoomAgentProducerBootstrapInput): Promise<RoleRoomAgentBrregCompany | null> {
  const rawOrgNumber = hasText(input.organizationNumber) ? normalizeWhitespace(input.organizationNumber) : null;
  const organizationNumber = normalizeOrganizationNumber(input.organizationNumber);
  const companyName = hasText(input.companyName) ? normalizeWhitespace(input.companyName) : "";

  if (rawOrgNumber && !organizationNumber) {
    return buildBrregUnavailable("invalid", rawOrgNumber, "Organisasjonsnummeret må ha 9 siffer.");
  }

  if (!organizationNumber && companyName.length < 3) {
    return null;
  }

  try {
    if (organizationNumber) {
      const response = await fetch(`${BRREG_API_BASE_URL}/enheter/${organizationNumber}`, {
        headers: {
          "User-Agent": "CreatorHub Role Room Agent/1.0 (+https://theroleroom.com)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (response.status === 404) {
        return buildBrregUnavailable("not_found", organizationNumber, "Fant ikke bedrift med dette organisasjonsnummeret i Enhetsregisteret.");
      }
      if (!response.ok) {
        return buildBrregUnavailable("unavailable", organizationNumber, `Brreg svarte med status ${response.status}.`);
      }
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return buildBrregUnavailable("unavailable", organizationNumber, "Brreg svarte uten gyldig enhetsdata.");
      }
      return mapBrregUnit(payload, "verified", organizationNumber, "organization_number");
    }

    const params = new URLSearchParams({
      navn: companyName,
      size: "5",
    });
    const response = await fetch(`${BRREG_API_BASE_URL}/enheter?${params.toString()}`, {
      headers: {
        "User-Agent": "CreatorHub Role Room Agent/1.0 (+https://theroleroom.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return buildBrregUnavailable("unavailable", companyName, `Brreg-søk svarte med status ${response.status}.`);
    }
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const embedded = payload?._embedded && typeof payload._embedded === "object" && !Array.isArray(payload._embedded)
      ? (payload._embedded as Record<string, unknown>)
      : {};
    const units = Array.isArray(embedded.enheter)
      ? embedded.enheter.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object" && !Array.isArray(entry)))
      : [];
    if (units.length === 0) {
      return buildBrregUnavailable("not_found", companyName, "Fant ingen treff i Enhetsregisteret.");
    }

    const normalizedQuery = companyName.toLowerCase();
    const selected = [...units].sort((left, right) => {
      const leftName = hasText(left.navn) ? normalizeWhitespace(left.navn).toLowerCase() : "";
      const rightName = hasText(right.navn) ? normalizeWhitespace(right.navn).toLowerCase() : "";
      const score = (name: string, unit: Record<string, unknown>) => {
        let value = 0;
        if (name === normalizedQuery) value += 100;
        if (name.includes(normalizedQuery) || normalizedQuery.includes(name)) value += 45;
        if (unit.slettedato) value -= 30;
        if (unit.konkurs === true || unit.underAvvikling === true || unit.underTvangsavviklingEllerTvangsopplosning === true) value -= 25;
        return value;
      };
      return score(rightName, right) - score(leftName, left);
    })[0];

    return mapBrregUnit(selected, "verified", companyName, "company_name");
  } catch (error) {
    return buildBrregUnavailable(
      "unavailable",
      organizationNumber || companyName,
      error instanceof Error ? error.message : "Kunne ikke hente data fra Brreg.",
    );
  }
}

function calculateCompanyAge(brregCompany: RoleRoomAgentBrregCompany | null): RoleRoomAgentCompanyAge | null {
  const registrationDate = brregCompany?.registrationDate || brregCompany?.foundationDate || null;
  if (!registrationDate) {
    return brregCompany
      ? {
          status: "unknown",
          label: "Alder ukjent",
          registrationDate: null,
          years: null,
          months: null,
          daysSinceRegistration: null,
          isNewCompany: false,
        }
      : null;
  }

  const registeredAt = new Date(`${registrationDate}T00:00:00.000Z`);
  if (Number.isNaN(registeredAt.getTime())) {
    return {
      status: "unknown",
      label: "Alder ukjent",
      registrationDate,
      years: null,
      months: null,
      daysSinceRegistration: null,
      isNewCompany: false,
    };
  }

  const daysSinceRegistration = Math.max(0, Math.floor((Date.now() - registeredAt.getTime()) / 86_400_000));
  const years = Math.floor(daysSinceRegistration / 365.25);
  const months = Math.floor((daysSinceRegistration % 365.25) / 30.44);
  const status: RoleRoomAgentCompanyAge["status"] =
    daysSinceRegistration < 365
      ? "new"
      : daysSinceRegistration < 365 * 3
        ? "young"
        : daysSinceRegistration < 365 * 10
          ? "established"
          : "mature";
  const label =
    status === "new"
      ? `Ny bedrift · ca. ${Math.max(1, months)} mnd`
      : status === "young"
        ? `Ung bedrift · ca. ${years} år ${months} mnd`
        : status === "established"
          ? `Etablert bedrift · ca. ${years} år`
          : `Moden bedrift · ca. ${years} år`;

  return {
    status,
    label,
    registrationDate,
    years,
    months,
    daysSinceRegistration,
    isNewCompany: daysSinceRegistration < 365 * 3,
  };
}

function buildAgreementSuggestions(
  brregCompany: RoleRoomAgentBrregCompany | null,
  companyAge: RoleRoomAgentCompanyAge | null,
): RoleRoomAgentAgreementSuggestion[] {
  const suggestions: RoleRoomAgentAgreementSuggestion[] = [];
  const flags = brregCompany?.statusFlags ?? {};

  if (flags.bankrupt || flags.underLiquidation || flags.forcedDissolution || flags.deleted) {
    suggestions.push({
      id: "manual-risk-review",
      title: "Manuell risikosjekk før avtale",
      detail: "Brreg indikerer konkurs, avvikling, tvangsoppløsning eller slettet enhet. Ikke send standardavtale før eier, betalingsevne og signaturrett er kontrollert.",
      priority: "critical",
    });
  }

  if (companyAge?.isNewCompany) {
    suggestions.push({
      id: "new-company-payment-terms",
      title: "Ny kunde: delbetaling og kort godkjenningsløp",
      detail: "Bedriften er relativt ny. Bruk tydelig scope, forskudd/delbetaling, korte milepæler og skriftlig godkjenning før større produksjonskostnader.",
      priority: "recommended",
    });
  }

  if (brregCompany?.vatRegistered === false) {
    suggestions.push({
      id: "vat-clarification",
      title: "Avklar MVA og fakturagrunnlag",
      detail: "Enheten står ikke som MVA-registrert i Brreg. Avklar fakturamottaker, MVA-håndtering og om avtalen skal inngås med annen juridisk enhet.",
      priority: "recommended",
    });
  }

  const orgFormCode = brregCompany?.organizationForm?.code?.toUpperCase() || "";
  if (orgFormCode === "ENK") {
    suggestions.push({
      id: "sole-proprietor-approval",
      title: "ENK: tydelig rettighets- og betalingsansvar",
      detail: "For enkeltpersonforetak bør avtalen være ekstra tydelig på leveranser, betalingsfrist, bruksrettigheter, kansellering og hvem som godkjenner publisering.",
      priority: "recommended",
    });
  } else if (orgFormCode === "AS") {
    suggestions.push({
      id: "company-signatory",
      title: "AS: bekreft signaturrett og bestiller",
      detail: "For aksjeselskap bør bestiller, fakturamottaker og person med fullmakt/signaturrett fremgå før produksjonen låses.",
      priority: "standard",
    });
  }

  if ((brregCompany?.employeeCount ?? 0) === 0) {
    suggestions.push({
      id: "small-company-scope",
      title: "Lite team: enkel scope og lav friksjon",
      detail: "Brreg viser ingen ansatte registrert. Hold avtalen lett å forstå, med tydelig ansvar, leveranseliste og én godkjenningsansvarlig.",
      priority: "standard",
    });
  }

  suggestions.push({
    id: "standard-production-rights",
    title: "Standard produksjonsavtale med bruksrettigheter",
    detail: "Legg inn leveranser, kanaler, rettigheter, revisjonsrunder, godkjenningsfrist, publiseringsansvar og betalingsplan før prosjektet går til opptak/produksjon.",
    priority: "standard",
  });

  return suggestions.slice(0, 6);
}

function buildSearchQueries(
  input: RoleRoomAgentProducerBootstrapInput,
  websiteInsights: RoleRoomAgentWebsiteInsights,
): string[] {
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl) || websiteInsights.finalUrl || null;
  const websiteHost = normalizeHost(websiteUrl);
  const hostLabel = websiteHost ? websiteHost.replace(/\.[a-z.]+$/i, "").replace(/[-_]/g, " ") : "";
  const companyName = hasText(input.companyName)
    ? normalizeWhitespace(input.companyName)
    : hasText(websiteInsights.siteName)
      ? normalizeWhitespace(websiteInsights.siteName)
      : hasText(websiteInsights.pageTitle)
        ? normalizeWhitespace(websiteInsights.pageTitle)
        : "";

  return Array.from(
    new Set(
      [
        companyName,
        companyName && hostLabel ? `${companyName} ${hostLabel}` : "",
        hostLabel,
      ]
        .map((entry) => normalizeWhitespace(entry))
        .filter((entry) => entry.length > 0),
    ),
  ).slice(0, 3);
}

function scoreGooglePlaceCandidate(
  candidate: Record<string, unknown>,
  companyName: string,
  websiteHost: string | null,
): number {
  const displayNameRecord =
    candidate.displayName && typeof candidate.displayName === "object" && !Array.isArray(candidate.displayName)
      ? (candidate.displayName as Record<string, unknown>)
      : {};
  const displayName = hasText(displayNameRecord.text) ? normalizeWhitespace(displayNameRecord.text).toLowerCase() : "";
  const normalizedCompany = normalizeWhitespace(companyName).toLowerCase();
  const websiteUri = hasText(candidate.websiteUri) ? candidate.websiteUri : null;
  const candidateHost = normalizeHost(websiteUri);
  let score = 0;

  if (websiteHost && candidateHost === websiteHost) {
    score += 120;
  }
  if (displayName && normalizedCompany && displayName === normalizedCompany) {
    score += 60;
  } else if (displayName && normalizedCompany && (displayName.includes(normalizedCompany) || normalizedCompany.includes(displayName))) {
    score += 35;
  }

  const rating = asNumber(candidate.rating);
  const userRatingCount = asNumber(candidate.userRatingCount);
  if (rating) {
    score += Math.round(rating * 2);
  }
  if (userRatingCount) {
    score += Math.min(Math.round(userRatingCount / 25), 20);
  }

  return score;
}

function readGooglePlaceTextRecord(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  return hasText(record.text) ? normalizeWhitespace(record.text) : null;
}

function readGooglePlaceDisplayName(candidate: Record<string, unknown>): string {
  return readGooglePlaceTextRecord(candidate.displayName) || "";
}

function readGooglePlacePrimaryTypeDisplayName(candidate: Record<string, unknown>): string | null {
  return readGooglePlaceTextRecord(candidate.primaryTypeDisplayName);
}

function extractMarketLocation(value: string | null | undefined): string {
  if (!hasText(value)) {
    return "";
  }
  const normalized = normalizeWhitespace(value);
  const postalCityMatch = normalized.match(/\b\d{4}\s+([A-ZÆØÅ][A-ZÆØÅa-zæøå .-]+)/);
  if (postalCityMatch?.[1]) {
    return normalizeWhitespace(postalCityMatch[1].split(",")[0] || "");
  }
  const parts = normalized
    .split(",")
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || "";
}

function isSameCompanyPlace(
  candidate: Record<string, unknown>,
  companyName: string,
  websiteHost: string | null,
): boolean {
  const displayName = readGooglePlaceDisplayName(candidate);
  const normalizedCandidateName = normalizeIdentity(displayName);
  const normalizedCompanyName = normalizeIdentity(companyName);
  const candidateHost = normalizeHost(hasText(candidate.websiteUri) ? candidate.websiteUri : null);

  if (websiteHost && candidateHost && websiteHost === candidateHost) {
    return true;
  }
  if (normalizedCandidateName && normalizedCompanyName && normalizedCandidateName === normalizedCompanyName) {
    return true;
  }
  return Boolean(
    normalizedCandidateName &&
      normalizedCompanyName &&
      normalizedCandidateName.length > 6 &&
      normalizedCompanyName.length > 6 &&
      (normalizedCandidateName.includes(normalizedCompanyName) || normalizedCompanyName.includes(normalizedCandidateName)),
  );
}

function buildCompetitorSearchQueries(
  input: RoleRoomAgentProducerBootstrapInput,
  websiteInsights: RoleRoomAgentWebsiteInsights,
  businessSignals: RoleRoomAgentBusinessSignals | null,
  brregCompany: RoleRoomAgentBrregCompany | null,
): string[] {
  const companyName = hasText(input.companyName)
    ? normalizeWhitespace(input.companyName)
    : brregCompany?.name || websiteInsights.siteName || "";
  const category = businessSignals?.primaryTypeDisplayName
    || brregCompany?.industryCode?.description
    || websiteInsights.siteName
    || "";
  const location = extractMarketLocation(businessSignals?.formattedAddress || brregCompany?.businessAddress || "");
  const municipality = brregCompany?.municipality || "";

  return Array.from(
    new Set(
      [
        category && location ? `${category} ${location}` : "",
        category && municipality && municipality !== location ? `${category} ${municipality}` : "",
        brregCompany?.industryCode?.description && location ? `${brregCompany.industryCode.description} ${location}` : "",
        companyName && location ? `${companyName} alternativer ${location}` : "",
        category,
      ]
        .map((entry) => normalizeWhitespace(entry))
        .filter((entry) => entry.length >= 3),
    ),
  ).slice(0, 4);
}

function scoreCompetitorCandidate(
  candidate: Record<string, unknown>,
  businessSignals: RoleRoomAgentBusinessSignals | null,
  marketLocation: string,
): RoleRoomAgentCompetitorEvidence[] {
  const evidence: RoleRoomAgentCompetitorEvidence[] = [
    {
      type: "google_places_result",
      label: "Funnet som offentlig Google Places-resultat",
      weight: 30,
    },
  ];
  const candidatePrimaryType = hasText(candidate.primaryType) ? normalizeWhitespace(candidate.primaryType) : "";
  const candidatePrimaryTypeLabel = readGooglePlacePrimaryTypeDisplayName(candidate) || "";
  const customerPrimaryType = businessSignals?.primaryType || "";
  const customerPrimaryTypeLabel = businessSignals?.primaryTypeDisplayName || "";
  const formattedAddress = hasText(candidate.formattedAddress) ? normalizeWhitespace(candidate.formattedAddress) : "";
  const rating = asNumber(candidate.rating);
  const userRatingCount = asNumber(candidate.userRatingCount);

  if (
    (candidatePrimaryType && customerPrimaryType && candidatePrimaryType === customerPrimaryType) ||
    (candidatePrimaryTypeLabel && customerPrimaryTypeLabel && normalizeIdentity(candidatePrimaryTypeLabel) === normalizeIdentity(customerPrimaryTypeLabel))
  ) {
    evidence.push({
      type: "same_category",
      label: "Matcher kundens Google-kategori",
      weight: 25,
    });
  }

  if (marketLocation && formattedAddress.toLowerCase().includes(marketLocation.toLowerCase())) {
    evidence.push({
      type: "location_overlap",
      label: `Samme geografiske marked: ${marketLocation}`,
      weight: 20,
    });
  }

  if (hasText(candidate.websiteUri)) {
    evidence.push({
      type: "website_available",
      label: "Har egen nettside for manuell posisjonering-/CTA-sjekk",
      weight: 10,
    });
  }

  if ((rating && rating >= 4) || (userRatingCount && userRatingCount >= 20)) {
    evidence.push({
      type: "review_signal",
      label: "Har Google-rating eller anmeldelsesvolum som markedsføringssignal",
      weight: 10,
    });
  }

  if (evidence.length <= 2) {
    evidence.push({
      type: "manual_review_needed",
      label: "Må bekreftes manuelt før den brukes som konkurrent i pitch",
      weight: 0,
    });
  }

  return evidence;
}

function buildCompetitorMarketingSignals(
  candidate: RoleRoomAgentCompetitorCandidate,
  customerBusinessSignals: RoleRoomAgentBusinessSignals | null,
): RoleRoomAgentCompetitorCandidate["marketingSignals"] {
  const contentAngles = [
    candidate.primaryTypeDisplayName ? `Sammenlign budskap mot kategori: ${candidate.primaryTypeDisplayName}` : "",
    candidate.websiteUrl ? "Sjekk landingsside, hero-budskap og CTA før kreativ retning låses" : "",
    candidate.rating && candidate.rating >= 4.4 ? "Kundebevis og tillit bør løftes tydelig i kundens innhold" : "",
  ].filter(Boolean);
  const ctaOpportunities = [
    candidate.websiteUrl ? "Finn om konkurrenten driver mot booking, kontakt, kjøp eller befaring" : "Avklar CTA manuelt siden nettside mangler i Google-resultatet",
    customerBusinessSignals?.rating && candidate.rating && candidate.rating > customerBusinessSignals.rating
      ? "Kunden bør ikke konkurrere kun på rating; bruk differensierende bevispunkter og spesifikke fordeler"
      : "",
  ].filter(Boolean);
  const riskNotes = [
    "Ikke bruk konkurrentnavn i kundemateriell uten eksplisitt godkjenning",
    candidate.status === "needs_review" ? "Kandidaten er ikke sikker nok til salgsargument før manuell sjekk" : "",
  ].filter(Boolean);

  return {
    positionHint:
      candidate.rating && candidate.userRatingCount
        ? `${candidate.name} har ${candidate.rating.toFixed(1)} stjerner basert på ${candidate.userRatingCount} anmeldelser.`
        : `${candidate.name} bør vurderes som synlig konkurrent i samme marked.`,
    contentAngles: contentAngles.length > 0 ? contentAngles : ["Sammenlign tone, tilbud og landingsside manuelt før konseptvalg"],
    ctaOpportunities,
    riskNotes,
  };
}

function buildLimitedCompetitorAnalysis(
  reason: string,
  input: RoleRoomAgentProducerBootstrapInput,
  brregCompany: RoleRoomAgentBrregCompany | null,
): RoleRoomAgentCompetitorAnalysis {
  const companyName = hasText(input.companyName) ? normalizeWhitespace(input.companyName) : brregCompany?.name || "kunden";
  return {
    status: "limited",
    source: "fallback",
    generatedAt: new Date().toISOString(),
    marketContext: `Konkurrentanalyse for ${companyName} krever verifiserbare markedskilder før den kan brukes kommersielt.`,
    competitors: [],
    verifiedCompetitorCount: 0,
    averageRating: null,
    averageReviewCount: null,
    marketingOpportunities: [
      "Be kunden oppgi 3-5 konkurrenter de selv sammenlignes med.",
      "Kjør Google/Maps-søk manuelt på kategori og lokasjon før pitch låses.",
      "Sammenlign hero-budskap, CTA, reviews, sosiale kanaler og caser før produksjonsvinkel velges.",
    ],
    positioningRecommendations: [
      "Ikke presenter navngitte konkurrenter før de er verifisert med kilde.",
      "Bruk kundens egne bevispunkter, reviews og konkrete fordeler som første differensiering.",
    ],
    contentGapSuggestions: [
      "Lag en enkel matrise: konkurrent, budskap, CTA, kanaler, bevispunkter og gap.",
      "Avklar hvilke produkter/tjenester kunden faktisk vil vinne på før innholdsformat velges.",
    ],
    producerQuestions: [
      "Hvilke konkurrenter nevner kunden oftest i salgsmøter?",
      "Hva taper kunden vanligvis på: pris, tillit, synlighet, hastighet eller kvalitet?",
      "Hvilke kanaler gir kunden best leads i dag?",
    ],
    limitations: [reason],
  };
}

function extractTextSnippet(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return normalizeWhitespace(decodeHtmlEntities(stripped)).slice(0, 1800);
}

function isLikelyHtmlPath(pathname: string): boolean {
  return !/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mov|zip|xml|json)$/i.test(pathname);
}

function scoreWebsiteLink(url: URL, label: string): number {
  const normalizedLabel = normalizeWhitespace(label).toLowerCase();
  const haystack = `${url.pathname} ${normalizedLabel}`.toLowerCase();
  let score = 0;

  if (url.pathname === "/" || url.pathname.length === 0) {
    score += 100;
  }
  if (/(om-oss|about|kontakt|contact)/.test(haystack)) {
    score += 40;
  }
  if (/(meny|menu|bestill|order|levering|takeaway)/.test(haystack)) {
    score += 55;
  }
  if (/(tjenester|services|produkt|products|shop)/.test(haystack)) {
    score += 35;
  }
  if (/(lokasjon|location|find-us|address)/.test(haystack)) {
    score += 25;
  }
  if (/(blogg|blog|nyhet|news|artikkel)/.test(haystack)) {
    score -= 12;
  }

  return score + Math.min(Math.round(normalizedLabel.length / 12), 8);
}

function inferSocialPlatformFromUrl(url: URL): RoleRoomAgentSocialPlatform | null {
  const host = url.hostname.replace(/^www\./i, "").replace(/^m\./i, "").toLowerCase();
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com") return "facebook";
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "youtube";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "x.com" || host === "twitter.com") return "x";
  if (host === "threads.net" || host.endsWith(".threads.net")) return "threads";
  if (host === "vimeo.com" || host.endsWith(".vimeo.com")) return "vimeo";
  if (host === "pinterest.com" || host === "pinterest.no" || host.endsWith(".pinterest.com")) return "pinterest";
  return null;
}

function extractSocialHandle(platform: RoleRoomAgentSocialPlatform, url: URL): string | null {
  const segments = url.pathname.split("/").map((entry) => entry.trim()).filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  if (platform === "instagram" || platform === "tiktok" || platform === "threads") {
    const first = segments[0].replace(/^@/, "");
    return /^(p|reel|reels|stories|explore|accounts|about|developer)$/i.test(first) ? null : first;
  }

  if (platform === "facebook") {
    if (segments[0] === "profile.php") {
      return url.searchParams.get("id");
    }
    return /^(share|sharer|events|groups|watch|reel|photo|pages|login|plugins)$/i.test(segments[0]) ? null : segments[0];
  }

  if (platform === "linkedin") {
    if (["company", "school", "showcase"].includes(segments[0]) && segments[1]) {
      return segments[1];
    }
    return segments[0] === "in" && segments[1] ? segments[1] : null;
  }

  if (platform === "youtube") {
    if (segments[0]?.startsWith("@")) return segments[0].replace(/^@/, "");
    if (["channel", "c", "user"].includes(segments[0]) && segments[1]) return segments[1];
    return null;
  }

  if (platform === "x") {
    return /^(intent|share|search|hashtag|i|home|explore)$/i.test(segments[0]) ? null : segments[0].replace(/^@/, "");
  }

  if (platform === "vimeo" || platform === "pinterest") {
    return /^(watch|pin|settings|login|oauth)$/i.test(segments[0]) ? null : segments[0];
  }

  return null;
}

function canonicalizeSocialUrl(rawUrl: string): {
  platform: RoleRoomAgentSocialPlatform;
  canonicalUrl: string;
  handle: string | null;
} | null {
  try {
    const url = new URL(rawUrl);
    const platform = inferSocialPlatformFromUrl(url);
    if (!platform) {
      return null;
    }
    const handle = extractSocialHandle(platform, url);
    if (!handle && platform !== "facebook") {
      return null;
    }
    url.protocol = "https:";
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "igshid"].forEach((param) => {
      url.searchParams.delete(param);
    });
    if (platform !== "facebook" || url.pathname !== "/profile.php") {
      url.search = "";
    }
    url.hostname = url.hostname.replace(/^www\./i, "").replace(/^m\./i, "").toLowerCase();
    const canonicalUrl = url.toString().replace(/\/$/, "");
    return { platform, canonicalUrl, handle };
  } catch {
    return null;
  }
}

function collectJsonLdSameAs(value: unknown, output: string[] = []): string[] {
  if (typeof value === "string") {
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectJsonLdSameAs(entry, output));
    return output;
  }
  if (!value || typeof value !== "object") {
    return output;
  }
  const record = value as Record<string, unknown>;
  const sameAs = record.sameAs;
  if (typeof sameAs === "string") {
    output.push(sameAs);
  } else if (Array.isArray(sameAs)) {
    sameAs.forEach((entry) => {
      if (hasText(entry)) {
        output.push(entry);
      }
    });
  }
  if (Array.isArray(record["@graph"])) {
    collectJsonLdSameAs(record["@graph"], output);
  }
  return output;
}

function addSocialCandidateEvidence(
  candidateMap: Map<string, RoleRoomAgentSocialProfileCandidate>,
  rawUrl: string,
  foundOnUrl: string,
  source: RoleRoomAgentSocialProfileCandidate["source"],
  evidence: RoleRoomAgentSocialProfileEvidence,
  label?: string | null,
) {
  const parsed = canonicalizeSocialUrl(rawUrl);
  if (!parsed) {
    return;
  }
  const existing = candidateMap.get(parsed.canonicalUrl);
  if (existing) {
    existing.foundOnUrls = Array.from(new Set([...existing.foundOnUrls, foundOnUrl]));
    if (!existing.evidence.some((entry) => entry.type === evidence.type && entry.label === evidence.label)) {
      existing.evidence.push(evidence);
    }
    existing.confidence = Math.min(100, existing.evidence.reduce((sum, entry) => sum + entry.weight, 0));
    return;
  }

  candidateMap.set(parsed.canonicalUrl, {
    platform: parsed.platform,
    url: parsed.canonicalUrl,
    canonicalUrl: parsed.canonicalUrl,
    handle: parsed.handle,
    displayName: hasText(label) ? normalizeWhitespace(label) : parsed.handle,
    confidence: Math.min(100, evidence.weight),
    status: "needs_review",
    evidence: [evidence],
    source,
    foundOnUrls: [foundOnUrl],
    requiresManualConfirmation: true,
  });
}

function collectSocialCandidatesFromHtml(
  html: string,
  pageUrl: string,
  pageLabel: string | null,
  candidateMap: Map<string, RoleRoomAgentSocialProfileCandidate>,
) {
  const $ = load(html);
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const label = normalizeWhitespace($(element).text() || "");
    const resolved = resolveUrl(pageUrl, href);
    if (!resolved) {
      return;
    }
    addSocialCandidateEvidence(
      candidateMap,
      resolved,
      pageUrl,
      "company_website",
      {
        type: "website_link",
        label: pageLabel ? `Lenket fra ${pageLabel}` : "Lenket fra kundens nettside",
        weight: 65,
      },
      label,
    );
  });

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    if (!hasText(raw)) {
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      collectJsonLdSameAs(parsed).forEach((sameAsUrl) => {
        addSocialCandidateEvidence(
          candidateMap,
          sameAsUrl,
          pageUrl,
          "schema_same_as",
          {
            type: "schema_same_as",
            label: "Oppført som sameAs i strukturert nettsidedata",
            weight: 70,
          },
        );
      });
    } catch {
      // Ignore invalid JSON-LD and continue with visible links.
    }
  });
}

function finalizeSocialProfileCandidates(
  candidateMap: Map<string, RoleRoomAgentSocialProfileCandidate>,
  input: RoleRoomAgentProducerBootstrapInput,
  websiteInsights: RoleRoomAgentWebsiteInsights,
  brregCompany?: RoleRoomAgentBrregCompany | null,
): RoleRoomAgentSocialProfileCandidate[] {
  const companyIdentities = [
    input.companyName,
    brregCompany?.name,
    websiteInsights.siteName,
    websiteInsights.pageTitle,
    normalizeHost(websiteInsights.finalUrl)?.split(".")[0],
  ]
    .filter((entry): entry is string => hasText(entry))
    .map((entry) => normalizeIdentity(entry))
    .filter(Boolean);

  return Array.from(candidateMap.values())
    .map((candidate) => {
      const evidence = [...candidate.evidence];
      const handleIdentity = normalizeIdentity(candidate.handle || candidate.displayName || "");
      if (handleIdentity && companyIdentities.some((identity) => identity && (handleIdentity.includes(identity) || identity.includes(handleIdentity)))) {
        evidence.push({
          type: "handle_match",
          label: "Handle/navn matcher kundenavn eller domenenavn",
          weight: 20,
        });
      }
      if (candidate.source === "schema_same_as") {
        evidence.push({
          type: "company_context",
          label: "Kontoen ligger i kundens strukturerte brand-data",
          weight: 10,
        });
      }
      if (evidence.length === 1) {
        evidence.push({
          type: "manual_review_needed",
          label: "Kun ett bevis funnet. Må bekreftes før bruk.",
          weight: 0,
        });
      }

      const confidence = Math.max(0, Math.min(100, evidence.reduce((sum, entry) => sum + entry.weight, 0)));
      const status: RoleRoomAgentSocialProfileCandidate["status"] =
        confidence >= 80
          ? "verified"
          : confidence >= 60
            ? "likely"
            : confidence >= 35
              ? "needs_review"
              : "rejected";

      return {
        ...candidate,
        evidence,
        confidence,
        status,
        requiresManualConfirmation: status !== "verified",
      };
    })
    .filter((candidate) => candidate.status !== "rejected")
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 12);
}

function buildWebsiteRerankQuery(input: RoleRoomAgentProducerBootstrapInput): string {
  const companyName = hasText(input.companyName) ? normalizeWhitespace(input.companyName) : "kunden";
  return normalizeWhitespace(
    [
      `Finn nettsider som best beskriver ${companyName}.`,
      "Prioriter informasjon som hjelper en innholdsprodusent med brief, story logikk, målgruppe, tilbud, meny/tjenester, lokasjon, brand, CTA og leveranser.",
      hasText(input.extraContext) ? `Ekstra kontekst: ${normalizeWhitespace(input.extraContext)}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function buildReviewRerankQuery(input: RoleRoomAgentProducerBootstrapInput): string {
  const companyName = hasText(input.companyName) ? normalizeWhitespace(input.companyName) : "kunden";
  return normalizeWhitespace(
    `Velg anmeldelsene som er mest nyttige som bevispunkter, produktstyrker, servicefordeler, stemning og CTA-grunnlag for brief og story logikk for ${companyName}.`,
  );
}

async function rerankWithCohere<T extends { snippet: string }>(
  query: string,
  entries: T[],
  topN: number,
  renderDocument: (entry: T) => string,
): Promise<RoleRoomAgentRerankResult<T>> {
  const client = getCohereClient();
  if (!client || entries.length === 0) {
    return {
      items: entries.slice(0, topN).map((entry) => ({ ...entry, relevanceScore: null })),
      used: false,
      model: DEFAULT_ROLE_ROOM_AGENT_COHERE_RERANK_MODEL,
    };
  }

  try {
    const response = await client.rerank({
      model: DEFAULT_ROLE_ROOM_AGENT_COHERE_RERANK_MODEL,
      query,
      topN: Math.min(topN, entries.length),
      documents: entries.map((entry) => renderDocument(entry).slice(0, 3500)),
    });

    const results = Array.isArray(response.results) ? response.results : [];
    const ranked = results
      .map((result) => {
        const entry = entries[result.index];
        if (!entry) {
          return null;
        }
        return {
          ...entry,
          relevanceScore:
            typeof result.relevanceScore === "number" && Number.isFinite(result.relevanceScore)
              ? Number(result.relevanceScore.toFixed(4))
              : null,
        };
      })
      .filter((entry): entry is T & { relevanceScore: number | null } => entry !== null);

    if (ranked.length > 0) {
      return {
        items: ranked,
        used: true,
        model: DEFAULT_ROLE_ROOM_AGENT_COHERE_RERANK_MODEL,
      };
    }
  } catch {
    // Fall through to heuristic order.
  }

  return {
    items: entries.slice(0, topN).map((entry) => ({ ...entry, relevanceScore: null })),
    used: false,
    model: DEFAULT_ROLE_ROOM_AGENT_COHERE_RERANK_MODEL,
  };
}

function extractProbableLogoUrl(html: string, websiteUrl: string): string | null {
  const linkMatch = html.match(
    /<link[^>]+rel=["'][^"']*(?:apple-touch-icon|icon|shortcut icon)[^"']*["'][^>]+href=["']([^"']+)["']/i,
  );
  if (linkMatch?.[1]) {
    return resolveUrl(websiteUrl, linkMatch[1]);
  }

  const imagePatterns = [
    /<img[^>]+src=["']([^"']+)["'][^>]+alt=["'][^"']*logo[^"']*["']/i,
    /<img[^>]+alt=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*logo[^"']*["']/i,
  ];

  for (const pattern of imagePatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return resolveUrl(websiteUrl, match[1]);
    }
  }

  return null;
}

function detectBusinessClassification(
  input: RoleRoomAgentProducerBootstrapInput,
  websiteInsights: RoleRoomAgentWebsiteInsights,
  businessSignals?: RoleRoomAgentBusinessSignals | null,
  brregCompany?: RoleRoomAgentBrregCompany | null,
): RoleRoomAgentBusinessClassification {
  const corpus = normalizeWhitespace(
    [
      input.companyName,
      brregCompany?.name,
      brregCompany?.organizationForm?.description,
      brregCompany?.industryCode?.description,
      brregCompany?.businessAddress,
      input.extraContext,
      websiteInsights.siteName,
      websiteInsights.pageTitle,
      websiteInsights.metaDescription,
      websiteInsights.textSnippet,
      businessSignals?.displayName,
      businessSignals?.formattedAddress,
      businessSignals?.primaryType,
      businessSignals?.primaryTypeDisplayName,
      businessSignals?.reviewSummary,
      ...(businessSignals?.topReviews ?? []).map((entry) => entry.text),
      ...(businessSignals?.serviceSignals ?? []),
    ]
      .filter(hasText)
      .join(" ")
      .toLowerCase(),
  );

  if (
    /pizza|restaurant|meny|takeaway|levering|henting|bestill|bestille|foodora|middag|deig|pepperoni|pasta|burger|kebab/.test(
      corpus,
    )
  ) {
    return {
      industry: "Restaurant og servering",
      subIndustry: "Pizza, takeaway og levering",
      businessModel: "B2C",
      contentCategory: "Meny, kampanje og konverteringsinnhold",
      productionApproach: "Produktdrevet restaurantkampanje",
      customerJourneyFocus: "Craving, vurdering og bestilling",
    };
  }

  if (/rekrutter|jobb|karriere|ansett|medarbeider|team|stilling/.test(corpus)) {
    return {
      industry: "Rekruttering og employer branding",
      subIndustry: "Talentattraksjon og kulturinnhold",
      businessModel: "B2B/B2C",
      contentCategory: "Employer branding og rekrutteringsinnhold",
      productionApproach: "Kultur- og tillitsdrevet merkevareinnhold",
      customerJourneyFocus: "Oppmerksomhet, tillit og søknad",
    };
  }

  if (/drill|drilling|industri|energy|offshore|maskin|anlegg|engineering|sikkerhet/.test(corpus)) {
    return {
      industry: "Industri og energi",
      subIndustry: "Operasjon, sikkerhet og leveranse",
      businessModel: "B2B",
      contentCategory: "Case, sikkerhet og bedriftsprofil",
      productionApproach: "Troverdig dokumentarisk bedriftsinnhold",
      customerJourneyFocus: "Tillit, differensiering og beslutning",
    };
  }

  if (/butikk|nettbutikk|shop|produkt|handlekurv|kolleksjon|salg/.test(corpus)) {
    return {
      industry: "Handel og retail",
      subIndustry: "Produkt- og kampanjesalg",
      businessModel: "B2C",
      contentCategory: "Produkt, kampanje og konverteringsinnhold",
      productionApproach: "Produktfokusert salgsinnhold",
      customerJourneyFocus: "Oppmerksomhet, vurdering og kjøp",
    };
  }

  return {
    industry: "Bedrift og tjenester",
    subIndustry: "Merkevare og kundekommunikasjon",
    businessModel: "B2B",
    contentCategory: "Brief, bedriftsprofil og salgsstøtte",
    productionApproach: "Klar og troverdig merkevarefortelling",
    customerJourneyFocus: "Forståelse, tillit og beslutning",
  };
}

function deriveAudienceFromClassification(
  classification: RoleRoomAgentBusinessClassification,
): string[] {
  if (classification.businessModel === "B2C") {
    return ["Primære kunder", "Lokale gjester", "Digitale bestillere"];
  }

  if (classification.industry === "Rekruttering og employer branding") {
    return ["Jobbsøkere", "Potensielle ansatte", "Interne ambassadører"];
  }

  return ["Beslutningstakere", "Innkjøpere", "Interne ambassadører"];
}

function deriveToneFromClassification(
  classification: RoleRoomAgentBusinessClassification,
): string[] {
  if (classification.industry === "Restaurant og servering") {
    return ["Appetittvekkende", "Rask", "Fersk", "Innbydende"];
  }

  if (classification.businessModel === "B2C") {
    return ["Tydelig", "Energisk", "Nær", "Konverterende"];
  }

  return ["Tydelig", "Trygg", "Profesjonell"];
}

async function fetchWebsiteInsights(
  websiteUrl: string | null,
  input: RoleRoomAgentProducerBootstrapInput,
  brregCompany: RoleRoomAgentBrregCompany | null = null,
): Promise<RoleRoomAgentWebsiteInsights> {
  if (!websiteUrl) {
    return { selectedPageSnippets: [], socialProfileCandidates: [] };
  }

  try {
    const response = await fetch(websiteUrl, {
      headers: {
        "User-Agent": "CreatorHub Role Room Agent/1.0 (+https://theroleroom.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return { finalUrl: websiteUrl, selectedPageSnippets: [], socialProfileCandidates: [] };
    }

    const html = await response.text();
    const finalUrl = response.url || websiteUrl;
    const parsedBase = new URL(finalUrl);
    const $ = load(html);
    const socialCandidateMap = new Map<string, RoleRoomAgentSocialProfileCandidate>();
    collectSocialCandidatesFromHtml(html, finalUrl, "Forside", socialCandidateMap);
    const discoveredLinks = Array.from(
      new Map(
        $("a[href]")
          .toArray()
          .map((element) => {
            const href = $(element).attr("href");
            const label = normalizeWhitespace($(element).text() || "");
            if (!hasText(href)) {
              return null;
            }
            const resolved = resolveUrl(finalUrl, href);
            if (!resolved) {
              return null;
            }
            try {
              const url = new URL(resolved);
              if (url.hostname !== parsedBase.hostname) {
                return null;
              }
              if (!isLikelyHtmlPath(url.pathname)) {
                return null;
              }
              url.hash = "";
              const normalized = url.toString();
              return [
                normalized,
                {
                  url: normalized,
                  sourceLabel: label || null,
                  priority: scoreWebsiteLink(url, label),
                },
              ] as const;
            } catch {
              return null;
            }
          })
          .filter((entry): entry is readonly [string, { url: string; sourceLabel: string | null; priority: number }] => entry !== null),
      ).values(),
    )
      .sort((left, right) => right.priority - left.priority)
      .slice(0, 6);

    const pageCandidates: RoleRoomAgentWebsitePageSnippet[] = [
      {
        url: finalUrl,
        title: extractTitle(html),
        snippet: extractTextSnippet(html),
        sourceLabel: "Forside",
        relevanceScore: null,
      },
    ];

    for (const link of discoveredLinks) {
      if (link.url === finalUrl) {
        continue;
      }
      try {
        const pageResponse = await fetch(link.url, {
          headers: {
            "User-Agent": "CreatorHub Role Room Agent/1.0 (+https://theroleroom.com)",
            Accept: "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(10_000),
        });
        if (!pageResponse.ok) {
          continue;
        }
        const pageHtml = await pageResponse.text();
        const resolvedPageUrl = pageResponse.url || link.url;
        collectSocialCandidatesFromHtml(pageHtml, resolvedPageUrl, link.sourceLabel || extractTitle(pageHtml), socialCandidateMap);
        const snippet = extractTextSnippet(pageHtml);
        if (!snippet) {
          continue;
        }
        pageCandidates.push({
          url: resolvedPageUrl,
          title: extractTitle(pageHtml),
          snippet,
          sourceLabel: link.sourceLabel,
          relevanceScore: null,
        });
      } catch {
        continue;
      }
    }

    const rerankedPages = await rerankWithCohere(
      buildWebsiteRerankQuery(input),
      pageCandidates,
      4,
      (entry) =>
        normalizeWhitespace(
          [
            entry.title || "",
            entry.sourceLabel || "",
            entry.url,
            entry.snippet,
          ]
            .filter(Boolean)
            .join(" \n "),
        ),
    );
    const selectedPageSnippets = rerankedPages.items;
    const mergedSnippet = normalizeWhitespace(
      selectedPageSnippets.map((entry) => entry.snippet).join(" "),
    ).slice(0, 3600);

    return {
      finalUrl,
      pageTitle: extractTitle(html),
      siteName: extractMetaContent(html, "og:site_name"),
      metaDescription: extractMetaContent(html, "description") || extractMetaContent(html, "og:description"),
      textSnippet: mergedSnippet || extractTextSnippet(html),
      probableLogoUrl: extractProbableLogoUrl(html, finalUrl),
      socialProfileCandidates: finalizeSocialProfileCandidates(
        socialCandidateMap,
        input,
        {
          finalUrl,
          pageTitle: extractTitle(html),
          siteName: extractMetaContent(html, "og:site_name"),
          selectedPageSnippets,
        },
        brregCompany,
      ),
      selectedPageSnippets,
    };
  } catch {
    return { finalUrl: websiteUrl, selectedPageSnippets: [], socialProfileCandidates: [] };
  }
}

async function fetchGooglePlacesBusinessSignals(
  input: RoleRoomAgentProducerBootstrapInput,
  websiteInsights: RoleRoomAgentWebsiteInsights,
): Promise<RoleRoomAgentBusinessSignals | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const companyName = hasText(input.companyName)
    ? normalizeWhitespace(input.companyName)
    : hasText(websiteInsights.siteName)
      ? normalizeWhitespace(websiteInsights.siteName)
      : "";

  if (!hasText(apiKey) || !companyName) {
    return null;
  }

  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl) || websiteInsights.finalUrl || null;
  const websiteHost = normalizeHost(websiteUrl);
  const searchQueries = buildSearchQueries(input, websiteInsights);
  const fieldMask =
    "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.rating,places.userRatingCount,places.primaryType,places.primaryTypeDisplayName,places.googleMapsUri";

  const candidates: Array<Record<string, unknown>> = [];

  for (const query of searchQueries) {
    try {
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify({
          textQuery: query,
          pageSize: 5,
          languageCode: "nb",
          regionCode: "NO",
        }),
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json().catch(() => null)) as
        | { places?: Array<Record<string, unknown>> }
        | null;
      const places = Array.isArray(payload?.places) ? payload.places : [];
      candidates.push(...places);
      if (places.length > 0) {
        break;
      }
    } catch {
      continue;
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const bestCandidate = [...candidates]
    .sort((left, right) => {
      return (
        scoreGooglePlaceCandidate(right, companyName, websiteHost) -
        scoreGooglePlaceCandidate(left, companyName, websiteHost)
      );
    })[0];

  const placeId = hasText(bestCandidate.id) ? normalizeWhitespace(bestCandidate.id) : null;
  const detailsFieldMask = [
    "id",
    "displayName",
    "formattedAddress",
    "googleMapsUri",
    "websiteUri",
    "primaryType",
    "primaryTypeDisplayName",
    "rating",
    "userRatingCount",
    "reviewSummary",
    "reviews",
    "delivery",
    "takeout",
    "dineIn",
    "servesLunch",
    "servesDinner",
  ].join(",");

  let placeRecord = bestCandidate;
  if (placeId) {
    try {
      const detailsResponse = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": detailsFieldMask,
          "Accept-Language": "nb-NO,nb;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(12_000),
      });

      if (detailsResponse.ok) {
        const detailsPayload = (await detailsResponse.json().catch(() => null)) as Record<string, unknown> | null;
        if (detailsPayload && typeof detailsPayload === "object" && !Array.isArray(detailsPayload)) {
          placeRecord = { ...bestCandidate, ...detailsPayload };
        }
      }
    } catch {
      // Ignore and fall back to search response fields.
    }
  }

  const reviewSummaryRecord =
    placeRecord.reviewSummary &&
    typeof placeRecord.reviewSummary === "object" &&
    !Array.isArray(placeRecord.reviewSummary)
      ? (placeRecord.reviewSummary as Record<string, unknown>)
      : {};
  const reviewSummaryTextRecord =
    reviewSummaryRecord.text &&
    typeof reviewSummaryRecord.text === "object" &&
    !Array.isArray(reviewSummaryRecord.text)
      ? (reviewSummaryRecord.text as Record<string, unknown>)
      : {};
  const reviews = Array.isArray(placeRecord.reviews) ? placeRecord.reviews : [];

  const reviewCandidates: RoleRoomAgentReviewQuote[] = reviews
    .map((review): RoleRoomAgentReviewQuote | null => {
      if (!review || typeof review !== "object" || Array.isArray(review)) {
        return null;
      }
      const reviewRecord = review as Record<string, unknown>;
      const textRecord =
        reviewRecord.text && typeof reviewRecord.text === "object" && !Array.isArray(reviewRecord.text)
          ? (reviewRecord.text as Record<string, unknown>)
          : {};
      const authorRecord =
        reviewRecord.authorAttribution &&
        typeof reviewRecord.authorAttribution === "object" &&
        !Array.isArray(reviewRecord.authorAttribution)
          ? (reviewRecord.authorAttribution as Record<string, unknown>)
          : {};
      const text = hasText(textRecord.text) ? normalizeWhitespace(textRecord.text) : "";
      if (!text) {
        return null;
      }
      return {
        author: hasText(authorRecord.displayName) ? normalizeWhitespace(authorRecord.displayName) : undefined,
        rating: asNumber(reviewRecord.rating),
        text,
        relativeTime: hasText(reviewRecord.relativePublishTimeDescription)
          ? normalizeWhitespace(reviewRecord.relativePublishTimeDescription)
          : undefined,
        googleMapsUri: hasText(reviewRecord.googleMapsUri) ? normalizeWhitespace(reviewRecord.googleMapsUri) : null,
      };
    })
    .filter((entry): entry is RoleRoomAgentReviewQuote => entry !== null);

  const rerankedReviews = await rerankWithCohere(
    buildReviewRerankQuery(input),
    reviewCandidates.map((entry) => ({
      ...entry,
      snippet: entry.text,
    })),
    3,
    (entry) => normalizeWhitespace([entry.author || "", entry.text, entry.relativeTime || ""].join(" ")),
  );
  const topReviews: RoleRoomAgentReviewQuote[] = rerankedReviews.items.map(({ snippet: _snippet, ...entry }) => entry);

  const serviceSignals = [
    placeRecord.delivery === true ? "Tilbyr levering" : null,
    placeRecord.takeout === true ? "Tilbyr takeaway" : null,
    placeRecord.dineIn === true ? "Tilbyr servering på stedet" : null,
    placeRecord.servesLunch === true ? "Serverer lunsj" : null,
    placeRecord.servesDinner === true ? "Serverer middag" : null,
  ].filter((entry): entry is string => Boolean(entry));

  const displayNameRecord =
    placeRecord.displayName &&
    typeof placeRecord.displayName === "object" &&
    !Array.isArray(placeRecord.displayName)
      ? (placeRecord.displayName as Record<string, unknown>)
      : {};
  const primaryTypeDisplayRecord =
    placeRecord.primaryTypeDisplayName &&
    typeof placeRecord.primaryTypeDisplayName === "object" &&
    !Array.isArray(placeRecord.primaryTypeDisplayName)
      ? (placeRecord.primaryTypeDisplayName as Record<string, unknown>)
      : {};

  return {
    source: "google_places",
    displayName: hasText(displayNameRecord.text) ? normalizeWhitespace(displayNameRecord.text) : companyName,
    formattedAddress: hasText(placeRecord.formattedAddress) ? normalizeWhitespace(placeRecord.formattedAddress) : null,
    googleMapsUri: hasText(placeRecord.googleMapsUri) ? normalizeWhitespace(placeRecord.googleMapsUri) : null,
    websiteUri: hasText(placeRecord.websiteUri) ? normalizeWhitespace(placeRecord.websiteUri) : websiteUrl,
    primaryType: hasText(placeRecord.primaryType) ? normalizeWhitespace(placeRecord.primaryType) : null,
    primaryTypeDisplayName: hasText(primaryTypeDisplayRecord.text)
      ? normalizeWhitespace(primaryTypeDisplayRecord.text)
      : null,
    rating: asNumber(placeRecord.rating),
    userRatingCount: asNumber(placeRecord.userRatingCount),
    reviewSummary: hasText(reviewSummaryTextRecord.text) ? normalizeWhitespace(reviewSummaryTextRecord.text) : null,
    topReviews,
    serviceSignals,
  };
}

async function fetchGooglePlacesCompetitorAnalysis(
  input: RoleRoomAgentProducerBootstrapInput,
  websiteInsights: RoleRoomAgentWebsiteInsights,
  businessSignals: RoleRoomAgentBusinessSignals | null,
  brregCompany: RoleRoomAgentBrregCompany | null,
): Promise<RoleRoomAgentCompetitorAnalysis> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const companyName = hasText(input.companyName)
    ? normalizeWhitespace(input.companyName)
    : brregCompany?.name || websiteInsights.siteName || websiteInsights.pageTitle || "";
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl) || websiteInsights.finalUrl || brregCompany?.website || null;
  const websiteHost = normalizeHost(websiteUrl);
  const marketLocation = extractMarketLocation(businessSignals?.formattedAddress || brregCompany?.businessAddress || "");
  const searchQueries = buildCompetitorSearchQueries(input, websiteInsights, businessSignals, brregCompany);

  if (!hasText(apiKey)) {
    return buildLimitedCompetitorAnalysis("Google Places API er ikke konfigurert, så konkurrenter kan ikke verifiseres automatisk.", input, brregCompany);
  }
  if (!companyName || searchQueries.length === 0) {
    return buildLimitedCompetitorAnalysis("Mangler nok firmanavn, kategori eller lokasjon til å finne relevante konkurrenter.", input, brregCompany);
  }

  const fieldMask =
    "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.rating,places.userRatingCount,places.primaryType,places.primaryTypeDisplayName,places.googleMapsUri";
  const rawCandidates: Array<Record<string, unknown>> = [];

  for (const query of searchQueries) {
    try {
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify({
          textQuery: query,
          pageSize: 10,
          languageCode: "nb",
          regionCode: "NO",
        }),
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json().catch(() => null)) as
        | { places?: Array<Record<string, unknown>> }
        | null;
      const places = Array.isArray(payload?.places) ? payload.places : [];
      rawCandidates.push(...places);
    } catch {
      continue;
    }
  }

  const seenKeys = new Set<string>();
  const competitors = rawCandidates
    .map((candidate): RoleRoomAgentCompetitorCandidate | null => {
      const name = readGooglePlaceDisplayName(candidate);
      if (!name || isSameCompanyPlace(candidate, companyName, websiteHost)) {
        return null;
      }
      const websiteUri = hasText(candidate.websiteUri) ? normalizeWebsiteUrl(candidate.websiteUri) : null;
      const candidateHost = normalizeHost(websiteUri);
      const key = hasText(candidate.id)
        ? normalizeWhitespace(candidate.id)
        : candidateHost || `${normalizeIdentity(name)}:${normalizeIdentity(hasText(candidate.formattedAddress) ? candidate.formattedAddress : "")}`;
      if (!key || seenKeys.has(key)) {
        return null;
      }
      seenKeys.add(key);

      const evidence = scoreCompetitorCandidate(candidate, businessSignals, marketLocation);
      const confidence = Math.min(100, evidence.reduce((total, entry) => total + entry.weight, 0));
      const status: RoleRoomAgentCompetitorCandidate["status"] =
        confidence >= 80 ? "verified" : confidence >= 55 ? "likely" : confidence >= 35 ? "needs_review" : "rejected";
      const primaryTypeDisplayName = readGooglePlacePrimaryTypeDisplayName(candidate);
      const competitor: RoleRoomAgentCompetitorCandidate = {
        source: "google_places",
        placeId: hasText(candidate.id) ? normalizeWhitespace(candidate.id) : null,
        name,
        websiteUrl: websiteUri,
        googleMapsUri: hasText(candidate.googleMapsUri) ? normalizeWhitespace(candidate.googleMapsUri) : null,
        formattedAddress: hasText(candidate.formattedAddress) ? normalizeWhitespace(candidate.formattedAddress) : null,
        primaryType: hasText(candidate.primaryType) ? normalizeWhitespace(candidate.primaryType) : null,
        primaryTypeDisplayName,
        rating: asNumber(candidate.rating),
        userRatingCount: asNumber(candidate.userRatingCount),
        confidence,
        status,
        evidence,
        relevanceReason: normalizeWhitespace(
          [
            primaryTypeDisplayName ? `Samme eller nærliggende kategori: ${primaryTypeDisplayName}.` : "",
            marketLocation ? `Søkt i markedet ${marketLocation}.` : "",
            "Må bekreftes av produsent/kunde før den brukes i pitch eller strategi.",
          ].filter(Boolean).join(" "),
        ),
        marketingSignals: {
          positionHint: "",
          contentAngles: [],
          ctaOpportunities: [],
          riskNotes: [],
        },
        requiresManualConfirmation: true,
      };
      return {
        ...competitor,
        marketingSignals: buildCompetitorMarketingSignals(competitor, businessSignals),
      };
    })
    .filter((entry): entry is RoleRoomAgentCompetitorCandidate => entry !== null)
    .filter((entry) => entry.status !== "rejected")
    .sort((left, right) => right.confidence - left.confidence || (right.userRatingCount || 0) - (left.userRatingCount || 0))
    .slice(0, 8);

  if (competitors.length === 0) {
    return buildLimitedCompetitorAnalysis("Google Places ga ingen trygge konkurrentkandidater etter at kunden selv ble ekskludert.", input, brregCompany);
  }

  const usableCompetitors = competitors.filter((entry) => entry.status === "verified" || entry.status === "likely");
  const ratingValues = usableCompetitors
    .map((entry) => entry.rating)
    .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
  const reviewValues = usableCompetitors
    .map((entry) => entry.userRatingCount)
    .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
  const averageRating = ratingValues.length > 0
    ? Number((ratingValues.reduce((total, entry) => total + entry, 0) / ratingValues.length).toFixed(2))
    : null;
  const averageReviewCount = reviewValues.length > 0
    ? Math.round(reviewValues.reduce((total, entry) => total + entry, 0) / reviewValues.length)
    : null;
  const customerRating = businessSignals?.rating || null;
  const hasCustomerWebsite = Boolean(websiteUrl);
  const hasCustomerSocials = (websiteInsights.socialProfileCandidates ?? []).some((entry) => entry.status === "verified" || entry.status === "likely");

  return {
    status: usableCompetitors.length > 0 ? "ready" : "limited",
    source: "google_places",
    generatedAt: new Date().toISOString(),
    marketContext: normalizeWhitespace(
      [
        marketLocation ? `Marked: ${marketLocation}.` : "Marked: lokasjon må bekreftes.",
        businessSignals?.primaryTypeDisplayName ? `Kategori: ${businessSignals.primaryTypeDisplayName}.` : "",
        `${usableCompetitors.length} konkurrentkandidater er klare for manuell vurdering.`,
      ].filter(Boolean).join(" "),
    ),
    competitors,
    verifiedCompetitorCount: usableCompetitors.length,
    averageRating,
    averageReviewCount,
    marketingOpportunities: normalizeStringArray([
      averageRating && customerRating && averageRating > customerRating + 0.2
        ? "Konkurrentene har høyere Google-rating. Løft kundebevis, reviews og konkrete trygghetssignaler tydeligere i innholdet."
        : "",
      averageReviewCount && averageReviewCount > 30
        ? "Markedet har synlig anmeldelsesvolum. Bruk ekte kundesitater og caser som bevis, ikke bare generisk brandfilm."
        : "",
      !hasCustomerSocials
        ? "Kundens offisielle sosiale kanaler ble ikke sikkert funnet. Avklar kanaleierskap før distribusjonsplan og publisering."
        : "",
      hasCustomerWebsite
        ? "Sammenlign kundens hero-budskap og CTA mot konkurrentenes nettsider før pitch låses."
        : "Kunden mangler verifisert nettside i analysen. Prioriter landingsside/CTA før annonsering.",
    ], [
      "Bruk konkurrentmatrisen til å finne én tydelig differensierende vinkel før manus/storyboard.",
    ]),
    positioningRecommendations: normalizeStringArray([
      `Posisjoner ${companyName} rundt konkrete bevispunkter, ikke bare bransjeord konkurrentene også bruker.`,
      "Velg én hovedfordel kunden kan eie visuelt: hastighet, kvalitet, lokal nærhet, prosess, folk eller resultat.",
      "Lag en kanalplan der nettside og Google-profil fungerer som konverteringsflate, og SoMe brukes til oppmerksomhet og repetisjon.",
    ]),
    contentGapSuggestions: normalizeStringArray([
      "Lag korte sammenlignbare CTA-varianter: kontakt, booking, befaring, bestilling eller demo.",
      "Finn hvilke konkurrenter som bruker kundecaser, før/etter, reviews eller team/prosess, og bygg kundens gap rundt det de mangler.",
      "Bruk 3-5 konkrete proof points fra kunde, reviews eller leveranser som kan filmes.",
    ]),
    producerQuestions: [
      "Hvilke av disse konkurrentene opplever kunden faktisk som relevante?",
      "Hva taper eller vinner kunden vanligvis på mot disse aktørene?",
      "Hvilket tilbud skal kunden helst selge mer av de neste 90 dagene?",
      "Hvilken kanal skal måles først: Google, nettside, LinkedIn, Instagram, Meta eller direkte salg?",
    ],
    limitations: [
      "Konkurrentene er kandidater fra Google Places og må bekreftes manuelt.",
      "Analysen bruker ikke betalte annonsebibliotek eller private salgsdata.",
      "Nettsider og sosiale kanaler for konkurrenter bør åpnes manuelt før endelig strategi.",
    ],
  };
}

function buildFallbackBootstrap(
  input: RoleRoomAgentProducerBootstrapInput,
  websiteInsights: RoleRoomAgentWebsiteInsights,
  businessSignals: RoleRoomAgentBusinessSignals | null,
  brregCompany: RoleRoomAgentBrregCompany | null,
  companyAge: RoleRoomAgentCompanyAge | null,
  agreementSuggestions: RoleRoomAgentAgreementSuggestion[],
  competitorAnalysis: RoleRoomAgentCompetitorAnalysis,
): RoleRoomAgentNormalizedPayload {
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl)
    || websiteInsights.finalUrl
    || brregCompany?.website
    || null;
  const companyName = hasText(input.companyName)
    ? normalizeWhitespace(input.companyName)
    : brregCompany?.name || websiteInsights.siteName || websiteInsights.pageTitle || "Kunden";
  const classification = detectBusinessClassification(input, websiteInsights, businessSignals, brregCompany);
  const socialProfileCandidates = websiteInsights.socialProfileCandidates ?? [];
  const verifiedSocialProfiles = socialProfileCandidates.filter((candidate) => candidate.status === "verified" || candidate.status === "likely");
  const summary = toSentenceCase(
    websiteInsights.metaDescription ||
      (
        brregCompany?.lookupStatus === "verified" && brregCompany.industryCode?.description
          ? `${companyName} er registrert i Enhetsregisteret som ${brregCompany.organizationForm?.description || "norsk virksomhet"} innen ${brregCompany.industryCode.description}.`
          : ""
      ) ||
      input.extraContext ||
      `${companyName} trenger en tydelig produksjonsplan med brief, budskap og leveranser.`,
  );
  const audience = deriveAudienceFromClassification(classification);
  const toneAndBrandSignals = deriveToneFromClassification(classification);
  const proofPoints = normalizeStringArray(
    [
      ...summary
        .split(/[.!?]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 3),
      businessSignals?.reviewSummary || "",
      ...(businessSignals?.serviceSignals ?? []),
    ],
  );

  return {
    generatedAt: new Date().toISOString(),
    provider: "fallback",
    model: "fallback-rule-engine",
    businessSignals,
    retrievalMeta: {
      cohereRerankUsed:
        hasText(process.env.COHERE_API_KEY) &&
        (websiteInsights.selectedPageSnippets.some((entry) => typeof entry.relevanceScore === "number") ||
          businessSignals?.topReviews.some((entry) => entry.rating !== null) === true),
      rerankerModel: hasText(process.env.COHERE_API_KEY)
        ? DEFAULT_ROLE_ROOM_AGENT_COHERE_RERANK_MODEL
        : undefined,
      websitePagesReviewed: websiteInsights.selectedPageSnippets.length,
      websitePagesSelected: websiteInsights.selectedPageSnippets.length,
      reviewsReviewed: businessSignals?.topReviews.length || 0,
      reviewsSelected: businessSignals?.topReviews.length || 0,
      competitorsReviewed: competitorAnalysis.competitors.length,
      competitorsSelected: competitorAnalysis.verifiedCompetitorCount,
      brregLookupStatus: brregCompany?.lookupStatus,
      brregMatchedBy: brregCompany?.matchedBy,
    },
    brregCompany,
    companyAge,
    agreementSuggestions,
    socialProfileCandidates,
    competitorAnalysis,
    companyProfile: {
      companyName,
      websiteUrl,
      organizationNumber: brregCompany?.organizationNumber || normalizeOrganizationNumber(input.organizationNumber),
      summary,
      offerings: normalizeStringArray([
        brregCompany?.industryCode?.description || "",
        ...proofPoints,
      ], proofPoints.length > 0 ? proofPoints : ["Tjenester og leveranser må verifiseres manuelt"]),
      targetAudience: audience,
      toneAndBrandSignals,
      industry: brregCompany?.industryCode?.description || classification.industry,
      subIndustry: classification.subIndustry,
      businessModel: classification.businessModel,
      contentCategory: classification.contentCategory,
      productionApproach: classification.productionApproach,
      probableLocationAddress: businessSignals?.formattedAddress || brregCompany?.businessAddress || null,
      logoUrl: websiteInsights.probableLogoUrl || null,
    },
    intakeDraft: {
      projectGoal: `Skape en tydelig produksjonspakke for ${companyName} med mål om bedre kommunikasjon og leveranseflyt.`,
      deliverables: "Hovedfilm, korte utdrag til sosiale medier og godkjenningsvennlig leveransepakke.",
      targetAudience: audience.join(", "),
      keyMessage: summary,
      timingConstraints: "Må avklares med kunden i neste steg.",
      brandNotes: `Visuell retning og tone bør ta utgangspunkt i nettsiden til ${companyName}.`,
      materialOverview: "Samle eksisterende logo, brandfiler, referanser og kundeinnspill før opptak.",
      referenceLinks: websiteUrl || "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      additionalNotes: normalizeWhitespace(
        [
          hasText(input.extraContext) ? input.extraContext : "",
          brregCompany?.lookupStatus === "verified"
            ? `Brreg: ${brregCompany.name || companyName}, org.nr ${brregCompany.organizationNumber || "ukjent"}, ${brregCompany.organizationForm?.description || "organisasjonsform ukjent"}. ${companyAge?.label || ""}`
            : "",
        ].filter(Boolean).join(" "),
      ),
    },
    planningDraft: {
      activationPlan: {
        direction: `Bygg en troverdig og konkret fortelling for ${companyName}.`,
        idea: `Vis hvordan ${companyName} skaper verdi i praksis med ekte situasjoner og tydelige bevispunkter.`,
        activation: "Bruk filmen på nettside, i salgsdialog og i relevante sosiale flater.",
        targetAudience: audience.join(", "),
        businessGoal: `Gjøre det enklere å forstå hva ${companyName} tilbyr og hvorfor de er relevante.`,
        coreMessage: summary,
        successSignals: [
          "Tydelig kundebudskap godkjent av klient",
          "Leveranseplan og godkjenningsflyt bekreftet",
          "Materialgrunnlag klart for manus og storyboard",
        ],
      },
      contentLogic: {
        objective: `Skape et klart beslutningsgrunnlag for innholdsproduksjon for ${companyName}.`,
        audience: audience.join(", "),
        hook: `Hvorfor skal målgruppen bry seg om ${companyName} akkurat nå?`,
        coreMessage: summary,
        industry: brregCompany?.industryCode?.description || classification.industry,
        subIndustry: classification.subIndustry,
        businessModel: classification.businessModel,
        contentCategory: classification.contentCategory,
        productionApproach: classification.productionApproach,
        proofPoints,
        callToAction:
          classification.businessModel === "B2C"
            ? "Gjør det lett å gå fra fristelse til bestilling."
            : "Ta kontakt eller gå videre til neste beslutning med tydelig tillit.",
        distributionPlan:
          classification.businessModel === "B2C"
            ? "Primært nettside, Meta og korte SoMe-utdrag med tydelig CTA."
            : "Primært nettside og salgsstøtte, sekundært SoMe-utdrag.",
        successSignals: ["Kunden kjenner seg igjen i budskapet", "Godkjenning uten større omarbeid"],
        agreementSignals: agreementSuggestions.map((entry) => entry.title),
        socialProfileSignals: verifiedSocialProfiles.map((candidate) => `${candidate.platform}: ${candidate.url}`),
        competitorSignals: competitorAnalysis.competitors
          .filter((candidate) => candidate.status === "verified" || candidate.status === "likely")
          .slice(0, 5)
          .map((candidate) => `${candidate.name}: ${candidate.relevanceReason}`),
        marketingOpportunities: competitorAnalysis.marketingOpportunities,
      },
      brandGuide: {
        logoUrl: websiteInsights.probableLogoUrl || null,
        toneOfVoice:
          classification.businessModel === "B2C"
            ? "Tydelig, appetittvekkende og handlingsdrivende."
            : "Profesjonell, tydelig og tillitvekkende.",
        visualStyle:
          classification.industry === "Restaurant og servering"
            ? "Nærgående matfoto, varme detaljer og tydelige produktøyeblikk."
            : "Dokumentarisk, troverdig og brandnær.",
        fonts: [],
        dos: ["Bruk ekte arbeidsøyeblikk", "Vis tydelige bevispunkter", "Hold språket konkret"],
        donts: ["Unngå generiske buzzord", "Ikke overselg uten bevis", "Unngå uklar CTA"],
        colors: [],
      },
    },
    storyLogicDraft: {
      concept: {
        corePremise:
          classification.industry === "Restaurant og servering"
            ? `${companyName} presenteres gjennom fristende produktsituasjoner som gjør det enkelt å få lyst til å bestille med en gang.`
            : `${companyName} presenteres gjennom konkrete situasjoner som viser verdi, kompetanse og retning.`,
        genre: classification.businessModel === "B2C" ? "Kampanjefilm" : "Merkevarefilm",
        subGenre: classification.contentCategory,
        tone: toneAndBrandSignals,
        targetAudience: audience.join(", "),
        audienceAge: "25-55",
        whyNow:
          classification.businessModel === "B2C"
            ? "Kunden trenger innhold som raskt konverterer oppmerksomhet til bestilling."
            : "Kunden trenger et tydeligere grunnlag for kommunikasjon og godkjenning.",
        uniqueAngle:
          classification.industry === "Restaurant og servering"
            ? `Koble sult, produktnærhet og enkel bestilling direkte til ${companyName}-opplevelsen.`
            : `Koble ${companyName} sitt tilbud direkte til ekte arbeidshverdager og tydelige resultater.`,
        marketComparables:
          classification.industry === "Restaurant og servering"
            ? "Produktfilm, menykampanje eller kortformat for restaurant og takeaway."
            : "Employer branding, casefilm eller kundehistorie med konkret nytte.",
      },
      logline: {
        protagonist: companyName,
        protagonistTrait: "kompetent og løsningsorientert",
        goal: "vise hvorfor selskapet er relevant og verdifullt for målgruppen",
        antagonisticForce: "uklart budskap og manglende differensiering",
        stakes: "målgruppen forstår ikke hvorfor de skal velge eller stole på selskapet",
        fullLogline: `${companyName} må tydeliggjøre sitt tilbud gjennom en konkret og troverdig innholdsfortelling før budskapet drukner i generisk kommunikasjon.`,
        loglineScore: 7,
      },
      theme: {
        centralTheme: "Tillit skapes gjennom tydelig og ekte kommunikasjon.",
        themeStatement: "Når verdien vises konkret, blir det enklere å ta en beslutning.",
        protagonistFlaw: "for mye internforståelse og for lite klarhet utad",
        flawOrigin: "bedriftens kunnskap er ikke oversatt til et publikumsvennlig budskap",
        whatMustChange: "budskapet må spisses og kobles til faktiske situasjoner og bevis",
        transformationArc: "fra intern kompleksitet til tydelig ekstern kommunikasjon",
        emotionalJourney: ["nysgjerrighet", "trygghet", "tillit"],
        moralArgument: "Klar kommunikasjon gir bedre beslutninger.",
      },
      contentStoryLogic: {
        industry: brregCompany?.industryCode?.description || classification.industry,
        subIndustry: classification.subIndustry,
        businessModel: classification.businessModel,
        contentCategory: classification.contentCategory,
        productionApproach: classification.productionApproach,
        businessObjective:
          classification.businessModel === "B2C"
            ? "Øke lyst til å bestille og gjøre valget enkelt."
            : "Skape tydeligere forståelse, tillit og beslutningsgrunnlag.",
        audienceProblem:
          classification.industry === "Restaurant og servering"
            ? "Publikum må raskt forstå hva som frister, hvor enkelt det er å bestille og hvorfor de skal velge akkurat dette stedet."
            : "Publikum må raskt forstå hvorfor denne leverandøren er relevant og troverdig.",
        keyPromise:
          classification.industry === "Restaurant og servering"
            ? `${companyName} leverer fersk, fristende pizza som er enkel å bestille for henting eller levering.`
            : summary,
        proofPoints,
        desiredAction:
          classification.businessModel === "B2C" ? "Bestill nå" : "Ta kontakt / gå videre til neste beslutning",
        channelPriority:
          classification.businessModel === "B2C"
            ? ["Nettside", "Instagram", "Meta", "Google-profil"]
            : ["Nettside", "LinkedIn", "Salgsstøtte", "CRM-oppfølging"],
        visualFocus:
          classification.industry === "Restaurant og servering"
            ? "Produktnære shots, servering, ovn, tekstur, cheese-pull, bestillingsøyeblikk og lokasjon."
            : "Reelle situasjoner, arbeidsøyeblikk, mennesker, leveranse og bevis.",
        clientMustConfirm: [
          "Hvilke produkter eller tjenester som skal være helter i innholdet",
          "Hvilke kanaler og formater som er viktigst",
          "Hvilket budskap som er viktigst å få frem",
          "Hvilken CTA som skal brukes",
          "Hvem hos kunden har avtale-, faktura- og publiseringsansvar",
        ],
      },
      classification: {
        ...classification,
        industry: brregCompany?.industryCode?.description || classification.industry,
      },
      currentPhase: 1,
      phaseStatus: {
        concept: "ready",
        logline: "weak",
        theme: "weak",
      },
      lastSaved: null,
      locks: {
        concept: false,
        logline: false,
        theme: false,
      },
      versions: [],
      isLocked: false,
    },
    nextRecommendedSteps: [
      "Verifiser kundeprofil og målgruppe med klienten",
      brregCompany?.lookupStatus === "verified"
        ? `Vi har nå hentet all tilgjengelig offentlig Brreg-informasjon om kunden. Spør om du skal opprette prosjekt på ${companyName}.`
        : "Brreg-data ble ikke verifisert. Be kunden bekrefte juridisk navn, org.nr og fakturamottaker.",
      verifiedSocialProfiles.length > 0
        ? `Bekreft ${verifiedSocialProfiles.length} foreslåtte sosiale kontoer før de brukes i brief, kanalplan eller klienttilgang.`
        : "Spør kunden om offisielle sosiale kanaler hvis nettsiden ikke oppgir dem.",
      competitorAnalysis.verifiedCompetitorCount > 0
        ? `Gå gjennom ${competitorAnalysis.verifiedCompetitorCount} konkurrentkandidater med kunden før markedsføringsvinkelen låses.`
        : "Konkurrentanalyse er begrenset. Be kunden oppgi de viktigste konkurrentene manuelt.",
      "Godkjenn story logikk før manus og storyboard fylles videre ut",
      "Samle brandfiler, logo og eksisterende referansemateriale",
      ...agreementSuggestions.slice(0, 2).map((entry) => `Avtale: ${entry.title}`),
      ...(businessSignals?.rating && businessSignals?.userRatingCount
        ? [`Bruk kundesignaler fra ${businessSignals.userRatingCount} Google-anmeldelser som bevispunkter i brief og CTA.`]
        : []),
    ],
    projectCreationDraft: {
      projectName: `${companyName} · Innholdsproduksjon`,
      description: normalizeWhitespace(
        [
          summary,
          brregCompany?.lookupStatus === "verified"
            ? `Kunde verifisert i Brreg med org.nr ${brregCompany.organizationNumber}.`
            : "",
          companyAge?.label || "",
          agreementSuggestions.length > 0
            ? `Avtaleforslag: ${agreementSuggestions.map((entry) => entry.title).join("; ")}.`
            : "",
          verifiedSocialProfiles.length > 0
            ? `Sosiale kontoer funnet: ${verifiedSocialProfiles.map((entry) => `${entry.platform} ${entry.url}`).join("; ")}.`
            : "",
          competitorAnalysis.verifiedCompetitorCount > 0
            ? `Konkurrentanalyse: ${competitorAnalysis.competitors
                .filter((entry) => entry.status === "verified" || entry.status === "likely")
                .slice(0, 5)
                .map((entry) => `${entry.name} (${entry.confidence}%)`)
                .join("; ")}.`
            : "",
        ].filter(Boolean).join(" "),
      ),
      projectType: "content_production",
      clientCompanyName: companyName,
      clientOrganizationNumber: brregCompany?.organizationNumber || normalizeOrganizationNumber(input.organizationNumber) || "",
      clientCompanyAddress: businessSignals?.formattedAddress || brregCompany?.businessAddress || "",
      location: businessSignals?.formattedAddress || brregCompany?.businessAddress || "",
      websiteUrl: websiteUrl || "",
      suggestedAgreementNotes: agreementSuggestions.map((entry) => `${entry.title}: ${entry.detail}`).join("\n"),
    },
  };
}

async function requestOpenAiBootstrap(
  input: RoleRoomAgentProducerBootstrapInput,
  websiteInsights: RoleRoomAgentWebsiteInsights,
  businessSignals: RoleRoomAgentBusinessSignals | null,
  brregCompany: RoleRoomAgentBrregCompany | null,
  companyAge: RoleRoomAgentCompanyAge | null,
  agreementSuggestions: RoleRoomAgentAgreementSuggestion[],
  competitorAnalysis: RoleRoomAgentCompetitorAnalysis,
  retrievalMeta: RoleRoomAgentRetrievalMeta | null,
): Promise<unknown | null> {
  const runtimeConfig = getRoleRoomAgentRuntimeConfig();
  if (!runtimeConfig.providerConfigured) {
    return null;
  }

  const payload = {
    model: runtimeConfig.defaultModel,
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Du er The Role Room Agent for The Role Room. Lag norske JSON-utkast for innholdsproduksjon. Returner kun gyldig JSON med feltene companyProfile, intakeDraft, planningDraft, storyLogicDraft og nextRecommendedSteps. Svar kun med JSON. Vær konkret, kommersiell og nyttig for en innholdsprodusent som bygger brief, story logikk og produksjonsgrunnlag for en kunde. Bruk Brreg-data som juridisk kilde når den finnes, og ikke finn på organisasjonsnummer eller selskapsstatus.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Lag første utkast for kundeprofil, story logikk og brief for et innholdsproduksjonsprosjekt.",
          requirements: {
            language: "nb-NO",
            audience: "content_producer",
            constraints: [
              "Vær konkret og bruk forretningsspråk som passer norsk produksjonsarbeid.",
              "Ikke finn på kontaktinfo som ikke finnes.",
              "Hvis informasjon mangler, marker det forsiktig i forslagene uten å være vag.",
              "Story logic skal passe innholdsproduksjon og kunde-brief, ikke filmmanus for kinofilm.",
              "Klassifiser alltid hvilken bransje innholdet lages for, underbransje, om kunden er B2B eller B2C, hvilken innholdskategori som passer, og hvilket produksjonsgrep som anbefales.",
              "Unngå generiske B2B-målgrupper dersom nettstedet tydelig viser en B2C-virksomhet som restaurant, retail eller lokal tjeneste.",
              "For restaurant og matkonsepter skal story logic handle om meny, fristelse, bestilling, lokasjon og konvertering, ikke generell bedriftsprofil.",
              "Legg inn en contentStoryLogic-del som er lett for klienten å fylle ut og godkjenne i et innholdsproduksjonsprosjekt.",
              "Hvis businessSignals finnes, bruk reviews, rating, lokasjon og tjenestesignalene aktivt i brief, bevispunkter, CTA og story logic.",
              "Hvis brregCompany.lookupStatus er verified, bruk juridisk navn, organisasjonsnummer, bransjekode, adresse, MVA-status og alder i kundeprofilen.",
              "Hvis agreementSuggestions finnes, bruk dem som avtalerisiko og praktiske anbefalinger, men formuler det som produksjonsråd, ikke juridisk rådgivning.",
              "Hvis socialProfileCandidates finnes, bruk kun kontoer med verified eller likely som kanalinnsikt, og marker kontoer som må bekreftes av produsent eller kunde før publisering.",
              "Hvis competitorAnalysis finnes, bruk kun konkurrenter med verified eller likely som markedsføringsinnsikt. Ikke påstå at en kandidat er konkurrent uten manuell bekreftelse fra kunden.",
              "Bruk konkurrentanalysen til posisjonering, content gaps, CTA og kanalprioritering, men ikke finn på annonsetall, markedsandeler eller private konkurrentdata.",
            ],
          },
          outputSchemaHints: {
            companyProfile: [
              "companyName",
              "websiteUrl",
              "organizationNumber",
              "summary",
              "offerings",
              "targetAudience",
              "toneAndBrandSignals",
              "industry",
              "subIndustry",
              "businessModel",
              "contentCategory",
              "productionApproach",
              "probableLocationAddress",
              "logoUrl",
            ],
            planningDraft: {
              contentLogic: [
                "objective",
                "audience",
                "hook",
                "coreMessage",
                "industry",
                "subIndustry",
                "businessModel",
                "contentCategory",
                "productionApproach",
                "proofPoints",
                "callToAction",
                "distributionPlan",
                "successSignals",
              ],
            },
            storyLogicDraft: ["classification", "contentStoryLogic", "storyLogicType", "coreNarrative", "logicFlow", "messageHierarchy"],
          },
          input,
          websiteInsights,
          businessSignals,
          brregCompany,
          companyAge,
          agreementSuggestions,
          socialProfileCandidates: websiteInsights.socialProfileCandidates ?? [],
          competitorAnalysis,
          retrievalMeta,
        }),
      },
    ],
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string | null } }> }
      | null;
    const content = result?.choices?.[0]?.message?.content;
    if (!hasText(content)) {
      return null;
    }

    return JSON.parse(content);
  } catch {
    return null;
  }
}

function normalizeBootstrapPayload(
  raw: unknown,
  input: RoleRoomAgentProducerBootstrapInput,
  websiteInsights: RoleRoomAgentWebsiteInsights,
  fallback: RoleRoomAgentNormalizedPayload,
  businessSignals: RoleRoomAgentBusinessSignals | null,
): RoleRoomAgentNormalizedPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fallback;
  }

  const record = raw as Record<string, unknown>;
  const companyProfile = (record.companyProfile && typeof record.companyProfile === "object" && !Array.isArray(record.companyProfile))
    ? (record.companyProfile as Record<string, unknown>)
    : {};
  const intakeDraft = (record.intakeDraft && typeof record.intakeDraft === "object" && !Array.isArray(record.intakeDraft))
    ? (record.intakeDraft as Record<string, unknown>)
    : {};
  const planningDraft = (record.planningDraft && typeof record.planningDraft === "object" && !Array.isArray(record.planningDraft))
    ? (record.planningDraft as Record<string, unknown>)
    : {};
  const activationPlan = (planningDraft.activationPlan && typeof planningDraft.activationPlan === "object" && !Array.isArray(planningDraft.activationPlan))
    ? (planningDraft.activationPlan as Record<string, unknown>)
    : {};
  const contentLogic = (planningDraft.contentLogic && typeof planningDraft.contentLogic === "object" && !Array.isArray(planningDraft.contentLogic))
    ? (planningDraft.contentLogic as Record<string, unknown>)
    : {};
  const brandGuideRaw = (planningDraft.brandGuide && typeof planningDraft.brandGuide === "object" && !Array.isArray(planningDraft.brandGuide))
    ? (planningDraft.brandGuide as Record<string, unknown>)
    : {};
  const storyLogicDraftRaw =
    record.storyLogicDraft && typeof record.storyLogicDraft === "object" && !Array.isArray(record.storyLogicDraft)
      ? (record.storyLogicDraft as Record<string, unknown>)
      : {};
  const storyLogicClassification =
    storyLogicDraftRaw.classification &&
    typeof storyLogicDraftRaw.classification === "object" &&
    !Array.isArray(storyLogicDraftRaw.classification)
      ? (storyLogicDraftRaw.classification as Record<string, unknown>)
      : {};

  return {
    ...fallback,
    generatedAt: new Date().toISOString(),
    provider: "openai",
    model: getRoleRoomAgentRuntimeConfig().defaultModel,
    businessSignals,
    brregCompany: fallback.brregCompany,
    companyAge: fallback.companyAge,
    agreementSuggestions: fallback.agreementSuggestions,
    socialProfileCandidates: fallback.socialProfileCandidates,
    competitorAnalysis: fallback.competitorAnalysis,
    retrievalMeta: fallback.retrievalMeta,
    companyProfile: {
      companyName: hasText(companyProfile.companyName)
        ? normalizeWhitespace(companyProfile.companyName)
        : fallback.companyProfile.companyName,
      websiteUrl: hasText(companyProfile.websiteUrl)
        ? normalizeWebsiteUrl(companyProfile.websiteUrl)
        : fallback.companyProfile.websiteUrl,
      organizationNumber: hasText(companyProfile.organizationNumber)
        ? normalizeWhitespace(companyProfile.organizationNumber)
        : fallback.companyProfile.organizationNumber,
      summary: hasText(companyProfile.summary)
        ? toSentenceCase(companyProfile.summary)
        : fallback.companyProfile.summary,
      offerings: normalizeStringArray(companyProfile.offerings, fallback.companyProfile.offerings),
      targetAudience: normalizeStringArray(companyProfile.targetAudience, fallback.companyProfile.targetAudience),
      toneAndBrandSignals: normalizeStringArray(companyProfile.toneAndBrandSignals, fallback.companyProfile.toneAndBrandSignals),
      industry: hasText(companyProfile.industry)
        ? normalizeWhitespace(companyProfile.industry)
        : fallback.companyProfile.industry,
      subIndustry: hasText(companyProfile.subIndustry)
        ? normalizeWhitespace(companyProfile.subIndustry)
        : fallback.companyProfile.subIndustry,
      businessModel: hasText(companyProfile.businessModel)
        ? normalizeWhitespace(companyProfile.businessModel)
        : fallback.companyProfile.businessModel,
      contentCategory: hasText(companyProfile.contentCategory)
        ? normalizeWhitespace(companyProfile.contentCategory)
        : fallback.companyProfile.contentCategory,
      productionApproach: hasText(companyProfile.productionApproach)
        ? normalizeWhitespace(companyProfile.productionApproach)
        : fallback.companyProfile.productionApproach,
      probableLocationAddress: hasText(companyProfile.probableLocationAddress)
        ? normalizeWhitespace(companyProfile.probableLocationAddress)
        : (businessSignals?.formattedAddress || null),
      logoUrl: hasText(companyProfile.logoUrl)
        ? resolveUrl(websiteInsights.finalUrl || normalizeWebsiteUrl(input.websiteUrl) || "", companyProfile.logoUrl)
        : fallback.companyProfile.logoUrl,
    },
    intakeDraft: {
      projectGoal: hasText(intakeDraft.projectGoal) ? normalizeWhitespace(intakeDraft.projectGoal) : fallback.intakeDraft.projectGoal,
      deliverables: hasText(intakeDraft.deliverables) ? normalizeWhitespace(intakeDraft.deliverables) : fallback.intakeDraft.deliverables,
      targetAudience: hasText(intakeDraft.targetAudience) ? normalizeWhitespace(intakeDraft.targetAudience) : fallback.intakeDraft.targetAudience,
      keyMessage: hasText(intakeDraft.keyMessage) ? normalizeWhitespace(intakeDraft.keyMessage) : fallback.intakeDraft.keyMessage,
      timingConstraints: hasText(intakeDraft.timingConstraints) ? normalizeWhitespace(intakeDraft.timingConstraints) : fallback.intakeDraft.timingConstraints,
      brandNotes: hasText(intakeDraft.brandNotes) ? normalizeWhitespace(intakeDraft.brandNotes) : fallback.intakeDraft.brandNotes,
      materialOverview: hasText(intakeDraft.materialOverview) ? normalizeWhitespace(intakeDraft.materialOverview) : fallback.intakeDraft.materialOverview,
      referenceLinks: hasText(intakeDraft.referenceLinks) ? normalizeWhitespace(intakeDraft.referenceLinks) : fallback.intakeDraft.referenceLinks,
      contactName: hasText(intakeDraft.contactName) ? normalizeWhitespace(intakeDraft.contactName) : "",
      contactEmail: hasText(intakeDraft.contactEmail) ? normalizeWhitespace(intakeDraft.contactEmail) : "",
      contactPhone: hasText(intakeDraft.contactPhone) ? normalizeWhitespace(intakeDraft.contactPhone) : "",
      additionalNotes: hasText(intakeDraft.additionalNotes) ? normalizeWhitespace(intakeDraft.additionalNotes) : fallback.intakeDraft.additionalNotes,
    },
    planningDraft: {
      activationPlan: {
        direction: hasText(activationPlan.direction) ? normalizeWhitespace(activationPlan.direction) : fallback.planningDraft.activationPlan.direction,
        idea: hasText(activationPlan.idea) ? normalizeWhitespace(activationPlan.idea) : fallback.planningDraft.activationPlan.idea,
        activation: hasText(activationPlan.activation) ? normalizeWhitespace(activationPlan.activation) : fallback.planningDraft.activationPlan.activation,
        targetAudience: hasText(activationPlan.targetAudience) ? normalizeWhitespace(activationPlan.targetAudience) : fallback.planningDraft.activationPlan.targetAudience,
        businessGoal: hasText(activationPlan.businessGoal) ? normalizeWhitespace(activationPlan.businessGoal) : fallback.planningDraft.activationPlan.businessGoal,
        coreMessage: hasText(activationPlan.coreMessage) ? normalizeWhitespace(activationPlan.coreMessage) : fallback.planningDraft.activationPlan.coreMessage,
        successSignals: normalizeStringArray(activationPlan.successSignals, fallback.planningDraft.activationPlan.successSignals as string[]),
      },
      contentLogic: {
        objective: hasText(contentLogic.objective) ? normalizeWhitespace(contentLogic.objective) : fallback.planningDraft.contentLogic.objective,
        audience: hasText(contentLogic.audience) ? normalizeWhitespace(contentLogic.audience) : fallback.planningDraft.contentLogic.audience,
        hook: hasText(contentLogic.hook) ? normalizeWhitespace(contentLogic.hook) : fallback.planningDraft.contentLogic.hook,
        coreMessage: hasText(contentLogic.coreMessage) ? normalizeWhitespace(contentLogic.coreMessage) : fallback.planningDraft.contentLogic.coreMessage,
        industry: hasText(contentLogic.industry)
          ? normalizeWhitespace(contentLogic.industry)
          : fallback.planningDraft.contentLogic.industry,
        subIndustry: hasText(contentLogic.subIndustry)
          ? normalizeWhitespace(contentLogic.subIndustry)
          : fallback.planningDraft.contentLogic.subIndustry,
        businessModel: hasText(contentLogic.businessModel)
          ? normalizeWhitespace(contentLogic.businessModel)
          : fallback.planningDraft.contentLogic.businessModel,
        contentCategory: hasText(contentLogic.contentCategory)
          ? normalizeWhitespace(contentLogic.contentCategory)
          : fallback.planningDraft.contentLogic.contentCategory,
        productionApproach: hasText(contentLogic.productionApproach)
          ? normalizeWhitespace(contentLogic.productionApproach)
          : fallback.planningDraft.contentLogic.productionApproach,
        proofPoints: normalizeStringArray(contentLogic.proofPoints, fallback.planningDraft.contentLogic.proofPoints as string[]),
        callToAction: hasText(contentLogic.callToAction) ? normalizeWhitespace(contentLogic.callToAction) : fallback.planningDraft.contentLogic.callToAction,
        distributionPlan: hasText(contentLogic.distributionPlan) ? normalizeWhitespace(contentLogic.distributionPlan) : fallback.planningDraft.contentLogic.distributionPlan,
        successSignals: normalizeStringArray(contentLogic.successSignals, fallback.planningDraft.contentLogic.successSignals as string[]),
      },
      brandGuide: {
        logoUrl: hasText(brandGuideRaw.logoUrl)
          ? resolveUrl(websiteInsights.finalUrl || normalizeWebsiteUrl(input.websiteUrl) || "", brandGuideRaw.logoUrl)
          : fallback.planningDraft.brandGuide.logoUrl,
        toneOfVoice: hasText(brandGuideRaw.toneOfVoice) ? normalizeWhitespace(brandGuideRaw.toneOfVoice) : fallback.planningDraft.brandGuide.toneOfVoice,
        visualStyle: hasText(brandGuideRaw.visualStyle) ? normalizeWhitespace(brandGuideRaw.visualStyle) : fallback.planningDraft.brandGuide.visualStyle,
        fonts: normalizeStringArray(brandGuideRaw.fonts, fallback.planningDraft.brandGuide.fonts),
        dos: normalizeStringArray(brandGuideRaw.dos, fallback.planningDraft.brandGuide.dos),
        donts: normalizeStringArray(brandGuideRaw.donts, fallback.planningDraft.brandGuide.donts),
        colors: normalizeBrandColors(brandGuideRaw.colors).length > 0
          ? normalizeBrandColors(brandGuideRaw.colors)
          : fallback.planningDraft.brandGuide.colors,
      },
    },
    storyLogicDraft:
      storyLogicDraftRaw && Object.keys(storyLogicDraftRaw).length > 0
        ? {
            ...fallback.storyLogicDraft,
            ...storyLogicDraftRaw,
            classification: {
              ...(fallback.storyLogicDraft.classification as Record<string, unknown>),
              ...storyLogicClassification,
              industry: hasText(storyLogicClassification.industry)
                ? normalizeWhitespace(storyLogicClassification.industry)
                : (fallback.storyLogicDraft.classification as Record<string, unknown>).industry,
              subIndustry: hasText(storyLogicClassification.subIndustry)
                ? normalizeWhitespace(storyLogicClassification.subIndustry)
                : (fallback.storyLogicDraft.classification as Record<string, unknown>).subIndustry,
              businessModel: hasText(storyLogicClassification.businessModel)
                ? normalizeWhitespace(storyLogicClassification.businessModel)
                : (fallback.storyLogicDraft.classification as Record<string, unknown>).businessModel,
              contentCategory: hasText(storyLogicClassification.contentCategory)
                ? normalizeWhitespace(storyLogicClassification.contentCategory)
                : (fallback.storyLogicDraft.classification as Record<string, unknown>).contentCategory,
              productionApproach: hasText(storyLogicClassification.productionApproach)
                ? normalizeWhitespace(storyLogicClassification.productionApproach)
                : (fallback.storyLogicDraft.classification as Record<string, unknown>).productionApproach,
              customerJourneyFocus: hasText(storyLogicClassification.customerJourneyFocus)
                ? normalizeWhitespace(storyLogicClassification.customerJourneyFocus)
                : (fallback.storyLogicDraft.classification as Record<string, unknown>).customerJourneyFocus,
            },
          }
        : fallback.storyLogicDraft,
    nextRecommendedSteps: normalizeStringArray(record.nextRecommendedSteps, fallback.nextRecommendedSteps),
    projectCreationDraft: fallback.projectCreationDraft,
  };
}

export async function generateRoleRoomAgentProducerBootstrap(
  input: RoleRoomAgentProducerBootstrapInput,
): Promise<RoleRoomAgentNormalizedPayload> {
  const initialBrregCompany = await fetchBrregCompany(input);
  const companyAge = calculateCompanyAge(initialBrregCompany);
  const agreementSuggestions = buildAgreementSuggestions(initialBrregCompany, companyAge);
  const enrichedInput: RoleRoomAgentProducerBootstrapInput = {
    ...input,
    companyName: hasText(input.companyName)
      ? input.companyName
      : initialBrregCompany?.name || input.companyName || null,
    organizationNumber: initialBrregCompany?.organizationNumber
      || normalizeOrganizationNumber(input.organizationNumber)
      || input.organizationNumber
      || null,
    websiteUrl: normalizeWebsiteUrl(input.websiteUrl)
      || initialBrregCompany?.website
      || input.websiteUrl
      || null,
  };
  const websiteUrl = normalizeWebsiteUrl(enrichedInput.websiteUrl);
  const websiteInsights = await fetchWebsiteInsights(websiteUrl, enrichedInput, initialBrregCompany);
  const businessSignals = await fetchGooglePlacesBusinessSignals(enrichedInput, websiteInsights);
  const competitorAnalysis = await fetchGooglePlacesCompetitorAnalysis(
    enrichedInput,
    websiteInsights,
    businessSignals,
    initialBrregCompany,
  );
  const fallback = buildFallbackBootstrap(
    {
      ...enrichedInput,
      websiteUrl: websiteUrl || enrichedInput.websiteUrl || null,
    },
    websiteInsights,
    businessSignals,
    initialBrregCompany,
    companyAge,
    agreementSuggestions,
    competitorAnalysis,
  );
  const openAiPayload = await requestOpenAiBootstrap(
    enrichedInput,
    websiteInsights,
    businessSignals,
    initialBrregCompany,
    companyAge,
    agreementSuggestions,
    competitorAnalysis,
    fallback.retrievalMeta ?? null,
  );
  if (!openAiPayload) {
    return fallback;
  }

  return normalizeBootstrapPayload(openAiPayload, enrichedInput, websiteInsights, fallback, businessSignals);
}
