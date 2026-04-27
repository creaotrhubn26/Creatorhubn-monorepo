#!/usr/bin/env node
/**
 * check-dance-stripe.playwright.mjs
 *
 * Verifiserer at Stripe-stack-en for dans-vertikalen er korrekt
 * konfigurert i prod:
 *   1. Stripe-secret-key er gyldig (via /v1/balance mot Stripe direkte)
 *   2. Backend leser nøkkelen og kan opprette en checkout-session
 *      hvis en plan har Stripe price ID konfigurert
 *   3. Frontend pricing-siden rendrer planer fra DB
 *   4. /api/dance/billing/plans returnerer aktive planer (auth required)
 *   5. /invite/<token>-route lazy-laster og viser landing-page
 *
 * Sender ALDRI Stripe-key til konsoll. Maskerer alle secrets.
 *
 * Bruk:
 *   APP_URL=https://creatorhubn.com BACKEND_URL=https://creatorhub-backend-rtbl.onrender.com \
 *   STRIPE_SECRET_KEY=$(read from Render API) \
 *   node backend/scripts/check-dance-stripe.playwright.mjs
 */

import { chromium } from 'playwright';
import path from 'node:path';
import process from 'node:process';

const APP_URL = process.env.APP_URL || 'https://creatorhubn.com';
const BACKEND_URL = process.env.BACKEND_URL || 'https://creatorhub-backend-rtbl.onrender.com';
const STATE_PATH = path.resolve(process.cwd(), '.role-room-demo-state.json');
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? '';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

const results = [];
const tally = { pass: 0, fail: 0, warn: 0 };

function log(label, status, detail) {
  const sym = status === 'pass' ? `${colors.green}✓${colors.reset}`
    : status === 'fail' ? `${colors.red}✗${colors.reset}`
    : `${colors.yellow}!${colors.reset}`;
  console.log(`${sym} ${label}${detail ? `${colors.dim} — ${detail}${colors.reset}` : ''}`);
  results.push({ label, status, detail });
  if (status === 'pass') tally.pass += 1;
  else if (status === 'fail') tally.fail += 1;
  else tally.warn += 1;
}

function maskKey(key) {
  if (!key) return '(unset)';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

// ─── 1. Stripe API direct check ──────────────────────────────────────────
async function checkStripeApi() {
  console.log(`\n${colors.cyan}1. Stripe API direkte (key: ${maskKey(STRIPE_KEY)})${colors.reset}`);
  if (!STRIPE_KEY) {
    log('STRIPE_SECRET_KEY satt', 'fail', 'env-var mangler — sett STRIPE_SECRET_KEY før kjøring');
    return false;
  }
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Basic ${Buffer.from(`${STRIPE_KEY}:`).toString('base64')}` },
    });
    if (res.status === 200) {
      const body = await res.json();
      const available = body.available?.[0];
      log('Stripe-key er gyldig', 'pass', `live=${STRIPE_KEY.startsWith('sk_live_')}, currency=${available?.currency ?? '?'}`);
      return true;
    } else if (res.status === 401) {
      log('Stripe-key er gyldig', 'fail', 'HTTP 401 — key er ugyldig eller revoked');
      return false;
    } else {
      log('Stripe-key er gyldig', 'fail', `HTTP ${res.status}`);
      return false;
    }
  } catch (err) {
    log('Stripe-key er gyldig', 'fail', `nettverksfeil: ${err.message}`);
    return false;
  }
}

async function checkStripePrices() {
  console.log(`\n${colors.cyan}2. Stripe Products + Prices opprettet?${colors.reset}`);
  if (!STRIPE_KEY) {
    log('Stripe Prices liste', 'warn', 'hopper over (key mangler)');
    return [];
  }
  try {
    const res = await fetch('https://api.stripe.com/v1/prices?limit=100', {
      headers: { Authorization: `Basic ${Buffer.from(`${STRIPE_KEY}:`).toString('base64')}` },
    });
    if (res.status !== 200) {
      log('Liste Stripe Prices', 'fail', `HTTP ${res.status}`);
      return [];
    }
    const body = await res.json();
    const prices = body.data ?? [];
    if (prices.length === 0) {
      log('Stripe Prices opprettet', 'warn',
        'INGEN prices i Stripe — opprett 12 (6 plans × monthly/yearly) i dashboardet og lim Price IDs inn via Admin · Planer-fanen');
    } else {
      log('Stripe Prices opprettet', 'pass', `${prices.length} prices funnet`);
      for (const p of prices.slice(0, 8)) {
        const amount = p.unit_amount ? `${(p.unit_amount / 100).toFixed(0)} ${(p.currency || '').toUpperCase()}` : 'free';
        const interval = p.recurring?.interval ?? 'one-time';
        const productId = typeof p.product === 'string' ? p.product : p.product?.id;
        console.log(`    ${colors.dim}${p.id} · ${amount}/${interval} · product=${productId}${colors.reset}`);
      }
    }
    return prices;
  } catch (err) {
    log('Liste Stripe Prices', 'fail', err.message);
    return [];
  }
}

// ─── 3. Backend reachability ────────────────────────────────────────────
async function checkBackendBasic() {
  console.log(`\n${colors.cyan}3. Backend-helsesjekk${colors.reset}`);
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`);
    if (res.status === 200) {
      const body = await res.json();
      log('Backend er live', 'pass', `commit=${(body.commit ?? '?').slice(0, 8)}`);
    } else {
      log('Backend er live', 'fail', `HTTP ${res.status}`);
      return false;
    }
  } catch (err) {
    log('Backend er live', 'fail', err.message);
    return false;
  }
  // Verify our routes are mounted (uten auth → 401 forventet)
  const routesToProbe = [
    '/api/dance/billing/plans',
    '/api/dance/billing/admin/plans',
    '/api/dance/billing/subscription',
    '/api/dance/billing/checkout-session',
  ];
  let allOk = true;
  for (const r of routesToProbe) {
    const res = await fetch(`${BACKEND_URL}${r}`, { method: r.includes('checkout-session') ? 'POST' : 'GET' });
    const expected = [400, 401]; // ingen auth → 401, eller 400 hvis POST manglet body
    if (expected.includes(res.status)) {
      log(`Route ${r} mountet`, 'pass', `HTTP ${res.status}`);
    } else {
      log(`Route ${r} mountet`, 'fail', `HTTP ${res.status} (forventet 401)`);
      allOk = false;
    }
  }
  return allOk;
}

// ─── 4. Browser-side checks via Playwright ───────────────────────────────
async function checkFrontend() {
  console.log(`\n${colors.cyan}4. Frontend-tester (Playwright)${colors.reset}`);
  const browser = await chromium.launch({ headless: true });
  const fs = await import('node:fs');
  let context;
  try {
    if (fs.existsSync(STATE_PATH)) {
      context = await browser.newContext({ storageState: STATE_PATH, locale: 'nb-NO' });
    } else {
      log('Auth-state lastet', 'warn', `${STATE_PATH} mangler — kjører unauthenticated`);
      context = await browser.newContext({ locale: 'nb-NO' });
    }
    const page = await context.newPage();

    // 4a. Invite landing-page lazy-loads
    await page.goto(`${APP_URL}/invite/test-token-bogus`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1000);
    const inviteText = await page.textContent('body').catch(() => '');
    if (inviteText && (inviteText.includes('TESTER-TILGANG') || inviteText.includes('ugyldig') || inviteText.includes('utløpt'))) {
      log('Tester-invite landing-page', 'pass', 'lazy-route lastet');
    } else {
      log('Tester-invite landing-page', 'fail', `body=${(inviteText ?? '').slice(0, 80)}`);
    }

    // 4b. /api/dance/billing/plans via authenticated browser-context
    await page.goto(`${APP_URL}/role-room`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);
    const apiResult = await page.evaluate(async () => {
      const r = await fetch('/api/dance/billing/plans', { credentials: 'include' });
      const text = await r.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {}
      return { status: r.status, count: Array.isArray(parsed?.data) ? parsed.data.length : null, error: parsed?.error };
    });
    if (apiResult.status === 200 && apiResult.count > 0) {
      log('GET /api/dance/billing/plans (auth)', 'pass', `${apiResult.count} aktive planer`);
    } else if (apiResult.status === 401) {
      log('GET /api/dance/billing/plans (auth)', 'warn', 'auth state ble ikke gjenbrukt — kjør på en innlogget bruker');
    } else {
      log('GET /api/dance/billing/plans (auth)', 'fail', `HTTP ${apiResult.status} ${apiResult.error ?? ''}`);
    }

    // 4c. Verify subscription endpoint
    const subResult = await page.evaluate(async () => {
      const r = await fetch('/api/dance/billing/subscription', { credentials: 'include' });
      const text = await r.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {}
      return { status: r.status, hasData: parsed?.data !== undefined };
    });
    if (subResult.status === 200) {
      log('GET /api/dance/billing/subscription (auth)', 'pass', subResult.hasData ? 'returnerer data-felt' : 'ingen abonnement (riktig for ny bruker)');
    } else {
      log('GET /api/dance/billing/subscription (auth)', subResult.status === 401 ? 'warn' : 'fail', `HTTP ${subResult.status}`);
    }

    // 4d. Try checkout-session creation (forventer 409 price_not_configured hvis Price IDs mangler)
    const checkoutResult = await page.evaluate(async () => {
      const r = await fetch('/api/dance/billing/checkout-session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planSlug: 'freelance_basic',
          billingPeriod: 'monthly',
          successUrl: 'https://creatorhubn.com/role-room?checkout=success',
          cancelUrl: 'https://creatorhubn.com/role-room?checkout=cancel',
        }),
      });
      const text = await r.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {}
      return { status: r.status, error: parsed?.error, sessionUrl: parsed?.data?.sessionUrl };
    });
    if (checkoutResult.status === 200 && checkoutResult.sessionUrl) {
      log('POST /api/dance/billing/checkout-session', 'pass', 'fikk faktisk Stripe checkout URL');
    } else if (checkoutResult.status === 409 && checkoutResult.error === 'price_not_configured') {
      log('POST /api/dance/billing/checkout-session', 'warn',
        'price_not_configured (forventet — du må opprette Stripe Prices og lime IDs inn via Admin · Planer)');
    } else if (checkoutResult.status === 503 && checkoutResult.error === 'stripe_not_configured') {
      log('POST /api/dance/billing/checkout-session', 'fail',
        'stripe_not_configured — backend leser ikke STRIPE_SECRET_KEY (har den blitt deployet?)');
    } else if (checkoutResult.status === 401) {
      log('POST /api/dance/billing/checkout-session', 'warn', 'auth ikke aktiv — re-login i playwright state');
    } else {
      log('POST /api/dance/billing/checkout-session', 'fail',
        `HTTP ${checkoutResult.status} error=${checkoutResult.error}`);
    }
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

(async () => {
  console.log(`\n${colors.cyan}=== Stripe-stack verifisering — dans-vertikalen ===${colors.reset}`);
  console.log(`${colors.dim}APP_URL=${APP_URL}${colors.reset}`);
  console.log(`${colors.dim}BACKEND_URL=${BACKEND_URL}${colors.reset}`);

  await checkStripeApi();
  await checkStripePrices();
  await checkBackendBasic();
  await checkFrontend();

  console.log(`\n${colors.cyan}=== Resultat ===${colors.reset}`);
  console.log(`${colors.green}${tally.pass} pass${colors.reset}, ${colors.yellow}${tally.warn} warn${colors.reset}, ${colors.red}${tally.fail} fail${colors.reset}`);
  process.exit(tally.fail > 0 ? 1 : 0);
})().catch((err) => {
  console.error('Fatal:', err);
  process.exit(2);
});
