/**
 * Clip markers + Color versions e2e — 10 nye tools.
 */

import { test, expect } from "@playwright/test";
import { PHOTOSHOP_TOOLS, runPhotoshopTool } from "../src/agents/photoshopTools";
import { RESOLVE_MARKER_COLORS } from "../src/services/photoshopBridgeService";

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
  "photoshop_resolve_clip_markers_list",
  "photoshop_resolve_clip_markers_add",
  "photoshop_resolve_clip_markers_delete_by_color",
  "photoshop_resolve_clip_markers_delete_at_frame",
  "photoshop_resolve_version_add",
  "photoshop_resolve_version_get_current",
  "photoshop_resolve_version_get_names",
  "photoshop_resolve_version_load",
  "photoshop_resolve_version_rename",
  "photoshop_resolve_version_delete",
];

test.describe("Resolve clip-markers + color-versions", () => {
  test("Alle 10 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  test("clip.markersAdd enum dekker alle 16 marker-farger", () => {
    const tool = PHOTOSHOP_TOOLS.find((t) => t.name === "photoshop_resolve_clip_markers_add");
    const schema = tool!.input_schema as { properties: { color: { enum: string[] } } };
    expect(schema.properties.color.enum.sort()).toEqual([...RESOLVE_MARKER_COLORS].sort());
  });

  test("clip.markersList sender clip_id korrekt", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        clip_id: "mp_1",
        markers: {
          "240": { color: "Yellow", name: "Highlight", note: "", duration: 1, customData: "" },
        },
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "m1",
      name: "photoshop_resolve_clip_markers_list",
      input: { clip_id: "mp_1" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.markers["240"].color).toBe("Yellow");
  });

  test("clip.markersAdd med gyldig color sender korrekt", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        added: true,
        clip_id: "mp_1",
        frame_id: 100,
        color: "Red",
        name: "Retake",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "m2",
      name: "photoshop_resolve_clip_markers_add",
      input: { clip_id: "mp_1", frame_id: 100, color: "Red", name: "Retake" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { clip_id: string; frame_id: number; color?: string; name?: string };
    };
    expect(params.command).toBe("resolve.clipMarkersAdd");
    expect(params.params.frame_id).toBe(100);
    expect(params.params.color).toBe("Red");
  });

  test("clip.markersAdd avviser ugyldig color", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "m3",
      name: "photoshop_resolve_clip_markers_add",
      input: { clip_id: "mp_1", frame_id: 100, color: "Magenta" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/Magenta/);
  });

  test("clip.markersAdd avviser frame_id < 0", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "m4",
      name: "photoshop_resolve_clip_markers_add",
      input: { clip_id: "mp_1", frame_id: -5 },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/frame_id/);
  });

  test("clip.markersDeleteByColor godtar 'All'", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { deleted: true, clip_id: "mp_1", color: "All" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "m5",
      name: "photoshop_resolve_clip_markers_delete_by_color",
      input: { clip_id: "mp_1", color: "All" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { color: string } };
    expect(params.params.color).toBe("All");
  });

  test("clip.markersDeleteByColor avviser ugyldig farge", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "m6",
      name: "photoshop_resolve_clip_markers_delete_by_color",
      input: { clip_id: "mp_1", color: "Magenta" },
    });
    expect(result.is_error).toBe(true);
  });

  test("clip.markersDeleteAtFrame sender korrekt", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { deleted: true, clip_id: "mp_1", frame_id: 100 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "m7",
      name: "photoshop_resolve_clip_markers_delete_at_frame",
      input: { clip_id: "mp_1", frame_id: 100 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { frame_id: number } };
    expect(params.command).toBe("resolve.clipMarkersDeleteAtFrame");
    expect(params.params.frame_id).toBe(100);
  });

  test("version.add default version_type=0", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { added: true, name: "Cinematic v1", version_type: 0 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "v1",
      name: "photoshop_resolve_version_add",
      input: { name: "Cinematic v1" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { name: string; version_type: number } };
    expect(params.params.name).toBe("Cinematic v1");
    expect(params.params.version_type).toBe(0);
  });

  test("version.add med version_type=1 (remote)", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { added: true, name: "Remote", version_type: 1 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "v2",
      name: "photoshop_resolve_version_add",
      input: { name: "Remote", version_type: 1 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { version_type: number } };
    expect(params.params.version_type).toBe(1);
  });

  test("version.add avviser tom name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "v3",
      name: "photoshop_resolve_version_add",
      input: { name: "" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/name/);
  });

  test("version.getCurrent returnerer current", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { current: { name: "Cinematic v2", version_type: 0 } },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "v4",
      name: "photoshop_resolve_version_get_current",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.current.name).toBe("Cinematic v2");
  });

  test("version.getCurrent kan returnere null", async () => {
    const records = { calls: [] as MockInvoke[], response: { current: null } };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "v5",
      name: "photoshop_resolve_version_get_current",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.current).toBeNull();
  });

  test("version.getNames returnerer array", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { version_type: 0, names: ["v1", "v2", "v3"] },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "v6",
      name: "photoshop_resolve_version_get_names",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.names).toEqual(["v1", "v2", "v3"]);
  });

  test("version.load sender navn + type", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { loaded: true, name: "v2", version_type: 0 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "v7",
      name: "photoshop_resolve_version_load",
      input: { name: "v2" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { name: string } };
    expect(params.command).toBe("resolve.versionLoad");
    expect(params.params.name).toBe("v2");
  });

  test("version.rename sender old+new", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        renamed: true,
        old_name: "v1",
        new_name: "Final",
        version_type: 0,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "v8",
      name: "photoshop_resolve_version_rename",
      input: { old_name: "v1", new_name: "Final" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: { old_name: string; new_name: string };
    };
    expect(params.params.old_name).toBe("v1");
    expect(params.params.new_name).toBe("Final");
  });

  test("version.delete sender korrekt", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { deleted: true, name: "v1", version_type: 0 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "v9",
      name: "photoshop_resolve_version_delete",
      input: { name: "v1" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string };
    expect(params.command).toBe("resolve.versionDelete");
  });
});
