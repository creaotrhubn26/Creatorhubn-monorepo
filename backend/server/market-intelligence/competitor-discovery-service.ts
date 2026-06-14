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

const SYSTEM_PROMPT = `Du er en markedsanalytiker som identifiserer reelle, kjente konkurrenter i et marked.

KRAV:
- Nevn KUN konkurrenter du faktisk kjenner. Aldri lag opp domener.
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
      "positioning": "Det største britiske registeret for skuespillere og castere.",
      "primaryOffer": "Profil-medlemskap for skuespillere + casting-tilgang for produsenter",
      "confidence": "high",
      "rationale": "Etablert markedsleder i UK, ofte referert til av norske skuespillere."
    }
  ]
}`;

function buildUserPrompt(input: DiscoveryInput): string {
  const lines: string[] = [
    `Marked: ${input.marketQuery}`,
  ];
  if (input.industry) lines.push(`Industri: ${input.industry}`);
  if (input.region) lines.push(`Region: ${input.region}`);
  if (input.targetAudience) lines.push(`Målgruppe: ${input.targetAudience}`);
  if (input.goal) lines.push(`Mål: ${input.goal}`);
  if (input.excludeDomains && input.excludeDomains.length > 0) {
    lines.push(`Ekskluder disse domenene: ${input.excludeDomains.join(", ")}`);
  }
  lines.push("");
  lines.push(`List opp inntil ${input.maxResults ?? 8} reelle konkurrenter.`);
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
  return parsed.competitors
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
}
