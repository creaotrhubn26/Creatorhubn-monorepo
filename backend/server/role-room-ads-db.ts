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
  type ChannelResultInput,
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
// ── Lag 2: AI-anbefalinger (persisteres per prosjekt + periode) ─────────

export interface PersistedAdRecommendations {
  projectId: string;
  period: string;
  generatedAt: Date;
  generatedWithModel: string | null;
  recommendations: unknown;
}

export async function upsertAdRecommendations(
  pool: Pool,
  input: {
    projectId: string;
    period: string;
    generatedWithModel: string | null;
    recommendations: unknown;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO role_room_ads_recommendations
       (project_id, period, generated_at, generated_with_model, recommendations)
     VALUES ($1, $2, now(), $3, $4::jsonb)
     ON CONFLICT (project_id, period) DO UPDATE SET
       generated_at = EXCLUDED.generated_at,
       generated_with_model = EXCLUDED.generated_with_model,
       recommendations = EXCLUDED.recommendations`,
    [input.projectId, input.period, input.generatedWithModel, JSON.stringify(input.recommendations)],
  );
}

export async function fetchAdRecommendations(
  pool: Pool,
  projectId: string,
  period: string,
): Promise<PersistedAdRecommendations | null> {
  const r = await pool.query(
    `SELECT project_id, period, generated_at, generated_with_model, recommendations
       FROM role_room_ads_recommendations
      WHERE project_id = $1 AND period = $2
      LIMIT 1`,
    [projectId, period],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    projectId: row.project_id,
    period: row.period,
    generatedAt: row.generated_at as Date,
    generatedWithModel: (row.generated_with_model as string | null) ?? null,
    recommendations: row.recommendations,
  };
}

/** Distinct project-IDer som har annonsekampanjer registrert — uavhengig av
 *  periode. Brukt av Lag 2-cron til å vite hvilke prosjekter som skal få
 *  anbefalinger. For MedInnova-skala (få prosjekter) er dette en helt rimelig
 *  iterasjon. */
export async function listProjectsWithAdActivity(pool: Pool): Promise<string[]> {
  const r = await pool.query(
    `SELECT DISTINCT project_id FROM ads_campaigns WHERE project_id IS NOT NULL`,
  );
  return r.rows.map((row) => String(row.project_id));
}

/**
 * Active campaigns for one project — used by auto-pause to find what to stop
 * when the period hits the cap. Returns rows with an external_campaign_id so
 * the dispatcher can address the platform.
 */
export async function listActiveCampaignsForProject(
  pool: Pool,
  projectId: string,
): Promise<AdsCampaignRow[]> {
  const result = await pool.query(
    `SELECT * FROM ads_campaigns
       WHERE project_id = $1
         AND status = 'active'
         AND external_campaign_id IS NOT NULL
       ORDER BY updated_at DESC`,
    [projectId],
  );
  return result.rows.map(rowToCampaign);
}

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

/**
 * Per-campaign performance rows for a project + period — gir klient-
 * synlighet på enkelt-kampanje-nivå (ikke bare aggregert per kanal).
 * Returnerer én rad per kampanje med campaign-meta + samme metrikker
 * som channel-views (spend/impressions/clicks/conversions/value).
 *
 * Brukes av ClientAdsPerformancePanel for å vise per-kampanje read-only
 * resultater i klient-økonomi-visningen.
 */
export interface CampaignResultRow {
  campaignId: string;
  campaignName: string;
  platform: string;
  status: string;
  dailyBudgetNok: number | null;
  spendNok: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValueNok: number;
}

export async function getCampaignResultRows(
  pool: Pool,
  projectId: string,
  period: string,
): Promise<CampaignResultRow[]> {
  const result = await pool.query<{
    campaign_id: string;
    campaign_name: string;
    platform: string;
    status: string;
    daily_budget_nok: string | null;
    spend: string;
    impressions: string;
    clicks: string;
    conversions: string;
    conversion_value: string;
  }>(
    // ads_campaigns har ikke et 'name'-felt — vi henter kampanje-navn fra
    // creative_config.campaignName (JSONB) hvis satt, ellers fallback til
    // external_campaign_id, og til slutt til en kort id-string. Aldri NULL.
    `SELECT c.id AS campaign_id,
            COALESCE(
              c.creative_config->>'campaignName',
              c.creative_config->>'name',
              c.external_campaign_id,
              'Kampanje ' || LEFT(c.id::text, 8)
            ) AS campaign_name,
            c.platform AS platform,
            c.status AS status,
            c.daily_budget_nok::text AS daily_budget_nok,
            COALESCE(SUM(d.spend_nok), 0)::text AS spend,
            COALESCE(SUM(d.impressions), 0)::text AS impressions,
            COALESCE(SUM(d.clicks), 0)::text AS clicks,
            COALESCE(SUM(d.conversions), 0)::text AS conversions,
            COALESCE(SUM(d.conversion_value_nok), 0)::text AS conversion_value
       FROM ads_campaigns c
       LEFT JOIN ads_attribution_daily d ON d.campaign_id = c.id
            AND to_char(d.date, 'YYYY-MM') = $2
      WHERE c.project_id = $1
   GROUP BY c.id, c.creative_config, c.external_campaign_id, c.platform, c.status, c.daily_budget_nok
   ORDER BY COALESCE(SUM(d.spend_nok), 0) DESC, campaign_name ASC`,
    [projectId, period],
  );
  return result.rows.map((r) => ({
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    platform: r.platform,
    status: r.status,
    dailyBudgetNok: r.daily_budget_nok != null ? Number(r.daily_budget_nok) : null,
    spendNok: Number(r.spend),
    impressions: Number(r.impressions),
    clicks: Number(r.clicks),
    conversions: Number(r.conversions),
    conversionValueNok: Number(r.conversion_value),
  }));
}

/**
 * Per-channel performance rows for a project + period (YYYY-MM), aggregated from
 * ads_attribution_daily. Feeds buildChannelResults() for the client results view.
 */
export async function getChannelResultRows(
  pool: Pool,
  projectId: string,
  period: string,
): Promise<ChannelResultInput[]> {
  const result = await pool.query<{
    platform: string;
    spend: string;
    impressions: string;
    clicks: string;
    conversions: string;
    conversion_value: string;
  }>(
    `SELECT c.platform AS platform,
            COALESCE(SUM(d.spend_nok), 0)::text AS spend,
            COALESCE(SUM(d.impressions), 0)::text AS impressions,
            COALESCE(SUM(d.clicks), 0)::text AS clicks,
            COALESCE(SUM(d.conversions), 0)::text AS conversions,
            COALESCE(SUM(d.conversion_value_nok), 0)::text AS conversion_value
       FROM ads_attribution_daily d
       JOIN ads_campaigns c ON c.id = d.campaign_id
      WHERE c.project_id = $1 AND to_char(d.date, 'YYYY-MM') = $2
   GROUP BY c.platform`,
    [projectId, period],
  );
  return result.rows.map((r) => ({
    platform: r.platform,
    spendNok: Number(r.spend),
    impressions: Number(r.impressions),
    clicks: Number(r.clicks),
    conversions: Number(r.conversions),
    conversionValueNok: Number(r.conversion_value),
  }));
}

// Re-export so consumers don't have to pull from two modules.
export { ADS_METER_EVENT_NAMES };
