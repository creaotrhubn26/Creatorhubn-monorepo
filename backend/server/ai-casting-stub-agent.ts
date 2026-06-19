/**
 * ai-casting-stub-agent.ts
 *
 * Andre konkrete agent på AI Suggestion System-substratet. Følger
 * breakdown-agent-mønsteret men kjører på prosjekt-nivå (sourceType="project")
 * i stedet for per-scene — fordi forslag om nye roller krever cross-scene
 * kontekst (sceneCount, alle sceneIds en karakter forekommer i).
 *
 * Pipeline:
 *   alle scenes + existingRoles → Claude (detect karakter-navn, dedup mot
 *     existingRoles) → AIAgentOutput[] med 'casting.role-stub'-payload
 *     → applier oppretter casting_roles-rad ved accept
 *
 * Forskjellen mot breakdown:
 *   - Trigger: ikke automatisk på scene-save. Manuell via "Generer forslag"
 *     på prosjekt-nivå, eller ved åpning av casting-tab. Per-scene ville
 *     produsert duplikat-forslag for samme karakter.
 *   - Input: hele scenelisten i én Claude-call. Kostnadsmessig nesten gratis
 *     (~$0.02 per prosjekt med 30 scener) takket være Sonnet-prising.
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

const SUGGESTION_TYPE_ROLE_STUB = "casting.role-stub";
const MODEL_VERSION = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

interface CastingStubAgentInput {
  scenes: Array<{ id: string; sceneNumber?: string | number; sceneText: string }>;
  existingRoles: Array<{ id: string; name: string }>;
}

interface CastingRoleStubPayload {
  characterName: string;
  sceneCount: number;
  sceneIds: string[];
  ageRange?: string;
  gender?: string;
  shortDescription?: string;
}

const ROLE_STUB_TOOL_SCHEMA = {
  name: "record_role_stubs",
  description:
    "Registrer alle karakter-navn som forekommer i scenene men IKKE allerede " +
    "eksisterer i existingRoles. Bruk eksakt karakter-navn slik det står i scenene " +
    "(typisk UPPERCASE som SCREENPLAY-konvensjon).",
  input_schema: {
    type: "object",
    properties: {
      stubs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            characterName: {
              type: "string",
              description:
                "Karakter-navnet slik det står i scenene. Skal ikke matche " +
                "existingRoles (case-insensitiv).",
            },
            sceneIds: {
              type: "array",
              items: { type: "string" },
              description: "IDene til scenene karakteren faktisk opptrer i.",
            },
            ageRange: {
              type: "string",
              description:
                "Aldersområde hvis impliseret av scenene (f.eks. '20-30', 'voksen'). " +
                "Utelat hvis ukjent.",
            },
            gender: {
              type: "string",
              description: "Kjønn hvis tydelig fra scenene. Utelat hvis ukjent.",
            },
            shortDescription: {
              type: "string",
              description:
                "Maks 1-2 setninger om karakterens funksjon eller særtrekk basert på " +
                "scenene. Utelat hvis bare navnet er nevnt uten kontekst.",
            },
            confidence: { type: "number", description: "0.0 til 1.0" },
          },
          required: ["characterName", "sceneIds", "confidence"],
        },
      },
    },
    required: ["stubs"],
  },
} as const;

interface RoleStubToolInput {
  stubs: Array<{
    characterName: string;
    sceneIds: string[];
    ageRange?: string;
    gender?: string;
    shortDescription?: string;
    confidence: number;
  }>;
}

function buildSystemPrompt(): string {
  return [
    "Du er en erfaren norsk casting-assistent som leser manus og identifiserer",
    "karakter-navn som mangler som roller i prosjektet. Du fyller ut",
    "record_role_stubs-verktøyet med funn — aldri prosa.",
    "",
    "Regler:",
    "1. Karakter-navn er typisk UPPERCASE i screenplay-format (f.eks. ANNA, JON,",
    "   POLITIMANN). Inkluder også titler/funksjoner som POLITIMANN, KELLNER hvis",
    "   de har replikker eller direkte handling.",
    "2. Ekskluder navn som allerede er i existingRoles (case-insensitiv match).",
    "3. Ikke foreslå generiske beskrivelser som 'KVINNE', 'MANN', 'GUTT' med mindre",
    "   de tydelig refererer til en spesifikk gjentakende karakter.",
    "4. Confidence:",
    "   0.95+ = karakter med replikker eller navngitt direkte handling",
    "   0.75-0.94 = nevnt men minimal aksjon (statist-lignende)",
    "   0.50-0.74 = usikker — kanskje bare en omtale, ikke en faktisk rolle",
    "   Under 0.5 = ikke ta med.",
    "5. sceneIds må være de faktiske ID-ene fra scene-listen — ikke gjett.",
    "6. ageRange/gender/shortDescription: KUN hvis tydelig fra scenene. Utelat alt",
    "   du må gjette på.",
  ].join("\n");
}

function buildUserPrompt(input: CastingStubAgentInput): string {
  const existingRoles = input.existingRoles.length > 0
    ? input.existingRoles.map((r) => `- ${r.name}`).join("\n")
    : "(ingen)";

  const scenes = input.scenes
    .map((s) => {
      const header = `### Scene ${s.sceneNumber ?? "?"} (id: ${s.id})`;
      return `${header}\n${s.sceneText.trim()}`;
    })
    .join("\n\n");

  return [
    "Existing roller i prosjektet (ekskluder disse):",
    existingRoles,
    "",
    "Scener:",
    "",
    scenes,
    "",
    "Kall record_role_stubs nå med alle nye karakter-navn du finner.",
  ].join("\n");
}

function clampConfidence(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toolInputToOutputs(
  toolInput: RoleStubToolInput,
  projectId: string,
  existingRoleNames: Set<string>,
): AIAgentOutput[] {
  const outputs: AIAgentOutput[] = [];

  for (const stub of toolInput.stubs ?? []) {
    if (!stub?.characterName) continue;
    const normalizedName = stub.characterName.trim();
    if (!normalizedName) continue;
    // Defensiv dedup: Claude skal ekskludere existingRoles, men double-check
    // her så vi aldri sender ut duplikat-forslag.
    if (existingRoleNames.has(normalizedName.toUpperCase())) continue;

    const confidence = clampConfidence(stub.confidence);
    if (confidence < 0.5) continue;

    const sceneIds = Array.isArray(stub.sceneIds)
      ? stub.sceneIds.filter((id) => typeof id === "string" && id.length > 0)
      : [];

    const payload: CastingRoleStubPayload = {
      characterName: normalizedName,
      sceneCount: sceneIds.length,
      sceneIds,
      ageRange: stub.ageRange,
      gender: stub.gender,
      shortDescription: stub.shortDescription,
    };

    outputs.push({
      suggestionType: SUGGESTION_TYPE_ROLE_STUB,
      payload,
      confidence,
      sourceType: "project",
      sourceId: projectId,
    });
  }

  return outputs;
}

export const castingStubAgent: AIAgent = {
  name: "casting-stub-agent",
  modelVersion: MODEL_VERSION,

  async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
    if (input.sourceType !== "project") {
      // Cross-scene agent gir bare mening på prosjekt-nivå
      return [];
    }

    const agentInput = input.payload as CastingStubAgentInput | undefined;
    if (!agentInput?.scenes || agentInput.scenes.length === 0) {
      return [];
    }

    // Filtrer bort scener uten tekst — de gir ingenting til Claude
    const scenesWithText = agentInput.scenes.filter((s) => s.sceneText?.trim());
    if (scenesWithText.length === 0) {
      return [];
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("[casting-stub-agent] ANTHROPIC_API_KEY mangler — hopper over");
      return [];
    }

    const existingRoleNames = new Set(
      (agentInput.existingRoles ?? []).map((r) => r.name.trim().toUpperCase()),
    );

    let toolInput: RoleStubToolInput;
    try {
      const mod: any = await import("@anthropic-ai/sdk");
      const AnthropicCtor = mod.default ?? mod.Anthropic;
      const client: any = new AnthropicCtor({
        apiKey,
        maxRetries: 3, // ride out 429/529 bursts during bulk generate
        timeout: 60_000,
      });

      const response = await client.messages.create({
        model: MODEL_VERSION,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(),
        tools: [ROLE_STUB_TOOL_SCHEMA],
        tool_choice: { type: "tool", name: ROLE_STUB_TOOL_SCHEMA.name },
        messages: [{
          role: "user",
          content: buildUserPrompt({
            scenes: scenesWithText,
            existingRoles: agentInput.existingRoles ?? [],
          }),
        }],
      });
      logAIUsage(response as any, { feature: 'role-room/casting-suggest' }).catch(() => undefined);

      if (response.stop_reason === "max_tokens") {
        console.warn("[casting-stub-agent] response truncated at max_tokens — role stubs may be incomplete");
      }

      const toolBlock = (response.content ?? []).find(
        (b: any) => b?.type === "tool_use" && b?.name === ROLE_STUB_TOOL_SCHEMA.name,
      );

      if (!toolBlock || typeof toolBlock.input !== "object") {
        console.warn("[casting-stub-agent] Claude returnerte ikke tool_use-blokk");
        return [];
      }

      toolInput = toolBlock.input as RoleStubToolInput;
    } catch (err) {
      console.error("[casting-stub-agent] Claude-kall feilet:", err);
      return [];
    }

    return toolInputToOutputs(toolInput, input.projectId, existingRoleNames);
  },
};

// ─────────────────────────────────────────────────────────────────────
// Applier — accept → casting_roles-rad
// ─────────────────────────────────────────────────────────────────────

export const castingRoleStubApplier: SuggestionApplier<CastingRoleStubPayload> = {
  suggestionType: SUGGESTION_TYPE_ROLE_STUB,

  async apply(
    suggestion: AISuggestion<CastingRoleStubPayload>,
    ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    const { client } = ctx;
    const { payload } = suggestion;

    // Idempotens-vakt: hvis brukeren har akseptert "ANNA" tidligere og forsøker
    // igjen (f.eks. fra et eldre superseded forslag), match på navn først.
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM casting_roles
       WHERE project_id = $1 AND UPPER(name) = UPPER($2)
       LIMIT 1`,
      [suggestion.projectId, payload.characterName],
    );

    if (existing.rows.length > 0) {
      return {
        roleId: existing.rows[0].id,
        alreadyExisted: true,
        characterName: payload.characterName,
      };
    }

    const roleId = crypto.randomUUID();
    await client.query(
      `INSERT INTO casting_roles
         (id, project_id, name, description, age_range, gender, scene_ids,
          status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', NOW(), NOW())`,
      [
        roleId,
        suggestion.projectId,
        payload.characterName,
        payload.shortDescription ?? null,
        payload.ageRange ?? null,
        payload.gender ?? null,
        JSON.stringify(payload.sceneIds ?? []),
      ],
    );

    return {
      roleId,
      characterName: payload.characterName,
      sceneCount: payload.sceneCount,
    };
  },
};
