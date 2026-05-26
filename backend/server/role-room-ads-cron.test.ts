import { describe, it, expect, vi, afterEach } from "vitest";
import type { Pool } from "pg";
import {
  buildAdsConnectorRegistry,
  buildPlatformTokenResolver,
  runAdsAttributionSweepWithDefaults,
} from "./role-room-ads-cron.js";

const ENV = process.env;
afterEach(() => {
  process.env = { ...ENV };
});

describe("buildAdsConnectorRegistry", () => {
  it("always includes Meta and LinkedIn", () => {
    const reg = buildAdsConnectorRegistry();
    expect(reg.meta?.platform).toBe("meta");
    expect(reg.linkedin?.platform).toBe("linkedin");
  });

  it("includes Google only when GOOGLE_ADS_DEVELOPER_TOKEN is set", () => {
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    expect(buildAdsConnectorRegistry().google).toBeUndefined();

    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev-token";
    expect(buildAdsConnectorRegistry().google?.platform).toBe("google");
  });
});

describe("buildPlatformTokenResolver", () => {
  it("returns null for google/linkedin (OAuth connections not built yet)", async () => {
    const pool = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) } as unknown as Pool;
    const resolve = buildPlatformTokenResolver(pool);
    expect(await resolve("google", "u1")).toBeNull();
    expect(await resolve("linkedin", "u1")).toBeNull();
  });

  it("returns null for meta when the user has no Instagram connection", async () => {
    const pool = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) } as unknown as Pool;
    const resolve = buildPlatformTokenResolver(pool);
    expect(await resolve("meta", "u1")).toBeNull();
  });
});

describe("runAdsAttributionSweepWithDefaults", () => {
  it("returns an empty summary when there are no syncable campaigns", async () => {
    const pool = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) } as unknown as Pool;
    const summary = await runAdsAttributionSweepWithDefaults(pool);
    expect(summary.campaignsConsidered).toBe(0);
    expect(summary.campaignsSynced).toBe(0);
    expect(summary.totalFeeNok).toBe(0);
  });
});
