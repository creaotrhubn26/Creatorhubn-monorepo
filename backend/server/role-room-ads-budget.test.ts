import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  computeBudgetStatus,
  computeBudgetPacing,
  assertWithinBudget,
  setBudget,
  approveOverage,
  BudgetExceededError,
} from "./role-room-ads-budget.js";

const statusFor = (maxSpendNok: number, actualSpendNok: number) =>
  computeBudgetStatus({ hasBudget: true, maxSpendNok, approvedOverageNok: 0, actualSpendNok });

describe("computeBudgetPacing", () => {
  // 30 dager i april; 10 dager gått; brukt 5000 av 10000 → run-rate 500/dag.
  const apr10 = new Date(Date.UTC(2026, 3, 10)); // 10. april 2026

  it("projects month-end spend from the run-rate and flags over_pace", () => {
    const p = computeBudgetPacing({ status: statusFor(10_000, 5_000), period: "2026-04", today: apr10 });
    expect(p.daysInPeriod).toBe(30);
    expect(p.daysElapsed).toBe(10);
    expect(p.daysRemaining).toBe(20);
    expect(p.dailyRunRateNok).toBe(500);
    expect(p.projectedPeriodSpendNok).toBe(15_000); // 500 × 30
    expect(p.projectedOverspendNok).toBe(5_000);
    expect(p.pace).toBe("over_pace");
    // Lander på taket: 10000 / 500 = dag 20.
    expect(p.projectedExhaustionDate).toBe("2026-04-20");
  });

  it("recommends a daily budget that lands exactly on the cap", () => {
    // Brukt 5000 av 20000, 20 dager igjen → 15000/20 = 750/dag.
    const p = computeBudgetPacing({ status: statusFor(20_000, 5_000), period: "2026-04", today: apr10 });
    expect(p.recommendedDailyBudgetNok).toBe(750);
    expect(p.pace).toBe("on_track"); // 500/dag × 30 = 15000 < 20000
    expect(p.projectedExhaustionDate).toBeNull(); // når ikke taket i perioden
  });

  it("flags at_risk near the cap without yet projecting overspend", () => {
    // Brukt 9200 av 10000 sent i måneden → near budget, men ikke over-pace.
    const p = computeBudgetPacing({ status: statusFor(10_000, 9_200), period: "2026-04", today: new Date(Date.UTC(2026, 3, 29)) });
    expect(p.pace).toBe("at_risk");
  });

  it("flags exhausted once spend has reached the cap", () => {
    const p = computeBudgetPacing({ status: statusFor(10_000, 10_500), period: "2026-04", today: apr10 });
    expect(p.pace).toBe("exhausted");
  });

  it("returns no_budget when no cap is set", () => {
    const noBudget = computeBudgetStatus({ hasBudget: false, maxSpendNok: 0, approvedOverageNok: 0, actualSpendNok: 0 });
    const p = computeBudgetPacing({ status: noBudget, period: "2026-04", today: apr10 });
    expect(p.pace).toBe("no_budget");
    expect(p.recommendedDailyBudgetNok).toBe(0);
  });

  it("treats a past period as fully elapsed (no division by future days)", () => {
    const p = computeBudgetPacing({ status: statusFor(10_000, 8_000), period: "2026-01", today: apr10 });
    expect(p.daysElapsed).toBe(31); // hele januar
    expect(p.daysRemaining).toBe(0);
    expect(p.recommendedDailyBudgetNok).toBe(0); // ingen dager igjen
  });
});

describe("computeBudgetStatus", () => {
  it("computes remaining + utilization against the effective cap", () => {
    const s = computeBudgetStatus({
      hasBudget: true,
      maxSpendNok: 10_000,
      approvedOverageNok: 0,
      actualSpendNok: 4_000,
    });
    expect(s.effectiveCapNok).toBe(10_000);
    expect(s.remainingNok).toBe(6_000);
    expect(s.utilizationPct).toBe(40);
    expect(s.isOverBudget).toBe(false);
    expect(s.isNearBudget).toBe(false);
  });

  it("flags near-budget at >= 90%", () => {
    const s = computeBudgetStatus({ hasBudget: true, maxSpendNok: 10_000, approvedOverageNok: 0, actualSpendNok: 9_200 });
    expect(s.isNearBudget).toBe(true);
    expect(s.isOverBudget).toBe(false);
  });

  it("flags over-budget at >= cap, and approved overage raises the cap", () => {
    const over = computeBudgetStatus({ hasBudget: true, maxSpendNok: 10_000, approvedOverageNok: 0, actualSpendNok: 10_500 });
    expect(over.isOverBudget).toBe(true);
    expect(over.remainingNok).toBe(-500);

    // Client approves +5000 → no longer over budget.
    const withOverage = computeBudgetStatus({ hasBudget: true, maxSpendNok: 10_000, approvedOverageNok: 5_000, actualSpendNok: 10_500 });
    expect(withOverage.effectiveCapNok).toBe(15_000);
    expect(withOverage.isOverBudget).toBe(false);
  });

  it("never flags over/near when no budget is set", () => {
    const s = computeBudgetStatus({ hasBudget: false, maxSpendNok: 0, approvedOverageNok: 0, actualSpendNok: 99_999 });
    expect(s.isOverBudget).toBe(false);
    expect(s.isNearBudget).toBe(false);
  });
});

describe("assertWithinBudget", () => {
  function poolWithBudget(row: Record<string, unknown> | null) {
    return {
      query: vi.fn(async () => ({ rows: row ? [row] : [], rowCount: row ? 1 : 0 })),
    } as unknown as Pool;
  }

  it("throws BudgetExceededError when spend has reached the cap", async () => {
    const pool = poolWithBudget({ project_id: "p", period: "2026-06", max_spend_nok: "10000", approved_overage_nok: "0" });
    await expect(assertWithinBudget(pool, "p", "2026-06", 10_000)).rejects.toBeInstanceOf(BudgetExceededError);
  });

  it("passes when under the cap", async () => {
    const pool = poolWithBudget({ project_id: "p", period: "2026-06", max_spend_nok: "10000", approved_overage_nok: "0" });
    const status = await assertWithinBudget(pool, "p", "2026-06", 5_000);
    expect(status.isOverBudget).toBe(false);
  });

  it("passes (no cap) when no budget is set", async () => {
    const pool = poolWithBudget(null);
    const status = await assertWithinBudget(pool, "p", "2026-06", 999_999);
    expect(status.hasBudget).toBe(false);
    expect(status.isOverBudget).toBe(false);
  });

  it("approved overage lets spend past the base cap", async () => {
    const pool = poolWithBudget({ project_id: "p", period: "2026-06", max_spend_nok: "10000", approved_overage_nok: "5000" });
    const status = await assertWithinBudget(pool, "p", "2026-06", 12_000);
    expect(status.isOverBudget).toBe(false);
    expect(status.effectiveCapNok).toBe(15_000);
  });
});

describe("setBudget / approveOverage SQL shape", () => {
  it("setBudget upserts on (project_id, period)", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const pool = {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        calls.push({ sql, params });
        return { rows: [{ project_id: "p", period: "2026-06", max_spend_nok: "10000", approved_overage_nok: "0" }], rowCount: 1 };
      }),
    } as unknown as Pool;
    const out = await setBudget(pool, "p", "2026-06", 10_000, "klient@x.no");
    expect(out.maxSpendNok).toBe(10_000);
    expect(calls[0].sql).toContain("ON CONFLICT (project_id, period)");
  });

  it("approveOverage clears the pending request", async () => {
    const calls: Array<{ sql: string }> = [];
    const pool = {
      query: vi.fn(async (sql: string) => {
        calls.push({ sql });
        return { rows: [{ project_id: "p", period: "2026-06", max_spend_nok: "10000", approved_overage_nok: "5000" }], rowCount: 1 };
      }),
    } as unknown as Pool;
    const out = await approveOverage(pool, "p", "2026-06", 5_000, "klient@x.no");
    expect(out?.approvedOverageNok).toBe(5_000);
    expect(calls[0].sql).toContain("overage_requested_nok = NULL");
  });
});
