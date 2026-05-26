import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  computeBudgetStatus,
  assertWithinBudget,
  setBudget,
  approveOverage,
  BudgetExceededError,
} from "./role-room-ads-budget.js";

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
