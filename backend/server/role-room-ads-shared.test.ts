import { describe, it, expect } from "vitest";
import {
  recommendAdsBudget,
  computeManagementFee,
  billingPeriodForDate,
  buildChannelResults,
  INDUSTRY_FACTORS,
  ADS_METER_EVENT_NAMES,
  MANAGEMENT_FEE_RATE,
  VAT_RATE,
} from "./role-room-ads-shared.js";

describe("recommendAdsBudget", () => {
  it("Holy Crust scenario: 350k NOK restaurant ≈ 17 150 NOK/mnd ads", () => {
    const out = recommendAdsBudget({
      industryCategory: "restaurant",
      monthlyRevenueNok: 350_000,
      goal: "lead_generation",
      growthPhase: "established",
    });

    // restaurant midpoints: marketingShare 0.075, digitalAdsShare 0.70
    // 350 000 × 0.075 × 0.70 × 1.0 × 1.0 = 18 375 NOK
    expect(out.totalRecommendedNok).toBeCloseTo(18_375, 0);
    expect(out.rangeLowNok).toBeCloseTo(350_000 * 0.05 * 0.6, 0); // 10 500
    expect(out.rangeHighNok).toBeCloseTo(350_000 * 0.10 * 0.8, 0); // 28 000
  });

  it("splits Holy Crust across Meta / Google / TikTok per restaurant table", () => {
    const out = recommendAdsBudget({
      industryCategory: "restaurant",
      monthlyRevenueNok: 350_000,
    });
    const total = out.totalRecommendedNok;
    expect(out.perPlatform.meta).toBeCloseTo(total * 0.70, 1);
    expect(out.perPlatform.google).toBeCloseTo(total * 0.25, 1);
    expect(out.perPlatform.tiktok).toBeCloseTo(total * 0.05, 1);
    expect(out.perPlatform.linkedin).toBe(0);
  });

  it("management fee = 20 % påslag of recommended spend; incl. VAT applies 25 %", () => {
    const out = recommendAdsBudget({
      industryCategory: "restaurant",
      monthlyRevenueNok: 350_000,
    });
    expect(out.managementFeeNok).toBeCloseTo(out.totalRecommendedNok * 0.2, 1);
    expect(out.managementFeeRate).toBe(0.2);
    expect(out.managementFeeInclVatNok).toBeCloseTo(
      out.managementFeeNok * 1.25,
      1,
    );
  });

  it("per-client managementFeeRate override flows through the recommendation", () => {
    const out = recommendAdsBudget({
      industryCategory: "restaurant",
      monthlyRevenueNok: 350_000,
      managementFeeRate: 0.15,
    });
    expect(out.managementFeeRate).toBe(0.15);
    expect(out.managementFeeNok).toBeCloseTo(out.totalRecommendedNok * 0.15, 1);
  });

  it("ecommerce scales higher than restaurant for same revenue", () => {
    const restaurant = recommendAdsBudget({
      industryCategory: "restaurant",
      monthlyRevenueNok: 350_000,
    });
    const ecom = recommendAdsBudget({
      industryCategory: "ecommerce",
      monthlyRevenueNok: 350_000,
    });
    expect(ecom.totalRecommendedNok).toBeGreaterThan(restaurant.totalRecommendedNok);
  });

  it("growth-phase 'launch' multiplies by 1.3 vs 'established'", () => {
    const established = recommendAdsBudget({
      industryCategory: "ecommerce",
      monthlyRevenueNok: 100_000,
      growthPhase: "established",
    });
    const launch = recommendAdsBudget({
      industryCategory: "ecommerce",
      monthlyRevenueNok: 100_000,
      growthPhase: "launch",
    });
    expect(launch.totalRecommendedNok).toBeCloseTo(
      established.totalRecommendedNok * 1.3,
      1,
    );
  });

  it("retargeting goal pulls budget down (modifier 0.6)", () => {
    const lead = recommendAdsBudget({
      industryCategory: "ecommerce",
      monthlyRevenueNok: 100_000,
      goal: "lead_generation",
    });
    const retargeting = recommendAdsBudget({
      industryCategory: "ecommerce",
      monthlyRevenueNok: 100_000,
      goal: "retargeting",
    });
    expect(retargeting.totalRecommendedNok).toBeCloseTo(
      lead.totalRecommendedNok * 0.6,
      1,
    );
  });

  it("b2b_saas allocates LinkedIn share (other industries get 0)", () => {
    const b2b = recommendAdsBudget({
      industryCategory: "b2b_saas",
      monthlyRevenueNok: 200_000,
    });
    expect(b2b.perPlatform.linkedin).toBeGreaterThan(0);
    expect(b2b.perPlatform.tiktok).toBe(0);

    const restaurant = recommendAdsBudget({
      industryCategory: "restaurant",
      monthlyRevenueNok: 200_000,
    });
    expect(restaurant.perPlatform.linkedin).toBe(0);
  });

  it("industry 'other' returns a sensible generic baseline", () => {
    const out = recommendAdsBudget({
      industryCategory: "other",
      monthlyRevenueNok: 100_000,
    });
    expect(out.totalRecommendedNok).toBeGreaterThan(0);
    expect(out.rationale.industry).toContain("Ukjent");
  });

  it("zero revenue produces zero recommendation (no NaN/Infinity)", () => {
    const out = recommendAdsBudget({
      industryCategory: "restaurant",
      monthlyRevenueNok: 0,
    });
    expect(out.totalRecommendedNok).toBe(0);
    expect(out.managementFeeNok).toBe(0);
    expect(out.perPlatform.meta).toBe(0);
  });
});

describe("computeManagementFee", () => {
  it("computes 20 % påslag + 25 % MVA on 17 150 NOK spend (MedInnova §4.1)", () => {
    const out = computeManagementFee(17_150);
    const fee = 17_150 * 0.2; // 3 430
    expect(out.managementFeeRate).toBe(0.2);
    expect(out.managementFeeNok).toBeCloseTo(fee, 1);
    expect(out.vatNok).toBeCloseTo(fee * 0.25, 1);
    expect(out.totalInclVatNok).toBeCloseTo(fee * 1.25, 1);
  });

  it("honours a per-client fee-rate override", () => {
    const out = computeManagementFee(10_000, 0.15);
    expect(out.managementFeeRate).toBe(0.15);
    expect(out.managementFeeNok).toBeCloseTo(1_500, 1);
  });

  it("falls back to the default for out-of-range rates", () => {
    expect(computeManagementFee(10_000, -1).managementFeeRate).toBe(0.2);
    expect(computeManagementFee(10_000, 2).managementFeeRate).toBe(0.2);
    expect(computeManagementFee(10_000, NaN).managementFeeRate).toBe(0.2);
  });

  it("respects exported constants", () => {
    expect(MANAGEMENT_FEE_RATE).toBe(0.2);
    expect(VAT_RATE).toBe(0.25);
  });
});

describe("billingPeriodForDate", () => {
  it("formats YYYY-MM in UTC", () => {
    expect(billingPeriodForDate(new Date("2026-05-07T12:00:00Z"))).toBe("2026-05");
    expect(billingPeriodForDate(new Date("2026-01-31T23:59:00Z"))).toBe("2026-01");
    expect(billingPeriodForDate(new Date("2026-12-01T00:00:00Z"))).toBe("2026-12");
  });
});

describe("static configuration", () => {
  it("every industry's platform-allocation sums to 1.0", () => {
    for (const [key, factors] of Object.entries(INDUSTRY_FACTORS)) {
      const sum = Object.values(factors.platformAllocation).reduce(
        (a, b) => a + b,
        0,
      );
      expect(sum, `industry=${key}`).toBeCloseTo(1.0, 4);
    }
  });

  it("meter event names cover all 4 platforms", () => {
    expect(ADS_METER_EVENT_NAMES.meta).toBe("roleroom_ads_meta_spend_nok");
    expect(ADS_METER_EVENT_NAMES.google).toBe("roleroom_ads_google_spend_nok");
    expect(ADS_METER_EVENT_NAMES.tiktok).toBe("roleroom_ads_tiktok_spend_nok");
    expect(ADS_METER_EVENT_NAMES.linkedin).toBe("roleroom_ads_linkedin_spend_nok");
  });
});

describe("buildChannelResults", () => {
  it("computes ctr/cpc/roas/cost-per-conv per channel + totals", () => {
    const { perChannel, totals } = buildChannelResults([
      { platform: "meta", spendNok: 1000, impressions: 10000, clicks: 200, conversions: 10, conversionValueNok: 5000 },
      { platform: "google", spendNok: 500, impressions: 4000, clicks: 100, conversions: 5, conversionValueNok: 2500 },
    ]);
    // sorted by spend desc → meta first
    expect(perChannel[0].platform).toBe("meta");
    expect(perChannel[0].ctr).toBeCloseTo(2, 4); // 200/10000*100
    expect(perChannel[0].cpc).toBeCloseTo(5, 4); // 1000/200
    expect(perChannel[0].roas).toBeCloseTo(5, 4); // 5000/1000
    expect(perChannel[0].costPerConversionNok).toBeCloseTo(100, 4); // 1000/10

    expect(totals.platform).toBe("total");
    expect(totals.spendNok).toBe(1500);
    expect(totals.conversions).toBe(15);
    expect(totals.conversionValueNok).toBe(7500);
    expect(totals.roas).toBeCloseTo(5, 4); // 7500/1500
  });

  it("handles zero-spend/zero-impression channels without NaN", () => {
    const { perChannel, totals } = buildChannelResults([
      { platform: "linkedin", spendNok: 0, impressions: 0, clicks: 0, conversions: 0, conversionValueNok: 0 },
    ]);
    expect(perChannel[0].ctr).toBeNull();
    expect(perChannel[0].cpc).toBeNull();
    expect(perChannel[0].roas).toBeNull();
    expect(perChannel[0].costPerConversionNok).toBeNull();
    expect(totals.roas).toBeNull();
  });

  it("returns empty channels + zero totals for no data", () => {
    const { perChannel, totals } = buildChannelResults([]);
    expect(perChannel).toEqual([]);
    expect(totals.spendNok).toBe(0);
    expect(totals.roas).toBeNull();
  });
});
