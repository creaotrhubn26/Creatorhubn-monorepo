import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readWhatsAppBillingPricing } from "./casting-whatsapp-billing.js";

describe("readWhatsAppBillingPricing", () => {
  const ENV_KEYS = [
    "CASTING_WHATSAPP_RETAIL_PRICE_NOK_EX_VAT",
    "CASTING_WHATSAPP_VAT_RATE",
    "CASTING_WHATSAPP_COST_NOK",
  ] as const;

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("uses defaults: 0.80 NOK ex-VAT @ 25% MVA, 0.34 cost", () => {
    const p = readWhatsAppBillingPricing();
    expect(p.retailPriceNokExVat).toBe(0.8);
    expect(p.vatRate).toBe(0.25);
    expect(p.retailPriceNokInclVat).toBeCloseTo(1.0, 2);
    expect(p.costNok).toBe(0.34);
    expect(p.marginNokExVat).toBeCloseTo(0.46, 2);
  });

  it("respects retail-price override with comma decimal", () => {
    process.env.CASTING_WHATSAPP_RETAIL_PRICE_NOK_EX_VAT = "1,20";
    const p = readWhatsAppBillingPricing();
    expect(p.retailPriceNokExVat).toBe(1.2);
    expect(p.retailPriceNokInclVat).toBeCloseTo(1.5, 2);
  });

  it("falls back to default on negative or non-numeric", () => {
    process.env.CASTING_WHATSAPP_RETAIL_PRICE_NOK_EX_VAT = "-1";
    expect(readWhatsAppBillingPricing().retailPriceNokExVat).toBe(0.8);
    process.env.CASTING_WHATSAPP_RETAIL_PRICE_NOK_EX_VAT = "garbage";
    expect(readWhatsAppBillingPricing().retailPriceNokExVat).toBe(0.8);
  });

  it("respects custom VAT rate (e.g., for non-Norwegian markets)", () => {
    process.env.CASTING_WHATSAPP_VAT_RATE = "0.21";
    const p = readWhatsAppBillingPricing();
    expect(p.vatRate).toBe(0.21);
    expect(p.retailPriceNokInclVat).toBeCloseTo(0.97, 2);
  });
});
