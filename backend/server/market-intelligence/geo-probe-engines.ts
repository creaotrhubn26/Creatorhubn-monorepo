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
 *  - `*-search`-motorene (anthropic-search, openai-search) slår PÅ leverandørens
 *    web-søk og speiler «bruker med søk på» (retrieval), i motsetning til de bare
 *    modellenes parametriske minne. Egne engineId-er ⇒ måles/rapporteres separat,
 *    så skillet bare-modell vs søk-augmentert forblir eksplisitt.
 *
 * Alle kall går via callExternalApi (30s timeout — LLM-svar er trege) og
 * kaster aldri: en motor-feil gir null-svar som telles som frafall i
 * kjøringen (status 'partial'), ikke som krasj.
 */

import Anthropic from "@anthropic-ai/sdk";
import { callExternalApi } from "../external-api.js";

export type GeoEngineId =
  | "anthropic"
  | "openai"
  | "perplexity"
  | "anthropic-search"
  | "openai-search";

export interface GeoProbeAnswer {
  text: string;
  /** Token-forbruk fra API-svaret; null når leverandøren ikke rapporterer det. */
  usage: { inputTokens: number; outputTokens: number } | null;
  /** Kilder motoren oppga i et eget felt (Perplexity `citations`), utover
   *  URL-er som ligger inline i teksten. Tom for motorer uten kildefelt. */
  citedUrls?: string[];
}

export interface GeoProbeEngine {
  engineId: GeoEngineId;
  /** Har motoren credentials i dette miljøet? */
  isConfigured(): boolean;
  /** Still spørsmålet som en sluttbruker. null = feil/utilgjengelig. */
  ask(prompt: string): Promise<GeoProbeAnswer | null>;
}

const PROBE_TIMEOUT_MS = 30_000;
const MAX_ANSWER_TOKENS = 700;
/** Søk-augmenterte svar bruker mer plass (verktøy-blokker + syntese av kilder). */
const MAX_SEARCH_ANSWER_TOKENS = 1500;

/** Sluttbruker-simulering: ingen system-styring utover norsk svar. */
const USER_SIM_SYSTEM = "Svar som du ville svart en vanlig norsk bruker. Svar på norsk.";

let anthropicClient: Anthropic | null = null;

class AnthropicEngine implements GeoProbeEngine {
  engineId = "anthropic" as const;

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async ask(prompt: string): Promise<GeoProbeAnswer | null> {
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
      if (!text) return null;
      return {
        text,
        usage: response.usage
          ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
          : null,
      };
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

  async ask(prompt: string): Promise<GeoProbeAnswer | null> {
    if (!this.isConfigured()) return null;
    const result = await callExternalApi<{
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
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
    return toAnswer(result.data);
  }
}

class PerplexityEngine implements GeoProbeEngine {
  engineId = "perplexity" as const;

  isConfigured(): boolean {
    return Boolean(process.env.PERPLEXITY_API_KEY);
  }

  async ask(prompt: string): Promise<GeoProbeAnswer | null> {
    if (!this.isConfigured()) return null;
    const result = await callExternalApi<{
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      citations?: string[];
      search_results?: Array<{ url?: string }>;
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
    // Perplexity legger kildene i `citations` (eldre) / `search_results`
    // (nyere sonar) — ikke inline i teksten. Fang begge så cited_urls fylles.
    const citedUrls = [
      ...(Array.isArray(result.data.citations) ? result.data.citations : []),
      ...(Array.isArray(result.data.search_results)
        ? result.data.search_results.map((s) => s?.url).filter((u): u is string => typeof u === "string")
        : []),
    ];
    return toAnswer(result.data, citedUrls);
  }
}

/**
 * Søk-augmentert Anthropic — SAMME modell som AnthropicEngine (claude-sonnet-5),
 * men med det server-side web_search-verktøyet påslått. Eneste forskjell fra
 * bare-motoren er søk av/på, så sammenligningen er ren. Speiler en Claude-bruker
 * med søk på.
 */
class AnthropicSearchEngine implements GeoProbeEngine {
  engineId = "anthropic-search" as const;

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async ask(prompt: string): Promise<GeoProbeAnswer | null> {
    if (!this.isConfigured()) return null;
    try {
      if (!anthropicClient) {
        anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      }
      const response = await anthropicClient.messages.create({
        model: "claude-sonnet-5",
        max_tokens: MAX_SEARCH_ANSWER_TOKENS,
        system: USER_SIM_SYSTEM,
        messages: [{ role: "user", content: prompt }],
        // Server-side web_search-verktøy (GA). SDK 0.35-typene kjenner ikke
        // server-tool-formen ⇒ cast. Modellen søker selv og siterer.
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }] as any,
      });
      const text = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim();
      // Siterte URLer ligger i web_search_tool_result-blokkene (content[].url).
      const citedUrls: string[] = [];
      for (const block of response.content as any[]) {
        if (block?.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const r of block.content) {
            if (r?.type === "web_search_result" && typeof r.url === "string") {
              citedUrls.push(r.url);
            }
          }
        }
      }
      if (!text) return null;
      const uniqueUrls = Array.from(new Set(citedUrls));
      return {
        text,
        usage: response.usage
          ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
          : null,
        citedUrls: uniqueUrls.length > 0 ? uniqueUrls : undefined,
      };
    } catch (err) {
      console.warn("[geo-probe:anthropic-search] ask failed:", String(err).slice(0, 200));
      return null;
    }
  }
}

/**
 * Søk-augmentert OpenAI — chat-completions-søkemodellen (gpt-5-search-api) som
 * ALLTID søker før den svarer, dvs. speiler en ChatGPT-bruker med søk på. NB:
 * dette er en EGEN modell, ikke gpt-4o-mini med søk — search-preview-modellene
 * (gpt-4o[-mini]-search-preview) ble stengt 2026-07-23. Modell kan overstyres
 * via GEO_PROBE_OPENAI_SEARCH_MODEL.
 */
class OpenAiSearchEngine implements GeoProbeEngine {
  engineId = "openai-search" as const;

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async ask(prompt: string): Promise<GeoProbeAnswer | null> {
    if (!this.isConfigured()) return null;
    const result = await callExternalApi<{
      choices?: Array<{
        message?: {
          content?: string;
          annotations?: Array<{ type?: string; url_citation?: { url?: string } }>;
        };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    }>("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      timeoutMs: PROBE_TIMEOUT_MS,
      label: "geo-probe-openai-search",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GEO_PROBE_OPENAI_SEARCH_MODEL || "gpt-5-search-api",
        // GPT-5-familien bruker max_completion_tokens (ikke max_tokens).
        max_completion_tokens: MAX_SEARCH_ANSWER_TOKENS,
        messages: [
          { role: "system", content: USER_SIM_SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!result.ok) return null;
    // Søkemodellen legger kildene i message.annotations (type url_citation).
    const annotations = result.data.choices?.[0]?.message?.annotations;
    const citedUrls = Array.isArray(annotations)
      ? annotations
          .filter((a) => a?.type === "url_citation" && typeof a.url_citation?.url === "string")
          .map((a) => a.url_citation!.url as string)
      : [];
    return toAnswer(result.data, citedUrls.length > 0 ? Array.from(new Set(citedUrls)) : undefined);
  }
}

/** OpenAI-kompatibel respons (OpenAI/Perplexity) → GeoProbeAnswer. */
function toAnswer(data: {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}, citedUrls?: string[]): GeoProbeAnswer | null {
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  return {
    text,
    usage: data.usage
      ? {
          inputTokens: data.usage.prompt_tokens ?? 0,
          outputTokens: data.usage.completion_tokens ?? 0,
        }
      : null,
    citedUrls: citedUrls && citedUrls.length > 0 ? citedUrls : undefined,
  };
}

/** Alle motorer, konfigurert eller ei — caller skiller på isConfigured().
 *  De søk-augmenterte variantene deler credentials med sine bare motorer, så de
 *  blir automatisk med i «alle konfigurerte motorer»-settet en kjøring bruker. */
export function getGeoProbeEngines(): GeoProbeEngine[] {
  return [
    new AnthropicEngine(),
    new OpenAiEngine(),
    new PerplexityEngine(),
    new AnthropicSearchEngine(),
    new OpenAiSearchEngine(),
  ];
}
