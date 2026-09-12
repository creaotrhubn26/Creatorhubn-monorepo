import { describe, expect, it } from "vitest";

import {
  parseTerritoryCounts,
  toTerritorySignals,
  type JsonStat2,
} from "./ssb-territory-signal-sync.js";
import { validateNormalizedSignal } from "./normalized-signal-schema.js";

const ORG = "11111111-2222-3333-4444-555555555555";

// Formen fra faktisk 07091-respons (verifisert 2026-07-13):
// dimensjoner Region(3) × NACE2007(2) × AntAnsatte(1) × ContentsCode(1) × Tid(1)
const stat: JsonStat2 = {
  id: ["Region", "NACE2007", "AntAnsatte", "ContentsCode", "Tid"],
  size: [3, 2, 1, 1, 1],
  dimension: {
    Region: {
      category: {
        index: { "03": 0, "46": 1, "50": 2 },
        label: { "03": "Oslo - Oslove", "46": "Vestland", "50": "Trøndelag - Trööndelage" },
      },
    },
    NACE2007: { category: { index: { "74": 0, "59": 1 }, label: { "74": "Annen faglig", "59": "Film/TV" } } },
    AntAnsatte: { category: { index: { "99": 0 }, label: { "99": "Alle" } } },
    ContentsCode: { category: { index: { Bedrifter: 0 }, label: { Bedrifter: "Bedrifter" } } },
    Tid: { category: { index: { "2026": 0 }, label: { "2026": "2026" } } },
  },
  // row-major: Oslo(74,59), Vestland(74,59), Trøndelag(74,59) — reelle tall fra proben
  value: [2631, 4852, 597, 1779, 432, 1244],
};

describe("parseTerritoryCounts (json-stat2 row-major)", () => {
  it("plasserer verdiene på riktig (region, næring)-celle", () => {
    const counts = parseTerritoryCounts(stat);
    expect(counts).toHaveLength(6);
    const oslo74 = counts.find((c) => c.regionCode === "03" && c.naceCode === "74")!;
    expect(oslo74.count).toBe(2631);
    expect(oslo74.regionName).toBe("Oslo - Oslove");
    const trondelag59 = counts.find((c) => c.regionCode === "50" && c.naceCode === "59")!;
    expect(trondelag59.count).toBe(1244);
  });

  it("null-celler hoppes over (SSB-undertrykte verdier gjettes ikke)", () => {
    const withNull = { ...stat, value: [2631, null, 597, 1779, 432, 1244] };
    expect(parseTerritoryCounts(withNull)).toHaveLength(5);
  });
});

describe("toTerritorySignals", () => {
  const ctx = {
    organizationId: ORG,
    ownerUserId: "user-1",
    setName: "Leadgrid — små bedrifter (feltsalg/leads)",
    naceNote: "Total",
    year: "2026",
    collectedAt: "2026-07-13T04:45:00.000Z",
  };

  it("gyldige region-signaler med geografi og granularitets-merking", () => {
    const oslo = parseTerritoryCounts(stat).filter((c) => c.regionCode === "03" && c.naceCode === "74");
    const [s] = toTerritorySignals(oslo, ctx);
    const v = validateNormalizedSignal(s);
    expect(v.errors ?? []).toEqual([]);
    expect(s.subjectType).toBe("region");
    expect(s.geography).toEqual({ country: "NO", region: "Oslo - Oslove" });
    expect(s.metadata.naceGranularity).toBe("2-siffer");
  });

  it("id inneholder sett-slug — to Leadgrid-sett med samme NACE kolliderer ikke", () => {
    const counts = parseTerritoryCounts(stat).filter((c) => c.regionCode === "03" && c.naceCode === "74");
    const a = toTerritorySignals(counts, ctx)[0];
    const b = toTerritorySignals(counts, { ...ctx, setName: "Leadgrid — salgsteam og større organisasjoner" })[0];
    expect(a.id).not.toBe(b.id);
    // ... men samme sett re-synket gir samme id (dedup-no-op)
    expect(toTerritorySignals(counts, ctx)[0].id).toBe(a.id);
  });
});
