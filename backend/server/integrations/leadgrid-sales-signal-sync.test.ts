import { describe, expect, it } from "vitest";

import { toSalesOutcomeSignals, type SalesWeekRow } from "./leadgrid-sales-signal-sync.js";
import { validateNormalizedSignal } from "./normalized-signal-schema.js";

const ORG = "11111111-2222-3333-4444-555555555555";
const ctx = { collectedAt: "2026-07-13T05:00:00.000Z" };

const wonWeek: SalesWeekRow = {
  organizationId: ORG,
  ownerUserId: "user-1",
  weekStart: "2026-07-06",
  outcome: "won",
  deals: 3,
  amountNok: 45000,
};

describe("toSalesOutcomeSignals", () => {
  it("won-uke med beløp gir count- OG nok-signal som består skjemaet", () => {
    const signals = toSalesOutcomeSignals([wonWeek], ctx);
    expect(signals).toHaveLength(2);
    for (const s of signals) {
      const v = validateNormalizedSignal(s);
      expect(v.errors ?? []).toEqual([]);
      expect(v.valid).toBe(true);
    }
    const count = signals.find((s) => s.metricType === "deals_won")!;
    expect(count.unit).toBe("count");
    expect(count.metricValue).toBe(3);
    expect(count.sourceType).toBe("first_party");
    expect(count.isEstimated).toBe(false); // EGNE salgsdata — aldri estimert
    const amount = signals.find((s) => s.metricType === "deals_won_amount")!;
    expect(amount.unit).toBe("nok");
    expect(amount.metricValue).toBe(45000);
  });

  it("lost-uke gir kun count (tapt beløp er ikke omsetning)", () => {
    const signals = toSalesOutcomeSignals(
      [{ ...wonWeek, outcome: "lost", amountNok: 90000 }],
      ctx,
    );
    expect(signals).toHaveLength(1);
    expect(signals[0].metricType).toBe("deals_lost");
  });

  it("deterministiske id-er: re-synk gir identiske id-er (dedup-no-op)", () => {
    const a = toSalesOutcomeSignals([wonWeek], ctx);
    const b = toSalesOutcomeSignals([wonWeek], { collectedAt: "2026-07-14T05:00:00.000Z" });
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
    expect(a[0].id).toBe(`leadgrid-crm|${ORG}|2026-07-06|deals_won`);
  });

  it("perioden er hele ISO-uken", () => {
    const [s] = toSalesOutcomeSignals([wonWeek], ctx);
    expect(s.periodStart).toBe("2026-07-06T00:00:00.000Z");
    expect(s.periodEnd).toBe("2026-07-13T00:00:00.000Z");
  });

  it("won uten beløp gir kun count — beløp gjettes aldri", () => {
    const signals = toSalesOutcomeSignals([{ ...wonWeek, amountNok: null }], ctx);
    expect(signals).toHaveLength(1);
  });
});
