import { readFileSync } from "node:fs";

import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const workflowMocks = vi.hoisted(() => ({
  createCampaign: vi.fn(),
  createContentPack: vi.fn(),
  createFunnel: vi.fn(),
  sendToAgent: vi.fn(),
  get: vi.fn(),
  listOpportunity: vi.fn(),
  listUser: vi.fn(),
}));
const scanMocks = vi.hoisted(() => ({ get: vi.fn() }));
const projectMocks = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock("./marketing-cockpit-sync-service.js", () => ({
  createCampaignFromOpportunity: workflowMocks.createCampaign,
  createContentPackFromOpportunity: workflowMocks.createContentPack,
  createFunnelMapFromOpportunity: workflowMocks.createFunnel,
  sendOpportunityToAgent: workflowMocks.sendToAgent,
  getWorkflow: workflowMocks.get,
  listWorkflowsForOpportunity: workflowMocks.listOpportunity,
  listWorkflowsForUser: workflowMocks.listUser,
}));
vi.mock("./market-scan-service.js", () => ({ getMarketScan: scanMocks.get }));
vi.mock("../leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: projectMocks.load,
}));

import { registerMarketingWorkflowRoutes } from "./marketing-workflow-routes.js";

const projectId = "dentum-oslo";
const organizationId = "11111111-1111-4111-8111-111111111111";

type Route = { method: string; path: string; handler: RequestHandler };

function setupHarness(queryRows: unknown[] = []) {
  const routes: Route[] = [];
  const register = (method: string) => (
    path: string,
    ...handlers: RequestHandler[]
  ) => {
    const handler = handlers.at(-1);
    if (!handler) throw new Error(`Missing ${method} ${path}`);
    routes.push({ method, path, handler });
  };
  const app = {
    get: register("GET"),
    post: register("POST"),
  } as unknown as Express;
  const pool = { query: vi.fn().mockResolvedValue({ rows: queryRows }) } as unknown as Pool;
  registerMarketingWorkflowRoutes({
    app,
    pool,
    activeSessions: new Map([
      ["token", { userId: "marketer-a", role: "admin", email: "a@example.no" }],
    ]),
    isAdminEmail: () => false,
  });
  return {
    pool,
    route(method: string, path: string) {
      const found = routes.find((candidate) => (
        candidate.method === method && candidate.path === path
      ));
      if (!found) throw new Error(`Missing route ${method} ${path}`);
      return found.handler;
    },
  };
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
  scanMocks.get.mockResolvedValue({
    id: "22222222-2222-4222-8222-222222222222",
    projectId,
    organizationId,
  });
  projectMocks.load.mockResolvedValue({ id: projectId, organizationId });
  workflowMocks.createCampaign.mockResolvedValue({ workflow: { id: "wf-a" }, draftId: 1 });
  workflowMocks.listUser.mockResolvedValue([]);
  workflowMocks.get.mockResolvedValue({ id: "wf-a" });
});

describe("Market Intelligence workflow customer-project scope", () => {
  it("derives draft scope and brand key from the authorized scan, not request data", async () => {
    const { pool, route } = setupHarness();
    const result = responseHarness();

    await route(
      "POST",
      "/api/market-scans/:id/opportunities/:opportunityId/create-campaign",
    )(
      request({
        params: {
          id: "22222222-2222-4222-8222-222222222222",
          opportunityId: "33333333-3333-4333-8333-333333333333",
        },
        body: { projectId: "forged", brandKey: "theroleroom" },
      }),
      result.response,
      vi.fn(),
    );

    expect(projectMocks.load).toHaveBeenCalledWith(pool, projectId, "marketer-a");
    expect(workflowMocks.createCampaign).toHaveBeenCalledWith(pool, {
      workspaceOwnerUserId: "marketer-a",
      organizationId,
      projectId,
      marketScanId: "22222222-2222-4222-8222-222222222222",
      brandKey: `leadgrid:${projectId}`,
      opportunityId: "33333333-3333-4333-8333-333333333333",
    });
    expect(result.status()).toBe(200);
  });

  it("fails closed when the scan and canonical project disagree on workspace", async () => {
    const { route } = setupHarness();
    const result = responseHarness();
    scanMocks.get.mockResolvedValue({
      id: "scan-a",
      projectId,
      organizationId: "99999999-9999-4999-8999-999999999999",
    });

    await route(
      "POST",
      "/api/market-scans/:id/opportunities/:opportunityId/create-campaign",
    )(
      request({ params: { id: "scan-a", opportunityId: "opp-a" } }),
      result.response,
      vi.fn(),
    );

    expect(result.status()).toBe(404);
    expect(result.body()).toEqual({ error: "scan_not_found" });
    expect(workflowMocks.createCampaign).not.toHaveBeenCalled();
  });

  it("requires a selected project when workflows are listed", async () => {
    const { route } = setupHarness();
    const result = responseHarness();

    await route("GET", "/api/marketing-workflows")(
      request(),
      result.response,
      vi.fn(),
    );

    expect(result.status()).toBe(400);
    expect(result.body()).toEqual({ error: "project_id_required" });
    expect(workflowMocks.listUser).not.toHaveBeenCalled();
  });

  it("passes the canonical workspace and project into workflow reads", async () => {
    const { pool, route } = setupHarness();
    const result = responseHarness();

    await route("GET", "/api/marketing-workflows/:id")(
      request({ params: { id: "wf-a" }, query: { projectId } }),
      result.response,
      vi.fn(),
    );

    expect(workflowMocks.get).toHaveBeenCalledWith(pool, "wf-a", {
      workspaceOwnerUserId: "marketer-a",
      organizationId,
      projectId,
    });
  });
});

describe("project-scoped marketing persistence contract", () => {
  const migration = readFileSync(
    new URL("../../migrations/0530_leadgrid_marketing_project_scope.sql", import.meta.url),
    "utf8",
  );
  const workflowService = readFileSync(
    new URL("./marketing-cockpit-sync-service.ts", import.meta.url),
    "utf8",
  );
  const campaignService = readFileSync(
    new URL("./lead-map-campaign-service.ts", import.meta.url),
    "utf8",
  );

  it("backfills and indexes workflow, campaign and generated-draft scope", () => {
    expect(migration).toContain("ALTER TABLE marketing_workflows");
    expect(migration).toContain("ALTER TABLE lead_map_campaigns");
    expect(migration).toContain("ALTER TABLE marketing_post_drafts");
    expect(migration).toContain("idx_marketing_workflows_org_project_updated");
    expect(migration).toContain("idx_lead_map_campaigns_org_project_updated");
    expect(migration).toContain("idx_marketing_drafts_org_project_status");
  });

  it("writes generated drafts with authoritative workspace and project columns", () => {
    expect(workflowService).toContain(
      "brand_key, organization_id, leadgrid_project_id, created_by_user_id",
    );
    expect(workflowService).toContain("scan.organization_id = $3::uuid");
    expect(workflowService).toContain("scan.project_id = $4");
  });

  it("aggregates campaign leads only inside its workspace and customer project", () => {
    expect(campaignService).toContain('"c.organization_id = $1::uuid"');
    expect(campaignService).toContain('"c.project_id = $2"');
    expect(campaignService).not.toContain('const conditions = ["c.owner_user_id = $1"]');
  });
});
