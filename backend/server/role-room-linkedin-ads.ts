/**
 * role-room-linkedin-ads.ts
 *
 * Thin wrapper around the LinkedIn Marketing API (adAnalytics finder), and a
 * PlatformConnector adapter so LinkedIn Ads spend flows through the same
 * spend→påslag-ryggrad as Meta/Google (see role-room-ads-sync.ts).
 *
 * What this layer covers:
 *   • getCampaignInsights()    → daily cost/impressions/clicks/conversions
 *   • normalizeLinkedInRow()   → costInLocalCurrency (account currency) → spendNok
 *   • makeLinkedInAdsConnector() → PlatformConnector for the sync pipeline
 *
 * Auth model:
 *   • Authorization  — per-user OAuth2 bearer (scopes r_ads + r_ads_reporting),
 *                      resolved by the sweep's resolveToken('linkedin', userId).
 *   • LinkedIn-Version — required header (YYYYMM), from LINKEDIN_API_VERSION.
 *   • X-Restli-Protocol-Version: 2.0.0 — required by the REST endpoints.
 *
 * Campaign reference: we store the campaign URN "urn:li:sponsoredCampaign:{id}"
 * (or a bare numeric id) in ads_campaigns.external_campaign_id.
 *
 * Until LinkedIn Marketing Developer Platform access + OAuth land this module is
 * API-side ready; see docs/role-room/ads-connectors.md.
 */

import type {
  PlatformConnector,
  NormalizedDailyMetrics,
  InsightsFetchOptions,
} from "./role-room-ads-sync.js";

const LINKEDIN_BASE = "https://api.linkedin.com/rest";
const DEFAULT_LINKEDIN_VERSION = "202501";

export interface LinkedInInsightsRow {
  date: string; // YYYY-MM-DD (from dateRange.start)
  costInLocalCurrency: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValueInLocalCurrency: number;
}

export class LinkedInAdsApiError extends Error {
  readonly statusCode: number;
  readonly detail?: unknown;
  constructor(statusCode: number, message: string, detail?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.detail = detail;
    this.name = "LinkedInAdsApiError";
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
export function __setLinkedInAdsFetch(impl: FetchLike): void {
  fetchImpl = impl;
}
export function __resetLinkedInAdsFetch(): void {
  fetchImpl = globalThis.fetch as unknown as FetchLike;
}

/**
 * Extract the numeric campaign id from a sponsoredCampaign URN.
 * Accepts "urn:li:sponsoredCampaign:456" or a bare "456".
 */
export function parseCampaignUrn(
  ref: string,
): { campaignId: string; urn: string } | null {
  if (!ref) return null;
  const urnMatch = ref.match(/urn:li:sponsoredCampaign:(\d+)/);
  if (urnMatch) return { campaignId: urnMatch[1], urn: ref };
  if (/^\d+$/.test(ref)) {
    return { campaignId: ref, urn: `urn:li:sponsoredCampaign:${ref}` };
  }
  return null;
}

interface LinkedInDateParts {
  year: number;
  month: number;
  day: number;
}

function toDateParts(iso?: string, fallback?: LinkedInDateParts): LinkedInDateParts {
  if (iso) {
    const d = new Date(iso);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }
  return fallback ?? { year: 1970, month: 1, day: 1 };
}

function dateRangeParam(sinceISO?: string, untilISO?: string): string {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const start = toDateParts(sinceISO, {
    year: sevenDaysAgo.getUTCFullYear(),
    month: sevenDaysAgo.getUTCMonth() + 1,
    day: sevenDaysAgo.getUTCDate(),
  });
  const end = toDateParts(untilISO, {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  });
  return (
    `(start:(year:${start.year},month:${start.month},day:${start.day}),` +
    `end:(year:${end.year},month:${end.month},day:${end.day}))`
  );
}

export interface LinkedInInsightsInput {
  accessToken: string;
  campaignUrn: string;
  apiVersion?: string;
  sinceISO?: string;
  untilISO?: string;
}

/** Fetch daily campaign analytics via the adAnalytics finder. */
export async function getCampaignInsights(
  input: LinkedInInsightsInput,
): Promise<LinkedInInsightsRow[]> {
  const params = new URLSearchParams({
    q: "analytics",
    pivot: "CAMPAIGN",
    timeGranularity: "DAILY",
    dateRange: dateRangeParam(input.sinceISO, input.untilISO),
    campaigns: `List(${encodeURIComponent(input.campaignUrn)})`,
    fields:
      "costInLocalCurrency,impressions,clicks,externalWebsiteConversions,conversionValueInLocalCurrency,dateRange",
  });

  const res = await fetchImpl(`${LINKEDIN_BASE}/adAnalytics?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "LinkedIn-Version": input.apiVersion ?? DEFAULT_LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (raw as { message?: string })?.message ||
      `LinkedIn adAnalytics failed (HTTP ${res.status})`;
    throw new LinkedInAdsApiError(res.status, msg, raw);
  }

  const elements = (raw as { elements?: unknown[] })?.elements ?? [];
  const rows: LinkedInInsightsRow[] = [];
  for (const el of elements) {
    const obj = el as {
      costInLocalCurrency?: string | number;
      impressions?: string | number;
      clicks?: string | number;
      externalWebsiteConversions?: string | number;
      conversionValueInLocalCurrency?: string | number;
      dateRange?: { start?: LinkedInDateParts };
    };
    const start = obj.dateRange?.start;
    if (!start) continue;
    const date =
      `${start.year}-${String(start.month).padStart(2, "0")}-${String(start.day).padStart(2, "0")}`;
    rows.push({
      date,
      costInLocalCurrency: Number(obj.costInLocalCurrency ?? 0),
      impressions: Number(obj.impressions ?? 0),
      clicks: Number(obj.clicks ?? 0),
      conversions: Number(obj.externalWebsiteConversions ?? 0),
      conversionValueInLocalCurrency: Number(obj.conversionValueInLocalCurrency ?? 0),
    });
  }
  return rows;
}

/** Normalize a LinkedIn row to the shared NOK metrics shape. */
export function normalizeLinkedInRow(
  row: LinkedInInsightsRow,
  exchangeRateNokPerCurrency = 1,
): NormalizedDailyMetrics {
  const spendNok = row.costInLocalCurrency * exchangeRateNokPerCurrency;
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
    conversionValueNok: row.conversionValueInLocalCurrency
      ? row.conversionValueInLocalCurrency * exchangeRateNokPerCurrency
      : null,
    raw: row,
  };
}

// ─────────────────────────────────────────────────────────
// Granted-asset visibility — which ad accounts / Company Pages the client
// gave the producer access to, and at what role.
// ─────────────────────────────────────────────────────────

/** Ad-account roles that count as admin-level access. */
const LINKEDIN_AD_ADMIN_ROLES = new Set(["ACCOUNT_BILLING_ADMIN", "ACCOUNT_MANAGER"]);

export interface LinkedInManagedAsset {
  assetType: "ad_account" | "organization";
  id: string; // urn
  name: string | null;
  /** Client brand logo (organizations only; ad accounts have none). */
  logoUrl: string | null;
  role: string;
  isAdmin: boolean;
}

/**
 * Pull the image URL out of a decorated organization logoV2. The shape from
 * `logoV2(original~:playableStreams)` is
 * logoV2.original~.elements[0].identifiers[0].identifier. Defensive — returns
 * null on any missing link.
 */
export function extractLinkedInLogoUrl(decoratedOrg: unknown): string | null {
  const org = decoratedOrg as {
    logoV2?: { "original~"?: { elements?: Array<{ identifiers?: Array<{ identifier?: string }> }> } };
  };
  const el = org?.logoV2?.["original~"]?.elements?.[0];
  const url = el?.identifiers?.[0]?.identifier;
  return typeof url === "string" && url ? url : null;
}

/** Human-readable Norwegian label for a LinkedIn role. */
export function linkedInRoleLabel(role: string): string {
  switch (role) {
    case "ACCOUNT_BILLING_ADMIN":
      return "Full admin (fakturering)";
    case "ACCOUNT_MANAGER":
      return "Kontoadministrator";
    case "CAMPAIGN_MANAGER":
      return "Kampanjeansvarlig";
    case "CREATIVE_MANAGER":
      return "Kreativansvarlig";
    case "VIEWER":
      return "Leser";
    case "ADMINISTRATOR":
      return "Full admin";
    default:
      return role;
  }
}

async function linkedInGet(
  path: string,
  params: URLSearchParams,
  accessToken: string,
  apiVersion?: string,
): Promise<{ ok: boolean; status: number; raw: unknown }> {
  const res = await fetchImpl(`${LINKEDIN_BASE}${path}?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": apiVersion ?? DEFAULT_LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  const raw = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, raw };
}

/**
 * Ad accounts the authenticated producer has a role on (adAccountUsers finder).
 * Uses projection decoration to inline the account name. Needs scope r_ads.
 */
export async function listManagedAdAccounts(
  accessToken: string,
  apiVersion?: string,
): Promise<LinkedInManagedAsset[]> {
  const params = new URLSearchParams({
    q: "authenticatedUser",
    projection: "(elements*(role,account~(id,name)))",
  });
  const { ok, raw } = await linkedInGet("/adAccountUsers", params, accessToken, apiVersion);
  if (!ok) return [];
  const elements = (raw as { elements?: unknown[] })?.elements ?? [];
  return elements.map((el) => {
    const obj = el as {
      account?: string;
      role?: string;
      "account~"?: { id?: string | number; name?: string };
    };
    const role = obj.role ?? "VIEWER";
    const decorated = obj["account~"];
    const id = obj.account ?? (decorated?.id != null ? `urn:li:sponsoredAccount:${decorated.id}` : "");
    return {
      assetType: "ad_account" as const,
      id,
      name: decorated?.name ?? null,
      logoUrl: null, // ad accounts have no logo
      role,
      isAdmin: LINKEDIN_AD_ADMIN_ROLES.has(role),
    };
  });
}

/**
 * Company Pages (organizations) the producer is an admin of (organizationAcls).
 * Best-effort: needs scope r_organization_admin — returns [] if not granted.
 */
export async function listManagedOrganizations(
  accessToken: string,
  apiVersion?: string,
): Promise<LinkedInManagedAsset[]> {
  const params = new URLSearchParams({
    q: "roleAssignee",
    state: "APPROVED",
    projection:
      "(elements*(role,state,organization~(id,localizedName,logoV2(original~:playableStreams))))",
  });
  const { ok, raw } = await linkedInGet("/organizationAcls", params, accessToken, apiVersion);
  if (!ok) return [];
  const elements = (raw as { elements?: unknown[] })?.elements ?? [];
  return elements.map((el) => {
    const obj = el as {
      organization?: string;
      role?: string;
      "organization~"?: { id?: string | number; localizedName?: string };
    };
    const role = obj.role ?? "VIEWER";
    const decorated = obj["organization~"];
    const id = obj.organization ?? (decorated?.id != null ? `urn:li:organization:${decorated.id}` : "");
    return {
      assetType: "organization" as const,
      id,
      name: decorated?.localizedName ?? null,
      logoUrl: extractLinkedInLogoUrl(decorated),
      role,
      isAdmin: role === "ADMINISTRATOR",
    };
  });
}

/** All LinkedIn assets the producer has access to (ad accounts + organizations). */
export async function listGrantedLinkedInAssets(
  accessToken: string,
  apiVersion?: string,
): Promise<LinkedInManagedAsset[]> {
  const [accounts, orgs] = await Promise.all([
    listManagedAdAccounts(accessToken, apiVersion).catch(() => []),
    listManagedOrganizations(accessToken, apiVersion).catch(() => []),
  ]);
  return [...accounts, ...orgs];
}

export interface LinkedInAdsConnectorConfig {
  apiVersion?: string;
}

/**
 * Build a PlatformConnector for LinkedIn Ads. The campaign's external_campaign_id
 * must be the campaign URN "urn:li:sponsoredCampaign:{id}" (or a bare numeric id).
 */
export function makeLinkedInAdsConnector(
  config: LinkedInAdsConnectorConfig = {},
): PlatformConnector {
  return {
    platform: "linkedin",
    fetchInsights: async (
      accessToken: string,
      externalCampaignId: string,
      options?: InsightsFetchOptions,
    ) => {
      const parsed = parseCampaignUrn(externalCampaignId);
      if (!parsed) {
        throw new LinkedInAdsApiError(
          400,
          `Invalid LinkedIn campaign ref: ${externalCampaignId} (expected urn:li:sponsoredCampaign:{id})`,
        );
      }
      return getCampaignInsights({
        accessToken,
        campaignUrn: parsed.urn,
        apiVersion: config.apiVersion,
        sinceISO: options?.sinceISO,
        untilISO: options?.untilISO,
      });
    },
    normalize: (row, fx) => normalizeLinkedInRow(row as LinkedInInsightsRow, fx),
  };
}

/**
 * Build the LinkedIn connector from env. Always returns a connector (the gate is
 * the per-user OAuth token + Marketing Developer Platform access, not an
 * app-level secret). Callers merge it into the connector registry.
 */
export function getLinkedInAdsConnectorFromEnv(): PlatformConnector {
  return makeLinkedInAdsConnector({
    apiVersion: process.env.LINKEDIN_API_VERSION || undefined,
  });
}
