/**
 * leadgrid-forecasting-service.ts
 *
 * Pakke 3B — Forecasting + Attribution.
 *
 * - getOrComputeForecast: pipeline-revenue-prediksjon (p10/p50/p90) m/ 6t cache.
 *   Statistical baseline + valgfri Claude-refinement m/ reasoning + faktorer.
 * - computeAttribution: per-NBA-action_type win-rate, avg-deal-value og
 *   avg-days-to-won. Cacher i leadgrid_attribution_aggregates.
 *
 * Migrasjon: backend/migrations/323_leadgrid_forecasting_cache.sql
 *   (leadgrid_forecast_cache + leadgrid_attribution_aggregates + permissions).
 */

import type { Pool } from "pg";
import { withAIQuota } from "./leadgrid-ai-queue.js";

const CACHE_TTL_HOURS = 6;

export interface PipelineForecast {
  organizationId: string;
  horizonDays: number;
  predictedRevenueLow: number;
  predictedRevenueMid: number;
  predictedRevenueHigh: number;
  predictedWonDeals: number;
  predictedAvgCycleDays: number;
  confidence: number;
  reasoning: string;
  contributingFactors: Array<{ factor: string; weight: number; direction: "positive" | "negative" }>;
  activePipelineValue: number;
  activeDeals: number;
  computedAt: string;
}

export interface AttributionResult {
  organizationId: string;
  windowDays: number;
  actions: Array<{
    actionType: string;
    totalExecuted: number;
    totalWon: number;
    winRate: number;
    avgDaysToWon: number;
    avgDealValue: number;
    impactScore: number; // win_rate * avg_deal_value
  }>;
  topActionTypes: string[];
  computedAt: string;
}

/**
 * Hent forecast for org. Cache 6 timer; refresh ved cache-miss.
 */
export async function getOrComputeForecast(
  pool: Pool,
  organizationId: string,
  horizonDays = 90,
): Promise<PipelineForecast> {
  const cached = await pool.query(
    `SELECT * FROM leadgrid_forecast_cache
      WHERE organization_id = $1::uuid AND horizon_days = $2
        AND computed_at > NOW() - ($3 || ' hours')::interval
      ORDER BY computed_at DESC LIMIT 1`,
    [organizationId, horizonDays, String(CACHE_TTL_HOURS)],
  );
  if (cached.rowCount && cached.rows[0]) {
    const r = cached.rows[0];
    return {
      organizationId: r.organization_id,
      horizonDays: r.horizon_days,
      predictedRevenueLow: Number(r.predicted_revenue_low),
      predictedRevenueMid: Number(r.predicted_revenue_mid),
      predictedRevenueHigh: Number(r.predicted_revenue_high),
      predictedWonDeals: r.predicted_won_deals,
      predictedAvgCycleDays: Number(r.predicted_avg_cycle_days),
      confidence: Number(r.confidence_score),
      reasoning: r.reasoning,
      contributingFactors: r.contributing_factors ?? [],
      activePipelineValue: Number(r.active_pipeline_value),
      activeDeals: r.active_deals,
      computedAt: r.computed_at,
    };
  }
  return computeAndCacheForecast(pool, organizationId, horizonDays);
}

async function computeAndCacheForecast(
  pool: Pool,
  organizationId: string,
  horizonDays: number,
): Promise<PipelineForecast> {
  // Baseline-stats
  const stats = await pool.query(
    `WITH active AS (
       SELECT COUNT(*)::int AS cnt, COALESCE(SUM(expected_value), 0)::float8 AS total
         FROM crm_customers
        WHERE organization_id = $1::uuid
          AND archived_at IS NULL
          AND pipeline_stage IN ('first_contact','qualified','meeting','proposal','negotiation')
     ),
     wins AS (
       SELECT COUNT(*)::int AS cnt,
              COALESCE(SUM(estimated_value), 0)::float8 AS total,
              COALESCE(AVG(EXTRACT(EPOCH FROM (last_contacted_at - created_at)) / 86400), 30)::float8 AS avg_days
         FROM crm_customers
        WHERE organization_id = $1::uuid
          AND pipeline_stage = 'won'
          AND last_contacted_at > NOW() - ($2 || ' days')::interval
     ),
     totals AS (
       SELECT COUNT(*)::int AS total
         FROM crm_customers
        WHERE organization_id = $1::uuid
          AND created_at > NOW() - ($3 || ' days')::interval
     )
     SELECT active.cnt AS active_deals,
            active.total AS active_pipeline_value,
            wins.cnt AS historic_won,
            wins.total AS historic_revenue,
            wins.avg_days AS avg_cycle_days,
            totals.total AS total_leads
       FROM active, wins, totals`,
    [organizationId, String(horizonDays), String(horizonDays * 2)],
  );
  const s = stats.rows[0];
  const activeDeals = Number(s.active_deals);
  const activePipelineValue = Number(s.active_pipeline_value);
  const historicWon = Number(s.historic_won);
  const avgCycleDays = Number(s.avg_cycle_days);
  const totalLeads = Math.max(1, Number(s.total_leads));

  const baseWinRate = historicWon / totalLeads;
  const expectedWonFromPipeline = Math.round(activeDeals * baseWinRate);
  const predictedMid = activePipelineValue * baseWinRate;
  const predictedLow = predictedMid * 0.6;
  const predictedHigh = predictedMid * 1.4;

  // Statistical defaults
  let reasoning = `Basert på ${historicWon} vunnede deals siste ${horizonDays} dager (${(baseWinRate * 100).toFixed(1)}% win-rate).`;
  let confidence = 0.6;
  let contributingFactors: Array<{ factor: string; weight: number; direction: "positive" | "negative" }> = [
    { factor: "Aktiv pipeline-verdi", weight: 0.4, direction: activePipelineValue > 0 ? "positive" : "negative" },
    { factor: "Historisk win-rate", weight: 0.3, direction: baseWinRate > 0.1 ? "positive" : "negative" },
    { factor: "Sykluslengde", weight: 0.2, direction: avgCycleDays < 60 ? "positive" : "negative" },
    { factor: "Antall aktive deals", weight: 0.1, direction: activeDeals > 5 ? "positive" : "negative" },
  ];
  const claudeOverride: Partial<PipelineForecast> = {};

  // Claude refinement (graceful fallback hvis nøkkel mangler)
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const prompt = `Du er en B2B-sales-analytiker. Vurder pipelinens revenue-prediksjon for neste ${horizonDays} dager.

Data:
- Aktive deals: ${activeDeals}
- Aktiv pipeline-verdi: ${activePipelineValue.toFixed(0)} NOK
- Vunnede deals siste ${horizonDays}d: ${historicWon}
- Win-rate: ${(baseWinRate * 100).toFixed(1)}%
- Sykluslengde: ${avgCycleDays.toFixed(0)} dager

Min naive prediksjon: p50=${predictedMid.toFixed(0)}, p10=${predictedLow.toFixed(0)}, p90=${predictedHigh.toFixed(0)}.

Returner KUN gyldig JSON:
{
  "predicted_revenue_low": <p10 NOK>,
  "predicted_revenue_mid": <p50 NOK>,
  "predicted_revenue_high": <p90 NOK>,
  "confidence": <0.0-1.0>,
  "reasoning": "<2-3 setninger på norsk>",
  "contributing_factors": [{"factor": "...", "weight": 0.1-0.5, "direction": "positive|negative"}]
}`;
      const msg = await withAIQuota("claude", organizationId, () =>
        client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      );
      const text = msg.content
        .filter((c: { type: string }) => c.type === "text")
        .map((c: { type: string; text?: string }) => c.text ?? "")
        .join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (typeof parsed.predicted_revenue_mid === "number") claudeOverride.predictedRevenueMid = parsed.predicted_revenue_mid;
        if (typeof parsed.predicted_revenue_low === "number") claudeOverride.predictedRevenueLow = parsed.predicted_revenue_low;
        if (typeof parsed.predicted_revenue_high === "number") claudeOverride.predictedRevenueHigh = parsed.predicted_revenue_high;
        if (typeof parsed.confidence === "number") confidence = Math.max(0, Math.min(1, parsed.confidence));
        if (typeof parsed.reasoning === "string") reasoning = parsed.reasoning;
        if (Array.isArray(parsed.contributing_factors)) contributingFactors = parsed.contributing_factors;
      }
    } catch (err) {
      console.warn("[forecasting] Claude feilet, bruker fallback:", err);
    }
  }

  const result: PipelineForecast = {
    organizationId,
    horizonDays,
    predictedRevenueLow: claudeOverride.predictedRevenueLow ?? predictedLow,
    predictedRevenueMid: claudeOverride.predictedRevenueMid ?? predictedMid,
    predictedRevenueHigh: claudeOverride.predictedRevenueHigh ?? predictedHigh,
    predictedWonDeals: expectedWonFromPipeline,
    predictedAvgCycleDays: avgCycleDays,
    confidence,
    reasoning,
    contributingFactors,
    activePipelineValue,
    activeDeals,
    computedAt: new Date().toISOString(),
  };

  // Cache via UPSERT
  await pool.query(
    `INSERT INTO leadgrid_forecast_cache
       (organization_id, horizon_days, predicted_revenue_low, predicted_revenue_mid,
        predicted_revenue_high, predicted_won_deals, predicted_avg_cycle_days,
        confidence_score, reasoning, contributing_factors,
        active_pipeline_value, active_deals)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
     ON CONFLICT (organization_id, horizon_days) DO UPDATE SET
       predicted_revenue_low = EXCLUDED.predicted_revenue_low,
       predicted_revenue_mid = EXCLUDED.predicted_revenue_mid,
       predicted_revenue_high = EXCLUDED.predicted_revenue_high,
       predicted_won_deals = EXCLUDED.predicted_won_deals,
       predicted_avg_cycle_days = EXCLUDED.predicted_avg_cycle_days,
       confidence_score = EXCLUDED.confidence_score,
       reasoning = EXCLUDED.reasoning,
       contributing_factors = EXCLUDED.contributing_factors,
       active_pipeline_value = EXCLUDED.active_pipeline_value,
       active_deals = EXCLUDED.active_deals,
       computed_at = NOW()`,
    [
      organizationId, horizonDays,
      result.predictedRevenueLow, result.predictedRevenueMid, result.predictedRevenueHigh,
      result.predictedWonDeals, result.predictedAvgCycleDays,
      result.confidence, result.reasoning,
      JSON.stringify(result.contributingFactors),
      result.activePipelineValue, result.activeDeals,
    ],
  );

  return result;
}

export async function computeAttribution(
  pool: Pool,
  organizationId: string,
  windowDays = 90,
): Promise<AttributionResult> {
  const r = await pool.query(
    `WITH executed AS (
       SELECT r.action_type, r.lead_id,
              c.pipeline_stage, c.estimated_value::float8 AS estimated_value,
              EXTRACT(EPOCH FROM (c.last_contacted_at - r.executed_at)) / 86400 AS days_to_outcome
         FROM lead_recommendations r
         JOIN crm_customers c ON c.id = r.lead_id
        WHERE r.organization_id = $1::uuid
          AND r.status = 'executed'
          AND r.executed_at > NOW() - ($2 || ' days')::interval
     )
     SELECT action_type,
            COUNT(*)::int AS total_executed,
            COUNT(*) FILTER (WHERE pipeline_stage = 'won')::int AS total_won,
            COUNT(*) FILTER (WHERE pipeline_stage = 'lost')::int AS total_lost,
            COALESCE(AVG(days_to_outcome) FILTER (WHERE pipeline_stage = 'won'), 0)::float8 AS avg_days_to_won,
            COALESCE(AVG(estimated_value) FILTER (WHERE pipeline_stage = 'won'), 0)::float8 AS avg_deal_value
       FROM executed
       GROUP BY action_type
       ORDER BY total_executed DESC`,
    [organizationId, String(windowDays)],
  );
  const actions = r.rows.map((row) => {
    const exec = Number(row.total_executed);
    const won = Number(row.total_won);
    const winRate = exec > 0 ? won / exec : 0;
    const avgValue = Number(row.avg_deal_value);
    return {
      actionType: row.action_type as string,
      totalExecuted: exec,
      totalWon: won,
      winRate,
      avgDaysToWon: Number(row.avg_days_to_won),
      avgDealValue: avgValue,
      impactScore: winRate * avgValue,
    };
  });
  const topActionTypes = [...actions]
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 3)
    .map((a) => a.actionType);

  // Cache via UPSERT
  for (const a of actions) {
    await pool
      .query(
        `INSERT INTO leadgrid_attribution_aggregates
         (organization_id, action_type, window_days, total_executed,
          total_won, total_lost, win_rate, avg_days_to_won, avg_deal_value)
       VALUES ($1::uuid, $2, $3, $4, $5, 0, $6, $7, $8)
       ON CONFLICT (organization_id, action_type, window_days) DO UPDATE SET
         total_executed = EXCLUDED.total_executed,
         total_won = EXCLUDED.total_won,
         win_rate = EXCLUDED.win_rate,
         avg_days_to_won = EXCLUDED.avg_days_to_won,
         avg_deal_value = EXCLUDED.avg_deal_value,
         computed_at = NOW()`,
        [organizationId, a.actionType, windowDays, a.totalExecuted, a.totalWon, a.winRate, a.avgDaysToWon, a.avgDealValue],
      )
      .catch((err) => console.warn("[attribution cache] feilet:", err));
  }

  return { organizationId, windowDays, actions, topActionTypes, computedAt: new Date().toISOString() };
}
