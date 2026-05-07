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
        daily_budget_nok, total_budget_nok,
        audience_config, creative_config, starts_at, ends_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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
  recordedAt?: Date;
  stripeMeterEventId?: string | null;
}

export async function recordManagementFee(
  pool: Pool,
  input: RecordManagementFeeInput,
): Promise<{ id: string; managementFeeNok: number; totalInclVatNok: number; period: string }> {
  const fee = computeManagementFee(input.spendNok);
  const period = billingPeriodForDate(input.recordedAt ?? new Date());

  const result = await pool.query(
    `INSERT INTO ads_management_fee_usage
       (user_id, campaign_id, platform, billing_period, spend_nok,
        management_fee_nok, vat_rate, total_incl_vat_nok, stripe_meter_event_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      input.userId,
      input.campaignId,
      input.platform,
      period,
      input.spendNok,
      fee.managementFeeNok,
      0.25,
      fee.totalInclVatNok,
      input.stripeMeterEventId ?? null,
    ],
  );

  return {
    id: result.rows[0].id as string,
    managementFeeNok: fee.managementFeeNok,
    totalInclVatNok: fee.totalInclVatNok,
    period,
  };
}

export async function sumManagementFeeForPeriod(
  pool: Pool,
  userId: string,
  period: string,
): Promise<{
  totalSpendNok: number;
  totalFeeNok: number;
  totalInclVatNok: number;
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
    perPlatform,
  };
}

// Re-export so consumers don't have to pull from two modules.
export { ADS_METER_EVENT_NAMES };
