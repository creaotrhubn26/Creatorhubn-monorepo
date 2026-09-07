import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

vi.mock("./lead-map-rbac-helper.js", () => ({
  requireLeadMapPermission: vi.fn(() => (
    _req: Request,
    _res: Response,
    next: () => void,
  ) => next()),
}));

import { registerLeadPortfolioRoutes } from "./lead-portfolio-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "user-a";
const token = "session-token";

function makeHarness(pool: Pool) {
  let route: RequestHandler | undefined;
  const app = {
    get: (_path: string, ...handlers: RequestHandler[]) => {
      route = handlers.at(-1);
    },
  } as unknown as Express;
  registerLeadPortfolioRoutes({
    app,
    pool,
    activeSessions: new Map([[token, { userId }]]),
  });

  return async () => {
    if (!route) throw new Error("portfolio route missing");
    const req = {
      headers: { authorization: `Bearer ${token}` },
      params: { id: organizationId },
      query: {},
    } as unknown as Request;
    let status = 200;
    let body: unknown;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        return this;
      },
    } as unknown as Response;
    await route(req, res, vi.fn());
    return { status, body };
  };
}

describe("Leadgrid portfolio project ACL", () => {
  it("filters to creator/direct Leadgrid membership without view_all", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT EXISTS") && sql.includes("organization_members om")) {
        return { rows: [{ allowed: false }] };
      }
      return { rows: [] };
    });

    const response = await makeHarness({ query } as unknown as Pool)();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ projects: [], access: { view_all: false } });
    expect(query).toHaveBeenCalledTimes(3);
    const [accessSql, accessParams] = query.mock.calls[0];
    expect(accessSql.replace(/\s+/g, " ")).toMatch(
      /AND NOT EXISTS \(.+effect = 'revoke'.+\) AND \( om\.role = 'admin' OR EXISTS/s,
    );
    expect(accessParams).toEqual([organizationId, userId]);

    const [portfolioSql, portfolioParams] = query.mock.calls[1];
    expect(portfolioSql).toContain("cp.created_by = $2");
    expect(portfolioSql).toContain("FROM leadgrid_project_members pm");
    expect(portfolioSql).toContain("pm.organization_id = cp.organization_id");
    expect(portfolioSql).toContain("pm.project_id = cp.id");
    expect(portfolioParams).toEqual([organizationId, userId]);
    const [statsSql, statsParams] = query.mock.calls[2];
    expect(statsSql).toContain("cp.created_by = $2");
    expect(statsSql).toContain("FROM leadgrid_project_members pm");
    expect(statsSql).toContain("pm.organization_id = cp.organization_id");
    expect(statsSql).toContain("pm.project_id = cp.id");
    expect(statsParams).toEqual([organizationId, userId]);
  });

  it("omits the direct-membership filter only when effective view_all is allowed", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT EXISTS") && sql.includes("organization_members om")) {
        return { rows: [{ allowed: true }] };
      }
      return { rows: [] };
    });

    const response = await makeHarness({ query } as unknown as Pool)();

    expect(response.status).toBe(200);
    const portfolioSql = query.mock.calls[1][0];
    expect(portfolioSql).not.toContain("FROM leadgrid_project_members pm");
    expect(query.mock.calls[1][1]).toEqual([organizationId]);
    expect(query.mock.calls[2][0]).not.toContain("FROM leadgrid_project_members pm");
    expect(query.mock.calls[2][1]).toEqual([organizationId]);
  });
});
