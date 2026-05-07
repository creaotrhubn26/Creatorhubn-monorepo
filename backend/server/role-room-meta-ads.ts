/**
 * role-room-meta-ads.ts
 *
 * Thin wrapper around Meta Marketing API v21 (Facebook + Instagram ads).
 *
 * What this layer covers:
 *   • listAdAccounts()                 → discover act_<id>'s available to the user
 *   • createCampaign() / pauseCampaign() / resumeCampaign() / endCampaign()
 *   • createAdSet()                    (audience + budget + placements)
 *   • createAd()                       (creative + adset linkage)
 *   • getCampaignInsights()            → daily metrics for the ads_attribution_daily poll
 *
 * Scope requirements:
 *   • ads_management   (write — campaigns/adsets/ads)
 *   • ads_read         (read — insights)
 *
 * The existing Instagram OAuth already requests `ads_read` + `attribution_read`.
 * For write-paths we need `ads_management`, which requires a separate Meta App
 * Review submission (4–6 weeks). Until then, treat this module as the API-side
 * ready, awaiting OAuth scope.
 */

const META_GRAPH_VERSION = "v21.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export type MetaCampaignObjective =
  | "OUTCOME_AWARENESS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_LEADS"
  | "OUTCOME_SALES"
  | "OUTCOME_APP_PROMOTION";

export type MetaCampaignStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED";

export interface MetaAdAccount {
  id: string; // "act_<id>"
  account_id: string;
  name: string;
  currency: string;
  business_name?: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: MetaCampaignStatus;
  objective: MetaCampaignObjective;
  effective_status?: string;
  created_time?: string;
}

export interface MetaCampaignCreateInput {
  adAccountId: string; // "act_<id>"
  name: string;
  objective: MetaCampaignObjective;
  status?: MetaCampaignStatus;
  specialAdCategories?: string[];
  dailyBudgetCents?: number; // budget in account currency cents
}

export interface MetaAdSetCreateInput {
  adAccountId: string;
  campaignId: string;
  name: string;
  dailyBudgetCents: number;
  startTime?: string; // ISO
  endTime?: string;
  optimizationGoal?:
    | "REACH"
    | "IMPRESSIONS"
    | "LINK_CLICKS"
    | "LANDING_PAGE_VIEWS"
    | "VALUE"
    | "LEAD_GENERATION"
    | "OFFSITE_CONVERSIONS";
  billingEvent?: "IMPRESSIONS" | "LINK_CLICKS";
  bidStrategy?: "LOWEST_COST_WITHOUT_CAP" | "LOWEST_COST_WITH_BID_CAP" | "COST_CAP";
  targeting: MetaTargeting;
  status?: MetaCampaignStatus;
}

export interface MetaTargeting {
  geo_locations?: {
    countries?: string[];
    cities?: Array<{ key: string; radius?: number; distance_unit?: "kilometer" | "mile" }>;
  };
  age_min?: number;
  age_max?: number;
  genders?: number[]; // 1 = male, 2 = female
  interests?: Array<{ id: string; name?: string }>;
  custom_audiences?: Array<{ id: string }>;
  publisher_platforms?: Array<"facebook" | "instagram" | "audience_network" | "messenger">;
}

export interface MetaAdCreateInput {
  adAccountId: string;
  adSetId: string;
  name: string;
  creativeId: string; // existing creative or one created via /adcreatives
  status?: MetaCampaignStatus;
}

export interface MetaInsightsRow {
  date_start: string;
  date_stop: string;
  impressions?: string;
  clicks?: string;
  spend?: string; // in account currency, decimal-string
  cpc?: string;
  cpm?: string;
  ctr?: string;
  reach?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
}

// ─────────────────────────────────────────────────────────
// HTTP layer — minimal, no SDK
// ─────────────────────────────────────────────────────────

export class MetaAdsApiError extends Error {
  readonly statusCode: number;
  readonly meta?: { error?: { message?: string; type?: string; code?: number; fbtrace_id?: string } };
  constructor(statusCode: number, message: string, meta?: MetaAdsApiError["meta"]) {
    super(message);
    this.statusCode = statusCode;
    this.meta = meta;
    this.name = "MetaAdsApiError";
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
export function __setMetaAdsFetch(impl: FetchLike): void {
  fetchImpl = impl;
}
export function __resetMetaAdsFetch(): void {
  fetchImpl = globalThis.fetch as unknown as FetchLike;
}

async function metaRequest<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  accessToken: string,
  body?: Record<string, unknown>,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  url.searchParams.set("access_token", accessToken);

  const init: { method?: string; headers?: Record<string, string>; body?: string } = { method };
  if (body && method !== "GET") {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }

  const res = await fetchImpl(url.toString(), init);
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (raw as { error?: { message?: string; type?: string; code?: number } })?.error;
    throw new MetaAdsApiError(
      res.status,
      err?.message || `Meta API ${method} ${path} failed (HTTP ${res.status})`,
      raw as MetaAdsApiError["meta"],
    );
  }
  return raw as T;
}

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

/** Discover ad accounts the user can manage. */
export async function listAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const data = await metaRequest<{ data: MetaAdAccount[] }>(
    "GET",
    "/me/adaccounts",
    accessToken,
    undefined,
    { fields: "id,account_id,name,currency,business_name", limit: 200 },
  );
  return data.data ?? [];
}

export async function createCampaign(
  accessToken: string,
  input: MetaCampaignCreateInput,
): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    name: input.name,
    objective: input.objective,
    status: input.status ?? "PAUSED",
    special_ad_categories: input.specialAdCategories ?? [],
  };
  if (input.dailyBudgetCents !== undefined) {
    body.daily_budget = input.dailyBudgetCents;
  }
  return metaRequest<{ id: string }>(
    "POST",
    `/${input.adAccountId}/campaigns`,
    accessToken,
    body,
  );
}

export async function pauseCampaign(accessToken: string, campaignId: string): Promise<{ success: boolean }> {
  return metaRequest<{ success: boolean }>(
    "POST",
    `/${campaignId}`,
    accessToken,
    { status: "PAUSED" },
  );
}

export async function resumeCampaign(
  accessToken: string,
  campaignId: string,
): Promise<{ success: boolean }> {
  return metaRequest<{ success: boolean }>(
    "POST",
    `/${campaignId}`,
    accessToken,
    { status: "ACTIVE" },
  );
}

export async function endCampaign(accessToken: string, campaignId: string): Promise<{ success: boolean }> {
  return metaRequest<{ success: boolean }>(
    "DELETE",
    `/${campaignId}`,
    accessToken,
  );
}

export async function createAdSet(
  accessToken: string,
  input: MetaAdSetCreateInput,
): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    name: input.name,
    campaign_id: input.campaignId,
    daily_budget: input.dailyBudgetCents,
    optimization_goal: input.optimizationGoal ?? "LINK_CLICKS",
    billing_event: input.billingEvent ?? "IMPRESSIONS",
    bid_strategy: input.bidStrategy ?? "LOWEST_COST_WITHOUT_CAP",
    targeting: input.targeting,
    status: input.status ?? "PAUSED",
  };
  if (input.startTime) body.start_time = input.startTime;
  if (input.endTime) body.end_time = input.endTime;

  return metaRequest<{ id: string }>(
    "POST",
    `/${input.adAccountId}/adsets`,
    accessToken,
    body,
  );
}

export async function createAd(
  accessToken: string,
  input: MetaAdCreateInput,
): Promise<{ id: string }> {
  return metaRequest<{ id: string }>(
    "POST",
    `/${input.adAccountId}/ads`,
    accessToken,
    {
      name: input.name,
      adset_id: input.adSetId,
      creative: { creative_id: input.creativeId },
      status: input.status ?? "PAUSED",
    },
  );
}

/** Fetch daily insights for a campaign. */
export async function getCampaignInsights(
  accessToken: string,
  campaignId: string,
  options?: { sinceISO?: string; untilISO?: string; level?: "campaign" | "adset" | "ad" },
): Promise<MetaInsightsRow[]> {
  const query: Record<string, string | number | undefined> = {
    fields: "date_start,date_stop,impressions,clicks,spend,cpc,cpm,ctr,reach,actions,action_values",
    time_increment: 1,
    level: options?.level ?? "campaign",
    limit: 365,
  };
  if (options?.sinceISO || options?.untilISO) {
    const since = options.sinceISO?.slice(0, 10) ?? "";
    const until = options.untilISO?.slice(0, 10) ?? "";
    query.time_range = JSON.stringify({ since, until });
  }
  const data = await metaRequest<{ data: MetaInsightsRow[] }>(
    "GET",
    `/${campaignId}/insights`,
    accessToken,
    undefined,
    query,
  );
  return data.data ?? [];
}

/** Convert Meta insights row to the normalized shape stored in ads_attribution_daily. */
export function normalizeInsightsRow(
  row: MetaInsightsRow,
  exchangeRateNokPerCurrency: number = 1,
): {
  date: string;
  impressions: number | null;
  clicks: number | null;
  spendNok: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number | null;
  conversionValueNok: number | null;
  raw: MetaInsightsRow;
} {
  const num = (v?: string) => (v == null ? null : Number(v));

  // Conversions — sum of "purchase" or "lead" actions if present.
  let conversions: number | null = null;
  let conversionValueNok: number | null = null;
  if (row.actions) {
    const conv = row.actions
      .filter((a) =>
        ["purchase", "lead", "complete_registration", "offsite_conversion.fb_pixel_purchase"].includes(
          a.action_type,
        ),
      )
      .reduce((acc, a) => acc + Number(a.value || 0), 0);
    conversions = conv || null;
  }
  if (row.action_values) {
    const value = row.action_values
      .filter((a) =>
        ["purchase", "offsite_conversion.fb_pixel_purchase"].includes(a.action_type),
      )
      .reduce((acc, a) => acc + Number(a.value || 0), 0);
    conversionValueNok = value ? value * exchangeRateNokPerCurrency : null;
  }

  const spendCurrency = num(row.spend);
  return {
    date: row.date_start,
    impressions: num(row.impressions),
    clicks: num(row.clicks),
    spendNok: spendCurrency != null ? spendCurrency * exchangeRateNokPerCurrency : null,
    ctr: num(row.ctr),
    cpc: num(row.cpc) != null ? num(row.cpc)! * exchangeRateNokPerCurrency : null,
    cpm: num(row.cpm) != null ? num(row.cpm)! * exchangeRateNokPerCurrency : null,
    conversions,
    conversionValueNok,
    raw: row,
  };
}
