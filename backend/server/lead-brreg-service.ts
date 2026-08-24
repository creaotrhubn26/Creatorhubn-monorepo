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
import { fetchIprProfile, type IprProfile } from "./lead-ip-service.js";
import { classifyByNace } from "./role-room-agent-nace-profile.js";

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

/** Nøkkeltall fra Regnskapsregisteret (åpent API) — samme tall proff.no viser. */
export interface CompanyFinancials {
  year: number;
  currency: string;
  revenue: number | null; // sum driftsinntekter
  operatingResult: number | null;
  resultBeforeTax: number | null;
  netResult: number | null; // årsresultat
  equity: number | null;
  totalAssets: number | null; // sum egenkapital og gjeld
  /** Avledet: egenkapital/totalkapital (soliditet), 0–1. */
  equityRatio: number | null;
  /** Avledet: driftsresultat/driftsinntekter (lønnsomhet), kan være negativ. */
  operatingMargin: number | null;
}

export interface EnrichmentResult {
  found: boolean;
  orgNr?: string;
  source: "brreg";
  fetchedAt: string;
  /** true = koblet automatisk via navnesøk (nattlig jobb) — UI viser «bekreft». */
  autoLinked?: boolean;
  /** Navnet BRREG-treffet hadde — så brukeren kan vurdere koblingen. */
  matchedName?: string;
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
    /** Kartverket-geokodet fra forretningsadressen (kun satt av
     *  lookupCompanyForNewLead — null hvis geokoding feilet/ingen adresse). */
    latitude: number | null;
    longitude: number | null;
  };
  contacts?: Array<{
    role: string;
    name: string;
  }>;
  /** null = hentet men ikke funnet (f.eks. ENK leverer ikke årsregnskap). */
  financials?: CompanyFinancials | null;
  /** Patentstyret: varemerker/patenter/design. null = ingen registrerte rettigheter. */
  ip?: IprProfile | null;
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
async function findOrgNumberByName(name: string): Promise<{ orgNr: string; navn: string } | null> {
  const url = `${BRREG_API}/enheter?navn=${encodeURIComponent(name)}&size=3`;
  const r = await fetchWithTimeout(url);
  if (!r.ok) return null;
  const body = await r.json() as { _embedded?: { enheter?: BrregUnit[] } };
  const hit = body._embedded?.enheter?.[0];
  return hit?.organisasjonsnummer ? { orgNr: hit.organisasjonsnummer, navn: hit.navn ?? "" } : null;
}

/**
 * Org.nr fra fritekst (visittkort-OCR): 9 sifre m/ gyldig mod11-
 * kontrollsiffer. Kort har ofte org.nr trykket — det er den sikreste
 * koblingen som finnes, sikrere enn ethvert navnesøk.
 */
export function extractOrgNrFromText(text: string): string | null {
  const candidates = text.match(/\b\d{3}[ .]?\d{3}[ .]?\d{3}\b/g) ?? [];
  for (const raw of candidates) {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits.length !== 9) continue;
    const weights = [3, 2, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
    const remainder = sum % 11;
    const control = remainder === 0 ? 0 : 11 - remainder;
    if (control !== 10 && control === Number(digits[8])) return digits;
  }
  return null;
}

/**
 * Resolv org.nr for et skannet visittkort (iPad #182 → berikelse):
 *   1. Gyldig org.nr i OCR-teksten → bruk det (sikrest).
 *   2. Ellers: BRREG-navnesøk på FIRMANAVNET (aldri personnavnet) med
 *      samme match-vakt som nattjobben — vagt treff kobles aldri
 *      automatisk, det rapporteres som forslag i stedet.
 */
export async function resolveOrgNrForCard(input: {
  company: string | null;
  rawText: string | null;
}): Promise<
  | { status: "linked"; orgNr: string; via: "ocr_orgnr" | "name_match"; matchedName: string | null }
  | { status: "suggestion"; orgNr: string; matchedName: string }
  | { status: "no_match" }
> {
  const fromText = input.rawText ? extractOrgNrFromText(input.rawText) : null;
  if (fromText) {
    const unit = await getCompanyByOrgNr(fromText).catch(() => null);
    if (unit) return { status: "linked", orgNr: fromText, via: "ocr_orgnr", matchedName: unit.navn ?? null };
    // Org.nr besto mod11 men finnes ikke i registeret — ikke koble.
  }
  const company = input.company?.trim();
  if (!company || company.length < 3) return { status: "no_match" };
  const hit = await findOrgNumberByName(company).catch(() => null);
  if (!hit) return { status: "no_match" };
  if (namesMatchForAutoLink(company, hit.navn)) {
    return { status: "linked", orgNr: hit.orgNr, via: "name_match", matchedName: hit.navn };
  }
  return { status: "suggestion", orgNr: hit.orgNr, matchedName: hit.navn };
}

/**
 * Match-vakt for AUTOMATISK kobling: normaliserte navn (uten org-form-
 * suffiks) må inneholde hverandre. «Foto Hansen» ↔ «FOTO HANSEN AS» er
 * ok; «Hansen» ↔ «Hansen Bygg og Anlegg AS» er det ikke (for kort/vagt).
 */
export function namesMatchForAutoLink(leadName: string, brregName: string): boolean {
  const norm = (x: string) =>
    x.toLowerCase()
      .replace(/(as|asa|ans|da|enk|sa|ba)/g, " ")
      .replace(/[^a-z0-9æøå]+/g, " ")
      .trim();
  const a = norm(leadName);
  const b = norm(brregName);
  if (a.length < 5 || b.length === 0) return false;
  if (a === b) return true;
  // Containment godtas kun for navn med substans (≥2 ord eller ≥10 tegn):
  // «hansen» ⊂ «hansen bygg og anlegg» er for vagt til auto-kobling.
  const substantial = (x: string) => x.split(" ").length >= 2 || x.length >= 10;
  if (b.includes(a) && substantial(a)) return true;
  if (a.includes(b) && substantial(b)) return true;
  return false;
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

interface RegnskapEntry {
  regnskapsperiode?: { tilDato?: string };
  valuta?: string;
  resultatregnskapResultat?: {
    aarsresultat?: number;
    ordinaertResultatFoerSkattekostnad?: number;
    driftsresultat?: {
      driftsresultat?: number;
      driftsinntekter?: { sumDriftsinntekter?: number };
    };
  };
  egenkapitalGjeld?: {
    sumEgenkapitalGjeld?: number;
    egenkapital?: { sumEgenkapital?: number };
  };
}

/** Ren mapping (enhetstestet) — Regnskapsregisterets struktur → nøkkeltall. */
export function mapRegnskapEntry(entry: RegnskapEntry): CompanyFinancials | null {
  const til = entry.regnskapsperiode?.tilDato;
  const year = til ? Number(til.slice(0, 4)) : NaN;
  if (!Number.isFinite(year)) return null;
  const rr = entry.resultatregnskapResultat;
  const revenue = rr?.driftsresultat?.driftsinntekter?.sumDriftsinntekter ?? null;
  const operatingResult = rr?.driftsresultat?.driftsresultat ?? null;
  const equity = entry.egenkapitalGjeld?.egenkapital?.sumEgenkapital ?? null;
  const totalAssets = entry.egenkapitalGjeld?.sumEgenkapitalGjeld ?? null;
  return {
    year,
    currency: entry.valuta ?? "NOK",
    revenue,
    operatingResult,
    resultBeforeTax: rr?.ordinaertResultatFoerSkattekostnad ?? null,
    netResult: rr?.aarsresultat ?? null,
    equity,
    totalAssets,
    // Avledede nøkkeltall beregnes KUN når begge ledd finnes — aldri 0-default
    equityRatio:
      equity !== null && totalAssets !== null && totalAssets > 0
        ? Math.round((equity / totalAssets) * 1000) / 1000
        : null,
    operatingMargin:
      operatingResult !== null && revenue !== null && revenue > 0
        ? Math.round((operatingResult / revenue) * 1000) / 1000
        : null,
  };
}

/**
 * Siste innleverte årsregnskap fra Regnskapsregisteret. null er et ÆRLIG
 * svar: ENK leverer ikke årsregnskap, nystartede har ikke levert ennå.
 */
async function getCompanyFinancials(orgNr: string): Promise<CompanyFinancials | null> {
  try {
    const r = await fetchWithTimeout(
      `https://data.brreg.no/regnskapsregisteret/regnskap/${orgNr}`,
    );
    if (!r.ok) return null;
    const body = (await r.json()) as RegnskapEntry[];
    if (!Array.isArray(body) || body.length === 0) return null;
    // API-et returnerer nyeste først; velg entry med høyest år for sikkerhets skyld
    const mapped = body
      .map(mapRegnskapEntry)
      .filter((x): x is CompanyFinancials => x !== null)
      .sort((a, b) => b.year - a.year);
    return mapped[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Oppslag FØR en lead finnes (2026-08-16) — «Legg til lead»-skjemaets
 * scan-felt (Kart/Leads-fanen) var 100% mocket (fylte alltid inn samme
 * fiktive «Nordic Elektro AS» uansett input). Denne slår faktisk opp mot
 * BRREG: 9-sifret org.nr → direkte detalj-oppslag; ellers fritekst-søk
 * (fungerer for både bedriftsnavn og — best-effort — domenenavnet i en
 * nettside-URL, siden BRREG ikke støtter søk på hjemmeside direkte).
 */

/**
 * Kartverket/Geonorge fremover-geokoding (2026-08-16) — scan-opprettede
 * leads fikk ALDRI koordinater (AddLeadSheets kartforhåndsvisning stod
 * hardkodet på Oslo sentrum uansett bedrift), i motsetning til pin-drop-
 * flyten som allerede bruker Kartverket for reverse-geocoding. Samme
 * gratis Geonorge-adresse-API, bare fremover: tekst → koordinat.
 */
async function geocodeBrregAddress(
  addressText: string,
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const url = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(addressText)}&fuzzy=true&treffPerSide=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const payload = (await res.json()) as { adresser?: Array<{ representasjonspunkt?: { lat?: number; lon?: number } }> };
    const hit = payload.adresser?.[0]?.representasjonspunkt;
    if (typeof hit?.lat !== "number" || typeof hit?.lon !== "number") return null;
    return { latitude: hit.lat, longitude: hit.lon };
  } catch {
    return null;
  }
}

export async function lookupCompanyForNewLead(
  rawQuery: string,
): Promise<{ found: boolean; company?: EnrichmentResult["company"] }> {
  const query = rawQuery.trim();
  if (!query) return { found: false };

  const orgNr = /^\d[\d .]{7,}\d$/.test(query) ? query.replace(/[^\d]/g, "") : null;
  let unit: BrregUnit | null = null;

  if (orgNr && orgNr.length === 9) {
    unit = await getCompanyByOrgNr(orgNr).catch(() => null);
  }
  if (!unit) {
    // Nettside-input ("nordicelektro.no"): domenets rot brukes som navne-
    // søk-gjetning — BRREG-API-et har ingen hjemmeside-søk. Fritekst
    // (bedriftsnavn) går rett gjennom uendret.
    const searchTerm = query.includes(".") && !query.includes(" ")
      ? query.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(".")[0]
      : query;
    const hit = await findOrgNumberByName(searchTerm).catch(() => null);
    if (hit) unit = await getCompanyByOrgNr(hit.orgNr).catch(() => null);
  }
  if (!unit) return { found: false };

  const address = unit.forretningsadresse?.adresse?.join(", ") || null;
  const postalCode = unit.forretningsadresse?.postnummer ?? null;
  const city = unit.forretningsadresse?.poststed ?? null;
  const geocodeQuery = address ? `${address}, ${postalCode ?? ""} ${city ?? ""}`.trim() : null;
  const geo = geocodeQuery ? await geocodeBrregAddress(geocodeQuery) : null;

  return {
    found: true,
    company: {
      name: unit.navn,
      orgNr: unit.organisasjonsnummer,
      orgForm: unit.organisasjonsform?.beskrivelse ?? null,
      registeredAt: unit.registreringsdatoEnhetsregisteret ?? null,
      naceCode: unit.naeringskode1?.kode ?? null,
      // Bruk klassifisert bransje-profil (samme motor som Role Room Agent)
      // fremfor rå NACE-tekst ("96.02 Frisering..."), fallback til rå tekst
      // for koder tabellen bevisst ikke tar stilling til (2026-08-16).
      naceDescription: classifyByNace(unit.naeringskode1?.kode ?? null)?.industry
        ?? unit.naeringskode1?.beskrivelse
        ?? null,
      employees: unit.antallAnsatte ?? null,
      address,
      postalCode,
      city,
      municipality: unit.forretningsadresse?.kommune ?? null,
      website: unit.hjemmeside ?? null,
      isBankrupt: Boolean(unit.konkurs),
      isInLiquidation: Boolean(unit.underAvvikling || unit.underTvangsavviklingEllerTvangsopplosning),
      status: unit.konkurs ? "bankrupt" : (unit.underAvvikling ? "in_liquidation" : "active"),
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
    },
  };
}

export async function enrichLeadWithBrreg(
  pool: Pool,
  args: {
    leadId: string;
    workspaceOwnerUserId: string;
    forceRefresh?: boolean;
    /** Nattlig jobb: krever navne-match-vakt og merker resultatet autoLinked. */
    autoMode?: boolean;
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
  let autoLinked = false;
  let matchedName: string | undefined;
  if (!orgNr) {
    const hit = await findOrgNumberByName(lead.name);
    if (hit && args.autoMode && !namesMatchForAutoLink(lead.name, hit.navn)) {
      // Match-vakten sier nei: aldri koble automatisk på vagt navnetreff.
      const result: EnrichmentResult = {
        found: false,
        source: "brreg",
        fetchedAt: new Date().toISOString(),
        matchedName: hit.navn,
      };
      await pool.query(
        `UPDATE crm_customers SET enrichment_data = $3::jsonb, enriched_at = NOW()
          WHERE id = $1 AND owner_user_id = $2`,
        [lead.id, args.workspaceOwnerUserId, JSON.stringify(result)],
      );
      return result;
    }
    orgNr = hit?.orgNr ?? null;
    if (orgNr && args.autoMode) {
      autoLinked = true;
      matchedName = hit!.navn;
    }
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

  // 3. Detaljer + roller + regnskap + IP parallelt
  const [company, contacts, financials, ip] = await Promise.all([
    getCompanyByOrgNr(orgNr),
    getCompanyRoles(orgNr),
    getCompanyFinancials(orgNr),
    fetchIprProfile(orgNr, lead.name),
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
    ...(autoLinked ? { autoLinked: true, matchedName } : {}),
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
      latitude: null,
      longitude: null,
    },
    contacts,
    financials,
    ip,
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
