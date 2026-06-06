/**
 * Subtitle .srt-import e2e — verifiserer subtitle.importFromFile-tool.
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

test.describe("Resolve subtitle import", () => {
  test("Tool er registrert", () => {
    expect(
      PHOTOSHOP_TOOLS.find((t) => t.name === "photoshop_resolve_subtitle_import_from_file"),
      "mangler photoshop_resolve_subtitle_import_from_file",
    ).toBeTruthy();
  });

  test("Importerer .srt til Media Pool uten timeline-append", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        imported: true,
        name: "wedding-nb.srt",
        clip_id: "abc123",
        path: "/Users/x/wedding-nb.srt",
        appended: false,
        timeline_items: 0,
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s1",
      name: "photoshop_resolve_subtitle_import_from_file",
      input: { file_path: "/Users/x/wedding-nb.srt" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.imported).toBe(true);
    expect(parsed.appended).toBe(false);
    expect(parsed.name).toBe("wedding-nb.srt");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { file_path: string; append_to_timeline?: boolean };
    };
    expect(params.command).toBe("resolve.subtitleImportFromFile");
    expect(params.params.file_path).toBe("/Users/x/wedding-nb.srt");
    expect(params.params.append_to_timeline).toBe(false);
  });

  test("append_to_timeline=true sender flagg + returnerer timeline_items", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        imported: true,
        name: "wedding-en.srt",
        clip_id: "def456",
        path: "/srt/en.srt",
        appended: true,
        timeline_items: 1,
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s2",
      name: "photoshop_resolve_subtitle_import_from_file",
      input: { file_path: "/srt/en.srt", append_to_timeline: true },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.appended).toBe(true);
    expect(parsed.timeline_items).toBe(1);

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { append_to_timeline?: boolean } };
    expect(params.params.append_to_timeline).toBe(true);
  });

  test("Avviser tomt file_path", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s3",
      name: "photoshop_resolve_subtitle_import_from_file",
      input: { file_path: "" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/file_path/);
  });

  test("Avviser mangler file_path", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s4",
      name: "photoshop_resolve_subtitle_import_from_file",
      input: {},
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/file_path/);
  });

  test("Avviser non-string file_path", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s5",
      name: "photoshop_resolve_subtitle_import_from_file",
      input: { file_path: 42 },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/file_path/);
  });
});
