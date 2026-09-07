import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  MARKETING_DISCOVERY_SKILL_KEY,
  MARKETING_DISCOVERY_SKILL_VERSION,
} from "./leadgrid-discovery-intelligence-contract.js";
import {
  generateMarketingIntelligence,
  type CandidateEvidenceRow,
} from "./leadgrid-discovery-intelligence-service.js";
import type { LeadgridAccessibleProject } from "./leadgrid-project-access.js";

const organizationId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const reportId = "44444444-4444-4444-8444-444444444444";
const userId = "marketer-1";
const idempotencyKey = "discovery-report-request";
const project: LeadgridAccessibleProject = {
  id: "dentum-project",
  organizationId,
  name: "Dentum",
  description: null,
  industry: "Tannhelse",
  status: "active",
  createdBy: userId,
  memberRole: "markedssjef",
};

function candidate(id: string, city: string): CandidateEvidenceRow {
  return {
    id,
    name: "Klinikk " + id,
    city,
    organization_number: "9999999" + id,
    source_uri:
      "https://data.brreg.no/enhetsregisteret/api/enheter/9999999" + id,
    nace_code: "86.230",
    nace_description: "Tannhelsetjenester",
    employee_count: 12,
    registered_in_vat_register: true,
    observation_origin: "provider_observation",
    observation_observed_at: "2026-09-01T08:00:00.000Z",
    observation_captured_at: "2026-09-01T08:00:00.000Z",
    fit_score: 82,
    fit_coverage: 0.9,
    data_quality_score: 80,
    data_quality_coverage: 0.8,
    evidence: [
      {
        factor: "website_quality",
        label: "Nettsidekvalitet",
        value: "God dokumentert struktur",
        source: "Leadgrid Discovery",
        ref: "discovery.website_quality",
      },
    ],
  } as CandidateEvidenceRow;
}

const candidates = [
  candidate("1", "Oslo"),
  candidate("2", "Oslo"),
  candidate("3", "Bærum"),
  candidate("4", "Asker"),
];

function requestHash(): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        run_id: runId,
        skill_key: MARKETING_DISCOVERY_SKILL_KEY,
        skill_version: MARKETING_DISCOVERY_SKILL_VERSION,
      }),
    )
    .digest("hex");
}

function reportRow(status: string) {
  return {
    id: reportId,
    run_id: runId,
    skill_key: MARKETING_DISCOVERY_SKILL_KEY,
    skill_version: MARKETING_DISCOVERY_SKILL_VERSION,
    status,
    executive_summary: "Dokumentert rapport for valgt Discovery-kjøring.",
    evidence_coverage: 0.85,
    overall_confidence: 0.8,
    source_count: 2,
    evidence_catalog: [],
    conflicts: [],
    gaps: [],
    provider: "leadgrid",
    model: "deterministic-evidence-v1",
    error_code: null,
    error_message: null,
    request_hash: requestHash(),
    created_at: "2026-09-05T12:00:00.000Z",
    updated_at: "2026-09-05T12:00:00.000Z",
  };
}

type HarnessOptions = {
  existingStatus?: "generating" | "failed";
  failInsightInsert?: boolean;
};

function makeHarness(options: HarnessOptions = {}) {
  const poolQuery = vi.fn(async (sql: string) => {
    if (sql.includes("SELECT request_hash") && !sql.includes("id::text")) {
      return {
        rows: [{ request_hash: requestHash() }],
        rowCount: 1,
      };
    }
    if (sql.includes("FROM leadgrid_discovery_intelligence_reports")) {
      return options.existingStatus
        ? { rows: [reportRow(options.existingStatus)], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (sql.includes("FROM leadgrid_discovery_intelligence_insights")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("FROM leadgrid_discovery_runs")) {
      return { rows: [{ id: runId, status: "review_ready" }], rowCount: 1 };
    }
    if (sql.includes("FROM leadgrid_discovery_run_candidates")) {
      return { rows: candidates, rowCount: candidates.length };
    }
    throw new Error("unexpected pool query: " + sql);
  });

  const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("DELETE FROM leadgrid_discovery_intelligence_reports")) {
      expect(sql).toContain("status IN ('generating', 'failed')");
      expect(params?.slice(0, 4)).toEqual([
        organizationId,
        project.id,
        runId,
        idempotencyKey,
      ]);
      return {
        rows: [],
        rowCount: options.existingStatus ? 1 : 0,
      };
    }
    if (sql.includes("INSERT INTO leadgrid_discovery_intelligence_reports")) {
      expect(params?.[5]).toBe("ready");
      return { rows: [{ id: reportId }], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO leadgrid_discovery_intelligence_insights")) {
      if (options.failInsightInsert) {
        throw new Error("simulated insight persistence failure");
      }
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("FROM leadgrid_discovery_intelligence_reports")) {
      return { rows: [reportRow("ready")], rowCount: 1 };
    }
    if (sql.includes("FROM leadgrid_discovery_intelligence_insights")) {
      return { rows: [], rowCount: 0 };
    }
    throw new Error("unexpected client query: " + sql);
  });
  const release = vi.fn();
  const client = {
    query: clientQuery,
    release,
  } as unknown as PoolClient;
  const connect = vi.fn(async () => client);
  const pool = {
    query: poolQuery,
    connect,
  } as unknown as Pool;
  return { pool, poolQuery, clientQuery, connect, release };
}

async function generate(pool: Pool) {
  return generateMarketingIntelligence(pool, {
    project,
    runId,
    userId,
    idempotencyKey,
  });
}

describe("Discovery marketing-intelligence atomic persistence", () => {
  it("commits the final report and all insight rows in one transaction", async () => {
    const harness = makeHarness();

    const result = await generate(harness.pool);

    expect(result).toMatchObject({
      replayed: false,
      report: { id: reportId, status: "ready" },
    });
    const clientSql = harness.clientQuery.mock.calls.map(([sql]) => sql);
    expect(clientSql[0]).toBe("BEGIN");
    expect(clientSql).toContainEqual(
      expect.stringContaining(
        "INSERT INTO leadgrid_discovery_intelligence_reports",
      ),
    );
    expect(clientSql).toContainEqual(
      expect.stringContaining(
        "INSERT INTO leadgrid_discovery_intelligence_insights",
      ),
    );
    expect(clientSql.at(-1)).toBe("COMMIT");
    expect(
      harness.poolQuery.mock.calls.some(([sql]) =>
        String(sql).includes(
          "INSERT INTO leadgrid_discovery_intelligence_reports",
        ),
      ),
    ).toBe(false);
    expect(harness.release).toHaveBeenCalledTimes(1);
  });

  it("rolls back the report shell when any insight insert fails", async () => {
    const harness = makeHarness({ failInsightInsert: true });

    await expect(generate(harness.pool)).rejects.toMatchObject({
      code: "generation_failed",
      retryable: true,
    });

    expect(harness.clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(harness.clientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(harness.release).toHaveBeenCalledTimes(1);
  });

  it("recovers a matching legacy generating shell instead of replaying it", async () => {
    const harness = makeHarness({ existingStatus: "generating" });

    const result = await generate(harness.pool);

    expect(result.replayed).toBe(false);
    expect(result.report.status).toBe("ready");
    expect(
      harness.clientQuery.mock.calls.some(([sql]) =>
        String(sql).includes(
          "DELETE FROM leadgrid_discovery_intelligence_reports",
        ),
      ),
    ).toBe(true);
    expect(harness.clientQuery).toHaveBeenCalledWith("COMMIT");
  });
});
