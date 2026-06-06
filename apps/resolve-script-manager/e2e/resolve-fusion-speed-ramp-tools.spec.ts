/**
 * Speed Ramp helper e2e — TimeSpeed med animated Speed input.
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

const VALID_RAMP_TYPES = ["in", "out", "in_out", "bullet_time"];

test.describe("fusionComp.addSpeedRamp", () => {
  test("Tool er registrert", () => {
    expect(
      PHOTOSHOP_TOOLS.find(
        (t) => t.name === "photoshop_resolve_fusion_comp_add_speed_ramp",
      ),
    ).toBeTruthy();
  });

  test("Default ramp_type = in_out", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        added: true,
        name: "TimeSpeed1",
        target: "MediaIn1",
        ramp_type: "in_out",
        start_frame: 0,
        end_frame: 60,
        slow_factor: 0.25,
        connected_to_target: true,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "s1",
      name: "photoshop_resolve_fusion_comp_add_speed_ramp",
      input: { target_tool: "MediaIn1", start_frame: 0, end_frame: 60 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { ramp_type: string };
    };
    expect(params.command).toBe("resolve.fusionCompAddSpeedRamp");
    expect(params.params.ramp_type).toBe("in_out");
  });

  test("Alle 4 ramp_type-presets aksepteres", async () => {
    for (const ramp_type of VALID_RAMP_TYPES) {
      const records = {
        calls: [] as MockInvoke[],
        response: {
          added: true,
          name: "TS",
          target: "T",
          ramp_type,
          start_frame: 0,
          end_frame: 30,
          slow_factor: 0.25,
          connected_to_target: true,
        },
      };
      installInvokeMock(records);
      await runPhotoshopTool({
        type: "tool_use",
        id: `r-${ramp_type}`,
        name: "photoshop_resolve_fusion_comp_add_speed_ramp",
        input: { target_tool: "T", ramp_type, start_frame: 0, end_frame: 30 },
      });
      const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
      const params = sendCall!.params as { params: { ramp_type: string } };
      expect(params.params.ramp_type).toBe(ramp_type);
    }
  });

  test("Custom slow_factor (slow-mo: 0.5)", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        added: true,
        name: "TS",
        target: "T",
        ramp_type: "in_out",
        start_frame: 0,
        end_frame: 30,
        slow_factor: 0.5,
        connected_to_target: true,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "f1",
      name: "photoshop_resolve_fusion_comp_add_speed_ramp",
      input: { target_tool: "T", start_frame: 0, end_frame: 30, slow_factor: 0.5 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { slow_factor?: number } };
    expect(params.params.slow_factor).toBe(0.5);
  });

  test("Speed-up med slow_factor > 1.0", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        added: true,
        name: "TS",
        target: "T",
        ramp_type: "in_out",
        start_frame: 0,
        end_frame: 30,
        slow_factor: 2.0,
        connected_to_target: true,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "f2",
      name: "photoshop_resolve_fusion_comp_add_speed_ramp",
      input: { target_tool: "T", start_frame: 0, end_frame: 30, slow_factor: 2.0 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { slow_factor?: number } };
    expect(params.params.slow_factor).toBe(2.0);
  });

  test("Avviser ugyldig ramp_type", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e1",
      name: "photoshop_resolve_fusion_comp_add_speed_ramp",
      input: {
        target_tool: "T",
        ramp_type: "yoyo",
        start_frame: 0,
        end_frame: 30,
      },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/yoyo/);
  });

  test("Avviser end_frame <= start_frame", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e2",
      name: "photoshop_resolve_fusion_comp_add_speed_ramp",
      input: { target_tool: "T", start_frame: 30, end_frame: 10 },
    });
    expect(result.is_error).toBe(true);
  });

  test("Avviser slow_factor <= 0", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e3",
      name: "photoshop_resolve_fusion_comp_add_speed_ramp",
      input: {
        target_tool: "T",
        start_frame: 0,
        end_frame: 30,
        slow_factor: 0,
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
      name: "photoshop_resolve_fusion_comp_add_speed_ramp",
      input: { target_tool: "", start_frame: 0, end_frame: 10 },
    });
    expect(result.is_error).toBe(true);
  });

  test("comp_name videresendes", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        added: true,
        name: "TS",
        target: "T",
        ramp_type: "in_out",
        start_frame: 0,
        end_frame: 30,
        slow_factor: 0.25,
        connected_to_target: true,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "c1",
      name: "photoshop_resolve_fusion_comp_add_speed_ramp",
      input: {
        target_tool: "T",
        start_frame: 0,
        end_frame: 30,
        comp_name: "SlowMoKiss",
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { comp_name?: string } };
    expect(params.params.comp_name).toBe("SlowMoKiss");
  });

  test("Bullet time use-case (dramatic)", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        added: true,
        name: "TS",
        target: "T",
        ramp_type: "bullet_time",
        start_frame: 0,
        end_frame: 120,
        slow_factor: 0.1,
        connected_to_target: true,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "bt1",
      name: "photoshop_resolve_fusion_comp_add_speed_ramp",
      input: {
        target_tool: "T",
        ramp_type: "bullet_time",
        start_frame: 0,
        end_frame: 120,
        slow_factor: 0.1,
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: { ramp_type: string; slow_factor?: number };
    };
    expect(params.params.ramp_type).toBe("bullet_time");
    expect(params.params.slow_factor).toBe(0.1);
  });
});
