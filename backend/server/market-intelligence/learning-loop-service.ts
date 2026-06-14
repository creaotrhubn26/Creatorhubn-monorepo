/**
 * learning-loop-service.ts
 *
 * Læringsløkken som binder analytics tilbake til opportunities.
 *
 * Pipeline (kjøres som cron):
 *   1. Finn workflows i status 'published' eller 'analytics_collecting'
 *   2. Aggregér performance fra marketing_post_drafts som er linket
 *      (via campaign_draft_id og content_pack_draft_ids)
 *   3. Beregn performance_score basert på engagement-rate + konverteringer
 *   4. Oppdater marketing_workflow_analytics-tabellen
 *   5. Oppdater opportunity sin learned_performance_tier
 *   6. Hvis vi har en "top performer", la Claude oppsummere hva som virket
 *      (insight_summary, what_worked, recommendation_adjustment)
 *   7. Transition workflow → 'analytics_completed' eller
 *      'recommendations_updated'
 *
 * Filosofi:
 *   - Kun aggregér på publiserte poster (ikke utkast)
 *   - Konservative tier-cutoffs — krever minst 100 impressions for å skåre
 *   - Aldri overstyr Claude-anbefalt confidence basert på 1 datapunkt
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Pool } from "pg";

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

export interface WorkflowAnalyticsResult {
  workflowId: string;
  opportunityId: string | null;
  marketScanId: string | null;
  totalDraftsPublished: number;
  totalImpressions: number;
  totalEngagements: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenueNok: number;
  performanceScore: number;
  performanceTier: "unrated" | "low" | "medium" | "high" | "top";
  insightSummary: string | null;
  whatWorked: string | null;
  whatDidntWork: string | null;
  recommendationAdjustment: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// Aggregate fra marketing_post_drafts
// ─────────────────────────────────────────────────────────────────────

interface DraftPerformance {
  draftId: number;
  status: string;
  published_at: string | null;
  latest_engagement: Record<string, unknown> | null;
}

async function fetchDraftPerformance(
  pool: Pool,
  draftIds: number[],
): Promise<DraftPerformance[]> {
  if (draftIds.length === 0) return [];
  const r = await pool.query(
    `SELECT id::int as "draftId", status, published_at::text, latest_engagement
       FROM marketing_post_drafts
      WHERE id = ANY($1::bigint[])`,
    [draftIds],
  );
  return r.rows;
}

function aggregateEngagement(drafts: DraftPerformance[]): {
  drafts_published: number;
  impressions: number;
  engagements: number;
  clicks: number;
  conversions: number;
  revenue_nok: number;
} {
  let drafts_published = 0;
  let impressions = 0;
  let engagements = 0;
  let clicks = 0;
  let conversions = 0;
  let revenue_nok = 0;

  for (const d of drafts) {
    if (d.status !== "published") continue;
    drafts_published += 1;
    const eng = (d.latest_engagement ?? {}) as Record<string, unknown>;
    impressions += Number(eng.impressions ?? eng.reach ?? 0);
    engagements += Number(eng.engagements ?? eng.reactions ?? 0);
    clicks += Number(eng.clicks ?? eng.link_clicks ?? 0);
    conversions += Number(eng.conversions ?? 0);
    revenue_nok += Number(eng.revenue_nok ?? 0);
  }

  return { drafts_published, impressions, engagements, clicks, conversions, revenue_nok };
}

// ─────────────────────────────────────────────────────────────────────
// Performance-score
// ─────────────────────────────────────────────────────────────────────

function computePerformanceScore(args: {
  impressions: number;
  engagements: number;
  clicks: number;
  conversions: number;
}): { score: number; tier: "unrated" | "low" | "medium" | "high" | "top" } {
  if (args.impressions < 100) {
    return { score: 0, tier: "unrated" };
  }

  // Engagement rate (vektet høyest)
  const engagementRate = args.engagements / args.impressions;
  const clickRate = args.clicks / args.impressions;
  const convRate = args.conversions / Math.max(args.clicks, 1);

  // 0–100 scale
  const score =
    Math.min(engagementRate * 1000, 50) +     // 5% engagement = 50p
    Math.min(clickRate * 500, 30) +           // 6% CTR = 30p
    Math.min(convRate * 100, 20);             // 20% conv = 20p

  let tier: "unrated" | "low" | "medium" | "high" | "top";
  if (score >= 80) tier = "top";
  else if (score >= 60) tier = "high";
  else if (score >= 40) tier = "medium";
  else tier = "low";

  return { score: Number(score.toFixed(2)), tier };
}

// ─────────────────────────────────────────────────────────────────────
// Claude insight-generator (kun for top performers)
// ─────────────────────────────────────────────────────────────────────

const INSIGHT_SYSTEM_PROMPT = `Du analyserer en publisert markedsføringskampanje og forklarer hva som
virket og ikke virket. Hold språket norsk, bestemor-vennlig. Maks 3 setninger per felt.

OUTPUT (gyldig JSON):
{
  "insightSummary": "Kort oppsummering på 1–2 setninger",
  "whatWorked": "Hva som faktisk fungerte (basert på tallene)",
  "whatDidntWork": "Hva som ikke fungerte eller var svakt",
  "recommendationAdjustment": "Hvordan vi bør justere lignende anbefalinger fremover"
}`;

interface InsightContext {
  opportunityTitle?: string;
  opportunitySummary?: string;
  performanceScore: number;
  performanceTier: string;
  impressions: number;
  engagements: number;
  clicks: number;
  conversions: number;
}

async function generateInsight(
  ctx: InsightContext,
): Promise<{
  insightSummary: string;
  whatWorked: string;
  whatDidntWork: string;
  recommendationAdjustment: string;
}> {
  const client = getAnthropic();
  const userPrompt = `Anbefaling: ${ctx.opportunityTitle ?? "(ukjent)"}\nSummary: ${ctx.opportunitySummary ?? "(ingen)"}\n\nPerformance:\n  Score: ${ctx.performanceScore}/100 (tier: ${ctx.performanceTier})\n  Impressions: ${ctx.impressions}\n  Engagements: ${ctx.engagements}\n  Clicks: ${ctx.clicks}\n  Conversions: ${ctx.conversions}\n\nReturner JSON.`;

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 800,
    system: INSIGHT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1] : text;
  try {
    return JSON.parse(raw.trim());
  } catch {
    return {
      insightSummary: "Ingen analyse tilgjengelig.",
      whatWorked: "—",
      whatDidntWork: "—",
      recommendationAdjustment: "—",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Public: prosesser én workflow
// ─────────────────────────────────────────────────────────────────────

export async function processWorkflowAnalytics(
  pool: Pool,
  workflowId: string,
): Promise<WorkflowAnalyticsResult | null> {
  // 1. Hent workflow + draft-IDer
  const wfR = await pool.query(
    `SELECT id::text, opportunity_id::text, market_scan_id::text, brand_kit_id::text,
            campaign_draft_id, content_pack_draft_ids
       FROM marketing_workflows
      WHERE id = $1::uuid`,
    [workflowId],
  );
  if (wfR.rows.length === 0) return null;
  const wf = wfR.rows[0];

  const allDraftIds: number[] = [];
  if (wf.campaign_draft_id) allDraftIds.push(Number(wf.campaign_draft_id));
  allDraftIds.push(...(wf.content_pack_draft_ids ?? []));

  if (allDraftIds.length === 0) return null;

  // 2. Hent draft-performance
  const drafts = await fetchDraftPerformance(pool, allDraftIds);
  const agg = aggregateEngagement(drafts);
  const { score, tier } = computePerformanceScore({
    impressions: agg.impressions,
    engagements: agg.engagements,
    clicks: agg.clicks,
    conversions: agg.conversions,
  });

  // 3. Generate insight via Claude — kun hvis vi har data og er top/high
  let insightSummary: string | null = null;
  let whatWorked: string | null = null;
  let whatDidntWork: string | null = null;
  let recommendationAdjustment: string | null = null;

  if (tier !== "unrated" && agg.impressions >= 100 && wf.opportunity_id) {
    try {
      const oppR = await pool.query(
        `SELECT title, simple_summary FROM market_scan_opportunities WHERE id=$1::uuid`,
        [wf.opportunity_id],
      );
      const oppTitle = oppR.rows[0]?.title;
      const oppSummary = oppR.rows[0]?.simple_summary;

      const insight = await generateInsight({
        opportunityTitle: oppTitle,
        opportunitySummary: oppSummary,
        performanceScore: score,
        performanceTier: tier,
        impressions: agg.impressions,
        engagements: agg.engagements,
        clicks: agg.clicks,
        conversions: agg.conversions,
      });
      insightSummary = insight.insightSummary;
      whatWorked = insight.whatWorked;
      whatDidntWork = insight.whatDidntWork;
      recommendationAdjustment = insight.recommendationAdjustment;
    } catch (err) {
      console.warn(`[learning-loop] Claude insight failed for workflow ${workflowId}:`, err);
    }
  }

  // 4. Upsert i marketing_workflow_analytics
  await pool.query(
    `INSERT INTO marketing_workflow_analytics (
       workflow_id, opportunity_id, market_scan_id, brand_kit_id,
       total_drafts_published, total_impressions, total_engagements,
       total_clicks, total_conversions, total_revenue_nok,
       performance_score, performance_tier,
       insight_summary, what_worked, what_didnt_work, recommendation_adjustment,
       next_compute_at
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4::uuid,
       $5, $6, $7, $8, $9, $10,
       $11, $12,
       $13, $14, $15, $16,
       NOW() + INTERVAL '24 hours'
     )
     ON CONFLICT DO NOTHING`,
    [
      workflowId,
      wf.opportunity_id,
      wf.market_scan_id,
      wf.brand_kit_id,
      agg.drafts_published,
      agg.impressions,
      agg.engagements,
      agg.clicks,
      agg.conversions,
      agg.revenue_nok,
      score,
      tier,
      insightSummary,
      whatWorked,
      whatDidntWork,
      recommendationAdjustment,
    ],
  );

  // 5. Oppdater opportunity sin lærte tier (læringsløkke)
  if (wf.opportunity_id && tier !== "unrated") {
    await pool.query(
      `UPDATE market_scan_opportunities
          SET learned_performance_tier = $2,
              times_acted_on = times_acted_on + 1,
              last_action_at = NOW()
        WHERE id = $1::uuid`,
      [wf.opportunity_id, tier],
    );
  }

  // 6. Transition workflow
  const nextStatus = tier === "unrated" ? "analytics_collecting" : "analytics_completed";
  await pool.query(
    `UPDATE marketing_workflows
        SET current_status = $2,
            next_recommended_action = $3,
            updated_at = NOW()
      WHERE id = $1::uuid`,
    [
      workflowId,
      nextStatus,
      tier === "top" || tier === "high"
        ? "Bygg variant av denne anbefalingen for å multiplisere effekten"
        : tier === "low"
          ? "Sjekk om vi bør justere copy eller målgruppe før neste forsøk"
          : "Samler fortsatt data — sjekk på nytt om 24 timer",
    ],
  );

  return {
    workflowId,
    opportunityId: wf.opportunity_id,
    marketScanId: wf.market_scan_id,
    totalDraftsPublished: agg.drafts_published,
    totalImpressions: agg.impressions,
    totalEngagements: agg.engagements,
    totalClicks: agg.clicks,
    totalConversions: agg.conversions,
    totalRevenueNok: agg.revenue_nok,
    performanceScore: score,
    performanceTier: tier,
    insightSummary,
    whatWorked,
    whatDidntWork,
    recommendationAdjustment,
  };
}

/** Cron-entry: prosesser alle workflows som trenger ny compute */
export async function processAllDueWorkflows(pool: Pool): Promise<number> {
  const r = await pool.query<{ id: string }>(
    `SELECT mw.id::text
       FROM marketing_workflows mw
       LEFT JOIN marketing_workflow_analytics mwa
         ON mwa.workflow_id = mw.id
        AND mwa.next_compute_at > NOW()
      WHERE mw.current_status IN ('published', 'analytics_collecting', 'analytics_completed')
        AND mwa.id IS NULL
      LIMIT 50`,
  );
  let processed = 0;
  for (const row of r.rows) {
    try {
      const result = await processWorkflowAnalytics(pool, row.id);
      if (result) processed += 1;
    } catch (err) {
      console.warn(`[learning-loop] failed for workflow ${row.id}:`, err);
    }
  }
  return processed;
}
