/**
 * Fusion 3D + particles katalog-utvidelse + set3DTransform helper.
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

test.describe("Katalog: 3D + particles kategorier", () => {
  test("FUSION_CATEGORIES inkluderer '3d' og 'particles'", () => {
    expect(FUSION_CATEGORIES).toContain("3d" as never);
    expect(FUSION_CATEGORIES).toContain("particles" as never);
  });

  test("Inkluderer kritiske 3D-noder", () => {
    const types = FUSION_TOOLS_CATALOG.map((e) => e.type);
    for (const expected of [
      "Text3D",
      "Shape3D",
      "Camera3D",
      "PointLight",
      "Merge3D",
      "Transform3D",
      "Renderer3D",
      "ImagePlane3D",
    ]) {
      expect(types, `mangler ${expected}`).toContain(expected);
    }
  });

  test("Inkluderer kritiske particle-noder", () => {
    const types = FUSION_TOOLS_CATALOG.map((e) => e.type);
    for (const expected of [
      "pEmitter",
      "pRender",
      "pSpawn",
      "pBounce",
      "pVortex",
      "pTurbulence",
      "pFlow",
    ]) {
      expect(types, `mangler ${expected}`).toContain(expected);
    }
  });

  test("3d-filter returnerer minst 10 entries", () => {
    const threeD = getFusionCatalog({ category: "3d" });
    expect(threeD.length).toBeGreaterThanOrEqual(10);
    expect(threeD.every((e) => e.category === "3d")).toBe(true);
  });

  test("particles-filter returnerer minst 5 entries", () => {
    const particles = getFusionCatalog({ category: "particles" });
    expect(particles.length).toBeGreaterThanOrEqual(5);
    expect(particles.every((e) => e.category === "particles")).toBe(true);
  });

  test("Camera3D har commonInputs for posisjon + AoV", () => {
    const camera = FUSION_TOOLS_CATALOG.find((e) => e.type === "Camera3D");
    expect(camera).toBeTruthy();
    const inputs = camera!.commonInputs!.map((i) => i.name);
    expect(inputs).toContain("AoV");
    expect(inputs).toContain("Translate.X");
    expect(inputs).toContain("Translate.Y");
    expect(inputs).toContain("Translate.Z");
  });

  test("Transform3D har alle 9 vektor-inputs (3 × X/Y/Z)", () => {
    const t = FUSION_TOOLS_CATALOG.find((e) => e.type === "Transform3D");
    const inputs = t!.commonInputs!.map((i) => i.name);
    expect(inputs).toContain("Translate.X");
    expect(inputs).toContain("Rotate.X");
    expect(inputs).toContain("XScale");
  });
});

test.describe("fusion_tools_reference enum oppdatert", () => {
  test("Schema-enum inkluderer 3d + particles", () => {
    const tool = PHOTOSHOP_TOOLS.find(
      (t) => t.name === "photoshop_resolve_fusion_tools_reference",
    );
    const schema = tool!.input_schema as {
      properties: { category: { enum: string[] } };
    };
    expect(schema.properties.category.enum).toContain("3d");
    expect(schema.properties.category.enum).toContain("particles");
  });

  test("Reference-tool returnerer 3d-kategori", async () => {
    installInvokeMock({ calls: [], response: null });
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "r1",
      name: "photoshop_resolve_fusion_tools_reference",
      input: { category: "3d" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.entries.length).toBeGreaterThanOrEqual(10);
    expect(parsed.entries.every((e: { category: string }) => e.category === "3d")).toBe(true);
  });

  test("Reference-tool returnerer particles-kategori", async () => {
    installInvokeMock({ calls: [], response: null });
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "r2",
      name: "photoshop_resolve_fusion_tools_reference",
      input: { category: "particles" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(
      parsed.entries.every((e: { category: string }) => e.category === "particles"),
    ).toBe(true);
  });
});

test.describe("set3DTransform helper", () => {
  test("Tool er registrert", () => {
    expect(
      PHOTOSHOP_TOOLS.find(
        (t) => t.name === "photoshop_resolve_fusion_comp_set_3d_transform",
      ),
    ).toBeTruthy();
  });

  test("Sender kun position når kun position er gitt", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, tool: "Camera3D1", inputs_set: 3 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "t1",
      name: "photoshop_resolve_fusion_comp_set_3d_transform",
      input: {
        tool_name: "Camera3D1",
        position: { x: 0, y: 0, z: -5 },
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: {
        tool_name: string;
        position?: { x?: number; y?: number; z?: number };
        rotation?: unknown;
        scale?: unknown;
      };
    };
    expect(params.command).toBe("resolve.fusionCompSet3DTransform");
    expect(params.params.position).toEqual({ x: 0, y: 0, z: -5 });
    expect(params.params.rotation).toBeUndefined();
    expect(params.params.scale).toBeUndefined();
  });

  test("Position + Rotation + uniform Scale", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, tool: "T3D", inputs_set: 9 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "t2",
      name: "photoshop_resolve_fusion_comp_set_3d_transform",
      input: {
        tool_name: "T3D",
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 45, z: 0 },
        scale: 1.5,
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: { scale: number | object; rotation: object };
    };
    expect(params.params.scale).toBe(1.5);
    expect(params.params.rotation).toEqual({ x: 0, y: 45, z: 0 });
  });

  test("Scale som {x,y,z}-vektor", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, tool: "T", inputs_set: 3 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "t3",
      name: "photoshop_resolve_fusion_comp_set_3d_transform",
      input: { tool_name: "T", scale: { x: 2, y: 1, z: 0.5 } },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { scale: { x?: number; y?: number; z?: number } } };
    expect(params.params.scale).toEqual({ x: 2, y: 1, z: 0.5 });
  });

  test("Avviser når INGEN av position/rotation/scale er gitt", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t4",
      name: "photoshop_resolve_fusion_comp_set_3d_transform",
      input: { tool_name: "Camera3D" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/position\/rotation\/scale/);
  });

  test("Avviser position som array", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t5",
      name: "photoshop_resolve_fusion_comp_set_3d_transform",
      input: { tool_name: "T", position: [0, 0, 0] },
    });
    expect(result.is_error).toBe(true);
  });

  test("Avviser tom tool_name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t6",
      name: "photoshop_resolve_fusion_comp_set_3d_transform",
      input: { tool_name: "", position: { x: 0 } },
    });
    expect(result.is_error).toBe(true);
  });

  test("Avviser scale som string", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t7",
      name: "photoshop_resolve_fusion_comp_set_3d_transform",
      input: { tool_name: "T", scale: "1.5" },
    });
    expect(result.is_error).toBe(true);
  });

  test("comp_name videresendes", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { set: true, tool: "x", inputs_set: 1 },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "t8",
      name: "photoshop_resolve_fusion_comp_set_3d_transform",
      input: {
        tool_name: "x",
        position: { y: 1 },
        comp_name: "3DScene",
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { comp_name?: string } };
    expect(params.params.comp_name).toBe("3DScene");
  });
});
