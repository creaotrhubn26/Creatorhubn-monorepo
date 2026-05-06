// Stripe-faktura-sync for Pressroom (composer_usage).
//
// Månedlig sweep som plukker uavfakturerte composer_usage-rader fra forrige
// måned og legger overage-delen på neste Stripe-faktura via metered prices.
// Aggregert per (user_id, event_type, billing_period) — én invoice-item per
// event-type per måned per kunde, ikke én per render/Claude-call.
//
// Forskjell fra casting-sms-invoice-runner:
//   * Composer har en *abonnement-modell* (composer_subscription) med
//     inkluderte kvoter (Claude-calls, renders, R2 GB, brands).
//     Bare overage utover inkludert kvote faktureres.
//   * Stripe price-id per event-type er konfigurert via env-vars
//     (STRIPE_COMPOSER_OVERAGE_*_PRICE_ID), ikke en flat NOK-amount.
//   * Vi bruker invoiceItems.create({ price, quantity }) i stedet for
//     amount+currency, slik at Stripe regner ut beløpet fra metered price.
//
// Idempotens via composer_usage.stripe_invoice_item_id: kun rader hvor
// denne er NULL plukkes opp. Etter vellykket Stripe-call merkes alle
// inkluderte rader (også de under inkludert-kvote, så de ikke
// re-prosesseres) med samme invoice-item-id ("billed: " + id) eller en
// dedikert "covered_by_subscription"-markering.

import type { Pool } from "pg";
import Stripe from "stripe";

const RUNNER_KEY = "composer-invoice";

export type ComposerEventType =
  | "claude_campaign"
  | "render_poster"
  | "render_menu_pdf"
  | "r2_storage";

export interface ComposerInvoiceSweepSummary {
  reason: "startup" | "interval" | "manual";
  startedAt: string;
  finishedAt: string;
  isRunning: boolean;
  usersProcessed: number;
  invoiceItemsCreated: number;
  totalRowsBilled: number;
  totalAmountNokExVat: number;
  failures: number;
  skipped: number;
  errors: string[];
  notes: string[];
}

interface UnbilledComposerRow {
  user_id: string;
  event_type: ComposerEventType;
  billing_period: string;
  row_ids: string[];
  consumed_quantity: number;
  total_nok_ex_vat: number;
  total_nok_incl_vat: number;
  vat_rate: number;
}

interface ComposerSubscriptionRow {
  user_id: string;
  tier: string | null;
  included_claude_calls: number;
  included_renders: number;
  included_r2_gb: number;
  included_brands: number;
  stripe_customer_id: string | null;
  status: string | null;
}

interface RunnerOpts {
  stripeApiKey?: string;
  dryRun?: boolean;
  /** YYYY-MM. Default = previous calendar month (UTC). */
  billingPeriod?: string;
  now?: Date;
}

let sweepPromise: Promise<ComposerInvoiceSweepSummary> | null = null;
let lastSummary: ComposerInvoiceSweepSummary | null = null;
let schedulerStarted = false;

function isRunnerEnabled(): boolean {
  const value = (process.env.COMPOSER_INVOICE_RUNNER_ENABLED || "true")
    .trim()
    .toLowerCase();
  return value !== "false" && value !== "0" && value !== "off";
}

function readIntervalMs(): number {
  const hours = Number(process.env.COMPOSER_INVOICE_INTERVAL_HOURS || 24);
  if (!Number.isFinite(hours) || hours <= 0) return 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor(hours)) * 60 * 60 * 1000;
}

function buildSummary(
  reason: ComposerInvoiceSweepSummary["reason"],
): ComposerInvoiceSweepSummary {
  const ts = new Date().toISOString();
  return {
    reason,
    startedAt: ts,
    finishedAt: ts,
    isRunning: true,
    usersProcessed: 0,
    invoiceItemsCreated: 0,
    totalRowsBilled: 0,
    totalAmountNokExVat: 0,
    failures: 0,
    skipped: 0,
    errors: [],
    notes: [],
  };
}

export function readComposerInvoiceStatus(): ComposerInvoiceSweepSummary | null {
  return lastSummary;
}

/**
 * Compute previous calendar month (UTC) as YYYY-MM. Invoice-runner kjører
 * 1. i måneden for foregående måneds bruk, så vi billing-stamper alltid
 * "forrige måned". Dato 2026-05-04 → "2026-04".
 */
export function previousBillingPeriod(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Description i norsk på Stripe-fakturaen for hver event-type.
 */
function describeOverage(
  eventType: ComposerEventType,
  period: string,
  overageQty: number,
): string {
  switch (eventType) {
    case "claude_campaign":
      return `Pressroom — ekstra Claude-kampanjer ${period} (${overageQty} stk)`;
    case "render_poster":
      return `Pressroom — ekstra plakat-render ${period} (${overageQty} stk)`;
    case "render_menu_pdf":
      return `Pressroom — ekstra meny-PDF ${period} (${overageQty} stk)`;
    case "r2_storage":
      return `Pressroom — ekstra R2-lagring ${period} (${overageQty} GB)`;
    default:
      return `Pressroom — ekstra bruk ${period} (${overageQty})`;
  }
}

/**
 * Map event-type → env-var-navn for Stripe price-id (metered).
 */
function envKeyForEvent(eventType: ComposerEventType): string {
  switch (eventType) {
    case "claude_campaign":
      return "STRIPE_COMPOSER_OVERAGE_CLAUDE_PRICE_ID";
    case "render_poster":
      return "STRIPE_COMPOSER_OVERAGE_RENDER_PRICE_ID";
    case "render_menu_pdf":
      return "STRIPE_COMPOSER_OVERAGE_RENDER_PRICE_ID";
    case "r2_storage":
      return "STRIPE_COMPOSER_OVERAGE_R2_GB_PRICE_ID";
  }
}

/**
 * Map event-type → quota-felt på composer_subscription.
 */
function includedForEvent(
  sub: ComposerSubscriptionRow,
  eventType: ComposerEventType,
): number {
  switch (eventType) {
    case "claude_campaign":
      return Number(sub.included_claude_calls) || 0;
    case "render_poster":
    case "render_menu_pdf":
      // Renders deler én felles kvote.
      return Number(sub.included_renders) || 0;
    case "r2_storage":
      return Number(sub.included_r2_gb) || 0;
  }
}

/**
 * SELECT alle uavfakturerte composer_usage-rader for gitt billing_period
 * (eller hele bakloggen hvis periode ikke er satt). Aggregert per
 * (user_id, event_type, billing_period).
 */
export async function listUnbilledComposerRows(
  pool: Pool,
  billingPeriod: string | null,
): Promise<UnbilledComposerRow[]> {
  const params: unknown[] = [];
  let whereClause = "stripe_invoice_item_id IS NULL";
  if (billingPeriod) {
    params.push(billingPeriod);
    whereClause += ` AND billing_period = $${params.length}`;
  }

  const result = await pool.query<{
    user_id: string;
    event_type: ComposerEventType;
    billing_period: string;
    row_ids: string[];
    consumed_quantity: string | number;
    total_ex_vat: string | number;
    total_incl_vat: string | number;
    vat_rate: string | number;
  }>(
    `SELECT
       user_id,
       event_type,
       billing_period,
       array_agg(id::text)              AS row_ids,
       SUM(quantity)                    AS consumed_quantity,
       SUM(total_nok_ex_vat)            AS total_ex_vat,
       SUM(total_nok_incl_vat)          AS total_incl_vat,
       MAX(vat_rate)                    AS vat_rate
     FROM composer_usage
     WHERE ${whereClause}
     GROUP BY user_id, event_type, billing_period
     ORDER BY billing_period ASC, user_id ASC, event_type ASC`,
    params,
  );

  return result.rows.map((row) => ({
    user_id: row.user_id,
    event_type: row.event_type,
    billing_period: row.billing_period,
    row_ids: row.row_ids,
    consumed_quantity: Number(row.consumed_quantity) || 0,
    total_nok_ex_vat: Number(row.total_ex_vat) || 0,
    total_nok_incl_vat: Number(row.total_incl_vat) || 0,
    vat_rate: Number(row.vat_rate) || 0.25,
  }));
}

async function loadSubscriptions(
  pool: Pool,
  userIds: string[],
): Promise<Map<string, ComposerSubscriptionRow>> {
  const map = new Map<string, ComposerSubscriptionRow>();
  if (!userIds.length) return map;
  const result = await pool.query<{
    user_id: string;
    tier: string | null;
    included_claude_calls: string | number;
    included_renders: string | number;
    included_r2_gb: string | number;
    included_brands: string | number;
    stripe_customer_id: string | null;
    status: string | null;
  }>(
    `SELECT user_id, tier, included_claude_calls, included_renders,
            included_r2_gb, included_brands, stripe_customer_id, status
       FROM composer_subscription
      WHERE user_id = ANY($1::text[])`,
    [userIds],
  );
  for (const row of result.rows) {
    map.set(row.user_id, {
      user_id: row.user_id,
      tier: row.tier,
      included_claude_calls: Number(row.included_claude_calls) || 0,
      included_renders: Number(row.included_renders) || 0,
      included_r2_gb: Number(row.included_r2_gb) || 0,
      included_brands: Number(row.included_brands) || 0,
      stripe_customer_id: row.stripe_customer_id,
      status: row.status,
    });
  }
  return map;
}

export async function markComposerRowsBilled(
  pool: Pool,
  rowIds: string[],
  invoiceItemId: string,
): Promise<void> {
  if (!rowIds.length) return;
  await pool.query(
    `UPDATE composer_usage
       SET stripe_invoice_item_id = $1
     WHERE id = ANY($2::uuid[])
       AND stripe_invoice_item_id IS NULL`,
    [invoiceItemId, rowIds],
  );
}

/**
 * Public entry-point. Beregner forrige måneds billing_period, plukker alle
 * uavfakturerte composer_usage-rader, grupperer per user × event-type,
 * trekker fra inkluderte kvoter og fakturerer overage som metered Stripe
 * invoice-items.
 *
 * dryRun: ingen Stripe-calls + ingen UPDATE — kun logging.
 */
export async function runComposerMonthlyInvoiceSweep(
  pool: Pool,
  opts: RunnerOpts = {},
): Promise<ComposerInvoiceSweepSummary> {
  const reason: ComposerInvoiceSweepSummary["reason"] = "manual";
  if (sweepPromise) {
    return (
      lastSummary || {
        ...buildSummary(reason),
        notes: ["En composer-faktura-sweep pågår allerede."],
      }
    );
  }

  const task = (async () => {
    const summary = buildSummary(reason);
    lastSummary = summary;
    const dryRun = !!opts.dryRun;

    let stripe: Stripe | null = null;
    if (!dryRun) {
      const apiKey = opts.stripeApiKey || process.env.STRIPE_SECRET_KEY || "";
      if (!apiKey) {
        summary.failures += 1;
        summary.errors.push(
          "STRIPE_SECRET_KEY mangler — kan ikke kjøre live Stripe-sync. Bruk dryRun=true for tørr-kjøring.",
        );
        summary.isRunning = false;
        summary.finishedAt = new Date().toISOString();
        return summary;
      }
      stripe = new Stripe(apiKey);
    }

    try {
      const period = opts.billingPeriod ?? previousBillingPeriod(opts.now);
      const groups = await listUnbilledComposerRows(pool, period);
      const userIds = Array.from(new Set(groups.map((g) => g.user_id)));
      const subscriptions = await loadSubscriptions(pool, userIds);
      const usersTouched = new Set<string>();

      // Først: trekk fra inkluderte kvoter PER user × event-type (renders
      // deler én felles kvota, så claude_campaign+r2_storage er separate
      // mens render_poster + render_menu_pdf trekker fra samme bucket).
      // Vi løser dette ved å pre-aggregere "renders consumed" per user.
      const rendersConsumedByUser = new Map<string, number>();
      for (const g of groups) {
        if (g.event_type === "render_poster" || g.event_type === "render_menu_pdf") {
          rendersConsumedByUser.set(
            g.user_id,
            (rendersConsumedByUser.get(g.user_id) || 0) + g.consumed_quantity,
          );
        }
      }

      for (const group of groups) {
        try {
          const sub = subscriptions.get(group.user_id);
          if (!sub) {
            summary.skipped += 1;
            summary.notes.push(
              `skip user=${group.user_id} type=${group.event_type} period=${group.billing_period} reason=no_subscription`,
            );
            continue;
          }
          if (!sub.stripe_customer_id) {
            summary.skipped += 1;
            summary.notes.push(
              `skip user=${group.user_id} type=${group.event_type} period=${group.billing_period} reason=no_stripe_customer`,
            );
            continue;
          }

          // Compute overage. For renders: include the *combined* poster +
          // menu count vs the shared quota, then allocate overage in the
          // same proportion as each event-type's individual contribution.
          let overageQty = 0;
          if (
            group.event_type === "render_poster" ||
            group.event_type === "render_menu_pdf"
          ) {
            const totalRenders = rendersConsumedByUser.get(group.user_id) || 0;
            const includedRenders = includedForEvent(sub, group.event_type);
            const totalOverage = Math.max(0, totalRenders - includedRenders);
            // Allocate this group's share of the overage proportionally.
            // (If totalRenders === 0 this branch is unreachable.)
            overageQty =
              totalRenders > 0
                ? Math.round((group.consumed_quantity / totalRenders) * totalOverage)
                : 0;
          } else {
            const included = includedForEvent(sub, group.event_type);
            overageQty = Math.max(0, group.consumed_quantity - included);
          }

          usersTouched.add(group.user_id);

          if (overageQty <= 0) {
            // Innenfor inkludert kvote — marker rader som "covered" så de
            // ikke re-prosesseres på neste sweep.
            const marker = `covered_${group.event_type}_${group.billing_period}`;
            summary.notes.push(
              `covered user=${group.user_id} type=${group.event_type} period=${group.billing_period} consumed=${group.consumed_quantity} included=${includedForEvent(sub, group.event_type)}`,
            );
            if (!dryRun) {
              await markComposerRowsBilled(pool, group.row_ids, marker);
            }
            summary.totalRowsBilled += group.row_ids.length;
            continue;
          }

          const priceEnvKey = envKeyForEvent(group.event_type);
          const priceId = (process.env[priceEnvKey] || "").trim();
          if (!priceId) {
            summary.failures += 1;
            summary.errors.push(
              `no_price_id user=${group.user_id} type=${group.event_type}: env ${priceEnvKey} mangler`,
            );
            continue;
          }

          const description = describeOverage(
            group.event_type,
            group.billing_period,
            overageQty,
          );

          if (dryRun) {
            summary.notes.push(
              `dry_run user=${group.user_id} type=${group.event_type} period=${group.billing_period} overage=${overageQty} price=${priceId} desc="${description}"`,
            );
            summary.invoiceItemsCreated += 1;
            summary.totalRowsBilled += group.row_ids.length;
            summary.totalAmountNokExVat += group.total_nok_ex_vat;
            continue;
          }

          if (!stripe) {
            summary.failures += 1;
            summary.errors.push(
              `internal: stripe_client_missing user=${group.user_id} type=${group.event_type}`,
            );
            continue;
          }

          const invoiceItem = await stripe.invoiceItems.create({
            customer: sub.stripe_customer_id,
            pricing: { price: priceId },
            quantity: overageQty,
            description,
            currency: "nok",
            metadata: {
              runner: RUNNER_KEY,
              billing_period: group.billing_period,
              user_id: group.user_id,
              event_type: group.event_type,
              consumed_quantity: String(group.consumed_quantity),
              included_quantity: String(includedForEvent(sub, group.event_type)),
              overage_quantity: String(overageQty),
              tier: sub.tier ?? "",
              vat_rate: String(group.vat_rate),
            },
          });

          await markComposerRowsBilled(pool, group.row_ids, invoiceItem.id);
          summary.invoiceItemsCreated += 1;
          summary.totalRowsBilled += group.row_ids.length;
          summary.totalAmountNokExVat += group.total_nok_ex_vat;
        } catch (error) {
          summary.failures += 1;
          summary.errors.push(
            `fail user=${group.user_id} type=${group.event_type} period=${group.billing_period}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      summary.usersProcessed = usersTouched.size;
    } catch (error) {
      summary.failures += 1;
      summary.errors.push(
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

/**
 * Cron-bootstrap. Kjører første sweep ~120s etter boot for å plukke opp
 * eventuell etterslep, og deretter hver 24t. Den faktiske månedlige
 * fakturerings-grensen håndteres av previousBillingPeriod() — sweepen er
 * idempotent så det er trygt å kjøre den daglig.
 *
 * Spec sier "03:00 CEST på 1. i måneden". Vi modellerer dette som et
 * daglig sweep + en explicit gate på "kun kjør hvis dagens dato er den
 * 1." når COMPOSER_INVOICE_STRICT_FIRST_OF_MONTH=true. Default er daglig
 * sweep — det matcher SMS-runneren og er sikrere fordi en mistet 1.-tikk
 * (deploy, restart) automatisk plukker opp dagen etter.
 */
export function maybeStartComposerInvoiceSweep(pool: Pool): void {
  if (schedulerStarted) return;
  if (!isRunnerEnabled()) return;
  schedulerStarted = true;

  setTimeout(() => {
    void runComposerMonthlyInvoiceSweep(pool, { dryRun: false }).catch(
      (error) => {
        console.error("[composer-invoice] startup sweep failed", error);
      },
    );
  }, 120_000).unref();

  setInterval(() => {
    if (process.env.COMPOSER_INVOICE_STRICT_FIRST_OF_MONTH === "true") {
      const today = new Date().getUTCDate();
      if (today !== 1) return;
    }
    void runComposerMonthlyInvoiceSweep(pool, { dryRun: false }).catch(
      (error) => {
        console.error("[composer-invoice] interval sweep failed", error);
      },
    );
  }, readIntervalMs()).unref();
}
