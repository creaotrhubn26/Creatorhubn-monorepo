/**
 * search-trend-provider.ts
 *
 * SearchTrendProvider — capability-kontrakten for søketrend-data
 * (docs/integration-audit/03). Frontend og analysemodeller avhenger av denne
 * kontrakten + NormalizedSignal — aldri av én konkret Trends-implementasjon.
 *
 * Planlagte implementasjoner (i rekkefølge, se Implementation Plan):
 *   ManualTrendImportProvider   — leser fra import-flyten (først)
 *   GoogleAdsKeywordProvider    — volum-proxy fra Keyword Planner
 *   GoogleTrendsAlphaProvider   — når alpha-tilgang er innvilget
 *   GoogleTrendsBigQueryProvider — kun hvis datasettet dekker norske behov
 *
 * Semantisk vakt: Google Trends-tall er relative (unit 'relative_index');
 * Keyword Planner-tall er absolutte ('searches_per_month'). Kontrakten bærer
 * unit eksplisitt så de aldri kan blandes umerket.
 */

import type { SignalSourceType } from "./normalized-signal-schema.js";

// ─────────────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────────────

export interface TrendRequestBase {
  organizationId: string;
  workspaceId: string;
  /** ISO 3166-1 alpha-2, f.eks. 'NO'. */
  country: string;
  periodStart: string; // ISO datetime
  periodEnd: string; // ISO datetime
}

export interface InterestOverTimeRequest extends TrendRequestBase {
  /** 1–5 termer (Google Trends-sammenlikningsgrense). */
  terms: string[];
  granularity: "day" | "week" | "month";
}

export interface InterestByRegionRequest extends TrendRequestBase {
  term: string;
  resolution: "country" | "region" | "city";
}

export interface RelatedQueryRequest extends TrendRequestBase {
  term: string;
  kind: "top" | "rising";
  limit?: number;
}

// ─────────────────────────────────────────────────────────────────────
// Normaliserte responser
// ─────────────────────────────────────────────────────────────────────

/**
 * Metadata som gjør UI-merkene (Live/Cached/Imported/…) og attribution
 * beregnbare — obligatorisk på alle responser (No Fake Integrations).
 */
export interface TrendResultMeta {
  providerId: string;
  sourceType: SignalSourceType;
  /** 'relative_index' (Trends) eller 'searches_per_month' (Keyword Planner). */
  unit: "relative_index" | "searches_per_month";
  collectedAt: string; // ISO datetime
  lastSuccessfulSync: string | null;
  isCached: boolean;
  isImported: boolean;
  isEstimated: boolean;
}

export interface TrendPoint {
  periodStart: string;
  periodEnd: string;
  value: number;
}

export interface NormalizedTrendSeries {
  meta: TrendResultMeta;
  series: Array<{ term: string; points: TrendPoint[] }>;
}

export interface NormalizedRegionalInterest {
  meta: TrendResultMeta;
  term: string;
  regions: Array<{
    /** Normalisert geo-nøkkel — for NO: kommunenr/fylkesnr der mulig. */
    geoKey: string;
    displayName: string;
    value: number;
  }>;
}

export interface NormalizedRelatedQueries {
  meta: TrendResultMeta;
  term: string;
  kind: "top" | "rising";
  queries: Array<{ query: string; value: number }>;
}

// ─────────────────────────────────────────────────────────────────────
// Capabilities + helse
// ─────────────────────────────────────────────────────────────────────

export interface ProviderCapabilities {
  providerId: string;
  supportsInterestOverTime: boolean;
  supportsInterestByRegion: boolean;
  supportsRelatedQueries: boolean;
  /** Land provideren faktisk dekker (tom = ukjent, ikke "alle"). */
  countries: string[];
  minGranularity: "day" | "week" | "month";
  maxTermsPerRequest: number;
  unit: "relative_index" | "searches_per_month";
  /** Menneskelesbar rate-beskrivelse for Admin Center. */
  rateLimitNote: string | null;
}

export interface IntegrationHealth {
  providerId: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  checkedAt: string; // ISO datetime
  lastSuccessfulSync: string | null;
  failureReason: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// Kontrakten
// ─────────────────────────────────────────────────────────────────────

export interface SearchTrendProvider {
  providerId: string;

  getInterestOverTime(request: InterestOverTimeRequest): Promise<NormalizedTrendSeries>;

  getInterestByRegion(request: InterestByRegionRequest): Promise<NormalizedRegionalInterest>;

  getRelatedQueries(request: RelatedQueryRequest): Promise<NormalizedRelatedQueries>;

  getProviderCapabilities(): Promise<ProviderCapabilities>;

  healthCheck(): Promise<IntegrationHealth>;
}
