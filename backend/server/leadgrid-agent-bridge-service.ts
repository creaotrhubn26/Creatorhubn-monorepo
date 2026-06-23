/**
 * leadgrid-agent-bridge-service.ts
 *
 * Role Room Agent Bridge — kjør alle Role Room Agent-services i en
 * koordinert pipeline per lead og persisterer en full intelligence-
 * rapport i crm_customers.enrichment_data.full_intelligence.
 *
 * Moduler:
 *   1) brreg       — enrichLeadWithBrreg
 *   2) website     — analyzeWebsite (BrandProfile)
 *   3) competitors — Claude (konkurrent-analyse + trussel-vurdering)
 *   4) merch       — Claude (passer leadens behov til våre tjenester?)
 *   5) threat      — Claude (markedstrusler + muligheter)
 *   6) swot        — Re-bruk eksisterende leadgrid_research (cached)
 *   7) outreach    — recommendOutreachStrategy
 *
 * Hver modul wrappes i try/catch slik at en feilet modul ikke stopper
 * de andre. Errors samles per-modul i rapport.errors.
 */

import type { Pool } from "pg";

export interface CompetitorAnalysis {
  name: string;
  domain: string;
  threat_level: "low" | "medium" | "high";
  market_position: string;
  differentiators: string[];
  weaknesses: string[];
}

export interface MerchFitAnalysis {
  fits_video: boolean;
  fits_photo: boolean;
  fits_brand: boolean;
  fits_strategy: boolean;
  reasoning: string;
}

export interface ThreatAssessment {
  market_threats: string[];
  market_opportunities: string[];
  urgency: "low" | "medium" | "high";
}

export type ModuleKey =
  | "brreg"
  | "website"
  | "competitors"
  | "merch"
  | "threat"
  | "swot"
  | "outreach";

export interface FullLeadIntelligenceReport {
  leadId: string;
  generatedAt: string;
  modules_run: ModuleKey[];
  brreg: unknown | null;
  website: unknown | null;
  competitors: CompetitorAnalysis[] | null;
  merch_fit: MerchFitAnalysis | null;
  threat_assessment: ThreatAssessment | null;
  swot: unknown | null;
  outreach: unknown | null;
  errors: Record<string, string>;
  overall_confidence: number;
}

interface LeadRow {
  name: string;
  lead_category: string | null;
  city: string | null;
  website_url: string | null;
  owner_user_id: string | null;
}

/** Slå opp basis-felt for lead. */
async function fetchLeadBasic(
  pool: Pool,
  leadId: string,
): Promise<LeadRow | null> {
  const r = await pool.query<LeadRow>(
    `SELECT name, lead_category, city, website_url, owner_user_id::text
       FROM crm_customers
      WHERE id = $1::uuid
      LIMIT 1`,
    [leadId],
  );
  return r.rows[0] ?? null;
}

/** BRREG-berikkelse via eksisterende service. */
async function runBrreg(
  pool: Pool,
  leadId: string,
  workspaceOwnerUserId: string,
): Promise<unknown | null> {
  try {
    const mod = await import("./lead-brreg-service.js");
    if (typeof mod.enrichLeadWithBrreg !== "function") return null;
    return await mod.enrichLeadWithBrreg(pool, {
      leadId,
      workspaceOwnerUserId,
    });
  } catch (err) {
    console.warn("[agent-bridge] brreg feilet:", err);
    return null;
  }
}

/** Website-analyse via eksisterende analyzeWebsite. */
async function runWebsite(websiteUrl: string | null): Promise<unknown | null> {
  if (!websiteUrl || websiteUrl.trim().length === 0) return null;
  try {
    const mod = await import("./role-room-website-analyzer.js");
    if (typeof mod.analyzeWebsite !== "function") return null;
    return await mod.analyzeWebsite(websiteUrl);
  } catch (err) {
    console.warn("[agent-bridge] website feilet:", err);
    return null;
  }
}

/** Konkurrent-analyse + trussel-vurdering i én Claude-call. */
async function runCompetitorsAndThreat(
  lead: LeadRow,
  website: unknown | null,
): Promise<{ competitors: CompetitorAnalysis[] | null; threat: ThreatAssessment | null }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { competitors: null, threat: null };
  }
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const websiteSummary = website
      ? `Brand-baseline: ${JSON.stringify(website).slice(0, 800)}`
      : "";
    const prompt = `Analyser konkurransesituasjonen og markedstrusler for bedriften "${lead.name}" ${
      lead.lead_category ? `(${lead.lead_category})` : ""
    } ${lead.city ? `i ${lead.city}` : ""}.

${websiteSummary}

Returner KUN gyldig JSON i dette skjemaet:
{
  "competitors": [{"name": "...", "domain": "...", "threat_level": "low|medium|high", "market_position": "...", "differentiators": ["..."], "weaknesses": ["..."]}],
  "threat_assessment": {"market_threats": ["..."], "market_opportunities": ["..."], "urgency": "low|medium|high"}
}`;
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { competitors: null, threat: null };
    const parsed = JSON.parse(match[0]) as {
      competitors?: CompetitorAnalysis[];
      threat_assessment?: ThreatAssessment;
    };
    return {
      competitors: parsed.competitors ?? null,
      threat: parsed.threat_assessment ?? null,
    };
  } catch (err) {
    console.warn("[agent-bridge] competitors feilet:", err);
    return { competitors: null, threat: null };
  }
}

/** Merch-fit-analyse: passer leadens behov til Creatorhubn-tjenestene? */
async function runMerchFit(
  lead: LeadRow,
  website: unknown | null,
): Promise<MerchFitAnalysis | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const websiteSummary = website
      ? `Brand-baseline: ${JSON.stringify(website).slice(0, 800)}`
      : "";
    const prompt = `Bedriften "${lead.name}" ${
      lead.lead_category ? `(${lead.lead_category})` : ""
    } vurderes for våre tjenester: video-produksjon, foto, brand-strategi, og marketing-strategi.

${websiteSummary}

Returner KUN gyldig JSON:
{
  "fits_video": true|false,
  "fits_photo": true|false,
  "fits_brand": true|false,
  "fits_strategy": true|false,
  "reasoning": "..."
}`;
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as MerchFitAnalysis;
  } catch (err) {
    console.warn("[agent-bridge] merch fit feilet:", err);
    return null;
  }
}

/** Re-bruk SWOT fra leadgrid-research (cached i enrichment_data.leadgrid_research). */
async function runSWOT(
  pool: Pool,
  leadId: string,
): Promise<unknown | null> {
  try {
    const r = await pool.query<{ enrichment_data: Record<string, unknown> | null }>(
      `SELECT enrichment_data FROM crm_customers WHERE id=$1::uuid`,
      [leadId],
    );
    const data = r.rows[0]?.enrichment_data;
    if (!data || typeof data !== "object") return null;
    return (data as Record<string, unknown>).leadgrid_research ?? null;
  } catch {
    return null;
  }
}

/** Outreach strategy via eksisterende service. */
async function runOutreach(
  pool: Pool,
  leadId: string,
  workspaceOwnerUserId: string,
): Promise<unknown | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const mod = await import("./lead-outreach-strategy.js");
    if (typeof mod.recommendOutreachStrategy !== "function") return null;
    return await mod.recommendOutreachStrategy(pool, {
      leadId,
      workspaceOwnerUserId,
    });
  } catch (err) {
    console.warn("[agent-bridge] outreach feilet:", err);
    return null;
  }
}

/** Hoved-orkestrator: kjør alle valgte moduler parallelt der mulig. */
export async function generateFullIntelligenceReport(
  pool: Pool,
  leadId: string,
  opts?: { modules?: ModuleKey[]; callerUserId?: string },
): Promise<FullLeadIntelligenceReport> {
  const modules: ModuleKey[] = opts?.modules ?? [
    "brreg",
    "website",
    "competitors",
    "merch",
    "threat",
    "swot",
    "outreach",
  ];
  const errors: Record<string, string> = {};

  const lead = await fetchLeadBasic(pool, leadId);
  if (!lead) {
    return {
      leadId,
      generatedAt: new Date().toISOString(),
      modules_run: modules,
      brreg: null,
      website: null,
      competitors: null,
      merch_fit: null,
      threat_assessment: null,
      swot: null,
      outreach: null,
      errors: { lead: "lead_not_found" },
      overall_confidence: 0,
    };
  }

  const workspaceOwnerUserId = lead.owner_user_id ?? opts?.callerUserId ?? "";
  const want = (m: ModuleKey) => modules.includes(m);

  // 1) Kjør brreg + website først (andre moduler kan bruke website).
  const [brreg, website] = await Promise.all([
    want("brreg") && workspaceOwnerUserId
      ? runBrreg(pool, leadId, workspaceOwnerUserId).catch((e) => {
          errors.brreg = String(e);
          return null;
        })
      : Promise.resolve(null),
    want("website")
      ? runWebsite(lead.website_url).catch((e) => {
          errors.website = String(e);
          return null;
        })
      : Promise.resolve(null),
  ]);

  // 2) Kjør resterende parallelt.
  const [compAndThreat, merch, swot, outreach] = await Promise.all([
    want("competitors") || want("threat")
      ? runCompetitorsAndThreat(lead, website).catch((e) => {
          errors.competitors = String(e);
          return { competitors: null, threat: null };
        })
      : Promise.resolve({ competitors: null, threat: null }),
    want("merch")
      ? runMerchFit(lead, website).catch((e) => {
          errors.merch = String(e);
          return null;
        })
      : Promise.resolve(null),
    want("swot")
      ? runSWOT(pool, leadId).catch((e) => {
          errors.swot = String(e);
          return null;
        })
      : Promise.resolve(null),
    want("outreach") && workspaceOwnerUserId
      ? runOutreach(pool, leadId, workspaceOwnerUserId).catch((e) => {
          errors.outreach = String(e);
          return null;
        })
      : Promise.resolve(null),
  ]);

  // Confidence = (moduler som returnerte non-null) / (moduler bedt om).
  const wantCount = modules.length;
  const ranOk = [
    want("brreg") ? brreg : undefined,
    want("website") ? website : undefined,
    want("competitors") ? compAndThreat.competitors : undefined,
    want("threat") ? compAndThreat.threat : undefined,
    want("merch") ? merch : undefined,
    want("swot") ? swot : undefined,
    want("outreach") ? outreach : undefined,
  ].filter((v) => v !== undefined && v !== null).length;
  const confidence = wantCount > 0 ? ranOk / wantCount : 0;

  const report: FullLeadIntelligenceReport = {
    leadId,
    generatedAt: new Date().toISOString(),
    modules_run: modules,
    brreg,
    website,
    competitors: compAndThreat.competitors,
    merch_fit: merch,
    threat_assessment: compAndThreat.threat,
    swot,
    outreach,
    errors,
    overall_confidence: confidence,
  };

  // Cache i crm_customers.enrichment_data.full_intelligence + timestamp.
  try {
    await pool.query(
      `UPDATE crm_customers
          SET enrichment_data = COALESCE(enrichment_data, '{}'::jsonb)
                              || jsonb_build_object(
                                   'full_intelligence', $1::jsonb,
                                   'full_intelligence_at', NOW()::text
                                 )
        WHERE id=$2::uuid`,
      [JSON.stringify(report), leadId],
    );
  } catch (err) {
    console.warn("[agent-bridge] cache write feilet:", err);
  }

  return report;
}
