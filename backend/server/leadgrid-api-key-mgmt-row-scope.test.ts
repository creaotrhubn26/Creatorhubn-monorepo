import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { registerLeadgridApiKeyMgmtRoutes } from "./leadgrid-api-key-mgmt-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const visibleProjectId = "dentum-oslo";
const revokedProjectId = "dentum-vest";
const visibleKeyId = "22222222-2222-4222-8222-222222222222";
const revokedKeyId = "33333333-3333-4333-8333-333333333333";
const userId = "user-admin";

function projectRow(projectId: string) {
  return {
    id: projectId,
    organization_id: organizationId,
    name: "Dentum",
    description: null,
    project_type: "b2b_sales",
    industry: "Dental",
    status: "active",
    created_by: userId,
    member_role: "member",
  };
}

function makeHarness(pool: Pool) {
  const routes = new Map<string, RequestHandler[]>();
  const app = {
    get: (path: string, ...handlers: RequestHandler[]) => routes.set(`GET ${path}`, handlers),
    post: (path: string, ...handlers: RequestHandler[]) => routes.set(`POST ${path}`, handlers),
  } as unknown as Express;
  registerLeadgridApiKeyMgmtRoutes({
    app,
    pool,
    activeSessions: new Map([["session", { userId, role: "admin" }]]),
  });

  return async (key: string, input: { params?: Record<string, string>; body?: unknown } = {}) => {
    const handler = routes.get(key)?.at(-1);
    if (!handler) throw new Error(`missing route ${key}`);
    const req = {
      headers: { authorization: "Bearer session" },
      query: { organization_id: organizationId },
      params: input.params ?? {},
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

describe("Leadgrid API-key persisted project scope", () => {
  it("omits keys for projects revoked after key creation", async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM leadgrid_api_keys k")) {
        expect(sql).toContain("k.organization_id::text");
        return {
          rows: [
            {
              id: visibleKeyId,
              organization_id: organizationId,
              project_id: visibleProjectId,
              access_scope: "project",
              name: "Visible",
            },
            {
              id: revokedKeyId,
              organization_id: organizationId,
              project_id: revokedProjectId,
              access_scope: "project",
              name: "Revoked",
            },
          ],
        };
      }
      if (sql.includes("FROM leadgrid_projects p")) {
        return { rows: params?.[0] === visibleProjectId ? [projectRow(visibleProjectId)] : [] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });

    const response = await makeHarness({ query } as unknown as Pool)(
      "GET /api/leadgrid/api-keys",
    );
    expect(response).toEqual({
      status: 200,
      body: { data: [expect.objectContaining({ id: visibleKeyId })] },
    });
  });

  it("hides a key from revoke after its project access is revoked", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_api_keys")) {
        return {
          rows: [{
            id: revokedKeyId,
            organization_id: organizationId,
            project_id: revokedProjectId,
            access_scope: "project",
          }],
        };
      }
      if (sql.includes("FROM leadgrid_projects p")) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });

    const response = await makeHarness({ query } as unknown as Pool)(
      "POST /api/leadgrid/api-keys/:id/revoke",
      { params: { id: revokedKeyId }, body: { reason: "rotate" } },
    );
    expect(response).toEqual({
      status: 404,
      body: { error: "ikke_funnet_eller_revokert" },
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE leadgrid_api_keys"))).toBe(false);
  });

  it("revokes an accessible key with its full persisted tuple", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM leadgrid_api_keys")) {
        return {
          rows: [{
            id: visibleKeyId,
            organization_id: organizationId,
            project_id: visibleProjectId,
            access_scope: "project",
          }],
        };
      }
      if (sql.includes("FROM leadgrid_projects p")) return { rows: [projectRow(visibleProjectId)] };
      if (sql.includes("UPDATE leadgrid_api_keys")) return { rows: [{ id: visibleKeyId }], rowCount: 1 };
      throw new Error(`unexpected query: ${sql}`);
    });

    const response = await makeHarness({ query } as unknown as Pool)(
      "POST /api/leadgrid/api-keys/:id/revoke",
      { params: { id: visibleKeyId }, body: { reason: " rotate " } },
    );
    expect(response).toEqual({ status: 200, body: { ok: true, id: visibleKeyId } });
    const update = query.mock.calls.find(([sql]) => String(sql).includes("UPDATE leadgrid_api_keys"));
    expect(String(update?.[0])).toContain("project_id IS NOT DISTINCT FROM $5");
    expect(update?.[1]).toEqual(["rotate", visibleKeyId, organizationId, "project", visibleProjectId]);
  });
});
