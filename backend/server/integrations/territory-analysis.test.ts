import { describe, expect, it } from "vitest";

import { normalizeMunicipality, sumChildrenPerMunicipality } from "./territory-analysis.js";

describe("normalizeMunicipality", () => {
  it("normaliserer casing og samiske dobbeltnavn", () => {
    expect(normalizeMunicipality("Oslo - Oslove")).toBe("OSLO");
    expect(normalizeMunicipality("bergen")).toBe("BERGEN");
  });
});

describe("sumChildrenPerMunicipality", () => {
  it("summerer aldersgrupper per kommune, ignorerer fylker (2-sifret)", () => {
    const stat = {
      id: ["Region", "Kjonn", "Alder", "ContentsCode", "Tid"],
      size: [2, 1, 2, 1, 1],
      dimension: {
        Region: { category: { index: { "4601": 0, "46": 1 }, label: { "4601": "Bergen", "46": "Vestland" } } },
        Alder: { category: { index: { "006": 0, "007": 1 } } },
      },
      value: [3100, 3050, 99999, 99999],
    };
    const out = sumChildrenPerMunicipality(stat);
    expect(out).toHaveLength(1); // fylket (46) er ute
    expect(out[0]).toEqual({ code: "4601", name: "Bergen", children: 6150 });
  });
});
