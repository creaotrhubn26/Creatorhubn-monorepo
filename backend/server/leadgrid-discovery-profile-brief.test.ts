import { describe, expect, it } from "vitest";

import { discoveryBriefSchema } from "./leadgrid-discovery-contract.js";
import { canonicalDiscoveryProfileBrief } from "./leadgrid-discovery-profile-brief.js";

describe("canonical Discovery profile brief", () => {
  it("strips legacy migration metadata and restores denormalized profile fields", () => {
    const brief = canonicalDiscoveryProfileBrief({
      target_customer_types: ["tannklinikk"],
      city_filters: ["Oslo"],
      geography_lat: null,
      geography_lng: null,
      geography_radius_km: 25,
      company_size_min: 5,
      company_size_max: null,
      max_candidates_per_run: 60,
      enrichment_count: 30,
      brief: {
        ideal_customer: "Uavhengig tannklinikk",
        minimum_fit_score: 65,
        migrated_from: "leadgrid_project_discovery_config",
        migration_audit: { migrated_at: "2026-01-01T00:00:00Z" },
      },
    });

    expect(discoveryBriefSchema.parse(brief)).toEqual(brief);
    expect(brief).toMatchObject({
      industry_queries: ["tannklinikk"],
      city: "Oslo",
      target_count: 60,
      enrichment_count: 30,
      minimum_fit_score: 65,
      employee_count: { minimum: 5, maximum: null },
    });
    expect(brief).not.toHaveProperty("migrated_from");
    expect(brief).not.toHaveProperty("migration_audit");
  });

  it("preserves organization-name queries and an explicit national scope", () => {
    const brief = canonicalDiscoveryProfileBrief({
      target_customer_types: [],
      city_filters: [],
      geography_lat: null,
      geography_lng: null,
      geography_radius_km: 25,
      company_size_min: null,
      company_size_max: null,
      max_candidates_per_run: 40,
      enrichment_count: 20,
      brief: {
        organization_name_queries: ["casting"],
        country_code: "NO",
        exclusion_terms: ["støperi"],
        minimum_fit_score: 70,
      },
    });

    expect(discoveryBriefSchema.parse(brief)).toEqual(brief);
    expect(brief).toMatchObject({
      industry_queries: [],
      organization_name_queries: ["casting"],
      country_code: "NO",
      city: null,
      geo: null,
      minimum_fit_score: 70,
    });
  });
});
