import { describe, expect, it, vi } from "vitest";

import {
  insertNormalizedSignals,
  queryNormalizedSignals,
} from "./normalized-signal-store.js";
import type { NormalizedSignal } from "./normalized-signal-schema.js";

function signal(overrides: Partial<NormalizedSignal> = {}): NormalizedSignal {
  return {
    id: "gsc:site|date:2026-07-01|owned_clicks|2026-07-01T00:00:00.000Z",
    organizationId: "8f14e45f-ceea-467f-a8db-000000000001",
    workspaceId: "user-1",
    provider: "google-search-console",
    sourceType: "official_api",
    sourceRecordId: "site|date:2026-07-01|owned_clicks",
    subjectType: "own_property",
    subjectId: "sc-domain:example.com",
    topic: "sc-domain:example.com",
    metricType: "owned_clicks",
    metricValue: 42,
    unit: "clicks",
    periodStart: "2026-07-01T00:00:00.000Z",
    periodEnd: "2026-07-01T23:59:59.999Z",
    confidence: 1,
    sourceQuality: 1,
    freshnessScore: 1,
    isEstimated: false,
    isNormalized: true,
    collectedAt: "2026-07-10T08:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

function mockPool(rowCounts: number[] = [1], rows: unknown[] = []) {
  let call = 0;
  const query = vi.fn(async () => ({
    rowCount: rowCounts[Math.min(call++, rowCounts.length - 1)],
    rows,
  }));
  return { pool: { query } as unknown as import("pg").Pool, query };
}

describe("insertNormalizedSignals", () => {
  it("inserts valid signals and reports duplicates via rowCount", async () => {
    const { pool } = mockPool([1, 0]); // andre insert er duplikat
    const result = await insertNormalizedSignals(pool, [
      signal(),
      signal({ id: "dup", metricType: "owned_impressions", unit: "impressions" }),
    ]);
    expect(result).toEqual({ inserted: 1, skippedDuplicates: 1 });
  });

  it("rejects the whole batch when any signal is invalid — nothing written", async () => {
    const { pool, query } = mockPool();
    await expect(
      insertNormalizedSignals(pool, [
        signal(),
        signal({ sourceType: "scraped" as never }),
      ]),
    ).rejects.toThrow(/ugyldige signaler/);
    expect(query).not.toHaveBeenCalled();
  });

  it("no-ops on empty input", async () => {
    const { pool, query } = mockPool();
    const result = await insertNormalizedSignals(pool, []);
    expect(result).toEqual({ inserted: 0, skippedDuplicates: 0 });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("queryNormalizedSignals", () => {
  it("requires organizationId", async () => {
    const { pool } = mockPool();
    await expect(
      queryNormalizedSignals(pool, { organizationId: "" }),
    ).rejects.toThrow(/organizationId er påkrevd/);
  });

  it("always scopes the SQL to the organization", async () => {
    const { pool, query } = mockPool([0], []);
    await queryNormalizedSignals(pool, {
      organizationId: "8f14e45f-ceea-467f-a8db-000000000001",
      metricType: "owned_clicks",
    });
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("organization_id = $1::uuid");
    expect(params[0]).toBe("8f14e45f-ceea-467f-a8db-000000000001");
    expect(sql).toContain("metric_type = $2");
  });

  it("maps DB rows (pg Date objects) back to contract-valid signals", async () => {
    const dbRow = {
      id: "gsc:x",
      organization_id: "8f14e45f-ceea-467f-a8db-000000000001",
      workspace_id: "user-1",
      project_id: null,
      provider: "google-search-console",
      source_type: "official_api",
      source_record_id: "x",
      subject_type: "own_property",
      subject_id: "sc-domain:example.com",
      topic: "sc-domain:example.com",
      metric_type: "owned_clicks",
      metric_value: 42,
      unit: "clicks",
      geo_country: null,
      geo_region: null,
      geo_city: null,
      geo_postal_code: null,
      period_start: new Date("2026-07-01T00:00:00.000Z"),
      period_end: new Date("2026-07-01T23:59:59.999Z"),
      confidence: 1,
      source_quality: 1,
      freshness_score: 1,
      is_estimated: false,
      is_normalized: true,
      collected_at: new Date("2026-07-10T08:00:00.000Z"),
      source_updated_at: null,
      metadata: { dimension: "date" },
    };
    const { pool } = mockPool([1], [dbRow]);
    const signals = await queryNormalizedSignals(pool, {
      organizationId: "8f14e45f-ceea-467f-a8db-000000000001",
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].periodStart).toBe("2026-07-01T00:00:00.000Z");
    expect(signals[0].collectedAt).toBe("2026-07-10T08:00:00.000Z");
    expect(signals[0].geography).toBeUndefined();
    expect(signals[0].metricValue).toBe(42);
  });
});
