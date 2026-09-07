import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  markItemSkipped,
  processUrlResearchBatch,
  retrySingleItem,
} from "./leadgrid-url-batch-processor.js";
import { registerLeadgridUrlResearchRoutes } from "./leadgrid-url-research-routes.js";

const leadId = "11111111-1111-4111-8111-111111111111";
const batchId = "22222222-2222-4222-8222-222222222222";
const organizationId = "33333333-3333-4333-8333-333333333333";
const projectId = "dentum-oslo";
const userId = "creator-a";

function makeHarness(pool: Pool) {
  const routes = new Map<string, RequestHandler[]>();
  const app = {
    get: (path: string, ...handlers: RequestHandler[]) => routes.set(`GET ${path}`, handlers),
    post: (path: string, ...handlers: RequestHandler[]) => routes.set(`POST ${path}`, handlers),
  } as unknown as Express;
  registerLeadgridUrlResearchRoutes({
    app,
    pool,
    activeSessions: new Map([["session", { userId }]]),
  });
  return async (
    key: string,
    input: { params?: Record<string, string>; query?: Record<string, string>; body?: unknown } = {},
  ) => {
    const handler = routes.get(key)?.at(-1);
    if (!handler) throw new Error(`missing route ${key}`);
    const req = {
      headers: { authorization: "Bearer session" },
      params: input.params ?? {},
      query: input.query ?? {},
      body: input.body ?? {},
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

describe("Leadgrid URL research persisted project scope", () => {
  it("hides a creator-owned draft after project access is revoked", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM crm_customers c")) {
        return { rows: [{ id: leadId, organization_id: organizationId, project_id: projectId }] };
      }
      if (sql.includes("FROM leadgrid_projects p")) return { rows: [] };
      throw new Error(`unexpected query after access denial: ${sql}`);
    });
    const response = await makeHarness({ query } as unknown as Pool)(
      "GET /api/leadgrid/url-research/preview/:draft_lead_id",
      { params: { draft_lead_id: leadId } },
    );
    expect(response).toEqual({ status: 404, body: { error: "draft_not_found" } });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("hides a creator-owned batch after project access is revoked", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_url_research_batches")) {
        return {
          rows: [{
            id: batchId,
            organization_id: organizationId,
            project_id: projectId,
            created_by: userId,
            status: "completed",
          }],
        };
      }
      if (sql.includes("FROM leadgrid_projects p")) return { rows: [] };
      throw new Error(`unexpected query after access denial: ${sql}`);
    });
    const response = await makeHarness({ query } as unknown as Pool)(
      "GET /api/leadgrid/url-research/batches/:id",
      { params: { id: batchId } },
    );
    expect(response).toEqual({ status: 404, body: { error: "batch_not_found" } });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("does not create a draft in an inaccessible requested project", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_projects p")) return { rows: [] };
      throw new Error(`unexpected mutation: ${sql}`);
    });
    const response = await makeHarness({ query } as unknown as Pool)(
      "POST /api/leadgrid/url-research/start",
      { body: { url: "dentum.no", project_id: projectId } },
    );
    expect(response).toEqual({ status: 404, body: { error: "project_not_found" } });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("cancels background processing when the creator loses project access", async () => {
    const runner = vi.fn();
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT organization_id::text, project_id, created_by::text")) {
        return { rows: [{ organization_id: organizationId, project_id: projectId, created_by: userId }] };
      }
      if (sql.includes("FROM leadgrid_projects p")) return { rows: [] };
      if (sql.includes("UPDATE leadgrid_url_research_batches")) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected query: ${sql}`);
    });
    await processUrlResearchBatch({ query } as unknown as Pool, batchId, { runner });

    expect(runner).not.toHaveBeenCalled();
    const cancellation = query.mock.calls.find(([sql]) =>
      String(sql).includes("project_access_revoked"),
    );
    expect(String(cancellation?.[0])).toContain("organization_id = $2::uuid");
    expect(String(cancellation?.[0])).toContain("project_id = $3");
    expect(cancellation?.[1]).toEqual([batchId, organizationId, projectId]);
  });

  it("fails closed before retrying an item outside the supplied persisted tuple", async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      expect(sql).toContain("b.organization_id = $2::uuid");
      expect(sql).toContain("b.project_id = $3");
      expect(params).toEqual([leadId, organizationId, projectId]);
      return { rows: [] };
    });
    const runner = vi.fn();
    const result = await retrySingleItem({ query } as unknown as Pool, leadId, {
      runner,
      expectedScope: { organizationId, projectId },
    });
    expect(result).toEqual({ ok: false, status: "not_found", errorMessage: "item_not_found" });
    expect(query).toHaveBeenCalledTimes(1);
    expect(runner).not.toHaveBeenCalled();
  });

  it("fails closed before skipping an item outside the supplied persisted tuple", async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      expect(sql).toContain("item.batch_id = $2::uuid");
      expect(sql).toContain("batch.organization_id = $3::uuid");
      expect(sql).toContain("batch.project_id = $4");
      expect(params).toEqual([leadId, batchId, organizationId, projectId]);
      return { rows: [] };
    });
    const result = await markItemSkipped({ query } as unknown as Pool, leadId, {
      batchId,
      organizationId,
      projectId,
    });
    expect(result).toEqual({ ok: false });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
