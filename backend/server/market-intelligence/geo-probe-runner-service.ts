/**
 * geo-probe-runner-service.ts
 *
 * GEO Visibility MVP punkt 2–3 (docs/integration-audit/08): kjører et
 * godkjent prompt-sett mot de konfigurerte AI-motorene, ekstraherer
 * merkevare-omtale DETERMINISTISK (kjente merkevarer matches i teksten —
 * ingen LLM-gjetting i selve målingen), lagrer per-svar-resultater og
 * aggregerer til normalized_signals.
 *
 * Ærlighet:
 *  - Kjøres KUN mot prompt-sett med status='approved'.
 *  - Motorer uten credentials rapporteres som hoppet over (run.engines
 *    viser hva som faktisk kjørte; status 'partial' ved frafall).
 *  - Alle signaler: isEstimated=true + metadata.synthetic=true.
 *  - Aggregering til normalized_signals krever ekte organization_id
 *    (FK) — solo-brukere får rapporten fra probe-tabellene, uten
 *    signal-aggregat (rapportert i resultatet, ikke stille).
 */

import type { Pool } from "pg";
import { getGeoProbeEngines, type GeoEngineId } from "./geo-probe-engines.js";
import { getPromptSet, type GeoPrompt, type GeoPromptSet } from "./geo-prompt-set-service.js";
import { insertNormalizedSignals } from "../integrations/normalized-signal-store.js";
import type { NormalizedSignal } from "../integrations/normalized-signal-schema.js";

// ─────────────────────────────────────────────────────────────────────
// Deterministisk ekstraksjon (rene funksjoner — enhetstestet)
// ─────────────────────────────────────────────────────────────────────

export interface BrandMention {
  name: string;
  /** 1-basert rekkefølge blant nevnte merkevarer i svaret. */
  rank: number;
}

/**
 * Finn hvilke av de KJENTE merkevarene som nevnes i svaret, rangert
 * etter første forekomst. Ord-grense-aktig match (unngår at "Leadgrid"
 * matcher inne i et annet ord), case-insensitiv.
 */
export function extractBrandMentions(
  answer: string,
  brands: string[],
): BrandMention[] {
  const lower = answer.toLowerCase();
  const hits: Array<{ name: string; index: number }> = [];
  for (const brand of brands) {
    const needle = brand.trim().toLowerCase();
    if (needle.length < 2) continue;
    let idx = -1;
    let from = 0;
    while ((idx = lower.indexOf(needle, from)) !== -1) {
      const before = idx === 0 ? " " : lower[idx - 1];
      const afterPos = idx + needle.length;
      const after = afterPos >= lower.length ? " " : lower[afterPos];
      if (!/[a-z0-9æøå]/.test(before) && !/[a-z0-9æøå]/.test(after)) {
        hits.push({ name: brand.trim(), index: idx });
        break; // første forekomst holder
      }
      from = idx + 1;
    }
  }
  hits.sort((a, b) => a.index - b.index);
  return hits.map((h, i) => ({ name: h.name, rank: i + 1 }));
}

export function extractUrls(answer: string): string[] {
  const matches = answer.match(/https?:\/\/[^\s)\]}>"',]+/g) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[.:;]+$/, "")))].slice(0, 20);
}

/** Er noen av URL-ene på målmerkevarens domene? */
export function citesDomain(urls: string[], domain: string | null): boolean {
  if (!domain) return false;
  const clean = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!clean) return false;
  return urls.some((u) => {
    try {
      const host = new URL(u).hostname.toLowerCase().replace(/^www\./, "");
      return host === clean || host.endsWith(`.${clean}`);
    } catch {
      return false;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────
// Aggregering → NormalizedSignals (ren funksjon — enhetstestet)
// ─────────────────────────────────────────────────────────────────────

export interface ProbeResultForAggregation {
  promptTopic: string;
  engine: GeoEngineId;
  mentionedBrands: BrandMention[];
  targetCited: boolean;
}

export interface AggregationContext {
  organizationId: string;
  workspaceId: string;
  projectId?: string;
  runId: string;
  targetBrand: string;
  competitorBrands: string[];
  region: string;
  periodStart: string;
  periodEnd: string;
  collectedAt: string;
}

export function aggregateToSignals(
  results: ProbeResultForAggregation[],
  ctx: AggregationContext,
): NormalizedSignal[] {
  const signals: NormalizedSignal[] = [];
  if (results.length === 0) return signals;

  const allBrands = [ctx.targetBrand, ...ctx.competitorBrands];
  const engines = [...new Set(results.map((r) => r.engine))];

  const base = (engine: GeoEngineId, brand: string, metricType: string) =>
    `geo-probe-${engine}|${brand}|${metricType}`;

  const common = {
    organizationId: ctx.organizationId,
    workspaceId: ctx.workspaceId,
    projectId: ctx.projectId,
    sourceType: "official_api" as const,
    geography: { country: "NO" as const },
    periodStart: ctx.periodStart,
    periodEnd: ctx.periodEnd,
    confidence: 0.7, // syntetisk probe ≠ reelle brukere
    sourceQuality: 0.7,
    freshnessScore: 1,
    isEstimated: true,
    isNormalized: true,
    collectedAt: ctx.collectedAt,
  };

  for (const engine of engines) {
    const engineResults = results.filter((r) => r.engine === engine);
    const answers = engineResults.length;
    const totalMentions = engineResults.reduce((s, r) => s + r.mentionedBrands.length, 0);

    for (const brand of allBrands) {
      const isTarget = brand === ctx.targetBrand;
      const mentions = engineResults.filter((r) =>
        r.mentionedBrands.some((m) => m.name === brand),
      );
      const ranks = engineResults
        .flatMap((r) => r.mentionedBrands.filter((m) => m.name === brand))
        .map((m) => m.rank);

      const subjectType = isTarget ? ("own_property" as const) : ("competitor" as const);
      const sourceRecordId = base(engine, brand, "ai_mention");
      signals.push({
        ...common,
        id: `${sourceRecordId}|${ctx.runId}`,
        provider: `geo-probe-${engine}`,
        sourceRecordId,
        subjectType,
        subjectId: brand,
        topic: `${ctx.region}:${engine}`,
        metricType: "ai_mention",
        metricValue: mentions.length,
        unit: "count",
        metadata: { synthetic: true, runId: ctx.runId, answers },
      });

      const shareId = base(engine, brand, "ai_mention_share");
      signals.push({
        ...common,
        id: `${shareId}|${ctx.runId}`,
        provider: `geo-probe-${engine}`,
        sourceRecordId: shareId,
        subjectType,
        subjectId: brand,
        topic: `${ctx.region}:${engine}`,
        metricType: "ai_mention_share",
        metricValue: totalMentions > 0 ? (ranks.length / totalMentions) * 100 : 0,
        unit: "percent",
        metadata: { synthetic: true, runId: ctx.runId, answers },
      });

      if (ranks.length > 0) {
        const rankId = base(engine, brand, "ai_recommendation_rank");
        signals.push({
          ...common,
          id: `${rankId}|${ctx.runId}`,
          provider: `geo-probe-${engine}`,
          sourceRecordId: rankId,
          subjectType,
          subjectId: brand,
          topic: `${ctx.region}:${engine}`,
          metricType: "ai_recommendation_rank",
          metricValue: ranks.reduce((a, b) => a + b, 0) / ranks.length,
          unit: "score",
          metadata: { synthetic: true, runId: ctx.runId },
        });
      }
    }

    // Siteringer av målmerkevarens domene
    const citations = engineResults.filter((r) => r.targetCited).length;
    const citeId = base(engine, ctx.targetBrand, "ai_citation");
    signals.push({
      ...common,
      id: `${citeId}|${ctx.runId}`,
      provider: `geo-probe-${engine}`,
      sourceRecordId: citeId,
      subjectType: "own_property",
      subjectId: ctx.targetBrand,
      topic: `${ctx.region}:${engine}`,
      metricType: "ai_citation",
      metricValue: citations,
      unit: "count",
      metadata: { synthetic: true, runId: ctx.runId, answers },
    });
  }

  return signals;
}

// ─────────────────────────────────────────────────────────────────────
// Kjøring
// ─────────────────────────────────────────────────────────────────────

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RunProbeResult {
  runId: string;
  status: "completed" | "partial" | "failed";
  enginesRun: GeoEngineId[];
  enginesSkipped: GeoEngineId[];
  answers: number;
  signalsInserted: number;
  /** Satt når signal-aggregering ble hoppet over (ingen ekte org-id). */
  signalsSkippedReason?: string;
}

export async function runProbe(
  pool: Pool,
  setId: string,
  workspaceOwnerUserId: string,
): Promise<RunProbeResult> {
  const loaded = await getPromptSet(pool, setId, workspaceOwnerUserId);
  if (!loaded) throw new Error("prompt_set_not_found");
  const { promptSet, prompts } = loaded;
  if (promptSet.status !== "approved") throw new Error("prompt_set_not_approved");

  const enabledPrompts = prompts.filter((p) => p.enabled);
  if (enabledPrompts.length === 0) throw new Error("no_enabled_prompts");

  const engines = getGeoProbeEngines();
  const configured = engines.filter((e) => e.isConfigured());
  const skipped = engines.filter((e) => !e.isConfigured()).map((e) => e.engineId);
  if (configured.length === 0) throw new Error("no_engines_configured");

  const runRow = await pool.query<{ id: string; started_at: string }>(
    `INSERT INTO geo_probe_runs (prompt_set_id, engines, prompts_total)
     VALUES ($1::uuid, $2::jsonb, $3)
     RETURNING id::text, started_at::text`,
    [setId, JSON.stringify(configured.map((e) => e.engineId)), enabledPrompts.length],
  );
  const runId = runRow.rows[0].id;

  const allBrands = [promptSet.targetBrand, ...promptSet.competitorBrands];
  const forAggregation: ProbeResultForAggregation[] = [];
  let answers = 0;
  let failures = 0;

  try {
    for (const prompt of enabledPrompts) {
      for (const engine of configured) {
        const answer = await engine.ask(prompt.text);
        if (answer === null) {
          failures++;
          continue;
        }
        answers++;
        const mentioned = extractBrandMentions(answer, allBrands);
        const urls = extractUrls(answer);
        const targetMention = mentioned.find((m) => m.name === promptSet.targetBrand);
        const targetCited = citesDomain(urls, promptSet.targetDomain);

        await pool.query(
          `INSERT INTO geo_probe_results (
             run_id, prompt_id, engine, mentioned_brands, cited_urls,
             target_mentioned, target_rank, answer_excerpt
           ) VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5::jsonb, $6, $7, $8)
           ON CONFLICT (run_id, prompt_id, engine) DO NOTHING`,
          [
            runId, prompt.id, engine.engineId,
            JSON.stringify(mentioned), JSON.stringify(urls),
            Boolean(targetMention), targetMention?.rank ?? null,
            answer.slice(0, 500),
          ],
        );
        forAggregation.push({
          promptTopic: prompt.topic,
          engine: engine.engineId,
          mentionedBrands: mentioned,
          targetCited,
        });
      }
    }

    // Aggreger til normalized_signals — krever ekte org-UUID (FK)
    let signalsInserted = 0;
    let signalsSkippedReason: string | undefined;
    const completedAt = new Date().toISOString();
    if (promptSet.organizationId && UUID_PATTERN.test(promptSet.organizationId)) {
      const signals = aggregateToSignals(forAggregation, {
        organizationId: promptSet.organizationId,
        workspaceId: workspaceOwnerUserId,
        projectId: promptSet.projectId ?? undefined,
        runId,
        targetBrand: promptSet.targetBrand,
        competitorBrands: promptSet.competitorBrands,
        region: promptSet.region,
        periodStart: new Date(runRow.rows[0].started_at).toISOString(),
        periodEnd: completedAt,
        collectedAt: completedAt,
      });
      const r = await insertNormalizedSignals(pool, signals);
      signalsInserted = r.inserted;
    } else {
      signalsSkippedReason = "prompt-settet mangler organization_id — rapporten leses fra probe-tabellene";
    }

    const status = failures > 0 || skipped.length > 0 ? "partial" : "completed";
    await pool.query(
      `UPDATE geo_probe_runs
          SET status = $2, answers_total = $3, completed_at = now()
        WHERE id = $1::uuid`,
      [runId, status, answers],
    );

    return {
      runId,
      status,
      enginesRun: configured.map((e) => e.engineId),
      enginesSkipped: skipped,
      answers,
      signalsInserted,
      signalsSkippedReason,
    };
  } catch (err) {
    await pool.query(
      `UPDATE geo_probe_runs
          SET status = 'failed', error_message = $2, completed_at = now()
        WHERE id = $1::uuid`,
      [runId, String(err).slice(0, 500)],
    );
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Rapport (leses av MI-panelet — fungerer også uten org/signal-aggregat)
// ─────────────────────────────────────────────────────────────────────

export interface GeoVisibilityReport {
  promptSet: Pick<GeoPromptSet, "id" | "name" | "targetBrand" | "competitorBrands" | "region" | "status">;
  latestRun: {
    runId: string;
    startedAt: string;
    completedAt: string | null;
    status: string;
    engines: GeoEngineId[];
    answers: number;
  } | null;
  /** Share-of-voice per merkevare (på tvers av motorer, siste kjøring). */
  brandShare: Array<{ brand: string; isTarget: boolean; mentions: number; sharePercent: number }>;
  /** Temaer der målmerkevaren IKKE ble nevnt i noen svar. */
  missingTopics: Array<{ topic: string; prompts: number; exampleEngine: GeoEngineId | null }>;
  /** Per motor: andel svar der target ble nevnt. */
  engineBreakdown: Array<{ engine: GeoEngineId; answers: number; targetMentioned: number }>;
  /** Trend: target share-of-voice per kjøring (eldste → nyeste). */
  trend: Array<{ runId: string; startedAt: string; targetSharePercent: number }>;
}

export async function computeReport(
  pool: Pool,
  setId: string,
  workspaceOwnerUserId: string,
): Promise<GeoVisibilityReport | null> {
  const loaded = await getPromptSet(pool, setId, workspaceOwnerUserId);
  if (!loaded) return null;
  const { promptSet, prompts } = loaded;
  const topicByPromptId = new Map(prompts.map((p) => [p.id, p.topic]));

  const runs = await pool.query<{
    id: string;
    started_at: string;
    completed_at: string | null;
    status: string;
    engines: GeoEngineId[];
    answers_total: number;
  }>(
    `SELECT id::text, started_at::text, completed_at::text, status, engines, answers_total
       FROM geo_probe_runs
      WHERE prompt_set_id = $1::uuid AND status IN ('completed','partial')
      ORDER BY started_at ASC`,
    [setId],
  );
  if (runs.rows.length === 0) {
    return {
      promptSet: {
        id: promptSet.id, name: promptSet.name, targetBrand: promptSet.targetBrand,
        competitorBrands: promptSet.competitorBrands, region: promptSet.region,
        status: promptSet.status,
      },
      latestRun: null, brandShare: [], missingTopics: [], engineBreakdown: [], trend: [],
    };
  }

  const latest = runs.rows[runs.rows.length - 1];
  const results = await pool.query<{
    prompt_id: string;
    engine: GeoEngineId;
    mentioned_brands: BrandMention[];
    target_mentioned: boolean;
  }>(
    `SELECT prompt_id::text, engine, mentioned_brands, target_mentioned
       FROM geo_probe_results WHERE run_id = $1::uuid`,
    [latest.id],
  );

  const allBrands = [promptSet.targetBrand, ...promptSet.competitorBrands];
  const totalMentions = results.rows.reduce(
    (s, r) => s + (Array.isArray(r.mentioned_brands) ? r.mentioned_brands.length : 0), 0,
  );
  const brandShare = allBrands.map((brand) => {
    const mentions = results.rows.filter((r) =>
      (r.mentioned_brands ?? []).some((m) => m.name === brand),
    ).length;
    return {
      brand,
      isTarget: brand === promptSet.targetBrand,
      mentions,
      sharePercent: totalMentions > 0 ? Math.round((mentions / totalMentions) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.mentions - a.mentions);

  // Temaer uten target-omtale
  const topicStats = new Map<string, { prompts: Set<string>; targetHit: boolean; engine: GeoEngineId | null }>();
  for (const r of results.rows) {
    const topic = topicByPromptId.get(r.prompt_id) ?? "ukjent";
    const t = topicStats.get(topic) ?? { prompts: new Set(), targetHit: false, engine: null };
    t.prompts.add(r.prompt_id);
    if (r.target_mentioned) t.targetHit = true;
    else t.engine = t.engine ?? r.engine;
    topicStats.set(topic, t);
  }
  const missingTopics = [...topicStats.entries()]
    .filter(([, t]) => !t.targetHit)
    .map(([topic, t]) => ({ topic, prompts: t.prompts.size, exampleEngine: t.engine }));

  const engineBreakdown = [...new Set(results.rows.map((r) => r.engine))].map((engine) => ({
    engine,
    answers: results.rows.filter((r) => r.engine === engine).length,
    targetMentioned: results.rows.filter((r) => r.engine === engine && r.target_mentioned).length,
  }));

  // Trend over kjøringer
  const trend: GeoVisibilityReport["trend"] = [];
  for (const run of runs.rows) {
    const r = await pool.query<{ total: string; target: string }>(
      `SELECT
         COALESCE(SUM(jsonb_array_length(mentioned_brands)), 0)::text AS total,
         COUNT(*) FILTER (WHERE target_mentioned)::text AS target
       FROM geo_probe_results WHERE run_id = $1::uuid`,
      [run.id],
    );
    const total = Number(r.rows[0]?.total ?? 0);
    const target = Number(r.rows[0]?.target ?? 0);
    trend.push({
      runId: run.id,
      startedAt: run.started_at,
      targetSharePercent: total > 0 ? Math.round((target / total) * 1000) / 10 : 0,
    });
  }

  return {
    promptSet: {
      id: promptSet.id, name: promptSet.name, targetBrand: promptSet.targetBrand,
      competitorBrands: promptSet.competitorBrands, region: promptSet.region,
      status: promptSet.status,
    },
    latestRun: {
      runId: latest.id, startedAt: latest.started_at, completedAt: latest.completed_at,
      status: latest.status, engines: latest.engines, answers: latest.answers_total,
    },
    brandShare,
    missingTopics,
    engineBreakdown,
    trend,
  };
}
