import { describe, expect, it, vi } from "vitest";

import {
  LEADGRID_PLANS,
  normalizeInterval,
  normalizePlanKey,
  resolvePlanPrice,
  verifyStripePrices,
} from "./leadgrid-stripe-plans.js";

describe("plannøkler", () => {
  it("oversetter prissidens «pro» til billing-nøkkelen «solo_pro»", () => {
    // Prissiden og Stripe kalte samme plan to forskjellige ting. Den
    // oversettelsen skal ligge i kode, ikke i hodet til den som leser.
    expect(normalizePlanKey("pro")).toBe("solo_pro");
    expect(normalizePlanKey("SOLO_PRO")).toBe("solo_pro");
    expect(normalizePlanKey("agency")).toBe("agency");
  });

  it("avviser en plan vi ikke selger", () => {
    expect(normalizePlanKey("enterprise")).toBeNull();
    expect(normalizePlanKey("")).toBeNull();
  });

  it("tolker intervallet som måned når noe annet enn år er oppgitt", () => {
    expect(normalizeInterval("year")).toBe("year");
    expect(normalizeInterval("yearly")).toBe("year");
    expect(normalizeInterval(undefined)).toBe("month");
    expect(normalizeInterval("kvartal")).toBe("month");
  });
});

describe("resolvePlanPrice", () => {
  it("bruker Render-verdien når den finnes, og sier hvor den kom fra", () => {
    const ut = resolvePlanPrice("solo_pro", "month", {
      LEADGRID_PRICE_SOLO_MONTH: "price_fra_render",
    } as NodeJS.ProcessEnv);
    expect(ut).toMatchObject({ priceId: "price_fra_render", source: "env" });
  });

  it("faller tilbake til den innebygde verdien og flagger det", () => {
    const ut = resolvePlanPrice("agency", "year", {} as NodeJS.ProcessEnv);
    expect(ut.priceId).toBe(LEADGRID_PLANS.agency.fallback.year);
    expect(ut.source).toBe("fallback");
    expect(ut.envName).toBe("LEADGRID_PRICE_AGENCY_YEAR");
  });
});

describe("verifyStripePrices", () => {
  const env = {
    LEADGRID_PRICE_SOLO_MONTH: "price_solo_m",
    LEADGRID_PRICE_SOLO_YEAR: "price_solo_y",
    LEADGRID_PRICE_AGENCY_MONTH: "price_agency_m",
    LEADGRID_PRICE_AGENCY_YEAR: "price_agency_y",
    LEADGRID_PRICE_AI_STRUCTURE: "price_ai",
    LEADGRID_PRICE_STORAGE_100_GIB: "price_lagring",
  } as NodeJS.ProcessEnv;

  const prisSvar = (over: Record<string, unknown> = {}) => ({
    active: true,
    currency: "nok",
    unit_amount: 79900,
    recurring: { interval: "month" },
    product: { name: "Leadgrid Solo Pro" },
    ...over,
  });

  it("melder fra når en pris er deaktivert i Stripe", async () => {
    const stripe = {
      prices: { retrieve: vi.fn(async () => prisSvar({ active: false })) },
    } as never;
    const ut = await verifyStripePrices(stripe, env);
    expect(ut.ok).toBe(false);
    expect(ut.checks[0].problems).toContain("Prisen er deaktivert i Stripe.");
  });

  it("melder fra når valutaen ikke er NOK", async () => {
    const stripe = {
      prices: { retrieve: vi.fn(async () => prisSvar({ currency: "usd" })) },
    } as never;
    const ut = await verifyStripePrices(stripe, env);
    expect(ut.checks[0].problems.some((p) => p.includes("USD"))).toBe(true);
  });

  it("melder fra når vi selger en månedspris som årlig", async () => {
    // Den dyreste feilen i listen: kunden betaler en tolvtedel av det vi tror.
    const stripe = {
      prices: {
        retrieve: vi.fn(async (id: string) =>
          prisSvar(id.endsWith("_y") ? { recurring: { interval: "month" } } : {}),
        ),
      },
    } as never;
    const ut = await verifyStripePrices(stripe, env);
    const årlig = ut.checks.find((c) => c.interval === "year");
    expect(årlig?.problems.some((p) => p.includes("årlig"))).toBe(true);
  });

  it("flagger en variabel som ikke er satt i Render", async () => {
    const stripe = { prices: { retrieve: vi.fn(async () => prisSvar()) } } as never;
    const ut = await verifyStripePrices(stripe, {
      ...env,
      LEADGRID_PRICE_AI_STRUCTURE: "",
      LEADGRID_PRICE_STORAGE_100_GIB: "",
    } as NodeJS.ProcessEnv);
    const ai = ut.checks.find((c) => c.envName === "LEADGRID_PRICE_AI_STRUCTURE");
    expect(ai?.source).toBe("mangler");
    expect(ai?.problems[0]).toContain("ikke satt i Render");
  });

  it("flagger innebygd verdi selv når Stripe svarer at prisen er i orden", async () => {
    const stripe = { prices: { retrieve: vi.fn(async () => prisSvar()) } } as never;
    const ut = await verifyStripePrices(stripe, {} as NodeJS.ProcessEnv);
    expect(ut.ok).toBe(false);
    expect(
      ut.checks.find((c) => c.envName === "LEADGRID_PRICE_SOLO_MONTH")?.problems[0],
    ).toContain("ikke satt i Render");
  });

  it("sier ifra at Stripe ikke er tilgjengelig i stedet for å påstå at alt er greit", async () => {
    const ut = await verifyStripePrices(null, env);
    expect(ut.stripe_available).toBe(false);
    expect(ut.checks.every((c) => c.stripe === null)).toBe(true);
  });

  it("er grønn når alt er satt i Render og Stripe er enig", async () => {
    const stripe = {
      prices: {
        retrieve: vi.fn(async (id: string) =>
          prisSvar({
            recurring: id.endsWith("_y")
              ? { interval: "year" }
              : id.startsWith("price_ai") || id.startsWith("price_lagring")
                ? { interval: "month" }
                : { interval: "month" },
          }),
        ),
      },
    } as never;
    const ut = await verifyStripePrices(stripe, env);
    expect(ut.checks.flatMap((c) => c.problems)).toEqual([]);
    expect(ut.ok).toBe(true);
  });
});
