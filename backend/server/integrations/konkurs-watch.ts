/**
 * konkurs-watch.ts — konkursvakten
 *
 * Daglig statussjekk mot Enhetsregisteret for ALLE CRM-selskaper med
 * organisasjonsnummer (kunder OG leads): konkurs, under avvikling eller
 * tvangsavvikling blir en 'risk'-trigger → kritisk innsikt i feeden.
 *
 * Hvorfor det haster mer enn andre signaler: en kunde som går konkurs
 * er et handlingsvindu for å sikre utestående krav og stoppe leveranser
 * — hver dag teller.
 *
 * Redelighet:
 *  - Kilden er registerfakta (samme flagg berikelsen viser), aldri
 *    rykter/media; friske selskaper produserer INGENTING.
 *  - eventId = orgnr|status → én innsikt per statusendring, ikke én
 *    per dag (dedup i trigger_events + innsikts-dedup).
 *  - API-feil på ett selskap rapporteres og stopper ikke resten.
 */

import type { Pool } from "pg";

const BRREG_API = "https://data.brreg.no/enhetsregisteret/api";
const FETCH_TIMEOUT_MS = 10_000;
/** Kostnadstak per kjøring — porteføljer over dette tas i neste kjøring. */
const MAX_COMPANIES_PER_RUN = 200;

export type RiskStatus = "bankrupt" | "liquidation" | "forced_liquidation";

export interface RiskFinding {
  orgNr: string;
  companyName: string;
  status: RiskStatus;
}

interface BrregStatusFlags {
  navn?: string;
  konkurs?: boolean;
  underAvvikling?: boolean;
  underTvangsavviklingEllerTvangsopplosning?: boolean;
  slettedato?: string;
}

/** Ren mapping (enhetstestet): registerflagg → risikostatus eller null. */
export function mapRiskStatus(flags: BrregStatusFlags): RiskStatus | null {
  if (flags.konkurs) return "bankrupt";
  if (flags.underTvangsavviklingEllerTvangsopplosning) return "forced_liquidation";
  if (flags.underAvvikling) return "liquidation";
  return null;
}

export const RISK_LABELS: Record<RiskStatus, string> = {
  bankrupt: "KONKURS",
  forced_liquidation: "under tvangsavvikling",
  liquidation: "under avvikling",
};

async function fetchStatusFlags(orgNr: string): Promise<BrregStatusFlags | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(`${BRREG_API}/enheter/${orgNr}`, { signal: controller.signal });
    if (r.status === 410) return { slettedato: "slettet" }; // slettet enhet
    if (!r.ok) return null;
    return (await r.json()) as BrregStatusFlags;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface KonkursWatchResult {
  companiesChecked: number;
  atRisk: number;
  eventsInserted: number;
  errors: string[];
}

export async function runKonkursWatch(pool: Pool): Promise<KonkursWatchResult> {
  const errors: string[] = [];

  // Eldst sjekkede først → porteføljer over taket roterer gjennom over dager.
  // 'lost' er ute (relasjonen er avsluttet); 'won'/aktive er viktigst.
  const companies = await pool.query<{
    organization_id: string;
    name: string;
    enrichment_org_nr: string;
  }>(
    `SELECT DISTINCT ON (c.enrichment_org_nr)
            c.organization_id::text, c.name, c.enrichment_org_nr
       FROM crm_customers c
      WHERE c.organization_id IS NOT NULL
        AND c.archived_at IS NULL
        AND c.enrichment_org_nr IS NOT NULL
        AND COALESCE(c.pipeline_stage, '') <> 'lost'
      ORDER BY c.enrichment_org_nr, c.updated_at DESC
      LIMIT ${MAX_COMPANIES_PER_RUN}`,
  );

  let atRisk = 0;
  let inserted = 0;
  for (const company of companies.rows) {
    const flags = await fetchStatusFlags(company.enrichment_org_nr);
    if (flags === null) {
      errors.push(`${company.enrichment_org_nr}: brreg-oppslag feilet`);
      continue;
    }
    const status = mapRiskStatus(flags);
    if (!status) continue;
    atRisk += 1;
    try {
      const r = await pool.query(
        `INSERT INTO trigger_events
           (organization_id, source, event_id, kind, title, url, published_at, matched_topic, raw)
         VALUES ($1::uuid, 'brreg', $2, 'risk', $3, $4, CURRENT_DATE, $5, $6::jsonb)
         ON CONFLICT (organization_id, source, event_id) DO NOTHING`,
        [
          company.organization_id,
          `${company.enrichment_org_nr}|${status}`,
          `${company.name} er ${RISK_LABELS[status]}`,
          `https://virksomhet.brreg.no/nb/oppslag/enheter/${company.enrichment_org_nr}`,
          company.name,
          JSON.stringify({ orgNr: company.enrichment_org_nr, status }),
        ],
      );
      inserted += r.rowCount ?? 0;
    } catch (err) {
      errors.push(`${company.enrichment_org_nr}: ${String(err).slice(0, 100)}`);
    }
  }

  return { companiesChecked: companies.rows.length, atRisk, eventsInserted: inserted, errors };
}
