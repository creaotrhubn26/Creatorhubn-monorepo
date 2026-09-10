import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  createPairingCode: vi.fn(),
}));

vi.mock("./project-team-routes.js", () => ({
  getProjectAccess: mocks.access,
  canAccessProject: vi.fn(async () => true),
}));
vi.mock("./protools-companion-persistence.js", () => ({
  ensureProToolsCompanionSchema: vi.fn(async () => undefined),
  createPairingCode: mocks.createPairingCode,
  claimPairingCode: vi.fn(),
  databaseRateLimited: vi.fn(),
  enqueueEaseVerseSync: vi.fn(),
  retryEaseVerseSync: vi.fn(),
}));

import { setupProToolsCompanionRoutes } from "./protools-companion-routes.js";

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
const ROOM_ID = "00000000-0000-4000-8000-000000000002";
const TRACK_ID = "00000000-0000-4000-8000-000000000003";

function appWithSharedRoom() {
  const pool = {
    query: vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM audio_review_projects ar") && sql.includes("project_audio_rooms")) {
        return { rows: [{ id: ROOM_ID, owner_user_id: "owner-1", easeverse_track_id: TRACK_ID, workspace_project_id: WORKSPACE_ID }] };
      }
      if (sql.includes("FROM easeverse_tracks")) return { rows: [] };
      return { rows: [] };
    }),
  };
  const app = express();
  app.use(express.json());
  setupProToolsCompanionRoutes({
    app,
    pool,
    requireUserSession: vi.fn(() => ({ userId: "editor-1", email: "editor@example.test", name: "Editor", role: "member" })),
  });
  return app;
}

describe("Pro Tools Companion Workspace capabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPairingCode.mockResolvedValue({ code: "123456", expiresInSeconds: 600 });
  });

  it("allows an active editor to pair the already-linked Sound Room track", async () => {
    mocks.access.mockResolvedValue({ canRead: true, canEdit: true, isOwner: false });
    const response = await request(appWithSharedRoom()).post("/api/protools/pair/start").send({
      workspaceProjectId: WORKSPACE_ID,
      audioRoomId: ROOM_ID,
      easeverseTrackId: TRACK_ID,
    });
    expect(response.status).toBe(200);
    expect(mocks.createPairingCode).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: "editor-1" }), expect.objectContaining({
      workspaceProjectId: WORKSPACE_ID,
      audioReviewProjectId: ROOM_ID,
      easeverseTrackId: TRACK_ID,
    }));
  });

  it("denies a viewer without edit capability", async () => {
    mocks.access.mockResolvedValue({ canRead: true, canEdit: false, isOwner: false });
    const response = await request(appWithSharedRoom()).post("/api/protools/pair/start").send({
      workspaceProjectId: WORKSPACE_ID,
      audioRoomId: ROOM_ID,
      easeverseTrackId: TRACK_ID,
    });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("workspace_project_not_editable");
    expect(mocks.createPairingCode).not.toHaveBeenCalled();
  });
});
