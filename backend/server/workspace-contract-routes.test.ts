import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { setupPresenceHeartbeatRoutes } from "./presence-heartbeat-routes";
import { setupProjectTeamRoutes } from "./project-team-routes";
import { setupProjectWorkspaceRoutes } from "./project-workspace-routes";
import { setupProjectsOutliersRoutes } from "./projects-outliers-routes";

const milestoneRow = {
  id: "milestone-1",
  project_id: "project-1",
  title: "Opptaksdag",
  description: null,
  category: "Produksjon",
  type: "milestone",
  due_date: "2026-09-14",
  scheduled_date: null,
  status: "planned",
  progress: 0,
  priority: "medium",
  location: "Oslo",
  internal_notes: null,
  created_at: "2026-08-26T00:00:00.000Z",
  updated_at: "2026-08-26T00:00:00.000Z",
};

function milestoneApp() {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes("SELECT 1 FROM projects")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT role, permissions")) {
        const userId = String(params[1]);
        const canEdit = userId === "editor-user";
        return {
          rows: [{ role: canEdit ? "member" : "viewer", permissions: { canRead: true, canEdit } }],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE project_milestones")) {
        return { rows: [{ ...milestoneRow, status: "completed", progress: 100 }], rowCount: 1 };
      }
      if (sql.includes("DELETE FROM project_milestones")) {
        return { rows: [{ id: milestoneRow.id }], rowCount: 1 };
      }
      if (sql.includes("SELECT * FROM project_milestones")) {
        return { rows: [milestoneRow], rowCount: 1 };
      }
      // Runtime team-schema bootstrap and unrelated registered routes.
      return { rows: [], rowCount: 0 };
    },
  };
  const app = express();
  app.use(express.json());
  setupProjectsOutliersRoutes({
    app,
    pool: pool as any,
    db: {} as any,
    requireUserSession: (req: express.Request, res: express.Response) => {
      const userId = String(req.headers["x-test-user"] || "");
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return null;
      }
      return { userId, email: `${userId}@example.test`, name: userId, role: "user" };
    },
  });
  return { app, queries };
}

describe("workspace milestone contract", () => {
  it("lets a viewer read the canonical milestone response", async () => {
    const { app } = milestoneApp();
    const response = await request(app)
      .get("/api/projects/project-1/milestones")
      .set("x-test-user", "viewer-user");

    expect(response.status).toBe(200);
    expect(response.body.milestones).toEqual([
      expect.objectContaining({ id: "milestone-1", dueDate: "2026-09-14", progress: 0 }),
    ]);
  });

  it("blocks a viewer from milestone mutations", async () => {
    const { app, queries } = milestoneApp();
    const response = await request(app)
      .patch("/api/projects/project-1/milestones/milestone-1")
      .set("x-test-user", "viewer-user")
      .send({ status: "completed" });

    expect(response.status).toBe(404);
    expect(queries.some((q) => q.sql.includes("UPDATE project_milestones"))).toBe(false);
  });

  it("lets an editor patch and delete a milestone scoped to the project", async () => {
    const { app, queries } = milestoneApp();
    const patchResponse = await request(app)
      .patch("/api/projects/project-1/milestones/milestone-1")
      .set("x-test-user", "editor-user")
      .send({ status: "completed", progress: 100 });
    const deleteResponse = await request(app)
      .delete("/api/projects/project-1/milestones/milestone-1")
      .set("x-test-user", "editor-user");

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body).toEqual(expect.objectContaining({ status: "completed", progress: 100 }));
    expect(deleteResponse.status).toBe(200);
    const update = queries.find((q) => q.sql.includes("UPDATE project_milestones"));
    expect(update?.sql).toContain("project_id");
    expect(update?.params).toContain("project-1");
  });
});

describe("presence heartbeat contract", () => {
  it("persists route and accepts the legacy currentRoute key during rollout", async () => {
    const calls: unknown[][] = [];
    const app = express();
    app.use(express.json());
    setupPresenceHeartbeatRoutes({
      app,
      pool: { query: async (_sql: string, params: unknown[]) => { calls.push(params); return { rows: [] }; } } as any,
      getActiveSessionFromRequest: () => ({ userId: "user-1" } as any),
    });

    expect((await request(app).post("/api/presence/heartbeat").send({ route: "/workspace/p/photo-room" })).status).toBe(200);
    expect((await request(app).post("/api/presence/heartbeat").send({ currentRoute: "/workspace/p/video-room" })).status).toBe(200);
    expect(calls[0][1]).toBe("/workspace/p/photo-room");
    expect(calls[1][1]).toBe("/workspace/p/video-room");
  });
});

describe("team presence response", () => {
  it("counts the owner and exposes each active participant's current route", async () => {
    const pool = {
      query: async (sql: string) => {
        if (sql.includes("SELECT 1 FROM projects")) return { rows: [{ ok: 1 }], rowCount: 1 };
        if (sql.includes("WITH participants AS")) {
          return {
            rows: [
              {
                user_id: "owner-user",
                email: "owner@example.test",
                name: "Owner",
                crew_role: null,
                online: true,
                current_route: "/workspace/project-1/photo-room",
              },
              {
                user_id: "editor-user",
                email: "editor@example.test",
                name: "Editor",
                crew_role: "editor",
                online: true,
                current_route: "/workspace/project-1/video-room",
              },
            ],
            rowCount: 2,
          };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    const app = express();
    setupProjectTeamRoutes({
      app,
      pool,
      requireUserSession: () => ({
        userId: "owner-user",
        email: "owner@example.test",
        name: "Owner",
        role: "user",
      }),
      escapeHtml: (value) => value,
    });

    const response = await request(app).get("/api/projects/project-1/team/presence");
    expect(response.status).toBe(200);
    expect(response.body.online).toBe(2);
    expect(response.body.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: "owner-user", currentRoute: "/workspace/project-1/photo-room" }),
      expect.objectContaining({ userId: "editor-user", currentRoute: "/workspace/project-1/video-room" }),
    ]));
  });
});

describe("workspace mutation guard", () => {
  it("allows a viewer to read but rejects project-content mutations", async () => {
    const pool = {
      query: async (sql: string) => {
        if (sql.includes("SELECT 1 FROM projects")) return { rows: [], rowCount: 0 };
        if (sql.includes("SELECT role, permissions")) {
          return {
            rows: [{ role: "viewer", permissions: { canRead: true, canEdit: false } }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    const app = express();
    app.use(express.json());
    setupProjectWorkspaceRoutes({
      app,
      pool,
      requireUserSession: () => ({
        userId: "viewer-user",
        email: "viewer@example.test",
        name: "Viewer",
        role: "user",
      }),
    });

    const response = await request(app)
      .post("/api/projects/project-1/board-tasks")
      .send({ title: "Skal ikke lagres" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "read_only_access" });
  });
});
