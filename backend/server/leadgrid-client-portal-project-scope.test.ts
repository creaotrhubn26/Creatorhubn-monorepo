import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notificationMocks = vi.hoisted(() => ({
  notifyClient: vi.fn(),
}));
vi.mock("./client-notification-service.js", () => ({
  notifyClient: notificationMocks.notifyClient,
}));

import { registerClientPortalRoutes } from "./leadgrid-client-portal-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const tokenId = "22222222-2222-4222-8222-222222222222";
const customerId = "33333333-3333-4333-8333-333333333333";
const projectId = "dentum-oslo";
const portalToken = "public-token";
const needType = "needs_seo_local";

function setup(pool: Pool) {
  const routes = new Map<string, RequestHandler[]>();
  const app = {
    get: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`GET ${path}`, handlers),
    post: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`POST ${path}`, handlers),
  } as unknown as Express;
  registerClientPortalRoutes({ app, pool });
  return {
    route(method: string, path: string): RequestHandler {
      const handler = routes.get(`${method} ${path}`)?.at(-1);
      if (!handler) throw new Error(`missing route ${method} ${path}`);
      return handler;
    },
  };
}

function request(body: Record<string, unknown>): Request {
  return {
    params: { token: portalToken },
    body,
    query: {},
    headers: {},
  } as unknown as Request;
}

function response() {
  let status = 200;
  let body: unknown;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;
  return {
    res,
    get status() { return status; },
    get body() { return body; },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  notificationMocks.notifyClient.mockResolvedValue({
    attempted: 1,
    sent: 1,
    channels: ["email"],
  });
});

describe("Leadgrid client portal project scope", () => {
  it("accepts the web single-need contract and makes a retry side-effect free", async () => {
    let focusExists = false;
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM client_portal_tokens portal")) {
        expect(sql).toContain("project.id = portal.project_id");
        expect(sql).toContain("customer.organization_id = portal.organization_id");
        return {
          rows: [{
            id: tokenId,
            organization_id: organizationId,
            project_id: projectId,
            customer_id: customerId,
            invited_email: "kunde@dentum.no",
            invited_name: "Kunde",
            invited_role: "client_viewer",
            accepted_at: "2026-09-06T10:00:00.000Z",
            expires_at: "2099-09-06T10:00:00.000Z",
            revoked_at: null,
            first_opened_at: "2026-09-06T10:00:00.000Z",
          }],
        };
      }
      if (sql.includes("FROM crm_customer_needs")) {
        expect(params).toEqual([
          customerId,
          organizationId,
          projectId,
          [needType],
        ]);
        return { rows: [{ need_type: needType }] };
      }
      if (sql.includes("FROM crm_customers")) {
        expect(params).toEqual([customerId, organizationId, projectId]);
        return { rows: [{ name: "Dentum" }] };
      }
      if (sql.includes("INSERT INTO notification_events")) {
        expect(params[0]).toBe(organizationId);
        expect(params[1]).toBe(customerId);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`unexpected pool query: ${sql}`);
    });
    const clientQuery = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.includes("pg_advisory_xact_lock")) {
        expect(String(params[0])).toContain(projectId);
        expect(String(params[0])).toContain(needType);
        return { rows: [] };
      }
      if (sql.includes("FROM client_focus_requests")) {
        expect(sql).toContain("organization_id = $1::uuid");
        expect(sql).toContain("project_id = $2");
        return { rows: focusExists ? [{ status: "pending" }] : [] };
      }
      if (sql.includes("INSERT INTO client_focus_requests")) {
        expect(sql).toContain(
          "organization_id, project_id, customer_id, need_type",
        );
        focusExists = true;
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`unexpected client query: ${sql}`);
    });
    const release = vi.fn();
    const pool = {
      query,
      connect: vi.fn(async () => ({ query: clientQuery, release })),
    } as unknown as Pool;
    const route = setup(pool).route(
      "POST",
      "/api/leadgrid-client/:token/focus",
    );

    const first = response();
    await route(
      request({ need_type: needType, requested: true }),
      first.res,
      vi.fn(),
    );
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      requested: true,
      changed: true,
      changed_count: 1,
      replayed: false,
    });
    expect(first.body).not.toHaveProperty("focus_request_ids");

    const replay = response();
    await route(
      request({ need_type: needType, requested: true }),
      replay.res,
      vi.fn(),
    );
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({
      requested: true,
      changed: false,
      changed_count: 0,
      replayed: true,
    });
    expect(notificationMocks.notifyClient).toHaveBeenCalledTimes(1);
    expect(notificationMocks.notifyClient).toHaveBeenCalledWith(
      pool,
      expect.objectContaining({
        customerId,
        organizationId,
        projectId,
      }),
    );
    expect(release).toHaveBeenCalledTimes(2);
  });

  it("rejects a need that is not present in the token's exact project", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM client_portal_tokens portal")) {
        return {
          rows: [{
            id: tokenId,
            organization_id: organizationId,
            project_id: projectId,
            customer_id: customerId,
            invited_email: "kunde@dentum.no",
            invited_name: null,
            invited_role: "client_viewer",
            accepted_at: "2026-09-06T10:00:00.000Z",
            expires_at: "2099-09-06T10:00:00.000Z",
            revoked_at: null,
            first_opened_at: null,
          }],
        };
      }
      if (sql.includes("FROM crm_customer_needs")) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });
    const connect = vi.fn();
    const route = setup({ query, connect } as unknown as Pool).route(
      "POST",
      "/api/leadgrid-client/:token/focus",
    );
    const out = response();
    await route(
      request({ need_type: "needs_foreign", requested: true }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "invalid_need" });
    expect(connect).not.toHaveBeenCalled();
    expect(notificationMocks.notifyClient).not.toHaveBeenCalled();
  });
});
