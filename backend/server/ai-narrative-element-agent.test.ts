import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool, PoolClient } from "pg";

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = { create: createMock };
  },
}));
vi.mock("./ai-usage-tracker.js", () => ({ logAIUsage: vi.fn(async () => undefined) }));

import { createNarrativeElementAgent, narrativeElementApplier, type NarrativeElementSuggestionPayload } from "./ai-narrative-element-agent.js";
import type { AISuggestion } from "./ai-suggestion-service.js";

type Handler = { match: RegExp; rows: unknown[] | ((params: unknown[]) => unknown[]) };
function makePool(handlers: Handler[] = []) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    for (const h of handlers) {
      if (h.match.test(sql)) {
        const rows = typeof h.rows === "function" ? h.rows(params) : h.rows;
        return { rows, rowCount: rows.length };
      }
    }
    return { rows: [], rowCount: 0 };
  });
  return { query } as unknown as Pool & { query: typeof query };
}

const now = new Date("2026-09-15T10:00:00Z");
const elementRow = (over: Record<string, unknown> = {}) => ({
  id: "nel_1", project_id: "p1", board_id: "nbd_1", kind: "element",
  title_html: "<p>Landsbyen</p>", content_html: "<p>Du våkner i en stille landsby.</p>", x: 40, y: 80, width: 260, height: 120,
  theme: "green", cover_asset_id: null, custom_id: "start", jumper_target_id: null, branch_conditions: [], version: 1, sort_order: 0,
  created_at: now, updated_at: now, ...over,
});
const graphRows: Handler[] = [
  { match: /FROM narrative_settings WHERE project_id/, rows: [{ project_id: "p1", title: "Demo", starting_element_id: "nel_1", cover_asset_id: null, schema_version: 1, updated_at: null }] },
  { match: /FROM narrative_boards WHERE project_id/, rows: [{ id: "nbd_1", project_id: "p1", name: "Akt 1", custom_id: null, folder_path: "", sort_order: 0, viewport: {}, created_at: now, updated_at: now }] },
  { match: /FROM narrative_elements WHERE project_id/, rows: [elementRow()] },
  { match: /FROM narrative_components WHERE project_id/, rows: [{ id: "ncp_1", project_id: "p1", name: "Kjøpmannen", folder_path: "", cover_asset_id: null, custom_id: null, sort_order: 0, created_at: now, updated_at: now }] },
  { match: /FROM narrative_element_components/, rows: [{ element_id: "nel_1", component_id: "ncp_1", sort_order: 0 }] },
  { match: /FROM narrative_attributes WHERE project_id/, rows: [{ id: "nat_1", project_id: "p1", owner_kind: "component", owner_id: "ncp_1", name: "mood", type: "string", value: "grådig", custom_id: null, sort_order: 0, created_at: now, updated_at: now }] },
  { match: /FROM narrative_variables WHERE project_id/, rows: [{ id: "nvr_1", project_id: "p1", name: "gold", type: "int", default_value: 0, sort_order: 0, created_at: now, updated_at: now }] },
];

const baseInput = { projectId: "p1", userId: "u1", sourceType: "narrative_element" as const, sourceId: "nel_1" };

describe("narrative-element-agent — generate", () => {
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = "test-key"; createMock.mockReset(); });
  afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

  it("feil sourceType eller ukjent element → []", async () => {
    const agent = createNarrativeElementAgent(makePool(graphRows));
    expect(await agent.generate({ ...baseInput, sourceType: "scene", payload: {} })).toEqual([]);
    expect(await agent.generate({ ...baseInput, sourceId: "nel_finnes_ikke", payload: {} })).toEqual([]);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("uten ANTHROPIC_API_KEY → [] uten Claude-kall", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const agent = createNarrativeElementAgent(makePool(graphRows));
    expect(await agent.generate({ ...baseInput, payload: { mode: "next" } })).toEqual([]);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("next: kaller claude-opus-5 med cachet system, tool_choice auto, effort medium og kontekst; returnerer ett forslag", async () => {
    createMock.mockResolvedValue({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", name: "propose_narrative_element", input: {
        title: "Markedet", contentText: "Boder i alle farger.\n\nKjøpmannen myser mot pungen din.", connectionLabel: "Gå til markedet",
        options: [{ label: "Kjøp et sverd", title: "Smeden" }, { label: "Gå videre", title: "Porten" }], rationale: "Naturlig neste steg.", confidence: 0.82,
      } }],
    });
    const agent = createNarrativeElementAgent(makePool(graphRows));
    const out = await agent.generate({ ...baseInput, payload: { mode: "next", instructions: "Mørkere tone" } });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ suggestionType: "narrative.element", confidence: 0.82, sourceType: "narrative_element", sourceId: "nel_1" });
    const payload = out[0].payload as NarrativeElementSuggestionPayload;
    expect(payload).toMatchObject({ mode: "next", sourceElementId: "nel_1", boardId: "nbd_1", title: "Markedet", connectionLabel: "Gå til markedet" });
    expect(payload.options).toHaveLength(2);
    expect(payload.branches).toEqual([]);

    const req = createMock.mock.calls[0][0];
    expect(req.model).toBe("claude-opus-5");
    expect(req.tool_choice).toEqual({ type: "auto" });
    expect(req.output_config).toEqual({ effort: "medium" });
    expect(req.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(req.tools[0].name).toBe("propose_narrative_element");
    const user = req.messages[0].content as string;
    expect(user).toContain("Kjøpmannen (mood=\"grådig\")");
    expect(user).toContain("- gold: int = 0");
    expect(user).toContain("Instruks fra designeren: Mørkere tone");
    expect(user).toContain("foreslå NESTE element");
  });

  it("lav confidence eller manglende tool_use → []", async () => {
    createMock.mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: "Jeg tror…" }] });
    const agent = createNarrativeElementAgent(makePool(graphRows));
    expect(await agent.generate({ ...baseInput, payload: { mode: "enhance" } })).toEqual([]);
    createMock.mockResolvedValueOnce({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "propose_narrative_element", input: { title: "x", contentText: "y", rationale: "z", confidence: 0.2 } }] });
    expect(await agent.generate({ ...baseInput, payload: { mode: "enhance" } })).toEqual([]);
  });

  it("branches: beholder kun siste null-script som ellers og krever minst to grener", async () => {
    createMock.mockResolvedValue({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "propose_narrative_element", input: {
      title: "Har du gull?", contentText: "", rationale: "r", confidence: 0.7,
      branches: [{ script: "gold >= 10", label: "Rik", targetTitle: "Rik" }, { script: "", label: "Mellom", targetTitle: "Mellom" }, { script: null, label: "Ellers", targetTitle: "Fattig" }],
    } }] });
    const agent = createNarrativeElementAgent(makePool(graphRows));
    const out = await agent.generate({ ...baseInput, payload: { mode: "branches" } });
    const payload = out[0].payload as NarrativeElementSuggestionPayload;
    expect(payload.branches).toEqual([
      { script: "gold >= 10", label: "Rik", targetTitle: "Rik" },
      { script: null, label: "Ellers", targetTitle: "Fattig" },
    ]);
  });
});

describe("narrative-element-agent — applier", () => {
  function makeClient(handlers: Handler[]) {
    return makePool(handlers) as unknown as PoolClient & { query: ReturnType<typeof vi.fn> };
  }
  const suggestion = (payload: Partial<NarrativeElementSuggestionPayload>): AISuggestion<NarrativeElementSuggestionPayload> => ({
    id: "s1", projectId: "p1", suggestionType: "narrative.element", agentName: "narrative-element-agent", modelVersion: "claude-opus-5",
    confidence: 0.8, status: "accepted", sourceType: "narrative_element", sourceId: "nel_1", createdAt: "", updatedAt: "",
    payload: { mode: "next", sourceElementId: "nel_1", boardId: "nbd_1", title: "Markedet", contentText: "Boder.\n\nLukt av fisk.", connectionLabel: "Gå til markedet", options: [{ label: "Kjøp sverd", title: "Smeden" }], branches: [], rationale: "", ...payload },
  });
  const insertElement = (params: unknown[]) => [elementRow({ id: params[0], board_id: params[2], kind: params[3], title_html: params[4], content_html: params[5], x: params[6], y: params[7], branch_conditions: JSON.parse(String(params[14])) })];
  const insertConnection = (params: unknown[]) => [{ id: params[0], project_id: "p1", board_id: params[2], source_id: params[3], target_id: params[4], source_output_key: params[5], label_html: params[6], sort_order: params[7], created_at: now, updated_at: now }];

  it("next: oppretter element til høyre for kilden, kobling fra kilden og stub per valg", async () => {
    const client = makeClient([
      { match: /SELECT \* FROM narrative_elements WHERE id = \$1 AND project_id = \$2/, rows: [elementRow()] },
      { match: /INSERT INTO narrative_elements/, rows: insertElement },
      { match: /SELECT id FROM narrative_elements WHERE project_id = \$1 AND id = ANY/, rows: (p) => (p[1] as string[]).map((id) => ({ id })) },
      { match: /INSERT INTO narrative_connections/, rows: insertConnection },
    ]);
    const result = await narrativeElementApplier.apply(suggestion({}), { client, projectId: "p1", userId: "u1" });
    expect(result.mode).toBe("next");
    expect((result.createdElementIds as string[])).toHaveLength(2);
    expect((result.connectionIds as string[])).toHaveLength(2);
    const inserts = client.query.mock.calls.filter((c) => /INSERT INTO narrative_elements/.test(String(c[0])));
    expect(inserts[0][1][4]).toBe("<p>Markedet</p>");
    expect(inserts[0][1][5]).toBe("<p>Boder.</p><p>Lukt av fisk.</p>");
    expect(inserts[0][1][6]).toBe(40 + 260 + 80);
    const conns = client.query.mock.calls.filter((c) => /INSERT INTO narrative_connections/.test(String(c[0])));
    expect(conns[0][1][3]).toBe("nel_1");
    expect(conns[0][1][6]).toBe("<p>Gå til markedet</p>");
    expect(conns[1][1][6]).toBe("<p>Kjøp sverd</p>");
  });

  it("enhance: patcher innholdet på kildeelementet", async () => {
    const client = makeClient([
      { match: /SELECT \* FROM narrative_elements WHERE id = \$1 AND project_id = \$2/, rows: [elementRow()] },
      { match: /UPDATE narrative_elements SET/, rows: [elementRow({ version: 2, content_html: "<p>Ny tekst</p>" })] },
    ]);
    const result = await narrativeElementApplier.apply(suggestion({ mode: "enhance", contentText: "Ny tekst", options: [] }), { client, projectId: "p1", userId: "u1" });
    expect(result).toMatchObject({ mode: "enhance", patchedElementId: "nel_1", version: 2 });
    const update = client.query.mock.calls.find((c) => /UPDATE narrative_elements SET/.test(String(c[0])))!;
    expect(update[1]).toContain("<p>Ny tekst</p>");
  });

  it("branches: forgrening med betingelser, kobling fra kilden, stub + kobling per betingelse (sourceOutputKey = betingelses-id)", async () => {
    const client = makeClient([
      { match: /SELECT \* FROM narrative_elements WHERE id = \$1 AND project_id = \$2/, rows: [elementRow()] },
      { match: /INSERT INTO narrative_elements/, rows: insertElement },
      { match: /SELECT id FROM narrative_elements WHERE project_id = \$1 AND id = ANY/, rows: (p) => (p[1] as string[]).map((id) => ({ id })) },
      { match: /INSERT INTO narrative_connections/, rows: insertConnection },
    ]);
    const result = await narrativeElementApplier.apply(suggestion({
      mode: "branches", title: "Har du gull?", contentText: "", options: [],
      branches: [{ script: "gold >= 10", label: "Rik", targetTitle: "Rik" }, { script: null, label: "Ellers", targetTitle: "Fattig" }],
    }), { client, projectId: "p1", userId: "u1" });
    expect(result.mode).toBe("branches");
    expect((result.createdElementIds as string[])).toHaveLength(3);
    const inserts = client.query.mock.calls.filter((c) => /INSERT INTO narrative_elements/.test(String(c[0])));
    expect(inserts[0][1][3]).toBe("branch");
    const conds = JSON.parse(String(inserts[0][1][14])) as Array<{ id: string; script: string | null }>;
    expect(conds.map((c) => c.script)).toEqual(["gold >= 10", null]);
    const conns = client.query.mock.calls.filter((c) => /INSERT INTO narrative_connections/.test(String(c[0])));
    expect(conns).toHaveLength(3);
    expect(conns[1][1][5]).toBe(conds[0].id);
    expect(conns[2][1][5]).toBe(conds[1].id);
  });

  it("kildeelement borte → kaster (transaksjonen rulles tilbake)", async () => {
    const client = makeClient([]);
    await expect(narrativeElementApplier.apply(suggestion({}), { client, projectId: "p1", userId: "u1" })).rejects.toThrow(/finnes ikke lenger/);
  });
});
