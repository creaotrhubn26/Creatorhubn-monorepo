/**
 * ga4-signal-normalizer.ts
 *
 * Ren normalisering: GA4 Data API runReport-respons → NormalizedSignal[]
 * (integrasjonsanalysen steg 3). Ingen HTTP — input er respons-formen
 * `client-insights-service.ts` allerede henter.
 *
 * Kun metrikker med kjent enhet normaliseres (lukket unit-sett i
 * kontrakten); ukjente metrikker hoppes over og rapporteres i resultatet
 * i stedet for å gjettes («No silent caps»-prinsippet).
 */

import type { NormalizedSignal } from "./normalized-signal-schema.js";

export interface Ga4RunReportResponse {
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string }>;
  rows?: Array<{
    dimensionValues?: Array<{ value: string }>;
    metricValues?: Array<{ value: string }>;
  }>;
}

export interface Ga4NormalizeContext {
  organizationId: string;
  workspaceId: string;
  projectId?: string;
  propertyId: string;
  periodStart: string; // ISO datetime
  periodEnd: string; // ISO datetime
  collectedAt: string; // ISO datetime
}

/** GA4-metrikk → kontraktens (metricType, unit). Utvid bevisst. */
const GA4_METRIC_MAP: Record<string, { metricType: string; unit: NormalizedSignal["unit"] }> = {
  sessions: { metricType: "sessions", unit: "sessions" },
  totalUsers: { metricType: "total_users", unit: "count" },
  newUsers: { metricType: "new_users", unit: "count" },
  engagedSessions: { metricType: "engaged_sessions", unit: "sessions" },
  averageSessionDuration: { metricType: "avg_session_duration", unit: "seconds" },
  conversions: { metricType: "conversions", unit: "count" },
  screenPageViews: { metricType: "page_views", unit: "count" },
};

export interface Ga4NormalizeResult {
  signals: NormalizedSignal[];
  /** Metrikker i responsen uten unit-mapping — logg/utvid, aldri gjett. */
  skippedMetrics: string[];
}

export function normalizeGa4RunReport(
  report: Ga4RunReportResponse,
  ctx: Ga4NormalizeContext,
): Ga4NormalizeResult {
  const metricHeaders = report.metricHeaders ?? [];
  const dimensionHeaders = report.dimensionHeaders ?? [];
  const rows = report.rows ?? [];

  const signals: NormalizedSignal[] = [];
  const skipped = new Set<string>();

  for (const row of rows) {
    // Dimensjonsverdier blir del av topic + record-id (f.eks. kanal)
    const dimParts = (row.dimensionValues ?? []).map(
      (d, i) => `${dimensionHeaders[i]?.name ?? `dim${i}`}=${d.value}`,
    );
    const dimKey = dimParts.join(",");
    const topic = dimKey || ctx.propertyId;

    (row.metricValues ?? []).forEach((mv, i) => {
      const headerName = metricHeaders[i]?.name;
      if (!headerName) return;
      const mapping = GA4_METRIC_MAP[headerName];
      if (!mapping) {
        skipped.add(headerName);
        return;
      }
      const value = Number(mv.value);
      if (!Number.isFinite(value)) return;

      const sourceRecordId = `${ctx.propertyId}|${dimKey || "total"}|${mapping.metricType}`;
      signals.push({
        id: `ga4:${sourceRecordId}|${ctx.periodStart}`,
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        projectId: ctx.projectId,
        provider: "ga4-data-api",
        sourceType: "official_api",
        sourceRecordId,
        subjectType: "own_property",
        subjectId: ctx.propertyId,
        topic,
        metricType: mapping.metricType,
        metricValue: value,
        unit: mapping.unit,
        periodStart: ctx.periodStart,
        periodEnd: ctx.periodEnd,
        confidence: 1,
        sourceQuality: 1,
        freshnessScore: 1,
        isEstimated: false,
        isNormalized: true,
        collectedAt: ctx.collectedAt,
        metadata: dimKey ? { dimensions: dimKey } : {},
      });
    });
  }

  return { signals, skippedMetrics: [...skipped] };
}
