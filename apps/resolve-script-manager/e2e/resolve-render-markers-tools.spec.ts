/**
 * Render queue + Markers + ExportLUT e2e — verifiserer 11 nye tools
 * via dispatcher uten ekte Resolve.
 */

import { test, expect } from "@playwright/test";
import {
  PHOTOSHOP_TOOLS,
  runPhotoshopTool,
} from "../src/agents/photoshopTools";

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
  "photoshop_resolve_render_add_job",
  "photoshop_resolve_render_list",
  "photoshop_resolve_render_start",
  "photoshop_resolve_render_stop",
  "photoshop_resolve_render_status",
  "photoshop_resolve_render_delete_job",
  "photoshop_resolve_markers_list",
  "photoshop_resolve_markers_add",
  "photoshop_resolve_markers_delete_by_color",
  "photoshop_resolve_grades_copy_to_timeline",
  "photoshop_resolve_grades_export_lut",
];

test.describe("Resolve 21 Render Queue + Markers + ExportLUT", () => {
  test("Alle 11 nye tools er registrert", () => {
    for (const name of TOOL_NAMES) {
      expect(PHOTOSHOP_TOOLS.find((t) => t.name === name), `mangler ${name}`).toBeTruthy();
    }
  });

  test("render.addJob med preset_name", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { job_id: "job_abc123", preset: "H.264 Master" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t1",
      name: "photoshop_resolve_render_add_job",
      input: { preset_name: "H.264 Master", target_dir: "/Desktop" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.job_id).toBe("job_abc123");
    expect(parsed.preset).toBe("H.264 Master");

    const sendCall = records.calls.find((c) => c.command === "photoshop_send_command");
    const params = sendCall!.params as { command: string; params: { target_dir: string } };
    expect(params.command).toBe("resolve.renderAddJob");
    expect(params.params.target_dir).toBe("/Desktop");
  });

  test("render.list returnerer jobs-array", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        jobs: [
          { job_id: "j1", timeline_name: "Main", output_filename: "out1.mp4", status: "pending" },
          { job_id: "j2", timeline_name: "Main", output_filename: "out2.mp4", status: "rendering" },
        ],
        count: 2,
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t2",
      name: "photoshop_resolve_render_list",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.count).toBe(2);
    expect(parsed.jobs[0].status).toBe("pending");
  });

  test("render.start med spesifikk job_id", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { started: true, job_id: "j1", interactive_mode: false },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t3",
      name: "photoshop_resolve_render_start",
      input: { job_id: "j1" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.started).toBe(true);
    expect(parsed.job_id).toBe("j1");
  });

  test("render.start uten args — alle queued", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { started: true, job_id: "all", interactive_mode: false },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t4",
      name: "photoshop_resolve_render_start",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.job_id).toBe("all");
  });

  test("render.stop", async () => {
    const records = { calls: [] as MockInvoke[], response: { stopped: true } };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t5",
      name: "photoshop_resolve_render_stop",
      input: {},
    });
    expect(JSON.parse(result.content as string).stopped).toBe(true);
  });

  test("render.status returnerer in_progress", async () => {
    const records = { calls: [] as MockInvoke[], response: { in_progress: true } };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t6",
      name: "photoshop_resolve_render_status",
      input: {},
    });
    expect(JSON.parse(result.content as string).in_progress).toBe(true);
  });

  test("render.delete_job krever job_id", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t7",
      name: "photoshop_resolve_render_delete_job",
      input: {},
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/job_id/i);
  });

  test("markers.list", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        timeline: "Main",
        markers: [
          { frame: 100, color: "Yellow", name: "Slate 1", note: "", duration: 1, custom_data: "" },
        ],
        count: 1,
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t8",
      name: "photoshop_resolve_markers_list",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.count).toBe(1);
    expect(parsed.markers[0].name).toBe("Slate 1");
  });

  test("markers.add krever frame", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t9",
      name: "photoshop_resolve_markers_add",
      input: {},
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/frame/i);
  });

  test("markers.add med frame + color + name", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { added: true, frame: 240, color: "Green", name: "Climax" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t10",
      name: "photoshop_resolve_markers_add",
      input: { frame: 240, color: "Green", name: "Climax", duration: 30 },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.added).toBe(true);
    expect(parsed.color).toBe("Green");
  });

  test("markers.delete_by_color default 'All'", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { deleted: true, color: "All" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t11",
      name: "photoshop_resolve_markers_delete_by_color",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.color).toBe("All");
  });

  test("grades.copy_to_timeline", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: { copied: true, target_count: 12, source_item: "Hero shot" },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t12",
      name: "photoshop_resolve_grades_copy_to_timeline",
      input: {},
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.copied).toBe(true);
    expect(parsed.target_count).toBe(12);
  });

  test("grades.export_lut med path + 33Point", async () => {
    const records = {
      calls: [] as MockInvoke[],
      response: {
        exported: true,
        path: "/Desktop/cinematic.cube",
        export_type: "33Point",
        item: "Hero shot",
      },
    };
    installInvokeMock(records);

    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t13",
      name: "photoshop_resolve_grades_export_lut",
      input: { path: "/Desktop/cinematic.cube" },
    });
    const parsed = JSON.parse(result.content as string);
    expect(parsed.exported).toBe(true);
    expect(parsed.export_type).toBe("33Point");
  });

  test("grades.export_lut krever path", async () => {
    const records = { calls: [] as MockInvoke[], response: null };
    installInvokeMock(records);
    const result = await runPhotoshopTool({
      type: "tool_use",
      id: "t14",
      name: "photoshop_resolve_grades_export_lut",
      input: {},
    });
    expect(result.is_error).toBe(true);
    expect(result.content as string).toMatch(/path/i);
  });
});
