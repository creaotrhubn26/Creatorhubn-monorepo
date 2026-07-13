/**
 * prospect-segment-sync.ts — vertikal-segmenter fra Enhetsregisteret
 * (masterkilde-arkitekturen trinn 2, doc-diskusjonen med Daniel)
 *
 * Paginerer Enhetsregisterets åpne API per VERIFISERT NACE-kode og
 * bygger prospekteringslister: «alle 8 961 fotografer» som liste i
 * Leadgrid — 90 % av masterkilde-verdien uten fullt register-speil.
 *
 * Redelighet:
 *  - Kun de empirisk verifiserte kodene fra brreg-market-synken.
 *  - Sidetak (MAX_PAGES) → `truncated`-flagg på segmentet, ALDRI stille
 *    kutt. Enhetsregisteret takler ikke offset > 10 000 uansett.
 *  - Ukentlig refresh-guard: registerbestand endres sakte, og vi skal
 *    ikke hamre et gratis-API daglig uten grunn.
 *  - Konkurs/avviklede enheter tas ikke inn i listene.
 */

import type { Pool } from "pg";
import { VERTICAL_NACE_MAP } from "./brreg-market-signal-sync.js";

const BRREG_API = "https://data.brreg.no/enhetsregisteret/api/enheter";
const FETCH_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 100;
/** 100 sider × 100 = 10 000 — Enhetsregisterets paging-tak. */
const MAX_PAGES = 100;
const REFRESH_INTERVAL_DAYS = 7;

/** Segment-nøkler per prompt-sett (gjenbruker verifisert NACE-mapping). */
export const SEGMENT_DEFINITIONS: Array<{ segmentKey: string; displayName: string; setName: string }> = [
  { segmentKey: "fotografer", displayName: "Fotografer og videografer (74.200)", setName: "CreatorHub — fotografer og videografer" },
  { segmentKey: "film-tv", displayName: "Film- og TV-produksjon (59.110)", setName: "The Role Room — casting og produksjon" },
  { segmentKey: "danseundervisning", displayName: "Danse-/kunstfagundervisning (85.529 + 85.521)", setName: "The Role Room — dansestudio" },
];

interface BrregEntity {
  organisasjonsnummer?: string;
  navn?: string;
  antallAnsatte?: number;
  hjemmeside?: string;
  registreringsdatoEnhetsregisteret?: string;
  forretningsadresse?: { kommune?: string };
  konkurs?: boolean;
  underAvvikling?: boolean;
  underTvangsavviklingEllerTvangsopplosning?: boolean;
}

export interface ProspectRow {
  orgNr: string;
  name: string;
  municipality: string | null;
  employees: number | null;
  registeredAt: string | null;
  website: string | null;
}

/** Ren mapping (enhetstestet): registerenhet → prospektrad eller null. */
export function toProspectRow(e: BrregEntity): ProspectRow | null {
  if (!e.organisasjonsnummer || !e.navn) return null;
  if (e.konkurs || e.underAvvikling || e.underTvangsavviklingEllerTvangsopplosning) return null;
  return {
    orgNr: e.organisasjonsnummer,
    name: e.navn,
    municipality: e.forretningsadresse?.kommune ?? null,
    employees: e.antallAnsatte ?? null,
    registeredAt: e.registreringsdatoEnhetsregisteret ?? null,
    website: e.hjemmeside ?? null,
  };
}

async function fetchPage(naceCode: string, page: number): Promise<{ entities: BrregEntity[]; last: boolean } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(
      `${BRREG_API}?naeringskode=${naceCode}&size=${PAGE_SIZE}&page=${page}`,
      { signal: controller.signal },
    );
    if (!r.ok) return null;
    const body = (await r.json()) as {
      _embedded?: { enheter?: BrregEntity[] };
      page?: { totalPages?: number; number?: number };
    };
    const entities = body._embedded?.enheter ?? [];
    const totalPages = body.page?.totalPages ?? 0;
    return { entities, last: page >= totalPages - 1 || entities.length === 0 };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface SegmentSyncResult {
  segmentsRefreshed: string[];
  segmentsSkippedFresh: string[];
  companiesUpserted: number;
  errors: string[];
}

export async function syncProspectSegments(pool: Pool): Promise<SegmentSyncResult> {
  const errors: string[] = [];
  const refreshed: string[] = [];
  const skippedFresh: string[] = [];
  let upserted = 0;

  for (const def of SEGMENT_DEFINITIONS) {
    const nace = VERTICAL_NACE_MAP[def.setName];
    if (!nace) {
      errors.push(`${def.segmentKey}: mangler NACE-mapping`);
      continue;
    }

    const fresh = await pool.query<{ fresh: boolean }>(
      `SELECT (refreshed_at > now() - interval '${REFRESH_INTERVAL_DAYS} days') AS fresh
         FROM prospect_segments WHERE segment_key = $1`,
      [def.segmentKey],
    );
    if (fresh.rows[0]?.fresh) {
      skippedFresh.push(def.segmentKey);
      continue;
    }

    await pool.query(
      `INSERT INTO prospect_segments (segment_key, display_name, nace_codes)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (segment_key) DO UPDATE SET display_name = EXCLUDED.display_name, nace_codes = EXCLUDED.nace_codes`,
      [def.segmentKey, def.displayName, JSON.stringify(nace.codes)],
    );

    let total = 0;
    let truncated = false;
    for (const code of nace.codes) {
      for (let page = 0; page < MAX_PAGES; page++) {
        const result = await fetchPage(code, page);
        if (result === null) {
          errors.push(`${def.segmentKey}/${code} side ${page}: brreg-kall feilet`);
          break;
        }
        for (const entity of result.entities) {
          const row = toProspectRow(entity);
          if (!row) continue;
          const r = await pool.query(
            `INSERT INTO prospect_companies
               (segment_key, org_nr, name, municipality, employees, registered_at, website)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (segment_key, org_nr) DO UPDATE SET
               name = EXCLUDED.name, municipality = EXCLUDED.municipality,
               employees = EXCLUDED.employees, website = EXCLUDED.website`,
            [def.segmentKey, row.orgNr, row.name, row.municipality, row.employees, row.registeredAt, row.website],
          );
          upserted += r.rowCount ?? 0;
          total += 1;
        }
        if (result.last) break;
        if (page === MAX_PAGES - 1) truncated = true;
      }
    }

    await pool.query(
      `UPDATE prospect_segments
          SET total_found = $2, truncated = $3, refreshed_at = now()
        WHERE segment_key = $1`,
      [def.segmentKey, total, truncated],
    );
    refreshed.push(def.segmentKey);
  }

  return { segmentsRefreshed: refreshed, segmentsSkippedFresh: skippedFresh, companiesUpserted: upserted, errors };
}
