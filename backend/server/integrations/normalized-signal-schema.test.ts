import { describe, expect, it } from "vitest";

import {
  type NormalizedSignal,
  signalDisplayStatus,
  validateNormalizedSignal,
} from "./normalized-signal-schema.js";

function signal(overrides: Partial<NormalizedSignal> = {}): NormalizedSignal {
  return {
    id: "sig-1",
    organizationId: "org-1",
    workspaceId: "ws-1",
    provider: "ssb",
    sourceType: "public_data",
    subjectType: "region",
    topic: "befolkning",
    metricType: "population",
    metricValue: 717710,
    unit: "count",
    geography: { country: "NO", region: "0301" },
    periodStart: "2026-01-01T00:00:00.000Z",
    periodEnd: "2026-03-31T00:00:00.000Z",
    confidence: 0.99,
    sourceQuality: 1,
    freshnessScore: 0.9,
    isEstimated: false,
    isNormalized: true,
    collectedAt: "2026-07-10T08:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

describe("validateNormalizedSignal", () => {
  it("accepts a valid signal", () => {
    const result = validateNormalizedSignal(signal());
    expect(result.valid).toBe(true);
  });

  it("requires tenant scoping (organizationId + workspaceId)", () => {
    expect(validateNormalizedSignal(signal({ organizationId: "" })).valid).toBe(false);
    expect(validateNormalizedSignal(signal({ workspaceId: "" })).valid).toBe(false);
  });

  it("rejects unapproved source types — scraping is not a constructible origin", () => {
    const result = validateNormalizedSignal(signal({ sourceType: "scraped" as never }));
    expect(result.valid).toBe(false);
    expect(result.errors?.join(" ")).toContain("sourceType");
  });

  it("requires a closed-set unit so relative and absolute metrics can't blur", () => {
    const result = validateNormalizedSignal(signal({ unit: "sort_of_many" as never }));
    expect(result.valid).toBe(false);
  });

  it("rejects periodStart after periodEnd", () => {
    const result = validateNormalizedSignal(
      signal({
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-01-01T00:00:00.000Z",
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors?.join(" ")).toContain("periodEnd");
  });

  it("clamps confidence/quality/freshness to [0,1]", () => {
    expect(validateNormalizedSignal(signal({ confidence: 1.5 })).valid).toBe(false);
    expect(validateNormalizedSignal(signal({ freshnessScore: -0.1 })).valid).toBe(false);
  });
});

describe("signalDisplayStatus", () => {
  const now = new Date("2026-07-10T09:00:00.000Z").getTime();

  it("marks estimated signals as 'estimated' regardless of freshness", () => {
    expect(signalDisplayStatus(signal({ isEstimated: true }), { now })).toBe("estimated");
  });

  it("marks imported/manual data as 'imported'", () => {
    expect(signalDisplayStatus(signal({ sourceType: "manual_upload" }), { now })).toBe("imported");
    expect(signalDisplayStatus(signal({ sourceType: "user_imported" }), { now })).toBe("imported");
  });

  it("marks low-freshness signals as 'stale'", () => {
    expect(signalDisplayStatus(signal({ freshnessScore: 0.1 }), { now })).toBe("stale");
  });

  it("distinguishes live from cached by collection age", () => {
    expect(
      signalDisplayStatus(signal({ collectedAt: "2026-07-10T08:55:00.000Z" }), { now }),
    ).toBe("live");
    expect(
      signalDisplayStatus(signal({ collectedAt: "2026-07-10T06:00:00.000Z" }), { now }),
    ).toBe("cached");
  });
});
