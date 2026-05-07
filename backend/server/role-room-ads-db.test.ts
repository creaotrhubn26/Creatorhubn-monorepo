import { describe, it, expect, vi } from "vitest";
import {
  insertCampaign,
  updateCampaignStatus,
  upsertAttributionDaily,
  recordManagementFee,
  sumManagementFeeForPeriod,
} from "./role-room-ads-db.js";

interface MockResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

function poolWith(responses: MockResult[]) {
  let i = 0;
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  return {
    pool: {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        return responses[i++] ?? { rows: [], rowCount: 0 };
      }),
    } as never,
    calls,
  };
}

describe("insertCampaign", () => {
  it("inserts with sane defaults + returns mapped row", async () => {
    const now = new Date().toISOString();
    const { pool, calls } = poolWith([
      {
        rowCount: 1,
        rows: [
          {
            id: "c-1",
            project_id: "p-1",
            user_id: "u-1",
            business_profile_id: null,
            platform: "meta",
            external_campaign_id: "fb-99",
            source_post_id: null,
            source_asset_id: null,
            status: "draft",
            goal: "lead_generation",
            daily_budget_nok: 500,
            total_budget_nok: null,
            audience_config: { ages: [25, 45] },
            creative_config: null,
            starts_at: null,
            ends_at: null,
            created_at: now,
            updated_at: now,
          },
        ],
      },
    ]);

    const result = await insertCampaign(pool, {
      projectId: "p-1",
      userId: "u-1",
      platform: "meta",
      externalCampaignId: "fb-99",
      goal: "lead_generation",
      dailyBudgetNok: 500,
      audienceConfig: { ages: [25, 45] },
    });

    expect(result.id).toBe("c-1");
    expect(result.platform).toBe("meta");
    expect(result.dailyBudgetNok).toBe(500);
    expect(calls[0].sql).toContain("INSERT INTO ads_campaigns");
    // status default
    expect(calls[0].params?.[7]).toBe("draft");
  });
});

describe("updateCampaignStatus", () => {
  it("returns null when no row matches", async () => {
    const { pool } = poolWith([{ rows: [], rowCount: 0 }]);
    const out = await updateCampaignStatus(pool, "missing", "active");
    expect(out).toBeNull();
  });
});

describe("upsertAttributionDaily", () => {
  it("uses ON CONFLICT clause on (campaign_id, date)", async () => {
    const { pool, calls } = poolWith([{ rows: [], rowCount: 1 }]);
    await upsertAttributionDaily(pool, {
      campaignId: "c-1",
      date: "2026-05-06",
      impressions: 1000,
      clicks: 20,
      spendNok: 250,
    });
    expect(calls[0].sql).toContain("ON CONFLICT (campaign_id, date)");
  });
});

describe("recordManagementFee", () => {
  it("computes 15% fee + 25% MVA + correct billing period", async () => {
    const { pool, calls } = poolWith([{ rows: [{ id: "fee-1" }], rowCount: 1 }]);

    const out = await recordManagementFee(pool, {
      userId: "u-1",
      campaignId: "c-1",
      platform: "meta",
      spendNok: 1000,
      recordedAt: new Date("2026-05-07T12:00:00Z"),
    });

    expect(out.managementFeeNok).toBe(150);
    expect(out.totalInclVatNok).toBe(187.5);
    expect(out.period).toBe("2026-05");
    // params: userId, campaignId, platform, period, spend, fee, vat_rate, incl, meter
    expect(calls[0].params?.[3]).toBe("2026-05");
    expect(calls[0].params?.[5]).toBe(150);
    expect(calls[0].params?.[6]).toBe(0.25);
    expect(calls[0].params?.[7]).toBe(187.5);
  });
});

describe("sumManagementFeeForPeriod", () => {
  it("aggregates per-platform totals across the billing period", async () => {
    const { pool } = poolWith([
      {
        rowCount: 2,
        rows: [
          { platform: "meta", spend: "10000", fee: "1500", incl_vat: "1875" },
          { platform: "google", spend: "5000", fee: "750", incl_vat: "937.5" },
        ],
      },
    ]);

    const out = await sumManagementFeeForPeriod(pool, "u-1", "2026-05");

    expect(out.totalSpendNok).toBe(15000);
    expect(out.totalFeeNok).toBe(2250);
    expect(out.totalInclVatNok).toBe(2812.5);
    expect(out.perPlatform.meta).toBe(1500);
    expect(out.perPlatform.google).toBe(750);
  });

  it("returns zero-totals when no rows match", async () => {
    const { pool } = poolWith([{ rows: [], rowCount: 0 }]);
    const out = await sumManagementFeeForPeriod(pool, "u-1", "2026-05");
    expect(out.totalFeeNok).toBe(0);
    expect(out.perPlatform).toEqual({});
  });
});
