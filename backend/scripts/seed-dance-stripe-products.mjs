#!/usr/bin/env node
/**
 * seed-dance-stripe-products.mjs
 *
 * Idempotent seed: oppretter Stripe-produkter + prices for de 5 betalbare
 * dance-planene (freelance_basic, freelance_pro, studio_start, studio,
 * studio_pro) og lagrer Stripe Price IDs tilbake i dance_plan via Neon.
 *
 * Idempotency: før vi oppretter, sjekker vi om det allerede finnes et
 * produkt med metadata `dance_plan_slug=<slug>`. Hvis ja, gjenbruker vi.
 *
 * Krever:
 *   STRIPE_SECRET_KEY (henter fra Render env hvis ikke satt)
 *   DATABASE_URL      (henter fra Render env hvis ikke satt)
 */

import { Client as PgClient } from 'pg';

const log = (...a) => console.log(...a);

async function fetchEnvFromRender(key) {
  const apiKey = process.env.RENDER_API_KEY;
  if (!apiKey) throw new Error('RENDER_API_KEY mangler');
  const res = await fetch(
    `https://api.render.com/v1/services/srv-d76ob60ule4c73dv2p60/env-vars/${key}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) throw new Error(`Render API ${res.status} for ${key}`);
  const body = await res.json();
  return body.value;
}

async function stripeRequest(stripeKey, method, path, params = null) {
  const url = `https://api.stripe.com/v1${path}`;
  const headers = {
    Authorization: `Basic ${Buffer.from(`${stripeKey}:`).toString('base64')}`,
  };
  let body;
  if (params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const sp = new URLSearchParams();
    const flatten = (obj, prefix = '') => {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}[${k}]` : k;
        if (Array.isArray(v)) {
          v.forEach((item, i) => flatten({ [i]: item }, `${key}`));
        } else if (v != null && typeof v === 'object') {
          flatten(v, key);
        } else if (v != null) {
          sp.append(key, String(v));
        }
      }
    };
    flatten(params);
    body = sp.toString();
  }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.error?.message ?? text;
    throw new Error(`Stripe ${method} ${path} → ${res.status}: ${msg}`);
  }
  return json;
}

async function findProductBySlug(stripeKey, slug) {
  const res = await stripeRequest(
    stripeKey,
    'GET',
    `/products/search?query=${encodeURIComponent(`metadata['dance_plan_slug']:'${slug}' AND active:'true'`)}`,
  );
  return res.data?.[0] ?? null;
}

async function listPricesForProduct(stripeKey, productId) {
  const res = await stripeRequest(stripeKey, 'GET', `/prices?product=${productId}&active=true&limit=20`);
  return res.data ?? [];
}

const PLAN_DEFS = [
  {
    slug: 'freelance_basic',
    name: 'Frilanser',
    description: 'Aktiv jobbsøker. Ubegrenset reel + prøvelogg + NAV-rapport + casting-eksport.',
    monthlyKr: 149,
    yearlyKr: 1490,
  },
  {
    slug: 'freelance_pro',
    name: 'Frilanser Pro',
    description: 'Etablert pro. Alt i Frilanser + AI-tagging + analytics + prioritert support.',
    monthlyKr: 299,
    yearlyKr: 2990,
  },
  {
    slug: 'studio_start',
    name: 'Studio Start',
    description: 'Mindre studio (<50 elever). 1 admin. Klasser/instruktører/saler + prøvelogg.',
    monthlyKr: 599,
    yearlyKr: 5990,
  },
  {
    slug: 'studio',
    name: 'Studio',
    description: 'Mellom-studio (50–200 elever). 5 admins. Multi-prosjekt + EHF-faktura.',
    monthlyKr: 1199,
    yearlyKr: 11990,
  },
  {
    slug: 'studio_pro',
    name: 'Studio Pro',
    description: 'Stort studio/kompani (200+). 15 admins. White-label + dedikert kontakt.',
    monthlyKr: 2490,
    yearlyKr: 24900,
  },
];

async function ensureProduct(stripeKey, def) {
  const existing = await findProductBySlug(stripeKey, def.slug);
  if (existing) {
    log(`  ↻ ${def.slug}: bruker eksisterende product ${existing.id}`);
    return existing;
  }
  const created = await stripeRequest(stripeKey, 'POST', '/products', {
    name: `Dance · ${def.name}`,
    description: def.description,
    metadata: {
      dance_plan_slug: def.slug,
      vertical: 'dance',
    },
  });
  log(`  + ${def.slug}: opprettet product ${created.id}`);
  return created;
}

async function ensurePrice(stripeKey, productId, slug, billingPeriod, kr) {
  const existing = await listPricesForProduct(stripeKey, productId);
  const interval = billingPeriod === 'monthly' ? 'month' : 'year';
  const expectedAmount = kr * 100; // øre
  const match = existing.find(
    (p) =>
      p.recurring?.interval === interval &&
      p.unit_amount === expectedAmount &&
      p.currency === 'nok' &&
      p.metadata?.billingPeriod === billingPeriod &&
      p.metadata?.planSlug === slug,
  );
  if (match) {
    log(`    ↻ ${slug}/${billingPeriod}: bruker eksisterende ${match.id}`);
    return match;
  }
  const created = await stripeRequest(stripeKey, 'POST', '/prices', {
    product: productId,
    currency: 'nok',
    unit_amount: expectedAmount,
    recurring: { interval },
    metadata: {
      planSlug: slug,
      billingPeriod,
      vertical: 'dance',
    },
  });
  log(`    + ${slug}/${billingPeriod}: opprettet ${created.id} (${kr} NOK/${interval})`);
  return created;
}

async function updatePlanInDb(client, slug, monthlyPriceId, yearlyPriceId) {
  await client.query(
    `UPDATE dance_plan
     SET stripe_monthly_price_id = $2,
         stripe_yearly_price_id = $3,
         updated_at = now()
     WHERE slug = $1`,
    [slug, monthlyPriceId, yearlyPriceId],
  );
  log(`    ✓ DB: dance_plan[${slug}] oppdatert`);
}

(async () => {
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? await fetchEnvFromRender('STRIPE_SECRET_KEY');
  const databaseUrl = process.env.DATABASE_URL ?? await fetchEnvFromRender('DATABASE_URL');
  if (!stripeKey?.startsWith('sk_')) throw new Error('STRIPE_SECRET_KEY ser ugyldig ut');

  const liveMode = stripeKey.startsWith('sk_live_');
  log(`Stripe modus: ${liveMode ? 'LIVE' : 'TEST'}`);
  log(`Skal opprette/synke ${PLAN_DEFS.length} dance-products + ${PLAN_DEFS.length * 2} prices`);
  log('');

  const client = new PgClient({ connectionString: databaseUrl });
  await client.connect();

  try {
    for (const def of PLAN_DEFS) {
      log(`Plan: ${def.slug} — ${def.name}`);
      const product = await ensureProduct(stripeKey, def);
      const monthly = await ensurePrice(stripeKey, product.id, def.slug, 'monthly', def.monthlyKr);
      const yearly = await ensurePrice(stripeKey, product.id, def.slug, 'yearly', def.yearlyKr);
      await updatePlanInDb(client, def.slug, monthly.id, yearly.id);
      log('');
    }

    // Verifiser DB-state
    log('=== Verifisering ===');
    const { rows } = await client.query(
      `SELECT slug, name, monthly_price_kr, stripe_monthly_price_id, yearly_price_kr, stripe_yearly_price_id
       FROM dance_plan
       WHERE stripe_monthly_price_id IS NOT NULL OR stripe_yearly_price_id IS NOT NULL
       ORDER BY display_order`,
    );
    for (const r of rows) {
      log(`${r.slug}: ${r.stripe_monthly_price_id} (${r.monthly_price_kr}/mnd) · ${r.stripe_yearly_price_id} (${r.yearly_price_kr}/år)`);
    }
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
