import { readFileSync } from "node:fs";
import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadProject: vi.fn(),
  loadLead: vi.fn(),
  executeWorkflow: vi.fn(),
  publishEvent: vi.fn(),
  emitWebhook: vi.fn(),
}));

vi.mock("./leadgrid-project-access.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("./leadgrid-project-access.js")
  >();
  return {
    ...actual,
    loadAccessibleLeadgridProject: mocks.loadProject,
  };
});
vi.mock("./leadgrid-lead-access.js", () => ({
  loadAccessibleLeadgridLead: mocks.loadLead,
}));
vi.mock("./leadgrid-workflow-engine.js", () => ({
  executeWorkflow: mocks.executeWorkflow,
  publishEvent: mocks.publishEvent,
}));
vi.mock("./webhook-emitter.js", () => ({
  emitWebhook: mocks.emitWebhook,
}));

import { registerLeadgridWorkflowRoutes } from "./leadgrid-workflow-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const workflowId = "22222222-2222-4222-8222-222222222222";
const leadA = "33333333-3333-4333-8333-333333333333";
const leadB = "44444444-4444-4444-8444-444444444444";
const projectId = "dentum-oslo";
const userId = "workflow-user";

const project = {
  id: projectId,
  organizationId,
  name: "Dentum – klinikkpilot Oslo og omegn",
  description: null,
  industry: null,
  status: "active",
  createdBy: userId,
  memberRole: "owner",
};

const workflowRow = {
  id: workflowId,
  organization_id: organizationId,
  project_id: projectId,
  name: "Dentum-oppfølging",
  trigger_type: "manual",
  trigger_config: { type: "manual" },
  conditions: [],
  actions: [],
  is_active: true,
};

function setup(query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })) {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get(path: string, ...handlers: RequestHandler[]) {
      routes.set(`GET ${path}`, handlers.at(-1)!);
    },
    post(path: string, ...handlers: RequestHandler[]) {
      routes.set(`POST ${path}`, handlers.at(-1)!);
    },
    patch(path: string, ...handlers: RequestHandler[]) {
      routes.set(`PATCH ${path}`, handlers.at(-1)!);
    },
    delete(path: string, ...handlers: RequestHandler[]) {
      routes.set(`DELETE ${path}`, handlers.at(-1)!);
    },
  } as unknown as Express;
  const pool = { query } as unknown as Pool;
  registerLeadgridWorkflowRoutes({
    app,
    pool,
    activeSessions: new Map([["token", { userId }]]),
  });
  return { routes, query };
}

function request(input: {
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
} = {}): Request {
  return {
    headers: { authorization: "Bearer token" },
    params: input.params ?? {},
    query: input.query ?? {},
    body: input.body ?? {},
  } as unknown as Request;
}

function response() {
  let status = 200;
  let body: unknown;
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
  return {
    res,
    get status() {
      return status;
    },
    get body() {
      return body;
    },
  };
}

describe("Leadgrid workflow project scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadProject.mockImplementation(
      async (_pool: Pool, requestedId: string, requestedUser: string) =>
        requestedId === projectId && requestedUser === userId ? project : null,
    );
    mocks.loadLead.mockImplementation(
      async (_pool: Pool, input: { leadId: string }) => ({
        id: input.leadId,
        organizationId,
        projectId,
      }),
    );
    mocks.executeWorkflow.mockResolvedValue({
      id: "execution",
      leadId: null,
      status: "completed",
      errorMessage: null,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 1,
      actionsExecuted: [],
      triggerEvent: null,
    });
  });

  it("fails closed when list has no selected customer project", async () => {
    const { routes, query } = setup();
    const out = response();

    await routes.get("GET /api/leadgrid/workflows")!(
      request(),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "project_id_required" });
    expect(query).not.toHaveBeenCalled();
  });

  it("lists workflows only inside the accessible project tuple", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const { routes } = setup(query);
    const out = response();

    await routes.get("GET /api/leadgrid/workflows")!(
      request({ query: { projectId } }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("organization_id = $1::uuid");
    expect(sql).toContain("project_id = $2");
    expect(params).toEqual([organizationId, projectId]);
  });

  it("validates an entire bulk run before executing any lead", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [workflowRow] });
    const { routes } = setup(query);
    mocks.loadLead
      .mockResolvedValueOnce({
        id: leadA,
        organizationId,
        projectId,
      })
      .mockResolvedValueOnce(null);
    const out = response();

    await routes.get("POST /api/leadgrid/workflows/:id/execute")!(
      request({
        params: { id: workflowId },
        body: { project_id: projectId, lead_ids: [leadA, leadB] },
      }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: "lead_not_found" });
    expect(mocks.executeWorkflow).not.toHaveBeenCalled();
  });

  it("passes the exact project tuple to every accepted execution", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [workflowRow] });
    const { routes } = setup(query);
    const out = response();

    await routes.get("POST /api/leadgrid/workflows/:id/execute")!(
      request({
        params: { id: workflowId },
        body: { project_id: projectId, lead_ids: [leadA, leadB, leadA] },
      }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(mocks.executeWorkflow).toHaveBeenCalledTimes(2);
    for (const call of mocks.executeWorkflow.mock.calls) {
      expect(call[1]).toMatchObject({
        organization_id: organizationId,
        project_id: projectId,
      });
      expect(call[2]).toMatchObject({
        organizationId,
        projectId,
      });
    }
  });

  it("scopes execution history by workflow, organization and project", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const { routes } = setup(query);
    const out = response();

    await routes.get("GET /api/leadgrid/workflows/:id/executions")!(
      request({ params: { id: workflowId }, query: { projectId } }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("workflow_id = $1::uuid");
    expect(sql).toContain("organization_id = $2::uuid");
    expect(sql).toContain("project_id = $3");
    expect(params).toEqual([workflowId, organizationId, projectId, 50]);
  });
});

const workflowProjectScopeMigration = readFileSync(
  new URL(
    "../migrations/0541_leadgrid_workflow_project_scope.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Leadgrid workflow project-scope migration", () => {
  it("inherits only customer tuples backed by a Leadgrid project", () => {
    const guardedCustomerBackfills = workflowProjectScopeMigration.match(
      /FROM crm_customers customer\s+JOIN leadgrid_projects project\s+ON project\.organization_id = customer\.organization_id\s+AND project\.id = customer\.project_id/g,
    );

    expect(guardedCustomerBackfills).toHaveLength(8);
  });
});
