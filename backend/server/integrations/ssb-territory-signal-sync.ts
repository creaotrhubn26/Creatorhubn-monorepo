/**
 * ssb-territory-signal-sync.ts — SSB Statistikkbanken som territorium-kilde
 * (Daniels datastruktur-punkt 3: territory potential, markedsmetning,
 * segmentstørrelse)
 *
 * Tabell 07091 «Bedrifter, etter region, næring (SN2007)» — verifisert
 * live 2026-07-13 (fylkesvise 2026-tall, json-stat2). Åpent API, ingen
 * nøkkel.
 *
 * Gir metricType 'businesses_in_region' per (fylke × næring): grunnlaget
 * for Leadgrids territorie-potensial (alle næringer per fylke) og
 * vertikalenes geografiske markedsstørrelse.
 *
 * Redelighet: SSB-næring er 2-SIFFER — grovere enn BRREG-NACE-ene våre
 * (74 = «annen faglig/vitenskapelig/teknisk», ikke bare foto). Dette
 * står i note-feltet og i signal-metadata; tall på ulik granularitet
 * blandes aldri stille (BRREG-signalene har egne metricTypes).
 */

import type { Pool } from "pg";
import { callExternalApi } from "../external-api.js";
import type { NormalizedSignal } from "./normalized-signal-schema.js";
import { insertNormalizedSignals } from "./normalized-signal-store.js";

const SSB_TABLE_URL = "https://data.ssb.no/api/v0/no/table/07091";

/** Fylkesstrukturen fra 2024 (15 fylker) — koder verifisert i tabellen. */
export const FYLKER: Record<string, string> = {
  "03": "Oslo",
  "11": "Rogaland",
  "15": "Møre og Romsdal",
  "18": "Nordland",
  "31": "Østfold",
  "32": "Akershus",
  "33": "Buskerud",
  "34": "Innlandet",
  "39": "Vestfold",
  "40": "Telemark",
  "42": "Agder",
  "46": "Vestland",
  "50": "Trøndelag",
  "55": "Troms",
  "56": "Finnmark",
};

/** Vertikal → SSB-næring (2-siffer). Nøkkel = geo_prompt_sets.name. */
export const SSB_VERTICAL_NACE: Record<string, { code: string; note: string }> = {
  "CreatorHub — fotografer og videografer": {
    code: "74",
    note: "2-siffer: hele «annen faglig/vitenskapelig/teknisk» — bredere enn foto (74.2)",
  },
  "The Role Room — casting og produksjon": {
    code: "59",
    note: "film-, video- og TV-produksjon + musikkutgivelse",
  },
  "Leadgrid — små bedrifter (feltsalg/leads)": {
    code: "01-99",
    note: "Total — territoriets samlede bedriftsbestand (lead-potensial per fylke)",
  },
  "Leadgrid — salgsteam og større organisasjoner": {
    code: "01-99",
    note: "Total — territoriets samlede bedriftsbestand",
  },
};

// ─────────────────────────────────────────────────────────────────────
// json-stat2-parsing (ren funksjon, enhetstestet)
// ─────────────────────────────────────────────────────────────────────

export interface JsonStat2 {
  id: string[];
  size: number[];
  dimension: Record<string, { category: { index: Record<string, number>; label: Record<string, string> } }>;
  value: Array<number | null>;
}

export interface TerritoryCount {
  regionCode: string;
  regionName: string;
  naceCode: string;
  count: number;
}

/** Flat json-stat2-verdi-array → (region, næring)-celler. */
export function parseTerritoryCounts(stat: JsonStat2): TerritoryCount[] {
  const regionDim = stat.dimension.Region;
  const naceDim = stat.dimension.NACE2007;
  if (!regionDim || !naceDim) return [];

  // Posisjon i flat array: row-major etter id-rekkefølgen
  const strides: number[] = new Array(stat.id.length).fill(1);
  for (let i = stat.id.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * stat.size[i + 1];
  }
  const dimPos = (name: string) => stat.id.indexOf(name);
  const rPos = dimPos("Region");
  const nPos = dimPos("NACE2007");

  const out: TerritoryCount[] = [];
  for (const [regionCode, rIdx] of Object.entries(regionDim.category.index)) {
    for (const [naceCode, nIdx] of Object.entries(naceDim.category.index)) {
      let flat = 0;
      for (let d = 0; d < stat.id.length; d++) {
        if (d === rPos) flat += rIdx * strides[d];
        else if (d === nPos) flat += nIdx * strides[d];
        // øvrige dimensjoner har én valgt verdi (indeks 0)
      }
      const v = stat.value[flat];
      if (v === null || v === undefined) continue;
      out.push({
        regionCode,
        regionName: regionDim.category.label[regionCode] ?? regionCode,
        naceCode,
        count: v,
      });
    }
  }
  return out;
}

function setSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9æøå]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export function toTerritorySignals(
  counts: TerritoryCount[],
  ctx: {
    organizationId: string;
    ownerUserId: string;
    setName: string;
    naceNote: string;
    year: string;
    collectedAt: string;
  },
): NormalizedSignal[] {
  return counts.map((c) => ({
    id: `ssb|${ctx.organizationId}|${setSlug(ctx.setName)}|${ctx.year}|${c.naceCode}|${c.regionCode}`,
    organizationId: ctx.organizationId,
    workspaceId: ctx.ownerUserId,
    provider: "ssb",
    sourceType: "public_data" as const,
    subjectType: "region" as const,
    subjectId: c.regionCode,
    topic: ctx.setName,
    metricType: "businesses_in_region",
    metricValue: c.count,
    unit: "count" as const,
    geography: { country: "NO", region: c.regionName },
    periodStart: `${ctx.year}-01-01T00:00:00.000Z`,
    periodEnd: ctx.collectedAt,
    confidence: 1,
    sourceQuality: 1,
    freshnessScore: 1,
    isEstimated: false,
    isNormalized: true,
    collectedAt: ctx.collectedAt,
    metadata: {
      source: "ssb-07091",
      naceGranularity: "2-siffer",
      naceNote: ctx.naceNote,
      license: "NLOD",
    },
  }));
}

// ─────────────────────────────────────────────────────────────────────
// Synk
// ─────────────────────────────────────────────────────────────────────

async function fetchTerritoryStat(naceCodes: string[], year: string): Promise<JsonStat2 | null> {
  const result = await callExternalApi<JsonStat2>(SSB_TABLE_URL, {
    method: "POST",
    timeoutMs: 20_000,
    label: "ssb-territory",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: [
        { code: "Region", selection: { filter: "item", values: Object.keys(FYLKER) } },
        { code: "NACE2007", selection: { filter: "item", values: naceCodes } },
        { code: "AntAnsatte", selection: { filter: "item", values: ["99"] } }, // alle størrelser
        { code: "Tid", selection: { filter: "item", values: [year] } },
      ],
      response: { format: "json-stat2" },
    }),
  });
  return result.ok ? result.data : null;
}

export interface TerritorySyncResult {
  organizations: number;
  setsMapped: number;
  regionsCovered: number;
  signalsInserted: number;
  errors: string[];
}

export async function syncSsbTerritorySignals(pool: Pool): Promise<TerritorySyncResult> {
  const errors: string[] = [];
  const year = String(new Date().getUTCFullYear());
  const collectedAt = new Date().toISOString();

  const sets = await pool.query<{ organization_id: string; owner_user_id: string; name: string }>(
    `SELECT DISTINCT ps.organization_id::text, o.owner_user_id, ps.name
       FROM geo_prompt_sets ps
       JOIN organizations o ON o.id = ps.organization_id
      WHERE ps.status = 'approved' AND ps.organization_id IS NOT NULL`,
  );

  const mapped = sets.rows.filter((s) => SSB_VERTICAL_NACE[s.name]);
  const naceCodes = [...new Set(mapped.map((s) => SSB_VERTICAL_NACE[s.name].code))];
  if (naceCodes.length === 0) {
    return { organizations: 0, setsMapped: 0, regionsCovered: 0, signalsInserted: 0, errors: [] };
  }

  const stat = await fetchTerritoryStat(naceCodes, year);
  if (!stat) {
    return {
      organizations: 0,
      setsMapped: mapped.length,
      regionsCovered: 0,
      signalsInserted: 0,
      errors: [`SSB-kall feilet (tabell 07091, år ${year})`],
    };
  }
  const counts = parseTerritoryCounts(stat);

  let inserted = 0;
  const regions = new Set<string>();
  for (const set of mapped) {
    const nace = SSB_VERTICAL_NACE[set.name];
    const setCounts = counts.filter((c) => c.naceCode === nace.code);
    setCounts.forEach((c) => regions.add(c.regionCode));
    const signals = toTerritorySignals(setCounts, {
      organizationId: set.organization_id,
      ownerUserId: set.owner_user_id,
      setName: set.name,
      naceNote: nace.note,
      year,
      collectedAt,
    });
    if (signals.length === 0) continue;
    try {
      inserted += (await insertNormalizedSignals(pool, signals)).inserted;
    } catch (err) {
      errors.push(`${set.name}: ${String(err).slice(0, 120)}`);
    }
  }

  return {
    organizations: new Set(mapped.map((s) => s.organization_id)).size,
    setsMapped: mapped.length,
    regionsCovered: regions.size,
    signalsInserted: inserted,
    errors,
  };
}
