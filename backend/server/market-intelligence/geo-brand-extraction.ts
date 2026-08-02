/**
 * geo-brand-extraction.ts
 *
 * Merkevare-discovery: LLM-ekstraksjon av ALLE kommersielle merkenavn i
 * et AI-svar — utover den kjente konkurrentlisten som matches
 * deterministisk. Svarer på «hvem eier de åpne temaene» (prod-måling #1
 * viste at f.eks. skaffe-leads-spørsmålene besvares uten kjente merker).
 *
 * Ærlighet:
 *  - Ekstraksjon er best-effort og må ALDRI velte en probe-kjøring
 *    (feil → tom liste, logget).
 *  - Kjente merker og generiske ord filtreres i ren, testet kode —
 *    LLM-en foreslår, koden bestemmer.
 *  - Bruker haiku-klasse modell — dette er NER, ikke resonnering.
 */

import Anthropic from "@anthropic-ai/sdk";

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

const EXTRACTION_SYSTEM = `Du finner merkenavn i tekst. List ALLE kommersielle produkter, tjenester og selskaper som nevnes ved navn (proper nouns) — programvare, plattformer, verktøy, leverandører.

IKKE inkluder: generiske kategorier (CRM, regneark), teknologier (Excel-ark er generisk, men "Microsoft Excel" er et produkt), stedsnavn, personnavn, eller offentlige etater.

Returner KUN gyldig JSON: {"brands":["Navn1","Navn2"]}. Tom liste hvis ingen.`;

/** Generiske ord som LLM-er ofte feilklassifiserer som merker. */
const GENERIC_BLOCKLIST = new Set([
  "crm", "excel", "google", "ai", "chatgpt", "claude", "gemini", "copilot",
  "facebook", "instagram", "linkedin", "youtube", "tiktok", "whatsapp",
  "e-post", "email", "sms", "api", "saas", "erp", "gdpr",
  "google sheets", "google docs", "google drive", "microsoft", "apple",
  "iphone", "ipad", "android", "brønnøysundregistrene", "finn", "finn.no",
]);

/**
 * Sanering (ren funksjon — enhetstestet): dedupliser, fjern kjente
 * merker og generiske ord, normaliser casing, maks 15 per svar.
 */
export function sanitizeDiscoveredBrands(
  raw: unknown,
  knownBrands: string[],
): string[] {
  const parsed = raw as { brands?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.brands)) return [];
  const known = new Set(knownBrands.map((b) => b.trim().toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of parsed.brands) {
    if (typeof b !== "string") continue;
    const name = b.trim().replace(/\s+/g, " ");
    const key = name.toLowerCase();
    if (name.length < 2 || name.length > 60) continue;
    if (known.has(key) || GENERIC_BLOCKLIST.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= 15) break;
  }
  return out;
}

/**
 * Ekstraher ukjente merkenavn fra et AI-svar. Best-effort: null-safe,
 * kaster aldri — feil gir tom liste.
 */
export async function extractDiscoveredBrands(
  answerText: string,
  knownBrands: string[],
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void,
): Promise<string[]> {
  const client = getAnthropic();
  if (!client || !answerText.trim()) return [];
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: "user", content: answerText.slice(0, 3000) }],
    });
    if (response.usage && onUsage) {
      onUsage({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });
    }
    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return [];
    return sanitizeDiscoveredBrands(JSON.parse(match[0]), knownBrands);
  } catch (err) {
    console.warn("[geo-brand-extraction] feilet (best-effort):", String(err).slice(0, 120));
    return [];
  }
}
