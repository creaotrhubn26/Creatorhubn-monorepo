import { describe, expect, it } from "vitest";

import {
  toMarketSignals,
  VERTICAL_NACE_MAP,
  type MarketCountRow,
} from "./brreg-market-signal-sync.js";
import { validateNormalizedSignal } from "./normalized-signal-schema.js";

const ORG = "11111111-2222-3333-4444-555555555555";
const ctx = { collectedAt: "2026-07-15T04:45:00.000Z" }; // onsdag i ISO-uke som starter 13.07

const stockRow: MarketCountRow = {
  organizationId: ORG,
  ownerUserId: "user-1",
  setName: "CreatorHub — fotografer og videografer",
  naceCode: "74.200",
  metricType: "registered_companies",
  value: 8961,
};

describe("toMarketSignals", () => {
  it("produserer gyldige public_data-signaler med geografi (NO)", () => {
    const [s] = toMarketSignals([stockRow], ctx);
    const v = validateNormalizedSignal(s);
    expect(v.errors ?? []).toEqual([]);
    expect(s.sourceType).toBe("public_data");
    expect(s.isEstimated).toBe(false); // register-telling, ikke estimat
    expect(s.geography).toEqual({ country: "NO" });
    expect(s.subjectId).toBe("74.200");
  });

  it("bestand dedupes per MÅNED, nyregistreringer per ISO-UKE", () => {
    const rows: MarketCountRow[] = [
      stockRow,
      { ...stockRow, metricType: "new_companies_30d", value: 42 },
    ];
    const [stock, fresh] = toMarketSignals(rows, ctx);
    expect(stock.id).toBe(`brreg|${ORG}|2026-07-01|74.200|registered_companies`);
    expect(fresh.id).toBe(`brreg|${ORG}|2026-07-13|74.200|new_companies_30d`);
    // Samme uke, ny dag → samme id (no-op); ny måned → ny bestands-id
    const [stock2] = toMarketSignals([stockRow], { collectedAt: "2026-08-02T04:45:00.000Z" });
    expect(stock2.id).toContain("2026-08-01");
  });

  it("topic er prompt-sett-navnet — kobler til temaene motoren allerede bruker", () => {
    const [s] = toMarketSignals([stockRow], ctx);
    expect(s.topic).toBe("CreatorHub — fotografer og videografer");
  });
});

describe("VERTICAL_NACE_MAP (kun verifiserte koder)", () => {
  it("hver vertikal har minst én kode og en begrunnelse", () => {
    for (const [name, m] of Object.entries(VERTICAL_NACE_MAP)) {
      expect(m.codes.length, name).toBeGreaterThan(0);
      expect(m.note.length, name).toBeGreaterThan(0);
      for (const code of m.codes) expect(code).toMatch(/^\d{2}\.\d{3}$/);
    }
  });
});
