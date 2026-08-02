/**
 * content-composer.ts — synlighets-sløyfen del 1: innsikt → innhold
 *
 * Plattformens egne funn (benchmark, sesong, momentum, GEO-tomrom) er
 * innholdet ingen konkurrent kan kopiere. Composeren lager kanal-native
 * utkast — og TALL-VALIDATOREN garanterer redeligheten deterministisk:
 * hvert tall i posten MÅ finnes i faktagrunnlaget. En post med pyntede
 * tall forkastes i kode, ikke på ærens ord.
 *
 * J3-regelen: composeren produserer KUN utkast (status 'draft') —
 * publisering krever menneskelig godkjenning i køen.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Pool } from "pg";
import { recordAiUsage } from "./ai-usage.js";
import { buildSolutionEvidence, type GrantFact, type SolutionKey } from "./grant-application.js";

const COMPOSER_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// ─────────────────────────────────────────────────────────────────────
// Tall-validatoren (ren, enhetstestet)
// ─────────────────────────────────────────────────────────────────────

/** Normaliser talltokens: '8 961'→'8961', '4,3'→'4.3', '129,2'→'129.2'. */
export function extractNumbers(text: string): string[] {
  const matches = text.match(/\d[\d\s.,]*\d|\d/g) ?? [];
  return matches
    .map((raw) => raw.replace(/\s/g, "").replace(",", "."))
    .map((x) => x.replace(/\.$/, ""))
    .filter((x) => x.length > 0);
}

/**
 * Hvert tall i posten må finnes i faktagrunnlaget (normalisert).
 * Årstall (2015–2035) og små tellinger (1–12, typisk «3 grunner»)
 * slippes gjennom — de er retorikk, ikke statistikk.
 */
export function validatePostNumbers(body: string, facts: GrantFact[]): { ok: boolean; unknownNumbers: string[] } {
  const factNumbers = new Set(facts.flatMap((f) => extractNumbers(`${f.label} ${f.value}`)));
  // Prosenttall er ALLTID statistikk — småtall-unntaket gjelder ikke dem
  const percentNumbers = new Set(
    [...body.matchAll(/(\d[\d\s.,]*\d|\d)\s*%/g)].map((m) =>
      m[1].replace(/\s/g, "").replace(",", ".").replace(/\.$/, "")),
  );
  const unknown: string[] = [];
  for (const n of extractNumbers(body)) {
    const asFloat = Number(n);
    const isPercent = percentNumbers.has(n);
    if (!isPercent && Number.isFinite(asFloat) && asFloat >= 2015 && asFloat <= 2035 && Number.isInteger(asFloat)) continue;
    if (!isPercent && Number.isFinite(asFloat) && Number.isInteger(asFloat) && asFloat >= 1 && asFloat <= 12) continue;
    if (!factNumbers.has(n)) unknown.push(n);
  }
  return { ok: unknown.length === 0, unknownNumbers: [...new Set(unknown)] };
}

// ─────────────────────────────────────────────────────────────────────
// Komposisjon
// ─────────────────────────────────────────────────────────────────────

const COMPOSE_SYSTEM = `Du skriver fagposter for norske B2B-merkevarer (CreatorHub/The Role Room/Leadgrid), basert på VERIFISERTE markedsdata fra egen plattform.

Svar KUN med gyldig JSON:
{ "linkedin": "...", "instagram": "..." }

Regler:
- LinkedIn: faglig, konkret, 80–150 ord. Åpne med det mest overraskende TALLET. Ingen emojis-vegg, maks 2 relevante. Avslutt med ett spørsmål til bransjen. 2-4 relevante hashtags.
- Instagram: kortere (40-80 ord), mer direkte, 3-5 hashtags.
- BRUK KUN tall som står i faktalisten — ALDRI rund av, ALDRI dikt opp. Skriv tall nøyaktig som de står.
- Kilden nevnes naturlig («fra Regnskapsregisteret», «SSB-data 2015–2026») — det er troverdigheten.
- Ingen salgspitch — faget selger. Merkevaren signeres kun som avsender-kontekst.
- Norsk.`;

export interface ComposedDrafts {
  linkedin: string;
  instagram: string;
  facts: GrantFact[];
}

export async function composeSocialDrafts(
  pool: Pool,
  organizationId: string,
  solution: SolutionKey,
  angle?: string,
): Promise<{ drafts: ComposedDrafts } | { error: string; status: number }> {
  const facts = await buildSolutionEvidence(pool, organizationId, solution);
  if (facts.length < 3) return { error: "for_tynt_faktagrunnlag", status: 422 };

  const anthropic = getAnthropic();
  if (!anthropic) return { error: "anthropic_ikke_konfigurert", status: 503 };

  const response = await anthropic.messages.create({
    model: COMPOSER_MODEL,
    max_tokens: 800,
    system: COMPOSE_SYSTEM,
    messages: [{
      role: "user",
      content: [
        `MERKEVARE: ${solution}`,
        ...(angle ? [`ØNSKET VINKEL: ${angle.slice(0, 300)}`] : []),
        "",
        "FAKTA (kun disse tallene er lov):",
        ...facts.map((f) => `- (${f.source}) ${f.label}: ${f.value}`),
      ].join("\n"),
    }],
  });
  if (response.usage) {
    await recordAiUsage(pool, {
      organizationId, provider: "anthropic", operation: "content-composer",
      calls: 1, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    });
  }
  const raw = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  let parsed: { linkedin?: string; instagram?: string };
  try {
    parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  } catch {
    return { error: "composer_svarte_ugyldig_format", status: 502 };
  }
  if (typeof parsed.linkedin !== "string" || typeof parsed.instagram !== "string") {
    return { error: "composer_manglet_kanaler", status: 502 };
  }

  // Tall-validering per kanal — pyntede tall forkaster utkastet
  for (const [channel, body] of [["linkedin", parsed.linkedin], ["instagram", parsed.instagram]] as const) {
    const check = validatePostNumbers(body, facts);
    if (!check.ok) {
      return {
        error: `utkast_${channel}_har_tall_uten_kilde: ${check.unknownNumbers.join(", ")}`,
        status: 502,
      };
    }
  }

  return { drafts: { linkedin: parsed.linkedin, instagram: parsed.instagram, facts } };
}
