/**
 * Fusion comps på timeline-items e2e — 7 nye tools.
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
  "photoshop_resolve_fusion_get_comp_names",
  "photoshop_resolve_fusion_add_comp",
  "photoshop_resolve_fusion_load_comp",
  "photoshop_resolve_fusion_rename_comp",
  "photoshop_resolve_fusion_delete_comp",
  "photoshop_resolve_fusion_import_comp",
  "photoshop_resolve_fusion_export_comp",
];

test.describe("Resolve Fusion comps på timeline-items", () => {
  test("Alle 7 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  test("fusion.getCompNames returnerer array", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        item: "Title Card",
        count: 2,
        names: ["Composition 1", "Lower Third"],
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f1",
      name: "photoshop_resolve_fusion_get_comp_names",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.count).toBe(2);
    expect(parsed.names).toEqual(["Composition 1", "Lower Third"]);
  });

  test("fusion.addComp kalles uten args", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { added: true, item: "Hero shot" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f2",
      name: "photoshop_resolve_fusion_add_comp",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.added).toBe(true);

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string };
    expect(params.command).toBe("resolve.fusionAddComp");
  });

  test("fusion.loadComp sender name", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { loaded: true, name: "Title v2", item: "Hero" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "f3",
      name: "photoshop_resolve_fusion_load_comp",
      input: { name: "Title v2" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { name: string } };
    expect(params.command).toBe("resolve.fusionLoadComp");
    expect(params.params.name).toBe("Title v2");
  });

  test("fusion.loadComp avviser tom name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f4",
      name: "photoshop_resolve_fusion_load_comp",
      input: { name: "" },
    });
    expect(result.is_error).toBe(true);
  });

  test("fusion.renameComp sender old+new", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        renamed: true,
        old_name: "Composition 1",
        new_name: "Approved",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "f5",
      name: "photoshop_resolve_fusion_rename_comp",
      input: { old_name: "Composition 1", new_name: "Approved" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: { old_name: string; new_name: string };
    };
    expect(params.params.old_name).toBe("Composition 1");
    expect(params.params.new_name).toBe("Approved");
  });

  test("fusion.renameComp avviser tom old_name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f6",
      name: "photoshop_resolve_fusion_rename_comp",
      input: { old_name: "", new_name: "X" },
    });
    expect(result.is_error).toBe(true);
  });

  test("fusion.deleteComp sender name", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { deleted: true, name: "Composition 1" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "f7",
      name: "photoshop_resolve_fusion_delete_comp",
      input: { name: "Composition 1" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { name: string } };
    expect(params.command).toBe("resolve.fusionDeleteComp");
  });

  test("fusion.importComp sender path", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { imported: true, path: "/comps/wedding-title.setting" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "f8",
      name: "photoshop_resolve_fusion_import_comp",
      input: { path: "/comps/wedding-title.setting" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { path: string } };
    expect(params.command).toBe("resolve.fusionImportComp");
    expect(params.params.path).toBe("/comps/wedding-title.setting");
  });

  test("fusion.exportComp sender path + comp_index", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        exported: true,
        path: "/out/Title.setting",
        comp_index: 2,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "f9",
      name: "photoshop_resolve_fusion_export_comp",
      input: { path: "/out/Title.setting", comp_index: 2 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: { path: string; comp_index: number };
    };
    expect(params.params.comp_index).toBe(2);
  });

  test("fusion.exportComp avviser comp_index < 1", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f10",
      name: "photoshop_resolve_fusion_export_comp",
      input: { path: "/x.setting", comp_index: 0 },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/comp_index/);
  });

  test("fusion.exportComp avviser tom path", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f11",
      name: "photoshop_resolve_fusion_export_comp",
      input: { path: "", comp_index: 1 },
    });
    expect(result.is_error).toBe(true);
  });
});
