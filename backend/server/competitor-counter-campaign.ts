/**
 * competitor-counter-campaign.ts
 *
 * Lead Map ↔ Marketing Cockpit-bro.
 *
 * Genererer en "mot-kampanje" for én konkurrent ved hjelp av Claude:
 * gitt brukerens brand-kit + konkurrent-profil + threat-vurdering,
 * foreslår Claude konkrete handlinger for å vinne markedet rundt
 * konkurrenten.
 *
 * Outputten har 4 deler:
 *   1. target_segment          — hvem skal vi nå (kort kundeprofil)
 *   2. key_messages            — 3-5 budskap som differensierer oss
 *   3. content_drafts          — 5 utkast (post/email/ads) klare til
 *                                kopier-til-clipboard eller sende til
 *                                marketing_workflow
 *   4. channel_mix             — anbefalt kanal-mix m/ rasjonale
 *
 * Designvalg:
 *   - Kaster Error med klare grunner (consistent m/ assessCompetitorThreat)
 *   - Returnerer struktur uten å persistere — UI bestemmer om bruker
 *     vil lagre som marketing_workflow (separat endepunkt)
 *   - Bruker brand-kit-baseline når den finnes — uten gir Claude
 *     fortsatt brukbare forslag basert på konkurrent-data alene
 */

import type { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";

export interface ContentDraft {
  type: "social_post" | "email" | "ad_copy" | "landing_hero" | "outreach_dm";
  title: string;
  body: string;
  rationale: string;
}

export interface CounterCampaign {
  competitorName: string;
  threatLevel: "near" | "medium" | "far" | null;
  targetSegment: string;
  keyMessages: string[];
  contentDrafts: ContentDraft[];
  channelMix: Array<{ channel: string; weight: number; rationale: string }>;
  generatedAt: string;
}

interface CompetitorRow {
  id: string;
  name: string;
  domain: string;
  category: string | null;
  positioning: string | null;
  primary_offer: string | null;
  threat_level: "near" | "medium" | "far" | null;
  claude_threat_summary: string | null;
  claude_what_to_worry_about: string | null;
}

export async function generateCounterCampaign(
  pool: Pool,
  args: {
    competitorId: string;
    workspaceOwnerUserId: string;
    organizationId: string;
    projectId: string;
    apiKey?: string;
  },
): Promise<CounterCampaign> {
  const apiKey = args.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY mangler — kan ikke generere kampanje");
  }

  // 1. Konkurrent m/ scope-sjekk
  const cr = await pool.query<CompetitorRow>(
    `SELECT id::text, name, domain, category, positioning, primary_offer,
            threat_level, claude_threat_summary, claude_what_to_worry_about
       FROM market_scan_competitors
      WHERE id = $1::uuid
        AND organization_id = $2::uuid
        AND project_id = $3`,
    [args.competitorId, args.organizationId, args.projectId],
  );
  if (cr.rows.length === 0) {
    throw new Error("competitor_not_found");
  }
  const comp = cr.rows[0];

  // 2. Min brand-kit-baseline (siste)
  const bk = await pool.query<{
    profile: string | null;
    tone: string | null;
    audience: string | null;
  }>(
    `SELECT (brand_profile->>'positioning_summary')::text AS profile,
            (brand_profile->>'tone')::text AS tone,
            (brand_profile->>'target_audience')::text AS audience
       FROM brand_kits
      WHERE project_id = $1
      ORDER BY updated_at DESC LIMIT 1`,
    [args.projectId],
  );
  const myProfile = bk.rows[0]?.profile ?? "(ingen brand-kit registrert)";
  const myTone = bk.rows[0]?.tone ?? "profesjonell";
  const myAudience = bk.rows[0]?.audience ?? "(ikke spesifisert)";

  // 3. Claude
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 3500,
    messages: [
      {
        role: "user",
        content: `Du er Leadgrids markedsanalytiker. Generer en konkret mot-kampanje for vår bedrift
mot denne spesifikke konkurrenten — kampanjen skal nå konkurrentens
potensielle kunder med tilbud de ikke kan motstå.

VÅR POSISJONERING:
${myProfile}

VÅR TONE: ${myTone}
VÅR MÅLGRUPPE: ${myAudience}

KONKURRENTEN:
- Navn: ${comp.name}
- Domene: ${comp.domain}
- Kategori: ${comp.category ?? "?"}
- Tilbud: ${comp.primary_offer ?? "?"}
- Posisjonering: ${comp.positioning ?? "?"}
- Threat-nivå: ${comp.threat_level ?? "ikke vurdert"}
${comp.claude_threat_summary ? `- Vurdering: ${comp.claude_threat_summary}` : ""}
${comp.claude_what_to_worry_about ? `- Det vi må holde øye med: ${comp.claude_what_to_worry_about}` : ""}

Returner strengt JSON:
{
  "target_segment": "Hvem skal vi nå? 1-2 setninger med kort kundeprofil — hvem konkurrentens potensielle kunder er og hvorfor de er åpne for vårt alternativ",
  "key_messages": ["3-5 differensierende budskap som hever oss over konkurrenten"],
  "content_drafts": [
    {
      "type": "social_post",
      "title": "Kort tittel",
      "body": "Hele post-teksten (Instagram/LinkedIn-format, 80-200 ord)",
      "rationale": "Hvorfor dette virker mot denne konkurrenten"
    },
    {
      "type": "email",
      "title": "Email-emne",
      "body": "Hele e-postteksten — kald-outreach til konkurrentens kunder",
      "rationale": "..."
    },
    {
      "type": "ad_copy",
      "title": "Ad-overskrift",
      "body": "Headline + body + CTA (under 100 ord total)",
      "rationale": "..."
    },
    {
      "type": "landing_hero",
      "title": "Landing-side hero-overskrift",
      "body": "Hero-tekst (overskrift + 1-2 linjer + CTA)",
      "rationale": "..."
    },
    {
      "type": "outreach_dm",
      "title": "DM-åpner",
      "body": "Direkte-melding på Instagram/LinkedIn (50-100 ord)",
      "rationale": "..."
    }
  ],
  "channel_mix": [
    {"channel": "instagram", "weight": 35, "rationale": "..."},
    {"channel": "linkedin", "weight": 25, "rationale": "..."},
    {"channel": "google_ads", "weight": 20, "rationale": "..."},
    {"channel": "email", "weight": 10, "rationale": "..."},
    {"channel": "outreach_dm", "weight": 10, "rationale": "..."}
  ]
}

Skriv på norsk. Tone: ${myTone}.`,
      },
    ],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`claude_no_json: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(jsonMatch[0]) as {
    target_segment: string;
    key_messages: string[];
    content_drafts: ContentDraft[];
    channel_mix: Array<{ channel: string; weight: number; rationale: string }>;
  };
  const allowedDraftTypes = new Set<ContentDraft["type"]>([
    "social_post", "email", "ad_copy", "landing_hero", "outreach_dm",
  ]);
  if (
    typeof parsed.target_segment !== "string"
    || !parsed.target_segment.trim()
    || !Array.isArray(parsed.key_messages)
    || !Array.isArray(parsed.content_drafts)
    || !Array.isArray(parsed.channel_mix)
  ) {
    throw new Error("claude_invalid_campaign_payload");
  }
  const keyMessages = parsed.key_messages
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .slice(0, 5)
    .map((value) => value.trim().slice(0, 1000));
  const contentDrafts = parsed.content_drafts
    .filter((draft): draft is ContentDraft => Boolean(
      draft
      && allowedDraftTypes.has(draft.type)
      && typeof draft.title === "string"
      && typeof draft.body === "string"
      && typeof draft.rationale === "string"
      && draft.title.trim()
      && draft.body.trim()
    ))
    .slice(0, 5)
    .map((draft) => ({
      type: draft.type,
      title: draft.title.trim().slice(0, 500),
      body: draft.body.trim().slice(0, 10000),
      rationale: draft.rationale.trim().slice(0, 2000),
    }));
  const channelMix = parsed.channel_mix
    .filter((item) => Boolean(
      item
      && typeof item.channel === "string"
      && item.channel.trim()
      && Number.isFinite(Number(item.weight))
      && Number(item.weight) >= 0
      && Number(item.weight) <= 100
      && typeof item.rationale === "string"
    ))
    .slice(0, 10)
    .map((item) => ({
      channel: item.channel.trim().slice(0, 100),
      weight: Number(item.weight),
      rationale: item.rationale.trim().slice(0, 2000),
    }));
  if (keyMessages.length === 0 || contentDrafts.length === 0 || channelMix.length === 0) {
    throw new Error("claude_invalid_campaign_payload");
  }

  return {
    competitorName: comp.name,
    threatLevel: comp.threat_level,
    targetSegment: parsed.target_segment.trim().slice(0, 2000),
    keyMessages,
    contentDrafts,
    channelMix,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Persistere en counter-campaign som marketing_workflow så den havner i
 * Marketing Cockpit. marketing_workflows har ikke et generic JSONB-felt,
 * så vi pakker hele Claude-strukturen som JSON i `notes`-kolonnen og
 * setter initiating_action='create_campaign' + current_status=
 * 'campaign_draft_created'.
 *
 * Cockpit-Marketing UI kan parse notes-feltet for å vise innholdet.
 * Senere kan vi flytte til en dedikert kolonne / tabell.
 */
export async function saveCounterCampaignToWorkflow(
  pool: Pool,
  args: {
    workspaceOwnerUserId: string;
    competitorId: string;
    organizationId: string;
    projectId: string;
    campaign: CounterCampaign;
  },
): Promise<{ workflowId: string }> {
  const competitor = await pool.query(
    `SELECT 1 FROM market_scan_competitors
      WHERE id = $1::uuid
        AND organization_id = $2::uuid
        AND project_id = $3
      LIMIT 1`,
    [args.competitorId, args.organizationId, args.projectId],
  );
  if (!competitor.rows.length) throw new Error("competitor_not_found");

  // Sjekk om marketing_workflows finnes (mig 276)
  const hasWorkflows = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
        WHERE table_name = 'marketing_workflows'
     ) AS exists`,
  );
  if (!hasWorkflows.rows[0].exists) {
    throw new Error("marketing_workflows_table_missing");
  }

  const wf = await pool.query<{ id: string }>(
    `INSERT INTO marketing_workflows (
       workspace_owner_user_id,
       organization_id,
       project_id,
       current_status,
       initiating_action,
       notes,
       next_recommended_action
     ) VALUES (
       $1, $2::uuid, $3, 'campaign_draft_created', 'create_campaign', $4, $5
     )
     RETURNING id::text`,
    [
      args.workspaceOwnerUserId,
      args.organizationId,
      args.projectId,
      JSON.stringify({
        source: "lead_map_counter_campaign",
        organization_id: args.organizationId,
        project_id: args.projectId,
        competitor_id: args.competitorId,
        competitor_name: args.campaign.competitorName,
        threat_level: args.campaign.threatLevel,
        target_segment: args.campaign.targetSegment,
        key_messages: args.campaign.keyMessages,
        content_drafts: args.campaign.contentDrafts,
        channel_mix: args.campaign.channelMix,
        generated_at: args.campaign.generatedAt,
      }),
      `Generer content-pack basert på ${args.campaign.contentDrafts.length} drafts og publiser i Marketing Cockpit`,
    ],
  );

  return { workflowId: wf.rows[0].id };
}
