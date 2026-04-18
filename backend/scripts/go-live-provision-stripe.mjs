#!/usr/bin/env node
/**
 * Go-live: provisjoner alle Role Room + CreatorHub-produkter i Stripe LIVE
 * mode. Rebygger nøyaktig samme katalog som finnes i TEST (samme priser,
 * samme tax-behavior, samme tax-code), klart for ekte betalinger.
 *
 * Idempotent — hvis et produkt med samme navn allerede finnes i live,
 * gjenbrukes det; hvis månedlig/årlig pris finnes med riktig beløp,
 * gjenbrukes den. Skriptet kan kjøres flere ganger uten duplikater.
 *
 * USE:
 *   # tørrkjør (ingen Stripe-endringer):
 *   STRIPE_LIVE_SECRET_KEY=sk_live_... node backend/scripts/go-live-provision-stripe.mjs --dry-run
 *
 *   # faktisk kjøring:
 *   STRIPE_LIVE_SECRET_KEY=sk_live_... node backend/scripts/go-live-provision-stripe.mjs
 *
 *   # også oppdater Render env-vars med pris-IDene (krever Render API-nøkkel):
 *   STRIPE_LIVE_SECRET_KEY=sk_live_... \
 *   RENDER_API_KEY=rnd_... \
 *   RENDER_SERVICE_ID=srv-d76ob60ule4c73dv2p60 \
 *   node backend/scripts/go-live-provision-stripe.mjs --update-render
 *
 * KREVER MANUELL OPPFØLGING ETTER KJØRING:
 *   1. Bytt STRIPE_SECRET_KEY i Render env til sk_live_*
 *   2. Registrer to webhook-endepunkter i Stripe live mode:
 *        https://creatorhub-backend-rtbl.onrender.com/api/platform/billing/webhook
 *        https://creatorhub-backend-rtbl.onrender.com/api/role-room/billing/webhook
 *      Kopier signing-secret til STRIPE_WEBHOOK_SECRET i Render.
 *   3. Bekreft at Stripe-kontoen er aktivert (charges_enabled=true) og at
 *      Norway-mva er konfigurert (Settings → Tax → Registrations).
 */

import Stripe from 'stripe';

const DRY_RUN = process.argv.includes('--dry-run');
const UPDATE_RENDER = process.argv.includes('--update-render');
const STRIPE_KEY = process.env.STRIPE_LIVE_SECRET_KEY;

if (!STRIPE_KEY) {
  console.error('STRIPE_LIVE_SECRET_KEY mangler. Hent fra Stripe → Developers → API keys (LIVE).');
  process.exit(1);
}
if (!STRIPE_KEY.startsWith('sk_live_')) {
  console.error(`Fikk en nøkkel som ikke starter med sk_live_ (fikk ${STRIPE_KEY.slice(0, 8)}…). Avbryter for å hindre at vi roter med testdata.`);
  process.exit(1);
}

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-12-18.acacia' });

const SAAS_TAX_CODE = 'txcd_10103001'; // Software as a service — business use

/**
 * Katalogen som skal speiles til live mode.
 * Hver entry: produkt-navn + beskrivelse + (månedlig, årlig) priser i NOK
 * (eks. mva — Stripe Tax legger på 25% ved checkout).
 */
const CATALOG = [
  // === The Role Room agent addon-tier ===
  {
    name: 'The Role Room — Spotlight',
    description: 'Entry-tier addon for The Role Room Agent. Inkluderer kundeanalyse og Instagram feed-planner med 20 AI-anbefalinger/dag.',
    tierSlug: 'spotlight',
    monthly: 99,
    yearly: 990,
    renderEnvMonthly: ['STRIPE_ROLE_ROOM_AGENT_PRICE_ID', 'STRIPE_ROLE_ROOM_SPOTLIGHT_PRICE_ID'],
    renderEnvYearly: ['STRIPE_ROLE_ROOM_SPOTLIGHT_YEARLY_PRICE_ID'],
  },
  {
    name: 'The Role Room — Headliner',
    description: 'Full tilgang til feed-planner: Instagram, TikTok og LinkedIn. Ubegrensede AI-anbefalinger. Brand-tilpasset PDF.',
    tierSlug: 'headliner',
    monthly: 199,
    yearly: 1990,
    renderEnvMonthly: ['STRIPE_ROLE_ROOM_HEADLINER_PRICE_ID'],
    renderEnvYearly: ['STRIPE_ROLE_ROOM_HEADLINER_YEARLY_PRICE_ID'],
  },
  {
    name: 'The Role Room — Showrunner',
    description: 'Enterprise-tilgang for team. Alt i Headliner pluss flerbruker-prosjekter, hvitmerket PDF, bulk-anbefaling og prioritert AI-modell.',
    tierSlug: 'showrunner',
    monthly: 599,
    yearly: 5990,
    renderEnvMonthly: ['STRIPE_ROLE_ROOM_SHOWRUNNER_PRICE_ID'],
    renderEnvYearly: ['STRIPE_ROLE_ROOM_SHOWRUNNER_YEARLY_PRICE_ID'],
  },
  // === The Role Room commercial subscription-tier ===
  {
    name: 'The Role Room — Innholdsprodusent',
    description: 'Role Room-abonnement for én innholdsprodusent.',
    tierSlug: 'content_producer',
    monthly: 495,
    yearly: 4950,
    renderEnvMonthly: ['ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER'],
    renderEnvYearly: ['ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER_YEARLY'],
  },
  {
    name: 'The Role Room — Produksjonsteam',
    description: 'Role Room-abonnement for produksjonsteam med flere medlemmer.',
    tierSlug: 'production_team',
    monthly: 795,
    yearly: 7950,
    renderEnvMonthly: ['ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM'],
    renderEnvYearly: ['ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM_YEARLY'],
  },
  // === CreatorHub-tier ===
  {
    name: 'CreatorHub — Basic Creator',
    description: 'Basisplanen for individuelle creators.',
    tierSlug: 'creatorhub_basic',
    monthly: 249,
    yearly: 2490,
    renderEnvMonthly: ['CREATORHUB_STRIPE_PRICE_ID_BASIC'],
    renderEnvYearly: ['CREATORHUB_STRIPE_PRICE_ID_BASIC_YEARLY'],
  },
  {
    name: 'CreatorHub — Professional Creator',
    description: 'Profesjonell plan for vekstende creators.',
    tierSlug: 'creatorhub_professional',
    monthly: 449,
    yearly: 4490,
    renderEnvMonthly: ['CREATORHUB_STRIPE_PRICE_ID_PROFESSIONAL'],
    renderEnvYearly: ['CREATORHUB_STRIPE_PRICE_ID_PROFESSIONAL_YEARLY'],
  },
  {
    name: 'CreatorHub — Premium Studio',
    description: 'Studio-plan med utvidede creator-verktøy og samarbeid.',
    tierSlug: 'creatorhub_premium',
    monthly: 1199,
    yearly: 11990,
    renderEnvMonthly: ['CREATORHUB_STRIPE_PRICE_ID_PREMIUM'],
    renderEnvYearly: ['CREATORHUB_STRIPE_PRICE_ID_PREMIUM_YEARLY'],
  },
  {
    name: 'CreatorHub — Enterprise',
    description: 'Enterprise-plan for studioer, byråer og store team.',
    tierSlug: 'creatorhub_enterprise',
    monthly: 3990,
    yearly: 39900,
    renderEnvMonthly: ['CREATORHUB_STRIPE_PRICE_ID_ENTERPRISE'],
    renderEnvYearly: ['CREATORHUB_STRIPE_PRICE_ID_ENTERPRISE_YEARLY'],
  },
];

async function getOrCreateProduct(entry) {
  // Søk på navn (Stripe har ingen unique på name; vi gjør match-or-create
  // for å holde skriptet idempotent).
  const search = await stripe.products.search({
    query: `name:'${entry.name.replace(/'/g, "\\'")}' AND active:'true'`,
    limit: 5,
  });
  const existing = search.data[0];
  if (existing) {
    return { product: existing, created: false };
  }
  if (DRY_RUN) {
    return { product: { id: '(would create)', name: entry.name }, created: 'dry-run' };
  }
  const product = await stripe.products.create({
    name: entry.name,
    description: entry.description,
    tax_code: SAAS_TAX_CODE,
    metadata: {
      tier_slug: entry.tierSlug,
      provisioned_by: 'go-live-provision-stripe',
    },
  });
  return { product, created: true };
}

async function getOrCreatePrice(product, entry, interval) {
  const isMonthly = interval === 'month';
  const amountNok = isMonthly ? entry.monthly : entry.yearly;
  const amountOere = amountNok * 100;
  const nicknameMonthly = `${entry.name} — månedlig`;
  const nicknameYearly = `${entry.name} — årlig`;
  const nickname = isMonthly ? nicknameMonthly : nicknameYearly;

  if (typeof product.id === 'string' && product.id.startsWith('prod_')) {
    const list = await stripe.prices.list({ product: product.id, active: true, limit: 20 });
    const match = list.data.find(
      (p) =>
        p.recurring?.interval === interval &&
        p.unit_amount === amountOere &&
        p.currency === 'nok' &&
        p.tax_behavior === 'exclusive',
    );
    if (match) return { price: match, created: false };
  }

  if (DRY_RUN) {
    return {
      price: {
        id: `(would create ${interval} ${amountNok} NOK)`,
        unit_amount: amountOere,
        recurring: { interval },
      },
      created: 'dry-run',
    };
  }

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'nok',
    unit_amount: amountOere,
    recurring: { interval },
    tax_behavior: 'exclusive',
    nickname,
  });
  return { price, created: true };
}

async function setDefaultPrice(product, monthlyPrice) {
  if (DRY_RUN) return;
  if (!monthlyPrice?.id?.startsWith('price_')) return;
  if (product.default_price === monthlyPrice.id) return;
  await stripe.products.update(product.id, { default_price: monthlyPrice.id });
}

async function updateRenderEnvVars(envMap) {
  const RENDER_API_KEY = process.env.RENDER_API_KEY;
  const RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID;
  if (!RENDER_API_KEY || !RENDER_SERVICE_ID) {
    console.log('\n(--update-render satt, men RENDER_API_KEY/RENDER_SERVICE_ID mangler. Hopper over Render-oppdatering.)');
    return;
  }
  console.log('\n=== Oppdaterer Render env-vars ===');
  for (const [key, value] of Object.entries(envMap)) {
    if (DRY_RUN) {
      console.log(`  (dry-run) ${key}=${value}`);
      continue;
    }
    const res = await fetch(
      `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars/${key}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${RENDER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      },
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.log(`  ✗ ${key}: ${body?.message ?? res.status}`);
    } else {
      console.log(`  ✓ ${key}=${value}`);
    }
  }
}

(async () => {
  console.log(`Go-live provisioning ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} — Stripe`);
  console.log('---');

  // Bekreft konto
  const account = await stripe.accounts.retrieve();
  console.log(`Konto: ${account.id}`);
  console.log(`  email: ${account.email ?? '(ikke satt)'}`);
  console.log(`  navn: ${account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? '(ikke satt)'}`);
  console.log(`  charges_enabled: ${account.charges_enabled}`);
  console.log(`  payouts_enabled: ${account.payouts_enabled}`);
  console.log(`  details_submitted: ${account.details_submitted}`);
  if (!account.charges_enabled) {
    console.log('\n⚠  Kontoen er ikke aktivert for charges ennå. Aktiver i Stripe Dashboard først (KYC, bank, virksomhetsinfo).');
    console.log('   Skriptet kan fortsatt opprette produkter, men ingen kunder kan betale før kontoen er aktiv.');
  }
  console.log('---');

  const envToSet = {};
  const summary = [];

  for (const entry of CATALOG) {
    console.log(`\n— ${entry.name} —`);
    const { product, created } = await getOrCreateProduct(entry);
    console.log(`  product: ${product.id} ${created === true ? '(opprettet)' : created === false ? '(eksisterer)' : '(dry-run)'}`);

    const monthly = await getOrCreatePrice(product, entry, 'month');
    const yearly = await getOrCreatePrice(product, entry, 'year');
    console.log(`  månedlig: ${monthly.price.id} (${entry.monthly} NOK) ${monthly.created === true ? '(opprettet)' : monthly.created === false ? '(eksisterer)' : ''}`);
    console.log(`  årlig:    ${yearly.price.id} (${entry.yearly} NOK) ${yearly.created === true ? '(opprettet)' : yearly.created === false ? '(eksisterer)' : ''}`);

    await setDefaultPrice(product, monthly.price);

    for (const key of entry.renderEnvMonthly) envToSet[key] = monthly.price.id;
    for (const key of entry.renderEnvYearly) envToSet[key] = yearly.price.id;

    summary.push({
      name: entry.name,
      monthlyId: monthly.price.id,
      yearlyId: yearly.price.id,
      monthlyAmount: entry.monthly,
      yearlyAmount: entry.yearly,
    });
  }

  console.log('\n========================================================');
  console.log(' Render env-vars du må sette (eller bruk --update-render):');
  console.log('');
  for (const [key, value] of Object.entries(envToSet)) {
    console.log(`   ${key}=${value}`);
  }
  console.log('========================================================');

  if (UPDATE_RENDER) {
    await updateRenderEnvVars(envToSet);
  }

  console.log('\nSAMMENDRAG');
  console.log('---');
  for (const s of summary) {
    console.log(`  ${s.name.padEnd(45)} ${String(s.monthlyAmount).padStart(5)}/${String(s.yearlyAmount).padStart(6)} NOK (mnd/år)`);
  }

  console.log('\nNESTE STEG');
  console.log('---');
  console.log('  1. STRIPE_SECRET_KEY (Render) → bytt til sk_live_*');
  console.log('  2. Registrer webhook-endepunkter i Stripe live:');
  console.log('       https://creatorhub-backend-rtbl.onrender.com/api/platform/billing/webhook');
  console.log('       https://creatorhub-backend-rtbl.onrender.com/api/role-room/billing/webhook');
  console.log('     → kopier signing-secrets til STRIPE_WEBHOOK_SECRET (+ CREATORHUB_STRIPE_WEBHOOK_SECRET)');
  console.log('  3. Trigger Render-deploy så de nye env-varene tas i bruk.');
  console.log('  4. Test: gjør én ekte 99-NOK-checkout, bekreft at webhook + e-post + DB-entitlement henger sammen.');
})().catch((error) => {
  console.error('\nSkript feilet:', error?.message ?? error);
  process.exit(1);
});
