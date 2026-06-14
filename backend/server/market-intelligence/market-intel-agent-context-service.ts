/**
 * market-intel-agent-context-service.ts
 *
 * Adapter mellom Market Intelligence-modulen og Role Room Agent.
 *
 * Når Agent skal svare på spørsmål om markedet/kampanjen, trenger den å
 * vite om:
 *   - Brand Kit (merkevarens regler — farger, tone, USPs)
 *   - Recent Market Scans (hvilke konkurrenter ble funnet)
 *   - Top Opportunities (hva har vi anbefalt nylig)
 *   - Active Workflows (hva er i gang akkurat nå — kampanje-utkast, content
 *     pack, godkjenningsstatus)
 *
 * Denne servicen aggregerer alt dette til en KOMPAKT context-payload som
 * kan injectes i Agent sin system-prompt uten å sprenge token-budsjett.
 *
 * Filosofi:
 *   - Returner alltid en string-versjon som er ferdig for prompt-injection
 *   - Returner også et structured objekt for fremtidig tools-bruk
 *   - Aggressivt trunkering — Agent-kontekst skal være under ~2000 tokens
 */

import type { Pool } from "pg";
import {
  getBrandKit,
  toBaseline,
  type BrandKitBaseline,
} from "../brand-kit-service.js";
import { listMarketScans } from "./market-scan-service.js";
import type {
  MarketScan,
  OpportunityRecommendation,
} from "./types.js";
import { listWorkflowsForUser, type MarketingWorkflow } from "./marketing-cockpit-sync-service.js";

export interface MarketIntelAgentContext {
  brandKit: BrandKitBaseline | null;
  recentScans: MarketScan[];
  topOpportunities: OpportunityRecommendation[];
  activeWorkflows: MarketingWorkflow[];
  /** Ferdig-formattert string klar for injection i system-prompt */
  promptInjectionText: string;
}

export async function getMarketIntelAgentContext(
  pool: Pool,
  args: {
    projectId: string;
    workspaceOwnerUserId: string;
    maxScans?: number;
    maxOpportunities?: number;
    maxWorkflows?: number;
  },
): Promise<MarketIntelAgentContext> {
  // 1. Brand kit
  const kit = await getBrandKit(pool, args.projectId);
  const brandKit = kit ? toBaseline(kit) : null;

  // 2. Recent scans (3 nyeste completed)
  const scans = await listMarketScans(pool, {
    workspaceOwnerUserId: args.workspaceOwnerUserId,
    projectId: args.projectId,
    limit: args.maxScans ?? 3,
  });
  const completedScans = scans.filter((s) => s.status === "completed");

  // 3. Top opportunities fra nyeste scan
  let topOpportunities: OpportunityRecommendation[] = [];
  if (completedScans.length > 0) {
    const newest = completedScans[0];
    const r = await pool.query(
      `SELECT id::text, market_scan_id::text, title, simple_summary,
              why_it_matters, evidence_summary, recommended_action,
              impact, difficulty, confidence,
              can_create_campaign, can_create_content_pack, can_create_funnel_map,
              source_competitor_ids, source_technique_ids
         FROM market_scan_opportunities
        WHERE market_scan_id=$1::uuid
        ORDER BY
          CASE impact WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
          CASE confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
        LIMIT $2`,
      [newest.id, args.maxOpportunities ?? 4],
    );
    topOpportunities = r.rows.map((row) => ({
      id: row.id,
      marketScanId: row.market_scan_id,
      title: row.title,
      simpleSummary: row.simple_summary,
      whyItMatters: row.why_it_matters,
      evidenceSummary: row.evidence_summary,
      recommendedAction: row.recommended_action,
      impact: row.impact,
      difficulty: row.difficulty,
      confidence: row.confidence,
      canCreateCampaign: row.can_create_campaign,
      canCreateContentPack: row.can_create_content_pack,
      canCreateFunnelMap: row.can_create_funnel_map,
      sourceCompetitorIds: row.source_competitor_ids ?? [],
      sourceTechniqueIds: row.source_technique_ids ?? [],
    }));
  }

  // 4. Active workflows (states: campaign_draft_created, content_pack_created, approval_pending)
  const allWorkflows = await listWorkflowsForUser(pool, {
    workspaceOwnerUserId: args.workspaceOwnerUserId,
    limit: args.maxWorkflows ?? 5,
  });
  const activeWorkflows = allWorkflows
    .filter((w) =>
      ["campaign_draft_created", "content_pack_created", "approval_pending", "approved", "scheduled"].includes(w.currentStatus),
    )
    .slice(0, args.maxWorkflows ?? 5);

  // 5. Build prompt-injection text
  const promptInjectionText = buildPromptInjectionText({
    brandKit,
    recentScans: completedScans,
    topOpportunities,
    activeWorkflows,
  });

  return {
    brandKit,
    recentScans: completedScans,
    topOpportunities,
    activeWorkflows,
    promptInjectionText,
  };
}

function buildPromptInjectionText(args: {
  brandKit: BrandKitBaseline | null;
  recentScans: MarketScan[];
  topOpportunities: OpportunityRecommendation[];
  activeWorkflows: MarketingWorkflow[];
}): string {
  const sections: string[] = [];

  sections.push("===== MARKET INTELLIGENCE CONTEXT =====");

  // Brand kit
  if (args.brandKit) {
    const b = args.brandKit;
    sections.push("");
    sections.push("BRAND:");
    sections.push(`  Navn: ${b.brandName}`);
    sections.push(`  Industri: ${b.industry}`);
    sections.push(`  Tone-of-voice: ${b.toneOfVoice}`);
    sections.push(`  Målgruppe: ${b.targetAudience}`);
    sections.push(`  Primær CTA: ${b.primaryCTA}`);
    sections.push(`  USPs: ${b.usps.slice(0, 5).join(" · ")}`);
    sections.push(`  Hovedfarge: ${b.primaryColor} (aksent: ${b.accentColor})`);
  } else {
    sections.push("");
    sections.push("BRAND: (ingen brand kit registrert ennå — anbefal at brukeren kjører Brand Scan først)");
  }

  // Recent scans
  if (args.recentScans.length > 0) {
    sections.push("");
    sections.push("SENESTE MARKET SCANS:");
    for (const s of args.recentScans) {
      sections.push(`  · "${s.name}" (${s.marketQuery.slice(0, 80)}…) — ${s.totalCompetitors} konkurrenter, ${s.totalOpportunities} anbefalinger, confidence: ${s.confidenceSummary}`);
    }
  } else {
    sections.push("");
    sections.push("SENESTE MARKET SCANS: (ingen ferdige scans ennå)");
  }

  // Top opportunities
  if (args.topOpportunities.length > 0) {
    sections.push("");
    sections.push("TOPP-ANBEFALINGER (nyeste scan):");
    for (const o of args.topOpportunities) {
      sections.push(`  · "${o.title}" [impact: ${o.impact}, confidence: ${o.confidence}]`);
      sections.push(`      Summary: ${o.simpleSummary}`);
      sections.push(`      Next: ${o.recommendedAction}`);
      sections.push(`      Source-trace: oppo-id=${o.id}, scan-id=${o.marketScanId}`);
    }
  }

  // Active workflows
  if (args.activeWorkflows.length > 0) {
    sections.push("");
    sections.push("AKTIVE KAMPANJER & UTKAST (workflows i gang):");
    for (const w of args.activeWorkflows) {
      sections.push(`  · workflow-id=${w.id} · status: ${w.currentStatus} · ${w.initiatingAction}`);
      if (w.campaignDraftId) sections.push(`      → kampanje-draft-id: ${w.campaignDraftId} (i marketing_post_drafts)`);
      if (w.contentPackDraftIds.length > 0) sections.push(`      → content-pack-drafts: ${w.contentPackDraftIds.length} stk`);
      if (w.nextRecommendedAction) sections.push(`      neste: ${w.nextRecommendedAction}`);
    }
  }

  sections.push("");
  sections.push("INSTRUKSJON FOR AGENTEN:");
  sections.push("  - Bruk denne konteksten til å svare på spørsmål om kampanjer, konkurrenter, anbefalinger.");
  sections.push("  - Når brukeren ber om utkast: bruk brand tone-of-voice og USPs.");
  sections.push("  - Når brukeren ber om sammenligning: referer til konkrete scans (med id).");
  sections.push("  - Aldri foreslå konkurrenter du ikke har sett i scans-listen.");
  sections.push("  - Hvis brukeren ber om 'lag kampanje for opportunity X': si at de kan klikke 'Lag kampanje'-knappen i Market Intelligence-detail-siden.");
  sections.push("");
  sections.push("===== END MARKET INTELLIGENCE CONTEXT =====");

  return sections.join("\n");
}

// ─────────────────────────────────────────────────────────────────────
// Agent tools (for fremtidig integration i agent-runner)
// ─────────────────────────────────────────────────────────────────────

/**
 * Claude tool-schemas som Agent kan bruke for å handle på MI-context.
 * Eksporteres slik at role-room-agent-definition.ts kan inkludere dem.
 */
export const MARKET_INTEL_AGENT_TOOLS = [
  {
    name: "summarize_market_findings",
    description: "Oppsummerer hovedfunnene fra siste market scan på norsk for et bestemt prosjekt. Bruk når brukeren spør 'hva fant vi i markedet' eller lignende.",
    input_schema: {
      type: "object" as const,
      properties: {
        scanId: {
          type: "string",
          description: "UUID til market_scan å oppsummere. Bruk newest hvis ikke angitt.",
        },
        focus: {
          type: "string",
          enum: ["competitors", "techniques", "funnel_gaps", "opportunities", "all"],
          description: "Hva oppsummeringen skal fokusere på.",
        },
      },
      required: ["focus"],
    },
  },
  {
    name: "draft_campaign_from_opportunity",
    description: "Genererer et kampanje-utkast (LinkedIn post) fra en gitt opportunity-id. Tilsvarer 'Lag kampanje'-knappen i Market Intelligence UI.",
    input_schema: {
      type: "object" as const,
      properties: {
        opportunityId: {
          type: "string",
          description: "UUID til market_scan_opportunity som kampanjen skal baseres på.",
        },
        platform: {
          type: "string",
          enum: ["linkedin", "facebook", "instagram", "email"],
          description: "Hvilken plattform kampanjen skal lages for.",
        },
      },
      required: ["opportunityId"],
    },
  },
  {
    name: "compare_landing_pages",
    description: "Sammenligner brand-kundens landingsside med konkurrentenes for å finne hva som skiller seg ut. Bruker market scan data.",
    input_schema: {
      type: "object" as const,
      properties: {
        scanId: {
          type: "string",
          description: "UUID til market_scan som inneholder konkurrentene.",
        },
      },
      required: ["scanId"],
    },
  },
];
