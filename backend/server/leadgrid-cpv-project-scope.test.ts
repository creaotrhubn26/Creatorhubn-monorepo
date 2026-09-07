import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerLeadgridCpvRoutes } from "./leadgrid-cpv-routes.js";

function harness(query: ReturnType<typeof vi.fn>) {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get: (path: string, handler: RequestHandler) => routes.set(`GET ${path}`, handler),
    post: (path: string, handler: RequestHandler) => routes.set(`POST ${path}`, handler),
  } as unknown as Express;
  registerLeadgridCpvRoutes({
    app,
    pool: { query } as unknown as Pool,
    requireUserSession: vi.fn(async () => ({ userId: "user-a" })),
  });
  const handler = routes.get("POST /api/leadgrid/cpv/backfill");
  if (!handler) throw new Error("missing CPV backfill route");

  return async (token = "cron-secret") => {
    const req = {
      headers: { "x-cron-trigger-token": token },
    } as unknown as Request;
    let status = 200;
    let body: unknown;
    const res = {
      status(value: number) { status = value; return this; },
      json(value: unknown) { body = value; return this; },
    } as unknown as Response;
    await handler(req, res, vi.fn());
    return { status, body };
  };
}

beforeEach(() => {
  process.env.LEADGRID_CRON_TRIGGER_TOKEN = "cron-secret";
});

afterEach(() => {
  delete process.env.LEADGRID_CRON_TRIGGER_TOKEN;
  vi.restoreAllMocks();
});

describe("Leadgrid CPV project scope", () => {
  it("selects only canonical Leadgrid rows and bulk-updates the exact tuple", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT c.id::text")) {
        return {
          rows: [{
            id: "11111111-1111-4111-8111-111111111111",
            organization_id: "22222222-2222-4222-8222-222222222222",
            project_id: "dentum-oslo",
            name: "Dentum tannklinikk",
            category: "tannlege",
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("WITH requested AS")) {
        return { rows: [{ cpv_koder: '[\"85000000\"]' }], rowCount: 1 };
      }
      throw new Error(`unexpected query: ${sql}`);
    });

    const result = await harness(query)();

    expect(result).toEqual({
      status: 200,
      body: {
        ok: true,
        behandlet: 1,
        medKoder: 1,
        scope: "leadgrid_project",
      },
    });
    const selectSql = String(query.mock.calls[0][0]);
    expect(selectSql).toContain("JOIN leadgrid_projects project");
    expect(selectSql).toContain("project.organization_id = c.organization_id");
    expect(selectSql).toContain("project.id = c.project_id");

    const [updateSql, params] = query.mock.calls[1];
    expect(String(updateSql)).toContain("customer.organization_id = requested.organization_id");
    expect(String(updateSql)).toContain("customer.project_id = requested.project_id");
    expect(String(params[0])).toContain("dentum-oslo");
  });

  it("does not query the database when cron authentication fails", async () => {
    const query = vi.fn();
    const result = await harness(query)("wrong-secret");

    expect(result).toEqual({ status: 401, body: { error: "unauthorized" } });
    expect(query).not.toHaveBeenCalled();
  });
});
