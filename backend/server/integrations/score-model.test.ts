import { describe, expect, it } from "vitest";

import {
  computeScore,
  defaultGeoOpportunityConfig,
  GEO_OPPORTUNITY_PROPOSED_WEIGHTS,
  geoOpportunityConfigSchema,
  normalizeMomentum,
  normalizeVolume,
  topicsOverlap,
  type FactorValue,
} from "./score-model.js";

const f = (key: string, value: number | null): FactorValue => ({ key, value, evidence: [] });

describe("computeScore (No Fake Scores)", () => {
  const weights = { a: 50, b: 30, c: 20 };

  it("full dekning: vektet sum på 0–100 med dekomponering", () => {
    const out = computeScore([f("a", 1), f("b", 0.5), f("c", 0)], weights);
    expect(out.score).toBe(65); // 50 + 15 + 0
    expect(out.coverage).toBe(1);
    const sum = out.contributions.reduce((s, c) => s + (c.points ?? 0), 0);
    expect(Math.round(sum)).toBe(out.score);
  });

  it("manglende faktor: vekten OMFORDELES og dekningen synker — aldri stille 0", () => {
    const out = computeScore([f("a", 1), f("b", null), f("c", null)], weights);
    expect(out.score).toBe(100); // a er eneste med data → full vekt
    expect(out.coverage).toBe(0.5); // 50 av 100 vektpoeng har data
    expect(out.contributions.find((c) => c.key === "b")?.points).toBeNull();
  });

  it("ingen data i det hele tatt → score null, ikke 0", () => {
    const out = computeScore([f("a", null), f("b", null)], { a: 50, b: 50 });
    expect(out.score).toBeNull();
    expect(out.coverage).toBe(0);
  });

  it("verdier klippes til 0–1 før vekting", () => {
    const out = computeScore([f("a", 7)], { a: 100 });
    expect(out.score).toBe(100);
  });
});

describe("config-skjemaet (Daniels justeringsflate)", () => {
  it("godtar forslags-configen", () => {
    expect(geoOpportunityConfigSchema.safeParse(defaultGeoOpportunityConfig()).success).toBe(true);
  });

  it("avviser ukjente faktorer, vekter utenfor 0–100 og verdier utenfor 1–10", () => {
    const base = defaultGeoOpportunityConfig();
    expect(
      geoOpportunityConfigSchema.safeParse({ ...base, weights: { ...base.weights, hemmelig: 5 } })
        .success,
    ).toBe(false);
    expect(
      geoOpportunityConfigSchema.safeParse({ ...base, weights: { ...base.weights, gap: 150 } })
        .success,
    ).toBe(false);
    expect(
      geoOpportunityConfigSchema.safeParse({
        ...base,
        commercialValues: { "11111111-2222-3333-4444-555555555555": 12 },
      }).success,
    ).toBe(false);
  });

  it("avviser alle-null-vekter (scoren ville vært udefinert)", () => {
    const zeroed = Object.fromEntries(Object.keys(GEO_OPPORTUNITY_PROPOSED_WEIGHTS).map((k) => [k, 0]));
    expect(
      geoOpportunityConfigSchema.safeParse({ weights: zeroed, commercialValues: {} }).success,
    ).toBe(false);
  });
});

describe("tema-kobling og normalisering", () => {
  it("topicsOverlap: deterministisk ord-overlapp, ignorerer stoppord og korte ord", () => {
    expect(topicsOverlap("hvordan-skaffe-leads", "skaffe leads i felt")).toBe(true);
    expect(topicsOverlap("pris", "prisliste dansekurs")).toBe(false); // 'pris' ≠ 'prisliste' (ingen stemming — bevisst)
    expect(topicsOverlap("casting og audition", "audition-tips")).toBe(true);
    expect(topicsOverlap("og for med", "og for")).toBe(false); // kun stoppord
  });

  it("normalizeVolume: log-skala, klippet til 1", () => {
    expect(normalizeVolume(0)).toBe(0);
    expect(normalizeVolume(100)).toBeCloseTo(0.334, 2);
    expect(normalizeVolume(10_000_000)).toBe(1);
  });

  it("normalizeMomentum: 0 % → 0.5, ±100 % → hele skalaen", () => {
    expect(normalizeMomentum(0)).toBe(0.5);
    expect(normalizeMomentum(100)).toBe(1);
    expect(normalizeMomentum(-100)).toBe(0);
    expect(normalizeMomentum(500)).toBe(1); // klippes
  });
});
