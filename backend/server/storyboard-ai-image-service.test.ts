import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  generateStoryboardImage,
  normalizeStoryboardProviderImage,
  resolveStoryboardImageAspectRequest,
  storyboardImageGenerationBodySchema,
  StoryboardImageGenerationError,
  StoryboardImageProviderOutcomeUnknownError,
} from "./storyboard-ai-image-service.js";
import type { Storyboard } from "./storyboard-service.js";

let providerLandscapeBase64 = "";

beforeAll(async () => {
  providerLandscapeBase64 = (await sharp({
    create: {
      width: 1536,
      height: 1024,
      channels: 4,
      background: { r: 56, g: 88, b: 120, alpha: 1 },
    },
  }).png().toBuffer()).toString("base64");
});

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
  it.each([
    {
      name: "transport failure",
      fetchImpl: vi.fn().mockRejectedValue(new Error("socket reset")),
      code: "openai_submission_unknown",
    },
    {
      name: "provider 5xx",
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 503 }),
      code: "openai_server_result_unknown",
    },
    {
      name: "accepted response without an image",
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true, status: 200, json: async () => ({ data: [] }),
      }),
      code: "openai_output_missing",
    },
  ])("classifies $name after POST as an ambiguous provider outcome", async ({
    fetchImpl, code,
  }) => {
    const body = storyboardImageGenerationBodySchema.parse({
      prompt: "Trollet går over åskammen.", quality: "standard",
    });

    const promise = generateStoryboardImage({
      pool: poolWithReferences([]) as any,
      storyboard,
      projectId: storyboard.projectId,
      userId: "director",
      body,
      apiKey: "test-key",
      providerIdempotencyKey: "operation-ambiguous-1",
      fetchImpl: fetchImpl as any,
    });

    await expect(promise).rejects.toBeInstanceOf(
      StoryboardImageProviderOutcomeUnknownError,
    );
    await expect(promise).rejects.toMatchObject({ code, status: 502 });
  });

  it("keeps an explicit provider 4xx as a definitive rejection", async () => {
    const body = storyboardImageGenerationBodySchema.parse({
      prompt: "Trollet går over åskammen.", quality: "standard",
    });
    let error: unknown;
    try {
      await generateStoryboardImage({
        pool: poolWithReferences([]) as any,
        storyboard,
        projectId: storyboard.projectId,
        userId: "director",
        body,
        apiKey: "test-key",
        providerIdempotencyKey: "operation-rejected-1",
        fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 400 }) as any,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(StoryboardImageGenerationError);
    expect(error).not.toBeInstanceOf(StoryboardImageProviderOutcomeUnknownError);
    expect(error).toMatchObject({ code: "openai_failed" });
  });

  it("lets authoritative shot context choose provider orientation and rejects conflicts", () => {
    expect(resolveStoryboardImageAspectRequest({
      requestedAspectToken: "1792x1024",
      contextualAspectRatio: 9 / 16,
    })).toEqual({
      requestedAspectToken: "1792x1024",
      effectiveAspectToken: "1024x1792",
      targetAspectRatio: 9 / 16,
    });
    expect(resolveStoryboardImageAspectRequest({
      requestedAspectToken: "1792x1024",
      requestedTargetAspectRatio: 2.39,
    })).toMatchObject({
      effectiveAspectToken: "1792x1024",
      targetAspectRatio: 2.39,
    });

    let mismatch: unknown;
    try {
      resolveStoryboardImageAspectRequest({
        requestedAspectToken: "1792x1024",
        requestedTargetAspectRatio: 1,
        contextualAspectRatio: 16 / 9,
      });
    } catch (error) {
      mismatch = error;
    }
    expect(mismatch).toMatchObject({ status: 400, code: "aspect_ratio_mismatch" });
  });

  it("center-crops a provider raster to a custom shot aspect without scaling", async () => {
    const normalized = await normalizeStoryboardProviderImage(
      providerLandscapeBase64,
      "1792x1024",
      2.39,
    );

    expect(normalized).toMatchObject({
      sourceWidth: 1536,
      sourceHeight: 1024,
      width: 1536,
      height: 642,
      crop: { left: 0, top: 191, width: 1536, height: 642 },
      canonicalLabel: "custom",
      canonicalAspectRatio: 2.39,
      outputAspectRatio: 1536 / 642,
      normalization: "center-crop-no-upscale",
    });
    const output = Buffer.from(normalized.imageData.split(",")[1], "base64");
    await expect(sharp(output).metadata()).resolves.toMatchObject({
      width: 1536,
      height: 642,
      format: "png",
    });
  });

  it("uses the inexpensive text-generation path for a standard draft without references", async () => {
    const pool = poolWithReferences([]);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: providerLandscapeBase64 }] }),
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
    expect(sent.size).toBe("1536x1024");
    expect(sent.prompt).toContain("Trollet på vandring");
    expect(generated.referenceCount).toBe(0);
    expect(generated.model).toBe("gpt-image-1-mini");
    expect([generated.width, generated.height]).toEqual([1536, 864]);
    expect(generated.width / generated.height).toBe(16 / 9);
    const normalizedBytes = Buffer.from(generated.imageData.split(",")[1], "base64");
    await expect(sharp(normalizedBytes).metadata()).resolves.toMatchObject({
      width: 1536,
      height: 864,
      format: "png",
    });
    expect(generated.metadata.aspectPolicy).toMatchObject({
      normalization: "center-crop-no-upscale",
      canonicalLabel: "16:9",
      providerWidth: 1536,
      providerHeight: 1024,
      outputWidth: 1536,
      outputHeight: 864,
      outputAspectRatio: 16 / 9,
      crop: { left: 0, top: 80, width: 1536, height: 864 },
    });
  });

  it("uses multipart edits and real approved image bytes when scene references apply", async () => {
    const pool = poolWithReferences([approvedRow, approvedSequenceRow]);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ b64_json: providerLandscapeBase64, revised_prompt: "kept continuity" }],
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

  it("sends the pencil drawing first and compiles a strict AI Color edit", async () => {
    const pool = poolWithReferences([approvedRow]);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: providerLandscapeBase64 }] }),
    });
    const body = storyboardImageGenerationBodySchema.parse({
      context: {
        version: "storyboard-shot-v1",
        manuscriptTitle: "TROLL",
        project: { styleProfileId: "story-pencil", creativeDirection: "" },
        production: {
          characters: [{
            id: "trollet", name: "Trollet", description: "40 meter høyt",
            referenceImageIds: ["ref-troll-creature-v1"], locked: true,
          }],
          wardrobe: [], locations: [], props: [],
        },
        scene: {
          id: "scene-8", number: 8, heading: "Åskam", intExt: "EXT",
          location: "Dovrefjell", timeOfDay: "NATT", action: "Trollet går.",
          characters: ["Trollet"],
        },
        shot: {
          id: "frame-8a", number: "8A", description: "Trollet går over åskammen.",
          notes: "", shotType: "Wide", angle: "", lensMm: 35,
          movement: "Static", lighting: "", durationSec: 5, transition: "",
          focusDepth: "", timeOfDay: "NATT", weather: "", beat: "", tags: [],
          shotFraming: {
            version: 1, centerX: 0.4, centerY: 0.5, zoom: 2,
            rollDegrees: 0, aspectRatio: 16 / 9,
            focusAnchorX: 0.5, focusAnchorY: 0.5,
            mode: "manual", revision: 2,
          },
        },
        continuity: { previous: null, next: null }, directorNote: "", visualStyle: "",
        productionMarks: [{
          strokeId: "focus-source", kind: "focus",
          center: { x: 0.45, y: 0.5 },
          bounds: { x: 0.4, y: 0.4, width: 0.1, height: 0.2 },
          direction: null,
        }],
      },
      quality: "hd",
    });
    await generateStoryboardImage({
      pool: pool as any,
      storyboard,
      projectId: storyboard.projectId,
      userId: "director",
      body,
      apiKey: "test-key",
      authoritativeSource: {
        imageData: `data:image/png;base64,${Buffer.alloc(64, 1).toString("base64")}`,
        stage: "pencil",
      },
      providerIdempotencyKey: "operation-stable-123",
      fetchImpl: fetchImpl as any,
    });

    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.openai.com/v1/images/edits");
    expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({
      "Idempotency-Key": "operation-stable-123",
    });
    const form = fetchImpl.mock.calls[0][1].body as FormData;
    const prompt = String(form.get("prompt"));
    expect(prompt).toContain("authoritative hand-drawn pencil composition");
    expect(prompt).toContain("Preserve the first image's exact framing");
    expect(prompt).toContain(
      "focus anchor at 70% from left, 50% from top in the applied viewport",
    );
    expect(prompt).toContain("Center 60% from left, 50% from top");
    const images = form.getAll("image[]") as File[];
    expect(images).toHaveLength(2);
    expect(images[0].name).toContain("authoritative-pencil");
    expect(images[1].name).not.toContain("authoritative-pencil");
  });

  it("keeps the approved color image authoritative during atmosphere edits", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: [{ b64_json: providerLandscapeBase64 }] }),
    });
    const body = storyboardImageGenerationBodySchema.parse({
      prompt: "Cold moonlight, rain and restrained haze.",
      sceneDescription: "Trollet går over åskammen.",
      quality: "hd",
    });
    const generated = await generateStoryboardImage({
      pool: poolWithReferences([]) as any,
      storyboard,
      projectId: storyboard.projectId,
      userId: "director",
      body,
      apiKey: "test-key",
      authoritativeSource: {
        imageData: `data:image/png;base64,${Buffer.alloc(64, 2).toString("base64")}`,
        stage: "color",
      },
      fetchImpl: fetchImpl as any,
    });
    const form = fetchImpl.mock.calls[0][1].body as FormData;
    expect(String(form.get("prompt"))).toContain("Add only the specified motivated lighting");
    expect((form.getAll("image[]")[0] as File).name).toContain("authoritative-color");
    expect(generated.metadata.providerMode).toBe("source-first-edit");
    expect(generated.metadata.stage).toBe("storyboard-atmosphere");
  });
});
