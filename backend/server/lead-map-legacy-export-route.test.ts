import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { registerLeadMapCompetitorRoutes } from "./lead-map-competitor-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";

function makeApp(routes: Map<string, RequestHandler[]>) {
  const register =
    (method: string) =>
    (path: string, ...handlers: RequestHandler[]) => {
      routes.set(`${method} ${path}`, handlers);
    };
  return {
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
    delete: register("DELETE"),
  } as unknown as Express;
}

function makeResponse() {
  let status = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
    send(payload: unknown) {
      body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return this;
    },
  } as unknown as Response;
  return { res, read: () => ({ status, body, headers }) };
}

describe("Lead Map legacy CSV export", () => {
  it("requires project scope and effective leads.export permission", async () => {
    const routes = new Map<string, RequestHandler[]>();
    const query = vi.fn();
    registerLeadMapCompetitorRoutes({
      app: makeApp(routes),
      pool: { query } as unknown as Pool,
      activeSessions: new Map([["token-a", { userId: "user-a" }]]),
    });
    const handler = routes
      .get("GET /api/admin-room/lead-map/leads/export-csv")
      ?.at(-1);
    if (!handler) throw new Error("Legacy export route was not registered");
    const req = {
      headers: { authorization: "Bearer token-a" },
      query: {},
    } as unknown as Request;
    const response = makeResponse();

    await handler(req, response.res, vi.fn());

    expect(response.read()).toMatchObject({
      status: 400,
      body: { error: "project_id_required" },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("exports only the selected org+project and neutralizes formula cells", async () => {
    const routes = new Map<string, RequestHandler[]>();
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_projects p")) {
        return {
          rows: [
            {
              id: "dentum",
              organization_id: organizationId,
              name: "Dentum",
              description: null,
              industry: "tannhelse",
              status: "active",
              created_by: "user-a",
              member_role: "markedssjef",
            },
          ],
        };
      }
      if (sql.includes("SELECT role FROM organization_members")) {
        return { rows: [{ role: "markedssjef" }] };
      }
      if (sql.includes("FROM role_permissions")) {
        return { rows: [{ permission_key: "leads.export" }] };
      }
      if (sql.includes("FROM leadgrid_user_permission_overrides")) {
        return { rows: [] };
      }
      if (sql.includes("FROM crm_customers c")) {
        return { rows: [{ name: "Dentum, Oslo", notes: "=1+1" }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    registerLeadMapCompetitorRoutes({
      app: makeApp(routes),
      pool: { query } as unknown as Pool,
      activeSessions: new Map([["token-a", { userId: "user-a" }]]),
    });
    const handler = routes
      .get("GET /api/admin-room/lead-map/leads/export-csv")
      ?.at(-1);
    if (!handler) throw new Error("Legacy export route was not registered");
    const req = {
      headers: { authorization: "Bearer token-a" },
      query: { projectId: "dentum" },
    } as unknown as Request;
    const response = makeResponse();

    await handler(req, response.res, vi.fn());

    const exportedQuery = query.mock.calls.find(([sql]) =>
      String(sql).includes("FROM crm_customers c"),
    );
    expect(String(exportedQuery?.[0])).toContain(
      "c.organization_id = $1::uuid",
    );
    expect(String(exportedQuery?.[0])).toContain("c.project_id = $2");
    expect(exportedQuery?.[1]).toEqual([organizationId, "dentum"]);
    expect(response.read().status).toBe(200);
    expect(String(response.read().body)).toContain('"Dentum, Oslo"');
    expect(String(response.read().body)).toContain("'=1+1");
  });
});
