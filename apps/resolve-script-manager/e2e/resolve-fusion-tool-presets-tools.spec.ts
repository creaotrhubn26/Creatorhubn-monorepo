/**
 * Fusion tool-presets e2e — saveToolPreset + loadToolPreset.
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
  "photoshop_resolve_fusion_comp_save_tool_preset",
  "photoshop_resolve_fusion_comp_load_tool_preset",
];

test.describe("Fusion tool-presets", () => {
  test("Alle 2 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  // ────── saveToolPreset ──────

  test("saveToolPreset sender tool_name + file_path", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        saved: true,
        tool: "Text1",
        file_path: "/templates/Wedding-Title.setting",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "s1",
      name: "photoshop_resolve_fusion_comp_save_tool_preset",
      input: {
        tool_name: "Text1",
        file_path: "/templates/Wedding-Title.setting",
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { tool_name: string; file_path: string };
    };
    expect(params.command).toBe("resolve.fusionCompSaveToolPreset");
    expect(params.params.tool_name).toBe("Text1");
    expect(params.params.file_path).toBe("/templates/Wedding-Title.setting");
  });

  test("saveToolPreset avviser non-.setting filtype", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s2",
      name: "photoshop_resolve_fusion_comp_save_tool_preset",
      input: { tool_name: "Text1", file_path: "/x.json" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/\.setting/);
  });

  test("saveToolPreset avviser tom tool_name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s3",
      name: "photoshop_resolve_fusion_comp_save_tool_preset",
      input: { tool_name: "", file_path: "/x.setting" },
    });
    expect(result.is_error).toBe(true);
  });

  test("saveToolPreset videresender comp_name", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { saved: true, tool: "x", file_path: "/p.setting" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "s4",
      name: "photoshop_resolve_fusion_comp_save_tool_preset",
      input: {
        tool_name: "x",
        file_path: "/p.setting",
        comp_name: "TitleComp",
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { comp_name?: string } };
    expect(params.params.comp_name).toBe("TitleComp");
  });

  // ────── loadToolPreset ──────

  test("loadToolPreset paste-modus (uten target)", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { loaded: true, mode: "paste", file_path: "/p.setting" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "l1",
      name: "photoshop_resolve_fusion_comp_load_tool_preset",
      input: { file_path: "/p.setting" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { file_path: string; target_tool_name?: string };
    };
    expect(params.command).toBe("resolve.fusionCompLoadToolPreset");
    expect(params.params.file_path).toBe("/p.setting");
    expect(params.params.target_tool_name).toBeUndefined();
  });

  test("loadToolPreset overwrite-modus (med target_tool_name)", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        loaded: true,
        mode: "overwrite",
        target: "Text1",
        file_path: "/p.setting",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "l2",
      name: "photoshop_resolve_fusion_comp_load_tool_preset",
      input: { file_path: "/p.setting", target_tool_name: "Text1" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: { target_tool_name?: string };
    };
    expect(params.params.target_tool_name).toBe("Text1");
  });

  test("loadToolPreset med x+y for posisjonering i paste-modus", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { loaded: true, mode: "paste", file_path: "/p.setting" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "l3",
      name: "photoshop_resolve_fusion_comp_load_tool_preset",
      input: { file_path: "/p.setting", x: 100, y: 50 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { x?: number; y?: number } };
    expect(params.params.x).toBe(100);
    expect(params.params.y).toBe(50);
  });

  test("loadToolPreset avviser non-.setting filtype", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "l4",
      name: "photoshop_resolve_fusion_comp_load_tool_preset",
      input: { file_path: "/x.zip" },
    });
    expect(result.is_error).toBe(true);
  });

  test("loadToolPreset avviser tom file_path", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "l5",
      name: "photoshop_resolve_fusion_comp_load_tool_preset",
      input: { file_path: "" },
    });
    expect(result.is_error).toBe(true);
  });
});
