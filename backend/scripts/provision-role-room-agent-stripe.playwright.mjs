#!/usr/bin/env node
/**
 * Playwright-driven setup of the Role Room Agent product in Stripe TEST mode.
 *
 * Opens a real Chromium window so YOU can handle the login + 2FA.
 * Once you're on the dashboard, the script fills in the product form
 * programmatically, creates the NOK 99/mo recurring price, and prints
 * the resulting `price_...` id.
 *
 * This is intentionally forgiving: if Stripe has redesigned the UI in
 * a way that breaks the selectors, the script pauses and tells you what
 * it was trying to do so you can finish manually.
 *
 *   # from repo root (playwright is hoisted to the root node_modules):
 *   node backend/scripts/provision-role-room-agent-stripe.playwright.mjs
 *
 * First time only — install the Chromium binary:
 *   npx playwright install chromium
 *
 * Env you can set:
 *   STRIPE_MODE=test|live          default: test
 *   STRIPE_STORAGE_STATE=<path>    cookies+localStorage reuse between runs
 *   HEADLESS=1                     run headless (advanced; skips login pause)
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const STRIPE_MODE = process.env.STRIPE_MODE === 'live' ? 'live' : 'test';
const HEADLESS = process.env.HEADLESS === '1';
const STORAGE_STATE_PATH = process.env.STRIPE_STORAGE_STATE
  || path.resolve(process.cwd(), '.stripe-playwright-state.json');

const PRODUCTS_NEW_URL =
  STRIPE_MODE === 'test'
    ? 'https://dashboard.stripe.com/test/products/create'
    : 'https://dashboard.stripe.com/products/create';

const DASHBOARD_URL =
  STRIPE_MODE === 'test'
    ? 'https://dashboard.stripe.com/test/dashboard'
    : 'https://dashboard.stripe.com/dashboard';

const PRODUCT_NAME = 'The Role Room Agent';
const PRODUCT_DESCRIPTION =
  'AI-assistent for The Role Room. 99 kr/mnd. Kan sies opp når som helst.';
const PRICE_AMOUNT_NOK = '99';
const PRICE_CURRENCY = 'NOK';

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
  // Consider login "done" when we land on a URL that starts with
  // /test/dashboard or /dashboard AND the page body mentions the account
  // name. We give 5 minutes — enough for 2FA.
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (url.includes('/dashboard') && !url.includes('/login')) {
      return true;
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

(async () => {
  console.log(`Role Room Agent — Stripe ${STRIPE_MODE.toUpperCase()} provisioning via Playwright`);
  console.log(HEADLESS ? '(headless — requires existing storage state)' : '(headful — a browser window will open)');
  console.log('---');

  const storageState = await loadStorageState();

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    storageState,
    locale: 'nb-NO',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    console.log('Opening Stripe dashboard — log in manually if prompted.');
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });

    if (!storageState && !HEADLESS) {
      console.log('Waiting for you to finish login + 2FA (up to 5 minutes)...');
      const ok = await waitForLoginOrTimeout(page);
      if (!ok) throw new Error('Login timed out.');
      console.log('Login detected. Saving session state so next run skips this step.');
      await context.storageState({ path: STORAGE_STATE_PATH });
    }

    // ── Create product ────────────────────────────────────────
    console.log('Navigating to "create product"...');
    await page.goto(PRODUCTS_NEW_URL, { waitUntil: 'domcontentloaded' });

    // Stripe's product form uses an `input[name="name"]` (stable for years).
    // We try several selectors so minor DOM tweaks don't break the run.
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    await nameInput.waitFor({ timeout: 20_000 });
    await nameInput.fill(PRODUCT_NAME);

    const descInput = page
      .locator('textarea[name="description"], textarea[placeholder*="description" i]')
      .first();
    if (await descInput.count()) {
      await descInput.fill(PRODUCT_DESCRIPTION);
    }

    // Pricing section — amount field is typically an input with a currency
    // symbol. We enter 99; Stripe normalizes to 99.00.
    const amountInput = page
      .locator('input[name="amount"], input[placeholder="0.00"], input[aria-label*="price" i]')
      .first();
    await amountInput.waitFor({ timeout: 20_000 });
    await amountInput.fill(PRICE_AMOUNT_NOK);

    // Currency picker — may be a combobox or a fixed dropdown.
    const currencyCombo = page.locator('button:has-text("USD"), button:has-text("NOK")').first();
    if (await currencyCombo.count()) {
      const currentText = (await currencyCombo.textContent())?.trim().toUpperCase();
      if (currentText && currentText !== PRICE_CURRENCY) {
        await currencyCombo.click();
        const nokOption = page
          .getByRole('option', { name: /NOK|Norwegian Krone/i })
          .first();
        if (await nokOption.count()) {
          await nokOption.click();
        }
      }
    }

    // Recurring toggle — Stripe defaults to recurring for SaaS; this is a
    // belt-and-suspenders selector in case it flips.
    const recurringRadio = page.getByRole('radio', { name: /recurring/i }).first();
    if (await recurringRadio.count()) {
      if (!(await recurringRadio.isChecked())) {
        await recurringRadio.check();
      }
    }

    // Interval — must be Monthly.
    const intervalButton = page.getByRole('button', { name: /monthly|month|hver måned/i }).first();
    if (await intervalButton.count() && !(await intervalButton.getAttribute('aria-pressed'))?.includes('true')) {
      await intervalButton.click();
    }

    // Submit.
    console.log('Submitting new product...');
    const submitButton = page
      .getByRole('button', { name: /save product|add product|opprett/i })
      .first();
    await submitButton.click();

    // Wait for navigation to the product detail page; URL contains /prod_.
    await page.waitForURL(/prod_[a-zA-Z0-9]+/i, { timeout: 30_000 });
    const productUrl = page.url();
    const productId = productUrl.match(/prod_[a-zA-Z0-9]+/i)?.[0];
    console.log(`✓ Product created: ${productId ?? '<unknown id>'}`);

    // Grab the first price id visible on the detail page.
    // Prices appear as rows with `price_...` anchors. Fall back to a
    // metadata block search if the table changes.
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const priceNodes = await page.locator('text=/price_[a-zA-Z0-9]+/').allTextContents();
    const priceId = priceNodes
      .map((raw) => raw.match(/price_[a-zA-Z0-9]+/)?.[0])
      .find((value) => Boolean(value));

    if (priceId) {
      console.log(`✓ Recurring price: ${priceId}`);
      console.log('');
      console.log('========================================================');
      console.log(' Done. Paste this into Render → backend env:');
      console.log('');
      console.log(`   STRIPE_ROLE_ROOM_AGENT_PRICE_ID=${priceId}`);
      console.log('========================================================');
    } else {
      console.log('⚠  Couldn\'t auto-extract the price id. Copy it from the dashboard manually.');
    }

    // Keep the browser open for 20 s so you can eyeball the result.
    if (!HEADLESS) {
      console.log('Leaving window open for 20 s so you can verify...');
      await page.waitForTimeout(20_000);
    }
  } catch (error) {
    console.error('Script hit an issue:', error?.message ?? error);
    console.error('The browser stays open so you can finish manually.');
    if (!HEADLESS) await page.waitForTimeout(120_000);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
