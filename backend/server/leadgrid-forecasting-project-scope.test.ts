import { readFileSync } from "node:fs";
import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({
  session: vi.fn(),
  loadProject: vi.fn(),
}));
const forecasting = vi.hoisted(() => ({
  get: vi.fn(),
  attribution: vi.fn(),
}));

vi.mock("./lead-map-rbac-helper.js", () => ({
  requireLeadMapPermission: () =>
    (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock("./leadgrid-project-access.js", () => ({
  getLeadgridSession: access.session,
  loadAccessibleLeadgridProject: access.loadProject,
}));
vi.mock("./leadgrid-forecasting-service.js", () => ({
  getOrComputeForecast: forecasting.get,
  computeAttribution: forecasting.attribution,
}));

import { registerLeadgridForecastingRoutes } from "./leadgrid-forecasting-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const foreignOrganizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";

function harness() {
  const routes = new Map<string, RequestHandler>();
  const register =
    (method: string) =>
    (path: string, ...handlers: RequestHandler[]) => {
      routes.set(`${method} ${path}`, handlers.at(-1)!);
    };
  const app = {
    get: register("GET"),
    post: register("POST"),
  } as unknown as Express;
  const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const pool = { query } as unknown as Pool;
  registerLeadgridForecastingRoutes({
    app,
    pool,
    activeSessions: new Map([["token", { userId: "user-a" }]]),
  });
  return { routes, pool, query };
}

function responseHarness() {
  let status = 200;
  let body: unknown;
  const response = {
    status(value: number) {
      status = value;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;
  return {
    response,
    status: () => status,
    body: () => body,
  };
}

async function invoke(
  route: RequestHandler,
  options: {
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
  } = {},
) {
  const output = responseHarness();
  await route(
    {
      headers: { authorization: "Bearer token" },
      query: options.query ?? {},
      body: options.body ?? {},
    } as unknown as Request,
    output.response,
    vi.fn(),
  );
  return output;
}

describe("Leadgrid forecasting route project scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.session.mockReturnValue({ userId: "user-a" });
    access.loadProject.mockResolvedValue({
      id: projectId,
      organizationId,
      name: "Dentum",
    });
    forecasting.get.mockResolvedValue({
      organizationId,
      projectId,
      horizonDays: 90,
    });
    forecasting.attribution.mockResolvedValue({
      organizationId,
      projectId,
      windowDays: 90,
      actions: [],
    });
  });

  it("rejects an organization-only forecast request", async () => {
    const { routes } = harness();
    const output = await invoke(
      routes.get("GET /api/leadgrid/forecasting/pipeline")!,
      { query: { organization_id: foreignOrganizationId } },
    );

    expect(output.status()).toBe(400);
    expect(output.body()).toEqual({ error: "project_id_required" });
    expect(access.loadProject).not.toHaveBeenCalled();
    expect(forecasting.get).not.toHaveBeenCalled();
  });

  it("hides an inaccessible project before computing", async () => {
    access.loadProject.mockResolvedValue(null);
    const { routes } = harness();
    const output = await invoke(
      routes.get("GET /api/leadgrid/forecasting/pipeline")!,
      { query: { projectId } },
    );

    expect(output.status()).toBe(404);
    expect(output.body()).toEqual({ error: "project_not_found" });
    expect(forecasting.get).not.toHaveBeenCalled();
  });

  it("derives the tenant from project ACL and clamps invalid horizon", async () => {
    const { routes, pool } = harness();
    const output = await invoke(
      routes.get("GET /api/leadgrid/forecasting/pipeline")!,
      {
        query: {
          projectId,
          organization_id: foreignOrganizationId,
          horizon: "not-a-number",
        },
      },
    );

    expect(output.status()).toBe(200);
    expect(forecasting.get).toHaveBeenCalledWith(
      pool,
      organizationId,
      projectId,
      90,
    );
    expect(output.body()).toMatchObject({ project_id: projectId });
  });

  it("refreshes only the selected project's cache tuple", async () => {
    const { routes, pool, query } = harness();
    const output = await invoke(
      routes.get("POST /api/leadgrid/forecasting/pipeline/refresh")!,
      { body: { projectId, horizon: 30, organization_id: foreignOrganizationId } },
    );

    expect(output.status()).toBe(200);
    expect(String(query.mock.calls[0]?.[0])).toContain("project_id = $2");
    expect(query.mock.calls[0]?.[1]).toEqual([organizationId, projectId, 30]);
    expect(forecasting.get).toHaveBeenCalledWith(
      pool,
      organizationId,
      projectId,
      30,
    );
  });

  it("binds attribution to the same accessible project", async () => {
    const { routes, pool } = harness();
    const output = await invoke(
      routes.get("GET /api/leadgrid/forecasting/attribution")!,
      { query: { project_id: projectId, windowDays: "1000" } },
    );

    expect(output.status()).toBe(200);
    expect(forecasting.attribution).toHaveBeenCalledWith(
      pool,
      organizationId,
      projectId,
      365,
    );
  });
});

describe("Leadgrid forecasting project-scope migration and native contract", () => {
  it("invalidates ambiguous legacy cache and enforces project tuple keys", () => {
    const sql = readFileSync(
      new URL("../migrations/0537_leadgrid_forecasting_project_scope.sql", import.meta.url),
      "utf8",
    );

    expect(sql).toContain("DELETE FROM leadgrid_forecast_cache");
    expect(sql).toContain("WHERE project_id IS NULL");
    expect(sql).toContain("ALTER COLUMN project_id SET NOT NULL");
    expect(sql).toContain("FOREIGN KEY (organization_id, project_id)");
    expect(sql).toContain("UNIQUE (organization_id, project_id, horizon_days)");
    expect(sql).toContain(
      "UNIQUE (organization_id, project_id, action_type, window_days)",
    );
  });

  it("requires projectId in the iPad forecasting calls", () => {
    const api = readFileSync(
      new URL("../../ipad/LeadMapApp/LeadMapApp/Core/APIClient.swift", import.meta.url),
      "utf8",
    );

    expect(api).toContain("func fetchPipelineForecast(\n        projectId: String");
    expect(api).toContain("func refreshPipelineForecast(\n        projectId: String");
    expect(api).toContain('"projectId": projectId');
  });
});
