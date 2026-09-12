/**
 * gsc-signal-normalizer.ts
 *
 * Ren normalisering: Google Search Console searchAnalytics-rader →
 * NormalizedSignal[] (integrasjonsanalysen steg 3). Ingen HTTP her —
 * input er responsen `client-insights-service.ts` allerede henter
 * (dimensions: ['date'] eller ['query']), så normalisereren kan brukes
 * både fra dagens on-demand-flyt og en fremtidig scheduled sync.
 *
 * Semantikk (kontrakt-regler fra docs/integration-audit/02 §3):
 *  * subjectType 'own_property' — GSC er brukerens egne data, aldri
 *    markedsdata.
 *  * Deterministiske id-er ('gsc:<site>|<nøkkel>|<metrikk>|<periode>')
 *    → idempotent re-sync via storens ON CONFLICT DO NOTHING.
 *  * ctr er 0–1 fra API-et → lagres som percent (0–100) med unit
 *    'percent'; position lagres med unit 'score'.
 */

import type { NormalizedSignal } from "./normalized-signal-schema.js";

export interface GscSearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscNormalizeContext {
  organizationId: string;
  workspaceId: string;
  projectId?: string;
  /** GSC-property, f.eks. 'sc-domain:example.com' eller full URL. */
  siteUrl: string;
  /** 'date' → én rad per dag; 'query' → én rad per søkefrase. */
  dimension: "date" | "query";
  /** Perioden requesten dekket — brukes når dimension='query'. */
  periodStart: string; // ISO datetime
  periodEnd: string; // ISO datetime
  collectedAt: string; // ISO datetime
}

const METRICS = [
  { metricType: "owned_clicks", unit: "clicks", pick: (r: GscSearchAnalyticsRow) => r.clicks },
  { metricType: "owned_impressions", unit: "impressions", pick: (r: GscSearchAnalyticsRow) => r.impressions },
  { metricType: "owned_ctr", unit: "percent", pick: (r: GscSearchAnalyticsRow) => r.ctr * 100 },
  { metricType: "owned_position", unit: "score", pick: (r: GscSearchAnalyticsRow) => r.position },
] as const;

function dayPeriod(dateKey: string): { start: string; end: string } {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function normalizeGscSearchAnalytics(
  rows: GscSearchAnalyticsRow[],
  ctx: GscNormalizeContext,
): NormalizedSignal[] {
  const signals: NormalizedSignal[] = [];

  for (const row of rows) {
    const key = row.keys[0];
    if (!key) continue;

    const period =
      ctx.dimension === "date"
        ? dayPeriod(key)
        : { start: ctx.periodStart, end: ctx.periodEnd };
    const topic = ctx.dimension === "query" ? key : ctx.siteUrl;

    for (const m of METRICS) {
      const sourceRecordId = `${ctx.siteUrl}|${ctx.dimension}:${key}|${m.metricType}`;
      signals.push({
        id: `gsc:${sourceRecordId}|${period.start}`,
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        projectId: ctx.projectId,
        provider: "google-search-console",
        sourceType: "official_api",
        sourceRecordId,
        subjectType: "own_property",
        subjectId: ctx.siteUrl,
        topic,
        metricType: m.metricType,
        metricValue: m.pick(row),
        unit: m.unit,
        periodStart: period.start,
        periodEnd: period.end,
        confidence: 1,
        sourceQuality: 1,
        freshnessScore: 1,
        isEstimated: false,
        isNormalized: true,
        collectedAt: ctx.collectedAt,
        metadata: { dimension: ctx.dimension },
      });
    }
  }

  return signals;
}
