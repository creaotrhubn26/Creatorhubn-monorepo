import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const projectAccess = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: projectAccess.load,
}));

import { registerLeadgridScheduledReportsRoutes } from "./leadgrid-scheduled-reports-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const reportId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";
const project = {
  id: projectId, organizationId, name: "Dentum", description: null,
  industry: null, status: "active", createdBy: "user-a", memberRole: "owner",
};

function setup(query: ReturnType<typeof vi.fn>) {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get(path: string, ...handlers: RequestHandler[]) {
      routes.set(`GET ${path}`, handlers.at(-1)!);
    },
    post(path: string, ...handlers: RequestHandler[]) {
      routes.set(`POST ${path}`, handlers.at(-1)!);
    },
    put(path: string, ...handlers: RequestHandler[]) {
      routes.set(`PUT ${path}`, handlers.at(-1)!);
    },
    delete(path: string, ...handlers: RequestHandler[]) {
      routes.set(`DELETE ${path}`, handlers.at(-1)!);
    },
  } as unknown as Express;
  registerLeadgridScheduledReportsRoutes({
    app,
    pool: { query } as unknown as Pool,
    activeSessions: new Map([["token", { userId: "user-a" }]]),
  });
  return routes;
}

function response() {
  let status = 200;
  let body: any;
  const res = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as Response;
  return { res, get status() { return status; }, get body() { return body; } };
}

function req(method: string): Request {
  return {
    method,
    headers: { authorization: "Bearer token" },
    params: { id: reportId },
    query: { organization_id: organizationId },
    body: { organization_id: organizationId },
    get: vi.fn(() => undefined),
  } as unknown as Request;
}

function baseQuery(extra: (sql: string, params: unknown[]) => unknown) {
  return vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = String(sqlValue);
    if (sql.includes("SELECT om.organization_id::text")) {
      return { rows: [{ organization_id: organizationId }] };
    }
    if (sql.includes("SELECT (") && sql.includes("REPORT_MANAGER_ROLES") === false) {
      return { rows: [{ allowed: true }] };
    }
    return extra(sql, params);
  });
}

describe("scheduled report row-level project access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not delete a report from a hidden project", async () => {
    projectAccess.load.mockResolvedValue(null);
    const query = baseQuery((sql) => {
      if (sql.includes("SELECT id::text, project_id")) {
        return { rows: [{ id: reportId, project_id: projectId }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const routes = setup(query);
    const out = response();

    await routes.get("DELETE /api/leadgrid/scheduled-reports/:id")!(
      req("DELETE"), out.res, vi.fn(),
    );

    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: "report_not_found" });
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith("DELETE"))).toBe(false);
  });

  it("binds delete to report, organization and accessible project", async () => {
    projectAccess.load.mockResolvedValue(project);
    const query = baseQuery((sql) => {
      if (sql.includes("SELECT id::text, project_id")) {
        return { rows: [{ id: reportId, project_id: projectId }] };
      }
      if (sql.includes("DELETE FROM leadgrid_scheduled_reports")) {
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const routes = setup(query);
    const out = response();

    await routes.get("DELETE /api/leadgrid/scheduled-reports/:id")!(
      req("DELETE"), out.res, vi.fn(),
    );

    expect(out.status).toBe(200);
    const deletion = query.mock.calls.find(([sql]) =>
      String(sql).includes("DELETE FROM leadgrid_scheduled_reports"));
    expect(deletion?.[0]).toContain("project_id = $3");
    expect(deletion?.[1]).toEqual([reportId, organizationId, projectId]);
  });

  it("lists only reports from currently accessible projects", async () => {
    projectAccess.load.mockImplementation(async (_pool, id: string) =>
      id === projectId ? project : null);
    const query = baseQuery((sql, params) => {
      if (sql.includes("SELECT DISTINCT project_id")) {
        return { rows: [{ project_id: projectId }, { project_id: "hidden" }] };
      }
      if (sql.includes("recipient_user_ids")) {
        expect(sql).toContain("project_id = ANY($2::text[])");
        expect(params).toEqual([organizationId, [projectId]]);
        return { rows: [{ id: reportId, project_id: projectId }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const routes = setup(query);
    const out = response();

    await routes.get("GET /api/leadgrid/scheduled-reports")!(
      req("GET"), out.res, vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(out.body.items).toEqual([{ id: reportId, project_id: projectId }]);
  });
});
