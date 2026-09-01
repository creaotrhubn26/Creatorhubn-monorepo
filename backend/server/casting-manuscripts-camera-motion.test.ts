import { describe, expect, it, vi } from "vitest";

import { setupCastingManuscriptsRoutes } from "./casting-manuscripts-routes.js";
import { createCastingManuscriptsService } from "./casting-manuscripts-service.js";

const identifiers = {
  manuscriptId: "manuscript-1",
  sceneId: "scene-1",
  frameId: "frame-1",
};

function framing(centerX = 0.5, revision = 1) {
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

function track(time: number | { value: number; timescale: number } = 1) {
  return {
    version: 1,
    enabled: true,
    mode: "keyframed",
    presetId: "push-in",
    keyframes: [
      {
        id: "kf-1",
        time: typeof time === "number" ? { value: time, timescale: 1 } : time,
        pose: {
          centerX: 0.55,
          centerY: 0.5,
          zoom: 1.25,
          rollDegrees: 0,
        },
        easingFromPrevious: { kind: "easeInOut" },
      },
    ],
  };
}

type RouteMethod = "get" | "post" | "put" | "patch" | "delete";

function createRouteHarness() {
  const handlers = new Map<string, (req: any, res: any) => unknown>();
  const app: Record<string, unknown> = {};
  for (const method of ["get", "post", "put", "patch", "delete"] as const) {
    app[method] = (path: string, handler: (req: any, res: any) => unknown) => {
      handlers.set(`${method}:${path}`, handler);
      return app;
    };
  }
  return {
    app,
    async dispatch(
      method: RouteMethod,
      path: string,
      body: Record<string, unknown>,
    ) {
      const handler = handlers.get(`${method}:${path}`);
      if (!handler) throw new Error(`missing route ${method}:${path}`);
      const response = {
        statusCode: 200,
        body: undefined as any,
        ended: false,
      };
      const res = {
        status(code: number) {
          response.statusCode = code;
          return res;
        },
        json(value: unknown) {
          response.body = value;
          return res;
        },
        setHeader() {
          return res;
        },
        end() {
          response.ended = true;
          return res;
        },
      };
      await handler({ body, params: {}, query: {}, headers: {} }, res);
      return response;
    },
  };
}

function createHarness(
  frameFields: Record<string, unknown> = {},
  options: {
    withRoutes?: boolean;
    pool?: { query: ReturnType<typeof vi.fn> };
  } = {},
) {
  const store = new Map<string, unknown>();
  const initialUpdatedAt = "2026-08-29T09:00:00.000Z";
  store.set("casting:project:project-1", {
    id: "project-1",
    created_by: "user-1",
  });
  store.set("casting:manuscript:manuscript-1", {
    id: "manuscript-1",
    projectId: "project-1",
    version: 1,
  });
  store.set("casting:scenes:manuscript-1", [
    {
      id: "scene-1",
      manuscriptId: "manuscript-1",
      storyboardFrames: [
        {
          id: "frame-1",
          updatedAt: initialUpdatedAt,
          sourceUpdatedAt: initialUpdatedAt,
          drawingData: { strokes: "[]", width: 1920, height: 1080 },
          shotDuration: { value: 2, timescale: 1 },
          durationRevision: 1,
          duration: 2,
          durationSec: 2,
          shotFraming: framing(),
          ...frameFields,
        },
      ],
    },
  ]);
  const compatStoreGet = async <T>(key: string): Promise<T | null> =>
    structuredClone(store.get(key) as T) ?? null;
  const compatStoreSet = vi.fn(async (key: string, value: unknown) => {
    store.set(key, structuredClone(value));
  });
  const service = createCastingManuscriptsService({
    compatStoreGet,
    compatStoreSet,
    compatStoreSetStrict: compatStoreSet,
    compatStoreDelete: async (key: string) => {
      store.delete(key);
    },
    compatStoreListByPrefix: async () => [],
  });
  const persistedFrame = () =>
    (store.get("casting:scenes:manuscript-1") as any[])[0].storyboardFrames[0];
  let routes: ReturnType<typeof createRouteHarness> | undefined;
  if (options.withRoutes) {
    routes = createRouteHarness();
    setupCastingManuscriptsRoutes({
      app: routes.app as any,
      requireUserSession: () => ({ userId: "user-1" }),
      compatStoreGet,
      manuscriptsService: service,
      revisionsService: {} as any,
      pool: options.pool as any,
    });
  }
  return {
    routes,
    service,
    store,
    compatStoreSet,
    initialUpdatedAt,
    persistedFrame,
  };
}

describe("casting camera-motion service persistence", () => {
  it("persists canonical sidecars and stales video without touching Pencil source", async () => {
    const { service, persistedFrame, initialUpdatedAt } = createHarness();
    const result = await service.patchFrameCameraMotion(
      identifiers.manuscriptId,
      identifiers.sceneId,
      identifiers.frameId,
      { cameraMotionTrack: track(), expectedMotionRevision: 0 },
    );

    expect(result).toMatchObject({
      ok: true,
      cameraMotionTrack: track(),
      cameraMotionRevision: 1,
      cameraMotionStatus: "valid",
      changed: true,
      sourceUpdatedAt: initialUpdatedAt,
      aiPaintoverState: { version: 1, videoStale: true },
    });
    expect(result?.ok && result.cameraMotionFingerprint).toMatch(
      /^sha256:[a-f0-9]{64}$/,
    );
    expect(persistedFrame()).toMatchObject({
      cameraMotionTrack: track(),
      cameraMotionRevision: 1,
      cameraMotionStatus: "valid",
      sourceUpdatedAt: initialUpdatedAt,
      aiPaintoverState: { version: 1, videoStale: true },
    });
    expect(persistedFrame()).not.toHaveProperty("aiOutputStale");
    expect(persistedFrame().updatedAt).not.toBe(initialUpdatedAt);
  });

  it("returns independent OCC conflicts without a write", async () => {
    const { service, persistedFrame, compatStoreSet } = createHarness();
    const first = await service.patchFrameCameraMotion(
      identifiers.manuscriptId,
      identifiers.sceneId,
      identifiers.frameId,
      { cameraMotionTrack: track(), expectedMotionRevision: 0 },
    );
    expect(first?.ok).toBe(true);
    const before = structuredClone(persistedFrame());
    compatStoreSet.mockClear();

    const conflict = await service.patchFrameCameraMotion(
      identifiers.manuscriptId,
      identifiers.sceneId,
      identifiers.frameId,
      { cameraMotionTrack: track(2), expectedMotionRevision: 0 },
    );

    expect(conflict).toMatchObject({
      ok: false,
      error: "camera_motion_revision_conflict",
      currentCameraMotionTrack: track(),
      currentCameraMotionRevision: 1,
      currentCameraMotionStatus: "valid",
    });
    expect(compatStoreSet).not.toHaveBeenCalled();
    expect(persistedFrame()).toEqual(before);
  });

  it("protects the motion envelope from direct generic service callers", async () => {
    const { service, persistedFrame } = createHarness({
      cameraMotionTrack: track(),
      cameraMotionRevision: 4,
      cameraMotionUpdatedAt: "2026-08-29T08:00:00.000Z",
      cameraMotionFingerprint: "sha256:motion",
      cameraMotionBaseFramingFingerprint: "sha256:framing",
      cameraMotionStatus: "valid",
    });
    await service.patchFrame(
      identifiers.manuscriptId,
      identifiers.sceneId,
      identifiers.frameId,
      {
        frameStatus: "done",
        cameraMotionTrack: { version: 99, injected: true },
        cameraMotionRevision: 999,
        cameraMotionStatus: "valid",
      },
    );

    expect(persistedFrame()).toMatchObject({
      frameStatus: "done",
      cameraMotionTrack: track(),
      cameraMotionRevision: 4,
      cameraMotionFingerprint: "sha256:motion",
      cameraMotionStatus: "valid",
    });
  });

  it("marks a preserved track needsRebase when framing changes with source pixels", async () => {
    const { service, persistedFrame } = createHarness();
    const motion = await service.patchFrameCameraMotion(
      identifiers.manuscriptId,
      identifiers.sceneId,
      identifiers.frameId,
      { cameraMotionTrack: track(), expectedMotionRevision: 0 },
    );
    expect(motion?.ok).toBe(true);
    const frameWrite = await service.patchFrame(
      identifiers.manuscriptId,
      identifiers.sceneId,
      identifiers.frameId,
      {
        shotFraming: framing(0.6, 2),
        drawingData: { width: 2048 },
      },
    );

    expect(frameWrite).toMatchObject({
      sourceChanged: true,
      sourceChangeReason: "source-document-changed",
      cameraMotionRevision: 2,
      cameraMotionStatus: "needsRebase",
      aiPaintoverState: { videoStale: true },
    });
    expect(persistedFrame()).toMatchObject({
      cameraMotionTrack: track(),
      cameraMotionRevision: 2,
      cameraMotionStatus: "needsRebase",
      aiPaintoverState: { videoStale: true },
    });
  });

  it("shortens a valid track proportionally in the duration transaction", async () => {
    const { service, persistedFrame, initialUpdatedAt } = createHarness({
      cameraMotionTrack: track(2),
      cameraMotionRevision: 4,
      cameraMotionUpdatedAt: "2026-08-29T08:00:00.000Z",
      cameraMotionFingerprint: "sha256:previous",
      cameraMotionBaseFramingFingerprint: "sha256:framing",
      cameraMotionStatus: "valid",
    });
    const result = await service.patchFrameDuration(
      identifiers.manuscriptId,
      identifiers.sceneId,
      identifiers.frameId,
      {
        shotDuration: { value: 1, timescale: 1 },
        durationSec: 1,
        expectedDurationRevision: 1,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      changed: true,
      cameraMotionTrack: track(1),
      cameraMotionRevision: 5,
      cameraMotionStatus: "valid",
      sourceUpdatedAt: initialUpdatedAt,
      aiPaintoverState: { version: 1, videoStale: true },
    });
    expect(result?.ok && result.cameraMotionFingerprint).toMatch(
      /^sha256:[a-f0-9]{64}$/,
    );
    expect(persistedFrame()).toMatchObject({
      shotDuration: { value: 1, timescale: 1 },
      cameraMotionTrack: track(1),
      cameraMotionRevision: 5,
      cameraMotionStatus: "valid",
      sourceUpdatedAt: initialUpdatedAt,
      aiPaintoverState: { videoStale: true },
    });
    expect(persistedFrame()).not.toHaveProperty("aiOutputStale");
  });

  it("extends a valid track proportionally and preserves authored fields", async () => {
    const originalTrack = {
      ...track(),
      enabled: false,
      mode: "performed",
      presetId: "performed-pan",
    };
    const { service, persistedFrame } = createHarness({
      cameraMotionTrack: originalTrack,
      cameraMotionRevision: 8,
      cameraMotionUpdatedAt: "2026-08-29T08:00:00.000Z",
      cameraMotionFingerprint: "sha256:previous",
      cameraMotionBaseFramingFingerprint: "sha256:framing",
      cameraMotionStatus: "valid",
      aiPaintoverState: {
        version: 1,
        colorRevision: 2,
        atmosphereRevision: 3,
        atmosphereStale: false,
        videoStale: false,
        colorFingerprint: "sha256:color",
        atmosphereFingerprint: "sha256:atmosphere",
        colorHasContent: false,
        atmosphereHasContent: false,
      },
    });

    const result = await service.patchFrameDuration(
      identifiers.manuscriptId,
      identifiers.sceneId,
      identifiers.frameId,
      {
        shotDuration: { value: 4, timescale: 1 },
        durationSec: 4,
        expectedDurationRevision: 1,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      changed: true,
      cameraMotionTrack: {
        ...originalTrack,
        keyframes: [
          {
            ...originalTrack.keyframes[0],
            time: { value: 2, timescale: 1 },
          },
        ],
      },
      cameraMotionRevision: 9,
      cameraMotionBaseFramingFingerprint: "sha256:framing",
      cameraMotionStatus: "valid",
      aiPaintoverState: {
        version: 1,
        colorRevision: 2,
        atmosphereRevision: 3,
        videoStale: true,
      },
    });
    expect(persistedFrame().cameraMotionTrack.keyframes[0]).toMatchObject({
      id: "kf-1",
      time: { value: 2, timescale: 1 },
      pose: originalTrack.keyframes[0].pose,
      easingFromPrevious: originalTrack.keyframes[0].easingFromPrevious,
    });
  });

  it("retimes non-integer durations with an exact reduced rational", async () => {
    const { service, persistedFrame } = createHarness({
      shotDuration: { value: 3, timescale: 2 },
      duration: 1.5,
      durationSec: 1.5,
      cameraMotionTrack: track({ value: 1, timescale: 2 }),
      cameraMotionRevision: 2,
      cameraMotionUpdatedAt: "2026-08-29T08:00:00.000Z",
      cameraMotionFingerprint: "sha256:previous",
      cameraMotionBaseFramingFingerprint: "sha256:framing",
      cameraMotionStatus: "valid",
    });

    const result = await service.patchFrameDuration(
      identifiers.manuscriptId,
      identifiers.sceneId,
      identifiers.frameId,
      {
        shotDuration: { value: 5, timescale: 3 },
        durationSec: 5 / 3,
        expectedDurationRevision: 1,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      cameraMotionTrack: track({ value: 5, timescale: 9 }),
      cameraMotionRevision: 3,
      cameraMotionStatus: "valid",
    });
    expect(persistedFrame().cameraMotionTrack).toEqual(
      track({ value: 5, timescale: 9 }),
    );
  });

  it("returns the full unchanged motion sidecar for a duration no-op", async () => {
    const original = {
      cameraMotionTrack: track(),
      cameraMotionRevision: 4,
      cameraMotionUpdatedAt: "2026-08-29T08:00:00.000Z",
      cameraMotionFingerprint: "sha256:motion",
      cameraMotionBaseFramingFingerprint: "sha256:framing",
      cameraMotionStatus: "valid",
      aiPaintoverState: {
        version: 1,
        colorRevision: 2,
        atmosphereRevision: 3,
        atmosphereStale: false,
        videoStale: false,
        colorFingerprint: "sha256:color",
        atmosphereFingerprint: "sha256:atmosphere",
        colorHasContent: false,
        atmosphereHasContent: false,
      },
    };
    const { service, persistedFrame } = createHarness(original);
    const before = structuredClone(persistedFrame());

    const result = await service.patchFrameDuration(
      identifiers.manuscriptId,
      identifiers.sceneId,
      identifiers.frameId,
      {
        shotDuration: { value: 2, timescale: 1 },
        durationSec: 2,
        expectedDurationRevision: 1,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      changed: false,
      ...original,
    });
    expect(persistedFrame()).toEqual(before);
  });

  it.each([
    ["malformed", { version: 1, malformed: true }],
    ["future", { version: 2, spline: { tension: 0.4 } }],
  ])(
    "preserves a %s draft losslessly while duration revalidation marks it invalid",
    async (_label, rawTrack) => {
      const { service, persistedFrame } = createHarness({
        cameraMotionTrack: rawTrack,
        cameraMotionRevision: 6,
        cameraMotionUpdatedAt: "2026-08-29T08:00:00.000Z",
        cameraMotionFingerprint: "sha256:previous",
        cameraMotionBaseFramingFingerprint: "sha256:framing",
        cameraMotionStatus: "valid",
      });

      const result = await service.patchFrameDuration(
        identifiers.manuscriptId,
        identifiers.sceneId,
        identifiers.frameId,
        {
          shotDuration: { value: 4, timescale: 1 },
          durationSec: 4,
          expectedDurationRevision: 1,
        },
      );

      expect(result).toMatchObject({
        ok: true,
        cameraMotionTrack: rawTrack,
        cameraMotionRevision: 7,
        cameraMotionFingerprint: null,
        cameraMotionBaseFramingFingerprint: "sha256:framing",
        cameraMotionStatus: "invalid",
      });
      expect(persistedFrame().cameraMotionTrack).toEqual(rawTrack);
    },
  );
});

describe("casting camera-motion route contract", () => {
  it("returns the native success shape and mirrors sidecars without source invalidation", async () => {
    const pool = {
      query: vi.fn(async (_sql: string, _params: unknown[] = []) => ({
        rows: [],
        rowCount: 1,
      })),
    };
    const { routes, persistedFrame, initialUpdatedAt } = createHarness(
      {},
      {
        withRoutes: true,
        pool,
      },
    );
    const response = await routes!.dispatch(
      "patch",
      "/api/casting/frames/camera-motion",
      {
        ...identifiers,
        cameraMotionTrack: track(),
        expectedMotionRevision: 0,
      },
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      cameraMotionTrack: track(),
      cameraMotionRevision: 1,
      cameraMotionStatus: "valid",
      changed: true,
      sourceUpdatedAt: initialUpdatedAt,
      aiPaintoverState: { version: 1, videoStale: true },
    });
    expect(Object.keys(response.body).sort()).toEqual(
      [
        "aiPaintoverState",
        "cameraMotionBaseFramingFingerprint",
        "cameraMotionFingerprint",
        "cameraMotionRevision",
        "cameraMotionStatus",
        "cameraMotionTrack",
        "cameraMotionUpdatedAt",
        "changed",
        "sourceUpdatedAt",
        "updatedAt",
      ].sort(),
    );
    expect(persistedFrame()).not.toHaveProperty("aiOutputStale");
    const normalizedMirror = pool.query.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE casting_storyboards"),
    );
    expect(normalizedMirror).toBeDefined();
    const normalizedPatch = JSON.parse(
      String(normalizedMirror?.[1]?.[2] ?? "{}"),
    );
    expect(normalizedPatch).toMatchObject({
      cameraMotionRevision: 1,
      cameraMotionStatus: "valid",
      compatSourceUpdatedAt: initialUpdatedAt,
      aiPaintoverState: { videoStale: true },
    });
    expect(normalizedPatch).not.toHaveProperty("sourceRevision");
    expect(normalizedPatch).not.toHaveProperty("aiOutputStale");
  });

  it("returns the complete retimed motion sidecar from duration PATCH", async () => {
    const { routes, persistedFrame, initialUpdatedAt } = createHarness(
      {
        cameraMotionTrack: track(),
        cameraMotionRevision: 4,
        cameraMotionUpdatedAt: "2026-08-29T08:00:00.000Z",
        cameraMotionFingerprint: "sha256:previous",
        cameraMotionBaseFramingFingerprint: "sha256:framing",
        cameraMotionStatus: "valid",
      },
      { withRoutes: true },
    );

    const response = await routes!.dispatch(
      "patch",
      "/api/casting/frames/duration",
      {
        ...identifiers,
        shotDuration: { value: 4, timescale: 1 },
        durationSec: 4,
        expectedDurationRevision: 1,
      },
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      shotDuration: { value: 4, timescale: 1 },
      durationRevision: 2,
      changed: true,
      cameraMotionTrack: track(2),
      cameraMotionRevision: 5,
      cameraMotionBaseFramingFingerprint: "sha256:framing",
      cameraMotionStatus: "valid",
      sourceUpdatedAt: initialUpdatedAt,
      aiPaintoverState: { version: 1, videoStale: true },
    });
    expect(response.body.cameraMotionUpdatedAt).toEqual(expect.any(String));
    expect(response.body.cameraMotionFingerprint).toMatch(
      /^sha256:[a-f0-9]{64}$/,
    );
    expect(persistedFrame()).toMatchObject({
      cameraMotionTrack: track(2),
      cameraMotionRevision: 5,
      cameraMotionStatus: "valid",
      sourceUpdatedAt: initialUpdatedAt,
      aiPaintoverState: { videoStale: true },
    });

    const noOp = await routes!.dispatch(
      "patch",
      "/api/casting/frames/duration",
      {
        ...identifiers,
        shotDuration: { value: 4, timescale: 1 },
        durationSec: 4,
        expectedDurationRevision: 2,
      },
    );
    expect(noOp.statusCode).toBe(200);
    expect(noOp.body).toMatchObject({
      changed: false,
      cameraMotionTrack: track(2),
      cameraMotionRevision: 5,
      aiPaintoverState: response.body.aiPaintoverState,
      sourceUpdatedAt: initialUpdatedAt,
    });
  });

  it("returns the standardized 409 shape and rejects generic bypasses", async () => {
    const { routes, compatStoreSet } = createHarness(
      {
        cameraMotionTrack: track(),
        cameraMotionRevision: 3,
        cameraMotionUpdatedAt: "2026-08-29T08:00:00.000Z",
        cameraMotionFingerprint: "sha256:motion",
        cameraMotionBaseFramingFingerprint: "sha256:framing",
        cameraMotionStatus: "valid",
      },
      { withRoutes: true },
    );
    const conflict = await routes!.dispatch(
      "patch",
      "/api/casting/frames/camera-motion",
      {
        ...identifiers,
        cameraMotionTrack: null,
        expectedMotionRevision: 2,
      },
    );
    expect(conflict.statusCode).toBe(409);
    expect(conflict.body).toEqual({
      error: "camera_motion_revision_conflict",
      currentCameraMotionTrack: track(),
      currentCameraMotionRevision: 3,
      currentCameraMotionUpdatedAt: "2026-08-29T08:00:00.000Z",
      currentCameraMotionFingerprint: "sha256:motion",
      currentCameraMotionBaseFramingFingerprint: "sha256:framing",
      currentCameraMotionStatus: "valid",
    });
    expect(compatStoreSet).not.toHaveBeenCalled();

    const genericTrack = await routes!.dispatch(
      "patch",
      "/api/casting/frames",
      {
        ...identifiers,
        fields: { cameraMotionTrack: null, expectedMotionRevision: 3 },
      },
    );
    expect(genericTrack.statusCode).toBe(400);
    expect(genericTrack.body).toEqual({
      error: "camera_motion_requires_dedicated_patch",
    });

    const genericRevision = await routes!.dispatch(
      "patch",
      "/api/casting/frames",
      { ...identifiers, fields: { cameraMotionRevision: 999 } },
    );
    expect(genericRevision.statusCode).toBe(400);
    expect(genericRevision.body).toEqual({
      error: "camera_motion_revision_server_owned",
    });
  });

  it("preserves opaque future raw data through whole-scene writes", async () => {
    const future = { version: 2, spline: { tension: 0.4 }, vendor: "future" };
    const { routes, persistedFrame } = createHarness(
      {
        cameraMotionTrack: future,
        cameraMotionRevision: 7,
        cameraMotionUpdatedAt: "2026-08-29T08:00:00.000Z",
        cameraMotionFingerprint: "sha256:future",
        cameraMotionBaseFramingFingerprint: "sha256:framing",
        cameraMotionStatus: "invalid",
      },
      { withRoutes: true },
    );
    const response = await routes!.dispatch("post", "/api/casting/scenes", {
      id: "scene-1",
      manuscriptId: "manuscript-1",
      projectId: "project-1",
      storyboardFrames: [
        {
          id: "frame-1",
          frameStatus: "done",
          drawingData: { strokes: "[]", width: 1920, height: 1080 },
          cameraMotionTrack: null,
          cameraMotionRevision: 0,
          cameraMotionStatus: "valid",
        },
        {
          id: "frame-2",
          drawingData: { strokes: "[]" },
          cameraMotionTrack: { version: 99, injected: true },
          cameraMotionRevision: 99,
        },
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.storyboardFrames[0]).toMatchObject({
      cameraMotionTrack: future,
      cameraMotionRevision: 7,
      cameraMotionStatus: "invalid",
      frameStatus: "done",
    });
    expect(response.body.storyboardFrames[1]).not.toHaveProperty(
      "cameraMotionTrack",
    );
    expect(response.body.storyboardFrames[1]).not.toHaveProperty(
      "cameraMotionRevision",
    );
    expect(persistedFrame()).toMatchObject({
      cameraMotionTrack: future,
      cameraMotionRevision: 7,
      cameraMotionStatus: "invalid",
    });

    const upgrade = await routes!.dispatch(
      "patch",
      "/api/casting/frames/camera-motion",
      {
        ...identifiers,
        cameraMotionTrack: null,
        expectedMotionRevision: 7,
      },
    );
    expect(upgrade.statusCode).toBe(409);
    expect(upgrade.body).toMatchObject({
      error: "camera_motion_upgrade_required",
      currentCameraMotionTrack: future,
      currentCameraMotionRevision: 7,
      currentCameraMotionStatus: "invalid",
    });
  });

  it("rebases preserved motion on a whole-scene framing change", async () => {
    const { routes, persistedFrame } = createHarness(
      {
        cameraMotionTrack: track(),
        cameraMotionRevision: 4,
        cameraMotionUpdatedAt: "2026-08-29T08:00:00.000Z",
        cameraMotionFingerprint: "sha256:motion",
        cameraMotionBaseFramingFingerprint: "sha256:framing",
        cameraMotionStatus: "valid",
      },
      { withRoutes: true },
    );
    const response = await routes!.dispatch("post", "/api/casting/scenes", {
      id: "scene-1",
      manuscriptId: "manuscript-1",
      projectId: "project-1",
      storyboardFrames: [
        {
          id: "frame-1",
          drawingData: { strokes: "[]", width: 1920, height: 1080 },
          shotFraming: framing(0.7, 2),
          cameraMotionTrack: null,
          cameraMotionRevision: 0,
        },
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.storyboardFrames[0]).toMatchObject({
      cameraMotionTrack: track(),
      cameraMotionRevision: 5,
      cameraMotionStatus: "needsRebase",
      aiPaintoverState: { videoStale: true },
    });
    expect(persistedFrame()).toMatchObject({
      cameraMotionTrack: track(),
      cameraMotionRevision: 5,
      cameraMotionStatus: "needsRebase",
      aiPaintoverState: { videoStale: true },
    });
  });

  it("revalidates preserved motion when whole-scene compatibility initializes a changed duration", async () => {
    const { routes, persistedFrame, initialUpdatedAt } = createHarness(
      {
        cameraMotionTrack: track(2),
        cameraMotionRevision: 4,
        cameraMotionUpdatedAt: "2026-08-29T08:00:00.000Z",
        cameraMotionFingerprint: "sha256:motion",
        cameraMotionBaseFramingFingerprint: "sha256:framing",
        cameraMotionStatus: "valid",
      },
      { withRoutes: true },
    );
    // Simulate a pre-canonical legacy frame whose effective duration was 2s.
    delete persistedFrame().shotDuration;
    delete persistedFrame().durationRevision;

    const response = await routes!.dispatch("post", "/api/casting/scenes", {
      id: "scene-1",
      manuscriptId: "manuscript-1",
      projectId: "project-1",
      storyboardFrames: [
        {
          id: "frame-1",
          drawingData: { strokes: "[]", width: 1920, height: 1080 },
          shotDuration: { value: 1, timescale: 1 },
          duration: 1,
          durationSec: 1,
          expectedDurationRevision: 0,
        },
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.storyboardFrames[0]).toMatchObject({
      shotDuration: { value: 1, timescale: 1 },
      durationRevision: 1,
      cameraMotionTrack: track(1),
      cameraMotionRevision: 5,
      cameraMotionStatus: "valid",
      cameraMotionFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      sourceUpdatedAt: initialUpdatedAt,
      aiPaintoverState: { videoStale: true },
    });
    expect(persistedFrame()).toMatchObject({
      cameraMotionTrack: track(1),
      cameraMotionRevision: 5,
      cameraMotionStatus: "valid",
      sourceUpdatedAt: initialUpdatedAt,
    });
  });
});
