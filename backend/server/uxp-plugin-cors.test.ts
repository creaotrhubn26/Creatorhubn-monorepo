import cors from "cors";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { setupUxpPluginCors } from "./uxp-plugin-cors.js";

function createApp() {
  const app = express();
  setupUxpPluginCors(app);
  // Mirror the ordering in server/index.ts. The scoped UXP policy must remain
  // effective even when the credentialed browser policy runs afterwards.
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || origin === "https://www.creatorhubn.com") return callback(null, origin || true);
      return callback(null, false);
    },
    credentials: true,
  }));
  app.get("/api/video-nle/projects", (_req, res) => res.json({ projects: [] }));
  app.post("/api/post-agent/pairing/poll", (_req, res) => res.json({ status: "pending" }));
  app.get("/api/projects/:projectId/video-marker-sync/:editor", (_req, res) => res.json({ markers: [] }));
  app.get("/api/projects/:projectId/video-collaboration", (_req, res) => res.json({ comments: [], tasks: [] }));
  app.patch("/api/projects/:projectId/video-tasks/:taskId", (_req, res) => res.json({ status: "done" }));
  app.post("/api/projects/:projectId/video-versions/tus", (_req, res) => res.status(201).json({ versionId: "version-1" }));
  app.post("/api/projects/:projectId/video-versions/:vid/tus-retry", (_req, res) => res.json({ versionId: "version-1" }));
  app.get("/api/projects/:projectId/video-versions/:vid/stream-status", (_req, res) => res.json({ ready: false }));
  app.get("/api/admin/private", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("UXP plugin CORS boundary", () => {
  it("accepts preflight from an opaque UXP origin without enabling cookies", async () => {
    const response = await request(createApp())
      .options("/api/post-agent/pairing/poll")
      .set("Origin", "null")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(response.headers["access-control-allow-headers"]).toContain("Content-Type");
  });

  it("accepts bearer-auth preflight for marker sync", async () => {
    const response = await request(createApp())
      .options("/api/projects/project-1/video-marker-sync/premiere")
      .set("Origin", "uxp://no.creatorhubn.video-room-premiere")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "authorization");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["access-control-allow-headers"]).toContain("Authorization");
  });

  it("adds wildcard CORS to an actual UXP API response", async () => {
    const response = await request(createApp())
      .get("/api/video-nle/projects")
      .set("Origin", "uxp://no.creatorhubn.video-room-premiere")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("accepts bearer-authenticated review reads and task updates", async () => {
    const app = createApp();
    const read = await request(app)
      .get("/api/projects/project-1/video-collaboration?versionId=version-1")
      .set("Origin", "uxp://no.creatorhubn.video-room-premiere")
      .set("Authorization", "Bearer test-token");
    const updatePreflight = await request(app)
      .options("/api/projects/project-1/video-tasks/task-1")
      .set("Origin", "null")
      .set("Access-Control-Request-Method", "PATCH")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    expect(read.headers["access-control-allow-origin"]).toBe("*");
    expect(updatePreflight.status).toBe(204);
    expect(updatePreflight.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(updatePreflight.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("allows the exact direct-upload provisioning, retry and processing routes", async () => {
    const app = createApp();
    for (const [path, method] of [
      ["/api/projects/project-1/video-versions/tus", "POST"],
      ["/api/projects/project-1/video-versions/version-1/tus-retry", "POST"],
      ["/api/projects/project-1/video-versions/version-1/stream-status", "GET"],
    ] as const) {
      const response = await request(app)
        .options(path)
        .set("Origin", "uxp://no.creatorhubn.video-room-premiere")
        .set("Access-Control-Request-Method", method)
        .set("Access-Control-Request-Headers", "authorization,content-type");
      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe("*");
      expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
    }
  });

  it("does not widen CORS for unrelated API routes", async () => {
    const response = await request(createApp())
      .get("/api/admin/private")
      .set("Origin", "https://attacker.example");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("preserves credentialed CORS for the first-party web client", async () => {
    const response = await request(createApp())
      .get("/api/video-nle/projects")
      .set("Origin", "https://www.creatorhubn.com")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("https://www.creatorhubn.com");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
});
