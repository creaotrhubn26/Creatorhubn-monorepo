import type {
  Express,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { Pool, PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({
  compute: vi.fn(async () => ({
    organizationId: "22222222-2222-4222-8222-222222222222",
    leadScore: 81,
  })),
}));
vi.mock("./leadgrid-intelligence-engine.js", () => ({
  computeIntelligenceForLead: engine.compute,
  fetchWeights: vi.fn(async () => ({})),
  DEFAULT_WEIGHTS: {},
}));
vi.mock("./webhook-emitter.js", () => ({
  emitWebhook: vi.fn(async () => undefined),
}));
vi.mock("./leadgrid-workflow-engine.js", () => ({
  publishEvent: vi.fn(async () => undefined),
}));

import { registerLeadgridIntelligenceRoutes } from "./leadgrid-intelligence-routes.js";

const organizationId = "22222222-2222-4222-8222-222222222222";
const leadId = "44444444-4444-4444-8444-444444444444";
const projectId = "dentum-project";
const userId = "seller-1";
const token = "session-token";

type QueryResultLike = {
  rows: Record<string, unknown>[];
  rowCount?: number;
};
type MaybeQueryHandler = (
  sql: string,
  params?: readonly unknown[],
) =>
  | QueryResultLike
  | undefined
  | Promise<QueryResultLike | undefined>;
type RegisteredRoute = {
  method: string;
  path: string;
  handlers: RequestHandler[];
};

function authorizationQuery(sql: string): QueryResultLike | undefined {
  if (
    sql.includes("FROM leadgrid_projects p") &&
    sql.includes("JOIN organization_members om")
  ) {
    return {
      rows: [
        {
          id: projectId,
          organization_id: organizationId,
          name: "Dentum",
          description: null,
          industry: "Tannhelse",
          status: "active",
          created_by: userId,
          member_role: "seller",
        },
      ],
      rowCount: 1,
    };
  }
  if (
    sql.includes("SELECT COALESCE(c.organization_id::text") &&
    sql.includes("FROM crm_customers c")
  ) {
    return {
      rows: [{ organization_id: organizationId }],
      rowCount: 1,
    };
  }
  if (sql.includes("SELECT role FROM organization_members")) {
    return { rows: [{ role: "admin" }], rowCount: 1 };
  }
  if (sql.includes("SELECT key FROM permissions")) {
    return {
      rows: [
        { key: "intelligence.view_score" },
        { key: "intelligence.run_engine" },
        { key: "intelligence.override_score" },
      ],
      rowCount: 3,
    };
  }
  return undefined;
}

function makeHarness(
  routeQuery: MaybeQueryHandler = () => undefined,
  transactionQuery: MaybeQueryHandler = () => undefined,
) {
  const routes: RegisteredRoute[] = [];
  const register =
    (method: string) =>
    (path: string, ...handlers: RequestHandler[]) =>
      routes.push({ method, path, handlers });
  const app = {
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
  } as unknown as Express;

  const query = vi.fn(async (sql: string, params?: readonly unknown[]) => {
    const authorization = authorizationQuery(sql);
    if (authorization) return authorization;
    const handled = await routeQuery(sql, params);
    if (handled) return handled;
    return { rows: [], rowCount: 0 };
  });
  const clientQuery = vi.fn(
    async (sql: string, params?: readonly unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }
      const handled = await transactionQuery(sql, params);
      if (handled) return handled;
      throw new Error("unexpected transaction query: " + sql);
    },
  );
  const release = vi.fn();
  const client = { query: clientQuery, release } as unknown as PoolClient;
  const connect = vi.fn(async () => client);
  const pool = { query, connect } as unknown as Pool;

  registerLeadgridIntelligenceRoutes({
    app,
    pool,
    activeSessions: new Map([[token, { userId }]]),
  });

  async function request(
    method: string,
    path: string,
    options: {
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
      includeProject?: boolean;
    } = {},
  ) {
    const route = routes.find(
      (candidate) => candidate.method === method && candidate.path === path,
    );
    if (!route) throw new Error("route missing: " + method + " " + path);
    const req = {
      body: options.body ?? {},
      query: {
        ...(options.includeProject === false ? {} : { projectId }),
        ...(options.query ?? {}),
      },
      params: { id: leadId },
      headers: { authorization: "Bearer " + token },
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
      json(value: unknown) {
        responseBody = value;
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
    return { statusCode, responseBody };
  }

  return { request, query, clientQuery, connect, release };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Leadgrid lead-intelligence customer-project boundaries", () => {
  it.each([
    ["GET", "/api/leadgrid/intelligence/leads/:id", {}],
    ["POST", "/api/leadgrid/intelligence/leads/:id/recompute", {}],
    ["GET", "/api/leadgrid/intelligence/leads/:id/history", {}],
    [
      "POST",
      "/api/leadgrid/intelligence/leads/:id/score-override",
      { lead_score: 75 },
    ],
  ])("requires projectId for %s %s", async (method, path, body) => {
    const harness = makeHarness();

    const result = await harness.request(method, path, {
      body,
      includeProject: false,
    });

    expect(result).toMatchObject({
      statusCode: 400,
      responseBody: { error: "project_id_required" },
    });
  });

  it("reads a snapshot only through project and actor visibility", async () => {
    const harness = makeHarness((sql, params) => {
      if (sql.includes("SELECT id::text") && sql.includes("lead_score")) {
        expect(sql).toContain("c.organization_id = $2::uuid");
        expect(sql).toContain("c.project_id = $3");
        expect(sql).toContain("c.assigned_user_id::text = $4");
        expect(params).toEqual([leadId, organizationId, projectId, userId]);
        return {
          rows: [
            {
              id: leadId,
              lead_score: 82,
              conversion_probability: 0.5,
              expected_value: 10000,
              follow_up_priority: 70,
              lead_temperature: "hot",
              pipeline_stage: "qualified",
              next_best_action: "call",
              next_best_action_reason: "Dokumentert oppfølging",
              next_best_action_channel: "phone",
              next_best_action_confidence: 0.8,
              priority: "high",
              scored_at: new Date().toISOString(),
            },
          ],
          rowCount: 1,
        };
      }
      return undefined;
    });

    const result = await harness.request(
      "GET",
      "/api/leadgrid/intelligence/leads/:id",
    );

    expect(result).toMatchObject({
      statusCode: 200,
      responseBody: { lead_id: leadId, cached: true, lead_score: 82 },
    });
    expect(engine.compute).not.toHaveBeenCalled();
  });

  it("preauthorizes recompute against project and actor scope", async () => {
    const harness = makeHarness((sql, params) => {
      if (sql.includes("SELECT 1") && sql.includes("FROM crm_customers c")) {
        expect(sql).toContain("c.project_id = $3");
        expect(sql).toContain("c.assigned_user_id::text = $4");
        expect(params).toEqual([leadId, organizationId, projectId, userId]);
        return { rows: [{ "?column?": 1 }], rowCount: 1 };
      }
      return undefined;
    });

    const result = await harness.request(
      "POST",
      "/api/leadgrid/intelligence/leads/:id/recompute",
    );

    expect(result.statusCode).toBe(200);
    expect(engine.compute).toHaveBeenCalledWith(
      expect.anything(),
      leadId,
      expect.objectContaining({
        trigger: "manual",
        persist: true,
        expectedScope: {
          organizationId,
          projectId,
        },
      }),
    );
  });

  it("joins score history back to the visible project lead", async () => {
    const harness = makeHarness((sql, params) => {
      if (sql.includes("FROM lead_scores_history h")) {
        expect(sql).toContain("JOIN crm_customers c");
        expect(sql).toContain("c.project_id = h.project_id");
        expect(sql).toContain("h.project_id = $3");
        expect(sql).toContain("c.assigned_user_id::text = $4");
        expect(params).toEqual([
          leadId,
          organizationId,
          projectId,
          userId,
          50,
        ]);
        return { rows: [], rowCount: 0 };
      }
      return undefined;
    });

    const result = await harness.request(
      "GET",
      "/api/leadgrid/intelligence/leads/:id/history",
    );

    expect(result).toMatchObject({
      statusCode: 200,
      responseBody: { lead_id: leadId, history: [] },
    });
  });

  it("updates score and history atomically inside the visible project", async () => {
    const harness = makeHarness(
      () => undefined,
      (sql, params) => {
        if (sql.includes("UPDATE crm_customers c")) {
          expect(sql).toContain("c.project_id = $4");
          expect(sql).toContain("c.assigned_user_id::text = $5");
          expect(params).toEqual([
            leadId,
            75,
            organizationId,
            projectId,
            userId,
          ]);
          return {
            rows: [{ id: leadId, organization_id: organizationId }],
            rowCount: 1,
          };
        }
        if (sql.includes("INSERT INTO lead_scores_history")) {
          expect(sql).toContain("organization_id, project_id, lead_score");
          expect(params).toEqual([
            leadId, organizationId, projectId, 75, "Kvalifisert manuelt",
          ]);
          return { rows: [], rowCount: 1 };
        }
        return undefined;
      },
    );

    const result = await harness.request(
      "POST",
      "/api/leadgrid/intelligence/leads/:id/score-override",
      { body: { lead_score: 75, reason: "Kvalifisert manuelt" } },
    );

    expect(result).toMatchObject({
      statusCode: 200,
      responseBody: { ok: true, lead_id: leadId, lead_score: 75 },
    });
    expect(harness.clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      expect.stringContaining("UPDATE crm_customers c"),
      expect.stringContaining("INSERT INTO lead_scores_history"),
      "COMMIT",
    ]);
  });

  it("rolls score changes back if history cannot be written", async () => {
    const harness = makeHarness(
      () => undefined,
      (sql) => {
        if (sql.includes("UPDATE crm_customers c")) {
          return {
            rows: [{ id: leadId, organization_id: organizationId }],
            rowCount: 1,
          };
        }
        if (sql.includes("INSERT INTO lead_scores_history")) {
          throw new Error("history insert failed");
        }
        return undefined;
      },
    );

    const result = await harness.request(
      "POST",
      "/api/leadgrid/intelligence/leads/:id/score-override",
      { body: { lead_score: 75 } },
    );

    expect(result.statusCode).toBe(500);
    expect(harness.clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(harness.clientQuery).not.toHaveBeenCalledWith("COMMIT");
  });
});
