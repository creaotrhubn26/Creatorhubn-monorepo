import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lead-brreg-service.js", () => ({
  lookupCompanyForNewLead: vi.fn(),
}));

import { registerLeadgridBackfillCron } from "./leadgrid-backfill-cron.js";

function harness(query: ReturnType<typeof vi.fn>) {
  const routes = new Map<string, RequestHandler>();
  const app = {
    post: (path: string, handler: RequestHandler) => routes.set(path, handler),
  } as unknown as Express;
  const pool = { query } as unknown as Pool;
  registerLeadgridBackfillCron({ app, pool });
  const handler = routes.get("/api/leadgrid/cron/backfill-organization-id");
  if (!handler) throw new Error("missing backfill route");

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
  process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN = "cron-secret";
});

afterEach(() => {
  delete process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN;
  vi.restoreAllMocks();
});

describe("Leadgrid project-authoritative legacy backfill", () => {
  it("repairs only rows linked to an explicit Leadgrid project", async () => {
    let batches = 0;
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("WITH to_update AS")) {
        batches += 1;
        return { rows: [{ updated: batches === 1 ? 2 : 0 }], rowCount: 1 };
      }
      if (sql.includes("repairable_project_scope")) {
        return {
          rows: [{
            missing_org: "7",
            repairable_project_scope: "0",
            unscoped_non_leadgrid: "7",
            total: "19",
          }],
          rowCount: 1,
        };
      }
      throw new Error(`unexpected query: ${sql}`);
    });

    const result = await harness(query)();

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      total_updated: 2,
      strategy: "authoritative_project_only",
      remaining: {
        repairable_project_scope: 0,
        unscoped_non_leadgrid_rows: 7,
      },
    });
    const repairSql = String(query.mock.calls[0][0]);
    expect(repairSql).toContain("JOIN leadgrid_projects p ON p.id = c.project_id");
    expect(repairSql).toContain("c.organization_id IS DISTINCT FROM p.organization_id");
    expect(repairSql).toContain("FOR UPDATE OF c SKIP LOCKED");
    expect(repairSql).not.toContain("organization_members");
    expect(repairSql).not.toContain("owner_user_id");
  });

  it("does not touch the database when cron authentication fails", async () => {
    const query = vi.fn();
    const result = await harness(query)("wrong-secret");

    expect(result).toEqual({ status: 401, body: { error: "invalid_cron_token" } });
    expect(query).not.toHaveBeenCalled();
  });
});
