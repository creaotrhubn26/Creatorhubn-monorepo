import { describe, expect, it } from "vitest";

import { computeSeasonality, computeTrend, rankUpcomingMonths, type MonthPoint } from "./launch-timing.js";

// Syntetisk 3-års-serie med kjent mønster: november dobbelt av juli
function makeSeries(): MonthPoint[] {
  const pts: MonthPoint[] = [];
  for (let y = 2023; y <= 2025; y++) {
    for (let m = 1; m <= 12; m++) {
      const base = m === 11 ? 140 : m === 7 ? 70 : 100;
      pts.push({ month: `${y}M${String(m).padStart(2, "0")}`, value: base + (y - 2023) * 5 });
    }
  }
  return pts;
}

describe("computeSeasonality", () => {
  it("finner sesongmønsteret (november topp, juli bunn)", () => {
    const s = computeSeasonality(makeSeries())!;
    expect(s.byCalendarMonth["11"]).toBeGreaterThan(1.3);
    expect(s.byCalendarMonth["07"]).toBeLessThan(0.75);
    expect(s.yearsOfData).toBe(3);
  });

  it("krever alle 12 kalendermåneder — ellers null", () => {
    expect(computeSeasonality(makeSeries().slice(0, 8))).toBeNull();
  });
});

describe("computeTrend", () => {
  it("måler siste 12 mnd mot foregående 12 (vekstserien gir positiv trend)", () => {
    const t = computeTrend(makeSeries())!;
    expect(t.pct).toBeGreaterThan(0);
    expect(computeTrend(makeSeries().slice(0, 20))).toBeNull(); // < 24 mnd → ingen dom
  });
});

describe("rankUpcomingMonths", () => {
  it("rangerer kommende 12 måneder med høysesong først og ærlige noter", () => {
    const s = computeSeasonality(makeSeries())!;
    const ranked = rankUpcomingMonths(s, new Date("2026-07-13T00:00:00Z"));
    expect(ranked).toHaveLength(12);
    expect(ranked[0].calendarMonth).toBe("11");
    expect(ranked[0].note).toContain("høysesong");
    expect(ranked[ranked.length - 1].calendarMonth).toBe("07");
  });
});
