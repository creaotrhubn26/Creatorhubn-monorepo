import { describe, expect, it } from "vitest";

import { isLegacyTimestampId, newEntityId } from "./_shared-ids.js";

describe("newEntityId", () => {
  it("returnerer streng med prefix og UUID-suffix", () => {
    const id = newEntityId("manuscript");
    expect(id.startsWith("manuscript-")).toBe(true);
    expect(id.length).toBeGreaterThan("manuscript-".length + 30);
  });

  it("returnerer ren UUID når prefix utelates", () => {
    const id = newEntityId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("genererer 10 000 unike IDs uten kollisjon", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10000; i += 1) {
      seen.add(newEntityId("scene"));
    }
    expect(seen.size).toBe(10000);
  });

  it("genererer unike IDs ved millisekund-skille", () => {
    // Date.now-mønsteret kolliderer her — UUID gjør det ikke.
    const ids = Array.from({ length: 100 }, () => newEntityId("dialogue"));
    expect(new Set(ids).size).toBe(100);
  });
});

describe("isLegacyTimestampId", () => {
  it("matcher gamle Date.now-baserte IDs", () => {
    expect(isLegacyTimestampId("manuscript-1715432821000")).toBe(true);
    expect(isLegacyTimestampId("scene-1715432821001")).toBe(true);
    expect(isLegacyTimestampId("pool-candidate-1715432821002")).toBe(true);
  });

  it("matcher IKKE nye UUID-baserte IDs", () => {
    expect(isLegacyTimestampId("manuscript-7a1f8b2c-1234-4abc-9def-0123456789ab")).toBe(
      false,
    );
    expect(isLegacyTimestampId(newEntityId("scene"))).toBe(false);
  });

  it("returnerer false for tom streng eller andre formater", () => {
    expect(isLegacyTimestampId("")).toBe(false);
    expect(isLegacyTimestampId("123-456")).toBe(false);
    expect(isLegacyTimestampId("PREFIX-1234567890123")).toBe(false); // krever lowercase
  });
});
