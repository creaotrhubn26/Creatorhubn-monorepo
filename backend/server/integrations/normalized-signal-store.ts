/**
 * normalized-signal-store.ts
 *
 * Skrive-/lese-laget for normalized_signals (migrasjon 0376).
 * Integrasjonsanalysen steg 3 — docs/integration-audit/05.
 *
 * Regler håndhevet her:
 *  * Alle signaler valideres mot Zod-kontrakten FØR insert — ugyldige
 *    rader (f.eks. ulovlig sourceType) avvises samlet, ingenting skrives.
 *  * Insert er idempotent: deterministisk id (PK) + dedup-indeksen gjør
 *    at re-sync av samme periode blir no-op (ON CONFLICT DO NOTHING).
 *  * Query er ALLTID org-scopet — organizationId er påkrevd parameter,
 *    aldri valgfri.
 */

import type { Pool } from "pg";
import {
  type NormalizedSignal,
  validateNormalizedSignal,
} from "./normalized-signal-schema.js";

export interface InsertResult {
  inserted: number;
  skippedDuplicates: number;
}

export async function insertNormalizedSignals(
  pool: Pool,
  signals: NormalizedSignal[],
): Promise<InsertResult> {
  if (signals.length === 0) return { inserted: 0, skippedDuplicates: 0 };

  // Valider alt først — én ugyldig rad avviser hele batchen slik at en
  // adapter-bug ikke skriver delvis/skjev data stille.
  const errors: string[] = [];
  for (const s of signals) {
    const r = validateNormalizedSignal(s);
    if (!r.valid) errors.push(`${s.id ?? "<uten id>"}: ${r.errors?.join(", ")}`);
  }
  if (errors.length > 0) {
    throw new Error(`[normalized-signal-store] ${errors.length} ugyldige signaler: ${errors.slice(0, 5).join(" | ")}`);
  }

  let inserted = 0;
  for (const s of signals) {
    const r = await pool.query(
      `INSERT INTO normalized_signals (
         id, organization_id, workspace_id, project_id,
         provider, source_type, source_record_id,
         subject_type, subject_id, topic,
         metric_type, metric_value, unit,
         geo_country, geo_region, geo_city, geo_postal_code,
         period_start, period_end,
         confidence, source_quality, freshness_score,
         is_estimated, is_normalized,
         collected_at, source_updated_at, metadata
       ) VALUES (
         $1, $2::uuid, $3, $4,
         $5, $6, $7,
         $8, $9, $10,
         $11, $12, $13,
         $14, $15, $16, $17,
         $18::timestamptz, $19::timestamptz,
         $20, $21, $22,
         $23, $24,
         $25::timestamptz, $26::timestamptz, $27::jsonb
       )
       ON CONFLICT DO NOTHING`,
      [
        s.id, s.organizationId, s.workspaceId, s.projectId ?? null,
        s.provider, s.sourceType, s.sourceRecordId ?? null,
        s.subjectType, s.subjectId ?? null, s.topic,
        s.metricType, s.metricValue, s.unit,
        s.geography?.country ?? null, s.geography?.region ?? null,
        s.geography?.city ?? null, s.geography?.postalCode ?? null,
        s.periodStart, s.periodEnd,
        s.confidence, s.sourceQuality, s.freshnessScore,
        s.isEstimated, s.isNormalized,
        s.collectedAt, s.sourceUpdatedAt ?? null, JSON.stringify(s.metadata),
      ],
    );
    inserted += r.rowCount ?? 0;
  }

  return { inserted, skippedDuplicates: signals.length - inserted };
}

export interface QuerySignalsArgs {
  organizationId: string; // påkrevd — tenant-scoping er ikke valgfritt
  workspaceId?: string;
  provider?: string;
  topic?: string;
  metricType?: string;
  subjectType?: NormalizedSignal["subjectType"];
  periodStart?: string; // ISO — signaler med period_end >= denne
  periodEnd?: string; // ISO — signaler med period_start <= denne
  limit?: number;
}

interface SignalRow {
  id: string;
  organization_id: string;
  workspace_id: string;
  project_id: string | null;
  provider: string;
  source_type: NormalizedSignal["sourceType"];
  source_record_id: string | null;
  subject_type: NormalizedSignal["subjectType"];
  subject_id: string | null;
  topic: string;
  metric_type: string;
  metric_value: number;
  unit: NormalizedSignal["unit"];
  geo_country: string | null;
  geo_region: string | null;
  geo_city: string | null;
  geo_postal_code: string | null;
  period_start: Date | string;
  period_end: Date | string;
  confidence: number;
  source_quality: number;
  freshness_score: number;
  is_estimated: boolean;
  is_normalized: boolean;
  collected_at: Date | string;
  source_updated_at: Date | string | null;
  metadata: Record<string, unknown>;
}

/** pg gir TIMESTAMPTZ som Date; normaliser til ISO-8601 (kontraktens format). */
function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToSignal(r: SignalRow): NormalizedSignal {
  const geography =
    r.geo_country || r.geo_region || r.geo_city || r.geo_postal_code
      ? {
          country: r.geo_country ?? undefined,
          region: r.geo_region ?? undefined,
          city: r.geo_city ?? undefined,
          postalCode: r.geo_postal_code ?? undefined,
        }
      : undefined;
  return {
    id: r.id,
    organizationId: r.organization_id,
    workspaceId: r.workspace_id,
    projectId: r.project_id ?? undefined,
    provider: r.provider,
    sourceType: r.source_type,
    sourceRecordId: r.source_record_id ?? undefined,
    subjectType: r.subject_type,
    subjectId: r.subject_id ?? undefined,
    topic: r.topic,
    metricType: r.metric_type,
    metricValue: Number(r.metric_value),
    unit: r.unit,
    geography,
    periodStart: toIso(r.period_start),
    periodEnd: toIso(r.period_end),
    confidence: Number(r.confidence),
    sourceQuality: Number(r.source_quality),
    freshnessScore: Number(r.freshness_score),
    isEstimated: r.is_estimated,
    isNormalized: r.is_normalized,
    collectedAt: toIso(r.collected_at),
    sourceUpdatedAt: r.source_updated_at != null ? toIso(r.source_updated_at) : undefined,
    metadata: r.metadata ?? {},
  };
}

export async function queryNormalizedSignals(
  pool: Pool,
  args: QuerySignalsArgs,
): Promise<NormalizedSignal[]> {
  if (!args.organizationId) {
    throw new Error("[normalized-signal-store] organizationId er påkrevd");
  }

  const conditions = ["organization_id = $1::uuid"];
  const params: unknown[] = [args.organizationId];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    conditions.push(sql.replace("?", `$${params.length}`));
  };

  if (args.workspaceId) add("workspace_id = ?", args.workspaceId);
  if (args.provider) add("provider = ?", args.provider);
  if (args.topic) add("topic = ?", args.topic);
  if (args.metricType) add("metric_type = ?", args.metricType);
  if (args.subjectType) add("subject_type = ?", args.subjectType);
  if (args.periodStart) add("period_end >= ?::timestamptz", args.periodStart);
  if (args.periodEnd) add("period_start <= ?::timestamptz", args.periodEnd);

  params.push(Math.min(args.limit ?? 500, 5000));
  const r = await pool.query<SignalRow>(
    `SELECT id, organization_id::text, workspace_id, project_id,
            provider, source_type, source_record_id,
            subject_type, subject_id, topic,
            metric_type, metric_value, unit,
            geo_country, geo_region, geo_city, geo_postal_code,
            period_start, period_end,
            confidence, source_quality, freshness_score,
            is_estimated, is_normalized,
            collected_at, source_updated_at, metadata
       FROM normalized_signals
      WHERE ${conditions.join(" AND ")}
      ORDER BY period_start DESC
      LIMIT $${params.length}`,
    params,
  );
  return r.rows.map(rowToSignal);
}
