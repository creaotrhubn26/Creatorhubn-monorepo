import { describe, it, expect, vi } from "vitest";
import { computeWeightedForecast, listDealsAtRisk } from "./leadgrid-deals-service.js";
import type { Pool } from "pg";

function mockPool(rowsFor: Record<string, unknown[]>): Pool {
  return {
    query: vi.fn((sql: string) => {
      // Match første ord i SELECT-statement
      for (const key of Object.keys(rowsFor)) {
        if (sql.includes(key)) {
          return Promise.resolve({ rows: rowsFor[key] });
        }
      }
      return Promise.resolve({ rows: [] });
    }),
  } as unknown as Pool;
}

describe("computeWeightedForecast", () => {
  it("sum weighted = sum(amount × probability/100)", async () => {
    const pool = mockPool({
      "FROM crm_customers": [
        {
          deal_amount: "100000",
          deal_probability: 50,
          expected_close_date: "2026-07-15",
          deal_currency: "NOK",
        },
        {
          deal_amount: "200000",
          deal_probability: 80,
          expected_close_date: "2026-08-15",
          deal_currency: "NOK",
        },
      ],
    });
    const f = await computeWeightedForecast(pool, "org-1");
    // 100k * 0.5 + 200k * 0.8 = 50 000 + 160 000 = 210 000
    expect(f.summary.totalWeightedValue).toBe(210000);
    expect(f.summary.totalPipelineValue).toBe(300000);
    expect(f.summary.dealsCount).toBe(2);
    expect(f.summary.averageProbability).toBe(65);
  });

  it("byMonth aggregerer per måned", async () => {
    const pool = mockPool({
      "FROM crm_customers": [
        {
          deal_amount: "100000",
          deal_probability: 50,
          expected_close_date: "2026-07-15",
          deal_currency: "NOK",
        },
        {
          deal_amount: "50000",
          deal_probability: 50,
          expected_close_date: "2026-07-30",
          deal_currency: "NOK",
        },
        {
          deal_amount: "200000",
          deal_probability: 80,
          expected_close_date: "2026-08-15",
          deal_currency: "NOK",
        },
      ],
    });
    const f = await computeWeightedForecast(pool, "org-1");
    expect(f.byMonth.length).toBe(2);
    const july = f.byMonth.find((b) => b.period === "2026-07");
    expect(july).toBeDefined();
    expect(july?.weightedValue).toBe(75000); // 50000 + 25000
    expect(july?.dealsCount).toBe(2);
    const august = f.byMonth.find((b) => b.period === "2026-08");
    expect(august?.weightedValue).toBe(160000);
  });

  it("byQuarter aggregerer per kvartal", async () => {
    const pool = mockPool({
      "FROM crm_customers": [
        {
          deal_amount: "100000",
          deal_probability: 50,
          expected_close_date: "2026-07-15",
          deal_currency: "NOK",
        },
        {
          deal_amount: "100000",
          deal_probability: 50,
          expected_close_date: "2026-09-30",
          deal_currency: "NOK",
        },
      ],
    });
    const f = await computeWeightedForecast(pool, "org-1");
    const q3 = f.byQuarter.find((b) => b.period === "2026-Q3");
    expect(q3?.dealsCount).toBe(2);
    expect(q3?.weightedValue).toBe(100000);
  });

  it("tom rader returnerer 0", async () => {
    const pool = mockPool({ "FROM crm_customers": [] });
    const f = await computeWeightedForecast(pool, "org-1");
    expect(f.summary.totalWeightedValue).toBe(0);
    expect(f.summary.dealsCount).toBe(0);
    expect(f.summary.averageProbability).toBe(0);
    expect(f.byMonth).toEqual([]);
    expect(f.byQuarter).toEqual([]);
  });
});

describe("listDealsAtRisk", () => {
  it("regner weightedValue = amount × prob/100", async () => {
    const pool = mockPool({
      "FROM crm_customers": [
        {
          lead_id: "lead-1",
          name: "Risky Inc",
          pipeline_stage: "proposal",
          deal_amount: "100000",
          deal_probability: 60,
          expected_close_date: "2026-06-01",
          days_overdue: 25,
          owner_user_id: "u1",
        },
      ],
    });
    const deals = await listDealsAtRisk(pool, "org-1");
    expect(deals.length).toBe(1);
    expect(deals[0].weightedValue).toBe(60000);
    expect(deals[0].daysOverdue).toBe(25);
  });

  it("returnerer tom liste når ingen overdue", async () => {
    const pool = mockPool({ "FROM crm_customers": [] });
    const deals = await listDealsAtRisk(pool, "org-1");
    expect(deals).toEqual([]);
  });
});
