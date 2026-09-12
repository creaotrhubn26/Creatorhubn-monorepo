import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { setupProjectTeamRoutes } from "./project-team-routes";

describe("project team store compatibility", () => {
  it("loads a public-project owner even when the legacy schema is denied", async () => {
    const queries: string[] = [];
    const pool = {
      query: async (sql: string, params: unknown[] = []) => {
        queries.push(sql);
        if (sql.includes("SELECT 1 FROM projects")) {
          return { rows: [{ ok: 1 }], rowCount: 1 };
        }
        if (sql.includes("SELECT 1 FROM legacy.projects")) {
          throw Object.assign(new Error("permission denied for schema legacy"), { code: "42501" });
        }
        if (sql.includes("SELECT p.user_id::text AS user_id")) {
          return {
            rows: [{
              user_id: "owner-user",
              email: "owner@example.test",
              first_name: "Ola",
              last_name: "Eier",
            }],
            rowCount: 1,
          };
        }
        if (sql.includes("WITH participants AS")) {
          return {
            rows: [{
              user_id: params[1],
              email: params[2],
              name: params[3],
              crew_role: null,
              online: true,
              online_globally: true,
              current_route: "/workspace/project-1/sound-room",
            }],
            rowCount: 1,
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

    const response = await request(app).get("/api/projects/project-1/team/members");
    expect(response.status).toBe(200);
    expect(response.body.owner).toEqual(expect.objectContaining({
      userId: "owner-user",
      name: "Ola Eier",
      isOwner: true,
    }));
    expect(queries.some((sql) =>
      sql.includes("FROM legacy.projects lp LEFT JOIN users")
      && !sql.includes("SELECT 1 FROM legacy.projects"),
    )).toBe(false);

    const presence = await request(app).get("/api/projects/project-1/team/presence");
    expect(presence.status).toBe(200);
    expect(presence.body).toEqual(expect.objectContaining({
      online: 1,
      members: [expect.objectContaining({
        userId: "owner-user",
        currentRoute: "/workspace/project-1/sound-room",
      })],
    }));
    expect(queries.some((sql) =>
      sql.includes("FROM legacy.projects lp")
      && !sql.includes("SELECT 1 FROM legacy.projects"),
    )).toBe(false);
  });
});
