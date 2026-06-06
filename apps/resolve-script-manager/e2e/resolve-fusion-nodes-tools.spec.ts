/**
 * Fusion node-scripting e2e — 6 nye tools (5 bridge + 1 katalog).
 */

import { test, expect } from "@playwright/test";
import { PHOTOSHOP_TOOLS, runPhotoshopTool } from "../src/agents/photoshopTools";
import {
  FUSION_TOOLS_CATALOG,
  FUSION_CATEGORIES,
  getFusionCatalog,
} from "../src/lib/fusionToolsCatalog";

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
  "photoshop_resolve_fusion_comp_get_info",
  "photoshop_resolve_fusion_comp_add_tool",
  "photoshop_resolve_fusion_comp_delete_tool",
  "photoshop_resolve_fusion_comp_set_input",
  "photoshop_resolve_fusion_comp_connect_input",
  "photoshop_resolve_fusion_tools_reference",
];

test.describe("Fusion tools-catalog struktur", () => {
  test("Katalogen har minst 15 entries", () => {
    expect(FUSION_TOOLS_CATALOG.length).toBeGreaterThanOrEqual(15);
  });

  test("Hver entry har påkrevde felt", () => {
    for (const e of FUSION_TOOLS_CATALOG) {
      expect(e.type, `entry mangler type`).toBeTruthy();
      expect(e.label).toBeTruthy();
      expect(e.category).toBeTruthy();
      expect(e.description).toBeTruthy();
    }
  });

  test("Inkluderer kritiske tool-types", () => {
    const types = FUSION_TOOLS_CATALOG.map((e) => e.type);
    for (const expected of [
      "Background",
      "TextPlus",
      "Merge",
      "Blur",
      "Transform",
      "MediaOut",
    ]) {
      expect(types, `mangler ${expected}`).toContain(expected);
    }
  });

  test("Alle entries har kategori i FUSION_CATEGORIES", () => {
    for (const e of FUSION_TOOLS_CATALOG) {
      expect(FUSION_CATEGORIES).toContain(e.category as never);
    }
  });

  test("getFusionCatalog filter på category", () => {
    const text = getFusionCatalog({ category: "text" });
    expect(text.length).toBeGreaterThanOrEqual(1);
    expect(text.every((e) => e.category === "text")).toBe(true);
    const all = getFusionCatalog();
    expect(all.length).toBe(FUSION_TOOLS_CATALOG.length);
  });
});

test.describe("Fusion tools registrert", () => {
  test("Alle 6 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });
});

test.describe("fusion_tools_reference dispatcher", () => {
  test("Returnerer alle entries uten filter", async () => {
    installInvokeMock({ calls: [], response: null });
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f1",
      name: "photoshop_resolve_fusion_tools_reference",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.count).toBe(FUSION_TOOLS_CATALOG.length);
    expect(parsed.filter.category).toBeNull();
  });

  test("Respekterer category-filter", async () => {
    installInvokeMock({ calls: [], response: null });
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "f2",
      name: "photoshop_resolve_fusion_tools_reference",
      input: { category: "mask" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.entries.every((e: { category: string }) => e.category === "mask")).toBe(true);
  });

  test("Kaller IKKE bridge (lokal lookup)", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    await runPhotoshopTool({
      type: "tool_use",
      id: "f3",
      name: "photoshop_resolve_fusion_tools_reference",
      input: {},
    });
    expect(records.calls.some((c) => c.command === "photoshop_send_command")).toBe(false);
  });
});

test.describe("fusion_comp_get_info", () => {
  test("Returnerer comp + tools", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        comp: "Composition 1",
        tool_count: 3,
        tools: [
          { name: "Background1", type: "Background" },
          { name: "Text1", type: "TextPlus" },
          { name: "Merge1", type: "Merge" },
        ],
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "g1",
      name: "photoshop_resolve_fusion_comp_get_info",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.tool_count).toBe(3);
    expect(parsed.tools[1].type).toBe("TextPlus");
  });

  test("Med comp_name sender args", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { comp: "Title v2", tool_count: 0, tools: [] },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "g2",
      name: "photoshop_resolve_fusion_comp_get_info",
      input: { comp_name: "Title v2" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { comp_name?: string };
    };
    expect(params.command).toBe("resolve.fusionCompGetInfo");
    expect(params.params.comp_name).toBe("Title v2");
  });
});

test.describe("fusion_comp_add_tool", () => {
  test("Sender tool_type + name + posisjon", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        added: true,
        name: "MyTitle",
        tool_type: "TextPlus",
        x: 0,
        y: 0,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "a1",
      name: "photoshop_resolve_fusion_comp_add_tool",
      input: { tool_type: "TextPlus", name: "MyTitle", x: 0, y: 0 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { tool_type: string; name?: string; x?: number; y?: number };
    };
    expect(params.command).toBe("resolve.fusionCompAddTool");
    expect(params.params.tool_type).toBe("TextPlus");
    expect(params.params.name).toBe("MyTitle");
    expect(params.params.x).toBe(0);
    expect(params.params.y).toBe(0);
  });

  test("Med kun tool_type sender minimal args", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { added: true, name: "Background1", tool_type: "Background", x: -1, y: -1 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "a2",
      name: "photoshop_resolve_fusion_comp_add_tool",
      input: { tool_type: "Background" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { x?: number; y?: number; name?: string } };
    expect(params.params.x).toBeUndefined();
    expect(params.params.y).toBeUndefined();
    expect(params.params.name).toBeUndefined();
  });

  test("Avviser tom tool_type", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "a3",
      name: "photoshop_resolve_fusion_comp_add_tool",
      input: { tool_type: "" },
    });
    expect(result.is_error).toBe(true);
  });
});

test.describe("fusion_comp_set_input", () => {
  test("String-verdier sendes som-er", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, tool: "Text1", input: "StyledText", value: "Hello" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "s1",
      name: "photoshop_resolve_fusion_comp_set_input",
      input: { tool_name: "Text1", input_name: "StyledText", value: "Hello" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { value: string } };
    expect(params.params.value).toBe("Hello");
  });

  test("Number-verdier konverteres til string", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, tool: "Blur1", input: "XBlurSize", value: "5" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "s2",
      name: "photoshop_resolve_fusion_comp_set_input",
      input: { tool_name: "Blur1", input_name: "XBlurSize", value: 5 },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { value: string } };
    expect(params.params.value).toBe("5");
  });

  test("Boolean-verdier konverteres til string", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, tool: "x", input: "Visible", value: "true" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "s3",
      name: "photoshop_resolve_fusion_comp_set_input",
      input: { tool_name: "x", input_name: "Visible", value: true },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { value: string } };
    expect(params.params.value).toBe("true");
  });

  test("Avviser manglende value", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s4",
      name: "photoshop_resolve_fusion_comp_set_input",
      input: { tool_name: "Text1", input_name: "StyledText" },
    });
    expect(result.is_error).toBe(true);
  });

  test("Avviser tom tool_name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s5",
      name: "photoshop_resolve_fusion_comp_set_input",
      input: { tool_name: "", input_name: "x", value: "y" },
    });
    expect(result.is_error).toBe(true);
  });
});

test.describe("fusion_comp_connect_input", () => {
  test("Sender alle 4 påkrevde felter + default src_output", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        connected: true,
        dest: "Merge1",
        dest_input: "Background",
        src: "Background1",
        src_output: "Output",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "c1",
      name: "photoshop_resolve_fusion_comp_connect_input",
      input: {
        dest_tool: "Merge1",
        dest_input: "Background",
        src_tool: "Background1",
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: {
        dest_tool: string;
        dest_input: string;
        src_tool: string;
        src_output?: string;
      };
    };
    expect(params.command).toBe("resolve.fusionCompConnectInput");
    expect(params.params.dest_tool).toBe("Merge1");
    expect(params.params.src_tool).toBe("Background1");
    // src_output utelates av klient (default i Lua = "Output")
    expect(params.params.src_output).toBeUndefined();
  });

  test("Med custom src_output", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { connected: true, dest: "x", dest_input: "i", src: "y", src_output: "Mask" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "c2",
      name: "photoshop_resolve_fusion_comp_connect_input",
      input: {
        dest_tool: "x",
        dest_input: "EffectMask",
        src_tool: "Rect1",
        src_output: "Mask",
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { src_output?: string } };
    expect(params.params.src_output).toBe("Mask");
  });

  test("Avviser tom dest_input", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "c3",
      name: "photoshop_resolve_fusion_comp_connect_input",
      input: { dest_tool: "x", dest_input: "", src_tool: "y" },
    });
    expect(result.is_error).toBe(true);
  });
});

test.describe("fusion_comp_delete_tool", () => {
  test("Sender name", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { deleted: true, name: "Background1" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "d1",
      name: "photoshop_resolve_fusion_comp_delete_tool",
      input: { name: "Background1" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { name: string };
    };
    expect(params.command).toBe("resolve.fusionCompDeleteTool");
    expect(params.params.name).toBe("Background1");
  });

  test("Avviser tom name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "d2",
      name: "photoshop_resolve_fusion_comp_delete_tool",
      input: { name: "" },
    });
    expect(result.is_error).toBe(true);
  });
});
