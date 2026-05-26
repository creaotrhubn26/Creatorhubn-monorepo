/**
 * role-room-google-ads.ts
 *
 * Thin wrapper around the Google Ads API (REST, searchStream + GAQL), and a
 * PlatformConnector adapter so Google Ads spend flows through the same
 * spend→påslag-ryggrad as Meta (see role-room-ads-sync.ts).
 *
 * What this layer covers:
 *   • getCampaignInsights()  → daily cost/impressions/clicks/conversions via GAQL
 *   • normalizeGoogleAdsRow() → cost_micros (account currency) → spendNok
 *   • makeGoogleAdsConnector() → PlatformConnector for the sync pipeline
 *
 * Auth model (differs from Meta):
 *   • developer-token   — app-level, from GOOGLE_ADS_DEVELOPER_TOKEN (requires
 *                         Google Ads API access approval — a separate lead-time
 *                         gate, mirror of Meta App Review).
 *   • Authorization     — per-user OAuth2 bearer (scope adwords), resolved by the
 *                         sweep's resolveToken('google', userId).
 *   • customer-id       — the Google Ads account. We store the campaign as its
 *                         resource name "customers/{cid}/campaigns/{id}" in
 *                         ads_campaigns.external_campaign_id and parse it here.
 *   • login-customer-id — optional MCC/manager account header.
 *
 * Until the developer token + OAuth connection land this module is API-side
 * ready; see docs/role-room/ads-connectors.md.
 */

import type {
  PlatformConnector,
  NormalizedDailyMetrics,
  InsightsFetchOptions,
} from "./role-room-ads-sync.js";

const GOOGLE_ADS_API_VERSION = "v18";
const GOOGLE_ADS_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

export interface GoogleAdsInsightsRow {
  date: string; // segments.date, YYYY-MM-DD
  costMicros: number; // metrics.cost_micros (account currency, ÷1e6 = currency units)
  impressions: number;
  clicks: number;
  conversions: number;
  conversionsValue: number;
}

export class GoogleAdsApiError extends Error {
  readonly statusCode: number;
  readonly detail?: unknown;
  constructor(statusCode: number, message: string, detail?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.detail = detail;
    this.name = "GoogleAdsApiError";
  }
}

interface FetchLike {
  (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
    text: () => Promise<string>;
  }>;
}

let fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike;

/** Inject fetch for tests. */
export function __setGoogleAdsFetch(impl: FetchLike): void {
  fetchImpl = impl;
}
export function __resetGoogleAdsFetch(): void {
  fetchImpl = globalThis.fetch as unknown as FetchLike;
}

/**
 * Parse a Google Ads campaign resource name into its parts.
 * Accepts "customers/123/campaigns/456" or a bare "123/456".
 */
export function parseCampaignResourceName(
  resourceName: string,
): { customerId: string; campaignId: string } | null {
  if (!resourceName) return null;
  const full = resourceName.match(/customers\/(\d+)\/campaigns\/(\d+)/);
  if (full) return { customerId: full[1], campaignId: full[2] };
  const bare = resourceName.match(/^(\d+)\/(\d+)$/);
  if (bare) return { customerId: bare[1], campaignId: bare[2] };
  return null;
}

export interface GoogleAdsInsightsInput {
  accessToken: string;
  developerToken: string;
  customerId: string;
  campaignId: string;
  loginCustomerId?: string;
  sinceISO?: string;
  untilISO?: string;
}

function gaqlDateRange(sinceISO?: string, untilISO?: string): string {
  if (sinceISO && untilISO) {
    return ` AND segments.date BETWEEN '${sinceISO.slice(0, 10)}' AND '${untilISO.slice(0, 10)}'`;
  }
  // Default window: last 7 days, matching the sweep's default.
  return " AND segments.date DURING LAST_7_DAYS";
}

/** Fetch daily campaign metrics via GAQL searchStream. */
export async function getCampaignInsights(
  input: GoogleAdsInsightsInput,
): Promise<GoogleAdsInsightsRow[]> {
  const query =
    "SELECT segments.date, metrics.cost_micros, metrics.impressions, " +
    "metrics.clicks, metrics.conversions, metrics.conversions_value " +
    `FROM campaign WHERE campaign.id = ${input.campaignId}` +
    gaqlDateRange(input.sinceISO, input.untilISO);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.accessToken}`,
    "developer-token": input.developerToken,
    "content-type": "application/json",
  };
  if (input.loginCustomerId) headers["login-customer-id"] = input.loginCustomerId;

  const res = await fetchImpl(
    `${GOOGLE_ADS_BASE}/customers/${input.customerId}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query }) },
  );
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (raw as { error?: { message?: string } })?.error?.message ||
      `Google Ads searchStream failed (HTTP ${res.status})`;
    throw new GoogleAdsApiError(res.status, msg, raw);
  }

  // searchStream returns an array of batches, each { results: [...] }.
  const batches = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const rows: GoogleAdsInsightsRow[] = [];
  for (const batch of batches) {
    const results = (batch as { results?: unknown[] })?.results ?? [];
    for (const r of results) {
      const obj = r as {
        segments?: { date?: string };
        metrics?: {
          costMicros?: string | number;
          impressions?: string | number;
          clicks?: string | number;
          conversions?: string | number;
          conversionsValue?: string | number;
        };
      };
      const date = obj.segments?.date;
      if (!date) continue;
      const m = obj.metrics ?? {};
      rows.push({
        date,
        costMicros: Number(m.costMicros ?? 0),
        impressions: Number(m.impressions ?? 0),
        clicks: Number(m.clicks ?? 0),
        conversions: Number(m.conversions ?? 0),
        conversionsValue: Number(m.conversionsValue ?? 0),
      });
    }
  }
  return rows;
}

/** Normalize a Google Ads row to the shared NOK metrics shape. */
export function normalizeGoogleAdsRow(
  row: GoogleAdsInsightsRow,
  exchangeRateNokPerCurrency = 1,
): NormalizedDailyMetrics {
  const spendCurrency = row.costMicros / 1_000_000;
  const spendNok = spendCurrency * exchangeRateNokPerCurrency;
  const clicks = row.clicks || 0;
  const impressions = row.impressions || 0;
  return {
    date: row.date,
    impressions: impressions || null,
    clicks: clicks || null,
    spendNok,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spendNok / clicks : null,
    cpm: impressions > 0 ? (spendNok / impressions) * 1000 : null,
    conversions: row.conversions || null,
    conversionValueNok: row.conversionsValue
      ? row.conversionsValue * exchangeRateNokPerCurrency
      : null,
    raw: row,
  };
}

export interface GoogleAdsConnectorConfig {
  developerToken: string;
  loginCustomerId?: string;
}

/**
 * Build a PlatformConnector for Google Ads. The campaign's external_campaign_id
 * must be the resource name "customers/{cid}/campaigns/{id}".
 */
export function makeGoogleAdsConnector(config: GoogleAdsConnectorConfig): PlatformConnector {
  return {
    platform: "google",
    fetchInsights: async (
      accessToken: string,
      externalCampaignId: string,
      options?: InsightsFetchOptions,
    ) => {
      const parsed = parseCampaignResourceName(externalCampaignId);
      if (!parsed) {
        throw new GoogleAdsApiError(
          400,
          `Invalid Google Ads resource name: ${externalCampaignId} (expected customers/{cid}/campaigns/{id})`,
        );
      }
      return getCampaignInsights({
        accessToken,
        developerToken: config.developerToken,
        customerId: parsed.customerId,
        campaignId: parsed.campaignId,
        loginCustomerId: config.loginCustomerId,
        sinceISO: options?.sinceISO,
        untilISO: options?.untilISO,
      });
    },
    normalize: (row, fx) => normalizeGoogleAdsRow(row as GoogleAdsInsightsRow, fx),
  };
}

/**
 * Build the Google connector from env, or null if not configured. Callers merge
 * this into the connector registry: { ...DEFAULT_CONNECTORS, google: <this> }.
 */
export function getGoogleAdsConnectorFromEnv(): PlatformConnector | null {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) return null;
  return makeGoogleAdsConnector({
    developerToken,
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
  });
}
