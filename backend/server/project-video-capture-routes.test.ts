import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getProjectAccess } from "./project-team-routes.js";
import {
  createSoundRoomObjectDownloadUrl,
  initiateVideoCaptureUpload,
  resumeVideoRoomUpload,
} from "./sound-room-storage-service.js";
import { setupProjectVideoCaptureRoutes } from "./project-video-capture-routes.js";

vi.mock("./project-team-routes.js", () => ({
  getProjectAccess: vi.fn(),
}));
vi.mock("./cloudflare-stream-service.js", () => ({
  getStreamVideoStatus: vi.fn(),
  importStreamFromUrl: vi.fn(),
  isStreamEnabled: vi.fn(() => false),
  signStreamPlaybackUrl: vi.fn(),
  signStreamThumbnailUrl: vi.fn(),
}));
vi.mock("./sound-room-storage-service.js", () => ({
  completeVideoRoomUpload: vi.fn(),
  createSoundRoomObjectDownloadUrl: vi.fn(),
  deleteCreatorHubMediaObject: vi.fn(),
  getVideoRoomUploadStatus: vi.fn(),
  initiateVideoCaptureUpload: vi.fn(),
  readOwnedVideoRoomObject: vi.fn(),
  resumeVideoRoomUpload: vi.fn(),
  signVideoRoomUploadParts: vi.fn(),
}));

const session = { userId: "operator-1", email: "op@example.test", name: "Operator", role: "user" };

function appWithPool(existingAsset?: Record<string, unknown>) {
  let promotedVersion: Record<string, unknown> | null = null;
  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = String(sqlValue);
    if (sql.includes("FROM project_video_assets asset")) {
      return { rows: existingAsset ? [existingAsset] : [], rowCount: existingAsset ? 1 : 0 };
    }
    if (sql.includes("FROM project_video_versions") && sql.includes("capture_asset_id")) {
      return { rows: promotedVersion ? [promotedVersion] : [], rowCount: promotedVersion ? 1 : 0 };
    }
    if (sql.includes("COALESCE(MAX(version_number),0)+1")) {
      return { rows: [{ n: 3 }], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO project_video_versions") && sql.includes("capture_asset_id")) {
      promotedVersion = {
        id: params[0],
        version_number: params[4],
        version_label: params[3],
        status: "under_review",
      };
      return { rows: [promotedVersion], rowCount: 1 };
    }
    if (sql.includes("SELECT user_id::text FROM projects")) return { rows: [{ user_id: "owner-1" }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
  const app = express();
  app.use(express.json());
  setupProjectVideoCaptureRoutes({
    app,
    pool: {
      query,
      connect: vi.fn(async () => ({ query, release: vi.fn() })),
    } as never,
    requireUserSession: () => session,
  });
  return { app, query };
}

const validBody = {
  assetId: "20000000-0000-4000-8000-000000000003",
  fileName: "A001-C004.mov",
  sizeBytes: 1024,
  contentType: "video/quicktime",
  checksumSha256: "a".repeat(64),
  sourceType: "uvc",
  recordedAt: "2026-09-19T12:00:00.000Z",
  takeNumber: 1,
};

describe("project video capture authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets a viewer list takes but blocks upload creation", async () => {
    vi.mocked(getProjectAccess).mockResolvedValue({
      canRead: true, canEdit: false, isOwner: false, source: "team", role: "viewer",
    } as any);
    const state = appWithPool();
    const list = await request(state.app).get(
      "/api/projects/10000000-0000-4000-8000-000000000002/video-capture/assets",
    );
    const write = await request(state.app).post(
      "/api/projects/10000000-0000-4000-8000-000000000002/video-capture/assets/initiate",
    ).send(validBody);

    expect(list.status).toBe(200);
    expect(write.status).toBe(403);
    expect(write.body).toEqual({ error: "read_only_access" });
    expect(initiateVideoCaptureUpload).not.toHaveBeenCalled();
  });

  it("hides project existence from users without read access", async () => {
    vi.mocked(getProjectAccess).mockResolvedValue({
      canRead: false, canEdit: false, isOwner: false, source: null, role: null,
    } as any);
    const state = appWithPool();
    const response = await request(state.app).get(
      "/api/projects/10000000-0000-4000-8000-000000000002/video-capture/assets",
    );
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });
  });

  it("finalizes an already verified S3 original without uploading it twice", async () => {
    vi.mocked(getProjectAccess).mockResolvedValue({
      canRead: true, canEdit: true, isOwner: true, source: "owner", role: "owner",
    } as any);
    const state = appWithPool({
      id: validBody.assetId,
      project_id: "10000000-0000-4000-8000-000000000002",
      storage_object_id: "30000000-0000-4000-8000-000000000004",
      storage_owner_user_id: "owner-1",
      storage_status: "active",
      original_filename: validBody.fileName,
      content_type: validBody.contentType,
      size_bytes: String(validBody.sizeBytes),
      checksum_sha256: validBody.checksumSha256,
      source_type: validBody.sourceType,
      recorded_at: validBody.recordedAt,
      capture_state: "failed",
      stream_state: "pending",
      created_at: validBody.recordedAt,
      updated_at: validBody.recordedAt,
    });
    const response = await request(state.app).post(
      "/api/projects/10000000-0000-4000-8000-000000000002/video-capture/assets/initiate",
    ).send(validBody);

    expect(response.status).toBe(200);
    expect(response.body.upload).toEqual({
      objectId: "30000000-0000-4000-8000-000000000004",
      strategy: "verified",
      expiresInSeconds: 0,
    });
    expect(resumeVideoRoomUpload).not.toHaveBeenCalled();
    expect(initiateVideoCaptureUpload).not.toHaveBeenCalled();
  });

  it("promotes a ready take to Video Room once without copying the S3 original", async () => {
    vi.mocked(getProjectAccess).mockResolvedValue({
      canRead: true, canEdit: true, isOwner: true, source: "owner", role: "owner",
    } as any);
    const state = appWithPool({
      id: validBody.assetId,
      project_id: "10000000-0000-4000-8000-000000000002",
      storage_object_id: "30000000-0000-4000-8000-000000000004",
      original_filename: validBody.fileName,
      content_type: validBody.contentType,
      size_bytes: String(validBody.sizeBytes),
      source_type: "ndi_bridge",
      capture_state: "ready",
      stream_uid: "stream-1",
      stream_state: "ready",
      stream_error: null,
      duration_ms: 12_500,
      slate: "A001",
      take_number: 2,
    });
    const route = "/api/projects/10000000-0000-4000-8000-000000000002/video-capture/assets/20000000-0000-4000-8000-000000000003/promote";

    const first = await request(state.app).post(route).send({});
    const second = await request(state.app).post(route).send({});

    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      created: true,
      version: { versionNumber: 3, versionLabel: "A001 T2", status: "under_review" },
    });
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ created: false, version: { id: first.body.version.id } });
    const inserts = state.query.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO project_video_versions"),
    );
    expect(inserts).toHaveLength(1);
    expect(initiateVideoCaptureUpload).not.toHaveBeenCalled();
  });

  it("returns a signed CreatorHub original when Stream playback is not ready", async () => {
    vi.mocked(getProjectAccess).mockResolvedValue({
      canRead: true, canEdit: true, isOwner: true, source: "owner", role: "owner",
    } as any);
    vi.mocked(createSoundRoomObjectDownloadUrl).mockResolvedValue(
      "https://creatorhub-storage.test/signed-original",
    );
    const state = appWithPool({
      id: validBody.assetId,
      project_id: "10000000-0000-4000-8000-000000000002",
      storage_object_id: "30000000-0000-4000-8000-000000000004",
      storage_owner_user_id: "owner-1",
      storage_status: "active",
      storage_object_key: "projects/project/video-capture/original.mov",
      original_filename: validBody.fileName,
      content_type: validBody.contentType,
      size_bytes: String(validBody.sizeBytes),
      checksum_sha256: validBody.checksumSha256,
      source_type: validBody.sourceType,
      recorded_at: validBody.recordedAt,
      capture_state: "ready",
      stream_uid: null,
      stream_state: "processing",
      created_at: validBody.recordedAt,
      updated_at: validBody.recordedAt,
    });

    const response = await request(state.app).get(
      "/api/projects/10000000-0000-4000-8000-000000000002/video-capture/assets/20000000-0000-4000-8000-000000000003",
    );

    expect(response.status).toBe(200);
    expect(response.body.playbackUrl).toBe("https://creatorhub-storage.test/signed-original");
    expect(createSoundRoomObjectDownloadUrl).toHaveBeenCalledWith(
      "projects/project/video-capture/original.mov",
      15 * 60,
    );
  });
});
