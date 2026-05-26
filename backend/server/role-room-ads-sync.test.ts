import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  syncMetaCampaignSpend,
  syncCampaignSpend,
  type MeterEmitter,
  type PlatformConnector,
} from "./role-room-ads-sync.js";
import type { AdsCampaignRow } from "./role-room-ads-db.js";
import type { MetaInsightsRow } from "./role-room-meta-ads.js";

/**
 * Pool stub that records every query and returns a synthetic id for the
 * fee-ledger INSERT…RETURNING so recordManagementFee resolves.
 */
function makePoolStub() {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  let feeSeq = 0;
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      if (/INTO ads_management_fee_usage/i.test(sql)) {
        return { rows: [{ id: `fee-${++feeSeq}` }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  } as unknown as Pool;
  return { pool, queries };
}

function makeCampaign(overrides: Partial<AdsCampaignRow> = {}): AdsCampaignRow {
  return {
    id: "camp-1",
    projectId: "proj-1",
    userId: "user-1",
    businessProfileId: null,
    platform: "meta",
    externalCampaignId: "23800000000",
    sourcePostId: null,
    sourceAssetId: null,
    status: "active",
    goal: null,
    dailyBudgetNok: null,
    totalBudgetNok: null,
    managementFeeRate: 0.2,
    audienceConfig: null,
    creativeConfig: null,
    startsAt: null,
    endsAt: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function insightsRow(date: string, spend: string): MetaInsightsRow {
  return {
    date_start: date,
    date_stop: date,
    impressions: "1000",
    clicks: "50",
    spend,
    cpc: "2.0",
    cpm: "10.0",
    ctr: "5.0",
    reach: "900",
  };
}

const FIXED_NOW = () => new Date("2026-05-26T09:00:00.000Z"); // boundary = 2026-05-26

describe("syncMetaCampaignSpend", () => {
  it("upserts attribution for every day but only bills finalized days", async () => {
    const { pool, queries } = makePoolStub();
    const getInsights = vi.fn(async () => [
      insightsRow("2026-05-24", "1000"), // finalized
      insightsRow("2026-05-25", "2000"), // finalized
      insightsRow("2026-05-26", "500"), // today → attribution only, not billed
    ]);

    const res = await syncMetaCampaignSpend(
      pool,
      { campaign: makeCampaign(), accessToken: "tok" },
      { getInsights, now: FIXED_NOW },
    );

    expect(res.daysFetched).toBe(3);
    expect(res.daysFinalized).toBe(2);
    expect(res.totalSpendNok).toBe(3000);
    // 20 % påslag on 3000 NOK = 600 NOK.
    expect(res.totalFeeNok).toBeCloseTo(600, 1);
    expect(res.errors).toEqual([]);

    const attribUpserts = queries.filter((q) =>
      /INTO ads_attribution_daily/i.test(q.sql),
    );
    const feeInserts = queries.filter((q) =>
      /INTO ads_management_fee_usage/i.test(q.sql),
    );
    expect(attribUpserts).toHaveLength(3); // all days
    expect(feeInserts).toHaveLength(2); // finalized only
  });

  it("skips finalized days with zero spend (no fee row)", async () => {
    const { pool, queries } = makePoolStub();
    const getInsights = vi.fn(async () => [insightsRow("2026-05-24", "0")]);

    const res = await syncMetaCampaignSpend(
      pool,
      { campaign: makeCampaign(), accessToken: "tok" },
      { getInsights, now: FIXED_NOW },
    );

    expect(res.daysFinalized).toBe(0);
    expect(res.totalFeeNok).toBe(0);
    expect(queries.filter((q) => /ads_management_fee_usage/i.test(q.sql))).toHaveLength(0);
    expect(queries.filter((q) => /ads_attribution_daily/i.test(q.sql))).toHaveLength(1);
  });

  it("fires a best-effort meter event with a deterministic identifier", async () => {
    const { pool } = makePoolStub();
    const getInsights = vi.fn(async () => [insightsRow("2026-05-24", "1000")]);
    const emit = vi.fn(async () => "evt-123");
    const meterEmitter: MeterEmitter = { emit };

    const res = await syncMetaCampaignSpend(
      pool,
      { campaign: makeCampaign(), accessToken: "tok" },
      { getInsights, meterEmitter, now: FIXED_NOW },
    );

    expect(res.meterEventsFired).toBe(1);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "roleroom_ads_meta_spend_nok",
        valueNok: 1000,
        identifier: "camp-1:2026-05-24",
        usageDate: "2026-05-24",
      }),
    );
  });

  it("honours a per-client påslag override on the campaign", async () => {
    const { pool } = makePoolStub();
    const getInsights = vi.fn(async () => [insightsRow("2026-05-24", "1000")]);

    const res = await syncMetaCampaignSpend(
      pool,
      { campaign: makeCampaign({ managementFeeRate: 0.15 }), accessToken: "tok" },
      { getInsights, now: FIXED_NOW },
    );

    expect(res.totalFeeNok).toBeCloseTo(150, 1); // 15 % of 1000
  });

  it("skips a platform with no registered connector without touching the DB", async () => {
    const { pool, queries } = makePoolStub();
    const res = await syncCampaignSpend(
      pool,
      { campaign: makeCampaign({ platform: "google" }), accessToken: "tok" },
      { now: FIXED_NOW }, // default registry = Meta only
    );
    expect(res.errors).toContain("no_connector_for_platform:google");
    expect(queries).toHaveLength(0);
  });

  it("errors on a campaign missing an external id", async () => {
    const { pool, queries } = makePoolStub();
    const res = await syncCampaignSpend(
      pool,
      { campaign: makeCampaign({ externalCampaignId: null }), accessToken: "tok" },
      { now: FIXED_NOW },
    );
    expect(res.errors).toContain("missing_external_campaign_id");
    expect(queries).toHaveLength(0);
  });

  it("runs a non-Meta platform once a connector is supplied (Google/LinkedIn-ready)", async () => {
    const { pool, queries } = makePoolStub();
    // A minimal Google connector: its own fetch + a normalizer to NOK.
    const googleConnector: PlatformConnector = {
      platform: "google",
      fetchInsights: vi.fn(async () => [{ day: "2026-05-24", costNok: 800 }]),
      normalize: (row) => {
        const r = row as { day: string; costNok: number };
        return {
          date: r.day,
          impressions: null,
          clicks: null,
          spendNok: r.costNok,
          ctr: null,
          cpc: null,
          cpm: null,
          conversions: null,
          conversionValueNok: null,
          raw: row,
        };
      },
    };

    const res = await syncCampaignSpend(
      pool,
      { campaign: makeCampaign({ platform: "google" }), accessToken: "tok" },
      { connector: googleConnector, now: FIXED_NOW },
    );

    expect(res.platform).toBe("google");
    expect(res.totalSpendNok).toBe(800);
    expect(res.totalFeeNok).toBeCloseTo(160, 1); // 20 % of 800
    // fee row is recorded with platform 'google'
    const feeInsert = queries.find((q) => /ads_management_fee_usage/i.test(q.sql));
    expect(feeInsert?.params?.[2]).toBe("google");
  });

  it("returns an error (no throw) when the insights fetch fails", async () => {
    const { pool } = makePoolStub();
    const getInsights = vi.fn(async () => {
      throw new Error("boom");
    });
    const res = await syncMetaCampaignSpend(
      pool,
      { campaign: makeCampaign(), accessToken: "tok" },
      { getInsights, now: FIXED_NOW },
    );
    expect(res.daysFetched).toBe(0);
    expect(res.errors[0]).toMatch(/insights_fetch_failed/);
  });
});
