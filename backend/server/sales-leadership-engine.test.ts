import { describe, expect, it, vi } from "vitest";
import { calculateCommission, refreshContestParticipants } from "./sales-leadership-engine.js";

describe("calculateCommission", () => {
  it("calculates the supported models without inventing unavailable deal facts", () => {
    const result = calculateCommission({
      revenueNok: 200_000,
      recurringRevenueNok: 20_000,
      qualifiedActivities: 12,
      activeModels: ["base_percentage", "recurring", "per_activity", "gross_margin", "split"],
      config: {
        base_percentage: { rate: 0.10 },
        recurring: { pct: 0.10, months: 3 },
        per_activity: { amount_nok: 250 },
      },
    });

    expect(result.components).toEqual({
      base_percentage: 20_000,
      recurring: 6_000,
      per_activity: 3_000,
    });
    expect(result.commissionNok).toBe(29_000);
    expect(result.modelsIgnored).toEqual(["split", "gross_margin"]);
  });

  it("uses progressive bands and applies the accelerator only to variable revenue pay", () => {
    const result = calculateCommission({
      revenueNok: 200_000,
      recurringRevenueNok: 0,
      qualifiedActivities: 4,
      activeModels: ["tiered", "per_activity", "accelerator"],
      config: {
        tieredBands: [
          { fromK: 0, pct: 5 },
          { fromK: 100, pct: 10 },
        ],
        per_activity: { amount_nok: 100 },
        accelerator: { target_nok: 150_000, multiplier: 1.5 },
      },
    });

    expect(result.components.tiered).toBe(15_000);
    expect(result.components.per_activity).toBe(400);
    expect(result.components.accelerator).toBe(7_500);
    expect(result.commissionNok).toBe(22_900);
  });

  it("handles percent aliases, negative facts and an unreached accelerator safely", () => {
    const result = calculateCommission({
      revenueNok: -1,
      recurringRevenueNok: -1,
      qualifiedActivities: -1,
      activeModels: ["flat", "accelerator"],
      config: { flatRate: 12, monthlyTargetK: 100, acceleratorMult: 2 },
    });

    expect(result.commissionNok).toBe(0);
    expect(result.effectiveRate).toBe(0);
    expect(result.modelsApplied).toEqual(["base_percentage", "accelerator"]);
  });
});

describe("refreshContestParticipants", () => {
  it("scores every eligible member from tenant-bound CRM facts and upserts the snapshot", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          id: "contest-id",
          kpi: "closed_revenue",
          starts_at: "2026-09-01T00:00:00.000Z",
          ends_at: "2026-09-30T23:59:59.999Z",
          kpi_config: { user_ids: ["seller-1"] },
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          user_id: "seller-1",
          user_name: "Selger En",
          user_email: "seller@example.com",
          closed_revenue: 125_000,
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const count = await refreshContestParticipants(
      { query } as never,
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
    );

    expect(count).toBe(1);
    const scoreSql = String(query.mock.calls[1][0]);
    expect(scoreSql).toContain("c.organization_id = $1::uuid");
    expect(scoreSql).toContain("c.pipeline_stage = 'won' OR c.status = 'won' OR c.lead_status = 'won'");
    expect(scoreSql).toContain("leadgrid_dorsalg_sales");
    expect(query.mock.calls[2][1]).toEqual([
      "00000000-0000-0000-0000-000000000002",
      "seller-1",
      125_000,
      "Selger En",
      "seller@example.com",
    ]);
    expect(String(query.mock.calls[3][0])).toContain("DELETE FROM sales_contest_participants");
    expect(query.mock.calls[3][1]).toEqual([
      "00000000-0000-0000-0000-000000000002",
      ["seller-1"],
    ]);
  });
});
