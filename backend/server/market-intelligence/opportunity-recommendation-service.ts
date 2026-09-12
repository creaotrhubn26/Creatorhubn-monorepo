/**
 * opportunity-recommendation-service.ts
 *
 * Gitt et fullt market-scan-resultat (konkurrenter + funnel-stadier +
 * teknikker + tech stack + content signals), generer Claude-baserte
 * opportunity recommendations for produsenten.
 *
 * Hver anbefaling har title, simpleSummary, whyItMatters, evidenceSummary,
 * recommendedAction, impact, difficulty, confidence — pluss sporbarhet
 * tilbake til hvilke konkurrenter/teknikker den baserer seg på.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  Competitor,
  ContentSignalBatch,
  FunnelStage,
  MarketingTechnique,
  OpportunityRecommendation,
  TechStackSignal,
} from "./types.js";
import type { BrandKitBaseline } from "../brand-kit-service.js";

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

export interface RecommendationInput {
  marketQuery: string;
  brandBaseline: BrandKitBaseline | null;
  competitors: Competitor[];
  funnelStages: FunnelStage[];
  techniques: MarketingTechnique[];
  techStack: TechStackSignal[];
  contentSignals: ContentSignalBatch[];
  maxRecommendations?: number;
}

const SYSTEM_PROMPT = `Du er en marketing-strategi-rådgiver for en innholdsprodusent. Du leser et market-scan-resultat (konkurrenter + funnel-stadier + teknikker + tech stack + content signals) og genererer 3–8 konkrete handlingbare anbefalinger.

REGLER:
- Hver anbefaling MÅ peke på konkret evidens fra scan-dataene (hvilke konkurrenter, hvilke teknikker)
- Aldri foreslå taktikker basert på "best practice" alene — kun det vi har bevis for i dette markedet
- Hold språket norsk, bestemor-vennlig (forklar tekniske termer)
- Marker confidence ærlig — vær konservativ ved usikkerhet

OUTPUT-FORMAT (gyldig JSON):
{
  "recommendations": [
    {
      "title": "Kort, handlingsorientert tittel",
      "simpleSummary": "1 setning som forklarer hva og for hvem",
      "whyItMatters": "Hvorfor dette betyr noe — basert på det vi så i scan-en",
      "evidenceSummary": "Hvilke konkurrenter/teknikker dette bygger på",
      "recommendedAction": "Konkret neste steg — hva produsenten skal gjøre",
      "impact": "low|medium|high",
      "difficulty": "easy|medium|hard",
      "confidence": "low|medium|high",
      "canCreateCampaign": true,
      "canCreateContentPack": true,
      "canCreateFunnelMap": false,
      "sourceCompetitorIds": ["uuid1", "uuid2"],
      "sourceTechniqueIds": ["uuid3"]
    }
  ]
}`;

function buildUserPrompt(input: RecommendationInput): string {
  const lines: string[] = [];
  lines.push(`Marked: ${input.marketQuery}`);
  if (input.brandBaseline) {
    lines.push(`Vår merkevare: ${input.brandBaseline.brandName} (${input.brandBaseline.industry})`);
    lines.push(`Vår tone: ${input.brandBaseline.toneOfVoice}`);
    lines.push(`Våre USPs: ${input.brandBaseline.usps.slice(0, 5).join("; ")}`);
  }
  lines.push("");

  lines.push(`Konkurrenter (${input.competitors.length}):`);
  for (const c of input.competitors.slice(0, 10)) {
    lines.push(`  - [${c.id}] ${c.name} (${c.domain}): ${c.positioning ?? "—"} · CTA: ${c.primaryCTA ?? "—"} · Confidence: ${c.confidence}`);
  }
  lines.push("");

  // Funnel-stadier — bare sammendrag: hvor mange detected per stage
  const stageCounts = new Map<string, number>();
  for (const s of input.funnelStages.filter((x) => x.detected)) {
    stageCounts.set(s.stage, (stageCounts.get(s.stage) ?? 0) + 1);
  }
  lines.push("Funnel-stadier detektert hos konkurrenter (antall):");
  for (const [stage, count] of stageCounts.entries()) {
    lines.push(`  - ${stage}: ${count}`);
  }
  lines.push("");

  // Teknikker — gruppert
  const detectedTechniques = input.techniques.filter((t) => t.detected);
  const techCounts = new Map<string, { count: number; ids: string[] }>();
  for (const t of detectedTechniques) {
    const cur = techCounts.get(t.technique) ?? { count: 0, ids: [] };
    cur.count += 1;
    cur.ids.push(t.id);
    techCounts.set(t.technique, cur);
  }
  lines.push("Teknikker detektert hos konkurrenter (antall):");
  for (const [key, info] of techCounts.entries()) {
    lines.push(`  - ${key} (id-sample: ${info.ids[0]}): ${info.count}`);
  }
  lines.push("");

  // Tech stack — top 10
  const stackTop = input.techStack.slice(0, 15);
  if (stackTop.length > 0) {
    lines.push("Tech stack-signaler:");
    for (const s of stackTop) {
      lines.push(`  - ${s.category} / ${s.toolName} (${s.confidence})`);
    }
    lines.push("");
  }

  // Content signals — bare summary-felt
  if (input.contentSignals.length > 0) {
    lines.push("Innholds-signaler (oppsummert):");
    for (const cs of input.contentSignals) {
      if (cs.summary) lines.push(`  - ${cs.summary}`);
    }
    lines.push("");
  }

  lines.push(`Generer inntil ${input.maxRecommendations ?? 6} anbefalinger.`);
  lines.push("Returner KUN JSON.");
  return lines.join("\n");
}

function tryParseJson<T>(text: string): T | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1] : text;
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    return null;
  }
}

export async function generateOpportunityRecommendations(
  input: RecommendationInput,
): Promise<Omit<OpportunityRecommendation, "id" | "marketScanId">[]> {
  const client = getAnthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input) }],
  });

  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  const parsed = tryParseJson<{
    recommendations: Array<Omit<OpportunityRecommendation, "id" | "marketScanId">>;
  }>(text);
  if (!parsed || !Array.isArray(parsed.recommendations)) {
    throw new Error("opportunity_recommendations_invalid_response");
  }
  return parsed.recommendations;
}
