#!/usr/bin/env tsx
/**
 * Bootstrap Stripe-produkter for plakat-/menu-composeren.
 *
 * Idempotent via lookup_key — trygt å kjøre flere ganger.
 *
 * Oppretter:
 *   3 subscription-produkter:
 *     composer_pilot_monthly      199 NOK/mnd  (10 Claude · 50 renders · 1 GB · 1 brand)
 *     composer_standard_monthly   599 NOK/mnd  (50 Claude · 500 renders · 5 GB · 3 brands)
 *     composer_pro_monthly        1499 NOK/mnd (200 Claude · 2000 renders · 25 GB · ubegrenset)
 *
 *   3 metered-overage-priser:
 *     composer_overage_claude     5,00 NOK eks. mva. per Claude-kall
 *     composer_overage_render     0,50 NOK eks. mva. per render
 *     composer_overage_r2_gb      1,00 NOK eks. mva. per GB/mnd lagring
 *
 * Kjør:
 *   STRIPE_SECRET_KEY=sk_test_...  npx tsx backend/scripts/bootstrap-composer-stripe.ts
 *   STRIPE_SECRET_KEY=sk_live_...  npx tsx backend/scripts/bootstrap-composer-stripe.ts
 *
 * Output: Render-env-vars som settes (STRIPE_COMPOSER_*_PRICE_ID).
 */
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY env-var mangler.");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
});

interface ProductSpec {
  lookupKey: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
}

interface SubscriptionTier extends ProductSpec {
  priceNokExVat: number;
}

interface OveragePrice extends ProductSpec {
  priceNokExVat: number;
  unitLabel: string;
}

const TIERS: SubscriptionTier[] = [
  {
    lookupKey: "composer_pilot_monthly",
    name: "Pressroom — Pilot",
    description: "Plakater, signage og meny-PDF for liten butikk. 10 AI-genererte kampanjer + 50 renders + 1 GB lagring per måned.",
    metadata: { tier: "pilot", included_claude: "10", included_renders: "50", included_gb: "1", included_brands: "1" },
    priceNokExVat: 199,
  },
  {
    lookupKey: "composer_standard_monthly",
    name: "Pressroom — Standard",
    description: "Komplett plakat-/menu-stack for SMB. 50 AI-kampanjer + 500 renders + 5 GB + 3 brand-profiler.",
    metadata: { tier: "standard", included_claude: "50", included_renders: "500", included_gb: "5", included_brands: "3" },
    priceNokExVat: 599,
  },
  {
    lookupKey: "composer_pro_monthly",
    name: "Pressroom — Pro",
    description: "For kjeder og multi-store. 200 AI-kampanjer + 2000 renders + 25 GB + ubegrensede brand-profiler.",
    metadata: { tier: "pro", included_claude: "200", included_renders: "2000", included_gb: "25", included_brands: "999" },
    priceNokExVat: 1499,
  },
];

interface OveragePriceWithMeter extends OveragePrice {
  meterEventName: string;     // matcher meter_events.create(event_name)
  meterDisplayName: string;   // vises i Stripe dashboard
}

const OVERAGE: OveragePriceWithMeter[] = [
  {
    lookupKey: "composer_overage_claude",
    name: "Composer — AI-kampanje (overage)",
    description: "Pris per Claude-genererte kampanje-tekst utover månedlig kvote.",
    metadata: { event_type: "claude_campaign" },
    priceNokExVat: 5,
    unitLabel: "kall",
    meterEventName: "composer_claude_call",
    meterDisplayName: "Composer Claude calls",
  },
  {
    lookupKey: "composer_overage_render",
    name: "Composer — Render (overage)",
    description: "Pris per plakat-/meny-render utover månedlig kvote.",
    metadata: { event_type: "render" },
    priceNokExVat: 0.5,
    unitLabel: "render",
    meterEventName: "composer_render",
    meterDisplayName: "Composer renders",
  },
  {
    lookupKey: "composer_overage_r2_gb",
    name: "Composer — Lagring (overage)",
    description: "Pris per GB lagring utover månedlig kvote (per måned).",
    metadata: { event_type: "r2_storage" },
    priceNokExVat: 1,
    unitLabel: "GB/mnd",
    meterEventName: "composer_r2_gb_month",
    meterDisplayName: "Composer R2 storage GB-mnd",
  },
];

/**
 * Stripe Billing Meters (siden 2025-03-31): metered prices må kobles til
 * en Meter som mottar usage events via /v1/billing/meter_events.
 * Idempotent via event_name (Meter har ikke lookup_key, men event_name er unikt).
 */
async function findOrCreateMeter(
  eventName: string,
  displayName: string,
): Promise<Stripe.Billing.Meter> {
  const existing = await stripe.billing.meters.list({ limit: 100 });
  const match = existing.data.find((m) => m.event_name === eventName);
  if (match) {
    console.log(`  ✓ Meter eksisterer: ${eventName} (${match.id})`);
    return match;
  }
  const created = await stripe.billing.meters.create({
    display_name: displayName,
    event_name: eventName,
    default_aggregation: { formula: "sum" },
    customer_mapping: { event_payload_key: "stripe_customer_id", type: "by_id" },
    value_settings: { event_payload_key: "value" },
  });
  console.log(`  + Meter opprettet: ${eventName} (${created.id})`);
  return created;
}

async function findOrCreateProduct(spec: ProductSpec): Promise<Stripe.Product> {
  const existing = await stripe.products.list({ limit: 100, active: true });
  const match = existing.data.find((p) => p.metadata?.lookup_key === spec.lookupKey);
  if (match) {
    console.log(`  ✓ Eksisterer: ${spec.name} (${match.id})`);
    return match;
  }
  const created = await stripe.products.create({
    name: spec.name,
    description: spec.description,
    metadata: { ...spec.metadata, lookup_key: spec.lookupKey },
    tax_code: "txcd_10000000",
  });
  console.log(`  + Opprettet: ${spec.name} (${created.id})`);
  return created;
}

async function findOrCreatePrice(
  productId: string,
  lookupKey: string,
  spec: {
    priceNokExVat: number;
    recurring?: boolean;
    meterId?: string; // Hvis satt, opprettes prisen som meter-backed (siden 2025-03-31)
    metadata?: Record<string, string>;
  },
): Promise<Stripe.Price> {
  const unitAmount = Math.round(spec.priceNokExVat * 100);
  const existingPrices = await stripe.prices.list({ product: productId, lookup_keys: [lookupKey], limit: 5 });
  if (existingPrices.data.length > 0) {
    const p = existingPrices.data[0];
    console.log(`    ✓ Pris eksisterer: ${lookupKey} (${p.id}) ${p.unit_amount! / 100} NOK`);
    return p;
  }
  const params: Stripe.PriceCreateParams = {
    product: productId,
    unit_amount: unitAmount,
    currency: "nok",
    lookup_key: lookupKey,
    metadata: { ...spec.metadata },
    tax_behavior: "exclusive",
  };
  if (spec.meterId) {
    // Metered price (recurring 'metered' med meter-binding)
    params.recurring = { interval: "month", usage_type: "metered", meter: spec.meterId };
  } else if (spec.recurring) {
    params.recurring = { interval: "month", usage_type: "licensed" };
  }
  const price = await stripe.prices.create(params);
  console.log(`    + Opprettet pris: ${lookupKey} (${price.id}) ${unitAmount / 100} NOK eks. mva.`);
  return price;
}

async function main() {
  console.log("\nStripe Composer Bootstrap");
  console.log("─────────────────────────");
  console.log(`Account-mode: ${process.env.STRIPE_SECRET_KEY!.startsWith("sk_test_") ? "TEST" : "LIVE"}`);
  console.log("MVA-policy: priser eks. 25% (Stripe Tax legger på)\n");

  console.log("Subscription-tiers:");
  const tierResults: Array<{ tier: string; productId: string; priceId: string; price: number }> = [];
  for (const tier of TIERS) {
    const product = await findOrCreateProduct(tier);
    const price = await findOrCreatePrice(product.id, tier.lookupKey, {
      priceNokExVat: tier.priceNokExVat,
      recurring: true,
    });
    tierResults.push({ tier: tier.metadata.tier, productId: product.id, priceId: price.id, price: tier.priceNokExVat });
  }

  console.log("\nOverage-priser (metered med Stripe Meters):");
  const overageResults: Array<{ event: string; productId: string; priceId: string; meterId: string; meterEventName: string; price: number }> = [];
  for (const ov of OVERAGE) {
    const product = await findOrCreateProduct(ov);
    const meter = await findOrCreateMeter(ov.meterEventName, ov.meterDisplayName);
    const price = await findOrCreatePrice(product.id, ov.lookupKey, {
      priceNokExVat: ov.priceNokExVat,
      meterId: meter.id,
      metadata: { ...ov.metadata, meter_event_name: ov.meterEventName },
    });
    overageResults.push({
      event: ov.metadata.event_type,
      productId: product.id,
      priceId: price.id,
      meterId: meter.id,
      meterEventName: ov.meterEventName,
      price: ov.priceNokExVat,
    });
  }

  console.log("\n─────────────────────────");
  console.log("Render-env-vars som må settes (kopier disse):\n");
  for (const r of tierResults) {
    console.log(`STRIPE_COMPOSER_${r.tier.toUpperCase()}_PRICE_ID=${r.priceId}`);
  }
  for (const r of overageResults) {
    const eventKey = r.event === "claude_campaign" ? "CLAUDE" : r.event === "render" ? "RENDER" : "R2_GB";
    console.log(`STRIPE_COMPOSER_OVERAGE_${eventKey}_PRICE_ID=${r.priceId}`);
    console.log(`STRIPE_COMPOSER_OVERAGE_${eventKey}_METER_ID=${r.meterId}`);
    console.log(`STRIPE_COMPOSER_OVERAGE_${eventKey}_METER_EVENT_NAME=${r.meterEventName}`);
  }
  console.log("\nFerdig. Sett env-vars i Render dashboard og redeploy backend.");
  console.log("MERK: invoice-runner må oppdateres til å sende meter_events");
  console.log("(POST /v1/billing/meter_events) i stedet for invoice_items pga.");
  console.log("Stripe Meter-kravet (2025-03-31).\n");
}

main().catch((err) => {
  console.error("\n❌ Bootstrap feilet:", err);
  process.exit(1);
});
