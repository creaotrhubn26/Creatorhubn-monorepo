import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { setupAdminWorkspaceTasksRoutes } from "./admin-workspace-tasks-routes";

const USER_ID = "admin-user-a";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function createTestApp(query = vi.fn()) {
  const app = express();
  app.use(express.json());
  const logAdminActivity = vi.fn(async () => undefined);
  setupAdminWorkspaceTasksRoutes({
    app,
    pool: { query } as unknown as Pool,
    getActiveSessionFromRequest: () => ({ userId: USER_ID, email: "admin@example.com" }),
    requireAdminRoomAccess: () => ({ userId: USER_ID, email: "admin@example.com" }),
    logAdminActivity,
  });
  return { app, query, logAdminActivity };
}

describe("admin workspace tasks routes", () => {
  it("scoper oppgavelisten til innlogget bruker", async () => {
    const { app, query } = createTestApp(
      vi.fn().mockResolvedValue({ rows: [] }),
    );

    const response = await request(app)
      .get("/api/admin-room/workspace/tasks?product=leadgrid&openOnly=true")
      .expect(200);

    expect(response.body).toEqual({ items: [] });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("t.user_id = $1");
    expect(query.mock.calls[0][1][0]).toBe(USER_ID);
    expect(query.mock.calls[0][1]).toContain("leadgrid");
  });

  it("avviser tom tittel før databasen kalles", async () => {
    const { app, query } = createTestApp();

    const response = await request(app)
      .post("/api/admin-room/workspace/tasks")
      .send({ title: "   " })
      .expect(400);

    expect(response.body.error).toContain("title");
    expect(query).not.toHaveBeenCalled();
  });

  it("avviser ugyldig prosjekt-ID før databasen kalles", async () => {
    const { app, query } = createTestApp();

    const response = await request(app)
      .post("/api/admin-room/workspace/tasks")
      .send({ title: "Testoppgave", projectId: "ikke-en-uuid" })
      .expect(400);

    expect(response.body.error).toContain("projectId");
    expect(query).not.toHaveBeenCalled();
  });

  it("avviser prosjekt fra et annet produkt", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ id: PROJECT_ID, title: "Role Room-prosjekt", product_key: "role_room" }],
    });
    const { app } = createTestApp(query);

    const response = await request(app)
      .post("/api/admin-room/workspace/tasks")
      .send({
        title: "Leadgrid-oppgave",
        productKey: "leadgrid",
        projectId: PROJECT_ID,
      })
      .expect(400);

    expect(response.body.error).toContain("samme produkt");
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([PROJECT_ID, USER_ID]);
  });

  it("returnerer 404 når oppgaven ikke tilhører brukeren", async () => {
    const { app, query } = createTestApp(
      vi.fn().mockResolvedValue({ rows: [] }),
    );

    await request(app)
      .patch(`/api/admin-room/workspace/tasks/${PROJECT_ID}`)
      .send({ status: "done" })
      .expect(404);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([PROJECT_ID, USER_ID]);
  });
});
