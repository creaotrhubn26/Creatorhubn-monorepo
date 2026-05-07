import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  __setMetaAdsFetch,
  __resetMetaAdsFetch,
  listAdAccounts,
  createCampaign,
  pauseCampaign,
  resumeCampaign,
  endCampaign,
  createAdSet,
  createAd,
  getCampaignInsights,
  normalizeInsightsRow,
  MetaAdsApiError,
  type MetaInsightsRow,
} from "./role-room-meta-ads.js";

interface MockResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

function mockFetch(responses: MockResponse[]) {
  const calls: Array<{ url: string; init?: Record<string, unknown> }> = [];
  let i = 0;
  const fn = vi.fn(async (url: string, init?: Record<string, unknown>) => {
    calls.push({ url, init });
    const r = responses[i++] ?? responses[responses.length - 1];
    return {
      ok: r.ok,
      status: r.status,
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    };
  });
  return { fn, calls };
}

beforeEach(() => {
  // empty
});

afterEach(() => {
  __resetMetaAdsFetch();
});

describe("listAdAccounts", () => {
  it("hits /me/adaccounts and returns the data array", async () => {
    const { fn, calls } = mockFetch([
      {
        ok: true,
        status: 200,
        body: {
          data: [
            { id: "act_1", account_id: "1", name: "Holy Crust", currency: "NOK" },
            { id: "act_2", account_id: "2", name: "Macks Invest", currency: "NOK" },
          ],
        },
      },
    ]);
    __setMetaAdsFetch(fn as never);

    const accounts = await listAdAccounts("TOKEN_X");

    expect(accounts).toHaveLength(2);
    expect(accounts[0].id).toBe("act_1");
    expect(calls[0].url).toContain("/me/adaccounts");
    expect(calls[0].url).toContain("access_token=TOKEN_X");
    expect(calls[0].url).toContain("fields=id");
  });
});

describe("createCampaign", () => {
  it("POSTs to /<adAccountId>/campaigns with PAUSED default + objective", async () => {
    const { fn, calls } = mockFetch([
      { ok: true, status: 200, body: { id: "23800001" } },
    ]);
    __setMetaAdsFetch(fn as never);

    const result = await createCampaign("TOK", {
      adAccountId: "act_42",
      name: "Holy Crust pizzakveld",
      objective: "OUTCOME_TRAFFIC",
      dailyBudgetCents: 5000_00, // 5000 NOK in cents
    });

    expect(result.id).toBe("23800001");
    expect(calls[0].url).toContain("/act_42/campaigns");
    const body = JSON.parse((calls[0].init?.body as string) ?? "{}");
    expect(body.name).toBe("Holy Crust pizzakveld");
    expect(body.objective).toBe("OUTCOME_TRAFFIC");
    expect(body.status).toBe("PAUSED");
    expect(body.daily_budget).toBe(500_000);
  });

  it("propagates Meta API errors as MetaAdsApiError", async () => {
    const { fn } = mockFetch([
      {
        ok: false,
        status: 400,
        body: { error: { message: "Invalid objective", type: "OAuthException", code: 100 } },
      },
    ]);
    __setMetaAdsFetch(fn as never);

    await expect(
      createCampaign("TOK", {
        adAccountId: "act_1",
        name: "x",
        objective: "OUTCOME_TRAFFIC",
      }),
    ).rejects.toBeInstanceOf(MetaAdsApiError);
  });
});

describe("pauseCampaign / resumeCampaign / endCampaign", () => {
  it("pauseCampaign POSTs status=PAUSED", async () => {
    const { fn, calls } = mockFetch([{ ok: true, status: 200, body: { success: true } }]);
    __setMetaAdsFetch(fn as never);

    await pauseCampaign("TOK", "23800001");
    const body = JSON.parse((calls[0].init?.body as string) ?? "{}");
    expect(body.status).toBe("PAUSED");
    expect(calls[0].url).toContain("/23800001");
  });

  it("resumeCampaign POSTs status=ACTIVE", async () => {
    const { fn, calls } = mockFetch([{ ok: true, status: 200, body: { success: true } }]);
    __setMetaAdsFetch(fn as never);

    await resumeCampaign("TOK", "23800001");
    const body = JSON.parse((calls[0].init?.body as string) ?? "{}");
    expect(body.status).toBe("ACTIVE");
  });

  it("endCampaign issues DELETE on the campaign-id", async () => {
    const { fn, calls } = mockFetch([{ ok: true, status: 200, body: { success: true } }]);
    __setMetaAdsFetch(fn as never);

    await endCampaign("TOK", "23800001");
    expect(calls[0].init?.method).toBe("DELETE");
    expect(calls[0].url).toContain("/23800001");
  });
});

describe("createAdSet + createAd", () => {
  it("createAdSet wires campaign_id + targeting + defaults", async () => {
    const { fn, calls } = mockFetch([{ ok: true, status: 200, body: { id: "23900001" } }]);
    __setMetaAdsFetch(fn as never);

    await createAdSet("TOK", {
      adAccountId: "act_42",
      campaignId: "23800001",
      name: "Pizza-fans Oslo 25-45",
      dailyBudgetCents: 200_00,
      targeting: {
        geo_locations: { countries: ["NO"] },
        age_min: 25,
        age_max: 45,
        publisher_platforms: ["facebook", "instagram"],
      },
    });

    const body = JSON.parse((calls[0].init?.body as string) ?? "{}");
    expect(body.campaign_id).toBe("23800001");
    expect(body.daily_budget).toBe(20_000);
    expect(body.optimization_goal).toBe("LINK_CLICKS");
    expect(body.billing_event).toBe("IMPRESSIONS");
    expect(body.targeting.geo_locations.countries).toEqual(["NO"]);
  });

  it("createAd links creative to adset", async () => {
    const { fn, calls } = mockFetch([{ ok: true, status: 200, body: { id: "ad_1" } }]);
    __setMetaAdsFetch(fn as never);

    await createAd("TOK", {
      adAccountId: "act_42",
      adSetId: "23900001",
      name: "Pepperoni-bilde",
      creativeId: "creative_42",
    });
    const body = JSON.parse((calls[0].init?.body as string) ?? "{}");
    expect(body.adset_id).toBe("23900001");
    expect(body.creative).toEqual({ creative_id: "creative_42" });
  });
});

describe("getCampaignInsights", () => {
  it("requests time_increment=1 + level=campaign by default", async () => {
    const { fn, calls } = mockFetch([
      {
        ok: true,
        status: 200,
        body: {
          data: [
            {
              date_start: "2026-05-06",
              date_stop: "2026-05-06",
              impressions: "1234",
              clicks: "56",
              spend: "78.50",
              ctr: "4.54",
              cpc: "1.40",
              cpm: "63.61",
            },
          ],
        },
      },
    ]);
    __setMetaAdsFetch(fn as never);

    const rows = await getCampaignInsights("TOK", "23800001");
    expect(rows).toHaveLength(1);
    expect(rows[0].impressions).toBe("1234");
    expect(calls[0].url).toContain("time_increment=1");
    expect(calls[0].url).toContain("level=campaign");
  });

  it("passes time_range when sinceISO/untilISO supplied", async () => {
    const { fn, calls } = mockFetch([{ ok: true, status: 200, body: { data: [] } }]);
    __setMetaAdsFetch(fn as never);

    await getCampaignInsights("TOK", "C1", {
      sinceISO: "2026-05-01T00:00:00Z",
      untilISO: "2026-05-07T00:00:00Z",
    });

    const url = calls[0].url;
    expect(decodeURIComponent(url)).toContain('"since":"2026-05-01"');
    expect(decodeURIComponent(url)).toContain('"until":"2026-05-07"');
  });
});

describe("normalizeInsightsRow", () => {
  it("converts strings to numbers + applies NOK-rate", () => {
    const row: MetaInsightsRow = {
      date_start: "2026-05-06",
      date_stop: "2026-05-06",
      impressions: "1000",
      clicks: "20",
      spend: "100.00", // USD
      cpc: "5.00",
      cpm: "100.00",
      ctr: "2.00",
    };
    const out = normalizeInsightsRow(row, 10.5); // 1 USD = 10.5 NOK

    expect(out.impressions).toBe(1000);
    expect(out.clicks).toBe(20);
    expect(out.spendNok).toBe(1050); // 100 × 10.5
    expect(out.cpc).toBeCloseTo(52.5, 2);
    expect(out.cpm).toBeCloseTo(1050, 2);
    expect(out.ctr).toBe(2);
  });

  it("aggregates conversion actions + values", () => {
    const row: MetaInsightsRow = {
      date_start: "2026-05-06",
      date_stop: "2026-05-06",
      actions: [
        { action_type: "purchase", value: "3" },
        { action_type: "lead", value: "1" },
        { action_type: "page_engagement", value: "100" }, // ignored
      ],
      action_values: [
        { action_type: "purchase", value: "450.00" },
        { action_type: "page_engagement", value: "0" },
      ],
    };
    const out = normalizeInsightsRow(row, 1);
    expect(out.conversions).toBe(4);
    expect(out.conversionValueNok).toBe(450);
  });

  it("returns null fields when source values are missing", () => {
    const row: MetaInsightsRow = {
      date_start: "2026-05-06",
      date_stop: "2026-05-06",
    };
    const out = normalizeInsightsRow(row);
    expect(out.impressions).toBeNull();
    expect(out.spendNok).toBeNull();
    expect(out.conversions).toBeNull();
  });
});
