import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  previewDiscovery: vi.fn(),
  createDiscoveryRun: vi.fn(),
  listDiscoveryRuns: vi.fn(),
  confirmDiscoveryRun: vi.fn(),
  cancelDiscoveryRun: vi.fn(),
  getDiscoveryRun: vi.fn(),
  listDiscoveryCandidates: vi.fn(),
  decideDiscoveryCandidate: vi.fn(),
  appendDiscoveryFeedback: vi.fn(),
}));
const access = vi.hoisted(() => ({
  getLeadgridSession: vi.fn(),
  loadAccessibleLeadgridProject: vi.fn(),
}));
const permissionResolver = vi.hoisted(() => ({
  resolveEffectivePermissions: vi.fn(),
}));

vi.mock("./leadgrid-project-access.js", () => ({ ...access }));
vi.mock("./lead-map-permission-routes.js", () => ({ ...permissionResolver }));
vi.mock("./leadgrid-discovery-service.js", () => ({
  ...service,
  DiscoveryServiceError: class DiscoveryServiceError extends Error {
    code: string;
    status: number;
    retryable: boolean;
    field?: string;
    constructor(code: string, status = 400, field?: string) {
      super(code);
      this.code = code;
      this.status = status;
      this.retryable = false;
      this.field = field;
    }
  },
}));

import { registerLeadgridDiscoveryRoutes } from "./leadgrid-discovery-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";
const candidateId = "33333333-3333-4333-8333-333333333333";
const profileId = "44444444-4444-4444-8444-444444444444";
const project = {
  id: "project-a",
  organizationId,
  name: "Project A",
  description: null,
  industry: null,
  status: "active",
  createdBy: "user-a",
  memberRole: "owner",
};

type CallOptions = {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
};

function makeHarness(pool: Pool) {
  const routes = new Map<string, RequestHandler[]>();
  const app = {
    get: (path: string, ...handlers: RequestHandler[]) => {
      routes.set(`GET ${path}`, handlers);
    },
    post: (path: string, ...handlers: RequestHandler[]) => {
      routes.set(`POST ${path}`, handlers);
    },
    patch: (path: string, ...handlers: RequestHandler[]) => {
      routes.set(`PATCH ${path}`, handlers);
    },
    delete: (path: string, ...handlers: RequestHandler[]) => {
      routes.set(`DELETE ${path}`, handlers);
    },
  } as unknown as Express;
  registerLeadgridDiscoveryRoutes({ app, pool, activeSessions: new Map() });

  return {
    routes,
    async call(method: string, path: string, options: CallOptions = {}) {
      const handler = routes.get(`${method} ${path}`)?.at(-1);
      if (!handler) throw new Error(`Missing route ${method} ${path}`);
      const headers = Object.fromEntries(
        Object.entries(options.headers ?? {}).map(([key, value]) => [
          key.toLowerCase(),
          value,
        ]),
      );
      const req = {
        params: options.params ?? {},
        query: options.query ?? {},
        body: options.body,
        headers,
        get(name: string) {
          return headers[name.toLowerCase()];
        },
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

function brief() {
  return {
    industry_queries: ["regnskapsbyrå"],
    exclusion_terms: [],
    city: "Oslo",
    target_count: 20,
    enrichment_count: 10,
    minimum_fit_score: 50,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  access.getLeadgridSession.mockReturnValue({ userId: "user-a" });
  access.loadAccessibleLeadgridProject.mockResolvedValue(project);
  permissionResolver.resolveEffectivePermissions.mockResolvedValue({
    role: "member",
    permissions: new Set(["leads.create"]),
  });
});

describe("Leadgrid Discovery HTTP contract", () => {
  const base = "/api/leadgrid/projects/:projectId/discovery";

  it("registers the canonical Leadgrid route family", () => {
    const { routes } = makeHarness({ query: vi.fn() } as unknown as Pool);
    for (const route of [
      `POST ${base}/preview`,
      `POST ${base}/runs`,
      `GET ${base}/runs`,
      `GET ${base}/runs/:runId`,
      `POST ${base}/runs/:runId/confirm`,
      `POST ${base}/runs/:runId/cancel`,
      `GET ${base}/runs/:runId/candidates`,
      `POST ${base}/runs/:runId/candidates/:candidateId/decision`,
      `POST ${base}/runs/:runId/candidates/:candidateId/feedback`,
      `GET ${base}/profiles`,
      `POST ${base}/profiles`,
      `PATCH ${base}/profiles/:profileId`,
      `DELETE ${base}/profiles/:profileId`,
    ]) {
      expect(routes.has(route), route).toBe(true);
    }
  });

  it("authorizes a hydrated cookie session through tenant-scoped Discovery RBAC", async () => {
    access.getLeadgridSession.mockImplementation(
      (req: Request) =>
        (req as Request & { session?: { userId: string } }).session ?? null,
    );
    permissionResolver.resolveEffectivePermissions.mockResolvedValue({
      role: "owner",
      permissions: new Set(["lead_research.run"]),
    });
    const { routes } = makeHarness({ query: vi.fn() } as unknown as Pool);
    const middleware = routes.get(`POST ${base}/preview`)?.[0];
    expect(middleware).toBeTruthy();
    const req = {
      params: { projectId: "project-a" },
      headers: {},
      session: { userId: "user-a" },
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    await middleware!(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(access.loadAccessibleLeadgridProject).toHaveBeenCalledWith(
      expect.anything(),
      "project-a",
      "user-a",
    );
    expect(permissionResolver.resolveEffectivePermissions).toHaveBeenCalledWith(
      expect.anything(),
      organizationId,
      "user-a",
    );

    permissionResolver.resolveEffectivePermissions.mockResolvedValue({
      role: "member",
      permissions: new Set(),
    });
    const deniedRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const deniedNext = vi.fn();
    await middleware!(
      { ...req, session: { userId: "user-a" } } as unknown as Request,
      deniedRes,
      deniedNext,
    );
    expect(deniedNext).not.toHaveBeenCalled();
    expect(deniedRes.status).toHaveBeenCalledWith(403);
    expect(deniedRes.json).toHaveBeenCalledWith({
      error: "mangler_tillatelse",
      required: "lead_research.run",
      organization_id: organizationId,
    });
  });

  it("requires Idempotency-Key and returns the typed error envelope", async () => {
    const harness = makeHarness({ query: vi.fn() } as unknown as Pool);
    const response = await harness.call("POST", `${base}/runs`, {
      params: { projectId: "project-a" },
      body: { brief: brief() },
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "idempotency_key_required",
        message: "En gyldig Idempotency-Key-header er påkrevd.",
        retryable: false,
        field: "Idempotency-Key",
      },
    });
    expect(service.createDiscoveryRun).not.toHaveBeenCalled();
  });

  it("creates a run only after resolving the selected project tenant", async () => {
    service.createDiscoveryRun.mockResolvedValue({
      run: { id: runId, status: "queued" },
      replayed: false,
    });
    const harness = makeHarness({ query: vi.fn() } as unknown as Pool);
    const response = await harness.call("POST", `${base}/runs`, {
      params: { projectId: "project-a" },
      headers: { "Idempotency-Key": "run-create-0001" },
      body: { brief: brief(), start_immediately: true },
    });
    expect(response.status).toBe(202);
    expect(access.loadAccessibleLeadgridProject).toHaveBeenCalledWith(
      expect.anything(),
      "project-a",
      "user-a",
    );
    expect(service.createDiscoveryRun).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        project,
        userId: "user-a",
        idempotencyKey: "run-create-0001",
        triggerKind: "manual",
      }),
    );
  });

  it("restores cross-device run history with validated status filters", async () => {
    service.listDiscoveryRuns.mockResolvedValue({ runs: [] });
    const harness = makeHarness({ query: vi.fn() } as unknown as Pool);
    const response = await harness.call("GET", `${base}/runs`, {
      params: { projectId: "project-a" },
      query: { status: "active,review_ready", limit: "12" },
    });
    expect(response.status).toBe(200);
    expect(service.listDiscoveryRuns).toHaveBeenCalledWith(expect.anything(), {
      project,
      statuses: ["active", "review_ready"],
      limit: 12,
    });
  });

  it("binds a candidate decision to run, candidate and project", async () => {
    service.decideDiscoveryCandidate.mockResolvedValue({ replayed: false });
    const harness = makeHarness({ query: vi.fn() } as unknown as Pool);
    const response = await harness.call(
      "POST",
      `${base}/runs/:runId/candidates/:candidateId/decision`,
      {
        params: { projectId: "project-a", runId, candidateId },
        headers: { "Idempotency-Key": "candidate-decision-0001" },
        body: { decision: "approve" },
      },
    );
    expect(response.status).toBe(200);
    expect(permissionResolver.resolveEffectivePermissions).toHaveBeenCalledWith(
      expect.anything(),
      organizationId,
      "user-a",
    );
    expect(service.decideDiscoveryCandidate).toHaveBeenCalledWith(
      expect.anything(),
      {
        project,
        userId: "user-a",
        runId,
        candidateId,
        idempotencyKey: "candidate-decision-0001",
        decision: { decision: "approve" },
      },
    );
  });

  it("requires leads.create only when a decision promotes a CRM lead", async () => {
    permissionResolver.resolveEffectivePermissions.mockResolvedValue({
      role: "member",
      permissions: new Set(),
    });
    service.decideDiscoveryCandidate.mockResolvedValue({ replayed: false });
    const harness = makeHarness({ query: vi.fn() } as unknown as Pool);

    const denied = await harness.call(
      "POST",
      `${base}/runs/:runId/candidates/:candidateId/decision`,
      {
        params: { projectId: "project-a", runId, candidateId },
        headers: { "Idempotency-Key": "candidate-approve-no-create" },
        body: { decision: "approve" },
      },
    );

    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({
      error: "mangler_tillatelse",
      required: "leads.create",
      organization_id: organizationId,
    });
    expect(service.decideDiscoveryCandidate).not.toHaveBeenCalled();

    const rejected = await harness.call(
      "POST",
      `${base}/runs/:runId/candidates/:candidateId/decision`,
      {
        params: { projectId: "project-a", runId, candidateId },
        headers: { "Idempotency-Key": "candidate-reject-research-only" },
        body: { decision: "reject", reason_code: "not_relevant" },
      },
    );

    expect(rejected.status).toBe(200);
    expect(service.decideDiscoveryCandidate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        project,
        userId: "user-a",
        decision: { decision: "reject", reason_code: "not_relevant" },
      }),
    );
    expect(
      permissionResolver.resolveEffectivePermissions,
    ).toHaveBeenCalledTimes(1);
  });

  it("binds append-only feedback to the same run occurrence", async () => {
    service.appendDiscoveryFeedback.mockResolvedValue({ replayed: false });
    const harness = makeHarness({ query: vi.fn() } as unknown as Pool);
    const response = await harness.call(
      "POST",
      `${base}/runs/:runId/candidates/:candidateId/feedback`,
      {
        params: { projectId: "project-a", runId, candidateId },
        headers: { "Idempotency-Key": "candidate-feedback-0001" },
        body: { kind: "quality", reason_code: "missing_phone" },
      },
    );
    expect(response.status).toBe(201);
    expect(service.appendDiscoveryFeedback).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        project,
        userId: "user-a",
        runId,
        candidateId,
        idempotencyKey: "candidate-feedback-0001",
      }),
    );
  });

  it("scopes profile reads by organization and project", async () => {
    const query = vi.fn(async (_sql: string, _params: unknown[] = []) => ({
      rows: [],
    }));
    const harness = makeHarness({ query } as unknown as Pool);
    const response = await harness.call("GET", `${base}/profiles`, {
      params: { projectId: "project-a" },
    });
    expect(response.status).toBe(200);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("organization_id = $1::uuid");
    expect(sql).toContain("project_id = $2");
    expect(params).toEqual([organizationId, "project-a"]);
  });

  it("returns a complete fail-closed manual brief for migrated profiles", async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          id: profileId,
          organization_id: organizationId,
          project_id: "project-a",
          name: "Migrert",
          is_default: true,
          status: "active",
          target_customer_types: ["regnskapsbyrå"],
          city_filters: [],
          geography_lat: null,
          geography_lng: null,
          geography_radius_km: 25,
          brief: { migrated_from: "leadgrid_project_discovery_config" },
          approval_mode: "rules",
          max_candidates_per_run: 20,
          enrichment_count: 10,
          auto_discover_enabled: false,
          schedule_cron: "0 6 * * *",
          schedule_timezone: "Europe/Oslo",
          last_run_at: null,
          next_run_at: null,
          version: 2,
          created_at: "2026-08-30T00:00:00.000Z",
          updated_at: "2026-08-30T00:00:00.000Z",
        },
      ],
    }));
    const response = await makeHarness({ query } as unknown as Pool).call(
      "GET",
      `${base}/profiles`,
      { params: { projectId: "project-a" } },
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      profiles: [
        expect.objectContaining({
          approval_mode: "manual",
          brief: {
            industry_queries: ["regnskapsbyrå"],
            exclusion_terms: [],
            city: "Norge",
            geo: null,
            target_count: 20,
            enrichment_count: 10,
            minimum_fit_score: 50,
            ideal_customer: null,
            goal: null,
          },
        }),
      ],
    });
    expect(
      (response.body as { profiles: Record<string, unknown>[] }).profiles[0],
    ).not.toHaveProperty("approval_rules");
  });

  it("rejects unsupported rules approval input before persistence", async () => {
    const pool = { query: vi.fn(), connect: vi.fn() } as unknown as Pool;
    const harness = makeHarness(pool);
    const rulesMode = await harness.call("POST", `${base}/profiles`, {
      params: { projectId: "project-a" },
      body: { brief: brief(), approval_mode: "rules" },
    });
    const rulesPayload = await harness.call("POST", `${base}/profiles`, {
      params: { projectId: "project-a" },
      body: { brief: brief(), approval_rules: { minimum_fit_score: 80 } },
    });

    expect(rulesMode.status).toBe(400);
    expect(rulesPayload.status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("rejects an invalid cron/timezone pair before profile persistence", async () => {
    const pool = {
      query: vi.fn(),
      connect: vi.fn(),
    } as unknown as Pool;
    const harness = makeHarness(pool);
    const response = await harness.call("POST", `${base}/profiles`, {
      params: { projectId: "project-a" },
      body: {
        brief: brief(),
        auto_discover_enabled: true,
        schedule_cron: "not-a-cron",
        schedule_timezone: "Europe/Oslo",
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "invalid_discovery_schedule",
        message:
          "Tidsplanen må ha gyldig cron-format, IANA-tidssone og kan kjøre maksimalt én gang daglig.",
        retryable: false,
        field: "schedule_cron",
      },
    });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("persists the first next_run_at when an active auto profile is created", async () => {
    const row = {
      id: profileId,
      organization_id: organizationId,
      project_id: "project-a",
      name: "Standard",
      is_default: false,
      status: "active",
      target_customer_types: ["regnskapsbyrå"],
      city_filters: ["Oslo"],
      geography_lat: null,
      geography_lng: null,
      geography_radius_km: 25,
      brief: brief(),
      approval_mode: "manual",
      approval_rules: {},
      max_candidates_per_run: 20,
      enrichment_count: 10,
      auto_discover_enabled: true,
      schedule_cron: "0 6 * * *",
      schedule_timezone: "Europe/Oslo",
      last_run_at: null,
      next_run_at: "2026-08-31T04:00:00.000Z",
      version: 2,
      created_at: "2026-08-30T00:00:00.000Z",
      updated_at: "2026-08-30T00:00:00.000Z",
    };
    const clientQuery = vi.fn(async (sql: string, _params: unknown[] = []) =>
      sql.includes("INSERT INTO leadgrid_discovery_profiles")
        ? { rows: [row] }
        : { rows: [] },
    );
    const pool = {
      query: vi.fn(),
      connect: vi.fn(async () => ({
        query: clientQuery,
        release: vi.fn(),
      })),
    } as unknown as Pool;
    const harness = makeHarness(pool);
    const response = await harness.call("POST", `${base}/profiles`, {
      params: { projectId: "project-a" },
      body: {
        brief: brief(),
        auto_discover_enabled: true,
        schedule_cron: "0 6 * * *",
        schedule_timezone: "Europe/Oslo",
      },
    });

    expect(response.status).toBe(201);
    const insert = clientQuery.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO leadgrid_discovery_profiles"),
    );
    expect(insert?.[0]).toContain("schedule_timezone, next_run_at");
    expect(insert?.[0]).toContain("$20::timestamptz");
    expect(insert?.[1]?.[19]).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(String(insert?.[1]?.[19])))).toBe(false);
  });

  it("uses OCC and all scope keys when patching a profile", async () => {
    const row = {
      id: profileId,
      organization_id: organizationId,
      project_id: "project-a",
      name: "Ny profil",
      is_default: false,
      status: "active",
      target_customer_types: ["regnskapsbyrå"],
      city_filters: ["Oslo"],
      geography_lat: null,
      geography_lng: null,
      geography_radius_km: 25,
      brief: brief(),
      approval_mode: "manual",
      approval_rules: {},
      max_candidates_per_run: 20,
      enrichment_count: 10,
      auto_discover_enabled: false,
      schedule_cron: "0 6 * * *",
      schedule_timezone: "Europe/Oslo",
      last_run_at: null,
      next_run_at: null,
      version: 8,
      created_at: new Date("2026-08-30T00:00:00Z"),
      updated_at: new Date("2026-08-30T00:00:00Z"),
    };
    const clientQuery = vi.fn(async (sql: string, _params: unknown[] = []) => {
      if (sql.includes("SELECT version, status")) {
        return {
          rows: [
            {
              version: 7,
              status: "active",
              auto_discover_enabled: false,
              schedule_cron: "0 6 * * *",
              schedule_timezone: "Europe/Oslo",
              next_run_at: null,
            },
          ],
        };
      }
      return sql.includes("RETURNING") ? { rows: [row] } : { rows: [] };
    });
    const client = { query: clientQuery, release: vi.fn() };
    const pool = {
      query: vi.fn(),
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const harness = makeHarness(pool);
    const response = await harness.call(
      "PATCH",
      `${base}/profiles/:profileId`,
      {
        params: { projectId: "project-a", profileId },
        body: { expected_version: 7, name: "Ny profil" },
      },
    );
    expect(response.status).toBe(200);
    const updateCall = clientQuery.mock.calls.find(([sql]) =>
      sql.includes("UPDATE leadgrid_discovery_profiles"),
    );
    expect(updateCall?.[0]).toContain("organization_id = $1::uuid");
    expect(updateCall?.[0]).toContain("project_id = $2");
    expect(updateCall?.[0]).toContain("id = $3::uuid");
    expect(updateCall?.[0]).toContain("version = $4");
    expect(updateCall?.[1]?.slice(0, 5)).toEqual([
      organizationId,
      "project-a",
      profileId,
      7,
      "user-a",
    ]);
    const governanceLock = clientQuery.mock.calls.findIndex(
      ([sql, values]) =>
        sql.includes("pg_advisory_xact_lock") &&
        values?.[0] === `leadgrid-discovery-auto-profiles|${organizationId}`,
    );
    const profileRowLock = clientQuery.mock.calls.findIndex(([sql]) =>
      sql.includes("SELECT version, status"),
    );
    expect(governanceLock).toBeGreaterThanOrEqual(0);
    expect(governanceLock).toBeLessThan(profileRowLock);
  });

  it("validates the effective schedule and sets next_run_at when auto starts", async () => {
    const row = {
      id: profileId,
      organization_id: organizationId,
      project_id: "project-a",
      name: "Auto profil",
      is_default: false,
      status: "active",
      target_customer_types: ["regnskapsbyrå"],
      city_filters: ["Oslo"],
      geography_lat: null,
      geography_lng: null,
      geography_radius_km: 25,
      brief: brief(),
      approval_mode: "manual",
      approval_rules: {},
      max_candidates_per_run: 20,
      enrichment_count: 10,
      auto_discover_enabled: true,
      schedule_cron: "0 7 * * *",
      schedule_timezone: "Europe/Oslo",
      last_run_at: null,
      next_run_at: new Date("2026-08-31T05:00:00Z"),
      version: 8,
      created_at: new Date("2026-08-30T00:00:00Z"),
      updated_at: new Date("2026-08-30T00:00:00Z"),
    };
    const clientQuery = vi.fn(async (sql: string, _params: unknown[] = []) => {
      if (sql.includes("SELECT version, status")) {
        return {
          rows: [
            {
              version: 7,
              status: "active",
              auto_discover_enabled: false,
              schedule_cron: "0 6 * * *",
              schedule_timezone: "Europe/Oslo",
              next_run_at: null,
            },
          ],
        };
      }
      return sql.includes("RETURNING") ? { rows: [row] } : { rows: [] };
    });
    const client = { query: clientQuery, release: vi.fn() };
    const pool = {
      query: vi.fn(),
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const harness = makeHarness(pool);
    const response = await harness.call(
      "PATCH",
      `${base}/profiles/:profileId`,
      {
        params: { projectId: "project-a", profileId },
        body: {
          expected_version: 7,
          auto_discover_enabled: true,
          schedule_cron: "0 7 * * *",
        },
      },
    );

    expect(response.status).toBe(200);
    const updateCall = clientQuery.mock.calls.find(
      ([sql]) =>
        sql.includes("UPDATE leadgrid_discovery_profiles") &&
        sql.includes("RETURNING"),
    );
    expect(updateCall?.[0]).toContain("next_run_at = $");
    expect(updateCall?.[0]).toContain("::timestamptz");
    const nextRunValue = updateCall?.[1]?.find(
      (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value),
    );
    expect(nextRunValue).toEqual(expect.any(String));
  });

  it("rejects an invalid patched timezone against the stored cron", async () => {
    const clientQuery = vi.fn(async (sql: string, _params: unknown[] = []) => {
      if (sql.includes("SELECT version, status")) {
        return {
          rows: [
            {
              version: 7,
              status: "active",
              auto_discover_enabled: true,
              schedule_cron: "0 6 * * *",
              schedule_timezone: "Europe/Oslo",
              next_run_at: "2026-08-31T04:00:00.000Z",
            },
          ],
        };
      }
      return { rows: [] };
    });
    const client = { query: clientQuery, release: vi.fn() };
    const pool = {
      query: vi.fn(),
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const harness = makeHarness(pool);
    const response = await harness.call(
      "PATCH",
      `${base}/profiles/:profileId`,
      {
        params: { projectId: "project-a", profileId },
        body: {
          expected_version: 7,
          schedule_timezone: "Mars/Olympus_Mons",
        },
      },
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "invalid_discovery_schedule",
        retryable: false,
        field: "schedule_timezone",
      },
    });
    expect(clientQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("RETURNING"),
      expect.anything(),
    );
  });
});
