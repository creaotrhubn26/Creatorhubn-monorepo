/**
 * lead-outreach-strategy.ts
 *
 * Claude-anbefalt outreach-strategi per lead.
 *
 * Tar lead-profilen (kategori, status, score, tilgjengelige kanaler,
 * region, sist-aktivitet) og brand-kit-baseline, og foreslår:
 *   - primary_channel: hovedkanal (cold_call/email/instagram_dm/
 *                      linkedin/in_person/social_proof)
 *   - secondary_channels: backup-kanaler i prioritert rekkefølge
 *   - opening_line: personalisert åpner (1-2 setninger)
 *   - best_time: når på dagen/uka er optimalt
 *   - sequence: 3-5 trinns oppfølgings-sekvens med dag-offset
 *   - rationale: hvorfor denne strategien for akkurat denne leaden
 *
 * Designvalg:
 *   - Bruker bare ekte lead-data — refuserer å gjette på manglende felt
 *   - Hvis lead mangler email/phone/instagram, ekskluderer Claude
 *     disse kanalene fra forslagene
 *   - Persisteres ikke som default — frontend lagrer manuelt hvis ønsket
 */

import type { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { withAIQuota } from "./leadgrid-ai-queue.js";

export type OutreachChannel =
  | "cold_call"
  | "email"
  | "instagram_dm"
  | "linkedin"
  | "in_person"
  | "social_proof"
  | "sms"
  | "google_my_business_review";

export interface OutreachStep {
  day: number;
  channel: OutreachChannel;
  action: string;
  template: string;
}

export interface OutreachStrategy {
  leadName: string;
  primaryChannel: OutreachChannel;
  secondaryChannels: OutreachChannel[];
  openingLine: string;
  bestTime: string;
  sequence: OutreachStep[];
  rationale: string;
  confidence: "low" | "medium" | "high";
  generatedAt: string;
}

interface LeadRow {
  id: string;
  name: string;
  company: string | null;
  lead_category: string | null;
  lead_status: string;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  google_rating: number | null;
  ai_opportunity_score: number | null;
  notes: string | null;
  last_visit_at: string | null;
  updated_at: string;
}

export async function recommendOutreachStrategy(
  pool: Pool,
  args: {
    leadId: string;
    workspaceOwnerUserId: string;
    apiKey?: string;
  },
): Promise<OutreachStrategy> {
  const apiKey = args.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY mangler — kan ikke generere strategi");
  }

  const lr = await pool.query<LeadRow>(
    `SELECT id::text, name, company, lead_category, lead_status,
            city, country, phone, email, website_url, instagram_url,
            linkedin_url, google_rating, ai_opportunity_score, notes,
            last_visit_at::text, updated_at::text
       FROM crm_customers
      WHERE id = $1 AND owner_user_id = $2`,
    [args.leadId, args.workspaceOwnerUserId],
  );
  if (lr.rows.length === 0) {
    throw new Error("lead_not_found");
  }
  const lead = lr.rows[0];

  // Min brand-kit-baseline
  const bk = await pool.query<{ profile: string | null; tone: string | null }>(
    `SELECT (brand_profile->>'positioning_summary')::text AS profile,
            (brand_profile->>'tone')::text AS tone
       FROM brand_kits
      WHERE workspace_owner_user_id = $1
      ORDER BY updated_at DESC LIMIT 1`,
    [args.workspaceOwnerUserId],
  );
  const myProfile = bk.rows[0]?.profile ?? "(ingen brand-kit-summary)";
  const myTone = bk.rows[0]?.tone ?? "profesjonell";

  // Tilgjengelige kanaler — slik at Claude ikke foreslår noe vi ikke har
  const availableChannels: OutreachChannel[] = [];
  if (lead.phone) availableChannels.push("cold_call", "sms");
  if (lead.email) availableChannels.push("email");
  if (lead.instagram_url) availableChannels.push("instagram_dm");
  if (lead.linkedin_url) availableChannels.push("linkedin");
  if (lead.city) availableChannels.push("in_person");
  if (lead.google_rating != null) availableChannels.push("google_my_business_review");
  availableChannels.push("social_proof"); // alltid mulig

  const client = new Anthropic({ apiKey });
  const msg = await withAIQuota("claude", null, () => client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2500,
    messages: [
      {
        role: "user",
        content: `Du er Role Room Agent. Foreslå optimal outreach-strategi for
denne spesifikke leaden, basert på deres profil og vår posisjonering.

VÅR POSISJONERING:
${myProfile}

VÅR TONE: ${myTone}

LEADEN:
- Navn: ${lead.name}
- Selskap: ${lead.company ?? "?"}
- Kategori: ${lead.lead_category ?? "?"}
- Status: ${lead.lead_status}
- By: ${lead.city ?? "?"}, ${lead.country ?? "?"}
- Google rating: ${lead.google_rating ?? "?"}
- AI Opportunity Score: ${lead.ai_opportunity_score ?? "?"} / 100
- Notater: ${lead.notes?.slice(0, 300) ?? "(ingen)"}
- Sist oppdatert: ${lead.updated_at}
${lead.last_visit_at ? `- Sist besøkt: ${lead.last_visit_at}` : "- Aldri besøkt"}

TILGJENGELIGE KANALER (kun foreslå disse):
${availableChannels.map((c) => `  - ${c}`).join("\n")}

Returner strengt JSON:
{
  "primary_channel": "cold_call" | "email" | "instagram_dm" | "linkedin" | "in_person" | "social_proof" | "sms" | "google_my_business_review",
  "secondary_channels": ["..."],
  "opening_line": "Personalisert åpningssetning som referer til noe spesifikt om leaden — én eller to setninger",
  "best_time": "Beste tidspunkt for kontakt — f.eks. 'Tirsdag-torsdag 9-11 før lunsj' eller 'Søndag kveld for restaurant-bransje'",
  "sequence": [
    {
      "day": 0,
      "channel": "...",
      "action": "Kort handling — f.eks. 'Send DM med kompliment om deres post'",
      "template": "Selve teksten/manuset (50-150 ord, klar til kopier)"
    },
    {
      "day": 3,
      "channel": "...",
      "action": "...",
      "template": "..."
    }
    // 3-5 trinn totalt
  ],
  "rationale": "Hvorfor akkurat denne strategien for akkurat denne leaden — 2-3 setninger",
  "confidence": "low" | "medium" | "high"
}

KRITISK: Bare bruk kanaler fra TILGJENGELIGE KANALER. Hvis email mangler, ikke foreslå email. Skriv på norsk. Tone: ${myTone}.`,
      },
    ],
  }));

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`claude_no_json: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(jsonMatch[0]) as {
    primary_channel: OutreachChannel;
    secondary_channels: OutreachChannel[];
    opening_line: string;
    best_time: string;
    sequence: OutreachStep[];
    rationale: string;
    confidence: "low" | "medium" | "high";
  };

  return {
    leadName: lead.name,
    primaryChannel: parsed.primary_channel,
    secondaryChannels: parsed.secondary_channels,
    openingLine: parsed.opening_line,
    bestTime: parsed.best_time,
    sequence: parsed.sequence,
    rationale: parsed.rationale,
    confidence: parsed.confidence,
    generatedAt: new Date().toISOString(),
  };
}
