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
const campaignService = vi.hoisted(() => ({
  createDiscoveryCampaign: vi.fn(),
  listDiscoveryCampaigns: vi.fn(),
  getDiscoveryCampaign: vi.fn(),
  advanceDiscoveryCampaign: vi.fn(),
  retryDiscoveryCampaign: vi.fn(),
  cancelDiscoveryCampaign: vi.fn(),
}));
const placesDetails = vi.hoisted(() => ({
  fetchTransientDiscoveryPlaceDetails: vi.fn(),
}));
const rateLimit = vi.hoisted(() => ({
  checkEndpointRateLimit: vi.fn(),
}));
const access = vi.hoisted(() => ({
  getLeadgridSession: vi.fn(),
  loadAccessibleLeadgridProject: vi.fn(),
}));
const permissionResolver = vi.hoisted(() => ({
  resolveEffectivePermissions: vi.fn(),
}));

vi.mock("./leadgrid-discovery-campaign-service.js", () => ({
  ...campaignService,
  DiscoveryCampaignError: class DiscoveryCampaignError extends Error {
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
vi.mock("./leadgrid-discovery-places-details.js", () => ({
  ...placesDetails,
  DiscoveryPlacesDetailsError: class DiscoveryPlacesDetailsError extends Error {
    code: string;
    status: number;
    retryable: boolean;
    constructor(
      code: string,
      status: number,
      message: string,
      retryable = false,
    ) {
      super(message);
      this.code = code;
      this.status = status;
      this.retryable = retryable;
    }
  },
}));
vi.mock("./role-room-agent-ratelimit.js", () => ({
  ...rateLimit,
  RateLimitExceededError: class RateLimitExceededError extends Error {
    retryAfterSeconds: number;
    constructor(retryAfterSeconds: number) {
      super("rate_limited");
      this.retryAfterSeconds = retryAfterSeconds;
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
      const responseHeaders: Record<string, string> = {};
      const res = {
        status(code: number) {
          status = code;
          return this;
        },
        json(payload: unknown) {
          body = payload;
          return this;
        },
        setHeader(name: string, value: string | number) {
          responseHeaders[name.toLowerCase()] = String(value);
          return this;
        },
      } as unknown as Response;
      await handler(req, res, vi.fn());
      return { status, body, headers: responseHeaders };
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
      `POST ${base}/campaign-runs`,
      `GET ${base}/campaign-runs`,
      `GET ${base}/campaign-runs/:campaignRunId`,
      `POST ${base}/campaign-runs/:campaignRunId/advance`,
      `POST ${base}/campaign-runs/:campaignRunId/retry`,
      `POST ${base}/campaign-runs/:campaignRunId/cancel`,
      `GET ${base}/runs/:runId/candidates`,
      `POST ${base}/runs/:runId/candidates/:candidateId/place-details`,
      `POST ${base}/runs/:runId/candidates/:candidateId/decision`,
      `POST ${base}/runs/:runId/candidates/:candidateId/feedback`,
      `GET ${base}/profiles`,
      `POST ${base}/profiles`,
      `POST ${base}/profiles/batch`,
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

  it("uses the same tenant/RBAC gate for persistent campaign routes", () => {
    const { routes } = makeHarness({ query: vi.fn() } as unknown as Pool);
    expect(routes.get(`POST ${base}/campaign-runs`)?.[0]).toBe(
      routes.get(`POST ${base}/preview`)?.[0],
    );
    expect(
      routes.get(`POST ${base}/campaign-runs/:campaignRunId/cancel`)?.[0],
    ).toBe(routes.get(`POST ${base}/preview`)?.[0]);
  });

  it("preserves profile priority and binds campaign creation to the resolved project", async () => {
    const orderedProfileIds = [
      profileId,
      "55555555-5555-4555-8555-555555555555",
      "66666666-6666-4666-8666-666666666666",
      "77777777-7777-4777-8777-777777777777",
    ];
    const orderedProfiles = orderedProfileIds.map((id, index) => ({
      profile_id: id,
      expected_version: index + 1,
    }));
    campaignService.createDiscoveryCampaign.mockResolvedValue({
      campaign: {
        id: runId,
        status: "running",
        profile_ids: orderedProfileIds,
      },
      replayed: false,
    });
    const response = await makeHarness({
      query: vi.fn(),
    } as unknown as Pool).call("POST", `${base}/campaign-runs`, {
      params: { projectId: "project-a" },
      headers: { "Idempotency-Key": "dentum-oslo-batch-0001" },
      body: {
        name: "Dentum – klinikkpilot Oslo og omegn",
        profiles: orderedProfiles,
      },
    });

    expect(response.status).toBe(202);
    expect(campaignService.createDiscoveryCampaign).toHaveBeenCalledWith(
      expect.anything(),
      {
        project,
        userId: "user-a",
        name: "Dentum – klinikkpilot Oslo og omegn",
        profiles: orderedProfiles.map((profile) => ({
          profileId: profile.profile_id,
          expectedVersion: profile.expected_version,
        })),
        idempotencyKey: "dentum-oslo-batch-0001",
      },
    );
  });

  it("keeps campaign history and commands inside the selected project", async () => {
    campaignService.listDiscoveryCampaigns.mockResolvedValue({ campaigns: [] });
    campaignService.cancelDiscoveryCampaign.mockResolvedValue({
      campaign: { id: runId, status: "cancel_requested" },
      replayed: false,
    });
    const harness = makeHarness({ query: vi.fn() } as unknown as Pool);

    await harness.call("GET", `${base}/campaign-runs`, {
      params: { projectId: "project-a" },
      query: { limit: "7" },
    });
    await harness.call("POST", `${base}/campaign-runs/:campaignRunId/cancel`, {
      params: { projectId: "project-a", campaignRunId: runId },
      headers: { "Idempotency-Key": "dentum-cancel-0001" },
      body: {},
    });

    expect(campaignService.listDiscoveryCampaigns).toHaveBeenCalledWith(
      expect.anything(),
      { project, limit: 7 },
    );
    expect(campaignService.cancelDiscoveryCampaign).toHaveBeenCalledWith(
      expect.anything(),
      {
        project,
        userId: "user-a",
        campaignId: runId,
        idempotencyKey: "dentum-cancel-0001",
      },
    );
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

  it("requires expected_profile_version for a profile-linked run", async () => {
    const harness = makeHarness({ query: vi.fn() } as unknown as Pool);
    const response = await harness.call("POST", `${base}/runs`, {
      params: { projectId: "project-a" },
      headers: { "Idempotency-Key": "profile-run-version-required" },
      body: {
        brief: brief(),
        profile_id: profileId,
        start_immediately: true,
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "invalid_request",
        field: "expected_profile_version",
      },
    });
    expect(service.createDiscoveryRun).not.toHaveBeenCalled();
  });

  it("rejects any attempt to inject the internal campaign snapshot capability over HTTP", async () => {
    const harness = makeHarness({ query: vi.fn() } as unknown as Pool);
    const response = await harness.call("POST", `${base}/runs`, {
      params: { projectId: "project-a" },
      headers: { "Idempotency-Key": "untrusted-snapshot-injection" },
      body: {
        brief: brief(),
        start_immediately: true,
        trusted_profile_snapshot: {
          profile_id: profileId,
          profile_version: 1,
          source_cursor_map: {},
        },
      },
    });

    expect(response.status).toBe(400);
    expect(service.createDiscoveryRun).not.toHaveBeenCalled();
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

  it("serves an explicit no-store transient Google Maps detail request", async () => {
    placesDetails.fetchTransientDiscoveryPlaceDetails.mockResolvedValue({
      candidate_id: candidateId,
      mode: "transient_details_only",
      fetched_at: "2026-08-31T12:00:00.000Z",
      provider: {
        id: "google_places",
        name: "Google Maps",
        policy_uri:
          "https://developers.google.com/maps/documentation/places/web-service/policies",
      },
      notice: "Hentet på forespørsel og ikke lagret.",
      ranking_notice: "Påvirker ikke Discovery-score.",
      matches: [],
    });
    const harness = makeHarness({ query: vi.fn() } as unknown as Pool);

    const response = await harness.call(
      "POST",
      `${base}/runs/:runId/candidates/:candidateId/place-details`,
      { params: { projectId: "project-a", runId, candidateId }, body: {} },
    );

    expect(response.status).toBe(200);
    expect(response.headers).toMatchObject({
      "cache-control": "private, no-store, max-age=0",
      pragma: "no-cache",
    });
    expect(rateLimit.checkEndpointRateLimit).toHaveBeenCalledWith(
      "user-a",
      "leadgrid_discovery_places_details",
      10,
    );
    expect(
      placesDetails.fetchTransientDiscoveryPlaceDetails,
    ).toHaveBeenCalledWith(expect.anything(), {
      project,
      runId,
      candidateId,
      userId: "user-a",
    });
    expect(response.body).toMatchObject({
      candidate_id: candidateId,
      mode: "transient_details_only",
      matches: [],
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
          source_config: {
            google_places: { enabled: false, mode: "transient_details_only" },
          },
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
          places_details_enabled: false,
          brief: {
            industry_queries: ["regnskapsbyrå"],
            organization_name_queries: [],
            exclusion_terms: [],
            city: null,
            geo: null,
            country_code: "NO",
            territory_code: null,
            municipality_numbers: [],
            municipality_names: [],
            target_count: 20,
            enrichment_count: 10,
            minimum_fit_score: 50,
            ideal_customer: null,
            goal: null,
            organization_forms: [],
            employee_count: null,
            organization_structure: "any",
            website_requirement: "any",
            website_quality: { minimum_score: null },
            subject_kind: "organization",
            qualification_terms: [],
            qualification_requirement: "preferred",
            commercial_signals: {
              registered_in_vat_register: null,
              registered_in_business_register: null,
            },
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

  it("creates a four-profile preset atomically and replays it idempotently", async () => {
    const storedRows: Record<string, unknown>[] = [];
    let batchRecord: { request_hash: string; profile_ids: string[] } | null =
      null;
    const sequence: string[] = [];
    const clientQuery = vi.fn(
      async (sql: string, params: unknown[] = []): Promise<unknown> => {
        sequence.push(sql.trim().split(/\s+/).slice(0, 4).join(" "));
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
          return { rows: [] };
        }
        if (
          sql.includes("FROM leadgrid_discovery_profile_batches") &&
          sql.includes("FOR UPDATE")
        ) {
          return { rows: batchRecord ? [batchRecord] : [] };
        }
        if (sql.includes("id = ANY($3::uuid[])")) {
          return { rows: storedRows };
        }
        if (sql.includes("INSERT INTO leadgrid_discovery_profiles")) {
          const briefValue = JSON.parse(String(params[12]));
          const id = `${String(storedRows.length + 5).repeat(8)}-${String(
            storedRows.length + 5,
          ).repeat(4)}-4${String(storedRows.length + 5).repeat(3)}-8${String(
            storedRows.length + 5,
          ).repeat(3)}-${String(storedRows.length + 5).repeat(12)}`;
          const row = {
            id,
            organization_id: organizationId,
            project_id: "project-a",
            name: params[2],
            is_default: params[3],
            status: params[4],
            target_customer_types: params[5],
            city_filters: params[6],
            geography_lat: params[7],
            geography_lng: params[8],
            geography_radius_km: params[9],
            company_size_min: params[10],
            company_size_max: params[11],
            brief: briefValue,
            desired_signals: JSON.parse(String(params[13])),
            source_config: JSON.parse(String(params[15])),
            approval_mode: params[16],
            max_candidates_per_run: params[18],
            enrichment_count: params[19],
            auto_discover_enabled: params[20],
            schedule_cron: params[21],
            schedule_timezone: params[22],
            last_run_at: null,
            next_run_at: params[23],
            version: 1,
            created_at: "2026-09-05T12:00:00.000Z",
            updated_at: "2026-09-05T12:00:00.000Z",
          };
          storedRows.push(row);
          return { rows: [row] };
        }
        if (sql.includes("INSERT INTO leadgrid_discovery_profile_batches")) {
          batchRecord = {
            request_hash: String(params[3]),
            profile_ids: params[4] as string[],
          };
          return { rows: [] };
        }
        return { rows: [] };
      },
    );
    const pool = {
      query: vi.fn(),
      connect: vi.fn(async () => ({
        query: clientQuery,
        release: vi.fn(),
      })),
    } as unknown as Pool;
    const harness = makeHarness(pool);
    const body = {
      profiles: [
        ["Oslo", "oslo", ["0301"]],
        ["Vest", "vest", ["3201", "3203"]],
        ["Øst og nord", "ost-nord", ["3205", "3222"]],
        ["Sør", "sor", ["3207", "3212"]],
      ].map(([name, territory, municipalityNumbers]) => ({
        name,
        brief: {
          industry_queries: ["tannklinikk"],
          municipality_numbers: municipalityNumbers,
          territory_code: territory,
          target_count: 60,
          enrichment_count: 30,
        },
      })),
    };
    const options = {
      params: { projectId: "project-a" },
      headers: { "Idempotency-Key": "clinic-preset-0001" },
      body,
    };

    const first = await harness.call("POST", `${base}/profiles/batch`, options);
    const second = await harness.call(
      "POST",
      `${base}/profiles/batch`,
      options,
    );

    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ replayed: false });
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ replayed: true });
    expect((first.body as { profiles: unknown[] }).profiles).toHaveLength(4);
    expect((second.body as { profiles: unknown[] }).profiles).toHaveLength(4);
    expect(
      clientQuery.mock.calls.filter(([sql]) =>
        String(sql).includes("INSERT INTO leadgrid_discovery_profiles"),
      ),
    ).toHaveLength(4);
    expect(
      clientQuery.mock.calls.filter(([sql]) =>
        String(sql).includes("INSERT INTO leadgrid_discovery_profile_batches"),
      ),
    ).toHaveLength(1);
    expect(
      clientQuery.mock.calls.filter(
        ([sql, params]) =>
          String(sql).includes("pg_advisory_xact_lock") &&
          String(params?.[0]).includes("discovery_profile_batch"),
      ),
    ).toHaveLength(2);
    expect(sequence.filter((entry) => entry === "COMMIT")).toHaveLength(2);
  });

  it("rolls back the entire profile batch when one insert fails", async () => {
    let inserts = 0;
    const sequence: string[] = [];
    const clientQuery = vi.fn(async (sql: string) => {
      sequence.push(sql);
      if (sql.includes("FROM leadgrid_discovery_profile_batches")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO leadgrid_discovery_profiles")) {
        inserts += 1;
        if (inserts === 3) throw new Error("simulated insert failure");
        return { rows: [{ id: profileId }] };
      }
      return { rows: [] };
    });
    const pool = {
      query: vi.fn(),
      connect: vi.fn(async () => ({
        query: clientQuery,
        release: vi.fn(),
      })),
    } as unknown as Pool;
    const response = await makeHarness(pool).call(
      "POST",
      `${base}/profiles/batch`,
      {
        params: { projectId: "project-a" },
        headers: { "Idempotency-Key": "clinic-preset-failure-0001" },
        body: {
          profiles: ["oslo", "vest", "ost-nord", "sor"].map(
            (territory, index) => ({
              name: `Profil ${index + 1}`,
              brief: {
                industry_queries: ["tannklinikk"],
                municipality_numbers: [
                  `03${String(index + 1).padStart(2, "0")}`,
                ],
                territory_code: territory,
              },
            }),
          ),
        },
      },
    );

    expect(response.status).toBe(500);
    expect(inserts).toBe(3);
    expect(sequence).toContain("ROLLBACK");
    expect(
      sequence.some((sql) =>
        sql.includes("INSERT INTO leadgrid_discovery_profile_batches"),
      ),
    ).toBe(false);
    expect(sequence).not.toContain("COMMIT");
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
      source_config: {
        google_places: { enabled: false, mode: "transient_details_only" },
      },
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
    expect(JSON.parse(String(insert?.[1]?.[15]))).toEqual({
      brreg_open_data: { enabled: true },
      google_places: {
        enabled: false,
        mode: "transient_details_only",
      },
    });
    expect(insert?.[0]).toContain("$24::timestamptz");
    expect(insert?.[1]?.[23]).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(String(insert?.[1]?.[23])))).toBe(false);
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
      source_config: {
        google_places: { enabled: true, mode: "transient_details_only" },
      },
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
        body: {
          expected_version: 7,
          name: "Ny profil",
          places_details_enabled: true,
        },
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
    expect(updateCall?.[0]).toContain("source_config = jsonb_set");
    expect(updateCall?.[0]).toContain("transient_details_only");
    expect(updateCall?.[1]).toContain(true);
    expect(response.body).toMatchObject({
      profile: { places_details_enabled: true },
    });
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
