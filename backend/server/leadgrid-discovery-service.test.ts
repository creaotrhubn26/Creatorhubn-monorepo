import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";

import { discoveryHash } from "./leadgrid-discovery-contract.js";
import type {
  DiscoveryRegistryCandidate,
  DiscoveryRegistrySearchInput,
} from "./leadgrid-discovery-brreg-provider.js";
import { leadgridRealtime } from "./leadgrid-realtime.js";
import {
  cancelDiscoveryRun,
  cancelDiscoveryRunFromTrustedWorkflow,
  confirmDiscoveryRun,
  createDiscoveryRun,
  decideDiscoveryCandidate,
  discoverySourceQueryFingerprint,
  executeDiscoveryRun,
  isLeadgridDiscoveryEnabled,
  listDiscoveryCandidates,
  listDiscoveryRuns,
  previewDiscovery,
} from "./leadgrid-discovery-service.js";
import type { LeadgridAccessibleProject } from "./leadgrid-project-access.js";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const CANDIDATE_ID = "33333333-3333-4333-8333-333333333333";
const LEAD_ID = "44444444-4444-4444-8444-444444444444";
const JOB_ID = "55555555-5555-4555-8555-555555555555";

const project: LeadgridAccessibleProject = {
  id: "leadgrid-project-a",
  organizationId: ORGANIZATION_ID,
  name: "Leadgrid Norge",
  description: null,
  industry: "SaaS",
  status: "active",
  createdBy: "user-a",
  memberRole: "owner",
};

const brief = {
  industry_queries: ["regnskapsfører"],
  exclusion_terms: ["konkurs"],
  city: "Oslo",
  target_count: 20,
  enrichment_count: 5,
  minimum_fit_score: 50,
};

function runRow(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: RUN_ID,
    organization_id: ORGANIZATION_ID,
    project_id: project.id,
    profile_id: null,
    profile_version: null,
    trigger_kind: "manual",
    status: "queued",
    requested_by: "user-a",
    requested_count: brief.target_count,
    enrichment_count: brief.enrichment_count,
    scheduled_for: null,
    idempotency_key: "create-key-a",
    request_hash: "request-hash-a",
    brief_snapshot: brief,
    search_plan: previewDiscovery(brief).plan,
    checkpoint: {
      version: 2,
      completed_queries: [],
      query_errors: [],
      query_results: {},
    },
    source_summary: {},
    provider_usage: {},
    raw_result_count: 0,
    duplicate_count: 0,
    excluded_count: 0,
    candidate_count: 0,
    researched_count: 0,
    review_ready_count: 0,
    approved_count: 0,
    rejected_count: 0,
    imported_count: 0,
    failed_count: 0,
    background_job_id: null,
    execution_lease_token: null,
    error_code: null,
    error_message: null,
    cancellation_requested_at: null,
    started_at: null,
    finished_at: null,
    version: 1,
    created_at: "2026-08-30T10:00:00.000Z",
    updated_at: "2026-08-30T10:00:00.000Z",
    ...overrides,
  };
}

type SqlReply = {
  rows: Array<Record<string, unknown>>;
  rowCount?: number;
};

function textOf(query: unknown): string {
  if (typeof query === "string") return query;
  if (
    query &&
    typeof query === "object" &&
    "text" in query &&
    typeof query.text === "string"
  ) {
    return query.text;
  }
  return String(query);
}

function transactionPool(
  responder: (sql: string, values: unknown[]) => SqlReply | undefined,
  sequence: string[] = [],
): { pool: Pool; sequence: string[]; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn(async (queryValue: unknown, values: unknown[] = []) => {
    const sql = textOf(queryValue);
    const marker = sql.trim().replace(/\s+/g, " ");
    sequence.push(marker);
    return responder(sql, values) ?? { rows: [], rowCount: 0 };
  });
  const client = { query, release: vi.fn() };
  return {
    pool: {
      connect: vi.fn(async () => client),
      query,
    } as unknown as Pool,
    sequence,
    query,
  };
}

function decisionCandidate(): Record<string, unknown> {
  return {
    candidate_id: CANDIDATE_ID,
    run_id: RUN_ID,
    run_status: "review_ready",
    candidate_status: "review_ready",
    disposition: "review_ready",
    name: "Trygg Regnskap AS",
    phone: "+47 22000000",
    email: "hei@tryggregnskap.no",
    address: "Karl Johans gate 1",
    city: "Oslo",
    postal_code: "0154",
    latitude: 59.9139,
    longitude: 10.7522,
    website_url: "https://tryggregnskap.no",
    organization_number: "999888777",
    enrichment_data: {
      found: true,
      source: "brreg",
      fetchedAt: "2026-08-30T09:00:00.000Z",
      autoLinked: true,
      company: { name: "Trygg Regnskap AS", orgNr: "999888777" },
    },
    imported_lead_id: null,
    existing_lead_id: null,
  };
}

function registryCandidate(): DiscoveryRegistryCandidate {
  return {
    organizationNumber: "999888777",
    name: "Trygg Regnskap AS",
    organizationForm: "AS",
    address: "Karl Johans gate 1",
    postalCode: "0154",
    city: "Oslo",
    municipality: "Oslo",
    municipalityNumber: "0301",
    location: { latitude: 59.9139, longitude: 10.7522 },
    distanceFromSearchCenterMeters: 250,
    website: "https://tryggregnskap.no",
    employeeCount: 12,
    naceCode: "69.201",
    naceDescription: "Regnskap og bokføring",
    registeredAt: "2020-01-02",
    registeredInVatRegister: true,
    registeredInBusinessRegister: true,
    status: "active",
    sourceUri: "https://data.brreg.no/enhetsregisteret/api/enheter/999888777",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Leadgrid Discovery service", () => {
  it("builds a deterministic, read-only preview and returns safe validation errors", () => {
    const first = previewDiscovery(brief);
    const second = previewDiscovery({ ...brief });

    expect(first).toEqual(second);
    expect(first.plan.queries[0]?.text_query).toBe("regnskapsfører");
    expect(first.plan).toMatchObject({
      version: 2,
      source: "brreg_open_data",
      maximum_external_requests: 200,
      maximum_geocodes: 120,
    });
    expect(first.sources.map((source) => source.id)).toEqual([
      "brreg",
      "ssb_klass",
      "kartverket_geonorge",
    ]);
    expect(first.plan_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(() =>
      previewDiscovery({ ...brief, city: null, geo: null }),
    ).toThrowError(
      expect.objectContaining({
        code: "validation_error",
        status: 400,
        retryable: false,
        field: "geo",
      }),
    );
  });

  it("keeps production producers disabled until the explicit phase-two flag", async () => {
    expect(isLeadgridDiscoveryEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(
      isLeadgridDiscoveryEnabled({
        NODE_ENV: "production",
        LEADGRID_DISCOVERY_ENABLED: "true",
      }),
    ).toBe(true);
    expect(
      isLeadgridDiscoveryEnabled({
        NODE_ENV: "development",
        LEADGRID_DISCOVERY_ENABLED: "false",
      }),
    ).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LEADGRID_DISCOVERY_ENABLED", "");
    const connect = vi.fn();
    const pool = { connect, query: vi.fn() } as unknown as Pool;
    await expect(
      createDiscoveryRun(pool, {
        project,
        userId: "user-a",
        brief,
        idempotencyKey: "disabled-create-key",
        startImmediately: true,
      }),
    ).rejects.toMatchObject({
      code: "discovery_not_enabled",
      status: 503,
      retryable: false,
    });
    await expect(
      confirmDiscoveryRun(pool, {
        project,
        userId: "user-a",
        runId: RUN_ID,
      }),
    ).rejects.toMatchObject({
      code: "discovery_not_enabled",
      status: 503,
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it("atomically creates a run and its durable background job", async () => {
    let createdRunId = RUN_ID;
    let requestHash = "";
    const { pool, sequence } = transactionPool((sql, values) => {
      if (sql.includes("AND r.idempotency_key = $3")) return { rows: [] };
      if (sql.includes("INSERT INTO leadgrid_discovery_monthly_usage")) {
        return { rows: [{ reserved_candidates: 20 }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO leadgrid_discovery_runs")) {
        createdRunId = String(values[0]);
        requestHash = String(values[12]);
      }
      if (sql.includes("INSERT INTO background_jobs")) {
        return { rows: [{ id: JOB_ID }], rowCount: 1 };
      }
      if (sql.includes("UPDATE leadgrid_discovery_capacity_reservations")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("WHERE r.id = $3::uuid")) {
        return {
          rows: [
            runRow({
              id: createdRunId,
              request_hash: requestHash,
              background_job_id: JOB_ID,
            }),
          ],
        };
      }
      return undefined;
    });

    const result = await createDiscoveryRun(pool, {
      project,
      userId: "user-a",
      brief,
      idempotencyKey: "create-key-a",
      startImmediately: true,
    });

    expect(result.replayed).toBe(false);
    expect(result.run).not.toHaveProperty("background_job_id");
    expect(result.run).not.toHaveProperty("idempotency_key");
    expect(result.run).not.toHaveProperty("request_hash");
    expect(
      sequence.some(
        (entry) =>
          entry.includes("UPDATE leadgrid_discovery_runs") &&
          entry.includes("background_job_id"),
      ),
    ).toBe(true);
    expect(sequence[0]).toBe("BEGIN");
    expect(sequence.at(-1)).toBe("COMMIT");
    expect(
      sequence.findIndex((entry) =>
        entry.includes("INSERT INTO leadgrid_discovery_runs"),
      ),
    ).toBeLessThan(
      sequence.findIndex((entry) =>
        entry.includes("INSERT INTO background_jobs"),
      ),
    );
    expect(sequence.some((entry) => entry.includes("ROLLBACK"))).toBe(false);
  });

  it("requires an exact stored profile version and brief for profile-linked runs", async () => {
    const profileId = "77777777-7777-4777-8777-777777777777";
    const connect = vi.fn();
    const disconnectedPool = {
      connect,
      query: vi.fn(),
    } as unknown as Pool;

    await expect(
      createDiscoveryRun(disconnectedPool, {
        project,
        userId: "user-a",
        brief,
        profileId,
        idempotencyKey: "profile-version-required",
        startImmediately: false,
      }),
    ).rejects.toMatchObject({
      code: "validation_error",
      field: "expected_profile_version",
    });
    expect(connect).not.toHaveBeenCalled();

    const storedBrief = { ...brief, city: "Bergen" };
    const { pool, sequence } = transactionPool((sql) => {
      if (sql.includes("AND r.idempotency_key = $3")) return { rows: [] };
      if (
        sql.includes("SELECT version, status, brief") &&
        sql.includes("FROM leadgrid_discovery_profiles")
      ) {
        return {
          rows: [{ version: 4, status: "active", brief: storedBrief }],
          rowCount: 1,
        };
      }
      return undefined;
    });

    await expect(
      createDiscoveryRun(pool, {
        project,
        userId: "user-a",
        brief,
        profileId,
        expectedProfileVersion: 4,
        idempotencyKey: "profile-brief-mismatch",
        startImmediately: false,
      }),
    ).rejects.toMatchObject({
      code: "profile_version_conflict",
      field: "brief",
    });
    expect(sequence).toContain("ROLLBACK");
    expect(
      sequence.some((entry) =>
        entry.includes("INSERT INTO leadgrid_discovery_runs"),
      ),
    ).toBe(false);

    let insertValues: unknown[] = [];
    const normalizedStoredBrief = previewDiscovery(storedBrief).brief;
    const storedFingerprint = discoverySourceQueryFingerprint(
      normalizedStoredBrief,
      normalizedStoredBrief.industry_queries[0],
    );
    const { pool: matchingPool } = transactionPool((sql, values) => {
      if (sql.includes("AND r.idempotency_key = $3")) return { rows: [] };
      if (
        sql.includes("SELECT version, status, brief") &&
        sql.includes("FROM leadgrid_discovery_profiles")
      ) {
        return {
          rows: [
            {
              version: 4,
              status: "active",
              brief: normalizedStoredBrief,
              rotation_index: 6,
              source_cursor_map: { [storedFingerprint]: 612 },
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes("INSERT INTO leadgrid_discovery_runs")) {
        insertValues = values;
      }
      if (sql.includes("WHERE r.id = $3::uuid")) {
        return {
          rows: [
            runRow({
              id: String(insertValues[0]),
              profile_id: profileId,
              profile_version: 4,
              status: "awaiting_confirmation",
              requested_count: normalizedStoredBrief.target_count,
              enrichment_count: normalizedStoredBrief.enrichment_count,
              idempotency_key: "profile-brief-match",
              request_hash: String(insertValues[12]),
              brief_snapshot: normalizedStoredBrief,
              search_plan: JSON.parse(String(insertValues[14])),
            }),
          ],
          rowCount: 1,
        };
      }
      return undefined;
    });

    const created = await createDiscoveryRun(matchingPool, {
      project,
      userId: "user-a",
      brief: storedBrief,
      profileId,
      expectedProfileVersion: 4,
      idempotencyKey: "profile-brief-match",
      startImmediately: false,
    });
    expect(created.replayed).toBe(false);
    expect(created.run).toMatchObject({
      profile_id: profileId,
      profile_version: 4,
      brief_snapshot: normalizedStoredBrief,
    });
    expect(JSON.parse(String(insertValues[13]))).toEqual(normalizedStoredBrief);
    expect(JSON.parse(String(insertValues[15]))).toMatchObject({
      version: 3,
      source_cursor_start: { [storedFingerprint]: 612 },
      source_cursor_next: { [storedFingerprint]: 612 },
      source_page_start: 0,
      source_page_next: 0,
    });
  });

  it("creates a campaign child from its captured brief/version/cursor without reading the mutable live profile", async () => {
    const profileId = "77777777-7777-4777-8777-777777777777";
    const normalizedBrief = previewDiscovery(brief).brief;
    const fingerprint = discoverySourceQueryFingerprint(
      normalizedBrief,
      normalizedBrief.industry_queries[0],
    );
    let insertValues: unknown[] = [];
    const { pool, sequence } = transactionPool((sql, values) => {
      if (sql.includes("AND r.idempotency_key = $3")) return { rows: [] };
      if (sql.includes("FROM leadgrid_discovery_profiles")) {
        throw new Error("trusted campaign snapshot must not read live profile");
      }
      if (sql.includes("INSERT INTO leadgrid_discovery_monthly_usage")) {
        return { rows: [{ reserved_candidates: 20 }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO leadgrid_discovery_runs")) {
        insertValues = values;
      }
      if (sql.includes("INSERT INTO background_jobs")) {
        return { rows: [{ id: JOB_ID }], rowCount: 1 };
      }
      if (sql.includes("UPDATE leadgrid_discovery_capacity_reservations")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("WHERE r.id = $3::uuid")) {
        return {
          rows: [
            runRow({
              id: String(insertValues[0]),
              profile_id: profileId,
              profile_version: 4,
              trigger_kind: "workflow",
              request_hash: String(insertValues[12]),
              brief_snapshot: normalizedBrief,
              search_plan: JSON.parse(String(insertValues[14])),
              checkpoint: JSON.parse(String(insertValues[15])),
              background_job_id: JOB_ID,
            }),
          ],
          rowCount: 1,
        };
      }
      return undefined;
    });

    const result = await createDiscoveryRun(pool, {
      project,
      userId: "user-a",
      brief: normalizedBrief,
      profileId,
      expectedProfileVersion: 4,
      trustedProfileSnapshot: {
        profileId,
        profileVersion: 4,
        sourceCursorMap: { [fingerprint]: 55 },
      },
      idempotencyKey: "campaign-child-snapshot",
      startImmediately: true,
      triggerKind: "workflow",
    });

    expect(result.run).toMatchObject({
      profile_id: profileId,
      profile_version: 4,
      brief_snapshot: normalizedBrief,
    });
    expect(JSON.parse(String(insertValues[15]))).toMatchObject({
      source_cursor_start: { [fingerprint]: 55 },
      source_cursor_next: { [fingerprint]: 55 },
    });
    expect(
      sequence.some((sql) => sql.includes("FROM leadgrid_discovery_profiles")),
    ).toBe(false);
  });

  it("cannot internally cancel a run outside the exact active campaign tuple", async () => {
    const { pool, sequence } = transactionPool((sql) => {
      if (
        sql.includes("JOIN leadgrid_discovery_campaign_runs c") &&
        sql.includes("c.active_run_id = r.id")
      ) {
        return { rows: [], rowCount: 0 };
      }
      return undefined;
    });

    await expect(
      cancelDiscoveryRunFromTrustedWorkflow(pool, {
        project,
        campaignId: "88888888-8888-4888-8888-888888888888",
        runId: RUN_ID,
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(sequence).toContain("ROLLBACK");
    expect(
      sequence.some((sql) => sql.includes("UPDATE leadgrid_discovery_runs")),
    ).toBe(false);
  });
  it("resets malformed legacy cursor-map entries instead of carrying them into a run", async () => {
    const profileId = "77777777-7777-4777-8777-777777777777";
    const normalizedBrief = previewDiscovery(brief).brief;
    const fingerprint = discoverySourceQueryFingerprint(
      normalizedBrief,
      normalizedBrief.industry_queries[0],
    );
    let insertValues: unknown[] = [];
    const { pool } = transactionPool((sql, values) => {
      if (sql.includes("AND r.idempotency_key = $3")) return { rows: [] };
      if (
        sql.includes("SELECT version, status, brief") &&
        sql.includes("FROM leadgrid_discovery_profiles")
      ) {
        return {
          rows: [
            {
              version: 4,
              status: "active",
              brief: normalizedBrief,
              source_cursor_map: {
                [fingerprint]: "not-an-offset",
                "not-a-sha256-fingerprint": 900,
                ["b".repeat(64)]: -1,
              },
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes("INSERT INTO leadgrid_discovery_runs")) {
        insertValues = values;
      }
      if (sql.includes("WHERE r.id = $3::uuid")) {
        return {
          rows: [
            runRow({
              id: String(insertValues[0]),
              profile_id: profileId,
              profile_version: 4,
              status: "awaiting_confirmation",
              brief_snapshot: normalizedBrief,
              checkpoint: JSON.parse(String(insertValues[15])),
            }),
          ],
          rowCount: 1,
        };
      }
      return undefined;
    });

    await expect(
      createDiscoveryRun(pool, {
        project,
        userId: "user-a",
        brief: normalizedBrief,
        profileId,
        expectedProfileVersion: 4,
        idempotencyKey: "malformed-profile-cursor-map",
        startImmediately: false,
      }),
    ).resolves.toMatchObject({ replayed: false });

    const checkpoint = JSON.parse(String(insertValues[15]));
    expect(checkpoint).toMatchObject({
      version: 3,
      source_cursor_start: { [fingerprint]: 0 },
      source_cursor_next: { [fingerprint]: 0 },
    });
    expect(checkpoint.source_cursor_start).not.toHaveProperty(
      "not-a-sha256-fingerprint",
    );
  });

  it("refuses a scheduled run when the profile was paused before transactional creation", async () => {
    const profileId = "77777777-7777-4777-8777-777777777777";
    const normalizedBrief = previewDiscovery(brief).brief;
    const { pool, sequence } = transactionPool((sql) => {
      if (sql.includes("AND r.idempotency_key = $3")) return { rows: [] };
      if (sql.includes("FROM leadgrid_discovery_profiles")) {
        return {
          rows: [
            {
              version: 4,
              status: "paused",
              brief: normalizedBrief,
              rotation_index: 2,
            },
          ],
          rowCount: 1,
        };
      }
      return undefined;
    });

    await expect(
      createDiscoveryRun(pool, {
        project,
        userId: "user-a",
        brief: normalizedBrief,
        profileId,
        expectedProfileVersion: 4,
        idempotencyKey: "paused-scheduled-profile",
        startImmediately: true,
        triggerKind: "scheduled",
      }),
    ).rejects.toMatchObject({ code: "invalid_state", field: "profile_id" });

    expect(sequence).toContain("ROLLBACK");
    expect(
      sequence.some((entry) =>
        entry.includes("INSERT INTO leadgrid_discovery_runs"),
      ),
    ).toBe(false);
  });

  it("refuses execution when the queue claim cannot fence the run", async () => {
    const leaseToken = "66666666-6666-4666-8666-666666666666";
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [runRow({ background_job_id: JOB_ID })],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(
      executeDiscoveryRun({ query } as unknown as Pool, RUN_ID, {
        executionLease: { jobId: JOB_ID, leaseToken },
        signal: new AbortController().signal,
        searchRegistry: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "run_already_executing", retryable: true });
    expect(query.mock.calls[1]?.[0]).toContain("j.lease_token = $3::uuid");
  });

  it("stops before candidate persistence when durable queue ownership is lost", async () => {
    const leaseToken = "66666666-6666-4666-8666-666666666666";
    let status = "queued";
    const { pool, sequence } = transactionPool((sql) => {
      if (
        sql.includes("JOIN background_jobs j") &&
        sql.includes("FOR SHARE OF r, j")
      ) {
        return { rows: [], rowCount: 0 };
      }
      if (
        sql.includes("FROM leadgrid_discovery_runs r") &&
        sql.includes("r.id = $1::uuid")
      ) {
        return {
          rows: [
            runRow({
              status,
              background_job_id: JOB_ID,
              execution_lease_token: leaseToken,
            }),
          ],
          rowCount: 1,
        };
      }
      if (sql.includes("SET execution_lease_token = $3::uuid")) {
        return {
          rows: [{ execution_lease_token: leaseToken }],
          rowCount: 1,
        };
      }
      if (sql.includes("SET status = 'searching'")) {
        status = "searching";
        return { rows: [], rowCount: 1 };
      }
      if (
        sql.includes("SELECT status") &&
        sql.includes("leadgrid_discovery_runs")
      ) {
        return { rows: [{ status }], rowCount: 1 };
      }
      if (sql.includes("SELECT COUNT(*)::int AS count")) {
        return { rows: [{ count: 0 }], rowCount: 1 };
      }
      return undefined;
    });
    const searchRegistry = vi.fn(async () => ({
      candidates: [registryCandidate()],
      sourcePageStart: 0,
      sourcePageNext: 1,
      sourcePageCount: 10,
      pagesFetched: 1,
      sourceResultsSeen: 1,
      duplicateResultsSkipped: 0,
      invalidResultsSkipped: 0,
      geoFilteredResults: 0,
      sourceLimitReached: false,
      hasMoreSourceResults: false,
      limitReason: null,
      externalRequests: 1,
      geocodeRequests: 1,
      geocodeMisses: 0,
      companyFilteredResults: 0,
      websiteAssessmentCandidates: 0,
      websiteAssessmentRequests: 0,
      resolution: "nace" as const,
      resolvedNaceCodes: ["69.201"],
      resolvedMunicipalities: [],
    }));

    await expect(
      executeDiscoveryRun(pool, RUN_ID, {
        executionLease: { jobId: JOB_ID, leaseToken },
        signal: new AbortController().signal,
        searchRegistry,
        emitProgress: vi.fn(),
      }),
    ).rejects.toMatchObject({
      code: "execution_lease_lost",
      retryable: true,
    });

    expect(searchRegistry).toHaveBeenCalledOnce();
    expect(sequence).toContain("ROLLBACK");
    expect(
      sequence.some((entry) =>
        entry.includes("INSERT INTO leadgrid_discovery_candidates"),
      ),
    ).toBe(false);
  });

  it("rolls back when an idempotency key is reused for different input", async () => {
    const { pool, sequence } = transactionPool((sql) => {
      if (sql.includes("AND r.idempotency_key = $3")) {
        return { rows: [runRow({ request_hash: "another-request" })] };
      }
      return undefined;
    });

    await expect(
      createDiscoveryRun(pool, {
        project,
        userId: "user-a",
        brief,
        idempotencyKey: "create-key-a",
        startImmediately: true,
      }),
    ).rejects.toMatchObject({ code: "idempotency_conflict", status: 409 });

    expect(sequence).toContain("ROLLBACK");
    expect(
      sequence.some((entry) => entry.includes("INSERT INTO background_jobs")),
    ).toBe(false);
  });

  it("does not cancel a partial run that is already in review state", async () => {
    const { pool, sequence } = transactionPool((sql) => {
      if (sql.includes("FOR UPDATE")) {
        return { rows: [runRow({ status: "partial" })] };
      }
      return undefined;
    });

    await expect(
      cancelDiscoveryRun(pool, {
        project,
        userId: "user-a",
        runId: RUN_ID,
      }),
    ).rejects.toMatchObject({ code: "invalid_state", status: 409 });

    expect(sequence).toContain("ROLLBACK");
    expect(
      sequence.some((entry) =>
        entry.includes("UPDATE leadgrid_discovery_runs"),
      ),
    ).toBe(false);
  });

  it("lists only project-scoped runs in a stable newest-first order", async () => {
    const query = vi.fn(async (queryValue: unknown, values: unknown[]) => ({
      rows: [runRow()],
      rowCount: 1,
      sql: textOf(queryValue),
      values,
    }));
    const result = await listDiscoveryRuns({ query } as unknown as Pool, {
      project,
      statuses: ["active", "review_ready"],
      limit: 12,
    });

    expect(result.runs).toHaveLength(1);
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("r.organization_id = $1::uuid");
    expect(sql).toContain("r.project_id = $2");
    expect(sql).toContain("ORDER BY r.created_at DESC, r.id DESC");
    expect(values[0]).toBe(ORGANIZATION_ID);
    expect(values[1]).toBe(project.id);
    expect(values[2]).toEqual(
      expect.arrayContaining(["queued", "searching", "review_ready"]),
    );
    expect(values[3]).toBe(12);
  });

  it("uses a tenant/run-scoped stable candidate cursor", async () => {
    const rows = [
      {
        id: CANDIDATE_ID,
        run_id: RUN_ID,
        name: "Trygg Regnskap AS",
        address: null,
        city: "Oslo",
        postal_code: null,
        country_code: "NO",
        latitude: null,
        longitude: null,
        website_url: null,
        phone: null,
        email: null,
        source_uri:
          "https://data.brreg.no/enhetsregisteret/api/enheter/999888777",
        organization_number: "999888777",
        organization_form: "Aksjeselskap",
        nace_code: "69.201",
        nace_description: "Regnskap og bokføring",
        employee_count: 12,
        registered_in_vat_register: true,
        status: "review_ready",
        research_status: "completed",
        disposition: "review_ready",
        fit_score: 82,
        fit_coverage: "0.9000",
        data_quality_score: 70,
        data_quality_coverage: "0.7500",
        excluded: false,
        exclusion_matches: [],
        score_explanation: {},
        reasons: ["Bransje samsvarer"],
        evidence: [],
        existing_lead_id: null,
        imported_lead_id: null,
        created_at: "2026-08-30T10:00:00.000Z",
        updated_at: "2026-08-30T10:00:00.000Z",
        cursor_sort_value: 82,
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        run_id: RUN_ID,
        name: "Cursor Sentinel",
        cursor_sort_value: 70,
      },
    ];
    const query = vi.fn(async (_queryValue: unknown, _values: unknown[]) => ({
      rows,
      rowCount: rows.length,
    }));
    const first = await listDiscoveryCandidates({ query } as unknown as Pool, {
      project,
      runId: RUN_ID,
      disposition: "pending",
      sort: "score_desc",
      limit: 1,
    });

    expect(first.items).toHaveLength(1);
    expect(first.items[0]).toMatchObject({
      source: "brreg_open_data",
      organization_number: "999888777",
      nace_code: "69.201",
      reasons: ["Bransje samsvarer"],
    });
    expect(first.items[0]).not.toHaveProperty("google_place_id");
    expect(first.items[0].sources.map((source) => source.id)).toEqual([
      "brreg",
      "ssb_klass",
      "kartverket_geonorge",
    ]);
    expect(first.next_cursor).toBeTruthy();
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("r.organization_id = $1::uuid");
    expect(sql).toContain("r.project_id = $2");
    expect(sql).toContain("r.id = $3::uuid");
    expect(sql).toContain("rc.fit_score::double precision DESC NULLS LAST");
    expect(values.slice(0, 3)).toEqual([ORGANIZATION_ID, project.id, RUN_ID]);
    expect(values.at(-1)).toBe(2);
  });

  it("promotes exactly one CRM lead and broadcasts only after commit", async () => {
    const sequence: string[] = [];
    const emit = vi
      .spyOn(leadgridRealtime, "emit")
      .mockImplementation((event) => {
        sequence.push(`EVENT ${event.type} ${event.channel}`);
      });
    const { pool, query } = transactionPool((sql) => {
      if (sql.includes("SELECT c.id::text AS candidate_id")) {
        return {
          rows: [
            {
              ...decisionCandidate(),
              organization_number: "999 888 777",
              enrichment_data: {
                found: true,
                source: "brreg",
                fetchedAt: "2026-08-30T09:00:00.000Z",
                autoLinked: true,
                company: { name: "Trygg Regnskap AS", orgNr: "999888777" },
              },
            },
          ],
        };
      }
      if (sql.includes("FROM leadgrid_discovery_feedback")) {
        return { rows: [] };
      }
      if (sql.includes("FROM crm_customers")) return { rows: [] };
      if (sql.includes("INSERT INTO crm_customers")) {
        return { rows: [{ id: LEAD_ID }], rowCount: 1 };
      }
      return undefined;
    }, sequence);

    const result = await decideDiscoveryCandidate(pool, {
      project,
      userId: "user-a",
      runId: RUN_ID,
      candidateId: CANDIDATE_ID,
      idempotencyKey: "approve-key-a",
      decision: { decision: "approve", reason_code: "good_fit" },
    });

    expect(result).toMatchObject({
      decision: "approve",
      lead_id: LEAD_ID,
      candidate_status: "imported",
      replayed: false,
    });
    expect(
      sequence.filter((entry) => entry.includes("INSERT INTO crm_customers")),
    ).toHaveLength(1);
    const promotionCall = query.mock.calls.find(([queryValue]) =>
      textOf(queryValue).includes("INSERT INTO crm_customers"),
    );
    expect(textOf(promotionCall?.[0])).toContain(
      "enrichment_org_nr, enrichment_data, enriched_at",
    );
    expect(promotionCall?.[1]?.[10]).toBe("999888777");
    expect(JSON.parse(String(promotionCall?.[1]?.[11]))).toMatchObject({
      source: "brreg",
      autoLinked: true,
    });
    expect(promotionCall?.[1]?.[12]).toBe("2026-08-30T09:00:00.000Z");
    expect(sequence.indexOf("COMMIT")).toBeLessThan(
      sequence.findIndex((entry) => entry.startsWith("EVENT")),
    );
    expect(emit.mock.calls.map(([event]) => event.type)).toEqual([
      "discovery.run.updated",
      "discovery.run.updated",
      "lead.created",
      "lead.created",
    ]);
    expect(
      sequence.some(
        (entry) =>
          entry.includes("UPDATE leadgrid_discovery_run_candidates") &&
          entry.includes("candidate_id = $1::uuid") &&
          entry.includes("organization_id = $3::uuid") &&
          entry.includes("project_id = $4") &&
          entry.includes("RETURNING run_id::text"),
      ),
    ).toBe(true);
    expect(
      sequence.some((entry) => entry.includes("FOR UPDATE OF r, c, rc")),
    ).toBe(true);
  });

  it("rejects atomically without creating a CRM lead", async () => {
    const sequence: string[] = [];
    const emit = vi.spyOn(leadgridRealtime, "emit");
    const { pool, query } = transactionPool((sql) => {
      if (sql.includes("SELECT c.id::text AS candidate_id")) {
        return { rows: [decisionCandidate()] };
      }
      if (sql.includes("FROM leadgrid_discovery_feedback")) {
        return { rows: [] };
      }
      if (
        sql.includes("UPDATE leadgrid_discovery_runs r") &&
        sql.includes("SET status = 'completed'")
      ) {
        return { rows: [{ id: RUN_ID }], rowCount: 1 };
      }
      return undefined;
    }, sequence);

    const result = await decideDiscoveryCandidate(pool, {
      project,
      userId: "user-a",
      runId: RUN_ID,
      candidateId: CANDIDATE_ID,
      idempotencyKey: "reject-key-a",
      decision: {
        decision: "reject",
        reason_code: "wrong_customer_type",
      },
    });

    expect(result).toMatchObject({
      decision: "reject",
      lead_id: null,
      candidate_status: "review_ready",
    });
    expect(
      sequence.some((entry) => entry.includes("INSERT INTO crm_customers")),
    ).toBe(false);
    const rejectionPropagation = query.mock.calls.find(([queryValue]) => {
      const sql = textOf(queryValue);
      return (
        sql.includes("UPDATE leadgrid_discovery_run_candidates") &&
        sql.includes("SET disposition = 'rejected'")
      );
    });
    expect(textOf(rejectionPropagation?.[0])).toContain(
      "AND run_id = $4::uuid",
    );
    expect(textOf(rejectionPropagation?.[0])).not.toContain(
      "occurrence_run.profile_id",
    );
    expect(rejectionPropagation?.[1]).toEqual([
      CANDIDATE_ID,
      ORGANIZATION_ID,
      project.id,
      RUN_ID,
    ]);
    expect(sequence.at(-1)).toBe("COMMIT");
    expect(
      emit.mock.calls
        .map(([event]) => event)
        .filter((event) => event.type === "discovery.run.updated")
        .every(
          (event) =>
            (event.data as Record<string, unknown>).status === "completed",
        ),
    ).toBe(true);
    expect(
      sequence.some(
        (entry) =>
          entry.includes("r.organization_id = $2::uuid") &&
          entry.includes("r.project_id = $3") &&
          entry.includes("NOT EXISTS"),
      ),
    ).toBe(true);
  });

  it("persists only an explicitly confirmed Place ID with territory provenance", async () => {
    const { pool, query } = transactionPool((sql) => {
      if (sql.includes("SELECT c.id::text AS candidate_id")) {
        return {
          rows: [
            {
              ...decisionCandidate(),
              profile_id: "44444444-4444-4444-8444-444444444444",
              profile_version: 3,
              brief_snapshot: {
                territory_code: "vest",
                municipality_numbers: ["3201", "3203"],
                municipality_names: ["BÆRUM", "ASKER"],
              },
              source_hits: [
                {
                  run_id: RUN_ID,
                  profile_id: "44444444-4444-4444-8444-444444444444",
                  territory_code: "vest",
                },
              ],
              provenance: [
                {
                  source: "brreg_open_data",
                  profile_id: "44444444-4444-4444-8444-444444444444",
                  territory_code: "vest",
                },
              ],
            },
          ],
        };
      }
      if (sql.includes("FROM leadgrid_discovery_feedback")) {
        return { rows: [] };
      }
      if (
        sql.includes("FROM leadgrid_discovery_place_confirmations") &&
        sql.includes("FOR UPDATE")
      ) {
        return {
          rows: [{ place_id: "ChIJ-confirmed-place-id" }],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE leadgrid_discovery_place_confirmations")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("FROM crm_customers")) return { rows: [] };
      if (sql.includes("INSERT INTO crm_customers")) {
        return { rows: [{ id: LEAD_ID }], rowCount: 1 };
      }
      return undefined;
    });

    await decideDiscoveryCandidate(pool, {
      project,
      userId: "user-a",
      runId: RUN_ID,
      candidateId: CANDIDATE_ID,
      idempotencyKey: "confirmed-place-promotion-0001",
      decision: {
        decision: "approve",
        reason_code: "good_fit",
        confirmed_google_place_id: "ChIJ-confirmed-place-id",
      },
    });

    const confirmationLookup = query.mock.calls.find(([queryValue]) =>
      textOf(queryValue).includes(
        "FROM leadgrid_discovery_place_confirmations",
      ),
    );
    expect(textOf(confirmationLookup?.[0])).toContain("requested_by = $6");
    expect(textOf(confirmationLookup?.[0])).toContain("consumed_at IS NULL");
    expect(textOf(confirmationLookup?.[0])).toContain("expires_at > NOW()");
    expect(confirmationLookup?.[1]).toEqual([
      ORGANIZATION_ID,
      project.id,
      RUN_ID,
      CANDIDATE_ID,
      "ChIJ-confirmed-place-id",
      "user-a",
    ]);

    const crmLookup = query.mock.calls.find(([queryValue]) =>
      textOf(queryValue).includes("FROM crm_customers"),
    );
    expect(textOf(crmLookup?.[0])).toContain("website_domain_normalized = $4");
    expect(textOf(crmLookup?.[0])).toContain("google_place_id = $5");
    expect(crmLookup?.[1]).toEqual([
      ORGANIZATION_ID,
      project.id,
      "999888777",
      "tryggregnskap.no",
      "ChIJ-confirmed-place-id",
    ]);
    const insert = query.mock.calls.find(([queryValue]) =>
      textOf(queryValue).includes("INSERT INTO crm_customers"),
    );
    expect(textOf(insert?.[0])).toContain("google_place_id_confirmed_at");
    expect(textOf(insert?.[0])).toContain("discovery_territory_code");
    expect(insert?.[1]?.[13]).toBe("ChIJ-confirmed-place-id");
    expect(Number.isNaN(Date.parse(String(insert?.[1]?.[14])))).toBe(false);
    expect(insert?.[1]?.[15]).toBe("vest");
    expect(JSON.parse(String(insert?.[1]?.[19]))).toMatchObject({
      discovery: {
        profile_id: "44444444-4444-4444-8444-444444444444",
        profile_version: 3,
        territory_code: "vest",
        municipality_numbers: ["3201", "3203"],
        dedupe_checks: {
          organization_number: "checked",
          normalized_domain: "checked",
          google_place_id: "confirmed_match_checked",
        },
        google_places: {
          place_id: "ChIJ-confirmed-place-id",
          persisted_fields: ["place_id"],
        },
      },
    });
    const promotionLocks = query.mock.calls
      .filter(
        ([queryValue, values]) =>
          textOf(queryValue).includes("pg_advisory_xact_lock") &&
          String(values?.[0]).startsWith(`leadgrid:${ORGANIZATION_ID}:`),
      )
      .map(([, values]) => String(values?.[0]));
    expect(promotionLocks).toEqual([
      `leadgrid:${ORGANIZATION_ID}:google_place_id:ChIJ-confirmed-place-id`,
      `leadgrid:${ORGANIZATION_ID}:organization_number:999888777`,
      `leadgrid:${ORGANIZATION_ID}:website_domain:tryggregnskap.no`,
    ]);
    expect(
      query.mock.calls.some(([queryValue]) =>
        textOf(queryValue).includes(
          "UPDATE leadgrid_discovery_place_confirmations",
        ),
      ),
    ).toBe(true);
  });

  it("rejects a syntactically valid but unattested Place ID before CRM promotion", async () => {
    const { pool, sequence } = transactionPool((sql) => {
      if (sql.includes("SELECT c.id::text AS candidate_id")) {
        return { rows: [decisionCandidate()] };
      }
      if (sql.includes("FROM leadgrid_discovery_feedback")) {
        return { rows: [] };
      }
      if (sql.includes("FROM leadgrid_discovery_place_confirmations")) {
        return { rows: [], rowCount: 0 };
      }
      return undefined;
    });

    await expect(
      decideDiscoveryCandidate(pool, {
        project,
        userId: "user-a",
        runId: RUN_ID,
        candidateId: CANDIDATE_ID,
        idempotencyKey: "forged-place-promotion-0001",
        decision: {
          decision: "approve",
          confirmed_google_place_id: "ChIJ-forged-but-valid",
        },
      }),
    ).rejects.toMatchObject({ code: "place_confirmation_required" });

    expect(
      sequence.some((entry) => entry.includes("INSERT INTO crm_customers")),
    ).toBe(false);
    expect(sequence.at(-1)).toBe("ROLLBACK");
  });

  it("propagates rejection only across the same saved profile snapshot", async () => {
    const otherRunId = "66666666-6666-4666-8666-666666666666";
    const profileId = "77777777-7777-4777-8777-777777777777";
    const profileBrief = previewDiscovery({
      ...brief,
      territory_code: "oslo",
    }).brief;
    const emit = vi
      .spyOn(leadgridRealtime, "emit")
      .mockImplementation(() => {});
    const { pool, query } = transactionPool((sql) => {
      if (sql.includes("SELECT c.id::text AS candidate_id")) {
        return {
          rows: [
            {
              ...decisionCandidate(),
              profile_id: profileId,
              profile_version: 2,
              brief_snapshot: profileBrief,
            },
          ],
        };
      }
      if (sql.includes("FROM leadgrid_discovery_feedback")) {
        return { rows: [] };
      }
      if (
        sql.includes("UPDATE leadgrid_discovery_run_candidates") &&
        sql.includes("RETURNING rc.run_id::text")
      ) {
        return {
          rows: [{ run_id: RUN_ID }, { run_id: otherRunId }],
          rowCount: 2,
        };
      }
      if (
        sql.includes("UPDATE leadgrid_discovery_runs r") &&
        sql.includes("SET status = 'completed'")
      ) {
        return {
          rows: [{ id: RUN_ID }, { id: otherRunId }],
          rowCount: 2,
        };
      }
      return undefined;
    });

    await decideDiscoveryCandidate(pool, {
      project,
      userId: "user-a",
      runId: RUN_ID,
      candidateId: CANDIDATE_ID,
      idempotencyKey: "overlap-reject-key",
      decision: { decision: "reject", reason_code: "not_relevant" },
    });

    const propagation = query.mock.calls.find(([queryValue]) => {
      const sql = textOf(queryValue);
      return (
        sql.includes("UPDATE leadgrid_discovery_run_candidates") &&
        sql.includes("RETURNING rc.run_id::text")
      );
    });
    expect(textOf(propagation?.[0])).toContain(
      "'researching', 'review_ready', 'failed'",
    );
    expect(textOf(propagation?.[0])).toContain(
      "occurrence_run.profile_id = $5::uuid",
    );
    expect(textOf(propagation?.[0])).toContain(
      "occurrence_run.brief_snapshot = $6::jsonb",
    );
    expect(propagation?.[1]).toEqual([
      CANDIDATE_ID,
      ORGANIZATION_ID,
      project.id,
      RUN_ID,
      profileId,
      JSON.stringify(profileBrief),
    ]);
    expect(
      query.mock.calls.some(([queryValue]) =>
        textOf(queryValue).includes("SET status = 'rejected'"),
      ),
    ).toBe(false);
    const refreshedRunIds = query.mock.calls
      .filter(([queryValue]) =>
        textOf(queryValue).includes(
          "SET candidate_count = counts.candidate_count",
        ),
      )
      .map(([, values]) => values?.[0]);
    expect(refreshedRunIds).toEqual([RUN_ID, otherRunId]);
    const completion = query.mock.calls.find(([queryValue]) =>
      textOf(queryValue).includes("r.id = ANY($1::uuid[])"),
    );
    expect(completion?.[1]?.[0]).toEqual([RUN_ID, otherRunId]);
    const feedbackInsert = query.mock.calls.filter(([queryValue]) =>
      textOf(queryValue).includes("INSERT INTO leadgrid_discovery_feedback"),
    );
    expect(feedbackInsert).toHaveLength(1);
    expect(feedbackInsert[0]?.[1]?.[4]).toBe(RUN_ID);
    expect(feedbackInsert[0]?.[1]?.[10]).toBe("overlap-reject-key");
    const runEvents = emit.mock.calls
      .map(([event]) => event)
      .filter((event) => event.type === "discovery.run.updated");
    expect(runEvents).toHaveLength(4);
    expect(new Set(runEvents.map((event) => event.data.run_id))).toEqual(
      new Set([RUN_ID, otherRunId]),
    );
  });

  it("deduplicates approval by safely linked Brreg organization number", async () => {
    const { pool, sequence, query } = transactionPool((sql) => {
      if (sql.includes("SELECT c.id::text AS candidate_id")) {
        return {
          rows: [
            {
              ...decisionCandidate(),
              organization_number: "999888777",
              enrichment_data: {
                found: true,
                source: "brreg",
                fetchedAt: "2026-08-30T09:00:00.000Z",
                autoLinked: true,
                company: { name: "Trygg Regnskap AS", orgNr: "999888777" },
              },
            },
          ],
        };
      }
      if (sql.includes("FROM leadgrid_discovery_feedback")) {
        return { rows: [] };
      }
      if (sql.includes("FROM crm_customers")) {
        return {
          rows: [{ id: LEAD_ID, google_place_id: null }],
          rowCount: 1,
        };
      }
      return undefined;
    });

    const result = await decideDiscoveryCandidate(pool, {
      project,
      userId: "user-a",
      runId: RUN_ID,
      candidateId: CANDIDATE_ID,
      idempotencyKey: "approve-orgnr-dedupe-key",
      decision: { decision: "approve", reason_code: "good_fit" },
    });

    expect(result).toMatchObject({
      decision: "approve",
      lead_id: LEAD_ID,
      candidate_status: "imported",
    });
    expect(
      sequence.some((entry) => entry.includes("INSERT INTO crm_customers")),
    ).toBe(false);
    const crmLookup = query.mock.calls.find(([queryValue]) =>
      textOf(queryValue).includes("FROM crm_customers"),
    );
    expect(textOf(crmLookup?.[0])).toContain("enrichment_org_nr = $3");
    expect(textOf(crmLookup?.[0])).toContain("website_domain_normalized = $4");
    expect(textOf(crmLookup?.[0])).toContain("google_place_id = $5");
    expect(crmLookup?.[1]).toEqual([
      ORGANIZATION_ID,
      project.id,
      "999888777",
      "tryggregnskap.no",
      null,
    ]);
    expect(
      query.mock.calls.some(
        ([queryValue, values]) =>
          textOf(queryValue).includes("pg_advisory_xact_lock") &&
          values?.[0] ===
            `leadgrid:${ORGANIZATION_ID}:organization_number:999888777`,
      ),
    ).toBe(true);
  });

  it("replays a committed decision even after the run became completed", async () => {
    const decision = {
      decision: "approve" as const,
      reason_code: "good_fit" as const,
    };
    const requestHash = discoveryHash({
      run_id: RUN_ID,
      candidate_id: CANDIDATE_ID,
      decision,
    });
    const { pool, sequence } = transactionPool((sql) => {
      if (sql.includes("SELECT c.id::text AS candidate_id")) {
        return {
          rows: [
            {
              ...decisionCandidate(),
              run_status: "completed",
              candidate_status: "imported",
              disposition: "imported",
              imported_lead_id: LEAD_ID,
            },
          ],
        };
      }
      if (sql.includes("FROM leadgrid_discovery_feedback")) {
        return {
          rows: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              request_hash: requestHash,
              lead_id: LEAD_ID,
              value: "approve",
            },
          ],
        };
      }
      return undefined;
    });

    const result = await decideDiscoveryCandidate(pool, {
      project,
      userId: "user-a",
      runId: RUN_ID,
      candidateId: CANDIDATE_ID,
      idempotencyKey: "approve-replay-key",
      decision,
    });

    expect(result).toMatchObject({
      replayed: true,
      lead_id: LEAD_ID,
      candidate_status: "imported",
    });
    expect(
      sequence.some((entry) => entry.includes("INSERT INTO crm_customers")),
    ).toBe(false);
    expect(sequence.at(-1)).toBe("COMMIT");
  });

  it("executes search and bounded top-N enrichment without pre-approving CRM", async () => {
    let status = "queued";
    let reviewReadyCount = 0;
    const executionProfileId = "77777777-7777-4777-8777-777777777777";
    const multiQueryBrief = {
      ...brief,
      industry_queries: ["regnskapsfører", "revisjonsfirma"],
      website_quality: { minimum_score: 65 },
    };
    const normalizedMultiQueryBrief = previewDiscovery(multiQueryBrief).brief;
    const queryFingerprints = normalizedMultiQueryBrief.industry_queries.map(
      (queryText) =>
        discoverySourceQueryFingerprint(normalizedMultiQueryBrief, queryText),
    );
    const sourceCursorStart = {
      [queryFingerprints[0]]: 120,
      [queryFingerprints[1]]: 240,
    };
    const sequence: string[] = [];
    const { pool, query } = transactionPool((sql, values) => {
      if (
        sql.includes("FROM leadgrid_discovery_runs r") &&
        sql.includes("r.id = $1::uuid")
      ) {
        return {
          rows: [
            runRow({
              status,
              profile_id: executionProfileId,
              profile_version: 9,
              candidate_count: 1,
              review_ready_count: reviewReadyCount,
              brief_snapshot: normalizedMultiQueryBrief,
              checkpoint: {
                version: 3,
                source_cursor_start: sourceCursorStart,
                source_cursor_next: sourceCursorStart,
                source_page_start: 0,
                source_page_next: 0,
                completed_queries: [],
                query_errors: [],
                query_results: {},
              },
            }),
          ],
        };
      }
      if (
        sql.includes("SELECT status") &&
        sql.includes("leadgrid_discovery_runs")
      ) {
        return { rows: [{ status }] };
      }
      if (sql.includes("SELECT COUNT(*)::int AS count")) {
        return { rows: [{ count: 1 }] };
      }
      if (sql.includes("SET status = 'searching'")) {
        status = "searching";
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SET status = 'researching'")) {
        status = "researching";
        return { rows: [], rowCount: 1 };
      }
      if (
        sql.includes("UPDATE leadgrid_discovery_run_candidates rc") &&
        sql.includes("SET disposition = 'review_ready'")
      ) {
        reviewReadyCount = 1;
      }
      if (sql.includes("SET status = $2") && values[0] === RUN_ID) {
        status = String(values[1]);
        return { rows: [], rowCount: 1 };
      }
      return undefined;
    }, sequence);
    let searchCall = 0;
    const searchRegistry = vi.fn(
      async (_input: DiscoveryRegistrySearchInput) => {
        const callIndex = searchCall++;
        const sourceOffset = _input.sourceOffset ?? 0;
        const consumed = callIndex === 0 ? 20 : 40;
        return {
          candidates: [],
          sourceOffsetStart: sourceOffset,
          sourceOffsetNext: sourceOffset + consumed,
          sourcePageStart: Math.floor(sourceOffset / 100),
          sourcePageNext: Math.floor((sourceOffset + consumed) / 100),
          sourcePageCount: 10,
          pagesFetched: 1,
          sourceResultsSeen: consumed,
          duplicateResultsSkipped: 0,
          invalidResultsSkipped: 0,
          geoFilteredResults: 0,
          sourceLimitReached: false,
          hasMoreSourceResults: false,
          limitReason: null,
          externalRequests: 1,
          geocodeRequests: 0,
          geocodeMisses: 0,
          companyFilteredResults: 0,
          // An upstream adapter may over-report; the service still clamps the
          // durable usage to the profile's enrichment_count.
          websiteAssessmentCandidates: callIndex === 0 ? 10 : 0,
          websiteAssessmentRequests: 0,
          resolution: "nace" as const,
          resolvedNaceCodes: ["69.201"],
          resolvedMunicipalities: [],
        };
      },
    );
    const events: Array<{ data: Record<string, unknown> }> = [];

    const result = await executeDiscoveryRun(pool, RUN_ID, {
      searchRegistry,
      emitProgress: (event) => events.push(event),
    });

    expect(searchRegistry).toHaveBeenCalledTimes(2);
    expect(
      searchRegistry.mock.calls.map(([input]) => input.maxResults),
    ).toEqual([10, 19]);
    expect(
      searchRegistry.mock.calls.map(([input]) => input.sourceOffset),
    ).toEqual([120, 240]);
    expect(
      searchRegistry.mock.calls.map(([input]) => input.websiteAssessmentLimit),
    ).toEqual([5, 0]);
    const providerUsageWrites = query.mock.calls.filter(([queryValue]) =>
      textOf(queryValue).includes("provider_usage = $5::jsonb"),
    );
    expect(providerUsageWrites.length).toBeGreaterThan(0);
    expect(
      JSON.parse(String(providerUsageWrites.at(-1)?.[1]?.[4])),
    ).toMatchObject({
      source_cursor_start: sourceCursorStart,
      source_cursor_next: {
        [queryFingerprints[0]]: 140,
        [queryFingerprints[1]]: 280,
      },
      source_page_start: 2,
      source_page_next: 2,
      website_assessment_candidates: 5,
      website_assessment_requests: 0,
    });
    const cursorWrite = query.mock.calls.find(([queryValue]) =>
      textOf(queryValue).includes("SET source_cursor_map ="),
    );
    expect(cursorWrite?.[1]?.slice(0, 4)).toEqual([
      ORGANIZATION_ID,
      project.id,
      executionProfileId,
      9,
    ]);
    expect(JSON.parse(String(cursorWrite?.[1]?.[4]))).toEqual({
      [queryFingerprints[0]]: 140,
      [queryFingerprints[1]]: 280,
    });
    expect(JSON.parse(String(cursorWrite?.[1]?.[5]))).toEqual(
      sourceCursorStart,
    );
    expect(textOf(cursorWrite?.[0])).toContain("jsonb_each_text($6::jsonb)");
    expect(textOf(cursorWrite?.[0])).toContain(
      "profile.source_cursor_map -> expected.key",
    );
    expect(textOf(cursorWrite?.[0])).not.toContain(
      "profile.source_cursor_map ->> expected.key",
    );
    expect(
      searchRegistry.mock.calls.every(
        ([input]) => input.queryMode === "industry",
      ),
    ).toBe(true);
    expect(result).toMatchObject({
      run_id: RUN_ID,
      status: "review_ready",
      candidate_count: 1,
    });
    expect(
      sequence.some((entry) => entry.includes("INSERT INTO crm_customers")),
    ).toBe(false);
    expect(sequence.some((entry) => entry.includes("google_place_id"))).toBe(
      false,
    );
    expect(events.some((event) => event.data.status === "review_ready")).toBe(
      true,
    );
  });

  it("resumes only the unfinished v3 query from its immutable absolute offset", async () => {
    let status = "researching";
    const executionProfileId = "77777777-7777-4777-8777-777777777777";
    const normalizedBrief = previewDiscovery({
      ...brief,
      industry_queries: ["regnskapsfører", "revisjonsfirma"],
    }).brief;
    const fingerprints = normalizedBrief.industry_queries.map((queryText) =>
      discoverySourceQueryFingerprint(normalizedBrief, queryText),
    );
    const checkpoint = {
      version: 3,
      source_cursor_start: {
        [fingerprints[0]]: 120,
        [fingerprints[1]]: 245,
      },
      source_cursor_next: {
        [fingerprints[0]]: 140,
        [fingerprints[1]]: 245,
      },
      source_page_start: 1,
      source_page_next: 1,
      completed_queries: [0],
      query_errors: [],
      query_results: {
        "0": {
          query_fingerprint: fingerprints[0],
          raw: 20,
          source_offset_start: 120,
          source_offset_next: 140,
          source_page_start: 1,
          source_page_next: 1,
          source_page_count: 10,
          duplicates: 0,
          invalid: 0,
          geo_filtered: 0,
          company_filtered: 0,
          website_assessment_candidates: 0,
          website_assessment_requests: 0,
          pages: 1,
          external_requests: 1,
          geocodes: 0,
          geocode_misses: 0,
          source_limit_reached: false,
          limit_reason: null,
          resolved_nace_codes: ["69.201"],
          resolved_municipalities: [],
        },
      },
    };
    const { pool, query } = transactionPool((sql, values) => {
      if (
        sql.includes("FROM leadgrid_discovery_runs r") &&
        sql.includes("r.id = $1::uuid")
      ) {
        return {
          rows: [
            runRow({
              status,
              profile_id: executionProfileId,
              profile_version: 9,
              brief_snapshot: normalizedBrief,
              checkpoint,
            }),
          ],
        };
      }
      if (
        sql.includes("SELECT status") &&
        sql.includes("leadgrid_discovery_runs")
      ) {
        return { rows: [{ status }] };
      }
      if (sql.includes("SELECT COUNT(*)::int AS count")) {
        return { rows: [{ count: 0 }] };
      }
      if (sql.includes("SET status = $2") && values[0] === RUN_ID) {
        status = String(values[1]);
        return { rows: [], rowCount: 1 };
      }
      return undefined;
    });
    const searchRegistry = vi.fn(
      async (input: DiscoveryRegistrySearchInput) => ({
        candidates: [],
        sourceOffsetStart: input.sourceOffset ?? 0,
        sourceOffsetNext: (input.sourceOffset ?? 0) + 3,
        sourcePageStart: 2,
        sourcePageNext: 2,
        sourcePageCount: 10,
        pagesFetched: 1,
        sourceResultsSeen: 3,
        duplicateResultsSkipped: 0,
        invalidResultsSkipped: 0,
        geoFilteredResults: 0,
        companyFilteredResults: 0,
        websiteAssessmentCandidates: 0,
        websiteAssessmentRequests: 0,
        sourceLimitReached: false,
        hasMoreSourceResults: true,
        limitReason: null,
        externalRequests: 1,
        geocodeRequests: 0,
        geocodeMisses: 0,
        resolution: "nace" as const,
        resolvedNaceCodes: ["69.201"],
        resolvedMunicipalities: [],
      }),
    );

    await expect(
      executeDiscoveryRun(pool, RUN_ID, { searchRegistry }),
    ).resolves.toMatchObject({ status: "completed" });

    expect(searchRegistry).toHaveBeenCalledOnce();
    expect(searchRegistry.mock.calls[0]?.[0]).toMatchObject({
      query: "revisjonsfirma",
      sourceOffset: 245,
    });
    const checkpointWrite = query.mock.calls.find(([queryValue]) =>
      textOf(queryValue).includes("SET checkpoint = $2::jsonb"),
    );
    const persistedCheckpoint = JSON.parse(String(checkpointWrite?.[1]?.[1]));
    expect(persistedCheckpoint).toMatchObject({
      source_cursor_start: {
        [fingerprints[0]]: 120,
        [fingerprints[1]]: 245,
      },
      source_cursor_next: {
        [fingerprints[0]]: 140,
        [fingerprints[1]]: 248,
      },
      completed_queries: [0, 1],
    });
  });

  it("safely restarts every query from zero for a legacy v2 checkpoint", async () => {
    let status = "researching";
    const executionProfileId = "77777777-7777-4777-8777-777777777777";
    const multiQueryBrief = {
      ...brief,
      industry_queries: ["regnskapsfører", "revisjonsfirma"],
    };
    const normalizedMultiQueryBrief = previewDiscovery(multiQueryBrief).brief;
    const queryFingerprints = normalizedMultiQueryBrief.industry_queries.map(
      (queryText) =>
        discoverySourceQueryFingerprint(normalizedMultiQueryBrief, queryText),
    );
    const { pool, query } = transactionPool((sql, values) => {
      if (
        sql.includes("FROM leadgrid_discovery_runs r") &&
        sql.includes("r.id = $1::uuid")
      ) {
        return {
          rows: [
            runRow({
              status,
              profile_id: executionProfileId,
              profile_version: 9,
              brief_snapshot: normalizedMultiQueryBrief,
              checkpoint: {
                version: 2,
                source_page_start: 5,
                source_page_next: 6,
                completed_queries: [0],
                query_errors: [],
                query_results: {
                  "0": {
                    raw: 1,
                    source_page_start: 5,
                    source_page_next: 6,
                    source_page_count: 10,
                    duplicates: 0,
                    invalid: 0,
                    geo_filtered: 0,
                    company_filtered: 0,
                    website_assessment_candidates: 0,
                    website_assessment_requests: 0,
                    pages: 1,
                    external_requests: 1,
                    geocodes: 0,
                    geocode_misses: 0,
                    source_limit_reached: false,
                    limit_reason: null,
                    resolved_nace_codes: ["69.201"],
                    resolved_municipalities: [],
                  },
                },
              },
            }),
          ],
        };
      }
      if (
        sql.includes("SELECT status") &&
        sql.includes("leadgrid_discovery_runs")
      ) {
        return { rows: [{ status }] };
      }
      if (sql.includes("SELECT COUNT(*)::int AS count")) {
        return { rows: [{ count: 0 }] };
      }
      if (sql.includes("SET status = $2") && values[0] === RUN_ID) {
        status = String(values[1]);
        return { rows: [], rowCount: 1 };
      }
      return undefined;
    });
    const searchRegistry = vi.fn(
      async (input: DiscoveryRegistrySearchInput) => ({
        candidates: [],
        sourceOffsetStart: input.sourceOffset ?? 0,
        sourceOffsetNext: (input.sourceOffset ?? 0) + 1,
        sourcePageStart: 0,
        sourcePageNext: 0,
        sourcePageCount: 10,
        pagesFetched: 1,
        sourceResultsSeen: 0,
        duplicateResultsSkipped: 0,
        invalidResultsSkipped: 0,
        geoFilteredResults: 0,
        companyFilteredResults: 0,
        websiteAssessmentCandidates: 0,
        websiteAssessmentRequests: 0,
        sourceLimitReached: false,
        hasMoreSourceResults: true,
        limitReason: null,
        externalRequests: 1,
        geocodeRequests: 0,
        geocodeMisses: 0,
        resolution: "nace" as const,
        resolvedNaceCodes: ["69.201"],
        resolvedMunicipalities: [],
      }),
    );

    await expect(
      executeDiscoveryRun(pool, RUN_ID, { searchRegistry }),
    ).resolves.toMatchObject({ status: "completed" });

    expect(searchRegistry).toHaveBeenCalledTimes(2);
    expect(searchRegistry.mock.calls.map(([input]) => input.query)).toEqual([
      "regnskapsfører",
      "revisjonsfirma",
    ]);
    expect(
      searchRegistry.mock.calls.map(([input]) => input.sourceOffset),
    ).toEqual([0, 0]);
    const cursorWrite = query.mock.calls.find(([queryValue]) =>
      textOf(queryValue).includes("SET source_cursor_map ="),
    );
    expect(JSON.parse(String(cursorWrite?.[1]?.[4]))).toEqual({
      [queryFingerprints[0]]: 1,
      [queryFingerprints[1]]: 1,
    });
    expect(JSON.parse(String(cursorWrite?.[1]?.[5]))).toEqual({
      [queryFingerprints[0]]: 0,
      [queryFingerprints[1]]: 0,
    });
  });

  it("does not advance the profile cursor when execution fails", async () => {
    let status = "researching";
    const executionProfileId = "77777777-7777-4777-8777-777777777777";
    const normalizedBrief = previewDiscovery(brief).brief;
    const queryFingerprint = discoverySourceQueryFingerprint(
      normalizedBrief,
      normalizedBrief.industry_queries[0],
    );
    const { pool, query } = transactionPool((sql, values) => {
      if (
        sql.includes("FROM leadgrid_discovery_runs r") &&
        sql.includes("r.id = $1::uuid")
      ) {
        return {
          rows: [
            runRow({
              status,
              profile_id: executionProfileId,
              profile_version: 9,
              brief_snapshot: normalizedBrief,
              checkpoint: {
                version: 3,
                source_cursor_start: { [queryFingerprint]: 707 },
                source_cursor_next: { [queryFingerprint]: 707 },
                source_page_start: 7,
                source_page_next: 7,
                completed_queries: [],
                query_errors: [],
                query_results: {},
              },
            }),
          ],
        };
      }
      if (
        sql.includes("SELECT status") &&
        sql.includes("leadgrid_discovery_runs")
      ) {
        return { rows: [{ status }] };
      }
      if (sql.includes("SELECT COUNT(*)::int AS count")) {
        return { rows: [{ count: 0 }] };
      }
      if (sql.includes("SET status = $2") && values[0] === RUN_ID) {
        status = String(values[1]);
        return { rows: [], rowCount: 1 };
      }
      return undefined;
    });
    const searchRegistry = vi.fn(async () => {
      throw new Error("temporary registry failure");
    });

    await expect(
      executeDiscoveryRun(pool, RUN_ID, { searchRegistry }),
    ).rejects.toMatchObject({ code: "provider_unavailable" });

    expect(searchRegistry).toHaveBeenCalledOnce();
    expect(searchRegistry.mock.calls[0]?.[0]).toMatchObject({
      sourceOffset: 707,
    });
    expect(
      query.mock.calls.some(([queryValue]) =>
        textOf(queryValue).includes("SET source_cursor_map ="),
      ),
    ).toBe(false);
  });
  it("completes without overwriting a newer cursor when terminal CAS loses a race", async () => {
    let status = "researching";
    const executionProfileId = "77777777-7777-4777-8777-777777777777";
    const normalizedBrief = previewDiscovery(brief).brief;
    const queryFingerprint = discoverySourceQueryFingerprint(
      normalizedBrief,
      normalizedBrief.industry_queries[0],
    );
    const { pool, query } = transactionPool((sql, values) => {
      if (
        sql.includes("FROM leadgrid_discovery_runs r") &&
        sql.includes("r.id = $1::uuid")
      ) {
        return {
          rows: [
            runRow({
              status,
              profile_id: executionProfileId,
              profile_version: 9,
              brief_snapshot: normalizedBrief,
              checkpoint: {
                version: 3,
                source_cursor_start: { [queryFingerprint]: 50 },
                source_cursor_next: { [queryFingerprint]: 50 },
                source_page_start: 0,
                source_page_next: 0,
                completed_queries: [],
                query_errors: [],
                query_results: {},
              },
            }),
          ],
        };
      }
      if (
        sql.includes("SELECT status") &&
        sql.includes("leadgrid_discovery_runs")
      ) {
        return { rows: [{ status }] };
      }
      if (sql.includes("SELECT COUNT(*)::int AS count")) {
        return { rows: [{ count: 0 }] };
      }
      if (sql.includes("SET status = $2") && values[0] === RUN_ID) {
        status = String(values[1]);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SET source_cursor_map =")) {
        // A parallel successful run already changed this fingerprint, so the
        // compare-and-set must miss and leave that newer map untouched.
        return { rows: [], rowCount: 0 };
      }
      return undefined;
    });
    const searchRegistry = vi.fn(
      async (input: DiscoveryRegistrySearchInput) => ({
        candidates: [],
        sourceOffsetStart: input.sourceOffset ?? 0,
        sourceOffsetNext: 70,
        sourcePageStart: 0,
        sourcePageNext: 0,
        sourcePageCount: 10,
        pagesFetched: 1,
        sourceResultsSeen: 20,
        duplicateResultsSkipped: 0,
        invalidResultsSkipped: 0,
        geoFilteredResults: 0,
        companyFilteredResults: 0,
        websiteAssessmentCandidates: 0,
        websiteAssessmentRequests: 0,
        sourceLimitReached: false,
        hasMoreSourceResults: true,
        limitReason: null,
        externalRequests: 1,
        geocodeRequests: 0,
        geocodeMisses: 0,
        resolution: "nace" as const,
        resolvedNaceCodes: ["69.201"],
        resolvedMunicipalities: [],
      }),
    );

    await expect(
      executeDiscoveryRun(pool, RUN_ID, { searchRegistry }),
    ).resolves.toMatchObject({ status: "completed" });

    expect(searchRegistry).toHaveBeenCalledOnce();
    expect(searchRegistry.mock.calls[0]?.[0].sourceOffset).toBe(50);
    const cursorWrites = query.mock.calls.filter(([queryValue]) =>
      textOf(queryValue).includes("SET source_cursor_map ="),
    );
    expect(cursorWrites).toHaveLength(1);
    expect(JSON.parse(String(cursorWrites[0]?.[1]?.[4]))).toEqual({
      [queryFingerprint]: 70,
    });
    expect(JSON.parse(String(cursorWrites[0]?.[1]?.[5]))).toEqual({
      [queryFingerprint]: 50,
    });
  });

  it("uses the request hash as the replay boundary", () => {
    expect(
      discoveryHash({ run_id: RUN_ID, decision: { decision: "approve" } }),
    ).not.toBe(
      discoveryHash({ run_id: RUN_ID, decision: { decision: "reject" } }),
    );
  });

  it("keeps query fingerprints stable across query reorder and resets on filter change", () => {
    const firstBrief = previewDiscovery({
      ...brief,
      industry_queries: ["regnskapsfører", "revisjonsfirma"],
    }).brief;
    const reorderedBrief = previewDiscovery({
      ...brief,
      industry_queries: ["revisjonsfirma", "regnskapsfører"],
    }).brief;
    const changedUniverse = previewDiscovery({
      ...brief,
      city: "Bergen",
      industry_queries: ["regnskapsfører", "revisjonsfirma"],
    }).brief;

    expect(discoverySourceQueryFingerprint(firstBrief, "regnskapsfører")).toBe(
      discoverySourceQueryFingerprint(reorderedBrief, "regnskapsfører"),
    );
    expect(
      discoverySourceQueryFingerprint(firstBrief, "regnskapsfører"),
    ).not.toBe(
      discoverySourceQueryFingerprint(changedUniverse, "regnskapsfører"),
    );
  });

  it("completes a run that contains candidates but no actual review queue", async () => {
    let status = "queued";
    const nonReviewableBrief = {
      ...brief,
      target_count: 1,
      enrichment_count: 1,
    };
    const { pool, sequence } = transactionPool((sql, values) => {
      if (
        sql.includes("FROM leadgrid_discovery_runs r") &&
        sql.includes("r.id = $1::uuid")
      ) {
        return {
          rows: [
            runRow({
              status,
              requested_count: 1,
              enrichment_count: 1,
              candidate_count: 1,
              review_ready_count: 0,
              brief_snapshot: nonReviewableBrief,
            }),
          ],
        };
      }
      if (
        sql.includes("SELECT status") &&
        sql.includes("leadgrid_discovery_runs")
      ) {
        return { rows: [{ status }] };
      }
      if (sql.includes("SELECT COUNT(*)::int AS count")) {
        return { rows: [{ count: 1 }] };
      }
      if (sql.includes("SET status = 'searching'")) {
        status = "searching";
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SET status = 'researching'")) {
        status = "researching";
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SET status = $2") && values[0] === RUN_ID) {
        status = String(values[1]);
        return { rows: [], rowCount: 1 };
      }
      return undefined;
    });
    const searchRegistry = vi.fn();

    const result = await executeDiscoveryRun(pool, RUN_ID, {
      searchRegistry,
      emitProgress: vi.fn(),
    });

    expect(searchRegistry).not.toHaveBeenCalled();
    expect(result.status).toBe("completed");
    expect(
      sequence.some((entry) => entry.includes("INSERT INTO crm_customers")),
    ).toBe(false);
  });
});
