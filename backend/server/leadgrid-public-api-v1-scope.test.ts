import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

vi.mock("./leadgrid-api-key-auth.js", () => ({
  requireApiKey: () => vi.fn(),
  apiKeyAllowsProject: (
    context: {
      projectId: string | null;
      accessScope: "project" | "organization";
    },
    projectId: string,
  ) =>
    context.accessScope === "organization"
      ? context.projectId === null
      : context.projectId === projectId,
}));

import { registerLeadgridPublicApiV1 } from "./leadgrid-public-api-v1.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const apiKeyId = "22222222-2222-4222-8222-222222222222";

function makeHarness(pool: Pool) {
  const routes = new Map<string, RequestHandler[]>();
  const app = {
    get: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`GET ${path}`, handlers),
    post: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`POST ${path}`, handlers),
  } as unknown as Express;
  registerLeadgridPublicApiV1({ app, pool });

  return async (
    method: string,
    path: string,
    options: {
      body?: unknown;
      query?: Record<string, unknown>;
      params?: Record<string, string>;
      apiKey?: {
        projectId: string | null;
        accessScope: "project" | "organization";
      };
    } = {},
  ) => {
    const handler = routes.get(`${method} ${path}`)?.at(-1);
    if (!handler) throw new Error(`missing route ${method} ${path}`);
    const req = {
      body: options.body ?? {},
      query: options.query ?? {},
      params: options.params ?? {},
      headers: {},
      apiKey: {
        organizationId,
        apiKeyId,
        projectId: options.apiKey ? options.apiKey.projectId : "project-a",
        accessScope: options.apiKey ? options.apiKey.accessScope : "project",
        scopes: ["*"],
        rateLimitRpm: 60,
      },
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
    await handler(req, res, vi.fn());
    return { status, body };
  };
}

describe("Leadgrid Public API v1 tenant/project scope", () => {
  it("filters a lead list by authoritative organization and project", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_projects"))
        return { rows: [{ id: "project-a" }] };
      if (sql.includes("COUNT(*)")) return { rows: [{ total: "1" }] };
      return { rows: [{ id: "lead-a", project_id: "project-a" }] };
    });

    const response = await makeHarness({ query } as unknown as Pool)(
      "GET",
      "/api/v1/leads",
      { query: { project_id: "project-a" } },
    );
    expect(response.status).toBe(200);
    const dataSql = query.mock.calls
      .map(([sql]) => String(sql))
      .find(
        (sql) =>
          sql.includes("FROM crm_customers") && !sql.includes("COUNT(*)"),
      );
    expect(dataSql).toContain("organization_id = $1::uuid");
    expect(dataSql).toContain("project_id = $2");
    expect(dataSql).not.toContain("owner_user_id IN");
  });

  it("rejects a foreign project before creating a lead", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const response = await makeHarness({ query } as unknown as Pool)(
      "POST",
      "/api/v1/leads",
      { body: { name: "Dentum Clinic", project_id: "foreign-project" } },
    );
    expect(response.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  it("persists organization_id and a validated project_id on API-created leads", async () => {
    const query = vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes("FROM leadgrid_projects"))
        return { rows: [{ id: "project-a" }] };
      if (sql.includes("FROM organization_members"))
        return { rows: [{ user_id: "owner-a" }] };
      if (sql.includes("INSERT INTO crm_customers"))
        return { rows: [{ id: "lead-a" }] };
      return { rows: [] };
    });
    const response = await makeHarness({ query } as unknown as Pool)(
      "POST",
      "/api/v1/leads",
      { body: { name: "Dentum Clinic", project_id: "project-a" } },
    );
    expect(response.status).toBe(201);
    const insert = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO crm_customers"),
    );
    expect(String(insert?.[0])).toContain("organization_id");
    expect(String(insert?.[0])).toContain("project_id");
    expect(insert?.[1]).toEqual(
      expect.arrayContaining([organizationId, "project-a"]),
    );
  });

  it("defaults project-bound keys to their immutable project", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_projects"))
        return { rows: [{ id: "project-a" }] };
      if (sql.includes("COUNT(*)")) return { rows: [{ total: "0" }] };
      return { rows: [] };
    });
    const response = await makeHarness({ query } as unknown as Pool)(
      "GET",
      "/api/v1/leads",
    );
    expect(response.status).toBe(200);
    const dataCall = query.mock.calls.find(
      ([sql]) =>
        String(sql).includes("FROM crm_customers") &&
        !String(sql).includes("COUNT(*)"),
    );
    expect(dataCall?.[1]).toEqual([organizationId, "project-a", 50, 0]);
  });

  it("requires an explicit project on an organization-wide key", async () => {
    const query = vi.fn();
    const response = await makeHarness({ query } as unknown as Pool)(
      "GET",
      "/api/v1/leads",
      { apiKey: { projectId: null, accessScope: "organization" } },
    );
    expect(response).toMatchObject({
      status: 400,
      body: { error: "project_id_required" },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("allows an organization-wide key only after validating the named project", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_projects"))
        return { rows: [{ id: "project-b" }] };
      if (sql.includes("COUNT(*)")) return { rows: [{ total: "0" }] };
      return { rows: [] };
    });
    const response = await makeHarness({ query } as unknown as Pool)(
      "GET",
      "/api/v1/leads",
      {
        query: { project_id: "project-b" },
        apiKey: { projectId: null, accessScope: "organization" },
      },
    );
    expect(response.status).toBe(200);
    expect(query.mock.calls[0]?.[1]).toEqual([organizationId, "project-b"]);
  });

  it("scopes lead detail lookup by organization and project", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_projects"))
        return { rows: [{ id: "project-a" }] };
      return { rows: [{ id: "lead-a", project_id: "project-a" }], rowCount: 1 };
    });
    const response = await makeHarness({ query } as unknown as Pool)(
      "GET",
      "/api/v1/leads/:id",
      { params: { id: "33333333-3333-4333-8333-333333333333" } },
    );
    expect(response.status).toBe(200);
    const detailCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("FROM crm_customers"),
    );
    expect(String(detailCall?.[0])).toContain("AND project_id = $3");
    expect(detailCall?.[1]).toEqual([
      "33333333-3333-4333-8333-333333333333",
      organizationId,
      "project-a",
    ]);
  });

  it("joins recommendations to project-scoped leads", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_projects"))
        return { rows: [{ id: "project-a" }] };
      return { rows: [] };
    });
    const response = await makeHarness({ query } as unknown as Pool)(
      "GET",
      "/api/v1/recommendations",
    );
    expect(response.status).toBe(200);
    const recommendationsCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("FROM lead_recommendations"),
    );
    expect(String(recommendationsCall?.[0])).toContain("JOIN crm_customers c");
    expect(String(recommendationsCall?.[0])).toContain("c.project_id = $2");
    expect(recommendationsCall?.[1]).toEqual([organizationId, "project-a", 50]);
  });
});
