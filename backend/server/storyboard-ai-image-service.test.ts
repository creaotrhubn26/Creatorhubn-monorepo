import { describe, expect, it, vi } from "vitest";
import {
  generateStoryboardImage,
  storyboardImageGenerationBodySchema,
} from "./storyboard-ai-image-service.js";
import type { Storyboard } from "./storyboard-service.js";

const storyboard: Storyboard = {
  id: "storyboard-8a",
  projectId: "troll-project-2026",
  sceneId: "scene-8",
  frameId: "frame-8a",
  title: "8A — EXTREME WIDE: Trollet over åskam",
  strokes: [],
  imageData: null,
  width: 1920,
  height: 1080,
  workflowLevel: "rough",
  metadata: {},
  createdBy: "owner",
  createdAt: "2026-08-26T09:00:00Z",
  updatedAt: "2026-08-26T09:00:00Z",
};

const sceneRow = {
  id: "scene-8",
  scene_number: 8,
  title: "Trollet på vandring",
  description: "Trollet tar lange skritt over en åskam. Det er sørgmodig.",
  setting: "Dovrefjell",
  time_of_day: "NATT",
  int_ext: "EXT",
  characters: ["Trollet"],
  production_breakdown: {},
};

const approvedRow = {
  id: "ref-troll-creature-v1",
  project_id: "troll-project-2026",
  pack_id: "troll-production-bible",
  pack_version: "v1",
  entity_type: "character",
  entity_id: "trollet",
  scene_ids: ["scene-8"],
  name: "Trollet — skapning og skala",
  description: "40 meter høyt sørgmodig fjelltroll.",
  reference_image_id: "builtin://troll/v1/troll-creature-scale",
  approval_status: "approved",
  locked: true,
  metadata: {},
  created_by: "owner",
  approved_by: "director",
  approved_at: new Date("2026-08-26T10:00:00Z"),
  created_at: new Date("2026-08-26T09:00:00Z"),
  updated_at: new Date("2026-08-26T10:00:00Z"),
};

const approvedSequenceRow = {
  ...approvedRow,
  id: "ref-troll-scene-8-sequence-v1",
  entity_type: "storyboard",
  entity_id: "scene-8",
  name: "Scene 8 — trollet på vandring",
  description: "Tre sammenhengende storyboardruter.",
  reference_image_id: "builtin://troll/v1/scene-8-storyboard-sequence",
};

function poolWithReferences(referenceRows: unknown[]) {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("FROM casting_scenes")) return { rows: [sceneRow] };
      if (sql.includes("FROM casting_roles")) return { rows: [] };
      if (sql.includes("FROM casting_candidates")) return { rows: [] };
      if (sql.includes("FROM casting_locations")) return { rows: [] };
      if (sql.includes("FROM casting_props")) return { rows: [] };
      if (sql.includes("FROM storyboard_reference_assets"))
        return { rows: referenceRows };
      return { rows: [] };
    }),
  };
}

describe("generateStoryboardImage", () => {
  it("uses the inexpensive text-generation path for a standard draft without references", async () => {
    const pool = poolWithReferences([]);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: "AAAA" }] }),
    });
    const body = storyboardImageGenerationBodySchema.parse({
      prompt: "Vis den sørgmodige silhuetten.",
      shotType: "Extreme wide",
      quality: "standard",
    });

    const generated = await generateStoryboardImage({
      pool: pool as any,
      storyboard,
      projectId: storyboard.projectId,
      userId: "director",
      body,
      apiKey: "test-key",
      fetchImpl: fetchImpl as any,
    });

    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://api.openai.com/v1/images/generations",
    );
    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sent.model).toBe("gpt-image-1-mini");
    expect(sent.prompt).toContain("Trollet på vandring");
    expect(generated.referenceCount).toBe(0);
    expect(generated.model).toBe("gpt-image-1-mini");
  });

  it("uses multipart edits and real approved image bytes when scene references apply", async () => {
    const pool = poolWithReferences([approvedRow, approvedSequenceRow]);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ b64_json: "BBBB", revised_prompt: "kept continuity" }],
      }),
    });
    const body = storyboardImageGenerationBodySchema.parse({
      prompt: "Behold samme ansikt og materialmønster.",
      shotType: "Extreme wide",
      quality: "hd",
    });

    const generated = await generateStoryboardImage({
      pool: pool as any,
      storyboard,
      projectId: storyboard.projectId,
      userId: "director",
      body,
      apiKey: "test-key",
      fetchImpl: fetchImpl as any,
    });

    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://api.openai.com/v1/images/edits",
    );
    const form = fetchImpl.mock.calls[0][1].body as FormData;
    expect(form.get("model")).toBe("gpt-image-2");
    expect(form.get("prompt")).toEqual(
      expect.stringContaining("locked visual reference"),
    );
    const images = form.getAll("image[]");
    expect(images).toHaveLength(2);
    expect(images[0]).toBeInstanceOf(Blob);
    expect((images[0] as Blob).size).toBeGreaterThan(100_000);
    expect(generated.referenceCount).toBe(2);
    expect(generated.referenceAssetIds).toEqual([
      "ref-troll-creature-v1",
      "ref-troll-scene-8-sequence-v1",
    ]);
    expect(generated.metadata.providerMode).toBe("reference-edit");
  });
});
