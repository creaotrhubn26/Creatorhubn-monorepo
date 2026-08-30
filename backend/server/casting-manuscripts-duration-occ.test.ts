import { describe, expect, it, vi } from "vitest";

import { createCastingManuscriptsService } from "./casting-manuscripts-service.js";
import {
  frameDurationWriteHTTPStatus,
  legacySecondsToShotDurationV1,
  normalizeStoryboardMediaTimeV1,
  prepareFrameDurationWriteV1,
} from "./storyboard-shot-duration.js";

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
  frameFields: Record<string, unknown> = {},
  keyLockGate?: KeyLockGate,
) {
  const store = new Map<string, unknown>();
  const initialUpdatedAt = "2026-08-29T09:00:00.000Z";
  store.set("casting:manuscript:manuscript-1", {
    id: "manuscript-1",
    projectId: "project-1",
    version: 1,
  });
  store.set("casting:scenes:manuscript-1", [
    {
      id: "scene-1",
      storyboardFrames: [
        {
          id: "frame-1",
          updatedAt: initialUpdatedAt,
          sourceUpdatedAt: initialUpdatedAt,
          drawingData: { strokes: "[]" },
          ...frameFields,
        },
      ],
    },
  ]);
  const compatStoreSet = vi.fn(async (key: string, value: unknown) => {
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
  const persistedFrame = () =>
    (store.get("casting:scenes:manuscript-1") as any[])[0].storyboardFrames[0];
  const persistedManuscript = () =>
    store.get("casting:manuscript:manuscript-1") as Record<string, unknown>;
  return {
    service: createPeerService(),
    createPeerService,
    compatStoreSet,
    initialUpdatedAt,
    persistedFrame,
    persistedManuscript,
  };
}

describe("Storyboard MediaTime v1 duration boundary", () => {
  it("reduces rational values and rounds legacy halves away from zero", () => {
    expect(
      normalizeStoryboardMediaTimeV1({ value: 48, timescale: 24 }),
    ).toEqual({ value: 2, timescale: 1 });
    expect(legacySecondsToShotDurationV1(1 / 1_200)).toEqual({
      value: 1,
      timescale: 600,
    });
    expect(legacySecondsToShotDurationV1(3 / 1_200)).toEqual({
      value: 1,
      timescale: 300,
    });
  });

  it("rejects unsafe, non-finite, non-positive and out-of-bounds time", () => {
    expect(
      normalizeStoryboardMediaTimeV1({ value: 1.5, timescale: 600 }),
    ).toBeNull();
    expect(
      normalizeStoryboardMediaTimeV1({ value: 1, timescale: 0 }),
    ).toBeNull();
    expect(legacySecondsToShotDurationV1(Number.NaN)).toBeNull();
    expect(legacySecondsToShotDurationV1(Number.POSITIVE_INFINITY)).toBeNull();
    expect(legacySecondsToShotDurationV1(0)).toBeNull();
    expect(legacySecondsToShotDurationV1(-1)).toBeNull();
    expect(legacySecondsToShotDurationV1(600.01)).toBeNull();
  });

  it("classifies dual-write mismatch as 409 and requires a legacy projection", () => {
    const mismatch = prepareFrameDurationWriteV1({
      shotDuration: { value: 2, timescale: 1 },
      duration: 2.1,
      expectedDurationRevision: 0,
    });
    expect(mismatch).toEqual({ ok: false, error: "duration_mismatch" });
    expect(frameDurationWriteHTTPStatus("duration_mismatch")).toBe(409);
    expect(
      prepareFrameDurationWriteV1({
        shotDuration: { value: 2, timescale: 1 },
        expectedDurationRevision: 0,
      }),
    ).toEqual({ ok: false, error: "legacy_duration_required" });
  });
});

describe("casting shot-duration optimistic concurrency", () => {
  it("initializes canonical duration from one legacy-only write", async () => {
    const { service, persistedFrame, persistedManuscript, initialUpdatedAt } =
      createHarness();
    const result = await service.patchFrameDuration(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { duration: 2.000_4 },
    );

    expect(result).toMatchObject({
      ok: true,
      changed: true,
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 1,
      duration: 2,
      durationSec: 2,
      sourceUpdatedAt: initialUpdatedAt,
    });
    expect(persistedFrame()).toMatchObject({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 1,
      duration: 2,
      durationSec: 2,
      sourceUpdatedAt: initialUpdatedAt,
    });
    expect(persistedManuscript()).toMatchObject({
      storyboardTiming: {
        version: 1,
        projectFrameRate: { value: 25, timescale: 1 },
        timelineTimescale: 600,
      },
    });
  });

  it("writes timing once, then treats an identical legacy replay as a no-op", async () => {
    const { service, compatStoreSet, persistedFrame, persistedManuscript } =
      createHarness({
        shotDuration: { value: 48, timescale: 24 },
        durationRevision: 3,
        duration: 2,
        durationSec: 2,
      });
    const before = structuredClone(persistedFrame());
    const result = await service.patchFrameDuration(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { durationSec: 2 },
    );

    expect(result).toMatchObject({
      ok: true,
      changed: false,
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 3,
    });
    expect(compatStoreSet).toHaveBeenCalledTimes(1);
    expect(persistedManuscript()).toMatchObject({
      storyboardTiming: {
        version: 1,
        projectFrameRate: { value: 25, timescale: 1 },
        timelineTimescale: 600,
      },
    });
    expect(persistedFrame()).toEqual(before);

    compatStoreSet.mockClear();
    const replay = await service.patchFrameDuration(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { durationSec: 2 },
    );
    expect(replay).toMatchObject({ ok: true, changed: false });
    expect(compatStoreSet).not.toHaveBeenCalled();
    expect(persistedFrame()).toEqual(before);
  });

  it("rejects a changed legacy-only write after canonical migration", async () => {
    const { service, compatStoreSet, persistedFrame } = createHarness({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 4,
      duration: 2,
      durationSec: 2,
    });
    const before = structuredClone(persistedFrame());
    const result = await service.patchFrameDuration(
      "manuscript-1",
      "scene-1",
      "frame-1",
      { duration: 3 },
    );

    expect(result).toEqual({
      ok: false,
      error: "client_upgrade_required",
      currentShotDuration: { value: 2, timescale: 1 },
      currentDurationRevision: 4,
    });
    expect(frameDurationWriteHTTPStatus("client_upgrade_required")).toBe(409);
    expect(compatStoreSet).not.toHaveBeenCalled();
    expect(persistedFrame()).toEqual(before);
  });

  it("dual-writes a canonical mutation only at the expected revision", async () => {
    const { service, persistedFrame, initialUpdatedAt } = createHarness({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 7,
      duration: 2,
      durationSec: 2,
    });
    const result = await service.patchFrameDuration(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        shotDuration: { value: 75, timescale: 25 },
        durationSec: 3,
        expectedDurationRevision: 7,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      changed: true,
      shotDuration: { value: 3, timescale: 1 },
      durationRevision: 8,
      duration: 3,
      durationSec: 3,
      sourceUpdatedAt: initialUpdatedAt,
    });
    expect(persistedFrame()).toMatchObject({
      shotDuration: { value: 3, timescale: 1 },
      durationRevision: 8,
      duration: 3,
      durationSec: 3,
      sourceUpdatedAt: initialUpdatedAt,
    });
    expect(persistedFrame().updatedAt).not.toBe(initialUpdatedAt);
  });

  it("invalidates video timing only when canonical duration changes", async () => {
    const currentPaintover = {
      version: 1,
      colorRevision: 2,
      atmosphereRevision: 3,
      atmosphereStale: false,
      videoStale: false,
      colorFingerprint: "color",
      atmosphereFingerprint: "atmosphere",
      colorHasContent: true,
      atmosphereHasContent: true,
    };
    const changedHarness = createHarness({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 7,
      duration: 2,
      durationSec: 2,
      aiPaintoverState: currentPaintover,
    });
    const changed = await changedHarness.service.patchFrameDuration(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        shotDuration: { value: 3, timescale: 1 },
        duration: 3,
        expectedDurationRevision: 7,
      },
    );
    expect(changed).toMatchObject({ ok: true, changed: true });
    expect(changedHarness.persistedFrame()).toMatchObject({
      aiPaintoverState: {
        colorRevision: 2,
        atmosphereRevision: 3,
        videoStale: true,
      },
    });

    const noOpHarness = createHarness({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 7,
      duration: 2,
      durationSec: 2,
      aiPaintoverState: currentPaintover,
    });
    const noOp = await noOpHarness.service.patchFrameDuration(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        shotDuration: { value: 2, timescale: 1 },
        duration: 2,
        expectedDurationRevision: 7,
      },
    );
    expect(noOp).toMatchObject({ ok: true, changed: false });
    expect(noOpHarness.persistedFrame().aiPaintoverState).toEqual(
      currentPaintover,
    );
  });

  it("returns the authoritative duration for a stale expected revision", async () => {
    const { service, compatStoreSet, persistedFrame } = createHarness({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 7,
      duration: 2,
      durationSec: 2,
    });
    const before = structuredClone(persistedFrame());
    const result = await service.patchFrameDuration(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        shotDuration: { value: 3, timescale: 1 },
        duration: 3,
        expectedDurationRevision: 6,
      },
    );

    expect(result).toEqual({
      ok: false,
      error: "duration_revision_conflict",
      currentShotDuration: { value: 2, timescale: 1 },
      currentDurationRevision: 7,
    });
    expect(compatStoreSet).not.toHaveBeenCalled();
    expect(persistedFrame()).toEqual(before);
  });

  it("rejects inconsistent canonical and legacy values atomically", async () => {
    const { service, compatStoreSet, persistedFrame } = createHarness({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 1,
    });
    const before = structuredClone(persistedFrame());
    const result = await service.patchFrameDuration(
      "manuscript-1",
      "scene-1",
      "frame-1",
      {
        shotDuration: { value: 3, timescale: 1 },
        duration: 4,
        expectedDurationRevision: 1,
      },
    );

    expect(result).toEqual({ ok: false, error: "duration_mismatch" });
    expect(compatStoreSet).not.toHaveBeenCalled();
    expect(persistedFrame()).toEqual(before);
  });

  it("serializes competing revisions across service instances", async () => {
    const keyLock = createSharedKeyLockGate();
    const { service, createPeerService, persistedFrame } = createHarness(
      {
        shotDuration: { value: 2, timescale: 1 },
        durationRevision: 2,
        duration: 2,
        durationSec: 2,
      },
      keyLock,
    );
    const peer = createPeerService();
    const [first, second] = await Promise.all([
      service.patchFrameDuration("manuscript-1", "scene-1", "frame-1", {
        shotDuration: { value: 3, timescale: 1 },
        duration: 3,
        expectedDurationRevision: 2,
      }),
      peer.patchFrameDuration("manuscript-1", "scene-1", "frame-1", {
        shotDuration: { value: 4, timescale: 1 },
        duration: 4,
        expectedDurationRevision: 2,
      }),
    ]);

    expect(first).toMatchObject({ ok: true, durationRevision: 3 });
    expect(second).toEqual({
      ok: false,
      error: "duration_revision_conflict",
      currentShotDuration: { value: 3, timescale: 1 },
      currentDurationRevision: 3,
    });
    expect(persistedFrame()).toMatchObject({
      shotDuration: { value: 3, timescale: 1 },
      durationRevision: 3,
      duration: 3,
      durationSec: 3,
    });
  });
});
