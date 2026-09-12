import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadProject: vi.fn(),
  overview: vi.fn(),
  outcomePerformance: vi.fn(),
  outcomeCohorts: vi.fn(),
}));

vi.mock("./lead-map-rbac-helper.js", () => ({
  requireLeadMapPermission: () =>
    (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: mocks.loadProject,
}));
vi.mock("./leadgrid-analytics-service.js", () => ({
  computeOrgAnalyticsOverview: mocks.overview,
  computeChannelPerformance: vi.fn(),
  computeSourcePerformance: vi.fn(),
  computeSegmentPerformance: vi.fn(),
  computeTerritoryPerformance: vi.fn(),
  computeVelocityHistory: vi.fn(),
  computeConversionFunnel: vi.fn(),
}));
vi.mock("./leadgrid-outcome-analytics.js", () => ({
  computeOutcomeEventPerformance: mocks.outcomePerformance,
  computeOutcomeProfileCohorts: mocks.outcomeCohorts,
  LEADGRID_OUTCOME_COHORT_DEFINITION: {
    attributionModel: "first_discovery_import_v1",
    denominator: "unique_leads_first_imported_during_window",
  },
}));

import { registerLeadgridAnalyticsRoutes } from "./leadgrid-analytics-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";

function setup() {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get(path: string, ...handlers: RequestHandler[]) {
      routes.set(`GET ${path}`, handlers.at(-1)!);
    },
  } as unknown as Express;
  const pool = { query: vi.fn() } as unknown as Pool;
  registerLeadgridAnalyticsRoutes({
    app,
    pool,
    activeSessions: new Map([["token", { userId: "user-a" }]]),
  });
  return { routes, pool };
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
  return { res, get status() { return status; }, get body() { return body; } };
}

describe("Leadgrid analytics route project scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.overview.mockResolvedValue({ totalLeads: 0 });
    mocks.outcomePerformance.mockResolvedValue([]);
    mocks.outcomeCohorts.mockResolvedValue([]);
  });

  it("rejects organization-wide analytics when projectId is omitted", async () => {
    const { routes } = setup();
    const out = response();

    await routes.get("GET /api/leadgrid/analytics/overview")!(
      {
        headers: { authorization: "Bearer token" },
        query: { organization_id: organizationId },
      } as unknown as Request,
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "project_id_required" });
    expect(mocks.loadProject).not.toHaveBeenCalled();
    expect(mocks.overview).not.toHaveBeenCalled();
  });

  it("returns 404 for a hidden project before computing aggregates", async () => {
    mocks.loadProject.mockResolvedValue(null);
    const { routes } = setup();
    const out = response();

    await routes.get("GET /api/leadgrid/analytics/overview")!(
      {
        headers: { authorization: "Bearer token" },
        query: { projectId },
      } as unknown as Request,
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(404);
    expect(mocks.overview).not.toHaveBeenCalled();
  });

  it("derives the organization exclusively from the accessible project", async () => {
    mocks.loadProject.mockResolvedValue({
      id: projectId,
      organizationId,
      name: "Dentum",
    });
    const { routes } = setup();
    const out = response();

    await routes.get("GET /api/leadgrid/analytics/overview")!(
      {
        headers: { authorization: "Bearer token" },
        query: {
          projectId,
          organization_id: "99999999-9999-4999-8999-999999999999",
          sinceDays: "30",
        },
      } as unknown as Request,
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(mocks.overview).toHaveBeenCalledWith(
      expect.anything(),
      organizationId,
      30,
      projectId,
    );
    expect(out.body).toMatchObject({
      organization_id: organizationId,
      project_id: projectId,
    });
  });

  it("returns additive per-profile cohorts inside the accessible project", async () => {
    mocks.loadProject.mockResolvedValue({
      id: projectId,
      organizationId,
      name: "Dentum",
    });
    mocks.outcomePerformance.mockResolvedValue([{ eventType: "pilot_invited" }]);
    mocks.outcomeCohorts.mockResolvedValue([{ profileId: "profile-oslo", cohortLeads: 10 }]);
    const { routes } = setup();
    const out = response();

    await routes.get("GET /api/leadgrid/analytics/outcomes")!(
      {
        headers: { authorization: "Bearer token" },
        query: { projectId, sinceDays: "30" },
      } as unknown as Request,
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(mocks.outcomePerformance).toHaveBeenCalledWith(
      expect.anything(), organizationId, 30, projectId,
    );
    expect(mocks.outcomeCohorts).toHaveBeenCalledWith(
      expect.anything(), organizationId, projectId, 30,
    );
    expect(out.body).toMatchObject({
      organization_id: organizationId,
      project_id: projectId,
      outcomes: [{ eventType: "pilot_invited" }],
      profileCohorts: [{ profileId: "profile-oslo", cohortLeads: 10 }],
      cohortDefinition: {
        attributionModel: "first_discovery_import_v1",
        denominator: "unique_leads_first_imported_during_window",
      },
    });
  });
});
