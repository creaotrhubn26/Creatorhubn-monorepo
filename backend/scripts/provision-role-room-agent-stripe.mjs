#!/usr/bin/env node
/**
 * Idempotent Stripe provisioning for The Role Room Agent add-on.
 *
 *  - Creates (or looks up) the product by metadata tag.
 *  - Creates (or looks up) the monthly NOK recurring price.
 *  - Prints the IDs you need for Render env:
 *      STRIPE_ROLE_ROOM_AGENT_PRICE_ID=<price_id>
 *
 * Uses `metadata.role_room_agent_product=1` as the idempotency marker so
 * re-runs don't create duplicates. Safe in test AND live mode; the mode
 * is inferred from whatever STRIPE_SECRET_KEY you export.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node backend/scripts/provision-role-room-agent-stripe.mjs
 *
 * Dry-run (no writes):
 *   STRIPE_SECRET_KEY=sk_test_... DRY_RUN=1 node backend/scripts/provision-role-room-agent-stripe.mjs
 *
 * To tear down test-mode products later (does NOT work in live mode):
 *   STRIPE_SECRET_KEY=sk_test_... TEARDOWN=1 node backend/scripts/provision-role-room-agent-stripe.mjs
 */

const PRODUCT_METADATA_KEY = 'role_room_agent_product';
const PRODUCT_METADATA_VALUE = '1';
const PRODUCT_NAME = 'The Role Room Agent';
const PRODUCT_DESCRIPTION =
  'AI-assistent for The Role Room: brief-analyse, scope-vurdering, ' +
  'timeline-forslag og skytedag-oversikt. 99 kr/mnd. Kan sies opp når som helst.';
const PRICE_NICKNAME = 'The Role Room Agent — Monthly NOK';
const PRICE_UNIT_AMOUNT = 9900; // øre = 99.00 NOK
const PRICE_CURRENCY = 'nok';
const PRICE_INTERVAL = 'month';

const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const teardown = process.env.TEARDOWN === '1' || process.env.TEARDOWN === 'true';

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
  console.error('ERROR: STRIPE_SECRET_KEY must be set in the environment.');
  process.exit(1);
}

const isTestMode = apiKey.startsWith('sk_test_');
const isLiveMode = apiKey.startsWith('sk_live_');
if (!isTestMode && !isLiveMode) {
  console.error('ERROR: STRIPE_SECRET_KEY does not look like a Stripe key (expected sk_test_ or sk_live_).');
  process.exit(1);
}

if (teardown && !isTestMode) {
  console.error('ERROR: TEARDOWN=1 only runs in test mode (sk_test_). Refusing in live.');
  process.exit(1);
}

// Dynamic import so the script is portable without a bundler step.
const stripeMod = await import('stripe').catch(() => null);
if (!stripeMod) {
  console.error('ERROR: `stripe` package not installed. Run `cd backend && npm install` first.');
  process.exit(1);
}
const Stripe = stripeMod.default ?? stripeMod.Stripe;
const stripe = new Stripe(apiKey);

console.log(`Stripe provisioning (${isTestMode ? 'TEST' : 'LIVE'} mode)${dryRun ? ' — DRY RUN' : ''}${teardown ? ' — TEARDOWN' : ''}`);
console.log('---');

/**
 * Look for an existing product tagged with our metadata. Stripe has no
 * "search by metadata" on free accounts; we paginate through active
 * products and filter client-side. With a few dozen products this is
 * fine; scale beyond that and you'd want the Search API.
 */
async function findExistingProduct() {
  let starting_after;
  while (true) {
    const page = await stripe.products.list({ active: true, limit: 100, starting_after });
    const match = page.data.find(
      (product) => product.metadata?.[PRODUCT_METADATA_KEY] === PRODUCT_METADATA_VALUE,
    );
    if (match) return match;
    if (!page.has_more) return null;
    starting_after = page.data[page.data.length - 1].id;
  }
}

async function findExistingPriceFor(productId) {
  const page = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  return (
    page.data.find(
      (price) =>
        price.currency === PRICE_CURRENCY &&
        price.unit_amount === PRICE_UNIT_AMOUNT &&
        price.recurring?.interval === PRICE_INTERVAL,
    ) ?? null
  );
}

async function teardownMode() {
  const product = await findExistingProduct();
  if (!product) {
    console.log('No existing product found — nothing to tear down.');
    return;
  }
  console.log(`Found product ${product.id} — archiving (active=false) and deactivating prices.`);
  if (!dryRun) {
    const prices = await stripe.prices.list({ product: product.id, limit: 100 });
    for (const price of prices.data) {
      if (price.active) {
        await stripe.prices.update(price.id, { active: false });
        console.log(`  price ${price.id} deactivated`);
      }
    }
    await stripe.products.update(product.id, { active: false });
    console.log(`  product ${product.id} archived`);
  } else {
    console.log('  (skipped — DRY_RUN)');
  }
}

async function provision() {
  let product = await findExistingProduct();
  if (!product) {
    console.log(`Creating product "${PRODUCT_NAME}"...`);
    if (dryRun) {
      console.log('  (skipped — DRY_RUN)');
      console.log('STRIPE_ROLE_ROOM_AGENT_PRICE_ID=<would be created>');
      return;
    }
    product = await stripe.products.create({
      name: PRODUCT_NAME,
      description: PRODUCT_DESCRIPTION,
      metadata: { [PRODUCT_METADATA_KEY]: PRODUCT_METADATA_VALUE },
      tax_code: 'txcd_10000000', // Software as a service (NOK: 25% VAT applies)
      default_price_data: undefined,
    });
    console.log(`  ✓ ${product.id}`);
  } else {
    console.log(`Using existing product ${product.id}`);
  }

  let price = await findExistingPriceFor(product.id);
  if (!price) {
    console.log(`Creating price (${PRICE_UNIT_AMOUNT / 100} ${PRICE_CURRENCY.toUpperCase()}/${PRICE_INTERVAL})...`);
    if (dryRun) {
      console.log('  (skipped — DRY_RUN)');
      console.log('STRIPE_ROLE_ROOM_AGENT_PRICE_ID=<would be created>');
      return;
    }
    price = await stripe.prices.create({
      product: product.id,
      currency: PRICE_CURRENCY,
      unit_amount: PRICE_UNIT_AMOUNT,
      recurring: { interval: PRICE_INTERVAL },
      nickname: PRICE_NICKNAME,
      metadata: { [PRODUCT_METADATA_KEY]: PRODUCT_METADATA_VALUE },
    });
    console.log(`  ✓ ${price.id}`);
  } else {
    console.log(`Using existing price ${price.id}`);
  }

  console.log('');
  console.log('============================================================');
  console.log(' Stripe setup ready. Paste this into Render → backend env:');
  console.log('');
  console.log(`   STRIPE_ROLE_ROOM_AGENT_PRICE_ID=${price.id}`);
  console.log('');
  if (isTestMode) {
    console.log(' You are in TEST mode. Use card 4242 4242 4242 4242 to buy.');
    console.log(' Card 4000 0000 0000 0341 — renewal decline scenario.');
    console.log(' Card 4000 0025 0000 3155 — 3DS-required scenario.');
  }
  console.log('============================================================');
}

try {
  if (teardown) {
    await teardownMode();
  } else {
    await provision();
  }
} catch (error) {
  console.error('FATAL:', error?.message ?? error);
  if (error?.type) console.error('type:', error.type);
  process.exit(2);
}
