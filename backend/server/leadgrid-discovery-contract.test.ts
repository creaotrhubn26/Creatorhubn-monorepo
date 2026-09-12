import { describe, expect, it } from "vitest";

import {
  buildDiscoverySearchPlan,
  decodeDiscoveryCursor,
  discoveryBriefSchema,
  discoveryDecisionSchema,
  discoveryHash,
  encodeDiscoveryCursor,
} from "./leadgrid-discovery-contract.js";

describe("Discovery wire contract", () => {
  it("requires explicit search scope and preserves valid zero coordinates", () => {
    expect(
      discoveryBriefSchema.safeParse({
        industry_queries: ["regnskapsbyrå"],
        geo: { latitude: 0, longitude: 0, radius_km: 5 },
      }).success,
    ).toBe(true);
    expect(
      discoveryBriefSchema.safeParse({
        industry_queries: ["regnskapsbyrå"],
      }).success,
    ).toBe(false);
    expect(
      discoveryBriefSchema.safeParse({
        industry_queries: ["59.110"],
        country_code: "NO",
      }).success,
    ).toBe(true);
    expect(
      discoveryBriefSchema.safeParse({
        industry_queries: ["59.110"],
        country_code: "SE",
      }).success,
    ).toBe(false);
  });

  it("rejects unsupported counts, radii and website assessment caps above target", () => {
    expect(
      discoveryBriefSchema.safeParse({
        industry_queries: ["restaurant"],
        target_count: 61,
        geo: { latitude: 59.9, longitude: 10.7, radius_km: 10 },
      }).success,
    ).toBe(false);
    expect(
      discoveryBriefSchema.safeParse({
        industry_queries: ["restaurant"],
        geo: { latitude: 59.9, longitude: 10.7, radius_km: 51 },
      }).success,
    ).toBe(false);

    const invalidCap = discoveryBriefSchema.safeParse({
      industry_queries: ["restaurant"],
      target_count: 5,
      enrichment_count: 6,
      geo: { latitude: 59.9, longitude: 10.7, radius_km: 10 },
    });
    expect(invalidCap.success).toBe(false);
    if (!invalidCap.success) {
      expect(invalidCap.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["enrichment_count"],
            message:
              "Taket for registrerte nettsider som kan vurderes, kan ikke være høyere enn antall kandidater.",
          }),
        ]),
      );
    }
  });

  it("supports exact multi-municipality profiles and rejects ambiguous area selectors", () => {
    const parsed = discoveryBriefSchema.parse({
      industry_queries: ["tannklinikk"],
      territory_code: "ost-nord",
      municipality_numbers: ["3222", "3205", "3222"],
      municipality_names: ["Nittedal"],
      organization_forms: ["as", "AS"],
      employee_count: { minimum: 5, maximum: 50 },
      organization_structure: "independent",
      website_requirement: "present",
      website_quality: { minimum_score: 65 },
      commercial_signals: {
        registered_in_vat_register: true,
        registered_in_business_register: true,
      },
    });
    expect(parsed).toMatchObject({
      territory_code: "ost-nord",
      municipality_numbers: ["3205", "3222"],
      municipality_names: ["Nittedal"],
      organization_forms: ["AS"],
      employee_count: { minimum: 5, maximum: 50 },
      website_quality: { minimum_score: 65 },
    });
    expect(
      discoveryBriefSchema.safeParse({
        industry_queries: ["tannklinikk"],
        city: "Oslo",
        municipality_numbers: ["0301"],
      }).success,
    ).toBe(false);
    expect(
      discoveryBriefSchema.safeParse({
        industry_queries: ["tannklinikk"],
        municipality_numbers: ["0301"],
        employee_count: { minimum: 2, maximum: 50 },
      }).success,
    ).toBe(false);
  });

  it("canonicalizes municipality name-number pairs without corrupting them", () => {
    const parsed = discoveryBriefSchema.parse({
      industry_queries: ["86.230"],
      municipality_numbers: ["3203", "3201"],
      municipality_names: ["Asker", "Bærum"],
    });

    expect(parsed.municipality_numbers).toEqual(["3201", "3203"]);
    expect(parsed.municipality_names).toEqual(["Bærum", "Asker"]);
  });

  it("exposes an active website cap and honest Brreg group evidence in the plan", () => {
    const plan = buildDiscoverySearchPlan(
      discoveryBriefSchema.parse({
        industry_queries: ["tannklinikk"],
        territory_code: "vest",
        municipality_numbers: ["3201", "3203"],
        target_count: 60,
        enrichment_count: 30,
        organization_structure: "independent",
        website_quality: { minimum_score: 65 },
      }),
    );
    expect(plan).toMatchObject({
      territory_code: "vest",
      area: {
        municipality_numbers: ["3201", "3203"],
        municipality_names: [],
      },
      requested_candidates: 60,
      enrichment_candidates: 30,
      evidence_scored_filters: {
        organization_structure: "independent",
        website_quality: {
          minimum_score: 65,
          assessment: "safe_registered_url_crawl",
          unknown_values_are_retained: true,
        },
      },
    });
    expect(plan.warnings).toEqual(
      expect.arrayContaining([
        {
          code: "website_quality_bounded_assessment",
          message:
            "Leadgrid kan vurdere maksimalt 30 Brreg-registrerte nettsider per kjøring. Taket brukes bare når nettsidekvalitet er aktivert. Utilgjengelige eller utrygge nettsteder beholdes som ukjent for manuell vurdering.",
        },
        {
          code: "organization_structure_evidence_limited",
          message:
            "Brreg-konserntilknytning vurderes bare fra Brregs eksplisitte konsernstruktur. Dette dokumenterer ikke kommersiell kjede- eller franchisetilknytning, og uavklarte virksomheter beholdes for manuell vurdering.",
        },
      ]),
    );

    const inactivePlan = buildDiscoverySearchPlan(
      discoveryBriefSchema.parse({
        industry_queries: ["tannklinikk"],
        municipality_numbers: ["0301"],
        target_count: 60,
        enrichment_count: 30,
      }),
    );
    expect(
      inactivePlan.evidence_scored_filters.website_quality.assessment,
    ).toBe("not_requested");
    expect(
      inactivePlan.warnings.some(
        (warning) => warning.code === "website_quality_bounded_assessment",
      ),
    ).toBe(false);
  });

  it("builds category-only searches for a hard map area", () => {
    const brief = discoveryBriefSchema.parse({
      industry_queries: ["regnskapsbyrå", "revisjon"],
      geo: { latitude: 59.91, longitude: 10.75, radius_km: 15 },
      target_count: 50,
      enrichment_count: 20,
    });
    const plan = buildDiscoverySearchPlan(brief);
    expect(plan.queries.map((query) => query.text_query)).toEqual([
      "regnskapsbyrå",
      "revisjon",
    ]);
    expect(plan.queries.every((query) => query.hard_geo_filter)).toBe(true);
    expect(plan.queries.every((query) => query.query_mode === "industry")).toBe(
      true,
    );
    expect(plan.estimated_search_pages).toBe(6);
  });

  it("keeps national organization-name searches separate from NACE searches", () => {
    const brief = discoveryBriefSchema.parse({
      industry_queries: ["59.110"],
      organization_name_queries: ["casting"],
      country_code: "NO",
      target_count: 40,
      enrichment_count: 20,
    });
    const plan = buildDiscoverySearchPlan(brief);

    expect(plan.area).toEqual({ country_code: "NO" });
    expect(plan.queries).toEqual([
      {
        text_query: "59.110",
        query_mode: "industry",
        hard_geo_filter: false,
      },
      {
        text_query: "casting",
        query_mode: "organization_name",
        hard_geo_filter: false,
      },
    ]);
    expect(plan.estimated_search_pages).toBe(6);
    expect(
      discoveryBriefSchema.safeParse({
        industry_queries: [],
        organization_name_queries: ["casting"],
        country_code: "NO",
      }).success,
    ).toBe(true);
  });

  it("keeps Fastlegeregister profiles inside the filters documented by NHN", () => {
    const brief = discoveryBriefSchema.parse({
      registry_source: "nhn_flr_public",
      industry_queries: ["86.210"],
      country_code: "NO",
      target_count: 60,
      enrichment_count: 30,
    });
    const plan = buildDiscoverySearchPlan(brief);

    expect(plan.source).toBe("nhn_flr_public");
    expect(plan.estimated_search_pages).toBe(1);
    expect(plan.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "nhn_flr_authorized_source" }),
      ]),
    );
    expect(
      discoveryBriefSchema.safeParse({
        ...brief,
        geo: { latitude: 59.91, longitude: 10.75, radius_km: 15 },
        country_code: null,
      }).success,
    ).toBe(false);
    expect(
      discoveryBriefSchema.safeParse({
        ...brief,
        employee_count: { minimum: 5, maximum: 50 },
      }).success,
    ).toBe(false);
    expect(
      discoveryBriefSchema.safeParse({
        ...brief,
        industry_queries: ["86.221"],
      }).success,
    ).toBe(false);
  });

  it("hashes equivalent objects identically", () => {
    expect(discoveryHash({ b: 2, a: { y: 1, x: 0 } })).toBe(
      discoveryHash({ a: { x: 0, y: 1 }, b: 2 }),
    );
  });

  it("requires a rejection reason", () => {
    expect(
      discoveryDecisionSchema.safeParse({ decision: "reject" }).success,
    ).toBe(false);
    expect(
      discoveryDecisionSchema.safeParse({
        decision: "approve",
        reason_code: "good_fit",
        confirmed_google_place_id: "ChIJ-confirmed-id",
      }).success,
    ).toBe(true);
    expect(
      discoveryDecisionSchema.safeParse({
        decision: "approve",
        confirmed_google_place_id: "bad place id",
      }).success,
    ).toBe(false);
    expect(
      discoveryDecisionSchema.safeParse({
        decision: "reject",
        reason_code: "not_relevant",
        confirmed_google_place_id: "ChIJ-confirmed-id",
      }).success,
    ).toBe(false);
  });

  it("round-trips opaque cursors and rejects junk", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(decodeDiscoveryCursor(encodeDiscoveryCursor(72, id))).toEqual({
      score: 72,
      id,
    });
    expect(decodeDiscoveryCursor("not-a-cursor")).toBeNull();
  });
});
