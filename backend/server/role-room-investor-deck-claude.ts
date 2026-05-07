/**
 * role-room-investor-deck-claude.ts
 *
 * Generates section content for an investor-pitch deck via Claude.
 * One function per call: caller passes the section + business context,
 * we build the prompt from the template and return the generated body.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  getSectionDef,
  type InvestorSection,
} from "./role-room-investor-deck-template.js";

let clientImpl: Anthropic | null = null;
function getClient(): Anthropic {
  if (clientImpl) return clientImpl;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  clientImpl = new Anthropic({ apiKey });
  return clientImpl;
}

/** Test-only: inject a mock Anthropic client. */
export function __setInvestorClaudeClient(c: Anthropic | null): void {
  clientImpl = c;
}

export interface BusinessContext {
  brandName: string;
  industry?: string | null;
  description?: string | null;
  monthlyRevenueNok?: number | null;
  growthPhase?: string | null;
  customNote?: string | null; // free-form: e.g. "Vi søker 5M NOK seed til 30M cap"
}

export interface SectionGenerationResult {
  section: InvestorSection;
  body: string;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM_PROMPT = `Du er en pitch-deck-rådgiver for norske SMB- og scale-up-bedrifter som forbereder seg til en seed/angel-runde.

Skrivestil:
- Norsk, formell forretnings-stil
- Konkret og datadrevet, ikke hype
- Kort: hver punktlinje en setning eller mindre
- Bruk Markdown-bullets (- ...) når seksjonen ber om punkter
- Ingen anførselstegn rundt outputen
- Ingen forspil, ingen "Her er forslaget:" — returner kun innholdet selv

Gjenta aldri seksjons-tittelen i outputen. Brukeren har den allerede.`;

export async function generateInvestorSection(
  section: InvestorSection,
  context: BusinessContext,
): Promise<SectionGenerationResult> {
  const def = getSectionDef(section);
  if (!def) throw new Error(`Unknown investor section: ${section}`);

  const userPrompt = [
    `Selskap: ${context.brandName}`,
    context.industry ? `Bransje: ${context.industry}` : null,
    context.description ? `Beskrivelse: ${context.description}` : null,
    context.monthlyRevenueNok != null
      ? `Månedlig omsetning (NOK): ${context.monthlyRevenueNok.toLocaleString("no-NO")}`
      : null,
    context.growthPhase ? `Vekst-fase: ${context.growthPhase}` : null,
    context.customNote ? `Tilleggs-info: ${context.customNote}` : null,
    "",
    `Oppgave (${def.title}): ${def.prompt}`,
  ]
    .filter(Boolean)
    .join("\n");

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Extract text content
  const body = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return {
    section,
    body,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
