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
  confirmDiscoveryRun,
  createDiscoveryRun,
  decideDiscoveryCandidate,
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
      resolution: "nace" as const,
      resolvedNaceCodes: ["69.201"],
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
    expect(promotionCall?.[1]?.[9]).toBe("999888777");
    expect(JSON.parse(String(promotionCall?.[1]?.[10]))).toMatchObject({
      source: "brreg",
      autoLinked: true,
    });
    expect(promotionCall?.[1]?.[11]).toBe("2026-08-30T09:00:00.000Z");
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
    const { pool } = transactionPool((sql) => {
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
      candidate_status: "rejected",
    });
    expect(
      sequence.some((entry) => entry.includes("INSERT INTO crm_customers")),
    ).toBe(false);
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

  it("propagates a canonical decision across overlapping open runs", async () => {
    const otherRunId = "66666666-6666-4666-8666-666666666666";
    const emit = vi
      .spyOn(leadgridRealtime, "emit")
      .mockImplementation(() => {});
    const { pool, query } = transactionPool((sql) => {
      if (sql.includes("SELECT c.id::text AS candidate_id")) {
        return { rows: [decisionCandidate()] };
      }
      if (sql.includes("FROM leadgrid_discovery_feedback")) {
        return { rows: [] };
      }
      if (
        sql.includes("UPDATE leadgrid_discovery_run_candidates") &&
        sql.includes("RETURNING run_id::text")
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
        sql.includes("RETURNING run_id::text")
      );
    });
    expect(textOf(propagation?.[0])).toContain(
      "'researching', 'review_ready', 'failed'",
    );
    expect(propagation?.[1]).toEqual([
      CANDIDATE_ID,
      "rejected",
      ORGANIZATION_ID,
      project.id,
    ]);
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
        return { rows: [{ id: LEAD_ID }], rowCount: 1 };
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
    expect(crmLookup?.[1]).toEqual([ORGANIZATION_ID, project.id, "999888777"]);
    expect(
      query.mock.calls.some(
        ([queryValue, values]) =>
          textOf(queryValue).includes("pg_advisory_xact_lock") &&
          values?.[0] ===
            `${ORGANIZATION_ID}|${project.id}|crm_promotion|orgnr:999888777`,
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
    const multiQueryBrief = {
      ...brief,
      industry_queries: ["regnskapsfører", "revisjonsfirma"],
    };
    const sequence: string[] = [];
    const { pool } = transactionPool((sql, values) => {
      if (
        sql.includes("FROM leadgrid_discovery_runs r") &&
        sql.includes("r.id = $1::uuid")
      ) {
        return {
          rows: [
            runRow({
              status,
              candidate_count: 1,
              review_ready_count: reviewReadyCount,
              brief_snapshot: multiQueryBrief,
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
    const searchRegistry = vi.fn(
      async (_input: DiscoveryRegistrySearchInput) => ({
        candidates: [],
        pagesFetched: 1,
        sourceResultsSeen: 0,
        duplicateResultsSkipped: 0,
        invalidResultsSkipped: 0,
        geoFilteredResults: 0,
        sourceLimitReached: false,
        hasMoreSourceResults: false,
        limitReason: null,
        externalRequests: 1,
        geocodeRequests: 0,
        geocodeMisses: 0,
        resolution: "nace" as const,
        resolvedNaceCodes: ["69.201"],
      }),
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

  it("uses the request hash as the replay boundary", () => {
    expect(
      discoveryHash({ run_id: RUN_ID, decision: { decision: "approve" } }),
    ).not.toBe(
      discoveryHash({ run_id: RUN_ID, decision: { decision: "reject" } }),
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
