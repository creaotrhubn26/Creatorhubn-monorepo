/**
 * Subtitles + Track-management e2e — verifiserer 5 nye tools via
 * dispatcher uten ekte Resolve.
 */

import { test, expect } from "@playwright/test";
import {
  PHOTOSHOP_TOOLS,
  runPhotoshopTool,
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

const TOOL_NAMES = [
  "photoshop_resolve_subtitles_create_from_audio",
  "photoshop_resolve_track_add",
  "photoshop_resolve_track_delete",
  "photoshop_resolve_track_get_name",
  "photoshop_resolve_track_set_name",
];

test.describe("Resolve 21 Subtitles + Tracks", () => {
  test("Alle 5 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  test("subtitles.createFromAudio uten args → AUTO + DEFAULT", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        created: true,
        timeline: "Main",
        language: "AUTO",
        preset: "DEFAULT",
        chars_per_line: "default",
        line_break: "SINGLE",
        gap: 0,
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t1",
      name: "photoshop_resolve_subtitles_create_from_audio",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.created).toBe(true);
    expect(parsed.language).toBe("AUTO");
  });

  test("subtitles.createFromAudio med NORWEGIAN + NETFLIX-preset", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        created: true,
        timeline: "Main",
        language: "NORWEGIAN",
        preset: "NETFLIX",
        chars_per_line: "16",
        line_break: "SINGLE",
        gap: 0,
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t2",
      name: "photoshop_resolve_subtitles_create_from_audio",
      input: { language: "NORWEGIAN", preset: "NETFLIX", chars_per_line: 16 },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.language).toBe("NORWEGIAN");
    expect(parsed.preset).toBe("NETFLIX");

    // Verifiser at args inkluderer norwegian
    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { language: string } };
    expect(params.command).toBe("resolve.subtitlesCreateFromAudio");
    expect(params.params.language).toBe("NORWEGIAN");
  });

  test("track.add subtitle-track", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { added: true, track_type: "subtitle", sub_track_type: "none", new_count: 2 },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t3",
      name: "photoshop_resolve_track_add",
      input: { track_type: "subtitle" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.added).toBe(true);
    expect(parsed.track_type).toBe("subtitle");
    expect(parsed.new_count).toBe(2);
  });

  test("track.add audio med stereo subTrackType", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { added: true, track_type: "audio", sub_track_type: "stereo", new_count: 3 },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t4",
      name: "photoshop_resolve_track_add",
      input: { track_type: "audio", sub_track_type: "stereo" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.sub_track_type).toBe("stereo");
  });

  test("track.add uten track_type → is_error", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t5",
      name: "photoshop_resolve_track_add",
      input: {},
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/track_type/i);
  });

  test("track.delete krever track_type + index", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t6",
      name: "photoshop_resolve_track_delete",
      input: { track_type: "audio" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/index/i);
  });

  test("track.delete OK", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { deleted: true, track_type: "audio", index: 3 },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t7",
      name: "photoshop_resolve_track_delete",
      input: { track_type: "audio", index: 3 },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.deleted).toBe(true);
    expect(parsed.index).toBe(3);
  });

  test("track.getName returnerer navn", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { track_type: "audio", index: 1, name: "Dialog" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t8",
      name: "photoshop_resolve_track_get_name",
      input: { track_type: "audio", index: 1 },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.name).toBe("Dialog");
  });

  test("track.setName endrer navn", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, track_type: "subtitle", index: 1, name: "Norsk captions" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t9",
      name: "photoshop_resolve_track_set_name",
      input: { track_type: "subtitle", index: 1, name: "Norsk captions" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.set).toBe(true);
    expect(parsed.name).toBe("Norsk captions");
  });
});
