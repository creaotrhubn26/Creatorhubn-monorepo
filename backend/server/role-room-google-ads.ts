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

// ─────────────────────────────────────────────────────────
// Write paths — campaign lifecycle (create / pause / resume / end).
// Uses the Google Ads REST mutate endpoints. Requires developer-token +
// ads_management-scoped OAuth. API-side ready; needs live verification once the
// Google OAuth connection + developer token are configured.
// ─────────────────────────────────────────────────────────

export interface GoogleAdsAuth {
  accessToken: string;
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
}

async function googleAdsMutate(
  auth: GoogleAdsAuth,
  service: string,
  operations: unknown[],
): Promise<{ resourceName: string }[]> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.accessToken}`,
    "developer-token": auth.developerToken,
    "content-type": "application/json",
  };
  if (auth.loginCustomerId) headers["login-customer-id"] = auth.loginCustomerId;

  const res = await fetchImpl(
    `${GOOGLE_ADS_BASE}/customers/${auth.customerId}/${service}:mutate`,
    { method: "POST", headers, body: JSON.stringify({ operations }) },
  );
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (raw as { error?: { message?: string } })?.error?.message ||
      `Google Ads ${service}:mutate failed (HTTP ${res.status})`;
    throw new GoogleAdsApiError(res.status, msg, raw);
  }
  return ((raw as { results?: { resourceName: string }[] })?.results ?? []);
}

export type GoogleCampaignStatus = "ENABLED" | "PAUSED" | "REMOVED";

/** Pause (PAUSED), resume (ENABLED) or end (REMOVED) a Google campaign. */
export async function setGoogleCampaignStatus(
  auth: GoogleAdsAuth,
  campaignResourceName: string,
  status: GoogleCampaignStatus,
): Promise<{ resourceName: string }> {
  const results = await googleAdsMutate(auth, "campaigns", [
    { update: { resourceName: campaignResourceName, status }, updateMask: "status" },
  ]);
  return { resourceName: results[0]?.resourceName ?? campaignResourceName };
}

export interface CreateGoogleCampaignInput extends GoogleAdsAuth {
  name: string;
  dailyBudgetNok: number;
  /** Defaults to SEARCH. */
  channelType?: "SEARCH" | "DISPLAY" | "PERFORMANCE_MAX" | "VIDEO";
}

/**
 * Create a Google campaign (budget + campaign, status PAUSED). Minimal valid
 * SEARCH campaign with manual CPC + standard daily budget. amountMicros assumes
 * the account currency matches NOK; the metrics poll reconciles otherwise.
 */
export async function createGoogleCampaign(
  input: CreateGoogleCampaignInput,
): Promise<{ campaignResourceName: string; budgetResourceName: string }> {
  const amountMicros = String(Math.round(Math.max(0, input.dailyBudgetNok) * 1_000_000));
  const budgetResults = await googleAdsMutate(input, "campaignBudgets", [
    {
      create: {
        name: `${input.name} – budsjett ${Date.now()}`,
        amountMicros,
        deliveryMethod: "STANDARD",
        explicitlyShared: false,
      },
    },
  ]);
  const budgetResourceName = budgetResults[0]?.resourceName;
  if (!budgetResourceName) {
    throw new GoogleAdsApiError(500, "campaignBudgets:mutate returned no resourceName");
  }

  const campaignResults = await googleAdsMutate(input, "campaigns", [
    {
      create: {
        name: input.name,
        status: "PAUSED",
        advertisingChannelType: input.channelType ?? "SEARCH",
        campaignBudget: budgetResourceName,
        manualCpc: {},
        networkSettings: {
          targetGoogleSearch: true,
          targetSearchNetwork: true,
          targetContentNetwork: false,
          targetPartnerSearchNetwork: false,
        },
      },
    },
  ]);
  const campaignResourceName = campaignResults[0]?.resourceName;
  if (!campaignResourceName) {
    throw new GoogleAdsApiError(500, "campaigns:mutate returned no resourceName");
  }
  return { campaignResourceName, budgetResourceName };
}

/**
 * Customer ids the producer's token can access — i.e. the Google Ads accounts
 * the client has granted. Used to verify access before running campaigns.
 */
export async function listAccessibleCustomers(auth: {
  accessToken: string;
  developerToken: string;
}): Promise<string[]> {
  const res = await fetchImpl(`${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "developer-token": auth.developerToken,
    },
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (raw as { error?: { message?: string } })?.error?.message ||
      `listAccessibleCustomers failed (HTTP ${res.status})`;
    throw new GoogleAdsApiError(res.status, msg, raw);
  }
  return ((raw as { resourceNames?: string[] })?.resourceNames ?? []).map((rn) =>
    rn.replace(/^customers\//, ""),
  );
}

/** True if the producer has access to the given Google Ads customer id. */
export async function hasGoogleCustomerAccess(
  auth: { accessToken: string; developerToken: string },
  customerId: string,
): Promise<boolean> {
  try {
    return (await listAccessibleCustomers(auth)).includes(customerId);
  } catch {
    return false;
  }
}

/**
 * Status for én MCC↔kunde-link slik Google Ads-API rapporterer den.
 * - PENDING: invitasjonen er sendt fra MCC, klient har ikke godkjent ennå
 * - ACTIVE: linken er aktiv (samme som å finne customer i listAccessibleCustomers)
 * - REFUSED: klient avviste
 * - CANCELED: produsenten kansellerte invitasjonen
 * - INACTIVE: linken er deaktivert
 * - UNKNOWN: andre statuser vi ikke modellerer eksplisitt
 */
export type GoogleAdsMccLinkStatus =
  | "PENDING"
  | "ACTIVE"
  | "REFUSED"
  | "CANCELED"
  | "INACTIVE"
  | "UNKNOWN";

export interface GoogleAdsMccLink {
  clientCustomerId: string;
  status: GoogleAdsMccLinkStatus;
  managerLinkId: string | null;
  hidden: boolean;
}

/**
 * Sender en MCC↔kunde invitasjon fra produsentens MCC til den oppgitte
 * client-customer-id-en. Klienten ser invitasjonen som en notifikasjon i
 * sin Google Ads og kan godkjenne med ett klikk.
 *
 * Krever at produsentens OAuth-token har scope `adwords` og at
 * `loginCustomerId` er satt til MCC-en (vi bruker GOOGLE_ADS_LOGIN_CUSTOMER_ID).
 *
 * Returnerer manager_link_id som vi kan bruke senere til å sjekke status
 * eller kansellere.
 */
export async function sendMccInvite(
  auth: { accessToken: string; developerToken: string; loginCustomerId: string },
  clientCustomerId: string,
): Promise<{ resourceName: string; managerLinkId: string | null }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.accessToken}`,
    "developer-token": auth.developerToken,
    "login-customer-id": auth.loginCustomerId,
    "content-type": "application/json",
  };
  // POST /customers/{login_customer_id}/customerClientLinks:mutate
  // create { client_customer: "customers/{clientCustomerId}", status: PENDING }
  const body = {
    operations: [
      {
        create: {
          clientCustomer: `customers/${clientCustomerId}`,
          status: "PENDING",
        },
      },
    ],
  };
  const res = await fetchImpl(
    `${GOOGLE_ADS_BASE}/customers/${auth.loginCustomerId}/customerClientLinks:mutate`,
    { method: "POST", headers, body: JSON.stringify(body) },
  );
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (raw as { error?: { message?: string } })?.error?.message ||
      `sendMccInvite failed (HTTP ${res.status})`;
    throw new GoogleAdsApiError(res.status, msg, raw);
  }
  const result = ((raw as { results?: { resourceName: string }[] })?.results ?? [])[0];
  const resourceName = result?.resourceName || "";
  // resourceName format: customers/{mcc}/customerClientLinks/{client_customer_id}~{manager_link_id}
  const managerLinkId = resourceName.split("~")[1] ?? null;
  return { resourceName, managerLinkId };
}

/**
 * Lister alle MCC↔kunde-links (pending + active + refused) fra MCC-en.
 * Brukes til å vise dashboard med invitasjons-status per kunde.
 *
 * Bruker GAQL searchStream mot customer_client_link i MCC.
 */
export async function listMccLinks(auth: {
  accessToken: string;
  developerToken: string;
  loginCustomerId: string;
}): Promise<GoogleAdsMccLink[]> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.accessToken}`,
    "developer-token": auth.developerToken,
    "login-customer-id": auth.loginCustomerId,
    "content-type": "application/json",
  };
  const query = `
    SELECT
      customer_client_link.client_customer,
      customer_client_link.manager_link_id,
      customer_client_link.status,
      customer_client_link.hidden
    FROM customer_client_link
    ORDER BY customer_client_link.status
  `;
  const res = await fetchImpl(
    `${GOOGLE_ADS_BASE}/customers/${auth.loginCustomerId}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query }) },
  );
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (raw as { error?: { message?: string } })?.error?.message ||
      `listMccLinks failed (HTTP ${res.status})`;
    throw new GoogleAdsApiError(res.status, msg, raw);
  }
  // searchStream returnerer array av batcher: [{ results: [{ customerClientLink: {...} }] }]
  const batches = Array.isArray(raw) ? raw : [raw];
  const allLinks: GoogleAdsMccLink[] = [];
  for (const batch of batches) {
    const results = (batch as { results?: unknown[] })?.results ?? [];
    for (const row of results) {
      const link = (row as { customerClientLink?: Record<string, unknown> })
        ?.customerClientLink;
      if (!link) continue;
      const clientResourceName = String(link.clientCustomer || "");
      const clientCustomerId = clientResourceName.replace(/^customers\//, "");
      if (!clientCustomerId) continue;
      const status = String(link.status || "UNKNOWN").toUpperCase();
      allLinks.push({
        clientCustomerId,
        status: ([
          "PENDING",
          "ACTIVE",
          "REFUSED",
          "CANCELED",
          "INACTIVE",
        ].includes(status)
          ? (status as GoogleAdsMccLinkStatus)
          : "UNKNOWN"),
        managerLinkId: link.managerLinkId ? String(link.managerLinkId) : null,
        hidden: Boolean(link.hidden),
      });
    }
  }
  return allLinks;
}

/**
 * Henter MCC↔kunde-link-status for én spesifikk kunde-id. Returnerer null
 * hvis ingen invitasjon/link finnes (klienten har aldri vært invitert).
 */
export async function getMccLinkStatus(
  auth: { accessToken: string; developerToken: string; loginCustomerId: string },
  clientCustomerId: string,
): Promise<GoogleAdsMccLink | null> {
  try {
    const links = await listMccLinks(auth);
    return links.find((l) => l.clientCustomerId === clientCustomerId) ?? null;
  } catch {
    return null;
  }
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
