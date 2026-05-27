import { describe, it, expect, vi, afterEach } from "vitest";
import type { Pool } from "pg";
import {
  parseCampaignUrn,
  normalizeLinkedInRow,
  getCampaignInsights,
  makeLinkedInAdsConnector,
  getLinkedInAdsConnectorFromEnv,
  listManagedAdAccounts,
  listManagedOrganizations,
  listGrantedLinkedInAssets,
  linkedInRoleLabel,
  extractLinkedInLogoUrl,
  setLinkedInCampaignStatus,
  createLinkedInCampaign,
  hasLinkedInAdAccountAccess,
  LinkedInAdsApiError,
  __setLinkedInAdsFetch,
  __resetLinkedInAdsFetch,
  type LinkedInInsightsRow,
} from "./role-room-linkedin-ads.js";
import { syncCampaignSpend } from "./role-room-ads-sync.js";
import type { AdsCampaignRow } from "./role-room-ads-db.js";

afterEach(() => __resetLinkedInAdsFetch());

function fakeFetch(payload: unknown, ok = true, status = 200) {
  const fn = vi.fn(async () => ({
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }));
  return fn;
}

describe("parseCampaignUrn", () => {
  it("parses a full sponsoredCampaign URN", () => {
    expect(parseCampaignUrn("urn:li:sponsoredCampaign:456")).toEqual({
      campaignId: "456",
      urn: "urn:li:sponsoredCampaign:456",
    });
  });
  it("expands a bare numeric id to a URN", () => {
    expect(parseCampaignUrn("456")).toEqual({
      campaignId: "456",
      urn: "urn:li:sponsoredCampaign:456",
    });
  });
  it("returns null for garbage", () => {
    expect(parseCampaignUrn("nope")).toBeNull();
    expect(parseCampaignUrn("")).toBeNull();
  });
});

describe("normalizeLinkedInRow", () => {
  const row: LinkedInInsightsRow = {
    date: "2026-05-24",
    costInLocalCurrency: 800,
    impressions: 1000,
    clicks: 50,
    conversions: 5,
    conversionValueInLocalCurrency: 2500,
  };

  it("converts cost → NOK with FX", () => {
    expect(normalizeLinkedInRow(row).spendNok).toBeCloseTo(800, 4);
    expect(normalizeLinkedInRow(row, 1.1).spendNok).toBeCloseTo(880, 4);
    expect(normalizeLinkedInRow(row, 1.1).conversionValueNok).toBeCloseTo(2750, 4);
  });

  it("derives ctr/cpc/cpm", () => {
    const out = normalizeLinkedInRow(row);
    expect(out.ctr).toBeCloseTo(5, 4);
    expect(out.cpc).toBeCloseTo(16, 4);
    expect(out.cpm).toBeCloseTo(800, 4);
  });
});

describe("getCampaignInsights", () => {
  it("builds a date from dateRange.start and parses elements", async () => {
    const fetchMock = fakeFetch({
      elements: [
        {
          costInLocalCurrency: "800",
          impressions: 1000,
          clicks: 50,
          externalWebsiteConversions: 5,
          dateRange: { start: { year: 2026, month: 5, day: 24 } },
        },
      ],
    });
    __setLinkedInAdsFetch(fetchMock);

    const rows = await getCampaignInsights({
      accessToken: "tok",
      campaignUrn: "urn:li:sponsoredCampaign:456",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-05-24", costInLocalCurrency: 800, clicks: 50 });
    // Required headers present.
    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers["LinkedIn-Version"]).toBeTruthy();
    expect(init.headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
  });

  it("throws LinkedInAdsApiError on non-2xx", async () => {
    __setLinkedInAdsFetch(fakeFetch({ message: "ACCESS_DENIED" }, false, 403));
    await expect(
      getCampaignInsights({ accessToken: "tok", campaignUrn: "urn:li:sponsoredCampaign:456" }),
    ).rejects.toBeInstanceOf(LinkedInAdsApiError);
  });
});

describe("makeLinkedInAdsConnector", () => {
  it("rejects an invalid campaign ref", async () => {
    const connector = makeLinkedInAdsConnector();
    await expect(connector.fetchInsights("tok", "garbage")).rejects.toBeInstanceOf(
      LinkedInAdsApiError,
    );
  });

  it("getLinkedInAdsConnectorFromEnv returns a connector (gate is OAuth, not a secret)", () => {
    expect(getLinkedInAdsConnectorFromEnv().platform).toBe("linkedin");
  });
});

describe("LinkedIn Ads through the sync backbone", () => {
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

  function linkedinCampaign(): AdsCampaignRow {
    return {
      id: "camp-li",
      projectId: "proj-1",
      userId: "user-1",
      businessProfileId: null,
      platform: "linkedin",
      externalCampaignId: "urn:li:sponsoredCampaign:456",
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

  it("records 20 % påslag on LinkedIn spend for a finalized day", async () => {
    __setLinkedInAdsFetch(
      fakeFetch({
        elements: [
          {
            costInLocalCurrency: "800",
            impressions: 1000,
            clicks: 50,
            dateRange: { start: { year: 2026, month: 5, day: 24 } },
          },
        ],
      }),
    );
    const { pool, queries } = makePoolStub();
    const connector = makeLinkedInAdsConnector();

    const res = await syncCampaignSpend(
      pool,
      { campaign: linkedinCampaign(), accessToken: "tok" },
      { connector, now: () => new Date("2026-05-26T09:00:00.000Z") },
    );

    expect(res.platform).toBe("linkedin");
    expect(res.totalSpendNok).toBeCloseTo(800, 4);
    expect(res.totalFeeNok).toBeCloseTo(160, 1); // 20 % of 800
    const feeInsert = queries.find((q) => /ads_management_fee_usage/i.test(q.sql));
    expect(feeInsert?.params?.[2]).toBe("linkedin");
  });
});

describe("listManagedAdAccounts", () => {
  it("flags admin roles and inlines the decorated account name", async () => {
    __setLinkedInAdsFetch(
      fakeFetch({
        elements: [
          {
            account: "urn:li:sponsoredAccount:111",
            role: "ACCOUNT_BILLING_ADMIN",
            "account~": { id: 111, name: "PreVisit Ads" },
          },
          {
            account: "urn:li:sponsoredAccount:222",
            role: "VIEWER",
            "account~": { id: 222, name: "Read-only konto" },
          },
        ],
      }),
    );
    const assets = await listManagedAdAccounts("tok");
    expect(assets).toHaveLength(2);
    const admin = assets.find((a) => a.id === "urn:li:sponsoredAccount:111")!;
    expect(admin.isAdmin).toBe(true);
    expect(admin.name).toBe("PreVisit Ads");
    expect(assets.find((a) => a.id === "urn:li:sponsoredAccount:222")!.isAdmin).toBe(false);
  });

  it("returns [] on a non-2xx instead of throwing", async () => {
    __setLinkedInAdsFetch(fakeFetch({ message: "no" }, false, 403));
    expect(await listManagedAdAccounts("tok")).toEqual([]);
  });
});

describe("listManagedOrganizations", () => {
  it("flags ADMINISTRATOR orgs and inlines localizedName", async () => {
    __setLinkedInAdsFetch(
      fakeFetch({
        elements: [
          {
            organization: "urn:li:organization:999",
            role: "ADMINISTRATOR",
            state: "APPROVED",
            "organization~": {
              id: 999,
              localizedName: "MedInnova",
              logoV2: {
                "original~": {
                  elements: [{ identifiers: [{ identifier: "https://logo/medinnova.png" }] }],
                },
              },
            },
          },
        ],
      }),
    );
    const orgs = await listManagedOrganizations("tok");
    expect(orgs).toHaveLength(1);
    expect(orgs[0]).toMatchObject({
      assetType: "organization",
      id: "urn:li:organization:999",
      name: "MedInnova",
      logoUrl: "https://logo/medinnova.png", // client brand logo
      isAdmin: true,
    });
  });
});

describe("listGrantedLinkedInAssets + labels", () => {
  it("merges ad accounts and organizations", async () => {
    // Both calls share the injected fetch; return ad accounts first, then orgs.
    let call = 0;
    __setLinkedInAdsFetch(
      vi.fn(async (url: string) => {
        call += 1;
        const isOrg = url.includes("organizationAcls");
        return {
          ok: true,
          status: 200,
          json: async () =>
            isOrg
              ? { elements: [{ organization: "urn:li:organization:1", role: "ADMINISTRATOR", "organization~": { id: 1, localizedName: "Org" } }] }
              : { elements: [{ account: "urn:li:sponsoredAccount:2", role: "ACCOUNT_MANAGER", "account~": { id: 2, name: "Acct" } }] },
          text: async () => "",
        };
      }),
    );
    const all = await listGrantedLinkedInAssets("tok");
    expect(all.map((a) => a.assetType).sort()).toEqual(["ad_account", "organization"]);
    expect(all.every((a) => a.isAdmin)).toBe(true);
  });

  it("maps roles to Norwegian labels", () => {
    expect(linkedInRoleLabel("ACCOUNT_BILLING_ADMIN")).toContain("admin");
    expect(linkedInRoleLabel("ADMINISTRATOR")).toBe("Full admin");
    expect(linkedInRoleLabel("WEIRD")).toBe("WEIRD");
  });
});

describe("extractLinkedInLogoUrl", () => {
  it("pulls the image URL from a decorated logoV2", () => {
    const org = {
      logoV2: { "original~": { elements: [{ identifiers: [{ identifier: "https://logo/x.png" }] }] } },
    };
    expect(extractLinkedInLogoUrl(org)).toBe("https://logo/x.png");
  });
  it("returns null when the logo chain is missing", () => {
    expect(extractLinkedInLogoUrl({})).toBeNull();
    expect(extractLinkedInLogoUrl({ logoV2: {} })).toBeNull();
    expect(extractLinkedInLogoUrl(null)).toBeNull();
  });
});

describe("LinkedIn Ads write paths + access", () => {
  it("setLinkedInCampaignStatus sends a PARTIAL_UPDATE patch with status", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204, json: async () => null, text: async () => "" }));
    __setLinkedInAdsFetch(fetchMock as never);
    await setLinkedInCampaignStatus({ accessToken: "t" }, "urn:li:sponsoredCampaign:456", "PAUSED");
    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string>; body: string };
    expect(fetchMock.mock.calls[0][0]).toContain("/adCampaigns/456");
    expect(init.headers["X-RestLi-Method"]).toBe("PARTIAL_UPDATE");
    expect(JSON.parse(init.body).patch.$set.status).toBe("PAUSED");
  });

  it("createLinkedInCampaign returns the new campaign urn from the x-restli-id header", async () => {
    __setLinkedInAdsFetch(
      vi.fn(async () => ({
        ok: true, status: 201,
        json: async () => ({}),
        text: async () => "",
        headers: { get: (n: string) => (n === "x-restli-id" ? "999" : null) },
      })) as never,
    );
    const out = await createLinkedInCampaign({
      accessToken: "t",
      accountUrn: "urn:li:sponsoredAccount:1",
      campaignGroupUrn: "urn:li:sponsoredCampaignGroup:2",
      name: "PreVisit LI",
      dailyBudgetNok: 300,
    });
    expect(out.campaignUrn).toBe("urn:li:sponsoredCampaign:999");
  });

  it("hasLinkedInAdAccountAccess is true only for a managing role on the account", async () => {
    __setLinkedInAdsFetch(
      fakeFetch({
        elements: [
          { account: "urn:li:sponsoredAccount:111", role: "ACCOUNT_MANAGER", "account~": { id: 111, name: "A" } },
          { account: "urn:li:sponsoredAccount:222", role: "VIEWER", "account~": { id: 222, name: "B" } },
        ],
      }),
    );
    expect(await hasLinkedInAdAccountAccess("t", "urn:li:sponsoredAccount:111")).toBe(true);
    __setLinkedInAdsFetch(
      fakeFetch({
        elements: [{ account: "urn:li:sponsoredAccount:222", role: "VIEWER", "account~": { id: 222, name: "B" } }],
      }),
    );
    expect(await hasLinkedInAdAccountAccess("t", "urn:li:sponsoredAccount:222")).toBe(false);
  });
});
