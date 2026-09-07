import { readFileSync } from "node:fs";
import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({ loadProject: vi.fn() }));

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
  loadAccessibleLeadgridProject: access.loadProject,
}));

import { registerLeadMapLeaderboardRoutes } from "./lead-map-leaderboard-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";

function setup(query = vi.fn()) {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get(path: string, handler: RequestHandler) {
      routes.set(path, handler);
    },
  } as unknown as Express;
  const pool = { query } as unknown as Pool;
  registerLeadMapLeaderboardRoutes({
    app,
    pool,
    activeSessions: new Map([["token", { userId: "user-a" }]]),
  });
  return { routes, pool, query };
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
    status: () => status,
    body: () => body,
  };
}

async function invoke(
  handler: RequestHandler,
  input: {
    organizationId?: string;
    query?: Record<string, unknown>;
  } = {},
) {
  const output = response();
  await handler(
    {
      headers: { authorization: "Bearer token" },
      params: { id: input.organizationId ?? organizationId },
      query: input.query ?? {},
      body: {},
    } as unknown as Request,
    output.res,
    vi.fn(),
  );
  return output;
}

function adminAccessResult() {
  return {
    rows: [{ role: "admin", sales_team_id: null }],
    rowCount: 1,
  };
}

describe("Lead Map leaderboard project isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.loadProject.mockResolvedValue({
      id: projectId,
      organizationId,
      name: "Dentum",
    });
  });

  it("requires an explicit project for leaderboard and summary", async () => {
    const { routes, query } = setup();
    for (const path of [
      "/api/admin-room/lead-map/organizations/:id/leaderboard",
      "/api/admin-room/lead-map/organizations/:id/leaderboard-summary",
    ]) {
      const output = await invoke(routes.get(path)!);
      expect(output.status(), path).toBe(400);
      expect(output.body(), path).toEqual({ error: "project_id_required" });
    }
    expect(access.loadProject).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("fails closed for inaccessible projects and org/project mismatches", async () => {
    const { routes, query } = setup();
    const handler = routes.get(
      "/api/admin-room/lead-map/organizations/:id/leaderboard",
    )!;

    access.loadProject.mockResolvedValueOnce(null);
    const hidden = await invoke(handler, { query: { projectId } });
    expect(hidden.status()).toBe(404);
    expect(hidden.body()).toEqual({ error: "project_not_found" });

    access.loadProject.mockResolvedValueOnce({
      id: projectId,
      organizationId,
      name: "Dentum",
    });
    const mismatch = await invoke(handler, {
      organizationId: otherOrganizationId,
      query: { projectId },
    });
    expect(mismatch.status()).toBe(404);
    expect(mismatch.body()).toEqual({ error: "project_not_found" });
    expect(query).not.toHaveBeenCalled();
  });

  it("scopes won, visit and assigned aggregates to the exact tuple", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce(adminAccessResult())
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const { routes } = setup(query);
    const output = await invoke(
      routes.get("/api/admin-room/lead-map/organizations/:id/leaderboard")!,
      { query: { projectId, period: "last_30d", sort: "won" } },
    );

    expect(output.status()).toBe(200);
    expect(output.body()).toMatchObject({ projectId, leaderboard: [] });
    const [sql, params] = query.mock.calls[1]!;
    const statement = String(sql);
    expect(params.slice(0, 2)).toEqual([organizationId, projectId]);
    expect(statement.match(/c\.organization_id = \$1::uuid/g)?.length).toBe(3);
    expect(statement.match(/c\.project_id = \$2/g)?.length).toBe(3);
    expect(statement.match(
      /GROUP BY c\.organization_id, c\.project_id, c\.assigned_user_id/g,
    )?.length).toBe(3);
    expect(statement).not.toMatch(/GROUP BY\s+c\.assigned_user_id(?:\s|$)/);
    expect(statement).toContain("JOIN member_base mb ON mb.user_id = c.assigned_user_id");
    expect(statement).toContain("ws.organization_id = $1::uuid");
    expect(statement).toContain("ws.project_id = $2");
    expect(statement).toMatch(
      /SUM\(c\.estimated_value\) FILTER \(\s*WHERE c\.lead_status = 'won'/,
    );
  });

  it("scopes every summary result CTE and applies the same team filter", async () => {
    const teamId = "33333333-3333-4333-8333-333333333333";
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [{ role: "teamleder", sales_team_id: teamId }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{
          total_achieved: "0",
          total_target: "0",
          total_won: 0,
          total_lost: 0,
          total_meetings: 0,
          active_sellers: 1,
        }],
        rowCount: 1,
      });
    const { routes } = setup(query);
    const output = await invoke(
      routes.get(
        "/api/admin-room/lead-map/organizations/:id/leaderboard-summary",
      )!,
      { query: { projectId, period: "last_30d" } },
    );

    expect(output.status()).toBe(200);
    expect(output.body()).toMatchObject({ projectId, teamFilter: teamId });
    const [sql, params] = query.mock.calls[1]!;
    const statement = String(sql);
    expect(params.slice(0, 3)).toEqual([organizationId, projectId, teamId]);
    expect(statement).toContain("AND om.sales_team_id = $3");
    expect(statement.match(/c\.organization_id = \$1::uuid/g)?.length).toBe(2);
    expect(statement.match(/c\.project_id = \$2/g)?.length).toBe(2);
    expect(statement).toContain("JOIN org_users ou ON ou.user_id = c.assigned_user_id");
  });

  it("does not let a team leader select another team", async () => {
    const ownTeamId = "33333333-3333-4333-8333-333333333333";
    const otherTeamId = "44444444-4444-4444-8444-444444444444";
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ role: "teamleder", sales_team_id: ownTeamId }],
      rowCount: 1,
    });
    const { routes } = setup(query);
    const output = await invoke(
      routes.get("/api/admin-room/lead-map/organizations/:id/leaderboard")!,
      { query: { projectId, team_id: otherTeamId } },
    );

    expect(output.status()).toBe(403);
    expect(output.body()).toEqual({ error: "team_scope_forbidden" });
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("Leaderboard client project contract", () => {
  it("sends projectId from the active web project to both endpoints", () => {
    const source = readFileSync(
      new URL(
        "../../frontend/client/src/pages/admin-room/LeadMapLeaderboardPanel.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    expect(source).toContain(
      "new URLSearchParams({ period, sort: sortBy, projectId })",
    );
    expect(source).toContain(
      "new URLSearchParams({ period, projectId })",
    );
    expect(source).toContain("lbJson.projectId !== projectId");
    expect(source).toContain("summaryJson.projectId !== projectId");
  });

  it("makes projectId required in iPad API calls and guards stale responses", () => {
    const api = readFileSync(
      new URL(
        "../../ipad/LeadMapApp/LeadMapApp/Core/APIClient.swift",
        import.meta.url,
      ),
      "utf8",
    );
    const view = readFileSync(
      new URL(
        "../../ipad/LeadMapApp/LeadMapApp/Views/LeaderboardView.swift",
        import.meta.url,
      ),
      "utf8",
    );
    const leaderboardStart = api.indexOf("func fetchLeaderboard(");
    const leaderboardEnd = api.indexOf("func fetchLeaderboardSummary(");
    const summaryEnd = api.indexOf("// MARK: - Kart-annotasjoner", leaderboardEnd);
    const leaderboardCall = api.slice(leaderboardStart, leaderboardEnd);
    const summaryCall = api.slice(leaderboardEnd, summaryEnd);
    expect(leaderboardCall).toContain("projectId: String");
    expect(leaderboardCall).toContain(
      'URLQueryItem(name: "projectId", value: projectId)',
    );
    expect(summaryCall).toContain("projectId: String");
    expect(summaryCall).toContain(
      'URLQueryItem(name: "projectId", value: projectId)',
    );
    expect(view).toContain("guard resp.projectId == projectId, isCurrentScope()");
    expect(view).toContain("guard response.projectId == projectId, isCurrentScope()");
  });
});
