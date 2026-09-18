import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  put: vi.fn(async () => true),
}));

vi.mock("./creatorhub-object-storage.js", () => ({
  getCreatorHubObjectStorage: () => ({
    client: { send: vi.fn() },
    bucket: "creatorhub-private",
    region: "eu-north-1",
    provider: "aws_s3",
    authentication: "creatorhub_access_key",
  }),
  putCreatorHubObject: (...args: unknown[]) => storageMocks.put(...args),
}));

import {
  createPhotoEnhancerRouter,
  enqueuePhotoEnhancerJobFromBuffer,
} from "./photo-enhancer-routes.js";

describe("Capture Photo Enhancer CreatorHub storage", () => {
  beforeEach(() => storageMocks.put.mockClear());

  it("archives queued Capture inputs in the project-scoped CreatorHub bucket", async () => {
    const app = express();
    app.use(express.json());
    app.use(createPhotoEnhancerRouter(undefined, {
      getActiveSessionFromRequest: () => ({ userId: "owner-1" }),
    }));
    await request(app).post("/queue/pause").expect(200);

    const jobId = await enqueuePhotoEnhancerJobFromBuffer({
      buffer: Buffer.from("image"),
      fileName: "IMG_0001.CR3",
      mimeType: "image/x-canon-cr3",
      projectId: "project-1",
      owner: "owner-1",
      userId: "owner-1",
      preset: "auto",
    });

    expect(jobId).toBeTruthy();
    expect(storageMocks.put).toHaveBeenCalledTimes(1);
    expect(storageMocks.put.mock.calls[0][0]).toMatch(
      /^organizations\/personal-owner-1\/users\/owner-1\/projects\/project-1\/photo-room\/enhancer\/sources\//,
    );
    const jobs = await request(app).get("/jobs?projectId=project-1").expect(200);
    expect(jobs.body.jobs[0].source).toMatchObject({
      bucket: "creatorhub-private",
      storage: "creatorhub_s3",
    });
  });

  it("retires the former Role Room B2 upload surface", async () => {
    const app = express();
    app.use(express.json());
    app.use(createPhotoEnhancerRouter());
    const response = await request(app).post("/uploads/b2-presign").send({
      fileName: "IMG_0001.CR3",
      projectId: "project-1",
    }).expect(410);
    expect(response.body.replacement).toBe("/api/photo-enhancer/uploads/creatorhub-presign");
  });

  it("does not accept a CreatorHub source without a real user session", async () => {
    const app = express();
    app.use(express.json());
    app.use(createPhotoEnhancerRouter());
    await request(app).post("/jobs").send({
      projectId: "project-1",
      source: {
        storage: "creatorhub_s3",
        bucket: "creatorhub-private",
        key: "organizations/personal-owner-1/users/owner-1/projects/project-1/photo-room/enhancer/sources/source/original.cr3",
        fileName: "IMG_0001.CR3",
        mimeType: "image/x-canon-cr3",
        size: 1_024,
      },
    }).expect(401, { success: false, error: "auth_required" });
  });

  it("does not expose queued Capture jobs without a real user session", async () => {
    const app = express();
    app.use(express.json());
    app.use(createPhotoEnhancerRouter());
    await request(app).get("/jobs?projectId=project-1")
      .expect(401, { success: false, error: "auth_required" });
  });
});
