/**
 * ai-coverage-gap-agent.ts
 *
 * Fase B-agent som sammenligner planlagt coverage (fra casting_shot_lists)
 * med faktisk fanget materiale (fra casting_takes). Produserer
 * 'coverage.gap'-forslag for hver shot som mangler dekning, eller hvor
 * dekningen ser tynn ut.
 *
 * Pipeline:
 *   scene_id → load shot_list + alle takes → diff → suggestions
 *
 * Forskjell fra de andre agentene:
 *   - PROGRAMMATIC, ikke Claude. Sammenligning er deterministisk, ingen
 *     språk-tolkning kreves.
 *   - Ingen kostnad — bare DB-spørringer. Kan kjøres ofte (etter hver
 *     upload, ved scene-review, etc.).
 *
 * Gap-typer som flagges:
 *   missing-shot          — Planlagt shot uten noen takes
 *   no-circled-take       — Shot har takes men ingen er marked_circled
 *   no-analyzed-take      — Shot har takes men ingen er analyzed (kan ikke
 *                            velge best-take ennå)
 *   low-quality-coverage  — Alle takes har overall_score < 0.5
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

const SUGGESTION_TYPE_COVERAGE_GAP = "coverage.gap";

/**
 * Frontend-serialisert input. Agenten loader resten fra DB via closure-
 * captured pool (factory-pattern under).
 */
interface CoverageGapAgentInput {
  sceneId: string;
  shotListId: string;
  plannedShots: Array<{
    type: string;
    description: string;
    durationSec?: number;
  }>;
}

interface GapPayload {
  sceneId: string;
  gapType: string;
  description: string;
  shotListId?: string;
  shotIndex?: number;
  plannedShotType?: string;
  plannedShotDescription?: string;
  takesCount?: number;
}

const LOW_QUALITY_THRESHOLD = 0.5;

/**
 * Factory som lager agenten med pool captured i closure. Agenten kan dermed
 * laste takes/analyses uten at pool må serialiseres gjennom payload.
 */
export function createCoverageGapAgent(pool: Pool): AIAgent {
  return {
  name: "coverage-gap-agent",
  modelVersion: "v1.0.0",

  async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
    if (input.sourceType !== "scene") return [];

    const agentInput = input.payload as CoverageGapAgentInput | undefined;
    if (!agentInput?.shotListId || !Array.isArray(agentInput?.plannedShots)) {
      return [];
    }
    if (agentInput.plannedShots.length === 0) return [];

    // Last alle takes for scenen — vi sammenligner per planlagt shot
    const allTakes = await listTakesForScene(pool, agentInput.sceneId);
    const outputs: AIAgentOutput[] = [];

    for (let idx = 0; idx < agentInput.plannedShots.length; idx++) {
      const plannedShot = agentInput.plannedShots[idx];

      // Filtrer takes som er tagget til denne planlagte shoten
      const takesForShot = allTakes.filter(
        (t) => t.shotListId === agentInput.shotListId && t.shotIndex === idx,
      );

      if (takesForShot.length === 0) {
        outputs.push({
          suggestionType: SUGGESTION_TYPE_COVERAGE_GAP,
          payload: {
            sceneId: agentInput.sceneId,
            gapType: "missing-shot",
            description: `Ingen takes fanget for "${plannedShot.type}-shot": ${plannedShot.description}`,
            shotListId: agentInput.shotListId,
            shotIndex: idx,
            plannedShotType: plannedShot.type,
            plannedShotDescription: plannedShot.description,
            takesCount: 0,
          } satisfies GapPayload,
          // High confidence — vi vet sikkert at det ikke er noen takes
          confidence: 0.95,
          sourceType: "scene",
          sourceId: agentInput.sceneId,
        });
        continue;
      }

      // Sjekk om noen er marked_circled
      const circled = takesForShot.filter((t) => t.markedCircled);
      if (circled.length === 0) {
        outputs.push({
          suggestionType: SUGGESTION_TYPE_COVERAGE_GAP,
          payload: {
            sceneId: agentInput.sceneId,
            gapType: "no-circled-take",
            description: `${takesForShot.length} takes for "${plannedShot.type}-shot" men ingen er markert som circled. Vurder å markere foretrukne.`,
            shotListId: agentInput.shotListId,
            shotIndex: idx,
            plannedShotType: plannedShot.type,
            plannedShotDescription: plannedShot.description,
            takesCount: takesForShot.length,
          } satisfies GapPayload,
          confidence: 0.75,
          sourceType: "scene",
          sourceId: agentInput.sceneId,
        });
      }

      // Sjekk om noen er analyzed
      const analyzedIds = takesForShot
        .filter((t) => t.processingStatus === "analyzed")
        .map((t) => t.id);
      if (analyzedIds.length === 0) {
        outputs.push({
          suggestionType: SUGGESTION_TYPE_COVERAGE_GAP,
          payload: {
            sceneId: agentInput.sceneId,
            gapType: "no-analyzed-take",
            description: `${takesForShot.length} takes for "${plannedShot.type}-shot" men ingen er analysert ennå. Best-take-anbefaling kommer når analyse er ferdig.`,
            shotListId: agentInput.shotListId,
            shotIndex: idx,
            plannedShotType: plannedShot.type,
            plannedShotDescription: plannedShot.description,
            takesCount: takesForShot.length,
          } satisfies GapPayload,
          confidence: 0.7,
          sourceType: "scene",
          sourceId: agentInput.sceneId,
        });
        continue;
      }

      // Sjekk om alle analyserte takes har lav kvalitet
      const analyses = await listAnalysesForTakes(pool, analyzedIds);
      const scores = analyses
        .map((a) => a.overallScore)
        .filter((s): s is number => s != null);
      if (scores.length > 0 && scores.every((s) => s < LOW_QUALITY_THRESHOLD)) {
        const maxScore = Math.max(...scores);
        outputs.push({
          suggestionType: SUGGESTION_TYPE_COVERAGE_GAP,
          payload: {
            sceneId: agentInput.sceneId,
            gapType: "low-quality-coverage",
            description:
              `${takesForShot.length} takes for "${plannedShot.type}-shot", men beste composite-score ` +
              `er ${maxScore.toFixed(2)}. Vurder reshoot — eller juster vekting hvis fokus/lyd/perf-` +
              `kriterier ikke passer denne sjangeren.`,
            shotListId: agentInput.shotListId,
            shotIndex: idx,
            plannedShotType: plannedShot.type,
            plannedShotDescription: plannedShot.description,
            takesCount: takesForShot.length,
          } satisfies GapPayload,
          confidence: 0.8,
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
// Applier — registrerer at brukeren har sett gapet
// ─────────────────────────────────────────────────────────────────────
//
// Coverage-gap er en OBSERVASJON, ikke en handlingsprodusent. Applieren
// markerer bare at issuet er akseptert (audit-trail). Brukeren må selv
// avgjøre om de skal:
//   - Plan reshoot
//   - Markere eksisterende take som circled
//   - Akseptere gapet og gå videre

export const coverageGapApplier: SuggestionApplier<GapPayload> = {
  suggestionType: SUGGESTION_TYPE_COVERAGE_GAP,

  async apply(
    suggestion: AISuggestion<GapPayload>,
    _ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    return {
      acknowledgedGapType: suggestion.payload.gapType,
      sceneId: suggestion.payload.sceneId,
      shotIndex: suggestion.payload.shotIndex ?? null,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────
// Helper: last shot-list for en scene (brukes av routes/frontend-trigger)
// ─────────────────────────────────────────────────────────────────────

export async function loadCoverageGapInputForScene(
  pool: Pool,
  sceneId: string,
): Promise<{ shotListId: string; plannedShots: Array<{ type: string; description: string }> } | null> {
  const r = await pool.query<{ id: string; shots: unknown }>(
    `SELECT id, shots FROM casting_shot_lists WHERE scene_id = $1 LIMIT 1`,
    [sceneId],
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  const shots = Array.isArray(row.shots) ? row.shots : [];
  const plannedShots = shots
    .filter((s): s is { type: string; description: string } =>
      typeof s === "object" && s != null &&
      typeof (s as Record<string, unknown>).type === "string" &&
      typeof (s as Record<string, unknown>).description === "string",
    );
  return { shotListId: row.id, plannedShots };
}
