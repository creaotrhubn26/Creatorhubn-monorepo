/**
 * integration-registry.ts
 *
 * Kodedrevet Integration Registry (Implementation Plan steg 2,
 * docs/integration-audit/06). Én oppføring per integrasjon, validert mot
 * integration-registry-schema ved oppstart — sannhetskilden for hva som
 * finnes, hva som mangler credentials, og hvilke fallback-kjeder som
 * gjelder. Admin Integration Center leser herfra (v1 = read-only).
 *
 * Statusene speiler den VERIFISERTE virkeligheten fra
 * docs/integration-audit/01-integration-inventory.md (Render-oppslag
 * 2026-07-10) — ikke ønsketenkning. «No Fake Integrations»: en oppføring
 * med availabilityStatus ≠ active/degraded kan aldri serveres som
 * datakilde (se isServable i skjemaet).
 *
 * DB-tabell kommer når Admin Center trenger skriveoperasjoner — inntil
 * da er endringer i denne fila kode-reviewet konfig.
 */

import {
  type IntegrationRegistryEntry,
  IntegrationRegistryEntrySchema,
  validateIntegrationRegistryEntry,
} from "./integration-registry-schema.js";

const T0 = "2026-07-10T00:00:00.000Z";

type EntryOverrides = Partial<IntegrationRegistryEntry> &
  Pick<
    IntegrationRegistryEntry,
    | "integrationId"
    | "provider"
    | "displayName"
    | "category"
    | "purpose"
    | "supportedDataTypes"
    | "authenticationType"
    | "credentialReference"
    | "availabilityStatus"
    | "implementationStatus"
    | "accessLevel"
    | "tenantScope"
    | "syncMode"
    | "termsStatus"
    | "documentationReference"
  >;

/** Kompakt konstruktør — defaults for felter som oftest er like. */
function entry(e: EntryOverrides): IntegrationRegistryEntry {
  return IntegrationRegistryEntrySchema.parse({
    apiBaseUrl: null,
    apiVersion: null,
    enabled: true,
    workspaceScope: "all",
    syncFrequency: null,
    rateLimits: null,
    quotas: null,
    estimatedCost: null,
    dataLicense: null,
    geographicCoverage: null,
    historicalCoverage: null,
    freshness: null,
    healthStatus: "unknown",
    lastSuccessfulSync: null,
    lastFailedSync: null,
    failureReason: null,
    fallbackIntegrationId: null,
    owner: "daniel@creatorhubn.com",
    createdAt: T0,
    updatedAt: T0,
    ...e,
  });
}

export const INTEGRATION_REGISTRY_ENTRIES: IntegrationRegistryEntry[] = [
  // ── Search demand & trends ─────────────────────────────────────────
  entry({
    integrationId: "google-trends-alpha",
    provider: "Google",
    displayName: "Google Trends API (alpha)",
    category: "search_demand",
    purpose: "Relativ søkeinteresse over tid, geo-interesse, related queries",
    supportedDataTypes: ["relative_interest", "regional_interest", "related_queries"],
    authenticationType: "oauth2_app",
    credentialReference: null,
    enabled: false,
    availabilityStatus: "awaitingApproval", // søknad sendt 2026-07-10
    implementationStatus: "discovered",
    accessLevel: "app_granted",
    tenantScope: "shared",
    syncMode: "scheduled",
    termsStatus: "ok",
    geographicCoverage: "global (NO: land + sub-region)",
    historicalCoverage: "rullerende 5 år",
    fallbackIntegrationId: "google-ads-keyword-planner",
    documentationReference: "docs/integration-audit/03-google-trends-assessment.md",
  }),
  entry({
    integrationId: "google-ads-keyword-planner",
    provider: "Google",
    displayName: "Google Ads Keyword Planner",
    category: "search_demand",
    purpose: "Månedlig søkevolum, konkurranse og bud-intervaller (volum-proxy)",
    supportedDataTypes: ["search_volume_avg", "keyword_competition", "bid_ranges"],
    authenticationType: "oauth2_user_plus_developer_token",
    credentialReference: "GOOGLE_ADS_DEVELOPER_TOKEN + GOOGLE_ADS_OAUTH_CLIENT_ID/SECRET",
    apiBaseUrl: "https://googleads.googleapis.com",
    apiVersion: "v18",
    enabled: true,
    availabilityStatus: "configured", // creds verifisert; flippes til active etter første prod-oppslag
    implementationStatus: "active", // keyword-planner-adapter.ts (2026-07-11)
    accessLevel: "user_granted",
    tenantScope: "per_org",
    syncMode: "scheduled",
    quotas: "Basic Access: 15k operasjoner/dag (bekreftet i API-senteret 2026-07-10)",
    termsStatus: "ok",
    fallbackIntegrationId: "manual-trend-import",
    documentationReference: "backend/server/integrations/keyword-planner-adapter.ts",
  }),
  entry({
    integrationId: "manual-trend-import",
    provider: "Creatorhubn",
    displayName: "Manuell trend-import (CSV)",
    category: "search_demand",
    purpose: "Brukerimportert Trends-/markedsdata via importflyten — førsteklasses kilde",
    supportedDataTypes: ["relative_interest", "regional_interest", "related_queries"],
    authenticationType: "none",
    credentialReference: null,
    enabled: false,
    availabilityStatus: "discovered",
    implementationStatus: "discovered", // bygges i Implementation Plan steg 4
    accessLevel: "user_granted",
    tenantScope: "per_org",
    syncMode: "manual_import",
    termsStatus: "ok",
    documentationReference: "docs/integration-audit/05-adapter-architecture-normalized-data.md (§4)",
  }),

  // ── Owned marketing (brukerens egne data) ──────────────────────────
  entry({
    integrationId: "google-search-console",
    provider: "Google",
    displayName: "Google Search Console",
    category: "owned_marketing",
    purpose: "Søkeytelse (clicks/impressions/CTR/position) for egne verifiserte domener",
    supportedDataTypes: ["owned_clicks", "owned_impressions", "owned_ctr", "owned_position"],
    authenticationType: "oauth2_user",
    credentialReference: "kryptert bruker-OAuth-token (TOKEN_ENCRYPTION_KEY-mønsteret)",
    apiBaseUrl: "https://www.googleapis.com/webmasters/v3",
    apiVersion: "v3",
    availabilityStatus: "active",
    implementationStatus: "active",
    accessLevel: "user_granted",
    tenantScope: "per_org",
    syncMode: "on_demand",
    termsStatus: "ok",
    documentationReference: "backend/server/client-insights-service.ts, client-google-suite.ts",
  }),
  entry({
    integrationId: "ga4-data-api",
    provider: "Google",
    displayName: "Google Analytics 4 Data API",
    category: "owned_marketing",
    purpose: "Sessions/brukere/conversions for egne GA4-properties (REST runReport)",
    supportedDataTypes: ["sessions", "total_users", "conversions", "channel_breakdown"],
    authenticationType: "oauth2_user",
    credentialReference: "kryptert bruker-OAuth-token",
    apiBaseUrl: "https://analyticsdata.googleapis.com/v1beta",
    apiVersion: "v1beta",
    availabilityStatus: "active",
    implementationStatus: "active",
    accessLevel: "user_granted",
    tenantScope: "per_org",
    syncMode: "on_demand",
    termsStatus: "ok",
    documentationReference: "backend/server/client-insights-service.ts",
  }),
  entry({
    integrationId: "google-ads",
    provider: "Google",
    displayName: "Google Ads API (innsikt + customer match)",
    category: "owned_marketing",
    purpose: "Kampanje-innsikt, KPI-synk og customer match for kunders Ads-kontoer",
    supportedDataTypes: ["ad_spend", "ad_clicks", "ad_conversions", "customer_match"],
    authenticationType: "oauth2_user_plus_developer_token",
    credentialReference: "GOOGLE_ADS_DEVELOPER_TOKEN + bruker-OAuth",
    apiBaseUrl: "https://googleads.googleapis.com",
    apiVersion: "v18",
    availabilityStatus: "active",
    implementationStatus: "active",
    accessLevel: "user_granted",
    tenantScope: "per_org",
    syncMode: "scheduled",
    quotas: "Basic Access: 15k operasjoner/dag",
    termsStatus: "ok",
    documentationReference: "backend/server/role-room-google-ads.ts, client-insights-service.ts",
  }),
  entry({
    integrationId: "meta-graph",
    provider: "Meta",
    displayName: "Meta Graph API (FB/IG/WhatsApp)",
    category: "owned_marketing",
    purpose: "Pages/IG-publisering, leads, KPI, WhatsApp-meldinger",
    supportedDataTypes: ["page_posts", "ig_media", "lead_forms", "ad_kpi", "whatsapp_messages"],
    authenticationType: "oauth2_user",
    credentialReference: "META_APP_ID/SECRET + krypterte bruker-tokens",
    apiBaseUrl: "https://graph.facebook.com",
    apiVersion: "v21.0",
    availabilityStatus: "active",
    implementationStatus: "active",
    accessLevel: "user_granted",
    tenantScope: "per_org",
    syncMode: "scheduled",
    termsStatus: "ok",
    documentationReference: "backend/server/role-room-kpi-connectors.ts m.fl. (43 filer)",
  }),
  entry({
    integrationId: "linkedin",
    provider: "LinkedIn",
    displayName: "LinkedIn (OAuth, ads, conversions, lead-sync)",
    category: "owned_marketing",
    purpose: "Ads-innsikt, conversions-API og lead-synk for kunders LinkedIn",
    supportedDataTypes: ["ad_kpi", "conversions", "leads"],
    authenticationType: "oauth2_user",
    credentialReference: "LINKEDIN_CLIENT_ID/SECRET (ROLE_ROOM_LINKEDIN_* er deklarert men usatt — verifiser RR-flyt)",
    apiBaseUrl: "https://api.linkedin.com",
    apiVersion: null,
    availabilityStatus: "active",
    implementationStatus: "active",
    accessLevel: "user_granted",
    tenantScope: "per_org",
    syncMode: "scheduled",
    termsStatus: "ok",
    documentationReference: "backend/server/linkedin-oauth-routes.ts, role-room-linkedin-ads.ts",
  }),
  entry({
    integrationId: "tiktok-business",
    provider: "TikTok",
    displayName: "TikTok Business API",
    category: "owned_marketing",
    purpose: "Ads-/business-innsikt for kunders TikTok-kontoer",
    supportedDataTypes: ["ad_kpi", "account_insights"],
    authenticationType: "oauth2_user",
    credentialReference: "TIKTOK_BUSINESS_APP_ID/SECRET",
    apiBaseUrl: "https://business-api.tiktok.com",
    apiVersion: null,
    availabilityStatus: "active",
    implementationStatus: "partiallyImplemented",
    accessLevel: "user_granted",
    tenantScope: "per_org",
    syncMode: "scheduled",
    termsStatus: "ok",
    documentationReference: "backend/server/client-tiktok-suite.ts, role-room-tiktok-mcp.ts",
  }),
  entry({
    integrationId: "youtube-data",
    provider: "Google",
    displayName: "YouTube Data/Analytics API",
    category: "owned_marketing",
    purpose: "Publisering + ytelses-innsikt for creator-modulen",
    supportedDataTypes: ["video_publish", "video_analytics"],
    authenticationType: "oauth2_user",
    credentialReference: "kryptert bruker-OAuth-token",
    apiBaseUrl: "https://www.googleapis.com/youtube/v3",
    apiVersion: "v3",
    availabilityStatus: "active",
    implementationStatus: "active",
    accessLevel: "user_granted",
    tenantScope: "per_org",
    syncMode: "scheduled",
    termsStatus: "ok",
    documentationReference: "backend/server/social-publisher-youtube.ts, youtube-routes.ts",
  }),
  entry({
    integrationId: "reddit",
    provider: "Reddit",
    displayName: "Reddit (community-engasjement)",
    category: "owned_marketing",
    purpose: "Eget community-engasjement via script-app (IKKE bulk markedsdata)",
    supportedDataTypes: ["engagement_posts"],
    authenticationType: "oauth2_app",
    credentialReference: "REDDIT_CLIENT_ID/SECRET/USER_AGENT — MANGLER i Render (verifisert 2026-07-10)",
    apiBaseUrl: "https://www.reddit.com",
    apiVersion: null,
    availabilityStatus: "missingCredentials",
    implementationStatus: "partiallyImplemented",
    accessLevel: "app_granted",
    tenantScope: "shared",
    syncMode: "on_demand",
    termsStatus: "requiresReview",
    documentationReference: "backend/server/reddit-engagement-service.ts",
  }),

  // ── Offentlige norske datakilder ───────────────────────────────────
  entry({
    integrationId: "brreg",
    provider: "Brønnøysundregistrene",
    displayName: "Brønnøysundregistrene (åpne data)",
    category: "public_data",
    purpose: "Bedriftsprofil/org-data for lead-beriking og company-scoring",
    supportedDataTypes: ["company_profile", "employees", "industry_codes"],
    authenticationType: "none",
    credentialReference: null,
    apiBaseUrl: "https://data.brreg.no",
    apiVersion: null,
    availabilityStatus: "active",
    implementationStatus: "active",
    accessLevel: "public",
    tenantScope: "shared",
    syncMode: "on_demand",
    termsStatus: "requiresAttribution",
    dataLicense: "NLOD",
    geographicCoverage: "NO",
    documentationReference: "backend/server/lead-brreg-service.ts",
  }),
  entry({
    integrationId: "ssb",
    provider: "Statistisk sentralbyrå",
    displayName: "SSB åpne API",
    category: "public_data",
    purpose: "Befolkning/alder/medianinntekt per kommune; lønnsstatistikk",
    supportedDataTypes: ["population", "median_income", "salary_stats"],
    authenticationType: "none",
    credentialReference: null,
    apiBaseUrl: "https://data.ssb.no/api/v0",
    apiVersion: "v0",
    availabilityStatus: "active",
    implementationStatus: "active",
    accessLevel: "public",
    tenantScope: "shared",
    syncMode: "on_demand",
    syncFrequency: "cache 7d",
    termsStatus: "requiresAttribution",
    dataLicense: "NLOD",
    geographicCoverage: "NO (kommune-nivå)",
    freshness: "monthly",
    documentationReference: "backend/server/lead-ssb-service.ts",
  }),
  entry({
    integrationId: "kartverket-geonorge",
    provider: "Kartverket",
    displayName: "Kartverket / Geonorge",
    category: "geo",
    purpose: "Adresse-/geodata og reverse geocode for Leadgrid-kartet",
    supportedDataTypes: ["addresses", "reverse_geocode"],
    authenticationType: "none",
    credentialReference: null,
    apiBaseUrl: "https://ws.geonorge.no",
    apiVersion: null,
    availabilityStatus: "active",
    implementationStatus: "active",
    accessLevel: "public",
    tenantScope: "shared",
    syncMode: "on_demand",
    termsStatus: "requiresAttribution",
    dataLicense: "NLOD/CC BY",
    geographicCoverage: "NO",
    documentationReference: "backend/server/leadgrid-kartverket-routes.ts",
  }),

  // ── Business intelligence ──────────────────────────────────────────
  entry({
    integrationId: "google-places",
    provider: "Google",
    displayName: "Google Places API (New)",
    category: "business_intelligence",
    purpose: "Lead-/konkurrent-beriking (kontaktinfo, rating, geo) og geosøk",
    supportedDataTypes: ["place_details", "nearby_search", "text_search"],
    authenticationType: "api_key",
    credentialReference: "GOOGLE_PLACES_API_KEY",
    apiBaseUrl: "https://places.googleapis.com",
    apiVersion: "v1",
    availabilityStatus: "active",
    implementationStatus: "active",
    accessLevel: "app_granted",
    tenantScope: "shared",
    syncMode: "on_demand",
    rateLimits: "12s timeout, retry hos caller (Places-malen)",
    estimatedCost: null, // fylles av per-org kost-tellere (Implementation Plan steg 9)
    termsStatus: "ok",
    documentationReference: "backend/server/role-room-agent.ts, leadgrid-project-lead-discovery-routes.ts",
  }),

  // ── GEO-probing (syntetisk AI-synlighet — docs/integration-audit/08) ──
  entry({
    integrationId: "geo-probe-anthropic",
    provider: "Anthropic",
    displayName: "GEO-probe: Claude",
    category: "search_demand",
    purpose: "Syntetisk probing: blir kunden anbefalt når noen spør Claude? (isEstimated)",
    supportedDataTypes: ["ai_mention", "ai_mention_share", "ai_citation", "ai_recommendation_rank"],
    authenticationType: "api_key",
    credentialReference: "ANTHROPIC_API_KEY",
    availabilityStatus: "active",
    implementationStatus: "active",
    accessLevel: "app_granted",
    tenantScope: "per_org",
    syncMode: "scheduled",
    syncFrequency: "ukentlig (GEO_VISIBILITY_CRON_TOKEN-cron) + on-demand",
    termsStatus: "ok",
    documentationReference: "backend/server/market-intelligence/geo-probe-runner-service.ts",
  }),
  entry({
    integrationId: "geo-probe-openai",
    provider: "OpenAI",
    displayName: "GEO-probe: ChatGPT (API)",
    category: "search_demand",
    purpose: "Syntetisk probing mot OpenAI-API (≠ chatgpt.com-appen — merkes i metodikk)",
    supportedDataTypes: ["ai_mention", "ai_mention_share", "ai_citation", "ai_recommendation_rank"],
    authenticationType: "api_key",
    credentialReference: "OPENAI_API_KEY — MANGLER på hovedbackenden (verifisert 2026-07-10)",
    availabilityStatus: "missingCredentials",
    implementationStatus: "active",
    accessLevel: "app_granted",
    tenantScope: "per_org",
    syncMode: "scheduled",
    termsStatus: "ok",
    documentationReference: "backend/server/market-intelligence/geo-probe-engines.ts",
  }),
  entry({
    integrationId: "geo-probe-perplexity",
    provider: "Perplexity",
    displayName: "GEO-probe: Perplexity",
    category: "search_demand",
    purpose: "Syntetisk probing mot Perplexity (nærmest ekte AI-søk; krever konto)",
    supportedDataTypes: ["ai_mention", "ai_mention_share", "ai_citation", "ai_recommendation_rank"],
    authenticationType: "api_key",
    credentialReference: "PERPLEXITY_API_KEY — ikke opprettet ennå (manuell eier-handling)",
    apiBaseUrl: "https://api.perplexity.ai",
    apiVersion: null,
    availabilityStatus: "missingCredentials",
    implementationStatus: "active",
    accessLevel: "app_granted",
    tenantScope: "per_org",
    syncMode: "scheduled",
    termsStatus: "ok",
    documentationReference: "backend/server/market-intelligence/geo-probe-engines.ts",
  }),

  // ── AI-leverandører ────────────────────────────────────────────────
  entry({
    integrationId: "anthropic",
    provider: "Anthropic",
    displayName: "Anthropic Claude",
    category: "ai",
    purpose: "Kjerne-LLM: agent, market scan, anbefalinger, innholdsproduksjon",
    supportedDataTypes: ["llm_completion"],
    authenticationType: "api_key",
    credentialReference: "ANTHROPIC_API_KEY",
    apiBaseUrl: "https://api.anthropic.com",
    apiVersion: null,
    availabilityStatus: "active",
    implementationStatus: "active",
    accessLevel: "app_granted",
    tenantScope: "shared",
    syncMode: "on_demand",
    termsStatus: "ok",
    documentationReference: "89 filer; AI-usage-tracker: backend/server/leadgrid-ai-usage-tracker.ts",
  }),
  entry({
    integrationId: "cohere",
    provider: "Cohere",
    displayName: "Cohere (rerank)",
    category: "ai",
    purpose: "Rerank i role-room-agent",
    supportedDataTypes: ["rerank"],
    authenticationType: "api_key",
    credentialReference: "COHERE_API_KEY — MANGLER på hovedbackenden (kun legacy backend-djm5, verifisert 2026-07-10)",
    availabilityStatus: "missingCredentials",
    implementationStatus: "active",
    accessLevel: "app_granted",
    tenantScope: "shared",
    syncMode: "on_demand",
    termsStatus: "ok",
    documentationReference: "backend/server/role-room-agent.ts",
  }),
];

/** Registry som Map, validert. Kaster ved ugyldig oppføring (fail fast). */
export function getIntegrationRegistry(): Map<string, IntegrationRegistryEntry> {
  const map = new Map<string, IntegrationRegistryEntry>();
  for (const e of INTEGRATION_REGISTRY_ENTRIES) {
    const result = validateIntegrationRegistryEntry(e);
    if (!result.valid || !result.entry) {
      throw new Error(
        `[integration-registry] ugyldig oppføring '${e.integrationId}': ${result.errors?.join("; ")}`,
      );
    }
    if (map.has(result.entry.integrationId)) {
      throw new Error(`[integration-registry] duplikat id '${result.entry.integrationId}'`);
    }
    map.set(result.entry.integrationId, result.entry);
  }
  // Fallback-referanser må peke på eksisterende oppføringer
  for (const e of map.values()) {
    if (e.fallbackIntegrationId && !map.has(e.fallbackIntegrationId)) {
      throw new Error(
        `[integration-registry] '${e.integrationId}' peker på ukjent fallback '${e.fallbackIntegrationId}'`,
      );
    }
  }
  return map;
}
