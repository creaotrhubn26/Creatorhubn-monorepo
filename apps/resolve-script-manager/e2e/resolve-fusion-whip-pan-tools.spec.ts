/**
 * Whip Pan helper e2e — DirectionalBlur med animated bell-curve.
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

test.describe("fusionComp.addWhipPan", () => {
  test("Tool er registrert", () => {
    expect(
      PHOTOSHOP_TOOLS.find((t) => t.name === "photoshop_resolve_fusion_comp_add_whip_pan"),
    ).toBeTruthy();
  });

  test("Sender alle felter med horizontal default", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        added: true,
        name: "DirectionalBlur1",
        target: "MediaIn1",
        angle: 0,
        start_frame: 20,
        end_frame: 30,
        peak_strength: 0.15,
        connected_to_target: true,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "w1",
      name: "photoshop_resolve_fusion_comp_add_whip_pan",
      input: {
        target_tool: "MediaIn1",
        start_frame: 20,
        end_frame: 30,
        peak_strength: 0.15,
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: {
        target_tool: string;
        direction: string;
        start_frame: number;
        end_frame: number;
        peak_strength?: number;
      };
    };
    expect(params.command).toBe("resolve.fusionCompAddWhipPan");
    expect(params.params.target_tool).toBe("MediaIn1");
    expect(params.params.direction).toBe("horizontal");
    expect(params.params.peak_strength).toBe(0.15);
  });

  test("Direction-presets aksepteres", async () => {
    for (const direction of ["horizontal", "vertical", "diagonal_up", "diagonal_down"]) {
      const records = {
        calls: [] as MockInvoke[],
        response: {
          added: true,
          name: "x",
          target: "T",
          angle: 0,
          start_frame: 0,
          end_frame: 10,
          peak_strength: 0.1,
          connected_to_target: true,
        },
      };
      installInvokeMock(records);
      await runPhotoshopTool({
        type: "tool_use",
        id: `d-${direction}`,
        name: "photoshop_resolve_fusion_comp_add_whip_pan",
        input: { target_tool: "T", direction, start_frame: 0, end_frame: 10 },
      });
      const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
      const params = sendCall!.params as { params: { direction: string } };
      expect(params.params.direction).toBe(direction);
    }
  });

  test("Custom angle (tall) aksepteres som direction-string", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        added: true,
        name: "DirectionalBlur1",
        target: "T",
        angle: 135,
        start_frame: 0,
        end_frame: 10,
        peak_strength: 0.1,
        connected_to_target: true,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "a1",
      name: "photoshop_resolve_fusion_comp_add_whip_pan",
      input: { target_tool: "T", direction: "135", start_frame: 0, end_frame: 10 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { direction: string } };
    expect(params.params.direction).toBe("135");
  });

  test("Avviser end_frame <= start_frame", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e1",
      name: "photoshop_resolve_fusion_comp_add_whip_pan",
      input: { target_tool: "T", start_frame: 30, end_frame: 20 },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/end_frame/);
  });

  test("Avviser peak_strength < 0", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e2",
      name: "photoshop_resolve_fusion_comp_add_whip_pan",
      input: {
        target_tool: "T",
        start_frame: 0,
        end_frame: 10,
        peak_strength: -1,
      },
    });
    expect(result.is_error).toBe(true);
  });

  test("Avviser non-number start_frame", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e3",
      name: "photoshop_resolve_fusion_comp_add_whip_pan",
      input: { target_tool: "T", start_frame: "0", end_frame: 10 },
    });
    expect(result.is_error).toBe(true);
  });

  test("Avviser tom target_tool", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e4",
      name: "photoshop_resolve_fusion_comp_add_whip_pan",
      input: { target_tool: "", start_frame: 0, end_frame: 10 },
    });
    expect(result.is_error).toBe(true);
  });

  test("comp_name videresendes", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        added: true,
        name: "x",
        target: "T",
        angle: 0,
        start_frame: 0,
        end_frame: 10,
        peak_strength: 0.1,
        connected_to_target: true,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "c1",
      name: "photoshop_resolve_fusion_comp_add_whip_pan",
      input: {
        target_tool: "T",
        start_frame: 0,
        end_frame: 10,
        comp_name: "WhipTransition",
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { comp_name?: string } };
    expect(params.params.comp_name).toBe("WhipTransition");
  });
});
