import { describe, expect, it } from "vitest";

import { scoreDiscoveryCandidate } from "./leadgrid-discovery-scoring.js";

const base = {
  candidateName: "Oslo Regnskap AS",
  address: "Storgata 1, Oslo",
  latitude: 59.91,
  longitude: 10.75,
  distanceMeters: 1_000,
  radiusMeters: 10_000,
  naceCode: "69.201",
  naceDescription: "Regnskap og bokføring",
  website: "https://oslo-regnskap.no",
  phone: null,
  organizationNumber: "999999999",
  companyStatus: "active" as const,
  industryQueries: ["regnskap"],
  exclusionTerms: [],
};

describe("Discovery scoring", () => {
  it("keeps fit and data quality separate and explainable", () => {
    const score = scoreDiscoveryCandidate(base);
    expect(score.fitScore).toBeGreaterThan(70);
    expect(score.dataQualityScore).toBe(100);
    expect(score.dataQualityCoverage).toBeLessThan(1);
    expect(score.fitCoverage).toBe(1);
    expect(score.reasons).toContain("Ligger innenfor valgt område");
    expect(score.explanation).toHaveProperty("fit_contributions");
  });

  it("makes exclusions explicit", () => {
    const score = scoreDiscoveryCandidate({
      ...base,
      exclusionTerms: ["oslo regnskap"],
    });
    expect(score.excluded).toBe(true);
    expect(score.exclusionMatches).toEqual(["oslo regnskap"]);
    expect(
      score.factors.fit.find((factor) => factor.key === "industry_relevance")
        ?.value,
    ).toBe(0);
  });

  it("does not turn missing enrichment or geo into fake evidence", () => {
    const score = scoreDiscoveryCandidate({
      ...base,
      latitude: null,
      longitude: null,
      distanceMeters: null,
      companyStatus: null,
      organizationNumber: null,
    });
    expect(score.fitCoverage).toBeLessThan(1);
    expect(
      score.factors.fit.find((factor) => factor.key === "geography")?.value,
    ).toBeNull();
    expect(
      score.factors.fit.find((factor) => factor.key === "company_status")
        ?.value,
    ).toBeNull();
  });

  it("treats provider fields that were not investigated as unknown", () => {
    const score = scoreDiscoveryCandidate({
      ...base,
      website: null,
      phone: null,
      organizationNumber: null,
      websiteKnown: false,
      phoneKnown: false,
      organizationNumberKnown: false,
    });

    expect(score.dataQualityCoverage).toBeLessThan(1);
    for (const key of ["website", "phone", "organization_number"]) {
      expect(
        score.factors.dataQuality.find((factor) => factor.key === key)?.value,
      ).toBeNull();
    }
  });

  it("uses ideal-customer text as declared lexical evidence and enforces the threshold", () => {
    const score = scoreDiscoveryCandidate({
      ...base,
      candidateName: "Oslo Tannlegeklinikk AS",
      naceCode: "86.230",
      naceDescription: "Tannhelsetjenester",
      industryQueries: ["lokal bedrift"],
      idealCustomer: "tannlegeklinikk med lokal kundebase",
      minimumFitScore: 99,
    });

    expect(
      score.factors.fit
        .find((factor) => factor.key === "industry_relevance")
        ?.evidence.some(
          (evidence) => evidence.ref === "discovery.brief.ideal_customer",
        ),
    ).toBe(true);
    expect(score.excluded).toBe(true);
    expect(
      score.reasons.some((reason) => reason.includes("minstegrense")),
    ).toBe(true);
    expect(score.explanation).toMatchObject({
      minimum_fit_threshold: {
        source: "discovery.brief.minimum_fit_score",
        minimum: 99,
        outcome: "excluded",
      },
    });
  });
});
