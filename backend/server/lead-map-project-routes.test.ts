import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import { registerLeadMapProjectRoutes } from "./lead-map-project-routes.js";

const actorId = "user-a";
const organizationId = "11111111-1111-4111-8111-111111111111";
const foreignOrganizationId = "22222222-2222-4222-8222-222222222222";

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
    const response = await makeHarness({ query } as unknown as Pool).call(
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
  });

  it("does not silently choose one organization for a multi-org user", async () => {
    const query = vi.fn(async () => ({
      rows: [
        { organization_id: organizationId },
        { organization_id: foreignOrganizationId },
      ],
    }));
    const response = await makeHarness({ query } as unknown as Pool).call(
      "POST",
      "/api/admin-room/lead-map/projects",
      {
        authorization: "Bearer token-a",
        body: { name: "Outbound Norge" },
      },
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: "organization_id_required" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("rejects a selected organization without membership", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const response = await makeHarness({ query } as unknown as Pool).call(
      "GET",
      "/api/admin-room/lead-map/projects",
      {
        session: { userId: actorId },
        query: { organization_id: foreignOrganizationId },
      },
    );

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: "ikke_medlem_av_org",
      organization_id: foreignOrganizationId,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("lists only projects in the selected organization membership", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM organization_members")) {
        return { rows: [{ organization_id: organizationId }] };
      }
      return {
        rows: [
          {
            id: "project-a",
            organization_id: organizationId,
            name: "Project A",
            description: null,
            status: "active",
            has_brand_kit: false,
            lead_count: 4,
            competitor_count: 1,
          },
        ],
      };
    });
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
    const list = query.mock.calls[1];
    expect(list[0]).toContain("JOIN organization_members om");
    expect(list[0]).toContain("p.organization_id = $2::uuid");
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
    expect(query.mock.calls[0][0]).toContain("JOIN organization_members om");
  });

  it("guards project assignment with same-organization membership", async () => {
    const query = vi.fn(async () => ({
      rows: [{ id: "33333333-3333-4333-8333-333333333333", project_id: "project-a" }],
      rowCount: 1,
    }));
    const response = await makeHarness({ query } as unknown as Pool).call(
      "PATCH",
      "/api/admin-room/lead-map/leads/:id/project",
      {
        authorization: "Bearer token-a",
        params: { id: "33333333-3333-4333-8333-333333333333" },
        body: { projectId: "project-a" },
      },
    );

    expect(response.status).toBe(200);
    const sql = query.mock.calls[0][0];
    expect(sql).toContain("p.organization_id = c.organization_id");
    expect(sql).toContain("om.user_id = $2");
  });
});
