import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  mapVideoCollaborationComment,
  setupProjectVideoCollaborationRoutes,
} from "./project-video-collaboration-routes";

const session = {
  userId: "user-1",
  email: "editor@example.test",
  name: "Editor",
  role: "user",
};

function createApp(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  setupProjectVideoCollaborationRoutes({
    app,
    pool: { query } as never,
    requireUserSession: () => session,
    resolveUserSession: async () => session,
  });
  return app;
}

describe("Video NLE project picker", () => {
  it("joins varchar project IDs to UUID video-version IDs explicitly", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const response = await request(createApp(query)).get("/api/video-nle/projects");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ projects: [] });
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toContain(
      "project.id=version.project_id::text",
    );
  });

  it("returns a bounded error instead of leaving the desktop request open", async () => {
    const query = vi.fn().mockRejectedValue(
      Object.assign(new Error("operator does not exist"), { code: "42883" }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await request(createApp(query)).get("/api/video-nle/projects");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "project_list_failed" });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});

describe("Video NLE collaboration contract", () => {
  it("maps version-scoped feedback, threads, decisions and linked tasks without exposing media URLs", () => {
    const mapped = mapVideoCollaborationComment({
      id: "comment-1",
      version_id: "version-2",
      timecode_sec: "12.5",
      end_timecode_sec: "14",
      comment: "Bytt dette klippet",
      author_name: "Kunde",
      author_email: "kunde@example.test",
      author_kind: "client",
      category: "edit",
      priority: "must-fix",
      status: "open",
      is_decision: true,
      parent_id: "comment-parent",
      task_id: "task-1",
      created_at: "2026-09-13T10:00:00Z",
      file_url: "https://should-not-leak.example/video.mp4",
    });

    expect(mapped).toMatchObject({
      id: "comment-1",
      versionId: "version-2",
      timecodeSec: 12.5,
      endTimecodeSec: 14,
      parentId: "comment-parent",
      taskId: "task-1",
      isDecision: true,
    });
    expect(mapped).not.toHaveProperty("fileUrl");
    expect(mapped).not.toHaveProperty("file_url");
    expect(mapped).not.toHaveProperty("authorEmail");
  });
});
