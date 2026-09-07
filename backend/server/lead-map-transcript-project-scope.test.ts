import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { registerLeadMapTranscriptRoutes } from "./lead-map-transcript-routes.js";

const leadId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";
const userId = "seller-a";

function makeHarness(pool: Pool) {
  const routes = new Map<string, RequestHandler[]>();
  const app = {
    post: (path: string, ...handlers: RequestHandler[]) => routes.set(`POST ${path}`, handlers),
  } as unknown as Express;
  registerLeadMapTranscriptRoutes({
    app,
    pool,
    activeSessions: new Map([["session", { userId }]]),
  });
  return async (key: string, input: { params?: Record<string, string>; body?: unknown }) => {
    const handler = routes.get(key)?.at(-1);
    if (!handler) throw new Error(`missing route ${key}`);
    const req = {
      headers: { authorization: "Bearer session" },
      params: input.params ?? {},
      body: input.body ?? {},
      query: {},
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
    throw new Error(`unexpected query after access denial: ${sql}`);
  });
  return { pool: { query } as unknown as Pool, query };
}

describe("Leadgrid transcript and meeting-brief project scope", () => {
  it("hides meeting briefs after project access is revoked", async () => {
    const { pool, query } = revokedPool();
    const response = await makeHarness(pool)(
      "POST /api/admin-room/lead-map/leads/:id/meeting-brief",
      { params: { id: leadId }, body: {} },
    );
    expect(response).toEqual({ status: 404, body: { error: "lead_ikke_funnet" } });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("hides transcript parsing after project access is revoked", async () => {
    const { pool, query } = revokedPool();
    const response = await makeHarness(pool)(
      "POST /api/admin-room/lead-map/visits/parse-transcript",
      { body: { lead_id: leadId, transcript: "Kunden ønsker oppfølging neste uke." } },
    );
    expect(response).toEqual({ status: 404, body: { error: "lead_ikke_funnet" } });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
