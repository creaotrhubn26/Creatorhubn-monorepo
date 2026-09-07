import { readFileSync } from "node:fs";
import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { registerLeadgridApiKeyMgmtRoutes } from "./leadgrid-api-key-mgmt-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "99999999-9999-4999-8999-999999999999";
const userId = "user-admin";

function accessibleProjectRow(
  projectId: string,
  scopedOrganizationId = organizationId,
) {
  return {
    id: projectId,
    organization_id: scopedOrganizationId,
    name: "Dentum",
    description: null,
    industry: "Dental",
    status: "active",
    created_by: userId,
    member_role: "admin",
  };
}

function makeHarness(pool: Pool) {
  const routes = new Map<string, RequestHandler[]>();
  const app = {
    post: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`POST ${path}`, handlers),
    get: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`GET ${path}`, handlers),
  } as unknown as Express;
  const activeSessions = new Map([
    ["session-token", { userId, role: "admin" }],
  ]);
  registerLeadgridApiKeyMgmtRoutes({ app, pool, activeSessions });

  return async (body: Record<string, unknown>) => {
    const handler = routes.get("POST /api/leadgrid/api-keys")?.at(-1);
    if (!handler) throw new Error("missing create API-key route");
    const req = {
      headers: { authorization: "Bearer session-token" },
      body,
      query: {},
      params: {},
    } as unknown as Request;
    let status = 200;
    let responseBody: unknown;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(payload: unknown) {
        responseBody = payload;
        return this;
      },
    } as unknown as Response;
    await handler(req, res, vi.fn());
    return { status, body: responseBody };
  };
}

describe("Leadgrid API-key management project scope", () => {
  it("requires project binding by default", async () => {
    const query = vi.fn();
    const response = await makeHarness({ query } as unknown as Pool)({
      organization_id: organizationId,
      name: "Dentum connector",
    });

    expect(response).toMatchObject({
      status: 400,
      body: { error: "project_id_required" },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("persists a validated same-tenant project binding", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_projects p")) {
        return { rows: [accessibleProjectRow("dentum-oslo")] };
      }
      if (sql.includes("INSERT INTO leadgrid_api_keys")) {
        return { rows: [{ id: "33333333-3333-4333-8333-333333333333" }] };
      }
      return { rows: [] };
    });
    const response = await makeHarness({ query } as unknown as Pool)({
      organization_id: organizationId,
      project_id: "dentum-oslo",
      name: "Dentum connector",
      scopes: ["leads.read", "outcomes.write"],
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      project_id: "dentum-oslo",
      access_scope: "project",
    });
    const insert = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO leadgrid_api_keys"),
    );
    expect(String(insert?.[0])).toContain("project_id, access_scope");
    expect(insert?.[1]).toEqual(
      expect.arrayContaining([organizationId, "dentum-oslo", "project"]),
    );
  });

  it("does not let a multi-org user bind a key to another tenant's project", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_projects p")) {
        return {
          rows: [accessibleProjectRow("other-project", otherOrganizationId)],
        };
      }
      return { rows: [] };
    });
    const response = await makeHarness({ query } as unknown as Pool)({
      organization_id: organizationId,
      project_id: "other-project",
      name: "Cross tenant connector",
    });

    expect(response).toMatchObject({
      status: 404,
      body: { error: "project_not_found" },
    });
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO leadgrid_api_keys"),
      ),
    ).toBe(false);
  });

  it("rejects organization-wide creation for non-admin roles", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT role")) {
        return { rows: [{ role: "markedsforer" }] };
      }
      return { rows: [] };
    });
    const response = await makeHarness({ query } as unknown as Pool)({
      organization_id: organizationId,
      access_scope: "organization",
      name: "Agency-wide connector",
    });

    expect(response).toMatchObject({
      status: 403,
      body: { error: "organization_scope_requires_admin" },
    });
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO leadgrid_api_keys"),
      ),
    ).toBe(false);
  });

  it("allows an explicit organization-wide compatibility key for an admin", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT role")) return { rows: [{ role: "admin" }] };
      if (sql.includes("AS allowed")) return { rows: [{ allowed: true }] };
      if (sql.includes("INSERT INTO leadgrid_api_keys")) {
        return { rows: [{ id: "44444444-4444-4444-8444-444444444444" }] };
      }
      return { rows: [] };
    });
    const response = await makeHarness({ query } as unknown as Pool)({
      organization_id: organizationId,
      access_scope: "organization",
      name: "Legacy agency connector",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      project_id: null,
      access_scope: "organization",
    });
  });

  it("migrates legacy keys explicitly and enforces composite tenant binding", () => {
    const migration = readFileSync(
      new URL(
        "../migrations/0526_leadgrid_api_key_project_scope.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain("WHERE project_count = 1");
    expect(migration).toContain("SET project_id = single_projects.project_id");
    expect(migration).toContain("'project_scope_migration_requires_rotation'");
    expect(migration).toContain("revoked_at = COALESCE(revoked_at, NOW())");
    expect(migration).toContain(
      "ALTER COLUMN access_scope SET DEFAULT 'project'",
    );
    expect(migration).toContain("leadgrid_api_keys_access_scope_check");
    expect(migration).toContain("FOREIGN KEY (organization_id, project_id)");
    expect(migration).toContain(
      "REFERENCES leadgrid_projects(organization_id, id)",
    );
  });
});
