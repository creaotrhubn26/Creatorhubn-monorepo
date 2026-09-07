import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadProject: vi.fn(),
  loadLead: vi.fn(),
  permissions: vi.fn(),
  notify: vi.fn(),
  loadTerritories: vi.fn(),
}));

vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: mocks.loadProject,
}));
vi.mock("./leadgrid-lead-access.js", () => ({
  loadAccessibleLeadgridLead: mocks.loadLead,
}));
vi.mock("./lead-map-permission-routes.js", () => ({
  resolveEffectivePermissions: mocks.permissions,
}));
vi.mock("./lead-map-notification-service.js", () => ({
  notifyLeadAssigned: mocks.notify,
}));
vi.mock("./leadgrid-territory-service.js", () => ({
  loadOrgTerritories: mocks.loadTerritories,
  resolveLeadTerritories: vi.fn(() => []),
  pickBestTerritory: vi.fn(() => null),
}));

import { registerLeadMapWorkloadRoutes } from "./lead-map-workload-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const leadId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";
const project = {
  id: projectId,
  organizationId,
  name: "Dentum Oslo",
  description: null,
  industry: null,
  status: "active",
  createdBy: "user-a",
  memberRole: "owner",
};

function setup(query = vi.fn()) {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get(path: string, ...handlers: RequestHandler[]) {
      routes.set(`GET ${path}`, handlers.at(-1)!);
    },
    post(path: string, ...handlers: RequestHandler[]) {
      routes.set(`POST ${path}`, handlers.at(-1)!);
    },
  } as unknown as Express;
  registerLeadMapWorkloadRoutes({
    app,
    pool: { query } as unknown as Pool,
    activeSessions: new Map([["token", { userId: "user-a" }]]),
  });
  return { routes, query };
}

function response() {
  let status = 200;
  let body: any;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;
  return { res, get status() { return status; }, get body() { return body; } };
}

function request(input: {
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}): Request {
  return {
    headers: { authorization: "Bearer token" },
    params: input.params ?? {},
    query: input.query ?? {},
    body: input.body ?? {},
  } as unknown as Request;
}

describe("Leadgrid workload customer-project scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadProject.mockResolvedValue(project);
    mocks.loadLead.mockResolvedValue({ id: leadId, organizationId, projectId });
    mocks.permissions.mockResolvedValue({
      role: "salgssjef",
      permissions: new Set(["leads.assign"]),
    });
    mocks.loadTerritories.mockResolvedValue([]);
  });

  it("requires an explicit project for the workload", async () => {
    const { routes, query } = setup();
    const out = response();

    await routes.get("GET /api/admin-room/lead-map/me/workload")!(
      request({ query: { organization_id: organizationId } }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "project_id_required" });
    expect(query).not.toHaveBeenCalled();
  });

  it("does not query assigned leads when the project is hidden", async () => {
    mocks.loadProject.mockResolvedValue(null);
    const { routes, query } = setup();
    const out = response();

    await routes.get("GET /api/admin-room/lead-map/me/workload")!(
      request({ query: { project_id: projectId } }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  it("binds workload data to caller, organization and project", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const { routes } = setup(query);
    const out = response();

    await routes.get("GET /api/admin-room/lead-map/me/workload")!(
      request({
        query: { organization_id: organizationId, project_id: projectId },
      }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("c.organization_id = $2::uuid");
    expect(String(sql)).toContain("c.project_id = $3");
    expect(params).toEqual(["user-a", organizationId, projectId]);
    expect(out.body.projectId).toBe(projectId);
  });

  it("rejects assignment when the target cannot access the same project", async () => {
    mocks.loadProject.mockResolvedValue(null);
    const { routes, query } = setup();
    const out = response();

    await routes.get("POST /api/admin-room/lead-map/leads/:id/assign")!(
      request({ params: { id: leadId }, body: { user_id: "user-b" } }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "mottaker_mangler_prosjekttilgang" });
    expect(query).not.toHaveBeenCalled();
  });

  it("binds assignment mutation and audit to the persisted tuple", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ assigned_user_id: null }] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const { routes } = setup(query);
    const out = response();

    await routes.get("POST /api/admin-room/lead-map/leads/:id/assign")!(
      request({ params: { id: leadId }, body: { user_id: "user-b" } }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    const [updateSql, updateParams] = query.mock.calls[1];
    expect(String(updateSql)).toContain("organization_id = $2::uuid");
    expect(String(updateSql)).toContain("project_id = $3");
    expect(updateParams).toEqual([
      leadId,
      organizationId,
      projectId,
      "user-b",
      "user-a",
    ]);
    expect(query.mock.calls[2][1][1]).toBe(organizationId);
  });
});
