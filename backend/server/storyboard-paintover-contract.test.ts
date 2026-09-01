import { describe, expect, it } from "vitest";
import {
  nextStoryboardPaintoverRevisionState,
  storyboardPaintoverChanges,
  storyboardPaintoverFingerprint,
  storyboardPencilOverlayProjection,
} from "./storyboard-paintover-contract.js";

function stroke(id: string, boardLayer?: string) {
  return { id, ...(boardLayer ? { boardLayer } : {}), points: [{ x: 1, y: 2 }] };
}

function frame(
  strokes: unknown[],
  layerState: Record<string, unknown> = {},
) {
  return { drawingData: { strokes: JSON.stringify(strokes), layerState } };
}

describe("storyboard paintover contract", () => {
  it("keeps Color and Atmosphere edits out of Pencil source identity", () => {
    const before = frame([stroke("drawing")]);
    const after = frame([
      stroke("drawing"),
      stroke("color", "Color"),
      stroke("air", "Atmosphere"),
    ]);

    expect(storyboardPencilOverlayProjection(after))
      .toEqual(storyboardPencilOverlayProjection(before));
    expect(storyboardPaintoverChanges(before, after)).toEqual({
      colorChanged: true,
      atmosphereChanged: true,
    });
  });

  it("normalizes omitted layer state to native standard render order", () => {
    const strokes = [
      stroke("drawing"),
      stroke("color", "Color"),
      stroke("air", "Atmosphere"),
    ];
    const legacy = frame(strokes);
    const materialized = frame(strokes, {
      order: [
        "Drawing", "Color", "Atmosphere", "Camera / Arrows", "Dialog", "Notes",
      ],
      hidden: [], opacity: {}, blendModes: {},
    });

    expect(storyboardPaintoverChanges(legacy, materialized)).toEqual({
      colorChanged: false,
      atmosphereChanged: false,
    });
    expect(storyboardPaintoverFingerprint(legacy, "color"))
      .toBe(storyboardPaintoverFingerprint(materialized, "color"));
  });

  it("treats missing boardLayer as Drawing for legacy documents", () => {
    const before = frame([stroke("legacy")]);
    const after = frame([{ ...stroke("legacy"), points: [{ x: 4, y: 5 }] }]);

    expect(storyboardPencilOverlayProjection(after))
      .not.toEqual(storyboardPencilOverlayProjection(before));
    expect(storyboardPaintoverChanges(before, after)).toEqual({
      colorChanged: false,
      atmosphereChanged: false,
    });
  });

  it("advances only the edited stage and invalidates only downstream output", () => {
    expect(nextStoryboardPaintoverRevisionState(
      { colorRevision: 4, atmosphereRevision: 7 },
      { colorChanged: true, atmosphereChanged: false },
    )).toEqual({
      colorRevision: 5,
      atmosphereRevision: 7,
      atmosphereStale: true,
      videoStale: true,
    });
    expect(nextStoryboardPaintoverRevisionState(
      { colorRevision: 4, atmosphereRevision: 7 },
      { colorChanged: false, atmosphereChanged: true },
    )).toEqual({
      colorRevision: 4,
      atmosphereRevision: 8,
      atmosphereStale: false,
      videoStale: true,
    });
  });

  it("binds fingerprints to only their stage strokes and visual state", () => {
    const base = frame([stroke("drawing"), stroke("color", "Color")]);
    const drawingEdit = frame([
      { ...stroke("drawing"), points: [{ x: 99, y: 2 }] },
      stroke("color", "Color"),
    ]);
    const colorOpacity = frame(
      [stroke("drawing"), stroke("color", "Color")],
      { opacity: { Color: 0.5 } },
    );

    expect(storyboardPaintoverFingerprint(base, "color"))
      .toBe(storyboardPaintoverFingerprint(drawingEdit, "color"));
    expect(storyboardPaintoverFingerprint(base, "color"))
      .not.toBe(storyboardPaintoverFingerprint(colorOpacity, "color"));
    expect(storyboardPaintoverFingerprint(base, "atmosphere"))
      .toBe(storyboardPaintoverFingerprint(colorOpacity, "atmosphere"));
  });
});
