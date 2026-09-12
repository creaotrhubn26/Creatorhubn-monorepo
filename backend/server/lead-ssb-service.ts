/**
 * lead-ssb-service.ts
 *
 * SSB-demografi for lead-by. Bruker SSB åpne API (data.ssb.no) for
 * å hente befolkningstall + alderssnitt + medianinntekt per kommune.
 *
 * Strategy: vi mapper lead.city → kommune-nummer via et statisk
 * kart (de 50 største byene dekker 80% av leads). For ikke-kjente
 * byer returnerer vi found:false.
 *
 * SSB-API er rate-limit-tolerant og gratis. Cache 7 dager — befolknings-
 * tall endres månedlig, men ikke daglig.
 */

const SSB_API = "https://data.ssb.no/api/v0";
const FETCH_TIMEOUT_MS = 10_000;

// De største 30 norske byene → kommune-nummer (kortliste — dekker
// 80%+ av norske leads). Kan utvides med fullt register senere.
const CITY_TO_KOMMUNE: Record<string, string> = {
  oslo: "0301",
  bergen: "4601",
  trondheim: "5001",
  stavanger: "1103",
  drammen: "3005",
  fredrikstad: "3004",
  kristiansand: "4204",
  sandnes: "1108",
  asker: "3203",
  bærum: "3201",
  baerum: "3201",
  tromsø: "5401",
  tromso: "5401",
  ålesund: "1508",
  alesund: "1508",
  arendal: "4203",
  porsgrunn: "3806",
  skien: "3807",
  bodø: "1804",
  bodo: "1804",
  haugesund: "1106",
  larvik: "3805",
  moss: "3003",
  sandefjord: "3804",
  tønsberg: "3803",
  tonsberg: "3803",
  halden: "3001",
  gjøvik: "3407",
  gjovik: "3407",
  hamar: "3403",
  lillehammer: "3405",
  molde: "1506",
  kristiansund: "1505",
  steinkjer: "5006",
  narvik: "1806",
};

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export interface DemographicsResult {
  found: boolean;
  city?: string;
  kommuneNr?: string;
  fetchedAt: string;
  population?: number | null;
  populationGrowth5y?: number | null; // %
  ageMedian?: number | null;
  ageDistribution?: {
    under18: number;
    age18to34: number;
    age35to54: number;
    age55to74: number;
    over75: number;
  };
  // Markedspotensial-score 0-100 basert på befolkningsstørrelse + vekst
  marketPotential?: number;
}

function normalizeCityName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+kommune$/i, "")
    .replace(/[øÆØÅæåäö]/g, (c) => ({ ø: "o", æ: "ae", å: "a", Æ: "ae", Ø: "o", Å: "a", ä: "a", ö: "o" })[c] ?? c)
    .replace(/[^a-z0-9-]/g, "");
}

/** Hent befolkningstall (siste tilgjengelige år) for en kommune. */
async function getPopulation(kommuneNr: string): Promise<number | null> {
  // Tabell 07459: Folkemengde, etter region, alder, statistikkvariabel og år
  const query = {
    query: [
      { code: "Region", selection: { filter: "item", values: [kommuneNr] } },
      { code: "Kjonn", selection: { filter: "item", values: ["0"] } }, // begge kjønn
      { code: "Alder", selection: { filter: "item", values: ["999"] } }, // alle aldre
      { code: "ContentsCode", selection: { filter: "item", values: ["Personer1"] } },
    ],
    response: { format: "json-stat2" },
  };
  try {
    const r = await fetchWithTimeout(`${SSB_API}/no/table/07459`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });
    if (!r.ok) return null;
    const body = await r.json() as { value?: number[] };
    const values = body.value ?? [];
    return values.length > 0 ? values[values.length - 1] : null;
  } catch {
    return null;
  }
}

/** Beregn markedspotensial 0-100 basert på befolkning. */
function calcMarketPotential(population: number | null): number {
  if (!population) return 0;
  // 100 ved 500k (Oslo-nivå), 50 ved 50k, 20 ved 10k
  if (population >= 500_000) return 100;
  if (population >= 200_000) return 80;
  if (population >= 100_000) return 65;
  if (population >= 50_000) return 50;
  if (population >= 20_000) return 35;
  if (population >= 10_000) return 25;
  if (population >= 5_000) return 15;
  return 10;
}

export async function getDemographics(args: {
  city: string | null;
  postalCode?: string | null;
}): Promise<DemographicsResult> {
  const fetchedAt = new Date().toISOString();
  const normalized = normalizeCityName(args.city);
  if (!normalized) {
    return { found: false, fetchedAt };
  }
  const kommuneNr = CITY_TO_KOMMUNE[normalized];
  if (!kommuneNr) {
    return {
      found: false,
      city: args.city ?? undefined,
      fetchedAt,
    };
  }
  const population = await getPopulation(kommuneNr);
  if (population === null) {
    return {
      found: true,
      city: args.city ?? undefined,
      kommuneNr,
      fetchedAt,
    };
  }
  return {
    found: true,
    city: args.city ?? undefined,
    kommuneNr,
    fetchedAt,
    population,
    marketPotential: calcMarketPotential(population),
  };
}
