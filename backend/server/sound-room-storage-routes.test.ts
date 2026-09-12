import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const storageMocks = vi.hoisted(() => ({
  initiate: vi.fn(),
  resume: vi.fn(),
  status: vi.fn(),
  stream: vi.fn(),
}));

vi.mock("./sound-room-storage-service.js", async () => {
  const actual = await vi.importActual<typeof import("./sound-room-storage-service.js")>("./sound-room-storage-service.js");
  return {
    ...actual,
    initiateSoundRoomUpload: storageMocks.initiate,
    resumeSoundRoomUpload: storageMocks.resume,
    getSoundRoomUploadStatus: storageMocks.status,
    getSoundRoomObjectStream: storageMocks.stream,
  };
});
vi.mock("./sound-room-audio-processing.js", () => ({ processSoundRoomAudioVersion: vi.fn() }));

import { setupSoundRoomStorageRoutes, validatedSoundRoomRange } from "./sound-room-storage-routes.js";

const versionObject = {
  project_id: "11111111-1111-4111-8111-111111111111",
  owner_user_id: "user-1",
  object_id: "22222222-2222-4222-8222-222222222222",
  object_key: "users/hash/sound-room/project/object/original.wav",
  content_type: "audio/wav",
  display_name: "mix.wav",
  size_bytes: "4",
};

function createPool() {
  return {
    query: vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM audio_review_projects") && sql.includes("owner_user_id")) return { rows: [{ 1: 1 }], rowCount: 1 };
      if (sql.includes("FROM audio_review_members member")) {
        return params[0] === "inv_valid" ? { rows: [{ project_id: versionObject.project_id, owner_user_id: "user-1" }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM audio_review_versions version") && sql.includes("object_row.object_key")) return { rows: [versionObject], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }),
  };
}

function buildApp() {
  const app = express();
  const pool = createPool();
  app.use(express.json());
  setupSoundRoomStorageRoutes({
    app,
    pool: pool as any,
    requireUserSession: () => ({ userId: "user-1", email: "owner@example.test", name: "Owner", role: "member" }),
  });
  return { app, pool };
}

describe("Sound Room private storage contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.initiate.mockResolvedValue({ objectId: "object-1", strategy: "multipart", uploadId: "upload-1" });
    storageMocks.resume.mockResolvedValue({ objectId: "object-1", strategy: "multipart", uploadId: "upload-1", partSize: 16 });
    storageMocks.status.mockResolvedValue({ status: "pending", strategy: "multipart", uploadedParts: [{ partNumber: 1, etag: "etag-1" }] });
    storageMocks.stream.mockResolvedValue({
      Body: Readable.from(Buffer.from("data")), ContentType: "audio/wav", ContentLength: 4,
      ContentRange: "bytes 0-3/4", ETag: "etag-1",
    });
  });

  it("uses the browser channel in the same checksum-aware upload service", async () => {
    const { app } = buildApp();
    const response = await request(app).post(`/api/audio-showcases/${versionObject.project_id}/storage/initiate`).send({
      fileName: "mix.wav", sizeBytes: 123, contentType: "audio/wav", checksumSha256: "a".repeat(64),
    });
    expect(response.status).toBe(201);
    expect(storageMocks.initiate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      channel: "browser", projectId: versionObject.project_id, checksumSha256: "a".repeat(64),
    }));
  });

  it("restores a multipart upload with already persisted S3 parts", async () => {
    const { app } = buildApp();
    const resumed = await request(app).post("/api/audio-storage/object-1/resume");
    const status = await request(app).get("/api/audio-storage/object-1/status");
    expect(resumed.status).toBe(200);
    expect(resumed.body).toMatchObject({ strategy: "multipart", uploadId: "upload-1" });
    expect(status.body.uploadedParts).toEqual([{ partNumber: 1, etag: "etag-1" }]);
  });

  it("accepts one RFC-style byte range and rejects multi-range requests", () => {
    expect(validatedSoundRoomRange("bytes=100-199")).toBe("bytes=100-199");
    expect(validatedSoundRoomRange("bytes=-256")).toBe("bytes=-256");
    expect(validatedSoundRoomRange("bytes=0-1,4-5")).toBe(false);
    expect(validatedSoundRoomRange("items=0-1")).toBe(false);
  });

  it("keeps playback private and forwards Range to S3", async () => {
    const { app } = buildApp();
    const response = await request(app).get("/api/audio-versions/33333333-3333-4333-8333-333333333333/media").set("Range", "bytes=0-3");
    expect(response.status).toBe(206);
    expect(response.headers["accept-ranges"]).toBe("bytes");
    expect(response.headers["content-range"]).toBe("bytes 0-3/4");
    expect(Buffer.from(response.body).toString("utf8")).toBe("data");
    expect(storageMocks.stream).toHaveBeenCalledWith(versionObject.object_key, "bytes=0-3");
  });

  it("requires a valid, version-scoped invite token for shared playback", async () => {
    const { app } = buildApp();
    const denied = await request(app).get("/api/audio-review-shared/inv_invalid/versions/33333333-3333-4333-8333-333333333333/media");
    expect(denied.status).toBe(404);
    const allowed = await request(app).get("/api/audio-review-shared/inv_valid/versions/33333333-3333-4333-8333-333333333333/media").set("Range", "bytes=0-3");
    expect(allowed.status).toBe(206);
    expect(Buffer.from(allowed.body).toString("utf8")).toBe("data");
  });
});
