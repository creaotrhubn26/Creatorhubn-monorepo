/**
 * Fusion animation e2e — keyframes + expressions + render-range + setCurrentTime.
 * 7 nye tools.
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
  "photoshop_resolve_fusion_comp_add_keyframe",
  "photoshop_resolve_fusion_comp_remove_keyframe",
  "photoshop_resolve_fusion_comp_list_keyframes",
  "photoshop_resolve_fusion_comp_set_expression",
  "photoshop_resolve_fusion_comp_remove_animation",
  "photoshop_resolve_fusion_comp_set_render_range",
  "photoshop_resolve_fusion_comp_set_current_time",
];

test.describe("Fusion animation tools registrert", () => {
  test("Alle 7 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });
});

test.describe("addKeyframe", () => {
  test("Sender alle felter inkl. value-konvertering", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        keyframed: true,
        tool: "Text1",
        input: "Size",
        time: 30,
        value: "1.0",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "k1",
      name: "photoshop_resolve_fusion_comp_add_keyframe",
      input: { tool_name: "Text1", input_name: "Size", time: 30, value: 1.0 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { tool_name: string; input_name: string; time: number; value: string };
    };
    expect(params.command).toBe("resolve.fusionCompAddKeyframe");
    expect(params.params.time).toBe(30);
    expect(params.params.value).toBe("1");
  });

  test("Tar string-verdier som-er", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { keyframed: true, tool: "x", input: "y", time: 0, value: "Bryllup" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "k2",
      name: "photoshop_resolve_fusion_comp_add_keyframe",
      input: {
        tool_name: "Text1",
        input_name: "StyledText",
        time: 0,
        value: "Bryllup",
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { value: string } };
    expect(params.params.value).toBe("Bryllup");
  });

  test("Float-tid støttes", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { keyframed: true, tool: "x", input: "y", time: 30.5, value: "0.5" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "k3",
      name: "photoshop_resolve_fusion_comp_add_keyframe",
      input: { tool_name: "x", input_name: "y", time: 30.5, value: 0.5 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { time: number } };
    expect(params.params.time).toBe(30.5);
  });

  test("Avviser manglende time", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "k4",
      name: "photoshop_resolve_fusion_comp_add_keyframe",
      input: { tool_name: "x", input_name: "y", value: 0 },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/time/);
  });

  test("Avviser manglende value", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "k5",
      name: "photoshop_resolve_fusion_comp_add_keyframe",
      input: { tool_name: "x", input_name: "y", time: 0 },
    });
    expect(result.is_error).toBe(true);
  });

  test("comp_name videresendes", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { keyframed: true, tool: "x", input: "y", time: 0, value: "0" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "k6",
      name: "photoshop_resolve_fusion_comp_add_keyframe",
      input: {
        tool_name: "x",
        input_name: "y",
        time: 0,
        value: 0,
        comp_name: "TitleComp",
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { comp_name?: string } };
    expect(params.params.comp_name).toBe("TitleComp");
  });
});

test.describe("removeKeyframe", () => {
  test("Sender tool+input+time", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { removed: true, tool: "T", input: "Size", time: 30 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "r1",
      name: "photoshop_resolve_fusion_comp_remove_keyframe",
      input: { tool_name: "T", input_name: "Size", time: 30 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { time: number } };
    expect(params.command).toBe("resolve.fusionCompRemoveKeyframe");
    expect(params.params.time).toBe(30);
  });

  test("Avviser non-number time", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "r2",
      name: "photoshop_resolve_fusion_comp_remove_keyframe",
      input: { tool_name: "x", input_name: "y", time: "30" },
    });
    expect(result.is_error).toBe(true);
  });
});

test.describe("listKeyframes", () => {
  test("Returnerer animated=false when not animated", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { animated: false, tool: "T", input: "Size", keyframes: [] },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "l1",
      name: "photoshop_resolve_fusion_comp_list_keyframes",
      input: { tool_name: "T", input_name: "Size" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.animated).toBe(false);
    expect(parsed.keyframes).toEqual([]);
  });

  test("Returnerer keyframes-array når animated", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        animated: true,
        tool: "T",
        input: "Size",
        count: 3,
        keyframes: [
          { time: 0, value: 0 },
          { time: 30, value: 1 },
          { time: 60, value: 0 },
        ],
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "l2",
      name: "photoshop_resolve_fusion_comp_list_keyframes",
      input: { tool_name: "T", input_name: "Size" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.animated).toBe(true);
    expect(parsed.keyframes.length).toBe(3);
    expect(parsed.keyframes[1].time).toBe(30);
  });
});

test.describe("setExpression", () => {
  test("Sender expression-string", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, tool: "x", input: "Center", expression: "time/100" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "e1",
      name: "photoshop_resolve_fusion_comp_set_expression",
      input: { tool_name: "x", input_name: "Center", expression: "time/100" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { expression: string };
    };
    expect(params.command).toBe("resolve.fusionCompSetExpression");
    expect(params.params.expression).toBe("time/100");
  });

  test("Tom string ryddes (gyldig)", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, tool: "x", input: "y", expression: "" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e2",
      name: "photoshop_resolve_fusion_comp_set_expression",
      input: { tool_name: "x", input_name: "y", expression: "" },
    });
    expect(result.is_error).toBeUndefined();
  });

  test("Avviser non-string expression", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e3",
      name: "photoshop_resolve_fusion_comp_set_expression",
      input: { tool_name: "x", input_name: "y", expression: 100 },
    });
    expect(result.is_error).toBe(true);
  });
});

test.describe("removeAnimation", () => {
  test("Sender tool+input", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { cleared: true, tool: "x", input: "y" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "ra1",
      name: "photoshop_resolve_fusion_comp_remove_animation",
      input: { tool_name: "x", input_name: "y" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string };
    expect(params.command).toBe("resolve.fusionCompRemoveAnimation");
  });
});

test.describe("setRenderRange", () => {
  test("Sender start+end", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, start: 0, end: 240 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "rr1",
      name: "photoshop_resolve_fusion_comp_set_render_range",
      input: { start: 0, end: 240 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { start: number; end: number };
    };
    expect(params.command).toBe("resolve.fusionCompSetRenderRange");
    expect(params.params.start).toBe(0);
    expect(params.params.end).toBe(240);
  });

  test("Avviser end < start", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "rr2",
      name: "photoshop_resolve_fusion_comp_set_render_range",
      input: { start: 100, end: 50 },
    });
    expect(result.is_error).toBe(true);
  });

  test("Avviser non-number start", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "rr3",
      name: "photoshop_resolve_fusion_comp_set_render_range",
      input: { start: "0", end: 240 },
    });
    expect(result.is_error).toBe(true);
  });
});

test.describe("setCurrentTime", () => {
  test("Sender time", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, time: 30, current_time: 30 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "t1",
      name: "photoshop_resolve_fusion_comp_set_current_time",
      input: { time: 30 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { time: number } };
    expect(params.command).toBe("resolve.fusionCompSetCurrentTime");
    expect(params.params.time).toBe(30);
  });

  test("Avviser non-number time", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t2",
      name: "photoshop_resolve_fusion_comp_set_current_time",
      input: { time: "30" },
    });
    expect(result.is_error).toBe(true);
  });
});
