// Pricing + usage-aggregering for fakturerbar WhatsApp i audition-reminders.
// Speiler casting-sms-billing.ts. Pris per melding stemples ved send.

import type { Pool } from "pg";

const DEFAULT_RETAIL_PRICE_NOK_EX_VAT = 0.8;
const DEFAULT_VAT_RATE = 0.25;
const DEFAULT_META_COST_NOK = 0.34;

export interface WhatsAppBillingPricing {
  retailPriceNokExVat: number;
  vatRate: number;
  retailPriceNokInclVat: number;
  costNok: number;
  marginNokExVat: number;
}

export function readWhatsAppBillingPricing(): WhatsAppBillingPricing {
  const retail = readPositiveNumber(
    process.env.CASTING_WHATSAPP_RETAIL_PRICE_NOK_EX_VAT,
    DEFAULT_RETAIL_PRICE_NOK_EX_VAT,
  );
  const vatRate = readPositiveNumber(
    process.env.CASTING_WHATSAPP_VAT_RATE,
    DEFAULT_VAT_RATE,
  );
  const cost = readPositiveNumber(
    process.env.CASTING_WHATSAPP_COST_NOK,
    DEFAULT_META_COST_NOK,
  );
  return {
    retailPriceNokExVat: retail,
    vatRate,
    retailPriceNokInclVat: round2(retail * (1 + vatRate)),
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

export interface RecordWhatsAppUsageInput {
  pool: Pool;
  projectId: string;
  scheduleId: string;
  candidateId: string;
  threshold: string;
  brand: string;
  templateName?: string | null;
  whatsappMessageId?: string | null;
  conversationId?: string | null;
  pricing?: WhatsAppBillingPricing;
  sentAt?: Date;
}

export async function recordWhatsAppUsage(
  input: RecordWhatsAppUsageInput,
): Promise<void> {
  const pricing = input.pricing ?? readWhatsAppBillingPricing();
  const totalExVat = round2(pricing.retailPriceNokExVat * 1);
  const totalInclVat = round2(totalExVat * (1 + pricing.vatRate));
  const sentAt = input.sentAt ?? new Date();

  try {
    await input.pool.query(
      `INSERT INTO casting_whatsapp_usage
         (project_id, schedule_id, candidate_id, sent_at, threshold, brand,
          template_name, whatsapp_message_id, conversation_id,
          unit_price_nok_ex_vat, vat_rate,
          total_nok_ex_vat, total_nok_incl_vat)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        input.projectId,
        input.scheduleId,
        input.candidateId,
        sentAt.toISOString(),
        input.threshold,
        input.brand,
        input.templateName ?? null,
        input.whatsappMessageId ?? null,
        input.conversationId ?? null,
        pricing.retailPriceNokExVat,
        pricing.vatRate,
        totalExVat,
        totalInclVat,
      ],
    );
  } catch (error) {
    console.warn("[casting-whatsapp-billing] failed to record usage", {
      projectId: input.projectId,
      scheduleId: input.scheduleId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface MonthlyWhatsAppUsage {
  billingPeriod: string;
  whatsappCount: number;
  totalNokExVat: number;
  totalNokInclVat: number;
  unitPriceNokExVat: number;
  unitPriceNokInclVat: number;
  vatRate: number;
}

export async function readMonthlyWhatsAppUsageForUserEmails(
  pool: Pool,
  emails: string[],
  period: string,
): Promise<MonthlyWhatsAppUsage> {
  const pricing = readWhatsAppBillingPricing();
  const empty: MonthlyWhatsAppUsage = {
    billingPeriod: period,
    whatsappCount: 0,
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

    const usage = await pool.query<{
      sms_count: string | number;
      total_ex_vat: string | number | null;
      total_incl_vat: string | number | null;
    }>(
      `SELECT
         COUNT(*)::bigint                  AS sms_count,
         COALESCE(SUM(total_nok_ex_vat),   0) AS total_ex_vat,
         COALESCE(SUM(total_nok_incl_vat), 0) AS total_incl_vat
       FROM casting_whatsapp_usage
       WHERE billing_period = $1
         AND project_id = ANY($2::text[])`,
      [period, ids],
    );
    const row = usage.rows[0];
    if (!row) return empty;
    return {
      billingPeriod: period,
      whatsappCount: Number(row.sms_count) || 0,
      totalNokExVat: Number(row.total_ex_vat) || 0,
      totalNokInclVat: Number(row.total_incl_vat) || 0,
      unitPriceNokExVat: pricing.retailPriceNokExVat,
      unitPriceNokInclVat: pricing.retailPriceNokInclVat,
      vatRate: pricing.vatRate,
    };
  } catch (error) {
    console.warn("[casting-whatsapp-billing] failed to aggregate usage", {
      error: error instanceof Error ? error.message : String(error),
    });
    return empty;
  }
}
