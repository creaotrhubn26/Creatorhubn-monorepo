/**
 * content-pack-generator-service.ts
 *
 * Gitt en OpportunityRecommendation + Brand Kit, generer en strukturert
 * content pack via Claude:
 *
 *   - LinkedIn posts (3 varianter)
 *   - Instagram captions (3 varianter)
 *   - Meta ads concepts (3 hooks)
 *   - email subject lines (5 varianter)
 *   - email sequence (3 emails)
 *   - landing page outline
 *   - short video script
 *   - carousel outline
 *
 * Hvert element kan lagres som en `marketing_post_drafts`-rad (eksisterende
 * tabell — vi gjenbruker den fra Marketing Cockpit). Vi setter `brand_key`
 * og `platform` tilsvarende, slik at draftene dukker opp i Content Calendar.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { OpportunityRecommendation } from "./types.js";
import type { BrandKitBaseline } from "../brand-kit-service.js";

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

export interface ContentPackItem {
  /** En av: linkedin_post, instagram_caption, meta_ad_hook, email_subject,
   *  email_body, landing_page_outline, video_script, carousel_outline */
  format: string;
  /** Plattform for marketing_post_drafts: facebook|instagram|linkedin|tiktok|email|web */
  platform: string;
  /** Forklarende tittel (ikke publisert) */
  title: string;
  /** Den faktiske teksten */
  body: string;
  /** Foreslått call-to-action */
  ctaText?: string;
  /** Hashtag-forslag */
  hashtags?: string[];
  /** Image-brief (hvis relevant) */
  imageBrief?: string;
}

export interface ContentPackResult {
  items: ContentPackItem[];
  summary: string;
}

const SYSTEM_PROMPT = `Du er en innholds-strateg som lager hele content packs basert på en konkret marketing-anbefaling og merkevaren sin brand kit.

REGLER:
- Bruk merkevarens tone og USPs
- Hold språket norsk
- Bestemor-vennlig — unngå sjargong
- Aldri lov kunder noe vi ikke kan levere

OUTPUT (gyldig JSON):
{
  "items": [
    { "format": "linkedin_post", "platform": "linkedin", "title": "Variant A — Smerteinngang", "body": "...", "ctaText": "..." },
    { "format": "linkedin_post", "platform": "linkedin", "title": "Variant B — Sosial bevis", "body": "..." },
    { "format": "linkedin_post", "platform": "linkedin", "title": "Variant C — Direkte tilbud", "body": "..." },
    { "format": "instagram_caption", "platform": "instagram", "title": "Variant A", "body": "...", "hashtags": ["#..."] },
    { "format": "instagram_caption", "platform": "instagram", "title": "Variant B", "body": "...", "hashtags": ["#..."] },
    { "format": "instagram_caption", "platform": "instagram", "title": "Variant C", "body": "...", "hashtags": ["#..."] },
    { "format": "meta_ad_hook", "platform": "facebook", "title": "Hook A", "body": "...", "imageBrief": "..." },
    { "format": "meta_ad_hook", "platform": "facebook", "title": "Hook B", "body": "...", "imageBrief": "..." },
    { "format": "meta_ad_hook", "platform": "facebook", "title": "Hook C", "body": "...", "imageBrief": "..." },
    { "format": "email_subject", "platform": "email", "title": "Subject 1", "body": "..." },
    { "format": "email_subject", "platform": "email", "title": "Subject 2", "body": "..." },
    { "format": "email_subject", "platform": "email", "title": "Subject 3", "body": "..." },
    { "format": "email_subject", "platform": "email", "title": "Subject 4", "body": "..." },
    { "format": "email_subject", "platform": "email", "title": "Subject 5", "body": "..." },
    { "format": "email_body", "platform": "email", "title": "Email 1 — Velkomst", "body": "..." },
    { "format": "email_body", "platform": "email", "title": "Email 2 — Verdi", "body": "..." },
    { "format": "email_body", "platform": "email", "title": "Email 3 — Tilbud", "body": "..." },
    { "format": "landing_page_outline", "platform": "web", "title": "Landingsside-struktur", "body": "Hero — ... | Bevis — ... | Tilbud — ... | FAQ — ... | CTA — ..." },
    { "format": "video_script", "platform": "tiktok", "title": "30-sek video", "body": "Sek 0–3 hook | Sek 3–18 verdi | Sek 18–30 CTA" },
    { "format": "carousel_outline", "platform": "instagram", "title": "5-slide carousel", "body": "Slide 1 — Hook | Slide 2 — Smerte | Slide 3 — Løsning | Slide 4 — Bevis | Slide 5 — CTA" }
  ],
  "summary": "1–2 setninger som forklarer den røde tråden."
}`;

function buildUserPrompt(
  opportunity: OpportunityRecommendation,
  brand: BrandKitBaseline | null,
): string {
  const lines: string[] = [];
  lines.push(`Anbefaling: ${opportunity.title}`);
  lines.push(`Hvorfor: ${opportunity.whyItMatters}`);
  lines.push(`Bevis: ${opportunity.evidenceSummary}`);
  lines.push(`Neste handling: ${opportunity.recommendedAction}`);
  lines.push("");
  if (brand) {
    lines.push(`Merkevare: ${brand.brandName}`);
    lines.push(`Industri: ${brand.industry}`);
    lines.push(`Tone: ${brand.toneOfVoice}`);
    lines.push(`USPs: ${brand.usps.slice(0, 5).join("; ")}`);
    lines.push(`Primær CTA: ${brand.primaryCTA}`);
    lines.push("");
  }
  lines.push(`Generer en komplett content pack. Returner KUN JSON.`);
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

export async function generateContentPack(
  opportunity: OpportunityRecommendation,
  brand: BrandKitBaseline | null,
): Promise<ContentPackResult> {
  const client = getAnthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(opportunity, brand) }],
  });

  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  const parsed = tryParseJson<ContentPackResult>(text);
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error("content_pack_invalid_response");
  }
  return parsed;
}
