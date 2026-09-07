import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  ensureUserBucket: vi.fn(),
  getUserFileDownloadUrl: vi.fn(),
  softDeleteUserFile: vi.fn(),
  uploadUserFile: vi.fn(),
}));

vi.mock("./role-room-user-storage-service.js", () => storage);

import { registerLeadMapFileRoutes } from "./lead-map-file-routes.js";

const leadId = "11111111-1111-4111-8111-111111111111";
const fileId = "22222222-2222-4222-8222-222222222222";
const organizationId = "33333333-3333-4333-8333-333333333333";
const projectId = "dentum-oslo";
const userId = "user-a";

function accessibleProjectRow() {
  return {
    id: projectId,
    organization_id: organizationId,
    name: "Dentum",
    description: null,
    project_type: "b2b_sales",
    industry: "Dental",
    status: "active",
    created_by: userId,
    member_role: "owner",
  };
}

function makeHarness(pool: Pool) {
  const routes = new Map<string, RequestHandler[]>();
  const app = {
    get: (path: string, ...handlers: RequestHandler[]) => routes.set(`GET ${path}`, handlers),
    post: (path: string, ...handlers: RequestHandler[]) => routes.set(`POST ${path}`, handlers),
    delete: (path: string, ...handlers: RequestHandler[]) => routes.set(`DELETE ${path}`, handlers),
  } as unknown as Express;
  registerLeadMapFileRoutes({
    app,
    pool,
    activeSessions: new Map([["session", { userId }]]),
  });

  return async (key: string, params: Record<string, string>, skip = 0) => {
    const handlers = routes.get(key)?.slice(skip);
    if (!handlers) throw new Error(`missing route ${key}`);
    const req = {
      headers: { authorization: "Bearer session" },
      params,
      query: {},
      body: {},
    } as unknown as Request;
    let status = 200;
    let body: unknown;
    const res = {
      status(code: number) { status = code; return this; },
      json(payload: unknown) { body = payload; return this; },
    } as unknown as Response;

    for (const handler of handlers) {
      let advanced = false;
      await handler(req, res, (() => { advanced = true; }) as NextFunction);
      if (!advanced) break;
    }
    return { status, body };
  };
}

describe("Leadgrid lead-file project scope", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hides a persisted lead after project access is revoked", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM crm_customers c")) {
        return { rows: [{ id: leadId, organization_id: organizationId, project_id: projectId }] };
      }
      if (sql.includes("FROM leadgrid_projects p")) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const response = await makeHarness({ query } as unknown as Pool)(
      "GET /api/admin-room/lead-map/leads/:id/files",
      { id: leadId },
    );

    expect(response).toEqual({ status: 404, body: { error: "lead_not_found" } });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("lists only the exact persisted organization/project/lead tuple", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM crm_customers c")) {
        return { rows: [{ id: leadId, organization_id: organizationId, project_id: projectId }] };
      }
      if (sql.includes("FROM leadgrid_projects p")) return { rows: [accessibleProjectRow()] };
      if (sql.includes("FROM leadgrid_lead_files lf")) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const response = await makeHarness({ query } as unknown as Pool)(
      "GET /api/admin-room/lead-map/leads/:id/files",
      { id: leadId },
    );

    expect(response).toEqual({ status: 200, body: { files: [] } });
    const list = query.mock.calls.find(([sql]) => String(sql).includes("FROM leadgrid_lead_files lf"));
    expect(String(list?.[0])).toContain("lf.project_id = $2");
    expect(list?.[1]).toEqual([organizationId, projectId, leadId]);
  });

  it("deletes only a linked file in the exact project tuple", async () => {
    storage.softDeleteUserFile.mockResolvedValue({ ok: true, freedBytes: 42 });
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM crm_customers c")) {
        return { rows: [{ id: leadId, organization_id: organizationId, project_id: projectId }] };
      }
      if (sql.includes("FROM leadgrid_projects p")) return { rows: [accessibleProjectRow()] };
      if (sql.includes("SELECT uploader_user_id")) return { rows: [{ uploader_user_id: "uploader-a" }] };
      if (sql.includes("DELETE FROM leadgrid_lead_files")) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected query: ${sql}`);
    });
    // Skip the permission middleware here; this regression exercises the row
    // scope middleware and mutation handler themselves.
    const response = await makeHarness({ query } as unknown as Pool)(
      "DELETE /api/admin-room/lead-map/leads/:id/files/:fileId",
      { id: leadId, fileId },
      1,
    );

    expect(response).toEqual({ status: 200, body: { ok: true, freedBytes: 42 } });
    expect(storage.softDeleteUserFile).toHaveBeenCalledWith(expect.anything(), {
      userId: "uploader-a",
      fileId,
    });
    const deletion = query.mock.calls.find(([sql]) => String(sql).includes("DELETE FROM leadgrid_lead_files"));
    expect(String(deletion?.[0])).toContain("project_id = $4");
    expect(deletion?.[1]).toEqual([fileId, leadId, organizationId, projectId]);
  });
});
