/**
 * launch-timing.ts — Lanseringsvindu-motoren
 * (Daniels bestilling: «lansering handler om riktig timing»)
 *
 * Fire timing-signaler, hvert med sin ærlighet:
 *
 *  1. SESONG (sterkest): UJUSTERT omsetningsindeks fra SSB 13863,
 *     2015→ (~137 mnd) → sesongindeks per kalendermåned. Verifisert
 *     live: film/TV bunner i juli (0,60), topper nov–des (1,24–1,27).
 *     Ti års belegg — høy konfidens.
 *  2. TREND: sesongjustert indeks siste 12 mnd vs foregående 12 —
 *     vokser eller krymper markedet akkurat nå.
 *  3. GEO-TOMROM: temaer der målmerket har null AI-omtale — tids-
 *     begrenset first-mover-vindu (syntetisk måling, merket).
 *  4. KUNDETILSIG: nyregistrerte selskaper per måned (BRREG, live) —
 *     når kommer nye kjøpere inn i markedet.
 *
 *  Grense (bevisst): motoren finner MARKEDETS vindu. Produktberedskap
 *  er menneskets dom og scores aldri.
 */

import type { Pool } from "pg";
import { callExternalApi } from "../external-api.js";
import { MOMENTUM_NACE } from "./ssb-momentum-signal-sync.js";

const SSB_TABLE_URL = "https://data.ssb.no/api/v0/no/table/13863";

// ─────────────────────────────────────────────────────────────────────
// Rene beregninger (enhetstestet)
// ─────────────────────────────────────────────────────────────────────

export interface MonthPoint {
  month: string; // '2026M05'
  value: number;
}

export interface Seasonality {
  /** '01'..'12' → indeks der 1.0 = årssnitt. */
  byCalendarMonth: Record<string, number>;
  yearsOfData: number;
}

export function computeSeasonality(points: MonthPoint[]): Seasonality | null {
  const byMonth = new Map<string, number[]>();
  for (const p of points) {
    const m = p.month.slice(-2);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(p.value);
  }
  if (byMonth.size < 12) return null; // trenger alle kalendermåneder
  const all = points.map((p) => p.value);
  const overall = all.reduce((s, v) => s + v, 0) / all.length;
  if (overall === 0) return null;
  const byCalendarMonth: Record<string, number> = {};
  for (const [m, vals] of [...byMonth.entries()].sort()) {
    byCalendarMonth[m] = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length / overall) * 1000) / 1000;
  }
  return {
    byCalendarMonth,
    yearsOfData: Math.round((points.length / 12) * 10) / 10,
  };
}

export function computeTrend(points: MonthPoint[]): { pct: number; months: number } | null {
  const sorted = [...points].sort((a, b) => a.month.localeCompare(b.month));
  if (sorted.length < 24) return null;
  const last12 = sorted.slice(-12).map((p) => p.value);
  const prev12 = sorted.slice(-24, -12).map((p) => p.value);
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const prev = avg(prev12);
  if (prev === 0) return null;
  return { pct: Math.round(((avg(last12) - prev) / prev) * 1000) / 10, months: sorted.length };
}

export interface MonthRecommendation {
  month: string; // '2026-09'
  calendarMonth: string;
  seasonalIndex: number;
  note: string;
}

/** Ranger de neste 12 månedene etter sesongindeks (høyest først). */
export function rankUpcomingMonths(
  seasonality: Seasonality,
  from: Date,
): MonthRecommendation[] {
  const out: MonthRecommendation[] = [];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    const cal = String(d.getUTCMonth() + 1).padStart(2, "0");
    const idx = seasonality.byCalendarMonth[cal] ?? 1;
    out.push({
      month: d.toISOString().slice(0, 7),
      calendarMonth: cal,
      seasonalIndex: idx,
      note:
        idx >= 1.1 ? "høysesong — markedet er mest aktivt"
        : idx <= 0.85 ? "lavsesong — unngå lansering"
        : "normalsesong",
    });
  }
  return out.sort((a, b) => b.seasonalIndex - a.seasonalIndex);
}

// ─────────────────────────────────────────────────────────────────────
// Datakilder
// ─────────────────────────────────────────────────────────────────────

async function fetchFullHistory(nace: string, contents: "Indeks" | "OmsIndSesJus"): Promise<MonthPoint[]> {
  const result = await callExternalApi<{
    dimension?: { Tid?: { category: { index: Record<string, number> } } };
    value?: Array<number | null>;
  }>(SSB_TABLE_URL, {
    method: "POST",
    timeoutMs: 25_000,
    label: "launch-timing-ssb",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: [
        { code: "NACE", selection: { filter: "item", values: [nace] } },
        { code: "ContentsCode", selection: { filter: "item", values: [contents] } },
        { code: "Tid", selection: { filter: "all", values: ["*"] } },
      ],
      response: { format: "json-stat2" },
    }),
  });
  if (!result.ok) return [];
  const tid = result.data.dimension?.Tid?.category.index ?? {};
  const values = result.data.value ?? [];
  return Object.entries(tid)
    .map(([month, i]) => ({ month, value: values[i] }))
    .filter((p): p is MonthPoint => typeof p.value === "number");
}

async function countNewCompanies(nace: string, fromDate: string, toDate: string): Promise<number | null> {
  const result = await callExternalApi<{ page?: { totalElements?: number } }>(
    `https://data.brreg.no/enhetsregisteret/api/enheter?naeringskode=${nace}` +
      `&fraRegistreringsdatoEnhetsregisteret=${fromDate}&tilRegistreringsdatoEnhetsregisteret=${toDate}&size=1`,
    { method: "GET", timeoutMs: 12_000, label: "launch-timing-brreg", headers: { Accept: "application/json" } },
  );
  if (!result.ok) return null;
  const n = result.data.page?.totalElements;
  return typeof n === "number" ? n : null;
}

export interface LaunchTimingAnalysis {
  solution: string;
  naceCode: string;
  seasonality: Seasonality | null;
  trend: { pct: number; months: number } | null;
  rankedMonths: MonthRecommendation[];
  geoVoids: Array<{ setName: string; openTopics: number; totalTopics: number }>;
  newCompaniesPerMonth: Array<{ month: string; count: number }>;
  honestNotes: string[];
}

const SOLUTION_TO_SET: Record<string, { setPattern: string; naceKey: string }> = {
  theroleroom: { setPattern: "The Role Room%", naceKey: "The Role Room — casting og produksjon" },
  creatorhub: { setPattern: "CreatorHub%", naceKey: "CreatorHub — fotografer og videografer" },
};

export async function getLaunchTimingAnalysis(
  pool: Pool,
  organizationId: string,
  solution: string,
): Promise<LaunchTimingAnalysis | { error: string }> {
  const mapping = SOLUTION_TO_SET[solution];
  if (!mapping) {
    return { error: "solution_uten_ssb_naering (leadgrid mangler i tjenesteindeksen — bruk theroleroom|creatorhub)" };
  }
  const nace = MOMENTUM_NACE[mapping.naceKey]?.code;
  if (!nace) return { error: "nace_mangler" };

  const honestNotes: string[] = [];

  // 1+2: sesong (ujustert) + trend (sesongjustert)
  const [rawHistory, adjHistory] = await Promise.all([
    fetchFullHistory(nace, "Indeks"),
    fetchFullHistory(nace, "OmsIndSesJus"),
  ]);
  const seasonality = computeSeasonality(rawHistory);
  const trend = computeTrend(adjHistory);
  if (!seasonality) honestNotes.push("SSB-historikken var utilgjengelig — sesongindeks mangler");
  else honestNotes.push(`Sesongindeks bygget på ${seasonality.yearsOfData} års månedsdata (SSB 13863, ujustert)`);

  // 3: GEO-tomrom — temaer uten target-omtale i siste kjøring
  const voids = await pool.query<{ set_name: string; open_topics: number; total_topics: number }>(
    `WITH latest AS (
       SELECT ps.id, ps.name, (
         SELECT r.id FROM geo_probe_runs r
          WHERE r.prompt_set_id = ps.id AND r.status IN ('completed','partial')
          ORDER BY r.started_at DESC LIMIT 1) AS run_id
         FROM geo_prompt_sets ps
        WHERE ps.organization_id = $1::uuid AND ps.status = 'approved' AND ps.name LIKE $2
     )
     SELECT l.name AS set_name,
            count(DISTINCT p.topic) FILTER (WHERE NOT EXISTS (
              SELECT 1 FROM geo_probe_results res
               WHERE res.run_id = l.run_id AND res.prompt_id = p.id AND res.target_mentioned
            ))::int AS open_topics,
            count(DISTINCT p.topic)::int AS total_topics
       FROM latest l JOIN geo_prompts p ON p.prompt_set_id = l.id AND p.enabled
      WHERE l.run_id IS NOT NULL
      GROUP BY l.name`,
    [organizationId, mapping.setPattern],
  );
  const geoVoids = voids.rows.map((v) => ({
    setName: v.set_name, openTopics: v.open_topics, totalTopics: v.total_topics,
  }));
  if (geoVoids.length > 0) {
    honestNotes.push("GEO-tomrom er syntetiske målinger (AI-probing) — first-mover-vinduet lukkes når konkurrenter fyller temaene");
  }

  // 4: kundetilsig — nyregistreringer siste 6 måneder (live BRREG)
  const newCompaniesPerMonth: Array<{ month: string; count: number }> = [];
  const now = new Date();
  for (let i = 6; i >= 1; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0));
    const count = await countNewCompanies(
      nace, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10),
    );
    if (count !== null) {
      newCompaniesPerMonth.push({ month: start.toISOString().slice(0, 7), count });
    }
  }
  honestNotes.push("Merk: sesong/trend gjelder 2-siffer-næringen — motoren finner MARKEDETS vindu; produktberedskap er deres egen vurdering");

  return {
    solution,
    naceCode: nace,
    seasonality,
    trend,
    rankedMonths: seasonality ? rankUpcomingMonths(seasonality, now) : [],
    geoVoids,
    newCompaniesPerMonth,
    honestNotes,
  };
}
