/**
 * Page-navigation + Clip-property e2e — 4 nye tools.
 */

import { test, expect } from "@playwright/test";
import { PHOTOSHOP_TOOLS, runPhotoshopTool } from "../src/agents/photoshopTools";
import { RESOLVE_PAGES } from "../src/services/photoshopBridgeService";

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
  "photoshop_resolve_page_open",
  "photoshop_resolve_page_current",
  "photoshop_resolve_clip_get_property",
  "photoshop_resolve_clip_set_property",
];

test.describe("Resolve page-nav + clip-properties", () => {
  test("Alle 4 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  test("page.open enum dekker alle 7 Resolve-sider", () => {
    const tool = PHOTOSHOP_TOOLS.find((t) => t.name === "photoshop_resolve_page_open");
    const schema = tool!.input_schema as { properties: { name: { enum: string[] } } };
    expect(schema.properties.name.enum.sort()).toEqual([...RESOLVE_PAGES].sort());
  });

  test("page.open med gyldig name sender til Resolve", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { opened: true, page: "color" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p1",
      name: "photoshop_resolve_page_open",
      input: { name: "color" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.opened).toBe(true);
    expect(parsed.page).toBe("color");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { name: string } };
    expect(params.command).toBe("resolve.pageOpen");
    expect(params.params.name).toBe("color");
  });

  test("page.open avviser ugyldig page-name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p2",
      name: "photoshop_resolve_page_open",
      input: { name: "audio" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/audio/);
    expect(records.calls.some((c) => c.command === "photoshop_send_command")).toBe(false);
  });

  test("page.current returnerer current page", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { page: "edit" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p3",
      name: "photoshop_resolve_page_current",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.page).toBe("edit");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string };
    expect(params.command).toBe("resolve.pageCurrent");
  });

  test("page.current kan returnere null", async () => {
    const records = { calls: [] as MockInvoke[], response: { page: null } };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p4",
      name: "photoshop_resolve_page_current",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.page).toBeNull();
  });

  test("clip.getProperty med key returnerer single value", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { clip_id: "mp_1", key: "FPS", value: "24" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "c1",
      name: "photoshop_resolve_clip_get_property",
      input: { clip_id: "mp_1", key: "FPS" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.value).toBe("24");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { clip_id: string; key: string };
    };
    expect(params.command).toBe("resolve.clipGetProperty");
    expect(params.params).toEqual({ clip_id: "mp_1", key: "FPS" });
  });

  test("clip.getProperty uten key returnerer dict", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        clip_id: "mp_1",
        key: null,
        value: { FPS: "24", Resolution: "1920x1080", Format: "MOV" },
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "c2",
      name: "photoshop_resolve_clip_get_property",
      input: { clip_id: "mp_1" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.key).toBeNull();
    expect(parsed.value.FPS).toBe("24");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { clip_id: string; key?: string } };
    expect(params.params.clip_id).toBe("mp_1");
    expect(params.params.key).toBeUndefined();
  });

  test("clip.getProperty avviser tom clip_id", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "c3",
      name: "photoshop_resolve_clip_get_property",
      input: { clip_id: "" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/clip_id/);
  });

  test("clip.setProperty sender korrekt", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        set: true,
        clip_id: "mp_1",
        key: "Reel Name",
        value: "A001",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "c4",
      name: "photoshop_resolve_clip_set_property",
      input: { clip_id: "mp_1", key: "Reel Name", value: "A001" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { clip_id: string; key: string; value: string };
    };
    expect(params.command).toBe("resolve.clipSetProperty");
    expect(params.params).toEqual({ clip_id: "mp_1", key: "Reel Name", value: "A001" });
  });

  test("clip.setProperty avviser non-string value", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "c5",
      name: "photoshop_resolve_clip_set_property",
      input: { clip_id: "mp_1", key: "FPS", value: 24 },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/value må være/);
  });
});
