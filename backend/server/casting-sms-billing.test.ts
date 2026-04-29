import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  currentBillingPeriod,
  readSmsBillingPricing,
} from "./casting-sms-billing.js";

describe("readSmsBillingPricing", () => {
  const ENV_KEYS = [
    "CASTING_SMS_RETAIL_PRICE_NOK_EX_VAT",
    "CASTING_SMS_VAT_RATE",
    "CASTING_SMS_COST_NOK",
  ] as const;

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("uses defaults when env not set: 2.00 ex-VAT @ 25% MVA", () => {
    const pricing = readSmsBillingPricing();
    expect(pricing.retailPriceNokExVat).toBe(2.0);
    expect(pricing.vatRate).toBe(0.25);
    expect(pricing.retailPriceNokInclVat).toBe(2.5);
    expect(pricing.costNok).toBe(0.65);
    expect(pricing.marginNokExVat).toBeCloseTo(1.35, 2);
  });

  it("respects CASTING_SMS_RETAIL_PRICE_NOK_EX_VAT", () => {
    process.env.CASTING_SMS_RETAIL_PRICE_NOK_EX_VAT = "3.50";
    const pricing = readSmsBillingPricing();
    expect(pricing.retailPriceNokExVat).toBe(3.5);
    expect(pricing.retailPriceNokInclVat).toBe(4.38);
  });

  it("supports comma decimal separator (Norwegian locale)", () => {
    process.env.CASTING_SMS_RETAIL_PRICE_NOK_EX_VAT = "2,50";
    const pricing = readSmsBillingPricing();
    expect(pricing.retailPriceNokExVat).toBe(2.5);
  });

  it("falls back to defaults on negative or non-numeric input", () => {
    process.env.CASTING_SMS_RETAIL_PRICE_NOK_EX_VAT = "-1";
    expect(readSmsBillingPricing().retailPriceNokExVat).toBe(2.0);
    process.env.CASTING_SMS_RETAIL_PRICE_NOK_EX_VAT = "abc";
    expect(readSmsBillingPricing().retailPriceNokExVat).toBe(2.0);
  });

  it("respects custom VAT rate", () => {
    process.env.CASTING_SMS_VAT_RATE = "0.15";
    const pricing = readSmsBillingPricing();
    expect(pricing.vatRate).toBe(0.15);
    expect(pricing.retailPriceNokInclVat).toBe(2.3);
  });
});

describe("currentBillingPeriod", () => {
  it("formats as YYYY-MM in UTC", () => {
    expect(currentBillingPeriod(new Date("2026-04-29T12:00:00Z"))).toBe(
      "2026-04",
    );
    expect(currentBillingPeriod(new Date("2026-12-31T23:59:00Z"))).toBe(
      "2026-12",
    );
    expect(currentBillingPeriod(new Date("2027-01-01T00:00:00Z"))).toBe(
      "2027-01",
    );
  });
});
