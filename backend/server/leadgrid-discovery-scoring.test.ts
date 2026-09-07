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

  it("scores explicit Brreg company evidence and excludes known filter mismatches", () => {
    const matching = scoreDiscoveryCandidate({
      ...base,
      municipalityNumber: "0301",
      requiredMunicipalityNumbers: ["0301", "3201"],
      organizationFormCode: "AS",
      requiredOrganizationForms: ["AS"],
      employeeCount: 12,
      employeeCountKnown: true,
      minimumEmployees: 5,
      maximumEmployees: 50,
      registeredInVatRegister: true,
      registeredInVatRegisterKnown: true,
      requiredVatRegistration: true,
      registeredInBusinessRegister: true,
      registeredInBusinessRegisterKnown: true,
      requiredBusinessRegistration: true,
    });
    expect(matching.excluded).toBe(false);
    expect(matching.explanation).toMatchObject({ filter_mismatches: [] });
    expect(
      matching.factors.fit.find((factor) => factor.key === "employee_count")
        ?.evidence,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ref: "brreg.employee_count", value: 12 }),
      ]),
    );

    const outsideMunicipalities = scoreDiscoveryCandidate({
      ...base,
      municipalityNumber: "1103",
      requiredMunicipalityNumbers: ["0301", "3201"],
    });
    expect(outsideMunicipalities.excluded).toBe(true);
    expect(outsideMunicipalities.explanation).toMatchObject({
      filter_mismatches: ["municipality"],
    });
  });

  it("retains unknown structure and website quality without treating unknown as poor", () => {
    const score = scoreDiscoveryCandidate({
      ...base,
      organizationStructure: "unknown",
      requiredOrganizationStructure: "chain",
      organizationStructureEvidence: {
        sourceUri:
          "https://data.brreg.no/enhetsregisteret/api/konsernstruktur/999999999",
        basis: "not_found",
        relatedOrganizationCount: null,
      },
      minimumWebsiteQualityScore: 70,
      websiteQuality: {
        status: "unknown",
        score: null,
        fetchedAt: "2026-09-05T12:00:00.000Z",
        sourceUri: "https://oslo-regnskap.no",
        finalUrl: null,
        httpStatus: null,
        redirectCount: 0,
        reason: "request_failed",
        signals: {
          https: null,
          reachable: null,
          title: null,
          meta_description: null,
          viewport: null,
          contact_path: null,
          call_to_action: null,
        },
      },
    });

    expect(score.excluded).toBe(false);
    expect(score.explanation).toMatchObject({
      filter_mismatches: [],
      unknown_filter_evidence: ["organization_structure", "website_quality"],
      website_quality: {
        status: "unknown",
        score: null,
        outcome: "unknown",
        reason: "request_failed",
      },
    });
    expect(
      score.factors.fit.find(
        (factor) => factor.key === "organization_structure",
      )?.evidence,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Brreg-konserntilknytning",
          value: "unknown",
        }),
      ]),
    );
  });

  it("excludes an assessed website below the declared quality threshold", () => {
    const score = scoreDiscoveryCandidate({
      ...base,
      minimumWebsiteQualityScore: 70,
      websiteQuality: {
        status: "assessed",
        score: 45,
        fetchedAt: "2026-09-05T12:00:00.000Z",
        sourceUri: "https://oslo-regnskap.no",
        finalUrl: "https://oslo-regnskap.no/",
        httpStatus: 200,
        redirectCount: 0,
        reason: "assessed",
        signals: {
          https: true,
          reachable: true,
          title: false,
          meta_description: false,
          viewport: false,
          contact_path: false,
          call_to_action: false,
        },
      },
    });

    expect(score.excluded).toBe(true);
    expect(score.explanation).toMatchObject({
      filter_mismatches: ["website_quality"],
      website_quality: {
        status: "assessed",
        score: 45,
        minimum_score: 70,
        outcome: "excluded",
        evidence: {
          source_uri: "https://oslo-regnskap.no",
          http_status: 200,
        },
      },
    });
  });
});
