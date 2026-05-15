/**
 * ai-dialog-pacing-agent.ts
 *
 * Fase D editorial-agent. Analyserer transcript-timing fra audio_analysis
 * og flagger pacing-problemer som krever editor-attention eller reshoot.
 *
 * Pipeline:
 *   scene_id → pick best take (circled > høyest score) → les transcript-
 *   segmenter → beregn pacing-metrikker → flag issues
 *
 * Pacing-detektorer:
 *   monotonic-rhythm:  stdev(segment-length) < 0.5s OG ≥ 5 segmenter
 *                       (alle replikker er like lange — robotaktig)
 *   long-pauses:       pause mellom segments > 5s (utenfor scene-fade)
 *   rushed:            avg segment length < 1.5s (skuespillere haster)
 *   uneven:            stdev > 3s (uregelmessig rytme)
 *
 * Speech density:
 *   talking_time / total_duration < 0.3 = sparsom dialog (OK for action)
 *   > 0.8 = veldig dialog-tung (kan trenge cutaways)
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
import type { TranscriptSegment } from "./coverage-analysis-types.js";
import type { Pool } from "pg";

const SUGGESTION_TYPE_DIALOG_PACING = "post.dialog-pacing-issue";

interface DialogPacingAgentInput {
  sceneId: string;
}

type IssueType = "monotonic-rhythm" | "long-pauses" | "rushed" | "uneven";

interface DialogPacingPayload {
  sceneId: string;
  takeId?: string;
  takeNumber?: number;
  pacingIssueType: IssueType;
  description: string;
  avgSegmentSec?: number;
  maxPauseSec?: number;
  stdevSegmentSec?: number;
  speechDensityRatio?: number;
  flaggedRanges?: Array<{ start: number; end: number; reason: string }>;
  severity: "minor" | "major";
  suggestion?: string;
}

// Thresholds
const MIN_SEGMENTS_FOR_ANALYSIS = 4;
const MONOTONIC_STDEV_THRESHOLD = 0.5;
const LONG_PAUSE_THRESHOLD_SEC = 5;
const LONG_PAUSE_SEVERE_SEC = 10;
const RUSHED_AVG_THRESHOLD = 1.5;
const UNEVEN_STDEV_THRESHOLD = 3;

interface SegmentStats {
  segmentLengths: number[];
  pauses: number[];
  avgSegmentSec: number;
  stdevSegmentSec: number;
  maxPauseSec: number;
  speechDensityRatio: number;
  totalDuration: number;
}

function computeStats(transcript: TranscriptSegment[]): SegmentStats | null {
  if (transcript.length < MIN_SEGMENTS_FOR_ANALYSIS) return null;

  const segmentLengths = transcript.map((s) => s.end - s.start);
  const pauses: number[] = [];
  for (let i = 1; i < transcript.length; i++) {
    pauses.push(transcript[i].start - transcript[i - 1].end);
  }

  const avg = segmentLengths.reduce((a, b) => a + b, 0) / segmentLengths.length;
  const variance =
    segmentLengths.reduce((s, v) => s + (v - avg) ** 2, 0) / segmentLengths.length;
  const stdev = Math.sqrt(variance);

  const maxPause = pauses.length > 0 ? Math.max(...pauses) : 0;
  const totalTalkTime = segmentLengths.reduce((a, b) => a + b, 0);
  const totalDuration = transcript[transcript.length - 1].end - transcript[0].start;
  const density = totalDuration > 0 ? totalTalkTime / totalDuration : 0;

  return {
    segmentLengths,
    pauses,
    avgSegmentSec: avg,
    stdevSegmentSec: stdev,
    maxPauseSec: maxPause,
    speechDensityRatio: density,
    totalDuration,
  };
}

export function createDialogPacingAgent(pool: Pool): AIAgent {
  return {
    name: "dialog-pacing-agent",
    modelVersion: "v1.0.0",

    async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
      if (input.sourceType !== "scene") return [];

      const agentInput = input.payload as DialogPacingAgentInput | undefined;
      if (!agentInput?.sceneId) return [];

      const allTakes = await listTakesForScene(pool, agentInput.sceneId);
      const analyzedTakes = allTakes.filter((t) => t.processingStatus === "analyzed");
      if (analyzedTakes.length === 0) return [];

      const analyses = await listAnalysesForTakes(pool, analyzedTakes.map((t) => t.id));
      const analysisById = new Map(analyses.map((a) => [a.takeId, a]));

      // Velg beste take: circled > høyest score
      const circled = analyzedTakes.find((t) => t.markedCircled);
      let chosenTake = circled;
      if (!chosenTake) {
        const sorted = [...analyzedTakes].sort((a, b) => {
          const sa = analysisById.get(a.id)?.overallScore ?? -1;
          const sb = analysisById.get(b.id)?.overallScore ?? -1;
          return sb - sa;
        });
        chosenTake = sorted[0];
      }
      if (!chosenTake) return [];

      const analysis = analysisById.get(chosenTake.id);
      const transcript = analysis?.audioAnalysis?.transcript;
      if (!transcript || transcript.length === 0) return [];

      const stats = computeStats(transcript);
      if (!stats) return [];

      const outputs: AIAgentOutput[] = [];
      const baseFields = {
        sceneId: agentInput.sceneId,
        takeId: chosenTake.id,
        takeNumber: chosenTake.takeNumber,
        avgSegmentSec: stats.avgSegmentSec,
        maxPauseSec: stats.maxPauseSec,
        stdevSegmentSec: stats.stdevSegmentSec,
        speechDensityRatio: stats.speechDensityRatio,
      };

      // ── Detect 1: monotonic rhythm ────────────────────────────────
      if (transcript.length >= 5 && stats.stdevSegmentSec < MONOTONIC_STDEV_THRESHOLD) {
        outputs.push({
          suggestionType: SUGGESTION_TYPE_DIALOG_PACING,
          payload: {
            ...baseFields,
            pacingIssueType: "monotonic-rhythm",
            description:
              `${transcript.length} dialog-segmenter med svært lik lengde ` +
              `(avg ${stats.avgSegmentSec.toFixed(1)}s, stdev ${stats.stdevSegmentSec.toFixed(2)}s). ` +
              `Risikerer robotaktig leveranse.`,
            severity: "minor",
            suggestion:
              "Vurder å bryte opp rytmen med en pause eller en interjeksjon. " +
              "Eller bekreft at den jevne rytmen er en bevisst stilistisk valg.",
          } satisfies DialogPacingPayload,
          confidence: 0.75,
          sourceType: "scene",
          sourceId: agentInput.sceneId,
        });
      }

      // ── Detect 2: long pauses ──────────────────────────────────────
      if (stats.maxPauseSec > LONG_PAUSE_THRESHOLD_SEC) {
        const severe = stats.maxPauseSec > LONG_PAUSE_SEVERE_SEC;
        // Finn de spesifikke pause-rekkeviddene
        const flagged: Array<{ start: number; end: number; reason: string }> = [];
        for (let i = 1; i < transcript.length; i++) {
          const pauseLen = transcript[i].start - transcript[i - 1].end;
          if (pauseLen > LONG_PAUSE_THRESHOLD_SEC) {
            flagged.push({
              start: transcript[i - 1].end,
              end: transcript[i].start,
              reason: `${pauseLen.toFixed(1)}s pause`,
            });
          }
        }
        outputs.push({
          suggestionType: SUGGESTION_TYPE_DIALOG_PACING,
          payload: {
            ...baseFields,
            pacingIssueType: "long-pauses",
            description:
              `Pauser opp til ${stats.maxPauseSec.toFixed(1)}s mellom replikker — ` +
              `${severe ? "risikerer å bryte tempo." : "kan trenge cutaway eller B-roll."}`,
            flaggedRanges: flagged,
            severity: severe ? "major" : "minor",
            suggestion: severe
              ? "Stor pause — vurder cut + cutaway, eller spørr regissør om dette var intensjonell."
              : "Mindre pause — fyll med reaction-shot eller fortsett uten klipp.",
          } satisfies DialogPacingPayload,
          confidence: 0.85,
          sourceType: "scene",
          sourceId: agentInput.sceneId,
        });
      }

      // ── Detect 3: rushed delivery ─────────────────────────────────
      if (stats.avgSegmentSec < RUSHED_AVG_THRESHOLD && transcript.length >= 4) {
        outputs.push({
          suggestionType: SUGGESTION_TYPE_DIALOG_PACING,
          payload: {
            ...baseFields,
            pacingIssueType: "rushed",
            description:
              `Gjennomsnittlig replikk-lengde er kort (${stats.avgSegmentSec.toFixed(1)}s). ` +
              `Skuespillere kan haste — vurder slower delivery.`,
            severity: "minor",
            suggestion:
              "Hvis ikke comedic/action — be skuespillere bremse litt på neste take.",
          } satisfies DialogPacingPayload,
          confidence: 0.65,
          sourceType: "scene",
          sourceId: agentInput.sceneId,
        });
      }

      // ── Detect 4: uneven rhythm (høy stdev) ───────────────────────
      // Kun hvis IKKE allerede flagget som monotonic (motsatt)
      if (stats.stdevSegmentSec > UNEVEN_STDEV_THRESHOLD) {
        outputs.push({
          suggestionType: SUGGESTION_TYPE_DIALOG_PACING,
          payload: {
            ...baseFields,
            pacingIssueType: "uneven",
            description:
              `Stor variasjon i replikk-lengde (stdev ${stats.stdevSegmentSec.toFixed(1)}s). ` +
              `Kan virke uregelmessig — kan også være bevisst kontrast.`,
            severity: "minor",
            suggestion:
              "Sjekk om kontrasten er intensjonell. Hvis ikke, jevn ut med ADR eller pickup-take.",
          } satisfies DialogPacingPayload,
          confidence: 0.6,
          sourceType: "scene",
          sourceId: agentInput.sceneId,
        });
      }

      return outputs;
    },
  };
}

// No-op applier — audit-trail
export const dialogPacingApplier: SuggestionApplier<DialogPacingPayload> = {
  suggestionType: SUGGESTION_TYPE_DIALOG_PACING,

  async apply(
    suggestion: AISuggestion<DialogPacingPayload>,
    _ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    return {
      acknowledgedIssue: suggestion.payload.pacingIssueType,
      sceneId: suggestion.payload.sceneId,
      takeId: suggestion.payload.takeId ?? null,
      severity: suggestion.payload.severity,
    };
  },
};
