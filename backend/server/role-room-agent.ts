type RoleRoomAgentProducerBootstrapInput = {
  projectId: string;
  projectName?: string;
  websiteUrl?: string | null;
  organizationNumber?: string | null;
  companyName?: string | null;
  extraContext?: string | null;
};

type RoleRoomAgentWebsiteInsights = {
  finalUrl?: string | null;
  pageTitle?: string | null;
  siteName?: string | null;
  metaDescription?: string | null;
  textSnippet?: string | null;
  probableLogoUrl?: string | null;
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

type RoleRoomAgentNormalizedPayload = {
  generatedAt: string;
  provider: "openai" | "fallback";
  model: string;
  businessSignals?: RoleRoomAgentBusinessSignals | null;
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
  nextRecommendedSteps: string[];
};

export const DEFAULT_ROLE_ROOM_AGENT_MODEL =
  process.env.ROLE_ROOM_AGENT_MODEL || "gpt-5.4-mini";

export function getRoleRoomAgentRuntimeConfig() {
  return {
    provider: "openai" as const,
    providerConfigured: hasText(process.env.OPENAI_API_KEY),
    defaultModel: DEFAULT_ROLE_ROOM_AGENT_MODEL,
    googlePlacesConfigured: hasText(process.env.GOOGLE_PLACES_API_KEY),
  };
}

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

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
    .map((entry) => {
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

function extractTextSnippet(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return normalizeWhitespace(decodeHtmlEntities(stripped)).slice(0, 1800);
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
): RoleRoomAgentBusinessClassification {
  const corpus = normalizeWhitespace(
    [
      input.companyName,
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
): Promise<RoleRoomAgentWebsiteInsights> {
  if (!websiteUrl) {
    return {};
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
      return { finalUrl: websiteUrl };
    }

    const html = await response.text();
    return {
      finalUrl: response.url || websiteUrl,
      pageTitle: extractTitle(html),
      siteName: extractMetaContent(html, "og:site_name"),
      metaDescription: extractMetaContent(html, "description") || extractMetaContent(html, "og:description"),
      textSnippet: extractTextSnippet(html),
      probableLogoUrl: extractProbableLogoUrl(html, response.url || websiteUrl),
    };
  } catch {
    return { finalUrl: websiteUrl };
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

  const topReviews: RoleRoomAgentReviewQuote[] = reviews
    .map((review) => {
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
    .filter((entry): entry is RoleRoomAgentReviewQuote => entry !== null)
    .slice(0, 3);

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

function buildFallbackBootstrap(
  input: RoleRoomAgentProducerBootstrapInput,
  websiteInsights: RoleRoomAgentWebsiteInsights,
  businessSignals: RoleRoomAgentBusinessSignals | null,
): RoleRoomAgentNormalizedPayload {
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl) || websiteInsights.finalUrl || null;
  const companyName = hasText(input.companyName)
    ? normalizeWhitespace(input.companyName)
    : websiteInsights.siteName || websiteInsights.pageTitle || "Kunden";
  const classification = detectBusinessClassification(input, websiteInsights, businessSignals);
  const summary = toSentenceCase(
    websiteInsights.metaDescription ||
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
    companyProfile: {
      companyName,
      websiteUrl,
      organizationNumber: hasText(input.organizationNumber) ? normalizeWhitespace(input.organizationNumber) : null,
      summary,
      offerings: proofPoints.length > 0 ? proofPoints : ["Tjenester og leveranser må verifiseres manuelt"],
      targetAudience: audience,
      toneAndBrandSignals,
      industry: classification.industry,
      subIndustry: classification.subIndustry,
      businessModel: classification.businessModel,
      contentCategory: classification.contentCategory,
      productionApproach: classification.productionApproach,
      probableLocationAddress: businessSignals?.formattedAddress || null,
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
      additionalNotes: hasText(input.extraContext) ? normalizeWhitespace(input.extraContext) : "",
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
        industry: classification.industry,
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
        industry: classification.industry,
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
        ],
      },
      classification,
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
      "Godkjenn story logikk før manus og storyboard fylles videre ut",
      "Samle brandfiler, logo og eksisterende referansemateriale",
      ...(businessSignals?.rating && businessSignals?.userRatingCount
        ? [`Bruk kundesignaler fra ${businessSignals.userRatingCount} Google-anmeldelser som bevispunkter i brief og CTA.`]
        : []),
    ],
  };
}

async function requestOpenAiBootstrap(
  input: RoleRoomAgentProducerBootstrapInput,
  websiteInsights: RoleRoomAgentWebsiteInsights,
  businessSignals: RoleRoomAgentBusinessSignals | null,
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
          "Du er The Role Room Agent for The Role Room. Lag norske JSON-utkast for innholdsproduksjon. Returner kun gyldig JSON med feltene companyProfile, intakeDraft, planningDraft, storyLogicDraft og nextRecommendedSteps. Svar kun med JSON. Vær konkret, kommersiell og nyttig for en innholdsprodusent som bygger brief, story logikk og produksjonsgrunnlag for en kunde.",
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
  };
}

export async function generateRoleRoomAgentProducerBootstrap(
  input: RoleRoomAgentProducerBootstrapInput,
): Promise<RoleRoomAgentNormalizedPayload> {
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl);
  const websiteInsights = await fetchWebsiteInsights(websiteUrl);
  const businessSignals = await fetchGooglePlacesBusinessSignals(input, websiteInsights);
  const fallback = buildFallbackBootstrap(
    {
      ...input,
      websiteUrl: websiteUrl || input.websiteUrl || null,
    },
    websiteInsights,
    businessSignals,
  );
  const openAiPayload = await requestOpenAiBootstrap(input, websiteInsights, businessSignals);
  if (!openAiPayload) {
    return fallback;
  }

  return normalizeBootstrapPayload(openAiPayload, input, websiteInsights, fallback, businessSignals);
}
