// Stripe-faktura-sync for casting_whatsapp_usage.
//
// Speiler casting-sms-invoice-runner.ts. Daglig sweep aggregerer
// uavfakturerte WhatsApp-rader fra avsluttede billing-perioder per
// (stripe_customer, billing_period) og legger dem som invoice line-items
// på neste Stripe-faktura.
//
// MERK: Multi-tenant WhatsApp (BYO Meta) — kunden betaler Meta direkte
// for conversations. Vi fakturerer kun for hosted_by_creatorhub-modus
// der vi er BSP. I v1 (alle byo_meta) sweepen finner ingen rader fordi
// recordWhatsAppUsage kalles fra runneren uavhengig av provider — det er
// teknisk-debt for tjeneste-fee-tracking. Kommer en provider-filter når
// BSP er live.

import type { Pool } from "pg";
import type Stripe from "stripe";

import { currentBillingPeriod } from "./casting-sms-billing.js";
import type { ProjectCustomerResolver } from "./casting-sms-invoice-runner.js";

const RUNNER_KEY = "casting-whatsapp-invoice";

export interface WhatsAppInvoiceSweepSummary {
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

interface UnbilledWhatsAppGroup {
  projectId: string;
  billingPeriod: string;
  rowIds: string[];
  whatsappCount: number;
  totalNokExVat: number;
  totalNokInclVat: number;
  vatRate: number;
}

let sweepPromise: Promise<WhatsAppInvoiceSweepSummary> | null = null;
let lastSummary: WhatsAppInvoiceSweepSummary | null = null;
let schedulerStarted = false;

function isRunnerEnabled(): boolean {
  const value = (process.env.CASTING_WHATSAPP_INVOICE_RUNNER_ENABLED || "true")
    .trim()
    .toLowerCase();
  return value !== "false" && value !== "0" && value !== "off";
}

function readIntervalMs(): number {
  const hours = Number(
    process.env.CASTING_WHATSAPP_INVOICE_INTERVAL_HOURS || 24,
  );
  if (!Number.isFinite(hours) || hours <= 0) return 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor(hours)) * 60 * 60 * 1000;
}

function buildSummary(reason: WhatsAppInvoiceSweepSummary["reason"]): WhatsAppInvoiceSweepSummary {
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

export function readWhatsAppInvoiceStatus(): WhatsAppInvoiceSweepSummary | null {
  return lastSummary;
}

async function listUnbilledWhatsAppGroups(
  pool: Pool,
  periodCutoff: string,
): Promise<UnbilledWhatsAppGroup[]> {
  const result = await pool.query<{
    project_id: string;
    billing_period: string;
    row_ids: string[];
    whatsapp_count: string | number;
    total_ex_vat: string | number;
    total_incl_vat: string | number;
    vat_rate: string | number;
  }>(
    `SELECT
       project_id,
       billing_period,
       array_agg(id::text)              AS row_ids,
       COUNT(*)                         AS whatsapp_count,
       SUM(total_nok_ex_vat)            AS total_ex_vat,
       SUM(total_nok_incl_vat)          AS total_incl_vat,
       MAX(vat_rate)                    AS vat_rate
     FROM casting_whatsapp_usage
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
    whatsappCount: Number(row.whatsapp_count) || 0,
    totalNokExVat: Number(row.total_ex_vat) || 0,
    totalNokInclVat: Number(row.total_incl_vat) || 0,
    vatRate: Number(row.vat_rate) || 0.25,
  }));
}

async function markGroupBilled(
  pool: Pool,
  rowIds: string[],
  invoiceItemId: string,
): Promise<void> {
  if (!rowIds.length) return;
  await pool.query(
    `UPDATE casting_whatsapp_usage
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

export async function runWhatsAppInvoiceSweep(
  reason: WhatsAppInvoiceSweepSummary["reason"],
  deps: RunnerDeps,
): Promise<WhatsAppInvoiceSweepSummary> {
  if (sweepPromise) {
    return (
      lastSummary || {
        ...buildSummary(reason),
        notes: ["En WhatsApp-faktura-sweep pågår allerede."],
      }
    );
  }

  const task = (async () => {
    const summary = buildSummary(reason);
    lastSummary = summary;

    try {
      const periodCutoff = currentBillingPeriod(deps.now ?? new Date());
      const groups = await listUnbilledWhatsAppGroups(deps.pool, periodCutoff);
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

          const amountOre = Math.round(group.totalNokExVat * 100);
          if (amountOre <= 0) {
            summary.skipped += 1;
            continue;
          }

          const description = `Audition-WhatsApp ${group.billingPeriod} (${group.whatsappCount} stk)`;
          const invoiceItem = await deps.stripe.invoiceItems.create({
            customer: stripeCustomerId,
            amount: amountOre,
            currency: "nok",
            description,
            metadata: {
              runner: RUNNER_KEY,
              billing_period: group.billingPeriod,
              project_id: group.projectId,
              whatsapp_count: String(group.whatsappCount),
              vat_rate: String(group.vatRate),
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

export function maybeStartWhatsAppInvoiceSweep(deps: RunnerDeps): void {
  if (schedulerStarted) return;
  if (!isRunnerEnabled()) return;
  schedulerStarted = true;

  setTimeout(() => {
    void runWhatsAppInvoiceSweep("startup", deps).catch((error) => {
      console.error("[casting-whatsapp-invoice] startup sweep failed", error);
    });
  }, 90_000).unref();

  setInterval(() => {
    void runWhatsAppInvoiceSweep("interval", deps).catch((error) => {
      console.error("[casting-whatsapp-invoice] interval sweep failed", error);
    });
  }, readIntervalMs()).unref();
}
