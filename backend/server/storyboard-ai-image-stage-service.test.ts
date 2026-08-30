import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import {
  approveStoryboardAIImageVersion,
  claimStoryboardAIImageOperation,
  generateStoryboardAIImageStage,
  listStoryboardAIImageVersions,
  validateStoryboardGenerationSnapshot,
} from "./storyboard-ai-image-stage-service.js";
import {
  normalizeShotFramingState,
  shotFramingFingerprint,
} from "../../frontend/shared/storyboard-shot-framing.js";
import type { Storyboard } from "./storyboard-service.js";

const framing = {
  version: 1, shotSize: "MCU", angle: "Eye level", lensMm: 50,
  centerX: 0.5, centerY: 0.42, zoom: 2.15, rollDegrees: 0,
  aspectRatio: 16 / 9, mode: "automatic", revision: 3,
};
const framingFingerprint = shotFramingFingerprint(framing)!;
const normalizedFraming = normalizeShotFramingState(framing)!;
const compatFrameUpdatedAt = "2026-08-28T20:00:00.000Z";
const compatManuscriptId = "manuscript-1";
const paintoverFrameUpdatedAt = "2026-08-28T20:00:01.000Z";
const approvedColorVersionId = "11111111-1111-4111-8111-111111111111";
const colorFingerprint = "a".repeat(64);
const atmosphereFingerprint = "b".repeat(64);
const paintoverState = {
  version: 1,
  colorRevision: 3,
  atmosphereRevision: 5,
  colorFingerprint,
  atmosphereFingerprint,
  colorHasContent: true,
  atmosphereHasContent: false,
  atmosphereStale: false,
  videoStale: true,
};

const storyboard: Storyboard = {
  id: "3d8b43a3-9287-44b8-97e9-abca677a98de",
  projectId: "project-1",
  sceneId: "scene-1",
  frameId: "frame-1a",
  title: "1A",
  strokes: [],
  imageData: `data:image/png;base64,${Buffer.alloc(64, 1).toString("base64")}`,
  width: 1920,
  height: 1080,
  workflowLevel: "ai-pipeline-pencil-source",
  metadata: {
    currentFramingFingerprint: framingFingerprint,
    sourceRevision: 0,
    compatFrameUpdatedAt,
    compatSourceUpdatedAt: compatFrameUpdatedAt,
  },
  createdBy: "artist-1",
  createdAt: "2026-08-28T20:00:00Z",
  updatedAt: "2026-08-28T20:00:00Z",
};

const context = {
  version: "storyboard-shot-v1" as const,
  manuscriptTitle: "The Role Room",
  project: { styleProfileId: "story-pencil", creativeDirection: "" },
  production: { characters: [], wardrobe: [], locations: [], props: [] },
  scene: {
    id: "scene-1", number: 1, heading: "Writers room", intExt: "INT",
    location: "Studio", timeOfDay: "DAY", action: "The team gathers.",
    characters: ["Director"],
  },
  shot: {
    id: "frame-1a", number: "1A", description: "Director invites the team.",
    notes: "", shotType: "MCU", angle: "Eye level", lensMm: 50,
    movement: "Static", lighting: "Soft window key", durationSec: 5,
    transition: "", focusDepth: "", timeOfDay: "DAY", weather: "",
    beat: "Invitation", tags: [],
    shotFraming: framing,
  },
  continuity: { previous: null, next: null }, directorNote: "", visualStyle: "",
};

const acknowledgedBody = {
  context,
  quality: "hd" as const,
  aspectRatio: "1792x1024" as const,
  expectedSourceRevision: 0,
  expectedCompatFrameUpdatedAt: compatFrameUpdatedAt,
};

function colorPaintoverComposite(
  imageData: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    imageData,
    width: 320,
    height: 180,
    includedThroughStage: "color" as const,
    baseVersionId: approvedColorVersionId,
    frameUpdatedAt: paintoverFrameUpdatedAt,
    sourceUpdatedAt: compatFrameUpdatedAt,
    sourceRevision: 0,
    framingFingerprint,
    colorRevision: paintoverState.colorRevision,
    atmosphereRevision: paintoverState.atmosphereRevision,
    colorFingerprint,
    atmosphereFingerprint,
    ...overrides,
  };
}
function storyboardDatabaseResult(value: Storyboard = storyboard) {
  return {
    rows: [{
      id: value.id,
      project_id: value.projectId,
      scene_id: value.sceneId,
      frame_id: value.frameId,
      title: value.title,
      strokes: value.strokes,
      image_data: value.imageData,
      width: value.width,
      height: value.height,
      workflow_level: value.workflowLevel,
      metadata: value.metadata,
      created_by: value.createdBy,
      created_at: value.createdAt,
      updated_at: value.updatedAt,
    }],
    rowCount: 1,
  };
}

function versionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "version-color-1", project_id: "project-1",
    storyboard_id: storyboard.id, stage: "color", parent_version_id: "pencil-1",
    status: "generated", source_fingerprint: "abc12345",
    compilation_fingerprint: "compile123", image_data: storyboard.imageData,
    width: 1536, height: 864, model: "gpt-image-2", quality: "hd",
    metadata: {
      framingFingerprint,
      aiRasterPlacementFraming: normalizedFraming,
      sourceRevision: 0,
      frameId: storyboard.frameId,
      compatManuscriptId,
      compatSceneId: storyboard.sceneId,
      compatFrameId: storyboard.frameId,
      compatFrameUpdatedAt,
    },
    created_by: "artist-1", created_at: new Date(),
    approved_by: null, approved_at: null, ...overrides,
  };
}

describe("storyboard AI image stage chain", () => {
  it("refuses Atmosphere until a Color version has been approved", async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("SELECT * FROM casting_storyboards WHERE id")) {
          return storyboardDatabaseResult();
        }
        if (sql.includes("FROM casting_scenes scene")) {
          return {
            rows: [{
              manuscript_id: compatManuscriptId,
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: compatFrameUpdatedAt,
                  shotFraming: framing,
                }],
              }],
            }],
          };
        }
        if (sql.includes("SELECT * FROM storyboard_ai_image_versions")) return { rows: [] };
        return { rows: [] };
      }),
    };
    await expect(generateStoryboardAIImageStage(pool as any, {
      storyboard, projectId: storyboard.projectId, userId: "artist-1",
      stage: "atmosphere",
      body: acknowledgedBody,
      apiKey: "unused",
    })).rejects.toMatchObject({
      status: 409, code: "approved_color_required",
    });
  });

  it("rejects an approved Color parent rendered from an older source revision", async () => {
    const newerStoryboard = {
      ...storyboard,
      metadata: {
        ...storyboard.metadata,
        sourceRevision: 1,
      },
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("SELECT * FROM casting_storyboards WHERE id")) {
          return storyboardDatabaseResult(newerStoryboard);
        }
        if (sql.includes("FROM casting_scenes scene")) {
          return {
            rows: [{
              manuscript_id: compatManuscriptId,
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: compatFrameUpdatedAt,
                  shotFraming: framing,
                }],
              }],
            }],
          };
        }
        if (sql.includes("SELECT * FROM storyboard_ai_image_versions")) {
          return {
            rows: [versionRow({
              status: "approved",
              stage: "color",
              metadata: {
                framingFingerprint,
                sourceRevision: 0,
                compatFrameUpdatedAt,
              },
            })],
          };
        }
        return { rows: [] };
      }),
    };

    await expect(generateStoryboardAIImageStage(pool as any, {
      storyboard: newerStoryboard,
      projectId: storyboard.projectId,
      userId: "artist-1",
      stage: "atmosphere",
      body: { ...acknowledgedBody, expectedSourceRevision: 1 },
      apiKey: "unused",
    })).rejects.toMatchObject({
      status: 409,
      code: "approved_color_source_stale",
    });
  });

  it("rejects an approved Color parent when its adopted compat token is stale", async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("SELECT * FROM casting_storyboards WHERE id")) {
          return storyboardDatabaseResult();
        }
        if (sql.includes("FROM casting_scenes scene")) {
          return {
            rows: [{
              manuscript_id: compatManuscriptId,
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: compatFrameUpdatedAt,
                  shotFraming: framing,
                }],
              }],
            }],
          };
        }
        if (sql.includes("SELECT * FROM storyboard_ai_image_versions")) {
          return {
            rows: [versionRow({
              status: "approved",
              stage: "color",
              metadata: {
                framingFingerprint,
                sourceRevision: 0,
                adoptedFrameUpdatedAt: "2026-08-28T19:00:00.000Z",
              },
            })],
          };
        }
        return { rows: [] };
      }),
    };

    await expect(generateStoryboardAIImageStage(pool as any, {
      storyboard,
      projectId: storyboard.projectId,
      userId: "artist-1",
      stage: "atmosphere",
      body: acknowledgedBody,
      apiKey: "unused",
    })).rejects.toMatchObject({
      status: 409,
      code: "approved_color_source_stale",
    });
  });

  it("rejects Color when the retained Pencil parent is from an older shot token", async () => {
    const approvedStoryboard = {
      ...storyboard,
      workflowLevel: "ai-color-approved",
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("SELECT * FROM casting_storyboards WHERE id")) {
          return storyboardDatabaseResult(approvedStoryboard);
        }
        if (sql.includes("FROM casting_scenes scene")) {
          return {
            rows: [{
              manuscript_id: compatManuscriptId,
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: compatFrameUpdatedAt,
                  shotFraming: framing,
                }],
              }],
            }],
          };
        }
        if (sql.includes("SELECT * FROM storyboard_ai_image_versions")) {
          return {
            rows: [versionRow({
              stage: "pencil",
              status: "source",
              parent_version_id: null,
              metadata: {
                framingFingerprint,
                sourceRevision: 0,
                compatFrameUpdatedAt: "2026-08-28T19:00:00.000Z",
              },
            })],
          };
        }
        return { rows: [] };
      }),
    };

    await expect(generateStoryboardAIImageStage(pool as any, {
      storyboard: approvedStoryboard,
      projectId: storyboard.projectId,
      userId: "artist-1",
      stage: "color",
      body: acknowledgedBody,
      apiKey: "unused",
    })).rejects.toMatchObject({
      status: 409,
      code: "pencil_source_stale",
    });
  });

  it("returns candidate and current source revisions together after reload", async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("SELECT version.*")) {
          return {
            rows: [versionRow({
              storyboard_metadata: {
                currentFramingFingerprint: framingFingerprint,
                sourceRevision: 3,
                compatSourceUpdatedAt: compatFrameUpdatedAt,
              },
            })],
          };
        }
        return { rows: [] };
      }),
    };

    const reloadedList = await listStoryboardAIImageVersions(pool as any, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
    });
    const [reloaded] = reloadedList.versions;
    expect(reloaded.sourceRevision).toBe(0);
    expect(reloaded.currentSourceRevision).toBe(3);
    expect(reloadedList.currentSourceRevision).toBe(3);
    expect(reloadedList.sourceUpdatedAt).toBe(compatFrameUpdatedAt);
  });

  it("requires the exact acknowledged source revision and compat token", async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("SELECT * FROM casting_storyboards WHERE id")) {
          return storyboardDatabaseResult();
        }
        if (sql.includes("FROM casting_scenes scene")) {
          return {
            rows: [{
              manuscript_id: compatManuscriptId,
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: compatFrameUpdatedAt,
                  shotFraming: framing,
                }],
              }],
            }],
          };
        }
        return { rows: [] };
      }),
    };

    await expect(validateStoryboardGenerationSnapshot(pool as any, {
      storyboard,
      body: { context, expectedSourceRevision: 0 },
    })).rejects.toMatchObject({
      status: 409,
      code: "source_snapshot_required",
    });
    await expect(validateStoryboardGenerationSnapshot(pool as any, {
      storyboard,
      body: {
        ...acknowledgedBody,
        expectedCompatFrameUpdatedAt: "2026-08-28T20:00:01.000Z",
      },
    })).rejects.toMatchObject({
      status: 409,
      code: "source_snapshot_stale",
    });
  });

  it("rejects a live compat source that was not mirrored into the normalized row", async () => {
    const liveSourceUpdatedAt = "2026-08-28T20:00:02.000Z";
    const staleMirrorStoryboard: Storyboard = {
      ...storyboard,
      metadata: {
        ...storyboard.metadata,
        compatSourceUpdatedAt: compatFrameUpdatedAt,
      },
    };
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("SELECT * FROM casting_storyboards WHERE id")) {
          return storyboardDatabaseResult(staleMirrorStoryboard);
        }
        if (sql.includes("FROM casting_scenes scene")) {
          return {
            rows: [{
              manuscript_id: compatManuscriptId,
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: liveSourceUpdatedAt,
                  sourceUpdatedAt: liveSourceUpdatedAt,
                  shotFraming: framing,
                }],
              }],
            }],
          };
        }
        return { rows: [] };
      }),
    };

    await expect(validateStoryboardGenerationSnapshot(pool as any, {
      storyboard: staleMirrorStoryboard,
      body: {
        ...acknowledgedBody,
        expectedCompatFrameUpdatedAt: liveSourceUpdatedAt,
      },
    })).rejects.toMatchObject({
      status: 409,
      code: "source_snapshot_stale",
    });
  });

  it("never launders an approved Color raster into a new Pencil source", async () => {
    const reframedStoryboard: Storyboard = {
      ...storyboard,
      workflowLevel: "ai-pipeline-pencil-source",
      metadata: {
        ...storyboard.metadata,
        sourceRevision: 1,
      },
    };
    const pool = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes("SELECT * FROM casting_storyboards WHERE id")) {
          return storyboardDatabaseResult(reframedStoryboard);
        }
        if (sql.includes("FROM casting_scenes scene")) {
          return {
            rows: [{
              manuscript_id: compatManuscriptId,
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: compatFrameUpdatedAt,
                  shotFraming: framing,
                }],
              }],
            }],
          };
        }
        if (sql.includes("SELECT * FROM storyboard_ai_image_versions")) {
          return {
            rows: [versionRow({
              id: "pencil-old",
              stage: "pencil",
              status: "source",
              parent_version_id: null,
              source_fingerprint: "older-pencil",
              metadata: {
                framingFingerprint,
                sourceRevision: 0,
                compatManuscriptId,
                compatSceneId: storyboard.sceneId,
                compatFrameId: storyboard.frameId,
                compatFrameUpdatedAt,
              },
            })],
          };
        }
        if (sql.includes("stage = ANY") && params[2] === storyboard.imageData) {
          return { rows: [{ exists: 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };

    await expect(generateStoryboardAIImageStage(pool as any, {
      storyboard: reframedStoryboard,
      projectId: storyboard.projectId,
      userId: "artist-1",
      stage: "color",
      body: { ...acknowledgedBody, expectedSourceRevision: 1 },
      apiKey: "unused",
    })).rejects.toMatchObject({
      status: 409,
      code: "pencil_source_ai_output",
    });
    expect(pool.query.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO storyboard_ai_image_versions"))).toBe(false);
  });

  it("sends the exact validated Color paintover composite to Atmosphere", async () => {
    const compositeBytes = await sharp({
      create: {
        width: 320, height: 180, channels: 4,
        background: { r: 32, g: 64, b: 96, alpha: 1 },
      },
    }).png().toBuffer();
    const baseBytes = await sharp({
      create: {
        width: 320, height: 180, channels: 4,
        background: { r: 200, g: 180, b: 160, alpha: 1 },
      },
    }).png().toBuffer();
    const outputBytes = await sharp({
      create: {
        width: 160, height: 90, channels: 4,
        background: { r: 70, g: 90, b: 110, alpha: 1 },
      },
    }).png().toBuffer();
    const composite = colorPaintoverComposite(
      `data:image/png;base64,${compositeBytes.toString("base64")}`,
    );
    const baseImage = `data:image/png;base64,${baseBytes.toString("base64")}`;
    const paintoverStoryboard: Storyboard = {
      ...storyboard,
      metadata: {
        ...storyboard.metadata,
        compatFrameUpdatedAt: paintoverFrameUpdatedAt,
        aiPaintoverState: paintoverState,
      },
    };
    let providerSource: Buffer | null = null;
    const fetchImpl = vi.fn(async (_url: unknown, request?: RequestInit) => {
      const source = (request?.body as FormData).get("image[]");
      if (!(source instanceof Blob)) throw new Error("missing provider source");
      providerSource = Buffer.from(await source.arrayBuffer());
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ b64_json: outputBytes.toString("base64") }],
        }),
      };
    });
    const pool = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes("SELECT * FROM casting_storyboards WHERE id")) {
          return storyboardDatabaseResult(paintoverStoryboard);
        }
        if (sql.includes("FROM casting_scenes scene")) {
          return {
            rows: [{
              manuscript_id: compatManuscriptId,
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: paintoverFrameUpdatedAt,
                  sourceUpdatedAt: compatFrameUpdatedAt,
                  shotFraming: framing,
                  aiPaintoverState: paintoverState,
                }],
              }],
            }],
          };
        }
        if (sql.includes("SELECT * FROM storyboard_ai_image_versions")) {
          return {
            rows: [versionRow({
              id: approvedColorVersionId,
              stage: "color",
              status: "approved",
              image_data: baseImage,
              metadata: {
                framingFingerprint,
                sourceRevision: 0,
                compatManuscriptId,
                compatSceneId: storyboard.sceneId,
                compatFrameId: storyboard.frameId,
                compatFrameUpdatedAt: paintoverFrameUpdatedAt,
                compatSourceUpdatedAt: compatFrameUpdatedAt,
              },
            })],
          };
        }
        if (sql.includes("INSERT INTO storyboard_ai_image_versions")) {
          return {
            rows: [versionRow({
              id: "22222222-2222-4222-8222-222222222222",
              stage: "atmosphere",
              parent_version_id: approvedColorVersionId,
              source_fingerprint: String(params[5]),
              image_data: String(params[7]),
              width: Number(params[8]),
              height: Number(params[9]),
              metadata: JSON.parse(String(params[12])),
            })],
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    };

    const generated = await generateStoryboardAIImageStage(pool as any, {
      storyboard: paintoverStoryboard,
      projectId: storyboard.projectId,
      userId: "artist-1",
      stage: "atmosphere",
      body: { ...acknowledgedBody, paintoverComposite: composite },
      apiKey: "test-key",
      fetchImpl: fetchImpl as any,
    });

    expect(providerSource).not.toBeNull();
    expect(providerSource!.equals(compositeBytes)).toBe(true);
    expect(generated.version.stage).toBe("atmosphere");
    const insertCall = pool.query.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO storyboard_ai_image_versions"));
    const candidateMetadata = JSON.parse(String(insertCall?.[1]?.[12]));
    expect(candidateMetadata.aiRasterPlacementFraming)
      .toEqual(normalizedFraming);
    expect(candidateMetadata.paintoverComposite).toMatchObject({
      includedThroughStage: "color",
      baseVersionId: approvedColorVersionId,
      frameUpdatedAt: paintoverFrameUpdatedAt,
      colorRevision: paintoverState.colorRevision,
      sourceFingerprint: expect.stringMatching(/^[a-f0-9]{32}$/),
    });
  });

  it("rejects a Color paintover edit in the final no-cost checkpoint", async () => {
    const compositeBytes = await sharp({
      create: {
        width: 320, height: 180, channels: 4,
        background: { r: 32, g: 64, b: 96, alpha: 1 },
      },
    }).png().toBuffer();
    const baseBytes = await sharp({
      create: {
        width: 320, height: 180, channels: 4,
        background: { r: 200, g: 180, b: 160, alpha: 1 },
      },
    }).png().toBuffer();
    const composite = colorPaintoverComposite(
      `data:image/png;base64,${compositeBytes.toString("base64")}`,
    );
    const baseImage = `data:image/png;base64,${baseBytes.toString("base64")}`;
    const paintoverStoryboard: Storyboard = {
      ...storyboard,
      metadata: {
        ...storyboard.metadata,
        compatFrameUpdatedAt: paintoverFrameUpdatedAt,
        aiPaintoverState: paintoverState,
      },
    };
    let compatReads = 0;
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("SELECT * FROM casting_storyboards WHERE id")) {
          return storyboardDatabaseResult(paintoverStoryboard);
        }
        if (sql.includes("FROM casting_scenes scene")) {
          compatReads += 1;
          const edited = compatReads > 1;
          return {
            rows: [{
              manuscript_id: compatManuscriptId,
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: edited
                    ? "2026-08-28T20:00:02.000Z" : paintoverFrameUpdatedAt,
                  sourceUpdatedAt: compatFrameUpdatedAt,
                  shotFraming: framing,
                  aiPaintoverState: edited ? {
                    ...paintoverState,
                    colorRevision: paintoverState.colorRevision + 1,
                    colorFingerprint: "c".repeat(64),
                    atmosphereStale: true,
                  } : paintoverState,
                }],
              }],
            }],
          };
        }
        if (sql.includes("SELECT * FROM storyboard_ai_image_versions")) {
          return {
            rows: [versionRow({
              id: approvedColorVersionId,
              stage: "color",
              status: "approved",
              image_data: baseImage,
              metadata: {
                framingFingerprint,
                sourceRevision: 0,
                compatManuscriptId,
                compatSceneId: storyboard.sceneId,
                compatFrameId: storyboard.frameId,
                compatFrameUpdatedAt: paintoverFrameUpdatedAt,
                compatSourceUpdatedAt: compatFrameUpdatedAt,
              },
            })],
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const fetchImpl = vi.fn();

    await expect(generateStoryboardAIImageStage(pool as any, {
      storyboard: paintoverStoryboard,
      projectId: storyboard.projectId,
      userId: "artist-1",
      stage: "atmosphere",
      body: { ...acknowledgedBody, paintoverComposite: composite },
      apiKey: "unused",
      fetchImpl: fetchImpl as any,
    })).rejects.toMatchObject({
      status: 409,
      code: "paintover_composite_stale",
    });

    expect(compatReads).toBe(2);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(pool.query.mock.calls.some(([sql]) =>
      sql.includes("INSERT INTO storyboard_ai_image_versions"))).toBe(false);
  });

  it("regenerates Color from the immutable Pencil after approval without a source edit", async () => {
    const pencilBytes = await sharp({
      create: {
        width: 160,
        height: 90,
        channels: 4,
        background: { r: 245, g: 242, b: 235, alpha: 1 },
      },
    }).png().toBuffer();
    const outputBytes = await sharp({
      create: {
        width: 160,
        height: 90,
        channels: 4,
        background: { r: 100, g: 120, b: 140, alpha: 1 },
      },
    }).png().toBuffer();
    const pencilImage = `data:image/png;base64,${pencilBytes.toString("base64")}`;
    const approvedColorImage = `data:image/png;base64,${outputBytes.toString("base64")}`;
    const adoptedFrameUpdatedAt = "2026-08-28T20:00:01.000Z";
    const approvedStoryboard: Storyboard = {
      ...storyboard,
      imageData: approvedColorImage,
      workflowLevel: "ai-color-approved",
      metadata: {
        ...storyboard.metadata,
        compatFrameUpdatedAt: adoptedFrameUpdatedAt,
        compatSourceUpdatedAt: compatFrameUpdatedAt,
      },
    };
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: outputBytes.toString("base64") }] }),
    }));
    const pool = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes("SELECT * FROM casting_storyboards WHERE id")) {
          return storyboardDatabaseResult(approvedStoryboard);
        }
        if (sql.includes("FROM casting_scenes scene")) {
          return {
            rows: [{
              manuscript_id: compatManuscriptId,
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: adoptedFrameUpdatedAt,
                  sourceUpdatedAt: compatFrameUpdatedAt,
                  shotFraming: framing,
                }],
              }],
            }],
          };
        }
        if (sql.includes("SELECT * FROM storyboard_ai_image_versions")) {
          return {
            rows: [versionRow({
              id: "pencil-immutable",
              stage: "pencil",
              status: "source",
              parent_version_id: null,
              image_data: pencilImage,
              metadata: {
                framingFingerprint,
                sourceRevision: 0,
                compatManuscriptId,
                compatSceneId: storyboard.sceneId,
                compatFrameId: storyboard.frameId,
                compatFrameUpdatedAt,
                compatSourceUpdatedAt: compatFrameUpdatedAt,
              },
            })],
          };
        }
        if (sql.includes("INSERT INTO storyboard_ai_image_versions")) {
          return {
            rows: [versionRow({
              id: "color-regenerated",
              stage: "color",
              status: "generated",
              parent_version_id: "pencil-immutable",
              image_data: approvedColorImage,
              metadata: JSON.parse(String(params[12])),
            })],
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    };

    const regenerated = await generateStoryboardAIImageStage(pool as any, {
      storyboard: approvedStoryboard,
      projectId: storyboard.projectId,
      userId: "artist-1",
      stage: "color",
      body: acknowledgedBody,
      apiKey: "test-key",
      fetchImpl: fetchImpl as any,
    });

    expect(regenerated.version).toMatchObject({
      id: "color-regenerated",
      stage: "color",
      parentVersionId: "pencil-immutable",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("/v1/images/edits");
  });

  it("approves a fresh Color for the exact stale source and clears stale atomically", async () => {
    const queries: string[] = [];
    const queryParams: unknown[][] = [];
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        queries.push(sql);
        queryParams.push(params);
        if (sql.includes("SELECT * FROM storyboard_ai_image_versions")) {
          return { rows: [versionRow()], rowCount: 1 };
        }
        if (sql.includes("SELECT storyboard.metadata")) {
          return {
            rows: [{
              metadata: {
                ...storyboard.metadata,
                aiOutputStale: true,
                aiOutputStaleReason: "source-document-changed",
              },
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              manuscript_id: compatManuscriptId,
              width: storyboard.width,
              height: storyboard.height,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes("SELECT store_value FROM legacy_compat_store")) {
          return {
            rows: [{
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: compatFrameUpdatedAt,
                  sourceUpdatedAt: compatFrameUpdatedAt,
                  shotFraming: framing,
                  drawingData: { strokes: "[]" },
                  aiOutputStale: true,
                  aiOutputStaleReason: "source-document-changed",
                }],
              }],
            }],
            rowCount: 1,
          };
        }
        if (sql.includes("SET status='approved'")) {
          return {
            rows: [versionRow({
              status: "approved", approved_by: "artist-1", approved_at: new Date(),
            })],
            rowCount: 1,
          };
        }
        if (sql.includes("UPDATE casting_storyboards")) {
          return { rows: [{ id: storyboard.id }], rowCount: 1 };
        }
        if (sql.includes("UPDATE legacy_compat_store")) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
      connect: vi.fn(async () => client),
    };
    const approved = await approveStoryboardAIImageVersion(pool as any, {
      projectId: storyboard.projectId, storyboardId: storyboard.id,
      versionId: "version-color-1", userId: "artist-1",
      expectedFramingFingerprint: framingFingerprint,
    });

    expect(approved.status).toBe("approved");
    expect(approved.sourceRevision).toBe(0);
    expect(approved.currentSourceRevision).toBe(0);
    expect(approved.adoptedFrameUpdatedAt).toBeTruthy();
    expect(approved.sourceUpdatedAt).toBe(compatFrameUpdatedAt);
    expect(queries.some((sql) => sql.includes("stage='atmosphere'")
      && sql.includes("status='stale'"))).toBe(true);
    const storyboardLockIndex = queries.findIndex((sql) =>
      sql.includes("SELECT storyboard.metadata"));
    const advisoryLockIndex = queries.findIndex((sql) =>
      sql.includes("pg_advisory_xact_lock"));
    const versionLockIndex = queries.findIndex((sql) =>
      sql.includes("ORDER BY id FOR UPDATE"));
    expect(storyboardLockIndex).toBeGreaterThan(-1);
    expect(advisoryLockIndex).toBeGreaterThan(storyboardLockIndex);
    expect(versionLockIndex).toBeGreaterThan(advisoryLockIndex);
    const approvalUpdateIndex = queries.findIndex((sql) =>
      sql.includes("UPDATE storyboard_ai_image_versions")
      && sql.includes("SET status='approved'"));
    expect(approvalUpdateIndex).toBeGreaterThan(-1);
    expect(queries[approvalUpdateIndex])
      .toContain("'aiRasterPlacementFraming',$6::jsonb");
    expect(queries[approvalUpdateIndex])
      .toContain("'aiSourceRevision',$4::bigint");
    expect(JSON.parse(String(queryParams[approvalUpdateIndex]?.[5])))
      .toEqual(normalizedFraming);
    const storyboardUpdateIndex = queries.findIndex((sql) =>
      sql.includes("UPDATE casting_storyboards"));
    expect(queryParams[storyboardUpdateIndex]?.slice(0, 2)).toEqual([
      storyboard.imageData,
      "ai-color-approved",
    ]);
    expect(queryParams[storyboardUpdateIndex]?.[4]).toBe(0);
    expect(queryParams[storyboardUpdateIndex]?.[5])
      .toBe(approved.adoptedFrameUpdatedAt);
    expect(queries[storyboardUpdateIndex]).toContain("'sourceRevision',$5::bigint");
    expect(queries[storyboardUpdateIndex])
      .toContain("'aiRasterPlacementFraming',$11::jsonb");
    expect(queries[storyboardUpdateIndex])
      .toContain("'aiSourceRevision',$5::bigint");
    expect(JSON.parse(String(queryParams[storyboardUpdateIndex]?.[10])))
      .toEqual(normalizedFraming);
    expect(queries[storyboardUpdateIndex]).not.toMatch(/\bwidth\s*=|\bheight\s*=/);
    const aiPipeline = JSON.parse(
      String(queryParams[storyboardUpdateIndex]?.[2]),
    );
    expect(aiPipeline).toMatchObject({
      rasterPlacementFraming: normalizedFraming,
      sourceCanvasWidth: 1920,
      sourceCanvasHeight: 1080,
      outputWidth: 1536,
      outputHeight: 864,
      outputAspectRatio: 16 / 9,
    });
    const compatUpdateIndex = queries.findIndex((sql) =>
      sql.includes("UPDATE legacy_compat_store")
      && sql.includes("store_value=$2::jsonb"));
    expect(compatUpdateIndex).toBeGreaterThan(-1);
    const adoptedScenes = JSON.parse(String(queryParams[compatUpdateIndex]?.[1]));
    expect(adoptedScenes[0].storyboardFrames[0]).toMatchObject({
      imageUrl: storyboard.imageData,
      thumbnailUrl: storyboard.imageData,
      imageSource: "ai-color-approved",
      aiRasterPlacementFraming: normalizedFraming,
      aiSourceRevision: 0,
      aiOutputStale: false,
      aiPaintoverState: {
        atmosphereStale: true,
        videoStale: true,
      },
      sourceUpdatedAt: compatFrameUpdatedAt,
    });
    expect(queries.at(-1)).toContain("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rejects Atmosphere approval after its Color paintover binding changed", async () => {
    const editedPaintoverState = {
      ...paintoverState,
      colorRevision: paintoverState.colorRevision + 1,
      colorFingerprint: "c".repeat(64),
      atmosphereStale: true,
    };
    const editedFrameUpdatedAt = "2026-08-28T20:00:02.000Z";
    const candidateId = "22222222-2222-4222-8222-222222222222";
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes("SELECT storyboard.metadata")) {
          return {
            rows: [{
              metadata: {
                ...storyboard.metadata,
                compatFrameUpdatedAt: editedFrameUpdatedAt,
                aiPaintoverState: editedPaintoverState,
              },
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              manuscript_id: compatManuscriptId,
              width: storyboard.width,
              height: storyboard.height,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes("SELECT * FROM storyboard_ai_image_versions")) {
          return {
            rows: [
              versionRow({
                id: candidateId,
                stage: "atmosphere",
                parent_version_id: approvedColorVersionId,
                metadata: {
                  framingFingerprint,
                  sourceRevision: 0,
                  compatManuscriptId,
                  compatSceneId: storyboard.sceneId,
                  compatFrameId: storyboard.frameId,
                  compatFrameUpdatedAt: paintoverFrameUpdatedAt,
                  compatSourceUpdatedAt: compatFrameUpdatedAt,
                  paintoverComposite: {
                    includedThroughStage: "color",
                    baseVersionId: approvedColorVersionId,
                    frameUpdatedAt: paintoverFrameUpdatedAt,
                    sourceUpdatedAt: compatFrameUpdatedAt,
                    sourceRevision: 0,
                    framingFingerprint,
                    colorRevision: paintoverState.colorRevision,
                    atmosphereRevision: paintoverState.atmosphereRevision,
                    colorFingerprint,
                    atmosphereFingerprint,
                    sourceFingerprint: "d".repeat(32),
                    width: 320,
                    height: 180,
                  },
                },
              }),
              versionRow({
                id: approvedColorVersionId,
                stage: "color",
                status: "approved",
              }),
            ],
            rowCount: 2,
          };
        }
        if (sql.includes("SELECT store_value FROM legacy_compat_store")) {
          return {
            rows: [{
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: editedFrameUpdatedAt,
                  sourceUpdatedAt: compatFrameUpdatedAt,
                  shotFraming: framing,
                  aiPaintoverState: editedPaintoverState,
                }],
              }],
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
      connect: vi.fn(async () => client),
    };

    await expect(approveStoryboardAIImageVersion(pool as any, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      versionId: candidateId,
      userId: "artist-1",
      expectedFramingFingerprint: framingFingerprint,
    })).rejects.toMatchObject({
      status: 409,
      code: "candidate_paintover_stale",
    });

    expect(queries.some((sql) => sql.includes("SET status='approved'"))).toBe(false);
    expect(queries.some((sql) => sql.includes("UPDATE casting_storyboards"))).toBe(false);
    expect(queries.at(-1)).toContain("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rejects Atmosphere approval when its Color parent was superseded", async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes("SELECT storyboard.metadata")) {
          return {
            rows: [{
              metadata: storyboard.metadata,
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              manuscript_id: compatManuscriptId,
              width: storyboard.width,
              height: storyboard.height,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes("SELECT * FROM storyboard_ai_image_versions")) {
          return {
            rows: [
              versionRow({
                id: "atmosphere-c1",
                stage: "atmosphere",
                parent_version_id: "color-c1",
              }),
              versionRow({
                id: "color-c1",
                stage: "color",
                status: "generated",
              }),
              versionRow({
                id: "color-c2",
                stage: "color",
                status: "approved",
              }),
            ],
            rowCount: 3,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
      connect: vi.fn(async () => client),
    };

    await expect(approveStoryboardAIImageVersion(pool as any, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      versionId: "atmosphere-c1",
      userId: "artist-1",
      expectedFramingFingerprint: framingFingerprint,
    })).rejects.toMatchObject({
      status: 409,
      code: "atmosphere_parent_superseded",
    });
    expect(queries.some((sql) => sql.includes("SET status='approved'"))).toBe(false);
    expect(queries.at(-1)).toContain("ROLLBACK");
  });

  it("rolls back approval when the compat source changed after generation", async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes("SELECT * FROM storyboard_ai_image_versions")) {
          return { rows: [versionRow()], rowCount: 1 };
        }
        if (sql.includes("SELECT storyboard.metadata")) {
          return {
            rows: [{
              metadata: storyboard.metadata,
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              manuscript_id: compatManuscriptId,
              width: storyboard.width,
              height: storyboard.height,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes("SELECT store_value FROM legacy_compat_store")) {
          return {
            rows: [{
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: "2026-08-28T20:00:01.000Z",
                  sourceUpdatedAt: "2026-08-28T20:00:01.000Z",
                  shotFraming: framing,
                  drawingData: { strokes: "[]" },
                  aiOutputStale: true,
                }],
              }],
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
      connect: vi.fn(async () => client),
    };

    await expect(approveStoryboardAIImageVersion(pool as any, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      versionId: "version-color-1",
      userId: "artist-1",
      expectedFramingFingerprint: framingFingerprint,
    })).rejects.toMatchObject({
      status: 409,
      code: "candidate_compat_source_stale",
    });

    expect(queries.some((sql) => sql.includes("SET status='approved'"))).toBe(false);
    expect(queries.some((sql) => sql.includes("UPDATE casting_storyboards"))).toBe(false);
    expect(queries.at(-1)).toContain("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("preserves a non-16:9 source canvas while adopting Atmosphere output", async () => {
    const queries: string[] = [];
    const queryParams: unknown[][] = [];
    const sourceWidth = 2048;
    const sourceHeight = 1024;
    const outputWidth = 1536;
    const outputHeight = 640;
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        queries.push(sql);
        queryParams.push(params);
        if (sql.includes("SELECT * FROM storyboard_ai_image_versions")) {
          return {
            rows: [
              versionRow({
                id: "version-atmosphere-1",
                stage: "atmosphere",
                parent_version_id: "version-color-approved",
                width: outputWidth,
                height: outputHeight,
              }),
              versionRow({
                id: "version-color-approved",
                stage: "color",
                status: "approved",
              }),
            ],
            rowCount: 2,
          };
        }
        if (sql.includes("SELECT storyboard.metadata")) {
          return {
            rows: [{
              metadata: storyboard.metadata,
              scene_id: storyboard.sceneId,
              frame_id: storyboard.frameId,
              manuscript_id: compatManuscriptId,
              width: sourceWidth,
              height: sourceHeight,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes("SELECT store_value FROM legacy_compat_store")) {
          return {
            rows: [{
              store_value: [{
                id: storyboard.sceneId,
                storyboardFrames: [{
                  id: storyboard.frameId,
                  updatedAt: compatFrameUpdatedAt,
                  shotFraming: framing,
                }],
              }],
            }],
            rowCount: 1,
          };
        }
        if (sql.includes("SET status='approved'")) {
          return {
            rows: [versionRow({
              id: "version-atmosphere-1",
              stage: "atmosphere",
              status: "approved",
              width: outputWidth,
              height: outputHeight,
            })],
            rowCount: 1,
          };
        }
        return { rows: [{ id: storyboard.id }], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async () => ({ rows: [] })),
      connect: vi.fn(async () => client),
    };

    await approveStoryboardAIImageVersion(pool as any, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      versionId: "version-atmosphere-1",
      userId: "artist-1",
      expectedFramingFingerprint: framingFingerprint,
    });

    const storyboardUpdateIndex = queries.findIndex((sql) =>
      sql.includes("UPDATE casting_storyboards"));
    expect(queries[storyboardUpdateIndex]).not.toMatch(/\bwidth\s*=|\bheight\s*=/);
    const pipeline = JSON.parse(String(queryParams[storyboardUpdateIndex]?.[2]));
    expect(pipeline).toMatchObject({
      sourceCanvasWidth: sourceWidth,
      sourceCanvasHeight: sourceHeight,
      outputWidth,
      outputHeight,
      outputAspectRatio: outputWidth / outputHeight,
    });
    const adoptedPaintoverState = JSON.parse(
      String(queryParams[storyboardUpdateIndex]?.[9]),
    );
    expect(adoptedPaintoverState.atmosphereStale).toBe(false);
    expect(adoptedPaintoverState.videoStale).toBe(true);
  });

  it("durably replays or suppresses duplicate paid image operations", async () => {
    const baseRow = {
      id: "operation-1",
      operation_fingerprint: "request-fingerprint",
      reservation_id: "reservation-1",
    };
    const inFlightPool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO storyboard_ai_image_operations")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("SELECT id,status,operation_fingerprint")) {
          return { rows: [{ ...baseRow, status: "processing", response: null }], rowCount: 1 };
        }
        if (sql.includes("SET status='claimed'")) return { rows: [], rowCount: 0 };
        return { rows: [], rowCount: 0 };
      }),
    };
    await expect(claimStoryboardAIImageOperation(inFlightPool as any, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      stage: "color",
      idempotencyKey: "native-action-1",
      operationFingerprint: "request-fingerprint",
    })).resolves.toEqual({
      state: "in_flight",
      operationId: "operation-1",
    });
    const processingRecoverySql = inFlightPool.query.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => sql.includes("status='processing'"));
    expect(processingRecoverySql).toContain('SELECT 1 AS stale');
    expect(inFlightPool.query.mock.calls
      .map(([sql]) => String(sql))
      .some((sql) => sql.includes("status IN ('claimed','processing')")))
      .toBe(false);

    const staleProcessingPool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO storyboard_ai_image_operations")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("SELECT id,status,operation_fingerprint")) {
          return { rows: [{ ...baseRow, status: "processing", response: null }], rowCount: 1 };
        }
        if (sql.includes("SELECT 1 AS stale")) {
          return { rows: [{ stale: 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    await expect(claimStoryboardAIImageOperation(staleProcessingPool as any, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      stage: "color",
      idempotencyKey: "native-action-1",
      operationFingerprint: "request-fingerprint",
    })).rejects.toMatchObject({ status: 409, code: "generation_result_unknown" });
    expect(staleProcessingPool.query.mock.calls
      .map(([sql]) => String(sql))
      .some((sql) => sql.includes("SET status='claimed'")))
      .toBe(false);

    const completedResponse = { success: true, data: { id: "version-1" } };
    const completedPool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO storyboard_ai_image_operations")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("SELECT id,status,operation_fingerprint")) {
          return {
            rows: [{
              ...baseRow,
              status: "completed",
              response: completedResponse,
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    await expect(claimStoryboardAIImageOperation(completedPool as any, {
      projectId: storyboard.projectId,
      storyboardId: storyboard.id,
      stage: "color",
      idempotencyKey: "native-action-1",
      operationFingerprint: "request-fingerprint",
    })).resolves.toEqual({
      state: "completed",
      operationId: "operation-1",
      reservationId: "reservation-1",
      response: completedResponse,
    });
  });
});
