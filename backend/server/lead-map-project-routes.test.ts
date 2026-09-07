import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import { registerLeadMapProjectRoutes } from "./lead-map-project-routes.js";

const actorId = "user-a";
const organizationId = "11111111-1111-4111-8111-111111111111";
const foreignOrganizationId = "22222222-2222-4222-8222-222222222222";
const leadId = "33333333-3333-4333-8333-333333333333";

function accessibleProjectRow(id: string, organization = organizationId) {
  return {
    id,
    organization_id: organization,
    name: `Project ${id}`,
    description: null,
    project_type: "b2b_sales",
    industry: null,
    status: "active",
    created_by: actorId,
    member_role: "owner",
  };
}

type CallOptions = {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  session?: Record<string, unknown>;
  authorization?: string;
};

function makeHarness(pool: Pool) {
  const routes = new Map<string, RequestHandler[]>();
  const app = {
    get: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`GET ${path}`, handlers),
    post: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`POST ${path}`, handlers),
    patch: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`PATCH ${path}`, handlers),
  } as unknown as Express;
  registerLeadMapProjectRoutes({
    app,
    pool,
    activeSessions: new Map([
      ["token-a", { userId: actorId, email: "a@example.no" }],
    ]),
  });

  return {
    async call(method: string, path: string, options: CallOptions = {}) {
      const handler = routes.get(`${method} ${path}`)?.at(-1);
      if (!handler) throw new Error(`Missing route ${method} ${path}`);
      const req = {
        body: options.body ?? {},
        params: options.params ?? {},
        query: options.query ?? {},
        headers: options.authorization
          ? { authorization: options.authorization }
          : {},
        session: options.session,
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
    },
  };
}

describe("Lead Map project tenant boundaries", () => {
  it("accepts the hydrated cookie session and creates in the selected organization", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM organization_members")) {
        return { rows: [{ organization_id: organizationId }] };
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const connect = vi.fn(async () => ({ query, release }));
    const response = await makeHarness({ query, connect } as unknown as Pool).call(
      "POST",
      "/api/admin-room/lead-map/projects",
      {
        session: { userId: actorId },
        body: {
          name: "Outbound Norge",
          organization_id: organizationId,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      project: {
        organizationId,
        name: "Outbound Norge",
      },
    });
    const insert = query.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO leadgrid_projects"),
    );
    expect(insert?.[1]?.[1]).toBe(organizationId);
    expect(insert?.[1]?.[4]).toBe(actorId);
    const membership = query.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO leadgrid_project_members"),
    );
    expect(membership?.[1]).toEqual([organizationId, expect.any(String), actorId]);
    expect(query.mock.calls.map(([sql]) => sql.trim())).toEqual(
      expect.arrayContaining(["BEGIN", "COMMIT"]),
    );
    expect(connect).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("rolls back the project when the owner membership cannot be persisted", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM organization_members")) {
        return { rows: [{ organization_id: organizationId }] };
      }
      if (sql.includes("INSERT INTO leadgrid_project_members")) {
        throw new Error("membership insert failed");
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    const connect = vi.fn(async () => ({ query, release }));

    const response = await makeHarness({ query, connect } as unknown as Pool).call(
      "POST",
      "/api/admin-room/lead-map/projects",
      {
        authorization: "Bearer token-a",
        body: { name: "Atomic Project", organization_id: organizationId },
      },
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "project_create_failed" });
    const statements = query.mock.calls.map(([sql]) => sql.trim());
    expect(statements).toContain("BEGIN");
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
    expect(statements.some((sql) => sql.includes("INSERT INTO leadgrid_projects"))).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("does not silently choose one organization for a multi-org user", async () => {
    const query = vi.fn(async () => ({
      rows: [
        { organization_id: organizationId },
        { organization_id: foreignOrganizationId },
      ],
    }));
    const release = vi.fn();
    const connect = vi.fn(async () => ({ query, release }));
    const response = await makeHarness({ query, connect } as unknown as Pool).call(
      "POST",
      "/api/admin-room/lead-map/projects",
      {
        authorization: "Bearer token-a",
        body: { name: "Outbound Norge" },
      },
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: "organization_id_required" });
    expect(query.mock.calls.map(([sql]) => sql.trim())).toContain("ROLLBACK");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("does not list a selected organization's inaccessible projects", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const response = await makeHarness({ query } as unknown as Pool).call(
      "GET",
      "/api/admin-room/lead-map/projects",
      {
        session: { userId: actorId },
        query: { organization_id: foreignOrganizationId },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ projects: [] });
    expect(query.mock.calls[0][0]).toContain("LEFT JOIN leadgrid_project_members pm");
    expect(query.mock.calls[0][0]).toContain("denied.effect = 'revoke'");
    expect(query.mock.calls[0][1]).toEqual([actorId, foreignOrganizationId]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("lists only projects in the selected organization membership", async () => {
    const query = vi.fn(async () => ({
      rows: [{
        id: "project-a",
        organization_id: organizationId,
        name: "Project A",
        description: null,
        status: "active",
        has_brand_kit: false,
        lead_count: 4,
        competitor_count: 1,
      }],
    }));
    const response = await makeHarness({ query } as unknown as Pool).call(
      "GET",
      "/api/admin-room/lead-map/projects",
      {
        session: { userId: actorId },
        query: { organization_id: organizationId },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      projects: [{ id: "project-a", organizationId }],
    });
    const list = query.mock.calls[0];
    expect(list[0]).toContain("LEFT JOIN organization_members om");
    expect(list[0]).toContain("LEFT JOIN leadgrid_project_members pm");
    expect(list[0]).toContain("($2::uuid IS NULL OR p.organization_id = $2::uuid)");
    expect(list[0]).toContain("p.created_by = $1");
    expect(list[0]).toContain("projects.view_all");
    expect(list[1]).toEqual([actorId, organizationId]);
  });

  it("hides a project when the caller has no organization membership", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const response = await makeHarness({ query } as unknown as Pool).call(
      "GET",
      "/api/admin-room/lead-map/projects/:id/summary",
      {
        session: { userId: actorId },
        params: { id: "foreign-project" },
      },
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "project_not_found" });
    expect(query.mock.calls[0][0]).toContain("LEFT JOIN organization_members om");
    expect(query.mock.calls[0][0]).toContain("LEFT JOIN leadgrid_project_members pm");
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("moves a lead only after both source and target project ACL checks", async () => {
    const query = vi.fn(async (sql: string, params?: readonly unknown[]) => {
      if (sql.includes("FROM crm_customers c") && sql.includes("c.project_id IS NOT NULL")) {
        return {
          rows: [{
            id: leadId,
            organization_id: organizationId,
            project_id: "project-a",
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM leadgrid_projects p")) {
        return { rows: [accessibleProjectRow(String(params?.[0]))], rowCount: 1 };
      }
      if (sql.includes("UPDATE crm_customers c")) {
        return { rows: [{ id: leadId, project_id: "project-b" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const response = await makeHarness({ query } as unknown as Pool).call(
      "PATCH",
      "/api/admin-room/lead-map/leads/:id/project",
      {
        authorization: "Bearer token-a",
        params: { id: leadId },
        body: { projectId: "project-b" },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, projectId: "project-b" });
    expect(query.mock.calls.filter(([sql]) =>
      sql.includes("FROM leadgrid_projects p"),
    )).toHaveLength(2);
    const update = query.mock.calls.find(([sql]) =>
      sql.includes("UPDATE crm_customers c"),
    );
    expect(update?.[0]).toContain("c.organization_id = $2::uuid");
    expect(update?.[0]).toContain("c.project_id = $3");
    expect(update?.[0]).not.toContain("owner_user_id");
    expect(update?.[1]).toEqual([
      leadId,
      organizationId,
      "project-a",
      "project-b",
    ]);
  });

  it("does not move a lead to an accessible project in another tenant", async () => {
    const query = vi.fn(async (sql: string, params?: readonly unknown[]) => {
      if (sql.includes("FROM crm_customers c") && sql.includes("c.project_id IS NOT NULL")) {
        return {
          rows: [{
            id: leadId,
            organization_id: organizationId,
            project_id: "project-a",
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("FROM leadgrid_projects p")) {
        const id = String(params?.[0]);
        const organization = id === "project-b" ? foreignOrganizationId : organizationId;
        return { rows: [accessibleProjectRow(id, organization)], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const response = await makeHarness({ query } as unknown as Pool).call(
      "PATCH",
      "/api/admin-room/lead-map/leads/:id/project",
      {
        authorization: "Bearer token-a",
        params: { id: leadId },
        body: { projectId: "project-b" },
      },
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "project_not_found" });
    expect(query.mock.calls.some(([sql]) =>
      sql.includes("UPDATE crm_customers c"),
    )).toBe(false);
  });

  it("bulk-moves only a complete, ACL-approved source set", async () => {
    const secondLeadId = "44444444-4444-4444-8444-444444444444";
    const query = vi.fn(async (sql: string, params?: readonly unknown[]) => {
      if (sql.includes("FROM leadgrid_projects p")) {
        return { rows: [accessibleProjectRow(String(params?.[0]))], rowCount: 1 };
      }
      if (sql.includes("SELECT id::text, project_id::text")) {
        return {
          rows: [
            { id: leadId, project_id: "project-a" },
            { id: secondLeadId, project_id: "project-a" },
          ],
          rowCount: 2,
        };
      }
      if (sql.includes("WITH expected AS")) {
        return { rows: [{ updated: 2 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const response = await makeHarness({ query } as unknown as Pool).call(
      "POST",
      "/api/admin-room/lead-map/leads/bulk-assign-project",
      {
        authorization: "Bearer token-a",
        body: {
          organization_id: organizationId,
          leadIds: [leadId, secondLeadId],
          projectId: "project-b",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, updated: 2 });
    expect(query.mock.calls.filter(([sql]) =>
      sql.includes("FROM leadgrid_projects p"),
    )).toHaveLength(2);
    const update = query.mock.calls.find(([sql]) =>
      sql.includes("WITH expected AS"),
    );
    expect(update?.[0]).toContain("e.project_id = c.project_id");
    expect(update?.[0]).toContain("c.organization_id = $1::uuid");
    expect(update?.[0]).not.toContain("owner_user_id");
    expect(update?.[1]?.slice(0, 2)).toEqual([organizationId, "project-b"]);
    expect(JSON.parse(String(update?.[1]?.[2]))).toEqual([
      { id: leadId, projectId: "project-a" },
      { id: secondLeadId, projectId: "project-a" },
    ]);
  });

  it("rejects bulk project removal before any persistence query", async () => {
    const query = vi.fn();

    const response = await makeHarness({ query } as unknown as Pool).call(
      "POST",
      "/api/admin-room/lead-map/leads/bulk-assign-project",
      {
        authorization: "Bearer token-a",
        body: { organization_id: organizationId, leadIds: [leadId], projectId: null },
      },
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_project_id" });
    expect(query).not.toHaveBeenCalled();
  });
});
