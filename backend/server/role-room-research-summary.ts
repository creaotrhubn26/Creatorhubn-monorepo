/**
 * Executive summary generator — item #42.
 *
 * Takes a fresh bootstrap result and asks Claude (Haiku for cost — this
 * is 2-3 sentences, no need for Sonnet) to write a concise pitch-ready
 * summary. Returns the string; caller can persist it on the version row
 * or surface it directly in the overlay's sticky summary card.
 *
 * Best-effort: returns null on any failure (no API key, rate limit,
 * malformed response). The overlay falls back to the company-profile
 * summary that the bootstrap already wrote.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { RoleRoomAgentNormalizedPayload } from "./role-room-agent.js";

const SUMMARY_MODEL = process.env.ROLE_ROOM_SUMMARY_MODEL || "claude-haiku-4-5-20251001";
const SUMMARY_MAX_TOKENS = 250;

let cachedClient: Anthropic | null | undefined;
function getAnthropic(): Anthropic | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    cachedClient = null;
    return null;
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export async function generateExecutiveSummary(
  result: RoleRoomAgentNormalizedPayload,
): Promise<string | null> {
  const client = getAnthropic();
  if (!client) return null;

  const profile = result.companyProfile;
  if (!profile) return null;

  const competitorNames = (result.competitorAnalysis?.competitors ?? [])
    .filter((c: { status?: string }) => c.status === "verified" || c.status === "likely")
    .slice(0, 5)
    .map((c: { name?: string }) => c.name ?? "")
    .filter((n: string) => n.length > 0)
    .join(", ");
  const localOpportunities = (result.localPresencePlan?.nearbyOpportunities ?? [])
    .slice(0, 3)
    .map((o: { name?: string }) => o.name ?? "")
    .filter((n: string) => n.length > 0)
    .join(", ");

  const userMessage = `Skriv en executive summary på nøyaktig 2-3 setninger, på norsk, for følgende bedrift. Tonen skal være konkret og pitchbar — ingen overskrifter, ingen bullet points, kun løpende tekst.

Bedrift: ${profile.companyName}
Bransje: ${profile.industry}${profile.subIndustry ? ` / ${profile.subIndustry}` : ""}
Forretningsmodell: ${profile.businessModel}
Tilbud: ${(profile.offerings ?? []).slice(0, 3).join("; ")}
Målgruppe: ${(profile.targetAudience ?? []).slice(0, 3).join("; ")}
${competitorNames ? `Konkurrenter (verified): ${competitorNames}` : ""}
${localOpportunities ? `Lokale muligheter: ${localOpportunities}` : ""}

Fokuser på: hvem de er, hva som differensierer dem, og hvilken markedsmulighet vi ser. Ingen disclaimer-tekster, ingen "I summary"-fraser.`;

  try {
    const response = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: SUMMARY_MAX_TOKENS,
      temperature: 0.3,
      messages: [{ role: "user", content: userMessage }],
    });
    const block = response.content[0];
    if (!block || block.type !== "text") return null;
    const text = block.text.trim();
    if (text.length === 0) return null;
    // Sanity cap so a runaway response never breaks the UI layout.
    return text.slice(0, 600);
  } catch (error) {
    console.error("[role-room-research-summary] generation failed", {
      researchId: result.researchId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
