/**
 * ai-sfx-suggestion-agent.ts
 *
 * Fase D sound-design-agent. Foreslår SFX-liste basert på scenetekst +
 * breakdown-props/locations. Brukes av sound designer for å bygge
 * cue-list mot opptaks-/wrap-day.
 *
 * Pipeline:
 *   scene_id → scenetekst + intExt + props (fra breakdown) →
 *   Claude med tool_use → 'post.sfx-suggestion'-payload
 *
 * Designvalg:
 *   - Tar valgfri props/locations som kontekst — hvis ikke gitt, leser
 *     vi det fra casting_scenes.production_breakdown (akkumulert av
 *     breakdown-agent)
 *   - Kategorier matcher standard sound-design-taksonomi
 *   - Importance: critical/enhances/optional så sound designer kan
 *     prioritere når budget er begrenset
 *   - Timestamps når SFX skal trigge (hvis scenen har transcript-timing)
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

const SUGGESTION_TYPE_SFX = "post.sfx-suggestion";
const MODEL_VERSION = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;

interface SfxAgentInput {
  sceneId: string;
  sceneText: string;
  sceneHeading?: string;
  intExt?: string;
  /** Eksisterende props fra breakdown (valgfri) */
  props?: string[];
  /** Eksisterende locations (valgfri) */
  locations?: string[];
}

type SfxCategory =
  | "footsteps"
  | "doors"
  | "ambience"
  | "foley"
  | "impact"
  | "wildtrack"
  | "designed";

type SfxImportance = "critical" | "enhances" | "optional";

interface SfxItem {
  category: SfxCategory | string;
  description: string;
  timestampSec?: number;
  importance: SfxImportance;
}

interface SfxPayload {
  sceneId: string;
  sfxItems: SfxItem[];
  vibe?: string;
  rationale?: string;
}

const SFX_TOOL_SCHEMA = {
  name: "suggest_sfx_list",
  description:
    "List opp SFX som scenen trenger. Vær konkret og handlingsbar — " +
    "'fottrinn på treplanker' > 'fottrinn'. Spar 'designed' for syntetiske " +
    "lyder som ikke kan optas naturlig.",
  input_schema: {
    type: "object",
    properties: {
      sfxItems: {
        type: "array",
        minItems: 1,
        maxItems: 30,
        items: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["footsteps", "doors", "ambience", "foley", "impact", "wildtrack", "designed"],
              description:
                "footsteps=skritt; doors=dører/vinduer/skap; " +
                "ambience=romklang/bakgrunn; foley=håndteringslyder; " +
                "impact=slag/kollisjon; wildtrack=rom-tone-opptak på set; " +
                "designed=syntetisk/composed (whoosh, sci-fi)",
            },
            description: {
              type: "string",
              description: "Konkret beskrivelse: 'tung dør lukkes', 'kaffekopp på keramikkbord'.",
            },
            timestampSec: {
              type: "number",
              description: "Tidspunkt i scenen hvis spesifikt (sekunder). Utelat for ambience/wildtrack.",
            },
            importance: {
              type: "string",
              enum: ["critical", "enhances", "optional"],
              description:
                "critical=scenen funker ikke uten; enhances=tydelig forbedring; " +
                "optional=fint-å-ha hvis budget tillater.",
            },
          },
          required: ["category", "description", "importance"],
        },
      },
      vibe: {
        type: "string",
        description: "1 setning som beskriver overall sound-design-vibe (f.eks. 'naturalistisk', 'designed/sci-fi', 'minimalistisk').",
      },
      rationale: {
        type: "string",
        description: "1-2 setninger om valg-strategien.",
      },
      confidence: { type: "number" },
    },
    required: ["sfxItems", "confidence"],
  },
} as const;

interface SfxToolInput {
  sfxItems: SfxItem[];
  vibe?: string;
  rationale?: string;
  confidence: number;
}

function buildSystemPrompt(): string {
  return [
    "Du er en erfaren norsk sound designer som leser scenetekst og lager",
    "SFX-cue-list. Du fyller ut suggest_sfx_list-verktøyet — aldri prosa.",
    "",
    "Prinsipper:",
    "  - Konkret over generisk. 'fottrinn på løvhaug' > 'fottrinn'.",
    "  - Inkluder critical SFX FØR enhances/optional. En typisk dialog-scene",
    "    trenger kanskje 3-5 critical + 5-10 enhances/optional.",
    "  - Ambience er ALLTID critical hvis det er ute eller i levende rom",
    "    (kafé, gate, skog). Indoor/quiet kan klare seg uten dedikert ambience.",
    "  - Wildtrack-cue per scene — minst én entry for å minne om rom-tone-opptak.",
    "  - Designed SFX kun for syntetiske ting som ikke kan optas (sci-fi pulser,",
    "    musikalske stings). Ikke kall vanlige real-world-lyder for designed.",
    "  - Timestamps kun hvis du har dialog-timing fra transcript. Ellers utelat.",
    "  - Norske scener: vurder norske spesifika (skiløype, fjordvann, vinterregn,",
    "    knirkende tregolv) når relevant — ikke tving inn.",
    "",
    "Importance-thresholds:",
    "  critical:  scenen funker IKKE uten (dialog er meningsløs uten dør-lyd",
    "            som markerer entry, action-shot uten impact er flat)",
    "  enhances:  tydelig løft hvis det er der",
    "  optional:  fint-å-ha, kan droppes uten å skade scenen",
  ].join("\n");
}

function buildUserPrompt(input: SfxAgentInput, transcriptText?: string): string {
  return [
    input.sceneHeading ? `Scene-heading: ${input.sceneHeading}` : "",
    input.intExt ? `Setting: ${input.intExt}` : "",
    input.props && input.props.length > 0 ? `Props i scenen: ${input.props.join(", ")}` : "",
    input.locations && input.locations.length > 0 ? `Lokasjoner: ${input.locations.join(", ")}` : "",
    "",
    "Scene-tekst:",
    "---",
    input.sceneText,
    "---",
    transcriptText ? "\nDialog-transcript (for timing):\n" + transcriptText : "",
    "",
    "Kall suggest_sfx_list nå.",
  ].filter(Boolean).join("\n");
}

function clampConfidence(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

export function createSfxSuggestionAgent(pool: Pool): AIAgent {
  return {
    name: "sfx-suggestion-agent",
    modelVersion: MODEL_VERSION,

    async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
      if (input.sourceType !== "scene") return [];

      const agentInput = input.payload as SfxAgentInput | undefined;
      if (!agentInput?.sceneText?.trim()) return [];

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.warn("[sfx-agent] ANTHROPIC_API_KEY mangler");
        return [];
      }

      // Auto-load props fra production_breakdown hvis ikke gitt
      let props = agentInput.props;
      let locations = agentInput.locations;
      if (!props || !locations) {
        try {
          const r = await pool.query<{ production_breakdown: unknown }>(
            `SELECT production_breakdown FROM casting_scenes WHERE id = $1`,
            [agentInput.sceneId],
          );
          const breakdown = r.rows[0]?.production_breakdown as Record<string, unknown> | undefined;
          if (breakdown && !props) {
            const propsArr = Array.isArray(breakdown.props) ? breakdown.props : [];
            props = propsArr
              .map((p) => (typeof p === "object" && p !== null ? (p as Record<string, unknown>).name : null))
              .filter((n): n is string => typeof n === "string");
          }
          if (breakdown && !locations) {
            const locArr = Array.isArray(breakdown.locations) ? breakdown.locations : [];
            locations = locArr
              .map((l) => (typeof l === "object" && l !== null ? (l as Record<string, unknown>).name : null))
              .filter((n): n is string => typeof n === "string");
          }
        } catch (err) {
          console.warn("[sfx-agent] breakdown-load feilet:", err);
        }
      }

      // Optional: suppler med transcript-timing fra best-take
      let transcriptText: string | undefined;
      try {
        const allTakes = await listTakesForScene(pool, agentInput.sceneId);
        const analyzed = allTakes.filter((t) => t.processingStatus === "analyzed");
        if (analyzed.length > 0) {
          const analyses = await listAnalysesForTakes(pool, analyzed.map((t) => t.id));
          const circledId = analyzed.find((t) => t.markedCircled)?.id;
          const bestAnalysis = circledId
            ? analyses.find((a) => a.takeId === circledId)
            : analyses.sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))[0];
          if (bestAnalysis?.audioAnalysis?.transcript) {
            transcriptText = bestAnalysis.audioAnalysis.transcript
              .slice(0, 20) // begrenset for prompt-størrelse
              .map((s) => `[${s.start.toFixed(1)}s] ${s.text}`)
              .join("\n");
          }
        }
      } catch {
        // ignore — transcript er valgfri
      }

      let toolInput: SfxToolInput;
      try {
        const mod: any = await import("@anthropic-ai/sdk");
        const AnthropicCtor = mod.default ?? mod.Anthropic;
        const claude: any = new AnthropicCtor({ apiKey, maxRetries: 1, timeout: 45_000 });

        const response = await claude.messages.create({
          model: MODEL_VERSION,
          max_tokens: MAX_TOKENS,
          system: [
            { type: "text", text: buildSystemPrompt(), cache_control: { type: "ephemeral" } },
          ],
          tools: [SFX_TOOL_SCHEMA],
          tool_choice: { type: "tool", name: SFX_TOOL_SCHEMA.name },
          messages: [{
            role: "user",
            content: buildUserPrompt(
              { ...agentInput, props, locations },
              transcriptText,
            ),
          }],
        });

        const tb = (response.content ?? []).find(
          (b: any) => b?.type === "tool_use" && b?.name === SFX_TOOL_SCHEMA.name,
        );
        if (!tb || typeof tb.input !== "object") return [];
        toolInput = tb.input as SfxToolInput;
      } catch (err) {
        console.error("[sfx-agent] Claude-kall feilet:", err);
        return [];
      }

      const confidence = clampConfidence(toolInput.confidence);
      if (confidence < 0.5) return [];
      const items = Array.isArray(toolInput.sfxItems)
        ? toolInput.sfxItems.filter(
            (i): i is SfxItem =>
              i != null &&
              typeof i.description === "string" &&
              typeof i.category === "string" &&
              ["critical", "enhances", "optional"].includes(i.importance as string),
          )
        : [];
      if (items.length === 0) return [];

      const payload: SfxPayload = {
        sceneId: agentInput.sceneId,
        sfxItems: items,
        vibe: typeof toolInput.vibe === "string" ? toolInput.vibe : undefined,
        rationale: typeof toolInput.rationale === "string" ? toolInput.rationale : undefined,
      };

      return [{
        suggestionType: SUGGESTION_TYPE_SFX,
        payload,
        confidence,
        sourceType: "scene",
        sourceId: agentInput.sceneId,
      }];
    },
  };
}

// Applier: lagrer på casting_scenes.metadata.sfxCueList
export const sfxSuggestionApplier: SuggestionApplier<SfxPayload> = {
  suggestionType: SUGGESTION_TYPE_SFX,

  async apply(
    suggestion: AISuggestion<SfxPayload>,
    ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    const { client } = ctx;
    const { payload } = suggestion;

    await client.query(
      `UPDATE casting_scenes
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         '{sfxCueList}',
         $1::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify({
          items: payload.sfxItems,
          vibe: payload.vibe ?? null,
          rationale: payload.rationale ?? null,
          sourceSuggestionId: suggestion.id,
        }),
        payload.sceneId,
      ],
    );

    return {
      sceneId: payload.sceneId,
      itemCount: payload.sfxItems.length,
      criticalCount: payload.sfxItems.filter((i) => i.importance === "critical").length,
    };
  },
};
