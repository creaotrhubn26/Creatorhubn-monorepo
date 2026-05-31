import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  shouldAutoPause,
  runAdsAutoPauseSweep,
  type PausePlatformDispatchers,
} from "./role-room-ads-auto-pause.js";
import type { AdsCampaignRow } from "./role-room-ads-db.js";

// ── Pure decision ──────────────────────────────────────────────────────

describe("shouldAutoPause", () => {
  it("pauses when toggle is on AND spend reached the cap", () => {
    expect(shouldAutoPause({ hasBudget: true, maxSpendNok: 10_000, approvedOverageNok: 0, actualSpendNok: 10_500, autoPauseOnCap: true })).toBe(true);
  });
  it("does not pause when toggle is off (even if over budget)", () => {
    expect(shouldAutoPause({ hasBudget: true, maxSpendNok: 10_000, approvedOverageNok: 0, actualSpendNok: 12_000, autoPauseOnCap: false })).toBe(false);
  });
  it("does not pause when under the cap", () => {
    expect(shouldAutoPause({ hasBudget: true, maxSpendNok: 10_000, approvedOverageNok: 0, actualSpendNok: 8_000, autoPauseOnCap: true })).toBe(false);
  });
  it("respects approved overage as the effective cap", () => {
    // 10k cap + 5k godkjent ramme = 15k effective. 12k er IKKE over.
    expect(shouldAutoPause({ hasBudget: true, maxSpendNok: 10_000, approvedOverageNok: 5_000, actualSpendNok: 12_000, autoPauseOnCap: true })).toBe(false);
  });
});

// ── Full sweep with fakes ──────────────────────────────────────────────

function makeCampaign(over: Partial<AdsCampaignRow>): AdsCampaignRow {
  return {
    id: "c1",
    projectId: "p1",
    userId: "u1",
    businessProfileId: null,
    platform: "meta",
    externalCampaignId: "ext_1",
    sourcePostId: null,
    sourceAssetId: null,
    status: "active",
    goal: null,
    dailyBudgetNok: 100,
    totalBudgetNok: null,
    managementFeeRate: 0.2,
    audienceConfig: null,
    creativeConfig: null,
    startsAt: null,
    endsAt: null,
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-10T00:00:00Z",
    ...over,
  };
}

function makeDispatchers(): PausePlatformDispatchers & {
  metaCalls: string[];
  googleCalls: string[];
  linkedinCalls: string[];
} {
  const metaCalls: string[] = [];
  const googleCalls: string[] = [];
  const linkedinCalls: string[] = [];
  return {
    meta: async (_t, ext) => { metaCalls.push(ext); },
    google: async (_t, _dev, cust, res) => { googleCalls.push(`${cust}:${res}`); },
    linkedin: async (_t, urn) => { linkedinCalls.push(urn); },
    metaCalls, googleCalls, linkedinCalls,
  };
}

function fakePool(): Pool {
  // Spy on the two queries the sweep actually runs (listAutoPauseProjects +
  // sumSpendForProjectPeriod). updateCampaignStatus is also a query but its
  // result is ignored by the sweep, so we just accept the call.
  const query = vi.fn(async (sql: string, params: unknown[]) => {
    if (sql.includes("FROM role_room_ads_budgets")) {
      return {
        rows: [
          { project_id: "p1", period: "2026-04", max_spend_nok: 10_000, approved_overage_nok: 0, overage_requested_nok: null, overage_note: null, set_by: "client", updated_by: "client", auto_pause_on_cap: true },
          { project_id: "p2", period: "2026-04", max_spend_nok: 5_000, approved_overage_nok: 0, overage_requested_nok: null, overage_note: null, set_by: "client", updated_by: "client", auto_pause_on_cap: true },
        ],
      };
    }
    if (sql.includes("ads_management_fee_usage")) {
      const pid = params[0] as string;
      return { rows: [{ spend: pid === "p1" ? "12000" : "1000" }] };
    }
    // updateCampaignStatus
    return { rowCount: 1, rows: [{}] };
  });
  return { query } as unknown as Pool;
}

describe("runAdsAutoPauseSweep", () => {
  it("pauses ONLY projects that are over budget, across all platforms", async () => {
    const pool = fakePool();
    const dispatchers = makeDispatchers();
    const summary = await runAdsAutoPauseSweep(
      pool,
      {
        resolveToken: async () => "tok_xyz",
        listActiveCampaignsForProject: async (_p, pid) => {
          if (pid !== "p1") return []; // only p1 is over budget
          return [
            makeCampaign({ id: "m1", platform: "meta", externalCampaignId: "23845_m1" }),
            makeCampaign({ id: "g1", platform: "google", externalCampaignId: "customers/12345/campaigns/67890" }),
            makeCampaign({ id: "l1", platform: "linkedin", externalCampaignId: "urn:li:sponsoredCampaign:99" }),
          ];
        },
        dispatchers,
        googleDeveloperToken: "dev_tok",
        linkedinApiVersion: "202508",
      },
      "2026-04",
    );

    expect(summary.scanned).toBe(2);
    expect(summary.overBudget).toBe(1);
    expect(summary.pausedTotal).toBe(3);
    expect(dispatchers.metaCalls).toEqual(["23845_m1"]);
    expect(dispatchers.googleCalls).toEqual(["12345:customers/12345/campaigns/67890"]);
    expect(dispatchers.linkedinCalls).toEqual(["urn:li:sponsoredCampaign:99"]);
  });

  it("skips campaigns without a token instead of attempting to pause", async () => {
    const pool = fakePool();
    const dispatchers = makeDispatchers();
    const summary = await runAdsAutoPauseSweep(
      pool,
      {
        resolveToken: async () => null, // no token available
        listActiveCampaignsForProject: async () => [makeCampaign({ platform: "meta", externalCampaignId: "ext" })],
        dispatchers,
        googleDeveloperToken: "dev",
      },
      "2026-04",
    );
    expect(summary.pausedTotal).toBe(0);
    expect(summary.perProject[0].skipped[0].reason).toBe("no_token");
    expect(dispatchers.metaCalls).toEqual([]);
  });

  it("skips Google campaigns when GOOGLE_ADS_DEVELOPER_TOKEN is missing", async () => {
    const pool = fakePool();
    const dispatchers = makeDispatchers();
    const summary = await runAdsAutoPauseSweep(
      pool,
      {
        resolveToken: async () => "tok",
        listActiveCampaignsForProject: async () => [makeCampaign({ platform: "google", externalCampaignId: "customers/1/campaigns/2" })],
        dispatchers,
        googleDeveloperToken: null, // not configured
      },
      "2026-04",
    );
    expect(summary.pausedTotal).toBe(0);
    expect(summary.perProject[0].skipped[0].reason).toBe("missing_dispatcher");
  });

  it("treats a platform-API failure as skipped, not paused", async () => {
    const pool = fakePool();
    const dispatchers = makeDispatchers();
    dispatchers.meta = async () => { throw new Error("rate limited"); };
    const summary = await runAdsAutoPauseSweep(
      pool,
      {
        resolveToken: async () => "tok",
        listActiveCampaignsForProject: async () => [makeCampaign({ platform: "meta", externalCampaignId: "ext" })],
        dispatchers,
        googleDeveloperToken: "dev",
      },
      "2026-04",
    );
    expect(summary.pausedTotal).toBe(0);
    expect(summary.perProject[0].skipped[0].reason).toBe("platform_error");
    expect(summary.perProject[0].skipped[0].detail).toContain("rate limited");
  });
});
