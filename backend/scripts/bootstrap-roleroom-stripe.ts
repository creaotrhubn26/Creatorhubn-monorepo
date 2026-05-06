#!/usr/bin/env tsx
/**
 * Bootstrap Stripe-produkter for hele The Role Room (umbrella).
 *
 * Idempotent via lookup_key — trygt å kjøre flere ganger.
 *
 * SUBSCRIPTION-TIERS (umbrella, inkluderer Pressroom + Photo Enhancer + Marketing Plan):
 *   roleroom_frilanser_monthly    599 NOK/mnd  (1 produsent · 1 brand · 5 GB)
 *   roleroom_studio_monthly      1799 NOK/mnd  (5 produsenter · 5 brands · 50 GB)
 *   roleroom_agency_monthly      4999 NOK/mnd  (25 produsenter · ubegr. brands · 500 GB)
 *
 * METERED OVERAGE-PRISER (alle koblet til Stripe Meters siden 2025-03-31):
 *   composer_overage_claude          5,00 NOK per Claude-kall (Pressroom)
 *   composer_overage_render          0,50 NOK per render (Pressroom)
 *   composer_overage_r2_gb           1,00 NOK per GB/mnd lagring (alle services)
 *   roleroom_overage_marketing_post 15,00 NOK per Posts-generering (Marketing Plan)
 *
 * NB: Photo Enhancer er en ISOLERT produkt-linje med separat tier/billing —
 * IKKE inkludert i Role Room-umbrella. Egen bootstrap kommer i fremtidig PR.
 *
 * NB: Eksisterende Pressroom-only-tiers (Pilot 199 / Standard 599 / Pro 1499)
 * blir DEPRECATED når dette kjører — gamle prisene archives, men produktene
 * beholdes (rename i Stripe dashboard for ryddighet).
 *
 * Tax-håndtering: alle priser tax_behavior='exclusive' (eks. mva.) +
 * tax_code='txcd_10000000' (digital service). Stripe Tax legger på 25% MVA
 * automatisk når subscription opprettes med automatic_tax:{enabled:true}.
 *
 * Kjør:
 *   STRIPE_SECRET_KEY=sk_test_...  npx tsx backend/scripts/bootstrap-roleroom-stripe.ts
 *   STRIPE_SECRET_KEY=sk_live_...  npx tsx backend/scripts/bootstrap-roleroom-stripe.ts
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
  oldLookupKey?: string; // For å archive gammel pris
}

interface OveragePrice extends ProductSpec {
  priceNokExVat: number;
  meterEventName: string;
  meterDisplayName: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Subscription-tiers (umbrella — erstatter gamle Pressroom-only-tiers)
// ─────────────────────────────────────────────────────────────────────────

const TIERS: SubscriptionTier[] = [
  {
    lookupKey: "roleroom_frilanser_monthly",
    oldLookupKey: "composer_pilot_monthly",
    name: "Role Room — Frilanser",
    description:
      "Hele Role Room-plattformen for én produsent. Inkluderer Agent chat + Marketing Plan (1/mnd) + Pressroom Pilot (10 AI-kampanjer + 50 renders) + 5 GB lagring. 1 brand-profil. Photo Enhancer er separat produkt.",
    metadata: {
      tier: "frilanser",
      included_claude: "10",
      included_renders: "50",
      included_gb: "5",
      included_marketing_plan: "1",
      included_brands: "1",
      included_producers: "1",
    },
    priceNokExVat: 599,
  },
  {
    lookupKey: "roleroom_studio_monthly",
    oldLookupKey: "composer_standard_monthly",
    name: "Role Room — Studio",
    description:
      "For studioer og mindre byråer. Alt fra Frilanser + Feed Planner + Marketing Plan ubegrenset + Pressroom Standard (50 AI + 500 renders) + 50 GB + 5 brand-profiler + 5 produsenter + iPad Capture App. Photo Enhancer er separat produkt.",
    metadata: {
      tier: "studio",
      included_claude: "50",
      included_renders: "500",
      included_gb: "50",
      included_marketing_plan: "9999",
      included_brands: "5",
      included_producers: "5",
    },
    priceNokExVat: 1799,
  },
  {
    lookupKey: "roleroom_agency_monthly",
    oldLookupKey: "composer_pro_monthly",
    name: "Role Room — Agency",
    description:
      "For større byråer og kjeder. Alt fra Studio + multi-team + white-label-opsjon + Pressroom Pro (200 AI + 2000 renders) + 500 GB + ubegrensede brands + 25 produsenter + prioritet-support + custom-templates. Photo Enhancer er separat produkt.",
    metadata: {
      tier: "agency",
      included_claude: "200",
      included_renders: "2000",
      included_gb: "500",
      included_marketing_plan: "9999",
      included_brands: "999",
      included_producers: "25",
    },
    priceNokExVat: 4999,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Metered overage-priser (siden 2025-03-31 må alle metered koblet til Meter)
// ─────────────────────────────────────────────────────────────────────────

const OVERAGE: OveragePrice[] = [
  // Eksisterende Pressroom-overages — beholdes
  {
    lookupKey: "composer_overage_claude",
    name: "Pressroom — AI-kampanje (overage)",
    description: "Pris per Claude-genererte kampanje-tekst utover månedlig kvote.",
    metadata: { event_type: "claude_campaign" },
    priceNokExVat: 5,
    meterEventName: "composer_claude_call",
    meterDisplayName: "Pressroom Claude calls",
  },
  {
    lookupKey: "composer_overage_render",
    name: "Pressroom — Render (overage)",
    description: "Pris per plakat-/meny-render utover månedlig kvote.",
    metadata: { event_type: "render" },
    priceNokExVat: 0.5,
    meterEventName: "composer_render",
    meterDisplayName: "Pressroom renders",
  },
  {
    lookupKey: "composer_overage_r2_gb",
    name: "Role Room — Lagring (overage)",
    description: "Pris per GB lagring utover månedlig kvote (per måned, gjelder alle services).",
    metadata: { event_type: "r2_storage" },
    priceNokExVat: 1,
    meterEventName: "composer_r2_gb_month",
    meterDisplayName: "Role Room R2 storage GB-mnd",
  },
  // NYE overage-produkter (Marketing Plan)
  {
    lookupKey: "roleroom_overage_marketing_post",
    name: "Marketing Plan — Posts-generering (overage)",
    description:
      "Pris per Marketing Plan Posts-generering (30 social-media-posts) utover månedlig kvote.",
    metadata: { event_type: "marketing_plan_posts" },
    priceNokExVat: 15,
    meterEventName: "roleroom_marketing_plan_posts",
    meterDisplayName: "Marketing Plan Posts generations",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

async function findOrCreateProduct(spec: ProductSpec): Promise<Stripe.Product> {
  const existing = await stripe.products.list({ limit: 100, active: true });
  const match = existing.data.find((p) => p.metadata?.lookup_key === spec.lookupKey);
  if (match) {
    if (match.name !== spec.name || match.description !== spec.description) {
      const updated = await stripe.products.update(match.id, {
        name: spec.name,
        description: spec.description,
        metadata: { ...spec.metadata, lookup_key: spec.lookupKey },
      });
      console.log(`  ↻ Oppdatert: "${match.name}" → "${updated.name}" (${updated.id})`);
      return updated;
    }
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

async function findOrCreateMeter(eventName: string, displayName: string): Promise<Stripe.Billing.Meter> {
  const existing = await stripe.billing.meters.list({ limit: 100 });
  const match = existing.data.find((m) => m.event_name === eventName);
  if (match) {
    console.log(`  ✓ Meter: ${eventName} (${match.id})`);
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

async function findOrCreatePrice(
  productId: string,
  lookupKey: string,
  spec: {
    priceNokExVat: number;
    recurring?: boolean;
    meterId?: string;
    metadata?: Record<string, string>;
  },
): Promise<Stripe.Price> {
  const unitAmount = Math.round(spec.priceNokExVat * 100);
  const existingPrices = await stripe.prices.list({
    product: productId,
    lookup_keys: [lookupKey],
    limit: 5,
  });
  if (existingPrices.data.length > 0) {
    const p = existingPrices.data[0];
    if (p.unit_amount !== unitAmount) {
      // Pris har endret seg — Stripe-prices er IMMUTABLE i unit_amount,
      // så vi må archive eksisterende + opprette ny med samme lookup_key.
      // Trinn 1: fjern lookup_key fra gammel pris (frigjør keyet)
      await stripe.prices.update(p.id, { lookup_key: `${lookupKey}_archived_${Date.now()}`, active: false });
      console.log(`    ↻ Archivert gammel pris ${p.id} (var ${p.unit_amount! / 100}, ny ${unitAmount / 100} NOK)`);
    } else {
      console.log(`    ✓ Pris: ${lookupKey} (${p.id}) ${p.unit_amount! / 100} NOK`);
      return p;
    }
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
    params.recurring = { interval: "month", usage_type: "metered", meter: spec.meterId };
  } else if (spec.recurring) {
    params.recurring = { interval: "month", usage_type: "licensed" };
  }
  const price = await stripe.prices.create(params);
  console.log(`    + Ny pris: ${lookupKey} (${price.id}) ${unitAmount / 100} NOK eks. mva.`);
  return price;
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n=== Role Room Stripe Bootstrap (umbrella) ===");
  console.log(`Mode: ${process.env.STRIPE_SECRET_KEY!.startsWith("sk_test_") ? "TEST" : "LIVE"}\n`);

  console.log("Subscription-tiers (Role Room umbrella):");
  const tierResults: Array<{ tier: string; productId: string; priceId: string; price: number }> = [];
  for (const tier of TIERS) {
    const product = await findOrCreateProduct(tier);
    const price = await findOrCreatePrice(product.id, tier.lookupKey, {
      priceNokExVat: tier.priceNokExVat,
      recurring: true,
    });
    tierResults.push({
      tier: tier.metadata.tier,
      productId: product.id,
      priceId: price.id,
      price: tier.priceNokExVat,
    });
  }

  console.log("\nMetered overage-priser:");
  const overageResults: Array<{ event: string; productId: string; priceId: string; meterId: string; meterEventName: string; price: number; lookupKey: string }> = [];
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
      lookupKey: ov.lookupKey,
    });
  }

  // ── Tax-status ──
  console.log("\n=== Tax-status ===");
  try {
    // @ts-ignore — Tax Registrations API
    const taxRegs = await stripe.tax.registrations.list({ status: "active", limit: 50 });
    const norway = taxRegs.data.find((r: { country: string }) => r.country === "NO");
    if (norway) {
      console.log(`  ✓ Stripe Tax aktiv for Norge (${(norway as { id: string }).id})`);
    } else {
      console.log("  ⚠️  NORGE IKKE REGISTRERT! → Stripe Dashboard → Settings → Tax → Add registration → Country: Norway");
    }
  } catch {
    console.log("  (kan ikke sjekke — restricted key uten Tax-scope)");
  }

  // ── Render env-vars ──
  console.log("\n=== Render env-vars (kopier disse) ===\n");
  for (const r of tierResults) {
    console.log(`STRIPE_ROLEROOM_${r.tier.toUpperCase()}_PRICE_ID=${r.priceId}`);
  }
  for (const r of overageResults) {
    let key: string;
    if (r.lookupKey === "composer_overage_claude") key = "PRESSROOM_CLAUDE";
    else if (r.lookupKey === "composer_overage_render") key = "PRESSROOM_RENDER";
    else if (r.lookupKey === "composer_overage_r2_gb") key = "R2_GB";
    else if (r.lookupKey === "roleroom_overage_photo_enhance") key = "PHOTO_ENHANCE";
    else if (r.lookupKey === "roleroom_overage_marketing_post") key = "MARKETING_POST";
    else key = r.lookupKey.toUpperCase();
    console.log(`STRIPE_OVERAGE_${key}_PRICE_ID=${r.priceId}`);
    console.log(`STRIPE_OVERAGE_${key}_METER_ID=${r.meterId}`);
    console.log(`STRIPE_OVERAGE_${key}_METER_EVENT_NAME=${r.meterEventName}`);
  }

  console.log("\n=== Påminnelser ===");
  console.log("• Subscriptions må opprettes med automatic_tax:{enabled:true} + customer.address satt");
  console.log("• Eksisterende composer_pilot/standard/pro-priser er nå deprecated; archive i dashboard hvis ønskelig");
  console.log("• Sett env-vars i Render + redeploy backend\n");
}

main().catch((err) => {
  console.error("\n❌ Bootstrap feilet:", err);
  process.exit(1);
});
