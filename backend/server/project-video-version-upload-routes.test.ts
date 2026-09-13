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
    pool: { query } as never,
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
