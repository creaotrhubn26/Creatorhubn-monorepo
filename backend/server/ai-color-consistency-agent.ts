/**
 * ai-color-consistency-agent.ts
 *
 * Fase C post-prod-agent. Analyserer visual_analysis-resultater for takes
 * i samme scene og flagger eksponering/WB-/tonal-avvik som krever color-
 * grading-attention.
 *
 * Pipeline:
 *   scene_id → load analyzed takes + their visual_analysis →
 *   compute statistical spread (max - min) for exposure/focus/framing scores →
 *   if spread > threshold → flag som issue → optional Claude rationale
 *
 * Designvalg:
 *   - Reader-only agent — leser eksisterende analysis-data, ingen ny
 *     Claude-analyse av frames (det er allerede gjort i visual-analysis-stage)
 *   - Statistical-spread-detection er rask og deterministisk
 *   - Bare flagger blant ANALYZED takes (kan ikke vurdere det vi ikke har data på)
 *   - Per-issue Claude-pass for human-readable beskrivelse (valgfri)
 *
 * Treshold-vurderinger:
 *   exposure-mismatch:    spread > 0.3 i overall_exposure_score
 *   tonal-outlier:        én take er > 0.25 lavere enn medianen
 *   white-balance-shift:  ikke direkte målbart fra visual-stage ennå, kommer
 *                          når WB-detection-stage legges til (Fase C+ TODO)
 */

import type {
  AIAgent,
  AIAgentInput,
  AIAgentOutput,
  AISuggestion,
  ApplyContext,
  SuggestionApplier,
} from "./ai-suggestion-service.js";
import { listTakesForScene } from "./coverage-take-service.js";
import { listAnalysesForTakes } from "./coverage-analysis-pipeline.js";
import type { Pool } from "pg";

const SUGGESTION_TYPE_COLOR_CONSISTENCY = "post.color-consistency-issue";

interface ColorConsistencyAgentInput {
  sceneId: string;
}

type IssueType = "exposure-mismatch" | "tonal-outlier" | "white-balance-shift";

interface ColorConsistencyIssuePayload {
  sceneId: string;
  issueType: IssueType;
  description: string;
  affectedTakeIds: string[];
  exposureRange?: number;
  severity: "minor" | "major";
  suggestion?: string;
}

const EXPOSURE_SPREAD_THRESHOLD_MAJOR = 0.4;
const EXPOSURE_SPREAD_THRESHOLD_MINOR = 0.25;
const TONAL_OUTLIER_DELTA = 0.25;

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function createColorConsistencyAgent(pool: Pool): AIAgent {
  return {
    name: "color-consistency-agent",
    modelVersion: "v1.0.0",

    async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
      if (input.sourceType !== "scene") return [];

      const agentInput = input.payload as ColorConsistencyAgentInput | undefined;
      if (!agentInput?.sceneId) return [];

      const allTakes = await listTakesForScene(pool, agentInput.sceneId);
      const analyzedTakeIds = allTakes
        .filter((t) => t.processingStatus === "analyzed")
        .map((t) => t.id);
      if (analyzedTakeIds.length < 2) {
        // Trenger minst 2 takes for å gjøre konsistens-sammenligning
        return [];
      }

      const analyses = await listAnalysesForTakes(pool, analyzedTakeIds);
      // Filtrer takes med visual-data
      const takesWithVisual = analyses.filter(
        (a) => a.visualAnalysis?.overallExposureScore !== undefined,
      );
      if (takesWithVisual.length < 2) return [];

      const outputs: AIAgentOutput[] = [];

      // ── Detect 1: exposure-mismatch (spread > threshold) ────────────
      const exposureScores = takesWithVisual.map((a) => ({
        takeId: a.takeId,
        score: a.visualAnalysis!.overallExposureScore!,
      }));
      const exposureValues = exposureScores.map((e) => e.score);
      const exposureMin = Math.min(...exposureValues);
      const exposureMax = Math.max(...exposureValues);
      const exposureSpread = exposureMax - exposureMin;

      if (exposureSpread > EXPOSURE_SPREAD_THRESHOLD_MINOR) {
        const severity = exposureSpread > EXPOSURE_SPREAD_THRESHOLD_MAJOR ? "major" : "minor";
        // Flag takes som er på ekstremene
        const lowOutliers = exposureScores
          .filter((e) => e.score === exposureMin)
          .map((e) => e.takeId);
        const highOutliers = exposureScores
          .filter((e) => e.score === exposureMax)
          .map((e) => e.takeId);
        const affected = [...new Set([...lowOutliers, ...highOutliers])];

        outputs.push({
          suggestionType: SUGGESTION_TYPE_COLOR_CONSISTENCY,
          payload: {
            sceneId: agentInput.sceneId,
            issueType: "exposure-mismatch",
            description:
              `Eksponering varierer ${(exposureSpread * 100).toFixed(0)}% mellom takes ` +
              `(${(exposureMin * 100).toFixed(0)}% → ${(exposureMax * 100).toFixed(0)}%). ` +
              `Vurder grading for å matche.`,
            affectedTakeIds: affected,
            exposureRange: exposureSpread,
            severity,
            suggestion:
              severity === "major"
                ? "Major eksponerings-mismatch — krever shot-by-shot color-correction i post."
                : "Mindre eksponerings-drift — kan matches med global lift/gamma/gain.",
          } satisfies ColorConsistencyIssuePayload,
          confidence: severity === "major" ? 0.9 : 0.75,
          sourceType: "scene",
          sourceId: agentInput.sceneId,
        });
      }

      // ── Detect 2: tonal-outlier (én take avviker fra median) ────────
      if (takesWithVisual.length >= 3) {
        const med = median(exposureValues);
        const outliers = exposureScores.filter(
          (e) => Math.abs(e.score - med) > TONAL_OUTLIER_DELTA,
        );
        if (outliers.length > 0 && outliers.length < takesWithVisual.length / 2) {
          // Bare flag som outlier hvis MINORITY avviker — hvis halvparten avviker
          // er det ikke en outlier, det er gruppe-split
          outputs.push({
            suggestionType: SUGGESTION_TYPE_COLOR_CONSISTENCY,
            payload: {
              sceneId: agentInput.sceneId,
              issueType: "tonal-outlier",
              description:
                `${outliers.length} take${outliers.length === 1 ? "" : "s"} avviker tonalt ` +
                `fra resten av scenen (median: ${(med * 100).toFixed(0)}%, ` +
                `avvik: ${outliers.map((o) => (Math.abs(o.score - med) * 100).toFixed(0) + "%").join(", ")}).`,
              affectedTakeIds: outliers.map((o) => o.takeId),
              exposureRange: Math.max(...outliers.map((o) => Math.abs(o.score - med))),
              severity: "minor",
              suggestion:
                "Vurder å droppe outlier-takes, eller match dem til median via grading.",
            } satisfies ColorConsistencyIssuePayload,
            confidence: 0.7,
            sourceType: "scene",
            sourceId: agentInput.sceneId,
          });
        }
      }

      return outputs;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Applier — no-op audit-trail
// ─────────────────────────────────────────────────────────────────────

export const colorConsistencyApplier: SuggestionApplier<ColorConsistencyIssuePayload> = {
  suggestionType: SUGGESTION_TYPE_COLOR_CONSISTENCY,

  async apply(
    suggestion: AISuggestion<ColorConsistencyIssuePayload>,
    _ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    return {
      acknowledgedIssue: suggestion.payload.issueType,
      sceneId: suggestion.payload.sceneId,
      affectedTakeCount: suggestion.payload.affectedTakeIds.length,
      severity: suggestion.payload.severity,
    };
  },
};
