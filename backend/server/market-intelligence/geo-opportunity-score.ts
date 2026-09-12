/**
 * geo-opportunity-score.ts — GEO Opportunity Score (fase 3, doc 11)
 *
 * Beregner faktorverdiene per (prompt-sett, tema) fra dataene som
 * allerede samles: geo-probe-resultater (tomrom/åpenhet/momentum),
 * normalized_signals (etterspørsel/trafikk-bevis) og org-konfigurasjonen
 * (kommersiell verdi). Ren beregning — ingen LLM.
 *
 * Manglende data gir null-faktor med begrunnelse; computeScore
 * omfordeler vektene og rapporterer dekning. Se score-model.ts.
 */

import type { Pool } from "pg";
import {
  computeScore,
  defaultGeoOpportunityConfig,
  GEO_OPPORTUNITY_FACTORS,
  GEO_OPPORTUNITY_MODEL_KEY,
  geoOpportunityConfigSchema,
  normalizeMomentum,
  normalizeVolume,
  topicsOverlap,
  type ComputedScore,
  type FactorValue,
  type GeoOpportunityConfig,
} from "../integrations/score-model.js";

export interface OpportunityEntry {
  promptSetId: string;
  setName: string;
  targetBrand: string;
  topic: string;
  answers: number;
  score: ComputedScore["score"];
  coverage: number;
  factors: FactorValue[];
  contributions: ComputedScore["contributions"];
}

export interface OpportunityScoreResult {
  modelKey: string;
  /** true = org-en kjører fortsatt på forslags-vektene. */
  isDraft: boolean;
  config: GeoOpportunityConfig;
  factorDefinitions: typeof GEO_OPPORTUNITY_FACTORS;
  entries: OpportunityEntry[];
  promptSets: Array<{ id: string; name: string }>;
}

interface TopicAggregate {
  promptSetId: string;
  setName: string;
  targetBrand: string;
  topic: string;
  answers: number;
  targetMentions: number;
  /** Omtaler per kjent merke (fra mentioned_brands, ekskl. target). */
  competitorMentions: Map<string, number>;
  totalMentions: number;
  runId: string;
}

async function loadConfig(pool: Pool, organizationId: string): Promise<{
  config: GeoOpportunityConfig;
  approved: boolean;
}> {
  const r = await pool.query<{ config: unknown; approved: boolean }>(
    `SELECT config, approved FROM score_model_config
      WHERE organization_id = $1::uuid AND model_key = $2`,
    [organizationId, GEO_OPPORTUNITY_MODEL_KEY],
  );
  if (r.rows.length > 0) {
    const parsed = geoOpportunityConfigSchema.safeParse(r.rows[0].config);
    if (parsed.success) return { config: parsed.data, approved: r.rows[0].approved };
    console.warn("[opportunity-score] lagret config validerer ikke — bruker forslag");
  }
  return { config: defaultGeoOpportunityConfig(), approved: false };
}

/** Tema-aggregat for en gitt kjøring (nyeste eller nest nyeste). */
async function loadTopicAggregates(
  pool: Pool,
  organizationId: string,
  runRank: 1 | 2,
): Promise<TopicAggregate[]> {
  const r = await pool.query<{
    prompt_set_id: string;
    set_name: string;
    target_brand: string;
    run_id: string;
    topic: string;
    answers: number;
    target_mentions: number;
    mentioned: Array<Array<{ name: string; rank: number }>> | null;
  }>(
    `WITH ranked_runs AS (
       SELECT ps.id AS prompt_set_id, ps.name AS set_name, ps.target_brand,
              r.id AS run_id,
              ROW_NUMBER() OVER (PARTITION BY ps.id ORDER BY r.started_at DESC) AS rn
         FROM geo_prompt_sets ps
         JOIN geo_probe_runs r ON r.prompt_set_id = ps.id
          AND r.status IN ('completed','partial')
        WHERE ps.organization_id = $1::uuid AND ps.status = 'approved'
     )
     SELECT rr.prompt_set_id::text, rr.set_name, rr.target_brand,
            rr.run_id::text, p.topic,
            COUNT(*)::int AS answers,
            COUNT(*) FILTER (WHERE res.target_mentioned)::int AS target_mentions,
            jsonb_agg(res.mentioned_brands) AS mentioned
       FROM ranked_runs rr
       JOIN geo_probe_results res ON res.run_id = rr.run_id
       JOIN geo_prompts p ON p.id = res.prompt_id
      WHERE rr.rn = $2
      GROUP BY rr.prompt_set_id, rr.set_name, rr.target_brand, rr.run_id, p.topic`,
    [organizationId, runRank],
  );

  return r.rows.map((row) => {
    const competitorMentions = new Map<string, number>();
    let totalMentions = 0;
    for (const answer of row.mentioned ?? []) {
      for (const m of answer ?? []) {
        totalMentions += 1;
        if (m.name.toLowerCase() === row.target_brand.toLowerCase()) continue;
        competitorMentions.set(m.name, (competitorMentions.get(m.name) ?? 0) + 1);
      }
    }
    return {
      promptSetId: row.prompt_set_id,
      setName: row.set_name,
      targetBrand: row.target_brand,
      topic: row.topic,
      answers: Number(row.answers),
      targetMentions: Number(row.target_mentions),
      competitorMentions,
      totalMentions,
      runId: row.run_id,
    };
  });
}

interface SignalRow {
  topic: string;
  metric_type: string;
  metric_value: number;
  id: string;
}

async function loadLinkableSignals(pool: Pool, organizationId: string): Promise<SignalRow[]> {
  const r = await pool.query<SignalRow>(
    `SELECT DISTINCT ON (metric_type, topic) topic, metric_type, metric_value, id::text
       FROM normalized_signals
      WHERE organization_id = $1::uuid
        AND metric_type IN ('search_volume_avg','search_trend','ai_referral_sessions','owned_impressions')
      ORDER BY metric_type, topic, collected_at DESC`,
    [organizationId],
  );
  return r.rows.map((row) => ({ ...row, metric_value: Number(row.metric_value) }));
}

function buildFactors(
  agg: TopicAggregate,
  prev: TopicAggregate | undefined,
  signals: SignalRow[],
  config: GeoOpportunityConfig,
): FactorValue[] {
  const factors: FactorValue[] = [];

  // Tomrom: andel svar uten target
  factors.push({
    key: "gap",
    value: agg.answers > 0 ? (agg.answers - agg.targetMentions) / agg.answers : null,
    missingReason: agg.answers > 0 ? undefined : "ingen svar i siste måling",
    evidence: [
      { ref: agg.runId, label: "svar i temaet", value: agg.answers },
      { ref: agg.runId, label: `${agg.targetBrand} nevnt`, value: agg.targetMentions },
    ],
  });

  // Åpenhet: 1 − sterkeste konkurrents svar-andel
  if (agg.answers > 0) {
    let topBrand = "";
    let topCount = 0;
    for (const [name, count] of agg.competitorMentions) {
      if (count > topCount) {
        topBrand = name;
        topCount = count;
      }
    }
    factors.push({
      key: "openness",
      value: 1 - Math.min(1, topCount / agg.answers),
      evidence: topBrand
        ? [{ ref: agg.runId, label: `sterkeste konkurrent: ${topBrand}`, value: topCount }]
        : [{ ref: agg.runId, label: "ingen konkurrent nevnt i temaet", value: 0 }],
    });
  } else {
    factors.push({ key: "openness", value: null, missingReason: "ingen svar i siste måling", evidence: [] });
  }

  // Etterspørsel: søkevolum-signaler koblet via ord-overlapp
  const demandSignals = signals.filter(
    (s) =>
      (s.metric_type === "search_volume_avg" || s.metric_type === "search_trend") &&
      topicsOverlap(agg.topic, s.topic),
  );
  if (demandSignals.length > 0) {
    const best = demandSignals.reduce((a, b) => (b.metric_value > a.metric_value ? b : a));
    factors.push({
      key: "demand",
      value:
        best.metric_type === "search_volume_avg"
          ? normalizeVolume(best.metric_value)
          : Math.min(1, best.metric_value / 100), // relative_index 0–100
      evidence: [{ ref: best.id, label: `${best.metric_type}: ${best.topic}`, value: best.metric_value }],
    });
  } else {
    factors.push({
      key: "demand",
      value: null,
      missingReason: "ingen søkevolum-signal deler ord med temaet (Keyword Planner/Trends-import)",
      evidence: [],
    });
  }

  // Momentum: endring i samtale-volum mellom to siste målinger
  if (prev && prev.totalMentions + agg.totalMentions > 0) {
    const pct =
      prev.totalMentions === 0
        ? 100
        : ((agg.totalMentions - prev.totalMentions) / prev.totalMentions) * 100;
    factors.push({
      key: "momentum",
      value: normalizeMomentum(pct),
      evidence: [
        { ref: agg.runId, label: "omtaler nå", value: agg.totalMentions },
        { ref: prev.runId, label: "omtaler forrige måling", value: prev.totalMentions },
      ],
    });
  } else {
    factors.push({
      key: "momentum",
      value: null,
      missingReason: "trenger to målinger — fylles av neste ukeskjøring",
      evidence: [],
    });
  }

  // Trafikk-bevis: ekte GA4/GSC-signaler på lignende temaer
  const trafficSignals = signals.filter(
    (s) =>
      (s.metric_type === "ai_referral_sessions" || s.metric_type === "owned_impressions") &&
      topicsOverlap(agg.topic, s.topic),
  );
  if (trafficSignals.length > 0) {
    const best = trafficSignals.reduce((a, b) => (b.metric_value > a.metric_value ? b : a));
    factors.push({
      key: "traffic_proof",
      value: normalizeVolume(best.metric_value),
      evidence: [{ ref: best.id, label: `${best.metric_type}: ${best.topic}`, value: best.metric_value }],
    });
  } else {
    factors.push({
      key: "traffic_proof",
      value: null,
      missingReason: "ingen GA4/GSC-signal deler ord med temaet ennå",
      evidence: [],
    });
  }

  // Kommersiell verdi: settes av Daniel per prompt-sett
  const cv = config.commercialValues[agg.promptSetId];
  factors.push({
    key: "commercial_value",
    value: cv !== undefined ? cv / 10 : null,
    missingReason:
      cv !== undefined ? undefined : "ikke satt — åpne innstillingene og verdsett settet (1–10)",
    evidence: cv !== undefined ? [{ ref: `config|${agg.promptSetId}`, label: "din verdsetting", value: cv }] : [],
  });

  return factors;
}

export async function computeGeoOpportunityScores(
  pool: Pool,
  organizationId: string,
): Promise<OpportunityScoreResult> {
  const [{ config, approved }, current, previous, signals] = await Promise.all([
    loadConfig(pool, organizationId),
    loadTopicAggregates(pool, organizationId, 1),
    loadTopicAggregates(pool, organizationId, 2),
    loadLinkableSignals(pool, organizationId),
  ]);

  const prevByKey = new Map(previous.map((p) => [`${p.promptSetId}|${p.topic}`, p]));

  const entries: OpportunityEntry[] = current.map((agg) => {
    const factors = buildFactors(agg, prevByKey.get(`${agg.promptSetId}|${agg.topic}`), signals, config);
    const computed = computeScore(factors, config.weights);
    return {
      promptSetId: agg.promptSetId,
      setName: agg.setName,
      targetBrand: agg.targetBrand,
      topic: agg.topic,
      answers: agg.answers,
      score: computed.score,
      coverage: computed.coverage,
      factors,
      contributions: computed.contributions,
    };
  });

  entries.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const promptSets = [...new Map(current.map((c) => [c.promptSetId, c.setName])).entries()].map(
    ([id, name]) => ({ id, name }),
  );

  return {
    modelKey: GEO_OPPORTUNITY_MODEL_KEY,
    isDraft: !approved,
    config,
    factorDefinitions: GEO_OPPORTUNITY_FACTORS,
    entries,
    promptSets,
  };
}
