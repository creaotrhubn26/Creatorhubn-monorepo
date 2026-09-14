import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const OWNER_ID = "producer-1";
const PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const VERSION_ID = "00000000-0000-4000-8000-000000000002";

let setupAudioShowcaseRoutes: typeof import("./audio-showcase-routes.js").setupAudioShowcaseRoutes;

describe("EaseVerse approved reference playback", () => {
  beforeAll(async () => {
    vi.stubEnv("EASEVERSE_API_KEY", "service-key");
    ({ setupAudioShowcaseRoutes } = await import("./audio-showcase-routes.js"));
  });

  afterAll(() => vi.unstubAllEnvs());

  function harness(rows: any[] = []) {
    const query = vi.fn(async () => ({ rows, rowCount: rows.length }));
    const signer = vi.fn(async () => "https://private-audio.example.test/reference.wav?signature=fresh");
    const app = express();
    app.use(express.json());
    setupAudioShowcaseRoutes({
      app,
      pool: { query },
      requireUserSession: vi.fn(() => null),
      signSoundRoomDownloadUrl: signer,
    });
    return { app, query, signer };
  }

  it("requires the shared service credential before querying private storage", async () => {
    const { app, query, signer } = harness();

    const response = await request(app)
      .post("/api/integrations/easeverse/reference-playback")
      .send({ ownerUserId: OWNER_ID, audioReviewProjectId: PROJECT_ID });

    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
    expect(signer).not.toHaveBeenCalled();
  });

  it("returns a fresh URL only for the owner's approved active object", async () => {
    const { app, query, signer } = harness([{
      version_id: VERSION_ID,
      file_name: "Mix V7.wav",
      content_type: "audio/wav",
      duration: 12,
      stored_object_key: "organizations/org-1/users/producer-1/sound-room/reference.wav",
      legacy_object_key: null,
    }]);

    const response = await request(app)
      .post("/api/integrations/easeverse/reference-playback")
      .set("x-api-key", "service-key")
      .send({ ownerUserId: OWNER_ID, audioReviewProjectId: PROJECT_ID });

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("project.owner_user_id=$2"), [PROJECT_ID, OWNER_ID]);
    expect(String(query.mock.calls[0]?.[0])).toContain("version.status='approved'");
    expect(String(query.mock.calls[0]?.[0])).toContain("stored.status='active'");
    expect(signer).toHaveBeenCalledWith(
      "organizations/org-1/users/producer-1/sound-room/reference.wav",
      3600,
    );
    expect(response.body).toEqual({
      url: "https://private-audio.example.test/reference.wav?signature=fresh",
      expiresInSeconds: 3600,
      versionId: VERSION_ID,
      fileName: "Mix V7.wav",
      contentType: "audio/wav",
      durationSec: 12,
    });
    expect(JSON.stringify(response.body)).not.toContain("organizations/org-1");
  });

  it("supports a pre-migration Companion object only when its hierarchy matches the owner and room", async () => {
    const legacyKey = `organizations/org-1/users/${OWNER_ID}/projects/workspace-1/sound-room/${PROJECT_ID}/protools/sessions/session-1/bounces/reference.wav`;
    const { app, signer } = harness([{
      version_id: VERSION_ID,
      file_name: "Legacy mix.wav",
      content_type: "audio/wav",
      duration: 12,
      stored_object_key: null,
      legacy_object_key: legacyKey,
    }]);

    const response = await request(app)
      .post("/api/integrations/easeverse/reference-playback")
      .set("x-api-key", "service-key")
      .send({ ownerUserId: OWNER_ID, audioReviewProjectId: PROJECT_ID });

    expect(response.status).toBe(200);
    expect(signer).toHaveBeenCalledWith(legacyKey, 3600);
    expect(JSON.stringify(response.body)).not.toContain(legacyKey);
  });

  it("rejects a legacy Companion key from another tenant", async () => {
    const { app, signer } = harness([{
      version_id: VERSION_ID,
      file_name: "Wrong tenant.wav",
      content_type: "audio/wav",
      duration: 12,
      stored_object_key: null,
      legacy_object_key: `organizations/org-2/users/another-user/projects/workspace-1/sound-room/${PROJECT_ID}/protools/sessions/session-1/bounces/reference.wav`,
    }]);

    const response = await request(app)
      .post("/api/integrations/easeverse/reference-playback")
      .set("x-api-key", "service-key")
      .send({ ownerUserId: OWNER_ID, audioReviewProjectId: PROJECT_ID });

    expect(response.status).toBe(404);
    expect(signer).not.toHaveBeenCalled();
  });

  it("does not sign anything when the owner/project binding has no approved object", async () => {
    const { app, signer } = harness();

    const response = await request(app)
      .post("/api/integrations/easeverse/reference-playback")
      .set("authorization", "Bearer service-key")
      .send({ ownerUserId: "another-user", audioReviewProjectId: PROJECT_ID });

    expect(response.status).toBe(404);
    expect(signer).not.toHaveBeenCalled();
  });
});
