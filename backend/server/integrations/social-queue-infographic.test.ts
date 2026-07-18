import { describe, expect, it, vi } from "vitest";

// Unngå å laste render-motoren (puppeteer) — vi tester kun den rene mappingen.
vi.mock("../infographic-render.js", () => ({ renderInfographicToBuffer: async () => null }));

import { factsToCards } from "./social-queue-infographic.js";

describe("factsToCards — faktagrunnlag → kpi-kort", () => {
  it("mapper label/value og beholder rekkefølge", () => {
    const cards = factsToCards([
      { source: "enhetsregisteret", label: "Marked", value: "8961 virksomheter" },
      { source: "ssb", label: "Vekst", value: "12 %" },
    ]);
    expect(cards).toEqual([
      { value: "8961 virksomheter", label: "Marked" },
      { value: "12 %", label: "Vekst" },
    ]);
  });

  it("kapper til 4 kort", () => {
    const cards = factsToCards(Array.from({ length: 7 }, (_, i) => ({ label: `L${i}`, value: i })));
    expect(cards).toHaveLength(4);
    expect(cards[0]).toEqual({ value: "0", label: "L0" });
  });

  it("filtrerer bort tomme label / manglende value", () => {
    const cards = factsToCards([
      { label: "Ok", value: 5 },
      { label: "", value: 9 },
      { label: "  ", value: 1 },
      { label: "Uten verdi", value: null },
      { label: "Uten verdi 2" },
    ]);
    expect(cards).toEqual([{ value: "5", label: "Ok" }]);
  });

  it("ikke-array → tomt", () => {
    expect(factsToCards(null)).toEqual([]);
    expect(factsToCards("nope")).toEqual([]);
    expect(factsToCards(undefined)).toEqual([]);
  });
});
