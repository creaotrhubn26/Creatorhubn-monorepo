/**
 * geo-probe-engines.ts
 *
 * Engine-abstraksjonen for GEO-probing (docs/integration-audit/08).
 * Hver motor svarer på ett spørsmål slik en sluttbruker ville stilt det.
 *
 * Ærlighetsregler:
 *  - Kun offisielle APIer — aldri forbruker-UI-scraping.
 *  - En motor uten credentials er `configured=false` og HOPPES OVER med
 *    eksplisitt rapportering (aldri stille utelatt, aldri mocket).
 *  - API-modeller ≠ forbruker-appene (chatgpt.com har søk/minne) — dette
 *    dokumenteres i panelets metodikk-tekst; svarene merkes syntetiske.
 *
 * Alle kall går via callExternalApi (30s timeout — LLM-svar er trege) og
 * kaster aldri: en motor-feil gir null-svar som telles som frafall i
 * kjøringen (status 'partial'), ikke som krasj.
 */

import Anthropic from "@anthropic-ai/sdk";
import { callExternalApi } from "../external-api.js";

export type GeoEngineId = "anthropic" | "openai" | "perplexity";

export interface GeoProbeEngine {
  engineId: GeoEngineId;
  /** Har motoren credentials i dette miljøet? */
  isConfigured(): boolean;
  /** Still spørsmålet som en sluttbruker. null = feil/utilgjengelig. */
  ask(prompt: string): Promise<string | null>;
}

const PROBE_TIMEOUT_MS = 30_000;
const MAX_ANSWER_TOKENS = 700;

/** Sluttbruker-simulering: ingen system-styring utover norsk svar. */
const USER_SIM_SYSTEM = "Svar som du ville svart en vanlig norsk bruker. Svar på norsk.";

let anthropicClient: Anthropic | null = null;

class AnthropicEngine implements GeoProbeEngine {
  engineId = "anthropic" as const;

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async ask(prompt: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    try {
      if (!anthropicClient) {
        anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      }
      const response = await anthropicClient.messages.create({
        model: "claude-sonnet-5",
        max_tokens: MAX_ANSWER_TOKENS,
        system: USER_SIM_SYSTEM,
        messages: [{ role: "user", content: prompt }],
      });
      const text = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim();
      return text || null;
    } catch (err) {
      console.warn("[geo-probe:anthropic] ask failed:", String(err).slice(0, 200));
      return null;
    }
  }
}

class OpenAiEngine implements GeoProbeEngine {
  engineId = "openai" as const;

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async ask(prompt: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const result = await callExternalApi<{
      choices?: Array<{ message?: { content?: string } }>;
    }>("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      timeoutMs: PROBE_TIMEOUT_MS,
      label: "geo-probe-openai",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GEO_PROBE_OPENAI_MODEL || "gpt-4o-mini",
        max_tokens: MAX_ANSWER_TOKENS,
        messages: [
          { role: "system", content: USER_SIM_SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!result.ok) return null;
    return result.data.choices?.[0]?.message?.content?.trim() || null;
  }
}

class PerplexityEngine implements GeoProbeEngine {
  engineId = "perplexity" as const;

  isConfigured(): boolean {
    return Boolean(process.env.PERPLEXITY_API_KEY);
  }

  async ask(prompt: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const result = await callExternalApi<{
      choices?: Array<{ message?: { content?: string } }>;
    }>("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      timeoutMs: PROBE_TIMEOUT_MS,
      label: "geo-probe-perplexity",
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GEO_PROBE_PERPLEXITY_MODEL || "sonar",
        max_tokens: MAX_ANSWER_TOKENS,
        messages: [
          { role: "system", content: USER_SIM_SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!result.ok) return null;
    return result.data.choices?.[0]?.message?.content?.trim() || null;
  }
}

/** Alle motorer, konfigurert eller ei — caller skiller på isConfigured(). */
export function getGeoProbeEngines(): GeoProbeEngine[] {
  return [new AnthropicEngine(), new OpenAiEngine(), new PerplexityEngine()];
}
