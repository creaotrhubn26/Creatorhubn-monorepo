import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { setupCastingManuscriptsRoutes } from "./casting-manuscripts-routes.js";
import { createCastingManuscriptsService } from "./casting-manuscripts-service.js";

function buildApp(frameFields: Record<string, unknown> = {}) {
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
  const compatStoreGet = async <T>(key: string): Promise<T | null> =>
    structuredClone(store.get(key) as T) ?? null;
  const compatStoreSet = vi.fn(async (key: string, value: unknown) => {
    store.set(key, structuredClone(value));
  });
  const manuscriptsService = createCastingManuscriptsService({
    compatStoreGet,
    compatStoreSet,
    compatStoreSetStrict: compatStoreSet,
    compatStoreDelete: async (key: string) => {
      store.delete(key);
    },
    compatStoreListByPrefix: async () => [],
  });
  const app = express();
  app.use(express.json());
  setupCastingManuscriptsRoutes({
    app,
    requireUserSession: () => ({ userId: "user-1" }),
    compatStoreGet,
    manuscriptsService,
    revisionsService: {} as any,
  });
  const persistedFrame = () =>
    (store.get("casting:scenes:manuscript-1") as any[])[0].storyboardFrames[0];
  const persistedManuscript = () =>
    store.get("casting:manuscript:manuscript-1") as Record<string, unknown>;
  return { app, compatStoreSet, persistedFrame, persistedManuscript };
}

const identifiers = {
  manuscriptId: "manuscript-1",
  sceneId: "scene-1",
  frameId: "frame-1",
};

describe("casting frame duration route contract", () => {
  it("returns 409 duration_mismatch without mutating the frame", async () => {
    const { app, compatStoreSet, persistedFrame } = buildApp({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 3,
      duration: 2,
      durationSec: 2,
    });
    const before = structuredClone(persistedFrame());

    const response = await request(app)
      .patch("/api/casting/frames/duration")
      .send({
        ...identifiers,
        shotDuration: { value: 3, timescale: 1 },
        duration: 4,
        expectedDurationRevision: 3,
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "duration_mismatch" });
    expect(compatStoreSet).not.toHaveBeenCalled();
    expect(persistedFrame()).toEqual(before);
  });

  it("returns 409 client_upgrade_required for a changed legacy frame PATCH", async () => {
    const { app, compatStoreSet, persistedFrame } = buildApp({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 5,
      duration: 2,
      durationSec: 2,
    });
    const before = structuredClone(persistedFrame());

    const response = await request(app)
      .patch("/api/casting/frames")
      .send({ ...identifiers, fields: { duration: 3 } });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "client_upgrade_required",
      currentShotDuration: { value: 2, timescale: 1 },
      currentDurationRevision: 5,
    });
    expect(compatStoreSet).not.toHaveBeenCalled();
    expect(persistedFrame()).toEqual(before);
  });

  it("initializes a legacy project through the compatibility frame PATCH", async () => {
    const { app, persistedFrame, persistedManuscript } = buildApp({
      duration: 2,
    });

    const response = await request(app)
      .patch("/api/casting/frames")
      .send({ ...identifiers, fields: { duration: 2.5 } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      shotDuration: { value: 5, timescale: 2 },
      durationRevision: 1,
      duration: 2.5,
      durationSec: 2.5,
      changed: true,
    });
    expect(persistedFrame()).toMatchObject({
      shotDuration: { value: 5, timescale: 2 },
      durationRevision: 1,
      duration: 2.5,
      durationSec: 2.5,
    });
    expect(persistedManuscript()).toMatchObject({
      storyboardTiming: {
        version: 1,
        projectFrameRate: { value: 25, timescale: 1 },
        timelineTimescale: 600,
      },
    });
  });

  it("atomically dual-writes canonical duration and reports stale OCC", async () => {
    const { app, persistedFrame } = buildApp({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 1,
      duration: 2,
      durationSec: 2,
    });

    const accepted = await request(app)
      .patch("/api/casting/frames/duration")
      .send({
        ...identifiers,
        shotDuration: { value: 72, timescale: 24 },
        durationSec: 3,
        expectedDurationRevision: 1,
      });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({
      shotDuration: { value: 3, timescale: 1 },
      durationRevision: 2,
      duration: 3,
      durationSec: 3,
    });

    const stale = await request(app)
      .patch("/api/casting/frames/duration")
      .send({
        ...identifiers,
        shotDuration: { value: 4, timescale: 1 },
        duration: 4,
        expectedDurationRevision: 1,
      });
    expect(stale.status).toBe(409);
    expect(stale.body).toEqual({
      error: "duration_revision_conflict",
      currentShotDuration: { value: 3, timescale: 1 },
      currentDurationRevision: 2,
    });
    expect(persistedFrame()).toMatchObject({
      shotDuration: { value: 3, timescale: 1 },
      durationRevision: 2,
      duration: 3,
      durationSec: 3,
    });
  });

  it("rejects mixed generic metadata and duration writes", async () => {
    const { app, compatStoreSet } = buildApp();
    const response = await request(app)
      .patch("/api/casting/frames")
      .send({
        ...identifiers,
        fields: { duration: 2, frameStatus: "done" },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "duration_requires_dedicated_patch",
    });
    expect(compatStoreSet).not.toHaveBeenCalled();
  });

  it("prevents a whole-scene legacy save from clobbering canonical duration", async () => {
    const { app, compatStoreSet, persistedFrame } = buildApp({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 4,
      duration: 2,
      durationSec: 2,
    });
    const before = structuredClone(persistedFrame());

    const response = await request(app)
      .post("/api/casting/scenes")
      .send({
        id: "scene-1",
        manuscriptId: "manuscript-1",
        projectId: "project-1",
        storyboardFrames: [
          {
            id: "frame-1",
            duration: 3,
            drawingData: { strokes: "[]" },
          },
        ],
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "client_upgrade_required",
      currentShotDuration: { value: 2, timescale: 1 },
      currentDurationRevision: 4,
    });
    expect(compatStoreSet).not.toHaveBeenCalled();
    expect(persistedFrame()).toEqual(before);
  });

  it("preserves canonical duration through a metadata-only whole-scene save", async () => {
    const { app, persistedFrame } = buildApp({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 4,
      duration: 2,
      durationSec: 2,
    });

    const response = await request(app)
      .post("/api/casting/scenes")
      .send({
        id: "scene-1",
        manuscriptId: "manuscript-1",
        projectId: "project-1",
        heading: "Metadata update",
        storyboardFrames: [
          {
            id: "frame-1",
            frameStatus: "done",
            drawingData: { strokes: "[]" },
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.storyboardFrames[0]).toMatchObject({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 4,
      duration: 2,
      durationSec: 2,
      frameStatus: "done",
    });
    expect(persistedFrame()).toMatchObject({
      shotDuration: { value: 2, timescale: 1 },
      durationRevision: 4,
      duration: 2,
      durationSec: 2,
      frameStatus: "done",
    });
  });
});
