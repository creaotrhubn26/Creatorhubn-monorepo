/**
 * ai-coverage-best-take-agent.ts
 *
 * Fase B-agent som ranger takes for ett spesifikt shot, basert på
 * composite-scores fra analyse-pipelinen + Claude-vurdering for
 * kvalitativ tilbakemelding.
 *
 * Pipeline:
 *   (shotListId, shotIndex) → load takes + analyses → sort by score →
 *     Claude-judge for rationale → 'coverage.best-take'-suggestion
 *
 * Hybrid programmatic + Claude:
 *   - Programmatic ranger på composite score (objektivt og raskt)
 *   - Claude leser top-3 transcript + notes og skriver én begrunnelse
 *     ("Take 3 har best fokus og roligere tempo enn 1, 2 har tekniske
 *     issues på audio")
 *   - Claude-pass er valgfri — hvis API-key mangler eller feiler, gir
 *     vi suggestion uten rationale
 *
 * Når kjøres:
 *   - Manuell trigger: post-production-review
 *   - Auto-trigger: når siste take for et shot er analysed (TODO)
 */

import type {
  AIAgent,
  AIAgentInput,
  AIAgentOutput,
  AISuggestion,
  ApplyContext,
  SuggestionApplier,
} from "./ai-suggestion-service.js";
import { listTakesForShot, type CastingTake } from "./coverage-take-service.js";
import { listAnalysesForTakes, type TakeAnalysisRow } from "./coverage-analysis-pipeline.js";
import type { Pool } from "pg";

const SUGGESTION_TYPE_BEST_TAKE = "coverage.best-take";

interface BestTakeAgentInput {
  pool: Pool;
  sceneId: string;
  shotListId: string;
  shotIndex: number;
}

interface BestTakePayload {
  sceneId: string;
  shotListId: string;
  shotIndex: number;
  recommendedTakeId: string;
  recommendedTakeNumber: number;
  recommendedScore?: number;
  ranking: Array<{
    takeId: string;
    takeNumber: number;
    overallScore?: number;
    breakdown?: { audio?: number; visual?: number; performance?: number };
    notes?: string;
  }>;
  rationale?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Claude-rationale (valgfri, kvalitativ pass)
// ─────────────────────────────────────────────────────────────────────

const RATIONALE_TOOL_SCHEMA = {
  name: "explain_take_ranking",
  description:
    "Skriv 1-2 setninger som forklarer hvorfor det anbefalte taket er best, " +
    "med konkrete referanser til scores og hva som differensierer.",
  input_schema: {
    type: "object",
    properties: {
      rationale: { type: "string" },
    },
    required: ["rationale"],
  },
} as const;

interface ClaudeRationaleInput {
  recommendedTake: { takeNumber: number; score: number; breakdown: Record<string, number | undefined>; notes?: string };
  alternativeTakes: Array<{ takeNumber: number; score: number; breakdown: Record<string, number | undefined>; notes?: string }>;
}

async function generateRationale(input: ClaudeRationaleInput): Promise<string | undefined> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return undefined;

  try {
    const mod: any = await import("@anthropic-ai/sdk");
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    const claude: any = new AnthropicCtor({ apiKey, maxRetries: 1, timeout: 30_000 });

    const userPrompt = [
      "Anbefalt take:",
      `  Take ${input.recommendedTake.takeNumber}: composite ${input.recommendedTake.score.toFixed(2)}`,
      `  Breakdown: audio=${formatScore(input.recommendedTake.breakdown.audio)}, ` +
        `visual=${formatScore(input.recommendedTake.breakdown.visual)}, ` +
        `performance=${formatScore(input.recommendedTake.breakdown.performance)}`,
      input.recommendedTake.notes ? `  Notater: ${input.recommendedTake.notes}` : "",
      "",
      "Alternativer:",
      ...input.alternativeTakes.map((t) =>
        `  Take ${t.takeNumber}: composite ${t.score.toFixed(2)} — ` +
        `audio=${formatScore(t.breakdown.audio)}, ` +
        `visual=${formatScore(t.breakdown.visual)}, ` +
        `performance=${formatScore(t.breakdown.performance)}` +
        (t.notes ? ` — ${t.notes}` : "")
      ),
      "",
      "Kall explain_take_ranking. 1-2 setninger, konkret og kort.",
    ].filter(Boolean).join("\n");

    const response = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      tools: [RATIONALE_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "explain_take_ranking" },
      messages: [{ role: "user", content: userPrompt }],
    });

    const tb = (response.content ?? []).find(
      (b: any) => b?.type === "tool_use" && b?.name === "explain_take_ranking",
    );
    const input2 = (tb?.input ?? {}) as Record<string, unknown>;
    return typeof input2.rationale === "string" ? input2.rationale : undefined;
  } catch (err) {
    console.warn("[best-take-agent] rationale-generation feilet:", err);
    return undefined;
  }
}

function formatScore(v: number | undefined): string {
  return v != null ? v.toFixed(2) : "n/a";
}

// ─────────────────────────────────────────────────────────────────────
// Agent
// ─────────────────────────────────────────────────────────────────────

export const coverageBestTakeAgent: AIAgent = {
  name: "coverage-best-take-agent",
  modelVersion: "v1.0.0",

  async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
    if (input.sourceType !== "scene") return [];

    const agentInput = input.payload as BestTakeAgentInput | undefined;
    if (!agentInput?.pool || !agentInput?.shotListId || agentInput?.shotIndex === undefined) {
      return [];
    }

    const { pool } = agentInput;
    const takes = await listTakesForShot(pool, agentInput.shotListId, agentInput.shotIndex);
    if (takes.length === 0) return [];

    const analyzedTakes = takes.filter((t) => t.processingStatus === "analyzed");
    if (analyzedTakes.length === 0) {
      // Ingen analyserte takes — coverage-gap-agent flagger dette,
      // ikke vi.
      return [];
    }

    // Load analyses
    const analyses = await listAnalysesForTakes(
      pool,
      analyzedTakes.map((t) => t.id),
    );
    const analysisById = new Map(analyses.map((a) => [a.takeId, a]));

    // Bygg ranking — sortér på composite score, NULL sist
    const rankingItems = analyzedTakes
      .map((take) => {
        const a = analysisById.get(take.id);
        return {
          take,
          analysis: a,
          score: a?.overallScore ?? -1,  // sortér NULL etter alt annet
        };
      })
      .sort((a, b) => {
        // marked_circled trumfer score, så hvis brukeren har sagt
        // "denne er best", respekter det
        if (a.take.markedCircled !== b.take.markedCircled) {
          return a.take.markedCircled ? -1 : 1;
        }
        return b.score - a.score;
      });

    const recommended = rankingItems[0];
    if (!recommended.analysis && !recommended.take.markedCircled) {
      // Ingen analysis OG ikke circled — kan ikke anbefale med sikkerhet
      return [];
    }

    // Forbered Claude-rationale input (kun hvis vi har analyser)
    let rationale: string | undefined;
    const recommendedAnalysis = recommended.analysis;
    if (recommendedAnalysis?.overallScore != null) {
      const alternatives = rankingItems.slice(1, 4).filter((r) => r.analysis);
      rationale = await generateRationale({
        recommendedTake: {
          takeNumber: recommended.take.takeNumber,
          score: recommendedAnalysis.overallScore,
          breakdown: recommendedAnalysis.scoreBreakdown ?? {},
          notes: recommended.take.notes ?? undefined,
        },
        alternativeTakes: alternatives.map((alt) => ({
          takeNumber: alt.take.takeNumber,
          score: alt.analysis!.overallScore ?? 0,
          breakdown: alt.analysis!.scoreBreakdown ?? {},
          notes: alt.take.notes ?? undefined,
        })),
      });
    }

    const payload: BestTakePayload = {
      sceneId: agentInput.sceneId,
      shotListId: agentInput.shotListId,
      shotIndex: agentInput.shotIndex,
      recommendedTakeId: recommended.take.id,
      recommendedTakeNumber: recommended.take.takeNumber,
      recommendedScore: recommendedAnalysis?.overallScore ?? undefined,
      ranking: rankingItems.map((r) => ({
        takeId: r.take.id,
        takeNumber: r.take.takeNumber,
        overallScore: r.analysis?.overallScore ?? undefined,
        breakdown: r.analysis?.scoreBreakdown
          ? {
              audio: r.analysis.scoreBreakdown.audio,
              visual: r.analysis.scoreBreakdown.visual,
              performance: r.analysis.scoreBreakdown.performance,
            }
          : undefined,
        notes: r.take.notes ?? undefined,
      })),
      rationale,
    };

    // Confidence: høyere hvis det er klart vinner, lavere hvis det er
    // tett løp
    let confidence = 0.7;
    if (rankingItems.length === 1) confidence = 0.6;
    else if (rankingItems.length >= 2) {
      const top = rankingItems[0].score;
      const second = rankingItems[1].score;
      const gap = top - second;
      if (gap > 0.2) confidence = 0.95;
      else if (gap > 0.1) confidence = 0.85;
      else confidence = 0.7;
    }

    return [{
      suggestionType: SUGGESTION_TYPE_BEST_TAKE,
      payload,
      confidence,
      sourceType: "scene",
      sourceId: agentInput.sceneId,
    }];
  },
};

// ─────────────────────────────────────────────────────────────────────
// Applier — markerer det anbefalte taket som circled
// ─────────────────────────────────────────────────────────────────────
//
// Når brukeren aksepterer en best-take-anbefaling, setter vi
// marked_circled=true på det anbefalte taket (og false på de andre i
// shot-listen — bare ett kan være DPs "circled take").

export const coverageBestTakeApplier: SuggestionApplier<BestTakePayload> = {
  suggestionType: SUGGESTION_TYPE_BEST_TAKE,

  async apply(
    suggestion: AISuggestion<BestTakePayload>,
    ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    const { client } = ctx;
    const { payload } = suggestion;

    // Atomisk: clear circled på alle takes for denne shoten, deretter
    // sett på den anbefalte
    await client.query(
      `UPDATE casting_takes
       SET marked_circled = false, updated_at = NOW()
       WHERE shot_list_id = $1 AND shot_index = $2`,
      [payload.shotListId, payload.shotIndex],
    );
    await client.query(
      `UPDATE casting_takes
       SET marked_circled = true, updated_at = NOW()
       WHERE id = $1`,
      [payload.recommendedTakeId],
    );

    return {
      circledTakeId: payload.recommendedTakeId,
      takeNumber: payload.recommendedTakeNumber,
      score: payload.recommendedScore ?? null,
    };
  },
};
