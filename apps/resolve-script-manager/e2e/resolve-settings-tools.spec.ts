/**
 * Project + Timeline GetSetting/SetSetting e2e — 4 nye tools.
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
  "photoshop_resolve_project_get_setting",
  "photoshop_resolve_project_set_setting",
  "photoshop_resolve_timeline_get_setting",
  "photoshop_resolve_timeline_set_setting",
];

test.describe("Resolve Project + Timeline settings", () => {
  test("Alle 4 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  test("project.getSetting med key returnerer single value", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { scope: "project", key: "timelineFrameRate", value: "24" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p1",
      name: "photoshop_resolve_project_get_setting",
      input: { key: "timelineFrameRate" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.key).toBe("timelineFrameRate");
    expect(parsed.value).toBe("24");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { key: string } };
    expect(params.command).toBe("resolve.projectGetSetting");
    expect(params.params.key).toBe("timelineFrameRate");
  });

  test("project.getSetting uten key returnerer full snapshot", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        scope: "project",
        key: null,
        value: {
          timelineFrameRate: "24",
          colorScienceMode: "davinciYRGBColorManagedv2",
          timelineResolutionWidth: "1920",
          timelineResolutionHeight: "1080",
        },
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p2",
      name: "photoshop_resolve_project_get_setting",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.key).toBeNull();
    expect(parsed.value.timelineFrameRate).toBe("24");
    expect(parsed.value.colorScienceMode).toBe("davinciYRGBColorManagedv2");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { key?: string } };
    expect(params.params.key).toBeUndefined();
  });

  test("project.setSetting krever string key og value", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p3",
      name: "photoshop_resolve_project_set_setting",
      input: { key: "timelineFrameRate", value: 24 },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/value må være/);
    expect(records.calls.some((c) => c.command === "photoshop_send_command")).toBe(false);
  });

  test("project.setSetting med gyldige args sender korrekt", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        scope: "project",
        set: true,
        key: "timelineFrameRate",
        value: "30",
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p4",
      name: "photoshop_resolve_project_set_setting",
      input: { key: "timelineFrameRate", value: "30" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.set).toBe(true);
    expect(parsed.value).toBe("30");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { key: string; value: string };
    };
    expect(params.command).toBe("resolve.projectSetSetting");
    expect(params.params).toEqual({ key: "timelineFrameRate", value: "30" });
  });

  test("project.setSetting avviser tom key", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p5",
      name: "photoshop_resolve_project_set_setting",
      input: { key: "", value: "x" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/key må være/);
  });

  test("timeline.getSetting med key", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        scope: "timeline",
        timeline: "Wedding cut v3",
        key: "timelineFrameRate",
        value: "24",
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t1",
      name: "photoshop_resolve_timeline_get_setting",
      input: { key: "timelineFrameRate" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.timeline).toBe("Wedding cut v3");
    expect(parsed.value).toBe("24");
  });

  test("timeline.getSetting uten key returnerer dict", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        scope: "timeline",
        timeline: "T1",
        key: null,
        value: { timelineFrameRate: "24", videoResWidth: "3840" },
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t2",
      name: "photoshop_resolve_timeline_get_setting",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.key).toBeNull();
    expect(parsed.value.videoResWidth).toBe("3840");
  });

  test("timeline.setSetting sender korrekt", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        scope: "timeline",
        set: true,
        key: "videoResWidth",
        value: "3840",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "t3",
      name: "photoshop_resolve_timeline_set_setting",
      input: { key: "videoResWidth", value: "3840" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { key: string; value: string } };
    expect(params.command).toBe("resolve.timelineSetSetting");
    expect(params.params).toEqual({ key: "videoResWidth", value: "3840" });
  });

  test("timeline.setSetting avviser non-string value", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t4",
      name: "photoshop_resolve_timeline_set_setting",
      input: { key: "videoResWidth", value: 3840 },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/value må være/);
  });
});
