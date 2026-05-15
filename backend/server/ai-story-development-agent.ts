/**
 * ai-story-development-agent.ts
 *
 * Sjette agent på AI Suggestion System-substratet. Genererer tre
 * forskjellige story-utviklings-artefakter fra samme manuskript-input:
 *
 *   1. story.logline    — én-setnings pitch (m/ alternativer)
 *   2. story.synopsis   — paragraf-sammendrag (~150-300 ord)
 *   3. story.beat-outline — strukturplan for skrivefasen
 *
 * Pipeline:
 *   alle scener → Claude (cross-scene synthesis) → 3 separate suggestions
 *   med samme sourceType='project'.
 *
 * Forskjell fra andre agenter:
 *   - Returnerer 3 ulike suggestion_types fra ÉN Claude-call. Den eneste
 *     agenten som gjør det — fordi de tre artefaktene er tett knyttet
 *     (synopsis er logline utvidet, beat-outline er strukturen som logline
 *     peker mot). Én call sparer ~3x cost og holder dem koherente.
 *   - Ingen materialiserende applier — disse artefaktene er forfatter-
 *     verktøy, ikke produksjons-data. No-op applier registrerer bare
 *     audit-trail.
 *
 * Arkitekturreferanse:
 *   frontend/client/src/components/role-room/ai-suggestion-architecture.md §12
 */

import type {
  AIAgent,
  AIAgentInput,
  AIAgentOutput,
  AISuggestion,
  ApplyContext,
  SuggestionApplier,
} from "./ai-suggestion-service.js";

const SUGGESTION_TYPE_LOGLINE = "story.logline";
const SUGGESTION_TYPE_SYNOPSIS = "story.synopsis";
const SUGGESTION_TYPE_BEAT_OUTLINE = "story.beat-outline";
const MODEL_VERSION = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

type ProjectFormat =
  | "kortfilm"
  | "reklame-30s"
  | "reklame-60s"
  | "musikkvideo"
  | "spillefilm";

interface StoryDevelopmentAgentInput {
  scenes: Array<{
    id: string;
    sceneNumber?: string | number;
    sceneText: string;
    sceneHeading?: string;
  }>;
  format?: ProjectFormat | string;
}

interface LoglinePayload {
  logline: string;
  alternatives?: string[];
}

interface SynopsisPayload {
  synopsis: string;
  wordCount?: number;
  genres?: string[];
}

interface BeatOutlinePayload {
  format: string;
  beats: Array<{ beatName: string; sceneIntent: string }>;
}

const STORY_DEV_TOOL_SCHEMA = {
  name: "record_story_development",
  description:
    "Produsér logline, synopsis og beat-outline fra manuskriptet. Hver av " +
    "de tre artefaktene returneres separat med egen confidence.",
  input_schema: {
    type: "object",
    properties: {
      logline: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "ÉN setning som fanger protagonist + dilemma + stake. Maks 35 ord.",
          },
          alternatives: {
            type: "array",
            items: { type: "string" },
            description:
              "0-2 alternative formuleringer hvis den primære har trade-offs.",
          },
          confidence: { type: "number" },
        },
        required: ["text", "confidence"],
      },
      synopsis: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "150-300 ord paragraf-sammendrag. Skal fungere som første-side i " +
              "et finansierings-pitch — slutt med hva som står på spill.",
          },
          genres: {
            type: "array",
            items: { type: "string" },
            description: "1-3 sjanger-tags som synopsis impliserer.",
          },
          confidence: { type: "number" },
        },
        required: ["text", "confidence"],
      },
      beatOutline: {
        type: "object",
        properties: {
          format: {
            type: "string",
            description:
              "Foreslått format basert på lengde/struktur: 'kortfilm', " +
              "'reklame-30s', 'spillefilm', etc.",
          },
          beats: {
            type: "array",
            minItems: 3,
            maxItems: 15,
            items: {
              type: "object",
              properties: {
                beatName: {
                  type: "string",
                  description:
                    "Beat-navn fra valgte struktur (Save the Cat / hero's " +
                    "journey / 3-act), f.eks. 'Opening Image', 'Inciting Incident'.",
                },
                sceneIntent: {
                  type: "string",
                  description: "1-2 setninger om hva beaten oppnår i handlingen.",
                },
              },
              required: ["beatName", "sceneIntent"],
            },
          },
          confidence: { type: "number" },
        },
        required: ["format", "beats", "confidence"],
      },
    },
    required: ["logline", "synopsis", "beatOutline"],
  },
} as const;

interface StoryDevToolInput {
  logline: { text: string; alternatives?: string[]; confidence: number };
  synopsis: { text: string; genres?: string[]; confidence: number };
  beatOutline: {
    format: string;
    beats: Array<{ beatName: string; sceneIntent: string }>;
    confidence: number;
  };
}

function buildSystemPrompt(): string {
  return [
    "Du er en erfaren norsk dramaturg/produsent som leser manus og leverer",
    "tre story-utviklings-artefakter: logline, synopsis og beat-outline.",
    "Du fyller ut record_story_development-verktøyet — aldri prosa.",
    "",
    "Logline:",
    "  - ÉN setning, maks 35 ord",
    "  - Strukturen: [protagonist] som [unik egenskap/situasjon] må [mål] før [stake]",
    "  - Unngå sjanger-klisjéer som 'epic journey' eller 'unlikely hero'",
    "  - Inkluder 0-2 alternativer KUN hvis du ser tydelige trade-offs",
    "",
    "Synopsis:",
    "  - 150-300 ord",
    "  - 1-3 paragrafer som dekker: setup, eskalering, klimaks-spørsmål",
    "  - Slutt med hva som står på spill, ikke avsluttende svar",
    "  - Sjangerne du tagger må reflektere manus, ikke ambisjon",
    "",
    "Beat-outline:",
    "  - Velg riktig struktur basert på manus:",
    "    • Kort/reklame: 3-5 beats (setup → vri → resolution)",
    "    • Spillefilm: 8-15 beats (Save the Cat eller hero's journey)",
    "    • Musikkvideo: 3-7 beats per visual-arc",
    "  - beatName skal være anerkjente beat-konvensjoner",
    "  - sceneIntent fokuserer på FUNKSJON ('etablerer hovedperson som...'),",
    "    ikke beskrivelse ('hovedpersonen går inn i bygget')",
    "",
    "Confidence settes per artefakt — synopsis kan være sikrere enn",
    "beat-outline hvis strukturen er uklar.",
  ].join("\n");
}

function buildUserPrompt(input: StoryDevelopmentAgentInput): string {
  const scenes = input.scenes
    .map((s) => {
      const header = `### Scene ${s.sceneNumber ?? "?"}${s.sceneHeading ? ` — ${s.sceneHeading}` : ""}`;
      return `${header}\n${s.sceneText.trim()}`;
    })
    .join("\n\n");

  return [
    input.format ? `Foreslått format: ${input.format}` : "",
    "Manuskript (alle scener):",
    "",
    scenes,
    "",
    "Kall record_story_development nå.",
  ].filter(Boolean).join("\n");
}

function clampConfidence(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const storyDevelopmentAgent: AIAgent = {
  name: "story-development-agent",
  modelVersion: MODEL_VERSION,

  async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
    if (input.sourceType !== "project") return [];

    const agentInput = input.payload as StoryDevelopmentAgentInput | undefined;
    if (!agentInput?.scenes || agentInput.scenes.length === 0) return [];

    const scenesWithText = agentInput.scenes.filter((s) => s.sceneText?.trim());
    if (scenesWithText.length === 0) return [];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("[story-development-agent] ANTHROPIC_API_KEY mangler — hopper over");
      return [];
    }

    let toolInput: StoryDevToolInput;
    try {
      const mod: any = await import("@anthropic-ai/sdk");
      const AnthropicCtor = mod.default ?? mod.Anthropic;
      const client: any = new AnthropicCtor({
        apiKey,
        maxRetries: 1,
        timeout: 120_000,
      });

      const response = await client.messages.create({
        model: MODEL_VERSION,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: "text",
            text: buildSystemPrompt(),
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [STORY_DEV_TOOL_SCHEMA],
        tool_choice: { type: "tool", name: STORY_DEV_TOOL_SCHEMA.name },
        messages: [{
          role: "user",
          content: buildUserPrompt({
            ...agentInput,
            scenes: scenesWithText,
          }),
        }],
      });

      const toolBlock = (response.content ?? []).find(
        (b: any) => b?.type === "tool_use" && b?.name === STORY_DEV_TOOL_SCHEMA.name,
      );

      if (!toolBlock || typeof toolBlock.input !== "object") {
        console.warn("[story-development-agent] Claude returnerte ikke tool_use-blokk");
        return [];
      }

      toolInput = toolBlock.input as StoryDevToolInput;
    } catch (err) {
      console.error("[story-development-agent] Claude-kall feilet:", err);
      return [];
    }

    const outputs: AIAgentOutput[] = [];

    // Logline
    if (toolInput.logline?.text) {
      const conf = clampConfidence(toolInput.logline.confidence);
      if (conf >= 0.5) {
        const payload: LoglinePayload = {
          logline: toolInput.logline.text.trim(),
          alternatives: Array.isArray(toolInput.logline.alternatives)
            ? toolInput.logline.alternatives.filter((a) => typeof a === "string" && a.trim())
            : undefined,
        };
        outputs.push({
          suggestionType: SUGGESTION_TYPE_LOGLINE,
          payload,
          confidence: conf,
          sourceType: "project",
          sourceId: input.projectId,
        });
      }
    }

    // Synopsis
    if (toolInput.synopsis?.text) {
      const conf = clampConfidence(toolInput.synopsis.confidence);
      if (conf >= 0.5) {
        const payload: SynopsisPayload = {
          synopsis: toolInput.synopsis.text.trim(),
          wordCount: wordCount(toolInput.synopsis.text),
          genres: Array.isArray(toolInput.synopsis.genres)
            ? toolInput.synopsis.genres.filter((g) => typeof g === "string" && g.trim())
            : undefined,
        };
        outputs.push({
          suggestionType: SUGGESTION_TYPE_SYNOPSIS,
          payload,
          confidence: conf,
          sourceType: "project",
          sourceId: input.projectId,
        });
      }
    }

    // Beat-outline
    if (toolInput.beatOutline?.beats && Array.isArray(toolInput.beatOutline.beats)) {
      const conf = clampConfidence(toolInput.beatOutline.confidence);
      const validBeats = toolInput.beatOutline.beats.filter(
        (b) => b?.beatName && b?.sceneIntent,
      );
      if (conf >= 0.5 && validBeats.length >= 3) {
        const payload: BeatOutlinePayload = {
          format: toolInput.beatOutline.format ?? "kortfilm",
          beats: validBeats,
        };
        outputs.push({
          suggestionType: SUGGESTION_TYPE_BEAT_OUTLINE,
          payload,
          confidence: conf,
          sourceType: "project",
          sourceId: input.projectId,
        });
      }
    }

    return outputs;
  },
};

// ─────────────────────────────────────────────────────────────────────
// Appliers — lagrer på casting_projects.metadata.storyDevelopment
// ─────────────────────────────────────────────────────────────────────
// Story-utviklings-artefakter er forfatter-verktøy, ikke produksjons-data.
// Vi lagrer dem på prosjekt-nivå så de er tilgjengelige for pitch-eksport,
// finansierings-skjemaer, etc.

async function applyToProjectMetadata(
  ctx: ApplyContext,
  projectId: string,
  key: string,
  value: unknown,
): Promise<void> {
  const { client } = ctx;
  await client.query(
    `UPDATE casting_projects
     SET metadata = jsonb_set(
       COALESCE(metadata, '{}'::jsonb),
       $1::text[],
       $2::jsonb,
       true
     ),
     updated_at = NOW()
     WHERE id = $3`,
    [`{storyDevelopment,${key}}`, JSON.stringify(value), projectId],
  );
}

export const storyLoglineApplier: SuggestionApplier<LoglinePayload> = {
  suggestionType: SUGGESTION_TYPE_LOGLINE,
  async apply(suggestion, ctx) {
    await applyToProjectMetadata(ctx, suggestion.projectId, "logline", {
      text: suggestion.payload.logline,
      alternatives: suggestion.payload.alternatives ?? null,
      sourceSuggestionId: suggestion.id,
    });
    return { projectId: suggestion.projectId, type: "logline" };
  },
};

export const storySynopsisApplier: SuggestionApplier<SynopsisPayload> = {
  suggestionType: SUGGESTION_TYPE_SYNOPSIS,
  async apply(suggestion, ctx) {
    await applyToProjectMetadata(ctx, suggestion.projectId, "synopsis", {
      text: suggestion.payload.synopsis,
      wordCount: suggestion.payload.wordCount ?? null,
      genres: suggestion.payload.genres ?? null,
      sourceSuggestionId: suggestion.id,
    });
    return { projectId: suggestion.projectId, type: "synopsis" };
  },
};

export const storyBeatOutlineApplier: SuggestionApplier<BeatOutlinePayload> = {
  suggestionType: SUGGESTION_TYPE_BEAT_OUTLINE,
  async apply(suggestion, ctx) {
    await applyToProjectMetadata(ctx, suggestion.projectId, "beatOutline", {
      format: suggestion.payload.format,
      beats: suggestion.payload.beats,
      sourceSuggestionId: suggestion.id,
    });
    return {
      projectId: suggestion.projectId,
      type: "beatOutline",
      beatCount: suggestion.payload.beats.length,
    };
  },
};
