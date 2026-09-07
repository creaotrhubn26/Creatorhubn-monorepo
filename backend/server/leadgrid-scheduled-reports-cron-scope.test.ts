import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { registerLeadgridScheduledReportsRoutes } from "./leadgrid-scheduled-reports-routes.js";

describe("Leadgrid scheduled report claim", () => {
  it("atomically leases only active customer-project reports", async () => {
    const routes = new Map<string, RequestHandler[]>();
    const app = {
      get: (path: string, ...handlers: RequestHandler[]) =>
        routes.set(`GET ${path}`, handlers),
      post: (path: string, ...handlers: RequestHandler[]) =>
        routes.set(`POST ${path}`, handlers),
      put: (path: string, ...handlers: RequestHandler[]) =>
        routes.set(`PUT ${path}`, handlers),
      delete: (path: string, ...handlers: RequestHandler[]) =>
        routes.set(`DELETE ${path}`, handlers),
    } as unknown as Express;
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT role FROM users")) {
        return { rows: [{ role: "super_admin" }] };
      }
      if (sql.includes("WITH due AS")) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    registerLeadgridScheduledReportsRoutes({
      app,
      pool: { query } as unknown as Pool,
      activeSessions: new Map([["token-a", { userId: "user-a" }]]),
    });
    const handler = routes
      .get("POST /api/leadgrid/scheduled-reports/run")
      ?.at(-1);
    if (!handler)
      throw new Error("Scheduled-report run route was not registered");
    const req = {
      headers: { authorization: "Bearer token-a" },
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

    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, due: 0, sent: 0, errors: 0 });
    const claimSql = String(query.mock.calls[1]?.[0]);
    expect(claimSql).toContain("s.project_id IS NOT NULL");
    expect(claimSql).toContain("FOR UPDATE OF s SKIP LOCKED");
    expect(claimSql).toContain("UPDATE leadgrid_scheduled_reports s");
    expect(claimSql).toContain("INTERVAL '15 minutes'");
    expect(claimSql).toContain("p.project_type IS NULL");
  });
});
