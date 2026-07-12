/**
 * manual-trend-import-provider.ts
 *
 * ManualTrendImportProvider — SearchTrendProvider-implementasjon som
 * leser BRUKERIMPORTERTE Trends-data fra normalized_signals
 * (provider='manual-trend-import', importert via manual-import-service).
 *
 * Dette er fallback-kilden i Trends-kjeden (docs/integration-audit/03)
 * frem til alpha-tilgang innvilges: importerte data er førsteklasses,
 * og merkes ærlig som Imported (sourceType manual_upload) i all visning.
 */

import type { Pool } from "pg";
import { queryNormalizedSignals } from "./normalized-signal-store.js";
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
} from "./search-trend-provider.js";

export class ManualTrendImportProvider implements SearchTrendProvider {
  providerId = "manual-trend-import";

  constructor(private pool: Pool, private organizationId: string) {}

  async getInterestOverTime(request: InterestOverTimeRequest): Promise<NormalizedTrendSeries> {
    const signals = await queryNormalizedSignals(this.pool, {
      organizationId: this.organizationId,
      provider: this.providerId,
      metricType: "relative_interest",
      periodStart: request.periodStart,
      periodEnd: request.periodEnd,
      limit: 5000,
    });
    const wanted = new Set(request.terms.map((t) => t.trim().toLowerCase()));
    const newest = signals.reduce<string | null>(
      (acc, s) => (acc === null || s.collectedAt > acc ? s.collectedAt : acc),
      null,
    );
    return {
      meta: {
        providerId: this.providerId,
        sourceType: "manual_upload",
        unit: "relative_index",
        collectedAt: new Date().toISOString(),
        lastSuccessfulSync: newest,
        isCached: false,
        isImported: true,
        isEstimated: true,
      },
      series: request.terms.map((term) => {
        const key = term.trim().toLowerCase();
        const points = signals
          .filter((s) => wanted.has(key) && s.topic === key)
          .map((s) => ({ periodStart: s.periodStart, periodEnd: s.periodEnd, value: s.metricValue }))
          .sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1));
        return { term, points };
      }),
    };
  }

  async getInterestByRegion(_request: InterestByRegionRequest): Promise<NormalizedRegionalInterest> {
    throw new Error("manual_import_no_regional_interest"); // ikke i Trends-CSV-eksporten
  }

  async getRelatedQueries(_request: RelatedQueryRequest): Promise<NormalizedRelatedQueries> {
    throw new Error("manual_import_no_related_queries");
  }

  async getProviderCapabilities(): Promise<ProviderCapabilities> {
    return {
      providerId: this.providerId,
      supportsInterestOverTime: true,
      supportsInterestByRegion: false,
      supportsRelatedQueries: false,
      countries: ["NO"],
      minGranularity: "day",
      maxTermsPerRequest: 25,
      unit: "relative_index",
      rateLimitNote: "Ingen — leser fra importerte data i normalized_signals",
    };
  }

  async healthCheck(): Promise<IntegrationHealth> {
    try {
      const signals = await queryNormalizedSignals(this.pool, {
        organizationId: this.organizationId,
        provider: this.providerId,
        limit: 1,
      });
      return {
        providerId: this.providerId,
        status: signals.length > 0 ? "healthy" : "degraded",
        checkedAt: new Date().toISOString(),
        lastSuccessfulSync: signals[0]?.collectedAt ?? null,
        failureReason: signals.length > 0 ? null : "ingen importerte trend-data ennå",
      };
    } catch (err) {
      return {
        providerId: this.providerId,
        status: "down",
        checkedAt: new Date().toISOString(),
        lastSuccessfulSync: null,
        failureReason: String(err).slice(0, 150),
      };
    }
  }
}
