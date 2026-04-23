#!/usr/bin/env node
/**
 * Guided Playwright flow for creating a Meta Business Manager ad
 * account + capturing its id. Uses the saved Meta login state from
 * setup-meta-app.playwright.mjs, deep-links to the Ad Accounts
 * settings page, attempts to open the "Create New Ad Account" dialog,
 * pre-fills common fields, then pauses so you can step through the
 * remaining manual parts (ownership, timezone/currency confirmation,
 * assignment). Once you finish, the script watches for the account
 * ID to appear in the URL / DOM and prints it so the ads-attribution
 * demo can use it.
 */

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const STATE_PATH = path.resolve(
  process.cwd(),
  process.env.META_STATE_FILE || '.meta-playwright-state.json',
);
const AD_ACCOUNT_NAME = process.env.AD_ACCOUNT_NAME || 'CreatorHub One Demo';
const TIMEZONE = process.env.AD_ACCOUNT_TIMEZONE || 'Europe/Oslo';
const CURRENCY = process.env.AD_ACCOUNT_CURRENCY || 'NOK';
const BUSINESS_ID = process.env.META_BUSINESS_ID || '';

function log(msg) {
  console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`);
}

async function loadStorage() {
  try { await fs.access(STATE_PATH); return STATE_PATH; }
  catch { return undefined; }
}

async function waitForLogin(page, maxSeconds = 600) {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    const url = page.url();
    if (/business\.facebook\.com|developers\.facebook\.com/.test(url) && !url.includes('/login')) {
      return true;
    }
    await page.waitForTimeout(2000);
  }
  return false;
}

(async () => {
  log(`Ad account name:   ${AD_ACCOUNT_NAME}`);
  log(`Timezone:          ${TIMEZONE}`);
  log(`Currency:          ${CURRENCY}`);
  log(`Business ID (opt): ${BUSINESS_ID || '(will auto-detect from Business Manager UI)'}`);

  const storageState = await loadStorage();
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    storageState,
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    // Meta migrated Business Settings to /latest/settings/ad_accounts in
    // 2024. The old /settings/ad-accounts still redirects but sometimes
    // with a disabled Create button. Go straight to the new URL.
    const businessId = BUSINESS_ID || '1277107697134153'; // auto-detected from prior run
    const targetUrl = `https://business.facebook.com/latest/settings/ad_accounts/?business_id=${businessId}`;
    log(`Opening ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    if (!storageState) {
      log('Logg inn på Meta Business med din Facebook-konto (opp til 10 min).');
      const ok = await waitForLogin(page);
      if (!ok) throw new Error('Login timed out.');
      await context.storageState({ path: STATE_PATH });
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    }

    log('Ventet på at siden laster ferdig…');
    await page.waitForTimeout(5000);
    log('');
    log('⏸ OVER TIL DEG i det åpne Chromium-vinduet:');
    log(`   1. Klikk blå "Add"-knapp (øverst til høyre)`);
    log(`   2. Velg "Create a new ad account"`);
    log(`   3. Name:     ${AD_ACCOUNT_NAME}`);
    log(`   4. Time Zone: ${TIMEZONE}`);
    log(`   5. Currency:  ${CURRENCY}`);
    log(`   6. Klikk "Next"`);
    log(`   7. Velg business owner (CreatorHub Norge) — Next`);
    log(`   8. Assign yourself som Admin — Assign`);
    log('');
    log('Skriptet watch-er URL + DOM i 15 min og printer act-ID-en når den dukker opp.');

    // Poll URL + DOM for new act_id
    const deadline = Date.now() + 15 * 60 * 1000;
    let foundId = null;
    while (Date.now() < deadline) {
      const url = page.url();
      const urlMatch = url.match(/act=(\d{12,})|ad_account_id=(\d{12,})|\/(\d{15,16})\b/);
      if (urlMatch) {
        foundId = urlMatch[1] || urlMatch[2] || urlMatch[3];
        break;
      }
      // Also watch DOM for any act_ reference freshly appearing
      const domId = await page.evaluate(() => {
        const text = document.body.innerText || '';
        const m = text.match(/\bact_(\d{12,})|Account ID[^\d]{0,5}(\d{12,})/);
        return m ? (m[1] || m[2]) : null;
      });
      if (domId) { foundId = domId; break; }
      await page.waitForTimeout(3000);
    }

    if (foundId) {
      log('');
      log(`✓ NY AD ACCOUNT ID: act_${foundId}`);
      log('');
      log(`Kjør opptak med:`);
      log(`   DEMO_AD_ACCOUNT_ID=act_${foundId} APP_URL=https://theroleroom.com \\`);
      log(`     node backend/scripts/record-ads-attribution-demo.playwright.mjs`);
    } else {
      log('⚠ Fant ikke act-ID i URL/DOM innen 15 min. Kopier ID-en manuelt fra listen når den dukker opp.');
    }
  } catch (err) {
    console.error('Script failed:', err?.message ?? err);
    await page.screenshot({ path: 'meta-ad-account-failure.png', fullPage: true }).catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }
})();
