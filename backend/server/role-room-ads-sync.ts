/**
 * role-room-ads-sync.ts
 *
 * The spend→påslag backbone for Role Room Ads — platform-agnostic.
 *
 * Per campaign it: pulls daily insights from the platform → upserts
 * ads_attribution_daily (idempotent on campaign+date) → records the management
 * fee (påslag) into ads_management_fee_usage (idempotent on campaign+day) →
 * best-effort fires a Stripe meter event. Everything downstream — the client
 * spend report (§5.3) and the invoice basis (§4) — reads from these two tables.
 *
 * Multi-platform: the attribution/påslag/meter pipeline is identical for every
 * platform (Meta, Google Ads, LinkedIn Ads, TikTok). Only "fetch insights" and
 * "normalize a row to NOK spend" differ — captured by the PlatformConnector
 * interface. Meta is the reference connector; Google/LinkedIn slot in by
 * implementing the same interface (see docs/role-room/ads-connectors.md).
 *
 * Billing correctness:
 *   • Attribution is refreshed for EVERY day the platform returns (incl. today),
 *     so the dashboard always shows current spend.
 *   • Fees + meter events are only recorded for FINALIZED days (date < today UTC).
 *     A still-open day's spend is partial; billing it would mis-charge the client.
 *   • The Stripe meter event uses a deterministic identifier so a re-run dedupes
 *     instead of double-billing.
 *
 * All platform/Stripe I/O is injectable so the orchestration is unit-testable
 * without network access.
 */

import type { Pool } from "pg";
import {
  getCampaignInsights as defaultGetCampaignInsights,
  normalizeInsightsRow,
  type MetaInsightsRow,
} from "./role-room-meta-ads.js";
import {
  upsertAttributionDaily,
  recordManagementFee,
  listCampaignsForSync,
  type AdsCampaignRow,
} from "./role-room-ads-db.js";
import { ADS_METER_EVENT_NAMES, type AdsPlatform } from "./role-room-ads-shared.js";

/** YYYY-MM-DD for "today" in UTC — the boundary between open and finalized days. */
function todayUtc(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Normalized per-day metrics in NOK, shared shape across every platform. */
export interface NormalizedDailyMetrics {
  date: string; // YYYY-MM-DD
  impressions: number | null;
  clicks: number | null;
  spendNok: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number | null;
  conversionValueNok: number | null;
  raw: unknown;
}

export interface InsightsFetchOptions {
  sinceISO?: string;
  untilISO?: string;
  level?: "campaign" | "adset" | "ad";
}

/**
 * A platform connector is the ONLY platform-specific part of the sync pipeline:
 * how to pull daily rows and how to turn one row into NOK-normalized metrics.
 */
export interface PlatformConnector {
  platform: AdsPlatform;
  fetchInsights: (
    accessToken: string,
    externalCampaignId: string,
    options?: InsightsFetchOptions,
  ) => Promise<unknown[]>;
  normalize: (row: unknown, exchangeRateNokPerCurrency: number) => NormalizedDailyMetrics;
}

/** Reference connector — Meta Marketing API. */
export const META_CONNECTOR: PlatformConnector = {
  platform: "meta",
  fetchInsights: (token, externalId, options) =>
    defaultGetCampaignInsights(token, externalId, options),
  normalize: (row, fx) => normalizeInsightsRow(row as MetaInsightsRow, fx),
};

/** Default registry. Google/LinkedIn/TikTok connectors register here once built. */
export const DEFAULT_CONNECTORS: Partial<Record<AdsPlatform, PlatformConnector>> = {
  meta: META_CONNECTOR,
};

/**
 * Best-effort Stripe meter emitter. Returns the meter-event id on success, or
 * null if metering is not configured (no customer mapping / no meter yet). The
 * fee is still recorded in the ledger regardless, so billing data is never lost.
 */
export interface MeterEmitter {
  emit(args: {
    eventName: string;
    valueNok: number;
    userId: string;
    campaignId: string;
    usageDate: string;
    identifier: string;
  }): Promise<string | null>;
}

export interface SyncCampaignDeps {
  /** Explicit connector to use (overrides registry lookup by platform). */
  connector?: PlatformConnector;
  /** Connector registry, keyed by platform. Defaults to DEFAULT_CONNECTORS. */
  connectors?: Partial<Record<AdsPlatform, PlatformConnector>>;
  /** Back-compat shortcut for Meta: inject the insights fetcher directly. */
  getInsights?: (
    accessToken: string,
    externalCampaignId: string,
    options?: InsightsFetchOptions,
  ) => Promise<unknown[]>;
  meterEmitter?: MeterEmitter | null;
  now?: () => Date;
}

export interface SyncCampaignResult {
  campaignId: string;
  platform: AdsPlatform;
  externalCampaignId: string | null;
  daysFetched: number;
  daysFinalized: number;
  totalSpendNok: number;
  totalFeeNok: number;
  meterEventsFired: number;
  errors: string[];
}

/** Resolve the connector for a campaign from deps (explicit > getInsights > registry). */
function resolveConnector(
  campaign: AdsCampaignRow,
  deps: SyncCampaignDeps,
): PlatformConnector | null {
  if (deps.connector) return deps.connector;
  // Back-compat: a raw getInsights injection means "Meta with this fetcher".
  if (deps.getInsights) {
    return { ...META_CONNECTOR, fetchInsights: deps.getInsights };
  }
  const registry = deps.connectors ?? DEFAULT_CONNECTORS;
  return registry[campaign.platform] ?? null;
}

/**
 * Sync one campaign's spend for the given window. Platform-agnostic: dispatches
 * to the campaign's connector. Pure orchestration over injectable I/O.
 */
export async function syncCampaignSpend(
  pool: Pool,
  params: {
    campaign: AdsCampaignRow;
    accessToken: string;
    sinceISO?: string;
    untilISO?: string;
    exchangeRateNokPerCurrency?: number;
  },
  deps: SyncCampaignDeps = {},
): Promise<SyncCampaignResult> {
  const now = deps.now ?? (() => new Date());
  const meterEmitter = deps.meterEmitter ?? null;
  const { campaign } = params;

  const result: SyncCampaignResult = {
    campaignId: campaign.id,
    platform: campaign.platform,
    externalCampaignId: campaign.externalCampaignId,
    daysFetched: 0,
    daysFinalized: 0,
    totalSpendNok: 0,
    totalFeeNok: 0,
    meterEventsFired: 0,
    errors: [],
  };

  const connector = resolveConnector(campaign, deps);
  if (!connector) {
    result.errors.push(`no_connector_for_platform:${campaign.platform}`);
    return result;
  }
  if (connector.platform !== campaign.platform) {
    result.errors.push(
      `connector_platform_mismatch:${connector.platform}!=${campaign.platform}`,
    );
    return result;
  }
  if (!campaign.externalCampaignId) {
    result.errors.push("missing_external_campaign_id");
    return result;
  }

  let rows: unknown[];
  try {
    rows = await connector.fetchInsights(params.accessToken, campaign.externalCampaignId, {
      sinceISO: params.sinceISO,
      untilISO: params.untilISO,
      level: "campaign",
    });
  } catch (error) {
    result.errors.push(`insights_fetch_failed: ${String(error)}`);
    return result;
  }

  const boundary = todayUtc(now());
  const meterEventName = ADS_METER_EVENT_NAMES[campaign.platform];

  for (const row of rows) {
    result.daysFetched += 1;
    const normalized = connector.normalize(row, params.exchangeRateNokPerCurrency ?? 1);
    const date = normalized.date;

    // 1) Always refresh attribution (idempotent on campaign+date).
    try {
      await upsertAttributionDaily(pool, {
        campaignId: campaign.id,
        date,
        impressions: normalized.impressions,
        clicks: normalized.clicks,
        spendNok: normalized.spendNok,
        conversions: normalized.conversions,
        conversionValueNok: normalized.conversionValueNok,
        ctr: normalized.ctr,
        cpc: normalized.cpc,
        cpm: normalized.cpm,
        roas:
          normalized.conversionValueNok != null &&
          normalized.spendNok != null &&
          normalized.spendNok > 0
            ? normalized.conversionValueNok / normalized.spendNok
            : null,
        rawMetrics: normalized.raw as Record<string, unknown>,
      });
    } catch (error) {
      result.errors.push(`attribution_upsert_failed[${date}]: ${String(error)}`);
      continue;
    }

    const spendNok = normalized.spendNok ?? 0;

    // 2) Only finalized days (strictly before today UTC) feed billing.
    if (date >= boundary || spendNok <= 0) continue;

    try {
      const fee = await recordManagementFee(pool, {
        userId: campaign.userId,
        campaignId: campaign.id,
        platform: campaign.platform,
        spendNok,
        feeRate: campaign.managementFeeRate,
        usageDate: date,
      });
      result.daysFinalized += 1;
      result.totalSpendNok += spendNok;
      result.totalFeeNok += fee.managementFeeNok;

      // 3) Best-effort meter event — deterministic identifier dedupes re-runs.
      if (meterEmitter) {
        try {
          const eventId = await meterEmitter.emit({
            eventName: meterEventName,
            valueNok: spendNok,
            userId: campaign.userId,
            campaignId: campaign.id,
            usageDate: date,
            identifier: `${campaign.id}:${date}`,
          });
          if (eventId) {
            result.meterEventsFired += 1;
            // Persist the meter-event id (preserved on conflict).
            await recordManagementFee(pool, {
              userId: campaign.userId,
              campaignId: campaign.id,
              platform: campaign.platform,
              spendNok,
              feeRate: campaign.managementFeeRate,
              usageDate: date,
              stripeMeterEventId: eventId,
            });
          }
        } catch (error) {
          result.errors.push(`meter_emit_failed[${date}]: ${String(error)}`);
        }
      }
    } catch (error) {
      result.errors.push(`fee_record_failed[${date}]: ${String(error)}`);
    }
  }

  return result;
}

/**
 * Back-compat alias for the Meta path. Existing routes/tests call this; it now
 * dispatches through the generic pipeline. Prefer syncCampaignSpend for new code.
 */
export const syncMetaCampaignSpend = syncCampaignSpend;

export interface SweepSummary {
  campaignsConsidered: number;
  campaignsSynced: number;
  totalSpendNok: number;
  totalFeeNok: number;
  meterEventsFired: number;
  perCampaign: SyncCampaignResult[];
  errors: string[];
}

export interface SweepDeps {
  /**
   * Resolve a user's access token for a given platform. Token sources differ
   * per platform (Meta → Instagram OAuth connection, Google/LinkedIn → their
   * own OAuth connections), so the route supplies the resolver.
   */
  resolveToken: (platform: AdsPlatform, userId: string) => Promise<string | null>;
  /** Connector registry. Defaults to DEFAULT_CONNECTORS (Meta only, for now). */
  connectors?: Partial<Record<AdsPlatform, PlatformConnector>>;
  meterEmitter?: MeterEmitter | null;
  now?: () => Date;
  /** Window start; defaults to last 7 days so late-attributed spend is caught. */
  sinceISO?: string;
  untilISO?: string;
}

/**
 * Sweep all syncable campaigns across users and platforms. Intended to run
 * daily (HTTP cron-tick or in-process interval). Campaigns whose platform has
 * no registered connector are skipped with a logged error.
 */
export async function runAdsAttributionSweep(
  pool: Pool,
  deps: SweepDeps,
): Promise<SweepSummary> {
  const now = deps.now ?? (() => new Date());
  const connectors = deps.connectors ?? DEFAULT_CONNECTORS;
  const sinceISO =
    deps.sinceISO ?? new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const summary: SweepSummary = {
    campaignsConsidered: 0,
    campaignsSynced: 0,
    totalSpendNok: 0,
    totalFeeNok: 0,
    meterEventsFired: 0,
    perCampaign: [],
    errors: [],
  };

  const campaigns = await listCampaignsForSync(pool); // all platforms
  summary.campaignsConsidered = campaigns.length;

  const tokenCache = new Map<string, string | null>();

  for (const campaign of campaigns) {
    const connector = connectors[campaign.platform];
    if (!connector) {
      summary.errors.push(`no_connector_for_platform:${campaign.platform}`);
      continue;
    }

    const tokenKey = `${campaign.platform}:${campaign.userId}`;
    let token = tokenCache.get(tokenKey);
    if (token === undefined) {
      token = await deps.resolveToken(campaign.platform, campaign.userId).catch(() => null);
      tokenCache.set(tokenKey, token);
    }
    if (!token) {
      summary.errors.push(`no_token:${tokenKey}`);
      continue;
    }

    const res = await syncCampaignSpend(
      pool,
      { campaign, accessToken: token, sinceISO, untilISO: deps.untilISO },
      { connector, meterEmitter: deps.meterEmitter, now },
    );
    summary.perCampaign.push(res);
    summary.campaignsSynced += 1;
    summary.totalSpendNok += res.totalSpendNok;
    summary.totalFeeNok += res.totalFeeNok;
    summary.meterEventsFired += res.meterEventsFired;
  }

  return summary;
}
