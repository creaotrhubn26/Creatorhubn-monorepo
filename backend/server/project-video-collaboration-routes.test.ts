import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  mapVideoCollaborationComment,
  setupProjectVideoCollaborationRoutes,
} from "./project-video-collaboration-routes";

vi.mock("./project-team-routes.js", () => ({
  canAccessProject: vi.fn(async () => true),
}));

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
  it("left-joins varchar project IDs so an empty project can receive V1", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const response = await request(createApp(query)).get("/api/video-nle/projects");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ projects: [] });
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toContain(
      "LEFT JOIN project_video_versions version ON project.id=version.project_id::text",
    );
  });

  it("returns editable projects even before their first video version exists", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        project_id: "project-empty",
        project_name: "Premiere E2E",
        project_type: "video",
        can_edit: true,
        version_id: null,
        version_label: null,
        version_number: null,
        version_status: null,
        created_at: null,
      }],
      rowCount: 1,
    });

    const response = await request(createApp(query)).get("/api/video-nle/projects");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      projects: [{
        id: "project-empty",
        name: "Premiere E2E",
        projectType: "video",
        canEdit: true,
        versions: [],
      }],
    });
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

  it("returns comments and task timecodes only for the requested version", async () => {
    const query = vi.fn(async (statement: unknown, values?: unknown[]) => {
      const sql = String(statement);
      if (sql.includes("FROM project_video_versions")) {
        return { rows: [{ id: "version-2", project_id: "project-1" }] };
      }
      if (sql.includes("FROM project_video_comments comment")) {
        return { rows: [{
          id: "comment-1",
          version_id: "version-2",
          timecode_sec: "4.25",
          comment: "Trim klippet",
          task_id: "task-1",
        }] };
      }
      if (sql.includes("FROM project_video_tasks task")) {
        return { rows: [{ id: "task-1", version_id: "version-2", status: "todo", timecode_sec: "4.25" }] };
      }
      expect(values?.[1] === undefined || values?.[1] === "version-2" || values?.[1] === "").toBe(true);
      return { rows: [] };
    });

    const response = await request(createApp(query))
      .get("/api/projects/project-1/video-collaboration?versionId=version-2");

    expect(response.status).toBe(200);
    expect(response.body.comments).toEqual([
      expect.objectContaining({ id: "comment-1", versionId: "version-2", timecodeSec: 4.25, taskId: "task-1" }),
    ]);
    expect(response.body.tasks).toEqual([
      expect.objectContaining({ id: "task-1", version_id: "version-2", timecode_sec: "4.25" }),
    ]);
    const commentQuery = query.mock.calls.find(([statement]) => String(statement).includes("FROM project_video_comments comment"));
    expect(commentQuery?.[1]).toEqual(["project-1", "version-2"]);
  });
});
