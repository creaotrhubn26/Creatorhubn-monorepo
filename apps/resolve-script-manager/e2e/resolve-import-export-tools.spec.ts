/**
 * Import/Export timelines + projects e2e — 4 nye tools.
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
  "photoshop_resolve_media_pool_import_timeline_from_file",
  "photoshop_resolve_media_pool_delete_timelines",
  "photoshop_resolve_pm_import_project",
  "photoshop_resolve_pm_export_project",
];

test.describe("Resolve import/export timelines + projects", () => {
  test("Alle 4 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  // ──────── importTimelineFromFile ────────

  test("importTimelineFromFile godtar .drt + sender file_path", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        imported: true,
        timeline_name: "Wedding Skeleton",
        file_path: "/templates/wedding.drt",
        fps: "25",
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "i1",
      name: "photoshop_resolve_media_pool_import_timeline_from_file",
      input: { file_path: "/templates/wedding.drt" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { file_path: string };
    };
    expect(params.command).toBe("resolve.mediaPoolImportTimelineFromFile");
    expect(params.params.file_path).toBe("/templates/wedding.drt");
  });

  test("importTimelineFromFile støtter alle 7 filtyper", async () => {
    for (const ext of [".aaf", ".edl", ".xml", ".fcpxml", ".drt", ".adl", ".otio"]) {
      const records = {
        calls: [] as MockInvoke[],
        response: { imported: true, timeline_name: "X", file_path: `/x${ext}`, fps: "24" },
      };
      installInvokeMock(records);
      const result = await runPhotoshopTool({
        type: "tool_use",
        id: `i-${ext}`,
        name: "photoshop_resolve_media_pool_import_timeline_from_file",
        input: { file_path: `/x${ext}` },
      });
      expect(result.is_error, `${ext} skulle ikke feilet`).toBeUndefined();
    }
  });

  test("importTimelineFromFile avviser ugyldig filtype", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "i2",
      name: "photoshop_resolve_media_pool_import_timeline_from_file",
      input: { file_path: "/x.mp4" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/filtype/);
  });

  test("importTimelineFromFile videresender alle options", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { imported: true, timeline_name: "T", file_path: "/x.aaf", fps: "24" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "i3",
      name: "photoshop_resolve_media_pool_import_timeline_from_file",
      input: {
        file_path: "/x.aaf",
        timeline_name: "Renamed",
        import_source_clips: false,
        source_clips_path: "/Volumes/Footage",
        interlace_processing: true,
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: {
        timeline_name?: string;
        import_source_clips?: boolean;
        source_clips_path?: string;
        interlace_processing?: boolean;
      };
    };
    expect(params.params.timeline_name).toBe("Renamed");
    expect(params.params.import_source_clips).toBe(false);
    expect(params.params.source_clips_path).toBe("/Volumes/Footage");
    expect(params.params.interlace_processing).toBe(true);
  });

  test("importTimelineFromFile avviser tom file_path", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "i4",
      name: "photoshop_resolve_media_pool_import_timeline_from_file",
      input: { file_path: "" },
    });
    expect(result.is_error).toBe(true);
  });

  // ──────── deleteTimelines ────────

  test("deleteTimelines sender array", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { deleted: true, count: 2, names: ["A", "B"] },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "d1",
      name: "photoshop_resolve_media_pool_delete_timelines",
      input: { timeline_names: ["A", "B"] },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { timeline_names: string[] };
    };
    expect(params.command).toBe("resolve.mediaPoolDeleteTimelines");
    expect(params.params.timeline_names).toEqual(["A", "B"]);
  });

  test("deleteTimelines avviser tom array", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "d2",
      name: "photoshop_resolve_media_pool_delete_timelines",
      input: { timeline_names: [] },
    });
    expect(result.is_error).toBe(true);
  });

  test("deleteTimelines avviser non-string entries", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "d3",
      name: "photoshop_resolve_media_pool_delete_timelines",
      input: { timeline_names: ["A", 42] },
    });
    expect(result.is_error).toBe(true);
  });

  // ──────── pmImportProject ────────

  test("pmImportProject godtar .drp", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { imported: true, file_path: "/backup/Wedding.drp", project_name: "" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "p1",
      name: "photoshop_resolve_pm_import_project",
      input: { file_path: "/backup/Wedding.drp" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: { file_path: string; project_name?: string };
    };
    expect(params.command).toBe("resolve.pmImportProject");
    expect(params.params.file_path).toBe("/backup/Wedding.drp");
    expect(params.params.project_name).toBeUndefined();
  });

  test("pmImportProject med project_name override", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { imported: true, file_path: "/x.drp", project_name: "Wedding 2027" },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "p2",
      name: "photoshop_resolve_pm_import_project",
      input: { file_path: "/x.drp", project_name: "Wedding 2027" },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { params: { project_name?: string } };
    expect(params.params.project_name).toBe("Wedding 2027");
  });

  test("pmImportProject avviser ikke-drp", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "p3",
      name: "photoshop_resolve_pm_import_project",
      input: { file_path: "/x.zip" },
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/\.drp/);
  });

  // ──────── pmExportProject ────────

  test("pmExportProject sender alle felter", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        exported: true,
        project_name: "Wedding",
        file_path: "/backup/W.drp",
        with_stills_and_luts: true,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "e1",
      name: "photoshop_resolve_pm_export_project",
      input: {
        project_name: "Wedding",
        file_path: "/backup/W.drp",
        with_stills_and_luts: true,
      },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      command: string;
      params: {
        project_name: string;
        file_path: string;
        with_stills_and_luts?: boolean;
      };
    };
    expect(params.command).toBe("resolve.pmExportProject");
    expect(params.params.project_name).toBe("Wedding");
    expect(params.params.file_path).toBe("/backup/W.drp");
    expect(params.params.with_stills_and_luts).toBe(true);
  });

  test("pmExportProject med with_stills_and_luts=false", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        exported: true,
        project_name: "X",
        file_path: "/y.drp",
        with_stills_and_luts: false,
      },
    };
    installInvokeMock(records);

    await runPhotoshopTool({
      type: "tool_use",
      id: "e2",
      name: "photoshop_resolve_pm_export_project",
      input: { project_name: "X", file_path: "/y.drp", with_stills_and_luts: false },
    });

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as {
      params: { with_stills_and_luts?: boolean };
    };
    expect(params.params.with_stills_and_luts).toBe(false);
  });

  test("pmExportProject avviser tom project_name", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e3",
      name: "photoshop_resolve_pm_export_project",
      input: { project_name: "", file_path: "/x.drp" },
    });
    expect(result.is_error).toBe(true);
  });

  test("pmExportProject avviser tom file_path", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "e4",
      name: "photoshop_resolve_pm_export_project",
      input: { project_name: "X", file_path: "" },
    });
    expect(result.is_error).toBe(true);
  });
});
