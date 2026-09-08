import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { setupWorkflowOrchestrationRoutes } from "./workflow-orchestration-routes";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const INTRUDER_ID = "22222222-2222-4222-8222-222222222222";

function buildApp(userId = OWNER_ID) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes("FROM projects p") && sql.includes("p.id::text = $1")) {
        return {
          rows: [{
            id: "project-1",
            user_id: OWNER_ID,
            title: "Sound Room",
            category: "music",
            _project_source: "public",
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("SELECT 1 FROM projects")) {
        const owns = params[1] === OWNER_ID;
        return { rows: owns ? [{ ok: 1 }] : [], rowCount: owns ? 1 : 0 };
      }
      if (sql.includes("SELECT 1 FROM legacy.projects")) {
        throw Object.assign(new Error("permission denied for schema legacy"), { code: "42501" });
      }
      if (sql.includes("UPDATE projects") && sql.includes("project_data")) {
        return { rows: [{ id: "project-1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
  const app = express();
  app.use(express.json());
  setupWorkflowOrchestrationRoutes({
    app,
    pool: pool as any,
    requireUserSession: (_req, _res) => ({ userId }),
  });
  return { app, calls };
}

describe("workflow orchestration project compatibility", () => {
  it("links showcase metadata to a public project when legacy access is denied", async () => {
    const { app, calls } = buildApp();
    const response = await request(app)
      .post("/api/showcase/auto-create")
      .send({ projectId: "project-1" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      success: true,
      projectId: "project-1",
      projectTitle: "Sound Room",
    }));
    const update = calls.find((call) =>
      call.sql.includes("UPDATE projects") && call.sql.includes("project_data"),
    );
    expect(update?.params[1]).toBe("project-1");
    expect(calls.some((call) => call.sql.includes("UPDATE legacy.projects"))).toBe(false);
  });

  it("does not mutate a public project for a user without edit access", async () => {
    const { app, calls } = buildApp(INTRUDER_ID);
    const response = await request(app)
      .post("/api/showcase/auto-create")
      .send({ projectId: "project-1" });

    expect(response.status).toBe(404);
    expect(calls.some((call) => call.sql.includes("UPDATE projects"))).toBe(false);
    expect(calls.some((call) => call.sql.includes("UPDATE legacy.projects"))).toBe(false);
  });
});
