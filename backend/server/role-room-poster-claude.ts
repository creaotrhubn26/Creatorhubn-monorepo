/**
 * Claude-drevet kampanje-konsept-generator for plakat-composeren.
 *
 * Tar inn brand-info + intent ("ukens tilbud", "nylansering", "mandag-bonus")
 * og returnerer JSON-matching campaign-feltene i PosterContent:
 *   { headlinePrimary, connector, headlineSecondary, subhead, burst, cta }
 *
 * Bruker prompt-cache på system-prompten — samme producer kan generere flere
 * varianter til ~1/5 input-tokens etter første kall.
 */

import type { BrandIdentity } from "./role-room-poster-composer.ts";

export interface CampaignConceptInput {
  brand: BrandIdentity;
  /** "monday-special" | "weekly-special" | "new-launch" | "season-promo" */
  templateId: string;
  /** Norsk fri-tekst — hva kampanjen handler om. F.eks. "Mandag er den
   *  kjipeste dagen, vi gjør den til Holy Monday" eller "Lansering av nye
   *  Detroit Style-pizzaer". */
  intent: string;
  /** Valgfri brand-voice/tone (matcher business_profiles.voice_description). */
  voice?: string;
  /** Valgfri eksisterende kampanje-tekst som referanse for tone (når
   *  bruker vil generere en variant). */
  referenceCampaign?: {
    headlinePrimary?: string;
    connector?: string;
    headlineSecondary?: string;
    subhead?: string;
    burst?: string;
    cta?: string;
  };
}

export interface CampaignConcept {
  headlinePrimary: string;
  connector?: string;
  headlineSecondary: string;
  subhead?: string;
  burst?: string;
  cta: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `Du er en norsk reklame-copywriter som skriver kampanje-tekst for restaurant-plakater.
Du jobber innenfor en spesifikk plakat-mal-struktur (monday-special, weekly-special, new-launch, season-promo) og
genererer korte, slagkraftige tekstlinjer som matcher brandets stemme.

REGLER:
- Skriv KUN på norsk (bokmål med mindre brand-stemmen sier nynorsk).
- headlinePrimary + headlineSecondary er hovedtittelen, et "før → etter"-grep.
  Eksempel monday-special: "Blue Monday" → "Holy Monday".
- connector er forbindelsen mellom de to (f.eks. "om til", "blir", "→"). Maks 6 tegn.
- subhead er én linje, all-caps-egnet, "KUN HVER MANDAG HOS X" / "KAMPANJE T.O.M. SØNDAG".
- burst er en skrå callout-bobble (1-3 ord per linje, energisk): "VI REDDER MANDAGEN DIN!".
- cta er bunn-handlingsoppfordring: "START UKA RIKTIG. BESTILL NÅ!".
- ALDRI bruk emojis eller utropstegn-jamming; brand-stemmen styrer intensiteten.

OUTPUT-FORMAT (strikt JSON, ingen markdown-fence, ingen kommentarer):
{
  "headlinePrimary": "Blue Monday",
  "connector": "om til",
  "headlineSecondary": "Holy Monday",
  "subhead": "Kun hver mandag hos Holy Crust",
  "burst": "Vi redder mandagen din!",
  "cta": "Start uka riktig. Bestill nå!"
}`;

function buildUserMessage(input: CampaignConceptInput): string {
  const lines: string[] = [];
  lines.push(`Brand: ${input.brand.businessName}`);
  if (input.voice) lines.push(`Brand-stemme: ${input.voice}`);
  lines.push(`Palett: primary ${input.brand.colors.primary}, secondary ${input.brand.colors.secondary}`);
  lines.push(`Template: ${input.templateId}`);
  lines.push(`Hva kampanjen handler om: ${input.intent}`);
  if (input.referenceCampaign) {
    lines.push("");
    lines.push("Referanse-tekst (samme brand, annen kampanje — hold tonen lik):");
    lines.push(JSON.stringify(input.referenceCampaign, null, 2));
  }
  lines.push("");
  lines.push("Returner JSON med headlinePrimary, connector, headlineSecondary, subhead, burst, cta.");
  return lines.join("\n");
}

function tryParseJson(text: string): CampaignConcept | null {
  // Fjern eventuelle markdown-fence-wrappers
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed?.headlinePrimary === "string" &&
      typeof parsed?.headlineSecondary === "string" &&
      typeof parsed?.cta === "string"
    ) {
      return parsed as CampaignConcept;
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateCampaignConcept(
  input: CampaignConceptInput,
): Promise<CampaignConcept | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[poster-claude] ANTHROPIC_API_KEY missing");
    return null;
  }

  let client: { messages: { create: (args: unknown) => Promise<{ content: Array<{ type: string; text?: string }> }> } };
  try {
    // @ts-ignore — optional SDK
    const mod: { default?: unknown; Anthropic?: unknown } = await import("@anthropic-ai/sdk");
    const Ctor = (mod.default ?? mod.Anthropic) as new (cfg: { apiKey: string | undefined }) => typeof client;
    client = new Ctor({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch (err) {
    console.error("[poster-claude] @anthropic-ai/sdk not available", err);
    return null;
  }

  const model = process.env.ROLE_ROOM_POSTER_MODEL || DEFAULT_MODEL;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // Cache system-prompten — samme bruker kan generere mange varianter
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildUserMessage(input) }],
    });
    let text = "";
    for (const block of response.content ?? []) {
      if (block.type === "text" && typeof block.text === "string") text += block.text;
    }
    const parsed = tryParseJson(text);
    if (!parsed) {
      console.error("[poster-claude] failed to parse JSON:", text.slice(0, 300));
      return null;
    }
    return parsed;
  } catch (err) {
    console.error("[poster-claude] Claude request failed:", err);
    return null;
  }
}
