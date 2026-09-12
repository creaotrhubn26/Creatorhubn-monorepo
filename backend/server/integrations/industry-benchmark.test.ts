import { describe, expect, it, vi } from "vitest";

import { getIndustryBenchmark } from "./industry-benchmark.js";

describe("getIndustryBenchmark", () => {
  it("rapporterer dekning ærlig og topp-utøvere med tall", async () => {
    let call = 0;
    const pool = {
      query: vi.fn(async () => {
        call++;
        if (call === 1) return { rows: [{ display_name: "Fotografer (74.200)", total_found: 8961 }], rowCount: 1 };
        if (call === 2) return { rows: [{ n: 312, median_revenue: "1850000", median_margin: 0.08, p75_margin: 0.19 }], rowCount: 1 };
        return { rows: [{ name: "Foto Best AS", municipality: "OSLO", revenue: "4200000", operating_margin: 0.31, year: 2025 }], rowCount: 1 };
      }),
    } as unknown as import("pg").Pool;

    const b = (await getIndustryBenchmark(pool, "fotografer"))!;
    expect(b.coverage).toBeCloseTo(0.035, 2); // 312/8961 — presenteres som 3.5 %, ikke skjult
    expect(b.medianRevenue).toBe(1850000);
    expect(b.topPerformers[0]).toMatchObject({ name: "Foto Best AS", operatingMargin: 0.31 });
  });

  it("ukjent segment gir null", async () => {
    const pool = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) } as unknown as import("pg").Pool;
    expect(await getIndustryBenchmark(pool, "finnes-ikke")).toBeNull();
  });
});
