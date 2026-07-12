/**
 * manual-import-service.ts
 *
 * Manuell CSV-import → normalized_signals (integrasjonsplanen steg 4,
 * docs/integration-audit/05 §4). Førsteklasses datakilde — ikke mockdata:
 * alt valideres mot NormalizedSignal-kontrakten, dedup skjer mot
 * unique-indeksen i 0376, og lineage bevares via import_batches +
 * metadata.importBatchId.
 *
 * To modi:
 *  - 'google-trends-csv': gjenkjenner Google Trends-eksport (header-linjer
 *    + «Uke,term: (Norge)»-kolonner) og normaliserer til relative_interest
 *    (unit relative_index) per term/uke.
 *  - 'generic': kolonnemapping (topic/metricValue/periodStart[/metricType/
 *    unit]) foreslått av kolonnedeteksjon, overstyrbar av bruker.
 */

import Papa from "papaparse";
import type { Pool } from "pg";
import {
  type NormalizedSignal,
  SIGNAL_UNITS,
  validateNormalizedSignal,
} from "./normalized-signal-schema.js";
import { insertNormalizedSignals } from "./normalized-signal-store.js";

export type ImportPreset = "google-trends-csv" | "generic";

export interface ColumnMapping {
  topic?: string;
  metricValue?: string;
  periodStart?: string;
  metricType?: string; // konstant eller kolonnenavn
  unit?: (typeof SIGNAL_UNITS)[number];
}

export interface ImportMeta {
  organizationId: string;
  workspaceOwnerUserId: string;
  provider?: string; // default manual-trend-import
  filename?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Google Trends-preset
// ─────────────────────────────────────────────────────────────────────

/**
 * Google Trends-eksport ser slik ut (nb-locale):
 *   Kategori: Alle kategorier
 *   <blank>
 *   Uke,"leadgenerering: (Norge)","crm system: (Norge)"
 *   2025-07-13,45,62
 * Detekter ved 'Uke,'/'Week,'/'Måned,'/'Month,'-header etter preamble.
 */
export function detectGoogleTrendsCsv(csvText: string): boolean {
  const lines = csvText.split(/\r?\n/).slice(0, 6);
  return lines.some((l) => /^(uke|week|måned|month|dag|day)[,;]/i.test(l.trim()));
}

export function parseGoogleTrendsCsv(csvText: string): {
  terms: string[];
  rows: Array<{ period: string; values: Array<number | null> }>;
  granularity: "day" | "week" | "month";
} {
  const lines = csvText.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => /^(uke|week|måned|month|dag|day)[,;]/i.test(l.trim()));
  if (headerIdx === -1) throw new Error("google_trends_header_not_found");
  const delimiter = lines[headerIdx].includes(";") ? ";" : ",";
  const parsed = Papa.parse<string[]>(lines.slice(headerIdx).join("\n"), {
    delimiter,
    skipEmptyLines: true,
  });
  const [header, ...rows] = parsed.data;
  const first = header[0].trim().toLowerCase();
  const granularity = /måned|month/.test(first) ? "month" : /dag|day/.test(first) ? "day" : "week";
  // «term: (Norge)» → «term»
  const terms = header.slice(1).map((h) => h.replace(/:\s*\([^)]*\)\s*$/, "").trim().toLowerCase());
  return {
    terms,
    granularity,
    rows: rows
      .filter((r) => r[0]?.trim())
      .map((r) => ({
        period: r[0].trim(),
        values: r.slice(1).map((v) => {
          if (!v || !v.trim()) return null; // tom celle ≠ 0
          // Trends bruker '<1' for lav interesse
          if (v.trim() === "<1") return 0;
          const n = Number(v);
          return Number.isFinite(n) ? n : null;
        }),
      })),
  };
}

function periodBounds(period: string, granularity: "day" | "week" | "month"): { start: string; end: string } | null {
  // Trends-perioder: '2025-07-13' (uke/dag) eller '2025-07' (måned)
  const m = period.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = m[3] ? Number(m[3]) : 1;
  const start = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(start.getTime())) return null;
  let end: Date;
  if (granularity === "month") end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  else if (granularity === "week") end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  else end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function googleTrendsToSignals(
  csvText: string,
  meta: ImportMeta & { collectedAt: string },
): { signals: NormalizedSignal[]; rejectedRows: number } {
  const { terms, rows, granularity } = parseGoogleTrendsCsv(csvText);
  const provider = meta.provider ?? "manual-trend-import";
  const signals: NormalizedSignal[] = [];
  let rejected = 0;

  for (const row of rows) {
    const bounds = periodBounds(row.period, granularity);
    if (!bounds) { rejected++; continue; }
    row.values.forEach((value, i) => {
      const term = terms[i];
      if (value === null || !term) return;
      const recordId = `NO|${term}|relative_interest|${row.period}`;
      signals.push({
        id: `import:${recordId}`,
        organizationId: meta.organizationId,
        workspaceId: meta.workspaceOwnerUserId,
        provider,
        sourceType: "manual_upload",
        sourceRecordId: recordId,
        subjectType: "keyword",
        subjectId: term,
        topic: term,
        metricType: "relative_interest",
        metricValue: value,
        unit: "relative_index",
        geography: { country: "NO" },
        periodStart: bounds.start,
        periodEnd: bounds.end,
        confidence: 0.7,
        sourceQuality: 0.8,
        freshnessScore: 1,
        isEstimated: true, // relative indekser er Googles estimat
        isNormalized: true,
        collectedAt: meta.collectedAt,
        metadata: { importPreset: "google-trends-csv", granularity },
      });
    });
  }
  return { signals, rejectedRows: rejected };
}

// ─────────────────────────────────────────────────────────────────────
// Generisk CSV med kolonnedeteksjon
// ─────────────────────────────────────────────────────────────────────

const TOPIC_HINTS = ["topic", "term", "søkeord", "sokeord", "keyword", "emne", "navn"];
const VALUE_HINTS = ["value", "verdi", "interesse", "antall", "count", "volume", "volum", "sessions"];
const PERIOD_HINTS = ["date", "dato", "uke", "week", "måned", "month", "period", "periode"];

export function suggestMapping(headers: string[]): ColumnMapping {
  const find = (hints: string[]) =>
    headers.find((h) => hints.some((hint) => h.trim().toLowerCase().includes(hint)));
  return {
    topic: find(TOPIC_HINTS),
    metricValue: find(VALUE_HINTS),
    periodStart: find(PERIOD_HINTS),
    unit: "count",
  };
}

export function genericCsvToSignals(
  csvText: string,
  mapping: ColumnMapping,
  meta: ImportMeta & { collectedAt: string },
): { signals: NormalizedSignal[]; rejectedRows: number; errors: string[] } {
  if (!mapping.topic || !mapping.metricValue || !mapping.periodStart) {
    return { signals: [], rejectedRows: 0, errors: ["mapping krever topic, metricValue og periodStart"] };
  }
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const provider = meta.provider ?? "manual-trend-import";
  const metricType = mapping.metricType ?? "imported_value";
  const unit = mapping.unit ?? "count";
  const signals: NormalizedSignal[] = [];
  const errors: string[] = [];
  let rejected = 0;

  for (const row of parsed.data) {
    const topic = row[mapping.topic]?.trim().toLowerCase();
    const value = Number(row[mapping.metricValue]);
    const bounds = periodBounds(String(row[mapping.periodStart] ?? "").trim(), "day")
      ?? periodBounds(String(row[mapping.periodStart] ?? "").trim(), "month");
    if (!topic || !Number.isFinite(value) || !bounds) { rejected++; continue; }

    const recordId = `${topic}|${metricType}|${row[mapping.periodStart].trim()}`;
    const signal: NormalizedSignal = {
      id: `import:${recordId}`,
      organizationId: meta.organizationId,
      workspaceId: meta.workspaceOwnerUserId,
      provider,
      sourceType: "manual_upload",
      sourceRecordId: recordId,
      subjectType: "keyword",
      subjectId: topic,
      topic,
      metricType,
      metricValue: value,
      unit,
      periodStart: bounds.start,
      periodEnd: bounds.end,
      confidence: 0.7,
      sourceQuality: 0.7,
      freshnessScore: 1,
      isEstimated: false,
      isNormalized: true,
      collectedAt: meta.collectedAt,
      metadata: { importPreset: "generic" },
    };
    const v = validateNormalizedSignal(signal);
    if (!v.valid) { rejected++; errors.push(...(v.errors ?? []).slice(0, 2)); continue; }
    signals.push(signal);
  }
  return { signals, rejectedRows: rejected, errors: [...new Set(errors)].slice(0, 5) };
}

// ─────────────────────────────────────────────────────────────────────
// Preview + commit
// ─────────────────────────────────────────────────────────────────────

export interface PreviewResult {
  preset: ImportPreset;
  headers: string[];
  suggestedMapping: ColumnMapping | null;
  rowCount: number;
  sampleSignals: NormalizedSignal[];
  rejectedRows: number;
  errors: string[];
}

export function previewImport(
  csvText: string,
  meta: ImportMeta,
  mapping?: ColumnMapping,
): PreviewResult {
  const collectedAt = new Date().toISOString();
  if (detectGoogleTrendsCsv(csvText)) {
    const { terms } = parseGoogleTrendsCsv(csvText);
    const { signals, rejectedRows } = googleTrendsToSignals(csvText, { ...meta, collectedAt });
    return {
      preset: "google-trends-csv",
      headers: ["periode", ...terms],
      suggestedMapping: null,
      rowCount: signals.length,
      sampleSignals: signals.slice(0, 10),
      rejectedRows,
      errors: [],
    };
  }
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, preview: 1 });
  const headers = parsed.meta.fields ?? [];
  const effectiveMapping = mapping ?? suggestMapping(headers);
  const { signals, rejectedRows, errors } = genericCsvToSignals(csvText, effectiveMapping, { ...meta, collectedAt });
  return {
    preset: "generic",
    headers,
    suggestedMapping: effectiveMapping,
    rowCount: signals.length,
    sampleSignals: signals.slice(0, 10),
    rejectedRows,
    errors,
  };
}

export interface CommitResult {
  batchId: string;
  preset: ImportPreset;
  rowCount: number;
  inserted: number;
  skippedDuplicates: number;
  rejectedRows: number;
}

export async function commitImport(
  pool: Pool,
  csvText: string,
  meta: ImportMeta,
  mapping?: ColumnMapping,
): Promise<CommitResult> {
  const collectedAt = new Date().toISOString();
  const provider = meta.provider ?? "manual-trend-import";

  let preset: ImportPreset;
  let signals: NormalizedSignal[];
  let rejectedRows: number;
  if (detectGoogleTrendsCsv(csvText)) {
    preset = "google-trends-csv";
    ({ signals, rejectedRows } = googleTrendsToSignals(csvText, { ...meta, collectedAt }));
  } else {
    preset = "generic";
    const effective = mapping ?? suggestMapping(Papa.parse<Record<string, string>>(csvText, { header: true, preview: 1 }).meta.fields ?? []);
    const r = genericCsvToSignals(csvText, effective, { ...meta, collectedAt });
    signals = r.signals;
    rejectedRows = r.rejectedRows;
    if (signals.length === 0) throw new Error(`import_empty: ${r.errors.join("; ") || "ingen gyldige rader"}`);
  }
  if (signals.length === 0) throw new Error("import_empty");

  const batch = await pool.query<{ id: string }>(
    `INSERT INTO import_batches (
       organization_id, workspace_owner_user_id, provider, source_type,
       filename, preset, column_mapping, row_count
     ) VALUES ($1::uuid, $2, $3, 'manual_upload', $4, $5, $6::jsonb, $7)
     RETURNING id::text`,
    [
      meta.organizationId, meta.workspaceOwnerUserId, provider,
      meta.filename ?? null, preset, JSON.stringify(mapping ?? {}), signals.length,
    ],
  );
  const batchId = batch.rows[0].id;

  const withLineage = signals.map((s) => ({
    ...s,
    metadata: { ...s.metadata, importBatchId: batchId },
  }));
  const result = await insertNormalizedSignals(pool, withLineage);

  await pool.query(
    `UPDATE import_batches
        SET inserted_count = $2, skipped_duplicates = $3, rejected_rows = $4
      WHERE id = $1::uuid`,
    [batchId, result.inserted, result.skippedDuplicates, rejectedRows],
  );

  return {
    batchId,
    preset,
    rowCount: signals.length,
    inserted: result.inserted,
    skippedDuplicates: result.skippedDuplicates,
    rejectedRows,
  };
}
