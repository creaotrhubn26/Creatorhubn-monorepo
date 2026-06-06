/**
 * MediaPool folder-management e2e — 5 nye tools.
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
  "photoshop_resolve_folder_list_all",
  "photoshop_resolve_folder_get_current",
  "photoshop_resolve_folder_set_current",
  "photoshop_resolve_folder_create",
  "photoshop_resolve_folder_move_clips",
];

test.describe("Resolve MediaPool folder-management", () => {
  test("Alle 5 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  test("folder.listAll returnerer flat tree", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        count: 3,
        folders: [
          { path: "Master", name: "Master", clip_count: 0, subfolder_count: 2 },
          { path: "Master/Wedding", name: "Wedding", clip_count: 12, subfolder_count: 1 },
          { path: "Master/Wedding/Day 1", name: "Day 1", clip_count: 24, subfolder_count: 0 },
        ],
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f1",
      name: "photoshop_resolve_folder_list_all",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.count).toBe(3);
    expect(parsed.folders[2].path).toBe("Master/Wedding/Day 1");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string };
    expect(params.command).toBe("resolve.folderListAll");
  });

  test("folder.getCurrent returnerer current folder", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { name: "Day 1", clip_count: 24, subfolder_count: 0 },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f2",
      name: "photoshop_resolve_folder_get_current",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.name).toBe("Day 1");
    expect(parsed.clip_count).toBe(24);
  });

  test("folder.setCurrent sender path", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, path: "Master/Wedding/Day 2", name: "Day 2" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "f3",
      name: "photoshop_resolve_folder_set_current",
      input: { path: "Master/Wedding/Day 2" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { path: string } };
    expect(params.command).toBe("resolve.folderSetCurrent");
    expect(params.params.path).toBe("Master/Wedding/Day 2");
  });

  test("folder.setCurrent avviser tom path", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f4",
      name: "photoshop_resolve_folder_set_current",
      input: { path: "" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/path/);
  });

  test("folder.create med parent_path", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        created: true,
        path: "Master/Wedding/Approved",
        name: "Approved",
        parent_path: "Master/Wedding",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "f5",
      name: "photoshop_resolve_folder_create",
      input: { name: "Approved", parent_path: "Master/Wedding" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: { name: string; parent_path?: string };
    };
    expect(params.params.name).toBe("Approved");
    expect(params.params.parent_path).toBe("Master/Wedding");
  });

  test("folder.create uten parent_path landerer i root", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        created: true,
        path: "Master/B-Roll",
        name: "B-Roll",
        parent_path: "",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "f6",
      name: "photoshop_resolve_folder_create",
      input: { name: "B-Roll" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: { name: string; parent_path?: string };
    };
    expect(params.params.name).toBe("B-Roll");
    expect(params.params.parent_path).toBeUndefined();
  });

  test("folder.create avviser tom name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f7",
      name: "photoshop_resolve_folder_create",
      input: { name: "" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/name/);
  });

  test("folder.moveClips sender clip_ids + target_path", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { moved: true, count: 3, target_path: "Master/Approved" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "f8",
      name: "photoshop_resolve_folder_move_clips",
      input: {
        clip_ids: ["mp_1", "mp_2", "mp_3"],
        target_path: "Master/Approved",
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { clip_ids: string[]; target_path: string };
    };
    expect(params.command).toBe("resolve.folderMoveClips");
    expect(params.params.clip_ids).toEqual(["mp_1", "mp_2", "mp_3"]);
    expect(params.params.target_path).toBe("Master/Approved");
  });

  test("folder.moveClips avviser tom clip_ids", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f9",
      name: "photoshop_resolve_folder_move_clips",
      input: { clip_ids: [], target_path: "Master/Approved" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/clip_ids/);
  });

  test("folder.moveClips avviser non-string i clip_ids", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f10",
      name: "photoshop_resolve_folder_move_clips",
      input: { clip_ids: ["mp_1", 42], target_path: "Master/Approved" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/strings/);
  });

  test("folder.moveClips avviser tom target_path", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f11",
      name: "photoshop_resolve_folder_move_clips",
      input: { clip_ids: ["mp_1"], target_path: "" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/target_path/);
  });
});
