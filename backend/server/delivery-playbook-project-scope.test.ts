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
vi.mock("./client-notification-service.js", () => ({
  notifyClient: vi.fn(),
}));

import { registerDeliveryPlaybookRoutes } from "./delivery-playbook-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const focusId = "22222222-2222-4222-8222-222222222222";
const deliverableId = "33333333-3333-4333-8333-333333333333";
const playbookId = "44444444-4444-4444-8444-444444444444";
const customerId = "55555555-5555-4555-8555-555555555555";
const projectId = "dentum-oslo";
const userId = "user-a";

function setup(pool: Pool) {
  const routes = new Map<string, RequestHandler[]>();
  const register =
    (method: string) =>
    (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`${method} ${path}`, handlers);
  const app = {
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
    delete: register("DELETE"),
  } as unknown as Express;
  registerDeliveryPlaybookRoutes({
    app,
    pool,
    activeSessions: new Map([["token", { userId }]]),
  });
  return {
    route(method: string, path: string): RequestHandler {
      const handler = routes.get(`${method} ${path}`)?.at(-1);
      if (!handler) throw new Error(`missing route ${method} ${path}`);
      return handler;
    },
  };
}

function request(input: {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
} = {}): Request {
  return {
    headers: { authorization: "Bearer token" },
    body: input.body ?? {},
    query: input.query ?? {},
    params: input.params ?? {},
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
  rbacMocks.requirePermission.mockImplementation(
    () => (_req: Request, _res: Response, next: NextFunction) => next(),
  );
  accessMocks.loadProject.mockResolvedValue({
    id: projectId,
    organizationId,
    name: "Dentum Oslo",
  });
});

describe("delivery playbook project scope", () => {
  it("requires a project and treats inaccessible projects as missing", async () => {
    const query = vi.fn();
    const harness = setup({ query } as unknown as Pool);
    const missing = response();
    await harness.route(
      "GET",
      "/api/admin-room/lead-map/focus-requests",
    )(request(), missing.res, vi.fn());
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ error: "project_id_required" });
    expect(query).not.toHaveBeenCalled();

    accessMocks.loadProject.mockResolvedValueOnce(null);
    const foreign = response();
    await harness.route(
      "GET",
      "/api/admin-room/lead-map/focus-requests",
    )(
      request({ query: { project_id: "foreign-project" } }),
      foreign.res,
      vi.fn(),
    );
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ error: "project_not_found" });
  });

  it("lists only the selected project and expands the open filter safely", async () => {
    const query = vi.fn(async (sqlValue: unknown, params: unknown[]) => {
      const sql = String(sqlValue);
      expect(sql).toContain("cfr.organization_id = $1::uuid");
      expect(sql).toContain("cfr.project_id = $2");
      expect(sql).toContain("cfr.status IN ('pending', 'acknowledged')");
      expect(sql).toContain("customer.organization_id = cfr.organization_id");
      expect(sql).toContain("candidate.project_id = cfr.project_id");
      expect(params).toEqual([organizationId, projectId, "open"]);
      return { rows: [] };
    });
    const harness = setup({ query } as unknown as Pool);
    const out = response();
    await harness.route(
      "GET",
      "/api/admin-room/lead-map/focus-requests",
    )(
      request({ query: { project_id: projectId, status: "open" } }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      project_id: projectId,
      focus_requests: [],
    });
  });

  it("replays an existing delivery atomically instead of creating a duplicate", async () => {
    const clientQuery = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (sql.includes("pg_advisory_xact_lock")) {
        expect(String(params[0])).toContain(projectId);
        expect(String(params[0])).toContain(focusId);
        return { rows: [] };
      }
      if (sql.includes("FROM client_focus_requests focus")) {
        expect(sql).toContain("focus.organization_id = $2::uuid");
        expect(sql).toContain("focus.project_id = $3");
        expect(params).toEqual([focusId, organizationId, projectId]);
        return {
          rows: [{
            id: focusId,
            organization_id: organizationId,
            project_id: projectId,
            customer_id: customerId,
            need_type: "needs_seo_local",
            status: "pending",
            client_note: null,
          }],
        };
      }
      if (sql.includes("FROM project_deliverables delivery")) {
        expect(sql).toContain("delivery.organization_id = $1::uuid");
        expect(sql).toContain("delivery.project_id = $2");
        expect(params).toEqual([organizationId, projectId, focusId]);
        return {
          rows: [{
            id: deliverableId,
            playbook_id: playbookId,
            steps_count: 4,
            requirements_count: 1,
            title: "Lokal SEO",
          }],
        };
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const release = vi.fn();
    const pool = {
      query: vi.fn(),
      connect: vi.fn(async () => ({ query: clientQuery, release })),
    } as unknown as Pool;
    const harness = setup(pool);
    const out = response();
    await harness.route(
      "POST",
      "/api/admin-room/lead-map/focus-requests/:id/start-delivery",
    )(
      request({
        params: { id: focusId },
        body: { project_id: projectId },
      }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(out.headers.get("Idempotent-Replayed")).toBe("true");
    expect(out.body).toMatchObject({
      deliverable_id: deliverableId,
      project_id: projectId,
      replayed: true,
    });
    expect(
      clientQuery.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO project_deliverables")
      ),
    ).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });

  it("hides a foreign or unknown deliverable behind scoped 404", async () => {
    const query = vi.fn(async (sqlValue: unknown, params: unknown[]) => {
      const sql = String(sqlValue);
      expect(sql).toContain("delivery.organization_id = $2::uuid");
      expect(sql).toContain("delivery.project_id = $3");
      expect(params).toEqual([deliverableId, organizationId, projectId]);
      return { rows: [] };
    });
    const harness = setup({ query } as unknown as Pool);
    const out = response();
    await harness.route(
      "GET",
      "/api/admin-room/lead-map/deliverables/:id",
    )(
      request({
        params: { id: deliverableId },
        query: { project_id: projectId },
      }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: "not_found" });
  });
});
