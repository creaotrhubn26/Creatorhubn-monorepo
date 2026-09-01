import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  validateStoryboardPaintoverCompositeBinding,
  validateStoryboardPaintoverCompositeImage,
  type StoryboardPaintoverComposite,
} from "./storyboard-paintover-composite.js";

const colorFingerprint = "a".repeat(64);
const atmosphereFingerprint = "b".repeat(64);

function composite(imageData = "data:image/png;base64,placeholder"):
StoryboardPaintoverComposite {
  return {
    imageData,
    width: 320,
    height: 180,
    includedThroughStage: "atmosphere",
    baseVersionId: "11111111-1111-4111-8111-111111111111",
    frameUpdatedAt: "frame-2",
    sourceUpdatedAt: "source-1",
    sourceRevision: 7,
    framingFingerprint: "framing-v1|current",
    colorRevision: 3,
    atmosphereRevision: 5,
    colorFingerprint,
    atmosphereFingerprint,
  };
}

describe("storyboard paintover composite", () => {
  it("accepts an exact live + mirrored paintover binding", () => {
    const state = {
      colorRevision: 3,
      atmosphereRevision: 5,
      colorFingerprint,
      atmosphereFingerprint,
      colorHasContent: true,
      atmosphereHasContent: true,
    };
    expect(validateStoryboardPaintoverCompositeBinding({
      composite: composite(),
      expectedIncludedThroughStage: "atmosphere",
      expectedBaseVersionId: "11111111-1111-4111-8111-111111111111",
      liveFrameUpdatedAt: "frame-2",
      liveSourceUpdatedAt: "source-1",
      liveSourceRevision: 7,
      liveFramingFingerprint: "framing-v1|current",
      livePaintoverState: state,
      mirroredPaintoverState: state,
    })).toEqual(state);
  });

  it("ignores Atmosphere identity for a Color composite", () => {
    const live = {
      colorRevision: 3,
      atmosphereRevision: 8,
      colorFingerprint,
      atmosphereFingerprint: "c".repeat(64),
      colorHasContent: true,
      atmosphereHasContent: true,
    };
    const mirrored = {
      ...live,
      atmosphereRevision: 9,
      atmosphereFingerprint: "d".repeat(64),
      atmosphereHasContent: false,
    };
    expect(validateStoryboardPaintoverCompositeBinding({
      composite: {
        ...composite(),
        includedThroughStage: "color",
      },
      expectedIncludedThroughStage: "color",
      expectedBaseVersionId: "11111111-1111-4111-8111-111111111111",
      liveFrameUpdatedAt: "frame-after-atmosphere-edit",
      liveSourceUpdatedAt: "source-1",
      liveSourceRevision: 7,
      liveFramingFingerprint: "framing-v1|current",
      livePaintoverState: live,
      mirroredPaintoverState: mirrored,
    })).toEqual({
      colorRevision: 3,
      atmosphereRevision: 0,
      colorFingerprint,
      atmosphereFingerprint: "0".repeat(64),
      colorHasContent: true,
      atmosphereHasContent: false,
    });
  });

  it.each([
    ["general OCC", { frameUpdatedAt: "frame-stale" }],
    ["source revision", { sourceRevision: 6 }],
    ["Color overlay", { colorRevision: 2 }],
    ["Atmosphere fingerprint", { atmosphereFingerprint: "c".repeat(64) }],
  ])("fails closed for stale %s", (_label, patch) => {
    const state = {
      colorRevision: 3,
      atmosphereRevision: 5,
      colorFingerprint,
      atmosphereFingerprint,
      colorHasContent: true,
      atmosphereHasContent: true,
    };
    expect(() => validateStoryboardPaintoverCompositeBinding({
      composite: { ...composite(), ...patch },
      expectedIncludedThroughStage: "atmosphere",
      expectedBaseVersionId: "11111111-1111-4111-8111-111111111111",
      liveFrameUpdatedAt: "frame-2",
      liveSourceUpdatedAt: "source-1",
      liveSourceRevision: 7,
      liveFramingFingerprint: "framing-v1|current",
      livePaintoverState: state,
      mirroredPaintoverState: state,
    })).toThrowError(expect.objectContaining({ code: "paintover_composite_stale" }));
  });

  it("verifies PNG bytes, declared dimensions and camera aspect", async () => {
    const png = await sharp({
      create: {
        width: 320,
        height: 180,
        channels: 4,
        background: { r: 10, g: 20, b: 30, alpha: 1 },
      },
    }).png().toBuffer();
    const dataURL = `data:image/png;base64,${png.toString("base64")}`;
    const validated = await validateStoryboardPaintoverCompositeImage(
      composite(dataURL), 16 / 9,
    );
    expect(validated).toMatchObject({ width: 320, height: 180 });
    await expect(validateStoryboardPaintoverCompositeImage(
      { ...composite(dataURL), width: 321 }, 16 / 9,
    )).rejects.toMatchObject({ code: "paintover_composite_dimension_mismatch" });
    await expect(validateStoryboardPaintoverCompositeImage(
      composite(dataURL), 1,
    )).rejects.toMatchObject({ code: "paintover_composite_aspect_mismatch" });
  });

  it.each([
    ["JPEG", "data:image/jpeg;base64,"],
    ["SVG", "data:image/svg+xml;base64,"],
  ])("rejects a %s data URL before decoding", async (_label, prefix) => {
    const disguisedBytes = Buffer.alloc(128, 0x41).toString("base64");
    await expect(validateStoryboardPaintoverCompositeImage(
      composite(`${prefix}${disguisedBytes}`), 16 / 9,
    )).rejects.toMatchObject({
      status: 400,
      code: "paintover_composite_invalid_type",
    });
  });

  it("rejects non-image bytes disguised as a PNG data URL", async () => {
    const fakePNG = Buffer.alloc(128, 0x41).toString("base64");
    await expect(validateStoryboardPaintoverCompositeImage(
      composite(`data:image/png;base64,${fakePNG}`), 16 / 9,
    )).rejects.toMatchObject({
      status: 400,
      code: "paintover_composite_invalid_image",
    });
  });
});
