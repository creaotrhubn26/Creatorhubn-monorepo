/**
 * market-scan-service.ts
 *
 * Hovedorkestratoren for Market Intelligence-fase 2.
 *
 * Workflow:
 *   1. Opprett market_scans-rad (status: 'draft')
 *   2. Discover competitors via Claude
 *   3. For hver competitor:
 *      a. Hent nettsted-HTML
 *      b. Kjør analyzeWebsite (BrandProfile)
 *      c. Detect funnel-stadier (deterministisk pattern-match)
 *      d. Detect teknikker (deterministisk pattern-match)
 *      e. Detect tech-stack (Wappalyzer-light)
 *      f. Analyze content signals via Claude
 *   4. Generate opportunity recommendations via Claude (aggregert)
 *   5. Lagre alt + mark scan completed
 *
 * Service-en kan brukes både fra HTTP-route og fra cron/job. Den er
 * idempotent på id-nivå men ikke på (project, query) — to scans med samme
 * query lager to separate rader.
 */

import type { Pool } from "pg";
import { analyzeWebsite } from "../role-room-website-analyzer.js";
import {
  getBrandKit,
  toBaseline,
  type BrandKitBaseline,
} from "../brand-kit-service.js";
import {
  discoverCompetitors,
  type CompetitorCandidate,
} from "./competitor-discovery-service.js";
import { detectFunnelStages } from "./funnel-detection-service.js";
import { detectTechniques } from "./technique-detection-service.js";
import { detectTechStack } from "./tech-stack-detection-service.js";
import { analyzeContentSignals } from "./content-signal-service.js";
import { generateOpportunityRecommendations } from "./opportunity-recommendation-service.js";
import type {
  Competitor,
  ConfidenceLevel,
  ContentSignalBatch,
  FunnelStage,
  MarketScan,
  MarketingTechnique,
  OpportunityRecommendation,
  TechStackSignal,
} from "./types.js";

// ─────────────────────────────────────────────────────────────────────
// HTML fetcher (gjenbruker konvensjon fra website-analyzer)
// ─────────────────────────────────────────────────────────────────────

async function fetchHtml(rawUrl: string): Promise<{ html: string; finalUrl: string } | null> {
  const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 TheRoleRoom-MarketIntel/1.0",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!r.ok) return null;
    const text = await r.text();
    return { html: text, finalUrl: r.url };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// CRUD helpers
// ─────────────────────────────────────────────────────────────────────

interface MarketScanRow {
  id: string;
  workspace_owner_user_id: string;
  project_id: string | null;
  brand_kit_id: string | null;
  name: string;
  market_query: string;
  region: string | null;
  industry: string | null;
  target_audience: string | null;
  goal: string | null;
  status: MarketScan["status"];
  confidence_summary: ConfidenceLevel;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  total_competitors: number;
  total_opportunities: number;
  created_at: string;
  updated_at: string;
}

function rowToScan(r: MarketScanRow): MarketScan {
  return {
    id: r.id,
    workspaceOwnerUserId: r.workspace_owner_user_id,
    projectId: r.project_id ?? undefined,
    brandKitId: r.brand_kit_id,
    name: r.name,
    marketQuery: r.market_query,
    region: r.region,
    industry: r.industry,
    targetAudience: r.target_audience,
    goal: r.goal,
    status: r.status,
    confidenceSummary: r.confidence_summary,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    errorMessage: r.error_message,
    totalCompetitors: r.total_competitors,
    totalOpportunities: r.total_opportunities,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export interface CreateScanInput {
  workspaceOwnerUserId: string;
  projectId?: string | null;
  brandKitId?: string | null;
  name: string;
  marketQuery: string;
  region?: string | null;
  industry?: string | null;
  targetAudience?: string | null;
  goal?: string | null;
}

export async function createMarketScan(
  pool: Pool,
  input: CreateScanInput,
): Promise<MarketScan> {
  const r = await pool.query<MarketScanRow>(
    `INSERT INTO market_scans (
       workspace_owner_user_id, project_id, brand_kit_id,
       name, market_query, region, industry, target_audience, goal,
       status, confidence_summary
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', 'low')
     RETURNING *,
       id::text, brand_kit_id::text, created_at::text, updated_at::text,
       started_at::text, completed_at::text`,
    [
      input.workspaceOwnerUserId,
      input.projectId ?? null,
      input.brandKitId ?? null,
      input.name,
      input.marketQuery,
      input.region ?? null,
      input.industry ?? null,
      input.targetAudience ?? null,
      input.goal ?? null,
    ],
  );
  return rowToScan(r.rows[0]);
}

export async function listMarketScans(
  pool: Pool,
  args: { workspaceOwnerUserId: string; projectId?: string; limit?: number },
): Promise<MarketScan[]> {
  const conditions = ["workspace_owner_user_id = $1"];
  const params: unknown[] = [args.workspaceOwnerUserId];
  if (args.projectId) {
    params.push(args.projectId);
    conditions.push(`project_id = $${params.length}`);
  }
  const r = await pool.query<MarketScanRow>(
    `SELECT *,
       id::text, brand_kit_id::text, created_at::text, updated_at::text,
       started_at::text, completed_at::text
     FROM market_scans
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1}`,
    [...params, args.limit ?? 50],
  );
  return r.rows.map(rowToScan);
}

export async function getMarketScan(
  pool: Pool,
  scanId: string,
): Promise<MarketScan | null> {
  const r = await pool.query<MarketScanRow>(
    `SELECT *,
       id::text, brand_kit_id::text, created_at::text, updated_at::text,
       started_at::text, completed_at::text
     FROM market_scans
     WHERE id = $1::uuid`,
    [scanId],
  );
  if (r.rows.length === 0) return null;
  return rowToScan(r.rows[0]);
}

// ─────────────────────────────────────────────────────────────────────
// Run scan (full pipeline)
// ─────────────────────────────────────────────────────────────────────

export interface RunScanResult {
  scan: MarketScan;
  competitors: Competitor[];
  funnelStages: FunnelStage[];
  techniques: MarketingTechnique[];
  techStack: TechStackSignal[];
  contentSignals: ContentSignalBatch[];
  opportunities: OpportunityRecommendation[];
}

export async function runMarketScan(
  pool: Pool,
  scanId: string,
): Promise<RunScanResult> {
  const scan = await getMarketScan(pool, scanId);
  if (!scan) throw new Error("market_scan_not_found");
  if (scan.status === "running") {
    throw new Error("market_scan_already_running");
  }

  // Mark running
  await pool.query(
    `UPDATE market_scans SET status='running', started_at=NOW(), error_message=NULL WHERE id=$1::uuid`,
    [scanId],
  );

  try {
    // 1. Brand baseline (om vi har Brand Kit linket)
    let baseline: BrandKitBaseline | null = null;
    if (scan.projectId) {
      const kit = await getBrandKit(pool, scan.projectId);
      if (kit) baseline = toBaseline(kit);
    }

    // 2. Discover competitors
    const candidates = await discoverCompetitors({
      marketQuery: scan.marketQuery,
      industry: scan.industry,
      region: scan.region,
      targetAudience: scan.targetAudience,
      goal: scan.goal,
      excludeDomains: baseline ? [baseline.brandName.toLowerCase()] : undefined,
      maxResults: 6,
    });

    // 3. Per competitor: fetch + detect
    const competitors: Competitor[] = [];
    const funnelStages: FunnelStage[] = [];
    const techniques: MarketingTechnique[] = [];
    const techStack: TechStackSignal[] = [];
    const contentSignals: ContentSignalBatch[] = [];

    for (const cand of candidates) {
      const fetched = await fetchHtml(cand.domain);
      if (!fetched) {
        // Lagrer competitor likevel, med low confidence
        const compRow = await insertCompetitor(pool, scanId, cand, [`https://${cand.domain}`]);
        competitors.push(compRow);
        continue;
      }

      const compRow = await insertCompetitor(pool, scanId, cand, [fetched.finalUrl]);
      competitors.push(compRow);

      // Pattern-detection (deterministisk — rask)
      const funnel = detectFunnelStages(fetched.html);
      for (const f of funnel) {
        const inserted = await insertFunnelStage(pool, scanId, compRow.id, f);
        funnelStages.push(inserted);
      }

      const techs = detectTechniques(fetched.html);
      for (const t of techs) {
        const inserted = await insertTechnique(pool, scanId, compRow.id, t);
        techniques.push(inserted);
      }

      const stack = detectTechStack(fetched.html);
      for (const s of stack) {
        const inserted = await insertTechStack(pool, scanId, compRow.id, s);
        techStack.push(inserted);
      }

      // Claude content signal (sakte — kjør parallelt med rest hvis mulig)
      try {
        const signals = await analyzeContentSignals(cand.name, fetched.html);
        const inserted = await insertContentSignals(pool, scanId, compRow.id, signals);
        contentSignals.push(inserted);
      } catch (err) {
        console.warn(`[market-scan] content signals failed for ${cand.domain}:`, err);
      }
    }

    // 4. Opportunity recommendations
    let opportunities: OpportunityRecommendation[] = [];
    try {
      const recs = await generateOpportunityRecommendations({
        marketQuery: scan.marketQuery,
        brandBaseline: baseline,
        competitors,
        funnelStages,
        techniques,
        techStack,
        contentSignals,
        maxRecommendations: 6,
      });
      for (const rec of recs) {
        const inserted = await insertOpportunity(pool, scanId, rec);
        opportunities.push(inserted);
      }
    } catch (err) {
      console.warn(`[market-scan] opportunity generation failed:`, err);
    }

    // 5. Confidence summary — basert på antall high-confidence funn
    const highConfidenceCount =
      competitors.filter((c) => c.confidence === "high").length +
      opportunities.filter((o) => o.confidence === "high").length;
    let confidenceSummary: ConfidenceLevel = "low";
    if (highConfidenceCount >= 5) confidenceSummary = "high";
    else if (highConfidenceCount >= 2) confidenceSummary = "medium";

    // 6. Mark completed
    const finalScan = await pool.query<MarketScanRow>(
      `UPDATE market_scans
          SET status='completed',
              completed_at=NOW(),
              total_competitors=$2,
              total_opportunities=$3,
              confidence_summary=$4
        WHERE id=$1::uuid
        RETURNING *,
          id::text, brand_kit_id::text, created_at::text, updated_at::text,
          started_at::text, completed_at::text`,
      [scanId, competitors.length, opportunities.length, confidenceSummary],
    );

    // 7. Beriker konkurrentene med Google Places-data (lat/lng/rating)
    //    så de havner direkte på Lead Map sammen med leads.
    //    Best-effort — feiler aldri runMarketScan-resultatet.
    void (async () => {
      try {
        const { enrichCompetitorsWithPlaces } = await import(
          "../competitor-place-enrichment.js"
        );
        const result = await enrichCompetitorsWithPlaces(pool, {
          scanId,
          ownerUserId: scan.workspaceOwnerUserId,
          region: scan.region,
        });
        if (result.enriched > 0) {
          console.log(
            `[market-scan] Berikket ${result.enriched} konkurrenter m/ Places ` +
              `(skipped ${result.skipped}, failed ${result.failed})`,
          );
        }
      } catch (err) {
        console.warn("[market-scan] auto-Places-berikkelse feilet:", (err as Error).message);
      }
    })();

    return {
      scan: rowToScan(finalScan.rows[0]),
      competitors,
      funnelStages,
      techniques,
      techStack,
      contentSignals,
      opportunities,
    };
  } catch (err) {
    await pool.query(
      `UPDATE market_scans SET status='failed', error_message=$2 WHERE id=$1::uuid`,
      [scanId, String(err)],
    );
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Read helpers — for routes som bare leser scan-deler
// ─────────────────────────────────────────────────────────────────────

export async function getScanCompetitors(pool: Pool, scanId: string): Promise<Competitor[]> {
  const r = await pool.query(
    `SELECT id::text, market_scan_id::text, name, domain, category, positioning,
            primary_offer, primary_cta, pricing_signal, social_proof_signal,
            confidence, source_urls, last_scanned_at::text
       FROM market_scan_competitors
      WHERE market_scan_id=$1::uuid
      ORDER BY confidence DESC, name`,
    [scanId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    marketScanId: row.market_scan_id,
    name: row.name,
    domain: row.domain,
    category: row.category,
    positioning: row.positioning,
    primaryOffer: row.primary_offer,
    primaryCTA: row.primary_cta,
    pricingSignal: row.pricing_signal,
    socialProofSignal: row.social_proof_signal,
    confidence: row.confidence,
    sourceUrls: row.source_urls,
    lastScannedAt: row.last_scanned_at,
  }));
}

export async function getScanFunnelStages(pool: Pool, scanId: string): Promise<FunnelStage[]> {
  const r = await pool.query(
    `SELECT id::text, market_scan_id::text, competitor_id::text, stage, detected,
            explanation, evidence, confidence, recommended_action
       FROM market_scan_funnel_stages
      WHERE market_scan_id=$1::uuid
      ORDER BY stage, confidence DESC`,
    [scanId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    marketScanId: row.market_scan_id,
    competitorId: row.competitor_id,
    stage: row.stage,
    detected: row.detected,
    explanation: row.explanation,
    evidence: row.evidence,
    confidence: row.confidence,
    recommendedAction: row.recommended_action,
  }));
}

export async function getScanTechniques(pool: Pool, scanId: string): Promise<MarketingTechnique[]> {
  const r = await pool.query(
    `SELECT id::text, market_scan_id::text, competitor_id::text, technique,
            label, simple_explanation, detected, confidence, evidence,
            why_it_matters, recommended_next_step
       FROM market_scan_techniques
      WHERE market_scan_id=$1::uuid
      ORDER BY detected DESC, confidence DESC, technique`,
    [scanId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    marketScanId: row.market_scan_id,
    competitorId: row.competitor_id,
    technique: row.technique,
    label: row.label,
    simpleExplanation: row.simple_explanation,
    detected: row.detected,
    confidence: row.confidence,
    evidence: row.evidence,
    whyItMatters: row.why_it_matters,
    recommendedNextStep: row.recommended_next_step,
  }));
}

export async function getScanTechStack(pool: Pool, scanId: string): Promise<TechStackSignal[]> {
  const r = await pool.query(
    `SELECT id::text, market_scan_id::text, competitor_id::text,
            category, tool_name, confidence, evidence
       FROM market_scan_tech_stack
      WHERE market_scan_id=$1::uuid
      ORDER BY category, confidence DESC, tool_name`,
    [scanId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    marketScanId: row.market_scan_id,
    competitorId: row.competitor_id,
    category: row.category,
    toolName: row.tool_name,
    confidence: row.confidence,
    evidence: row.evidence,
  }));
}

export async function getScanOpportunities(pool: Pool, scanId: string): Promise<OpportunityRecommendation[]> {
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
        CASE confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`,
    [scanId],
  );
  return r.rows.map((row) => ({
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

// ─────────────────────────────────────────────────────────────────────
// Insert helpers
// ─────────────────────────────────────────────────────────────────────

async function insertCompetitor(
  pool: Pool,
  scanId: string,
  cand: CompetitorCandidate,
  sourceUrls: string[],
): Promise<Competitor> {
  const r = await pool.query(
    `INSERT INTO market_scan_competitors (
       market_scan_id, name, domain, category, positioning,
       primary_offer, primary_cta, pricing_signal, social_proof_signal,
       confidence, source_urls, last_scanned_at
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
     RETURNING id::text, market_scan_id::text, name, domain, category, positioning,
               primary_offer, primary_cta, pricing_signal, social_proof_signal,
               confidence, source_urls, last_scanned_at::text`,
    [
      scanId,
      cand.name,
      cand.domain,
      cand.category ?? null,
      cand.positioning ?? null,
      cand.primaryOffer ?? null,
      null,
      null,
      null,
      cand.confidence,
      JSON.stringify(sourceUrls),
    ],
  );
  const row = r.rows[0];
  return {
    id: row.id,
    marketScanId: row.market_scan_id,
    name: row.name,
    domain: row.domain,
    category: row.category,
    positioning: row.positioning,
    primaryOffer: row.primary_offer,
    primaryCTA: row.primary_cta,
    pricingSignal: row.pricing_signal,
    socialProofSignal: row.social_proof_signal,
    confidence: row.confidence,
    sourceUrls: row.source_urls,
    lastScannedAt: row.last_scanned_at,
  };
}

async function insertFunnelStage(
  pool: Pool,
  scanId: string,
  competitorId: string,
  raw: ReturnType<typeof detectFunnelStages>[number],
): Promise<FunnelStage> {
  const r = await pool.query(
    `INSERT INTO market_scan_funnel_stages (
       market_scan_id, competitor_id, stage, detected, explanation, evidence,
       confidence, recommended_action
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8)
     RETURNING id::text, market_scan_id::text, competitor_id::text, stage,
               detected, explanation, evidence, confidence, recommended_action`,
    [
      scanId, competitorId, raw.stage, raw.detected, raw.explanation,
      raw.evidence, raw.confidence, raw.recommendedAction,
    ],
  );
  const row = r.rows[0];
  return {
    id: row.id,
    marketScanId: row.market_scan_id,
    competitorId: row.competitor_id,
    stage: row.stage,
    detected: row.detected,
    explanation: row.explanation,
    evidence: row.evidence,
    confidence: row.confidence,
    recommendedAction: row.recommended_action,
  };
}

async function insertTechnique(
  pool: Pool,
  scanId: string,
  competitorId: string,
  raw: ReturnType<typeof detectTechniques>[number],
): Promise<MarketingTechnique> {
  const r = await pool.query(
    `INSERT INTO market_scan_techniques (
       market_scan_id, competitor_id, technique, label, simple_explanation,
       detected, confidence, evidence, why_it_matters, recommended_next_step
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id::text, market_scan_id::text, competitor_id::text, technique,
               label, simple_explanation, detected, confidence, evidence,
               why_it_matters, recommended_next_step`,
    [
      scanId, competitorId, raw.technique, raw.label, raw.simpleExplanation,
      raw.detected, raw.confidence, raw.evidence, raw.whyItMatters,
      raw.recommendedNextStep,
    ],
  );
  const row = r.rows[0];
  return {
    id: row.id,
    marketScanId: row.market_scan_id,
    competitorId: row.competitor_id,
    technique: row.technique,
    label: row.label,
    simpleExplanation: row.simple_explanation,
    detected: row.detected,
    confidence: row.confidence,
    evidence: row.evidence,
    whyItMatters: row.why_it_matters,
    recommendedNextStep: row.recommended_next_step,
  };
}

async function insertTechStack(
  pool: Pool,
  scanId: string,
  competitorId: string,
  raw: ReturnType<typeof detectTechStack>[number],
): Promise<TechStackSignal> {
  const r = await pool.query(
    `INSERT INTO market_scan_tech_stack (
       market_scan_id, competitor_id, category, tool_name, confidence, evidence
     ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
     RETURNING id::text, market_scan_id::text, competitor_id::text,
               category, tool_name, confidence, evidence`,
    [scanId, competitorId, raw.category, raw.toolName, raw.confidence, raw.evidence],
  );
  const row = r.rows[0];
  return {
    id: row.id,
    marketScanId: row.market_scan_id,
    competitorId: row.competitor_id,
    category: row.category,
    toolName: row.tool_name,
    confidence: row.confidence,
    evidence: row.evidence,
  };
}

async function insertContentSignals(
  pool: Pool,
  scanId: string,
  competitorId: string,
  raw: Awaited<ReturnType<typeof analyzeContentSignals>>,
): Promise<ContentSignalBatch> {
  const r = await pool.query(
    `INSERT INTO market_scan_content_signals (
       market_scan_id, competitor_id, signals, summary, confidence
     ) VALUES ($1::uuid, $2::uuid, $3::jsonb, $4, $5)
     RETURNING id::text, market_scan_id::text, competitor_id::text,
               signals, summary, confidence`,
    [scanId, competitorId, JSON.stringify(raw.signals), raw.summary, raw.confidence],
  );
  const row = r.rows[0];
  return {
    id: row.id,
    marketScanId: row.market_scan_id,
    competitorId: row.competitor_id,
    signals: row.signals,
    summary: row.summary,
    confidence: row.confidence,
  };
}

async function insertOpportunity(
  pool: Pool,
  scanId: string,
  raw: Omit<OpportunityRecommendation, "id" | "marketScanId">,
): Promise<OpportunityRecommendation> {
  const r = await pool.query(
    `INSERT INTO market_scan_opportunities (
       market_scan_id, title, simple_summary, why_it_matters, evidence_summary,
       recommended_action, impact, difficulty, confidence,
       can_create_campaign, can_create_content_pack, can_create_funnel_map,
       source_competitor_ids, source_technique_ids
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb)
     RETURNING id::text, market_scan_id::text, title, simple_summary,
               why_it_matters, evidence_summary, recommended_action,
               impact, difficulty, confidence,
               can_create_campaign, can_create_content_pack, can_create_funnel_map,
               source_competitor_ids, source_technique_ids`,
    [
      scanId, raw.title, raw.simpleSummary, raw.whyItMatters, raw.evidenceSummary,
      raw.recommendedAction, raw.impact, raw.difficulty, raw.confidence,
      raw.canCreateCampaign, raw.canCreateContentPack, raw.canCreateFunnelMap,
      JSON.stringify(raw.sourceCompetitorIds ?? []),
      JSON.stringify(raw.sourceTechniqueIds ?? []),
    ],
  );
  const row = r.rows[0];
  return {
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
  };
}
