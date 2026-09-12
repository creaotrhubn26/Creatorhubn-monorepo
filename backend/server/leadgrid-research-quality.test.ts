/**
 * leadgrid-research-quality.test.ts
 *
 * Tester for mig 0353 — research-kvalitets-pakke:
 *   - Fix 3: calculateLeadQuality + email-extraktor + place-details
 *   - Fix 4: autoAssignIndustryFromDiscoveryQuery
 */

import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";

import { calculateLeadQuality } from "./role-room-agent.js";
import { autoAssignIndustryFromDiscoveryQuery } from "./leadgrid-industry-classify.js";

// ---------------------------------------------------------------------
// calculateLeadQuality (Fix 3 bonus)
// ---------------------------------------------------------------------

describe("calculateLeadQuality", () => {
  it("baseline 50", () => {
    expect(calculateLeadQuality({})).toBe(50);
  });
  it("rating 4.5 + 20 reviews + website + phone + brreg = 100", () => {
    expect(
      calculateLeadQuality({
        rating: 4.5,
        reviewCount: 20,
        website: "https://foo.no",
        phone: "+47 99999999",
        brregActiveRegistered: true,
      }),
    ).toBe(100);
  });
  it("kun website +10", () => {
    expect(calculateLeadQuality({ website: "https://foo.no" })).toBe(60);
  });
  it("rating 3.5 gir IKKE +15", () => {
    expect(calculateLeadQuality({ rating: 3.5 })).toBe(50);
  });
  it("rating 4.0 gir +15", () => {
    expect(calculateLeadQuality({ rating: 4.0 })).toBe(65);
  });
  it("9 reviews gir IKKE +10", () => {
    expect(calculateLeadQuality({ reviewCount: 9 })).toBe(50);
  });
  it("clamper til [0, 100]", () => {
    expect(
      calculateLeadQuality({
        rating: 4.5,
        reviewCount: 1000,
        website: "x",
        phone: "y",
        brregActiveRegistered: true,
      }),
    ).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------
// autoAssignIndustryFromDiscoveryQuery (Fix 4)
// ---------------------------------------------------------------------

function makeMockPool(behavior: {
  industriesByCode?: Record<string, { id: string; code: string; name_no: string }>;
  trigramHits?: Array<{ id: string; code: string; name_no: string; sim: number }>;
}): Pool {
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    const text = sql.replace(/\s+/g, " ").trim();
    // NACE-direkte (classifyIndustryForLead) — code = ANY($1)
    if (text.includes("FROM industries WHERE is_active = TRUE AND code = ANY")) {
      const codes = (params?.[0] as string[]) ?? [];
      for (const c of codes) {
        const hit = behavior.industriesByCode?.[c];
        if (hit) return { rows: [hit] };
      }
      return { rows: [] };
    }
    // Trigram-fallback (classifyIndustryForLead)
    if (text.includes("similarity(LOWER(name_no)")) {
      if (behavior.trigramHits && behavior.trigramHits.length > 0) {
        return { rows: [behavior.trigramHits[0]] };
      }
      return { rows: [] };
    }
    // NACE-suffix (classifyIndustryForLead)
    if (text.includes("scope = 'global' AND (code LIKE")) {
      return { rows: [] };
    }
    throw new Error("unhandled SQL: " + text.slice(0, 80));
  });
  return { query } as unknown as Pool;
}

describe("autoAssignIndustryFromDiscoveryQuery", () => {
  it("matcher 'fotograf' via keyword", async () => {
    const pool = makeMockPool({
      industriesByCode: {
        "CUSTOM.WEDDING_PHOTOGRAPHER": {
          id: "id-photo",
          code: "CUSTOM.WEDDING_PHOTOGRAPHER",
          name_no: "Bryllupsfotograf",
        },
      },
    });
    const r = await autoAssignIndustryFromDiscoveryQuery(pool, {
      discoveryQuery: "fotograf i Oslo",
    });
    expect(r?.industryId).toBe("id-photo");
    expect(r?.source).toBe("keyword");
  });

  it("matcher 'restaurant' via keyword", async () => {
    const pool = makeMockPool({
      industriesByCode: {
        "NACE.I.56.10": {
          id: "id-rest",
          code: "NACE.I.56.10",
          name_no: "Restaurantvirksomhet",
        },
      },
    });
    const r = await autoAssignIndustryFromDiscoveryQuery(pool, {
      discoveryQuery: "beste restaurant i Bergen",
    });
    expect(r?.industryId).toBe("id-rest");
  });

  it("matcher trigram-fallback når keyword finnes men ingen kode i DB", async () => {
    const pool = makeMockPool({
      industriesByCode: {},
      trigramHits: [
        { id: "id-trig", code: "NACE.M.74.20", name_no: "Fotograftjenester", sim: 0.85 },
      ],
    });
    const r = await autoAssignIndustryFromDiscoveryQuery(pool, {
      discoveryQuery: "fotograf",
    });
    expect(r?.industryId).toBe("id-trig");
    expect(r?.source).toBe("trigram");
  });

  it("returnerer null for ukjent bransje", async () => {
    const pool = makeMockPool({ industriesByCode: {}, trigramHits: [] });
    const r = await autoAssignIndustryFromDiscoveryQuery(pool, {
      discoveryQuery: "noe veldig sært",
    });
    expect(r).toBeNull();
  });

  it("matcher case-insensitive", async () => {
    const pool = makeMockPool({
      industriesByCode: {
        "CUSTOM.WEDDING_PHOTOGRAPHER": {
          id: "id-photo",
          code: "CUSTOM.WEDDING_PHOTOGRAPHER",
          name_no: "Bryllupsfotograf",
        },
      },
    });
    const r = await autoAssignIndustryFromDiscoveryQuery(pool, {
      discoveryQuery: "FOTOGRAF I OSLO",
    });
    expect(r?.industryId).toBe("id-photo");
  });

  it("matcher 'tannlege'", async () => {
    const pool = makeMockPool({
      industriesByCode: {
        "NACE.Q.86.23": {
          id: "id-dent",
          code: "NACE.Q.86.23",
          name_no: "Tannhelsetjenester",
        },
      },
    });
    const r = await autoAssignIndustryFromDiscoveryQuery(pool, {
      discoveryQuery: "tannlege i Trondheim",
    });
    expect(r?.industryId).toBe("id-dent");
  });

  it("bruker NACE-direkte når brregNaceCode er satt", async () => {
    const pool = makeMockPool({
      industriesByCode: {
        "NACE.56.10": {
          id: "id-direct",
          code: "NACE.56.10",
          name_no: "Restaurantvirksomhet",
        },
      },
    });
    const r = await autoAssignIndustryFromDiscoveryQuery(pool, {
      discoveryQuery: "noe",
      brregNaceCode: "56.10",
    });
    expect(r?.industryId).toBe("id-direct");
    expect(r?.source).toBe("nace_direct");
  });
});
