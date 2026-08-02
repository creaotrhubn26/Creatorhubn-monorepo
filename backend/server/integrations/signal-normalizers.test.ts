import { describe, expect, it } from "vitest";

import { normalizeGscSearchAnalytics } from "./gsc-signal-normalizer.js";
import { normalizeGa4RunReport } from "./ga4-signal-normalizer.js";
import { validateNormalizedSignal } from "./normalized-signal-schema.js";

const CTX = {
  organizationId: "8f14e45f-ceea-467f-a8db-000000000001",
  workspaceId: "user-1",
  periodStart: "2026-06-01T00:00:00.000Z",
  periodEnd: "2026-06-30T23:59:59.999Z",
  collectedAt: "2026-07-10T08:00:00.000Z",
};

describe("normalizeGscSearchAnalytics", () => {
  const rows = [
    { keys: ["2026-06-01"], clicks: 10, impressions: 200, ctr: 0.05, position: 4.2 },
    { keys: ["2026-06-02"], clicks: 12, impressions: 240, ctr: 0.05, position: 3.9 },
  ];

  it("produces 4 contract-valid signals per daily row", () => {
    const signals = normalizeGscSearchAnalytics(rows, {
      ...CTX,
      siteUrl: "sc-domain:example.com",
      dimension: "date",
    });
    expect(signals).toHaveLength(8);
    for (const s of signals) {
      const v = validateNormalizedSignal(s);
      expect(v.errors, s.id).toBeUndefined();
    }
  });

  it("maps date rows to day-periods and site as topic", () => {
    const signals = normalizeGscSearchAnalytics(rows.slice(0, 1), {
      ...CTX,
      siteUrl: "sc-domain:example.com",
      dimension: "date",
    });
    const clicks = signals.find((s) => s.metricType === "owned_clicks")!;
    expect(clicks.periodStart).toBe("2026-06-01T00:00:00.000Z");
    expect(clicks.periodEnd).toBe("2026-06-01T23:59:59.999Z");
    expect(clicks.topic).toBe("sc-domain:example.com");
    expect(clicks.subjectType).toBe("own_property");
    expect(clicks.metricValue).toBe(10);
  });

  it("maps query rows to request-period and query as topic; ctr → percent", () => {
    const signals = normalizeGscSearchAnalytics(
      [{ keys: ["videoproduksjon oslo"], clicks: 5, impressions: 80, ctr: 0.0625, position: 6.1 }],
      { ...CTX, siteUrl: "sc-domain:example.com", dimension: "query" },
    );
    const ctr = signals.find((s) => s.metricType === "owned_ctr")!;
    expect(ctr.topic).toBe("videoproduksjon oslo");
    expect(ctr.periodStart).toBe(CTX.periodStart);
    expect(ctr.metricValue).toBeCloseTo(6.25);
    expect(ctr.unit).toBe("percent");
  });

  it("generates deterministic ids (idempotent re-sync)", () => {
    const run = () =>
      normalizeGscSearchAnalytics(rows, {
        ...CTX,
        siteUrl: "sc-domain:example.com",
        dimension: "date",
      }).map((s) => s.id);
    expect(run()).toEqual(run());
  });
});

describe("normalizeGa4RunReport", () => {
  const report = {
    dimensionHeaders: [{ name: "sessionDefaultChannelGroup" }],
    metricHeaders: [{ name: "sessions" }, { name: "conversions" }, { name: "bounceRate" }],
    rows: [
      {
        dimensionValues: [{ value: "Organic Search" }],
        metricValues: [{ value: "120" }, { value: "7" }, { value: "0.4" }],
      },
      {
        dimensionValues: [{ value: "Direct" }],
        metricValues: [{ value: "80" }, { value: "2" }, { value: "0.5" }],
      },
    ],
  };

  it("normalizes mapped metrics and reports unmapped ones instead of guessing", () => {
    const { signals, skippedMetrics } = normalizeGa4RunReport(report, {
      ...CTX,
      propertyId: "properties/123",
    });
    expect(signals).toHaveLength(4); // 2 rader × (sessions + conversions)
    expect(skippedMetrics).toEqual(["bounceRate"]);
    for (const s of signals) {
      expect(validateNormalizedSignal(s).errors, s.id).toBeUndefined();
    }
  });

  it("carries dimensions into topic and record-id", () => {
    const { signals } = normalizeGa4RunReport(report, {
      ...CTX,
      propertyId: "properties/123",
    });
    const organic = signals.find(
      (s) => s.metricType === "sessions" && s.topic.includes("Organic Search"),
    )!;
    expect(organic.metricValue).toBe(120);
    expect(organic.sourceRecordId).toContain("properties/123");
    expect(organic.subjectId).toBe("properties/123");
  });

  it("handles totals-reports without dimensions", () => {
    const { signals } = normalizeGa4RunReport(
      {
        metricHeaders: [{ name: "sessions" }],
        rows: [{ metricValues: [{ value: "999" }] }],
      },
      { ...CTX, propertyId: "properties/123" },
    );
    expect(signals).toHaveLength(1);
    expect(signals[0].topic).toBe("properties/123");
    expect(signals[0].metricValue).toBe(999);
  });
});
