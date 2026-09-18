import { describe, expect, it } from "vitest";
import {
  normalizeSplitSheetContributorPercentages,
  splitSheetContributorForApi,
  splitSheetForApi,
} from "./split-sheets-routes";

describe("normalizeSplitSheetContributorPercentages", () => {
  it("stores repeating equal shares as exactly 100.00 percent", () => {
    const result = normalizeSplitSheetContributorPercentages(
      Array.from({ length: 6 }, (_, index) => ({
        name: `Contributor ${index + 1}`,
        percentage: 16.67,
        custom_fields: { compensationType: "share" },
      })),
    );

    expect(result.map((contributor) => contributor.percentage)).toEqual([
      16.67, 16.67, 16.67, 16.67, 16.67, 16.65,
    ]);
    expect(result.reduce((sum, contributor) => sum + contributor.percentage, 0)).toBe(100);
  });

  it("preserves a mixed agreement's share subtotal and zeroes fee rows", () => {
    const result = normalizeSplitSheetContributorPercentages([
      { name: "Producer", percentage: 30, custom_fields: { compensationType: "share" } },
      { name: "Photographer", percentage: 40, custom_fields: { compensationType: "hourly" } },
      { name: "Artist", percentage: 30, custom_fields: { compensationType: "share" } },
    ]);

    expect(result.map((contributor) => contributor.percentage)).toEqual([30, 0, 30]);
    expect(result.reduce((sum, contributor) => sum + contributor.percentage, 0)).toBe(60);
  });

  it("does not invent a distribution for zero-weight shares", () => {
    const result = normalizeSplitSheetContributorPercentages([
      { name: "A", percentage: 0 },
      { name: "B", percentage: null },
      { name: "C", percentage: "invalid" },
    ]);

    expect(result.map((contributor) => contributor.percentage)).toEqual([0, 0, 0]);
  });

  it("preserves a pure-share subtotal that is not a rounding variant of 100", () => {
    const result = normalizeSplitSheetContributorPercentages([
      { name: "A", percentage: 60 },
      { name: "B", percentage: 30 },
    ]);

    expect(result.map((contributor) => contributor.percentage)).toEqual([60, 30]);
  });

  it("returns zero total when an agreement contains no share participants", () => {
    const result = normalizeSplitSheetContributorPercentages([
      { name: "Hourly", percentage: 100, custom_fields: { compensationType: "hourly" } },
      { name: "Fixed", percentage: 100, custom_fields: { compensationType: "fixed" } },
    ]);

    expect(result.map((contributor) => contributor.percentage)).toEqual([0, 0]);
  });

  it("canonicalizes hourly terms before persistence", () => {
    const [result] = normalizeSplitSheetContributorPercentages([{
      name: "Hourly",
      percentage: 100,
      custom_fields: {
        compensationType: "hourly",
        hourlyRate: 850.555,
        estimatedHours: 7.5,
        estimatedAmount: 1,
        currency: "nok",
      },
    }]);

    expect(result.percentage).toBe(0);
    expect(result.custom_fields).toMatchObject({
      hourlyRate: 850.56,
      estimatedHours: 7.5,
      estimatedAmount: 6379.2,
      currency: "NOK",
      feeAmount: 850.56,
    });
  });

  it("serializes PostgreSQL numeric fields as JSON numbers", () => {
    expect(splitSheetForApi({
      total_percentage: "50.00",
      contributor_count: "2",
      signed_count: "1",
    })).toMatchObject({
      total_percentage: 50,
      contributor_count: 2,
      signed_count: 1,
    });
    expect(splitSheetContributorForApi({ percentage: "33.33" }).percentage).toBe(33.33);
  });
});
