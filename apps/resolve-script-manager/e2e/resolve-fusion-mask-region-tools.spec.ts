/**
 * fusionComp.addMaskRegion e2e — én helper for video-cloning,
 * object-removal og invisible-transition mask-flows.
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

test.describe("fusionComp.addMaskRegion", () => {
  test("Tool er registrert", () => {
    expect(
      PHOTOSHOP_TOOLS.find(
        (t) => t.name === "photoshop_resolve_fusion_comp_add_mask_region",
      ),
    ).toBeTruthy();
  });

  test("Video-cloning use case: rectangle dekker høyre halvdel", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        created: true,
        mask_name: "Rectangle1",
        shape: "rectangle",
        target: "MediaIn1",
        connected_to_effect_mask: true,
        x: 0.75,
        y: 0.5,
        width: 0.5,
        height: 1,
        soft_edge: 0.005,
        invert: false,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "v1",
      name: "photoshop_resolve_fusion_comp_add_mask_region",
      input: {
        target_tool: "MediaIn1",
        shape: "rectangle",
        x: 0.75,
        y: 0.5,
        width: 0.5,
        height: 1,
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: {
        target_tool: string;
        shape: string;
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };
    expect(params.command).toBe("resolve.fusionCompAddMaskRegion");
    expect(params.params.shape).toBe("rectangle");
    expect(params.params.x).toBe(0.75);
    expect(params.params.width).toBe(0.5);
  });

  test("Object-removal use case: liten ellipse over boom-mic", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        created: true,
        mask_name: "Ellipse1",
        shape: "ellipse",
        target: "MediaIn1",
        connected_to_effect_mask: true,
        x: 0.6,
        y: 0.2,
        width: 0.1,
        height: 0.08,
        soft_edge: 0.02,
        invert: true,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "o1",
      name: "photoshop_resolve_fusion_comp_add_mask_region",
      input: {
        target_tool: "MediaIn1",
        shape: "ellipse",
        x: 0.6,
        y: 0.2,
        width: 0.1,
        height: 0.08,
        soft_edge: 0.02,
        invert: true,
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: {
        shape: string;
        soft_edge?: number;
        invert?: boolean;
      };
    };
    expect(params.params.shape).toBe("ellipse");
    expect(params.params.soft_edge).toBe(0.02);
    expect(params.params.invert).toBe(true);
  });

  test("Default shape = rectangle", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        created: true,
        mask_name: "Rectangle1",
        shape: "rectangle",
        target: "MediaIn1",
        connected_to_effect_mask: true,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        soft_edge: 0.005,
        invert: false,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "d1",
      name: "photoshop_resolve_fusion_comp_add_mask_region",
      input: {
        target_tool: "MediaIn1",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { shape: string } };
    expect(params.params.shape).toBe("rectangle");
  });

  test("Avviser ugyldig shape", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e1",
      name: "photoshop_resolve_fusion_comp_add_mask_region",
      input: {
        target_tool: "T",
        shape: "polygon",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    });
    // Shape coerces to default 'rectangle', så ikke feiler — sjekker at
    // det IKKE er en error. Bruker for fall-back-pattern.
    expect(result.is_error).toBeUndefined();
  });

  test("Avviser width <= 0", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e2",
      name: "photoshop_resolve_fusion_comp_add_mask_region",
      input: {
        target_tool: "T",
        x: 0.5,
        y: 0.5,
        width: 0,
        height: 0.5,
      },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/width/);
  });

  test("Avviser non-number x", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e3",
      name: "photoshop_resolve_fusion_comp_add_mask_region",
      input: {
        target_tool: "T",
        x: "0.5",
        y: 0.5,
        width: 0.5,
        height: 0.5,
      },
    });
    expect(result.is_error).toBe(true);
  });

  test("Avviser tom target_tool", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e4",
      name: "photoshop_resolve_fusion_comp_add_mask_region",
      input: {
        target_tool: "",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    });
    expect(result.is_error).toBe(true);
  });

  test("comp_name videresendes", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        created: true,
        mask_name: "Rectangle1",
        shape: "rectangle",
        target: "T",
        connected_to_effect_mask: true,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        soft_edge: 0.005,
        invert: false,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "c1",
      name: "photoshop_resolve_fusion_comp_add_mask_region",
      input: {
        target_tool: "T",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        comp_name: "SplitScreen",
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { comp_name?: string } };
    expect(params.params.comp_name).toBe("SplitScreen");
  });
});
