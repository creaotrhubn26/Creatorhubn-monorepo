/**
 * Timecode + Track-items + Clip-color e2e — 6 nye tools.
 */

import { test, expect } from "@playwright/test";
import { PHOTOSHOP_TOOLS, runPhotoshopTool } from "../src/agents/photoshopTools";
import { RESOLVE_CLIP_COLORS } from "../src/services/photoshopBridgeService";

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
  "photoshop_resolve_timeline_get_current_timecode",
  "photoshop_resolve_timeline_set_current_timecode",
  "photoshop_resolve_timeline_get_item_list_in_track",
  "photoshop_resolve_clip_get_color",
  "photoshop_resolve_clip_set_color",
  "photoshop_resolve_clip_clear_color",
];

test.describe("Resolve timecode + track-items + clip-color", () => {
  test("Alle 6 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  test("clip.setColor enum dekker alle 16 Resolve-farger", () => {
    const tool = PHOTOSHOP_TOOLS.find((t) => t.name === "photoshop_resolve_clip_set_color");
    const schema = tool!.input_schema as { properties: { color: { enum: string[] } } };
    expect(schema.properties.color.enum.sort()).toEqual([...RESOLVE_CLIP_COLORS].sort());
  });

  test("timeline.getCurrentTimecode returnerer playhead", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { timeline: "Cut v3", timecode: "01:02:03:12" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t1",
      name: "photoshop_resolve_timeline_get_current_timecode",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.timecode).toBe("01:02:03:12");
  });

  test("timeline.setCurrentTimecode sender korrekt", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, timeline: "Cut v3", timecode: "00:00:30:00" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "t2",
      name: "photoshop_resolve_timeline_set_current_timecode",
      input: { timecode: "00:00:30:00" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { timecode: string } };
    expect(params.command).toBe("resolve.timelineSetCurrentTimecode");
    expect(params.params.timecode).toBe("00:00:30:00");
  });

  test("timeline.setCurrentTimecode avviser tom string", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t3",
      name: "photoshop_resolve_timeline_set_current_timecode",
      input: { timecode: "" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/timecode/);
  });

  test("timeline.getItemListInTrack med default video-track", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        track_type: "video",
        track_index: 1,
        count: 2,
        items: [
          { name: "shot_001", start: 0, end: 240, duration: 240 },
          { name: "shot_002", start: 240, end: 480, duration: 240 },
        ],
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "tr1",
      name: "photoshop_resolve_timeline_get_item_list_in_track",
      input: { track_index: 1 },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.count).toBe(2);
    expect(parsed.items[0].name).toBe("shot_001");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: { track_type: string; track_index: number };
    };
    expect(params.params.track_type).toBe("video");
    expect(params.params.track_index).toBe(1);
  });

  test("timeline.getItemListInTrack med audio-track", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        track_type: "audio",
        track_index: 2,
        count: 0,
        items: [],
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "tr2",
      name: "photoshop_resolve_timeline_get_item_list_in_track",
      input: { track_type: "audio", track_index: 2 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { track_type: string } };
    expect(params.params.track_type).toBe("audio");
  });

  test("timeline.getItemListInTrack avviser track_index < 1", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "tr3",
      name: "photoshop_resolve_timeline_get_item_list_in_track",
      input: { track_index: 0 },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/track_index/);
  });

  test("clip.getColor uten clip_id (timeline-item)", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { scope: "timeline_item", name: "Hero", color: "Green" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "c1",
      name: "photoshop_resolve_clip_get_color",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.color).toBe("Green");
    expect(parsed.scope).toBe("timeline_item");
  });

  test("clip.setColor med gyldig color + clip_id", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        set: true,
        scope: "media_pool_item",
        name: "wedding_001",
        color: "Yellow",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "c2",
      name: "photoshop_resolve_clip_set_color",
      input: { clip_id: "mp_1", color: "Yellow" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { clip_id?: string; color: string };
    };
    expect(params.command).toBe("resolve.clipSetColor");
    expect(params.params.color).toBe("Yellow");
    expect(params.params.clip_id).toBe("mp_1");
  });

  test("clip.setColor avviser ugyldig color", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "c3",
      name: "photoshop_resolve_clip_set_color",
      input: { color: "Magenta" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/Magenta/);
    expect(records.calls.some((c) => c.command === "photoshop_send_command")).toBe(false);
  });

  test("clip.clearColor sender korrekt", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { cleared: true, scope: "media_pool_item", name: "x" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "c4",
      name: "photoshop_resolve_clip_clear_color",
      input: { clip_id: "mp_1" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { clip_id?: string } };
    expect(params.command).toBe("resolve.clipClearColor");
    expect(params.params.clip_id).toBe("mp_1");
  });
});
