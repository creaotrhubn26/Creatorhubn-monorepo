#!/usr/bin/env node
/**
 * Sørg for at alle Role Room-relaterte Stripe-priser har
 * `tax_behavior=exclusive` slik at Stripe Tax legger 25% norsk mva på
 * toppen ved checkout (i tråd med visningen "+ mva" i appen).
 *
 * Stripe lar oss IKKE endre tax_behavior på en eksisterende pris. Når en
 * pris allerede er `inclusive` eller `unspecified` lager dette skriptet
 * en NY pris på samme produkt med samme beløp/intervall, setter den som
 * produktets default_price, og arkiverer den gamle. Resultatet er en
 * liste env-vars du må oppdatere i Render.
 *
 *   # tørrkjør (ingen endringer):
 *   STRIPE_SECRET_KEY=sk_test_... node backend/scripts/sync-role-room-stripe-tax-behavior.mjs --dry-run
 *
 *   # faktisk kjøre:
 *   STRIPE_SECRET_KEY=sk_test_... node backend/scripts/sync-role-room-stripe-tax-behavior.mjs
 *
 *   # hvilke env-vars som sjekkes — overstyr om du vil:
 *   STRIPE_SECRET_KEY=... STRIPE_PRICE_ENV_VARS='STRIPE_ROLE_ROOM_AGENT_PRICE_ID,STRIPE_ROLE_ROOM_HEADLINER_PRICE_ID' \
 *     node backend/scripts/sync-role-room-stripe-tax-behavior.mjs
 *
 *   # peker direkte på pris-IDer i stedet for env-navn:
 *   STRIPE_SECRET_KEY=... STRIPE_PRICE_IDS='price_123,price_456' \
 *     node backend/scripts/sync-role-room-stripe-tax-behavior.mjs
 */

import Stripe from 'stripe';

const DRY_RUN = process.argv.includes('--dry-run');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY mangler. Hent fra Render → backend env og prøv igjen.');
  process.exit(1);
}

const DEFAULT_ENV_VARS = [
  'STRIPE_ROLE_ROOM_AGENT_PRICE_ID',
  'STRIPE_ROLE_ROOM_HEADLINER_PRICE_ID',
  'STRIPE_ROLE_ROOM_SHOWRUNNER_PRICE_ID',
  'ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER',
  'ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM',
];

const explicitIdList = (process.env.STRIPE_PRICE_IDS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const envVarList = (process.env.STRIPE_PRICE_ENV_VARS || DEFAULT_ENV_VARS.join(','))
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

function describePrice(price) {
  const amount = price.unit_amount != null ? (price.unit_amount / 100).toFixed(2) : '?';
  const interval = price.recurring ? `/${price.recurring.interval}` : '';
  return `${price.id} (${amount} ${price.currency?.toUpperCase()}${interval}, tax_behavior=${price.tax_behavior})`;
}

async function ensureExclusive(priceId, label) {
  let original;
  try {
    original = await stripe.prices.retrieve(priceId, { expand: ['product'] });
  } catch (error) {
    return { label, priceId, status: 'not_found', error: error?.message };
  }
  if (!original) return { label, priceId, status: 'not_found' };

  if (original.tax_behavior === 'exclusive') {
    return { label, priceId, status: 'already_exclusive', current: original };
  }

  if (DRY_RUN) {
    return {
      label,
      priceId,
      status: 'would_replace',
      current: original,
      note: `Ville lage ny pris med tax_behavior=exclusive på samme produkt (${original.product?.id ?? '?'}).`,
    };
  }

  // Lag ny pris på samme produkt med samme beløp/intervall, tax_behavior=exclusive.
  const productId = typeof original.product === 'string' ? original.product : original.product?.id;
  if (!productId || original.unit_amount == null) {
    return { label, priceId, status: 'cannot_replace', current: original, error: 'Mangler product/unit_amount' };
  }

  const newPrice = await stripe.prices.create({
    product: productId,
    currency: original.currency,
    unit_amount: original.unit_amount,
    recurring: original.recurring
      ? {
          interval: original.recurring.interval,
          interval_count: original.recurring.interval_count,
        }
      : undefined,
    tax_behavior: 'exclusive',
    nickname: original.nickname || undefined,
  });

  // Sett som produktets default price og arkiver den gamle.
  await stripe.products.update(productId, { default_price: newPrice.id });
  try {
    await stripe.prices.update(priceId, { active: false });
  } catch (archiveError) {
    // Best-effort — ikke kritisk om arkivering feiler.
  }

  return { label, priceId, status: 'replaced', current: original, replacement: newPrice };
}

(async () => {
  console.log(`Stripe tax-behavior-sync (${DRY_RUN ? 'DRY RUN' : 'LIVE'}) — Role Room`);
  console.log('---');

  const targets = [
    ...explicitIdList.map((id) => ({ envVar: '(direct)', priceId: id })),
    ...envVarList
      .map((envVar) => ({ envVar, priceId: process.env[envVar] }))
      .filter((entry) => entry.priceId),
  ];

  if (targets.length === 0) {
    console.log('Fant ingen pris-IDer å sjekke. Sett env-vars eller bruk --STRIPE_PRICE_IDS.');
    process.exit(0);
  }

  const results = [];
  for (const { envVar, priceId } of targets) {
    process.stdout.write(`  → ${envVar}: `);
    const result = await ensureExclusive(priceId, envVar);
    results.push(result);
    switch (result.status) {
      case 'already_exclusive':
        console.log(`OK (${describePrice(result.current)})`);
        break;
      case 'replaced':
        console.log(`erstattet ${result.priceId} → ${result.replacement.id}`);
        break;
      case 'would_replace':
        console.log(`vil bli erstattet (${describePrice(result.current)})`);
        break;
      case 'not_found':
        console.log(`fant ikke prisen (${result.error ?? 'unknown'})`);
        break;
      case 'cannot_replace':
        console.log(`kan ikke erstatte: ${result.error}`);
        break;
      default:
        console.log(result.status);
    }
  }

  const replaced = results.filter((r) => r.status === 'replaced');
  if (replaced.length > 0) {
    console.log('\n========================================================');
    console.log(' Oppdater disse i Render → backend env:');
    console.log('');
    for (const r of replaced) {
      console.log(`   ${r.label}=${r.replacement.id}`);
    }
    console.log('========================================================');
  } else if (DRY_RUN && results.some((r) => r.status === 'would_replace')) {
    console.log('\nKjør uten --dry-run for å faktisk erstatte prisene.');
  } else {
    console.log('\nIngen prisendringer nødvendig.');
  }
})().catch((error) => {
  console.error('Skript feilet:', error);
  process.exit(1);
});
