import { describe, expect, it } from "vitest";

import { sanitizeDiscoveredBrands } from "./geo-brand-extraction.js";

const KNOWN = ["Leadgrid", "HubSpot", "Pipedrive"];

describe("sanitizeDiscoveredBrands", () => {
  it("keeps unknown commercial brands, drops known ones", () => {
    const out = sanitizeDiscoveredBrands(
      { brands: ["Tripletex", "HubSpot", "Fiken", "Leadgrid"] },
      KNOWN,
    );
    expect(out).toEqual(["Tripletex", "Fiken"]);
  });

  it("drops generic/platform words the LLM often misclassifies", () => {
    const out = sanitizeDiscoveredBrands(
      { brands: ["CRM", "Excel", "Google", "ChatGPT", "Superoffice CRM-suite", "Finn.no"] },
      KNOWN,
    );
    expect(out).toEqual(["Superoffice CRM-suite"]);
  });

  it("dedupes case-insensitively and normalizes whitespace", () => {
    const out = sanitizeDiscoveredBrands(
      { brands: ["Poweroffice  Go", "poweroffice go", "POWEROFFICE GO"] },
      [],
    );
    expect(out).toEqual(["Poweroffice Go"]);
  });

  it("caps at 15 and rejects junk lengths", () => {
    const many = Array.from({ length: 30 }, (_, i) => `Merke${i}`);
    const out = sanitizeDiscoveredBrands({ brands: ["a", "x".repeat(80), ...many] }, []);
    expect(out).toHaveLength(15);
  });

  it("returns [] on garbage input (never throws)", () => {
    expect(sanitizeDiscoveredBrands(null, KNOWN)).toEqual([]);
    expect(sanitizeDiscoveredBrands({ brands: "nope" }, KNOWN)).toEqual([]);
    expect(sanitizeDiscoveredBrands({ brands: [42, {}] }, KNOWN)).toEqual([]);
  });
});
