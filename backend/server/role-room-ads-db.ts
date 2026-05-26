/**
 * role-room-ads-db.ts
 *
 * Persistence helpers for the ads_* tables (Migration 128).
 * Pure DB layer — no API calls. Routes call these after platform-side
 * mutations succeed.
 */

import type { Pool } from "pg";
import {
  computeManagementFee,
  billingPeriodForDate,
  resolveManagementFeeRate,
  ADS_METER_EVENT_NAMES,
  type AdsPlatform,
  type AdsGoal,
} from "./role-room-ads-shared.js";

export interface AdsCampaignRow {
  id: string;
  projectId: string;
  userId: string;
  businessProfileId: string | null;
  platform: AdsPlatform;
  externalCampaignId: string | null;
  sourcePostId: string | null;
  sourceAssetId: string | null;
  status: "draft" | "active" | "paused" | "ended" | "failed";
  goal: string | null;
  dailyBudgetNok: number | null;
  totalBudgetNok: number | null;
  managementFeeRate: number;
  audienceConfig: Record<string, unknown> | null;
  creativeConfig: Record<string, unknown> | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InsertCampaignInput {
  projectId: string;
  userId: string;
  businessProfileId?: string | null;
  platform: AdsPlatform;
  externalCampaignId?: string | null;
  sourcePostId?: string | null;
  sourceAssetId?: string | null;
  status?: AdsCampaignRow["status"];
  goal?: AdsGoal | string | null;
  dailyBudgetNok?: number | null;
  totalBudgetNok?: number | null;
  /** Per-client påslag (0–1). Defaults to MANAGEMENT_FEE_RATE (0.20). */
  managementFeeRate?: number | null;
  audienceConfig?: Record<string, unknown> | null;
  creativeConfig?: Record<string, unknown> | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

function rowToCampaign(row: Record<string, unknown>): AdsCampaignRow {
  const num = (v: unknown): number | null =>
    v == null ? null : typeof v === "number" ? v : Number(v);
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    userId: row.user_id as string,
    businessProfileId: (row.business_profile_id as string | null) ?? null,
    platform: row.platform as AdsPlatform,
    externalCampaignId: (row.external_campaign_id as string | null) ?? null,
    sourcePostId: (row.source_post_id as string | null) ?? null,
    sourceAssetId: (row.source_asset_id as string | null) ?? null,
    status: row.status as AdsCampaignRow["status"],
    goal: (row.goal as string | null) ?? null,
    dailyBudgetNok: num(row.daily_budget_nok),
    totalBudgetNok: num(row.total_budget_nok),
    managementFeeRate: resolveManagementFeeRate(num(row.management_fee_rate)),
    audienceConfig: (row.audience_config as Record<string, unknown> | null) ?? null,
    creativeConfig: (row.creative_config as Record<string, unknown> | null) ?? null,
    startsAt: row.starts_at ? new Date(row.starts_at as string).toISOString() : null,
    endsAt: row.ends_at ? new Date(row.ends_at as string).toISOString() : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export async function insertCampaign(
  pool: Pool,
  input: InsertCampaignInput,
): Promise<AdsCampaignRow> {
  const result = await pool.query(
    `INSERT INTO ads_campaigns
       (project_id, user_id, business_profile_id, platform, external_campaign_id,
        source_post_id, source_asset_id, status, goal,
        daily_budget_nok, total_budget_nok, management_fee_rate,
        audience_config, creative_config, starts_at, ends_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      input.projectId,
      input.userId,
      input.businessProfileId ?? null,
      input.platform,
      input.externalCampaignId ?? null,
      input.sourcePostId ?? null,
      input.sourceAssetId ?? null,
      input.status ?? "draft",
      input.goal ?? null,
      input.dailyBudgetNok ?? null,
      input.totalBudgetNok ?? null,
      resolveManagementFeeRate(input.managementFeeRate),
      input.audienceConfig ? JSON.stringify(input.audienceConfig) : null,
      input.creativeConfig ? JSON.stringify(input.creativeConfig) : null,
      input.startsAt ?? null,
      input.endsAt ?? null,
    ],
  );
  return rowToCampaign(result.rows[0]);
}

export async function updateCampaignStatus(
  pool: Pool,
  campaignId: string,
  status: AdsCampaignRow["status"],
): Promise<AdsCampaignRow | null> {
  const result = await pool.query(
    `UPDATE ads_campaigns SET status = $2, updated_at = now()
       WHERE id = $1 RETURNING *`,
    [campaignId, status],
  );
  if (!result.rowCount) return null;
  return rowToCampaign(result.rows[0]);
}

export async function getCampaignById(
  pool: Pool,
  campaignId: string,
): Promise<AdsCampaignRow | null> {
  const result = await pool.query(
    `SELECT * FROM ads_campaigns WHERE id = $1`,
    [campaignId],
  );
  if (!result.rowCount) return null;
  return rowToCampaign(result.rows[0]);
}

export async function listCampaignsForUser(
  pool: Pool,
  userId: string,
  options?: { projectId?: string; platform?: AdsPlatform; status?: AdsCampaignRow["status"] },
): Promise<AdsCampaignRow[]> {
  const params: unknown[] = [userId];
  let where = "user_id = $1";
  if (options?.projectId) {
    params.push(options.projectId);
    where += ` AND project_id = $${params.length}`;
  }
  if (options?.platform) {
    params.push(options.platform);
    where += ` AND platform = $${params.length}`;
  }
  if (options?.status) {
    params.push(options.status);
    where += ` AND status = $${params.length}`;
  }
  const result = await pool.query(
    `SELECT * FROM ads_campaigns WHERE ${where} ORDER BY created_at DESC LIMIT 200`,
    params,
  );
  return result.rows.map(rowToCampaign);
}

// ─────────────────────────────────────────────────────────
// Daily attribution upsert (idempotent on (campaign_id, date))
// ─────────────────────────────────────────────────────────

export interface AttributionDailyInput {
  campaignId: string;
  date: string; // YYYY-MM-DD
  impressions?: number | null;
  clicks?: number | null;
  spendNok?: number | null;
  conversions?: number | null;
  conversionValueNok?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  roas?: number | null;
  rawMetrics?: Record<string, unknown>;
}

export async function upsertAttributionDaily(
  pool: Pool,
  input: AttributionDailyInput,
): Promise<void> {
  await pool.query(
    `INSERT INTO ads_attribution_daily
       (campaign_id, date, impressions, clicks, spend_nok,
        conversions, conversion_value_nok, ctr, cpc, cpm, roas, raw_metrics, fetched_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
     ON CONFLICT (campaign_id, date) DO UPDATE SET
       impressions = EXCLUDED.impressions,
       clicks = EXCLUDED.clicks,
       spend_nok = EXCLUDED.spend_nok,
       conversions = EXCLUDED.conversions,
       conversion_value_nok = EXCLUDED.conversion_value_nok,
       ctr = EXCLUDED.ctr,
       cpc = EXCLUDED.cpc,
       cpm = EXCLUDED.cpm,
       roas = EXCLUDED.roas,
       raw_metrics = EXCLUDED.raw_metrics,
       fetched_at = now()`,
    [
      input.campaignId,
      input.date,
      input.impressions ?? null,
      input.clicks ?? null,
      input.spendNok ?? null,
      input.conversions ?? null,
      input.conversionValueNok ?? null,
      input.ctr ?? null,
      input.cpc ?? null,
      input.cpm ?? null,
      input.roas ?? null,
      input.rawMetrics ? JSON.stringify(input.rawMetrics) : null,
    ],
  );
}

// ─────────────────────────────────────────────────────────
// Management-fee ledger (one row per campaign+day spend)
// ─────────────────────────────────────────────────────────

export interface RecordManagementFeeInput {
  userId: string;
  campaignId: string;
  platform: AdsPlatform;
  spendNok: number;
  /** Per-client påslag (0–1). Defaults to MANAGEMENT_FEE_RATE (0.20). */
  feeRate?: number | null;
  /** The day the spend belongs to (idempotency key). Defaults to recordedAt's date. */
  usageDate?: string; // YYYY-MM-DD
  recordedAt?: Date;
  stripeMeterEventId?: string | null;
}

/**
 * Idempotent on (campaign_id, usage_date): the daily insights-poll can re-run
 * safely without double-counting påslag. An existing stripe_meter_event_id is
 * preserved on conflict so we never lose the record of having metered a day.
 */
export async function recordManagementFee(
  pool: Pool,
  input: RecordManagementFeeInput,
): Promise<{
  id: string;
  managementFeeRate: number;
  managementFeeNok: number;
  totalInclVatNok: number;
  period: string;
  usageDate: string;
}> {
  const fee = computeManagementFee(input.spendNok, input.feeRate ?? undefined);
  const recordedAt = input.recordedAt ?? new Date();
  const usageDate = input.usageDate ?? recordedAt.toISOString().slice(0, 10);
  const period = billingPeriodForDate(new Date(`${usageDate}T00:00:00.000Z`));

  const result = await pool.query(
    `INSERT INTO ads_management_fee_usage
       (user_id, campaign_id, platform, billing_period, usage_date, spend_nok,
        management_fee_nok, management_fee_rate, vat_rate, total_incl_vat_nok,
        stripe_meter_event_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (campaign_id, usage_date) WHERE usage_date IS NOT NULL DO UPDATE SET
       user_id = EXCLUDED.user_id,
       platform = EXCLUDED.platform,
       billing_period = EXCLUDED.billing_period,
       spend_nok = EXCLUDED.spend_nok,
       management_fee_nok = EXCLUDED.management_fee_nok,
       management_fee_rate = EXCLUDED.management_fee_rate,
       vat_rate = EXCLUDED.vat_rate,
       total_incl_vat_nok = EXCLUDED.total_incl_vat_nok,
       stripe_meter_event_id =
         COALESCE(EXCLUDED.stripe_meter_event_id, ads_management_fee_usage.stripe_meter_event_id)
     RETURNING id`,
    [
      input.userId,
      input.campaignId,
      input.platform,
      period,
      usageDate,
      input.spendNok,
      fee.managementFeeNok,
      fee.managementFeeRate,
      0.25,
      fee.totalInclVatNok,
      input.stripeMeterEventId ?? null,
    ],
  );

  return {
    id: result.rows[0].id as string,
    managementFeeRate: fee.managementFeeRate,
    managementFeeNok: fee.managementFeeNok,
    totalInclVatNok: fee.totalInclVatNok,
    period,
    usageDate,
  };
}

/**
 * List campaigns the daily insights-poll should sync: any platform campaign
 * that has been live (active/paused/ended) and carries an external id. Used by
 * runAdsAttributionSweep across all users.
 */
export async function listCampaignsForSync(
  pool: Pool,
  options?: { platform?: AdsPlatform },
): Promise<AdsCampaignRow[]> {
  const params: unknown[] = [];
  let where =
    "external_campaign_id IS NOT NULL AND status IN ('active','paused','ended')";
  if (options?.platform) {
    params.push(options.platform);
    where += ` AND platform = $${params.length}`;
  }
  const result = await pool.query(
    `SELECT * FROM ads_campaigns WHERE ${where} ORDER BY updated_at DESC LIMIT 1000`,
    params,
  );
  return result.rows.map(rowToCampaign);
}

export async function sumManagementFeeForPeriod(
  pool: Pool,
  userId: string,
  period: string,
): Promise<{
  totalSpendNok: number;
  totalFeeNok: number;
  totalInclVatNok: number;
  /** Blended påslag actually applied (totalFee / totalSpend), or null if no spend. */
  effectiveFeeRate: number | null;
  perPlatform: Record<string, number>;
}> {
  const result = await pool.query<{
    platform: string;
    spend: string;
    fee: string;
    incl_vat: string;
  }>(
    `SELECT platform,
            COALESCE(SUM(spend_nok), 0)::text AS spend,
            COALESCE(SUM(management_fee_nok), 0)::text AS fee,
            COALESCE(SUM(total_incl_vat_nok), 0)::text AS incl_vat
       FROM ads_management_fee_usage
      WHERE user_id = $1 AND billing_period = $2
   GROUP BY platform`,
    [userId, period],
  );

  let totalSpend = 0;
  let totalFee = 0;
  let totalIncl = 0;
  const perPlatform: Record<string, number> = {};
  for (const row of result.rows) {
    const fee = Number(row.fee);
    totalSpend += Number(row.spend);
    totalFee += fee;
    totalIncl += Number(row.incl_vat);
    perPlatform[row.platform] = fee;
  }
  return {
    totalSpendNok: totalSpend,
    totalFeeNok: totalFee,
    totalInclVatNok: totalIncl,
    effectiveFeeRate: totalSpend > 0 ? totalFee / totalSpend : null,
    perPlatform,
  };
}

/**
 * Total actual ad spend (NOK, eks. påslag) for all campaigns in a project for a
 * billing period. This is what the §3 budget cap compares against (§3.2).
 */
export async function sumSpendForProjectPeriod(
  pool: Pool,
  projectId: string,
  period: string,
): Promise<number> {
  const result = await pool.query<{ spend: string }>(
    `SELECT COALESCE(SUM(f.spend_nok), 0)::text AS spend
       FROM ads_management_fee_usage f
       JOIN ads_campaigns c ON c.id = f.campaign_id
      WHERE c.project_id = $1 AND f.billing_period = $2`,
    [projectId, period],
  );
  return Number(result.rows[0]?.spend ?? 0);
}

// Re-export so consumers don't have to pull from two modules.
export { ADS_METER_EVENT_NAMES };
