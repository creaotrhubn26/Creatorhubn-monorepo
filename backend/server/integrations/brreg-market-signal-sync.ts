/**
 * brreg-market-signal-sync.ts — offentlige registerdata som markedssignal
 * (Daniels datastruktur-punkt 1: offentlige registre som kilde)
 *
 * Henter fra Brønnøysundregistrenes åpne API (NLOD-lisens, ingen auth):
 *
 *   registered_companies  — bedriftsbestand per NACE-kode (markedsstørrelse)
 *   new_companies_30d     — nyregistreringer siste 30 dager (markeds-
 *                           momentum; for Leadgrid-SMB: selve lead-bassenget)
 *
 * Redelighet:
 *  - NACE-mappingen per vertikal er EMPIRISK VERIFISERT mot API-et
 *    (2026-07-13, antall i kommentar) — koder som ga 0 treff ble forkastet,
 *    ikke gjettet. Vertikaler uten verifisert kode rapporteres som
 *    unmapped — aldri stille utelatt.
 *  - Ekte telling fra offentlig register: isEstimated=false.
 *  - Deterministiske id-er: bestand per måned, nyregistreringer per
 *    ISO-uke → daglig kjøring er no-op innen perioden.
 */

import type { Pool } from "pg";
import { callExternalApi } from "../external-api.js";
import type { NormalizedSignal } from "./normalized-signal-schema.js";
import { insertNormalizedSignals } from "./normalized-signal-store.js";

const BRREG_BASE = "https://data.brreg.no/enhetsregisteret/api/enheter";

/**
 * Vertikal → NACE-koder. Nøkkel = geo_prompt_sets.name (stabil kobling til
 * temaene resten av motoren bruker). Justeringsflate: nye vertikaler
 * legges til her ETTER verifisering mot API-et.
 */
export const VERTICAL_NACE_MAP: Record<string, { codes: string[]; note: string }> = {
  "CreatorHub — fotografer og videografer": {
    codes: ["74.200"], // Fotografvirksomhet — 8 961 enheter verifisert 2026-07-13
    note: "fotografvirksomhet",
  },
  "The Role Room — casting og produksjon": {
    codes: ["59.110"], // Produksjon av film/video/TV — 7 691 enheter verifisert 2026-07-13
    note: "film- og TV-produksjon",
  },
  "The Role Room — dansestudio": {
    codes: ["85.529", "85.521"], // Undervisning kunstfag ellers (3 269) + kommunal kulturskole (219), verifisert 2026-07-13
    note: "danse-/kunstfagundervisning",
  },
  // 'Leadgrid — små bedrifter': nyregistreringer ALLE bransjer (lead-bassenget) — egen håndtering under.
  // 'Leadgrid — salgsteam' og 'TRR — utdanningsinstitusjoner': ingen presis NACE funnet — rapporteres unmapped.
};

export const LEADGRID_SMB_SET_NAME = "Leadgrid — små bedrifter (feltsalg/leads)";

interface BrregPage {
  page?: { totalElements?: number };
}

async function countEntities(params: string): Promise<number | null> {
  const result = await callExternalApi<BrregPage>(`${BRREG_BASE}?${params}&size=1`, {
    method: "GET",
    timeoutMs: 12_000,
    label: "brreg-market",
    headers: { Accept: "application/json" },
  });
  if (!result.ok) return null;
  const n = result.data.page?.totalElements;
  return typeof n === "number" ? n : null;
}

export interface MarketCountRow {
  organizationId: string;
  ownerUserId: string;
  setName: string;
  naceCode: string; // 'alle' for u-filtrert
  metricType: "registered_companies" | "new_companies_30d";
  value: number;
}

export interface MarketSyncContext {
  collectedAt: string; // styrer også periode-id-ene deterministisk
}

function isoWeekStart(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  return monday.toISOString().slice(0, 10);
}

/** Ren normalisering (enhetstestet). */
export function toMarketSignals(rows: MarketCountRow[], ctx: MarketSyncContext): NormalizedSignal[] {
  const now = new Date(ctx.collectedAt);
  const monthKey = ctx.collectedAt.slice(0, 7); // YYYY-MM
  const weekKey = isoWeekStart(now);
  return rows.map((row) => {
    const isStock = row.metricType === "registered_companies";
    const periodKey = isStock ? `${monthKey}-01` : weekKey;
    const periodStart = `${periodKey}T00:00:00.000Z`;
    return {
      id: `brreg|${row.organizationId}|${periodKey}|${row.naceCode}|${row.metricType}`,
      organizationId: row.organizationId,
      workspaceId: row.ownerUserId,
      provider: "brreg",
      sourceType: "public_data" as const,
      subjectType: "industry" as const,
      subjectId: row.naceCode,
      topic: row.setName,
      metricType: row.metricType,
      metricValue: row.value,
      unit: "count" as const,
      geography: { country: "NO" },
      periodStart,
      periodEnd: ctx.collectedAt,
      confidence: 1,
      sourceQuality: 1,
      freshnessScore: 1,
      isEstimated: false,
      isNormalized: true,
      collectedAt: ctx.collectedAt,
      metadata: { source: "brreg-enhetsregisteret", license: "NLOD" },
    };
  });
}

export interface BrregSyncResult {
  organizations: number;
  setsMapped: number;
  setsUnmapped: string[];
  signalsInserted: number;
  errors: string[];
}

export async function syncBrregMarketSignals(pool: Pool): Promise<BrregSyncResult> {
  const sets = await pool.query<{
    organization_id: string;
    owner_user_id: string;
    name: string;
  }>(
    `SELECT DISTINCT ps.organization_id::text, o.owner_user_id, ps.name
       FROM geo_prompt_sets ps
       JOIN organizations o ON o.id = ps.organization_id
      WHERE ps.status = 'approved' AND ps.organization_id IS NOT NULL`,
  );

  const collectedAt = new Date().toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const rows: MarketCountRow[] = [];
  const unmapped: string[] = [];
  const errors: string[] = [];

  for (const set of sets.rows) {
    const base = {
      organizationId: set.organization_id,
      ownerUserId: set.owner_user_id,
      setName: set.name,
    };
    if (set.name === LEADGRID_SMB_SET_NAME) {
      // Lead-bassenget: nyregistrerte selskaper, alle bransjer
      const n = await countEntities(`fraRegistreringsdatoEnhetsregisteret=${thirtyDaysAgo}`);
      if (n === null) errors.push(`${set.name}: brreg-kall feilet`);
      else rows.push({ ...base, naceCode: "alle", metricType: "new_companies_30d", value: n });
      continue;
    }
    const mapping = VERTICAL_NACE_MAP[set.name];
    if (!mapping) {
      unmapped.push(set.name);
      continue;
    }
    for (const code of mapping.codes) {
      const stock = await countEntities(`naeringskode=${code}`);
      if (stock === null) {
        errors.push(`${set.name}/${code}: brreg-kall feilet`);
        continue;
      }
      rows.push({ ...base, naceCode: code, metricType: "registered_companies", value: stock });
      const fresh = await countEntities(
        `naeringskode=${code}&fraRegistreringsdatoEnhetsregisteret=${thirtyDaysAgo}`,
      );
      if (fresh !== null) {
        rows.push({ ...base, naceCode: code, metricType: "new_companies_30d", value: fresh });
      }
    }
  }

  const signals = toMarketSignals(rows, { collectedAt });
  let inserted = 0;
  if (signals.length > 0) {
    try {
      inserted = (await insertNormalizedSignals(pool, signals)).inserted;
    } catch (err) {
      errors.push(String(err).slice(0, 150));
    }
  }
  return {
    organizations: new Set(sets.rows.map((s) => s.organization_id)).size,
    setsMapped: sets.rows.length - unmapped.length,
    setsUnmapped: unmapped,
    signalsInserted: inserted,
    errors,
  };
}
