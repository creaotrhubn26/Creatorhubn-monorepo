/**
 * Voice Isolation + Gallery Import e2e — verifiserer 3 nye tools.
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
  "photoshop_resolve_voice_get_isolation_state",
  "photoshop_resolve_voice_set_isolation_state",
  "photoshop_resolve_gallery_import_stills",
];

test.describe("Resolve 21 Voice Isolation + Gallery Import", () => {
  test("Alle 3 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  test("voice.getIsolationState uten track_index leser fra valgt item", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { scope: "item", ref: "Interview shot", is_enabled: true, amount: 65 },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "v1",
      name: "photoshop_resolve_voice_get_isolation_state",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.scope).toBe("item");
    expect(parsed.is_enabled).toBe(true);
    expect(parsed.amount).toBe(65);

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: Record<string, unknown> };
    expect(params.command).toBe("resolve.voiceGetIsolationState");
    expect(params.params.track_index).toBeUndefined();
  });

  test("voice.getIsolationState med track_index leser fra audio-track", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { scope: "track", ref: "2", is_enabled: false, amount: 0 },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "v2",
      name: "photoshop_resolve_voice_get_isolation_state",
      input: { track_index: 2 },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.scope).toBe("track");
    expect(parsed.ref).toBe("2");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { track_index: number } };
    expect(params.params.track_index).toBe(2);
  });

  test("voice.setIsolationState aktiverer med amount=70 på valgt item", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        set: true,
        scope: "item",
        ref: "Doc clip",
        is_enabled: true,
        amount: 70,
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "v3",
      name: "photoshop_resolve_voice_set_isolation_state",
      input: { is_enabled: true, amount: 70 },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.set).toBe(true);
    expect(parsed.amount).toBe(70);

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { is_enabled: boolean; amount: number; track_index?: number };
    };
    expect(params.command).toBe("resolve.voiceSetIsolationState");
    expect(params.params.amount).toBe(70);
    expect(params.params.is_enabled).toBe(true);
    expect(params.params.track_index).toBeUndefined();
  });

  test("voice.setIsolationState med track_index sender til track", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, scope: "track", ref: "3", is_enabled: true, amount: 50 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "v4",
      name: "photoshop_resolve_voice_set_isolation_state",
      input: { track_index: 3, is_enabled: true, amount: 50 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { track_index: number } };
    expect(params.params.track_index).toBe(3);
  });

  test("voice.setIsolationState avviser amount > 100", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "v5",
      name: "photoshop_resolve_voice_set_isolation_state",
      input: { is_enabled: true, amount: 101 },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/0-100/);
  });

  test("voice.setIsolationState avviser amount < 0", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "v6",
      name: "photoshop_resolve_voice_set_isolation_state",
      input: { is_enabled: false, amount: -1 },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/0-100/);
  });

  test("voice.setIsolationState krever amount", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "v7",
      name: "photoshop_resolve_voice_set_isolation_state",
      input: { is_enabled: true },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/amount/i);
  });

  test("gallery.importStills med file_paths uten album_name → current", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { imported: true, album: "current", count: 2 },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "g1",
      name: "photoshop_resolve_gallery_import_stills",
      input: { file_paths: ["/grades/a.drx", "/grades/b.drx"] },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.imported).toBe(true);
    expect(parsed.count).toBe(2);
    expect(parsed.album).toBe("current");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { file_paths: string[]; album_name?: string };
    };
    expect(params.command).toBe("resolve.galleryImportStills");
    expect(params.params.file_paths).toEqual(["/grades/a.drx", "/grades/b.drx"]);
    expect(params.params.album_name).toBeUndefined();
  });

  test("gallery.importStills med album_name", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { imported: true, album: "Wedding LUTs", count: 1 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "g2",
      name: "photoshop_resolve_gallery_import_stills",
      input: { file_paths: ["/grades/cine.drx"], album_name: "Wedding LUTs" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { album_name?: string } };
    expect(params.params.album_name).toBe("Wedding LUTs");
  });

  test("gallery.importStills avviser tom array", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "g3",
      name: "photoshop_resolve_gallery_import_stills",
      input: { file_paths: [] },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/ikke-tom|empty|tom/i);
  });

  test("gallery.importStills avviser non-string i array", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "g4",
      name: "photoshop_resolve_gallery_import_stills",
      input: { file_paths: ["/grades/ok.drx", 42] },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/string/i);
  });
});
