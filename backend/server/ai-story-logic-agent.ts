import { logAIUsage } from './ai-usage-tracker.js';
/**
 * ai-story-logic-agent.ts
 *
 * Tredje konkrete agent på AI Suggestion System-substratet. Treffer en
 * helt annen kvalitets-vinkel enn breakdown og casting-stub — finner
 * narrative-feil heller enn produksjons-data.
 *
 * Eksempler:
 *   - "ANNA blir nevnt i scene 7 uten å ha blitt introdusert"
 *   - "Pistolen fra scene 3 dukker aldri opp igjen — Chekhov's gun"
 *   - "Scene 5: Anna bor alene. Scene 12: Anna prater til ektemannen."
 *   - "Tidsangivelsen 'tre dager senere' i scene 8 stemmer ikke med scene 2's
 *      'om mandag'"
 *
 * Pipeline:
 *   alle scenes + roller → Claude (cross-scene reasoning) →
 *     'story.continuity-issue'-suggestions → ingen applier-side-effects,
 *     bare review-audit (agree/disagree, sett notat).
 *
 * Forskjellen fra de to andre agentene:
 *   - Ingen ny data opprettes ved accept. Applier er no-op som bare
 *     markerer at brukeren har vurdert issuet.
 *   - Kostbar: én call må ha *all* scenetekst i kontekst. ~20kB i input
 *     for et 30-scenes prosjekt. Bruker prompt-cache for å unngå at
 *     hver re-validation koster fullt.
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

const SUGGESTION_TYPE_CONTINUITY_ISSUE = "story.continuity-issue";
const MODEL_VERSION = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

interface StoryLogicAgentInput {
  scenes: Array<{
    id: string;
    sceneNumber?: string | number;
    sceneText: string;
    sceneHeading?: string;
  }>;
  existingRoles: Array<{ id: string; name: string }>;
}

type IssueType =
  | "character-no-introduction"
  | "prop-disappears"
  | "contradicting-fact"
  | "setup-without-payoff"
  | "payoff-without-setup"
  | "time-jump-unclear";

interface StoryContinuityIssuePayload {
  issueType: IssueType;
  description: string;
  affectedSceneIds: string[];
  severity: "minor" | "major";
  suggestion?: string;
}

const STORY_LOGIC_TOOL_SCHEMA = {
  name: "record_continuity_issues",
  description:
    "Registrer narrative continuity-feil på tvers av scenene. Returnér " +
    "tom array hvis ingen tydelige feil. Vær konservativ — flagg KUN ting du " +
    "er rimelig sikker er en feil, ikke stilistiske valg.",
  input_schema: {
    type: "object",
    properties: {
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            issueType: {
              type: "string",
              enum: [
                "character-no-introduction",
                "prop-disappears",
                "contradicting-fact",
                "setup-without-payoff",
                "payoff-without-setup",
                "time-jump-unclear",
              ],
            },
            description: {
              type: "string",
              description:
                "1-3 setninger som forklarer feilen konkret med referanse til " +
                "spesifikke scener.",
            },
            affectedSceneIds: {
              type: "array",
              items: { type: "string" },
              description:
                "Scene-ID-ene som feilen involverer. Minst 1, gjerne flere hvis " +
                "feilen spenner over flere scener (typisk for contradicting-fact).",
            },
            severity: {
              type: "string",
              enum: ["minor", "major"],
              description:
                "'major' = handlingsbrytende eller logisk umulig. " +
                "'minor' = stilistisk eller lett-å-misforstå.",
            },
            suggestion: {
              type: "string",
              description:
                "Konkret forslag til hvordan løse — f.eks. 'Introduser ANNA i " +
                "scene 3 før scene 7 nevner henne'. Utelat hvis ingen åpenbar fix.",
            },
            confidence: {
              type: "number",
              description: "0.0 til 1.0. Vær konservativ.",
            },
          },
          required: ["issueType", "description", "affectedSceneIds", "severity", "confidence"],
        },
      },
    },
    required: ["issues"],
  },
} as const;

interface StoryLogicToolInput {
  issues: Array<{
    issueType: IssueType;
    description: string;
    affectedSceneIds: string[];
    severity: "minor" | "major";
    suggestion?: string;
    confidence: number;
  }>;
}

function buildSystemPrompt(): string {
  return [
    "Du er en erfaren norsk dramaturg som leser hele manus og finner",
    "narrative continuity-feil. Du fyller ut record_continuity_issues-",
    "verktøyet med funn — aldri prosa.",
    "",
    "Hva du SKAL flagge:",
    "  - Karakter med replikker/handling som ikke er introdusert tidligere",
    "  - Establert prop/objekt som forsvinner uten avklaring",
    "  - Fakta som motsier hverandre på tvers av scener (bo-situasjon,",
    "    relasjoner, tidslinje)",
    "  - Setup uten payoff (Chekhov's gun: vist våpen som aldri brukes)",
    "  - Payoff uten setup (plutselig avgjørende objekt som ikke ble etablert)",
    "  - Tidsangivelser som ikke henger sammen",
    "",
    "Hva du IKKE skal flagge:",
    "  - Stilistiske valg (ellipses, in medias res, intensjonell mystikk)",
    "  - Manglende underbygging av karakter-motivasjon (det er en script-",
    "    note, ikke en continuity-feil)",
    "  - Manglende beskrivelser/sceneretning (det er ikke en feil, bare ufullført)",
    "  - 'Could-be-stronger'-feedback — vi vil ha FEIL, ikke FORBEDRINGER",
    "",
    "Konfidens:",
    "  0.95+ = umulig å lese annerledes, klar logisk feil",
    "  0.75-0.94 = sannsynlig feil men kan være intensjonell mystikk",
    "  0.50-0.74 = mulig feil men trenger forfatters bekreftelse",
    "  Under 0.5 = ikke flagg",
    "",
    "Vær konservativ. Det er bedre å ikke flagge enn å plage forfatteren med",
    "falske positiver.",
  ].join("\n");
}

function buildUserPrompt(input: StoryLogicAgentInput): string {
  const existingRoles = input.existingRoles.length > 0
    ? input.existingRoles.map((r) => `- ${r.name}`).join("\n")
    : "(ingen)";

  const scenes = input.scenes
    .map((s) => {
      const header = `### Scene ${s.sceneNumber ?? "?"} (id: ${s.id})${s.sceneHeading ? ` — ${s.sceneHeading}` : ""}`;
      return `${header}\n${s.sceneText.trim()}`;
    })
    .join("\n\n");

  return [
    "Roller i prosjektet (kan brukes til å verifisere 'introdusert' vs. ikke):",
    existingRoles,
    "",
    "Scener i rekkefølge:",
    "",
    scenes,
    "",
    "Kall record_continuity_issues nå.",
  ].join("\n");
}

function clampConfidence(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toolInputToOutputs(
  toolInput: StoryLogicToolInput,
  projectId: string,
): AIAgentOutput[] {
  const outputs: AIAgentOutput[] = [];

  for (const issue of toolInput.issues ?? []) {
    if (!issue?.description || !issue?.issueType) continue;
    const confidence = clampConfidence(issue.confidence);
    if (confidence < 0.5) continue;

    const sceneIds = Array.isArray(issue.affectedSceneIds)
      ? issue.affectedSceneIds.filter((id) => typeof id === "string" && id.length > 0)
      : [];
    if (sceneIds.length === 0) continue;

    const payload: StoryContinuityIssuePayload = {
      issueType: issue.issueType,
      description: issue.description,
      affectedSceneIds: sceneIds,
      severity: issue.severity === "major" ? "major" : "minor",
      suggestion: issue.suggestion,
    };

    outputs.push({
      suggestionType: SUGGESTION_TYPE_CONTINUITY_ISSUE,
      payload,
      confidence,
      sourceType: "project",
      sourceId: projectId,
    });
  }

  return outputs;
}

export const storyLogicAgent: AIAgent = {
  name: "story-logic-agent",
  modelVersion: MODEL_VERSION,

  async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
    if (input.sourceType !== "project") return [];

    const agentInput = input.payload as StoryLogicAgentInput | undefined;
    if (!agentInput?.scenes || agentInput.scenes.length === 0) return [];

    const scenesWithText = agentInput.scenes.filter((s) => s.sceneText?.trim());
    // Krever minst 2 scener — continuity-issues per definisjon krever
    // cross-scene-reasoning.
    if (scenesWithText.length < 2) return [];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("[story-logic-agent] ANTHROPIC_API_KEY mangler — hopper over");
      return [];
    }

    let toolInput: StoryLogicToolInput;
    try {
      const mod: any = await import("@anthropic-ai/sdk");
      const AnthropicCtor = mod.default ?? mod.Anthropic;
      const client: any = new AnthropicCtor({
        apiKey,
        maxRetries: 1,
        // Lengre timeout enn de andre agentene — full manus-analyse tar tid
        timeout: 120_000,
      });

      const response = await client.messages.create({
        model: MODEL_VERSION,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: "text",
            text: buildSystemPrompt(),
            // Prompt-cache: system-prompt endrer seg ikke mellom kall,
            // så vi får billig re-validation når brukeren legger til scener
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [STORY_LOGIC_TOOL_SCHEMA],
        tool_choice: { type: "tool", name: STORY_LOGIC_TOOL_SCHEMA.name },
        messages: [{
          role: "user",
          content: buildUserPrompt({
            scenes: scenesWithText,
            existingRoles: agentInput.existingRoles ?? [],
          }),
        }],
      });
      logAIUsage(response as any, { feature: 'role-room/story-logic' }).catch(() => undefined);

      const toolBlock = (response.content ?? []).find(
        (b: any) => b?.type === "tool_use" && b?.name === STORY_LOGIC_TOOL_SCHEMA.name,
      );

      if (!toolBlock || typeof toolBlock.input !== "object") {
        console.warn("[story-logic-agent] Claude returnerte ikke tool_use-blokk");
        return [];
      }

      toolInput = toolBlock.input as StoryLogicToolInput;
    } catch (err) {
      console.error("[story-logic-agent] Claude-kall feilet:", err);
      return [];
    }

    return toolInputToOutputs(toolInput, input.projectId);
  },
};

// ─────────────────────────────────────────────────────────────────────
// Applier — no-op, bare audit-trail
// ─────────────────────────────────────────────────────────────────────
//
// Continuity-issues har ingen "materialiseringsside" — å akseptere et issue
// betyr "ja, dette er reelt", ikke "nå gjør X". Applieren eksisterer kun
// så substratet får konsistent state-machine pending → accepted → applied.
// Selve mitigasjonen er manuell forfatter-jobb i manuskriptet.

export const storyContinuityIssueApplier: SuggestionApplier<StoryContinuityIssuePayload> = {
  suggestionType: SUGGESTION_TYPE_CONTINUITY_ISSUE,

  async apply(
    suggestion: AISuggestion<StoryContinuityIssuePayload>,
    _ctx: ApplyContext,
  ): Promise<Record<string, unknown>> {
    return {
      acknowledgedIssueType: suggestion.payload.issueType,
      affectedSceneIds: suggestion.payload.affectedSceneIds,
      severity: suggestion.payload.severity,
    };
  },
};
