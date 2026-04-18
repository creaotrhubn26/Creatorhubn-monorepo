#!/usr/bin/env node
/**
 * Playwright-driven setup of the Role Room **feed-planner addon tiers** in
 * Stripe. Provisioner Headliner og Showrunner som månedlige produkter slik
 * at salget følger samme oppskrift som The Role Room Agent base-addon.
 *
 * Skripted gjør:
 *   1. Åpner Chromium (headful) — du logger inn + 2FA én gang.
 *   2. Lagrer storage state slik at neste runs hopper over login.
 *   3. Oppretter to produkter: Role Room Headliner + Role Room Showrunner.
 *   4. Skriver ut price_-ID-ene som skal settes i Render env.
 *
 *   # første gang:
 *   npx playwright install chromium
 *   node backend/scripts/provision-role-room-feed-planner-tiers.playwright.mjs
 *
 *   # subsequent runs (storage state cached):
 *   STRIPE_MODE=test \
 *   HEADLINER_PRICE_NOK=199 SHOWRUNNER_PRICE_NOK=599 \
 *   node backend/scripts/provision-role-room-feed-planner-tiers.playwright.mjs
 *
 * Env du kan sette:
 *   STRIPE_MODE=test|live          default: test
 *   STRIPE_STORAGE_STATE=<path>    cookies+localStorage reuse mellom runs
 *   HEADLESS=1                     headless (krever eksisterende state)
 *   HEADLINER_PRICE_NOK=199        Headliner månedlig pris
 *   SHOWRUNNER_PRICE_NOK=599       Showrunner månedlig pris
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const STRIPE_MODE = process.env.STRIPE_MODE === 'live' ? 'live' : 'test';
const HEADLESS = process.env.HEADLESS === '1';
const STORAGE_STATE_PATH =
  process.env.STRIPE_STORAGE_STATE ||
  path.resolve(process.cwd(), '.stripe-playwright-state.json');

const HEADLINER_PRICE_NOK = process.env.HEADLINER_PRICE_NOK || '199';
const SHOWRUNNER_PRICE_NOK = process.env.SHOWRUNNER_PRICE_NOK || '599';

const PRODUCTS_NEW_URL =
  STRIPE_MODE === 'test'
    ? 'https://dashboard.stripe.com/test/products/create'
    : 'https://dashboard.stripe.com/products/create';
const DASHBOARD_URL =
  STRIPE_MODE === 'test'
    ? 'https://dashboard.stripe.com/test/dashboard'
    : 'https://dashboard.stripe.com/dashboard';

const TIERS = [
  {
    envVar: 'STRIPE_ROLE_ROOM_HEADLINER_PRICE_ID',
    name: 'Role Room Headliner',
    description:
      'Full tilgang til The Role Room feed-planner: Instagram, TikTok og LinkedIn. Ubegrensede AI-anbefalinger. Brand-tilpasset PDF.',
    priceNok: HEADLINER_PRICE_NOK,
  },
  {
    envVar: 'STRIPE_ROLE_ROOM_SHOWRUNNER_PRICE_ID',
    name: 'Role Room Showrunner',
    description:
      'Enterprise-tilgang for team. Inkluderer alt i Headliner pluss flerbruker-prosjekter, hvitmerket PDF, bulk-anbefaling og prioritert AI-modell.',
    priceNok: SHOWRUNNER_PRICE_NOK,
  },
];

async function loadStorageState() {
  try {
    await fs.access(STORAGE_STATE_PATH);
    console.log(`Reusing login session from ${STORAGE_STATE_PATH}`);
    return STORAGE_STATE_PATH;
  } catch {
    return undefined;
  }
}

async function waitForLoginOrTimeout(page, maxSeconds = 300) {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (url.includes('/dashboard') && !url.includes('/login')) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}

async function provisionTier(page, tier) {
  console.log(`\n— ${tier.name} (NOK ${tier.priceNok}/mnd) —`);
  await page.goto(PRODUCTS_NEW_URL, { waitUntil: 'domcontentloaded' });

  const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
  await nameInput.waitFor({ timeout: 20_000 });
  await nameInput.fill(tier.name);

  const descInput = page
    .locator('textarea[name="description"], textarea[placeholder*="description" i]')
    .first();
  if (await descInput.count()) {
    await descInput.fill(tier.description);
  }

  const amountInput = page
    .locator('input[name="amount"], input[placeholder="0.00"], input[aria-label*="price" i]')
    .first();
  await amountInput.waitFor({ timeout: 20_000 });
  await amountInput.fill(String(tier.priceNok));

  // Currency — switch to NOK if not already.
  const currencyCombo = page.locator('button:has-text("USD"), button:has-text("NOK")').first();
  if (await currencyCombo.count()) {
    const currentText = (await currencyCombo.textContent())?.trim().toUpperCase();
    if (currentText && currentText !== 'NOK') {
      await currencyCombo.click();
      const nokOption = page.getByRole('option', { name: /NOK|Norwegian Krone/i }).first();
      if (await nokOption.count()) await nokOption.click();
    }
  }

  // Recurring + monthly.
  const recurringRadio = page.getByRole('radio', { name: /recurring/i }).first();
  if ((await recurringRadio.count()) && !(await recurringRadio.isChecked())) {
    await recurringRadio.check();
  }
  const intervalButton = page.getByRole('button', { name: /monthly|month|hver måned/i }).first();
  if (
    (await intervalButton.count()) &&
    !((await intervalButton.getAttribute('aria-pressed')) || '').includes('true')
  ) {
    await intervalButton.click();
  }

  // MVA: prisen vi viser i appen er eks. mva ("99 kr/mnd + mva"), så Stripe
  // skal IKKE merke prisen som "Includes tax". Stripe Tax legger 25% norsk
  // mva på toppen ved checkout. Vi forsikrer eksplisitt at "Includes tax"
  // er av — uavhengig av evt. defaults i workspacet.
  try {
    const includeTaxCheckbox = page
      .getByRole('checkbox', { name: /includes tax|inkl(udert)?\.? *mva|tax included/i })
      .first();
    if (await includeTaxCheckbox.count()) {
      if (await includeTaxCheckbox.isChecked()) await includeTaxCheckbox.uncheck();
    } else {
      const taxBehaviorButton = page
        .getByRole('button', { name: /tax behavior|skatteatferd/i })
        .first();
      if (await taxBehaviorButton.count()) {
        await taxBehaviorButton.click();
        const exclusiveOption = page
          .getByRole('option', { name: /excludes tax|exclusive|kommer i tillegg/i })
          .first();
        if (await exclusiveOption.count()) await exclusiveOption.click();
      } else {
        console.log('  ⚠  Fant ikke tax-behavior-felt — verifiser at "Includes tax" er AV på prisen.');
      }
    }
  } catch (taxError) {
    console.log('  ⚠  Kunne ikke sette tax_behavior=exclusive: ', taxError?.message ?? taxError);
  }

  console.log(`  → Submitting ${tier.name}...`);
  const submitButton = page
    .getByRole('button', { name: /save product|add product|opprett/i })
    .first();
  await submitButton.click();

  await page.waitForURL(/prod_[a-zA-Z0-9]+/i, { timeout: 30_000 });
  const productUrl = page.url();
  const productId = productUrl.match(/prod_[a-zA-Z0-9]+/i)?.[0];
  console.log(`  ✓ Product: ${productId ?? '<unknown>'}`);

  await page.waitForLoadState('networkidle').catch(() => undefined);
  const priceNodes = await page.locator('text=/price_[a-zA-Z0-9]+/').allTextContents();
  const priceId = priceNodes
    .map((raw) => raw.match(/price_[a-zA-Z0-9]+/)?.[0])
    .find((value) => Boolean(value));
  if (priceId) {
    console.log(`  ✓ Price: ${priceId}`);
  } else {
    console.log('  ⚠  Klarte ikke hente price_id — kopier manuelt fra dashboardet.');
  }
  return { ...tier, productId, priceId };
}

(async () => {
  console.log(`Role Room feed-planner tiers — Stripe ${STRIPE_MODE.toUpperCase()}`);
  console.log(HEADLESS ? '(headless — krever eksisterende storage state)' : '(headful — chromium åpnes)');
  console.log('---');

  const storageState = await loadStorageState();
  const browser = await chromium.launch({ headless: HEADLESS, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    storageState,
    locale: 'nb-NO',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const results = [];
  try {
    console.log('Åpner Stripe dashboard — logg inn manuelt om nødvendig.');
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    if (!storageState && !HEADLESS) {
      console.log('Venter på login + 2FA (opp til 5 minutter)...');
      const ok = await waitForLoginOrTimeout(page);
      if (!ok) throw new Error('Login timed out.');
      console.log('Login registrert. Lagrer session så neste run hopper over.');
      await context.storageState({ path: STORAGE_STATE_PATH });
    }

    for (const tier of TIERS) {
      try {
        results.push(await provisionTier(page, tier));
      } catch (error) {
        console.error(`  ✗ ${tier.name} feilet:`, error?.message ?? error);
        results.push({ ...tier, error: error?.message ?? String(error) });
      }
    }

    console.log('\n========================================================');
    console.log(' Ferdig. Sett disse i Render → backend env:');
    console.log('');
    for (const result of results) {
      if (result.priceId) {
        console.log(`   ${result.envVar}=${result.priceId}`);
      } else {
        console.log(`   # ${result.envVar} — IKKE FUNNET (sjekk dashboardet)`);
      }
    }
    console.log('========================================================');

    if (!HEADLESS) {
      console.log('Lar vinduet stå åpent i 30 s så du kan verifisere...');
      await page.waitForTimeout(30_000);
    }
  } catch (error) {
    console.error('Skript hadde en feil:', error?.message ?? error);
    console.error('Browseren forblir åpen så du kan fullføre manuelt.');
    if (!HEADLESS) await page.waitForTimeout(120_000);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
