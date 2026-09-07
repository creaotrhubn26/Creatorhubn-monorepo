import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const leadAccess = vi.hoisted(() => ({ load: vi.fn() }));
const projectAccess = vi.hoisted(() => ({ load: vi.fn() }));
const deals = vi.hoisted(() => ({
  computeWeightedForecast: vi.fn(),
  getDealForLead: vi.fn(),
  updateDealFields: vi.fn(),
  fetchStageHistory: vi.fn(),
  listDealsAtRisk: vi.fn(),
  applyStageChange: vi.fn(),
}));
const mail = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("./leadgrid-lead-access.js", () => ({
  loadAccessibleLeadgridLead: leadAccess.load,
}));
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: projectAccess.load,
}));
vi.mock("./lead-map-rbac-helper.js", () => ({
  requireLeadMapPermission: vi.fn(
    () => (_req: Request, _res: Response, next: () => void) => next(),
  ),
}));
vi.mock("./leadgrid-deals-service.js", () => deals);
vi.mock("./transactional-email-service.js", () => ({
  sendTransactionalEmail: mail.send,
}));
vi.mock("./lead-assignment-notification-service.js", () => ({
  notifyAssignment: vi.fn(async () => undefined),
}));
vi.mock("./webhook-emitter.js", () => ({
  emitWebhook: vi.fn(async () => undefined),
}));
vi.mock("./leadgrid-workflow-engine.js", () => ({
  publishEvent: vi.fn(async () => undefined),
}));

import { registerLeadStatusRoutes } from "./lead-status-routes.js";
import { registerLeadgridDealsRoutes } from "./leadgrid-deals-routes.js";
import { registerLeadgridProposalsRoutes } from "./leadgrid-proposals-routes.js";

const leadId = "11111111-1111-4111-8111-111111111111";
const proposalId = "22222222-2222-4222-8222-222222222222";
const organizationId = "33333333-3333-4333-8333-333333333333";
const projectId = "dentum-project";
const userId = "seller-a";
const token = "session-token";
const accessibleLead = { id: leadId, organizationId, projectId };

type RegisteredRoute = {
  method: string;
  path: string;
  handlers: RequestHandler[];
};

function responseHarness() {
  let statusCode = 200;
  let body: unknown;
  const response = {} as Response;
  response.status = vi.fn((status: number) => {
    statusCode = status;
    return response;
  });
  response.json = vi.fn((payload: unknown) => {
    body = payload;
    return response;
  });
  response.send = vi.fn(() => response);
  response.setHeader = vi.fn(() => response);
  return { response, status: () => statusCode, body: () => body };
}

function registerHarness() {
  const routes: RegisteredRoute[] = [];
  const register =
    (method: string) =>
    (path: string, ...handlers: RequestHandler[]) =>
      routes.push({ method, path, handlers });
  const app = {
    get: register("GET"),
    post: register("POST"),
    put: register("PUT"),
    patch: register("PATCH"),
  } as unknown as Express;
  const query = vi.fn(async (_sql: string, _params?: readonly unknown[]) => ({
    rows: [] as Record<string, unknown>[],
    rowCount: 0,
  }));
  const pool = { query } as unknown as Pool;
  const activeSessions = new Map([[token, { userId }]]);

  registerLeadStatusRoutes({ app, pool, activeSessions });
  registerLeadgridDealsRoutes({ app, pool, activeSessions });
  registerLeadgridProposalsRoutes({
    app,
    pool,
    requireUserSession: () => ({
      userId,
      email: "seller@example.no",
      name: "Seller",
      role: "seller",
    }),
  });

  async function request(
    method: string,
    path: string,
    options: {
      params?: Record<string, string>;
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
    } = {},
  ) {
    const route = routes.find(
      (candidate) => candidate.method === method && candidate.path === path,
    );
    if (!route) throw new Error(`Missing route ${method} ${path}`);
    const req = {
      params: options.params ?? { id: leadId },
      query: options.query ?? {},
      body: options.body ?? {},
      headers: { authorization: `Bearer ${token}` },
      route: { path },
      path,
    } as unknown as Request;
    const result = responseHarness();
    await route.handlers.at(-1)!(req, result.response, vi.fn());
    return result;
  }

  return { request, query, pool };
}

beforeEach(() => {
  vi.clearAllMocks();
  leadAccess.load.mockResolvedValue(null);
  projectAccess.load.mockResolvedValue(null);
  deals.getDealForLead.mockResolvedValue(null);
  deals.computeWeightedForecast.mockResolvedValue({
    byMonth: [],
    byQuarter: [],
  });
  deals.listDealsAtRisk.mockResolvedValue([]);
});

describe("Leadgrid by-id route project ACL", () => {
  it("returns the same 404 without a customer query for an inaccessible status lead", async () => {
    const harness = registerHarness();

    const result = await harness.request("GET", "/api/leadgrid/customers/:id");

    expect(result.status()).toBe(404);
    expect(result.body()).toEqual({ error: "Ikke funnet" });
    expect(leadAccess.load).toHaveBeenCalledWith(harness.pool, {
      leadId,
      userId,
    });
    expect(harness.query).not.toHaveBeenCalled();
  });

  it("binds an authorized customer read to lead, organization and project", async () => {
    const harness = registerHarness();
    leadAccess.load.mockResolvedValue(accessibleLead);
    harness.query.mockResolvedValueOnce({
      rows: [{ id: leadId, name: "Dentum" }],
      rowCount: 1,
    });

    const result = await harness.request("GET", "/api/leadgrid/customers/:id");

    expect(result.status()).toBe(200);
    const [sql, params] = harness.query.mock.calls[0];
    expect(sql).toContain("organization_id = $2::uuid");
    expect(sql).toContain("project_id = $3");
    expect(params).toEqual([leadId, organizationId, projectId]);
  });

  it("blocks proposal creation before lookup, email or persistence", async () => {
    const harness = registerHarness();

    const result = await harness.request(
      "POST",
      "/api/leadgrid/leads/:id/proposals",
      {
        body: {
          title: "Pilot",
          lines: [{ description: "Pilot", amount_nok: 1000 }],
        },
      },
    );

    expect(result.status()).toBe(404);
    expect(harness.query).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
    expect(deals.applyStageChange).not.toHaveBeenCalled();
  });

  it("cannot update a proposal whose persisted lead project is hidden", async () => {
    const harness = registerHarness();
    harness.query.mockResolvedValueOnce({
      rows: [{ lead_id: leadId }],
      rowCount: 1,
    });

    const result = await harness.request(
      "PATCH",
      "/api/leadgrid/proposals/:id",
      {
        params: { id: proposalId },
        body: { status: "accepted" },
      },
    );

    expect(result.status()).toBe(404);
    expect(harness.query).toHaveBeenCalledTimes(1);
    expect(String(harness.query.mock.calls[0][0])).toContain(
      "SELECT lead_id::text",
    );
  });

  it("blocks a foreign deal even when the request spoofs the caller's organization", async () => {
    const harness = registerHarness();

    const result = await harness.request(
      "GET",
      "/api/leadgrid/leads/:id/deal",
      {
        query: { organization_id: organizationId },
      },
    );

    expect(result.status()).toBe(404);
    expect(deals.getDealForLead).not.toHaveBeenCalled();
  });

  it("passes the authoritative tuple into an authorized deal read", async () => {
    const harness = registerHarness();
    leadAccess.load.mockResolvedValue(accessibleLead);
    deals.getDealForLead.mockResolvedValue({ dealAmount: 25000 });

    const result = await harness.request("GET", "/api/leadgrid/leads/:id/deal");

    expect(result.status()).toBe(200);
    expect(deals.getDealForLead).toHaveBeenCalledWith(harness.pool, leadId, {
      organizationId,
      projectId,
    });
  });
});

describe("Leadgrid deal list project ACL", () => {
  it.each([
    "/api/leadgrid/deals/forecast",
    "/api/leadgrid/deals/by-month",
    "/api/leadgrid/deals/at-risk",
  ])("requires an explicit project for %s", async (path) => {
    const harness = registerHarness();

    const result = await harness.request("GET", path);

    expect(result.status()).toBe(400);
    expect(result.body()).toEqual({ error: "project_id_required" });
    expect(projectAccess.load).not.toHaveBeenCalled();
  });

  it("returns 404 for a hidden forecast project", async () => {
    const harness = registerHarness();

    const result = await harness.request(
      "GET",
      "/api/leadgrid/deals/forecast",
      {
        query: { projectId },
      },
    );

    expect(result.status()).toBe(404);
    expect(deals.computeWeightedForecast).not.toHaveBeenCalled();
  });

  it("scopes an authorized forecast to the selected project", async () => {
    const harness = registerHarness();
    projectAccess.load.mockResolvedValue({ id: projectId, organizationId });

    const result = await harness.request(
      "GET",
      "/api/leadgrid/deals/forecast",
      {
        query: { projectId, horizon: "90" },
      },
    );

    expect(result.status()).toBe(200);
    expect(deals.computeWeightedForecast).toHaveBeenCalledWith(
      harness.pool,
      organizationId,
      { horizonDays: 90, projectId },
    );
  });
});
