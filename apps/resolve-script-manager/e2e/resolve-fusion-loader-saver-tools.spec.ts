/**
 * Fusion Loader + Saver e2e.
 */

import { test, expect } from "@playwright/test";
import { PHOTOSHOP_TOOLS, runPhotoshopTool } from "../src/agents/photoshopTools";
import { FUSION_TOOLS_CATALOG } from "../src/lib/fusionToolsCatalog";

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

test.describe("Loader + Saver i katalog", () => {
  test("Loader er i katalogen med Filename input", () => {
    const loader = FUSION_TOOLS_CATALOG.find((e) => e.type === "Loader");
    expect(loader).toBeTruthy();
    expect(loader!.commonInputs!.some((i) => i.name === "Filename")).toBe(true);
  });

  test("Saver er i katalogen", () => {
    const saver = FUSION_TOOLS_CATALOG.find((e) => e.type === "Saver");
    expect(saver).toBeTruthy();
  });
});

test.describe("fusionComp.addLoader", () => {
  test("Tool er registrert", () => {
    expect(
      PHOTOSHOP_TOOLS.find((t) => t.name === "photoshop_resolve_fusion_comp_add_loader"),
    ).toBeTruthy();
  });

  test("Sender file_path", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        added: true,
        name: "Loader1",
        tool_type: "Loader",
        file_path: "/clean-plates/wedding.png",
        file_set: true,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "l1",
      name: "photoshop_resolve_fusion_comp_add_loader",
      input: { file_path: "/clean-plates/wedding.png" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { file_path: string } };
    expect(params.command).toBe("resolve.fusionCompAddLoader");
    expect(params.params.file_path).toBe("/clean-plates/wedding.png");
  });

  test("Med x+y posisjonering", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { added: true, name: "Loader1", tool_type: "Loader", file_path: "/x.png", file_set: true },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "l2",
      name: "photoshop_resolve_fusion_comp_add_loader",
      input: { file_path: "/x.png", x: 100, y: 50 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { x?: number; y?: number } };
    expect(params.params.x).toBe(100);
    expect(params.params.y).toBe(50);
  });

  test("Avviser tom file_path", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "l3",
      name: "photoshop_resolve_fusion_comp_add_loader",
      input: { file_path: "" },
    });
    expect(result.is_error).toBe(true);
  });

  test("comp_name videresendes", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { added: true, name: "Loader1", tool_type: "Loader", file_path: "/x.png", file_set: true },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "l4",
      name: "photoshop_resolve_fusion_comp_add_loader",
      input: { file_path: "/x.png", comp_name: "CleanPlate" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { comp_name?: string } };
    expect(params.params.comp_name).toBe("CleanPlate");
  });
});

test.describe("fusionComp.addSaver", () => {
  test("Tool er registrert", () => {
    expect(
      PHOTOSHOP_TOOLS.find((t) => t.name === "photoshop_resolve_fusion_comp_add_saver"),
    ).toBeTruthy();
  });

  test("Sender output file_path", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        added: true,
        name: "Saver1",
        tool_type: "Saver",
        file_path: "/out/render.[####].exr",
        file_set: true,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "s1",
      name: "photoshop_resolve_fusion_comp_add_saver",
      input: { file_path: "/out/render.[####].exr" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { file_path: string } };
    expect(params.command).toBe("resolve.fusionCompAddSaver");
    expect(params.params.file_path).toBe("/out/render.[####].exr");
  });

  test("Avviser tom file_path", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s2",
      name: "photoshop_resolve_fusion_comp_add_saver",
      input: { file_path: "" },
    });
    expect(result.is_error).toBe(true);
  });
});
