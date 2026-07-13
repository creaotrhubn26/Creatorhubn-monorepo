import { describe, expect, it } from "vitest";

import { CAPABILITY_KEYS, computeDeliveryFit, supplierProfileSchema } from "./supplier-profile.js";

describe("computeDeliveryFit (deterministisk kan-vi-levere)", () => {
  it("skiller har/mangler/ubesvart; score kun over besvarte", () => {
    const fit = computeDeliveryFit(["miljo", "kvalitet", "ehf", "rammeavtale"], { miljo: true, kvalitet: false });
    expect(fit.have).toEqual(["miljo"]);
    expect(fit.missing).toEqual(["kvalitet"]);
    expect(fit.unknown).toEqual(["ehf"]); // rammeavtale er kontraktsform — ikke med
    expect(fit.scorePct).toBe(50);
  });

  it("uutfylt profil gir null-score, ALDRI 0 eller 100", () => {
    const fit = computeDeliveryFit(["miljo", "ehf"], null);
    expect(fit.unknown).toEqual(["miljo", "ehf"]);
    expect(fit.scorePct).toBeNull();
  });

  it("rammeavtale er ikke en kapabilitet", () => {
    expect(CAPABILITY_KEYS).not.toContain("rammeavtale");
  });
});

describe("supplierProfileSchema", () => {
  it("avviser ukjente kapabiliteter", () => {
    expect(supplierProfileSchema.safeParse({ capabilities: { hemmelig: true } }).success).toBe(false);
    expect(supplierProfileSchema.safeParse({ capabilities: { miljo: true, ehf: false } }).success).toBe(true);
  });
});
