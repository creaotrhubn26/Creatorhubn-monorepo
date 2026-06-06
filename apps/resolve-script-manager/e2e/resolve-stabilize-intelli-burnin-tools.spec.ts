/**
 * Stabilize + IntelliReset + BurnInPreset e2e — 3 nye tools.
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
  "photoshop_resolve_clip_stabilize",
  "photoshop_resolve_folder_intelli_reset",
  "photoshop_resolve_clip_load_burn_in_preset",
];

test.describe("Resolve Stabilize + IntelliReset + BurnInPreset", () => {
  test("Alle 3 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  test("clip.stabilize kalles uten args", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { stabilized: true, item: "Drone shot" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s1",
      name: "photoshop_resolve_clip_stabilize",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.stabilized).toBe(true);
    expect(parsed.item).toBe("Drone shot");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string };
    expect(params.command).toBe("resolve.clipStabilize");
  });

  test("clip.stabilize returnerer false hvis Resolve feiler", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { stabilized: false, item: "Static shot" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s2",
      name: "photoshop_resolve_clip_stabilize",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.stabilized).toBe(false);
  });

  test("folder.intelliReset kalles uten args", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { reset: true, folder: "Wedding" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "i1",
      name: "photoshop_resolve_folder_intelli_reset",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.reset).toBe(true);

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string };
    expect(params.command).toBe("resolve.folderIntelliReset");
  });

  test("clip.loadBurnInPreset sender preset_name", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        loaded: true,
        preset_name: "Timecode + Clip Name",
        item: "shot_001",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "b1",
      name: "photoshop_resolve_clip_load_burn_in_preset",
      input: { preset_name: "Timecode + Clip Name" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { preset_name: string };
    };
    expect(params.command).toBe("resolve.clipLoadBurnInPreset");
    expect(params.params.preset_name).toBe("Timecode + Clip Name");
  });

  test("clip.loadBurnInPreset avviser tom preset_name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "b2",
      name: "photoshop_resolve_clip_load_burn_in_preset",
      input: { preset_name: "" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/preset_name/);
  });

  test("clip.loadBurnInPreset avviser non-string preset_name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "b3",
      name: "photoshop_resolve_clip_load_burn_in_preset",
      input: { preset_name: 42 },
    });
    expect(result.is_error).toBe(true);
  });
});
