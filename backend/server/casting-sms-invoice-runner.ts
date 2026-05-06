// Stripe-faktura-sync for casting_sms_usage.
//
// Daglig sweep som plukker uavfakturerte SMS-rader fra avsluttede billing-
// perioder og legger dem på neste Stripe-faktura som invoice-line-items.
// Aggregert per (stripe_customer_id, billing_period) — én linje per måned
// per kunde, ikke én per SMS.
//
// Idempotens via casting_sms_usage.stripe_invoice_item_id: kun rader
// hvor denne er NULL plukkes opp. Etter vellykket Stripe-call merkes alle
// inkluderte rader med samme invoice_item_id.

import type { Pool } from "pg";
import type Stripe from "stripe";

import { currentBillingPeriod } from "./casting-sms-billing.js";
import {
  RR_BRAND_PREFIXES,
  RR_TAX_CODE,
  brandedProductName,
  validateCustomerAddress,
} from "./stripe-billing-utils.js";

const RUNNER_KEY = "casting-sms-invoice";

// Brand-konsistent line-item-navn (vises på Stripe-fakturaen).
// Casting SMS = telecom service per Stripe Tax classification.
const CASTING_SMS_PRODUCT_NAME = brandedProductName(
  RR_BRAND_PREFIXES.CASTING,
  "Audition SMS",
);

export interface SmsInvoiceSweepSummary {
  reason: "startup" | "interval" | "manual";
  startedAt: string;
  finishedAt: string;
  isRunning: boolean;
  groupsScanned: number;
  invoiceItemsCreated: number;
  rowsBilled: number;
  failures: number;
  skipped: number;
  notes: string[];
}

export interface UnbilledSmsGroup {
  projectId: string;
  billingPeriod: string;
  rowIds: string[];
  smsCount: number;
  totalNokExVat: number;
  totalNokInclVat: number;
  vatRate: number;
}

export type ProjectCustomerResolver = (
  projectId: string,
) => Promise<{ stripeCustomerId: string | null }>;

let sweepPromise: Promise<SmsInvoiceSweepSummary> | null = null;
let lastSummary: SmsInvoiceSweepSummary | null = null;
let schedulerStarted = false;

function isRunnerEnabled(): boolean {
  const value = (process.env.CASTING_SMS_INVOICE_RUNNER_ENABLED || "true")
    .trim()
    .toLowerCase();
  return value !== "false" && value !== "0" && value !== "off";
}

function readIntervalMs(): number {
  const hours = Number(process.env.CASTING_SMS_INVOICE_INTERVAL_HOURS || 24);
  if (!Number.isFinite(hours) || hours <= 0) return 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor(hours)) * 60 * 60 * 1000;
}

function buildSummary(reason: SmsInvoiceSweepSummary["reason"]): SmsInvoiceSweepSummary {
  const ts = new Date().toISOString();
  return {
    reason,
    startedAt: ts,
    finishedAt: ts,
    isRunning: true,
    groupsScanned: 0,
    invoiceItemsCreated: 0,
    rowsBilled: 0,
    failures: 0,
    skipped: 0,
    notes: [],
  };
}

export function readSmsInvoiceStatus(): SmsInvoiceSweepSummary | null {
  return lastSummary;
}

export async function listUnbilledSmsGroups(
  pool: Pool,
  periodCutoff: string,
): Promise<UnbilledSmsGroup[]> {
  const result = await pool.query<{
    project_id: string;
    billing_period: string;
    row_ids: string[];
    sms_count: string | number;
    total_ex_vat: string | number;
    total_incl_vat: string | number;
    vat_rate: string | number;
  }>(
    `SELECT
       project_id,
       billing_period,
       array_agg(id::text)              AS row_ids,
       COUNT(*)                         AS sms_count,
       SUM(total_nok_ex_vat)            AS total_ex_vat,
       SUM(total_nok_incl_vat)          AS total_incl_vat,
       MAX(vat_rate)                    AS vat_rate
     FROM casting_sms_usage
     WHERE stripe_invoice_item_id IS NULL
       AND billing_period < $1
     GROUP BY project_id, billing_period
     ORDER BY billing_period ASC, project_id ASC`,
    [periodCutoff],
  );

  return result.rows.map((row) => ({
    projectId: row.project_id,
    billingPeriod: row.billing_period,
    rowIds: row.row_ids,
    smsCount: Number(row.sms_count) || 0,
    totalNokExVat: Number(row.total_ex_vat) || 0,
    totalNokInclVat: Number(row.total_incl_vat) || 0,
    vatRate: Number(row.vat_rate) || 0.25,
  }));
}

export async function markGroupBilled(
  pool: Pool,
  rowIds: string[],
  invoiceItemId: string,
): Promise<void> {
  if (!rowIds.length) return;
  await pool.query(
    `UPDATE casting_sms_usage
       SET stripe_invoice_item_id = $1
     WHERE id = ANY($2::uuid[])
       AND stripe_invoice_item_id IS NULL`,
    [invoiceItemId, rowIds],
  );
}

interface RunnerDeps {
  pool: Pool;
  stripe: Stripe;
  resolveCustomer: ProjectCustomerResolver;
  now?: Date;
}

export async function runSmsInvoiceSweep(
  reason: SmsInvoiceSweepSummary["reason"],
  deps: RunnerDeps,
): Promise<SmsInvoiceSweepSummary> {
  if (sweepPromise) {
    return (
      lastSummary || {
        ...buildSummary(reason),
        notes: ["En SMS-faktura-sweep pågår allerede."],
      }
    );
  }

  const task = (async () => {
    const summary = buildSummary(reason);
    lastSummary = summary;

    try {
      const periodCutoff = currentBillingPeriod(deps.now ?? new Date());
      const groups = await listUnbilledSmsGroups(deps.pool, periodCutoff);
      summary.groupsScanned = groups.length;

      for (const group of groups) {
        try {
          const { stripeCustomerId } = await deps.resolveCustomer(group.projectId);
          if (!stripeCustomerId) {
            summary.skipped += 1;
            summary.notes.push(
              `skip project=${group.projectId} period=${group.billingPeriod} reason=no_customer`,
            );
            continue;
          }

          // Norge-MVA-compliance: Stripe Tax kan ikke regne ut 25% MVA uten
          // gyldig customer-adresse (country + postal_code). Hopp over
          // kunder som ikke har dette satt — bedre å la fakturaen vente til
          // adressen er fylt inn enn å sende ut en faktura uten MVA.
          const addrCheck = await validateCustomerAddress(
            deps.stripe,
            stripeCustomerId,
          );
          if (!addrCheck.ok) {
            summary.skipped += 1;
            summary.notes.push(
              `skip project=${group.projectId} period=${group.billingPeriod} reason=invalid_customer_address missing=${addrCheck.missing.join(",")}`,
            );
            console.warn(
              `[casting-sms-invoice] skipping customer ${stripeCustomerId} (project=${group.projectId} period=${group.billingPeriod}): missing address fields ${addrCheck.missing.join(", ")}`,
            );
            continue;
          }

          const amountOre = Math.round(group.totalNokExVat * 100);
          if (amountOre <= 0) {
            summary.skipped += 1;
            continue;
          }

          const description = `${CASTING_SMS_PRODUCT_NAME} ${group.billingPeriod} (${group.smsCount} stk)`;
          // tax_behavior='exclusive' + tax_code=TELECOM_SMS lar Stripe Tax
          // legge på 25% norsk MVA automatisk basert på customer-adressen.
          // Forutsetter at Stripe Tax er aktivert i dashboard og at
          // konto-default ELLER customer har automatic_tax på.
          const invoiceItem = await deps.stripe.invoiceItems.create({
            customer: stripeCustomerId,
            amount: amountOre,
            currency: "nok",
            description,
            tax_behavior: "exclusive",
            tax_code: RR_TAX_CODE.TELECOM_SMS,
            metadata: {
              runner: RUNNER_KEY,
              brand: RR_BRAND_PREFIXES.CASTING,
              product_name: CASTING_SMS_PRODUCT_NAME,
              billing_period: group.billingPeriod,
              project_id: group.projectId,
              sms_count: String(group.smsCount),
              vat_rate: String(group.vatRate),
              tax_code: RR_TAX_CODE.TELECOM_SMS,
            },
          });

          await markGroupBilled(deps.pool, group.rowIds, invoiceItem.id);
          summary.invoiceItemsCreated += 1;
          summary.rowsBilled += group.rowIds.length;
        } catch (error) {
          summary.failures += 1;
          summary.notes.push(
            `fail project=${group.projectId} period=${group.billingPeriod}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } catch (error) {
      summary.failures += 1;
      summary.notes.push(
        `sweep_error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      summary.isRunning = false;
      summary.finishedAt = new Date().toISOString();
      lastSummary = summary;
    }

    return summary;
  })();

  sweepPromise = task;
  try {
    return await task;
  } finally {
    sweepPromise = null;
  }
}

export function maybeStartSmsInvoiceSweep(deps: RunnerDeps): void {
  if (schedulerStarted) return;
  if (!isRunnerEnabled()) return;
  schedulerStarted = true;

  setTimeout(() => {
    void runSmsInvoiceSweep("startup", deps).catch((error) => {
      console.error("[casting-sms-invoice] startup sweep failed", error);
    });
  }, 60_000).unref();

  setInterval(() => {
    void runSmsInvoiceSweep("interval", deps).catch((error) => {
      console.error("[casting-sms-invoice] interval sweep failed", error);
    });
  }, readIntervalMs()).unref();
}
