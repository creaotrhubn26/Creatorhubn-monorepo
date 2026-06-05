/**
 * Settings-catalog + reference tool e2e.
 */

import { test, expect } from "@playwright/test";
import { PHOTOSHOP_TOOLS, runPhotoshopTool } from "../src/agents/photoshopTools";
import {
  RESOLVE_SETTINGS_CATALOG,
  SETTING_CATEGORIES,
  validateSetting,
  getCatalog,
} from "../src/lib/resolveSettingsCatalog";

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

test.describe("Resolve settings-catalog struktur", () => {
  test("Katalogen har minst 20 entries", () => {
    expect(RESOLVE_SETTINGS_CATALOG.length).toBeGreaterThanOrEqual(20);
  });

  test("Hver entry har påkrevde felt", () => {
    for (const e of RESOLVE_SETTINGS_CATALOG) {
      expect(e.key, `entry mangler key`).toBeTruthy();
      expect(e.scope, `${e.key} mangler scope`).toBeTruthy();
      expect(e.category, `${e.key} mangler category`).toBeTruthy();
      expect(e.description, `${e.key} mangler description`).toBeTruthy();
      expect(e.valueFormat, `${e.key} mangler valueFormat`).toBeTruthy();
    }
  });

  test("Alle entries har scope = project | timeline | clip", () => {
    for (const e of RESOLVE_SETTINGS_CATALOG) {
      expect(["project", "timeline", "clip"]).toContain(e.scope);
    }
  });

  test("Alle entries har kategori i SETTING_CATEGORIES", () => {
    for (const e of RESOLVE_SETTINGS_CATALOG) {
      expect(SETTING_CATEGORIES).toContain(e.category as never);
    }
  });

  test("Inkluderer kjente kritiske keys", () => {
    const keys = RESOLVE_SETTINGS_CATALOG.map((e) => e.key);
    for (const expected of [
      "timelineFrameRate",
      "colorScienceMode",
      "superScale",
      "perfProxyMediaMode",
      "Super Scale",
      "Reel Name",
    ]) {
      expect(keys, `mangler ${expected}`).toContain(expected);
    }
  });
});

test.describe("validateSetting", () => {
  test("Ukjente keys returnerer ok (vi katalogiserer ikke alt)", () => {
    expect(validateSetting("project", "unknownKey", "anyValue")).toEqual({
      ok: true,
    });
  });

  test("Kjente enum-keys avviser ugyldig verdi", () => {
    const res = validateSetting("project", "timelineFrameRate", "12345");
    expect(res.ok).toBe(false);
    expect(res.warning).toMatch(/timelineFrameRate/);
  });

  test("Kjente enum-keys godtar gyldig verdi", () => {
    expect(validateSetting("project", "timelineFrameRate", "24")).toEqual({
      ok: true,
    });
    expect(validateSetting("project", "colorScienceMode", "davinciYRGBColorManagedv2")).toEqual({
      ok: true,
    });
  });

  test("colorScienceMode validerer", () => {
    expect(
      validateSetting("project", "colorScienceMode", "fakeMode").ok,
    ).toBe(false);
  });

  test("Scope-respektivt: timelineFrameRate finnes både i project + timeline", () => {
    expect(validateSetting("project", "timelineFrameRate", "30").ok).toBe(true);
    expect(validateSetting("timeline", "timelineFrameRate", "30").ok).toBe(true);
  });

  test("Clip-scope Super Scale godtar 0-4", () => {
    expect(validateSetting("clip", "Super Scale", "0").ok).toBe(true);
    expect(validateSetting("clip", "Super Scale", "4").ok).toBe(true);
    expect(validateSetting("clip", "Super Scale", "5").ok).toBe(false);
  });
});

test.describe("getCatalog filter", () => {
  test("Uten filter returnerer alle", () => {
    expect(getCatalog().length).toBe(RESOLVE_SETTINGS_CATALOG.length);
  });

  test("Scope-filter", () => {
    const project = getCatalog({ scope: "project" });
    expect(project.every((e) => e.scope === "project")).toBe(true);
    expect(project.length).toBeGreaterThan(0);

    const clip = getCatalog({ scope: "clip" });
    expect(clip.every((e) => e.scope === "clip")).toBe(true);
  });

  test("Category-filter", () => {
    const colorScience = getCatalog({ category: "colorScience" });
    expect(colorScience.length).toBeGreaterThanOrEqual(3);
    expect(colorScience.every((e) => e.category === "colorScience")).toBe(true);
  });

  test("Scope + category-filter kombinert", () => {
    const result = getCatalog({ scope: "project", category: "ai" });
    expect(result.every((e) => e.scope === "project" && e.category === "ai")).toBe(true);
  });
});

test.describe("Tool dispatcher", () => {
  test("photoshop_resolve_settings_reference er registrert", () => {
    expect(
      PHOTOSHOP_TOOLS.find((t) => t.name === "photoshop_resolve_settings_reference"),
    ).toBeTruthy();
  });

  test("Tool returnerer alle entries uten filter", async () => {
    installInvokeMock({ calls: [], response: null });
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s1",
      name: "photoshop_resolve_settings_reference",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.count).toBe(RESOLVE_SETTINGS_CATALOG.length);
    expect(parsed.filter.scope).toBeNull();
  });

  test("Tool respekterer scope-filter", async () => {
    installInvokeMock({ calls: [], response: null });
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s2",
      name: "photoshop_resolve_settings_reference",
      input: { scope: "clip" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.filter.scope).toBe("clip");
    expect(parsed.entries.every((e: { scope: string }) => e.scope === "clip")).toBe(true);
  });

  test("Tool respekterer category-filter", async () => {
    installInvokeMock({ calls: [], response: null });
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "s3",
      name: "photoshop_resolve_settings_reference",
      input: { category: "colorScience" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(
      parsed.entries.every((e: { category: string }) => e.category === "colorScience"),
    ).toBe(true);
  });

  test("Tool kaller IKKE photoshop_send_command (lokal lookup)", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    await runPhotoshopTool({
      type: "tool_use",
      id: "s4",
      name: "photoshop_resolve_settings_reference",
      input: {},
    });
    expect(records.calls.some((c) => c.command === "photoshop_send_command")).toBe(false);
  });
});

test.describe("setSetting auto-validering", () => {
  test("project.setSetting avviser ugyldig timelineFrameRate", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "v1",
      name: "photoshop_resolve_project_set_setting",
      input: { key: "timelineFrameRate", value: "200" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/timelineFrameRate/);
    expect(result.content as string).toMatch(/settings_reference/);
    expect(records.calls.some((c) => c.command === "photoshop_send_command")).toBe(false);
  });

  test("project.setSetting godtar gyldig timelineFrameRate", async () => {
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
      id: "v2",
      name: "photoshop_resolve_project_set_setting",
      input: { key: "timelineFrameRate", value: "30" },
    });
    expect(result.is_error).toBe(undefined);
    const parsed = JSON.parse(result.content as string);
    expect(parsed.set).toBe(true);
  });

  test("project.setSetting godtar ukjente keys (vi katalogiserer ikke alt)", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        scope: "project",
        set: true,
        key: "someExoticKey",
        value: "x",
      },
    };
    installInvokeMock(records);
    await runPhotoshopTool({
      type: "tool_use",
      id: "v3",
      name: "photoshop_resolve_project_set_setting",
      input: { key: "someExoticKey", value: "x" },
    });
    expect(records.calls.some((c) => c.command === "photoshop_send_command")).toBe(true);
  });

  test("clip.setProperty validerer Super Scale", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "v4",
      name: "photoshop_resolve_clip_set_property",
      input: { clip_id: "mp_1", key: "Super Scale", value: "99" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/Super Scale/);
  });

  test("timeline.setSetting validerer timelineFrameRate", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "v5",
      name: "photoshop_resolve_timeline_set_setting",
      input: { key: "timelineFrameRate", value: "1.5" },
    });
    expect(result.is_error).toBe(true);
  });
});
