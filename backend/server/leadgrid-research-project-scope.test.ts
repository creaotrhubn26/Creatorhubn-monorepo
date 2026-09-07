import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { registerLeadgridResearchRoutes } from "./leadgrid-research-routes.js";

const leadId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";
const userId = "legacy-owner";

function makeHarness(pool: Pool) {
  const routes = new Map<string, RequestHandler[]>();
  const app = {
    get: (path: string, ...handlers: RequestHandler[]) => routes.set(`GET ${path}`, handlers),
    post: (path: string, ...handlers: RequestHandler[]) => routes.set(`POST ${path}`, handlers),
  } as unknown as Express;
  registerLeadgridResearchRoutes({
    app,
    pool,
    activeSessions: new Map([["session", { userId, role: "super_admin" }]]),
  });
  return async (key: string) => {
    const handler = routes.get(key)?.at(-1);
    if (!handler) throw new Error(`missing route ${key}`);
    const req = {
      headers: { authorization: "Bearer session" },
      params: { id: leadId },
      query: {},
      body: {},
    } as unknown as Request;
    let status = 200;
    let body: unknown;
    const res = {
      status(code: number) { status = code; return this; },
      json(payload: unknown) { body = payload; return this; },
    } as unknown as Response;
    await handler(req, res, vi.fn());
    return { status, body };
  };
}

function revokedPool() {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM crm_customers c")) {
      return { rows: [{ id: leadId, organization_id: organizationId, project_id: projectId }] };
    }
    if (sql.includes("FROM leadgrid_projects p")) return { rows: [] };
    throw new Error(`unexpected query after project revoke: ${sql}`);
  });
  return { pool: { query } as unknown as Pool, query };
}

describe("Leadgrid cached research project scope", () => {
  it.each([
    "GET /api/leadgrid/leads/:id/research",
    "POST /api/leadgrid/leads/:id/research",
  ])("hides owner/super-admin research access after revoke: %s", async (route) => {
    const { pool, query } = revokedPool();
    const response = await makeHarness(pool)(route);
    expect(response).toEqual({ status: 404, body: { error: "lead_not_found" } });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
