/**
 * competitor-discovery-service.ts
 *
 * Bruker Claude til å foreslå sannsynlige konkurrenter basert på market-query.
 * Returnerer kandidat-domener som så scannes individuelt av scan-pipelinen.
 *
 * IKKE bruker mock-data eller fabrikkerte konkurrenter — Claude blir bedt om
 * å bare nevne reelle, kjente konkurrenter, og markere usikkerhet med lavere
 * confidence.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ConfidenceLevel } from "./types.js";

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

export interface CompetitorCandidate {
  name: string;
  domain: string;
  category: string;
  positioning: string;
  primaryOffer: string;
  confidence: ConfidenceLevel;
  rationale: string;
}

export interface DiscoveryInput {
  marketQuery: string;
  industry?: string | null;
  region?: string | null;
  targetAudience?: string | null;
  goal?: string | null;
  /** Begrenser antall konkurrenter Claude foreslår. Default 8. */
  maxResults?: number;
  /** Eget domene som SKAL ekskluderes fra forslagene. */
  excludeDomains?: string[];
}

const SYSTEM_PROMPT = `Du er en markedsanalytiker som identifiserer reelle, kjente konkurrenter i et SPESIFIKT marked.

REGION-REGEL (kritisk):
- Hvis brukeren oppgir en region (f.eks. "Norge"), foreslå KUN konkurrenter som
  faktisk opererer i den regionen. Et utenlandsk selskap som ikke har norsk
  tilstedeværelse, norske ansatte, norsk levering eller norske kunder er IKKE
  en konkurrent for et norsk firma.
- Lokal restaurant i Oslo har ikke konkurrenter i Brasil. Norsk casting-byrå
  har ikke konkurrenter i Korea (med mindre de eksplisitt opererer i Norge).
- Hvis du er usikker på om et selskap har norsk markedstilstedeværelse,
  ekskluder dem heller enn å gjette.
- En STOR utenlandsk plattform som FAKTISK selger i Norge (f.eks. Spotify,
  LinkedIn) kan inkluderes, men forklar tilstedeværelsen i rationale.

KVALITET-REGEL:
- Nevn KUN reelle, kjente selskaper du faktisk kjenner. Aldri lag opp domener.
- Hvis du er usikker på et domene, sett confidence: "low" og forklar i rationale.
- Domener skal være rene (uten http/www-prefix), f.eks. "spotlight.com".
- Forklar positionering i én setning. Hold språket norsk.
- Ekskluder selskaper du ble bedt om å unngå.

OUTPUT-FORMAT:
Returner kun gyldig JSON. Eksempel-shape:
{
  "competitors": [
    {
      "name": "Spotlight",
      "domain": "spotlight.com",
      "category": "Skuespiller-casting-plattform",
      "positioning": "Britisk register som mange norske skuespillere bruker; tilbyr profil-medlemskap som hjelper dem få roller i internasjonale produksjoner som filmes i Norge.",
      "primaryOffer": "Profil-medlemskap for skuespillere + casting-tilgang for produsenter",
      "confidence": "medium",
      "rationale": "UK-basert, men norske skuespillere bruker den aktivt for internasjonale roller."
    }
  ]
}`;

function buildUserPrompt(input: DiscoveryInput): string {
  const lines: string[] = [
    `Marked: ${input.marketQuery}`,
  ];
  if (input.industry) lines.push(`Industri: ${input.industry}`);
  if (input.region) {
    lines.push(`Region: ${input.region}`);
    lines.push(`KRITISK: Konkurrentene MÅ operere i ${input.region}. Et selskap som ikke har tilstedeværelse, kunder, salg eller levering i ${input.region} er IKKE en konkurrent. Ekskluder utenlandske selskaper som ikke faktisk selger i ${input.region}.`);
  }
  if (input.targetAudience) lines.push(`Målgruppe: ${input.targetAudience}`);
  if (input.goal) lines.push(`Mål: ${input.goal}`);
  if (input.excludeDomains && input.excludeDomains.length > 0) {
    lines.push(`Ekskluder disse domenene: ${input.excludeDomains.join(", ")}`);
  }
  lines.push("");
  lines.push(`List opp inntil ${input.maxResults ?? 8} reelle konkurrenter som faktisk konkurrerer med dette markedet.`);
  lines.push("Hvis du finner færre enn 3 reelle konkurrenter i regionen, list de få du kjenner heller enn å fylle opp med irrelevante.");
  lines.push("Returner KUN JSON.");
  return lines.join("\n");
}

function tryParseJson<T>(text: string): T | null {
  // Claude pakker av og til JSON inn i ```json-blokker
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1] : text;
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    return null;
  }
}

// TLD-er som tydelig indikerer feil region for norsk-fokuserte scans.
// Hvis Claude foreslår en konkurrent med disse TLD-ene for et norsk
// scan, droppes den fra resultatet med mindre rationale eksplisitt
// nevner norsk tilstedeværelse.
const NON_NORWEGIAN_REGION_TLDS = new Set([
  "br", "ar", "cl", "mx",         // Sør-/Mellom-Amerika
  "cn", "jp", "kr", "vn", "th",   // Asia
  "in", "id", "my", "ph",         // Sør-Asia / Sør-Øst-Asia
  "au", "nz",                     // Oseania
  "ru", "ua", "tr",               // Andre fjernere
  "za",                            // Afrika
]);

/**
 * Filtrerer bort konkurrenter med tydelige feil-region-signaler.
 * Gir Claude én sjanse til å begrunne tilstedeværelse via rationale.
 */
function filterByRegion(
  competitors: CompetitorCandidate[],
  region: string | null | undefined,
): CompetitorCandidate[] {
  if (!region) return competitors;
  const regionNorm = region.toLowerCase().trim();
  const isNorwayFocused = regionNorm.includes("norge") || regionNorm.includes("norway");

  return competitors.filter((c) => {
    const domain = (c.domain ?? "").toLowerCase();
    const tld = domain.split(".").pop() ?? "";
    const rationale = (c.rationale ?? "").toLowerCase();
    const positioning = (c.positioning ?? "").toLowerCase();

    // For norsk-fokuserte scans: avvis åpenbart feil-region-TLD-er med
    // mindre Claude eksplisitt nevner norsk tilstedeværelse.
    if (isNorwayFocused && NON_NORWEGIAN_REGION_TLDS.has(tld)) {
      const mentionsNorway =
        rationale.includes("norge") ||
        rationale.includes("norsk") ||
        positioning.includes("norge") ||
        positioning.includes("norsk");
      if (!mentionsNorway) {
        console.warn(
          `[competitor-discovery] dropping ${c.name} (${c.domain}) — TLD .${tld} but no Norway-presence rationale`,
        );
        return false;
      }
    }
    return true;
  });
}

export async function discoverCompetitors(
  input: DiscoveryInput,
): Promise<CompetitorCandidate[]> {
  const client = getAnthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input) }],
  });

  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  const parsed = tryParseJson<{ competitors: CompetitorCandidate[] }>(text);
  if (!parsed || !Array.isArray(parsed.competitors)) {
    throw new Error("competitor_discovery_invalid_response");
  }

  // Sanitize: rens domener
  const cleaned = parsed.competitors
    .filter((c) => c.domain && c.name)
    .map((c) => ({
      ...c,
      domain: c.domain
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "")
        .trim(),
      confidence: (c.confidence ?? "medium") as ConfidenceLevel,
    }));

  // Region-filter: kast åpenbart feil-region-konkurrenter
  return filterByRegion(cleaned, input.region);
}
