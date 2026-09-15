/**
 * ai-narrative-element-agent.ts — KI-forslag for Story Graph (game_studio).
 *
 * Én agent, tre moduser, valgt av brukeren i element-skuffen:
 *   next     — foreslå NESTE element (og valgene ut av det) etter kildeelementet
 *   enhance  — forbedre kildeelementets tekst i karakterens stemme
 *   branches — foreslå en forgrening (arcscript-betingelser) ut av kildeelementet
 *
 * Forslag, aldri handlinger (AI-prinsipp 1): agenten skriver ingenting selv.
 * Applieren materialiserer et godtatt forslag inne i accept-transaksjonen via
 * narrative-servicen (nye elementer/koblinger eller patch av innhold).
 *
 * Modell: claude-opus-5 (skillens standardvalg; adaptiv tenkning er på som
 * standard, derfor tool_choice=auto — forced tool_choice avvises sammen med
 * tenkning). effort=medium holder kostnaden nede; system-prompten caches.
 * Mangler ANTHROPIC_API_KEY → [] med advarsel, som de andre agentene.
 */

import type { Pool } from "pg";
import { logAIUsage } from "./ai-usage-tracker.js";
import type {
  AIAgent,
  AIAgentInput,
  AIAgentOutput,
  AISuggestion,
  ApplyContext,
  SuggestionApplier,
} from "./ai-suggestion-service.js";
import * as narrative from "./role-room-narrative-service.js";
import { htmlToPlainText, htmlToTitle, plainTextToHtml } from "../../frontend/shared/narrative-format/index.ts";

export const NARRATIVE_ELEMENT_AGENT_NAME = "narrative-element-agent";
export const SUGGESTION_TYPE_NARRATIVE_ELEMENT = "narrative.element";
const MODEL_VERSION = "claude-opus-5";
const MAX_TOKENS = 4096;
const MIN_CONFIDENCE = 0.5;
const MAX_OPTIONS = 4;
const MAX_BRANCHES = 4;

export type NarrativeElementMode = "next" | "enhance" | "branches";
const MODES: readonly NarrativeElementMode[] = ["next", "enhance", "branches"];

export interface NarrativeElementAgentPayload {
  mode?: NarrativeElementMode;
  instructions?: string;
}

/** Lagres som suggestion.payload — alt er ren tekst (HTML bygges ved apply). */
export interface NarrativeElementSuggestionPayload {
  mode: NarrativeElementMode;
  sourceElementId: string;
  boardId: string;
  title: string;
  contentText: string;
  /** next: etikett på koblingen kilde → nytt element. */
  connectionLabel: string | null;
  /** next: valg ut av det nye elementet (stub-elementer opprettes ved apply). */
  options: Array<{ label: string; title: string }>;
  /** branches: betingelser (script null = ellers) med mål-stub. */
  branches: Array<{ script: string | null; label: string; targetTitle: string }>;
  rationale: string;
}

const TOOL_SCHEMA = {
  name: "propose_narrative_element",
  description:
    "Lever forslaget for Story Graph-elementet. Alt er ren tekst (ikke HTML); avsnitt skilles med tom linje. " +
    "Arcscript-betingelser bruker variabelnavnene som oppgitt (f.eks. `gold >= 10`, `visits() == 0`, `mood is 'sint'`).",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Tittel (maks 60 tegn). I enhance: forbedret tittel, eller uendret." },
      contentText: { type: "string", description: "Elementets tekst: fortellerstemme/dialog i karakterens stemme. 40–220 ord." },
      connectionLabel: { type: "string", description: "next: kort valg-etikett spilleren klikker for å komme hit (maks 8 ord)." },
      options: {
        type: "array", maxItems: MAX_OPTIONS,
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Valg-etikett (maks 8 ord)." },
            title: { type: "string", description: "Tittel på elementet valget fører til." },
          },
          required: ["label", "title"],
        },
        description: "next: 0–4 valg ut av det nye elementet.",
      },
      branches: {
        type: "array", maxItems: MAX_BRANCHES,
        items: {
          type: "object",
          properties: {
            script: { type: ["string", "null"], description: "arcscript-uttrykk, eller null for «ellers» (kun siste)." },
            label: { type: "string", description: "Kort navn på grenen." },
            targetTitle: { type: "string", description: "Tittel på elementet grenen fører til." },
          },
          required: ["script", "label", "targetTitle"],
        },
        description: "branches: 2–4 grener; siste kan være null (ellers).",
      },
      rationale: { type: "string", description: "Én setning om hvorfor dette passer historien." },
      confidence: { type: "number", description: "0–1." },
    },
    required: ["title", "contentText", "rationale", "confidence"],
  },
} as const;

interface ToolInput {
  title?: string;
  contentText?: string;
  connectionLabel?: string;
  options?: Array<{ label?: string; title?: string }>;
  branches?: Array<{ script?: string | null; label?: string; targetTitle?: string }>;
  rationale?: string;
  confidence?: number;
}

function buildSystemPrompt(): string {
  return [
    "Du er en erfaren narrativ designer for spill og skriver forgrenede historier på norsk",
    "(bokmål) i verktøyet Story Graph, som bruker Arcweaves modell: elementer (tekst),",
    "koblinger med valg-etiketter, forgreninger med arcscript-betingelser, jumpere, komponenter",
    "(karakterer/steder med attributter) og variabler.",
    "",
    "Regler:",
    "  - Fyll ALLTID ut verktøyet propose_narrative_element — aldri prosa utenfor verktøyet.",
    "  - Skriv i stemmen til komponentene som er festet på elementet (bruk attributtene).",
    "  - Hold tonen og tempoet fra eksisterende tekst; ikke gjenta det som allerede står.",
    "  - Valg-etiketter er korte handlinger («Gå til markedet»), ikke spørsmål.",
    "  - Betingelser bruker KUN variabler/attributter som er oppgitt, med arcscript-syntaks",
    "    (== != < > <= >= is 'is not' && || ! visits()).",
    "  - Ingen HTML. Avsnitt skilles med tom linje.",
    "  - confidence under 0.5 når konteksten er for tynn til å foreslå noe godt.",
  ].join("\n");
}

const MAX_CONTENT_CHARS = 4000;

function buildUserPrompt(graph: narrative.NarrativeGraph, element: narrative.NarrativeElement, mode: NarrativeElementMode, instructions: string): string {
  const componentIds = graph.elementComponents.filter((ec) => ec.elementId === element.id).map((ec) => ec.componentId);
  const components = graph.components.filter((c) => componentIds.includes(c.id)).map((c) => {
    const attrs = graph.attributes.filter((a) => a.ownerKind === "component" && a.ownerId === c.id)
      .map((a) => `${a.name}=${a.type === "rich_text" ? htmlToTitle(String(a.value ?? "")) : JSON.stringify(a.value ?? null)}`);
    return `- ${c.name}${attrs.length ? ` (${attrs.join(", ")})` : ""}`;
  });
  const variables = graph.variables.map((v) => `- ${v.name}: ${v.type} = ${JSON.stringify(v.defaultValue ?? null)}`);
  const titleOf = (id: string) => htmlToTitle(graph.elements.find((e) => e.id === id)?.titleHtml) || "(uten tittel)";
  const outgoing = graph.connections.filter((c) => c.sourceId === element.id)
    .map((c) => `- «${htmlToTitle(c.labelHtml) || "Fortsett"}» → ${titleOf(c.targetId)}`);
  const incoming = graph.connections.filter((c) => c.targetId === element.id)
    .map((c) => `- fra «${titleOf(c.sourceId)}»`);
  const content = htmlToPlainText(element.contentHtml);
  const bounded = content.length > MAX_CONTENT_CHARS ? `${content.slice(0, MAX_CONTENT_CHARS)}\n…[avkortet]` : content;

  const task = mode === "next"
    ? "Oppgave: foreslå NESTE element etter dette (tittel, tekst, connectionLabel = valget som fører dit) og 1–4 valg (options) videre."
    : mode === "enhance"
      ? "Oppgave: forbedre dette elementets tekst (contentText) — samme handling, bedre stemme, rytme og sansedetaljer. Behold lengden omtrent. options/branches tomme."
      : "Oppgave: foreslå en FORGRENING ut av dette elementet: 2–4 branches med arcscript-betingelser (siste kan være null = ellers) og targetTitle per gren. title/contentText beskriver forgreningen kort.";

  return [
    `Historie: ${graph.settings.title ?? "(uten tittel)"}`,
    "",
    `Element: «${htmlToTitle(element.titleHtml) || "(uten tittel)"}»${element.customId ? ` [#${element.customId}]` : ""}`,
    bounded ? `Tekst:\n${bounded}` : "Tekst: (tom)",
    "",
    components.length ? `Festede komponenter (stemme):\n${components.join("\n")}` : "Festede komponenter: ingen",
    variables.length ? `Variabler:\n${variables.join("\n")}` : "Variabler: ingen",
    outgoing.length ? `Utganger i dag:\n${outgoing.join("\n")}` : "Utganger i dag: ingen",
    incoming.length ? `Innganger:\n${incoming.join("\n")}` : "",
    "",
    task,
    instructions ? `Instruks fra designeren: ${instructions}` : "",
    "",
    "Kall propose_narrative_element nå.",
  ].filter(Boolean).join("\n");
}

function clampConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim().slice(0, max) : "";
}

export function createNarrativeElementAgent(pool: Pool): AIAgent {
  return {
    name: NARRATIVE_ELEMENT_AGENT_NAME,
    modelVersion: MODEL_VERSION,

    async generate(input: AIAgentInput): Promise<AIAgentOutput[]> {
      if (input.sourceType !== "narrative_element") return [];
      const payload = (input.payload ?? {}) as NarrativeElementAgentPayload;
      const mode: NarrativeElementMode = MODES.includes(payload.mode as NarrativeElementMode) ? (payload.mode as NarrativeElementMode) : "next";
      const instructions = cleanText(payload.instructions, 600);

      const graph = await narrative.getGraph(pool, input.projectId);
      const element = graph.elements.find((e) => e.id === input.sourceId);
      if (!element || element.kind !== "element") return [];

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.warn("[narrative-element-agent] ANTHROPIC_API_KEY mangler — hopper over");
        return [];
      }

      let toolInput: ToolInput;
      try {
        const mod: any = await import("@anthropic-ai/sdk");
        const AnthropicCtor = mod.default ?? mod.Anthropic;
        const client: any = new AnthropicCtor({ apiKey, maxRetries: 3, timeout: 120_000 });
        const response = await client.messages.create({
          model: MODEL_VERSION,
          max_tokens: MAX_TOKENS,
          output_config: { effort: "medium" },
          system: [{ type: "text", text: buildSystemPrompt(), cache_control: { type: "ephemeral" } }],
          tools: [TOOL_SCHEMA],
          tool_choice: { type: "auto" },
          messages: [{ role: "user", content: buildUserPrompt(graph, element, mode, instructions) }],
        });
        logAIUsage(response as any, { feature: "role-room/narrative-element" }).catch(() => undefined);
        if (response.stop_reason === "max_tokens") {
          console.warn("[narrative-element-agent] response truncated at max_tokens");
        }
        const toolBlock = (response.content ?? []).find((b: any) => b?.type === "tool_use" && b?.name === TOOL_SCHEMA.name);
        if (!toolBlock || typeof toolBlock.input !== "object" || !toolBlock.input) {
          console.warn("[narrative-element-agent] Claude returnerte ikke tool_use-blokk");
          return [];
        }
        toolInput = toolBlock.input as ToolInput;
      } catch (err) {
        console.error("[narrative-element-agent] Claude-kall feilet:", err);
        return [];
      }

      const confidence = clampConfidence(toolInput.confidence);
      const title = cleanText(toolInput.title, 200);
      const contentText = cleanText(toolInput.contentText, 6000);
      if (confidence < MIN_CONFIDENCE || (!title && !contentText)) return [];

      const options = (Array.isArray(toolInput.options) ? toolInput.options : [])
        .map((o) => ({ label: cleanText(o?.label, 120), title: cleanText(o?.title, 200) }))
        .filter((o) => o.label)
        .slice(0, MAX_OPTIONS);
      const branches = (Array.isArray(toolInput.branches) ? toolInput.branches : [])
        .map((b, i, all) => ({
          script: typeof b?.script === "string" && b.script.trim() ? b.script.trim().slice(0, 500) : null,
          label: cleanText(b?.label, 120) || `Gren ${i + 1}`,
          targetTitle: cleanText(b?.targetTitle, 200) || `Gren ${i + 1}`,
        }))
        .filter((b, i, all) => b.script != null || i === all.length - 1)
        .slice(0, MAX_BRANCHES);
      if (mode === "branches" && branches.length < 2) return [];

      const out: NarrativeElementSuggestionPayload = {
        mode,
        sourceElementId: element.id,
        boardId: element.boardId,
        title: title || htmlToTitle(element.titleHtml),
        contentText,
        connectionLabel: mode === "next" ? cleanText(toolInput.connectionLabel, 120) || null : null,
        options: mode === "next" ? options : [],
        branches: mode === "branches" ? branches : [],
        rationale: cleanText(toolInput.rationale, 500),
      };
      return [{
        suggestionType: SUGGESTION_TYPE_NARRATIVE_ELEMENT,
        payload: out,
        confidence,
        sourceType: "narrative_element",
        sourceId: element.id,
      }];
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Applier — materialiserer inne i accept-transaksjonen (ctx.client).
// ─────────────────────────────────────────────────────────────────────

const STUB_DX = 340;
const STUB_DY = 150;

export const narrativeElementApplier: SuggestionApplier<NarrativeElementSuggestionPayload> = {
  suggestionType: SUGGESTION_TYPE_NARRATIVE_ELEMENT,
  async apply(suggestion: AISuggestion<NarrativeElementSuggestionPayload>, ctx: ApplyContext): Promise<Record<string, unknown>> {
    const { client, projectId, userId } = ctx;
    const p = suggestion.payload;
    const { rows } = await client.query(
      `SELECT * FROM narrative_elements WHERE id = $1 AND project_id = $2 LIMIT 1`,
      [p.sourceElementId, projectId],
    );
    if (!rows[0]) throw new Error(`Kildeelementet ${p.sourceElementId} finnes ikke lenger.`);
    const source = narrative.mapElementRow(rows[0] as Record<string, unknown>);
    const createdElementIds: string[] = [];
    const connectionIds: string[] = [];

    if (p.mode === "enhance") {
      const result = await narrative.patchElement(client, projectId, source.id, {
        titleHtml: p.title ? plainTextToHtml(p.title) : undefined,
        contentHtml: plainTextToHtml(p.contentText),
      });
      if (!result || !result.ok) throw new Error("Kunne ikke oppdatere elementet.");
      return { mode: p.mode, patchedElementId: source.id, version: result.element.version };
    }

    if (p.mode === "branches") {
      const branch = await narrative.createElement(client, projectId, userId, {
        boardId: source.boardId, kind: "branch",
        titleHtml: plainTextToHtml(p.title || "Forgrening"),
        x: source.x + source.width + 80, y: source.y, width: 200, height: 80, theme: "amber",
        branchConditions: p.branches.map((b) => ({ id: "", script: b.script, label: b.label })),
      });
      createdElementIds.push(branch.id);
      const toBranch = await narrative.createConnection(client, projectId, userId, {
        boardId: source.boardId, sourceId: source.id, targetId: branch.id, labelHtml: p.connectionLabel ? plainTextToHtml(p.connectionLabel) : "",
      });
      if (toBranch) connectionIds.push(toBranch.id);
      for (const [i, cond] of branch.branchConditions.entries()) {
        const spec = p.branches[i];
        if (!spec) break;
        const stub = await narrative.createElement(client, projectId, userId, {
          boardId: source.boardId, kind: "element", titleHtml: plainTextToHtml(spec.targetTitle),
          x: branch.x + STUB_DX, y: branch.y + i * STUB_DY, theme: "default",
        });
        createdElementIds.push(stub.id);
        const conn = await narrative.createConnection(client, projectId, userId, {
          boardId: source.boardId, sourceId: branch.id, targetId: stub.id, sourceOutputKey: cond.id, sortOrder: i,
        });
        if (conn) connectionIds.push(conn.id);
      }
      return { mode: p.mode, branchId: branch.id, createdElementIds, connectionIds };
    }

    // next
    const next = await narrative.createElement(client, projectId, userId, {
      boardId: source.boardId, kind: "element",
      titleHtml: plainTextToHtml(p.title), contentHtml: plainTextToHtml(p.contentText),
      x: source.x + source.width + 80, y: source.y, theme: source.theme,
    });
    createdElementIds.push(next.id);
    const toNext = await narrative.createConnection(client, projectId, userId, {
      boardId: source.boardId, sourceId: source.id, targetId: next.id, labelHtml: p.connectionLabel ? plainTextToHtml(p.connectionLabel) : "",
    });
    if (toNext) connectionIds.push(toNext.id);
    for (const [i, opt] of p.options.slice(0, MAX_OPTIONS).entries()) {
      const stub = await narrative.createElement(client, projectId, userId, {
        boardId: source.boardId, kind: "element", titleHtml: plainTextToHtml(opt.title || opt.label),
        x: next.x + STUB_DX, y: next.y + i * STUB_DY, theme: "default",
      });
      createdElementIds.push(stub.id);
      const conn = await narrative.createConnection(client, projectId, userId, {
        boardId: source.boardId, sourceId: next.id, targetId: stub.id, labelHtml: plainTextToHtml(opt.label), sortOrder: i,
      });
      if (conn) connectionIds.push(conn.id);
    }
    return { mode: p.mode, elementId: next.id, createdElementIds, connectionIds };
  },
};
