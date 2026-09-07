import { readFileSync } from "node:fs";
import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const projectAccess = vi.hoisted(() => ({ load: vi.fn() }));
const entitlement = vi.hoisted(() => ({ scoped: vi.fn(async () => true) }));

vi.mock("./leadgrid-project-access.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./leadgrid-project-access.js")>();
  return { ...actual, loadAccessibleLeadgridProject: projectAccess.load };
});
vi.mock("./leadgrid-entitlement-guard.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./leadgrid-entitlement-guard.js")>();
  return { ...actual, assertAnyEntitledForOrganization: entitlement.scoped };
});

import { registerRoutesAdherenceRoutes } from "./routes-adherence-routes.js";

type Route = { method: string; path: string; handler: RequestHandler };

function harness(query = vi.fn(async () => ({ rows: [], rowCount: 0 }))) {
  const routes: Route[] = [];
  const register = (method: string) => (path: string, handler: RequestHandler) => {
    routes.push({ method, path, handler });
  };
  const app = {
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
    delete: register("DELETE"),
  } as unknown as Express;
  registerRoutesAdherenceRoutes({
    app,
    pool: { query } as unknown as Pool,
    requireUserSession: vi.fn(() => ({
      userId: "route-user",
      email: "route@example.no",
      name: "Route User",
      role: "sales_manager",
    })),
  });

  return {
    query,
    request: async (
      method: string,
      path: string,
      options: {
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
        params?: Record<string, string>;
        headers?: Record<string, string>;
      } = {},
    ) => {
      const route = routes.find((candidate) =>
        candidate.method === method && candidate.path === path
      );
      if (!route) throw new Error(`missing route ${method} ${path}`);
      const req = {
        query: options.query ?? {},
        body: options.body ?? {},
        params: options.params ?? {},
        headers: options.headers ?? {},
      } as unknown as Request;
      let status = 200;
      let body: unknown;
      const res = {
        status(value: number) { status = value; return this; },
        json(value: unknown) { body = value; return this; },
      } as unknown as Response;
      await route.handler(req, res, vi.fn());
      return { status, body };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  projectAccess.load.mockResolvedValue({
    id: "dentum-oslo",
    organizationId: "11111111-1111-4111-8111-111111111111",
    name: "Dentum Oslo",
    description: null,
    industry: "86.230",
    status: "active",
    createdBy: "route-user",
    memberRole: "sales_manager",
  });
});

describe("Leadgrid route adherence project scope", () => {
  it.each([
    ["POST", "/api/leadgrid/routes/positions"],
    ["GET", "/api/leadgrid/routes/my-route"],
    ["POST", "/api/leadgrid/routes/assignments"],
    ["PATCH", "/api/leadgrid/routes/assignments/:id"],
    ["POST", "/api/leadgrid/routes/assignments/:id/visits"],
    ["GET", "/api/leadgrid/routes/team-nearby"],
    ["GET", "/api/leadgrid/routes/adherence-report"],
    ["GET", "/api/leadgrid/routes/adherence-report/team-summary"],
    ["DELETE", "/api/leadgrid/routes/positions/before"],
  ])("fails closed before querying data: %s %s", async (method, path) => {
    const h = harness();
    const result = await h.request(method, path);
    expect(result).toEqual({ status: 400, body: { error: "project_id_required" } });
    expect(projectAccess.load).not.toHaveBeenCalled();
    expect(h.query).not.toHaveBeenCalled();
  });

  it("writes a GPS batch in one scoped, retry-safe database call", async () => {
    const query = vi.fn(async () => ({ rows: [{ id: "a" }, { id: "b" }], rowCount: 2 }));
    const h = harness(query);
    const result = await h.request("POST", "/api/leadgrid/routes/positions", {
      query: { projectId: "dentum-oslo" },
      body: {
        samples: [
          { lat: 59.91, lon: 10.75, sampledAt: "2026-09-06T10:00:00.000Z" },
          { lat: 59.92, lon: 10.76, sampledAt: "2026-09-06T10:00:30.000Z" },
        ],
      },
    });
    expect(result).toEqual({
      status: 200,
      body: { inserted: 2, project_id: "dentum-oslo" },
    });
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("jsonb_to_recordset");
    expect(String(sql)).toContain("organization_id, project_id, user_id, sampled_at");
    expect(params?.slice(0, 3)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "dentum-oslo",
      "route-user",
    ]);
  });

  it("scopes adherence aggregation by both organization and project", async () => {
    const h = harness();
    const result = await h.request("GET", "/api/leadgrid/routes/adherence-report", {
      query: {
        projectId: "dentum-oslo",
        from: "2026-09-01",
        to: "2026-09-06",
      },
    });
    expect(result.status).toBe(200);
    const [sql, params] = h.query.mock.calls[0];
    expect(String(sql)).toContain("a.organization_id = $1::uuid");
    expect(String(sql)).toContain("a.project_id = $2");
    expect(String(sql)).toContain("v.project_id = a.project_id");
    expect(params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "dentum-oslo",
      "route-user",
      "2026-09-01",
      "2026-09-06",
    ]);
  });

  it("keeps schema and iOS project contracts explicit", () => {
    const route = readFileSync(new URL("./routes-adherence-routes.ts", import.meta.url), "utf8");
    const migration = readFileSync(
      new URL("../migrations/0546_leadgrid_routes_adherence_project_scope.sql", import.meta.url),
      "utf8",
    );
    const client = readFileSync(
      new URL("../../ipad/LeadMapApp/LeadMapApp/Core/APIClient+Routes.swift", import.meta.url),
      "utf8",
    );
    expect(route).not.toContain("resolveOrgIdForUser");
    expect(route).not.toMatch(/CREATE TABLE|ALTER TABLE/i);
    for (const fragment of [
      "leadgrid_positions_project_required_check",
      "leadgrid_assignments_project_required_check",
      "leadgrid_visits_project_required_check",
      "uq_route_assignments_idempotency",
      "uq_route_visits_idempotency",
      "enforce_leadgrid_route_project_scope",
    ]) expect(migration).toContain(fragment);
    expect(client).toContain("URLQueryItem(name: \"projectId\"");
    expect(client).toContain("\"Idempotency-Key\"");
    expect(client).not.toContain("CreateLeadAtPositionPayload");
  });
});
