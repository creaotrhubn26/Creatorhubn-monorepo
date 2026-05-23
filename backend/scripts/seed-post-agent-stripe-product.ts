/**
 * Seed The Role Room Post Agent as a Stripe product.
 *
 * Run once (idempotent — safe to re-run after price changes):
 *   STRIPE_SECRET_KEY=sk_live_… npx tsx backend/scripts/seed-post-agent-stripe-product.ts
 *   STRIPE_SECRET_KEY=sk_test_… npx tsx backend/scripts/seed-post-agent-stripe-product.ts  # for test mode
 *
 * The script:
 *   1. Creates (or updates) one Stripe product "The Role Room Post Agent"
 *   2. Creates monthly + yearly recurring prices in NOK
 *   3. Archives any old price rows that don't match the current amounts
 *   4. Prints the resulting Stripe IDs — copy them into Render env vars:
 *        STRIPE_PRICE_POST_AGENT_MONTHLY=…
 *        STRIPE_PRICE_POST_AGENT_YEARLY=…
 *
 * The proxy entitlement check (post-agent-anthropic-routes.ts) uses
 * checkAgentEntitlement which already accepts active subscriptions
 * with plan_type matching pro/enterprise. To grant access via this
 * specific Post Agent product, add 'post_agent' as a recognized
 * plan_type in role-room-agent-entitlements.ts (see TODO at bottom).
 */

import Stripe from 'stripe';

interface TierDef {
  /** unique key used in metadata + as suffix for env-var name */
  key: 'monthly' | 'yearly';
  /** customer-facing nickname */
  nickname: string;
  /** amount in NOK, whole-kroner (script converts to øre) */
  amountNok: number;
  interval: 'month' | 'year';
}

const PRODUCT_NAME = 'The Role Room Post Agent';
const PRODUCT_DESCRIPTION =
  'AI-drevet post-produksjons-assistent for DaVinci Resolve. ' +
  'Inkluderer cull, highlight-scoring, scene-tagging og transkripsjon. ' +
  'Krever Mac med Apple Silicon + DaVinci Resolve Studio.';
const PRODUCT_LOOKUP_KEY = 'theroleroom_post_agent';

const TIERS: TierDef[] = [
  {
    key: 'monthly',
    nickname: 'Post Agent · månedlig',
    amountNok: 299,
    interval: 'month',
  },
  {
    key: 'yearly',
    nickname: 'Post Agent · årlig (2 mnd gratis)',
    amountNok: 2990,
    interval: 'year',
  },
];

const PRODUCT_METADATA: Record<string, string> = {
  source: 'theroleroom_post_agent_seed',
  app: 'post-agent',
  category: 'post_production_ai',
};

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

async function findExistingProduct(stripe: Stripe): Promise<Stripe.Product | null> {
  // Lookup-key search is the canonical way to find an idempotently-seeded product
  const search = await stripe.products.search({
    query: `metadata['app']:'post-agent'`,
    limit: 10,
  });
  return search.data.find((p) => p.active) ?? null;
}

async function upsertProduct(stripe: Stripe): Promise<Stripe.Product> {
  const existing = await findExistingProduct(stripe);
  if (existing) {
    console.log(`✓ found existing product: ${existing.id}`);
    return stripe.products.update(existing.id, {
      name: PRODUCT_NAME,
      description: PRODUCT_DESCRIPTION,
      metadata: PRODUCT_METADATA,
      active: true,
    });
  }
  console.log('  creating new product…');
  return stripe.products.create({
    name: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    metadata: PRODUCT_METADATA,
  });
}

async function findExistingPrice(
  stripe: Stripe,
  productId: string,
  tier: TierDef,
): Promise<Stripe.Price | null> {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 50,
  });
  return (
    prices.data.find(
      (p) =>
        p.metadata?.tier_key === tier.key &&
        p.recurring?.interval === tier.interval,
    ) ?? null
  );
}

async function upsertPrice(
  stripe: Stripe,
  productId: string,
  tier: TierDef,
): Promise<Stripe.Price> {
  const targetAmountOre = tier.amountNok * 100;
  const existing = await findExistingPrice(stripe, productId, tier);

  if (existing) {
    const matchesAmount = existing.unit_amount === targetAmountOre;
    if (matchesAmount) {
      console.log(`  ✓ price already correct: ${existing.id} (${tier.key})`);
      return existing;
    }
    console.log(`  archiving stale price ${existing.id} (was ${existing.unit_amount} øre)…`);
    await stripe.prices.update(existing.id, { active: false });
  }

  const created = await stripe.prices.create({
    product: productId,
    unit_amount: targetAmountOre,
    currency: 'nok',
    recurring: { interval: tier.interval },
    nickname: tier.nickname,
    metadata: {
      app: 'post-agent',
      tier_key: tier.key,
      source: 'theroleroom_post_agent_seed',
    },
  });
  console.log(`  ✓ created price ${created.id} (${tier.key}: ${tier.amountNok} NOK / ${tier.interval})`);
  return created;
}

async function main(): Promise<void> {
  const apiKey = envOrThrow('STRIPE_SECRET_KEY');
  const stripe = new Stripe(apiKey, { apiVersion: '2024-06-20' });

  const mode = apiKey.startsWith('sk_test_') ? 'TEST' : 'LIVE';
  console.log(`\n[seed] Stripe ${mode} mode\n`);
  console.log(`[seed] Upserting product "${PRODUCT_NAME}"…`);

  const product = await upsertProduct(stripe);
  console.log(`[seed] Product ID: ${product.id}\n`);

  const priceMap: Record<string, string> = {};
  for (const tier of TIERS) {
    console.log(`[seed] Tier: ${tier.nickname}`);
    const price = await upsertPrice(stripe, product.id, tier);
    priceMap[tier.key] = price.id;
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('Add these to Render env vars (or .env for local dev):\n');
  console.log(`STRIPE_PRODUCT_POST_AGENT=${product.id}`);
  for (const tier of TIERS) {
    const envKey = `STRIPE_PRICE_POST_AGENT_${tier.key.toUpperCase()}`;
    console.log(`${envKey}=${priceMap[tier.key]}`);
  }
  console.log(`\nLookup-key used in metadata: ${PRODUCT_LOOKUP_KEY}`);
  console.log(`${'='.repeat(70)}\n`);

  // TODO: To make the entitlement check honor users who buy *this specific*
  // Post Agent subscription (separate from general pro/enterprise tiers),
  // add 'post_agent' to the plan-types in role-room-agent-entitlements.ts
  // (readSubscriptionPlanType + the auto-provision branch). Without that,
  // a Post Agent-only purchaser will still be blocked by the entitlement
  // gate even though they paid — because the gate currently only recognizes
  // pro/enterprise/admin-grant.
  console.log(
    '⚠ Wire-up reminder: add `post_agent` as a recognized plan_type in\n' +
      '  backend/server/role-room-agent-entitlements.ts (readSubscriptionPlanType)\n' +
      '  so users who buy ONLY this product pass checkAgentEntitlement.\n',
  );
}

void main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
