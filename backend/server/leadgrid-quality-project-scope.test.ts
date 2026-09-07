import { readFileSync } from "node:fs";
import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const projectAccess = vi.hoisted(() => ({ load: vi.fn() }));
const entitlement = vi.hoisted(() => ({ scoped: vi.fn(async () => true) }));
const permissions = vi.hoisted(() => ({
  resolve: vi.fn(async () => ({ role: "admin", permissions: new Set<string>() })),
}));

vi.mock("./leadgrid-project-access.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./leadgrid-project-access.js")>();
  return { ...actual, loadAccessibleLeadgridProject: projectAccess.load };
});
vi.mock("./leadgrid-entitlement-guard.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./leadgrid-entitlement-guard.js")>();
  return { ...actual, assertAnyEntitledForOrganization: entitlement.scoped };
});
vi.mock("./lead-map-permission-routes.js", () => ({
  resolveEffectivePermissions: permissions.resolve,
}));

import { registerLeadgridQualityRoutes } from "./leadgrid-quality-routes.js";

type Route = { method: string; path: string; handler: RequestHandler };

function harness(input?: {
  query?: ReturnType<typeof vi.fn>;
  clientQuery?: ReturnType<typeof vi.fn>;
}) {
  const routes: Route[] = [];
  const register = (method: string) => (path: string, handler: RequestHandler) => {
    routes.push({ method, path, handler });
  };
  const query = input?.query ?? vi.fn(async (sql: unknown) => {
    if (String(sql).includes("COALESCE(up.display_name")) {
      return { rows: [{ name: "Kari Kvalitet" }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  const clientQuery = input?.clientQuery ?? vi.fn(async () => ({ rows: [], rowCount: 0 }));
  const client = { query: clientQuery, release: vi.fn() } as unknown as PoolClient;
  const app = {
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
  } as unknown as Express;
  registerLeadgridQualityRoutes({
    app,
    pool: { query, connect: vi.fn(async () => client) } as unknown as Pool,
    requireUserSession: vi.fn(() => ({ userId: "quality-user" })),
  });

  return {
    query,
    clientQuery,
    request: async (
      method: string,
      path: string,
      options: {
        query?: Record<string, unknown>;
        body?: Record<string, unknown>;
        params?: Record<string, string>;
      } = {},
    ) => {
      const route = routes.find((candidate) => candidate.method === method && candidate.path === path);
      if (!route) throw new Error(`missing route ${method} ${path}`);
      const req = {
        query: options.query ?? {},
        body: options.body ?? {},
        params: options.params ?? {},
        headers: {},
      } as unknown as Request;
      let status = 200;
      let body: unknown;
      const res = {
        status(value: number) { status = value; return this; },
        json(value: unknown) { body = value; return this; },
      } as unknown as Response;
      await route.handler(req, res, vi.fn());
      return { status, body };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  projectAccess.load.mockResolvedValue({
    id: "dentum-oslo",
    organizationId: "11111111-1111-4111-8111-111111111111",
    name: "Dentum Oslo",
    description: null,
    industry: "86.230",
    status: "active",
    createdBy: "quality-user",
    memberRole: "owner",
  });
});

describe("Leadgrid quality project dataflow", () => {
  it("fails closed before any data lookup without projectId", async () => {
    const h = harness();
    const result = await h.request("GET", "/api/leadgrid/quality/queue");
    expect(result).toEqual({ status: 400, body: { error: "project_id_required" } });
    expect(projectAccess.load).not.toHaveBeenCalled();
    expect(h.query).not.toHaveBeenCalled();
  });

  it("backfills and lists won customers only from the selected project", async () => {
    const h = harness();
    const result = await h.request("GET", "/api/leadgrid/quality/queue", {
      query: { projectId: "dentum-oslo" },
    });
    expect(result.status).toBe(200);
    const calls = h.query.mock.calls.map(([sql, params]) => [String(sql), params] as const);
    const backfill = calls.find(([sql]) => sql.includes("INSERT INTO leadgrid_sales_verifications"));
    expect(backfill?.[0]).toContain("c.organization_id::text = $1");
    expect(backfill?.[0]).toContain("c.project_id = $2");
    expect(backfill?.[0]).toContain("ON CONFLICT (organization_id, project_id, customer_id)");
    expect(backfill?.[1]).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "dentum-oslo",
    ]);
    const list = calls.find(([sql]) => sql.includes("SELECT * FROM leadgrid_sales_verifications"));
    expect(list?.[0]).toContain("organization_id = $1 AND project_id = $2");
  });

  it("rejects a stale organization claim derived outside the selected project", async () => {
    const h = harness();
    const result = await h.request("POST", "/api/leadgrid/quality/templates", {
      body: {
        projectId: "dentum-oslo",
        organizationId: "22222222-2222-4222-8222-222222222222",
        name: "Feil scope",
      },
    });
    expect(result).toEqual({
      status: 409,
      body: { error: "organization_project_mismatch" },
    });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("commits verdict and Leadbook flag atomically inside one project", async () => {
    const clientQuery = vi.fn(async (sql: unknown) => {
      const text = String(sql);
      if (text.includes("SELECT 1 FROM leadgrid_verification_templates")) {
        return { rows: [{ ok: 1 }], rowCount: 1 };
      }
      if (text.includes("UPDATE leadgrid_sales_verifications")) {
        return {
          rows: [{
            customer_name: "Dentumklinikk",
            seller_user_id: "seller-a",
            seller_name: "Selger A",
            deal_amount: "10000",
            won_at: new Date("2026-09-01T09:00:00Z"),
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const h = harness({ clientQuery });
    const result = await h.request("POST", "/api/leadgrid/quality/verifications/:id/verdict", {
      params: { id: "33333333-3333-4333-8333-333333333333" },
      body: {
        projectId: "dentum-oslo",
        status: "needs_followup",
        answers: [],
        templateId: "44444444-4444-4444-8444-444444444444",
        flagAsExample: true,
      },
    });
    expect(result).toEqual({ status: 200, body: { ok: true } });
    const calls = clientQuery.mock.calls.map(([sql, params]) => [String(sql), params] as const);
    const verdict = calls.find(([sql]) => sql.includes("UPDATE leadgrid_sales_verifications"));
    expect(verdict?.[0]).toContain("organization_id = $2 AND project_id = $3");
    const example = calls.find(([sql]) => sql.includes("INSERT INTO leadbook_examples"));
    expect(example?.[0]).toContain("organization_id, project_id");
    expect(example?.[0]).toContain("ON CONFLICT (organization_id, project_id, source_verification_id)");
    expect(calls.map(([sql]) => sql.trim())).toContain("COMMIT");
  });

  it("keeps schema ownership in migration 0550", () => {
    const route = readFileSync(new URL("./leadgrid-quality-routes.ts", import.meta.url), "utf8");
    const migration = readFileSync(
      new URL("../migrations/0550_leadgrid_quality_project_scope.sql", import.meta.url),
      "utf8",
    );
    expect(route).not.toMatch(/CREATE TABLE|ALTER TABLE|CREATE INDEX/i);
    for (const fragment of [
      "uq_lg_sverif_project_customer",
      "enforce_leadgrid_quality_project_scope",
      "IF NEW.project_id IS NULL THEN",
      "uq_lb_examples_project_source_verif",
    ]) expect(migration).toContain(fragment);
    expect(migration).not.toContain("leadgrid_verification_templates_project_required_check");
    expect(migration).not.toContain("leadgrid_sales_verifications_project_required_check");
    expect(migration).not.toContain("DROP INDEX IF EXISTS uq_lg_sverif_org_customer");
    expect(migration).not.toContain("DROP INDEX IF EXISTS uq_lb_examples_source_verif");
  });
});
