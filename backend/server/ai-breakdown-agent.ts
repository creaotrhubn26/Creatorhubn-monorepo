/**
 * ai-breakdown-agent.ts
 *
 * Første konkrete agent + applier på AI Suggestion System-substratet.
 * Demonstrerer mønstret som alle senere agenter (casting-stub, idea-
 * structure, shot-list, coverage, editor) følger.
 *
 * Agenten leser scene-tekst + eksisterende roller/props/locations og
 * returnerer breakdown-forslag (props, locations, kostymer, VFX, risiko)
 * via Claude med tool_use for strukturert output. Hver kategori har en
 * dedikert applier som materialiserer aksepterte forslag.
 *
 * Arkitekturreferanse:
 *   frontend/client/src/components/role-room/ai-suggestion-architecture.md §12
 *
 * Migrasjonsnote: erstatter eventuelt eksisterende ad-hoc breakdown-logikk
 * i frontend (sceneNeedsService.ts) ved at frontend slutter å bestemme
 * breakdown og bare *konsumerer* forslag fra substratet.
 */

import crypto from "crypto";
import type {
  AIAgent,
  AIAgentInput,
  AIAgentOutput,
  AISuggestion,
  ApplyContext,
  SuggestionApplier,
} from "./ai-suggestion-service.js";

// ─────────────────────────────────────────────────────────────────────
// Suggestion-type-konstanter (speiler frontend/models/casting.ts)
// ─────────────────────────────────────────────────────────────────────

const SUGGESTION_TYPES = {
  PROP: "breakdown.prop",
  LOCATION: "breakdown.location",
  COSTUME: "breakdown.costume",
  VFX_FLAG: "breakdown.vfx-flag",
  RISK_FLAG: "breakdown.risk-flag",
} as const;

// ─────────────────────────────────────────────────────────────────────
// Payload-typer for denne agenten
// ─────────────────────────────────────────────────────────────────────

interface BreakdownPropPayload {
  name: string;
  existingPropId?: string;
  category?: string;
  quantity?: number;
  note?: string;
}

interface BreakdownLocationPayload {
  name: string;
  existingLocationId?: string;
  intExt?: "INT" | "EXT" | "INT/EXT";
  note?: string;
}

interface BreakdownCostumePayload {
  characterName: string;
  description: string;
  note?: string;
}

interface BreakdownRiskFlagPayload {
  riskType: string;
  description: string;
  recommendedAction?: string;
}

interface BreakdownVfxFlagPayload {
  description: string;
  complexity?: "low" | "medium" | "high";
  note?: string;
}

// Inputformat — det agenten forventer å motta
interface BreakdownAgentInput {
  sceneText: string;
  /** Eksisterende roller i prosjektet (for matching i stedet for duplicering) */
  existingRoles: Array<{ id: string; name: string }>;
  existingProps: Array<{ id: string; name: string }>;
  existingLocations: Array<{ id: string; name: string }>;
}

// ─────────────────────────────────────────────────────────────────────
// Agent — generate-fasen
// ─────────────────────────────────────────────────────────────────────

/**
 * Modellversjon er pinned per release. Når Claude oppgraderer, oppdater
 * dette og kjør modell-regresjon (se ai-suggestion-architecture.md §13).
 *
 * Vi bruker Sonnet 4.6 for breakdown — Opus' ekstra kapasitet gir lite for
 * deterministisk strukturert output, mens kostnaden er 5x.
 */
const MODEL_VERSION = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

// Tool-skjema for structured output. Hvert felt er en array — én tool-kall
// returnerer hele breakdown for én scene. Mappes til AIAgentOutput[] etter.
const BREAKDOWN_TOOL_SCHEMA = {
  name: "record_scene_breakdown",
  description:
    "Registrer alle production-elementer som finnes i scenen. " +
    "Returnér tomme arrays for kategorier som ikke finnes. Aldri foreslå " +
    "duplikater av eksisterende props/locations/roles — bruk ID-feltet i " +
    "stedet for å lage ny entry.",
  input_schema: {
    type: "object",
    properties: {
      props: {
        type: "array",
        description: "Fysiske rekvisitter karakterene håndterer i scenen.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Kort, presist navn (1-3 ord)." },
            existingPropId: {
              type: "string",
              description: "ID til eksisterende prop hvis dette er en match.",
            },
            category: { type: "string" },
            note: { type: "string" },
            confidence: { type: "number", description: "0.0 til 1.0" },
          },
          required: ["name", "confidence"],
        },
      },
      locations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            existingLocationId: { type: "string" },
            intExt: { type: "string", enum: ["INT", "EXT", "INT/EXT"] },
            note: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["name", "confidence"],
        },
      },
      costumes: {
        type: "array",
        description: "Kostymer/antrekk-detaljer som er eksplisitt nevnt eller " +
          "kreves av handlingen (uniform, bryllupskjole, etc).",
        items: {
          type: "object",
          properties: {
            characterName: { type: "string" },
            description: { type: "string" },
            note: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["characterName", "description", "confidence"],
        },
      },
      vfxFlags: {
        type: "array",
        description: "Visual effects-arbeid som kreves (eksplosjon, CGI-objekt, " +
          "wire-fjerning, etc).",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            complexity: { type: "string", enum: ["low", "medium", "high"] },
            note: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["description", "confidence"],
        },
      },
      riskFlags: {
        type: "array",
        description: "Sikkerhets-/juridiske risikoer som krever spesielle tiltak " +
          "(våpen, dyr, barn, stunts, høyder, åpen ild, etc).",
        items: {
          type: "object",
          properties: {
            riskType: { type: "string" },
            description: { type: "string" },
            recommendedAction: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["riskType", "description", "confidence"],
        },
      },
    },
    required: ["props", "locations", "costumes", "vfxFlags", "riskFlags"],
  },
} as const;

interface BreakdownToolInput {
  props: Array<{
    name: string;
    existingPropId?: string;
    category?: string;
    note?: string;
    confidence: number;
  }>;
  locations: Array<{
    name: string;
    existingLocationId?: string;
    intExt?: "INT" | "EXT" | "INT/EXT";
    note?: string;
    confidence: number;
  }>;
  costumes: Array<{
    characterName: string;
    description: string;
    note?: string;
    confidence: number;
  }>;
  vfxFlags: Array<{
    description: string;
    complexity?: "low" | "medium" | "high";
    note?: string;
    confidence: number;
  }>;
  riskFlags: Array<{
    riskType: string;
    description: string;
    recommendedAction?: string;
    confidence: number;
  }>;
}

function buildSystemPrompt(): string {
  return [
    "Du er en erfaren norsk produksjons-assistent som leser manus og ekstraherer",
    "alle production-elementer i en scene. Du fyller ut record_scene_breakdown-",
    "verktøyet med funn — aldri prosa, aldri forklaring.",
    "",
    "Regler:",
    "1. Eksisterende ressurser har høyest prioritet. Hvis scenen nevner noe som",
    "   matcher et navn i existing*-listene under, bruk ID-en — ikke foreslå",
    "   duplikat.",
    "2. Confidence reflekterer hvor sikkert elementet faktisk er i scenen:",
    "   0.95+ = eksplisitt nevnt eller eksisterende match",
    "   0.70-0.94 = implisert av handlingen",
    "   0.50-0.69 = mulig men usikkert",
    "   Under 0.5 = ikke ta med i det hele tatt.",
    "3. Vær sparsom med risikoer — kun det som faktisk krever sikkerhets-",
    "   ansvarlig, juridiske avklaringer, eller produksjons-spesielle tiltak.",
    "4. Kostymer: bare hvis spesifikt antrekk er nevnt eller kreves. Ikke",
    "   list 'klær' generisk.",
    "5. Returnér tomme arrays for kategorier som ikke finnes i scenen.",
  ].join("\n");
}

function buildUserPrompt(input: BreakdownAgentInput): string {
  const existingRoles = input.existingRoles.length > 0
    ? input.existingRoles.map((r) => `- ${r.name} (id: ${r.id})`).join("\n")
    : "(ingen)";
  const existingProps = input.existingProps.length > 0
    ? input.existingProps.map((p) => `- ${p.name} (id: ${p.id})`).join("\n")
    : "(ingen)";
  const existingLocations = input.existingLocations.length > 0
    ? input.existingLocations.map((l) => `- ${l.name} (id: ${l.id})`).join("\n")
    : "(ingen)";

  return [
    "Existing roller i prosjektet:",
    existingRoles,
    "",
    "Existing props i prosjektet:",
    existingProps,
    "",
    "Existing locations i prosjektet:",
    existingLocations,
    "",
    "Scene-tekst:",
    "---",
    input.sceneText,
    "---",
    "",
    "Kall record_scene_breakdown nå.",
  ].join("\n");
}

function clampConfidence(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toolInputToOutputs(
  toolInput: BreakdownToolInput,
  sourceId: string,
): AIAgentOutput[] {
  const outputs: AIAgentOutput[] = [];

  for (const prop of toolInput.props ?? []) {
    if (!prop?.name) continue;
    const confidence = clampConfidence(prop.confidence);
    if (confidence < 0.5) continue;
    const payload: BreakdownPropPayload = {
      name: prop.name,
      existingPropId: prop.existingPropId,
      category: prop.category,
      note: prop.note,
    };
    outputs.push({
      suggestionType: SUGGESTION_TYPES.PROP,
      payload,
      confidence,
      sourceType: "scene",
      sourceId,
    });
  }

  for (const loc of toolInput.locations ?? []) {
    if (!loc?.name) continue;
    const confidence = clampConfidence(loc.confidence);
    if (confidence < 0.5) continue;
    const payload: BreakdownLocationPayload = {
      name: loc.name,
      existingLocationId: loc.existingLocationId,
      intExt: loc.intExt,
      note: loc.note,
    };
    outputs.push({
      suggestionType: SUGGESTION_TYPES.LOCATION,
      payload,
      confidence,
      sourceType: "scene",
      sourceId,
    });
  }

  for (const c of toolInput.costumes ?? []) {
    if (!c?.characterName || !c?.description) continue;
    const confidence = clampConfidence(c.confidence);
    if (confidence < 0.5) continue;
    const payload: BreakdownCostumePayload = {
      characterName: c.characterName,
      description: c.description,
      note: c.note,
    };
    outputs.push({
      suggestionType: SUGGESTION_TYPES.COSTUME,
      payload,
      confidence,
      sourceType: "scene",
      sourceId,
    });
  }

  for (const v of toolInput.vfxFlags ?? []) {
    if (!v?.description) continue;
    const confidence = clampConfidence(v.confidence);
    if (confidence < 0.5) continue;
    const payload: BreakdownVfxFlagPayload = {
      description: v.description,
      complexity: v.complexity,
      note: v.note,
    };
    outputs.push({
      suggestionType: SUGGESTION_TYPES.VFX_FLAG,
      payload,
      confidence,
      sourceType: "scene",
      sourceId,
    });
  }

  for (const r of toolInput.riskFlags ?? []) {
    if (!r?.riskType || !r?.description) continue;
    const confidence = clampConfidence(r.confidence);
    if (confidence < 0.5) continue;
    const payload: BreakdownRiskFlagPayload = {
      riskType: r.riskType,
      description: r.description,
      recommendedAction: r.recommendedAction,
    };
    outputs.push({
      suggestionType: SUGGESTION_TYPES.RISK_FLAG,
      payload,
      confidence,
      sourceType: "scene",
      sourceId,
    });
  }

  return outputs;
}

export const breakdownAgent: AIAgent = {
  name: "breakdown-agent",
  modelVersion: MODEL_VERSION,

  async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
    if (input.sourceType !== "scene") {
      // Breakdown gir bare mening på scenes
      return [];
    }

    const breakdownInput = input.payload as BreakdownAgentInput | undefined;
    if (!breakdownInput?.sceneText?.trim()) {
      return [];
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Substratet skal være kjørbart uten Anthropic-key (i utvikling, tester).
      // Returnér tom liste i stedet for å feile — feil ville rullet tilbake
      // hele generate-transaksjonen og skjult andre feil.
      console.warn("[breakdown-agent] ANTHROPIC_API_KEY mangler — hopper over generering");
      return [];
    }

    let toolInput: BreakdownToolInput;
    try {
      const mod: any = await import("@anthropic-ai/sdk");
      const AnthropicCtor = mod.default ?? mod.Anthropic;
      const client: any = new AnthropicCtor({
        apiKey,
        maxRetries: 1,
        timeout: 30_000,
      });

      const response = await client.messages.create({
        model: MODEL_VERSION,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(),
        tools: [BREAKDOWN_TOOL_SCHEMA],
        tool_choice: { type: "tool", name: BREAKDOWN_TOOL_SCHEMA.name },
        messages: [{ role: "user", content: buildUserPrompt(breakdownInput) }],
      });

      const toolBlock = (response.content ?? []).find(
        (b: any) => b?.type === "tool_use" && b?.name === BREAKDOWN_TOOL_SCHEMA.name,
      );

      if (!toolBlock || typeof toolBlock.input !== "object") {
        console.warn("[breakdown-agent] Claude returnerte ikke tool_use-blokk");
        return [];
      }

      toolInput = toolBlock.input as BreakdownToolInput;
    } catch (err) {
      console.error("[breakdown-agent] Claude-kall feilet:", err);
      return [];
    }

    return toolInputToOutputs(toolInput, input.sourceId);
  },
};

// ─────────────────────────────────────────────────────────────────────
// Appliers — accept → hoveddata
// ─────────────────────────────────────────────────────────────────────
// Hver suggestion_type har sin egen applier. De kjører alle inne i samme
// transaksjon som accept-overgangen (se ai-suggestion-architecture.md
// AD-003) så feil → rollback til pending.

export const breakdownPropApplier: SuggestionApplier<BreakdownPropPayload> = {
  suggestionType: SUGGESTION_TYPES.PROP,

  async apply(
    suggestion: AISuggestion<BreakdownPropPayload>,
    ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    const { client } = ctx;
    const { payload } = suggestion;

    let propId = payload.existingPropId;

    // Hvis eksisterende prop er foreslått, bare link til scene
    if (!propId) {
      propId = crypto.randomUUID();
      await client.query(
        `INSERT INTO casting_props (id, project_id, name, category, quantity, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [
          propId,
          suggestion.projectId,
          payload.name,
          payload.category ?? null,
          payload.quantity ?? 1,
        ],
      );
    }

    // Append til scene.production_breakdown.props
    // (Bruker jsonb_set så vi ikke overskriver eksisterende breakdown-felt)
    await client.query(
      `UPDATE casting_scenes
       SET production_breakdown = jsonb_set(
         COALESCE(production_breakdown, '{}'::jsonb),
         '{props}',
         COALESCE(production_breakdown->'props', '[]'::jsonb) || $1::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify([{ id: propId, name: payload.name }]), suggestion.sourceId],
    );

    return { propId, linkedSceneId: suggestion.sourceId };
  },
};

export const breakdownRiskFlagApplier: SuggestionApplier<BreakdownRiskFlagPayload> = {
  suggestionType: SUGGESTION_TYPES.RISK_FLAG,

  async apply(
    suggestion: AISuggestion<BreakdownRiskFlagPayload>,
    ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    const { client } = ctx;
    const { payload } = suggestion;

    await client.query(
      `UPDATE casting_scenes
       SET production_breakdown = jsonb_set(
         COALESCE(production_breakdown, '{}'::jsonb),
         '{riskFlags}',
         COALESCE(production_breakdown->'riskFlags', '[]'::jsonb) || $1::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify([
          {
            riskType: payload.riskType,
            description: payload.description,
            recommendedAction: payload.recommendedAction ?? null,
            sourceSuggestionId: suggestion.id,
          },
        ]),
        suggestion.sourceId,
      ],
    );

    return { sceneId: suggestion.sourceId, riskType: payload.riskType };
  },
};

export const breakdownLocationApplier: SuggestionApplier<BreakdownLocationPayload> = {
  suggestionType: SUGGESTION_TYPES.LOCATION,

  async apply(
    suggestion: AISuggestion<BreakdownLocationPayload>,
    ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    const { client } = ctx;
    const { payload } = suggestion;

    let locationId = payload.existingLocationId;

    if (!locationId) {
      locationId = crypto.randomUUID();
      await client.query(
        `INSERT INTO casting_locations (id, project_id, name, type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [
          locationId,
          suggestion.projectId,
          payload.name,
          payload.intExt ?? null,
        ],
      );
    }

    await client.query(
      `UPDATE casting_scenes
       SET production_breakdown = jsonb_set(
         COALESCE(production_breakdown, '{}'::jsonb),
         '{locations}',
         COALESCE(production_breakdown->'locations', '[]'::jsonb) || $1::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify([
          {
            id: locationId,
            name: payload.name,
            intExt: payload.intExt ?? null,
            sourceSuggestionId: suggestion.id,
          },
        ]),
        suggestion.sourceId,
      ],
    );

    return { locationId, linkedSceneId: suggestion.sourceId };
  },
};

// Kostymer har ingen egen hoveddatatabell — de eksisterer kun som
// JSONB-entries på scene.production_breakdown.costumes (skuespiller-spesifikt).
export const breakdownCostumeApplier: SuggestionApplier<BreakdownCostumePayload> = {
  suggestionType: SUGGESTION_TYPES.COSTUME,

  async apply(
    suggestion: AISuggestion<BreakdownCostumePayload>,
    ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    const { client } = ctx;
    const { payload } = suggestion;

    await client.query(
      `UPDATE casting_scenes
       SET production_breakdown = jsonb_set(
         COALESCE(production_breakdown, '{}'::jsonb),
         '{costumes}',
         COALESCE(production_breakdown->'costumes', '[]'::jsonb) || $1::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify([
          {
            characterName: payload.characterName,
            description: payload.description,
            note: payload.note ?? null,
            sourceSuggestionId: suggestion.id,
          },
        ]),
        suggestion.sourceId,
      ],
    );

    return { sceneId: suggestion.sourceId, characterName: payload.characterName };
  },
};

// VFX-flagg lever også kun som JSONB-entries — produksjonsdesign-info,
// ikke en egen ressurs.
export const breakdownVfxFlagApplier: SuggestionApplier<BreakdownVfxFlagPayload> = {
  suggestionType: SUGGESTION_TYPES.VFX_FLAG,

  async apply(
    suggestion: AISuggestion<BreakdownVfxFlagPayload>,
    ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    const { client } = ctx;
    const { payload } = suggestion;

    await client.query(
      `UPDATE casting_scenes
       SET production_breakdown = jsonb_set(
         COALESCE(production_breakdown, '{}'::jsonb),
         '{vfxFlags}',
         COALESCE(production_breakdown->'vfxFlags', '[]'::jsonb) || $1::jsonb,
         true
       ),
       updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify([
          {
            description: payload.description,
            complexity: payload.complexity ?? null,
            note: payload.note ?? null,
            sourceSuggestionId: suggestion.id,
          },
        ]),
        suggestion.sourceId,
      ],
    );

    return { sceneId: suggestion.sourceId, description: payload.description };
  },
};
