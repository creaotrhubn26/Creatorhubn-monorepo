/**
 * MagicMask + Dolby Vision + timeline.getCurrentItem e2e — verifiserer
 * hele dispatcher-kjeden uten ekte Resolve.
 */

import { test, expect } from "@playwright/test";
import {
  PHOTOSHOP_TOOLS,
  runPhotoshopTool,
  type ClaudeToolUseBlock,
} from "../src/agents/photoshopTools";

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

test.describe("Resolve 21 MagicMask + Dolby Vision-tools", () => {
  test("Alle 4 nye tools er registrert i PHOTOSHOP_TOOLS", () => {
    const expected = [
      "photoshop_resolve_timeline_get_current_item",
      "photoshop_resolve_magic_mask_create",
      "photoshop_resolve_magic_mask_regenerate",
      "photoshop_resolve_dolby_vision_analyze",
    ];
    for (const name of expected) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name)).toBeTruthy();
    }
  });

  test("timeline.getCurrentItem found:true", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        found: true,
        name: "GH010053.MP4",
        start_frame: 0,
        end_frame: 240,
        duration_frames: 240,
        media_pool_item_id: "mpi_001",
        clip_name: "GH010053.MP4",
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t1",
      name: "photoshop_resolve_timeline_get_current_item",
      input: {},
    });
    expect(result.is_error).toBeFalsy();
    const parsed = JSON.parse(result.content as string);
    expect(parsed.found).toBe(true);
    expect(parsed.clip_name).toBe("GH010053.MP4");
    expect(parsed.duration_frames).toBe(240);
  });

  test("timeline.getCurrentItem found:false når ingen valgt", async () => {
    const records = { calls: [] as MockInvoke[], response: { found: false } };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t2",
      name: "photoshop_resolve_timeline_get_current_item",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.found).toBe(false);
  });

  test("magicMask.create default mode = BI", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { item_name: "GH010053.MP4", mode: "BI", success: true },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t3",
      name: "photoshop_resolve_magic_mask_create",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.mode).toBe("BI");
    expect(parsed.success).toBe(true);

    // Verifiser at args inkluderer mode: "BI"
    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    expect(sendCall).toBeTruthy();
    const params = sendCall!.params as { params: unknown };
    expect(params.params).toEqual({ mode: "BI" });
  });

  test("magicMask.create mode=F forward-tracking", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { item_name: "clip", mode: "F", success: true },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t4",
      name: "photoshop_resolve_magic_mask_create",
      input: { mode: "F" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.mode).toBe("F");
  });

  test("magicMask.regenerate uten args", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { item_name: "clip", success: true },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t5",
      name: "photoshop_resolve_magic_mask_regenerate",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.success).toBe(true);
  });

  test("dolbyVision.analyze returnerer success", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { timeline: "Main", success: true, scope: "all_items" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t6",
      name: "photoshop_resolve_dolby_vision_analyze",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.timeline).toBe("Main");
    expect(parsed.scope).toBe("all_items");
  });

  test("Dispatcher fanger feilrespons fra plugin", async () => {
    // Mock som returnerer en errorrespons fra resolve.sendCommand
    const records = {
      calls: [] as MockInvoke[],
      response: null,
    };
    installInvokeMock(records);
    // Override så det kastes feil
    const internals = {
      invoke: async (cmd: string) => {
        if (cmd === "photoshop_send_command") {
          throw new Error("Timeout: Resolve svarte ikke");
        }
        return null;
      },
    };
    (globalThis as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = internals;
    ((globalThis as unknown as { window: { __TAURI_INTERNALS__?: unknown } }).window).__TAURI_INTERNALS__ = internals;

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t7",
      name: "photoshop_resolve_magic_mask_create",
      input: {},
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/Timeout/);
  });
});
