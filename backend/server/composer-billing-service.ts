/**
 * Composer billing-service.
 *
 * Logger fakturerbar bruk i composer_usage med pris stemplet ved innsetting
 * (samme mønster som casting_sms_usage). Fire-and-forget — kalleren venter
 * ikke. composer-invoice-runner aggregerer månedlig og syncer til Stripe.
 *
 * Pris-policy (env-overstyrbart):
 *   COMPOSER_CLAUDE_RETAIL_PRICE_NOK_EX_VAT  = 5.00
 *   COMPOSER_RENDER_RETAIL_PRICE_NOK_EX_VAT  = 0.50
 *   COMPOSER_R2_GB_MONTH_NOK_EX_VAT          = 1.00
 *   COMPOSER_VAT_RATE                        = 0.25
 */
import type { Pool } from "pg";

const VAT_RATE = Number(process.env.COMPOSER_VAT_RATE ?? "0.25");

const PRICES = {
  claude_campaign: Number(process.env.COMPOSER_CLAUDE_RETAIL_PRICE_NOK_EX_VAT ?? "5.00"),
  render_poster: Number(process.env.COMPOSER_RENDER_RETAIL_PRICE_NOK_EX_VAT ?? "0.50"),
  render_menu_pdf: Number(process.env.COMPOSER_RENDER_RETAIL_PRICE_NOK_EX_VAT ?? "0.50"),
  r2_storage: Number(process.env.COMPOSER_R2_GB_MONTH_NOK_EX_VAT ?? "1.00"),
} as const;

export type ComposerEventType = keyof typeof PRICES;

interface RecordUsageInput {
  userId: string;
  businessProfileId?: string | null;
  eventType: ComposerEventType;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

function billingPeriod(d = new Date()): string {
  const y = d.getUTCFullYear().toString().padStart(4, "0");
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Logg fakturerbar bruk (fire-and-forget). Feilet INSERT logges kun til
 * console — bryter ikke brukerens API-kall.
 */
export function recordUsage(pool: Pool, input: RecordUsageInput): void {
  const quantity = input.quantity ?? 1;
  const unitPrice = PRICES[input.eventType];
  const totalExVat = +(unitPrice * quantity).toFixed(4);
  const totalInclVat = +(totalExVat * (1 + VAT_RATE)).toFixed(4);
  const period = billingPeriod();

  setImmediate(async () => {
    try {
      await pool.query(
        `INSERT INTO composer_usage
           (user_id, business_profile_id, event_type, quantity,
            unit_price_nok_ex_vat, vat_rate, total_nok_ex_vat, total_nok_incl_vat,
            billing_period, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          input.userId,
          input.businessProfileId ?? null,
          input.eventType,
          quantity,
          unitPrice,
          VAT_RATE,
          totalExVat,
          totalInclVat,
          period,
          input.metadata ? JSON.stringify(input.metadata) : null,
        ],
      );
    } catch (err) {
      console.error("[composer-billing] recordUsage failed:", err);
    }
  });
}

export interface UsageSummary {
  period: string;
  tier: string;
  included: {
    claude_calls: number;
    renders: number;
    r2_gb: number;
    brands: number;
  };
  consumed: {
    claude_calls: number;
    renders: number;
    r2_gb: number;
  };
  cost_nok_ex_vat: number;
}

const TIER_DEFAULTS: Record<string, { claude: number; renders: number; gb: number; brands: number; price: number }> = {
  pilot: { claude: 10, renders: 50, gb: 1, brands: 1, price: 199 },
  standard: { claude: 50, renders: 500, gb: 5, brands: 3, price: 599 },
  pro: { claude: 200, renders: 2000, gb: 25, brands: 9999, price: 1499 },
};

export async function getUsageSummary(pool: Pool, userId: string): Promise<UsageSummary> {
  const period = billingPeriod();

  const subRes = await pool.query<{
    tier: string;
    included_claude_calls: number;
    included_renders: number;
    included_r2_gb: string;
    included_brands: number;
  }>(
    `SELECT tier, included_claude_calls, included_renders, included_r2_gb, included_brands
     FROM composer_subscription
     WHERE user_id = $1`,
    [userId],
  );

  const sub = subRes.rows[0];
  const tier = sub?.tier ?? "pilot";
  const tierDefaults = TIER_DEFAULTS[tier] ?? TIER_DEFAULTS.pilot;

  const usage = await pool.query<{
    event_type: string;
    total_quantity: string;
    total_cost: string;
  }>(
    `SELECT event_type, SUM(quantity)::text AS total_quantity, SUM(total_nok_ex_vat)::text AS total_cost
     FROM composer_usage
     WHERE user_id = $1 AND billing_period = $2
     GROUP BY event_type`,
    [userId, period],
  );

  let claudeCalls = 0;
  let renders = 0;
  let r2Gb = 0;
  let totalCost = 0;
  for (const row of usage.rows) {
    const qty = Number(row.total_quantity);
    const cost = Number(row.total_cost);
    totalCost += cost;
    if (row.event_type === "claude_campaign") claudeCalls += qty;
    else if (row.event_type === "render_poster" || row.event_type === "render_menu_pdf") renders += qty;
    else if (row.event_type === "r2_storage") r2Gb = Math.max(r2Gb, qty);
  }

  return {
    period,
    tier,
    included: {
      claude_calls: sub?.included_claude_calls ?? tierDefaults.claude,
      renders: sub?.included_renders ?? tierDefaults.renders,
      r2_gb: Number(sub?.included_r2_gb ?? tierDefaults.gb),
      brands: sub?.included_brands ?? tierDefaults.brands,
    },
    consumed: {
      claude_calls: claudeCalls,
      renders: renders,
      r2_gb: +r2Gb.toFixed(3),
    },
    cost_nok_ex_vat: +totalCost.toFixed(2),
  };
}

export const COMPOSER_PRICING = {
  retail: PRICES,
  vat_rate: VAT_RATE,
  tiers: TIER_DEFAULTS,
};
