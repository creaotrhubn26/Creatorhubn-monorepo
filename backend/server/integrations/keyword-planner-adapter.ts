/**
 * keyword-planner-adapter.ts
 *
 * Google Ads Keyword Planner → normalized_signals (integrasjonsplanen
 * steg 5, docs/integration-audit/06 — token avklart Basic Access
 * 2026-07-10). Eneste lovlige kilde til absolutt søkevolum.
 *
 * Krav fra capability-matrisen håndhevet her:
 *  - **Cache-først**: signaler ferskere enn CACHE_MAX_AGE_DAYS hentes fra
 *    normalized_signals i stedet for API-et (kø+cache-kravet — Basic
 *    Access er 15k ops/dag delt med resten av Ads-integrasjonen).
 *  - **Sekvensiell kø** med delay mellom API-kall.
 *  - **Semantisk vakt**: volum lagres som unit 'searches_per_month' med
 *    isEstimated=true (Googles bucketed estimater) — aldri blandbart med
 *    Trends' relative_index.
 *
 * Implementerer også SearchTrendProvider-kontrakten (GoogleAdsKeywordProvider
 * fra docs/integration-audit/03): 12-mnd historikk → interest-over-time
 * (absolutte tall), keyword ideas → related queries. Region-interesse
 * støttes ikke (capabilities sier det ærlig).
 */

import type { Pool } from "pg";
import { externalFetch } from "../external-api.js";
import { getAdsOauthConnection, ensureFreshAdsToken } from "../role-room-ads-oauth.js";
import { insertNormalizedSignals, queryNormalizedSignals } from "./normalized-signal-store.js";
import type { NormalizedSignal } from "./normalized-signal-schema.js";
import type {
  InterestOverTimeRequest,
  InterestByRegionRequest,
  RelatedQueryRequest,
  NormalizedTrendSeries,
  NormalizedRegionalInterest,
  NormalizedRelatedQueries,
  ProviderCapabilities,
  IntegrationHealth,
  SearchTrendProvider,
  TrendResultMeta,
} from "./search-trend-provider.js";

const ADS_API_BASE = "https://googleads.googleapis.com/v18";
/** geoTargetConstants/2578 = Norge (ISO 3166 numerisk 578). */
const GEO_TARGET_NORWAY = "geoTargetConstants/2578";
/** languageConstants/1013 = norsk i Google Ads' kriterium-katalog. */
const LANGUAGE_NORWEGIAN = "languageConstants/1013";

export const CACHE_MAX_AGE_DAYS = 30;
const REQUEST_DELAY_MS = 1_200;
const MAX_KEYWORDS_PER_REQUEST = 10; // generateKeywordIdeas-grense for keywordSeed

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────
// API-typer (delmengde av GenerateKeywordIdeaResult)
// ─────────────────────────────────────────────────────────────────────

export interface KeywordIdeaMetrics {
  avgMonthlySearches?: string;
  competition?: "LOW" | "MEDIUM" | "HIGH" | "UNSPECIFIED" | "UNKNOWN";
  competitionIndex?: string;
  lowTopOfPageBidMicros?: string;
  highTopOfPageBidMicros?: string;
  monthlySearchVolumes?: Array<{
    year: string;
    month: string; // 'JANUARY' | …
    monthlySearches?: string;
  }>;
}

export interface KeywordIdeaResult {
  text?: string;
  keywordIdeaMetrics?: KeywordIdeaMetrics;
}

const MONTH_NUMBER: Record<string, number> = {
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
};

// ─────────────────────────────────────────────────────────────────────
// Ren mapping: API-resultat → NormalizedSignals (enhetstestet)
// ─────────────────────────────────────────────────────────────────────

export interface KeywordSignalContext {
  organizationId: string;
  workspaceId: string;
  collectedAt: string; // ISO
}

const COMPETITION_SCORE: Record<string, number> = {
  LOW: 25, MEDIUM: 50, HIGH: 90,
};

export function keywordIdeasToSignals(
  ideas: KeywordIdeaResult[],
  ctx: KeywordSignalContext,
): NormalizedSignal[] {
  const signals: NormalizedSignal[] = [];
  const now = new Date(ctx.collectedAt);
  const periodEnd = ctx.collectedAt;
  const periodStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const common = {
    organizationId: ctx.organizationId,
    workspaceId: ctx.workspaceId,
    provider: "google-ads-keyword-planner",
    sourceType: "official_api" as const,
    subjectType: "keyword" as const,
    geography: { country: "NO" as const },
    confidence: 0.8,
    sourceQuality: 0.9,
    freshnessScore: 1,
    isEstimated: true, // Googles bucketed gjennomsnitt — estimat, ikke telling
    isNormalized: true,
    collectedAt: ctx.collectedAt,
    metadata: {},
  };

  for (const idea of ideas) {
    const keyword = idea.text?.trim().toLowerCase();
    const metrics = idea.keywordIdeaMetrics;
    if (!keyword || !metrics) continue;

    const avg = Number(metrics.avgMonthlySearches ?? NaN);
    if (Number.isFinite(avg)) {
      const recordId = `NO|${keyword}|search_volume_avg`;
      signals.push({
        ...common,
        id: `kwp:${recordId}|${ctx.collectedAt.slice(0, 10)}`,
        sourceRecordId: recordId,
        subjectId: keyword,
        topic: keyword,
        metricType: "search_volume_avg",
        metricValue: avg,
        unit: "searches_per_month",
        periodStart,
        periodEnd,
      });
    }

    const compIdx = Number(metrics.competitionIndex ?? NaN);
    const competition = Number.isFinite(compIdx)
      ? compIdx
      : COMPETITION_SCORE[metrics.competition ?? ""] ?? NaN;
    if (Number.isFinite(competition)) {
      const recordId = `NO|${keyword}|keyword_competition`;
      signals.push({
        ...common,
        id: `kwp:${recordId}|${ctx.collectedAt.slice(0, 10)}`,
        sourceRecordId: recordId,
        subjectId: keyword,
        topic: keyword,
        metricType: "keyword_competition",
        metricValue: competition,
        unit: "score",
        periodStart,
        periodEnd,
        metadata: { competitionBucket: metrics.competition ?? null },
      });
    }
  }

  return signals;
}

/** 12-mnd historikk → punktserie for SearchTrendProvider. */
export function monthlyVolumesToPoints(
  metrics: KeywordIdeaMetrics,
): Array<{ periodStart: string; periodEnd: string; value: number }> {
  const points = (metrics.monthlySearchVolumes ?? [])
    .map((mv) => {
      const month = MONTH_NUMBER[mv.month];
      const year = Number(mv.year);
      const value = Number(mv.monthlySearches ?? NaN);
      if (!month || !Number.isFinite(year) || !Number.isFinite(value)) return null;
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      return {
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        value,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  points.sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1));
  return points;
}

// ─────────────────────────────────────────────────────────────────────
// API-kall (sekvensiell kø)
// ─────────────────────────────────────────────────────────────────────

async function adsHeaders(pool: Pool, producerUserId: string): Promise<Record<string, string> | null> {
  const conn = await getAdsOauthConnection(pool, producerUserId, "google");
  if (!conn) return null;
  const t = await ensureFreshAdsToken(pool, conn);
  if (t.connectionState !== "connected") return null;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!developerToken) return null;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${t.accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim().replace(/-/g, "");
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;
  return headers;
}

async function generateKeywordIdeas(
  headers: Record<string, string>,
  customerId: string,
  keywords: string[],
): Promise<KeywordIdeaResult[]> {
  const r = await externalFetch(
    `${ADS_API_BASE}/customers/${customerId.replace(/-/g, "")}:generateKeywordIdeas`,
    {
      method: "POST",
      headers,
      timeoutMs: 20_000,
      body: JSON.stringify({
        geoTargetConstants: [GEO_TARGET_NORWAY],
        language: LANGUAGE_NORWEGIAN,
        includeAdultKeywords: false,
        keywordSeed: { keywords: keywords.slice(0, MAX_KEYWORDS_PER_REQUEST) },
        historicalMetricsOptions: { includeAverageCpc: false },
      }),
    },
  );
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`keyword_planner_http_${r.status}: ${detail.slice(0, 200)}`);
  }
  const body = (await r.json()) as { results?: KeywordIdeaResult[] };
  return body.results ?? [];
}

// ─────────────────────────────────────────────────────────────────────
// Cache-først-oppslag
// ─────────────────────────────────────────────────────────────────────

export interface KeywordDemandResult {
  keyword: string;
  avgMonthlySearches: number | null;
  competition: number | null;
  fromCache: boolean;
}

export interface LookupResult {
  results: KeywordDemandResult[];
  apiCalls: number;
  signalsInserted: number;
  skippedReason?: string;
}

export async function lookupKeywordDemand(
  pool: Pool,
  args: {
    producerUserId: string;
    organizationId: string;
    customerId?: string;
    keywords: string[];
  },
): Promise<LookupResult> {
  const keywords = [...new Set(args.keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 2))].slice(0, 50);
  const out: LookupResult = { results: [], apiCalls: 0, signalsInserted: 0 };
  if (keywords.length === 0) return out;

  // 1. Cache: ferske signaler fra normalized_signals
  const cacheCutoff = new Date(Date.now() - CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const cached = await queryNormalizedSignals(pool, {
    organizationId: args.organizationId,
    provider: "google-ads-keyword-planner",
    limit: 2000,
  });
  const fresh = new Map<string, { volume: number | null; competition: number | null }>();
  for (const s of cached) {
    if (s.collectedAt < cacheCutoff) continue;
    const entry = fresh.get(s.topic) ?? { volume: null, competition: null };
    if (s.metricType === "search_volume_avg") entry.volume = s.metricValue;
    if (s.metricType === "keyword_competition") entry.competition = s.metricValue;
    fresh.set(s.topic, entry);
  }

  const misses: string[] = [];
  for (const kw of keywords) {
    const hit = fresh.get(kw);
    if (hit && hit.volume !== null) {
      out.results.push({ keyword: kw, avgMonthlySearches: hit.volume, competition: hit.competition, fromCache: true });
    } else {
      misses.push(kw);
    }
  }
  if (misses.length === 0) return out;

  // 2. API for cache-misses (sekvensiell kø i batcher på 10)
  const headers = await adsHeaders(pool, args.producerUserId);
  if (!headers) {
    out.skippedReason = "mangler Google Ads-credentials (OAuth + developer token)";
    return out;
  }
  const customerId = args.customerId?.trim()
    || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim()
    || "";
  if (!customerId) {
    out.skippedReason = "mangler customerId (GOOGLE_ADS_LOGIN_CUSTOMER_ID)";
    return out;
  }

  const collectedAt = new Date().toISOString();
  const allSignals: NormalizedSignal[] = [];

  for (let i = 0; i < misses.length; i += MAX_KEYWORDS_PER_REQUEST) {
    if (i > 0) await sleep(REQUEST_DELAY_MS);
    const batch = misses.slice(i, i + MAX_KEYWORDS_PER_REQUEST);
    const ideas = await generateKeywordIdeas(headers, customerId, batch);
    out.apiCalls++;

    // generateKeywordIdeas returnerer også relaterte forslag — vi lagrer
    // alt (gratis beriking), men svarer kun på de etterspurte ordene.
    const signals = keywordIdeasToSignals(ideas, {
      organizationId: args.organizationId,
      workspaceId: args.producerUserId,
      collectedAt,
    });
    allSignals.push(...signals);

    const byKeyword = new Map(ideas.map((idea) => [idea.text?.trim().toLowerCase(), idea]));
    for (const kw of batch) {
      const idea = byKeyword.get(kw);
      const m = idea?.keywordIdeaMetrics;
      out.results.push({
        keyword: kw,
        avgMonthlySearches: m?.avgMonthlySearches != null ? Number(m.avgMonthlySearches) : null,
        competition: m?.competitionIndex != null ? Number(m.competitionIndex) : null,
        fromCache: false,
      });
    }
  }

  if (allSignals.length > 0) {
    const r = await insertNormalizedSignals(pool, allSignals);
    out.signalsInserted = r.inserted;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// SearchTrendProvider-implementasjon
// ─────────────────────────────────────────────────────────────────────

export class GoogleAdsKeywordProvider implements SearchTrendProvider {
  providerId = "google-ads-keyword-planner";

  constructor(
    private pool: Pool,
    private producerUserId: string,
    private customerId?: string,
  ) {}

  private meta(collectedAt: string): TrendResultMeta {
    return {
      providerId: this.providerId,
      sourceType: "official_api",
      unit: "searches_per_month",
      collectedAt,
      lastSuccessfulSync: collectedAt,
      isCached: false,
      isImported: false,
      isEstimated: true,
    };
  }

  async getInterestOverTime(request: InterestOverTimeRequest): Promise<NormalizedTrendSeries> {
    const headers = await adsHeaders(this.pool, this.producerUserId);
    if (!headers) throw new Error("keyword_planner_not_configured");
    const customerId = this.customerId || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "";
    const ideas = await generateKeywordIdeas(headers, customerId, request.terms);
    const collectedAt = new Date().toISOString();
    const byKeyword = new Map(ideas.map((i) => [i.text?.trim().toLowerCase(), i]));
    return {
      meta: this.meta(collectedAt),
      series: request.terms.map((term) => ({
        term,
        points: monthlyVolumesToPoints(
          byKeyword.get(term.trim().toLowerCase())?.keywordIdeaMetrics ?? {},
        ),
      })),
    };
  }

  async getInterestByRegion(_request: InterestByRegionRequest): Promise<NormalizedRegionalInterest> {
    throw new Error("keyword_planner_no_regional_interest"); // capabilities sier false
  }

  async getRelatedQueries(request: RelatedQueryRequest): Promise<NormalizedRelatedQueries> {
    const headers = await adsHeaders(this.pool, this.producerUserId);
    if (!headers) throw new Error("keyword_planner_not_configured");
    const customerId = this.customerId || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "";
    const ideas = await generateKeywordIdeas(headers, customerId, [request.term]);
    const collectedAt = new Date().toISOString();
    const queries = ideas
      .filter((i) => i.text && i.text.trim().toLowerCase() !== request.term.trim().toLowerCase())
      .map((i) => ({ query: i.text as string, value: Number(i.keywordIdeaMetrics?.avgMonthlySearches ?? 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, request.limit ?? 25);
    return { meta: this.meta(collectedAt), term: request.term, kind: request.kind, queries };
  }

  async getProviderCapabilities(): Promise<ProviderCapabilities> {
    return {
      providerId: this.providerId,
      supportsInterestOverTime: true,
      supportsInterestByRegion: false,
      supportsRelatedQueries: true,
      countries: ["NO"],
      minGranularity: "month",
      maxTermsPerRequest: MAX_KEYWORDS_PER_REQUEST,
      unit: "searches_per_month",
      rateLimitNote: "Basic Access 15k ops/dag delt med Ads-integrasjonen — cache-først (30d) + sekvensiell kø",
    };
  }

  async healthCheck(): Promise<IntegrationHealth> {
    const headers = await adsHeaders(this.pool, this.producerUserId);
    return {
      providerId: this.providerId,
      status: headers ? "healthy" : "down",
      checkedAt: new Date().toISOString(),
      lastSuccessfulSync: null,
      failureReason: headers ? null : "mangler OAuth-tilkobling eller developer token",
    };
  }
}
