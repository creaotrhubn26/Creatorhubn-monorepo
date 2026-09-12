import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({ broadcast: vi.fn() }));
vi.mock("./sound-room-events", () => ({
  broadcastSoundRoomUpdated: mocks.broadcast,
}));

let setupAudioShowcaseRoutes: typeof import("./audio-showcase-routes.js").setupAudioShowcaseRoutes;

describe("EaseVerse keeper to Sound Room", () => {
  beforeAll(async () => {
    vi.stubEnv("EASEVERSE_API_KEY", "service-key");
    ({ setupAudioShowcaseRoutes } = await import("./audio-showcase-routes.js"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(() => vi.clearAllMocks());

  function harness() {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM audio_review_projects ar") && sql.includes("ar.owner_user_id")) {
        return { rows: [{ id: "00000000-0000-4000-8000-000000000001", easeverse_track_id: "track-1", workspace_project_id: "workspace-1" }], rowCount: 1 };
      }
      if (sql.includes("SELECT id,version_number FROM audio_review_versions")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT COALESCE(MAX(version_number)")) return { rows: [{ n: 3 }], rowCount: 1 };
      if (sql.includes("INSERT INTO audio_review_versions")) {
        return { rows: [{ id: "00000000-0000-4000-8000-000000000003" }], rowCount: 1 };
      }
      if (sql.includes("SELECT id FROM creatorhub_music_artifacts")) return { rows: [], rowCount: 0 };
      if (sql.includes("INSERT INTO creatorhub_music_artifacts")) {
        return { rows: [{ id: "00000000-0000-4000-8000-000000000005" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const client = { query, release: vi.fn() };
    const pool = { query, connect: vi.fn(async () => client) };
    const app = express();
    app.use(express.json());
    setupAudioShowcaseRoutes({ app, pool, requireUserSession: vi.fn(() => null) });
    return { app, pool, query, client };
  }

  it("rejects unauthenticated service deliveries", async () => {
    const { app, query } = harness();
    const response = await request(app).post("/api/audio-showcases/easeverse/keeper").send({
      ownerUserId: "producer-1", externalTrackId: "track-1", url: "https://audio.example.test/take.wav",
    });
    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("creates one review candidate with tenant and HTTPS validation", async () => {
    const { app, pool, client } = harness();
    const response = await request(app)
      .post("/api/audio-showcases/easeverse/keeper")
      .set("x-api-key", "service-key")
      .send({ ownerUserId: "producer-1", externalTrackId: "track-1", takeId: "take-1",
        url: "https://audio.example.test/take.wav", filename: "take.wav", durationSec: 12.4 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      applied: "created",
      versionNumber: 3,
      artifactId: "00000000-0000-4000-8000-000000000005",
    });
    expect(mocks.broadcast).toHaveBeenCalledWith(pool, "00000000-0000-4000-8000-000000000001", "version");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
