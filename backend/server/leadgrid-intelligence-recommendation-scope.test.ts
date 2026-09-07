import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const webhook = vi.hoisted(() => ({ emit: vi.fn() }));
vi.mock("./webhook-emitter.js", () => ({ emitWebhook: webhook.emit }));

import { registerLeadgridIntelligenceRoutes } from "./leadgrid-intelligence-routes.js";

const recommendationId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const foreignOrganizationId = "33333333-3333-4333-8333-333333333333";
const leadId = "44444444-4444-4444-8444-444444444444";
const projectId = "dentum-project";
const userId = "seller-1";
const token = "session-token";

type QueryResultLike = {
  rows: Record<string, unknown>[];
  rowCount?: number;
};

type QueryHandler = (
  sql: string,
  params?: readonly unknown[],
) => QueryResultLike | Promise<QueryResultLike>;

type RegisteredRoute = {
  path: string;
  handlers: RequestHandler[];
};

function makeHarness(queryHandler: QueryHandler) {
  const routes: RegisteredRoute[] = [];
  const register =
    (_method: string) =>
    (path: string, ...handlers: RequestHandler[]) => {
      routes.push({ path, handlers });
    };
  const app = {
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
  } as unknown as Express;
  const query = vi.fn(async (sql: string, params?: readonly unknown[]) =>
    queryHandler(sql, params),
  );
  const pool = { query } as unknown as Pool;
  registerLeadgridIntelligenceRoutes({
    app,
    pool,
    activeSessions: new Map([[token, { userId }]]),
  });

  async function request(
    path: string,
    options: {
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
      includeProject?: boolean;
    } = {},
  ) {
    const route = routes.find((candidate) => candidate.path === path);
    if (!route) throw new Error(`missing route: ${path}`);
    const req = {
      body: options.body ?? {},
      query: {
        ...(options.includeProject === false ? {} : { projectId }),
        ...(options.query ?? {}),
      },
      params: { id: recommendationId },
      headers: { authorization: `Bearer ${token}` },
      route: { path },
      path,
    } as unknown as Request;
    let statusCode = 200;
    let responseBody: unknown;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        responseBody = body;
        return this;
      },
    } as unknown as Response;

    let nextCalled = false;
    await route.handlers[0](req, res, () => {
      nextCalled = true;
    });
    if (nextCalled) {
      await route.handlers.at(-1)!(req, res, vi.fn());
    }
    return { statusCode, responseBody, nextCalled };
  }

  return { query, request };
}

function authorizationQueries(
  tenant: string,
  mutation: QueryHandler,
): QueryHandler {
  return async (sql, params) => {
    if (
      sql.includes("FROM leadgrid_projects p") &&
      sql.includes("JOIN organization_members om")
    ) {
      return {
        rows: [
          {
            id: projectId,
            organization_id: tenant,
            name: "Dentum",
            description: null,
            industry: "Tannhelse",
            status: "active",
            created_by: userId,
            member_role: "admin",
          },
        ],
        rowCount: 1,
      };
    }
    if (
      sql.includes("SELECT organization_id::text") &&
      sql.includes("FROM lead_recommendations")
    ) {
      return { rows: [{ organization_id: tenant }], rowCount: 1 };
    }
    if (sql.includes("SELECT role FROM organization_members")) {
      return tenant === organizationId
        ? { rows: [{ role: "admin" }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (sql.includes("SELECT key FROM permissions")) {
      return {
        rows: [
          { key: "intelligence.execute_recommendation" },
          { key: "intelligence.view_recommendations" },
          { key: "intelligence.view_score" },
        ],
        rowCount: 1,
      };
    }
    return mutation(sql, params);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Leadgrid recommendation mutation scope and retries", () => {
  it("resolves the recommendation tenant before permission checks", async () => {
    const harness = makeHarness(
      authorizationQueries(foreignOrganizationId, () => ({
        rows: [],
        rowCount: 0,
      })),
    );

    const result = await harness.request(
      "/api/leadgrid/intelligence/recommendations/:id/execute",
      { body: { outcome: "positive" } },
    );

    expect(result).toMatchObject({ statusCode: 403, nextCalled: false });
    expect(result.responseBody).toMatchObject({
      error: "ikke_medlem_av_org",
      organization_id: foreignOrganizationId,
    });
    expect(
      harness.query.mock.calls.some(([sql]) =>
        String(sql).startsWith("UPDATE lead_recommendations"),
      ),
    ).toBe(false);
  });

  it("executes once with an authoritative organization predicate", async () => {
    const harness = makeHarness(
      authorizationQueries(organizationId, (sql, params) => {
        if (sql.includes("UPDATE lead_recommendations")) {
          expect(sql).toContain("lr.organization_id = $4::uuid");
          expect(sql).toContain("lr.project_id = $5");
          expect(sql).toContain("c.project_id = lr.project_id");
          expect(sql).toContain("c.assigned_user_id::text = $6");
          expect(params).toEqual([
            recommendationId,
            "positive",
            null,
            organizationId,
            projectId,
            userId,
          ]);
          return {
            rows: [
              {
                id: recommendationId,
                organization_id: organizationId,
                lead_id: leadId,
                action_type: "call",
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    );

    const result = await harness.request(
      "/api/leadgrid/intelligence/recommendations/:id/execute",
      { body: { outcome: "positive" } },
    );

    expect(result).toMatchObject({
      statusCode: 200,
      responseBody: {
        id: recommendationId,
        status: "executed",
        outcome: "positive",
        replayed: false,
      },
    });
    expect(webhook.emit).toHaveBeenCalledTimes(1);
  });

  it("returns a successful replay without emitting a second webhook", async () => {
    const harness = makeHarness(
      authorizationQueries(organizationId, (sql, params) => {
        if (sql.includes("UPDATE lead_recommendations")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("SELECT lr.id::text, lr.status, lr.outcome")) {
          expect(params).toEqual([
            recommendationId,
            organizationId,
            projectId,
            userId,
          ]);
          return {
            rows: [
              {
                id: recommendationId,
                status: "executed",
                outcome: "positive",
                outcome_notes: null,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    );

    const result = await harness.request(
      "/api/leadgrid/intelligence/recommendations/:id/execute",
      { body: { outcome: "positive" } },
    );

    expect(result).toMatchObject({
      statusCode: 200,
      responseBody: { replayed: true },
    });
    expect(webhook.emit).not.toHaveBeenCalled();
  });

  it("rejects a conflicting retry of an executed recommendation", async () => {
    const harness = makeHarness(
      authorizationQueries(organizationId, (sql) => {
        if (sql.includes("UPDATE lead_recommendations")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("SELECT lr.id::text, lr.status, lr.outcome")) {
          return {
            rows: [
              {
                id: recommendationId,
                status: "executed",
                outcome: "negative",
                outcome_notes: null,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    );

    const result = await harness.request(
      "/api/leadgrid/intelligence/recommendations/:id/execute",
      { body: { outcome: "positive" } },
    );

    expect(result).toMatchObject({
      statusCode: 409,
      responseBody: { error: "recommendation_execution_conflict" },
    });
    expect(webhook.emit).not.toHaveBeenCalled();
  });

  it("requires a project for recommendation mutations", async () => {
    const harness = makeHarness(
      authorizationQueries(organizationId, () => ({
        rows: [],
        rowCount: 0,
      })),
    );

    const result = await harness.request(
      "/api/leadgrid/intelligence/recommendations/:id/execute",
      {
        body: { outcome: "positive" },
        includeProject: false,
      },
    );

    expect(result).toMatchObject({
      statusCode: 400,
      responseBody: { error: "project_id_required" },
    });
    expect(
      harness.query.mock.calls.some(([sql]) =>
        String(sql).startsWith("UPDATE lead_recommendations"),
      ),
    ).toBe(false);
  });

  it("lists only the selected project and the caller's visible leads", async () => {
    const harness = makeHarness(
      authorizationQueries(organizationId, (sql, params) => {
        if (
          sql.includes("FROM lead_recommendations lr") &&
          sql.includes("ORDER BY")
        ) {
          expect(sql).toContain("c.organization_id = lr.organization_id");
          expect(sql).toContain("c.project_id = lr.project_id");
          expect(sql).toContain("lr.project_id = $2");
          expect(sql).toContain("c.assigned_user_id::text = $4");
          expect(params).toEqual([
            organizationId,
            projectId,
            null,
            userId,
            50,
            0,
          ]);
        }
        return { rows: [], rowCount: 0 };
      }),
    );

    const result = await harness.request(
      "/api/leadgrid/intelligence/recommendations",
    );

    expect(result).toMatchObject({
      statusCode: 200,
      responseBody: { recommendations: [], count: 0 },
    });
  });

  it("rejects lead intelligence without an explicit project and never picks a membership", async () => {
    const harness = makeHarness(
      authorizationQueries(foreignOrganizationId, () => {
        return { rows: [], rowCount: 0 };
      }),
    );

    const result = await harness.request(
      "/api/leadgrid/intelligence/leads/:id",
      { includeProject: false },
    );

    expect(result).toMatchObject({
      statusCode: 400,
      nextCalled: true,
      responseBody: { error: "project_id_required" },
    });
    expect(
      harness.query.mock.calls.some(([sql]) =>
        String(sql).includes("ORDER BY") &&
        String(sql).includes("FROM organization_members"),
      ),
    ).toBe(false);
  });

  it.each([
    ["/api/leadgrid/intelligence/recommendations/:id/accept", 2, 3, 4],
    ["/api/leadgrid/intelligence/recommendations/:id/dismiss", 2, 3, 4],
    ["/api/leadgrid/intelligence/recommendations/:id/snooze", 4, 5, 2],
  ])(
    "scopes %s by organization, project and assignee",
    async (
      path,
      orgParameterIndex,
      projectParameterIndex,
      userParameterIndex,
    ) => {
      const harness = makeHarness(
        authorizationQueries(organizationId, (sql, params) => {
          if (sql.includes("UPDATE lead_recommendations")) {
            expect(sql).toContain(
              `lr.organization_id = $${orgParameterIndex}::uuid`,
            );
            expect(sql).toContain(`lr.project_id = $${projectParameterIndex}`);
            expect(sql).toContain("c.project_id = lr.project_id");
            expect(sql).toContain(
              `c.assigned_user_id::text = $${userParameterIndex}`,
            );
            expect(params?.[orgParameterIndex - 1]).toBe(organizationId);
            expect(params?.[projectParameterIndex - 1]).toBe(projectId);
            expect(params?.[userParameterIndex - 1]).toBe(userId);
            if (path.endsWith("/snooze")) {
              return {
                rows: [
                  {
                    id: recommendationId,
                    organization_id: organizationId,
                    snoozed_until: "2026-09-06T10:00:00.000Z",
                  },
                ],
                rowCount: 1,
              };
            }
            return {
              rows: [{ id: recommendationId }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }),
      );

      const result = await harness.request(path);
      expect(result.statusCode).toBe(200);
    },
  );
});
