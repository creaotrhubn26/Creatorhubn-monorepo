import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({
  getLeadgridSession: vi.fn(),
  loadAccessibleLeadgridProject: vi.fn(),
}));
const rbac = vi.hoisted(() => ({
  options: null as null | {
    resolveOrgId?: (
      req: Request,
      pool: Pool,
      userId: string,
    ) => Promise<string | null>;
  },
}));
vi.mock("./lead-map-rbac-helper.js", () => ({
  requireLeadMapPermission: (
    _permission: string,
    options: typeof rbac.options,
  ) => {
    rbac.options = options;
    return vi.fn();
  },
}));
vi.mock("./leadgrid-project-access.js", () => ({ ...access }));

import { registerLeadgridDiscoveryConfigRoutes } from "./leadgrid-discovery-config-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const actorId = "11111111-1111-4111-8111-111111111119";
const profileId = "22222222-2222-4222-8222-222222222222";
const project = {
  id: "project-a",
  organizationId,
  name: "Project A",
  description: null,
  industry: null,
  status: "active",
  createdBy: actorId,
  memberRole: "owner",
};

type CallOptions = {
  params?: Record<string, string>;
  body?: unknown;
};

function makeHarness(pool: Pool) {
  const routes = new Map<string, RequestHandler[]>();
  const app = {
    get: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`GET ${path}`, handlers),
    put: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`PUT ${path}`, handlers),
    delete: (path: string, ...handlers: RequestHandler[]) =>
      routes.set(`DELETE ${path}`, handlers),
  } as unknown as Express;
  registerLeadgridDiscoveryConfigRoutes({
    app,
    pool,
    activeSessions: new Map(),
  });
  return {
    async call(method: string, path: string, options: CallOptions = {}) {
      const handler = routes.get(`${method} ${path}`)?.at(-1);
      if (!handler) throw new Error(`Missing route ${method} ${path}`);
      const req = {
        params: options.params ?? {},
        body: options.body,
        headers: {},
      } as unknown as Request;
      let status = 200;
      let body: unknown;
      const res = {
        status(code: number) {
          status = code;
          return this;
        },
        json(payload: unknown) {
          body = payload;
          return this;
        },
      } as unknown as Response;
      await handler(req, res, vi.fn());
      return { status, body };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  access.getLeadgridSession.mockReturnValue({ userId: actorId });
  access.loadAccessibleLeadgridProject.mockResolvedValue(project);
});

describe("legacy Discovery config compatibility", () => {
  const path = "/api/leadgrid/projects/:projectId/discovery-config";

  it("derives permission scope from the accessible project, not request input", async () => {
    const pool = { query: vi.fn() } as unknown as Pool;
    makeHarness(pool);
    const resolveOrgId = rbac.options?.resolveOrgId;
    expect(resolveOrgId).toBeTypeOf("function");
    const req = {
      params: { projectId: "project-a" },
      query: { organization_id: "99999999-9999-4999-8999-999999999999" },
    } as unknown as Request;
    await expect(resolveOrgId!(req, pool, actorId)).resolves.toBe(
      organizationId,
    );
    expect(access.loadAccessibleLeadgridProject).toHaveBeenCalledWith(
      pool,
      "project-a",
      actorId,
    );
  });

  it("does not query config data for an inaccessible project", async () => {
    access.loadAccessibleLeadgridProject.mockResolvedValue(null);
    const query = vi.fn();
    const response = await makeHarness({ query } as unknown as Pool).call(
      "GET",
      path,
      { params: { projectId: "foreign-project" } },
    );
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "project_not_found",
        message: "Leadgrid-prosjektet finnes ikke.",
        retryable: false,
      },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("dual-reads v2 profile, exposes industry_queries and scopes both reads", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("leadgrid_discovery_profiles")) {
        return {
          rows: [
            {
              id: profileId,
              target_customer_types: ["regnskapsbyrå", "advokat"],
              city_filters: ["Oslo"],
              geography_lat: "59.91",
              geography_lng: "10.75",
              geography_radius_km: 20,
              max_candidates_per_run: 60,
              enrichment_count: 30,
              auto_discover_enabled: true,
              last_run_at: null,
              next_run_at: null,
              version: 4,
            },
          ],
        };
      }
      return {
        rows: [
          {
            project_id: "project-a",
            industry_query: "gammel verdi",
            industry_queries: ["gammel verdi"],
            city_filter: ["Bergen"],
            geography_lat: null,
            geography_lng: null,
            geography_radius_km: 10,
            count_per_run: 10,
            auto_discover_enabled: false,
            last_run_at: null,
            next_run_at: null,
            total_discoveries: 8,
            total_pinned: 2,
          },
        ],
      };
    });
    const response = await makeHarness({ query } as unknown as Pool).call(
      "GET",
      path,
      { params: { projectId: "project-a" } },
    );
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      config: {
        industry_queries: ["regnskapsbyrå", "advokat"],
        count_per_run: 60,
        enrichment_count: 30,
        profile_id: profileId,
        profile_version: 4,
        total_discoveries: 8,
      },
    });
    expect(query.mock.calls[0][0]).toContain("project_id = $1");
    expect(query.mock.calls[0][0]).toContain("organization_id = $2::uuid");
    expect(query.mock.calls[0][1]).toEqual(["project-a", organizationId]);
    expect(query.mock.calls[1][0]).toContain("organization_id = $1::uuid");
    expect(query.mock.calls[1][0]).toContain("project_id = $2");
    expect(query.mock.calls[1][1]).toEqual([organizationId, "project-a"]);
  });

  it("dual-writes legacy and default profile under an advisory lock", async () => {
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT id::text") && sql.includes("FOR UPDATE")) {
        return { rows: [{ id: profileId }] };
      }
      if (sql.includes("RETURNING id::text, version")) {
        return { rows: [{ id: profileId, version: 5 }] };
      }
      return { rows: [] };
    });
    const client = { query: clientQuery, release: vi.fn() };
    const pool = {
      query: vi.fn(),
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const response = await makeHarness(pool).call("PUT", path, {
      params: { projectId: "project-a" },
      body: {
        industry_queries: ["regnskapsbyrå", "advokat"],
        city_filter: ["Oslo"],
        geography_lat: 59.91,
        geography_lng: 10.75,
        geography_radius_km: 50,
        count_per_run: 60,
        enrichment_count: 30,
        auto_discover_enabled: true,
      },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      profile_id: profileId,
      profile_version: 5,
    });
    expect(
      clientQuery.mock.calls.some(([sql]) =>
        sql.includes("pg_advisory_xact_lock"),
      ),
    ).toBe(true);
    const governanceLock = clientQuery.mock.calls.findIndex(
      ([sql, values]) =>
        sql.includes("pg_advisory_xact_lock") &&
        values?.[0] === `leadgrid-discovery-auto-profiles|${organizationId}`,
    );
    const profileRowLock = clientQuery.mock.calls.findIndex(([sql]) =>
      sql.includes("SELECT id::text"),
    );
    expect(governanceLock).toBeGreaterThanOrEqual(0);
    expect(governanceLock).toBeLessThan(profileRowLock);
    const legacy = clientQuery.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO leadgrid_project_discovery_config"),
    );
    expect(legacy?.[0]).toContain("industry_queries");
    expect(legacy?.[0]).toContain("organization_id = EXCLUDED.organization_id");
    expect(legacy?.[1]?.[7]).toBe(50);
    expect(legacy?.[1]?.[9]).toBe(organizationId);
    const profileUpdate = clientQuery.mock.calls.find(
      ([sql]) =>
        sql.includes("UPDATE leadgrid_discovery_profiles") &&
        sql.includes("RETURNING id::text, version"),
    );
    expect(profileUpdate?.[0]).toContain("organization_id = $1::uuid");
    expect(profileUpdate?.[0]).toContain("project_id = $2");
    expect(profileUpdate?.[0]).toContain("id = $3::uuid");
  });

  it("archives only the scoped default profile on delete", async () => {
    const clientQuery = vi.fn(async () => ({ rows: [] }));
    const client = { query: clientQuery, release: vi.fn() };
    const pool = {
      query: vi.fn(),
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const response = await makeHarness(pool).call("DELETE", path, {
      params: { projectId: "project-a" },
    });
    expect(response.status).toBe(200);
    const legacyDelete = clientQuery.mock.calls.find(([sql]) =>
      sql.includes("DELETE FROM leadgrid_project_discovery_config"),
    );
    expect(legacyDelete?.[1]).toEqual(["project-a", organizationId]);
    const archive = clientQuery.mock.calls.find(([sql]) =>
      sql.includes("UPDATE leadgrid_discovery_profiles"),
    );
    expect(archive?.[0]).toContain("organization_id = $1::uuid");
    expect(archive?.[0]).toContain("project_id = $2");
    expect(archive?.[0]).toContain("is_default = TRUE");
  });
});
