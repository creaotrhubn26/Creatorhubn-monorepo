import { describe, expect, it } from "vitest";

import {
  enforceFramePatchAIStaleAuthority,
  importedRasterMirror,
  nativeFrameSourceChangeReason,
  nativeFrameSourceChanged,
  preserveAbsentShotFraming,
} from "./storyboard-frame-compat.js";

const persistedFraming = {
  version: 1,
  centerX: 0.42,
  centerY: 0.38,
  zoom: 2.4,
  rollDegrees: 8,
  aspectRatio: 2.39,
  mode: "manual",
  revision: 3,
};

describe("legacy full-scene storyboard compatibility", () => {
  it("preserves native shotFraming when an old scene payload omits it", () => {
    const incoming = { id: "frame-1", drawingData: { strokes: "[]" } };

    expect(
      preserveAbsentShotFraming(
        { id: "frame-1", shotFraming: persistedFraming },
        incoming,
      ),
    ).toEqual({ ...incoming, shotFraming: persistedFraming });
    expect(incoming).not.toHaveProperty("shotFraming");
  });

  it("keeps an explicitly supplied replacement framing authoritative", () => {
    const replacement = { ...persistedFraming, zoom: 1.5, revision: 4 };
    const incoming = { id: "frame-1", shotFraming: replacement };

    expect(
      preserveAbsentShotFraming(
        { id: "frame-1", shotFraming: persistedFraming },
        incoming,
      ),
    ).toEqual(incoming);
  });

  it("does not invent framing for legacy frames that never had it", () => {
    const incoming = { id: "frame-1", shotType: "WS" };
    expect(preserveAbsentShotFraming({ id: "frame-1" }, incoming)).toEqual(
      incoming,
    );
  });

  it("keeps server-owned AI sidecars when a stale web snapshot echoes old values", () => {
    const incoming = {
      id: "frame-1",
      aiOutputStale: false,
      aiStoryboardId: "old-storyboard",
      aiRasterPlacementFraming: { ...persistedFraming, zoom: 9 },
      aiSourceRevision: 1,
      aiVideoSourceBindingFingerprint: "forged-binding",
      aiVideoSourceMotionRevision: 99,
      aiVideoSourceMotionFingerprint: "forged-motion",
      aiVideoSourceMotionStatus: "valid",
      aiVideoSourceMotionBaseFramingFingerprint: "forged-framing",
      aiVideoSourceShotDuration: { value: 99, timescale: 1 },
      aiVideoSourceDurationRevision: 99,
      drawingData: { strokes: "[]" },
    };
    expect(
      preserveAbsentShotFraming(
        {
          id: "frame-1",
          aiOutputStale: true,
          aiOutputStaleReason: "framing-changed",
          aiStoryboardId: "storyboard-current",
          aiRasterPlacementFraming: persistedFraming,
          aiSourceRevision: 7,
          aiColorFramingFingerprint: "framing-v1|current",
          aiVideoSourceBindingFingerprint: "binding-current",
          aiVideoSourceMotionRevision: 3,
          aiVideoSourceMotionFingerprint: "motion-current",
          aiVideoSourceMotionStatus: "valid",
          aiVideoSourceMotionBaseFramingFingerprint:
            "framing-v1|current",
          aiVideoSourceShotDuration: { value: 2, timescale: 1 },
          aiVideoSourceDurationRevision: 4,
          drawingData: { strokes: "[]" },
        },
        incoming,
      ),
    ).toMatchObject({
      aiOutputStale: true,
      aiOutputStaleReason: "framing-changed",
      aiStoryboardId: "storyboard-current",
      aiRasterPlacementFraming: persistedFraming,
      aiSourceRevision: 7,
      aiColorFramingFingerprint: "framing-v1|current",
      aiVideoSourceBindingFingerprint: "binding-current",
      aiVideoSourceMotionRevision: 3,
      aiVideoSourceMotionFingerprint: "motion-current",
      aiVideoSourceMotionStatus: "valid",
      aiVideoSourceMotionBaseFramingFingerprint:
        "framing-v1|current",
      aiVideoSourceShotDuration: { value: 2, timescale: 1 },
      aiVideoSourceDurationRevision: 4,
    });
  });

  it("strips injected server sidecars when the stored frame has none", () => {
    const injected = {
      aiVideoURL: "https://attacker.example/forged.mp4",
      aiVideoJobId: "forged-job",
      aiVideoStatus: "completed",
      aiVideoSourceBindingFingerprint: "forged-binding",
      aiVideoSourceMotionRevision: 99,
      aiVideoSourceMotionFingerprint: "forged-motion",
      aiVideoSourceMotionStatus: "valid",
      aiVideoSourceMotionBaseFramingFingerprint: "forged-framing",
      aiVideoSourceShotDuration: { value: 99, timescale: 1 },
      aiVideoSourceDurationRevision: 99,
      aiPaintoverState: { version: 1, videoStale: false },
      sourceUpdatedAt: "forged-source-token",
    };
    const result = preserveAbsentShotFraming(
      { id: "frame-1", drawingData: { strokes: "[]" } },
      { id: "frame-1", drawingData: { strokes: "[]" }, ...injected },
    );

    expect(result).toEqual({
      id: "frame-1",
      drawingData: { strokes: "[]" },
    });
    for (const key of Object.keys(injected)) expect(result).not.toHaveProperty(key);
  });

  it("re-arms the AI stale gate when a legacy scene POST changes source strokes", () => {
    expect(
      preserveAbsentShotFraming(
        {
          id: "frame-1",
          aiOutputStale: false,
          aiStoryboardId: "storyboard-current",
          drawingData: { strokes: '[{"id":"before"}]' },
        },
        {
          id: "frame-1",
          drawingData: { strokes: '[{"id":"after"}]' },
        },
      ),
    ).toMatchObject({
      aiOutputStale: true,
      aiOutputStaleReason: "source-document-changed",
      aiStoryboardId: "storyboard-current",
    });
  });

  it("classifies camera-only source changes separately from changed pixels", () => {
    const existing = {
      id: "frame-1",
      shotFraming: persistedFraming,
      imageUrl: "data:image/png;base64,approved",
      drawingData: { strokes: '[{"id":"before"}]' },
    };
    expect(
      nativeFrameSourceChangeReason(existing, {
        ...existing,
        shotFraming: { ...persistedFraming, zoom: 3, revision: 4 },
      }),
    ).toBe("shot-framing-changed");
    expect(
      nativeFrameSourceChangeReason(existing, {
        ...existing,
        shotFraming: { ...persistedFraming, zoom: 3, revision: 4 },
        drawingData: { strokes: '[{"id":"after"}]' },
      }),
    ).toBe("source-document-changed");
    expect(nativeFrameSourceChangeReason(existing, existing)).toBeNull();
  });

  it("marks a framing-only legacy scene replacement with a coverage-safe reason", () => {
    expect(
      preserveAbsentShotFraming(
        {
          id: "frame-1",
          aiStoryboardId: "storyboard-current",
          shotFraming: persistedFraming,
          drawingData: { strokes: "[]" },
        },
        {
          id: "frame-1",
          shotFraming: { ...persistedFraming, zoom: 3, revision: 4 },
          drawingData: { strokes: "[]" },
        },
      ),
    ).toMatchObject({
      aiOutputStale: true,
      aiOutputStaleReason: "shot-framing-changed",
    });
  });

  it("revisions a legacy Color paintover without staling Pencil source", () => {
    const drawing = { id: "drawing", boardLayer: "Drawing" };
    const color = { id: "color", boardLayer: "Color" };
    const result = preserveAbsentShotFraming(
      {
        id: "frame-1",
        updatedAt: "2026-08-29T09:00:00.000Z",
        sourceUpdatedAt: "2026-08-29T08:00:00.000Z",
        aiOutputStale: false,
        aiPaintoverState: {
          version: 1,
          colorRevision: 4,
          atmosphereRevision: 7,
          atmosphereStale: false,
          videoStale: false,
          colorFingerprint: "before-color",
          atmosphereFingerprint: "before-atmosphere",
        },
        drawingData: { strokes: JSON.stringify([drawing]) },
      },
      {
        id: "frame-1",
        drawingData: { strokes: JSON.stringify([drawing, color]) },
      },
    ) as Record<string, any>;

    expect(result).toMatchObject({
      aiOutputStale: false,
      sourceUpdatedAt: "2026-08-29T08:00:00.000Z",
      aiPaintoverState: {
        version: 1,
        colorRevision: 5,
        atmosphereRevision: 7,
        atmosphereStale: true,
        videoStale: true,
      },
    });
    expect(result.aiPaintoverState.colorFingerprint).not.toBe("before-color");
  });

  it("treats only Drawing visual composition as Pencil source truth", () => {
    const persistedLayers = {
      version: 2,
      order: ["Drawing", "Color", "Notes"],
      hidden: ["Notes", "Color"],
      locked: [],
      opacity: { Drawing: 1, Color: 0.6 },
      blendModes: { Drawing: "normal", Color: "multiply" },
      activeLayer: "Drawing",
    };
    expect(
      nativeFrameSourceChanged(
        {
          drawingData: { layerState: persistedLayers },
        },
        {
          drawingData: {
            layerState: {
              ...persistedLayers,
              version: 3,
              hidden: ["Color", "Notes"],
              locked: ["Color"],
              activeLayer: "Color",
              opacity: { Color: 0.6 },
              blendModes: { Color: "multiply" },
            },
          },
        },
      ),
    ).toBe(false);

    expect(
      nativeFrameSourceChanged(
        {
          drawingData: { layerState: persistedLayers },
        },
        {
          drawingData: {
            layerState: {
              ...persistedLayers,
              hidden: ["Notes"],
            },
          },
        },
      ),
    ).toBe(false);

    expect(
      nativeFrameSourceChanged(
        {
          drawingData: { layerState: persistedLayers },
        },
        {
          drawingData: {
            layerState: {
              ...persistedLayers,
              hidden: ["Drawing", "Notes", "Color"],
            },
          },
        },
      ),
    ).toBe(true);
  });

  it("preserves an adopted raster when a legacy scene snapshot omits it", () => {
    expect(
      preserveAbsentShotFraming(
        {
          id: "frame-1",
          imageUrl: "data:image/png;base64,approved",
          thumbnailUrl: "data:image/png;base64,thumb",
          imageSource: "ai-color-approved",
          aiRasterPlacementFraming: persistedFraming,
          aiSourceRevision: 7,
          aiStoryboardId: "storyboard-current",
          sourceUpdatedAt: "2026-08-29T10:00:00.000Z",
          drawingData: { strokes: "[]" },
        },
        {
          id: "frame-1",
          drawingData: { strokes: "[]" },
        },
      ),
    ).toMatchObject({
      imageUrl: "data:image/png;base64,approved",
      thumbnailUrl: "data:image/png;base64,thumb",
      imageSource: "ai-color-approved",
      aiRasterPlacementFraming: persistedFraming,
      aiSourceRevision: 7,
      sourceUpdatedAt: "2026-08-29T10:00:00.000Z",
    });
  });
});

describe("frame AI stale authority", () => {
  it("mirrors imported Pencil rasters but never adopted AI output", () => {
    expect(
      importedRasterMirror(
        {
          imageUrl: "data:image/png;base64,cGVuY2ls",
          imageSource: "imported",
        },
        true,
      ),
    ).toEqual({
      shouldMirror: true,
      imageData: "data:image/png;base64,cGVuY2ls",
    });
    expect(
      importedRasterMirror(
        {
          imageUrl: "data:image/png;base64,Y29sb3I=",
          imageSource: "ai-color-approved",
        },
        true,
      ),
    ).toEqual({
      shouldMirror: false,
      imageData: "data:image/png;base64,Y29sb3I=",
    });
  });

  it("ignores generic stale=false and its clearing reason", () => {
    expect(
      enforceFramePatchAIStaleAuthority(
        {
          imageUrl: "approved-image",
          aiOutputStale: false,
          aiOutputStaleReason: "",
        },
        false,
      ),
    ).toEqual({ imageUrl: "approved-image" });
  });

  it("strips generic frame-patch attempts at AI, motion and timing authority", () => {
    const result = enforceFramePatchAIStaleAuthority({
      clientNote: "allowed",
      aiOutputStale: true,
      aiOutputStaleReason: "manual-invalidation",
      aiVideoURL: "https://attacker.example/forged.mp4",
      aiVideoJobId: "forged-job",
      aiPaintoverState: { videoStale: false },
      cameraMotionTrack: { version: 2 },
      cameraMotionRevision: 99,
      shotDuration: { value: 99, timescale: 1 },
      durationRevision: 99,
    }, false);

    expect(result).toEqual({
      clientNote: "allowed",
      aiOutputStale: true,
      aiOutputStaleReason: "manual-invalidation",
    });
    expect(result).not.toHaveProperty("aiVideoURL");
    expect(result).not.toHaveProperty("aiVideoJobId");
    expect(result).not.toHaveProperty("aiPaintoverState");
    expect(result).not.toHaveProperty("cameraMotionTrack");
    expect(result).not.toHaveProperty("cameraMotionRevision");
    expect(result).not.toHaveProperty("shotDuration");
    expect(result).not.toHaveProperty("durationRevision");
  });

  it("accepts explicit stale=true and forces source edits stale", () => {
    expect(
      enforceFramePatchAIStaleAuthority(
        {
          aiOutputStale: true,
          aiOutputStaleReason: "framing-changed-during-approval",
        },
        false,
      ),
    ).toMatchObject({
      aiOutputStale: true,
      aiOutputStaleReason: "framing-changed-during-approval",
    });
    expect(
      enforceFramePatchAIStaleAuthority(
        {
          aiOutputStale: false,
          aiOutputStaleReason: "",
          drawingData: { strokes: "[]" },
        },
        true,
      ),
    ).toMatchObject({
      aiOutputStale: true,
      aiOutputStaleReason: "source-document-changed",
    });
  });
});
