import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const accessMocks = vi.hoisted(() => ({
  loadProject: vi.fn(),
}));
const rbacMocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
}));
const planMocks = vi.hoisted(() => ({
  canCreateCustomer: vi.fn(),
  tryClaimAutoOnboard: vi.fn(),
}));

vi.mock("./lead-map-rbac-helper.js", () => ({
  requireLeadMapPermission: rbacMocks.requirePermission,
}));

vi.mock("./leadgrid-project-access.js", () => ({
  getLeadgridSession: (
    req: Request,
    sessions: Map<string, { userId: string }>,
  ) => {
    const auth = req.headers.authorization;
    return auth?.startsWith("Bearer ")
      ? sessions.get(auth.slice(7)) ?? null
      : null;
  },
  loadAccessibleLeadgridProject: accessMocks.loadProject,
}));

vi.mock("./plan-limits-service.js", () => ({
  canCreateCustomer: planMocks.canCreateCustomer,
  tryClaimAutoOnboard: planMocks.tryClaimAutoOnboard,
}));

import { registerCustomerAutoOnboardRoutes } from "./customer-auto-onboard-routes.js";
import { __test } from "./customer-auto-onboard-project-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const foreignOrganizationId = "99999999-9999-4999-8999-999999999999";
const auditId = "22222222-2222-4222-8222-222222222222";
const idempotencyKey = "33333333-3333-4333-8333-333333333333";
const projectId = "dentum-oslo";
const userId = "user-a";

type RegisteredRoute = {
  method: string;
  path: string;
  handlers: RequestHandler[];
};

function setup(pool: Pool) {
  const routes: RegisteredRoute[] = [];
  const register =
    (method: string) =>
    (path: string, ...handlers: RequestHandler[]) =>
      routes.push({ method, path, handlers });
  const app = {
    get: register("GET"),
    post: register("POST"),
  } as unknown as Express;
  registerCustomerAutoOnboardRoutes({
    app,
    pool,
    activeSessions: new Map([["token", { userId }]]),
  });
  return {
    route(method: string, path: string): RequestHandler {
      const match = routes.find(
        (candidate) => candidate.method === method && candidate.path === path,
      );
      const handler = match?.handlers.at(-1);
      if (!handler) throw new Error(`missing route ${method} ${path}`);
      return handler;
    },
  };
}

function request(input: {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  idempotencyKey?: string;
} = {}): Request {
  return {
    headers: { authorization: "Bearer token" },
    body: input.body ?? {},
    query: input.query ?? {},
    params: input.params ?? {},
    get: vi.fn((name: string) =>
      name.toLowerCase() === "idempotency-key"
        ? input.idempotencyKey
        : undefined
    ),
  } as unknown as Request;
}

function response() {
  let status = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return this;
    },
  } as unknown as Response;
  return {
    res,
    get status() { return status; },
    get body() { return body; },
    headers,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  planMocks.canCreateCustomer.mockResolvedValue({
    allowed: true,
    current_plan: "solo_pro",
  });
  planMocks.tryClaimAutoOnboard.mockResolvedValue({
    allowed: true,
    current_plan: "solo_pro",
  });
  rbacMocks.requirePermission.mockImplementation(
    () => (_req: Request, _res: Response, next: NextFunction) => next(),
  );
  accessMocks.loadProject.mockResolvedValue({
    id: projectId,
    organizationId,
    name: "Dentum Oslo",
  });
});

describe("customer auto-onboarding project scope", () => {
  it("claims quota and records the audit marker in one transaction", async () => {
    const calls: string[] = [];
    const client = {
      query: vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
        const sql = String(sqlValue);
        calls.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
        if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
        if (sql.includes("FROM customer_auto_onboards")) {
          expect(sql).toContain("FOR UPDATE");
          expect(params).toEqual([auditId, organizationId, projectId]);
          return {
            rows: [{
              status: "pending",
              error_message: null,
              quota_claimed_at: null,
            }],
          };
        }
        if (sql.includes("SET quota_claimed_at = NOW()")) {
          expect(params).toEqual([auditId, organizationId, projectId]);
          return {
            rows: [{ quota_claimed_at: "2026-09-06T10:00:00.000Z" }],
          };
        }
        throw new Error(`unexpected query: ${sql}`);
      }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;

    const result = await __test.ensureQuotaClaimed(pool, {
      auditId,
      organizationId,
      projectId,
    });

    expect(result).toEqual({
      allowed: true,
      quotaClaimedAt: "2026-09-06T10:00:00.000Z",
    });
    expect(planMocks.canCreateCustomer).toHaveBeenCalledWith(
      client,
      organizationId,
    );
    expect(planMocks.tryClaimAutoOnboard).toHaveBeenCalledWith(
      client,
      organizationId,
    );
    expect(calls.at(0)).toBe("BEGIN");
    expect(calls.at(-1)).toBe("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rolls back both quota usage and its audit marker when claiming fails", async () => {
    planMocks.tryClaimAutoOnboard.mockRejectedValueOnce(
      new Error("usage write failed"),
    );
    const client = {
      query: vi.fn(async (sqlValue: unknown) => {
        const sql = String(sqlValue);
        if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
        if (sql.includes("FROM customer_auto_onboards")) {
          return {
            rows: [{
              status: "pending",
              error_message: null,
              quota_claimed_at: null,
            }],
          };
        }
        throw new Error(`unexpected query: ${sql}`);
      }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
    } as unknown as Pool;

    await expect(__test.ensureQuotaClaimed(pool, {
      auditId,
      organizationId,
      projectId,
    })).rejects.toThrow("usage write failed");

    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining("SET quota_claimed_at = NOW()"),
      expect.anything(),
    );
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("requires an explicit accessible Leadgrid project", async () => {
    const query = vi.fn();
    const harness = setup({ query } as unknown as Pool);
    const missing = response();
    await harness.route(
      "POST",
      "/api/admin-room/lead-map/customers/auto-onboard",
    )(
      request({
        body: {
          website_url: "dentum.no",
          contact_email: "kunde@dentum.no",
          organization_id: foreignOrganizationId,
        },
        idempotencyKey,
      }),
      missing.res,
      vi.fn(),
    );
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ error: "project_id_required" });
    expect(query).not.toHaveBeenCalled();

    accessMocks.loadProject.mockResolvedValueOnce(null);
    const foreign = response();
    await harness.route(
      "POST",
      "/api/admin-room/lead-map/customers/auto-onboard",
    )(
      request({
        body: {
          project_id: "foreign-project",
          organization_id: foreignOrganizationId,
          website_url: "dentum.no",
          contact_email: "kunde@dentum.no",
        },
        idempotencyKey,
      }),
      foreign.res,
      vi.fn(),
    );
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ error: "project_not_found" });
    expect(query).not.toHaveBeenCalled();
  });

  it("replays the same request inside the derived tuple without new side effects", async () => {
    const requestHash = __test.onboardingRequestHash({
      projectId,
      websiteUrl: "https://dentum.no/",
      contactEmail: "kunde@dentum.no",
      contactName: null,
      contactPhone: null,
      presetId: null,
    });
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql.includes("INSERT INTO customer_auto_onboards")) {
        expect(params[0]).toBe(organizationId);
        expect(params[1]).toBe(projectId);
        expect(params).not.toContain(foreignOrganizationId);
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM customer_auto_onboards")) {
        expect(sql).toContain("organization_id = $1::uuid");
        expect(sql).toContain("project_id = $2");
        expect(params).toEqual([organizationId, projectId, idempotencyKey]);
        return {
          rows: [{
            id: auditId,
            status: "completed",
            error_message: null,
            quota_claimed_at: "2026-09-06T10:00:00.000Z",
            request_hash: requestHash,
            invitation_status: "sent",
          }],
          rowCount: 1,
        };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const harness = setup({ query } as unknown as Pool);
    const out = response();
    await harness.route(
      "POST",
      "/api/admin-room/lead-map/customers/auto-onboard",
    )(
      request({
        body: {
          project_id: projectId,
          organization_id: foreignOrganizationId,
          website_url: "dentum.no",
          contact_email: "KUNDE@dentum.no",
        },
        idempotencyKey,
      }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(out.headers.get("Idempotent-Replayed")).toBe("true");
    expect(out.body).toMatchObject({
      audit_id: auditId,
      project_id: projectId,
      status: "completed",
      replayed: true,
    });
    expect(out.body).not.toHaveProperty("client_token");
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("reads status only from the exact project and never selects the portal token", async () => {
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      expect(sql).toContain("organization_id = $2::uuid");
      expect(sql).toContain("project_id = $3");
      expect(sql).toContain("portal_ready");
      expect(sql).not.toContain("client_token");
      expect(params).toEqual([auditId, organizationId, projectId]);
      return {
        rows: [{
          id: auditId,
          status: "completed",
          website_url: "https://dentum.no/",
          contact_email: "kunde@dentum.no",
          project_id: projectId,
          portal_ready: true,
          invitation_status: "sent",
          started_at: "2026-09-06T10:00:00.000Z",
          finished_at: "2026-09-06T10:01:00.000Z",
        }],
      };
    });
    const harness = setup({ query } as unknown as Pool);
    const out = response();
    await harness.route(
      "GET",
      "/api/admin-room/lead-map/customers/auto-onboard/:audit_id",
    )(
      request({
        params: { audit_id: auditId },
        query: {
          project_id: projectId,
          organization_id: foreignOrganizationId,
        },
      }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({
      audit: {
        id: auditId,
        project_id: projectId,
        portal_ready: true,
      },
    });
    expect(out.body).not.toHaveProperty("audit.client_token");
  });
});
