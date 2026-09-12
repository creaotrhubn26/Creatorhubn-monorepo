import { describe, expect, it } from "vitest";

import { monthToIso, MOMENTUM_NACE, parseMomentumPoints } from "./ssb-momentum-signal-sync.js";

const stat = {
  id: ["NACE", "ContentsCode", "Tid"],
  size: [2, 1, 3],
  dimension: {
    NACE: { category: { index: { "59": 0, "74": 1 } } },
    Tid: { category: { index: { "2026M03": 0, "2026M04": 1, "2026M05": 2 }, label: {} } },
  },
  // row-major: 59×(M03,M04,M05), 74×(...) — reelle tall fra proben
  value: [118.2, 121.0, 129.2, 150.1, null, 157.5],
};

describe("parseMomentumPoints", () => {
  it("plasserer indeksverdier riktig og hopper over null (SSB-undertrykt)", () => {
    const pts = parseMomentumPoints(stat);
    expect(pts).toHaveLength(5); // én null hoppet over
    expect(pts.find((p) => p.naceCode === "59" && p.month === "2026M05")!.index).toBe(129.2);
    expect(pts.find((p) => p.naceCode === "74" && p.month === "2026M04")).toBeUndefined();
  });
});

describe("monthToIso", () => {
  it("'2026M05' → månedstart ISO", () => {
    expect(monthToIso("2026M05")).toBe("2026-05-01T00:00:00.000Z");
  });
});

describe("MOMENTUM_NACE (ærlig dekning)", () => {
  it("dans/utdanning er IKKE med — finnes ikke i tjenesteindeksen", () => {
    expect(Object.keys(MOMENTUM_NACE).some((k) => k.includes("danse"))).toBe(false);
  });
});
