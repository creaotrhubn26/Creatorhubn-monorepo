/**
 * Fusion Tracker e2e — trackerTrack + trackerGetCenter.
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
  "photoshop_resolve_fusion_comp_tracker_track",
  "photoshop_resolve_fusion_comp_tracker_get_center",
];

test.describe("Fusion Tracker tools", () => {
  test("Alle 2 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  // ────── trackerTrack ──────

  test("trackerTrack default direction = forward", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { tracked: true, tool: "Tracker1", direction: "forward" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "t1",
      name: "photoshop_resolve_fusion_comp_tracker_track",
      input: { tool_name: "Tracker1" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { tool_name: string; direction: string };
    };
    expect(params.command).toBe("resolve.fusionCompTrackerTrack");
    expect(params.params.direction).toBe("forward");
  });

  test("trackerTrack direction=backward", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { tracked: true, tool: "Tracker1", direction: "backward" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "t2",
      name: "photoshop_resolve_fusion_comp_tracker_track",
      input: { tool_name: "Tracker1", direction: "backward" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { direction: string } };
    expect(params.params.direction).toBe("backward");
  });

  test("trackerTrack ugyldig direction faller tilbake til forward", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { tracked: true, tool: "x", direction: "forward" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "t3",
      name: "photoshop_resolve_fusion_comp_tracker_track",
      input: { tool_name: "x", direction: "sideways" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { direction: string } };
    expect(params.params.direction).toBe("forward");
  });

  test("trackerTrack avviser tom tool_name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t4",
      name: "photoshop_resolve_fusion_comp_tracker_track",
      input: { tool_name: "" },
    });
    expect(result.is_error).toBe(true);
  });

  // ────── trackerGetCenter ──────

  test("trackerGetCenter returnerer x+y", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        found: true,
        tool: "Tracker1",
        time: 30,
        x: 0.5,
        y: 0.42,
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "g1",
      name: "photoshop_resolve_fusion_comp_tracker_get_center",
      input: { tool_name: "Tracker1", time: 30 },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.found).toBe(true);
    expect(parsed.x).toBeCloseTo(0.5);
    expect(parsed.y).toBeCloseTo(0.42);
  });

  test("trackerGetCenter returnerer found=false hvis ikke tracked", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        found: false,
        tool: "Tracker1",
        time: 30,
        reason: "Tracker ikke tracked enda",
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "g2",
      name: "photoshop_resolve_fusion_comp_tracker_get_center",
      input: { tool_name: "Tracker1", time: 30 },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.found).toBe(false);
    expect(parsed.reason).toMatch(/tracked/);
  });

  test("trackerGetCenter uten time sender ikke time-arg", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { found: true, tool: "T", time: 0, x: 0, y: 0 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "g3",
      name: "photoshop_resolve_fusion_comp_tracker_get_center",
      input: { tool_name: "T" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { time?: number } };
    expect(params.params.time).toBeUndefined();
  });

  test("trackerGetCenter avviser tom tool_name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "g4",
      name: "photoshop_resolve_fusion_comp_tracker_get_center",
      input: { tool_name: "" },
    });
    expect(result.is_error).toBe(true);
  });

  test("trackerGetCenter videresender comp_name", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { found: true, tool: "T", time: 0, x: 0, y: 0 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "g5",
      name: "photoshop_resolve_fusion_comp_tracker_get_center",
      input: { tool_name: "T", comp_name: "ScreenReplace" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { comp_name?: string } };
    expect(params.params.comp_name).toBe("ScreenReplace");
  });
});
