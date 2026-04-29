// Pricing + usage-aggregering for fakturerbar SMS i audition-reminders.
//
// Konvensjon: ex-MVA er kanonisk lagring (matcher monthlyTotalExVat-mønsteret
// i Role Room billing). Inkl-MVA beregnes for visning. MVA-sats stemples
// per rad så historiske fakturaer er stabile.

import type { Pool } from "pg";

const DEFAULT_RETAIL_PRICE_NOK_EX_VAT = 2.0;
const DEFAULT_VAT_RATE = 0.25;
const DEFAULT_TWILIO_COST_NOK = 0.65;

export interface SmsBillingPricing {
  retailPriceNokExVat: number;
  vatRate: number;
  retailPriceNokInclVat: number;
  costNok: number;
  marginNokExVat: number;
}

export function readSmsBillingPricing(): SmsBillingPricing {
  const retail = readPositiveNumber(
    process.env.CASTING_SMS_RETAIL_PRICE_NOK_EX_VAT,
    DEFAULT_RETAIL_PRICE_NOK_EX_VAT,
  );
  const vatRate = readPositiveNumber(
    process.env.CASTING_SMS_VAT_RATE,
    DEFAULT_VAT_RATE,
  );
  const cost = readPositiveNumber(
    process.env.CASTING_SMS_COST_NOK,
    DEFAULT_TWILIO_COST_NOK,
  );
  const retailInclVat = round2(retail * (1 + vatRate));
  return {
    retailPriceNokExVat: retail,
    vatRate,
    retailPriceNokInclVat: retailInclVat,
    costNok: cost,
    marginNokExVat: round2(retail - cost),
  };
}

function readPositiveNumber(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null) return fallback;
  const parsed = Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function currentBillingPeriod(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export interface RecordSmsUsageInput {
  pool: Pool;
  projectId: string;
  scheduleId: string;
  candidateId: string;
  threshold: string;
  brand: string;
  twilioMessageSid?: string | null;
  pricing?: SmsBillingPricing;
  sentAt?: Date;
}

export async function recordSmsUsage(input: RecordSmsUsageInput): Promise<void> {
  const pricing = input.pricing ?? readSmsBillingPricing();
  const totalExVat = round2(pricing.retailPriceNokExVat * 1);
  const totalInclVat = round2(totalExVat * (1 + pricing.vatRate));
  const sentAt = input.sentAt ?? new Date();

  try {
    await input.pool.query(
      `INSERT INTO casting_sms_usage
         (project_id, schedule_id, candidate_id, sent_at, threshold, brand,
          twilio_message_sid, unit_price_nok_ex_vat, vat_rate,
          total_nok_ex_vat, total_nok_incl_vat)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        input.projectId,
        input.scheduleId,
        input.candidateId,
        sentAt.toISOString(),
        input.threshold,
        input.brand,
        input.twilioMessageSid ?? null,
        pricing.retailPriceNokExVat,
        pricing.vatRate,
        totalExVat,
        totalInclVat,
      ],
    );
  } catch (error) {
    console.warn("[casting-sms-billing] failed to record usage", {
      projectId: input.projectId,
      scheduleId: input.scheduleId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface MonthlySmsUsage {
  billingPeriod: string;
  smsCount: number;
  totalNokExVat: number;
  totalNokInclVat: number;
  unitPriceNokExVat: number;
  unitPriceNokInclVat: number;
  vatRate: number;
}

export async function readMonthlySmsUsageForUserEmails(
  pool: Pool,
  emails: string[],
  period: string = currentBillingPeriod(),
): Promise<MonthlySmsUsage> {
  const pricing = readSmsBillingPricing();
  const empty: MonthlySmsUsage = {
    billingPeriod: period,
    smsCount: 0,
    totalNokExVat: 0,
    totalNokInclVat: 0,
    unitPriceNokExVat: pricing.retailPriceNokExVat,
    unitPriceNokInclVat: pricing.retailPriceNokInclVat,
    vatRate: pricing.vatRate,
  };

  const normalized = emails
    .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
    .filter((e) => e.length > 0);
  if (!normalized.length) return empty;

  try {
    const projectsResult = await pool.query<{ id: string }>(
      `SELECT cp.id
         FROM casting_projects cp
         LEFT JOIN users u ON u.id::text = cp.created_by
        WHERE LOWER(COALESCE(u.email, '')) = ANY($1::text[])
           OR LOWER(COALESCE(cp.created_by, '')) = ANY($1::text[])`,
      [normalized],
    );
    const ids = projectsResult.rows.map((r) => r.id);
    if (!ids.length) return empty;
    return readMonthlySmsUsageForProjects(pool, ids, period);
  } catch (error) {
    console.warn("[casting-sms-billing] failed to resolve projects for emails", {
      error: error instanceof Error ? error.message : String(error),
    });
    return empty;
  }
}

export async function readMonthlySmsUsageForProjects(
  pool: Pool,
  projectIds: string[],
  period: string = currentBillingPeriod(),
): Promise<MonthlySmsUsage> {
  const pricing = readSmsBillingPricing();
  const empty: MonthlySmsUsage = {
    billingPeriod: period,
    smsCount: 0,
    totalNokExVat: 0,
    totalNokInclVat: 0,
    unitPriceNokExVat: pricing.retailPriceNokExVat,
    unitPriceNokInclVat: pricing.retailPriceNokInclVat,
    vatRate: pricing.vatRate,
  };

  if (!projectIds.length) return empty;

  try {
    const result = await pool.query<{
      sms_count: string | number;
      total_ex_vat: string | number | null;
      total_incl_vat: string | number | null;
    }>(
      `SELECT
         COUNT(*)::bigint                  AS sms_count,
         COALESCE(SUM(total_nok_ex_vat),   0) AS total_ex_vat,
         COALESCE(SUM(total_nok_incl_vat), 0) AS total_incl_vat
       FROM casting_sms_usage
       WHERE billing_period = $1
         AND project_id = ANY($2::text[])`,
      [period, projectIds],
    );

    const row = result.rows[0];
    if (!row) return empty;

    return {
      billingPeriod: period,
      smsCount: Number(row.sms_count) || 0,
      totalNokExVat: Number(row.total_ex_vat) || 0,
      totalNokInclVat: Number(row.total_incl_vat) || 0,
      unitPriceNokExVat: pricing.retailPriceNokExVat,
      unitPriceNokInclVat: pricing.retailPriceNokInclVat,
      vatRate: pricing.vatRate,
    };
  } catch (error) {
    console.warn("[casting-sms-billing] failed to aggregate usage", {
      projectCount: projectIds.length,
      period,
      error: error instanceof Error ? error.message : String(error),
    });
    return empty;
  }
}
