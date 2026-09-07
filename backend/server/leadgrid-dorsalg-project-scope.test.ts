import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const projectAccess = vi.hoisted(() => ({ load: vi.fn() }));
const entitlement = vi.hoisted(() => ({ scoped: vi.fn() }));
const permissions = vi.hoisted(() => ({ resolve: vi.fn() }));
const email = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: projectAccess.load,
}));
vi.mock("./leadgrid-entitlement-guard.js", () => ({
  assertAnyEntitledForOrganization: entitlement.scoped,
}));
vi.mock("./lead-map-permission-routes.js", () => ({
  resolveEffectivePermissions: permissions.resolve,
}));
vi.mock("./casting-reminder-sender.js", () => ({ sendEmail: email.send }));

import { registerLeadgridDorsalgRoutes } from "./leadgrid-dorsalg-routes.js";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "dorsalg-project";
const OTHER_PROJECT_ID = "another-project";
const USER_ID = "seller-a";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const SALE_ID = "44444444-4444-4444-8444-444444444444";

type Route = { method: string; path: string; handler: RequestHandler };
type DbResult = { rows: Array<Record<string, unknown>>; rowCount: number };
const emptyResult = (): DbResult => ({ rows: [], rowCount: 0 });

function harness(input: {
  query?: ReturnType<typeof vi.fn>;
  clientQuery?: ReturnType<typeof vi.fn>;
} = {}) {
  const routes: Route[] = [];
  const register = (method: string) => (
    path: string,
    ...handlers: RequestHandler[]
  ) => routes.push({ method, path, handler: handlers.at(-1)! });
  const query = input.query ?? vi.fn(async () => emptyResult());
  const clientQuery = input.clientQuery ?? vi.fn(async () => emptyResult());
  const client = {
    query: clientQuery,
    release: vi.fn(),
  } as unknown as PoolClient;
  const pool = {
    query,
    connect: vi.fn(async () => client),
  } as unknown as Pool;
  const requireUserSession = vi.fn(() => ({ userId: USER_ID }));
  const app = {
    use: vi.fn(),
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
    put: register("PUT"),
    delete: register("DELETE"),
  } as unknown as Express;

  registerLeadgridDorsalgRoutes({ app, pool, requireUserSession });

  return {
    pool,
    query,
    clientQuery,
    requireUserSession,
    request: async (
      method: string,
      path: string,
      options: {
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
        params?: Record<string, string>;
        headers?: Record<string, string>;
      } = {},
    ) => {
      const route = routes.find((candidate) => (
        candidate.method === method && candidate.path === path
      ));
      if (!route) throw new Error(`Missing route ${method} ${path}`);
      const req = {
        query: options.query ?? {},
        body: options.body ?? {},
        params: options.params ?? {},
        headers: options.headers ?? {},
      } as unknown as Request;
      let status = 200;
      let responseBody: unknown;
      const res = {
        status(value: number) { status = value; return this; },
        json(value: unknown) { responseBody = value; return this; },
        send(value: unknown) { responseBody = value; return this; },
      } as unknown as Response;
      await route.handler(req, res, vi.fn());
      return { status, body: responseBody };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  projectAccess.load.mockResolvedValue({
    id: PROJECT_ID,
    organizationId: ORG_ID,
    name: "Dørsalg",
    description: null,
    projectType: "crm",
    industry: null,
    status: "active",
    createdBy: USER_ID,
    memberRole: "owner",
  });
  entitlement.scoped.mockResolvedValue(true);
  permissions.resolve.mockResolvedValue({
    role: "owner",
    permissions: new Set<string>(),
  });
  email.send.mockResolvedValue(undefined);
});

describe("Leadgrid Dørsalg project scope", () => {
  it("fails closed before project lookup when projectId is absent", async () => {
    const h = harness();
    const result = await h.request("GET", "/api/leadgrid/dorsalg/status");

    expect(result).toEqual({ status: 400, body: { error: "project_id_required" } });
    expect(projectAccess.load).not.toHaveBeenCalled();
    expect(h.query).not.toHaveBeenCalled();
  });

  it("rejects conflicting project and organization claims", async () => {
    const h = harness();
    const conflictingProject = await h.request(
      "GET",
      "/api/leadgrid/dorsalg/status",
      { query: { projectId: PROJECT_ID, project_id: OTHER_PROJECT_ID } },
    );
    expect(conflictingProject).toEqual({
      status: 409,
      body: { error: "project_scope_conflict" },
    });
    expect(projectAccess.load).not.toHaveBeenCalled();

    const staleOrganization = await h.request(
      "GET",
      "/api/leadgrid/dorsalg/status",
      { query: { projectId: PROJECT_ID, organizationId: OTHER_ORG_ID } },
    );
    expect(staleOrganization).toEqual({
      status: 409,
      body: { error: "organization_project_mismatch" },
    });
    expect(projectAccess.load).toHaveBeenCalledWith(h.pool, PROJECT_ID, USER_ID);
    expect(h.query).not.toHaveBeenCalled();
  });

  it("binds status reads to the authoritative organization and project", async () => {
    const query = vi.fn(async (sqlValue: unknown, params?: unknown[]) => {
      const sql = String(sqlValue);
      if (sql.includes("SELECT adresse_id, status")) {
        expect(sql).toContain("WHERE org_id = $1 AND project_id = $2");
        expect(params).toEqual([ORG_ID, PROJECT_ID]);
        return {
          rows: [{ adresse_id: "gate-1", status: "vunnet", lat: 59.9, lon: 10.7 }],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const h = harness({ query });
    const result = await h.request("GET", "/api/leadgrid/dorsalg/status", {
      query: { projectId: PROJECT_ID },
    });

    expect(result).toEqual({
      status: 200,
      body: {
        projectId: PROJECT_ID,
        statuser: [{ adresseId: "gate-1", status: "vunnet", lat: 59.9, lon: 10.7 }],
      },
    });
    expect(entitlement.scoped).toHaveBeenCalledWith(
      h.pool, ORG_ID, ["dorsalgModus"], expect.anything(),
    );
  });

  it("requires an idempotency key before an authenticated write", async () => {
    const h = harness();
    const result = await h.request("POST", "/api/leadgrid/dorsalg/status", {
      body: { projectId: PROJECT_ID, adresseId: "gate-1", status: "vunnet" },
    });

    expect(result).toEqual({
      status: 400,
      body: { error: "idempotency_key_required" },
    });
    expect(projectAccess.load).not.toHaveBeenCalled();
    expect(h.query).not.toHaveBeenCalled();
  });

  it("writes status, product access and Quality linkage in one exact scope", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM leadgrid_dorsalg_products")) {
        return { rows: [{ id: PRODUCT_ID, navn: "Fadder" }], rowCount: 1 };
      }
      if (sql.includes("FROM leadgrid_dorsalg_product_access")) return emptyResult();
      if (sql.includes("INSERT INTO leadgrid_dorsalg_status")) return emptyResult();
      if (sql.includes("INSERT INTO leadgrid_sales_verifications")) return emptyResult();
      throw new Error(`Unexpected query: ${sql}`);
    });
    const h = harness({ query });
    const result = await h.request("POST", "/api/leadgrid/dorsalg/status", {
      headers: { "idempotency-key": "status-operation-1" },
      body: {
        projectId: PROJECT_ID,
        adresseId: "gate-1",
        adressetekst: "Testveien 1",
        postnummer: "0001",
        poststed: "Oslo",
        lat: 59.9,
        lon: 10.7,
        status: "vunnet",
        productId: PRODUCT_ID,
      },
    });

    expect(result).toEqual({ status: 200, body: { ok: true } });
    const calls = query.mock.calls.map(([sql, params]) => [String(sql), params] as const);
    const product = calls.find(([sql]) => sql.includes("FROM leadgrid_dorsalg_products"));
    expect(product?.[0]).toContain("org_id = $2");
    expect(product?.[0]).toContain("project_id = $3");
    expect(product?.[1]).toEqual([PRODUCT_ID, ORG_ID, PROJECT_ID]);
    const access = calls.find(([sql]) => sql.includes("FROM leadgrid_dorsalg_product_access"));
    expect(access?.[1]).toEqual([ORG_ID, PROJECT_ID, USER_ID]);
    const status = calls.find(([sql]) => sql.includes("INSERT INTO leadgrid_dorsalg_status"));
    expect(status?.[0]).toContain("(org_id, project_id, adresse_id");
    expect((status?.[1] as unknown[])?.slice(0, 3)).toEqual([
      ORG_ID, PROJECT_ID, "gate-1",
    ]);
    const quality = calls.find(([sql]) => sql.includes("INSERT INTO leadgrid_sales_verifications"));
    expect(quality?.[0]).toContain("organization_id, project_id, customer_id");
    expect(quality?.[0]).toContain("ON CONFLICT (organization_id, project_id, customer_id)");
    expect((quality?.[1] as unknown[])?.slice(0, 3)).toEqual([
      ORG_ID, PROJECT_ID, "dorsalg:gate-1",
    ]);
  });

  it("replays the same sale idempotently inside its project", async () => {
    const clientQuery = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("INSERT INTO leadgrid_dorsalg_sales")) return emptyResult();
      if (sql.includes("SELECT id FROM leadgrid_dorsalg_sales")) {
        return { rows: [{ id: SALE_ID }], rowCount: 1 };
      }
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql.trim())) return emptyResult();
      throw new Error(`Unexpected client query: ${sql}`);
    });
    const h = harness({ clientQuery });
    const result = await h.request("POST", "/api/leadgrid/dorsalg/sales", {
      headers: { "idempotency-key": "sale-operation-1" },
      body: {
        projectId: PROJECT_ID,
        adresseId: "gate-1",
        adressetekst: "Testveien 1",
        kundeNavn: "Kari Kunde",
      },
    });

    expect(result).toEqual({ status: 200, body: { ok: true, id: SALE_ID } });
    const calls = clientQuery.mock.calls.map(([sql, params]) => [String(sql), params] as const);
    const insert = calls.find(([sql]) => sql.includes("INSERT INTO leadgrid_dorsalg_sales"));
    expect(insert?.[0]).toContain("(org_id, project_id, adresse_id");
    expect(insert?.[0]).toContain("ON CONFLICT (org_id, project_id, idempotency_key)");
    expect((insert?.[1] as unknown[])?.slice(0, 3)).toEqual([
      ORG_ID, PROJECT_ID, "gate-1",
    ]);
    expect((insert?.[1] as unknown[])?.at(-1)).toBe("sale-operation-1");
    const replay = calls.find(([sql]) => sql.includes("SELECT id FROM leadgrid_dorsalg_sales"));
    expect(replay?.[0]).toContain("org_id = $1 AND project_id = $2 AND idempotency_key = $3");
    expect((replay?.[1] as unknown[])?.slice(0, 3)).toEqual([
      ORG_ID, PROJECT_ID, "sale-operation-1",
    ]);
    expect(h.query).not.toHaveBeenCalled();
  });

  it("rejects reuse of a sale key with a different payload", async () => {
    const clientQuery = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("INSERT INTO leadgrid_dorsalg_sales")) return emptyResult();
      if (sql.includes("SELECT id FROM leadgrid_dorsalg_sales")) return emptyResult();
      if (["BEGIN", "ROLLBACK"].includes(sql.trim())) return emptyResult();
      throw new Error(`Unexpected client query: ${sql}`);
    });
    const h = harness({ clientQuery });
    const result = await h.request("POST", "/api/leadgrid/dorsalg/sales", {
      headers: { "idempotency-key": "sale-operation-1" },
      body: {
        projectId: PROJECT_ID,
        adresseId: "changed-gate",
        kundeNavn: "Annen Kunde",
      },
    });

    expect(result).toEqual({
      status: 409,
      body: { error: "idempotency_key_reused" },
    });
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).trim() === "ROLLBACK")).toBe(true);
  });

  it("deletes status and pending Quality linkage only in the selected project", async () => {
    const query = vi.fn(async () => emptyResult());
    const h = harness({ query });
    const result = await h.request("DELETE", "/api/leadgrid/dorsalg/status/:adresseId", {
      params: { adresseId: "gate-1" },
      query: { projectId: PROJECT_ID },
      headers: { "idempotency-key": "delete-operation-1" },
    });

    expect(result).toEqual({ status: 200, body: { ok: true } });
    const calls = query.mock.calls.map(([sql, params]) => [String(sql), params] as const);
    const quality = calls.find(([sql]) => sql.includes("DELETE FROM leadgrid_sales_verifications"));
    expect(quality?.[0]).toContain("organization_id = $1");
    expect(quality?.[0]).toContain("project_id = $2");
    expect(quality?.[1]).toEqual([ORG_ID, PROJECT_ID, "dorsalg:gate-1"]);
    const status = calls.find(([sql]) => sql.includes("DELETE FROM leadgrid_dorsalg_status"));
    expect(status?.[0]).toContain("org_id = $1 AND project_id = $2 AND adresse_id = $3");
    expect(status?.[1]).toEqual([ORG_ID, PROJECT_ID, "gate-1"]);
  });

  it("keeps the public confirmation token opaque and updates one exact sale", async () => {
    const query = vi.fn(async () => ({ rows: [{ id: SALE_ID }], rowCount: 1 }));
    const h = harness({ query });
    const result = await h.request("GET", "/api/leadgrid/dorsalg/confirm/:token", {
      params: { token: "abcdefghijklmnopqrstuvwxyz123456" },
    });

    expect(result.status).toBe(200);
    expect(String(result.body)).not.toContain(ORG_ID);
    expect(String(result.body)).not.toContain(PROJECT_ID);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("WHERE confirm_token = $1");
    expect(String(sql)).toContain("sale.id = target.id");
    expect(String(sql)).toContain("sale.org_id = target.org_id");
    expect(String(sql)).toContain("sale.project_id IS NOT DISTINCT FROM target.project_id");
    expect(params).toEqual(["abcdefghijklmnopqrstuvwxyz123456"]);
    expect(h.requireUserSession).not.toHaveBeenCalled();
  });
});
