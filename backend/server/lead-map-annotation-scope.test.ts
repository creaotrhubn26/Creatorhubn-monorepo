import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const leadAccessMocks = vi.hoisted(() => ({ load: vi.fn() }));
const projectAccessMocks = vi.hoisted(() => ({ load: vi.fn() }));
const projectScopeMocks = vi.hoisted(() => ({
  requested: vi.fn(),
  resolve: vi.fn(),
  sendError: vi.fn(),
}));

vi.mock("./leadgrid-lead-access.js", () => ({
  loadAccessibleLeadgridLead: leadAccessMocks.load,
}));
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: projectAccessMocks.load,
}));
vi.mock("./lead-map-project-scope.js", () => ({
  requestedLeadMapProjectId: projectScopeMocks.requested,
  resolveLeadMapProjectScope: projectScopeMocks.resolve,
  sendLeadMapProjectScopeError: projectScopeMocks.sendError,
}));

import { registerLeadMapAnnotationRoutes } from "./lead-map-annotation-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const foreignOrganizationId = "22222222-2222-4222-8222-222222222222";
const leadId = "33333333-3333-4333-8333-333333333333";
const annotationId = "44444444-4444-4444-8444-444444444444";
const projectId = "dentum-project";

type RegisteredRoute = {
  method: string;
  path: string;
  handler: RequestHandler;
};

function defaultQuery(sql: unknown) {
  const text = String(sql);
  if (text.includes("SELECT role FROM organization_members")) {
    return Promise.resolve({ rows: [{ role: "admin" }] });
  }
  if (text.includes("INSERT INTO map_annotations")) {
    return Promise.resolve({ rows: [{ id: annotationId }], rowCount: 1 });
  }
  return Promise.resolve({ rows: [], rowCount: 0 });
}

function setupHarness(query = vi.fn(defaultQuery)) {
  const routes: RegisteredRoute[] = [];
  const register =
    (method: string) =>
    (path: string, ...handlers: RequestHandler[]) =>
      routes.push({ method, path, handler: handlers.at(-1)! });
  const app = {
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
    delete: register("DELETE"),
  } as unknown as Express;
  const pool = { query } as unknown as Pool;
  registerLeadMapAnnotationRoutes({
    app,
    pool,
    activeSessions: new Map([["token-a", { userId: "user-a" }]]),
  });
  return {
    pool,
    query,
    route(method: string, path: string) {
      const route = routes.find(
        (candidate) => candidate.method === method && candidate.path === path,
      );
      if (!route) throw new Error(`Missing ${method} ${path}`);
      return route.handler;
    },
  };
}

function request(
  options: {
    id?: string;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
  } = {},
): Request {
  return {
    headers: { authorization: "Bearer token-a" },
    params: { id: options.id ?? organizationId },
    query: options.query ?? {},
    body: options.body ?? {},
  } as unknown as Request;
}

function responseHarness() {
  let status = 200;
  let body: unknown;
  const response = {} as Response;
  response.status = vi.fn((value: number) => {
    status = value;
    return response;
  });
  response.json = vi.fn((value: unknown) => {
    body = value;
    return response;
  });
  return { response, status: () => status, body: () => body };
}

beforeEach(() => {
  vi.clearAllMocks();
  projectScopeMocks.requested.mockReturnValue(projectId);
  projectScopeMocks.resolve.mockResolvedValue({
    organizationId,
    projectId,
  });
  projectScopeMocks.sendError.mockReturnValue(false);
  projectAccessMocks.load.mockResolvedValue({
    id: projectId,
    organizationId,
  });
  leadAccessMocks.load.mockResolvedValue({
    id: leadId,
    organizationId,
    projectId,
  });
});

describe("Lead Map annotation project scope", () => {
  it("scopes list rows and target-lead names to the exact project tuple", async () => {
    const harness = setupHarness();
    const result = responseHarness();

    await harness.route(
      "GET",
      "/api/admin-room/lead-map/organizations/:id/annotations",
    )(request({ query: { project_id: projectId } }), result.response, vi.fn());

    const listCall = harness.query.mock.calls.find(([sql]) =>
      String(sql).includes("FROM map_annotations a"),
    );
    expect(listCall).toBeDefined();
    expect(String(listCall?.[0])).toContain(
      "target_lead.organization_id = a.organization_id",
    );
    expect(String(listCall?.[0])).toContain(
      "target_lead.project_id IS NOT DISTINCT FROM a.project_id",
    );
    expect(String(listCall?.[0])).toContain(
      "a.project_id IS NOT DISTINCT FROM $2",
    );
    expect(listCall?.[1]).toEqual([organizationId, projectId]);
    expect(result.status()).toBe(200);
  });

  it("returns only organization-global annotations when legacy clients omit project_id", async () => {
    projectScopeMocks.requested.mockReturnValue(null);
    projectScopeMocks.resolve.mockResolvedValue({
      organizationId,
      projectId: null,
    });
    const harness = setupHarness();
    const result = responseHarness();

    await harness.route(
      "GET",
      "/api/admin-room/lead-map/organizations/:id/annotations",
    )(request(), result.response, vi.fn());

    const listCall = harness.query.mock.calls.find(([sql]) =>
      String(sql).includes("FROM map_annotations a"),
    );
    expect(listCall?.[1]).toEqual([organizationId, null]);
  });

  it("fails closed for a same-organization project hidden from the caller", async () => {
    projectScopeMocks.resolve.mockRejectedValue(new Error("hidden project"));
    projectScopeMocks.sendError.mockImplementation((_error, res: Response) => {
      res.status(404).json({ error: "project_not_found" });
      return true;
    });
    const harness = setupHarness();
    const result = responseHarness();

    await harness.route(
      "GET",
      "/api/admin-room/lead-map/organizations/:id/annotations",
    )(
      request({ query: { project_id: "hidden-project" } }),
      result.response,
      vi.fn(),
    );

    expect(result.status()).toBe(404);
    expect(
      harness.query.mock.calls.some(([sql]) =>
        String(sql).includes("FROM map_annotations a"),
      ),
    ).toBe(false);
  });

  it("rejects a target lead from another project", async () => {
    leadAccessMocks.load.mockResolvedValue({
      id: leadId,
      organizationId,
      projectId: "another-project",
    });
    const harness = setupHarness();
    const result = responseHarness();

    await harness.route(
      "POST",
      "/api/admin-room/lead-map/organizations/:id/annotations",
    )(
      request({
        body: {
          annotation_type: "pin_callout",
          geometry: { type: "Point", coordinates: [10.75, 59.91] },
          project_id: projectId,
          target_lead_id: leadId,
        },
      }),
      result.response,
      vi.fn(),
    );

    expect(result.status()).toBe(400);
    expect(result.body()).toEqual({ error: "target_lead_scope_mismatch" });
    expect(
      harness.query.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO map_annotations"),
      ),
    ).toBe(false);
  });

  it("rejects a foreign target UUID without revealing the lead", async () => {
    leadAccessMocks.load.mockResolvedValue(null);
    const harness = setupHarness();
    const result = responseHarness();

    await harness.route(
      "POST",
      "/api/admin-room/lead-map/organizations/:id/annotations",
    )(
      request({
        body: {
          annotation_type: "pin_callout",
          geometry: { type: "Point", coordinates: [10.75, 59.91] },
          project_id: projectId,
          target_lead_id: leadId,
        },
      }),
      result.response,
      vi.fn(),
    );

    expect(result.status()).toBe(404);
    expect(result.body()).toEqual({ error: "target_lead_not_found" });
  });

  it("ignores spoofed organization data and persists the validated scope", async () => {
    const harness = setupHarness();
    const result = responseHarness();

    await harness.route(
      "POST",
      "/api/admin-room/lead-map/organizations/:id/annotations",
    )(
      request({
        body: {
          annotation_type: "focus_area",
          geometry: { type: "Polygon", coordinates: [] },
          project_id: projectId,
          organization_id: foreignOrganizationId,
        },
      }),
      result.response,
      vi.fn(),
    );

    const insert = harness.query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO map_annotations"),
    );
    expect(insert?.[1]?.[0]).toBe(organizationId);
    expect(insert?.[1]).not.toContain(foreignOrganizationId);
    expect(result.status()).toBe(200);
  });

  it("rejects an assignee without membership in the annotation organization", async () => {
    const query = vi.fn((sql: unknown) => {
      const text = String(sql);
      if (text.includes("SELECT role FROM organization_members")) {
        return Promise.resolve({ rows: [{ role: "admin" }] });
      }
      if (text.includes("SELECT 1") && text.includes("organization_members")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    const harness = setupHarness(query);
    const result = responseHarness();

    await harness.route(
      "POST",
      "/api/admin-room/lead-map/organizations/:id/annotations",
    )(
      request({
        body: {
          annotation_type: "route",
          geometry: { type: "LineString", coordinates: [] },
          project_id: projectId,
          assigned_to_user_id: "foreign-user",
        },
      }),
      result.response,
      vi.fn(),
    );

    expect(result.status()).toBe(400);
    expect(result.body()).toEqual({ error: "assignee_not_in_organization" });
  });

  it("denies mutation of an annotation in a hidden project", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          id: annotationId,
          organization_id: organizationId,
          project_id: "hidden-project",
          created_by_user_id: "user-a",
        },
      ],
    });
    projectAccessMocks.load.mockResolvedValue(null);
    const harness = setupHarness(query);
    const result = responseHarness();

    await harness.route("PATCH", "/api/admin-room/lead-map/annotations/:id")(
      request({ id: annotationId, body: { title: "Ikke tillatt" } }),
      result.response,
      vi.fn(),
    );

    expect(result.status()).toBe(404);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
