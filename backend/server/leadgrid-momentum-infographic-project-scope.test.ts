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
  computeToday: vi.fn(),
  render: vi.fn(),
}));

vi.mock("./lead-map-rbac-helper.js", () => ({
  requireLeadMapPermission: () =>
    (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: mocks.loadProject,
}));
vi.mock("./leadgrid-momentum-service.js", () => ({
  computeTodayMomentum: mocks.computeToday,
}));
vi.mock("./leadgrid-org-resolver.js", () => ({
  resolveOrgIdForUser: vi.fn(),
}));
vi.mock("./leadgrid-sales-management-data.js", () => ({
  getTeamLeaderboard: vi.fn(),
  getCommissionEarnings: vi.fn(),
}));
vi.mock("./infographic-engine.js", () => ({
  assembleHtml: () => "<html></html>",
}));
vi.mock("./infographic-fonts.js", () => ({
  INTER_FONT_CSS: "",
}));
vi.mock("./render-engine.js", () => ({
  renderHtmlToImage: mocks.render,
}));
vi.mock("./infographic-templates-store.js", () => ({
  getTemplateHtml: async () => "<html></html>",
  pickTemplateId: async () => "momentum-template",
}));
vi.mock("./design-tokens-store.js", () => ({
  getTokens: async () => ({ accent: "#123456" }),
}));

import { registerInfographicLeadgridRoutes } from "./infographic-leadgrid-connector.js";

const organizationId = "11111111-1111-4111-8111-111111111111";

function setup() {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get(path: string, ...handlers: RequestHandler[]) {
      routes.set(path, handlers.at(-1)!);
    },
  } as unknown as Express;
  const pool = { query: vi.fn() } as unknown as Pool;
  registerInfographicLeadgridRoutes({
    app,
    pool,
    activeSessions: new Map([["token", { userId: "user-a" }]]),
  });
  return {
    pool,
    route: routes.get("/api/infographics/leadgrid/momentum.png")!,
  };
}

function response() {
  let status = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
    type() {
      return this;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return this;
    },
    send(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;
  return {
    res,
    get status() { return status; },
    get body() { return body; },
  };
}

function momentum(projectId: string) {
  return {
    organizationId,
    projectId,
    date: "2026-09-06",
    score: 61,
    breakdown: {
      activityScore: 60,
      velocityScore: 70,
      decayScore: 55,
      overduePenalty: 2,
    },
    todayActivity: {
      contacts: 3,
      contactsTarget: 4,
      followups: 2,
      followupsTarget: 5,
      meetings: 1,
      meetingsTarget: 1,
      pipelineMoves: 1,
      pipelineMovesTarget: 2,
      calls: 1,
      emails: 1,
      visits: 1,
    },
    overdueNbas: 1,
    trend: "stable",
    nextBestActions: [],
    reasoning: "Scoped",
  };
}

describe("Leadgrid momentum infographic project cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadProject.mockImplementation(
      async (_pool: Pool, projectId: string) => ({
        id: projectId,
        organizationId,
        name: projectId,
      }),
    );
    mocks.computeToday.mockImplementation(
      async (_pool: Pool, _organizationId: string, projectId: string) =>
        momentum(projectId),
    );
    mocks.render.mockResolvedValue(Buffer.from("png"));
  });

  it("does not reuse a cached project image for another customer project", async () => {
    const { route, pool } = setup();
    for (const projectId of ["dentum-oslo", "kunde-b"]) {
      const out = response();
      await route(
        {
          headers: { authorization: "Bearer token" },
          query: {
            projectId,
            view: "score",
            accent: "#scope-cache-test",
            w: "901",
            h: "501",
          },
        } as unknown as Request,
        out.res,
        vi.fn(),
      );
      expect(out.status).toBe(200);
    }

    expect(mocks.computeToday).toHaveBeenCalledTimes(2);
    expect(mocks.computeToday).toHaveBeenNthCalledWith(
      1,
      pool,
      organizationId,
      "dentum-oslo",
    );
    expect(mocks.computeToday).toHaveBeenNthCalledWith(
      2,
      pool,
      organizationId,
      "kunde-b",
    );
  });
});
