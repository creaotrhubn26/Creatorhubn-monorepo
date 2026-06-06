/**
 * ProjectManager-bro e2e — 7 nye tools.
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
  "photoshop_resolve_pm_get_info",
  "photoshop_resolve_pm_create_project",
  "photoshop_resolve_pm_load_project",
  "photoshop_resolve_pm_save_project",
  "photoshop_resolve_pm_delete_project",
  "photoshop_resolve_pm_create_folder",
  "photoshop_resolve_pm_navigate_folder",
];

test.describe("Resolve ProjectManager bridge", () => {
  test("Alle 7 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  test("pm.getInfo returnerer state-snapshot", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        current_project: "Wedding 2026",
        current_folder: "Weddings",
        projects: ["Wedding 2026", "Wedding 2025"],
        subfolders: ["Templates"],
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p1",
      name: "photoshop_resolve_pm_get_info",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.current_project).toBe("Wedding 2026");
    expect(parsed.projects).toEqual(["Wedding 2026", "Wedding 2025"]);
    expect(parsed.subfolders).toEqual(["Templates"]);
  });

  test("pm.createProject med navn", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { created: true, name: "Wedding 2027", media_path: "" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "p2",
      name: "photoshop_resolve_pm_create_project",
      input: { name: "Wedding 2027" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { name: string; media_path?: string };
    };
    expect(params.command).toBe("resolve.pmCreateProject");
    expect(params.params.name).toBe("Wedding 2027");
    expect(params.params.media_path).toBeUndefined();
  });

  test("pm.createProject med media_path", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { created: true, name: "X", media_path: "/Volumes/RAW" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "p3",
      name: "photoshop_resolve_pm_create_project",
      input: { name: "X", media_path: "/Volumes/RAW" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { media_path?: string } };
    expect(params.params.media_path).toBe("/Volumes/RAW");
  });

  test("pm.createProject avviser tom name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p4",
      name: "photoshop_resolve_pm_create_project",
      input: { name: "" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/name/);
  });

  test("pm.loadProject sender name", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { loaded: true, name: "Wedding 2025" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "p5",
      name: "photoshop_resolve_pm_load_project",
      input: { name: "Wedding 2025" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { name: string } };
    expect(params.command).toBe("resolve.pmLoadProject");
    expect(params.params.name).toBe("Wedding 2025");
  });

  test("pm.saveProject kalles uten args", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { saved: true, name: "Wedding 2026" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p6",
      name: "photoshop_resolve_pm_save_project",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.saved).toBe(true);

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string };
    expect(params.command).toBe("resolve.pmSaveProject");
  });

  test("pm.deleteProject avviser tom name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p7",
      name: "photoshop_resolve_pm_delete_project",
      input: { name: "" },
    });
    expect(result.is_error).toBe(true);
  });

  test("pm.createFolder sender name", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { created: true, name: "Archived" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "p8",
      name: "photoshop_resolve_pm_create_folder",
      input: { name: "Archived" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string };
    expect(params.command).toBe("resolve.pmCreateFolder");
  });

  test("pm.navigateFolder med 'root'", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        navigated: true,
        op: "root",
        to: "root",
        current_folder: "",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "p9",
      name: "photoshop_resolve_pm_navigate_folder",
      input: { to: "root" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { to: string } };
    expect(params.params.to).toBe("root");
  });

  test("pm.navigateFolder med 'parent'", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        navigated: true,
        op: "parent",
        to: "parent",
        current_folder: "Weddings",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "p10",
      name: "photoshop_resolve_pm_navigate_folder",
      input: { to: "parent" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { to: string } };
    expect(params.params.to).toBe("parent");
  });

  test("pm.navigateFolder med folder-navn (OpenFolder)", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        navigated: true,
        op: "open",
        to: "Templates",
        current_folder: "Templates",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "p11",
      name: "photoshop_resolve_pm_navigate_folder",
      input: { to: "Templates" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { to: string } };
    expect(params.params.to).toBe("Templates");
  });

  test("pm.navigateFolder avviser tom to", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p12",
      name: "photoshop_resolve_pm_navigate_folder",
      input: { to: "" },
    });
    expect(result.is_error).toBe(true);
  });
});
