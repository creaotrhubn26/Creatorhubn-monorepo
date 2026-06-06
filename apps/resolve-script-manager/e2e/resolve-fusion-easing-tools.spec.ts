/**
 * Fusion easing curves e2e — setKeyframeEasing for profesjonell animasjon.
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

const VALID_EASING = [
  "linear",
  "ease_in",
  "ease_out",
  "ease_in_out",
  "smooth",
  "hold",
];

test.describe("Fusion easing curves", () => {
  test("Tool er registrert", () => {
    expect(
      PHOTOSHOP_TOOLS.find(
        (t) => t.name === "photoshop_resolve_fusion_comp_set_keyframe_easing",
      ),
    ).toBeTruthy();
  });

  test("Tool schema-enum inkluderer alle 6 easing-typer", () => {
    const tool = PHOTOSHOP_TOOLS.find(
      (t) => t.name === "photoshop_resolve_fusion_comp_set_keyframe_easing",
    );
    const schema = tool!.input_schema as {
      properties: { easing: { enum: string[] } };
    };
    expect(schema.properties.easing.enum.sort()).toEqual(VALID_EASING.sort());
  });

  test("Hver gyldig easing-type aksepteres", async () => {
    for (const easing of VALID_EASING) {
      const records = {
        calls: [] as MockInvoke[],
        response: {
          applied: 3,
          tool: "Text1",
          input: "Size",
          easing,
          scope: "all",
        },
      };
      installInvokeMock(records);
      const result = await runPhotoshopTool({
        type: "tool_use",
        id: `e-${easing}`,
        name: "photoshop_resolve_fusion_comp_set_keyframe_easing",
        input: { tool_name: "Text1", input_name: "Size", easing },
      });
      expect(result.is_error, `${easing} skulle ikke feilet`).toBeUndefined();
    }
  });

  test("Uten time = apply til alle keyframes (scope='all')", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        applied: 4,
        tool: "Text1",
        input: "Size",
        easing: "ease_out",
        scope: "all",
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "a1",
      name: "photoshop_resolve_fusion_comp_set_keyframe_easing",
      input: { tool_name: "Text1", input_name: "Size", easing: "ease_out" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.applied).toBe(4);
    expect(parsed.scope).toBe("all");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { time?: number } };
    expect(params.params.time).toBeUndefined();
  });

  test("Med time = apply kun til den keyframen", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        applied: 1,
        tool: "T",
        input: "Size",
        easing: "ease_in_out",
        scope: "frame:30",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "a2",
      name: "photoshop_resolve_fusion_comp_set_keyframe_easing",
      input: {
        tool_name: "T",
        input_name: "Size",
        easing: "ease_in_out",
        time: 30,
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { time?: number } };
    expect(params.params.time).toBe(30);
  });

  test("Avviser ugyldig easing", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e1",
      name: "photoshop_resolve_fusion_comp_set_keyframe_easing",
      input: { tool_name: "T", input_name: "Size", easing: "wibble" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/wibble/);
  });

  test("Avviser manglende tool_name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e2",
      name: "photoshop_resolve_fusion_comp_set_keyframe_easing",
      input: { tool_name: "", input_name: "Size", easing: "linear" },
    });
    expect(result.is_error).toBe(true);
  });

  test("Avviser manglende input_name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e3",
      name: "photoshop_resolve_fusion_comp_set_keyframe_easing",
      input: { tool_name: "T", input_name: "", easing: "linear" },
    });
    expect(result.is_error).toBe(true);
  });

  test("comp_name videresendes", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { applied: 2, tool: "T", input: "Size", easing: "smooth", scope: "all" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "c1",
      name: "photoshop_resolve_fusion_comp_set_keyframe_easing",
      input: {
        tool_name: "T",
        input_name: "Size",
        easing: "smooth",
        comp_name: "TitleAnim",
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { comp_name?: string } };
    expect(params.params.comp_name).toBe("TitleAnim");
  });

  test("Float-tid støttes (sub-frame)", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { applied: 1, tool: "T", input: "S", easing: "ease_out", scope: "frame:30.5" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "f1",
      name: "photoshop_resolve_fusion_comp_set_keyframe_easing",
      input: {
        tool_name: "T",
        input_name: "S",
        easing: "ease_out",
        time: 30.5,
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { time?: number } };
    expect(params.params.time).toBe(30.5);
  });
});
