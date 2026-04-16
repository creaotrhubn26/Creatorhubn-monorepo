#!/usr/bin/env node
/**
 * End-to-end walkthrough of the Role Room Agent add-on purchase.
 *
 * Opens a real browser. You log in once, the script does everything
 * else — navigates to Role Room, opens the Agent tab, clicks through
 * the paywall, pays with 4242 4242 4242 4242 on Stripe Checkout, and
 * verifies the redirect + that the paywall is gone.
 *
 *   node backend/scripts/test-role-room-agent-purchase.playwright.mjs
 *
 * Env:
 *   APP_URL                   base URL (default https://theroleroom.com)
 *   ROLE_ROOM_PROJECT_ID      optional — jump straight to a known project
 *   STATE_FILE                storage-state JSON path for login reuse
 *                             (default .agent-purchase-state.json)
 *   HEADLESS=1                run headless (requires existing state)
 *   CARD_NUMBER               default 4242 4242 4242 4242
 *   CARD_EXPIRY               default 12 / 34
 *   CARD_CVC                  default 123
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP_URL = process.env.APP_URL ?? 'https://theroleroom.com';
const ROLE_ROOM_PROJECT_ID = process.env.ROLE_ROOM_PROJECT_ID ?? null;
const HEADLESS = process.env.HEADLESS === '1';
const STATE_PATH = process.env.STATE_FILE
  ?? path.resolve(process.cwd(), '.agent-purchase-state.json');

const CARD_NUMBER = process.env.CARD_NUMBER ?? '4242 4242 4242 4242';
const CARD_EXPIRY = process.env.CARD_EXPIRY ?? '12 / 34';
const CARD_CVC = process.env.CARD_CVC ?? '123';

const LOGIN_WAIT_SECONDS = 600; // 10 minutes — long enough for 2FA + password manager

function log(msg) {
  console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`);
}

async function hasStorageState() {
  try {
    await fs.access(STATE_PATH);
    return true;
  } catch {
    return false;
  }
}

async function waitForLogin(page) {
  // "Logged in" = we landed on a real app path. Check by pathname so the
  // hostname (theroleroom.com) doesn't accidentally match string-includes.
  // We also require a logged-in-only DOM element so we don't treat a mid-
  // redirect landing as success.
  log(`Waiting up to ${LOGIN_WAIT_SECONDS}s for you to log in...`);
  const deadline = Date.now() + LOGIN_WAIT_SECONDS * 1000;
  while (Date.now() < deadline) {
    const pathname = new URL(page.url()).pathname;
    const isAppPath =
      pathname.startsWith('/dashboard')
      || pathname.startsWith('/role-room')
      || pathname.startsWith('/smart-dashboard')
      || pathname.startsWith('/universal-dashboard');
    if (isAppPath) {
      // Secondary signal: wait briefly for SOMETHING that only exists when
      // the user is actually signed in — the main MUI AppBar or a tab
      // labelled "The Role Room".
      const hasAppShell =
        (await page.getByRole('tab', { name: /The Role Room/i }).count()) > 0
        || (await page.locator('[data-testid="universal-dashboard"], header.MuiAppBar-root').count()) > 0;
      if (hasAppShell) return true;
    }
    await page.waitForTimeout(1500);
  }
  return false;
}

async function clickAgentTab(page) {
  // Role Room's subtabs render as MUI Tabs; Agent has label "Agent".
  // Scroll it into view first — the subtab strip is horizontally scrollable.
  log('Looking for Agent subtab...');
  const tab = page.getByRole('tab', { name: /^Agent$/i }).first();
  try {
    await tab.waitFor({ timeout: 15_000 });
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
    log('Clicked Agent subtab.');
  } catch (error) {
    // Dump visible tab names so we can diagnose naming drift.
    const names = await page.getByRole('tab').allTextContents();
    log(`Visible tabs: ${JSON.stringify(names)}`);
    throw error;
  }
}

async function openRoleRoomPanel(page) {
  // The Role Room lives as a top-level tab inside UniversalDashboard at
  // /dashboard. The tab is rendered with an img icon + label text
  // "The Role Room", so we target by text.
  log('Opening The Role Room tab...');
  await page.goto(`${APP_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

  // Try several selectors in order of specificity.
  const candidates = [
    page.getByRole('tab', { name: /The Role Room/i }).first(),
    page.getByRole('button', { name: /The Role Room/i }).first(),
    page.locator('[role="tab"]:has-text("The Role Room")').first(),
    page.locator('[role="tab"] img[alt="Role Room"]').first(),
  ];
  let clicked = false;
  for (const locator of candidates) {
    if ((await locator.count()) > 0) {
      try {
        await locator.scrollIntoViewIfNeeded();
        await locator.click();
        clicked = true;
        break;
      } catch {
        /* try next */
      }
    }
  }
  if (!clicked) {
    const names = await page.getByRole('tab').allTextContents();
    throw new Error(
      `Could not find The Role Room tab. Visible tabs: ${JSON.stringify(names)}`,
    );
  }
  log('Clicked The Role Room tab.');

  // Pick the first project. Project list items are usually buttons /
  // list items with a project name and a status chip. Try a few patterns.
  if (!ROLE_ROOM_PROJECT_ID) {
    log('Selecting first project in the list...');
    // Wait for the project list to appear.
    await page.waitForTimeout(1000);
    const projectCandidates = [
      page.locator('[role="listitem"] button').first(),
      page.locator('ul [role="button"]').first(),
      page.locator('.MuiListItemButton-root').first(),
    ];
    let projectClicked = false;
    for (const locator of projectCandidates) {
      if ((await locator.count()) > 0) {
        try {
          await locator.click();
          projectClicked = true;
          break;
        } catch {
          /* try next */
        }
      }
    }
    if (!projectClicked) {
      log('No project list item found — assuming the first project is already selected.');
    }
  }
}

async function payOnStripe(page) {
  // Stripe Checkout runs in its own page. We identify it by hostname.
  log('Waiting for Stripe Checkout page to load...');
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  log(`Stripe Checkout: ${page.url()}`);

  // Stripe's card-number input uses role=textbox with accessible name
  // "Card number". The other fields follow.
  const card = page.getByRole('textbox', { name: /card number/i }).first();
  await card.waitFor({ timeout: 20_000 });
  await card.fill(CARD_NUMBER);

  const expiry = page.getByRole('textbox', { name: /expiration|expiry/i }).first();
  await expiry.fill(CARD_EXPIRY.replace(/\s/g, ''));

  const cvc = page.getByRole('textbox', { name: /cvc|security code/i }).first();
  await cvc.fill(CARD_CVC);

  // Stripe Checkout usually auto-fills the cardholder name from Stripe account
  // if signed in, but we set a fallback if the field is empty.
  const name = page.getByRole('textbox', { name: /name on card/i }).first();
  if (await name.count()) {
    const currentName = await name.inputValue();
    if (!currentName) await name.fill('Role Room Agent Test');
  }

  // Norwegian flows sometimes ask for postal code.
  const postal = page.getByRole('textbox', { name: /postal|zip/i }).first();
  if (await postal.count()) {
    const currentPostal = await postal.inputValue();
    if (!currentPostal) await postal.fill('0150');
  }

  // Submit — button text is localized.
  const submit = page
    .getByRole('button', { name: /subscribe|pay|abonner|betal/i })
    .first();
  log('Submitting payment...');
  await submit.click();

  // Wait for redirect back to our success URL.
  log('Waiting for redirect back to the app...');
  await page.waitForURL(
    (url) => !String(url).includes('checkout.stripe.com'),
    { timeout: 60_000 },
  );
  log(`Redirected to: ${page.url()}`);
}

async function verifyEntitlementActive(page) {
  // Navigate back to Role Room → Agent tab and check that the paywall
  // dialog is NOT visible, and the chat composer IS visible.
  log('Re-opening Agent tab to verify paywall is gone...');
  await openRoleRoomPanel(page);
  await clickAgentTab(page);

  const paywallTitle = page.getByRole('heading', { name: /The Role Room Agent/i }).first();
  const composer = page.getByPlaceholder(/Spør The Role Room Agent/i).first();

  // The paywall uses a Dialog with the product name; if it's present and
  // there's a "Legg til for" CTA, we know we're still blocked.
  const addonCta = page.getByRole('button', { name: /Legg til for/i }).first();
  const isBlocked = (await addonCta.count()) > 0;
  if (isBlocked) {
    throw new Error('Paywall still showing "Legg til for" — entitlement did not activate.');
  }

  await composer.waitFor({ timeout: 20_000 });
  log('Composer visible — entitlement is active.');
}

(async () => {
  log(`E2E purchase test → ${APP_URL}`);
  log(`Headless: ${HEADLESS ? 'yes' : 'no'}`);

  const storageState = (await hasStorageState()) ? STATE_PATH : undefined;
  if (storageState) log(`Using saved login state from ${STATE_PATH}`);

  const browser = await chromium.launch({ headless: HEADLESS, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    storageState,
    locale: 'nb-NO',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    // Start at /dashboard so unauthenticated visits get redirected to login,
    // and authenticated visits land directly inside the app.
    await page.goto(`${APP_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

    if (!storageState && !HEADLESS) {
      log('Log in as a NON-admin test user in the browser window.');
      log('The script is waiting for the dashboard shell to appear — do NOT close the window.');
      const ok = await waitForLogin(page);
      if (!ok) {
        throw new Error(
          `Login not detected within ${LOGIN_WAIT_SECONDS}s. Final URL: ${page.url()}`,
        );
      }
      log('Dashboard shell detected — saving storage state for next run.');
      await context.storageState({ path: STATE_PATH });
    }

    log('Opening Role Room + Agent tab...');
    await openRoleRoomPanel(page);
    await clickAgentTab(page);

    // Expect paywall. Click "Legg til for 99 kr/mnd".
    const addonBtn = page.getByRole('button', { name: /Legg til for/i }).first();
    await addonBtn.waitFor({ timeout: 20_000 });
    log('Paywall visible — clicking "Kjøp add-on" / "Legg til"...');
    await addonBtn.click();

    await payOnStripe(page);
    // Small grace period so the webhook has a chance to land and update DB.
    log('Waiting 5s for webhook + entitlement write...');
    await page.waitForTimeout(5000);

    await verifyEntitlementActive(page);

    log('');
    log('=========================================');
    log(' ✓ Purchase flow completed successfully. ');
    log('=========================================');
    if (!HEADLESS) {
      log('Leaving browser open for 30 s so you can inspect.');
      await page.waitForTimeout(30_000);
    }
  } catch (error) {
    log('');
    log(`FAILED: ${error?.message ?? error}`);
    log(`Current URL: ${page.url()}`);
    log('Screenshot saved to agent-purchase-failure.png');
    await page.screenshot({ path: 'agent-purchase-failure.png', fullPage: true }).catch(() => {});
    if (!HEADLESS) {
      log('Leaving browser open for 2 min so you can debug manually.');
      await page.waitForTimeout(120_000);
    }
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
