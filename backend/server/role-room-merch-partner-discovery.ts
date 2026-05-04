/**
 * Role Room — Merch partner discovery + enrichment (Slice 6).
 *
 * "Hva slags klubber/skoler/foreninger ligger i kundens nabolag, og hva
 * vet vi om dem?" Bygger på samme datakilder vi allerede bruker for
 * konkurrenter og merch-leverandører:
 *   - Brreg Enhetsregister (NACE-kode + navn-/bydels-søk)
 *   - Hjemmeside-skraping (sponsorer, kontakt, medlemstall)
 *   - Meta Page Public Metadata (følgere, kategori, "About")
 *
 * Output mates inn i Slice 3's Claude-prompt så avtaleforslaget kan
 * referere til konkrete fakta om partneren ("Lindeberg Sportsklubb har
 * 4 lag med totalt ~120 medlemmer ifølge nettsiden") istedenfor
 * generiske antakelser.
 */

import type { Pool } from "pg";

import {
  type RoleRoomAgentBrregCompany,
  fetchBrregCompany,
} from "./role-room-agent.js";
import { enrichCompetitorWithMetaPage } from "./role-room-meta-pages.js";

export type MerchPartnerType =
  | "sportsklubb"
  | "event"
  | "skole"
  | "forening"
  | "bedrift";

/** NACE-koder per partner-type. Idrettslag (93.12) er det vi har
 *  empirisk verifisert fungerer for "Lindeberg Sportsklubb"-style
 *  treff. Skoler ligger primært under 85.10/85.20/85.31. Foreninger
 *  bruker 94.99 ("Andre interesseorganisasjoner"). Event/bedrift
 *  faller tilbake til Google Places fordi NACE er for vidt. */
const PARTNER_NACE_CODES: Record<MerchPartnerType, string[]> = {
  sportsklubb: ["93.12"],
  skole: ["85.100", "85.20", "85.31", "85.32"],
  forening: ["94.99"],
  event: [],
  bedrift: [],
};

/** Norske postnummer-prefix → bydel/lokasjons-keyword. Brukes til å
 *  utlede en søke-streng fra kundens adresse når post-stedet bare er
 *  "OSLO" (som det alltid er for Oslo-kommune i Brreg). Empirisk
 *  validert mot Crust AS (0694 → manglerud → IL Manglerud Star FOTBALL).
 *  Bygges ut etter som vi tester på flere kunder. */
const POSTAL_AREA_HINTS: ReadonlyArray<{ prefixes: string[]; keyword: string }> = [
  // Manglerud / Bryn / Helsfyr / Brynseng
  { prefixes: ["0671", "0672", "0673", "0691", "0692", "0694", "0695"], keyword: "manglerud" },
  { prefixes: ["0581", "0582", "0583", "0584", "0585", "0586", "0587", "0588"], keyword: "helsfyr" },
  { prefixes: ["0667"], keyword: "bryn" },
  // Østensjø / Bøler / Lambertseter / Abildsø
  { prefixes: ["0750", "0751", "0752"], keyword: "østensjø" },
  { prefixes: ["0680", "0683", "0685"], keyword: "bøler" },
  { prefixes: ["1188", "1187"], keyword: "lambertseter" },
  { prefixes: ["1181"], keyword: "abildsø" },
  // Groruddalen
  { prefixes: ["1066", "1067", "1068", "1069", "1071"], keyword: "lindeberg" },
  { prefixes: ["1051", "1052", "1053", "1054"], keyword: "ellingsrud" },
  { prefixes: ["1061", "1063", "1064", "1065"], keyword: "haugerud" },
  { prefixes: ["1086", "1087", "1088", "1089"], keyword: "grorud" },
  { prefixes: ["0975", "0977", "0980", "0981"], keyword: "stovner" },
  { prefixes: ["1081", "1082", "1083", "1084"], keyword: "rommen" },
  { prefixes: ["1090", "1091"], keyword: "vestli" },
  // Søndre Nordstrand / Bjørndal
  { prefixes: ["1166", "1167", "1168", "1169"], keyword: "bjørndal" },
  { prefixes: ["1178", "1182", "1184"], keyword: "ekeberg" },
  // Sentrum / indre øst
  { prefixes: ["0190", "0191", "0192"], keyword: "tøyen" },
  { prefixes: ["0560", "0561"], keyword: "carl berner" },
  { prefixes: ["0566", "0567"], keyword: "sinsen" },
  { prefixes: ["0653", "0654", "0655"], keyword: "bjølsen" },
  { prefixes: ["0455", "0456", "0457"], keyword: "torshov" },
  // Indre vest
  { prefixes: ["0277", "0278"], keyword: "skøyen" },
  { prefixes: ["0264", "0265"], keyword: "bygdøy" },
  // Nabokommuner
  { prefixes: ["1474"], keyword: "lørenskog" },
  { prefixes: ["1473"], keyword: "skårer" },
];

const BRREG_API_BASE = "https://data.brreg.no/enhetsregisteret/api";

export interface MerchPartnerCandidate {
  source: "brreg" | "google_places";
  /** Brreg orgnr when source = brreg. */
  organizationNumber?: string | null;
  /** Google place_id when source = google_places. */
  placeId?: string | null;
  name: string;
  websiteUrl?: string | null;
  formattedAddress?: string | null;
  /** Distance from customer's address in km. Null when source can't
   *  resolve coordinates. Used to rank "Lindeberg-naboklubber" above
   *  generic Oslo-wide hits. */
  distanceKm?: number | null;
  /** Brregs naeringskode1 (only when source = brreg). */
  naceCode?: string | null;
  naceLabel?: string | null;
  /** Inferred area (bydel) name based on customer address proximity.
   *  Same-bydel partners rank highest. */
  areaMatch?: string | null;
  /** Heuristic 0-100 ranking — used by the picker UI. */
  score: number;
  /** Why this candidate ranked where it did, for transparency. */
  evidence: string[];
}

export interface MerchPartnerEnrichment {
  candidate: MerchPartnerCandidate;
  brreg?: {
    daglig_leder_navn?: string | null;
    foundedYear?: number | null;
    employeeCount?: number | null;
    statusFlags?: { bankrupt?: boolean; underLiquidation?: boolean };
  };
  website?: {
    title?: string | null;
    metaDescription?: string | null;
    sponsorLine?: string | null;
    memberCountHint?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
  };
  metaPage?: {
    pageId?: string | null;
    pageName?: string | null;
    followersCount?: number | null;
    fanCount?: number | null;
    category?: string | null;
    about?: string | null;
    pageUrl?: string | null;
    verified?: boolean;
  };
  /** Free-text summary of what we know — feeds into Slice 3 prompt
   *  so Claude can reference real facts. */
  enrichmentSummary: string;
}

/** Extract a 1-2-word bydel/area keyword from a customer's address.
 *  Looks at postnummer prefix (POSTAL_AREA_HINTS) first, then falls
 *  back to street-name extraction. Returns null when nothing usable
 *  can be inferred. */
export function extractBydelKeyword(address: string | null | undefined): string | null {
  if (!address) return null;
  const trimmed = address.trim();
  // Postnummer hint — pick the first match.
  const postMatch = trimmed.match(/\b(\d{4})\b/);
  if (postMatch) {
    const postnr = postMatch[1];
    for (const hint of POSTAL_AREA_HINTS) {
      if (hint.prefixes.includes(postnr)) {
        return hint.keyword;
      }
    }
  }
  // Street-name fallback — take a capitalised word that doesn't look
  // like a generic. Tuned for Norwegian street-name patterns
  // ("Trondheimsveien", "Karl Johans gate", "Lindebergveien").
  const streetMatch = trimmed.match(/([A-ZÆØÅ][a-zæøå]{4,})(?:veien|gata|gate|alléen|plassen)/);
  if (streetMatch) {
    const stem = streetMatch[1].toLowerCase();
    if (!["norge", "oslo", "bergen", "trondheim", "stavanger"].includes(stem)) {
      return stem;
    }
  }
  return null;
}

async function fetchBrregByNaceAndKeyword(opts: {
  naceCode: string;
  kommunenummer?: string | null;
  nameKeyword?: string | null;
  size?: number;
}): Promise<Array<Record<string, unknown>>> {
  const params = new URLSearchParams();
  params.set("naeringskode", opts.naceCode);
  params.set("size", String(opts.size ?? 20));
  params.set("konkurs", "false");
  params.set("underAvvikling", "false");
  if (opts.kommunenummer) params.set("kommunenummer", opts.kommunenummer);
  if (opts.nameKeyword) params.set("navn", opts.nameKeyword);
  try {
    const r = await fetch(`${BRREG_API_BASE}/enheter?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return [];
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    const embedded = j?._embedded as Record<string, unknown> | undefined;
    return (embedded?.enheter as Array<Record<string, unknown>>) ?? [];
  } catch {
    return [];
  }
}

function brregUnitToCandidate(
  unit: Record<string, unknown>,
  areaKeyword: string | null,
): MerchPartnerCandidate | null {
  const orgNumber = typeof unit.organisasjonsnummer === "string" ? unit.organisasjonsnummer : null;
  const name = typeof unit.navn === "string" ? unit.navn : null;
  if (!orgNumber || !name) return null;

  const businessAddress =
    unit.forretningsadresse && typeof unit.forretningsadresse === "object"
      ? (unit.forretningsadresse as Record<string, unknown>)
      : null;
  const fa = (key: string): string | null =>
    businessAddress && typeof businessAddress[key] === "string" ? (businessAddress[key] as string) : null;
  const formattedAddress = [
    Array.isArray(businessAddress?.adresse) ? (businessAddress?.adresse as string[]).join(", ") : null,
    [fa("postnummer"), fa("poststed")].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const naceObj = (unit.naeringskode1 as Record<string, unknown> | undefined) ?? {};
  const naceCode = typeof naceObj.kode === "string" ? naceObj.kode : null;
  const naceLabel = typeof naceObj.beskrivelse === "string" ? naceObj.beskrivelse : null;
  const websiteUrl = typeof unit.hjemmeside === "string" ? unit.hjemmeside : null;

  // Score: 50 base for being in Brreg, +30 if name contains the area
  // keyword (same-bydel signal), +15 if has a website, +5 if has a
  // post-coded business address (i.e. a real registered location).
  const lowerName = name.toLowerCase();
  let score = 50;
  const evidence: string[] = ["Brreg-registrert idrettslag/forening/skole"];
  let areaMatch: string | null = null;
  if (areaKeyword && lowerName.includes(areaKeyword.toLowerCase())) {
    score += 30;
    areaMatch = areaKeyword;
    evidence.push(`Navn matcher kundens nabolag: ${areaKeyword}`);
  }
  if (websiteUrl) {
    score += 15;
    evidence.push("Har egen nettside");
  }
  if (fa("postnummer")) {
    score += 5;
  }

  return {
    source: "brreg",
    organizationNumber: orgNumber,
    placeId: null,
    name,
    websiteUrl,
    formattedAddress: formattedAddress || null,
    distanceKm: null,
    naceCode,
    naceLabel,
    areaMatch,
    score: Math.min(100, score),
    evidence,
  };
}

/**
 * Discover partner candidates for a given customer + partner type.
 *
 * Strategy:
 *   1. Look up customer's Brreg record (kommune-nr + business address).
 *   2. Extract bydel keyword from address (e.g. "lindeberg").
 *   3. Run Brreg name-search for that keyword + NACE code (catches
 *      neighbourhood clubs that alphabetical kommune-pagination misses).
 *   4. Run a kommune-wide NACE fallback (same kommune, any bydel) so
 *      we don't miss e.g. "Furuset Landhockey" if customer is on
 *      Lindeberg.
 *   5. Dedupe by orgnr, sort by score, return top ~10.
 *
 * Event/bedrift partner-types fall back to Google Places (handled by
 * existing fetchGooglePlacesLocalPresencePlan in the bootstrap path);
 * this discovery function focuses on the Brreg-friendly types.
 */
export async function discoverMerchPartners(
  customer: {
    brregCompany: RoleRoomAgentBrregCompany | null;
    businessAddressFreetext?: string | null;
    /** Producer-supplied override. Brregs forretningsadresse er ofte
     *  juridisk hovedsete, ikke faktisk drifts-lokasjon — særlig for
     *  mobile aktører (NACE 56.120) som driver fra én bydel men er
     *  registrert i en annen. Hvis producer vet bedre, send det her. */
    areaOverride?: string | null;
  },
  partnerType: MerchPartnerType,
): Promise<MerchPartnerCandidate[]> {
  const brreg = customer.brregCompany;
  const customerKommune = brreg?.municipalityNumber ?? null;
  const customerAddress =
    customer.businessAddressFreetext
    || brreg?.businessAddress
    || null;
  // Override > postnummer-derived bydel > street-name fallback.
  const areaKeyword =
    (customer.areaOverride && customer.areaOverride.trim().length > 0
      ? customer.areaOverride.trim().toLowerCase()
      : null)
    ?? extractBydelKeyword(customerAddress);

  const naceCodes = PARTNER_NACE_CODES[partnerType];
  if (naceCodes.length === 0) {
    // No Brreg path for this type — caller falls back to Google Places.
    return [];
  }

  const collected = new Map<string, MerchPartnerCandidate>();

  // 1. Bydel-keyword search across each NACE — catches the neighbourhood-
  //    named clubs that kommune-only paging misses.
  if (areaKeyword) {
    for (const nace of naceCodes) {
      const units = await fetchBrregByNaceAndKeyword({
        naceCode: nace,
        kommunenummer: customerKommune,
        nameKeyword: areaKeyword,
        size: 8,
      });
      for (const u of units) {
        const c = brregUnitToCandidate(u, areaKeyword);
        if (c?.organizationNumber && !collected.has(c.organizationNumber)) {
          collected.set(c.organizationNumber, c);
        }
      }
    }
  }

  // 2. Kommune-wide NACE fallback. Brreg paginates alphabetically so
  //    we pull a larger size to capture more of the long tail.
  for (const nace of naceCodes) {
    const units = await fetchBrregByNaceAndKeyword({
      naceCode: nace,
      kommunenummer: customerKommune,
      size: 30,
    });
    for (const u of units) {
      const c = brregUnitToCandidate(u, areaKeyword);
      if (c?.organizationNumber && !collected.has(c.organizationNumber)) {
        collected.set(c.organizationNumber, c);
      }
    }
  }

  // 3. Sort by score desc, return top 10.
  return Array.from(collected.values()).sort((a, b) => b.score - a.score).slice(0, 10);
}

/** Light scrape-based enrichment of a single partner. Best-effort —
 *  every step is wrapped so a failure doesn't kill the result. */
export async function enrichMerchPartner(
  pool: Pool,
  candidate: MerchPartnerCandidate,
): Promise<MerchPartnerEnrichment> {
  const enrichment: MerchPartnerEnrichment = {
    candidate,
    enrichmentSummary: "",
  };

  // Brreg full lookup if we have an orgnr — gives us employee count,
  // foundation date, status flags.
  if (candidate.organizationNumber) {
    try {
      const brreg = await fetchBrregCompany({
        organizationNumber: candidate.organizationNumber,
        companyName: candidate.name,
        websiteUrl: null,
        organizationName: null,
        extraContext: null,
      } as unknown as Parameters<typeof fetchBrregCompany>[0]);
      if (brreg && brreg.lookupStatus === "verified") {
        enrichment.brreg = {
          daglig_leder_navn: null, // not in the fetch; would require /roller endpoint
          foundedYear: brreg.registrationDate
            ? Number(brreg.registrationDate.slice(0, 4)) || null
            : null,
          employeeCount: brreg.employeeCount ?? null,
          statusFlags: brreg.statusFlags
            ? {
                bankrupt: brreg.statusFlags.bankrupt ?? false,
                underLiquidation: brreg.statusFlags.underLiquidation ?? false,
              }
            : undefined,
        };
      }
    } catch {
      /* best-effort */
    }
  }

  // Website scrape — title, meta, sponsor-line, contact.
  if (candidate.websiteUrl) {
    try {
      const r = await fetch(candidate.websiteUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RoleRoomAgent/1.0)" },
        redirect: "follow",
        signal: AbortSignal.timeout(6_000),
      });
      if (r.ok) {
        const html = await r.text();
        const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
        const meta =
          html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() ?? null;
        const stripped = html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ");
        // Sponsor-line: look for the phrase + 80 chars after.
        const sponsorMatch = stripped.match(/(våre sponsor|sponsorer|hovedsponsor|samarbeidspartner)[^.]{0,180}/i);
        // Member count hint — "200 medlemmer", "320 spillere", "4 lag",
        // "vi har xxx" patterns common on club sites.
        const memberMatch = stripped.match(
          /(\d{1,4})\s*(medlemmer|spillere|aktive|barn|ungdom(?:mer)?|lag|jenter|gutter)/i,
        );
        const emailMatch = stripped.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        const phoneMatch = stripped.match(/(\+?47[\s.-]?)?(\d[\s.-]?){8}/);

        enrichment.website = {
          title,
          metaDescription: meta,
          sponsorLine: sponsorMatch ? sponsorMatch[0].trim().slice(0, 180) : null,
          memberCountHint: memberMatch ? memberMatch[0].trim() : null,
          contactEmail: emailMatch ? emailMatch[0] : null,
          contactPhone: phoneMatch ? phoneMatch[0].replace(/\s+/g, " ").trim() : null,
        };
      }
    } catch {
      /* best-effort */
    }
  }

  // Meta Page — sports clubs often have public FB pages with follower
  // counts. Reuse the same enrichCompetitorWithMetaPage helper that
  // already runs against competitors.
  try {
    const meta = await enrichCompetitorWithMetaPage(candidate.name);
    if (meta) {
      enrichment.metaPage = {
        pageId: meta.id ?? null,
        pageName: meta.name ?? null,
        followersCount: meta.followersCount ?? null,
        fanCount: meta.fanCount ?? null,
        category: meta.category ?? null,
        about: meta.about ?? null,
        pageUrl: meta.link ?? null,
        verified:
          meta.verificationStatus === "blue_verified"
            || meta.verificationStatus === "gray_verified",
      };
    }
  } catch {
    /* best-effort */
  }

  // Build a free-text summary that the cooperation prompt can quote.
  const summaryParts: string[] = [];
  if (enrichment.brreg?.foundedYear) {
    summaryParts.push(`registrert ${enrichment.brreg.foundedYear}`);
  }
  if (typeof enrichment.brreg?.employeeCount === "number") {
    summaryParts.push(`${enrichment.brreg.employeeCount} ansatte i Brreg`);
  }
  if (enrichment.website?.memberCountHint) {
    summaryParts.push(`nettsiden nevner "${enrichment.website.memberCountHint}"`);
  }
  if (enrichment.website?.sponsorLine) {
    summaryParts.push(`sponsorer omtalt på nettsiden: ${enrichment.website.sponsorLine.slice(0, 100)}`);
  }
  if (enrichment.metaPage?.followersCount) {
    summaryParts.push(`${enrichment.metaPage.followersCount} følgere på Facebook`);
  }
  if (enrichment.website?.contactEmail) {
    summaryParts.push(`kontakt: ${enrichment.website.contactEmail}`);
  }
  enrichment.enrichmentSummary = summaryParts.length > 0
    ? summaryParts.join(" · ")
    : "Ingen ekstra fakta funnet utover Brreg-oppføringen — Claude kan flagge ukjente tall som ting producer må verifisere.";

  return enrichment;
}
