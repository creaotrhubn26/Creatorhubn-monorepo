/**
 * ai-shot-list-agent.ts
 *
 * Fjerde konkrete agent på AI Suggestion System-substratet. Foreslår
 * cinematic coverage per scene — wide/medium/close-up-shots med
 * beskrivelser av handling, varighet og lensvalg.
 *
 * Pipeline:
 *   scene-tekst + roller → Claude (decompose scene into shots) →
 *     'shot-list.draft'-suggestion → applier oppretter casting_shot_lists-
 *     rad ved accept.
 *
 * Forskjell fra de andre agentene:
 *   - Domene-spesifikk prompting: Claude må kjenne grunnleggende film-
 *     grammatikk (180-degree rule, eye-line match, coverage-prinsipper).
 *   - Returnerer kun ÉN suggestion per kjøring — hele shot-listen som
 *     én pakke. Forskjellig fra breakdown som returnerer mange små.
 *     Grunnen: en shot-list er et sammenhengende design-valg, ikke
 *     en samling uavhengige enheter.
 *
 * Arkitekturreferanse:
 *   frontend/client/src/components/role-room/ai-suggestion-architecture.md §12
 */

import crypto from "crypto";
import { logAIUsage } from './ai-usage-tracker.js';
import type {
  AIAgent,
  AIAgentInput,
  AIAgentOutput,
  AISuggestion,
  ApplyContext,
  SuggestionApplier,
} from "./ai-suggestion-service.js";

const SUGGESTION_TYPE_SHOT_LIST_DRAFT = "shot-list.draft";
const MODEL_VERSION = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

interface ShotListAgentInput {
  sceneText: string;
  sceneHeading?: string;
  intExt?: "INT" | "EXT" | "INT/EXT";
  characters?: string[];
}

interface ShotListShot {
  type:
    | "wide"
    | "medium"
    | "close"
    | "extreme-close-up"
    | "insert"
    | "over-shoulder"
    | "two-shot"
    | "establishing"
    | "cutaway";
  description: string;
  durationSec?: number;
  /** Hvilken karakter eller objekt er hovedfokus */
  subject?: string;
  /** Foreslått lens — f.eks. '35mm', '85mm', '24mm wide' */
  lens?: string;
  /** Kamerabevegelse — 'static', 'dolly-in', 'pan', 'handheld' */
  movement?: string;
}

interface ShotListDraftPayload {
  sceneId: string;
  shots: ShotListShot[];
  /** Begrunnelse for den overordnede dekningstilnærmingen */
  coverageRationale?: string;
}

const SHOT_LIST_TOOL_SCHEMA = {
  name: "record_shot_list",
  description:
    "Foreslå en cinematic shot-list for scenen. Inkluder mellom 3 og 15 " +
    "shots — kortere scener trenger færre. Sett ALLTID minst en establishing/" +
    "wide først hvis scenen ikke er et continuation. Følg coverage-prinsippet: " +
    "wide for sted, medium for handling, close for emosjon.",
  input_schema: {
    type: "object",
    properties: {
      shots: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "wide",
                "medium",
                "close",
                "extreme-close-up",
                "insert",
                "over-shoulder",
                "two-shot",
                "establishing",
                "cutaway",
              ],
            },
            description: {
              type: "string",
              description: "Kort beskrivelse av hva shotet viser og handler om. 1-2 setninger.",
            },
            subject: {
              type: "string",
              description: "Karakter eller objekt i fokus. Utelat for establishing/wide.",
            },
            lens: {
              type: "string",
              description: "Lens-anbefaling, f.eks. '35mm', '85mm portrait'. Valgfri.",
            },
            movement: {
              type: "string",
              description: "Kamerabevegelse: 'static', 'dolly-in', 'pan-right', 'handheld'. Valgfri.",
            },
            durationSec: {
              type: "number",
              description: "Estimert lengde i sekunder. Valgfri.",
            },
          },
          required: ["type", "description"],
        },
      },
      coverageRationale: {
        type: "string",
        description:
          "1-2 setninger som forklarer den overordnede dekningstilnærmingen — " +
          "hvorfor disse shotene, ikke andre.",
      },
      confidence: {
        type: "number",
        description: "Overall confidence for shot-listen som helhet. 0.0 til 1.0.",
      },
    },
    required: ["shots", "confidence"],
  },
} as const;

interface ShotListToolInput {
  shots: ShotListShot[];
  coverageRationale?: string;
  confidence: number;
}

function buildSystemPrompt(): string {
  return [
    "Du er en erfaren norsk filmfotograf som leser scenetekst og foreslår",
    "en cinematic shot-list. Du fyller ut record_shot_list-verktøyet med",
    "konkrete shots — aldri prosa.",
    "",
    "Prinsipper:",
    "  1. Coverage: wide for sted/kontekst, medium for handling, close for",
    "     emosjon. Få shots av hver type i hver scene.",
    "  2. Establishing først hvis scenen åpner et nytt sted (INT/EXT-hint i",
    "     scene-heading).",
    "  3. Skift POV trygt: bruk OTS-shots eller two-shots ved dialog.",
    "  4. Inserts kun når scenen krever det (close-up på objekt/handlen-",
    "     element). Ikke fyll opp med inserts uten grunn.",
    "  5. Cutaway brukes sparsomt — kun for reaction eller geografisk-",
    "     etablering.",
    "",
    "Lens- og movement-anbefalinger:",
    "  - Intime/emosjonelle scener: 85mm+ for komprimert dybde, statisk.",
    "  - Action: 24-35mm wide, handheld eller dolly.",
    "  - Etablering: 24-35mm, statisk eller slow pan.",
    "  - Insert: 50mm makro/normal, statisk.",
    "",
    "Skala:",
    "  - Kort scene (1-2 sider): 3-6 shots",
    "  - Medium scene (2-4 sider): 6-10 shots",
    "  - Lang scene (4+ sider): 10-15 shots",
    "",
    "Du foreslår — ikke beordrer. Skriv beskrivelsene som forslag til en",
    "regissør, ikke som directives.",
  ].join("\n");
}

function buildUserPrompt(input: ShotListAgentInput): string {
  const sceneHeader = input.sceneHeading
    ? `Scene-heading: ${input.sceneHeading}`
    : input.intExt
      ? `Setting: ${input.intExt}`
      : "";
  const characters = input.characters && input.characters.length > 0
    ? `Karakterer i scenen: ${input.characters.join(", ")}`
    : "";

  return [
    sceneHeader,
    characters,
    sceneHeader || characters ? "" : null,
    "Scene-tekst:",
    "---",
    input.sceneText,
    "---",
    "",
    "Kall record_shot_list nå.",
  ].filter((line) => line !== null).join("\n");
}

function clampConfidence(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export const shotListAgent: AIAgent = {
  name: "shot-list-agent",
  modelVersion: MODEL_VERSION,

  async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
    if (input.sourceType !== "scene") return [];

    const agentInput = input.payload as ShotListAgentInput | undefined;
    if (!agentInput?.sceneText?.trim()) return [];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("[shot-list-agent] ANTHROPIC_API_KEY mangler — hopper over");
      return [];
    }

    let toolInput: ShotListToolInput;
    try {
      const mod: any = await import("@anthropic-ai/sdk");
      const AnthropicCtor = mod.default ?? mod.Anthropic;
      const client: any = new AnthropicCtor({
        apiKey,
        maxRetries: 1,
        timeout: 60_000,
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
        tools: [SHOT_LIST_TOOL_SCHEMA],
        tool_choice: { type: "tool", name: SHOT_LIST_TOOL_SCHEMA.name },
        messages: [{
          role: "user",
          content: buildUserPrompt(agentInput),
        }],
      });
      logAIUsage(response as any, { feature: 'role-room/shot-list' }).catch(() => undefined);

      const toolBlock = (response.content ?? []).find(
        (b: any) => b?.type === "tool_use" && b?.name === SHOT_LIST_TOOL_SCHEMA.name,
      );

      if (!toolBlock || typeof toolBlock.input !== "object") {
        console.warn("[shot-list-agent] Claude returnerte ikke tool_use-blokk");
        return [];
      }

      toolInput = toolBlock.input as ShotListToolInput;
    } catch (err) {
      console.error("[shot-list-agent] Claude-kall feilet:", err);
      return [];
    }

    if (!Array.isArray(toolInput.shots) || toolInput.shots.length === 0) {
      return [];
    }

    const confidence = clampConfidence(toolInput.confidence);
    if (confidence < 0.5) return [];

    // Én suggestion per kjøring — hele shot-listen som ett objekt
    const payload: ShotListDraftPayload = {
      sceneId: input.sourceId,
      shots: toolInput.shots,
      coverageRationale: toolInput.coverageRationale,
    };

    return [{
      suggestionType: SUGGESTION_TYPE_SHOT_LIST_DRAFT,
      payload,
      confidence,
      sourceType: "scene",
      sourceId: input.sourceId,
    }];
  },
};

// ─────────────────────────────────────────────────────────────────────
// Applier — accept → casting_shot_lists-rad
// ─────────────────────────────────────────────────────────────────────

export const shotListDraftApplier: SuggestionApplier<ShotListDraftPayload> = {
  suggestionType: SUGGESTION_TYPE_SHOT_LIST_DRAFT,

  async apply(
    suggestion: AISuggestion<ShotListDraftPayload>,
    ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    const { client } = ctx;
    const { payload } = suggestion;

    // Idempotens: hvis en shot-list allerede finnes for denne scenen,
    // erstatt den (siste forslag vinner). Brukeren kan alltid avvise
    // forslaget hvis hun ikke vil overskrive eksisterende.
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM casting_shot_lists
       WHERE project_id = $1 AND scene_id = $2
       LIMIT 1`,
      [suggestion.projectId, payload.sceneId],
    );

    if (existing.rows.length > 0) {
      const shotListId = existing.rows[0].id;
      await client.query(
        `UPDATE casting_shot_lists
         SET shots = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(payload.shots), shotListId],
      );
      return {
        shotListId,
        replacedExisting: true,
        shotCount: payload.shots.length,
      };
    }

    const shotListId = crypto.randomUUID();
    await client.query(
      `INSERT INTO casting_shot_lists
         (id, project_id, scene_id, shots, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [
        shotListId,
        suggestion.projectId,
        payload.sceneId,
        JSON.stringify(payload.shots),
      ],
    );

    return {
      shotListId,
      sceneId: payload.sceneId,
      shotCount: payload.shots.length,
    };
  },
};
