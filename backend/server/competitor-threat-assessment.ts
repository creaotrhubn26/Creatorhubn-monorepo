/**
 * competitor-threat-assessment.ts
 *
 * Gjenbrukbar Claude-vurdering av konkurrenter. Henter brukerens
 * brand-kit som baseline og ber Claude returnere threat_level (nær/
 * medium/fjern) + threat_score + "bekymre for" + "ignorer".
 *
 * Brukes fra:
 *   - POST /competitors/:id/assess (manuelt trigget av bruker)
 *   - POST /competitors (auto-fyr i bakgrunn etter add)
 *   - cron / scheduled re-assessment (fremtidig)
 *
 * Designvalg:
 *   - Best-effort: feiler aldri silent — kaster Error med klar grunn
 *   - Bruker `claude-opus-4-7` (samme som /assess endpoint hadde)
 *   - Idempotent: oppdaterer kolonnene, fjerner ikke andre felter
 *   - Returnerer hele oppdaterte raden så caller slipper å re-query
 */

import type { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";

export interface CompetitorThreatAssessment {
  threatLevel: "near" | "medium" | "far";
  threatScore: number;
  threatSummary: string;
  whatToWorryAbout: string;
  whatToIgnore: string;
}

interface CompetitorRow {
  id: string;
  name: string;
  domain: string;
  category: string | null;
  positioning: string | null;
  primary_offer: string | null;
}

export async function assessCompetitorThreat(
  pool: Pool,
  args: {
    competitorId: string;
    workspaceOwnerUserId: string;
    apiKey?: string;
  },
): Promise<CompetitorThreatAssessment> {
  const apiKey = args.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY mangler — kan ikke kjøre threat-vurdering");
  }

  // 1. Hent konkurrent + scope-sjekk
  const cr = await pool.query<CompetitorRow>(
    `SELECT id::text, name, domain, category, positioning, primary_offer
       FROM market_scan_competitors
      WHERE id = $1 AND workspace_owner_user_id = $2`,
    [args.competitorId, args.workspaceOwnerUserId],
  );
  if (cr.rows.length === 0) {
    throw new Error("competitor_not_found");
  }
  const comp = cr.rows[0];

  // 2. Hent brukerens brand-kit-baseline (siste)
  const bk = await pool.query<{ profile: string | null }>(
    `SELECT (brand_profile->>'positioning_summary')::text AS profile
       FROM brand_kits
      WHERE workspace_owner_user_id = $1
      ORDER BY updated_at DESC LIMIT 1`,
    [args.workspaceOwnerUserId],
  );
  const myProfile =
    bk.rows[0]?.profile ?? "(ingen brand-kit-summary registrert)";

  // 3. Claude-prompt
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Du er Role Room Agent. Vurder en konkurrent for vår egen bedrift.

VÅR EGEN POSISJONERING:
${myProfile}

KONKURRENTEN:
- Navn: ${comp.name}
- Domene: ${comp.domain}
- Kategori: ${comp.category ?? "?"}
- Tilbud: ${comp.primary_offer ?? "?"}
- Posisjonering: ${comp.positioning ?? "?"}

Returner strengt JSON:
{
  "threat_level": "near" | "medium" | "far",
  "threat_score": 0-100,
  "threat_summary": "1-2 setninger om hvorfor dette trussel-nivået",
  "what_to_worry_about": "konkrete grunner du må holde øye med dette",
  "what_to_ignore": "hva du IKKE bør bruke energi på rundt denne konkurrenten"
}`,
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
    threat_level: "near" | "medium" | "far";
    threat_score: number;
    threat_summary: string;
    what_to_worry_about: string;
    what_to_ignore: string;
  };

  // 4. Persistere på konkurrent-raden
  await pool.query(
    `UPDATE market_scan_competitors
        SET threat_level = $3,
            threat_score = $4,
            claude_threat_summary = $5,
            claude_what_to_worry_about = $6,
            claude_what_to_ignore = $7,
            claude_assessed_at = NOW()
      WHERE id = $1 AND workspace_owner_user_id = $2`,
    [
      comp.id,
      args.workspaceOwnerUserId,
      parsed.threat_level,
      parsed.threat_score,
      parsed.threat_summary,
      parsed.what_to_worry_about,
      parsed.what_to_ignore,
    ],
  );

  return {
    threatLevel: parsed.threat_level,
    threatScore: parsed.threat_score,
    threatSummary: parsed.threat_summary,
    whatToWorryAbout: parsed.what_to_worry_about,
    whatToIgnore: parsed.what_to_ignore,
  };
}
