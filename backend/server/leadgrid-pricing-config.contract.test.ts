/**
 * leadgrid-pricing-config.contract.test.ts
 *
 * Pinner NØKKEL-FORMEN på DEFAULT_PRICING_CONFIG (runtime-kilden). Formen speiles
 * i tre andre kopier som ikke kan importere backend-typen:
 *   • frontend/shared/leadgridPricingConfig.ts  (landing + admin-editor)
 *   • ipad/.../Core/APIClient+LeadgridPricing.swift  (Codable-DTO-er)
 *
 * Feiler denne testen fordi du bevisst endret formen? Da må du oppdatere begge
 * speil-kopiene over FØR du oppdaterer forventningene her. Det er hele poenget:
 * drift blir fanget i CT i stedet for å gå stille ut på leadgrid.no / iPad.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING_CONFIG } from "./leadgrid-pricing-config-routes";

const TIER_KEYS = ["key", "name", "price", "tagline", "priceNote", "popular", "cta", "features"];
const MODULE_KEYS = ["key", "title", "desc", "priceSoloPro", "priceAgency", "accent", "active"];
const BUNDLE_KEYS = ["active", "priceAgency", "label"];

const sortedKeys = (o: object) => Object.keys(o).sort();

describe("leadgrid pricing-config kontrakt", () => {
  it("har top-nivå tiers/modules/bundle", () => {
    expect(sortedKeys(DEFAULT_PRICING_CONFIG)).toEqual(["bundle", "modules", "tiers"]);
  });

  it("hver tier har nøyaktig camelCase-nøklene", () => {
    for (const tier of DEFAULT_PRICING_CONFIG.tiers) {
      expect(sortedKeys(tier)).toEqual([...TIER_KEYS].sort());
    }
    expect(DEFAULT_PRICING_CONFIG.tiers.length).toBeGreaterThan(0);
  });

  it("hver modul har nøyaktig camelCase-nøklene", () => {
    for (const mod of DEFAULT_PRICING_CONFIG.modules) {
      expect(sortedKeys(mod)).toEqual([...MODULE_KEYS].sort());
    }
    expect(DEFAULT_PRICING_CONFIG.modules.length).toBeGreaterThan(0);
  });

  it("bundle har nøyaktig camelCase-nøklene", () => {
    expect(sortedKeys(DEFAULT_PRICING_CONFIG.bundle)).toEqual([...BUNDLE_KEYS].sort());
  });

  it("felt-typer er som forventet (number for priser, bool for flagg)", () => {
    const t = DEFAULT_PRICING_CONFIG.tiers[0];
    expect(typeof t.price).toBe("number");
    expect(typeof t.popular).toBe("boolean");
    expect(Array.isArray(t.features)).toBe(true);
    const m = DEFAULT_PRICING_CONFIG.modules[0];
    expect(typeof m.priceSoloPro).toBe("number");
    expect(typeof m.priceAgency).toBe("number");
    expect(typeof m.active).toBe("boolean");
    expect(typeof DEFAULT_PRICING_CONFIG.bundle.priceAgency).toBe("number");
    expect(typeof DEFAULT_PRICING_CONFIG.bundle.active).toBe("boolean");
  });
});
