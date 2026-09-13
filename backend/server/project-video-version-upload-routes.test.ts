import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupProjectWorkspaceRoutes } from "./project-workspace-routes.js";
import {
  createDirectStreamTusUpload,
  deleteStreamVideo,
  getStreamVideoStatus,
} from "./cloudflare-stream-service.js";
import { isDeviceRevoked } from "./post-agent-storage.js";
import {
  completeVideoRoomUpload,
  getVideoRoomUploadStatus,
  initiateVideoRoomUpload,
  resumeVideoRoomUpload,
  signVideoRoomUploadParts,
} from "./sound-room-storage-service.js";

vi.mock("./project-team-routes.js", () => ({
  canAccessProject: vi.fn(async () => true),
  canEditProject: vi.fn(async () => true),
  getProjectAccess: vi.fn(async () => ({ canRead: true, canEdit: true })),
}));

vi.mock("./post-agent-storage.js", () => ({
  isDeviceRevoked: vi.fn(async () => false),
}));

vi.mock("./cloudflare-stream-service.js", () => ({
  createDirectStreamTusUpload: vi.fn(),
  deleteStreamVideo: vi.fn(async () => undefined),
  getStreamVideoStatus: vi.fn(),
  importStreamFromUrl: vi.fn(),
  isStreamEnabled: vi.fn(() => true),
  signStreamPlaybackUrl: vi.fn(async (uid: string) => `https://signed.example/${uid}/manifest.m3u8`),
  signStreamThumbnailUrl: vi.fn(async (uid: string) => `https://signed.example/${uid}/thumbnail.jpg`),
  uploadToStream: vi.fn(),
}));

vi.mock("./sound-room-storage-service.js", () => ({
  abortVideoRoomUpload: vi.fn(async () => true),
  completeVideoRoomUpload: vi.fn(),
  deleteCreatorHubMediaObject: vi.fn(async () => true),
  getVideoRoomUploadStatus: vi.fn(),
  initiateVideoRoomUpload: vi.fn(),
  readOwnedVideoRoomObject: vi.fn(),
  resumeVideoRoomUpload: vi.fn(),
  signVideoRoomUploadParts: vi.fn(),
}));

const session = {
  userId: "editor-1",
  email: "editor@example.test",
  name: "Editor",
  role: "user",
  device: "post-agent",
};

function createUploadApp(options: {
  requireUserSession?: () => typeof session | null;
  resolveUserSession?: () => Promise<typeof session | null>;
} = {}) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  let pending: any = null;
  const query = vi.fn(async (statement: string, params: unknown[] = []) => {
    const sql = String(statement);
    queries.push({ sql, params });
    if (sql.includes("SELECT 1 FROM projects WHERE id=$1 AND user_id=$2")) {
      return { rows: [{ ok: 1 }], rowCount: 1 };
    }
    if (sql.includes("COALESCE(MAX(version_number),0)+1")) {
      return { rows: [{ n: 2 }], rowCount: 1 };
    }
    if (sql.includes("AS storage_owner_user_id") && !sql.includes("JOIN project_video_versions")) {
      return { rows: [{ storage_owner_user_id: "owner-1" }], rowCount: 1 };
    }
    if (sql.includes("AS storage_owner_user_id") && sql.includes("JOIN project_video_versions")) {
      return { rows: pending ? [{ ...pending, storage_owner_user_id: "owner-1" }] : [], rowCount: pending ? 1 : 0 };
    }
    if (sql.includes("INSERT INTO project_video_versions") && sql.includes("storage_object_id")) {
      pending = {
        id: params[0],
        project_id: params[1],
        version_label: params[2],
        version_number: params[3],
        storage_object_id: params[4],
        content_type: params[5],
        size_bytes: params[6],
        status: "uploading",
        uploaded_by: params[7],
        stream_ready: false,
        stream_state: "object_pending",
      };
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO project_video_versions") && sql.includes("'uploading'")) {
      pending = {
        id: params[0],
        project_id: params[1],
        version_label: params[2],
        version_number: params[3],
        stream_uid: params[4],
        content_type: params[5],
        size_bytes: params[6],
        status: "uploading",
        uploaded_by: params[7],
        stream_ready: false,
        stream_state: "pendingupload",
      };
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("SELECT id,stream_uid,size_bytes,content_type,status,stream_ready")) {
      return { rows: pending ? [pending] : [], rowCount: pending ? 1 : 0 };
    }
    if (sql.includes("SELECT * FROM project_video_versions WHERE id=$1")) {
      return { rows: pending ? [pending] : [], rowCount: pending ? 1 : 0 };
    }
    if (sql.includes("SET stream_uid=$4")) {
      pending = { ...pending, stream_uid: params[3], stream_state: "pendingupload" };
      return { rows: [{ id: pending.id }], rowCount: 1 };
    }
    if (sql.includes("SET status='under_review',stream_ready=true")) {
      pending = { ...pending, status: "under_review", stream_ready: true, stream_state: "ready" };
      return { rows: [{ id: pending.id }], rowCount: 1 };
    }
    if (sql.includes("SET status=CASE WHEN id=$1")) {
      pending.status = "under_review";
      return {
        rows: [
          { id: pending.id, status: "under_review" },
          { id: "version-1", status: "superseded" },
        ],
        rowCount: 2,
      };
    }
    return { rows: [], rowCount: 0 };
  });
  const app = express();
  app.use(express.json());
  const requireUserSession = vi.fn(options.requireUserSession || (() => null));
  const resolveUserSession = vi.fn(options.resolveUserSession || (async () => session));
  setupProjectWorkspaceRoutes({
    app,
    pool: {
      query,
      connect: vi.fn(async () => ({ query, release: vi.fn() })),
    } as never,
    requireUserSession,
    resolveUserSession,
  });
  return { app, queries, pending: () => pending, requireUserSession, resolveUserSession };
}

describe("Video Room direct upload lifecycle", () => {
  beforeEach(() => {
    vi.mocked(createDirectStreamTusUpload).mockReset();
    vi.mocked(deleteStreamVideo).mockClear();
    vi.mocked(getStreamVideoStatus).mockReset();
    vi.mocked(initiateVideoRoomUpload).mockReset();
    vi.mocked(completeVideoRoomUpload).mockReset();
    vi.mocked(getVideoRoomUploadStatus).mockReset();
    vi.mocked(resumeVideoRoomUpload).mockReset();
    vi.mocked(signVideoRoomUploadParts).mockReset();
    vi.mocked(isDeviceRevoked).mockResolvedValue(false);
  });

  it("keeps browser requests on the existing session guard instead of the desktop resolver", async () => {
    vi.mocked(createDirectStreamTusUpload).mockResolvedValue({
      uid: "stream-browser",
      uploadUrl: "https://upload.videodelivery.net/tus-browser",
      protocol: "tus",
      chunkSize: 50 * 1024 * 1024,
      expiresAt: "2026-09-14T12:00:00.000Z",
    });
    const state = createUploadApp({ requireUserSession: () => ({ ...session, device: undefined }) });

    const response = await request(state.app)
      .post("/api/projects/project-1/video-versions/tus")
      .set("X-Session-Token", "browser-token")
      .send({ fileName: "browser.mp4", sizeBytes: 1024 });

    expect(response.status).toBe(201);
    expect(state.requireUserSession).toHaveBeenCalledOnce();
    expect(state.resolveUserSession).not.toHaveBeenCalled();
  });

  it("rejects a revoked paired Premiere token before provisioning Stream", async () => {
    vi.mocked(isDeviceRevoked).mockResolvedValue(true);
    const state = createUploadApp();

    const response = await request(state.app)
      .post("/api/projects/project-1/video-versions/tus")
      .set("Authorization", "Bearer revoked-paired-token")
      .send({ fileName: "blocked.mp4", sizeBytes: 1024 });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "post_agent_token_revoked" });
    expect(createDirectStreamTusUpload).not.toHaveBeenCalled();
  });

  it("returns a stable unavailable response when Stream storage capacity is exhausted", async () => {
    vi.mocked(createDirectStreamTusUpload).mockRejectedValue(Object.assign(
      new Error("cloudflare_stream_capacity_exceeded"),
      { code: "cloudflare_stream_capacity_exceeded", providerStatus: 413 },
    ));
    const state = createUploadApp();

    const response = await request(state.app)
      .post("/api/projects/project-1/video-versions/tus")
      .set("Authorization", "Bearer paired-token")
      .send({ fileName: "Premiere-E2E.mp4", sizeBytes: 1024 });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "cloudflare_stream_capacity_exceeded" });
    expect(state.pending()).toBeNull();
  });

  it("falls back to private object storage when Stream has no capacity", async () => {
    vi.mocked(createDirectStreamTusUpload).mockRejectedValue(Object.assign(
      new Error("cloudflare_stream_capacity_exceeded"),
      { code: "cloudflare_stream_capacity_exceeded", providerStatus: 413 },
    ));
    vi.mocked(initiateVideoRoomUpload).mockResolvedValue({
      objectId: "object-1",
      strategy: "multipart",
      uploadId: "upload-1",
      partSize: 16 * 1024 * 1024,
      partCount: 1,
      expiresInSeconds: 3600,
    });
    const state = createUploadApp();

    const response = await request(state.app)
      .post("/api/projects/project-1/video-versions/tus")
      .set("Authorization", "Bearer paired-token")
      .send({
        fileName: "Premiere-E2E.mp4",
        sizeBytes: 1024,
        contentType: "video/mp4",
        checksumSha256: "a".repeat(64),
        versionLabel: "V2",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      provider: "object_storage",
      protocol: "s3-multipart",
      objectId: "object-1",
      versionNumber: 2,
    });
    expect(initiateVideoRoomUpload).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "owner-1",
        createdByUserId: "editor-1",
        checksumSha256: "a".repeat(64),
        channel: "premiere",
        forceMultipart: true,
      }),
    );
    expect(state.pending()).toMatchObject({
      storage_object_id: "object-1",
      status: "uploading",
      stream_state: "object_pending",
    });
    expect(state.queries.some(({ sql }) => sql.includes("SET status='superseded'"))).toBe(false);
  });

  it("activates an object-backed cut only after S3 verification completes", async () => {
    vi.mocked(createDirectStreamTusUpload).mockRejectedValue(Object.assign(
      new Error("cloudflare_stream_capacity_exceeded"),
      { code: "cloudflare_stream_capacity_exceeded", providerStatus: 413 },
    ));
    vi.mocked(initiateVideoRoomUpload).mockResolvedValue({
      objectId: "object-1",
      strategy: "single",
      uploadUrl: "https://role-room.s3.eu-north-1.amazonaws.com/video?signature=opaque",
      requiredHeaders: { "content-type": "video/mp4", "x-amz-checksum-sha256": "opaque" },
      expiresInSeconds: 3600,
    });
    vi.mocked(completeVideoRoomUpload).mockResolvedValue({ id: "object-1" } as never);
    const state = createUploadApp();
    const created = await request(state.app)
      .post("/api/projects/project-1/video-versions/tus")
      .set("Authorization", "Bearer paired-token")
      .send({
        fileName: "Premiere-E2E.mp4",
        sizeBytes: 1024,
        contentType: "video/mp4",
        checksumSha256: "a".repeat(64),
      });

    expect(state.pending()).toMatchObject({ status: "uploading", stream_ready: false });
    const completed = await request(state.app)
      .post(`/api/projects/project-1/video-versions/${created.body.versionId}/object-complete`)
      .set("Authorization", "Bearer paired-token")
      .send({ parts: [] });

    expect(completed.status).toBe(200);
    expect(completed.body).toMatchObject({ ready: true, status: "under_review" });
    expect(completeVideoRoomUpload).toHaveBeenCalledWith(expect.anything(), {
      objectId: "object-1",
      userId: "owner-1",
      parts: [],
    });
    expect(state.pending()).toMatchObject({ status: "under_review", stream_ready: true });
    expect(state.queries.some(({ sql }) =>
      sql.includes("SET status='superseded'") && sql.includes("id<>$2"),
    )).toBe(true);
  });

  it("resumes multipart from S3's authoritative part list", async () => {
    vi.mocked(createDirectStreamTusUpload).mockRejectedValue(Object.assign(
      new Error("cloudflare_stream_capacity_exceeded"),
      { code: "cloudflare_stream_capacity_exceeded", providerStatus: 413 },
    ));
    vi.mocked(initiateVideoRoomUpload).mockResolvedValue({
      objectId: "object-1",
      strategy: "multipart",
      uploadId: "upload-1",
      partSize: 16 * 1024 * 1024,
      partCount: 2,
      expiresInSeconds: 3600,
    });
    vi.mocked(getVideoRoomUploadStatus).mockResolvedValue({
      status: "pending",
      strategy: "multipart",
      uploadedParts: [{ partNumber: 1, etag: '"etag-1"', checksumSha256: "b".repeat(64), sizeBytes: 16 * 1024 * 1024 }],
    });
    vi.mocked(signVideoRoomUploadParts).mockResolvedValue([{
      partNumber: 2,
      uploadUrl: "https://role-room.s3.eu-north-1.amazonaws.com/video?partNumber=2",
      requiredHeaders: { "x-amz-checksum-sha256": "opaque" },
    }]);
    vi.mocked(resumeVideoRoomUpload).mockResolvedValue({
      objectId: "object-1",
      strategy: "multipart",
      uploadId: "upload-1",
      partSize: 16 * 1024 * 1024,
      partCount: 2,
      expiresInSeconds: 3600,
    });
    const state = createUploadApp();
    const created = await request(state.app)
      .post("/api/projects/project-1/video-versions/tus")
      .set("Authorization", "Bearer paired-token")
      .send({
        fileName: "Premiere-E2E.mp4",
        sizeBytes: 17 * 1024 * 1024,
        contentType: "video/mp4",
        checksumSha256: "a".repeat(64),
      });
    expect(created.body.protocol).toBe("s3-multipart");

    const status = await request(state.app)
      .get(`/api/projects/project-1/video-versions/${created.body.versionId}/object-status`)
      .set("Authorization", "Bearer paired-token");
    const parts = await request(state.app)
      .post(`/api/projects/project-1/video-versions/${created.body.versionId}/object-parts`)
      .set("Authorization", "Bearer paired-token")
      .send({ parts: [{ partNumber: 2, checksumSha256: "c".repeat(64) }] });
    const resumed = await request(state.app)
      .post(`/api/projects/project-1/video-versions/${created.body.versionId}/object-resume`)
      .set("Authorization", "Bearer paired-token")
      .send({});

    expect(status.body.uploadedParts).toHaveLength(1);
    expect(parts.body.parts[0]).toMatchObject({ partNumber: 2 });
    expect(resumed.body).toMatchObject({ protocol: "s3-multipart", versionId: created.body.versionId });
  });

  it("keeps the active review cut intact while a new TUS upload is pending", async () => {
    vi.mocked(createDirectStreamTusUpload).mockResolvedValue({
      uid: "stream-new",
      uploadUrl: "https://upload.videodelivery.net/tus-new",
      protocol: "tus",
      chunkSize: 50 * 1024 * 1024,
      expiresAt: "2026-09-14T12:00:00.000Z",
    });
    const state = createUploadApp();

    const response = await request(state.app)
      .post("/api/projects/project-1/video-versions/tus")
      .set("Authorization", "Bearer paired-token")
      .send({ fileName: "Premiere-E2E.mp4", sizeBytes: 1024, versionLabel: "V2" });

    expect(response.status).toBe(201);
    expect(state.pending()).toMatchObject({ status: "uploading", stream_uid: "stream-new" });
    expect(state.queries.some(({ sql }) =>
      sql.includes("SET status='superseded'") && sql.includes("under_review"),
    )).toBe(false);
  });

  it("atomically activates the new cut only after Stream reports ready", async () => {
    vi.mocked(createDirectStreamTusUpload).mockResolvedValue({
      uid: "stream-new",
      uploadUrl: "https://upload.videodelivery.net/tus-new",
      protocol: "tus",
      chunkSize: 50 * 1024 * 1024,
      expiresAt: "2026-09-14T12:00:00.000Z",
    });
    vi.mocked(getStreamVideoStatus).mockResolvedValue({
      ready: true,
      state: "ready",
      progressPercent: 100,
      error: null,
      duration: 12,
      thumbnailUrl: "https://thumb.example/new.jpg",
    });
    const state = createUploadApp();
    const created = await request(state.app)
      .post("/api/projects/project-1/video-versions/tus")
      .set("Authorization", "Bearer paired-token")
      .send({ fileName: "Premiere-E2E.mp4", sizeBytes: 1024 });

    const response = await request(state.app)
      .get(`/api/projects/project-1/video-versions/${created.body.versionId}/stream-status`)
      .set("Authorization", "Bearer paired-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ready: true, state: "ready", status: "under_review" });
    const activation = state.queries.find(({ sql }) => sql.includes("SET status=CASE WHEN id=$1"));
    expect(activation?.sql).toContain("status='uploading'");
    expect(activation?.sql).toContain("id<>$1");
  });

  it("reissues an expired upload URL for the same pending version", async () => {
    vi.mocked(createDirectStreamTusUpload)
      .mockResolvedValueOnce({
        uid: "stream-old",
        uploadUrl: "https://upload.videodelivery.net/tus-old",
        protocol: "tus",
        chunkSize: 50 * 1024 * 1024,
        expiresAt: "2026-09-14T12:00:00.000Z",
      })
      .mockResolvedValueOnce({
        uid: "stream-retry",
        uploadUrl: "https://upload.videodelivery.net/tus-retry",
        protocol: "tus",
        chunkSize: 50 * 1024 * 1024,
        expiresAt: "2026-09-15T12:00:00.000Z",
      });
    const state = createUploadApp();
    const created = await request(state.app)
      .post("/api/projects/project-1/video-versions/tus")
      .set("Authorization", "Bearer paired-token")
      .send({ fileName: "Premiere-E2E.mp4", sizeBytes: 1024 });

    const response = await request(state.app)
      .post(`/api/projects/project-1/video-versions/${created.body.versionId}/tus-retry`)
      .set("Authorization", "Bearer paired-token")
      .send({ expectedStreamUid: "stream-old", fileName: "Premiere-E2E.mp4" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ versionId: created.body.versionId, uid: "stream-retry" });
    expect(state.pending()).toMatchObject({ id: created.body.versionId, stream_uid: "stream-retry" });
    expect(deleteStreamVideo).toHaveBeenCalledWith("stream-old");
  });

  it("keeps a pending version retryable when replacement provisioning hits capacity", async () => {
    vi.mocked(createDirectStreamTusUpload)
      .mockResolvedValueOnce({
        uid: "stream-old",
        uploadUrl: "https://upload.videodelivery.net/tus-old",
        protocol: "tus",
        chunkSize: 50 * 1024 * 1024,
        expiresAt: "2026-09-14T12:00:00.000Z",
      })
      .mockRejectedValueOnce(Object.assign(
        new Error("cloudflare_stream_capacity_exceeded"),
        { code: "cloudflare_stream_capacity_exceeded", providerStatus: 413 },
      ));
    const state = createUploadApp();
    const created = await request(state.app)
      .post("/api/projects/project-1/video-versions/tus")
      .set("Authorization", "Bearer paired-token")
      .send({ fileName: "Premiere-E2E.mp4", sizeBytes: 1024 });

    const response = await request(state.app)
      .post(`/api/projects/project-1/video-versions/${created.body.versionId}/tus-retry`)
      .set("Authorization", "Bearer paired-token")
      .send({ expectedStreamUid: "stream-old", fileName: "Premiere-E2E.mp4" });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "cloudflare_stream_capacity_exceeded" });
    expect(state.pending()).toMatchObject({ stream_uid: "stream-old", status: "uploading" });
    expect(deleteStreamVideo).not.toHaveBeenCalledWith("stream-old");
  });
});
