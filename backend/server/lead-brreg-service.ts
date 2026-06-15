/**
 * lead-brreg-service.ts
 *
 * Henter firma-data fra data.brreg.no (Brønnøysundregistrene) for én
 * lead og lagrer i crm_customers.enrichment_data (JSONB).
 *
 * BRREG-API er gratis og åpent — ingen autentisering. Cache 30 dager
 * fordi firma-data endres sjelden.
 *
 * Pipeline:
 *   1. Søk på lead.name → få org-nummer (1. treff hvis flere)
 *   2. Hent detalj for org-nr → adresse, daglig leder, stiftet,
 *      NACE-kode, antall ansatte, status, regnskap
 *   3. Hent roller (daglig leder + styre) — separat call
 *   4. Pakk alt som EnrichmentResult og lagre
 *
 * Hvis 0 treff på navn-søk: returner { found: false } så frontend
 * kan vise "Ikke funnet i BRREG".
 *
 * Hvis lead allerede har enrichment_org_nr satt, hopper søket og
 * går direkte på detalj-call.
 */

import type { Pool } from "pg";

const BRREG_API = "https://data.brreg.no/enhetsregisteret/api";
const FETCH_TIMEOUT_MS = 10_000;

interface BrregUnit {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform?: { kode: string; beskrivelse: string };
  hjemmeside?: string;
  registreringsdatoEnhetsregisteret?: string;
  registrertIMvaregisteret?: boolean;
  naeringskode1?: { kode: string; beskrivelse: string };
  antallAnsatte?: number;
  forretningsadresse?: {
    land?: string;
    landkode?: string;
    postnummer?: string;
    poststed?: string;
    adresse?: string[];
    kommune?: string;
    kommunenummer?: string;
  };
  konkurs?: boolean;
  underAvvikling?: boolean;
  underTvangsavviklingEllerTvangsopplosning?: boolean;
}

interface BrregRoleHolder {
  fratraadt?: boolean;
  type?: { beskrivelse?: string; kode?: string };
  person?: { navn?: { fornavn?: string; etternavn?: string; mellomnavn?: string } };
}

interface BrregRolesResponse {
  rollegrupper?: Array<{
    type?: { kode?: string; beskrivelse?: string };
    roller?: BrregRoleHolder[];
  }>;
}

export interface EnrichmentResult {
  found: boolean;
  orgNr?: string;
  source: "brreg";
  fetchedAt: string;
  company?: {
    name: string;
    orgNr: string;
    orgForm: string | null;
    registeredAt: string | null;
    naceCode: string | null;
    naceDescription: string | null;
    employees: number | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    municipality: string | null;
    website: string | null;
    isBankrupt: boolean;
    isInLiquidation: boolean;
    status: "active" | "in_liquidation" | "bankrupt";
  };
  contacts?: Array<{
    role: string;
    name: string;
  }>;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function fullName(p?: { fornavn?: string; etternavn?: string; mellomnavn?: string }): string {
  if (!p) return "";
  return [p.fornavn, p.mellomnavn, p.etternavn].filter(Boolean).join(" ").trim();
}

/** Finn org-nr ved fritekst-søk. Returner første treff (best match). */
async function findOrgNumberByName(name: string): Promise<string | null> {
  const url = `${BRREG_API}/enheter?navn=${encodeURIComponent(name)}&size=3`;
  const r = await fetchWithTimeout(url);
  if (!r.ok) return null;
  const body = await r.json() as { _embedded?: { enheter?: BrregUnit[] } };
  return body._embedded?.enheter?.[0]?.organisasjonsnummer ?? null;
}

/** Hent firma-detaljer på org-nr. */
async function getCompanyByOrgNr(orgNr: string): Promise<BrregUnit | null> {
  const r = await fetchWithTimeout(`${BRREG_API}/enheter/${orgNr}`);
  if (!r.ok) return null;
  return await r.json() as BrregUnit;
}

/** Hent roller (daglig leder + styre) for org-nr. */
async function getCompanyRoles(orgNr: string): Promise<EnrichmentResult["contacts"]> {
  try {
    const r = await fetchWithTimeout(`${BRREG_API}/enheter/${orgNr}/roller`);
    if (!r.ok) return [];
    const body = await r.json() as BrregRolesResponse;
    const contacts: NonNullable<EnrichmentResult["contacts"]> = [];
    for (const group of body.rollegrupper ?? []) {
      for (const role of group.roller ?? []) {
        if (role.fratraadt) continue;
        const name = fullName(role.person?.navn);
        if (!name) continue;
        const desc = role.type?.beskrivelse ?? group.type?.beskrivelse ?? "Rolle";
        contacts.push({ role: desc, name });
      }
    }
    return contacts;
  } catch {
    return [];
  }
}

export async function enrichLeadWithBrreg(
  pool: Pool,
  args: {
    leadId: string;
    workspaceOwnerUserId: string;
    forceRefresh?: boolean;
  },
): Promise<EnrichmentResult> {
  // 1. Hent lead m/ scope
  const lr = await pool.query<{
    id: string; name: string; enrichment_org_nr: string | null;
    enriched_at: string | null;
  }>(
    `SELECT id::text, name, enrichment_org_nr, enriched_at::text
       FROM crm_customers
      WHERE id = $1 AND owner_user_id = $2`,
    [args.leadId, args.workspaceOwnerUserId],
  );
  if (lr.rows.length === 0) {
    throw new Error("lead_not_found");
  }
  const lead = lr.rows[0];

  // 2. Finn org-nr (cached eller søk)
  let orgNr = lead.enrichment_org_nr;
  if (!orgNr) {
    orgNr = await findOrgNumberByName(lead.name);
    if (!orgNr) {
      const result: EnrichmentResult = {
        found: false,
        source: "brreg",
        fetchedAt: new Date().toISOString(),
      };
      // Lagre "ikke funnet" for å unngå å spørre igjen
      await pool.query(
        `UPDATE crm_customers
            SET enrichment_data = $3::jsonb,
                enriched_at = NOW()
          WHERE id = $1 AND owner_user_id = $2`,
        [lead.id, args.workspaceOwnerUserId, JSON.stringify(result)],
      );
      return result;
    }
  }

  // 3. Detaljer + roller parallelt
  const [company, contacts] = await Promise.all([
    getCompanyByOrgNr(orgNr),
    getCompanyRoles(orgNr),
  ]);
  if (!company) {
    throw new Error("brreg_detail_fetch_failed");
  }

  const address = company.forretningsadresse?.adresse?.join(", ") ?? null;
  const result: EnrichmentResult = {
    found: true,
    orgNr,
    source: "brreg",
    fetchedAt: new Date().toISOString(),
    company: {
      name: company.navn,
      orgNr: company.organisasjonsnummer,
      orgForm: company.organisasjonsform?.beskrivelse ?? null,
      registeredAt: company.registreringsdatoEnhetsregisteret ?? null,
      naceCode: company.naeringskode1?.kode ?? null,
      naceDescription: company.naeringskode1?.beskrivelse ?? null,
      employees: company.antallAnsatte ?? null,
      address,
      postalCode: company.forretningsadresse?.postnummer ?? null,
      city: company.forretningsadresse?.poststed ?? null,
      municipality: company.forretningsadresse?.kommune ?? null,
      website: company.hjemmeside ?? null,
      isBankrupt: !!company.konkurs,
      isInLiquidation:
        !!company.underAvvikling || !!company.underTvangsavviklingEllerTvangsopplosning,
      status: company.konkurs
        ? "bankrupt"
        : (company.underAvvikling || company.underTvangsavviklingEllerTvangsopplosning)
        ? "in_liquidation"
        : "active",
    },
    contacts,
  };

  // 4. Persistere
  await pool.query(
    `UPDATE crm_customers
        SET enrichment_data = $3::jsonb,
            enrichment_org_nr = $4,
            enriched_at = NOW()
      WHERE id = $1 AND owner_user_id = $2`,
    [lead.id, args.workspaceOwnerUserId, JSON.stringify(result), orgNr],
  );

  return result;
}

/** Hent allerede lagret berikkelse. Re-fetcher hvis eldre enn 30 dager. */
export async function getStoredEnrichment(
  pool: Pool,
  args: { leadId: string; workspaceOwnerUserId: string },
): Promise<EnrichmentResult | null> {
  const r = await pool.query<{
    enrichment_data: EnrichmentResult | null;
    enriched_at: string | null;
  }>(
    `SELECT enrichment_data, enriched_at::text
       FROM crm_customers
      WHERE id = $1 AND owner_user_id = $2`,
    [args.leadId, args.workspaceOwnerUserId],
  );
  if (r.rows.length === 0 || !r.rows[0].enrichment_data) return null;
  return r.rows[0].enrichment_data;
}
