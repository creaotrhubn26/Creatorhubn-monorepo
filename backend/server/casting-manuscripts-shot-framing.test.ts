import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SHOT_FRAMING_STATE,
  normalizeShotFramingState,
} from "../../frontend/shared/storyboard-shot-framing.js";
import { createCastingManuscriptsService } from "./casting-manuscripts-service.js";

describe("storyboard shot framing contract", () => {
  it("normalizes native legacy aliases and emits canonical bounded fields", () => {
    expect(normalizeShotFramingState({
      version: 99,
      centerX: -2,
      centerY: 4,
      scale: 24,
      rotationDegrees: 450,
      aspectRatio: 20,
      focusAnchorX: 0.25,
      focusAnchorY: 0.75,
      mode: "unknown",
      intentFingerprint: "  CU|low|85  ",
      revision: 2.9,
      shotSize: " CU ",
      angle: " Low ",
      lensMm: 84.6,
      ignoredFutureField: true,
    })).toEqual({
      version: 1,
      centerX: 0,
      centerY: 1,
      zoom: 16,
      rollDegrees: 90,
      aspectRatio: 10,
      focusAnchorX: 0.25,
      focusAnchorY: 0.75,
      mode: "automatic",
      intentFingerprint: "CU|low|85",
      revision: 2,
      shotSize: "CU",
      angle: "Low",
      lensMm: 85,
    });
  });

  it("uses native defaults and drops partial focus anchors", () => {
    expect(normalizeShotFramingState({ focusAnchorX: 0.4 })).toEqual(
      DEFAULT_SHOT_FRAMING_STATE,
    );
  });

  it("accepts the legacy shotType intent snapshot alias", () => {
    expect(normalizeShotFramingState({ shotType: "  MCU  " })).toMatchObject({
      shotSize: "MCU",
    });
  });

  it("persists shotFraming separately without replacing drawingData", async () => {
    const store = new Map<string, unknown>();
    store.set("casting:manuscript:manuscript-1", {
      id: "manuscript-1",
      version: 1,
    });
    store.set("casting:scenes:manuscript-1", [{
      id: "scene-1",
      storyboardFrames: [{
        id: "frame-1",
        shotType: "WS",
        drawingData: {
          strokes: "[{\"id\":\"stroke-1\"}]",
          width: 1920,
          height: 1080,
        },
      }],
    }]);

    const compatStoreSet = vi.fn(async (key: string, value: unknown) => {
      store.set(key, structuredClone(value));
    });
    const service = createCastingManuscriptsService({
      compatStoreGet: async <T>(key: string) => structuredClone(store.get(key) as T) ?? null,
      compatStoreSet,
      compatStoreSetStrict: compatStoreSet,
      compatStoreDelete: async (key: string) => { store.delete(key); },
      compatStoreListByPrefix: async <T>(prefix: string) => (
        [...store.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => ({ key, value: structuredClone(value) as T }))
      ),
    });
    const shotFraming = normalizeShotFramingState({
      centerX: 0.42,
      centerY: 0.38,
      zoom: 2.4,
      rollDegrees: 8,
      aspectRatio: 2.39,
      mode: "manual",
      revision: 3,
      shotSize: "CU",
      angle: "Dutch",
      lensMm: 85,
    });

    await expect(service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { shotFraming },
    )).resolves.toMatchObject({
      updatedAt: expect.any(String),
      sourceUpdatedAt: expect.any(String),
    });

    const persistedScenes = store.get("casting:scenes:manuscript-1") as any[];
    const persistedFrame = persistedScenes[0].storyboardFrames[0];
    expect(persistedFrame.shotFraming).toEqual(shotFraming);
    expect(persistedFrame.shotType).toBe("WS");
    expect(persistedFrame.drawingData).toEqual({
      strokes: "[{\"id\":\"stroke-1\"}]",
      width: 1920,
      height: 1080,
    });
  });
});
