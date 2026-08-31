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
  it("requires explicit geography and preserves valid zero coordinates", () => {
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
  });

  it("rejects unsupported counts, radii and enrichment above target", () => {
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
        target_count: 5,
        enrichment_count: 6,
        geo: { latitude: 59.9, longitude: 10.7, radius_km: 51 },
      }).success,
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
    expect(plan.estimated_search_pages).toBe(6);
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
      }).success,
    ).toBe(true);
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
