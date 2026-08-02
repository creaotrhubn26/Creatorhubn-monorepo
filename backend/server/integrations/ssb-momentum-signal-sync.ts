/**
 * ssb-momentum-signal-sync.ts — EKTE markeds-momentum fra SSB
 * (SSB-byggene del A)
 *
 * Tabell 13863 «Omsetningsindeks for tjenester» (2021=100, månedlig,
 * sesongjustert) — verifisert live 2026-07-13: film/TV (59) gikk
 * 91,6 → 129,2 på 14 måneder. Dette er FAKTISK markedsutvikling, i
 * motsetning til GEO-målingenes syntetiske omtale-momentum.
 *
 * Redelighet:
 *  - Kun vertikaler med næring i tabellen får momentum (59 film/TV,
 *    74 faglig) — dans/utdanning finnes ikke i tjenesteindeksen og
 *    står ærlig uten, ikke med lånte tall.
 *  - unit 'relative_index' (2021=100) — blandes aldri med volumtall.
 *  - Deterministiske id-er per måned → daglig kjøring er no-op til ny
 *    måned publiseres.
 */

import type { Pool } from "pg";
import { callExternalApi } from "../external-api.js";
import type { NormalizedSignal } from "./normalized-signal-schema.js";
import { insertNormalizedSignals } from "./normalized-signal-store.js";

const SSB_TABLE_URL = "https://data.ssb.no/api/v0/no/table/13863";
const MONTHS_BACK = 14;

/** Vertikal → SSB-næring i tjenesteindeksen. Kun de som faktisk finnes. */
export const MOMENTUM_NACE: Record<string, { code: string; note: string }> = {
  "The Role Room — casting og produksjon": {
    code: "59",
    note: "Film- og TV-produksjon, musikkutgivelse (2-siffer)",
  },
  "CreatorHub — fotografer og videografer": {
    code: "74",
    note: "Annen faglig/vitenskapelig/teknisk (2-siffer — bredere enn foto)",
  },
  // Dans (85/90) og utdanning finnes IKKE i tjenesteindeksen — ærlig uten.
};

interface SsbStat {
  dimension?: {
    NACE?: { category: { index: Record<string, number> } };
    Tid?: { category: { index: Record<string, number>; label: Record<string, string> } };
  };
  size?: number[];
  id?: string[];
  value?: Array<number | null>;
}

export interface MomentumPoint {
  naceCode: string;
  month: string; // '2026M05'
  index: number;
}

/** Ren json-stat2-parsing for (NACE × Tid)-tabellen (enhetstestet). */
export function parseMomentumPoints(stat: SsbStat): MomentumPoint[] {
  const nace = stat.dimension?.NACE;
  const tid = stat.dimension?.Tid;
  if (!nace || !tid || !stat.value || !stat.id || !stat.size) return [];
  const strides: number[] = new Array(stat.id.length).fill(1);
  for (let i = stat.id.length - 2; i >= 0; i--) strides[i] = strides[i + 1] * stat.size[i + 1];
  const nPos = stat.id.indexOf("NACE");
  const tPos = stat.id.indexOf("Tid");

  const out: MomentumPoint[] = [];
  for (const [code, nIdx] of Object.entries(nace.category.index)) {
    for (const [month, tIdx] of Object.entries(tid.category.index)) {
      const flat = nIdx * strides[nPos] + tIdx * strides[tPos];
      const v = stat.value[flat];
      if (v === null || v === undefined) continue;
      out.push({ naceCode: code, month, index: v });
    }
  }
  return out;
}

/** '2026M05' → '2026-05-01T00:00:00.000Z' */
export function monthToIso(month: string): string {
  const m = /^(\d{4})M(\d{2})$/.exec(month);
  return m ? `${m[1]}-${m[2]}-01T00:00:00.000Z` : month;
}

export interface MomentumSyncResult {
  organizations: number;
  setsMapped: number;
  monthsCovered: number;
  signalsInserted: number;
  errors: string[];
}

export async function syncSsbMomentumSignals(pool: Pool): Promise<MomentumSyncResult> {
  const errors: string[] = [];
  const sets = await pool.query<{ organization_id: string; owner_user_id: string; name: string }>(
    `SELECT DISTINCT ps.organization_id::text, o.owner_user_id, ps.name
       FROM geo_prompt_sets ps JOIN organizations o ON o.id = ps.organization_id
      WHERE ps.status = 'approved' AND ps.organization_id IS NOT NULL`,
  );
  const mapped = sets.rows.filter((s) => MOMENTUM_NACE[s.name]);
  const codes = [...new Set(mapped.map((s) => MOMENTUM_NACE[s.name].code))];
  if (codes.length === 0) {
    return { organizations: 0, setsMapped: 0, monthsCovered: 0, signalsInserted: 0, errors: [] };
  }

  const result = await callExternalApi<SsbStat>(SSB_TABLE_URL, {
    method: "POST",
    timeoutMs: 20_000,
    label: "ssb-momentum",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: [
        { code: "NACE", selection: { filter: "item", values: codes } },
        { code: "ContentsCode", selection: { filter: "item", values: ["OmsIndSesJus"] } },
        { code: "Tid", selection: { filter: "top", values: [String(MONTHS_BACK)] } },
      ],
      response: { format: "json-stat2" },
    }),
  });
  if (!result.ok) {
    return {
      organizations: 0, setsMapped: mapped.length, monthsCovered: 0, signalsInserted: 0,
      errors: ["SSB-kall feilet (tabell 13863)"],
    };
  }
  const points = parseMomentumPoints(result.data);
  const collectedAt = new Date().toISOString();

  let inserted = 0;
  const months = new Set<string>();
  for (const set of mapped) {
    const nace = MOMENTUM_NACE[set.name];
    const setPoints = points.filter((p) => p.naceCode === nace.code);
    const slug = set.name.toLowerCase().replace(/[^a-z0-9æøå]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const signals: NormalizedSignal[] = setPoints.map((p) => {
      months.add(p.month);
      return {
        id: `ssb-oms|${set.organization_id}|${slug}|${p.month}|${p.naceCode}`,
        organizationId: set.organization_id,
        workspaceId: set.owner_user_id,
        provider: "ssb",
        sourceType: "public_data" as const,
        subjectType: "industry" as const,
        subjectId: p.naceCode,
        topic: set.name,
        metricType: "industry_revenue_index",
        metricValue: p.index,
        unit: "relative_index" as const,
        geography: { country: "NO" },
        periodStart: monthToIso(p.month),
        periodEnd: collectedAt,
        confidence: 1,
        sourceQuality: 1,
        freshnessScore: 1,
        isEstimated: false,
        isNormalized: true,
        collectedAt,
        metadata: { source: "ssb-13863", base: "2021=100", adjustment: "sesongjustert", naceNote: nace.note },
      };
    });
    if (signals.length === 0) continue;
    try {
      inserted += (await insertNormalizedSignals(pool, signals)).inserted;
    } catch (err) {
      errors.push(`${set.name}: ${String(err).slice(0, 100)}`);
    }
  }

  return {
    organizations: new Set(mapped.map((s) => s.organization_id)).size,
    setsMapped: mapped.length,
    monthsCovered: months.size,
    signalsInserted: inserted,
    errors,
  };
}
