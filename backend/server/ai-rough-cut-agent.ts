/**
 * ai-rough-cut-agent.ts
 *
 * Fase C-agent som samler best-takes per shot til en ordnet timeline-draft.
 * Foundation for editor-workflow — gir editor et utgangspunkt før manuell
 * finjustering.
 *
 * Pipeline:
 *   scene_id → load shot_list + alle analyzed takes →
 *   for each planned shot: pick best take (circled > highest score) →
 *   bygg ordered clips array → 'edit.rough-cut-draft'-suggestion
 *
 * Designvalg:
 *   - PROGRAMMATIC, ingen Claude. Best-take-valg er deterministisk basert
 *     på etablerte signaler (circled, composite score).
 *   - Hvis et planlagt shot mangler take, hopp over og rapporter
 *     missingShotsCount i payload. Rough-cut er BEST-EFFORT.
 *   - Default in/out-trim er hele take-lengden. Editor kan justere senere.
 *     Auto-trim (smart cut på dialog-pauser) kommer som senere stage.
 *
 * Forskjellen fra coverage-best-take:
 *   - Best-take er per-shot
 *   - Rough-cut er hele scenen som sammenhengende kutt
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

const SUGGESTION_TYPE_ROUGH_CUT = "edit.rough-cut-draft";

interface RoughCutAgentInput {
  sceneId: string;
  /** Valgfri — agent laster fra DB hvis ikke gitt */
  shotListId?: string;
  /** Valgfri — agent laster fra DB hvis ikke gitt */
  plannedShots?: Array<{
    type: string;
    description: string;
    durationSec?: number;
  }>;
}

async function loadShotListForScene(
  pool: Pool,
  sceneId: string,
): Promise<{ shotListId: string; plannedShots: Array<{ type: string; description: string; durationSec?: number }> } | null> {
  const r = await pool.query<{ id: string; shots: unknown }>(
    `SELECT id, shots FROM casting_shot_lists WHERE scene_id = $1 LIMIT 1`,
    [sceneId],
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  const shots = Array.isArray(row.shots) ? row.shots : [];
  const plannedShots = shots
    .filter((s): s is { type: string; description: string; durationSec?: number } =>
      typeof s === "object" && s != null &&
      typeof (s as Record<string, unknown>).type === "string" &&
      typeof (s as Record<string, unknown>).description === "string",
    );
  return { shotListId: row.id, plannedShots };
}

interface RoughCutClip {
  takeId: string;
  takeNumber: number;
  shotIndex: number;
  shotType?: string;
  shotDescription?: string;
  durationSec?: number;
  inSec?: number;
  outSec?: number;
  score?: number;
}

interface RoughCutPayload {
  sceneId: string;
  shotListId: string;
  clips: RoughCutClip[];
  totalDurationSec?: number;
  missingShotsCount?: number;
  rationale?: string;
}

export function createRoughCutAgent(pool: Pool): AIAgent {
  return {
    name: "rough-cut-agent",
    modelVersion: "v1.0.0",

    async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
      if (input.sourceType !== "scene") return [];

      const agentInput = input.payload as RoughCutAgentInput | undefined;
      if (!agentInput?.sceneId) return [];

      // Auto-load shot-list hvis frontend ikke kjenner shotListId
      let shotListId = agentInput.shotListId;
      let plannedShots = agentInput.plannedShots;
      if (!shotListId || !plannedShots || plannedShots.length === 0) {
        const loaded = await loadShotListForScene(pool, agentInput.sceneId);
        if (!loaded || loaded.plannedShots.length === 0) return [];
        shotListId = loaded.shotListId;
        plannedShots = loaded.plannedShots;
      }

      const allTakes = await listTakesForScene(pool, agentInput.sceneId);
      const analyzedTakeIds = allTakes
        .filter((t) => t.processingStatus === "analyzed")
        .map((t) => t.id);
      const analyses = analyzedTakeIds.length > 0
        ? await listAnalysesForTakes(pool, analyzedTakeIds)
        : [];
      const analysisById = new Map(analyses.map((a) => [a.takeId, a]));

      const clips: RoughCutClip[] = [];
      let missingShotsCount = 0;
      let totalDuration = 0;

      for (let idx = 0; idx < plannedShots.length; idx++) {
        const plannedShot = plannedShots[idx];
        const takesForShot = allTakes.filter(
          (t) => t.shotListId === shotListId && t.shotIndex === idx,
        );

        if (takesForShot.length === 0) {
          missingShotsCount++;
          continue;
        }

        // Velg best take:
        // 1. Hvis noen er marked_circled → ta circled (respekter set-beslutning)
        // 2. Ellers høyest composite-score
        // 3. Ellers første analyzed
        // 4. Ellers første take overhodet
        const circled = takesForShot.find((t) => t.markedCircled);
        let chosen = circled;
        let chosenScore: number | undefined;

        if (!chosen) {
          // Sortér på score
          const scored = takesForShot
            .map((t) => ({ take: t, score: analysisById.get(t.id)?.overallScore ?? -1 }))
            .sort((a, b) => b.score - a.score);
          chosen = scored[0]?.take;
          chosenScore = scored[0]?.score >= 0 ? scored[0].score : undefined;
        } else {
          chosenScore = analysisById.get(chosen.id)?.overallScore ?? undefined;
        }

        if (!chosen) {
          missingShotsCount++;
          continue;
        }

        const durationSec = chosen.durationSec ?? undefined;
        if (durationSec) totalDuration += durationSec;

        clips.push({
          takeId: chosen.id,
          takeNumber: chosen.takeNumber,
          shotIndex: idx,
          shotType: plannedShot.type,
          shotDescription: plannedShot.description,
          durationSec,
          inSec: 0,
          outSec: durationSec,
          score: chosenScore,
        });
      }

      if (clips.length === 0) return [];

      // Confidence reflekterer hvor komplett rough-cuten er
      const completeness = clips.length / plannedShots.length;
      const confidence = Math.min(0.95, 0.5 + completeness * 0.45);

      let rationale: string | undefined;
      if (missingShotsCount > 0) {
        rationale = `${clips.length}/${plannedShots.length} shots har takes. Mangler ${missingShotsCount} shot${missingShotsCount === 1 ? "" : "s"} — coverage-gap-agent flagger detaljer.`;
      } else if (clips.every((c) => c.score !== undefined)) {
        const avgScore = clips.reduce((s, c) => s + (c.score ?? 0), 0) / clips.length;
        rationale = `Komplett shot-coverage. Gjennomsnittlig take-score: ${avgScore.toFixed(2)}.`;
      }

      const payload: RoughCutPayload = {
        sceneId: agentInput.sceneId,
        shotListId,
        clips,
        totalDurationSec: totalDuration > 0 ? totalDuration : undefined,
        missingShotsCount: missingShotsCount > 0 ? missingShotsCount : undefined,
        rationale,
      };

      return [{
        suggestionType: SUGGESTION_TYPE_ROUGH_CUT,
        payload,
        confidence,
        sourceType: "scene",
        sourceId: agentInput.sceneId,
      }];
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Applier — lagrer rough-cut i scene.metadata
// ─────────────────────────────────────────────────────────────────────
//
// Rough-cut er en designartefakt — vi materialiserer den i
// casting_scenes.metadata.roughCut så editor-UI kan laste den senere.
// Idempotent: erstatter eksisterende rough-cut hvis akseptert på nytt.

export const roughCutApplier: SuggestionApplier<RoughCutPayload> = {
  suggestionType: SUGGESTION_TYPE_ROUGH_CUT,

  async apply(
    suggestion: AISuggestion<RoughCutPayload>,
    ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    const { client } = ctx;
    const { payload } = suggestion;

    await client.query(
      `UPDATE casting_scenes
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         '{roughCut}',
         $1::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify({
          shotListId: payload.shotListId,
          clips: payload.clips,
          totalDurationSec: payload.totalDurationSec ?? null,
          rationale: payload.rationale ?? null,
          sourceSuggestionId: suggestion.id,
        }),
        payload.sceneId,
      ],
    );

    return {
      sceneId: payload.sceneId,
      clipCount: payload.clips.length,
      totalDurationSec: payload.totalDurationSec ?? null,
    };
  },
};
