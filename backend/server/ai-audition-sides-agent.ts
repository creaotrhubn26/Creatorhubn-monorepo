/**
 * ai-audition-sides-agent.ts
 *
 * Femte agent på AI Suggestion System-substratet. Gitt en rolle, plukker
 * scener fra manuskriptet som egner seg som audition-materiale.
 *
 * Pipeline:
 *   role + alle scener karakteren forekommer i → Claude (vurdér emosjonell
 *   spennvidde og kompleksitet) → 'casting.audition-sides'-suggestion →
 *   applier lagrer på casting_roles.requirements.auditionSides.
 *
 * Forskjell fra andre agenter:
 *   - sourceType: 'role' — første agent som kjører på rolle-nivå
 *   - Returnerer ÉN suggestion per rolle (hele sides-utvalget samlet)
 *   - Krever cross-scene-reasoning: må sammenligne scener for å plukke
 *     de mest spennvidde-rike.
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

const SUGGESTION_TYPE_AUDITION_SIDES = "casting.audition-sides";
const MODEL_VERSION = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;

interface AuditionSidesAgentInput {
  roleId: string;
  characterName: string;
  /** Scener karakteren forekommer i */
  scenes: Array<{
    id: string;
    sceneNumber?: string | number;
    sceneText: string;
    sceneHeading?: string;
  }>;
}

interface AuditionSidesPayload {
  roleId: string;
  characterName: string;
  excerptSceneIds: string[];
  rationalePerScene?: Record<string, string>;
  overallRationale?: string;
}

const AUDITION_SIDES_TOOL_SCHEMA = {
  name: "record_audition_sides",
  description:
    "Plukk 2-4 scener fra manuskriptet som best egner seg som audition-" +
    "materiale for denne rollen. Vurder emosjonell spennvidde, dialog-" +
    "kvalitet og kompleksitet i karakter-arbeidet.",
  input_schema: {
    type: "object",
    properties: {
      excerpts: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            sceneId: { type: "string", description: "ID fra scene-listen — ikke gjett." },
            rationale: {
              type: "string",
              description: "1-2 setninger om hvorfor denne scenen viser frem skuespillerens evner.",
            },
          },
          required: ["sceneId", "rationale"],
        },
      },
      overallRationale: {
        type: "string",
        description:
          "1-2 setninger om den overordnede valg-strategien — hva slags " +
          "skuespiller dette utvalget vil avsløre.",
      },
      confidence: { type: "number" },
    },
    required: ["excerpts", "confidence"],
  },
} as const;

interface AuditionSidesToolInput {
  excerpts: Array<{ sceneId: string; rationale: string }>;
  overallRationale?: string;
  confidence: number;
}

function buildSystemPrompt(): string {
  return [
    "Du er en erfaren norsk casting-direktør som leser manus og plukker",
    "audition-sides for en spesifikk rolle. Du fyller ut",
    "record_audition_sides-verktøyet — aldri prosa.",
    "",
    "Audition-sides-prinsipper:",
    "  1. Spennvidde over kvantitet — bedre med 3 emosjonelt ulike scener",
    "     enn 5 like.",
    "  2. Velg scener der KARAKTEREN gjør noe, ikke der den bare står til",
    "     stede. Replikker > beskrivelse.",
    "  3. Bland register: én komisk/lett scene, én emosjonell, én konfrontasjon",
    "     hvis tilgjengelig.",
    "  4. Unngå scener som krever for mye kontekst for å spille — audition",
    "     må fungere uten å lese hele manus.",
    "  5. Korte scener er ofte bedre — 1-2 sider er ideelt.",
    "",
    "Konfidens:",
    "  0.9+ = klare standout-scener med tydelig karakter-arbeid",
    "  0.7-0.89 = god men ikke åpenbar utvelgelse",
    "  0.5-0.69 = beste tilgjengelige fra et begrenset utvalg",
    "  Under 0.5 = ikke nok materiale (returnér tom array)",
  ].join("\n");
}

function buildUserPrompt(input: AuditionSidesAgentInput): string {
  const scenes = input.scenes
    .map((s) => {
      const header = `### Scene ${s.sceneNumber ?? "?"} (id: ${s.id})${s.sceneHeading ? ` — ${s.sceneHeading}` : ""}`;
      return `${header}\n${s.sceneText.trim()}`;
    })
    .join("\n\n");

  return [
    `Rolle: ${input.characterName}`,
    "",
    "Scener karakteren forekommer i:",
    "",
    scenes,
    "",
    "Kall record_audition_sides nå.",
  ].join("\n");
}

function clampConfidence(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export const auditionSidesAgent: AIAgent = {
  name: "audition-sides-agent",
  modelVersion: MODEL_VERSION,

  async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
    if (input.sourceType !== "role") return [];

    const agentInput = input.payload as AuditionSidesAgentInput | undefined;
    if (!agentInput?.scenes || agentInput.scenes.length === 0) return [];

    const scenesWithText = agentInput.scenes.filter((s) => s.sceneText?.trim());
    if (scenesWithText.length === 0) return [];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("[audition-sides-agent] ANTHROPIC_API_KEY mangler — hopper over");
      return [];
    }

    let toolInput: AuditionSidesToolInput;
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
        tools: [AUDITION_SIDES_TOOL_SCHEMA],
        tool_choice: { type: "tool", name: AUDITION_SIDES_TOOL_SCHEMA.name },
        messages: [{
          role: "user",
          content: buildUserPrompt({
            ...agentInput,
            scenes: scenesWithText,
          }),
        }],
      });

      const toolBlock = (response.content ?? []).find(
        (b: any) => b?.type === "tool_use" && b?.name === AUDITION_SIDES_TOOL_SCHEMA.name,
      );

      if (!toolBlock || typeof toolBlock.input !== "object") {
        console.warn("[audition-sides-agent] Claude returnerte ikke tool_use-blokk");
        return [];
      }

      toolInput = toolBlock.input as AuditionSidesToolInput;
    } catch (err) {
      console.error("[audition-sides-agent] Claude-kall feilet:", err);
      return [];
    }

    if (!Array.isArray(toolInput.excerpts) || toolInput.excerpts.length === 0) {
      return [];
    }

    const confidence = clampConfidence(toolInput.confidence);
    if (confidence < 0.5) return [];

    // Bygg payload med excerpt-IDer + rationale-map
    const rationalePerScene: Record<string, string> = {};
    const excerptSceneIds: string[] = [];
    for (const excerpt of toolInput.excerpts) {
      if (!excerpt?.sceneId || !excerpt?.rationale) continue;
      excerptSceneIds.push(excerpt.sceneId);
      rationalePerScene[excerpt.sceneId] = excerpt.rationale;
    }

    if (excerptSceneIds.length === 0) return [];

    const payload: AuditionSidesPayload = {
      roleId: agentInput.roleId,
      characterName: agentInput.characterName,
      excerptSceneIds,
      rationalePerScene,
      overallRationale: toolInput.overallRationale,
    };

    return [{
      suggestionType: SUGGESTION_TYPE_AUDITION_SIDES,
      payload,
      confidence,
      sourceType: "role",
      sourceId: agentInput.roleId,
    }];
  },
};

// ─────────────────────────────────────────────────────────────────────
// Applier — lagrer på casting_roles.requirements.auditionSides
// ─────────────────────────────────────────────────────────────────────

export const auditionSidesApplier: SuggestionApplier<AuditionSidesPayload> = {
  suggestionType: SUGGESTION_TYPE_AUDITION_SIDES,

  async apply(
    suggestion: AISuggestion<AuditionSidesPayload>,
    ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    const { client } = ctx;
    const { payload } = suggestion;

    await client.query(
      `UPDATE casting_roles
       SET requirements = jsonb_set(
         COALESCE(requirements, '{}'::jsonb),
         '{auditionSides}',
         $1::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE id = $2 AND project_id = $3`,
      [
        JSON.stringify({
          sceneIds: payload.excerptSceneIds,
          rationalePerScene: payload.rationalePerScene ?? {},
          overallRationale: payload.overallRationale ?? null,
          sourceSuggestionId: suggestion.id,
        }),
        payload.roleId,
        suggestion.projectId,
      ],
    );

    return {
      roleId: payload.roleId,
      excerptCount: payload.excerptSceneIds.length,
    };
  },
};
