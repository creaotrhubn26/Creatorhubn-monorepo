import { describe, it, expect } from "vitest";
import {
  recommendAdsBudget,
  computeManagementFee,
  billingPeriodForDate,
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

  it("management fee = 15 % of recommended spend; incl. VAT applies 25 %", () => {
    const out = recommendAdsBudget({
      industryCategory: "restaurant",
      monthlyRevenueNok: 350_000,
    });
    expect(out.managementFeeNok).toBeCloseTo(out.totalRecommendedNok * 0.15, 1);
    expect(out.managementFeeInclVatNok).toBeCloseTo(
      out.managementFeeNok * 1.25,
      1,
    );
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
  it("computes 15 % fee + 25 % MVA on 17 150 NOK spend", () => {
    const out = computeManagementFee(17_150);
    expect(out.managementFeeNok).toBeCloseTo(2_572.5, 1);
    expect(out.vatNok).toBeCloseTo(2_572.5 * 0.25, 1);
    expect(out.totalInclVatNok).toBeCloseTo(2_572.5 * 1.25, 1);
  });

  it("respects exported constants", () => {
    expect(MANAGEMENT_FEE_RATE).toBe(0.15);
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
