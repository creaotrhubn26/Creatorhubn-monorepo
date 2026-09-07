import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  pushToEaseVerse: vi.fn(),
}));

vi.mock("./easeverse-protools-sync.js", async () => {
  const actual = await vi.importActual<typeof import("./easeverse-protools-sync.js")>("./easeverse-protools-sync.js");
  return { ...actual, pushProToolsSyncToEaseVerse: mocks.pushToEaseVerse };
});

import { setupProToolsCompanionRoutes } from "./protools-companion-routes.js";

function createPool() {
  const query = vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes("FROM desktop_device_tokens WHERE token_hash")) {
      return { rows: [{ user_id: "user-1", user_email: "producer@example.test" }], rowCount: 1 };
    }
    if (sql.includes("SELECT s.*, COALESCE(ar.external_track_id")) {
      return {
        rows: [{
          id: "session-1",
          user_id: "user-1",
          easeverse_track_id: "track-local-1",
          easeverse_external_track_id: "track-external-1",
          audio_review_project_id: "review-1",
          tempo: 124,
        }],
        rowCount: 1,
      };
    }
    if (sql.includes("SELECT id FROM audio_review_versions")) {
      return { rows: [{ id: "version-1" }], rowCount: 1 };
    }
    if (sql.includes("FROM protools_companion_markers") && sql.includes("order_index")) {
      return {
        rows: [{ name: "Chorus", start_seconds: 32, end_seconds: 48, color: null, order_index: 0 }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  });
  return { query };
}

describe("Pro Tools Companion EaseVerse bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pushToEaseVerse.mockResolvedValue({ configured: true, synced: true, status: 200, storage: "postgres" });
  });

  it("stores markers in Sound Room and mirrors the same snapshot to EaseVerse", async () => {
    const pool = createPool();
    const app = express();
    app.use(express.json());
    setupProToolsCompanionRoutes({
      app,
      pool,
      requireUserSession: vi.fn(() => null),
    });

    const response = await request(app)
      .post("/api/protools/sessions/session-1/markers")
      .set("authorization", "Bearer trr_desk_test")
      .send({ markers: [{ name: "Chorus", startSeconds: 32, endSeconds: 48 }] });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      markersStored: 1,
      sectionsSynced: 1,
      easeverseSync: { configured: true, synced: true, status: 200, storage: "postgres" },
    });
    expect(mocks.pushToEaseVerse).toHaveBeenCalledWith({
      externalTrackId: "track-external-1",
      projectId: "review-1",
      bpm: 124,
      markers: [{ name: "Chorus", startSeconds: 32, endSeconds: 48 }],
    });
  });
});
