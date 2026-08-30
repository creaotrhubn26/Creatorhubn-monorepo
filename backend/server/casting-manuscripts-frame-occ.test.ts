import { describe, expect, it, vi } from "vitest";

import { createCastingManuscriptsService } from "./casting-manuscripts-service.js";

function stroke(id: string, value: number, boardLayer?: string) {
  return {
    id,
    ...(boardLayer ? { boardLayer } : {}),
    points: [{ x: value, y: value }],
  };
}

function camera(centerX: number, revision: number) {
  return {
    version: 1,
    centerX,
    centerY: 0.5,
    zoom: 1,
    rollDegrees: 0,
    aspectRatio: 16 / 9,
    mode: "manual",
    revision,
  };
}

function layers(activeLayer: string, hidden: string[] = []) {
  return {
    version: 2,
    order: ["Drawing", "Color", "Notes"],
    hidden,
    locked: [],
    opacity: {},
    blendModes: {},
    activeLayer,
  };
}

type KeyLockGate = <T>(
  storeKey: string,
  operation: () => Promise<T>,
) => Promise<T>;

function createSharedKeyLockGate(): KeyLockGate {
  let tail = Promise.resolve();
  return async <T>(
    _storeKey: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const previous = tail;
    let release = () => {};
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  };
}

function createHarness(
  initialStrokes: unknown[],
  sidecars: {
    shotFraming?: unknown;
    layerState?: unknown;
    aiPaintoverState?: unknown;
  } = {},
  keyLockGate?: KeyLockGate,
) {
  const store = new Map<string, unknown>();
  const initialUpdatedAt = "2026-08-29T09:00:00.000Z";
  store.set("casting:manuscript:manuscript-1", {
    id: "manuscript-1",
    version: 1,
  });
  store.set("casting:scenes:manuscript-1", [
    {
      id: "scene-1",
      storyboardFrames: [
        {
          id: "frame-1",
          updatedAt: initialUpdatedAt,
          ...(sidecars.shotFraming === undefined
            ? {}
            : { shotFraming: sidecars.shotFraming }),
          ...(sidecars.aiPaintoverState === undefined
            ? {}
            : { aiPaintoverState: sidecars.aiPaintoverState }),
          drawingData: {
            strokes: JSON.stringify(initialStrokes),
            ...(sidecars.layerState === undefined
              ? {}
              : { layerState: sidecars.layerState }),
          },
        },
      ],
    },
  ]);
  const compatStoreSet = vi.fn(async (key: string, value: unknown) => {
    // Give concurrent patch calls an actual suspension point.
    await Promise.resolve();
    store.set(key, structuredClone(value));
  });
  const compatStoreGet = async <T>(key: string): Promise<T | null> =>
    structuredClone(store.get(key) as T) ?? null;
  const createPeerService = () =>
    createCastingManuscriptsService({
      compatStoreGet,
      compatStoreSet,
      compatStoreSetStrict: compatStoreSet,
      compatStoreWithKeyLock: keyLockGate
        ? <T>(
            key: string,
            operation: (lockedStore: {
              get<U>(storeKey: string): Promise<U | null>;
              setStrict(storeKey: string, value: unknown): Promise<void>;
            }) => Promise<T>,
          ) =>
            keyLockGate(key, () =>
              operation({
                get: compatStoreGet,
                setStrict: compatStoreSet,
              }),
            )
        : undefined,
      compatStoreDelete: async (key: string) => {
        store.delete(key);
      },
      compatStoreListByPrefix: async () => [],
    });
  const service = createPeerService();
  const persistedFrame = () =>
    (store.get("casting:scenes:manuscript-1") as any[])[0].storyboardFrames[0];
  const persistedScene = () =>
    (store.get("casting:scenes:manuscript-1") as any[])[0];
  return {
    service,
    createPeerService,
    initialUpdatedAt,
    persistedFrame,
    persistedScene,
  };
}

describe("casting frame optimistic concurrency", () => {
  it("keeps sourceUpdatedAt stable for metadata writes and advances it for source edits", async () => {
    const a = stroke("a", 1);
    const { service, initialUpdatedAt } = createHarness([a]);
    const metadataWrite = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { frameComments: [{ id: "comment-1" }] },
      { baseUpdatedAt: initialUpdatedAt, sourceDocumentChanged: false },
    );
    expect(metadataWrite?.sourceUpdatedAt).toBe(initialUpdatedAt);
    expect(metadataWrite?.updatedAt).not.toBe(initialUpdatedAt);

    const noOpAcknowledgement = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { strokes: JSON.stringify([a]) } },
      {
        baseUpdatedAt: metadataWrite?.updatedAt,
        baseStrokesJSON: JSON.stringify([a]),
        sourceDocumentChanged: true,
      },
    );
    expect(noOpAcknowledgement?.sourceChanged).toBe(false);
    expect(noOpAcknowledgement?.sourceUpdatedAt).toBe(initialUpdatedAt);

    const sourceWrite = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { strokes: JSON.stringify([a, stroke("b", 2)]) } },
      {
        baseUpdatedAt: noOpAcknowledgement?.updatedAt,
        baseStrokesJSON: JSON.stringify([a]),
        sourceDocumentChanged: true,
      },
    );
    expect(sourceWrite?.sourceUpdatedAt).toBe(sourceWrite?.updatedAt);
    expect(sourceWrite?.sourceChanged).toBe(true);
    expect(sourceWrite?.sourceUpdatedAt).not.toBe(initialUpdatedAt);
  });

  it("keeps paintovers editable and advances only downstream stage identity", async () => {
    const drawing = stroke("drawing", 1, "Drawing");
    const color = stroke("color", 2, "Color");
    const atmosphere = stroke("atmosphere", 3, "Atmosphere");
    const baseLayers = layers("Color");
    const { service, initialUpdatedAt, persistedFrame } = createHarness(
      [drawing],
      { layerState: baseLayers },
    );

    const colorWrite = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { strokes: JSON.stringify([drawing, color]) } },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: JSON.stringify([drawing]),
      },
    );
    expect(colorWrite).toMatchObject({
      sourceChanged: false,
      sourceUpdatedAt: initialUpdatedAt,
      aiPaintoverState: {
        version: 1,
        colorRevision: 1,
        atmosphereRevision: 0,
        atmosphereStale: true,
        videoStale: true,
      },
    });
    expect(persistedFrame()).not.toHaveProperty("aiOutputStale");

    const colorFingerprint = colorWrite?.aiPaintoverState?.colorFingerprint;
    const atmosphereWrite = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        drawingData: {
          strokes: JSON.stringify([drawing, color, atmosphere]),
        },
      },
      {
        baseUpdatedAt: colorWrite?.updatedAt,
        baseStrokesJSON: JSON.stringify([drawing, color]),
      },
    );
    expect(atmosphereWrite).toMatchObject({
      sourceChanged: false,
      sourceUpdatedAt: initialUpdatedAt,
      aiPaintoverState: {
        version: 1,
        colorRevision: 1,
        atmosphereRevision: 1,
        atmosphereStale: true,
        videoStale: true,
        colorFingerprint,
      },
    });
    expect(atmosphereWrite?.aiPaintoverState?.atmosphereFingerprint).not.toBe(
      colorWrite?.aiPaintoverState?.atmosphereFingerprint,
    );
    expect(persistedFrame()).not.toHaveProperty("aiOutputStale");
  });

  it("advances the source token for visual layer changes but not editor-only state", async () => {
    const a = stroke("a", 1);
    const baseLayers = layers("Drawing");
    const { service, initialUpdatedAt, persistedFrame } = createHarness([a], {
      layerState: baseLayers,
    });
    const editorOnlyLayers = {
      ...baseLayers,
      activeLayer: "Color",
      locked: ["Notes"],
    };
    const editorOnlyWrite = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { layerState: editorOnlyLayers } },
      { baseUpdatedAt: initialUpdatedAt, baseLayerState: baseLayers },
    );
    expect(editorOnlyWrite).toMatchObject({
      sourceChanged: false,
      sourceUpdatedAt: initialUpdatedAt,
    });

    const visualLayers = {
      ...editorOnlyLayers,
      hidden: ["Color"],
      opacity: { Drawing: 0.75 },
      blendModes: { Drawing: "multiply" },
    };
    const visualWrite = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { layerState: visualLayers } },
      {
        baseUpdatedAt: editorOnlyWrite?.updatedAt,
        baseLayerState: editorOnlyLayers,
      },
    );
    expect(visualWrite).toMatchObject({ sourceChanged: true });
    expect(visualWrite?.sourceUpdatedAt).toBe(visualWrite?.updatedAt);
    expect(visualWrite?.sourceUpdatedAt).not.toBe(initialUpdatedAt);
    expect(persistedFrame()).toMatchObject({
      aiOutputStale: true,
      aiOutputStaleReason: "source-document-changed",
      drawingData: { layerState: visualLayers },
    });
  });

  it("persists a distinct stale reason for a camera-only source edit", async () => {
    const a = stroke("a", 1);
    const baseCamera = camera(0.5, 1);
    const nextCamera = camera(0.62, 2);
    const { service, initialUpdatedAt, persistedFrame } = createHarness([a], {
      shotFraming: baseCamera,
    });

    const result = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { shotFraming: nextCamera },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: JSON.stringify([a]),
        baseShotFraming: baseCamera,
      },
    );

    expect(result).toMatchObject({ sourceChanged: true });
    expect(persistedFrame()).toMatchObject({
      shotFraming: nextCamera,
      aiOutputStale: true,
      aiOutputStaleReason: "shot-framing-changed",
    });
  });

  it("serializes two service instances through the shared store-key lock", async () => {
    const withKeyLock = createSharedKeyLockGate();
    const a = stroke("a", 1);
    const b = stroke("b", 2);
    const c = stroke("c", 3);
    const baseCamera = camera(0.5, 0);
    const remoteCamera = camera(0.68, 1);
    const { service, createPeerService, initialUpdatedAt, persistedFrame } =
      createHarness([a], { shotFraming: baseCamera }, withKeyLock);
    const peerService = createPeerService();
    const baseJSON = JSON.stringify([a]);

    const remoteCameraSave = service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        shotFraming: remoteCamera,
        drawingData: { strokes: JSON.stringify([a, b]) },
      },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: baseJSON,
        baseShotFraming: baseCamera,
      },
    );
    const staleStrokeSave = peerService.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        shotFraming: baseCamera,
        drawingData: { strokes: JSON.stringify([a, c]) },
      },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: baseJSON,
        baseShotFraming: baseCamera,
      },
    );

    const [, staleResult] = await Promise.all([
      remoteCameraSave,
      staleStrokeSave,
    ]);
    expect(staleResult).toMatchObject({
      merged: true,
      shotFraming: remoteCamera,
    });
    expect(JSON.parse(persistedFrame().drawingData.strokes)).toEqual([a, b, c]);
    expect(persistedFrame().shotFraming).toEqual(remoteCamera);
  });

  it("keeps a frame PATCH when a route-style whole-scene mutation waits behind it", async () => {
    const withKeyLock = createSharedKeyLockGate();
    const a = stroke("a", 1);
    const b = stroke("b", 2);
    const {
      service,
      createPeerService,
      initialUpdatedAt,
      persistedFrame,
      persistedScene,
    } = createHarness([a], {}, withKeyLock);
    const peerService = createPeerService();
    const baseJSON = JSON.stringify([a]);

    const framePatch = service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { strokes: JSON.stringify([a, b]) } },
      { baseUpdatedAt: initialUpdatedAt, baseStrokesJSON: baseJSON },
    );
    const wholeSceneMutation = peerService.mutateScenes(
      "manuscript-1",
      (current) => {
        const next = structuredClone(current);
        next[0] = { ...next[0], heading: "Updated while locked" };
        return { scenes: next, result: true };
      },
    );

    await Promise.all([framePatch, wholeSceneMutation]);
    expect(JSON.parse(persistedFrame().drawingData.strokes)).toEqual([a, b]);
    expect(persistedScene().heading).toBe("Updated while locked");
  });

  it("serializes stale writers and server-side three-way merges their strokes", async () => {
    const a = stroke("a", 1);
    const b = stroke("b", 2);
    const c = stroke("c", 3);
    const { service, initialUpdatedAt, persistedFrame } = createHarness([a]);
    const baseJSON = JSON.stringify([a]);

    const first = service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { strokes: JSON.stringify([a, b]) } },
      { baseUpdatedAt: initialUpdatedAt, baseStrokesJSON: baseJSON },
    );
    const second = service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { strokes: JSON.stringify([a, c]) } },
      { baseUpdatedAt: initialUpdatedAt, baseStrokesJSON: baseJSON },
    );

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toMatchObject({ merged: false });
    expect(secondResult).toMatchObject({ merged: true });
    expect(JSON.parse(persistedFrame().drawingData.strokes)).toEqual([a, b, c]);
    expect(JSON.parse(secondResult?.strokesJSON ?? "[]")).toEqual([a, b, c]);
  });

  it("preserves deletion tombstones during a stale merge", async () => {
    const a = stroke("a", 1);
    const b = stroke("b", 2);
    const c = stroke("c", 3);
    const { service, initialUpdatedAt, persistedFrame } = createHarness([a, b]);
    const baseJSON = JSON.stringify([a, b]);

    await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { strokes: JSON.stringify([a]) } },
      { baseUpdatedAt: initialUpdatedAt, baseStrokesJSON: baseJSON },
    );
    const staleResult = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { strokes: JSON.stringify([a, b, c]) } },
      { baseUpdatedAt: initialUpdatedAt, baseStrokesJSON: baseJSON },
    );

    expect(staleResult).toMatchObject({ merged: true });
    expect(JSON.parse(persistedFrame().drawingData.strokes)).toEqual([a, c]);
  });

  it("returns a non-mutating conflict when a stale document cannot be merged", async () => {
    const a = stroke("a", 1);
    const b = stroke("b", 2);
    const { service, initialUpdatedAt, persistedFrame } = createHarness([a]);
    const first = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { strokes: JSON.stringify([a, b]) } },
      { baseUpdatedAt: initialUpdatedAt, baseStrokesJSON: JSON.stringify([a]) },
    );
    const beforeConflict = persistedFrame().drawingData.strokes;

    const staleConflict = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { strokes: "not-json" } },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: JSON.stringify([a]),
      },
    );
    expect(first?.updatedAt).not.toBe(initialUpdatedAt);
    expect(staleConflict).toMatchObject({ conflict: true });
    expect(persistedFrame().drawingData.strokes).toBe(beforeConflict);
  });

  it("preserves a remote camera edit while accepting a local stroke", async () => {
    const a = stroke("a", 1);
    const b = stroke("b", 2);
    const baseCamera = camera(0.5, 1);
    const remoteCamera = camera(0.7, 2);
    const baseLayers = layers("Drawing");
    const { service, initialUpdatedAt, persistedFrame } = createHarness([a], {
      shotFraming: baseCamera,
      layerState: baseLayers,
    });
    const baseJSON = JSON.stringify([a]);

    await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { shotFraming: remoteCamera, shotType: "CU" },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: baseJSON,
        baseShotFraming: baseCamera,
        baseLayerState: baseLayers,
      },
    );
    const localSave = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        shotFraming: baseCamera,
        drawingData: {
          strokes: JSON.stringify([a, b]),
          layerState: baseLayers,
        },
      },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: baseJSON,
        baseShotFraming: baseCamera,
        baseLayerState: baseLayers,
      },
    );

    expect(localSave).toMatchObject({
      merged: true,
      shotFraming: remoteCamera,
    });
    expect(persistedFrame().shotFraming).toEqual(remoteCamera);
    expect(JSON.parse(persistedFrame().drawingData.strokes)).toEqual([a, b]);
  });

  it("accepts a local camera edit while preserving a remote stroke", async () => {
    const a = stroke("a", 1);
    const b = stroke("b", 2);
    const baseCamera = camera(0.5, 1);
    const localCamera = camera(0.3, 2);
    const baseLayers = layers("Drawing");
    const { service, initialUpdatedAt, persistedFrame } = createHarness([a], {
      shotFraming: baseCamera,
      layerState: baseLayers,
    });
    const baseJSON = JSON.stringify([a]);

    await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        drawingData: {
          strokes: JSON.stringify([a, b]),
          layerState: baseLayers,
        },
      },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: baseJSON,
        baseShotFraming: baseCamera,
        baseLayerState: baseLayers,
      },
    );
    const localSave = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        shotFraming: localCamera,
        drawingData: { strokes: baseJSON, layerState: baseLayers },
      },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: baseJSON,
        baseShotFraming: baseCamera,
        baseLayerState: baseLayers,
      },
    );

    expect(localSave).toMatchObject({ merged: true, shotFraming: localCamera });
    expect(persistedFrame().shotFraming).toEqual(localCamera);
    expect(JSON.parse(persistedFrame().drawingData.strokes)).toEqual([a, b]);
  });

  it("rejects two divergent camera edits without mutating strokes or framing", async () => {
    const a = stroke("a", 1);
    const localStroke = stroke("local", 9);
    const baseCamera = camera(0.5, 1);
    const remoteCamera = camera(0.7, 2);
    const localCamera = camera(0.3, 2);
    const { service, initialUpdatedAt, persistedFrame } = createHarness([a], {
      shotFraming: baseCamera,
    });
    const baseJSON = JSON.stringify([a]);

    await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { shotFraming: remoteCamera },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: baseJSON,
        baseShotFraming: baseCamera,
      },
    );
    const beforeConflict = structuredClone(persistedFrame());
    const conflict = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        shotFraming: localCamera,
        drawingData: { strokes: JSON.stringify([a, localStroke]) },
      },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: baseJSON,
        baseShotFraming: baseCamera,
      },
    );

    expect(conflict).toMatchObject({
      conflict: true,
      currentShotFraming: remoteCamera,
    });
    expect(persistedFrame()).toEqual(beforeConflict);
  });

  it("three-way merges layer state independently from remote strokes", async () => {
    const a = stroke("a", 1);
    const b = stroke("b", 2);
    const baseLayers = layers("Drawing");
    const localLayers = layers("Color", ["Notes"]);
    const { service, initialUpdatedAt, persistedFrame } = createHarness([a], {
      layerState: baseLayers,
    });
    const baseJSON = JSON.stringify([a]);

    await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        drawingData: {
          strokes: JSON.stringify([a, b]),
          layerState: baseLayers,
        },
      },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: baseJSON,
        baseLayerState: baseLayers,
      },
    );
    const localSave = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { strokes: baseJSON, layerState: localLayers } },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: baseJSON,
        baseLayerState: baseLayers,
      },
    );

    expect(localSave).toMatchObject({ merged: true, layerState: localLayers });
    expect(persistedFrame().drawingData.layerState).toEqual(localLayers);
    expect(JSON.parse(persistedFrame().drawingData.strokes)).toEqual([a, b]);
  });

  it("preserves a remote layer edit and rejects a true layer conflict atomically", async () => {
    const a = stroke("a", 1);
    const b = stroke("b", 2);
    const baseLayers = layers("Drawing");
    const remoteLayers = layers("Color");
    const conflictingLayers = layers("Notes", ["Color"]);
    const { service, initialUpdatedAt, persistedFrame } = createHarness([a], {
      layerState: baseLayers,
    });
    const baseJSON = JSON.stringify([a]);

    await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { strokes: baseJSON, layerState: remoteLayers } },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: baseJSON,
        baseLayerState: baseLayers,
      },
    );
    const remotePreserved = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        drawingData: {
          strokes: JSON.stringify([a, b]),
          layerState: baseLayers,
        },
      },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: baseJSON,
        baseLayerState: baseLayers,
      },
    );
    expect(remotePreserved).toMatchObject({
      merged: true,
      layerState: remoteLayers,
    });
    expect(persistedFrame().drawingData.layerState).toEqual(remoteLayers);
    expect(JSON.parse(persistedFrame().drawingData.strokes)).toEqual([a, b]);

    const beforeConflict = structuredClone(persistedFrame());
    const conflict = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        drawingData: {
          strokes: JSON.stringify([a]),
          layerState: conflictingLayers,
        },
      },
      {
        baseUpdatedAt: initialUpdatedAt,
        baseStrokesJSON: baseJSON,
        baseLayerState: baseLayers,
      },
    );
    expect(conflict).toMatchObject({
      conflict: true,
      currentLayerState: remoteLayers,
    });
    expect(persistedFrame()).toEqual(beforeConflict);
  });

  it("does not drop layer state when a strokes-only caller omits the sidecar", async () => {
    const a = stroke("a", 1);
    const b = stroke("b", 2);
    const existingLayers = layers("Color", ["Notes"]);
    const { service, initialUpdatedAt, persistedFrame } = createHarness([a], {
      layerState: existingLayers,
    });
    const baseJSON = JSON.stringify([a]);

    await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { drawingData: { strokes: JSON.stringify([a, b]) } },
      { baseUpdatedAt: initialUpdatedAt, baseStrokesJSON: baseJSON },
    );

    expect(persistedFrame().drawingData.layerState).toEqual(existingLayers);
    expect(JSON.parse(persistedFrame().drawingData.strokes)).toEqual([a, b]);
  });

  it("uses sidecar bases even when a legacy client has no document version token", async () => {
    const a = stroke("a", 1);
    const baseCamera = camera(0.5, 0);
    const remoteCamera = camera(0.68, 1);
    const baseLayers = layers("Drawing");
    const remoteLayers = layers("Color");
    const { service, persistedFrame } = createHarness([a], {
      shotFraming: baseCamera,
      layerState: baseLayers,
    });
    const strokesJSON = JSON.stringify([a]);

    await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        shotFraming: remoteCamera,
        drawingData: { strokes: strokesJSON, layerState: remoteLayers },
      },
      {
        baseShotFraming: baseCamera,
        baseLayerState: baseLayers,
      },
    );

    const localStroke = await service.patchFrame(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        shotFraming: baseCamera,
        drawingData: { strokes: strokesJSON, layerState: baseLayers },
      },
      {
        baseShotFraming: baseCamera,
        baseLayerState: baseLayers,
      },
    );

    expect(localStroke).toMatchObject({
      merged: true,
      shotFraming: remoteCamera,
      layerState: remoteLayers,
    });
    expect(persistedFrame().shotFraming).toEqual(remoteCamera);
    expect(persistedFrame().drawingData.layerState).toEqual(remoteLayers);
  });
});
