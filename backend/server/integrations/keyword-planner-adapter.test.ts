import { describe, expect, it } from "vitest";

import {
  keywordIdeasToSignals,
  monthlyVolumesToPoints,
  type KeywordIdeaResult,
} from "./keyword-planner-adapter.js";
import { validateNormalizedSignal } from "./normalized-signal-schema.js";

const CTX = {
  organizationId: "8f14e45f-ceea-467f-a8db-000000000001",
  workspaceId: "user-1",
  collectedAt: "2026-07-11T05:00:00.000Z",
};

const IDEAS: KeywordIdeaResult[] = [
  {
    text: "Leadgenerering Norge",
    keywordIdeaMetrics: {
      avgMonthlySearches: "720",
      competition: "MEDIUM",
      competitionIndex: "43",
      monthlySearchVolumes: [
        { year: "2026", month: "MAY", monthlySearches: "800" },
        { year: "2026", month: "JUNE", monthlySearches: "640" },
        { year: "2025", month: "DECEMBER", monthlySearches: "500" },
      ],
    },
  },
  { text: "uten metrics" },
];

describe("keywordIdeasToSignals", () => {
  it("produces contract-valid volume + competition signals, marked estimated", () => {
    const signals = keywordIdeasToSignals(IDEAS, CTX);
    expect(signals).toHaveLength(2);
    for (const s of signals) {
      expect(validateNormalizedSignal(s).errors, s.id).toBeUndefined();
      expect(s.isEstimated).toBe(true);
      expect(s.subjectType).toBe("keyword");
      expect(s.topic).toBe("leadgenerering norge"); // normalisert lowercase
    }
    const volume = signals.find((s) => s.metricType === "search_volume_avg")!;
    expect(volume.metricValue).toBe(720);
    expect(volume.unit).toBe("searches_per_month"); // aldri relative_index
    const comp = signals.find((s) => s.metricType === "keyword_competition")!;
    expect(comp.metricValue).toBe(43);
  });

  it("uses per-day deterministic ids (cache-vennlig re-lookup samme dag)", () => {
    const a = keywordIdeasToSignals(IDEAS, CTX).map((s) => s.id);
    const b = keywordIdeasToSignals(IDEAS, CTX).map((s) => s.id);
    expect(a).toEqual(b);
    expect(a[0]).toContain("2026-07-11");
  });

  it("falls back to competition bucket when index is missing", () => {
    const signals = keywordIdeasToSignals(
      [{ text: "x y", keywordIdeaMetrics: { avgMonthlySearches: "10", competition: "HIGH" } }],
      CTX,
    );
    expect(signals.find((s) => s.metricType === "keyword_competition")?.metricValue).toBe(90);
  });

  it("skips ideas without text or metrics", () => {
    expect(keywordIdeasToSignals([{ text: "uten metrics" }, {}], CTX)).toEqual([]);
  });
});

describe("monthlyVolumesToPoints", () => {
  it("maps and sorts months chronologically with correct month-boundaries", () => {
    const points = monthlyVolumesToPoints(IDEAS[0].keywordIdeaMetrics!);
    expect(points.map((p) => p.value)).toEqual([500, 800, 640]); // des-25, mai-26, jun-26
    expect(points[0].periodStart).toBe("2025-12-01T00:00:00.000Z");
    expect(points[0].periodEnd).toBe("2025-12-31T23:59:59.999Z");
    expect(points[2].periodEnd).toBe("2026-06-30T23:59:59.999Z");
  });

  it("returns [] on missing history", () => {
    expect(monthlyVolumesToPoints({})).toEqual([]);
  });
});
