/**
 * Role Room — kunde-bedrift legal entity discovery (Slice 6 add-on).
 *
 * Når en producer skriver inn et BRAND-navn ("Holy Crust") må vi finne
 * den faktiske JURIDISKE bedriften ("Macks Invest AS, 933 469 395") før
 * vi kan trekke Brreg-data, mva-status, daglig leder osv. Tre signaler
 * brukes til å rangere kandidater:
 *
 *   1. Mod-11-validert orgnr scrapet fra brand-sidens footer/Om-oss
 *      (holycrust.no har "933 469 395" i footeren). Eksakt match,
 *      vinner alltid.
 *   2. Brregs `hjemmeside`-felt matcher kunde-URL-host (tegn på at
 *      Brreg-bedriften driver akkurat denne sida).
 *   3. Navn-likhet mellom brand og firmanavn (jaccard / stemmer-startss
 *      med brand-navn).
 *
 * Returnerer 1-5 kandidater. UI bruker dette til en "Stemmer dette?"-
 * dialog så producer eller kunde bekrefter før resten av flyten kjører.
 */

const BRREG_API_BASE = "https://data.brreg.no/enhetsregisteret/api";

export interface LegalEntityCandidate {
  organizationNumber: string;
  name: string;
  registeredAddress: string | null;
  postalCode: string | null;
  postalCity: string | null;
  municipality: string | null;
  municipalityNumber: string | null;
  website: string | null;
  industryCode: { code: string | null; description: string | null };
  /** 0-100 confidence ranking. */
  score: number;
  /** Why this candidate ranked where it did (transparency). */
  matchReasons: string[];
  /** True når Brregs `hjemmeside`-felt matcher den scannede URL-en
   *  exact (eller mod www-prefix). Strongest possible match. */
  websiteHostMatch: boolean;
  /** True når orgnr ble extracted direkte fra brand-sidens HTML-footer
   *  (mod-11 validert). Eksakt match, ingen tvil. */
  scrapedFromBrandWebsite: boolean;
}

export interface FindCandidatesInput {
  brandName: string;
  /** Customer's brand website (holycrust.no). When provided, we scrape
   *  the footer for an embedded orgnr — that's the strongest signal. */
  websiteUrl?: string | null;
  /** When the producer already knows the kommune, use it to narrow the
   *  Brreg name-search and avoid same-name companies in other regions. */
  municipalityNumber?: string | null;
}

/** Mod-11 checksum validation for a 9-digit Norwegian organization
 *  number. Reused from role-room-agent.ts to keep this module
 *  standalone. */
function isValidNorwegianOrgNumber(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false;
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(digits[i]) * weights[i];
  const remainder = sum % 11;
  const checksum = remainder === 0 ? 0 : 11 - remainder;
  if (checksum === 10) return false;
  return checksum === Number(digits[8]);
}

/** Extract the first mod-11-valid 9-digit orgnr from raw HTML. */
function extractOrgNumberFromHtml(html: string): string | null {
  if (!html) return null;
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const labelled = stripped.match(
    /(?:org\.?\s*nr\.?|organisasjonsnummer|orgnr|mva)\s*[:.]?\s*(?:no)?\s*((?:\d[\s.-]?){9})/i,
  );
  if (labelled) {
    const digits = labelled[1].replace(/\D/g, "");
    if (digits.length === 9 && isValidNorwegianOrgNumber(digits)) return digits;
  }
  const candidates = stripped.match(/\b\d{3}[\s.-]?\d{3}[\s.-]?\d{3}\b/g) ?? [];
  for (const c of candidates) {
    const digits = c.replace(/\D/g, "");
    if (digits.length === 9 && isValidNorwegianOrgNumber(digits)) return digits;
  }
  return null;
}

function normalizeHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function brregUnitToCandidate(
  unit: Record<string, unknown>,
  opts: { brandName: string; websiteHost: string | null; scrapedOrgNumber: string | null },
): LegalEntityCandidate | null {
  const orgNumber = typeof unit.organisasjonsnummer === "string" ? unit.organisasjonsnummer : null;
  const name = typeof unit.navn === "string" ? unit.navn : null;
  if (!orgNumber || !name || !isValidNorwegianOrgNumber(orgNumber)) return null;

  const fa = unit.forretningsadresse && typeof unit.forretningsadresse === "object"
    ? (unit.forretningsadresse as Record<string, unknown>)
    : null;
  const get = (k: string): string | null =>
    fa && typeof fa[k] === "string" ? (fa[k] as string) : null;
  const adresse = Array.isArray(fa?.adresse) ? (fa?.adresse as string[]).join(", ") : null;

  const naceObj = unit.naeringskode1 && typeof unit.naeringskode1 === "object"
    ? (unit.naeringskode1 as Record<string, unknown>)
    : null;
  const brregHost = normalizeHost(typeof unit.hjemmeside === "string" ? unit.hjemmeside : null);
  const websiteHostMatch = Boolean(opts.websiteHost && brregHost && brregHost === opts.websiteHost);
  const scrapedFromBrandWebsite = orgNumber === opts.scrapedOrgNumber;

  // Score:
  //   100  scraped orgnr matches Brreg result (eksakt, mod-11-validert)
  //   +50  Brregs hjemmeside-felt = brand-host
  //   +30  navn-startss-med eller starter med brand-name (case-ins)
  //   +15  navn-inneholder brand-name som ord
  //   +10  same kommune
  //   +5   has registered website
  let score = 0;
  const reasons: string[] = [];
  if (scrapedFromBrandWebsite) {
    score = 100;
    reasons.push(`Orgnr scrapet fra ${opts.brandName}-nettsiden, mod-11-validert`);
    return {
      organizationNumber: orgNumber,
      name,
      registeredAddress: adresse,
      postalCode: get("postnummer"),
      postalCity: get("poststed"),
      municipality: get("kommune"),
      municipalityNumber: get("kommunenummer"),
      website: typeof unit.hjemmeside === "string" ? unit.hjemmeside : null,
      industryCode: {
        code: typeof naceObj?.kode === "string" ? naceObj.kode : null,
        description: typeof naceObj?.beskrivelse === "string" ? naceObj.beskrivelse : null,
      },
      score,
      matchReasons: reasons,
      websiteHostMatch,
      scrapedFromBrandWebsite,
    };
  }
  if (websiteHostMatch) {
    score += 50;
    reasons.push(`Brreg-bedriftens hjemmeside-felt matcher merkevarens domene`);
  }
  const lowerName = name.toLowerCase();
  const lowerBrand = opts.brandName.toLowerCase();
  if (lowerName.startsWith(lowerBrand) || lowerName.endsWith(lowerBrand)) {
    score += 30;
    reasons.push(`Bedriftsnavnet starter eller slutter med "${opts.brandName}"`);
  } else if (lowerName.includes(lowerBrand)) {
    score += 15;
    reasons.push(`Bedriftsnavnet inneholder "${opts.brandName}"`);
  }
  if (typeof unit.hjemmeside === "string" && unit.hjemmeside.length > 0) {
    score += 5;
    reasons.push(`Har egen nettside i Brreg`);
  }
  if (score === 0) {
    // Bare name-search match without any boost — still include but with
    // a baseline so the UI can show it as a long-shot candidate.
    score = 10;
    reasons.push(`Brreg navn-treff på "${opts.brandName}"`);
  }

  return {
    organizationNumber: orgNumber,
    name,
    registeredAddress: adresse,
    postalCode: get("postnummer"),
    postalCity: get("poststed"),
    municipality: get("kommune"),
    municipalityNumber: get("kommunenummer"),
    website: typeof unit.hjemmeside === "string" ? unit.hjemmeside : null,
    industryCode: {
      code: typeof naceObj?.kode === "string" ? naceObj.kode : null,
      description: typeof naceObj?.beskrivelse === "string" ? naceObj.beskrivelse : null,
    },
    score: Math.min(100, score),
    matchReasons: reasons,
    websiteHostMatch,
    scrapedFromBrandWebsite,
  };
}

async function brregLookupByOrgNumber(orgNumber: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${BRREG_API_BASE}/enheter/${orgNumber}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return null;
    return (await r.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

async function brregNameSearch(
  brandName: string,
  municipalityNumber: string | null,
): Promise<Array<Record<string, unknown>>> {
  const collected: Array<Record<string, unknown>> = [];
  // Try the full brand first, then progressive trim — so "Holy Crust"
  // searches "holy crust", then "crust", then "holy".
  const variations = new Set<string>();
  const trimmed = brandName.trim();
  if (trimmed.length >= 2) variations.add(trimmed);
  for (const word of trimmed.split(/\s+/)) {
    if (word.length >= 3) variations.add(word);
  }

  for (const term of variations) {
    const params = new URLSearchParams();
    params.set("navn", term);
    params.set("size", "10");
    params.set("konkurs", "false");
    params.set("underAvvikling", "false");
    if (municipalityNumber) params.set("kommunenummer", municipalityNumber);
    try {
      const r = await fetch(`${BRREG_API_BASE}/enheter?${params.toString()}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) continue;
      const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
      const embedded = j?._embedded as Record<string, unknown> | undefined;
      const units = (embedded?.enheter as Array<Record<string, unknown>>) ?? [];
      for (const u of units) {
        if (collected.find((c) => c.organisasjonsnummer === u.organisasjonsnummer)) continue;
        collected.push(u);
      }
    } catch {
      /* best-effort */
    }
  }

  return collected;
}

/**
 * Find candidate legal entities for a given brand name.
 *
 * Pipeline:
 *   1. If websiteUrl is given, fetch it and try to scrape a mod-11-
 *      validated orgnr from the footer / Om-oss text.
 *   2. If a scraped orgnr was found, look it up directly in Brreg.
 *      That candidate gets score 100 and is always first.
 *   3. Run a Brreg name search for the brand name (and word variations),
 *      narrowed to the municipality if provided.
 *   4. Score every result against the brand + scraped-host signals,
 *      sort desc by score, return up to 5.
 */
export async function findCustomerLegalEntityCandidates(
  input: FindCandidatesInput,
): Promise<LegalEntityCandidate[]> {
  const brandName = input.brandName.trim();
  if (brandName.length < 2) return [];

  const websiteHost = normalizeHost(input.websiteUrl ?? null);
  let scrapedOrgNumber: string | null = null;
  let scrapedUnit: Record<string, unknown> | null = null;

  // Step 1: scrape the brand website for an embedded orgnr.
  if (input.websiteUrl) {
    try {
      const r = await fetch(input.websiteUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RoleRoomAgent/1.0)" },
        redirect: "follow",
        signal: AbortSignal.timeout(7_000),
      });
      if (r.ok) {
        const html = await r.text();
        scrapedOrgNumber = extractOrgNumberFromHtml(html);
      }
    } catch {
      /* best-effort */
    }
  }

  // Step 2: if scraped, look it up directly.
  if (scrapedOrgNumber) {
    scrapedUnit = await brregLookupByOrgNumber(scrapedOrgNumber);
  }

  // Step 3: run the name search.
  const nameSearchResults = await brregNameSearch(brandName, input.municipalityNumber ?? null);

  // Step 4: combine + dedupe + score + rank.
  const seen = new Set<string>();
  const candidates: LegalEntityCandidate[] = [];

  if (scrapedUnit && typeof scrapedUnit.organisasjonsnummer === "string") {
    const c = brregUnitToCandidate(scrapedUnit, {
      brandName,
      websiteHost,
      scrapedOrgNumber,
    });
    if (c) {
      candidates.push(c);
      seen.add(c.organizationNumber);
    }
  }

  for (const u of nameSearchResults) {
    const orgNr = u.organisasjonsnummer;
    if (typeof orgNr !== "string" || seen.has(orgNr)) continue;
    seen.add(orgNr);
    const c = brregUnitToCandidate(u, { brandName, websiteHost, scrapedOrgNumber });
    if (c) candidates.push(c);
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
}
