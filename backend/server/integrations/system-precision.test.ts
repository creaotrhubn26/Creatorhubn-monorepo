import { describe, expect, it } from "vitest";

import { computePrecision, MIN_JUDGED_FOR_PRECISION } from "./system-precision.js";

describe("computePrecision (selv-målingen)", () => {
  it("beregner presisjon kun over BEHANDLEDE innsikter, m/ min-utvalg", () => {
    const rows = [
      { detector: "sales-trigger", status: "dismissed", n: 8 },
      { detector: "sales-trigger", status: "actioned", n: 2 },
      { detector: "sales-trigger", status: "new", n: 30 },
      { detector: "geo-sov-change", status: "dismissed", n: 1 },
      { detector: "geo-sov-change", status: "new", n: 4 },
    ];
    const p = computePrecision(rows);
    const st = p.find((x) => x.detector === "sales-trigger")!;
    expect(st.precision).toBe(0.2); // 2 av 10 behandlede overlevde
    expect(st.stillNew).toBe(30);
    const geo = p.find((x) => x.detector === "geo-sov-change")!;
    expect(geo.precision).toBeNull(); // 1 behandlet < minimum — ingen dom
    expect(MIN_JUDGED_FOR_PRECISION).toBeGreaterThan(1);
  });
});
