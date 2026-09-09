import express from "express";
import fs from "node:fs";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { setupAudioShowcaseRoutes } from "./audio-showcase-routes.js";

const ROOM_ID = "00000000-0000-4000-8000-000000000001";
const VERSION_ID = "00000000-0000-4000-8000-000000000002";
const BOUNCE_ID = "00000000-0000-4000-8000-000000000003";

describe("Audio Showcase Pro Tools playback URL", () => {
  it("uses Web Audio and sends the persisted OAuth token for protected playback and download only", () => {
    const source = fs.readFileSync(
      new URL("../../frontend/client/src/pages/audio-showcase.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("backend: 'WebAudio'");
    expect(source).toContain("fetchParams: companionAudioFetchParams(effectiveSrc)");
    expect(source).toContain("[effectiveSrc, loading]");
    expect(source).toContain("decodeAudioData(sourceBytes.slice(0))");
    expect(source).toContain("instance.load('', peaks, decoded.duration)");
    expect(source).toContain("media.buffer = decoded");
    expect(source).toContain("media.audioContext.resume()");
    expect(source).toContain("fetch(url, companionAudioFetchParams(url))");
    expect(source).toContain("/^\\/api\\/protools\\/bounces\\/");
    expect(source).toContain("headers: { Authorization: `Bearer ${token}` }");
    expect(source).toContain("if (!isProtectedCompanionAudio(url)) return { credentials: 'omit' }");
  });

  it("replaces a private R2 object URL with the authenticated same-origin stream", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("SELECT 1 FROM audio_review_projects")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("SELECT * FROM audio_review_projects")) {
        return { rows: [{ id: ROOM_ID, owner_user_id: "user-1", title: "Mix room", easeverse_track_id: null }], rowCount: 1 };
      }
      if (sql.includes("SELECT v.*,b.id AS protools_bounce_id")) {
        return {
          rows: [{
            id: VERSION_ID,
            project_id: ROOM_ID,
            version_label: "Mix V1",
            file_url: "https://private-r2.example.test/bucket/private.wav",
            protools_bounce_id: BOUNCE_ID,
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const app = express();
    app.use(express.json());
    setupAudioShowcaseRoutes({
      app,
      pool: { query },
      requireUserSession: vi.fn(() => ({ userId: "user-1", email: "producer@example.test", name: "Producer" })),
    });

    const response = await request(app).get(`/api/audio-showcases/${ROOM_ID}`);

    expect(response.status).toBe(200);
    expect(response.body.versions).toHaveLength(1);
    expect(response.body.versions[0].file_url).toBe(`/api/protools/bounces/${BOUNCE_ID}/file`);
    expect(response.body.versions[0]).not.toHaveProperty("protools_bounce_id");
    expect(JSON.stringify(response.body)).not.toContain("private-r2.example.test");
  });
});
