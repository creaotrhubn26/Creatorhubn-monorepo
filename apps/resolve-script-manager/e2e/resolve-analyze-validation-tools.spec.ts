/**
 * Slate marker-validation + AnalyzeForIntellisearch trigger e2e.
 */

import { test, expect } from "@playwright/test";
import { PHOTOSHOP_TOOLS, runPhotoshopTool } from "../src/agents/photoshopTools";
import { SLATE_MARKER_COLORS } from "../src/services/photoshopBridgeService";

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

test.describe("Resolve slate + intellisearch analyze", () => {
  test("photoshop_resolve_intellisearch_analyze er registrert", () => {
    expect(
      PHOTOSHOP_TOOLS.find((t) => t.name === "photoshop_resolve_intellisearch_analyze"),
    ).toBeTruthy();
  });

  test("Slate-tool enum dekker alle 16 marker-farger", () => {
    const tool = PHOTOSHOP_TOOLS.find((t) => t.name === "photoshop_resolve_slate_analyze");
    expect(tool).toBeTruthy();
    const schema = tool!.input_schema as {
      properties: { marker_color: { enum: string[] } };
    };
    expect(schema.properties.marker_color.enum.sort()).toEqual(
      [...SLATE_MARKER_COLORS].sort(),
    );
  });

  test("slate.analyze med gyldig marker_color sendes til Resolve", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { scope: "folder", success: true, marker_color: "Cyan" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "a1",
      name: "photoshop_resolve_slate_analyze",
      input: { marker_color: "Cyan" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.success).toBe(true);
    expect(parsed.marker_color).toBe("Cyan");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { marker_color: string } };
    expect(params.params.marker_color).toBe("Cyan");
  });

  test("slate.analyze avviser ugyldig marker_color", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "a2",
      name: "photoshop_resolve_slate_analyze",
      input: { marker_color: "Magenta" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/Magenta/);
    expect(records.calls.some((c) => c.command === "photoshop_send_command")).toBe(false);
  });

  test("slate.analyze uten marker_color faller tilbake til default i Lua", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { scope: "folder", success: true, marker_color: "Yellow" },
    };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "a3",
      name: "photoshop_resolve_slate_analyze",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.marker_color).toBe("Yellow");
  });

  test("intellisearch.analyze defaults: identify_faces=false, better_mode=false", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        scope: "folder",
        target: "Master",
        success: true,
        identify_faces: false,
        better_mode: false,
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "i1",
      name: "photoshop_resolve_intellisearch_analyze",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.scope).toBe("folder");
    expect(parsed.identify_faces).toBe(false);
    expect(parsed.better_mode).toBe(false);

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { identify_faces: boolean; better_mode: boolean; clip_id?: string };
    };
    expect(params.command).toBe("resolve.intellisearchAnalyze");
    expect(params.params.identify_faces).toBe(false);
    expect(params.params.better_mode).toBe(false);
  });

  test("intellisearch.analyze med alle settings true + clip_id", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        scope: "item",
        target: "Hero shot",
        success: true,
        identify_faces: true,
        better_mode: true,
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "i2",
      name: "photoshop_resolve_intellisearch_analyze",
      input: { clip_id: "mp_42", identify_faces: true, better_mode: true },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.scope).toBe("item");
    expect(parsed.identify_faces).toBe(true);
    expect(parsed.better_mode).toBe(true);

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: { identify_faces: boolean; better_mode: boolean; clip_id?: string };
    };
    expect(params.params.clip_id).toBe("mp_42");
    expect(params.params.identify_faces).toBe(true);
    expect(params.params.better_mode).toBe(true);
  });

  test("intellisearch.analyze coerces truthy non-true til false (safety)", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        scope: "folder",
        target: "Master",
        success: true,
        identify_faces: false,
        better_mode: false,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "i3",
      name: "photoshop_resolve_intellisearch_analyze",
      input: { identify_faces: "yes", better_mode: 1 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: { identify_faces: boolean; better_mode: boolean };
    };
    expect(params.params.identify_faces).toBe(false);
    expect(params.params.better_mode).toBe(false);
  });
});
