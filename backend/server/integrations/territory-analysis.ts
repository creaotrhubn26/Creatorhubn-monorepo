/**
 * territory-analysis.ts — demografi × prospektlister (SSB-byggene del B)
 *
 * Metnings-/hullanalyse for dansevertikalen: barn 6–15 per kommune
 * (SSB 07459, verifisert) delt på antall danseskoler fra prospekt-
 * segmentet → hvor er markedet mettet, hvor er hullene.
 *
 * Redelighet:
 *  - Kommune-kobling skjer på NAVN (SSB-label ↔ Enhetsregisterets
 *    kommune-felt), normalisert — treffprosenten rapporteres, og
 *    kommuner uten navnetreff listes som ukoblet i stedet for å
 *    forsvinne stille.
 *  - «Ingen skole registrert» er et funn (hull), ikke manglende data.
 *  - Hentes on-demand (admin/butler) — demografi endres årlig, ingen
 *    grunn til nattlig synk.
 */

import type { Pool } from "pg";
import { callExternalApi } from "../external-api.js";

const SSB_POP_URL = "https://data.ssb.no/api/v0/no/table/07459";
/** Målgruppen for danseundervisning: barn/unge 6–15 år. */
const AGE_CODES = ["006", "007", "008", "009", "010", "011", "012", "013", "014", "015"];

export function normalizeMunicipality(name: string): string {
  return name
    .split(" - ")[0] // 'Oslo - Oslove' → 'Oslo'
    .trim()
    .toUpperCase();
}

interface SsbStat {
  dimension?: {
    Region?: { category: { index: Record<string, number>; label: Record<string, string> } };
    Alder?: { category: { index: Record<string, number> } };
  };
  size?: number[];
  id?: string[];
  value?: Array<number | null>;
}

export interface MunicipalityChildren {
  code: string;
  name: string;
  children: number;
}

/** Summer aldersgruppene per kommune fra json-stat2 (enhetstestet). */
export function sumChildrenPerMunicipality(stat: SsbStat): MunicipalityChildren[] {
  const region = stat.dimension?.Region;
  const alder = stat.dimension?.Alder;
  if (!region || !alder || !stat.value || !stat.id || !stat.size) return [];
  const strides: number[] = new Array(stat.id.length).fill(1);
  for (let i = stat.id.length - 2; i >= 0; i--) strides[i] = strides[i + 1] * stat.size[i + 1];
  const rPos = stat.id.indexOf("Region");
  const aPos = stat.id.indexOf("Alder");

  const out: MunicipalityChildren[] = [];
  for (const [code, rIdx] of Object.entries(region.category.index)) {
    if (code.length !== 4) continue; // kun kommuner (4-sifret)
    let sum = 0;
    for (const aIdx of Object.values(alder.category.index)) {
      const v = stat.value[rIdx * strides[rPos] + aIdx * strides[aPos]];
      if (typeof v === "number") sum += v;
    }
    out.push({ code, name: region.category.label[code] ?? code, children: sum });
  }
  return out;
}

export interface TerritoryRow {
  municipality: string;
  children: number;
  schools: number;
  /** null når ingen skoler — det ER hullet. */
  childrenPerSchool: number | null;
}

export interface TerritoryAnalysis {
  segmentKey: string;
  year: string;
  audience: string;
  rows: TerritoryRow[];
  /** Skoler i kommuner uten navnetreff mot SSB — aldri stille borte. */
  unmatchedSchools: Array<{ municipality: string; schools: number }>;
  matchedShare: number;
}

export async function getTerritoryAnalysis(
  pool: Pool,
  segmentKey: string,
): Promise<TerritoryAnalysis | { error: string }> {
  const year = String(new Date().getUTCFullYear());
  const result = await callExternalApi<SsbStat>(SSB_POP_URL, {
    method: "POST",
    timeoutMs: 25_000,
    label: "ssb-territory-analysis",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: [
        { code: "Alder", selection: { filter: "item", values: AGE_CODES } },
        { code: "Kjonn", selection: { filter: "item", values: ["0"] } },
        { code: "Tid", selection: { filter: "item", values: [year] } },
      ],
      response: { format: "json-stat2" },
    }),
  });
  if (!result.ok) return { error: "ssb_befolkning_utilgjengelig" };

  const municipalities = sumChildrenPerMunicipality(result.data);
  const popByName = new Map(municipalities.map((m) => [normalizeMunicipality(m.name), m]));

  const schools = await pool.query<{ municipality: string; schools: number }>(
    `SELECT municipality, count(*)::int AS schools
       FROM prospect_companies
      WHERE segment_key = $1 AND municipality IS NOT NULL
      GROUP BY municipality`,
    [segmentKey],
  );

  const schoolsByMunicipality = new Map<string, number>();
  const unmatched: Array<{ municipality: string; schools: number }> = [];
  for (const row of schools.rows) {
    const key = normalizeMunicipality(row.municipality);
    if (popByName.has(key)) {
      schoolsByMunicipality.set(key, (schoolsByMunicipality.get(key) ?? 0) + row.schools);
    } else {
      unmatched.push({ municipality: row.municipality, schools: row.schools });
    }
  }

  const rows: TerritoryRow[] = municipalities
    .filter((m) => m.children >= 500) // små kommuner er ikke etablerings-marked
    .map((m) => {
      const key = normalizeMunicipality(m.name);
      const count = schoolsByMunicipality.get(key) ?? 0;
      return {
        municipality: m.name,
        children: m.children,
        schools: count,
        childrenPerSchool: count > 0 ? Math.round(m.children / count) : null,
      };
    })
    .sort((a, b) => {
      // Hull først (ingen skoler, mange barn), deretter høyest barn-per-skole
      if ((a.schools === 0) !== (b.schools === 0)) return a.schools === 0 ? -1 : 1;
      if (a.schools === 0) return b.children - a.children;
      return (b.childrenPerSchool ?? 0) - (a.childrenPerSchool ?? 0);
    })
    .slice(0, 40);

  const totalSchools = schools.rows.reduce((s, r) => s + r.schools, 0);
  const matchedSchools = totalSchools - unmatched.reduce((s, r) => s + r.schools, 0);

  return {
    segmentKey,
    year,
    audience: "barn 6–15 år (SSB 07459)",
    rows,
    unmatchedSchools: unmatched.slice(0, 10),
    matchedShare: totalSchools > 0 ? Math.round((matchedSchools / totalSchools) * 100) / 100 : 0,
  };
}
