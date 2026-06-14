/**
 * content-signal-service.ts
 *
 * Bruker Claude til å analysere innholds-signaler fra en konkurrent-side:
 * headline-stil, tone, målgruppe, smerter, løftet, tilbud, CTA-språk,
 * objections som adresseres, tillitssignaler, emotionelle triggere.
 *
 * Output mappes til en strukturert "signals"-record som lagres i
 * market_scan_content_signals.signals JSONB.
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

export interface ContentSignal {
  value: string;
  confidence: ConfidenceLevel;
  evidence?: string;
}

export interface ContentSignalsResult {
  signals: Record<string, ContentSignal>;
  summary: string;
  confidence: ConfidenceLevel;
}

const SYSTEM_PROMPT = `Du er en marketing-analytiker som analyserer landingssider for å avdekke innholds-signaler.

Du leser HTML/text og leverer en strukturert oppsummering. Aldri gjett uten å si "lav confidence". Marker missing-data eksplisitt.

OUTPUT (gyldig JSON):
{
  "signals": {
    "headlineStyle":      { "value": "...", "confidence": "high|medium|low", "evidence": "kort sitat" },
    "toneOfVoice":        { "value": "...", "confidence": "...", "evidence": "..." },
    "targetAudience":     { "value": "...", "confidence": "...", "evidence": "..." },
    "painPoints":         { "value": "...", "confidence": "...", "evidence": "..." },
    "promise":            { "value": "...", "confidence": "...", "evidence": "..." },
    "offer":              { "value": "...", "confidence": "...", "evidence": "..." },
    "ctaLanguage":        { "value": "...", "confidence": "...", "evidence": "..." },
    "objectionsAddressed":{ "value": "...", "confidence": "...", "evidence": "..." },
    "trustSignals":       { "value": "...", "confidence": "...", "evidence": "..." },
    "emotionalTriggers":  { "value": "...", "confidence": "...", "evidence": "..." },
    "visualStyle":        { "value": "...", "confidence": "...", "evidence": "..." }
  },
  "summary": "1–3 setningers oppsummering på norsk.",
  "confidence": "high|medium|low"
}

Hold språket norsk. Hvis et signal ikke finnes i HTML-en, sett value: "ikke funnet" og confidence: "low".`;

function tryParseJson<T>(text: string): T | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1] : text;
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    return null;
  }
}

/**
 * Trekk ut tekst fra HTML for kortere prompt.
 */
function htmlToBriefText(html: string, maxChars = 5000): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, maxChars);
}

export async function analyzeContentSignals(
  competitorName: string,
  html: string,
): Promise<ContentSignalsResult> {
  const client = getAnthropic();
  const briefText = htmlToBriefText(html);

  const userPrompt = `Konkurrent: ${competitorName}\n\nLandingsside-tekst (utdrag):\n${briefText}\n\nReturner JSON.`;

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  const parsed = tryParseJson<ContentSignalsResult>(text);
  if (!parsed || !parsed.signals) {
    throw new Error("content_signals_invalid_response");
  }
  return parsed;
}
