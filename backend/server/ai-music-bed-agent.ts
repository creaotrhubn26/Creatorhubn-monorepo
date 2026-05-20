/**
 * ai-music-bed-agent.ts
 *
 * Fase D sound-design-agent. Foreslår musikk-genre, mood, BPM,
 * instrumentering og referansespor basert på scenetekst + emosjonelle
 * beats. Brukes av composer/music-supervisor.
 *
 * Pipeline:
 *   scene_id → load scene-context + transcript (hvis tilgjengelig) →
 *   Claude med tool_use → 'post.music-bed-suggestion'-payload
 *
 * Designvalg:
 *   - Sone-input: scenetekst + intent/protagonist-goal (fra scene-metadata).
 *     Hvis takes er analysert, suppler med transcript + pacing-stats.
 *   - Genre + mood er chips — frontend kan filtrere/søke i music-library
 *   - References gir composer en startpunkt (Spotify-søkbart)
 *   - Ingen applier-materialisering — output er bare review-artifact
 *     for composer-workflow
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
import { logAIUsage } from './ai-usage-tracker.js';

const SUGGESTION_TYPE_MUSIC_BED = "post.music-bed-suggestion";
const MODEL_VERSION = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

interface MusicBedAgentInput {
  sceneId: string;
  sceneText: string;
  sceneHeading?: string;
  intExt?: string;
  timeOfDay?: string;
  sceneIntent?: string;
  protagonistGoal?: string;
}

interface MusicBedPayload {
  sceneId: string;
  genres: string[];
  moods: string[];
  bpmRange?: { min: number; max: number };
  key?: string;
  instrumentation?: string[];
  references?: string[];
  entryPointSec?: number;
  rationale?: string;
}

const MUSIC_BED_TOOL_SCHEMA = {
  name: "suggest_music_bed",
  description:
    "Foreslå musikk-bed for scenen: genre, mood, BPM, instrumentering, " +
    "referansespor og hvor i scenen musikken bør entre. Vær konkret og " +
    "uten klisjéer.",
  input_schema: {
    type: "object",
    properties: {
      genres: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 3,
        description: "Genre-tags i prioritert rekkefølge. Spesifikke (f.eks. 'neo-noir piano', 'icelandic post-rock').",
      },
      moods: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 4,
        description: "Mood-tags som beskriver emosjonell farge (f.eks. 'melancholic', 'tense buildup').",
      },
      bpmRange: {
        type: "object",
        properties: {
          min: { type: "number" },
          max: { type: "number" },
        },
        description: "BPM-område hvis tempo-spesifikt; utelat for fritt tempo.",
      },
      key: {
        type: "string",
        description: "Tonalitet (f.eks. 'D minor', 'modal/dorian'). Utelat hvis ikke kritisk.",
      },
      instrumentation: {
        type: "array",
        items: { type: "string" },
        description: "Instrumentering-hints (f.eks. 'solo piano', 'strings + ambient pad').",
      },
      references: {
        type: "array",
        items: { type: "string" },
        description: "1-3 referansespor på 'Artist - Track'-format. Bruk reelle, lett søkbare spor.",
      },
      entryPointSec: {
        type: "number",
        description: "Hvor i scenen musikken bør entre (sekunder fra scene-start). Utelat hvis hele scenen skal ha musikk.",
      },
      rationale: {
        type: "string",
        description: "1-2 setninger som forklarer valgene — knytt til scenens emosjonelle funksjon.",
      },
      confidence: { type: "number" },
    },
    required: ["genres", "moods", "confidence"],
  },
} as const;

interface MusicBedToolInput {
  genres: string[];
  moods: string[];
  bpmRange?: { min: number; max: number };
  key?: string;
  instrumentation?: string[];
  references?: string[];
  entryPointSec?: number;
  rationale?: string;
  confidence: number;
}

function buildSystemPrompt(): string {
  return [
    "Du er en erfaren norsk music supervisor som leser scenetekst og foreslår",
    "et musikk-bed. Du fyller ut suggest_music_bed-verktøyet — aldri prosa.",
    "",
    "Prinsipper:",
    "  - SPESIFIKT, ikke generisk. 'sad piano' er ubrukelig. 'sparse Nils",
    "    Frahm-aktig solo piano med tape-saturation' er handlingsbart.",
    "  - Genre = grunnsjikt. Mood = emosjonell farge. Begge bør være presise.",
    "  - BPM kun hvis tempo er kritisk for scenen. Slow burn-scener trenger",
    "    ikke BPM-binding.",
    "  - Referansespor: bruk REELLE artister/spor som lever i Spotify/Apple",
    "    Music. Maks 3 — sparsom liste er bedre enn lang. Spesielt nordisk",
    "    repertoar hvis relevant.",
    "  - EntryPointSec: når musikken bør entre. Hvis scenen åpner med",
    "    musikk, sett 0. Hvis musikken kommer på en spesifikk emosjonell",
    "    moment, angi sekunder. Utelat hvis ikke relevant.",
    "  - Rationale: knytt valgene til scenens funksjon. 'Solo piano fordi",
    "    introspektivt øyeblikk' > 'fordi scenen er trist'.",
    "  - Confidence: 0.9+ for klare scener med tydelig emosjon, 0.6-0.85",
    "    for nyanserte scener, under 0.5 = ikke nok kontekst (returnér tom).",
    "",
    "Norske spesifikasjoner:",
    "  - For norske produksjoner kan du foreslå norsk/nordisk repertoar",
    "    (Anna B Savage, Sigrid, Nils Frahm, Ólafur Arnalds, Susanne Sundfør,",
    "    Highasakite, etc.) når sjangeren passer.",
    "  - Ikke tving inn nordisk repertoar hvis scenen krever annet (f.eks.",
    "    sjokk-action eller funk).",
  ].join("\n");
}

function buildUserPrompt(input: MusicBedAgentInput, transcriptText?: string): string {
  return [
    input.sceneHeading ? `Scene-heading: ${input.sceneHeading}` : "",
    input.intExt ? `Setting: ${input.intExt}${input.timeOfDay ? " - " + input.timeOfDay : ""}` : "",
    input.sceneIntent ? `Scene-intent: ${input.sceneIntent}` : "",
    input.protagonistGoal ? `Protagonistens mål: ${input.protagonistGoal}` : "",
    "",
    "Scene-tekst:",
    "---",
    input.sceneText,
    "---",
    transcriptText ? "\nDialog-transcript fra take:\n" + transcriptText : "",
    "",
    "Kall suggest_music_bed nå.",
  ].filter(Boolean).join("\n");
}

function clampConfidence(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

export function createMusicBedAgent(pool: Pool): AIAgent {
  return {
    name: "music-bed-agent",
    modelVersion: MODEL_VERSION,

    async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
      if (input.sourceType !== "scene") return [];

      const agentInput = input.payload as MusicBedAgentInput | undefined;
      if (!agentInput?.sceneText?.trim()) return [];

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.warn("[music-bed-agent] ANTHROPIC_API_KEY mangler");
        return [];
      }

      // Suppler med transcript fra best-take hvis tilgjengelig
      let transcriptText: string | undefined;
      try {
        const allTakes = await listTakesForScene(pool, agentInput.sceneId);
        const analyzed = allTakes.filter((t) => t.processingStatus === "analyzed");
        if (analyzed.length > 0) {
          const analyses = await listAnalysesForTakes(pool, analyzed.map((t) => t.id));
          // Velg circled eller høyest-score
          const circledId = analyzed.find((t) => t.markedCircled)?.id;
          const bestAnalysis = circledId
            ? analyses.find((a) => a.takeId === circledId)
            : analyses.sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))[0];
          if (bestAnalysis?.audioAnalysis?.transcript) {
            transcriptText = bestAnalysis.audioAnalysis.transcript
              .map((s) => `[${s.start.toFixed(1)}s] ${s.text}`)
              .join("\n");
          }
        }
      } catch (err) {
        console.warn("[music-bed-agent] transcript-fetch feilet (fortsetter uten):", err);
      }

      let toolInput: MusicBedToolInput;
      try {
        const mod: any = await import("@anthropic-ai/sdk");
        const AnthropicCtor = mod.default ?? mod.Anthropic;
        const claude: any = new AnthropicCtor({ apiKey, maxRetries: 1, timeout: 30_000 });

        const response = await claude.messages.create({
          model: MODEL_VERSION,
          max_tokens: MAX_TOKENS,
          system: [
            {
              type: "text",
              text: buildSystemPrompt(),
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: [MUSIC_BED_TOOL_SCHEMA],
          tool_choice: { type: "tool", name: MUSIC_BED_TOOL_SCHEMA.name },
          messages: [{
            role: "user",
            content: buildUserPrompt(agentInput, transcriptText),
          }],
        });
        logAIUsage(response as any, { feature: 'role-room/music-bed' }).catch(() => undefined);

        const tb = (response.content ?? []).find(
          (b: any) => b?.type === "tool_use" && b?.name === MUSIC_BED_TOOL_SCHEMA.name,
        );
        if (!tb || typeof tb.input !== "object") return [];
        toolInput = tb.input as MusicBedToolInput;
      } catch (err) {
        console.error("[music-bed-agent] Claude-kall feilet:", err);
        return [];
      }

      const confidence = clampConfidence(toolInput.confidence);
      if (confidence < 0.5) return [];
      if (!Array.isArray(toolInput.genres) || toolInput.genres.length === 0) return [];

      const payload: MusicBedPayload = {
        sceneId: agentInput.sceneId,
        genres: toolInput.genres.filter((g) => typeof g === "string" && g.trim()),
        moods: Array.isArray(toolInput.moods)
          ? toolInput.moods.filter((m) => typeof m === "string" && m.trim())
          : [],
        bpmRange: toolInput.bpmRange && typeof toolInput.bpmRange.min === "number" && typeof toolInput.bpmRange.max === "number"
          ? toolInput.bpmRange
          : undefined,
        key: typeof toolInput.key === "string" ? toolInput.key : undefined,
        instrumentation: Array.isArray(toolInput.instrumentation)
          ? toolInput.instrumentation.filter((i) => typeof i === "string")
          : undefined,
        references: Array.isArray(toolInput.references)
          ? toolInput.references.filter((r) => typeof r === "string")
          : undefined,
        entryPointSec: typeof toolInput.entryPointSec === "number" ? toolInput.entryPointSec : undefined,
        rationale: typeof toolInput.rationale === "string" ? toolInput.rationale : undefined,
      };

      return [{
        suggestionType: SUGGESTION_TYPE_MUSIC_BED,
        payload,
        confidence,
        sourceType: "scene",
        sourceId: agentInput.sceneId,
      }];
    },
  };
}

// Applier: lagrer på casting_scenes.metadata.musicBed for composer-UI
export const musicBedApplier: SuggestionApplier<MusicBedPayload> = {
  suggestionType: SUGGESTION_TYPE_MUSIC_BED,

  async apply(
    suggestion: AISuggestion<MusicBedPayload>,
    ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    const { client } = ctx;
    const { payload } = suggestion;

    await client.query(
      `UPDATE casting_scenes
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         '{musicBed}',
         $1::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify({
          genres: payload.genres,
          moods: payload.moods,
          bpmRange: payload.bpmRange ?? null,
          key: payload.key ?? null,
          instrumentation: payload.instrumentation ?? null,
          references: payload.references ?? null,
          entryPointSec: payload.entryPointSec ?? null,
          rationale: payload.rationale ?? null,
          sourceSuggestionId: suggestion.id,
        }),
        payload.sceneId,
      ],
    );

    return {
      sceneId: payload.sceneId,
      genreCount: payload.genres.length,
      hasReferences: (payload.references?.length ?? 0) > 0,
    };
  },
};
