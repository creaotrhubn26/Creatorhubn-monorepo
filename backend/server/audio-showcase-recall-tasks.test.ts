import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { setupAudioShowcaseRoutes } from "./audio-showcase-routes.js";

const ROOM_ID = "00000000-0000-4000-8000-000000000011";
const VERSION_ID = "00000000-0000-4000-8000-000000000012";
const COMMENT_ID = "00000000-0000-4000-8000-000000000013";
const TASK_ID = "00000000-0000-4000-8000-000000000014";

const task = {
  id: TASK_ID,
  project_id: ROOM_ID,
  version_id: VERSION_ID,
  comment_id: COMMENT_ID,
  title: "Mer vokal i refrenget",
  status: "todo",
  assignee: "Refreng",
};

function createApp(query: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  setupAudioShowcaseRoutes({
    app,
    pool: { query },
    requireUserSession: () => ({ userId: "producer-1", name: "Producer" }),
  });
  return app;
}

describe("Audio Showcase Recall Mode tasks", () => {
  it("creates a task only after its version and source comment are scoped to the room", async () => {
    const query = vi.fn(async (sqlValue: unknown, params?: unknown[]) => {
      const sql = String(sqlValue);
      if (sql.includes("SELECT 1 FROM audio_review_projects")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("SELECT 1 FROM audio_review_versions")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("SELECT c.id FROM audio_review_comments")) return { rows: [{ id: COMMENT_ID }], rowCount: 1 };
      if (sql.includes("SELECT * FROM audio_review_tasks") && sql.includes("comment_id")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT COUNT(*)::int")) return { rows: [{ n: 2 }], rowCount: 1 };
      if (sql.includes("INSERT INTO audio_review_tasks")) {
        expect(sql).toContain("UPDATE audio_review_comments SET status='in_progress'");
        expect(params).toEqual([ROOM_ID, VERSION_ID, COMMENT_ID, task.title, "todo", "Refreng", "Producer", 2]);
        return { rows: [task], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const response = await request(createApp(query)).post("/api/audio-tasks").send({
      projectId: ROOM_ID,
      versionId: VERSION_ID,
      commentId: COMMENT_ID,
      title: task.title,
      assignee: "Refreng",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject(task);
  });

  it("returns the existing linked task when a comment is submitted twice", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("SELECT 1 FROM audio_review_projects")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("SELECT 1 FROM audio_review_versions")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("SELECT c.id FROM audio_review_comments")) return { rows: [{ id: COMMENT_ID }], rowCount: 1 };
      if (sql.includes("SELECT * FROM audio_review_tasks") && sql.includes("comment_id")) return { rows: [task], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    const response = await request(createApp(query)).post("/api/audio-tasks").send({
      projectId: ROOM_ID,
      versionId: VERSION_ID,
      commentId: COMMENT_ID,
      title: task.title,
    });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(TASK_ID);
    expect(query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO audio_review_tasks"))).toBe(false);
  });

  it("returns the winner when two requests race at the unique index", async () => {
    let linkedTaskLookups = 0;
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("SELECT 1 FROM audio_review_projects")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("SELECT 1 FROM audio_review_versions")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("SELECT c.id FROM audio_review_comments")) return { rows: [{ id: COMMENT_ID }], rowCount: 1 };
      if (sql.includes("SELECT * FROM audio_review_tasks") && sql.includes("comment_id")) {
        linkedTaskLookups += 1;
        return linkedTaskLookups === 1 ? { rows: [], rowCount: 0 } : { rows: [task], rowCount: 1 };
      }
      if (sql.includes("SELECT COUNT(*)::int")) return { rows: [{ n: 0 }], rowCount: 1 };
      if (sql.includes("INSERT INTO audio_review_tasks")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });

    const response = await request(createApp(query)).post("/api/audio-tasks").send({
      projectId: ROOM_ID,
      versionId: VERSION_ID,
      commentId: COMMENT_ID,
      title: task.title,
    });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(TASK_ID);
    expect(linkedTaskLookups).toBe(2);
  });

  it("rejects a source comment from another room", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("SELECT 1 FROM audio_review_projects")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("SELECT 1 FROM audio_review_versions")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("SELECT c.id FROM audio_review_comments")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });

    const response = await request(createApp(query)).post("/api/audio-tasks").send({
      projectId: ROOM_ID,
      versionId: VERSION_ID,
      commentId: COMMENT_ID,
      title: task.title,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("comment_not_in_project");
  });

  it("resolves the linked feedback when a recall is completed", async () => {
    const completed = { ...task, status: "done" };
    const query = vi.fn(async (sqlValue: unknown, params?: unknown[]) => {
      const sql = String(sqlValue);
      if (sql.includes("UPDATE audio_review_tasks")) return { rows: [completed], rowCount: 1 };
      if (sql.includes("UPDATE audio_review_comments SET status=$3")) {
        expect(params).toEqual([COMMENT_ID, "producer-1", "resolved"]);
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const response = await request(createApp(query)).patch(`/api/audio-tasks/${TASK_ID}`).send({ status: "done" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("done");
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE audio_review_comments SET status=$3"))).toBe(true);
  });
});
