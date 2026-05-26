import { describe, it, expect, vi, afterEach } from "vitest";
import type { Pool } from "pg";
import {
  parseCampaignResourceName,
  normalizeGoogleAdsRow,
  getCampaignInsights,
  makeGoogleAdsConnector,
  getGoogleAdsConnectorFromEnv,
  GoogleAdsApiError,
  __setGoogleAdsFetch,
  __resetGoogleAdsFetch,
  type GoogleAdsInsightsRow,
} from "./role-room-google-ads.js";
import { syncCampaignSpend } from "./role-room-ads-sync.js";
import type { AdsCampaignRow } from "./role-room-ads-db.js";

afterEach(() => __resetGoogleAdsFetch());

function fakeFetch(payload: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }));
}

describe("parseCampaignResourceName", () => {
  it("parses the full resource name", () => {
    expect(parseCampaignResourceName("customers/123/campaigns/456")).toEqual({
      customerId: "123",
      campaignId: "456",
    });
  });
  it("parses the bare cid/campaignId form", () => {
    expect(parseCampaignResourceName("123/456")).toEqual({
      customerId: "123",
      campaignId: "456",
    });
  });
  it("returns null for garbage", () => {
    expect(parseCampaignResourceName("not-a-resource")).toBeNull();
    expect(parseCampaignResourceName("")).toBeNull();
  });
});

describe("normalizeGoogleAdsRow", () => {
  const row: GoogleAdsInsightsRow = {
    date: "2026-05-24",
    costMicros: 800_000_000, // 800 currency units
    impressions: 1000,
    clicks: 50,
    conversions: 5,
    conversionsValue: 2500,
  };

  it("converts cost_micros → NOK (÷1e6)", () => {
    const out = normalizeGoogleAdsRow(row);
    expect(out.spendNok).toBeCloseTo(800, 4);
    expect(out.date).toBe("2026-05-24");
  });

  it("applies the FX rate to spend + conversion value", () => {
    const out = normalizeGoogleAdsRow(row, 1.1);
    expect(out.spendNok).toBeCloseTo(880, 4);
    expect(out.conversionValueNok).toBeCloseTo(2750, 4);
  });

  it("derives ctr/cpc/cpm", () => {
    const out = normalizeGoogleAdsRow(row);
    expect(out.ctr).toBeCloseTo(5, 4); // 50/1000 * 100
    expect(out.cpc).toBeCloseTo(16, 4); // 800/50
    expect(out.cpm).toBeCloseTo(800, 4); // 800/1000 * 1000
  });
});

describe("getCampaignInsights", () => {
  it("parses a searchStream batch into rows", async () => {
    __setGoogleAdsFetch(
      fakeFetch([
        {
          results: [
            {
              segments: { date: "2026-05-24" },
              metrics: {
                costMicros: "800000000",
                impressions: "1000",
                clicks: "50",
                conversions: "5",
                conversionsValue: "2500",
              },
            },
          ],
        },
      ]),
    );

    const rows = await getCampaignInsights({
      accessToken: "tok",
      developerToken: "dev",
      customerId: "123",
      campaignId: "456",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-05-24", costMicros: 800_000_000, clicks: 50 });
  });

  it("throws GoogleAdsApiError on non-2xx", async () => {
    __setGoogleAdsFetch(
      fakeFetch({ error: { message: "PERMISSION_DENIED" } }, false, 403),
    );
    await expect(
      getCampaignInsights({
        accessToken: "tok",
        developerToken: "dev",
        customerId: "123",
        campaignId: "456",
      }),
    ).rejects.toBeInstanceOf(GoogleAdsApiError);
  });
});

describe("makeGoogleAdsConnector", () => {
  it("rejects a campaign whose external id is not a resource name", async () => {
    const connector = makeGoogleAdsConnector({ developerToken: "dev" });
    await expect(connector.fetchInsights("tok", "garbage")).rejects.toBeInstanceOf(
      GoogleAdsApiError,
    );
  });

  it("getGoogleAdsConnectorFromEnv is null without a developer token", () => {
    const prev = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    expect(getGoogleAdsConnectorFromEnv()).toBeNull();
    if (prev) process.env.GOOGLE_ADS_DEVELOPER_TOKEN = prev;
  });
});

describe("Google Ads through the sync backbone", () => {
  function makePoolStub() {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    let seq = 0;
    const pool = {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        if (/INTO ads_management_fee_usage/i.test(sql)) {
          return { rows: [{ id: `fee-${++seq}` }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Pool;
    return { pool, queries };
  }

  function googleCampaign(): AdsCampaignRow {
    return {
      id: "camp-g",
      projectId: "proj-1",
      userId: "user-1",
      businessProfileId: null,
      platform: "google",
      externalCampaignId: "customers/123/campaigns/456",
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
    };
  }

  it("records 20 % påslag on Google Ads spend for a finalized day", async () => {
    __setGoogleAdsFetch(
      fakeFetch([
        {
          results: [
            {
              segments: { date: "2026-05-24" },
              metrics: { costMicros: "800000000", impressions: "1000", clicks: "50" },
            },
          ],
        },
      ]),
    );
    const { pool, queries } = makePoolStub();
    const connector = makeGoogleAdsConnector({ developerToken: "dev" });

    const res = await syncCampaignSpend(
      pool,
      { campaign: googleCampaign(), accessToken: "tok" },
      { connector, now: () => new Date("2026-05-26T09:00:00.000Z") },
    );

    expect(res.platform).toBe("google");
    expect(res.totalSpendNok).toBeCloseTo(800, 4);
    expect(res.totalFeeNok).toBeCloseTo(160, 1); // 20 % of 800
    const feeInsert = queries.find((q) => /ads_management_fee_usage/i.test(q.sql));
    expect(feeInsert?.params?.[2]).toBe("google"); // platform persisted
  });
});
