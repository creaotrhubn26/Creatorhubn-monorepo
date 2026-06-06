/**
 * Color Graph + LUT-applikasjon e2e — verifiserer 6 nye tools.
 */

import { test, expect } from "@playwright/test";
import { PHOTOSHOP_TOOLS, runPhotoshopTool } from "../src/agents/photoshopTools";

interface MockInvoke {
  command: string;
  params?: unknown;
}

function installInvokeMock(records: { calls: MockInvoke[]; response: unknown }) {
  const internals = {
    invoke: async (cmd: string, args?: unknown) => {
      records.calls.push({ command: cmd, params: args });
      if (cmd === "photoshop_send_command") return records.response;
      return null;
    },
  };
  (globalThis as unknown as { window?: unknown }).window =
    (globalThis as unknown as { window?: unknown }).window ?? globalThis;
  (globalThis as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = internals;
  ((globalThis as unknown as { window: { __TAURI_INTERNALS__?: unknown } }).window).__TAURI_INTERNALS__ = internals;
}

const TOOL_NAMES = [
  "photoshop_resolve_lut_refresh",
  "photoshop_resolve_graph_get_nodes",
  "photoshop_resolve_graph_apply_lut",
  "photoshop_resolve_graph_apply_grade_from_drx",
  "photoshop_resolve_graph_reset_all_grades",
  "photoshop_resolve_graph_set_node_enabled",
];

test.describe("Resolve 21 Color Graph + LUT", () => {
  test("Alle 6 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  test("lut.refresh returnerer { refreshed }", async () => {
    const records = { calls: [] as MockInvoke[], response: { refreshed: true } };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t1",
      name: "photoshop_resolve_lut_refresh",
      input: {},
    });
    expect(JSON.parse(result.content as string).refreshed).toBe(true);
  });

  test("graph.getNodes returnerer node-array med LUT + tools", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        item: "Hero shot",
        num_nodes: 2,
        nodes: [
          { index: 1, label: "Primary", lut: "Cinematic.cube", tools: ["Curves", "HSL"] },
          { index: 2, label: "Secondary", lut: "", tools: ["Power Window"] },
        ],
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t2",
      name: "photoshop_resolve_graph_get_nodes",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.num_nodes).toBe(2);
    expect(parsed.nodes[0].lut).toBe("Cinematic.cube");
    expect(parsed.nodes[1].tools).toEqual(["Power Window"]);
  });

  test("graph.applyLUT med node_index + lut_path", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { applied: true, item: "Hero", node_index: 1, lut_path: "Cinematic.cube" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t3",
      name: "photoshop_resolve_graph_apply_lut",
      input: { node_index: 1, lut_path: "Cinematic.cube" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.applied).toBe(true);
    expect(parsed.lut_path).toBe("Cinematic.cube");
  });

  test("graph.applyLUT krever node_index", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t4",
      name: "photoshop_resolve_graph_apply_lut",
      input: { lut_path: "x.cube" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/node_index/i);
  });

  test("graph.applyLUT krever lut_path", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t5",
      name: "photoshop_resolve_graph_apply_lut",
      input: { node_index: 1 },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/lut_path/i);
  });

  test("graph.applyGradeFromDRX med default grade_mode=0", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { applied: true, item: "Hero", path: "/grades/cinematic.drx", grade_mode: 0 },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t6",
      name: "photoshop_resolve_graph_apply_grade_from_drx",
      input: { path: "/grades/cinematic.drx" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.applied).toBe(true);
    expect(parsed.grade_mode).toBe(0);
  });

  test("graph.applyGradeFromDRX med grade_mode=2", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { applied: true, item: "Hero", path: "/x.drx", grade_mode: 2 },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t7",
      name: "photoshop_resolve_graph_apply_grade_from_drx",
      input: { path: "/x.drx", grade_mode: 2 },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.grade_mode).toBe(2);

    // Verifiser at args inkluderer grade_mode: 2
    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { grade_mode: number } };
    expect(params.params.grade_mode).toBe(2);
  });

  test("graph.resetAllGrades", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { reset: true, item: "Hero" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t8",
      name: "photoshop_resolve_graph_reset_all_grades",
      input: {},
    });
    expect(JSON.parse(result.content as string).reset).toBe(true);
  });

  test("graph.setNodeEnabled true", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, item: "Hero", node_index: 2, enabled: true },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t9",
      name: "photoshop_resolve_graph_set_node_enabled",
      input: { node_index: 2, enabled: true },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.enabled).toBe(true);
  });

  test("graph.setNodeEnabled false", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, item: "Hero", node_index: 2, enabled: false },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t10",
      name: "photoshop_resolve_graph_set_node_enabled",
      input: { node_index: 2, enabled: false },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.enabled).toBe(false);
  });

  test("graph.setNodeEnabled krever node_index", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t11",
      name: "photoshop_resolve_graph_set_node_enabled",
      input: { enabled: true },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/node_index/i);
  });
});
