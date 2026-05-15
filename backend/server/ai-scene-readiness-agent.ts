/**
 * ai-scene-readiness-agent.ts
 *
 * Workflow-aggregator-agent. Leser alle suggestions for en scene på tvers
 * av faser (pre / live / post) og produserer en single readiness-report
 * som forteller brukeren hvor scenen står.
 *
 * Pipeline:
 *   scene_id → load alle suggestions for source_id = scene_id →
 *   gruppér per phase via suggestion_type-prefiks →
 *   beregn per-phase status + readyScore → returnér én aggregat-suggestion
 *
 * Phase-mapping (via suggestion_type-prefiks):
 *   pre   — breakdown.*, shot-list.*, casting.role-stub
 *   live  — coverage.*, casting.audition-sides
 *   post  — edit.*, post.*, story.continuity-issue
 *
 * Status-regler:
 *   ready          — alle accepted/applied + ingen major-blockers
 *   needs-attention — minst én major-pending eller major-rejected
 *   in-progress    — pending suggestions men ingen major
 *   unstarted      — ingen suggestions overhodet for fasen
 *
 * Designvalg:
 *   - PROGRAMMATIC, ingen Claude. Aggregering er deterministisk.
 *   - Hver kjøring overskriver forrige report (idempotent via accept-applier
 *     som lagrer i scene-metadata)
 *   - Major-blockers detekteres ved at suggestion.payload.severity === 'major'
 *     hvor det er definert
 */

import type {
  AIAgent,
  AIAgentInput,
  AIAgentOutput,
  AISuggestion,
  AISuggestionStatus,
  ApplyContext,
  SuggestionApplier,
} from "./ai-suggestion-service.js";
import type { Pool } from "pg";

const SUGGESTION_TYPE_READINESS = "scene.readiness-report";

interface ReadinessAgentInput {
  sceneId: string;
}

type ScenePhase = "pre" | "live" | "post";
type ScenePhaseStatus = "unstarted" | "in-progress" | "needs-attention" | "ready";

interface ScenePhaseSummary {
  status: ScenePhaseStatus;
  pendingCount: number;
  acceptedCount: number;
  rejectedCount: number;
  blockers: string[];
}

interface ReadinessPayload {
  sceneId: string;
  phases: Record<ScenePhase, ScenePhaseSummary>;
  readyScore: number;
  overallStatus: ScenePhaseStatus;
  rationale: string;
  blockers: string[];
  nextActions?: string[];
}

function phaseForType(suggestionType: string): ScenePhase | null {
  if (suggestionType.startsWith("breakdown.")) return "pre";
  if (suggestionType.startsWith("shot-list.")) return "pre";
  if (suggestionType === "casting.role-stub") return "pre";
  if (suggestionType.startsWith("coverage.")) return "live";
  if (suggestionType === "casting.audition-sides") return "live";
  if (suggestionType.startsWith("edit.")) return "post";
  if (suggestionType.startsWith("post.")) return "post";
  if (suggestionType === "story.continuity-issue") return "post";
  return null; // unkjent — skip
}

interface SuggestionRow {
  id: string;
  suggestion_type: string;
  status: AISuggestionStatus;
  payload: Record<string, unknown> | null;
  agent_name: string;
}

function emptyPhase(): ScenePhaseSummary {
  return {
    status: "unstarted",
    pendingCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    blockers: [],
  };
}

function isMajor(payload: Record<string, unknown> | null): boolean {
  if (!payload) return false;
  return payload.severity === "major";
}

function shortBlockerLabel(row: SuggestionRow): string {
  // Bygg en lesbar label fra suggestion-type + payload
  const type = row.suggestion_type;
  const p = row.payload ?? {};

  if (type === "coverage.gap") {
    return `Coverage-gap: ${typeof p.gapType === "string" ? p.gapType : "ukjent"}`;
  }
  if (type === "story.continuity-issue") {
    return `Continuity: ${typeof p.issueType === "string" ? p.issueType : "feil"}`;
  }
  if (type === "post.audio-mix-issue") {
    return `Audio: ${typeof p.issueType === "string" ? p.issueType : "issue"}`;
  }
  if (type === "post.color-consistency-issue") {
    return `Color: ${typeof p.issueType === "string" ? p.issueType : "issue"}`;
  }
  if (type === "post.dialog-pacing-issue") {
    return `Pacing: ${typeof p.pacingIssueType === "string" ? p.pacingIssueType : "issue"}`;
  }
  return type;
}

function deriveStatus(summary: ScenePhaseSummary): ScenePhaseStatus {
  if (summary.pendingCount === 0 && summary.acceptedCount === 0 && summary.rejectedCount === 0) {
    return "unstarted";
  }
  if (summary.blockers.length > 0) return "needs-attention";
  if (summary.pendingCount > 0) return "in-progress";
  if (summary.acceptedCount > 0) return "ready";
  return "in-progress";
}

export function createSceneReadinessAgent(pool: Pool): AIAgent {
  return {
    name: "scene-readiness-agent",
    modelVersion: "v1.0.0",

    async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
      if (input.sourceType !== "scene") return [];

      const agentInput = input.payload as ReadinessAgentInput | undefined;
      if (!agentInput?.sceneId) return [];

      // Hent alle suggestions for denne scenen — ekskluder readiness-report selv
      const r = await pool.query<SuggestionRow>(
        `SELECT id, suggestion_type, status, payload, agent_name
         FROM casting_ai_suggestions
         WHERE source_type = 'scene'
           AND source_id = $1
           AND suggestion_type <> $2
           AND status <> 'superseded'`,
        [agentInput.sceneId, SUGGESTION_TYPE_READINESS],
      );

      const phases: Record<ScenePhase, ScenePhaseSummary> = {
        pre: emptyPhase(),
        live: emptyPhase(),
        post: emptyPhase(),
      };

      const allBlockers: string[] = [];

      for (const row of r.rows) {
        const phase = phaseForType(row.suggestion_type);
        if (!phase) continue;
        const summary = phases[phase];

        const isPending = row.status === "pending";
        const isAccepted = row.status === "accepted" || row.status === "applied";
        const isRejected = row.status === "rejected";

        if (isPending) summary.pendingCount++;
        if (isAccepted) summary.acceptedCount++;
        if (isRejected) summary.rejectedCount++;

        // Major blockers: major-severity pending suggestions
        if (isPending && isMajor(row.payload)) {
          const label = shortBlockerLabel(row);
          summary.blockers.push(label);
          allBlockers.push(label);
        }
      }

      // Beregn per-phase status
      for (const phase of ["pre", "live", "post"] as const) {
        phases[phase].status = deriveStatus(phases[phase]);
      }

      // Ready-score: vektet kombinasjon
      // pre 0.2, live 0.4, post 0.4 — post veier mer fordi det er sluttproduktet
      const phaseWeights: Record<ScenePhase, number> = { pre: 0.2, live: 0.4, post: 0.4 };
      const statusValues: Record<ScenePhaseStatus, number> = {
        unstarted: 0,
        "in-progress": 0.4,
        "needs-attention": 0.5,
        ready: 1.0,
      };
      let readyScore = 0;
      for (const phase of ["pre", "live", "post"] as const) {
        readyScore += statusValues[phases[phase].status] * phaseWeights[phase];
      }

      // Overall status
      let overallStatus: ScenePhaseStatus;
      if (allBlockers.length > 0) overallStatus = "needs-attention";
      else if (readyScore >= 0.9) overallStatus = "ready";
      else if (readyScore >= 0.4) overallStatus = "in-progress";
      else overallStatus = "unstarted";

      // Rasjonale
      const rationaleParts: string[] = [];
      const readyPhases = (["pre", "live", "post"] as const).filter((p) => phases[p].status === "ready");
      if (readyPhases.length > 0) {
        rationaleParts.push(`${readyPhases.length}/3 faser ferdig (${readyPhases.join(", ")})`);
      }
      if (allBlockers.length > 0) {
        rationaleParts.push(`${allBlockers.length} major-issue${allBlockers.length === 1 ? "" : "s"} må fikses`);
      }
      const unstarted = (["pre", "live", "post"] as const).filter((p) => phases[p].status === "unstarted");
      if (unstarted.length > 0) {
        rationaleParts.push(`${unstarted.join(", ")} ikke startet ennå`);
      }
      const rationale = rationaleParts.length > 0
        ? rationaleParts.join(". ") + "."
        : "Ingen AI-analyse kjørt for scenen ennå.";

      // Next-actions: konkrete suggesterte steg
      const nextActions: string[] = [];
      if (phases.pre.status === "unstarted") {
        nextActions.push("Kjør breakdown-agent for å detektere produksjons-elementer");
      }
      if (phases.pre.status === "in-progress" && phases.pre.pendingCount > 0) {
        nextActions.push(`Review ${phases.pre.pendingCount} pre-prod-forslag`);
      }
      if (phases.live.status === "unstarted" && phases.pre.status === "ready") {
        nextActions.push("Last opp takes for live-set-fasen");
      }
      if (phases.live.blockers.length > 0) {
        nextActions.push(`Fix coverage-issues før post (${phases.live.blockers.length} blockers)`);
      }
      if (phases.post.status === "unstarted" && phases.live.status === "ready") {
        nextActions.push("Generér rough-cut + post-prod-forslag");
      }

      const payload: ReadinessPayload = {
        sceneId: agentInput.sceneId,
        phases,
        readyScore,
        overallStatus,
        rationale,
        blockers: allBlockers,
        nextActions: nextActions.length > 0 ? nextActions : undefined,
      };

      // Aggregator suggestions har høy confidence — de er observation, ikke proposal
      return [{
        suggestionType: SUGGESTION_TYPE_READINESS,
        payload,
        confidence: 1.0,
        sourceType: "scene",
        sourceId: agentInput.sceneId,
      }];
    },
  };
}

// Applier: lagrer report i casting_scenes.metadata.readiness for hurtig lookup
export const sceneReadinessApplier: SuggestionApplier<ReadinessPayload> = {
  suggestionType: SUGGESTION_TYPE_READINESS,

  async apply(
    suggestion: AISuggestion<ReadinessPayload>,
    ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    const { client } = ctx;
    const { payload } = suggestion;

    await client.query(
      `UPDATE casting_scenes
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         '{readiness}',
         $1::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify({
          phases: payload.phases,
          readyScore: payload.readyScore,
          overallStatus: payload.overallStatus,
          blockers: payload.blockers,
          generatedAt: new Date().toISOString(),
          sourceSuggestionId: suggestion.id,
        }),
        payload.sceneId,
      ],
    );

    return {
      sceneId: payload.sceneId,
      overallStatus: payload.overallStatus,
      readyScore: payload.readyScore,
    };
  },
};
