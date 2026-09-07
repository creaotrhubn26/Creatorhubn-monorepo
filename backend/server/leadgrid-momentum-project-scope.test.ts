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
  getGoal: vi.fn(),
  setGoal: vi.fn(),
}));

vi.mock("./lead-map-rbac-helper.js", () => ({
  requireLeadMapPermission: () =>
    (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("./leadgrid-project-access.js", () => ({
  getLeadgridSession: (
    req: Request,
    sessions: Map<string, { userId: string }>,
  ) => {
    const auth = req.headers.authorization;
    return auth?.startsWith("Bearer ")
      ? sessions.get(auth.slice(7)) ?? null
      : null;
  },
  loadAccessibleLeadgridProject: mocks.loadProject,
}));

vi.mock("./leadgrid-momentum-service.js", () => ({
  computeTodayMomentum: mocks.computeToday,
  getOrCreateGoal: mocks.getGoal,
  setGoal: mocks.setGoal,
}));

import { registerLeadgridMomentumRoutes } from "./leadgrid-momentum-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";

function setup() {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get(path: string, ...handlers: RequestHandler[]) {
      routes.set(`GET ${path}`, handlers.at(-1)!);
    },
    post(path: string, ...handlers: RequestHandler[]) {
      routes.set(`POST ${path}`, handlers.at(-1)!);
    },
  } as unknown as Express;
  const pool = { query: vi.fn() } as unknown as Pool;
  registerLeadgridMomentumRoutes({
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
  return {
    res,
    get status() { return status; },
    get body() { return body; },
  };
}

async function invoke(
  route: RequestHandler,
  out: ReturnType<typeof response>,
  input: { query?: Record<string, unknown>; body?: Record<string, unknown> },
) {
  await route(
    {
      headers: { authorization: "Bearer token" },
      query: input.query ?? {},
      body: input.body ?? {},
    } as unknown as Request,
    out.res,
    vi.fn(),
  );
}

describe("Leadgrid momentum route project scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadProject.mockResolvedValue({
      id: projectId,
      organizationId,
      name: "Dentum",
    });
    mocks.computeToday.mockResolvedValue({
      organizationId,
      projectId,
      score: 50,
    });
    mocks.getGoal.mockResolvedValue({
      organizationId,
      projectId,
      yearMonth: "2026-09",
    });
    mocks.setGoal.mockResolvedValue({
      organizationId,
      projectId,
      yearMonth: "2026-09",
    });
  });

  it("requires projectId for today, goal get/set and trend", async () => {
    const { routes } = setup();
    const cases: Array<[string, { query?: Record<string, unknown>; body?: Record<string, unknown> }]> = [
      ["GET /api/leadgrid/momentum/today", { query: { organization_id: organizationId } }],
      ["GET /api/leadgrid/momentum/goal", { query: {} }],
      ["POST /api/leadgrid/momentum/goal", { body: { deals_target: 5 } }],
      ["GET /api/leadgrid/momentum/trend", { query: { days: "30" } }],
    ];

    for (const [key, input] of cases) {
      const out = response();
      await invoke(routes.get(key)!, out, input);
      expect(out.status, key).toBe(400);
      expect(out.body, key).toEqual({ error: "project_id_required" });
    }
    expect(mocks.loadProject).not.toHaveBeenCalled();
    expect(mocks.computeToday).not.toHaveBeenCalled();
    expect(mocks.getGoal).not.toHaveBeenCalled();
    expect(mocks.setGoal).not.toHaveBeenCalled();
  });

  it("fails closed for a project the caller cannot access", async () => {
    mocks.loadProject.mockResolvedValue(null);
    const { routes } = setup();
    const out = response();

    await invoke(routes.get("GET /api/leadgrid/momentum/today")!, out, {
      query: { projectId },
    });

    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: "project_not_found" });
    expect(mocks.computeToday).not.toHaveBeenCalled();
  });

  it("derives tenant scope only from the accessible project", async () => {
    const { routes, pool } = setup();
    const wrongOrganizationId = "99999999-9999-4999-8999-999999999999";

    const today = response();
    await invoke(routes.get("GET /api/leadgrid/momentum/today")!, today, {
      query: { projectId, organization_id: wrongOrganizationId },
    });
    expect(mocks.computeToday).toHaveBeenCalledWith(
      pool,
      organizationId,
      projectId,
    );
    expect(today.body).toMatchObject({ project_id: projectId });

    const getGoal = response();
    await invoke(routes.get("GET /api/leadgrid/momentum/goal")!, getGoal, {
      query: { project_id: projectId, organization_id: wrongOrganizationId },
    });
    expect(mocks.getGoal).toHaveBeenCalledWith(
      pool,
      organizationId,
      projectId,
    );

    const setGoal = response();
    await invoke(routes.get("POST /api/leadgrid/momentum/goal")!, setGoal, {
      body: {
        projectId,
        organization_id: wrongOrganizationId,
        deals_target: 7,
        notes: "Dentum target",
      },
    });
    expect(mocks.setGoal).toHaveBeenCalledWith(
      pool,
      organizationId,
      projectId,
      "user-a",
      expect.objectContaining({
        dealsTarget: 7,
        notes: "Dentum target",
      }),
    );
  });

  it("reads trend snapshots by the authoritative tenant/project tuple", async () => {
    const { routes, pool } = setup();
    vi.mocked(pool.query).mockResolvedValue({
      rows: [{
        snapshot_date: "2026-09-05",
        momentum_score: "63",
        activity_score: "60",
        velocity_score: "70",
        decay_score: "55",
        overdue_penalty: "2",
        contacts_today: 4,
        followups_today: 3,
        meetings_today: 1,
        pipeline_moves_today: 2,
      }],
      rowCount: 1,
    } as never);
    const out = response();

    await invoke(routes.get("GET /api/leadgrid/momentum/trend")!, out, {
      query: { projectId, days: "14" },
    });

    const [sql, params] = vi.mocked(pool.query).mock.calls[0]!;
    expect(String(sql)).toContain("FROM leadgrid_project_momentum_snapshots");
    expect(String(sql)).toContain("project_id = $2");
    expect(params).toEqual([organizationId, projectId, "14"]);
    expect(out.body).toMatchObject({
      trend: {
        organizationId,
        projectId,
        days: 14,
      },
    });
  });
});
