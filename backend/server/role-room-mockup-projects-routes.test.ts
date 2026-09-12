import { describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import type { Pool } from "pg";

import { registerRoleRoomMockupProjectsRoutes } from "./role-room-mockup-projects-routes";

type QueryResult = { rows: any[]; rowCount?: number };

function makePool(opts: {
  list?: any[];
  payload?: any | null;
  exists?: boolean;
  count?: number;
  savedRowCount?: number;
  schemaInitFails?: boolean;
} = {}): Pool {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]): Promise<QueryResult> => {
      const normalized = sql.toLowerCase();
      if (normalized.includes("create table") || normalized.includes("create index")) {
        if (opts.schemaInitFails) throw new Error("permission denied for schema public");
        return { rows: [], rowCount: 0 };
      }
      if (normalized.includes("select id, name, status")) {
        return { rows: opts.list ?? [], rowCount: (opts.list ?? []).length };
      }
      if (normalized.includes("select payload")) {
        return { rows: opts.payload ? [{ payload: opts.payload }] : [], rowCount: opts.payload ? 1 : 0 };
      }
      if (normalized.includes("select 1 from demo_studio_mockup_projects")) {
        return { rows: opts.exists ? [{ "?column?": 1 }] : [], rowCount: opts.exists ? 1 : 0 };
      }
      if (normalized.includes("select count(*)")) {
        return { rows: [{ count: opts.count ?? 0 }], rowCount: 1 };
      }
      if (normalized.includes("insert into demo_studio_mockup_projects")) {
        const rowCount = opts.savedRowCount ?? 1;
        return { rows: rowCount ? [{ project_updated_at: params?.[5] }] : [], rowCount };
      }
      if (normalized.includes("delete from demo_studio_mockup_projects")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  } as unknown as Pool;
}

function makeApp(pool: Pool): Express {
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  registerRoleRoomMockupProjectsRoutes(app, {
    pool,
    activeSessions: new Map([
      ["token-1", { userId: "user-1", email: "one@example.no" }],
      ["token-2", { userId: "user-2", email: "two@example.no" }],
    ]),
  });
  return app;
}

function validProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    name: "PreVisit",
    version: 1,
    template: "previsit_campaign_1",
    updatedAt: 1_787_500_000_000,
    status: "draft",
    canvas: { background: "dark", accent: "#00aaff", accent2: "#ffffff" },
    devices: [],
    texts: [],
    ...overrides,
  };
}

describe("Role Room Mockup Studio cloud projects", () => {
  it("requires a valid bearer session", async () => {
    const response = await request(makeApp(makePool())).get("/api/role-room/mockup-projects");
    expect(response.status).toBe(401);
  });

  it("uses the migrated table when the runtime role cannot execute DDL", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const pool = makePool({ schemaInitFails: true });
    const response = await request(makeApp(pool))
      .get("/api/role-room/mockup-projects")
      .set("Authorization", "Bearer token-1");
    warn.mockRestore();

    expect(response.status).toBe(200);
    expect(vi.mocked(pool.query).mock.calls.some(([sql]) =>
      String(sql).includes("SELECT 1 FROM demo_studio_mockup_projects LIMIT 0"),
    )).toBe(true);
  });

  it("lists only the authenticated owner's metadata", async () => {
    const pool = makePool({
      list: [{
        id: "doc-1",
        name: "PreVisit",
        status: "draft",
        template_id: "previsit_campaign_1",
        project_updated_at: "1787500000000",
        updated_at: new Date("2026-08-27T12:00:00Z"),
      }],
    });
    const response = await request(makeApp(pool))
      .get("/api/role-room/mockup-projects")
      .set("Authorization", "Bearer token-1");

    expect(response.status).toBe(200);
    expect(response.body.projects[0]).toMatchObject({
      id: "doc-1",
      projectUpdatedAt: 1_787_500_000_000,
    });
    const listCall = vi.mocked(pool.query).mock.calls.find(([sql]) =>
      String(sql).includes("SELECT id, name, status"),
    );
    expect(listCall?.[1]).toEqual(["user-1", 100]);
  });

  it("scopes a full-project lookup to id and owner", async () => {
    const project = validProject();
    const pool = makePool({ payload: project });
    const response = await request(makeApp(pool))
      .get("/api/role-room/mockup-projects/doc-1")
      .set("Authorization", "Bearer token-2");

    expect(response.status).toBe(200);
    expect(response.body.project).toMatchObject({ id: "doc-1" });
    const lookup = vi.mocked(pool.query).mock.calls.find(([sql]) =>
      String(sql).includes("SELECT payload"),
    );
    expect(lookup?.[1]).toEqual(["doc-1", "user-2"]);
  });

  it("rejects a route id that does not match the payload", async () => {
    const response = await request(makeApp(makePool()))
      .put("/api/role-room/mockup-projects/doc-2")
      .set("Authorization", "Bearer token-1")
      .send({ project: validProject() });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("ugyldig_prosjekt");
  });

  it("upserts a valid project with owner scope and client timestamp", async () => {
    const pool = makePool();
    const project = validProject();
    const response = await request(makeApp(pool))
      .put("/api/role-room/mockup-projects/doc-1")
      .set("Authorization", "Bearer token-1")
      .send({ project });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, updated: true });
    const insert = vi.mocked(pool.query).mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO demo_studio_mockup_projects"),
    );
    expect(insert?.[1]?.slice(0, 6)).toEqual([
      "doc-1",
      "user-1",
      "PreVisit",
      "draft",
      "previsit_campaign_1",
      1_787_500_000_000,
    ]);
    expect(String(insert?.[0])).toContain(
      "demo_studio_mockup_projects.project_updated_at < EXCLUDED.project_updated_at",
    );
  });

  it("reports a stale write without overwriting the newer row", async () => {
    const response = await request(makeApp(makePool({ exists: true, savedRowCount: 0 })))
      .put("/api/role-room/mockup-projects/doc-1")
      .set("Authorization", "Bearer token-1")
      .send({ project: validProject() });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, updated: false });
  });

  it("enforces the per-user project limit for new ids", async () => {
    const response = await request(makeApp(makePool({ count: 100 })))
      .put("/api/role-room/mockup-projects/doc-1")
      .set("Authorization", "Bearer token-1")
      .send({ project: validProject() });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("prosjektgrense");
  });

  it("deletes only the authenticated owner's row", async () => {
    const pool = makePool();
    const response = await request(makeApp(pool))
      .delete("/api/role-room/mockup-projects/doc-1")
      .set("Authorization", "Bearer token-2");

    expect(response.status).toBe(200);
    const deletion = vi.mocked(pool.query).mock.calls.find(([sql]) =>
      String(sql).includes("DELETE FROM demo_studio_mockup_projects"),
    );
    expect(deletion?.[1]).toEqual(["doc-1", "user-2"]);
  });
});
