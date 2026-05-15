/**
 * ai-audio-mix-issue-agent.ts
 *
 * Fase C post-prod-agent. Flagger audio-problemer på takes som krever
 * post-prep — ADR-kandidater, clipping, manglende rom-tone, level-mismatch.
 *
 * Pipeline:
 *   scene_id → load analyzed takes + audio_analysis →
 *   per-take threshold-sjekk → suggestions per detektert issue
 *
 * Designvalg:
 *   - Reader-only — bruker audio_analysis fra eksisterende pipeline
 *   - Per-take suggestions (én suggestion per take per issue), så
 *     editor kan filtrere på severity
 *   - Cross-scene-level-mismatch er én suggestion på scene-nivå
 *
 * Audio-thresholds:
 *   ADR-candidate:        signalToNoiseRatio < 0.5
 *   clipping:             clippingScore < 0.3 (peak >= -1 dBFS)
 *   low-signal:           signalToNoiseRatio < 0.3
 *   level-mismatch:       loudness spread > 6 LUFS mellom takes
 *
 * Manglende room-tone-detection krever wild-track-recording-flag på take
 * (TODO Fase C+ — bruker manuell tagging frem til da)
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

const SUGGESTION_TYPE_AUDIO_MIX_ISSUE = "post.audio-mix-issue";

interface AudioMixAgentInput {
  sceneId: string;
}

type IssueType =
  | "adr-candidate"
  | "clipping"
  | "low-signal"
  | "missing-room-tone"
  | "level-mismatch";

interface AudioMixIssuePayload {
  sceneId: string;
  takeId: string;
  takeNumber: number;
  issueType: IssueType;
  description: string;
  severity: "minor" | "major";
  measuredValue?: number;
  suggestion?: string;
}

const ADR_SNR_THRESHOLD = 0.5;
const LOW_SIGNAL_THRESHOLD = 0.3;
const CLIPPING_SEVERE_THRESHOLD = 0.3;
const CLIPPING_MINOR_THRESHOLD = 0.7;
const LUFS_SPREAD_THRESHOLD = 6; // dB

export function createAudioMixIssueAgent(pool: Pool): AIAgent {
  return {
    name: "audio-mix-issue-agent",
    modelVersion: "v1.0.0",

    async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
      if (input.sourceType !== "scene") return [];

      const agentInput = input.payload as AudioMixAgentInput | undefined;
      if (!agentInput?.sceneId) return [];

      const allTakes = await listTakesForScene(pool, agentInput.sceneId);
      const takeById = new Map(allTakes.map((t) => [t.id, t]));
      const analyzedTakeIds = allTakes
        .filter((t) => t.processingStatus === "analyzed")
        .map((t) => t.id);
      if (analyzedTakeIds.length === 0) return [];

      const analyses = await listAnalysesForTakes(pool, analyzedTakeIds);
      const outputs: AIAgentOutput[] = [];

      // ── Per-take checks ──────────────────────────────────────────
      for (const analysis of analyses) {
        const audio = analysis.audioAnalysis;
        if (!audio) continue;
        const take = takeById.get(analysis.takeId);
        if (!take) continue;

        // SNR — ADR-candidate
        if (audio.signalToNoiseRatio !== undefined && audio.signalToNoiseRatio < ADR_SNR_THRESHOLD) {
          const isSevere = audio.signalToNoiseRatio < LOW_SIGNAL_THRESHOLD;
          outputs.push({
            suggestionType: SUGGESTION_TYPE_AUDIO_MIX_ISSUE,
            payload: {
              sceneId: agentInput.sceneId,
              takeId: take.id,
              takeNumber: take.takeNumber,
              issueType: isSevere ? "low-signal" : "adr-candidate",
              description:
                `Take ${take.takeNumber}: SNR ${(audio.signalToNoiseRatio * 100).toFixed(0)}% — ` +
                `${isSevere ? "svakt eller støyfullt signal" : "kandidat for ADR (dialog-replacement)"}.`,
              severity: isSevere ? "major" : "minor",
              measuredValue: audio.signalToNoiseRatio,
              suggestion: isSevere
                ? "Sjekk lyd-opptak; vurder reshoot eller full ADR."
                : "Merk som ADR-kandidat. Sammenlign med andre takes — kan være lokasjon-spesifikt.",
            } satisfies AudioMixIssuePayload,
            confidence: 0.85,
            sourceType: "scene",
            sourceId: agentInput.sceneId,
          });
        }

        // Clipping
        if (audio.clippingScore !== undefined && audio.clippingScore < CLIPPING_MINOR_THRESHOLD) {
          const isSevere = audio.clippingScore < CLIPPING_SEVERE_THRESHOLD;
          outputs.push({
            suggestionType: SUGGESTION_TYPE_AUDIO_MIX_ISSUE,
            payload: {
              sceneId: agentInput.sceneId,
              takeId: take.id,
              takeNumber: take.takeNumber,
              issueType: "clipping",
              description:
                `Take ${take.takeNumber}: clipping detektert ` +
                `(score ${audio.clippingScore.toFixed(2)}). ` +
                `${isSevere ? "Alvorlig peak-overshoot." : "Sporadisk clipping på peaks."}`,
              severity: isSevere ? "major" : "minor",
              measuredValue: audio.clippingScore,
              suggestion: isSevere
                ? "Major clipping — vurder å erstatte med backup-spor eller ADR."
                : "Mindre clipping kan fjernes med de-clipper-plugin i post.",
            } satisfies AudioMixIssuePayload,
            confidence: 0.9,
            sourceType: "scene",
            sourceId: agentInput.sceneId,
          });
        }
      }

      // ── Cross-take check: level-mismatch ─────────────────────────
      const lufsValues = analyses
        .map((a) => a.audioAnalysis?.loudnessLufs)
        .filter((v): v is number => v !== undefined);
      if (lufsValues.length >= 2) {
        const lufsMin = Math.min(...lufsValues);
        const lufsMax = Math.max(...lufsValues);
        const spread = lufsMax - lufsMin;
        if (spread > LUFS_SPREAD_THRESHOLD) {
          // Finn outlier-takes (de som er > 3dB fra median)
          const med = lufsValues.slice().sort((a, b) => a - b)[Math.floor(lufsValues.length / 2)];
          const outlierIds: string[] = [];
          for (const analysis of analyses) {
            const v = analysis.audioAnalysis?.loudnessLufs;
            if (v !== undefined && Math.abs(v - med) > 3) {
              outlierIds.push(analysis.takeId);
            }
          }
          // Lag én suggestion per outlier (frontend kan gruppere hvis ønskelig)
          for (const takeId of outlierIds) {
            const take = takeById.get(takeId);
            if (!take) continue;
            outputs.push({
              suggestionType: SUGGESTION_TYPE_AUDIO_MIX_ISSUE,
              payload: {
                sceneId: agentInput.sceneId,
                takeId: take.id,
                takeNumber: take.takeNumber,
                issueType: "level-mismatch",
                description:
                  `Take ${take.takeNumber} har volumforskjell på ${spread.toFixed(1)} dB ` +
                  `mot scenens medianverdi (${med.toFixed(1)} LUFS).`,
                severity: spread > 12 ? "major" : "minor",
                measuredValue: spread,
                suggestion:
                  "Normaliser via dialog-normalisering eller fix level i post.",
              } satisfies AudioMixIssuePayload,
              confidence: 0.75,
              sourceType: "scene",
              sourceId: agentInput.sceneId,
            });
          }
        }
      }

      return outputs;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Applier — markerer take med ADR-needed-flag i metadata
// ─────────────────────────────────────────────────────────────────────
//
// For ADR/low-signal/clipping kan applieren oppdatere casting_takes.notes
// eller en dedikert audit-felt. For nå: bare audit-trail. Real ADR-tracking
// hører til lyd-post-prep-workflow i Fase D.

export const audioMixIssueApplier: SuggestionApplier<AudioMixIssuePayload> = {
  suggestionType: SUGGESTION_TYPE_AUDIO_MIX_ISSUE,

  async apply(
    suggestion: AISuggestion<AudioMixIssuePayload>,
    _ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    return {
      acknowledgedIssue: suggestion.payload.issueType,
      takeId: suggestion.payload.takeId,
      takeNumber: suggestion.payload.takeNumber,
      severity: suggestion.payload.severity,
    };
  },
};
