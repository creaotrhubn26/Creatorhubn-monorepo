import type {
  Express,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { Pool, PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const integrations = vi.hoisted(() => ({
  compute: vi.fn(async () => undefined),
  emit: vi.fn(async () => undefined),
  publish: vi.fn(async () => undefined),
}));

vi.mock("./leadgrid-intelligence-engine.js", () => ({
  computeIntelligenceForLead: integrations.compute,
  fetchWeights: vi.fn(async () => ({})),
  DEFAULT_WEIGHTS: {},
}));
vi.mock("./webhook-emitter.js", () => ({ emitWebhook: integrations.emit }));
vi.mock("./leadgrid-workflow-engine.js", () => ({
  publishEvent: integrations.publish,
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
type QueryHandler = (
  sql: string,
  params?: readonly unknown[],
) => QueryResultLike | Promise<QueryResultLike>;
type RegisteredRoute = { path: string; handlers: RequestHandler[] };

function projectAndPermissionQuery(sql: string): QueryResultLike {
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
  if (sql.includes("SELECT role FROM organization_members")) {
    return { rows: [{ role: "admin" }], rowCount: 1 };
  }
  if (sql.includes("SELECT key FROM permissions")) {
    return {
      rows: [{ key: "intelligence.execute_recommendation" }],
      rowCount: 1,
    };
  }
  return { rows: [], rowCount: 0 };
}

function makeHarness(clientHandler: QueryHandler) {
  const routes: RegisteredRoute[] = [];
  const register =
    () => (path: string, ...handlers: RequestHandler[]) =>
      routes.push({ path, handlers });
  const app = {
    get: register(),
    post: register(),
    patch: register(),
  } as unknown as Express;

  const query = vi.fn(async (sql: string, _params?: readonly unknown[]) =>
    projectAndPermissionQuery(sql),
  );
  const clientQuery = vi.fn(async (sql: string, params?: readonly unknown[]) =>
    clientHandler(sql, params),
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
    body: Record<string, unknown> = {
      projectId,
      pipeline_stage: "meeting",
    },
  ) {
    const path = "/api/leadgrid/intelligence/leads/:id/pipeline-stage";
    const route = routes.find((candidate) => candidate.path === path);
    if (!route) throw new Error("pipeline route missing");
    const req = {
      body,
      query: {},
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
      json(bodyValue: unknown) {
        responseBody = bodyValue;
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

  return { request, query, clientQuery, connect, release };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Leadgrid pipeline-stage project scope and atomicity", () => {
  it("requires an explicit customer project before opening a transaction", async () => {
    const harness = makeHarness(() => ({ rows: [], rowCount: 0 }));

    const result = await harness.request({ pipeline_stage: "meeting" });

    expect(result).toMatchObject({
      statusCode: 400,
      responseBody: { error: "project_id_required" },
    });
    expect(harness.connect).not.toHaveBeenCalled();
  });

  it("updates and audits one assigned/project-scoped lead in one transaction", async () => {
    const harness = makeHarness((sql, params) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("SELECT c.pipeline_stage")) {
        expect(sql).toContain("c.organization_id = $2::uuid");
        expect(sql).toContain("c.project_id = $3");
        expect(sql).toContain("c.assigned_user_id::text = $4");
        expect(sql).toContain("FOR UPDATE");
        expect(params).toEqual([leadId, organizationId, projectId, userId]);
        return { rows: [{ pipeline_stage: "qualified" }], rowCount: 1 };
      }
      if (sql.includes("UPDATE crm_customers")) {
        expect(sql).toContain("project_id = $5");
        expect(params).toEqual([
          "meeting",
          userId,
          leadId,
          organizationId,
          projectId,
        ]);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO crm_lead_activities")) {
        expect(String(params?.[5])).toContain(
          '"project_id":"' + projectId + '"',
        );
        return { rows: [], rowCount: 1 };
      }
      throw new Error("unexpected client query: " + sql);
    });

    const result = await harness.request();

    expect(result).toMatchObject({
      statusCode: 200,
      responseBody: {
        ok: true,
        old_stage: "qualified",
        new_stage: "meeting",
        replayed: false,
      },
    });
    expect(harness.clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      expect.stringContaining("SELECT c.pipeline_stage"),
      expect.stringContaining("UPDATE crm_customers"),
      expect.stringContaining("INSERT INTO crm_lead_activities"),
      "COMMIT",
    ]);
    expect(integrations.emit).toHaveBeenCalledTimes(1);
    expect(integrations.publish).toHaveBeenCalledTimes(1);
  });

  it("treats a same-stage retry as a replay without duplicate activity", async () => {
    const harness = makeHarness((sql) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("SELECT c.pipeline_stage")) {
        return { rows: [{ pipeline_stage: "meeting" }], rowCount: 1 };
      }
      throw new Error("unexpected mutation on replay: " + sql);
    });

    const result = await harness.request();

    expect(result).toMatchObject({
      statusCode: 200,
      responseBody: { replayed: true },
    });
    expect(harness.clientQuery.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      expect.stringContaining("SELECT c.pipeline_stage"),
      "COMMIT",
    ]);
    expect(integrations.emit).not.toHaveBeenCalled();
    expect(integrations.publish).not.toHaveBeenCalled();
  });

  it("rolls the stage update back when activity persistence fails", async () => {
    const harness = makeHarness((sql) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("SELECT c.pipeline_stage")) {
        return { rows: [{ pipeline_stage: "qualified" }], rowCount: 1 };
      }
      if (sql.includes("UPDATE crm_customers")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO crm_lead_activities")) {
        throw new Error("activity insert failed");
      }
      throw new Error("unexpected client query: " + sql);
    });

    const result = await harness.request();

    expect(result).toMatchObject({
      statusCode: 500,
      responseBody: { error: "update_failed" },
    });
    expect(harness.clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(harness.clientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(integrations.emit).not.toHaveBeenCalled();
  });
});
