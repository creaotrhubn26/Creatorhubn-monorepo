/**
 * industry-benchmark.ts — «hva gjør bedrifter bra?» målt, ikke lest
 * (Daniels bestilling: års-/kvartalsrapport-innsikt i markedet)
 *
 * Ærlig avgrensning: kvartalsrapporter finnes kun for børsnoterte
 * (NewsWeb er lukket SPA — registrert requiresReview). SMB-ene i
 * vertikalene deres har årsregnskap — og de har vi via
 * Regnskapsregisterets åpne API. Denne modulen bygger BRANSJE-BENCHMARK
 * over prospektsegmentene:
 *
 *   - Nøkkeltall per selskap hentes gradvis (tak per natt, rotasjon —
 *     samme mønster som konkursvakten)
 *   - Benchmark per segment: median/kvartiler for margin og omsetning,
 *     topp-utøvere med navn og tall — «hva de beste gjør bra»
 *   - DEKNING rapporteres alltid: benchmark på 300 av 8 961 selskaper
 *     presenteres som nettopp det
 *
 * Selskaper uten regnskap (ENK) huskes så API-et ikke spørres igjen.
 */

import type { Pool } from "pg";
import { mapRegnskapEntry, type CompanyFinancials } from "../lead-brreg-service.js";

const FETCH_TIMEOUT_MS = 12_000;
/** Nattens tak — porteføljen fylles over dager (prioritert: flest ansatte). */
const MAX_COMPANIES_PER_RUN = 150;

async function fetchFinancials(orgNr: string): Promise<CompanyFinancials | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(`https://data.brreg.no/regnskapsregisteret/regnskap/${orgNr}`, {
      signal: controller.signal,
    });
    if (!r.ok) return null;
    const body = (await r.json()) as unknown[];
    if (!Array.isArray(body) || body.length === 0) return null;
    const mapped = body
      .map((e) => mapRegnskapEntry(e as Parameters<typeof mapRegnskapEntry>[0]))
      .filter((x): x is CompanyFinancials => x !== null)
      .sort((a, b) => b.year - a.year);
    return mapped[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface BenchmarkSyncResult {
  attempted: number;
  withData: number;
  withoutData: number;
  errors: string[];
}

export async function syncCompanyFinancials(pool: Pool): Promise<BenchmarkSyncResult> {
  const errors: string[] = [];
  // Uhentede segment-selskaper, størst først (AS m/ ansatte har oftest
  // regnskap). GROUP BY + max() unngår DISTINCT/ORDER BY-konflikten som
  // felte første kjøring.
  const candidates = await pool.query<{ org_nr: string }>(
    `SELECT pc.org_nr
       FROM prospect_companies pc
      WHERE NOT EXISTS (SELECT 1 FROM company_financials_checked c WHERE c.org_nr = pc.org_nr)
      GROUP BY pc.org_nr
      ORDER BY max(COALESCE(pc.employees, 0)) DESC, pc.org_nr
      LIMIT ${MAX_COMPANIES_PER_RUN}`,
  );

  let withData = 0;
  let withoutData = 0;
  for (const row of candidates.rows) {
    try {
      const f = await fetchFinancials(row.org_nr);
      if (f) {
        await pool.query(
          `INSERT INTO company_financials
             (org_nr, year, revenue, operating_result, net_result, equity,
              total_assets, operating_margin, equity_ratio)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (org_nr, year) DO NOTHING`,
          [row.org_nr, f.year, f.revenue, f.operatingResult, f.netResult,
           f.equity, f.totalAssets, f.operatingMargin, f.equityRatio],
        );
        withData += 1;
      } else {
        withoutData += 1;
      }
      await pool.query(
        `INSERT INTO company_financials_checked (org_nr, has_data)
         VALUES ($1, $2) ON CONFLICT (org_nr) DO NOTHING`,
        [row.org_nr, f !== null],
      );
    } catch (err) {
      errors.push(`${row.org_nr}: ${String(err).slice(0, 80)}`);
    }
  }
  return { attempted: candidates.rows.length, withData, withoutData, errors };
}

export interface IndustryBenchmark {
  segmentKey: string;
  displayName: string;
  segmentTotal: number;
  companiesWithFinancials: number;
  /** Dekning av segmentet — benchmark på 3 % presenteres som 3 %. */
  coverage: number;
  medianRevenue: number | null;
  medianOperatingMargin: number | null;
  p75OperatingMargin: number | null;
  topPerformers: Array<{
    name: string;
    municipality: string | null;
    revenue: number;
    operatingMargin: number | null;
    year: number;
  }>;
}

export async function getIndustryBenchmark(
  pool: Pool,
  segmentKey: string,
): Promise<IndustryBenchmark | null> {
  const seg = await pool.query<{ display_name: string; total_found: number }>(
    `SELECT display_name, total_found FROM prospect_segments WHERE segment_key = $1`,
    [segmentKey],
  );
  if (seg.rows.length === 0) return null;

  const stats = await pool.query<{
    n: number;
    median_revenue: string | null;
    median_margin: number | null;
    p75_margin: number | null;
  }>(
    `SELECT count(*)::int AS n,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY f.revenue) AS median_revenue,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY f.operating_margin) AS median_margin,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY f.operating_margin) AS p75_margin
       FROM prospect_companies pc
       JOIN company_financials f ON f.org_nr = pc.org_nr
      WHERE pc.segment_key = $1 AND f.revenue IS NOT NULL`,
    [segmentKey],
  );

  const top = await pool.query<{
    name: string;
    municipality: string | null;
    revenue: string;
    operating_margin: number | null;
    year: number;
  }>(
    `SELECT pc.name, pc.municipality, f.revenue, f.operating_margin, f.year
       FROM prospect_companies pc
       JOIN company_financials f ON f.org_nr = pc.org_nr
      WHERE pc.segment_key = $1 AND f.revenue IS NOT NULL
        AND f.operating_margin IS NOT NULL AND f.revenue > 500000
      ORDER BY f.operating_margin DESC LIMIT 10`,
    [segmentKey],
  );

  const s = stats.rows[0];
  const total = seg.rows[0].total_found || 0;
  return {
    segmentKey,
    displayName: seg.rows[0].display_name,
    segmentTotal: total,
    companiesWithFinancials: s?.n ?? 0,
    coverage: total > 0 ? Math.round(((s?.n ?? 0) / total) * 1000) / 1000 : 0,
    medianRevenue: s?.median_revenue != null ? Number(s.median_revenue) : null,
    medianOperatingMargin: s?.median_margin ?? null,
    p75OperatingMargin: s?.p75_margin ?? null,
    topPerformers: top.rows.map((r) => ({
      name: r.name,
      municipality: r.municipality,
      revenue: Number(r.revenue),
      operatingMargin: r.operating_margin,
      year: r.year,
    })),
  };
}
