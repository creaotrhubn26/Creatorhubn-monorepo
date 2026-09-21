import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getProjectAccess } from "./project-team-routes.js";
import { initiateProductionAudioUpload } from "./sound-room-storage-service.js";
import { setupProjectProductionAudioRoutes } from "./project-production-audio-routes.js";

vi.mock("./project-team-routes.js", () => ({ getProjectAccess: vi.fn() }));
vi.mock("./sound-room-storage-service.js", () => ({
  completeVideoRoomUpload: vi.fn(),
  createSoundRoomObjectDownloadUrl: vi.fn(),
  deleteCreatorHubMediaObject: vi.fn(),
  getVideoRoomUploadStatus: vi.fn(),
  initiateProductionAudioUpload: vi.fn(),
  resumeVideoRoomUpload: vi.fn(),
  signVideoRoomUploadParts: vi.fn(),
}));

const projectId = "10000000-0000-4000-8000-000000000002";
const assetId = "20000000-0000-4000-8000-000000000003";
const session = { userId: "operator-1", email: "op@example.test", name: "Operator", role: "user" };

function makeApp(existingAsset?: Record<string, unknown>) {
  const query = vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes("FROM project_production_audio_assets asset")) {
      return { rows: existingAsset ? [existingAsset] : [], rowCount: existingAsset ? 1 : 0 };
    }
    if (sql.includes("SELECT user_id::text FROM projects")) {
      return { rows: [{ user_id: "owner-1" }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
  const app = express();
  app.use(express.json());
  setupProjectProductionAudioRoutes({
    app, pool: { query } as never, requireUserSession: () => session,
  });
  return { app, query };
}

const validBody = {
  assetId,
  fileName: "A001T001.wav",
  sizeBytes: 4096,
  contentType: "audio/wav",
  checksumSha256: "d".repeat(64),
  sourceType: "memory_card",
  recordedAt: "2026-09-21T12:00:00.000Z",
  sampleRate: 48000,
  bitDepth: 24,
  channelCount: 2,
  channelNames: ["Boom", "Lavalier"],
  timecodeStart: "01:00:00:00",
};

describe("project production audio routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows project viewers to list audio but blocks ingest", async () => {
    vi.mocked(getProjectAccess).mockResolvedValue({
      canRead: true, canEdit: false, isOwner: false, source: "team", role: "viewer",
    } as any);
    const state = makeApp();
    const list = await request(state.app).get(`/api/projects/${projectId}/production-audio/assets`);
    const write = await request(state.app)
      .post(`/api/projects/${projectId}/production-audio/assets/initiate`).send(validBody);
    expect(list.status).toBe(200);
    expect(write.status).toBe(403);
    expect(initiateProductionAudioUpload).not.toHaveBeenCalled();
  });

  it("does not resume a conflicting asset id with different bytes", async () => {
    vi.mocked(getProjectAccess).mockResolvedValue({
      canRead: true, canEdit: true, isOwner: true, source: "owner", role: "owner",
    } as any);
    const state = makeApp({
      id: assetId, project_id: projectId, checksum_sha256: "e".repeat(64),
      size_bytes: "4096", capture_state: "uploading",
    });
    const response = await request(state.app)
      .post(`/api/projects/${projectId}/production-audio/assets/initiate`).send(validBody);
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "asset_id_conflict" });
    expect(initiateProductionAudioUpload).not.toHaveBeenCalled();
  });

  it("requires both audio and video to belong to the same project when linking", async () => {
    vi.mocked(getProjectAccess).mockResolvedValue({
      canRead: true, canEdit: true, isOwner: true, source: "owner", role: "owner",
    } as any);
    const state = makeApp();
    const response = await request(state.app)
      .post(`/api/projects/${projectId}/production-audio/assets/${assetId}/links`)
      .send({ videoAssetId: "30000000-0000-4000-8000-000000000004", syncMethod: "waveform", confidence: 0.91 });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "audio_or_video_asset_not_found" });
    expect(String(state.query.mock.calls.at(-1)?.[0])).toContain("audio.project_id=video.project_id");
  });
});
