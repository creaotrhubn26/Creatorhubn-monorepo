import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
}));

vi.mock("./protools-companion-persistence.js", async () => {
  const actual = await vi.importActual<typeof import("./protools-companion-persistence.js")>("./protools-companion-persistence.js");
  return { ...actual, ensureProToolsCompanionSchema: vi.fn(async () => undefined), enqueueEaseVerseSync: mocks.enqueue };
});

import { setupProToolsCompanionRoutes } from "./protools-companion-routes.js";

function createPool() {
  const query = vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes("FROM desktop_device_tokens WHERE token_hash")) {
      return { rows: [{ id: "device-1", user_id: "user-1", user_email: "producer@example.test" }], rowCount: 1 };
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
    mocks.enqueue.mockResolvedValue({ configured: true, synced: true, status: 200, storage: "postgres", eventId: "file-1:markers", revision: 1, queued: false });
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
      .send({ eventId: "file-1", markers: [{ id: "chorus", name: "Chorus", startSeconds: 32, endSeconds: 48 }] });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      markersStored: 1,
      sectionsSynced: 1,
      easeverseSync: { configured: true, synced: true, status: 200, storage: "postgres" },
    });
    expect(mocks.enqueue).toHaveBeenCalledWith({
      pool,
      sessionId: "session-1",
      userId: "user-1",
      eventType: "markers",
      eventId: "file-1:markers",
      payload: {
        externalTrackId: "track-external-1",
        audioReviewProjectId: "review-1",
        bpm: 124,
        markers: [{ id: "chorus", name: "Chorus", startSeconds: 32, endSeconds: 48 }],
      },
    });
  });

  it("accepts missing Pro Tools tempo as null metadata instead of 0 BPM", async () => {
    const pool = createPool();
    const app = express();
    app.use(express.json());
    setupProToolsCompanionRoutes({
      app,
      pool,
      requireUserSession: vi.fn(() => null),
    });

    const response = await request(app)
      .post("/api/protools/sessions/session-1/metadata")
      .set("authorization", "Bearer trr_desk_test")
      .send({
        eventId: "session-info-1",
        tempo: null,
        keySignature: null,
        timeSignature: null,
        sampleRate: 48000,
        bitDepth: 32,
        tracks: [{ name: "CreatorHub-E2E-source", type: "audio" }],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    const sessionUpdate = pool.query.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE protools_companion_sessions SET"),
    );
    expect(sessionUpdate?.[1]?.[1]).toBeNull();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
